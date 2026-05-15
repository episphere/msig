import {
  QC_DEFAULTS,
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
const EXPERIMENTAL_WARNING_STATE = new Set();

function warnExperimentalAdvisorFunction(functionName) {
  if (EXPERIMENTAL_WARNING_STATE.has(functionName)) {
    return;
  }
  EXPERIMENTAL_WARNING_STATE.add(functionName);

  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(
      `${functionName} is experimental in mSigSDK v0.3. Results are descriptive review artifacts and are not part of the manuscript-validated advisor claim set.`
    );
  }
}

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

const WARNING_RESOLUTIONS = {
  [WARNING_CODES.CATALOG_INCOMPLETE_SUSPECTED]:
    "Inspect residual spectra and consider whether a broader or better-matched reference catalog is warranted before making detailed exposure claims.",
  [WARNING_CODES.EXTRACTION_NOT_RECOMMENDED]:
    "Prefer known-signature refitting or collect a larger, higher-burden cohort before treating de novo extraction as interpretable.",
  [WARNING_CODES.FIT_UNSTABLE]:
    "Increase bootstrap iterations if needed, inspect interval widths, and present fitted exposures with uncertainty context.",
  [WARNING_CODES.FLAT_SIGNATURE_RISK]:
    "Review flat-profile signatures as potentially exchangeable with related signatures; include identifiability context if reporting them.",
  [WARNING_CODES.HETEROGENEOUS_COHORT]:
    "Review subgroup structure before cohort-wide extraction or pooled interpretation.",
  [WARNING_CODES.HIGH_RESIDUAL_STRUCTURE]:
    "Inspect residual structure and consider whether catalog choice or additional exploratory analysis is warranted.",
  [WARNING_CODES.INCOMPLETE_CONTEXTS]:
    "Regenerate the spectrum with the expected context basis before fitting.",
  [WARNING_CODES.INSUFFICIENT_SIGNAL]:
    "Avoid fine-grained exposure interpretation under these settings; more mutations or a broader assay may be needed.",
  [WARNING_CODES.LOW_BURDEN]:
    "Interpret fitted exposures with caution and consult threshold sensitivity, bootstrap intervals, and the analysis strategy advisor.",
  [WARNING_CODES.GROUP_IMBALANCE]:
    "Treat group comparisons as exploratory and increase group size before inferential claims.",
  [WARNING_CODES.METADATA_MISSING]:
    "Provide complete sample metadata with at least two groups before running stratified comparisons.",
  [WARNING_CODES.PANEL_LIMITED]:
    "Use panel/WES evidence tiers and avoid interpreting non-detection as absence.",
  [WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE]:
    "Report the signature/sample setting as not assessable under these rules or use a broader assay for stronger review evidence.",
  [WARNING_CODES.REGIONAL_PROCESS_SUSPECTED]:
    "Inspect rainfall plots, compare focal spectra to background, and treat context labels as hypothesis-generating.",
  [WARNING_CODES.SIGNATURE_AMBIGUITY]:
    "Inspect neighboring/broad catalog signatures and avoid interpreting the individual fitted signature as uniquely identified.",
  [WARNING_CODES.SUBGROUP_EXTRACTION_SKIPPED]:
    "Run subgroup discovery explicitly only when subgroup sample count and mutation burden meet readiness thresholds.",
  [WARNING_CODES.THRESHOLD_DEPENDENT]:
    "Run bootstrap uncertainty if not already performed and report threshold-dependent calls with threshold-sensitivity context.",
};

const METHOD_BASIS = {
  mutationBurden:
    "Mutation count affects sampling noise and fitting accuracy. Default thresholds are configurable review settings.",
  reconstructionResidual:
    "Known-signature fitting is evaluated by reconstruction error, cosine similarity, and residual structure rather than by exposure values alone.",
  signatureAmbiguity:
    "Signature identifiability is summarized as continuous, catalog-relative evidence. Similar neighbors, broad/flat profiles, and crowded catalog regions can make fitted exposures exchangeable; review cues are descriptive, not calibrated biological class boundaries.",
  catalogSufficiency:
    "Residual structure can raise a review cue that the supplied catalog may not explain all observed structure; it is not proof of a missing process.",
  bootstrapThreshold:
    "Bootstrap resampling and threshold sensitivity summarize stability under resampling and exposure cutoffs.",
  cohortStructure:
    "Heterogeneous cohorts can produce misleading cohort-wide extraction or fitting results if not examined separately.",
  panelEvidence:
    "Panel and WES interpretations depend on mutation count, callable territory, and signature confusability.",
};

const LITERATURE_REFERENCES = {
  koh2021: {
    key: "Koh2021",
    citation:
      "Koh G, Degasperi A, Zou X, Momen S, Nik-Zainal S. Mutational signatures: emerging concepts, caveats and clinical applications. Nat Rev Cancer. 2021.",
    doi: "10.1038/s41568-021-00377-7",
    url: "https://doi.org/10.1038/s41568-021-00377-7",
  },
  degasperi2020: {
    key: "Degasperi2020",
    citation:
      "Degasperi A, Amarante TD, Czarnecki J, et al. A practical framework and online tool for mutational signature analyses show intertissue variation and driver dependencies. Nat Cancer. 2020.",
    doi: "10.1038/s43018-020-0027-5",
    url: "https://doi.org/10.1038/s43018-020-0027-5",
  },
  alexandrov2013: {
    key: "Alexandrov2013",
    citation:
      "Alexandrov LB, Nik-Zainal S, Wedge DC, et al. Signatures of mutational processes in human cancer. Nature. 2013.",
    doi: "10.1038/nature12477",
    url: "https://doi.org/10.1038/nature12477",
  },
  alexandrov2020: {
    key: "Alexandrov2020",
    citation:
      "Alexandrov LB, Kim J, Haradhvala NJ, et al. The repertoire of mutational signatures in human cancer. Nature. 2020.",
    doi: "10.1038/s41586-020-1943-3",
    url: "https://doi.org/10.1038/s41586-020-1943-3",
  },
  medo2024: {
    key: "Medo2024",
    citation:
      "Medo M, Ng CKY, Medova M. A comprehensive comparison of tools for fitting mutational signatures. Nat Commun. 2024.",
    doi: "10.1038/s41467-024-53711-6",
    url: "https://doi.org/10.1038/s41467-024-53711-6",
  },
  jin2024: {
    key: "Jin2024",
    citation:
      "Jin H, Gulhan DC, Geiger B, et al. Accurate and sensitive mutational signature analysis with MuSiCal. Nat Genet. 2024.",
    doi: "10.1038/s41588-024-01659-0",
    url: "https://doi.org/10.1038/s41588-024-01659-0",
  },
  wu2023: {
    key: "Wu2023",
    citation:
      "Wu AJ, Perera A, Kularatnarajah L, Korsakova A, Pitt JJ. Mutational signature assignment heterogeneity is widespread and can be addressed by ensemble approaches. Brief Bioinform. 2023.",
    doi: "10.1093/bib/bbad331",
    url: "https://doi.org/10.1093/bib/bbad331",
  },
  huang2018: {
    key: "Huang2018",
    citation:
      "Huang X, Wojtowicz D, Przytycka TM. Detecting presence of mutational signatures in cancer with confidence. Bioinformatics. 2018.",
    doi: "10.1093/bioinformatics/btx604",
    url: "https://doi.org/10.1093/bioinformatics/btx604",
  },
  lawrence2021: {
    key: "Lawrence2021",
    citation:
      "Lawrence L, Kunder CA, Fung E, Stehr H, Zehnder J. Performance characteristics of mutational signature analysis in targeted panel sequencing. Arch Pathol Lab Med. 2021.",
    doi: "10.5858/arpa.2020-0536-OA",
    url: "https://doi.org/10.5858/arpa.2020-0536-OA",
  },
  roberts2013: {
    key: "Roberts2013",
    citation:
      "Roberts SA, Lawrence MS, Klimczak LJ, et al. An APOBEC cytidine deaminase mutagenesis pattern is widespread in human cancers. Nat Genet. 2013.",
    doi: "10.1038/ng.2702",
    url: "https://doi.org/10.1038/ng.2702",
  },
  petljak2022: {
    key: "Petljak2022",
    citation:
      "Petljak M, Green AM, Maciejowski J, et al. Addressing the benefits of inhibiting APOBEC3-dependent mutagenesis in cancer. Nat Genet. 2022.",
    doi: "10.1038/s41588-022-01196-8",
    url: "https://doi.org/10.1038/s41588-022-01196-8",
  },
  senkin2021: {
    key: "Senkin2021MSA",
    citation:
      "Senkin S. MSA: reproducible mutational signature attribution with confidence based on simulations. BMC Bioinformatics. 2021.",
    doi: "10.1186/s12859-021-04450-8",
    url: "https://doi.org/10.1186/s12859-021-04450-8",
  },
  islam2022: {
    key: "Islam2022",
    citation:
      "Islam SMA, Diaz-Gay M, Wu Y, et al. Uncovering novel mutational signatures by de novo extraction with SigProfilerExtractor. Cell Genomics. 2022.",
    doi: "10.1016/j.xgen.2022.100179",
    url: "https://doi.org/10.1016/j.xgen.2022.100179",
  },
  wilkinson2016: {
    key: "Wilkinson2016FAIR",
    citation:
      "Wilkinson MD, Dumontier M, Aalbersberg IJ, et al. The FAIR Guiding Principles for scientific data management and stewardship. Sci Data. 2016.",
    doi: "10.1038/sdata.2016.18",
    url: "https://doi.org/10.1038/sdata.2016.18",
  },
};

const SCOPE_STATEMENTS = {
  analysisAdvisor:
    "Research-use advisory summary for precomputed spectra with configurable recommendations.",
  signatureAmbiguity:
    "Catalog-screening summary for potential signature confusability.",
  catalogSufficiency:
    "Residual-review summary for fitted spectra.",
  fitQualityEvidence:
    "Rule-based QC evidence summary for known-signature refitting. The primary interpretation field is reportingMode; no composite fit-quality score is returned.",
  groupComparison:
    "Metadata-stratified comparison of fitted exposures with group-size and effect-size summaries.",
  restrictedAssayEvidence:
    "Restricted-assay evidence summary for planning and panel/WES review.",
  panel:
    "Panel/WES review evidence summary for restricted genomic territory.",
  localized:
    "Experimental localized-mutation clustering summary. Results are descriptive review artifacts and are not validated for manuscript-grade use.",
  singleSamplePipeline:
    "High-level single-sample refitting workflow for research review.",
  cohortPipeline:
    "High-level cohort refitting workflow for research review.",
  discoveryPipeline:
    "High-level exploratory signature-discovery workflow.",
  subgroupPipeline:
    "Experimental subgroup-aware extraction and matched refitting workflow. Results are descriptive review artifacts and are not validated for manuscript-grade use.",
};

const SYNTHETIC_VALIDATION_ANCHORS = {
  burden50: {
    table: "Table 2 synthetic signature validation",
    row: "50 mutations per sample",
    exposureCosineMean: 0.912,
    exposureCosine95CI: [0.882, 0.941],
    reconstructionCosineMean: 0.884,
    activeSignatureRecallMean: 0.938,
    inactiveSignatureCallRateMean: 0.165,
  },
  burden100: {
    table: "Table 2 synthetic signature validation",
    row: "100 mutations per sample",
    exposureCosineMean: 0.952,
    reconstructionCosineMean: 0.93,
    activeSignatureRecallMean: 0.979,
    inactiveSignatureCallRateMean: 0.129,
  },
};

const PANEL_TIER_RULE_DEFINITIONS = {
  version: `${RESULT_SCHEMA_VERSION}.panelTierRules.v1`,
  not_assessable: {
    rule:
      "Assigned when total mutations are below the configured minAssessableMutations or a supplied callable-opportunity map contains no callable contexts for the signature.",
    interpretation:
      "The assay/sample setting does not provide enough review evidence for a detection or non-detection statement for this signature.",
  },
  higher_review_support: {
    rule:
      "Assigned when exposure is at least the configured higherSupportExposureThreshold, the sample is assessable, and fit reporting mode is standard_qc_passed or report_with_caveats.",
    interpretation:
      "The fitted exposure meets the configured higher-review criteria. This is review support under the current settings, not definitive detection.",
  },
  limited_review_support: {
    rule:
      "Assigned when the call is assessable and exposure is at least limitedSupportExposureThreshold but higher-review criteria are not met.",
    interpretation:
      "The fitted exposure crosses the lower review threshold but should be reported only with limited support under the current settings.",
  },
  not_detected_within_review_settings: {
    rule:
      "Assigned when the call is assessable and exposure is below limitedSupportExposureThreshold.",
    interpretation:
      "The fitted signal did not cross the configured review threshold; this is not proof of biological absence.",
  },
};

const LOCALIZED_CONTEXT_PATTERN_DEFINITIONS = {
  version: `${RESULT_SCHEMA_VERSION}.localizedContextPatterns.v1`,
  "APOBEC-context-enriched localized cluster": {
    patternClass: "APOBEC-context-enriched localized cluster",
    contexts: ["T[C>G]A", "T[C>G]T", "T[C>T]A", "T[C>T]T"],
    fractionField: "apobecLikeFraction",
    definition:
      "Fraction of context-annotated variants in TC[A/T] pyrimidine contexts corresponding to COSMIC SBS2/SBS13 APOBEC-associated substitutions.",
    interpretation:
      "Descriptive context enrichment only; not an etiology assignment.",
  },
  "localized mutation cluster": {
    patternClass: "localized mutation cluster",
    contexts: [],
    fractionField: null,
    definition:
      "Sequential same-chromosome mutation cluster meeting distance and mutation-count thresholds without crossing the APOBEC-context enrichment threshold.",
    interpretation:
      "Descriptive focal clustering only; not an etiology assignment.",
  },
};

const ADVISOR_DEFAULTS = Object.freeze({
  analysisStrategy: Object.freeze({
    assay: "WGS",
    wgsLowBurdenThreshold: 100,
    wgsModerateBurdenThreshold: 1000,
    panelLowBurdenThreshold: 30,
    panelModerateBurdenThreshold: 150,
    highBurdenThreshold: 3000,
    minSamplesForExtraction: 8,
    minSamplesForCohortRecommendation: 2,
    minHighInformationFraction: 0.5,
    heterogeneityCosineThreshold: 0.85,
  }),
  signatureAmbiguity: Object.freeze({
    pairReportThreshold: 0.9,
    moderateNearestCosine: 0.9,
    highNearestCosine: 0.95,
    moderateEntropy: 0.85,
    highEntropy: 0.92,
    flatSignatureWarningEntropy: 0.9,
    topNeighborCount: 5,
    reviewPercentile: 0.75,
    strongReviewPercentile: 0.9,
    nearBoundaryWidth: 0.03,
    nearestNeighborWeight: 0.4,
    neighborCrowdingWeight: 0.2,
    flatnessWeight: 0.3,
    nonspecificityWeight: 0.1,
  }),
  catalogSufficiency: Object.freeze({
    normalizeMode: "relative",
    unexplainedThreshold: 0.12,
    weakUnexplainedThreshold: 0.07,
    cosineThreshold: 0.9,
    structuredResidualCosineThreshold: 0.85,
    minBurdenForReliableDetection: 100,
    moderateBurdenThreshold: 1000,
    topN: 8,
  }),
  fitQualityEvidence: Object.freeze({
    normalizeMode: "relative",
    lowBurdenThreshold: 100,
    moderateBurdenThreshold: 1000,
  }),
  groupComparison: Object.freeze({
    groupKey: "group",
    minGroupSizeForReliableStats: 5,
    permutationIterations: 0,
    seed: 123,
    topN: 10,
  }),
  singleSampleFit: Object.freeze({
    mutationBurden: Object.freeze({
      lowBurdenThreshold: 100,
      moderateBurdenThreshold: 1000,
    }),
    fit: Object.freeze({
      exposureThreshold: 0,
      exposureType: "relative",
      renormalize: true,
      maxIterations: QC_DEFAULTS.nnls.maxIterations,
      convergenceTolerance: QC_DEFAULTS.nnls.convergenceTolerance,
    }),
    thresholdSensitivity: Object.freeze({
      thresholds: Object.freeze([0, 0.01, 0.03, 0.05, 0.1]),
    }),
    bootstrap: Object.freeze({
      iterations: 100,
      confidenceLevel: 0.95,
      seed: 123,
    }),
  }),
  cohortFit: Object.freeze({
    mutationBurden: Object.freeze({
      lowBurdenThreshold: 100,
      moderateBurdenThreshold: 1000,
    }),
    bootstrapSampleLimit: 5,
    clusterCosineThreshold: 0.85,
    minSubgroupSamples: 5,
  }),
  subgroupDiscovery: Object.freeze({
    clusterCosineThreshold: 0.85,
    minSubgroupSamples: 8,
    minMedianBurden: 750,
    lowBurdenThreshold: 100,
    minMatchCosine: 0.85,
    shortlistTopN: 8,
    minRank: 2,
    maxRank: 4,
    maxIterations: 750,
    tolerance: 1e-5,
    nRuns: 10,
    seed: 123,
    topN: 5,
    refitExposureThreshold: 0,
    exposureType: "relative",
    renormalize: true,
  }),
  discoveryWorkflow: Object.freeze({
    ranks: Object.freeze([2, 3, 4, 5]),
    rankSelectionMaxIterations: 500,
    extractionMaxIterations: 1000,
    tolerance: 1e-5,
    rankSelectionRuns: 5,
    extractionRuns: 20,
    rankSelectionCriterion: "reconstruction_error",
    seed: 123,
    rank: null,
    defaultRank: 3,
    signaturePrefix: "NMF",
    topN: 5,
  }),
  restrictedAssayEvidence: Object.freeze({
    burdens: Object.freeze([25, 50, 100, 250, 500, 1000, 2500]),
    exposureLevels: Object.freeze([0.05, 0.1, 0.2, 0.3, 0.5]),
    opportunityCoverage: 1,
  }),
  panelWorkflow: Object.freeze({
    lowBurdenThreshold: 30,
    moderateBurdenThreshold: 150,
    minAssessableMutations: 30,
    higherSupportExposureThreshold: 0.2,
    limitedSupportExposureThreshold: 0.05,
    opportunityEpsilon: 1e-12,
  }),
  localizedMutagenesis: Object.freeze({
    maxIntermutationDistance: 10000,
    minMutations: 6,
    minBurdenForLocalizedAnalysis: 50,
    apobecLikeFractionThreshold: 0.4,
    clusterSignificanceThreshold: 0.05,
    callableGenomeSize: 3000000000,
    nullModelSpecification:
      "Poisson upper-tail test using the genome-wide per-sample mutation rate estimated as total input variants divided by callableGenomeSize.",
  }),
});

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

