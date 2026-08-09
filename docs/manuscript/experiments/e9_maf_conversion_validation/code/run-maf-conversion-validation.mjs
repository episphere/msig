import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import {
  convertMafToProfileSpectra,
  getMutationalContext,
} from "../../../../../mSigSDKScripts/mutationalSpectrum.js";
import { getExpectedContexts } from "../../../../../mSigSDKScripts/validation.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const DATA_DIR = path.resolve(HERE, "../data");
const TMP_DIR = path.resolve(ROOT, ".tmp/maf-conversion-validation");
const FIXTURE_PATH = path.join(DATA_DIR, "fixture.json");
const PROGRESS_PATH = path.join(DATA_DIR, "maf-conversion-validation-progress.json");
const RESULTS_PATH = path.join(DATA_DIR, "maf-conversion-validation-results.json");
const RECONCILIATION_PATH = path.join(DATA_DIR, "maf-conversion-reconciliation.csv");
const VALID_EVENTS_PATH = path.join(DATA_DIR, "maf-conversion-valid-event-reconciliation.csv");
const DURABLE_COMPARATOR_DIR = path.join(DATA_DIR, "comparator-artifacts");
const PYTHON_PATH = process.env.MSIG_E9_PYTHON || path.join(ROOT, ".tools/e2-python/Scripts/python.exe");
const VOLUME_PATH = process.env.MSIG_E9_SPM_VOLUME || path.join(ROOT, ".tools/spm-references");
const COMPARATOR_SCRIPT = path.join(HERE, "run_sigprofiler_matrix_generator.py");

const PROFILE_CONTEXTS = {
  SBS96: getExpectedContexts({ profile: "SBS", matrix: 96 }),
  SBS1536: getExpectedContexts({ profile: "SBS", matrix: 1536 }),
  DBS78: getExpectedContexts({ profile: "DBS", matrix: 78 }),
  ID83: getExpectedContexts({ profile: "ID", matrix: 83 }),
};
const PROFILE_SPECS = [
  ["SBS", "SBS96"],
  ["SBS", "SBS1536"],
  ["DBS", "DBS78"],
  ["ID", "ID83"],
];
const PROFILE_KEYS = PROFILE_SPECS.map(([, key]) => key);
const BUILD_TO_COMPARATOR = { hg19: "GRCh37", hg38: "GRCh38" };

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(DURABLE_COMPARATOR_DIR, { recursive: true });

const fixture = JSON.parse(await fs.readFile(FIXTURE_PATH, "utf8"));
const runStartedAt = new Date().toISOString();
const progress = {
  schemaVersion: "msig.maf_conversion_validation_progress.v0.2",
  status: "running",
  stage: "initialized",
  runStartedAt,
  updatedAt: runStartedAt,
  resultPath: RESULTS_PATH,
};

async function writeProgress(stage, extra = {}) {
  Object.assign(progress, { stage, updatedAt: new Date().toISOString(), ...extra });
  await fs.writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2) + "\n", "utf8");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath) {
  return sha256(await fs.readFile(filePath));
}

