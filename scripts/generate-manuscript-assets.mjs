#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  bootstrapSignatureFit,
  calculateReconstructionError,
  fitSpectraWithNNLS,
  runThresholdSensitivity,
  summarizeMutationBurden,
} from "../mSigSDKScripts/qc.js";
import { getExpectedContexts } from "../mSigSDKScripts/validation.js";
import { normalizeVector, seededRandom, sum } from "../mSigSDKScripts/numerics.js";

const MANUSCRIPT_DIR = "docs/manuscript";
const FIGURE_DIR = join(MANUSCRIPT_DIR, "figures");
const TABLE_DIR = join(MANUSCRIPT_DIR, "tables");
const BENCHMARK_JSON = join(MANUSCRIPT_DIR, "benchmark-results.json");

const COLORS = {
  ink: "#182033",
  muted: "#667085",
  faint: "#EEF2F6",
  line: "#D6DEE8",
  blue: "#2F80ED",
  teal: "#008C95",
  green: "#27AE60",
  orange: "#F2994A",
  red: "#D95F02",
  purple: "#7B61FF",
  white: "#FFFFFF",
};

const HARDWARE_NOTE =
  "Windows x64; Node.js v16.16.0; Intel Core i7-11700K, 8 cores/16 logical processors; 16 GB RAM; mSigSDK 0.1.0.";

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function attrs(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => ` ${key}="${esc(value)}"`)
    .join("");
}

function svg(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#182033" flood-opacity="0.10"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  ${body}
</svg>
`;
}

function rect(x, y, width, height, options = {}) {
  return `<rect${attrs({
    x,
    y,
    width,
    height,
    rx: options.rx ?? 10,
    fill: options.fill ?? COLORS.white,
    stroke: options.stroke ?? COLORS.line,
    "stroke-width": options.strokeWidth ?? 2,
    opacity: options.opacity,
    filter: options.shadow ? "url(#softShadow)" : undefined,
  })}/>`;
}

function line(x1, y1, x2, y2, options = {}) {
  return `<line${attrs({
    x1,
    y1,
    x2,
    y2,
    stroke: options.stroke ?? COLORS.line,
    "stroke-width": options.strokeWidth ?? 2,
    "stroke-dasharray": options.dash,
    opacity: options.opacity,
  })}/>`;
}

function circle(cx, cy, r, options = {}) {
  return `<circle${attrs({
    cx,
    cy,
    r,
    fill: options.fill ?? COLORS.white,
    stroke: options.stroke,
    "stroke-width": options.strokeWidth,
  })}/>`;
}

function text(content, x, y, options = {}) {
  return `<text${attrs({
    x,
    y,
    fill: options.fill ?? COLORS.ink,
    "font-family": "Inter, Helvetica, Arial, sans-serif",
    "font-size": options.size ?? 20,
    "font-weight": options.weight ?? 400,
    "text-anchor": options.anchor,
    "dominant-baseline": options.baseline,
  })}>${esc(content)}</text>`;
}

function wrapText(content, x, y, maxChars, options = {}) {
  const words = String(content).split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }

  const lineHeight = options.lineHeight ?? (options.size ?? 20) * 1.25;
  return lines
    .map((lineText, index) =>
      text(lineText, x, y + index * lineHeight, {
        ...options,
        size: options.size ?? 20,
      })
    )
    .join("\n");
}

function axis(x, y, width, height) {
  return `${line(x, y + height, x + width, y + height, { stroke: COLORS.ink })}
${line(x, y, x, y + height, { stroke: COLORS.ink })}`;
}

function panelLabel(label, x, y) {
  return `${circle(x, y, 20, { fill: COLORS.ink })}${text(label, x, y + 1, {
    fill: COLORS.white,
    size: 19,
    weight: 800,
    anchor: "middle",
    baseline: "middle",
  })}`;
}

function polyline(points, options = {}) {
  return `<polyline${attrs({
    points: points.map(([x, y]) => `${x},${y}`).join(" "),
    fill: "none",
    stroke: options.stroke ?? COLORS.blue,
    "stroke-width": options.strokeWidth ?? 4,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  })}/>`;
}

function average(values) {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "NA";
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((value) => String(value ?? "")).join(" | ")} |`),
  ].join("\n");
}

async function readBenchmarkRows() {
  const payload = JSON.parse(await readFile(BENCHMARK_JSON, "utf8"));
  return payload.rows;
}

function rowsByOperation(rows, operation) {
  return rows
    .filter((row) => row.operation === operation)
    .sort((a, b) => Number(a.samples) - Number(b.samples));
}

