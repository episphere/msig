import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { convertMafToProfileSpectra } from "../../../../../mSigSDKScripts/mutationalSpectrum.js";
import { getExpectedContexts } from "../../../../../mSigSDKScripts/profileRegistry.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const EXPERIMENT_ROOT = path.resolve(HERE, "..");
const DATA_DIR = path.join(EXPERIMENT_ROOT, "data", "supported-coverage");
const TMP_DIR = path.join(ROOT, ".tmp", "maf-conversion-supported-coverage");
const RESULT_PATH = path.join(DATA_DIR, "supported-coverage-validation-results.json");
const PYTHON_PATH = process.env.MSIG_E9_PYTHON || path.join(ROOT, ".tools", "e2-python", "Scripts", "python.exe");
const VOLUME_PATH = process.env.MSIG_E9_SPM_VOLUME || path.join(ROOT, ".tools", "spm-references");
const COMPARATOR_SCRIPT = path.join(HERE, "run_sigprofiler_matrix_generator.py");
const REAL_MAF_PATH = path.join(ROOT, "examples", "maf", "example.input.maf");
const BUILDS = {
  hg19: "GRCh37",
  hg38: "GRCh38",
};
const TSB_BASES = [
  "A", "C", "G", "T", "A", "C", "G", "T", "A", "C",
  "G", "T", "A", "C", "G", "T", "N", "N", "N", "N",
];

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(TMP_DIR, { recursive: true });

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath) {
  return sha256(await fs.readFile(filePath));
}

function baseAt(reference, index) {
  return TSB_BASES[reference[index]] || "N";
}

function sequenceAt(reference, startIndex, length) {
  let sequence = "";
  for (let index = startIndex; index < startIndex + length; index += 1) {
    sequence += baseAt(reference, index);
  }
  return sequence;
}

async function readReference(build, chromosome = "1") {
  return fs.readFile(path.join(VOLUME_PATH, "tsb", BUILDS[build], `${chromosome}.txt`));
}

function findSbsRows(reference, build) {
  const positionsByContext = new Map();
  const targetContextCount = 512;
  for (let index = 2; index < reference.length - 2; index += 1) {
    const center = baseAt(reference, index);
    if (center !== "C" && center !== "T") continue;
    const context = sequenceAt(reference, index - 2, 5);
    if (context.includes("N")) continue;
    const positions = positionsByContext.get(context) || [];
    if (positions.length < 3) positions.push(index + 1);
    positionsByContext.set(context, positions);
    if (positionsByContext.size === targetContextCount && [...positionsByContext.values()].every((values) => values.length === 3)) break;
  }
  if (positionsByContext.size !== targetContextCount || [...positionsByContext.values()].some((values) => values.length < 3)) {
    throw new Error(`${build}: did not find three genomic occurrences for every canonical SBS1536 context`);
  }
  const rows = [];
  for (const context of [...positionsByContext.keys()].sort()) {
    const ref = context[2];
    const alternateAlleles = ["A", "C", "G", "T"].filter((base) => base !== ref);
    alternateAlleles.forEach((alt, altIndex) => {
      rows.push({
        event_id: `${build}-sbs-${rows.length + 1}`,
        sample: "synthetic_sbs_exhaustive",
        chromosome: "1",
        start_position: positionsByContext.get(context)[altIndex],
        end_position: positionsByContext.get(context)[altIndex],
        reference_allele: ref,
        tumor_seq_allele2: alt,
        variant_type: "SNP",
        pentanucleotide_context: context,
      });
    });
  }
  return rows;
}

function findDbsRows(reference, build) {
  const contexts = getExpectedContexts({ profile: "DBS", matrix: 78 });
  const usedPositions = new Set();
  return contexts.map((context, rowIndex) => {
    const [ref, alt] = context.split(">");
    let position = -1;
    for (let index = 1000 + rowIndex * 10; index < reference.length - 1; index += 1) {
      if (usedPositions.has(index) || usedPositions.has(index + 1)) continue;
      if (baseAt(reference, index) === ref[0] && baseAt(reference, index + 1) === ref[1]) {
        position = index + 1;
        usedPositions.add(index);
        usedPositions.add(index + 1);
        break;
      }
    }
    if (position < 0) throw new Error(`${build}: no genomic locus found for ${context}`);
    return {
      event_id: `${build}-dbs-${rowIndex + 1}`,
      sample: `synthetic_dbs_${rowIndex + 1}`,
      chromosome: "1",
      start_position: position,
      end_position: position,
      reference_allele: ref,
      tumor_seq_allele2: alt,
      variant_type: "DNP",
    };
  });
}