async function runCommand(command, args, label, extraEnv = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      windowsHide: true,
      env: { ...process.env, ...extraEnv },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => reject(new Error(`${label}: ${error.message}`)));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${label} exited with ${code}: ${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function retry(fn, label, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError?.message || lastError}`);
}

function buildCases(build, profile, category) {
  return fixture.cases
    .filter((item) => item.profile === profile && item.category === category)
    .flatMap((item) => {
      const buildRows = item.builds[build];
      const rows = Array.isArray(buildRows) ? buildRows : [buildRows];
      return rows.map((row, index) => ({
        ...row,
        eventId: `${item.id}:${index}`,
        sample: item.sample,
        caseId: item.id,
        caseIndex: index,
        category: item.category,
        expectedSdkSkipReason: item.expectedSdkSkipReason || null,
        expectedSdkSkipReasons: item.expectedSdkSkipReasons || null,
        expectedSdkCounted: item.expectedSdkCounted ?? null,
        ...(item.context ? { context: item.context } : {}),
      }));
    });
}

function externalChromosome(value) {
  const text = String(value);
  return text.toLowerCase().startsWith("chr") ? text : `chr${text}`;
}

function externalMafRow(row, build) {
  const endPosition = row.variant_type === "DNP" && /^[ACGT]{2}$/.test(row.reference_allele)
    ? Number(row.start_position) + 1
    : row.start_position;
  const fields = [
    row.caseId,
    "0",
    "mSigSDK-E9",
    BUILD_TO_COMPARATOR[build],
    externalChromosome(row.chromosome),
    String(row.start_position),
    String(endPosition),
    "+",
    row.variant_type === "SNP" ? "Missense_Mutation" : "Unknown",
    row.variant_type,
    row.reference_allele,
    row.reference_allele,
    row.tumor_seq_allele2,
    "",
    "",
    row.comparatorSample || row.sample,
    "normal",
  ];
  return fields.join("\t");
}

const SIGPROFILER_TSB_BASES = [
  "A", "C", "G", "T", "A", "C", "G", "T", "A", "C",
  "G", "T", "A", "C", "G", "T", "N", "N", "N", "N",
];

async function readSigProfilerContext(build, row) {
  const position = Number(row.start_position);
  if (!Number.isInteger(position) || position < 3) return null;
  const referencePath = path.join(
    VOLUME_PATH,
    "tsb",
    BUILD_TO_COMPARATOR[build],
    `${row.chromosome}.txt`,
  );
  try {
    const bytes = await fs.readFile(referencePath);
    const start = position - 3;
    const end = position + 2;
    if (end > bytes.length) return null;
    return Array.from(bytes.subarray(start, end), (value) => SIGPROFILER_TSB_BASES[value] || "N").join("");
  } catch {
    return null;
  }
}

async function writeMaf(rows, build, filePath) {
  const header = [
    "Hugo_Symbol", "Entrez_Gene_Id", "Center", "NCBI_Build", "Chromosome",
    "Start_position", "End_position", "Strand", "Variant_Classification",
    "Variant_Type", "Reference_Allele", "Tumor_Seq_Allele1", "Tumor_Seq_Allele2",
    "dbSNP_RS", "dbSNP_Val_Status", "Tumor_Sample_Barcode", "Matched_Norm_Sample_Barcode",
  ].join("\t");
  await fs.writeFile(
    filePath,
    `${header}\n${rows.map((row) => externalMafRow(row, build)).join("\n")}\n`,
    "utf8",
  );
}

async function checkReference(build) {
  const code = [
    "from SigProfilerMatrixGenerator.scripts.reference_genome_manager import ReferenceGenomeManager",
    "import sys",
    "manager = ReferenceGenomeManager(sys.argv[2])",
    "print(manager.is_genome_installed(sys.argv[1]))",
  ].join("; ");
  const result = await runCommand(
    PYTHON_PATH,
    ["-c", code, BUILD_TO_COMPARATOR[build], VOLUME_PATH],
    `reference check ${build}`,
    { SIGPROFILERMATRIXGENERATOR_VOLUME: VOLUME_PATH },
  );
  if (!result.stdout.trim().endsWith("True")) {
    throw new Error(`SigProfilerMatrixGenerator reference ${BUILD_TO_COMPARATOR[build]} is not installed in ${VOLUME_PATH}.`);
  }
}

async function makeContextLookup(build, rows) {
  const lookup = {};
  const referenceChecks = [];
  for (const row of rows) {
    if (row.variant_type !== "SNP" || !/^[ACGT]$/.test(row.reference_allele)) continue;
    const key = `${row.chromosome}:${row.start_position}`;
    if (lookup[key]) continue;
    const context = await retry(
      () => getMutationalContext(row.chromosome, build, row.start_position, { contextSize: 5 }),
      `UCSC context ${build} ${key}`,
    );
    const comparatorContext = await readSigProfilerContext(build, row);
    lookup[key] = { sequence: context, source: "UCSC Genome Browser API" };
    referenceChecks.push({
      key,
      context,
      comparatorContext,
      expectedContext5: row.expected_context5 || null,
      reference: row.reference_allele,
      matchesExpectedContext: !row.expected_context5 || row.expected_context5 === context,
      matchesReference: context[2] === row.reference_allele,
      matchesComparatorContext: comparatorContext === context,
      matchesComparatorReference: Boolean(comparatorContext && comparatorContext[2] === row.reference_allele),
    });
  }
  return { lookup, referenceChecks };
}

function matrixForSample(matrix, sample, contexts) {
  const source = matrix?.[sample] || {};
  return Object.fromEntries(contexts.map((context) => [context, Number(source[context] || 0)]));
}

function nonZeroBins(matrix) {
  return Object.entries(matrix).filter(([, value]) => value > 0).map(([context]) => context);
}

function compareMatrix(profileKey, sdkMatrix, comparatorMatrix, samples) {
  const contexts = PROFILE_CONTEXTS[profileKey];
  const sampleResults = samples.map((sample) => {
    const sdk = matrixForSample(sdkMatrix, sample, contexts);
    const comparator = matrixForSample(comparatorMatrix, sample, contexts);
    const mismatches = contexts
      .filter((context) => sdk[context] !== comparator[context])
      .map((context) => ({ context, sdk: sdk[context], comparator: comparator[context] }));
    const sdkBins = nonZeroBins(sdk);
    const comparatorBins = nonZeroBins(comparator);
    return {
      sample,
      sdkTotal: Object.values(sdk).reduce((sum, value) => sum + value, 0),
      comparatorTotal: Object.values(comparator).reduce((sum, value) => sum + value, 0),
      sdkNonZeroContexts: sdkBins.length,
      comparatorNonZeroContexts: comparatorBins.length,
      sdkBins,
      comparatorBins,
      exact: mismatches.length === 0,
      eventBinAgreement: sdkBins.length === comparatorBins.length && sdkBins.every((bin) => comparatorBins.includes(bin)),
      mismatches,
    };
  });
  return {
    profileKey,
    contextCount: contexts.length,
    exact: sampleResults.every((sample) => sample.exact),
    eventBinAgreement: sampleResults.every((sample) => sample.eventBinAgreement),
    samples: sampleResults,
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function traceBins(trace) {
  return trace?.counted && trace.finalBin ? [trace.finalBin] : [];
}

function comparatorSample(matrix, sample, contexts) {
  const values = matrixForSample(matrix, sample, contexts);
  return {
    counted: Object.values(values).some((value) => value > 0),
    bins: nonZeroBins(values).sort(),
    total: Object.values(values).reduce((sum, value) => sum + value, 0),
  };
}

async function persistComparatorArtifacts({ build, profileKey, label, payload, logPath }) {
  const artifactDir = path.join(DURABLE_COMPARATOR_DIR, build, profileKey);
  await fs.mkdir(artifactDir, { recursive: true });
  const matrixPath = path.join(artifactDir, `${label}.matrix.json`);
  const durableLogPath = path.join(artifactDir, `${label}.log`);
  await fs.writeFile(
    matrixPath,
    JSON.stringify({
      schemaVersion: "msig.maf_conversion_validation_comparator_matrix.v0.1",
      build,
      profile: profileKey,
      status: payload?.status || "error",
      error: payload?.error || null,
      metadata: comparatorMetadata(payload),
      matrices: payload?.matrices?.[profileKey] || null,
    }, null, 2) + "\n",
    "utf8",
  );
  await fs.copyFile(logPath, durableLogPath);
  return {
    matrixPath,
    logPath: durableLogPath,
    matrixSha256: await sha256File(matrixPath),
  };
}

function comparatorMetadata(payload) {
  if (!payload) return null;
  return {
    comparator: payload.comparator,
    comparatorVersion: payload.comparatorVersion,
    comparatorPackageSha256: payload.comparatorPackageSha256,
    status: payload.status,
    error: payload.error,
    python: payload.python,
    pythonExecutable: payload.pythonExecutable,
    platform: payload.platform,
    command: payload.command,
    wrapperSha256: payload.wrapperSha256,
    genome: payload.genome,
    referenceVolume: payload.referenceVolume,
    referenceVerified: payload.referenceVerified,
    referenceExpectedMd5: payload.referenceExpectedMd5,
  };
}

async function runComparator({ build, profileKey, rows, profileDir, label }) {
  const mafDir = path.join(profileDir, `${label}-maf`);
  const comparatorOutput = path.join(profileDir, `${label}-comparator-output`);
  const comparatorResultPath = path.join(profileDir, `${label}-comparator-result.json`);
  const logPath = path.join(profileDir, `${label}-comparator.log`);
  await fs.mkdir(mafDir, { recursive: true });
  await fs.mkdir(comparatorOutput, { recursive: true });
  const comparatorRows = label === "adverse"
    ? rows.map((row) => ({ ...row, comparatorSample: row.caseId }))
    : rows;
  await writeMaf(comparatorRows, build, path.join(mafDir, `${label}.maf`));
  try {
    const commandResult = await runCommand(
      PYTHON_PATH,
      [
        COMPARATOR_SCRIPT,
        "--project", `msig-e9-${build}-${profileKey}-${label}`,
        "--genome", BUILD_TO_COMPARATOR[build],
        "--profile", profileKey,
        "--maf-dir", mafDir,
        "--output-dir", comparatorOutput,
        "--result", comparatorResultPath,
        "--volume", VOLUME_PATH,
      ],
      `SigProfilerMatrixGenerator ${build} ${profileKey} ${label}`,
      { SIGPROFILERMATRIXGENERATOR_VOLUME: VOLUME_PATH },
    );
    await fs.writeFile(logPath, `${commandResult.stdout}\n${commandResult.stderr}`, "utf8");
    const payload = JSON.parse(await fs.readFile(comparatorResultPath, "utf8"));
    const durable = await persistComparatorArtifacts({ build, profileKey, label, payload, logPath });
    return {
      status: payload.status || "completed",
      resultPath: comparatorResultPath,
      logPath,
      durable,
      payload,
      error: payload.error || null,
    };
  } catch (error) {
    await fs.writeFile(logPath, `${error.message}\n`, "utf8");
    const durable = await persistComparatorArtifacts({
      build,
      profileKey,
      label,
      payload: { status: "error", error: error.message, matrices: {} },
      logPath,
    });
    return { status: "error", error: error.message, logPath, durable };
  }
}

function auditReconciles(audit, inputRows) {
  return Boolean(
    audit &&
    audit.inputRows === inputRows &&
    audit.inputRows === audit.countedRows + audit.skippedRows,
  );
}

function auditSamplesReconcile(audit) {
  return Boolean(
    audit?.samples?.length > 0 &&
    audit.samples.reduce((sum, sample) => sum + sample.inputRows, 0) === audit.inputRows &&
    audit.samples.reduce((sum, sample) => sum + sample.countedRows, 0) === audit.countedRows &&
    audit.samples.every((sample) =>
      sample.inputRows === sample.countedRows + sample.skippedRows &&
      sample.countCheck === "pass"
    )
  );
}

function traceEventIds(trace) {
  return (trace?.eventIds || [trace?.eventId]).filter(Boolean);
}

function tracePartitionReconciles(trace, inputRows) {
  const seen = new Map();
  for (const entry of trace || []) {
    for (const eventId of traceEventIds(entry)) {
      const row = inputRows.find((candidate) => candidate.eventId === eventId);
      if (!row) return false;
      seen.set(eventId, (seen.get(eventId) || 0) + 1);
    }
  }
  return inputRows.every((row) => seen.get(row.eventId) === 1) && seen.size === inputRows.length;
}

function uniqueBins(traces) {
  return [...new Set(traces.flatMap((trace) => traceBins(trace)))].sort();
}

function validEventReconciliation({ build, profileKey, validRows, trace, comparison }) {
  const bySample = new Map(comparison.samples.map((sample) => [sample.sample, sample]));
  return trace.map((entry) => {
    const eventIds = traceEventIds(entry);
    const sourceRows = validRows.filter((row) => eventIds.includes(row.eventId));
    const comparator = bySample.get(entry.sample) || {
      comparatorTotal: 0,
      comparatorBins: [],
    };
    const sdkBin = traceBins(entry).join("|");
    const comparatorBin = comparator.comparatorBins.join("|");
    return {
      eventId: entry.eventId || eventIds.join("|"),
      sourceEventIds: eventIds.join("|"),
      build,
      profile: profileKey,
      caseId: sourceRows[0]?.caseId || "",
      sample: entry.sample,
      sourceRowIndices: sourceRows.map((row) => validRows.indexOf(row)).join("|"),
      mSigCounted: Boolean(entry.counted),
      mSigBin: sdkBin,
      mSigEventCount: entry.counted ? 1 : 0,
      comparatorCounted: comparator.comparatorTotal > 0,
      comparatorBin,
      comparatorEventCount: comparator.comparatorTotal,
      difference: Boolean(entry.counted) === (comparator.comparatorTotal > 0) && sdkBin === comparatorBin
        ? "none"
        : "counted_or_bin_difference",
    };
  });
}

async function runProfileBuild(build, profileKey, profile, contextLookup) {
  const validRows = buildCases(build, profile, "valid");
  const adverseRows = buildCases(build, profile, "ambiguous_or_malformed");
  const profileDir = path.join(TMP_DIR, build, profileKey);
  await fs.rm(profileDir, { recursive: true, force: true });
  await fs.mkdir(profileDir, { recursive: true });

  const sdkValid = await convertMafToProfileSpectra(validRows, {
    profiles: [profileKey],
    groupBy: "sample",
    genome: build,
    offline: true,
    contextLookupTable: contextLookup,
  });
  await writeProgress("comparator-started", { build, profile: profileKey, label: "valid" });
  const validComparator = await runComparator({ build, profileKey, rows: validRows, profileDir, label: "valid" });
  await writeProgress("comparator-finished", { build, profile: profileKey, label: "valid", status: validComparator.status });
  if (validComparator.status !== "completed") {
    throw new Error(`Valid comparator run failed for ${build} ${profileKey}: ${validComparator.error}`);
  }

  const samples = [...new Set(validRows.map((row) => row.sample))];
  const comparison = compareMatrix(
    profileKey,
    sdkValid.spectraByProfile[profileKey],
    validComparator.payload.matrices[profileKey],
    samples,
  );
  const validAudit = sdkValid.audit.profiles[profileKey];
  const validTrace = sdkValid.traceByProfile[profileKey] || [];
  const validEvents = validEventReconciliation({
    build,
    profileKey,
    validRows,
    trace: validTrace,
    comparison,
  });

  const sdkAdverse = await convertMafToProfileSpectra(adverseRows, {
    profiles: [profileKey],
    groupBy: "sample",
    genome: build,
    offline: true,
    contextLookupTable: contextLookup,
  });
  const adverseComparator = await runComparator({ build, profileKey, rows: adverseRows, profileDir, label: "adverse" });
  const adverseMatrix = adverseComparator.payload?.matrices?.[profileKey] || {};
  const adverseTrace = sdkAdverse.traceByProfile[profileKey] || [];
  const caseTrace = (caseId) => {
    const caseEventIds = new Set(adverseRows.filter((row) => row.caseId === caseId).map((row) => row.eventId));
    return adverseTrace.filter((entry) => traceEventIds(entry).some((eventId) => caseEventIds.has(eventId)));
  };
  const adverseAudits = adverseRows.map((row, index) => {
    const trace = adverseTrace.find((entry) =>
      (entry.eventIds || [entry.eventId]).includes(row.eventId)
    );
    const external = adverseComparator.payload?.matrices?.[profileKey]
      ? comparatorSample(adverseMatrix, row.caseId, PROFILE_CONTEXTS[profileKey])
      : { counted: null, bins: [], total: null };
    const caseTraces = caseTrace(row.caseId);
    const mSigCaseEventCount = caseTraces.filter((entry) => entry.counted).length;
    const mSigCaseBins = uniqueBins(caseTraces);
    const caseDifference = external.total === null
      ? "comparator_error"
      : mSigCaseEventCount === external.total && mSigCaseBins.join("|") === external.bins.join("|")
        ? "none"
        : "counted_or_bin_difference";
    const expectedSkip = row.expectedSdkSkipReasons?.[profileKey] || row.expectedSdkSkipReason;
    const expectedCounted = row.expectedSdkCounted;
    const sdkDecisionMatches = expectedSkip
      ? !trace?.counted && trace.skippedReason === expectedSkip
      : expectedCounted === null || expectedCounted === Boolean(trace?.counted);
    return {
      eventId: `${row.caseId}:${row.caseIndex}`,
      build,
      profile: profileKey,
      caseId: row.caseId,
      inputCategory: row.category,
      inputRowIndex: index,
      mSigCounted: Boolean(trace?.counted),
      mSigBin: traceBins(trace).join("|"),
      mSigSkipReason: trace?.skippedReason || "",
      mSigCaseEventCount,
      mSigCaseTotal: mSigCaseEventCount,
      mSigCaseBins: mSigCaseBins.join("|"),
      comparatorCounted: external.counted,
      comparatorBin: external.bins.join("|"),
      comparatorTotal: external.total,
      comparatorUnit: "case",
      comparatorStatus: adverseComparator.status,
      comparatorError: adverseComparator.error || "",
      difference: caseDifference,
      expectedSdkSkipReason: expectedSkip || "",
      expectedSdkCounted: expectedCounted === null ? "" : expectedCounted,
      sdkDecisionMatches,
    };
  });

  return {
    build,
    profile: profileKey,
    validInputRows: validRows.length,
    validAudit,
    validAuditReconciles: auditReconciles(validAudit, validRows.length),
    validSampleAuditsReconcile: auditSamplesReconcile(validAudit),
    validTracePartitionReconciles: tracePartitionReconciles(validTrace, validRows),
    validEvents,
    comparison,
    validComparator: {
      status: validComparator.status,
      resultPath: validComparator.resultPath,
      logPath: validComparator.logPath,
      durable: validComparator.durable,
      metadata: comparatorMetadata(validComparator.payload),
    },
    adverseComparator: {
      status: adverseComparator.status,
      logPath: adverseComparator.logPath,
      error: adverseComparator.error || null,
      durable: adverseComparator.durable,
    },
    adverseRows: adverseAudits,
    adverseAudit: sdkAdverse.audit.profiles[profileKey],
    adverseAuditReconciles: auditReconciles(sdkAdverse.audit.profiles[profileKey], adverseRows.length),
    adverseSampleAuditsReconcile: auditSamplesReconcile(sdkAdverse.audit.profiles[profileKey]),
    adverseTracePartitionReconciles: tracePartitionReconciles(adverseTrace, adverseRows),
    contextReferenceChecks: contextLookup.referenceChecks,
    fixtureSha256: sha256(JSON.stringify(validRows)),
  };
}

function buildReconciliationCsv(rows) {
  const headers = [
    "eventId", "build", "profile", "caseId", "inputCategory", "inputRowIndex",
    "mSigCounted", "mSigBin", "mSigSkipReason", "mSigCaseEventCount", "mSigCaseTotal", "mSigCaseBins",
    "comparatorCounted", "comparatorBin", "comparatorTotal", "comparatorUnit", "comparatorStatus", "comparatorError", "difference",
    "expectedSdkSkipReason", "expectedSdkCounted", "sdkDecisionMatches",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")).join("\n")}\n`;
}

