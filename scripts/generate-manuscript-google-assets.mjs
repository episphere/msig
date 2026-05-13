#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MANUSCRIPT_DIR = "docs/manuscript";
const TABLE_DIR = join(MANUSCRIPT_DIR, "google-doc-tables");
const FIGURE_PAGE_DIR = join(MANUSCRIPT_DIR, "actual-figure-pages");
const ASSET_PLAN_MD = join(MANUSCRIPT_DIR, "MANUSCRIPT_ASSET_PLAN.md");
const BENCHMARK_JSON = join(MANUSCRIPT_DIR, "benchmark-results.json");
const LOW_BURDEN_JSON = join(MANUSCRIPT_DIR, "low-burden-stress-test.json");

const tableStyle = [
  "border-collapse:collapse",
  "width:100%",
  "font-family:Arial, Helvetica, sans-serif",
  "font-size:10.5pt",
  "line-height:1.25",
  "color:#1f2933",
].join(";");

const thStyle = [
  "border:1px solid #9aa5b1",
  "background:#eef2f7",
  "padding:6px 8px",
  "text-align:left",
  "font-weight:700",
  "vertical-align:top",
].join(";");

const tdStyle = [
  "border:1px solid #c8d1dc",
  "padding:6px 8px",
  "vertical-align:top",
].join(";");

const captionStyle = [
  "font-family:Arial, Helvetica, sans-serif",
  "font-size:11pt",
  "line-height:1.3",
  "margin:0 0 6px 0",
  "color:#111827",
].join(";");

const noteStyle = [
  "font-family:Arial, Helvetica, sans-serif",
  "font-size:9.5pt",
  "line-height:1.3",
  "margin:6px 0 20px 0",
  "color:#4b5563",
].join(";");

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmt(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "NA";
}

function scriptJson(value) {
  return JSON.stringify(value).replaceAll("</", "<\\/");
}

function htmlTable({ number, title, headers, rows, note }) {
  const caption = `<p style="${captionStyle}"><strong>Table ${esc(number)}.</strong> ${esc(title)}</p>`;
  const thead = `<thead><tr>${headers
    .map((header) => `<th style="${thStyle}">${esc(header)}</th>`)
    .join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map(
      (row, rowIndex) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="${tdStyle};${rowIndex % 2 === 1 ? "background:#fbfcfe;" : ""}">${cell}</td>`
          )
          .join("")}</tr>`
    )
    .join("")}</tbody>`;
  const noteHtml = note ? `<p style="${noteStyle}"><em>Note.</em> ${note}</p>` : "";

  return `${caption}
<table style="${tableStyle}">
${thead}
${tbody}
</table>
${noteHtml}`;
}

