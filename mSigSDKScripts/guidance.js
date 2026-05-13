import {
  bootstrapSignatureFit,
  calculateFitResiduals,
  calculateReconstructionError,
  fitSpectraWithNNLS,
  runThresholdSensitivity,
  summarizeMissingContexts,
  summarizeMutationBurden,
} from "./qc.js";
import { createAnalysisReport } from "./reports.js";
import {
  compareExtractedToReference,
  extractSignaturesNMF,
  selectNMFRank,
} from "./signatureExtraction.js";
import {
  inferMutationContexts as inferContexts,
  vectorFromRecord,
} from "./matrix.js";
import {
  cosineSimilarity,
  normalizeVector,
  quantile,
  seededRandom,
  sum,
} from "./numerics.js";
import {
  getExpectedContexts,
  isPlainObject,
  normalizeMatrixObject,
  toFiniteNumber,
  validateSignatureMatrix,
  validateSpectra,
} from "./validation.js";

const RESULT_SCHEMA_VERSION = "msig.pipeline.v0.3";

const WARNING_CODES = {
  CATALOG_INCOMPLETE_SUSPECTED: "CATALOG_INCOMPLETE_SUSPECTED",
  EXTRACTION_NOT_RECOMMENDED: "EXTRACTION_NOT_RECOMMENDED",
  FIT_UNSTABLE: "FIT_UNSTABLE",
  FLAT_SIGNATURE_RISK: "FLAT_SIGNATURE_RISK",
  HETEROGENEOUS_COHORT: "HETEROGENEOUS_COHORT",
  HIGH_RESIDUAL_STRUCTURE: "HIGH_RESIDUAL_STRUCTURE",
  INCOMPLETE_CONTEXTS: "INCOMPLETE_CONTEXTS",
  INSUFFICIENT_SIGNAL: "INSUFFICIENT_SIGNAL",
  LOW_BURDEN: "LOW_BURDEN",
  GROUP_IMBALANCE: "GROUP_IMBALANCE",
  METADATA_MISSING: "METADATA_MISSING",
  PANEL_LIMITED: "PANEL_LIMITED",
  PANEL_SIGNATURE_NOT_ASSESSABLE: "PANEL_SIGNATURE_NOT_ASSESSABLE",
  REGIONAL_PROCESS_SUSPECTED: "REGIONAL_PROCESS_SUSPECTED",
  SIGNATURE_AMBIGUITY: "SIGNATURE_AMBIGUITY",
  SUBGROUP_EXTRACTION_SKIPPED: "SUBGROUP_EXTRACTION_SKIPPED",
  THRESHOLD_DEPENDENT: "THRESHOLD_DEPENDENT",
};

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function average(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  return finiteValues.length === 0 ? null : sum(finiteValues) / finiteValues.length;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function makeWarning(code, message, details = {}) {
  return {
    code,
    level: "warning",
    message,
    ...details,
  };
}

function isNumericRecord(value) {
  return (
    isPlainObject(value) &&
    Object.entries(value).some(
      ([key, entryValue]) => key !== "rnorm" && toFiniteNumber(entryValue) !== null
    ) &&
    Object.entries(value).every(
      ([key, entryValue]) => key === "rnorm" || toFiniteNumber(entryValue) !== null
    )
  );
}

function normalizeSpectraInput(input, { sampleName = "sample_1" } = {}) {
  const source = input?.spectra || input?.spectrum || input;

  if (!isPlainObject(source)) {
    return {};
  }

  if (isNumericRecord(source)) {
    return normalizeMatrixObject({ [sampleName]: source });
  }

  return normalizeMatrixObject(source);
}

function getContextList(signatures, spectra, options = {}) {
  return (
    options.contexts ||
    options.expectedContexts ||
    getExpectedContexts({
      profile: options.profile || "SBS",
      matrix: options.matrix || 96,
    }) ||
    inferContexts(signatures, spectra)
  );
}

function getBurdenClass(totalMutations, thresholds) {
  if (!Number.isFinite(totalMutations) || totalMutations <= 0) {
    return "insufficient";
  }
  if (totalMutations < thresholds.lowBurdenThreshold) {
    return "low";
  }
  if (totalMutations < thresholds.moderateBurdenThreshold) {
    return "moderate";
  }
  return "high";
}

function sampleModeForBurden(burdenClass) {
  if (burdenClass === "insufficient") {
    return "insufficient_signal";
  }
  if (burdenClass === "low") {
    return "restricted_refitting";
  }
  if (burdenClass === "moderate") {
    return "known_signature_refitting";
  }
  return "refitting_with_catalog_sufficiency_check";
}

function getBurdenAction(burdenClass) {
  if (burdenClass === "insufficient") {
    return "Do not perform exposure decomposition; report insufficient signal or aggregate with a biologically justified cohort.";
  }
  if (burdenClass === "low") {
    return "Use restricted, hypothesis-driven refitting with bootstrap uncertainty and avoid de novo extraction.";
  }
  if (burdenClass === "moderate") {
    return "Use known-signature refitting with threshold sensitivity and residual checks.";
  }
  return "Use known-signature refitting and evaluate whether residual structure supports subgroup extraction or catalog expansion.";
}

function computePairwiseSampleSimilarity(spectra, contexts, maxPairs = 5000) {
  const sampleNames = Object.keys(spectra);
  const pairs = [];
  let evaluatedPairs = 0;

  for (let i = 0; i < sampleNames.length; i++) {
    for (let j = i + 1; j < sampleNames.length; j++) {
      if (evaluatedPairs >= maxPairs) {
        break;
      }
      const sampleA = sampleNames[i];
      const sampleB = sampleNames[j];
      const similarity = cosineSimilarity(
        vectorFromRecord(spectra[sampleA], contexts),
        vectorFromRecord(spectra[sampleB], contexts)
      );
      pairs.push({ sampleA, sampleB, cosineSimilarity: similarity });
      evaluatedPairs += 1;
    }
  }

  const values = pairs.map((pair) => pair.cosineSimilarity);
  return {
    pairsEvaluated: pairs.length,
    truncated: sampleNames.length * (sampleNames.length - 1) / 2 > pairs.length,
    meanPairwiseCosine: average(values),
    medianPairwiseCosine: quantile(values, 0.5),
    minPairwiseCosine: values.length === 0 ? null : Math.min(...values),
    maxPairwiseCosine: values.length === 0 ? null : Math.max(...values),
    pairs,
  };
}

function summarizeThresholdInstability(thresholdSensitivity, sampleName) {
  if (!thresholdSensitivity?.runs?.length) {
    return {
      measured: false,
      score: 0.7,
      l1Change: null,
      activeSignatureRange: null,
      recommendation: "Threshold sensitivity was not measured.",
    };
  }

  const sampleRows = thresholdSensitivity.runs
    .map((run) => ({
      threshold: run.threshold,
      exposure: run.exposures?.[sampleName] || {},
      reconstruction: run.reconstructionError?.samples?.find(
        (sample) => sample.sample === sampleName
      ),
    }))
    .filter((run) => isPlainObject(run.exposure));

  if (sampleRows.length < 2) {
    return {
      measured: false,
      score: 0.7,
      l1Change: null,
      activeSignatureRange: null,
      recommendation: "Threshold sensitivity did not contain enough runs for this sample.",
    };
  }

  const signatureNames = uniqueStrings(
    sampleRows.flatMap((row) => Object.keys(row.exposure))
  );
  const first = sampleRows[0].exposure;
  const last = sampleRows[sampleRows.length - 1].exposure;
  const l1Change = sum(
    signatureNames.map((signature) =>
      Math.abs((first[signature] || 0) - (last[signature] || 0))
    )
  );
  const activeCounts = sampleRows.map(
    (row) => Object.values(row.exposure).filter((value) => value > 0).length
  );
  const activeSignatureRange =
    activeCounts.length === 0
      ? 0
      : Math.max(...activeCounts) - Math.min(...activeCounts);
  const cosineDrop =
    (sampleRows[0].reconstruction?.cosineSimilarity || 0) -
    (sampleRows[sampleRows.length - 1].reconstruction?.cosineSimilarity || 0);
  const score = clamp(
    1 - clamp(l1Change / 0.7, 0, 1) * 0.7 - clamp(activeSignatureRange / 4, 0, 1) * 0.2 -
      clamp(cosineDrop / 0.1, 0, 1) * 0.1
  );

  return {
    measured: true,
    score,
    l1Change,
    activeSignatureRange,
    cosineDrop,
    recommendation:
      score < 0.55
        ? "Treat the fitted signature set as threshold-dependent and report sensitivity results."
        : "The fitted signature set is stable across the tested exposure thresholds.",
  };
}

function summarizeBootstrapStability(bootstrap, exposureFloor = 0.01) {
  if (!bootstrap?.signatures?.length) {
    return {
      measured: false,
      score: 0.7,
      maxConfidenceWidth: null,
      unstableSignatures: [],
      recommendation: "Bootstrap stability was not measured.",
    };
  }

  const activeSummaries = bootstrap.signatures.filter(
    (signature) =>
      (signature.mean || 0) >= exposureFloor ||
      (signature.selectionFrequency || 0) >= 0.05
  );
  const maxConfidenceWidth =
    activeSummaries.length === 0
      ? 0
      : Math.max(
          ...activeSummaries.map(
            (signature) => (signature.upper || 0) - (signature.lower || 0)
          )
        );
  const unstableSignatures = activeSummaries.filter(
    (signature) =>
      signature.selectionFrequency > 0.2 &&
      signature.selectionFrequency < 0.8
  );
  const score = clamp(
    1 - clamp(maxConfidenceWidth / 0.6, 0, 1) * 0.7 -
      (unstableSignatures.length > 0 ? 0.2 : 0)
  );

  return {
    measured: true,
    score,
    maxConfidenceWidth,
    unstableSignatures: unstableSignatures.map(
      (signature) => signature.signatureName
    ),
    recommendation:
      score < 0.55
        ? "Exposure estimates are bootstrap-unstable; report confidence intervals and avoid fine-grained interpretation."
        : "Bootstrap estimates are stable enough for standard reporting.",
  };
}

function classifyTrust(score) {
  if (score >= 80) {
    return "high_confidence";
  }
  if (score >= 60) {
    return "moderate_confidence";
  }
  if (score >= 40) {
    return "low_confidence";
  }
  return "not_assessable";
}

function getBootstrapForSample(bootstrap, sampleName) {
  if (!bootstrap) {
    return null;
  }
  if (bootstrap[sampleName]) {
    return bootstrap[sampleName];
  }
  if (bootstrap.signatures) {
    return bootstrap;
  }
  return null;
}

function getCatalogCheckForSample(catalogCheck, sampleName) {
  return catalogCheck?.samples?.find((sample) => sample.sample === sampleName) || null;
}

function getResidualSample(residuals, sampleName) {
  return residuals?.samples?.find((sample) => sample.sample === sampleName) || null;
}

function getReconstructionSample(reconstructionError, sampleName) {
  return (
    reconstructionError?.samples?.find((sample) => sample.sample === sampleName) ||
    null
  );
}

function getBurdenSample(burdenSummary, sampleName) {
  return burdenSummary?.samples?.find((sample) => sample.sample === sampleName) || null;
}

function activeSignatureNames(exposureRow, threshold = 0.05) {
  return Object.entries(exposureRow || {})
    .filter(([, value]) => value >= threshold)
    .map(([signatureName]) => signatureName);
}

function indexAmbiguityBySignature(ambiguity) {
  return Object.fromEntries(
    (ambiguity?.signatures || []).map((signature) => [
      signature.signatureName,
      signature,
    ])
  );
}

function buildPublicationFigureDescriptors(workflowType, fields = {}) {
  const base = [
    {
      id: "burden_qc",
      title: "Mutation burden and context coverage QC",
      purpose: "Shows whether the input has enough information for the selected analysis mode.",
      recommendedRenderer: "mSigSDK.qcPlots.plotMutationBurdenSummary",
    },
    {
      id: "reconstruction_residuals",
      title: "Observed, reconstructed, and residual spectrum",
      purpose: "Shows fitted signal and unexplained structure after refitting.",
      recommendedRenderer: "mSigSDK.qcPlots.plotResidualSpectrum",
    },
    {
      id: "trust_dashboard",
      title: "Fit trust and caveat dashboard",
      purpose: "Summarizes burden, reconstruction, residual, bootstrap, threshold, ambiguity, and catalog-sufficiency evidence.",
      recommendedRenderer: "mSigSDK.qcPlots.plotFitTrustDashboard",
    },
  ];

  if (workflowType === "single_sample") {
    base.push({
      id: "single_sample_exposure",
      title: "Single-sample signature exposure with uncertainty",
      purpose: "Reports fitted exposures with confidence intervals and residual-unexplained context.",
      recommendedRenderer:
        "mSigSDK.signatureFitting.plotPatientMutationalSignaturesExposure",
    });
  }

  if (workflowType === "cohort" || workflowType === "panel") {
    base.push({
      id: "cohort_exposure_heatmap",
      title: "Cohort exposure heatmap with burden and confidence annotations",
      purpose: "Compares signature activity across samples while flagging low-information spectra.",
      recommendedRenderer:
        "mSigSDK.signatureFitting.plotDatasetMutationalSignaturesExposure",
    });
    base.push({
      id: "sample_similarity",
      title: "Sample similarity and subgroup structure",
      purpose: "Shows whether the cohort should be stratified before extraction or refitting.",
      recommendedRenderer: "mSigSDK.signatureFitting.plotCosineSimilarityHeatMap",
    });
  }

  if (workflowType === "cohort") {
    base.push({
      id: "group_comparison",
      title: "Metadata-stratified exposure comparison",
      purpose: "Shows signatures with the largest fitted exposure differences between sample groups.",
      recommendedRenderer: "mSigSDK.qcPlots.plotCohortGroupComparison",
    });
    base.push({
      id: "subgroup_discovery",
      title: "Subgroup extraction and matched refitting summary",
      purpose: "Shows which cohort subgroups were extracted, skipped, matched to references, and refitted.",
      recommendedRenderer: "mSigSDK.pipelines.runSubgroupDiscoveryWorkflow",
    });
  }

  if (workflowType === "panel") {
    base.push({
      id: "panel_evidence",
      title: "Panel/WES signature evidence matrix",
      purpose: "Shows strong, weak, absent, and not-assessable signature evidence calls per sample.",
      recommendedRenderer: "mSigSDK.qcPlots.plotPanelEvidenceMatrix",
    });
  }

  if (workflowType === "discovery") {
    base.push({
      id: "nmf_stability",
      title: "NMF rank and run stability",
      purpose: "Shows whether extracted signatures are stable across ranks and random starts.",
      recommendedRenderer: "mSigSDK.signatureExtractionPlots.plotNMFRankSelection",
    });
  }

  if (workflowType === "localized") {
    base.push({
      id: "rainfall",
      title: "Rainfall plot with focal mutation clusters",
      purpose: "Shows localized hypermutation and kataegis-like regional processes.",
      recommendedRenderer: "mSigSDK.pipelines.runLocalizedMutagenesisAnalysis",
    });
  }

  return base.map((descriptor) => ({
    ...descriptor,
    dataKeys: fields[descriptor.id] || [],
  }));
}

/**
 * Recommends a burden-aware analysis strategy for one sample or a cohort.
 *
 * @function recommendAnalysisStrategy
 * @memberof advisor
 * @param {Object<string,Object<string,number>>|Object<string,number>} spectra - Sample spectra matrix or one spectrum.
 * @param {Object} [options] - Advisor options.
 * @returns {Object} Strategy recommendation, caveats, warnings, and next actions.
 */
function recommendAnalysisStrategy(spectra, options = {}) {
  const {
    assay = "WGS",
    lowBurdenThreshold = assay === "panel" ? 30 : 100,
    moderateBurdenThreshold = assay === "panel" ? 150 : 1000,
    highBurdenThreshold = 3000,
    minSamplesForExtraction = 8,
    minHighInformationFraction = 0.5,
    heterogeneityCosineThreshold = 0.85,
  } = options;
  const normalizedSpectra = normalizeSpectraInput(spectra, options);
  const contexts = getContextList(null, normalizedSpectra, options);
  const validation = validateSpectra(normalizedSpectra, {
    expectedContexts: contexts,
    minTotalMutations: lowBurdenThreshold,
  });
  const mutationBurden = summarizeMutationBurden(normalizedSpectra, {
    expectedContexts: contexts,
    lowBurdenThreshold,
  });
  const contextCoverage = summarizeMissingContexts(normalizedSpectra, {
    expectedContexts: contexts,
  });
  const thresholds = {
    lowBurdenThreshold,
    moderateBurdenThreshold,
    highBurdenThreshold,
  };
  const samples = mutationBurden.samples.map((sample) => {
    const burdenClass = getBurdenClass(sample.totalMutations, thresholds);
    const warnings = [];

    if (burdenClass === "insufficient") {
      warnings.push(
        makeWarning(
          WARNING_CODES.INSUFFICIENT_SIGNAL,
          `${sample.sample} has no callable mutation signal.`,
          { sample: sample.sample }
        )
      );
    } else if (burdenClass === "low") {
      warnings.push(
        makeWarning(
          WARNING_CODES.LOW_BURDEN,
          `${sample.sample} has low mutation burden for full exposure decomposition.`,
          { sample: sample.sample, totalMutations: sample.totalMutations }
        )
      );
    }

    return {
      sample: sample.sample,
      totalMutations: sample.totalMutations,
      nonZeroContexts: sample.nonZeroContexts,
      burdenClass,
      recommendedMode: sampleModeForBurden(burdenClass),
      recommendedAction: getBurdenAction(burdenClass),
      warnings,
    };
  });

  const sampleCount = samples.length;
  const highInformationSamples = samples.filter(
    (sample) => sample.burdenClass === "high"
  );
  const highInformationFraction =
    sampleCount === 0 ? 0 : highInformationSamples.length / sampleCount;
  const totalMutations = samples.map((sample) => sample.totalMutations);
  const similarity = computePairwiseSampleSimilarity(normalizedSpectra, contexts);
  const warnings = samples.flatMap((sample) => sample.warnings);

  if (!contextCoverage.complete) {
    warnings.push(
      makeWarning(
        WARNING_CODES.INCOMPLETE_CONTEXTS,
        "One or more spectra are missing expected mutation contexts.",
        {
          affectedSamples: contextCoverage.samples
            .filter((sample) => sample.missingCount > 0 || sample.extraCount > 0)
            .map((sample) => sample.sample),
        }
      )
    );
  }

  const heterogeneous =
    sampleCount >= 3 &&
    Number.isFinite(similarity.medianPairwiseCosine) &&
    similarity.medianPairwiseCosine < heterogeneityCosineThreshold;
  if (heterogeneous) {
    warnings.push(
      makeWarning(
        WARNING_CODES.HETEROGENEOUS_COHORT,
        "The cohort has heterogeneous spectra; subgroup before extraction or cohort-wide interpretation.",
        { medianPairwiseCosine: similarity.medianPairwiseCosine }
      )
    );
  }

  const extractionCandidate =
    sampleCount >= minSamplesForExtraction &&
    highInformationFraction >= minHighInformationFraction &&
    !heterogeneous;
  if (sampleCount > 1 && !extractionCandidate) {
    warnings.push(
      makeWarning(
        WARNING_CODES.EXTRACTION_NOT_RECOMMENDED,
        "De novo extraction is not recommended with the current sample count, burden distribution, or cohort heterogeneity.",
        { sampleCount, highInformationFraction }
      )
    );
  }

  const cohort = {
    sampleCount,
    totalMutations: sum(totalMutations),
    medianMutationBurden: quantile(totalMutations, 0.5),
    highInformationSampleCount: highInformationSamples.length,
    highInformationFraction,
    heterogeneous,
    similarity,
    canConsiderExtraction: extractionCandidate,
    primaryRecommendation:
      sampleCount === 1
        ? samples[0]?.recommendedMode || "insufficient_signal"
        : extractionCandidate
          ? "subgroup_aware_discovery_then_refitting"
          : "cohort_refitting_with_low_information_flags",
  };

  const recommendedActions = uniqueStrings([
    ...samples.map((sample) => sample.recommendedAction),
    heterogeneous ? "Cluster or stratify the cohort before extraction and before reporting cohort-wide exposures." : null,
    extractionCandidate
      ? "Run rank selection and NMF extraction, then match extracted signatures to a reference catalog and refit with a shortlist."
      : sampleCount > 1
        ? "Use known-signature refitting with confidence flags; reserve extraction for higher-burden subgroups."
        : null,
    assay === "panel"
      ? "Use panel-specific evidence tiers and avoid overinterpreting absent flat signatures."
      : null,
  ]);

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "analysis_advisor",
    assay,
    contexts,
    thresholds,
    validation,
    mutationBurden,
    contextCoverage,
    samples,
    cohort,
    warnings,
    caveats: warnings.map((warning) => warning.message),
    recommendedActions,
  };
}

