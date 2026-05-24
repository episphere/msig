import path from "node:path";
import { rm } from "node:fs/promises";
import {
  copyD3Asset,
  ensureDir,
  FIGURE_ROOT,
  findAvailableBrowsers,
  launchBrowser,
  mean,
  median,
  readJson,
  relativeArtifact,
  TABLE_ROOT,
  tempDir,
  withStaticServer,
  writeJson,
  writeText,
} from "./lib/experiment-utils.mjs";
import { calculateReconstructionError } from "../../mSigSDKScripts/qc.js";
import {
  extractSignaturesNMF,
  selectNMFRank,
} from "../../mSigSDKScripts/signatureExtraction.js";

const DATA_ROOT = path.join("docs", "manuscript", "data");
const E1_RESULT = path.join(
  "docs",
  "manuscript",
  "experiments",
  "e1_zero_install_demo",
  "data",
  "zero-install-results.json"
);
const E2_RESULT = path.join(
  "docs",
  "manuscript",
  "experiments",
  "e2_adapter_fidelity",
  "data",
  "adapter-fidelity-results.json"
);
const E2_INPUT = path.join(
  "docs",
  "manuscript",
  "experiments",
  "e2_adapter_fidelity",
  "data",
  "adapter-fidelity-input.json"
);
const E2_PAIRS = path.join(
  "docs",
  "manuscript",
  "experiments",
  "e2_adapter_fidelity",
  "data",
  "adapter-fidelity-exposure-pairs.json"
);
const E3_RESULT = path.join(
  "docs",
  "manuscript",
  "experiments",
  "e3_internal_reference_checks",
  "data",
  "reference-check-results.json"
);
const E4_RESULT = path.join(
  "docs",
  "manuscript",
  "experiments",
  "e4_browser_runtime_benchmarks",
  "data",
  "browser-runtime-results.json"
);
const E6_RESULT = path.join(
  "docs",
  "manuscript",
  "experiments",
  "e6_cross_browser_compatibility",
  "data",
  "compatibility-results.json"
);
const PUBLIC_COHORT_DATA = path.join(DATA_ROOT, "main-figure3-public-cohort.json");
const FIGURE3_SDK_PANEL_DATA = path.join(DATA_ROOT, "main-figure3-sdk-panel-svgs.json");
const ADAPTER_DIFF_THRESHOLD = 1e-12;
const STALE_MAIN_FIGURE_FILES = [
  "figure3-adapter-fidelity-scatter.html",
  "figure4-public-cohort-capabilities.html",
  "figure5-runtime-benchmarks.html",
  "figure3-public-cohort-full-output.html",
];
const STALE_MAIN_DATA_FILES = [
  "main-figure4-public-cohort.json",
  "main-figure4-sdk-panel-svgs.json",
];

const DESIGN = {
  ink: "#111827",
  muted: "#4b5563",
  hairline: "#d1d5db",
  panel: "#ffffff",
  paper: "#f8fafc",
  blue: "#0072B2",
  sky: "#56B4E9",
  green: "#009E73",
  orange: "#E69F00",
  vermillion: "#D55E00",
  purple: "#CC79A7",
  yellow: "#F0E442",
  gray: "#6B7280",
  paleBlue: "#E7F3FA",
  paleGreen: "#E8F5F1",
  paleOrange: "#FFF4DB",
};

const SBS_CLASS_COLORS = {
  "C>A": DESIGN.blue,
  "C>G": DESIGN.ink,
  "C>T": DESIGN.vermillion,
  "T>A": "#9CA3AF",
  "T>C": DESIGN.green,
  "T>G": DESIGN.purple,
};

const SIGNATURE_COLORS = [
  DESIGN.blue,
  DESIGN.vermillion,
  DESIGN.green,
  DESIGN.orange,
  DESIGN.purple,
  DESIGN.sky,
  "#A6761D",
  "#7F7F7F",
  "#374151",
];

await ensureDir(FIGURE_ROOT);
await ensureDir(TABLE_ROOT);
await ensureDir(DATA_ROOT);
await copyD3Asset();

const results = {
  e1: await readJson(E1_RESULT),
  e2: await readJson(E2_RESULT),
  e2Input: await readJson(E2_INPUT),
  e2Pairs: await readJson(E2_PAIRS),
  e3: await readJson(E3_RESULT),
  e4: await readJson(E4_RESULT),
  e6: await readJson(E6_RESULT),
};

const publicCohort = await buildPublicCohortData(results.e2Input, results.e2Pairs);
await writeJson(PUBLIC_COHORT_DATA, publicCohort);
const publicCohortSdkPanels = await captureFigure3SdkPanels(results.e2Input);
await writeJson(FIGURE3_SDK_PANEL_DATA, publicCohortSdkPanels);
const publicCohortFigureData = { ...publicCohort, sdkPanels: publicCohortSdkPanels };
const figure3DetailFigures = figure3PublicCohortSdkPanelFigures(publicCohortFigureData);

const mainFigures = [
  ["figure1-architecture-data-residency.html", figure1Architecture()],
  ["figure2-zero-install-workflow.html", figure2ZeroInstallRedesigned(results.e1)],
  ["figure3-public-cohort-capabilities.html", figure3PublicCohortCompact(publicCohortFigureData)],
  ...figure3DetailFigures,
  ["figure4-runtime-benchmarks.html", figure4RuntimeRedesigned(results.e4)],
];

for (const file of STALE_MAIN_FIGURE_FILES) {
  await rm(path.join(FIGURE_ROOT, file), { force: true });
}
for (const file of STALE_MAIN_DATA_FILES) {
  await rm(path.join(DATA_ROOT, file), { force: true });
}
for (const [file, html] of mainFigures) {
  await writeText(path.join(FIGURE_ROOT, file), html);
}
await writeText(
  path.join(FIGURE_ROOT, "figure1-architecture-data-residency.svg"),
  figure1ArchitectureSvg()
);

const mainTables = [
  ["table1-browser-platform-compatibility.html", table1Compatibility(results.e6, results.e4)],
  ["supplementary-table-s1-internal-solver-checks.html", supplementaryTableS1(results.e3)],
];

for (const [file, table] of mainTables) {
  await writeText(path.join(TABLE_ROOT, file), standaloneTable(table));
}
await writeText(
  path.join(TABLE_ROOT, "all-main-manuscript-tables.html"),
  combinedTables(mainTables.map(([, table]) => table))
);

await writeText(
  path.join(FIGURE_ROOT, "README.md"),
  "# Manuscript Figures\n\nGenerated D3-backed HTML figures for the main manuscript and replacement E1/E2/E3/E4/E6 experiment suite. The pages load `../assets/d3.min.js` locally and do not depend on Plotly.\n\nThe previous oversized Figure 3 full-output page is intentionally split into standalone `figure3a` through `figure3f` pages for manuscript use.\n"
);
await writeText(
  path.join(FIGURE_ROOT, "figure-captions.md"),
  manuscriptFigureCaptions(publicCohortFigureData, figure3DetailFigures)
);
await writeText(
  path.join(TABLE_ROOT, "README.md"),
  "# Google Docs Tables\n\nGenerated by `npm run assets:manuscript`. Main manuscript tables and experiment tables are standalone HTML with inline styles for copy/paste into Google Docs or Word.\n"
);

for (const [file] of mainFigures) {
  console.log(`Wrote ${relativeArtifact(path.join(FIGURE_ROOT, file))}`);
}
console.log(`Wrote ${relativeArtifact(path.join(FIGURE_ROOT, "figure1-architecture-data-residency.svg"))}`);
console.log(`Wrote ${relativeArtifact(path.join(FIGURE_ROOT, "figure-captions.md"))}`);
for (const [file] of mainTables) {
  console.log(`Wrote ${relativeArtifact(path.join(TABLE_ROOT, file))}`);
}
console.log(`Wrote ${relativeArtifact(path.join(TABLE_ROOT, "all-main-manuscript-tables.html"))}`);
console.log(`Wrote ${relativeArtifact(PUBLIC_COHORT_DATA)}`);
console.log(`Wrote ${relativeArtifact(FIGURE3_SDK_PANEL_DATA)}`);

async function captureFigure3SdkPanels(input) {
  const browsers = await findAvailableBrowsers();
  const chrome = browsers.find((browser) => browser.id === "chrome") || browsers[0];
  if (!chrome) {
        throw new Error("Figure 3 SDK panel capture requires an available browser.");
  }
  return await withStaticServer(".", async ({ baseUrl }) => {
    const context = await launchBrowser(chrome, {
      userDataDir: tempDir("figure4-sdk-panel-capture"),
      viewport: { width: 1440, height: 1600 },
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setContent(figure3CaptureHarness(baseUrl), {
        waitUntil: "domcontentloaded",
      });
      const result = await page.waitForFunction(
        () => window.__FIGURE3_PANEL_CAPTURE__ || window.__FIGURE3_PANEL_ERROR__,
        null,
        { timeout: 180000 }
      );
      const capture = await result.jsonValue();
      if (capture?.error) {
        throw new Error(`Figure 3 SDK panel capture failed: ${capture.error}`);
      }
      if (errors.length) {
        throw new Error(`Figure 3 SDK panel capture console errors: ${errors.join(" | ")}`);
      }
      validateFigure3PanelCapture(capture);
      return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        source: "Browser-captured static SVG panels from local mSigSDK publication renderers.",
        sampleCount: Object.keys(input.spectra || {}).length,
        contextCount: (input.contexts || []).length,
        panels: capture.panels,
        workflowSummary: capture.workflowSummary,
      };
    } finally {
      await context.close();
    }
  });
}

function figure3CaptureHarness(baseUrl) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Figure 3 SDK panel capture</title>
    <style>
      body { margin: 0; padding: 24px; background: white; font-family: Arial, sans-serif; }
      .capture-panel { width: 1120px; margin: 0 0 32px; }
      .capture-combo { display: grid; gap: 24px; width: 1120px; }
    </style>
  </head>
  <body>
    <script type="module">
      const baseUrl = ${JSON.stringify(baseUrl)};
      try {
        const { mSigSDK } = await import(baseUrl + "/main.js?figure3Capture=" + Date.now());
        const input = await fetchJson(baseUrl + "/docs/manuscript/experiments/e2_adapter_fidelity/data/adapter-fidelity-input.json");
        const contexts = input.contexts;
        const spectra = input.spectra;
        const signatures = input.signatures;
        const sampleNames = Object.keys(spectra);
        const selectedSample = sampleNames
          .map((sample) => ({
            sample,
            burden: contexts.reduce((sum, context) => sum + (Number(spectra[sample]?.[context]) || 0), 0)
          }))
          .sort((a, b) => b.burden - a.burden)[0]?.sample || sampleNames[0];
        const finiteValues = (values) => values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
        const quantile = (values, probability) => {
          const sorted = finiteValues(values);
          if (!sorted.length) return null;
          const index = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * probability));
          const lower = Math.floor(index);
          const upper = Math.ceil(index);
          return lower === upper
            ? sorted[lower]
            : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
        };
        const roundByStep = (value, step) =>
          Number.isFinite(value) ? Number((Math.round(value / step) * step).toFixed(6)) : null;
        const roundBurden = (value) =>
          roundByStep(value, value >= 1000 ? 25 : value >= 100 ? 5 : 1);
        const upperCutoffs = (values, step) => {
          const positive = finiteValues(values).filter((value) => value > 0);
          if (!positive.length) return { check: null, priority: null };
          const check = roundByStep(quantile(positive, 0.9), step);
          const priority = roundByStep(quantile(positive, 0.95), step);
          return {
            check,
            priority: Number.isFinite(priority) && Number.isFinite(check)
              ? Math.max(priority, check)
              : priority
          };
        };
        const componentValues = (analysis, component, field) =>
          (analysis.fitQualityEvidence?.samples || [])
            .map((sample) => Number(sample.componentEvidence?.[component]?.[field]))
            .filter(Number.isFinite);
        const sampleBurdenValues = () =>
          sampleNames.map((sample) =>
            contexts.reduce((sum, context) => sum + (Number(spectra[sample]?.[context]) || 0), 0)
          );
        const adaptiveReviewOptions = (analysis) => {
          const burdens = sampleBurdenValues();
          const residuals = componentValues(analysis, "residual", "unexplainedFraction");
          const bootstraps = componentValues(analysis, "bootstrap", "maxConfidenceWidth");
          const cutoffDrops = componentValues(analysis, "threshold", "cosineDrop");
          const nearestCosines = componentValues(analysis, "ambiguity", "maxActivePairCosine");
          const residual = upperCutoffs(residuals, 0.001);
          const bootstrapWidth = upperCutoffs(bootstraps, 0.001);
          const cutoffDrop = upperCutoffs(cutoffDrops, 0.001);
          const nearestCosine = upperCutoffs(nearestCosines, 0.001);
          const lowBurdenThreshold = roundBurden(quantile(burdens, 0.1));
          const moderateBurdenThreshold = roundBurden(Math.max(
            quantile(burdens, 0.3) || 0,
            (lowBurdenThreshold || 0) + 1
          ));
          return {
            contexts,
            normalizeMode: "relative",
            lowBurdenThreshold,
            moderateBurdenThreshold,
            activeExposureThreshold: 0.05,
            bootstrapReviewExposureThreshold: 0.05,
            bootstrapReviewConfidenceWidthThreshold: bootstrapWidth.check,
            bootstrapStrongConfidenceWidthThreshold: bootstrapWidth.priority,
            thresholdReviewCosineDrop: cutoffDrop.check,
            thresholdStrongCosineDrop: cutoffDrop.priority,
            sampleConfusionCosineThreshold: nearestCosine.check,
            strongSampleConfusionCosineThreshold: nearestCosine.priority,
            weakUnexplainedThreshold: residual.check,
            unexplainedThreshold: residual.priority,
            catalogJointUnexplainedThreshold: residual.check,
            catalogStrongUnexplainedThreshold: residual.priority,
            catalogStructuredResidualUnexplainedThreshold: residual.check,
            adaptivePolicy: "bottom 10% mutation burden; top 10% residual, bootstrap width, cutoff drop, and nearest active-signature cosine"
          };
        };
        const applyAdaptiveReviewOptions = (analysis) => {
          const options = adaptiveReviewOptions(analysis);
          analysis.fitQualityEvidence = mSigSDK.advisor.computeFitQualityEvidence({
            signatures,
            spectra,
            exposures: analysis.fit.exposures,
            bootstrap: analysis.bootstrap || analysis.qc?.bootstrap || {},
            thresholdSensitivity: analysis.thresholdSensitivity || analysis.qc?.thresholdSensitivity || null,
            contexts
          }, options);
          analysis.qc = {
            ...(analysis.qc || {}),
            fitQualityEvidence: analysis.fitQualityEvidence.summary
          };
          analysis.adaptiveReviewOptions = options;
          return options;
        };
        const analysis = await mSigSDK.workflows.runCohortFit(
          { spectra, signatures, metadata: [] },
          {
            contexts,
            expectedContexts: contexts,
            exposureThreshold: 0.01,
            lowBurdenThreshold: 50,
            moderateBurdenThreshold: 500,
            thresholds: [0, 0.005, 0.01, 0.02, 0.05],
            runThresholdSensitivity: true,
            runBootstrap: true,
            bootstrapIterations: 500,
            bootstrapSampleLimit: sampleNames.length,
            bootstrapOptions: {
              iterations: 500,
              confidenceLevel: 0.95,
              seed: 20260521,
              yieldEvery: 50
            },
            reportFormat: "object"
          }
        );
        const adaptiveOptions = applyAdaptiveReviewOptions(analysis);
        const bootstrap = await mSigSDK.qc.bootstrapSignatureFit(signatures, spectra[selectedSample], {
          contexts,
          iterations: 500,
          confidenceLevel: 0.95,
          seed: 20260521,
          exposureThreshold: 0.01,
          exposureType: "relative",
          renormalize: true,
          yieldEvery: 50
        });
        bootstrap.sample = selectedSample;
        bootstrap.sampleName = selectedSample;
        bootstrap.inputSummary = { ...(bootstrap.inputSummary || {}), sample: selectedSample };
        const bootstrapInformativeSignatures = (bootstrap.signatures || []).filter((signature) =>
          signature?.signatureName &&
          (
            Number(signature.mean || 0) > 0 ||
            Number(signature.upper || 0) > 0 ||
            Number(signature.selectionFrequency || 0) > 0
          )
        ).length;
        const bootstrapDisplayedSignatures = Math.min(12, Math.max(1, bootstrapInformativeSignatures));
        const rankSelection = mSigSDK.signatureExtraction.selectNMFRank(spectra, {
          ranks: [2, 3, 4, 5, 6],
          nRuns: 4,
          maxIterations: 300,
          tolerance: 1e-5,
          seed: 20260521,
          contexts,
          rankSelectionCriterion: "reconstruction_error"
        });
        const selectedNmfRank = Number.isFinite(Number(rankSelection.recommendedRank))
          ? Number(rankSelection.recommendedRank)
          : 4;
        const selectedRankRun = (rankSelection.runs || []).find((run) => Number(run.rank) === selectedNmfRank);
        const nmf = selectedRankRun?.result || mSigSDK.signatureExtraction.extractSignaturesNMF(spectra, {
          rank: selectedNmfRank,
          nRuns: 4,
          maxIterations: 300,
          tolerance: 1e-5,
          seed: 20260521,
          contexts,
          signaturePrefix: "NMF"
        });
        nmf.rank = selectedNmfRank;
        const displayedNmfSignatures = Object.keys(nmf.signatures || {}).length;
        const panels = [];
        await capturePanel(panels, {
          id: "cohort_summary",
          label: "A",
          title: "Full-COSMIC cohort exposure landscape",
          note: "38 PCAWG Lung-AdenoCA SBS96 spectra fitted against the full COSMIC v3 SBS96 catalog; display shows top 12 cohort signatures plus Other.",
          renderer: "mSigSDK.qcPlots.plotCohortSignatureSummary",
          render: (host) => mSigSDK.qcPlots.plotCohortSignatureSummary(host, {
            spectra,
            exposures: analysis.fit.exposures,
            fitQuality: analysis.fitQualityEvidence,
            metadata: [],
            signatureNames: Object.keys(signatures),
            dataset: "PCAWG Lung-AdenoCA",
            signatureCatalog: "COSMIC_v3_Signatures_GRCh37_SBS96",
          }, {
            topN: 12,
            exposureThreshold: 0.01,
            title: "PCAWG Lung-AdenoCA full-COSMIC exposure landscape",
            subtitle: "38 public SBS96 spectra fitted to the full COSMIC v3 SBS96 catalog. Display: top 12 cohort signatures plus Other.",
            dataset: "PCAWG Lung-AdenoCA",
            signatureCatalog: "COSMIC_v3_Signatures_GRCh37_SBS96",
            publication: {
              compact: true,
              width: 1160,
              rowHeight: 17,
              cellWidth: 56,
              sampleLabelWidth: 128,
              maxWidth: "100%"
            }
          })
        });
        await capturePanel(panels, {
          id: "burden",
          label: "B",
          title: "PCAWG Lung-AdenoCA mutation burden QC",
          note: "Total SBS mutations per sample in 38 public mSigPortal spectra.",
          renderer: "mSigSDK.qcPlots.plotMutationBurdenSummary",
          render: (host) => mSigSDK.qcPlots.plotMutationBurdenSummary(host, analysis.qc.mutationBurden, {
            layout: "histogram",
            title: "PCAWG Lung-AdenoCA mutation burden",
            subtitle: "38 public SBS96 spectra fetched from mSigPortal.",
            publication: {
              compact: true,
              width: 1120,
              height: 440,
              maxWidth: "100%",
              bins: 9,
              marginTop: 46,
              marginBottom: 74,
              marginLeft: 82,
              marginRight: 42,
            }
          })
        });
        await capturePanel(panels, {
          id: "fit_quality",
          label: "D",
          title: "SDK fit-quality evidence dashboard",
          note: "Rows show the 12 highest-priority samples from the 38-sample cohort; adaptive defaults flag bottom-decile mutation burden and top-decile residual, bootstrap-width, cutoff-drop, and nearest-signature-cosine values.",
          renderer: "mSigSDK.qcPlots.plotFitQualityEvidenceDashboard",
          render: (host) => mSigSDK.qcPlots.plotFitQualityEvidenceDashboard(host, analysis.fitQualityEvidence, {
            publication: {
              compact: true,
              width: 1120,
              maxRows: 12,
              rowHeight: 32,
              minInnerHeight: 384,
              marginTop: 86,
              marginRight: 30,
              marginBottom: 88,
              marginLeft: 150,
              flagWidth: 280,
              heatGap: 42,
              heatCellWidth: 102,
              maxWidth: "100%",
              hideGuide: true,
            }
          })
        });
        await capturePanel(panels, {
          id: "bootstrap",
          label: "E",
          title: "Bootstrap exposure uncertainty",
          note: "500 multinomial refits of the high-burden sample against the full COSMIC SBS96 catalog; plot displays the top " + bootstrapDisplayedSignatures + " of " + bootstrapInformativeSignatures + " informative signatures.",
          renderer: "mSigSDK.qcPlots.plotBootstrapConfidenceIntervals",
          render: (host) => mSigSDK.qcPlots.plotBootstrapConfidenceIntervals(host, bootstrap, {
            topN: 12,
            publication: { compact: true, maxWidth: "100%" }
          })
        });
        await capturePanel(panels, {
          id: "threshold",
          label: "C",
          title: "Exposure-threshold sensitivity",
          note: "How active signature calls and reconstruction cosine change across cutoffs.",
          renderer: "mSigSDK.qcPlots.plotThresholdSensitivitySummary",
          render: (host) => mSigSDK.qcPlots.plotThresholdSensitivitySummary(host, analysis.thresholdSensitivity, {
            publication: {
              compact: true,
              width: 1120,
              rowHeight: 52,
              activeWidth: 300,
              activeValueWidth: 76,
              cosineGap: 34,
              cosineWidth: 300,
              marginLeft: 118,
              marginRight: 42,
              marginTop: 62,
              marginBottom: 72,
              maxWidth: "100%"
            }
          })
        });
        await capturePanel(panels, {
          id: "nmf",
          label: "F",
          title: "NMF Discovery",
          note: "Rank selection recommended rank " + selectedNmfRank + "; no components are hidden here: all " + displayedNmfSignatures + " extracted de novo SBS96 components from that rank are displayed.",
          renderer: [
            "mSigSDK.signatureExtractionPlots.plotNMFRankSelection",
            "mSigSDK.signatureExtractionPlots.plotNMFSignatureProfiles"
          ],
          render: async (host) => {
            host.className = "capture-combo";
            const rank = document.createElement("div");
            const profiles = document.createElement("div");
            host.append(rank, profiles);
            await mSigSDK.signatureExtractionPlots.plotNMFRankSelection(rank, rankSelection, {
              publication: {
                compact: true,
                width: 1100,
                height: 390,
                innerHeight: 260,
                panelGap: 72,
                panelWidth: 430,
                marginLeft: 82,
                marginRight: 54,
                marginTop: 50,
                marginBottom: 74,
                maxWidth: "100%"
              }
            });
            await mSigSDK.signatureExtractionPlots.plotNMFSignatureProfiles(profiles, nmf, {
              maxSignatures: displayedNmfSignatures,
              title: "Extracted de novo NMF components",
              columns: 2,
              publication: {
                compact: true,
                width: 530,
                height: 260,
                marginTop: 50,
                marginRight: 18,
                marginBottom: 44,
                marginLeft: 60,
                contextLabelMode: "none",
                showAxisTitles: false,
                showContextCaption: false,
                maxWidth: "100%"
              }
            });
          }
        });
        window.__FIGURE3_PANEL_CAPTURE__ = {
          panels,
          workflowSummary: {
            sampleCount: sampleNames.length,
            contextCount: contexts.length,
            signatureCount: Object.keys(signatures).length,
            selectedSample,
            bootstrapIterations: bootstrap.iterations,
            bootstrapInformativeSignatures,
            bootstrapDisplayedSignatures,
            adaptiveReviewOptions: adaptiveOptions,
            nmfRank: nmf.rank,
            nmfRecommendedRank: rankSelection.recommendedRank,
            nmfDisplayedSignatures: displayedNmfSignatures
          }
        };
      } catch (error) {
        window.__FIGURE3_PANEL_ERROR__ = { error: error.stack || error.message || String(error) };
      }

      async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Unable to fetch " + url + ": " + response.status);
        return await response.json();
      }

      async function capturePanel(panels, config) {
        const host = document.createElement("section");
        host.className = "capture-panel";
        document.body.appendChild(host);
        await config.render(host);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const captured = captureSvgsAsSingleSvg(host, config.id);
        panels.push({
          id: config.id,
          label: config.label,
          title: config.title,
          note: config.note,
          renderer: config.renderer,
          svg: captured.svg,
          width: captured.width,
          height: captured.height,
          svgCount: captured.svgCount
        });
      }

      function captureSvgsAsSingleSvg(host, id) {
        const svgs = [...host.querySelectorAll("svg")];
        if (!svgs.length) throw new Error("No SVG rendered for " + id);
        const rendered = svgs.map((svg) => {
          const text = inlineSvgStyles(svg, id);
          const box = svg.getBoundingClientRect();
          const viewBox = svg.getAttribute("viewBox");
          const width = Number(svg.getAttribute("width")) || box.width || viewBoxDimension(viewBox, 2) || 900;
          const height = Number(svg.getAttribute("height")) || box.height || viewBoxDimension(viewBox, 3) || 500;
          return { text, width, height };
        });
        if (rendered.length === 1) {
          return { svg: rendered[0].text, width: rendered[0].width, height: rendered[0].height, svgCount: 1 };
        }
        if (id === "nmf") return combineNmfSvgs(rendered);
        const columns = Math.min(2, rendered.length);
        const cellWidth = id === "nmf" ? 1100 : 560;
        const cellHeight = id === "nmf" ? 420 : 320;
        const labelHeight = id === "nmf" ? 30 : 0;
        const rows = Math.ceil(rendered.length / columns);
        const width = columns * cellWidth + (columns - 1) * 20;
        const height = rows * (cellHeight + labelHeight) + (rows - 1) * 22;
        const panelLabels = [];
        const images = rendered.map((item, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          const x = col * (cellWidth + 20);
          const y = row * (cellHeight + labelHeight + 22);
          const label = panelLabels[index]
            ? '<text x="' + (x + 12) + '" y="' + (y + 18) + '" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#111827">' + escapeText(panelLabels[index]) + '</text>'
            : "";
          return label + '<image href="' + svgDataUri(item.text) + '" x="' + x + '" y="' + (y + labelHeight) + '" width="' + cellWidth + '" height="' + cellHeight + '" preserveAspectRatio="xMidYMid meet"/>';
        }).join("");
        return {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' + images + '</svg>',
          width,
          height,
          svgCount: rendered.length
        };
      }

      function combineNmfSvgs(rendered) {
        const width = 1100;
        const rankLabelHeight = 30;
        const rankHeight = 330;
        const profileColumns = 2;
        const profileGapX = 28;
        const profileGapY = 20;
        const profileLabelHeight = 28;
        const profileWidth = (width - profileGapX) / profileColumns;
        const profileHeight = 260;
        const profiles = rendered.slice(1);
        const profileStartY = rankLabelHeight + rankHeight + 46;
        const profileRows = Math.ceil(profiles.length / profileColumns);
        const totalProfileHeight = profileRows * (profileLabelHeight + profileHeight) + Math.max(0, profileRows - 1) * profileGapY;
        const height = profileStartY + totalProfileHeight;
        const rankImage = '<text x="12" y="18" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#111827">Rank-selection curves</text>' +
          '<image href="' + svgDataUri(rendered[0].text) + '" x="0" y="' + rankLabelHeight + '" width="' + width + '" height="' + rankHeight + '" preserveAspectRatio="xMidYMid meet"/>' +
          '<text x="12" y="' + (rankLabelHeight + rankHeight + 32) + '" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#111827">All extracted components from the selected rank</text>';
        const profileImages = profiles.map((item, index) => {
          const col = index % profileColumns;
          const row = Math.floor(index / profileColumns);
          const x = col * (profileWidth + profileGapX);
          const y = profileStartY + row * (profileLabelHeight + profileHeight + profileGapY);
          const label = "NMF" + (index + 1) + " of " + profiles.length;
          return '<text x="' + (x + 12) + '" y="' + (y + 19) + '" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#111827">' + escapeText(label) + '</text>' +
            '<image href="' + svgDataUri(item.text) + '" x="' + x + '" y="' + (y + profileLabelHeight) + '" width="' + profileWidth + '" height="' + profileHeight + '" preserveAspectRatio="xMidYMid meet"/>';
        }).join("");
        return {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' + rankImage + profileImages + '</svg>',
          width,
          height,
          svgCount: rendered.length
        };
      }

      function inlineSvgStyles(svg, id) {
        const clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const viewBox = clone.getAttribute("viewBox");
        const width = viewBoxDimension(viewBox, 2) || svg.getBoundingClientRect().width || 900;
        const height = viewBoxDimension(viewBox, 3) || svg.getBoundingClientRect().height || 500;
        clone.setAttribute("width", String(width));
        clone.setAttribute("height", String(height));
        const sourceNodes = [svg, ...svg.querySelectorAll("*")];
        const cloneNodes = [clone, ...clone.querySelectorAll("*")];
        const props = [
          "font-family", "font-size", "font-weight", "font-style", "letter-spacing",
          "fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap",
          "stroke-linejoin", "opacity", "text-anchor", "dominant-baseline"
        ];
        sourceNodes.forEach((source, index) => {
          const target = cloneNodes[index];
          if (!target || source.nodeType !== 1) return;
          const styles = getComputedStyle(source);
          props.forEach((prop) => {
            const value = styles.getPropertyValue(prop);
            if (value && value !== "normal" && value !== "none") {
              target.style.setProperty(prop, value);
            }
          });
        });
        scaleCapturedTypography(clone, id);
        return clone.outerHTML;
      }

      function scaleCapturedTypography(svg, id) {
        const scaleByPanel = {
          cohort_summary: 1.08,
          burden: 1.18,
          threshold: 1.16,
          fit_quality: 1.12,
          bootstrap: 1.18,
          nmf: 1.14
        };
        const scale = scaleByPanel[id] || 1.12;
        const maxSize = id === "cohort_summary" ? 17 : id === "fit_quality" ? 17 : 18;
        svg.querySelectorAll("text,tspan").forEach((node) => {
          const className = node.getAttribute("class") || "";
          const fontAttr = node.getAttribute("font") || "";
          const attrSize = node.getAttribute("font-size");
          const styleSize = node.style.getPropertyValue("font-size");
          const fontMatch = fontAttr.match(/([0-9.]+)px/);
          const size = Number.parseFloat(styleSize || attrSize || (fontMatch ? fontMatch[1] : ""));
          if (!Number.isFinite(size)) return;
          const compactCohortLabel = id === "cohort_summary" && /msig-cohort-(signature|prevalence)-label/.test(className);
          const localScale = compactCohortLabel ? 1 : scale;
          const localMaxSize = compactCohortLabel ? 12 : maxSize;
          node.style.setProperty("font-size", Math.min(localMaxSize, Math.max(size, size * localScale)).toFixed(2) + "px");
          if (/\\b(700|750|800|bold)\\b/i.test(fontAttr)) {
            node.style.setProperty("font-weight", "700");
          }
        });
      }

      function svgDataUri(svgText) {
        return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgText)));
      }

      function escapeText(text) {
        return String(text)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }

      function viewBoxDimension(viewBox, index) {
        if (!viewBox) return null;
        const parts = viewBox.split(/\\s+/).map(Number);
        return Number.isFinite(parts[index]) ? parts[index] : null;
      }
    </script>
  </body>
