import { nnls } from "./utils.js";
import {
  getExpectedContexts,
  getMatrixContexts,
  normalizeMatrixObject,
  toFiniteNumber,
} from "./validation.js";

const EPSILON = 1e-12;

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function dot(a, b) {
  return a.reduce((total, value, index) => total + value * b[index], 0);
}

function cosineSimilarity(a, b) {
  const magnitudeA = Math.sqrt(dot(a, a));
  const magnitudeB = Math.sqrt(dot(b, b));

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dot(a, b) / (magnitudeA * magnitudeB);
}

function inferContexts(...matrices) {
  const sbs96 = getExpectedContexts({ profile: "SBS", matrix: 96 });
  const contexts = getMatrixContexts(...matrices);

  if (
    contexts.length <= sbs96.length &&
    contexts.every((context) => sbs96.includes(context))
  ) {
    return sbs96;
  }

  return contexts;
}

function vectorFromRecord(record, contexts) {
  return contexts.map((context) => {
    const value = toFiniteNumber(record?.[context]);
    return value === null ? 0 : value;
  });
}

function normalizeVector(values, targetTotal = 1) {
  const total = sum(values);
  if (total === 0) {
    return values.map(() => 0);
  }

  return values.map((value) => (value / total) * targetTotal);
}

function summarizeMutationBurden(
  spectra,
  {
    lowBurdenThreshold = 50,
    lowBurdenThresholdMode = "fixed",
    thresholdMode = lowBurdenThresholdMode,
    quantile: thresholdQuantile = 0.25,
    expectedContexts = null,
  } = {}
) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const contexts = expectedContexts || inferContexts(normalizedSpectra);
  const sampleMetrics = Object.entries(normalizedSpectra).map(
    ([sample, spectrum]) => {
      const values = vectorFromRecord(spectrum, contexts);
      const totalMutations = sum(values);
      const nonZeroContexts = values.filter((value) => value > 0).length;
      const maxValue = Math.max(...values, 0);
      const maxIndex = values.indexOf(maxValue);

      return {
        sample,
        totalMutations,
        contexts: contexts.length,
        nonZeroContexts,
        zeroContexts: contexts.length - nonZeroContexts,
        maxContext: contexts[maxIndex] || null,
        maxContextCount: maxValue,
        meanContextCount:
          contexts.length === 0 ? 0 : totalMutations / contexts.length,
      };
    }
  );

  const normalizedThresholdMode =
    thresholdMode === "quantile" || thresholdMode === "none"
      ? thresholdMode
      : "fixed";
  const boundedQuantile = Math.min(Math.max(thresholdQuantile, 0), 1);
  const finiteThreshold = toFiniteNumber(lowBurdenThreshold);
  const nonEmptyTotals = sampleMetrics
    .map((sample) => sample.totalMutations)
    .filter((total) => Number.isFinite(total) && total > 0);
  const resolvedThreshold =
    normalizedThresholdMode === "none"
      ? null
      : normalizedThresholdMode === "quantile"
        ? quantile(nonEmptyTotals, boundedQuantile)
        : finiteThreshold;
  const samples = sampleMetrics.map((sample) => ({
    ...sample,
    flags: {
      emptySpectrum: sample.totalMutations === 0,
      lowBurden:
        Number.isFinite(resolvedThreshold) &&
        sample.totalMutations > 0 &&
        sample.totalMutations < resolvedThreshold,
    },
  }));

  return {
    samples,
    overall: {
      sampleCount: samples.length,
      totalMutations: sum(samples.map((sample) => sample.totalMutations)),
      lowBurdenSampleCount: samples.filter((sample) => sample.flags.lowBurden)
        .length,
      emptySampleCount: samples.filter((sample) => sample.flags.emptySpectrum)
        .length,
      lowBurdenThreshold: resolvedThreshold,
      lowBurdenThresholdMode: normalizedThresholdMode,
      lowBurdenThresholdQuantile:
        normalizedThresholdMode === "quantile" ? boundedQuantile : null,
    },
  };
}

