import {
  exportCOSMICSignatureMatrix,
  exportMuSiCalInput,
  exportSigProfilerMatrix,
  importCOSMICSignatureMatrix,
  importMuSiCalOutput,
  importSigProfilerMatrix,
} from "./io.js";
import {
  getExpectedContexts,
  getMatrixContexts,
  normalizeMatrixObject,
  toFiniteNumber,
} from "./validation.js";
import {
  calculateReconstructionError,
  fitSpectraWithNNLS,
} from "./qc.js";
import {
  checkWebRPackageAvailability,
  detectWebRRuntime,
  runPyodide,
  runWebR,
} from "./runners.js";
import {
  extractSignaturesNMFInWorker,
  selectNMFRank,
} from "./signatureExtraction.js";

const ADAPTER_SCHEMA_VERSION = "msig.adapters.v0.3";
const DEFAULT_SPA_PACKAGE = "SigProfilerAssignment==1.1.3";
const DEFAULT_SPE_PACKAGE = "SigProfilerExtractor==1.2.6";
const DEFAULT_SPMG_PACKAGE = "SigProfilerMatrixGenerator==1.3.6";
const DEFAULT_SPS_PACKAGE = "SigProfilerSimulator==1.2.2";
const DEFAULT_SPC_PACKAGE = "SigProfilerClusters==1.2.2";
const DEFAULT_SPP_PACKAGE = "sigProfilerPlotting==1.4.3";
const DEFAULT_DECONSTRUCTSIGS_WEBR_PACKAGES = ["deconstructSigs"];
const DEFAULT_DECONSTRUCTSIGS_SOURCE_ARCHIVE_URL =
  "https://cran.r-project.org/src/contrib/Archive/deconstructSigs/deconstructSigs_1.8.0.tar.gz";
const DEFAULT_DECONSTRUCTSIGS_SOURCE_VERSION = "1.8.0";
const DEFAULT_DECONSTRUCTSIGS_SOURCE_COMMIT = "725f909dea9fb86ce4dea8a43b727b105da8bdd2";
const DEFAULT_DECONSTRUCTSIGS_SOURCE_FILES = [
  "golden_section_search.R",
  "internal.scripts.R",
  "normalize.data.R",
  "whichSignatures.R",
].map((name) => ({
  path: `/input/deconstructSigs/R/${name}`,
  url: `https://raw.githubusercontent.com/cran/deconstructSigs/${DEFAULT_DECONSTRUCTSIGS_SOURCE_COMMIT}/R/${name}`,
}));
const DEFAULT_SIGMINER_WEBR_PACKAGES = ["sigminer"];
const DEFAULT_PYODIDE_SCIENTIFIC_PACKAGES = [
  "numpy",
  "scipy",
  "pandas",
  "scikit-learn",
];

function normalizeArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizeContextOrder({ spectra, signatures = null, contexts = null } = {}) {
  if (contexts && contexts.length) {
    return [...contexts];
  }
  const observedContexts = getMatrixContexts({
    ...normalizeMatrixObject(spectra || {}),
    ...(signatures ? normalizeMatrixObject(signatures) : {}),
  });
  if (observedContexts.length > 0) {
    return observedContexts;
  }
  const canonicalSbs96 = getExpectedContexts({ profile: "SBS", matrix: 96 });
  return canonicalSbs96 || [];
}

function safeNumber(value, fallback = null) {
  const numeric = toFiniteNumber(value);
  return numeric === null ? fallback : numeric;
}

function isSignatureName(value) {
  return /^(SBS|DBS|ID|CN|SV|RS)[A-Za-z0-9_.-]*/.test(String(value || "").trim());
}

function parseDelimited(text, delimiter = "\t") {
  return String(text || "")
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(delimiter));
}

function scoreExposureTable({ path, text, delimiter = "\t" }) {
  const rows = parseDelimited(text, delimiter);
  if (rows.length < 2 || rows[0].length < 2) {
    return null;
  }
  const header = rows[0].map((value) => String(value || "").trim());
  const firstHeader = header[0].toLowerCase();
  if (/mutationtype|mutation_type|context|channel/.test(firstHeader)) {
    return null;
  }

  const headerSignatureCount = header.slice(1).filter(isSignatureName).length;
  const firstColumnSignatureCount = rows
    .slice(1)
    .map((row) => row[0])
    .filter(isSignatureName).length;
  const pathScore = /activit|exposure|assignment|contribution|signature/i.test(path)
    ? 4
    : 0;
  const score =
    pathScore +
    headerSignatureCount * 2 +
    firstColumnSignatureCount * 2 +
    (/(sample|samples|sample_id)/i.test(header[0]) ? 2 : 0);

  if (score <= 0) {
    return null;
  }

  return {
    path,
    score,
    orientation:
      firstColumnSignatureCount > headerSignatureCount
        ? "signature_by_sample"
        : "sample_by_signature",
  };
}