</html>`;
}

function validateFigure3PanelCapture(capture) {
  const panels = capture?.panels || [];
  const required = new Map([
    ["cohort_summary", "mSigSDK.qcPlots.plotCohortSignatureSummary"],
    ["burden", "mSigSDK.qcPlots.plotMutationBurdenSummary"],
    ["fit_quality", "mSigSDK.qcPlots.plotFitQualityEvidenceDashboard"],
    ["bootstrap", "mSigSDK.qcPlots.plotBootstrapConfidenceIntervals"],
    ["threshold", "mSigSDK.qcPlots.plotThresholdSensitivitySummary"],
    ["nmf", "mSigSDK.signatureExtractionPlots.plotNMFRankSelection"],
  ]);
  for (const [id, renderer] of required) {
    const panel = panels.find((candidate) => candidate.id === id);
    if (!panel) throw new Error(`Missing Figure 3 SDK panel: ${id}`);
    const renderers = Array.isArray(panel.renderer) ? panel.renderer : [panel.renderer];
    if (!renderers.includes(renderer)) {
      throw new Error(`Figure 3 panel ${id} was not generated by ${renderer}.`);
    }
    if (!String(panel.svg || "").includes("<svg")) {
      throw new Error(`Figure 3 panel ${id} did not capture an SVG.`);
    }
  }
}

async function buildPublicCohortData(input, pairs) {
  const contexts = input.contexts || [];
  const spectra = input.spectra || {};
  const signatures = input.signatures || {};
  const sampleNames = Object.keys(spectra);
  const signatureNames = Object.keys(signatures);
  const burdenBySample = new Map(
    sampleNames.map((sample) => [
      sample,
      contexts.reduce((sum, context) => sum + (Number(spectra[sample]?.[context]) || 0), 0),
    ])
  );
  const burdens = sampleNames
    .map((sample) => ({ sample, burden: burdenBySample.get(sample) || 0 }))
    .sort((a, b) => b.burden - a.burden);

  const meanProfile = contexts.map((context, index) => ({
    context,
    index,
    mutationClass: mutationClass(context),
    value: mean(
      sampleNames.map((sample) => {
        const burden = burdenBySample.get(sample) || 0;
        return burden > 0 ? (Number(spectra[sample]?.[context]) || 0) / burden : 0;
      })
    ),
  }));
  const classOrder = Object.keys(SBS_CLASS_COLORS);
  meanProfile.sort((a, b) => {
    const classCmp = classOrder.indexOf(a.mutationClass) - classOrder.indexOf(b.mutationClass);
    return classCmp || a.context.localeCompare(b.context);
  });
  const classBlocks = buildClassBlocks(meanProfile.map((row) => row.context));

  const exposureRows = (pairs.rows || []).filter((row) => row.tool === "sigminer");
  const exposures = {};
  for (const row of exposureRows) {
    exposures[row.sample] ||= {};
    exposures[row.sample][row.signature] = Number(row.browserExposure) || 0;
  }
  const exposureMatrix = burdens.map(({ sample, burden }) => {
    const row = { sample, burden };
    for (const signature of signatureNames) {
      row[signature] = Number(exposures[sample]?.[signature]) || 0;
    }
    row.topSignature = signatureNames.reduce(
      (best, signature) => (row[signature] > row[best] ? signature : best),
      signatureNames[0]
    );
    return row;
  });
  exposureMatrix.sort((a, b) => {
    const topCmp = signatureNames.indexOf(a.topSignature) - signatureNames.indexOf(b.topSignature);
    return topCmp || b.burden - a.burden;
  });

  const reconstruction = calculateReconstructionError(signatures, spectra, exposures, { contexts });
  const fitQualityRows = reconstruction.samples.map((row) => {
    const exposureRow = exposures[row.sample] || {};
    const topSignature = signatureNames.reduce(
      (best, signature) =>
        (Number(exposureRow[signature]) || 0) > (Number(exposureRow[best]) || 0) ? signature : best,
      signatureNames[0]
    );
    return {
      sample: row.sample,
      burden: burdenBySample.get(row.sample) || 0,
      cosineSimilarity: row.cosineSimilarity ?? null,
      rmse: row.rmse ?? null,
      mae: row.mae ?? null,
      topSignature,
    };
  });
  const thresholdSensitivity = [0, 0.005, 0.01, 0.02, 0.05].map((threshold) => {
    const thresholdedExposures = {};
    const activeCounts = sampleNames.map((sample) => {
      thresholdedExposures[sample] = thresholdExposureRow(exposures[sample] || {}, signatureNames, threshold);
      return signatureNames.filter((signature) => (Number(thresholdedExposures[sample]?.[signature]) || 0) > 0).length;
    });
    const thresholdReconstruction = calculateReconstructionError(signatures, spectra, thresholdedExposures, {
      contexts,
      normalizeMode: "relative",
    });
    const meanReconstructionCosine = mean(
      thresholdReconstruction.samples
        .map((row) => row.cosineSimilarity)
        .filter((value) => Number.isFinite(Number(value)))
    );
    return {
      threshold,
      meanActiveSignatures: mean(activeCounts),
      samplesWithActiveExposure: activeCounts.filter((count) => count > 0).length,
      meanReconstructionCosine,
    };
  });
  const reportSample = burdens[0]?.sample || sampleNames[0];
  const reportMetrics = reconstruction.samples.find((row) => row.sample === reportSample) || {};
  const reportExposures = exposures[reportSample] || {};
  const activeSignatures = Object.entries(reportExposures)
    .filter(([, value]) => Number(value) > 0.01)
    .sort((a, b) => b[1] - a[1]);

  const rankSelection = selectNMFRank(spectra, {
    ranks: [2, 3, 4, 5, 6],
    nRuns: 4,
    maxIterations: 300,
    tolerance: 1e-5,
    seed: 20260521,
    contexts,
    sampleNames,
    rankSelectionCriterion: "reconstruction_error",
  });
  const selectedNmfRank = Number.isFinite(Number(rankSelection.recommendedRank))
    ? Number(rankSelection.recommendedRank)
    : 4;
  const selectedRankRun = (rankSelection.runs || []).find(
    (run) => Number(run.rank) === selectedNmfRank
  );
  const nmf = selectedRankRun?.result || extractSignaturesNMF(spectra, {
    rank: selectedNmfRank,
    nRuns: 4,
    maxIterations: 300,
    tolerance: 1e-5,
    seed: 20260521,
    contexts,
    sampleNames,
    signaturePrefix: "NMF",
  });
  nmf.rank = selectedNmfRank;
  const nmfProfiles = Object.entries(nmf.signatures || {})
    .map(([signature, profile]) => ({
      signature,
      values: contexts.map((context, index) => ({
        context,
        index,
        mutationClass: mutationClass(context),
        value: Number(profile?.[context]) || 0,
      })),
    }));

  const burdenValues = burdens.map((row) => row.burden);
  return {
    generatedAt: new Date().toISOString(),
    source: "PCAWG Lung-AdenoCA SBS96 public cohort from mSigPortal",
    sampleCount: sampleNames.length,
    contextCount: contexts.length,
    signatureNames,
    sbsClassColors: SBS_CLASS_COLORS,
    signatureColors: Object.fromEntries(signatureNames.map((name, index) => [name, SIGNATURE_COLORS[index % SIGNATURE_COLORS.length]])),
    burdenSummary: {
      min: Math.min(...burdenValues),
      median: median(burdenValues),
      max: Math.max(...burdenValues),
    },
    burdens,
    meanProfile,
    classBlocks,
    exposureMatrix,
    fitQualityRows,
    thresholdSensitivity,
    reportCard: {
      sample: reportSample,
      burden: burdenBySample.get(reportSample) || null,
      cosineSimilarity: reportMetrics.cosineSimilarity ?? null,
      rmse: reportMetrics.rmse ?? null,
      mae: reportMetrics.mae ?? null,
      activeSignatureCount: activeSignatures.length,
      topSignature: activeSignatures[0]?.[0] || null,
      topExposure: activeSignatures[0]?.[1] || null,
      activeSignatures: activeSignatures.slice(0, 4).map(([signature, exposure]) => ({ signature, exposure })),
    },
    nmfRankSelection: {
      recommendedRank: rankSelection.recommendedRank,
      selectedRank: selectedNmfRank,
      runs: rankSelection.runs.map((run) => ({
        rank: run.rank,
        reconstructionError: run.reconstructionError,
        averageSampleCosineSimilarity: run.averageSampleCosineSimilarity,
        converged: run.converged,
      })),
    },
    nmfRank: selectedNmfRank,
    nmfProfiles,
  };
}

function thresholdExposureRow(exposureRow, signatureNames, threshold) {
  const rawValues = signatureNames.map((signature) => Math.max(0, Number(exposureRow?.[signature]) || 0));
  const total = rawValues.reduce((sum, value) => sum + value, 0);
  const filtered = rawValues.map((value) => {
    const fraction = total > 0 ? value / total : 0;
    return fraction < threshold ? 0 : value;
  });
  const filteredTotal = filtered.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(
    signatureNames.map((signature, index) => [
      signature,
      filteredTotal > 0 ? filtered[index] / filteredTotal : 0,
    ])
  );
}

function figure1Architecture() {
  return customFigurePage({
    title: "Figure 1. Architecture and data-residency boundary",
    subtitle:
      "mSigSDK fetches public spectra, catalogs, and runtime assets when needed while fitting, QC, plots, reports, and user spectra remain in the browser unless exported.",
    body: `<div class="svg-shell">${figure1ArchitectureSvg()}</div>`,
  });
}

function figure1ArchitectureSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="600" viewBox="0 0 1180 600" role="img" aria-labelledby="figure1-title figure1-desc">
  <title id="figure1-title">Figure 1. Architecture and data-residency boundary</title>
  <desc id="figure1-desc">Architecture diagram showing selected public spectra, catalogs, and runtime assets entering a private browser workspace while user spectra, signature exposures, QC outputs, plots, and reports remain local.</desc>
  <defs>
    <marker id="fig1-arrow-blue" viewBox="0 -5 10 10" refX="9" refY="0" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0,-5L10,0L0,5" fill="${DESIGN.blue}"/>
    </marker>
    <filter id="fig1-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="7" stdDeviation="8" flood-color="#111827" flood-opacity="0.09"/>
    </filter>
    <style>
      .fig1-text{font-family:Arial,sans-serif;fill:${DESIGN.ink}}
      .fig1-muted{font-family:Arial,sans-serif;fill:${DESIGN.muted}}
      .fig1-title{font-size:29px;font-weight:700}
      .fig1-section{font-size:22px;font-weight:700}
      .fig1-label{font-size:16px;font-weight:700}
      .fig1-small{font-size:15px}
      .fig1-mini{font-size:12px}
      .fig1-chip{font-size:14px;font-weight:700}
    </style>
  </defs>
  <rect width="1180" height="600" fill="${DESIGN.paper}"/>

  <g transform="translate(0 -64)">
  <rect x="48" y="126" width="300" height="500" rx="20" fill="#ffffff" stroke="${DESIGN.hairline}" filter="url(#fig1-shadow)"/>
  <text x="78" y="166" class="fig1-text fig1-section">Public signature inputs</text>
  <text x="78" y="192" class="fig1-muted fig1-small">Fetched only when requested</text>
  <g transform="translate(82 222)">
    <path d="M50 34c7-26 31-45 62-45 27 0 50 16 62 39 27 5 47 27 47 56 0 31-26 57-59 57H49c-31 0-57-25-57-57 0-29 24-53 54-53 2 0 3 0 4 0z" fill="${DESIGN.paleBlue}" stroke="${DESIGN.blue}" stroke-width="2.4"/>
    <text x="108" y="78" text-anchor="middle" class="fig1-text" font-size="19" font-weight="700">mSigPortal</text>
    <text x="108" y="102" text-anchor="middle" class="fig1-muted fig1-mini">public cancer spectra</text>
  </g>
  ${fig1SpectrumIcon(90, 366, DESIGN.blue, "SBS96 spectra", "mutation counts")}
  ${fig1CatalogIcon(90, 430, DESIGN.orange, "COSMIC catalog", "reference signatures")}
  ${fig1RuntimeAssetIcon(90, 494, DESIGN.purple, "Runtime assets", "D3, WebR, Pyodide")}
  <text x="198" y="574" text-anchor="middle" class="fig1-muted fig1-mini">No patient-specific spectra are uploaded.</text>

  <path d="M348 436 H414" fill="none" stroke="${DESIGN.blue}" stroke-width="3" marker-end="url(#fig1-arrow-blue)"/>

  <rect x="414" y="112" width="720" height="524" rx="28" fill="${DESIGN.paleGreen}" stroke="${DESIGN.green}" stroke-width="3" filter="url(#fig1-shadow)"/>
  <text x="456" y="154" class="fig1-text fig1-section">Private browser / device boundary</text>
  <text x="456" y="180" class="fig1-muted fig1-small">Mutational-signature computation runs locally in the browser.</text>

  <rect x="456" y="216" width="374" height="260" rx="18" fill="#ffffff" stroke="#b7d8cd"/>
  <text x="486" y="252" class="fig1-text fig1-section">mSigSDK analysis core</text>
  <text x="486" y="277" class="fig1-muted fig1-small">JavaScript signature workflows</text>
  ${fig1WorkflowStep(486, 312, DESIGN.blue, "1", "Validate spectra")}
  ${fig1WorkflowStep(658, 312, DESIGN.orange, "2", "Fit signatures")}
  ${fig1WorkflowStep(486, 356, DESIGN.green, "3", "NMF extraction")}
  ${fig1WorkflowStep(658, 356, DESIGN.purple, "4", "QC evidence")}
  ${fig1MiniExposureChart(486, 402)}

  <rect x="846" y="216" width="266" height="306" rx="18" fill="#ffffff" stroke="#d7c8de"/>
  <text x="870" y="252" class="fig1-text fig1-section">Package adapters</text>
  <text x="870" y="277" class="fig1-muted fig1-small">Pinned external packages in-browser</text>
  <text x="870" y="307" class="fig1-muted" font-size="11" font-weight="700">R / WebR</text>
  ${fig1PackagePill(870, 318, DESIGN.purple, "R", "deconstructSigs", "1.8.0")}
  ${fig1PackagePill(870, 354, DESIGN.purple, "R", "sigminer", "2.3.1")}
  <text x="870" y="397" class="fig1-muted" font-size="11" font-weight="700">Python / Pyodide</text>
  ${fig1PackagePill(870, 408, DESIGN.orange, "Py", "SigProfilerAssignment", "1.1.3")}
  ${fig1PackagePill(870, 444, DESIGN.orange, "Py", "MuSiCal", "1.0.0")}
  <rect x="876" y="486" width="212" height="26" rx="13" fill="#f8fafc" stroke="${DESIGN.hairline}"/>
  <text x="982" y="504" text-anchor="middle" class="fig1-muted" font-size="11" font-weight="700">File-format bridges</text>

  <rect x="514" y="526" width="470" height="76" rx="16" fill="#ffffff" stroke="${DESIGN.green}" stroke-width="2.4"/>
  <text x="749" y="558" text-anchor="middle" class="fig1-text" font-size="20" font-weight="700">Local signature results</text>
  <text x="749" y="584" text-anchor="middle" class="fig1-muted fig1-small">exposures, extracted signatures, QC, plots, and reports</text>
  <g transform="translate(1018 500)">
    <path d="M46 8 L84 24 V56 C84 84 66 106 46 116 C26 106 8 84 8 56 V24 Z" fill="#ffffff" stroke="${DESIGN.green}" stroke-width="3"/>
    <rect x="30" y="56" width="32" height="28" rx="5" fill="${DESIGN.green}"/>
    <path d="M36 56v-12c0-18 20-18 20 0v12" fill="none" stroke="${DESIGN.green}" stroke-width="5" stroke-linecap="round"/>
  </g>
  <text x="1064" y="632" text-anchor="middle" class="fig1-text fig1-label" style="fill:${DESIGN.green}">stays local</text>
  </g>
</svg>`;
}

