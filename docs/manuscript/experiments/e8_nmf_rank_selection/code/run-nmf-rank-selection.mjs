import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  ensureDir,
  environmentSummary,
  relativeArtifact,
  writeCsv,
  writeJson,
} from "../../../../../scripts/manuscript/lib/experiment-utils.mjs";
import { fitSpectraWithNNLS } from "../../../../../mSigSDKScripts/qc.js";
import { extractSignaturesNMF } from "../../../../../mSigSDKScripts/signatureExtraction.js";
import {
  componentMatch,
  foldAssignments,
  matrixFromSpectra,
  mean,
  pairwiseClusteringStability,
  pairwiseProfileStability,
  profileMatrix,
  reconstructedMatrix,
  relativeFrobeniusError,
  standardError,
} from "../../../../../scripts/manuscript/lib/nmf-validation.mjs";

const ROOT = path.resolve(".");
const EXPERIMENT_DIR = path.join(ROOT, "docs", "manuscript", "experiments", "e8_nmf_rank_selection");
const DATA_DIR = path.join(EXPERIMENT_DIR, "data");
const INPUT_PATH = path.join(
  ROOT,
  "docs",
  "manuscript",
  "experiments",
  "e2_adapter_fidelity",
  "data",
  "adapter-fidelity-input.json"
);
const RESULT_PATH = path.join(DATA_DIR, "nmf-rank-selection-results.json");
const RANK_SUMMARY_PATH = path.join(DATA_DIR, "nmf_rank_selection_summary.csv");
const FOLD_SUMMARY_PATH = path.join(DATA_DIR, "nmf_rank_selection_folds.csv");
const PROGRESS_PATH = path.join(DATA_DIR, "nmf-rank-selection-progress.json");

const RANKS = [2, 3, 4, 5, 6, 7, 8];
const FOLD_COUNT = 5;
const RESTARTS_PER_FOLD = 5;
const FULL_COHORT_RESTARTS = 20;
const MAX_ITERATIONS = 1500;
const FULL_COHORT_MAX_ITERATIONS = 1500;
const TOLERANCE = 1e-4;
const SEED = 20260801;
const MIN_CONVERGENCE_RATE = 0.8;
const MIN_COMPONENT_STABILITY = 0.9;

await ensureDir(DATA_DIR);
const input = JSON.parse(await readFile(INPUT_PATH, "utf8"));
const { contexts, spectra } = input;
const sampleNames = Object.keys(spectra);
const folds = foldAssignments(sampleNames, FOLD_COUNT, SEED);
const foldRows = [];
const rankSummaries = [];

await writeJson(PROGRESS_PATH, {
  status: "running",
  stage: "rank_selection",
  completedCells: 0,
  totalCells: RANKS.length * FOLD_COUNT,
  parameters: {
    ranks: RANKS,
    foldCount: FOLD_COUNT,
    restartsPerFold: RESTARTS_PER_FOLD,
    maxIterations: MAX_ITERATIONS,
    tolerance: TOLERANCE,
    seed: SEED,
  },
});

