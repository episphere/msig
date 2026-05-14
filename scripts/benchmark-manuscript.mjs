#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import {
  bootstrapSignatureFit,
  calculateReconstructionError,
  fitSpectraWithNNLS,
  runThresholdSensitivity,
  summarizeMissingContexts,
  summarizeMutationBurden,
} from "../mSigSDKScripts/qc.js";
import {
  computeFitQualityEvidence,
  recommendAnalysisStrategy,
  runCohortFit,
  runPanelWorkflow,
  runSubgroupDiscoveryWorkflow,
  summarizeRestrictedAssayEvidence,
} from "../mSigSDKScripts/guidance.js";
import { extractSignaturesNMF, selectNMFRank } from "../mSigSDKScripts/signatureExtraction.js";
import { getExpectedContexts } from "../mSigSDKScripts/validation.js";

function parseArgs(argv) {
  const options = {
    quick: false,
    output: null,
    markdown: null,
    repeats: null,
  };

  for (const arg of argv) {
    if (arg === "--quick") {
      options.quick = true;
    } else if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
    } else if (arg.startsWith("--markdown=")) {
      options.markdown = arg.slice("--markdown=".length);
    } else if (arg.startsWith("--repeats=")) {
      const repeats = Number(arg.slice("--repeats=".length));
      if (Number.isInteger(repeats) && repeats > 0) {
        options.repeats = repeats;
      }
    }
  }

  return options;
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

function normalize(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return total === 0 ? values.map(() => 0) : values.map((value) => value / total);
}

function randomProbabilityVector(length, random) {
  return normalize(
    Array.from({ length }, () => -Math.log(Math.max(1 - random(), 1e-12)))
  );
}

function multinomialCounts(total, probabilities, random) {
  const cumulative = [];
  let running = 0;
  for (const probability of probabilities) {
    running += probability;
    cumulative.push(running);
  }

  const counts = Array(probabilities.length).fill(0);
  for (let drawIndex = 0; drawIndex < total; drawIndex++) {
    const draw = random();
    const index = cumulative.findIndex((value) => draw <= value);
    counts[index === -1 ? counts.length - 1 : index] += 1;
  }

  return counts;
}

function matrixMemory() {
  if (global.gc) {
    global.gc();
  }

  const memory = process.memoryUsage();
  return {
    heapUsedMB: memory.heapUsed / 1024 / 1024,
    rssMB: memory.rss / 1024 / 1024,
  };
}

function createBenchmarkData({
  sampleCount,
  signatureCount = 12,
  burden = 500,
  seed = 123,
}) {
  const random = seededRandom(seed);
  const contexts = getExpectedContexts({ profile: "SBS", matrix: 96 });
  const signatures = {};
  const signatureVectors = [];

  for (let signatureIndex = 0; signatureIndex < signatureCount; signatureIndex++) {
    const values = randomProbabilityVector(contexts.length, random);
    const signatureName = `SBS${signatureIndex + 1}`;
    signatureVectors.push(values);
    signatures[signatureName] = Object.fromEntries(
      contexts.map((context, contextIndex) => [context, values[contextIndex]])
    );
  }

  const spectra = {};
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    const exposure = randomProbabilityVector(signatureCount, random).map(
      (value, index) => (index % 4 === sampleIndex % 4 ? value * 2 : value)
    );
    const normalizedExposure = normalize(exposure);
    const probabilities = contexts.map((_, contextIndex) =>
      signatureVectors.reduce(
        (sum, signatureVector, signatureIndex) =>
          sum + normalizedExposure[signatureIndex] * signatureVector[contextIndex],
        0
      )
    );
    const counts = multinomialCounts(burden, normalize(probabilities), random);
    spectra[`sample_${String(sampleIndex + 1).padStart(4, "0")}`] =
      Object.fromEntries(
        contexts.map((context, contextIndex) => [context, counts[contextIndex]])
      );
  }

  return { contexts, signatures, spectra };
}