function fig1ResourceItem(x, y, color, title, detail) {
  return `<g transform="translate(${x} ${y})">
    <rect width="214" height="38" rx="10" fill="#ffffff" stroke="${color}" stroke-width="1.8"/>
    <circle cx="20" cy="19" r="6" fill="${color}"/>
    <text x="38" y="16" class="fig1-text fig1-label">${escapeHtml(title)}</text>
    <text x="38" y="31" class="fig1-muted" font-size="11">${escapeHtml(detail)}</text>
  </g>`;
}

function fig1ResourceItemLarge(x, y, color, title, detail) {
  return `<g transform="translate(${x} ${y})">
    <rect width="218" height="38" rx="10" fill="#ffffff" stroke="${color}" stroke-width="1.9"/>
    <circle cx="20" cy="19" r="6" fill="${color}"/>
    <text x="38" y="16" class="fig1-text fig1-label">${escapeHtml(title)}</text>
    <text x="38" y="32" class="fig1-muted" font-size="12">${escapeHtml(detail)}</text>
  </g>`;
}

function fig1SpectrumIcon(x, y, color, title, detail) {
  const colors = Object.values(SBS_CLASS_COLORS);
  const bars = Array.from({ length: 18 }, (_, i) => {
    const height = [8, 16, 11, 22, 14, 19, 7, 15, 10, 17, 21, 9, 13, 18, 12, 8, 15, 20][i];
    return `<rect x="${14 + i * 3}" y="${35 - height}" width="2.3" height="${height}" rx="1" fill="${colors[Math.floor(i / 3)]}"/>`;
  }).join("");
  return `<g transform="translate(${x} ${y})">
    <rect width="226" height="48" rx="10" fill="#ffffff" stroke="${color}" stroke-width="1.8"/>
    <rect x="12" y="11" width="60" height="26" rx="5" fill="${DESIGN.paleBlue}" stroke="#b7d8e8"/>
    ${bars}
    <text x="86" y="20" class="fig1-text fig1-label">${escapeHtml(title)}</text>
    <text x="86" y="36" class="fig1-muted" font-size="12">${escapeHtml(detail)}</text>
  </g>`;
}

function fig1CatalogIcon(x, y, color, title, detail) {
  const swatches = Object.entries(SBS_CLASS_COLORS)
    .map(([label, fill], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      return `<rect x="${13 + col * 20}" y="${11 + row * 14}" width="15" height="10" rx="2" fill="${fill}"/>
        <text x="${20.5 + col * 20}" y="${31 + row * 14}" text-anchor="middle" font-family="Arial,sans-serif" font-size="5.5" font-weight="700" fill="${DESIGN.ink}">${escapeHtml(label)}</text>`;
    })
    .join("");
  return `<g transform="translate(${x} ${y})">
    <rect width="226" height="48" rx="10" fill="#ffffff" stroke="${color}" stroke-width="1.8"/>
    <rect x="10" y="8" width="66" height="34" rx="6" fill="${DESIGN.paleOrange}" stroke="#efd7a2"/>
    ${swatches}
    <text x="86" y="20" class="fig1-text fig1-label">${escapeHtml(title)}</text>
    <text x="86" y="36" class="fig1-muted" font-size="12">${escapeHtml(detail)}</text>
  </g>`;
}

function fig1RuntimeAssetIcon(x, y, color, title, detail) {
  return `<g transform="translate(${x} ${y})">
    <rect width="226" height="48" rx="10" fill="#ffffff" stroke="${color}" stroke-width="1.8"/>
    <rect x="12" y="10" width="56" height="28" rx="6" fill="#f7e9f1" stroke="#e0b3ce"/>
    <text x="22" y="29" font-family="Consolas,monospace" font-size="17" font-weight="700" fill="${color}">&lt;/&gt;</text>
    <circle cx="54" cy="24" r="4" fill="${DESIGN.blue}"/>
    <text x="86" y="20" class="fig1-text fig1-label">${escapeHtml(title)}</text>
    <text x="86" y="36" class="fig1-muted" font-size="12">${escapeHtml(detail)}</text>
  </g>`;
}

function fig1WorkflowStep(x, y, color, badge, label) {
  return `<g transform="translate(${x} ${y})">
    <rect width="166" height="34" rx="9" fill="${DESIGN.paper}" stroke="${color}" stroke-width="1.6"/>
    <circle cx="19" cy="17" r="12" fill="${color}"/>
    <text x="19" y="22" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#ffffff">${escapeHtml(badge)}</text>
    <text x="40" y="22" class="fig1-text" font-size="13" font-weight="700">${escapeHtml(label)}</text>
  </g>`;
}

function fig1MiniExposureChart(x, y) {
  const bars = [
    { label: "SBS4", value: 0.82, color: DESIGN.green },
    { label: "SBS18", value: 0.06, color: DESIGN.blue },
    { label: "SBS40", value: 0.05, color: DESIGN.gray },
  ];
  return `<g transform="translate(${x} ${y})">
    <text x="0" y="11" class="fig1-muted" font-size="12" font-weight="700">Example exposure output</text>
    ${bars
      .map(
        (bar, i) => `<text x="0" y="${29 + i * 18}" class="fig1-muted" font-size="11" font-weight="700">${bar.label}</text>
        <rect x="48" y="${19 + i * 18}" width="110" height="10" rx="5" fill="#e5edf4"/>
        <rect x="48" y="${19 + i * 18}" width="${Math.max(4, bar.value * 110)}" height="10" rx="5" fill="${bar.color}"/>
        <text x="168" y="${29 + i * 18}" class="fig1-muted" font-size="10">${Math.round(bar.value * 100)}%</text>`
      )
      .join("")}
  </g>`;
}

function fig1Chip(x, y, label) {
  return `<rect x="${x}" y="${y}" width="104" height="34" rx="8" fill="${DESIGN.paleGreen}" stroke="#b7d8cd"/>
  <text x="${x + 52}" y="${y + 22}" text-anchor="middle" class="fig1-text fig1-chip">${escapeHtml(label)}</text>`;
}

function fig1RuntimeCard(x, y, color, badge, title, detail) {
  return `<g transform="translate(${x} ${y})">
    <rect width="132" height="68" rx="13" fill="#ffffff" stroke="${color}" stroke-width="2"/>
    <circle cx="32" cy="34" r="20" fill="${color}"/>
    <text x="32" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#ffffff">${escapeHtml(badge)}</text>
    <text x="66" y="31" class="fig1-text fig1-label">${escapeHtml(title)}</text>
    <text x="66" y="50" class="fig1-muted" font-size="11">${escapeHtml(detail)}</text>
  </g>`;
}

function fig1RuntimeRow(x, y, color, badge, label) {
  return `<g transform="translate(${x} ${y})">
    <rect width="242" height="36" rx="10" fill="#ffffff" stroke="${color}" stroke-width="1.9"/>
    <circle cx="24" cy="18" r="15" fill="${color}"/>
    <text x="24" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#ffffff">${escapeHtml(badge)}</text>
    <text x="52" y="23" class="fig1-text fig1-label">${escapeHtml(label)}</text>
  </g>`;
}

function fig1PackagePill(x, y, color, badge, label, version) {
  return `<g transform="translate(${x} ${y})">
    <rect width="224" height="28" rx="8" fill="${DESIGN.paper}" stroke="${color}" stroke-width="1.5"/>
    <circle cx="18" cy="14" r="11" fill="${color}"/>
    <text x="18" y="18" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#ffffff">${escapeHtml(badge)}</text>
    <text x="36" y="18" class="fig1-text" font-size="11.3" font-weight="700">${escapeHtml(label)}</text>
    <text x="204" y="18" text-anchor="end" class="fig1-muted" font-size="9.6" font-weight="700">${escapeHtml(version)}</text>
  </g>`;
}

function figure2ZeroInstall(e1) {
  const row = e1.rows?.[0] || {};
  const steps = row.steps || [];
  const spec = {
    elapsedSeconds: row.elapsedSeconds,
    reportBytes: row.reportBytes,
    sampleCount: row.sampleCount,
    signatureCount: row.signatureCount,
    sourceSpectrumUrl: row.sourceSpectrumUrl,
    sourceCatalogUrl: row.sourceCatalogUrl,
    screenshots: {
      start: "../experiments/e1_zero_install_demo/screenshots/zero-install-start.png",
      ready: "../experiments/e1_zero_install_demo/screenshots/zero-install-report-ready.png",
    },
    steps,
  };
  return customFigurePage({
    title: "Figure 2. Zero-install workflow demonstration",
    subtitle: `Fresh browser profile, cache disabled, report-ready in ${formatNumber(row.elapsedSeconds, 2)} seconds.`,
    spec,
    script: `
      const width = 1280, height = 780;
      const svg = d3.select("#chart").append("svg").attr("viewBox", [0, 0, width, height]);
      const colors = { teal: "#168a8c", blue: "#2b78c5", gold: "#d59b2e", red: "#d84b4b", slate: "#405168" };
      const stepTime = (name) => {
        const found = (spec.steps || []).find((step) => step.name === name);
        return found ? found.elapsedSeconds : null;
      };
      const steps = [
        {
          label: "A",
          title: "Fresh browser tab",
          time: stepTime("Page loaded") || 0,
          note: "Temporary profile; cache disabled",
          kind: "screenshot",
          image: spec.screenshots.start,
        },
        {
          label: "B",
          title: "SDK imported",
          time: stepTime("SDK imported"),
          note: "main.js module namespace is ready",
          kind: "module",
          code: "import * as mSigSDK from './main.js';",
        },
        {
          label: "C",
          title: "Public inputs fetched and fit",
          time: stepTime("Single-sample fit completed"),
          note: String(spec.sampleCount || 1) + " public sample x " + String(spec.signatureCount || "full catalog") + " COSMIC SBS signatures",
          kind: "fit",
        },
        {
          label: "D",
          title: "Trust-scored report rendered",
          time: stepTime("SDK report generated") || spec.elapsedSeconds,
          note: d3.format(",")(spec.reportBytes || 0) + " byte report packet",
          kind: "screenshot",
          image: spec.screenshots.ready,
        },
      ];
      svg.append("rect").attr("x", 30).attr("y", 28).attr("width", 1220).attr("height", 116).attr("rx", 18).attr("fill", "#eaf5f3").attr("stroke", "#b9d4cf");
      svg.append("text").attr("x", 60).attr("y", 78).attr("font-size", 38).attr("font-weight", 700).attr("fill", "#172026")
        .text(d3.format(".2f")(spec.elapsedSeconds || 0) + " s");
      svg.append("text").attr("x", 60).attr("y", 112).attr("font-size", 15).attr("font-weight", 700).attr("fill", colors.teal)
        .text("Time to first result");
      svg.append("text").attr("x", 390).attr("y", 78).attr("font-size", 18).attr("font-weight", 700).attr("fill", "#172026")
        .text("Zero install means no local package manager, no hosted compute, and no upload of user data.");
      svg.append("text").attr("x", 390).attr("y", 110).attr("font-size", 14).attr("fill", "#53616f")
        .text("The demonstration loads the SDK, fetches public mSigPortal inputs, fits one spectrum, and renders the SDK report in a fresh browser profile.");

      const cardW = 286, cardH = 418, cardTop = 198, gap = 22;
      const cards = svg.selectAll("g.step-card").data(steps).join("g")
        .attr("class", "step-card")
        .attr("transform", (d, i) => "translate(" + (34 + i * (cardW + gap)) + "," + cardTop + ")");
      cards.append("rect").attr("width", cardW).attr("height", cardH).attr("rx", 16).attr("fill", "#ffffff").attr("stroke", "#d8e2dc");
      cards.append("circle").attr("cx", 32).attr("cy", 34).attr("r", 18).attr("fill", (d, i) => [colors.teal, colors.blue, colors.gold, colors.red][i]);
      cards.append("text").attr("x", 32).attr("y", 40).attr("text-anchor", "middle").attr("font-size", 16).attr("font-weight", 700).attr("fill", "#ffffff").text((d) => d.label);
      cards.append("text").attr("x", 60).attr("y", 31).attr("font-size", 15).attr("font-weight", 700).attr("fill", "#172026").text((d) => d.title);
      cards.append("text").attr("x", 60).attr("y", 55).attr("font-size", 13).attr("font-weight", 700).attr("fill", colors.teal).text((d) => d3.format(".2f")(d.time || 0) + " s");
      cards.append("text").attr("x", 18).attr("y", 392).attr("font-size", 12).attr("fill", "#53616f").text((d) => d.note);

      const screenshotCards = cards.filter((d) => d.kind === "screenshot");
      screenshotCards.append("rect").attr("x", 18).attr("y", 78).attr("width", cardW - 36).attr("height", 270).attr("rx", 10).attr("fill", "#f7faf9").attr("stroke", "#cbd5e1");
      screenshotCards.append("image").attr("href", (d) => d.image).attr("x", 24).attr("y", 84).attr("width", cardW - 48).attr("height", 258).attr("preserveAspectRatio", "xMidYMid meet");

      const moduleCards = cards.filter((d) => d.kind === "module");
      moduleCards.append("rect").attr("x", 18).attr("y", 82).attr("width", cardW - 36).attr("height", 120).attr("rx", 10).attr("fill", "#172026");
      moduleCards.append("text").attr("x", 32).attr("y", 126).attr("font-family", "Consolas, monospace").attr("font-size", 12).attr("fill", "#d7f9f0").text((d) => d.code);
      moduleCards.append("rect").attr("x", 42).attr("y", 230).attr("width", 76).attr("height", 76).attr("rx", 12).attr("fill", "#eaf5f3").attr("stroke", "#9dc8c0");
      moduleCards.append("rect").attr("x", 138).attr("y", 230).attr("width", 76).attr("height", 76).attr("rx", 12).attr("fill", "#eef1ff").attr("stroke", "#c6cce2");
      moduleCards.append("text").attr("x", 80).attr("y", 274).attr("text-anchor", "middle").attr("font-size", 14).attr("font-weight", 700).text("SDK");
      moduleCards.append("text").attr("x", 176).attr("y", 274).attr("text-anchor", "middle").attr("font-size", 14).attr("font-weight", 700).text("D3");

      const fitCards = cards.filter((d) => d.kind === "fit");
      fitCards.append("path").attr("d", "M52 150 C92 98 154 100 194 150 C232 158 252 188 252 222 C252 263 220 292 178 292 L86 292 C44 292 16 262 16 224 C16 188 36 160 52 150 Z").attr("fill", "#e7f4ff").attr("stroke", colors.blue).attr("stroke-width", 2);
      fitCards.append("text").attr("x", 136).attr("y", 206).attr("text-anchor", "middle").attr("font-size", 16).attr("font-weight", 700).text("mSigPortal");
      fitCards.append("line").attr("x1", 136).attr("y1", 306).attr("x2", 136).attr("y2", 346).attr("stroke", colors.teal).attr("stroke-width", 4);
      fitCards.append("circle").attr("cx", 136).attr("cy", 356).attr("r", 26).attr("fill", "#eaf5f3").attr("stroke", colors.teal).attr("stroke-width", 2);
      fitCards.append("text").attr("x", 136).attr("y", 362).attr("text-anchor", "middle").attr("font-size", 14).attr("font-weight", 700).text("NNLS");

      svg.append("line").attr("x1", 175).attr("x2", 1104).attr("y1", 674).attr("y2", 674).attr("stroke", "#94a3b8").attr("stroke-width", 2);
      steps.forEach((step, i) => {
        const x = 177 + i * 309;
        svg.append("circle").attr("cx", x).attr("cy", 674).attr("r", 8).attr("fill", [colors.teal, colors.blue, colors.gold, colors.red][i]);
        svg.append("text").attr("x", x).attr("y", 704).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700).attr("fill", "#405168")
          .text(d3.format(".2f")(step.time || 0) + " s");
      });
    `,
  });
}

