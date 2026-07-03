import path from "node:path";
import {
  createResult,
  ensureDir,
  environmentSummary,
  EXPERIMENTS,
  l1,
  l2,
  mae,
  maxAbsDiff,
  median,
  parseArgs,
  relativeArtifact,
  rmse,
  runCommand,
  tempDir,
  vectorCosine,
  writeCsv,
  writeJson,
  writeText,
} from "../../../../../scripts/manuscript/lib/experiment-utils.mjs";
import {
  generateSyntheticSignatures,
  generateSyntheticSpectra,
  matrixFromSignatures,
  matrixFromSpectra,
} from "../../../../../scripts/manuscript/lib/demo-data.mjs";
import {
  fitSpectraWithNNLS,
  calculateReconstructionError,
} from "../../../../../mSigSDKScripts/qc.js";
import {
  extractSignaturesNMF,
} from "../../../../../mSigSDKScripts/signatureExtraction.js";

const EXPERIMENT = EXPERIMENTS.e3;
const RESULT_PATH = path.join(EXPERIMENT.dir, "data", "reference-check-results.json");
const CSV_PATH = path.join(EXPERIMENT.dir, "data", "reference_check_summary.csv");
const INPUT_PATH = path.join(EXPERIMENT.dir, "data", "reference-input.json");
const PY_REF_PATH = path.join(EXPERIMENT.dir, "data", "python-reference.json");
const R_REF_PATH = path.join(EXPERIMENT.dir, "data", "r-nnls-reference.csv");
const args = parseArgs();
const strict = args.strict !== "false";
const pythonExecutable = args.python || process.env.MSIG_E3_PYTHON || null;
const localRscript = args["local-rscript"] || process.env.MSIG_E3_RSCRIPT || null;
const localRLibrary =
  args["r-library"] ||
  process.env.MSIG_E3_R_LIBS_USER ||
  path.join(process.cwd(), ".tools", "r-library", "R-4.6");

await ensureDir(path.dirname(RESULT_PATH));

const inputs = buildInputs();
await writeJson(INPUT_PATH, inputs.publicInput);

const sdkNnls = await fitSpectraWithNNLS(inputs.nnls.signatures, inputs.nnls.spectra, {
  contexts: inputs.nnls.contexts,
  exposureType: "absolute",
  renormalize: false,
  maxIterations: 100000,
  convergenceTolerance: 1e-14,
});
const sdkQcExposures = await fitSpectraWithNNLS(inputs.qc.signatures, inputs.qc.spectra, {
  contexts: inputs.qc.contexts,
  exposureType: "relative",
  renormalize: true,
  maxIterations: 100000,
  convergenceTolerance: 1e-14,
});
const sdkQc = calculateReconstructionError(inputs.qc.signatures, inputs.qc.spectra, sdkQcExposures, {
  contexts: inputs.qc.contexts,
  normalizeMode: "relative",
});
const sdkNmf = extractSignaturesNMF(inputs.nmf.spectra, {
  contexts: inputs.nmf.contexts,
  rank: 4,
  nRuns: 12,
  seed: 7701,
  maxIterations: 1400,
  tolerance: 1e-7,
});

const pythonReference = await runPythonReference({
  ...inputs.publicInput,
  sdkQcExposures,
});
await writeJson(PY_REF_PATH, pythonReference);

const rReference = await runRReference(inputs.nnls);
await writeText(R_REF_PATH, rReference.csv);

const rows = [];
rows.push(compareNnls("nnls_vs_scipy", sdkNnls, pythonReference.nnls, 1e-6));
rows.push(compareNnls("nnls_vs_r_nnls", sdkNnls, rReference.exposures, 1e-6));
rows.push(compareNmf(sdkNmf, pythonReference.nmf));
rows.push(compareQc(sdkQc, pythonReference.qc));