/**
 * Computes catalog-level signature ambiguity and flat-signature risk.
 *
 * @function computeSignatureAmbiguity
 * @memberof advisor
 * @param {Object<string,Object<string,number>>} signatures - Reference signatures.
 * @param {Object} [options] - Ambiguity options.
 * @returns {Object} Per-signature ambiguity, pairwise confusability, and warnings.
 */
function computeSignatureAmbiguity(signatures, options = {}) {
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const contexts = getContextList(normalizedSignatures, null, options);
  const signatureNames = Object.keys(normalizedSignatures);
  const pairReportThreshold = options.pairReportThreshold ?? 0.9;
  const summaries = Object.fromEntries(
    signatureNames.map((signatureName) => {
      const vector = vectorFromRecord(normalizedSignatures[signatureName], contexts);
      const probabilities = normalizeVector(vector, 1);
      const positive = probabilities.filter((value) => value > 0);
      const entropy =
        positive.length === 0
          ? 0
          : -sum(positive.map((value) => value * Math.log(value))) /
            Math.log(Math.max(contexts.length, 2));
      return [
        signatureName,
        {
          signatureName,
          entropy,
          flatnessScore: entropy,
          maxContribution: Math.max(...probabilities, 0),
          nonZeroContexts: positive.length,
          nearestNeighbor: null,
          nearestCosineSimilarity: 0,
        },
      ];
    })
  );
  const pairs = [];

  for (let i = 0; i < signatureNames.length; i++) {
    for (let j = i + 1; j < signatureNames.length; j++) {
      const signatureA = signatureNames[i];
      const signatureB = signatureNames[j];
      const similarity = cosineSimilarity(
        vectorFromRecord(normalizedSignatures[signatureA], contexts),
        vectorFromRecord(normalizedSignatures[signatureB], contexts)
      );

      if (similarity > summaries[signatureA].nearestCosineSimilarity) {
        summaries[signatureA].nearestCosineSimilarity = similarity;
        summaries[signatureA].nearestNeighbor = signatureB;
      }
      if (similarity > summaries[signatureB].nearestCosineSimilarity) {
        summaries[signatureB].nearestCosineSimilarity = similarity;
        summaries[signatureB].nearestNeighbor = signatureA;
      }
      if (similarity >= pairReportThreshold) {
        pairs.push({ signatureA, signatureB, cosineSimilarity: similarity });
      }
    }
  }

  const signatureSummaries = Object.values(summaries).map((summary) => {
    const highAmbiguity =
      summary.nearestCosineSimilarity >= 0.95 || summary.flatnessScore >= 0.92;
    const moderateAmbiguity =
      !highAmbiguity &&
      (summary.nearestCosineSimilarity >= 0.9 || summary.flatnessScore >= 0.85);
    const warnings = [];

    if (summary.nearestCosineSimilarity >= 0.9) {
      warnings.push(
        makeWarning(
          WARNING_CODES.SIGNATURE_AMBIGUITY,
          `${summary.signatureName} is similar to ${summary.nearestNeighbor}; fitted exposures may be exchangeable.`,
          {
            signatureName: summary.signatureName,
            nearestNeighbor: summary.nearestNeighbor,
            nearestCosineSimilarity: summary.nearestCosineSimilarity,
          }
        )
      );
    }
    if (summary.flatnessScore >= 0.9) {
      warnings.push(
        makeWarning(
          WARNING_CODES.FLAT_SIGNATURE_RISK,
          `${summary.signatureName} is broad or flat, making low-burden detection more fragile.`,
          { signatureName: summary.signatureName, flatnessScore: summary.flatnessScore }
        )
      );
    }

    return {
      ...summary,
      ambiguityClass: highAmbiguity
        ? "high"
        : moderateAmbiguity
          ? "moderate"
          : "low",
      warnings,
    };
  });
  const warnings = signatureSummaries.flatMap((signature) => signature.warnings);

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "signature_ambiguity",
    contexts,
    signatures: signatureSummaries,
    pairs: pairs.sort((a, b) => b.cosineSimilarity - a.cosineSimilarity),
    catalogSummary: {
      signatureCount: signatureSummaries.length,
      highAmbiguityCount: signatureSummaries.filter(
        (signature) => signature.ambiguityClass === "high"
      ).length,
      moderateAmbiguityCount: signatureSummaries.filter(
        (signature) => signature.ambiguityClass === "moderate"
      ).length,
      reportedPairCount: pairs.length,
    },
    warnings,
  };
}

