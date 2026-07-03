// Paste this into a modern browser developer console.
// It fetches public PCAWG Lung-AdenoCA SBS96 spectra and COSMIC v3 SBS96
// signatures, fits one public sample locally in the browser, and prints a
// compact QC summary. User-supplied spectra are not required for this demo.

const { mSigSDK } = await import("https://episphere.github.io/msig/main.js");

const contexts = mSigSDK.validation.getExpectedContexts({
  profile: "SBS",
  matrix: 96,
});

const [spectrumRows, signatureRows] = await Promise.all([
  mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData(
    "PCAWG",
    null,
    "WGS",
    "Lung-AdenoCA",
    "SBS",
    96
  ),
  mSigSDK.mSigPortal.mSigPortalData.getMutationalSignaturesData(
    "WGS",
    "COSMIC_v3_Signatures_GRCh37_SBS96",
    "SBS",
    96,
    10000
  ),
]);

const spectra = mSigSDK.validation.rowsToSampleSpectra(spectrumRows);
const signatures = mSigSDK.validation.rowsToSignatureMatrix(signatureRows);
const sampleName = Object.keys(spectra)[0];
const sampleSpectrum = { [sampleName]: spectra[sampleName] };

const exposures = await mSigSDK.qc.fitSpectraWithNNLS(
  signatures,
  sampleSpectrum,
  { contexts, exposureType: "relative", renormalize: true }
);

const reconstruction = mSigSDK.qc.calculateReconstructionError(
  signatures,
  sampleSpectrum,
  exposures,
  { contexts, normalizeMode: "relative" }
);

const bootstrap = await mSigSDK.qc.bootstrapSignatureFitParallel(
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

console.table(
  Object.entries(exposures[sampleName])
    .filter(([, value]) => value > 0.01)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([signature, exposure]) => ({
      sample: sampleName,
      signature,
      exposure,
    }))
);

console.log({
  sampleName,
  signatureCount: Object.keys(signatures).length,
  contextCount: contexts.length,
  cosineSimilarity: reconstruction.samples[0].cosineSimilarity,
  bootstrapMode: bootstrap.parallelization?.mode || "serial",
  bootstrapWorkers: bootstrap.parallelization?.workerCount || 0,
});
