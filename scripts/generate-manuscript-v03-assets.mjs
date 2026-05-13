#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import { join } from "node:path";

const MANUSCRIPT_DIR = "docs/manuscript";
const TABLE_DIR = join(MANUSCRIPT_DIR, "google-doc-tables");
const FIGURE_PAGE_DIR = join(MANUSCRIPT_DIR, "actual-figure-pages");
const FIGURE_DATA_DIR = join(FIGURE_PAGE_DIR, "data");
const SCREENSHOT_DIR = join(FIGURE_PAGE_DIR, "screenshots");
const BENCHMARK_JSON = join(MANUSCRIPT_DIR, "benchmark-results.json");
const LOW_BURDEN_JSON = join(MANUSCRIPT_DIR, "low-burden-stress-test.json");
const FIGURE_SNAPSHOT_JSON = join(FIGURE_DATA_DIR, "pcawg-lung-snapshot.json");

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

async function readJsonIfExists(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (_error) {
    return fallback;
  }
}

function fetchJson(url, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { "User-Agent": "mSigSDK-manuscript-assets/0.3" } },
      (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          resolve(fetchJson(new URL(response.headers.location, url).href, timeoutMs));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode} while fetching ${url}: ${body.slice(0, 160)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Could not parse JSON from ${url}: ${error.message}`));
          }
        });
      }
    );
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out fetching ${url}`));
    });
    request.on("error", reject);
  });
}

function groupSpectrumRows(rows, groupName, valueName) {
  const grouped = {};
  for (const row of rows || []) {
    const group = row?.[groupName];
    const context = row?.mutationType;
    if (!group || !context) {
      continue;
    }
    if (!grouped[group]) {
      grouped[group] = {};
    }
    grouped[group][context] = Number(row[valueName]) || 0;
  }
  return grouped;
}

function objectSubset(object, names) {
  return Object.fromEntries(names.map((name) => [name, object[name]]).filter(([, value]) => value));
}