const FITTING_SCENARIOS = [
  {
    id: "single_sample_wgs_review",
    useCase: "Single-sample WGS review",
    sequencing: "WGS",
    sampleCount: 1,
    signatureCount: 24,
    burden: 5000,
    seed: 2101,
    bootstrapIterations: [500],
  },
  {
    id: "panel_wes_batch",
    useCase: "Small panel/WES batch",
    sequencing: "Panel/WES",
    sampleCount: 24,
    signatureCount: 12,
    burden: 80,
    seed: 2102,
    bootstrapIterations: [100],
  },
  {
    id: "rare_cancer_cohort",
    useCase: "Rare-cancer cohort",
    sequencing: "WES/WGS",
    sampleCount: 40,
    signatureCount: 18,
    burden: 300,
    seed: 2103,
    bootstrapIterations: [100],
  },
  {
    id: "medium_research_cohort",
    useCase: "Medium research cohort",
    sequencing: "WGS/WES",
    sampleCount: 120,
    signatureCount: 24,
    burden: 1200,
    seed: 2104,
    bootstrapIterations: [100],
  },
  {
    id: "portal_review_cohort",
    useCase: "Portal-scale cohort review",
    sequencing: "WGS",
    sampleCount: 300,
    signatureCount: 40,
    burden: 1500,
    seed: 2105,
    bootstrapIterations: [100],
  },
];

const DISCOVERY_SCENARIOS = [
  {
    id: "small_discovery_cohort",
    useCase: "Exploratory discovery cohort",
    sequencing: "WGS/WES",
    sampleCount: 30,
    signatureCount: 6,
    burden: 1200,
    ranks: [2, 3, 4],
    nRuns: 3,
    maxIterations: 75,
    seed: 3101,
  },
  {
    id: "medium_discovery_cohort",
    useCase: "Medium exploratory discovery cohort",
    sequencing: "WGS",
    sampleCount: 80,
    signatureCount: 8,
    burden: 1500,
    ranks: [2, 3, 4],
    nRuns: 3,
    maxIterations: 75,
    seed: 3102,
  },
];

const WORKFLOW_SCENARIOS = [
  {
    id: "panel_wes_batch",
    useCase: "Small panel/WES batch",
    sequencing: "Panel/WES",
    sampleCount: 24,
    signatureCount: 12,
    burden: 80,
    seed: 4101,
    workflows: ["advisor", "fitQualityEvidence", "panel"],
  },
  {
    id: "rare_cancer_cohort",
    useCase: "Rare-cancer cohort",
    sequencing: "WES/WGS",
    sampleCount: 40,
    signatureCount: 18,
    burden: 300,
    seed: 4102,
    workflows: ["advisor", "fitQualityEvidence", "cohort", "subgroup"],
  },
  {
    id: "medium_research_cohort",
    useCase: "Medium research cohort",
    sequencing: "WGS/WES",
    sampleCount: 120,
    signatureCount: 24,
    burden: 1200,
    seed: 4103,
    workflows: ["advisor", "fitQualityEvidence", "cohort"],
  },
];

function quickScenarios(scenarios) {
  return scenarios.slice(0, Math.min(2, scenarios.length)).map((scenario) => ({
    ...scenario,
    sampleCount: Math.min(scenario.sampleCount, 24),
    bootstrapIterations: scenario.bootstrapIterations
      ? [Math.min(scenario.bootstrapIterations[0], 50)]
      : scenario.bootstrapIterations,
    maxIterations: scenario.maxIterations ? 40 : scenario.maxIterations,
    nRuns: scenario.nRuns ? 2 : scenario.nRuns,
  }));
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) {
    return NaN;
  }
  const midpoint = Math.floor(finite.length / 2);
  return finite.length % 2
    ? finite[midpoint]
    : (finite[midpoint - 1] + finite[midpoint]) / 2;
}