/**
 * Looks for residual evidence that fitted spectra contain out-of-reference signal.
 *
 * @function detectOutOfReferenceSignal
 * @memberof advisor
 * @param {Object} input - Fitted spectra, signatures, exposures, and optional residuals.
 * @param {Object} [options] - Catalog sufficiency options.
 * @returns {Object} Per-sample catalog sufficiency checks and recommendations.
 */
function detectOutOfReferenceSignal(input = {}, options = {}) {
  const {
    signatures,
    spectra,
    exposures,
    residuals = null,
    reconstructionError = null,
  } = input;
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const normalizedSpectra = normalizeSpectraInput(spectra || input, options);
  const normalizedExposures = normalizeMatrixObject(exposures);
  const contexts = getContextList(normalizedSignatures, normalizedSpectra, options);

  if (!residuals && (!signatures || !spectra || !exposures)) {
    throw new Error(
      "detectOutOfReferenceSignal requires residuals or signatures, spectra, and exposures."
    );
  }

  const residualResult =
    residuals ||
    calculateFitResiduals(normalizedSignatures, normalizedSpectra, normalizedExposures, {
      contexts,
      normalizeMode: options.normalizeMode || "relative",
    });
  const reconstruction =
    reconstructionError ||
    calculateReconstructionError(
      normalizedSignatures,
      normalizedSpectra,
      normalizedExposures,
      { contexts, normalizeMode: options.normalizeMode || "relative" }
    );
  const unexplainedThreshold = options.unexplainedThreshold ?? 0.12;
  const weakUnexplainedThreshold = options.weakUnexplainedThreshold ?? 0.07;
  const cosineThreshold = options.cosineThreshold ?? 0.9;
  const structuredResidualCosineThreshold =
    options.structuredResidualCosineThreshold ?? 0.85;
  const topN = options.topN || 8;

  const samples = residualResult.samples.map((sample) => {
    const reconstructionSample = getReconstructionSample(reconstruction, sample.sample);
    const denominator =
      sample.normalizationMode === "relative"
        ? 2
        : Math.max(sample.metrics.totalObserved || 0, 1);
    const unexplainedFraction = clamp(sample.metrics.l1Error / denominator, 0, 1);
    const residualVector = vectorFromRecord(sample.residuals, contexts);
    const positiveResidualVector = residualVector.map((value) => Math.max(value, 0));
    const residualTotal = sum(positiveResidualVector);
    const residualMatches =
      residualTotal <= 0
        ? []
        : Object.entries(normalizedSignatures)
            .map(([signatureName, signature]) => ({
              signatureName,
              cosineSimilarity: cosineSimilarity(
                positiveResidualVector,
                vectorFromRecord(signature, contexts)
              ),
            }))
            .sort((a, b) => b.cosineSimilarity - a.cosineSimilarity)
            .slice(0, 5);
    const topResidualContexts = contexts
      .map((context, index) => ({
        context,
        residual: residualVector[index],
        absoluteResidual: Math.abs(residualVector[index]),
      }))
      .sort((a, b) => b.absoluteResidual - a.absoluteResidual)
      .slice(0, topN);
    const structuredResidual =
      residualMatches[0]?.cosineSimilarity >= structuredResidualCosineThreshold &&
      unexplainedFraction >= weakUnexplainedThreshold;
    const suspected =
      (reconstructionSample?.cosineSimilarity || 0) < cosineThreshold ||
      unexplainedFraction >= unexplainedThreshold ||
      structuredResidual;
    const possible =
      !suspected &&
      (unexplainedFraction >= weakUnexplainedThreshold ||
        (reconstructionSample?.cosineSimilarity || 0) < cosineThreshold + 0.04);
    const status = suspected
      ? "suspected_out_of_reference"
      : possible
        ? "possible_out_of_reference"
        : "catalog_sufficient_for_fit";
    const warnings = [];

    if (suspected) {
      warnings.push(
        makeWarning(
          WARNING_CODES.CATALOG_INCOMPLETE_SUSPECTED,
          `${sample.sample} has residual structure suggesting that the reference catalog may not explain all signal.`,
          { sample: sample.sample, unexplainedFraction }
        )
      );
    } else if (structuredResidual) {
      warnings.push(
        makeWarning(
          WARNING_CODES.HIGH_RESIDUAL_STRUCTURE,
          `${sample.sample} has structured residual signal despite acceptable aggregate error.`,
          { sample: sample.sample }
        )
      );
    }

    return {
      sample: sample.sample,
      status,
      unexplainedFraction,
      cosineSimilarity: reconstructionSample?.cosineSimilarity ?? null,
      rmse: reconstructionSample?.rmse ?? null,
      structuredResidual,
      residualMatches,
      topResidualContexts,
      warnings,
      recommendedAction:
        status === "suspected_out_of_reference"
          ? "Inspect residual spectrum, test a broader or disease-specific catalog, and consider subgroup discovery."
          : status === "possible_out_of_reference"
            ? "Report residual uncertainty and verify with threshold or bootstrap sensitivity."
            : "Reference catalog appears sufficient for this fitted result.",
    };
  });
  const warnings = samples.flatMap((sample) => sample.warnings);
  const suspectedCount = samples.filter(
    (sample) => sample.status === "suspected_out_of_reference"
  ).length;
  const possibleCount = samples.filter(
    (sample) => sample.status === "possible_out_of_reference"
  ).length;

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "catalog_sufficiency",
    contexts,
    samples,
    overallStatus:
      suspectedCount > 0
        ? "catalog_incomplete_suspected"
        : possibleCount > 0
          ? "catalog_sufficiency_uncertain"
          : "catalog_sufficient_for_fit",
    summary: {
      sampleCount: samples.length,
      suspectedCount,
      possibleCount,
    },
    warnings,
    recommendedActions: uniqueStrings(
      samples.map((sample) => sample.recommendedAction)
    ),
  };
}

/**
 * Computes a composite trust score for signature fitting results.
 *
 * @function computeFitTrust
 * @memberof advisor
 * @param {Object} input - Fitted spectra, signatures, exposures, and optional QC objects.
 * @param {Object} [options] - Trust scoring options.
 * @returns {Object} Per-sample trust scores, classifications, caveats, and next actions.
 */
