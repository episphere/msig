import path from "node:path";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  compareExposureMatrices,
  createResult,
  ensureDir,
  environmentSummary,
  EXPERIMENTS,
  findAvailableBrowsers,
  launchBrowser,
  normalizeExposureRows,
  parseArgs,
  relativeArtifact,
  runCommand,
  tempDir,
  withStaticServer,
  writeCsv,
  writeJson,
  writeText,
} from "../../../../../scripts/manuscript/lib/experiment-utils.mjs";
import { fetchPortalInputs } from "../../../../../scripts/manuscript/lib/demo-data.mjs";
import {
  parseDeconstructSigsOutput,
  parseExposureTables,
  parseSigminerOutput,
  prepareDeconstructSigsInput,
  prepareMuSiCalRefitInput,
  prepareSigminerInput,
  prepareSigProfilerAssignmentInput,
} from "../../../../../mSigSDKScripts/adapters.js";

const EXPERIMENT = EXPERIMENTS.e2;
const RESULT_PATH = path.join(EXPERIMENT.dir, "data", "adapter-fidelity-results.json");
const CSV_PATH = path.join(EXPERIMENT.dir, "data", "adapter_fidelity_summary.csv");
const READINESS_PATH = path.join(EXPERIMENT.dir, "data", "environment-readiness-log.json");
const INPUT_PATH = path.join(EXPERIMENT.dir, "data", "adapter-fidelity-input.json");
const EXPOSURE_PAIRS_PATH = path.join(EXPERIMENT.dir, "data", "adapter-fidelity-exposure-pairs.json");
const EXPOSURE_PAIRS_CSV_PATH = path.join(EXPERIMENT.dir, "data", "adapter_fidelity_exposure_pairs.csv");
const HARNESS_PATH = path.join(EXPERIMENT.dir, "adapter-fidelity-harness.html");

const args = parseArgs();
const strict = args.strict !== "false";
const browserTimeoutMs = Number(args["browser-timeout-ms"] || 600000);
const localRscript = args["local-rscript"] || process.env.MSIG_E2_RSCRIPT || null;
const localRLibrary =
  args["r-library"] ||
  process.env.MSIG_E2_R_LIBS_USER ||
  path.join(process.cwd(), ".tools", "r-library", "R-4.6");
const tools = ["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"];

await ensureDir(path.dirname(RESULT_PATH));
await writeText(HARNESS_PATH, adapterHarness());

const portalInputs = await fetchPortalInputs({
  sampleLimit: 38,
  selectedSignatures: null,
});
await writeJson(INPUT_PATH, {
  urls: portalInputs.urls,
  contexts: portalInputs.contexts,
  sampleNames: portalInputs.sampleNames,
  signatureNames: portalInputs.signatureNames,
  spectra: portalInputs.spectra,
  signatures: portalInputs.signatures,
});

const browserResults = {};
const localResults = {};
const readiness = [];

await runBrowserAdapters(browserResults, readiness, portalInputs);
await runLocalAdapters(localResults, readiness, portalInputs);

const rows = [];
const exposurePairs = [];
for (const tool of tools) {
  const browser = browserResults[tool];
  const local = localResults[tool];
  if (!browser?.exposures || !local?.exposures) continue;
  rows.push({
    tool,
    browserRuntime: browser.runtime,
    localRuntime: local.runtime,
    browserPackageVersion: browser.packageVersion || null,
    localPackageVersion: local.packageVersion || null,
    ...compareExposureMatrices(browser.exposures, local.exposures),
    status: "pass",
  });
  exposurePairs.push(...buildExposurePairs(tool, browser.exposures, local.exposures));
}

