import { existsSync } from "node:fs";
import { copyFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  EXPERIMENT_ROOT,
  FIGURE_ROOT,
  MANUSCRIPT_ROOT,
  REPO_ROOT,
  browserCandidates,
  ensureDir,
  environmentSummary,
  readJson,
  relativeArtifact,
  runCommand,
  writeCsv,
  writeJson,
  writeText,
} from "./lib/experiment-utils.mjs";
import {
  calculateReconstructionError,
  fitSpectraWithNNLS,
  runThresholdSensitivity,
  summarizeMutationBurden,
} from "../../mSigSDKScripts/qc.js";
import {
  extractSignaturesNMF,
  selectNMFRank,
} from "../../mSigSDKScripts/signatureExtraction.js";

const TABLE_ROOT = path.join(MANUSCRIPT_ROOT, "tables");
const SUPPLEMENT_ROOT = path.join(MANUSCRIPT_ROOT, "supplement");
const FIGURE3_DIR = path.join(EXPERIMENT_ROOT, "public_cohort_capability", "data");
const E2_DATA_DIR = path.join(EXPERIMENT_ROOT, "e2_adapter_fidelity", "data");
const E5_DATA_DIR = path.join(EXPERIMENT_ROOT, "e5_end_to_end_notebook_benchmark", "data");
const HARDWARE_DATA_DIR = path.join(EXPERIMENT_ROOT, "hardware_scaling_characterization", "data");
const CROSS_PLATFORM_DATA_DIR = path.join(EXPERIMENT_ROOT, "cross_platform_runs", "data");

const PALETTE = {
  ink: "#16212f",
  muted: "#5d6978",
  faint: "#e4e9ef",
  paper: "#ffffff",
  blue: "#0072b2",
  sky: "#56b4e9",
  green: "#009e73",
  orange: "#e69f00",
  red: "#d55e00",
  purple: "#6f4aa2",
  gray: "#8a939d",
  yellow: "#f0e442",
};

const SBS_COLORS = {
  "C>A": "#0072b2",
  "C>G": "#e69f00",
  "C>T": "#009e73",
  "T>A": "#d55e00",
  "T>C": "#6f4aa2",
  "T>G": "#56b4e9",
};

const SEED = 20260521;

const git = await runCommand("git", ["rev-parse", "HEAD"]);
const commit = git.status === "completed" ? git.stdout.trim() : null;
const generatedAt = new Date().toISOString();
const environment = {
  ...environmentSummary({
    commit,
    generator: "scripts/manuscript/generate-revision-assets.mjs",
    seed: SEED,
  }),
};

await ensureDir(FIGURE_ROOT);
await ensureDir(TABLE_ROOT);
await ensureDir(SUPPLEMENT_ROOT);

const figure3Data = await buildFigure3Data();
await generateFigures(figure3Data);
const tableArtifacts = await generateTables();
const supplementArtifacts = await generateSupplement(tableArtifacts);
await writeStatusArtifacts();
await writeAssetIndex(tableArtifacts, supplementArtifacts);

console.log("Revision assets generated.");
console.log(`Figures: ${relativeArtifact(FIGURE_ROOT)}`);
console.log(`Tables: ${relativeArtifact(TABLE_ROOT)}`);
console.log(`Supplement: ${relativeArtifact(SUPPLEMENT_ROOT)}`);

async function buildFigure3Data() {
  const inputPath = path.join(E2_DATA_DIR, "adapter-fidelity-input.json");
  const input = await readJson(inputPath);
  const contexts = input.contexts;
  const spectra = input.spectra;
  const signatures = input.signatures;
  const sampleNames = Object.keys(spectra);
  const signatureNames = Object.keys(signatures);

  const exposures = await fitSpectraWithNNLS(signatures, spectra, {
    contexts,
    exposureThreshold: 0,
    exposureType: "relative",
    renormalize: true,
  });
  const reconstruction = calculateReconstructionError(signatures, spectra, exposures, {
    contexts,
    normalizeMode: "relative",
  });
  const burden = summarizeMutationBurden(spectra, { expectedContexts: contexts });
  const thresholdSensitivity = await runThresholdSensitivity(signatures, spectra, {
    contexts,
    thresholds: [0, 0.01, 0.03, 0.05, 0.1],
    exposureType: "relative",
    renormalize: true,
  });

  const rankSelection = selectNMFRank(spectra, {
    contexts,
    ranks: [2, 3, 4, 5, 6],
    rankSelectionCriterion: "reconstruction_error",
    maxIterations: 350,
    nRuns: 4,
    seed: SEED,
  });
  const rank6 = extractSignaturesNMF(spectra, {
    contexts,
    rank: 6,
    maxIterations: 700,
    nRuns: 8,
    seed: SEED,
    signaturePrefix: "NMF",
  });

  const meanExposure = signatureNames.map((signature) => ({
    signature,
    meanExposure:
      sampleNames.reduce((sum, sample) => sum + (Number(exposures[sample]?.[signature]) || 0), 0) /
      sampleNames.length,
    prevalence:
      sampleNames.filter((sample) => (Number(exposures[sample]?.[signature]) || 0) >= 0.05).length /
      sampleNames.length,
  }));
  meanExposure.sort((a, b) => b.meanExposure - a.meanExposure);
  const topExposure = meanExposure.slice(0, 9);
  const otherExposure = meanExposure.slice(9).reduce((sum, row) => sum + row.meanExposure, 0);
  const exposurePanel = [
    ...topExposure,
    { signature: "Other", meanExposure: otherExposure, prevalence: null },
  ];

  const burdenRows = burden.samples.map((row) => ({
    sample: row.sample,
    totalMutations: row.totalMutations,
    burdenClass: row.burdenClass,
  }));
  const fitRows = reconstruction.samples.map((row) => ({
    sample: row.sample,
    cosineSimilarity: row.cosineSimilarity,
    rmse: row.rmse,
  }));
  const thresholdRows = thresholdSensitivity.runs.map((run) => ({
    threshold: run.threshold,
    meanActiveSignatures: run.averageActiveSignatures,
    meanReconstructionCosine: run.averageCosineSimilarity,
    meanRmse: run.averageRmse,
  }));
  const rankRows = rankSelection.runs.map((run) => ({
    rank: run.rank,
    reconstructionError: run.reconstructionError,
    averageSampleCosineSimilarity: run.averageSampleCosineSimilarity,
    copheneticCorrelation: run.copheneticCorrelation,
    averageSilhouette: run.averageSilhouette,
  }));
  const nmfProfiles = Object.entries(rank6.signatures).map(([signature, values]) => ({
    signature,
    values: contexts.map((context, index) => ({
      context,
      index,
      mutationClass: mutationClass(context),
      value: Number(values[context]) || 0,
    })),
  }));

  const payload = {
    schemaVersion: "msig.figure3.public_cohort.v1",
    generatedAt,
    environment,
    provenance: {
      script: "scripts/manuscript/generate-revision-assets.mjs",
      input: relativeArtifact(inputPath),
      commit,
      seed: SEED,
      sdkOperations: [
        "fitSpectraWithNNLS",
        "summarizeMutationBurden",
        "calculateReconstructionError",
        "runThresholdSensitivity",
        "selectNMFRank",
        "extractSignaturesNMF",
      ],
    },
    inputs: {
      cohort: "PCAWG Lung-AdenoCA SBS96",
      signatureCatalog: "COSMIC_v3_Signatures_GRCh37_SBS96",
      sampleCount: sampleNames.length,
      contextCount: contexts.length,
      signatureCount: signatureNames.length,
    },
    exposurePanel,
    burdenRows,
    fitRows,
    thresholdRows,
    rankRows,
    nmf: {
      rank: 6,
      selectedRankByLowestReconstructionError: rankSelection.recommendedRank,
      reconstructionError: rank6.reconstructionError,
      averageSampleCosineSimilarity: rank6.averageSampleCosineSimilarity,
      profiles: nmfProfiles,
    },
  };

  await writeJson(path.join(FIGURE3_DIR, "figure3-public-cohort-data.json"), payload);
  await writeCsv(path.join(FIGURE3_DIR, "figure3_mean_exposure.csv"), exposurePanel);
  await writeCsv(path.join(FIGURE3_DIR, "figure3_mutation_burden_qc.csv"), joinBySample(burdenRows, fitRows));
  await writeCsv(path.join(FIGURE3_DIR, "figure3_threshold_sensitivity.csv"), thresholdRows);
  await writeCsv(path.join(FIGURE3_DIR, "figure3_rank_diagnostics.csv"), rankRows);
  await writeText(
    path.join(EXPERIMENT_ROOT, "public_cohort_capability", "public-cohort-capability-summary.md"),
    [
      "# Public Cohort Capability Summary",
      "",
      `Generated at: ${generatedAt}`,
      `Commit: ${commit || "unknown"}`,
      `Input: ${relativeArtifact(inputPath)}`,
      `Seed: ${SEED}`,
      "",
      `Samples: ${sampleNames.length}; contexts: ${contexts.length}; signatures: ${signatureNames.length}.`,
      `Figure 3 data were recomputed with native SDK NNLS, QC threshold sensitivity, and rank-6 NMF.`,
      `Rank selection grid [2,3,4,5,6] selected rank ${rankSelection.recommendedRank} by lowest reconstruction error; the manuscript-requested rank-6 profiles are displayed separately.`,
      "",
    ].join("\n")
  );
  return payload;
}