function computeFitTrust(input = {}, options = {}) {
  const { signatures, spectra, exposures } = input;
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const normalizedSpectra = normalizeSpectraInput(spectra || input, options);
  const normalizedExposures = normalizeMatrixObject(exposures);
  const contexts = getContextList(normalizedSignatures, normalizedSpectra, options);
  const burdenSummary =
    input.burdenSummary ||
    summarizeMutationBurden(normalizedSpectra, {
      expectedContexts: contexts,
      lowBurdenThreshold: options.lowBurdenThreshold || 100,
    });
  const residuals =
    input.residuals ||
    calculateFitResiduals(normalizedSignatures, normalizedSpectra, normalizedExposures, {
      contexts,
      normalizeMode: options.normalizeMode || "relative",
    });
  const reconstructionError =
    input.reconstructionError ||
    calculateReconstructionError(
      normalizedSignatures,
      normalizedSpectra,
      normalizedExposures,
      { contexts, normalizeMode: options.normalizeMode || "relative" }
    );
  const ambiguity =
    input.ambiguity || computeSignatureAmbiguity(normalizedSignatures, { contexts });
  const ambiguityBySignature = indexAmbiguityBySignature(ambiguity);
  const catalogCheck =
    input.catalogCheck ||
    detectOutOfReferenceSignal({
      signatures: normalizedSignatures,
      spectra: normalizedSpectra,
      exposures: normalizedExposures,
      residuals,
      reconstructionError,
      contexts,
    });
  const thresholds = {
    lowBurdenThreshold: options.lowBurdenThreshold || 100,
    moderateBurdenThreshold: options.moderateBurdenThreshold || 1000,
  };
  const weights = {
    burden: 0.18,
    reconstruction: 0.2,
    residual: 0.18,
    bootstrap: 0.14,
    threshold: 0.1,
    ambiguity: 0.1,
    catalog: 0.1,
  };

  const samples = Object.keys(normalizedSpectra).map((sampleName) => {
    const burdenSample = getBurdenSample(burdenSummary, sampleName);
    const reconstructionSample = getReconstructionSample(
      reconstructionError,
      sampleName
    );
    const residualSample = getResidualSample(residuals, sampleName);
    const bootstrapSummary = summarizeBootstrapStability(
      getBootstrapForSample(input.bootstrap, sampleName)
    );
    const thresholdSummary = summarizeThresholdInstability(
      input.thresholdSensitivity,
      sampleName
    );
    const catalogSample = getCatalogCheckForSample(catalogCheck, sampleName);
    const burdenClass = getBurdenClass(burdenSample?.totalMutations || 0, {
      lowBurdenThreshold: thresholds.lowBurdenThreshold,
      moderateBurdenThreshold: thresholds.moderateBurdenThreshold,
    });
    const burdenScore =
      burdenClass === "high"
        ? 1
        : burdenClass === "moderate"
          ? 0.7
          : burdenClass === "low"
            ? 0.35
            : 0;
    const cosine = reconstructionSample?.cosineSimilarity || 0;
    const reconstructionScore =
      cosine >= 0.98
        ? 1
        : cosine >= 0.95
          ? 0.85
          : cosine >= 0.9
            ? 0.65
            : cosine >= 0.8
              ? 0.35
              : 0.1;
    const denominator =
      residualSample?.normalizationMode === "relative"
        ? 2
        : Math.max(residualSample?.metrics?.totalObserved || 0, 1);
    const unexplainedFraction = residualSample
      ? clamp(residualSample.metrics.l1Error / denominator, 0, 1)
      : 1;
    const residualScore = clamp(1 - unexplainedFraction / 0.18);
    const activeSignatures = activeSignatureNames(normalizedExposures[sampleName]);
    const activeAmbiguityClasses = activeSignatures.map(
      (signatureName) =>
        ambiguityBySignature[signatureName]?.ambiguityClass || "low"
    );
    const ambiguityScore = activeAmbiguityClasses.includes("high")
      ? 0.45
      : activeAmbiguityClasses.includes("moderate")
        ? 0.75
        : 1;
    const catalogScore =
      catalogSample?.status === "catalog_sufficient_for_fit"
        ? 1
        : catalogSample?.status === "possible_out_of_reference"
          ? 0.65
          : 0.25;
    const componentScores = {
      burden: burdenScore,
      reconstruction: reconstructionScore,
      residual: residualScore,
      bootstrap: bootstrapSummary.score,
      threshold: thresholdSummary.score,
      ambiguity: ambiguityScore,
      catalog: catalogScore,
    };
    const score = Math.round(
      100 *
        Object.entries(weights).reduce(
          (total, [component, weight]) =>
            total + componentScores[component] * weight,
          0
        )
    );
    const classification = classifyTrust(score);
    const warnings = [];

    if (burdenClass === "low" || burdenClass === "insufficient") {
      warnings.push(
        makeWarning(
          burdenClass === "low"
            ? WARNING_CODES.LOW_BURDEN
            : WARNING_CODES.INSUFFICIENT_SIGNAL,
          `${sampleName} has ${burdenClass} mutation burden for the selected analysis.`,
          { sample: sampleName }
        )
      );
    }
    if (bootstrapSummary.measured && bootstrapSummary.score < 0.55) {
      warnings.push(
        makeWarning(
          WARNING_CODES.FIT_UNSTABLE,
          `${sampleName} has bootstrap-unstable exposure estimates.`,
          { sample: sampleName }
        )
      );
    }
    if (thresholdSummary.measured && thresholdSummary.score < 0.55) {
      warnings.push(
        makeWarning(
          WARNING_CODES.THRESHOLD_DEPENDENT,
          `${sampleName} has threshold-dependent exposure estimates.`,
          { sample: sampleName }
        )
      );
    }
    if (activeAmbiguityClasses.includes("high")) {
      warnings.push(
        makeWarning(
          WARNING_CODES.SIGNATURE_AMBIGUITY,
          `${sampleName} contains active signatures that are hard to distinguish from nearby catalog signatures.`,
          { sample: sampleName, activeSignatures }
        )
      );
    }
    if (catalogSample?.status === "suspected_out_of_reference") {
      warnings.push(...catalogSample.warnings);
    }

    return {
      sample: sampleName,
      score,
      classification,
      componentScores,
      metrics: {
        burdenClass,
        totalMutations: burdenSample?.totalMutations ?? null,
        cosineSimilarity: cosine,
        rmse: reconstructionSample?.rmse ?? null,
        unexplainedFraction,
        activeSignatures,
      },
      bootstrap: bootstrapSummary,
      thresholdSensitivity: thresholdSummary,
      catalogStatus: catalogSample?.status || "not_checked",
      warnings,
      caveats: warnings.map((warning) => warning.message),
      recommendedActions: uniqueStrings([
        bootstrapSummary.recommendation,
        thresholdSummary.recommendation,
        catalogSample?.recommendedAction,
        classification === "low_confidence" || classification === "not_assessable"
          ? "Restrict interpretation to high-level evidence calls and report caveats."
          : "Report fitted exposures with the trust classification and residual checks.",
      ]),
    };
  });

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "fit_trust",
    contexts,
    weights,
    samples,
    summary: {
      sampleCount: samples.length,
      meanTrustScore: average(samples.map((sample) => sample.score)),
      highConfidenceCount: samples.filter(
        (sample) => sample.classification === "high_confidence"
      ).length,
      moderateConfidenceCount: samples.filter(
        (sample) => sample.classification === "moderate_confidence"
      ).length,
      lowOrNotAssessableCount: samples.filter(
        (sample) =>
          sample.classification === "low_confidence" ||
          sample.classification === "not_assessable"
      ).length,
    },
    warnings: samples.flatMap((sample) => sample.warnings),
    recommendedActions: uniqueStrings(
      samples.flatMap((sample) => sample.recommendedActions)
    ),
  };
}

/**
 * Runs an opinionated single-sample signature refitting workflow.
 *
 * @async
 * @function runSingleSampleFit
 * @memberof pipelines
 * @param {Object} input - Input spectrum and reference signatures.
 * @param {Object} [options] - Fitting, bootstrap, threshold, and reporting options.
 * @returns {Promise<Object>} Fitted spectrum, trust, ambiguity, residuals, catalog check, and report artifacts.
 */
async function runSingleSampleFit(input = {}, options = {}) {
  const sampleName = input.sampleName || options.sampleName || "sample_1";
  const spectra = normalizeSpectraInput(input.spectra || input.spectrum || input, {
    sampleName,
  });
  const selectedSample = spectra[sampleName] ? sampleName : Object.keys(spectra)[0];
  const singleSpectra = selectedSample ? { [selectedSample]: spectra[selectedSample] } : {};
  const signatures = normalizeMatrixObject(
    input.signatures || input.referenceSignatures || options.signatures || {}
  );
  const contexts = getContextList(signatures, singleSpectra, options);

  if (Object.keys(singleSpectra).length === 0) {
    throw new Error("runSingleSampleFit requires one spectrum or spectra matrix.");
  }
  if (Object.keys(signatures).length === 0) {
    throw new Error("runSingleSampleFit requires reference signatures.");
  }

  const advisor = recommendAnalysisStrategy(singleSpectra, {
    ...options,
    expectedContexts: contexts,
  });
  const validation = {
    spectra: validateSpectra(singleSpectra, {
      expectedContexts: contexts,
      minTotalMutations: options.lowBurdenThreshold || 100,
    }),
    signatures: validateSignatureMatrix(signatures, { expectedContexts: contexts }),
  };
  const fitOptions = {
    contexts,
    exposureThreshold: options.exposureThreshold || 0,
    exposureType: options.exposureType || "relative",
    renormalize: options.renormalize !== false,
  };
  const exposures = await fitSpectraWithNNLS(signatures, singleSpectra, fitOptions);
  const residuals = calculateFitResiduals(signatures, singleSpectra, exposures, {
    contexts,
    normalizeMode: fitOptions.exposureType,
  });
  const reconstructionError = calculateReconstructionError(
    signatures,
    singleSpectra,
    exposures,
    { contexts, normalizeMode: fitOptions.exposureType }
  );
  const thresholdSensitivity =
    options.runThresholdSensitivity === false
      ? null
      : await runThresholdSensitivity(signatures, singleSpectra, {
          contexts,
          thresholds: options.thresholds || [0, 0.01, 0.03, 0.05, 0.1],
          exposureType: fitOptions.exposureType,
          renormalize: fitOptions.renormalize,
        });
  const bootstrap =
    options.runBootstrap === false
      ? null
      : {
          [selectedSample]: await bootstrapSignatureFit(
            signatures,
            singleSpectra[selectedSample],
            {
              contexts,
              iterations: options.bootstrapIterations || 100,
              confidenceLevel: options.confidenceLevel || 0.95,
              exposureThreshold: fitOptions.exposureThreshold,
              exposureType: fitOptions.exposureType,
              renormalize: fitOptions.renormalize,
              seed: options.seed || 123,
            }
          ),
        };
  const ambiguity = computeSignatureAmbiguity(signatures, { contexts });
  const catalogCheck = detectOutOfReferenceSignal({
    signatures,
    spectra: singleSpectra,
    exposures,
    residuals,
    reconstructionError,
    contexts,
  });
  const trust = computeFitTrust({
    signatures,
    spectra: singleSpectra,
    exposures,
    burdenSummary: advisor.mutationBurden,
    residuals,
    reconstructionError,
    bootstrap,
    thresholdSensitivity,
    ambiguity,
    catalogCheck,
    contexts,
  });
  const report = createAnalysisReport(
    {
      title: "mSigSDK Single-Sample Signature Fit Report",
      summary:
        "Opinionated single-sample refitting workflow with burden-aware guidance, uncertainty, residual checks, and trust classification.",
      parameters: {
        workflow: "runSingleSampleFit",
        fitOptions,
        thresholds: advisor.thresholds,
      },
      validation,
      qc: {
        mutationBurden: advisor.mutationBurden,
        contextCoverage: advisor.contextCoverage,
        reconstructionError,
        trust: trust.summary,
        catalogCheck: catalogCheck.summary,
      },
      exposures,
      notes: advisor.caveats,
    },
    { format: options.reportFormat || "object" }
  );

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "single_sample_fit",
    sample: selectedSample,
    spectrum: singleSpectra[selectedSample],
    validation,
    advisor,
    fit: {
      method: "NNLS",
      exposures,
      parameters: fitOptions,
      reconstructionError,
    },
    trust,
    ambiguity,
    residuals,
    catalogCheck,
    thresholdSensitivity,
    bootstrap,
    recommendedActions: uniqueStrings([
      ...advisor.recommendedActions,
      ...trust.recommendedActions,
      ...catalogCheck.recommendedActions,
    ]),
    publicationFigures: buildPublicationFigureDescriptors("single_sample", {
      single_sample_exposure: ["fit.exposures", "bootstrap"],
      reconstruction_residuals: ["residuals"],
      trust_dashboard: ["trust"],
    }),
    report,
  };
}

