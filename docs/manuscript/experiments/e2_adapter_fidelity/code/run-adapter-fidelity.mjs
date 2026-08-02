import path from "node:path";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
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
import {
  DEFAULT_PYODIDE_INDEX_URL,
  DEFAULT_WEBR_BINARY_R_VERSION,
  DEFAULT_WEBR_MODULE_URL,
  DEFAULT_WEBR_REPOSITORY_URL,
} from "../../../../../mSigSDKScripts/runners.js";

const EXPERIMENT = EXPERIMENTS.e2;
const args = parseArgs();
const strict = args.strict !== "false";
const outputDir = args["output-dir"] ? path.resolve(args["output-dir"]) : EXPERIMENT.dir;
const inputFile = args["input-file"] ? path.resolve(args["input-file"]) : null;
const experimentId = args["experiment-id"] || EXPERIMENT.id;
const skipBrowser = args["skip-browser"] === "true";
const RESULT_PATH = path.join(outputDir, "data", "adapter-fidelity-results.json");
const CSV_PATH = path.join(outputDir, "data", "adapter_fidelity_summary.csv");
const READINESS_PATH = path.join(outputDir, "data", "environment-readiness-log.json");
const INPUT_PATH = path.join(outputDir, "data", "adapter-fidelity-input.json");
const PROGRESS_PATH = path.join(outputDir, "data", "adapter-fidelity-progress.json");
const EXPOSURE_PAIRS_PATH = path.join(outputDir, "data", "adapter-fidelity-exposure-pairs.json");
const EXPOSURE_PAIRS_CSV_PATH = path.join(outputDir, "data", "adapter_fidelity_exposure_pairs.csv");
const HARNESS_PATH = path.join(outputDir, "adapter-fidelity-harness.html");
const browserTimeoutMs = Number(args["browser-timeout-ms"] || 600000);
const adapterFidelitySeed = Math.trunc(Number(args.seed || process.env.MSIG_E2_SEED || 104729));
if (!Number.isFinite(adapterFidelitySeed)) {
  throw new Error("Adapter fidelity seed must be a finite number.");
}
const requestedLocalRscript = args["local-rscript"] || process.env.MSIG_E2_RSCRIPT || null;
const localRLibrary =
  args["r-library"] ||
  process.env.MSIG_E2_R_LIBS_USER ||
  path.join(process.cwd(), ".tools", "r-library", "R-4.6");
const localRscript = requestedLocalRscript || (await detectUsableLocalRscript(localRLibrary));
const localRSource = requestedLocalRscript ? "explicit" : localRscript ? "auto-detected" : "docker-fallback";
const requestedLocalPython = args["local-python"] || process.env.MSIG_E2_PYTHON || null;
const localPython = requestedLocalPython || (await detectUsableLocalPython());
const localPythonSource = requestedLocalPython ? "explicit" : localPython ? "auto-detected" : "docker-fallback";
const tools = ["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"];
const pyodideScientificPackages = ["numpy", "scipy", "pandas", "matplotlib", "scikit-learn", "statsmodels", "pillow"];
const sigProfilerAssignmentWheelPaths = [
  "/docs/package-repos/pyodide/sigprofilerassignment-1.1.3-py3-none-any.whl",
  "/docs/package-repos/pyodide/sigprofilermatrixgenerator-1.3.6-py3-none-any.whl",
  "/docs/package-repos/pyodide/sigprofilerplotting-1.4.3-py3-none-any.whl",
  "/docs/package-repos/pyodide/alive_progress-3.3.0-py3-none-any.whl",
  "/docs/package-repos/pyodide/about_time-4.2.1-py3-none-any.whl",
  "/docs/package-repos/pyodide/graphemeu-0.7.2-py3-none-any.whl",
  "/docs/package-repos/pyodide/pdf2image-1.17.0-py3-none-any.whl",
  "/docs/package-repos/pyodide/pypdf-6.11.0-py3-none-any.whl",
  "/docs/package-repos/pyodide/reportlab-4.5.1-py3-none-any.whl",
];
const musicalMicropipPackages = [
  { path: "/docs/package-repos/pyodide/musical-1.0.0-py3-none-any.whl", options: { deps: false } },
  { path: "/docs/package-repos/pyodide/seaborn-0.13.2-py3-none-any.whl", options: { deps: false } },
];
const webRRepositoryPaths = ["/docs/package-repos/webr", DEFAULT_WEBR_REPOSITORY_URL];
const webRPackageIndexPaths = [
  "/docs/package-repos/webr/bin/emscripten/contrib/4.6/PACKAGES",
  `${DEFAULT_WEBR_REPOSITORY_URL}/bin/emscripten/contrib/4.6/PACKAGES`,
];
const comparisonTolerancePolicy = {
  exactMaxAbsoluteExposureDifference: 0,
  floatingPointNoiseMaxAbsoluteExposureDifference: 1e-12,
  floatingPointNoiseRmse: 1e-12,
  exactTools: ["deconstructsigs", "sigminer", "sigprofilerassignment"],
  floatingPointNoiseTools: ["musical"],
};

