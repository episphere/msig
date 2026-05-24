import path from "node:path";
import {
  copyD3Asset,
  createResult,
  ensureDir,
  environmentSummary,
  EXPERIMENTS,
  findAvailableBrowsers,
  launchBrowser,
  parseArgs,
  relativeArtifact,
  tempDir,
  withStaticServer,
  writeCsv,
  writeJson,
  writeText,
} from "../../../../../scripts/manuscript/lib/experiment-utils.mjs";
import {
  generateSyntheticSignatures,
  generateSyntheticSpectra,
  PORTAL_URLS,
} from "../../../../../scripts/manuscript/lib/demo-data.mjs";

const EXPERIMENT = EXPERIMENTS.e6;
const RESULT_PATH = path.join(EXPERIMENT.dir, "data", "compatibility-results.json");
const CSV_PATH = path.join(EXPERIMENT.dir, "data", "compatibility_matrix.csv");
const HARNESS_PATH = path.join(EXPERIMENT.dir, "manual-compatibility-harness.html");

parseArgs();
await ensureDir(path.dirname(RESULT_PATH));
await copyD3Asset();

const catalog = generateSyntheticSignatures({ signatureCount: 9, seed: 606 });
const cohort = generateSyntheticSpectra({
  sampleCount: 1,
  signatures: catalog.signatures,
  contexts: catalog.contexts,
  seed: 607,
});
const automatedInput = {
  signatures: catalog.signatures,
  spectra: cohort.spectra,
  contexts: catalog.contexts,
  publicFetchUrl: PORTAL_URLS.spectra,
};
await writeText(HARNESS_PATH, manualHarness());

const browsers = await findAvailableBrowsers();
const rows = [];
const notes = [];

