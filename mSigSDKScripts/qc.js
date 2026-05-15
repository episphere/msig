import {
  inferMutationContexts as inferContexts,
  vectorFromRecord,
} from "./matrix.js";
import {
  EPSILON,
  cosineSimilarity,
  normalizeVector,
  quantile,
  seededRandom,
  sum,
} from "./numerics.js";
import {
  getMatrixContexts,
  normalizeMatrixObject,
  toFiniteNumber,
} from "./validation.js";

const QC_RESULT_SCHEMA_VERSION = "msig.qc.v0.3";

const QC_DEFAULTS = Object.freeze({
  mutationBurden: Object.freeze({
    lowBurdenThreshold: 50,
    lowBurdenThresholdMode: "fixed",
    quantile: 0.25,
    moderateBurdenThreshold: 1000,
  }),
  sampleSelection: Object.freeze({
    limit: 10,
    minTotalMutations: 0,
    maxTotalMutations: Infinity,
    sampleNames: null,
    order: "desc",
    includeEmpty: false,
  }),
  exposureNormalization: Object.freeze({
    zeroPolicy: "keep",
    pseudocount: 1e-6,
    relative: true,
    dropBelow: 0,
  }),
  residuals: Object.freeze({
    normalizeMode: "auto",
    lowBurdenThreshold: 100,
    moderateBurdenThreshold: 1000,
    weakUnexplainedThreshold: 0.07,
    highResidualStructureCosineThreshold: 0.85,
  }),
  nnls: Object.freeze({
    exposureThreshold: 0,
    exposureType: "relative",
    renormalize: true,
    maxIterations: null,
    convergenceTolerance: 1e-10,
  }),
  thresholdSensitivity: Object.freeze({
    thresholds: Object.freeze([0, 0.01, 0.03, 0.05, 0.1]),
    baselineThreshold: null,
    instabilityL1Threshold: null,
    activeSetJaccardThreshold: null,
    exposureType: "relative",
    renormalize: true,
    contexts: null,
    maxIterations: null,
    convergenceTolerance: 1e-10,
  }),
  bootstrap: Object.freeze({
    iterations: 200,
    confidenceLevel: 0.95,
    exposureThreshold: 0,
    exposureType: "relative",
    renormalize: true,
    seed: 123,
    contexts: null,
    minIterationsForStableIntervals: 500,
    publicationRecommendedIterations: 1000,
    minMutationsForBootstrapSummary: 50,
    maxIterations: null,
    convergenceTolerance: 1e-10,
  }),
});

const QC_WARNING_CODES = {
  CONTEXT_MISMATCH: "CONTEXT_MISMATCH",
  CONTEXT_FETCH_FAILED: "CONTEXT_FETCH_FAILED",
  EMPTY_SPECTRUM: "EMPTY_SPECTRUM",
  HIGH_RESIDUAL_STRUCTURE: "HIGH_RESIDUAL_STRUCTURE",
  LOW_BURDEN: "LOW_BURDEN",
  LOW_BOOTSTRAP_ITERATIONS: "LOW_BOOTSTRAP_ITERATIONS",
  THRESHOLD_GRID_TOO_SMALL: "THRESHOLD_GRID_TOO_SMALL",
  THRESHOLD_DEPENDENT_FIT: "THRESHOLD_DEPENDENT_FIT",
};

const QC_SCOPE_STATEMENTS = {
  mutationBurden:
    "Descriptive sample-level mutation-count summary. Burden review cues are configurable QC prompts and do not classify biological validity.",
  contextCoverage:
    "Structural context-completeness check for matrix compatibility. Missing or extra contexts identify input-format issues, not biological absence.",
  residuals:
    "Observed-versus-reconstructed residual summary for a supplied fit. Residuals are diagnostic differences and do not identify missing or causal signatures by themselves.",
  reconstruction:
    "Reconstruction-quality summary for a supplied fit. Cosine similarity, RMSE, and residual metrics describe fit geometry, not exposure correctness.",
  thresholdSensitivity:
    "Exposure-threshold sensitivity analysis. Results describe drift across user-specified thresholds and do not select a universal cutoff.",
  bootstrap:
    "Parametric multinomial bootstrap summary of statistical uncertainty conditional on the observed spectrum, supplied catalog, and fitting settings. Intervals do not estimate total biological uncertainty, catalog uncertainty, or systematic assay error.",
};

const QC_METHOD_BASIS = {
  mutationBurden:
    "Mutation burden affects sampling variability in mutational-signature fitting. Thresholds are configurable analysis defaults and should be justified for the assay and cohort.",
  contextCoverage:
    "Signature matrices and spectra must share the expected context basis before fitting, residual calculation, or visualization.",
  reconstructionResidual:
    "Known-signature fitting is evaluated with reconstruction geometry and residual structure in addition to exposure estimates.",
  thresholdSensitivity:
    "Threshold sweeps refit or re-threshold the same model across user-defined exposure cutoffs to show how active signatures and reconstruction metrics change.",
  bootstrap:
    "Bootstrap resampling draws multinomial spectra from the observed count vector and refits each draw to estimate sampling-driven exposure variability.",
};

const QC_LITERATURE_REFERENCES = {
  alexandrov2020: {
    key: "Alexandrov2020",
    doi: "10.1038/s41586-020-1943-3",
    url: "https://doi.org/10.1038/s41586-020-1943-3",
  },
  koh2021: {
    key: "Koh2021",
    doi: "10.1038/s41568-021-00377-7",
    url: "https://doi.org/10.1038/s41568-021-00377-7",
  },
  degasperi2020: {
    key: "Degasperi2020",
    doi: "10.1038/s43018-020-0027-5",
    url: "https://doi.org/10.1038/s43018-020-0027-5",
  },
  medo2024: {
    key: "Medo2024",
    doi: "10.1038/s41467-024-53711-6",
    url: "https://doi.org/10.1038/s41467-024-53711-6",
  },
  jin2024: {
    key: "Jin2024",
    doi: "10.1038/s41588-024-01659-0",
    url: "https://doi.org/10.1038/s41588-024-01659-0",
  },
  wu2023: {
    key: "Wu2023",
    doi: "10.1093/bib/bbad331",
    url: "https://doi.org/10.1093/bib/bbad331",
  },
  huang2018: {
    key: "Huang2018",
    doi: "10.1093/bioinformatics/btx604",
    url: "https://doi.org/10.1093/bioinformatics/btx604",
  },
  lawsonHanson1995: {
    key: "LawsonHanson1995",
    doi: "10.1137/1.9781611971217",
    url: "https://doi.org/10.1137/1.9781611971217",
  },
  lawrence2021: {
    key: "Lawrence2021",
    doi: "10.5858/arpa.2020-0536-OA",
    url: "https://doi.org/10.5858/arpa.2020-0536-OA",
  },
  senkin2021: {
    key: "Senkin2021MSA",
    doi: "10.1186/s12859-021-04450-8",
    url: "https://doi.org/10.1186/s12859-021-04450-8",
  },
};