const missingTools = tools.filter(
  (tool) => !browserResults[tool]?.exposures || !localResults[tool]?.exposures
);
const status = missingTools.length === 0 ? "completed" : "failed";
const readinessRows = readiness.map((row) => ({
  ...row,
  reason: summarizeReadinessReason(row.reason),
}));
const result = createResult({
  experimentId: EXPERIMENT.id,
  environment: environmentSummary({
    browserTimeoutMs,
    localComparator: localRscript
      ? `local Rscript (${localRscript})`
      : "Docker containers",
    localRLibrary: localRscript ? localRLibrary : null,
    webRRepository: "docs/package-repos/webr/bin/emscripten/contrib/4.6",
    pyodideRepository: "docs/package-repos/pyodide",
    requestedTools: tools,
  }),
  inputs: {
    publicSpectrum: "38 PCAWG Lung-AdenoCA SBS96 spectra",
    signatureCatalog: "Full COSMIC_v3_Signatures_GRCh37_SBS96 catalog",
    selectedSignatures: null,
    displayPolicy:
      "Full-catalog exposure matrices are retained; manuscript figures may display top signatures plus an explicit Other remainder.",
    sampleCount: portalInputs.sampleNames.length,
    contextCount: portalInputs.contexts.length,
    signatureCount: portalInputs.signatureNames.length,
  },
  rows,
  artifacts: {
    json: relativeArtifact(RESULT_PATH),
    csv: relativeArtifact(CSV_PATH),
    exposurePairsJson: relativeArtifact(EXPOSURE_PAIRS_PATH),
    exposurePairsCsv: relativeArtifact(EXPOSURE_PAIRS_CSV_PATH),
    readinessLog: relativeArtifact(READINESS_PATH),
    input: relativeArtifact(INPUT_PATH),
    harness: relativeArtifact(HARNESS_PATH),
  },
  status,
  notes: missingTools.length
    ? [`No complete browser/local exposure pair for: ${missingTools.join(", ")}.`]
    : [],
});

await writeJson(RESULT_PATH, result);
await writeJson(READINESS_PATH, {
  schemaVersion: result.schemaVersion,
  generatedAt: result.generatedAt,
  experimentId: EXPERIMENT.id,
  rows: readinessRows,
});
await writeJson(EXPOSURE_PAIRS_PATH, {
  schemaVersion: result.schemaVersion,
  generatedAt: result.generatedAt,
  experimentId: EXPERIMENT.id,
  rows: exposurePairs,
});
await writeCsv(
  CSV_PATH,
  rows.map((row) => ({
    tool: row.tool,
    browser_runtime: row.browserRuntime,
    local_runtime: row.localRuntime,
    sample_count: row.sampleCount,
    signature_count: row.signatureCount,
    mean_exposure_cosine: row.meanExposureCosine,
    median_exposure_cosine: row.medianExposureCosine,
    min_exposure_cosine: row.minExposureCosine,
    max_absolute_exposure_difference: row.maxAbsoluteExposureDifference,
    rmse: row.rmse,
    top_signature_concordance: row.topSignatureConcordance,
    status: row.status,
  }))
);
await writeCsv(EXPOSURE_PAIRS_CSV_PATH, exposurePairs);

if (strict && status !== "completed") {
  throw new Error(`E2 adapter fidelity is incomplete. Missing complete exposure pairs for: ${missingTools.join(", ")}.`);
}

console.log(`Wrote ${relativeArtifact(RESULT_PATH)}`);

function buildExposurePairs(tool, browserExposures, localExposures) {
  const browser = normalizeExposureRows(browserExposures);
  const local = normalizeExposureRows(localExposures);
  const samples = Object.keys(browser).filter((sample) => local[sample]);
  const signatures = [
    ...new Set(
      samples.flatMap((sample) => [
        ...Object.keys(browser[sample] || {}),
        ...Object.keys(local[sample] || {}),
      ])
    ),
  ].sort();
  const rows = [];
  for (const sample of samples.sort()) {
    for (const signature of signatures) {
      rows.push({
        tool,
        sample,
        signature,
        browserExposure: Number(browser[sample]?.[signature]) || 0,
        localExposure: Number(local[sample]?.[signature]) || 0,
        absoluteDifference: Math.abs(
          (Number(browser[sample]?.[signature]) || 0) -
            (Number(local[sample]?.[signature]) || 0)
        ),
      });
    }
  }
  return rows;
}