function parseExposureTables(files, { delimiter = "\t", normalize = true } = {}) {
  const candidates = [];
  for (const file of files || []) {
    if (!file?.text) {
      continue;
    }
    const scored = scoreExposureTable({
      path: file.path || "",
      text: file.text,
      delimiter,
    });
    if (!scored) {
      continue;
    }
    try {
      candidates.push({
        ...scored,
        exposures: importMuSiCalOutput(file.text, {
          delimiter,
          orientation: scored.orientation,
          normalize,
        }),
      });
    } catch (_error) {
      // Non-exposure tables are ignored by design.
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  return {
    exposures: candidates[0]?.exposures || null,
    candidateTables: candidates.map(({ path, score, orientation }) => ({
      path,
      score,
      orientation,
    })),
  };
}

function metricDelimiterFor(text) {
  const firstLine = String(text || "").split(/\r?\n/)[0] || "";
  return firstLine.split(",").length > firstLine.split("\t").length ? "," : "\t";
}

function canonicalReconstructionMetricColumn(header) {
  const normalized = String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (/^sample\b|sample name|sample id|\bsamples\b/.test(normalized)) {
    return "sample";
  }
  if (/cosine/.test(normalized)) {
    return "cosineSimilarity";
  }
  if (/\bkl\b|kullback|leibler/.test(normalized)) {
    return "klDivergence";
  }
  if (/pearson|correlation/.test(normalized)) {
    return "pearsonCorrelation";
  }
  if (/\bl1\b/.test(normalized)) {
    return "l1Error";
  }
  if (/\bl2\b/.test(normalized)) {
    return "l2Error";
  }
  return null;
}

function parseReconstructionMetricTables(files) {
  const candidates = [];
  for (const file of files || []) {
    if (!file?.text) {
      continue;
    }
    const delimiter = metricDelimiterFor(file.text);
    const rows = parseDelimited(file.text, delimiter);
    if (rows.length < 2 || rows[0].length < 2) {
      continue;
    }
    const header = rows[0].map((value) => String(value || "").trim());
    const columnMap = {};
    header.forEach((column, index) => {
      const canonical = canonicalReconstructionMetricColumn(column);
      if (canonical && columnMap[canonical] === undefined) {
        columnMap[canonical] = index;
      }
    });
    const metricKeys = [
      "cosineSimilarity",
      "klDivergence",
      "pearsonCorrelation",
      "l1Error",
      "l2Error",
    ].filter((key) => columnMap[key] !== undefined);
    if (columnMap.sample === undefined || metricKeys.length === 0) {
      continue;
    }
    const parsedRows = rows
      .slice(1)
      .map((row) => {
        const sample = String(row[columnMap.sample] || "").trim();
        if (!sample) {
          return null;
        }
        const record = { sample };
        metricKeys.forEach((key) => {
          record[key] = safeNumber(row[columnMap[key]]);
        });
        return record;
      })
      .filter(Boolean);
    if (!parsedRows.length) {
      continue;
    }
    const pathScore = /assignment|solution|stat|metric|reconstruction|quality/i.test(
      file.path || ""
    )
      ? 4
      : 0;
    candidates.push({
      path: file.path || "",
      score: pathScore + metricKeys.length * 3 + parsedRows.length / 100,
      columns: metricKeys,
      rows: parsedRows,
    });
  }
  candidates.sort((left, right) => right.score - left.score);
  return {
    metrics: candidates[0]?.rows || null,
    candidateTables: candidates.map(({ path, score, columns, rows }) => ({
      path,
      score,
      columns,
      rowCount: rows.length,
    })),
  };
}

function buildAdapterProvenance({
  tool,
  runtime,
  packageName = null,
  packageVersion = null,
  parameters = {},
  notes = [],
} = {}) {
  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    tool,
    runtime,
    packageName,
    packageVersion,
    parameters,
    notes: normalizeArray(notes),
    generatedAt: new Date().toISOString(),
  };
}

function normalizeVirtualPath(path, rootDirectory = "/input") {
  const normalizedPath = String(path || "").replace(/\\/g, "/");
  if (normalizedPath.startsWith("/")) {
    return normalizedPath;
  }
  const normalizedRoot = String(rootDirectory || "/input")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
  return `${normalizedRoot}/${normalizedPath.replace(/^\/+/, "")}`;
}

function normalizeVirtualFiles(files, rootDirectory = "/input") {
  return normalizeArray(files).map((file, index) => ({
    ...file,
    path: normalizeVirtualPath(
      file?.path || file?.name || `input_${index + 1}.txt`,
      rootDirectory
    ),
  }));
}

function pythonLiteral(value) {
  if (value === undefined || value === null) {
    return "None";
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "None";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => pythonLiteral(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .map(([key, item]) => `${pythonLiteral(key)}: ${pythonLiteral(item)}`)
      .join(", ")}}`;
  }
  return JSON.stringify(String(value));
}

function buildPythonCall(functionName, positionalArgs = [], keywordArgs = {}) {
  const args = [
    ...positionalArgs.map((value) => pythonLiteral(value)),
    ...Object.entries(keywordArgs).map(
      ([key, value]) => `${key}=${pythonLiteral(value)}`
    ),
  ];
  return `${functionName}(${args.join(", ")})`;
}

/**
 * Prepares matrix-mode input files for SigProfilerAssignment.
 *
 * @function prepareSigProfilerAssignmentInput
 * @memberof adapters
 * @param {Object} input - Input matrices.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra.
 * @param {Object<string,Object<string,number>>} [input.signatures=null] - Optional custom signature catalog.
 * @param {Object} [options] - Export options.
 * @param {string[]} [options.contexts=null] - Mutation-context row order.
 * @returns {Object} Virtual files and manifest metadata for a Pyodide run.
 */
function prepareSigProfilerAssignmentInput(
  { spectra, signatures = null },
  { contexts = null, samplePath = "/input/samples.tsv", signaturePath = "/input/signatures.tsv" } = {}
) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const normalizedSignatures = signatures ? normalizeMatrixObject(signatures) : null;
  const contextOrder = normalizeContextOrder({
    spectra: normalizedSpectra,
    signatures: normalizedSignatures,
    contexts,
  });
  const files = [
    {
      path: samplePath,
      text: exportSigProfilerMatrix(normalizedSpectra, { contexts: contextOrder }),
    },
  ];

  if (normalizedSignatures) {
    files.push({
      path: signaturePath,
      text: exportCOSMICSignatureMatrix(normalizedSignatures, {
        contexts: contextOrder,
      }),
    });
  }

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigprofilerassignment",
    mode: "matrix",
    files,
    manifest: {
      samplePath,
      signaturePath: normalizedSignatures ? signaturePath : null,
      spectraOrientation: "mutation_type_by_sample",
      signatureOrientation: normalizedSignatures
        ? "mutation_type_by_signature"
        : null,
      sampleCount: Object.keys(normalizedSpectra).length,
      signatureCount: normalizedSignatures
        ? Object.keys(normalizedSignatures).length
        : null,
      contextCount: contextOrder.length,
      contexts: contextOrder,
    },
  };
}

function createSigProfilerAssignmentPython() {
  return `
import json
config = json.loads(MSIG_INPUT_JSON)
from SigProfilerAssignment import Analyzer as Analyze

kwargs = {
    "samples": config["samplePath"],
    "output": config["outputDirectory"],
    "input_type": "matrix",
    "context_type": config.get("contextType", "96"),
    "collapse_to_SBS96": config.get("collapseToSBS96", True),
    "cosmic_version": config.get("cosmicVersion", 3.5),
    "exome": config.get("exome", False),
    "genome_build": config.get("genomeBuild", "GRCh37"),
    "signature_database": config.get("signaturePath"),
    "exclude_signature_subgroups": config.get("excludeSignatureSubgroups"),
    "export_probabilities": config.get("exportProbabilities", False),
    "export_probabilities_per_mutation": False,
    "make_plots": False,
    "sample_reconstruction_plots": "none",
    "verbose": config.get("verbose", False),
    "cpu": config.get("cpu", 1),
}
kwargs = {key: value for key, value in kwargs.items() if value is not None}
Analyze.cosmic_fit(**kwargs)
json.dumps({
    "status": "completed",
    "tool": "SigProfilerAssignment",
    "outputDirectory": config["outputDirectory"],
    "parameters": kwargs,
})
`;
}

function createSigProfilerExtractorPythonSnippet({
  inputType = "matrix",
  outputDirectory = "sigprofiler_extractor_output",
  inputPath = "samples.tsv",
  referenceGenome = "GRCh37",
  minimumSignatures = 1,
  maximumSignatures = 5,
  nmfReplicates = 100,
  cpu = 1,
} = {}) {
  return [
    "from SigProfilerExtractor import sigpro as sig",
    "",
    "sig.sigProfilerExtractor(",
    `    input_type=${JSON.stringify(inputType)},`,
    `    output=${JSON.stringify(outputDirectory)},`,
    `    input_data=${JSON.stringify(inputPath)},`,
    `    reference_genome=${JSON.stringify(referenceGenome)},`,
    `    minimum_signatures=${Number(minimumSignatures)},`,
    `    maximum_signatures=${Number(maximumSignatures)},`,
    `    nmf_replicates=${Number(nmfReplicates)},`,
    `    cpu=${Number(cpu)}`,
    ")",
    "",
  ].join("\n");
}

/**
 * Prepares matrix-mode input files for SigProfilerExtractor handoff.
 *
 * @function prepareSigProfilerExtractorInput
 * @memberof adapters
 * @param {Object} input - Input spectra.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra.
 * @param {Object} [options] - Export and handoff options.
 * @returns {Object} Virtual files, manifest metadata, and a Python command snippet.
 */
function prepareSigProfilerExtractorInput(
  { spectra },
  {
    contexts = null,
    samplePath = "/input/sigprofiler_extractor_samples.tsv",
    outputDirectory = "/output/sigprofiler_extractor",
    referenceGenome = "GRCh37",
    minimumSignatures = 1,
    maximumSignatures = 5,
    nmfReplicates = 100,
    cpu = 1,
  } = {}
) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const contextOrder = normalizeContextOrder({ spectra: normalizedSpectra, contexts });
  const pythonSnippet = createSigProfilerExtractorPythonSnippet({
    inputPath: samplePath,
    outputDirectory,
    referenceGenome,
    minimumSignatures,
    maximumSignatures,
    nmfReplicates,
    cpu,
  });

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigprofilerextractor",
    mode: "matrix_handoff",
    files: [
      {
        path: samplePath,
        text: exportSigProfilerMatrix(normalizedSpectra, { contexts: contextOrder }),
      },
    ],
    manifest: {
      samplePath,
      outputDirectory,
      inputType: "matrix",
      spectraOrientation: "mutation_type_by_sample",
      sampleCount: Object.keys(normalizedSpectra).length,
      contextCount: contextOrder.length,
      contexts: contextOrder,
      referenceGenome,
      minimumSignatures,
      maximumSignatures,
      nmfReplicates,
      cpu,
    },
    pythonSnippet,
  };
}

function createSigProfilerExtractorPython() {
  return `
import json
config = json.loads(MSIG_INPUT_JSON)
from SigProfilerExtractor import sigpro as sig

kwargs = {
    "input_type": config.get("inputType", "matrix"),
    "output": config["outputDirectory"],
    "input_data": config["samplePath"],
    "reference_genome": config.get("referenceGenome", "GRCh37"),
    "minimum_signatures": config.get("minimumSignatures", 1),
    "maximum_signatures": config.get("maximumSignatures", 5),
    "nmf_replicates": config.get("nmfReplicates", 100),
    "cpu": config.get("cpu", 1),
}
kwargs = {key: value for key, value in kwargs.items() if value is not None}
sig.sigProfilerExtractor(**kwargs)
json.dumps({
    "status": "completed",
    "tool": "SigProfilerExtractor",
    "outputDirectory": config["outputDirectory"],
    "parameters": kwargs,
})
`;
}

function parseSigProfilerExtractorOutput(files, { delimiter = "\t", normalize = true } = {}) {
  let signatures = null;
  let exposures = null;
  const candidateSignatureTables = [];
  const candidateExposureTables = [];

  for (const file of files || []) {
    if (!file?.text) {
      continue;
    }
    const path = file.path || "";
    if (/Signatures/i.test(path) && !/Activities/i.test(path)) {
      try {
        const parsedSignatures = importCOSMICSignatureMatrix(file.text, { delimiter });
        if (Object.keys(parsedSignatures).length > 0) {
          candidateSignatureTables.push({
            path,
            signatures: parsedSignatures,
            signatureCount: Object.keys(parsedSignatures).length,
          });
        }
      } catch (_error) {
        // Non-signature tables are ignored.
      }
    }
  }

  const parsedExposureTables = parseExposureTables(files, { delimiter, normalize });
  if (candidateSignatureTables.length > 0) {
    candidateSignatureTables.sort(
      (left, right) => right.signatureCount - left.signatureCount
    );
    signatures = candidateSignatureTables[0].signatures;
  }
  if (parsedExposureTables.exposures) {
    exposures = parsedExposureTables.exposures;
    candidateExposureTables.push(...parsedExposureTables.candidateTables);
  }

  return {
    signatures,
    exposures,
    candidateSignatureTables: candidateSignatureTables.map(
      ({ path, signatureCount }) => ({ path, signatureCount })
    ),
    candidateExposureTables,
  };
}

function integerInRange(value, fallback, min, max) {
  const numeric = Math.floor(Number(value));
  const resolved = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(min, Math.min(max, resolved));
}

function buildSigProfilerExtractorRankGrid({
  minimumSignatures = 1,
  maximumSignatures = 5,
  sampleCount = 1,
  contextCount = 1,
} = {}) {
  const upperBound = Math.max(1, Math.min(
    integerInRange(maximumSignatures, 5, 1, 20),
    Math.max(1, sampleCount || 1),
    Math.max(1, contextCount || 1)
  ));
  const lowerBound = Math.min(
    upperBound,
    integerInRange(minimumSignatures, 1, 1, upperBound)
  );
  return Array.from(
    { length: upperBound - lowerBound + 1 },
    (_, index) => lowerBound + index
  );
}

function summarizeSigProfilerExtractorRankSelection(rankSelection) {
  if (!rankSelection) {
    return null;
  }
  return {
    ranks: rankSelection.ranks,
    recommendedRank: rankSelection.recommendedRank,
    rankSelectionCriterion: rankSelection.rankSelectionCriterion,
    criterionDirection: rankSelection.criterionDirection,
    criterionValue: rankSelection.criterionValue,
    runs: (rankSelection.runs || []).map((run) => ({
      rank: run.rank,
      reconstructionError: run.reconstructionError,
      averageSampleCosineSimilarity: run.averageSampleCosineSimilarity,
      copheneticCorrelation: run.copheneticCorrelation,
      averageSilhouette: run.averageSilhouette,
      criterionValue: run.criterionValue,
      converged: run.converged,
      iterations: run.iterations,
    })),
  };
}

function sigProfilerExtractorPackageSpec(packages = []) {
  return normalizeArray(packages).find((packageName) =>
    /(^|[/@])SigProfilerExtractor([=@<>\s]|$)/i.test(String(packageName || ""))
  );
}

function createSigProfilerExtractorPyodideError({ prepared, packageSpec } = {}) {
  const error = new Error(
    "SigProfilerExtractor cannot currently be installed in browser Python because its package dependency chain includes torch, which Pyodide cannot install. Use the browser extraction run or export the SigProfilerExtractor handoff files for a local or server Python run."
  );
  error.name = "SigProfilerExtractorPyodideDependencyError";
  error.code = "PYODIDE_UNSUPPORTED_DEPENDENCY";
  error.packageSpec = packageSpec || DEFAULT_SPE_PACKAGE;
  error.missingDependency = "torch>=1.8.1";
  error.preparedInput = prepared?.manifest || null;
  return error;
}

async function runSigProfilerExtractorBrowserNmf(
  { spectra },
  {
    contexts = null,
    outputDirectory = "/output/sigprofiler_extractor",
    referenceGenome = "GRCh37",
    minimumSignatures = 1,
    maximumSignatures = 5,
    nmfReplicates = 100,
    cpu = 1,
    maxBrowserRuns = 8,
    maxIterations = 700,
    tolerance = 1e-5,
    seed = 123,
    signaturePrefix = "SPE_NMF",
    rankSelectionCriterion = "reconstruction_error",
  } = {}
) {
  const prepared = prepareSigProfilerExtractorInput(
    { spectra },
    {
      contexts,
      outputDirectory,
      referenceGenome,
      minimumSignatures,
      maximumSignatures,
      nmfReplicates,
      cpu,
    }
  );
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const ranks = buildSigProfilerExtractorRankGrid({
    minimumSignatures,
    maximumSignatures,
    sampleCount: Object.keys(normalizedSpectra).length,
    contextCount: prepared.manifest.contextCount,
  });
  const nRuns = integerInRange(nmfReplicates, 8, 1, Math.max(1, maxBrowserRuns));
  let extraction;
  let rankSelection = null;

  if (ranks.length > 1) {
    rankSelection = selectNMFRank(normalizedSpectra, {
      ranks,
      maxIterations,
      tolerance,
      nRuns,
      seed,
      rankSelectionCriterion,
      contexts: prepared.manifest.contexts,
    });
    extraction =
      rankSelection.runs.find((run) => run.rank === rankSelection.recommendedRank)
        ?.result || rankSelection.runs[0]?.result;
  } else {
    extraction = await extractSignaturesNMFInWorker(normalizedSpectra, {
      rank: ranks[0] || 1,
      maxIterations,
      tolerance,
      nRuns,
      seed,
      contexts: prepared.manifest.contexts,
      signaturePrefix,
    });
  }

  if (!extraction) {
    throw new Error("Browser extraction did not return signatures and contributions.");
  }

  if (rankSelection && extraction.signatures) {
    extraction.signatures = Object.fromEntries(
      Object.entries(extraction.signatures).map(([signature, profile], index) => [
        `${signaturePrefix}${index + 1}`,
        profile,
      ])
    );
    extraction.exposures = Object.fromEntries(
      Object.entries(extraction.exposures || {}).map(([sample, row]) => [
        sample,
        Object.fromEntries(Object.values(row || {}).map((value, index) => [
          `${signaturePrefix}${index + 1}`,
          value,
        ])),
      ])
    );
  }

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigprofilerextractor",
    runtime: "browser_nmf",
    status: "completed",
    signatures: extraction.signatures,
    exposures: extraction.exposures,
    candidateSignatureTables: [
      {
        path: "browser_nmf_signatures",
        signatureCount: Object.keys(extraction.signatures || {}).length,
      },
    ],
    candidateExposureTables: [
      {
        path: "browser_nmf_exposures",
        score: null,
        orientation: "sample_by_signature",
      },
    ],
    preparedInput: prepared.manifest,
    extraction: {
      rank: extraction.rank,
      reconstructionError: extraction.reconstructionError,
      averageSampleCosineSimilarity: extraction.averageSampleCosineSimilarity,
      iterations: extraction.iterations,
      converged: extraction.converged,
      bestRun: extraction.bestRun,
      rankSelection: summarizeSigProfilerExtractorRankSelection(rankSelection),
    },
    provenance: buildAdapterProvenance({
      tool: "SigProfilerExtractor-compatible extraction",
      runtime: "browser_nmf",
      parameters: {
        ...prepared.manifest,
        rankGrid: ranks,
        selectedRank: extraction.rank,
        nRuns,
        maxIterations,
        tolerance,
        seed,
        rankSelectionCriterion,
      },
      notes:
        "Browser-native NMF run using the same matrix prepared for SigProfilerExtractor. The handoff files and Python snippet remain available for local or server SigProfilerExtractor execution.",
    }),
  };
}

function createSigProfilerMatrixGeneratorPythonSnippet({
  project = "msig_matrix_generator",
  referenceGenome = "GRCh37",
  inputDirectory = "/input/sigprofiler_matrix_generator",
  plot = false,
  exome = false,
  bedFile = null,
  chromBased = false,
  tsbStat = false,
  seqInfo = false,
  cushion = 100,
  volume = null,
} = {}) {
  const call = buildPythonCall(
    "matGen.SigProfilerMatrixGeneratorFunc",
    [project, referenceGenome, inputDirectory],
    {
      plot,
      exome,
      bed_file: bedFile,
      chrom_based: chromBased,
      tsb_stat: tsbStat,
      seqInfo,
      cushion,
      volume,
    }
  );
  return [
    "import json",
    "from SigProfilerMatrixGenerator.scripts import SigProfilerMatrixGeneratorFunc as matGen",
    "",
    `matrices = ${call}`,
    "json.dumps({",
    "    \"status\": \"completed\",",
    "    \"tool\": \"SigProfilerMatrixGenerator\",",
    `    \"project\": ${JSON.stringify(project)},`,
    `    \"referenceGenome\": ${JSON.stringify(referenceGenome)},`,
    `    \"inputDirectory\": ${JSON.stringify(inputDirectory)},`,
    "    \"matrixKeys\": list(matrices.keys()) if hasattr(matrices, \"keys\") else []",
    "})",
    "",
  ].join("\n");
}