const status = rows.every((row) => row.status === "pass") ? "completed" : "failed";
const result = createResult({
  experimentId: EXPERIMENT.id,
  environment: environmentSummary({
    referenceExecution: {
      python: pythonReference.environment,
      r: rReference.environment,
    },
  }),
  inputs: {
    nnls: {
      samples: Object.keys(inputs.nnls.spectra).length,
      signatures: Object.keys(inputs.nnls.signatures).length,
      contexts: inputs.nnls.contexts.length,
      acceptance: "max absolute coefficient difference <= 1e-6",
    },
    nmf: {
      samples: Object.keys(inputs.nmf.spectra).length,
      rank: 4,
      acceptance: "SDK reconstruction error within 5% of scikit-learn and median matched-component cosine >= 0.95",
    },
    qc: {
      samples: Object.keys(inputs.qc.spectra).length,
      acceptance: "metric deltas <= 1e-10 except aggregate floating point tolerance <= 1e-8",
    },
  },
  rows,
  artifacts: {
    json: relativeArtifact(RESULT_PATH),
    csv: relativeArtifact(CSV_PATH),
    input: relativeArtifact(INPUT_PATH),
    pythonReference: relativeArtifact(PY_REF_PATH),
    rReference: relativeArtifact(R_REF_PATH),
  },
  status,
  notes: status === "completed" ? [] : ["At least one reference check failed its numerical acceptance threshold."],
});

await writeJson(RESULT_PATH, result);
await writeCsv(CSV_PATH, rows);

if (strict && status !== "completed") {
  throw new Error("E3 reference checks failed. See reference-check-results.json.");
}

console.log(`Wrote ${relativeArtifact(RESULT_PATH)}`);

function buildInputs() {
  const nnlsCatalog = generateSyntheticSignatures({ signatureCount: 9, seed: 3101 });
  const nnlsSpectra = generateSyntheticSpectra({
    sampleCount: 12,
    signatures: nnlsCatalog.signatures,
    contexts: nnlsCatalog.contexts,
    activePerSample: 3,
    burden: 4000,
    seed: 3102,
  });
  const nmfCatalog = generateSyntheticSignatures({ signatureCount: 4, seed: 4101 });
  const nmfSpectra = generateSyntheticSpectra({
    sampleCount: 36,
    signatures: nmfCatalog.signatures,
    contexts: nmfCatalog.contexts,
    activePerSample: 2,
    burden: 2800,
    seed: 4102,
  });
  const qcCatalog = generateSyntheticSignatures({ signatureCount: 7, seed: 5101 });
  const qcSpectra = generateSyntheticSpectra({
    sampleCount: 10,
    signatures: qcCatalog.signatures,
    contexts: qcCatalog.contexts,
    activePerSample: 3,
    burden: 2300,
    seed: 5102,
  });
  const publicInput = {
    nnls: {
      signatures: nnlsCatalog.signatures,
      spectra: nnlsSpectra.spectra,
      contexts: nnlsCatalog.contexts,
      signatureNames: Object.keys(nnlsCatalog.signatures),
      sampleNames: Object.keys(nnlsSpectra.spectra),
      signatureMatrix: matrixFromSignatures(nnlsCatalog.signatures, nnlsCatalog.contexts),
      spectraMatrix: matrixFromSpectra(nnlsSpectra.spectra, nnlsCatalog.contexts),
    },
    nmf: {
      spectra: nmfSpectra.spectra,
      contexts: nmfCatalog.contexts,
      spectraMatrix: matrixFromSpectra(nmfSpectra.spectra, nmfCatalog.contexts),
      sampleNames: Object.keys(nmfSpectra.spectra),
    },
    qc: {
      signatures: qcCatalog.signatures,
      spectra: qcSpectra.spectra,
      contexts: qcCatalog.contexts,
      signatureNames: Object.keys(qcCatalog.signatures),
      sampleNames: Object.keys(qcSpectra.spectra),
    },
  };
  return {
    publicInput,
    nnls: publicInput.nnls,
    nmf: publicInput.nmf,
    qc: publicInput.qc,
  };
}