async function runBrowserAdapters(browserResults, readiness, input) {
  const browsers = await findAvailableBrowsers();
  const browser = browsers.find((candidate) => candidate.id === "chrome") || browsers[0];
  if (!browser) {
    for (const tool of tools) {
      readiness.push({
        tool,
        path: "browser",
        status: "blocked",
        reason: "No supported local browser executable found.",
      });
    }
    return;
  }
  await withStaticServer(process.cwd(), async ({ baseUrl }) => {
    let context = null;
    try {
      context = await launchBrowser(browser, {
        userDataDir: tempDir("e2-adapter-profile"),
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(browserTimeoutMs);
      await page.goto(`${baseUrl}/docs/manuscript/experiments/e2_adapter_fidelity/adapter-fidelity-harness.html?run=${Date.now()}`, {
        waitUntil: "domcontentloaded",
        timeout: browserTimeoutMs,
      });
      await page.waitForFunction(() => window.__MSIG_ADAPTER_READY__ === true, null, {
        timeout: browserTimeoutMs,
      });
      for (const tool of tools) {
        const output = await page.evaluate(
          async ({ tool, input, timeoutMs }) => window.__runAdapterFidelity(tool, input, timeoutMs),
          {
            tool,
            input: {
              spectra: input.spectra,
              signatures: input.signatures,
              contexts: input.contexts,
            },
            timeoutMs: browserTimeoutMs,
          }
        );
        readiness.push({
          tool,
          path: "browser",
          runtime: output.runtime || null,
          status: output.status,
          reason: output.error || null,
          packageVersion: output.packageVersion || null,
        });
        if (output.status === "completed" && output.exposures) {
          browserResults[tool] = output;
        }
      }
    } catch (error) {
      for (const tool of tools) {
        readiness.push({
          tool,
          path: "browser",
          status: "blocked",
          reason: error.message,
        });
      }
    } finally {
      if (context) await context.close();
    }
  });
}

async function runLocalAdapters(localResults, readiness, input) {
  for (const tool of tools) {
    try {
      let output;
      if (tool === "deconstructsigs") {
        output = await runLocalRTool({
          tool,
          packages: [
            { name: "deconstructSigs", version: "1.8.0" },
          ],
          prepared: prepareDeconstructSigsInput(
            { spectra: input.spectra, signatures: input.signatures },
            {
              contexts: input.contexts,
              spectraPath: "input/deconstructsigs_spectra.tsv",
              signaturePath: "input/deconstructsigs_signatures.tsv",
              outputPath: "output/deconstructsigs_exposures.tsv",
              signatureCutoff: 0,
            }
          ),
          parser: (text) => parseDeconstructSigsOutput(text, { normalize: true }),
        });
      } else if (tool === "sigminer") {
        output = await runLocalRTool({
          tool,
          packages: [
            { name: "sigminer", version: "2.3.1" },
            { name: "nnls", version: "1.6" },
          ],
          prepared: prepareSigminerInput(
            { spectra: input.spectra, signatures: input.signatures },
            {
              contexts: input.contexts,
              spectraPath: "input/sigminer_spectra.tsv",
              signaturePath: "input/sigminer_signatures.tsv",
              outputPath: "output/sigminer_exposures.tsv",
              method: "NNLS",
              exposureType: "relative",
              relThreshold: 0,
            }
          ),
          parser: (text) => parseSigminerOutput(text, { normalize: true }),
        });
      } else if (tool === "sigprofilerassignment") {
        output = await runLocalSigProfilerAssignment(input);
      } else if (tool === "musical") {
        output = await runLocalMusical(input);
      }
      localResults[tool] = output;
      readiness.push({
        tool,
        path: "local",
        runtime: output.runtime,
        status: "completed",
        reason: null,
        packageVersion: output.packageVersion || null,
      });
    } catch (error) {
      readiness.push({
        tool,
        path: "local",
        status: "blocked",
        reason: error.message,
      });
    }
  }
}

async function runLocalRTool({ tool, packages, prepared, parser }) {
  const workDir = tempDir(`e2-${tool}-local-r`);
  await mkdir(path.join(workDir, "input"), { recursive: true });
  await mkdir(path.join(workDir, "output"), { recursive: true });
  for (const file of prepared.files) {
    const target = path.join(workDir, file.path.replace(/^\/+/, ""));
    await ensureDir(path.dirname(target));
    await writeText(target, file.text);
  }
  const scriptPath = path.join(workDir, `${tool}.R`);
  await writeText(scriptPath, [
    packageInstallScript(packages),
    prepared.rSnippet,
  ].join("\n"));
  if (localRscript) {
    await ensureDir(localRLibrary);
    const local = await runCommand(localRscript, [scriptPath], {
      cwd: workDir,
      env: {
        R_LIBS_USER: localRLibrary,
      },
    });
    if (local.status !== "completed") {
      throw new Error(local.stderr || local.stdout || `${tool} local Rscript run failed.`);
    }
    const outputPath = path.join(workDir, prepared.manifest.outputPath.replace(/^\/+/, ""));
    const text = await readFile(outputPath, "utf8");
    return {
      tool,
      runtime: `local:${path.basename(localRscript)}`,
      packageVersion: packages.map((pkg) => `${pkg.name} ${pkg.version}`).join("; "),
      exposures: parser(text),
    };
  }
  const repoMount = process.cwd().replaceAll("\\", "/");
  const relScript = path.relative(process.cwd(), scriptPath).replaceAll("\\", "/");
  const docker = await runCommand("docker", [
    "run",
    "--rm",
    "-v",
    `${repoMount}:/work`,
    "-w",
    `/work/${path.relative(process.cwd(), workDir).replaceAll("\\", "/")}`,
    "r-base:4.4.2",
    "sh",
    "-lc",
    [
      "apt-get update >/dev/null",
      "apt-get install -y --no-install-recommends libcurl4-openssl-dev libssl-dev libxml2-dev zlib1g-dev >/dev/null",
      `Rscript ${path.basename(relScript)}`,
    ].join(" && "),
  ]);
  if (docker.status !== "completed") {
    throw new Error(docker.stderr || docker.stdout || `${tool} local R run failed.`);
  }
  const outputPath = path.join(workDir, prepared.manifest.outputPath.replace(/^\/+/, ""));
  const text = await readFile(outputPath, "utf8");
  return {
    tool,
    runtime: "docker:r-base:4.4.2",
    packageVersion: packages.map((pkg) => `${pkg.name} ${pkg.version}`).join("; "),
    exposures: parser(text),
  };
}

async function runLocalSigProfilerAssignment(input) {
  const workDir = tempDir("e2-spa-local-python");
  await mkdir(path.join(workDir, "input"), { recursive: true });
  await mkdir(path.join(workDir, "output"), { recursive: true });
  const prepared = prepareSigProfilerAssignmentInput(
    { spectra: input.spectra, signatures: input.signatures },
    {
      contexts: input.contexts,
      samplePath: "input/samples.tsv",
      signaturePath: "input/signatures.tsv",
    }
  );
  for (const file of prepared.files) {
    const target = path.join(workDir, file.path.replace(/^\/+/, ""));
    await ensureDir(path.dirname(target));
    await writeText(target, file.text);
  }
  const scriptPath = path.join(workDir, "spa_local.py");
  await writeText(scriptPath, sigProfilerAssignmentScript());
  await runPythonDocker({
    workDir,
    installCommand:
      [
        "python -m pip install --quiet numpy scipy pandas matplotlib scikit-learn statsmodels pillow seaborn reportlab pdf2image pypdf alive-progress",
        "/work/docs/package-repos/pyodide/sigprofilermatrixgenerator-1.3.6-py3-none-any.whl",
        "/work/docs/package-repos/pyodide/sigprofilerplotting-1.4.3-py3-none-any.whl",
        "/work/docs/package-repos/pyodide/sigprofilerassignment-1.1.3-py3-none-any.whl",
      ].join(" "),
    scriptName: path.basename(scriptPath),
  });
  const files = await collectFiles(path.join(workDir, "output"));
  const parsed = parseExposureTables(files, { normalize: true });
  if (!parsed.exposures) {
    throw new Error("SigProfilerAssignment local run completed but no exposure table was parsed.");
  }
  return {
    tool: "sigprofilerassignment",
    runtime: "docker:python:3.11-slim",
    packageVersion: "SigProfilerAssignment 1.1.3",
    exposures: parsed.exposures,
  };
}

async function runLocalMusical(input) {
  const workDir = tempDir("e2-musical-local-python");
  await mkdir(path.join(workDir, "input"), { recursive: true });
  await mkdir(path.join(workDir, "output"), { recursive: true });
  const prepared = prepareMuSiCalRefitInput(
    { spectra: input.spectra, signatures: input.signatures },
    {
      contexts: input.contexts,
      spectraPath: "input/musical_spectra.tsv",
      signaturePath: "input/musical_signatures.tsv",
    }
  );
  for (const file of prepared.files) {
    const target = path.join(workDir, file.path.replace(/^\/+/, ""));
    await ensureDir(path.dirname(target));
    await writeText(target, file.text);
  }
  const scriptPath = path.join(workDir, "musical_local.py");
  await writeText(scriptPath, musicalScript());
  await runPythonDocker({
    workDir,
    installCommand:
      "python -m pip install --quiet numpy scipy pandas scikit-learn statsmodels matplotlib seaborn /work/docs/package-repos/pyodide/musical-1.0.0-py3-none-any.whl",
    scriptName: path.basename(scriptPath),
  });
  const output = JSON.parse(await readFile(path.join(workDir, "output", "musical_exposures.json"), "utf8"));
  return {
    tool: "musical",
    runtime: "docker:python:3.11-slim",
    packageVersion: "MuSiCal 1.0.0",
    exposures: output.exposures,
  };
}

async function runPythonDocker({ workDir, installCommand, scriptName, image = "python:3.11-slim" }) {
  const repoMount = process.cwd().replaceAll("\\", "/");
  const workRel = path.relative(process.cwd(), workDir).replaceAll("\\", "/");
  const docker = await runCommand("docker", [
    "run",
    "--rm",
    "-v",
    `${repoMount}:/work`,
    "-w",
    `/work/${workRel}`,
    image,
    "sh",
    "-lc",
    `${installCommand} && python ${scriptName}`,
  ]);
  if (docker.status !== "completed") {
    throw new Error(docker.stderr || docker.stdout || "Python local comparator failed.");
  }
}

async function collectFiles(directory, prefix = "") {
  const rows = [];
  if (!existsSync(directory)) return rows;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      rows.push(...await collectFiles(absolute, rel));
    } else {
      try {
        rows.push({ path: rel, text: await readFile(absolute, "utf8") });
      } catch (_error) {
        // Binary plotting artifacts are ignored for exposure parsing.
      }
    }
  }
  return rows;
}