/**
 * Prepares variant files and a Python snippet for SigProfilerMatrixGenerator.
 *
 * @function prepareSigProfilerMatrixGeneratorInput
 * @memberof adapters
 * @param {Object} input - Input variant files.
 * @param {Object[]} [input.files=[]] - Virtual VCF/MAF/CNV/SV files.
 * @param {Object} [options] - MatrixGenerator options.
 * @returns {Object} Virtual files, manifest metadata, and a Python command snippet.
 */
function prepareSigProfilerMatrixGeneratorInput(
  { files = [] } = {},
  {
    project = "msig_matrix_generator",
    referenceGenome = "GRCh37",
    inputDirectory = "/input/sigprofiler_matrix_generator",
    plot = false,
    exome = false,
    bedFile = null,
    chromBased = false,
    tsbStat = false,
    seqInfo = false,
    cushion = 100,
    volume = null,
  } = {}
) {
  const normalizedFiles = normalizeVirtualFiles(files, inputDirectory);
  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigprofilermatrixgenerator",
    mode: "python_handoff",
    files: normalizedFiles,
    manifest: {
      project,
      referenceGenome,
      inputDirectory,
      fileCount: normalizedFiles.length,
      plot,
      exome,
      bedFile,
      chromBased,
      tsbStat,
      seqInfo,
      cushion,
      volume,
    },
    pythonSnippet: createSigProfilerMatrixGeneratorPythonSnippet({
      project,
      referenceGenome,
      inputDirectory,
      plot,
      exome,
      bedFile,
      chromBased,
      tsbStat,
      seqInfo,
      cushion,
      volume,
    }),
  };
}

function parseSigProfilerMatrixGeneratorOutput(
  files,
  { delimiter = "\t" } = {}
) {
  const matrices = {};
  const candidateMatrices = [];
  for (const file of files || []) {
    if (!file?.text) {
      continue;
    }
    const rows = parseDelimited(file.text, delimiter);
    const firstHeader = String(rows?.[0]?.[0] || "").toLowerCase();
    if (!/(mutationtype|mutation_type|context|channel)/.test(firstHeader)) {
      continue;
    }
    try {
      const matrix = importSigProfilerMatrix(file.text, { delimiter });
      const key =
        String(file.path || "matrix")
          .split("/")
          .pop()
          ?.replace(/\.(all|tsv|txt|csv)$/i, "") || "matrix";
      matrices[key] = matrix;
      candidateMatrices.push({
        path: file.path || "",
        key,
        sampleCount: Object.keys(matrix).length,
      });
    } catch (_error) {
      // Non-matrix text files are ignored.
    }
  }
  return {
    matrices,
    candidateMatrices,
  };
}

function createSigProfilerSimulatorPythonSnippet({
  project = "msig_simulator",
  projectPath = "/input/sigprofiler_simulator",
  genome = "GRCh37",
  contexts = ["96"],
  simulations = 100,
  chromBased = true,
  exome = false,
  bedFile = null,
} = {}) {
  const call = buildPythonCall(
    "sigSim.SigProfilerSimulator",
    [project, projectPath, genome],
    {
      contexts,
      simulations,
      chrom_based: chromBased,
      exome,
      bed_file: bedFile,
    }
  );
  return [
    "import json",
    "from SigProfilerSimulator import SigProfilerSimulator as sigSim",
    "",
    `${call}`,
    "json.dumps({",
    "    \"status\": \"completed\",",
    "    \"tool\": \"SigProfilerSimulator\",",
    `    \"project\": ${JSON.stringify(project)},`,
    `    \"projectPath\": ${JSON.stringify(projectPath)},`,
    `    \"genome\": ${JSON.stringify(genome)}`,
    "})",
    "",
  ].join("\n");
}

/**
 * Prepares input files and a Python snippet for SigProfilerSimulator.
 *
 * @function prepareSigProfilerSimulatorInput
 * @memberof adapters
 * @param {Object} input - Input variant files.
 * @param {Object[]} [input.files=[]] - Virtual input files placed under projectPath/input.
 * @param {Object} [options] - Simulator options.
 * @returns {Object} Virtual files, manifest metadata, and a Python command snippet.
 */