let completedCells = 0;
for (const rank of RANKS) {
  const foldResults = [];
  for (let foldIndex = 0; foldIndex < folds.length; foldIndex += 1) {
    const testSamples = folds[foldIndex];
    const testSet = new Set(testSamples);
    const trainSamples = sampleNames.filter((sampleName) => !testSet.has(sampleName));
    const trainSpectra = subsetSpectra(spectra, trainSamples);
    const testSpectra = subsetSpectra(spectra, testSamples);
    const runResults = [];

    for (let runIndex = 0; runIndex < RESTARTS_PER_FOLD; runIndex += 1) {
      const runSeed = SEED + rank * 1000 + foldIndex * 100 + runIndex;
      const result = extractSignaturesNMF(trainSpectra, {
        contexts,
        sampleNames: trainSamples,
        rank,
        nRuns: 1,
        maxIterations: MAX_ITERATIONS,
        tolerance: TOLERANCE,
        seed: runSeed,
        signaturePrefix: "NMF",
      });
      runResults.push({ ...result, runSeed, runIndex: runIndex + 1 });
    }

    const convergedRuns = runResults.filter((result) => result.converged);
    const bestRun = convergedRuns.length > 0
      ? convergedRuns.reduce((best, result) =>
        result.reconstructionError < best.reconstructionError ? result : best
      )
      : null;
    const stability = pairwiseProfileStability(runResults, contexts);
    const clusteringStability = pairwiseClusteringStability(runResults, trainSamples);
    const trainingMatrix = matrixFromSpectra(trainSpectra, contexts, trainSamples);
    const testMatrix = matrixFromSpectra(testSpectra, contexts, testSamples);
    let heldOutError = null;
    let heldOutCosine = null;

    if (bestRun) {
      const heldOutExposures = await fitSpectraWithNNLS(bestRun.signatures, testSpectra, {
        contexts,
        exposureThreshold: 0,
        exposureType: "absolute",
        renormalize: false,
        maxIterations: 100000,
        convergenceTolerance: 1e-12,
      });
      const heldOutResult = {
        ...bestRun,
        exposures: heldOutExposures,
      };
      const heldOutReconstruction = reconstructedMatrix(heldOutResult, contexts, testSamples);
      heldOutError = relativeFrobeniusError(testMatrix, heldOutReconstruction);
      heldOutCosine = averageSampleCosine(testMatrix, heldOutReconstruction);
    }

    const row = {
      rank,
      fold: foldIndex + 1,
      trainSampleCount: trainSamples.length,
      testSampleCount: testSamples.length,
      totalRuns: runResults.length,
      convergedRuns: convergedRuns.length,
      convergenceRate: convergedRuns.length / runResults.length,
      bestRunSeed: bestRun?.runSeed ?? null,
      bestTrainingRelativeError: bestRun
        ? relativeFrobeniusError(trainingMatrix, bestRun.reconstruction)
        : null,
      heldOutRelativeError: heldOutError,
      heldOutMeanCosine: heldOutCosine,
      restartComponentStabilityMedianCosine: stability,
      restartSampleClusteringMeanARI: clusteringStability,
      status: bestRun ? "usable" : "no_converged_run",
    };
    foldRows.push(row);
    foldResults.push({ row, bestRun });
    completedCells += 1;
    await writeJson(PROGRESS_PATH, {
      status: "running",
      stage: "rank_selection",
      completedCells,
      totalCells: RANKS.length * FOLD_COUNT,
      lastCompleted: { rank, fold: foldIndex + 1 },
      resultPath: relativeArtifact(RESULT_PATH),
    });
  }

  const usableRows = foldResults.map(({ row }) => row).filter((row) => row.status === "usable");
  const convergedRunCount = usableRows.reduce((sum, row) => sum + row.convergedRuns, 0);
  const totalRunCount = usableRows.reduce((sum, row) => sum + row.totalRuns, 0);
  const heldOutErrors = usableRows.map((row) => row.heldOutRelativeError).filter(Number.isFinite);
  const componentStability = median(
    usableRows.map((row) => row.restartComponentStabilityMedianCosine).filter(Number.isFinite)
  );
  const clusteringStability = mean(
    usableRows.map((row) => row.restartSampleClusteringMeanARI).filter(Number.isFinite)
  );
  rankSummaries.push({
    rank,
    foldCount: FOLD_COUNT,
    usableFoldCount: usableRows.length,
    convergenceRate: totalRunCount === 0 ? 0 : convergedRunCount / totalRunCount,
    meanHeldOutRelativeError: mean(heldOutErrors),
    heldOutStandardError: standardError(heldOutErrors),
    meanHeldOutCosine: mean(usableRows.map((row) => row.heldOutMeanCosine).filter(Number.isFinite)),
    componentStabilityMedianCosine: componentStability,
    sampleClusteringMeanARI: clusteringStability,
    eligible:
      usableRows.length === FOLD_COUNT &&
      (totalRunCount === 0 ? 0 : convergedRunCount / totalRunCount) >= MIN_CONVERGENCE_RATE &&
      Number(componentStability) >= MIN_COMPONENT_STABILITY,
  });
}

const eligibleRanks = rankSummaries.filter((summary) => summary.eligible);
const bestHeldOut = eligibleRanks.length > 0
  ? eligibleRanks.reduce((best, summary) =>
    summary.meanHeldOutRelativeError < best.meanHeldOutRelativeError ? summary : best
  )
  : rankSummaries.filter((summary) => Number.isFinite(summary.meanHeldOutRelativeError)).reduce((best, summary) =>
    !best || summary.meanHeldOutRelativeError < best.meanHeldOutRelativeError ? summary : best,
    null
  );
const oneStandardErrorLimit = bestHeldOut
  ? bestHeldOut.meanHeldOutRelativeError + bestHeldOut.heldOutStandardError
  : null;
const selectedSummary = eligibleRanks
  .filter((summary) => summary.meanHeldOutRelativeError <= oneStandardErrorLimit)
  .sort((left, right) => left.rank - right.rank)[0] || bestHeldOut;
const selectedRank = selectedSummary?.rank ?? null;

const fullRunResults = [];
if (selectedRank !== null) {
  for (let runIndex = 0; runIndex < FULL_COHORT_RESTARTS; runIndex += 1) {
    const runSeed = SEED + 900000 + selectedRank * 1000 + runIndex;
    fullRunResults.push({
      ...extractSignaturesNMF(spectra, {
        contexts,
        sampleNames,
        rank: selectedRank,
        nRuns: 1,
        maxIterations: FULL_COHORT_MAX_ITERATIONS,
        tolerance: TOLERANCE,
        seed: runSeed,
        signaturePrefix: "NMF",
      }),
      runSeed,
      runIndex: runIndex + 1,
    });
  }
}
const convergedFullRuns = fullRunResults.filter((result) => result.converged);
const selectedFullRun = convergedFullRuns.length > 0
  ? convergedFullRuns.reduce((best, result) =>
    result.reconstructionError < best.reconstructionError ? result : best
  )
  : fullRunResults.reduce((best, result) =>
    !best || result.reconstructionError < best.reconstructionError ? result : best,
    null
  );