function summarizeMissingContexts(spectra, { expectedContexts = null } = {}) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const contexts = expectedContexts || inferContexts(normalizedSpectra);
  const expectedSet = new Set(contexts);

  const samples = Object.entries(normalizedSpectra).map(
    ([sample, spectrum]) => {
      const observedContexts = Object.keys(spectrum);
      const observedSet = new Set(observedContexts);
      const missingContexts = contexts.filter(
        (context) => !observedSet.has(context)
      );
      const extraContexts = observedContexts.filter(
        (context) => !expectedSet.has(context)
      );

      return {
        sample,
        expectedContextCount: contexts.length,
        observedContextCount: observedContexts.length,
        missingContexts,
        missingCount: missingContexts.length,
        extraContexts,
        extraCount: extraContexts.length,
        percentComplete:
          contexts.length === 0
            ? 0
            : ((contexts.length - missingContexts.length) / contexts.length) *
              100,
      };
    }
  );

  return {
    contexts,
    samples,
    complete: samples.every(
      (sample) => sample.missingCount === 0 && sample.extraCount === 0
    ),
  };
}

function normalizeExposures(
  exposures,
  {
    zeroPolicy = "keep",
    pseudocount = 1e-6,
    relative = true,
    dropBelow = 0,
  } = {}
) {
  const normalizedExposures = normalizeMatrixObject(exposures);
  const signatureNames = getMatrixContexts(normalizedExposures);
  const result = {};

  for (const [sample, exposureRecord] of Object.entries(normalizedExposures)) {
    const row = {};

    for (const signature of signatureNames) {
      let value = exposureRecord[signature] || 0;

      if (zeroPolicy === "pseudocount") {
        value += pseudocount;
      }

      if (zeroPolicy === "drop" && value <= dropBelow) {
        continue;
      }

      row[signature] = value;
    }

    if (relative) {
      const total = sum(Object.values(row));
      if (total > 0) {
        for (const signature of Object.keys(row)) {
          row[signature] /= total;
        }
      }
    }

    result[sample] = row;
  }

  return result;
}

function getExposureScale(exposuresForSample, observedVector, normalizeMode) {
  if (normalizeMode === "relative") {
    return 1;
  }

  if (normalizeMode === "absolute") {
    return null;
  }

  const exposureTotal = sum(Object.values(exposuresForSample || {}));
  const observedTotal = sum(observedVector);

  if (exposureTotal <= 1 + EPSILON && observedTotal > 1) {
    return 1;
  }

  return null;
}

function reconstructVector(signatures, exposuresForSample, contexts) {
  const signatureNames = Object.keys(signatures);
  const reconstructed = Array(contexts.length).fill(0);

  for (const signatureName of signatureNames) {
    const exposure = toFiniteNumber(exposuresForSample?.[signatureName]) || 0;
    const signatureVector = vectorFromRecord(signatures[signatureName], contexts);

    for (let i = 0; i < contexts.length; i++) {
      reconstructed[i] += exposure * signatureVector[i];
    }
  }

  return reconstructed;
}

function calculateResidualMetrics(observed, reconstructed) {
  const residuals = observed.map((value, index) => value - reconstructed[index]);
  const absoluteResiduals = residuals.map((value) => Math.abs(value));
  const squaredResiduals = residuals.map((value) => value * value);
  const l1Error = sum(absoluteResiduals);
  const l2Error = Math.sqrt(sum(squaredResiduals));

  return {
    residuals,
    totalObserved: sum(observed),
    totalReconstructed: sum(reconstructed),
    residualSum: sum(residuals),
    l1Error,
    l2Error,
    rmse:
      residuals.length === 0 ? 0 : Math.sqrt(sum(squaredResiduals) / residuals.length),
    meanAbsoluteError:
      residuals.length === 0 ? 0 : l1Error / residuals.length,
    maxAbsoluteResidual: Math.max(...absoluteResiduals, 0),
    cosineSimilarity: cosineSimilarity(observed, reconstructed),
  };
}