function clusterSamplesBySimilarity(spectra, contexts, threshold = 0.85) {
  const sampleNames = Object.keys(spectra);
  const adjacency = Object.fromEntries(
    sampleNames.map((sampleName) => [sampleName, new Set()])
  );

  for (let i = 0; i < sampleNames.length; i++) {
    for (let j = i + 1; j < sampleNames.length; j++) {
      const sampleA = sampleNames[i];
      const sampleB = sampleNames[j];
      const similarity = cosineSimilarity(
        vectorFromRecord(spectra[sampleA], contexts),
        vectorFromRecord(spectra[sampleB], contexts)
      );
      if (similarity >= threshold) {
        adjacency[sampleA].add(sampleB);
        adjacency[sampleB].add(sampleA);
      }
    }
  }

  const visited = new Set();
  const clusters = [];
  for (const sampleName of sampleNames) {
    if (visited.has(sampleName)) {
      continue;
    }
    const stack = [sampleName];
    const members = [];
    visited.add(sampleName);
    while (stack.length > 0) {
      const current = stack.pop();
      members.push(current);
      for (const next of adjacency[current]) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
    clusters.push({
      clusterId: `cluster_${clusters.length + 1}`,
      sampleCount: members.length,
      samples: members,
    });
  }

  return clusters.sort((a, b) => b.sampleCount - a.sampleCount);
}

function normalizeMetadataInput(metadata) {
  if (Array.isArray(metadata)) {
    return Object.fromEntries(
      metadata
        .map((row) => {
          const sample =
            row.sample ||
            row.sampleName ||
            row.Tumor_Sample_Barcode ||
            row.id ||
            row.Sample;
          return sample ? [String(sample), row] : null;
        })
        .filter(Boolean)
    );
  }

  if (isPlainObject(metadata)) {
    return metadata;
  }

  return {};
}

function summarizeNumeric(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  const mean = average(finiteValues);
  const median = quantile(finiteValues, 0.5);
  const variance =
    finiteValues.length <= 1
      ? 0
      : sum(finiteValues.map((value) => (value - mean) ** 2)) /
        (finiteValues.length - 1);

  return {
    n: finiteValues.length,
    mean,
    median,
    variance,
    sd: Math.sqrt(variance),
  };
}

function permutationPValue(groupAValues, groupBValues, iterations = 0, seed = 123) {
  if (iterations <= 0 || groupAValues.length === 0 || groupBValues.length === 0) {
    return null;
  }

  const observed = Math.abs(average(groupAValues) - average(groupBValues));
  const pooled = [...groupAValues, ...groupBValues];
  const groupASize = groupAValues.length;
  const random = seededRandom(seed);
  let extremeCount = 0;

  for (let iteration = 0; iteration < iterations; iteration++) {
    const shuffled = [...pooled];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    const permutedA = shuffled.slice(0, groupASize);
    const permutedB = shuffled.slice(groupASize);
    const permutedDifference = Math.abs(average(permutedA) - average(permutedB));
    if (permutedDifference >= observed) {
      extremeCount += 1;
    }
  }

  return (extremeCount + 1) / (iterations + 1);
}

function adjustBenjaminiHochberg(comparisons) {
  const rows = comparisons
    .filter((comparison) => Number.isFinite(comparison.pValue))
    .sort((a, b) => a.pValue - b.pValue);
  let runningMinimum = 1;

  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index];
    const rank = index + 1;
    runningMinimum = Math.min(runningMinimum, (row.pValue * rows.length) / rank);
    row.qValue = clamp(runningMinimum, 0, 1);
  }

  return comparisons.map((comparison) => ({
    ...comparison,
    qValue: comparison.qValue ?? null,
  }));
}

/**
 * Compares fitted signature exposures between metadata-defined sample groups.
 *
 * @function compareSignatureExposures
 * @memberof advisor
 * @param {Object<string,Object<string,number>>} exposures - Sample-by-signature exposure matrix.
 * @param {Object[]|Object<string,Object>} metadata - Sample metadata rows or object keyed by sample.
 * @param {Object} [options] - Group comparison options.
 * @returns {Object} Group summaries, pairwise exposure comparisons, warnings, and recommendations.
 */
function compareSignatureExposures(exposures, metadata, options = {}) {
  const normalizedExposures = normalizeMatrixObject(exposures);
  const normalizedMetadata = normalizeMetadataInput(metadata);
  const groupKey = options.groupKey || options.comparisonKey || "group";
  const minGroupSize = options.minGroupSize || 3;
  const permutationIterations = options.permutationIterations || 0;
  const signatureNames = uniqueStrings(
    Object.values(normalizedExposures).flatMap((row) => Object.keys(row))
  );
  const rows = Object.entries(normalizedExposures)
    .map(([sample, exposureRow]) => ({
      sample,
      group: normalizedMetadata[sample]?.[groupKey],
      exposureRow,
    }))
    .filter((row) => row.group !== undefined && row.group !== null && row.group !== "");
  const groups = uniqueStrings(rows.map((row) => String(row.group)));
  const warnings = [];

  if (rows.length === 0 || groups.length < 2) {
    warnings.push(
      makeWarning(
        WARNING_CODES.METADATA_MISSING,
        `No usable metadata groups were found for comparison key "${groupKey}".`,
        { groupKey }
      )
    );
    return {
      schemaVersion: RESULT_SCHEMA_VERSION,
      workflowRole: "cohort_group_comparison",
      groupKey,
      groups: [],
      comparisons: [],
      warnings,
      recommendedActions: [
        "Provide sample metadata with at least two groups to compare fitted exposures.",
      ],
    };
  }

  const groupSummaries = groups.map((group) => {
    const sampleNames = rows
      .filter((row) => String(row.group) === group)
      .map((row) => row.sample);
    if (sampleNames.length < minGroupSize) {
      warnings.push(
        makeWarning(
          WARNING_CODES.GROUP_IMBALANCE,
          `${groupKey}=${group} contains fewer than ${minGroupSize} samples.`,
          { groupKey, group, sampleCount: sampleNames.length }
        )
      );
    }
    return {
      group,
      sampleCount: sampleNames.length,
      samples: sampleNames,
    };
  });
  const referenceGroup = options.referenceGroup
    ? String(options.referenceGroup)
    : groups[0];
  const comparisonGroups = groups.filter((group) => group !== referenceGroup);
  const comparisons = [];

  for (const comparisonGroup of comparisonGroups) {
    for (const signatureName of signatureNames) {
      const referenceValues = rows
        .filter((row) => String(row.group) === referenceGroup)
        .map((row) => row.exposureRow[signatureName] || 0);
      const comparisonValues = rows
        .filter((row) => String(row.group) === comparisonGroup)
        .map((row) => row.exposureRow[signatureName] || 0);
      const referenceSummary = summarizeNumeric(referenceValues);
      const comparisonSummary = summarizeNumeric(comparisonValues);
      const pooledSd = Math.sqrt(
        (referenceSummary.variance + comparisonSummary.variance) / 2
      );
      const meanDifference =
        (comparisonSummary.mean || 0) - (referenceSummary.mean || 0);
      const effectSize = pooledSd > 0 ? meanDifference / pooledSd : 0;
      const pValue = permutationPValue(
        referenceValues,
        comparisonValues,
        permutationIterations,
        (options.seed || 123) + comparisons.length
      );

      comparisons.push({
        signatureName,
        referenceGroup,
        comparisonGroup,
        reference: referenceSummary,
        comparison: comparisonSummary,
        meanDifference,
        absoluteMeanDifference: Math.abs(meanDifference),
        effectSize,
        pValue,
        qValue: null,
      });
    }
  }

  const adjustedComparisons = adjustBenjaminiHochberg(comparisons).sort(
    (a, b) =>
      b.absoluteMeanDifference - a.absoluteMeanDifference ||
      Math.abs(b.effectSize) - Math.abs(a.effectSize)
  );
  const topSignals = adjustedComparisons
    .filter((comparison) => comparison.absoluteMeanDifference > 0)
    .slice(0, options.topN || 10);

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "cohort_group_comparison",
    groupKey,
    groups: groupSummaries,
    referenceGroup,
    comparisonGroups,
    permutationIterations,
    comparisons: adjustedComparisons,
    topSignals,
    warnings,
    recommendedActions: uniqueStrings([
      warnings.length > 0
        ? "Interpret group differences cautiously because at least one group is small or metadata is incomplete."
        : null,
      permutationIterations > 0
        ? "Report permutation p-values with effect sizes; avoid relying on p-values alone for low-burden cohorts."
        : "Report group means and effect sizes; enable permutationIterations for manuscript-level inference.",
    ]),
  };
}

function subsetMatrixBySamples(matrix, sampleNames) {
  return Object.fromEntries(
    sampleNames
      .filter((sampleName) => matrix[sampleName])
      .map((sampleName) => [sampleName, matrix[sampleName]])
  );
}

function shortlistReferenceSignatures(comparison, options = {}) {
  const minMatchCosine = options.minMatchCosine || 0.85;
  const topN = options.topN || 8;
  const matched = uniqueStrings(
    (comparison || [])
      .flatMap((signature) =>
        (signature.matches || [])
          .filter((match) => match.cosineSimilarity >= minMatchCosine)
          .map((match) => match.referenceName)
      )
  );

  if (matched.length > 0) {
    return matched.slice(0, topN);
  }

  return uniqueStrings(
    (comparison || [])
      .map((signature) => signature.bestMatch?.referenceName)
      .filter(Boolean)
  ).slice(0, topN);
}

/**
 * Runs subgroup-aware NMF extraction and optional matched-reference refitting.
 *
 * @async
 * @function runSubgroupDiscoveryWorkflow
 * @memberof pipelines
 * @param {Object} input - Cohort spectra, optional signatures, and optional subgroups.
 * @param {Object} [options] - Subgroup extraction options.
 * @returns {Promise<Object>} Subgroup extraction/refit summaries and skipped subgroup caveats.
 */