function packageInstallScript(packages) {
  const names = packages.map((pkg) => pkg.name);
  const versions = packages.map((pkg) => pkg.version);
  return `packages <- data.frame(name = c(${names.map((name) => JSON.stringify(name)).join(", ")}), version = c(${versions.map((version) => JSON.stringify(version)).join(", ")}), stringsAsFactors = FALSE)
if (!requireNamespace("remotes", quietly = TRUE)) install.packages("remotes", repos = "https://cloud.r-project.org")
if (any(packages$name %in% c("deconstructSigs", "sigminer")) && !requireNamespace("BiocManager", quietly = TRUE)) {
  install.packages("BiocManager", repos = "https://cloud.r-project.org")
}
if ("deconstructSigs" %in% packages$name) {
  BiocManager::install(c("BSgenome", "BSgenome.Hsapiens.UCSC.hg19", "GenomeInfoDb"), ask = FALSE, update = FALSE)
}
if ("sigminer" %in% packages$name) {
  BiocManager::install(c("maftools"), ask = FALSE, update = FALSE)
}
for (i in seq_len(nrow(packages))) {
  name <- packages$name[[i]]
  version <- packages$version[[i]]
  if (!requireNamespace(name, quietly = TRUE)) {
    remotes::install_version(name, version = version, repos = "https://cloud.r-project.org", upgrade = "never")
  }
}
`;
}