function totalMutations(spectrum) {
  return Object.values(spectrum || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

async function loadOrCreateFigureSnapshot() {
  const cached = await readJsonIfExists(FIGURE_SNAPSHOT_JSON, null);
  if (cached?.groupedSpectra && cached?.referenceSignatures && cached?.sampleNames?.length) {
    return cached;
  }

  const study = "PCAWG";
  const genomeDataType = "WGS";
  const cancerType = "Lung-AdenoCA";
  const mutationType = "SBS";
  const matrixSize = 96;
  const signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96";
  const spectrumUrl =
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum" +
    `?study=${study}&cancer=${cancerType}&strategy=${genomeDataType}&profile=${mutationType}&matrix=${matrixSize}&offset=0`;
  const signatureUrl =
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature" +
    `?source=Reference_signatures&strategy=${genomeDataType}&profile=${mutationType}&matrix=${matrixSize}` +
    `&signatureSetName=${signatureSetName}&limit=10000&offset=0`;

  const [spectrumRows, signatureRows] = await Promise.all([
    fetchJson(spectrumUrl),
    fetchJson(signatureUrl),
  ]);
  const groupedSpectra = groupSpectrumRows(spectrumRows, "sample", "mutations");
  const referenceSignatures = groupSpectrumRows(signatureRows, "signatureName", "contribution");
  const sampleNames = Object.keys(groupedSpectra)
    .filter((sample) => totalMutations(groupedSpectra[sample]) > 0)
    .sort((a, b) => totalMutations(groupedSpectra[b]) - totalMutations(groupedSpectra[a]))
    .slice(0, 48);
  const snapshot = {
    generatedAt: new Date().toISOString(),
    sourceUrls: { spectrumUrl, signatureUrl },
    study,
    genomeDataType,
    cancerType,
    mutationType,
    matrixSize,
    signatureSetName,
    sampleNames,
    groupedSpectra: objectSubset(groupedSpectra, sampleNames),
    referenceSignatures,
  };

  await mkdir(FIGURE_DATA_DIR, { recursive: true });
  await writeFile(FIGURE_SNAPSHOT_JSON, JSON.stringify(snapshot, null, 2));
  return snapshot;
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

function benchmarkRows(payload) {
  const rows = payload.rows || [];
  const wanted = [
    ["validation_qc", "Validation, burden, and context coverage", [10, 100, 1000]],
    ["nnls_fit", "Local NNLS known-signature fitting", [10, 100, 1000]],
    ["threshold_sensitivity", "Threshold sensitivity, five thresholds", [10, 100, 1000]],
    ["bootstrap_one_sample", "Bootstrap uncertainty, 100 iterations", [10, 100, 1000], 100],
    ["nmf_rank_selection", "Exploratory NMF rank selection", [10, 100]],
    ["nmf_extract_recommended_rank", "Exploratory NMF extraction", [10, 100]],
    ["v03_analysis_advisor", "v0.3 burden-aware analysis advisor", [10, 100]],
    ["v03_fit_trust_framework", "v0.3 composite fit-trust framework", [10, 100]],
    ["v03_signature_detectability", "v0.3 signature detectability estimates", [10, 100]],
    ["v03_cohort_fit_pipeline", "v0.3 cohort fit workflow", [10, 100]],
    ["v03_panel_workflow", "v0.3 panel/WES evidence workflow", [10, 100]],
    ["v03_subgroup_discovery", "v0.3 subgroup discovery workflow", [10]],
  ];

  return wanted.flatMap(([operation, label, sampleCounts, iterations]) =>
    rows
      .filter((row) => row.operation === operation)
      .filter((row) => sampleCounts.includes(row.samples))
      .filter((row) => iterations === undefined || row.iterations === iterations)
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
    title: "mSigSDK v0.3 capabilities organized by the mutational-signature researcher journey.",
    headers: ["Research stage", "Implemented capability", "Primary SDK entry points", "Manuscript evidence"],
    rows: [
      [
        "Data intake and validation",
        "Import spectra or MAF-derived matrices; validate SBS96 context coverage, mutation burden, and numeric matrix integrity before analysis.",
        "mSigSDK.validation; mSigSDK.io; analyzeMafFiles",
        "Figure 1; Table 2",
      ],
      [
        "Burden-aware method selection",
        "Classify samples or cohorts as insufficient, low, moderate, or high information and recommend refitting, restricted interpretation, subgroup discovery, or no decomposition.",
        "mSigSDK.advisor.recommendAnalysisStrategy",
        "Figure 3; Table 3",
      ],
      [
        "Known-signature fitting",
        "Run browser-local NNLS fitting with thresholding and renormalization while keeping user spectra on the client.",
        "mSigSDK.qc.fitSpectraWithNNLS; runSingleSampleFit; runCohortFit",
        "Figure 2; Table 4",
      ],
      [
        "Trust and caveats",
        "Return a composite trust classification using burden, reconstruction, residual shape, bootstrap stability, threshold sensitivity, signature ambiguity, and catalog sufficiency.",
        "computeFitTrust; detectOutOfReferenceSignal; computeSignatureAmbiguity",
        "Figure 3; Table 3",
      ],
      [
        "Cohort interpretation",
        "Cluster spectra, summarize subgroup structure, compare fitted exposures across metadata groups, and optionally extract signatures within sufficiently powered subgroups.",
        "runCohortFit; compareSignatureExposures; runSubgroupDiscoveryWorkflow",
        "Figure 4; Table 4",
      ],
      [
        "Panel/WES interpretation",
        "Apply callable-opportunity normalization, estimate signature detectability, and report tiered evidence calls rather than overinterpreted full decompositions.",
        "runPanelWorkflow; estimateSignatureDetectability; plotPanelEvidenceMatrix",
        "Figure 4; Table 3",
      ],
      [
        "Exploratory discovery",
        "Run browser-side NMF on moderate datasets, inspect rank diagnostics, and match extracted signatures to references.",
        "signatureExtraction; runDiscoveryWorkflow",
        "Figure 5; Table 4",
      ],
      [
        "Publication outputs",
        "Generate manuscript-ready plots, clean copy/paste HTML tables, reports, and provenance metadata.",
        "qcPlots; signatureExtractionPlots; reports; provenance",
        "Figures 1-5; Tables 1-6",
      ],
    ],
    note:
      "The table reports implemented public SDK behavior in version 0.3.0. It intentionally separates local analytical workflows from external public-resource access.",
  });

  const table2 = htmlTable({
    number: "2",
    title: "Computation locus, external dependencies, and privacy boundary.",
    headers: ["Workflow", "Computed in browser/client runtime", "External dependency", "Privacy interpretation"],
    rows: [
      ["mSigPortal public reference and cohort queries", "No, data are retrieved remotely", "mSigPortal API", "Public or portal-hosted data; no claim of local computation for API retrieval"],
      ["User spectra or MAF-derived matrix validation", "Yes", "None after import", "User mutation data can remain local"],
      ["Known-signature NNLS fitting and reconstruction QC", "Yes", "Optional reference catalog fetch", "User spectra can remain local; reference data may be public API-derived"],
      ["Bootstrap, threshold sensitivity, trust scoring, and residual checks", "Yes", "None", "Local; runtime scales with iterations, thresholds, and catalog size"],
      ["Cohort grouping and metadata-stratified exposure comparison", "Yes", "None", "Local if metadata and spectra are user supplied"],
      ["Panel/WES opportunity normalization and evidence tiers", "Yes", "None", "Local; outputs are evidence calls with explicit assessability limits"],
      ["Exploratory NMF extraction", "Yes for browser-sized cohorts", "None", "Local but not positioned as a replacement for production-scale extraction engines"],
      ["Plot rendering, HTML tables, reports, and provenance", "Yes", "Browser plotting libraries", "Local unless the user exports or shares outputs"],
    ],
    note:
      "This table is the recommended language boundary for the revised manuscript: mSigSDK is a browser-native SDK that performs selected analyses locally and also interoperates with public APIs.",
  });

  const table3 = htmlTable({
    number: "3",
    title: "Trust signals, warning codes, and recommended actions returned by v0.3 workflows.",
    headers: ["Trust signal or warning", "What it detects", "Typical action surfaced to user", "Relevant workflow"],
    rows: [
      ["LOW_BURDEN / INSUFFICIENT_SIGNAL", "Mutation count is too low for full decomposition or no callable signal is present.", "Use restricted interpretation, aggregate samples if appropriate, or do not fit.", "Single sample, cohort, panel"],
      ["SIGNATURE_AMBIGUITY / FLAT_SIGNATURE_RISK", "Reference signatures are highly similar or broad/flat, increasing exposure exchangeability.", "Report competing signatures and avoid overinterpreting fine-grained proportions.", "Advisor, trust, panel"],
      ["CATALOG_INCOMPLETE_SUSPECTED", "Structured residual signal or weak reconstruction suggests out-of-reference mutational process.", "Inspect residual spectrum, broaden catalog, or run subgroup discovery.", "Single sample, cohort"],
      ["FIT_UNSTABLE", "Bootstrap confidence intervals or selection frequencies indicate unstable fitted exposures.", "Report uncertainty intervals and restrict biological claims.", "Single sample, cohort"],
      ["THRESHOLD_DEPENDENT", "Active signature set changes materially across exposure thresholds.", "Report threshold sensitivity and use conservative interpretation.", "Single sample, cohort"],
      ["HETEROGENEOUS_COHORT", "Pairwise sample similarity suggests mixed processes or subgroups.", "Cluster or stratify before extraction or cohort-wide inference.", "Cohort"],
      ["SUBGROUP_EXTRACTION_SKIPPED", "A subgroup is too small or low-burden for stable extraction.", "Do not extract that subgroup; use refitting or aggregate only with justification.", "Cohort discovery"],
      ["PANEL_SIGNATURE_NOT_ASSESSABLE", "Panel/WES burden, exposure, opportunity coverage, or signature ambiguity makes detection unreliable.", "Report not assessable rather than not present.", "Panel/WES"],
      ["REGIONAL_PROCESS_SUSPECTED", "Adjacent variants form focal clusters consistent with localized mutagenesis.", "Generate rainfall plot and compare focal spectra to background.", "Localized mutagenesis"],
    ],
    note:
      "Warning codes are machine-readable fields in v0.3 result objects; the manuscript should emphasize that each pipeline returns caveats and next actions, not only fitted exposure values.",
  });

  const table4 = htmlTable({
    number: "4",
    title: "Core local compute benchmarks, including v0.3 workflow-level functions.",
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
      "Benchmarks were run on Windows x64 with Node.js v16.16.0, Intel Core i7-11700K CPU, and 16 GB RAM. Memory values are approximate process-level measurements; browser rendering should be reported separately if added as a supplement.",
  });

  const table5 = htmlTable({
    number: "5",
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
    rows: (lowBurdenPayload.rows || []).map((row) => [
      esc(row.burden),
      esc(row.samples),
      esc(row.lowBurdenFlagged),
      esc(fmt(row.averageCosineSimilarity, 3)),
      esc(fmt(row.averageRmse, 4)),
      esc(fmt(row.averageActiveSignatures, 2)),
      esc(fmt(row.averageBootstrapCiWidth, 3)),
      esc(fmt(row.thresholdCosineRange, 4)),
    ]),
    note:
      "This controlled stress test isolates burden effects. It should be presented as a reproducible low-information analysis check, not as a replacement for a disease-specific rare-cancer validation cohort.",
  });

  const table6 = htmlTable({
    number: "6",
    title: "Functional comparison with related mutational-signature software.",
    headers: [
      "Tool or platform",
      "Primary role",
      "Local user-data analysis",
      "De novo extraction",
      "Trust/uncertainty guidance",
      "mSigSDK positioning",
    ],
    rows: [
      ["mSigPortal", "Public portal and API for mutational-signature data and analyses", "Portal/API dependent", "Portal/server workflow", "Portal-specific", "mSigSDK provides a reusable browser SDK and local workflow layer over selected public resources."],
      ["SigProfilerExtractor", "Production de novo mutational-signature extraction", "Yes, local Python", "Yes", "Extraction stability diagnostics", "Complementary production extractor; mSigSDK provides web-native exploration, reporting, and browser-sized exploratory NMF."],
      ["SigProfilerAssignment", "Known-signature assignment to samples and mutations", "Yes, desktop/online workflows", "No", "Assignment diagnostics and benchmarking", "Complementary assignment framework; mSigSDK emphasizes embeddable browser workflows and explicit privacy boundaries."],
      ["MutationalPatterns", "R/Bioconductor mutational-pattern analysis and visualization", "Yes, local R", "Yes", "Broad R workflow diagnostics", "Complementary R ecosystem; mSigSDK targets JavaScript/browser reuse and no-install web applications."],
      ["deconstructSigs", "Known-signature decomposition for individual tumors", "Yes, local R", "No", "Limited compared with modern toolchains", "Established decomposition comparator; mSigSDK adds browser-side uncertainty, thresholds, trust, and reports."],
      ["AI-assisted genomic visualization interfaces", "Assistant-driven or interactive data exploration", "Varies by platform", "Varies", "Varies and often task-specific", "A reproducible benchmark requires a named/versioned platform and same-task protocol; mSigSDK supplies deterministic workflow outputs for comparison."],
    ],
    note:
      "The comparison is functional rather than a superiority claim. Versioned URLs and citations should be retained in the final reference list.",
  });

  return [
    ["table1-researcher-journey-capabilities.html", table1],
    ["table2-computation-privacy-boundary.html", table2],
    ["table3-trust-warning-actions.html", table3],
    ["table4-compute-benchmarks.html", table4],
    ["table5-low-burden-stress-test.html", table5],
    ["table6-related-tools.html", table6],
  ];
}

function figureShell({ title, subtitle, panels, script }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    body { margin:0; padding:28px; background:#fff; color:#172033; font-family:Arial, Helvetica, sans-serif; }
    h1 { margin:0 0 8px 0; font-size:26px; line-height:1.2; }
    .subtitle { margin:0 0 20px 0; color:#55606f; font-size:14px; line-height:1.45; max-width:1220px; }
    .status { padding:10px 12px; border:1px solid #c8d1dc; border-radius:6px; color:#44515f; background:#f7f9fc; margin-bottom:18px; max-width:1220px; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; align-items:start; }
    .panel { border:1px solid #c8d1dc; border-radius:6px; padding:12px; background:#fff; min-height:360px; overflow:hidden; }
    .wide { grid-column:1 / -1; }
    .panel-title { margin:0 0 8px 0; font-size:15px; font-weight:700; color:#172033; }
    table { border-collapse:collapse; width:100%; font-size:12px; }
    th, td { border:1px solid #c8d1dc; padding:6px 8px; text-align:left; vertical-align:top; }
    th { background:#eef2f7; }
    .msig-download-btn, .modebar, .modebar-container { display:none !important; }
    @media print { body { padding:10px; } .panel { break-inside:avoid; } }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="subtitle">${esc(subtitle)}</p>
  <div id="status" class="status">Loading mSigSDK and figure data...</div>
  <div class="grid">
${panels}
  </div>
  <script type="module">
${script}
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
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}
function choosePanelContexts(contexts) {
  return contexts.filter((_, index) => index % 4 === 0).slice(0, 24);
}
function sumSpectrumValues(spectrum) {
  return Object.values(spectrum || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}
function cosineBetweenSpectra(a, b, contexts) {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (const context of contexts) {
    const av = Number(a?.[context]) || 0;
    const bv = Number(b?.[context]) || 0;
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }
  return aNorm && bNorm ? dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm)) : 0;
}
function pairwiseCosineRows(spectra, contexts, limit = 10) {
  const names = Object.keys(spectra);
  const rows = [];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      rows.push([
        names[i],
        names[j],
        cosineBetweenSpectra(spectra[names[i]], spectra[names[j]], contexts).toFixed(3),
      ]);
    }
  }
  return rows.sort((a, b) => Number(b[2]) - Number(a[2])).slice(0, limit);
}
function spectrumToPortalRows(sampleName, spectrum, contexts, profile = "SBS", matrix = 96) {
  return contexts.map((context) => ({
    sample: sampleName,
    profile,
    matrix,
    mutationType: context,
    mutations: Number(spectrum?.[context]) || 0,
  }));
}
function hasRenderedContent(id) {
  const element = document.getElementById(id);
  return Boolean(element?.querySelector("svg, canvas, table, .plotly, .js-plotly-plot"));
}
function waitForFrames(count = 2) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(1, count) * 75));
}
function withTimeout(promise, timeoutMs) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
function renderHierarchyTree(id, rootData) {
  const element = document.getElementById(id);
  element.innerHTML = "";
  const width = 760;
  const height = 580;
  const margin = { top: 24, right: 160, bottom: 28, left: 34 };
  const leaves = [];
  const nodes = [];
  const links = [];
  const root = JSON.parse(JSON.stringify(rootData));

  function visit(node, depth = 0, parent = null) {
    node.depth = depth;
    node.children = Array.isArray(node.children) ? node.children : [];
    nodes.push(node);
    if (parent) {
      links.push([parent, node]);
    }
    if (node.children.length === 0) {
      leaves.push(node);
    }
    for (const child of node.children) {
      visit(child, depth + 1, node);
    }
  }
  visit(root);
  leaves.forEach((leaf, index) => {
    leaf.x = margin.top + (index * (height - margin.top - margin.bottom)) / Math.max(1, leaves.length - 1);
  });
  const maxDepth = Math.max(...nodes.map((node) => node.depth), 1);
  function place(node) {
    if (node.children.length) {
      node.children.forEach(place);
      node.x = node.children.reduce((sum, child) => sum + child.x, 0) / node.children.length;
    }
    node.y = margin.left + (node.depth * (width - margin.left - margin.right)) / maxDepth;
  }
  place(root);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 " + width + " " + height);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "560");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Similarity tree generated from SDK hierarchical clustering output");
  element.appendChild(svg);

  const maxMutationCount = Math.max(...nodes.map((node) => Number(node.totalMutationCount) || 0), 1);
  for (const [source, target] of links) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M" + source.y + "," + source.x + " C" + (source.y + target.y) / 2 + "," + source.x + " " + (source.y + target.y) / 2 + "," + target.x + " " + target.y + "," + target.x);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#9aa5b1");
    path.setAttribute("stroke-width", "1.2");
    path.setAttribute("opacity", "0.72");
    svg.appendChild(path);
  }

  for (const node of nodes) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const radius = node.children.length
      ? 3.5 + 8 * Math.sqrt((Number(node.totalMutationCount) || 0) / maxMutationCount)
      : 4.2;
    circle.setAttribute("cx", node.y);
    circle.setAttribute("cy", node.x);
    circle.setAttribute("r", radius.toFixed(2));
    circle.setAttribute("fill", node.children.length ? "#2c7fb8" : "#f59e0b");
    circle.setAttribute("stroke", "#ffffff");
    circle.setAttribute("stroke-width", "1.2");
    svg.appendChild(circle);
  }

  for (const leaf of leaves) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", leaf.y + 9);
    text.setAttribute("y", leaf.x + 3);
    text.setAttribute("font-size", "11");
    text.setAttribute("fill", "#172033");
    text.textContent = Array.isArray(leaf.name) ? leaf.name.join(", ") : String(leaf.name);
    svg.appendChild(text);
  }
}
async function loadSdk() {
  const sdkUrl = new URL("../../../main.js", import.meta.url).href;
  const { mSigSDK } = await import(sdkUrl + "?v=manuscript-v03");
  return mSigSDK;
}
function getEmbeddedPCAWGLungData(mSigSDK) {
  const snapshot = PCAWG_LUNG_SNAPSHOT;
  const contexts = mSigSDK.validation.getExpectedContexts({ profile: "SBS", matrix: 96 });
  const burden = mSigSDK.qc.summarizeMutationBurden(snapshot.groupedSpectra, { expectedContexts: contexts });
  const sampleNames = (snapshot.sampleNames || burden.samples.map((sample) => sample.sample))
    .filter((sample) => snapshot.groupedSpectra[sample]);
  return {
    contexts,
    study: snapshot.study,
    genomeDataType: snapshot.genomeDataType,
    cancerType: snapshot.cancerType,
    mutationType: snapshot.mutationType,
    matrixSize: snapshot.matrixSize,
    signatureSetName: snapshot.signatureSetName,
    groupedSpectra: snapshot.groupedSpectra,
    referenceSignatures: snapshot.referenceSignatures,
    burden,
    sampleNames,
  };
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

function createFigurePages(lowBurdenPayload, figureSnapshot) {
  const figureScriptPrelude = `${commonFigureHelpers}
const PCAWG_LUNG_SNAPSHOT = ${scriptJson(figureSnapshot)};
`;

  const figure1 = figureShell({
    title: "Figure 1. Browser-native cohort exploration and similarity structure",
    subtitle:
      "Actual mSigSDK visualizations for PCAWG Lung-AdenoCA SBS96 spectra: mutation burden, profile comparison, clustered cosine similarity, SDK-computed similarity tree, and UMAP projection.",
    panels: `
    <section class="panel"><p class="panel-title">A. Mutation burden summary</p><div id="fig1Burden"></div></section>
    <section class="panel"><p class="panel-title">B. COSMIC-style SBS96 profile comparison</p><div id="fig1Spectrum"></div></section>
    <section class="panel wide"><p class="panel-title">C. Double-clustered cosine similarity heatmap</p><div id="fig1Cosine"></div></section>
    <section class="panel"><p class="panel-title">D. SDK-computed similarity tree</p><div id="fig1Tree" style="height:650px"></div></section>
    <section class="panel"><p class="panel-title">E. UMAP projection</p><div id="fig1Umap"></div></section>`,
    script: `${figureScriptPrelude}
try {
  const mSigSDK = await loadSdk();
  const data = getEmbeddedPCAWGLungData(mSigSDK);
  const selected = data.sampleNames.slice(0, 16);
  const selectedSpectra = subsetObject(data.groupedSpectra, selected);
  const selectedBurden = mSigSDK.qc.summarizeMutationBurden(selectedSpectra, {
    expectedContexts: data.contexts,
    lowBurdenThreshold: 100,
    lowBurdenThresholdMode: "fixed",
  });
  const burdenRows = selectedBurden.samples
    .slice()
    .sort((a, b) => b.totalMutations - a.totalMutations)
    .map((sample) => [
      sample.sample,
      Math.round(sample.totalMutations).toLocaleString(),
      String(sample.nonZeroContexts),
    ]);
  const topContextRows = data.contexts
    .map((context) => [
      context,
      Number(selectedSpectra[selected[0]]?.[context]) || 0,
      Number(selectedSpectra[selected[1]]?.[context]) || 0,
    ])
    .sort((a, b) => b[1] + b[2] - (a[1] + a[2]))
    .slice(0, 14)
    .map((row) => [row[0], row[1].toLocaleString(), row[2].toLocaleString()]);
  const pairRows = pairwiseCosineRows(selectedSpectra, data.contexts, 12);
  const panels = [
    {
      id: "fig1Burden",
      render: () => mSigSDK.qcPlots.plotMutationBurdenSummary(document.getElementById("fig1Burden"), selectedBurden),
      fallback: () => rowsToTable("fig1Burden", ["Sample", "Mutations", "Nonzero SBS96 contexts"], burdenRows),
    },
    {
      id: "fig1Spectrum",
      render: () => mSigSDK.mSigPortal.mSigPortalPlots.plotPatientMutationalSpectrum(
        [
          spectrumToPortalRows(selected[0], selectedSpectra[selected[0]], data.contexts, data.mutationType, data.matrixSize),
          spectrumToPortalRows(selected[1], selectedSpectra[selected[1]], data.contexts, data.mutationType, data.matrixSize),
        ],
        "fig1Spectrum"
      ),
      fallback: () => rowsToTable("fig1Spectrum", ["Context", selected[0], selected[1]], topContextRows),
    },
    {
      id: "fig1Cosine",
      render: () => mSigSDK.mSigPortal.mSigPortalPlots.plotCosineSimilarityHeatMap(selectedSpectra, data.study, data.genomeDataType, data.cancerType, "fig1Cosine", true, "Viridis", false),
      fallback: () => rowsToTable("fig1Cosine", ["Sample A", "Sample B", "Cosine similarity"], pairRows),
    },
    {
      id: "fig1Tree",
      render: async () => {
        const tree = await mSigSDK.mSigPortal.mSigPortalPlots.plotForceDirectedTree(selectedSpectra, data.study, data.genomeDataType, data.cancerType, "fig1Tree");
        renderHierarchyTree("fig1Tree", tree);
      },
      fallback: () => rowsToTable("fig1Tree", ["Nearest sample A", "Nearest sample B", "Cosine similarity"], pairRows),
      timeoutMs: 18000,
    },
    {
      id: "fig1Umap",
      render: () => mSigSDK.mSigPortal.mSigPortalPlots.plotUMAPVisualization(selectedSpectra, data.study + " " + data.cancerType, "fig1Umap", 2, 0.1, 8),
      fallback: () => rowsToTable("fig1Umap", ["Sample", "Mutations", "Nonzero SBS96 contexts"], burdenRows.slice(0, 10)),
      timeoutMs: 18000,
    },
  ];
  for (const panel of panels) {
    try {
      await withTimeout(panel.render(), panel.timeoutMs || 12000);
      await waitForFrames(3);
    } catch (panelError) {
      console.error(panel.id, panelError);
    }
    if (!hasRenderedContent(panel.id)) {
      panel.fallback();
    }
  }
  setStatus("Rendered Figure 1 from mSigSDK " + mSigSDK.version + " using " + selected.length + " PCAWG Lung-AdenoCA samples.");
} catch (error) {
  console.error(error);
  setStatus("Figure rendering failed: " + error.message);
}`,
  });

  const figure2 = figureShell({
    title: "Figure 2. Local known-signature fitting and exposure interpretation",
    subtitle:
      "Actual browser-local NNLS fitting of PCAWG Lung-AdenoCA spectra against selected COSMIC SBS96 signatures, with exposure, reconstruction, and residual panels.",
    panels: `
    <section class="panel wide"><p class="panel-title">A. Double-clustered exposure heatmap</p><div id="fig2Heatmap"></div></section>
    <section class="panel"><p class="panel-title">B. Single-sample exposure pie chart</p><div id="fig2Pie"></div></section>
    <section class="panel"><p class="panel-title">C. Reconstruction quality</p><div id="fig2Reconstruction"></div></section>
    <section class="panel wide"><p class="panel-title">D. Observed versus reconstructed residual profile</p><div id="fig2Residual"></div></section>`,
    script: `${figureScriptPrelude}
try {
  const mSigSDK = await loadSdk();
  const data = getEmbeddedPCAWGLungData(mSigSDK);
  const selected = data.sampleNames.slice(0, 18);
  const spectra = subsetObject(data.groupedSpectra, selected);
  const preferred = ["SBS1", "SBS2", "SBS4", "SBS5", "SBS13", "SBS17a", "SBS17b", "SBS18", "SBS40"];
  const signatures = signatureSubset(data.referenceSignatures, preferred, 9);
  const exposures = await mSigSDK.qc.fitSpectraWithNNLS(signatures, spectra, {
    contexts: data.contexts,
    exposureThreshold: 0.01,
    exposureType: "relative",
    renormalize: true,
  });
  const reconstruction = mSigSDK.qc.calculateReconstructionError(signatures, spectra, exposures, { contexts: data.contexts, normalizeMode: "relative" });
  const residuals = mSigSDK.qc.calculateFitResiduals(signatures, spectra, exposures, { contexts: data.contexts, normalizeMode: "relative" });
  const residualSample = reconstruction.samples.slice().sort((a, b) => a.cosineSimilarity - b.cosineSimilarity)[0]?.sample || selected[0];
  await mSigSDK.signatureFitting.plotDatasetMutationalSignaturesExposure(exposures, "fig2Heatmap", true, "PCAWG Lung-AdenoCA local NNLS", true, "Viridis");
  await mSigSDK.signatureFitting.plotPatientMutationalSignaturesExposure(exposures, "fig2Pie", residualSample);
  await mSigSDK.qcPlots.plotReconstructionError(document.getElementById("fig2Reconstruction"), reconstruction);
  await mSigSDK.qcPlots.plotFitResiduals(document.getElementById("fig2Residual"), residuals, residualSample);
  setStatus("Rendered Figure 2 local NNLS fitting for " + selected.length + " samples and " + Object.keys(signatures).length + " reference signatures.");
} catch (error) {
  console.error(error);
  setStatus("Figure rendering failed: " + error.message);
}`,
  });

  const figure3 = figureShell({
    title: "Figure 3. Burden-aware guidance, fit trust, uncertainty, and threshold robustness",
    subtitle:
      "Actual mSigSDK v0.3 guidance and QC outputs: trust dashboard, bootstrap exposure intervals, threshold sensitivity, and controlled low-burden stress-test summary.",
    panels: `
    <section class="panel wide"><p class="panel-title">A. Composite fit-trust dashboard</p><div id="fig3Trust"></div></section>
    <section class="panel wide"><p class="panel-title">B. Bootstrap exposure confidence intervals</p><div id="fig3Bootstrap"></div></section>
    <section class="panel wide"><p class="panel-title">C. Threshold sensitivity atlas</p><div id="fig3Threshold"></div></section>
    <section class="panel wide"><p class="panel-title">D. Controlled low-burden stress test</p><div id="fig3LowBurden"></div></section>`,
    script: `${figureScriptPrelude}
try {
  const mSigSDK = await loadSdk();
  const data = getEmbeddedPCAWGLungData(mSigSDK);
  const selected = data.sampleNames.slice(0, 10);
  const spectra = subsetObject(data.groupedSpectra, selected);
  const preferred = ["SBS1", "SBS2", "SBS4", "SBS5", "SBS13", "SBS17a", "SBS17b", "SBS18", "SBS40"];
  const signatures = signatureSubset(data.referenceSignatures, preferred, 9);
  const cohort = await mSigSDK.pipelines.runCohortFit({ spectra, signatures }, {
    contexts: data.contexts,
    runBootstrap: false,
    runThresholdSensitivity: false,
    runSubgroupDiscovery: false,
  });
  await mSigSDK.qcPlots.plotFitTrustDashboard(document.getElementById("fig3Trust"), cohort.trust);
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
  setStatus("Rendered Figure 3 guidance and uncertainty panels for " + selected.length + " samples; bootstrap sample: " + bootstrapSample + ".");
} catch (error) {
  console.error(error);
  setStatus("Figure rendering failed: " + error.message);
}`,
  });

  const figure4 = figureShell({
    title: "Figure 4. Cohort and panel workflows introduced in mSigSDK v0.3",
    subtitle:
      "Actual v0.3 workflow outputs from PCAWG Lung-AdenoCA spectra: group exposure comparison, subgroup extraction/refit summary, panel/WES evidence matrix, and trust dashboard.",
    panels: `
    <section class="panel wide"><p class="panel-title">A. Metadata-stratified exposure comparison</p><div id="fig4Group"></div></section>
    <section class="panel wide"><p class="panel-title">B. Panel/WES evidence matrix</p><div id="fig4Panel"></div></section>
    <section class="panel"><p class="panel-title">C. Cohort fit-trust dashboard</p><div id="fig4Trust"></div></section>
    <section class="panel"><p class="panel-title">D. Subgroup extraction and matched refitting summary</p><div id="fig4Subgroups"></div></section>`,
    script: `${figureScriptPrelude}
try {
  const mSigSDK = await loadSdk();
  const data = getEmbeddedPCAWGLungData(mSigSDK);
  const selected = data.sampleNames.slice(0, 18);
  const spectra = subsetObject(data.groupedSpectra, selected);
  const preferred = ["SBS1", "SBS2", "SBS4", "SBS5", "SBS13", "SBS17a", "SBS17b", "SBS18", "SBS40"];
  const signatures = signatureSubset(data.referenceSignatures, preferred, 9);
  const burdenRows = mSigSDK.qc.summarizeMutationBurden(spectra, { expectedContexts: data.contexts }).samples;
  const burdenCut = median(burdenRows.map((row) => row.totalMutations));
  const metadata = Object.fromEntries(burdenRows.map((row) => [
    row.sample,
    { burdenGroup: row.totalMutations >= burdenCut ? "higher_burden" : "lower_burden" },
  ]));
  const cohort = await mSigSDK.pipelines.runCohortFit({ spectra, signatures, metadata }, {
    contexts: data.contexts,
    groupKey: "burdenGroup",
    comparison: { minGroupSize: 3, permutationIterations: 99 },
    runBootstrap: false,
    runThresholdSensitivity: false,
    runSubgroupDiscovery: false,
  });
  await mSigSDK.qcPlots.plotCohortGroupComparison(document.getElementById("fig4Group"), cohort.groupComparison);
  await mSigSDK.qcPlots.plotFitTrustDashboard(document.getElementById("fig4Trust"), cohort.trust);
  const panelContexts = choosePanelContexts(data.contexts);
  const callableOpportunities = Object.fromEntries(data.contexts.map((context) => [context, panelContexts.includes(context) ? 1 : 0]));
  const panel = await mSigSDK.pipelines.runPanelWorkflow({ spectra, signatures, callableOpportunities }, {
    contexts: data.contexts,
    minAssessableMutations: 30,
    runBootstrap: false,
    runThresholdSensitivity: false,
    runSubgroupDiscovery: false,
  });
  await mSigSDK.qcPlots.plotPanelEvidenceMatrix(document.getElementById("fig4Panel"), panel);
  const subgroupSamples = selected.slice(0, 8);
  const subgroup = await mSigSDK.pipelines.runSubgroupDiscoveryWorkflow({
    spectra: subsetObject(spectra, subgroupSamples),
    signatures,
    subgroups: [{ clusterId: "high_burden_subset", samples: subgroupSamples }],
  }, {
    contexts: data.contexts,
    rank: 2,
    nRuns: 2,
    maxIterations: 80,
    minSubgroupSamples: 5,
    minMedianBurden: 100,
  });
  rowsToTable("fig4Subgroups",
    ["Subgroup", "Samples", "Median burden", "Status", "Rank", "Shortlisted references"],
    subgroup.subgroups.map((row) => [
      row.subgroupId || "subgroup",
      row.sampleCount,
      Math.round(row.medianMutationBurden || 0),
      row.status,
      row.rank || "NA",
      (row.shortlistedSignatureNames || []).slice(0, 5).join(", ") || "NA",
    ])
  );
  setStatus("Rendered Figure 4 v0.3 cohort and panel workflows for " + selected.length + " PCAWG Lung-AdenoCA samples.");
} catch (error) {
  console.error(error);
  setStatus("Figure rendering failed: " + error.message);
}`,
  });

  const figure5 = figureShell({
    title: "Figure 5. Exploratory browser-side NMF extraction",
    subtitle:
      "Actual mSigSDK NMF workflow: extracted SBS96 profile plots, sample exposure heatmap, rank diagnostics, and reference-signature matching.",
    panels: `
    <section class="panel wide"><p class="panel-title">A. Extracted SBS96 signature profiles</p><div id="fig5Profiles"></div></section>
    <section class="panel"><p class="panel-title">B. NMF exposure heatmap</p><div id="fig5Exposure"></div></section>
    <section class="panel"><p class="panel-title">C. NMF rank diagnostics</p><div id="fig5Rank"></div></section>
    <section class="panel wide"><p class="panel-title">D. Top reference-signature matches</p><div id="fig5Matches"></div></section>`,
    script: `${figureScriptPrelude}
try {
  const mSigSDK = await loadSdk();
  const data = getEmbeddedPCAWGLungData(mSigSDK);
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
  await mSigSDK.signatureExtractionPlots.plotNMFSignatureProfiles(document.getElementById("fig5Profiles"), nmf);
  await mSigSDK.signatureExtractionPlots.plotNMFExposureHeatmap(document.getElementById("fig5Exposure"), nmf, { relative: true });
  await mSigSDK.signatureExtractionPlots.plotNMFRankSelection(document.getElementById("fig5Rank"), rankSelection);
  rowsToTable("fig5Matches",
    ["Extracted signature", "Best reference match", "Cosine similarity", "Second match", "Third match"],
    matches.map((row) => [
      row.signatureName,
      row.matches[0]?.referenceName || "NA",
      row.matches[0] ? row.matches[0].cosineSimilarity.toFixed(3) : "NA",
      row.matches[1] ? row.matches[1].referenceName + " (" + row.matches[1].cosineSimilarity.toFixed(3) + ")" : "NA",
      row.matches[2] ? row.matches[2].referenceName + " (" + row.matches[2].cosineSimilarity.toFixed(3) + ")" : "NA",
    ])
  );
  setStatus("Rendered Figure 5 exploratory NMF for " + selected.length + " high-burden samples; selected rank: " + nmf.rank + ".");
} catch (error) {
  console.error(error);
  setStatus("Figure rendering failed: " + error.message);
}`,
  });

  return [
    ["figure1-cohort-exploration.html", figure1],
    ["figure2-known-signature-fitting.html", figure2],
    ["figure3-qc-trust-uncertainty.html", figure3],
    ["figure4-cohort-panel-workflows.html", figure4],
    ["figure5-nmf-extraction.html", figure5],
  ];
}

function figuresAndTablesPlan() {
  return `# Numbered Manuscript Figures And Tables

## Central Framing

The revised manuscript should present mSigSDK v0.3 as a browser-native workflow SDK for mutational-signature researchers. The core claim is not that mSigSDK replaces production extraction engines or that all mSigPortal analyses are performed locally. The core claim is that mSigSDK turns public mutational-signature resources and local JavaScript analysis modules into reproducible, privacy-aware workflows that guide researchers through data intake, burden-aware method selection, trusted fitting, cohort/panel interpretation, exploratory extraction, and publication-ready outputs.

## Main Figures

1. **Figure 1. Browser-native cohort exploration and similarity structure**  
   Source HTML: \`docs/manuscript/actual-figure-pages/figure1-cohort-exploration.html\`  
   Screenshot: \`docs/manuscript/actual-figure-pages/screenshots/figure1-cohort-exploration.png\`

2. **Figure 2. Local known-signature fitting and exposure interpretation**  
   Source HTML: \`docs/manuscript/actual-figure-pages/figure2-known-signature-fitting.html\`  
   Screenshot: \`docs/manuscript/actual-figure-pages/screenshots/figure2-known-signature-fitting.png\`

3. **Figure 3. Burden-aware guidance, fit trust, uncertainty, and threshold robustness**  
   Source HTML: \`docs/manuscript/actual-figure-pages/figure3-qc-trust-uncertainty.html\`  
   Screenshot: \`docs/manuscript/actual-figure-pages/screenshots/figure3-qc-trust-uncertainty.png\`

4. **Figure 4. Cohort and panel workflows introduced in mSigSDK v0.3**  
   Source HTML: \`docs/manuscript/actual-figure-pages/figure4-cohort-panel-workflows.html\`  
   Screenshot: \`docs/manuscript/actual-figure-pages/screenshots/figure4-cohort-panel-workflows.png\`

5. **Figure 5. Exploratory browser-side NMF extraction**  
   Source HTML: \`docs/manuscript/actual-figure-pages/figure5-nmf-extraction.html\`  
   Screenshot: \`docs/manuscript/actual-figure-pages/screenshots/figure5-nmf-extraction.png\`

## Main Tables

1. **Table 1. mSigSDK v0.3 capabilities organized by the mutational-signature researcher journey**  
   HTML: \`docs/manuscript/google-doc-tables/table1-researcher-journey-capabilities.html\`

2. **Table 2. Computation locus, external dependencies, and privacy boundary**  
   HTML: \`docs/manuscript/google-doc-tables/table2-computation-privacy-boundary.html\`

3. **Table 3. Trust signals, warning codes, and recommended actions returned by v0.3 workflows**  
   HTML: \`docs/manuscript/google-doc-tables/table3-trust-warning-actions.html\`

4. **Table 4. Core local compute benchmarks, including v0.3 workflow-level functions**  
   HTML: \`docs/manuscript/google-doc-tables/table4-compute-benchmarks.html\`

5. **Table 5. Controlled low-mutation-burden stress test**  
   HTML: \`docs/manuscript/google-doc-tables/table5-low-burden-stress-test.html\`

6. **Table 6. Functional comparison with related mutational-signature software**  
   HTML: \`docs/manuscript/google-doc-tables/table6-related-tools.html\`

## Remaining Optional Strengtheners

1. Add a real rare-cancer or salivary-gland carcinoma cohort if one is accessible with enough public data.
2. Add browser rendering benchmark repeats for the final HTML figure pages.
3. Tag a release or record an exact commit after final asset generation.
`;
}

function completionPlan() {
  return `# Revised Manuscript Completion Plan

## Completed In This Revision Package

1. Reframed the manuscript around mSigSDK v0.3 as a browser-native workflow SDK rather than a portal visualization wrapper.
2. Added v0.3 SDK features: burden-aware advisor, fit-trust framework, catalog-sufficiency checks, cohort comparison, subgroup discovery/refitting, panel/WES detectability, evidence tiers, localized mutagenesis workflow, and publication-oriented figures.
3. Generated six clean Google Docs-ready HTML tables.
4. Generated five reproducible HTML figure pages that call actual mSigSDK functions and use PCAWG Lung-AdenoCA spectra plus COSMIC SBS96 references where applicable.
5. Regenerated benchmark outputs with v0.3 workflow-level rows.
6. Drafted a full revised manuscript in \`docs/manuscript/MSIGSDK_REVISED_MANUSCRIPT_DRAFT.md\`.

## Highest-Value Optional Work Before Submission

1. **Rare-cancer validation.** Add a real public rare-cancer cohort if available, ideally salivary gland carcinoma. If not accessible, keep the controlled low-burden stress test and explicitly describe it as controlled rather than disease-specific validation.
2. **Browser rendering benchmark.** Add five-repeat render-time and browser heap measurements for Figures 1-5 in a named browser/version.
3. **Release checkpoint.** Create a version tag or record the exact commit used to generate manuscript assets.
4. **Reference polish.** Run final journal-format reference cleanup before submission.
`;
}

function centralFraming() {
  return `# Central Manuscript Framing

## One-Sentence Claim

mSigSDK v0.3 is a browser-native JavaScript SDK that productizes mutational-signature analysis around the researcher journey: local data validation, burden-aware method selection, trusted known-signature fitting, cohort and panel interpretation, exploratory browser-side extraction, and publication-ready reporting.

## Reviewer Concern Addressed

The original manuscript could be read as presenting mSigSDK primarily as a computational replacement for existing signature-analysis engines while much of the public-data functionality relied on mSigPortal APIs. The revised framing should be more precise:

- mSigPortal API calls provide public reference and cohort data.
- User-supplied spectra can be validated, fitted, stress-tested, and visualized locally in the browser.
- v0.3 adds decision and trust layers that are not merely display wrappers: burden-aware recommendations, composite trust scoring, catalog-sufficiency checks, subgroup workflows, metadata comparisons, panel evidence tiers, and warning codes.
- Browser-side NMF is positioned as exploratory and browser-sized, not as a replacement for production extraction tools such as SigProfilerExtractor.

## Title Direction

Recommended title:

**mSigSDK: a browser-native workflow SDK for privacy-aware and trust-guided mutational signature analysis**

## Main Narrative Arc

1. Mutational-signature researchers need more than plots: they need safe workflow defaults, uncertainty, caveats, and reproducible outputs.
2. Existing engines remain essential, but they are usually package- or server-centered and are not designed as embeddable browser SDKs.
3. mSigSDK v0.3 provides local JavaScript workflow modules around existing public resources.
4. The SDK makes the computation/privacy boundary explicit.
5. Results demonstrate cohort exploration, local fitting, uncertainty/trust diagnostics, cohort and panel workflows, exploratory NMF, benchmarks, and low-burden stress behavior.
6. The discussion should acknowledge limits: no production-scale extraction claim, no universal burden cutoff, browser memory/rendering constraints, and need for disease-specific validation.
`;
}

function manuscriptDraft() {
  return `# mSigSDK: a browser-native workflow SDK for privacy-aware and trust-guided mutational signature analysis

Aaron Ge1,2*, Tongwu Zhang1, Yasmmin Cortes Martins3, Maria Teresa Landi1, Brian Park1, Kailing Chen1, Jeya Balasubramanian1, Jonas S Almeida1

*Correspondence: age1@som.umaryland.edu

1 Division of Cancer Epidemiology and Genetics, National Cancer Institute, National Institutes of Health, Maryland, USA  
2 University of Maryland School of Medicine, Maryland, USA  
3 National Laboratory of Scientific Computing, Petropolis, Brazil

## Abstract

### Background

Mutational signatures summarize patterns of somatic mutation that reflect endogenous processes, environmental exposures, DNA repair deficiencies, and treatment-associated mutagenesis. Although mature command-line and statistical packages support signature extraction and assignment, many research teams also need browser-native, embeddable workflows for data review, privacy-aware fitting, cohort interpretation, panel/WES evidence reporting, and publication-ready visualization. The original mSigSDK connected JavaScript applications to mSigPortal resources and visualization routines. We revised the SDK to make its computational boundaries explicit and to add local workflow modules that help researchers decide when fitted or extracted signatures can be interpreted.

### Results

We developed mSigSDK v0.3, a modular ECMAScript JavaScript SDK organized around the mutational-signature researcher journey: data intake, burden-aware method selection, local known-signature fitting, trust classification, cohort and panel interpretation, exploratory extraction, and publication outputs. Public mSigPortal resources are accessed through HTTP APIs, whereas user-supplied spectra can be validated, fitted by non-negative least squares, bootstrapped, threshold-tested, scored for trust, compared across metadata groups, and rendered locally in the browser. v0.3 introduces advisor and pipeline namespaces that return structured result objects with validation results, warnings, recommended actions, trust classifications, catalog-sufficiency checks, and figure/report artifacts. In demonstrations using PCAWG Lung-AdenoCA SBS96 spectra and COSMIC SBS96 reference signatures, the SDK rendered cohort similarity views, local fitting outputs, uncertainty diagnostics, cohort comparison and panel evidence views, and exploratory browser-side NMF extraction. Benchmarks on synthetic SBS96 matrices showed millisecond-scale validation and advisor functions, approximately 1.2 seconds for the v0.3 cohort workflow on 100 samples and 12 signatures, and approximately 1.5 seconds for the panel/WES workflow under the same benchmark setting.

### Conclusions

mSigSDK v0.3 is best understood as a browser-native workflow SDK rather than a replacement for production-scale extraction engines. Its main contribution is the integration of public mutational-signature resources with local, privacy-aware JavaScript analysis modules and trust-guided outputs that reduce common interpretation errors in low-burden, heterogeneous-cohort, and panel/WES settings.

**Keywords:** mutational signatures; JavaScript; browser computation; privacy-aware analysis; mutation burden; signature fitting; cohort analysis; panel sequencing; FAIR software; mSigPortal

## Introduction

Mutational signatures are recurring patterns of somatic mutation generated by mutagenic exposures, endogenous biochemical processes, DNA repair deficiencies, and cancer therapies. They have become an important framework for cancer etiology, precision prevention, and treatment-response research [1-3]. The increasing availability of whole-genome, whole-exome, and targeted-panel sequencing has widened the audience for mutational-signature analysis, but it has also made interpretation more difficult. Samples with few mutations, incomplete callable territories, highly similar reference signatures, heterogeneous cohorts, and incomplete catalogs can produce fitted exposures that look numerically precise while being biologically fragile.

Several established tools address core statistical tasks in this field. SigProfilerExtractor provides production-grade de novo extraction and benchmarking across large cohorts [4]. SigProfilerAssignment supports known-signature assignment to samples and individual mutations [5]. MutationalPatterns and deconstructSigs provide R-based workflows for mutational-pattern analysis and signature decomposition [6,7]. These tools remain essential. However, they do not directly solve a complementary software-engineering problem: how to embed signature-aware workflows into browser applications, notebooks, and data portals while preserving a clear boundary between public reference-data access and local user-data computation.

mSigPortal provides curated mutational-signature data and analytical resources through a public web portal and HTTP APIs [8]. The initial mSigSDK manuscript emphasized API-driven access and visualization, but reviewer feedback correctly identified a need to distinguish API orchestration from local computation and to avoid overclaiming browser-side de novo extraction. In response, we revised both the SDK and manuscript. mSigSDK v0.3 now exposes local workflow modules for validation, fitting, uncertainty, trust scoring, subgroup-aware cohort interpretation, panel/WES evidence calls, and exploratory extraction, while describing mSigPortal API calls as external public-data dependencies.

The revised contribution is therefore not a new signature-extraction algorithm competing with production packages. Instead, mSigSDK v0.3 provides an embeddable JavaScript workflow layer that returns not only fitted or extracted values, but also confidence classes, caveats, warning codes, and next recommended actions.

## Implementation

### Software Architecture

mSigSDK is implemented as a modular ECMAScript 6 JavaScript SDK. The public entry point exports namespaces for mSigPortal data access, validation, quality control, plotting, signature extraction, input/output, reports, provenance, workflow helpers, advisor functions, and v0.3 pipelines. The SDK can be imported directly into a browser runtime and can also be used from local JavaScript workflows for testing and asset generation.

The revised architecture separates four classes of behavior. First, mSigPortal API functions retrieve public reference, cohort, activity, association, prevalence, and etiology resources. Second, local validation and QC modules operate on user-supplied spectra or matrices in the browser. Third, local analytical modules perform NNLS fitting, residual calculation, bootstrap resampling, threshold sensitivity, signature ambiguity scoring, catalog-sufficiency checks, cohort comparison, panel evidence calls, and exploratory NMF extraction. Fourth, plotting and report modules generate visual and structured outputs for manuscripts, notebooks, and web applications.

[Insert Table 1 here: docs/manuscript/google-doc-tables/table1-researcher-journey-capabilities.html]

### Computation and Privacy Boundary

The revised manuscript intentionally avoids the claim that all mSigSDK functionality is local. Public mSigPortal reference and cohort queries are external API interactions. Once user spectra or MAF-derived matrices are loaded into the browser, validation, local NNLS fitting, uncertainty analyses, trust scoring, cohort comparison, panel evidence tiering, and exploratory NMF can run on the client. This distinction is important for privacy-sensitive workflows and for reproducibility.

[Insert Table 2 here: docs/manuscript/google-doc-tables/table2-computation-privacy-boundary.html]

### Burden-Aware Advisor and Fit Trust

The v0.3 advisor layer implements a burden-aware analysis strategy function, signature ambiguity scoring, catalog-sufficiency checks, and a composite fit-trust framework. The advisor classifies samples and cohorts by mutation burden and cohort structure, then recommends restricted refitting, standard known-signature fitting, subgroup discovery, panel evidence reporting, or no decomposition when signal is insufficient. The fit-trust framework combines mutation burden, reconstruction similarity, residual unexplained fraction, bootstrap stability, threshold sensitivity, active-signature ambiguity, and catalog sufficiency into a per-sample trust score and classification.

These features were added because the mutational-signature literature repeatedly identifies interpretation failure modes that are not solved by plotting fitted exposures alone. Practical guides describe ambiguous assignments, overcalling, localized processes, and signature bleeding in heterogeneous cohorts [11]. Recent fitting benchmarks show that performance changes with mutation count, signature flatness, signature similarity, cancer type, and incomplete reference catalogs, and that no single method or fixed threshold is universally optimal [12]. Therefore, the SDK reports warning codes, confidence classes, and recommended actions as first-class workflow outputs.

[Insert Table 3 here: docs/manuscript/google-doc-tables/table3-trust-warning-actions.html]

### Cohort, Panel/WES, and Localized Workflows

The new pipeline namespace provides one-call workflow functions. \`runSingleSampleFit\` validates one spectrum, fits reference signatures, quantifies uncertainty, checks residual signal, and returns a report. \`runCohortFit\` performs cohort-level validation, fitting, trust scoring, subgroup detection, and optional metadata-stratified exposure comparison. \`runSubgroupDiscoveryWorkflow\` runs NMF extraction within sufficiently powered subgroups, matches extracted signatures to reference signatures, and refits samples with a shortlisted catalog. \`runPanelWorkflow\` adds callable-opportunity normalization, signature detectability estimates, tiered evidence calls, and explicit not-assessable outputs. \`runLocalizedMutagenesisAnalysis\` prepares rainfall-style focal mutagenesis summaries.

These workflows were prioritized over adding another isolated plot because they reflect how researchers actually move from input data to interpretation. Cohort workflows address the known problem that heterogeneous samples can produce implausible signature assignments if extracted or refitted as one undifferentiated group [11]. Panel/WES workflows are separated from WGS workflows because targeted-panel studies show that variant count and restricted genomic footprint affect which signatures can be responsibly reported [13]. The localized workflow is included because regional hypermutation can be missed by whole-sample SBS96 summaries [11].

### Visualization and Report Outputs

mSigSDK renders cohort burden plots, SBS96 spectrum comparisons, cosine heatmaps, force-directed trees, UMAP projections, exposure heatmaps, exposure pie charts, reconstruction plots, residual profiles, bootstrap intervals, threshold-sensitivity atlases, fit-trust dashboards, cohort group-comparison plots, panel evidence matrices, NMF profile plots, NMF heatmaps, rank diagnostics, and reference-match summaries. The manuscript figures were generated from HTML pages that call these SDK functions directly.

## Results

### Cohort Exploration

Using PCAWG Lung-AdenoCA SBS96 spectra retrieved through mSigPortal APIs and snapshotted for reproducible figure generation, mSigSDK generated a browser-native cohort exploration view. The figure includes mutation burden summaries, a COSMIC-style SBS96 profile comparison for two samples, a double-clustered cosine similarity heatmap, an SDK-computed similarity tree, and a UMAP projection. These views are designed to help researchers inspect cohort structure before fitting or extraction.

We placed this view first because mutational-signature analysis conventionally begins with the mutation catalog itself: SBS96 context profiles, mutation burden, and sample-to-sample similarity determine whether refitting or extraction is interpretable [1,6]. Panel B specifically uses the COSMIC-style SBS96 comparison renderer because the field-standard visual grammar groups the 96 trinucleotide contexts by the six base-substitution classes and makes profile differences visible in a dedicated difference panel [1,6]. The heatmap, similarity tree, and UMAP address the practical need to identify outliers and heterogeneous substructure before downstream fitting or extraction [11].

![Figure 1. Browser-native cohort exploration and similarity structure](actual-figure-pages/screenshots/figure1-cohort-exploration.png)

**Figure 1. Browser-native cohort exploration and similarity structure.** Actual mSigSDK visualizations for PCAWG Lung-AdenoCA SBS96 spectra. Panel B uses the COSMIC-style SBS96 comparison renderer rather than a generic grouped bar chart.

### Local Known-Signature Fitting

We next fitted selected PCAWG Lung-AdenoCA spectra to COSMIC SBS96 reference signatures using browser-local NNLS. The SDK generated a double-clustered exposure heatmap, a single-sample exposure pie chart, reconstruction quality metrics, and an observed-versus-reconstructed residual profile. These panels demonstrate that mSigSDK v0.3 performs local fitting and fit-quality visualization rather than only displaying precomputed portal output.

We selected this panel set because known-signature refitting is a standardized task for single samples and small cohorts, supported by deconstructSigs, MutationalPatterns, and SigProfilerAssignment [5-7]. The heatmap summarizes cohort-level exposure structure, the pie chart gives a single-sample interpretation view, and the reconstruction/residual panels test whether the fitted signature mixture explains the observed spectrum. These panels directly address whether mSigSDK performs local computation and fit assessment rather than only rendering repository outputs.

![Figure 2. Local known-signature fitting and exposure interpretation](actual-figure-pages/screenshots/figure2-known-signature-fitting.png)

**Figure 2. Local known-signature fitting and exposure interpretation.** Browser-local NNLS fitting against selected COSMIC SBS96 reference signatures.

### Trust, Uncertainty, and Low-Burden Behavior

The v0.3 trust dashboard summarizes fit confidence across burden, reconstruction, residual, bootstrap, threshold, ambiguity, and catalog-sufficiency components. Bootstrap intervals and threshold-sensitivity panels show whether fitted exposures are stable enough for interpretation. In the controlled low-burden stress test, mean reconstruction cosine increased from 0.631 at 50 mutations per sample to 0.957 at 1000 mutations per sample, while mean bootstrap confidence-interval width decreased from 0.438 to 0.121. This supports the revised manuscript's emphasis that low-burden outputs should be interpreted with uncertainty and caveats rather than universal thresholds alone.

These diagnostics are necessary because reconstruction similarity alone is not enough to establish biological interpretability. Prior work shows that mutation count, flat or similar signatures, thresholding, and incomplete reference catalogs can drive false positives, exchangeable exposures, and divergent tool outputs [11,12]. The figure therefore shows the SDK's central v0.3 contribution: every workflow can return trust signals, caveats, and recommended actions rather than only fitted exposure values.

![Figure 3. Burden-aware guidance, fit trust, uncertainty, and threshold robustness](actual-figure-pages/screenshots/figure3-qc-trust-uncertainty.png)

**Figure 3. Burden-aware guidance, fit trust, uncertainty, and threshold robustness.** Actual v0.3 trust, bootstrap, threshold, and low-burden stress-test outputs.

[Insert Table 5 here: docs/manuscript/google-doc-tables/table5-low-burden-stress-test.html]

### Cohort and Panel/WES Workflows

The v0.3 cohort workflow adds metadata-stratified exposure comparison and subgroup-aware extraction/refitting. In the demonstration, PCAWG Lung-AdenoCA samples were stratified by mutation-burden group to illustrate the group-comparison API without making a disease-etiology claim. The panel/WES workflow applied a restricted callable-opportunity setting, estimated signature detectability, and returned strong, weak, not detected, or not assessable evidence tiers. This directly addresses the need to avoid interpreting absent signatures in restricted-territory or low-count settings as true biological absence.

These panels demonstrate the SDK's movement from visualization primitives to researcher-facing workflows. The cohort panels address the literature-described risk that heterogeneous cohorts can bleed signatures across samples if analyzed without subgroup awareness [11]. The panel/WES panels address a separate applied setting in which targeted sequencing can support selected high-signal clinical or translational calls, but variant count and restricted footprint constrain sensitivity and make "not assessable" different from "not present" [13].

![Figure 4. Cohort and panel workflows introduced in mSigSDK v0.3](actual-figure-pages/screenshots/figure4-cohort-panel-workflows.png)

**Figure 4. Cohort and panel workflows introduced in mSigSDK v0.3.** Metadata-stratified exposure comparison, panel evidence matrix, fit-trust dashboard, and subgroup extraction/refit summary generated by SDK workflow calls.

### Exploratory Browser-Side NMF

mSigSDK includes browser-side NMF extraction for exploratory, moderate-sized datasets. The NMF figure shows extracted SBS96 profiles, relative exposure heatmap, rank diagnostics, and reference-signature matching. The manuscript should be explicit that this is exploratory browser-side extraction and not positioned as a production replacement for SigProfilerExtractor or other large-scale extraction engines.

This final result shows the implemented extraction boundary transparently. De novo extraction with NMF is fundamental to mutational-signature discovery, and production tools such as SigProfilerExtractor benchmark this task at scale [1,4]. mSigSDK's browser-side NMF panels are therefore presented as exploratory and browser-sized: useful for review, teaching, rapid cohort inspection, and handoff to production extraction, but not as a claim that browser JavaScript should replace dedicated extraction engines for large studies.

![Figure 5. Exploratory browser-side NMF extraction](actual-figure-pages/screenshots/figure5-nmf-extraction.png)

**Figure 5. Exploratory browser-side NMF extraction.** Actual mSigSDK NMF extraction, rank diagnostics, and reference matching for a browser-sized PCAWG Lung-AdenoCA subset.

### Benchmarks

Synthetic SBS96 matrices were used to benchmark local workflow components. Validation and advisor calls ran in milliseconds. On 100 samples and 12 signatures, local NNLS fitting took approximately 1305 ms, the v0.3 cohort fit pipeline took approximately 1201 ms without bootstrap or threshold sweeps, and the v0.3 panel/WES workflow took approximately 1459 ms. Threshold sensitivity and bootstrap analyses were slower because they intentionally repeat fitting across thresholds or resampled spectra. These results support the use of mSigSDK for interactive local workflows while motivating careful parameter choices for large cohorts.

[Insert Table 4 here: docs/manuscript/google-doc-tables/table4-compute-benchmarks.html]

### Related Tools

mSigSDK is complementary to existing mutational-signature tools. It does not replace production extraction or assignment frameworks. Its contribution is browser-native integration, local workflow guidance, explicit privacy boundaries, and publication-oriented outputs.

[Insert Table 6 here: docs/manuscript/google-doc-tables/table6-related-tools.html]

## Discussion

The revised SDK and manuscript address the principal critique of the original submission: mSigSDK should not be marketed as if all analysis logic were independent of mSigPortal APIs or as if browser JavaScript were the preferred environment for production-scale de novo extraction. The v0.3 manuscript instead frames mSigSDK as a browser-native workflow SDK. This framing is more accurate and scientifically stronger. It allows the paper to claim implemented local computation where it exists, identify API-dependent public data access where it exists, and position exploratory browser-side extraction with appropriate limits.

The most important new feature is not a single algorithm. It is the workflow contract that each pipeline returns results together with caveats, confidence classifications, warning codes, and recommended actions. This is especially important for low-burden samples, panel/WES analyses, incomplete catalogs, and heterogeneous cohorts. Reconstruction similarity alone can be misleading; therefore, mSigSDK combines burden, residuals, bootstrap behavior, threshold dependence, ambiguity, and catalog sufficiency.

The v0.3 cohort and panel workflows also broaden the audience for the SDK. Cohort researchers can inspect heterogeneity, compare exposures across metadata-defined groups, and run subgroup extraction only when subgroup size and burden support it. Translational and panel users can report evidence tiers and not-assessable calls rather than overinterpreting full decompositions from restricted territories.

Several limitations remain. Browser memory and single-threaded execution constrain large matrix operations, although Web Worker support can reduce interface blocking for selected workflows. Exploratory NMF should be used for browser-sized analyses and teaching or review tasks, whereas production de novo extraction should use established engines. The low-burden stress test is controlled and reproducible, but it does not replace disease-specific validation in a rare cancer cohort. Finally, direct benchmarking against AI-assisted genomic visualization interfaces requires a named, versioned platform and a same-task protocol; this is best handled as a separate reproducible benchmark rather than as a broad claim.

## Conclusions

mSigSDK v0.3 provides a browser-native JavaScript SDK for mutational-signature workflows that combine public resource access with local, privacy-aware analysis modules. The revised SDK supports data validation, burden-aware method selection, known-signature fitting, trust scoring, uncertainty analysis, cohort comparison, panel/WES evidence calls, exploratory extraction, and publication-ready outputs. Its scientific merit lies in making mutational-signature workflows safer, more transparent, and easier to embed in web-native research environments, while preserving clear boundaries around what is local, what is API-dependent, and what remains better suited to production-scale external tools.

## Availability and Requirements

Project name: mSigSDK  
Project home page: https://github.com/episphere/msig  
Operating systems: Platform independent  
Programming language: JavaScript, ECMAScript 6 modules  
Current manuscript version: 0.3.0  
Other requirements: Modern browser supporting ES modules. Internet connectivity is required for mSigPortal API queries, but user-supplied spectra can be analyzed locally after import.  
License: MIT  
Restrictions for non-academic use: None

## Declarations

### Ethics Approval and Consent to Participate

Not applicable.

### Consent for Publication

Not applicable.

### Availability of Data and Materials

The mSigSDK source code and example workflows are available at https://github.com/episphere/msig. The manuscript figures and tables are generated from files in \`docs/manuscript\`. Public demonstration spectra and signatures are retrieved from mSigPortal and related public resources through SDK API calls.

### Competing Interests

The authors declare no competing interests.

### Funding

This work was funded by the National Cancer Institute Intramural Research Program.

### Author Contributions

A.G. conceived and developed mSigSDK, implemented the v0.3 workflow modules, generated figures and tables, and drafted the manuscript. J.S.A. provided project direction and technical guidance. T.Z., Y.C.M., M.T.L., B.P., K.C., and J.B. provided feedback, domain guidance, and manuscript review. All authors reviewed and approved the final manuscript.

## References

1. Alexandrov LB, et al. The repertoire of mutational signatures in human cancer. Nature. 2020;578:94-101. doi:10.1038/s41586-020-1943-3.
2. Landi MT, et al. Tracing lung cancer risk factors through mutational signatures in never-smokers: the Sherlock-Lung Study. Am J Epidemiol. 2021;190:962-976. doi:10.1093/aje/kwaa234.
3. Pich O, Muinos F, Lolkema MP, Steeghs N, Gonzalez-Perez A, Lopez-Bigas N. The mutational footprints of cancer therapies. Nat Genet. 2019;51:1732-1740. doi:10.1038/s41588-019-0525-5.
4. Islam SMA, et al. Uncovering novel mutational signatures by de novo extraction with SigProfilerExtractor. Cell Genomics. 2022;2:100179. doi:10.1016/j.xgen.2022.100179.
5. Diaz-Gay M, et al. Assigning mutational signatures to individual samples and individual somatic mutations with SigProfilerAssignment. Bioinformatics. 2023;39:btad756. doi:10.1093/bioinformatics/btad756.
6. Blokzijl F, Janssen R, van Boxtel R, Cuppen E. MutationalPatterns: comprehensive genome-wide analysis of mutational processes. Genome Med. 2018;10:33. doi:10.1186/s13073-018-0539-0.
7. Rosenthal R, et al. deconstructSigs: delineating mutational processes in single tumors distinguishes DNA repair deficiencies and patterns of carcinoma evolution. Genome Biol. 2016;17:31. doi:10.1186/s13059-016-0893-4.
8. Zhang T, Sang J, Cho P, Jiang K, Landi MT. Integrative mutational signature portal (mSigPortal) for cancer genomic study. Cancer Res. 2021;81(13 Supplement):211. doi:10.1158/1538-7445.AM2021-211.
9. Wilkinson MD, et al. The FAIR Guiding Principles for scientific data management and stewardship. Sci Data. 2016;3:160018. doi:10.1038/sdata.2016.18.
10. Grossman RL, Heath A, Murphy M, Patterson M, Wells W. A case for data commons: toward data science as a service. Comput Sci Eng. 2016;18:10-20. doi:10.1109/MCSE.2016.92.
11. Maura F, et al. A practical guide for mutational signature analysis in hematological malignancies. Nat Commun. 2019;10:2969. doi:10.1038/s41467-019-11037-8.
12. Medo M, Ng CKY, Medova M. A comprehensive comparison of tools for fitting mutational signatures. Nat Commun. 2024;15:9467. doi:10.1038/s41467-024-53711-6.
13. Lawrence L, Kunder CA, Fung E, Stehr H, Zehnder J. Performance characteristics of mutational signature analysis in targeted panel sequencing. Arch Pathol Lab Med. 2021;145:1424-1431. doi:10.5858/arpa.2020-0536-OA.
`;
}

async function main() {
  await mkdir(TABLE_DIR, { recursive: true });
  await mkdir(FIGURE_PAGE_DIR, { recursive: true });
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const benchmarkPayload = await readJsonIfExists(BENCHMARK_JSON, { rows: [] });
  const lowBurdenPayload = await readJsonIfExists(LOW_BURDEN_JSON, { rows: [] });
  const figureSnapshot = await loadOrCreateFigureSnapshot();
  const tables = createTables(benchmarkPayload, lowBurdenPayload);
  const figurePages = createFigurePages(lowBurdenPayload, figureSnapshot);

  for (const [filename, content] of tables) {
    await writeFile(join(TABLE_DIR, filename), fullHtml(filename, content));
  }
  await writeFile(
    join(TABLE_DIR, "all-google-doc-tables.html"),
    fullHtml(
      "mSigSDK v0.3 manuscript tables",
      tables
        .map(([, content]) => content)
        .join('\n<hr style="border:0;border-top:1px solid #d0d7e2;margin:22px 0;">\n')
    )
  );

  for (const [filename, content] of figurePages) {
    await writeFile(join(FIGURE_PAGE_DIR, filename), content);
  }

  await writeFile(join(MANUSCRIPT_DIR, "MANUSCRIPT_FIGURES_AND_TABLES.md"), figuresAndTablesPlan());
  await writeFile(join(MANUSCRIPT_DIR, "MANUSCRIPT_COMPLETION_PLAN.md"), completionPlan());
  await writeFile(join(MANUSCRIPT_DIR, "REVISED_CENTRAL_FRAMING.md"), centralFraming());
  let finalManuscriptDraft = manuscriptDraft();
  try {
    finalManuscriptDraft = await readFile(
      join(MANUSCRIPT_DIR, "MSIGSDK_FINAL_SUBMISSION_DRAFT.md"),
      "utf8"
    );
  } catch (_error) {
    await writeFile(join(MANUSCRIPT_DIR, "MSIGSDK_FINAL_SUBMISSION_DRAFT.md"), finalManuscriptDraft);
  }
  await writeFile(join(MANUSCRIPT_DIR, "MSIGSDK_REVISED_MANUSCRIPT_DRAFT.md"), finalManuscriptDraft);

  await writeFile(
    join(FIGURE_PAGE_DIR, "README.md"),
    `# Actual mSigSDK Figure Pages

These HTML pages generate manuscript figure panels using real mSigSDK workflows.

Run the local server from the repository root:

\`\`\`bash
npm run serve:observable
\`\`\`

Then open:

- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure1-cohort-exploration.html
- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure2-known-signature-fitting.html
- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure3-qc-trust-uncertainty.html
- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure4-cohort-panel-workflows.html
- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure5-nmf-extraction.html

Screenshots are written to \`docs/manuscript/actual-figure-pages/screenshots/\` when captured.
`
  );

  await writeFile(
    join(TABLE_DIR, "README.md"),
    `# Google Docs Manuscript Tables

These files are clean standalone HTML tables designed for copy/paste into a Google Docs manuscript.

Open \`all-google-doc-tables.html\` in a browser, select one table at a time, and paste into the manuscript.
`
  );

  console.log(`Wrote ${tables.length} tables, ${figurePages.length} figure pages, plans, and manuscript draft.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