function deterministicInsertedSequence(length, seed) {
  const bases = ["A", "C", "G", "T"];
  let sequence = "";
  for (let index = 0; index < length; index += 1) sequence += bases[(seed * 7 + index * 3) % bases.length];
  return sequence;
}

function findIdCandidateRows(reference, build) {
  const rows = [];
  const add = ({ position, kind, sequence, source }) => {
    const anchor = baseAt(reference, position - 1);
    if (!/^[ACGT]$/.test(anchor) || !/^[ACGT]+$/.test(sequence)) return;
    const rowIndex = rows.length + 1;
    const deletion = kind === "Del";
    rows.push({
      event_id: `${build}-id-candidate-${rowIndex}`,
      sample: `synthetic_id_candidate_${rowIndex}`,
      chromosome: "1",
      start_position: position,
      end_position: deletion ? position + sequence.length : position,
      reference_allele: deletion ? `${anchor}${sequence}` : anchor,
      tumor_seq_allele2: deletion ? anchor : `${anchor}${sequence}`,
      variant_type: deletion ? "DEL" : "INS",
      candidate_source: source,
    });
  };

  // Broad, deterministic genomic sampling for repeat and microhomology diversity.
  for (let sampleIndex = 0; sampleIndex < 180; sampleIndex += 1) {
    const position = 1_000_000 + sampleIndex * 10_007;
    for (let length = 1; length <= 10; length += 1) {
      const forward = sequenceAt(reference, position, length);
      const reverse = sequenceAt(reference, position - 1 - length, length);
      if (!forward.includes("N")) {
        add({ position, kind: "Del", sequence: forward, source: "sampled_reference_deletion" });
        add({ position, kind: "Ins", sequence: forward, source: "sampled_forward_insertion" });
      }
      if (!reverse.includes("N")) add({ position, kind: "Ins", sequence: reverse, source: "sampled_reverse_insertion" });
      add({ position, kind: "Ins", sequence: deterministicInsertedSequence(length, sampleIndex + length), source: "sampled_synthetic_insertion" });
    }
  }

  // Enrich tandem-repeat cases, which are uncommon under uniform sampling.
  const repeatTargets = new Set();
  for (let index = 100_000; index < Math.min(reference.length - 80, 30_000_000); index += 1) {
    for (let length = 1; length <= 5; length += 1) {
      const motif = sequenceAt(reference, index, length);
      if (motif.includes("N")) continue;
      let copies = 0;
      while (copies < 7 && sequenceAt(reference, index + copies * length, length) === motif) copies += 1;
      const boundedBefore = index - length < 0 || sequenceAt(reference, index - length, length) !== motif;
      const boundedAfter = sequenceAt(reference, index + copies * length, length) !== motif;
      if (!boundedBefore || !boundedAfter) continue;
      const clipped = Math.min(5, copies);
      const insertionKey = `Ins:${length}:${clipped}`;
      if (!repeatTargets.has(insertionKey)) {
        add({ position: index, kind: "Ins", sequence: motif, source: `targeted_repeat_${insertionKey}` });
        repeatTargets.add(insertionKey);
      }
      const deletionRepeat = Math.min(5, Math.max(0, copies - 1));
      const deletionKey = `Del:${length}:${deletionRepeat}`;
      if (!repeatTargets.has(deletionKey)) {
        add({ position: index, kind: "Del", sequence: motif, source: `targeted_repeat_${deletionKey}` });
        repeatTargets.add(deletionKey);
      }
    }
    if (repeatTargets.size >= 60) break;
  }
  return rows;
}

function annotatedIdRowsFromComparator(candidates, comparatorMatrix, contexts) {
  const candidateBySample = new Map(candidates.map((row) => [row.sample, row]));
  const selectedByBin = new Map();
  for (const [sample, values] of Object.entries(comparatorMatrix || {})) {
    const bins = contexts.filter((context) => Number(values?.[context] || 0) > 0);
    if (bins.length !== 1 || Number(values[bins[0]]) !== 1 || selectedByBin.has(bins[0])) continue;
    const candidate = candidateBySample.get(sample);
    if (!candidate) continue;
    const [length, kind, subtype, index] = bins[0].split(":");
    selectedByBin.set(bins[0], {
      ...candidate,
      ...(subtype === "M" ? { microhomology_length: Number(index) } : { repeat_index: Number(index) }),
      expected_id83_bin: bins[0],
      expected_length_bin: Number(length),
      expected_kind: kind,
    });
  }
  return {
    rows: [...selectedByBin.values()],
    coveredBins: [...selectedByBin.keys()].sort(),
    missingBins: contexts.filter((context) => !selectedByBin.has(context)),
  };
}