function fullHtml(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
</head>
<body>
${body}
</body>
</html>
`;
}

async function readJsonIfExists(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (_error) {
    return fallback;
  }
}

function benchmarkRows(payload) {
  const rows = payload.rows || [];
  const wanted = [
    ["validation_qc", "Validation, mutation burden, and context coverage", null],
    ["nnls_fit", "Local NNLS known-signature fitting", null],
    ["reconstruction_metrics", "Reconstruction and residual metrics", null],
    ["threshold_sensitivity", "Threshold sensitivity, five thresholds", null],
    ["bootstrap_one_sample", "Bootstrap uncertainty, one sample, 100 iterations", 100],
    ["bootstrap_one_sample", "Bootstrap uncertainty, one sample, 500 iterations", 500],
    ["nmf_rank_selection", "Exploratory NMF rank selection", null],
    ["nmf_extract_recommended_rank", "Exploratory NMF extraction", null],
  ];

  return wanted.flatMap(([operation, label, iterations]) =>
    rows
      .filter((row) => row.operation === operation)
      .filter((row) => iterations === null || row.iterations === iterations)
      .filter((row) => [10, 100, 1000].includes(row.samples) || operation.startsWith("nmf"))
      .filter((row) => !operation.startsWith("nmf") || [10, 100].includes(row.samples))
      .sort((a, b) => a.samples - b.samples)
      .map((row) => [
        esc(label),
        esc(row.samples),
        esc(row.contexts),
        esc(row.signatures || "NA"),
        esc(row.iterations || "NA"),
        esc(Array.isArray(row.thresholds) ? row.thresholds.join(", ") : "NA"),
        esc(Array.isArray(row.ranks) ? row.ranks.join(", ") : "NA"),
        esc(fmt(row.runtimeMs, 1)),
        esc(fmt(row.heapAfterMB, 2)),
        esc(fmt(row.rssAfterMB, 2)),
      ])
  );
}

function createTables(benchmarkPayload, lowBurdenPayload) {
  const table1 = htmlTable({
    number: "1",
    title: "Researcher-facing capabilities implemented in the revised mSigSDK.",
    headers: [
      "Capability",
      "What mutational signature researchers can do",
      "SDK functions or modules",
      "Manuscript evidence",
    ],
    rows: [
      [
        "Public signature and cohort access",
        "Retrieve mSigPortal reference signatures, cohort spectra, signature activity, association, prevalence, and etiology resources without custom API code.",
        "mSigSDK.mSigPortal.mSigPortalData",
        "Figure 1; Table 2",
      ],
      [
        "Domain-standard mutation profile displays",
        "Render SBS, DBS, ID, and RS profile plots and observed-vs-reconstructed SBS96 comparisons using familiar COSMIC/mSigPortal visual grammar.",
        "mSigSDK.mSigPortal.mSigPortalPlots.plotPatientMutationalSpectrum; mSigSDK.qcPlots.plotFitResiduals",
        "Figure 1; Figure 2",
      ],
      [
        "Cohort similarity exploration",
        "Compare sample spectra by cosine similarity, reorder samples by clustering, and inspect cohort structure before fitting or extraction.",
        "plotCosineSimilarityHeatMap; plotForceDirectedTree; plotUMAPVisualization",
        "Figure 1",
      ],
      [
        "Known-signature fitting",
        "Fit user or public spectra to selected reference signatures locally with NNLS and explicit thresholding/renormalization choices.",
        "mSigSDK.signatureFitting.fitMutationalSpectraToSignatures; mSigSDK.qc.fitSpectraWithNNLS",
        "Figure 2; Table 3",
      ],
      [
        "Double-clustered exposure heatmap",
        "Inspect sample-by-signature exposure patterns with row/column clustering to identify dominant processes and sample groups.",
        "plotDatasetMutationalSignaturesExposure",
        "Figure 2",
      ],
      [
        "Fit quality control",
        "Flag low-burden spectra, missing contexts, weak reconstruction, and structured residuals before biological interpretation.",
        "mSigSDK.validation; mSigSDK.qc; mSigSDK.qcPlots",
        "Figure 2; Figure 3",
      ],
      [
        "Uncertainty and threshold sensitivity",
        "Quantify exposure uncertainty by bootstrap resampling and test whether interpretation changes across exposure thresholds.",
        "bootstrapSignatureFit; runThresholdSensitivity; plotBootstrapConfidenceIntervals; plotThresholdSensitivity",
        "Figure 3",
      ],
      [
        "Exploratory de novo extraction",
        "Run browser-sized NMF extraction, inspect rank diagnostics, compare extracted signatures to references, and visualize extracted exposures.",
        "mSigSDK.signatureExtraction; mSigSDK.signatureExtractionPlots",
        "Figure 4; Table 3",
      ],
      [
        "Interoperability and reporting",
        "Round-trip SigProfiler/COSMIC-style matrices, create structured reports, and attach provenance to browser analyses.",
        "mSigSDK.io; mSigSDK.reports; mSigSDK.provenance; mSigSDK.workflows",
        "Supplementary table or methods text",
      ],
    ],
    note:
      "Capabilities are reported as implemented software functions in the current SDK, separating local analytical modules from public resource access and visualization.",
  });

  const table2 = htmlTable({
    number: "2",
    title: "Data source, computation locus, and privacy boundary.",
    headers: ["Workflow", "Computed locally in browser", "External dependency", "Privacy interpretation"],
    rows: [
      ["mSigPortal reference signature retrieval", "No", "mSigPortal API", "Public reference data only"],
      ["mSigPortal cohort exploration", "Partial", "mSigPortal API", "Uses public or portal-hosted data"],
      ["TCGA/GDC helper workflows", "Partial", "TCGA/GDC endpoints", "Depends on upstream data access rules"],
      ["User MAF or spectra validation", "Yes", "None", "User data can remain local"],
      ["Known-signature NNLS fitting", "Yes", "Optional reference-signature fetch", "User spectra can remain local"],
      ["Mutation burden, context coverage, reconstruction, and residual QC", "Yes", "None", "Local"],
      ["Bootstrap intervals and threshold sensitivity", "Yes", "None", "Local; runtime scales with iterations and thresholds"],
      ["Exploratory NMF extraction and rank diagnostics", "Yes", "None", "Local; intended for moderate browser-sized datasets"],
      ["Plot rendering and report/provenance generation", "Yes", "Plotting libraries loaded in browser", "Local unless user exports or shares output"],
    ],
    note:
      "The privacy boundary refers to user-supplied mutation data after import. Public reference and cohort queries remain external API interactions and should be described separately from local computation.",
  });

  const table3 = htmlTable({
    number: "3",
    title: "Core compute benchmarks for local mSigSDK workflows.",
    headers: [
      "Operation",
      "Samples",
      "Contexts",
      "Signatures",
      "Iterations",
      "Thresholds",
      "Ranks",
      "Runtime, ms",
      "Heap after, MB",
      "RSS after, MB",
    ],
    rows: benchmarkRows(benchmarkPayload),
    note:
      "Benchmarks were run on Windows x64 with Node.js v16.16.0, Intel Core i7-11700K CPU, and 16 GB RAM. Memory values are approximate process-level Node.js measurements; browser rendering and heap measurements should be reported separately.",
  });

  const lowBurdenRows = (lowBurdenPayload.rows || []).map((row) => [
    esc(row.burden),
    esc(row.samples),
    esc(row.lowBurdenFlagged),
    esc(fmt(row.averageCosineSimilarity, 3)),
    esc(fmt(row.averageRmse, 4)),
    esc(fmt(row.averageActiveSignatures, 2)),
    esc(fmt(row.averageBootstrapCiWidth, 3)),
    esc(fmt(row.thresholdCosineRange, 4)),
  ]);

  const table4 = htmlTable({
    number: "4",
    title: "Controlled low-mutation-burden stress test.",
    headers: [
      "Mutations per sample",
      "Samples",
      "Low-burden samples flagged",
      "Mean reconstruction cosine",
      "Mean RMSE",
      "Mean active signatures",
      "Mean bootstrap CI width",
      "Threshold cosine range",
    ],
    rows: lowBurdenRows,
    note:
      "The stress test uses controlled spectra to isolate mutation-burden effects. It should be discussed as complementary evidence, not as a substitute for a real rare-cancer cohort analysis.",
  });

  const table5 = htmlTable({
    number: "5",
    title: "Functional comparison with related mutational-signature tools.",
    headers: [
      "Tool or platform",
      "Primary role",
      "Browser SDK",
      "Local user-data fitting",
      "De novo extraction",
      "QC/uncertainty",
      "How to position mSigSDK",
    ],
    rows: [
      [
        "mSigPortal",
        "Public portal and API for mutational-signature resources",
        "No",
        "Portal/API dependent",
        "Portal/server workflow",
        "Portal-specific",
        "mSigSDK provides a reusable browser SDK layer over public resources plus local analysis modules.",
      ],
      [
        "SigProfilerExtractor",
        "Production mutational-signature extraction pipeline",
        "No",
        "Yes, local Python workflow",
        "Yes",
        "Pipeline diagnostics",
        "Complementary: use for production extraction; use mSigSDK for web-native exploration, QC, reporting, and embedding.",
      ],
      [
        "SigProfilerAssignment",
        "Signature attribution/decomposition",
        "No",
        "Yes, local Python workflow",
        "No",
        "Assignment diagnostics",
        "Complementary assignment tool; mSigSDK emphasizes browser integration and visualization/report layers.",
      ],
      [
        "MutationalPatterns",
        "R/Bioconductor toolkit for signature analysis and visualization",
        "No",
        "Yes, local R workflow",
        "Yes/associated workflows",
        "Yes",
        "Complementary R environment; mSigSDK targets JavaScript/browser-native reuse.",
      ],
      [
        "deconstructSigs",
        "Known-signature decomposition in R",
        "No",
        "Yes, local R workflow",
        "No",
        "Limited compared with current QC workflows",
        "Established decomposition comparator; mSigSDK adds browser-side QC, uncertainty, and reporting.",
      ],
      [
        "AI-assisted genomic visualization interfaces",
        "Interactive visualization or assistant-driven exploration",
        "Varies",
        "Task-dependent",
        "Task-dependent",
        "Task-dependent",
        "Direct benchmarking requires a versioned tool and reproducible same-task protocol; mSigSDK provides deterministic SDK workflows that can serve as the comparator task definition.",
      ],
    ],
    note:
      "The comparison describes functional scope rather than performance superiority. Versioned citations and URLs should be included in the final manuscript reference list.",
  });

  return [
    ["table1-researcher-capabilities.html", table1],
    ["table2-execution-privacy.html", table2],
    ["table3-compute-benchmarks.html", table3],
    ["table4-low-burden-stress-test.html", table4],
    ["table5-related-tools.html", table5],
  ];
}

function figureShell({ title, subtitle, bodyScript }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    body {
      margin: 0;
      padding: 28px;
      background: #ffffff;
      color: #172033;
      font-family: Arial, Helvetica, sans-serif;
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: 26px;
      line-height: 1.2;
    }
    .subtitle {
      margin: 0 0 20px 0;
      color: #55606f;
      font-size: 14px;
      line-height: 1.45;
      max-width: 1180px;
    }
    .status {
      padding: 10px 12px;
      border: 1px solid #c8d1dc;
      border-radius: 6px;
      color: #44515f;
      background: #f7f9fc;
      margin-bottom: 18px;
      max-width: 1180px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      align-items: start;
    }
    .panel {
      border: 1px solid #c8d1dc;
      border-radius: 6px;
      padding: 12px;
      background: #ffffff;
      min-height: 360px;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .panel-title {
      margin: 0 0 8px 0;
      font-size: 15px;
      font-weight: 700;
      color: #172033;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #c8d1dc;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #eef2f7;
    }
    .msig-download-btn,
    .modebar,
    .modebar-container {
      display: none !important;
    }
    @media print {
      body { padding: 10px; }
      .panel { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="subtitle">${esc(subtitle)}</p>
  <div id="status" class="status">Loading mSigSDK and figure data...</div>
  <div class="grid">
${bodyScript.panels}
  </div>
  <script type="module">
${bodyScript.script}
  </script>
</body>
</html>
`;
}