async function measure(operation, scenario, fn, repeats = 5) {
  const runs = [];
  let value;

  for (let runIndex = 0; runIndex < repeats; runIndex++) {
    const before = matrixMemory();
    const started = performance.now();
    value = await fn();
    const finished = performance.now();
    const after = matrixMemory();

    runs.push({
      runtimeMs: finished - started,
      heapDeltaMB: after.heapUsedMB - before.heapUsedMB,
      rssDeltaMB: after.rssMB - before.rssMB,
      heapAfterMB: after.heapUsedMB,
      rssAfterMB: after.rssMB,
    });
  }

  const runtimeValues = runs.map((run) => run.runtimeMs);
  const heapDeltaValues = runs.map((run) => run.heapDeltaMB);
  const rssDeltaValues = runs.map((run) => run.rssDeltaMB);
  const heapAfterValues = runs.map((run) => run.heapAfterMB);
  const rssAfterValues = runs.map((run) => run.rssAfterMB);

  return {
    value,
    row: {
      ...scenario,
      operation,
      repeats,
      runtimeMs: median(runtimeValues),
      runtimeMedianMs: median(runtimeValues),
      runtimeMinMs: Math.min(...runtimeValues),
      runtimeMaxMs: Math.max(...runtimeValues),
      heapDeltaMB: median(heapDeltaValues),
      rssDeltaMB: median(rssDeltaValues),
      heapAfterMB: median(heapAfterValues),
      rssAfterMB: median(rssAfterValues),
      runDetails: runs,
    },
  };
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "NA";
}

function toMarkdown(rows) {
  const headers = [
    "useCase",
    "sequencing",
    "samples",
    "mutationsPerSample",
    "contexts",
    "signatures",
    "operation",
    "iterations",
    "thresholds",
    "ranks",
    "repeats",
    "runtimeMedianMs",
    "runtimeMinMs",
    "runtimeMaxMs",
    "heapDeltaMB",
    "rssDeltaMB",
  ];
  const lines = [
    `# mSigSDK Manuscript Benchmark Results`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];

  for (const row of rows) {
    lines.push(
      `| ${headers
        .map((header) => {
          const value = row[header];
          if (typeof value === "number") {
            return formatNumber(value);
          }
          if (Array.isArray(value)) {
            return value.join(", ");
          }
          return value ?? "";
        })
        .join(" | ")} |`
    );
  }

  lines.push("");
  lines.push("Memory deltas are process-level estimates and should be interpreted as approximate.");
  return `${lines.join("\n")}\n`;
}

async function runScenario({ scenario, quick, repeats }) {
  const sampleCount = scenario.sampleCount;
  const signatureCount = scenario.signatureCount;
  const burden = quick ? Math.min(scenario.burden, 300) : scenario.burden;
  const { contexts, signatures, spectra } = createBenchmarkData({
    sampleCount,
    signatureCount,
    burden,
    seed: scenario.seed,
  });
  const baseScenario = {
    id: scenario.id,
    useCase: scenario.useCase,
    sequencing: scenario.sequencing,
    samples: sampleCount,
    mutationsPerSample: burden,
    contexts: contexts.length,
    signatures: signatureCount,
    iterations: "",
    thresholds: "",
    ranks: "",
  };
  const rows = [];

  const validation = await measure(
    "validation_qc",
    baseScenario,
    () => {
      const burdenSummary = summarizeMutationBurden(spectra, {
        expectedContexts: contexts,
        lowBurdenThreshold: 100,
      });
      const missingContexts = summarizeMissingContexts(spectra, {
        expectedContexts: contexts,
      });
      return { burdenSummary, missingContexts };
    },
    repeats
  );
  rows.push(validation.row);

  const fit = await measure(
    "nnls_fit",
    baseScenario,
    () =>
      fitSpectraWithNNLS(signatures, spectra, {
        contexts,
        exposureThreshold: 0.01,
        exposureType: "relative",
        renormalize: true,
      }),
    repeats
  );
  rows.push(fit.row);

  const reconstruction = await measure(
    "reconstruction_metrics",
    baseScenario,
    () =>
      calculateReconstructionError(signatures, spectra, fit.value, {
        contexts,
        normalizeMode: "relative",
      }),
    repeats
  );
  rows.push(reconstruction.row);

  const thresholds = quick ? [0, 0.03] : [0, 0.01, 0.03, 0.05, 0.1];
  const thresholdSensitivity = await measure(
    "threshold_sensitivity",
    { ...baseScenario, thresholds },
    () =>
      runThresholdSensitivity(signatures, spectra, {
        thresholds,
        contexts,
        exposureType: "relative",
        renormalize: true,
      }),
    repeats
  );
  rows.push(thresholdSensitivity.row);

  const bootstrapIterations = quick
    ? [25]
    : scenario.bootstrapIterations || [100];
  const firstSample = Object.keys(spectra)[0];
  for (const iterations of bootstrapIterations) {
    const bootstrap = await measure(
      "bootstrap_one_sample",
      { ...baseScenario, iterations },
      () =>
        bootstrapSignatureFit(signatures, spectra[firstSample], {
          iterations,
          contexts,
          exposureThreshold: 0.01,
          exposureType: "relative",
          renormalize: true,
          seed: 42,
        }),
      repeats
    );
    rows.push(bootstrap.row);
  }

  return rows;
}