function subsetMatrix(matrix, samples) {
  return Object.fromEntries(samples.map((sample) => [sample, matrix?.[sample] || {}]));
}

function annotatedIdContractRows(build, contexts) {
  return contexts.map((context, index) => {
    const [lengthText, kind, subtype, categoryText] = context.split(":");
    const length = Number(lengthText);
    const category = Number(categoryText);
    const sequence = length === 1
      ? (subtype === "C" ? "C" : "T")
      : "ACGTA".slice(0, Math.min(length, 5));
    const anchor = "G";
    return {
      event_id: `${build}-id-contract-${index + 1}`,
      sample: `id_contract_${index + 1}`,
      chromosome: "1",
      start_position: 10_000 + index * 20,
      end_position: 10_000 + index * 20 + (kind === "Del" ? sequence.length : 0),
      reference_allele: kind === "Del" ? `${anchor}${sequence}` : anchor,
      tumor_seq_allele2: kind === "Del" ? anchor : `${anchor}${sequence}`,
      variant_type: kind === "Del" ? "DEL" : "INS",
      ...(subtype === "M" ? { microhomology_length: category } : { repeat_index: category }),
      expected_id83_bin: context,
    };
  });
}

function oneHotMatrix(rows, contexts) {
  return Object.fromEntries(rows.map((row) => [
    row.sample,
    Object.fromEntries(contexts.map((context) => [context, context === row.expected_id83_bin ? 1 : 0])),
  ]));
}

