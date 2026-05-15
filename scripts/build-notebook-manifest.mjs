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
    title: "Notebook index",
    summary: "Start here for the SDK workflow map.",
    image: "images/mSigPortal.png",
    workflowGroup: "orientation",
    order: 0,
  },
  "msig-sdk-end-to-end-workflow.onb.html": {
    title: "End-to-end workflow",
    summary: "Follow one realistic analysis from loading data to checks, plots, reports, and tool comparison files.",
    image: "images/datasetSummary.png",
    workflowGroup: "orientation",
    order: 4,
  },
  "msig-sdk-public-cohort-exploration.onb.html": {
    title: "Public cohort exploration",
    summary: "Load public mutation spectra, review mutation counts, and compare samples before fitting signatures.",
    image: "images/CosineSimilarityHeatmap.png",
    workflowGroup: "orientation",
    order: 8,
  },
  "msig-sdk-resource-portability.onb.html": {
    title: "Move data between resources",
    summary: "Move data between mSigPortal, TCGA/GDC, common table formats, and reports.",
    image: "images/mSigPortal.png",
    workflowGroup: "input",
    order: 10,
  },
  "msig-sdk-bring-your-own-spectra.onb.html": {
    title: "Bring your own spectra",
    summary: "Start from your own mutation-count table, check it, fit signatures, and save a report.",
    image: "images/Mutational%20Burden.png",
    workflowGroup: "input",
    order: 12,
  },
  "msig-sdk-qc-walkthrough.onb.html": {
    title: "Known-signature quality check",
    summary: "Load spectra, fit known signatures, and learn how to read the main quality checks.",
    image: "images/Mutational%20Burden.png",
    workflowGroup: "core",
    order: 20,
  },
  "msig-sdk-maf-fit-report.onb.html": {
    title: "MAF to report",
    summary: "Convert variant rows into mutation spectra, fit signatures, review checks, and save results.",
    image: "images/Mutational%20Burden.png",
    workflowGroup: "input",
    order: 15,
  },
  "msig-sdk-cohort-panel-workflow.onb.html": {
    title: "Cohort and panel workflow",
    summary: "Fit a cohort, compare sample groups, and review panel/WES limits with report outputs.",
    image: "images/datasetSummary.png",
    workflowGroup: "core",
    order: 28,
  },
  "msig-sdk-uncertainty-thresholds.onb.html": {
    title: "Uncertainty and cutoffs",
    summary: "See how signature estimates change when uncertainty and cutoffs are varied.",
    image: "images/CosineSimilarityHeatmap.png",
    workflowGroup: "reliability",
    order: 50,
  },
  "msig-sdk-nmf-extraction.onb.html": {
    title: "Discovery extraction (NMF)",
    summary: "Explore patterns in the data without choosing fixed reference signatures first.",
    image: "images/signatureComparison.png",
    workflowGroup: "core",
    order: 40,
  },
  "msig-sdk-panel-evidence-tiers.onb.html": {
    title: "Panel/WES evidence review",
    summary: "Review what panel or WES data can and cannot support before reporting signatures.",
    image: "images/datasetSummary.png",
    workflowGroup: "core",
    order: 35,
  },
  "msig-sdk-multi-engine-comparison.onb.html": {
    title: "Multi-tool comparison",
    summary: "Compare mSigSDK with SigProfilerAssignment, deconstructSigs, MuSiCal, and R nnls on the same data.",
    image: "images/signatureComparison.png",
    workflowGroup: "reliability",
    order: 58,
  },
  "msig-sdk-export-report.onb.html": {
    title: "Export and reports",
    summary: "Save the tables, checks, settings, and report files needed to rerun or review an analysis.",
    image: "images/datasetSummary.png",
    workflowGroup: "reliability",
    order: 55,
  },
  "msig-sdk-experimental-sandbox.onb.html": {
    title: "Experimental sandbox",
    summary: "Try early-stage exploratory outputs while keeping their limits visible.",
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
