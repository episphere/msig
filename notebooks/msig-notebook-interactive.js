import {
  crossToolSummary,
  loadPublicMafRows,
  loadPublicSbs96Dataset,
  panelValidationSummary,
  sbs96Contexts,
  sharedCallableOpportunities,
} from "./msig-notebook-fixtures.js";

const MODE_COPY = {
  "public-cohort": {
    title: "Interactive public cohort explorer",
    summary:
      "Discover mSigPortal spectra or TCGA/GDC public data, load a real cohort, visualize spectra, and choose the downstream workflow.",
    kind: "spectra",
  },
  "end-to-end": {
    title: "Interactive end-to-end workflow lab",
    summary:
      "Load data, choose analysis settings, run signature fitting and uncertainty checks, inspect plots, and save the files needed to rerun the analysis.",
    kind: "report",
  },
  "qc-walkthrough": {
    title: "Interactive known-signature quality check",
    summary:
      "Load spectra and signatures, choose cutoffs, estimate signature contributions, and review the main warning signs before interpreting results.",
    kind: "fit",
  },
  "resource-portability": {
    title: "Interactive resource portability check",
    summary:
      "Move spectra and signatures through common table formats, then verify that source metadata and object shape survive the round trip.",
    kind: "portability",
  },
  "bring-your-own-spectra": {
    title: "Interactive bring-your-own spectra workflow",
    summary:
      "Paste or upload your own SBS96 mutation-count table, choose reference signatures, adjust cutoffs, and save a reusable report.",
    kind: "fit",
  },
  "cohort-panel": {
    title: "Interactive cohort and panel review",
    summary:
      "Fit a cohort with sample details, then see how panel or WES settings change what can be reported.",
    kind: "cohort-panel",
  },
  "panel-evidence": {
    title: "Interactive panel/WES evidence review",
    summary:
      "Adjust panel/WES coverage and evidence cutoffs, then review which signatures are well supported, limited, or not ready to report.",
    kind: "panel",
  },
  "nmf-extraction": {
    title: "Interactive discovery workflow",
    summary:
      "Choose spectra and discovery settings, then inspect learned patterns, sample contributions, stability checks, and export files.",
    kind: "nmf",
  },
  "uncertainty-thresholds": {
    title: "Interactive uncertainty and cutoff review",
    summary:
      "Choose a sample and uncertainty settings, then see how the estimates change across confidence intervals and cutoffs.",
    kind: "uncertainty",
  },
  "export-report": {
    title: "Interactive export and report builder",
    summary:
      "Run a fit, save the input/output tables, and download a report that records the exact settings you selected.",
    kind: "report",
  },
  "multi-engine": {
    title: "Interactive multi-engine comparison",
    summary:
      "Compare mSigSDK with other fitting tools on the same spectra and reference signatures.",
    kind: "engine",
  },
};

const NOTEBOOK_LINKS = [
  {
    title: "End-to-end workflow",
    file: "msig-sdk-end-to-end-workflow.onb.html",
    topic: "Full workflow",
    phase: "Start here",
    summary: "Walk through the complete fit, review, uncertainty, report, and export path once.",
    bestFor: "You are new to the SDK or want one complete example before choosing a narrower lesson.",
    result: "A reportable known-signature workflow with quality checks and downloadable files.",
  },
  {
    title: "Public cohort explorer",
    file: "msig-sdk-public-cohort-exploration.onb.html",
    topic: "Public cohorts",
    phase: "Find data",
    summary: "Discover mSigPortal spectra or TCGA/GDC MAF-derived data, load a cohort, and make first-pass cohort plots.",
    bestFor: "You need real public example data or want to inspect cohorts before fitting signatures.",
    result: "A cohort-shaped spectra table that can feed the other notebooks.",
  },
  {
    title: "Resource portability",
    file: "msig-sdk-resource-portability.onb.html",
    topic: "Resource portability",
    phase: "Load data",
    summary: "Check that data survives import, export, reload, and handoff between formats.",
    bestFor: "You need confidence that a file conversion did not change the data shape or metadata.",
    result: "Round-trip checks, provenance, and reusable resource files.",
  },
  {
    title: "Variant rows to mutation patterns",
    file: "msig-sdk-maf-fit-report.onb.html",
    topic: "Variant conversion",
    phase: "Prepare data",
    summary: "Turn raw variant rows into a checked 96-bin mutation pattern before fitting.",
    bestFor: "You have MAF-like rows or DNA changes and need to make them analysis-ready.",
    result: "A verified mutation spectrum plus the checks behind the conversion.",
  },
  {
    title: "Cohort QC triage",
    file: "msig-sdk-qc-walkthrough.onb.html",
    topic: "Quality control",
    phase: "Judge results",
    summary: "Rank known-signature fits by cohort-level QC concern, then inspect burden, reconstruction, residuals, warnings, and next steps.",
    bestFor: "You have fitted samples and need to decide which results need review before reporting.",
    result: "A cohort triage table with sample-level evidence behind fitted signature estimates.",
  },
  {
    title: "Cohort and panel workflow",
    file: "msig-sdk-cohort-panel-workflow.onb.html",
    topic: "Cohort plus assay",
    phase: "Compare groups",
    summary: "Connect sample metadata, group comparisons, and panel/WES limits in one workflow.",
    bestFor: "You are reviewing multiple samples and the assay type affects what can be said.",
    result: "Cohort-level interpretation with assay limitations kept visible.",
  },
  {
    title: "Discovery extraction (NMF)",
    file: "msig-sdk-nmf-extraction.onb.html",
    topic: "Discovery screening",
    phase: "Extract patterns",
    summary: "Extract candidate signatures from spectra and inspect rank and stability checks.",
    bestFor: "You want to find patterns from the cohort instead of fitting only known signatures.",
    result: "Candidate signatures, sample contributions, diagnostics, and production export files.",
  },
  {
    title: "Uncertainty and cutoffs",
    file: "msig-sdk-uncertainty-thresholds.onb.html",
    topic: "Stability review",
    phase: "Stress-test",
    summary: "See how fitted calls change across bootstrap intervals and reporting cutoffs.",
    bestFor: "You need to separate stable calls from borderline calls before reporting.",
    result: "Uncertainty intervals and cutoff sensitivity tables.",
  },
  {
    title: "Export and reports",
    file: "msig-sdk-export-report.onb.html",
    topic: "Saved outputs",
    phase: "Report",
    summary: "Save the inputs, outputs, report fields, provenance, and rerun records.",
    bestFor: "You need a result another person can review, rerun, or archive.",
    result: "Downloadable tables and a structured analysis report.",
  },
  {
    title: "Multi-tool comparison",
    file: "msig-sdk-multi-engine-comparison.onb.html",
    topic: "Cross-tool review",
    phase: "Compare",
    summary: "Compare fitting engines on the same inputs and inspect sample-level disagreements.",
    bestFor: "You want to know whether different tools agree on the same sample.",
    result: "Agreement and disagreement evidence, not a package leaderboard.",
  },
];

const RETIRED_INTERACTIVE_MODES = new Set(["maf-fit-report"]);

const PHASE_COPY = {
  overview: {
    action: "Run overview check",
    helper: "Confirm the public dataset, SDK import, and key objects before entering the workflow.",
  },
  data: {
    action: "Check data and validation",
    helper: "Edit or upload data for this step, then preview the data shape, mutation counts, and validation checks.",
  },
  analysis: {
    action: "Run step with current data",
    helper: "Change cutoffs and settings, rerun the SDK call, and inspect the tables produced by this step.",
  },
  visualize: {
    action: "Render plots with current data",
    helper: "Choose the current settings, rerun the workflow, and inspect the plots generated from the results.",
  },
  review: {
    action: "Review current results",
    helper: "Review warnings, confidence levels, fit quality, uncertainty, or agreement between tools with editable settings.",
  },
  export: {
    action: "Build downloads from current data",
    helper: "Generate downloadable files from the current data and settings.",
  },
};

