#!/usr/bin/env node

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  importMatrixTSV,
  importMuSiCalOutput,
  importSigProfilerMatrix,
} from "../mSigSDKScripts/io.js";
import {
  createInteroperabilityBundle,
  parseDeconstructSigsOutput,
  parseSigminerOutput,
  parseSigProfilerMatrixGeneratorOutput,
  prepareMuSiCalRefitInput,
  prepareSigProfilerClustersInput,
  prepareSigProfilerMatrixGeneratorInput,
  prepareSigProfilerPlottingInput,
  prepareSigProfilerSimulatorInput,
  prepareSigProfilerAssignmentInput,
  prepareSigProfilerExtractorInput,
  prepareDeconstructSigsInput,
  prepareSigminerInput,
  runSparseNnlsRefit,
} from "../mSigSDKScripts/adapters.js";
import { getExpectedContexts } from "../mSigSDKScripts/validation.js";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUTPUT_DIR = join(REPO_ROOT, "docs", "verification");
const RESULT_PATH = join(OUTPUT_DIR, "tool-interoperability-results.json");
const DEFAULT_TIMEOUT_MS = 6 * 60 * 1000;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function parseArgs(argv) {
  const options = {
    browser: "chrome",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    skipBrowser: false,
    probeSigProfilerAssignmentPackage: false,
    probeSigProfilerAssignmentRun: false,
  };

  for (const arg of argv) {
    if (arg === "--skip-browser") {
      options.skipBrowser = true;
    } else if (arg === "--probe-sigprofilerassignment-package") {
      options.probeSigProfilerAssignmentPackage = true;
    } else if (arg === "--probe-sigprofilerassignment-run") {
      options.probeSigProfilerAssignmentPackage = true;
      options.probeSigProfilerAssignmentRun = true;
    } else if (arg.startsWith("--browser=")) {
      options.browser = arg.slice("--browser=".length).trim().toLowerCase();
    } else if (arg.startsWith("--timeout-ms=")) {
      const value = Number(arg.slice("--timeout-ms=".length));
      if (Number.isInteger(value) && value > 0) {
        options.timeoutMs = value;
      }
    }
  }

  return options;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (_error) {
    return false;
  }
}

async function findBrowser(browserName) {
  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.PROGRAMFILES || "";
  const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "";
  const candidates = {
    chrome: [
      join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      "chrome.exe",
    ],
    edge: [
      join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
      join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
      "msedge.exe",
    ],
    firefox: [
      join(programFiles, "Mozilla Firefox", "firefox.exe"),
      join(programFilesX86, "Mozilla Firefox", "firefox.exe"),
      join(localAppData, "Mozilla Firefox", "firefox.exe"),
      "firefox.exe",
    ],
  }[browserName] || [];

  for (const candidate of candidates) {
    if (candidate.endsWith(".exe") && candidate.includes(":")) {
      if (await exists(candidate)) {
        return candidate;
      }
    } else {
      return candidate;
    }
  }
  return null;
}

function browserArgs(browserName, url) {
  if (browserName === "chrome" || browserName === "edge") {
    return [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--no-first-run",
      "--no-default-browser-check",
      url,
    ];
  }
  if (browserName === "firefox") {
    return ["-headless", url];
  }
  return [url];
}

function getVersion(executable) {
  return new Promise((resolveVersion) => {
    if (process.platform === "win32" && /^[A-Za-z]:\\/.test(executable)) {
      const child = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `(Get-Item -LiteralPath ${JSON.stringify(executable)}).VersionInfo.ProductVersion`,
        ],
        { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
      );
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.on("close", () => resolveVersion(output.trim()));
      child.on("error", () => resolveVersion(""));
      return;
    }

    const child = spawn(executable, ["--version"], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("close", () => resolveVersion(output.trim()));
    child.on("error", () => resolveVersion(""));
  });
}

function record(checks, name, passed, details = {}) {
  checks.push({
    name,
    passed: Boolean(passed),
    details,
  });
}