function mergeDefinedOptions(...sources) {
  const merged = {};
  for (const source of sources) {
    if (!isPlainObject(source)) {
      continue;
    }
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

function optionSubset(options = {}, keys = []) {
  const subset = {};
  for (const key of keys) {
    if (options[key] !== undefined) {
      subset[key] = options[key];
    }
  }
  return subset;
}

function liteOptions(options = {}, keys = []) {
  return optionSubset(options, [
    "contexts",
    "expectedContexts",
    "genomeBuild",
    "genomeVersion",
    "reportFormat",
    "sampleName",
    "seed",
    ...keys,
  ]);
}

function makeWarning(code, message, details = {}) {
  return {
    code,
    level: "warning",
    message,
    resolution: WARNING_RESOLUTIONS[code] || null,
    ...details,
  };
}

function warningSeverity(warning) {
  const code = warning?.code;
  if (
    code === WARNING_CODES.INSUFFICIENT_SIGNAL ||
    code === WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE
  ) {
    return 3;
  }
  if (
    code === WARNING_CODES.LOW_BURDEN ||
    code === WARNING_CODES.CATALOG_INCOMPLETE_SUSPECTED ||
    code === WARNING_CODES.HIGH_RESIDUAL_STRUCTURE
  ) {
    return 2;
  }
  return warning ? 1 : 0;
}

function deduplicateWarnings(warnings) {
  const seen = new Set();
  return (warnings || []).filter((warning) => {
    if (!warning) {
      return false;
    }
    const key = `${warning.code || ""}|${warning.message || ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function summarizeSubsystem(name, result, warnings = []) {
  const sortedWarnings = deduplicateWarnings(warnings).sort(
    (a, b) => warningSeverity(b) - warningSeverity(a)
  );
  return {
    subsystem: name,
    workflowRole: result?.workflowRole || result?.workflow || null,
    reportingMode: result?.reportingMode || result?.summary?.reportingMode || null,
    status: result?.overallStatus || result?.status || null,
    warningCount: sortedWarnings.length,
    highestSeverity: sortedWarnings[0] ? warningSeverity(sortedWarnings[0]) : 0,
    primaryWarning: sortedWarnings[0] || null,
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
      profile: options.profile ?? "SBS",
      matrix: options.matrix ?? 96,
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
    return "Avoid fine-grained exposure decomposition under these settings; report insufficient signal or aggregate only with a biologically justified cohort.";
  }
  if (burdenClass === "low") {
    return "Use restricted, hypothesis-driven refitting with bootstrap uncertainty and avoid de novo extraction.";
  }
  if (burdenClass === "moderate") {
    return "Use known-signature refitting with threshold sensitivity and residual checks.";
  }
  return "Use known-signature refitting and inspect whether residual structure warrants subgroup review or catalog expansion.";
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
      reviewFlag: false,
      warningCodes: [],
      l1Change: null,
      activeSignatureRange: null,
      cosineDrop: null,
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
      reviewFlag: false,
      warningCodes: [],
      l1Change: null,
      activeSignatureRange: null,
      cosineDrop: null,
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
  const warningCodes = uniqueStrings(
    (thresholdSensitivity.warnings || []).map((warning) => warning.code)
  );
  const reviewFlag = warningCodes.length > 0;

  return {
    measured: true,
    reviewFlag,
    warningCodes,
    l1Change,
    activeSignatureRange,
    cosineDrop,
    interpretationBoundary:
      "This summary reports observed drift across tested thresholds. It does not convert drift into a calibrated stability score.",
    recommendation:
      reviewFlag
        ? "Report threshold-sensitivity results and inspect the configured warning details before interpreting thresholded active signatures."
        : "Inspect threshold-sensitivity drift values directly; no configured threshold-sensitivity warning was emitted.",
  };
}

function summarizeBootstrapStability(bootstrap, exposureFloor = 0.01) {
  if (!bootstrap?.signatures?.length) {
    return {
      measured: false,
      reviewFlag: false,
      warningCodes: [],
      maxConfidenceWidth: null,
      intermediateSelectionFrequencySignatures: [],
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
  const intermediateSelectionFrequencySignatures = activeSummaries.filter(
    (signature) =>
      signature.selectionFrequency > 0.2 &&
      signature.selectionFrequency < 0.8
  );
  const warningCodes = uniqueStrings(
    (bootstrap.warnings || []).map((warning) => warning.code)
  );
  const reviewFlag = warningCodes.length > 0;

  return {
    measured: true,
    reviewFlag,
    warningCodes,
    maxConfidenceWidth,
    intermediateSelectionFrequencySignatures: intermediateSelectionFrequencySignatures.map(
      (signature) => signature.signatureName
    ),
    interpretationBoundary:
      "This summary reports interval width and selection frequency directly. It does not convert bootstrap output into a calibrated stability score.",
    recommendation:
      reviewFlag
        ? "Report bootstrap warning details with interval widths and selection frequencies."
        : "Inspect bootstrap interval widths and selection frequencies directly; no configured bootstrap warning was emitted.",
  };
}

function classifyFitQcEvidence(flags) {
  const flagCodes = new Set(flags.map((flag) => flag.code));
  if (
    flagCodes.has(WARNING_CODES.INSUFFICIENT_SIGNAL) ||
    flagCodes.has(WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE)
  ) {
    return "not_assessable";
  }
  if (
    flagCodes.has(WARNING_CODES.LOW_BURDEN) ||
    flagCodes.has(WARNING_CODES.CATALOG_INCOMPLETE_SUSPECTED) ||
    flagCodes.has(WARNING_CODES.HIGH_RESIDUAL_STRUCTURE)
  ) {
    return "restricted_interpretation";
  }
  if (
    flagCodes.has(WARNING_CODES.FIT_UNSTABLE) ||
    flagCodes.has(WARNING_CODES.THRESHOLD_DEPENDENT) ||
    flagCodes.has(WARNING_CODES.SIGNATURE_AMBIGUITY) ||
    flagCodes.has(WARNING_CODES.FLAT_SIGNATURE_RISK)
  ) {
    return "report_with_caveats";
  }
  return "standard_qc_passed";
}

function summarizeFitQcAction(reportingMode) {
  if (reportingMode === "not_assessable") {
    return "Do not report fine-grained fitted exposures; report insufficient or not-assessable evidence and consider more data or a better matched assay.";
  }
  if (reportingMode === "restricted_interpretation") {
    return "Restrict interpretation to high-level evidence and include residual, burden, uncertainty, and ambiguity diagnostics.";
  }
  if (reportingMode === "report_with_caveats") {
    return "Report fitted exposures with explicit uncertainty, threshold sensitivity, ambiguity, and catalog-sufficiency diagnostics.";
  }
  return "No configured fit-quality review cue is active; still report the diagnostic values and assay limitations.";
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

function robustDistribution(values) {
  const finiteValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finiteValues.length) {
    return { median: 0, scale: 1, values: [] };
  }
  const median = quantile(finiteValues, 0.5);
  const absoluteDeviations = finiteValues
    .map((value) => Math.abs(value - median))
    .sort((a, b) => a - b);
  const mad = quantile(absoluteDeviations, 0.5);
  const iqr = quantile(finiteValues, 0.75) - quantile(finiteValues, 0.25);
  const scale = Math.max(mad * 1.4826, iqr / 1.349, 1e-6);
  return { median, scale, values: finiteValues };
}

function robustTailScore(value, distribution) {
  if (!Number.isFinite(value)) return 0;
  const scaled = (value - distribution.median) / distribution.scale;
  return clamp(1 / (1 + Math.exp(-scaled)), 0, 1);
}

function empiricalPercentile(value, values) {
  const finiteValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finiteValues.length || !Number.isFinite(value)) return null;
  const belowOrEqual = finiteValues.filter((candidate) => candidate <= value).length;
  return belowOrEqual / finiteValues.length;
}

function weightedMean(values) {
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return 0;
  const denominator = finiteValues.reduce((total, _value, index) => total + 1 / (index + 1), 0);
  return finiteValues.reduce(
    (total, value, index) => total + value / (index + 1),
    0
  ) / denominator;
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
      id: "fit_quality_evidence_dashboard",
      title: "Fit-quality evidence summary",
      purpose: "Summarizes burden, reconstruction, residual, bootstrap, threshold, ambiguity, and catalog-sufficiency evidence.",
      recommendedRenderer: "mSigSDK.qcPlots.plotFitQualityEvidenceDashboard",
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
      title: "Cohort exposure heatmap with burden and reporting-mode annotations",
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
      recommendedRenderer: "mSigSDK.experimental.runSubgroupDiscoveryWorkflow",
    });
  }

  if (workflowType === "panel") {
    base.push({
      id: "panel_evidence",
      title: "Panel/WES signature evidence matrix",
      purpose:
        "Shows higher-review, limited-review, below-threshold, and not-assessable panel/WES review tiers per sample.",
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
      recommendedRenderer: "mSigSDK.experimental.runLocalizedMutagenesisAnalysis",
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
 * @validated Exercised by manuscript Results as part of the validated advisor claim set.
 * @param {Object<string,Object<string,number>>|Object<string,number>} spectra - Sample spectra matrix or one spectrum.
 * @param {Object} [options] - Advisor options.
 * @returns {Object} Strategy recommendation, caveats, warnings, and next actions.
 */
function recommendAnalysisStrategy(spectra, options = {}) {
  const strategyOptions = mergeDefinedOptions(
    options.analysisStrategy,
    options.strategy,
    options
  );
  const strategyDefaults = ADVISOR_DEFAULTS.analysisStrategy;
  const assay = strategyOptions.assay ?? strategyDefaults.assay;
  const {
    lowBurdenThreshold = assay === "panel"
      ? strategyDefaults.panelLowBurdenThreshold
      : strategyDefaults.wgsLowBurdenThreshold,
    moderateBurdenThreshold = assay === "panel"
      ? strategyDefaults.panelModerateBurdenThreshold
      : strategyDefaults.wgsModerateBurdenThreshold,
    highBurdenThreshold = strategyDefaults.highBurdenThreshold,
    minSamplesForExtraction = strategyDefaults.minSamplesForExtraction,
    minSamplesForCohortRecommendation =
      strategyDefaults.minSamplesForCohortRecommendation,
    minHighInformationFraction = strategyDefaults.minHighInformationFraction,
    heterogeneityCosineThreshold = strategyDefaults.heterogeneityCosineThreshold,
  } = strategyOptions;
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
          `${sample.sample} did not provide callable mutation signal under the selected context settings.`,
          { sample: sample.sample }
        )
      );
    } else if (burdenClass === "low") {
      warnings.push(
        makeWarning(
          WARNING_CODES.LOW_BURDEN,
          `${sample.sample} is below the configured mutation-burden threshold for routine fine-grained exposure decomposition.`,
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
        "The cohort met the configured spectral-heterogeneity review criterion; consider subgroup review before extraction or cohort-wide interpretation.",
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
    minSamplesForCohortRecommendation,
    cohortRecommendationEligible: sampleCount >= minSamplesForCohortRecommendation,
    totalMutations: sum(totalMutations),
    medianMutationBurden: quantile(totalMutations, 0.5),
    highInformationSampleCount: highInformationSamples.length,
    highInformationFraction,
    heterogeneous,
    similarity,
    canConsiderExtraction: extractionCandidate,
    primaryRecommendation:
      sampleCount < minSamplesForCohortRecommendation
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
        ? "Use known-signature refitting with fit-quality review cues; reserve extraction for higher-burden subgroups."
        : null,
    assay === "panel"
      ? "Use panel-specific review evidence tiers and avoid overinterpreting absent flat signatures."
      : null,
  ]);

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "analysis_advisor",
    scopeStatement: SCOPE_STATEMENTS.analysisAdvisor,
    methodBasis: {
      mutationBurden: METHOD_BASIS.mutationBurden,
      cohortStructure: METHOD_BASIS.cohortStructure,
      thresholdBasis:
        "Burden and heterogeneity thresholds are configurable empirical defaults for review triage. They are not universal literature cutoffs.",
      references: [
        LITERATURE_REFERENCES.koh2021,
        LITERATURE_REFERENCES.medo2024,
        LITERATURE_REFERENCES.degasperi2020,
        assay === "panel" ? LITERATURE_REFERENCES.lawrence2021 : null,
      ].filter(Boolean),
      note:
        "This advisor reports literature-motivated QC signals and configurable recommendations; it is not a consensus clinical decision rule.",
    },
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
 * @validated Exercised by manuscript Results as part of the validated advisor claim set.
 * @param {Object<string,Object<string,number>>} signatures - Reference signatures.
 * @param {Object} [options] - Ambiguity options.
 * @returns {Object} Per-signature ambiguity, pairwise confusability, and warnings.
 */
function computeSignatureAmbiguity(signatures, options = {}) {
  const ambiguityOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.signatureAmbiguity,
    options.ambiguity,
    options.signatureAmbiguity,
    options
  );
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const contexts = getContextList(normalizedSignatures, null, ambiguityOptions);
  const signatureNames = Object.keys(normalizedSignatures);
  const pairReportThreshold = ambiguityOptions.pairReportThreshold;
  const moderateNearestCosine = ambiguityOptions.moderateNearestCosine;
  const highNearestCosine = ambiguityOptions.highNearestCosine;
  const moderateEntropy = ambiguityOptions.moderateEntropy;
  const highEntropy = ambiguityOptions.highEntropy;
  const flatSignatureWarningEntropy = ambiguityOptions.flatSignatureWarningEntropy;
  const topNeighborCount = Math.max(1, Math.floor(ambiguityOptions.topNeighborCount || 5));
  const reviewPercentile = clamp(ambiguityOptions.reviewPercentile ?? 0.75, 0, 1);
  const strongReviewPercentile = clamp(
    ambiguityOptions.strongReviewPercentile ?? 0.9,
    reviewPercentile,
    1
  );
  const nearBoundaryWidth = Math.max(0, ambiguityOptions.nearBoundaryWidth ?? 0.03);
  const catalogVersion =
    ambiguityOptions.catalogVersion || ambiguityOptions.signatureSetName || null;
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
          confoundingNeighbors: [],
          neighbors: [],
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
        summaries[signatureA].confoundingNeighbors.push({
          signatureName: signatureB,
          cosineSimilarity: similarity,
        });
        summaries[signatureB].confoundingNeighbors.push({
          signatureName: signatureA,
          cosineSimilarity: similarity,
        });
      }
      summaries[signatureA].neighbors.push({
        signatureName: signatureB,
        cosineSimilarity: similarity,
      });
      summaries[signatureB].neighbors.push({
        signatureName: signatureA,
        cosineSimilarity: similarity,
      });
    }
  }

  const baseSummaries = Object.values(summaries).map((summary) => {
    const sortedNeighbors = [...summary.neighbors].sort(
      (a, b) => b.cosineSimilarity - a.cosineSimilarity
    );
    const topNeighbors = sortedNeighbors.slice(0, topNeighborCount);
    const topNeighborMeanCosine = weightedMean(
      topNeighbors.map((neighbor) => neighbor.cosineSimilarity)
    );
    const nonspecificityScore = 1 - summary.maxContribution;
    return {
      ...summary,
      topNeighbors,
      topNeighborMeanCosine,
      nonspecificityScore,
      confoundingNeighborCount: summary.confoundingNeighbors.length,
      confoundingNeighbors: summary.confoundingNeighbors.sort(
        (a, b) => b.cosineSimilarity - a.cosineSimilarity
      ),
    };
  });
  const distributions = {
    nearestCosineSimilarity: robustDistribution(
      baseSummaries.map((summary) => summary.nearestCosineSimilarity)
    ),
    topNeighborMeanCosine: robustDistribution(
      baseSummaries.map((summary) => summary.topNeighborMeanCosine)
    ),
    flatnessScore: robustDistribution(
      baseSummaries.map((summary) => summary.flatnessScore)
    ),
    nonspecificityScore: robustDistribution(
      baseSummaries.map((summary) => summary.nonspecificityScore)
    ),
  };
  const rawValues = {
    nearestCosineSimilarity: baseSummaries.map(
      (summary) => summary.nearestCosineSimilarity
    ),
    topNeighborMeanCosine: baseSummaries.map(
      (summary) => summary.topNeighborMeanCosine
    ),
    flatnessScore: baseSummaries.map((summary) => summary.flatnessScore),
    nonspecificityScore: baseSummaries.map(
      (summary) => summary.nonspecificityScore
    ),
  };
  const weights = {
    nearestNeighbor: Math.max(0, ambiguityOptions.nearestNeighborWeight ?? 0.4),
    neighborCrowding: Math.max(0, ambiguityOptions.neighborCrowdingWeight ?? 0.2),
    flatness: Math.max(0, ambiguityOptions.flatnessWeight ?? 0.3),
    nonspecificity: Math.max(0, ambiguityOptions.nonspecificityWeight ?? 0.1),
  };
  const totalWeight = Object.values(weights).reduce((total, value) => total + value, 0) || 1;
  const scoredSummaries = baseSummaries.map((summary) => {
    const componentScores = {
      nearestNeighbor: robustTailScore(
        summary.nearestCosineSimilarity,
        distributions.nearestCosineSimilarity
      ),
      neighborCrowding: robustTailScore(
        summary.topNeighborMeanCosine,
        distributions.topNeighborMeanCosine
      ),
      flatness: robustTailScore(summary.flatnessScore, distributions.flatnessScore),
      nonspecificity: robustTailScore(
        summary.nonspecificityScore,
        distributions.nonspecificityScore
      ),
    };
    const confusabilityScore =
      (componentScores.nearestNeighbor * weights.nearestNeighbor +
        componentScores.neighborCrowding * weights.neighborCrowding +
        componentScores.flatness * weights.flatness +
        componentScores.nonspecificity * weights.nonspecificity) /
      totalWeight;
    return {
      ...summary,
      componentScores,
      confusabilityScore,
    };
  });
  const confusabilityScores = scoredSummaries.map(
    (summary) => summary.confusabilityScore
  );

  const signatureSummaries = scoredSummaries.map((summary) => {
    const componentPercentiles = {
      nearestNeighbor: empiricalPercentile(
        summary.nearestCosineSimilarity,
        rawValues.nearestCosineSimilarity
      ),
      neighborCrowding: empiricalPercentile(
        summary.topNeighborMeanCosine,
        rawValues.topNeighborMeanCosine
      ),
      flatness: empiricalPercentile(summary.flatnessScore, rawValues.flatnessScore),
      nonspecificity: empiricalPercentile(
        summary.nonspecificityScore,
        rawValues.nonspecificityScore
      ),
    };
    const confusabilityPercentile = empiricalPercentile(
      summary.confusabilityScore,
      confusabilityScores
    );
    const evidenceTags = uniqueStrings([
      componentPercentiles.nearestNeighbor >= reviewPercentile
        ? "catalog_neighbor_confusable"
        : null,
      componentPercentiles.neighborCrowding >= reviewPercentile &&
      summary.topNeighbors.length > 1
        ? "neighbor_crowded_catalog_region"
        : null,
      componentPercentiles.flatness >= reviewPercentile
        ? "broad_or_flat_signature"
        : null,
      componentPercentiles.nonspecificity >= reviewPercentile
        ? "low_specificity_profile"
        : null,
      Math.abs((confusabilityPercentile ?? 0) - reviewPercentile) <= nearBoundaryWidth
        ? "near_review_boundary"
        : null,
    ]);
    const reviewRecommended =
      (confusabilityPercentile ?? 0) >= reviewPercentile ||
      evidenceTags.includes("catalog_neighbor_confusable") ||
      evidenceTags.includes("broad_or_flat_signature");
    const strongReviewRecommended =
      (confusabilityPercentile ?? 0) >= strongReviewPercentile;
    const evidenceStrength = strongReviewRecommended
      ? "strong_review_signal"
      : reviewRecommended
        ? "review_signal"
        : (confusabilityPercentile ?? 0) >= 0.5
          ? "background_catalog_signal"
          : "minimal_catalog_signal";
    const warnings = [];

    if (reviewRecommended) {
      warnings.push(
        makeWarning(
          WARNING_CODES.SIGNATURE_AMBIGUITY,
          `${summary.signatureName} met catalog-level identifiability review criteria (${evidenceTags.join(", ") || evidenceStrength}); fitted exposure may be exchangeable with nearby or broad reference signatures.`,
          {
            signatureName: summary.signatureName,
            nearestNeighbor: summary.nearestNeighbor,
            nearestCosineSimilarity: summary.nearestCosineSimilarity,
            confusabilityScore: summary.confusabilityScore,
            confusabilityPercentile,
            evidenceTags,
          }
        )
      );
    }
    if (
      evidenceTags.includes("broad_or_flat_signature") ||
      summary.flatnessScore >= flatSignatureWarningEntropy
    ) {
      warnings.push(
        makeWarning(
          WARNING_CODES.FLAT_SIGNATURE_RISK,
          `${summary.signatureName} met the broad/flat-profile review criterion; low-burden fitted exposure may be less specific.`,
          {
            signatureName: summary.signatureName,
            flatnessScore: summary.flatnessScore,
            flatnessPercentile: componentPercentiles.flatness,
          }
        )
      );
    }

    return {
      ...summary,
      entropyDefinition:
        "Shannon entropy of the signature contribution vector after normalization to sum to one, divided by log(contextCount).",
      confusabilityScore: summary.confusabilityScore,
      confusabilityScoreDefinition:
        "Continuous catalog-relative review score combining nearest-neighbor similarity, top-neighbor crowding, profile flatness, and low profile specificity after robust scaling within the selected catalog.",
      confusabilityPercentile,
      componentScores: summary.componentScores,
      componentPercentiles,
      evidenceTags,
      evidenceStrength,
      reviewRecommended,
      strongReviewRecommended,
      thresholdDistance: {
        reviewPercentile:
          confusabilityPercentile === null
            ? null
            : confusabilityPercentile - reviewPercentile,
        strongReviewPercentile:
          confusabilityPercentile === null
            ? null
            : confusabilityPercentile - strongReviewPercentile,
      },
      warnings,
    };
  });
  const warnings = signatureSummaries.flatMap((signature) => signature.warnings);

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "signature_ambiguity",
    scopeStatement: SCOPE_STATEMENTS.signatureAmbiguity,
    methodBasis: {
      signatureAmbiguity: METHOD_BASIS.signatureAmbiguity,
      thresholdBasis:
        "The primary output is a continuous, catalog-relative identifiability report. Percentile bands and warning rules are configurable review aids, not calibrated biological discontinuities.",
      scoreBasis:
        "The confusability score combines robustly scaled nearest-neighbor similarity, top-neighbor crowding, flatness/entropy, and low profile specificity within the selected catalog.",
      references: [
        LITERATURE_REFERENCES.koh2021,
        LITERATURE_REFERENCES.jin2024,
        LITERATURE_REFERENCES.wu2023,
        LITERATURE_REFERENCES.alexandrov2020,
        LITERATURE_REFERENCES.medo2024,
        LITERATURE_REFERENCES.senkin2021,
      ],
      note:
        "Do not interpret tiny changes around a percentile boundary as scientific class changes. Inspect continuous scores, evidence tags, and sample-level bootstrap or threshold sensitivity where available.",
    },
    catalogVersion,
    thresholds: {
      pairReportThreshold,
      moderateNearestCosine,
      highNearestCosine,
      moderateEntropy,
      highEntropy,
      flatSignatureWarningEntropy,
      reviewPercentile,
      strongReviewPercentile,
      nearBoundaryWidth,
      topNeighborCount,
      note:
        "Cosine/entropy thresholds support descriptive neighbor and flatness evidence; continuous score percentiles are review settings, not calibrated biological discontinuities.",
    },
    scoreWeights: weights,
    distributionSummary: {
      nearestCosineMedian: distributions.nearestCosineSimilarity.median,
      topNeighborMeanMedian: distributions.topNeighborMeanCosine.median,
      flatnessMedian: distributions.flatnessScore.median,
      nonspecificityMedian: distributions.nonspecificityScore.median,
    },
    contexts,
    signatures: signatureSummaries,
    pairs: pairs.sort((a, b) => b.cosineSimilarity - a.cosineSimilarity),
    catalogSummary: {
      signatureCount: signatureSummaries.length,
      reviewRecommendedCount: signatureSummaries.filter(
        (signature) => signature.reviewRecommended
      ).length,
      strongReviewRecommendedCount: signatureSummaries.filter(
        (signature) => signature.strongReviewRecommended
      ).length,
      meanConfusabilityScore: average(
        signatureSummaries.map((signature) => signature.confusabilityScore)
      ),
      reportedPairCount: pairs.length,
    },
    warnings,
  };
}

/**
 * Computes continuous, catalog-relative signature identifiability evidence.
 *
 * Alias of `computeSignatureAmbiguity` with clearer terminology for new code.
 *
 * @function computeSignatureIdentifiability
 * @memberof advisor
 * @param {Object<string,Object<string,number>>} signatures - Reference signatures.
 * @param {Object} [options] - Identifiability options.
 * @returns {Object} Per-signature confusability scores, evidence tags, neighbors, and warnings.
 */
function computeSignatureIdentifiability(signatures, options = {}) {
  return computeSignatureAmbiguity(signatures, options);
}

/**
 * Looks for residual evidence that fitted spectra contain out-of-reference signal.
 *
 * @function detectOutOfReferenceSignal
 * @memberof advisor
 * @validated Exercised by manuscript Results as part of the validated advisor claim set.
 * @param {Object} input - Fitted spectra, signatures, exposures, and optional residuals.
 * @param {Object} [options] - Catalog sufficiency options.
 * @returns {Object} Per-sample catalog sufficiency checks and recommendations.
 */
function detectOutOfReferenceSignal(input = {}, options = {}) {
  const catalogOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.catalogSufficiency,
    options.catalogSufficiency,
    options.catalogCheck,
    options
  );
  const {
    signatures,
    spectra,
    exposures,
    residuals = null,
    reconstructionError = null,
  } = input;
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const normalizedSpectra = normalizeSpectraInput(spectra || input, catalogOptions);
  const normalizedExposures = normalizeMatrixObject(exposures);
  const contexts = getContextList(normalizedSignatures, normalizedSpectra, catalogOptions);

  if (!residuals && (!signatures || !spectra || !exposures)) {
    throw new Error(
      "detectOutOfReferenceSignal requires residuals or signatures, spectra, and exposures."
    );
  }

  const residualResult =
    residuals ||
    calculateFitResiduals(normalizedSignatures, normalizedSpectra, normalizedExposures, {
      contexts,
      normalizeMode: catalogOptions.normalizeMode,
    });
  const reconstruction =
    reconstructionError ||
    calculateReconstructionError(
      normalizedSignatures,
      normalizedSpectra,
      normalizedExposures,
      { contexts, normalizeMode: catalogOptions.normalizeMode }
    );
  const unexplainedThreshold = catalogOptions.unexplainedThreshold;
  const weakUnexplainedThreshold = catalogOptions.weakUnexplainedThreshold;
  const cosineThreshold = catalogOptions.cosineThreshold;
  const structuredResidualCosineThreshold =
    catalogOptions.structuredResidualCosineThreshold;
  const minBurdenForReliableDetection =
    catalogOptions.minBurdenForReliableDetection;
  const topN = catalogOptions.topN;
  const burdenSummary =
    input.burdenSummary ||
    summarizeMutationBurden(normalizedSpectra, {
      expectedContexts: contexts,
      lowBurdenThreshold: minBurdenForReliableDetection,
      moderateBurdenThreshold: catalogOptions.moderateBurdenThreshold,
    });

  const samples = residualResult.samples.map((sample) => {
    const reconstructionSample = getReconstructionSample(reconstruction, sample.sample);
    const burdenSample = getBurdenSample(burdenSummary, sample.sample);
    const totalMutations = burdenSample?.totalMutations ?? sample.metrics.totalObserved ?? null;
    const burdenClass = getBurdenClass(totalMutations, {
      lowBurdenThreshold: minBurdenForReliableDetection,
      moderateBurdenThreshold: catalogOptions.moderateBurdenThreshold,
    });
    const reliableResidualDetection =
      Number.isFinite(totalMutations) &&
      totalMutations >= minBurdenForReliableDetection;
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
    const rawStatus = suspected
      ? "suspected_out_of_reference"
      : possible
        ? "possible_out_of_reference"
        : "catalog_sufficient_for_fit";
    const status =
      rawStatus === "suspected_out_of_reference" && !reliableResidualDetection
        ? "possible_out_of_reference"
        : rawStatus;
    const warnings = [];

    if (rawStatus === "suspected_out_of_reference" && !reliableResidualDetection) {
      warnings.push(
        makeWarning(
          WARNING_CODES.LOW_BURDEN,
          `${sample.sample} met a residual review criterion, but mutation burden is below the configured minimum for reliable catalog-sufficiency screening.`,
          { sample: sample.sample, totalMutations, minBurdenForReliableDetection }
        )
      );
    } else if (status === "suspected_out_of_reference") {
      warnings.push(
        makeWarning(
          WARNING_CODES.CATALOG_INCOMPLETE_SUSPECTED,
          `${sample.sample} met residual/reconstruction review criteria indicating the reference catalog may not explain all observed structure.`,
          { sample: sample.sample, unexplainedFraction }
        )
      );
    } else if (structuredResidual) {
      warnings.push(
        makeWarning(
          WARNING_CODES.HIGH_RESIDUAL_STRUCTURE,
          `${sample.sample} met the structured-residual review criterion despite acceptable aggregate error.`,
          { sample: sample.sample }
        )
      );
    }

    return {
      sample: sample.sample,
      status,
      rawStatus,
      totalMutations,
      burdenClass,
      minBurdenForReliableDetection,
      reliableResidualDetection,
      unexplainedFraction,
      cosineSimilarity: reconstructionSample?.cosineSimilarity ?? null,
      rmse: reconstructionSample?.rmse ?? null,
      structuredResidual,
      structuredResidualDefinition:
        "Cosine similarity between the positive residual vector and the nearest supplied reference signature, considered only when the relative unexplained fraction also exceeds the weak threshold.",
      residualMatches,
      residualMatchesInterpretation:
        "Candidate catalog patterns for manual review only; residual matches do not identify an active or causal mutational signature.",
      topResidualContexts,
      warnings,
      recommendedAction:
        status === "suspected_out_of_reference"
          ? "Inspect residual spectrum, test a broader or disease-specific catalog, and consider de novo extraction in an adequately powered cohort."
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
    scopeStatement: SCOPE_STATEMENTS.catalogSufficiency,
    methodBasis: {
      reconstructionResidual: METHOD_BASIS.reconstructionResidual,
      catalogSufficiency: METHOD_BASIS.catalogSufficiency,
      thresholdBasis:
        "Unexplained-fraction and residual-cosine thresholds are configurable internal review defaults. They should be calibrated to study-specific synthetic or held-out validation data before inferential use.",
      references: [
        LITERATURE_REFERENCES.koh2021,
        LITERATURE_REFERENCES.degasperi2020,
        LITERATURE_REFERENCES.alexandrov2020,
        LITERATURE_REFERENCES.medo2024,
      ],
      note:
        "Residual and cosine cutoffs are configurable QC triggers for manual review and reference-catalog reassessment.",
    },
    thresholds: {
      unexplainedThreshold,
      weakUnexplainedThreshold,
      cosineThreshold,
      structuredResidualCosineThreshold,
      minBurdenForReliableDetection,
    },
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
 * Builds a literature-aligned QC evidence report for known-signature fitting.
 *
 * Reports burden, reconstruction, residual, bootstrap, threshold, ambiguity,
 * and catalog-sufficiency diagnostics so callers can apply study-specific
 * reporting rules.
 *
 * @function computeFitQualityEvidence
 * @memberof advisor
 * @validated Exercised by manuscript Results as part of the validated advisor claim set.
 * @param {Object} input - Fitted spectra, signatures, exposures, and optional QC objects.
 * @param {Object} [options] - QC evidence options.
 * @returns {Object} Per-sample QC evidence, caveats, and next actions.
 */
function computeFitQualityEvidence(input = {}, options = {}) {
  const fitQualityOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.fitQualityEvidence,
    options.fitQualityEvidence,
    options.qcEvidence,
    options
  );
  const { signatures, spectra, exposures } = input;
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const normalizedSpectra = normalizeSpectraInput(spectra || input, fitQualityOptions);
  const normalizedExposures = normalizeMatrixObject(exposures);
  const contexts = getContextList(
    normalizedSignatures,
    normalizedSpectra,
    fitQualityOptions
  );
  const burdenSummary =
    input.burdenSummary ||
    summarizeMutationBurden(normalizedSpectra, {
      expectedContexts: contexts,
      lowBurdenThreshold: fitQualityOptions.lowBurdenThreshold,
      moderateBurdenThreshold: fitQualityOptions.moderateBurdenThreshold,
    });
  const residuals =
    input.residuals ||
    calculateFitResiduals(normalizedSignatures, normalizedSpectra, normalizedExposures, {
      contexts,
      normalizeMode: fitQualityOptions.normalizeMode,
      lowBurdenThreshold: fitQualityOptions.lowBurdenThreshold,
      moderateBurdenThreshold: fitQualityOptions.moderateBurdenThreshold,
    });
  const reconstructionError =
    input.reconstructionError ||
    calculateReconstructionError(
      normalizedSignatures,
      normalizedSpectra,
      normalizedExposures,
      {
        contexts,
        normalizeMode: fitQualityOptions.normalizeMode,
        lowBurdenThreshold: fitQualityOptions.lowBurdenThreshold,
        moderateBurdenThreshold: fitQualityOptions.moderateBurdenThreshold,
      }
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
    }, fitQualityOptions);
  const thresholds = {
    lowBurdenThreshold: fitQualityOptions.lowBurdenThreshold,
    moderateBurdenThreshold: fitQualityOptions.moderateBurdenThreshold,
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
    const cosine = reconstructionSample?.cosineSimilarity || 0;
    const denominator =
      residualSample?.normalizationMode === "relative"
        ? 2
        : Math.max(residualSample?.metrics?.totalObserved || 0, 1);
    const unexplainedFraction = residualSample
      ? clamp(residualSample.metrics.l1Error / denominator, 0, 1)
      : 1;
    const activeSignatures = activeSignatureNames(normalizedExposures[sampleName]);
    const activeAmbiguityEvidence = activeSignatures.map((signatureName) => {
      const signatureEvidence = ambiguityBySignature[signatureName] || {};
      return {
        signatureName,
        confusabilityScore: signatureEvidence.confusabilityScore ?? null,
        confusabilityPercentile:
          signatureEvidence.confusabilityPercentile ?? null,
        evidenceTags: signatureEvidence.evidenceTags || [],
        evidenceStrength:
          signatureEvidence.evidenceStrength || "minimal_catalog_signal",
        reviewRecommended: Boolean(signatureEvidence.reviewRecommended),
        nearestNeighbor: signatureEvidence.nearestNeighbor || null,
        nearestCosineSimilarity:
          signatureEvidence.nearestCosineSimilarity ?? null,
        flatnessScore: signatureEvidence.flatnessScore ?? null,
      };
    });
    const activeAmbiguityEvidenceTags = uniqueStrings(
      activeAmbiguityEvidence.flatMap((evidence) => evidence.evidenceTags || [])
    );
    const activeReviewRecommendedSignatures = activeAmbiguityEvidence
      .filter((evidence) => evidence.reviewRecommended)
      .map((evidence) => evidence.signatureName);
    const maxActiveConfusabilityScore = Math.max(
      ...activeAmbiguityEvidence
        .map((evidence) => evidence.confusabilityScore)
        .filter(Number.isFinite),
      0
    );
    const componentEvidence = {
      burden: {
        burdenClass,
        totalMutations: burdenSample?.totalMutations ?? null,
        configuredLowBurdenThreshold: thresholds.lowBurdenThreshold,
        configuredModerateBurdenThreshold: thresholds.moderateBurdenThreshold,
        derivedScoreDeprecated: true,
      },
      reconstruction: {
        cosineSimilarity: cosine,
        rmse: reconstructionSample?.rmse ?? null,
        derivedScoreDeprecated: true,
      },
      residual: {
        unexplainedFraction,
        normalizationMode: residualSample?.normalizationMode || null,
        derivedScoreDeprecated: true,
      },
      bootstrap: {
        ...bootstrapSummary,
        derivedScoreDeprecated: true,
      },
      threshold: {
        ...thresholdSummary,
        derivedScoreDeprecated: true,
      },
      ambiguity: {
        activeSignatures,
        activeAmbiguityEvidence,
        activeAmbiguityEvidenceTags,
        activeReviewRecommendedSignatures,
        maxActiveConfusabilityScore,
        interpretationBoundary:
          "Signature ambiguity evidence is catalog-relative and continuous. Use evidenceTags, confusability scores, confusability percentiles, and reviewRecommended signatures for interpretation.",
        derivedScoreDeprecated: true,
      },
      catalog: {
        status: catalogSample?.status || "not_checked",
        derivedScoreDeprecated: true,
      },
    };
    const warnings = [];

    if (burdenClass === "low" || burdenClass === "insufficient") {
      warnings.push(
        makeWarning(
          burdenClass === "low"
            ? WARNING_CODES.LOW_BURDEN
            : WARNING_CODES.INSUFFICIENT_SIGNAL,
          `${sampleName} is in the ${burdenClass} mutation-burden category under the selected analysis settings.`,
          { sample: sampleName }
        )
      );
    }
    if (bootstrapSummary.measured && bootstrapSummary.warningCodes.length > 0) {
      warnings.push(
        makeWarning(
          WARNING_CODES.FIT_UNSTABLE,
          `${sampleName} met bootstrap review criteria that should be inspected before routine reporting.`,
          { sample: sampleName, warningCodes: bootstrapSummary.warningCodes }
        )
      );
    }
    if (thresholdSummary.measured && thresholdSummary.warningCodes.length > 0) {
      warnings.push(
        makeWarning(
          WARNING_CODES.THRESHOLD_DEPENDENT,
          `${sampleName} met threshold-sensitivity review criteria under the configured settings.`,
          { sample: sampleName, warningCodes: thresholdSummary.warningCodes }
        )
      );
    }
    if (activeReviewRecommendedSignatures.length > 0) {
      warnings.push(
        makeWarning(
          WARNING_CODES.SIGNATURE_AMBIGUITY,
          `${sampleName} includes active fitted signatures that met catalog-level identifiability review criteria.`,
          {
            sample: sampleName,
            activeSignatures,
            activeReviewRecommendedSignatures,
            activeAmbiguityEvidenceTags,
            maxActiveConfusabilityScore,
          }
        )
      );
    }
    if (catalogSample?.status === "suspected_out_of_reference") {
      warnings.push(...catalogSample.warnings);
    }
    const reportingMode = classifyFitQcEvidence(warnings);
    const reviewFlagCount = warnings.length;

    return {
      sample: sampleName,
      reportingMode,
      recommendedReportingMode: reportingMode,
      primaryInterpretationField: "reportingMode",
      reviewFlagCount,
      reviewFlagCodes: warnings.map((warning) => warning.code),
      componentEvidence,
      metrics: {
        burdenClass,
        totalMutations: burdenSample?.totalMutations ?? null,
        cosineSimilarity: cosine,
        rmse: reconstructionSample?.rmse ?? null,
        unexplainedFraction,
        activeSignatures,
        activeReviewRecommendedSignatures,
        activeAmbiguityEvidenceTags,
        maxActiveConfusabilityScore,
      },
      bootstrap: bootstrapSummary,
      thresholdSensitivity: thresholdSummary,
      catalogStatus: catalogSample?.status || "not_checked",
      flags: warnings,
      evidenceFlags: warnings,
      warnings,
      caveats: warnings.map((warning) => warning.message),
      recommendedActions: uniqueStrings([
        bootstrapSummary.recommendation,
        thresholdSummary.recommendation,
        catalogSample?.recommendedAction,
        summarizeFitQcAction(reportingMode),
      ]),
    };
  });

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "fit_quality_evidence",
    scopeStatement: SCOPE_STATEMENTS.fitQualityEvidence,
    methodBasis: {
      mutationBurden: METHOD_BASIS.mutationBurden,
      reconstructionResidual: METHOD_BASIS.reconstructionResidual,
      signatureAmbiguity: METHOD_BASIS.signatureAmbiguity,
      catalogSufficiency: METHOD_BASIS.catalogSufficiency,
      bootstrapThreshold: METHOD_BASIS.bootstrapThreshold,
      reportingModeRules: {
        not_assessable:
          "Triggered by insufficient signal or not-assessable panel evidence.",
        restricted_interpretation:
          "Triggered by low burden, catalog review cues, or structured-residual review cues.",
        report_with_caveats:
          "Triggered by configured bootstrap warnings, threshold-sensitivity warnings, identifiability review cues, or flat-profile review cues.",
        standard_qc_passed:
          "Returned only when none of the configured rule-based review cues are active.",
      },
      references: [
        LITERATURE_REFERENCES.koh2021,
        LITERATURE_REFERENCES.medo2024,
        LITERATURE_REFERENCES.jin2024,
        LITERATURE_REFERENCES.wu2023,
        LITERATURE_REFERENCES.huang2018,
      ],
      note:
        "Reporting modes are rule-based summaries of burden, reconstruction, residual, bootstrap, threshold, ambiguity, and catalog evidence.",
    },
    contexts,
    primaryInterpretationField: "samples[].reportingMode",
    samples,
    summary: {
      sampleCount: samples.length,
      meanReviewFlagCount: average(samples.map((sample) => sample.reviewFlagCount)),
      reportingModeCounts: Object.fromEntries(
        [
          "standard_qc_passed",
          "report_with_caveats",
          "restricted_interpretation",
          "not_assessable",
        ].map((mode) => [
          mode,
          samples.filter((sample) => sample.reportingMode === mode).length,
        ])
      ),
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
 * @returns {Promise<Object>} Fitted spectrum, fit-quality evidence, ambiguity, residuals, catalog check, and report artifacts.
 */
async function runSingleSampleFit(input = {}, options = {}) {
  const sampleName = input.sampleName ?? options.sampleName ?? "sample_1";
  const spectra = normalizeSpectraInput(input.spectra || input.spectrum || input, {
    sampleName,
  });
  const selectedSample = spectra[sampleName] ? sampleName : Object.keys(spectra)[0];
  const singleSpectra = selectedSample ? { [selectedSample]: spectra[selectedSample] } : {};
  const signatures = normalizeMatrixObject(
    input.signatures || input.referenceSignatures || options.signatures || {}
  );
  const contexts = getContextList(signatures, singleSpectra, options);
  const burdenOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.singleSampleFit.mutationBurden,
    options.mutationBurden,
    options.mutationBurdenOptions,
    optionSubset(options, [
      "lowBurdenThreshold",
      "lowBurdenThresholdMode",
      "thresholdMode",
      "quantile",
      "moderateBurdenThreshold",
    ])
  );
  const fitOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.singleSampleFit.fit,
    options.fit,
    options.fitOptions,
    optionSubset(options, [
      "exposureThreshold",
      "exposureType",
      "renormalize",
      "maxIterations",
      "convergenceTolerance",
    ]),
    { contexts }
  );
  const residualOptions = mergeDefinedOptions(
    { normalizeMode: fitOptions.exposureType },
    burdenOptions,
    options.residuals,
    options.residualOptions,
    optionSubset(options, [
      "weakUnexplainedThreshold",
      "highResidualStructureCosineThreshold",
    ]),
    { contexts }
  );
  const thresholdOptions = mergeDefinedOptions(
    { ...ADVISOR_DEFAULTS.singleSampleFit.thresholdSensitivity },
    options.thresholdSensitivity,
    options.thresholdSensitivityOptions,
    optionSubset(options, [
      "thresholds",
      "baselineThreshold",
      "instabilityL1Threshold",
      "activeSetJaccardThreshold",
    ]),
    {
      contexts,
      exposureType: fitOptions.exposureType,
      renormalize: fitOptions.renormalize,
      maxIterations: fitOptions.maxIterations,
      convergenceTolerance: fitOptions.convergenceTolerance,
    }
  );
  const bootstrapOptions = mergeDefinedOptions(
    { ...ADVISOR_DEFAULTS.singleSampleFit.bootstrap },
    options.bootstrap,
    options.bootstrapOptions,
    optionSubset(options, [
      "bootstrapIterations",
      "iterations",
      "confidenceLevel",
      "seed",
      "minIterationsForStableIntervals",
      "publicationRecommendedIterations",
      "minMutationsForBootstrapSummary",
    ]),
    {
      contexts,
      exposureThreshold: fitOptions.exposureThreshold,
      exposureType: fitOptions.exposureType,
      renormalize: fitOptions.renormalize,
      maxIterations: fitOptions.maxIterations,
      convergenceTolerance: fitOptions.convergenceTolerance,
    }
  );
  if (bootstrapOptions.bootstrapIterations !== undefined) {
    bootstrapOptions.iterations = bootstrapOptions.bootstrapIterations;
  }
  const ambiguityOptions = mergeDefinedOptions(
    options.ambiguity,
    options.ambiguityOptions,
    { contexts }
  );
  const catalogOptions = mergeDefinedOptions(
    options.catalogSufficiency,
    options.catalogCheck,
    options.catalogOptions,
    burdenOptions,
    { normalizeMode: fitOptions.exposureType, contexts }
  );
  const fitQualityOptions = mergeDefinedOptions(
    burdenOptions,
    options.fitQualityEvidence,
    options.fitQualityOptions,
    { normalizeMode: fitOptions.exposureType, contexts }
  );

  if (Object.keys(singleSpectra).length === 0) {
    throw new Error("runSingleSampleFit requires one spectrum or spectra matrix.");
  }
  if (Object.keys(signatures).length === 0) {
    throw new Error("runSingleSampleFit requires reference signatures.");
  }

  const advisor = recommendAnalysisStrategy(singleSpectra, {
    ...options,
    ...burdenOptions,
    expectedContexts: contexts,
  });
  const validation = {
    spectra: validateSpectra(singleSpectra, {
      expectedContexts: contexts,
      minTotalMutations:
        options.validationMinTotalMutations ?? burdenOptions.lowBurdenThreshold,
    }),
    signatures: validateSignatureMatrix(signatures, { expectedContexts: contexts }),
  };
  const exposures = await fitSpectraWithNNLS(signatures, singleSpectra, fitOptions);
  const residuals = calculateFitResiduals(
    signatures,
    singleSpectra,
    exposures,
    residualOptions
  );
  const reconstructionError = calculateReconstructionError(
    signatures,
    singleSpectra,
    exposures,
    residualOptions
  );
  const thresholdSensitivity =
    options.runThresholdSensitivity === false
      ? null
      : await runThresholdSensitivity(signatures, singleSpectra, thresholdOptions);
  const bootstrap =
    options.runBootstrap === false
      ? null
      : {
          [selectedSample]: await bootstrapSignatureFit(
            signatures,
            singleSpectra[selectedSample],
            bootstrapOptions
          ),
        };
  const ambiguity = computeSignatureAmbiguity(signatures, ambiguityOptions);
  const catalogCheck = detectOutOfReferenceSignal(
    {
      signatures,
      spectra: singleSpectra,
      exposures,
      residuals,
      reconstructionError,
      contexts,
    },
    catalogOptions
  );
  const fitQualityEvidence = computeFitQualityEvidence({
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
  }, fitQualityOptions);
  const primaryWarnings = deduplicateWarnings([
    ...(advisor.warnings || []),
    ...(fitQualityEvidence.warnings || []),
    ...(catalogCheck.warnings || []),
    ...(thresholdSensitivity?.warnings || []),
    ...Object.values(bootstrap || {}).flatMap((entry) => entry.warnings || []),
  ]);
  const interpretationSuspended = fitQualityEvidence.samples.some(
    (sample) => sample.reportingMode === "not_assessable"
  );
  const subsystemSummary = [
    summarizeSubsystem("advisor", advisor, advisor.warnings),
    summarizeSubsystem("fitQualityEvidence", fitQualityEvidence, fitQualityEvidence.warnings),
    summarizeSubsystem("ambiguity", ambiguity, ambiguity.warnings),
    summarizeSubsystem("catalogCheck", catalogCheck, catalogCheck.warnings),
    summarizeSubsystem("thresholdSensitivity", thresholdSensitivity, thresholdSensitivity?.warnings),
    summarizeSubsystem(
      "bootstrap",
      { workflowRole: "bootstrap_exposure_uncertainty" },
      Object.values(bootstrap || {}).flatMap((entry) => entry.warnings || [])
    ),
  ];
  const thresholdBootstrapAction =
    !bootstrap &&
    (thresholdSensitivity?.warnings || []).some(
      (warning) => warning.code === WARNING_CODES.THRESHOLD_DEPENDENT
    )
      ? "Run bootstrapSignatureFit because threshold sensitivity raised a threshold-dependence review cue."
      : null;
  const report = createAnalysisReport(
    {
      title: "mSigSDK Single-Sample Signature Fit Report",
      summary:
        "Single-sample refitting workflow with literature-aligned QC evidence, uncertainty, residual checks, and reporting diagnostics.",
      workflowRole: "single_sample_fit",
      scopeStatement: SCOPE_STATEMENTS.singleSamplePipeline,
      methodBasis: {
        pipeline:
          "Single-sample refitting combines NNLS exposures with mutation-burden QC, residual review, reconstruction metrics, bootstrap uncertainty, threshold sensitivity, ambiguity screening, and catalog-sufficiency checks.",
        interpretationBoundary:
          "Exposures are interpreted through QC evidence and reporting modes rather than as standalone confidence estimates.",
        validationAnchor: [
          SYNTHETIC_VALIDATION_ANCHORS.burden50,
          SYNTHETIC_VALIDATION_ANCHORS.burden100,
        ],
        references: [
          LITERATURE_REFERENCES.koh2021,
          LITERATURE_REFERENCES.medo2024,
          LITERATURE_REFERENCES.huang2018,
        ],
      },
      primaryInterpretationFields: [
        "fitQualityEvidence.samples[].reportingMode",
        "catalogCheck.samples[].status",
        "bootstrap[sample].signatures[].interval",
        "thresholdSensitivity.summary",
      ],
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
        fitQualityEvidence: fitQualityEvidence.summary,
        catalogCheck: catalogCheck.summary,
      },
      exposures,
      citations: [
        LITERATURE_REFERENCES.koh2021,
        LITERATURE_REFERENCES.medo2024,
        LITERATURE_REFERENCES.huang2018,
      ],
      notes: [
        ...advisor.caveats,
        "Fit interpretation is conditional on the supplied signature catalog, context basis, exposure threshold, and QC evidence.",
      ],
    },
    { format: options.reportFormat ?? "object" }
  );

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "single_sample_fit",
    workflowRole: "single_sample_fit_pipeline",
    scopeStatement: SCOPE_STATEMENTS.singleSamplePipeline,
    methodBasis: {
      pipeline:
        "Single-sample refitting combines NNLS exposures with mutation-burden QC, residual review, reconstruction metrics, bootstrap uncertainty, threshold sensitivity, ambiguity screening, and catalog-sufficiency checks.",
      interpretationBoundary:
        "The primary interpretation fields are fitQualityEvidence.samples[].reportingMode, catalogCheck.samples[].status, bootstrap signature intervals, and threshold-sensitivity drift. Exposures alone should not be treated as confidence estimates.",
      validationAnchor: [
        SYNTHETIC_VALIDATION_ANCHORS.burden50,
        SYNTHETIC_VALIDATION_ANCHORS.burden100,
      ],
      references: [
        LITERATURE_REFERENCES.koh2021,
        LITERATURE_REFERENCES.medo2024,
        LITERATURE_REFERENCES.huang2018,
      ],
    },
    primaryInterpretationFields: [
      "fitQualityEvidence.samples[].reportingMode",
      "catalogCheck.samples[].status",
      "bootstrap[sample].signatures[].interval",
      "thresholdSensitivity.summary",
    ],
    parameters: {
      workflow: "runSingleSampleFit",
      sampleName: selectedSample,
      fitOptions,
      burdenOptions,
      thresholdOptions,
      bootstrapOptions: bootstrap ? bootstrapOptions : null,
      catalogOptions,
      fitQualityOptions,
    },
    validationAnchor: [
      SYNTHETIC_VALIDATION_ANCHORS.burden50,
      SYNTHETIC_VALIDATION_ANCHORS.burden100,
    ],
    sample: selectedSample,
    spectrum: singleSpectra[selectedSample],
    validation,
    qc: {
      mutationBurden: advisor.mutationBurden,
      contextCoverage: advisor.contextCoverage,
      reconstructionError,
      residuals,
      thresholdSensitivity,
      bootstrap,
      fitQualityEvidence: fitQualityEvidence.summary,
      catalogCheck: catalogCheck.summary,
    },
    warnings: primaryWarnings,
    primaryWarnings,
    provenance: null,
    interpretationSuspended,
    subsystemSummary,
    advisor,
    fit: {
      method: "NNLS",
      solverVariant: "coordinate_descent_nnls",
      solverCaveats: [
        "Numerical fit reviewed with QC and uncertainty evidence.",
        "Plain NNLS is reviewed with ambiguity diagnostics for confusable signatures.",
      ],
      exposures,
      parameters: fitOptions,
      reconstructionError,
    },
    fitQualityEvidence,
    ambiguity,
    residuals,
    catalogCheck,
    thresholdSensitivity,
    bootstrap,
    recommendedActions: uniqueStrings([
      ...advisor.recommendedActions,
      ...fitQualityEvidence.recommendedActions,
      ...catalogCheck.recommendedActions,
      thresholdBootstrapAction,
    ]),
    publicationFigures: buildPublicationFigureDescriptors("single_sample", {
      single_sample_exposure: ["fit.exposures", "bootstrap"],
      reconstruction_residuals: ["residuals"],
      fit_quality_evidence_dashboard: ["fitQualityEvidence"],
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
  const q1 = quantile(finiteValues, 0.25);
  const q3 = quantile(finiteValues, 0.75);
  const variance =
    finiteValues.length <= 1
      ? 0
      : sum(finiteValues.map((value) => (value - mean) ** 2)) /
        (finiteValues.length - 1);

  return {
    n: finiteValues.length,
    mean,
    median,
    q1,
    q3,
    iqr:
      Number.isFinite(q1) && Number.isFinite(q3)
        ? q3 - q1
        : null,
    variance,
    sd: Math.sqrt(variance),
  };
}

function rankBiserialCorrelation(referenceValues, comparisonValues) {
  const reference = referenceValues.filter(Number.isFinite);
  const comparison = comparisonValues.filter(Number.isFinite);
  if (reference.length === 0 || comparison.length === 0) {
    return null;
  }

  const ranked = [
    ...reference.map((value) => ({ value, group: "reference" })),
    ...comparison.map((value) => ({ value, group: "comparison" })),
  ].sort((a, b) => a.value - b.value);

  let index = 0;
  let comparisonRankSum = 0;
  while (index < ranked.length) {
    let tieEnd = index + 1;
    while (tieEnd < ranked.length && ranked[tieEnd].value === ranked[index].value) {
      tieEnd += 1;
    }
    const averageRank = (index + 1 + tieEnd) / 2;
    for (let rankIndex = index; rankIndex < tieEnd; rankIndex++) {
      if (ranked[rankIndex].group === "comparison") {
        comparisonRankSum += averageRank;
      }
    }
    index = tieEnd;
  }

  const comparisonCount = comparison.length;
  const referenceCount = reference.length;
  const mannWhitneyU =
    comparisonRankSum - (comparisonCount * (comparisonCount + 1)) / 2;
  return (2 * mannWhitneyU) / (referenceCount * comparisonCount) - 1;
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
 * @experimental Descriptive group comparison helper outside the manuscript-validated advisor claim set.
 * @param {Object<string,Object<string,number>>} exposures - Sample-by-signature exposure matrix.
 * @param {Object[]|Object<string,Object>} metadata - Sample metadata rows or object keyed by sample.
 * @param {Object} [options] - Group comparison options.
 * @returns {Object} Group summaries, pairwise exposure comparisons, warnings, and recommendations.
 */
function compareSignatureExposures(exposures, metadata, options = {}) {
  warnExperimentalAdvisorFunction("compareSignatureExposures");
  const comparisonOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.groupComparison,
    options.comparison,
    options.groupComparison,
    options
  );
  const normalizedExposures = normalizeMatrixObject(exposures);
  const normalizedMetadata = normalizeMetadataInput(metadata);
  const groupKey =
    comparisonOptions.groupKey ?? comparisonOptions.comparisonKey ?? "group";
  const minGroupSizeForReliableStats =
    comparisonOptions.minGroupSizeForReliableStats;
  const permutationIterations = comparisonOptions.permutationIterations;
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
      scopeStatement: SCOPE_STATEMENTS.groupComparison,
      methodBasis: {
        summaryStatistics:
          "Exposure rows are bounded and often zero-inflated; medians and IQRs are reported with means and standard deviations.",
        effectSize:
          "The primary effectSize is rank-biserial correlation, a non-parametric direction-and-magnitude summary for two-group comparisons.",
        multipleTesting:
          "Benjamini-Hochberg correction is applied across all signature-by-group comparisons generated in one function call when permutation p-values are requested.",
      },
      groupKey,
      minGroupSizeForReliableStats,
      reportingMode: "not_assessable",
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
    if (sampleNames.length < minGroupSizeForReliableStats) {
      warnings.push(
        makeWarning(
          WARNING_CODES.GROUP_IMBALANCE,
          `${groupKey}=${group} contains fewer than ${minGroupSizeForReliableStats} samples.`,
          { groupKey, group, sampleCount: sampleNames.length, minGroupSizeForReliableStats }
        )
      );
    }
    return {
      group,
      sampleCount: sampleNames.length,
      samples: sampleNames,
    };
  });
  const referenceGroup = comparisonOptions.referenceGroup
    ? String(comparisonOptions.referenceGroup)
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
      const standardizedMeanDifference = pooledSd > 0 ? meanDifference / pooledSd : 0;
      const effectSize = rankBiserialCorrelation(referenceValues, comparisonValues);
      const pValue = permutationPValue(
        referenceValues,
        comparisonValues,
        permutationIterations,
        comparisonOptions.seed + comparisons.length
      );

      comparisons.push({
        signatureName,
        referenceGroup,
        comparisonGroup,
        reference: referenceSummary,
        comparison: comparisonSummary,
        meanDifference,
        absoluteMeanDifference: Math.abs(meanDifference),
        standardizedMeanDifference,
        effectSize,
        effectSizeMethod: "rank_biserial_correlation",
        effectSizeDirection:
          effectSize === null
            ? null
            : effectSize > 0
              ? `${comparisonGroup}_higher_than_${referenceGroup}`
              : effectSize < 0
                ? `${comparisonGroup}_lower_than_${referenceGroup}`
                : "no_directional_shift",
        pValue,
        qValue: null,
      });
    }
  }

  const adjustedComparisons = adjustBenjaminiHochberg(comparisons).sort(
    (a, b) =>
      b.absoluteMeanDifference - a.absoluteMeanDifference ||
      Math.abs(b.effectSize || 0) - Math.abs(a.effectSize || 0)
  );
  const topSignals = adjustedComparisons
    .filter((comparison) => comparison.absoluteMeanDifference > 0)
    .slice(0, comparisonOptions.topN);

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "cohort_group_comparison",
    scopeStatement: SCOPE_STATEMENTS.groupComparison,
    methodBasis: {
      summaryStatistics:
        "Exposure rows are bounded and often zero-inflated; medians and IQRs are reported with means and standard deviations.",
      effectSize:
        "The primary effectSize is rank-biserial correlation. standardizedMeanDifference is retained as a secondary descriptive field.",
      hypothesisTesting:
        "Permutation p-values compare absolute mean differences under label exchangeability. They are optional and have limited resolution in small groups.",
      multipleTesting:
        "Benjamini-Hochberg correction is applied across all signature-by-group comparisons generated in one function call.",
      references: [
        LITERATURE_REFERENCES.medo2024,
        LITERATURE_REFERENCES.wu2023,
      ],
    },
    groupKey,
    minGroupSizeForReliableStats,
    reportingMode:
      warnings.some((warning) => warning.code === WARNING_CODES.GROUP_IMBALANCE)
        ? "restricted_interpretation"
        : "standard_qc_passed",
    groups: groupSummaries,
    referenceGroup,
    comparisonGroups,
    permutationIterations,
    effectSizeMethod: "rank_biserial_correlation",
    multipleTestingCorrection: {
      method: "benjamini_hochberg",
      scope: "all_signature_by_group_comparisons_in_call",
      applied: adjustedComparisons.some((comparison) =>
        Number.isFinite(comparison.pValue)
      ),
    },
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
  const minMatchCosine =
    options.minMatchCosine ?? ADVISOR_DEFAULTS.subgroupDiscovery.minMatchCosine;
  const topN = options.topN ?? ADVISOR_DEFAULTS.subgroupDiscovery.shortlistTopN;
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

function describeShortlistingCriteria(options = {}) {
  return {
    minMatchCosine:
      options.minMatchCosine ?? ADVISOR_DEFAULTS.subgroupDiscovery.minMatchCosine,
    topN: options.topN ?? ADVISOR_DEFAULTS.subgroupDiscovery.shortlistTopN,
    rule:
      "Reference signatures are shortlisted when an extracted subgroup signature has cosine similarity at or above minMatchCosine; if no match crosses the threshold, the best available reference matches are retained up to topN for exploratory refitting.",
    interpretationBoundary:
      "Shortlisting defines a follow-up refitting set and does not identify the biological source of a subgroup signature.",
  };
}

/**
 * Runs subgroup-aware NMF extraction and optional matched-reference refitting.
 *
 * @async
 * @function runSubgroupDiscoveryWorkflow
 * @memberof pipelines
 * @experimental Full subgroup-discovery pipeline outside the manuscript-validated advisor claim set.
 * @param {Object} input - Cohort spectra, optional signatures, and optional subgroups.
 * @param {Object} [options] - Subgroup extraction options.
 * @returns {Promise<Object>} Subgroup extraction/refit summaries and skipped subgroup caveats.
 */
async function runSubgroupDiscoveryWorkflow(input = {}, options = {}) {
  warnExperimentalAdvisorFunction("runSubgroupDiscoveryWorkflow");
  const subgroupOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.subgroupDiscovery,
    options.subgroupDiscovery,
    options.subgroupDiscoveryOptions,
    options
  );
  const spectra = normalizeSpectraInput(input.spectra || input, subgroupOptions);
  const referenceSignatures = normalizeMatrixObject(
    input.referenceSignatures ||
      input.signatures ||
      subgroupOptions.referenceSignatures ||
      {}
  );
  const contexts = getContextList(referenceSignatures, spectra, subgroupOptions);
  const subgroups =
    input.subgroups ||
    clusterSamplesBySimilarity(
      spectra,
      contexts,
      subgroupOptions.clusterCosineThreshold
    );
  const minSubgroupSamples = subgroupOptions.minSubgroupSamples;
  const minMedianBurden = subgroupOptions.minMedianBurden;
  const shortlistingCriteria = describeShortlistingCriteria({
    minMatchCosine: subgroupOptions.minMatchCosine,
    topN: subgroupOptions.shortlistTopN,
  });
  const subgroupExtractionCaveats = [
    "Small subgroup NMF is unstable when sample count and mutation burden are low.",
    "Extracted subgroup signatures require external validation before biological interpretation.",
    "Reference matches and matched refits are exploratory summaries rather than causal labels.",
  ];
  const subgroupResults = [];
  const warnings = [];

  for (const subgroup of subgroups) {
    const subgroupSpectra = subsetMatrixBySamples(spectra, subgroup.samples || []);
    const sampleNames = Object.keys(subgroupSpectra);
    const burden = summarizeMutationBurden(subgroupSpectra, {
      expectedContexts: contexts,
      lowBurdenThreshold: subgroupOptions.lowBurdenThreshold,
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
          minSubgroupSamples,
          minMedianBurden,
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
        subgroupExtractionCaveats,
        refit: null,
      });
      continue;
    }

    const rank =
      subgroupOptions.rank ??
      Math.min(
        subgroupOptions.maxRank,
        Math.max(subgroupOptions.minRank, Math.floor(sampleNames.length / 3))
      );
    const extraction = extractSignaturesNMF(subgroupSpectra, {
      contexts,
      rank,
      maxIterations: subgroupOptions.maxIterations,
      tolerance: subgroupOptions.tolerance,
      nRuns: subgroupOptions.nRuns,
      seed: subgroupOptions.seed + subgroupResults.length * 101,
      signaturePrefix: `${subgroup.clusterId || "cluster"}_NMF`,
    });
    const comparison =
      Object.keys(referenceSignatures).length > 0
        ? compareExtractedToReference(extraction, referenceSignatures, {
            contexts,
            topN: subgroupOptions.topN,
          })
        : null;
    const shortlistedSignatureNames = shortlistReferenceSignatures(comparison, {
      minMatchCosine: subgroupOptions.minMatchCosine,
      topN: subgroupOptions.shortlistTopN,
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
                exposureThreshold: subgroupOptions.refitExposureThreshold,
                exposureType: subgroupOptions.exposureType,
                renormalize: subgroupOptions.renormalize,
              }
            ),
          }
        : null;

    if (refit) {
      refit.reconstructionError = calculateReconstructionError(
        shortlistedSignatures,
        subgroupSpectra,
        refit.exposures,
        { contexts, normalizeMode: subgroupOptions.exposureType }
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
      shortlistingCriteria,
      subgroupExtractionCaveats,
      refit,
      warnings: [],
    });
  }

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "subgroup_discovery",
    workflowRole: "subgroup_discovery_pipeline",
    scopeStatement: SCOPE_STATEMENTS.subgroupPipeline,
    methodBasis: {
      subgroupReadiness:
        "Subgroups are extracted only when sample count and median mutation burden satisfy configurable readiness defaults.",
      minimumSubgroupSize:
        "The default minimum subgroup size is 8 samples, matching the advisor's minimum de novo extraction guard for exploratory cohort analysis.",
      shortlistingCriteria,
      extractionInterpretation:
        "Extracted subgroup signatures are exploratory profiles. Reference matches and matched refits are follow-up summaries, not causal labels.",
      configurableDefaults: {
        minSubgroupSamples,
        minMedianBurden,
        clusterCosineThreshold: subgroupOptions.clusterCosineThreshold,
        shortlistTopN: subgroupOptions.shortlistTopN,
        minMatchCosine: subgroupOptions.minMatchCosine,
      },
      references: [
        LITERATURE_REFERENCES.alexandrov2013,
        LITERATURE_REFERENCES.alexandrov2020,
        LITERATURE_REFERENCES.degasperi2020,
        LITERATURE_REFERENCES.koh2021,
        LITERATURE_REFERENCES.islam2022,
      ],
    },
    primaryInterpretationFields: [
      "subgroups[].status",
      "subgroups[].warnings",
      "subgroups[].comparison",
      "subgroups[].refit.reconstructionError",
    ],
    experimentalStatus: {
      state: "experimental",
      validatedForManuscriptUse: false,
      scopeStatement: SCOPE_STATEMENTS.subgroupPipeline,
    },
    parameters: {
      workflow: "runSubgroupDiscoveryWorkflow",
      minSubgroupSamples,
      minMedianBurden,
      clusterCosineThreshold: subgroupOptions.clusterCosineThreshold,
      shortlistTopN: subgroupOptions.shortlistTopN,
      minMatchCosine: subgroupOptions.minMatchCosine,
      rank: subgroupOptions.rank,
      minRank: subgroupOptions.minRank,
      maxRank: subgroupOptions.maxRank,
      nRuns: subgroupOptions.nRuns,
      seed: subgroupOptions.seed,
    },
    validation: {
      spectra: validateSpectra(spectra, { expectedContexts: contexts }),
    },
    qc: {
      subgroups: subgroupResults.map((subgroup) => ({
        subgroupId: subgroup.subgroupId,
        sampleCount: subgroup.sampleCount,
        medianMutationBurden: subgroup.medianMutationBurden,
        status: subgroup.status,
        warnings: subgroup.warnings,
      })),
    },
    contexts,
    minimumSubgroupSamples: minSubgroupSamples,
    minimumMedianMutationBurden: minMedianBurden,
    shortlistingCriteria,
    subgroupExtractionCaveats,
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
 * @returns {Promise<Object>} Cohort fit, subgroup structure, fit-quality evidence, residuals, and report artifacts.
 */
async function runCohortFit(input = {}, options = {}) {
  const spectra = normalizeSpectraInput(input.spectra || input, options);
  const signatures = normalizeMatrixObject(
    input.signatures || input.referenceSignatures || options.signatures || {}
  );
  const metadata = normalizeMetadataInput(input.metadata || options.metadata);
  const groupKey = input.groupKey || options.groupKey || options.comparisonKey;
  const contexts = getContextList(signatures, spectra, options);
  const burdenOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.cohortFit.mutationBurden,
    options.mutationBurden,
    options.mutationBurdenOptions,
    optionSubset(options, [
      "lowBurdenThreshold",
      "lowBurdenThresholdMode",
      "thresholdMode",
      "quantile",
      "moderateBurdenThreshold",
    ])
  );
  const fitOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.singleSampleFit.fit,
    options.fit,
    options.fitOptions,
    optionSubset(options, [
      "exposureThreshold",
      "exposureType",
      "renormalize",
      "maxIterations",
      "convergenceTolerance",
    ]),
    { contexts }
  );
  const residualOptions = mergeDefinedOptions(
    { normalizeMode: fitOptions.exposureType },
    burdenOptions,
    options.residuals,
    options.residualOptions,
    optionSubset(options, [
      "weakUnexplainedThreshold",
      "highResidualStructureCosineThreshold",
    ]),
    { contexts }
  );
  const thresholdOptions = mergeDefinedOptions(
    { ...ADVISOR_DEFAULTS.singleSampleFit.thresholdSensitivity },
    options.thresholdSensitivity,
    options.thresholdSensitivityOptions,
    optionSubset(options, [
      "thresholds",
      "baselineThreshold",
      "instabilityL1Threshold",
      "activeSetJaccardThreshold",
    ]),
    {
      contexts,
      exposureType: fitOptions.exposureType,
      renormalize: fitOptions.renormalize,
      maxIterations: fitOptions.maxIterations,
      convergenceTolerance: fitOptions.convergenceTolerance,
    }
  );
  const bootstrapOptions = mergeDefinedOptions(
    { ...ADVISOR_DEFAULTS.singleSampleFit.bootstrap },
    options.bootstrap,
    options.bootstrapOptions,
    optionSubset(options, [
      "bootstrapIterations",
      "iterations",
      "confidenceLevel",
      "seed",
      "minIterationsForStableIntervals",
      "publicationRecommendedIterations",
      "minMutationsForBootstrapSummary",
    ]),
    {
      contexts,
      exposureThreshold: fitOptions.exposureThreshold,
      exposureType: fitOptions.exposureType,
      renormalize: fitOptions.renormalize,
      maxIterations: fitOptions.maxIterations,
      convergenceTolerance: fitOptions.convergenceTolerance,
    }
  );
  if (bootstrapOptions.bootstrapIterations !== undefined) {
    bootstrapOptions.iterations = bootstrapOptions.bootstrapIterations;
  }
  const ambiguityOptions = mergeDefinedOptions(
    options.ambiguity,
    options.ambiguityOptions,
    { contexts }
  );
  const catalogOptions = mergeDefinedOptions(
    options.catalogSufficiency,
    options.catalogCheck,
    options.catalogOptions,
    burdenOptions,
    { normalizeMode: fitOptions.exposureType, contexts }
  );
  const fitQualityOptions = mergeDefinedOptions(
    burdenOptions,
    options.fitQualityEvidence,
    options.fitQualityOptions,
    { normalizeMode: fitOptions.exposureType, contexts }
  );
  const cohortOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.cohortFit,
    options.cohort,
    options.cohortOptions,
    options
  );

  if (Object.keys(spectra).length === 0) {
    throw new Error("runCohortFit requires a sample spectra matrix.");
  }
  if (Object.keys(signatures).length === 0) {
    throw new Error("runCohortFit requires reference signatures.");
  }

  const advisor = recommendAnalysisStrategy(spectra, {
    ...options,
    ...burdenOptions,
    expectedContexts: contexts,
  });
  const validation = {
    spectra: validateSpectra(spectra, {
      expectedContexts: contexts,
      minTotalMutations:
        options.validationMinTotalMutations ?? burdenOptions.lowBurdenThreshold,
    }),
    signatures: validateSignatureMatrix(signatures, { expectedContexts: contexts }),
  };
  const exposures = await fitSpectraWithNNLS(signatures, spectra, fitOptions);
  const residuals = calculateFitResiduals(
    signatures,
    spectra,
    exposures,
    residualOptions
  );
  const reconstructionError = calculateReconstructionError(
    signatures,
    spectra,
    exposures,
    residualOptions
  );
  const thresholdSensitivity =
    options.runThresholdSensitivity === false
      ? null
      : await runThresholdSensitivity(signatures, spectra, thresholdOptions);
  const bootstrap = {};
  if (options.runBootstrap) {
    const bootstrapSampleLimit =
      options.bootstrapSampleLimit ?? cohortOptions.bootstrapSampleLimit;
    for (const sampleName of Object.keys(spectra).slice(0, bootstrapSampleLimit)) {
      bootstrap[sampleName] = await bootstrapSignatureFit(
        signatures,
        spectra[sampleName],
        {
          ...bootstrapOptions,
          seed: bootstrapOptions.seed + Object.keys(bootstrap).length,
        }
      );
    }
  }
  const ambiguity = computeSignatureAmbiguity(signatures, ambiguityOptions);
  const catalogCheck = detectOutOfReferenceSignal(
    {
      signatures,
      spectra,
      exposures,
      residuals,
      reconstructionError,
      contexts,
    },
    catalogOptions
  );
  const fitQualityEvidence = computeFitQualityEvidence({
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
  }, fitQualityOptions);
  const subgroups = clusterSamplesBySimilarity(
    spectra,
    contexts,
    cohortOptions.clusterCosineThreshold
  );
  const eligibleSubgroupCount = subgroups.filter(
    (subgroup) => subgroup.sampleCount >= cohortOptions.minSubgroupSamples
  ).length;
  const shouldRunSubgroupDiscovery = options.runSubgroupDiscovery === true;
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
        workflowRole: "subgroup_discovery_pipeline",
        scopeStatement: SCOPE_STATEMENTS.subgroupPipeline,
        methodBasis: {
          subgroupReadiness:
            "Subgroup discovery is gated by cohort heterogeneity, sample count, mutation burden, and explicit experimental-workflow selection.",
          extractionInterpretation:
            "A not-run status means the exploratory extraction step was not executed under the current settings; it is not evidence of absent subgroup processes.",
        },
        status: "not_run",
        reason:
          subgroups.length <= 1
            ? "Cohort similarity graph produced one subgroup."
            : "Subgroup discovery was not requested through the experimental workflow.",
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
                  "The subgroup-screening criterion was met, but experimental subgroup extraction is not run automatically; call mSigSDK.experimental.runSubgroupDiscoveryWorkflow for extraction and matched refitting.",
                  { subgroupCount: subgroups.length }
                ),
              ]
            : [],
        recommendedActions:
          subgroups.length > 1
            ? [
                "Use mSigSDK.experimental.runSubgroupDiscoveryWorkflow for heterogeneous cohorts with sufficiently high mutation burden.",
              ]
            : [],
      };
  const subgroupDiscoveryStatus = shouldRunSubgroupDiscovery
    ? "run"
    : options.runSubgroupDiscovery === false
      ? "not_requested"
      : "skipped";
  const groupComparison =
    groupKey && Object.keys(metadata).length > 0
      ? compareSignatureExposures(exposures, metadata, {
          ...options.comparison,
        groupKey,
        permutationIterations:
            options.permutationIterations ??
            options.comparison?.permutationIterations ??
            0,
          seed: options.seed ?? ADVISOR_DEFAULTS.groupComparison.seed,
        })
      : null;
  const bootstrapAnalyzedSamples = Object.keys(bootstrap);
  const bootstrapScope =
    bootstrapAnalyzedSamples.length === 0
      ? "none"
      : bootstrapAnalyzedSamples.length === Object.keys(spectra).length
        ? "per_sample"
        : "representative_samples";
  const cohortSizeCaveat =
    Object.keys(spectra).length < 20
    ? "Cohorts with fewer than 20 samples should be treated as limited for de novo extraction and subgroup inference; use recommendAnalysisStrategy and mSigSDK.experimental.runSubgroupDiscoveryWorkflow explicitly before interpreting extracted signatures."
      : null;
  const primaryWarnings = deduplicateWarnings([
    ...(advisor.warnings || []),
    ...(fitQualityEvidence.warnings || []),
    ...(catalogCheck.warnings || []),
    ...(thresholdSensitivity?.warnings || []),
    ...(subgroupDiscovery.warnings || []),
    ...(groupComparison?.warnings || []),
    ...Object.values(bootstrap || {}).flatMap((entry) => entry.warnings || []),
  ]);
  const subsystemSummary = [
    summarizeSubsystem("advisor", advisor, advisor.warnings),
    summarizeSubsystem("fitQualityEvidence", fitQualityEvidence, fitQualityEvidence.warnings),
    summarizeSubsystem("catalogCheck", catalogCheck, catalogCheck.warnings),
    summarizeSubsystem("thresholdSensitivity", thresholdSensitivity, thresholdSensitivity?.warnings),
    summarizeSubsystem("subgroupDiscovery", subgroupDiscovery, subgroupDiscovery.warnings),
    summarizeSubsystem("groupComparison", groupComparison, groupComparison?.warnings),
  ];
  const thresholdBootstrapAction =
    bootstrapScope === "none" &&
    (thresholdSensitivity?.warnings || []).some(
      (warning) => warning.code === WARNING_CODES.THRESHOLD_DEPENDENT
    )
      ? "Run bootstrapSignatureFit for representative samples or samples with review cues because threshold sensitivity raised a threshold-dependence cue."
      : null;
  const report = createAnalysisReport(
    {
      title: "mSigSDK Cohort Signature Fit Report",
      summary:
        "Cohort refitting workflow with burden-aware review cues, subgroup structure, residual checks, and fit-quality evidence.",
      workflowRole: "cohort_fit",
      scopeStatement: SCOPE_STATEMENTS.cohortPipeline,
      methodBasis: {
        pipeline:
          "Cohort refitting combines NNLS exposures with burden-aware advice, residual review, reconstruction metrics, fit-quality reporting modes, subgroup structure, optional subgroup extraction, and optional metadata-stratified exposure comparison.",
        validationAnchor: [
          SYNTHETIC_VALIDATION_ANCHORS.burden50,
          SYNTHETIC_VALIDATION_ANCHORS.burden100,
        ],
        references: [
          LITERATURE_REFERENCES.koh2021,
          LITERATURE_REFERENCES.medo2024,
          LITERATURE_REFERENCES.wu2023,
        ],
      },
      primaryInterpretationFields: [
        "fitQualityEvidence.samples[].reportingMode",
        "advisor.cohort.primaryRecommendation",
        "subgroupDiscovery.summary",
        "groupComparison.reportingMode",
      ],
      parameters: {
        workflow: "runCohortFit",
        fitOptions,
        thresholds: advisor.thresholds,
        clusterCosineThreshold: cohortOptions.clusterCosineThreshold,
      },
      validation,
      qc: {
        mutationBurden: advisor.mutationBurden,
        contextCoverage: advisor.contextCoverage,
        reconstructionError,
        fitQualityEvidence: fitQualityEvidence.summary,
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
      citations: [
        LITERATURE_REFERENCES.koh2021,
        LITERATURE_REFERENCES.medo2024,
        LITERATURE_REFERENCES.wu2023,
      ],
      notes: [
        ...advisor.caveats,
        "Cohort-level fitted exposures should be interpreted with sample burden, subgroup structure, catalog ambiguity, threshold sensitivity, and multiplicity-aware group comparisons.",
      ],
    },
    { format: options.reportFormat ?? "object" }
  );

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "cohort_fit",
    workflowRole: "cohort_fit_pipeline",
    scopeStatement: SCOPE_STATEMENTS.cohortPipeline,
    methodBasis: {
      pipeline:
        "Cohort refitting combines NNLS exposures with burden-aware advice, residual review, reconstruction metrics, fit-quality reporting modes, subgroup structure, optional subgroup extraction, and optional metadata-stratified exposure comparison.",
      groupComparison:
        "Metadata-stratified comparisons are exploratory unless group sizes, multiplicity, effect-size interpretation, and cohort design support inference.",
      validationAnchor: [
        SYNTHETIC_VALIDATION_ANCHORS.burden50,
        SYNTHETIC_VALIDATION_ANCHORS.burden100,
      ],
      references: [
        LITERATURE_REFERENCES.koh2021,
        LITERATURE_REFERENCES.medo2024,
        LITERATURE_REFERENCES.wu2023,
      ],
    },
    primaryInterpretationFields: [
      "fitQualityEvidence.samples[].reportingMode",
      "advisor.cohort.primaryRecommendation",
      "subgroupDiscovery.summary",
      "groupComparison.reportingMode",
    ],
    parameters: {
      workflow: "runCohortFit",
      groupKey,
      fitOptions,
      burdenOptions,
      thresholdOptions,
      bootstrapOptions,
      bootstrapScope,
      cohortOptions,
      catalogOptions,
      fitQualityOptions,
    },
    validationAnchor: [
      SYNTHETIC_VALIDATION_ANCHORS.burden50,
      SYNTHETIC_VALIDATION_ANCHORS.burden100,
    ],
    validation,
    qc: {
      mutationBurden: advisor.mutationBurden,
      contextCoverage: advisor.contextCoverage,
      reconstructionError,
      residuals,
      thresholdSensitivity,
      bootstrap,
      fitQualityEvidence: fitQualityEvidence.summary,
      catalogCheck: catalogCheck.summary,
      subgroups,
      subgroupDiscovery: subgroupDiscovery.summary,
      groupComparison:
        groupComparison && {
          groupKey: groupComparison.groupKey,
          groups: groupComparison.groups,
          topSignals: groupComparison.topSignals,
          reportingMode: groupComparison.reportingMode,
        },
    },
    warnings: primaryWarnings,
    primaryWarnings,
    provenance: null,
    subsystemSummary,
    advisor,
    cohort: advisor.cohort,
    subgroupDiscoveryStatus,
    bootstrapScope,
    bootstrapAnalyzedSamples,
    cohortSizeCaveat,
    subgroups,
    subgroupDiscovery,
    groupComparison,
    fit: {
      method: "NNLS",
      solverVariant: "coordinate_descent_nnls",
      exposures,
      parameters: fitOptions,
      reconstructionError,
    },
    fitQualityEvidence,
    ambiguity,
    residuals,
    catalogCheck,
    thresholdSensitivity,
    bootstrap,
    recommendedActions: uniqueStrings([
      ...advisor.recommendedActions,
      ...fitQualityEvidence.recommendedActions,
      ...catalogCheck.recommendedActions,
      ...subgroupDiscovery.recommendedActions,
      ...(groupComparison?.recommendedActions || []),
      cohortSizeCaveat,
      thresholdBootstrapAction,
      "Use mSigSDK.experimental.runSubgroupDiscoveryWorkflow when NMF discovery is the primary analysis rather than a cohort-fit submodule.",
    ]),
    publicationFigures: buildPublicationFigureDescriptors("cohort", {
      cohort_exposure_heatmap: ["fit.exposures", "fitQualityEvidence", "advisor.mutationBurden"],
      sample_similarity: ["cohort.similarity", "subgroups"],
      reconstruction_residuals: ["residuals"],
      fit_quality_evidence_dashboard: ["fitQualityEvidence"],
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
  const discoveryOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.discoveryWorkflow,
    options.discovery,
    options.discoveryOptions,
    options
  );
  const spectra = normalizeSpectraInput(input.spectra || input, discoveryOptions);
  const referenceSignatures = normalizeMatrixObject(
    input.referenceSignatures ||
      input.signatures ||
      discoveryOptions.referenceSignatures ||
      {}
  );
  const contexts = getContextList(referenceSignatures, spectra, discoveryOptions);
  const advisor = recommendAnalysisStrategy(spectra, {
    ...discoveryOptions,
    expectedContexts: contexts,
  });
  const shouldExtract =
    discoveryOptions.forceExtraction || advisor.cohort.canConsiderExtraction;

  if (!shouldExtract) {
    const warnings = [
      makeWarning(
        WARNING_CODES.EXTRACTION_NOT_RECOMMENDED,
        "Discovery was not run because burden, sample count, or heterogeneity did not support stable extraction."
      ),
    ];
    return {
      schemaVersion: RESULT_SCHEMA_VERSION,
      workflow: "discovery_workflow",
      workflowRole: "discovery_pipeline",
      scopeStatement: SCOPE_STATEMENTS.discoveryPipeline,
      methodBasis: {
        extractionReadiness:
          "Discovery is gated by burden, sample count, and cohort structure because unstable extraction can produce misleading profiles.",
        references: [
          LITERATURE_REFERENCES.alexandrov2020,
          LITERATURE_REFERENCES.degasperi2020,
          LITERATURE_REFERENCES.koh2021,
        ],
      },
      primaryInterpretationFields: [
        "advisor.cohort.primaryRecommendation",
        "warnings",
        "recommendedActions",
      ],
      parameters: {
        workflow: "runDiscoveryWorkflow",
        discoveryOptions,
        shouldExtract,
      },
      validation: {
        spectra: validateSpectra(spectra, { expectedContexts: contexts }),
      },
      qc: {
        mutationBurden: advisor.mutationBurden,
        contextCoverage: advisor.contextCoverage,
      },
      rankSelectionCriterion: "not_run",
      rankSelectionRationale:
        "Rank selection is skipped when extraction-readiness gates fail or extraction is not requested.",
      productionHandoffRecommendation:
        "Use SigProfilerExtractor or an equivalent production extraction pipeline for large cohorts, high candidate ranks, or manuscript-grade de novo discovery.",
      advisor,
      fit: null,
      extraction: null,
      comparison: null,
      discovery: {
        rankSelection: null,
        extraction: null,
        comparison: null,
        productionHandoffRecommendation:
          "Use SigProfilerExtractor or an equivalent production extraction pipeline for large cohorts, high candidate ranks, or manuscript-grade de novo discovery.",
      },
      warnings,
      recommendedActions: advisor.recommendedActions,
      publicationFigures: buildPublicationFigureDescriptors("discovery"),
      provenance: null,
    };
  }

  const rankSelection =
    discoveryOptions.rank || discoveryOptions.runRankSelection === false
      ? null
      : selectNMFRank(spectra, {
          contexts,
          ranks: discoveryOptions.ranks,
          maxIterations:
            discoveryOptions.rankSelectionMaxIterations ??
            discoveryOptions.maxIterations,
          tolerance: discoveryOptions.tolerance,
          nRuns: discoveryOptions.rankSelectionRuns ?? discoveryOptions.nRuns,
          rankSelectionCriterion: discoveryOptions.rankSelectionCriterion,
          seed: discoveryOptions.seed,
        });
  const rank =
    discoveryOptions.rank ??
    rankSelection?.recommendedRank ??
    discoveryOptions.defaultRank;
  const extraction = extractSignaturesNMF(spectra, {
    contexts,
    rank,
    maxIterations:
      discoveryOptions.extractionMaxIterations ?? discoveryOptions.maxIterations,
    tolerance: discoveryOptions.tolerance,
    nRuns: discoveryOptions.extractionRuns ?? discoveryOptions.nRuns,
    seed: discoveryOptions.seed,
    signaturePrefix: discoveryOptions.signaturePrefix,
  });
  const comparison =
    Object.keys(referenceSignatures).length > 0
      ? compareExtractedToReference(extraction, referenceSignatures, {
          contexts,
          topN: discoveryOptions.topN,
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
    workflowRole: "discovery_pipeline",
    scopeStatement: SCOPE_STATEMENTS.discoveryPipeline,
    methodBasis: {
      extraction:
        "NMF extraction is run with configurable rank, iteration, tolerance, and run-count settings. Rank selection and reference matching are diagnostics for review.",
      rankSelectionCriterion:
        "When rank selection is enabled, mSigSDK evaluates the requested rank grid and recommends a rank using the configured criterion: reconstruction error, cophenetic correlation, or average silhouette.",
      rankSelectionRationale:
        "NMF rank selection is a contested step; reconstruction error alone is a lightweight browser-side screening criterion and should not replace production stability frameworks.",
      interpretationBoundary:
        "Extracted signatures are cohort-derived patterns and should be matched, refit, and validated before biological interpretation.",
      references: [
        LITERATURE_REFERENCES.alexandrov2013,
        LITERATURE_REFERENCES.alexandrov2020,
        LITERATURE_REFERENCES.degasperi2020,
        LITERATURE_REFERENCES.koh2021,
        LITERATURE_REFERENCES.islam2022,
      ],
    },
    rankSelectionCriterion: rankSelection?.rankSelectionCriterion || "fixed_rank",
    rankSelectionRationale: rankSelection
      ? `Rank selection used ${rankSelection.rankSelectionCriterion} across the tested rank grid. This is a browser-side screening criterion and should be checked against production extraction diagnostics for manuscript-grade discovery.`
      : "Rank selection was not run; extraction used the fixed or default rank recorded in parameters.",
    productionHandoffRecommendation:
      `Use SigProfilerExtractor or an equivalent production extraction pipeline to test rank ${rank} and neighboring ranks across more random starts before making discovery claims.`,
    primaryInterpretationFields: [
      "rankSelection.recommendedRank",
      "extraction.reconstructionError",
      "comparison[].bestMatch",
      "qc.reconstructionError",
    ],
    parameters: {
      workflow: "runDiscoveryWorkflow",
      discoveryOptions,
      rank,
      rankSelectionCriterion: rankSelection
        ? rankSelection.rankSelectionCriterion
        : "fixed_or_default_rank",
    },
    validation: {
      spectra: validateSpectra(spectra, { expectedContexts: contexts }),
    },
    advisor,
    rankSelection,
    fit: null,
    extraction,
    comparison,
    discovery: {
      rankSelection,
      extraction,
      comparison,
      productionHandoffRecommendation:
        `Use SigProfilerExtractor or an equivalent production extraction pipeline to test rank ${rank} and neighboring ranks across more random starts before making discovery claims.`,
    },
    qc: {
      mutationBurden: advisor.mutationBurden,
      contextCoverage: advisor.contextCoverage,
      reconstructionError,
    },
    warnings: deduplicateWarnings([
      ...(advisor.warnings || []),
      ...(rankSelection?.warnings || []),
      ...(extraction?.warnings || []),
    ]),
    recommendedActions: uniqueStrings([
      ...advisor.recommendedActions,
      "Match extracted signatures to reference catalogs and refit per sample with a shortlisted catalog.",
    ]),
    publicationFigures: buildPublicationFigureDescriptors("discovery", {
      nmf_stability: ["rankSelection", "extraction.runMetrics"],
      cohort_exposure_heatmap: ["extraction.exposures"],
    }),
    provenance: null,
  };
}

function normalizeByCallableOpportunities(
  spectra,
  opportunities,
  contexts,
  { referenceOpportunities = null, epsilon = 1e-12 } = {}
) {
  if (!isPlainObject(opportunities)) {
    return {
      spectra,
      applied: false,
      referenceApplied: false,
      inputDefinitions: {
        callableContextOpportunity:
          "Not supplied. Provide per-context callable opportunities derived from the assay territory and genome build to apply restricted-assay normalization.",
        referenceContextOpportunity:
          "Not supplied. Optional per-context reference opportunities define the territory used by the reference spectra or signatures.",
      },
      contextNormalization: {},
    };
  }

  const sampleSpecific = Object.values(opportunities).some(isPlainObject);
  const referenceRecord = isPlainObject(referenceOpportunities)
    ? referenceOpportunities
    : null;
  const normalized = {};
  const contextNormalization = {};

  for (const [sampleName, spectrum] of Object.entries(spectra)) {
    const opportunityRecord = sampleSpecific
      ? opportunities[sampleName] || {}
      : opportunities;
    const normalizationRows = contexts.map((context) => {
      const opportunity = toFiniteNumber(opportunityRecord[context]);
      const referenceOpportunity = toFiniteNumber(referenceRecord?.[context]);
      const opportunityScale =
        referenceOpportunity && referenceOpportunity > 0
          ? opportunity / referenceOpportunity
          : opportunity;
      const count = spectrum[context] || 0;
      const normalizedRate =
        opportunityScale && opportunityScale > 0
          ? count / Math.max(opportunityScale, epsilon)
          : 0;
      return {
        context,
        observedContextCount: count,
        callableContextOpportunity: opportunity ?? null,
        referenceContextOpportunity: referenceOpportunity ?? null,
        opportunityScale: opportunityScale ?? null,
        normalizedRate,
      };
    });
    const rates = normalizationRows.map((row) => row.normalizedRate);
    const totalCount = sum(contexts.map((context) => spectrum[context] || 0));
    const scaledRates = normalizeVector(rates, totalCount);
    normalized[sampleName] = Object.fromEntries(
      contexts.map((context, index) => [context, scaledRates[index]])
    );
    contextNormalization[sampleName] = Object.fromEntries(
      normalizationRows.map((row) => [
        row.context,
        {
          observedContextCount: row.observedContextCount,
          callableContextOpportunity: row.callableContextOpportunity,
          referenceContextOpportunity: row.referenceContextOpportunity,
          opportunityScale: row.opportunityScale,
          normalizedContextCount: scaledRates[contexts.indexOf(row.context)],
        },
      ])
    );
  }

  return {
    spectra: normalized,
    applied: true,
    referenceApplied: Boolean(referenceRecord),
    inputDefinitions: {
      callableContextOpportunity:
        "Number or fraction of trinucleotide sites callable in the restricted assay territory for this context.",
      referenceContextOpportunity:
        "Number or fraction of trinucleotide sites in the reference territory for this context. When supplied, normalization uses callable_context_opportunity / reference_context_opportunity.",
    },
    contextNormalization,
  };
}

function getCallableOpportunityRecord(opportunities, sampleName = null) {
  if (!isPlainObject(opportunities)) {
    return null;
  }
  const values = Object.values(opportunities);
  const sampleSpecific = values.some(isPlainObject);
  if (sampleSpecific) {
    if (isPlainObject(opportunities[sampleName])) {
      return opportunities[sampleName];
    }
    const unionRecord = {};
    for (const record of values) {
      if (!isPlainObject(record)) {
        continue;
      }
      for (const [context, value] of Object.entries(record)) {
        const finiteValue = toFiniteNumber(value);
        if (finiteValue === null) {
          continue;
        }
        unionRecord[context] = Math.max(unionRecord[context] || 0, finiteValue);
      }
    }
    return unionRecord;
  }
  return opportunities;
}

function summarizeCallableOpportunityForSignature(
  signature,
  contexts,
  opportunities,
  sampleName = null
) {
  const opportunityRecord = getCallableOpportunityRecord(opportunities, sampleName);
  const opportunitiesSupplied = isPlainObject(opportunityRecord);
  const weights = contexts.map((context) => ({
    context,
    signatureWeight: Math.max(toFiniteNumber(signature?.[context]) || 0, 0),
    opportunity: opportunitiesSupplied
      ? toFiniteNumber(opportunityRecord[context])
      : null,
  }));
  const totalSignatureMass = sum(weights.map((row) => row.signatureWeight));
  const callableRows = opportunitiesSupplied
    ? weights.filter((row) => row.opportunity > 0)
    : weights;
  const callableSignatureMassRaw = sum(
    callableRows.map((row) => row.signatureWeight)
  );
  const signatureMassInCallableContexts =
    opportunitiesSupplied && totalSignatureMass > 0
      ? callableSignatureMassRaw / totalSignatureMass
      : null;

  return {
    callableOpportunitiesSupplied: opportunitiesSupplied,
    opportunitySource: opportunitiesSupplied
      ? sampleName
        ? "sample_specific_or_shared_callable_opportunities"
        : "shared_or_union_callable_opportunities"
      : "not_supplied",
    callableContextCount: callableRows.length,
    totalContextCount: contexts.length,
    callableContextFraction:
      contexts.length === 0 ? null : callableRows.length / contexts.length,
    signatureMassInCallableContexts,
    signatureMassInCallableContextsDefinition:
      "Fraction of the supplied reference signature profile that falls in contexts with positive callable opportunity. Reported only when callable opportunities are supplied.",
    interpretationBoundary:
      "This assay-territory summary is reported with callable-context evidence.",
  };
}

/**
 * Summarizes transparent restricted-assay evidence components for reference signatures.
 *
 * @function summarizeRestrictedAssayEvidence
 * @memberof advisor
 * @experimental Descriptive restricted-assay evidence helper outside the manuscript-validated advisor claim set.
 * @param {Object<string,Object<string,number>>} signatures - Reference signature matrix.
 * @param {Object} [options] - Restricted-assay evidence options.
 * @returns {Object} Signature-specific burden/exposure grids and callable-territory summaries.
 */
function summarizeRestrictedAssayEvidence(signatures, options = {}) {
  warnExperimentalAdvisorFunction("summarizeRestrictedAssayEvidence");
  const restrictedOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.restrictedAssayEvidence,
    options.restrictedAssayEvidence,
    options.restrictedAssayOptions,
    options
  );
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const contexts = getContextList(normalizedSignatures, null, restrictedOptions);
  const ambiguity = computeSignatureAmbiguity(normalizedSignatures, { contexts });
  const burdens = restrictedOptions.burdens;
  const exposureLevels = restrictedOptions.exposureLevels;
  const opportunityCoverage = restrictedOptions.opportunityCoverage;
  const callableOpportunities =
    restrictedOptions.callableOpportunities || restrictedOptions.opportunities || null;
  const modelType = "descriptive_restricted_assay_evidence";
  const signaturesResult = ambiguity.signatures.map((signature) => {
    const callableEvidence = summarizeCallableOpportunityForSignature(
      normalizedSignatures[signature.signatureName],
      contexts,
      callableOpportunities
    );
    const curves = burdens.flatMap((burden) =>
      exposureLevels.map((exposure) => {
        const expectedSignatureMutations = Math.max(burden, 0) * Math.max(exposure, 0);
        const expectedCallableSignatureMutations =
          callableEvidence.signatureMassInCallableContexts === null
            ? null
            : expectedSignatureMutations *
              callableEvidence.signatureMassInCallableContexts;
        return {
          burden,
          exposure,
          expectedSignatureMutations,
          expectedCallableSignatureMutations,
          callableSignatureMass:
            callableEvidence.signatureMassInCallableContexts,
          evidenceType: "descriptive_expected_mutation_count",
        };
      })
    );
    const noCallableSignatureMass =
      callableEvidence.callableOpportunitiesSupplied &&
      callableEvidence.signatureMassInCallableContexts === 0;

    return {
      signatureName: signature.signatureName,
      confusabilityScore: signature.confusabilityScore,
      confusabilityPercentile: signature.confusabilityPercentile,
      evidenceTags: signature.evidenceTags,
      reviewRecommended: signature.reviewRecommended,
      flatnessScore: signature.flatnessScore,
      nearestNeighbor: signature.nearestNeighbor,
      nearestCosineSimilarity: signature.nearestCosineSimilarity,
      callableEvidence,
      curves,
      warningCodes: uniqueStrings([
        noCallableSignatureMass
          ? WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE
          : null,
        signature.reviewRecommended
          ? WARNING_CODES.SIGNATURE_AMBIGUITY
          : null,
      ]),
    };
  });

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflowRole: "restricted_assay_evidence",
    scopeStatement: SCOPE_STATEMENTS.restrictedAssayEvidence,
    methodBasis: {
      panelEvidence: METHOD_BASIS.panelEvidence,
      modelDefinition:
        "No calibrated detection-probability model is applied. The output reports expected fitted signature mutation counts, callable signature mass when opportunities are supplied, and signature ambiguity descriptors.",
      modelType,
      calibrationStatus:
        "Descriptive only. Use study-specific simulation or a validated external panel-signature model for inferential detection claims.",
      opportunityCoverageDefinition:
        "Fraction of expected mutation contexts with callable opportunity in the restricted assay, or 1 when no opportunity matrix is supplied.",
      references: [
        LITERATURE_REFERENCES.lawrence2021,
        LITERATURE_REFERENCES.medo2024,
        LITERATURE_REFERENCES.huang2018,
        LITERATURE_REFERENCES.alexandrov2020,
      ],
    },
    modelType,
    modelParameters: {
      opportunityCoverage,
    },
    opportunityCoverageDefinition:
      "Fraction of expected mutation contexts with callable opportunity in the restricted assay, or 1 when no opportunity matrix is supplied.",
    contexts,
    burdens,
    exposureLevels,
    opportunityCoverage,
    signatures: signaturesResult,
    warnings: signaturesResult
      .filter((signature) =>
        signature.warningCodes.includes(WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE)
      )
      .map((signature) =>
        makeWarning(
          WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE,
          `${signature.signatureName} did not have positive callable signature mass under the supplied restricted-assay opportunities, so this assay cannot assess it with the current settings.`,
          { signatureName: signature.signatureName }
        )
      ),
  };
}

function lookupRestrictedAssayEvidence(restrictedAssayEvidenceSummary, signatureName, burden, exposure) {
  const signature = restrictedAssayEvidenceSummary?.signatures?.find(
    (entry) => entry.signatureName === signatureName
  );
  if (!signature) {
    return null;
  }

  const expectedSignatureMutations = Math.max(burden, 0) * Math.max(exposure, 0);
  const callableMass =
    signature.callableEvidence?.signatureMassInCallableContexts ?? null;
  return {
    signatureName,
    burden,
    exposure,
    expectedSignatureMutations,
    expectedCallableSignatureMutations:
      callableMass === null ? null : expectedSignatureMutations * callableMass,
    confusabilityScore: signature.confusabilityScore,
    confusabilityPercentile: signature.confusabilityPercentile,
    evidenceTags: signature.evidenceTags,
    reviewRecommended: signature.reviewRecommended,
    nearestNeighbor: signature.nearestNeighbor,
    nearestCosineSimilarity: signature.nearestCosineSimilarity,
    flatnessScore: signature.flatnessScore,
    callableEvidence: signature.callableEvidence,
    interpretationBoundary:
      "Restricted-assay evidence is reported with fitted exposure, burden, and callable-territory evidence.",
  };
}

const PANEL_REVIEW_TIERS = [
  "higher_review_support",
  "limited_review_support",
  "not_detected_within_review_settings",
  "not_assessable",
];

function normalizePanelReviewTier(tier) {
  if (tier === "strong_evidence") {
    return "higher_review_support";
  }
  if (tier === "weak_evidence") {
    return "limited_review_support";
  }
  if (tier === "not_detected") {
    return "not_detected_within_review_settings";
  }
  return tier;
}

function summarizeEvidenceCalls(evidenceCalls) {
  const calls = Object.entries(evidenceCalls || {}).flatMap(([sample, rows]) =>
    (rows || []).map((row) => ({
      sample,
      ...row,
      tier: normalizePanelReviewTier(row.tier),
    }))
  );

  return {
    sampleCount: Object.keys(evidenceCalls || {}).length,
    callCount: calls.length,
    tierCounts: Object.fromEntries(
      PANEL_REVIEW_TIERS.map((tier) => [
        tier,
        calls.filter((call) => call.tier === tier).length,
      ])
    ),
    signatureSummaries: uniqueStrings(calls.map((call) => call.signatureName)).map(
      (signatureName) => {
        const signatureCalls = calls.filter(
          (call) => call.signatureName === signatureName
        );
        const higherReviewSupportCount = signatureCalls.filter(
          (call) => call.tier === "higher_review_support"
        ).length;
        const limitedReviewSupportCount = signatureCalls.filter(
          (call) => call.tier === "limited_review_support"
        ).length;
        return {
          signatureName,
          higherReviewSupportCount,
          limitedReviewSupportCount,
          strongEvidenceCount: higherReviewSupportCount,
          weakEvidenceCount: limitedReviewSupportCount,
          notAssessableCount: signatureCalls.filter(
            (call) => call.tier === "not_assessable"
          ).length,
          maxExposure: Math.max(...signatureCalls.map((call) => call.exposure), 0),
          meanCallableSignatureMass: average(
            signatureCalls
              .map(
                (call) =>
                  call.restrictedAssayEvidence?.callableEvidence
                    ?.signatureMassInCallableContexts
              )
              .filter(Number.isFinite)
          ),
        };
      }
    ),
  };
}

/**
 * Runs a panel/WES-oriented workflow with opportunity normalization and review evidence tiers.
 *
 * @async
 * @function runPanelWorkflow
 * @memberof pipelines
 * @param {Object} input - Panel or WES spectra, signatures, and optional callable opportunities.
 * @param {Object} [options] - Panel workflow options.
 * @returns {Promise<Object>} Fit result plus panel evidence calls and limitations.
 */
async function runPanelWorkflow(input = {}, options = {}) {
  const panelOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.panelWorkflow,
    options.panel,
    options.panelOptions,
    options
  );
  const spectra = normalizeSpectraInput(input.spectra || input, panelOptions);
  const signatures = normalizeMatrixObject(
    input.signatures || input.referenceSignatures || panelOptions.signatures || {}
  );
  const contexts = getContextList(signatures, spectra, panelOptions);
  const callableOpportunities =
    input.callableOpportunities || panelOptions.callableOpportunities;
  const referenceOpportunities =
    input.referenceOpportunities || panelOptions.referenceOpportunities || null;
  const referenceOpportunitySource =
    input.referenceOpportunitySource ||
    panelOptions.referenceOpportunitySource ||
    (referenceOpportunities ? "user_supplied_reference_opportunities" : "not_supplied");
  const opportunityNormalization = normalizeByCallableOpportunities(
    spectra,
    callableOpportunities,
    contexts,
    {
      referenceOpportunities,
      epsilon: panelOptions.opportunityEpsilon,
    }
  );
  const opportunityCoverage =
    panelOptions.opportunityCoverage ??
    (isPlainObject(callableOpportunities)
      ? contexts.filter((context) => {
          const values = Object.values(callableOpportunities);
          const contextValue = isPlainObject(values[0])
            ? values.some((row) => toFiniteNumber(row?.[context]) > 0)
            : toFiniteNumber(callableOpportunities[context]) > 0;
          return contextValue;
        }).length / Math.max(contexts.length, 1)
      : 1);
  const genomeVersion =
    input.genomeVersion ||
    input.genomeBuild ||
    panelOptions.genomeVersion ||
    panelOptions.genomeBuild ||
    null;
  const opportunitySource =
    input.opportunitySource ||
    panelOptions.opportunitySource ||
    (isPlainObject(callableOpportunities) ? "user_supplied" : "not_supplied");
  const opportunitySourceDetails =
    opportunitySource === "user_supplied"
      ? "User-supplied callable opportunity counts or fractions derived outside the SDK from the assay territory and genome build."
      : opportunitySource === "canonical_panel"
        ? "Canonical panel opportunity counts supplied by the workflow configuration."
        : "Callable opportunities were not supplied; full-context coverage is assumed for screening only.";
  const panelWorkflowWarnings = [];
  if (opportunitySource === "not_supplied") {
    panelWorkflowWarnings.push(
      makeWarning(
        WARNING_CODES.PANEL_LIMITED,
        "Callable opportunities were not supplied; full-context coverage was assumed for screening only.",
        { opportunitySource }
      )
    );
  }
  const restrictedAssayEvidenceSummary = summarizeRestrictedAssayEvidence(signatures, {
    contexts,
    burdens: panelOptions.restrictedAssayBurdens,
    exposureLevels: panelOptions.restrictedAssayExposureLevels,
    opportunityCoverage,
    callableOpportunities,
  });
  const result = await runCohortFit(
    {
      spectra: opportunityNormalization.spectra,
      signatures,
    },
    {
      ...options,
      ...panelOptions,
      assay: "panel",
      contexts,
      lowBurdenThreshold: panelOptions.lowBurdenThreshold,
      moderateBurdenThreshold: panelOptions.moderateBurdenThreshold,
    }
  );
  const minAssessableMutations = panelOptions.minAssessableMutations;
  const higherSupportExposureThreshold =
    panelOptions.higherSupportExposureThreshold;
  const limitedSupportExposureThreshold =
    panelOptions.limitedSupportExposureThreshold;
  const resultFitQualityEvidence = result.fitQualityEvidence;
  const fitQualityBySample = Object.fromEntries(
    resultFitQualityEvidence.samples.map((sample) => [sample.sample, sample])
  );
  const burdenBySample = Object.fromEntries(
    result.advisor.mutationBurden.samples.map((sample) => [sample.sample, sample])
  );
  const evidenceCalls = Object.fromEntries(
    Object.entries(result.fit.exposures).map(([sampleName, exposureRow]) => [
      sampleName,
      Object.entries(exposureRow).map(([signatureName, exposure]) => {
        const burden = burdenBySample[sampleName]?.totalMutations || 0;
        const reportingMode =
          fitQualityBySample[sampleName]?.recommendedReportingMode ||
          fitQualityBySample[sampleName]?.reportingMode;
        const restrictedAssayEvidence = lookupRestrictedAssayEvidence(
          restrictedAssayEvidenceSummary,
          signatureName,
          burden,
          exposure
        );
        const callableEvidence = restrictedAssayEvidence?.callableEvidence;
        const noCallableSignatureContexts =
          callableEvidence?.callableOpportunitiesSupplied &&
          callableEvidence.signatureMassInCallableContexts === 0;
        const assessabilityReasons = [
          burden < minAssessableMutations
            ? {
                code: "below_configured_min_assessable_mutations",
                detail: `${burden} mutations < configured minimum ${minAssessableMutations}.`,
              }
            : null,
          noCallableSignatureContexts
            ? {
                code: "no_callable_signature_contexts",
                detail:
                  "Supplied callable opportunities contain no positive-opportunity contexts for this reference signature.",
              }
            : null,
          reportingMode === "not_assessable"
            ? {
                code: "fit_quality_not_assessable",
                detail: "The upstream fit-quality evidence is not assessable.",
              }
            : null,
        ].filter(Boolean);
        const assessable = assessabilityReasons.length === 0;
        const assessabilityClass = assessable
          ? reportingMode === "restricted_interpretation"
            ? "assessable_with_restricted_fit_interpretation"
            : "assessable_under_configured_review_rules"
          : "not_assessable";
        let tier = "not_detected_within_review_settings";
        const warnings = [];

        if (!assessable) {
          tier = "not_assessable";
          warnings.push(
            makeWarning(
              WARNING_CODES.PANEL_SIGNATURE_NOT_ASSESSABLE,
              `${signatureName} is not assessable for ${sampleName} at the observed burden and fitted exposure.`,
              {
                sample: sampleName,
                signatureName,
                burden,
                exposure,
                assessabilityReasons,
              }
            )
          );
        } else if (
          exposure >= higherSupportExposureThreshold &&
          (reportingMode === "standard_qc_passed" ||
            reportingMode === "report_with_caveats")
        ) {
          tier = "higher_review_support";
        } else if (exposure >= limitedSupportExposureThreshold) {
          tier = "limited_review_support";
        }
        return {
          signatureName,
          exposure,
          tier,
          tierLabel: {
            higher_review_support: "Higher review support",
            limited_review_support: "Limited review support",
            not_detected_within_review_settings: "Below review threshold",
            not_assessable: "Not assessable",
          }[tier],
          totalMutations: burden,
          fitQualityReportingMode: reportingMode,
          reportingMode,
          restrictedAssayEvidence,
          assessabilityClass,
          assessabilityReasons,
          assessable,
          warnings,
        };
      }),
    ])
  );
  const evidenceSummary = summarizeEvidenceCalls(evidenceCalls);
  const panelReport = createAnalysisReport(
    {
      title: "mSigSDK Panel/WES Signature Review Evidence Report",
      summary:
        "Panel/WES-oriented workflow with opportunity normalization, transparent restricted-assay evidence, review tiers, reporting modes, and explicit limitations.",
      workflowRole: "panel_workflow",
      scopeStatement: SCOPE_STATEMENTS.panel,
      methodBasis: {
        panelEvidence: METHOD_BASIS.panelEvidence,
        opportunityNormalization:
          "When callable opportunities are supplied, mutation counts are rescaled by assay-specific trinucleotide opportunity relative to the selected reference opportunity set. The SDK applies the supplied opportunities; it does not infer assay-territory opportunity counts.",
        opportunityNormalizationFormula:
          "normalized_context_count = observed_context_count / max(callable_context_opportunity / reference_context_opportunity, epsilon) when reference opportunities are supplied; otherwise observed_context_count / max(callable_context_opportunity, epsilon). The normalized context vector is rescaled to the observed mutation total.",
        tierRuleDefinitions: PANEL_TIER_RULE_DEFINITIONS,
        references: [
          LITERATURE_REFERENCES.alexandrov2020,
          LITERATURE_REFERENCES.lawrence2021,
          LITERATURE_REFERENCES.koh2021,
        ],
      },
      primaryInterpretationFields: [
        "evidenceCalls[sample][].tier",
        "evidenceCalls[sample][].assessabilityClass",
        "restrictedAssayEvidenceSummary.signatures[].callableEvidence",
        "restrictedAssayEvidenceSummary.signatures[].curves",
        "opportunityMetadata",
      ],
      parameters: {
        workflow: "runPanelWorkflow",
        minAssessableMutations,
        higherSupportExposureThreshold,
        limitedSupportExposureThreshold,
        opportunityCoverage,
        genomeVersion,
        opportunitySource,
        opportunitySourceDetails,
        referenceOpportunitySource,
        opportunityEpsilon: panelOptions.opportunityEpsilon,
      },
      validation: result.validation,
      qc: {
        mutationBurden: result.advisor.mutationBurden,
        reconstructionError: result.fit.reconstructionError,
        fitQualityEvidence: resultFitQualityEvidence.summary,
        restrictedAssayEvidence: {
          modelType: restrictedAssayEvidenceSummary.modelType,
          calibrationStatus: restrictedAssayEvidenceSummary.methodBasis.calibrationStatus,
          opportunityCoverage: restrictedAssayEvidenceSummary.opportunityCoverage,
        },
        evidenceSummary,
        panelWorkflowWarnings,
      },
      exposures: result.fit.exposures,
      notes: [
        "Panel and WES outputs are best interpreted as transparent review evidence rather than full decompositions or calibrated detection probabilities.",
        ...panelWorkflowWarnings.map((warning) => warning.message),
        ...restrictedAssayEvidenceSummary.warnings.map((warning) => warning.message),
      ],
    },
    { format: panelOptions.reportFormat ?? "object" }
  );

  return {
    ...result,
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "panel_workflow",
    workflowRole: "panel_wes_review_pipeline",
    scopeStatement: SCOPE_STATEMENTS.panel,
    methodBasis: {
      panelEvidence: METHOD_BASIS.panelEvidence,
      opportunityNormalization:
        "When callable opportunities are supplied, mutation counts are rescaled by assay-specific trinucleotide opportunity relative to the selected reference opportunity set. The SDK applies the supplied opportunities; it does not infer assay-territory opportunity counts.",
      opportunityNormalizationFormula:
        "normalized_context_count = observed_context_count / max(callable_context_opportunity / reference_context_opportunity, epsilon) when reference opportunities are supplied; otherwise observed_context_count / max(callable_context_opportunity, epsilon). The normalized context vector is rescaled to the observed mutation total.",
      tierAssignment:
        "Evidence tiers combine mutation burden, fit reporting mode, exposure thresholds, and callable-territory checks. They are configured review tiers rather than absence-or-presence calls.",
      tierRuleDefinitions: PANEL_TIER_RULE_DEFINITIONS,
      configurableDefaults: {
        minAssessableMutations,
        higherSupportExposureThreshold,
        limitedSupportExposureThreshold,
        opportunityEpsilon: panelOptions.opportunityEpsilon,
      },
      references: [
        LITERATURE_REFERENCES.alexandrov2020,
        LITERATURE_REFERENCES.lawrence2021,
        LITERATURE_REFERENCES.koh2021,
      ],
    },
    primaryInterpretationFields: [
      "evidenceCalls[sample][].tier",
      "evidenceCalls[sample][].assessabilityClass",
      "restrictedAssayEvidenceSummary.signatures[].callableEvidence",
      "restrictedAssayEvidenceSummary.signatures[].curves",
      "opportunityMetadata",
    ],
    parameters: {
      workflow: "runPanelWorkflow",
      panelOptions,
      minAssessableMutations,
      higherSupportExposureThreshold,
      limitedSupportExposureThreshold,
      opportunityCoverage,
      genomeVersion,
      opportunitySource,
      referenceOpportunitySource,
    },
    qc: {
      ...(result.qc || {}),
      restrictedAssayEvidence: {
        modelType: restrictedAssayEvidenceSummary.modelType,
        calibrationStatus:
          restrictedAssayEvidenceSummary.methodBasis.calibrationStatus,
        opportunityCoverage: restrictedAssayEvidenceSummary.opportunityCoverage,
      },
      evidenceSummary,
      panelWorkflowWarnings,
    },
    opportunityNormalization,
    opportunityMetadata: {
      genomeVersion,
      opportunitySource,
      opportunitySourceDetails,
      referenceOpportunitySource,
      referenceOpportunityApplied: opportunityNormalization.referenceApplied,
      opportunityCoverage,
      opportunityCoverageDefinition:
        "Fraction of expected mutation contexts with callable opportunity in the restricted assay, or 1 when no opportunity matrix is supplied.",
    },
    restrictedAssayEvidenceSummary,
    tierRules: PANEL_TIER_RULE_DEFINITIONS,
    tierRuleDefinitions: PANEL_TIER_RULE_DEFINITIONS,
    evidenceCalls,
    evidenceSummary,
    panel: {
      opportunityNormalization,
      opportunityMetadata: {
        genomeVersion,
        opportunitySource,
        opportunitySourceDetails,
        referenceOpportunitySource,
        referenceOpportunityApplied: opportunityNormalization.referenceApplied,
        opportunityCoverage,
      },
      restrictedAssayEvidenceSummary,
      evidenceCalls,
      evidenceSummary,
      tierRules: PANEL_TIER_RULE_DEFINITIONS,
      limitations: [
        "Panel and WES analyses are territory-restricted and are best reported as transparent review evidence rather than full fine-grained decompositions.",
        "mSigSDK does not estimate calibrated panel/WES detection probabilities; use study-specific simulation or a validated external model for inferential detection claims.",
      ],
    },
    warnings: deduplicateWarnings([
      ...(result.warnings || []),
      ...panelWorkflowWarnings,
      ...(restrictedAssayEvidenceSummary.warnings || []),
    ]),
    limitations: [
      "Panel and WES analyses are territory-restricted and are best reported as transparent review evidence rather than full fine-grained decompositions.",
      "mSigSDK does not estimate calibrated panel/WES detection probabilities; use study-specific simulation or a validated external model for inferential detection claims.",
    ],
    report: panelReport,
    recommendedActions: uniqueStrings([
      ...result.recommendedActions,
      "Inspect review tiers together with callable-territory evidence, fitted exposure, burden, and fit-quality warnings for panel/WES interpretation.",
      ...panelWorkflowWarnings.map((warning) => warning.resolution),
      ...restrictedAssayEvidenceSummary.warnings.map((warning) => warning.message),
    ]),
    publicationFigures: buildPublicationFigureDescriptors("panel", {
      cohort_exposure_heatmap: ["fit.exposures", "evidenceCalls", "fitQualityEvidence"],
      panel_evidence: ["evidenceCalls", "restrictedAssayEvidenceSummary"],
      fit_quality_evidence_dashboard: ["fitQualityEvidence"],
    }),
  };
}

/**
 * Runs the beginner-facing single-sample refit path with a small option set.
 *
 * @async
 * @function runSingleSampleFitLite
 * @memberof pipelines
 * @param {Object} input - Spectrum and reference signatures.
 * @param {Object} [options] - Minimal options: contexts, sampleName, exposureThreshold, bootstrapIterations, genomeBuild, reportFormat.
 * @returns {Promise<Object>} Standard pipeline result frame.
 */
async function runSingleSampleFitLite(input = {}, options = {}) {
  return await runSingleSampleFit(
    input,
    mergeDefinedOptions(
      {
        runThresholdSensitivity: true,
        runBootstrap: true,
        bootstrapIterations: 100,
        exposureThreshold: 0.01,
        reportFormat: "object",
      },
      liteOptions(options, [
        "exposureThreshold",
        "bootstrapIterations",
        "lowBurdenThreshold",
      ])
    )
  );
}

/**
 * Runs the beginner-facing cohort refit path with experimental subgroup discovery disabled.
 *
 * @async
 * @function runCohortFitLite
 * @memberof pipelines
 * @param {Object} input - Cohort spectra, signatures, and optional metadata.
 * @param {Object} [options] - Minimal options: contexts, exposureThreshold, lowBurdenThreshold, metadata, groupKey, reportFormat.
 * @returns {Promise<Object>} Standard pipeline result frame.
 */
async function runCohortFitLite(input = {}, options = {}) {
  return await runCohortFit(
    input,
    mergeDefinedOptions(
      {
        runSubgroupDiscovery: false,
        runBootstrap: false,
        runThresholdSensitivity: true,
        exposureThreshold: 0.01,
        reportFormat: "object",
      },
      liteOptions(options, [
        "exposureThreshold",
        "lowBurdenThreshold",
        "metadata",
        "groupKey",
        "comparisonKey",
      ])
    )
  );
}

/**
 * Runs the beginner-facing panel/WES review path with stable defaults.
 *
 * @async
 * @function runPanelWorkflowLite
 * @memberof pipelines
 * @param {Object} input - Restricted-assay spectra, signatures, and optional callable opportunities.
 * @param {Object} [options] - Minimal options: contexts, genomeBuild, callableOpportunities, referenceOpportunities, reportFormat.
 * @returns {Promise<Object>} Standard panel workflow result frame.
 */
async function runPanelWorkflowLite(input = {}, options = {}) {
  return await runPanelWorkflow(
    input,
    mergeDefinedOptions(
      {
        runSubgroupDiscovery: false,
        runBootstrap: false,
        runThresholdSensitivity: true,
        reportFormat: "object",
      },
      liteOptions(options, [
        "callableOpportunities",
        "referenceOpportunities",
        "opportunitySource",
        "referenceOpportunitySource",
        "minAssessableMutations",
        "higherSupportExposureThreshold",
        "limitedSupportExposureThreshold",
      ])
    )
  );
}

/**
 * Runs the beginner-facing discovery path with a fixed rank unless rank selection is requested.
 *
 * @function runDiscoveryWorkflowLite
 * @memberof pipelines
 * @param {Object} input - Cohort spectra and optional reference signatures.
 * @param {Object} [options] - Minimal options: contexts, rank, ranks, runRankSelection, reportFormat.
 * @returns {Object} Standard discovery workflow result frame.
 */
function runDiscoveryWorkflowLite(input = {}, options = {}) {
  return runDiscoveryWorkflow(
    input,
    mergeDefinedOptions(
      {
        rank: 5,
        runRankSelection: false,
        forceExtraction: true,
        nRuns: 10,
        maxIterations: 500,
      },
      liteOptions(options, ["rank", "ranks", "runRankSelection", "topN"])
    )
  );
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

function isApobecLikeContext(context) {
  if (!context) {
    return false;
  }
  const normalized = String(context).toUpperCase().replace(/\s+/g, "");
  return /^T\[C>[GT]\][AT]$/.test(normalized);
}

function buildChromosomeMutationStats(rainfall) {
  const grouped = {};
  for (const variant of rainfall) {
    if (!variant.chromosome || !Number.isFinite(variant.position)) {
      continue;
    }
    if (!grouped[variant.chromosome]) {
      grouped[variant.chromosome] = {
        chromosome: variant.chromosome,
        mutationCount: 0,
        minPosition: variant.position,
        maxPosition: variant.position,
      };
    }
    const stats = grouped[variant.chromosome];
    stats.mutationCount += 1;
    stats.minPosition = Math.min(stats.minPosition, variant.position);
    stats.maxPosition = Math.max(stats.maxPosition, variant.position);
  }
  return Object.fromEntries(
    Object.entries(grouped).map(([chromosome, stats]) => {
      const observedSpan = Math.max(stats.maxPosition - stats.minPosition + 1, 1);
      return [
        chromosome,
        {
          ...stats,
          observedSpan,
          backgroundRatePerBase: stats.mutationCount / observedSpan,
        },
      ];
    })
  );
}

function buildGenomeMutationStats(rainfall, callableGenomeSize) {
  const positions = rainfall
    .map((variant) => variant.position)
    .filter((position) => Number.isFinite(position));
  if (positions.length === 0) {
    return null;
  }
  const minPosition = Math.min(...positions);
  const maxPosition = Math.max(...positions);
  const observedSpan = Math.max(callableGenomeSize || maxPosition - minPosition + 1, 1);
  return {
    mutationCount: positions.length,
    minPosition,
    maxPosition,
    observedSpan,
    backgroundRatePerBase: positions.length / observedSpan,
  };
}

function poissonUpperTail(k, lambda) {
  if (!Number.isFinite(k) || k <= 0 || !Number.isFinite(lambda) || lambda < 0) {
    return null;
  }
  if (lambda === 0) {
    return 0;
  }
  let probability = Math.exp(-lambda);
  let cumulative = probability;
  for (let count = 1; count < k; count += 1) {
    probability *= lambda / count;
    cumulative += probability;
    if (!Number.isFinite(cumulative)) {
      return null;
    }
  }
  return clamp(1 - cumulative, 0, 1);
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
  const apobecLikeCount = contexts.filter(isApobecLikeContext).length;
  const apobecLikeFraction =
    contexts.length === 0 ? 0 : apobecLikeCount / contexts.length;
  const start = current[0].position;
  const end = current[current.length - 1].position;
  const regionSpan = Math.max(end - start + 1, 1);
  const backgroundStats = options.genomeBackgroundStats || null;
  const expectedMutations =
    backgroundStats && Number.isFinite(backgroundStats.backgroundRatePerBase)
      ? backgroundStats.backgroundRatePerBase * regionSpan
      : null;
  const clusterPValue =
    expectedMutations === null
      ? null
      : poissonUpperTail(current.length, expectedMutations);
  const contextPattern =
    apobecLikeFraction >= options.apobecLikeFractionThreshold
      ? "APOBEC-context-enriched localized cluster"
      : "localized mutation cluster";

  foci.push({
    focusId: `focus_${foci.length + 1}`,
    chromosome: current[0].chromosome,
    start,
    end,
    regionSpan,
    mutationCount: current.length,
    medianIntermutationDistance: quantile(distances, 0.5),
    clusterPValue,
    clusterSignificant:
      clusterPValue !== null && clusterPValue <= options.clusterSignificanceThreshold,
    clusterSignificanceThreshold: options.clusterSignificanceThreshold,
    callableGenomeSize: backgroundStats?.observedSpan || null,
    expectedMutationsUnderPoisson: expectedMutations,
    expectedMutationsUnderGenomeWidePoisson: expectedMutations,
    significanceModel:
      "Poisson upper-tail test using the genome-wide per-sample mutation rate estimated as total input variants divided by callableGenomeSize.",
    nullModelSpecification: options.nullModelSpecification,
    contextPattern,
    associatedPattern: contextPattern,
    contextPatternDefinition:
      LOCALIZED_CONTEXT_PATTERN_DEFINITIONS[contextPattern] ||
      LOCALIZED_CONTEXT_PATTERN_DEFINITIONS["localized mutation cluster"],
    contextPatternInterpretation:
      "Context-pattern labels are descriptive and hypothesis-generating; they are not etiology assignments.",
    apobecLikeFraction,
    apobecLikeDefinition:
      "Fraction of mutations with standardized pyrimidine-context labels T[C>G]A, T[C>G]T, T[C>T]A, or T[C>T]T among variants with available context labels.",
    variantIds: current.map((variant) => variant.id),
  });
}

/**
 * Detects localized mutagenesis candidates and prepares rainfall-plot data.
 *
 * @function runLocalizedMutagenesisAnalysis
 * @memberof pipelines
 * @experimental Localized-mutagenesis pipeline outside the manuscript-validated advisor claim set.
 * @param {Object[]|Object} variants - Variant rows or an object with a variants field.
 * @param {string} genomeBuild - Genome build label.
 * @param {Object} [options] - Localized mutagenesis options.
 * @returns {Object} Rainfall data, focal regions, warnings, and publication artifacts.
 */
function runLocalizedMutagenesisAnalysis(variants, genomeBuild, options = {}) {
  warnExperimentalAdvisorFunction("runLocalizedMutagenesisAnalysis");
  const localizedOptions = mergeDefinedOptions(
    ADVISOR_DEFAULTS.localizedMutagenesis,
    options.localized,
    options.localizedOptions,
    options
  );
  const normalizedVariants = normalizeVariantRows(variants);
  const maxIntermutationDistance = localizedOptions.maxIntermutationDistance;
  const minMutations = localizedOptions.minMutations;
  const minBurdenForLocalizedAnalysis =
    localizedOptions.minBurdenForLocalizedAnalysis;
  const apobecLikeFractionThreshold =
    localizedOptions.apobecLikeFractionThreshold;
  const clusterSignificanceThreshold =
    localizedOptions.clusterSignificanceThreshold;
  const callableGenomeSize = localizedOptions.callableGenomeSize;
  const nullModelSpecification =
    localizedOptions.nullModelSpecification;
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
  const chromosomeStats = buildChromosomeMutationStats(rainfall);
  const genomeBackgroundStats = buildGenomeMutationStats(rainfall, callableGenomeSize);
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
      finalizeFocus(current, foci, {
        minMutations,
        chromosomeStats,
        genomeBackgroundStats,
        apobecLikeFractionThreshold,
        clusterSignificanceThreshold,
        nullModelSpecification,
      });
      current = [variant];
    }
  }
  finalizeFocus(current, foci, {
    minMutations,
    chromosomeStats,
    genomeBackgroundStats,
    apobecLikeFractionThreshold,
    clusterSignificanceThreshold,
    nullModelSpecification,
  });

  const totalMutations = normalizedVariants.length;
  const analysisEligible = totalMutations >= minBurdenForLocalizedAnalysis;
  const warnings = [];
  if (!analysisEligible) {
    warnings.push(
      makeWarning(
        WARNING_CODES.LOW_BURDEN,
        `Localized mutagenesis screening is below the configured minimum burden of ${minBurdenForLocalizedAnalysis} variants.`,
        { totalMutations, minBurdenForLocalizedAnalysis }
      )
    );
  }
  if (foci.length > 0) {
      warnings.push(
        makeWarning(
          WARNING_CODES.REGIONAL_PROCESS_SUSPECTED,
        "One or more focal mutation clusters met the configured screening criteria; compare focal spectra with the genomic background before interpretation.",
        { focusCount: foci.length }
      )
    );
  }

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    workflow: "localized_mutagenesis",
    workflowRole: "localized_mutagenesis_pipeline",
    scopeStatement: SCOPE_STATEMENTS.localized,
    experimentalStatus: {
      state: "experimental",
      validatedForManuscriptUse: false,
      scopeStatement: SCOPE_STATEMENTS.localized,
    },
    methodBasis: {
      localizedClustering:
        "Clusters are descriptive runs of nearby same-chromosome variants under a configurable maximum intermutation-distance rule.",
      contextPattern:
        "APOBEC-context enrichment is reported as a context pattern, not as a causal etiology assignment.",
      significanceModel:
        nullModelSpecification,
      nullModelSpecification,
      contextPatternDefinitionVersion: LOCALIZED_CONTEXT_PATTERN_DEFINITIONS.version,
      contextPatternDefinition: LOCALIZED_CONTEXT_PATTERN_DEFINITIONS,
      references: [
        LITERATURE_REFERENCES.roberts2013,
        LITERATURE_REFERENCES.alexandrov2020,
        LITERATURE_REFERENCES.petljak2022,
      ],
    },
    primaryInterpretationFields: [
      "analysisEligibility",
      "foci[].contextPattern",
      "foci[].clusterPValue",
      "warnings",
    ],
    genomeBuild,
    parameters: {
      maxIntermutationDistance,
      minMutations,
      minBurdenForLocalizedAnalysis,
      apobecLikeFractionThreshold,
      clusterSignificanceThreshold,
      callableGenomeSize,
      nullModelSpecification,
      clusterAlgorithm:
        "Sequential distance-threshold run: sorted variants are assigned to the same focus when consecutive variants are on the same chromosome and separated by no more than maxIntermutationDistance.",
    },
    validation: {
      variants: {
        valid: rainfall.length > 0,
        variantCount: rainfall.length,
        requiredFields: ["chromosome", "position"],
      },
    },
    qc: {
      chromosomeStats,
      focusCount: foci.length,
      analysisEligibility: {
        totalMutations,
        minBurdenForLocalizedAnalysis,
        analysisEligible,
      },
    },
    analysisEligibility: {
      totalMutations,
      minBurdenForLocalizedAnalysis,
      analysisEligible,
    },
    genomeBackgroundStats,
    chromosomeStats,
    rainfall,
    foci,
    nullModelSpecification,
    clusterSignificanceThreshold,
    focalSpectra: null,
    flankComparison: null,
    genomeTracks: {
      suggestedTrackType: "rainfall",
      fields: ["chromosome", "position", "previousDistance", "focusId"],
    },
    contextPatterns: uniqueStrings(foci.map((focus) => focus.contextPattern)),
    associatedPatterns: uniqueStrings(foci.map((focus) => focus.associatedPattern)),
    contextPatternDefinition: LOCALIZED_CONTEXT_PATTERN_DEFINITIONS,
    localized: {
      analysisEligibility: {
        totalMutations,
        minBurdenForLocalizedAnalysis,
        analysisEligible,
      },
      foci,
      rainfall,
      contextPatterns: uniqueStrings(foci.map((focus) => focus.contextPattern)),
      nullModelSpecification,
    },
    warnings,
    recommendedActions: uniqueStrings([
      foci.length > 0
        ? "Generate a rainfall plot, extract focal spectra, and compare foci against matched genomic background."
        : "No focal clusters met the configured screening criteria.",
    ]),
    publicationFigures: buildPublicationFigureDescriptors("localized", {
      rainfall: ["rainfall", "foci"],
    }),
    provenance: null,
  };
}

export {
  ADVISOR_DEFAULTS,
  WARNING_CODES,
  compareSignatureExposures,
  computeFitQualityEvidence,
  computeSignatureAmbiguity,
  computeSignatureIdentifiability,
  detectOutOfReferenceSignal,
  recommendAnalysisStrategy,
  runCohortFit,
  runCohortFitLite,
  runDiscoveryWorkflow,
  runDiscoveryWorkflowLite,
  runLocalizedMutagenesisAnalysis,
  runPanelWorkflow,
  runPanelWorkflowLite,
  runSingleSampleFit,
  runSingleSampleFitLite,
  runSubgroupDiscoveryWorkflow,
  summarizeRestrictedAssayEvidence,
};
