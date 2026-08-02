import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAdapterComparisonContract } from "../../../../../mSigSDKScripts/adapters.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const experimentDir = path.join(root, "docs", "manuscript", "experiments", "e7_four_tool_comparison");
const dataDir = path.join(experimentDir, "data");
const figureDir = path.join(experimentDir, "figures");
const outputDir = path.join(experimentDir, "published_synthetic_benchmark");
const cutoff = 0.01;
const tools = ["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"];
const toolLabels = {
  deconstructsigs: "deconstructSigs",
  sigminer: "sigminer",
  sigprofilerassignment: "SigProfilerAssignment",
  musical: "MuSiCal",
};
const noiseLevels = [0, 5, 10];
const archiveSha256 = "c629de203bcf7a517b0308ea695da90572d92e7b8f271dc3f72fe29eeed731aa";

const sourceForNoise = (noise) => {
  const suffix = noise === 0 ? "" : `-noise${noise}`;
  return {
    input: path.join(dataDir, `published-sbs-input${suffix}-subset1.json`),
    truth: path.join(dataDir, `published-sbs-truth${suffix}-subset1.json`),
    exposures: path.join(
      experimentDir,
      `published_subset1_local_py3_noise${noise}`,
      "data",
      "adapter-exposure-matrices.json"
    ),
  };
};

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const dot = (a, b) => sum(a.map((value, index) => value * b[index]));
const norm = (values) => Math.sqrt(dot(values, values));
const cosine = (a, b) => {
  const denominator = norm(a) * norm(b);
  return denominator > 0 ? dot(a, b) / denominator : null;
};
const rmse = (a, b) => Math.sqrt(mean(a.map((value, index) => (value - b[index]) ** 2)) || 0);
const mae = (a, b) => mean(a.map((value, index) => Math.abs(value - b[index])));
const pearson = (a, b) => {
  const meanA = mean(a);
  const meanB = mean(b);
  const centeredA = a.map((value) => value - meanA);
  const centeredB = b.map((value) => value - meanB);
  const denominator = norm(centeredA) * norm(centeredB);
  return denominator > 0 ? dot(centeredA, centeredB) / denominator : null;
};
const normalize = (values) => {
  const total = sum(values);
  return total > 0 ? values.map((value) => value / total) : values.map(() => 0);
};
const rounded = (value, digits = 6) => (value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits)));
const csvCell = (value) => {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const writeCsv = async (file, rows) => {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const body = [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))];
  await writeFile(file, `${body.join("\n")}\n`);
};