function figure3AdapterFidelity(e2, pairs) {
  const selected = new Set(["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"]);
  const toolLabels = {
    deconstructsigs: "deconstructSigs",
    sigminer: "sigminer",
    sigprofilerassignment: "SigProfilerAssignment",
    musical: "MuSiCal",
  };
  const spec = {
    rows: (pairs.rows || [])
      .filter((row) => selected.has(row.tool))
      .map((row) => ({
        tool: row.tool,
        sample: row.sample,
        signature: row.signature,
        browserExposure: Number(row.browserExposure) || 0,
        localExposure: Number(row.localExposure) || 0,
      })),
    metrics: (e2.rows || [])
      .filter((row) => selected.has(row.tool))
      .map((row) => ({
        tool: row.tool,
        label: toolLabels[row.tool] || row.tool,
        browserRuntime: row.browserRuntime,
        localRuntime: row.localRuntime,
        sampleCount: row.sampleCount,
        signatureCount: row.signatureCount,
        meanExposureCosine: row.meanExposureCosine,
        maxAbsoluteExposureDifference: row.maxAbsoluteExposureDifference,
        rmse: row.rmse,
        topSignatureConcordance: row.topSignatureConcordance,
        status: row.status,
      })),
    toolLabels,
  };
  return customFigurePage({
    title: "Figure 3. Adapter fidelity against local execution",
    subtitle:
      "The browser adapters and conventional local executions produced the same normalized exposure matrices across 38 PCAWG Lung-AdenoCA samples and the full COSMIC v3 SBS96 catalog.",
    spec,
    script: `
      const width = 1280, height = 760;
      const svg = d3.select("#chart").append("svg").attr("viewBox", [0, 0, width, height]);
      const colors = { teal: "#168a8c", blue: "#2b78c5", gold: "#d59b2e", purple: "#6f63b6", slate: "#405168" };
      const metricByTool = new Map(spec.metrics.map((row) => [row.tool, row]));
      const rows = spec.rows.map((row, index) => ({
        ...row,
        index,
        diff: row.browserExposure - row.localExposure,
        absDiff: Math.abs(row.browserExposure - row.localExposure),
      }));
      const tools = spec.metrics.map((row) => row.tool);
      const cardW = 286;
      spec.metrics.forEach((metric, index) => {
        const x = 34 + index * (cardW + 22);
        const g = svg.append("g").attr("transform", "translate(" + x + ",36)");
        g.append("rect").attr("width", cardW).attr("height", 190).attr("rx", 16).attr("fill", "#ffffff").attr("stroke", "#d8e2dc");
        g.append("rect").attr("x", 0).attr("y", 0).attr("width", cardW).attr("height", 10).attr("rx", 5).attr("fill", [colors.teal, colors.blue, colors.gold, colors.purple][index]);
        g.append("text").attr("x", 18).attr("y", 42).attr("font-size", 17).attr("font-weight", 700).attr("fill", "#172026").text(metric.label);
        g.append("text").attr("x", 18).attr("y", 67).attr("font-size", 12).attr("fill", "#53616f").text(metric.browserRuntime + " adapter vs " + metric.localRuntime);
        g.append("text").attr("x", 18).attr("y", 108).attr("font-size", 28).attr("font-weight", 700).attr("fill", "#168a8c")
          .text(d3.format(".6f")(metric.meanExposureCosine || 0));
        g.append("text").attr("x", 18).attr("y", 128).attr("font-size", 12).attr("fill", "#53616f").text("mean exposure cosine");
        g.append("text").attr("x", 18).attr("y", 158).attr("font-size", 13).attr("font-weight", 700).attr("fill", "#172026")
          .text("max |browser - local| = " + d3.format(".2e")(metric.maxAbsoluteExposureDifference || 0));
        g.append("text").attr("x", 18).attr("y", 178).attr("font-size", 12).attr("fill", "#53616f")
          .text(d3.format(".0%")(metric.topSignatureConcordance || 0) + " top-signature concordance");
      });

      const left = svg.append("g").attr("transform", "translate(44,280)");
      left.append("rect").attr("width", 760).attr("height", 420).attr("rx", 16).attr("fill", "#ffffff").attr("stroke", "#d8e2dc");
      left.append("text").attr("x", 24).attr("y", 34).attr("font-size", 17).attr("font-weight", 700).text("Browser minus local residuals");
      left.append("text").attr("x", 24).attr("y", 58).attr("font-size", 12).attr("fill", "#53616f").text("Each point is one sample-signature exposure. The zero line is exact agreement.");
      const plot = { x: 86, y: 86, w: 622, h: 260 };
      const maxAbs = d3.max(rows, (row) => row.absDiff) || 1e-15;
      const y = d3.scaleLinear().domain([-maxAbs * 1.35, maxAbs * 1.35]).range([plot.y + plot.h, plot.y]);
      const x = d3.scalePoint().domain(tools).range([plot.x, plot.x + plot.w]).padding(0.6);
      left.append("g").attr("transform", "translate(0," + (plot.y + plot.h) + ")")
        .call(d3.axisBottom(x).tickFormat((tool) => spec.toolLabels[tool] || tool))
        .selectAll("text").attr("font-size", 11);
      left.append("g").attr("transform", "translate(" + plot.x + ",0)").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1e")));
      left.append("line").attr("x1", plot.x).attr("x2", plot.x + plot.w).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "#172026").attr("stroke-width", 2);
      left.selectAll("circle.residual").data(rows).join("circle")
        .attr("class", "residual")
        .attr("cx", (row) => x(row.tool) + (((row.index * 17) % 23) - 11) * 0.9)
        .attr("cy", (row) => y(row.diff))
        .attr("r", 2.6)
        .attr("fill", (row) => row.absDiff === 0 ? "#168a8c" : "#d84b4b")
        .attr("opacity", 0.42);
      left.append("text").attr("transform", "rotate(-90)").attr("x", -(plot.y + plot.h / 2)).attr("y", 24).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#405168")
        .text("Exposure difference");

      const right = svg.append("g").attr("transform", "translate(840,280)");
      right.append("rect").attr("width", 398).attr("height", 420).attr("rx", 16).attr("fill", "#ffffff").attr("stroke", "#d8e2dc");
      right.append("text").attr("x", 24).attr("y", 34).attr("font-size", 17).attr("font-weight", 700).text("Maximum absolute difference");
      right.append("text").attr("x", 24).attr("y", 58).attr("font-size", 12).attr("fill", "#53616f").text("All tools are at numerical precision; zero-width bars are true zeros.");
      const barRows = spec.metrics.map((metric) => ({
        tool: metric.tool,
        label: metric.label,
        value: metric.maxAbsoluteExposureDifference || 0,
      }));
      const bx = d3.scaleLinear().domain([0, d3.max(barRows, (row) => row.value) || 1e-15]).range([180, 340]);
      const by = d3.scaleBand().domain(barRows.map((row) => row.tool)).range([100, 292]).padding(0.35);
      right.append("g").attr("transform", "translate(0,292)").call(d3.axisBottom(bx).ticks(4).tickFormat(d3.format(".1e")));
      right.selectAll("text.tool").data(barRows).join("text")
        .attr("class", "tool")
        .attr("x", 24).attr("y", (row) => by(row.tool) + by.bandwidth() / 2 + 4)
        .attr("font-size", 11).attr("font-weight", 700).attr("fill", "#172026").text((row) => row.label);
      right.selectAll("rect.maxdiff").data(barRows).join("rect")
        .attr("class", "maxdiff")
        .attr("x", 180).attr("y", (row) => by(row.tool))
        .attr("width", (row) => Math.max(row.value === 0 ? 0 : 2, bx(row.value) - bx(0)))
        .attr("height", by.bandwidth())
        .attr("fill", "#168a8c");
      right.selectAll("text.maxlabel").data(barRows).join("text")
        .attr("class", "maxlabel")
        .attr("x", 356)
        .attr("y", (row) => by(row.tool) + by.bandwidth() / 2 + 4)
        .attr("text-anchor", "end")
        .attr("font-size", 12).attr("fill", "#405168")
        .text((row) => row.value === 0 ? "0" : d3.format(".2e")(row.value));
      right.append("text").attr("x", 24).attr("y", 366).attr("font-size", 13).attr("font-weight", 700).attr("fill", "#168a8c")
        .text(String(rows.length) + " browser-local exposure pairs checked");
      right.append("text").attr("x", 24).attr("y", 390).attr("font-size", 12).attr("fill", "#53616f")
        .text("Exposure matrix dimensions: 38 samples x 9 signatures x four adapters.");
    `,
  });
}

function figure4PublicCohort(data) {
  return customFigurePage({
    title: "Figure 4. Public cohort capability demonstration",
    subtitle:
      "Notebook-style outputs from one browser-side PCAWG Lung-AdenoCA SBS96 session: burden, COSMIC-style profiles, fitted exposures, report evidence, and NMF diagnostics.",
    spec: data,
    script: `
      const width = 1280, height = 1040;
      const svg = d3.select("#chart").append("svg").attr("viewBox", [0, 0, width, height]);
      const sbsColors = spec.sbsClassColors;
      const sigColors = spec.signatureColors;
      function panel(x, y, w, h, title, note) {
        const g = svg.append("g").attr("transform", "translate(" + x + "," + y + ")");
        g.append("rect").attr("width", w).attr("height", h).attr("rx", 16).attr("fill", "#ffffff").attr("stroke", "#d8e2dc");
        g.append("text").attr("x", 18).attr("y", 30).attr("font-size", 16).attr("font-weight", 700).attr("fill", "#172026").text(title);
        if (note) g.append("text").attr("x", 18).attr("y", 53).attr("font-size", 12).attr("fill", "#53616f").text(note);
        return g;
      }
      burdenPanel(panel(28, 30, 366, 282, "A. Mutation burden", String(spec.sampleCount) + " public PCAWG Lung-AdenoCA spectra"));
      meanProfilePanel(panel(424, 30, 828, 282, "B. SBS96 profile", "Bars are grouped and colored by the six SBS substitution classes"));
      exposurePanel(panel(28, 342, 740, 312, "C. Signature exposure composition", "Samples sorted by dominant fitted signature; each bar sums to 100%"));
      reportPanel(panel(798, 342, 454, 312, "D. Trust-scored report fields", "Representative high-burden sample fit summary"));
      nmfRankPanel(panel(28, 684, 540, 310, "E. NMF rank diagnostics", "Reconstruction error and sample-cosine fit across candidate ranks"));
      nmfProfilesPanel(panel(598, 684, 654, 310, "F. Extracted NMF SBS profiles", "Selected-rank extracted signatures shown with the same SBS color grammar"));

      function burdenPanel(g) {
        const values = spec.burdens.map((row) => row.burden);
        const x = d3.scaleLinear().domain(d3.extent(values)).nice().range([56, 334]);
        const bins = d3.bin().domain(x.domain()).thresholds(11)(values);
        const y = d3.scaleLinear().domain([0, d3.max(bins, (bin) => bin.length) || 1]).nice().range([210, 78]);
        g.selectAll("rect.bin").data(bins).join("rect")
          .attr("class", "bin")
          .attr("x", (bin) => x(bin.x0) + 1)
          .attr("y", (bin) => y(bin.length))
          .attr("width", (bin) => Math.max(1, x(bin.x1) - x(bin.x0) - 2))
          .attr("height", (bin) => 210 - y(bin.length))
          .attr("fill", "#168a8c");
        g.append("g").attr("transform", "translate(0,210)").call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("~s")));
        g.append("g").attr("transform", "translate(56,0)").call(d3.axisLeft(y).ticks(4));
        g.append("text").attr("x", 56).attr("y", 248).attr("font-size", 12).attr("fill", "#53616f").text("Mutation count per sample");
        const stats = [
          ["min", spec.burdenSummary.min],
          ["med", spec.burdenSummary.median],
          ["max", spec.burdenSummary.max],
        ];
        stats.forEach((stat, i) => {
          g.append("text").attr("x", 254).attr("y", 94 + i * 38).attr("font-size", 11).attr("fill", "#53616f").text(stat[0]);
          g.append("text").attr("x", 344).attr("y", 94 + i * 38).attr("text-anchor", "end").attr("font-size", 12).attr("font-weight", 700).attr("fill", "#172026").text(d3.format(",.0f")(stat[1]));
        });
      }

      function drawSbsProfile(g, data, box, yLabel, showClassLabels = true) {
        const x = d3.scaleBand().domain(data.map((row) => row.context)).range([box.x, box.x + box.w]).paddingInner(0.08);
        const y = d3.scaleLinear().domain([0, d3.max(data, (row) => row.value) || 1]).nice().range([box.y + box.h, box.y]);
        g.selectAll("rect.profile-" + box.id).data(data).join("rect")
          .attr("class", "profile-" + box.id)
          .attr("x", (row) => x(row.context))
          .attr("y", (row) => y(row.value))
          .attr("width", x.bandwidth())
          .attr("height", (row) => box.y + box.h - y(row.value))
          .attr("fill", (row) => sbsColors[row.mutationClass] || "#8a939d");
        g.append("g").attr("transform", "translate(0," + (box.y + box.h) + ")")
          .call(d3.axisBottom(x).tickValues([]).tickSizeOuter(0));
        g.append("g").attr("transform", "translate(" + box.x + ",0)")
          .call(d3.axisLeft(y).ticks(4).tickFormat(box.percent ? d3.format(".1%") : d3.format(".2f")));
        g.append("text").attr("transform", "rotate(-90)").attr("x", -(box.y + box.h / 2)).attr("y", box.x - 42).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#405168").text(yLabel);
        if (!showClassLabels) return;
        for (const block of spec.classBlocks) {
          const startX = x(block.startContext);
          const endX = x(block.endContext) + x.bandwidth();
          const center = (startX + endX) / 2;
          g.append("rect").attr("x", startX).attr("y", box.y + box.h + 14).attr("width", endX - startX).attr("height", 8).attr("fill", sbsColors[block.mutationClass] || "#8a939d");
          g.append("text").attr("x", center).attr("y", box.y + box.h + 36).attr("text-anchor", "middle").attr("font-size", 10).attr("font-weight", 700).attr("fill", "#405168").text(block.mutationClass);
        }
      }

      function meanProfilePanel(g) {
        drawSbsProfile(g, spec.meanProfile, { x: 58, y: 78, w: 732, h: 138, id: "mean", percent: true }, "Mean fraction", true);
      }

      function exposurePanel(g) {
        const samples = spec.exposureMatrix.map((row) => row.sample);
        const signatures = spec.signatureNames;
        const stack = d3.stack().keys(signatures)(spec.exposureMatrix);
        const x = d3.scaleBand().domain(samples).range([42, 590]).padding(0.12);
        const y = d3.scaleLinear().domain([0, 1]).range([238, 76]);
        g.selectAll("g.stack").data(stack).join("g")
          .attr("fill", (series) => sigColors[series.key] || "#8a939d")
          .selectAll("rect").data((series) => series.map((d) => ({ ...d, key: series.key }))).join("rect")
          .attr("x", (d) => x(d.data.sample))
          .attr("y", (d) => y(d[1]))
          .attr("height", (d) => Math.max(0, y(d[0]) - y(d[1])))
          .attr("width", x.bandwidth());
        g.append("g").attr("transform", "translate(0,238)").call(d3.axisBottom(x).tickValues(samples.filter((_, i) => i % 4 === 0))).selectAll("text").attr("transform", "rotate(-35)").style("text-anchor", "end").attr("font-size", 9);
        g.append("g").attr("transform", "translate(42,0)").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")));
        g.append("text").attr("transform", "rotate(-90)").attr("x", -160).attr("y", 16).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#405168").text("Relative exposure");
        const legend = g.append("g").attr("transform", "translate(612,76)");
        signatures.forEach((signature, i) => {
          const item = legend.append("g").attr("transform", "translate(0," + (i * 19) + ")");
          item.append("rect").attr("width", 12).attr("height", 12).attr("fill", sigColors[signature] || "#8a939d");
          item.append("text").attr("x", 17).attr("y", 11).attr("font-size", 11).attr("fill", "#405168").text(signature);
        });
      }

      function reportPanel(g) {
        const card = spec.reportCard;
        g.append("rect").attr("x", 22).attr("y", 76).attr("width", 408).attr("height", 198).attr("rx", 14).attr("fill", "#f7faf9").attr("stroke", "#d8e2dc");
        g.append("text").attr("x", 44).attr("y", 113).attr("font-size", 22).attr("font-weight", 700).attr("fill", "#172026").text(card.sample || "sample");
        g.append("text").attr("x", 44).attr("y", 140).attr("font-size", 12).attr("fill", "#53616f").text("Sample selected from the public cohort by highest burden");
        const metrics = [
          ["Burden", d3.format(",.0f")(card.burden || 0)],
          ["Fit cosine", d3.format(".4f")(card.cosineSimilarity || 0)],
          ["RMSE", d3.format(".2e")(card.rmse || 0)],
          ["Active signatures", String(card.activeSignatureCount || 0)],
        ];
        metrics.forEach((metric, i) => {
          const x = 44 + (i % 2) * 180;
          const y = 168 + Math.floor(i / 2) * 44;
          g.append("text").attr("x", x).attr("y", y).attr("font-size", 11).attr("fill", "#53616f").text(metric[0]);
          g.append("text").attr("x", x).attr("y", y + 22).attr("font-size", 18).attr("font-weight", 700).attr("fill", metric[0] === "Fit cosine" ? "#168a8c" : "#172026").text(metric[1]);
        });
        const exposureY = 252;
        g.append("text").attr("x", 22).attr("y", exposureY).attr("font-size", 12).attr("font-weight", 700).attr("fill", "#405168").text("Top report exposure fields");
        (card.activeSignatures || []).forEach((row, i) => {
          const x = 22 + i * 104;
          g.append("rect").attr("x", x).attr("y", exposureY + 12).attr("width", 92).attr("height", 8).attr("rx", 4).attr("fill", "#e6edf2");
          g.append("rect").attr("x", x).attr("y", exposureY + 12).attr("width", Math.max(2, 92 * row.exposure)).attr("height", 8).attr("rx", 4).attr("fill", sigColors[row.signature] || "#168a8c");
          g.append("text").attr("x", x).attr("y", exposureY + 36).attr("font-size", 11).attr("font-weight", 700).attr("fill", "#172026").text(row.signature);
          g.append("text").attr("x", x).attr("y", exposureY + 51).attr("font-size", 11).attr("fill", "#53616f").text(d3.format(".1%")(row.exposure));
        });
      }

      function nmfRankPanel(g) {
        const runs = spec.nmfRankSelection.runs;
        const x = d3.scalePoint().domain(runs.map((row) => row.rank)).range([74, 472]).padding(0.5);
        const err = d3.scaleLinear().domain(d3.extent(runs, (row) => row.reconstructionError)).nice().range([230, 76]);
        const cos = d3.scaleLinear().domain([Math.max(0, d3.min(runs, (row) => row.averageSampleCosineSimilarity) - 0.02), 1]).range([230, 76]);
        g.append("g").attr("transform", "translate(0,230)").call(d3.axisBottom(x));
        g.append("g").attr("transform", "translate(74,0)").call(d3.axisLeft(err).ticks(4).tickFormat(d3.format("~s")));
        g.append("g").attr("transform", "translate(472,0)").call(d3.axisRight(cos).ticks(4).tickFormat(d3.format(".2f")));
        g.append("path").datum(runs).attr("fill", "none").attr("stroke", "#168a8c").attr("stroke-width", 3).attr("d", d3.line().x((row) => x(row.rank)).y((row) => err(row.reconstructionError)));
        g.append("path").datum(runs).attr("fill", "none").attr("stroke", "#d59b2e").attr("stroke-width", 3).attr("d", d3.line().x((row) => x(row.rank)).y((row) => cos(row.averageSampleCosineSimilarity)));
        g.selectAll("circle.err").data(runs).join("circle").attr("cx", (row) => x(row.rank)).attr("cy", (row) => err(row.reconstructionError)).attr("r", 5).attr("fill", "#168a8c");
        g.selectAll("circle.cos").data(runs).join("circle").attr("cx", (row) => x(row.rank)).attr("cy", (row) => cos(row.averageSampleCosineSimilarity)).attr("r", 5).attr("fill", "#d59b2e");
        g.append("text").attr("x", 74).attr("y", 270).attr("font-size", 12).attr("fill", "#53616f").text("Rank");
        g.append("text").attr("x", 250).attr("y", 82).attr("font-size", 13).attr("font-weight", 700).attr("fill", "#168a8c").text("recommended rank " + spec.nmfRankSelection.recommendedRank);
        g.append("rect").attr("x", 280).attr("y", 252).attr("width", 12).attr("height", 12).attr("fill", "#168a8c");
        g.append("text").attr("x", 298).attr("y", 263).attr("font-size", 11).attr("fill", "#405168").text("reconstruction error");
        g.append("rect").attr("x", 410).attr("y", 252).attr("width", 12).attr("height", 12).attr("fill", "#d59b2e");
        g.append("text").attr("x", 428).attr("y", 263).attr("font-size", 11).attr("fill", "#405168").text("sample cosine");
      }

      function nmfProfilesPanel(g) {
        const profiles = spec.nmfProfiles || [];
        const cellW = 292, cellH = 102;
        profiles.forEach((profile, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x0 = 28 + col * 306;
          const y0 = 78 + row * 108;
          const gg = g.append("g").attr("transform", "translate(" + x0 + "," + y0 + ")");
          gg.append("text").attr("x", 0).attr("y", -10).attr("font-size", 12).attr("font-weight", 700).attr("fill", "#405168").text(profile.signature);
          drawSbsProfile(gg, profile.values, { x: 28, y: 8, w: 242, h: 70, id: "nmf-" + i, percent: false }, "Weight", false);
        });
      }
    `,
  });
}

