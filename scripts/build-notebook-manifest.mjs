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
  advanced: "Advanced",
};

const previewImages = {
  heroOverview: "images/notebook-previews/sdk-hero-overview.svg",
  workflowGuide: "images/notebook-previews/sdk-workflow-guide.svg",
  endToEnd: "images/notebook-previews/sdk-end-to-end-workflow.svg",
  publicCohort: "images/notebook-previews/sdk-public-cohort-explorer.svg",
  resourcePortability: "images/notebook-previews/sdk-resource-portability.svg",
  mafFitReport: "images/notebook-previews/sdk-maf-fit-report.svg",
  qcTriage: "images/notebook-previews/sdk-qc-triage.svg",
  cohortPanel: "images/notebook-previews/sdk-cohort-panel-workflow.svg",
  nmfExtraction: "images/notebook-previews/sdk-nmf-extraction.svg",
  uncertaintyCutoffs: "images/notebook-previews/sdk-uncertainty-cutoffs.svg",
  reportPacket: "images/notebook-previews/sdk-report-packet.svg",
  multiTool: "images/notebook-previews/sdk-multi-tool-comparison.svg",
};

const overrides = {
  "msig-sdk-notebooks.onb.html": {
    title: "Workflow guide",
    summary: "Find the notebook that matches the SDK task.",
    image: previewImages.workflowGuide,
    workflowGroup: "orientation",
    order: 0,
  },
  "msig-sdk-end-to-end-workflow.onb.html": {
    title: "End-to-end workflow",
    summary: "Inspect the complete fit-review-export arc on demo spectra.",
    image: previewImages.endToEnd,
    workflowGroup: "orientation",
    order: 4,
  },
  "msig-sdk-public-cohort-exploration.onb.html": {
    title: "Public cohort explorer",
    summary: "Inspect public mSigPortal spectra and TCGA/GDC MAF-derived examples in one SDK shape.",
    image: previewImages.publicCohort,
    workflowGroup: "orientation",
    order: 8,
  },
  "msig-sdk-resource-portability.onb.html": {
    title: "Resource portability",
    summary: "Learn the SBS96 format bridge around shared matrix conventions, exports, parser normalization, and round-trip checks.",
    image: previewImages.resourcePortability,
    workflowGroup: "input",
    order: 10,
  },
  "msig-sdk-qc-walkthrough.onb.html": {
    title: "Cohort QC triage",
    summary: "Review known-signature QC triage with sample burden, reconstruction, residuals, warnings, and next-step cues.",
    image: previewImages.qcTriage,
    workflowGroup: "core",
    order: 20,
  },
  "msig-sdk-maf-fit-report.onb.html": {
    title: "MAF to COSMIC profiles",
    summary: "Convert MAF rows into SBS96, SBS1536, DBS78, and ID83 matrices with profile-specific binning and audit checks.",
    image: previewImages.mafFitReport,
    workflowGroup: "input",
    order: 15,
  },
  "msig-sdk-cohort-panel-workflow.onb.html": {
    title: "Panel/WES assay planning",
    summary: "Plan whether a real WES or panel BED target retains enough evidence for selected signature review.",
    image: previewImages.cohortPanel,
    workflowGroup: "core",
    order: 28,
  },
  "msig-sdk-uncertainty-thresholds.onb.html": {
    title: "Uncertainty and cutoffs",
    summary: "Inspect fitted-signature uncertainty with bootstrap intervals and cutoff sweeps.",
    image: previewImages.uncertaintyCutoffs,
    workflowGroup: "reliability",
    order: 50,
  },
  "msig-sdk-nmf-extraction.onb.html": {
    title: "Discovery extraction (NMF)",
    summary: "Screen demo spectra with browser-scale NMF, rank checks, and external handoff files.",
    image: previewImages.nmfExtraction,
    workflowGroup: "core",
    order: 40,
  },
  "msig-sdk-multi-engine-comparison.onb.html": {
    title: "Multi-tool comparison",
    summary: "Compare fitting-engine outputs on identical demo spectra with compact concordance views.",
    image: previewImages.multiTool,
    workflowGroup: "reliability",
    order: 58,
  },
  "msig-sdk-export-report.onb.html": {
    title: "Report packet builder",
    summary: "Build a demo report archive with selected sections, provenance, audit checks, and downloads.",
    image: previewImages.reportPacket,
    workflowGroup: "reliability",
    order: 55,
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
      image: override.image || previewImages.workflowGuide,
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