function externalMaf(rows, build) {
  const header = [
    "Hugo_Symbol", "Entrez_Gene_Id", "Center", "NCBI_Build", "Chromosome",
    "Start_position", "End_position", "Strand", "Variant_Classification",
    "Variant_Type", "Reference_Allele", "Tumor_Seq_Allele1", "Tumor_Seq_Allele2",
    "dbSNP_RS", "dbSNP_Val_Status", "Tumor_Sample_Barcode", "Matched_Norm_Sample_Barcode",
  ].join("\t");
  const body = rows.map((row) => [
    row.event_id, "0", "mSigSDK-E9", BUILDS[build], `chr${row.chromosome}`,
    row.start_position, row.end_position, "+", "Unknown", row.variant_type,
    row.reference_allele, row.reference_allele, row.tumor_seq_allele2,
    "", "", row.sample, "normal",
  ].join("\t"));
  return `${header}\n${body.join("\n")}\n`;
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      windowsHide: true,
      env: { ...process.env, SIGPROFILERMATRIXGENERATOR_VOLUME: VOLUME_PATH },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Comparator exited with ${code}: ${stderr || stdout}`));
    });
  });
}

async function runComparator({ id, build, profile, mafText = null, mafSource = null, requestedOnly = false }) {
  const runDir = path.join(TMP_DIR, id);
  const mafDir = path.join(runDir, "maf");
  const outputDir = path.join(runDir, "output");
  const resultPath = path.join(runDir, "result.json");
  await fs.rm(runDir, { recursive: true, force: true });
  await fs.mkdir(mafDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  if (mafSource) await fs.copyFile(mafSource, path.join(mafDir, path.basename(mafSource)));
  else await fs.writeFile(path.join(mafDir, `${id}.maf`), mafText, "utf8");
  const args = [
    COMPARATOR_SCRIPT,
    "--project", id,
    "--genome", BUILDS[build],
    "--profile", profile,
    "--maf-dir", mafDir,
    "--output-dir", outputDir,
    "--result", resultPath,
    "--volume", VOLUME_PATH,
  ];
  if (requestedOnly) args.push("--requested-only");
  await runCommand(PYTHON_PATH, args);
  return JSON.parse(await fs.readFile(resultPath, "utf8"));
}

function normalizeMatrix(matrix, samples, contexts) {
  return Object.fromEntries(samples.map((sample) => [
    sample,
    Object.fromEntries(contexts.map((context) => [context, Number(matrix?.[sample]?.[context] || 0)])),
  ]));
}

function compareMatrices(sdkMatrix, comparatorMatrix, contexts) {
  const samples = [...new Set([...Object.keys(sdkMatrix || {}), ...Object.keys(comparatorMatrix || {})])].sort();
  const sdk = normalizeMatrix(sdkMatrix, samples, contexts);
  const comparator = normalizeMatrix(comparatorMatrix, samples, contexts);
  const mismatches = [];
  let sdkTotal = 0;
  let comparatorTotal = 0;
  for (const sample of samples) {
    for (const context of contexts) {
      sdkTotal += sdk[sample][context];
      comparatorTotal += comparator[sample][context];
      if (sdk[sample][context] !== comparator[sample][context]) {
        mismatches.push({ sample, context, sdk: sdk[sample][context], comparator: comparator[sample][context] });
      }
    }
  }
  return {
    samples: samples.length,
    contextCount: contexts.length,
    sdkTotal,
    comparatorTotal,
    mismatchCells: mismatches.length,
    exact: mismatches.length === 0,
    mismatches: mismatches.slice(0, 200),
  };
}

function parseTsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split("\t")[index] || ""])));
}

async function contextLookupForRows(build, rows) {
  const lookup = {};
  const references = new Map();
  for (const row of rows) {
    const chromosome = String(row.Chromosome || row.chromosome || "").replace(/^chr/i, "");
    if (!/^(?:[1-9]|1[0-9]|2[0-2]|X|Y)$/i.test(chromosome)) continue;
    const position = Number(row.Start_position || row.Start_Position || row.start_position);
    if (!references.has(chromosome)) references.set(chromosome, await readReference(build, chromosome.toUpperCase()));
    const reference = references.get(chromosome);
    if (!Number.isInteger(position) || position < 3 || position + 2 > reference.length) continue;
    lookup[`${chromosome.toUpperCase()}:${position}`] = { sequence: sequenceAt(reference, position - 3, 5), source: "local SigProfiler reference" };
  }
  return lookup;
}

const results = {
  schemaVersion: "msig.maf_supported_coverage_validation.v0.1",
  startedAt: new Date().toISOString(),
  comparator: "SigProfilerMatrixGenerator 1.3.6",
  comparatorWrapperSha256: await sha256File(COMPARATOR_SCRIPT),
  sdkConverterSha256: await sha256File(path.join(ROOT, "mSigSDKScripts", "mutationalSpectrum.js")),
  runs: [],
};

if (process.argv.includes("--augment-existing")) {
  const existing = JSON.parse(await fs.readFile(RESULT_PATH, "utf8"));
  existing.runs = existing.runs.filter((run) => run.dataset !== "exhaustive_annotated_id_contract");
  for (const build of Object.keys(BUILDS)) {
    const contexts = getExpectedContexts({ profile: "ID", matrix: 83 });
    const rows = annotatedIdContractRows(build, contexts);
    const sdk = await convertMafToProfileSpectra(rows, {
      profiles: ["ID83"], groupBy: "sample", genome: build, offline: true,
    });
    existing.runs.push({
      dataset: "exhaustive_annotated_id_contract",
      build,
      profile: "ID83",
      inputRows: rows.length,
      populatedExpectedBins: new Set(sdk.traceByProfile.ID83.filter((row) => row.counted).map((row) => row.finalBin)).size,
      scope: "Exhaustive test of mSigSDK's documented annotated-ID mapping contract; not an independent test of repeat or microhomology inference.",
      ...compareMatrices(sdk.spectraByProfile.ID83, oneHotMatrix(rows, contexts), contexts),
    });
  }
  existing.completedAt = new Date().toISOString();
  existing.assessment = {
    exactExternalMatrixRuns: existing.runs.filter((run) => run.dataset !== "exhaustive_annotated_id_contract" && run.exact).length,
    nonexactExternalMatrixRuns: existing.runs.filter((run) => run.dataset !== "exhaustive_annotated_id_contract" && !run.exact).length,
    exhaustiveAnnotatedIdContract: existing.runs.filter((run) => run.dataset === "exhaustive_annotated_id_contract").every((run) => run.exact && run.populatedExpectedBins === 83),
    note: "DBS TA>AT is retained as unresolved because SigProfilerMatrixGenerator 1.3.6 rejected the explicit MAF event in both builds; independent DBS concordance is therefore 77 of 77 comparator-accepted categories, not 78 of 78.",
  };
  existing.pass = false;
  await fs.writeFile(RESULT_PATH, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ resultPath: RESULT_PATH, assessment: existing.assessment }, null, 2));
  process.exit(0);
}

for (const build of Object.keys(BUILDS)) {
  const reference = await readReference(build);
  const sbsRows = findSbsRows(reference, build);
  const sbsSdk = await convertMafToProfileSpectra(sbsRows, {
    profiles: ["SBS96", "SBS1536"],
    groupBy: "sample",
    genome: build,
    offline: true,
  });
  const sbsComparator = await runComparator({
    id: `msig-e9-coverage-${build}-sbs`, build, profile: "SBS1536", mafText: externalMaf(sbsRows, build),
  });
  for (const profile of ["SBS96", "SBS1536"]) {
    const contexts = getExpectedContexts({ profile: "SBS", matrix: profile === "SBS96" ? 96 : 1536 });
    results.runs.push({
      dataset: "exhaustive_synthetic_contexts",
      build,
      profile,
      inputRows: sbsRows.length,
      populatedExpectedBins: new Set(sbsSdk.traceByProfile[profile].filter((row) => row.counted).map((row) => row.finalBin)).size,
      ...compareMatrices(sbsSdk.spectraByProfile[profile], sbsComparator.matrices[profile], contexts),
    });
  }

  const dbsRows = findDbsRows(reference, build);
  const dbsSdk = await convertMafToProfileSpectra(dbsRows, {
    profiles: ["DBS78"], groupBy: "sample", genome: build, offline: true,
  });
  const dbsComparator = await runComparator({
    id: `msig-e9-coverage-${build}-dbs`, build, profile: "DBS78", mafText: externalMaf(dbsRows, build), requestedOnly: true,
  });
  const dbsContexts = getExpectedContexts({ profile: "DBS", matrix: 78 });
  results.runs.push({
    dataset: "exhaustive_synthetic_contexts",
    build,
    profile: "DBS78",
    inputRows: dbsRows.length,
    populatedExpectedBins: new Set(dbsSdk.traceByProfile.DBS78.filter((row) => row.counted).map((row) => row.finalBin)).size,
    ...compareMatrices(dbsSdk.spectraByProfile.DBS78, dbsComparator.matrices.DBS78, dbsContexts),
  });

  const idContexts = getExpectedContexts({ profile: "ID", matrix: 83 });
  const idCandidates = findIdCandidateRows(reference, build);
  const idComparator = await runComparator({
    id: `msig-e9-coverage-${build}-id-candidates`, build, profile: "ID83", mafText: externalMaf(idCandidates, build), requestedOnly: true,
  });
  const selectedId = annotatedIdRowsFromComparator(idCandidates, idComparator.matrices.ID83, idContexts);
  const idSdk = await convertMafToProfileSpectra(selectedId.rows, {
    profiles: ["ID83"], groupBy: "sample", genome: build, offline: true,
  });
  results.runs.push({
    dataset: "reference_classified_supported_id_events",
    build,
    profile: "ID83",
    candidateRows: idCandidates.length,
    inputRows: selectedId.rows.length,
    populatedExpectedBins: selectedId.coveredBins.length,
    missingBins: selectedId.missingBins,
    annotationContract: "SigProfiler classified each conventional indel from alleles and reference sequence; its repeat or microhomology category was then supplied through mSigSDK's documented annotated-ID input fields.",
    ...compareMatrices(
      idSdk.spectraByProfile.ID83,
      subsetMatrix(idComparator.matrices.ID83, selectedId.rows.map((row) => row.sample)),
      idContexts,
    ),
  });

  if (build === "hg19") {
    const realRows = parseTsv(await fs.readFile(REAL_MAF_PATH, "utf8"));
    const lookup = await contextLookupForRows(build, realRows);
    const realSdk = await convertMafToProfileSpectra(realRows, {
      profiles: ["SBS96", "SBS1536"],
      groupBy: "Tumor_Sample_Barcode",
      genome: build,
      offline: true,
      contextLookupTable: lookup,
    });
    const realComparator = await runComparator({
      id: "msig-e9-coverage-hg19-real-maf", build, profile: "SBS1536", mafSource: REAL_MAF_PATH,
    });
    for (const profile of ["SBS96", "SBS1536"]) {
      const contexts = getExpectedContexts({ profile: "SBS", matrix: profile === "SBS96" ? 96 : 1536 });
      results.runs.push({
        dataset: "repository_cohort_maf",
        source: path.relative(ROOT, REAL_MAF_PATH).replaceAll("\\", "/"),
        sourceSha256: await sha256File(REAL_MAF_PATH),
        build,
        profile,
        inputRows: realRows.length,
        populatedExpectedBins: new Set(realSdk.traceByProfile[profile].filter((row) => row.counted).map((row) => row.finalBin)).size,
        sdkSkippedRows: realSdk.audit.profiles[profile].skippedRows,
        ...compareMatrices(realSdk.spectraByProfile[profile], realComparator.matrices[profile], contexts),
      });
    }
  }
}

results.completedAt = new Date().toISOString();
results.pass = false;
results.totalInputEvaluations = results.runs.reduce((sum, run) => sum + run.inputRows, 0);
await fs.writeFile(RESULT_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ resultPath: RESULT_PATH, pass: results.pass, runs: results.runs }, null, 2));