function sigProfilerAssignmentScript() {
  return `from SigProfilerAssignment import Analyzer as Analyze
Analyze.cosmic_fit(
    samples="input/samples.tsv",
    output="output/sigprofilerassignment",
    input_type="matrix",
    context_type="96",
    collapse_to_SBS96=True,
    cosmic_version=3.5,
    exome=False,
    genome_build="GRCh37",
    signature_database="input/signatures.tsv",
    make_plots=False,
    sample_reconstruction_plots="none",
    export_probabilities=False,
    export_probabilities_per_mutation=False,
    verbose=False,
    cpu=1,
)
`;
}

function musicalScript() {
  return `import json
import pandas as pd
from musical.refit import refit

X = pd.read_csv("input/musical_spectra.tsv", sep="\\t", index_col=0)
W = pd.read_csv("input/musical_signatures.tsv", sep="\\t", index_col=0)
H, model = refit(X, W, method="likelihood_bidirectional", thresh=0.001, connected_sigs=False)
sample_by_signature = {}
for signature_name, sample_values in H.to_dict(orient="index").items():
    for sample_name, exposure in sample_values.items():
        sample_by_signature.setdefault(sample_name, {})[signature_name] = float(exposure)
with open("output/musical_exposures.json", "w", encoding="utf-8") as handle:
    json.dump({"exposures": sample_by_signature}, handle, indent=2)
`;
}

