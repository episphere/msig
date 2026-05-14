import {
  exportCOSMICSignatureMatrix,
  exportMuSiCalInput,
  exportSigProfilerMatrix,
  importCOSMICSignatureMatrix,
  importMuSiCalOutput,
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
import { runPyodide } from "./runners.js";

const ADAPTER_SCHEMA_VERSION = "msig.adapters.v0.3";
const DEFAULT_SPA_PACKAGE = "SigProfilerAssignment==1.1.3";
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

function createDeconstructSigsRScript({
  spectraPath = "deconstructsigs_spectra.tsv",
  signaturePath = "deconstructsigs_signatures.tsv",
  outputPath = "deconstructsigs_exposures.tsv",
  signatureCutoff = 0.01,
} = {}) {
  return [
    "library(deconstructSigs)",
    "",
    `spectra <- read.delim(${JSON.stringify(spectraPath)}, check.names = FALSE)`,
    `signatures <- read.delim(${JSON.stringify(signaturePath)}, check.names = FALSE)`,
    "rownames(spectra) <- spectra[[1]]",
    "spectra[[1]] <- NULL",
    "rownames(signatures) <- signatures[[1]]",
    "signatures[[1]] <- NULL",
    "signature.matrix <- as.matrix(signatures)",
    "results <- lapply(colnames(spectra), function(sample_name) {",
    "  fit <- whichSignatures(",
    "    tumor.ref = spectra[[sample_name]],",
    "    signatures.ref = signature.matrix,",
    "    sample.id = sample_name,",
    `    signature.cutoff = ${Number(signatureCutoff)}`,
    "  )",
    "  weights <- fit$weights",
    "  data.frame(sample = sample_name, t(weights), check.names = FALSE)",
    "})",
    "exposures <- do.call(rbind, results)",
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

  return {
    schemaVersion: ADAPTER_SCHEMA_VERSION,
    adapter: "sigprofilerassignment",
    runtime: "pyodide",
    status: rawRun.result?.status || "completed",
    exposures: parsed.exposures,
    candidateExposureTables: parsed.candidateTables,
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
      "deconstructsigs",
      "musical",
    ],
    sigProfilerExtractor = {},
    deconstructSigs = {},
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
  if (normalizedInclude.has("deconstructsigs") && signatures) {
    bundle.tools.deconstructSigs = prepareDeconstructSigsInput(
      { spectra, signatures },
      { contexts, ...deconstructSigs }
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
  DEFAULT_SPA_PACKAGE,
  createInteroperabilityBundle,
  parseExposureTables,
  parseDeconstructSigsOutput,
  parseSigProfilerExtractorOutput,
  prepareDeconstructSigsInput,
  prepareMuSiCalRefitInput,
  prepareSigProfilerAssignmentInput,
  prepareSigProfilerExtractorInput,
  runMuSiCalRefit,
  runSigProfilerAssignment,
  runSparseNnlsRefit,
};