const commonFigureHelpers = `
const status = document.getElementById("status");
function setStatus(message) {
  status.textContent = message;
  if (String(message).startsWith("Rendered ")) {
    status.setAttribute("hidden", "");
  } else {
    status.removeAttribute("hidden");
  }
}
function panelError(id, error) {
  const element = document.getElementById(id);
  if (element) {
    element.innerHTML = "<p style='color:#b42318'>Could not render panel: " + String(error.message || error) + "</p>";
  }
}
function subsetObject(object, names) {
  return Object.fromEntries(names.map((name) => [name, object[name]]).filter(([, value]) => value));
}
function signatureSubset(allReferenceSignatures, names, fallbackCount = 8) {
  const selected = names.filter((name) => allReferenceSignatures[name]);
  const finalNames = selected.length ? selected : Object.keys(allReferenceSignatures).slice(0, fallbackCount);
  return subsetObject(allReferenceSignatures, finalNames);
}
function rowsToTable(id, headers, rows) {
  const table = document.createElement("table");
  table.innerHTML =
    "<thead><tr>" + headers.map((header) => "<th>" + header + "</th>").join("") + "</tr></thead>" +
    "<tbody>" + rows.map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>").join("") + "</tbody>";
  document.getElementById(id).appendChild(table);
}
async function loadSdk() {
  const sdkUrl = new URL("../../../main.js", import.meta.url).href;
  const { mSigSDK } = await import(sdkUrl + "?v=manuscript-real-figures");
  return mSigSDK;
}
async function loadPCAWGLungData(mSigSDK) {
  const contexts = mSigSDK.validation.getExpectedContexts({ profile: "SBS", matrix: 96 });
  const study = "PCAWG";
  const genomeDataType = "WGS";
  const cancerType = "Lung-AdenoCA";
  const mutationType = "SBS";
  const matrixSize = 96;
  const signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96";
  const [rawSpectrumRows, rawSignatureRows] = await Promise.all([
    mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData(study, null, genomeDataType, cancerType, mutationType, matrixSize),
    mSigSDK.mSigPortal.mSigPortalData.getMutationalSignaturesData(genomeDataType, signatureSetName, mutationType, matrixSize, 10000),
  ]);
  const spectrumRows = Array.isArray(rawSpectrumRows) ? rawSpectrumRows.flat() : [];
  const signatureRows = Array.isArray(rawSignatureRows) ? rawSignatureRows.flat() : [];
  const groupedSpectra = mSigSDK.mSigPortal.mSigPortalData.extractMutationalSpectra(spectrumRows);
  const referenceSignatures = mSigSDK.mSigPortal.mSigPortalData.extractMutationalSpectra(signatureRows, "signatureName");
  const burden = mSigSDK.qc.summarizeMutationBurden(groupedSpectra, { expectedContexts: contexts });
  const sampleNames = burden.samples
    .filter((sample) => sample.totalMutations > 0)
    .sort((a, b) => b.totalMutations - a.totalMutations)
    .map((sample) => sample.sample);
  return { contexts, study, genomeDataType, cancerType, mutationType, matrixSize, signatureSetName, groupedSpectra, referenceSignatures, burden, sampleNames };
}
`;

