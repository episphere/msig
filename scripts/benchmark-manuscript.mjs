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
import { extractSignaturesNMF, selectNMFRank } from "../mSigSDKScripts/signatureExtraction.js";
import { getExpectedContexts } from "../mSigSDKScripts/validation.js";

function parseArgs(argv) {
  const options = {
    quick: false,
    output: null,
    markdown: null,
  };

  for (const arg of argv) {
    if (arg === "--quick") {
      options.quick = true;
    } else if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
    } else if (arg.startsWith("--markdown=")) {
      options.markdown = arg.slice("--markdown=".length);
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

async function measure(operation, scenario, fn) {
  const before = matrixMemory();
  const started = performance.now();
  const value = await fn();
  const finished = performance.now();
  const after = matrixMemory();

  return {
    value,
    row: {
      ...scenario,
      operation,
      runtimeMs: finished - started,
      heapDeltaMB: after.heapUsedMB - before.heapUsedMB,
      rssDeltaMB: after.rssMB - before.rssMB,
      heapAfterMB: after.heapUsedMB,
      rssAfterMB: after.rssMB,
    },
  };
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "NA";
}

function toMarkdown(rows) {
  const headers = [
    "samples",
    "contexts",
    "signatures",
    "operation",
    "iterations",
    "thresholds",
    "ranks",
    "runtimeMs",
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

async function runScenario({ sampleCount, quick }) {
  const signatureCount = 12;
  const burden = quick ? 200 : 500;
  const { contexts, signatures, spectra } = createBenchmarkData({
    sampleCount,
    signatureCount,
    burden,
    seed: 1000 + sampleCount,
  });
  const baseScenario = {
    samples: sampleCount,
    contexts: contexts.length,
    signatures: signatureCount,
    iterations: "",
    thresholds: "",
    ranks: "",
  };
  const rows = [];

  const validation = await measure("validation_qc", baseScenario, () => {
    const burdenSummary = summarizeMutationBurden(spectra, {
      expectedContexts: contexts,
      lowBurdenThreshold: 100,
    });
    const missingContexts = summarizeMissingContexts(spectra, {
      expectedContexts: contexts,
    });
    return { burdenSummary, missingContexts };
  });
  rows.push(validation.row);

  const fit = await measure("nnls_fit", baseScenario, () =>
    fitSpectraWithNNLS(signatures, spectra, {
      contexts,
      exposureThreshold: 0.01,
      exposureType: "relative",
      renormalize: true,
    })
  );
  rows.push(fit.row);

  const reconstruction = await measure("reconstruction_metrics", baseScenario, () =>
    calculateReconstructionError(signatures, spectra, fit.value, {
      contexts,
      normalizeMode: "relative",
    })
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
      })
  );
  rows.push(thresholdSensitivity.row);

  const bootstrapIterations = quick ? [25] : [100, 500];
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
        })
    );
    rows.push(bootstrap.row);
  }

  return rows;
}

async function runNMFScenario({ sampleCount, quick }) {
  const signatureCount = 6;
  const burden = quick ? 200 : 500;
  const { contexts, spectra } = createBenchmarkData({
    sampleCount,
    signatureCount,
    burden,
    seed: 8000 + sampleCount,
  });
  const ranks = quick ? [2, 3] : [2, 3, 4];
  const nRuns = quick ? 2 : 3;
  const maxIterations = quick ? 50 : 100;
  const baseScenario = {
    samples: sampleCount,
    contexts: contexts.length,
    signatures: "",
    iterations: maxIterations,
    thresholds: "",
    ranks,
  };
  const rows = [];

  const rankSelection = await measure("nmf_rank_selection", baseScenario, () =>
    selectNMFRank(spectra, {
      contexts,
      ranks,
      nRuns,
      maxIterations,
      tolerance: 1e-5,
      seed: 9000,
    })
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
      })
  );
  rows.push(extraction.row);

  return rows;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sampleCounts = options.quick ? [10, 25] : [10, 100, 500, 1000];
  const nmfSampleCounts = options.quick ? [10] : [10, 100];
  const rows = [];

  for (const sampleCount of sampleCounts) {
    rows.push(...(await runScenario({ sampleCount, quick: options.quick })));
  }

  for (const sampleCount of nmfSampleCounts) {
    rows.push(...(await runNMFScenario({ sampleCount, quick: options.quick })));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    quick: options.quick,
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

