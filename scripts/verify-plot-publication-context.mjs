import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mainPath = resolve(repoRoot, "main.js");
const source = readFileSync(mainPath, "utf8");

const exportedPlots = [
  "plotProfilerSummary",
  "plotPatientMutationalSpectrum",
  "plotForceDirectedTree",
  "plotCosineSimilarityHeatMap",
  "plotUMAPVisualization",
  "plotProjectMutationalBurdenByCancerType",
  "plotSignatureActivityDataBy",
  "plotSignatureAssociations",
  "plotMSPrevalenceData",
  "plotPatientMutationalSpectrumuserData",
  "plotPatientMutationalSignaturesExposure",
  "plotDatasetMutationalSignaturesExposure",
  "plotMutationBurdenSummary",
  "plotReconstructionError",
  "plotFitQualityEvidenceDashboard",
  "plotCohortGroupComparison",
  "plotPanelEvidenceMatrix",
  "plotCosmicProfile",
  "plotCosmicSbs96Profile",
  "plotFitResiduals",
  "plotBootstrapExposureSummary",
  "plotThresholdSensitivitySummary",
  "plotBootstrapConfidenceIntervals",
  "plotThresholdSensitivity",
  "plotNMFSignatureProfiles",
  "plotNMFExposureHeatmap",
  "plotNMFRankSelection",
];

const requiredHelpers = [
  "normalizeFigurePublication",
  "renderFigureFooter",
  "figurePublicationPayload",
  "plotGraphWithPlotlyAndMakeDataDownloadable",
  "createD3PlotFrame",
  "addStandaloneJsonDownloadControls",
];

function functionBody(name) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, "m");
  const match = pattern.exec(source);
  if (!match) return null;
  let depth = 1;
  let index = match.index + match[0].length;
  while (index < source.length && depth > 0) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    index += 1;
  }
  return source.slice(match.index, index);
}

const errors = [];

for (const helper of requiredHelpers) {
  if (!source.includes(`function ${helper}`)) {
    errors.push(`Missing helper: ${helper}`);
  }
}

for (const plotName of exportedPlots) {
  const body = functionBody(plotName);
  if (!body) {
    errors.push(`Missing plot function: ${plotName}`);
    continue;
  }
  const hasPublicationPath =
    body.includes("createD3PlotFrame") ||
    body.includes("plotGraphWithPlotlyAndMakeDataDownloadable") ||
    body.includes("plotCosmicProfile") ||
    body.includes("plotCosmicSbs96Profile") ||
    body.includes("plotPatientMutationalSpectrumuserData") ||
    body.includes("plotThresholdSensitivitySummary") ||
    body.includes("addStandaloneJsonDownloadControls");
  if (!hasPublicationPath) {
    errors.push(`No publication-context path detected: ${plotName}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Verified publication-context paths for ${exportedPlots.length} public plot functions.`);