async function runNMFScenario({ scenario, quick, repeats }) {
  const sampleCount = scenario.sampleCount;
  const signatureCount = scenario.signatureCount;
  const burden = quick ? Math.min(scenario.burden, 300) : scenario.burden;
  const { contexts, spectra } = createBenchmarkData({
    sampleCount,
    signatureCount,
    burden,
    seed: scenario.seed,
  });
  const ranks = quick ? scenario.ranks.slice(0, 2) : scenario.ranks;
  const nRuns = quick ? 2 : scenario.nRuns;
  const maxIterations = quick ? 40 : scenario.maxIterations;
  const baseScenario = {
    id: scenario.id,
    useCase: scenario.useCase,
    sequencing: scenario.sequencing,
    samples: sampleCount,
    mutationsPerSample: burden,
    contexts: contexts.length,
    signatures: "",
    iterations: maxIterations,
    thresholds: "",
    ranks,
  };
  const rows = [];

  const rankSelection = await measure(
    "nmf_rank_selection",
    baseScenario,
    () =>
      selectNMFRank(spectra, {
        contexts,
        ranks,
        nRuns,
        maxIterations,
        tolerance: 1e-5,
        seed: 9000,
      }),
    repeats
  );
  rows.push(rankSelection.row);

  const recommendedRank = rankSelection.value.recommendedRank || ranks[0];
  const extraction = await measure(
    "nmf_extract_recommended_rank",
    { ...baseScenario, ranks: [recommendedRank] },
    () =>
      extractSignaturesNMF(spectra, {
        contexts,
        rank: recommendedRank,
        nRuns,
        maxIterations,
        tolerance: 1e-5,
        seed: 9500,
      }),
    repeats
  );
  rows.push(extraction.row);

  return rows;
}

function createMetadata(spectra) {
  return Object.fromEntries(
    Object.keys(spectra).map((sampleName, index) => [
      sampleName,
      {
        comparisonGroup: index % 2 === 0 ? "group_A" : "group_B",
      },
    ])
  );
}

function createCallableOpportunities(contexts) {
  return Object.fromEntries(
    contexts.map((context, index) => [context, index % 3 === 0 ? 1 : 0.4])
  );
}