const QC_WARNING_RESOLUTIONS = {
  [QC_WARNING_CODES.CONTEXT_MISMATCH]:
    "Verify the input context basis and regenerate spectra with the expected SBS96, DBS, or ID context list before fitting.",
  [QC_WARNING_CODES.CONTEXT_FETCH_FAILED]:
    "Pin the genome build, inspect failed variants, and rerun MAF conversion or supply precomputed contexts.",
  [QC_WARNING_CODES.EMPTY_SPECTRUM]:
    "Exclude the sample from signature fitting or verify that the selected context basis and sample grouping are correct.",
  [QC_WARNING_CODES.HIGH_RESIDUAL_STRUCTURE]:
    "Inspect residual spectra, run catalog-sufficiency screening, and consider expanding the reference catalog or de novo extraction in an adequately powered cohort.",
  [QC_WARNING_CODES.LOW_BURDEN]:
    "Interpret fitted exposures with caution and consult the analysis strategy advisor, threshold sensitivity, and bootstrap intervals before reporting.",
  [QC_WARNING_CODES.LOW_BOOTSTRAP_ITERATIONS]:
    "Increase bootstrap iterations; use at least 500 for review and 1000 for publication-grade uncertainty intervals.",
  [QC_WARNING_CODES.THRESHOLD_GRID_TOO_SMALL]:
    "Use at least three exposure thresholds spanning the intended reporting cutoff range.",
  [QC_WARNING_CODES.THRESHOLD_DEPENDENT_FIT]:
    "Run bootstrap uncertainty if not already performed and report threshold-dependent signatures with explicit caveats.",
};

const SYNTHETIC_VALIDATION_ANCHORS = {
  burden50: {
    table: "Table 2 synthetic signature validation",
    burden: 50,
    samples: 64,
    exposureCosineMean: 0.912,
    reconstructionCosineMean: 0.884,
    activeRecallMean: 0.938,
    inactiveSignatureCallsMean: 0.165,
  },
  burden100: {
    table: "Table 2 synthetic signature validation",
    burden: 100,
    samples: 64,
    exposureCosineMean: 0.952,
    reconstructionCosineMean: 0.93,
    activeRecallMean: 0.979,
    inactiveSignatureCallsMean: 0.129,
  },
};

function makeQcWarning(code, message, details = {}) {
  return {
    code,
    message,
    details,
    resolution: QC_WARNING_RESOLUTIONS[code] || null,
  };
}

function methodBasis({
  description,
  references = [],
  configurableDefaults = {},
  version = QC_RESULT_SCHEMA_VERSION,
  ...extra
} = {}) {
  return {
    version,
    description,
    references,
    configurableDefaults,
    ...extra,
  };
}

function classifyBurden(
  totalMutations,
  lowThreshold = QC_DEFAULTS.mutationBurden.lowBurdenThreshold,
  moderateThreshold = QC_DEFAULTS.mutationBurden.moderateBurdenThreshold
) {
  if (!Number.isFinite(totalMutations) || totalMutations <= 0) {
    return "empty";
  }
  if (Number.isFinite(lowThreshold) && totalMutations < lowThreshold) {
    return "low";
  }
  if (Number.isFinite(moderateThreshold) && totalMutations < moderateThreshold) {
    return "moderate";
  }
  return "high";
}

/**
 * Summarizes per-sample mutation burden and raises review cues for low-burden spectra.
 *
 * @function summarizeMutationBurden
 * @memberof qc
 * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
 * @param {Object} [options] - Burden summary options.
 * @param {number} [options.lowBurdenThreshold=50] - Fixed low-burden cutoff.
 * @param {string} [options.lowBurdenThresholdMode="fixed"] - Threshold mode: "fixed", "quantile", or "none".
 * @param {string} [options.thresholdMode] - Alias for lowBurdenThresholdMode.
 * @param {number} [options.quantile=0.25] - Quantile used when threshold mode is "quantile".
 * @param {string[]} [options.expectedContexts=null] - Expected context order.
 * @returns {Object} Sample-level burden metrics and overall summary counts.
 * @example
 * const burden = mSigSDK.qc.summarizeMutationBurden(groupedSpectra, {
 *   lowBurdenThresholdMode: "fixed",
 *   lowBurdenThreshold: 100,
 * });
 */
function summarizeMutationBurden(
  spectra,
  {
    lowBurdenThreshold = QC_DEFAULTS.mutationBurden.lowBurdenThreshold,
    lowBurdenThresholdMode = QC_DEFAULTS.mutationBurden.lowBurdenThresholdMode,
    thresholdMode = lowBurdenThresholdMode,
    quantile: thresholdQuantile = QC_DEFAULTS.mutationBurden.quantile,
    expectedContexts = null,
    moderateBurdenThreshold = QC_DEFAULTS.mutationBurden.moderateBurdenThreshold,
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
    burdenClass: classifyBurden(
      sample.totalMutations,
      resolvedThreshold,
      moderateBurdenThreshold
    ),
    burdenInterpretation:
      sample.totalMutations === 0
        ? "empty_spectrum"
        : Number.isFinite(resolvedThreshold) &&
            sample.totalMutations < resolvedThreshold
          ? "below_configured_threshold"
          : "passes_configured_threshold_or_no_threshold",
    flags: {
      emptySpectrum: sample.totalMutations === 0,
      lowBurden:
        Number.isFinite(resolvedThreshold) &&
        sample.totalMutations > 0 &&
        sample.totalMutations < resolvedThreshold,
    },
    recommendedAction:
      sample.totalMutations === 0
        ? "Verify sample grouping and context generation before running signature fitting."
        : Number.isFinite(resolvedThreshold) &&
            sample.totalMutations < resolvedThreshold
          ? "Consult recommendAnalysisStrategy before interpreting fitted exposures; use threshold sensitivity and bootstrap intervals if fitting is still performed."
          : "Proceed with downstream fitting or review using the analysis strategy advisor and attached QC outputs.",
  }));
  const warnings = samples.flatMap((sample) => {
    if (sample.flags.emptySpectrum) {
      return [
        makeQcWarning(
          QC_WARNING_CODES.EMPTY_SPECTRUM,
          `${sample.sample} has no observed mutations in the selected context basis.`,
          { sample: sample.sample }
        ),
      ];
    }
    if (sample.flags.lowBurden) {
      return [
        makeQcWarning(
          QC_WARNING_CODES.LOW_BURDEN,
          `${sample.sample} is below the configured low-burden threshold.`,
          {
            sample: sample.sample,
            totalMutations: sample.totalMutations,
            lowBurdenThreshold: resolvedThreshold,
          }
        ),
      ];
    }
    return [];
  });

  return {
    schemaVersion: QC_RESULT_SCHEMA_VERSION,
    workflowRole: "mutation_burden_qc",
    scopeStatement: QC_SCOPE_STATEMENTS.mutationBurden,
    methodBasis: methodBasis({
      description: QC_METHOD_BASIS.mutationBurden,
      thresholdBasis:
        "The low-burden threshold is a configurable QC setting. It is reported so downstream text can distinguish configured review defaults from literature-derived cutoffs.",
      thresholdRationale:
        "The default 50-mutation low-burden review cue is anchored to the SDK synthetic validation table: 50 mutations had mean exposure cosine 0.912 and mean reconstruction cosine 0.884, while 100 mutations improved to 0.952 and 0.930, respectively.",
      validationAnchor: [
        SYNTHETIC_VALIDATION_ANCHORS.burden50,
        SYNTHETIC_VALIDATION_ANCHORS.burden100,
      ],
      configurableDefaults: {
        lowBurdenThreshold,
        resolvedLowBurdenThreshold: resolvedThreshold,
        lowBurdenThresholdMode: normalizedThresholdMode,
        quantile: normalizedThresholdMode === "quantile" ? boundedQuantile : null,
        moderateBurdenThreshold,
      },
      references: [
        QC_LITERATURE_REFERENCES.koh2021,
        QC_LITERATURE_REFERENCES.medo2024,
        QC_LITERATURE_REFERENCES.lawrence2021,
      ],
    }),
    thresholdRationale:
      "The default 50-mutation low-burden review cue is anchored to the SDK synthetic validation table: 50 mutations had mean exposure cosine 0.912 and mean reconstruction cosine 0.884, while 100 mutations improved to 0.952 and 0.930, respectively.",
    validationAnchor: [
      SYNTHETIC_VALIDATION_ANCHORS.burden50,
      SYNTHETIC_VALIDATION_ANCHORS.burden100,
    ],
    contexts,
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
    warnings,
  };
}