function buildExampleMatrices() {
  const contexts = getExpectedContexts({ profile: "SBS", matrix: 96 });
  const signatures = {
    SBS1: Object.fromEntries(contexts.map((context, index) => [context, index % 4 === 0 ? 1 : 0])),
    SBS5: Object.fromEntries(contexts.map((context, index) => [context, index % 4 === 1 ? 1 : 0])),
    SBS40: Object.fromEntries(contexts.map((context, index) => [context, index % 4 === 2 ? 1 : 0])),
  };
  const spectra = {
    SampleA: Object.fromEntries(contexts.map((context) => [context, 0])),
    SampleB: Object.fromEntries(contexts.map((context) => [context, 0])),
  };
  spectra.SampleA[contexts[0]] = 18;
  spectra.SampleA[contexts[1]] = 6;
  spectra.SampleA[contexts[2]] = 2;
  spectra.SampleB[contexts[4]] = 3;
  spectra.SampleB[contexts[5]] = 14;
  spectra.SampleB[contexts[6]] = 3;
  return { contexts, spectra, signatures };
}

function checkExposureSums(exposures) {
  return Object.values(exposures || {}).every((record) => {
    const total = Object.values(record).reduce((sum, value) => sum + Number(value || 0), 0);
    return total === 0 || Math.abs(total - 1) < 1e-6;
  });
}

function approximatelyEqual(left, right, tolerance = 1e-9) {
  return Math.abs(Number(left) - Number(right)) <= tolerance;
}

