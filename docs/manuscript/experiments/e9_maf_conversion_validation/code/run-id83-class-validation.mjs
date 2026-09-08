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
const TMP_DIR = path.resolve(ROOT, ".tmp/id83-class-validation");
const PYTHON = process.env.MSIG_E9_PYTHON || path.join(ROOT, ".tools/e2-python/Scripts/python.exe");
const VOLUME = process.env.MSIG_E9_SPM_VOLUME || path.join(ROOT, ".tools/spm-references");
const COMPARATOR = path.join(HERE, "run_sigprofiler_matrix_generator.py");
const BUILDS = { hg19: "GRCh37", hg38: "GRCh38" };
const ID83 = getExpectedContexts({ profile: "ID", matrix: 83 });
const REPLICATES_PER_CLASS = 100;
const BASES = ["A", "C", "G", "T"];
const TSB_BASES = [
  "A", "C", "G", "T", "A", "C", "G", "T", "A", "C",
  "G", "T", "A", "C", "G", "T", "N", "N", "N", "N",
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function run(command, args, env = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, windowsHide: true, env: { ...process.env, ...env } });
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

function sequence(bytes, zeroBasedStart, length) {
  return Array.from(bytes.subarray(zeroBasedStart, zeroBasedStart + length), (value) => TSB_BASES[value] || "N").join("");
}

function reverseComplement(value) {
  return [...value].reverse().map((base) => ({ A: "T", C: "G", G: "C", T: "A" })[base]).join("");
}

function canonicalBase(value) {
  return value === "C" || value === "G" ? "C" : "T";
}

function classify(bytes, start, kind, insertedOrDeleted) {
  const length = insertedOrDeleted.length;
  let assembled = insertedOrDeleted;
  let left = start;
  const rightStart = kind === "Del" ? start + length : start;
  let right = rightStart;
  while (left - length > 0 && sequence(bytes, left - length, length) === insertedOrDeleted) {
    assembled = insertedOrDeleted + assembled;
    left -= length;
  }
  while (right + length < bytes.length && sequence(bytes, right, length) === insertedOrDeleted) {
    assembled += insertedOrDeleted;
    right += length;
  }

  let microhomology = 0;
  if (length > 1 && assembled.length === length) {
    const forward = insertedOrDeleted.slice(0, -1);
    const reverse = insertedOrDeleted.slice(1);
    let forwardLength = 0;
    let reverseLength = 0;
    const homologyStart = kind === "Del" ? start + length : start;
    for (let size = forward.length; size > 0; size -= 1) {
      if (sequence(bytes, homologyStart, size) === forward.slice(0, size)) {
        forwardLength = size;
        break;
      }
    }
    for (let size = reverse.length; size > 0; size -= 1) {
      if (sequence(bytes, start - size, size) === reverse.slice(-size)) {
        reverseLength = size;
        break;
      }
    }
    microhomology = Math.max(forwardLength, reverseLength);
  }

  const binnedLength = Math.min(5, length);
  if (length === 1) {
    return `1:${kind}:${canonicalBase(insertedOrDeleted)}:${Math.min(5, assembled.length - 1)}`;
  }
  if (kind === "Del" && microhomology > 0) {
    return `${binnedLength}:Del:M:${Math.min(5, microhomology)}`;
  }
  if (kind === "Ins" && microhomology > 0) return `${binnedLength}:Ins:R:0`;
  return `${binnedLength}:${kind}:R:${Math.min(5, assembled.length / length - 1)}`;
}

function findEvents(bytes) {
  const found = new Map(ID83.map((context) => [context, []]));
  const needed = () => [...found.values()].some((events) => events.length < REPLICATES_PER_CLASS);
  const fallbackInsertions = new Map([
    [1, BASES], [2, ["AC", "CA", "GT", "TG"]], [3, ["ACG", "CAT", "GTC", "TGA"]],
    [4, ["ACGT", "CATG", "GTAC", "TGCA"]], [5, ["ACGTA", "CATGC", "GTACG", "TGCAT"]],
  ]);
  for (let start = 100_000; start < Math.min(bytes.length - 50, 20_000_000) && needed(); start += 1) {
    for (let length = 1; length <= 6; length += 1) {
      const deleted = sequence(bytes, start, length);
      if (!/^[ACGT]+$/.test(deleted)) continue;
      const context = classify(bytes, start, "Del", deleted);
      const events = found.get(context);
      if (events && events.length < REPLICATES_PER_CLASS) {
        events.push({ start, kind: "Del", eventSequence: deleted });
      }
    }
    for (let length = 1; length <= 5; length += 1) {
      const candidates = new Set([
        sequence(bytes, start, length),
        sequence(bytes, start - length, length),
        ...fallbackInsertions.get(length),
      ]);
      for (const inserted of candidates) {
        if (!/^[ACGT]+$/.test(inserted)) continue;
        const context = classify(bytes, start, "Ins", inserted);
        const events = found.get(context);
        if (events && events.length < REPLICATES_PER_CLASS) {
          events.push({ start, kind: "Ins", eventSequence: inserted });
        }
      }
    }
  }
  const missing = [...found].filter(([, events]) => events.length < REPLICATES_PER_CLASS).map(([context]) => context);
  assert.deepEqual(missing, [], `Could not construct examples for: ${missing.join(", ")}`);
  return found;
}