function prepareSigProfilerSimulatorInput(
  { files = [] } = {},
  {
    project = "msig_simulator",
    projectPath = "/input/sigprofiler_simulator",
    inputDirectory = null,
    genome = "GRCh37",
    contexts = ["96"],
    simulations = 100,
    chromBased = true,
    exome = false,
    bedFile = null,
  } = {}
) {
  const resolvedInputDirectory =
    inputDirectory || `${String(projectPath).replace(/\/+$/, "")}/input`;
  const normalizedFiles = normalizeVirtualFiles(files, resolvedInputDirectory);
  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigprofilersimulator",
    mode: "python_handoff",
    files: normalizedFiles,
    manifest: {
      project,
      projectPath,
      inputDirectory: resolvedInputDirectory,
      genome,
      contexts: normalizeArray(contexts),
      simulations,
      chromBased,
      exome,
      bedFile,
      fileCount: normalizedFiles.length,
    },
    pythonSnippet: createSigProfilerSimulatorPythonSnippet({
      project,
      projectPath,
      genome,
      contexts: normalizeArray(contexts),
      simulations,
      chromBased,
      exome,
      bedFile,
    }),
  };
}

function createSigProfilerClustersPythonSnippet({
  project = "msig_clusters",
  genome = "GRCh37",
  contexts = ["96"],
  simContext = ["96"],
  inputPath = "/input/sigprofiler_clusters",
  analysis = "all",
  sortSims = true,
  interdistance = "ID",
  calculateIMD = true,
  maxCpu = 1,
  subClassify = false,
  plotIMDfigure = true,
} = {}) {
  const call = buildPythonCall(
    "hp.analysis",
    [project, genome, contexts, simContext, inputPath],
    {
      analysis,
      sortSims,
      interdistance,
      calculateIMD,
      max_cpu: maxCpu,
      subClassify,
      plotIMDfigure,
    }
  );
  return [
    "import json",
    "from SigProfilerClusters import SigProfilerClusters as hp",
    "",
    `${call}`,
    "json.dumps({",
    "    \"status\": \"completed\",",
    "    \"tool\": \"SigProfilerClusters\",",
    `    \"project\": ${JSON.stringify(project)},`,
    `    \"genome\": ${JSON.stringify(genome)},`,
    `    \"inputPath\": ${JSON.stringify(inputPath)}`,
    "})",
    "",
  ].join("\n");
}

/**
 * Prepares input files and a Python snippet for SigProfilerClusters.
 *
 * @function prepareSigProfilerClustersInput
 * @memberof adapters
 * @param {Object} input - Input variant files.
 * @param {Object[]} [input.files=[]] - Virtual VCF files.
 * @param {Object} [options] - Clustering options.
 * @returns {Object} Virtual files, manifest metadata, and a Python command snippet.
 */
function prepareSigProfilerClustersInput(
  { files = [] } = {},
  {
    project = "msig_clusters",
    genome = "GRCh37",
    contexts = ["96"],
    simContext = ["96"],
    inputPath = "/input/sigprofiler_clusters",
    analysis = "all",
    sortSims = true,
    interdistance = "ID",
    calculateIMD = true,
    maxCpu = 1,
    subClassify = false,
    plotIMDfigure = true,
  } = {}
) {
  const normalizedFiles = normalizeVirtualFiles(files, inputPath);
  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigprofilerclusters",
    mode: "python_handoff",
    files: normalizedFiles,
    manifest: {
      project,
      genome,
      contexts: normalizeArray(contexts),
      simContext: normalizeArray(simContext),
      inputPath,
      analysis,
      sortSims,
      interdistance,
      calculateIMD,
      maxCpu,
      subClassify,
      plotIMDfigure,
      fileCount: normalizedFiles.length,
    },
    pythonSnippet: createSigProfilerClustersPythonSnippet({
      project,
      genome,
      contexts: normalizeArray(contexts),
      simContext: normalizeArray(simContext),
      inputPath,
      analysis,
      sortSims,
      interdistance,
      calculateIMD,
      maxCpu,
      subClassify,
      plotIMDfigure,
    }),
  };
}

function createSigProfilerPlottingPythonSnippet({
  matrixPath = "/input/sigprofiler_plotting_matrix.tsv",
  outputDirectory = "/output/sigprofiler_plotting",
  project = "msig_plot",
  matrixType = "SBS",
  plotType = "96",
  percentage = false,
  aggregate = false,
} = {}) {
  return [
    "import json",
    "import sigProfilerPlotting as sigPlt",
    "",
    `matrix_type = ${JSON.stringify(String(matrixType).toUpperCase())}`,
    `matrix_path = ${JSON.stringify(matrixPath)}`,
    `output_directory = ${JSON.stringify(outputDirectory)}`,
    `project = ${JSON.stringify(project)}`,
    `plot_type = ${JSON.stringify(plotType)}`,
    `percentage = ${pythonLiteral(percentage)}`,
    `aggregate = ${pythonLiteral(aggregate)}`,
    "if matrix_type == \"SBS\":",
    "    sigPlt.plotSBS(matrix_path, output_directory, project, plot_type, percentage=percentage)",
    "elif matrix_type == \"DBS\":",
    "    sigPlt.plotDBS(matrix_path, output_directory, project, plot_type, percentage=percentage)",
    "elif matrix_type == \"ID\":",
    "    sigPlt.plotID(matrix_path, output_directory, project, plot_type, percentage=percentage)",
    "elif matrix_type == \"CNV\":",
    "    sigPlt.plotCNV(matrix_path, output_directory, project, percentage=percentage, aggregate=aggregate)",
    "elif matrix_type == \"SV\":",
    "    sigPlt.plotSV(matrix_path, output_directory, project, percentage=percentage)",
    "else:",
    "    raise ValueError(f\"Unsupported sigProfilerPlotting matrix type: {matrix_type}\")",
    "json.dumps({",
    "    \"status\": \"completed\",",
    "    \"tool\": \"sigProfilerPlotting\",",
    "    \"matrixType\": matrix_type,",
    "    \"outputDirectory\": output_directory,",
    "})",
    "",
  ].join("\n");
}

/**
 * Prepares a matrix and Python snippet for sigProfilerPlotting.
 *
 * @function prepareSigProfilerPlottingInput
 * @memberof adapters
 * @param {Object} input - Matrix input.
 * @param {Object<string,Object<string,number>>} [input.spectra=null] - Optional spectra to serialize as a SigProfiler matrix.
 * @param {string} [input.matrixText=null] - Optional pre-rendered matrix text.
 * @param {Object[]} [input.files=[]] - Optional virtual files.
 * @param {Object} [options] - Plotting options.
 * @returns {Object} Virtual files, manifest metadata, and a Python command snippet.
 */
function prepareSigProfilerPlottingInput(
  { spectra = null, matrixText = null, files = [] } = {},
  {
    contexts = null,
    matrixPath = "/input/sigprofiler_plotting_matrix.tsv",
    outputDirectory = "/output/sigprofiler_plotting",
    project = "msig_plot",
    matrixType = "SBS",
    plotType = "96",
    percentage = false,
    aggregate = false,
  } = {}
) {
  const virtualFiles = [...normalizeVirtualFiles(files, "/input")];
  let resolvedMatrixPath = matrixPath;
  if (matrixText !== null && matrixText !== undefined) {
    virtualFiles.push({ path: matrixPath, text: String(matrixText) });
  } else if (spectra) {
    const normalizedSpectra = normalizeMatrixObject(spectra);
    const contextOrder = normalizeContextOrder({
      spectra: normalizedSpectra,
      contexts,
    });
    virtualFiles.push({
      path: matrixPath,
      text: exportSigProfilerMatrix(normalizedSpectra, { contexts: contextOrder }),
    });
  } else if (virtualFiles.length > 0) {
    resolvedMatrixPath = virtualFiles[0].path;
  }

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigprofilerplotting",
    mode: "python_handoff",
    files: virtualFiles,
    manifest: {
      matrixPath: resolvedMatrixPath,
      outputDirectory,
      project,
      matrixType: String(matrixType).toUpperCase(),
      plotType,
      percentage,
      aggregate,
      fileCount: virtualFiles.length,
    },
    pythonSnippet: createSigProfilerPlottingPythonSnippet({
      matrixPath: resolvedMatrixPath,
      outputDirectory,
      project,
      matrixType,
      plotType,
      percentage,
      aggregate,
    }),
  };
}

function createDeconstructSigsRScript({
  spectraPath = "deconstructsigs_spectra.tsv",
  signaturePath = "deconstructsigs_signatures.tsv",
  outputPath = "deconstructsigs_exposures.tsv",
  signatureCutoff = 0.01,
  sourceArchiveUrl = null,
  sourceFilePaths = null,
} = {}) {
  const normalizedSourceFilePaths = normalizeArray(sourceFilePaths).filter(Boolean);
  const loader = normalizedSourceFilePaths.length
    ? normalizedSourceFilePaths.map(
        (sourceFilePath) => `source(${JSON.stringify(sourceFilePath)}, local = globalenv())`
      )
    : sourceArchiveUrl
    ? [
        `.deconstructSigs_archive <- ${JSON.stringify(sourceArchiveUrl)}`,
        `.deconstructSigs_tar <- tempfile(fileext = ".tar.gz")`,
        `utils::download.file(.deconstructSigs_archive, .deconstructSigs_tar, mode = "wb", quiet = TRUE)`,
        `.deconstructSigs_needed <- c("deconstructSigs/R/golden_section_search.R", "deconstructSigs/R/internal.scripts.R", "deconstructSigs/R/normalize.data.R", "deconstructSigs/R/whichSignatures.R")`,
        `.deconstructSigs_files <- utils::untar(.deconstructSigs_tar, list = TRUE)`,
        `.deconstructSigs_missing <- setdiff(.deconstructSigs_needed, .deconstructSigs_files)`,
        `if (length(.deconstructSigs_missing)) stop(paste("Archived deconstructSigs source is missing", paste(.deconstructSigs_missing, collapse = ", ")))`,
        `utils::untar(.deconstructSigs_tar, files = .deconstructSigs_needed, exdir = tempdir())`,
        `for (.deconstructSigs_file in .deconstructSigs_needed) source(file.path(tempdir(), .deconstructSigs_file), local = globalenv())`,
      ]
    : ["library(deconstructSigs)"];
  return [
    ...loader,
    "",
    `spectra <- read.delim(${JSON.stringify(spectraPath)}, check.names = FALSE, row.names = 1)`,
    `signatures <- read.delim(${JSON.stringify(signaturePath)}, check.names = FALSE, row.names = 1)`,
    "spectra <- t(as.matrix(spectra))",
    "signatures <- t(as.matrix(signatures))",
    "common.contexts <- intersect(colnames(spectra), colnames(signatures))",
    "spectra <- spectra[, common.contexts, drop = FALSE]",
    "signatures <- signatures[, common.contexts, drop = FALSE]",
    "spectra <- spectra / rowSums(spectra)",
    "signatures <- signatures / rowSums(signatures)",
    "signature.names <- rownames(signatures)",
    "results <- lapply(rownames(spectra), function(sample_name) {",
    "  fit <- whichSignatures(",
    "    tumor.ref = as.data.frame(spectra),",
    "    signatures.ref = as.data.frame(signatures),",
    "    sample.id = sample_name,",
    `    signature.cutoff = ${Number(signatureCutoff)},`,
    "    contexts.needed = FALSE",
    "  )",
    "  weights <- as.numeric(fit$weights)",
    "  names(weights) <- names(fit$weights)",
    "  exposure <- setNames(rep(0, length(signature.names)), signature.names)",
    "  matching <- intersect(names(weights), signature.names)",
    "  exposure[matching] <- weights[matching]",
    "  total <- sum(exposure)",
    "  if (is.finite(total) && total > 0) exposure <- exposure / total",
    "  data.frame(sample = sample_name, t(exposure), check.names = FALSE)",
    "})",
    "exposures <- do.call(rbind, results)",
    "dir.create(dirname(" + JSON.stringify(outputPath) + "), recursive = TRUE, showWarnings = FALSE)",
    `write.table(exposures, file = ${JSON.stringify(outputPath)}, sep = "\\t", quote = FALSE, row.names = FALSE)`,
    "",
  ].join("\n");
}