function buildValidEventCsv(rows) {
  const headers = [
    "eventId", "sourceEventIds", "build", "profile", "caseId", "sample", "sourceRowIndices",
    "mSigCounted", "mSigBin", "mSigEventCount", "comparatorCounted", "comparatorBin",
    "comparatorEventCount", "difference",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")).join("\n")}\n`;
}

async function main() {
  await writeProgress("reference-check-started", { pythonPath: PYTHON_PATH, volumePath: VOLUME_PATH });
  for (const build of fixture.genomeBuilds) await checkReference(build);
  await writeProgress("reference-check-finished");

  const results = [];
  for (const build of fixture.genomeBuilds) {
    const validSbsRows = buildCases(build, "SBS", "valid");
    const contextResult = await makeContextLookup(build, validSbsRows);
    const contextLookup = { lookup: contextResult.lookup, referenceChecks: contextResult.referenceChecks };
    await writeProgress("context-lookup-finished", { build, referenceChecks: contextResult.referenceChecks.length });
    for (const [profile, profileKey] of PROFILE_SPECS) {
      results.push(await runProfileBuild(build, profileKey, profile, contextLookup));
    }
  }

  const matrixResults = results.map((result) => ({
    build: result.build,
    profile: result.profile,
    exact: result.comparison.exact,
    eventBinAgreement: result.comparison.eventBinAgreement,
    validInputRows: result.validInputRows,
    sdkCountedRows: result.validAudit.countedRows,
    sdkCountedEvents: result.validAudit.countedEvents,
    comparatorTotal: result.comparison.samples.reduce((sum, sample) => sum + sample.comparatorTotal, 0),
    sdkTotal: result.comparison.samples.reduce((sum, sample) => sum + sample.sdkTotal, 0),
    validAuditReconciles: result.validAuditReconciles,
    validSampleAuditsReconcile: result.validSampleAuditsReconcile,
    validTracePartitionReconciles: result.validTracePartitionReconciles,
    validEventReconciles: result.validEvents.every((row) => row.difference === "none"),
  }));
  const reconciliationRows = results.flatMap((result) => result.adverseRows);
  const validEventRows = results.flatMap((result) => result.validEvents);
  await fs.writeFile(RECONCILIATION_PATH, buildReconciliationCsv(reconciliationRows), "utf8");
  await fs.writeFile(VALID_EVENTS_PATH, buildValidEventCsv(validEventRows), "utf8");

  const referenceChecks = results.flatMap((result) => result.contextReferenceChecks);
  const validExactConcordancePass = matrixResults.every((row) =>
    row.exact && row.eventBinAgreement && row.validAuditReconciles &&
    row.validSampleAuditsReconcile && row.validTracePartitionReconciles &&
    row.validEventReconciles
  );
  const adverseReconciliationComplete =
    referenceChecks.length > 0 &&
    results.flatMap((result) => result.adverseRows).every((row) => row.sdkDecisionMatches) &&
    results.every((result) =>
      result.adverseAuditReconciles &&
      result.adverseSampleAuditsReconcile &&
      result.adverseTracePartitionReconciles
    );
  const adverseDifferenceRows = reconciliationRows.filter((row) => row.difference !== "none");
  const adverseDifferenceCases = [...new Set(adverseDifferenceRows.map((row) =>
    `${row.build}:${row.profile}:${row.caseId}`
  ))];
  const artifactHashes = {
    fixture: sha256(await fs.readFile(FIXTURE_PATH)),
    runner: await sha256File(HERE + "/run-maf-conversion-validation.mjs"),
    comparatorWrapper: await sha256File(COMPARATOR_SCRIPT),
    mutationalSpectrum: await sha256File(path.resolve(ROOT, "mSigSDKScripts/mutationalSpectrum.js")),
  };
  const output = {
    schemaVersion: "msig.maf_conversion_validation_results.v0.3",
    status: "completed",
    runStartedAt,
    completedAt: new Date().toISOString(),
    fixturePath: FIXTURE_PATH,
    fixtureSha256: sha256(await fs.readFile(FIXTURE_PATH, "utf8")),
    comparator: fixture.externalComparator,
    comparatorRuns: results.map((result) => ({
      build: result.build,
      profile: result.profile,
      ...result.validComparator.metadata,
      durableArtifacts: result.validComparator.durable,
    })),
    comparatorPython: PYTHON_PATH,
    referenceVolume: VOLUME_PATH,
    profiles: PROFILE_KEYS,
    builds: fixture.genomeBuilds,
    referenceChecks,
    artifactHashes,
    matrixResults,
    validEventReconciliationPath: VALID_EVENTS_PATH,
    validEventReconciliationRows: validEventRows.length,
    results,
    reconciliationPath: RECONCILIATION_PATH,
    reconciliationRows: reconciliationRows.length,
    comparatorProcessErrors: results.filter((result) => result.adverseComparator.status === "error").length,
    comparatorGuardErrors: results.filter((result) => result.adverseComparator.status === "completed_with_skips").length,
    comparatorRowsWithGuardErrors: reconciliationRows.filter((row) => row.comparatorStatus === "completed_with_skips").length,
    adverseDifferenceRows: adverseDifferenceRows.length,
    adverseDifferenceCases: adverseDifferenceCases.length,
    validExactConcordancePass,
    adverseReconciliationComplete,
    adverseExactConcordancePass: adverseDifferenceRows.length === 0,
    referenceContextChecksPass: referenceChecks.every((row) =>
      row.matchesExpectedContext && row.matchesReference &&
      row.matchesComparatorContext && row.matchesComparatorReference
    ),
    pass: validExactConcordancePass && adverseReconciliationComplete &&
      referenceChecks.every((row) =>
        row.matchesExpectedContext && row.matchesReference &&
        row.matchesComparatorContext && row.matchesComparatorReference
      ),
  };
  await fs.writeFile(RESULTS_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  await writeProgress("result-written", { status: output.pass ? "passed" : "failed", pass: output.pass });
  assert.equal(output.pass, true, "MAF conversion validation did not meet exact-concordance and audit expectations.");
  console.log(JSON.stringify({ status: output.status, pass: output.pass, matrixResults, reconciliationRows: reconciliationRows.length }, null, 2));
}

try {
  await main();
} catch (error) {
  await writeProgress("failed", { status: "failed", error: error.message });
  throw error;
}
