#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import { join } from "node:path";

const MANUSCRIPT_DIR = "docs/manuscript";
const TABLE_DIR = join(MANUSCRIPT_DIR, "google-doc-tables");
const FIGURE_PAGE_DIR = join(MANUSCRIPT_DIR, "actual-figure-pages");
const FIGURE_DATA_DIR = join(FIGURE_PAGE_DIR, "data");
const SCREENSHOT_DIR = join(FIGURE_PAGE_DIR, "screenshots");
const MANUSCRIPT_TEXT_DIR = join(MANUSCRIPT_DIR, "manuscript");
const BENCHMARK_JSON = join(MANUSCRIPT_DIR, "data", "benchmark-results.json");
const BROWSER_BENCHMARK_JSON = join(
  MANUSCRIPT_DIR,
  "experiments",
  "2026_05_14_browser_benchmark",
  "data",
  "browser-benchmark-results.json"
);
const LOW_BURDEN_JSON = join(MANUSCRIPT_DIR, "data", "low-burden-stress-test.json");
const SYNTHETIC_VALIDATION_JSON = join(MANUSCRIPT_DIR, "data", "synthetic-validation-results.json");
const CONCORDANCE_VALIDATION_JSON = join(MANUSCRIPT_DIR, "data", "concordance-validation-results.json");
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
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="${tdStyle}">${cell}</td>`
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

const BENCHMARK_TABLE_HEADERS = [
  "Use case",
  "Sequencing mode",
  "Workflow step",
  "Samples (n)",
  "Mutations/sample (n)",
  "Contexts (n)",
  "Signatures (n)",
  "Run settings",
  "Node repeats (n)",
  "Node runtime median (range, ms)",
  "Chrome repeats (n)",
  "Chrome runtime median (range, ms)",
  "Chrome heap after median (MB)",
  "Browser memory method",
  "Node RSS after median (MB)",
];

function benchmarkRowsRaw(payload, browserPayload = { rows: [] }) {
  const rows = payload.rows || [];
  const browserRows = browserPayload.rows || [];
  const scenarioOrder = new Map(
    [
      "single_sample_wgs_review",
      "panel_wes_batch",
      "rare_cancer_cohort",
      "medium_research_cohort",
      "portal_review_cohort",
      "small_discovery_cohort",
      "medium_discovery_cohort",
    ].map((id, index) => [id, index])
  );
  const operationLabels = {
    validation_qc: "Validation and burden summary",
    nnls_fit: "Known-signature refitting",
    reconstruction_metrics: "Reconstruction quality metrics",
    threshold_sensitivity: "Threshold sensitivity analysis",
    bootstrap_one_sample: "Bootstrap uncertainty, one sample",
    nmf_rank_selection: "Exploratory NMF rank selection",
    nmf_extract_recommended_rank: "Exploratory NMF extraction",
    v03_analysis_advisor: "Burden-aware review summary",
    v03_fit_quality_evidence: "Fit-quality review summary",
    v03_restricted_assay_evidence: "Restricted-assay evidence summary",
    v03_cohort_fit_pipeline: "Cohort fit workflow",
    v03_panel_workflow: "Panel/WES review workflow",
    v03_subgroup_discovery: "Subgroup discovery workflow",
  };
  const operationOrder = new Map(
    Object.keys(operationLabels).map((operation, index) => [operation, index])
  );
  const settingsFor = (row) => {
    const settings = [];
    if (Number.isFinite(row.iterations) && row.iterations > 0) {
      settings.push(`${row.iterations} iterations`);
    } else if (row.iterations && !Number.isNaN(Number(row.iterations))) {
      settings.push(`${Number(row.iterations)} iterations`);
    }
    const thresholds = Array.isArray(row.thresholds)
      ? row.thresholds
      : String(row.thresholds || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
    if (thresholds.length) {
      settings.push(`${thresholds.join(", ")} thresholds`);
    }
    const ranks = Array.isArray(row.ranks)
      ? row.ranks
      : String(row.ranks || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
    if (ranks.length) {
      settings.push(`ranks ${ranks.join(", ")}`);
    }
    return settings.length ? settings.join("; ") : "Default";
  };
  const runtimeDisplay = (row) => {
    const median = Number(row.runtimeMedianMs ?? row.runtimeMs);
    const min = Number(row.runtimeMinMs ?? row.runtimeMs);
    const max = Number(row.runtimeMaxMs ?? row.runtimeMs);
    if (!Number.isFinite(median)) {
      return "NA";
    }
    return `${fmt(median, 1)} (${fmt(min, 1)}-${fmt(max, 1)})`;
  };
  const rowKey = (row) =>
    [
      row.id,
      row.operation,
      row.iterations || "",
      Array.isArray(row.thresholds) ? row.thresholds.join("|") : row.thresholds || "",
      Array.isArray(row.ranks) ? row.ranks.join("|") : row.ranks || "",
    ].join("::");
  const chromeByKey = new Map(
    browserRows
      .filter((row) => row.browser === "chrome" && operationLabels[row.operation])
      .map((row) => [rowKey(row), row])
  );

  return rows
    .filter((row) => operationLabels[row.operation])
    .sort((a, b) => {
      const scenarioDelta =
        (scenarioOrder.get(a.id) ?? 999) - (scenarioOrder.get(b.id) ?? 999);
      if (scenarioDelta !== 0) {
        return scenarioDelta;
      }
      return (operationOrder.get(a.operation) ?? 999) - (operationOrder.get(b.operation) ?? 999);
    })
    .map((row) => {
      const chromeRow = chromeByKey.get(rowKey(row));
      return [
      row.useCase || row.id || "NA",
      row.sequencing || "NA",
      operationLabels[row.operation],
      row.samples,
      row.mutationsPerSample,
      row.contexts,
      row.signatures || "NA",
      settingsFor(row),
      row.repeats || 1,
      runtimeDisplay(row),
      chromeRow?.repeats || "NA",
      chromeRow ? runtimeDisplay(chromeRow) : "NA",
      chromeRow ? fmt(Number(chromeRow.heapAfterMB), 2) : "NA",
      chromeRow?.memoryMethod || "NA",
      fmt(row.rssAfterMB, 2),
    ];
    });
}

function benchmarkRows(payload, browserPayload) {
  return benchmarkRowsRaw(payload, browserPayload).map((row) => row.map(esc));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function benchmarkCsv(payload, browserPayload) {
  return `${[BENCHMARK_TABLE_HEADERS, ...benchmarkRowsRaw(payload, browserPayload)]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

const SYNTHETIC_VALIDATION_HEADERS = [
  "Mutations per sample",
  "Samples (n)",
  "Exposure cosine, mean (95% CI)",
  "Exposure MAE, mean (95% CI)",
  "Active-signature recall, mean (95% CI)",
  "Inactive-signature calls, mean (95% CI)",
  "Reconstruction cosine, mean (95% CI)",
];

function formatMeanCi(metric, digits = 3) {
  if (!metric || !Number.isFinite(metric.mean)) {
    return "NA";
  }
  return `${metric.mean.toFixed(digits)} (${metric.ciLower.toFixed(digits)}-${metric.ciUpper.toFixed(digits)})`;
}

function syntheticValidationRowsRaw(payload) {
  return (payload.summaryRows || []).map((row) => [
    row.burden,
    row.samples,
    formatMeanCi(row.metrics?.exposureCosine),
    formatMeanCi(row.metrics?.exposureMae),
    formatMeanCi(row.metrics?.activeRecall),
    formatMeanCi(row.metrics?.falsePositiveFraction),
    formatMeanCi(row.metrics?.reconstructionCosine),
  ]);
}

function syntheticValidationCsv(payload) {
  return `${[SYNTHETIC_VALIDATION_HEADERS, ...syntheticValidationRowsRaw(payload)]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

const CONCORDANCE_HEADERS = ["Comparison element", "Result", "Interpretation"];

function concordanceRowsRaw(payload) {
  return payload.tableRows || [];
}

function concordanceCsv(payload) {
  return `${[CONCORDANCE_HEADERS, ...concordanceRowsRaw(payload)]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

function createTables(benchmarkPayload, lowBurdenPayload, syntheticValidationPayload, concordancePayload, browserBenchmarkPayload) {
  const table1 = htmlTable({
    number: "1",
    title: "mSigSDK workflows, inputs, and outputs.",
    headers: ["Workflow", "Intended use", "Input requirements", "Primary outputs"],
    rows: [
      [
        "mSigPortal extension",
        "Reuse selected mSigPortal reference and cohort resources outside a single portal session.",
        "Internet access and supported public mSigPortal resources.",
        "Portal-consistent resource access, spectra, signatures, and plots.",
      ],
      [
        "Single-sample review",
        "Inspect a precomputed tumor spectrum before biological interpretation or sharing.",
        "One SBS96 spectrum and a compatible reference catalog.",
        "Burden, context coverage, fitted exposures, reconstruction, residuals, uncertainty, and report-ready summaries.",
      ],
      [
        "Small-cohort review",
        "Compare spectra and fitted exposures across a cohort or metadata-defined groups.",
        "Sample-by-context spectra and optional sample metadata.",
        "Similarity structure, group summaries, exposure comparisons, and cohort-level fit-quality review summaries.",
      ],
      [
        "Panel/WES review",
        "Summarize whether fitted signatures are assessable in restricted genomic territory.",
        "Panel or exome spectra, reference signatures, and optional callable opportunities.",
        "Opportunity-normalized fits, callable-territory evidence, expected fitted signature mutation counts, and review evidence tiers.",
      ],
      [
        "Teaching and static review pages",
        "Share reproducible examples without requiring each reader to install R or Python packages.",
        "Archived spectra, fixed parameters, and a browser or web notebook.",
        "Interactive plots, structured reports, and copy/paste tables.",
      ],
      [
        "Exploratory discovery",
        "Screen browser-sized cohorts for possible signatures before handoff to production extraction tools.",
        "Moderate sample-by-context spectra with adequate burden and a prespecified rank range.",
        "NMF profiles, exposure heatmaps, rank diagnostics, and reference matches.",
      ],
    ],
    note:
      "The SDK is designed for interactive review, visualization, and lightweight local analysis of precomputed mutational spectra.",
  });

  const table2 = htmlTable({
    number: "2",
    title: "Computation locus, external dependencies, and privacy boundary.",
    headers: ["Workflow", "Computed in browser/client runtime", "External dependency", "Privacy interpretation"],
    rows: [
      ["mSigPortal public reference and cohort queries", "No, data are retrieved remotely", "mSigPortal API", "Public or portal-hosted data; no claim of local computation for API retrieval"],
      ["TCGA/GDC helper queries", "No, data are retrieved remotely before conversion", "GDC/TCGA APIs", "Public or access-governed data follow upstream GDC rules; no claim of local computation for API retrieval"],
      ["User spectra or MAF-derived matrix validation", "Yes", "None after import", "User mutation data can remain local"],
      ["Known-signature NNLS fitting and reconstruction review", "Yes", "Optional reference catalog fetch", "User spectra can remain local; reference data may be public API-derived"],
      ["Bootstrap, threshold sensitivity, fit-quality review, and residual checks", "Yes", "None", "Local; runtime scales with iterations, thresholds, and catalog size"],
      ["Cohort grouping and metadata-stratified exposure comparison", "Yes", "None", "Local if metadata and spectra are user supplied"],
      ["Panel/WES opportunity normalization and review evidence tiers", "Yes", "None", "Local; outputs include callable-territory evidence and evidence tiers"],
      ["Exploratory NMF extraction", "Yes for browser-sized cohorts", "None", "Local for moderate matrices"],
      ["Plot rendering, HTML tables, reports, and provenance", "Yes", "Browser plotting libraries", "Local unless the user exports or shares outputs"],
    ],
    note:
      "mSigSDK performs selected review analyses locally after import and also interoperates with public APIs for public resources.",
  });

  const table3 = htmlTable({
    number: "3",
    title: "Algorithmic defaults used in manuscript workflows.",
    headers: ["Component", "Operational setting", "Output used in review", "Scope note"],
    rows: [
      ["Input spectra", "SBS96 sample-by-context matrices with finite numeric values; missing and extra contexts are reported against the expected context list.", "Mutation burden, context completeness, empty-spectrum flags, and low-burden flags.", "Applies after spectra have been generated or imported."],
      ["Known-signature refitting", "Coordinate-descent nonnegative least squares with relative exposures below 0.01 removed and remaining exposures renormalized in manuscript workflows.", "Fitted exposures for a supplied reference catalog.", "Catalog refit to the supplied signatures."],
      ["Reconstruction and residuals", "Observed and reconstructed spectra compared in relative scale using cosine similarity, cosine distance, RMSE, mean absolute error, L1/L2 error, and maximum residual.", "Fit-quality metrics and residual spectra.", "Reviewed with burden, uncertainty, and ambiguity fields."],
      ["Bootstrap uncertainty", "Multinomial resampling of the observed spectrum; manuscript examples use 95% intervals.", "Exposure means, medians, confidence intervals, and selection frequencies.", "Intervals condition on the observed spectrum, supplied catalog, and fitting settings."],
      ["Threshold sensitivity", "Relative exposure thresholds of 0, 0.01, 0.03, 0.05, and 0.10 in the manuscript examples.", "Changes in active signatures, reconstruction cosine, and RMSE across thresholds.", "Sensitivity analysis across stated cutoffs."],
      ["Signature ambiguity", "Pairwise signature cosine values at or above 0.90 are reported; high ambiguity is assigned at nearest-neighbor cosine at least 0.95 or entropy at least 0.92.", "Flags for exchangeable or broad reference signatures.", "Highlights closely similar reference signatures."],
      ["Catalog sufficiency", "Possible out-of-catalog signal is flagged using relative unexplained fraction at least 0.07, suspected signal at least 0.12, reconstruction cosine below 0.90, or structured positive residual cosine at least 0.85.", "Residual patterns and recommended catalog review actions.", "Supports catalog and disease-context review."],
      ["Fit-quality review labels", "Low burden is below 100 mutations and moderate burden is below 1000 by default. Labels summarize burden, reconstruction, residual, bootstrap, threshold, ambiguity, and catalog flags.", "Reporting modes and underlying evidence fields.", "Aggregates evidence while preserving component metrics."],
      ["Panel/WES review evidence tiers", "Minimum assessable burden is 30 mutations; limited-support exposure threshold is 0.05; higher-support threshold is 0.20. Callable-opportunity maps are supplied from the assay territory and genome build.", "Higher review support, limited review support, not detected within review settings, or not assessable for each fitted signature.", "Not assessable indicates insufficient burden or callable territory for a tier call."],
      ["Exploratory NMF", "Multiplicative-update NMF minimizes Frobenius reconstruction error. Manuscript examples use fixed ranks or rank sweeps over small browser-sized cohorts.", "Extracted profiles, exposures, reconstruction metrics, run diagnostics, and reference matches.", "Browser-sized profile inspection and handoff support."],
    ],
    note:
      "Thresholds are configurable; the table lists settings used in the manuscript examples.",
  });

  const tableBenchmark = htmlTable({
    number: "6",
    title: "Scenario-calibrated local compute measurements for realistic mSigSDK use cases.",
    headers: BENCHMARK_TABLE_HEADERS,
    rows: benchmarkRows(benchmarkPayload, browserBenchmarkPayload),
    note:
      "Measurements used deterministic synthetic SBS96 matrices sized to represent common mSigSDK use cases. Node.js rows were repeated five times on Windows x64 with Node.js v16.16.0, Intel Core i7-11700K CPU, and 16 GB RAM. Browser rows were repeated three times in Chrome 148.0.7778.167 with the standalone Web Performance API harness. Firefox was requested by the runner but was not available in the local execution environment. Timings do not include plot rendering. Memory values are approximate and use the browser memory API exposed by the runtime.",
  });

  const tableSynthetic = htmlTable({
    number: "4",
    title: "Controlled synthetic exposure-recovery validation.",
    headers: SYNTHETIC_VALIDATION_HEADERS,
    rows: syntheticValidationRowsRaw(syntheticValidationPayload).map((row) => row.map(esc)),
    note:
      "Known COSMIC SBS96 mixtures were generated from six reference signatures and refitted with the SDK workflow. MAE, mean absolute exposure error. Active-signature recall and inactive-signature calls used a 5% exposure threshold. Confidence intervals are normal-approximation intervals across synthetic samples within each burden.",
  });

  const tableConcordance = htmlTable({
    number: "5",
    title: "Independent NNLS check and cross-tool concordance on shared PCAWG Lung-AdenoCA spectra.",
    headers: CONCORDANCE_HEADERS,
    rows: concordanceRowsRaw(concordancePayload).map((row) => row.map(esc)),
    note:
      "All comparators used the same 38-sample SBS96 matrix and the same nine COSMIC SBS96 reference signatures. mSigSDK, deconstructSigs, SigProfilerAssignment, and MuSiCal exposure vectors were thresholded at 1% relative exposure and renormalized before cosine comparison. deconstructSigs used R 4.1.1; SigProfilerAssignment was run with matrices written in canonical SBS96 order; MuSiCal used SparseNNLS from the Park Lab implementation.",
  });

  const tableRelated = htmlTable({
    number: "7",
    title: "Functional positioning relative to related mutational-signature software.",
    headers: [
      "Tool or platform",
      "Primary role",
      "Browser execution",
      "Interoperability with mSigSDK",
      "QC/reporting layer",
    ],
    rows: [
      ["mSigSDK", "Browser-native review SDK for spectra import, validation, NNLS refitting, QC, panel review, exploratory NMF, interoperability, and reporting.", "Yes, JavaScript core; optional Pyodide for compatible Python packages.", "Native nested matrices plus SigProfiler, COSMIC, MuSiCal-compatible, and report JSON Schema formats.", "Structured warnings, fit-quality evidence, recommended actions, figures, and provenance."],
      ["mSigPortal", "Public mutational-signature portal and API.", "Portal hosted.", "mSigSDK retrieves public mSigPortal spectra and signatures and reuses selected plotting conventions.", "Portal-specific."],
      ["SigProfilerExtractor", "Production de novo mutational-signature extraction.", "Not directly; used through local Python or server execution.", "mSigSDK exports matrix inputs, creates a runnable Python script, and parses extracted signature and exposure TSV outputs.", "SigProfilerExtractor stability diagnostics plus mSigSDK screening and report metadata."],
      ["deconstructSigs", "R-based known-signature decomposition.", "Not directly; used through local R or external execution.", "mSigSDK exports deconstructSigs-compatible TSV inputs and parses sample-by-signature exposure tables.", "deconstructSigs fit outputs plus mSigSDK uncertainty, threshold sensitivity, and provenance."],
      ["SigProfilerAssignment", "Known-signature assignment against a supplied catalog.", "Optional browser execution through Pyodide matrix-mode runs when package installation and dependencies succeed; local Python remains the production path.", "mSigSDK prepares matrix-mode input, can run compatible Pyodide sessions, and parses exposure outputs.", "Assignment metrics plus mSigSDK ambiguity, low-burden, and report fields."],
      ["MuSiCal", "Sparse likelihood-based mutational-signature refitting and discovery.", "Package execution depends on Pyodide-compatible wheels; mSigSDK includes a browser-native MuSiCal-compatible sparse NNLS comparator.", "mSigSDK exports/imports MuSiCal-style matrices and compares sparse refits on the same spectra/catalog.", "MuSiCal metrics from the external tool or comparator plus mSigSDK ambiguity and reporting fields."],
    ],
    note:
      "The comparison defines intended workflow boundaries. Browser execution for Python and R ecosystem tools depends on package compatibility, wheels, and browser runtime limits.",
  });

  return [
    ["table1-researcher-journey-capabilities.html", table1],
    ["table2-computation-privacy-boundary.html", table2],
    ["table3-methods-defaults.html", table3],
    ["table4-synthetic-validation.html", tableSynthetic],
    ["table5-deconstructsigs-concordance.html", tableConcordance],
    ["table6-compute-benchmarks.html", tableBenchmark],
    ["table7-related-tools.html", tableRelated],
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
function choosePanelContexts(contexts, spectra, size = 24) {
  const totals = Object.fromEntries(contexts.map((context) => [context, 0]));
  Object.values(spectra || {}).forEach((spectrum) => {
    contexts.forEach((context) => {
      totals[context] += Number(spectrum?.[context]) || 0;
    });
  });
  return [...contexts]
    .sort((a, b) => totals[b] - totals[a])
    .slice(0, size);
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
      "mSigSDK visualizations for PCAWG Lung-AdenoCA SBS96 spectra: mutation burden, profile comparison, clustered cosine similarity, SDK-computed similarity tree, and UMAP projection.",
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
      "Browser-local NNLS fitting of PCAWG Lung-AdenoCA spectra against selected COSMIC SBS96 signatures, with exposure, reconstruction, and residual panels.",
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
    title: "Figure 3. Burden-aware fit-quality evidence, uncertainty, and threshold sensitivity",
    subtitle:
      "mSigSDK v0.3 outputs for fit-quality evidence, bootstrap exposure intervals, threshold sensitivity, and controlled low-burden stress testing.",
    panels: `
    <section class="panel wide"><p class="panel-title">A. Fit-quality evidence summary</p><div id="fig3FitQuality"></div></section>
    <section class="panel wide"><p class="panel-title">B. Bootstrap exposure confidence intervals</p><div id="fig3Bootstrap"></div></section>
    <section class="panel wide"><p class="panel-title">C. Threshold sensitivity summary</p><div id="fig3Threshold"></div></section>
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
  await mSigSDK.qcPlots.plotFitQualityEvidenceDashboard(document.getElementById("fig3FitQuality"), cohort.fitQualityEvidence);
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
  setStatus("Rendered Figure 3 evidence and uncertainty panels for " + selected.length + " samples; bootstrap sample: " + bootstrapSample + ".");
} catch (error) {
  console.error(error);
  setStatus("Figure rendering failed: " + error.message);
}`,
  });

  const figure4 = figureShell({
    title: "Figure 4. Cohort and panel workflows",
    subtitle:
      "mSigSDK v0.3 outputs from PCAWG Lung-AdenoCA spectra: group exposure comparison, subgroup extraction/refit summary, PCAWG-derived panel downsampling evidence matrix, and cohort fit-quality summary.",
    panels: `
    <section class="panel wide"><p class="panel-title">A. Metadata-stratified exposure comparison</p><div id="fig4Group"></div></section>
    <section class="panel wide"><p class="panel-title">B. Panel/WES evidence matrix</p><div id="fig4Panel"></div></section>
    <section class="panel"><p class="panel-title">C. Cohort fit-quality summary</p><div id="fig4FitQuality"></div></section>
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
  await mSigSDK.qcPlots.plotFitQualityEvidenceDashboard(document.getElementById("fig4FitQuality"), cohort.fitQualityEvidence);
  const panelContexts = choosePanelContexts(data.contexts, spectra, 24);
  const callableOpportunities = Object.fromEntries(data.contexts.map((context) => [context, panelContexts.includes(context) ? 1 : 0]));
  const referenceOpportunities = Object.fromEntries(data.contexts.map((context) => [context, 1]));
  const panelPairs = mSigSDK.userData.createWGStoPanelValidationPairs(spectra, callableOpportunities, {
    contexts: data.contexts,
    referenceOpportunities,
    binaryMask: true,
    roundCounts: true,
  });
  const panel = await mSigSDK.pipelines.runPanelWorkflow({ spectra: panelPairs.panelSpectra, signatures, callableOpportunities, referenceOpportunities }, {
    contexts: data.contexts,
    minAssessableMutations: 30,
    runBootstrap: false,
    runThresholdSensitivity: false,
    runSubgroupDiscovery: false,
  });
  await mSigSDK.qcPlots.plotPanelEvidenceMatrix(document.getElementById("fig4Panel"), panel);
  const subgroupSamples = selected.slice(0, 8);
  const subgroup = await mSigSDK.experimental.runSubgroupDiscoveryWorkflow({
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
      "mSigSDK NMF workflow: extracted SBS96 profile plots, sample exposure heatmap, rank diagnostics, and reference-signature matching.",
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
    ["figure3-qc-evidence-uncertainty.html", figure3],
    ["figure4-cohort-panel-workflows.html", figure4],
    ["figure5-nmf-extraction.html", figure5],
  ];
}

function figuresAndTablesPlan() {
  return `# Numbered Manuscript Figures And Tables

## Central Framing

mSigSDK v0.3 is presented as a client-side JavaScript extension of mSigPortal that makes selected resources, API calls, and plotting conventions portable. Local review modules for imported spectra add matrix validation, refitting, QC, uncertainty review, panel/WES evidence, exploratory NMF, and reporting around that portal-SDK layer. TCGA/GDC helper access is included as an additional public-resource access module.

## Main Figures

1. **Figure 1. Browser-native cohort exploration and similarity structure**
   Source HTML: docs/manuscript/actual-figure-pages/figure1-cohort-exploration.html
   Screenshot: docs/manuscript/actual-figure-pages/screenshots/figure1-cohort-exploration.png

2. **Figure 2. Local known-signature fitting and exposure interpretation**
   Source HTML: docs/manuscript/actual-figure-pages/figure2-known-signature-fitting.html
   Screenshot: docs/manuscript/actual-figure-pages/screenshots/figure2-known-signature-fitting.png

3. **Figure 3. Burden-aware fit-quality evidence, uncertainty, and threshold sensitivity**
   Source HTML: docs/manuscript/actual-figure-pages/figure3-qc-evidence-uncertainty.html
   Screenshot: docs/manuscript/actual-figure-pages/screenshots/figure3-qc-evidence-uncertainty.png

4. **Figure 4. Cohort and panel workflows**
   Source HTML: docs/manuscript/actual-figure-pages/figure4-cohort-panel-workflows.html
   Screenshot: docs/manuscript/actual-figure-pages/screenshots/figure4-cohort-panel-workflows.png

5. **Figure 5. Exploratory browser-side NMF extraction**
   Source HTML: docs/manuscript/actual-figure-pages/figure5-nmf-extraction.html
   Screenshot: docs/manuscript/actual-figure-pages/screenshots/figure5-nmf-extraction.png

## Main Tables

1. **Table 1. mSigSDK workflows, inputs, and outputs**
   HTML: docs/manuscript/google-doc-tables/table1-researcher-journey-capabilities.html

2. **Table 2. Computation locus, external dependencies, and privacy boundary**
   HTML: docs/manuscript/google-doc-tables/table2-computation-privacy-boundary.html

3. **Table 3. Algorithmic defaults used in manuscript workflows**
   HTML: docs/manuscript/google-doc-tables/table3-methods-defaults.html

4. **Table 4. Controlled synthetic exposure-recovery validation**
   HTML: docs/manuscript/google-doc-tables/table4-synthetic-validation.html

5. **Table 5. Direct concordance with deconstructSigs on shared PCAWG Lung-AdenoCA spectra**
   HTML: docs/manuscript/google-doc-tables/table5-deconstructsigs-concordance.html

6. **Table 6. Scenario-calibrated local compute measurements for realistic mSigSDK use cases**
   HTML: docs/manuscript/google-doc-tables/table6-compute-benchmarks.html

7. **Table 7. Functional positioning relative to related mutational-signature software**
   HTML: docs/manuscript/google-doc-tables/table7-related-tools.html

## Remaining Optional Strengtheners

1. Add browser rendering benchmark repeats for the final HTML figure pages.
2. Tag an archived release or DOI after final asset generation.
`;
}

function completionPlan() {
  return `# Manuscript Completion Plan

## Package Contents

1. Manuscript framing centered on mSigSDK v0.3 as a client-side JavaScript extension of mSigPortal, with local review workflows as added capabilities.
2. v0.3 SDK features: burden-aware review, fit-quality evidence, catalog-sufficiency checks, cohort comparison, subgroup discovery/refitting, panel/WES restricted-assay evidence, evidence labels, localized mutagenesis workflow, and publication-oriented figures.
3. Seven Google Docs-ready HTML tables.
4. Generated five reproducible HTML figure pages that call mSigSDK functions and use PCAWG Lung-AdenoCA spectra plus COSMIC SBS96 references where applicable.
5. Scenario-calibrated runtime outputs for single-sample, panel/WES, rare-cancer, medium-cohort, portal-scale, and discovery-cohort use cases.
6. Controlled synthetic exposure-recovery validation with known COSMIC SBS96 mixtures.
7. Cross-tool concordance experiments on shared PCAWG Lung-AdenoCA spectra and a matched selected COSMIC catalog, including deconstructSigs, SigProfilerAssignment, and MuSiCal-compatible refit review.
8. Full manuscript draft in \`docs/manuscript/manuscript/MSIGSDK_REVISED_MANUSCRIPT_DRAFT.md\`.

## Highest-Value Additions Before Submission

1. **Browser rendering benchmark.** Add five-repeat render-time and browser heap measurements for Figures 1-5 in a named browser/version.
2. **Release checkpoint.** Create a version tag or archived DOI for the exact manuscript asset snapshot.
3. **Reference polish.** Run final journal-format reference cleanup before submission.
`;
}

function centralFraming() {
  return `# Central Manuscript Framing

## One-Sentence Claim

mSigSDK is a reusable JavaScript SDK for interactive review, visualization, and lightweight local analysis of precomputed mutational spectra.

## Positioning

mSigSDK v0.3 is presented as a client-side extension of mSigPortal with local review workflows for imported spectra:

- mSigSDK is primarily an extension of mSigPortal.
- mSigPortal API calls provide public reference and cohort data.
- User-supplied spectra can be validated, fitted, stress-tested, and visualized locally in the browser.
- TCGA/GDC helpers are additional public-resource access modules.
- v0.3 adds local review layers on top of the portal-SDK layer: burden-aware recommendations, fit-quality evidence, catalog-sufficiency checks, subgroup workflows, metadata comparisons, and panel/WES evidence labels.
- Browser-side NMF supports browser-sized profile inspection and handoff to production extraction tools such as SigProfilerExtractor.

## Title Direction

Recommended title:

**mSigSDK: a browser-native JavaScript SDK for mutational-signature review**

## Main Narrative Arc

1. Mutational-signature researchers need reusable plots, workflow defaults, uncertainty summaries, and reproducible outputs.
2. Existing extraction and assignment engines remain essential package- or server-centered tools.
3. mSigSDK v0.3 makes selected mSigPortal resources and plots reusable outside the portal.
4. The SDK adds local JavaScript review modules and makes the computation/privacy boundary explicit.
5. Results demonstrate cohort exploration, local refitting, synthetic exposure recovery, deconstructSigs concordance, uncertainty/QC review evidence, cohort and panel workflows, exploratory NMF, and scenario-calibrated runtime measurements.
6. The discussion covers production extraction handoff, configurable burden thresholds, browser memory/rendering constraints, and broader concordance and disease-specific validation.
`;
}

function manuscriptDraft() {
  return `# mSigSDK: a browser-native JavaScript SDK for mutational-signature review

Aaron Ge1,2*, Tongwu Zhang1, Yasmmin Cortes Martins3, Maria Teresa Landi1, Brian Park1, Kailing Chen1, Jeya Balasubramanian1, Jonas S Almeida1

*Correspondence: age1@som.umaryland.edu

1 Division of Cancer Epidemiology and Genetics, National Cancer Institute, National Institutes of Health, Maryland, USA
2 University of Maryland School of Medicine, Maryland, USA
3 National Laboratory of Scientific Computing, Petropolis, Brazil

## Abstract

### Motivation

Mutational-signature research increasingly depends on web portals, public APIs, and reusable analysis views. Many practical review tasks occur outside a single portal session. Investigators may need to inspect one precomputed tumor spectrum, share a static collaborator page, teach a low-burden example, or add signature review to another cancer genomics interface. These tasks need a portable no-install layer for visualization, lightweight refitting, uncertainty review, and reporting. mSigSDK is a reusable JavaScript SDK for interactive review, visualization, and lightweight local analysis of precomputed mutational spectra.

### Results

mSigSDK v0.3 extends selected mSigPortal resources and plotting conventions into browser applications, web notebooks, static review pages, and local JavaScript scripts. It also reviews imported spectra in the client runtime. The SDK supports matrix validation, mutation-burden checks, known-signature refitting, reconstruction and residual review, bootstrap uncertainty, threshold sensitivity, signature ambiguity checks, catalog-sufficiency checks, cohort comparison, panel/WES review evidence tiers, exploratory NMF, TCGA/GDC helper access, and structured reports. Demonstrations using PCAWG Lung-AdenoCA SBS96 spectra and COSMIC SBS96 signatures generated cohort views, exposure plots, fit diagnostics, panel/WES summaries, and exploratory NMF outputs. In a 384-spectrum synthetic ground-truth experiment, mean cosine between true and estimated exposures was 0.912 at 50 mutations per sample and 0.996 at 1000 mutations per sample, while mean reconstruction cosine rose from 0.884 to 0.991. In numerical validation, mSigSDK matched an independent nonnegative least-squares solver to numerical precision; in direct concordance testing against deconstructSigs on shared PCAWG spectra, mean exposure-vector cosine was 0.998 and mean reconstruction cosine was 0.993 in both tools. In computation benchmarks, a 300-sample, 40-signature refitting task took 396.3 ms, a 24-sample panel/WES workflow took 32.8 ms, a 120-sample cohort workflow took 232.0 ms, and 80-sample NMF rank selection took 2.64 seconds.

### Conclusions

mSigSDK is designed for interactive review and sharing of precomputed spectra in browser-based workflows. It complements, rather than replaces, production-scale extraction, comprehensive assignment, local R/Python analysis, and clinical interpretation.

**Keywords:** mutational signatures; JavaScript; browser computation; client-side analysis; mutation burden; signature refitting; cohort analysis; panel sequencing; software development kit; cancer genomics portal; mSigPortal

## Introduction

mSigPortal provides curated mutational-signature resources through a public web portal and application programming interfaces (APIs) [1]. This design fits modern FAIR data principles, which aim to make scientific data findable, accessible, interoperable, and reusable [2]. Data commons extend this idea by keeping data sources on the web while exposing stable exchange methods [3]. PLCOjs and related work by Almeida and colleagues showed how JavaScript SDKs can turn portal APIs into reusable web modules, reduce backend demands, and support no-install analysis views [4-6]. Similar API-based models support major cancer genomics resources such as the Genomic Data Commons, TCGA-based portals, and cBioPortal [7-9].

FAIR principles also apply to the workflow layer. Findability requires stable web entry points and versioned resources; accessibility requires that users can reach tools and outputs without specialized local infrastructure; interoperability requires shared matrix formats, context ordering, and machine-readable reports; and reusability requires provenance, documented parameters, and reproducible examples [2]. mSigSDK implements these principles by distributing the native JavaScript SDK through a public URL, running core review workflows in a modern browser without a package manager or desktop installation, exchanging spectra and signatures through standard tabular formats, validating report objects against a JSON Schema, and preserving parameters, warnings, recommended actions, and provenance in high-level outputs. External-tool adapters keep SigProfiler-style, COSMIC-style, MuSiCal-compatible, and R/Python handoff paths aligned without implying that every external package is natively ported to the browser.

Mutational signatures summarize patterns of somatic mutation produced by DNA damage, DNA repair defects, endogenous processes, environmental exposures, and therapy-related mutagenesis [10-13]. They are used to study cancer etiology, prevention, treatment effects, and selected biomarkers [10-14]. mSigPortal is an important resource for these studies because it organizes reference signatures, cohort spectra, and portal-based visualizations [1]. Yet many review tasks happen after spectra already exist and outside the original portal session.

mSigSDK addresses this practical gap. A portable workflow, in this manuscript, means code that can run in a browser page, web notebook, static review page, or local JavaScript runtime without asking each user to install a full desktop analysis stack. Review means inspecting spectra, plots, fit quality, uncertainty, and reportable evidence fields before making biological claims. Refitting means estimating exposure to a supplied reference catalog. It is distinct from de novo extraction, which discovers signatures from a cohort.

The core contribution is a reusable JavaScript SDK for interactive review, visualization, and lightweight local analysis of precomputed mutational spectra. The SDK extends selected mSigPortal resources and plotting conventions, then adds local review workflows for imported spectra. Its novelty is architectural and practical: it packages portal resource access, standard visualizations, and QC workflows so they can be reused in other web contexts.

This scope matters because mutational-signature interpretation is sensitive to data context. Whole-genome spectra with thousands of mutations carry more information than panel or exome spectra with far fewer variants. Sparse SBS96 profiles are affected by sampling noise [13-16]. Mixed cohorts, localized mutagenesis, similar reference signatures, and incomplete catalogs can make fitted exposures unstable or ambiguous [13,15,17-19]. Published guidance and benchmarks support reporting mutation burden, reconstruction quality, residual structure, signature similarity, catalog limits, threshold sensitivity, and uncertainty [13-19]. Panel and whole-exome sequencing (WES) require additional caution because assay footprint and callable territory affect whether weak or absent fitted signatures can be interpreted [16].

Here we present mSigSDK v0.3 as a browser-native SDK for mutational-signature review. We describe the data boundary, method defaults, outputs, synthetic validation, demonstration workflows, performance, and limits.

## Implementation

### SDK architecture and data boundary

mSigSDK is implemented as a modular ECMAScript JavaScript SDK centered on mSigPortal (Figure 1). mSigPortal remains the source of record for curated public mutational-signature resources. The SDK makes selected resources, API access patterns, and plotting conventions reusable in other browser-based settings.

The architecture separates public data retrieval from local review. Public reference and cohort resources are retrieved from mSigPortal APIs. TCGA/GDC helper access retrieves compatible public resources from GDC endpoints. Once spectra are imported into the client runtime, matrix checks, refitting, resampling, residual review, cohort comparison, panel/WES review, plotting, and report generation can run locally. User-supplied spectra therefore do not need to be sent to a new analysis service after import, although the web page, public reference data, and other remote assets still need to be loaded when used.

![Figure 1. mSigSDK client-side mutational signature review architecture](../figures/figure1-graphical-abstract.svg)

**Figure 1. mSigSDK client-side mutational signature review architecture.** mSigSDK uses selected mSigPortal public resources and plotting conventions through reusable JavaScript modules. User-supplied spectra, such as an SBS96 matrix, can be imported into the client runtime for validation, known-signature refitting, QC review evidence, panel/WES review, plotting, and report generation. TCGA/GDC helper access follows the same boundary. mSigSDK complements production extraction and assignment tools.

Table 1 maps the main workflows to intended use, inputs, and primary outputs. Table 2 states the computation and privacy boundary for API access, imported spectra, local review, plotting, and reports.

Table 1. mSigSDK workflows, inputs, and outputs.

| Workflow | Intended use | Input requirements | Primary outputs |
| --- | --- | --- | --- |
| mSigPortal extension | Reuse selected mSigPortal reference and cohort resources outside a single portal session. | Internet access and supported public mSigPortal resources. | Portal-consistent resource access, spectra, signatures, and plots. |
| Single-sample review | Inspect a precomputed tumor spectrum before biological interpretation or sharing. | One SBS96 spectrum and a compatible reference catalog. | Burden, context coverage, fitted exposures, reconstruction, residuals, uncertainty, and report-ready summaries. |
| Small-cohort review | Compare spectra and fitted exposures across a cohort or metadata-defined groups. | Sample-by-context spectra and optional sample metadata. | Similarity structure, group summaries, exposure comparisons, and cohort-level QC review evidence. |
| Panel/WES review | Summarize fitted-signature evidence in restricted genomic territory. | Panel or exome spectra, reference signatures, and optional callable opportunities. | Opportunity-normalized fits, callable-territory evidence, expected fitted signature mutation counts, and review evidence tiers. |
| Teaching and static review pages | Share reproducible examples without requiring each reader to install R or Python packages. | Archived spectra, fixed parameters, and a browser or web notebook. | Interactive plots, structured reports, and copy/paste tables. |
| Exploratory discovery | Screen browser-sized cohorts for possible signatures before handoff to production extraction tools. | Moderate sample-by-context spectra with adequate burden and a prespecified rank range. | NMF profiles, exposure heatmaps, rank diagnostics, and reference matches. |

*Note.* The SDK is designed for interactive review, visualization, and lightweight local analysis of precomputed mutational spectra.

Table 2. Computation locus, external dependencies, and privacy boundary.

| Workflow | Computed in browser/client runtime | External dependency | Privacy interpretation |
| --- | --- | --- | --- |
| mSigPortal public reference and cohort queries | No, data are retrieved remotely | mSigPortal API | Public or portal-hosted data; no claim of local computation for API retrieval |
| TCGA/GDC helper queries | No, data are retrieved remotely before conversion | GDC/TCGA APIs | Public or access-governed data follow upstream GDC rules; no claim of local computation for API retrieval |
| User spectra or MAF-derived matrix validation | Yes | None after import | User mutation data can remain local |
| Known-signature NNLS fitting and reconstruction QC | Yes | Optional reference catalog fetch | User spectra can remain local; reference data may be public API-derived |
| Bootstrap, threshold sensitivity, fit-quality evidence, and residual checks | Yes | None | Local; runtime scales with iterations, thresholds, and catalog size |
| Cohort grouping and metadata-stratified exposure comparison | Yes | None | Local if metadata and spectra are user supplied |
| Panel/WES opportunity normalization and review evidence tiers | Yes | None | Local; outputs include callable-territory evidence and evidence tiers |
| Exploratory NMF extraction | Yes for browser-sized cohorts | None | Local for moderate matrices |
| Plot rendering, HTML tables, reports, and provenance | Yes | Browser plotting libraries | Local unless the user exports or shares outputs |

*Note.* mSigSDK performs selected review analyses locally after import and also interoperates with public APIs for public resources.

### Data model and method defaults

The main input is a sample-by-context mutation spectrum. For SBS96 analysis, rows represent samples and columns represent the 96 trinucleotide contexts. A reference catalog is a signature-by-context matrix with the same context definitions. Outputs are structured objects that include validation results, parameters, fitted exposures, reconstruction metrics, residuals, uncertainty summaries, and plot-ready data.

The SDK reports separate QC signals for burden, context coverage, reconstruction, residual structure, bootstrap stability, threshold sensitivity, signature ambiguity, catalog sufficiency, panel/WES restricted-assay evidence, and subgroup support. Table 3 gives the operational defaults used in the manuscript examples, including the NNLS solver behavior, normalization, bootstrap procedure, confidence intervals, threshold grid, residual metrics, ambiguity cutoffs, catalog-sufficiency triggers, panel/WES review evidence tiers, and NMF settings. These defaults are configurable.

Table 3. Algorithmic defaults used in manuscript workflows.

| Component | Operational setting | Output used in review | Scope note |
| --- | --- | --- | --- |
| Input spectra | SBS96 sample-by-context matrices with finite numeric values; missing and extra contexts are reported against the expected context list. | Mutation burden, context completeness, empty-spectrum flags, and low-burden flags. | Applies after spectra have been generated or imported. |
| Known-signature refitting | Coordinate-descent nonnegative least squares with relative exposures below 0.01 removed in manuscript workflows and remaining exposures renormalized. | Fitted exposures for a supplied reference catalog. | Catalog refit to the supplied signatures. |
| Reconstruction and residuals | Observed and reconstructed spectra are compared in relative scale by default using cosine similarity, cosine distance, RMSE, mean absolute error, L1/L2 error, and maximum residual. | Fit-quality metrics and residual spectra. | Reviewed with burden, uncertainty, and ambiguity fields. |
| Bootstrap uncertainty | Multinomial resampling of the observed spectrum with 95% intervals in manuscript examples. | Exposure means, medians, confidence intervals, and selection frequencies. | Intervals condition on the observed spectrum, supplied catalog, and fitting settings. |
| Threshold sensitivity | Relative exposure thresholds of 0, 0.01, 0.03, 0.05, and 0.10 in manuscript examples. | Changes in active signatures, reconstruction cosine, and RMSE across thresholds. | Sensitivity analysis across stated cutoffs. |
| Signature ambiguity | Pairwise signature cosine values at or above 0.90 are reported; high ambiguity is assigned at nearest-neighbor cosine at least 0.95 or entropy at least 0.92. | Flags for exchangeable or broad reference signatures. | Highlights closely similar reference signatures. |
| Catalog sufficiency | Possible out-of-catalog signal is flagged using relative unexplained fraction at least 0.07, suspected signal at least 0.12, reconstruction cosine below 0.90, or structured positive residual cosine at least 0.85. | Residual patterns and recommended catalog review actions. | Supports catalog and disease-context review. |
| Fit-quality review labels | Low burden is below 100 mutations and moderate burden is below 1000 by default. Labels summarize burden, reconstruction, residual, bootstrap, threshold, ambiguity, and catalog flags. | Reporting modes and underlying evidence fields. | Aggregates evidence while preserving component metrics. |
| Panel/WES review evidence tiers | Minimum assessable burden is 30 mutations; limited-support exposure threshold is 0.05; higher-support exposure threshold is 0.20. Callable-opportunity maps are user supplied from the assay territory and genome build. | Higher review support, limited review support, not detected within review settings, or not assessable for each fitted signature. | Not assessable indicates insufficient burden or callable territory for a tier call. |
| Exploratory NMF | Multiplicative-update NMF minimizes Frobenius reconstruction error with fixed ranks or rank sweeps over browser-sized cohorts in manuscript examples. | Extracted profiles, exposures, reconstruction metrics, run diagnostics, and reference matches. | Browser-sized profile inspection and handoff support. |

*Note.* Thresholds are configurable; the table lists settings used in the manuscript examples.

### Workflows and outputs

Single-sample review validates one spectrum, refits known signatures, estimates uncertainty, inspects residuals, and returns a report-ready summary. Cohort review validates and refits multiple spectra, summarizes fit-quality evidence, examines subgroup structure, and compares exposures across metadata groups. Panel/WES review applies callable-opportunity normalization and reports restricted-assay evidence tiers with the values that produced them. Exploratory NMF supports teaching, rapid inspection, and small-cohort handoff to production tools.

mSigSDK generates mutation burden summaries, SBS96 profile comparisons, cosine similarity heatmaps, similarity trees, UMAP views, exposure heatmaps, exposure pie charts, reconstruction plots, residual profiles, bootstrap intervals, threshold-sensitivity plots, fit-quality evidence summaries, cohort group comparisons, panel evidence matrices, NMF profile plots, NMF exposure heatmaps, rank diagnostics, and reference-match summaries. It can also return structured JSON or HTML reports with parameters, validation results, QC review evidence, fitted exposures, and provenance. The figures in this manuscript were generated from reproducible HTML pages that use public PCAWG Lung-AdenoCA spectra and COSMIC SBS96 reference signatures where applicable.

## Results

### Cohort exploration before refitting

We first used PCAWG Lung-AdenoCA SBS96 spectra from mSigPortal to ask whether a reviewer could inspect cohort structure before refitting (Figure 2). The SDK summarized mutation burden, compared two SBS96 profiles, computed a clustered cosine similarity heatmap, generated a similarity tree, and displayed a UMAP projection.

These views are useful before refitting or extraction. Burden, spectrum shape, and sample similarity help determine whether a cohort is suitable for downstream signature analysis [10,13,20-21]. The SBS96 plot follows the standard display of 96 trinucleotide contexts grouped by six substitution classes [10,21]. The heatmap, tree, and UMAP show structure that may affect interpretation [13-14,19].

![Figure 2. Browser-based cohort exploration and similarity structure](../actual-figure-pages/screenshots/figure1-cohort-exploration.png)

**Figure 2. Browser-based cohort exploration and similarity structure.** mSigSDK visualizations for PCAWG Lung-AdenoCA SBS96 spectra. (A) Mutation burden summary. (B) SBS96 profile comparison for two samples, with a difference panel. (C) Clustered cosine similarity heatmap. (D) Similarity tree. (E) UMAP projection.

### Local known-signature refitting

We next asked whether a browser workflow could review fitted exposure to a supplied reference catalog. Selected PCAWG Lung-AdenoCA spectra were refitted to COSMIC SBS96 reference signatures using local nonnegative least squares (Figure 3). The SDK generated an exposure heatmap, a single-sample exposure pie chart, reconstruction metrics, and observed-versus-reconstructed residual plots.

Known-signature refitting is a common task in mutational-signature analysis and is supported by established tools such as SigProfilerAssignment, MutationalPatterns, and deconstructSigs [20-22]. In mSigSDK, exposure plots show the fitted mixture, while reconstruction and residual plots show whether the mixture explains the observed spectrum. These outputs support review of fitted exposures, but they do not establish a biological interpretation by themselves.

![Figure 3. Local known-signature fitting and exposure review](../actual-figure-pages/screenshots/figure2-known-signature-fitting.png)

**Figure 3. Local known-signature refitting and exposure review.** Browser-local nonnegative least-squares refitting against selected COSMIC SBS96 reference signatures. (A) Exposure heatmap. (B) Single-sample exposure pie chart. (C) Reconstruction quality summary. (D) Observed, reconstructed, and residual spectrum view.

### Synthetic recovery and uncertainty

We added a controlled ground-truth experiment to test whether the local refitting workflow recovered known mixtures. Synthetic SBS96 spectra were generated from six COSMIC reference signatures with two or three active signatures per sample. We generated 64 spectra at each mutation burden from 50 to 2500 mutations per sample, for 384 spectra total. The same SDK refitting workflow was then applied with fixed parameters.

Mean cosine between true and estimated exposures was 0.912 (95% CI, 0.891-0.932) at 50 mutations and 0.996 (95% CI, 0.994-0.997) at 1000 mutations. Mean reconstruction cosine increased from 0.884 (95% CI, 0.859-0.908) to 0.991 (95% CI, 0.989-0.993). Active-signature recall was high across burdens, while inactive signatures above 5% exposure decreased from 0.165 at 50 mutations to 0.027 at 1000 mutations. Table 4 summarizes the validation results.

Table 4. Controlled synthetic exposure-recovery validation.

| Mutations per sample | Samples (n) | Exposure cosine, mean (95% CI) | Exposure MAE, mean (95% CI) | Active-signature recall, mean (95% CI) | Inactive-signature calls, mean (95% CI) | Reconstruction cosine, mean (95% CI) |
| --- | --- | --- | --- | --- | --- | --- |
| 50 | 64 | 0.912 (0.882-0.941) | 0.065 (0.054-0.075) | 0.938 (0.903-0.972) | 0.165 (0.120-0.211) | 0.884 (0.862-0.906) |
| 100 | 64 | 0.952 (0.932-0.973) | 0.043 (0.034-0.051) | 0.979 (0.959-0.999) | 0.129 (0.085-0.173) | 0.930 (0.915-0.944) |
| 250 | 64 | 0.982 (0.973-0.990) | 0.027 (0.021-0.032) | 0.995 (0.985-1.000) | 0.082 (0.045-0.119) | 0.966 (0.959-0.973) |
| 500 | 64 | 0.993 (0.990-0.996) | 0.016 (0.013-0.020) | 1.000 (1.000-1.000) | 0.026 (0.006-0.046) | 0.982 (0.978-0.986) |
| 1000 | 64 | 0.996 (0.994-0.997) | 0.013 (0.011-0.016) | 1.000 (1.000-1.000) | 0.027 (0.006-0.049) | 0.991 (0.988-0.993) |
| 2500 | 64 | 0.998 (0.998-0.999) | 0.008 (0.006-0.010) | 1.000 (1.000-1.000) | 0.017 (0.001-0.033) | 0.996 (0.995-0.997) |

*Note.* Known COSMIC SBS96 mixtures were generated from six reference signatures and refitted with the SDK workflow. MAE, mean absolute exposure error. Active-signature recall and inactive-signature calls used a 5% exposure threshold. Confidence intervals are normal-approximation intervals across synthetic samples within each burden.

### Concordance with deconstructSigs

We next asked whether the mSigSDK refitting result was numerically consistent with an independent implementation of the same nonnegative least-squares problem, and whether it agreed with an established decomposition tool under matched inputs. Against an independent R nonnegative least-squares solver, mean exposure-vector cosine was 1.000 and the maximum absolute exposure difference was 4.64e-10. This confirmed that the SDK solver produced the expected nonnegative least-squares solution to numerical precision.

We then compared mSigSDK with deconstructSigs version 1.8.0 [22] on the 18 PCAWG Lung-AdenoCA spectra used in the refitting example and the same nine selected COSMIC SBS96 reference signatures. Both tools used a 1% exposure cutoff followed by exposure renormalization. Mean exposure-vector cosine between the two tools was 0.998, the median was 0.999, and the minimum was 0.994. Mean reconstruction cosine was 0.993 for mSigSDK and 0.993 for deconstructSigs, with a mean absolute reconstruction-cosine difference of 0.0004. No samples had exposure cosine below 0.90, and all samples had the same top fitted signature. Table 5 summarizes the numerical solver check and deconstructSigs concordance results.

Table 5. Independent NNLS check and deconstructSigs concordance on shared PCAWG Lung-AdenoCA spectra.

| Comparison element | Result | Interpretation |
| --- | --- | --- |
| Input spectra and catalog | 18 PCAWG Lung-AdenoCA WGS SBS96 spectra; 9 selected COSMIC SBS96 signatures. | The comparison used the same spectra and reference catalog as the manuscript refitting example. |
| Exposure agreement | Mean cosine 0.998; median 0.999; minimum 0.994. | The two tools produced similar exposure vectors for most samples under matched inputs and cutoffs. |
| Independent NNLS solver check | Mean cosine 1.000; minimum 1.000; maximum absolute exposure difference 4.64e-10. | mSigSDK matched an independent nonnegative least-squares implementation to numerical precision. |
| Mean absolute exposure difference | Mean 0.007; median 0.006. | The remaining deconstructSigs differences reflect its normalized-weight iterative fitting and signature-screening procedure, especially among exchangeable signatures. |
| Reconstruction agreement | Mean reconstruction cosine 0.993 for mSigSDK and 0.993 for deconstructSigs; mean absolute delta 0.000. | Both tools reconstructed the observed spectra to similar cosine similarity with the selected catalog. |
| Disagreement cases | 0 of 18 samples had exposure cosine below 0.90; 0 had different top fitted signatures. | Disagreements are retained as review signals rather than suppressed; they motivate threshold and ambiguity checks. |

*Note.* deconstructSigs and mSigSDK used the same sample-by-context matrix, the same nine-signature COSMIC SBS96 catalog used in the manuscript refitting example, and a 1% exposure cutoff followed by exposure renormalization. An independent R nonnegative least-squares implementation was also run as a numerical solver check. deconstructSigs version 1.8.0 was run in R 4.1.1.

The exact nonnegative least-squares check supports the numerical implementation. The deconstructSigs comparison is a cross-tool concordance test rather than an identity test because deconstructSigs uses a related but distinct normalized-weight fitting and signature-screening procedure. The results support browser-side review of known-signature refitting under matched inputs.

### Uncertainty and threshold sensitivity

We then asked whether the review workflow could expose cases where a fitted exposure should be treated cautiously. mSigSDK reported fit-quality evidence across mutation burden, reconstruction, residual signal, bootstrap stability, threshold sensitivity, signature ambiguity, and catalog sufficiency (Figure 4). Bootstrap intervals and threshold plots showed whether fitted exposures were stable under resampling and different exposure cutoffs. A separate controlled low-burden stress test showed increasing reconstruction cosine and narrowing bootstrap intervals as mutation burden rose. These results are consistent with the expected relationship between mutation count and fitting uncertainty [15-16].

![Figure 4. Burden-aware fit-quality evidence, uncertainty, and threshold sensitivity](../actual-figure-pages/screenshots/figure3-qc-evidence-uncertainty.png)

**Figure 4. Burden-aware fit-quality evidence, uncertainty, and threshold sensitivity.** mSigSDK outputs for fit-quality evidence, bootstrap uncertainty, threshold sensitivity, and low-burden stress testing.

### Cohort and panel/WES workflows

We then tested workflows that answer common review questions for groups and restricted assays (Figure 5). For cohort review, PCAWG Lung-AdenoCA samples were grouped by mutation burden to demonstrate metadata-stratified exposure comparison and subgroup-aware extraction/refitting. For panel/WES review, restricted callable opportunities were used to normalize context counts and return review evidence tiers.

The panel/WES tiers are higher review support, limited review support, not detected within review settings, or not assessable. They are based on fitted exposure, mutation burden, callable-territory evidence, and fit-quality checks. A not-assessable label indicates insufficient burden or callable territory for a tier call [16].

![Figure 5. Cohort and panel workflows](../actual-figure-pages/screenshots/figure4-cohort-panel-workflows.png)

**Figure 5. Cohort and panel workflows.** Metadata-stratified exposure comparison, panel evidence matrix, fit-quality evidence summary, and subgroup extraction/refit summary generated by mSigSDK.

### Exploratory browser-side NMF

We next asked whether browser-side exploratory extraction could provide a quick screen before handoff to production tools (Figure 6). The demonstration generated extracted SBS96 profiles, an exposure heatmap, rank diagnostics, and reference-signature matches.

De novo NMF extraction is central to signature discovery. Production tools such as SigProfilerExtractor are designed for large-scale extraction and stability analysis [10,23]. The mSigSDK NMF module supports teaching, rapid review, small-cohort inspection, and handoff to production tools.

![Figure 6. Exploratory browser-side NMF extraction](../actual-figure-pages/screenshots/figure5-nmf-extraction.png)

**Figure 6. Exploratory browser-side NMF extraction.** mSigSDK NMF extraction, rank diagnostics, and reference matching for a browser-sized PCAWG Lung-AdenoCA subset.

### Runtime of interactive review tasks

Finally, we asked whether the reviewed workflows were fast enough for interactive use. We measured single-run computation runtime and process-level memory with deterministic synthetic SBS96 matrices. The scenarios represented common review tasks: one WGS sample, a small panel/WES batch, a rare-cancer cohort, a medium research cohort, a 300-sample portal review, and exploratory discovery cohorts of 30 and 80 samples. Inputs were synthetic timing matrices, not patient data. Timings measured computation only and did not include plot rendering. The Node.js benchmarks did not use Web Workers.

Local refitting took 13.5 ms for one WGS sample, 10.2 ms for a 24-sample panel/WES batch, 6.0 ms for a 40-sample rare-cancer cohort, 41.5 ms for a 120-sample medium cohort, and 396.3 ms for a 300-sample, 40-signature cohort. The panel/WES review workflow took 32.8 ms. The 120-sample cohort workflow took 232.0 ms. NMF rank selection took 704.9 ms for 30 samples and 2.64 seconds for 80 samples. These timings support interactive use for validation, refitting, panel/WES review, and moderate cohort review. NMF and repeated uncertainty checks require more caution for larger datasets. Table 6 reports the full runtime and memory measurements.

Table 6. Scenario-calibrated local compute measurements for realistic mSigSDK use cases.

| Use case | Sequencing mode | Workflow step | Samples (n) | Mutations/sample (n) | Contexts (n) | Signatures (n) | Run settings | Runtime (ms) | Heap after (MB) | RSS after (MB) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Single-sample WGS review | WGS | Validation and burden summary | 1 | 5000 | 96 | 24 | Default | 1.3 | 4.85 | 33.61 |
| Single-sample WGS review | WGS | Known-signature refitting | 1 | 5000 | 96 | 24 | Default | 13.4 | 4.59 | 35.93 |
| Single-sample WGS review | WGS | Reconstruction quality metrics | 1 | 5000 | 96 | 24 | Default | 1.5 | 5.49 | 36.00 |
| Single-sample WGS review | WGS | Threshold sensitivity analysis | 1 | 5000 | 96 | 24 | 0, 0.01, 0.03, 0.05, 0.1 thresholds | 18.4 | 5.90 | 36.14 |
| Single-sample WGS review | WGS | Bootstrap uncertainty, one sample | 1 | 5000 | 96 | 24 | 500 iterations | 601.3 | 6.15 | 41.02 |
| Small panel/WES batch | Panel/WES | Validation and burden summary | 24 | 80 | 96 | 12 | Default | 1.1 | 8.52 | 40.98 |
| Small panel/WES batch | Panel/WES | Known-signature refitting | 24 | 80 | 96 | 12 | Default | 10.2 | 6.15 | 41.93 |
| Small panel/WES batch | Panel/WES | Reconstruction quality metrics | 24 | 80 | 96 | 12 | Default | 1.5 | 10.06 | 42.17 |
| Small panel/WES batch | Panel/WES | Threshold sensitivity analysis | 24 | 80 | 96 | 12 | 0, 0.01, 0.03, 0.05, 0.1 thresholds | 11.7 | 9.00 | 49.93 |
| Small panel/WES batch | Panel/WES | Bootstrap uncertainty, one sample | 24 | 80 | 96 | 12 | 100 iterations | 30.1 | 7.52 | 50.01 |
| Small panel/WES batch | Panel/WES | Burden-aware review summary | 24 | 80 | 96 | 12 | Default | 8.6 | 40.75 | 91.00 |
| Small panel/WES batch | Panel/WES | Fit-quality review summary | 24 | 80 | 96 | 12 | Default | 15.5 | 44.08 | 91.29 |
| Small panel/WES batch | Panel/WES | Restricted-assay evidence summary | 24 | 80 | 96 | 12 | Default | 3.4 | 46.35 | 91.30 |
| Small panel/WES batch | Panel/WES | Panel/WES review workflow | 24 | 80 | 96 | 12 | Default | 32.8 | 37.73 | 92.00 |
| Rare-cancer cohort | WES/WGS | Validation and burden summary | 40 | 300 | 96 | 18 | Default | 2.5 | 9.71 | 50.06 |
| Rare-cancer cohort | WES/WGS | Known-signature refitting | 40 | 300 | 96 | 18 | Default | 6.0 | 12.21 | 50.06 |
| Rare-cancer cohort | WES/WGS | Reconstruction quality metrics | 40 | 300 | 96 | 18 | Default | 4.0 | 11.33 | 50.15 |
| Rare-cancer cohort | WES/WGS | Threshold sensitivity analysis | 40 | 300 | 96 | 18 | 0, 0.01, 0.03, 0.05, 0.1 thresholds | 25.9 | 10.07 | 50.63 |
| Rare-cancer cohort | WES/WGS | Bootstrap uncertainty, one sample | 40 | 300 | 96 | 18 | 100 iterations | 35.5 | 12.74 | 50.82 |
| Rare-cancer cohort | WES/WGS | Burden-aware review summary | 40 | 300 | 96 | 18 | Default | 12.7 | 39.60 | 92.18 |
| Rare-cancer cohort | WES/WGS | Fit-quality review summary | 40 | 300 | 96 | 18 | Default | 27.9 | 42.75 | 93.00 |
| Rare-cancer cohort | WES/WGS | Cohort fit workflow | 40 | 300 | 96 | 18 | Default | 73.5 | 48.36 | 95.42 |
| Rare-cancer cohort | WES/WGS | Subgroup discovery workflow | 12 | 300 | 96 | 18 | 75 iterations; ranks 2 | 69.5 | 36.12 | 94.13 |
| Medium research cohort | WGS/WES | Validation and burden summary | 120 | 1200 | 96 | 24 | Default | 5.2 | 11.42 | 50.84 |
| Medium research cohort | WGS/WES | Known-signature refitting | 120 | 1200 | 96 | 24 | Default | 41.5 | 11.28 | 51.20 |
| Medium research cohort | WGS/WES | Reconstruction quality metrics | 120 | 1200 | 96 | 24 | Default | 18.1 | 9.13 | 53.72 |
| Medium research cohort | WGS/WES | Threshold sensitivity analysis | 120 | 1200 | 96 | 24 | 0, 0.01, 0.03, 0.05, 0.1 thresholds | 116.1 | 19.74 | 69.68 |
| Medium research cohort | WGS/WES | Bootstrap uncertainty, one sample | 120 | 1200 | 96 | 24 | 100 iterations | 80.3 | 22.16 | 70.45 |
| Medium research cohort | WGS/WES | Burden-aware review summary | 120 | 1200 | 96 | 24 | Default | 77.5 | 37.71 | 95.46 |
| Medium research cohort | WGS/WES | Fit-quality review summary | 120 | 1200 | 96 | 24 | Default | 54.9 | 48.41 | 97.62 |
| Medium research cohort | WGS/WES | Cohort fit workflow | 120 | 1200 | 96 | 24 | Default | 232.0 | 50.66 | 101.04 |
| Portal-scale cohort review | WGS | Validation and burden summary | 300 | 1500 | 96 | 40 | Default | 15.0 | 26.63 | 70.89 |
| Portal-scale cohort review | WGS | Known-signature refitting | 300 | 1500 | 96 | 40 | Default | 396.3 | 16.16 | 71.63 |
| Portal-scale cohort review | WGS | Reconstruction quality metrics | 300 | 1500 | 96 | 40 | Default | 35.5 | 13.90 | 74.23 |
| Portal-scale cohort review | WGS | Threshold sensitivity analysis | 300 | 1500 | 96 | 40 | 0, 0.01, 0.03, 0.05, 0.1 thresholds | 415.5 | 34.59 | 86.67 |
| Portal-scale cohort review | WGS | Bootstrap uncertainty, one sample | 300 | 1500 | 96 | 40 | 100 iterations | 151.8 | 33.24 | 88.25 |
| Exploratory discovery cohort | WGS/WES | Exploratory NMF rank selection | 30 | 1200 | 96 | NA | 75 iterations; ranks 2, 3, 4 | 704.9 | 30.02 | 89.21 |
| Exploratory discovery cohort | WGS/WES | Exploratory NMF extraction | 30 | 1200 | 96 | NA | 75 iterations; ranks 4 | 235.7 | 34.36 | 89.34 |
| Medium exploratory discovery cohort | WGS | Exploratory NMF rank selection | 80 | 1500 | 96 | NA | 75 iterations; ranks 2, 3, 4 | 2639.2 | 30.18 | 90.51 |
| Medium exploratory discovery cohort | WGS | Exploratory NMF extraction | 80 | 1500 | 96 | NA | 75 iterations; ranks 4 | 918.2 | 32.46 | 90.91 |

*Note.* Measurements used deterministic synthetic SBS96 matrices sized to represent common mSigSDK use cases: single-sample WGS review, small panel/WES batches, rare-cancer cohorts, medium research cohorts, portal-scale cohort review, and exploratory discovery cohorts. Each row is a single computation run executed on Windows x64 with Node.js v16.16.0, Intel Core i7-11700K CPU, and 16 GB RAM. Memory values are approximate process-level measurements.

## Discussion

mSigSDK v0.3 provides a browser-native JavaScript SDK for mutational-signature review. It makes selected mSigPortal resources, API access patterns, and plotting conventions reusable in portals, notebooks, static review pages, and local scripts. It also reviews imported spectra locally after they have been generated. The main contribution is not a new signature-fitting algorithm. The contribution is a portable software layer that makes common review tasks easier to embed, share, and reproduce.

The SDK is most useful when a researcher or developer needs to inspect precomputed spectra, add mutational-signature plots to another web interface, share a collaborator review page, teach workflow interpretation without local package installation, or produce traceable reports from fixed spectra and parameters. Production-scale extraction, mutation-level assignment, large cohort discovery, and disease-specific validation remain separate workflow layers.

This design follows a pattern that has worked for other web-based data resources. FAIR and data-commons work supports reusable access across distributed resources rather than moving every dataset into one backend [2-3,7]. Almeida and colleagues showed that browser-side SDKs can support serverless public-data workflows and reduce remote backend computation [5-6]. PLCOjs demonstrated the same pattern for GWAS resources by separating API access and graphical components from a single portal landing page [4]. mSigSDK applies that pattern to mSigPortal and mutational-signature review, with the added ability to handle imported spectra in the client runtime.

mSigSDK complements established mutational-signature software (Table 7). Its native JavaScript tier runs spectra import/export, validation, NNLS refitting, QC, panel/WES review, exploratory NMF, figures, reports, and provenance directly in the browser. Its optional Pyodide tier can run compatible Python packages when browser package installation and dependencies are available. Its handoff tier supports tools such as SigProfilerExtractor, deconstructSigs, and full MuSiCal workflows by writing canonical input matrices and scripts, then parsing common output tables. mSigSDK therefore provides a browser-native review, QC, interoperability, and reporting layer around spectra and tool outputs rather than a browser-native port of every established package.

Table 7. Functional positioning relative to related mutational-signature software.

| Tool or platform | Primary role | Browser execution | Interoperability with mSigSDK | QC/reporting layer |
| --- | --- | --- | --- | --- |
| mSigSDK | Browser-native review SDK for spectra import, validation, NNLS refitting, QC, panel review, exploratory NMF, interoperability, and reporting. | Yes, JavaScript core; optional Pyodide for compatible Python packages. | Native nested matrices plus SigProfiler, COSMIC, MuSiCal-compatible, and report JSON Schema formats. | Structured warnings, fit-quality evidence, recommended actions, figures, and provenance. |
| mSigPortal | Public mutational-signature portal and API. | Portal hosted. | mSigSDK retrieves public mSigPortal spectra and signatures and reuses selected plotting conventions. | Portal-specific. |
| SigProfilerExtractor | Production de novo mutational-signature extraction. | Not directly; used through local Python or server execution. | mSigSDK exports matrix inputs, creates a runnable Python script, and parses extracted signature and exposure TSV outputs. | SigProfilerExtractor stability diagnostics plus mSigSDK screening and report metadata. |
| deconstructSigs | R-based known-signature decomposition. | Not directly; used through local R or external execution. | mSigSDK exports deconstructSigs-compatible TSV inputs and parses sample-by-signature exposure tables. | deconstructSigs fit outputs plus mSigSDK uncertainty, threshold sensitivity, and provenance. |
| SigProfilerAssignment | Known-signature assignment against a supplied catalog. | Optional browser execution through Pyodide matrix-mode runs when package installation and dependencies succeed; local Python remains the production path. | mSigSDK prepares matrix-mode input, can run compatible Pyodide sessions, and parses exposure outputs. | Assignment metrics plus mSigSDK ambiguity, low-burden, and report fields. |
| MuSiCal | Sparse likelihood-based mutational-signature refitting and discovery. | Package execution depends on Pyodide-compatible wheels; mSigSDK includes a browser-native MuSiCal-compatible sparse NNLS comparator. | mSigSDK exports/imports MuSiCal-style matrices and compares sparse refits on the same spectra/catalog. | MuSiCal metrics from the external tool or comparator plus mSigSDK ambiguity and reporting fields. |

*Note.* The comparison defines intended workflow boundaries. Browser execution for Python and R ecosystem tools depends on package compatibility, wheels, and browser runtime limits.

The validation results clarify the proper scope. Synthetic mixtures showed strong reconstruction and useful exposure recovery, especially as mutation burden increased. An independent nonnegative least-squares check matched mSigSDK to numerical precision, and direct concordance with deconstructSigs showed close agreement when both tools used the same PCAWG Lung-AdenoCA spectra, selected COSMIC SBS96 catalog, and exposure cutoff. These results support the correctness of the browser-side refitting workflow for shared review tasks. At the same time, inactive signature calls and small exposure differences still occurred, which reflects a known challenge in signature refitting: similar or broad signatures can exchange exposure even when the reconstructed spectrum is close to the observed spectrum [13,15,17-18]. For this reason, mSigSDK reports burden, ambiguity, residuals, bootstrap intervals, threshold sensitivity, and comparator disagreement alongside fitted exposures.

Privacy should also be stated precisely. User-supplied spectra can remain local after import, and the SDK does not require those spectra to be sent to a new analysis backend. This does not mean that all activity is offline. A web page may load public reference signatures, scripts, plotting libraries, and other remote assets. Deployments that require strict privacy should pin local assets, document the resource boundary, and avoid remote logging.

Several limits remain. mSigSDK does not introduce a new attribution algorithm; it relies on standard NNLS and multiplicative-update NMF. Plain NNLS may over-assign confusable signatures relative to sparse likelihood-based methods such as MuSiCal; the SDK flags high-ambiguity signature pairs and surfaces discordant bootstrap selection frequencies, but it does not apply a sparse prior. Browser memory, single-threaded execution, device speed, browser version, catalog size, and workflow settings can affect performance. Panel/WES labels depend on assay design, callable territory, mutation burden, and signature-specific callable context coverage. Localized mutagenesis and subgroup-discovery pipelines are available under \`mSigSDK.experimental\`; they are not validated in this manuscript.

## Conclusions

mSigSDK v0.3 is a browser-native JavaScript SDK for mutational-signature review. It extends selected mSigPortal resources into reusable web modules and adds local review workflows for precomputed spectra. The SDK supports portable visualization, lightweight refitting, uncertainty review, panel/WES evidence tiers, exploratory NMF, TCGA/GDC helper access, and structured reports. Its practical value is making signature review easier to embed, share, and reproduce while keeping a clear boundary between public API access and local handling of imported spectra.

## Availability and requirements

Project name: mSigSDK
Project home page: https://github.com/episphere/msig
Operating systems: Platform independent
Programming language: JavaScript, ECMAScript modules
Current manuscript version: 0.3.0
Commit used for manuscript assets: 132a22cf073b
Other requirements: Modern browser supporting JavaScript modules. Internet access is required for mSigPortal and TCGA/GDC API queries. User-supplied spectra can be analyzed locally after import.
Testing and documentation: The repository includes smoke tests, benchmark scripts, manuscript asset generators, example notebooks, and API documentation scripts. Manuscript figures and tables can be regenerated from the documented manuscript workspace.
License: MIT
Restrictions for non-academic use: None

## Declarations

### Ethics approval and consent to participate

Not applicable.

### Consent for publication

Not applicable.

### Availability of data and materials

The mSigSDK source code and example workflows are available at https://github.com/episphere/msig. Manuscript figures, tables, benchmark outputs, and validation outputs are generated from files in the manuscript documentation directory. Public demonstration spectra and signatures are retrieved from mSigPortal through public API calls. TCGA/GDC helper access calls public GDC endpoints where used.

### Competing interests

The authors declare no competing interests.

### Funding

This work was funded by the National Cancer Institute Intramural Research Program.

### Author contributions

A.G. conceived and developed mSigSDK, implemented the v0.3 workflow modules, generated figures and tables, and drafted the manuscript. J.S.A. provided project direction and technical guidance. T.Z., Y.C.M., M.T.L., B.P., K.C., and J.B. provided domain guidance and manuscript review. All authors reviewed and approved the final manuscript.

## References

1. Zhang T, Sang J, Cho P, Jiang K, Landi MT. Integrative mutational signature portal (mSigPortal) for cancer genomic study. Cancer Res. 2021;81(13 Supplement):211. doi:10.1158/1538-7445.AM2021-211.
2. Wilkinson MD, et al. The FAIR Guiding Principles for scientific data management and stewardship. Sci Data. 2016;3:160018. doi:10.1038/sdata.2016.18.
3. Grossman RL. Data lakes, clouds, and commons: a review of platforms for analyzing and sharing genomic data. Trends Genet. 2019;35:223-234. doi:10.1016/j.tig.2018.12.006.
4. Ruan E, et al. PLCOjs, a FAIR GWAS web SDK for the NCI Prostate, Lung, Colorectal and Ovarian Cancer Genetic Atlas project. Bioinformatics. 2022;38:4434-4436. doi:10.1093/bioinformatics/btac531.
5. Almeida JS, Hajagos J, Saltz J, Saltz M. Serverless OpenHealth at data commons scale: traversing the 20 million patient records of New York's SPARCS dataset in real-time. PeerJ. 2019;7:e6230. doi:10.7717/peerj.6230.
6. Almeida JS, et al. Mortality tracker: the COVID-19 case for real time web APIs as epidemiology commons. Bioinformatics. 2021;37:2073-2074. doi:10.1093/bioinformatics/btaa933.
7. Jensen MA, Ferretti V, Grossman RL, Staudt LM. The NCI Genomic Data Commons as an engine for precision medicine. Blood. 2017;130:453-459. doi:10.1182/blood-2017-03-735654.
8. Hoadley KA, et al. Cell-of-origin patterns dominate the molecular classification of 10,000 tumors from 33 types of cancer. Cell. 2018;173:291-304.e6. doi:10.1016/j.cell.2018.03.022.
9. de Bruijn I, et al. Analysis and visualization of longitudinal genomic and clinical data from the AACR Project GENIE Biopharma Collaborative in cBioPortal. Cancer Res. 2023;83:3861-3867. doi:10.1158/0008-5472.CAN-23-0816.
10. Alexandrov LB, et al. The repertoire of mutational signatures in human cancer. Nature. 2020;578:94-101. doi:10.1038/s41586-020-1943-3.
11. Landi MT, et al. Tracing lung cancer risk factors through mutational signatures in never-smokers: the Sherlock-Lung Study. Am J Epidemiol. 2021;190:962-976. doi:10.1093/aje/kwaa234.
12. Pich O, Muinos F, Lolkema MP, Steeghs N, Gonzalez-Perez A, Lopez-Bigas N. The mutational footprints of cancer therapies. Nat Genet. 2019;51:1732-1740. doi:10.1038/s41588-019-0525-5.
13. Koh G, Degasperi A, Zou X, Momen S, Nik-Zainal S. Mutational signatures: emerging concepts, caveats and clinical applications. Nat Rev Cancer. 2021;21:619-637. doi:10.1038/s41568-021-00377-7.
14. Koh G, Zou X, Nik-Zainal S. Mutational signatures: experimental design and analytical framework. Genome Biol. 2020;21:37. doi:10.1186/s13059-020-1951-5.
15. Medo M, Ng CKY, Medova M. A comprehensive comparison of tools for fitting mutational signatures. Nat Commun. 2024;15:9467. doi:10.1038/s41467-024-53711-6.
16. Lawrence L, Kunder CA, Fung E, Stehr H, Zehnder J. Performance characteristics of mutational signature analysis in targeted panel sequencing. Arch Pathol Lab Med. 2021;145:1424-1431. doi:10.5858/arpa.2020-0536-OA.
17. Jin H, Gulhan DC, Geiger B, et al. Accurate and sensitive mutational signature analysis with MuSiCal. Nat Genet. 2024;56:541-552. doi:10.1038/s41588-024-01659-0.
18. Wu AJ, Perera A, Kularatnarajah L, Korsakova A, Pitt JJ. Mutational signature assignment heterogeneity is widespread and can be addressed by ensemble approaches. Brief Bioinform. 2023;24:bbad331. doi:10.1093/bib/bbad331.
19. Degasperi A, et al. A practical framework and online tool for mutational signature analyses show inter-tissue variation and driver dependencies. Nat Cancer. 2020;1:249-263. doi:10.1038/s43018-020-0027-5.
20. Diaz-Gay M, et al. Assigning mutational signatures to individual samples and individual somatic mutations with SigProfilerAssignment. Bioinformatics. 2023;39:btad756. doi:10.1093/bioinformatics/btad756.
21. Blokzijl F, Janssen R, van Boxtel R, Cuppen E. MutationalPatterns: comprehensive genome-wide analysis of mutational processes. Genome Med. 2018;10:33. doi:10.1186/s13073-018-0539-0.
22. Rosenthal R, et al. deconstructSigs: delineating mutational processes in single tumors distinguishes DNA repair deficiencies and patterns of carcinoma evolution. Genome Biol. 2016;17:31. doi:10.1186/s13059-016-0893-4.
23. Islam SMA, et al. Uncovering novel mutational signatures by de novo extraction with SigProfilerExtractor. Cell Genomics. 2022;2:100179. doi:10.1016/j.xgen.2022.100179.
`;
}
async function main() {
  await mkdir(TABLE_DIR, { recursive: true });
  await mkdir(FIGURE_PAGE_DIR, { recursive: true });
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await mkdir(MANUSCRIPT_TEXT_DIR, { recursive: true });

  const benchmarkPayload = await readJsonIfExists(BENCHMARK_JSON, { rows: [] });
  const browserBenchmarkPayload = await readJsonIfExists(BROWSER_BENCHMARK_JSON, { rows: [] });
  const lowBurdenPayload = await readJsonIfExists(LOW_BURDEN_JSON, { rows: [] });
  const syntheticValidationPayload = await readJsonIfExists(SYNTHETIC_VALIDATION_JSON, { summaryRows: [] });
  const concordancePayload = await readJsonIfExists(CONCORDANCE_VALIDATION_JSON, { tableRows: [] });
  const figureSnapshot = await loadOrCreateFigureSnapshot();
  const tables = createTables(benchmarkPayload, lowBurdenPayload, syntheticValidationPayload, concordancePayload, browserBenchmarkPayload);
  const figurePages = createFigurePages(lowBurdenPayload, figureSnapshot);

  for (const [filename, content] of tables) {
    await writeFile(join(TABLE_DIR, filename), fullHtml(filename, content));
  }
  await writeFile(join(TABLE_DIR, "table6-compute-benchmarks.csv"), benchmarkCsv(benchmarkPayload, browserBenchmarkPayload));
  await writeFile(join(TABLE_DIR, "table4-synthetic-validation.csv"), syntheticValidationCsv(syntheticValidationPayload));
  await writeFile(join(TABLE_DIR, "table5-deconstructsigs-concordance.csv"), concordanceCsv(concordancePayload));
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

  let finalManuscriptDraft = manuscriptDraft();
  try {
    finalManuscriptDraft = await readFile(
      join(MANUSCRIPT_TEXT_DIR, "MSIGSDK_FINAL_SUBMISSION_DRAFT.md"),
      "utf8"
    );
  } catch (_error) {
    await writeFile(join(MANUSCRIPT_TEXT_DIR, "MSIGSDK_FINAL_SUBMISSION_DRAFT.md"), finalManuscriptDraft);
  }
  await writeFile(join(MANUSCRIPT_TEXT_DIR, "MSIGSDK_REVISED_MANUSCRIPT_DRAFT.md"), finalManuscriptDraft);

  await writeFile(
    join(FIGURE_PAGE_DIR, "README.md"),
    `# mSigSDK Figure Pages

These HTML pages generate the manuscript figure panels using mSigSDK workflows. The central graphical abstract is stored separately at \`docs/manuscript/figures/figure1-graphical-abstract.svg\`; the pages below correspond to manuscript Figures 2-6.

Run the local server from the repository root:

\`\`\`bash
npm run serve:observable
\`\`\`

Then open:

- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure1-cohort-exploration.html
- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure2-known-signature-fitting.html
- http://127.0.0.1:8080/docs/manuscript/actual-figure-pages/figure3-qc-evidence-uncertainty.html
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

Current standalone tables:

- \`table1-researcher-journey-capabilities.html\`
- \`table2-computation-privacy-boundary.html\`
- \`table3-methods-defaults.html\`
- \`table4-synthetic-validation.html\`
- \`table5-deconstructsigs-concordance.html\`
- \`table6-compute-benchmarks.html\`
- \`table7-related-tools.html\`

Current CSV exports are available for Table 4, Table 5, and Table 6.
`
  );

  console.log(`Wrote ${tables.length} tables, ${figurePages.length} figure pages, and synchronized manuscript draft.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