async function generateFigures(figure3Data) {
  const e1 = await readJson(path.join(EXPERIMENT_ROOT, "e1_zero_install_demo", "data", "zero-install-results.json"));
  const e4Summary = parseCsv(await readFile(path.join(EXPERIMENT_ROOT, "e4_browser_runtime_benchmarks", "data", "browser_runtime_summary.csv"), "utf8"));
  const e4Raw = await readJson(path.join(EXPERIMENT_ROOT, "e4_browser_runtime_benchmarks", "data", "browser-runtime-results.json"));

  const figures = [
    {
      id: "figure1",
      fileBase: "figure1-architecture-data-residency",
      title: "Architecture and Data-Residency Boundary",
      input: "docs/manuscript/tables/tableA_network_endpoints.csv",
      svg: figure1Svg(),
    },
    {
      id: "figure2",
      fileBase: "figure2-zero-install-cumulative-timing",
      title: "Zero-Install Timing - Cumulative From Page Load",
      input: "docs/manuscript/experiments/e1_zero_install_demo/data/zero-install-results.json",
      svg: figure2Svg(e1),
    },
    {
      id: "figure3",
      fileBase: "figure3-public-cohort-capability",
      title: "Public-Cohort Capability",
      input: "docs/manuscript/experiments/public_cohort_capability/data/figure3-public-cohort-data.json",
      svg: figure3Svg(figure3Data),
    },
    {
      id: "figure4",
      fileBase: "figure4-exposure-solve-benchmarks",
      title: "Exposure-Solve Scenarios Only",
      input: "docs/manuscript/experiments/e4_browser_runtime_benchmarks/data/browser-runtime-results.json",
      svg: figure4Svg(e4Raw, e4Summary),
    },
  ];

  const captionLines = [];
  for (const figure of figures) {
    const output = await writeFigureSet(figure.fileBase, figure.svg);
    captionLines.push(`## ${figure.title}`);
    captionLines.push("");
    captionLines.push(`Files: ${output.map(relativeArtifact).join(", ")}`);
    captionLines.push(`Input: ${figure.input}`);
    captionLines.push("Regeneration: `node scripts/manuscript/generate-revision-assets.mjs`");
    captionLines.push("");
  }

  const fig5Status = await endToEndNotebookStatus();
  captionLines.push("## Figure 5 - End-to-End Notebook Runtime");
  captionLines.push("");
  captionLines.push("Not generated. The requested TCGA Lung-AdenoCA SBS96 120- and 500-sample benchmark source was not available from the tested public API queries or local repository artifacts on this host.");
  captionLines.push(`Status artifact: ${fig5Status.statusArtifact}`);
  captionLines.push("");

  await writeText(path.join(FIGURE_ROOT, "revision-figure-captions.md"), captionLines.join("\n"));
}

function figure1Svg() {
  const width = 1400;
  const height = 950;
  const boxes = [
    box(70, 135, 380, 215, "Native JavaScript tier", [
      "Matrix conversion",
      "NNLS / NMF native paths",
      "QC summaries",
      "JSON reports and plots",
    ], PALETTE.blue),
    box(70, 405, 380, 215, "Pyodide / WebR worker tier", [
      "Pinned runtime URLs",
      "Bundled wheels and R tgz",
      "SHA-256 verified installs",
      "Adapter execution",
    ], PALETTE.purple),
    box(825, 115, 445, 170, "Public-data fetchers", [
      "mSigPortal public cohort/catalog APIs",
      "GDC project/gene/file queries",
      "Only public identifiers when invoked",
    ], PALETTE.green),
    box(825, 342, 445, 155, "UCSC live context lookup", [
      "Genome build, chromosome, coordinate",
      "Disabled in strictLocal mode",
      "Use row or bundled contexts instead",
    ], PALETTE.orange),
    box(825, 555, 445, 155, "CDN/runtime module hosts", [
      "Version-pinned ESM modules",
      "No spectra/exposures/QC/reports sent",
      "Bundled package artifacts verified locally",
    ], PALETTE.gray),
  ];
  return svgDocument(width, height, [
    titleBlock(70, 64, "Figure 1. Architecture and data-residency boundary", "Three residency classes are separated from browser execution paths and external hosts."),
    `<rect x="40" y="100" width="680" height="640" rx="18" fill="#f8fbfd" stroke="${PALETTE.blue}" stroke-width="3"/>`,
    `<text x="70" y="802" class="label">Class i local-only: spectra, exposures, QC outputs, plots, and reports.</text>`,
    `<rect x="765" y="100" width="570" height="640" rx="18" fill="#fffdf8" stroke="${PALETTE.orange}" stroke-width="3" stroke-dasharray="14 10"/>`,
    `<text x="795" y="802" class="label">Classes ii-iii: explicit fetches only; strictLocal blocks user-derived egress.</text>`,
    ...boxes,
    arrow(450, 240, 825, 200, "public identifiers only when public fetcher is invoked", PALETTE.green),
    arrow(450, 510, 825, 425, "coordinates only for live MAF context lookup", PALETTE.orange),
    arrow(450, 560, 825, 630, "runtime module/artifact retrieval; no user-derived analysis data", PALETTE.gray),
    `<line x1="720" y1="118" x2="720" y2="740" stroke="${PALETTE.red}" stroke-width="4"/>`,
    `<text x="744" y="430" text-anchor="middle" class="axis-title" style="fill:${PALETTE.red}" transform="rotate(90 744 430)">Data-residency boundary</text>`,
    `<g transform="translate(90 665)">
      <rect x="0" y="0" width="560" height="45" rx="8" fill="#ffffff" stroke="${PALETTE.faint}"/>
      <circle cx="28" cy="23" r="8" fill="${PALETTE.green}"/><text x="45" y="28" class="small">public IDs</text>
      <circle cx="178" cy="23" r="8" fill="${PALETTE.orange}"/><text x="195" y="28" class="small">MAF coordinates</text>
      <circle cx="370" cy="23" r="8" fill="${PALETTE.blue}"/><text x="387" y="28" class="small">local-only outputs</text>
    </g>`,
  ]);
}

