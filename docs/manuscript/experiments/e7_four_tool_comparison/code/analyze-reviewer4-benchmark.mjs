import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAdapterComparisonContract,
  materializeAdapterComparisonExposure,
} from "../../../../../mSigSDKScripts/adapters.js";
import { runCommand } from "../../../../../scripts/manuscript/lib/experiment-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const experimentDir = path.join(root, "docs", "manuscript", "experiments", "e7_four_tool_comparison");
const dataDir = path.join(experimentDir, "data");
const outputDir = path.join(experimentDir, "reviewer4_benchmark");
const figureDir = path.join(experimentDir, "figures");
const tools = ["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"];
const labels = {
  deconstructsigs: "deconstructSigs",
  sigminer: "sigminer",
  sigprofilerassignment: "SigProfilerAssignment",
  musical: "MuSiCal",
};
const shortLabels = {
  deconstructsigs: "dSigs",
  sigminer: "sigminer",
  sigprofilerassignment: "SPA",
  musical: "MuSiCal",
};
const noises = [0, 5, 10];
const cutoff = 0.01;
const archiveSha256 = "c629de203bcf7a517b0308ea695da90572d92e7b8f271dc3f72fe29eeed731aa";

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const sum = (values) => values.reduce((a, b) => a + b, 0);
const mean = (values) => values.length ? sum(values) / values.length : null;
const dot = (a, b) => sum(a.map((v, i) => v * b[i]));
const norm = (v) => Math.sqrt(dot(v, v));
const cosine = (a, b) => {
  const d = norm(a) * norm(b);
  return d ? dot(a, b) / d : null;
};
const rmse = (a, b) => Math.sqrt(mean(a.map((v, i) => (v - b[i]) ** 2)) || 0);
const mae = (a, b) => mean(a.map((v, i) => Math.abs(v - b[i])));
const pearson = (a, b) => {
  const ma = mean(a);
  const mb = mean(b);
  const ca = a.map((v) => v - ma);
  const cb = b.map((v) => v - mb);
  const d = norm(ca) * norm(cb);
  return d ? dot(ca, cb) / d : null;
};
const normalize = (values) => {
  const total = sum(values);
  return total ? values.map((v) => v / total) : values.map(() => 0);
};
const round = (value, digits = 6) => value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
const csvCell = (value) => {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const writeCsv = async (file, rows) => {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  await writeFile(file, `${[columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n")}\n`);
};
const sha256File = async (relativePath) => {
  try {
    const bytes = await readFile(path.join(root, relativePath));
    return createHash("sha256").update(bytes).digest("hex");
  } catch (_error) {
    return null;
  }
};
const nonNegativeFinite = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};
const vector = (map, names) => names.map((name) => nonNegativeFinite(map?.[name]));
const fractionOutput = (map, names) =>
  materializeAdapterComparisonExposure(map, names).relativeFractions;