async function runPythonReference(input) {
  const workDir = tempDir("e3-python-reference");
  await ensureDir(workDir);
  const inputPath = path.join(workDir, "input.json");
  const outputPath = path.join(workDir, "output.json");
  const scriptPath = path.join(workDir, "reference.py");
  await writeJson(inputPath, input);
  await writeText(scriptPath, pythonReferenceScript());
  const repoMount = process.cwd().replaceAll("\\", "/");
  const relInput = path.relative(process.cwd(), inputPath).replaceAll("\\", "/");
  const relOutput = path.relative(process.cwd(), outputPath).replaceAll("\\", "/");
  const relScript = path.relative(process.cwd(), scriptPath).replaceAll("\\", "/");
  if (pythonExecutable) {
    const local = await runCommand(pythonExecutable, [relScript, relInput, relOutput]);
    if (local.status !== "completed") {
      throw new Error(`Python reference run failed: ${local.stderr || local.stdout}`);
    }
    return JSON.parse(await (await import("node:fs/promises")).readFile(outputPath, "utf8"));
  }
  const command = [
    "python -m pip install --quiet numpy scipy scikit-learn",
    `python ${relScript} ${relInput} ${relOutput}`,
  ].join(" && ");
  const docker = await runCommand("docker", [
    "run",
    "--rm",
    "-v",
    `${repoMount}:/work`,
    "-w",
    "/work",
    "python:3.11-slim",
    "sh",
    "-lc",
    command,
  ]);
  if (docker.status !== "completed") {
    throw new Error(`Python reference Docker run failed: ${docker.stderr || docker.stdout}`);
  }
  return JSON.parse(await (await import("node:fs/promises")).readFile(outputPath, "utf8"));
}

async function runRReference(nnlsInput) {
  const workDir = tempDir("e3-r-reference");
  await ensureDir(workDir);
  const signaturesPath = path.join(workDir, "signatures.csv");
  const spectraPath = path.join(workDir, "spectra.csv");
  const outputPath = path.join(workDir, "r-nnls-reference.csv");
  const scriptPath = path.join(workDir, "reference.R");
  await writeCsv(
    signaturesPath,
    nnlsInput.contexts.map((context, index) => ({
      context,
      ...Object.fromEntries(
        nnlsInput.signatureNames.map((signature, signatureIndex) => [
          signature,
          nnlsInput.signatureMatrix[index][signatureIndex],
        ])
      ),
    }))
  );
  await writeCsv(
    spectraPath,
    nnlsInput.contexts.map((context, index) => ({
      context,
      ...Object.fromEntries(
        nnlsInput.sampleNames.map((sample, sampleIndex) => [
          sample,
          nnlsInput.spectraMatrix[index][sampleIndex],
        ])
      ),
    }))
  );
  await writeText(scriptPath, rReferenceScript());
  const repoMount = process.cwd().replaceAll("\\", "/");
  const relScript = path.relative(process.cwd(), scriptPath).replaceAll("\\", "/");
  const relSignatures = path.relative(process.cwd(), signaturesPath).replaceAll("\\", "/");
  const relSpectra = path.relative(process.cwd(), spectraPath).replaceAll("\\", "/");
  const relOutput = path.relative(process.cwd(), outputPath).replaceAll("\\", "/");
  const command = [
    'if (!requireNamespace("nnls", quietly=TRUE)) install.packages("nnls", repos="https://cloud.r-project.org")',
    `source("${relScript}")`,
    `run_reference("${relSignatures}", "${relSpectra}", "${relOutput}")`,
  ].join("; ");
  if (localRscript) {
    const local = await runCommand(localRscript, ["-e", command], {
      env: { R_LIBS_USER: localRLibrary },
    });
    if (local.status !== "completed") {
      throw new Error(`R nnls reference run failed: ${local.stderr || local.stdout}`);
    }
    const csv = await (await import("node:fs/promises")).readFile(outputPath, "utf8");
    return {
      csv,
      exposures: parseExposureCsv(csv),
      environment: {
        runtime: `local:${path.basename(localRscript)}`,
        package: "nnls",
        library: localRLibrary,
        elapsedMs: local.elapsedMs,
      },
    };
  }
  const docker = await runCommand("docker", [
    "run",
    "--rm",
    "-v",
    `${repoMount}:/work`,
    "-w",
    "/work",
    "r-base:4.4.2",
    "Rscript",
    "-e",
    command,
  ]);
  if (docker.status !== "completed") {
    throw new Error(`R nnls reference Docker run failed: ${docker.stderr || docker.stdout}`);
  }
  const csv = await (await import("node:fs/promises")).readFile(outputPath, "utf8");
  return {
    csv,
    exposures: parseExposureCsv(csv),
    environment: {
      dockerImage: "r-base:4.4.2",
      package: "nnls",
      elapsedMs: docker.elapsedMs,
    },
  };
}