function createBenchmarkSummaryRows(rows) {
  const operations = [
    ["validation_qc", "Validation and burden/context QC"],
    ["nnls_fit", "NNLS fit"],
    ["reconstruction_metrics", "Reconstruction metrics"],
    ["threshold_sensitivity", "Threshold sensitivity, 5 thresholds"],
    ["bootstrap_one_sample", "Bootstrap, one sample, 100 iterations"],
    ["bootstrap_one_sample", "Bootstrap, one sample, 500 iterations"],
    ["nmf_rank_selection", "NMF rank selection, ranks 2-4"],
    ["nmf_extract_recommended_rank", "NMF extraction, recommended rank"],
  ];

  return operations.flatMap(([operation, label]) => {
    let selected = rows.filter((row) => row.operation === operation);
    if (label.includes("100 iterations")) {
      selected = selected.filter((row) => row.iterations === 100);
    }
    if (label.includes("500 iterations")) {
      selected = selected.filter((row) => row.iterations === 500);
    }
    if (operation.startsWith("nmf")) {
      selected = selected.filter((row) => row.samples === 10 || row.samples === 100);
    } else {
      selected = selected.filter((row) => row.samples === 10 || row.samples === 100 || row.samples === 1000);
    }

    return selected
      .sort((a, b) => Number(a.samples) - Number(b.samples))
      .map((row) => [
        label,
        row.samples,
        row.contexts,
        row.signatures || "NA",
        row.iterations || "NA",
        Array.isArray(row.thresholds) ? row.thresholds.join(", ") : "NA",
        Array.isArray(row.ranks) ? row.ranks.join(", ") : "NA",
        formatNumber(row.runtimeMs, 1),
        formatNumber(row.heapAfterMB, 2),
        formatNumber(row.rssAfterMB, 2),
      ]);
  });
}

function makeSignatureVector(contexts, phase, concentration) {
  const raw = contexts.map((_, index) => {
    const wave = Math.abs(Math.sin((index + 1) * phase));
    const blockBoost = Math.floor(index / 16) === concentration ? 1.8 : 0.25;
    return 0.05 + wave + blockBoost;
  });
  return normalizeVector(raw, 1);
}

function makeControlledSignatures(contexts) {
  const specs = [
    ["SBS1", 0.13, 2],
    ["SBS4", 0.21, 0],
    ["SBS5", 0.31, 4],
    ["SBS40", 0.43, 5],
  ];

  return Object.fromEntries(
    specs.map(([signature, phase, concentration]) => {
      const vector = makeSignatureVector(contexts, phase, concentration);
      return [signature, Object.fromEntries(contexts.map((context, index) => [context, vector[index]]))];
    })
  );
}

function multinomialCounts(total, probabilities, random) {
  const cumulative = [];
  let running = 0;
  for (const probability of probabilities) {
    running += probability;
    cumulative.push(running);
  }

  const counts = Array(probabilities.length).fill(0);
  for (let drawIndex = 0; drawIndex < total; drawIndex++) {
    const draw = random();
    const index = cumulative.findIndex((value) => draw <= value);
    counts[index === -1 ? counts.length - 1 : index] += 1;
  }
  return counts;
}

function mixtureProbabilities(signatures, contexts, exposure) {
  const probabilities = contexts.map((context) =>
    Object.entries(exposure).reduce(
      (total, [signatureName, weight]) =>
        total + weight * (signatures[signatureName][context] || 0),
      0
    )
  );
  return normalizeVector(probabilities, 1);
}

function createLowBurdenSpectra(signatures, contexts, burden, replicateCount, seed) {
  const random = seededRandom(seed);
  const exposure = {
    SBS1: 0.42,
    SBS4: 0.28,
    SBS5: 0.22,
    SBS40: 0.08,
  };
  const probabilities = mixtureProbabilities(signatures, contexts, exposure);

  return Object.fromEntries(
    Array.from({ length: replicateCount }, (_, index) => {
      const counts = multinomialCounts(burden, probabilities, random);
      return [
        `burden_${burden}_${String(index + 1).padStart(2, "0")}`,
        Object.fromEntries(contexts.map((context, contextIndex) => [context, counts[contextIndex]])),
      ];
    })
  );
}

