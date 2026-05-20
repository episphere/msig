import {
  computeFitQualityEvidence,
  computeSignatureAmbiguity,
  recommendAnalysisStrategy,
  runCohortFit,
  runCohortFitLite,
  runDiscoveryWorkflowLite,
  runPanelWorkflow,
  runPanelWorkflowLite,
  runSingleSampleFit,
  runSingleSampleFitLite,
} from "../mSigSDKScripts/guidance.js";
import { getExpectedContexts } from "../mSigSDKScripts/validation.js";

const contexts = getExpectedContexts({ profile: "SBS", matrix: 96 });

function emptyVector() {
  return Object.fromEntries(contexts.map((context) => [context, 0]));
}

const signatures = {
  SBS_A: {
    ...emptyVector(),
    [contexts[0]]: 0.6,
    [contexts[1]]: 0.4,
  },
  SBS_B: {
    ...emptyVector(),
    [contexts[10]]: 0.7,
    [contexts[11]]: 0.3,
  },
  SBS_flat: Object.fromEntries(contexts.map((context) => [context, 1 / contexts.length])),
};

const spectra = {
  sample_1: {
    ...emptyVector(),
    [contexts[0]]: 90,
    [contexts[1]]: 60,
    [contexts[10]]: 35,
    [contexts[11]]: 15,
  },
  sample_2: {
    ...emptyVector(),
    [contexts[0]]: 300,
    [contexts[1]]: 210,
    [contexts[10]]: 140,
    [contexts[11]]: 60,
  },
};
const subgroupSpectra = Object.fromEntries(
  Array.from({ length: 5 }, (_, index) => [
    `cluster_sample_${index + 1}`,
    {
      ...emptyVector(),
      [contexts[0]]: 250 + index * 15,
      [contexts[1]]: 160 + index * 10,
      [contexts[10]]: 120 + index * 7,
      [contexts[11]]: 70 + index * 5,
    },
  ])
);
const metadata = {
  sample_1: { status: "A" },
  sample_2: { status: "B" },
};