function createFigurePages(lowBurdenPayload = { rows: [] }) {
  const figure1 = figureShell({
    title: "Figure 1. Cohort exploration and similarity structure generated by mSigSDK",
    subtitle:
      "Actual mSigSDK visualizations for PCAWG Lung-AdenoCA SBS96 spectra: cohort burden, profile inspection, clustered cosine similarity, force-directed similarity tree, and UMAP projection.",
    bodyScript: {
      panels: `
    <section class="panel"><p class="panel-title">A. Mutation burden summary</p><div id="fig1Burden"></div></section>
    <section class="panel"><p class="panel-title">B. SBS96 profile comparison for two samples</p><div id="fig1Spectrum"></div></section>
    <section class="panel wide"><p class="panel-title">C. Double-clustered cosine similarity heatmap</p><div id="fig1Cosine"></div></section>
    <section class="panel"><p class="panel-title">D. Force-directed similarity tree</p><div id="fig1Tree" style="height:650px"></div></section>
    <section class="panel"><p class="panel-title">E. UMAP projection of mutational spectra</p><div id="fig1Umap"></div></section>`,
      script: `${commonFigureHelpers}
try {
  const mSigSDK = await loadSdk();
  const data = await loadPCAWGLungData(mSigSDK);
  const selected = data.sampleNames.slice(0, 24);
  const selectedSpectra = subsetObject(data.groupedSpectra, selected);
  const selectedBurden = mSigSDK.qc.summarizeMutationBurden(selectedSpectra, {
    expectedContexts: data.contexts,
    lowBurdenThreshold: 100,
    lowBurdenThresholdMode: "fixed",
  });
  await mSigSDK.qcPlots.plotMutationBurdenSummary(document.getElementById("fig1Burden"), selectedBurden);
  await mSigSDK.mSigPortal.mSigPortalPlots.plotPatientMutationalSpectrum(
    subsetObject(data.groupedSpectra, [selected[0], selected[1]]),
    "fig1Spectrum"
  );
  await mSigSDK.mSigPortal.mSigPortalPlots.plotCosineSimilarityHeatMap(
    selectedSpectra, data.study, data.genomeDataType, data.cancerType, "fig1Cosine", true, "Viridis", false
  );
  await mSigSDK.mSigPortal.mSigPortalPlots.plotForceDirectedTree(
    selectedSpectra, data.study, data.genomeDataType, data.cancerType, "fig1Tree"
  );
  await mSigSDK.mSigPortal.mSigPortalPlots.plotUMAPVisualization(
    selectedSpectra, data.study + " " + data.cancerType, "fig1Umap", 2, 0.1, 8
  );
  setStatus("Rendered from mSigSDK " + mSigSDK.version + " using " + selected.length + " PCAWG Lung-AdenoCA samples.");
} catch (error) {
  console.error(error);
  setStatus("Figure rendering failed: " + error.message);
}`,
    },
  });

  const figure2 = figureShell({
    title: "Figure 2. Local known-signature fitting and exposure interpretation",
    subtitle:
      "Actual mSigSDK local NNLS fitting of PCAWG Lung-AdenoCA spectra against selected COSMIC SBS96 signatures, followed by clustered exposure visualization, sample exposure pie chart, reconstruction metrics, and residual profile review.",
    bodyScript: {
      panels: `
    <section class="panel wide"><p class="panel-title">A. Double-clustered relative exposure heatmap</p><div id="fig2Heatmap"></div></section>
    <section class="panel"><p class="panel-title">B. Single-sample exposure pie chart</p><div id="fig2Pie"></div></section>
    <section class="panel"><p class="panel-title">C. Reconstruction quality</p><div id="fig2Reconstruction"></div></section>
    <section class="panel wide"><p class="panel-title">D. Observed vs reconstructed residual profile</p><div id="fig2Residual"></div></section>`,
      script: `${commonFigureHelpers}
try {
  const mSigSDK = await loadSdk();
  const data = await loadPCAWGLungData(mSigSDK);
  const selected = data.sampleNames.slice(0, 18);
  const spectra = subsetObject(data.groupedSpectra, selected);
  const preferred = ["SBS1", "SBS2", "SBS4", "SBS5", "SBS13", "SBS17a", "SBS17b", "SBS18", "SBS40"];
  const signatures = signatureSubset(data.referenceSignatures, preferred, 9);
  const exposures = await mSigSDK.signatureFitting.fitMutationalSpectraToSignatures(signatures, spectra, {
    exposureThreshold: 0.01,
    exposureType: "relative",
    renormalize: true,
  });
  const reconstruction = mSigSDK.qc.calculateReconstructionError(signatures, spectra, exposures, { contexts: data.contexts });
  const residuals = mSigSDK.qc.calculateFitResiduals(signatures, spectra, exposures, { contexts: data.contexts });
  const residualSample = reconstruction.samples.slice().sort((a, b) => a.cosineSimilarity - b.cosineSimilarity)[0]?.sample || selected[0];
  await mSigSDK.signatureFitting.plotDatasetMutationalSignaturesExposure(exposures, "fig2Heatmap", true, "PCAWG Lung-AdenoCA local NNLS", true, "Viridis");
  await mSigSDK.signatureFitting.plotPatientMutationalSignaturesExposure(exposures, "fig2Pie", residualSample);
  await mSigSDK.qcPlots.plotReconstructionError(document.getElementById("fig2Reconstruction"), reconstruction);
  await mSigSDK.qcPlots.plotFitResiduals(document.getElementById("fig2Residual"), residuals, residualSample);
  setStatus("Rendered local NNLS fitting for " + selected.length + " samples and " + Object.keys(signatures).length + " reference signatures.");
} catch (error) {
  console.error(error);
  setStatus("Figure rendering failed: " + error.message);
}`,
    },
  });

  const figure3 = figureShell({
    title: "Figure 3. Quality control, uncertainty, and threshold robustness",
    subtitle:
      "Actual mSigSDK QC and uncertainty plots: mutation burden flags, bootstrap confidence intervals, and threshold sensitivity for known-signature fitting.",
    bodyScript: {
      panels: `
    <section class="panel wide"><p class="panel-title">A. Mutation burden QC</p><div id="fig3Burden"></div></section>
    <section class="panel wide"><p class="panel-title">B. Bootstrap exposure confidence intervals</p><div id="fig3Bootstrap"></div></section>
    <section class="panel wide"><p class="panel-title">C. Threshold sensitivity atlas</p><div id="fig3Threshold"></div></section>
    <section class="panel wide"><p class="panel-title">D. Controlled low-burden stress test</p><div id="fig3LowBurden"></div></section>`,
      script: `${commonFigureHelpers}
try {
  const mSigSDK = await loadSdk();
  const data = await loadPCAWGLungData(mSigSDK);
  const selected = data.sampleNames.slice(0, 10);
  const spectra = subsetObject(data.groupedSpectra, selected);
  const preferred = ["SBS1", "SBS2", "SBS4", "SBS5", "SBS13", "SBS17a", "SBS17b", "SBS18", "SBS40"];
  const signatures = signatureSubset(data.referenceSignatures, preferred, 9);
  const burden = mSigSDK.qc.summarizeMutationBurden(spectra, {
    expectedContexts: data.contexts,
    lowBurdenThreshold: 100,
    lowBurdenThresholdMode: "fixed",
  });
  await mSigSDK.qcPlots.plotMutationBurdenSummary(document.getElementById("fig3Burden"), burden);
  const bootstrapSample = selected[0];
  const bootstrap = await mSigSDK.qc.bootstrapSignatureFit(signatures, spectra[bootstrapSample], {
    iterations: 80,
    confidenceLevel: 0.95,
    exposureThreshold: 0.01,
    seed: 42,
    contexts: data.contexts,
  });
  await mSigSDK.qcPlots.plotBootstrapConfidenceIntervals(document.getElementById("fig3Bootstrap"), bootstrap);
  const threshold = await mSigSDK.qc.runThresholdSensitivity(signatures, spectra, {
    thresholds: [0, 0.005, 0.01, 0.03, 0.05, 0.1],
    contexts: data.contexts,
  });
  await mSigSDK.qcPlots.plotThresholdSensitivity(document.getElementById("fig3Threshold"), threshold);
  const lowBurden = ${scriptJson(lowBurdenPayload)};
  rowsToTable("fig3LowBurden",
    ["Mutations/sample", "Samples", "Mean cosine", "Mean RMSE", "Mean bootstrap CI width"],
    lowBurden.rows.map((row) => [
      row.burden,
      row.samples,
      row.averageCosineSimilarity.toFixed(3),
      row.averageRmse.toFixed(4),
      row.averageBootstrapCiWidth.toFixed(3),
    ])
  );
  setStatus("Rendered QC and uncertainty panels for " + selected.length + " samples; bootstrap sample: " + bootstrapSample + ".");
} catch (error) {
  console.error(error);
  setStatus("Figure rendering failed: " + error.message);
}`,
    },
  });

  const figure4 = figureShell({
    title: "Figure 4. Exploratory browser-side NMF extraction",
    subtitle:
      "Actual mSigSDK NMF workflow: extracted SBS96 profile plots, sample exposure heatmap, rank diagnostics, and reference-signature matching.",
    bodyScript: {
      panels: `
    <section class="panel wide"><p class="panel-title">A. Extracted SBS96 signature profiles</p><div id="fig4Profiles"></div></section>
    <section class="panel"><p class="panel-title">B. NMF exposure heatmap</p><div id="fig4Exposure"></div></section>
    <section class="panel"><p class="panel-title">C. NMF rank diagnostics</p><div id="fig4Rank"></div></section>
    <section class="panel wide"><p class="panel-title">D. Top reference-signature matches</p><div id="fig4Matches"></div></section>`,
      script: `${commonFigureHelpers}
try {
  const mSigSDK = await loadSdk();
  const data = await loadPCAWGLungData(mSigSDK);
  const selected = data.sampleNames.slice(0, 8);
  const spectra = subsetObject(data.groupedSpectra, selected);
  const nmf = mSigSDK.signatureExtraction.extractSignaturesNMF(spectra, {
    rank: 3,
    nRuns: 4,
    maxIterations: 180,
    tolerance: 1e-5,
    seed: 123,
    contexts: data.contexts,
    signaturePrefix: "NMF",
  });
  const rankSelection = mSigSDK.signatureExtraction.selectNMFRank(spectra, {
    ranks: [2, 3, 4],
    nRuns: 2,
    maxIterations: 120,
    seed: 456,
    contexts: data.contexts,
  });
  const matches = mSigSDK.signatureExtraction.compareExtractedToReference(nmf.signatures, data.referenceSignatures, {
    contexts: data.contexts,
    topN: 3,
  });
  await mSigSDK.signatureExtractionPlots.plotNMFSignatureProfiles(document.getElementById("fig4Profiles"), nmf);
  await mSigSDK.signatureExtractionPlots.plotNMFExposureHeatmap(document.getElementById("fig4Exposure"), nmf, { relative: true });
await mSigSDK.signatureExtractionPlots.plotNMFRankSelection(document.getElementById("fig4Rank"), rankSelection);
  rowsToTable("fig4Matches",
    ["Extracted signature", "Best reference match", "Cosine similarity", "Second match", "Third match"],
    matches.map((row) => [
      row.signatureName,
      row.matches[0]?.referenceName || "NA",
      row.matches[0] ? row.matches[0].cosineSimilarity.toFixed(3) : "NA",
      row.matches[1] ? row.matches[1].referenceName + " (" + row.matches[1].cosineSimilarity.toFixed(3) + ")" : "NA",
      row.matches[2] ? row.matches[2].referenceName + " (" + row.matches[2].cosineSimilarity.toFixed(3) + ")" : "NA",
    ])
  );
  setStatus("Rendered exploratory NMF for " + selected.length + " high-burden samples; selected rank: " + nmf.rank + ".");
} catch (error) {
  console.error(error);
  setStatus("Figure rendering failed: " + error.message);
}`,
    },
  });

  return [
    ["figure1-cohort-exploration.html", figure1],
    ["figure2-known-signature-fitting.html", figure2],
    ["figure3-qc-uncertainty-thresholds.html", figure3],
    ["figure4-nmf-extraction.html", figure4],
  ];
}