function calculateFitResiduals(
  signatures,
  spectra,
  exposures,
  { contexts = null, normalizeMode = "auto" } = {}
) {
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const normalizedExposures = normalizeMatrixObject(exposures);
  const contextList =
    contexts || inferContexts(normalizedSignatures, normalizedSpectra);

  const samples = Object.keys(normalizedSpectra).map((sample) => {
    let observed = vectorFromRecord(normalizedSpectra[sample], contextList);
    let reconstructed = reconstructVector(
      normalizedSignatures,
      normalizedExposures[sample],
      contextList
    );
    let normalizationModeUsed = normalizeMode;
    const exposureScale = getExposureScale(
      normalizedExposures[sample],
      observed,
      normalizeMode
    );

    if (exposureScale !== null) {
      observed = normalizeVector(observed, exposureScale);
      reconstructed = normalizeVector(reconstructed, exposureScale);
      normalizationModeUsed = "relative";
    } else if (normalizeMode === "relative") {
      observed = normalizeVector(observed, 1);
      reconstructed = normalizeVector(reconstructed, 1);
    } else {
      normalizationModeUsed = "absolute";
    }

    const metrics = calculateResidualMetrics(observed, reconstructed);
    const residualsByContext = Object.fromEntries(
      contextList.map((context, index) => [context, metrics.residuals[index]])
    );

    return {
      sample,
      normalizationMode: normalizationModeUsed,
      observed: Object.fromEntries(
        contextList.map((context, index) => [context, observed[index]])
      ),
      reconstructed: Object.fromEntries(
        contextList.map((context, index) => [context, reconstructed[index]])
      ),
      residuals: residualsByContext,
      metrics: {
        totalObserved: metrics.totalObserved,
        totalReconstructed: metrics.totalReconstructed,
        residualSum: metrics.residualSum,
        l1Error: metrics.l1Error,
        l2Error: metrics.l2Error,
        rmse: metrics.rmse,
        meanAbsoluteError: metrics.meanAbsoluteError,
        maxAbsoluteResidual: metrics.maxAbsoluteResidual,
        cosineSimilarity: metrics.cosineSimilarity,
        cosineDistance: 1 - metrics.cosineSimilarity,
      },
    };
  });

  return {
    contexts: contextList,
    samples,
  };
}

function calculateReconstructionError(signatures, spectra, exposures, options = {}) {
  const residualResult = calculateFitResiduals(
    signatures,
    spectra,
    exposures,
    options
  );

  return {
    contexts: residualResult.contexts,
    samples: residualResult.samples.map((sample) => ({
      sample: sample.sample,
      normalizationMode: sample.normalizationMode,
      ...sample.metrics,
    })),
  };
}

async function fitSingleSpectrumWithNNLS(
  signatures,
  spectrum,
  {
    contexts = null,
    exposureThreshold = 0,
    exposureType = "relative",
    renormalize = true,
  } = {}
) {
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const normalizedSpectrum = normalizeMatrixObject({ sample: spectrum }).sample;
  const contextList =
    contexts || inferContexts(normalizedSignatures, { sample: normalizedSpectrum });
  const signatureNames = Object.keys(normalizedSignatures);
  const signatureVectors = signatureNames.map((signatureName) =>
    vectorFromRecord(normalizedSignatures[signatureName], contextList)
  );
  const spectrumVector = vectorFromRecord(normalizedSpectrum, contextList);
  const nnlsOutput = await nnls(signatureVectors, spectrumVector);
  const rawExposures = Object.fromEntries(
    signatureNames.map((signatureName, index) => [
      signatureName,
      nnlsOutput.x[index] || 0,
    ])
  );
  const totalExposure = sum(Object.values(rawExposures));

  for (const signatureName of signatureNames) {
    const fraction =
      totalExposure === 0 ? 0 : rawExposures[signatureName] / totalExposure;
    if (fraction < exposureThreshold) {
      rawExposures[signatureName] = 0;
    }
  }

  const filteredTotal = sum(Object.values(rawExposures));
  if ((renormalize || exposureType === "relative") && filteredTotal > 0) {
    for (const signatureName of signatureNames) {
      rawExposures[signatureName] /= filteredTotal;
    }
  }

  return rawExposures;
}

async function fitSpectraWithNNLS(signatures, spectra, options = {}) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const exposures = {};

  for (const [sample, spectrum] of Object.entries(normalizedSpectra)) {
    exposures[sample] = await fitSingleSpectrumWithNNLS(
      signatures,
      spectrum,
      options
    );
  }

  return exposures;
}