async function runNodeChecks() {
  const checks = [];
  const { contexts, spectra, signatures } = buildExampleMatrices();

  const spa = prepareSigProfilerAssignmentInput(
    { spectra, signatures },
    { contexts }
  );
  record(checks, "SigProfilerAssignment input has spectra and signature files", spa.files.length === 2, spa.manifest);
  const spaRoundTrip = importSigProfilerMatrix(spa.files[0].text);
  record(
    checks,
    "SigProfiler-style spectra round trip preserves samples and contexts",
    Object.keys(spaRoundTrip).length === 2 &&
      Object.keys(spaRoundTrip.SampleA || {}).length === contexts.length,
    {
      samples: Object.keys(spaRoundTrip),
      contexts: Object.keys(spaRoundTrip.SampleA || {}).length,
    }
  );

  const musical = prepareMuSiCalRefitInput({ spectra, signatures }, { contexts });
  record(checks, "MuSiCal input has spectra and signature files", musical.files.length === 2, musical.manifest);
  const musicalSpectra = importMatrixTSV(musical.files[0].text, { idColumn: 0 });
  record(
    checks,
    "MuSiCal-compatible spectra matrix is mutation-type by sample",
    Object.keys(musicalSpectra).length === contexts.length &&
      Object.keys(musicalSpectra[contexts[0]] || {}).length === 2,
    {
      contexts: Object.keys(musicalSpectra).length,
      samples: Object.keys(musicalSpectra[contexts[0]] || {}),
    }
  );

  const sparse = await runSparseNnlsRefit(
    { spectra, signatures },
    { contexts, threshold: 0.01 }
  );
  record(
    checks,
    "MuSiCal-compatible sparse NNLS refit returns normalized exposures",
    sparse.status === "completed" && checkExposureSums(sparse.exposures),
    {
      runtime: sparse.runtime,
      samples: Object.keys(sparse.exposures || {}),
      activeSets: sparse.activeSets,
    }
  );

  const extractor = prepareSigProfilerExtractorInput({ spectra }, { contexts });
  record(
    checks,
    "SigProfilerExtractor handoff prepares matrix-mode input and Python snippet",
    extractor.files.length === 1 &&
      extractor.manifest.inputType === "matrix" &&
      extractor.pythonSnippet.includes("sigProfilerExtractor"),
    extractor.manifest
  );

  const deconstruct = prepareDeconstructSigsInput(
    { spectra, signatures },
    { contexts }
  );
  record(
    checks,
    "deconstructSigs handoff prepares spectra, signatures, and R snippet",
    deconstruct.files.length === 2 &&
      deconstruct.rSnippet.includes("whichSignatures") &&
      deconstruct.manifest.contextCount === contexts.length,
    deconstruct.manifest
  );

  const sigminer = prepareSigminerInput(
    { spectra, signatures },
    { contexts, method: "NNLS" }
  );
  record(
    checks,
    "sigminer handoff prepares spectra, signatures, and R snippet",
    sigminer.files.length === 2 &&
      sigminer.rSnippet.includes("sigminer::sig_fit") &&
      sigminer.manifest.contextCount === contexts.length,
    sigminer.manifest
  );

  const exampleVcf = [
    "##fileformat=VCFv4.2",
    "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO",
    "1\t1000\t.\tC\tA\t.\tPASS\t.",
  ].join("\n");
  const matrixGenerator = prepareSigProfilerMatrixGeneratorInput(
    { files: [{ path: "SampleA.vcf", text: exampleVcf }] },
    { project: "InteropMatrix", referenceGenome: "GRCh37" }
  );
  record(
    checks,
    "SigProfilerMatrixGenerator handoff prepares variant files and Python snippet",
    matrixGenerator.files.length === 1 &&
      matrixGenerator.pythonSnippet.includes("SigProfilerMatrixGeneratorFunc"),
    matrixGenerator.manifest
  );

  const simulator = prepareSigProfilerSimulatorInput(
    { files: [{ path: "SampleA.vcf", text: exampleVcf }] },
    { project: "InteropSimulator", simulations: 2 }
  );
  record(
    checks,
    "SigProfilerSimulator handoff prepares input files and Python snippet",
    simulator.files.length === 1 &&
      simulator.pythonSnippet.includes("SigProfilerSimulator"),
    simulator.manifest
  );

  const clusters = prepareSigProfilerClustersInput(
    { files: [{ path: "SampleA.vcf", text: exampleVcf }] },
    { project: "InteropClusters" }
  );
  record(
    checks,
    "SigProfilerClusters handoff prepares input files and Python snippet",
    clusters.files.length === 1 && clusters.pythonSnippet.includes("hp.analysis"),
    clusters.manifest
  );

  const plotting = prepareSigProfilerPlottingInput(
    { spectra },
    { contexts, matrixType: "SBS", plotType: "96" }
  );
  record(
    checks,
    "sigProfilerPlotting handoff prepares matrix and Python snippet",
    plotting.files.length === 1 && plotting.pythonSnippet.includes("plotSBS"),
    plotting.manifest
  );

  const exposureText = [
    "Sample\tSBS1\tSBS5\tSBS40",
    "SampleA\t0.2\t0.7\t0.1",
    "SampleB\t0.0\t0.3\t0.7",
  ].join("\n");
  const importedExposures = importMuSiCalOutput(exposureText, { normalize: true });
  record(
    checks,
    "MuSiCal exposure parser imports sample-by-signature output",
    approximatelyEqual(importedExposures.SampleA?.SBS5, 0.7) &&
      checkExposureSums(importedExposures),
    importedExposures
  );

  const deconstructImported = parseDeconstructSigsOutput(exposureText, {
    normalize: true,
  });
  record(
    checks,
    "deconstructSigs exposure parser imports sample-by-signature output",
    approximatelyEqual(deconstructImported.SampleB?.SBS40, 0.7) &&
      checkExposureSums(deconstructImported),
    deconstructImported
  );

  const sigminerImported = parseSigminerOutput(exposureText, {
    normalize: true,
  });
  record(
    checks,
    "sigminer exposure parser imports sample-by-signature output",
    approximatelyEqual(sigminerImported.SampleA?.SBS1, 0.2) &&
      checkExposureSums(sigminerImported),
    sigminerImported
  );

  const matrixGeneratorImported = parseSigProfilerMatrixGeneratorOutput([
    { path: "/output/SBS96.all", text: spa.files[0].text },
  ]);
  record(
    checks,
    "SigProfilerMatrixGenerator parser imports generated matrices",
    Boolean(matrixGeneratorImported.matrices.SBS96?.SampleA),
    matrixGeneratorImported.candidateMatrices
  );

  const bundle = createInteroperabilityBundle(
    { spectra, signatures },
    { contexts }
  );
  record(
    checks,
    "Interoperability bundle includes all supported handoff targets",
    Boolean(
      bundle.tools.sigProfilerAssignment &&
        bundle.tools.sigProfilerExtractor &&
        bundle.tools.sigProfilerPlotting &&
        bundle.tools.deconstructSigs &&
        bundle.tools.sigminer &&
        bundle.tools.musical
    ),
    { tools: Object.keys(bundle.tools) }
  );

  return {
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };
}