async function runLowBurdenStressTest() {
  const contexts = getExpectedContexts({ profile: "SBS", matrix: 96 });
  const signatures = makeControlledSignatures(contexts);
  const burdens = [50, 100, 250, 500, 1000];
  const rows = [];

  for (const burden of burdens) {
    const spectra = createLowBurdenSpectra(signatures, contexts, burden, 8, 7000 + burden);
    const burdenSummary = summarizeMutationBurden(spectra, {
      expectedContexts: contexts,
      lowBurdenThreshold: 100,
      lowBurdenThresholdMode: "fixed",
    });
    const exposures = await fitSpectraWithNNLS(signatures, spectra, {
      contexts,
      exposureThreshold: 0.03,
      exposureType: "relative",
      renormalize: true,
    });
    const reconstruction = calculateReconstructionError(signatures, spectra, exposures, {
      contexts,
      normalizeMode: "relative",
    });
    const thresholdSensitivity = await runThresholdSensitivity(signatures, spectra, {
      contexts,
      thresholds: [0, 0.01, 0.03, 0.05, 0.1],
      exposureType: "relative",
      renormalize: true,
    });
    const representativeSample = Object.keys(spectra)[0];
    const bootstrap = await bootstrapSignatureFit(signatures, spectra[representativeSample], {
      contexts,
      iterations: 100,
      exposureThreshold: 0.03,
      exposureType: "relative",
      renormalize: true,
      seed: 9000 + burden,
    });
    const trueActiveNames = ["SBS1", "SBS4", "SBS5", "SBS40"];
    const bootstrapWidths = bootstrap.signatures
      .filter((signature) => trueActiveNames.includes(signature.signatureName))
      .map((signature) => signature.upper - signature.lower);
    const activeCounts = Object.values(exposures).map(
      (row) => Object.values(row).filter((value) => value > 0).length
    );
    const thresholdCosineRange =
      Math.max(...thresholdSensitivity.runs.map((run) => run.averageCosineSimilarity)) -
      Math.min(...thresholdSensitivity.runs.map((run) => run.averageCosineSimilarity));

    rows.push({
      burden,
      samples: Object.keys(spectra).length,
      lowBurdenFlagged: burdenSummary.overall.lowBurdenSampleCount,
      averageCosineSimilarity: average(
        reconstruction.samples.map((sample) => sample.cosineSimilarity)
      ),
      averageRmse: average(reconstruction.samples.map((sample) => sample.rmse)),
      averageActiveSignatures: average(activeCounts),
      averageBootstrapCiWidth: average(bootstrapWidths),
      thresholdCosineRange,
    });
  }

  return rows;
}

