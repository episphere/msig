import {
  crossToolSummary,
  demoMafRows,
  demoMetadata,
  demoSignatures,
  demoSpectra,
  panelValidationSummary,
  sbs96Contexts,
  sharedCallableOpportunities,
} from "./msig-notebook-fixtures.js";

const MODE_COPY = {
  "public-cohort": {
    title: "Interactive public cohort explorer",
    summary:
      "Load sample or public mutation spectra, choose mutation-count cutoffs, check coverage, and compare samples before fitting signatures.",
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
    title: "Interactive data transfer check",
    summary:
      "Move spectra and signatures through common table formats, then verify that the same data can be used for fitting and reports.",
    kind: "portability",
  },
  "bring-your-own-spectra": {
    title: "Interactive bring-your-own spectra workflow",
    summary:
      "Paste or upload your own SBS96 mutation-count table, choose reference signatures, adjust cutoffs, and save a reusable report.",
    kind: "fit",
  },
  "maf-fit-report": {
    title: "Interactive MAF to report workflow",
    summary:
      "Paste or upload variant rows, choose grouping and context settings, convert them to SBS96 spectra, fit signatures, and review checks.",
    kind: "maf",
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
  experimental: {
    title: "Interactive experimental sandbox",
    summary:
      "Edit variant rows and early-stage clustering settings while keeping the limits and required follow-up visible.",
    kind: "experimental",
  },
};

const NOTEBOOK_LINKS = [
  ["End-to-end workflow", "msig-sdk-end-to-end-workflow.onb.html", "Full guided workflow"],
  ["Public cohort exploration", "msig-sdk-public-cohort-exploration.onb.html", "Input checks"],
  ["Known-signature quality check", "msig-sdk-qc-walkthrough.onb.html", "Validation and fitting"],
  ["Uncertainty and cutoffs", "msig-sdk-uncertainty-thresholds.onb.html", "Stability review"],
  ["Bring your own spectra", "msig-sdk-bring-your-own-spectra.onb.html", "Local data"],
  ["MAF to report", "msig-sdk-maf-fit-report.onb.html", "Variant rows"],
  ["Cohort and panel", "msig-sdk-cohort-panel-workflow.onb.html", "Sample groups and assays"],
  ["Panel evidence tiers", "msig-sdk-panel-evidence-tiers.onb.html", "Restricted assays"],
  ["Discovery extraction (NMF)", "msig-sdk-nmf-extraction.onb.html", "Discovery screening"],
  ["Export and reports", "msig-sdk-export-report.onb.html", "Saved outputs"],
  ["Resource portability", "msig-sdk-resource-portability.onb.html", "Round trips"],
  ["Multi-engine comparison", "msig-sdk-multi-engine-comparison.onb.html", "Cross-tool review"],
  ["Experimental sandbox", "msig-sdk-experimental-sandbox.onb.html", "Exploratory outputs"],
];

const PHASE_COPY = {
  overview: {
    action: "Run overview check",
    helper: "Confirm the demo data, SDK import, and key objects before entering the workflow.",
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
      "The built-in demo data contains four small SBS96 spectra with high, moderate, and low mutation-count examples plus sample labels. The counts are toy spectra created from a few signature-like context patterns so the tutorial is fast and predictable.",
    format:
      "Use a spectra JSON object keyed by sample, where each sample contains SBS96 context counts, or upload a SigProfiler-style TSV table. Sample details are optional CSV, TSV, or JSON with a sample column.",
    example: '{ "sample_1": { "A[C>A]A": 12, "T[C>T]T": 4 } }',
  },
  matrixFit: {
    sample:
      "The built-in demo data pairs four toy SBS96 spectra with three normalized toy signatures: smoking-like, clock-like, and APOBEC-like. It is synthetic tutorial data from the notebook fixtures, not a biological reference cohort.",
    format:
      "Spectra should be JSON or SigProfiler-style TSV. Signatures should be JSON or COSMIC-style TSV keyed by signature name and SBS96 context. Sample details are optional but should include a sample column when supplied.",
    example: '{ "SBS_demo_clock_like": { "T[C>T]T": 0.49, "A[C>T]G": 0.18 } }',
  },
  maf: {
    sample:
      "The built-in demo MAF has 150 synthetic SNV rows grouped as demo_tumor. It includes row-supplied trinucleotide contexts so the tutorial can run without live genome-sequence lookup.",
    format:
      "Provide CSV, TSV, or JSON rows with chromosome, start_position, reference_allele, tumor_seq_allele2, a grouping field such as project_code or Tumor_Sample_Barcode, and a context field when using offline mode.",
    example:
      "chromosome,start_position,reference_allele,tumor_seq_allele2,project_code,context",
  },
  panel: {
    sample:
      "The built-in panel demo uses the same toy SBS96 spectra and signatures, plus a synthetic coverage mask that hides or downweights selected contexts to mimic panel or WES data.",
    format:
      "Provide spectra and signatures as JSON or TSV. Coverage weights are context values from 0 to 1; this notebook exposes a scale control for the built-in mask.",
    example: '{ "T[C>T]A": 0.5, "T[C>G]A": 0.35, "G[C>G]G": 0 }',
  },
  nmf: {
    sample:
      "The built-in discovery demo uses the four toy SBS96 spectra and the three toy reference signatures only to label similar learned patterns after the run.",
    format:
      "Provide a spectra table with multiple samples and enough mutations for discovery. Reference signatures are optional for matching learned patterns to known signatures.",
    example: '{ "tumor_a": { "A[C>A]A": 420 }, "tumor_b": { "T[C>T]A": 165 } }',
  },
  experimental: {
    sample:
      "The built-in experimental demo uses five synthetic variants, four clustered on chromosome 1 and one distant variant on chromosome 2, to demonstrate localized-mutagenesis screening.",
    format:
      "Provide CSV, TSV, or JSON rows with chromosome, position, context, and an optional id. These exploratory outputs are not validated signature calls.",
    example: "chromosome,position,context,id",
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
  if (kind === "experimental") return DATA_GUIDES.experimental;
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
    "Start by choosing one source: load the synthetic built-in demo, or paste/upload your own data in the same shape and apply it before running.";

  const grid = document.createElement("div");
  grid.className = "workflow-data-guide-grid";
  const sampleBlock = document.createElement("div");
  const sampleTitle = document.createElement("span");
  sampleTitle.textContent = "Built-in demo data";
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

  const demoBlock = document.createElement("div");
  demoBlock.className = "workflow-source-option";
  const demoTitle = document.createElement("strong");
  demoTitle.textContent = "Use built-in demo data";
  const demoText = document.createElement("p");
  demoText.textContent = guide.sample;
  demoBlock.append(demoTitle, demoText, loadSample);

  const ownBlock = document.createElement("div");
  ownBlock.className = "workflow-source-option";
  const ownTitle = document.createElement("strong");
  ownTitle.textContent = "Use my own data";
  const ownText = document.createElement("p");
  ownText.textContent =
    "Paste or upload matrices/rows in the data section below, then apply them here to preview shape, sample names, and format before running.";
  ownBlock.append(ownTitle, ownText, apply);

  source.append(demoBlock, ownBlock);

  if (fetchPublic) {
    const publicBlock = document.createElement("div");
    publicBlock.className = "workflow-source-option";
    const publicTitle = document.createElement("strong");
    publicTitle.textContent = "Fetch public spectra";
    const publicText = document.createElement("p");
    publicText.textContent =
      "For the public cohort notebook, you can also fetch a small mSigPortal cohort and inspect the same quality-check controls.";
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

function fociRows(result) {
  return (result?.foci || result?.localized?.foci || []).map((focus, index) => ({
    focus: index + 1,
    chromosome: focus.chromosome,
    start: focus.start,
    end: focus.end,
    mutations: focus.mutationCount,
    contextPattern: focus.contextPattern,
    apobecLikeFraction: focus.apobecLikeFraction,
    clusterPValue: focus.clusterPValue,
  }));
}

function rainfallRows(result) {
  return (result?.rainfall || result?.localized?.rainfall || []).map((variant) => ({
    id: variant.id,
    chromosome: variant.chromosome,
    position: variant.position,
    previousDistance: variant.previousDistance,
    log10PreviousDistance: variant.log10PreviousDistance,
    context: variant.context,
  }));
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

async function plotCard(grid, label, renderer, fallback = null) {
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
    await renderer(host);
  } catch (error) {
    host.replaceChildren(fallback || placeholder(`Could not render ${label}: ${error.message}`));
  }
}

async function plotSampleCard(grid, label, samples, initialSample, renderer, fallback = null, help = "") {
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
      await renderer(host, sample, status);
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
    localizedMaxDistance: Math.max(1, Math.round(parseNumber(controls.localizedDistanceInput.value, 700))),
    localizedMinMutations: Math.max(1, Math.round(parseNumber(controls.localizedMinMutationsInput.value, 3))),
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

function fillSampleData(mSigSDK, controls, kind) {
  if (controls.spectraText) controls.spectraText.value = JSON.stringify(demoSpectra(), null, 2);
  if (controls.signaturesText) controls.signaturesText.value = JSON.stringify(demoSignatures(), null, 2);
  if (controls.metadataText) controls.metadataText.value = rowsToCsv(demoMetadata);
  if (controls.mafText) controls.mafText.value = rowsToCsv(demoMafRows);
  if (controls.variantText) controls.variantText.value = rowsToCsv(sampleLocalizedVariants());
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

function sampleLocalizedVariants() {
  return [
    { chromosome: "1", position: 1000, context: "T[C>T]A", id: "v1" },
    { chromosome: "1", position: 1450, context: "T[C>G]T", id: "v2" },
    { chromosome: "1", position: 1850, context: "T[C>T]T", id: "v3" },
    { chromosome: "1", position: 2300, context: "A[C>A]A", id: "v4" },
    { chromosome: "2", position: 900000, context: "G[C>A]A", id: "v5" },
  ];
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
    { contexts, include: ["sigProfilerAssignment", "sigProfilerExtractor", "deconstructSigs", "musical"] }
  );
  const provenance = mSigSDK.provenance.createProvenance({
    analysis: "interactive notebook portability check",
    parameters: params,
    dataSources: [{ source: "notebook user input", samples: Object.keys(spectra).length }],
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
    offline: true,
    contextSource: "row-supplied trinucleotide context field",
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
  await plotCard(outputs.plots, "Converted SBS96 spectrum", (host) =>
    mSigSDK.userData.plotPatientMutationalSpectrumuserData(analysis.spectra, 96, host)
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
      { label: "Group comparison", value: cohort.groupComparison?.reportingMode || "not run" },
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
  const handoff = mSigSDK.adapters.sigProfilerExtractor.prepareInput(
    { spectra },
    { contexts, minimumSignatures: 2, maximumSignatures: 6, nmfReplicates: 100 }
  );
  outputs.exports.append(renderDownloads([
    ...handoff.files.map((file) => ({
      filename: file.path.split("/").pop(),
      text: file.text,
      label: `Download ${file.path.split("/").pop()}`,
    })),
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
  let sparse = null;
  try {
    sparse = await mSigSDK.adapters.musical.runSparseNnlsRefit(
      { spectra, signatures, contexts },
      { threshold: params.exposureThreshold, renormalize: true }
    );
  } catch (_error) {
    sparse = { exposures: {} };
  }
  const standardExposures = standard.exposures || standard || {};
  const sparseExposures = sparse.exposures || {};
  const signaturesList = Object.keys(signatures);
  const comparisonRows = Object.keys(spectra).map((sample) => {
    const a = standardExposures[sample] || {};
    const b = sparseExposures[sample] || {};
    const dot = signaturesList.reduce((sum, sig) => sum + Number(a[sig] || 0) * Number(b[sig] || 0), 0);
    const normA = Math.sqrt(signaturesList.reduce((sum, sig) => sum + Number(a[sig] || 0) ** 2, 0));
    const normB = Math.sqrt(signaturesList.reduce((sum, sig) => sum + Number(b[sig] || 0) ** 2, 0));
    const top = (record) => Object.entries(record || {}).sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] || "NA";
    return {
      sample,
      cosine: normA && normB ? Number((dot / (normA * normB)).toFixed(4)) : null,
      msigsdkTop: top(a),
      sparseTop: top(b),
      review: top(a) === top(b) ? "Agreement" : "Review",
    };
  });
  const bundle = mSigSDK.adapters.createInteroperabilityBundle(
    { spectra, signatures },
    { contexts, include: ["sigProfilerAssignment", "sigProfilerExtractor", "deconstructSigs", "musical"] }
  );
  outputs.summary.append(presentation.metrics([
    { label: "Samples", value: Object.keys(spectra).length },
    { label: "Reference signatures", value: signaturesList.length },
    { label: "Cross-tool fixtures", value: crossToolSummary.length },
    { label: "Tool export targets", value: Object.keys(bundle.tools || {}).length },
  ]));
  outputs.summary.append(presentation.table(comparisonRows, undefined, { maxRows: 24 }));
  outputs.summary.append(presentation.table(crossToolSummary, undefined, { maxRows: 8 }));
  outputs.summary.append(presentation.table(Object.entries(bundle.tools || {}).map(([tool, value]) => ({
    tool,
    files: (value.files || value.input?.files || []).length,
    workflowStage: tool === "sigProfilerExtractor" ? "De novo extraction" : "Known-signature refit",
  }))));
  outputs.exports.append(renderDownloads([
    { filename: "interactive_engine_comparison.csv", text: rowsToCsv(comparisonRows), label: "Download comparison CSV" },
    { filename: "interactive_engine_handoff_bundle.json", type: "json", value: bundle, label: "Download tool export bundle JSON" },
    { filename: "interactive_engine_report.json", type: "json", value: { params, standardExposures, sparseExposures, comparisonRows }, label: "Download tool comparison report JSON" },
  ]));
}

async function runExperimentalWorkflow(app) {
  const { mSigSDK, controls, outputs, presentation } = app;
  const params = readParams(controls);
  const variants = parseMafRows(controls.variantText.value);
  const result = mSigSDK.experimental.runLocalizedMutagenesisAnalysis(
    variants,
    params.genomeBuild,
    {
      maxIntermutationDistance: params.localizedMaxDistance,
      minMutations: params.localizedMinMutations,
      minBurdenForLocalizedAnalysis: params.localizedMinMutations,
      clusterSignificanceThreshold: 0.05,
    }
  );
  const rainfall = rainfallRows(result);
  const foci = fociRows(result);
  outputs.summary.append(presentation.metrics([
    { label: "Workflow", value: result.workflow },
    { label: "Validated for manuscript use", value: result.experimentalStatus?.validatedForManuscriptUse ? "Yes" : "No" },
    { label: "Variants", value: result.validation?.variants?.variantCount || variants.length },
    { label: "Foci", value: foci.length },
  ]));
  outputs.summary.append(presentation.table(variants, undefined, { maxRows: 12 }));
  outputs.summary.append(presentation.table(foci, undefined, { maxRows: 12 }));
  outputs.summary.append(presentation.table(warningRowList(result.warnings), undefined, { maxRows: 12 }));
  outputs.summary.append(presentation.table((result.recommendedActions || []).map((action) => ({ action })), undefined, { maxRows: 12 }));
  outputs.exports.append(renderDownloads([
    { filename: "interactive_localized_rainfall.csv", text: rowsToCsv(rainfall), label: "Download rainfall CSV" },
    { filename: "interactive_localized_foci.csv", text: rowsToCsv(foci), label: "Download foci CSV" },
    { filename: "interactive_experimental_report.json", type: "json", value: { params, result }, label: "Download experimental report JSON" },
  ]));
}

function buildControls(config) {
  const controls = {};
  controls.spectraText = textArea("Paste spectra JSON or SigProfiler-style TSV");
  controls.signaturesText = textArea("Paste signature JSON or COSMIC-style TSV");
  controls.metadataText = textArea("Optional sample details CSV/TSV/JSON", 5);
  controls.mafText = textArea("Paste MAF-like CSV/TSV/JSON rows", 7);
  controls.variantText = textArea("Paste variant CSV/TSV/JSON rows", 7);
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
  controls.localizedDistanceInput = input(700, "number", 50);
  controls.localizedMinMutationsInput = input(3, "number", 1);
  return controls;
}

function appendDataControls(grid, controls, kind) {
  if (kind !== "maf" && kind !== "experimental") {
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
  if (kind === "experimental") {
    grid.append(
      field("Variant rows", controls.variantText, "CSV/TSV/JSON with chromosome, position, context, and id."),
      field("Upload variants", fileInput(controls.variantText))
    );
  }
}

function appendParameterControls(grid, controls, kind) {
  if (kind !== "experimental") {
    grid.append(
      field("Low mutation-count cutoff", controls.lowBurdenInput),
      field("Moderate mutation-count cutoff", controls.moderateBurdenInput)
    );
  }
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
      field("Number of patterns to learn", controls.nmfRankInput),
      field("Random starts", controls.nmfRunsInput),
      field("Max iterations", controls.nmfIterationsInput),
      field("Random seed", controls.seedInput)
    );
  }
  if (kind === "experimental") {
    grid.append(
      field("Genome build", controls.genomeBuildInput),
      field("Maximum distance between nearby variants", controls.localizedDistanceInput),
      field("Minimum clustered mutations", controls.localizedMinMutationsInput)
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
  if (kind === "experimental") return await runExperimentalWorkflow(app);
  return null;
}

export function renderInteractiveNotebook({ mode, mSigSDK, display }) {
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
  const loadSample = button("Load built-in demo data", "primary");
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
  loadSample.addEventListener("click", () => {
    fillSampleData(mSigSDK, controls, config.kind);
    resetOutputs(app.outputs, "Built-in demo data loaded. Adjust settings, apply your own data instead, or run the workflow.");
  });
  fetchPublic.addEventListener("click", async () => {
    try {
      await fetchPublicCohort(mSigSDK, controls, summary);
    } catch (error) {
      summary.replaceChildren(placeholder(`Public fetch failed: ${error.message}. Load the built-in demo data or paste your own spectra table.`));
    }
  });
  apply.addEventListener("click", () => {
    try {
      updateSampleSelect(mSigSDK, controls);
      const preview = config.kind === "maf"
        ? parseMafRows(controls.mafText.value).slice(0, 10)
        : config.kind === "experimental"
          ? parseMafRows(controls.variantText.value).slice(0, 10)
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
    for (const key of ["spectraText", "signaturesText", "metadataText", "mafText", "variantText"]) {
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
  heading.textContent = `Interactive step ${step}${title ? `: ${title}` : ""}`;
  const description = document.createElement("span");
  description.textContent = phaseInfo.helper;
  header.append(heading, description);

  const controls = buildControls(config);
  fillSampleData(mSigSDK, controls, config.kind);

  const loadSample = button("Load built-in demo data", "primary");
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
      } else if (config.kind === "experimental") {
        outputs.summary.append(presentation.table(parseMafRows(controls.variantText.value).slice(0, 12), undefined, { maxRows: 12 }));
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

  loadSample.addEventListener("click", () => {
    fillSampleData(mSigSDK, controls, config.kind);
    resetOutputs(outputs, "Built-in demo data loaded for this step. Change any value, check the format, or run.");
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

  resetOutputs(outputs, "This step is ready. Choose a data source, review or edit settings, then run.");
  root.append(header, renderDataGuide(config), sourceChoice, dataDetails, parameterGrid, workflowActions, outputs.summary, outputs.plots, outputs.exports);
  display(root);
}

export function renderNotebookIndex({ display }) {
  const root = document.createElement("section");
  root.className = "workflow-panel";
  const controls = document.createElement("div");
  controls.className = "workflow-control-grid compact";
  const goal = select(["Full workflow", "Input checks", "Validation and fitting", "Stability review", "Local data", "Variant rows", "Restricted assays", "Discovery screening", "Saved outputs", "Cross-tool review", "Exploratory outputs"]);
  const filter = input("");
  const output = document.createElement("div");
  output.className = "workflow-output-stack";
  controls.append(field("Learning goal", goal), field("Filter notebooks", filter, "Type any term, such as panel, MAF, discovery, export, or uncertainty."));
  function render() {
    const query = filter.value.trim().toLowerCase();
    const selected = goal.value;
    const rows = NOTEBOOK_LINKS
      .filter(([, , topic]) => selected === "Full workflow" || topic === selected || selected === topic)
      .filter(([title, file, topic]) => !query || `${title} ${file} ${topic}`.toLowerCase().includes(query))
      .map(([title, file, topic]) => ({ title, topic, open: `./viewer.html?notebook=${file}` }));
    output.replaceChildren();
    const table = document.createElement("table");
    table.className = "output-table";
    table.innerHTML = `<thead><tr><th>Notebook</th><th>Topic</th><th>Open</th></tr></thead>`;
    const body = document.createElement("tbody");
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${row.title}</td><td>${row.topic}</td><td><a href="${row.open}">Open notebook</a></td>`;
      body.append(tr);
    }
    table.append(body);
    output.append(table);
  }
  goal.addEventListener("change", render);
  filter.addEventListener("input", render);
  render();
  root.append(placeholder("Choose a learning goal, filter the notebook list, then open the interactive workflow."), controls, output);
  display(root);
}