function figure2Svg(e1) {
  const row = e1.rows?.[0] || {};
  const steps = (row.steps || []).filter((step) => step.name !== "Page loaded");
  const width = 1200;
  const height = 620;
  const margin = { left: 310, right: 90, top: 160, bottom: 110 };
  const maxTime = Math.max(...steps.map((s) => Number(s.elapsedSeconds) || 0), 1);
  const plotW = width - margin.left - margin.right;
  const x = (value) => margin.left + (Number(value) / maxTime) * plotW;
  const rowY = (index) => 198 + index * 58;
  const marks = steps.map((step, index) => {
    const y = rowY(index);
    const xx = x(step.elapsedSeconds);
    const color = index === steps.length - 1 ? PALETTE.green : PALETTE.blue;
    return [
      `<text x="${margin.left - 26}" y="${y + 7}" text-anchor="end" class="label">${escapeXml(step.name)}</text>`,
      `<rect x="${margin.left}" y="${y - 13}" width="${Math.max(2, xx - margin.left)}" height="26" rx="5" fill="${color}" opacity="${index === steps.length - 1 ? 0.92 : 0.74}"/>`,
      `<text x="${Math.min(xx + 12, width - margin.right - 5)}" y="${y + 7}" class="value" text-anchor="${xx > width - margin.right - 86 ? "end" : "start"}">${formatNumber(step.elapsedSeconds, 2)} s</text>`,
    ].join("");
  });
  const ticks = [0, maxTime / 4, maxTime / 2, (maxTime * 3) / 4, maxTime];
  return svgDocument(width, height, [
    titleBlock(70, 65, "Figure 2. Zero-install timing", "All labels are cumulative seconds from page-load start in the fresh-profile Chrome run."),
    `<rect x="${margin.left}" y="170" width="${plotW}" height="270" fill="#ffffff" stroke="${PALETTE.faint}"/>`,
    marks.join(""),
    ticks.map((tick) => {
      const xx = x(tick);
      return `<g><line x1="${xx}" y1="440" x2="${xx}" y2="450" stroke="${PALETTE.ink}"/><text x="${xx}" y="476" text-anchor="middle" class="small">${formatNumber(tick, 1)}</text></g>`;
    }).join(""),
    `<text x="${margin.left + plotW / 2}" y="510" text-anchor="middle" class="axis-title">Cumulative elapsed seconds from page-load start</text>`,
    `<rect x="95" y="532" width="1010" height="58" rx="10" fill="#f8fbfd" stroke="${PALETTE.faint}"/>`,
    `<text x="120" y="565" class="label">Measured current run: report-ready in ${formatNumber(row.elapsedSeconds, 2)} s; browser ${row.browser || "Chrome"}; fresh profile with no-store local server headers.</text>`,
  ]);
}

function figure3Svg(data) {
  const width = 1500;
  const height = 1180;
  const panels = [
    panelAExposure(data, 70, 145, 640, 410),
    panelBBurden(data, 790, 145, 640, 410),
    panelCThreshold(data, 70, 655, 640, 410),
    panelDNmf(data, 790, 655, 640, 410),
  ];
  return svgDocument(width, height, [
    titleBlock(70, 65, "Figure 3. Public-cohort capability", "38 PCAWG Lung-AdenoCA SBS96 spectra refit against the 67-signature COSMIC v3 GRCh37 catalog."),
    ...panels,
    `<text x="70" y="1120" class="small">Generated from saved public cohort input with native SDK NNLS/QC/NMF; seed ${SEED}; commit ${escapeXml(commit || "unknown")}.</text>`,
  ]);
}

function panelAExposure(data, x0, y0, w, h) {
  const rows = data.exposurePanel;
  const max = Math.max(...rows.map((r) => r.meanExposure), 0.01);
  const barH = 23;
  const gap = 9;
  const axisX = x0 + 150;
  const plotW = w - 220;
  return [
    panelFrame(x0, y0, w, h, "A", "Mean normalized COSMIC exposure"),
    rows.map((row, index) => {
      const y = y0 + 70 + index * (barH + gap);
      const bw = (row.meanExposure / max) * plotW;
      const color = row.signature === "Other" ? PALETTE.gray : [PALETTE.blue, PALETTE.green, PALETTE.orange, PALETTE.purple, PALETTE.sky][index % 5];
      const prevalence = row.prevalence === null ? "" : ` ${formatNumber(row.prevalence * 100, 0)}%`;
      return `<text x="${axisX - 14}" y="${y + 17}" text-anchor="end" class="small strong">${escapeXml(row.signature)}</text>
        <rect x="${axisX}" y="${y}" width="${bw}" height="${barH}" rx="4" fill="${color}"/>
        <text x="${axisX + bw + 8}" y="${y + 17}" class="small">${formatNumber(row.meanExposure, 3)}${prevalence}</text>`;
    }).join(""),
  ].join("");
}

function panelBBurden(data, x0, y0, w, h) {
  const burdenRows = [...data.burdenRows].sort((a, b) => a.totalMutations - b.totalMutations);
  const fitRows = data.fitRows;
  const burdens = burdenRows.map((row) => row.totalMutations);
  const cosines = fitRows.map((row) => row.cosineSimilarity).filter(Number.isFinite);
  const minB = Math.min(...burdens);
  const maxB = Math.max(...burdens);
  const medianB = quantile(burdens, 0.5);
  const medianCos = quantile(cosines, 0.5);
  const minCos = Math.min(...cosines);
  const plot = { x: x0 + 82, y: y0 + 148, w: w - 140, h: 140 };
  const sx = (value) => plot.x + ((value - minB) / Math.max(maxB - minB, 1)) * plot.w;
  const sy = (_, i) => plot.y + plot.h - (i / Math.max(burdenRows.length - 1, 1)) * plot.h;
  return [
    panelFrame(x0, y0, w, h, "B", "QC metrics and mutation burden"),
    statCard(x0 + 35, y0 + 65, "Samples", data.inputs.sampleCount),
    statCard(x0 + 220, y0 + 65, "Median burden", formatInteger(medianB)),
    statCard(x0 + 405, y0 + 65, "Median fit cosine", formatNumber(medianCos, 3), PALETTE.green),
    `<line x1="${plot.x}" y1="${plot.y + plot.h + 18}" x2="${plot.x + plot.w}" y2="${plot.y + plot.h + 18}" stroke="${PALETTE.ink}"/>`,
    burdenRows.map((row, i) => `<circle cx="${sx(row.totalMutations)}" cy="${sy(row.totalMutations, i)}" r="4.5" fill="${PALETTE.blue}" opacity="0.72"/>`).join(""),
    `<line x1="${sx(medianB)}" y1="${plot.y - 12}" x2="${sx(medianB)}" y2="${plot.y + plot.h + 28}" stroke="${PALETTE.green}" stroke-width="2.5"/>`,
    `<text x="${sx(medianB) + 8}" y="${plot.y - 20}" class="small strong" fill="${PALETTE.green}">median</text>`,
    `<text x="${plot.x + plot.w / 2}" y="${plot.y + plot.h + 54}" text-anchor="middle" class="axis-title">SBS mutation burden per sample</text>`,
    `<text x="${x0 + 35}" y="${y0 + h - 35}" class="small">Minimum fit cosine: ${formatNumber(minCos, 3)}; all values computed from the saved 38-sample public input.</text>`,
  ].join("");
}

