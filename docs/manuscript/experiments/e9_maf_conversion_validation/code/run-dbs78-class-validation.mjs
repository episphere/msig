import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { convertMafToProfileSpectra } from "../../../../../mSigSDKScripts/mutationalSpectrum.js";
import { getExpectedContexts } from "../../../../../mSigSDKScripts/validation.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const DATA_DIR = path.resolve(HERE, "../data");
const TMP_DIR = path.resolve(ROOT, ".tmp/dbs78-class-validation");
const PYTHON = process.env.MSIG_E9_PYTHON || path.join(ROOT, ".tools/e2-python/Scripts/python.exe");
const VOLUME = process.env.MSIG_E9_SPM_VOLUME || path.join(ROOT, ".tools/spm-references");
const COMPARATOR = path.join(HERE, "run_sigprofiler_matrix_generator.py");
const BUILDS = { hg19: "GRCh37", hg38: "GRCh38" };
const DBS78 = getExpectedContexts({ profile: "DBS", matrix: 78 });
const REPLICATES_PER_CLASS = 100;
const TSB_BASES = [
  "A", "C", "G", "T", "A", "C", "G", "T", "A", "C",
  "G", "T", "A", "C", "G", "T", "N", "N", "N", "N",
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function run(command, args, env = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      windowsHide: true,
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0
      ? resolve({ stdout, stderr })
      : reject(new Error(stderr || stdout || `Command exited with ${code}`)));
  });
}

function referenceSequence(bytes, oneBasedPosition, length = 2) {
  return Array.from(
    bytes.subarray(oneBasedPosition - 1, oneBasedPosition - 1 + length),
    (value) => TSB_BASES[value] || "N",
  ).join("");
}

function findSeparatedPositions(bytes, dinucleotide, count = REPLICATES_PER_CLASS) {
  const positions = [];
  for (let position = 100_000; position < bytes.length; position += 1) {
    if (referenceSequence(bytes, position) !== dinucleotide) continue;
    positions.push(position);
    if (positions.length === count) return positions;
  }
  throw new Error(`Could not find ${count} separated ${dinucleotide} reference positions`);
}

function mafText(rows, comparatorBuild) {
  const header = [
    "Hugo_Symbol", "Entrez_Gene_Id", "Center", "NCBI_Build", "Chromosome",
    "Start_position", "End_position", "Strand", "Variant_Classification",
    "Variant_Type", "Reference_Allele", "Tumor_Seq_Allele1", "Tumor_Seq_Allele2",
    "dbSNP_RS", "dbSNP_Val_Status", "Tumor_Sample_Barcode", "Matched_Norm_Sample_Barcode",
  ].join("\t");
  return `${header}\n${rows.map((row) => [
    row.expectedClass,
    "0",
    "mSigSDK-E9",
    comparatorBuild,
    `chr${row.chromosome}`,
    row.start_position,
    row.start_position + 1,
    "+",
    "Unknown",
    "DNP",
    row.reference_allele,
    row.reference_allele,
    row.tumor_seq_allele2,
    "",
    "",
    row.sample,
    "normal",
  ].join("\t")).join("\n")}\n`;
}

function sampleBin(matrix, sample) {
  const bins = Object.entries(matrix?.[sample] || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([context]) => context);
  return {
    bin: bins.length === 1 ? bins[0] : bins.join("|"),
    total: Object.values(matrix?.[sample] || {}).reduce((sum, count) => sum + Number(count || 0), 0),
  };
}

