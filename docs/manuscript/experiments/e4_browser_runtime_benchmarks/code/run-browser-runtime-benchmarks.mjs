import path from "node:path";
import {
  createResult,
  ensureDir,
  environmentSummary,
  EXPERIMENTS,
  findAvailableBrowsers,
  launchBrowser,
  numericArg,
  parseArgs,
  relativeArtifact,
  tempDir,
  unavailableBrowserRows,
  withStaticServer,
  writeCsv,
  writeJson,
  writeText,
} from "../../../../../scripts/manuscript/lib/experiment-utils.mjs";
import {
  generateSyntheticSignatures,
  generateSyntheticSpectra,
} from "../../../../../scripts/manuscript/lib/demo-data.mjs";

const EXPERIMENT = EXPERIMENTS.e4;
const RESULT_PATH = path.join(EXPERIMENT.dir, "data", "browser-runtime-results.json");
const CSV_PATH = path.join(EXPERIMENT.dir, "data", "browser_runtime_results.csv");
const HARNESS_PATH = path.join(EXPERIMENT.dir, "browser-runtime-harness.html");

const args = parseArgs();
const repeats = numericArg(args, "repeats", 5);
const timeoutMs = numericArg(args, "timeout-ms", 240000);
const requestedBrowsers = String(args.browsers || "chrome,edge,firefox")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const scenarios = [
  "single_sample_fit_report",
  "medium_cohort_120",
  "portal_scale_300x40",
  "bootstrap_500",
  "nmf_rank_selection_rank4",
];

await ensureDir(path.dirname(RESULT_PATH));
await writeText(HARNESS_PATH, browserRuntimeHarness());

const allBrowsers = await findAvailableBrowsers();
const browsers = allBrowsers.filter((browser) => requestedBrowsers.includes(browser.id));
const rows = [
  ...unavailableBrowserRows(browsers, scenarios, { repeat: null, elapsedMs: null }),
];
const notes = [];

const benchmarkData = buildBenchmarkData();

await withStaticServer(process.cwd(), async ({ baseUrl }) => {
  for (const browser of browsers) {
    for (const scenario of scenarios) {
      for (let repeat = 1; repeat <= repeats; repeat += 1) {
        let context = null;
        try {
          context = await launchBrowser(browser, {
            userDataDir: tempDir(`e4-${browser.id}-${scenario}-${repeat}-profile`),
            viewport: { width: 1440, height: 1000 },
          });
          const page = await context.newPage();
          page.setDefaultTimeout(timeoutMs);
          page.on("pageerror", (error) => notes.push(`${browser.id}/${scenario}/${repeat}: ${error.message}`));
          await page.goto(
            `${baseUrl}/docs/manuscript/experiments/e4_browser_runtime_benchmarks/browser-runtime-harness.html?run=${Date.now()}-${browser.id}-${scenario}-${repeat}`,
            {
              waitUntil: "domcontentloaded",
              timeout: timeoutMs,
            }
          );
          await page.waitForFunction(() => window.__MSIG_BENCH_READY__ === true, null, {
            timeout: timeoutMs,
          });
          const output = await page.evaluate(
            async ({ scenario, repeat, data }) => window.__runMsigBenchmark(scenario, repeat, data),
            { scenario, repeat, data: benchmarkData[scenario] }
          );
          rows.push({
            browser: browser.id,
            browserLabel: browser.label,
            scenario,
            repeat,
            status: output.status,
            elapsedMs: output.elapsedMs,
            sampleCount: output.sampleCount,
            signatureCount: output.signatureCount,
            details: output.details || null,
            error: output.error || null,
          });
        } catch (error) {
          notes.push(`${browser.id}/${scenario}/${repeat}: ${error.message}`);
          rows.push({
            browser: browser.id,
            browserLabel: browser.label,
            scenario,
            repeat,
            status: "failed",
            elapsedMs: null,
            error: error.message,
          });
        } finally {
          if (context) await context.close();
        }
      }
    }
  }
});