function panelCThreshold(data, x0, y0, w, h) {
  const rows = data.thresholdRows;
  const plot = { x: x0 + 82, y: y0 + 80, w: w - 160, h: 245 };
  const maxActive = Math.max(...rows.map((r) => r.meanActiveSignatures), 1);
  const minCos = Math.min(...rows.map((r) => r.meanReconstructionCosine), 0.95);
  const cosFloor = Math.max(0.9, Math.floor(minCos * 100) / 100 - 0.01);
  const x = (i) => plot.x + (i / Math.max(rows.length - 1, 1)) * plot.w;
  const yActive = (v) => plot.y + plot.h - (v / maxActive) * plot.h;
  const yCos = (v) => plot.y + plot.h - ((v - cosFloor) / Math.max(1 - cosFloor, 0.001)) * plot.h;
  const line = rows.map((row, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yCos(row.meanReconstructionCosine)}`).join(" ");
  return [
    panelFrame(x0, y0, w, h, "C", "Exposure-threshold sensitivity"),
    `<line x1="${plot.x}" y1="${plot.y + plot.h}" x2="${plot.x + plot.w}" y2="${plot.y + plot.h}" stroke="${PALETTE.ink}"/>`,
    rows.map((row, i) => {
      const xx = x(i);
      const bw = 46;
      return `<rect x="${xx - bw / 2}" y="${yActive(row.meanActiveSignatures)}" width="${bw}" height="${plot.y + plot.h - yActive(row.meanActiveSignatures)}" rx="5" fill="${PALETTE.orange}" opacity="0.82"/>
        <text x="${xx}" y="${plot.y + plot.h + 26}" text-anchor="middle" class="small">${row.threshold === 0 ? "0" : formatNumber(row.threshold * 100, 0) + "%"}</text>`;
    }).join(""),
    `<path d="${line}" fill="none" stroke="${PALETTE.green}" stroke-width="3.5"/>`,
    rows.map((row, i) => `<circle cx="${x(i)}" cy="${yCos(row.meanReconstructionCosine)}" r="5.5" fill="${PALETTE.green}" stroke="#fff" stroke-width="2"/>`).join(""),
    `<text x="${plot.x - 52}" y="${plot.y + 15}" class="small strong" fill="${PALETTE.orange}">active</text>`,
    `<text x="${plot.x + plot.w + 18}" y="${plot.y + 15}" class="small strong" fill="${PALETTE.green}">cosine</text>`,
    `<text x="${plot.x + plot.w / 2}" y="${plot.y + plot.h + 62}" text-anchor="middle" class="axis-title">Relative exposure cutoff</text>`,
  ].join("");
}

function panelDNmf(data, x0, y0, w, h) {
  const rankRows = data.rankRows;
  const profiles = data.nmf.profiles.slice(0, 6);
  const plot = { x: x0 + 75, y: y0 + 82, w: 230, h: 180 };
  const minErr = Math.min(...rankRows.map((r) => r.reconstructionError));
  const maxErr = Math.max(...rankRows.map((r) => r.reconstructionError));
  const x = (i) => plot.x + (i / Math.max(rankRows.length - 1, 1)) * plot.w;
  const y = (value) => plot.y + plot.h - ((value - minErr) / Math.max(maxErr - minErr, 1)) * plot.h;
  const line = rankRows.map((row, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(row.reconstructionError)}`).join(" ");
  return [
    panelFrame(x0, y0, w, h, "D", "Rank-6 NMF diagnostics and profiles"),
    `<path d="${line}" fill="none" stroke="${PALETTE.purple}" stroke-width="3.5"/>`,
    rankRows.map((row, i) => `<circle cx="${x(i)}" cy="${y(row.reconstructionError)}" r="${row.rank === 6 ? 7 : 5}" fill="${row.rank === 6 ? PALETTE.purple : "#fff"}" stroke="${PALETTE.purple}" stroke-width="2"/><text x="${x(i)}" y="${plot.y + plot.h + 27}" text-anchor="middle" class="small">${row.rank}</text>`).join(""),
    `<text x="${plot.x + plot.w / 2}" y="${plot.y + plot.h + 58}" text-anchor="middle" class="axis-title">NMF rank</text>`,
    `<text x="${plot.x}" y="${plot.y - 24}" class="small">Error ${formatNumber(minErr, 1)}-${formatNumber(maxErr, 1)}</text>`,
    profiles.map((profile, i) => miniProfile(profile, x0 + 342 + (i % 2) * 126, y0 + 78 + Math.floor(i / 2) * 94, 105, 55)).join(""),
    `<text x="${x0 + 35}" y="${y0 + h - 35}" class="small">Rank-6 extraction uses seed ${SEED}, 8 starts, and 700 maximum iterations.</text>`,
  ].join("");
}

function miniProfile(profile, x, y, w, h) {
  const maxValue = Math.max(...profile.values.map((row) => row.value), 0.001);
  const bw = w / profile.values.length;
  return [
    `<text x="${x}" y="${y - 9}" class="small strong">${escapeXml(profile.signature)}</text>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="${PALETTE.faint}"/>`,
    profile.values.map((row, index) => {
      const bh = (row.value / maxValue) * h;
      return `<rect x="${x + index * bw}" y="${y + h - bh}" width="${Math.max(bw - 0.4, 0.5)}" height="${bh}" fill="${SBS_COLORS[row.mutationClass] || PALETTE.gray}"/>`;
    }).join(""),
  ].join("");
}

