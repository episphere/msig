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
const TMP_DIR = path.resolve(ROOT, ".tmp/sbs-class-validation");
const PYTHON = process.env.MSIG_E9_PYTHON || path.join(ROOT, ".tools/e2-python/Scripts/python.exe");
const VOLUME = process.env.MSIG_E9_SPM_VOLUME || path.join(ROOT, ".tools/spm-references");
const COMPARATOR = path.join(HERE, "run_sigprofiler_matrix_generator.py");
const BUILDS = { hg19: "GRCh37", hg38: "GRCh38" };
const SBS1536 = getExpectedContexts({ profile: "SBS", matrix: 1536 });
const REPLICATES_PER_CLASS = 100;
const TSB_BASES = [
  "A", "C", "G", "T", "A", "C", "G", "T", "A", "C",
  "G", "T", "A", "C", "G", "T", "N", "N", "N", "N",
];

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

function sequence(bytes, zeroBasedStart, length) {
  return Array.from(bytes.subarray(zeroBasedStart, zeroBasedStart + length), (value) => TSB_BASES[value] || "N").join("");
}

function parseContext(context) {
  const match = context.match(/^([ACGT]{2})\[([CT])>([ACGT])\]([ACGT]{2})$/);
  assert.ok(match, `Invalid SBS1536 context: ${context}`);
  return { pentamer: `${match[1]}${match[2]}${match[4]}`, ref: match[2], alt: match[3], sbs96: `${match[1][1]}[${match[2]}>${match[3]}]${match[4][0]}` };
}

function findPositions(bytes, pentamer) {
  const positions = [];
  for (let position = 100_000; position < bytes.length - 3; position += 1) {
    if (sequence(bytes, position - 3, 5) !== pentamer) continue;
    positions.push(position);
    if (positions.length === REPLICATES_PER_CLASS) return positions;
  }
  throw new Error(`Found only ${positions.length} loci for ${pentamer}`);
}

function mafText(rows, comparatorBuild) {
  const header = [
    "Hugo_Symbol", "Entrez_Gene_Id", "Center", "NCBI_Build", "Chromosome", "Start_position", "End_position",
    "Strand", "Variant_Classification", "Variant_Type", "Reference_Allele", "Tumor_Seq_Allele1", "Tumor_Seq_Allele2",
    "dbSNP_RS", "dbSNP_Val_Status", "Tumor_Sample_Barcode", "Matched_Norm_Sample_Barcode",
  ].join("\t");
  return `${header}\n${rows.map((row) => [row.expectedSBS1536, "0", "mSigSDK-E9", comparatorBuild, "chr1", row.start_position,
    row.start_position, "+", "Unknown", "SNP", row.reference_allele, row.reference_allele, row.tumor_seq_allele2,
    "", "", row.sample, "normal"].join("\t")).join("\n")}\n`;
}

function countAt(matrix, sample, context) {
  return Number(matrix?.[sample]?.[context] || 0);
}

async function validateBuild(build, comparatorBuild) {
  const bytes = await fs.readFile(path.join(VOLUME, "tsb", comparatorBuild, "1.txt"));
  const positions = new Map();
  const rows = SBS1536.flatMap((context) => {
    const parsed = parseContext(context);
    if (!positions.has(parsed.pentamer)) positions.set(parsed.pentamer, findPositions(bytes, parsed.pentamer));
    const sample = context.replaceAll(/[^ACGT]/g, "-");
    return positions.get(parsed.pentamer).map((startPosition, replicate) => ({
      chromosome: "1", start_position: startPosition, reference_allele: parsed.ref, tumor_seq_allele2: parsed.alt,
      variant_type: "SNP", context_sequence: parsed.pentamer, expectedSBS1536: context, expectedSBS96: parsed.sbs96,
      sample, replicate: replicate + 1,
    }));
  });
  assert.equal(rows.length, SBS1536.length * REPLICATES_PER_CLASS);
  const lookup = { lookup: Object.fromEntries(rows.map((row) => [`1:${row.start_position}`, { sequence: row.context_sequence, source: "local SigProfilerMatrixGenerator reference" }])) };
  const buildDir = path.join(TMP_DIR, build);
  const mafDir = path.join(buildDir, "maf");
  const outputDir = path.join(buildDir, "output");
  const resultPath = path.join(buildDir, "comparator.json");
  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(mafDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(mafDir, "sbs.maf"), mafText(rows, comparatorBuild), "utf8");
  const sdk = await convertMafToProfileSpectra(rows, { profiles: ["SBS96", "SBS1536"], groupBy: "sample", genome: build, offline: true, contextLookupTable: lookup });
  const command = await run(PYTHON, [COMPARATOR, "--project", `msig-e9-sbs-classes-${build}`, "--genome", comparatorBuild, "--profile", "SBS1536", "--maf-dir", mafDir, "--output-dir", outputDir, "--result", resultPath, "--volume", VOLUME], { SIGPROFILERMATRIXGENERATOR_VOLUME: VOLUME });
  const comparator = JSON.parse(await fs.readFile(resultPath, "utf8"));
  const classes = SBS1536.map((context) => {
    const parsed = parseContext(context);
    const sample = context.replaceAll(/[^ACGT]/g, "-");
    const sdk1536 = countAt(sdk.spectraByProfile.SBS1536, sample, context);
    const comparator1536 = countAt(comparator.matrices.SBS1536, sample, context);
    const sdk96 = countAt(sdk.spectraByProfile.SBS96, sample, parsed.sbs96);
    const comparator96 = countAt(comparator.matrices.SBS96, sample, parsed.sbs96);
    return { context, sbs96: parsed.sbs96, loci: REPLICATES_PER_CLASS, sdk1536, comparator1536, sdk96, comparator96,
      exact: sdk1536 === REPLICATES_PER_CLASS && comparator1536 === REPLICATES_PER_CLASS && sdk96 === REPLICATES_PER_CLASS && comparator96 === REPLICATES_PER_CLASS };
  });
  return {
    build, comparatorBuild, referenceVerified: comparator.referenceVerified, comparatorVersion: comparator.comparatorVersion,
    comparatorStatus: comparator.status, stderr: command.stderr, testedSBS1536Classes: SBS1536.length,
    distinctLociPerClass: REPLICATES_PER_CLASS, testedEvents: rows.length, matchingClasses: classes.filter((row) => row.exact).length,
    mismatches: classes.filter((row) => !row.exact), classes,
  };
}

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(TMP_DIR, { recursive: true });
const results = [];
for (const [build, comparatorBuild] of Object.entries(BUILDS)) results.push(await validateBuild(build, comparatorBuild));
const output = {
  schemaVersion: "msig.sbs_class_validation.v1", completedAt: new Date().toISOString(),
  design: "One hundred distinct, reference-verified chromosome 1 loci for each of the 1,536 SBS1536 contexts in each genome build; the corresponding SBS96 matrices were compared from the same events.",
  results,
  pass: results.every((result) => result.referenceVerified && result.comparatorStatus === "completed" && result.matchingClasses === result.testedSBS1536Classes && result.mismatches.length === 0),
};
await fs.writeFile(path.join(DATA_DIR, "sbs-class-validation-results.json"), JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ pass: output.pass, results: results.map(({ classes, ...result }) => result) }, null, 2));
assert.equal(output.pass, true, "SBS class validation did not achieve complete agreement");