/**
 * Selects sample-level burden records for teaching, reporting, or analysis.
 *
 * @function selectSamplesByMutationBurden
 * @memberof qc
 * @param {Object} burdenSummary - Result from summarizeMutationBurden.
 * @param {Object} [options] - Selection options.
 * @param {number} [options.limit=10] - Maximum number of samples to return.
 * @param {number} [options.minTotalMutations=0] - Inclusive lower burden bound.
 * @param {number} [options.maxTotalMutations=Infinity] - Inclusive upper burden bound.
 * @param {string[]} [options.sampleNames=null] - Optional allow-list of sample names.
 * @param {string} [options.order="desc"] - Sort order: "desc" or "asc".
 * @param {boolean} [options.includeEmpty=false] - Include zero-burden spectra.
 * @returns {Object[]} Selected sample records from the burden summary.
 * @example
 * const selected = mSigSDK.qc.selectSamplesByMutationBurden(burden, {
 *   minTotalMutations: 1000,
 *   limit: 8,
 * });
 */
function selectSamplesByMutationBurden(
  burdenSummary,
  {
    limit = QC_DEFAULTS.sampleSelection.limit,
    minTotalMutations = QC_DEFAULTS.sampleSelection.minTotalMutations,
    maxTotalMutations = QC_DEFAULTS.sampleSelection.maxTotalMutations,
    sampleNames = QC_DEFAULTS.sampleSelection.sampleNames,
    order = QC_DEFAULTS.sampleSelection.order,
    includeEmpty = QC_DEFAULTS.sampleSelection.includeEmpty,
  } = {}
) {
  const samples = Array.isArray(burdenSummary?.samples)
    ? burdenSummary.samples
    : [];
  const allowedSamples = Array.isArray(sampleNames)
    ? new Set(sampleNames)
    : null;
  const minBurden = toFiniteNumber(minTotalMutations);
  const maxBurdenValue = toFiniteNumber(maxTotalMutations);
  const maxBurden = maxBurdenValue === null ? Infinity : maxBurdenValue;
  const limitValue = toFiniteNumber(limit);
  const boundedLimit = limitValue !== null
    ? Math.max(0, Math.floor(limitValue))
    : null;
  const sortDirection = order === "asc" ? 1 : -1;

  const selected = samples
    .filter((sample) => {
      const total = toFiniteNumber(sample.totalMutations);
      if (allowedSamples && !allowedSamples.has(sample.sample)) {
        return false;
      }
      if (total === null) {
        return false;
      }
      if (!includeEmpty && total <= 0) {
        return false;
      }
      if (minBurden !== null && total < minBurden) {
        return false;
      }
      if (total > maxBurden) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aTotal = toFiniteNumber(a.totalMutations) || 0;
      const bTotal = toFiniteNumber(b.totalMutations) || 0;
      const totalSort = (aTotal - bTotal) * sortDirection;
      if (totalSort !== 0) {
        return totalSort;
      }
      return String(a.sample).localeCompare(String(b.sample));
    });

  return boundedLimit === null ? selected : selected.slice(0, boundedLimit);
}

/**
 * Reports missing and extra mutation contexts for each sample spectrum.
 *
 * @function summarizeMissingContexts
 * @memberof qc
 * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
 * @param {Object} [options] - Context coverage options.
 * @param {string[]} [options.expectedContexts=null] - Expected context list.
 * @returns {Object} Context coverage result with sample-level missing and extra contexts.
 */
function summarizeMissingContexts(spectra, { expectedContexts = null } = {}) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const contexts = expectedContexts || inferContexts(normalizedSpectra);
  const expectedSet = new Set(contexts);

  const samples = Object.entries(normalizedSpectra).map(
    ([sample, spectrum]) => {
      const observedContexts = Object.keys(spectrum);
      const observedSet = new Set(observedContexts);
      const structurallyMissingContexts = contexts.filter(
        (context) => !observedSet.has(context)
      );
      const unobservedContexts = contexts.filter(
        (context) => observedSet.has(context) && (toFiniteNumber(spectrum[context]) || 0) === 0
      );
      const extraContexts = observedContexts.filter(
        (context) => !expectedSet.has(context)
      );

      return {
        sample,
        expectedContextCount: contexts.length,
        observedContextCount: observedContexts.length,
        structurallyMissingContexts,
        structurallyMissingCount: structurallyMissingContexts.length,
        unobservedContexts,
        unobservedCount: unobservedContexts.length,
        missingContexts: structurallyMissingContexts,
        missingCount: structurallyMissingContexts.length,
        extraContexts,
        extraCount: extraContexts.length,
        percentComplete:
          contexts.length === 0
            ? 0
            : ((contexts.length - structurallyMissingContexts.length) / contexts.length) *
              100,
      };
    }
  );
  const warnings = samples
    .filter((sample) => sample.missingCount > 0 || sample.extraCount > 0)
    .map((sample) =>
      makeQcWarning(
        QC_WARNING_CODES.CONTEXT_MISMATCH,
        `${sample.sample} has missing or extra mutation contexts relative to the expected basis.`,
        {
          sample: sample.sample,
          structurallyMissingCount: sample.structurallyMissingCount,
          unobservedCount: sample.unobservedCount,
          extraCount: sample.extraCount,
        }
      )
    );

  return {
    schemaVersion: QC_RESULT_SCHEMA_VERSION,
    workflowRole: "context_coverage_qc",
    scopeStatement: QC_SCOPE_STATEMENTS.contextCoverage,
    methodBasis: methodBasis({
      description: QC_METHOD_BASIS.contextCoverage,
      expectedContextBasis:
        expectedContexts ? "caller_supplied_expected_contexts" : "inferred_from_input_matrix",
      zeroCountBoundary:
        "Zero-count contexts are expected in low-burden SBS96 spectra and do not indicate a data-structure error when the context key is present.",
      configurableDefaults: {
        expectedContextCount: contexts.length,
      },
      references: [QC_LITERATURE_REFERENCES.alexandrov2020],
    }),
    contexts,
    samples,
    complete: samples.every(
      (sample) => sample.missingCount === 0 && sample.extraCount === 0
    ),
    warnings,
  };
}