function figure4Svg(raw, summary) {
  const width = 1500;
  const height = 900;
  const scenarios = [
    ["single_sample_fit_report", "Single sample"],
    ["medium_cohort_120", "120 sample"],
    ["portal_scale_300x40", "300 x 40"],
    ["bootstrap_500", "Bootstrap 500"],
    ["nmf_rank_selection_rank4", "NMF rank+4"],
  ];
  const browsers = [
    ["chrome", "Chrome", PALETTE.blue],
    ["edge", "Edge", PALETTE.green],
    ["firefox", "Firefox", PALETTE.orange],
  ];
  const rows = (raw.rows || []).filter((row) => row.phase === "warm" && row.status === "completed");
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.browser}:${row.scenario}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(Number(row.elapsedMs));
  }
  const stats = new Map();
  for (const [key, values] of grouped) {
    stats.set(key, {
      median: quantile(values, 0.5),
      q1: quantile(values, 0.25),
      q3: quantile(values, 0.75),
      n: values.length,
    });
  }
  const allValues = [...stats.values()].flatMap((row) => [row.q1, row.q3]).filter(Number.isFinite);
  const min = Math.max(0.8, Math.min(...allValues));
  const max = Math.max(...allValues, 10000);
  const plot = { x: 115, y: 160, w: 1250, h: 515 };
  const y = (value) => {
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    return plot.y + plot.h - ((Math.log10(Math.max(value, min)) - logMin) / (logMax - logMin)) * plot.h;
  };
  const groupW = plot.w / scenarios.length;
  const marks = [];
  scenarios.forEach(([scenario], si) => {
    browsers.forEach(([browser, label, color], bi) => {
      const key = `${browser}:${scenario}`;
      const stat = stats.get(key);
      if (!stat) return;
      const x = plot.x + si * groupW + groupW / 2 + (bi - 1) * 28;
      marks.push(`<line x1="${x}" y1="${y(stat.q1)}" x2="${x}" y2="${y(stat.q3)}" stroke="${color}" stroke-width="8" stroke-linecap="round" opacity="0.52"/>`);
      marks.push(`<circle cx="${x}" cy="${y(stat.median)}" r="8" fill="${color}" stroke="#ffffff" stroke-width="2"/>`);
    });
  });
  const ticks = [1, 3, 10, 30, 100, 300, 1000, 3000, 10000].filter((tick) => tick >= min && tick <= max);
  const coldMedians = summary
    .filter((row) => row.phase === "cold")
    .map((row) => Number(row.median_ms))
    .filter(Number.isFinite);
  const warmMedians = summary
    .filter((row) => row.phase === "warm")
    .map((row) => Number(row.median_ms))
    .filter(Number.isFinite);
  return svgDocument(width, height, [
    titleBlock(70, 70, "Figure 4. Exposure-solve scenarios only", "Warm-start browser distributions from >=20 isolated repeats per scenario; dots are medians and bars are IQR."),
    `<rect x="${plot.x}" y="${plot.y}" width="${plot.w}" height="${plot.h}" fill="#ffffff" stroke="${PALETTE.faint}"/>`,
    ticks.map((tick) => `<line x1="${plot.x}" x2="${plot.x + plot.w}" y1="${y(tick)}" y2="${y(tick)}" stroke="${PALETTE.faint}"/><text x="${plot.x - 18}" y="${y(tick) + 4}" text-anchor="end" class="small">${formatTick(tick)}</text>`).join(""),
    marks.join(""),
    scenarios.map(([scenario, label], i) => {
      const x = plot.x + i * groupW + groupW / 2;
      return `<text x="${x}" y="${plot.y + plot.h + 42}" text-anchor="middle" class="small strong">${escapeXml(label)}</text>`;
    }).join(""),
    browsers.map(([id, label, color], i) => {
      const x = 1045 + i * 120;
      return `<circle cx="${x}" cy="120" r="7" fill="${color}"/><text x="${x + 15}" y="125" class="small">${label}</text>`;
    }).join(""),
    `<text x="48" y="${plot.y + plot.h / 2}" text-anchor="middle" class="axis-title" transform="rotate(-90 48 ${plot.y + plot.h / 2})">Wall-clock ms, log scale</text>`,
    `<text x="${plot.x}" y="735" class="small">Raw data include cold-start and warm-start phases plus load/network/module/compute/serialization fields. Warm medians shown here range ${formatNumber(Math.min(...warmMedians), 2)}-${formatNumber(Math.max(...warmMedians), 2)} ms; cold medians range ${formatNumber(Math.min(...coldMedians), 2)}-${formatNumber(Math.max(...coldMedians), 2)} ms.</text>`,
    `<text x="${plot.x}" y="765" class="small">Peak JS heap is available only where the browser exposes performance.memory; Firefox reports unavailable in the raw artifact.</text>`,
  ]);
}

async function generateTables() {
  const e2 = await readJson(path.join(E2_DATA_DIR, "adapter-fidelity-results.json"));
  const readiness = await readJson(path.join(E2_DATA_DIR, "environment-readiness-log.json"));
  const qcRows = buildPrincipalQcRows();
  const toolRows = buildToolRows(readiness);
  const networkRows = buildNetworkRows();

  await rm(path.join(TABLE_ROOT, "table1_tools.csv"), { force: true });
  await rm(path.join(TABLE_ROOT, "table1_tools.md"), { force: true });
  await writeCsv(path.join(TABLE_ROOT, "table2_executable_adapters.csv"), toolRows);
  await writeText(path.join(TABLE_ROOT, "table2_executable_adapters.md"), markdownTable(toolRows, "Table 2. In-browser executable adapters"));
  await writeCsv(path.join(TABLE_ROOT, "tableA_network_endpoints.csv"), networkRows);
  await writeText(path.join(TABLE_ROOT, "tableA_network_endpoints.md"), markdownTable(networkRows, "Table A. Network endpoints and data-residency audit"));
  await writeCsv(path.join(TABLE_ROOT, "tableB_qc_thresholds.csv"), qcRows);
  await writeText(path.join(TABLE_ROOT, "tableB_qc_thresholds.md"), markdownTable(qcRows, "Table B. Principal QC review defaults"));

  return {
    table2: relativeArtifact(path.join(TABLE_ROOT, "table2_executable_adapters.csv")),
    tableA: relativeArtifact(path.join(TABLE_ROOT, "tableA_network_endpoints.csv")),
    tableB: relativeArtifact(path.join(TABLE_ROOT, "tableB_qc_thresholds.csv")),
    e2Status: e2.status,
  };
}

function buildToolRows(readiness) {
  const byToolPath = new Map((readiness.rows || []).map((row) => [`${row.tool}:${row.path}`, row]));
  return [
    {
      tool: "deconstructSigs",
      version: byToolPath.get("deconstructsigs:browser")?.packageVersion || "1.8.0",
      runtime: "WebR v0.6.0",
      role: "Known-signature decomposition",
    },
    {
      tool: "sigminer",
      version: byToolPath.get("sigminer:browser")?.packageVersion || "2.3.1",
      runtime: "WebR v0.6.0",
      role: "Supervised fitting and extraction",
    },
    {
      tool: "SigProfilerAssignment",
      version: byToolPath.get("sigprofilerassignment:browser")?.packageVersion || "1.1.3",
      runtime: "Pyodide v0.27.4",
      role: "Known-signature assignment (matrix mode)",
    },
    {
      tool: "MuSiCal",
      version: byToolPath.get("musical:browser")?.packageVersion || "1.0.0",
      runtime: "Pyodide v0.27.4",
      role: "Sparse refitting and discovery",
    },
  ];
}

function buildPrincipalQcRows() {
  return [
    {
      evidence_area: "Mutation burden",
      default_rule: "WGS: low <100; moderate <1000. Panel/WES: low <30; moderate <150.",
      interpretation: "Low-burden samples receive more cautious reporting.",
    },
    {
      evidence_area: "Context coverage",
      default_rule: "Observed contexts must match the selected profile.",
      interpretation: "Missing or extra contexts are treated as input-format issues.",
    },
    {
      evidence_area: "Reconstruction and residuals",
      default_rule: "Review when cosine <0.9, unexplained fraction >=0.07, or residual-reference cosine >=0.85.",
      interpretation: "Poor fit or structured residuals suggest caveated interpretation or catalog review.",
    },
    {
      evidence_area: "Exposure-threshold sensitivity",
      default_rule: "Evaluate cutoffs 0, 1%, 3%, 5%, and 10%; review cosine drops >=0.02.",
      interpretation: "Highlights fits whose active signatures change across reporting cutoffs.",
    },
    {
      evidence_area: "Bootstrap stability",
      default_rule: "200 iterations by default; 500 for stable-interval review; 1000 recommended for publication use.",
      interpretation: "Reports sampling uncertainty conditional on the observed spectrum and catalog.",
    },
    {
      evidence_area: "Signature ambiguity",
      default_rule: "Review similar signatures at cosine >=0.9; stronger ambiguity at >=0.95.",
      interpretation: "Marks exposure estimates that may redistribute among similar signatures.",
    },
    {
      evidence_area: "Catalog sufficiency",
      default_rule: "Review when unexplained fraction >=0.12 or catalog cosine <0.9.",
      interpretation: "Identifies cases where the reference catalog may not explain observed structure.",
    },
  ];
}