const result = createResult({
  experimentId: EXPERIMENT.id,
  environment: environmentSummary({
    browsers,
    requestedBrowsers,
    repeats,
    timeoutMs,
  }),
  inputs: {
    scenarios: [
      {
        id: "single_sample_fit_report",
        description: "Single-sample NNLS fit followed by SDK report generation.",
      },
      {
        id: "medium_cohort_120",
        description: "NNLS refit for 120 synthetic SBS96 spectra against nine signatures.",
      },
      {
        id: "portal_scale_300x40",
        description: "NNLS refit for 300 SBS96 spectra against 40 signatures.",
      },
      {
        id: "bootstrap_500",
        description: "Parametric bootstrap uncertainty, 500 iterations, one sample.",
      },
      {
        id: "nmf_rank_selection_rank4",
        description: "NMF rank grid plus rank-4 extraction on 80 samples.",
      },
    ],
    repeats,
    syntheticDataSeed: 20260521,
  },
  rows,
  artifacts: {
    json: relativeArtifact(RESULT_PATH),
    csv: relativeArtifact(CSV_PATH),
    harness: relativeArtifact(HARNESS_PATH),
  },
  status: rows.some((row) => row.status === "completed") ? "completed" : "failed",
  notes,
});

await writeJson(RESULT_PATH, result);
await writeCsv(
  CSV_PATH,
  rows.map((row) => ({
    browser: row.browser,
    scenario: row.scenario,
    repeat: row.repeat,
    status: row.status,
    elapsed_ms: row.elapsedMs,
    sample_count: row.sampleCount,
    signature_count: row.signatureCount,
    rank_selection_ms: row.details?.rankSelectionMs,
    extraction_ms: row.details?.extractionMs,
    error: row.error,
  }))
);

console.log(`Wrote ${relativeArtifact(RESULT_PATH)}`);

function buildBenchmarkData() {
  const smallCatalog = generateSyntheticSignatures({ signatureCount: 9, seed: 20260521 });
  const smallCohort = generateSyntheticSpectra({
    sampleCount: 120,
    signatures: smallCatalog.signatures,
    contexts: smallCatalog.contexts,
    seed: 20260522,
    burden: 2200,
  });
  const largeCatalog = generateSyntheticSignatures({ signatureCount: 40, seed: 20260523 });
  const largeCohort = generateSyntheticSpectra({
    sampleCount: 300,
    signatures: largeCatalog.signatures,
    contexts: largeCatalog.contexts,
    seed: 20260524,
    burden: 1800,
  });
  const nmfCatalog = generateSyntheticSignatures({ signatureCount: 4, seed: 20260525 });
  const nmfCohort = generateSyntheticSpectra({
    sampleCount: 80,
    signatures: nmfCatalog.signatures,
    contexts: nmfCatalog.contexts,
    seed: 20260526,
    burden: 1600,
  });
  const singleSample = Object.fromEntries(Object.entries(smallCohort.spectra).slice(0, 1));
  const singleSpectrum = Object.values(singleSample)[0];
  return {
    single_sample_fit_report: {
      signatures: smallCatalog.signatures,
      spectra: singleSample,
      contexts: smallCatalog.contexts,
    },
    medium_cohort_120: {
      signatures: smallCatalog.signatures,
      spectra: smallCohort.spectra,
      contexts: smallCatalog.contexts,
    },
    portal_scale_300x40: {
      signatures: largeCatalog.signatures,
      spectra: largeCohort.spectra,
      contexts: largeCatalog.contexts,
    },
    bootstrap_500: {
      signatures: smallCatalog.signatures,
      spectrum: singleSpectrum,
      contexts: smallCatalog.contexts,
    },
    nmf_rank_selection_rank4: {
      spectra: nmfCohort.spectra,
      contexts: nmfCatalog.contexts,
    },
  };
}