/**
 * Prepares input files and an R snippet for deconstructSigs handoff.
 *
 * @function prepareDeconstructSigsInput
 * @memberof adapters
 * @param {Object} input - Spectra and signature catalog.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra.
 * @param {Object<string,Object<string,number>>} input.signatures - Signature catalog.
 * @param {Object} [options] - Export and R script options.
 * @returns {Object} Virtual files, manifest metadata, and an R command snippet.
 */
function prepareDeconstructSigsInput(
  { spectra, signatures },
  {
    contexts = null,
    spectraPath = "/input/deconstructsigs_spectra.tsv",
    signaturePath = "/input/deconstructsigs_signatures.tsv",
    outputPath = "/output/deconstructsigs_exposures.tsv",
    signatureCutoff = 0.01,
  } = {}
) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const contextOrder = normalizeContextOrder({
    spectra: normalizedSpectra,
    signatures: normalizedSignatures,
    contexts,
  });

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "deconstructsigs",
    mode: "r_handoff",
    files: [
      {
        path: spectraPath,
        text: exportSigProfilerMatrix(normalizedSpectra, { contexts: contextOrder }),
      },
      {
        path: signaturePath,
        text: exportCOSMICSignatureMatrix(normalizedSignatures, {
          contexts: contextOrder,
        }),
      },
    ],
    manifest: {
      spectraPath,
      signaturePath,
      outputPath,
      spectraOrientation: "mutation_type_by_sample",
      signatureOrientation: "mutation_type_by_signature",
      sampleCount: Object.keys(normalizedSpectra).length,
      signatureCount: Object.keys(normalizedSignatures).length,
      contextCount: contextOrder.length,
      contexts: contextOrder,
      signatureCutoff,
    },
    rSnippet: createDeconstructSigsRScript({
      spectraPath,
      signaturePath,
      outputPath,
      signatureCutoff,
    }),
  };
}

function parseDeconstructSigsOutput(
  text,
  { delimiter = "\t", normalize = true } = {}
) {
  return importMuSiCalOutput(text, {
    delimiter,
    orientation: "sample_by_signature",
    normalize,
  });
}

function rBoolean(value) {
  return value ? "TRUE" : "FALSE";
}

function createSigminerRScript({
  spectraPath = "sigminer_spectra.tsv",
  signaturePath = "sigminer_signatures.tsv",
  outputPath = "sigminer_exposures.tsv",
  method = "QP",
  autoReduce = false,
  exposureType = "relative",
  relThreshold = 0,
  mode = "SBS",
} = {}) {
  return [
    "if (!requireNamespace(\"sigminer\", quietly = TRUE)) {",
    "  stop(\"The sigminer R package is required for this handoff workflow.\")",
    "}",
    "method <- toupper(" + JSON.stringify(method) + ")",
    "solver_package <- switch(method, QP = \"quadprog\", NNLS = \"nnls\", SA = \"GenSA\", NA)",
    "if (!is.na(solver_package) && !requireNamespace(solver_package, quietly = TRUE)) {",
    "  stop(paste(\"sigminer method\", method, \"requires the\", solver_package, \"R package.\"))",
    "}",
    "",
    `spectra <- read.delim(${JSON.stringify(spectraPath)}, check.names = FALSE, row.names = 1)`,
    `signatures <- read.delim(${JSON.stringify(signaturePath)}, check.names = FALSE, row.names = 1)`,
    "catalogue.matrix <- as.matrix(spectra)",
    "signature.matrix <- as.matrix(signatures)",
    "storage.mode(catalogue.matrix) <- \"numeric\"",
    "storage.mode(signature.matrix) <- \"numeric\"",
    "common.contexts <- intersect(rownames(catalogue.matrix), rownames(signature.matrix))",
    "if (length(common.contexts) == 0) {",
    "  stop(\"sigminer handoff found no shared mutation contexts between spectra and signatures.\")",
    "}",
    "catalogue.matrix <- catalogue.matrix[common.contexts, , drop = FALSE]",
    "signature.matrix <- signature.matrix[common.contexts, , drop = FALSE]",
    "signature.names <- colnames(signature.matrix)",
    "sample.names <- colnames(catalogue.matrix)",
    "",
    "fit <- sigminer::sig_fit(",
    "  catalogue_matrix = catalogue.matrix,",
    "  sig = signature.matrix,",
    "  method = method,",
    `  auto_reduce = ${rBoolean(autoReduce)},`,
    `  type = ${JSON.stringify(exposureType)},`,
    "  return_class = \"matrix\",",
    `  rel_threshold = ${Number(relThreshold)},`,
    `  mode = ${JSON.stringify(mode)},`,
    "  show_index = FALSE",
    ")",
    "",
    "exposure.matrix <- as.matrix(fit)",
    "storage.mode(exposure.matrix) <- \"numeric\"",
    "if (all(signature.names %in% rownames(exposure.matrix))) {",
    "  output.matrix <- t(exposure.matrix[signature.names, , drop = FALSE])",
    "} else if (all(signature.names %in% colnames(exposure.matrix))) {",
    "  output.matrix <- exposure.matrix[, signature.names, drop = FALSE]",
    "} else if (nrow(exposure.matrix) == length(signature.names)) {",
    "  rownames(exposure.matrix) <- signature.names",
    "  output.matrix <- t(exposure.matrix)",
    "} else if (ncol(exposure.matrix) == length(signature.names)) {",
    "  colnames(exposure.matrix) <- signature.names",
    "  output.matrix <- exposure.matrix",
    "} else {",
    "  stop(\"Could not infer sigminer exposure orientation.\")",
    "}",
    "if (nrow(output.matrix) == length(sample.names) && !all(sample.names %in% rownames(output.matrix))) {",
    "  rownames(output.matrix) <- sample.names",
    "}",
    "if (all(sample.names %in% rownames(output.matrix))) {",
    "  output.matrix <- output.matrix[sample.names, , drop = FALSE]",
    "}",
    "exposures <- data.frame(sample = rownames(output.matrix), output.matrix, check.names = FALSE)",
    `write.table(exposures, file = ${JSON.stringify(outputPath)}, sep = "\\t", quote = FALSE, row.names = FALSE)`,
    "",
  ].join("\n");
}

/**
 * Prepares input files and an R snippet for sigminer known-signature fitting.
 *
 * @function prepareSigminerInput
 * @memberof adapters
 * @param {Object} input - Spectra and signature catalog.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra.
 * @param {Object<string,Object<string,number>>} input.signatures - Signature catalog.
 * @param {Object} [options] - Export and sigminer fitting options.
 * @returns {Object} Virtual files, manifest metadata, and an R command snippet.
 */
function prepareSigminerInput(
  { spectra, signatures },
  {
    contexts = null,
    spectraPath = "/input/sigminer_spectra.tsv",
    signaturePath = "/input/sigminer_signatures.tsv",
    outputPath = "/output/sigminer_exposures.tsv",
    method = "QP",
    autoReduce = false,
    exposureType = "relative",
    relThreshold = 0,
    mode = "SBS",
  } = {}
) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const contextOrder = normalizeContextOrder({
    spectra: normalizedSpectra,
    signatures: normalizedSignatures,
    contexts,
  });

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigminer",
    mode: "r_handoff",
    files: [
      {
        path: spectraPath,
        text: exportSigProfilerMatrix(normalizedSpectra, { contexts: contextOrder }),
      },
      {
        path: signaturePath,
        text: exportCOSMICSignatureMatrix(normalizedSignatures, {
          contexts: contextOrder,
        }),
      },
    ],
    manifest: {
      spectraPath,
      signaturePath,
      outputPath,
      spectraOrientation: "mutation_type_by_sample",
      signatureOrientation: "mutation_type_by_signature",
      sampleCount: Object.keys(normalizedSpectra).length,
      signatureCount: Object.keys(normalizedSignatures).length,
      contextCount: contextOrder.length,
      contexts: contextOrder,
      method,
      autoReduce,
      exposureType,
      relThreshold,
      mode,
    },
    rSnippet: createSigminerRScript({
      spectraPath,
      signaturePath,
      outputPath,
      method,
      autoReduce,
      exposureType,
      relThreshold,
      mode,
    }),
  };
}

function parseSigminerOutput(
  text,
  { delimiter = "\t", normalize = true } = {}
) {
  return importMuSiCalOutput(text, {
    delimiter,
    orientation: "sample_by_signature",
    normalize,
  });
}

function uniquePackages(packages) {
  return [...new Set(normalizeArray(packages).filter(Boolean))];
}