function mafText(rows, comparatorBuild) {
  const header = [
    "Hugo_Symbol", "Entrez_Gene_Id", "Center", "NCBI_Build", "Chromosome",
    "Start_position", "End_position", "Strand", "Variant_Classification",
    "Variant_Type", "Reference_Allele", "Tumor_Seq_Allele1", "Tumor_Seq_Allele2",
    "dbSNP_RS", "dbSNP_Val_Status", "Tumor_Sample_Barcode", "Matched_Norm_Sample_Barcode",
  ].join("\t");
  return `${header}\n${rows.map((row) => [
    row.expectedClass, "0", "mSigSDK-E9", comparatorBuild, "chr1", row.start_position,
    row.kind === "Del" ? row.start_position + row.eventSequence.length - 1 : row.start_position,
    "+", "Unknown", row.kind === "Del" ? "DEL" : "INS", row.reference_allele,
    row.reference_allele, row.tumor_seq_allele2, "", "", row.sample, "normal",
  ].join("\t")).join("\n")}\n`;
}

function sampleBin(matrix, sample) {
  const bins = Object.entries(matrix?.[sample] || {}).filter(([, count]) => Number(count) > 0).map(([context]) => context);
  return { bin: bins.length === 1 ? bins[0] : bins.join("|"), total: Object.values(matrix?.[sample] || {}).reduce((sum, count) => sum + Number(count || 0), 0) };
}

async function validateBuild(build, comparatorBuild) {
  const bytes = await fs.readFile(path.join(VOLUME, "tsb", comparatorBuild, "1.txt"));
  const examples = findEvents(bytes);
  const rows = ID83.flatMap((expectedClass) => examples.get(expectedClass).map((example, replicate) => {
    const [length, kind, subtype, index] = expectedClass.split(":");
    return {
      chromosome: "1", start_position: example.start + 1, kind, eventSequence: example.eventSequence,
      reference_allele: kind === "Del" ? example.eventSequence : "-",
      tumor_seq_allele2: kind === "Ins" ? example.eventSequence : "-",
      variant_type: kind === "Del" ? "DEL" : "INS",
      ...(subtype === "M" ? { microhomology_length: Number(index) } : { repeat_index: Number(index) }),
      expectedClass, replicate: replicate + 1,
      sample: `${expectedClass.replaceAll(":", "-")}-r${replicate + 1}`,
    };
  }));
  assert.equal(rows.length, ID83.length * REPLICATES_PER_CLASS);
  const buildDir = path.join(TMP_DIR, build);
  const mafDir = path.join(buildDir, "maf");
  const outputDir = path.join(buildDir, "output");
  const resultPath = path.join(buildDir, "comparator.json");
  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(mafDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  const input = mafText(rows, comparatorBuild);
  await fs.writeFile(path.join(mafDir, "id83.maf"), input, "utf8");
  const sdk = await convertMafToProfileSpectra(rows, { profiles: ["ID83"], groupBy: "sample", genome: build, offline: true });
  const command = await run(PYTHON, [COMPARATOR, "--project", `msig-e9-id83-classes-${build}`, "--genome", comparatorBuild, "--profile", "ID83", "--maf-dir", mafDir, "--output-dir", outputDir, "--result", resultPath, "--volume", VOLUME], { SIGPROFILERMATRIXGENERATOR_VOLUME: VOLUME });
  const comparator = JSON.parse(await fs.readFile(resultPath, "utf8"));
  const events = rows.map((row) => {
    const sdkResult = sampleBin(sdk.spectraByProfile.ID83, row.sample);
    const comparatorResult = sampleBin(comparator.matrices.ID83, row.sample);
    return {
      ...row, sdkClass: sdkResult.bin, sdkCount: sdkResult.total,
      comparatorClass: comparatorResult.bin, comparatorCount: comparatorResult.total,
      sdkMatchesExpected: sdkResult.bin === row.expectedClass && sdkResult.total === 1,
      comparatorMatchesExpected: comparatorResult.bin === row.expectedClass && comparatorResult.total === 1,
      methodsAgree: sdkResult.bin === comparatorResult.bin && sdkResult.total === comparatorResult.total,
    };
  });
  return {
    build, comparatorBuild, inputSha256: sha256(input), referenceVerified: comparator.referenceVerified,
    comparatorVersion: comparator.comparatorVersion, comparatorStatus: comparator.status, stderr: command.stderr,
    testedClasses: ID83.length, replicatesPerClass: REPLICATES_PER_CLASS, testedEvents: events.length,
    sdkExpectedMatches: events.filter((row) => row.sdkMatchesExpected).length,
    comparatorExpectedMatches: events.filter((row) => row.comparatorMatchesExpected).length,
    methodAgreements: events.filter((row) => row.methodsAgree).length,
    excludedByComparator: events.filter((row) => row.comparatorCount === 0).map((row) => row.sample),
    mismatches: events.filter((row) => !row.methodsAgree || !row.sdkMatchesExpected || !row.comparatorMatchesExpected), events,
  };
}

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(TMP_DIR, { recursive: true });
const results = [];
for (const [build, comparatorBuild] of Object.entries(BUILDS)) results.push(await validateBuild(build, comparatorBuild));
const output = {
  schemaVersion: "msig.id83_class_validation.v1", completedAt: new Date().toISOString(),
  design: "One hundred distinct reference-derived events for each of the 83 ID83 classes in each genome build. SigProfilerMatrixGenerator inferred the class from the genomic sequence; the corresponding repeat or microhomology value was supplied to mSigSDK.",
  results,
  pass: results.every((result) => result.referenceVerified && result.comparatorStatus === "completed" && result.sdkExpectedMatches === result.testedEvents && result.comparatorExpectedMatches === result.testedEvents && result.methodAgreements === result.testedEvents),
};
await fs.writeFile(path.join(DATA_DIR, "id83-class-validation-results.json"), JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ pass: output.pass, results: results.map(({ events, ...result }) => result) }, null, 2));
assert.equal(output.pass, true, "ID83 class validation did not achieve complete agreement");
