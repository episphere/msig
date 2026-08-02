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
  withStaticServer,
  writeCsv,
  writeJson,
  writeText,
} from "../../../../../scripts/manuscript/lib/experiment-utils.mjs";

const EXPERIMENT = EXPERIMENTS.e1;
const RESULT_PATH = path.join(EXPERIMENT.dir, "data", "zero-install-results.json");
const CSV_PATH = path.join(EXPERIMENT.dir, "data", "zero-install-summary.csv");
const HARNESS_PATH = path.join(EXPERIMENT.dir, "zero-install-harness.html");
const SCREENSHOT_DIR = path.join(EXPERIMENT.dir, "screenshots");

const args = parseArgs();
const timeoutMs = numericArg(args, "timeout-ms", 180000);

await ensureDir(path.dirname(RESULT_PATH));
await ensureDir(SCREENSHOT_DIR);
await writeText(HARNESS_PATH, zeroInstallHarness());

const browsers = await findAvailableBrowsers();
const browser = browsers.find((candidate) => candidate.id === "chrome") || browsers[0];
if (!browser) {
  throw new Error("E1 requires Chrome, Edge, or Firefox, but no supported local browser executable was found.");
}

const screenshots = {
  start: path.join(SCREENSHOT_DIR, "zero-install-start.png"),
  report: path.join(SCREENSHOT_DIR, "zero-install-report-ready.png"),
};

const rows = [];
let resultStatus = "completed";
let notes = [];