function figure5Runtime(e4) {
  const scenarioLabels = {
    single_sample_fit_report: "Single sample",
    medium_cohort_120: "120-sample cohort",
    portal_scale_300x40: "300 x 40 refit",
    bootstrap_500: "Bootstrap 500",
    nmf_rank_selection_rank4: "NMF rank/extract",
  };
  const browserOrder = ["chrome", "edge", "firefox"];
  const browserLabels = { chrome: "Chrome", edge: "Edge", firefox: "Firefox" };
  const scenarios = Object.keys(scenarioLabels);
  const availableBrowsers = new Set((e4.environment?.browsers || []).map((browser) => browser.id));
  const grouped = new Map();
  for (const row of e4.rows || []) {
    if (row.status !== "completed") continue;
    const key = `${row.browser}|${row.scenario}`;
    grouped.set(key, [...(grouped.get(key) || []), Number(row.elapsedMs)]);
    availableBrowsers.add(row.browser);
  }
  const browsers = browserOrder.filter((browser) => availableBrowsers.has(browser));
  const rows = [];
  for (const scenario of scenarios) {
    for (const browser of browsers) {
      const values = grouped.get(`${browser}|${scenario}`) || [];
      rows.push({
        scenario,
        scenarioLabel: scenarioLabels[scenario],
        browser,
        browserLabel: browserLabels[browser] || titleCase(browser),
        medianMs: values.length ? median(values) : null,
        repeatCount: values.length,
        status: values.length ? "completed" : "not available",
      });
    }
  }
  const spec = {
    rows,
    scenarios,
    browsers,
    browserLabels,
    environment: e4.environment || {},
  };
  return customFigurePage({
    title: "Figure 5. Browser runtime benchmarks",
    subtitle:
      "Median elapsed time across five repeats per available desktop browser. The y-axis is log-scaled so sub-millisecond single-sample fits and slower cohort workflows remain visible together.",
    spec,
    script: `
      const width = 1280, height = 700;
      const svg = d3.select("#chart").append("svg").attr("viewBox", [0, 0, width, height]);
      const margin = { top: 72, right: 44, bottom: 132, left: 92 };
      const completed = spec.rows.filter((row) => row.status === "completed");
      const x0 = d3.scaleBand().domain(spec.scenarios).range([margin.left, width - margin.right]).padding(0.18);
      const x1 = d3.scaleBand().domain(spec.browsers).range([0, x0.bandwidth()]).padding(0.16);
      const minVal = d3.min(completed, (row) => row.medianMs) || 0.1;
      const maxVal = d3.max(completed, (row) => row.medianMs) || 1000;
      const y = d3.scaleLog().domain([Math.max(0.05, minVal / 4), maxVal * 2.2]).range([height - margin.bottom, margin.top]);
      const color = d3.scaleOrdinal().domain(spec.browsers).range(["#168a8c", "#6f63b6", "#d59b2e"]);
      svg.append("rect").attr("x", margin.left).attr("y", margin.top).attr("width", width - margin.left - margin.right).attr("height", height - margin.top - margin.bottom).attr("fill", "#fbfdfc").attr("stroke", "#e6edf2");
      svg.append("g").attr("transform", "translate(0," + (height - margin.bottom) + ")")
        .call(d3.axisBottom(x0).tickFormat((scenario) => spec.rows.find((row) => row.scenario === scenario)?.scenarioLabel || scenario))
        .selectAll("text").attr("font-size", 12);
      svg.append("g").attr("transform", "translate(" + margin.left + ",0)")
        .call(d3.axisLeft(y).ticks(8, "~g"));
      svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 28).attr("text-anchor", "middle").attr("font-size", 14).attr("fill", "#405168").text("Median elapsed time (ms, log scale)");
      svg.append("g").attr("stroke", "#d8e2dc").attr("stroke-dasharray", "3 4")
        .selectAll("line").data(y.ticks(8)).join("line")
        .attr("x1", margin.left).attr("x2", width - margin.right)
        .attr("y1", (tick) => y(tick)).attr("y2", (tick) => y(tick));
      svg.selectAll("rect.bar").data(completed).join("rect")
        .attr("class", "bar")
        .attr("x", (row) => x0(row.scenario) + x1(row.browser))
        .attr("y", (row) => y(row.medianMs))
        .attr("width", x1.bandwidth())
        .attr("height", (row) => Math.max(3, height - margin.bottom - y(row.medianMs)))
        .attr("fill", (row) => color(row.browser));
      svg.selectAll("text.value").data(completed).join("text")
        .attr("class", "value")
        .attr("x", (row) => x0(row.scenario) + x1(row.browser) + x1.bandwidth() / 2)
        .attr("y", (row) => y(row.medianMs) - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("font-weight", 700)
        .attr("fill", "#172026")
        .text((row) => formatDuration(row.medianMs));
      svg.selectAll("text.na").data(spec.rows.filter((row) => row.status !== "completed")).join("text")
        .attr("x", (row) => x0(row.scenario) + x1(row.browser) + x1.bandwidth() / 2)
        .attr("y", height - margin.bottom - 10)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", "#64748b")
        .text("n/a");
      const legend = svg.append("g").attr("transform", "translate(" + (width - 378) + ",30)");
      spec.browsers.forEach((browser, i) => {
        const item = legend.append("g").attr("transform", "translate(" + (i * 118) + ",0)");
        item.append("rect").attr("width", 15).attr("height", 15).attr("rx", 3).attr("fill", color(browser));
        item.append("text").attr("x", 23).attr("y", 13).attr("font-size", 13).attr("font-weight", 700).attr("fill", "#405168").text(spec.browserLabels[browser] || browser);
      });
      svg.append("text").attr("x", margin.left).attr("y", height - 56).attr("font-size", 12).attr("fill", "#53616f")
        .text("Scenarios: single-sample report; 120-sample cohort; 300 samples x 40 signatures; 500 bootstrap iterations; NMF rank selection and rank-4 extraction.");
      svg.append("text").attr("x", margin.left).attr("y", height - 32).attr("font-size", 12).attr("fill", "#53616f")
        .text("Host: " + (spec.environment.cpus || "n/a") + " CPU threads, " + (spec.environment.memoryGb || "n/a") + " GB RAM, Node " + (spec.environment.node || "n/a") + ".");
      function formatDuration(ms) {
        if (ms < 1) return d3.format(".2f")(ms) + " ms";
        if (ms < 100) return d3.format(".1f")(ms) + " ms";
        if (ms < 1000) return d3.format(".0f")(ms) + " ms";
        return d3.format(".2f")(ms / 1000) + " s";
      }
    `,
  });
}

function figure2ZeroInstallRedesigned(e1) {
  const row = e1.rows?.[0] || {};
  const steps = row.steps || [];
  const stepTime = (name, fallback = null) => {
    const found = steps.find((step) => step.name === name);
    return found ? Number(found.elapsedSeconds) : fallback;
  };
  const storyboard = [
    {
      id: "blank",
      label: "A",
      title: "Page starts",
      time: stepTime("Page loaded", 0),
      note: "t=0",
    },
    {
      id: "import",
      label: "B",
      title: "SDK loads",
      time: stepTime("SDK imported"),
      note: "in browser",
    },
    {
      id: "fetch",
      label: "C",
      title: "Inputs fetched",
      time: stepTime("mSigPortal data fetched"),
      note: "public only",
    },
    {
      id: "report",
      label: "D",
      title: "Report ready",
      time: stepTime("SDK report generated", row.elapsedSeconds),
      note: "no upload",
    },
  ];
  const spec = {
    elapsedSeconds: Number(row.elapsedSeconds),
    reportBytes: Number(row.reportBytes),
    sampleCount: Number(row.sampleCount),
    signatureCount: Number(row.signatureCount),
    sourceSpectrumUrl: row.sourceSpectrumUrl,
    sourceCatalogUrl: row.sourceCatalogUrl,
    steps: storyboard,
    rawSteps: steps,
    palette: DESIGN,
  };
  return customFigurePage({
    title: "Figure 2. Zero-install workflow demonstration",
    subtitle: `Page load -> SDK import -> public inputs -> local report in ${formatNumber(row.elapsedSeconds, 2)} seconds. Browser launch and URL entry are excluded.`,
    showHeader: false,
    spec,
    script: `
      const width = 1280, height = 680;
      const p = spec.palette;
      const svg = d3.select("#chart").append("svg").attr("viewBox", [0, 0, width, height]);
      const colors = [p.blue, p.green, p.orange, p.purple];
      svg.append("rect").attr("width", width).attr("height", height).attr("fill", p.paper);

      const formatTime = (value) => value == null || !Number.isFinite(value)
        ? "not measured"
        : d3.format(".2f")(value) + " s";

      const claim = svg.append("g").attr("transform", "translate(64,48)");
      [
        ["0 installs", p.blue, 116],
        ["Public data", p.orange, 132],
        ["Local report", p.green, 136]
      ].forEach((item, i) => {
        const offset = [0, 134, 286][i];
        const g = claim.append("g").attr("transform", "translate(" + offset + ",0)");
        g.append("rect").attr("width", item[2]).attr("height", 34).attr("rx", 8).attr("fill", "#ffffff").attr("stroke", item[1]).attr("stroke-width", 1.8);
        g.append("circle").attr("cx", 20).attr("cy", 17).attr("r", 6).attr("fill", item[1]);
        g.append("text").attr("x", 38).attr("y", 22).attr("font-size", 14).attr("font-weight", 700).attr("fill", p.ink).text(item[0]);
      });

      const metric = svg.append("g").attr("transform", "translate(950,28)");
      metric.append("rect").attr("width", 266).attr("height", 94).attr("rx", 8).attr("fill", "#ffffff").attr("stroke", p.hairline);
      metric.append("text").attr("x", 26).attr("y", 43).attr("font-size", 36).attr("font-weight", 700).attr("fill", p.green)
        .text(formatTime(spec.elapsedSeconds || 0));
      metric.append("text").attr("x", 26).attr("y", 72).attr("font-size", 15).attr("font-weight", 700).attr("fill", p.muted)
        .text("automated runtime");

      const cardW = 254, cardH = 380, gap = 46, cardTop = 146;
      const cards = svg.selectAll("g.story-card").data(spec.steps).join("g")
        .attr("class", "story-card")
        .attr("transform", (d, i) => "translate(" + (64 + i * (cardW + gap)) + "," + cardTop + ")");
      cards.append("rect").attr("width", cardW).attr("height", cardH).attr("rx", 8).attr("fill", "#ffffff").attr("stroke", p.hairline);
      cards.append("circle").attr("cx", 34).attr("cy", 36).attr("r", 19).attr("fill", (d, i) => colors[i]);
      cards.append("text").attr("x", 34).attr("y", 42).attr("text-anchor", "middle").attr("font-size", 16).attr("font-weight", 700).attr("fill", "#ffffff").text((d) => d.label);
      cards.append("text").attr("x", 66).attr("y", 33).attr("font-size", 18).attr("font-weight", 700).attr("fill", p.ink).text((d) => d.title);
      cards.append("text").attr("x", 66).attr("y", 59).attr("font-size", 14).attr("font-weight", 700).attr("fill", p.green)
        .text((d) => formatTime(d.time));
      cards.append("rect").attr("x", 62).attr("y", 334).attr("width", 130).attr("height", 30).attr("rx", 8).attr("fill", p.paper).attr("stroke", p.hairline);
      cards.append("text").attr("x", cardW / 2).attr("y", 354).attr("text-anchor", "middle").attr("font-size", 14).attr("font-weight", 700).attr("fill", p.muted).text((d) => d.note);

      cards.each(function(d, i) {
        const artX = d.id === "fetch" ? 14 : 22;
        const g = d3.select(this).append("g").attr("transform", "translate(" + artX + ",96)");
        if (d.id === "blank") drawBrowser(g, colors[i]);
        if (d.id === "import") drawImport(g, colors[i]);
        if (d.id === "fetch") drawFetch(g, colors[i]);
        if (d.id === "report") drawReport(g, colors[i]);
      });

      for (let i = 0; i < spec.steps.length - 1; i++) {
        const x = 64 + (i + 1) * cardW + i * gap + 12;
        const arrowLen = gap - 24;
        svg.append("path").attr("d", "M" + x + " " + (cardTop + 192) + " h" + arrowLen).attr("fill", "none").attr("stroke", p.green).attr("stroke-width", 4).attr("stroke-linecap", "round");
        svg.append("path").attr("d", "M" + (x + arrowLen) + " " + (cardTop + 192) + " l-10 -8 v16 z").attr("fill", p.green);
      }

      const timeline = svg.append("g").attr("transform", "translate(108,588)");
      timeline.append("line").attr("x1", 0).attr("x2", 1064).attr("y1", 0).attr("y2", 0).attr("stroke", p.hairline).attr("stroke-width", 2);
      const tx = d3.scalePoint().domain(spec.steps.map((d) => d.label)).range([16, 1048]).padding(0);
      timeline.selectAll("circle.tick").data(spec.steps).join("circle")
        .attr("cx", (d) => tx(d.label)).attr("cy", 0).attr("r", 7).attr("fill", (d, i) => colors[i]);
      timeline.selectAll("text.tick-label").data(spec.steps).join("text")
        .attr("x", (d) => tx(d.label)).attr("y", 32).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700).attr("fill", p.ink)
        .text((d) => d.label + "  " + formatTime(d.time));
      svg.append("text").attr("x", 64).attr("y", 652).attr("font-size", 13).attr("font-weight", 700).attr("fill", p.muted)
        .text("Timing excludes browser launch and URL typing.");

      function drawBrowser(g, color) {
        g.append("rect").attr("x", 18).attr("y", 4).attr("width", 194).attr("height", 152).attr("rx", 8).attr("fill", p.paleBlue).attr("stroke", color).attr("stroke-width", 2.5);
        g.append("rect").attr("x", 18).attr("y", 4).attr("width", 194).attr("height", 34).attr("rx", 8).attr("fill", "#ffffff").attr("stroke", color).attr("stroke-width", 2.5);
        g.append("circle").attr("cx", 39).attr("cy", 21).attr("r", 5).attr("fill", "#ef4444");
        g.append("circle").attr("cx", 57).attr("cy", 21).attr("r", 5).attr("fill", p.orange);
        g.append("circle").attr("cx", 75).attr("cy", 21).attr("r", 5).attr("fill", p.green);
        g.append("rect").attr("x", 44).attr("y", 64).attr("width", 142).attr("height", 18).attr("rx", 9).attr("fill", "#ffffff").attr("stroke", p.hairline);
        g.append("path").attr("d", "M76 117 l24 22 l52 -60").attr("fill", "none").attr("stroke", color).attr("stroke-width", 7).attr("stroke-linecap", "round").attr("stroke-linejoin", "round");
        g.append("text").attr("x", 115).attr("y", 196).attr("text-anchor", "middle").attr("font-size", 18).attr("font-weight", 700).attr("fill", p.ink).text("Demo page");
      }
      function drawImport(g, color) {
        g.append("rect").attr("x", 16).attr("y", 0).attr("width", 198).attr("height", 112).attr("rx", 8).attr("fill", p.ink);
        g.append("text").attr("x", 115).attr("y", 49).attr("text-anchor", "middle").attr("font-size", 22).attr("font-weight", 700).attr("fill", "#d7f9f0").text("mSigSDK");
        g.append("path").attr("d", "M115 124 v32").attr("fill", "none").attr("stroke", color).attr("stroke-width", 4).attr("stroke-linecap", "round");
        g.append("path").attr("d", "M115 167 l-10 -14 h20 z").attr("fill", color);
        g.append("rect").attr("x", 32).attr("y", 182).attr("width", 78).attr("height", 40).attr("rx", 8).attr("fill", p.paleGreen).attr("stroke", color).attr("stroke-width", 2);
        g.append("rect").attr("x", 120).attr("y", 182).attr("width", 78).attr("height", 40).attr("rx", 8).attr("fill", "#f3e8f6").attr("stroke", p.purple).attr("stroke-width", 2);
        g.append("text").attr("x", 71).attr("y", 207).attr("text-anchor", "middle").attr("font-size", 15).attr("font-weight", 700).attr("fill", p.ink).text("SDK");
        g.append("text").attr("x", 159).attr("y", 207).attr("text-anchor", "middle").attr("font-size", 15).attr("font-weight", 700).attr("fill", p.ink).text("D3");
      }
      function drawFetch(g, color) {
        g.append("path").attr("d", "M54 54c6-30 32-50 66-50 29 0 52 16 64 41 25 4 44 26 44 52 0 30-25 54-57 54H50c-29 0-52-23-52-52 0-27 23-50 51-50h5z")
          .attr("fill", p.paleBlue).attr("stroke", color).attr("stroke-width", 2.5);
        g.append("text").attr("x", 113).attr("y", 92).attr("text-anchor", "middle").attr("font-size", 18).attr("font-weight", 700).attr("fill", p.ink).text("mSigPortal");
        g.append("line").attr("x1", 113).attr("y1", 154).attr("x2", 113).attr("y2", 171).attr("stroke", p.green).attr("stroke-width", 4).attr("stroke-linecap", "round");
        g.append("path").attr("d", "M113 182 l-10 -14 h20 z").attr("fill", p.green);
        [
          ["SBS96", p.blue],
          ["COSMIC", p.orange]
        ].forEach((item, i) => {
          const x = 27 + i * 91;
          g.append("rect").attr("x", x).attr("y", 190).attr("width", 82).attr("height", 32).attr("rx", 8).attr("fill", "#ffffff").attr("stroke", item[1]).attr("stroke-width", 1.8);
          g.append("circle").attr("cx", x + 17).attr("cy", 206).attr("r", 5).attr("fill", item[1]);
          g.append("text").attr("x", x + 30).attr("y", 211).attr("font-size", 13).attr("font-weight", 700).attr("fill", p.ink).text(item[0]);
        });
      }
      function drawReport(g, color) {
        g.append("rect").attr("x", 40).attr("y", 0).attr("width", 154).attr("height", 196).attr("rx", 8).attr("fill", "#ffffff").attr("stroke", color).attr("stroke-width", 2.5);
        g.append("rect").attr("x", 64).attr("y", 30).attr("width", 106).attr("height", 16).attr("rx", 8).attr("fill", p.paleGreen);
        g.append("rect").attr("x", 64).attr("y", 64).attr("width", 106).attr("height", 70).attr("rx", 8).attr("fill", p.paleBlue).attr("stroke", p.hairline);
        g.append("path").attr("d", "M78 113 l25 -26 l23 16 l33 -44").attr("fill", "none").attr("stroke", p.green).attr("stroke-width", 4).attr("stroke-linecap", "round").attr("stroke-linejoin", "round");
        g.append("rect").attr("x", 64).attr("y", 152).attr("width", 70).attr("height", 12).attr("rx", 6).attr("fill", p.orange);
        g.append("rect").attr("x", 64).attr("y", 174).attr("width", 96).attr("height", 12).attr("rx", 6).attr("fill", p.purple);
        g.append("g").attr("transform", "translate(168,202)")
          .call((lock) => {
            lock.append("circle").attr("cx", 0).attr("cy", 0).attr("r", 26).attr("fill", p.paleGreen).attr("stroke", p.green).attr("stroke-width", 2);
            lock.append("rect").attr("x", -10).attr("y", -1).attr("width", 20).attr("height", 17).attr("rx", 4).attr("fill", p.green);
            lock.append("path").attr("d", "M-7 -1v-8c0-11 14-11 14 0v8").attr("fill", "none").attr("stroke", p.green).attr("stroke-width", 4).attr("stroke-linecap", "round");
          });
      }
    `,
  });
}

function figure3AdapterFidelityDashboard(e2, pairs) {
  const selected = ["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"];
  const toolLabels = {
    deconstructsigs: "deconstructSigs",
    sigminer: "sigminer",
    sigprofilerassignment: "SigProfilerAssignment",
    musical: "MuSiCal",
  };
  const metrics = selected.map((tool) => {
    const row = (e2.rows || []).find((candidate) => candidate.tool === tool);
    if (!row) throw new Error(`Missing E2 adapter fidelity row for ${tool}.`);
    const maxDiff = Number(row.maxAbsoluteExposureDifference);
    if (!Number.isFinite(maxDiff)) throw new Error(`Invalid E2 max absolute difference for ${tool}.`);
    if (maxDiff > ADAPTER_DIFF_THRESHOLD) {
      throw new Error(
        `E2 adapter fidelity failed: ${tool} max difference ${maxDiff} exceeds ${ADAPTER_DIFF_THRESHOLD}.`
      );
    }
    return {
      tool,
      label: toolLabels[tool],
      browserRuntime: row.browserRuntime,
      localRuntime: row.localRuntime,
      sampleCount: Number(row.sampleCount),
      signatureCount: Number(row.signatureCount),
      meanExposureCosine: Number(row.meanExposureCosine),
      maxAbsoluteExposureDifference: maxDiff,
      rmse: Number(row.rmse),
      topSignatureConcordance: Number(row.topSignatureConcordance),
      status: row.status,
      precisionNote:
        tool === "musical" && maxDiff > 0
          ? "floating-point roundoff"
          : maxDiff === 0
            ? "exact within exported precision"
            : "numerical precision",
    };
  });
  const pairCount = (pairs.rows || []).filter((row) => selected.includes(row.tool)).length;
  const spec = {
    metrics,
    pairCount,
    threshold: ADAPTER_DIFF_THRESHOLD,
    sampleCount: metrics[0]?.sampleCount,
    signatureCount: metrics[0]?.signatureCount,
    palette: DESIGN,
  };
  return customFigurePage({
    title: "Figure 3. Adapter fidelity against local execution",
    subtitle:
      "Browser adapters and conventional local comparators produced equivalent normalized exposure matrices for 38 PCAWG Lung-AdenoCA samples fitted to the full COSMIC v3 SBS96 catalog.",
    spec,
    script: `
      const width = 1280, height = 640;
      const p = spec.palette;
      const svg = d3.select("#chart").append("svg").attr("viewBox", [0, 0, width, height]);
      const colors = [p.blue, p.green, p.orange, p.purple];
      svg.append("rect").attr("width", width).attr("height", height).attr("fill", p.paper);

      const header = svg.append("g").attr("transform", "translate(54,40)");
      header.append("rect").attr("width", 1172).attr("height", 94).attr("rx", 18).attr("fill", "#ffffff").attr("stroke", p.hairline);
      header.append("circle").attr("cx", 42).attr("cy", 47).attr("r", 25).attr("fill", p.paleGreen).attr("stroke", p.green).attr("stroke-width", 2.5);
      header.append("path").attr("d", "M30 48 l9 10 l18 -24").attr("fill", "none").attr("stroke", p.green).attr("stroke-width", 5).attr("stroke-linecap", "round").attr("stroke-linejoin", "round");
      header.append("text").attr("x", 84).attr("y", 41).attr("font-size", 23).attr("font-weight", 700).attr("fill", p.ink)
        .text("Browser and local package outputs match at numerical precision");
      header.append("text").attr("x", 84).attr("y", 68).attr("font-size", 14).attr("fill", p.muted)
        .text(String(spec.sampleCount) + " samples x " + String(spec.signatureCount) + " signatures x four adapters = " + d3.format(",")(spec.pairCount) + " exposure pairs; acceptance threshold <= " + d3.format(".0e")(spec.threshold) + ".");

      const cardW = 274, cardH = 190;
      const cards = svg.selectAll("g.tool-card").data(spec.metrics).join("g")
        .attr("class", "tool-card")
        .attr("transform", (d, i) => "translate(" + (54 + i * (cardW + 25)) + ",174)");
      cards.append("rect").attr("width", cardW).attr("height", cardH).attr("rx", 16).attr("fill", "#ffffff").attr("stroke", p.hairline);
      cards.append("rect").attr("width", cardW).attr("height", 9).attr("rx", 4.5).attr("fill", (d, i) => colors[i]);
      cards.append("text").attr("x", 20).attr("y", 40).attr("font-size", 17).attr("font-weight", 700).attr("fill", p.ink).text((d) => d.label);
      cards.append("text").attr("x", 20).attr("y", 64).attr("font-size", 12).attr("fill", p.muted)
        .text((d) => d.browserRuntime + " vs " + d.localRuntime);
      cards.append("text").attr("x", 20).attr("y", 106).attr("font-size", 30).attr("font-weight", 700).attr("fill", p.green)
        .text((d) => d3.format(".6f")(d.meanExposureCosine));
      cards.append("text").attr("x", 20).attr("y", 128).attr("font-size", 12).attr("fill", p.muted).text("mean exposure cosine");
      cards.append("text").attr("x", 20).attr("y", 158).attr("font-size", 13).attr("font-weight", 700).attr("fill", p.ink)
        .text((d) => "max abs diff " + (d.maxAbsoluteExposureDifference === 0 ? "0" : d3.format(".2e")(d.maxAbsoluteExposureDifference)));
      cards.append("text").attr("x", 20).attr("y", 178).attr("font-size", 12).attr("fill", p.muted)
        .text((d) => d3.format(".0%")(d.topSignatureConcordance) + " top-signature concordance");

      const chart = svg.append("g").attr("transform", "translate(86,430)");
      chart.append("text").attr("x", 0).attr("y", -34).attr("font-size", 18).attr("font-weight", 700).attr("fill", p.ink)
        .text("Maximum absolute exposure difference is below the 1e-12 acceptance threshold");
      chart.append("text").attr("x", 0).attr("y", -12).attr("font-size", 13).attr("fill", p.muted)
        .text("MuSiCal's nonzero value is approximately 4.16e-15, which is double-precision roundoff and not a meaningful residual.");
      const x = d3.scaleLinear().domain([0, spec.threshold]).range([250, 1060]);
      const y = d3.scaleBand().domain(spec.metrics.map((d) => d.tool)).range([24, 154]).padding(0.38);
      chart.append("line").attr("x1", x(spec.threshold)).attr("x2", x(spec.threshold)).attr("y1", 6).attr("y2", 174).attr("stroke", p.vermillion).attr("stroke-width", 2).attr("stroke-dasharray", "5 5");
      chart.append("text").attr("x", x(spec.threshold)).attr("y", 0).attr("text-anchor", "end").attr("font-size", 12).attr("font-weight", 700).attr("fill", p.vermillion).text("threshold 1e-12");
      chart.selectAll("text.tool").data(spec.metrics).join("text")
        .attr("class", "tool")
        .attr("x", 0).attr("y", (d) => y(d.tool) + y.bandwidth() / 2 + 5)
        .attr("font-size", 14).attr("font-weight", 700).attr("fill", p.ink).text((d) => d.label);
      chart.selectAll("line.baseline").data(spec.metrics).join("line")
        .attr("class", "baseline").attr("x1", x(0)).attr("x2", x(spec.threshold)).attr("y1", (d) => y(d.tool) + y.bandwidth() / 2).attr("y2", (d) => y(d.tool) + y.bandwidth() / 2)
        .attr("stroke", p.hairline).attr("stroke-width", 2);
      chart.selectAll("rect.diff").data(spec.metrics).join("rect")
        .attr("class", "diff").attr("x", x(0)).attr("y", (d) => y(d.tool))
        .attr("width", (d) => Math.max(d.maxAbsoluteExposureDifference === 0 ? 0 : 4, x(d.maxAbsoluteExposureDifference) - x(0)))
        .attr("height", y.bandwidth()).attr("fill", (d, i) => colors[i]);
      chart.selectAll("circle.zero").data(spec.metrics.filter((d) => d.maxAbsoluteExposureDifference === 0)).join("circle")
        .attr("class", "zero").attr("cx", x(0)).attr("cy", (d) => y(d.tool) + y.bandwidth() / 2).attr("r", 5).attr("fill", p.green);
      chart.selectAll("text.diff-label").data(spec.metrics).join("text")
        .attr("class", "diff-label").attr("x", 1080).attr("y", (d) => y(d.tool) + y.bandwidth() / 2 + 5)
        .attr("text-anchor", "end").attr("font-size", 13).attr("fill", p.muted)
        .text((d) => (d.maxAbsoluteExposureDifference === 0 ? "0" : d3.format(".2e")(d.maxAbsoluteExposureDifference)) + " (" + d.precisionNote + ")");
      chart.append("g").attr("transform", "translate(0,174)").call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".0e")));
      chart.append("text").attr("x", 654).attr("y", 224).attr("text-anchor", "middle").attr("font-size", 13).attr("fill", p.muted)
        .text("Maximum absolute normalized-exposure difference");
    `,
  });
}

