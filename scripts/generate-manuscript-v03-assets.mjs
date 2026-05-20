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
    v03_subgroup_discovery: "Cohort subgroup-structure review",
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
      ["Public resource access", "Reuse supported mSigPortal and TCGA/GDC public resources outside a single portal session.", "Internet access and supported public resources.", "Public spectra, signatures, metadata, and portal-style plots."],
      ["Single-sample review", "Inspect a precomputed tumor spectrum before interpretation or sharing.", "One profile matrix and a compatible reference catalog.", "Burden, context coverage, exposures, reconstruction, residuals, uncertainty, warnings, and report fields."],
      ["MAF-derived profile conversion", "Convert mutation annotation format (MAF)-like rows into profile matrices.", "Rows with row-supplied sequence context, a caller-supplied lookup table, or eligible live SBS context lookup when needed.", "SBS96, SBS1536, DBS78, and ID83 spectra, row traces, audit summaries, skipped-row reasons, and provenance."],
      ["Cohort review", "Compare spectra and fitted exposures across samples or metadata groups.", "Sample-by-context spectra and optional metadata.", "Similarity structure, group summaries, exposure comparisons, and cohort-level QC summaries."],
      ["Panel/WES review", "Review signature evidence in restricted assay territory.", "Restricted spectra, reference signatures, and optional callable opportunities.", "Opportunity-normalized fits, callable-territory evidence, expected fitted mutation counts, and review evidence tiers."],
      ["Exploratory NMF", "Screen moderate cohorts in the browser before production extraction.", "Moderate sample-by-context spectra and a rank range.", "Extracted profiles, exposures, rank diagnostics, and reference matches."],
      ["Reporting and handoff", "Share reproducible results and interoperate with external tools.", "SDK results or compatible matrices.", "HTML/JSON reports, provenance, SigProfiler/COSMIC/MuSiCal-compatible files, and parsed external outputs."],
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
      ["TCGA/GDC helper queries", "No, data are retrieved remotely before conversion", "TCGA/GDC APIs", "Public data and access-governed data remain subject to upstream GDC access rules; no claim of local computation for API retrieval"],
      ["User spectra or MAF-derived matrix validation", "Yes", "None after import", "User mutation data can remain local"],
      ["Known-signature NNLS fitting and reconstruction review", "Yes", "Optional reference catalog fetch", "User spectra can remain local; reference data may be public API-derived"],
      ["Bootstrap, threshold sensitivity, fit-quality review, and residual checks", "Yes", "None", "Local; runtime scales with iterations, thresholds, and catalog size"],
      ["Cohort grouping and metadata-stratified exposure comparison", "Yes", "None", "Local if metadata and spectra are user supplied"],
      ["Panel/WES opportunity normalization and review evidence tiers", "Yes", "None", "Local; outputs include callable-territory evidence and evidence tiers"],
      ["Exploratory NMF extraction", "Yes for moderate cohorts in the browser", "None", "Local for moderate matrices"],
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
      ["Known-signature refitting", "Coordinate-descent nonnegative least squares with relative exposures below 0.01 removed and remaining exposures renormalized in manuscript workflows.", "Fitted exposures for a supplied reference catalog.", "Catalog-specific refit to supplied signatures."],
      ["Reconstruction and residuals", "Observed and reconstructed spectra compared in relative scale using cosine similarity, cosine distance, RMSE, mean absolute error, L1/L2 error, and maximum residual.", "Fit-quality metrics and residual spectra.", "Reviewed with burden, uncertainty, and ambiguity fields."],
      ["Bootstrap uncertainty", "Multinomial resampling of the observed spectrum; manuscript examples use 95% intervals.", "Exposure means, medians, confidence intervals, and selection frequencies.", "Intervals condition on the observed spectrum, supplied catalog, and fitting settings."],
      ["Threshold sensitivity", "Relative exposure thresholds of 0, 0.01, 0.03, 0.05, and 0.10 in the manuscript examples.", "Changes in active signatures, reconstruction cosine, and RMSE across thresholds.", "Sensitivity analysis across stated cutoffs."],
      ["Signature ambiguity", "Pairwise signature cosine values at or above 0.90 are reported; high ambiguity is flagged at nearest-neighbor cosine at least 0.95 or entropy at least 0.92.", "Flags for exchangeable or broad reference signatures.", "Highlights closely similar reference signatures."],
      ["Catalog sufficiency", "Possible out-of-catalog signal is flagged using relative unexplained fraction at least 0.07, suspected signal at least 0.12, reconstruction cosine below 0.90, or structured positive residual cosine at least 0.85.", "Residual patterns and recommended catalog review actions.", "Supports catalog and disease-context review."],
      ["Fit-quality review labels", "Low burden is below 100 mutations and moderate burden is below 1,000 mutations by default. Labels summarize burden, reconstruction, residual, bootstrap, threshold, ambiguity, and catalog flags.", "Reporting modes and underlying evidence fields.", "Aggregates evidence while preserving component metrics."],
      ["Panel/WES review evidence tiers", "Minimum assessable burden is 30 mutations; limited-support exposure threshold is 0.05; higher-support threshold is 0.20. Callable-opportunity maps are supplied from the assay territory and genome build.", "Higher review support, limited review support, not detected within review settings, or not assessable for each fitted signature.", "Not assessable indicates insufficient burden or callable territory for a tier call."],
      ["Exploratory NMF", "Multiplicative-update NMF minimizes Frobenius reconstruction error. Manuscript examples use fixed ranks or rank sweeps over moderate cohorts in the browser.", "Extracted profiles, exposures, reconstruction metrics, run diagnostics, and reference matches.", "Browser-based profile inspection and handoff support."],
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
      ["mSigSDK", "Browser-native review SDK for spectra import, validation, profile conversion, NNLS refitting, QC, panel review, exploratory NMF, interoperability, and reporting.", "Yes, JavaScript core; optional Pyodide for compatible Python packages.", "Native nested matrices plus SigProfiler, COSMIC, MuSiCal-compatible, and report JSON Schema outputs.", "Structured warnings, fit-quality evidence, recommended actions, figures, and provenance."],
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
      "mSigSDK v0.3.0 outputs for fit-quality evidence, bootstrap exposure intervals, threshold sensitivity, and controlled low-burden stress testing.",
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
      "mSigSDK v0.3.0 outputs from PCAWG Lung-AdenoCA spectra: group exposure comparison, subgroup-structure review, PCAWG-derived panel downsampling evidence matrix, and cohort fit-quality summary.",
    panels: `
    <section class="panel wide"><p class="panel-title">A. Metadata-stratified exposure comparison</p><div id="fig4Group"></div></section>
    <section class="panel wide"><p class="panel-title">B. Panel/WES evidence matrix</p><div id="fig4Panel"></div></section>
    <section class="panel"><p class="panel-title">C. Cohort fit-quality summary</p><div id="fig4FitQuality"></div></section>
    <section class="panel"><p class="panel-title">D. Cohort subgroup-structure review</p><div id="fig4Subgroups"></div></section>`,
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
  rowsToTable("fig4Subgroups",
    ["Similarity group", "Samples", "Status", "Minimum review size"],
    cohort.subgroupReview.subgroups.map((row, index) => [
      row.clusterId || \`group_\${index + 1}\`,
      row.sampleCount,
      cohort.subgroupReview.status,
      cohort.subgroupReview.summary.minSubgroupSamples,
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

mSigSDK v0.3.0 is presented as a client-side JavaScript extension of mSigPortal that makes selected resources, API calls, and plotting conventions portable. Local review modules for imported spectra add matrix validation, refitting, QC, uncertainty review, panel/WES evidence, exploratory NMF, and reporting around that portal-SDK layer. TCGA/GDC helper access is included as an additional public-resource access module.

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

1. Manuscript framing centered on mSigSDK v0.3.0 as a client-side JavaScript extension of mSigPortal, with local review workflows as added capabilities.
2. v0.3.0 SDK features: burden-aware review, fit-quality evidence, catalog-sufficiency checks, cohort comparison, cohort subgroup-structure review, panel/WES restricted-assay evidence, evidence labels, optional Pyodide/WebR package execution, external-tool handoff adapters, provenance-aware reports, and publication-oriented figures.
3. Seven Google Docs-ready HTML tables.
4. Generated five reproducible HTML figure pages that call mSigSDK functions and use PCAWG Lung-AdenoCA spectra plus COSMIC SBS96 references where applicable.
5. Scenario-calibrated runtime outputs for single-sample, panel/WES, rare-cancer, medium-cohort, portal-scale, and discovery-cohort use cases.
6. Controlled synthetic exposure-recovery validation with known COSMIC SBS96 mixtures.
7. Cross-tool concordance experiments on shared PCAWG Lung-AdenoCA spectra and a matched selected COSMIC catalog, including deconstructSigs, SigProfilerAssignment, and MuSiCal-compatible refit review.
8. Full manuscript draft in \`docs/manuscript/manuscript/MSIGSDK_FINAL_SUBMISSION_DRAFT.md\`.

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

mSigSDK v0.3.0 is presented as a client-side extension of mSigPortal with local review workflows for imported spectra:

- mSigSDK is primarily an extension of mSigPortal.
- mSigPortal API calls provide public reference and cohort data.
- User-supplied spectra can be validated, fitted, stress-tested, and visualized locally in the browser.
- TCGA/GDC helpers are additional public-resource access modules.
- v0.3.0 adds local review layers on top of the portal-SDK layer: burden-aware recommendations, fit-quality evidence, catalog-sufficiency checks, cohort subgroup-structure review, metadata comparisons, panel/WES evidence labels, and external-tool interoperability.
- Browser-side NMF supports browser-sized profile inspection and handoff to production extraction tools such as SigProfilerExtractor.

## Title Direction

Recommended title:

**mSigSDK: a browser-native JavaScript SDK for mutational-signature review**

## Main Narrative Arc

1. Mutational-signature researchers need reusable plots, workflow defaults, uncertainty summaries, and reproducible outputs.
2. Existing extraction and assignment engines remain essential package- or server-centered tools.
3. mSigSDK v0.3.0 makes selected mSigPortal resources and plots reusable outside the portal.
4. The SDK adds local JavaScript review modules and makes the computation/privacy boundary explicit.
5. Results demonstrate cohort exploration, local refitting, synthetic exposure recovery, deconstructSigs concordance, uncertainty/QC review evidence, cohort and panel workflows, exploratory NMF, and scenario-calibrated runtime measurements.
6. The discussion covers production extraction handoff, configurable burden thresholds, browser memory/rendering constraints, and broader concordance and disease-specific validation.
`;
}

function bmcManuscriptDraft() {
  return `# mSigSDK: a browser-native JavaScript SDK for mutational-signature review, quality control, and reporting

Aaron Ge1,2*, Tongwu Zhang1, Yasmmin Cortes Martins3, Maria Teresa Landi1, Brian Park1, Kailing Chen1, Jeya Balasubramanian1, Jonas S Almeida1

1 Division of Cancer Epidemiology and Genetics, National Cancer Institute, National Institutes of Health, Maryland, USA
2 University of Maryland School of Medicine, Maryland, USA
3 National Laboratory of Scientific Computing, Petropolis, Brazil

*Correspondence: age1@som.umaryland.edu

## Abstract

### Background

Mutational-signature workflows often combine web portals, local R or Python packages, matrix conversion scripts, visualization notebooks, and manual report assembly. This fragmentation makes it difficult to embed signature review in web applications, share reproducible review artifacts, preserve provenance, and distinguish well-supported fitted exposures from estimates that are limited by mutation burden or assay design. Existing tools remain essential for production extraction and assignment, but they do not provide a reusable browser-native review layer for validation, quality control, interoperability, and reporting for precomputed spectra.

### Results

mSigSDK v0.3.0 is a JavaScript software development kit distributed as ECMAScript modules for browser-native mutational-signature review. It retrieves selected public resources from mSigPortal, The Cancer Genome Atlas (TCGA), and the Genomic Data Commons (GDC), imports local spectra or mutation annotation format (MAF)-like rows, validates matrix shape and context completeness, performs known-signature non-negative least-squares (NNLS) refitting, summarizes reconstruction and residual quality, estimates bootstrap uncertainty, evaluates threshold sensitivity, flags signature ambiguity and catalog sufficiency concerns, supports restricted-assay evidence tiers, renders profile-specific plots, and builds provenance-aware reports. MAF conversion preserves legacy SBS96 behavior and can also return SBS1536, DBS78, and ID83 spectra when required row-level evidence is present. SBS profiles can use live 5-base reference windows from the UCSC Genome Browser sequence API; SBS96 uses the centered trinucleotide and SBS1536 uses the full centered pentanucleotide. DBS78 uses explicit dinucleotide substitutions or adjacent SNV pairs, and ID83 uses insertion/deletion alleles with repeat or microhomology annotations when available. In synthetic validation, mean exposure-vector cosine increased from 0.912 at 50 mutations to 0.996 at 1,000 mutations. In a 38-sample PCAWG Lung-AdenoCA concordance analysis, exposure vectors had mean cosine 0.997 against deconstructSigs, 0.907 against SigProfilerAssignment, and 0.973 against MuSiCal SparseNNLS under matched input spectra and a shared nine-signature catalog. In Chrome, a 120-sample cohort workflow ran in a median of 253.7 ms and a 300-sample, 40-signature refit ran in a median of 298.9 ms.

### Conclusions

mSigSDK provides a browser-native review, quality-control, interoperability, and reporting layer for mutational-signature workflows. It complements production extraction and assignment packages by making spectra, fitted exposures, warnings, provenance, and reports easier to embed, inspect, share, and reproduce.

**Keywords:** mutational signatures; JavaScript; browser-native analysis; quality control; provenance; signature refitting; interoperability; mutation annotation format; cancer genomics; software development kit

## Background

Mutational signatures summarize patterns of somatic mutation associated with DNA damage, DNA repair defects, environmental exposures, endogenous mutagenesis, and therapy-related processes [10-13]. Practical signature analyses commonly require several operations: retrieving reference signatures and public cohort spectra, converting mutation rows into profile matrices, fitting known signatures, reviewing reconstruction quality and uncertainty, generating visualizations, and assembling reports. These operations are often distributed across portals, local package environments, scripts, and notebooks, producing workflows with repeated format conversions, incomplete provenance, and outputs that are difficult to embed in another web application or share as reproducible review artifacts.

mSigSDK addresses the review layer of this workflow. It is not a new signature-attribution algorithm and is not a replacement for production extraction or assignment tools. It provides a reusable JavaScript layer for spectra import, validation, refitting, uncertainty review, profile conversion, visualization, interoperability, and reporting in browser-based or local JavaScript environments. This scope is relevant to portal developers adding mutational-signature panels to web applications, computational analysts preparing shareable review pages, laboratories working with restricted assay data, instructors teaching interpretation, and methods developers who need a consistent review surface around their own outputs.

mSigSDK applies FAIR principles at the workflow level [2]. Findability is supported by stable public entry points and versioned documentation. Accessibility is supported by browser execution without requiring each user to install a local R or Python stack. Interoperability is supported by SigProfiler-style, COSMIC-style, MuSiCal-compatible, TSV, JSON, and report JSON Schema outputs. Reusability is supported by explicit parameters, warnings, method-basis fields, provenance, and reproducible manuscript assets.

The software boundary is defined by three runtime tiers. The native JavaScript tier runs spectra import and export, validation, non-negative least squares (NNLS) refitting, quality-control (QC) review, bootstrap and threshold review, panel and whole-exome sequencing (WES) evidence, exploratory non-negative matrix factorization (NMF), plotting, reports, and provenance directly in the browser or a local JavaScript runtime. The optional Pyodide tier can run compatible Python package workflows in a browser worker when package installation, wheel availability, memory, and runtime limits permit. The handoff tier prepares canonical inputs for external tools and parses common outputs back into SDK objects. This separation keeps browser-native behavior distinct from optional package execution and external production workflows.

## Implementation

### Architecture and data boundary

mSigSDK is distributed as a modular JavaScript SDK using ECMAScript modules (Figure 1). Public resources are retrieved from mSigPortal, The Cancer Genome Atlas (TCGA), the Genomic Data Commons (GDC), or the UCSC Genome Browser sequence API when those features are used. Once spectra or mutation annotation format (MAF)-derived matrices are imported into the client runtime, validation, refitting, QC review, uncertainty estimation, panel/WES review, exploratory NMF, plotting, and report generation can run locally. User-supplied spectra can therefore remain in the client runtime after import, although public resource queries and external web assets remain remote dependencies.

![Figure 1. mSigSDK client-side mutational signature review architecture](../figures/figure1-graphical-abstract.svg)

**Figure 1. mSigSDK client-side mutational signature review architecture.** mSigSDK uses selected public mSigPortal resources and plotting conventions through reusable JavaScript modules. User-supplied spectra or MAF-derived matrices can be imported into the client runtime for validation, refitting, quality-control review, panel/WES evidence review, plotting, report generation, and external-tool handoff.

### Workflow scope

Table 1 summarizes the main workflows. The primary entry points are organized around public resource access, local spectra review, MAF-to-profile conversion, cohort and panel/WES review, exploratory NMF, interoperability, and reporting.

**Table 1. mSigSDK workflows, inputs, and outputs.**

| Workflow | Intended use | Input requirements | Primary outputs |
| --- | --- | --- | --- |
| Public resource access | Reuse supported mSigPortal and TCGA/GDC public resources outside a single portal session. | Internet access and supported public resources. | Public spectra, signatures, metadata, and portal-style plots. |
| Single-sample review | Inspect a precomputed tumor spectrum before interpretation or sharing. | One profile matrix and a compatible reference catalog. | Burden, context coverage, exposures, reconstruction, residuals, uncertainty, warnings, and report fields. |
| MAF-derived profile conversion | Convert mutation annotation format (MAF)-like rows into profile matrices. | Rows with row-supplied sequence context, a caller-supplied lookup table, or eligible live SBS context lookup when needed. | SBS96, SBS1536, DBS78, and ID83 spectra, row traces, audit summaries, skipped-row reasons, and provenance. |
| Cohort review | Compare spectra and fitted exposures across samples or metadata groups. | Sample-by-context spectra and optional metadata. | Similarity structure, group summaries, exposure comparisons, and cohort-level QC summaries. |
| Panel/WES review | Review signature evidence in restricted assay territory. | Restricted spectra, reference signatures, and optional callable opportunities. | Opportunity-normalized fits, callable-territory evidence, expected fitted mutation counts, and review evidence tiers. |
| Exploratory NMF | Screen moderate cohorts in the browser before production extraction. | Moderate sample-by-context spectra and a rank range. | Extracted profiles, exposures, rank diagnostics, and reference matches. |
| Reporting and handoff | Share reproducible results and interoperate with external tools. | SDK results or compatible matrices. | HTML/JSON reports, provenance, SigProfiler/COSMIC/MuSiCal-compatible files, and parsed external outputs. |

### Computation and privacy boundary

Table 2 distinguishes browser-local review from public-resource retrieval. For supported client-side workflows, imported user spectra can remain local, while remote public data queries and externally loaded web assets remain online dependencies.

**Table 2. Computation locus, external dependencies, and privacy boundary.**

| Workflow | Computed in browser/client runtime | External dependency | Privacy interpretation |
| --- | --- | --- | --- |
| mSigPortal public reference and cohort queries | No, data are retrieved remotely. | mSigPortal API. | Public or portal-hosted data. |
| TCGA/GDC helper queries | No, data are retrieved remotely before conversion. | TCGA/GDC APIs. | Public data and access-governed data remain subject to upstream GDC access rules. |
| User spectra or MAF-derived matrix validation | Yes. | None after import. | User mutation data can remain local. |
| Known-signature NNLS fitting and reconstruction review | Yes. | Optional reference catalog fetch. | User spectra can remain local after reference data are available. |
| Bootstrap, threshold sensitivity, fit-quality review, and residual checks | Yes. | None after import. | Local; runtime scales with iterations, thresholds, and catalog size. |
| Panel/WES opportunity normalization and review evidence tiers | Yes. | None after import. | Local if opportunity data are supplied. |
| Plot rendering, reports, and provenance | Yes. | Browser plotting libraries. | Local unless a user exports or shares outputs. |

### Data model and MAF-derived profiles

The main matrix forms are sample-by-context spectra, signature-by-context reference catalogs, and sample-by-signature exposure matrices. SBS96 follows the pyrimidine-centered COSMIC convention. The validation namespace records expected contexts for committed profile targets, including SBS96, SBS1536, DBS78, and ID83.

The MAF converter is built around the profile registry. \`convertMatrix\` remains a backward-compatible SBS96 wrapper, while \`convertMafToProfileSpectra\` returns \`spectraByProfile\`, \`traceByProfile\`, audit summaries, warnings, and registry metadata. SBS profiles can use row-supplied context, caller-supplied lookup tables, small bundled lookup assets for reproducible examples, or live 5-base reference windows from the UCSC Genome Browser sequence API for the selected genome build. SBS96 uses the centered trinucleotide from that window, and SBS1536 uses the full centered pentanucleotide. DBS78 counts explicit dinucleotide substitutions or adjacent SNV pairs in the same sample. ID83 counts insertion/deletion alleles with repeat or microhomology annotations when present. Catalog fitting is performed only when the selected catalog profile and matrix match the converted matrix.

### Quality-control and reporting layer

The SDK reports separate evidence fields for mutation burden, context coverage, reconstruction, residual structure, bootstrap stability, threshold sensitivity, signature ambiguity, catalog sufficiency, panel/WES restricted-assay evidence, and cohort subgroup structure. Table 3 lists the default settings used in the manuscript examples. These defaults are configurable.

**Table 3. Algorithmic defaults used in manuscript workflows.**

| Component | Operational setting | Output used in review | Scope note |
| --- | --- | --- | --- |
| Input spectra | Sample-by-context matrices with finite non-negative values; missing and extra contexts are compared with the expected profile context list. | Mutation burden, context completeness, empty-spectrum flags, and low-burden flags. | Applies after spectra have been generated or imported. |
| Known-signature refitting | Coordinate-descent NNLS with relative exposures below 0.01 removed and remaining exposures renormalized in manuscript workflows. | Fitted exposures for a supplied reference catalog. | Catalog-specific refit to supplied signatures. |
| Reconstruction and residuals | Observed and reconstructed spectra compared in relative scale using cosine, RMSE, MAE, L1/L2 error, and maximum residual. | Fit-quality metrics and residual spectra. | Reviewed with burden, uncertainty, and ambiguity fields. |
| Bootstrap uncertainty | Multinomial resampling of the observed spectrum; manuscript examples use 95% intervals. | Exposure means, medians, intervals, and selection frequencies. | Intervals condition on the observed spectrum, supplied catalog, and fitting settings. |
| Threshold sensitivity | Relative exposure thresholds of 0, 0.01, 0.03, 0.05, and 0.10. | Active-signature counts, exposure drift, reconstruction cosine, and RMSE. | Sensitivity analysis across stated cutoffs. |
| Signature ambiguity | Pairwise signature cosine at or above 0.90 is reported; high ambiguity is flagged at nearest-neighbor cosine at least 0.95 or entropy at least 0.92. | Flags for exchangeable or broad reference signatures. | Highlights closely similar reference signatures. |
| Catalog sufficiency | Possible out-of-catalog signal is flagged using unexplained fraction, reconstruction cosine, and structured positive residuals. | Residual patterns and catalog review actions. | Supports catalog and disease-context review. |
| Fit-quality labels | Low burden is below 100 mutations and moderate burden is below 1,000 mutations by default. | Reporting modes and evidence fields. | Aggregates evidence while preserving component metrics. |
| Panel/WES evidence tiers | Minimum assessable burden is 30 mutations; limited-support threshold is 0.05; higher-support threshold is 0.20. | Higher review support, limited review support, not detected within review settings, or not assessable. | Depends on callable territory and burden. |
| Exploratory NMF | Multiplicative-update NMF with fixed ranks or rank sweeps over moderate cohorts in the browser. | Extracted profiles, exposures, diagnostics, and reference matches. | Screening and handoff support. |

Reports are generated as structured JSON or standalone HTML. Report objects include method basis, parameters, validation, QC, warnings, recommended actions, figure descriptors, and provenance. For MAF-derived spectra, provenance records genome build, context source, lookup mode, API endpoint when used, fetch timestamp, cache status, selected profile, and count reconciliation.

## Results

### Browser-native review workflow

PCAWG Lung-AdenoCA SBS96 spectra were retrieved through mSigPortal helpers and reviewed in the browser before refitting (Figure 2). The burden summary, SBS96 profile comparison, clustered cosine similarity heatmap, similarity tree, and UMAP projection were produced from the same imported matrix. The workflow follows the intended review sequence: import spectra, validate shape and burden, inspect cohort structure, then proceed to fitting, uncertainty review, report generation, or external handoff.

![Figure 2. Browser-based cohort exploration](../actual-figure-pages/screenshots/figure1-cohort-exploration.png)

**Figure 2. Browser-based cohort exploration of PCAWG Lung-AdenoCA SBS96 spectra.** Mutation burden, SBS96 profile comparison, clustered cosine similarity heatmap, similarity tree, and UMAP projection are produced from the same imported matrix.

### Synthetic exposure recovery

A controlled synthetic experiment generated 64 SBS96 spectra at each of six mutation-burden levels from 50 to 2,500 mutations. Spectra were multinomial draws from linear mixtures of six COSMIC reference signatures, then refitted with the SDK NNLS workflow (Table 4). Mean exposure-vector cosine rose from 0.912 at 50 mutations to 0.996 at 1,000 mutations, and mean reconstruction cosine rose from 0.884 to 0.991 across the same range. These results support browser-side review of known-signature refitting while showing why low-burden spectra require uncertainty estimates and warning fields.

**Table 4. Controlled synthetic exposure-recovery validation.**

| Mutations per sample | Samples (n) | Exposure cosine, mean (95% CI) | Exposure MAE, mean (95% CI) | Active-signature recall, mean (95% CI) | Inactive-signature calls, mean (95% CI) | Reconstruction cosine, mean (95% CI) |
| --- | --- | --- | --- | --- | --- | --- |
| 50 | 64 | 0.912 (0.882-0.941) | 0.065 (0.054-0.075) | 0.938 (0.903-0.972) | 0.165 (0.120-0.211) | 0.884 (0.862-0.906) |
| 100 | 64 | 0.952 (0.932-0.973) | 0.043 (0.034-0.051) | 0.979 (0.959-0.999) | 0.129 (0.085-0.173) | 0.930 (0.915-0.944) |
| 250 | 64 | 0.982 (0.973-0.990) | 0.027 (0.021-0.032) | 0.995 (0.985-1.000) | 0.082 (0.045-0.119) | 0.966 (0.959-0.973) |
| 500 | 64 | 0.993 (0.990-0.996) | 0.016 (0.013-0.020) | 1.000 (1.000-1.000) | 0.026 (0.006-0.046) | 0.982 (0.978-0.986) |
| 1,000 | 64 | 0.996 (0.994-0.997) | 0.013 (0.011-0.016) | 1.000 (1.000-1.000) | 0.027 (0.006-0.049) | 0.991 (0.988-0.993) |
| 2,500 | 64 | 0.998 (0.998-0.999) | 0.008 (0.006-0.010) | 1.000 (1.000-1.000) | 0.017 (0.001-0.033) | 0.996 (0.995-0.997) |

### QC, uncertainty, and restricted-assay evidence

The validation layer was evaluated through fit-quality review, confusable-signature stress testing, and restricted-assay interpretation. In confusable mixtures, reporting modes tracked ground-truth recovery: \`standard_qc_passed\` had a mean exposure cosine of 0.999, \`report_with_caveats\` had a mean exposure cosine of 0.989, and \`restricted_interpretation\` had a mean exposure cosine of 0.947. Bootstrap coverage was below nominal at the lowest mutation burdens and closer to nominal above 250 mutations, consistent with the expected sampling limits of sparse SBS96 profiles.

In PCAWG Lung-AdenoCA examples, fit-quality evidence summarized burden, reconstruction, residual structure, bootstrap intervals, threshold sensitivity, signature ambiguity, and catalog sufficiency (Figure 3).

![Figure 3. Fit-quality evidence and uncertainty](../actual-figure-pages/screenshots/figure3-qc-evidence-uncertainty.png)

**Figure 3. Burden-aware fit-quality evidence, uncertainty, and threshold sensitivity.** The workflow reports the evidence fields underlying reporting labels, including bootstrap intervals, threshold sensitivity, residual summaries, and low-burden warnings.

### Numerical correctness and cross-tool concordance

The NNLS solver was compared with an independent R NNLS implementation and reproduced the standard solution to numerical precision. Cross-tool concordance was then evaluated on the same 38 PCAWG Lung-AdenoCA SBS96 spectra and a shared nine-signature COSMIC SBS96 catalog (Table 5). The deconstructSigs comparator had a mean exposure cosine of 0.997 relative to mSigSDK, with 36 of 38 samples sharing the top signature. SigProfilerAssignment and MuSiCal comparisons were also run on the same matrix and catalog. The remaining disagreements were concentrated in spectra with flat or otherwise confusable fitted signatures, supporting the use of cautionary QC fields rather than a simple pass/fail interpretation.

**Table 5. Independent NNLS check and cross-tool concordance on shared PCAWG Lung-AdenoCA spectra.**

| Validation layer | Main result | Supported conclusion |
| --- | --- | --- |
| Independent NNLS solver check | Mean exposure-vector cosine 1.000; maximum absolute exposure difference 4.79e-10. | mSigSDK reproduces the standard NNLS solution to numerical precision. |
| deconstructSigs concordance | Mean exposure cosine 0.997; median 0.998; minimum 0.988; 36 of 38 samples shared the top signature. | The R decomposition comparator was closely aligned with mSigSDK under matched spectra, catalog, cutoff, and renormalization. |
| SigProfilerAssignment concordance | Mean exposure cosine 0.907; median 0.937; minimum 0.556; 29 of 38 samples shared the top signature. | The Python assignment framework agreed for most spectra, with remaining disagreements concentrated in confusable flat-signature fits. |
| MuSiCal SparseNNLS concordance | Mean exposure cosine 0.973; median 0.997; minimum 0.855; 37 of 38 samples shared the top signature. | The sparse likelihood-based comparator served as an additional refitting comparator on the same spectra and catalog. |
| Reconstruction concordance | Mean reconstruction cosine: mSigSDK 0.982; deconstructSigs 0.982; SigProfilerAssignment 0.974; MuSiCal 0.981. | All reconstruction metrics are computed against the same observed spectra and selected nine-signature catalog. |
| Ambiguity-flag prediction | 0 of 2 deconstructSigs-discordant, high-ambiguity samples also showed MuSiCal-vs-mSigSDK top-signature disagreement; MuSiCal-vs-mSigSDK top-signature disagreement occurred in 1 of 38 samples overall. | Ambiguity signals are interpreted as cautionary evidence rather than proof of a specific comparator disagreement. |

![Figure 4. Known-signature refitting](../actual-figure-pages/screenshots/figure2-known-signature-fitting.png)

**Figure 4. Local known-signature refitting against nine COSMIC SBS96 reference signatures.** The exposure heatmap, selected sample profile, reconstruction summary, and residual view provide a browser-side review surface for fitted spectra.

### Panel and cohort review

For panel/WES review, callable-context downsampling showed that panel-vs-WGS exposure agreement increased with context breadth. Mean panel-vs-WGS exposure cosine rose from 0.813 with a 24-context mask to 0.899 with 48 contexts and 0.959 with 72 contexts. The \`not_assessable\` tier separated insufficient mutation burden or callable territory from an absent fitted signal (Figure 5). The same workflow also supports metadata-stratified exposure comparisons and cohort subgroup review.

![Figure 5. Cohort and panel workflows](../actual-figure-pages/screenshots/figure4-cohort-panel-workflows.png)

**Figure 5. Cohort and panel workflows.** Metadata-stratified exposure comparison, panel evidence matrix, fit-quality summary, and cohort subgroup review generated by mSigSDK.

### Runtime of interactive review tasks

Browser and Node.js benchmarks used deterministic synthetic SBS96 matrices sized to common review scenarios. Timings excluded plot rendering. Chrome was measured using a standalone browser harness; Firefox was requested but no local Firefox executable was available. The measured Chrome timings support interactive use for validation, refitting, panel/WES review, moderate cohort review, and NMF screening in the browser. Larger NMF analyses and repeated uncertainty workflows are more suitable for background Web Workers or local execution.

**Table 6. Scenario-calibrated local compute summary.**

| Scenario | Workflow step | Samples and settings | Chrome median (range) | Node.js median (range) |
| --- | --- | --- | --- | --- |
| Single-sample WGS review | Known-signature refitting | 1 sample; 5,000 mutations/sample; 24 signatures | 1.2 ms (1.1-5.5) | 6.7 ms (0.5-7.6) |
| Single-sample WGS review | Bootstrap uncertainty | 1 sample; 500 iterations; 24 signatures | 391.8 ms (373.5-470.0) | 337.2 ms (328.4-415.3) |
| Small panel/WES batch | Full panel/WES review workflow | 24 samples; 80 mutations/sample; 12 signatures | 21.6 ms (21.4-22.2) | 25.6 ms (24.0-30.5) |
| Medium research cohort | Cohort fit workflow | 120 samples; 1,200 mutations/sample; 24 signatures | 253.7 ms (252.0-279.2) | 253.2 ms (247.0-270.8) |
| Portal-scale cohort review | Known-signature refitting | 300 samples; 1,500 mutations/sample; 40 signatures | 298.9 ms (294.2-358.1) | 232.3 ms (223.9-256.1) |
| Exploratory discovery cohort | NMF rank selection | 30 samples; ranks 2, 3, and 4; 75 iterations | 576.0 ms (556.7-611.0) | 491.2 ms (477.4-595.1) |
| Medium exploratory discovery cohort | NMF rank selection | 80 samples; ranks 2, 3, and 4; 75 iterations | 2.88 s (2.52-2.90) | 2.15 s (2.05-2.17) |

### Exploratory extraction in the browser

The exploratory NMF module decomposed a PCAWG Lung-AdenoCA subset over candidate ranks and reported extracted profiles, exposures, rank diagnostics, and reference-signature matches (Figure 6). This workflow is intended for screening and instructional use. Production de novo discovery still requires dedicated extraction workflows, disease-specific stability checks, and larger validation.

![Figure 6. Exploratory browser-side NMF extraction](../actual-figure-pages/screenshots/figure5-nmf-extraction.png)

**Figure 6. Exploratory browser-side NMF extraction.** mSigSDK NMF extraction, rank diagnostics, and reference matching for a moderate-sized PCAWG Lung-AdenoCA subset.

## Discussion

mSigSDK v0.3.0 fills a software gap between public mutational-signature resources and full local analysis toolchains. It makes common review tasks portable: spectra import, context validation, MAF-derived profile conversion, known-signature refitting, uncertainty review, panel/WES evidence, exploratory NMF, figure generation, report assembly, and provenance capture. The validation and benchmark results support three practical claims. First, the SDK can run realistic review workflows in a browser or local JavaScript runtime. Second, its NNLS solver and matched-input refitting behavior agree with established numerical and package-based comparators. Third, its reporting fields make burden, uncertainty, ambiguity, context provenance, and assay limitations visible before biological interpretation.

The comparison with related tools is functional, not hierarchical (Table 7). SigProfilerExtractor remains the appropriate production tool for de novo extraction and stability analysis. SigProfilerAssignment remains a full assignment framework with local Python as the production path. deconstructSigs and MuSiCal remain established R/Python ecosystem tools for decomposition and sparse refitting. mSigSDK complements these packages by preparing compatible matrices, parsing outputs, comparing results using a shared context order, and generating review artifacts that can be embedded in portals, notebooks, teaching pages, or manuscript workflows.

**Table 7. Functional positioning relative to related mutational-signature software.**

| Tool or platform | Primary role | Browser execution | Interoperability with mSigSDK | QC/reporting layer |
| --- | --- | --- | --- | --- |
| mSigSDK | Browser-native review SDK for spectra import, validation, profile conversion, NNLS refitting, QC, panel review, exploratory NMF, interoperability, and reporting. | Yes, JavaScript core; optional Pyodide for compatible Python packages. | Native nested matrices plus SigProfiler, COSMIC, MuSiCal-compatible, and report JSON Schema outputs. | Structured warnings, fit-quality evidence, recommended actions, figures, and provenance. |
| mSigPortal | Public mutational-signature portal and API. | Portal hosted. | mSigSDK retrieves public mSigPortal spectra and signatures and reuses selected plotting conventions. | Portal-specific. |
| SigProfilerExtractor | Production de novo mutational-signature extraction. | Not directly; used through local Python or server execution. | mSigSDK exports matrix inputs, creates a runnable Python script, and parses extracted signature and exposure TSV outputs. | SigProfilerExtractor stability diagnostics plus mSigSDK screening and report metadata. |
| deconstructSigs | R-based known-signature decomposition. | Not directly; used through local R or external execution. | mSigSDK exports deconstructSigs-compatible TSV inputs and parses sample-by-signature exposure tables. | deconstructSigs fit outputs plus mSigSDK uncertainty, threshold sensitivity, and provenance. |
| SigProfilerAssignment | Known-signature assignment against a supplied catalog. | Optional browser execution through Pyodide matrix-mode runs when package installation and dependencies succeed; local Python remains the production path. | mSigSDK prepares matrix-mode input, can run compatible Pyodide sessions, and parses exposure outputs. | Assignment metrics plus mSigSDK ambiguity, low-burden, and report fields. |
| MuSiCal | Sparse likelihood-based mutational-signature refitting and discovery. | Package execution depends on Pyodide-compatible wheels; mSigSDK includes a browser-native MuSiCal-compatible sparse NNLS comparator. | mSigSDK exports/imports MuSiCal-style matrices and compares sparse refits on the same spectra/catalog. | MuSiCal metrics from the external tool or comparator plus mSigSDK ambiguity and reporting fields. |

Several limitations remain. mSigSDK does not introduce a new attribution algorithm and does not replace production-scale extraction, mutation-level assignment, or disease-specific validation. Unregularized NNLS can distribute small exposures across similar or flat signatures; mSigSDK reports ambiguity and uncertainty but does not impose a sparse prior. Browser runtime depends on device speed, memory, browser version, catalog size, and workflow settings. MAF conversion depends on correct genome build, coordinate conventions, and reference context availability; offline deployments should supply project-specific context lookup tables rather than relying on bundled example lookup assets. Panel/WES evidence labels depend on assay design, callable territory, mutation burden, and signature-specific callable context coverage.

## Conclusions

mSigSDK v0.3.0 is a browser-native JavaScript SDK for mutational-signature review, quality control, interoperability, and provenance-aware reporting. It supports portable use of mSigPortal resources, local review of imported spectra, MAF-derived SBS96/SBS1536/DBS78/ID83 conversion, known-signature refitting, uncertainty review, panel/WES evidence tiers, exploratory NMF, and structured report generation. The SDK provides an embeddable review layer that supports inspection, sharing, and reproduction of signature workflows while preserving a clear boundary between browser-native computation, optional Pyodide execution, and external-tool handoff.

## Availability and requirements

Project name: mSigSDK

Project home page: https://github.com/episphere/msig

Archived version: GitHub release/tag pending for the final BMC submission snapshot; no DOI is claimed until one exists.

Operating systems: Platform independent.

Programming language: JavaScript (ECMAScript modules).

Current software version: 0.3.0.

Other requirements: A modern browser with JavaScript module support for browser use, or Node.js for local JavaScript execution. Internet access is required for mSigPortal, TCGA/GDC, and UCSC Genome Browser API queries when those public resources are used. User-supplied spectra and MAF-derived matrices can be reviewed locally after import.

License: MIT.

Restrictions for non-academic use: None.

## List of abbreviations

API: application programming interface.

COSMIC: Catalogue of Somatic Mutations in Cancer.

DBS: double-base substitution.

GDC: Genomic Data Commons.

HTML: Hypertext Markup Language.

ID: insertion/deletion.

JSON: JavaScript Object Notation.

MAF: mutation annotation format.

NMF: non-negative matrix factorization.

NNLS: non-negative least squares.

QC: quality control.

SBS: single-base substitution.

SDK: software development kit.

TCGA: The Cancer Genome Atlas.

WES: whole-exome sequencing.

WGS: whole-genome sequencing.

## Declarations

### Ethics approval and consent to participate

Not applicable.

### Consent for publication

Not applicable.

### Availability of data and materials

The mSigSDK source code, example notebooks, manuscript figure generators, generated tables, benchmark outputs, and validation outputs are available in the project repository at https://github.com/episphere/msig. Public demonstration spectra and signatures are retrieved from mSigPortal through public API calls. TCGA/GDC helper workflows use public GDC endpoints where applicable. The final submission snapshot will be identified by a GitHub release/tag.

### Competing interests


### Funding


### Authors' contributions


### Acknowledgements


### Use of AI-assisted technologies


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
      "mSigSDK v0.3.0 manuscript tables",
      tables
        .map(([, content]) => content)
        .join('\n<hr style="border:0;border-top:1px solid #d0d7e2;margin:22px 0;">\n')
    )
  );

  for (const [filename, content] of figurePages) {
    await writeFile(join(FIGURE_PAGE_DIR, filename), content);
  }

  const finalManuscriptDraft = bmcManuscriptDraft();
  await writeFile(join(MANUSCRIPT_TEXT_DIR, "MSIGSDK_FINAL_SUBMISSION_DRAFT.md"), finalManuscriptDraft);
  await writeFile(
    join(MANUSCRIPT_DIR, "README.md"),
    `# mSigSDK Manuscript Workspace

This directory contains the current BMC Bioinformatics software-article draft, generated assets, validation data, and reproducibility material.

## Current Folders

- \`manuscript/\`: synchronized submission draft generated from \`scripts/generate-manuscript-v03-assets.mjs\`.
- \`data/\`: benchmark, cross-tool concordance, confusable-signature, panel-validation, and synthetic-validation outputs used by the manuscript.
- \`google-doc-tables/\`: standalone HTML tables designed for copy/paste into Word or Google Docs.
- \`actual-figure-pages/\`: reproducible HTML figure pages, cached public PCAWG/COSMIC data, and PNG screenshots.
- \`experiments/\`: dated experiment packages with README, data, tables, figures, and code.

## Rebuild commands

From the repository root:

\`\`\`bash
npm run benchmark:manuscript -- --repeats=5
npm run benchmark:confusable
npm run validation:panel
npm run benchmark:browser -- --browsers=chrome,firefox --repeats=3
npm run concordance:cross-tools
npm run assets:manuscript
\`\`\`

\`npm run assets:manuscript\` regenerates the manuscript draft, manuscript tables, figure pages, and workspace READMEs from the synchronized generator.

## BMC Submission Checkpoint

Create a GitHub release or tag for the final manuscript asset snapshot before submission. Use that tag in the manuscript Availability and requirements section. Do not claim a DOI unless a Zenodo or other archival DOI exists.
`
  );
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