const DATA_GUIDES = {
  spectra: {
    sample:
      "The default dataset is loaded from the public mSigPortal APIs as real SBS96 mutation-count spectra with sample labels and source metadata.",
    format:
      "Use a spectra JSON object keyed by sample, where each sample contains SBS96 context counts, or upload a SigProfiler-style TSV table. Sample details are optional CSV, TSV, or JSON with a sample column.",
    example: '{ "sample_1": { "A[C>A]A": 12, "T[C>T]T": 4 } }',
  },
  matrixFit: {
    sample:
      "The default dataset pairs real public SBS96 spectra with a compatible COSMIC SBS96 reference-signature catalog loaded through mSigPortal.",
    format:
      "Spectra should be JSON or SigProfiler-style TSV. Signatures should be JSON or COSMIC-style TSV keyed by signature name and SBS96 context. Sample details are optional but should include a sample column when supplied.",
    example: '{ "SBS1": { "T[C>T]T": 0.12, "A[C>T]G": 0.03 } }',
  },
  maf: {
    sample:
      "The default MAF rows come from public TCGA/GDC masked somatic mutation files and are trimmed for a browser-sized conversion audit.",
    format:
      "Provide CSV, TSV, or JSON rows with chromosome, start_position, reference_allele, tumor_seq_allele2, a grouping field such as project_code or Tumor_Sample_Barcode, and a context field when using offline mode.",
    example:
      "chromosome,start_position,reference_allele,tumor_seq_allele2,project_code,context",
  },
  panel: {
    sample:
      "The default panel review uses real public SBS96 spectra and signatures, plus an editable coverage mask that hides or downweights selected contexts to mimic panel or WES data.",
    format:
      "Provide spectra and signatures as JSON or TSV. Coverage weights are context values from 0 to 1; this page exposes a scale control for the default mask.",
    example: '{ "T[C>T]A": 0.5, "T[C>G]A": 0.35, "G[C>G]G": 0 }',
  },
  nmf: {
    sample:
      "The default discovery run uses real public SBS96 spectra and a compatible COSMIC reference catalog only to label similar learned patterns after the run.",
    format:
      "Provide a spectra table with multiple samples and enough mutations for discovery. Reference signatures are optional for matching learned patterns to known signatures.",
    example: '{ "tumor_a": { "A[C>A]A": 420 }, "tumor_b": { "T[C>T]A": 165 } }',
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function button(label, kind = "") {
  const node = document.createElement("button");
  node.type = "button";
  node.className = `workflow-button ${kind}`.trim();
  node.textContent = label;
  return node;
}

function field(label, control, help = "") {
  const wrapper = document.createElement("label");
  wrapper.className = "workflow-field";
  const title = document.createElement("span");
  title.textContent = label;
  wrapper.append(title, control);
  if (help) {
    const small = document.createElement("small");
    small.textContent = help;
    wrapper.append(small);
  }
  return wrapper;
}

function placeholder(text) {
  const node = document.createElement("div");
  node.className = "workflow-placeholder";
  node.textContent = text;
  return node;
}

function guideForKind(kind) {
  if (kind === "spectra") return DATA_GUIDES.spectra;
  if (kind === "maf") return DATA_GUIDES.maf;
  if (kind === "panel" || kind === "cohort-panel") return DATA_GUIDES.panel;
  if (kind === "nmf") return DATA_GUIDES.nmf;
  return DATA_GUIDES.matrixFit;
}

function renderDataGuide(config) {
  const guide = guideForKind(config.kind);
  const node = document.createElement("div");
  node.className = "workflow-data-guide";

  const heading = document.createElement("strong");
  heading.textContent = "Data source and format";
  const lead = document.createElement("p");
  lead.textContent =
    "Start by choosing one source: load the default real public dataset, or paste/upload small local inputs in the same shape and apply them before running.";

  const grid = document.createElement("div");
  grid.className = "workflow-data-guide-grid";
  const sampleBlock = document.createElement("div");
  const sampleTitle = document.createElement("span");
  sampleTitle.textContent = "Default public data";
  const sampleText = document.createElement("p");
  sampleText.textContent = guide.sample;
  sampleBlock.append(sampleTitle, sampleText);

  const formatBlock = document.createElement("div");
  const formatTitle = document.createElement("span");
  formatTitle.textContent = "Your data format";
  const formatText = document.createElement("p");
  formatText.textContent = guide.format;
  const example = document.createElement("code");
  example.textContent = guide.example;
  formatBlock.append(formatTitle, formatText, example);

  grid.append(sampleBlock, formatBlock);
  node.append(heading, lead, grid);
  return node;
}

function renderSourceChoice(config, { loadSample, apply, fetchPublic = null }) {
  const guide = guideForKind(config.kind);
  const source = document.createElement("div");
  source.className = "workflow-source-choice";

  const publicBlock = document.createElement("div");
  publicBlock.className = "workflow-source-option";
  const publicTitle = document.createElement("strong");
  publicTitle.textContent = "Use default public data";
  const publicText = document.createElement("p");
  publicText.textContent = guide.sample;
  publicBlock.append(publicTitle, publicText, loadSample);

  const ownBlock = document.createElement("div");
  ownBlock.className = "workflow-source-option";
  const ownTitle = document.createElement("strong");
  ownTitle.textContent = "Use my own data";
  const ownText = document.createElement("p");
  ownText.textContent =
    "Paste or upload matrices/rows in the data section below, then apply them here to preview shape, sample names, and format before running.";
  ownBlock.append(ownTitle, ownText, apply);

  source.append(publicBlock, ownBlock);

  if (fetchPublic) {
    const publicBlock = document.createElement("div");
    publicBlock.className = "workflow-source-option";
    const publicTitle = document.createElement("strong");
    publicTitle.textContent = "Fetch public spectra";
    const publicText = document.createElement("p");
    publicText.textContent =
      "For the public cohort workflow, you can also fetch a small mSigPortal cohort and inspect the same quality-check controls.";
    publicBlock.append(publicTitle, publicText, fetchPublic);
    source.append(publicBlock);
  }

  return source;
}

function textArea(placeholderText, rows = 8) {
  const node = document.createElement("textarea");
  node.placeholder = placeholderText;
  node.rows = rows;
  return node;
}

function input(value, type = "text", step = null) {
  const node = document.createElement("input");
  node.type = type;
  node.value = String(value);
  if (step !== null) node.step = String(step);
  if (type === "number") node.min = "0";
  return node;
}

function checkbox(label, checked = true) {
  const node = document.createElement("input");
  node.type = "checkbox";
  node.checked = checked;
  return field(label, node);
}

function fileInput(target) {
  const node = document.createElement("input");
  node.type = "file";
  node.accept = ".json,.txt,.tsv,.csv,.maf";
  node.addEventListener("change", async () => {
    if (node.files?.[0]) target.value = await readFileAsText(node.files[0]);
  });
  return node;
}

function select(options = []) {
  const node = document.createElement("select");
  for (const value of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    node.append(option);
  }
  return node;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read file."));
    reader.readAsText(file);
  });
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseThresholdGrid(value) {
  const parsed = String(value || "")
    .split(/[,\s]+/)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return parsed.length ? [...new Set(parsed)] : [0, 0.01, 0.03, 0.05, 0.1];
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    const next = text[i + 1];
    if (character === "\"" && quoted && next === "\"") {
      cell += "\"";
      i += 1;
    } else if (character === "\"") {
      quoted = !quoted;
    } else if ((character === "," || character === "\t") && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? ""]))
  );
}

function rowsToCsv(rows = []) {
  const data = Array.isArray(rows) ? rows : [];
  if (!data.length) return "";
  const headers = [...new Set(data.flatMap((row) => Object.keys(row || {})))];
  const escape = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
  };
  return [
    headers.join(","),
    ...data.map((row) => headers.map((header) => escape(row?.[header])).join(",")),
  ].join("\n");
}

function parseMetadata(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return normalizeMetadata(parsed);
    if (parsed && typeof parsed === "object") {
      return normalizeMetadata(Object.entries(parsed).map(([sample, fields]) => ({ sample, ...(fields || {}) })));
    }
  } catch (_error) {
    return normalizeMetadata(parseCsv(trimmed));
  }
  return [];
}

function normalizeMetadata(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...row,
      sample: row.sample || row.Sample || row.sample_id || row.sampleId || row.Tumor_Sample_Barcode || row.id,
    }))
    .filter((row) => row.sample);
}

function parseMatrix(mSigSDK, text, kind) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error(`${kind} input table is empty.`);
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch (_error) {
    // Try TSV after JSON.
  }
  return kind === "spectra"
    ? mSigSDK.io.importSigProfilerMatrix(trimmed)
    : mSigSDK.io.importCOSMICSignatureMatrix(trimmed);
}

function parseMafRows(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("MAF input is empty.");
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch (_error) {
    return parseCsv(trimmed);
  }
  return [];
}

