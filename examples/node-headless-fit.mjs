#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  bootstrapSignatureFit,
  calculateReconstructionError,
  fitSpectraWithNNLS,
  summarizeMutationBurden,
} from "../mSigSDKScripts/qc.js";
import { createAnalysisReport } from "../mSigSDKScripts/reports.js";
import { extractSignaturesNMF } from "../mSigSDKScripts/signatureExtraction.js";
import {
  getExpectedContexts,
  rowsToSampleSpectra,
  rowsToSignatureMatrix,
  validateSignatureMatrix,
  validateSpectra,
} from "../mSigSDKScripts/validation.js";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);

const DEFAULT_OUTPUT = path.join("examples", "node-headless-report.json");
const PORTAL_URLS = Object.freeze({
  spectra:
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum?study=PCAWG&cancer=Lung-AdenoCA&strategy=WGS&profile=SBS&matrix=96&offset=0",
  signatures:
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature?source=Reference_signatures&strategy=WGS&profile=SBS&matrix=96&signatureSetName=COSMIC_v3_Signatures_GRCh37_SBS96&limit=10000&offset=0",
});

const args = parseArgs(process.argv.slice(2));
const outputPath = path.resolve(process.cwd(), args.output || DEFAULT_OUTPUT);
const seed = Number(args.seed ?? 20260624);
const bootstrapIterations = Number(args.bootstrapIterations ?? 20);
const nmfSamples = Number(args.nmfSamples ?? 8);

const input = args.input
  ? await loadLocalInput(path.resolve(process.cwd(), args.input))
  : await loadPortalInput({ sampleLimit: Number(args.sampleLimit ?? 38) });

const contexts = input.contexts || getExpectedContexts({ profile: "SBS", matrix: 96 });
const spectra = completeMatrix(input.spectra, contexts);
const signatures = completeMatrix(input.signatures, contexts);
const sampleName = args.sample || input.sampleName || Object.keys(spectra)[0];

if (!sampleName || !spectra[sampleName]) {
  throw new Error(`Sample ${sampleName || "<none>"} was not found in the input spectra.`);
}

const selectedSpectrum = { [sampleName]: spectra[sampleName] };
const validation = {
  spectra: validateSpectra(selectedSpectrum, { expectedContexts: contexts }),
  signatures: validateSignatureMatrix(signatures, { expectedContexts: contexts }),
};
if (!validation.spectra.valid || !validation.signatures.valid) {
  throw new Error("Input validation failed; inspect validation.spectra and validation.signatures.");
}

const startedAt = performance.now();
const exposures = await fitSpectraWithNNLS(signatures, selectedSpectrum, {
  contexts,
  exposureType: "relative",
  renormalize: true,
  maxIterations: 100000,
  convergenceTolerance: 1e-12,
});
const reconstruction = calculateReconstructionError(signatures, selectedSpectrum, exposures, {
  contexts,
  normalizeMode: "relative",
});
const mutationBurden = summarizeMutationBurden(selectedSpectrum, {
  lowBurdenThresholdMode: "fixed",
  lowBurdenThreshold: 50,
});
const bootstrap =
  bootstrapIterations > 0
    ? bootstrapSignatureFit(signatures, spectra[sampleName], {
        contexts,
        iterations: bootstrapIterations,
        seed,
        exposureType: "relative",
        renormalize: true,
      })
    : null;
const nmfInput = Object.fromEntries(Object.entries(spectra).slice(0, Math.max(2, nmfSamples)));
const extraction = extractSignaturesNMF(nmfInput, {
  contexts,
  rank: Math.min(2, Object.keys(nmfInput).length),
  nRuns: 3,
  maxIterations: 250,
  tolerance: 1e-6,
  seed,
});
const elapsedMs = performance.now() - startedAt;

const report = createAnalysisReport({
  title: "mSigSDK Node Headless Fit Report",
  summary:
    "Headless Node.js execution of native matrix conversion, NNLS fitting, QC, bootstrap, NMF, and JSON report serialization.",
  workflowRole: "node_headless_native_fit",
  scopeStatement:
    "This report exercises the native JavaScript computation path. Browser plotting, file download helpers, WebR, and Pyodide worker adapters are outside this headless Node example.",
  methodBasis: {
    nativeCore: [
      "rowsToSampleSpectra / rowsToSignatureMatrix",
      "fitSpectraWithNNLS",
      "calculateReconstructionError",
      "summarizeMutationBurden",
      "bootstrapSignatureFit",
      "extractSignaturesNMF",
      "createAnalysisReport",
    ],
  },
  primaryInterpretationFields: [
    "qc.reconstruction.samples[0].cosineSimilarity",
    "qc.bootstrap.reportingMode",
    "extraction.reconstructionError",
  ],
  parameters: {
    profile: "SBS",
    matrix: 96,
    sampleName,
    sampleCountAvailable: Object.keys(spectra).length,
    signatureCount: Object.keys(signatures).length,
    contextCount: contexts.length,
    exposureType: "relative",
    bootstrapIterations,
    bootstrapSeed: seed,
    nmfRank: extraction.rank,
    nmfRuns: 3,
    inputSource: input.source,
  },
  validation,
  qc: {
    mutationBurden,
    reconstruction,
    bootstrap,
  },
  signatures,
  exposures,
  extraction,
  provenance: {
    sdkVersion: "0.3.0",
    node: process.version,
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model || "unknown",
    logicalCores: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    commit: await currentCommit(),
    elapsedMs,
    command: `node ${path.relative(process.cwd(), scriptPath)} ${process.argv
      .slice(2)
      .join(" ")}`.trim(),
  },
  notes: [
    "Browser-only capabilities not exercised here: DOM plotting, downloadAnalysisReport, Pyodide/WebR Web Worker execution, and worker-based NMF offload.",
  ],
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "ok",
  output: path.relative(process.cwd(), outputPath),
  sampleName,
  signatures: Object.keys(signatures).length,
  contexts: contexts.length,
  elapsedMs,
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: HTTP ${response.status}`);
  }
  return await response.json();
}

async function loadPortalInput({ sampleLimit }) {
  const [spectrumRows, signatureRows] = await Promise.all([
    fetchJson(PORTAL_URLS.spectra),
    fetchJson(PORTAL_URLS.signatures),
  ]);
  const contexts = getExpectedContexts({ profile: "SBS", matrix: 96 });
  const allSpectra = rowsToSampleSpectra(spectrumRows);
  const spectra = Object.fromEntries(Object.entries(allSpectra).slice(0, sampleLimit));
  const signatures = rowsToSignatureMatrix(signatureRows);
  return {
    source: {
      type: "public_fetch",
      urls: PORTAL_URLS,
      fetchedAt: new Date().toISOString(),
      sampleLimit,
    },
    contexts,
    spectra,
    signatures,
  };
}

async function loadLocalInput(inputPath) {
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  return {
    source: {
      type: "local_file",
      path: inputPath,
    },
    ...input,
  };
}

function completeMatrix(matrix, contexts) {
  return Object.fromEntries(
    Object.entries(matrix || {}).map(([rowName, row]) => [
      rowName,
      Object.fromEntries(contexts.map((context) => [context, Number(row?.[context]) || 0])),
    ])
  );
}

async function currentCommit() {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"]);
    return stdout.trim();
  } catch {
    return null;
  }
}