async function runSubgroupDiscoveryWorkflow(input = {}, options = {}) {
  const spectra = normalizeSpectraInput(input.spectra || input, options);
  const referenceSignatures = normalizeMatrixObject(
    input.referenceSignatures || input.signatures || options.referenceSignatures || {}
  );
  const contexts = getContextList(referenceSignatures, spectra, options);
  const subgroups =
    input.subgroups ||
    clusterSamplesBySimilarity(
      spectra,
      contexts,
      options.clusterCosineThreshold || 0.85
    );
  const minSubgroupSamples = options.minSubgroupSamples || 5;
  const minMedianBurden = options.minMedianBurden || 750;
  const subgroupResults = [];
  const warnings = [];

  for (const subgroup of subgroups) {
    const subgroupSpectra = subsetMatrixBySamples(spectra, subgroup.samples || []);
    const sampleNames = Object.keys(subgroupSpectra);
    const burden = summarizeMutationBurden(subgroupSpectra, {
      expectedContexts: contexts,
      lowBurdenThreshold: options.lowBurdenThreshold || 100,
    });
    const medianMutationBurden = quantile(
      burden.samples.map((sample) => sample.totalMutations),
      0.5
    );

    if (
      sampleNames.length < minSubgroupSamples ||
      !Number.isFinite(medianMutationBurden) ||
      medianMutationBurden < minMedianBurden
    ) {
      const warning = makeWarning(
        WARNING_CODES.SUBGROUP_EXTRACTION_SKIPPED,
        `${subgroup.clusterId || "subgroup"} was not extracted because sample count or mutation burden was too low.`,
        {
          subgroupId: subgroup.clusterId,
          sampleCount: sampleNames.length,
          medianMutationBurden,
        }
      );
      warnings.push(warning);
      subgroupResults.push({
        subgroupId: subgroup.clusterId,
        samples: sampleNames,
        sampleCount: sampleNames.length,
        medianMutationBurden,
        status: "skipped",
        warnings: [warning],
        extraction: null,
        comparison: null,
        refit: null,
      });
      continue;
    }

    const rank =
      options.rank ||
      Math.min(
        options.maxRank || 4,
        Math.max(options.minRank || 2, Math.floor(sampleNames.length / 3))
      );
    const extraction = extractSignaturesNMF(subgroupSpectra, {
      contexts,
      rank,
      maxIterations: options.maxIterations || 750,
      tolerance: options.tolerance || 1e-5,
      nRuns: options.nRuns || 10,
      seed: (options.seed || 123) + subgroupResults.length * 101,
      signaturePrefix: `${subgroup.clusterId || "cluster"}_NMF`,
    });
    const comparison =
      Object.keys(referenceSignatures).length > 0
        ? compareExtractedToReference(extraction, referenceSignatures, {
            contexts,
            topN: options.topN || 5,
          })
        : null;
    const shortlistedSignatureNames = shortlistReferenceSignatures(comparison, {
      minMatchCosine: options.minMatchCosine || 0.85,
      topN: options.shortlistTopN || 8,
    });
    const shortlistedSignatures = Object.fromEntries(
      shortlistedSignatureNames
        .filter((signatureName) => referenceSignatures[signatureName])
        .map((signatureName) => [signatureName, referenceSignatures[signatureName]])
    );
    const refit =
      Object.keys(shortlistedSignatures).length > 0
        ? {
            signatures: shortlistedSignatureNames,
            exposures: await fitSpectraWithNNLS(
              shortlistedSignatures,
              subgroupSpectra,
              {
                contexts,
                exposureThreshold: options.refitExposureThreshold || 0,
                exposureType: options.exposureType || "relative",
                renormalize: options.renormalize !== false,
              }
            ),
          }
        : null;

    if (refit) {
      refit.reconstructionError = calculateReconstructionError(
        shortlistedSignatures,
        subgroupSpectra,
        refit.exposures,
        { contexts, normalizeMode: options.exposureType || "relative" }
      );
    }

    subgroupResults.push({
      subgroupId: subgroup.clusterId,
      samples: sampleNames,
      sampleCount: sampleNames.length,
      medianMutationBurden,
      status: "extracted",
      rank,
      extraction,
      comparison,
      shortlistedSignatureNames,
      refit,
      warnings: [],
    });
  }

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "subgroup_discovery",
    contexts,
    subgroups: subgroupResults,
    summary: {
      subgroupCount: subgroupResults.length,
      extractedSubgroupCount: subgroupResults.filter(
        (subgroup) => subgroup.status === "extracted"
      ).length,
      skippedSubgroupCount: subgroupResults.filter(
        (subgroup) => subgroup.status === "skipped"
      ).length,
    },
    warnings,
    recommendedActions: uniqueStrings([
      warnings.length > 0
        ? "Use subgroup discovery only for sufficiently large, information-rich clusters."
        : null,
      "Compare extracted subgroup signatures to the reference catalog, then refit with the matched shortlist before biological interpretation.",
    ]),
  };
}

/**
 * Runs an opinionated cohort refitting workflow with subgroup guidance.
 *
 * @async
 * @function runCohortFit
 * @memberof pipelines
 * @param {Object} input - Cohort spectra and reference signatures.
 * @param {Object} [options] - Fitting and reporting options.
 * @returns {Promise<Object>} Cohort fit, subgroup structure, trust scores, residuals, and report artifacts.
 */
async function runCohortFit(input = {}, options = {}) {
  const spectra = normalizeSpectraInput(input.spectra || input, options);
  const signatures = normalizeMatrixObject(
    input.signatures || input.referenceSignatures || options.signatures || {}
  );
  const metadata = normalizeMetadataInput(input.metadata || options.metadata);
  const groupKey = input.groupKey || options.groupKey || options.comparisonKey;
  const contexts = getContextList(signatures, spectra, options);

  if (Object.keys(spectra).length === 0) {
    throw new Error("runCohortFit requires a sample spectra matrix.");
  }
  if (Object.keys(signatures).length === 0) {
    throw new Error("runCohortFit requires reference signatures.");
  }

  const advisor = recommendAnalysisStrategy(spectra, {
    ...options,
    expectedContexts: contexts,
  });
  const validation = {
    spectra: validateSpectra(spectra, {
      expectedContexts: contexts,
      minTotalMutations: options.lowBurdenThreshold || 100,
    }),
    signatures: validateSignatureMatrix(signatures, { expectedContexts: contexts }),
  };
  const fitOptions = {
    contexts,
    exposureThreshold: options.exposureThreshold || 0,
    exposureType: options.exposureType || "relative",
    renormalize: options.renormalize !== false,
  };
  const exposures = await fitSpectraWithNNLS(signatures, spectra, fitOptions);
  const residuals = calculateFitResiduals(signatures, spectra, exposures, {
    contexts,
    normalizeMode: fitOptions.exposureType,
  });
  const reconstructionError = calculateReconstructionError(
    signatures,
    spectra,
    exposures,
    { contexts, normalizeMode: fitOptions.exposureType }
  );
  const thresholdSensitivity =
    options.runThresholdSensitivity === false
      ? null
      : await runThresholdSensitivity(signatures, spectra, {
          contexts,
          thresholds: options.thresholds || [0, 0.01, 0.03, 0.05, 0.1],
          exposureType: fitOptions.exposureType,
          renormalize: fitOptions.renormalize,
        });
  const bootstrap = {};
  if (options.runBootstrap) {
    const bootstrapSampleLimit = options.bootstrapSampleLimit || 5;
    for (const sampleName of Object.keys(spectra).slice(0, bootstrapSampleLimit)) {
      bootstrap[sampleName] = await bootstrapSignatureFit(
        signatures,
        spectra[sampleName],
        {
          contexts,
          iterations: options.bootstrapIterations || 100,
          confidenceLevel: options.confidenceLevel || 0.95,
          exposureThreshold: fitOptions.exposureThreshold,
          exposureType: fitOptions.exposureType,
          renormalize: fitOptions.renormalize,
          seed: (options.seed || 123) + Object.keys(bootstrap).length,
        }
      );
    }
  }
  const ambiguity = computeSignatureAmbiguity(signatures, { contexts });
  const catalogCheck = detectOutOfReferenceSignal({
    signatures,
    spectra,
    exposures,
    residuals,
    reconstructionError,
    contexts,
  });
  const trust = computeFitTrust({
    signatures,
    spectra,
    exposures,
    burdenSummary: advisor.mutationBurden,
    residuals,
    reconstructionError,
    bootstrap,
    thresholdSensitivity,
    ambiguity,
    catalogCheck,
    contexts,
  });
  const subgroups = clusterSamplesBySimilarity(
    spectra,
    contexts,
    options.clusterCosineThreshold || 0.85
  );
  const eligibleSubgroupCount = subgroups.filter(
    (subgroup) => subgroup.sampleCount >= (options.minSubgroupSamples || 5)
  ).length;
  const shouldRunSubgroupDiscovery =
    options.runSubgroupDiscovery === true ||
    (options.runSubgroupDiscovery !== false &&
      subgroups.length > 1 &&
      eligibleSubgroupCount > 0 &&
      Object.keys(spectra).length <= (options.maxAutoSubgroupExtractionSamples || 30));
  const subgroupDiscovery = shouldRunSubgroupDiscovery
    ? await runSubgroupDiscoveryWorkflow(
        {
          spectra,
          referenceSignatures: signatures,
          subgroups,
        },
        {
          ...options,
          contexts,
        }
      )
    : {
        schemaVersion: RESULT_SCHEMA_VERSION,
        workflow: "subgroup_discovery",
        status: "not_run",
        reason:
          subgroups.length <= 1
            ? "Cohort similarity graph produced one subgroup."
            : "Subgroup discovery was not requested or exceeded automatic extraction limits.",
        subgroups: [],
        summary: {
          subgroupCount: subgroups.length,
          extractedSubgroupCount: 0,
          skippedSubgroupCount: 0,
        },
        warnings:
          subgroups.length > 1
            ? [
                makeWarning(
                  WARNING_CODES.SUBGROUP_EXTRACTION_SKIPPED,
                  "Subgroup extraction was not run automatically; enable runSubgroupDiscovery for extraction and matched refitting.",
                  { subgroupCount: subgroups.length }
                ),
              ]
            : [],
        recommendedActions:
          subgroups.length > 1
            ? [
                "Enable runSubgroupDiscovery for heterogeneous cohorts with sufficiently high mutation burden.",
              ]
            : [],
      };
  const groupComparison =
    groupKey && Object.keys(metadata).length > 0
      ? compareSignatureExposures(exposures, metadata, {
          ...options.comparison,
          groupKey,
          permutationIterations:
            options.permutationIterations ||
            options.comparison?.permutationIterations ||
            0,
          seed: options.seed || 123,
        })
      : null;
  const report = createAnalysisReport(
    {
      title: "mSigSDK Cohort Signature Fit Report",
      summary:
        "Opinionated cohort refitting workflow with burden-aware sample flags, subgroup structure, residual checks, and trust classifications.",
      parameters: {
        workflow: "runCohortFit",
        fitOptions,
        thresholds: advisor.thresholds,
        clusterCosineThreshold: options.clusterCosineThreshold || 0.85,
      },
      validation,
      qc: {
        mutationBurden: advisor.mutationBurden,
        contextCoverage: advisor.contextCoverage,
        reconstructionError,
        trust: trust.summary,
        catalogCheck: catalogCheck.summary,
        subgroups,
        subgroupDiscovery: subgroupDiscovery.summary,
        groupComparison:
          groupComparison && {
            groupKey: groupComparison.groupKey,
            groups: groupComparison.groups,
            topSignals: groupComparison.topSignals,
          },
      },
      exposures,
      notes: advisor.caveats,
    },
    { format: options.reportFormat || "object" }
  );

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "cohort_fit",
    validation,
    advisor,
    cohort: advisor.cohort,
    subgroups,
    subgroupDiscovery,
    groupComparison,
    fit: {
      method: "NNLS",
      exposures,
      parameters: fitOptions,
      reconstructionError,
    },
    trust,
    ambiguity,
    residuals,
    catalogCheck,
    thresholdSensitivity,
    bootstrap,
    recommendedActions: uniqueStrings([
      ...advisor.recommendedActions,
      ...trust.recommendedActions,
      ...catalogCheck.recommendedActions,
      ...subgroupDiscovery.recommendedActions,
      ...(groupComparison?.recommendedActions || []),
    ]),
    publicationFigures: buildPublicationFigureDescriptors("cohort", {
      cohort_exposure_heatmap: ["fit.exposures", "trust", "advisor.mutationBurden"],
      sample_similarity: ["cohort.similarity", "subgroups"],
      reconstruction_residuals: ["residuals"],
      trust_dashboard: ["trust"],
      group_comparison: groupComparison ? ["groupComparison"] : [],
      subgroup_discovery: ["subgroupDiscovery"],
    }),
    report,
  };
}