function makeFigure4(benchmarkRows, lowBurdenRows) {
  const width = 1800;
  const height = 1240;
  const runtimePanel = { x: 115, y: 280, width: 670, height: 260 };
  const lowPanel = { x: 980, y: 280, width: 610, height: 260 };
  const nnls = rowsByOperation(benchmarkRows, "nnls_fit");
  const threshold = rowsByOperation(benchmarkRows, "threshold_sensitivity");
  const nmf = rowsByOperation(benchmarkRows, "nmf_rank_selection");
  const maxSeconds = Math.max(
    ...nnls.map((row) => row.runtimeMs / 1000),
    ...threshold.map((row) => row.runtimeMs / 1000),
    ...nmf.map((row) => row.runtimeMs / 1000)
  );
  const sampleToX = (sample) => {
    const positions = { 10: 0, 100: 0.33, 500: 0.67, 1000: 1 };
    return runtimePanel.x + (positions[sample] ?? 0) * runtimePanel.width;
  };
  const secondsToY = (seconds) =>
    runtimePanel.y + runtimePanel.height - (seconds / maxSeconds) * runtimePanel.height;
  const lineFor = (rows, color) =>
    `${polyline(
      rows
        .filter((row) => [10, 100, 500, 1000].includes(row.samples))
        .map((row) => [sampleToX(row.samples), secondsToY(row.runtimeMs / 1000)]),
      { stroke: color }
    )}
    ${rows
      .filter((row) => [10, 100, 500, 1000].includes(row.samples))
      .map((row) =>
        circle(sampleToX(row.samples), secondsToY(row.runtimeMs / 1000), 7, {
          fill: color,
          stroke: COLORS.white,
          strokeWidth: 3,
        })
      )
      .join("\n")}`;

  const burdenX = (burden) => {
    const positions = { 50: 0, 100: 0.22, 250: 0.46, 500: 0.72, 1000: 1 };
    return lowPanel.x + (positions[burden] ?? 0) * lowPanel.width;
  };
  const maxCi = Math.max(...lowBurdenRows.map((row) => row.averageBootstrapCiWidth));
  const ciY = (value) => lowPanel.y + lowPanel.height - (value / maxCi) * lowPanel.height;
  const cosineY = (value) => lowPanel.y + lowPanel.height - value * lowPanel.height;

  const body = `
  ${text("Runtime scaling and low-burden stress test", 90, 78, { size: 42, weight: 850 })}
  ${wrapText("Compute benchmarks quantify browser-suitable analysis costs, while the controlled low-burden stress test illustrates why mutation count, bootstrap uncertainty, and threshold sensitivity must accompany exposure interpretation.", 90, 120, 118, { size: 22, fill: COLORS.muted })}

  ${panelLabel("A", 90, 215)}
  ${text("Core compute scaling", 130, 223, { size: 28, weight: 850 })}
  ${rect(90, 255, 770, 410, { rx: 18, shadow: true })}
  ${axis(runtimePanel.x, runtimePanel.y, runtimePanel.width, runtimePanel.height)}
  ${lineFor(nnls, COLORS.blue)}
  ${lineFor(threshold, COLORS.orange)}
  ${lineFor(nmf, COLORS.purple)}
  ${[10, 100, 500, 1000]
    .map((sample) => text(String(sample), sampleToX(sample), 575, { size: 16, fill: COLORS.muted, anchor: "middle" }))
    .join("\n")}
  ${text("samples", 450, 620, { size: 18, fill: COLORS.muted, anchor: "middle" })}
  ${text("runtime, seconds", 105, 265, { size: 17, fill: COLORS.muted })}
  ${circle(610, 312, 7, { fill: COLORS.blue })}${text("NNLS fit", 625, 318, { size: 16, fill: COLORS.muted })}
  ${circle(610, 342, 7, { fill: COLORS.orange })}${text("threshold sweep", 625, 348, { size: 16, fill: COLORS.muted })}
  ${circle(610, 372, 7, { fill: COLORS.purple })}${text("NMF rank selection", 625, 378, { size: 16, fill: COLORS.muted })}

  ${panelLabel("B", 950, 215)}
  ${text("Low mutation burden instability", 990, 223, { size: 28, weight: 850 })}
  ${rect(950, 255, 760, 410, { rx: 18, shadow: true })}
  ${axis(lowPanel.x, lowPanel.y, lowPanel.width, lowPanel.height)}
  ${polyline(lowBurdenRows.map((row) => [burdenX(row.burden), ciY(row.averageBootstrapCiWidth)]), { stroke: COLORS.red })}
  ${polyline(lowBurdenRows.map((row) => [burdenX(row.burden), cosineY(row.averageCosineSimilarity)]), { stroke: COLORS.teal })}
  ${lowBurdenRows
    .map((row) => `${circle(burdenX(row.burden), ciY(row.averageBootstrapCiWidth), 7, { fill: COLORS.red, stroke: COLORS.white, strokeWidth: 3 })}
      ${circle(burdenX(row.burden), cosineY(row.averageCosineSimilarity), 7, { fill: COLORS.teal, stroke: COLORS.white, strokeWidth: 3 })}`)
    .join("\n")}
  ${[50, 100, 250, 500, 1000]
    .map((burden) => text(String(burden), burdenX(burden), 575, { size: 16, fill: COLORS.muted, anchor: "middle" }))
    .join("\n")}
  ${text("mutations per sample", 1290, 620, { size: 18, fill: COLORS.muted, anchor: "middle" })}
  ${circle(1445, 312, 7, { fill: COLORS.red })}${text("bootstrap CI width", 1460, 318, { size: 16, fill: COLORS.muted })}
  ${circle(1445, 342, 7, { fill: COLORS.teal })}${text("reconstruction cosine", 1460, 348, { size: 16, fill: COLORS.muted })}

  ${panelLabel("C", 90, 745)}
  ${text("Benchmark summary at 100 samples", 130, 753, { size: 28, weight: 850 })}
  ${rect(90, 785, 770, 315, { rx: 18, shadow: true })}
  ${[
    ["NNLS fit", nnls.find((row) => row.samples === 100)?.runtimeMs / 1000, COLORS.blue],
    ["Threshold sweep", threshold.find((row) => row.samples === 100)?.runtimeMs / 1000, COLORS.orange],
    ["Bootstrap x500", benchmarkRows.find((row) => row.operation === "bootstrap_one_sample" && row.samples === 100 && row.iterations === 500)?.runtimeMs / 1000, COLORS.green],
    ["NMF rank selection", nmf.find((row) => row.samples === 100)?.runtimeMs / 1000, COLORS.purple],
  ]
    .map(([label, seconds, color], index) => {
      const x = 150 + index * 170;
      const h = Math.max(8, seconds * 24);
      return `${rect(x, 1030 - h, 105, h, { fill: color, stroke: "none", rx: 6 })}
        ${text(formatNumber(seconds, 1) + " s", x + 52, 1012 - h, { size: 17, weight: 800, anchor: "middle", fill: color })}
        ${wrapText(label, x + 52, 1065, 13, { size: 15, fill: COLORS.muted, anchor: "middle", lineHeight: 18 })}`;
    })
    .join("\n")}

  ${panelLabel("D", 950, 745)}
  ${text("Submission interpretation", 990, 753, { size: 28, weight: 850 })}
  ${rect(950, 785, 760, 315, { rx: 18, shadow: true })}
  ${wrapText("The benchmark table supports moderate browser workflows: fitting and QC scale to hundreds of SBS96 spectra, but threshold sweeps, bootstrap analyses, and NMF rank selection require explicit runtime reporting. The low-burden stress test should be reported as controlled evidence; a real rare-cancer case study remains the preferred final validation.", 990, 850, 68, { size: 22, fill: COLORS.muted })}

  ${text("Environment: ${HARDWARE_NOTE}", 90, 1165, { size: 18, fill: COLORS.muted })}
  `;

  return svg(width, height, body);
}

