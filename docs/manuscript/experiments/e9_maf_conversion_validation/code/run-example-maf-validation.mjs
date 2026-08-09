import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { convertMafToProfileSpectra } from "../../../../../mSigSDKScripts/mutationalSpectrum.js";
import { getExpectedContexts } from "../../../../../mSigSDKScripts/validation.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const DATA_DIR = path.resolve(HERE, "../data");
const TMP_DIR = path.resolve(ROOT, ".tmp/example-maf-validation");
const INPUT_PATH = path.resolve(ROOT, "examples/maf/example.input.maf");
const PYTHON = process.env.MSIG_E9_PYTHON || path.join(ROOT, ".tools/e2-python/Scripts/python.exe");
const VOLUME = process.env.MSIG_E9_SPM_VOLUME || path.join(ROOT, ".tools/spm-references");
const COMPARATOR = path.join(HERE, "run_sigprofiler_matrix_generator.py");
const CONTEXTS = {
  SBS96: getExpectedContexts({ profile: "SBS", matrix: 96 }),
  SBS1536: getExpectedContexts({ profile: "SBS", matrix: 1536 }),
};
const TSB_BASES = ["A", "C", "G", "T", "A", "C", "G", "T", "A", "C", "G", "T", "A", "C", "G", "T", "N", "N", "N", "N"];

async function run(command, args, env = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, windowsHide: true, env: { ...process.env, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || stdout || `Command exited with ${code}`)));
  });
}

function parseMaf(text) {
  const lines = text.trimEnd().split(/\r?\n/);
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => Object.fromEntries(line.split("\t").map((value, index) => [headers[index], value])));
}

function chromosome(value) {
  return String(value).replace(/^chr/i, "");
}

function uniqueCount(rows, keys) {
  return new Set(rows.map((row) => keys.map((key) => row[key]).join(":"))).size;
}

function profileComparison(sdk, comparator, profile) {
  const samples = new Set([...Object.keys(sdk || {}), ...Object.keys(comparator || {})]);
  const mismatches = [];
  for (const sample of samples) {
    for (const context of CONTEXTS[profile]) {
      const sdkCount = Number(sdk?.[sample]?.[context] || 0);
      const comparatorCount = Number(comparator?.[sample]?.[context] || 0);
      if (sdkCount !== comparatorCount) mismatches.push({ sample, context, sdkCount, comparatorCount });
    }
  }
  return { profile, samples: samples.size, mismatches, exact: mismatches.length === 0 };
}

const input = await fs.readFile(INPUT_PATH, "utf8");
const rows = parseMaf(input);
const referenceCache = new Map();
const lookup = { lookup: {} };
for (const row of rows) {
  if (row.Variant_Type !== "SNP") continue;
  const chrom = chromosome(row.Chromosome);
  if (!referenceCache.has(chrom)) referenceCache.set(chrom, await fs.readFile(path.join(VOLUME, "tsb", "GRCh37", `${chrom}.txt`)));
  const position = Number(row.Start_position);
  const bytes = referenceCache.get(chrom);
  const context = Array.from(bytes.subarray(position - 3, position + 2), (value) => TSB_BASES[value] || "N").join("");
  lookup.lookup[`${chrom}:${position}`] = { sequence: context, source: "local SigProfilerMatrixGenerator GRCh37 reference" };
}

const sdk = await convertMafToProfileSpectra(rows, { profiles: ["SBS96", "SBS1536"], groupBy: "sample", genome: "hg19", offline: true, contextLookupTable: lookup });
await fs.rm(TMP_DIR, { recursive: true, force: true });
const mafDir = path.join(TMP_DIR, "maf");
const outputDir = path.join(TMP_DIR, "output");
const resultPath = path.join(TMP_DIR, "comparator.json");
await fs.mkdir(mafDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(mafDir, "example.input.maf"), input, "utf8");
const command = await run(PYTHON, [COMPARATOR, "--project", "msig-e9-example-maf", "--genome", "GRCh37", "--profile", "SBS1536", "--maf-dir", mafDir, "--output-dir", outputDir, "--result", resultPath, "--volume", VOLUME], { SIGPROFILERMATRIXGENERATOR_VOLUME: VOLUME });
const comparator = JSON.parse(await fs.readFile(resultPath, "utf8"));
const comparisons = ["SBS96", "SBS1536"].map((profile) => profileComparison(sdk.spectraByProfile[profile], comparator.matrices[profile], profile));
const trace = sdk.traceByProfile.SBS1536 || [];
const countedIndices = new Set(trace.filter((entry) => entry.counted).flatMap((entry) => entry.rowIndices || [entry.index]));
const countedRows = rows.filter((row, index) => countedIndices.has(index));
const rejectedRowsByReason = Object.fromEntries(
  [...trace
    .filter((entry) => !entry.counted)
    .reduce((counts, entry) => {
      const reason = entry.skippedReason || "unspecified";
      counts.set(reason, (counts.get(reason) || 0) + 1);
      return counts;
    }, new Map())]
    .sort(([left], [right]) => left.localeCompare(right)),
);
const variantTypeCounts = Object.fromEntries([...new Set(rows.map((row) => row.Variant_Type))].sort().map((type) => [type, rows.filter((row) => row.Variant_Type === type).length]));
const output = {
  schemaVersion: "msig.example_maf_validation.v1", completedAt: new Date().toISOString(), inputPath: INPUT_PATH,
  immediateSource: "Derived from ding-lab/MuSiC2 example/smg/example.input.maf, added in MuSiC2 commit 202ada53d1f2327d9e3096f614b1b04f0f3ad383 on 2018-11-23 as an SMG workflow example.",
  modificationsFromUpstream: "The mSig copy omits six records present in the current MuSiC2 file and changes one NBPF1 coordinate.",
  provenanceLimitation: "MuSiC2 does not identify the underlying tumor type, study, accession, or patient provenance.",
  genomeBuild: "GRCh37", inputRows: rows.length, samples: new Set(rows.map((row) => row.Tumor_Sample_Barcode)).size,
  variantTypeCounts, distinctChromosomePositionPairs: uniqueCount(rows, ["Chromosome", "Start_position"]),
  distinctSampleVariantRecords: uniqueCount(rows, ["Tumor_Sample_Barcode", "Chromosome", "Start_position", "Reference_Allele", "Tumor_Seq_Allele2"]),
  sdkCountedSubstitutions: countedRows.length, sdkRejectedRows: rows.length - countedRows.length,
  rejectedRowsByReason,
  countedDistinctChromosomePositionPairs: uniqueCount(countedRows, ["Chromosome", "Start_position"]),
  comparatorVersion: comparator.comparatorVersion, comparatorStatus: comparator.status, referenceVerified: comparator.referenceVerified,
  stderr: command.stderr, comparisons,
  pass: comparator.status === "completed" && comparator.referenceVerified && comparisons.every((comparison) => comparison.exact),
};
await fs.writeFile(path.join(DATA_DIR, "example-maf-validation-results.json"), JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(JSON.stringify(output, null, 2));
assert.equal(output.pass, true, "Example MAF validation did not achieve exact agreement");