async function runGuidanceScenario({ scenario, quick, repeats }) {
  const sampleCount = scenario.sampleCount;
  const signatureCount = scenario.signatureCount;
  const burden = quick ? Math.min(scenario.burden, 300) : scenario.burden;
  const { contexts, signatures, spectra } = createBenchmarkData({
    sampleCount,
    signatureCount,
    burden,
    seed: scenario.seed,
  });
  const metadata = createMetadata(spectra);
  const baseScenario = {
    id: scenario.id,
    useCase: scenario.useCase,
    sequencing: scenario.sequencing,
    samples: sampleCount,
    mutationsPerSample: burden,
    contexts: contexts.length,
    signatures: signatureCount,
    iterations: "",
    thresholds: "",
    ranks: "",
  };
  const rows = [];

  if (scenario.workflows.includes("advisor")) {
    const advisor = await measure(
      "v03_analysis_advisor",
      baseScenario,
      () =>
        recommendAnalysisStrategy(spectra, {
          expectedContexts: contexts,
          lowBurdenThreshold: 100,
        }),
      repeats
    );
    rows.push(advisor.row);
  }

  const exposures = await fitSpectraWithNNLS(signatures, spectra, {
    contexts,
    exposureThreshold: 0.01,
    exposureType: "relative",
    renormalize: true,
  });

  if (scenario.workflows.includes("fitQualityEvidence")) {
    const fitQualityEvidence = await measure(
      "v03_fit_quality_evidence",
      baseScenario,
      () =>
        computeFitQualityEvidence({
          signatures,
          spectra,
          exposures,
          contexts,
        }),
      repeats
    );
    rows.push(fitQualityEvidence.row);
  }

  if (scenario.workflows.includes("panel")) {
    const restrictedAssayEvidence = await measure(
      "v03_restricted_assay_evidence",
      baseScenario,
      () => summarizeRestrictedAssayEvidence(signatures, { contexts }),
      repeats
    );
    rows.push(restrictedAssayEvidence.row);
  }

  if (scenario.workflows.includes("cohort")) {
    const cohort = await measure(
      "v03_cohort_fit_pipeline",
      baseScenario,
      () =>
        runCohortFit(
          { spectra, signatures, metadata },
          {
            contexts,
            groupKey: "comparisonGroup",
            comparison: { minGroupSize: 1, permutationIterations: quick ? 0 : 25 },
            runBootstrap: false,
            runThresholdSensitivity: false,
            runSubgroupDiscovery: false,
          }
        ),
      repeats
    );
    rows.push(cohort.row);
  }

  if (scenario.workflows.includes("panel")) {
    const panel = await measure(
      "v03_panel_workflow",
      baseScenario,
      () =>
        runPanelWorkflow(
          {
            spectra,
            signatures,
            callableOpportunities: createCallableOpportunities(contexts),
          },
          {
            contexts,
            runBootstrap: false,
            runThresholdSensitivity: false,
            runSubgroupDiscovery: false,
          }
        ),
      repeats
    );
    rows.push(panel.row);
  }

  if (scenario.workflows.includes("subgroup")) {
    const subgroupSamples = Object.keys(spectra).slice(0, Math.min(sampleCount, 12));
    const subgroup = await measure(
      "v03_subgroup_discovery",
      { ...baseScenario, samples: subgroupSamples.length, iterations: quick ? 50 : 75, ranks: [2] },
      () =>
        runSubgroupDiscoveryWorkflow(
          {
            spectra: Object.fromEntries(
              subgroupSamples.map((sampleName) => [sampleName, spectra[sampleName]])
            ),
            signatures,
            subgroups: [
              {
                clusterId: "benchmark_subgroup",
                samples: subgroupSamples,
              },
            ],
          },
          {
            contexts,
            rank: 2,
            nRuns: quick ? 2 : 3,
            maxIterations: quick ? 50 : 75,
            minSubgroupSamples: 5,
            minMedianBurden: 100,
          }
        ),
      repeats
    );
    rows.push(subgroup.row);
  }

  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fittingScenarios = options.quick
    ? quickScenarios(FITTING_SCENARIOS)
    : FITTING_SCENARIOS;
  const discoveryScenarios = options.quick
    ? quickScenarios(DISCOVERY_SCENARIOS)
    : DISCOVERY_SCENARIOS;
  const workflowScenarios = options.quick
    ? quickScenarios(WORKFLOW_SCENARIOS)
    : WORKFLOW_SCENARIOS;
  const rows = [];
  const repeats = options.repeats || (options.quick ? 2 : 5);

  for (const scenario of fittingScenarios) {
    rows.push(...(await runScenario({ scenario, quick: options.quick, repeats })));
  }

  for (const scenario of discoveryScenarios) {
    rows.push(...(await runNMFScenario({ scenario, quick: options.quick, repeats })));
  }

  for (const scenario of workflowScenarios) {
    rows.push(...(await runGuidanceScenario({ scenario, quick: options.quick, repeats })));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    quick: options.quick,
    repeats,
    rows,
  };

  if (options.output) {
    await writeFile(options.output, `${JSON.stringify(payload, null, 2)}\n`);
  }

  if (options.markdown) {
    await writeFile(options.markdown, toMarkdown(rows));
  }

  console.log(toMarkdown(rows));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

