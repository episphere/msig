import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const notebooksDir = resolve(repoRoot, "notebooks");
const manifestPath = resolve(notebooksDir, "notebooks.json");

const workflowGroups = {
  orientation: "Orientation",
  input: "Load Data",
  core: "Analyze Data",
  reliability: "Review And Report",
  advanced: "Experimental",
};

const overrides = {
  "msig-sdk-notebooks.onb.html": {
    title: "Workflow guide",
    summary: "Choose the workflow that matches the next analysis question.",
    image: "images/mSigPortal.png",
    workflowGroup: "orientation",
    order: 0,
  },
  "msig-sdk-end-to-end-workflow.onb.html": {
    title: "End-to-end workflow",
    summary: "Run the complete fit-review-export arc and preserve the evidence that makes a result reportable.",
    image: "images/datasetSummary.png",
    workflowGroup: "orientation",
    order: 4,
  },
  "msig-sdk-public-cohort-exploration.onb.html": {
    title: "Public cohort explorer",
    summary: "Explore mSigPortal public spectra and TCGA/GDC MAF-derived datasets, load them into one SDK shape, visualize cohorts, and export inputs.",
    image: "images/CosineSimilarityHeatmap.png",
    workflowGroup: "orientation",
    order: 8,
  },
  "msig-sdk-resource-portability.onb.html": {
    title: "Resource portability",
    summary: "Prove that public resource data survive SDK table conversion, file export, reload, and handoff without losing metadata.",
    image: "images/mSigPortal.png",
    workflowGroup: "input",
    order: 10,
  },
  "msig-sdk-qc-walkthrough.onb.html": {
    title: "Known-signature quality check",
    summary: "Unpack mutation burden, reconstruction, residuals, warnings, and review steps behind a known-signature fit.",
    image: "images/Mutational%20Burden.png",
    workflowGroup: "core",
    order: 20,
  },
  "msig-sdk-maf-fit-report.onb.html": {
    title: "Variant rows to mutation patterns",
    summary: "Turn variant rows into a checked 96-bin mutation pattern by sorting DNA changes, checking counts, and saving the proof trail.",
    image: "images/Mutational%20Burden.png",
    workflowGroup: "input",
    order: 15,
  },
  "msig-sdk-cohort-panel-workflow.onb.html": {
    title: "Cohort and panel workflow",
    summary: "Connect cohort metadata, group interpretation, and restricted-assay limits in one applied workflow.",
    image: "images/datasetSummary.png",
    workflowGroup: "core",
    order: 28,
  },
  "msig-sdk-uncertainty-thresholds.onb.html": {
    title: "Uncertainty and cutoffs",
    summary: "Stress-test fitted signature calls with bootstrap intervals and reporting cutoff sweeps.",
    image: "images/CosineSimilarityHeatmap.png",
    workflowGroup: "reliability",
    order: 50,
  },
  "msig-sdk-nmf-extraction.onb.html": {
    title: "Discovery extraction (NMF)",
    summary: "Extract candidate signatures from spectra, inspect rank checks, and prepare production extraction files.",
    image: "images/signatureComparison.png",
    workflowGroup: "core",
    order: 40,
  },
  "msig-sdk-panel-evidence-tiers.onb.html": {
    title: "Panel/WES evidence review",
    summary: "Review panel/WES signature calls with assay coverage, mutation-count, and support-tier evidence.",
    image: "images/datasetSummary.png",
    workflowGroup: "core",
    order: 35,
  },
  "msig-sdk-multi-engine-comparison.onb.html": {
    title: "Multi-tool comparison",
    summary: "Compare fitting engines on identical spectra and inspect package-level and sample-level disagreements.",
    image: "images/signatureComparison.png",
    workflowGroup: "reliability",
    order: 58,
  },
  "msig-sdk-export-report.onb.html": {
    title: "Export and reports",
    summary: "Check round trips, required report fields, provenance, and run records needed to rerun or review an analysis.",
    image: "images/datasetSummary.png",
    workflowGroup: "reliability",
    order: 55,
  },
  "msig-sdk-experimental-sandbox.onb.html": {
    title: "Experimental sandbox",
    summary: "Expose experimental workflow status, warnings, limits, and validation requirements before any output is trusted.",
    image: "images/mSigPortal.png",
    workflowGroup: "advanced",
    order: 90,
  },
};

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html, file) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (match) {
    return cleanText(match[1]);
  }
  return file.replace(/\.onb\.html$/i, "").replace(/[-_]+/g, " ");
}

function extractSummary(html) {
  const markdownMatch = html.match(
    /<script[^>]*type=["']text\/markdown["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!markdownMatch) {
    return "";
  }

  const lines = markdownMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const summaryLine = lines.find((line) => !line.startsWith("#"));
  return cleanText(summaryLine).slice(0, 180);
}

async function buildNotebookManifest() {
  const files = (await readdir(notebooksDir))
    .filter((file) => file.endsWith(".onb.html"))
    .sort((left, right) => left.localeCompare(right));

  const notebooks = [];
  for (const file of files) {
    const html = await readFile(resolve(notebooksDir, file), "utf8");
    const override = overrides[file] || {};
    notebooks.push({
      file,
      title: override.title || extractTitle(html, file),
      summary:
        override.summary ||
        extractSummary(html) ||
        "Runnable mSigSDK workflow.",
      image: override.image || "images/mSigPortal.png",
      workflowGroup: override.workflowGroup || "advanced",
      workflowGroupLabel:
        workflowGroups[override.workflowGroup] || workflowGroups.advanced,
      order: Number.isFinite(override.order) ? override.order : 1000,
    });
  }

  notebooks.sort(
    (left, right) => left.order - right.order || left.title.localeCompare(right.title)
  );

  const manifest = {
    notebooks: notebooks.map(({ order, ...entry }) => entry),
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const manifest = await buildNotebookManifest();
  console.log(
    `Wrote notebooks/notebooks.json with ${manifest.notebooks.length} notebooks.`
  );
}

export { buildNotebookManifest };