await ensureDir(path.dirname(RESULT_PATH));
await writeProgressCheckpoint("initializing", {
  seed: adapterFidelitySeed,
  browserTimeoutMs,
});
await writeText(HARNESS_PATH, adapterHarness(adapterFidelitySeed));
await writeProgressCheckpoint("harness-written", {
  harnessPath: relativeArtifact(HARNESS_PATH),
});

const portalInputs = inputFile
  ? JSON.parse(await readFile(inputFile, "utf8"))
  : await fetchPortalInputs({
      sampleLimit: 38,
      selectedSignatures: null,
    });
const inputArtifact = {
  urls: portalInputs.urls || {},
  contexts: portalInputs.contexts,
  sampleNames: portalInputs.sampleNames,
  signatureNames: portalInputs.signatureNames,
  spectra: portalInputs.spectra,
  signatures: portalInputs.signatures,
};
await writeJson(INPUT_PATH, inputArtifact);
await writeProgressCheckpoint("input-written", {
  inputPath: relativeArtifact(INPUT_PATH),
  sampleCount: portalInputs.sampleNames.length,
  contextCount: portalInputs.contexts.length,
  signatureCount: portalInputs.signatureNames.length,
});
const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));
const inputChecksums = await inputArtifactChecksums(inputArtifact, INPUT_PATH);
const browserRun = {};
const packageOptions = buildPackageOptions(adapterFidelitySeed);
const runtimePins = buildRuntimePins(packageJson, packageOptions);
const randomSeedPolicy = buildRandomSeedPolicy(adapterFidelitySeed);
const localRPackageVersions = localRscript ? await collectLocalRPackageVersions() : null;
const localPythonPackageVersions = localPython ? await collectLocalPythonPackageVersions() : null;

const browserResults = {};
const localResults = {};
const readiness = [];

if (skipBrowser) {
  await writeProgressCheckpoint("browser-skipped", {
    reason: "CLI option --skip-browser=true",
  });
} else {
  await runBrowserAdapters(browserResults, readiness, portalInputs, browserRun);
}
await writeProgressCheckpoint("browser-adapters-finished", {
  completed: Object.keys(browserResults),
  readinessCount: readiness.length,
});
await runLocalAdapters(localResults, readiness, portalInputs);
await writeProgressCheckpoint("local-adapters-finished", {
  completed: Object.keys(localResults),
  readinessCount: readiness.length,
});

const rows = [];
const exposurePairs = [];
for (const tool of tools) {
  const browser = browserResults[tool];
  const local = localResults[tool];
  if (skipBrowser && local?.exposures) {
    const sampleNames = Object.keys(local.exposures);
    const signatureNames = sampleNames.length ? Object.keys(local.exposures[sampleNames[0]] || {}) : [];
    rows.push({
      tool,
      browserRuntime: null,
      browserRuntimeVersion: null,
      localRuntime: local.runtime,
      localRuntimeVersion: local.runtimeVersion || null,
      browserPackageVersion: null,
      localPackageVersion: local.packageVersion || null,
      packageOptions: packageOptions.tools[tool],
      randomSeed: adapterFidelitySeed,
      randomSeedPolicy: randomSeedPolicy.tools[tool],
      sampleCount: sampleNames.length,
      signatureCount: signatureNames.length,
      comparisonPass: true,
      status: "local-only",
    });
    continue;
  }
  if (!browser?.exposures || !local?.exposures) continue;
  const comparison = compareExposureMatrices(browser.exposures, local.exposures);
  const tolerance = comparisonToleranceForTool(tool);
  const comparisonPass = comparisonWithinTolerance(comparison, tolerance);
  rows.push({
    tool,
    browserRuntime: browser.runtime,
    browserRuntimeVersion: browser.runtimeVersion || null,
    localRuntime: local.runtime,
    localRuntimeVersion: local.runtimeVersion || null,
    browserPackageVersion: browser.packageVersion || null,
    localPackageVersion: local.packageVersion || null,
    packageOptions: packageOptions.tools[tool],
    randomSeed: adapterFidelitySeed,
    randomSeedPolicy: randomSeedPolicy.tools[tool],
    ...comparison,
    comparisonTolerance: tolerance,
    comparisonPass,
    status: comparisonPass ? "pass" : "failed",
  });
  exposurePairs.push(...buildExposurePairs(tool, browser.exposures, local.exposures));
}

