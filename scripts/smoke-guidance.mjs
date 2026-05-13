import {
  compareSignatureExposures,
  computeSignatureAmbiguity,
  estimateSignatureDetectability,
  recommendAnalysisStrategy,
  runCohortFit,
  runLocalizedMutagenesisAnalysis,
  runPanelWorkflow,
  runSingleSampleFit,
  runSubgroupDiscoveryWorkflow,
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
const detectability = estimateSignatureDetectability(signatures, { contexts });
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
const comparison = compareSignatureExposures(cohort.fit.exposures, metadata, {
  groupKey: "status",
  minGroupSize: 1,
  permutationIterations: 9,
});
const subgroup = await runSubgroupDiscoveryWorkflow(
  {
    spectra: subgroupSpectra,
    signatures,
    subgroups: [
      {
        clusterId: "cluster_test",
        samples: Object.keys(subgroupSpectra),
      },
    ],
  },
  {
    expectedContexts: contexts,
    rank: 2,
    nRuns: 2,
    maxIterations: 50,
    minSubgroupSamples: 3,
    minMedianBurden: 100,
  }
);
const panel = await runPanelWorkflow(
  { spectra, signatures },
  {
    expectedContexts: contexts,
    runBootstrap: false,
    runThresholdSensitivity: false,
  }
);
const localized = runLocalizedMutagenesisAnalysis(
  [
    { chromosome: "1", position: 1000, context: "T[C>T]A" },
    { chromosome: "1", position: 1500, context: "T[C>G]T" },
    { chromosome: "1", position: 2100, context: "A[C>T]T" },
    { chromosome: "1", position: 3000, context: "G[C>A]A" },
  ],
  "GRCh37",
  { maxIntermutationDistance: 1200, minMutations: 3 }
);

if (advisor.samples.length !== 2) {
  throw new Error("Advisor did not summarize both samples.");
}
if (ambiguity.catalogSummary.signatureCount !== 3) {
  throw new Error("Ambiguity summary did not include all signatures.");
}
if (detectability.signatures.length !== 3) {
  throw new Error("Detectability summary did not include all signatures.");
}
if (!single.trust.samples[0]?.classification) {
  throw new Error("Single-sample workflow did not return a trust classification.");
}
if (cohort.subgroups.length === 0) {
  throw new Error("Cohort workflow did not return subgroup guidance.");
}
if (!cohort.groupComparison?.comparisons?.length || !comparison.comparisons.length) {
  throw new Error("Cohort comparison workflow did not return comparisons.");
}
if (subgroup.summary.extractedSubgroupCount !== 1) {
  throw new Error("Subgroup discovery workflow did not extract the synthetic subgroup.");
}
if (!panel.evidenceCalls.sample_1?.length) {
  throw new Error("Panel workflow did not return evidence calls.");
}
if (!panel.detectability?.signatures?.length || !panel.evidenceSummary?.callCount) {
  throw new Error("Panel workflow did not return detectability and evidence summary.");
}
if (localized.foci.length === 0) {
  throw new Error("Localized workflow did not detect the synthetic focus.");
}

console.log(
  JSON.stringify(
    {
      advisorRecommendation: advisor.cohort.primaryRecommendation,
      singleTrust: single.trust.samples[0].classification,
      cohortSubgroups: cohort.subgroups.length,
      cohortComparisons: cohort.groupComparison.comparisons.length,
      subgroupExtractions: subgroup.summary.extractedSubgroupCount,
      panelEvidenceTiers: [
        ...new Set(panel.evidenceCalls.sample_1.map((call) => call.tier)),
      ],
      localizedFoci: localized.foci.length,
    },
    null,
    2
  )
);