function buildNetworkRows() {
  return [
    {
      host: "mSigPortal API",
      used_for: "Public spectra and signature catalogs",
      information_sent: "Public cohort/catalog filters or selected sample identifiers",
      user_derived_data: "No for public-resource fetches",
      strict_local_mode: "Sample-specific fetches are disabled",
    },
    {
      host: "GDC API",
      used_for: "Public TCGA/GDC helper queries",
      information_sent: "Public gene, project, file, and query identifiers",
      user_derived_data: "Public identifiers only",
      strict_local_mode: "All GDC calls are disabled",
    },
    {
      host: "UCSC sequence API",
      used_for: "Online MAF sequence-context lookup",
      information_sent: "Genome build and mutation coordinates",
      user_derived_data: "Yes, when converting user MAF rows online",
      strict_local_mode: "Disabled; row-supplied or offline contexts required",
    },
    {
      host: "Runtime/CDN hosts",
      used_for: "Pinned JavaScript, Pyodide, and WebR assets",
      information_sent: "Asset URLs only",
      user_derived_data: "No",
      strict_local_mode: "Avoidable by local hosting where assets are bundled",
    },
    {
      host: "Bundled package repositories",
      used_for: "Pyodide wheels and WebR package artifacts",
      information_sent: "Same-origin local artifact requests when hosted",
      user_derived_data: "No",
      strict_local_mode: "Compatible with local hosting",
    },
  ];
}

async function generateSupplement(tableArtifacts) {
  const pyodideManifest = await readJson(path.join(REPO_ROOT, "docs", "package-repos", "pyodide", "manifest.json"));
  const webRManifest = await readJson(path.join(REPO_ROOT, "docs", "package-repos", "webr", "manifest.json"));
  const e2 = await readJson(path.join(E2_DATA_DIR, "adapter-fidelity-results.json"));
  const e3 = await readJson(path.join(EXPERIMENT_ROOT, "e3_internal_reference_checks", "data", "reference-check-results.json"));
  const e4 = await readJson(path.join(EXPERIMENT_ROOT, "e4_browser_runtime_benchmarks", "data", "browser-runtime-summary.json"));
  const strict = await readJson(path.join(EXPERIMENT_ROOT, "strict_local_no_egress", "data", "strict-local-no-egress.json"));

  const runtimeManifest = {
    schemaVersion: "msig.runtime_integrity_manifest.v1",
    generatedAt,
    environment,
    pinnedRuntimes: {
      pyodide: "v0.27.4",
      webR: "v0.6.0",
      amCharts: "5.3.7",
      pako: "2.1.0",
      PapaParse: "5.5.3",
    },
    sha256VerifiedBeforeInstall: {
      pyodidePackages: pyodideManifest.packages,
      webRPackages: webRManifest.packages,
    },
    pinnedOnlyNotSriVerifiedBySdk: [
      "CDN ESM/module URLs for amCharts, pako, PapaParse, Pyodide runtime, and WebR runtime are version-pinned but not SHA-256/SRI-verified by the SDK.",
    ],
  };
  await writeJson(path.join(SUPPLEMENT_ROOT, "runtime-version-integrity-manifest.json"), runtimeManifest);
  await writeText(
    path.join(SUPPLEMENT_ROOT, "runtime-version-integrity-manifest.md"),
    [
      "# Runtime Version and Integrity Manifest",
      "",
      `Generated at: ${generatedAt}`,
      `Commit: ${commit || "unknown"}`,
      "",
      "- Pyodide runtime: v0.27.4.",
      "- WebR runtime: v0.6.0.",
      "- amCharts: 5.3.7; pako: 2.1.0; PapaParse: 5.5.3.",
      `- SHA-256 verified package artifacts: ${pyodideManifest.packages.length} Pyodide wheels and ${webRManifest.packages.length} WebR package tgz files.`,
      "- CDN ESM/runtime modules are version-pinned but not SDK SRI-verified.",
      "",
    ].join("\n")
  );

  const networkRows = buildNetworkRows();
  await writeJson(path.join(SUPPLEMENT_ROOT, "network-endpoint-data-residency-audit.json"), {
    schemaVersion: "msig.network_endpoint_audit.v1",
    generatedAt,
    environment,
    rows: networkRows,
  });
  await writeText(
    path.join(SUPPLEMENT_ROOT, "network-endpoint-data-residency-audit.md"),
    markdownTable(networkRows, "Network Endpoint and Data-Residency Audit")
  );

  const completedAdapterTools = new Set(e2.rows?.map((row) => row.tool) || []);
  const missingAdapterTools = ["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"].filter(
    (tool) => !completedAdapterTools.has(tool)
  );
  const adapterFidelityNotes = missingAdapterTools.length
    ? [
        `No complete browser/local exposure pair for: ${missingAdapterTools.join(", ")}.`,
      ]
    : [
        "All requested browser/local adapter-fidelity pairs completed for deconstructSigs, sigminer, SigProfilerAssignment, and MuSiCal.",
      ];

  await writeJson(path.join(SUPPLEMENT_ROOT, "adapter-fidelity-reproducibility-record.json"), {
    schemaVersion: "msig.adapter_fidelity_reproducibility_record.v1",
    generatedAt,
    environment,
    status: e2.status,
    result: e2,
    notes: adapterFidelityNotes,
  });
  await writeText(
    path.join(SUPPLEMENT_ROOT, "adapter-fidelity-reproducibility-record.md"),
    [
      "# Adapter-Fidelity Reproducibility Record",
      "",
      `Status: ${e2.status}`,
      `Input: ${e2.artifacts?.input}`,
      `Exposure pairs: ${e2.artifacts?.exposurePairsJson}`,
      `Readiness log: ${e2.artifacts?.readinessLog}`,
      "",
      ...e2.rows.map((row) => `- ${row.tool}: ${row.status}; max abs diff ${row.maxAbsoluteExposureDifference}; RMSE ${row.rmse}; min cosine ${row.minExposureCosine}.`),
      "",
      ...adapterFidelityNotes,
      "",
    ].join("\n")
  );

  await copyArtifact(path.join(EXPERIMENT_ROOT, "strict_local_no_egress", "data", "strict-local-no-egress.json"), path.join(SUPPLEMENT_ROOT, "strict-local-no-egress.json"));
  await copyArtifact(path.join(EXPERIMENT_ROOT, "strict_local_no_egress", "data", "strict_local_network_log.csv"), path.join(SUPPLEMENT_ROOT, "strict_local_network_log.csv"));
  await writeText(
    path.join(SUPPLEMENT_ROOT, "strict-local-no-egress-evidence.md"),
    [
      "# Strict-Local No-Egress Evidence",
      "",
      `Status: ${strict.status}`,
      `Network requests observed: ${strict.networkRequests}`,
      `Workflow: ${strict.workflow}`,
      `Command: ${strict.environment?.command}`,
      "",
      "The network log artifact is intentionally empty because the monitored workflow observed zero requests.",
      "",
    ].join("\n")
  );

  await copyArtifact(path.join(EXPERIMENT_ROOT, "e4_browser_runtime_benchmarks", "data", "browser-runtime-results.json"), path.join(SUPPLEMENT_ROOT, "browser-runtime-results.json"));
  await copyArtifact(path.join(EXPERIMENT_ROOT, "e4_browser_runtime_benchmarks", "data", "browser-runtime-summary.json"), path.join(SUPPLEMENT_ROOT, "browser-runtime-summary.json"));
  await writeText(
    path.join(SUPPLEMENT_ROOT, "benchmark-harness-description.md"),
    [
      "# Benchmark Harness Description",
      "",
      "Exposure-solve browser benchmarks were run with isolated browser profiles, >=20 repeats per scenario/browser, and separate cold and warm phases.",
      "Recorded stage fields include load, network fetch critical path, module import, runtime init, pure-JS compute, serialization, and peak JS heap where the browser exposes it.",
      "",
      `Chrome/Edge/Firefox summary status: ${e4.status}.`,
      `End-to-end notebook benchmark status: not possible on this host with the requested TCGA 120/500-sample public input unavailable.`,
      "",
    ].join("\n")
  );

  await writeJson(path.join(SUPPLEMENT_ROOT, "supplement-manifest.json"), {
    schemaVersion: "msig.supplement_manifest.v1",
    generatedAt,
    environment,
    files: {
      networkAudit: "network-endpoint-data-residency-audit.md",
      runtimeIntegrity: "runtime-version-integrity-manifest.md",
      adapterFidelity: "adapter-fidelity-reproducibility-record.md",
      strictLocal: "strict-local-no-egress-evidence.md",
      benchmarkHarness: "benchmark-harness-description.md",
      tables: tableArtifacts,
      internalReference: e3.artifacts,
    },
  });

  return [
    "network-endpoint-data-residency-audit.md",
    "runtime-version-integrity-manifest.md",
    "adapter-fidelity-reproducibility-record.md",
    "strict-local-no-egress-evidence.md",
    "benchmark-harness-description.md",
    "supplement-manifest.json",
  ].map((file) => relativeArtifact(path.join(SUPPLEMENT_ROOT, file)));
}