await withStaticServer(process.cwd(), async ({ baseUrl }) => {
  const context = await launchBrowser(browser, {
    userDataDir: tempDir("e1-zero-install-profile"),
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  try {
    await page.goto(`${baseUrl}/docs/manuscript/experiments/e1_zero_install_demo/zero-install-harness.html?run=${Date.now()}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await page.screenshot({ path: screenshots.start, fullPage: true });
    await page.waitForFunction(() => window.__MSIG_E1_RESULT__?.status === "completed", null, {
      timeout: timeoutMs,
    });
    await page.screenshot({ path: screenshots.report, fullPage: true });
    const pageResult = await page.evaluate(() => window.__MSIG_E1_RESULT__);
    rows.push({
      browser: browser.label,
      browserId: browser.id,
      browserVersion: context.browser()?.version?.() || null,
      status: pageResult.status,
      elapsedSeconds: pageResult.elapsedSeconds,
      sampleCount: pageResult.sampleCount,
      signatureCount: pageResult.signatureCount,
      activeSignatures: pageResult.activeSignatures,
      reportBytes: pageResult.reportBytes,
      sourceSpectrumUrl: pageResult.urls.spectra,
      sourceCatalogUrl: pageResult.urls.signatures,
      steps: pageResult.steps,
      timings: pageResult.timings,
      execution: pageResult.execution,
      resources: pageResult.resources,
    });
    if (pageErrors.length) {
      notes = pageErrors.slice(0, 10);
    }
  } catch (error) {
    resultStatus = "failed";
    rows.push({
      browser: browser.label,
      browserId: browser.id,
      status: "failed",
      error: error.message,
    });
    notes = pageErrors.concat(error.message).slice(0, 10);
    throw error;
  } finally {
    await context.close();
  }
});

const result = createResult({
  experimentId: EXPERIMENT.id,
  environment: environmentSummary({
    browser,
    freshProfile: true,
    cachePolicy: "fresh profile plus no-store local server headers",
  }),
  inputs: {
    publicSpectrum: "PCAWG Lung-AdenoCA SBS96",
    signatureCatalog: "COSMIC_v3_Signatures_GRCh37_SBS96",
    workflow: [
      "blank harness page",
      "import main.js",
      "fetch public spectrum",
      "fetch COSMIC catalog",
      "fit one sample with SDK NNLS against the full COSMIC SBS96 catalog",
      "generate SDK analysis report",
    ],
  },
  rows,
  artifacts: {
    json: relativeArtifact(RESULT_PATH),
    csv: relativeArtifact(CSV_PATH),
    harness: relativeArtifact(HARNESS_PATH),
    screenshots: Object.fromEntries(
      Object.entries(screenshots).map(([key, value]) => [key, relativeArtifact(value)])
    ),
  },
  status: resultStatus,
  notes,
});

await writeJson(RESULT_PATH, result);
await writeCsv(
  CSV_PATH,
  rows.map((row) => ({
    browser: row.browser,
    browser_version: row.browserVersion,
    status: row.status,
    elapsed_seconds: row.elapsedSeconds,
    sample_count: row.sampleCount,
    signature_count: row.signatureCount,
    active_signatures: row.activeSignatures,
    report_bytes: row.reportBytes,
    sdk_module_import_ms: row.timings?.sdkModuleImportMs,
    public_fetch_critical_path_ms: row.timings?.publicFetchCriticalPathMs,
    public_spectrum_fetch_ms: row.timings?.publicSpectrumFetchMs,
    public_catalog_fetch_ms: row.timings?.publicCatalogFetchMs,
    native_fit_ms: row.timings?.nativeFitMs,
    qc_evidence_ms: row.timings?.qcEvidenceMs,
    report_serialization_ms: row.timings?.reportSerializationMs,
    report_render_ms: row.timings?.reportRenderMs,
    observed_peak_js_heap_bytes: row.timings?.observedPeakJsHeapBytes,
    fit_method: row.execution?.fitMethod,
    adapter: row.execution?.adapter,
    pyodide: row.execution?.pyodide,
    webR: row.execution?.webR,
    wrapped_package_import: row.execution?.wrappedPackageImport,
    cache_state: row.execution?.cacheState,
  }))
);

console.log(`Wrote ${relativeArtifact(RESULT_PATH)}`);

function zeroInstallHarness() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>E1 zero-install mSigSDK demo</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; color: #172026; background: #f7f9fb; }
      main { max-width: 980px; margin: 0 auto; padding: 28px; }
      h1 { margin: 0 0 10px; font-size: 28px; }
      .status { margin: 20px 0; padding: 16px; border: 1px solid #c8d2dc; background: #fff; border-radius: 6px; }
      .steps { display: grid; gap: 8px; margin-top: 14px; }
      .step { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e4e9ef; padding-bottom: 6px; }
      .done { color: #0b6b4f; font-weight: 700; }
      #report { margin-top: 18px; background: #fff; border: 1px solid #c8d2dc; padding: 18px; max-height: 520px; overflow: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>mSigSDK zero-install browser run</h1>
      <div class="status">
        <div id="current">Starting from a blank browser tab...</div>
        <div class="steps" id="steps"></div>
      </div>
      <div id="report"></div>
    </main>
    <script type="module">
      const urls = {
        spectra: "https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum?study=PCAWG&cancer=Lung-AdenoCA&strategy=WGS&profile=SBS&matrix=96&offset=0",
        signatures: "https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature?source=Reference_signatures&strategy=WGS&profile=SBS&matrix=96&signatureSetName=COSMIC_v3_Signatures_GRCh37_SBS96&limit=10000&offset=0"
      };
      const steps = [];
      const startedAt = performance.now();
      const current = document.querySelector("#current");
      const stepsNode = document.querySelector("#steps");
      function mark(name) {
        const elapsedSeconds = (performance.now() - startedAt) / 1000;
        steps.push({ name, elapsedSeconds });
        stepsNode.innerHTML = steps.map((step) => '<div class="step"><span class="done">' + step.name + '</span><span>' + step.elapsedSeconds.toFixed(3) + ' s</span></div>').join("");
        current.textContent = name;
      }
      function sbsContexts() {
        const bases = ["A", "C", "G", "T"];
        const substitutions = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];
        const contexts = [];
        for (const substitution of substitutions) {
          const ref = substitution[0];
          for (const left of bases) {
            for (const right of bases) {
              contexts.push(left + "[" + substitution + "]" + right);
            }
          }
        }
        return contexts;
      }
      function rowsToSpectra(rows, contexts) {
        const sample = rows[0].sample;
        const spectrum = Object.fromEntries(contexts.map((context) => [context, 0]));
        for (const row of rows) {
          if (row.sample === sample) spectrum[row.mutationType] = Number(row.mutations) || 0;
        }
        return { [sample]: spectrum };
      }
      function rowsToSignatures(rows, contexts) {
        const signatureNames = [...new Set(rows.map((row) => String(row.signatureName || "").trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const selected = new Set(signatureNames);
        const signatures = Object.fromEntries(signatureNames.map((name) => [name, Object.fromEntries(contexts.map((context) => [context, 0]))]));
        for (const row of rows) {
          if (selected.has(row.signatureName)) signatures[row.signatureName][row.mutationType] = Number(row.contribution) || 0;
        }
        return signatures;
      }
      try {
        mark("Page loaded");
        const importStarted = performance.now();
        const { mSigSDK } = await import("/main.js?e1=" + Date.now());
        const sdkModuleImportMs = performance.now() - importStarted;
        mark("SDK imported");
        const publicFetchStarted = performance.now();
        const spectrumStarted = performance.now();
        const spectrumPromise = fetch(urls.spectra, { cache: "no-store" }).then(async (response) => {
          const rows = await response.json();
          return { rows, elapsedMs: performance.now() - spectrumStarted };
        });
        const catalogStarted = performance.now();
        const catalogPromise = fetch(urls.signatures, { cache: "no-store" }).then(async (response) => {
          const rows = await response.json();
          return { rows, elapsedMs: performance.now() - catalogStarted };
        });
        const [{ rows: spectrumRows, elapsedMs: publicSpectrumFetchMs }, { rows: signatureRows, elapsedMs: publicCatalogFetchMs }] = await Promise.all([
          spectrumPromise,
          catalogPromise,
        ]);
        const publicFetchCriticalPathMs = performance.now() - publicFetchStarted;
        mark("mSigPortal data fetched");
        const contexts = sbsContexts();
        const spectra = rowsToSpectra(spectrumRows, contexts);
        const signatures = rowsToSignatures(signatureRows, contexts);
        const fitStarted = performance.now();
        const exposures = await mSigSDK.qc.fitSpectraWithNNLS(signatures, spectra, {
          contexts,
          exposureType: "relative",
          renormalize: true,
          convergenceTolerance: 1e-12,
          maxIterations: 10000
        });
        const nativeFitMs = performance.now() - fitStarted;
        mark("Single-sample fit completed");
        const qcStarted = performance.now();
        const reconstruction = mSigSDK.qc.calculateReconstructionError(signatures, spectra, exposures, { contexts, normalizeMode: "relative" });
        const qcEvidenceMs = performance.now() - qcStarted;
        const reportSerializationStarted = performance.now();
        const report = mSigSDK.reports.createAnalysisReport({
          title: "mSigSDK zero-install report",
          summary: "Fresh-browser PCAWG Lung-AdenoCA SBS96 single-sample fit against the full COSMIC v3 SBS96 catalog.",
          parameters: { signatureCatalog: "Full COSMIC_v3_Signatures_GRCh37_SBS96", sourceUrls: urls },
          qc: reconstruction,
          exposures,
          signatures,
          provenance: { sdkName: mSigSDK.name, sdkVersion: mSigSDK.version, sourceUrls: urls }
        }, { format: "html" });
        const reportSerializationMs = performance.now() - reportSerializationStarted;
        document.querySelector("#report").innerHTML = report;
        const renderStarted = performance.now();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const reportRenderMs = performance.now() - renderStarted;
        mark("SDK report rendered");
        const sampleName = Object.keys(exposures)[0];
        const resourceNames = performance.getEntriesByType("resource").map((entry) => entry.name);
        const heapValues = [performance.memory?.usedJSHeapSize].filter(Number.isFinite);
        window.__MSIG_E1_RESULT__ = {
          status: "completed",
          elapsedSeconds: (performance.now() - startedAt) / 1000,
          sampleCount: Object.keys(spectra).length,
          signatureCount: Object.keys(signatures).length,
          activeSignatures: Object.values(exposures[sampleName]).filter((value) => value > 0).length,
          reportBytes: report.length,
          urls,
          steps,
          timings: {
            sdkModuleImportMs,
            publicFetchCriticalPathMs,
            publicSpectrumFetchMs,
            publicCatalogFetchMs,
            nativeFitMs,
            qcEvidenceMs,
            reportSerializationMs,
            reportRenderMs,
            observedPeakJsHeapBytes: heapValues.length ? Math.max(...heapValues) : null,
          },
          execution: {
            fitMethod: "native JavaScript NNLS via mSigSDK.qc.fitSpectraWithNNLS",
            adapter: null,
            pyodide: "not loaded",
            webR: "not loaded",
            wrappedPackageImport: "not performed",
            cacheState: "fresh persistent browser profile; local server and public fetches used no-store",
          },
          resources: {
            d3Loaded: resourceNames.some((name) => /d3@7\\.9\\.0|d3[./]/i.test(name)),
            pyodideLoaded: resourceNames.some((name) => /pyodide/i.test(name)),
            webRLoaded: resourceNames.some((name) => /webr|webR/i.test(name)),
            wrappedPackageResources: resourceNames.filter((name) => /deconstruct|sigminer|sigprofiler|musical/i.test(name)),
          }
        };
        window.dispatchEvent(new CustomEvent("msig-e1-report-ready", { detail: window.__MSIG_E1_RESULT__ }));
      } catch (error) {
        current.textContent = "Failed: " + error.message;
        window.__MSIG_E1_RESULT__ = { status: "failed", error: error.message, steps, urls };
        throw error;
      }
    </script>
  </body>
</html>`;
}
