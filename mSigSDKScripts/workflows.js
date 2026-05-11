import {
  calculateFitResiduals,
  calculateReconstructionError,
  summarizeMissingContexts,
  summarizeMutationBurden,
} from "./qc.js";
import { createAnalysisReport } from "./reports.js";
import {
  compareExtractedToReference,
  extractSignaturesNMF,
} from "./signatureExtraction.js";
import {
  validateExposureMatrix,
  validateSignatureMatrix,
  validateSpectra,
} from "./validation.js";

function createSignatureFitAnalysis({
  spectra,
  signatures,
  exposures,
  parameters = {},
  expectedContexts = null,
  mutationBurdenOptions = {},
  provenance = null,
  reportFormat = "object",
} = {}) {
  const validationOptions = {
    expectedContexts,
    ...(Number.isFinite(mutationBurdenOptions.lowBurdenThreshold)
      ? { minTotalMutations: mutationBurdenOptions.lowBurdenThreshold }
      : {}),
  };
  const validation = {
    spectra: validateSpectra(spectra, validationOptions),
    signatures: validateSignatureMatrix(signatures, { expectedContexts }),
    exposures: validateExposureMatrix(exposures),
  };
  const qc = {
    mutationBurden: summarizeMutationBurden(spectra, {
      expectedContexts,
      ...mutationBurdenOptions,
    }),
    missingContexts: summarizeMissingContexts(spectra, { expectedContexts }),
    reconstructionError: calculateReconstructionError(
      signatures,
      spectra,
      exposures,
      { contexts: expectedContexts }
    ),
    residuals: calculateFitResiduals(signatures, spectra, exposures, {
      contexts: expectedContexts,
    }),
  };

  return {
    validation,
    qc,
    report: createAnalysisReport(
      {
        title: "mSigSDK Signature Fitting Report",
        summary:
          "Signature fitting QC summary with validation, mutation burden, residuals, and reconstruction error.",
        parameters,
        validation,
        qc,
        exposures,
        provenance,
      },
      { format: reportFormat }
    ),
  };
}

function createNMFAnalysis({
  spectra,
  referenceSignatures = null,
  nmfOptions = {},
  parameters = {},
  expectedContexts = null,
  mutationBurdenOptions = {},
  provenance = null,
  reportFormat = "object",
} = {}) {
  const validationOptions = {
    expectedContexts,
    ...(Number.isFinite(mutationBurdenOptions.lowBurdenThreshold)
      ? { minTotalMutations: mutationBurdenOptions.lowBurdenThreshold }
      : {}),
  };
  const validation = {
    spectra: validateSpectra(spectra, validationOptions),
  };
  const extraction = extractSignaturesNMF(spectra, {
    contexts: expectedContexts,
    ...nmfOptions,
  });
  const comparison = referenceSignatures
    ? compareExtractedToReference(extraction, referenceSignatures, {
        contexts: expectedContexts || extraction.contexts,
      })
    : null;
  const qc = {
    mutationBurden: summarizeMutationBurden(spectra, {
      expectedContexts,
      ...mutationBurdenOptions,
    }),
    missingContexts: summarizeMissingContexts(spectra, { expectedContexts }),
    reconstructionError: calculateReconstructionError(
      extraction.signatures,
      spectra,
      extraction.exposures,
      { contexts: expectedContexts || extraction.contexts }
    ),
  };

  return {
    validation,
    extraction,
    comparison,
    qc,
    report: createAnalysisReport(
      {
        title: "mSigSDK NMF Signature Extraction Report",
        summary:
          "NMF signature extraction summary with validation, mutation burden, reconstruction error, and optional reference comparison.",
        parameters: {
          ...parameters,
          nmfOptions,
        },
        validation,
        qc,
        extraction: {
          rank: extraction.rank,
          reconstructionError: extraction.reconstructionError,
          averageSampleCosineSimilarity:
            extraction.averageSampleCosineSimilarity,
          iterations: extraction.iterations,
          converged: extraction.converged,
          bestRun: extraction.bestRun,
          comparison,
        },
        signatures: extraction.signatures,
        exposures: extraction.exposures,
        provenance,
      },
      { format: reportFormat }
    ),
  };
}

export {
  createNMFAnalysis,
  createSignatureFitAnalysis,
};