const availableExposureResults = Object.fromEntries(
  tools.map((tool) => [tool, (browserResults[tool] || localResults[tool])?.exposures || null])
);
const exposureMatrixPath = path.join(outputDir, "data", "adapter-exposure-matrices.json");

const missingTools = tools.filter(
  (tool) => skipBrowser
    ? !localResults[tool]?.exposures
    : !browserResults[tool]?.exposures || !localResults[tool]?.exposures
);
const failedComparisons = rows.filter((row) => row.comparisonPass === false);
const status = missingTools.length === 0 && failedComparisons.length === 0 ? "completed" : "failed";
const readinessRows = readiness.map((row) => ({
  ...row,
  reason: summarizeReadinessReason(row.reason),
}));
const result = createResult({
  experimentId,
  environment: environmentSummary({
    browserTimeoutMs,
    localComparator: localRscript
      ? `local Rscript (${localRscript})`
      : "Docker containers",
    localRSource,
    localRLibrary: localRscript ? localRLibrary : null,
    localRPackageVersions,
    localPython: localPython || null,
    localPythonSource,
    localPythonPackageVersions,
    webRRepository: "docs/package-repos/webr/bin/emscripten/contrib/4.6",
    pyodideRepository: "docs/package-repos/pyodide",
    browserRun,
    runtimePins,
    packageOptions,
    randomSeedPolicy,
    comparisonTolerancePolicy,
    requestedTools: tools,
  }),
  inputs: {
    publicSpectrum: inputFile ? "CLI-provided SBS96 spectrum matrix" : "38 PCAWG Lung-AdenoCA SBS96 spectra",
    signatureCatalog: inputFile ? "CLI-provided SBS96 signature catalog" : "Full COSMIC_v3_Signatures_GRCh37_SBS96 catalog",
    selectedSignatures: null,
    displayPolicy:
      "Full-catalog exposure matrices are retained; manuscript figures may display top signatures plus an explicit Other remainder.",
    sampleCount: portalInputs.sampleNames.length,
    contextCount: portalInputs.contexts.length,
    signatureCount: portalInputs.signatureNames.length,
    urls: portalInputs.urls,
    checksums: inputChecksums,
  },
  rows,
  artifacts: {
    json: relativeArtifact(RESULT_PATH),
    csv: relativeArtifact(CSV_PATH),
    exposurePairsJson: relativeArtifact(EXPOSURE_PAIRS_PATH),
    exposurePairsCsv: relativeArtifact(EXPOSURE_PAIRS_CSV_PATH),
    exposureMatricesJson: relativeArtifact(exposureMatrixPath),
    readinessLog: relativeArtifact(READINESS_PATH),
    input: relativeArtifact(INPUT_PATH),
    harness: relativeArtifact(HARNESS_PATH),
  },
  status,
  notes: [
    ...(skipBrowser
      ? ["Browser adapters were skipped; local adapter outputs are retained for the synthetic benchmark."]
      : []),
    ...(missingTools.length
      ? [`No complete browser/local exposure pair for: ${missingTools.join(", ")}.`]
      : []),
    ...(failedComparisons.length
      ? [`Comparison tolerance failed for: ${failedComparisons.map((row) => row.tool).join(", ")}.`]
      : []),
  ],
});