function manuscriptAssetPlan() {
  return `# mSigSDK Revised Manuscript Asset Plan

This plan separates manuscript-ready assets from analyses that still need to be completed before BMC Bioinformatics resubmission.

## Main Figures To Include

Rendered PNG captures are available in \`docs/manuscript/actual-figure-pages/screenshots/\`; the HTML pages remain the reproducible source for those captures.

1. **Figure 1. Cohort exploration and similarity structure generated by mSigSDK**  
   File: \`docs/manuscript/actual-figure-pages/figure1-cohort-exploration.html\`  
   Panels: mutation burden summary, SBS96 profile comparison, double-clustered cosine similarity heatmap, force-directed similarity tree, and UMAP projection.  
   Manuscript role: demonstrates researcher-facing cohort exploration and similarity analysis using actual SDK plotting workflows.

2. **Figure 2. Local known-signature fitting and exposure interpretation**  
   File: \`docs/manuscript/actual-figure-pages/figure2-known-signature-fitting.html\`  
   Panels: double-clustered NNLS exposure heatmap, single-sample exposure pie chart, reconstruction quality plot, and observed-vs-reconstructed residual profile.  
   Manuscript role: supports the claim that the revised SDK performs local known-signature fitting and exposes fit quality.

3. **Figure 3. Quality control, uncertainty, and threshold robustness**  
   File: \`docs/manuscript/actual-figure-pages/figure3-qc-uncertainty-thresholds.html\`  
   Panels: mutation burden QC, bootstrap exposure confidence intervals, threshold sensitivity, and controlled low-burden stress-test summary.  
   Manuscript role: directly addresses low mutation burden, uncertainty, and interpretation safeguards.

4. **Figure 4. Exploratory browser-side NMF extraction**  
   File: \`docs/manuscript/actual-figure-pages/figure4-nmf-extraction.html\`  
   Panels: extracted SBS96 signature profiles, NMF exposure heatmap, rank diagnostics, and reference-signature matching.  
   Manuscript role: demonstrates exploratory de novo extraction for browser-sized datasets while preserving clear limitations.

## Main Tables To Include

1. **Table 1. Researcher-facing capabilities implemented in the revised mSigSDK**  
   File: \`docs/manuscript/google-doc-tables/table1-researcher-capabilities.html\`

2. **Table 2. Data source, computation locus, and privacy boundary**  
   File: \`docs/manuscript/google-doc-tables/table2-execution-privacy.html\`

3. **Table 3. Core compute benchmarks for local mSigSDK workflows**  
   File: \`docs/manuscript/google-doc-tables/table3-compute-benchmarks.html\`

4. **Table 4. Controlled low-mutation-burden stress test**  
   File: \`docs/manuscript/google-doc-tables/table4-low-burden-stress-test.html\`

5. **Table 5. Functional comparison with related mutational-signature tools**  
   File: \`docs/manuscript/google-doc-tables/table5-related-tools.html\`

## Results Still Needed Before Submission

1. **Browser rendering benchmark.** Measure render time and approximate browser heap for the final figure panels across at least five repeats in a named browser/version and viewport. This should become a supplementary benchmark table or supplement figure.

2. **Real low-resource or rare-cancer cohort example.** The controlled low-burden stress test is useful, but it does not replace a real salivary gland carcinoma or comparable rare-cancer cohort example if one is accessible.

3. **Versioned related-tool comparison.** Add exact versions, URLs, and citations for SigProfilerExtractor, SigProfilerAssignment, MutationalPatterns, deconstructSigs, mSigPortal, COSMIC, and any selected AI-assisted visualization comparator.

4. **Release/provenance checkpoint.** Record the exact mSigSDK commit or release tag used for benchmark generation, figure rendering, and notebook execution.

## Items Deliberately Not Included As Manuscript Tables

- Figure planning maps.
- Internal task lists.
- Aspirational interoperability claims without implemented evidence.
- Unversioned AI-platform benchmarking claims.
`;
}

