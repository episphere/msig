#!/usr/bin/env node

import {
  bootstrapSignatureFitParallel,
  calculateReconstructionError,
  fitSpectraWithNNLS,
} from "../mSigSDKScripts/qc.js";
import {
  getExpectedContexts,
  rowsToSampleSpectra,
  rowsToSignatureMatrix,
} from "../mSigSDKScripts/validation.js";

const URLS = {
  spectra:
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum?study=PCAWG&cancer=Lung-AdenoCA&strategy=WGS&profile=SBS&matrix=96&offset=0",
  signatures:
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature?source=Reference_signatures&strategy=WGS&profile=SBS&matrix=96&signatureSetName=COSMIC_v3_Signatures_GRCh37_SBS96&limit=10000&offset=0",
};

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return await response.json();
}

const contexts = getExpectedContexts({ profile: "SBS", matrix: 96 });
const [spectrumRows, signatureRows] = await Promise.all([
  fetchJson(URLS.spectra),
  fetchJson(URLS.signatures),
]);

const spectra = rowsToSampleSpectra(spectrumRows);
const signatures = rowsToSignatureMatrix(signatureRows);
const sampleName = process.argv[2] || Object.keys(spectra)[0];

if (!spectra[sampleName]) {
  throw new Error(`Sample not found: ${sampleName}`);
}

const sampleSpectrum = { [sampleName]: spectra[sampleName] };
const startedAt = performance.now();
const exposures = await fitSpectraWithNNLS(signatures, sampleSpectrum, {
  contexts,
  exposureType: "relative",
  renormalize: true,
});
const reconstruction = calculateReconstructionError(
  signatures,
  sampleSpectrum,
  exposures,
  { contexts, normalizeMode: "relative" }
);
const bootstrap = await bootstrapSignatureFitParallel(
  signatures,
  spectra[sampleName],
  {
    contexts,
    iterations: 100,
    seed: 20260627,
    workerCount: 4,
    minIterationsForParallel: 50,
  }
);
const elapsedMs = performance.now() - startedAt;

const topExposures = Object.entries(exposures[sampleName])
  .filter(([, value]) => value > 0.01)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([signature, exposure]) => ({ signature, exposure }));

console.log(
  JSON.stringify(
    {
      sampleName,
      signatureCount: Object.keys(signatures).length,
      contextCount: contexts.length,
      cosineSimilarity: reconstruction.samples[0].cosineSimilarity,
      bootstrapMode: bootstrap.parallelization?.mode || "serial",
      bootstrapWorkers: bootstrap.parallelization?.workerCount || 0,
      elapsedMs,
      topExposures,
    },
    null,
    2
  )
);