await writeJson(RESULT_PATH, result);
await writeProgressCheckpoint("result-written", {
  resultPath: relativeArtifact(RESULT_PATH),
  status,
  rows: rows.length,
});
await writeJson(READINESS_PATH, {
  schemaVersion: result.schemaVersion,
  generatedAt: result.generatedAt,
  experimentId,
  rows: readinessRows,
});
await writeJson(EXPOSURE_PAIRS_PATH, {
  schemaVersion: result.schemaVersion,
  generatedAt: result.generatedAt,
  experimentId,
  rows: exposurePairs,
});
await writeJson(exposureMatrixPath, {
  schemaVersion: "msig.manuscript.e2.exposure-matrices.v1",
  generatedAt: result.generatedAt,
  experimentId,
  source: skipBrowser ? "local" : "browser-preferred",
  tools: availableExposureResults,
});
await writeCsv(
  CSV_PATH,
  rows.map((row) => ({
    tool: row.tool,
    browser_runtime: row.browserRuntime,
    browser_runtime_version: row.browserRuntimeVersion,
    local_runtime: row.localRuntime,
    local_runtime_version: row.localRuntimeVersion,
    browser_package_version: row.browserPackageVersion,
    local_package_version: row.localPackageVersion,
    random_seed: row.randomSeed,
    tolerance_kind: row.comparisonTolerance?.kind || null,
    max_abs_diff_tolerance: row.comparisonTolerance?.maxAbsoluteExposureDifference ?? null,
    rmse_tolerance: row.comparisonTolerance?.rmse ?? null,
    sample_count: row.sampleCount,
    signature_count: row.signatureCount,
    mean_exposure_cosine: row.meanExposureCosine,
    median_exposure_cosine: row.medianExposureCosine,
    min_exposure_cosine: row.minExposureCosine,
    max_absolute_exposure_difference: row.maxAbsoluteExposureDifference,
    rmse: row.rmse,
    top_signature_concordance: row.topSignatureConcordance,
    comparison_pass: row.comparisonPass,
    status: row.status,
  }))
);
await writeCsv(EXPOSURE_PAIRS_CSV_PATH, exposurePairs);

if (strict && status !== "completed") {
  throw new Error(`E2 adapter fidelity is incomplete. Missing complete exposure pairs for: ${missingTools.join(", ")}.`);
}

console.log(`Wrote ${relativeArtifact(RESULT_PATH)}`);

async function writeProgressCheckpoint(stage, details = {}) {
  await writeJson(PROGRESS_PATH, {
    schemaVersion: "msig.manuscript.e2.progress.v1",
    experimentId,
    updatedAt: new Date().toISOString(),
    stage,
    details,
  });
}

async function detectUsableLocalRscript(rLibrary) {
  const candidates = [
    "Rscript",
    process.env.RSCRIPT,
    process.env.R_HOME ? path.join(process.env.R_HOME, "bin", "Rscript.exe") : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "R", "R-4.6.0", "bin", "Rscript.exe") : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "R", "R-4.6.0", "bin", "Rscript") : null,
  ].filter(Boolean);
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const probe = await runCommand(
      candidate,
      [
        "-e",
        [
          "expected <- c(deconstructSigs='1.8.0', sigminer='2.3.1', nnls='1.6')",
          "ok <- vapply(names(expected), function(p) requireNamespace(p, quietly=TRUE) && as.character(packageVersion(p)) == expected[[p]], logical(1))",
          "cat(paste(names(expected), ok, sep='=', collapse=';'))",
          "quit(status=if (all(ok)) 0 else 1)",
        ].join("; "),
      ],
      {
        env: {
          R_LIBS_USER: rLibrary,
        },
      }
    );
    if (probe.status === "completed") {
      return candidate;
    }
  }
  return null;
}

async function detectUsableLocalPython() {
  const candidates = [
    process.env.PYTHON,
    "python",
  ].filter(Boolean);
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const probe = await runCommand(candidate, [
      "-c",
      [
        "import importlib.metadata as md",
        "expected={'SigProfilerAssignment':'1.1.3','SigProfilerMatrixGenerator':'1.3.6','sigProfilerPlotting':'1.4.3','musical':'1.0.0'}",
        "missing=[]",
        "for p,v in expected.items():",
        "    try:",
        "        installed=md.version(p)",
        "        assert installed == v, f'{p} {installed} != {v}'",
        "    except Exception as exc: missing.append(str(exc))",
        "print(';'.join(missing))",
        "raise SystemExit(0 if not missing else 1)",
      ].join("\n"),
    ]);
    if (probe.status === "completed") {
      return candidate;
    }
  }
  return null;
}