function sumRecord(record = {}) {
  return Object.values(record || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function sampleRows(spectra = {}) {
  return Object.entries(spectra).map(([sample, record]) => ({
    sample,
    mutations: sumRecord(record),
    nonZeroContexts: Object.values(record || {}).filter((value) => Number(value) > 0).length,
  }));
}

function signatureRows(signatures = {}) {
  return Object.entries(signatures).map(([signature, record]) => ({
    signature,
    nonZeroContexts: Object.values(record || {}).filter((value) => Number(value) > 0).length,
    totalWeight: Number(sumRecord(record).toFixed(4)),
  }));
}

function warningRowList(warnings = []) {
  return (Array.isArray(warnings) ? warnings : []).map((warning) => ({
    code: warning.code || warning.warningCode || warning.status || "warning",
    message: warning.message || warning.detail || String(warning),
    resolution: warning.resolution || warning.recommendedAction || "",
  }));
}

function panelRows(result) {
  return Object.entries(result?.panel?.evidenceCalls || {}).flatMap(([sample, calls]) =>
    (calls || []).map((call) => ({
      sample,
      signature: call.signatureName,
      exposure: call.exposure,
      tier: call.tier,
      assessability: call.assessabilityClass,
      mutations: call.totalMutations,
      reasons: (call.assessabilityReasons || []).map((reason) => reason.detail || reason.code).join("; "),
    }))
  );
}

function renderDownloads(items) {
  const list = document.createElement("div");
  list.className = "download-list";
  for (const item of items) {
    const link = document.createElement("a");
    link.className = "download-link";
    link.download = item.filename;
    link.textContent = item.label || item.filename;
    const text = item.type === "json" ? JSON.stringify(item.value, null, 2) : item.text;
    link.href = URL.createObjectURL(new Blob([text || ""], { type: item.type === "json" ? "application/json" : "text/plain" }));
    list.append(link);
  }
  return list;
}

async function plotCard(grid, label, renderer, fallback = null, options = {}) {
  const section = document.createElement("section");
  section.className = "workflow-plot-section";
  const heading = document.createElement("h3");
  heading.textContent = label;
  const host = document.createElement("div");
  host.id = `interactive-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2)}`;
  host.className = "workflow-plot-host";
  section.append(heading, host);
  grid.append(section);
  try {
    await renderer(host, options.figureContext || options);
  } catch (error) {
    host.replaceChildren(fallback || placeholder(`Could not render ${label}: ${error.message}`));
  }
}

async function plotSampleCard(grid, label, samples, initialSample, renderer, fallback = null, help = "", options = {}) {
  const section = document.createElement("section");
  section.className = "workflow-plot-section";
  const heading = document.createElement("h3");
  heading.textContent = label;
  const controls = document.createElement("div");
  controls.className = "workflow-plot-controls";
  const sampleSelect = document.createElement("select");
  const sampleNames = samples.length ? samples : [initialSample].filter(Boolean);
  sampleSelect.replaceChildren(...sampleNames.map((sample) => {
    const option = document.createElement("option");
    option.value = sample;
    option.textContent = sample;
    return option;
  }));
  if (sampleNames.includes(initialSample)) sampleSelect.value = initialSample;
  controls.append(field("Sample shown", sampleSelect, help || "Change this to redraw the one-sample visual."));
  const status = document.createElement("p");
  status.className = "workflow-plot-sample-status";
  const host = document.createElement("div");
  host.id = `interactive-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2)}`;
  host.className = "workflow-plot-host";
  section.append(heading, controls, status, host);
  grid.append(section);

  async function render() {
    const sample = sampleSelect.value || initialSample;
    status.textContent = sample ? `Showing sample ${sample}.` : "Choose a sample to render this plot.";
    host.replaceChildren(placeholder(`Rendering ${label}${sample ? ` for ${sample}` : ""}...`));
    try {
      await renderer(host, sample, status, options.figureContext || options);
    } catch (error) {
      const fallbackNode = typeof fallback === "function" ? fallback(sample) : fallback;
      host.replaceChildren(fallbackNode || placeholder(`Could not render ${label}: ${error.message}`));
      status.textContent = `Could not render ${sample || "selected sample"}: ${error.message}`;
    }
  }

  sampleSelect.addEventListener("change", async () => {
    sampleSelect.disabled = true;
    try {
      await render();
    } finally {
      sampleSelect.disabled = false;
    }
  });
  await render();
}

function readCommonInputs(mSigSDK, controls, needs = {}) {
  const spectra = controls.spectraText
    ? parseMatrix(mSigSDK, controls.spectraText.value, "spectra")
    : null;
  const signatures = controls.signaturesText
    ? parseMatrix(mSigSDK, controls.signaturesText.value, "signatures")
    : null;
  const metadata = controls.metadataText ? parseMetadata(controls.metadataText.value) : [];
  if (needs.signatures && !signatures) throw new Error("Load or paste a signature catalog before running.");
  return { spectra, signatures, metadata };
}

function readParams(controls) {
  return {
    lowBurdenThreshold: parseNumber(controls.lowBurdenInput.value, 100),
    moderateBurdenThreshold: parseNumber(controls.moderateBurdenInput.value, 1000),
    exposureThreshold: parseNumber(controls.exposureThresholdInput.value, 0.01),
    thresholdGrid: parseThresholdGrid(controls.thresholdGridInput.value),
    bootstrapIterations: Math.max(5, Math.round(parseNumber(controls.bootstrapInput.value, 100))),
    bootstrapSeed: Math.round(parseNumber(controls.seedInput.value, 14)),
    groupKey: controls.groupKeyInput.value.trim() || "group",
    selectedSample: controls.sampleSelect.value,
    nmfRank: Math.max(1, Math.round(parseNumber(controls.nmfRankInput.value, 3))),
    nmfRuns: Math.max(1, Math.round(parseNumber(controls.nmfRunsInput.value, 3))),
    nmfIterations: Math.max(20, Math.round(parseNumber(controls.nmfIterationsInput.value, 140))),
    minAssessableMutations: Math.max(1, Math.round(parseNumber(controls.minAssessableInput.value, 30))),
    limitedSupportExposureThreshold: parseNumber(controls.limitedSupportInput.value, 0.05),
    higherSupportExposureThreshold: parseNumber(controls.higherSupportInput.value, 0.2),
    callableScale: parseNumber(controls.callableScaleInput.value, 1),
    genomeBuild: controls.genomeBuildInput.value.trim() || "GRCh37",
    mafGroupBy: controls.mafGroupByInput.value.trim() || "project_code",
  };
}

function updateSampleSelect(mSigSDK, controls) {
  let spectra = {};
  if (controls.spectraText?.value) {
    try {
      spectra = parseMatrix(mSigSDK, controls.spectraText.value, "spectra");
    } catch (_error) {
      spectra = {};
    }
  }
  const samples = Object.keys(spectra || {});
  controls.sampleSelect.replaceChildren(...samples.map((sample) => {
    const option = document.createElement("option");
    option.value = sample;
    option.textContent = sample;
    return option;
  }));
}

async function fillSampleData(mSigSDK, controls, kind) {
  if (kind === "maf") {
    const [mafData, signatureData] = await Promise.all([
      loadPublicMafRows(mSigSDK, { projects: ["TCGA-LUAD"], maxFiles: 1, maxVariants: 80 }),
      loadPublicSbs96Dataset(mSigSDK, { sampleLimit: 3 }),
    ]);
    if (controls.mafText) controls.mafText.value = rowsToCsv(mafData.rows);
    if (controls.signaturesText) controls.signaturesText.value = JSON.stringify(signatureData.signatures, null, 2);
    if (controls.mafGroupByInput) controls.mafGroupByInput.value = "sample";
  } else {
    const sampleLimit = kind === "panel" ? 3 : kind === "nmf" ? 6 : 8;
    const publicData = await loadPublicSbs96Dataset(mSigSDK, { sampleLimit });
    if (controls.spectraText) controls.spectraText.value = JSON.stringify(publicData.spectra, null, 2);
    if (controls.signaturesText) controls.signaturesText.value = JSON.stringify(publicData.signatures, null, 2);
    if (controls.metadataText) controls.metadataText.value = rowsToCsv(publicData.metadata);
  }
  updateSampleSelect(mSigSDK, controls);
  return kind;
}

async function fetchPublicCohort(mSigSDK, controls, status) {
  status.replaceChildren(placeholder("Fetching public PCAWG Lung-AdenoCA SBS96 spectra..."));
  const samples = ["SP53810", "SP55142", "SP55235", "SP54113", "SP50611", "SP50592"];
  const rows = (await mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData(
    "PCAWG",
    samples,
    "WGS",
    "Lung-AdenoCA",
    "SBS",
    96
  )).flat();
  const spectra = mSigSDK.mSigPortal.mSigPortalData.extractMutationalSpectra(rows);
  controls.spectraText.value = JSON.stringify(spectra, null, 2);
  if (controls.metadataText) {
    controls.metadataText.value = rowsToCsv(samples.map((sample) => ({
      sample,
      cohort: "Lung-AdenoCA",
      assay: "WGS",
      source: "mSigPortal",
    })));
  }
  updateSampleSelect(mSigSDK, controls);
  status.replaceChildren(placeholder(`Loaded ${Object.keys(spectra).length} public spectra.`));
}

function scaledCallableOpportunities(scale) {
  return Object.fromEntries(
    Object.entries(sharedCallableOpportunities()).map(([context, value]) => [
      context,
      Math.max(0, Number(value) * scale),
    ])
  );
}

async function runSpectraExplorer(app) {
  const { mSigSDK, controls, outputs, presentation } = app;
  const contexts = sbs96Contexts();
  const { spectra, metadata } = readCommonInputs(mSigSDK, controls);
  const params = readParams(controls);
  const validation = mSigSDK.validation.validateSpectra(spectra, {
    expectedContexts: contexts,
    minTotalMutations: params.lowBurdenThreshold,
  });
  const burden = mSigSDK.qc.summarizeMutationBurden(spectra, {
    expectedContexts: contexts,
    lowBurdenThresholdMode: "fixed",
    lowBurdenThreshold: params.lowBurdenThreshold,
    moderateBurdenThreshold: params.moderateBurdenThreshold,
  });
  const missingContexts = mSigSDK.qc.summarizeMissingContexts(spectra, { expectedContexts: contexts });
  outputs.summary.append(presentation.metrics([
    { label: "Samples", value: Object.keys(spectra).length },
    { label: "Validation", value: validation.valid ? "Pass" : "Review" },
    { label: "Low mutation-count samples", value: burden.overall.lowBurdenSampleCount },
    { label: "Context coverage", value: missingContexts.complete ? "Complete" : "Review" },
  ]));
  outputs.summary.append(presentation.table(presentation.burdenSampleRows(burden), undefined, { maxRows: 12 }));
  outputs.summary.append(presentation.table(metadata.length ? metadata : sampleRows(spectra), undefined, { maxRows: 12 }));
  outputs.summary.append(presentation.table((validation.issues || []).map((issue) => ({
    sample: issue.sample || "table",
    code: issue.code || issue.type || "issue",
    message: issue.message || String(issue),
  })), undefined, { maxRows: 10 }));
  await plotCard(outputs.plots, "Mutation count", (host) =>
    mSigSDK.qcPlots.plotMutationBurdenSummary(host, burden),
    presentation.table(presentation.burdenSampleRows(burden))
  );
  await plotCard(outputs.plots, "Cosine similarity", (host) =>
    mSigSDK.mSigPortal.mSigPortalPlots.plotCosineSimilarityHeatMap(
      spectra,
      "User data",
      "WGS",
      "SBS96 cohort",
      host,
      true,
      "Viridis",
      false
    )
  );
  outputs.exports.append(renderDownloads([
    { filename: "interactive_spectra.tsv", text: mSigSDK.io.exportSigProfilerMatrix(spectra, { contexts }), label: "Download spectra TSV" },
    { filename: "interactive_metadata.csv", text: rowsToCsv(metadata), label: "Download sample details CSV" },
    { filename: "interactive_cohort_qc.json", type: "json", value: { params, validation, burden, missingContexts }, label: "Download quality-check JSON" },
  ]));
}

async function runKnownFit(app, extra = {}) {
  const { mSigSDK, controls, outputs, presentation } = app;
  const contexts = sbs96Contexts();
  const { spectra, signatures, metadata } = readCommonInputs(mSigSDK, controls, { signatures: true });
  const params = readParams(controls);
  const analysis = await mSigSDK.workflows.runCohortFit(
    { spectra, signatures, metadata },
    {
      contexts,
      expectedContexts: contexts,
      groupKey: params.groupKey,
      exposureThreshold: params.exposureThreshold,
      lowBurdenThreshold: params.lowBurdenThreshold,
      moderateBurdenThreshold: params.moderateBurdenThreshold,
      thresholds: params.thresholdGrid,
      runThresholdSensitivity: true,
      runBootstrap: false,
      reportFormat: "object",
    }
  );
  const selectedSample = params.selectedSample || Object.keys(spectra)[0];
  const annotateBootstrap = (result, sample) => ({
    ...result,
    sample,
    sampleName: sample,
    inputSummary: {
      ...(result.inputSummary || {}),
      sample,
    },
  });
  const bootstrapBySample = {};
  async function bootstrapForSample(sample, status = null) {
    if (bootstrapBySample[sample]) return bootstrapBySample[sample];
    if (status) {
      status.textContent = `Running ${params.bootstrapIterations} bootstrap refits for ${sample}...`;
    }
    const result = await mSigSDK.qc.bootstrapSignatureFit(signatures, spectra[sample], {
      contexts,
      iterations: params.bootstrapIterations,
      seed: params.bootstrapSeed,
      exposureThreshold: params.exposureThreshold,
    });
    bootstrapBySample[sample] = annotateBootstrap(result, sample);
    return bootstrapBySample[sample];
  }
  const bootstrap = await bootstrapForSample(selectedSample);
  outputs.summary.append(presentation.metrics([
    { label: "Workflow", value: analysis.workflow },
    { label: "Samples", value: Object.keys(spectra).length },
    { label: "Warnings", value: analysis.warnings.length },
    { label: "Figures", value: analysis.publicationFigures.length },
    { label: "Bootstrap sample", value: selectedSample },
  ]));
  outputs.summary.append(presentation.table(presentation.exposureRows(analysis.fit.exposures, { minExposure: 0, topN: 24 }), undefined, { maxRows: 24 }));
  outputs.summary.append(presentation.table(presentation.reconstructionRows(analysis.fit.reconstructionError), undefined, { maxRows: 12 }));
  outputs.summary.append(presentation.fitQualityEvidenceTable(analysis.fitQualityEvidence, { maxRows: 12 }));
  outputs.summary.append(presentation.table(warningRowList(analysis.warnings), undefined, { maxRows: 12 }));
  await plotCard(outputs.plots, "Mutation count", (host) =>
    mSigSDK.qcPlots.plotMutationBurdenSummary(host, analysis.qc.mutationBurden)
  );
  await plotCard(outputs.plots, "Reconstruction error", (host) =>
    mSigSDK.qcPlots.plotReconstructionError(host, analysis.qc.reconstructionError)
  );
  await plotCard(outputs.plots, "Fit quality", (host) =>
    mSigSDK.qcPlots.plotFitQualityEvidenceDashboard(host, analysis.fitQualityEvidence)
  );
  await plotSampleCard(
    outputs.plots,
    "Residual spectrum",
    Object.keys(spectra),
    selectedSample,
    (host, sample) => mSigSDK.qcPlots.plotFitResiduals(host, analysis.residuals, sample),
    presentation.details("Residual object", analysis.residuals),
    "Redraws the observed-versus-reconstructed residual plot for one sample."
  );
  if (extra.includeUncertainty) {
    await plotSampleCard(
      outputs.plots,
      "Bootstrap intervals",
      Object.keys(spectra),
      selectedSample,
      async (host, sample, status) => {
        const sampleBootstrap = await bootstrapForSample(sample, status);
        await mSigSDK.qcPlots.plotBootstrapConfidenceIntervals(host, sampleBootstrap);
        status.textContent = `Showing bootstrap uncertainty for sample ${sample}.`;
      },
      (sample) => presentation.table(presentation.bootstrapRows(bootstrapBySample[sample] || bootstrap)),
      "Changing this runs or reuses bootstrap intervals for one sample."
    );
    await plotCard(outputs.plots, "Cutoff sensitivity", (host) =>
      mSigSDK.qcPlots.plotThresholdSensitivity(host, analysis.thresholdSensitivity),
      presentation.table(presentation.thresholdRows(analysis.thresholdSensitivity))
    );
  }
  if (extra.includePortability) {
    renderPortability(app, { spectra, signatures, analysis, params });
  }
  outputs.exports.append(renderDownloads([
    { filename: "interactive_spectra.tsv", text: mSigSDK.io.exportSigProfilerMatrix(spectra, { contexts }), label: "Download spectra TSV" },
    { filename: "interactive_signatures.tsv", text: mSigSDK.io.exportCOSMICSignatureMatrix(signatures, { contexts }), label: "Download signatures TSV" },
    { filename: "interactive_exposures.csv", text: rowsToCsv(presentation.exposureRows(analysis.fit.exposures, { minExposure: 0, topN: 1000 })), label: "Download signature contributions CSV" },
    { filename: "interactive_fit_report.json", type: "json", value: { params, analysis, bootstrap }, label: "Download fit report JSON" },
  ]));
  return { spectra, signatures, metadata, params, analysis, bootstrap };
}

function renderPortability(app, { spectra, signatures, analysis, params }) {
  const { mSigSDK, outputs, presentation } = app;
  const contexts = sbs96Contexts();
  const spectraTsv = mSigSDK.io.exportSigProfilerMatrix(spectra, { contexts });
  const signatureTsv = mSigSDK.io.exportCOSMICSignatureMatrix(signatures, { contexts });
  const spectraRoundTrip = mSigSDK.io.importSigProfilerMatrix(spectraTsv);
  const signatureRoundTrip = mSigSDK.io.importCOSMICSignatureMatrix(signatureTsv);
  const bundle = mSigSDK.adapters.createInteroperabilityBundle(
    { spectra, signatures },
    { contexts, include: ["sigProfilerAssignment", "deconstructSigs", "sigminer", "musical"] }
  );
  const provenance = mSigSDK.provenance.createProvenance({
    analysis: "interactive resource portability check",
    parameters: params,
    dataSources: [{ source: "browser user input", samples: Object.keys(spectra).length }],
  });
  outputs.summary.append(presentation.table([
    { check: "Spectra round trip samples", value: Object.keys(spectraRoundTrip).length },
    { check: "Signature round trip signatures", value: Object.keys(signatureRoundTrip).length },
    { check: "Long-form spectra rows", value: mSigSDK.io.spectraToRows(spectra).length },
    { check: "Tool export targets", value: Object.keys(bundle.tools || {}).length },
  ]));
  outputs.summary.append(presentation.table(Object.entries(bundle.tools || {}).map(([tool, value]) => ({
    tool,
    files: (value.files || value.input?.files || []).length,
    manifestFields: Object.keys(value.manifest || {}).length,
  }))));
  outputs.summary.append(presentation.details("Run record", provenance));
  outputs.exports.append(renderDownloads([
    { filename: "interactive_interoperability_bundle.json", type: "json", value: bundle, label: "Download tool export bundle JSON" },
    { filename: "interactive_provenance.json", type: "json", value: provenance, label: "Download run record JSON" },
    { filename: "interactive_report_fields.csv", text: rowsToCsv(presentation.reportFieldRows(analysis.report)), label: "Download report fields CSV" },
  ]));
}

async function runMafWorkflow(app) {
  const { mSigSDK, controls, outputs, presentation } = app;
  const contexts = sbs96Contexts();
  const signatures = parseMatrix(mSigSDK, controls.signaturesText.value, "signatures");
  const mafRows = parseMafRows(controls.mafText.value);
  const params = readParams(controls);
  const analysis = await mSigSDK.workflows.analyzeMafFiles(mafRows, signatures, {
    groupBy: params.mafGroupBy,
    genome: params.genomeBuild,
    offline: false,
    contextSource: "live UCSC genome sequence lookup for TCGA/GDC MAF rows",
    expectedContexts: contexts,
    reportFormat: "object",
    fitting: {
      exposureThreshold: params.exposureThreshold,
      exposureType: "relative",
      renormalize: true,
      mutationBurdenOptions: {
        lowBurdenThresholdMode: "fixed",
        lowBurdenThreshold: params.lowBurdenThreshold,
      },
    },
  });
  outputs.summary.append(presentation.metrics([
    { label: "MAF rows", value: mafRows.length },
    { label: "Samples", value: Object.keys(analysis.spectra || {}).length },
    { label: "Observed SBS96 counts", value: analysis.mafConversion?.observedSbs96Count },
    { label: "Count check", value: analysis.mafConversion?.sbs96CountMatchesConvertibleSnvCount ? "Pass" : "Review" },
  ]));
  outputs.summary.append(presentation.table(mafRows.slice(0, 12), undefined, { maxRows: 12 }));
  outputs.summary.append(presentation.table([
    { field: "Convertible SNV rows", value: analysis.mafConversion?.expectedConvertibleSnvCount },
    { field: "Observed SBS96 counts", value: analysis.mafConversion?.observedSbs96Count },
    { field: "Context source", value: analysis.mafConversion?.contextSource },
    { field: "Context lookup", value: analysis.mafConversion?.contextLookupMode },
  ]));
  outputs.summary.append(presentation.table(presentation.exposureRows(analysis.fit.exposures, { minExposure: 0, topN: 24 }), undefined, { maxRows: 24 }));
  outputs.summary.append(presentation.table(warningRowList(analysis.warnings), undefined, { maxRows: 12 }));
  await plotCard(outputs.plots, "Mutation count", (host) =>
    mSigSDK.qcPlots.plotMutationBurdenSummary(host, analysis.qc.mutationBurden)
  );
  const mafSampleNames = Object.keys(analysis.spectra || {});
  await plotSampleCard(
    outputs.plots,
    "Converted SBS96 profile",
    mafSampleNames,
    mafSampleNames[0],
    (host, sample) =>
      mSigSDK.qcPlots.plotCosmicSbs96Profile(host, analysis.spectra, {
        sample,
        contexts,
        title: "Converted SBS96 profile",
        subtitle:
          "COSMIC-style plot of the spectra created from the MAF rows. Mutation classes are grouped and colored so the pattern can be inspected without a crowded x-axis.",
      }),
    null,
    "Switch groups to redraw the COSMIC-style profile. Hover over bars for the full trinucleotide context and count."
  );
  outputs.exports.append(renderDownloads([
    { filename: "interactive_maf_rows.csv", text: rowsToCsv(mafRows), label: "Download MAF rows CSV" },
    { filename: "interactive_maf_spectra.tsv", text: mSigSDK.io.exportSigProfilerMatrix(analysis.spectra, { contexts }), label: "Download spectra TSV" },
    { filename: "interactive_maf_report.json", type: "json", value: { params, analysis }, label: "Download MAF report JSON" },
  ]));
}

async function runPanelWorkflow(app, includeCohort = false) {
  const { mSigSDK, controls, outputs, presentation } = app;
  const contexts = sbs96Contexts();
  const { spectra, signatures, metadata } = readCommonInputs(mSigSDK, controls, { signatures: true });
  const params = readParams(controls);
  if (includeCohort) {
    const cohort = await mSigSDK.workflows.runCohortFit(
      { spectra, signatures, metadata },
      {
        contexts,
        expectedContexts: contexts,
        groupKey: params.groupKey,
        exposureThreshold: params.exposureThreshold,
        lowBurdenThreshold: params.lowBurdenThreshold,
        thresholds: params.thresholdGrid,
        runThresholdSensitivity: true,
        reportFormat: "object",
      }
    );
    outputs.summary.append(presentation.metrics([
      { label: "Cohort warnings", value: cohort.warnings.length },
      { label: "Group comparison", value: cohort.groupComparison?.reportingMode || "not evaluated" },
      { label: "Cohort figures", value: cohort.publicationFigures.length },
    ]));
    outputs.summary.append(presentation.table(presentation.exposureRows(cohort.fit.exposures, { minExposure: 0, topN: 18 }), undefined, { maxRows: 18 }));
  }
  const panel = await mSigSDK.workflows.runPanelWorkflow(
    {
      spectra,
      signatures,
      callableOpportunities: scaledCallableOpportunities(params.callableScale),
    },
    {
      contexts,
      expectedContexts: contexts,
      runBootstrap: false,
      runThresholdSensitivity: false,
      minAssessableMutations: params.minAssessableMutations,
      limitedSupportExposureThreshold: params.limitedSupportExposureThreshold,
      higherSupportExposureThreshold: params.higherSupportExposureThreshold,
      lowBurdenThreshold: params.lowBurdenThreshold,
      opportunitySource: "user_supplied",
      genomeBuild: params.genomeBuild,
      reportFormat: "object",
    }
  );
  const rows = panelRows(panel);
  outputs.summary.append(presentation.metrics([
    { label: "Panel workflow", value: panel.workflow },
    { label: "Evidence calls", value: panel.panel?.evidenceSummary?.callCount },
    { label: "Coverage score", value: panel.opportunityMetadata?.opportunityCoverage },
    { label: "Warnings", value: panel.warnings.length },
  ]));
  outputs.summary.append(presentation.panelEvidenceTable(panel, { maxRows: 24 }));
  outputs.summary.append(presentation.table(panelValidationSummary, undefined, { maxRows: 8 }));
  outputs.summary.append(presentation.table(warningRowList(panel.warnings), undefined, { maxRows: 12 }));
  await plotCard(outputs.plots, "Panel evidence heatmap", (host) =>
    mSigSDK.qcPlots.plotPanelEvidenceMatrix(host, panel),
    presentation.panelEvidenceTable(panel)
  );
  outputs.exports.append(renderDownloads([
    { filename: "interactive_panel_evidence.csv", text: rowsToCsv(rows), label: "Download evidence calls CSV" },
    { filename: "interactive_panel_validation.csv", text: rowsToCsv(panelValidationSummary), label: "Download validation summary CSV" },
    { filename: "interactive_panel_report.json", type: "json", value: { params, panel }, label: "Download panel report JSON" },
  ]));
}

async function runNmfWorkflow(app) {
  const { mSigSDK, controls, outputs, presentation } = app;
  const contexts = sbs96Contexts();
  const { spectra, signatures } = readCommonInputs(mSigSDK, controls, { signatures: true });
  const params = readParams(controls);
  const result = mSigSDK.signatureExtraction.extractSignaturesNMF(spectra, {
    rank: params.nmfRank,
    nRuns: params.nmfRuns,
    maxIterations: params.nmfIterations,
    tolerance: 1e-5,
    seed: params.bootstrapSeed,
    contexts,
    signaturePrefix: "Interactive_NMF",
  });
  const matches = mSigSDK.signatureExtraction.compareExtractedToReference(result.signatures, signatures, {
    contexts,
    topN: 3,
  });
  const rankSelection = mSigSDK.signatureExtraction.selectNMFRank(spectra, {
    ranks: [...new Set([Math.max(1, params.nmfRank - 1), params.nmfRank, params.nmfRank + 1])],
    nRuns: Math.min(2, params.nmfRuns),
    maxIterations: Math.min(120, params.nmfIterations),
    seed: params.bootstrapSeed + 1,
    contexts,
  });
  outputs.summary.append(presentation.metrics([
    { label: "Rank", value: result.rank },
    { label: "Converged", value: result.converged ? "Yes" : "No" },
    { label: "Reconstruction error", value: presentation.formatNumber(result.reconstructionError) },
    { label: "Average sample cosine", value: presentation.formatNumber(result.averageSampleCosineSimilarity) },
  ]));
  outputs.summary.append(presentation.table(presentation.nmfMatchRows(matches, { maxRows: 12 }), undefined, { maxRows: 12 }));
  outputs.summary.append(presentation.details("Full discovery result", { result, matches, rankSelection }));
  await plotCard(outputs.plots, "Extracted signature profiles", (host) =>
    mSigSDK.signatureExtractionPlots.plotNMFSignatureProfiles(host, result)
  );
  await plotCard(outputs.plots, "Pattern contribution heatmap", (host) =>
    mSigSDK.signatureExtractionPlots.plotNMFExposureHeatmap(host, result, { relative: true })
  );
  await plotCard(outputs.plots, "Rank diagnostics", (host) =>
    mSigSDK.signatureExtractionPlots.plotNMFRankSelection(host, rankSelection)
  );
  const spectraMatrix = mSigSDK.io.exportSigProfilerMatrix(spectra, { contexts });
  outputs.exports.append(renderDownloads([
    { filename: "interactive_nmf_sbs96_spectra.tsv", text: spectraMatrix, label: "Download SBS96 spectra TSV" },
    { filename: "interactive_nmf_signatures.json", type: "json", value: result.signatures || {}, label: "Download extracted signatures JSON" },
    { filename: "interactive_nmf_exposures.json", type: "json", value: result.exposures || {}, label: "Download NMF exposures JSON" },
    { filename: "interactive_nmf_report.json", type: "json", value: { params, result, matches, rankSelection }, label: "Download discovery report JSON" },
  ]));
}

async function runEngineWorkflow(app) {
  const { mSigSDK, controls, outputs, presentation } = app;
  const contexts = sbs96Contexts();
  const { spectra, signatures } = readCommonInputs(mSigSDK, controls, { signatures: true });
  const params = readParams(controls);
  const standard = await mSigSDK.signatureFitting.fitMutationalSpectraToSignatures(signatures, spectra, {
    contexts,
    exposureThreshold: params.exposureThreshold,
    exposureType: "relative",
    renormalize: true,
    includeFitDetails: true,
  });
  let musicalPackage = null;
  let musicalStatus = "not evaluated";
  try {
    musicalPackage = await mSigSDK.adapters.musical.runRefit(
      { spectra, signatures, contexts },
      { runtime: "pyodide", threshold: params.exposureThreshold, renormalize: true }
    );
    musicalStatus = "exact package run completed";
  } catch (error) {
    musicalStatus = error?.message || "MuSiCal package artifact unavailable";
    musicalPackage = { exposures: {} };
  }
  const standardExposures = standard.exposures || standard || {};
  const musicalExposures = musicalPackage.exposures || {};
  const signaturesList = Object.keys(signatures);
  const comparisonRows = Object.keys(spectra).map((sample) => {
    const a = standardExposures[sample] || {};
    const b = musicalExposures[sample] || {};
    const dot = signaturesList.reduce((sum, sig) => sum + Number(a[sig] || 0) * Number(b[sig] || 0), 0);
    const normA = Math.sqrt(signaturesList.reduce((sum, sig) => sum + Number(a[sig] || 0) ** 2, 0));
    const normB = Math.sqrt(signaturesList.reduce((sum, sig) => sum + Number(b[sig] || 0) ** 2, 0));
    const top = (record) => Object.entries(record || {}).sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] || "NA";
    return {
      sample,
      cosine: normA && normB ? Number((dot / (normA * normB)).toFixed(4)) : null,
      msigsdkTop: top(a),
      musicalTop: top(b),
      review: top(a) === top(b) ? "Agreement" : "Review",
    };
  });
  const bundle = mSigSDK.adapters.createInteroperabilityBundle(
    { spectra, signatures },
    { contexts, include: ["sigProfilerAssignment", "deconstructSigs", "sigminer", "musical"] }
  );
  outputs.summary.append(presentation.metrics([
    { label: "Samples", value: Object.keys(spectra).length },
    { label: "Reference signatures", value: signaturesList.length },
    { label: "Cross-tool fixtures", value: crossToolSummary.length },
    { label: "Tool export targets", value: Object.keys(bundle.tools || {}).length },
    { label: "MuSiCal package adapter", value: musicalStatus },
  ]));
  outputs.summary.append(presentation.table(comparisonRows, undefined, { maxRows: 24 }));
  outputs.summary.append(presentation.table(crossToolSummary, undefined, { maxRows: 8 }));
  outputs.summary.append(presentation.table(Object.entries(bundle.tools || {}).map(([tool, value]) => ({
    tool,
    files: (value.files || value.input?.files || []).length,
    workflowStage: "Known-signature refit",
  }))));
  outputs.exports.append(renderDownloads([
    { filename: "interactive_engine_comparison.csv", text: rowsToCsv(comparisonRows), label: "Download comparison CSV" },
    { filename: "interactive_engine_handoff_bundle.json", type: "json", value: bundle, label: "Download tool export bundle JSON" },
    { filename: "interactive_engine_report.json", type: "json", value: { params, standardExposures, musicalExposures, musicalStatus, comparisonRows }, label: "Download tool comparison report JSON" },
  ]));
}

function buildControls(config) {
  const controls = {};
  controls.spectraText = textArea("Paste spectra JSON or SigProfiler-style TSV");
  controls.signaturesText = textArea("Paste signature JSON or COSMIC-style TSV");
  controls.metadataText = textArea("Optional sample details CSV/TSV/JSON", 5);
  controls.mafText = textArea("Paste MAF-like CSV/TSV/JSON rows", 7);
  controls.lowBurdenInput = input(100, "number", 10);
  controls.moderateBurdenInput = input(1000, "number", 50);
  controls.exposureThresholdInput = input(0.01, "number", 0.005);
  controls.thresholdGridInput = input("0, 0.01, 0.03, 0.05, 0.1");
  controls.bootstrapInput = input(100, "number", 10);
  controls.seedInput = input(14, "number", 1);
  controls.groupKeyInput = input("group");
  controls.sampleSelect = select([]);
  controls.nmfRankInput = input(3, "number", 1);
  controls.nmfRunsInput = input(3, "number", 1);
  controls.nmfIterationsInput = input(140, "number", 20);
  controls.minAssessableInput = input(30, "number", 5);
  controls.limitedSupportInput = input(0.05, "number", 0.01);
  controls.higherSupportInput = input(0.2, "number", 0.01);
  controls.callableScaleInput = input(1, "number", 0.1);
  controls.genomeBuildInput = input("GRCh37");
  controls.mafGroupByInput = input("project_code");
  return controls;
}

function appendDataControls(grid, controls, kind) {
  if (kind !== "maf") {
    grid.append(
      field("Spectra table", controls.spectraText, "JSON object or SigProfiler-style TSV."),
      field("Upload spectra", fileInput(controls.spectraText))
    );
  }
  if (["fit", "portability", "maf", "cohort-panel", "panel", "nmf", "uncertainty", "report", "engine"].includes(kind)) {
    grid.append(
      field("Signature catalog", controls.signaturesText, "JSON object or COSMIC-style TSV."),
      field("Upload signatures", fileInput(controls.signaturesText))
    );
  }
  if (["fit", "portability", "cohort-panel", "report", "spectra"].includes(kind)) {
    grid.append(
      field("Sample details", controls.metadataText, "Optional CSV/TSV/JSON with sample names."),
      field("Upload sample details", fileInput(controls.metadataText))
    );
  }
  if (kind === "maf") {
    grid.append(
      field("MAF rows", controls.mafText, "CSV/TSV/JSON with alleles, grouping field, and context."),
      field("Upload MAF", fileInput(controls.mafText))
    );
  }
}

function appendParameterControls(grid, controls, kind) {
  grid.append(
    field("Low mutation-count cutoff", controls.lowBurdenInput),
    field("Moderate mutation-count cutoff", controls.moderateBurdenInput)
  );
  if (["fit", "portability", "maf", "cohort-panel", "panel", "uncertainty", "report", "engine"].includes(kind)) {
    grid.append(
      field("Minimum signature contribution", controls.exposureThresholdInput),
      field("Contribution cutoffs to test", controls.thresholdGridInput, "Comma-separated relative cutoffs."),
      field("Sample group column", controls.groupKeyInput),
      field("Representative sample", controls.sampleSelect)
    );
  }
  if (["fit", "uncertainty", "report"].includes(kind)) {
    grid.append(field("Bootstrap iterations", controls.bootstrapInput), field("Bootstrap seed", controls.seedInput));
  }
  if (kind === "maf") {
    grid.append(field("MAF grouping field", controls.mafGroupByInput), field("Genome build", controls.genomeBuildInput));
  }
  if (kind === "panel" || kind === "cohort-panel") {
    grid.append(
      field("Minimum mutations to review", controls.minAssessableInput),
      field("Limited-support cutoff", controls.limitedSupportInput),
      field("Higher-support cutoff", controls.higherSupportInput),
      field("Panel/WES coverage scale", controls.callableScaleInput),
      field("Genome build", controls.genomeBuildInput)
    );
  }
  if (kind === "nmf") {
    grid.append(
      field("Number of patterns to extract", controls.nmfRankInput),
      field("Random starts", controls.nmfRunsInput),
      field("Max iterations", controls.nmfIterationsInput),
      field("Random seed", controls.seedInput)
    );
  }
}

function resetOutputs(outputs, message = "Ready.") {
  outputs.summary.replaceChildren(placeholder(message));
  outputs.plots.replaceChildren();
  outputs.exports.replaceChildren();
}

async function dispatchRun(app) {
  app.outputs.summary.replaceChildren();
  app.outputs.plots.replaceChildren();
  app.outputs.exports.replaceChildren();
  const kind = app.config.kind;
  if (kind === "spectra") return await runSpectraExplorer(app);
  if (kind === "fit") return await runKnownFit(app);
  if (kind === "portability") return await runKnownFit(app, { includePortability: true });
  if (kind === "maf") return await runMafWorkflow(app);
  if (kind === "cohort-panel") return await runPanelWorkflow(app, true);
  if (kind === "panel") return await runPanelWorkflow(app, false);
  if (kind === "nmf") return await runNmfWorkflow(app);
  if (kind === "uncertainty") return await runKnownFit(app, { includeUncertainty: true });
  if (kind === "report") return await runKnownFit(app, { includePortability: true, includeUncertainty: true });
  if (kind === "engine") return await runEngineWorkflow(app);
  return null;
}

export function renderInteractiveNotebook({ mode, mSigSDK, display }) {
  if (RETIRED_INTERACTIVE_MODES.has(mode)) {
    return;
  }

  const config = MODE_COPY[mode] || MODE_COPY["qc-walkthrough"];
  const presentation = mSigSDK.presentation;
  const root = document.createElement("section");
  root.id = `interactive-${mode}`;
  root.className = "workflow-panel";
  root.dataset.mode = mode;
  const header = document.createElement("div");
  header.className = "workflow-placeholder";
  header.innerHTML = `<strong>${config.title}</strong><br>${config.summary}`;
  const controls = buildControls(config);
  const loadSample = button("Load default public dataset", "primary");
  const fetchPublic = button("Fetch public mSigPortal spectra");
  const apply = button("Apply my pasted/uploaded data", "primary");
  const run = button("Run interactive workflow", "primary");
  const clear = button("Clear inputs and results");
  const sourceChoice = renderSourceChoice(config, {
    loadSample,
    apply,
    fetchPublic: mode === "public-cohort" ? fetchPublic : null,
  });
  const workflowActions = document.createElement("div");
  workflowActions.className = "workflow-button-row workflow-action-row";
  workflowActions.append(run, clear);
  const dataGrid = document.createElement("div");
  dataGrid.className = "workflow-control-grid";
  const parameterGrid = document.createElement("div");
  parameterGrid.className = "workflow-control-grid compact";
  const summary = document.createElement("div");
  summary.id = `interactive-${mode}-summary`;
  summary.className = "workflow-output-stack";
  summary.setAttribute("aria-live", "polite");
  const plots = document.createElement("div");
  plots.id = `interactive-${mode}-plots`;
  plots.className = "workflow-plot-grid";
  const exports = document.createElement("div");
  exports.id = `interactive-${mode}-exports`;
  exports.className = "workflow-output-stack";
  appendDataControls(dataGrid, controls, config.kind);
  appendParameterControls(parameterGrid, controls, config.kind);
  const app = { mSigSDK, controls, outputs: { summary, plots, exports }, presentation, config };
  loadSample.addEventListener("click", async () => {
    loadSample.disabled = true;
    resetOutputs(app.outputs, "Loading the default public dataset...");
    try {
      await fillSampleData(mSigSDK, controls, config.kind);
      resetOutputs(app.outputs, "Default public dataset loaded. Adjust settings, apply small local inputs instead, or run the workflow.");
    } catch (error) {
      resetOutputs(app.outputs, `Could not load the default public dataset: ${error.message}`);
    } finally {
      loadSample.disabled = false;
    }
  });
  fetchPublic.addEventListener("click", async () => {
    try {
      await fetchPublicCohort(mSigSDK, controls, summary);
    } catch (error) {
      summary.replaceChildren(placeholder(`Public fetch failed: ${error.message}. Paste your own spectra table or try the default public loader again.`));
    }
  });
  apply.addEventListener("click", () => {
    try {
      updateSampleSelect(mSigSDK, controls);
      const preview = config.kind === "maf"
        ? parseMafRows(controls.mafText.value).slice(0, 10)
        : sampleRows(parseMatrix(mSigSDK, controls.spectraText.value, "spectra"));
      summary.replaceChildren();
      summary.append(presentation.table(preview, undefined, { maxRows: 12 }));
      if (controls.signaturesText.value.trim()) {
        summary.append(presentation.table(signatureRows(parseMatrix(mSigSDK, controls.signaturesText.value, "signatures")), undefined, { maxRows: 8 }));
      }
    } catch (error) {
      summary.replaceChildren(placeholder(error.message));
    }
  });
  run.addEventListener("click", async () => {
    run.disabled = true;
    run.textContent = "Running...";
    summary.replaceChildren(placeholder("Running selected SDK workflow with the current data and settings."));
    plots.replaceChildren();
    exports.replaceChildren();
    try {
      await dispatchRun(app);
    } catch (error) {
      const pre = document.createElement("pre");
      pre.className = "output-error";
      pre.textContent = error.stack || error.message;
      summary.replaceChildren(pre);
    } finally {
      run.disabled = false;
      run.textContent = "Run interactive workflow";
    }
  });
  clear.addEventListener("click", () => {
    for (const key of ["spectraText", "signaturesText", "metadataText", "mafText"]) {
      if (controls[key]) controls[key].value = "";
    }
    controls.sampleSelect.replaceChildren();
    resetOutputs(app.outputs, "Inputs cleared.");
  });
  summary.append(placeholder("Choose a data source, adjust settings, then run."));
  root.append(header, renderDataGuide(config), sourceChoice, dataGrid, parameterGrid, workflowActions, summary, plots, exports);
  display(root);
}

export function renderInteractiveStep({
  mode,
  step = 1,
  phase = "analysis",
  title = "",
  mSigSDK,
  display,
}) {
  if (RETIRED_INTERACTIVE_MODES.has(mode)) {
    return;
  }

  const config = MODE_COPY[mode] || MODE_COPY["qc-walkthrough"];
  const phaseInfo = PHASE_COPY[phase] || PHASE_COPY.analysis;
  const presentation = mSigSDK.presentation;
  const root = document.createElement("section");
  root.id = `interactive-${mode}-step-${step}`;
  root.className = "workflow-panel workflow-step-lab";
  root.dataset.mode = mode;
  root.dataset.phase = phase;

  const header = document.createElement("div");
  header.className = "workflow-step-header";
  const heading = document.createElement("strong");
  const cleanTitle = String(title || "").replace(new RegExp(`^\\s*(?:Step\\s+)?${step}\\.\\s*`, "i"), "");
  heading.textContent = `Interactive Step ${step}${cleanTitle ? `: ${cleanTitle}` : ""}`;
  const description = document.createElement("span");
  description.textContent = phaseInfo.helper;
  header.append(heading, description);

  const controls = buildControls(config);

  const loadSample = button("Load default public dataset", "primary");
  const preview = button("Apply my pasted/uploaded data", "primary");
  const run = button(phaseInfo.action, "primary");
  const clear = button("Clear results");
  const sourceChoice = renderSourceChoice(config, { loadSample, apply: preview });
  const workflowActions = document.createElement("div");
  workflowActions.className = "workflow-button-row workflow-action-row";
  workflowActions.append(run, clear);

  const dataGrid = document.createElement("div");
  dataGrid.className = "workflow-control-grid";
  appendDataControls(dataGrid, controls, config.kind);
  const dataDetails = document.createElement("details");
  dataDetails.className = "workflow-step-details";
  dataDetails.open = phase === "data";
  const dataSummary = document.createElement("summary");
  dataSummary.textContent = "Paste or upload my own data";
  dataDetails.append(dataSummary, dataGrid);

  const parameterGrid = document.createElement("div");
  parameterGrid.className = "workflow-control-grid compact";
  appendParameterControls(parameterGrid, controls, config.kind);

  const outputs = {
    summary: document.createElement("div"),
    plots: document.createElement("div"),
    exports: document.createElement("div"),
  };
  outputs.summary.id = `interactive-${mode}-step-${step}-summary`;
  outputs.summary.className = "workflow-output-stack";
  outputs.summary.setAttribute("aria-live", "polite");
  outputs.plots.id = `interactive-${mode}-step-${step}-plots`;
  outputs.plots.className = "workflow-plot-grid";
  outputs.exports.id = `interactive-${mode}-step-${step}-exports`;
  outputs.exports.className = "workflow-output-stack";
  const app = { mSigSDK, controls, outputs, presentation, config };

  function previewInputs() {
    try {
      updateSampleSelect(mSigSDK, controls);
      outputs.summary.replaceChildren();
      outputs.plots.replaceChildren();
      outputs.exports.replaceChildren();
      if (config.kind === "maf") {
        outputs.summary.append(presentation.table(parseMafRows(controls.mafText.value).slice(0, 12), undefined, { maxRows: 12 }));
      } else {
        const spectra = parseMatrix(mSigSDK, controls.spectraText.value, "spectra");
        outputs.summary.append(presentation.table(sampleRows(spectra), undefined, { maxRows: 12 }));
        if (controls.signaturesText.value.trim()) {
          outputs.summary.append(presentation.table(signatureRows(parseMatrix(mSigSDK, controls.signaturesText.value, "signatures")), undefined, { maxRows: 8 }));
        }
      }
    } catch (error) {
      outputs.summary.replaceChildren(placeholder(error.message));
    }
  }

  loadSample.addEventListener("click", async () => {
    loadSample.disabled = true;
    resetOutputs(outputs, "Loading the default public dataset for this step...");
    try {
      await fillSampleData(mSigSDK, controls, config.kind);
      resetOutputs(outputs, "Default public dataset loaded for this step. Change any value, check the format, or run.");
    } catch (error) {
      resetOutputs(outputs, `Could not load the default public dataset: ${error.message}`);
    } finally {
      loadSample.disabled = false;
    }
  });
  preview.addEventListener("click", previewInputs);
  run.addEventListener("click", async () => {
    run.disabled = true;
    const originalText = run.textContent;
    run.textContent = "Running...";
    outputs.summary.replaceChildren(placeholder("Running this step with the current controls."));
    outputs.plots.replaceChildren();
    outputs.exports.replaceChildren();
    try {
      if (phase === "data" && config.kind === "spectra") {
        await runSpectraExplorer(app);
      } else {
        await dispatchRun(app);
      }
    } catch (error) {
      const pre = document.createElement("pre");
      pre.className = "output-error";
      pre.textContent = error.stack || error.message;
      outputs.summary.replaceChildren(pre);
    } finally {
      run.disabled = false;
      run.textContent = originalText;
    }
  });
  clear.addEventListener("click", () => resetOutputs(outputs, "Step output cleared."));

  resetOutputs(outputs, "Loading the default public dataset for this step...");
  fillSampleData(mSigSDK, controls, config.kind)
    .then(() => resetOutputs(outputs, "This step is ready with default public data. Review or edit settings, then run."))
    .catch((error) => resetOutputs(outputs, `Could not load the default public dataset: ${error.message}`));
  root.append(header, renderDataGuide(config), sourceChoice, dataDetails, parameterGrid, workflowActions, outputs.summary, outputs.plots, outputs.exports);
  display(root);
}

export function renderNotebookIndex({ display }) {
  const root = document.createElement("section");
  root.className = "workflow-panel notebook-index-panel";

  const intro = document.createElement("section");
  intro.className = "notebook-index-intro";
  const introTitle = document.createElement("h3");
  introTitle.textContent = "Find the workflow that matches your question";
  const introText = document.createElement("p");
  introText.textContent =
    "Each workflow handles one analysis job: finding data, preparing it, fitting or discovering signatures, checking reliability, or saving a report.";
  intro.append(introTitle, introText);

  const path = document.createElement("ol");
  path.className = "notebook-path";
  [
    ["First time here", "Start with the full workflow.", "msig-sdk-end-to-end-workflow.onb.html"],
    ["Have raw data", "Prepare spectra before fitting.", "msig-sdk-maf-fit-report.onb.html"],
    ["Have results", "Check quality before reporting.", "msig-sdk-qc-walkthrough.onb.html"],
  ].forEach(([label, copy, file]) => {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = label;
    const span = document.createElement("span");
    span.textContent = copy;
    const link = document.createElement("a");
    link.href = `?notebook=${file}`;
    link.textContent = "Open";
    item.append(strong, span, link);
    path.append(item);
  });

  const controls = document.createElement("div");
  controls.className = "workflow-control-grid compact notebook-index-controls";
  const goal = select([
    "All goals",
    ...NOTEBOOK_LINKS.map((entry) => entry.topic),
  ]);
  const filter = input("");
  filter.placeholder = "Try panel, report, raw variants, uncertainty";
  const output = document.createElement("div");
  output.className = "workflow-output-stack notebook-index-output";
  controls.append(
    field("I want to work on", goal, "Choose a topic, or leave this on all goals."),
    field("Search", filter, "Filter by everyday words or technical terms.")
  );

  function detail(label, text) {
    const node = document.createElement("div");
    node.className = "notebook-index-detail";
    const strong = document.createElement("strong");
    strong.textContent = label;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    node.append(strong, paragraph);
    return node;
  }

  function notebookCard(entry) {
    const card = document.createElement("article");
    card.className = "notebook-index-card";
    const top = document.createElement("div");
    top.className = "notebook-index-card-top";
    const topic = document.createElement("span");
    topic.className = "notebook-index-topic";
    topic.textContent = entry.topic;
    const phase = document.createElement("span");
    phase.className = "notebook-index-phase";
    phase.textContent = entry.phase;
    top.append(topic, phase);

    const heading = document.createElement("h3");
    const headingLink = document.createElement("a");
    headingLink.href = `?notebook=${entry.file}`;
    headingLink.textContent = entry.title;
    heading.append(headingLink);

    const summary = document.createElement("p");
    summary.className = "notebook-index-summary";
    summary.textContent = entry.summary;

    const details = document.createElement("div");
    details.className = "notebook-index-details";
    details.append(
      detail("Best when", entry.bestFor),
      detail("You will get", entry.result)
    );

    const action = document.createElement("a");
    action.className = "workflow-button primary notebook-index-action";
    action.href = `?notebook=${entry.file}`;
    action.textContent = "Open workflow";

    card.append(top, heading, summary, details, action);
    return card;
  }

  function render() {
    const query = filter.value.trim().toLowerCase();
    const selected = goal.value;
    const rows = NOTEBOOK_LINKS
      .filter((entry) => selected === "All goals" || entry.topic === selected)
      .filter((entry) =>
        !query ||
        `${entry.title} ${entry.file} ${entry.topic} ${entry.phase} ${entry.summary} ${entry.bestFor} ${entry.result}`
          .toLowerCase()
          .includes(query)
      );
    output.replaceChildren();
    const resultHeader = document.createElement("div");
    resultHeader.className = "notebook-index-results-header";
    const count = document.createElement("strong");
    count.textContent = `${rows.length} workflow${rows.length === 1 ? "" : "s"} found`;
    const hint = document.createElement("span");
    hint.textContent =
      rows.length === NOTEBOOK_LINKS.length
        ? "Scan the cards or narrow the list with the controls above."
        : "Open the card that matches your current question.";
    resultHeader.append(count, hint);
    output.append(resultHeader);

    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "notebook-index-empty";
      empty.textContent =
        "No workflow matches that filter. Try a broader word such as fit, data, panel, report, or uncertainty.";
      output.append(empty);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "notebook-index-grid";
    rows.forEach((entry) => grid.append(notebookCard(entry)));
    output.append(grid);
  }
  goal.addEventListener("change", render);
  filter.addEventListener("input", render);
  render();
  root.append(intro, path, controls, output);
  display(root);
}