function compareNnls(checkId, sdk, reference, tolerance) {
  const diffs = [];
  for (const sample of Object.keys(sdk)) {
    const signatures = [...new Set([...Object.keys(sdk[sample]), ...Object.keys(reference[sample] || {})])];
    const left = signatures.map((signature) => sdk[sample]?.[signature] || 0);
    const right = signatures.map((signature) => reference[sample]?.[signature] || 0);
    diffs.push(maxAbsDiff(left, right));
  }
  const maxDiff = Math.max(...diffs, 0);
  return {
    checkId,
    component: "NNLS",
    reference: checkId === "nnls_vs_scipy" ? "scipy.optimize.nnls" : "R nnls::nnls",
    sampleCount: Object.keys(sdk).length,
    maxAbsoluteDifference: maxDiff,
    threshold: tolerance,
    status: maxDiff <= tolerance ? "pass" : "failed",
  };
}

function compareNmf(sdk, reference) {
  const sdkProfiles = Object.values(sdk.signatures).map((profile) =>
    sdk.contexts.map((context) => profile[context] || 0)
  );
  const sklearnProfiles = reference.components;
  const matches = greedyCosineMatches(sdkProfiles, sklearnProfiles);
  const medianMatchedComponentCosine = median(matches.map((match) => match.cosine));
  const errorRatio = sdk.reconstructionError / reference.reconstructionError;
  const passed = errorRatio <= 1.05 && medianMatchedComponentCosine >= 0.95;
  return {
    checkId: "nmf_vs_sklearn",
    component: "NMF",
    reference: "scikit-learn NMF",
    sampleCount: sdk.sampleNames.length,
    rank: sdk.rank,
    sdkReconstructionError: sdk.reconstructionError,
    referenceReconstructionError: reference.reconstructionError,
    reconstructionErrorRatio: errorRatio,
    medianMatchedComponentCosine,
    threshold: "error ratio <= 1.05 and median cosine >= 0.95",
    status: passed ? "pass" : "failed",
  };
}

function compareQc(sdk, reference) {
  const metricKeys = [
    "cosineSimilarity",
    "rmse",
    "meanAbsoluteError",
    "l1Error",
    "l2Error",
    "residualSum",
    "totalObserved",
    "totalReconstructed",
    "maxAbsoluteResidual",
  ];
  const deltas = [];
  for (const sample of sdk.samples) {
    const ref = reference.samples.find((row) => row.sample === sample.sample);
    for (const key of metricKeys) {
      deltas.push(Math.abs((sample[key] || 0) - (ref?.[key] || 0)));
    }
  }
  const maxDelta = Math.max(...deltas, 0);
  return {
    checkId: "qc_metrics_vs_python",
    component: "QC metrics",
    reference: "independent Python implementation",
    sampleCount: sdk.samples.length,
    maxMetricDelta: maxDelta,
    threshold: 1e-10,
    status: maxDelta <= 1e-10 ? "pass" : "failed",
  };
}

function greedyCosineMatches(leftProfiles, rightProfiles) {
  const candidates = [];
  for (let leftIndex = 0; leftIndex < leftProfiles.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < rightProfiles.length; rightIndex += 1) {
      candidates.push({
        leftIndex,
        rightIndex,
        cosine: vectorCosine(leftProfiles[leftIndex], rightProfiles[rightIndex]),
      });
    }
  }
  candidates.sort((a, b) => b.cosine - a.cosine);
  const usedLeft = new Set();
  const usedRight = new Set();
  const matches = [];
  for (const candidate of candidates) {
    if (usedLeft.has(candidate.leftIndex) || usedRight.has(candidate.rightIndex)) continue;
    usedLeft.add(candidate.leftIndex);
    usedRight.add(candidate.rightIndex);
    matches.push(candidate);
  }
  return matches;
}

function parseExposureCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const exposures = {};
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const sample = cells[0];
    exposures[sample] = {};
    for (let index = 1; index < header.length; index += 1) {
      exposures[sample][header[index]] = Number(cells[index]) || 0;
    }
  }
  return exposures;
}