function adapterHarness() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>E2 adapter fidelity harness</title>
  </head>
  <body>
    <pre id="status">Loading SDK...</pre>
    <script type="module">
      const { mSigSDK } = await import("/main.js?e2=" + Date.now());
      document.querySelector("#status").textContent = "Ready";
      window.__MSIG_ADAPTER_READY__ = true;
      const wheelUrl = (pathname) => new URL(pathname, location.origin).href;
      const pyodideScientificPackages = ["numpy", "scipy", "pandas", "matplotlib", "scikit-learn", "statsmodels", "pillow"];
      const sigProfilerAssignmentWheels = [
        "/docs/package-repos/pyodide/sigprofilerassignment-1.1.3-py3-none-any.whl",
        "/docs/package-repos/pyodide/sigprofilermatrixgenerator-1.3.6-py3-none-any.whl",
        "/docs/package-repos/pyodide/sigprofilerplotting-1.4.3-py3-none-any.whl",
        "/docs/package-repos/pyodide/alive_progress-3.3.0-py3-none-any.whl",
        "/docs/package-repos/pyodide/about_time-4.2.1-py3-none-any.whl",
        "/docs/package-repos/pyodide/graphemeu-0.7.2-py3-none-any.whl",
        "/docs/package-repos/pyodide/pdf2image-1.17.0-py3-none-any.whl",
        "/docs/package-repos/pyodide/pypdf-6.11.0-py3-none-any.whl",
        "/docs/package-repos/pyodide/reportlab-4.5.1-py3-none-any.whl"
      ].map((pathname) => ({ spec: wheelUrl(pathname), options: { deps: false } }));
      const webR46 = {
        repositoryUrl: [
          new URL("/docs/package-repos/webr", location.origin).href,
          "https://repo.r-wasm.org"
        ],
        binaryRVersion: "4.6",
        packageIndexUrls: [
          new URL("/docs/package-repos/webr/bin/emscripten/contrib/4.6/PACKAGES", location.origin).href,
          "https://repo.r-wasm.org/bin/emscripten/contrib/4.6/PACKAGES"
        ]
      };
      window.__runAdapterFidelity = async function runAdapter(tool, input, timeoutMs) {
        try {
          let output;
          if (tool === "deconstructsigs") {
            output = await mSigSDK.adapters.runDeconstructSigsWebR(input, {
              contexts: input.contexts,
              signatureCutoff: 0,
              ...webR46,
              timeoutMs
            });
          } else if (tool === "sigminer") {
            output = await mSigSDK.adapters.runSigminerWebR(input, {
              contexts: input.contexts,
              method: "NNLS",
              exposureType: "relative",
              relThreshold: 0,
              ...webR46,
              timeoutMs
            });
          } else if (tool === "sigprofilerassignment") {
            output = await mSigSDK.adapters.runSigProfilerAssignment(input, {
              contexts: input.contexts,
              pyodidePackages: pyodideScientificPackages,
              micropipPackages: sigProfilerAssignmentWheels,
              timeoutMs
            });
          } else if (tool === "musical") {
            output = await mSigSDK.adapters.runMuSiCalRefit(input, {
              contexts: input.contexts,
              pyodidePackages: pyodideScientificPackages,
              micropipPackages: [
                { spec: wheelUrl("/docs/package-repos/pyodide/musical-1.0.0-py3-none-any.whl"), options: { deps: false } },
                { spec: wheelUrl("/docs/package-repos/pyodide/seaborn-0.13.2-py3-none-any.whl"), options: { deps: false } }
              ],
              timeoutMs
            });
          } else {
            throw new Error("Unknown adapter " + tool);
          }
          return {
            status: output.status || "completed",
            runtime: output.runtime,
            packageVersion: output.provenance?.packageVersion || null,
            exposures: output.exposures || null
          };
        } catch (error) {
          return {
            status: "blocked",
            runtime: tool === "deconstructsigs" || tool === "sigminer" ? "webr" : "pyodide",
            error: error.message,
            code: error.code || null
          };
        }
      };
    </script>
  </body>
</html>`;
}

function summarizeReadinessReason(reason) {
  if (!reason) return null;
  const text = String(reason)
    .replace(/\r/g, "")
    .replaceAll("â€˜", "'")
    .replaceAll("â€™", "'")
    .replaceAll("â€œ", '"')
    .replaceAll("â€", '"');
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const meaningful = lines.filter(
    (line) =>
      /^error\b|^typeerror\b|^modulenotfounderror\b|^traceback\b|blocked|failed|there is no package|requires|could not|cannot|no matching/i.test(line)
  );
  const selected = meaningful.length ? meaningful : lines;
  const summary = selected.slice(-8).join(" | ");
  return summary.length > 1200 ? `${summary.slice(0, 1197)}...` : summary;
}