async function main() {
  await mkdir(TABLE_DIR, { recursive: true });
  await mkdir(FIGURE_PAGE_DIR, { recursive: true });

  const benchmarkPayload = await readJsonIfExists(BENCHMARK_JSON, { rows: [] });
  const lowBurdenPayload = await readJsonIfExists(LOW_BURDEN_JSON, { rows: [] });

  const tables = createTables(benchmarkPayload, lowBurdenPayload);
  for (const [filename, content] of tables) {
    await writeFile(join(TABLE_DIR, filename), fullHtml(filename, content));
  }
  await writeFile(
    join(TABLE_DIR, "all-google-doc-tables.html"),
    fullHtml("mSigSDK manuscript tables", tables.map(([, content]) => content).join("\n<hr style=\"border:0;border-top:1px solid #d0d7e2;margin:22px 0;\">\n"))
  );

  const figurePages = createFigurePages(lowBurdenPayload);
  for (const [filename, content] of figurePages) {
    await writeFile(join(FIGURE_PAGE_DIR, filename), content);
  }

  await writeFile(ASSET_PLAN_MD, manuscriptAssetPlan());

  await writeFile(
    join(FIGURE_PAGE_DIR, "README.md"),
    `# Actual mSigSDK Figure Pages

These HTML pages generate manuscript figure panels with real mSigSDK workflows instead of hand-drawn schematic SVGs.

Run the local server from the repository root:

\`\`\`bash
npm run serve:observable
\`\`\`

Then open:

- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure1-cohort-exploration.html
- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure2-known-signature-fitting.html
- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure3-qc-uncertainty-thresholds.html
- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure4-nmf-extraction.html

The pages fetch PCAWG Lung-AdenoCA SBS96 spectra and COSMIC SBS96 reference signatures through mSigSDK, then call the SDK plotting functions directly. Use browser screenshots or the Plotly export buttons to prepare final manuscript image files.
The success/loading banner is automatically hidden after the panels render so screenshots focus on the figure content.

Rendered PNG captures, generated from these pages in Chrome after waiting for each page's rendered state, are stored in:

- docs/manuscript/actual-figure-pages/screenshots/figure1-cohort-exploration.png
- docs/manuscript/actual-figure-pages/screenshots/figure2-known-signature-fitting.png
- docs/manuscript/actual-figure-pages/screenshots/figure3-qc-uncertainty-thresholds.png
- docs/manuscript/actual-figure-pages/screenshots/figure4-nmf-extraction.png
`
  );

  await writeFile(
    join(TABLE_DIR, "README.md"),
    `# Google Docs Manuscript Tables

These files are clean standalone HTML tables designed for copy/paste into a Google Docs manuscript.

Open \`all-google-doc-tables.html\` in a browser, select one table at a time, and paste into the manuscript. Individual tables are also available as separate HTML files.

Included manuscript tables:

1. Researcher-facing capabilities implemented in the revised mSigSDK
2. Data source, computation locus, and privacy boundary
3. Core compute benchmarks for local mSigSDK workflows
4. Controlled low-mutation-burden stress test
5. Functional comparison with related mutational-signature tools

Planning notes and figure maps are intentionally excluded from these copy/paste manuscript tables.
`
  );

  console.log(`Wrote ${tables.length} Google Docs HTML tables and ${figurePages.length} actual figure pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