/**
 * Runs cohort discovery with burden-aware gating, NMF rank selection, and reference matching.
 *
 * @function runDiscoveryWorkflow
 * @memberof pipelines
 * @param {Object} input - Cohort spectra and optional reference signatures.
 * @param {Object} [options] - Discovery options.
 * @returns {Object} Advisor, optional extraction, reference matches, and publication artifacts.
 */
function runDiscoveryWorkflow(input = {}, options = {}) {
  const spectra = normalizeSpectraInput(input.spectra || input, options);
  const referenceSignatures = normalizeMatrixObject(
    input.referenceSignatures || input.signatures || options.referenceSignatures || {}
  );
  const contexts = getContextList(referenceSignatures, spectra, options);
  const advisor = recommendAnalysisStrategy(spectra, {
    ...options,
    expectedContexts: contexts,
  });
  const shouldExtract = options.forceExtraction || advisor.cohort.canConsiderExtraction;

  if (!shouldExtract) {
    return {
      schemaVersion: RESULT_SCHEMA_VERSION,
      workflow: "discovery_workflow",
      advisor,
      extraction: null,
      comparison: null,
      warnings: [
        makeWarning(
          WARNING_CODES.EXTRACTION_NOT_RECOMMENDED,
          "Discovery was not run because burden, sample count, or heterogeneity did not support stable extraction."
        ),
      ],
      recommendedActions: advisor.recommendedActions,
      publicationFigures: buildPublicationFigureDescriptors("discovery"),
    };
  }

  const rankSelection =
    options.rank || options.runRankSelection === false
      ? null
      : selectNMFRank(spectra, {
          contexts,
          ranks: options.ranks || [2, 3, 4, 5],
          maxIterations: options.maxIterations || 500,
          tolerance: options.tolerance || 1e-5,
          nRuns: options.nRuns || 5,
          seed: options.seed || 123,
        });
  const rank = options.rank || rankSelection?.recommendedRank || 3;
  const extraction = extractSignaturesNMF(spectra, {
    contexts,
    rank,
    maxIterations: options.maxIterations || 1000,
    tolerance: options.tolerance || 1e-5,
    nRuns: options.nRuns || 20,
    seed: options.seed || 123,
    signaturePrefix: options.signaturePrefix || "NMF",
  });
  const comparison =
    Object.keys(referenceSignatures).length > 0
      ? compareExtractedToReference(extraction, referenceSignatures, {
          contexts,
          topN: options.topN || 5,
        })
      : null;
  const reconstructionError = calculateReconstructionError(
    extraction.signatures,
    spectra,
    extraction.exposures,
    { contexts, normalizeMode: "relative" }
  );

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "discovery_workflow",
    advisor,
    rankSelection,
    extraction,
    comparison,
    qc: {
      mutationBurden: advisor.mutationBurden,
      reconstructionError,
    },
    recommendedActions: uniqueStrings([
      ...advisor.recommendedActions,
      "Match extracted signatures to reference catalogs and refit per sample with a shortlisted catalog.",
    ]),
    publicationFigures: buildPublicationFigureDescriptors("discovery", {
      nmf_stability: ["rankSelection", "extraction.runMetrics"],
      cohort_exposure_heatmap: ["extraction.exposures"],
    }),
  };
}

function normalizeByCallableOpportunities(spectra, opportunities, contexts) {
  if (!isPlainObject(opportunities)) {
    return { spectra, applied: false };
  }

  const sampleSpecific = Object.values(opportunities).some(isPlainObject);
  const normalized = {};

  for (const [sampleName, spectrum] of Object.entries(spectra)) {
    const opportunityRecord = sampleSpecific
      ? opportunities[sampleName] || {}
      : opportunities;
    const rates = contexts.map((context) => {
      const opportunity = toFiniteNumber(opportunityRecord[context]);
      const count = spectrum[context] || 0;
      return opportunity && opportunity > 0 ? count / opportunity : 0;
    });
    const totalCount = sum(contexts.map((context) => spectrum[context] || 0));
    const scaledRates = normalizeVector(rates, totalCount);
    normalized[sampleName] = Object.fromEntries(
      contexts.map((context, index) => [context, scaledRates[index]])
    );
  }

  return { spectra: normalized, applied: true };
}

function computeDetectabilityConfidence({
  burden,
  exposure,
  flatnessScore,
  nearestCosineSimilarity,
  opportunityCoverage = 1,
}) {
  const distinctiveness = clamp(1 - nearestCosineSimilarity, 0.03, 1);
  const flatnessPenalty = 1 + clamp(flatnessScore, 0, 1) * 0.9;
  const ambiguityPenalty = 1 + clamp(nearestCosineSimilarity, 0, 1) * 1.35;
  const effectiveSignal =
    Math.max(burden, 0) *
    Math.max(exposure, 0) *
    Math.max(exposure, 0) *
    distinctiveness *
    clamp(opportunityCoverage, 0.05, 1);
  const confidence = 1 - Math.exp(-effectiveSignal / (8 * flatnessPenalty * ambiguityPenalty));

  return clamp(confidence, 0, 1);
}

/**
 * Estimates burden/exposure detectability curves for reference signatures.
 *
 * @function estimateSignatureDetectability
 * @memberof advisor
 * @param {Object<string,Object<string,number>>} signatures - Reference signature matrix.
 * @param {Object} [options] - Detectability options.
 * @returns {Object} Signature-specific burden/exposure curves and assessability warnings.
 */
function estimateSignatureDetectability(signatures, options = {}) {
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const contexts = getContextList(normalizedSignatures, null, options);
  const ambiguity = computeSignatureAmbiguity(normalizedSignatures, { contexts });
  const burdens = options.burdens || [25, 50, 100, 250, 500, 1000, 2500];
  const exposureLevels = options.exposureLevels || [0.05, 0.1, 0.2, 0.3, 0.5];
  const targetConfidence = options.targetConfidence || 0.8;
  const opportunityCoverage = options.opportunityCoverage || 1;
  const signaturesResult = ambiguity.signatures.map((signature) => {
    const curves = burdens.flatMap((burden) =>
      exposureLevels.map((exposure) => ({
        burden,
        exposure,
        confidence: computeDetectabilityConfidence({
          burden,
          exposure,
          flatnessScore: signature.flatnessScore,
          nearestCosineSimilarity: signature.nearestCosineSimilarity,
          opportunityCoverage,
        }),
      }))
    );
    const minBurdenByExposure = Object.fromEntries(
      exposureLevels.map((exposure) => {
        const burdenHit = burdens.find((burden) => {
          const curve = curves.find(
            (entry) => entry.burden === burden && entry.exposure === exposure
          );
          return curve && curve.confidence >= targetConfidence;
        });
        return [String(exposure), burdenHit || null];
      })
    );
    const notAssessableAtLowBurden =
      computeDetectabilityConfidence({
        burden: burdens[1] || burdens[0],
        exposure: exposureLevels[Math.min(2, exposureLevels.length - 1)],
        flatnessScore: signature.flatnessScore,
        nearestCosineSimilarity: signature.nearestCosineSimilarity,
        opportunityCoverage,
      }) < 0.35;

    return {
      signatureName: signature.signatureName,
      ambiguityClass: signature.ambiguityClass,
      flatnessScore: signature.flatnessScore,
      nearestNeighbor: signature.nearestNeighbor,
      nearestCosineSimilarity: signature.nearestCosineSimilarity,
      curves,
      minBurdenByExposure,
      warningCodes: uniqueStrings([
        notAssessableAtLowBurden
          ? WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE
          : null,
        signature.ambiguityClass === "high"
          ? WARNING_CODES.SIGNATURE_AMBIGUITY
          : null,
      ]),
    };
  });

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "signature_detectability",
    contexts,
    burdens,
    exposureLevels,
    targetConfidence,
    opportunityCoverage,
    signatures: signaturesResult,
    warnings: signaturesResult
      .filter((signature) =>
        signature.warningCodes.includes(WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE)
      )
      .map((signature) =>
        makeWarning(
          WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE,
          `${signature.signatureName} may not be assessable at low panel/WES burden with the current settings.`,
          { signatureName: signature.signatureName }
        )
      ),
  };
}

function lookupDetectabilityConfidence(detectability, signatureName, burden, exposure) {
  const signature = detectability?.signatures?.find(
    (entry) => entry.signatureName === signatureName
  );
  if (!signature) {
    return null;
  }

  return computeDetectabilityConfidence({
    burden,
    exposure,
    flatnessScore: signature.flatnessScore,
    nearestCosineSimilarity: signature.nearestCosineSimilarity,
    opportunityCoverage: detectability.opportunityCoverage || 1,
  });
}

function summarizeEvidenceCalls(evidenceCalls) {
  const calls = Object.entries(evidenceCalls || {}).flatMap(([sample, rows]) =>
    (rows || []).map((row) => ({ sample, ...row }))
  );
  const tiers = ["strong_evidence", "weak_evidence", "not_detected", "not_assessable"];

  return {
    sampleCount: Object.keys(evidenceCalls || {}).length,
    callCount: calls.length,
    tierCounts: Object.fromEntries(
      tiers.map((tier) => [
        tier,
        calls.filter((call) => call.tier === tier).length,
      ])
    ),
    signatureSummaries: uniqueStrings(calls.map((call) => call.signatureName)).map(
      (signatureName) => {
        const signatureCalls = calls.filter(
          (call) => call.signatureName === signatureName
        );
        return {
          signatureName,
          strongEvidenceCount: signatureCalls.filter(
            (call) => call.tier === "strong_evidence"
          ).length,
          weakEvidenceCount: signatureCalls.filter(
            (call) => call.tier === "weak_evidence"
          ).length,
          notAssessableCount: signatureCalls.filter(
            (call) => call.tier === "not_assessable"
          ).length,
          maxExposure: Math.max(...signatureCalls.map((call) => call.exposure), 0),
          meanDetectabilityConfidence: average(
            signatureCalls
              .map((call) => call.detectabilityConfidence)
              .filter(Number.isFinite)
          ),
        };
      }
    ),
  };
}

/**
 * Runs a panel/WES-oriented workflow with opportunity normalization and evidence tiers.
 *
 * @async
 * @function runPanelWorkflow
 * @memberof pipelines
 * @param {Object} input - Panel or WES spectra, signatures, and optional callable opportunities.
 * @param {Object} [options] - Panel workflow options.
 * @returns {Promise<Object>} Fit result plus panel evidence calls and limitations.
 */