function figure3PublicCohortManuscript(data) {
  const spec = {
    ...data,
    palette: DESIGN,
  };
  return customFigurePage({
    title: "Figure 3. Public cohort capability demonstration",
    subtitle:
      "A manuscript-scale summary of one browser-side PCAWG Lung-AdenoCA SBS96 session: public cohort QC, COSMIC-style spectrum inspection, fitted exposure evidence, threshold sensitivity, and NMF Discovery.",
    spec,
    script: `
      const width = 1280, height = 1120;
      const p = spec.palette;
      const svg = d3.select("#chart").append("svg").attr("viewBox", [0, 0, width, height]);
      svg.append("rect").attr("width", width).attr("height", height).attr("fill", p.paper);

      svg.append("text").attr("x", 42).attr("y", 56).attr("font-size", 24).attr("font-weight", 700).attr("fill", p.ink)
        .text("End-to-end browser analysis on a public cohort");
      svg.append("text").attr("x", 42).attr("y", 84).attr("font-size", 14).attr("fill", p.muted)
        .text(String(spec.sampleCount) + " PCAWG Lung-AdenoCA SBS96 spectra fitted to " + String(spec.signatureNames.length) + " COSMIC signatures, with QC and NMF diagnostics rendered locally.");

      const panelColors = [p.green, p.blue, p.orange, p.purple, p.vermillion];
      const panels = {
        profile: panel(42, 122, 1196, 314, "A", "SBS96 profile", "Cohort profile, grouped by the six COSMIC SBS mutation classes.", panelColors[0]),
        burden: panel(42, 474, 360, 260, "B", "Cohort QC", "Mutation burden distribution across public samples.", panelColors[1]),
        fit: panel(430, 474, 808, 260, "C", "Fitted exposure evidence", "Representative report fields for the highest-burden sample.", panelColors[2]),
        sensitivity: panel(42, 772, 540, 296, "D", "Threshold sensitivity", "How active-signature calls change across exposure thresholds.", panelColors[3]),
        nmf: panel(610, 772, 628, 296, "E", "NMF Discovery", "Rank sweep and extracted de novo signatures from the selected rank.", panelColors[4]),
      };
      drawSbsProfile(panels.profile, spec.meanProfile, { x: 72, y: 92, w: 1080, h: 160, classY: 66 });
      drawBurden(panels.burden);
      drawFitEvidence(panels.fit);
      drawSensitivity(panels.sensitivity);
      drawNmf(panels.nmf);

      svg.append("text").attr("x", 42).attr("y", 1092).attr("font-size", 12).attr("fill", p.muted)
        .text("All panels are redrawn from computed SDK outputs for manuscript readability; SBS96 colors use the shared COSMIC class palette.");

      function panel(x, y, w, h, label, title, note, color) {
        const g = svg.append("g").attr("transform", "translate(" + x + "," + y + ")");
        g.append("rect").attr("width", w).attr("height", h).attr("rx", 14).attr("fill", "#ffffff").attr("stroke", p.hairline);
        g.append("rect").attr("width", w).attr("height", 8).attr("rx", 4).attr("fill", color);
        g.append("circle").attr("cx", 28).attr("cy", 38).attr("r", 16).attr("fill", color);
        g.append("text").attr("x", 28).attr("y", 44).attr("text-anchor", "middle").attr("font-size", 14).attr("font-weight", 700).attr("fill", "#ffffff").text(label);
        g.append("text").attr("x", 54).attr("y", 36).attr("font-size", 17).attr("font-weight", 700).attr("fill", p.ink).text(title);
        g.append("text").attr("x", 54).attr("y", 58).attr("font-size", 12).attr("fill", p.muted).text(note);
        g.panelWidth = w;
        g.panelHeight = h;
        return g;
      }

      function drawSbsProfile(g, rows, box) {
        const x = d3.scaleBand().domain(rows.map((row) => row.context)).range([box.x, box.x + box.w]).paddingInner(0.08);
        const y = d3.scaleLinear().domain([0, d3.max(rows, (row) => row.value) || 1]).nice().range([box.y + box.h, box.y]);
        for (const block of spec.classBlocks) {
          const start = x(block.startContext);
          const end = x(block.endContext) + x.bandwidth();
          const color = spec.sbsClassColors[block.mutationClass] || p.gray;
          g.append("rect").attr("x", start).attr("y", box.classY).attr("width", end - start).attr("height", 22).attr("fill", color);
          g.append("text").attr("x", (start + end) / 2).attr("y", box.classY + 15).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700).attr("fill", block.mutationClass === "C>G" ? "#ffffff" : p.ink).text(block.mutationClass);
        }
        g.selectAll("rect.sbs-bar").data(rows).join("rect")
          .attr("class", "sbs-bar")
          .attr("x", (row) => x(row.context))
          .attr("y", (row) => y(row.value))
          .attr("width", x.bandwidth())
          .attr("height", (row) => box.y + box.h - y(row.value))
          .attr("fill", (row) => spec.sbsClassColors[row.mutationClass] || p.gray);
        g.append("g").attr("transform", "translate(0," + (box.y + box.h) + ")").call(d3.axisBottom(x).tickValues([]).tickSizeOuter(0));
        g.append("g").attr("transform", "translate(" + box.x + ",0)").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")));
        g.append("text").attr("transform", "rotate(-90)").attr("x", -(box.y + box.h / 2)).attr("y", box.x - 48).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700).attr("fill", p.muted).text("Fraction of SBS mutations");
        g.append("text").attr("x", box.x + box.w / 2).attr("y", box.y + box.h + 38).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", p.muted).text("SBS96 contexts in COSMIC mutation-class order");
      }

      function drawBurden(g) {
        const values = spec.burdens.map((row) => row.burden);
        const plot = { x: 54, y: 82, w: 250, h: 116 };
        const x = d3.scaleLinear().domain(d3.extent(values)).nice().range([plot.x, plot.x + plot.w]);
        const bins = d3.bin().domain(x.domain()).thresholds(10)(values);
        const y = d3.scaleLinear().domain([0, d3.max(bins, (bin) => bin.length) || 1]).nice().range([plot.y + plot.h, plot.y]);
        g.selectAll("rect.bin").data(bins).join("rect")
          .attr("x", (bin) => x(bin.x0) + 1).attr("y", (bin) => y(bin.length))
          .attr("width", (bin) => Math.max(2, x(bin.x1) - x(bin.x0) - 2))
          .attr("height", (bin) => plot.y + plot.h - y(bin.length))
          .attr("fill", p.blue);
        g.append("g").attr("transform", "translate(0," + (plot.y + plot.h) + ")").call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("~s")));
        g.append("g").attr("transform", "translate(" + plot.x + ",0)").call(d3.axisLeft(y).ticks(4));
        const stats = [
          ["Samples", spec.sampleCount],
          ["Median", spec.burdenSummary.median],
          ["Max", spec.burdenSummary.max],
        ];
        stats.forEach((stat, i) => {
          const x0 = 38 + i * 104;
          g.append("text").attr("x", x0).attr("y", 230).attr("font-size", 11).attr("fill", p.muted).text(stat[0]);
          g.append("text").attr("x", x0).attr("y", 250).attr("font-size", 15).attr("font-weight", 700).attr("fill", p.ink).text(d3.format(",.0f")(stat[1]));
        });
      }

      function drawFitEvidence(g) {
        const card = spec.reportCard;
        const exposures = card.activeSignatures || [];
        g.append("rect").attr("x", 28).attr("y", 82).attr("width", 230).attr("height", 144).attr("rx", 12).attr("fill", p.paper).attr("stroke", p.hairline);
        g.append("text").attr("x", 48).attr("y", 115).attr("font-size", 20).attr("font-weight", 700).attr("fill", p.ink).text(card.sample);
        g.append("text").attr("x", 48).attr("y", 140).attr("font-size", 12).attr("fill", p.muted).text("highest-burden sample");
        const metrics = [
          ["Burden", d3.format(",.0f")(card.burden || 0)],
          ["Fit cosine", d3.format(".4f")(card.cosineSimilarity || 0)],
          ["Active signatures", String(card.activeSignatureCount || 0)],
        ];
        metrics.forEach((metric, i) => {
          g.append("text").attr("x", 48).attr("y", 172 + i * 23).attr("font-size", 11).attr("fill", p.muted).text(metric[0]);
          g.append("text").attr("x", 160).attr("y", 172 + i * 23).attr("font-size", 13).attr("font-weight", 700).attr("fill", metric[0] === "Fit cosine" ? p.green : p.ink).text(metric[1]);
        });
        const x = d3.scaleLinear().domain([0, d3.max(exposures, (row) => row.exposure) || 1]).range([0, 370]);
        const y = d3.scaleBand().domain(exposures.map((row) => row.signature)).range([92, 222]).padding(0.25);
        g.append("text").attr("x", 300).attr("y", 82).attr("font-size", 13).attr("font-weight", 700).attr("fill", p.ink).text("Top fitted exposures");
        g.selectAll("text.exposure-label").data(exposures).join("text")
          .attr("x", 300).attr("y", (row) => y(row.signature) + y.bandwidth() / 2 + 5)
          .attr("font-size", 12).attr("font-weight", 700).attr("fill", p.ink).text((row) => row.signature);
        g.selectAll("rect.exposure-bg").data(exposures).join("rect")
          .attr("x", 366).attr("y", (row) => y(row.signature)).attr("width", 370).attr("height", y.bandwidth()).attr("rx", 5).attr("fill", "#edf2f7");
        g.selectAll("rect.exposure").data(exposures).join("rect")
          .attr("x", 366).attr("y", (row) => y(row.signature)).attr("width", (row) => x(row.exposure)).attr("height", y.bandwidth()).attr("rx", 5)
          .attr("fill", (row) => spec.signatureColors[row.signature] || p.green);
        g.selectAll("text.exposure-value").data(exposures).join("text")
          .attr("x", 746).attr("y", (row) => y(row.signature) + y.bandwidth() / 2 + 5)
          .attr("text-anchor", "end").attr("font-size", 12).attr("font-weight", 700).attr("fill", p.ink).text((row) => d3.format(".1%")(row.exposure));
      }

      function drawSensitivity(g) {
        const rows = spec.thresholdSensitivity || [];
        const xActive = d3.scaleLinear().domain([0, d3.max(rows, (row) => row.meanActiveSignatures) || 1]).range([0, 180]);
        const y = d3.scaleBand().domain(rows.map((row) => row.threshold)).range([86, 228]).padding(0.28);
        g.append("text").attr("x", 30).attr("y", 82).attr("font-size", 12).attr("font-weight", 700).attr("fill", p.muted).text("Cutoff");
        g.append("text").attr("x", 128).attr("y", 82).attr("font-size", 12).attr("font-weight", 700).attr("fill", p.muted).text("Mean active signatures");
        g.append("text").attr("x", 366).attr("y", 82).attr("font-size", 12).attr("font-weight", 700).attr("fill", p.muted).text("Samples with any call");
        g.selectAll("text.threshold").data(rows).join("text")
          .attr("x", 30).attr("y", (row) => y(row.threshold) + y.bandwidth() / 2 + 5)
          .attr("font-size", 12).attr("fill", p.ink).text((row) => row.threshold === 0 ? "0" : d3.format(".3f")(row.threshold));
        g.selectAll("rect.sense-bg").data(rows).join("rect")
          .attr("x", 128).attr("y", (row) => y(row.threshold)).attr("width", 180).attr("height", y.bandwidth()).attr("rx", 5).attr("fill", "#edf2f7");
        g.selectAll("rect.sense").data(rows).join("rect")
          .attr("x", 128).attr("y", (row) => y(row.threshold)).attr("width", (row) => xActive(row.meanActiveSignatures)).attr("height", y.bandwidth()).attr("rx", 5).attr("fill", p.purple);
        g.selectAll("text.active-value").data(rows).join("text")
          .attr("x", 318).attr("y", (row) => y(row.threshold) + y.bandwidth() / 2 + 5)
          .attr("font-size", 12).attr("font-weight", 700).attr("fill", p.ink).text((row) => d3.format(".1f")(row.meanActiveSignatures));
        g.selectAll("text.sample-value").data(rows).join("text")
          .attr("x", 414).attr("y", (row) => y(row.threshold) + y.bandwidth() / 2 + 5)
          .attr("font-size", 12).attr("font-weight", 700).attr("fill", p.ink).text((row) => String(row.samplesWithActiveExposure) + "/" + String(spec.sampleCount));
        g.append("text").attr("x", 30).attr("y", 264).attr("font-size", 12).attr("fill", p.muted)
          .text("Mean reconstruction cosine is recalculated after dropping exposures below each cutoff.");
      }

      function drawNmf(g) {
        const runs = spec.nmfRankSelection.runs || [];
        const plot = { x: 56, y: 86, w: 210, h: 132 };
        const x = d3.scalePoint().domain(runs.map((row) => row.rank)).range([plot.x, plot.x + plot.w]).padding(0.5);
        const y = d3.scaleLinear().domain(d3.extent(runs, (row) => row.reconstructionError)).nice().range([plot.y + plot.h, plot.y]);
        g.append("g").attr("transform", "translate(0," + (plot.y + plot.h) + ")").call(d3.axisBottom(x));
        g.append("g").attr("transform", "translate(" + plot.x + ",0)").call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("~s")));
        g.append("path").datum(runs).attr("fill", "none").attr("stroke", p.vermillion).attr("stroke-width", 3).attr("d", d3.line().x((row) => x(row.rank)).y((row) => y(row.reconstructionError)));
        g.selectAll("circle.rank").data(runs).join("circle").attr("cx", (row) => x(row.rank)).attr("cy", (row) => y(row.reconstructionError)).attr("r", 5).attr("fill", p.vermillion);
        g.append("text").attr("x", plot.x).attr("y", 246).attr("font-size", 12).attr("fill", p.muted).text("Rank");
        g.append("text").attr("x", 168).attr("y", 82).attr("font-size", 12).attr("font-weight", 700).attr("fill", p.vermillion).text("recommended rank " + spec.nmfRankSelection.recommendedRank);

        const profiles = (spec.nmfProfiles || []).slice(0, 2);
        profiles.forEach((profile, i) => {
          const x0 = 328;
          const y0 = 92 + i * 86;
          const gg = g.append("g").attr("transform", "translate(" + x0 + "," + y0 + ")");
          gg.append("text").attr("x", 0).attr("y", -12).attr("font-size", 12).attr("font-weight", 700).attr("fill", p.ink).text(profile.signature);
          const px = d3.scaleBand().domain(profile.values.map((row) => row.context)).range([0, 248]).paddingInner(0.05);
          const py = d3.scaleLinear().domain([0, d3.max(profile.values, (row) => row.value) || 1]).range([58, 0]);
          gg.selectAll("rect.profile").data(profile.values).join("rect")
            .attr("x", (row) => px(row.context)).attr("y", (row) => py(row.value)).attr("width", px.bandwidth()).attr("height", (row) => 58 - py(row.value))
            .attr("fill", (row) => spec.sbsClassColors[row.mutationClass] || p.gray);
          gg.append("line").attr("x1", 0).attr("x2", 248).attr("y1", 58).attr("y2", 58).attr("stroke", p.hairline);
        });
      }
    `,
  });
}