function vectorFromMap(map, names) {
  return names.map((name) => {
    const value = Number(map?.[name]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
}

function filteredFractions(map, names) {
  const values = vectorFromMap(map, names);
  const fractions = normalize(values);
  return normalize(fractions.map((value) => (value >= cutoff ? value : 0)));
}

function filterTruth(values) {
  return normalize(values.map((value) => (value >= cutoff ? value : 0)));
}

function f1Stats(predicted, truthActive) {
  const predictedActive = predicted.map((value) => value >= cutoff);
  const tp = predictedActive.reduce((count, active, index) => count + (active && truthActive[index] ? 1 : 0), 0);
  const fp = predictedActive.reduce((count, active, index) => count + (active && !truthActive[index] ? 1 : 0), 0);
  const fn = truthActive.reduce((count, active, index) => count + (active && !predictedActive[index] ? 1 : 0), 0);
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  return {
    truePositiveCount: tp,
    falsePositiveCount: fp,
    falseNegativeCount: fn,
    precision,
    recall,
    f1: precision != null && recall != null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0,
  };
}

function burdenGroups(sampleNames, burdenBySample) {
  const ordered = [...sampleNames].sort((a, b) => burdenBySample[a] - burdenBySample[b]);
  const labels = {};
  ordered.forEach((sample, index) => {
    const rank = index / ordered.length;
    labels[sample] = rank < 1 / 3 ? "low" : rank < 2 / 3 ? "middle" : "high";
  });
  return labels;
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function svgText(x, y, text, options = {}) {
  const size = options.size || 13;
  const fill = options.fill || "#243447";
  const weight = options.weight || 400;
  const anchor = options.anchor || "start";
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(text)}</text>`;
}

function panelTitle(x, y, title, subtitle) {
  return `${svgText(x, y, title, { size: 16, weight: 700 })}${svgText(x, y + 21, subtitle, { size: 11, fill: "#526273" })}`;
}

function heatColor(value) {
  if (value == null) return "#eef2f5";
  if (value >= 0.995) return "#2f6f8f";
  if (value >= 0.98) return "#5f95aa";
  if (value >= 0.95) return "#9ec3cf";
  if (value >= 0.9) return "#cbdfe4";
  return "#e7edf0";
}

function groupedBarPanel({ x, y, width, height, title, subtitle, groups, series, yMax = 1 }) {
  const left = x + 46;
  const top = y + 62;
  const plotWidth = width - 66;
  const plotHeight = height - 96;
  const colors = ["#2f6f8f", "#d77936", "#5b8e55", "#9a5b9d"];
  const barWidth = Math.min(18, plotWidth / Math.max(1, groups.length * series.length * 1.8));
  let content = panelTitle(x, y + 24, title, subtitle);
  [0, 0.5, 1].forEach((tick) => {
    const value = yMax * tick;
    const yy = top + plotHeight - plotHeight * tick;
    content += `<line x1="${left}" y1="${yy}" x2="${left + plotWidth}" y2="${yy}" stroke="#dbe3e8" stroke-width="1"/>`;
    content += svgText(left - 8, yy + 4, value.toFixed(1), { size: 10, fill: "#667887", anchor: "end" });
  });
  const groupWidth = plotWidth / groups.length;
  groups.forEach((group, groupIndex) => {
    const start = left + groupIndex * groupWidth + (groupWidth - series.length * barWidth) / 2;
    series.forEach((item, seriesIndex) => {
      const value = Number(item.values[groupIndex] || 0);
      const barHeight = Math.max(0, Math.min(1, value / yMax)) * plotHeight;
      const bx = start + seriesIndex * barWidth;
      const by = top + plotHeight - barHeight;
      content += `<rect x="${bx}" y="${by}" width="${Math.max(4, barWidth - 2)}" height="${barHeight}" fill="${colors[seriesIndex % colors.length]}"/>`;
    });
    content += svgText(left + groupIndex * groupWidth + groupWidth / 2, top + plotHeight + 18, group, { size: 11, fill: "#526273", anchor: "middle" });
  });
  series.forEach((item, index) => {
    const lx = x + 54 + index * 88;
    content += `<rect x="${lx}" y="${y + height - 21}" width="10" height="10" fill="${colors[index % colors.length]}"/>`;
    content += svgText(lx + 14, y + height - 12, item.label, { size: 10, fill: "#526273" });
  });
  return content;
}

function createFigure({ summaryRows, pairwiseRows, burdenRows }) {
  const width = 1200;
  const height = 790;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#ffffff"/>`;
  svg += svgText(30, 30, "Four-tool benchmark on published synthetic SBS spectra", { size: 21, weight: 700, fill: "#172b3a" });
  svg += svgText(30, 51, "9 spectra (one per cancer type) × 3 archived noise levels; fractions harmonized after a 1% post-fit cutoff", { size: 12, fill: "#526273" });

  const panelX = [30, 420, 810, 30];
  const panelY = [72, 72, 72, 410];
  const panelW = [360, 360, 360, 1140];
  const panelH = [300, 300, 300, 340];
  panelX.forEach((x, index) => {
    svg += `<rect x="${x}" y="${panelY[index]}" width="${panelW[index]}" height="${panelH[index]}" fill="#fbfcfd" stroke="#d8e1e7"/>`;
  });

  const noise0Pairs = pairwiseRows.filter((row) => row.noisePercent === 0);
  const matrix = Object.fromEntries(tools.map((tool) => [tool, Object.fromEntries(tools.map((other) => [other, tool === other ? 1 : null]))]));
  noise0Pairs.forEach((row) => {
    matrix[row.toolA][row.toolB] = row.exposurePearson;
    matrix[row.toolB][row.toolA] = row.exposurePearson;
  });
  svg += panelTitle(48, 110, "A. Tool-to-tool agreement", "Pearson correlation of harmonized exposure fractions; noise 0%");
  const gridX = 145;
  const gridY = 155;
  const cell = 45;
  tools.forEach((tool, index) => {
    svg += svgText(gridX + index * cell + cell / 2, gridY - 9, toolLabels[tool].replace("SigProfilerAssignment", "SPA"), { size: 9, fill: "#526273", anchor: "middle" });
    svg += svgText(gridX - 8, gridY + index * cell + cell / 2 + 3, toolLabels[tool].replace("SigProfilerAssignment", "SPA"), { size: 9, fill: "#526273", anchor: "end" });
    tools.forEach((other, otherIndex) => {
      const value = matrix[tool][other];
      const cx = gridX + otherIndex * cell;
      const cy = gridY + index * cell;
      svg += `<rect x="${cx}" y="${cy}" width="${cell - 2}" height="${cell - 2}" fill="${heatColor(value)}" stroke="#ffffff"/>`;
      svg += svgText(cx + (cell - 2) / 2, cy + 27, value == null ? "–" : value.toFixed(2), { size: 11, fill: value != null && value > 0.98 ? "#ffffff" : "#243447", anchor: "middle" });
    });
  });
  svg += svgText(62, 275, "Higher values indicate closer exposure vectors; tool objectives remain package-specific.", { size: 10, fill: "#526273" });

  const summaryByNoiseTool = (noise, tool, metric) => summaryRows.find((row) => row.noisePercent === noise && row.tool === tool)?.[metric] || 0;
  svg += groupedBarPanel({
    x: 420, y: 72, width: 360, height: 300,
    title: "B. Accuracy to known exposures", subtitle: "Mean cosine similarity to archived true fractions",
    groups: ["0%", "5%", "10%"],
    series: tools.map((tool) => ({ label: toolLabels[tool].replace("SigProfilerAssignment", "SPA"), values: noiseLevels.map((noise) => summaryByNoiseTool(noise, tool, "meanExposureCosine")) })),
  });
  svg += groupedBarPanel({
    x: 810, y: 72, width: 360, height: 300,
    title: "C. Active-signature calls", subtitle: "Mean F1 versus all nonzero archived activities",
    groups: ["0%", "5%", "10%"],
    series: tools.map((tool) => ({ label: toolLabels[tool].replace("SigProfilerAssignment", "SPA"), values: noiseLevels.map((noise) => summaryByNoiseTool(noise, tool, "meanF1")) })),
  });
  const lowMidHigh = ["low", "middle", "high"];
  svg += groupedBarPanel({
    x: 30, y: 410, width: 1140, height: 340,
    title: "D. Reconstruction quality by observed mutation burden", subtitle: "Noise 0%; tertiles defined from the archived observed SBS counts (three samples per tertile)",
    groups: lowMidHigh,
    series: tools.map((tool) => ({ label: toolLabels[tool].replace("SigProfilerAssignment", "SPA"), values: lowMidHigh.map((burden) => burdenRows.find((row) => row.noisePercent === 0 && row.tool === tool && row.burdenTertile === burden)?.meanReconstructionCosine || 0) })),
  });
  svg += svgText(30, 778, "Source: Islam et al. 2022 synthetic signatures; archive and benchmark distributed with Díaz-Gay et al. 2023. This figure reports the executed 9-spectrum stratified subset, not the full 2,700-sample archive.", { size: 10, fill: "#526273" });
  svg += "</svg>";
  return svg;
}

const loaded = await Promise.all(noiseLevels.map(async (noise) => {
  const source = sourceForNoise(noise);
  const [input, truth, exposureArtifact] = await Promise.all([readJson(source.input), readJson(source.truth), readJson(source.exposures)]);
  return { noise, input, truth, exposureArtifact, source };
}));

const base = loaded[0];
const sampleNames = base.input.sampleNames;
const signatureNames = base.input.signatureNames;
const comparisonContract = createAdapterComparisonContract({
  contexts: base.input.contexts,
  signatureNames,
  cutoff,
  randomSeed: 104729,
});
const contexts = base.input.contexts;
const catalogFractions = Object.fromEntries(signatureNames.map((signature) => {
  const raw = contexts.map((context) => Number(base.input.signatures[signature]?.[context] || 0));
  return [signature, normalize(raw)];
}));
const observedBurden = Object.fromEntries(sampleNames.map((sample) => [sample, sum(vectorFromMap(base.input.spectra[sample], contexts))]));
const burdenTertile = burdenGroups(sampleNames, observedBurden);
const normalizedByNoiseTool = {};
const sampleRows = [];
const pairwiseSampleRows = [];
const summaryRows = [];
const burdenRows = [];
const signatureRows = [];

for (const entry of loaded) {
  const { noise, input, truth, exposureArtifact } = entry;
  normalizedByNoiseTool[noise] = {};
  for (const tool of tools) {
    normalizedByNoiseTool[noise][tool] = {};
    for (const sample of sampleNames) {
      normalizedByNoiseTool[noise][tool][sample] = filteredFractions(exposureArtifact.tools[tool]?.[sample], signatureNames);
    }
  }
  for (const sample of sampleNames) {
    const observed = normalize(vectorFromMap(input.spectra[sample], contexts));
    const truthFractions = vectorFromMap(truth.trueExposures[sample], signatureNames);
    const truthAtCutoff = filterTruth(truthFractions);
    const truthActiveAny = signatureNames.map((signature) => Number(truth.trueActivities[sample]?.[signature] || 0) > 0);
    for (const tool of tools) {
      const predicted = normalizedByNoiseTool[noise][tool][sample];
      const reconstructed = normalize(contexts.map((context, contextIndex) => sum(signatureNames.map((signature, signatureIndex) => catalogFractions[signature][contextIndex] * predicted[signatureIndex]))));
      const detection = f1Stats(predicted, truthActiveAny);
      sampleRows.push({
        noisePercent: noise,
        tool,
        toolLabel: toolLabels[tool],
        sample,
        cancerType: sample.split("::")[0],
        mutationBurden: sum(vectorFromMap(input.spectra[sample], contexts)),
        baselineMutationBurden: observedBurden[sample],
        burdenTertile: burdenTertile[sample],
        predictedActiveCount: predicted.filter((value) => value >= cutoff).length,
        truthActiveCountAny: truthActiveAny.filter(Boolean).length,
        truthActiveCountAtCutoff: truthFractions.filter((value) => value >= cutoff).length,
        exposureCosine: cosine(predicted, truthFractions),
        exposureCosineAtCutoff: cosine(predicted, truthAtCutoff),
        exposureRMSE: rmse(predicted, truthFractions),
        exposureMAE: mae(predicted, truthFractions),
        reconstructionCosine: cosine(reconstructed, observed),
        reconstructionRMSE: rmse(reconstructed, observed),
        ...detection,
      });
    }
    for (let left = 0; left < tools.length; left += 1) {
      for (let right = left + 1; right < tools.length; right += 1) {
        const toolA = tools[left];
        const toolB = tools[right];
        const a = normalizedByNoiseTool[noise][toolA][sample];
        const b = normalizedByNoiseTool[noise][toolB][sample];
        const activeA = a.map((value) => value >= cutoff);
        const activeB = b.map((value) => value >= cutoff);
        const intersection = activeA.reduce((count, active, index) => count + (active && activeB[index] ? 1 : 0), 0);
        const union = activeA.reduce((count, active, index) => count + (active || activeB[index] ? 1 : 0), 0);
        pairwiseSampleRows.push({
          noisePercent: noise,
          sample,
          cancerType: sample.split("::")[0],
          burdenTertile: burdenTertile[sample],
          toolA,
          toolB,
          exposurePearson: pearson(a, b),
          exposureCosine: cosine(a, b),
          exposureMAE: mae(a, b),
          activeJaccard: union ? intersection / union : 1,
          activeCountDifference: a.filter((value) => value >= cutoff).length - b.filter((value) => value >= cutoff).length,
        });
      }
    }
  }
}

for (const noise of noiseLevels) {
  for (const tool of tools) {
    const rows = sampleRows.filter((row) => row.noisePercent === noise && row.tool === tool);
    summaryRows.push({
      noisePercent: noise,
      tool,
      toolLabel: toolLabels[tool],
      sampleCount: rows.length,
      meanExposureCosine: rounded(mean(rows.map((row) => row.exposureCosine))),
      medianExposureCosine: rounded(median(rows.map((row) => row.exposureCosine))),
      meanExposureCosineAtCutoff: rounded(mean(rows.map((row) => row.exposureCosineAtCutoff))),
      meanExposureRMSE: rounded(mean(rows.map((row) => row.exposureRMSE))),
      meanExposureMAE: rounded(mean(rows.map((row) => row.exposureMAE))),
      meanReconstructionCosine: rounded(mean(rows.map((row) => row.reconstructionCosine))),
      meanReconstructionRMSE: rounded(mean(rows.map((row) => row.reconstructionRMSE))),
      meanPrecision: rounded(mean(rows.map((row) => row.precision))),
      meanRecall: rounded(mean(rows.map((row) => row.recall))),
      meanF1: rounded(mean(rows.map((row) => row.f1))),
      meanPredictedActiveCount: rounded(mean(rows.map((row) => row.predictedActiveCount))),
      meanTruthActiveCountAny: rounded(mean(rows.map((row) => row.truthActiveCountAny))),
      meanFalsePositiveCount: rounded(mean(rows.map((row) => row.falsePositiveCount))),
      meanFalseNegativeCount: rounded(mean(rows.map((row) => row.falseNegativeCount))),
    });
    for (const burden of ["low", "middle", "high"]) {
      const burdenSubset = rows.filter((row) => row.burdenTertile === burden);
      burdenRows.push({
        noisePercent: noise,
        tool,
        toolLabel: toolLabels[tool],
        burdenTertile: burden,
        sampleCount: burdenSubset.length,
        meanMutationBurden: rounded(mean(burdenSubset.map((row) => row.mutationBurden)), 2),
        meanExposureCosine: rounded(mean(burdenSubset.map((row) => row.exposureCosine))),
        meanExposureRMSE: rounded(mean(burdenSubset.map((row) => row.exposureRMSE))),
        meanReconstructionCosine: rounded(mean(burdenSubset.map((row) => row.reconstructionCosine))),
        meanF1: rounded(mean(burdenSubset.map((row) => row.f1))),
      });
    }
  }
}

const pairwiseRows = [];
for (const noise of noiseLevels) {
  for (let left = 0; left < tools.length; left += 1) {
    for (let right = left + 1; right < tools.length; right += 1) {
      const toolA = tools[left];
      const toolB = tools[right];
      const rows = pairwiseSampleRows.filter((row) => row.noisePercent === noise && row.toolA === toolA && row.toolB === toolB);
      pairwiseRows.push({
        noisePercent: noise,
        toolA,
        toolB,
        toolALabel: toolLabels[toolA],
        toolBLabel: toolLabels[toolB],
        sampleCount: rows.length,
        exposurePearson: rounded(pearson(rows.flatMap((row) => normalizedByNoiseTool[noise][toolA][row.sample]), rows.flatMap((row) => normalizedByNoiseTool[noise][toolB][row.sample]))),
        meanExposureCosine: rounded(mean(rows.map((row) => row.exposureCosine))),
        medianExposureMAE: rounded(median(rows.map((row) => row.exposureMAE))),
        meanActiveJaccard: rounded(mean(rows.map((row) => row.activeJaccard))),
        meanActiveCountDifference: rounded(mean(rows.map((row) => Math.abs(row.activeCountDifference))), 2),
      });
    }
  }
}

for (const noise of noiseLevels) {
  const entry = loaded.find((item) => item.noise === noise);
  for (const signature of signatureNames) {
    const truthValues = sampleNames.map((sample) => Number(entry.truth.trueExposures[sample]?.[signature] || 0));
    const toolValues = Object.fromEntries(tools.map((tool) => [tool, sampleNames.map((sample) => normalizedByNoiseTool[noise][tool][sample][signatureNames.indexOf(signature)])]));
    const ranges = sampleNames.map((sample, sampleIndex) => {
      const values = tools.map((tool) => toolValues[tool][sampleIndex]);
      return Math.max(...values) - Math.min(...values);
    });
    const absoluteErrors = tools.flatMap((tool) => toolValues[tool].map((value, index) => Math.abs(value - truthValues[index])));
    const truthActiveAny = sampleNames.map((sample) => Number(entry.truth.trueActivities[sample]?.[signature] || 0) > 0);
    const falsePositiveRate = mean(tools.flatMap((tool) => toolValues[tool].map((value, index) => value >= cutoff && !truthActiveAny[index] ? 1 : 0)));
    const falseNegativeRate = mean(tools.flatMap((tool) => toolValues[tool].map((value, index) => value < cutoff && truthActiveAny[index] ? 1 : 0)));
    signatureRows.push({
      noisePercent: noise,
      signature,
      meanCrossToolRange: rounded(mean(ranges)),
      maxCrossToolRange: rounded(Math.max(...ranges)),
      meanToolAbsoluteError: rounded(mean(absoluteErrors)),
      falsePositiveRate: rounded(falsePositiveRate),
      falseNegativeRate: rounded(falseNegativeRate),
      topDiscrepancyRank: null,
    });
  }
}
for (const noise of noiseLevels) {
  const ranked = signatureRows.filter((row) => row.noisePercent === noise).sort((a, b) => b.meanCrossToolRange - a.meanCrossToolRange);
  ranked.forEach((row, index) => { row.topDiscrepancyRank = index + 1; });
}

await mkdir(outputDir, { recursive: true });
await mkdir(figureDir, { recursive: true });
await writeCsv(path.join(outputDir, "published-synthetic-sample-metrics.csv"), sampleRows);
await writeCsv(path.join(outputDir, "published-pairwise-sample-metrics.csv"), pairwiseSampleRows);
await writeCsv(path.join(outputDir, "published-synthetic-benchmark-summary.csv"), summaryRows);
await writeCsv(path.join(outputDir, "published-synthetic-benchmark-by-burden.csv"), burdenRows);
await writeCsv(path.join(outputDir, "published-pairwise-comparison.csv"), pairwiseRows);
await writeCsv(path.join(outputDir, "published-signature-discrepancies.csv"), signatureRows);

const provenance = {
  schemaVersion: "msig.manuscript.e7.published-synthetic-benchmark.v1",
  generatedAt: new Date().toISOString(),
  source: {
    generatorPaper: "Islam et al. 2022, Cell Genomics, DOI 10.1016/j.xgen.2022.100179",
    generatorPaperUrl: "https://pubmed.ncbi.nlm.nih.gov/36388765/",
    benchmarkPaper: "Díaz-Gay et al. 2023, Bioinformatics, DOI 10.1093/bioinformatics/btad756",
    benchmarkPaperUrl: "https://academic.oup.com/bioinformatics/article/39/12/btad756/7473371",
    archive: "Figshare DOI 10.6084/m9.figshare.24457114.v1",
    archiveUrl: "https://doi.org/10.6084/m9.figshare.24457114.v1",
    archiveSha256,
    license: "CC BY 4.0",
    dataset: "Published SBS synthetic benchmark: 2,700 spectra, 300 per each of nine cancer types, generated from 21 COSMIC reference signatures; archived COSMIC v3.3 GRCh37 SBS catalog shape contains 78 signature columns.",
  },
  subset: {
    sampleCount: sampleNames.length,
    cancerTypeCount: new Set(sampleNames.map((sample) => sample.split("::")[0])).size,
    samplesPerCancerType: 1,
    method: "First sample ID in each cancer-type group after grouping the archived sample names by the prefix before ::.",
    sourceSamples: 2700,
    noiseLevelsPercent: noiseLevels,
  },
  adapters: {
    tools,
    rawOutputUnits: {
      deconstructsigs: "relative fractions",
      sigminer: "relative fractions",
      sigprofilerassignment: "relative fractions",
      musical: "absolute mutation-count exposures",
    },
    runtime: "local adapters; browser adapters skipped because the WebR deconstructSigs process did not advance within the bounded runtime test",
    packageVersions: {
      deconstructsigs: "deconstructSigs 1.8.0",
      sigminer: "sigminer 2.3.1; nnls 1.6",
      sigprofilerassignment: "SigProfilerAssignment 1.1.3; SigProfilerMatrixGenerator 1.3.6; sigProfilerPlotting 1.4.3",
      musical: "MuSiCal 1.0.0",
    },
  },
  harmonization: {
    comparisonContract,
    contextOrder: base.input.contexts,
    catalog: "All 78 archived catalog columns passed to every adapter; each catalog column was normalized to sum to one before reconstruction metrics.",
    exposureUnits: "All adapter outputs converted to relative fractions by dividing each sample's complete 78-signature vector by its positive total.",
    filtering: `Common post-fit activity cutoff of ${cutoff}; values below the cutoff set to zero, followed by renormalization; no package-specific sparsity threshold was added by this analysis.`,
    inactiveSignatures: "Complete 78-signature output vectors retained; missing or inactive signatures represented as zero.",
    numericalTolerance: "Values are treated as zero only through the explicit 1% activity rule; metric calculations retain full floating-point output before reporting rounding.",
    activeSignatureDefinition: "Predicted active if harmonized fraction >= 0.01; archived truth active if the published true activity is > 0.",
    reconstructionMetric: "Cosine similarity between the observed normalized SBS96 spectrum and the normalized spectrum reconstructed from the harmonized exposure fractions and normalized catalog.",
    burdenDefinition: "Observed SBS mutation counts in the noise-free archive input; low/middle/high tertiles contain three of the nine spectra each and are held fixed across noise levels.",
  },
  outputs: {
    sampleMetrics: "published-synthetic-sample-metrics.csv",
    pairwiseSampleMetrics: "published-pairwise-sample-metrics.csv",
    summary: "published-synthetic-benchmark-summary.csv",
    burden: "published-synthetic-benchmark-by-burden.csv",
    pairwise: "published-pairwise-comparison.csv",
    signatureDiscrepancies: "published-signature-discrepancies.csv",
    figure: "../figures/figure-e7-published-synthetic-benchmark.svg",
  },
};
await writeFile(path.join(outputDir, "published-synthetic-benchmark-provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
await writeFile(path.join(figureDir, "figure-e7-published-synthetic-benchmark.svg"), createFigure({ summaryRows, pairwiseRows, burdenRows }));
await writeFile(path.join(outputDir, "published-synthetic-benchmark-results.json"), `${JSON.stringify({ provenance, summaryRows, burdenRows, pairwiseRows, signatureRows }, null, 2)}\n`);

console.log(JSON.stringify({
  status: "completed",
  sampleCount: sampleNames.length,
  cancerTypeCount: new Set(sampleNames.map((sample) => sample.split("::")[0])).size,
  tools,
  noiseLevels,
  cutoff,
  summaryRows: summaryRows.length,
  pairwiseRows: pairwiseRows.length,
  topDiscrepancies: signatureRows.filter((row) => row.noisePercent === 0).sort((a, b) => a.topDiscrepancyRank - b.topDiscrepancyRank).slice(0, 5).map((row) => ({ signature: row.signature, meanCrossToolRange: row.meanCrossToolRange })),
}, null, 2));