function normalizeDeconstructSigsSourceFiles(sourceFiles = DEFAULT_DECONSTRUCTSIGS_SOURCE_FILES) {
  return normalizeArray(sourceFiles)
    .map((file) => {
      if (typeof file === "string") {
        return {
          path: `/input/deconstructSigs/R/${file.split("/").pop()}`,
          url: file,
        };
      }
      return {
        path: file?.path,
        url: file?.url,
        text: file?.text,
      };
    })
    .filter((file) => file.path && (file.url || file.text !== undefined));
}

async function fetchTextSourceFile(file) {
  if (file.text !== undefined) {
    return String(file.text);
  }
  if (typeof fetch !== "function") {
    throw new Error(
      "Cannot fetch the original deconstructSigs source files because fetch is unavailable in this runtime."
    );
  }
  const response = await fetch(file.url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(
      `Could not fetch original deconstructSigs source file ${file.url}: HTTP ${response.status}.`
    );
  }
  return await response.text();
}

async function prepareDeconstructSigsSourceFileInputs(sourceFiles) {
  const normalized = normalizeDeconstructSigsSourceFiles(sourceFiles);
  if (!normalized.length) {
    return [];
  }
  return await Promise.all(
    normalized.map(async (file) => ({
      path: file.path,
      text: await fetchTextSourceFile(file),
      sourceUrl: file.url || null,
    }))
  );
}

function sigminerSolverPackage(method = "NNLS") {
  const normalized = String(method || "NNLS").trim().toUpperCase();
  if (normalized === "QP") {
    return "quadprog";
  }
  if (normalized === "NNLS") {
    return "nnls";
  }
  if (normalized === "SA") {
    return "GenSA";
  }
  return null;
}

function extractCollectedTextFile(rawRun, path) {
  const normalizedPath = String(path || "").replace(/\\/g, "/");
  const file = (rawRun?.files || []).find(
    (candidate) => String(candidate.path || "").replace(/\\/g, "/") === normalizedPath
  );
  if (!file?.text) {
    throw new Error(`Expected webR output file was not collected: ${normalizedPath}`);
  }
  return file.text;
}

async function checkWebRAdapterAvailability(packages, options = {}) {
  const requested = uniquePackages(packages);
  const runtime = detectWebRRuntime();
  if (!runtime.available) {
    return {
      schemaVersion: ADAPTER_SCHEMA_VERSION,
      runtime: "webr",
      available: false,
      status: "runtime unavailable",
      packages: requested,
      missing: requested,
      runtimeStatus: runtime,
      packageAvailability: null,
    };
  }

  const packageAvailability = await checkWebRPackageAvailability(requested, options);
  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    runtime: "webr",
    available: packageAvailability.available,
    status: packageAvailability.available ? "available" : "missing package",
    packages: requested,
    missing: packageAvailability.missing || [],
    runtimeStatus: runtime,
    packageAvailability,
  };
}

function assertWebRAdapterAvailable(availability, packageLabel) {
  if (availability.available) {
    return;
  }
  const error =
    availability.status === "runtime unavailable"
      ? new Error(
          `webR is not available in this browser runtime. Missing: ${availability.runtimeStatus?.missing?.join(", ") || "runtime support"}.`
        )
      : new Error(
          `${packageLabel} is not available from the active webR package repository. Missing: ${availability.missing.join(", ")}.`
        );
  error.code =
    availability.status === "runtime unavailable"
      ? "WEBR_RUNTIME_UNAVAILABLE"
      : "WEBR_PACKAGE_UNAVAILABLE";
  error.availability = availability;
  throw error;
}

/**
 * Checks whether exact deconstructSigs execution can run through webR.
 *
 * @async
 * @function checkDeconstructSigsWebRAvailability
 * @memberof adapters
 * @param {Object} [options] - webR package repository options.
 * @returns {Promise<Object>} Availability status with runtime and package details.
 */
async function checkDeconstructSigsWebRAvailability(options = {}) {
  const { rPackages = DEFAULT_DECONSTRUCTSIGS_WEBR_PACKAGES, ...packageOptions } = options;
  return await checkWebRAdapterAvailability(rPackages, packageOptions);
}

/**
 * Checks whether exact sigminer execution can run through webR.
 *
 * @async
 * @function checkSigminerWebRAvailability
 * @memberof adapters
 * @param {Object} [options] - webR package repository and sigminer method options.
 * @returns {Promise<Object>} Availability status with runtime and package details.
 */
async function checkSigminerWebRAvailability(options = {}) {
  const {
    method = "NNLS",
    rPackages = DEFAULT_SIGMINER_WEBR_PACKAGES,
    ...packageOptions
  } = options;
  const solverPackage = sigminerSolverPackage(method);
  return await checkWebRAdapterAvailability(
    uniquePackages([...normalizeArray(rPackages), solverPackage]),
    packageOptions
  );
}

/**
 * Runs the deconstructSigs R package through webR when compatible package
 * builds are available.
 *
 * @async
 * @function runDeconstructSigsWebR
 * @memberof adapters
 * @param {Object} input - Spectra and signature catalog.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra.
 * @param {Object<string,Object<string,number>>} input.signatures - Signature catalog.
 * @param {Object} [options] - Handoff, webR, and package options.
 * @returns {Promise<Object>} Exact package result with parsed exposures.
 */
async function runDeconstructSigsWebR(
  { spectra, signatures },
  {
    contexts = null,
    signatureCutoff = 0.01,
    spectraPath = "/input/deconstructsigs_spectra.tsv",
    signaturePath = "/input/deconstructsigs_signatures.tsv",
    outputPath = "/output/deconstructsigs_exposures.tsv",
    rPackages = DEFAULT_DECONSTRUCTSIGS_WEBR_PACKAGES,
    webRModuleURL,
    repositoryUrl,
    binaryRVersion,
    packageIndexUrls,
    skipPackageCheck = false,
    useSourceArchiveOnMissingPackage = true,
    sourceArchiveUrl = DEFAULT_DECONSTRUCTSIGS_SOURCE_ARCHIVE_URL,
    sourceFiles = DEFAULT_DECONSTRUCTSIGS_SOURCE_FILES,
    timeoutMs = 300000,
    runnerOptions = {},
  } = {}
) {
  const prepared = prepareDeconstructSigsInput(
    { spectra, signatures },
    {
      contexts,
      spectraPath,
      signaturePath,
      outputPath,
      signatureCutoff,
    }
  );
  const packageOptions = { repositoryUrl, binaryRVersion, packageIndexUrls };
  const availability = skipPackageCheck
    ? null
    : await checkDeconstructSigsWebRAvailability({
        rPackages,
        ...packageOptions,
      });
  const sourceArchiveExecution =
    Boolean(
      availability &&
        !availability.available &&
        useSourceArchiveOnMissingPackage &&
        availability.status === "missing package" &&
        (availability.missing || []).includes("deconstructSigs")
    );
  if (availability && !sourceArchiveExecution) {
    assertWebRAdapterAvailable(availability, "deconstructSigs");
  }
  const sourceFileInputs = sourceArchiveExecution
    ? await prepareDeconstructSigsSourceFileInputs(sourceFiles)
    : [];
  const rSnippet = sourceArchiveExecution
    ? createDeconstructSigsRScript({
        spectraPath,
        signaturePath,
        outputPath,
        signatureCutoff,
        sourceArchiveUrl: sourceFileInputs.length ? null : sourceArchiveUrl,
        sourceFilePaths: sourceFileInputs.map((file) => file.path),
      })
    : prepared.rSnippet;

  const rawRun = await runWebR(
    {
      r: rSnippet,
      rPackages: sourceArchiveExecution ? [] : uniquePackages(rPackages),
      files: [...prepared.files, ...sourceFileInputs],
      outputFiles: [prepared.manifest.outputPath],
      timeoutMs,
      repositoryUrl,
    },
    {
      ...runnerOptions,
      webRModuleURL,
      repositoryUrl,
      timeoutMs,
    }
  );
  const exposures = parseDeconstructSigsOutput(
    extractCollectedTextFile(rawRun, prepared.manifest.outputPath)
  );

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "deconstructsigs",
    runtime: sourceArchiveExecution ? "webr_source_archive" : "webr",
    status: "completed",
    exactPackageExecution: true,
    sourceArchiveExecution,
    packageInstallMode: sourceArchiveExecution
      ? sourceFileInputs.length
        ? "cran_source_files"
        : "cran_source_archive"
      : "webr_binary_repository",
    sourceFiles: sourceFileInputs.map((file) => ({
      path: file.path,
      sourceUrl: file.sourceUrl || null,
    })),
    loadedOutput: sourceArchiveExecution
      ? "Computed by original deconstructSigs 1.8.0 R source in WebR for the active data"
      : "Computed by deconstructSigs in WebR for the active data",
    packageAvailability: availability,
    preparedInput: prepared.manifest,
    exposures,
    rawRun,
    provenance: buildAdapterProvenance({
      tool: "deconstructSigs",
      runtime: "webr",
      packageName: "deconstructSigs",
      packageVersion: sourceArchiveExecution ? DEFAULT_DECONSTRUCTSIGS_SOURCE_VERSION : null,
      parameters: prepared.manifest,
      notes: sourceArchiveExecution
        ? "Original deconstructSigs 1.8.0 R source loaded from the pinned CRAN mirror source files and executed in webR because the active WebR binary repository did not provide the archived package."
        : "Exact package execution through webR. Availability depends on compatible WebAssembly package builds in the active repository.",
    }),
  };
}

/**
 * Runs the sigminer R package through webR when compatible package builds are
 * available.
 *
 * @async
 * @function runSigminerWebR
 * @memberof adapters
 * @param {Object} input - Spectra and signature catalog.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra.
 * @param {Object<string,Object<string,number>>} input.signatures - Signature catalog.
 * @param {Object} [options] - Handoff, webR, package, and sigminer options.
 * @returns {Promise<Object>} Exact package result with parsed exposures.
 */