async function writeTables(benchmarkRows, lowBurdenRows) {
  const table1 = `# Table 1. Execution locus and privacy boundary

${markdownTable(
  ["Capability", "Local browser computation", "External dependency", "Privacy implication"],
  [
    ["Reference signature retrieval", "No", "mSigPortal API", "Public reference data only"],
    ["Public cohort exploration", "Partial", "mSigPortal or TCGA/GDC APIs", "Uses public or portal-hosted data"],
    ["User MAF/spectrum validation", "Yes", "None", "User data can remain local"],
    ["Mutation burden and context coverage QC", "Yes", "None", "Local"],
    ["NNLS known-signature fitting", "Yes", "Optional API retrieval of reference signatures", "User spectra can remain local"],
    ["Observed/reconstructed residuals", "Yes", "None", "Local"],
    ["Bootstrap exposure intervals", "Yes", "None", "Local; runtime scales with iterations"],
    ["Threshold sensitivity", "Yes", "None", "Local; runtime scales with threshold grid"],
    ["Exploratory NMF extraction", "Yes", "None", "Local; intended for moderate datasets"],
    ["Mutational spectrum rendering", "Yes", "mSigPortal/COSMIC-style plotting components", "Local rendering of supplied data"],
    ["Import/export, reports, provenance", "Yes", "None", "Local unless user exports/shares"],
  ]
)}
`;

  const table2 = `# Table 2. Manuscript workflow evidence provided by the revised SDK

${markdownTable(
  ["Workflow", "SDK namespaces", "Primary result to report", "Manuscript figure/table"],
  [
    ["Architecture and privacy boundary", "`mSigPortal`, `TCGA`, `validation`, `qc`, `reports`", "Clear separation of public API access from local user-data analysis", "Figure 1; Table 1"],
    ["Known-signature fitting", "`signatureFitting`, `qc`", "Local NNLS exposure estimates with explicit thresholding", "Figure 2; Table 1"],
    ["Fitting QC", "`validation`, `qc`, `qcPlots`", "Mutation burden, missing contexts, reconstruction quality, residual spectra", "Figure 2"],
    ["Uncertainty analysis", "`qc`, `qcPlots`", "Bootstrap confidence intervals and selection frequency", "Figure 2"],
    ["Threshold sensitivity", "`qc`, `qcPlots`", "Exposure-call robustness across user-defined thresholds", "Figure 2; Figure 4"],
    ["Exploratory extraction", "`signatureExtraction`, `signatureExtractionPlots`", "Browser-side NMF with rank diagnostics and reference matching", "Figure 3; Figure 4"],
    ["Interoperability/reporting", "`io`, `reports`, `provenance`, `workflows`", "SigProfiler/COSMIC-style matrix round trips, structured reports, provenance", "Supplementary Table S1/S2"],
  ]
)}
`;

  const table3 = `# Table 3. Core compute benchmark results

${markdownTable(
  [
    "Operation",
    "Samples",
    "Contexts",
    "Signatures",
    "Iterations",
    "Thresholds",
    "Ranks",
    "Runtime ms",
    "Heap after MB",
    "RSS after MB",
  ],
  createBenchmarkSummaryRows(benchmarkRows)
)}

Benchmark environment: ${HARDWARE_NOTE}

Memory values are process-level Node.js estimates and should be reported as approximate. Browser rendering time and browser heap measurements still need to be collected separately.
`;

  const table4 = `# Table 4. Functional comparison with related mutational-signature tools

${markdownTable(
  [
    "Tool/platform",
    "Primary role",
    "Browser SDK",
    "Local user-data fitting",
    "De novo extraction",
    "QC/uncertainty helpers",
    "Report/provenance helpers",
    "Positioning relative to mSigSDK",
  ],
  [
    ["mSigPortal", "Web portal and API for mutational-signature resources", "No", "Portal/API dependent", "Server-side/portal workflow", "Portal-specific", "No SDK report object", "mSigSDK reuses public resources and plotting conventions while adding browser SDK workflows"],
    ["SigProfilerExtractor", "Production de novo extraction and decomposition pipeline", "No", "Yes, local Python workflow", "Yes", "Pipeline diagnostics", "External workflow dependent", "Complementary production extraction tool; mSigSDK is lighter browser/report layer"],
    ["SigProfilerAssignment", "Signature attribution/decomposition", "No", "Yes, local Python workflow", "No", "Assignment diagnostics", "External workflow dependent", "Complementary assignment pipeline"],
    ["MutationalPatterns", "R/Bioconductor analysis and visualization toolkit", "No", "Yes, local R workflow", "Yes/associated workflows", "Yes", "External workflow dependent", "Complementary R workflow; mSigSDK targets web-native integration"],
    ["deconstructSigs", "R package for known-signature decomposition", "No", "Yes, local R workflow", "No", "Limited compared with modern QC workflows", "No", "Established fitting comparator; mSigSDK adds browser-native QC/report modules"],
    ["General AI genomic visualization platforms", "Broad exploratory visualization or assistant interfaces", "Varies", "Task-dependent", "Usually not same-task public benchmark", "Task-dependent", "Task-dependent", "Do not benchmark unless a specific same-task, reproducible tool is selected"],
  ]
)}
`;

  const tableS1 = `# Supplementary Table S1. SDK namespaces and representative functions

${markdownTable(
  ["Namespace", "Representative functions", "Role", "Execution locus"],
  [
    ["`mSigSDK.mSigPortal.mSigPortalData`", "`getMutationalSpectrumData`, `getMutationalSignaturesData`", "mSigPortal data access", "API retrieval"],
    ["`mSigSDK.mSigPortal.mSigPortalPlots`", "SBS/DBS/ID/RS profile and comparison plots", "Domain-standard visualization", "Local rendering"],
    ["`mSigSDK.TCGA`", "GDC/TCGA helper functions", "Public cancer-genomics integration", "API retrieval plus local conversion"],
    ["`mSigSDK.validation`", "`validateSpectra`, `validateSignatureMatrix`, `getExpectedContexts`", "Matrix validation and expected context checks", "Local"],
    ["`mSigSDK.qc`", "`fitSpectraWithNNLS`, `calculateReconstructionError`, `bootstrapSignatureFit`, `runThresholdSensitivity`", "Fitting, QC, uncertainty, sensitivity", "Local"],
    ["`mSigSDK.qcPlots`", "Burden, reconstruction, residual, bootstrap, threshold plots", "QC visualization", "Local rendering"],
    ["`mSigSDK.signatureExtraction`", "`extractSignaturesNMF`, `selectNMFRank`, `compareExtractedToReference`", "Exploratory NMF extraction", "Local/optional Web Worker"],
    ["`mSigSDK.signatureExtractionPlots`", "NMF profiles, exposure heatmap, rank plots", "NMF visualization", "Local rendering"],
    ["`mSigSDK.io`", "`importSigProfilerMatrix`, `exportCOSMICSignatureMatrix`", "Interoperability", "Local"],
    ["`mSigSDK.reports` / `provenance` / `workflows`", "`createAnalysisReport`, `createProvenance`, workflow helpers", "Auditable reports and reusable analysis recipes", "Local plus optional API-provided references"],
  ]
)}
`;

  const tableS2 = `# Supplementary Table S2. Focused executable notebooks

${markdownTable(
  ["Notebook", "Workflow demonstrated", "Manuscript use"],
  [
    ["`notebooks/msig-sdk-notebooks.onb.html`", "Notebook index", "Supplementary reproducibility entry point"],
    ["`notebooks/msig-sdk-qc-walkthrough.onb.html`", "Known-signature fitting QC", "Supports Figure 2 workflow"],
    ["`notebooks/msig-sdk-uncertainty-thresholds.onb.html`", "Bootstrap intervals and threshold sensitivity", "Supports Figure 2 and rare/low-burden interpretation"],
    ["`notebooks/msig-sdk-nmf-extraction.onb.html`", "Browser-sized NMF extraction and rank diagnostics", "Supports Figure 3 workflow"],
    ["`notebooks/msig-sdk-export-report.onb.html`", "Import/export, reports, provenance, workflow helpers", "Supports software availability and interoperability claims"],
  ]
)}
`;

  const tableS3 = `# Supplementary Table S3. Controlled low-burden stress test

${markdownTable(
  [
    "Mutations/sample",
    "Samples",
    "Low-burden flagged",
    "Mean cosine similarity",
    "Mean RMSE",
    "Mean active signatures",
    "Mean bootstrap CI width",
    "Threshold cosine range",
  ],
  lowBurdenRows.map((row) => [
    row.burden,
    row.samples,
    row.lowBurdenFlagged,
    formatNumber(row.averageCosineSimilarity, 3),
    formatNumber(row.averageRmse, 4),
    formatNumber(row.averageActiveSignatures, 2),
    formatNumber(row.averageBootstrapCiWidth, 3),
    formatNumber(row.thresholdCosineRange, 4),
  ])
)}

This is a controlled simulation/downsampling-style stress test. It should be described as evidence for low-mutation-count instability, not as a substitute for a real rare-tumor validation cohort.
`;

  const tableFiles = [
    ["table1-execution-locus.md", table1],
    ["table2-workflow-evidence.md", table2],
    ["table3-compute-benchmarks.md", table3],
    ["table4-related-software-comparison.md", table4],
    ["tableS1-sdk-namespaces.md", tableS1],
    ["tableS2-notebook-workflows.md", tableS2],
    ["tableS3-low-burden-stress-test.md", tableS3],
  ];

  await mkdir(TABLE_DIR, { recursive: true });
  for (const [filename, content] of tableFiles) {
    await writeFile(join(TABLE_DIR, filename), `${content.trim()}\n`);
  }

  return tableFiles.map(([filename]) => filename);
}

