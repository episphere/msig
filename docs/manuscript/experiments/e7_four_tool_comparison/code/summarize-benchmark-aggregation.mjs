import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const experimentDir = path.join(root, "docs", "manuscript", "experiments", "e7_four_tool_comparison");
const syntheticDir = path.join(experimentDir, "published_synthetic_benchmark");
const realInputDir = path.join(root, "docs", "manuscript", "experiments", "e2_adapter_fidelity", "data");
const outputDir = path.join(experimentDir, "aggregation_dispersion");
const cutoff = 0.01;

const tools = ["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"];
const labels = {
  deconstructsigs: "deconstructSigs",
  sigminer: "sigminer",
  sigprofilerassignment: "SigProfilerAssignment",
  musical: "MuSiCal",
};
const noises = [0, 5, 10];

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field.length || record.length) {
    record.push(field.replace(/\r$/, ""));
    records.push(record);
  }
  const [header, ...rows] = records.filter((row) => row.some((value) => value !== ""));
  return rows.map((row) => Object.fromEntries(header.map((column, index) => [column, row[index] ?? ""])));
}

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const readCsv = async (file) => parseCsv(await readFile(file, "utf8"));
const sum = (values) => values.reduce((total, value) => total + value, 0);
const mean = (values) => (values.length ? sum(values) / values.length : null);
const rounded = (value, digits = 6) => (value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits)));

function quantile(values, probability) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function sampleSd(values) {
  if (values.length < 2) return null;
  const center = mean(values);
  return Math.sqrt(sum(values.map((value) => (value - center) ** 2)) / (values.length - 1));
}

function describe(values, prefix) {
  const finite = values.map(Number).filter(Number.isFinite);
  return {
    [`${prefix}Mean`]: rounded(mean(finite)),
    [`${prefix}Sd`]: rounded(sampleSd(finite)),
    [`${prefix}Median`]: rounded(quantile(finite, 0.5)),
    [`${prefix}Q1`]: rounded(quantile(finite, 0.25)),
    [`${prefix}Q3`]: rounded(quantile(finite, 0.75)),
    [`${prefix}Min`]: finite.length ? rounded(Math.min(...finite)) : null,
    [`${prefix}Max`]: finite.length ? rounded(Math.max(...finite)) : null,
  };
}

function dot(a, b) {
  return sum(a.map((value, index) => value * b[index]));
}

function pearson(a, b) {
  const meanA = mean(a);
  const meanB = mean(b);
  const centeredA = a.map((value) => value - meanA);
  const centeredB = b.map((value) => value - meanB);
  const denominator = Math.sqrt(dot(centeredA, centeredA) * dot(centeredB, centeredB));
  return denominator > 0 ? dot(centeredA, centeredB) / denominator : null;
}

function normalize(values) {
  const total = sum(values);
  return total > 0 ? values.map((value) => value / total) : values.map(() => 0);
}