function harnessHtml({ probeSigProfilerAssignmentPackage, probeSigProfilerAssignmentRun }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>mSigSDK tool interoperability verification</title>
</head>
<body>
<pre id="status">Running</pre>
<script type="module">
const statusElement = document.getElementById("status");
const checks = [];
function record(name, passed, details = {}) {
  checks.push({ name, passed: Boolean(passed), details });
}
function makeMatrices(mSigSDK) {
  const contexts = mSigSDK.validation.getExpectedContexts({ profile: "SBS", matrix: 96 });
  const signatures = {
    SBS1: Object.fromEntries(contexts.map((context, index) => [context, index % 4 === 0 ? 1 : 0])),
    SBS5: Object.fromEntries(contexts.map((context, index) => [context, index % 4 === 1 ? 1 : 0])),
    SBS40: Object.fromEntries(contexts.map((context, index) => [context, index % 4 === 2 ? 1 : 0])),
  };
  const spectra = {
    SampleA: Object.fromEntries(contexts.map((context) => [context, 0])),
    SampleB: Object.fromEntries(contexts.map((context) => [context, 0])),
  };
  spectra.SampleA[contexts[0]] = 18;
  spectra.SampleA[contexts[1]] = 6;
  spectra.SampleA[contexts[2]] = 2;
  spectra.SampleB[contexts[4]] = 3;
  spectra.SampleB[contexts[5]] = 14;
  spectra.SampleB[contexts[6]] = 3;
  return { contexts, spectra, signatures };
}
async function post(payload) {
  await fetch("/__msig_interop_results__", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}
try {
  const startedAt = new Date().toISOString();
  const { mSigSDK } = await import("/main.js?interop=" + Date.now());
  record("Public SDK exposes quickstart namespace", !!mSigSDK.quickstart?.runSingleSampleFit && !!mSigSDK.quickstart?.runPanelWorkflow, Object.keys(mSigSDK.quickstart || {}));
  record("Public SDK exposes runners namespace", !!mSigSDK.runners?.pyodide?.runPython, Object.keys(mSigSDK.runners || {}));
  record("Public SDK exposes adapters namespace", !!mSigSDK.adapters?.sigProfilerAssignment && !!mSigSDK.adapters?.musical, Object.keys(mSigSDK.adapters || {}));
  const runtime = mSigSDK.runners.pyodide.detect();
  record("Browser supports Pyodide worker prerequisites", runtime.available, runtime);

  const pyodide = await mSigSDK.runners.pyodide.runPython("import json\\ninputs = json.loads(MSIG_INPUT_JSON)\\njson.dumps({\\"ok\\": True, \\"value\\": inputs[\\"value\\"]})", {
    inputs: { value: 42 },
    timeoutMs: ${Math.max(120000, DEFAULT_TIMEOUT_MS)}
  });
  record("Pyodide runner executes Python and returns JSON", pyodide.result?.ok === true && pyodide.result?.value === 42, {
    elapsedMs: pyodide.elapsedMs,
    loadedPyodidePackages: pyodide.loadedPyodidePackages,
  });

  const { contexts, spectra, signatures } = makeMatrices(mSigSDK);
  const quickFit = await mSigSDK.quickstart.runSingleSampleFit(
    { sampleName: "SampleA", spectrum: spectra.SampleA, signatures },
    { expectedContexts: contexts, bootstrapIterations: 10 }
  );
  record("Browser quickstart single-sample fit returns shared result frame", quickFit.parameters?.workflow === "runSingleSampleFit" && !!quickFit.qc?.mutationBurden && Array.isArray(quickFit.warnings), {
    workflow: quickFit.workflow,
    parameterWorkflow: quickFit.parameters?.workflow,
    reportingMode: quickFit.fitQualityEvidence?.samples?.[0]?.reportingMode,
    warningCount: quickFit.warnings?.length ?? null,
  });
  const spa = mSigSDK.adapters.sigProfilerAssignment.prepareInput({ spectra, signatures }, { contexts });
  record("Browser SigProfilerAssignment adapter prepares two input files", spa.files.length === 2 && spa.manifest.contextCount === 96, spa.manifest);
  const extractor = mSigSDK.adapters.sigProfilerExtractor.prepareInput({ spectra }, { contexts });
  record("Browser SigProfilerExtractor adapter prepares matrix handoff input", extractor.files.length === 1 && extractor.pythonSnippet.includes("sigProfilerExtractor"), extractor.manifest);
  const exampleVcf = [
    "##fileformat=VCFv4.2",
    "#CHROM\\tPOS\\tID\\tREF\\tALT\\tQUAL\\tFILTER\\tINFO",
    "1\\t1000\\t.\\tC\\tA\\t.\\tPASS\\t.",
  ].join("\\n");
  const matrixGenerator = mSigSDK.adapters.sigProfilerMatrixGenerator.prepareInput({ files: [{ path: "SampleA.vcf", text: exampleVcf }] }, { project: "BrowserMatrix" });
  record("Browser SigProfilerMatrixGenerator adapter prepares Python handoff input", matrixGenerator.files.length === 1 && matrixGenerator.pythonSnippet.includes("SigProfilerMatrixGeneratorFunc"), matrixGenerator.manifest);
  const simulator = mSigSDK.adapters.sigProfilerSimulator.prepareInput({ files: [{ path: "SampleA.vcf", text: exampleVcf }] }, { project: "BrowserSimulator", simulations: 2 });
  record("Browser SigProfilerSimulator adapter prepares Python handoff input", simulator.files.length === 1 && simulator.pythonSnippet.includes("SigProfilerSimulator"), simulator.manifest);
  const clusters = mSigSDK.adapters.sigProfilerClusters.prepareInput({ files: [{ path: "SampleA.vcf", text: exampleVcf }] }, { project: "BrowserClusters" });
  record("Browser SigProfilerClusters adapter prepares Python handoff input", clusters.files.length === 1 && clusters.pythonSnippet.includes("hp.analysis"), clusters.manifest);
  const plotting = mSigSDK.adapters.sigProfilerPlotting.prepareInput({ spectra }, { contexts, matrixType: "SBS", plotType: "96" });
  record("Browser sigProfilerPlotting adapter prepares Python handoff input", plotting.files.length === 1 && plotting.pythonSnippet.includes("plotSBS"), plotting.manifest);
  const deconstruct = mSigSDK.adapters.deconstructSigs.prepareInput({ spectra, signatures }, { contexts });
  record("Browser deconstructSigs adapter prepares R handoff input", deconstruct.files.length === 2 && deconstruct.rSnippet.includes("whichSignatures"), deconstruct.manifest);
  const sigminer = mSigSDK.adapters.sigminer.prepareInput({ spectra, signatures }, { contexts, method: "NNLS" });
  record("Browser sigminer adapter prepares R handoff input", sigminer.files.length === 2 && sigminer.rSnippet.includes("sigminer::sig_fit"), sigminer.manifest);
  const musical = mSigSDK.adapters.musical.prepareRefitInput({ spectra, signatures }, { contexts });
  record("Browser MuSiCal adapter prepares two input files", musical.files.length === 2 && musical.manifest.contextCount === 96, musical.manifest);
  const bundle = mSigSDK.adapters.createInteroperabilityBundle({ spectra, signatures }, { contexts });
  record("Browser interoperability bundle includes all supported tools", !!(bundle.tools.sigProfilerAssignment && bundle.tools.sigProfilerExtractor && bundle.tools.sigProfilerPlotting && bundle.tools.deconstructSigs && bundle.tools.sigminer && bundle.tools.musical), Object.keys(bundle.tools));
  const sparse = await mSigSDK.adapters.musical.runRefit({ spectra, signatures }, { contexts, threshold: 0.01 });
  record("Browser MuSiCal-compatible sparse refit completes", sparse.status === "completed" && sparse.runtime === "js_sparse_nnls", {
    samples: Object.keys(sparse.exposures || {}),
    activeSets: sparse.activeSets,
  });

  if (${probeSigProfilerAssignmentPackage ? "true" : "false"}) {
    const spaProbe = await mSigSDK.runners.pyodide.run({
      pyodidePackages: ["numpy", "scipy", "pandas", "scikit-learn"],
      micropipPackages: ["SigProfilerAssignment==1.1.3"],
      python: "import json\\nfrom SigProfilerAssignment import Analyzer as Analyze\\njson.dumps({\\"imported\\": True, \\"analyzer\\": str(Analyze.__name__)})",
      timeoutMs: ${Math.max(300000, DEFAULT_TIMEOUT_MS)}
    });
    record("SigProfilerAssignment package imports in Pyodide", spaProbe.result?.imported === true, {
      elapsedMs: spaProbe.elapsedMs,
      loadedPyodidePackages: spaProbe.loadedPyodidePackages,
      installedMicropipPackages: spaProbe.installedMicropipPackages,
    });
  }

  if (${probeSigProfilerAssignmentRun ? "true" : "false"}) {
    const spaRun = await mSigSDK.adapters.sigProfilerAssignment.run(
      { spectra, signatures },
      {
        contexts,
        pyodidePackages: ["numpy", "scipy", "pandas", "scikit-learn"],
        micropipPackages: ["SigProfilerAssignment==1.1.3"],
        genomeBuild: "GRCh37",
        cosmicVersion: 3.5,
        cpu: 1,
        timeoutMs: ${Math.max(420000, DEFAULT_TIMEOUT_MS)}
      }
    );
    record("SigProfilerAssignment adapter matrix-mode run completes", spaRun.status === "completed", {
      outputFiles: (spaRun.rawRun?.files || []).map((file) => file.path),
      candidateExposureTables: spaRun.candidateExposureTables,
      hasParsedExposures: !!spaRun.exposures,
    });
  }

  const payload = {
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    startedAt,
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    checks,
  };
  statusElement.textContent = JSON.stringify(payload, null, 2);
  await post(payload);
} catch (error) {
  const payload = {
    status: "failed",
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    checks,
    error: String(error?.stack || error),
  };
  statusElement.textContent = JSON.stringify(payload, null, 2);
  await post(payload);
}
</script>
</body>
</html>`;
}

function startServer({ probeSigProfilerAssignmentPackage, probeSigProfilerAssignmentRun, onResult }) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "POST" && url.pathname === "/__msig_interop_results__") {
        const chunks = [];
        for await (const chunk of request) {
          chunks.push(chunk);
        }
        onResult(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }

      if (url.pathname === "/__msig_interop_harness__.html") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(harnessHtml({ probeSigProfilerAssignmentPackage, probeSigProfilerAssignmentRun }));
        return;
      }

      const requestPath = resolve(REPO_ROOT, `.${decodeURIComponent(url.pathname)}`);
      if (!requestPath.startsWith(REPO_ROOT)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      await stat(requestPath);
      response.writeHead(200, {
        "content-type": MIME_TYPES[extname(requestPath).toLowerCase()] || "application/octet-stream",
      });
      createReadStream(requestPath).pipe(response);
    } catch (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end(String(error?.message || error));
    }
  });

  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

function launchBrowser({ browserName, executable, url, timeoutMs }) {
  const child = spawn(executable, browserArgs(browserName, url), {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let settled = false;
  const failurePromise = new Promise((resolveResult) => {
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      resolveResult({
        status: "timeout",
        error: `Timed out after ${timeoutMs} ms`,
      });
    }, timeoutMs);

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolveResult({
        status: "launch_failed",
        error: String(error?.message || error),
      });
    });
    child.on("close", (code) => {
      if (!settled && code !== 0) {
        settled = true;
        clearTimeout(timer);
        resolveResult({
          status: "closed_before_result",
          exitCode: code,
        });
      }
    });
    child.on("exit", () => {
      clearTimeout(timer);
    });
  });

  return {
    child,
    failurePromise,
    close() {
      settled = true;
      child.kill();
    },
  };
}

async function runBrowserChecks(options) {
  if (options.skipBrowser) {
    return {
      status: "skipped",
      reason: "Browser checks were skipped by flag.",
    };
  }

  const executable = await findBrowser(options.browser);
  if (!executable) {
    return {
      status: "unavailable",
      browser: options.browser,
      error: `${options.browser} executable not found`,
    };
  }
  const version = await getVersion(executable);
  let resolver;
  const resultPromise = new Promise((resolveResult) => {
    resolver = resolveResult;
  });
  const server = await startServer({
    probeSigProfilerAssignmentPackage: options.probeSigProfilerAssignmentPackage,
    probeSigProfilerAssignmentRun: options.probeSigProfilerAssignmentRun,
    onResult(payload) {
      resolver(payload);
    },
  });
  const url = `http://127.0.0.1:${server.address().port}/__msig_interop_harness__.html`;
  const launched = launchBrowser({
    browserName: options.browser,
    executable,
    url,
    timeoutMs: options.timeoutMs,
  });

  try {
    const payload = await Promise.race([resultPromise, launched.failurePromise]);
    launched.close();
    return {
      browser: options.browser,
      browserVersion: version,
      executable,
      ...payload,
    };
  } finally {
    launched.close();
    server.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const nodeChecks = await runNodeChecks();
  const browserChecks = await runBrowserChecks(options);
  const payload = {
    generatedAt: new Date().toISOString(),
    options,
    nodeChecks,
    browserChecks,
    status:
      nodeChecks.status === "passed" &&
      (browserChecks.status === "passed" || browserChecks.status === "skipped")
        ? "passed"
        : "failed",
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(RESULT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));
  if (payload.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
