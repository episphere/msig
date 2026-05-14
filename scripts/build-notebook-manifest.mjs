import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const notebooksDir = resolve(repoRoot, "notebooks");
const manifestPath = resolve(notebooksDir, "notebooks.json");

const workflowGroups = {
  orientation: "Orientation",
  input: "Input and resource setup",
  core: "Core analysis",
  reliability: "Reliability, reporting, and interoperability",
  advanced: "Advanced or experimental",
};

const overrides = {
  "msig-sdk-notebooks.onb.html": {
    title: "Notebook index",
    summary: "Start here for the SDK workflow map.",
    image: "images/mSigPortal.png",
    workflowGroup: "orientation",
    order: 0,
  },
  "msig-sdk-end-to-end-workflow.onb.html": {
    title: "End-to-end workflow",
    summary: "Follow one realistic analysis from input setup through QC, uncertainty, reports, and interoperability.",
    image: "images/datasetSummary.png",
    workflowGroup: "orientation",
    order: 4,
  },
  "msig-sdk-public-cohort-exploration.onb.html": {
    title: "Public cohort exploration",
    summary: "Fetch public spectra, review burden, and inspect similarity structure before fitting.",
    image: "images/CosineSimilarityHeatmap.png",
    workflowGroup: "orientation",
    order: 8,
  },
  "msig-sdk-resource-portability.onb.html": {
    title: "Resource portability",
    summary: "Bridge mSigPortal, TCGA/GDC, matrices, and exports.",
    image: "images/mSigPortal.png",
    workflowGroup: "input",
    order: 10,
  },
  "msig-sdk-bring-your-own-spectra.onb.html": {
    title: "Bring your own spectra",
    summary: "Start from a local SBS96 matrix, validate it, fit signatures, and export a reproducible report.",
    image: "images/Mutational%20Burden.png",
    workflowGroup: "input",
    order: 12,
  },
  "msig-sdk-qc-walkthrough.onb.html": {
    title: "Known-signature QC",
    summary: "Import, fetch, reshape, fit, and assess spectra.",
    image: "images/Mutational%20Burden.png",
    workflowGroup: "core",
    order: 20,
  },
  "msig-sdk-maf-fit-report.onb.html": {
    title: "MAF to report",
    summary: "Convert MAF rows, fit signatures, inspect QC, and render report-ready outputs.",
    image: "images/Mutational%20Burden.png",
    workflowGroup: "input",
    order: 15,
  },
  "msig-sdk-cohort-panel-workflow.onb.html": {
    title: "Cohort and panel workflow",
    summary: "Run cohort fitting and panel evidence review with metadata, assay territory, warnings, and report outputs.",
    image: "images/datasetSummary.png",
    workflowGroup: "core",
    order: 28,
  },
  "msig-sdk-uncertainty-thresholds.onb.html": {
    title: "Uncertainty thresholds",
    summary: "Quantify uncertainty and threshold dependence.",
    image: "images/CosineSimilarityHeatmap.png",
    workflowGroup: "reliability",
    order: 50,
  },
  "msig-sdk-nmf-extraction.onb.html": {
    title: "NMF extraction",
    summary: "Run exploratory extraction without fixed signatures.",
    image: "images/signatureComparison.png",
    workflowGroup: "core",
    order: 40,
  },
  "msig-sdk-panel-evidence-tiers.onb.html": {
    title: "Panel evidence tiers",
    summary: "Review panel and WES assessability, evidence tiers, and callable-territory limits.",
    image: "images/datasetSummary.png",
    workflowGroup: "core",
    order: 35,
  },
  "msig-sdk-multi-engine-comparison.onb.html": {
    title: "Multi-engine comparison",
    summary: "Run or import outputs from mSigSDK, SigProfilerAssignment, deconstructSigs, MuSiCal, and R nnls on one shared dataset.",
    image: "images/signatureComparison.png",
    workflowGroup: "reliability",
    order: 58,
  },
  "msig-sdk-export-report.onb.html": {
    title: "Export and reports",
    summary: "Round-trip matrices and create reproducible reports.",
    image: "images/datasetSummary.png",
    workflowGroup: "reliability",
    order: 55,
  },
  "msig-sdk-experimental-sandbox.onb.html": {
    title: "Experimental sandbox",
    summary: "Inspect explicitly experimental workflow outputs and scope statements.",
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
        "Runnable mSigSDK notebook.",
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