async function runSigminerWebR(
  { spectra, signatures },
  {
    contexts = null,
    spectraPath = "/input/sigminer_spectra.tsv",
    signaturePath = "/input/sigminer_signatures.tsv",
    outputPath = "/output/sigminer_exposures.tsv",
    method = "NNLS",
    autoReduce = false,
    exposureType = "relative",
    relThreshold = 0,
    mode = "SBS",
    rPackages = DEFAULT_SIGMINER_WEBR_PACKAGES,
    webRModuleURL,
    repositoryUrl,
    binaryRVersion,
    packageIndexUrls,
    skipPackageCheck = false,
    timeoutMs = 300000,
    runnerOptions = {},
  } = {}
) {
  const prepared = prepareSigminerInput(
    { spectra, signatures },
    {
      contexts,
      spectraPath,
      signaturePath,
      outputPath,
      method,
      autoReduce,
      exposureType,
      relThreshold,
      mode,
    }
  );
  const solverPackage = sigminerSolverPackage(method);
  const packages = uniquePackages([...normalizeArray(rPackages), solverPackage]);
  const packageOptions = { repositoryUrl, binaryRVersion, packageIndexUrls };
  const availability = skipPackageCheck
    ? null
    : await checkSigminerWebRAvailability({
        method,
        rPackages,
        ...packageOptions,
      });
  if (availability) {
    assertWebRAdapterAvailable(availability, "sigminer");
  }

  const rawRun = await runWebR(
    {
      r: prepared.rSnippet,
      rPackages: packages,
      files: prepared.files,
      outputFiles: [prepared.manifest.outputPath],
      timeoutMs,
      repositoryUrl,
    },
    {
      ...runnerOptions,
      webRModuleURL,
      repositoryUrl,
      timeoutMs,
    }
  );
  const exposures = parseSigminerOutput(
    extractCollectedTextFile(rawRun, prepared.manifest.outputPath)
  );

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigminer",
    runtime: "webr",
    status: "completed",
    exactPackageExecution: true,
    packageAvailability: availability,
    preparedInput: prepared.manifest,
    exposures,
    rawRun,
    provenance: buildAdapterProvenance({
      tool: "sigminer",
      runtime: "webr",
      packageName: "sigminer",
      parameters: prepared.manifest,
      notes:
        "Exact package execution through webR. Availability depends on compatible WebAssembly package builds in the active repository.",
    }),
  };
}

/**
 * Runs SigProfilerAssignment in matrix mode through the Pyodide worker runner.
 *
 * @async
 * @function runSigProfilerAssignment
 * @memberof adapters
 * @param {Object} input - Spectra and optional custom signatures.
 * @param {Object} [options] - Runtime and SigProfilerAssignment options.
 * @returns {Promise<Object>} Adapter result with collected files and parsed exposure table when detected.
 */
async function runSigProfilerAssignment(
  { spectra, signatures = null },
  {
    contexts = null,
    pyodidePackages = DEFAULT_PYODIDE_SCIENTIFIC_PACKAGES,
    micropipPackages = [DEFAULT_SPA_PACKAGE],
    outputDirectory = "/output/sigprofilerassignment",
    contextType = "96",
    collapseToSBS96 = true,
    cosmicVersion = 3.5,
    exome = false,
    genomeBuild = "GRCh37",
    excludeSignatureSubgroups = null,
    exportProbabilities = false,
    cpu = 1,
    verbose = false,
    timeoutMs = 300000,
    runnerOptions = {},
  } = {}
) {
  const prepared = prepareSigProfilerAssignmentInput(
    { spectra, signatures },
    { contexts }
  );
  const config = {
    ...prepared.manifest,
    outputDirectory,
    contextType,
    collapseToSBS96,
    cosmicVersion,
    exome,
    genomeBuild,
    excludeSignatureSubgroups,
    exportProbabilities,
    cpu,
    verbose,
  };
  const rawRun = await runPyodide(
    {
      python: createSigProfilerAssignmentPython(),
      files: prepared.files,
      inputJson: config,
      pyodidePackages,
      micropipPackages,
      outputDirectories: [outputDirectory],
      timeoutMs,
    },
    runnerOptions
  );
  const parsed = parseExposureTables(rawRun.files, { normalize: true });
  const reconstructionMetrics = parseReconstructionMetricTables(rawRun.files);

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigprofilerassignment",
    runtime: "pyodide",
    status: rawRun.result?.status || "completed",
    exposures: parsed.exposures,
    candidateExposureTables: parsed.candidateTables,
    packageReconstructionMetrics: reconstructionMetrics.metrics,
    candidateReconstructionMetricTables: reconstructionMetrics.candidateTables,
    preparedInput: prepared.manifest,
    rawRun,
    provenance: buildAdapterProvenance({
      tool: "SigProfilerAssignment",
      runtime: "pyodide",
      packageName: "SigProfilerAssignment",
      packageVersion: String(DEFAULT_SPA_PACKAGE).split("==")[1] || null,
      parameters: config,
      notes:
        "Matrix-mode execution disables plotting and mutation-level probability export for browser compatibility.",
    }),
  };
}

/**
 * Runs a browser-compatible SigProfilerExtractor handoff workflow.
 *
 * The default runtime uses browser-native NMF against the matrix prepared for
 * SigProfilerExtractor. Exact package execution can still be requested with
 * runtime="pyodide", but current SigProfilerExtractor wheels require torch,
 * which is not installable in Pyodide.
 *
 * @async
 * @function runSigProfilerExtractor
 * @memberof adapters
 * @param {Object} input - Input spectra.
 * @param {Object} [options] - Runtime and SigProfilerExtractor options.
 * @returns {Promise<Object>} Adapter result with collected files and parsed output tables.
 */
async function runSigProfilerExtractor(
  { spectra },
  {
    runtime = "browser_nmf",
    contexts = null,
    pyodidePackages = DEFAULT_PYODIDE_SCIENTIFIC_PACKAGES,
    micropipPackages = [DEFAULT_SPE_PACKAGE],
    outputDirectory = "/output/sigprofiler_extractor",
    referenceGenome = "GRCh37",
    minimumSignatures = 1,
    maximumSignatures = 5,
    nmfReplicates = 100,
    cpu = 1,
    maxBrowserRuns = 8,
    maxIterations = 700,
    tolerance = 1e-5,
    seed = 123,
    signaturePrefix = "SPE_NMF",
    rankSelectionCriterion = "reconstruction_error",
    timeoutMs = 300000,
    runnerOptions = {},
  } = {}
) {
  if (runtime === "browser" || runtime === "browser_nmf" || runtime === "browser_fallback") {
    return await runSigProfilerExtractorBrowserNmf(
      { spectra },
      {
        contexts,
        outputDirectory,
        referenceGenome,
        minimumSignatures,
        maximumSignatures,
        nmfReplicates,
        cpu,
        maxBrowserRuns,
        maxIterations,
        tolerance,
        seed,
        signaturePrefix,
        rankSelectionCriterion,
      }
    );
  }
  if (runtime !== "pyodide") {
    throw new Error(`Unsupported SigProfilerExtractor runtime "${runtime}". Use "browser_nmf" or "pyodide".`);
  }
  const prepared = prepareSigProfilerExtractorInput(
    { spectra },
    {
      contexts,
      outputDirectory,
      referenceGenome,
      minimumSignatures,
      maximumSignatures,
      nmfReplicates,
      cpu,
    }
  );
  const packageSpec = sigProfilerExtractorPackageSpec(micropipPackages);
  if (packageSpec) {
    throw createSigProfilerExtractorPyodideError({ prepared, packageSpec });
  }
  const config = {
    ...prepared.manifest,
    outputDirectory,
  };
  const rawRun = await runPyodide(
    {
      python: createSigProfilerExtractorPython(),
      files: prepared.files,
      inputJson: config,
      pyodidePackages,
      micropipPackages,
      outputDirectories: [outputDirectory],
      timeoutMs,
    },
    runnerOptions
  );
  const parsed = parseSigProfilerExtractorOutput(rawRun.files, {
    normalize: true,
  });

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigprofilerextractor",
    runtime: "pyodide",
    status: rawRun.result?.status || "completed",
    signatures: parsed.signatures,
    exposures: parsed.exposures,
    candidateSignatureTables: parsed.candidateSignatureTables,
    candidateExposureTables: parsed.candidateExposureTables,
    preparedInput: prepared.manifest,
    rawRun,
    provenance: buildAdapterProvenance({
      tool: "SigProfilerExtractor",
      runtime: "pyodide",
      packageName: "SigProfilerExtractor",
      packageVersion: String(DEFAULT_SPE_PACKAGE).split("==")[1] || null,
      parameters: config,
      notes:
        "Pyodide execution requires SigProfilerExtractor and its scientific dependencies to install successfully in the target browser worker.",
    }),
  };
}

/**
 * Prepares MuSiCal-compatible spectra and signature files for refitting.
 *
 * @function prepareMuSiCalRefitInput
 * @memberof adapters
 * @param {Object} input - Spectra and signatures.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra.
 * @param {Object<string,Object<string,number>>} input.signatures - Signature catalog.
 * @param {Object} [options] - Export options.
 * @returns {Object} Virtual files and manifest metadata for refit workflows.
 */
function prepareMuSiCalRefitInput(
  { spectra, signatures },
  { contexts = null, spectraPath = "/input/musical_spectra.tsv", signaturePath = "/input/musical_signatures.tsv" } = {}
) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const contextOrder = normalizeContextOrder({
    spectra: normalizedSpectra,
    signatures: normalizedSignatures,
    contexts,
  });
  const exported = exportMuSiCalInput(
    { spectra: normalizedSpectra, signatures: normalizedSignatures },
    { contexts: contextOrder }
  );

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "musical",
    mode: "refit",
    files: [
      { path: spectraPath, text: exported.spectra },
      { path: signaturePath, text: exported.signatures },
    ],
    manifest: {
      ...exported.manifest,
      spectraPath,
      signaturePath,
      contexts: contextOrder,
    },
  };
}

/**
 * Creates a multi-tool interoperability bundle from the same spectra and catalog.
 *
 * @function createInteroperabilityBundle
 * @memberof adapters
 * @param {Object} input - Spectra and optional signatures.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra.
 * @param {Object<string,Object<string,number>>} [input.signatures=null] - Signature catalog.
 * @param {Object} [options] - Context and tool-specific export options.
 * @returns {Object} Prepared handoff bundles for supported external tools.
 */