async function collectLocalRPackageVersions() {
  const result = await runCommand(
    localRscript,
    [
      "-e",
      [
        "libs <- c('deconstructSigs','sigminer','nnls')",
        "for (p in libs) cat(p, as.character(packageVersion(p)), '\\n')",
      ].join("; "),
    ],
    {
      env: {
        R_LIBS_USER: localRLibrary,
      },
    }
  );
  if (result.status !== "completed") return null;
  return parsePackageVersionLines(result.stdout);
}

async function collectLocalPythonPackageVersions() {
  const script = [
    "import importlib.metadata as md",
    "pkgs=['SigProfilerAssignment','SigProfilerMatrixGenerator','sigProfilerPlotting','musical','numpy','scipy','pandas','matplotlib','scikit-learn','statsmodels','pillow','seaborn','reportlab','pdf2image','pypdf','alive-progress']",
    "for p in pkgs:",
    "    print(p, md.version(p))",
  ].join("\n");
  const result = await runCommand(localPython, ["-c", script]);
  if (result.status !== "completed") return null;
  return parsePackageVersionLines(result.stdout);
}

function parsePackageVersionLines(text) {
  return Object.fromEntries(
    String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, ...versionParts] = line.split(/\s+/);
        return [name, versionParts.join(" ") || null];
      })
  );
}

async function inputArtifactChecksums(inputArtifact, filePath) {
  const wholeFile = await readFile(filePath);
  return {
    algorithm: "SHA-256",
    canonicalization:
      "wholeFile is the exact JSON artifact bytes; component hashes use stable JSON with sorted object keys.",
    wholeFile: sha256(wholeFile),
    spectra: sha256(stableJson(inputArtifact.spectra)),
    signatures: sha256(stableJson(inputArtifact.signatures)),
    contexts: sha256(stableJson(inputArtifact.contexts)),
    sampleNames: sha256(stableJson(inputArtifact.sampleNames)),
    signatureNames: sha256(stableJson(inputArtifact.signatureNames)),
    urls: sha256(stableJson(inputArtifact.urls)),
  };
}

function buildRuntimePins(packageJson, packageOptions) {
  return {
    sdk: {
      name: packageJson.name,
      version: packageJson.version,
    },
    pyodide: {
      version: versionSegment(DEFAULT_PYODIDE_INDEX_URL),
      indexURL: DEFAULT_PYODIDE_INDEX_URL,
      artifactRepository: "docs/package-repos/pyodide",
    },
    webR: {
      version: versionSegment(DEFAULT_WEBR_MODULE_URL),
      moduleURL: DEFAULT_WEBR_MODULE_URL,
      binaryRVersion: DEFAULT_WEBR_BINARY_R_VERSION,
      defaultRepositoryURL: DEFAULT_WEBR_REPOSITORY_URL,
      fidelityRepositoryURLs: packageOptions.webr.repositoryUrl,
      fidelityPackageIndexURLs: packageOptions.webr.packageIndexUrls,
    },
  };
}

function buildPackageOptions(randomSeed) {
  return {
    webr: {
      repositoryUrl: webRRepositoryPaths,
      binaryRVersion: DEFAULT_WEBR_BINARY_R_VERSION,
      packageIndexUrls: webRPackageIndexPaths,
    },
    pyodide: {
      packages: pyodideScientificPackages,
    },
    tools: {
      deconstructsigs: {
        contexts: "SBS96 input contexts",
        signatureCutoff: 0,
        randomSeed,
        runtime: "webr",
      },
      sigminer: {
        contexts: "SBS96 input contexts",
        method: "NNLS",
        exposureType: "relative",
        relThreshold: 0,
        randomSeed,
        runtime: "webr",
      },
      sigprofilerassignment: {
        contexts: "SBS96 input contexts",
        pyodidePackages: pyodideScientificPackages,
        micropipPackages: sigProfilerAssignmentWheelPaths.map((path) => ({ path, options: { deps: false } })),
        contextType: "96",
        collapseToSBS96: true,
        cosmicVersion: 3.5,
        exome: false,
        genomeBuild: "GRCh37",
        excludeSignatureSubgroups: null,
        exportProbabilities: false,
        cpu: 1,
        verbose: false,
        randomSeed,
        runtime: "pyodide",
      },
      musical: {
        contexts: "SBS96 input contexts",
        pyodidePackages: pyodideScientificPackages,
        micropipPackages: musicalMicropipPackages,
        method: "likelihood_bidirectional",
        threshold: 0.001,
        connectedSigs: false,
        randomSeed,
        runtime: "pyodide",
      },
    },
  };
}