async function writeStatusArtifacts() {
  const e5 = await endToEndNotebookStatus();
  await writeHardwareScaling();
  await writeCrossPlatformStatus();
  return e5;
}

async function endToEndNotebookStatus() {
  const status = {
    schemaVersion: "msig.end_to_end_notebook_benchmark_status.v1",
    generatedAt,
    environment,
    status: "not_possible",
    requestedBenchmark: "Demo notebook default fit-and-review path at 120 and 500 TCGA Lung-AdenoCA SBS96 samples in Firefox, network excluded.",
    reason: "The requested 120- and 500-sample TCGA Lung-AdenoCA SBS96 input was not available from local repository artifacts or tested public mSigPortal TCGA queries on this host.",
    attemptedQueries: [
      "study=TCGA&cancer=Lung-AdenoCA&strategy=WGS&profile=SBS&matrix=96",
      "study=TCGA&cancer=Lung-AdenoCA&strategy=WES&profile=SBS&matrix=96",
      "study=TCGA&cancer=LUAD&strategy=WES&profile=SBS&matrix=96",
    ],
    figure5: "not generated; do not use a synthetic replacement for manuscript claims",
  };
  const jsonPath = path.join(E5_DATA_DIR, "end-to-end-notebook-benchmark-status.json");
  await writeJson(jsonPath, status);
  await writeText(
    path.join(EXPERIMENT_ROOT, "e5_end_to_end_notebook_benchmark", "end-to-end-notebook-benchmark-summary.md"),
    [
      "# End-to-End Notebook Benchmark Status",
      "",
      `Status: ${status.status}`,
      status.reason,
      "",
      "Figure 5 was not generated because the requested source data were unavailable and synthetic replacements would not support the manuscript claim.",
      "",
    ].join("\n")
  );
  await writeText(
    path.join(FIGURE_ROOT, "figure5-end-to-end-notebook-runtime.NOT_GENERATED.md"),
    [
      "# Figure 5 Not Generated",
      "",
      status.reason,
      "",
      `Status artifact: ${relativeArtifact(jsonPath)}`,
      "",
    ].join("\n")
  );
  return { statusArtifact: relativeArtifact(jsonPath), status };
}

async function writeHardwareScaling() {
  const summaryRows = parseCsv(await readFile(path.join(EXPERIMENT_ROOT, "e4_browser_runtime_benchmarks", "data", "browser_runtime_summary.csv"), "utf8"));
  const warmRows = summaryRows.filter((row) => row.phase === "warm");
  const maxHeap = Math.max(...summaryRows.map((row) => Number(row.max_js_heap_bytes) || 0));
  const characterization = {
    schemaVersion: "msig.hardware_scaling_characterization.v1",
    generatedAt,
    environment,
    status: "partial",
    evidenceBasis: "Exposure-solve browser benchmark only; requested end-to-end notebook 120/500 benchmark was not possible.",
    bindingConstraint: "For measured exposure-solve scenarios, warm-start time is dominated by local pure-JS compute. The code path records no worker use for bootstrapSignatureFit, and strictLocal no-egress evidence rules out API calls in the local workflow. The requested cohort-scale end-to-end bootstrap dominance was not measured.",
    measuredPeakJsHeapBytes: maxHeap,
    hostWorked: {
      ramGb: environment.memoryGb,
      logicalCpus: environment.cpus,
    },
    recommendations: [
      {
        workload: "single-sample exposure solve/report",
        measuredOnHost: "completed in all three Windows browsers; warm medians in browser_runtime_summary.csv",
        minimumEvidence: "No lower-RAM host was tested; do not cite a measured minimum below this host.",
      },
      {
        workload: "about 120-sample exposure solve",
        measuredOnHost: "completed in all three Windows browsers; warm medians in browser_runtime_summary.csv",
        minimumEvidence: "No lower-RAM host was tested; end-to-end fit-and-review with all-sample bootstrap was not measured.",
      },
      {
        workload: "about 300-sample exposure solve",
        measuredOnHost: "completed in all three Windows browsers for synthetic 300x40 exposure-solve benchmark",
        minimumEvidence: "No lower-RAM host or upper-bound stress test was run.",
      },
    ],
    warmScenarioRows: warmRows,
  };
  const jsonPath = path.join(HARDWARE_DATA_DIR, "hardware-scaling-characterization.json");
  await writeJson(jsonPath, characterization);
  await writeText(
    path.join(EXPERIMENT_ROOT, "hardware_scaling_characterization", "hardware-scaling-summary.md"),
    [
      "# Hardware and Scaling Characterization",
      "",
      `Status: ${characterization.status}`,
      characterization.bindingConstraint,
      "",
      `Measured host: ${environment.cpus} logical CPUs, ${environment.memoryGb} GiB RAM.`,
      `Largest reported JS heap among measured exposure-solve rows: ${formatInteger(maxHeap)} bytes.`,
      "",
      "No macOS/Linux host, lower-RAM host, or upper-bound stress test was available in this run.",
      "",
    ].join("\n")
  );
}

async function writeCrossPlatformStatus() {
  const status = {
    schemaVersion: "msig.cross_platform_status.v1",
    generatedAt,
    environment,
    status: "not_possible",
    reason: "Only the Windows host represented by this Codex workspace was available. No macOS or Linux host was available for direct benchmark execution.",
  };
  const jsonPath = path.join(CROSS_PLATFORM_DATA_DIR, "cross-platform-availability.json");
  await writeJson(jsonPath, status);
  await writeText(
    path.join(EXPERIMENT_ROOT, "cross_platform_runs", "cross-platform-summary.md"),
    [
      "# Cross-Platform Runs",
      "",
      `Status: ${status.status}`,
      status.reason,
      "",
    ].join("\n")
  );
}