async function runThresholdSensitivity(
  signatures,
  spectra,
  {
    thresholds = [0, 0.01, 0.03, 0.05, 0.1],
    exposureType = "relative",
    renormalize = true,
    contexts = null,
  } = {}
) {
  const runs = [];

  for (const threshold of thresholds) {
    const exposures = await fitSpectraWithNNLS(signatures, spectra, {
      contexts,
      exposureThreshold: threshold,
      exposureType,
      renormalize,
    });
    const reconstructionError = calculateReconstructionError(
      signatures,
      spectra,
      exposures,
      { contexts, normalizeMode: exposureType === "relative" ? "relative" : "auto" }
    );
    const activeSignatureCounts = Object.values(exposures).map((row) =>
      Object.values(row).filter((value) => value > 0).length
    );

    runs.push({
      threshold,
      exposures,
      reconstructionError,
      averageActiveSignatures:
        activeSignatureCounts.length === 0
          ? 0
          : sum(activeSignatureCounts) / activeSignatureCounts.length,
      averageCosineSimilarity:
        reconstructionError.samples.length === 0
          ? 0
          : sum(
              reconstructionError.samples.map(
                (sample) => sample.cosineSimilarity
              )
            ) / reconstructionError.samples.length,
      averageRmse:
        reconstructionError.samples.length === 0
          ? 0
          : sum(reconstructionError.samples.map((sample) => sample.rmse)) /
            reconstructionError.samples.length,
    });
  }

  return { thresholds, runs };
}

function seededRandom(seed) {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }

  return function random() {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function quantile(values, q) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;

  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }

  return sorted[base];
}

function multinomialResample(vector, random) {
  const total = Math.round(sum(vector));
  if (total <= 0) {
    return vector.map(() => 0);
  }

  const probabilities = normalizeVector(vector, 1);
  const cumulative = [];
  let runningTotal = 0;
  for (const probability of probabilities) {
    runningTotal += probability;
    cumulative.push(runningTotal);
  }

  const counts = vector.map(() => 0);
  for (let i = 0; i < total; i++) {
    const draw = random();
    const index = cumulative.findIndex((value) => draw <= value);
    counts[index === -1 ? counts.length - 1 : index] += 1;
  }

  return counts;
}

async function bootstrapSignatureFit(
  signatures,
  spectrum,
  {
    iterations = 200,
    confidenceLevel = 0.95,
    exposureThreshold = 0,
    exposureType = "relative",
    renormalize = true,
    seed = 123,
    contexts = null,
  } = {}
) {
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const normalizedSpectrum = normalizeMatrixObject({ sample: spectrum }).sample;
  const contextList =
    contexts || inferContexts(normalizedSignatures, { sample: normalizedSpectrum });
  const observedVector = vectorFromRecord(normalizedSpectrum, contextList);
  const random = seededRandom(seed);
  const signatureNames = Object.keys(normalizedSignatures);
  const exposureRows = [];
  const reconstructionRows = [];

  for (let i = 0; i < iterations; i++) {
    const resampledVector = multinomialResample(observedVector, random);
    const resampledSpectrum = Object.fromEntries(
      contextList.map((context, index) => [context, resampledVector[index]])
    );
    const exposures = await fitSingleSpectrumWithNNLS(
      normalizedSignatures,
      resampledSpectrum,
      {
        contexts: contextList,
        exposureThreshold,
        exposureType,
        renormalize,
      }
    );
    exposureRows.push(exposures);

    const reconstructionError = calculateReconstructionError(
      normalizedSignatures,
      { sample: resampledSpectrum },
      { sample: exposures },
      { contexts: contextList, normalizeMode: exposureType }
    );
    reconstructionRows.push(reconstructionError.samples[0]);
  }

  const alpha = 1 - confidenceLevel;
  const signaturesSummary = signatureNames.map((signatureName) => {
    const values = exposureRows.map((row) => row[signatureName] || 0);
    return {
      signatureName,
      mean: sum(values) / values.length,
      median: quantile(values, 0.5),
      lower: quantile(values, alpha / 2),
      upper: quantile(values, 1 - alpha / 2),
      selectionFrequency:
        values.filter((value) => value > 0).length / values.length,
    };
  });

  return {
    iterations,
    confidenceLevel,
    seed,
    contexts: contextList,
    signatures: signaturesSummary,
    exposureSamples: exposureRows,
    reconstructionError: reconstructionRows,
  };
}

export {
  bootstrapSignatureFit,
  calculateFitResiduals,
  calculateReconstructionError,
  fitSpectraWithNNLS,
  normalizeExposures,
  runThresholdSensitivity,
  summarizeMissingContexts,
  summarizeMutationBurden,
};