const fullStability = pairwiseProfileStability(fullRunResults, contexts);
const fullClusteringStability = pairwiseClusteringStability(fullRunResults, sampleNames);

const result = {
  schemaVersion: "msig.manuscript.e8_nmf_rank_selection.v1",
  generatedAt: new Date().toISOString(),
  experimentId: "e8_nmf_rank_selection",
  inputs: {
    source: relativeArtifact(INPUT_PATH),
    cohort: "PCAWG Lung-AdenoCA SBS96",
    sampleCount: sampleNames.length,
    contextCount: contexts.length,
    split: "five-fold sample-level cross-validation with deterministic shuffled folds",
  },
  method: {
    objective: "relative held-out Frobenius reconstruction error after refitting non-negative exposures to held-out samples",
    candidateRanks: RANKS,
    restartsPerFold: RESTARTS_PER_FOLD,
    maxIterations: MAX_ITERATIONS,
    tolerance: TOLERANCE,
    seed: SEED,
    convergenceRule: "relative Frobenius-error improvement below tolerance; non-converged runs excluded from rank summaries",
    minimumConvergenceRate: MIN_CONVERGENCE_RATE,
    componentMatching: "exact one-to-one permutation maximizing total cosine similarity; median matched cosine reported",
    stabilityRule: `eligible ranks require all ${FOLD_COUNT} folds, convergence rate >= ${MIN_CONVERGENCE_RATE}, and median restart component stability >= ${MIN_COMPONENT_STABILITY}`,
    selectionRule: "among eligible ranks, choose the smallest rank within one standard error of the minimum mean held-out error; exact ties resolve to the smaller rank",
    sampleClusteringRole: "reported as mean pairwise adjusted Rand index across restart assignments; not used as a second tuning objective",
  },
  rankSummaries,
  foldRows,
  selection: {
    selectedRank,
    selectedRankReason: selectedSummary
      ? "smallest eligible rank within one standard error of the best mean held-out error"
      : "no usable rank",
    bestHeldOutRank: bestHeldOut?.rank ?? null,
    oneStandardErrorLimit,
    eligibleRanks: eligibleRanks.map((summary) => summary.rank),
  },
  fullCohortFit: selectedFullRun
    ? {
      rank: selectedRank,
      restarts: FULL_COHORT_RESTARTS,
      maxIterations: FULL_COHORT_MAX_ITERATIONS,
      convergedRuns: convergedFullRuns.length,
      selectedRunSeed: selectedFullRun.runSeed,
      reconstructionError: selectedFullRun.reconstructionError,
      fullCohortComponentStabilityMedianCosine: fullStability,
      fullCohortSampleClusteringMeanARI: fullClusteringStability,
      signatures: selectedFullRun.signatures,
      exposures: selectedFullRun.exposures,
    }
    : null,
  environment: environmentSummary(),
};

await writeJson(RESULT_PATH, result);
await writeCsv(RANK_SUMMARY_PATH, rankSummaries);
await writeCsv(FOLD_SUMMARY_PATH, foldRows);
await writeJson(PROGRESS_PATH, {
  status: "completed",
  stage: "result_written",
  completedCells: RANKS.length * FOLD_COUNT,
  totalCells: RANKS.length * FOLD_COUNT,
  resultPath: relativeArtifact(RESULT_PATH),
});

console.log(JSON.stringify({
  selectedRank,
  eligibleRanks: eligibleRanks.map((summary) => summary.rank),
  bestHeldOutRank: bestHeldOut?.rank ?? null,
  fullConvergedRuns: convergedFullRuns.length,
}, null, 2));

function subsetSpectra(allSpectra, names) {
  return Object.fromEntries(names.map((name) => [name, allSpectra[name]]));
}

function averageSampleCosine(observed, reconstructed) {
  const observedSamples = transpose(observed);
  const reconstructedSamples = transpose(reconstructed);
  const cosines = observedSamples.map((left, sampleIndex) => cosine(left, reconstructedSamples[sampleIndex]));
  return mean(cosines);
}

function cosine(left, right) {
  let dotProduct = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftNorm * rightNorm);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

function transpose(matrix) {
  return matrix[0].map((_, columnIndex) => matrix.map((row) => row[columnIndex]));
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return null;
  return finite.length % 2 === 1
    ? finite[Math.floor(finite.length / 2)]
    : (finite[finite.length / 2 - 1] + finite[finite.length / 2]) / 2;
}