function buildRandomSeedPolicy(randomSeed) {
  return {
    seed: randomSeed,
    appliesTo:
      "Known-signature assignment/refitting is expected to be deterministic; the seed is still set before package calls where the runtime exposes an R, Python, or NumPy PRNG.",
    tools: Object.fromEntries(
      tools.map((tool) => [
        tool,
        {
          stochastic: false,
          seed: randomSeed,
          mechanism: tool === "deconstructsigs" || tool === "sigminer" ? "R set.seed" : "Python random.seed and NumPy random.seed",
        },
      ])
    ),
  };
}

function comparisonToleranceForTool(tool) {
  if (comparisonTolerancePolicy.floatingPointNoiseTools.includes(tool)) {
    return {
      kind: "floating_point_noise",
      maxAbsoluteExposureDifference: comparisonTolerancePolicy.floatingPointNoiseMaxAbsoluteExposureDifference,
      rmse: comparisonTolerancePolicy.floatingPointNoiseRmse,
    };
  }
  return {
    kind: "exact",
    maxAbsoluteExposureDifference: comparisonTolerancePolicy.exactMaxAbsoluteExposureDifference,
    rmse: comparisonTolerancePolicy.exactMaxAbsoluteExposureDifference,
  };
}

function comparisonWithinTolerance(comparison, tolerance) {
  const maxAbs = Number(comparison.maxAbsoluteExposureDifference);
  const rmse = Number(comparison.rmse);
  return (
    Number.isFinite(maxAbs) &&
    Number.isFinite(rmse) &&
    maxAbs <= tolerance.maxAbsoluteExposureDifference &&
    rmse <= tolerance.rmse
  );
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function versionSegment(url) {
  const match = String(url).match(/\/v([^/]+)\//);
  return match ? match[1] : null;
}

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

async function runBrowserAdapters(browserResults, readiness, input, browserRun) {
  const browsers = await findAvailableBrowsers();
  const browser = browsers.find((candidate) => candidate.id === "chrome") || browsers[0];
  browserRun.availableBrowsers = browsers.map((candidate) => ({
    id: candidate.id,
    label: candidate.label,
    engine: candidate.engine,
    executablePath: candidate.executablePath,
  }));
  browserRun.selectedBrowser = browser
    ? {
        id: browser.id,
        label: browser.label,
        engine: browser.engine,
        executablePath: browser.executablePath,
      }
    : null;
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
      await page.goto(`${baseUrl}/${relativeArtifact(HARNESS_PATH)}?run=${Date.now()}`, {
        waitUntil: "domcontentloaded",
        timeout: browserTimeoutMs,
      });
      await page.waitForFunction(() => window.__MSIG_ADAPTER_READY__ === true, null, {
        timeout: browserTimeoutMs,
      });
      browserRun.selectedBrowser = {
        ...browserRun.selectedBrowser,
        browserVersion: context.browser()?.version?.() || null,
        userAgent: await page.evaluate(() => navigator.userAgent),
        userAgentData: await page.evaluate(() => {
          const ua = navigator.userAgentData;
          return ua
            ? {
                brands: ua.brands || null,
                mobile: ua.mobile,
                platform: ua.platform,
              }
            : null;
        }),
      };
      for (const tool of tools) {
        console.log(`Running browser ${tool} adapter...`);
        await writeProgressCheckpoint("browser-adapter-started", {
          tool,
          browser: browserRun.selectedBrowser,
        });
        const output = await page.evaluate(
          async ({ tool, input, timeoutMs, randomSeed }) => window.__runAdapterFidelity(tool, input, timeoutMs, randomSeed),
          {
            tool,
            input: {
              spectra: input.spectra,
              signatures: input.signatures,
              contexts: input.contexts,
            },
            timeoutMs: browserTimeoutMs,
            randomSeed: adapterFidelitySeed,
          }
        );
        readiness.push({
          tool,
          path: "browser",
          runtime: output.runtime || null,
          runtimeVersion: output.runtimeVersion || null,
          browser: browserRun.selectedBrowser,
          status: output.status,
          reason: output.error || null,
          packageVersion: output.packageVersion || null,
        });
        if (output.status === "completed" && output.exposures) {
          browserResults[tool] = output;
        }
        await writeProgressCheckpoint("browser-adapter-finished", {
          tool,
          status: output.status,
          runtime: output.runtime || null,
          packageVersion: output.packageVersion || null,
        });
        console.log(`Browser ${tool} adapter ${output.status}.`);
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
      console.log(`Running local ${tool} comparator...`);
      await writeProgressCheckpoint("local-comparator-started", {
        tool,
        localComparator: localRscript ? `local Rscript (${localRscript})` : "Docker containers",
      });
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
              randomSeed: adapterFidelitySeed,
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
              randomSeed: adapterFidelitySeed,
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
      console.log(`Local ${tool} comparator completed.`);
      await writeProgressCheckpoint("local-comparator-finished", {
        tool,
        runtime: output.runtime,
        runtimeVersion: output.runtimeVersion || null,
        packageVersion: output.packageVersion || null,
      });
      readiness.push({
        tool,
        path: "local",
        runtime: output.runtime,
        runtimeVersion: output.runtimeVersion || null,
        status: "completed",
        reason: null,
        packageVersion: output.packageVersion || null,
      });
    } catch (error) {
      await writeProgressCheckpoint("local-comparator-blocked", {
        tool,
        reason: error.message,
      });
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
    const localRVersion = await detectLocalRVersion(workDir);
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
      runtimeVersion: localRVersion,
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
      `Rscript -e "cat('MSIG_R_VERSION=', R.version.string, '\\n', sep='')"`,
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
    runtimeVersion: parseOutputMarker(docker, "MSIG_R_VERSION"),
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
  await writeText(scriptPath, sigProfilerAssignmentScript(adapterFidelitySeed));
  const pythonRun = localPython
    ? await runLocalPythonScript({ workDir, scriptPath })
    : await runPythonDocker({
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
    runtime: localPython ? `local:${path.basename(localPython)}` : "docker:python:3.11-slim",
    runtimeVersion: parseOutputMarker(pythonRun, "MSIG_PYTHON_VERSION"),
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
  await writeText(scriptPath, musicalScript(adapterFidelitySeed));
  const pythonRun = localPython
    ? await runLocalPythonScript({ workDir, scriptPath })
    : await runPythonDocker({
        workDir,
        installCommand:
          "python -m pip install --quiet numpy scipy pandas scikit-learn statsmodels matplotlib seaborn /work/docs/package-repos/pyodide/musical-1.0.0-py3-none-any.whl",
        scriptName: path.basename(scriptPath),
      });
  const output = JSON.parse(await readFile(path.join(workDir, "output", "musical_exposures.json"), "utf8"));
  return {
    tool: "musical",
    runtime: localPython ? `local:${path.basename(localPython)}` : "docker:python:3.11-slim",
    runtimeVersion: parseOutputMarker(pythonRun, "MSIG_PYTHON_VERSION"),
    packageVersion: "MuSiCal 1.0.0",
    exposures: output.exposures,
  };
}

async function runPythonDocker({ workDir, installCommand, scriptName, image = "python:3.11-slim" }) {
  const repoMount = process.cwd().replaceAll("\\", "/");
  const workRel = path.relative(process.cwd(), workDir).replaceAll("\\", "/");
  const runtimeProbe = `python -c "import sys; print('MSIG_PYTHON_VERSION=' + sys.version.replace('\\\\n', ' '))"`;
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
    `${installCommand} && ${runtimeProbe} && python ${scriptName}`,
  ]);
  if (docker.status !== "completed") {
    throw new Error(docker.stderr || docker.stdout || "Python local comparator failed.");
  }
  return docker;
}

async function runLocalPythonScript({ workDir, scriptPath }) {
  const version = await runCommand(
    localPython,
    ["-c", "import sys; print('MSIG_PYTHON_VERSION=' + sys.version.replace('\\n', ' '))"],
    { cwd: workDir }
  );
  if (version.status !== "completed") {
    throw new Error(version.stderr || version.stdout || "Local Python version probe failed.");
  }
  const local = await runCommand(localPython, [scriptPath], { cwd: workDir });
  local.stdout = `${version.stdout || ""}${local.stdout || ""}`;
  local.stderr = `${version.stderr || ""}${local.stderr || ""}`;
  if (local.status !== "completed") {
    throw new Error(local.stderr || local.stdout || "Local Python comparator failed.");
  }
  return local;
}

async function detectLocalRVersion(workDir) {
  if (!localRscript) return null;
  const version = await runCommand(
    localRscript,
    ["-e", "cat(R.version.string)"],
    {
      cwd: workDir,
      env: {
        R_LIBS_USER: localRLibrary,
      },
    }
  );
  if (version.status !== "completed") return null;
  return (version.stdout || version.stderr || "").trim() || null;
}

function parseOutputMarker(commandResult, marker) {
  const text = `${commandResult.stdout || ""}\n${commandResult.stderr || ""}`;
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^${escaped}=(.*)$`, "m"));
  return match ? match[1].trim() : null;
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

function sigProfilerAssignmentScript(randomSeed) {
  return `import random
import numpy as np
random.seed(${Number(randomSeed)})
np.random.seed(${Number(randomSeed)} % (2 ** 32))
from SigProfilerAssignment import Analyzer as Analyze
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

function musicalScript(randomSeed) {
  return `import json
import random
import numpy as np
import pandas as pd
from musical.refit import refit

random.seed(${Number(randomSeed)})
np.random.seed(${Number(randomSeed)} % (2 ** 32))
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

function adapterHarness(randomSeed) {
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
      const runtimeUrl = (value) => value.startsWith("/") ? new URL(value, location.origin).href : value;
      const wheelUrl = (pathname) => new URL(pathname, location.origin).href;
      const pyodideScientificPackages = ${JSON.stringify(pyodideScientificPackages)};
      const sigProfilerAssignmentWheels = ${JSON.stringify(sigProfilerAssignmentWheelPaths)}
        .map((pathname) => ({ spec: wheelUrl(pathname), options: { deps: false } }));
      const musicalMicropipPackages = ${JSON.stringify(musicalMicropipPackages)}
        .map((pkg) => ({ spec: wheelUrl(pkg.path), options: pkg.options }));
      const runtimeVersions = {
        pyodide: ${JSON.stringify(versionSegment(DEFAULT_PYODIDE_INDEX_URL))},
        webr: ${JSON.stringify(versionSegment(DEFAULT_WEBR_MODULE_URL))}
      };
      const webR46 = {
        repositoryUrl: ${JSON.stringify(webRRepositoryPaths)}.map(runtimeUrl),
        binaryRVersion: ${JSON.stringify(DEFAULT_WEBR_BINARY_R_VERSION)},
        packageIndexUrls: ${JSON.stringify(webRPackageIndexPaths)}.map(runtimeUrl)
      };
      window.__runAdapterFidelity = async function runAdapter(tool, input, timeoutMs, randomSeed = ${JSON.stringify(randomSeed)}) {
        try {
          let output;
          if (tool === "deconstructsigs") {
            output = await mSigSDK.adapters.runDeconstructSigsWebR(input, {
              contexts: input.contexts,
              signatureCutoff: 0,
              randomSeed,
              ...webR46,
              timeoutMs
            });
          } else if (tool === "sigminer") {
            output = await mSigSDK.adapters.runSigminerWebR(input, {
              contexts: input.contexts,
              method: "NNLS",
              exposureType: "relative",
              relThreshold: 0,
              randomSeed,
              ...webR46,
              timeoutMs
            });
          } else if (tool === "sigprofilerassignment") {
            output = await mSigSDK.adapters.runSigProfilerAssignment(input, {
              contexts: input.contexts,
              pyodidePackages: pyodideScientificPackages,
              micropipPackages: sigProfilerAssignmentWheels,
              randomSeed,
              timeoutMs
            });
          } else if (tool === "musical") {
            output = await mSigSDK.adapters.runMuSiCalRefit(input, {
              contexts: input.contexts,
              pyodidePackages: pyodideScientificPackages,
              micropipPackages: musicalMicropipPackages,
              randomSeed,
              timeoutMs
            });
          } else {
            throw new Error("Unknown adapter " + tool);
          }
          return {
            status: output.status || "completed",
            runtime: output.runtime,
            runtimeVersion: runtimeVersions[output.runtime] || null,
            packageVersion: output.provenance?.packageVersion || null,
            randomSeed: output.provenance?.randomSeed ?? randomSeed ?? null,
            exposures: output.exposures || null
          };
        } catch (error) {
          const runtime = tool === "deconstructsigs" || tool === "sigminer" ? "webr" : "pyodide";
          return {
            status: "blocked",
            runtime,
            runtimeVersion: runtimeVersions[runtime] || null,
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