const advisor = recommendAnalysisStrategy(spectra, { expectedContexts: contexts });
const ambiguity = computeSignatureAmbiguity(signatures, { contexts });
const manualPolicyInput = {
  signatures,
  spectra,
  exposures: {
    sample_1: { SBS_A: 1 },
    sample_2: { SBS_A: 1 },
  },
  burdenSummary: {
    samples: [
      { sample: "sample_1", totalMutations: 1000 },
      { sample: "sample_2", totalMutations: 1000 },
    ],
  },
  reconstructionError: {
    samples: [
      { sample: "sample_1", cosineSimilarity: 0.97, rmse: 0.01 },
      { sample: "sample_2", cosineSimilarity: 0.97, rmse: 0.01 },
    ],
  },
  residuals: {
    samples: [
      {
        sample: "sample_1",
        normalizationMode: "relative",
        metrics: { l1Error: 0.24, relativeUnexplainedFraction: 0.12 },
        residualStructure: {
          nearestResidualMatch: { signatureName: "SBS_B", cosineSimilarity: 0.4 },
        },
      },
      {
        sample: "sample_2",
        normalizationMode: "relative",
        metrics: { l1Error: 0.24, relativeUnexplainedFraction: 0.12 },
        residualStructure: {
          nearestResidualMatch: { signatureName: "SBS_B", cosineSimilarity: 0.9 },
        },
      },
    ],
  },
  catalogCheck: {
    samples: [
      { sample: "sample_1", status: "catalog_sufficient_for_fit", warnings: [] },
      { sample: "sample_2", status: "catalog_sufficient_for_fit", warnings: [] },
    ],
  },
};
const manualPolicyOptions = {
  enabled: true,
  source: "smoke",
  thresholds: {
    lowBurdenThreshold: 100,
    reconstructionCosineThreshold: 0.9,
    residualUnexplainedThreshold: 0.1,
    residualStructureCosineThreshold: 0.85,
    minBurdenForResidualStructure: 100,
  },
};
const manualPolicyEvidence = computeFitQualityEvidence(manualPolicyInput, {
  manualPolicy: manualPolicyOptions,
});
const relaxedManualPolicyEvidence = computeFitQualityEvidence(manualPolicyInput, {
  manualPolicy: {
    ...manualPolicyOptions,
    thresholds: {
      ...manualPolicyOptions.thresholds,
      residualUnexplainedThreshold: 0.2,
    },
  },
});
const legacyManualPolicyEvidence = computeFitQualityEvidence(manualPolicyInput);
const single = await runSingleSampleFit(
  {
    sampleName: "sample_1",
    spectrum: spectra.sample_1,
    signatures,
  },
  {
    expectedContexts: contexts,
    runBootstrap: false,
    runThresholdSensitivity: false,
  }
);
const singleLite = await runSingleSampleFitLite(
  {
    sampleName: "sample_1",
    spectrum: spectra.sample_1,
    signatures,
  },
  { expectedContexts: contexts }
);
const cohort = await runCohortFit(
  { spectra, signatures, metadata },
  {
    expectedContexts: contexts,
    groupKey: "status",
    comparison: { minGroupSize: 1, permutationIterations: 9 },
    runBootstrap: false,
    runThresholdSensitivity: false,
  }
);
const cohortLite = await runCohortFitLite(
  { spectra, signatures, metadata },
  { expectedContexts: contexts }
);
const panel = await runPanelWorkflow(
  { spectra, signatures },
  {
    expectedContexts: contexts,
    runBootstrap: false,
    runThresholdSensitivity: false,
  }
);
const panelLite = await runPanelWorkflowLite(
  { spectra, signatures },
  { expectedContexts: contexts }
);
const discoveryLite = runDiscoveryWorkflowLite(
  { spectra: subgroupSpectra, referenceSignatures: signatures },
  {
    expectedContexts: contexts,
    rank: 2,
    nRuns: 2,
    maxIterations: 50,
  }
);
if (advisor.samples.length !== 2) {
  throw new Error("Advisor did not summarize both samples.");
}
if (ambiguity.catalogSummary.signatureCount !== 3) {
  throw new Error("Ambiguity summary did not include all signatures.");
}
if (legacyManualPolicyEvidence.samples.some((sample) => sample.manualPolicy)) {
  throw new Error("Manual policy fields should be absent unless manualPolicy.enabled is true.");
}
if (manualPolicyEvidence.samples[0].manualPolicy?.status !== "review") {
  throw new Error("High unexplained but unstructured residual should be a manual-policy review cue.");
}
if (manualPolicyEvidence.samples[1].manualPolicy?.status !== "priority") {
  throw new Error("Structured residual should be a manual-policy priority cue.");
}
if (
  relaxedManualPolicyEvidence.samples[1].manualPolicy?.status !== "pass" ||
  relaxedManualPolicyEvidence.samples[1].reportingMode !== manualPolicyEvidence.samples[1].reportingMode
) {
  throw new Error("Manual policy thresholds should change manualPolicy without changing legacy reporting mode.");
}
if (
  manualPolicyEvidence.manualPolicy.priorityCount !== 1 ||
  manualPolicyEvidence.manualPolicy.reviewCount !== 1
) {
  throw new Error("Manual policy summary counts did not match sample policy results.");
}
if (!single.fitQualityEvidence.samples[0]?.reportingMode) {
  throw new Error("Single-sample workflow did not return a fit-quality reporting mode.");
}
if (
  singleLite.parameters?.workflow !== "runSingleSampleFit" ||
  !singleLite.qc?.mutationBurden ||
  !Array.isArray(singleLite.warnings)
) {
  throw new Error("Single-sample lite workflow did not return the shared result frame.");
}
if (cohort.subgroups.length === 0) {
  throw new Error("Cohort workflow did not return subgroup guidance.");
}
if (
  cohortLite.parameters?.workflow !== "runCohortFit" ||
  cohortLite.subgroupReviewStatus !== "single_similarity_group" ||
  !cohortLite.qc?.subgroups
) {
  throw new Error("Cohort lite workflow did not return the shared result frame.");
}
if (!cohort.groupComparison?.comparisons?.length) {
  throw new Error("Cohort comparison workflow did not return comparisons.");
}
if (!panel.evidenceCalls.sample_1?.length) {
  throw new Error("Panel workflow did not return evidence calls.");
}
if (!panel.restrictedAssayEvidenceSummary?.signatures?.length || !panel.evidenceSummary?.callCount) {
  throw new Error("Panel workflow did not return restricted-assay evidence and evidence summary.");
}
if (
  panelLite.parameters?.workflow !== "runPanelWorkflow" ||
  !panelLite.panel?.evidenceSummary ||
  !panelLite.panel?.restrictedAssayEvidenceSummary ||
  !panelLite.qc?.evidenceSummary
) {
  throw new Error("Panel lite workflow did not return the shared result frame.");
}
if (
  discoveryLite.parameters?.workflow !== "runDiscoveryWorkflow" ||
  !discoveryLite.qc?.mutationBurden ||
  !discoveryLite.discovery?.productionHandoffRecommendation
) {
  throw new Error("Discovery lite workflow did not return the shared result frame.");
}

console.log(
  JSON.stringify(
    {
      advisorRecommendation: advisor.cohort.primaryRecommendation,
      singleReportingMode: single.fitQualityEvidence.samples[0].reportingMode,
      singleLiteReportingMode: singleLite.fitQualityEvidence.samples[0].reportingMode,
      cohortSubgroups: cohort.subgroups.length,
      cohortComparisons: cohort.groupComparison.comparisons.length,
      cohortLiteStatus: cohortLite.subgroupReviewStatus,
      panelEvidenceTiers: [
        ...new Set(panel.evidenceCalls.sample_1.map((call) => call.tier)),
      ],
      panelLiteEvidenceCalls: panelLite.panel.evidenceSummary.callCount,
      discoveryLiteStatus: discoveryLite.extractionStatus,
      discoveryLiteCriterion: discoveryLite.rankSelectionCriterion,
    },
    null,
    2
  )
);