async function validateBuild(build, comparatorBuild) {
  const referencePath = path.join(VOLUME, "tsb", comparatorBuild, "1.txt");
  const referenceBytes = await fs.readFile(referencePath);
  const positionsByReference = new Map();
  const rows = DBS78.flatMap((expectedClass) => {
    const [referenceAllele, alternateAllele] = expectedClass.split(">");
    if (!positionsByReference.has(referenceAllele)) {
      positionsByReference.set(referenceAllele, findSeparatedPositions(referenceBytes, referenceAllele));
    }
    return positionsByReference.get(referenceAllele).map((startPosition, replicate) => ({
      chromosome: "1",
      start_position: startPosition,
      reference_allele: referenceAllele,
      tumor_seq_allele2: alternateAllele,
      variant_type: "DNP",
      expectedClass,
      replicate: replicate + 1,
      sample: `${expectedClass.replace(">", "-")}-r${replicate + 1}`,
      confirmedReference: referenceSequence(referenceBytes, startPosition),
    }));
  });
  assert.equal(rows.length, DBS78.length * REPLICATES_PER_CLASS);
  assert.ok(rows.every((row) => row.confirmedReference === row.reference_allele));

  const buildDir = path.join(TMP_DIR, build);
  const mafDir = path.join(buildDir, "maf");
  const outputDir = path.join(buildDir, "output");
  const resultPath = path.join(buildDir, "comparator.json");
  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(mafDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  const input = mafText(rows, comparatorBuild);
  await fs.writeFile(path.join(mafDir, "dbs78.maf"), input, "utf8");

  const sdk = await convertMafToProfileSpectra(rows, {
    profiles: ["DBS78"],
    groupBy: "sample",
    genome: build,
    offline: true,
  });
  const command = await run(PYTHON, [
    COMPARATOR,
    "--project", `msig-e9-dbs78-classes-${build}`,
    "--genome", comparatorBuild,
    "--profile", "DBS78",
    "--maf-dir", mafDir,
    "--output-dir", outputDir,
    "--result", resultPath,
    "--volume", VOLUME,
  ], { SIGPROFILERMATRIXGENERATOR_VOLUME: VOLUME });
  const comparator = JSON.parse(await fs.readFile(resultPath, "utf8"));
  const comparatorMatrix = comparator.matrices.DBS78;
  const sdkMatrix = sdk.spectraByProfile.DBS78;
  const events = rows.map((row) => {
    const sdkResult = sampleBin(sdkMatrix, row.sample);
    const comparatorResult = sampleBin(comparatorMatrix, row.sample);
    return {
      ...row,
      end_position: row.start_position + 1,
      sdkClass: sdkResult.bin,
      sdkCount: sdkResult.total,
      comparatorClass: comparatorResult.bin,
      comparatorCount: comparatorResult.total,
      sdkMatchesExpected: sdkResult.bin === row.expectedClass && sdkResult.total === 1,
      comparatorMatchesExpected: comparatorResult.bin === row.expectedClass && comparatorResult.total === 1,
      methodsAgree: sdkResult.bin === comparatorResult.bin && sdkResult.total === comparatorResult.total,
    };
  });
  return {
    build,
    comparatorBuild,
    inputSha256: sha256(input),
    referenceVerified: comparator.referenceVerified,
    comparatorVersion: comparator.comparatorVersion,
    comparatorStatus: comparator.status,
    stderr: command.stderr,
    testedClasses: DBS78.length,
    replicatesPerClass: REPLICATES_PER_CLASS,
    testedEvents: events.length,
    sdkExpectedMatches: events.filter((row) => row.sdkMatchesExpected).length,
    comparatorExpectedMatches: events.filter((row) => row.comparatorMatchesExpected).length,
    methodAgreements: events.filter((row) => row.methodsAgree).length,
    excludedByComparator: events.filter((row) => row.comparatorCount === 0).map((row) => row.sample),
    mismatches: events.filter((row) => !row.methodsAgree || !row.sdkMatchesExpected || !row.comparatorMatchesExpected),
    events,
  };
}

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(TMP_DIR, { recursive: true });
const results = [];
for (const [build, comparatorBuild] of Object.entries(BUILDS)) {
  results.push(await validateBuild(build, comparatorBuild));
}
const output = {
  schemaVersion: "msig.dbs78_class_validation.v1",
  completedAt: new Date().toISOString(),
  design: "One hundred distinct, reference-verified genomic positions for each of the 78 DBS78 classes in each genome build; DNP end position equals start position plus one.",
  results,
  pass: results.every((result) =>
    result.referenceVerified &&
    result.comparatorStatus === "completed" &&
    result.sdkExpectedMatches === result.testedEvents &&
    result.comparatorExpectedMatches === result.testedEvents &&
    result.methodAgreements === result.testedEvents
  ),
};
await fs.writeFile(
  path.join(DATA_DIR, "dbs78-class-validation-results.json"),
  JSON.stringify(output, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify({
  pass: output.pass,
  results: results.map(({ events, ...result }) => result),
}, null, 2));
assert.equal(output.pass, true, "DBS78 class validation did not achieve complete agreement");