/**
 * Normalizes an exposure matrix for downstream QC and reporting.
 *
 * @function normalizeExposures
 * @memberof qc
 * @param {Object<string,Object<string,number>>} exposures - Sample-by-signature exposure matrix.
 * @param {Object} [options] - Normalization options.
 * @param {string} [options.zeroPolicy="keep"] - Zero handling: "keep", "pseudocount", or "drop".
 * @param {number} [options.pseudocount=1e-6] - Value added when zeroPolicy is "pseudocount".
 * @param {boolean} [options.relative=true] - Normalize each sample to sum to one.
 * @param {number} [options.dropBelow=0] - Drop exposures at or below this value when zeroPolicy is "drop".
 * @returns {Object<string,Object<string,number>>} Normalized exposure matrix.
 */
function normalizeExposures(
  exposures,
  {
    zeroPolicy = QC_DEFAULTS.exposureNormalization.zeroPolicy,
    pseudocount = QC_DEFAULTS.exposureNormalization.pseudocount,
    relative = QC_DEFAULTS.exposureNormalization.relative,
    dropBelow = QC_DEFAULTS.exposureNormalization.dropBelow,
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

function reconstructVectorFromPrepared(
  signatureNames,
  signatureVectors,
  exposuresForSample,
  contextCount
) {
  const reconstructed = Array(contextCount).fill(0);

  for (let signatureIndex = 0; signatureIndex < signatureNames.length; signatureIndex++) {
    const exposure =
      toFiniteNumber(exposuresForSample?.[signatureNames[signatureIndex]]) || 0;
    if (exposure === 0) {
      continue;
    }
    const signatureVector = signatureVectors[signatureIndex];
    for (let contextIndex = 0; contextIndex < contextCount; contextIndex++) {
      reconstructed[contextIndex] += exposure * signatureVector[contextIndex];
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

/**
 * Calculates observed, reconstructed, and residual spectra for fitted exposures.
 *
 * @function calculateFitResiduals
 * @memberof qc
 * @param {Object<string,Object<string,number>>} signatures - Signature-by-context matrix.
 * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
 * @param {Object<string,Object<string,number>>} exposures - Sample-by-signature exposure matrix.
 * @param {Object} [options] - Residual options.
 * @param {string[]} [options.contexts=null] - Context order to use.
 * @param {string} [options.normalizeMode="auto"] - "auto", "relative", or "absolute" normalization.
 * @returns {Object} Residual object with contexts and per-sample metrics.
 */
function calculateFitResiduals(
  signatures,
  spectra,
  exposures,
  {
    contexts = null,
    normalizeMode = QC_DEFAULTS.residuals.normalizeMode,
    lowBurdenThreshold = QC_DEFAULTS.residuals.lowBurdenThreshold,
    moderateBurdenThreshold = QC_DEFAULTS.residuals.moderateBurdenThreshold,
    weakUnexplainedThreshold = QC_DEFAULTS.residuals.weakUnexplainedThreshold,
    highResidualStructureCosineThreshold =
      QC_DEFAULTS.residuals.highResidualStructureCosineThreshold,
  } = {}
) {
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const normalizedExposures = normalizeMatrixObject(exposures);
  const contextList =
    contexts || inferContexts(normalizedSignatures, normalizedSpectra);
  const signatureNames = Object.keys(normalizedSignatures);
  const signatureVectors = signatureNames.map((signatureName) =>
    vectorFromRecord(normalizedSignatures[signatureName], contextList)
  );

  const samples = Object.keys(normalizedSpectra).map((sample) => {
    let observed = vectorFromRecord(normalizedSpectra[sample], contextList);
    const rawTotalObserved = sum(observed);
    let reconstructed = reconstructVectorFromPrepared(
      signatureNames,
      signatureVectors,
      normalizedExposures[sample],
      contextList.length
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
    const relativeUnexplainedFraction =
      normalizationModeUsed === "relative" ? metrics.l1Error / 2 : null;
    const positiveResidualVector = metrics.residuals.map((value) =>
      Math.max(value, 0)
    );
    const residualMatches = signatureNames
      .map((signatureName, index) => ({
        signatureName,
        cosineSimilarity: cosineSimilarity(
          positiveResidualVector,
          signatureVectors[index]
        ),
      }))
      .sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);
    const nearestResidualMatch = residualMatches[0] || null;
    const highResidualStructure =
      Number.isFinite(relativeUnexplainedFraction) &&
      relativeUnexplainedFraction >= weakUnexplainedThreshold &&
      (nearestResidualMatch?.cosineSimilarity || 0) >=
        highResidualStructureCosineThreshold;
    const burdenClass = classifyBurden(
      rawTotalObserved,
      lowBurdenThreshold,
      moderateBurdenThreshold
    );
    const warnings = highResidualStructure
      ? [
          makeQcWarning(
            QC_WARNING_CODES.HIGH_RESIDUAL_STRUCTURE,
            `${sample} has positive residual structure above the configured cosine threshold.`,
            {
              sample,
              relativeUnexplainedFraction,
              weakUnexplainedThreshold,
              nearestResidualMatch,
              highResidualStructureCosineThreshold,
            }
          ),
        ]
      : [];
    const residualsByContext = Object.fromEntries(
      contextList.map((context, index) => [context, metrics.residuals[index]])
    );

    return {
      sample,
      normalizationMode: normalizationModeUsed,
      normalizeModeRequested: normalizeMode,
      totalMutations: rawTotalObserved,
      burdenClass,
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
        relativeUnexplainedFraction,
      },
      residualStructure: {
        highResidualStructure,
        triggerCondition:
          "relativeUnexplainedFraction >= weakUnexplainedThreshold and cosine(positiveResidualVector, nearestReferenceSignature) >= highResidualStructureCosineThreshold",
        weakUnexplainedThreshold,
        highResidualStructureCosineThreshold,
        nearestResidualMatch,
        residualMatches: residualMatches.slice(0, 5),
      },
      interpretation:
        "Residual values are observed minus reconstructed context contributions under the supplied exposure model.",
      warnings,
      recommendedActions: [
        highResidualStructure
          ? "Run detectOutOfReferenceSignal or expand the reference catalog before interpreting residual-matched patterns."
          : "Review residuals alongside reconstruction error, burden class, and signature ambiguity.",
      ],
    };
  });

  return {
    schemaVersion: QC_RESULT_SCHEMA_VERSION,
    workflowRole: "fit_residual_qc",
    scopeStatement: QC_SCOPE_STATEMENTS.residuals,
    methodBasis: methodBasis({
      description: QC_METHOD_BASIS.reconstructionResidual,
      residualDefinition:
        "For each context, residual = observed - reconstructed. Relative unexplained fraction is L1 residual error divided by 2 when spectra are normalized to sum to one.",
      normalizeMode:
        "Residual interpretation depends on normalizeMode. Relative mode compares normalized spectra and exposures; absolute mode leaves count scale intact when exposures are supplied on count scale.",
      highResidualStructureTrigger:
        "HIGH_RESIDUAL_STRUCTURE fires when relativeUnexplainedFraction is at least weakUnexplainedThreshold and the positive residual vector has cosine similarity to any supplied reference signature at or above highResidualStructureCosineThreshold.",
      configurableDefaults: {
        normalizeMode,
        lowBurdenThreshold,
        moderateBurdenThreshold,
        weakUnexplainedThreshold,
        highResidualStructureCosineThreshold,
      },
      references: [
        QC_LITERATURE_REFERENCES.koh2021,
        QC_LITERATURE_REFERENCES.medo2024,
      ],
    }),
    contexts: contextList,
    samples,
    warnings: samples.flatMap((sample) => sample.warnings),
    recommendedActions: [
      "Use detectOutOfReferenceSignal for burden-conditioned catalog-sufficiency screening when residual structure is present.",
    ],
  };
}

/**
 * Summarizes reconstruction error metrics for fitted spectra.
 *
 * @function calculateReconstructionError
 * @memberof qc
 * @param {Object<string,Object<string,number>>} signatures - Signature-by-context matrix.
 * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
 * @param {Object<string,Object<string,number>>} exposures - Sample-by-signature exposure matrix.
 * @param {Object} [options] - Options passed to calculateFitResiduals.
 * @returns {Object} Per-sample cosine similarity, RMSE, and related residual metrics.
 */
function calculateReconstructionError(signatures, spectra, exposures, options = {}) {
  const residualResult = calculateFitResiduals(
    signatures,
    spectra,
    exposures,
    options
  );

  return {
    schemaVersion: QC_RESULT_SCHEMA_VERSION,
    workflowRole: "reconstruction_error_qc",
    scopeStatement: QC_SCOPE_STATEMENTS.reconstruction,
    methodBasis: methodBasis({
      description: QC_METHOD_BASIS.reconstructionResidual,
      compactOutputRationale:
        "calculateReconstructionError is a compact convenience view over calculateFitResiduals for dashboards, tables, and screening workflows that do not need per-context observed and residual vectors.",
      interpretationBoundary:
        "High reconstruction cosine can coexist with incorrect exposure attribution when catalog signatures are confusable or incomplete, as shown by assignment-heterogeneity and likelihood-based signature-selection studies.",
      configurableDefaults: {
        normalizeMode: options.normalizeMode ?? QC_DEFAULTS.residuals.normalizeMode,
      },
      references: [
        QC_LITERATURE_REFERENCES.koh2021,
        QC_LITERATURE_REFERENCES.medo2024,
        QC_LITERATURE_REFERENCES.wu2023,
        QC_LITERATURE_REFERENCES.jin2024,
      ],
    }),
    contexts: residualResult.contexts,
    samples: residualResult.samples.map((sample) => ({
      sample: sample.sample,
      normalizationMode: sample.normalizationMode,
      ...sample.metrics,
    })),
  };
}

function prepareNNLSFitter(signatures, spectra = null, contexts = null) {
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const normalizedSpectra = spectra ? normalizeMatrixObject(spectra) : null;
  const contextList =
    contexts || inferContexts(normalizedSignatures, normalizedSpectra || {});
  const signatureNames = Object.keys(normalizedSignatures);
  const signatureVectors = signatureNames.map((signatureName) =>
    vectorFromRecord(normalizedSignatures[signatureName], contextList)
  );
  const gram = signatureVectors.map((left) =>
    signatureVectors.map((right) => {
      let value = 0;
      for (let i = 0; i < contextList.length; i++) {
        value += left[i] * right[i];
      }
      return value;
    })
  );

  return {
    normalizedSignatures,
    normalizedSpectra,
    contextList,
    signatureNames,
    signatureVectors,
    gram,
  };
}

function fitVectorWithPreparedNNLS(
  prepared,
  spectrumVector,
  {
    maxIterations = QC_DEFAULTS.nnls.maxIterations,
    convergenceTolerance = QC_DEFAULTS.nnls.convergenceTolerance,
  } = {}
) {
  const signatureCount = prepared.signatureNames.length;
  const contextCount = prepared.contextList.length;
  const rhs = Array(signatureCount).fill(0);

  for (let signatureIndex = 0; signatureIndex < signatureCount; signatureIndex++) {
    const signatureVector = prepared.signatureVectors[signatureIndex];
    let value = 0;
    for (let contextIndex = 0; contextIndex < contextCount; contextIndex++) {
      value += signatureVector[contextIndex] * spectrumVector[contextIndex];
    }
    rhs[signatureIndex] = value;
  }

  const x = Array(signatureCount).fill(0);
  const iterationLimit = toFiniteNumber(maxIterations);
  const boundedMaxIterations = Math.max(
    1,
    Math.floor(iterationLimit ?? Math.max(100, signatureCount * 100))
  );
  const tolerance = Math.max(
    0,
    toFiniteNumber(convergenceTolerance) ?? QC_DEFAULTS.nnls.convergenceTolerance
  );

  for (let iteration = 0; iteration < boundedMaxIterations; iteration++) {
    let maxChange = 0;
    let exposureScale = 0;

    for (let index = 0; index < signatureCount; index++) {
      const oldValue = x[index];
      const gramRow = prepared.gram[index];
      let numerator = rhs[index];
      for (let column = 0; column < signatureCount; column++) {
        if (column !== index) {
          numerator -= gramRow[column] * x[column];
        }
      }
      const denominator = Math.max(gramRow[index], EPSILON);
      const nextValue = Math.max(0, numerator / denominator);
      x[index] = nextValue;
      maxChange = Math.max(maxChange, Math.abs(nextValue - oldValue));
      exposureScale += nextValue;
    }

    if (maxChange <= tolerance * Math.max(1, exposureScale)) {
      break;
    }
  }

  let residualSquared = 0;
  for (let contextIndex = 0; contextIndex < contextCount; contextIndex++) {
    let reconstructed = 0;
    for (let signatureIndex = 0; signatureIndex < signatureCount; signatureIndex++) {
      reconstructed +=
        x[signatureIndex] *
        prepared.signatureVectors[signatureIndex][contextIndex];
    }
    const residual = reconstructed - spectrumVector[contextIndex];
    residualSquared += residual * residual;
  }

  return { x, rnorm: Math.sqrt(residualSquared) };
}

function exposureVectorToRecord(
  signatureNames,
  exposureVector,
  { exposureThreshold = 0, exposureType = "relative", renormalize = true } = {}
) {
  const values = exposureVector.map((value) =>
    Number.isFinite(value) && value > 0 ? value : 0
  );
  const totalExposure = sum(values);

  for (let index = 0; index < values.length; index++) {
    const fraction = totalExposure === 0 ? 0 : values[index] / totalExposure;
    if (fraction < exposureThreshold) {
      values[index] = 0;
    }
  }

  const filteredTotal = sum(values);
  if ((renormalize || exposureType === "relative") && filteredTotal > 0) {
    for (let index = 0; index < values.length; index++) {
      values[index] /= filteredTotal;
    }
  }

  return Object.fromEntries(
    signatureNames.map((signatureName, index) => [
      signatureName,
      values[index] || 0,
    ])
  );
}

async function fitSingleSpectrumWithNNLS(
  signatures,
  spectrum,
  {
    contexts = null,
    exposureThreshold = QC_DEFAULTS.nnls.exposureThreshold,
    exposureType = QC_DEFAULTS.nnls.exposureType,
    renormalize = QC_DEFAULTS.nnls.renormalize,
    maxIterations = QC_DEFAULTS.nnls.maxIterations,
    convergenceTolerance = QC_DEFAULTS.nnls.convergenceTolerance,
  } = {}
) {
  const normalizedSpectrum = normalizeMatrixObject({ sample: spectrum }).sample;
  const prepared = prepareNNLSFitter(signatures, { sample: normalizedSpectrum }, contexts);
  const spectrumVector = vectorFromRecord(normalizedSpectrum, prepared.contextList);
  const nnlsOutput = fitVectorWithPreparedNNLS(prepared, spectrumVector, {
    maxIterations,
    convergenceTolerance,
  });

  return exposureVectorToRecord(prepared.signatureNames, nnlsOutput.x, {
    exposureThreshold,
    exposureType,
    renormalize,
  });
}

/**
 * Fits each sample spectrum to reference signatures using non-negative least squares.
 *
 * @async
 * @function fitSpectraWithNNLS
 * @memberof qc
 * @param {Object<string,Object<string,number>>} signatures - Signature-by-context matrix.
 * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
 * @param {Object} [options] - Fitting options.
 * @param {string[]} [options.contexts=null] - Context order to use.
 * @param {number} [options.exposureThreshold=0] - Relative exposure cutoff.
 * @param {string} [options.exposureType="relative"] - Exposure scaling mode.
 * @param {boolean} [options.renormalize=true] - Renormalize after thresholding.
 * @param {boolean} [options.returnDetails=false] - Return exposures with solver metadata instead of the exposure matrix alone.
 * @returns {Promise<Object<string,Object<string,number>>|Object>} Sample-by-signature exposure matrix, or a detailed result when returnDetails is true.
 */
async function fitSpectraWithNNLS(signatures, spectra, options = {}) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const prepared = prepareNNLSFitter(signatures, normalizedSpectra, options.contexts);
  const exposures = {};
  const solverOptions = {
    maxIterations: options.maxIterations ?? QC_DEFAULTS.nnls.maxIterations,
    convergenceTolerance:
      options.convergenceTolerance ?? QC_DEFAULTS.nnls.convergenceTolerance,
  };

  for (const [sample, spectrum] of Object.entries(normalizedSpectra)) {
    const spectrumVector = vectorFromRecord(spectrum, prepared.contextList);
    const nnlsOutput = fitVectorWithPreparedNNLS(
      prepared,
      spectrumVector,
      solverOptions
    );
    exposures[sample] = exposureVectorToRecord(
      prepared.signatureNames,
      nnlsOutput.x,
      options
    );
  }

  if (options.returnDetails) {
    return {
      schemaVersion: QC_RESULT_SCHEMA_VERSION,
      workflowRole: "nnls_signature_fit",
      scopeStatement: "A numerical fit, not a confidence call.",
      methodBasis: methodBasis({
        description:
          "mSigSDK uses a deterministic coordinate-descent nonnegative least-squares approximation with post-fit thresholding and optional renormalization.",
        solverVariant:
          "coordinate_descent_nnls",
        solverVariantBoundary:
          "This is not the Lawson-Hanson active-set implementation; agreement with an independent R NNLS solver was verified in the manuscript concordance experiment, but plain NNLS can over-assign confusable signatures compared with likelihood-based sparse approaches.",
        configurableDefaults: {
          exposureThreshold: options.exposureThreshold ?? 0,
          exposureType: options.exposureType ?? "relative",
          renormalize: options.renormalize !== false,
          maxIterations: solverOptions.maxIterations,
          convergenceTolerance: solverOptions.convergenceTolerance,
        },
        references: [
          QC_LITERATURE_REFERENCES.lawsonHanson1995,
          QC_LITERATURE_REFERENCES.medo2024,
          QC_LITERATURE_REFERENCES.jin2024,
        ],
      }),
      solverVariant: "coordinate_descent_nnls",
      solverCaveats: [
        "Plain NNLS may over-assign confusable signatures compared with likelihood-based sparse signature-selection methods.",
        "Solver differences can matter most in low-burden or highly confusable catalogs.",
      ],
      contexts: prepared.contextList,
      signatures: prepared.signatureNames,
      exposures,
    };
  }

  return exposures;
}

function summarizeExposureDriftFromBaseline(exposures, baselineExposures, signatureNames) {
  const sampleNames = Object.keys(exposures || {}).filter(
    (sample) => baselineExposures?.[sample]
  );
  if (sampleNames.length === 0) {
    return {
      sampleCount: 0,
      meanL1ExposureDrift: null,
      medianL1ExposureDrift: null,
      meanActiveSetJaccard: null,
    };
  }

  const l1Drifts = [];
  const activeSetJaccards = [];
  for (const sample of sampleNames) {
    const row = exposures[sample] || {};
    const baselineRow = baselineExposures[sample] || {};
    const l1 = sum(
      signatureNames.map((signature) =>
        Math.abs((row[signature] || 0) - (baselineRow[signature] || 0))
      )
    );
    const active = new Set(
      signatureNames.filter((signature) => (row[signature] || 0) > 0)
    );
    const baselineActive = new Set(
      signatureNames.filter((signature) => (baselineRow[signature] || 0) > 0)
    );
    const union = new Set([...active, ...baselineActive]);
    const intersection = [...active].filter((signature) =>
      baselineActive.has(signature)
    );

    l1Drifts.push(l1);
    activeSetJaccards.push(union.size === 0 ? 1 : intersection.length / union.size);
  }

  return {
    sampleCount: sampleNames.length,
    meanL1ExposureDrift: sum(l1Drifts) / l1Drifts.length,
    medianL1ExposureDrift: quantile(l1Drifts, 0.5),
    meanActiveSetJaccard: sum(activeSetJaccards) / activeSetJaccards.length,
  };
}

/**
 * Sweeps exposure thresholds and records reconstruction and activity stability.
 *
 * @async
 * @function runThresholdSensitivity
 * @memberof qc
 * @param {Object<string,Object<string,number>>} signatures - Signature-by-context matrix.
 * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
 * @param {Object} [options] - Threshold sweep options.
 * @param {number[]} [options.thresholds] - Exposure thresholds to test.
 * @param {string} [options.exposureType="relative"] - Exposure scaling mode.
 * @param {boolean} [options.renormalize=true] - Renormalize after thresholding.
 * @param {string[]} [options.contexts=null] - Context order to use.
 * @returns {Promise<Object>} Threshold grid and per-threshold fit metrics.
 * @example
 * const sensitivity = await mSigSDK.qc.runThresholdSensitivity(
 *   referenceSignatures,
 *   groupedSpectra,
 *   { thresholds: [0, 0.01, 0.03, 0.05, 0.1] }
 * );
 */
async function runThresholdSensitivity(
  signatures,
  spectra,
  {
    thresholds = [...QC_DEFAULTS.thresholdSensitivity.thresholds],
    baselineThreshold = QC_DEFAULTS.thresholdSensitivity.baselineThreshold,
    instabilityL1Threshold =
      QC_DEFAULTS.thresholdSensitivity.instabilityL1Threshold,
    activeSetJaccardThreshold =
      QC_DEFAULTS.thresholdSensitivity.activeSetJaccardThreshold,
    exposureType = QC_DEFAULTS.thresholdSensitivity.exposureType,
    renormalize = QC_DEFAULTS.thresholdSensitivity.renormalize,
    contexts = QC_DEFAULTS.thresholdSensitivity.contexts,
    maxIterations = QC_DEFAULTS.thresholdSensitivity.maxIterations,
    convergenceTolerance = QC_DEFAULTS.thresholdSensitivity.convergenceTolerance,
  } = {}
) {
  const runs = [];
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const prepared = prepareNNLSFitter(signatures, normalizedSpectra, contexts);
  const rawExposureVectors = {};
  const solverOptions = {
    maxIterations,
    convergenceTolerance,
  };

  for (const [sample, spectrum] of Object.entries(normalizedSpectra)) {
    const spectrumVector = vectorFromRecord(spectrum, prepared.contextList);
    rawExposureVectors[sample] = fitVectorWithPreparedNNLS(
      prepared,
      spectrumVector,
      solverOptions
    ).x;
  }

  for (const threshold of thresholds) {
    const exposures = {};
    for (const [sample, exposureVector] of Object.entries(rawExposureVectors)) {
      exposures[sample] = exposureVectorToRecord(
        prepared.signatureNames,
        exposureVector,
        {
          exposureThreshold: threshold,
          exposureType,
          renormalize,
        }
      );
    }
    const reconstructionError = calculateReconstructionError(
      signatures,
      normalizedSpectra,
      exposures,
      {
        contexts: prepared.contextList,
        normalizeMode: exposureType === "relative" ? "relative" : "auto",
      }
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

  const baselineRun =
    (baselineThreshold !== null &&
      runs.find((run) => run.threshold === baselineThreshold)) ||
    runs[0] ||
    null;
  for (const run of runs) {
    run.driftFromBaseline = baselineRun
      ? summarizeExposureDriftFromBaseline(
          run.exposures,
          baselineRun.exposures,
          prepared.signatureNames
        )
      : null;
  }
  const warnings = [];
  if (runs.length < 3) {
    warnings.push(
      makeQcWarning(
        QC_WARNING_CODES.THRESHOLD_GRID_TOO_SMALL,
        "Threshold sensitivity requires at least three thresholds to characterize drift.",
        { thresholdCount: runs.length }
      )
    );
  }
  const maxMeanL1ExposureDrift = Math.max(
    ...runs
      .map((run) => run.driftFromBaseline?.meanL1ExposureDrift)
      .filter(Number.isFinite),
    0
  );
  const minMeanActiveSetJaccard =
    runs.length === 0
      ? null
      : Math.min(
          ...runs
            .map((run) => run.driftFromBaseline?.meanActiveSetJaccard)
            .filter(Number.isFinite),
          1
        );
  if (
    (Number.isFinite(instabilityL1Threshold) &&
      maxMeanL1ExposureDrift > instabilityL1Threshold) ||
    (Number.isFinite(activeSetJaccardThreshold) &&
      Number.isFinite(minMeanActiveSetJaccard) &&
      minMeanActiveSetJaccard < activeSetJaccardThreshold)
  ) {
    warnings.push(
      makeQcWarning(
        QC_WARNING_CODES.THRESHOLD_DEPENDENT_FIT,
        "At least one threshold produced exposure drift beyond the configured instability setting.",
        {
          maxMeanL1ExposureDrift,
          instabilityL1Threshold,
          minMeanActiveSetJaccard,
          activeSetJaccardThreshold,
        }
      )
    );
  }
  const averageActiveSignatures = runs
    .map((run) => run.averageActiveSignatures)
    .filter(Number.isFinite);

  return {
    schemaVersion: QC_RESULT_SCHEMA_VERSION,
    workflowRole: "threshold_sensitivity",
    scopeStatement: QC_SCOPE_STATEMENTS.thresholdSensitivity,
    methodBasis: methodBasis({
      description: QC_METHOD_BASIS.thresholdSensitivity,
      driftMetrics:
        "Mean L1 exposure drift and active-set Jaccard similarity are computed relative to the baseline threshold.",
      driftUnits:
        exposureType === "relative"
          ? "relative exposure units; L1 drift ranges from 0 to 2 for normalized exposure rows"
          : "absolute exposure units in the supplied exposure scale",
      thresholdBasis:
        "The tested thresholds are user-specified analysis settings; the output reports stability across them rather than defining a universal cutoff.",
      thresholdRationale:
        "The default threshold grid spans no cutoff through 10% relative exposure, matching common sensitivity-review ranges used around low relative-exposure reporting decisions.",
      instabilityThresholdRationale:
        "Configured L1 and active-set Jaccard thresholds are review defaults. Wu et al. 2023 reported broad inter-tool active-set Jaccard variation, so these thresholds should be treated as user-configured sensitivity triggers rather than field-standard cutoffs.",
      configurableDefaults: {
        thresholds,
        baselineThreshold: baselineRun?.threshold ?? null,
        instabilityL1Threshold,
        activeSetJaccardThreshold,
        exposureType,
        renormalize,
        maxIterations,
        convergenceTolerance,
      },
      references: [
        QC_LITERATURE_REFERENCES.koh2021,
        QC_LITERATURE_REFERENCES.degasperi2020,
        QC_LITERATURE_REFERENCES.medo2024,
        QC_LITERATURE_REFERENCES.wu2023,
      ],
    }),
    parameters: {
      thresholds,
      baselineThreshold: baselineRun?.threshold ?? null,
      exposureType,
      renormalize,
      instabilityL1Threshold,
      activeSetJaccardThreshold,
      maxIterations,
      convergenceTolerance,
    },
    thresholds,
    baselineThreshold: baselineRun?.threshold ?? null,
    driftUnits:
      exposureType === "relative"
        ? "relative_exposure_l1_units"
        : "absolute_exposure_l1_units",
    thresholdRationale:
      "The default threshold grid spans no cutoff through 10% relative exposure and should be treated as a sensitivity review range rather than a universal threshold recommendation.",
    runs,
    summary: {
      thresholdCount: runs.length,
      maxMeanL1ExposureDrift,
      minMeanActiveSetJaccard,
      meanActiveSignatureRange: {
        min:
          averageActiveSignatures.length === 0
            ? null
            : Math.min(...averageActiveSignatures),
        max:
          averageActiveSignatures.length === 0
            ? null
            : Math.max(...averageActiveSignatures),
      },
    },
    warnings,
    reportingMode:
      warnings.length > 0 ? "report_with_caveats" : "standard_qc_passed",
  };
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

/**
 * Bootstraps one spectrum to estimate exposure uncertainty and selection frequency.
 *
 * @async
 * @function bootstrapSignatureFit
 * @memberof qc
 * @param {Object<string,Object<string,number>>} signatures - Signature-by-context matrix.
 * @param {Object<string,number>} spectrum - Single sample spectrum.
 * @param {Object} [options] - Bootstrap options.
 * @param {number} [options.iterations=200] - Bootstrap replicate count.
 * @param {number} [options.confidenceLevel=0.95] - Confidence interval level.
 * @param {number} [options.exposureThreshold=0] - Relative exposure cutoff.
 * @param {string} [options.exposureType="relative"] - Exposure scaling mode.
 * @param {boolean} [options.renormalize=true] - Renormalize after thresholding.
 * @param {number} [options.seed=123] - Seed for reproducible resampling.
 * @param {string[]} [options.contexts=null] - Context order to use.
 * @returns {Promise<Object>} Bootstrap interval, selection-frequency, exposure, and reconstruction results.
 * @example
 * const bootstrap = await mSigSDK.qc.bootstrapSignatureFit(
 *   referenceSignatures,
 *   groupedSpectra[sampleName],
 *   { iterations: 100, confidenceLevel: 0.95 }
 * );
 */
async function bootstrapSignatureFit(
  signatures,
  spectrum,
  {
    iterations = QC_DEFAULTS.bootstrap.iterations,
    confidenceLevel = QC_DEFAULTS.bootstrap.confidenceLevel,
    exposureThreshold = QC_DEFAULTS.bootstrap.exposureThreshold,
    exposureType = QC_DEFAULTS.bootstrap.exposureType,
    renormalize = QC_DEFAULTS.bootstrap.renormalize,
    seed = QC_DEFAULTS.bootstrap.seed,
    contexts = QC_DEFAULTS.bootstrap.contexts,
    minIterationsForStableIntervals =
      QC_DEFAULTS.bootstrap.minIterationsForStableIntervals,
    publicationRecommendedIterations =
      QC_DEFAULTS.bootstrap.publicationRecommendedIterations,
    minMutationsForBootstrapSummary =
      QC_DEFAULTS.bootstrap.minMutationsForBootstrapSummary,
    maxIterations = QC_DEFAULTS.bootstrap.maxIterations,
    convergenceTolerance = QC_DEFAULTS.bootstrap.convergenceTolerance,
  } = {}
) {
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const normalizedSpectrum = normalizeMatrixObject({ sample: spectrum }).sample;
  const prepared = prepareNNLSFitter(
    normalizedSignatures,
    { sample: normalizedSpectrum },
    contexts
  );
  const contextList = prepared.contextList;
  const observedVector = vectorFromRecord(normalizedSpectrum, contextList);
  const totalMutations = sum(observedVector);
  const random = seededRandom(seed);
  const signatureNames = prepared.signatureNames;
  const exposureRows = [];
  const reconstructionRows = [];
  const solverOptions = {
    maxIterations,
    convergenceTolerance,
  };

  for (let i = 0; i < iterations; i++) {
    const resampledVector = multinomialResample(observedVector, random);
    const resampledSpectrum = Object.fromEntries(
      contextList.map((context, index) => [context, resampledVector[index]])
    );
    const nnlsOutput = fitVectorWithPreparedNNLS(
      prepared,
      resampledVector,
      solverOptions
    );
    const exposures = exposureVectorToRecord(
      signatureNames,
      nnlsOutput.x,
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
    const lower = quantile(values, alpha / 2);
    const upper = quantile(values, 1 - alpha / 2);
    return {
      signatureName,
      mean: values.length === 0 ? null : sum(values) / values.length,
      median: quantile(values, 0.5),
      lower,
      upper,
      ciLower: lower,
      ciUpper: upper,
      ciWidth:
        Number.isFinite(lower) && Number.isFinite(upper)
          ? upper - lower
          : null,
      interval: {
        lower,
        upper,
        width:
          Number.isFinite(lower) && Number.isFinite(upper)
            ? upper - lower
            : null,
        level: confidenceLevel,
        method: "empirical_quantile_multinomial_bootstrap",
      },
      selectionFrequency:
        values.length === 0
          ? null
          : values.filter((value) => value > 0).length / values.length,
      selectionFrequencyDefinition:
        "Fraction of bootstrap refits where the signature exposure remained above zero after the configured threshold and renormalization settings.",
    };
  });
  const warnings = [];
    if (iterations < minIterationsForStableIntervals) {
    warnings.push(
      makeQcWarning(
        QC_WARNING_CODES.LOW_BOOTSTRAP_ITERATIONS,
        "Bootstrap interval estimates use fewer iterations than the configured stability threshold; 1000 iterations are recommended for publication-grade uncertainty intervals.",
        { iterations, minIterationsForStableIntervals, publicationRecommendedIterations }
      )
    );
  }
  if (totalMutations < minMutationsForBootstrapSummary) {
    warnings.push(
      makeQcWarning(
        QC_WARNING_CODES.LOW_BURDEN,
        "Bootstrap exposure intervals are based on a low mutation count and may be dominated by sampling noise.",
        { totalMutations, minMutationsForBootstrapSummary }
      )
    );
  }

  return {
    schemaVersion: QC_RESULT_SCHEMA_VERSION,
    workflowRole: "bootstrap_exposure_uncertainty",
    scopeStatement: QC_SCOPE_STATEMENTS.bootstrap,
    methodBasis: methodBasis({
      description: QC_METHOD_BASIS.bootstrap,
      bootstrapMethod: "parametric_multinomial",
      intervalDefinition:
        "Confidence intervals are empirical quantiles of bootstrap-fitted exposures. They are conditional on the observed spectrum, supplied signature catalog, threshold, and NNLS fitting routine.",
      uncertaintyBoundary:
        "This method estimates statistical uncertainty of the attribution procedure conditional on the observed spectrum, supplied catalog, and fitting settings; it does not estimate total attribution uncertainty.",
      selectionFrequencyDefinition:
        "Selection frequency is the fraction of bootstrap refits in which the thresholded signature exposure is nonzero.",
      methodRationale:
        "The MSA bootstrap framework supports parametric bootstrap for mutational-signature attribution and cautions against interpreting these intervals as total uncertainty.",
      configurableDefaults: {
        iterations,
        confidenceLevel,
        exposureThreshold,
        exposureType,
        renormalize,
        minIterationsForStableIntervals,
        publicationRecommendedIterations,
        minMutationsForBootstrapSummary,
        maxIterations,
        convergenceTolerance,
      },
      references: [
        QC_LITERATURE_REFERENCES.senkin2021,
        QC_LITERATURE_REFERENCES.huang2018,
        QC_LITERATURE_REFERENCES.koh2021,
        QC_LITERATURE_REFERENCES.medo2024,
      ],
    }),
    bootstrapMethod: "parametric_multinomial",
    parameters: {
      iterations,
      confidenceLevel,
      exposureThreshold,
      exposureType,
      renormalize,
      seed,
      minIterationsForStableIntervals,
      publicationRecommendedIterations,
      minMutationsForBootstrapSummary,
      maxIterations,
      convergenceTolerance,
    },
    inputSummary: {
      totalMutations,
      contextCount: contextList.length,
    },
    iterations,
    confidenceLevel,
    seed,
    contexts: contextList,
    signatures: signaturesSummary,
    exposureSamples: exposureRows,
    reconstructionError: reconstructionRows,
    warnings,
    reportingMode:
      warnings.length > 0 ? "report_with_caveats" : "standard_qc_passed",
  };
}

export {
  QC_DEFAULTS,
  QC_WARNING_CODES,
  bootstrapSignatureFit,
  calculateFitResiduals,
  calculateReconstructionError,
  fitSpectraWithNNLS,
  normalizeExposures,
  runThresholdSensitivity,
  selectSamplesByMutationBurden,
  summarizeMissingContexts,
  summarizeMutationBurden,
};