function syntheticRawFractions(map, signatureNames) {
  const positive = signatureNames.map((signature) => {
    const value = Number(map?.[signature]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  return normalize(positive);
}

function syntheticFilteredFractions(map, signatureNames) {
  const fractions = syntheticRawFractions(map, signatureNames);
  return normalize(fractions.map((value) => (value >= cutoff ? value : 0)));
}

function realFractions(map, signatureNames) {
  const positive = signatureNames.map((signature) => {
    const value = Number(map?.[signature]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  return normalize(positive.map((value) => (value >= cutoff ? value : 0)));
}

function activeJaccard(a, b) {
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < a.length; index += 1) {
    const activeA = a[index] > 0;
    const activeB = b[index] > 0;
    intersection += activeA && activeB ? 1 : 0;
    union += activeA || activeB ? 1 : 0;
  }
  return union ? intersection / union : 1;
}

function l1(a, b) {
  return sum(a.map((value, index) => Math.abs(value - b[index])));
}

function csvCell(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function writeCsv(file, rows) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const body = [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))];
  await writeFile(file, `${body.join("\n")}\n`);
}

function syntheticToolSummary(rows, keys) {
  const tp = sum(rows.map((row) => Number(row.truePositiveCount)));
  const fp = sum(rows.map((row) => Number(row.falsePositiveCount)));
  const fn = sum(rows.map((row) => Number(row.falseNegativeCount)));
  const pooledPrecision = tp + fp ? tp / (tp + fp) : null;
  const pooledRecall = tp + fn ? tp / (tp + fn) : null;
  const pooledF1 = pooledPrecision != null && pooledRecall != null && pooledPrecision + pooledRecall > 0
    ? (2 * pooledPrecision * pooledRecall) / (pooledPrecision + pooledRecall)
    : 0;
  return {
    ...keys,
    sampleCount: rows.length,
    ...describe(rows.map((row) => row.rawExposureCosine), "rawExposureCosine"),
    ...describe(rows.map((row) => row.precision), "precision"),
    ...describe(rows.map((row) => row.recall), "recall"),
    ...describe(rows.map((row) => row.f1), "f1"),
    pooledTruePositiveCount: tp,
    pooledFalsePositiveCount: fp,
    pooledFalseNegativeCount: fn,
    pooledPrecision: rounded(pooledPrecision),
    pooledRecall: rounded(pooledRecall),
    pooledF1: rounded(pooledF1),
  };
}

const syntheticSampleFile = path.join(experimentDir, "reviewer4_benchmark", "synthetic-sample-metrics-raw-vs-filtered.csv");
const syntheticCountFile = path.join(syntheticDir, "published-synthetic-sample-metrics.csv");
const syntheticPairwiseSampleFile = path.join(syntheticDir, "published-pairwise-sample-metrics.csv");
const syntheticSummaryReferenceFile = path.join(experimentDir, "reviewer4_benchmark", "synthetic-summary-raw-vs-filtered.csv");
const syntheticPairwiseReferenceFile = path.join(experimentDir, "reviewer4_benchmark", "synthetic-pairwise-raw-vs-filtered.csv");
const syntheticRows = await readCsv(syntheticSampleFile);
const syntheticCountRows = await readCsv(syntheticCountFile);
const syntheticPairwiseRows = await readCsv(syntheticPairwiseSampleFile);
const syntheticSummaryReference = await readCsv(syntheticSummaryReferenceFile);
const syntheticPairwiseReference = await readCsv(syntheticPairwiseReferenceFile);
const syntheticCountsByKey = new Map(syntheticCountRows.map((row) => [
  `${row.noisePercent}\t${row.tool}\t${row.sample}`,
  row,
]));
for (const row of syntheticRows) {
  const counts = syntheticCountsByKey.get(`${row.noisePercent}\t${row.tool}\t${row.sample}`);
  if (!counts) throw new Error(`Missing detection counts for ${row.noisePercent}/${row.tool}/${row.sample}`);
  row.truePositiveCount = counts.truePositiveCount;
  row.falsePositiveCount = counts.falsePositiveCount;
  row.falseNegativeCount = counts.falseNegativeCount;
}

const syntheticOverall = [];
const syntheticByCancerType = [];
for (const noisePercent of noises) {
  for (const tool of tools) {
    const rows = syntheticRows.filter((row) => Number(row.noisePercent) === noisePercent && row.tool === tool);
    syntheticOverall.push(syntheticToolSummary(rows, { noisePercent, tool, toolLabel: labels[tool] }));
    const cancerTypes = [...new Set(rows.map((row) => row.cancerType))].sort();
    for (const cancerType of cancerTypes) {
      const groupRows = rows.filter((row) => row.cancerType === cancerType);
      syntheticByCancerType.push(syntheticToolSummary(groupRows, { noisePercent, tool, toolLabel: labels[tool], cancerType }));
    }
  }
}

const syntheticMatrices = {};
const syntheticInputs = {};
for (const noisePercent of noises) {
  const suffix = noisePercent === 0 ? "" : `-noise${noisePercent}`;
  syntheticInputs[noisePercent] = await readJson(path.join(experimentDir, "data", `published-sbs-input${suffix}.json`));
  syntheticMatrices[noisePercent] = await readJson(path.join(experimentDir, `published_full_local_py3_v2_noise${noisePercent}`, "data", "adapter-exposure-matrices.json"));
}

const syntheticPairwiseOverall = [];
const syntheticPairwiseByCancerType = [];
for (const noisePercent of noises) {
  const input = syntheticInputs[noisePercent];
  const matrices = syntheticMatrices[noisePercent];
  for (let left = 0; left < tools.length; left += 1) {
    for (let right = left + 1; right < tools.length; right += 1) {
      const toolA = tools[left];
      const toolB = tools[right];
      const rows = syntheticPairwiseRows.filter((row) => Number(row.noisePercent) === noisePercent && row.toolA === toolA && row.toolB === toolB);
      const flattenedA = [];
      const flattenedB = [];
      for (const sample of input.sampleNames) {
        flattenedA.push(...syntheticRawFractions(matrices.tools[toolA]?.[sample], input.signatureNames));
        flattenedB.push(...syntheticRawFractions(matrices.tools[toolB]?.[sample], input.signatureNames));
      }
      syntheticPairwiseOverall.push({
        noisePercent,
        toolA: labels[toolA],
        toolB: labels[toolB],
        pair: `${labels[toolA]} vs ${labels[toolB]}`,
        sampleCount: rows.length,
        flattenedRawExposurePearson: rounded(pearson(flattenedA, flattenedB)),
        ...describe(rows.map((row) => {
          const a = syntheticRawFractions(matrices.tools[toolA]?.[row.sample], input.signatureNames);
          const b = syntheticRawFractions(matrices.tools[toolB]?.[row.sample], input.signatureNames);
          return pearson(a, b);
        }), "perSampleRawExposurePearson"),
        ...describe(rows.map((row) => row.activeJaccard), "activeJaccard"),
      });
      const cancerTypes = [...new Set(rows.map((row) => row.cancerType))].sort();
      for (const cancerType of cancerTypes) {
        const groupRows = rows.filter((row) => row.cancerType === cancerType);
        const groupA = [];
        const groupB = [];
        for (const row of groupRows) {
          groupA.push(...syntheticRawFractions(matrices.tools[toolA]?.[row.sample], input.signatureNames));
          groupB.push(...syntheticRawFractions(matrices.tools[toolB]?.[row.sample], input.signatureNames));
        }
        syntheticPairwiseByCancerType.push({
          noisePercent,
          toolA: labels[toolA],
          toolB: labels[toolB],
          pair: `${labels[toolA]} vs ${labels[toolB]}`,
          cancerType,
          sampleCount: groupRows.length,
          flattenedRawExposurePearson: rounded(pearson(groupA, groupB)),
          ...describe(groupRows.map((row) => {
            const a = syntheticRawFractions(matrices.tools[toolA]?.[row.sample], input.signatureNames);
            const b = syntheticRawFractions(matrices.tools[toolB]?.[row.sample], input.signatureNames);
            return pearson(a, b);
          }), "perSampleRawExposurePearson"),
          ...describe(groupRows.map((row) => row.activeJaccard), "activeJaccard"),
        });
      }
    }
  }
}

const realInputFile = path.join(realInputDir, "adapter-fidelity-input.json");
const realPairsFile = path.join(realInputDir, "adapter-fidelity-exposure-pairs.json");
const realInput = await readJson(realInputFile);
const realPairs = (await readJson(realPairsFile)).rows;
const realRaw = Object.fromEntries(tools.map((tool) => [tool, Object.fromEntries(realInput.sampleNames.map((sample) => [sample, Object.fromEntries(realInput.signatureNames.map((signature) => [signature, 0]))]))]));
for (const row of realPairs) {
  const value = Number(row.browserExposure);
  realRaw[row.tool][row.sample][row.signature] = Number.isFinite(value) && value > 0 ? value : 0;
}
const realHarmonized = Object.fromEntries(tools.map((tool) => [tool, Object.fromEntries(realInput.sampleNames.map((sample) => [sample, realFractions(realRaw[tool][sample], realInput.signatureNames)]))]));

const realSampleMetrics = await readCsv(path.join(experimentDir, "data", "sample-tool-metrics.csv"));
const realComparisonFile = path.join(experimentDir, "data", "four-tool-comparison-results.json");
const realComparison = await readJson(realComparisonFile);
const realToolDispersion = tools.map((tool) => {
  const rows = realSampleMetrics.filter((row) => row.tool === labels[tool]);
  return {
    tool: labels[tool],
    sampleCount: rows.length,
    ...describe(rows.map((row) => row.activeSignatureCount), "activeSignatureCount"),
    ...describe(rows.map((row) => row.reconstructionCosine), "reconstructionCosine"),
  };
});

const realPairwiseDispersion = [];
for (let left = 0; left < tools.length; left += 1) {
  for (let right = left + 1; right < tools.length; right += 1) {
    const toolA = tools[left];
    const toolB = tools[right];
    const flattenedA = [];
    const flattenedB = [];
    const samplePearsons = [];
    const sampleL1 = [];
    const jaccards = [];
    for (const sample of realInput.sampleNames) {
      const a = realHarmonized[toolA][sample];
      const b = realHarmonized[toolB][sample];
      flattenedA.push(...a);
      flattenedB.push(...b);
      samplePearsons.push(pearson(a, b));
      sampleL1.push(l1(a, b));
      jaccards.push(activeJaccard(a, b));
    }
    realPairwiseDispersion.push({
      toolA: labels[toolA],
      toolB: labels[toolB],
      pair: `${labels[toolA]} vs ${labels[toolB]}`,
      sampleCount: realInput.sampleNames.length,
      flattenedExposurePearson: rounded(pearson(flattenedA, flattenedB)),
      ...describe(samplePearsons, "perSampleExposurePearson"),
      ...describe(sampleL1, "perSampleL1"),
      ...describe(jaccards, "activeJaccard"),
    });
  }
}

function assertNear(actual, expected, label, tolerance = 0.0000006) {
  const difference = Math.abs(Number(actual) - Number(expected));
  if (!Number.isFinite(difference) || difference > tolerance) {
    throw new Error(`${label}: ${actual} does not match ${expected} within ${tolerance}`);
  }
  return difference;
}

if (syntheticRows.length !== 32_400 || syntheticCountRows.length !== 32_400 || syntheticPairwiseRows.length !== 48_600) {
  throw new Error(`Unexpected synthetic row counts: ${syntheticRows.length}, ${syntheticCountRows.length}, ${syntheticPairwiseRows.length}`);
}
if (syntheticOverall.some((row) => row.sampleCount !== 2_700) || syntheticByCancerType.some((row) => row.sampleCount !== 300)) {
  throw new Error("Synthetic overall or cancer-type group sizes are not 2,700 and 300, respectively");
}

let maximumAggregateDifference = 0;
for (const row of syntheticOverall) {
  const reference = syntheticSummaryReference.find((candidate) => Number(candidate.noisePercent) === row.noisePercent && candidate.tool === row.tool);
  if (!reference) throw new Error(`Missing synthetic summary reference for ${row.noisePercent}/${row.tool}`);
  maximumAggregateDifference = Math.max(
    maximumAggregateDifference,
    assertNear(row.rawExposureCosineMean, reference.meanRawExposureCosine, `raw exposure cosine ${row.noisePercent}/${row.tool}`),
    assertNear(row.precisionMean, reference.meanPrecision, `precision ${row.noisePercent}/${row.tool}`),
    assertNear(row.recallMean, reference.meanRecall, `recall ${row.noisePercent}/${row.tool}`),
    assertNear(row.f1Mean, reference.meanF1, `F1 ${row.noisePercent}/${row.tool}`),
  );
}
for (const row of syntheticPairwiseOverall) {
  const toolA = tools.find((tool) => labels[tool] === row.toolA);
  const toolB = tools.find((tool) => labels[tool] === row.toolB);
  const reference = syntheticPairwiseReference.find((candidate) => Number(candidate.noisePercent) === row.noisePercent && candidate.toolA === toolA && candidate.toolB === toolB);
  if (!reference) throw new Error(`Missing synthetic pairwise reference for ${row.noisePercent}/${row.pair}`);
  maximumAggregateDifference = Math.max(
    maximumAggregateDifference,
    assertNear(row.flattenedRawExposurePearson, reference.rawExposurePearson, `synthetic Pearson ${row.noisePercent}/${row.pair}`),
    assertNear(row.activeJaccardMean, reference.meanActiveJaccardAfterCutoff, `synthetic Jaccard ${row.noisePercent}/${row.pair}`),
  );
}
for (const row of realToolDispersion) {
  const reference = realComparison.tools.find((candidate) => candidate.tool === row.tool);
  if (!reference) throw new Error(`Missing real tool reference for ${row.tool}`);
  maximumAggregateDifference = Math.max(
    maximumAggregateDifference,
    assertNear(row.activeSignatureCountMean, reference.meanActiveSignatureCount, `real active count ${row.tool}`),
    assertNear(row.reconstructionCosineMean, reference.meanReconstructionCosine, `real reconstruction cosine ${row.tool}`),
  );
}
for (const row of realPairwiseDispersion) {
  const reference = realComparison.pairwise.find((candidate) => candidate.pair === row.pair);
  if (!reference) throw new Error(`Missing real pairwise reference for ${row.pair}`);
  maximumAggregateDifference = Math.max(
    maximumAggregateDifference,
    assertNear(row.flattenedExposurePearson, reference.exposurePearson, `real Pearson ${row.pair}`),
    assertNear(row.perSampleL1Mean, reference.meanSampleL1, `real L1 ${row.pair}`),
    assertNear(row.activeJaccardMean, reference.meanActiveJaccard, `real Jaccard ${row.pair}`),
  );
}

await mkdir(outputDir, { recursive: true });
await writeCsv(path.join(outputDir, "synthetic-tool-overall-dispersion.csv"), syntheticOverall);
await writeCsv(path.join(outputDir, "synthetic-tool-by-cancer-type.csv"), syntheticByCancerType);
await writeCsv(path.join(outputDir, "synthetic-pairwise-overall-dispersion.csv"), syntheticPairwiseOverall);
await writeCsv(path.join(outputDir, "synthetic-pairwise-by-cancer-type.csv"), syntheticPairwiseByCancerType);
await writeCsv(path.join(outputDir, "real-tool-dispersion.csv"), realToolDispersion);
await writeCsv(path.join(outputDir, "real-pairwise-dispersion.csv"), realPairwiseDispersion);

const sourceFiles = [syntheticSampleFile, syntheticCountFile, syntheticPairwiseSampleFile, syntheticSummaryReferenceFile, syntheticPairwiseReferenceFile, realInputFile, realPairsFile, realComparisonFile];
const sourceChecksums = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => {
  const content = await readFile(file);
  return [path.relative(root, file).replaceAll("\\", "/"), createHash("sha256").update(content).digest("hex")];
})));
const manifest = {
  schemaVersion: "msig.manuscript.e7.aggregation-dispersion.v1",
  generatedAt: new Date().toISOString(),
  cutoff,
  aggregation: {
    syntheticAccuracy: "Metrics were computed independently for each spectrum, then summarized by the unweighted arithmetic mean across 2,700 spectra within each tool and noise level (macro-average). Precision, recall, and F1 were not calculated from pooled calls.",
    activeJaccard: "Jaccard similarity was computed independently for each spectrum and tool pair after the common 1% cutoff, then summarized by the unweighted arithmetic mean.",
    exposurePearson: "Pearson correlation was computed once per tool pair on the two complete relative-exposure matrices flattened across sample-by-signature cells; it was not an average of per-spectrum correlations.",
    dispersion: "SD is the sample standard deviation (denominator n-1). Quartiles use linear interpolation at p=0.25 and p=0.75. Cancer-type rows contain 300 spectra per group.",
  },
  validation: {
    expectedRows: {
      syntheticSampleMetrics: 32_400,
      syntheticDetectionCountMetrics: 32_400,
      syntheticPairwiseSampleMetrics: 48_600,
      spectraPerToolNoiseLevel: 2_700,
      spectraPerCancerType: 300,
    },
    comparedWithExistingAggregateOutputs: true,
    aggregateComparisonTolerance: 0.0000006,
    maximumAbsoluteDifference: maximumAggregateDifference,
  },
  sourceChecksums,
  outputs: {
    syntheticToolOverall: "synthetic-tool-overall-dispersion.csv",
    syntheticToolByCancerType: "synthetic-tool-by-cancer-type.csv",
    syntheticPairwiseOverall: "synthetic-pairwise-overall-dispersion.csv",
    syntheticPairwiseByCancerType: "synthetic-pairwise-by-cancer-type.csv",
    realTool: "real-tool-dispersion.csv",
    realPairwise: "real-pairwise-dispersion.csv",
  },
};
await writeFile(path.join(outputDir, "aggregation-dispersion-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  status: "completed",
  outputDir: path.relative(root, outputDir),
  rows: {
    syntheticOverall: syntheticOverall.length,
    syntheticByCancerType: syntheticByCancerType.length,
    syntheticPairwiseOverall: syntheticPairwiseOverall.length,
    syntheticPairwiseByCancerType: syntheticPairwiseByCancerType.length,
    realToolDispersion: realToolDispersion.length,
    realPairwiseDispersion: realPairwiseDispersion.length,
  },
}, null, 2));