async function runPanelWorkflow(input = {}, options = {}) {
  const spectra = normalizeSpectraInput(input.spectra || input, options);
  const signatures = normalizeMatrixObject(
    input.signatures || input.referenceSignatures || options.signatures || {}
  );
  const contexts = getContextList(signatures, spectra, options);
  const callableOpportunities =
    input.callableOpportunities || options.callableOpportunities;
  const opportunityNormalization = normalizeByCallableOpportunities(
    spectra,
    callableOpportunities,
    contexts
  );
  const opportunityCoverage =
    options.opportunityCoverage ||
    (isPlainObject(callableOpportunities)
      ? contexts.filter((context) => {
          const values = Object.values(callableOpportunities);
          const contextValue = isPlainObject(values[0])
            ? values.some((row) => toFiniteNumber(row?.[context]) > 0)
            : toFiniteNumber(callableOpportunities[context]) > 0;
          return contextValue;
        }).length / Math.max(contexts.length, 1)
      : 1);
  const detectability = estimateSignatureDetectability(signatures, {
    contexts,
    burdens: options.detectabilityBurdens,
    exposureLevels: options.detectabilityExposureLevels,
    targetConfidence: options.targetDetectabilityConfidence || 0.8,
    opportunityCoverage,
  });
  const result = await runCohortFit(
    {
      spectra: opportunityNormalization.spectra,
      signatures,
    },
    {
      ...options,
      assay: "panel",
      contexts,
      lowBurdenThreshold: options.lowBurdenThreshold || 30,
      moderateBurdenThreshold: options.moderateBurdenThreshold || 150,
    }
  );
  const minAssessableMutations = options.minAssessableMutations || 30;
  const strongExposureThreshold = options.strongExposureThreshold || 0.2;
  const weakExposureThreshold = options.weakExposureThreshold || 0.05;
  const weakDetectabilityConfidence = options.weakDetectabilityConfidence || 0.25;
  const strongDetectabilityConfidence =
    options.strongDetectabilityConfidence || 0.55;
  const trustBySample = Object.fromEntries(
    result.trust.samples.map((sample) => [sample.sample, sample])
  );
  const burdenBySample = Object.fromEntries(
    result.advisor.mutationBurden.samples.map((sample) => [sample.sample, sample])
  );
  const evidenceCalls = Object.fromEntries(
    Object.entries(result.fit.exposures).map(([sampleName, exposureRow]) => [
      sampleName,
      Object.entries(exposureRow).map(([signatureName, exposure]) => {
        const burden = burdenBySample[sampleName]?.totalMutations || 0;
        const trustClass = trustBySample[sampleName]?.classification;
        const detectabilityConfidence = lookupDetectabilityConfidence(
          detectability,
          signatureName,
          burden,
          exposure
        );
        const assessable =
          burden >= minAssessableMutations &&
          (detectabilityConfidence === null ||
            detectabilityConfidence >= weakDetectabilityConfidence);
        let tier = "not_detected";
        const warnings = [];

        if (!assessable) {
          tier = "not_assessable";
          warnings.push(
            makeWarning(
              WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE,
              `${signatureName} is not assessable for ${sampleName} at the observed burden and fitted exposure.`,
              { sample: sampleName, signatureName, burden, exposure }
            )
          );
        } else if (
          exposure >= strongExposureThreshold &&
          (trustClass === "high_confidence" ||
            trustClass === "moderate_confidence") &&
          (detectabilityConfidence === null ||
            detectabilityConfidence >= strongDetectabilityConfidence)
        ) {
          tier = "strong_evidence";
        } else if (exposure >= weakExposureThreshold) {
          tier = "weak_evidence";
        }
        return {
          signatureName,
          exposure,
          tier,
          totalMutations: burden,
          trustClass,
          detectabilityConfidence,
          assessable,
          warnings,
        };
      }),
    ])
  );
  const evidenceSummary = summarizeEvidenceCalls(evidenceCalls);
  const panelReport = createAnalysisReport(
    {
      title: "mSigSDK Panel/WES Signature Evidence Report",
      summary:
        "Panel/WES-oriented workflow with opportunity normalization, detectability estimates, evidence tiers, trust classifications, and explicit limitations.",
      parameters: {
        workflow: "runPanelWorkflow",
        minAssessableMutations,
        strongExposureThreshold,
        weakExposureThreshold,
        weakDetectabilityConfidence,
        strongDetectabilityConfidence,
        opportunityCoverage,
      },
      validation: result.validation,
      qc: {
        mutationBurden: result.advisor.mutationBurden,
        reconstructionError: result.fit.reconstructionError,
        trust: result.trust.summary,
        detectability: {
          targetConfidence: detectability.targetConfidence,
          opportunityCoverage: detectability.opportunityCoverage,
        },
        evidenceSummary,
      },
      exposures: result.fit.exposures,
      notes: [
        "Panel and WES outputs are best interpreted as evidence tiers rather than full decompositions.",
        ...detectability.warnings.map((warning) => warning.message),
      ],
    },
    { format: options.reportFormat || "object" }
  );

  return {
    ...result,
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "panel_workflow",
    opportunityNormalization,
    detectability,
    evidenceCalls,
    evidenceSummary,
    limitations: [
      "Panel and WES analyses are territory-restricted and are best reported as evidence tiers rather than full fine-grained decompositions.",
      "Flat or highly confusable signatures may be not assessable at low mutation counts.",
    ],
    report: panelReport,
    recommendedActions: uniqueStrings([
      ...result.recommendedActions,
      "Use evidence tiers and detectability confidence for panel/WES interpretation.",
      ...detectability.warnings.map((warning) => warning.message),
    ]),
    publicationFigures: buildPublicationFigureDescriptors("panel", {
      cohort_exposure_heatmap: ["fit.exposures", "evidenceCalls", "trust"],
      panel_evidence: ["evidenceCalls", "detectability"],
      trust_dashboard: ["trust"],
    }),
  };
}

function normalizeVariantRows(variants) {
  const rows = Array.isArray(variants) ? variants : variants?.variants || [];
  return rows
    .map((row, index) => {
      const chromosome =
        row.chromosome ||
        row.chrom ||
        row.chr ||
        row.Chromosome ||
        row.CHROM ||
        row["#CHROM"] ||
        null;
      const position = toFiniteNumber(
        row.position ||
          row.pos ||
          row.start_position ||
          row.Start_Position ||
          row.POS ||
          row.start
      );
      return {
        id: row.id || row.variantId || `variant_${index + 1}`,
        chromosome: chromosome ? String(chromosome).replace(/^chr/i, "") : null,
        position,
        context:
          row.context || row.mutationType || row.MutationType || row.mutation_type || null,
        sample: row.sample || row.Tumor_Sample_Barcode || row.sampleName || null,
        raw: row,
      };
    })
    .filter((row) => row.chromosome && Number.isFinite(row.position))
    .sort((a, b) => {
      if (a.chromosome === b.chromosome) {
        return a.position - b.position;
      }
      return String(a.chromosome).localeCompare(String(b.chromosome), undefined, {
        numeric: true,
      });
    });
}

function finalizeFocus(current, foci, options) {
  if (current.length < options.minMutations) {
    return;
  }

  const distances = current
    .slice(1)
    .map((variant) => variant.previousDistance)
    .filter((distance) => Number.isFinite(distance));
  const contexts = current.map((variant) => variant.context).filter(Boolean);
  const apobecLikeCount = contexts.filter(
    (context) =>
      /T\[C>[GT]\][ATCG]/.test(context) ||
      /[ATCG]\[C>[GT]\]T/.test(context)
  ).length;
  const apobecLikeFraction =
    contexts.length === 0 ? 0 : apobecLikeCount / contexts.length;

  foci.push({
    focusId: `focus_${foci.length + 1}`,
    chromosome: current[0].chromosome,
    start: current[0].position,
    end: current[current.length - 1].position,
    mutationCount: current.length,
    medianIntermutationDistance: quantile(distances, 0.5),
    apobecLikeFraction,
    candidateEtiology:
      apobecLikeFraction >= 0.4
        ? "APOBEC-like localized hypermutation"
        : "localized hypermutation",
    variantIds: current.map((variant) => variant.id),
  });
}

/**
 * Detects localized mutagenesis candidates and prepares rainfall-plot data.
 *
 * @function runLocalizedMutagenesisAnalysis
 * @memberof pipelines
 * @param {Object[]|Object} variants - Variant rows or an object with a variants field.
 * @param {string} genomeBuild - Genome build label.
 * @param {Object} [options] - Localized mutagenesis options.
 * @returns {Object} Rainfall data, focal regions, warnings, and publication artifacts.
 */
function runLocalizedMutagenesisAnalysis(variants, genomeBuild, options = {}) {
  const normalizedVariants = normalizeVariantRows(variants);
  const maxIntermutationDistance = options.maxIntermutationDistance || 10000;
  const minMutations = options.minMutations || 6;
  const rainfall = normalizedVariants.map((variant, index) => {
    const previous = normalizedVariants[index - 1];
    const previousDistance =
      previous && previous.chromosome === variant.chromosome
        ? variant.position - previous.position
        : null;
    return {
      ...variant,
      previousDistance,
      log10PreviousDistance:
        previousDistance && previousDistance > 0
          ? Math.log10(previousDistance)
          : null,
    };
  });
  const foci = [];
  let current = [];

  for (const variant of rainfall) {
    const continuesFocus =
      current.length === 0 ||
      (variant.chromosome === current[current.length - 1].chromosome &&
        variant.previousDistance !== null &&
        variant.previousDistance <= maxIntermutationDistance);
    if (continuesFocus) {
      current.push(variant);
    } else {
      finalizeFocus(current, foci, { minMutations });
      current = [variant];
    }
  }
  finalizeFocus(current, foci, { minMutations });

  const warnings =
    foci.length > 0
      ? [
          makeWarning(
            WARNING_CODES.REGIONAL_PROCESS_SUSPECTED,
            "One or more focal mutation clusters were detected; compare focal spectra with the genomic background.",
            { focusCount: foci.length }
          ),
        ]
      : [];

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "localized_mutagenesis",
    genomeBuild,
    parameters: {
      maxIntermutationDistance,
      minMutations,
    },
    rainfall,
    foci,
    focalSpectra: null,
    flankComparison: null,
    genomeTracks: {
      suggestedTrackType: "rainfall",
      fields: ["chromosome", "position", "previousDistance", "focusId"],
    },
    candidateEtiologies: uniqueStrings(foci.map((focus) => focus.candidateEtiology)),
    warnings,
    recommendedActions: uniqueStrings([
      foci.length > 0
        ? "Generate a rainfall plot, extract focal spectra, and compare foci against matched genomic background."
        : "No focal clusters were detected with the current parameters.",
    ]),
    publicationFigures: buildPublicationFigureDescriptors("localized", {
      rainfall: ["rainfall", "foci"],
    }),
  };
}

export {
  WARNING_CODES,
  compareSignatureExposures,
  computeFitTrust,
  computeSignatureAmbiguity,
  detectOutOfReferenceSignal,
  estimateSignatureDetectability,
  recommendAnalysisStrategy,
  runCohortFit,
  runDiscoveryWorkflow,
  runLocalizedMutagenesisAnalysis,
  runPanelWorkflow,
  runSingleSampleFit,
  runSubgroupDiscoveryWorkflow,
};
