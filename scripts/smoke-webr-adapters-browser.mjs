import {
  findAvailableBrowsers,
  launchBrowser,
  tempDir,
  withStaticServer,
} from "./manuscript/lib/experiment-utils.mjs";
import { getExpectedContexts } from "../mSigSDKScripts/validation.js";

const timeoutMs = Number(process.env.MSIG_WEBR_SMOKE_TIMEOUT_MS || 600000);
const contexts = getExpectedContexts({ profile: "SBS", matrix: 96 });
const spectra = {
  BrowserSmokeSample: Object.fromEntries(contexts.map((context) => [context, 0])),
};
spectra.BrowserSmokeSample["G[T>C]G"] = 25;
spectra.BrowserSmokeSample["A[C>A]A"] = 3;

const signatures = {
  SBS_LOCAL: Object.fromEntries(contexts.map((context) => [context, 0])),
  SBS_OTHER: Object.fromEntries(contexts.map((context) => [context, 0])),
};
signatures.SBS_LOCAL["G[T>C]G"] = 1;
signatures.SBS_OTHER["A[C>A]A"] = 1;

const browsers = await findAvailableBrowsers();
const browser = browsers.find((candidate) => candidate.id === "chrome") || browsers[0];
if (!browser) {
  throw new Error("No supported local browser executable found for WebR adapter smoke.");
}

const results = {};
const browserConsole = [];
await withStaticServer(process.cwd(), async ({ baseUrl }) => {
  let context = null;
  try {
    context = await launchBrowser(browser, {
      userDataDir: tempDir("smoke-webr-adapters-profile"),
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      browserConsole.push({
        type: message.type(),
        text: message.text(),
      });
    });
    page.setDefaultTimeout(timeoutMs);
    await page.goto(
      `${baseUrl}/docs/manuscript/experiments/e2_adapter_fidelity/adapter-fidelity-harness.html?smoke=${Date.now()}`,
      { waitUntil: "domcontentloaded", timeout: timeoutMs }
    );
    await page.waitForFunction(() => window.__MSIG_ADAPTER_READY__ === true, null, {
      timeout: timeoutMs,
    });

    for (const tool of ["deconstructsigs", "sigminer"]) {
      const output = await page.evaluate(
        async ({ tool, input, timeoutMs }) =>
          window.__runAdapterFidelity(tool, input, timeoutMs),
        {
          tool,
          input: { spectra, signatures, contexts },
          timeoutMs,
        }
      );
      results[tool] = output;
      if (output.status !== "completed" || !output.exposures) {
        const consoleTail = browserConsole
          .slice(-20)
          .map((entry) => `${entry.type}: ${entry.text}`)
          .join("\n");
        throw new Error(
          `${tool} WebR adapter did not complete: ${output.error || output.status}` +
            (consoleTail ? `\nBrowser console tail:\n${consoleTail}` : "")
        );
      }
    }
  } finally {
    if (context) {
      await context.close();
    }
  }
});

console.log(
  JSON.stringify(
    {
      status: "ok",
      browser: browser.id,
      webRModuleURL: "https://webr.r-wasm.org/v0.6.0/webr.mjs",
      repository: "docs/package-repos/webr",
      adapters: Object.fromEntries(
        Object.entries(results).map(([tool, output]) => [
          tool,
          {
            status: output.status,
            runtime: output.runtime,
            packageVersion: output.packageVersion || null,
            exposureSamples: Object.keys(output.exposures || {}),
          },
        ])
      ),
      browserConsoleTail: browserConsole.slice(-20),
    },
    null,
    2
  )
);