function makeCompletionPlan() {
  return `# Revised Manuscript Completion Plan

This file is the control sheet for the revised BMC Bioinformatics submission. It separates results that are already supported by the current SDK from analyses that still need to be completed before submission.

## Completed Or Manuscript-Ready Assets

1. **Architecture/privacy boundary:** Figure 1 and Table 1 show which operations use public APIs and which run locally.
2. **Known-signature fitting/QC workflow:** Figure 2 and the focused QC notebook show validation, local NNLS fitting, burden checks, reconstruction metrics, residuals, bootstrap intervals, and threshold sensitivity.
3. **Exploratory NMF workflow:** Figure 3 shows browser-side NMF extraction, rank diagnostics, reference matching, and exposure heatmaps.
4. **Core compute benchmark:** Table 3 and Figure 4 summarize Node.js compute benchmarks for validation, NNLS fitting, reconstruction metrics, threshold sensitivity, bootstrap, and NMF.
5. **Controlled low-burden stress test:** Figure 4 and Supplementary Table S3 provide controlled evidence that low mutation counts produce wider uncertainty and must be interpreted cautiously.
6. **Interoperability/reporting evidence:** Supplementary Tables S1-S2 document SDK namespaces, import/export/report/provenance modules, and executable notebooks.

## Analyses Still Needed Before Submission

1. **Browser rendering benchmark:** Measure median and range across at least 5 repeats for mutation-burden QC, reconstruction plot, bootstrap CI, threshold sensitivity plot, SBS96 residual plot, NMF rank plot, and NMF exposure heatmap. Record browser name/version, viewport, plot dimensions, sample/signature counts, and browser heap if available.
2. **Real rare-cancer or low-resource cohort example:** Prefer a salivary gland carcinoma dataset if accessible. If not, choose another public/accessible rare tumor cohort and report sample count, mutation burden distribution, fitting stability, and limitations. The controlled low-burden stress test is useful but should not be presented as a real rare-cancer validation.
3. **Replace schematic panel values where possible:** Figures 2 and 3 are suitable figure drafts, but final submission should use values exported from the focused notebooks or clearly label schematic panels as workflow summaries.
4. **Related-software citation pass:** Add versioned citations/URLs for mSigPortal, SigProfilerExtractor/Assignment, MutationalPatterns, deconstructSigs, COSMIC, and any selected AI/genomic visualization comparator. Do not benchmark AI tools unless a specific same-task tool and reproducible task are selected.
5. **Browser package/release evidence:** Create a versioned release archive/DOI or tag, confirm the public import URL, and document package installation/import instructions.
6. **Manuscript claim audit:** Remove unsupported phrases such as "all computations execute locally" or "same analytical capabilities as mSigPortal"; replace them with execution-specific wording from Table 1.

## Exact Remaining Analysis Matrix

${markdownTable(
  ["Analysis to complete", "Why it is needed", "Minimum output/result", "Manuscript destination", "Status"],
  [
    [
      "Browser rendering benchmark",
      "Reviewer asked for rendering time and memory use for large visualizations",
      "Median and range across >=5 repeats for burden, reconstruction, bootstrap, threshold, SBS96 residual, NMF rank, and NMF heatmap plots; browser/version/viewport/heap metadata",
      "Supplementary Figure S1; Supplementary benchmark table; Methods benchmark subsection",
      "Pending",
    ],
    [
      "Browser heap/memory measurement",
      "Reviewer specifically questioned memory consumption during visualization generation",
      "Approximate heap before/after each browser plot using Chrome performance memory or DevTools protocol, with caveat that browser heap is approximate",
      "Supplementary Table S4 or merged with rendering benchmark",
      "Pending",
    ],
    [
      "Rare cancer or low-resource cohort",
      "Reviewer criticized reliance on PCAWG lung adenocarcinoma and asked about under-resourced tumor types",
      "A real salivary gland carcinoma cohort if accessible, or another rare cohort with sample count, mutation burden distribution, fitting QC, bootstrap/threshold interpretation, and limitations",
      "Results paragraph; optional Figure 5 or Supplementary Figure S2",
      "Pending; controlled low-burden stress test completed but not a substitute",
    ],
    [
      "Notebook-derived final values for Figures 2 and 3",
      "Current figure drafts are workflow-level schematics with representative values",
      "Exported example values/plots from focused notebooks, or explicit caption language labeling panels as schematics",
      "Figures 2 and 3 captions/results",
      "Pending",
    ],
    [
      "Related software citation/version pass",
      "BMC software papers need clear comparison to existing tools",
      "Citations and versions/URLs for mSigPortal, SigProfiler tools, MutationalPatterns, deconstructSigs, COSMIC, and any selected AI comparator",
      "Table 4; Discussion",
      "Pending",
    ],
    [
      "Versioned software release",
      "Supports reproducibility and reviewer testing",
      "Git tag/release, archive or DOI, install/import instructions, exact commit used for benchmarks",
      "Availability and requirements; Supplementary archive",
      "Pending",
    ],
  ]
)}

## Recommended Main Manuscript Items

- Figure 1: Browser-native architecture and privacy boundary.
- Figure 2: Known-signature fitting QC and uncertainty diagnostics.
- Figure 3: Exploratory browser-side NMF extraction.
- Figure 4: Runtime scaling and low-burden stress test.
- Table 1: Execution locus and privacy boundary.
- Table 2: Workflow evidence provided by the revised SDK.
- Table 3: Core compute benchmarks.
- Table 4: Functional comparison with related tools.

## Recommended Supplementary Items

- Supplementary Table S1: SDK namespaces and representative functions.
- Supplementary Table S2: Focused executable notebooks.
- Supplementary Table S3: Controlled low-burden stress test.
- Supplementary Figure S1: Browser rendering benchmark once collected.
- Supplementary archive: benchmark JSON, notebook URLs, figure generation script, and exact SDK commit/release.
`;
}