function createInteroperabilityBundle(
  { spectra, signatures = null },
  {
    contexts = null,
    include = [
      "sigprofilerassignment",
      "sigprofilerextractor",
      "sigprofilerplotting",
      "deconstructsigs",
      "sigminer",
      "musical",
    ],
    sigProfilerExtractor = {},
    sigProfilerPlotting = {},
    deconstructSigs = {},
    sigminer = {},
    musical = {},
  } = {}
) {
  const normalizedInclude = new Set(include.map((name) => String(name).toLowerCase()));
  const bundle = {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    tools: {},
  };

  if (normalizedInclude.has("sigprofilerassignment")) {
    bundle.tools.sigProfilerAssignment = prepareSigProfilerAssignmentInput(
      { spectra, signatures },
      { contexts }
    );
  }
  if (normalizedInclude.has("sigprofilerextractor")) {
    bundle.tools.sigProfilerExtractor = prepareSigProfilerExtractorInput(
      { spectra },
      { contexts, ...sigProfilerExtractor }
    );
  }
  if (normalizedInclude.has("sigprofilerplotting")) {
    bundle.tools.sigProfilerPlotting = prepareSigProfilerPlottingInput(
      { spectra },
      { contexts, ...sigProfilerPlotting }
    );
  }
  if (normalizedInclude.has("deconstructsigs") && signatures) {
    bundle.tools.deconstructSigs = prepareDeconstructSigsInput(
      { spectra, signatures },
      { contexts, ...deconstructSigs }
    );
  }
  if (normalizedInclude.has("sigminer") && signatures) {
    bundle.tools.sigminer = prepareSigminerInput(
      { spectra, signatures },
      { contexts, ...sigminer }
    );
  }
  if (normalizedInclude.has("musical") && signatures) {
    bundle.tools.musical = prepareMuSiCalRefitInput(
      { spectra, signatures },
      { contexts, ...musical }
    );
  }

  return bundle;
}

function createMuSiCalRefitPython() {
  return `
import json
import pandas as pd
from musical.refit import refit

config = json.loads(MSIG_INPUT_JSON)
X = pd.read_csv(config["spectraPath"], sep="\\t", index_col=0)
W = pd.read_csv(config["signaturePath"], sep="\\t", index_col=0)
H, model = refit(
    X,
    W,
    method=config.get("method", "likelihood_bidirectional"),
    thresh=config.get("threshold"),
    connected_sigs=config.get("connectedSigs", False),
)

sample_by_signature = {}
for signature_name, sample_values in H.to_dict(orient="index").items():
    for sample_name, exposure in sample_values.items():
        sample_by_signature.setdefault(sample_name, {})[signature_name] = float(exposure)

json.dumps({
    "status": "completed",
    "tool": "MuSiCal",
    "method": config.get("method", "likelihood_bidirectional"),
    "threshold": config.get("threshold"),
    "connectedSigs": config.get("connectedSigs", False),
    "exposures": sample_by_signature,
})
`;
}

function subsetSignatures(signatures, signatureNames) {
  return Object.fromEntries(
    signatureNames
      .filter((signatureName) => signatures[signatureName])
      .map((signatureName) => [signatureName, signatures[signatureName]])
  );
}

function completeExposureRecord(signatureNames, partialRecord) {
  return Object.fromEntries(
    signatureNames.map((signatureName) => [
      signatureName,
      safeNumber(partialRecord?.[signatureName], 0) || 0,
    ])
  );
}

/**
 * Runs a browser-native sparse NNLS refit comparator using MuSiCal-compatible inputs.
 *
 * This helper does not execute the MuSiCal Python package. It provides a small
 * sparse refit comparator for browser review when a Pyodide-compatible MuSiCal
 * wheel is not supplied.
 *
 * @async
 * @function runSparseNnlsRefit
 * @memberof adapters
 * @param {Object} input - Spectra and signatures.
 * @param {Object} [options] - Sparse refit options.
 * @returns {Promise<Object>} Sparse refit exposures and reconstruction metrics.
 */
async function runSparseNnlsRefit(
  { spectra, signatures },
  {
    contexts = null,
    threshold = 0.01,
    keepAtLeastOne = true,
    maxIterations = null,
    convergenceTolerance = 1e-10,
  } = {}
) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const signatureNames = Object.keys(normalizedSignatures);
  if (signatureNames.length === 0) {
    throw new Error("MuSiCal-compatible sparse refit requires at least one signature.");
  }
  const contextOrder = normalizeContextOrder({
    spectra: normalizedSpectra,
    signatures: normalizedSignatures,
    contexts,
  });
  const initialExposures = await fitSpectraWithNNLS(
    normalizedSignatures,
    normalizedSpectra,
    {
      contexts: contextOrder,
      exposureThreshold: 0,
      exposureType: "relative",
      renormalize: true,
      maxIterations,
      convergenceTolerance,
    }
  );
  const sparseExposures = {};
  const activeSets = {};

  for (const [sample, exposureRecord] of Object.entries(initialExposures)) {
    let activeSignatures = signatureNames.filter(
      (signatureName) => (exposureRecord[signatureName] || 0) >= threshold
    );
    if (activeSignatures.length === 0 && keepAtLeastOne) {
      activeSignatures = [
        signatureNames.reduce((best, signatureName) =>
          (exposureRecord[signatureName] || 0) > (exposureRecord[best] || 0)
            ? signatureName
            : best
        ),
      ];
    }
    if (activeSignatures.length === 0) {
      sparseExposures[sample] = completeExposureRecord(signatureNames, {});
      activeSets[sample] = [];
      continue;
    }

    const refit = await fitSpectraWithNNLS(
      subsetSignatures(normalizedSignatures, activeSignatures),
      { [sample]: normalizedSpectra[sample] },
      {
        contexts: contextOrder,
        exposureThreshold: 0,
        exposureType: "relative",
        renormalize: true,
        maxIterations,
        convergenceTolerance,
      }
    );
    sparseExposures[sample] = completeExposureRecord(
      signatureNames,
      refit[sample] || {}
    );
    activeSets[sample] = activeSignatures;
  }

  const reconstructionError = calculateReconstructionError(
    normalizedSignatures,
    normalizedSpectra,
    sparseExposures,
    { contexts: contextOrder, normalizeMode: "relative" }
  );

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "musical",
    runtime: "js_sparse_nnls",
    status: "completed",
    methodBoundary:
      "Browser-native sparse NNLS comparator. It uses MuSiCal-compatible matrices but does not execute the MuSiCal Python package.",
    threshold,
    activeSets,
    exposures: sparseExposures,
    reconstructionError,
    provenance: buildAdapterProvenance({
      tool: "MuSiCal-compatible sparse refit",
      runtime: "js_sparse_nnls",
      parameters: {
        threshold,
        keepAtLeastOne,
        maxIterations,
        convergenceTolerance,
      },
      notes:
        "Use runtime='pyodide' with a Pyodide-compatible MuSiCal wheel to execute the external MuSiCal package.",
    }),
  };
}

/**
 * Runs MuSiCal refitting through Pyodide, or a browser-native sparse NNLS comparator.
 *
 * @async
 * @function runMuSiCalRefit
 * @memberof adapters
 * @param {Object} input - Spectra and signature catalog.
 * @param {Object} [options] - Runtime and refit options.
 * @returns {Promise<Object>} Refit result with exposures and provenance.
 */
async function runMuSiCalRefit(
  { spectra, signatures },
  {
    contexts = null,
    runtime = "js_sparse_nnls",
    method = "likelihood_bidirectional",
    threshold = 0.001,
    connectedSigs = false,
    pyodidePackages = DEFAULT_PYODIDE_SCIENTIFIC_PACKAGES,
    micropipPackages = [],
    outputDirectory = "/output/musical",
    timeoutMs = 300000,
    runnerOptions = {},
    ...sparseOptions
  } = {}
) {
  if (runtime !== "pyodide") {
    return await runSparseNnlsRefit(
      { spectra, signatures },
      {
        contexts,
        threshold,
        ...sparseOptions,
      }
    );
  }

  const prepared = prepareMuSiCalRefitInput(
    { spectra, signatures },
    { contexts }
  );
  const config = {
    ...prepared.manifest,
    outputDirectory,
    method,
    threshold,
    connectedSigs,
  };
  const rawRun = await runPyodide(
    {
      python: createMuSiCalRefitPython(),
      files: prepared.files,
      inputJson: config,
      pyodidePackages,
      micropipPackages,
      outputDirectories: [outputDirectory],
      timeoutMs,
    },
    runnerOptions
  );

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "musical",
    runtime: "pyodide",
    status: rawRun.result?.status || "completed",
    exposures: rawRun.result?.exposures || null,
    preparedInput: prepared.manifest,
    rawRun,
    provenance: buildAdapterProvenance({
      tool: "MuSiCal",
      runtime: "pyodide",
      packageName: "musical",
      parameters: config,
      notes:
        "Pyodide execution requires the MuSiCal package to be available through supplied Pyodide-compatible wheels or a preloaded worker environment.",
    }),
  };
}

export {
  ADAPTER_SCHEMA_VERSION,
  DEFAULT_SPC_PACKAGE,
  DEFAULT_SPE_PACKAGE,
  DEFAULT_SPMG_PACKAGE,
  DEFAULT_SPP_PACKAGE,
  DEFAULT_SPS_PACKAGE,
  DEFAULT_SPA_PACKAGE,
  checkDeconstructSigsWebRAvailability,
  checkSigminerWebRAvailability,
  createInteroperabilityBundle,
  parseExposureTables,
  parseDeconstructSigsOutput,
  parseSigminerOutput,
  parseSigProfilerMatrixGeneratorOutput,
  parseSigProfilerExtractorOutput,
  prepareDeconstructSigsInput,
  prepareMuSiCalRefitInput,
  prepareSigminerInput,
  prepareSigProfilerClustersInput,
  prepareSigProfilerAssignmentInput,
  prepareSigProfilerExtractorInput,
  prepareSigProfilerMatrixGeneratorInput,
  prepareSigProfilerPlottingInput,
  prepareSigProfilerSimulatorInput,
  runDeconstructSigsWebR,
  runMuSiCalRefit,
  runSigminerWebR,
  runSigProfilerAssignment,
  runSigProfilerExtractor,
  runSparseNnlsRefit,
};