async function writeAssetIndex(tableArtifacts, supplementArtifacts) {
  const figureFiles = [
    "figure1-architecture-data-residency",
    "figure2-zero-install-cumulative-timing",
    "figure3-public-cohort-capability",
    "figure4-exposure-solve-benchmarks",
  ].flatMap((base) => [".svg", ".pdf", ".png"].map((ext) => `docs/manuscript/figures/${base}${ext}`));
  const payload = {
    schemaVersion: "msig.revision_asset_index.v1",
    generatedAt,
    environment,
    regenerationCommand: "node scripts/manuscript/generate-revision-assets.mjs",
    figures: figureFiles,
    figure5: "docs/manuscript/figures/figure5-end-to-end-notebook-runtime.NOT_GENERATED.md",
    tables: tableArtifacts,
    supplement: supplementArtifacts,
  };
  await writeJson(path.join(MANUSCRIPT_ROOT, "revision-asset-index.json"), payload);
}

async function writeFigureSet(fileBase, svg) {
  const svgPath = path.join(FIGURE_ROOT, `${fileBase}.svg`);
  const htmlPath = path.join(FIGURE_ROOT, `${fileBase}.html`);
  const pngPath = path.join(FIGURE_ROOT, `${fileBase}.png`);
  const pdfPath = path.join(FIGURE_ROOT, `${fileBase}.pdf`);
  await writeText(svgPath, svg);
  await writeText(htmlPath, htmlPage(svg));
  await renderSvg(svg, pngPath, pdfPath);
  return [svgPath, pdfPath, pngPath];
}

async function renderSvg(svg, pngPath, pdfPath) {
  const viewBox = parseViewBox(svg);
  const browserPath = browserCandidates().find((candidate) => candidate.id === "chrome" && existsSync(candidate.executablePath))?.executablePath ||
    browserCandidates().find((candidate) => candidate.id === "edge" && existsSync(candidate.executablePath))?.executablePath;
  if (!browserPath) {
    await writeText(`${pngPath}.NOT_GENERATED.txt`, "Chrome/Edge was not found for PNG/PDF rendering.\n");
    return;
  }
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: Math.ceil(viewBox.width), height: Math.ceil(viewBox.height) }, deviceScaleFactor: 2 });
    await page.setContent(htmlPage(svg), { waitUntil: "load" });
    await page.locator("svg").screenshot({ path: pngPath, omitBackground: false });
    await page.pdf({
      path: pdfPath,
      width: `${Math.ceil(viewBox.width)}px`,
      height: `${Math.ceil(viewBox.height)}px`,
      printBackground: true,
      margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
    });
    await page.close();
  } finally {
    await browser.close();
  }
}

function svgDocument(width, height, bodyParts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill: ${PALETTE.ink}; letter-spacing: 0; }
    .white { fill: #ffffff !important; }
    .title { font-size: 34px; font-weight: 700; }
    .subtitle { font-size: 18px; fill: ${PALETTE.muted}; }
    .label { font-size: 17px; }
    .small { font-size: 14px; fill: ${PALETTE.muted}; }
    .strong { font-weight: 700; fill: ${PALETTE.ink}; }
    .value { font-size: 20px; font-weight: 700; }
    .axis-title { font-size: 15px; font-weight: 700; fill: ${PALETTE.muted}; }
  </style>
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  ${bodyParts.join("\n  ")}
</svg>
`;
}

function htmlPage(svg) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:white;}svg{display:block;}</style></head><body>${svg}</body></html>`;
}

function titleBlock(x, y, title, subtitle) {
  return `<text x="${x}" y="${y}" class="title">${escapeXml(title)}</text><text x="${x}" y="${y + 32}" class="subtitle">${escapeXml(subtitle)}</text>`;
}

function box(x, y, w, h, title, lines, color) {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#ffffff" stroke="${color}" stroke-width="3"/>
    <text x="${x + 24}" y="${y + 42}" class="label strong">${escapeXml(title)}</text>
    ${lines.map((line, index) => `<text x="${x + 28}" y="${y + 82 + index * 30}" class="label">${escapeXml(line)}</text>`).join("")}
  </g>`;
}

function arrow(x1, y1, x2, y2, label, color) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - 12;
  return `<defs><marker id="arrow-${Math.round(x1)}-${Math.round(y1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker></defs>
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3" marker-end="url(#arrow-${Math.round(x1)}-${Math.round(y1)})"/>
    <text x="${mx}" y="${my}" text-anchor="middle" class="small">${escapeXml(label)}</text>`;
}

function panelFrame(x, y, w, h, letter, title) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#ffffff" stroke="${PALETTE.faint}"/>
    <circle cx="${x + 34}" cy="${y + 34}" r="18" fill="${PALETTE.ink}"/><text x="${x + 34}" y="${y + 41}" text-anchor="middle" class="white" font-size="17" font-weight="700">${letter}</text>
    <text x="${x + 64}" y="${y + 40}" class="label strong">${escapeXml(title)}</text>`;
}

function statCard(x, y, label, value, color = PALETTE.ink) {
  return `<rect x="${x}" y="${y}" width="160" height="62" rx="8" fill="#f8fbfd" stroke="${PALETTE.faint}"/>
    <text x="${x + 14}" y="${y + 23}" class="small strong">${escapeXml(label)}</text>
    <text x="${x + 14}" y="${y + 50}" class="value" style="fill:${color}">${escapeXml(value)}</text>`;
}

function wrapText(text, x, y, maxChars = 18, anchor = "start", className = "small") {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.map((value, index) => `<text x="${x}" y="${y + index * 19}" text-anchor="${anchor}" class="${className}">${escapeXml(value)}</text>`);
}

function parseViewBox(svg) {
  const match = String(svg).match(/viewBox="([^"]+)"/);
  if (!match) return { width: 1200, height: 800 };
  const [, , width, height] = match[1].split(/\s+/).map(Number);
  return { width, height };
}

function parseCsv(text) {
  const rows = [];
  const lines = String(text).trim().split(/\r?\n/);
  if (!lines.length) return rows;
  const header = splitCsvLine(lines[0]);
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const row = {};
    header.forEach((key, index) => {
      row[key] = cells[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted && ch === '"' && line[i + 1] === '"') {
      value += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(value);
      value = "";
    } else {
      value += ch;
    }
  }
  cells.push(value);
  return cells;
}

function markdownTable(rows, title) {
  if (!rows.length) return `# ${title}\n\nNo rows.\n`;
  const columns = Object.keys(rows[0]);
  return [
    `# ${title}`,
    "",
    `Generated at: ${generatedAt}`,
    "",
    `| ${columns.map(escapeMd).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => escapeMd(row[column])).join(" | ")} |`),
    "",
  ].join("\n");
}

function joinBySample(left, right) {
  const rightBySample = new Map(right.map((row) => [row.sample, row]));
  return left.map((row) => ({ ...row, ...(rightBySample.get(row.sample) || {}) }));
}

async function copyArtifact(source, target) {
  await ensureDir(path.dirname(target));
  if (existsSync(source)) {
    await copyFile(source, target);
  }
}

function mutationClass(context) {
  const match = String(context).match(/\[([ACGT]>[ACGT])\]/);
  return match?.[1] || "other";
}

function quantile(values, q) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "NA";
}

function formatInteger(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)).toLocaleString("en-US") : "NA";
}

function formatTick(value) {
  if (value >= 1000) return `${value / 1000}k`;
  return String(value);
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeMd(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, "<br>");
}