function pythonReferenceScript() {
  return `import json
import sys
import numpy as np
import scipy
import sklearn
from scipy.optimize import nnls
from sklearn.decomposition import NMF

input_path, output_path = sys.argv[1:3]
with open(input_path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

def vector_from_record(record, keys):
    return np.array([float(record.get(key, 0.0)) for key in keys], dtype=float)

nnls_input = payload["nnls"]
contexts = nnls_input["contexts"]
signature_names = nnls_input["signatureNames"]
A = np.array(nnls_input["signatureMatrix"], dtype=float)
nnls_out = {}
for sample in nnls_input["sampleNames"]:
    b = vector_from_record(nnls_input["spectra"][sample], contexts)
    x, _ = nnls(A, b)
    nnls_out[sample] = {signature_names[i]: float(x[i]) for i in range(len(signature_names))}

nmf_input = payload["nmf"]
X = np.array(nmf_input["spectraMatrix"], dtype=float).T
model = NMF(n_components=4, init="nndsvda", solver="mu", beta_loss="frobenius", max_iter=2000, random_state=42)
W = model.fit_transform(X)
H = model.components_
reconstruction_error = float(np.linalg.norm(X - np.matmul(W, H)))

qc_input = payload["qc"]
qc_contexts = qc_input["contexts"]
qc_signature_names = qc_input["signatureNames"]
qc_rows = []
for sample in qc_input["sampleNames"]:
    observed = vector_from_record(qc_input["spectra"][sample], qc_contexts)
    total_observed_raw = float(np.sum(observed))
    if np.sum(observed) > 0:
        observed = observed / np.sum(observed)
    reconstructed = np.zeros(len(qc_contexts), dtype=float)
    exposure_row = payload["sdkQcExposures"][sample]
    for signature in qc_signature_names:
        reconstructed += float(exposure_row.get(signature, 0.0)) * vector_from_record(qc_input["signatures"][signature], qc_contexts)
    if np.sum(reconstructed) > 0:
        reconstructed = reconstructed / np.sum(reconstructed)
    residuals = observed - reconstructed
    abs_res = np.abs(residuals)
    sq_res = residuals * residuals
    denom = float(np.linalg.norm(observed) * np.linalg.norm(reconstructed))
    cosine = 0.0 if denom == 0 else float(np.dot(observed, reconstructed) / denom)
    qc_rows.append({
        "sample": sample,
        "totalObserved": float(np.sum(observed)),
        "totalObservedRaw": total_observed_raw,
        "totalReconstructed": float(np.sum(reconstructed)),
        "residualSum": float(np.sum(residuals)),
        "l1Error": float(np.sum(abs_res)),
        "l2Error": float(np.sqrt(np.sum(sq_res))),
        "rmse": float(np.sqrt(np.mean(sq_res))),
        "meanAbsoluteError": float(np.mean(abs_res)),
        "maxAbsoluteResidual": float(np.max(abs_res) if len(abs_res) else 0.0),
        "cosineSimilarity": cosine,
    })

with open(output_path, "w", encoding="utf-8") as handle:
    json.dump({
        "environment": {
            "python": sys.version.split()[0],
            "packages": {
                "numpy": np.__version__,
                "scipy": scipy.__version__,
                "scikit-learn": sklearn.__version__,
            },
            "runtime": sys.executable
        },
        "nnls": nnls_out,
        "nmf": {
            "reconstructionError": reconstruction_error,
            "components": H.tolist()
        },
        "qc": {
            "samples": qc_rows
        }
    }, handle, indent=2)
`;
}

function rReferenceScript() {
  return `run_reference <- function(signature_path, spectra_path, output_path) {
  library(nnls)
  signatures <- read.csv(signature_path, check.names = FALSE)
  spectra <- read.csv(spectra_path, check.names = FALSE)
  signature_names <- colnames(signatures)[-1]
  sample_names <- colnames(spectra)[-1]
  A <- as.matrix(signatures[, signature_names])
  output <- data.frame(sample = sample_names, check.names = FALSE)
  for (signature_name in signature_names) {
    output[[signature_name]] <- 0
  }
  for (sample_name in sample_names) {
    b <- as.numeric(spectra[[sample_name]])
    fit <- nnls(A, b)
    output[output$sample == sample_name, signature_names] <- coef(fit)
  }
  write.csv(output, output_path, row.names = FALSE, quote = FALSE)
}
`;
}