const thresholdOutput = (values) => normalize(values.map((value) => value >= cutoff ? value : 0));
const fidelityResult = await readJson(path.join(root, "docs", "manuscript", "experiments", "e2_adapter_fidelity", "data", "adapter-fidelity-results.json"));
const fidelityInput = await readJson(path.join(root, "docs", "manuscript", "experiments", "e2_adapter_fidelity", "data", "adapter-fidelity-input.json"));
const fidelityPairs = await readJson(path.join(root, "docs", "manuscript", "experiments", "e2_adapter_fidelity", "data", "adapter-fidelity-exposure-pairs.json"));
const comparisonContract = createAdapterComparisonContract({
  contexts: fidelityInput.contexts,
  signatureNames: fidelityInput.signatureNames,
  cutoff,
  randomSeed: 104729,
});
const syntheticReferenceInput = await readJson(path.join(dataDir, "published-sbs-input.json"));
const syntheticComparisonContract = createAdapterComparisonContract({
  contexts: syntheticReferenceInput.contexts,
  signatureNames: syntheticReferenceInput.signatureNames,
  cutoff,
  randomSeed: 104729,
});
const outputDisposition = tools.map((tool) => {
  const exceptions = [];
  let samplesWithOmittedCatalogColumns = 0;
  let samplesWithExtraOutputColumns = 0;
  for (const sample of fidelityInput.sampleNames) {
    const outputNames = [
      ...new Set(
        fidelityPairs.rows
          .filter((row) => row.tool === tool && row.sample === sample)
          .map((row) => row.signature)
      ),
    ];
    const omittedCatalogColumns = fidelityInput.signatureNames.filter((signature) => !outputNames.includes(signature));
    const extraOutputColumns = outputNames.filter((name) => !fidelityInput.signatureNames.includes(name));
    samplesWithOmittedCatalogColumns += omittedCatalogColumns.length ? 1 : 0;
    samplesWithExtraOutputColumns += extraOutputColumns.length ? 1 : 0;
    if (omittedCatalogColumns.length || extraOutputColumns.length) {
      exceptions.push({ sample, omittedCatalogColumns, extraOutputColumns });
    }
  }
  return {
    tool,
    realWorld: {
      sampleCount: fidelityInput.sampleNames.length,
      catalogColumnCount: fidelityInput.signatureNames.length,
      samplesWithOmittedCatalogColumns,
      samplesWithExtraOutputColumns,
      exceptions,
    },
    synthetic: [],
    unassigned: {
      status: "not_returned_as_a_separate_component",
      representation: "No package-native unassigned/explained amount was present in the exposure matrix artifact; it is not relabeled as a catalog signature and is excluded from catalog-vector metrics.",
      amount: null,
    },
  };
});
const reproducibilityArtifactPaths = [
  "package.json",
  "package-lock.json",
  "mSigSDKScripts/adapters.js",
  "mSigSDKScripts/reports.js",
  "schemas/msig.report.v0.3/report.schema.json",
  "docs/package-repos/pyodide/manifest.json",
  "docs/package-repos/webr/manifest.json",
  "docs/manuscript/experiments/e2_adapter_fidelity/code/run-adapter-fidelity.mjs",
  "docs/manuscript/experiments/e2_adapter_fidelity/data/adapter-fidelity-input.json",
  "docs/manuscript/experiments/e2_adapter_fidelity/data/adapter-fidelity-results.json",
  "docs/manuscript/experiments/e7_four_tool_comparison/code/run-four-tool-comparison.mjs",
  "docs/manuscript/experiments/e7_four_tool_comparison/code/analyze-reviewer4-benchmark.mjs",
  "docs/manuscript/experiments/e7_four_tool_comparison/code/analyze-published-synthetic-benchmark.mjs",
  "docs/manuscript/experiments/e7_four_tool_comparison/data/published_source/Supplementary_data_Diaz-Gay_et_al_2023_Benchmark.zip",
];
const reproducibilityArtifacts = Object.fromEntries(
  await Promise.all(
    reproducibilityArtifactPaths.map(async (relativePath) => [
      relativePath,
      { path: relativePath, sha256: await sha256File(relativePath) },
    ])
  )
);
const gitRevision = await runCommand("git", ["rev-parse", "HEAD"], { cwd: root });
const gitStatus = await runCommand("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: root });
const workingTreeDirty = Boolean(gitStatus.stdout?.trim());
const reproducibilityManifest = {
  schemaVersion: "msig.reproducibility.manifest.v0.1",
  generatedAt: new Date().toISOString(),
  claim: "portable_schema_validated_analysis_record",
  computationalReproducibility: {
    status: "not_established",
    reason: "The current checkout has uncommitted revision changes and the local R/Python comparator environments are version-recorded but not archived as recoverable package environments.",
  },
  sdkArtifact: {
    repository: "https://github.com/episphere/msig",
    baseCommit: gitRevision.stdout?.trim() || null,
    workingTreeDirty,
  },
  artifacts: reproducibilityArtifacts,
  exactInputAndCatalogEvidence: {
    checksums: fidelityResult.inputs?.checksums || null,
    contexts: fidelityInput.contexts,
    contextOrderSha256: fidelityResult.inputs?.checksums?.contexts || null,
    signatureCatalogSha256: fidelityResult.inputs?.checksums?.signatures || null,
  },
  parameters: {
    tools: fidelityResult.environment?.packageOptions?.tools || null,
    comparison: comparisonContract.options.comparisonSettings,
  },
  randomNumberGeneration: {
    seed: 104729,
    tools: {
      deconstructsigs: { algorithm: "R default RNG stream with set.seed", seed: 104729 },
      sigminer: { algorithm: "R default RNG stream with set.seed", seed: 104729 },
      sigprofilerassignment: { algorithm: "Python random.seed and NumPy legacy seed", seed: 104729 },
      musical: { algorithm: "Python random.seed and NumPy legacy seed", seed: 104729 },
    },
  },
  schemas: [
    "msig.manuscript.e7.reviewer4.benchmark.v1",
    "msig.adapter-comparison.v0.1",
    "msig.report.v0.3",
    "msig.reproducibility.v0.1",
  ],
  environment: fidelityResult.environment || null,
  archivedTestData: {
    archivePath: "docs/manuscript/experiments/e7_four_tool_comparison/data/published_source/Supplementary_data_Diaz-Gay_et_al_2023_Benchmark.zip",
    archiveSha256,
    localComparatorPackageVersions: {
      r: fidelityResult.environment?.localRPackageVersions || null,
      python: fidelityResult.environment?.localPythonPackageVersions || null,
    },
  },
  rerunScripts: [
    "docs/manuscript/experiments/e7_four_tool_comparison/code/analyze-reviewer4-benchmark.mjs",
    "docs/manuscript/experiments/e7_four_tool_comparison/code/run-four-tool-comparison.mjs",
    "docs/manuscript/experiments/e7_four_tool_comparison/code/analyze-published-synthetic-benchmark.mjs",
  ].map((relativePath) => reproducibilityArtifacts[relativePath]),
  comparisonContract,
  outputDisposition,
};
await writeFile(path.join(outputDir, "reviewer4-reproducibility-manifest.json"), `${JSON.stringify(reproducibilityManifest, null, 2)}\n`);

function activeCallStats(predicted, truthActivities, names) {
  const predictedActive = predicted.map((value) => value >= cutoff);
  const truthActive = names.map((name) => Number(truthActivities?.[name] || 0) > 0);
  const tp = truthActive.reduce((n, active, i) => n + (active && predictedActive[i] ? 1 : 0), 0);
  const fp = truthActive.reduce((n, active, i) => n + (!active && predictedActive[i] ? 1 : 0), 0);
  const fn = truthActive.reduce((n, active, i) => n + (active && !predictedActive[i] ? 1 : 0), 0);
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return { precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 };
}

function barSvg(x, y, width, height, title, subtitle, groups, series, yMax = 1) {
  const left = x + 48;
  const top = y + 56;
  const plotH = height - 88;
  const plotW = width - 66;
  const colors = ["#2f6f8f", "#d77936", "#5b8e55", "#9a5b9d"];
  const text = (tx, ty, value, size = 12, fill = "#243447", weight = 400, anchor = "start") => `<text x="${tx}" y="${ty}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text>`;
  let out = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fbfcfd" stroke="#d8e1e7"/>${text(x + 16, y + 23, title, 15, "#172b3a", 700)}${text(x + 16, y + 41, subtitle, 10, "#526273")}`;
  [0, 0.5, 1].forEach((tick) => {
    const yy = top + plotH - tick * plotH;
    out += `<line x1="${left}" y1="${yy}" x2="${left + plotW}" y2="${yy}" stroke="#dbe3e8"/>${text(left - 8, yy + 4, (tick * yMax).toFixed(1), 10, "#667887", 400, "end")}`;
  });
  const groupW = plotW / groups.length;
  const barW = Math.min(19, groupW / (series.length + 2));
  groups.forEach((group, gi) => {
    const start = left + gi * groupW + (groupW - series.length * barW) / 2;
    series.forEach((item, si) => {
      const value = Math.max(0, Math.min(yMax, Number(item.values[gi] || 0)));
      const bh = value / yMax * plotH;
      out += `<rect x="${start + si * barW}" y="${top + plotH - bh}" width="${barW - 2}" height="${bh}" fill="${colors[si]}"/>`;
    });
    out += text(left + gi * groupW + groupW / 2, top + plotH + 18, group, 11, "#526273", 400, "middle");
  });
  return out;
}

function heatmapSvg(x, y, width, height, title, subtitle, rows, field, min, max, diagonalValue) {
  const text = (tx, ty, value, size = 11, fill = "#243447", anchor = "start") => `<text x="${tx}" y="${ty}" font-family="Arial, sans-serif" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${value}</text>`;
  const cell = 50;
  const gx = x + 105;
  const gy = y + 72;
  const matrix = Object.fromEntries(tools.map((a) => [a, Object.fromEntries(tools.map((b) => [b, a === b ? diagonalValue : null]))]));
  rows.forEach((row) => { matrix[row.toolA][row.toolB] = row[field]; matrix[row.toolB][row.toolA] = row[field]; });
  const color = (v) => {
    const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
    return `rgb(${Math.round(240 - 150 * t)},${Math.round(245 - 105 * t)},${Math.round(250 - 35 * t)})`;
  };
  let out = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fbfcfd" stroke="#d8e1e7"/>${text(x + 16, y + 24, title, 15, "#172b3a")}${text(x + 16, y + 42, subtitle, 10, "#526273")}`;
  tools.forEach((tool, i) => {
    out += text(gx + i * cell + 24, gy - 9, shortLabels[tool], 9, "#526273", "middle");
    out += text(gx - 8, gy + i * cell + 30, labels[tool].replace("SigProfilerAssignment", "SPA"), 9, "#526273", "end");
    tools.forEach((other, j) => {
      const value = matrix[tool][other];
      const xx = gx + j * cell;
      const yy = gy + i * cell;
      out += `<rect x="${xx}" y="${yy}" width="${cell - 2}" height="${cell - 2}" fill="${color(value)}" stroke="#fff"/>${text(xx + 24, yy + 29, value.toFixed(2), 11, value > (min + max) / 2 ? "#fff" : "#243447", "middle")}`;
    });
  });
  return out;
}

function signatureRangeSvg(x, y, width, height, rows) {
  const text = (tx, ty, value, size = 11, fill = "#243447", weight = 400, anchor = "start") => `<text x="${tx}" y="${ty}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${value}</text>`;
  const top = y + 64;
  const left = x + 82;
  const plotW = width - 118;
  const rowH = 32;
  const maxValue = Math.max(...rows.map((row) => row.meanAcrossToolRange));
  let out = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fbfcfd" stroke="#d8e1e7"/>${text(x + 16, y + 24, "F. Signatures driving real-cohort disagreement", 15, "#172b3a", 700)}${text(x + 16, y + 42, "Mean across-tool range in relative exposure across 38 samples", 10, "#526273")}`;
  rows.forEach((row, index) => {
    const yy = top + index * rowH;
    const barW = row.meanAcrossToolRange / maxValue * plotW;
    out += `${text(left - 10, yy + 15, row.signature, 10, "#526273", 400, "end")}<rect x="${left}" y="${yy}" width="${barW}" height="20" rx="2" fill="#2f6f8f"/>${text(left + barW + 7, yy + 15, row.meanAcrossToolRange.toFixed(3), 10, "#243447")}`;
  });
  return out;
}

const synthetic = [];
for (const noise of noises) {
  const suffix = noise === 0 ? "" : `-noise${noise}`;
  const input = await readJson(path.join(dataDir, `published-sbs-input${suffix}.json`));
  const truth = await readJson(path.join(dataDir, `published-sbs-truth${suffix}.json`));
  const matrices = await readJson(path.join(experimentDir, `published_full_local_py3_v2_noise${noise}`, "data", "adapter-exposure-matrices.json"));
  const samples = input.sampleNames;
  const signatures = input.signatureNames;
  const contexts = input.contexts;
  if (
    signatures.join("|") !== syntheticComparisonContract.catalog.signatureNames.join("|") ||
    contexts.join("|") !== syntheticComparisonContract.contextOrder.values.join("|")
  ) {
    throw new Error(`Synthetic input contract changed for noise ${noise}.`);
  }
  for (const tool of tools) {
    const toolDisposition = outputDisposition.find((entry) => entry.tool === tool);
    const exceptions = [];
    let samplesWithOmittedCatalogColumns = 0;
    let samplesWithExtraOutputColumns = 0;
    let samplesWithUnassignedOutput = 0;
    for (const sample of samples) {
      const materialized = materializeAdapterComparisonExposure(
        matrices.tools[tool][sample],
        signatures
      );
      const unassignedValues = Object.fromEntries(
        materialized.unassignedOutputColumns.map((name) => [
          name,
          nonNegativeFinite(matrices.tools[tool][sample]?.[name]),
        ])
      );
      samplesWithOmittedCatalogColumns += materialized.omittedCatalogColumns.length ? 1 : 0;
      samplesWithExtraOutputColumns += materialized.extraOutputColumns.length ? 1 : 0;
      samplesWithUnassignedOutput += materialized.unassignedOutputColumns.length ? 1 : 0;
      if (
        materialized.omittedCatalogColumns.length ||
        materialized.extraOutputColumns.length ||
        materialized.unassignedOutputColumns.length
      ) {
        exceptions.push({
          sample,
          omittedCatalogColumns: materialized.omittedCatalogColumns,
          extraOutputColumns: materialized.extraOutputColumns,
          unassignedOutputColumns: materialized.unassignedOutputColumns,
          unassignedValues,
        });
      }
    }
    toolDisposition.synthetic.push({
      noisePercent: noise,
      sampleCount: samples.length,
      catalogColumnCount: signatures.length,
      samplesWithOmittedCatalogColumns,
      samplesWithExtraOutputColumns,
      samplesWithUnassignedOutput,
      exceptions,
    });
  }
  for (const tool of tools) {
    for (const sample of samples) {
      const raw = fractionOutput(matrices.tools[tool][sample], signatures);
      const filtered = thresholdOutput(raw);
      const truthFractions = vector(truth.trueExposures[sample], signatures);
      const observed = normalize(vector(input.spectra[sample], contexts));
      const catalog = signatures.map((signature) => normalize(vector(input.signatures[signature], contexts)));
      const reconstruct = (exposure) => normalize(contexts.map((_, j) => sum(catalog.map((column, i) => column[j] * exposure[i]))));
      synthetic.push({
        noisePercent: noise,
        tool,
        toolLabel: labels[tool],
        sample,
        cancerType: sample.split("::")[0],
        observedMutationBurden: sum(vector(input.spectra[sample], contexts)),
        rawExposureCosine: cosine(raw, truthFractions),
        rawExposureRMSE: rmse(raw, truthFractions),
        rawExposureMAE: mae(raw, truthFractions),
        filteredExposureCosine: cosine(filtered, truthFractions),
        rawReconstructionCosine: cosine(reconstruct(raw), observed),
        filteredReconstructionCosine: cosine(reconstruct(filtered), observed),
        ...activeCallStats(filtered, truth.trueActivities[sample], signatures),
      });
    }
  }
}

const syntheticSummary = [];
for (const noise of noises) {
  for (const tool of tools) {
    const rows = synthetic.filter((row) => row.noisePercent === noise && row.tool === tool);
    syntheticSummary.push({
      noisePercent: noise,
      tool,
      toolLabel: labels[tool],
      sampleCount: rows.length,
      meanRawExposureCosine: round(mean(rows.map((row) => row.rawExposureCosine))),
      meanFilteredExposureCosine: round(mean(rows.map((row) => row.filteredExposureCosine))),
      meanRawExposureRMSE: round(mean(rows.map((row) => row.rawExposureRMSE))),
      meanRawExposureMAE: round(mean(rows.map((row) => row.rawExposureMAE))),
      meanRawReconstructionCosine: round(mean(rows.map((row) => row.rawReconstructionCosine))),
      meanFilteredReconstructionCosine: round(mean(rows.map((row) => row.filteredReconstructionCosine))),
      meanPrecision: round(mean(rows.map((row) => row.precision))),
      meanRecall: round(mean(rows.map((row) => row.recall))),
      meanF1: round(mean(rows.map((row) => row.f1))),
    });
  }
}

const syntheticPairwise = [];
for (const noise of noises) {
  for (let i = 0; i < tools.length; i += 1) {
    for (let j = i + 1; j < tools.length; j += 1) {
      const a = tools[i];
      const b = tools[j];
      const input = await readJson(path.join(dataDir, noise === 0 ? "published-sbs-input.json" : `published-sbs-input-noise${noise}.json`));
      const matrices = await readJson(path.join(experimentDir, `published_full_local_py3_v2_noise${noise}`, "data", "adapter-exposure-matrices.json"));
      const signatures = input.signatureNames;
      const av = [];
      const bv = [];
      const cosines = [];
      const activeJaccards = [];
      for (const sample of input.sampleNames) {
        const x = fractionOutput(matrices.tools[a][sample], signatures);
        const y = fractionOutput(matrices.tools[b][sample], signatures);
        const xf = thresholdOutput(x);
        const yf = thresholdOutput(y);
        av.push(...x);
        bv.push(...y);
        cosines.push(cosine(x, y));
        const ax = new Set(xf.map((v, k) => v >= cutoff ? signatures[k] : null).filter(Boolean));
        const bx = new Set(yf.map((v, k) => v >= cutoff ? signatures[k] : null).filter(Boolean));
        const union = new Set([...ax, ...bx]);
        activeJaccards.push(union.size ? [...ax].filter((signature) => bx.has(signature)).length / union.size : 1);
      }
      syntheticPairwise.push({
        noisePercent: noise,
        toolA: a,
        toolB: b,
        toolALabel: labels[a],
        toolBLabel: labels[b],
        rawExposurePearson: round(pearson(av, bv)),
        meanRawExposureCosine: round(mean(cosines)),
        meanActiveJaccardAfterCutoff: round(mean(activeJaccards)),
      });
    }
  }
}

const realComparison = await readJson(path.join(dataDir, "four-tool-comparison-results.json"));
const realPairwise = realComparison.pairwise.map((row) => ({
  toolA: row.toolA,
  toolB: row.toolB,
  pair: row.pair,
  flattenedExposurePearson: round(row.exposurePearson),
  meanPerSampleL1Disagreement: round(row.meanSampleL1),
  medianPerSampleL1Disagreement: round(row.medianSampleL1),
  meanActiveSignatureJaccard: round(row.meanActiveJaccard),
}));
const realSummary = realComparison.tools.map((row) => ({
  tool: row.tool,
  sampleCount: row.samples,
  catalogSignatureCount: row.catalogSignatures,
  meanActiveSignatureCount: round(row.meanActiveSignatureCount, 2),
  meanReconstructionCosine: round(row.meanReconstructionCosine),
  minimumReconstructionCosine: round(row.minReconstructionCosine),
}));
const realSignatureDiscrepancies = realComparison.largestDiscrepancies.map((row) => ({
  signature: row.signature,
  meanExposureAcrossTools: round(row.meanExposure),
  meanAcrossToolRange: round(row.acrossToolRangeMean),
  maximumAcrossToolRange: round(row.maxAcrossToolRange),
}));

const topSyntheticDiscrepancies = [];
for (const noise of noises) {
  const input = await readJson(path.join(dataDir, noise === 0 ? "published-sbs-input.json" : `published-sbs-input-noise${noise}.json`));
  const matrices = await readJson(path.join(experimentDir, `published_full_local_py3_v2_noise${noise}`, "data", "adapter-exposure-matrices.json"));
  for (const signature of input.signatureNames) {
    const ranges = input.sampleNames.map((sample) => {
      const values = tools.map((tool) => fractionOutput(matrices.tools[tool][sample], input.signatureNames)[input.signatureNames.indexOf(signature)]);
      return Math.max(...values) - Math.min(...values);
    });
    topSyntheticDiscrepancies.push({ noisePercent: noise, signature, meanRawAcrossToolRange: round(mean(ranges)), maxRawAcrossToolRange: round(Math.max(...ranges)) });
  }
}
topSyntheticDiscrepancies.sort((a, b) => b.meanRawAcrossToolRange - a.meanRawAcrossToolRange);

await mkdir(outputDir, { recursive: true });
await mkdir(figureDir, { recursive: true });
await writeCsv(path.join(outputDir, "synthetic-sample-metrics-raw-vs-filtered.csv"), synthetic);
await writeCsv(path.join(outputDir, "synthetic-summary-raw-vs-filtered.csv"), syntheticSummary);
await writeCsv(path.join(outputDir, "synthetic-pairwise-raw-vs-filtered.csv"), syntheticPairwise);
await writeCsv(path.join(outputDir, "synthetic-signature-discrepancies-raw.csv"), topSyntheticDiscrepancies);
await writeCsv(path.join(outputDir, "real-world-pairwise-comparison.csv"), realPairwise);
await writeCsv(path.join(outputDir, "real-world-tool-summary.csv"), realSummary);
await writeCsv(path.join(outputDir, "real-world-signature-discrepancies.csv"), realSignatureDiscrepancies);

const source = {
  synthetic: {
    generatorPaper: "Islam et al. 2022, Cell Genomics, DOI 10.1016/j.xgen.2022.100179",
    benchmarkPaper: "Díaz-Gay et al. 2023, Bioinformatics, DOI 10.1093/bioinformatics/btad756",
    archive: "Figshare DOI 10.6084/m9.figshare.24457114.v1",
    archiveSha256,
    benchmarkScope: "All 2,700 archived spectra across nine cancer-type groups, evaluated at 0%, 5%, and 10% noise (8,100 sample-condition combinations per tool).",
    caveat: "The published spectra are high-burden controlled mixtures. They are used for accuracy against known truth, not as evidence that real tools should disagree strongly.",
  },
  realWorld: {
    cohort: "PCAWG Lung-AdenoCA WGS SBS96, 38 samples",
    spectraUrl: "https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum?study=PCAWG&cancer=Lung-AdenoCA&strategy=WGS&profile=SBS&matrix=96&offset=0",
    catalogUrl: "https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature?source=Reference_signatures&strategy=WGS&profile=SBS&matrix=96&signatureSetName=COSMIC_v3_Signatures_GRCh37_SBS96&limit=10000&offset=0",
    inputArtifact: "docs/manuscript/experiments/e2_adapter_fidelity/data/adapter-fidelity-input.json",
    inputChecksums: fidelityResult.inputs?.checksums || null,
    caveat: "No biological ground truth exists for the real cohort; these results quantify implementation disagreement and reconstruction behavior only.",
  },
  harmonization: {
    comparisonContract,
    syntheticComparisonContract,
    outputDisposition,
    rawAccuracy: "Convert every adapter result to complete-catalog relative fractions and compare before the 1% reporting cutoff.",
    reportOutputs: "Apply the common 1% cutoff, zero inactive signatures, renormalize, and evaluate active counts/Jaccard/F1 separately.",
    catalog: "Normalize each signature column to unit sum before reconstruction.",
    contextOrder: fidelityInput.contexts,
    reconstruction: "Cosine similarity between normalized observed spectra and catalog-reconstructed spectra.",
  },
};
await writeFile(path.join(outputDir, "reviewer4-benchmark-provenance.json"), `${JSON.stringify({ schemaVersion: "msig.manuscript.e7.reviewer4.benchmark.v1", generatedAt: new Date().toISOString(), source, reproducibility: reproducibilityManifest, outputs: { syntheticSummary: "synthetic-summary-raw-vs-filtered.csv", realWorldPairwise: "real-world-pairwise-comparison.csv", comparisonContract: "embedded in source.harmonization.comparisonContract", reproducibilityManifest: "reviewer4-reproducibility-manifest.json" } }, null, 2)}\n`);

const summaryAt = (noise, tool, field) => syntheticSummary.find((row) => row.noisePercent === noise && row.tool === tool)?.[field] || 0;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1100" viewBox="0 0 1200 1100"><rect width="1200" height="1100" fill="#fff"/><text x="30" y="30" font-family="Arial" font-size="21" font-weight="700" fill="#172b3a">Four-tool benchmark: known-truth accuracy and real-world disagreement</text><text x="30" y="51" font-family="Arial" font-size="12" fill="#526273">Synthetic raw accuracy is separated from 1% thresholded reporting behavior; real PCAWG results quantify tool-to-tool divergence without truth labels.</text>`;
const legendColors = ["#2f6f8f", "#d77936", "#5b8e55", "#9a5b9d"];
const legendX = [30, 205, 340, 575];
tools.forEach((tool, index) => {
  svg += `<rect x="${legendX[index]}" y="65" width="11" height="11" fill="${legendColors[index]}"/><text x="${legendX[index] + 16}" y="75" font-family="Arial" font-size="10" fill="#526273">${labels[tool]}</text>`;
});
svg += barSvg(30, 90, 560, 280, "A. Synthetic raw exposure accuracy", "Mean cosine to published true fractions; no post-fit cutoff", ["0%", "5%", "10%"], tools.map((tool) => ({ label: labels[tool], values: noises.map((noise) => summaryAt(noise, tool, "meanRawExposureCosine")) })));
svg += barSvg(610, 90, 560, 280, "B. Synthetic active-call performance", "Mean F1 after common 1% cutoff; truth activity > 0", ["0%", "5%", "10%"], tools.map((tool) => ({ label: labels[tool], values: noises.map((noise) => summaryAt(noise, tool, "meanF1")) })));
const pairwiseForFigure = realPairwise.map((row) => ({ ...row, toolA: tools.find((tool) => labels[tool] === row.toolA), toolB: tools.find((tool) => labels[tool] === row.toolB) }));
svg += heatmapSvg(30, 400, 560, 280, "C. Real PCAWG exposure correlation", "Flattened complete-catalog relative fractions", pairwiseForFigure.map((row) => ({ ...row, value: row.flattenedExposurePearson })), "value", 0.8, 1, 1);
svg += heatmapSvg(610, 400, 560, 280, "D. Real PCAWG per-sample disagreement", "Mean L1 distance between relative-exposure vectors", pairwiseForFigure.map((row) => ({ ...row, value: row.meanPerSampleL1Disagreement })), "value", 0, 1, 0);
svg += heatmapSvg(30, 710, 560, 280, "E. Real PCAWG active-signature concordance", "Mean Jaccard after the common 1% cutoff", pairwiseForFigure.map((row) => ({ ...row, value: row.meanActiveSignatureJaccard })), "value", 0, 1, 1);
svg += signatureRangeSvg(610, 710, 560, 280, realSignatureDiscrepancies.slice(0, 6));
svg += `<text x="30" y="1020" font-family="Arial" font-size="10" fill="#526273">Heatmap abbreviations: SPA, SigProfilerAssignment. Synthetic panels test accuracy; PCAWG panels test triangulation and do not establish biological truth.</text><text x="30" y="1040" font-family="Arial" font-size="10" fill="#526273">All tools use complete-catalog relative fractions; accuracy is evaluated before filtering, and active calls use a common 1% cutoff followed by renormalization.</text></svg>`;
await writeFile(path.join(figureDir, "figure-e7-reviewer4-benchmark.svg"), svg);

console.log(JSON.stringify({ status: "completed", syntheticSamplesPerNoise: syntheticReferenceInput.sampleNames.length, syntheticSummaryRows: syntheticSummary.length, realWorldSamples: 38, realWorldPairwiseRows: realPairwise.length, topRawSyntheticDiscrepancies: topSyntheticDiscrepancies.slice(0, 10) }, null, 2));