function browserRuntimeHarness() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>E4 browser runtime harness</title>
    <style>body { font-family: Arial, sans-serif; padding: 20px; }</style>
  </head>
  <body>
    <h1>E4 browser runtime harness</h1>
    <pre id="log">Loading SDK...</pre>
    <script type="module">
      const log = document.querySelector("#log");
      const { mSigSDK } = await import("/main.js?e4=" + Date.now());
      window.__MSIG_BENCH_READY__ = true;
      log.textContent = "Ready";
      window.__runMsigBenchmark = async function runBenchmark(scenario, repeat, data) {
        const started = performance.now();
        try {
          let details = {};
          if (scenario === "single_sample_fit_report") {
            const exposures = await mSigSDK.qc.fitSpectraWithNNLS(data.signatures, data.spectra, {
              contexts: data.contexts,
              exposureType: "relative",
              renormalize: true,
              maxIterations: 10000,
              convergenceTolerance: 1e-12
            });
            const qc = mSigSDK.qc.calculateReconstructionError(data.signatures, data.spectra, exposures, {
              contexts: data.contexts,
              normalizeMode: "relative"
            });
            const report = mSigSDK.reports.createAnalysisReport({
              title: "Browser runtime single-sample report",
              summary: "Benchmark report generated in the browser.",
              qc,
              exposures
            }, { format: "html" });
            details = { reportBytes: report.length };
          } else if (scenario === "medium_cohort_120" || scenario === "portal_scale_300x40") {
            const exposures = await mSigSDK.qc.fitSpectraWithNNLS(data.signatures, data.spectra, {
              contexts: data.contexts,
              exposureType: "relative",
              renormalize: true,
              maxIterations: 10000,
              convergenceTolerance: 1e-12
            });
            details = { exposureRows: Object.keys(exposures).length };
          } else if (scenario === "bootstrap_500") {
            const bootstrap = await mSigSDK.qc.bootstrapSignatureFit(data.signatures, data.spectrum, {
              contexts: data.contexts,
              iterations: 500,
              seed: 1000 + repeat,
              yieldEvery: 50,
              exposureType: "relative",
              renormalize: true,
              maxIterations: 10000,
              convergenceTolerance: 1e-12
            });
            details = { iterations: bootstrap.iterations, signatures: bootstrap.signatures.length };
          } else if (scenario === "nmf_rank_selection_rank4") {
            const rankStarted = performance.now();
            const rankSelection = mSigSDK.signatureExtraction.selectNMFRank(data.spectra, {
              contexts: data.contexts,
              ranks: [2, 3, 4, 5],
              nRuns: 2,
              seed: 4000 + repeat,
              maxIterations: 80,
              tolerance: 1e-5
            });
            const rankSelectionMs = performance.now() - rankStarted;
            const extractionStarted = performance.now();
            const extraction = mSigSDK.signatureExtraction.extractSignaturesNMF(data.spectra, {
              contexts: data.contexts,
              rank: 4,
              nRuns: 3,
              seed: 5000 + repeat,
              maxIterations: 100,
              tolerance: 1e-5
            });
            const extractionMs = performance.now() - extractionStarted;
            details = {
              recommendedRank: rankSelection.recommendedRank,
              extractionError: extraction.reconstructionError,
              rankSelectionMs,
              extractionMs
            };
          } else {
            throw new Error("Unknown scenario " + scenario);
          }
          return {
            status: "completed",
            elapsedMs: performance.now() - started,
            sampleCount: data.spectra ? Object.keys(data.spectra).length : 1,
            signatureCount: data.signatures ? Object.keys(data.signatures).length : null,
            details
          };
        } catch (error) {
          return {
            status: "failed",
            elapsedMs: performance.now() - started,
            error: error.message,
            sampleCount: data.spectra ? Object.keys(data.spectra).length : 1,
            signatureCount: data.signatures ? Object.keys(data.signatures).length : null
          };
        }
      };
    </script>
  </body>
</html>`;
}