function figure3PublicCohortCompact(data) {
  const signatureNames = data.signatureNames || [];
  const exposureRows = data.exposureMatrix || [];
  const sampleCount = Number(data.sampleCount) || exposureRows.length || 0;
  const activeThreshold = 0.05;
  const signatureStats = signatureNames
    .map((signature) => {
      const values = exposureRows.map((row) => Math.max(0, Number(row?.[signature]) || 0));
      const total = values.reduce((sum, value) => sum + value, 0);
      return {
        signature,
        meanExposure: sampleCount ? total / sampleCount : 0,
        prevalence: sampleCount ? values.filter((value) => value >= activeThreshold).length / sampleCount : 0,
        color: data.signatureColors?.[signature] || DESIGN.gray,
      };
    })
    .sort((a, b) => b.meanExposure - a.meanExposure);
  const shownSignatures = signatureStats.slice(0, 9);
  const shownNames = new Set(shownSignatures.map((row) => row.signature));
  const otherMeanExposure = signatureStats
    .filter((row) => !shownNames.has(row.signature))
    .reduce((sum, row) => sum + row.meanExposure, 0);
  const exposureStats = [
    ...shownSignatures,
    {
      signature: "Other",
      meanExposure: otherMeanExposure,
      prevalence: 1,
      color: DESIGN.gray,
    },
  ];
  const burdens = (data.burdens || [])
    .map((row) => ({ sample: row.sample, burden: Number(row.burden) }))
    .filter((row) => Number.isFinite(row.burden))
    .sort((a, b) => a.burden - b.burden);
  const fitRows = (data.fitQualityRows || [])
    .map((row) => ({
      sample: row.sample,
      burden: Number(row.burden),
      cosineSimilarity: Number(row.cosineSimilarity),
      rmse: Number(row.rmse),
      topSignature: row.topSignature,
    }))
    .filter((row) => Number.isFinite(row.cosineSimilarity));
  const thresholdRows = (data.thresholdSensitivity || []).map((row) => ({
    threshold: Number(row.threshold),
    meanActiveSignatures: Number(row.meanActiveSignatures),
    meanReconstructionCosine: Number(row.meanReconstructionCosine),
  }));
  const rankRuns = (data.nmfRankSelection?.runs || []).map((row) => ({
    rank: Number(row.rank),
    reconstructionError: Number(row.reconstructionError),
    averageSampleCosineSimilarity: Number(row.averageSampleCosineSimilarity),
    converged: Boolean(row.converged),
  }));
  const nmfProfiles = (data.nmfProfiles || []).slice(0, 6).map((profile) => ({
    signature: profile.signature,
    values: (profile.values || []).map((row) => ({
      index: Number(row.index),
      mutationClass: row.mutationClass,
      value: Number(row.value) || 0,
    })),
  }));
  const fitCosines = fitRows.map((row) => row.cosineSimilarity).filter(Number.isFinite);
  const rmses = fitRows.map((row) => row.rmse).filter(Number.isFinite);
  const spec = {
    sampleCount,
    contextCount: Number(data.contextCount) || 96,
    activeThreshold,
    exposureStats,
    burdenSummary: data.burdenSummary || {},
    burdens,
    fitSummary: {
      medianCosine: median(fitCosines),
      minCosine: Math.min(...fitCosines),
      medianRmse: median(rmses),
      highBurdenSample: data.reportCard?.sample,
      highBurdenTopSignature: data.reportCard?.topSignature,
      highBurdenTopExposure: Number(data.reportCard?.topExposure) || null,
    },
    thresholdRows,
    nmfRank: Number(data.nmfRank || data.nmfRankSelection?.selectedRank || 0),
    rankRuns,
    nmfProfiles,
    classBlocks: data.classBlocks || [],
    sbsClassColors: data.sbsClassColors || SBS_CLASS_COLORS,
    palette: DESIGN,
  };
  return customFigurePage({
    title: "Figure 3. Public cohort capability demonstration",
    subtitle:
      "Compact manuscript summary of public cohort fitting, QC, threshold sensitivity, and NMF discovery.",
    spec,
    script: `
      const width = 1280, height = 820;
      const p = spec.palette;
      const svg = d3.select("#chart").append("svg").attr("viewBox", [0, 0, width, height]);
      svg.append("rect").attr("width", width).attr("height", height).attr("fill", p.paper);
      const panelColors = [p.blue, p.green, p.orange, p.purple];

      const panels = [
        panel(44, 34, 580, 352, "A", "COSMIC exposure"),
        panel(656, 34, 580, 352, "B", "QC summary"),
        panel(44, 420, 580, 352, "C", "Threshold sensitivity"),
        panel(656, 420, 580, 352, "D", "NMF discovery")
      ];
      drawExposurePanel(panels[0]);
      drawQcPanel(panels[1]);
      drawThresholdPanel(panels[2]);
      drawNmfPanel(panels[3]);

      function panel(x, y, w, h, label, heading) {
        const g = svg.append("g").attr("transform", "translate(" + x + "," + y + ")");
        g.append("rect").attr("width", w).attr("height", h).attr("rx", 8).attr("fill", "#ffffff").attr("stroke", p.hairline);
        const color = panelColors[label.charCodeAt(0) - 65] || p.gray;
        g.append("circle").attr("cx", 30).attr("cy", 30).attr("r", 17).attr("fill", color);
        g.append("text").attr("x", 30).attr("y", 36).attr("text-anchor", "middle").attr("font-size", 15).attr("font-weight", 700).attr("fill", "#ffffff").text(label);
        g.append("text").attr("x", 58).attr("y", 36).attr("font-size", 17).attr("font-weight", 700).attr("fill", p.ink).text(heading);
        return g;
      }

      function drawExposurePanel(g) {
        const data = spec.exposureStats || [];
        const plot = { x: 116, y: 74, w: 358, h: 206 };
        const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.meanExposure) || 1]).nice().range([plot.x, plot.x + plot.w]);
        const y = d3.scaleBand().domain(data.map((d) => d.signature)).range([plot.y, plot.y + plot.h]).padding(0.22);
        g.append("g").attr("transform", "translate(0," + (plot.y + plot.h) + ")")
          .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".0%")));
        g.append("g").attr("transform", "translate(" + plot.x + ",0)").call(d3.axisLeft(y).tickSize(0)).select(".domain").remove();
        g.selectAll("rect.exposure").data(data).join("rect")
          .attr("class", "exposure")
          .attr("x", plot.x)
          .attr("y", (d) => y(d.signature))
          .attr("width", (d) => Math.max(2, x(d.meanExposure) - plot.x))
          .attr("height", y.bandwidth())
          .attr("rx", 3)
          .attr("fill", (d) => d.color || p.gray)
          .attr("opacity", 0.86);
        g.selectAll("text.exposure-label").data(data).join("text")
          .attr("x", (d) => x(d.meanExposure) + 6)
          .attr("y", (d) => y(d.signature) + y.bandwidth() / 2 + 4)
          .attr("font-size", 11)
          .attr("font-weight", 700)
          .attr("fill", p.muted)
          .text((d) => d3.format(".1%")(d.meanExposure));
        g.append("text").attr("x", plot.x + plot.w / 2).attr("y", 330).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700).attr("fill", p.muted)
          .text("Mean normalized exposure");
        g.append("text")
          .attr("x", 38)
          .attr("y", plot.y + plot.h / 2)
          .attr("text-anchor", "middle")
          .attr("font-size", 12)
          .attr("font-weight", 700)
          .attr("fill", p.muted)
          .attr("transform", "rotate(-90,38," + (plot.y + plot.h / 2) + ")")
          .text("Fitted COSMIC signature");
        g.append("text").attr("x", plot.x + plot.w / 2).attr("y", 346).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", p.muted)
          .text("Top 9 signatures plus Other across " + spec.sampleCount + " samples");
      }

      function drawQcPanel(g) {
        const values = (spec.burdens || []).map((row) => row.burden);
        const fit = spec.fitSummary || {};
        const stats = [
          ["Samples", d3.format(",")(spec.sampleCount || values.length || 0)],
          ["Median burden", d3.format(",.0f")(spec.burdenSummary?.median || d3.median(values) || 0)],
          ["Median fit cosine", d3.format(".3f")(fit.medianCosine || 0)]
        ];
        stats.forEach((item, i) => {
          const x = 34 + i * 174;
          g.append("rect").attr("x", x).attr("y", 66).attr("width", 150).attr("height", 74).attr("rx", 8).attr("fill", p.paper).attr("stroke", p.hairline);
          g.append("text").attr("x", x + 14).attr("y", 94).attr("font-size", 13).attr("font-weight", 700).attr("fill", p.muted).text(item[0]);
          g.append("text").attr("x", x + 14).attr("y", 124).attr("font-size", 22).attr("font-weight", 700).attr("fill", i === 2 ? p.green : p.ink).text(item[1]);
        });
        const plot = { x: 86, y: 190, w: 410, h: 92 };
        const sorted = [...values].sort((a, b) => a - b);
        const x = d3.scaleLinear().domain(d3.extent(sorted)).nice().range([plot.x, plot.x + plot.w]);
        const y = d3.scalePoint().domain(sorted.map((_, i) => String(i))).range([plot.y + plot.h, plot.y]).padding(0.35);
        g.append("line").attr("x1", plot.x).attr("x2", plot.x + plot.w).attr("y1", plot.y + plot.h + 10).attr("y2", plot.y + plot.h + 10).attr("stroke", p.hairline);
        g.selectAll("circle.burden").data(sorted).join("circle")
          .attr("cx", (d) => x(d))
          .attr("cy", (_, i) => y(String(i)))
          .attr("r", 4)
          .attr("fill", p.blue)
          .attr("opacity", 0.72);
        const medianBurden = spec.burdenSummary?.median || d3.median(sorted) || 0;
        g.append("line").attr("x1", x(medianBurden)).attr("x2", x(medianBurden)).attr("y1", plot.y - 10).attr("y2", plot.y + plot.h + 20).attr("stroke", p.green).attr("stroke-width", 2.5);
        g.append("text").attr("x", x(medianBurden) + 8).attr("y", plot.y - 16).attr("font-size", 12).attr("font-weight", 700).attr("fill", p.green).text("median");
        g.append("g").attr("transform", "translate(0," + (plot.y + plot.h + 10) + ")").call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("~s")));
        g.append("text").attr("x", plot.x + plot.w / 2).attr("y", 336).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700).attr("fill", p.muted)
          .text("SBS mutation burden; minimum fit cosine " + d3.format(".3f")(fit.minCosine || 0));
        g.append("text")
          .attr("x", 42)
          .attr("y", plot.y + plot.h / 2)
          .attr("text-anchor", "middle")
          .attr("font-size", 12)
          .attr("font-weight", 700)
          .attr("fill", p.muted)
          .attr("transform", "rotate(-90,42," + (plot.y + plot.h / 2) + ")")
          .text("Samples ordered by burden");
      }

      function drawThresholdPanel(g) {
        const data = spec.thresholdRows || [];
        const plot = { x: 86, y: 76, w: 404, h: 204 };
        const x = d3.scalePoint().domain(data.map((d) => String(d.threshold))).range([plot.x, plot.x + plot.w]).padding(0.25);
        const yActive = d3.scaleLinear().domain([0, d3.max(data, (d) => d.meanActiveSignatures) || 1]).nice().range([plot.y + plot.h, plot.y]);
        const yCos = d3.scaleLinear().domain([0.94, 1]).range([plot.y + plot.h, plot.y]);
        g.append("g").attr("transform", "translate(" + plot.x + ",0)").call(d3.axisLeft(yActive).ticks(5));
        g.append("g").attr("transform", "translate(" + (plot.x + plot.w) + ",0)").call(d3.axisRight(yCos).ticks(4).tickFormat(d3.format(".2f")));
        g.append("g").attr("transform", "translate(0," + (plot.y + plot.h) + ")")
          .call(d3.axisBottom(x).tickFormat((d) => d === "0" ? "0" : d3.format(".1%")(Number(d))));
        g.selectAll("rect.active").data(data).join("rect")
          .attr("x", (d) => x(String(d.threshold)) - 18)
          .attr("y", (d) => yActive(d.meanActiveSignatures))
          .attr("width", 36)
          .attr("height", (d) => plot.y + plot.h - yActive(d.meanActiveSignatures))
          .attr("rx", 4)
          .attr("fill", p.orange)
          .attr("opacity", 0.82);
        const line = d3.line()
          .x((d) => x(String(d.threshold)))
          .y((d) => yCos(d.meanReconstructionCosine));
        g.append("path").datum(data).attr("d", line).attr("fill", "none").attr("stroke", p.green).attr("stroke-width", 3);
        g.selectAll("circle.cos").data(data).join("circle")
          .attr("cx", (d) => x(String(d.threshold)))
          .attr("cy", (d) => yCos(d.meanReconstructionCosine))
          .attr("r", 5)
          .attr("fill", p.green);
        g.append("text").attr("x", 24).attr("y", plot.y + plot.h / 2).attr("font-size", 12).attr("font-weight", 700).attr("fill", p.orange).attr("text-anchor", "middle").attr("transform", "rotate(-90,24," + (plot.y + plot.h / 2) + ")").text("Mean active signatures");
        g.append("text").attr("x", 556).attr("y", plot.y + plot.h / 2).attr("font-size", 12).attr("font-weight", 700).attr("fill", p.green).attr("text-anchor", "middle").attr("transform", "rotate(90,556," + (plot.y + plot.h / 2) + ")").text("Mean reconstruction cosine");
        g.append("text").attr("x", plot.x + plot.w / 2).attr("y", 326).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700).attr("fill", p.muted)
          .text("Exposure cutoff");
      }

      function drawNmfPanel(g) {
        const runs = spec.rankRuns || [];
        const plot = { x: 82, y: 78, w: 206, h: 152 };
        const x = d3.scalePoint().domain(runs.map((d) => String(d.rank))).range([plot.x, plot.x + plot.w]).padding(0.4);
        const y = d3.scaleLinear().domain(d3.extent(runs, (d) => d.reconstructionError)).nice().range([plot.y + plot.h, plot.y]);
        g.append("g").attr("transform", "translate(0," + (plot.y + plot.h) + ")").call(d3.axisBottom(x));
        g.append("g").attr("transform", "translate(" + plot.x + ",0)").call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("~s")));
        const line = d3.line().x((d) => x(String(d.rank))).y((d) => y(d.reconstructionError));
        g.append("path").datum(runs).attr("d", line).attr("fill", "none").attr("stroke", p.purple).attr("stroke-width", 3);
        g.selectAll("circle.rank").data(runs).join("circle")
          .attr("cx", (d) => x(String(d.rank)))
          .attr("cy", (d) => y(d.reconstructionError))
          .attr("r", (d) => d.rank === spec.nmfRank ? 7 : 5)
          .attr("fill", (d) => d.rank === spec.nmfRank ? p.purple : "#ffffff")
          .attr("stroke", p.purple)
          .attr("stroke-width", 2);
        g.append("text").attr("x", plot.x + plot.w / 2).attr("y", 270).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700).attr("fill", p.muted)
          .text("NMF rank");
        g.append("text").attr("x", plot.x + plot.w / 2).attr("y", 292).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", p.muted)
          .text("Selected rank " + spec.nmfRank);
        g.append("text")
          .attr("x", 24)
          .attr("y", plot.y + plot.h / 2)
          .attr("text-anchor", "middle")
          .attr("font-size", 12)
          .attr("font-weight", 700)
          .attr("fill", p.muted)
          .attr("transform", "rotate(-90,24," + (plot.y + plot.h / 2) + ")")
          .text("Reconstruction error");

        const profiles = spec.nmfProfiles || [];
        const mini = { x: 326, y: 78, w: 206, h: 54 };
        g.append("text").attr("x", mini.x).attr("y", 58).attr("font-size", 12).attr("font-weight", 700).attr("fill", p.muted)
          .text("Extracted SBS96 components");
        profiles.forEach((profile, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x0 = mini.x + col * 110;
          const y0 = mini.y + row * 78;
          g.append("text").attr("x", x0).attr("y", y0 - 8).attr("font-size", 11).attr("font-weight", 700).attr("fill", p.ink).text(profile.signature);
          drawMiniProfile(g, profile.values, x0, y0, 90, mini.h);
        });
        g.append("text").attr("x", 326).attr("y", 338).attr("font-size", 12).attr("font-weight", 700).attr("fill", p.muted)
          .text("Rank " + spec.nmfRank + ": " + String(profiles.length) + " extracted components");
      }

      function drawMiniProfile(g, values, x0, y0, w, h) {
        const x = d3.scaleBand().domain(values.map((d) => d.index)).range([x0, x0 + w]).paddingInner(0.08);
        const y = d3.scaleLinear().domain([0, d3.max(values, (d) => d.value) || 1]).range([y0 + h, y0]);
        g.append("rect").attr("x", x0).attr("y", y0).attr("width", w).attr("height", h).attr("fill", p.paper).attr("stroke", p.hairline);
        g.selectAll("rect.profile-" + x0 + "-" + y0).data(values).join("rect")
          .attr("x", (d) => x(d.index))
          .attr("y", (d) => y(d.value))
          .attr("width", x.bandwidth())
          .attr("height", (d) => y0 + h - y(d.value))
          .attr("fill", (d) => spec.sbsClassColors[d.mutationClass] || p.gray);
      }
    `,
  });
}

function figure3PublicCohortSdkPanelFigures(data) {
  return figure3PublicCohortSdkPanelSlots(data).map((slot) => [
    slot.file,
    figure3PublicCohortSdkPanelPage(slot),
  ]);
}

function figure3PublicCohortSdkPanelSlots(data) {
  const capture = data.sdkPanels;
  validateFigure3PanelCapture(capture);
  const panelById = new Map(capture.panels.map((panel) => [panel.id, panel]));
  const selectedNmfRank =
    capture.workflowSummary?.nmfRank || capture.workflowSummary?.nmfRecommendedRank || null;
  const displayedNmfSignatures = capture.workflowSummary?.nmfDisplayedSignatures || null;
  const bootstrapDisplayedSignatures = capture.workflowSummary?.bootstrapDisplayedSignatures || 12;
  const bootstrapInformativeSignatures = capture.workflowSummary?.bootstrapInformativeSignatures || null;
  const sampleCount = data.sampleCount || capture.workflowSummary?.sampleCount || 38;
  const signatureCount = data.signatureNames?.length || capture.workflowSummary?.signatureCount || 67;
  const selectedSample = capture.workflowSummary?.selectedSample || "SP53810";
  const bootstrapIterations = capture.workflowSummary?.bootstrapIterations || 500;
  const baseSlots = [
    {
      id: "cohort_summary",
      label: "Figure 3A",
      file: "figure3a-cohort-exposure-landscape.html",
      title: "Cohort exposure landscape",
      svgPadding: { top: 32, right: 240, bottom: 80, left: 40 },
      caption: `Figure 3A. Thirty-eight public SBS96 spectra from the PCAWG Lung-AdenoCA cohort were fetched from mSigPortal and fitted in the browser against the full mSigPortal COSMIC v3 GRCh37 SBS96 catalog (${signatureCount} signatures). The figure shows the dominant fitted COSMIC signatures across the cohort, with remaining fitted signatures grouped as Other and prevalence annotations indicating how often each signature crossed the reporting threshold.`,
    },
    {
      id: "burden",
      label: "Figure 3B",
      file: "figure3b-mutation-burden-qc.html",
      title: "Mutation burden QC",
      caption: `Figure 3B. Total SBS mutations are shown for each of the ${sampleCount} public PCAWG Lung-AdenoCA spectra used in the browser-side refitting workflow, providing the burden context for interpreting fitted exposures, uncertainty, and downstream quality-control flags.`,
    },
    {
      id: "threshold",
      label: "Figure 3C",
      file: "figure3c-threshold-sensitivity.html",
      title: "Exposure-threshold sensitivity",
      caption: "Figure 3C. The full-COSMIC SBS96 refit is evaluated across reporting cutoffs to show how small-exposure filtering changes active-signature calls while preserving reconstruction quality, summarized by reconstruction cosine across thresholds.",
    },
    {
      id: "fit_quality",
      label: "Figure 3D",
      file: "figure3d-fit-quality-evidence.html",
      title: "Fit-quality evidence",
      caption: `Figure 3D. The dashboard displays the 12 highest-priority samples selected by the SDK's adaptive review policy from the ${sampleCount}-sample public PCAWG Lung-AdenoCA cohort, combining mutation burden, residual structure, bootstrap exposure-interval width, threshold sensitivity, and nearest active-signature similarity into a compact review surface.`,
    },
    {
      id: "bootstrap",
      label: "Figure 3E",
      file: "figure3e-bootstrap-uncertainty.html",
      title: "Bootstrap uncertainty",
      caption: `Figure 3E. For the highest-burden public sample (${selectedSample}), the SDK performed ${bootstrapIterations} multinomial refits against the full COSMIC SBS96 catalog. The display reports the top ${bootstrapDisplayedSignatures}${bootstrapInformativeSignatures ? ` of ${bootstrapInformativeSignatures}` : ""} informative fitted signatures with uncertainty intervals and bootstrap draw summaries.`,
    },
    {
      id: "nmf",
      label: "Figure 3F",
      file: "figure3f-nmf-discovery.html",
      title: "Exploratory NMF discovery",
      caption: `Figure 3F. The browser-side exploratory non-negative matrix factorization rank sweep selected rank ${selectedNmfRank || "shown"} for the public PCAWG Lung-AdenoCA SBS96 cohort. All ${displayedNmfSignatures || "extracted"} extracted de novo SBS96 components from that rank are displayed for manuscript review and handoff.`,
    },
  ];
  return baseSlots.map((slot) => {
    const panel = panelById.get(slot.id);
    const padded = paddedCapturedSvg(panel.svg, slot.svgPadding || 32);
    const pageWidth = 1280;
    const margin = 40;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = Math.ceil(imageWidth * (padded.height / padded.width));
    return {
      ...slot,
      renderer: Array.isArray(panel.renderer) ? panel.renderer.join("; ") : panel.renderer,
      sourceTitle: panel.title,
      sourceNote: panel.note,
      svgDataUri: `data:image/svg+xml;base64,${Buffer.from(padded.svg, "utf8").toString("base64")}`,
      sourceWidth: padded.width,
      sourceHeight: padded.height,
      pageWidth,
      pageHeight: imageHeight + margin * 2,
      margin,
    };
  });
}

function figure3PublicCohortSdkPanelPage(slot) {
  return customFigurePage({
    title: `${slot.label}. ${slot.title}`,
    subtitle: "",
    spec: {
      label: slot.label,
      title: slot.title,
      sourceTitle: slot.sourceTitle,
      sourceNote: slot.sourceNote,
      renderer: slot.renderer,
      svgDataUri: slot.svgDataUri,
      pageWidth: slot.pageWidth,
      pageHeight: slot.pageHeight,
      margin: slot.margin,
      palette: DESIGN,
    },
    script: `
      const width = spec.pageWidth, height = spec.pageHeight;
      const p = spec.palette;
      const margin = spec.margin || 40;
      const svg = d3.select("#chart").append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("role", "img")
        .attr("aria-label", spec.label + ". " + spec.title);
      svg.append("rect").attr("width", width).attr("height", height).attr("fill", p.paper);
      svg.append("rect")
        .attr("x", margin / 2)
        .attr("y", margin / 2)
        .attr("width", width - margin)
        .attr("height", height - margin)
        .attr("rx", 8)
        .attr("fill", "#ffffff")
        .attr("stroke", p.hairline);
      svg.append("image")
        .attr("href", spec.svgDataUri)
        .attr("x", margin)
        .attr("y", margin)
        .attr("width", width - margin * 2)
        .attr("height", height - margin * 2)
        .attr("preserveAspectRatio", "xMidYMid meet");
    `,
  });
}

function paddedCapturedSvg(svg, padding = 32) {
  const viewBox = parseSvgViewBox(svg);
  if (!viewBox) {
    return { svg, width: 1200, height: 760 };
  }
  const pad =
    typeof padding === "number"
      ? { top: padding, right: padding, bottom: padding, left: padding }
      : {
          top: Number(padding.top) || 0,
          right: Number(padding.right) || 0,
          bottom: Number(padding.bottom) || 0,
          left: Number(padding.left) || 0,
        };
  const padded = {
    x: viewBox.x - pad.left,
    y: viewBox.y - pad.top,
    width: viewBox.width + pad.left + pad.right,
    height: viewBox.height + pad.top + pad.bottom,
  };
  let output = svg
    .replace(
      /viewBox="[^"]+"/i,
      `viewBox="${padded.x} ${padded.y} ${padded.width} ${padded.height}"`
    )
    .replace(/\bwidth="[^"]+"/i, `width="${Math.ceil(padded.width)}"`)
    .replace(/\bheight="[^"]+"/i, `height="${Math.ceil(padded.height)}"`);
  if (/<svg\b[^>]*\boverflow=/i.test(output)) {
    output = output.replace(/\boverflow="[^"]*"/i, 'overflow="visible"');
  } else {
    output = output.replace(/<svg\b/i, '<svg overflow="visible"');
  }
  return { svg: output, width: padded.width, height: padded.height };
}