function makeFiguresAndTablesIndex() {
  return `# Numbered Manuscript Figures And Tables

## Main Figures

1. **Figure 1. Browser-native architecture and privacy boundary**  
   File: \`docs/manuscript/figures/figure1-architecture.svg\`  
   Purpose: addresses the reviewer concern that the SDK did not distinguish API orchestration, local computation, and privacy boundaries.

2. **Figure 2. Quality-control and uncertainty diagnostics for known-signature fitting**  
   File: \`docs/manuscript/figures/figure2-qc-dashboard.svg\`  
   Purpose: demonstrates that the revised SDK adds auditable fitting, QC, residual, bootstrap, and threshold-sensitivity workflows beyond visualization wrappers.

3. **Figure 3. Exploratory browser-side NMF signature extraction**  
   File: \`docs/manuscript/figures/figure3-nmf-extraction.svg\`  
   Purpose: shows the new browser-sized de novo extraction workflow while explicitly limiting it to exploratory/moderate-scale use.

4. **Figure 4. Runtime scaling and low-burden stress test**  
   File: \`docs/manuscript/figures/figure4-benchmark-low-burden.svg\`  
   Purpose: provides benchmark evidence and controlled low-mutation-count evidence requested by the reviewer.

## Main Tables

1. **Table 1. Execution locus and privacy boundary**  
   File: \`docs/manuscript/tables/table1-execution-locus.md\`

2. **Table 2. Manuscript workflow evidence provided by the revised SDK**  
   File: \`docs/manuscript/tables/table2-workflow-evidence.md\`

3. **Table 3. Core compute benchmark results**  
   File: \`docs/manuscript/tables/table3-compute-benchmarks.md\`

4. **Table 4. Functional comparison with related mutational-signature tools**  
   File: \`docs/manuscript/tables/table4-related-software-comparison.md\`

## Supplementary Tables

1. **Supplementary Table S1. SDK namespaces and representative functions**  
   File: \`docs/manuscript/tables/tableS1-sdk-namespaces.md\`

2. **Supplementary Table S2. Focused executable notebooks**  
   File: \`docs/manuscript/tables/tableS2-notebook-workflows.md\`

3. **Supplementary Table S3. Controlled low-burden stress test**  
   File: \`docs/manuscript/tables/tableS3-low-burden-stress-test.md\`
`;
}

async function main() {
  await mkdir(FIGURE_DIR, { recursive: true });
  await mkdir(TABLE_DIR, { recursive: true });

  const benchmarkRows = await readBenchmarkRows();
  const lowBurdenRows = await runLowBurdenStressTest();

  await writeFile(
    join(MANUSCRIPT_DIR, "low-burden-stress-test.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), rows: lowBurdenRows }, null, 2)}\n`
  );
  await writeFile(
    join(FIGURE_DIR, "figure4-benchmark-low-burden.svg"),
    makeFigure4(benchmarkRows, lowBurdenRows)
  );
  const tableFiles = await writeTables(benchmarkRows, lowBurdenRows);
  await writeFile(join(MANUSCRIPT_DIR, "MANUSCRIPT_COMPLETION_PLAN.md"), makeCompletionPlan());
  await writeFile(
    join(MANUSCRIPT_DIR, "MANUSCRIPT_FIGURES_AND_TABLES.md"),
    makeFiguresAndTablesIndex()
  );

  console.log(`Wrote Figure 4 and ${tableFiles.length} table files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