await withStaticServer(process.cwd(), async ({ baseUrl }) => {
  for (const browser of browsers) {
    let context = null;
    try {
      context = await launchBrowser(browser, {
        userDataDir: tempDir(`e6-${browser.id}-profile`),
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/docs/manuscript/experiments/e6_cross_browser_compatibility/manual-compatibility-harness.html?auto=${Date.now()}`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.waitForFunction(() => window.__MSIG_COMPAT_READY__ === true, null, {
        timeout: 120000,
      });
      const output = await page.evaluate(
        async (input) => window.__runCompatibilityCheck(input),
        automatedInput
      );
      rows.push({
        source: "automated",
        browser: browser.label,
        browserId: browser.id,
        device: "desktop",
        platform: output.platform || null,
        sdkImport: output.sdkImport,
        publicFetch: output.publicFetch,
        fitReport: output.fitReport,
        d3Render: output.d3Render,
        pyodideAdapter: output.pyodideAdapter,
        webrAdapter: output.webrAdapter,
        status: compatibilityStatus(output),
        notes: output.notes || "",
      });
    } catch (error) {
      notes.push(`${browser.id}: ${error.message}`);
      rows.push({
        source: "automated",
        browser: browser.label,
        browserId: browser.id,
        device: "desktop",
        sdkImport: "failed",
        publicFetch: "not run",
        fitReport: "not run",
        d3Render: "not run",
        pyodideAdapter: "not checked",
        webrAdapter: "not checked",
        status: "failed",
        notes: error.message,
      });
    } finally {
      if (context) await context.close();
    }
  }
});

const result = createResult({
  experimentId: EXPERIMENT.id,
  environment: environmentSummary({
    automatedBrowsers: browsers,
    manualHarness: relativeArtifact(HARNESS_PATH),
  }),
  inputs: {
    automatedChecks: [
      "SDK ESM import",
      "public mSigPortal fetch",
      "single-sample fit and report generation",
      "local D3 SVG render",
      "Pyodide/WebR runtime capability detection",
    ],
  },
  rows,
  artifacts: {
    json: relativeArtifact(RESULT_PATH),
    csv: relativeArtifact(CSV_PATH),
    manualHarness: relativeArtifact(HARNESS_PATH),
  },
  status: "completed",
  notes,
});

await writeJson(RESULT_PATH, result);
await writeCsv(
  CSV_PATH,
  rows.map((row) => ({
    source: row.source,
    browser: row.browser,
    device: row.device,
    status: row.status,
    sdk_import: row.sdkImport,
    public_fetch: row.publicFetch,
    fit_report: row.fitReport,
    d3_render: row.d3Render,
    pyodide_adapter: row.pyodideAdapter,
    webr_adapter: row.webrAdapter,
    notes: row.notes,
  }))
);

console.log(`Wrote ${relativeArtifact(RESULT_PATH)}`);

function compatibilityStatus(row) {
  return [row.sdkImport, row.publicFetch, row.fitReport, row.d3Render].every(
    (value) => value === "pass"
  )
    ? "pass"
    : "failed";
}

function manualHarness() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>E6 compatibility harness</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; color: #172026; background: #f7f9fb; }
      main { max-width: 980px; margin: 0 auto; padding: 24px; }
      label { display: block; margin: 12px 0 4px; font-weight: 700; }
      input, textarea { width: 100%; box-sizing: border-box; padding: 8px; }
      button { margin-top: 14px; padding: 10px 14px; }
      pre { white-space: pre-wrap; background: #fff; border: 1px solid #c8d2dc; padding: 12px; }
      #chart svg { display: block; margin-top: 12px; background: #fff; border: 1px solid #c8d2dc; }
    </style>
    <script src="/docs/manuscript/assets/d3.min.js"></script>
  </head>
  <body>
    <main>
      <h1>E6 compatibility check</h1>
      <label for="browser">Browser/device label</label>
      <input id="browser" value="">
      <label for="device">Device class</label>
      <input id="device" value="desktop">
      <button id="run">Run check</button>
      <div id="chart"></div>
      <pre id="output">Waiting...</pre>
    </main>
    <script type="module">
      const defaultInput = ${JSON.stringify(automatedInput)};
      const output = document.querySelector("#output");
      window.__MSIG_COMPAT_READY__ = true;
      async function runCompatibilityCheck(input = defaultInput) {
        const result = {
          browser: document.querySelector("#browser").value || navigator.userAgent,
          device: document.querySelector("#device").value || "desktop",
          platform: navigator.platform || null,
          sdkImport: "not run",
          publicFetch: "not run",
          fitReport: "not run",
          d3Render: "not run",
          pyodideAdapter: "not checked",
          webrAdapter: "not checked",
          notes: ""
        };
        let mSigSDK = null;
        try {
          const module = await import("/main.js?compat=" + Date.now());
          mSigSDK = module.mSigSDK;
          result.sdkImport = "pass";
        } catch (error) {
          result.sdkImport = "failed";
          result.notes = error.message;
          return result;
        }
        try {
          const response = await fetch(input.publicFetchUrl, { cache: "no-store" });
          result.publicFetch = response.ok ? "pass" : "failed";
        } catch (error) {
          result.publicFetch = "failed";
          result.notes += " public fetch: " + error.message;
        }
        try {
          const exposures = await mSigSDK.qc.fitSpectraWithNNLS(input.signatures, input.spectra, {
            contexts: input.contexts,
            exposureType: "relative",
            renormalize: true,
            maxIterations: 10000,
            convergenceTolerance: 1e-12
          });
          const report = mSigSDK.reports.createAnalysisReport({
            title: "Compatibility report",
            summary: "Compatibility harness fit/report check.",
            exposures
          }, { format: "html" });
          result.fitReport = report && Object.keys(exposures).length ? "pass" : "failed";
        } catch (error) {
          result.fitReport = "failed";
          result.notes += " fit/report: " + error.message;
        }
        try {
          const chart = d3.select("#chart").html("").append("svg").attr("width", 240).attr("height", 90);
          chart.selectAll("rect").data([1, 2, 3]).join("rect")
            .attr("x", (d, i) => 20 + i * 54)
            .attr("y", (d) => 80 - d * 20)
            .attr("width", 36)
            .attr("height", (d) => d * 20)
            .attr("fill", "#2f6f73");
          result.d3Render = document.querySelectorAll("#chart svg rect").length === 3 ? "pass" : "failed";
        } catch (error) {
          result.d3Render = "failed";
          result.notes += " d3: " + error.message;
        }
        try {
          result.pyodideAdapter = mSigSDK.runners.detectPyodideRuntime().available ? "pass" : "failed";
          result.webrAdapter = mSigSDK.runners.detectWebRRuntime().available ? "pass" : "failed";
        } catch (_error) {
          result.pyodideAdapter = "not checked";
          result.webrAdapter = "not checked";
        }
        return result;
      }
      window.__runCompatibilityCheck = runCompatibilityCheck;
      document.querySelector("#run").addEventListener("click", async () => {
        const record = await runCompatibilityCheck(defaultInput);
        record.browser = document.querySelector("#browser").value || record.browser;
        record.device = document.querySelector("#device").value || record.device;
        record.status = ["sdkImport", "publicFetch", "fitReport", "d3Render"].every((key) => record[key] === "pass") ? "pass" : "failed";
        output.textContent = JSON.stringify(record, null, 2);
      });
    </script>
  </body>
</html>`;
}