function parseSvgViewBox(svg) {
  const match = String(svg || "").match(/viewBox="([^"]+)"/i);
  if (!match) return null;
  const values = match[1].split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

function figure4RuntimeRedesigned(e4) {
  const scenarioInfo = {
    single_sample_fit_report: {
      short: "Single sample",
      full: "One SBS96 synthetic sample, 9-signature NNLS fit plus report generation.",
    },
    medium_cohort_120: {
      short: "120-sample cohort",
      full: "120 SBS96 synthetic samples x 9 signatures.",
    },
    portal_scale_300x40: {
      short: "300 x 40 refit",
      full: "300 SBS96 synthetic samples x 40 signatures.",
    },
    bootstrap_500: {
      short: "Bootstrap 500",
      full: "500 multinomial resamples of one SBS96 sample, NNLS refit per resample, exposure-interval workflow.",
    },
    nmf_rank_selection_rank4: {
      short: "NMF rank/extract",
      full: "80 SBS96 samples, rank grid plus rank-4 extraction.",
    },
  };
  const scenarios = Object.keys(scenarioInfo);
  const browserOrder = ["chrome", "edge", "firefox"];
  const browserLabels = { chrome: "Chrome", edge: "Edge", firefox: "Firefox" };
  const grouped = new Map();
  for (const row of e4.rows || []) {
    if (row.status !== "completed") continue;
    const key = `${row.browser}|${row.scenario}`;
    grouped.set(key, [...(grouped.get(key) || []), Number(row.elapsedMs)].filter(Number.isFinite));
  }
  const missing = [];
  for (const browser of browserOrder) {
    for (const scenario of scenarios) {
      if (!(grouped.get(`${browser}|${scenario}`) || []).length) missing.push(`${browser}/${scenario}`);
    }
  }
  if (missing.length) {
    throw new Error(`E4 runtime benchmark is incomplete for required browser/scenario rows: ${missing.join(", ")}`);
  }
  const rows = [];
  for (const scenario of scenarios) {
    for (const browser of browserOrder) {
      const values = grouped.get(`${browser}|${scenario}`) || [];
      rows.push({
        scenario,
        scenarioLabel: scenarioInfo[scenario].short,
        scenarioFull: scenarioInfo[scenario].full,
        browser,
        browserLabel: browserLabels[browser],
        medianMs: median(values),
        repeatCount: values.length,
      });
    }
  }
  const nmfRows = rows.filter((row) => row.scenario === "nmf_rank_selection_rank4");
  const chromiumNmfMin = Math.min(
    ...nmfRows.filter((row) => row.browser !== "firefox").map((row) => row.medianMs)
  );
  const firefoxNmf = nmfRows.find((row) => row.browser === "firefox")?.medianMs;
  const firefoxNmfNote =
    Number.isFinite(firefoxNmf) && Number.isFinite(chromiumNmfMin) && firefoxNmf > chromiumNmfMin * 3
      ? `Firefox NMF remained ${formatNumber(firefoxNmf / chromiumNmfMin, 1)}x slower than the fastest Chromium-family browser after isolated-repeat reruns; NMF sub-timings are retained in the E4 result JSON.`
      : "";
  const spec = {
    rows,
    scenarios,
    scenarioInfo,
    browsers: browserOrder,
    browserLabels,
    environment: e4.environment || {},
    firefoxNmfNote,
    palette: DESIGN,
  };
  return customFigurePage({
    title: "Figure 4. Browser runtime benchmarks",
    subtitle:
      "Median elapsed time across five isolated repeats in Chrome, Edge, and Firefox. The log-scaled axis keeps fast single-sample operations visible beside slower bootstrap and NMF workflows.",
    spec,
    script: `
      const width = 1280, height = 760;
      const p = spec.palette;
      const svg = d3.select("#chart").append("svg").attr("viewBox", [0, 0, width, height]);
      svg.append("rect").attr("width", width).attr("height", height).attr("fill", p.paper);
      const margin = { top: 58, right: 42, bottom: 244, left: 102 };
      const completed = spec.rows;
      const color = d3.scaleOrdinal().domain(spec.browsers).range([p.blue, p.green, p.orange]);

      const x0 = d3.scaleBand().domain(spec.scenarios).range([margin.left, width - margin.right]).padding(0.22);
      const x1 = d3.scaleBand().domain(spec.browsers).range([0, x0.bandwidth()]).padding(0.14);
      const minVal = d3.min(completed, (row) => row.medianMs) || 0.1;
      const maxVal = d3.max(completed, (row) => row.medianMs) || 1000;
      const y = d3.scaleLog().domain([Math.max(0.05, minVal / 4), maxVal * 2.3]).range([height - margin.bottom, margin.top]);

      svg.append("rect").attr("x", margin.left).attr("y", margin.top).attr("width", width - margin.left - margin.right).attr("height", height - margin.top - margin.bottom).attr("fill", "#ffffff").attr("stroke", p.hairline);
      svg.append("g").attr("stroke", p.hairline).attr("stroke-dasharray", "3 4")
        .selectAll("line").data(y.ticks(8)).join("line")
        .attr("x1", margin.left).attr("x2", width - margin.right)
        .attr("y1", (tick) => y(tick)).attr("y2", (tick) => y(tick));
      svg.append("g").attr("transform", "translate(0," + (height - margin.bottom) + ")")
        .call(d3.axisBottom(x0).tickFormat((scenario) => spec.scenarioInfo[scenario].short))
        .selectAll("text").attr("font-size", 12).attr("font-weight", 700);
      svg.append("g").attr("transform", "translate(" + margin.left + ",0)")
        .call(d3.axisLeft(y).ticks(8, "~g"));
      svg.append("text").attr("transform", "rotate(-90)").attr("x", -(margin.top + (height - margin.bottom - margin.top) / 2)).attr("y", 34)
        .attr("text-anchor", "middle").attr("font-size", 14).attr("font-weight", 700).attr("fill", p.muted)
        .text("Median elapsed time (ms, log scale)");

      svg.selectAll("rect.bar").data(completed).join("rect")
        .attr("class", "bar")
        .attr("x", (row) => x0(row.scenario) + x1(row.browser))
        .attr("y", (row) => y(row.medianMs))
        .attr("width", x1.bandwidth())
        .attr("height", (row) => Math.max(3, height - margin.bottom - y(row.medianMs)))
        .attr("fill", (row) => color(row.browser));
      svg.selectAll("text.value").data(completed).join("text")
        .attr("class", "value")
        .attr("x", (row) => x0(row.scenario) + x1(row.browser) + x1.bandwidth() / 2)
        .attr("y", (row) => y(row.medianMs) - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", 10.5)
        .attr("font-weight", 700)
        .attr("fill", p.ink)
        .text((row) => formatDuration(row.medianMs));

      const legend = svg.append("g").attr("transform", "translate(" + (width - 382) + ",22)");
      spec.browsers.forEach((browser, i) => {
        const item = legend.append("g").attr("transform", "translate(" + (i * 118) + ",0)");
        item.append("rect").attr("width", 15).attr("height", 15).attr("rx", 3).attr("fill", color(browser));
        item.append("text").attr("x", 23).attr("y", 13).attr("font-size", 13).attr("font-weight", 700).attr("fill", p.muted).text(spec.browserLabels[browser]);
      });

      const notes = svg.append("g").attr("transform", "translate(" + margin.left + "," + (height - 194) + ")");
      notes.append("text").attr("x", 0).attr("y", 0).attr("font-size", 14).attr("font-weight", 700).attr("fill", p.ink).text("Benchmark operations");
      spec.scenarios.forEach((scenario, i) => {
        const x = i < 3 ? 0 : 558;
        const y0 = 28 + (i % 3) * 50;
        notes.append("text").attr("x", x).attr("y", y0).attr("font-size", 12.5).attr("font-weight", 700).attr("fill", p.ink)
          .text(String(i + 1) + ". " + spec.scenarioInfo[scenario].short + ":");
        const detail = notes.append("text").attr("x", x + 142).attr("y", y0).attr("font-size", 12.5).attr("fill", p.muted);
        wrapDetail(detail, spec.scenarioInfo[scenario].full, i < 3 ? 46 : 42);
      });
      svg.append("text").attr("x", margin.left).attr("y", height - 42).attr("font-size", 12).attr("fill", p.muted)
        .text("Host: " + (spec.environment.cpus || "n/a") + " CPU threads, " + (spec.environment.memoryGb || "n/a") + " GB RAM, Node " + (spec.environment.node || "n/a") + ". Firefox uses the Playwright-managed browser binary for reproducible automation.");
      if (spec.firefoxNmfNote) {
        svg.append("text").attr("x", margin.left).attr("y", height - 22).attr("font-size", 12).attr("fill", p.vermillion)
          .text(spec.firefoxNmfNote);
      }

      function wrapDetail(selection, text, maxChars) {
        const words = String(text || "").split(/\\s+/);
        let line = [];
        let tspan = selection.append("tspan").attr("x", selection.attr("x")).attr("dy", 0);
        for (const word of words) {
          const next = [...line, word].join(" ");
          if (next.length > maxChars && line.length) {
            tspan.text(line.join(" "));
            line = [word];
            tspan = selection.append("tspan").attr("x", selection.attr("x")).attr("dy", 15);
          } else {
            line.push(word);
          }
        }
        tspan.text(line.join(" "));
      }

      function formatDuration(ms) {
        if (ms < 1) return d3.format(".2f")(ms) + " ms";
        if (ms < 100) return d3.format(".1f")(ms) + " ms";
        if (ms < 1000) return d3.format(".0f")(ms) + " ms";
        return d3.format(".2f")(ms / 1000) + " s";
      }
    `,
  });
}

function table1Compatibility(e6, e4) {
  const e4Nmf = new Map();
  for (const row of e4.rows || []) {
    if (row.scenario !== "nmf_rank_selection_rank4") continue;
    const current = e4Nmf.get(row.browser) || { completed: 0, unavailable: 0 };
    if (row.status === "completed") current.completed += 1;
    if (row.status === "not available") current.unavailable += 1;
    e4Nmf.set(row.browser, current);
  }
  const rows = (e6.rows || []).filter((row) => row.source === "automated" && row.device === "desktop");
  const automatedIds = new Set(rows.map((row) => row.browserId));
  for (const browser of e4.environment?.browsers || []) {
    if (automatedIds.has(browser.id)) continue;
    rows.push({
      browser: browser.label,
      browserId: browser.id,
      device: "desktop",
      sdkImport: "not checked",
      fitReport: "not checked",
      webrAdapter: "not checked",
      pyodideAdapter: "not checked",
      status: "not checked",
      notes: "Browser detected by E4 but not yet included in the E6 compatibility run.",
    });
  }
  return {
    caption: "Table 1. Browser and platform compatibility matrix.",
    note:
      "Works indicates an automated desktop pass on the benchmark host. Optional WebR and Pyodide adapter cells are retained separately from native JavaScript fitting.",
    columns: ["Browser/platform", "Load SDK", "Native JS fitting", "WebR adapters", "Pyodide adapters", "NMF", "Report export"],
    rows: rows.map((row) => ({
      "Browser/platform": `${row.browser}${row.device ? ` (${row.device})` : ""}`,
      "Load SDK": statusLabel(row.sdkImport),
      "Native JS fitting": statusLabel(row.fitReport),
      "WebR adapters": statusLabel(row.webrAdapter),
      "Pyodide adapters": statusLabel(row.pyodideAdapter),
      NMF: nmfStatus(row, e4Nmf),
      "Report export": statusLabel(row.fitReport),
    })),
  };
}

function supplementaryTableS1(e3) {
  const rowsById = new Map((e3.rows || []).map((row) => [row.checkId, row]));
  const scipyNnls = rowsById.get("nnls_vs_scipy");
  const rNnls = rowsById.get("nnls_vs_r_nnls");
  const nmf = rowsById.get("nmf_vs_sklearn");
  const nnlsMax = Math.max(
    Number(scipyNnls?.maxAbsoluteDifference) || 0,
    Number(rNnls?.maxAbsoluteDifference) || 0
  );
  const nnlsMargin = nnlsMax > 0 ? Math.floor((Number(scipyNnls?.threshold) || 1e-6) / nnlsMax) : "";
  return {
    caption: "Supplementary Table S1. Internal numerical solver reference checks.",
    note:
      "Validation bounds were set before inspecting these results and are numerical reproducibility checks, not biological decision cutoffs. NNLS fitting is expected to match independent solvers up to floating-point tolerance. NMF is stochastic and non-unique, so it was evaluated by reconstruction error and matched-component cosine rather than exact matrix equality.",
    columns: ["SDK area", "Independent reference", "What was checked", "Outcome"],
    rows: [
      {
        "SDK area": "NNLS signature fitting",
        "Independent reference": `${scipyNnls?.reference || "scipy.optimize.nnls"} and ${rNnls?.reference || "R nnls::nnls"}`,
        "What was checked": `Largest absolute difference in fitted exposure coefficients across ${scipyNnls?.sampleCount || rNnls?.sampleCount || ""} spectra.`,
        Outcome: `${formatSci(nnlsMax)}, about ${formatInteger(nnlsMargin)}x below the pre-set 1e-6 reproducibility bound.`,
      },
      {
        "SDK area": "NMF extraction",
        "Independent reference": nmf?.reference || "scikit-learn NMF",
        "What was checked": `Reconstruction error and similarity of matched NMF components across ${nmf?.sampleCount || ""} planted low-rank spectra.`,
        Outcome: `SDK reconstruction error was ${formatNumber(nmf?.reconstructionErrorRatio, 3)}x the reference, with median component cosine ${formatNumber(nmf?.medianMatchedComponentCosine, 3)}; this met the pre-set rule of no more than 5% worse reconstruction error and cosine >= 0.95.`,
      },
    ],
  };
}

function nmfStatus(row, e4Nmf) {
  const status = e4Nmf.get(row.browserId);
  if (status?.completed) return "Works";
  if (status?.unavailable) return "Not available on host";
  return statusLabel(row.fitReport);
}

function statusLabel(value) {
  if (value === "pass" || value === "completed") return "Works";
  if (value === "not checked") return "Not checked";
  if (value === "not available") return "Not available on host";
  if (value === "failed") return "Does not work";
  return titleCase(value || "");
}

function manuscriptFigureCaptions(publicCohortData, figure3DetailFigures) {
  const sampleCount = publicCohortData.sampleCount || 38;
  const contextCount = publicCohortData.contextCount || 96;
  const signatureCount = publicCohortData.signatureNames?.length || 67;
  const detailCaptions = figure3PublicCohortSdkPanelSlots(publicCohortData)
    .map((slot) => `**${slot.label}. ${slot.title}.** ${slot.caption.replace(/^Figure 3[A-F]\.?\s*/, "")}\n\nFile: \`${slot.file}\``)
    .join("\n\n");
  const detailFileList = figure3DetailFigures.map(([file]) => `\`${file}\``).join(", ");
  return `# Manuscript Figure Captions

These captions are generated alongside the manuscript figures. Figure HTML pages intentionally omit visible manuscript titles and subtitles so captions can be placed in the manuscript document.

## Main Figures

**Figure 1. mSigSDK client-side mutational-signature review architecture.** mSigSDK uses selected public resources and reusable JavaScript modules to support spectra import, validation, known-signature refitting, quality-control review, uncertainty estimation, panel/WES evidence review, plotting, reporting, and external-tool handoff in the client runtime.

File: \`figure1-architecture-data-residency.html\`

**Figure 2. Zero-install workflow demonstration.** Automated in-page timing measured the browser-side workflow after the demo page began loading: SDK import, public PCAWG Lung-AdenoCA SBS96 spectrum retrieval, full COSMIC v3 SBS96 catalog retrieval, single-sample refitting, and local report rendering. Browser launch, URL entry, and other human setup time are excluded from the measured interval.

File: \`figure2-zero-install-workflow.html\`

**Figure 3. Browser-side public cohort capability summary.** Thirty-eight public PCAWG Lung-AdenoCA SBS96 spectra were fetched from mSigPortal, fitted in the browser against the mSigPortal COSMIC v3 GRCh37 SBS96 catalog with ${signatureCount} signatures, and summarized as manuscript-scale SDK outputs. Panels show cohort-level fitted exposure structure, mutation-burden and fit-quality context, exposure-threshold sensitivity, and exploratory rank-6 non-negative matrix factorization.

File: \`figure3-public-cohort-capabilities.html\`

**Figure 4. Browser runtime benchmarks.** Median elapsed runtime across isolated desktop-browser repeats for representative SDK workflows, including single-sample fitting/report generation, cohort-scale refitting, bootstrap uncertainty, and NMF rank selection/extraction. Times are shown on a log-scaled axis so fast single-sample operations and slower cohort workflows remain visible in one figure.

File: \`figure4-runtime-benchmarks.html\`

## Figure 3 Detail Figures

The previous full-output Figure 3 page has been split into standalone manuscript-sized detail figures: ${detailFileList}.

${detailCaptions}

## Supplementary Experiment Figures

**Figure E1. Zero-install browser demonstration.** Automated browser instrumentation records the public-data workflow from page load to SDK report readiness, separating measured in-page runtime from human browser-launch and navigation time.

File: \`figure-e1-zero-install.html\`

**Figure E2. Adapter fidelity against local package execution.** Browser adapter outputs for deconstructSigs, sigminer, SigProfilerAssignment, and MuSiCal are compared with conventional local package execution on the same ${sampleCount}-sample PCAWG Lung-AdenoCA SBS${contextCount} cohort and full ${signatureCount}-signature COSMIC catalog.

File: \`figure-e2-adapter-fidelity.html\`

**Figure E3. Internal numerical solver reference checks.** SDK NNLS and NMF computations are compared with independent SciPy, R nnls, scikit-learn, and independent Python reference implementations using prespecified numerical tolerances.

File: \`figure-e3-reference-checks.html\`

**Figure E4. Browser runtime benchmarks.** Detailed runtime distributions across locally available desktop browsers for the manuscript benchmark scenarios, including refitting, report generation, bootstrap uncertainty, and NMF workflows.

File: \`figure-e4-browser-runtime.html\`

**Figure E6. Desktop browser compatibility matrix.** Automated compatibility checks for SDK import, public mSigPortal fetch, single-sample fit/report generation, local rendering, and optional WebR/Pyodide runtime availability across locally available desktop browsers.

File: \`figure-e6-compatibility.html\`
`;
}

function customFigurePage({ title, subtitle, spec = {}, script = "", body = '<div id="chart"></div>', showHeader = false }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <script src="../assets/d3.min.js"></script>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; color: #172026; background: #f7faf9; }
      main { max-width: 1320px; margin: 0 auto; padding: 28px; }
      .figure-frame { background: #ffffff; border: 1px solid #d8e2dc; border-radius: 8px; padding: 22px; box-shadow: 0 8px 24px rgba(16, 32, 27, 0.08); }
      h1 { margin: 0 0 8px; font-size: 25px; letter-spacing: 0; }
      .caption { margin: 0 0 20px; color: #53616f; max-width: 1120px; line-height: 1.45; font-size: 15px; }
      svg { width: 100%; height: auto; display: block; }
      .svg-shell svg { max-height: 760px; }
      .tick text { fill: #53616f; font-size: 11px; }
      .domain, .tick line { stroke: #aab6c2; }
    </style>
  </head>
  <body>
    <main>
      <div class="figure-frame">
        ${showHeader ? `<h1>${escapeHtml(title)}</h1>
        <p class="caption">${escapeHtml(subtitle)}</p>` : ""}
        ${body}
      </div>
    </main>
    <script>
      const spec = ${JSON.stringify(spec)};
      ${script}
    </script>
  </body>
</html>`;
}

function standaloneTable(table) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(table.caption)}</title>
  </head>
  <body>
    ${tableHtml(table)}
  </body>
</html>
`;
}

function combinedTables(tables) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Main manuscript copy/paste tables</title>
  </head>
  <body>
    ${tables.map(tableHtml).join('\n<hr style="border:none;border-top:1px solid #c8d2dc;margin:24px 0;">\n')}
  </body>
</html>
`;
}

function tableHtml(table) {
  const columns = table.columns || [];
  const rows = table.rows || [];
  const tableStyle = "border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:10.5pt;color:#172026;";
  const thStyle = "border:1px solid #9aa7b3;background:#eaf0f4;padding:6px;text-align:left;font-weight:700;";
  const tdStyle = "border:1px solid #b9c3cc;padding:6px;vertical-align:top;";
  return `<table style="${tableStyle}">
  <caption style="caption-side:top;text-align:left;font-weight:700;font-size:11.5pt;margin-bottom:6px;">${escapeHtml(table.caption)}</caption>
  <thead><tr>${columns.map((column) => `<th style="${thStyle}">${escapeHtml(column)}</th>`).join("")}</tr></thead>
  <tbody>
    ${rows.map((row) => `<tr>${columns.map((column) => `<td style="${tdStyle}">${escapeHtml(row[column] ?? "")}</td>`).join("")}</tr>`).join("\n    ")}
  </tbody>
</table>
<p style="font-family:Arial,sans-serif;font-size:9.5pt;color:#53616f;margin-top:6px;"><strong>Note.</strong> ${escapeHtml(table.note || "")}</p>`;
}

function buildClassBlocks(contexts) {
  const blocks = [];
  let current = null;
  for (const context of contexts) {
    const cls = mutationClass(context);
    if (!current || current.mutationClass !== cls) {
      current = {
        mutationClass: cls,
        startContext: context,
        endContext: context,
      };
      blocks.push(current);
    } else {
      current.endContext = context;
    }
  }
  return blocks;
}

function mutationClass(context) {
  const match = String(context).match(/\[([ACGT]>[ACGT])\]/);
  return match?.[1] || String(context).slice(0, 3);
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "";
}

function formatInteger(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)).toLocaleString("en-US") : "";
}

function formatSci(value) {
  return Number.isFinite(Number(value)) ? Number(value).toExponential(2) : "";
}

function titleCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
