import { inferMutationContexts as inferContexts } from "./matrix.js";
import {
  EPSILON,
  cosineSimilarity as vectorCosine,
  frobeniusError,
  matrixMultiply,
  randomMatrix,
  seededRandom,
  transpose,
} from "./numerics.js";
import {
  normalizeMatrixObject,
  toFiniteNumber,
} from "./validation.js";

function normalizeColumnsAndScaleRows(w, h) {
  for (let rankIndex = 0; rankIndex < h.length; rankIndex++) {
    let columnTotal = 0;
    for (let rowIndex = 0; rowIndex < w.length; rowIndex++) {
      columnTotal += w[rowIndex][rankIndex];
    }

    if (columnTotal <= EPSILON) {
      continue;
    }

    for (let rowIndex = 0; rowIndex < w.length; rowIndex++) {
      w[rowIndex][rankIndex] /= columnTotal;
    }

    for (let sampleIndex = 0; sampleIndex < h[rankIndex].length; sampleIndex++) {
      h[rankIndex][sampleIndex] *= columnTotal;
    }
  }
}

/**
 * Converts sample spectra into the numeric matrix used by NMF extraction.
 *
 * @function spectraToMatrix
 * @memberof signatureExtraction
 * @param {Object<string,Object<string,number>>|number[][]} spectra - Sample spectra object or numeric matrix.
 * @param {Object} [options] - Matrix conversion options.
 * @param {string[]} [options.contexts=null] - Context row order.
 * @param {string[]} [options.sampleNames=null] - Sample column order.
 * @returns {{matrix: number[][], contexts: string[], sampleNames: string[]}} Matrix plus row and column labels.
 */
function spectraToMatrix(spectra, { contexts = null, sampleNames = null } = {}) {
  if (Array.isArray(spectra)) {
    const matrix = spectra.map((row) =>
      row.map((value) => toFiniteNumber(value) || 0)
    );
    const contextNames =
      contexts || matrix.map((_, index) => `context_${index + 1}`);
    const sampleNameList =
      sampleNames || matrix[0].map((_, index) => `sample_${index + 1}`);

    return {
      matrix,
      contexts: contextNames,
      sampleNames: sampleNameList,
    };
  }

  const normalizedSpectra = normalizeMatrixObject(spectra);
  const contextNames = contexts || inferContexts(normalizedSpectra);
  const sampleNameList = sampleNames || Object.keys(normalizedSpectra);
  const matrix = contextNames.map((context) =>
    sampleNameList.map(
      (sampleName) => normalizedSpectra[sampleName]?.[context] || 0
    )
  );

  return {
    matrix,
    contexts: contextNames,
    sampleNames: sampleNameList,
  };
}

function matrixToSignatureObject(w, contexts, signaturePrefix = "NMF") {
  const signatures = {};
  const rank = w[0]?.length || 0;

  for (let rankIndex = 0; rankIndex < rank; rankIndex++) {
    const signatureName = `${signaturePrefix}${rankIndex + 1}`;
    signatures[signatureName] = {};

    for (let contextIndex = 0; contextIndex < contexts.length; contextIndex++) {
      signatures[signatureName][contexts[contextIndex]] =
        w[contextIndex][rankIndex];
    }
  }

  return signatures;
}

function matrixToExposureObject(h, sampleNames, signaturePrefix = "NMF") {
  const exposures = {};

  for (let sampleIndex = 0; sampleIndex < sampleNames.length; sampleIndex++) {
    const sampleName = sampleNames[sampleIndex];
    exposures[sampleName] = {};

    for (let rankIndex = 0; rankIndex < h.length; rankIndex++) {
      exposures[sampleName][`${signaturePrefix}${rankIndex + 1}`] =
        h[rankIndex][sampleIndex];
    }
  }

  return exposures;
}

function calculateRunMetrics(x, w, h) {
  const reconstruction = matrixMultiply(w, h);
  const sampleCosineSimilarities = transpose(x).map((sampleVector, index) =>
    vectorCosine(sampleVector, transpose(reconstruction)[index])
  );

  return {
    reconstruction,
    reconstructionError: frobeniusError(x, reconstruction),
    averageSampleCosineSimilarity:
      sampleCosineSimilarities.length === 0
        ? 0
        : sampleCosineSimilarities.reduce((total, value) => total + value, 0) /
          sampleCosineSimilarities.length,
    sampleCosineSimilarities,
  };
}

function summarizeRunMetric(run) {
  return {
    run: run.run,
    seed: run.seed,
    iterations: run.iterations,
    converged: run.converged,
    reconstructionError: run.reconstructionError,
    averageSampleCosineSimilarity: run.averageSampleCosineSimilarity,
  };
}

function buildNMFResult({
  rank,
  matrixInput,
  bestRun,
  runs,
  signaturePrefix = "NMF",
}) {
  const signatures = matrixToSignatureObject(
    bestRun.w,
    matrixInput.contexts,
    signaturePrefix
  );
  const exposures = matrixToExposureObject(
    bestRun.h,
    matrixInput.sampleNames,
    signaturePrefix
  );
  const reconstruction = matrixMultiply(bestRun.w, bestRun.h);

  return {
    rank,
    contexts: matrixInput.contexts,
    sampleNames: matrixInput.sampleNames,
    signatures,
    exposures,
    reconstruction,
    reconstructionError: bestRun.reconstructionError,
    averageSampleCosineSimilarity: bestRun.averageSampleCosineSimilarity,
    iterations: bestRun.iterations,
    converged: bestRun.converged,
    bestRun: {
      run: bestRun.run,
      seed: bestRun.seed,
    },
    runMetrics: runs.map(summarizeRunMetric),
  };
}

function runNMF(x, { rank, maxIterations, tolerance, seed }) {
  const random = seededRandom(seed);
  const contextCount = x.length;
  const sampleCount = x[0]?.length || 0;
  let w = randomMatrix(contextCount, rank, random);
  let h = randomMatrix(rank, sampleCount, random);
  let previousError = Infinity;
  let converged = false;
  let iterations = 0;

  normalizeColumnsAndScaleRows(w, h);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const wt = transpose(w);
    const numeratorH = matrixMultiply(wt, x);
    const denominatorH = matrixMultiply(matrixMultiply(wt, w), h);

    for (let i = 0; i < h.length; i++) {
      for (let j = 0; j < h[i].length; j++) {
        h[i][j] *= numeratorH[i][j] / (denominatorH[i][j] + EPSILON);
      }
    }

    const ht = transpose(h);
    const numeratorW = matrixMultiply(x, ht);
    const denominatorW = matrixMultiply(matrixMultiply(w, h), ht);

    for (let i = 0; i < w.length; i++) {
      for (let j = 0; j < w[i].length; j++) {
        w[i][j] *= numeratorW[i][j] / (denominatorW[i][j] + EPSILON);
      }
    }

    normalizeColumnsAndScaleRows(w, h);

    const metrics = calculateRunMetrics(x, w, h);
    iterations = iteration + 1;
    const relativeImprovement =
      previousError === Infinity
        ? Infinity
        : Math.abs(previousError - metrics.reconstructionError) /
          Math.max(previousError, EPSILON);

    if (relativeImprovement < tolerance) {
      converged = true;
      break;
    }

    previousError = metrics.reconstructionError;
  }

  const metrics = calculateRunMetrics(x, w, h);
  return {
    w,
    h,
    iterations,
    converged,
    ...metrics,
  };
}

function clampDistance(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, Math.min(2, value));
}

function pairwiseValues(matrix) {
  const values = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix.length; j++) {
      values.push(matrix[i][j]);
    }
  }
  return values;
}

function pearsonCorrelation(a, b) {
  const pairs = a
    .map((value, index) => [value, b[index]])
    .filter(
      ([x, y]) =>
        Number.isFinite(x) &&
        Number.isFinite(y)
    );

  if (pairs.length < 2) {
    return null;
  }

  const meanA =
    pairs.reduce((total, [value]) => total + value, 0) / pairs.length;
  const meanB =
    pairs.reduce((total, [, value]) => total + value, 0) / pairs.length;
  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;

  for (const [valueA, valueB] of pairs) {
    const centeredA = valueA - meanA;
    const centeredB = valueB - meanB;
    numerator += centeredA * centeredB;
    denominatorA += centeredA * centeredA;
    denominatorB += centeredB * centeredB;
  }

  const denominator = Math.sqrt(denominatorA * denominatorB);
  return denominator <= EPSILON ? null : numerator / denominator;
}

function sampleCosineDistanceMatrix(x) {
  const sampleVectors = transpose(x);
  const sampleCount = sampleVectors.length;
  const distances = Array.from({ length: sampleCount }, () =>
    Array(sampleCount).fill(0)
  );

  for (let i = 0; i < sampleCount; i++) {
    for (let j = i + 1; j < sampleCount; j++) {
      const distance = clampDistance(
        1 - vectorCosine(sampleVectors[i], sampleVectors[j])
      );
      distances[i][j] = distance;
      distances[j][i] = distance;
    }
  }

  return distances;
}

function averageClusterDistance(clusterA, clusterB, distanceMatrix) {
  let total = 0;
  let count = 0;

  for (const sampleA of clusterA.members) {
    for (const sampleB of clusterB.members) {
      total += distanceMatrix[sampleA][sampleB];
      count += 1;
    }
  }

  return count === 0 ? Infinity : total / count;
}

function copheneticDistanceMatrix(distanceMatrix) {
  const sampleCount = distanceMatrix.length;
  const cophenetic = Array.from({ length: sampleCount }, () =>
    Array(sampleCount).fill(0)
  );
  let clusters = Array.from({ length: sampleCount }, (_, index) => ({
    members: [index],
  }));

  while (clusters.length > 1) {
    let bestI = 0;
    let bestJ = 1;
    let bestDistance = Infinity;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const distance = averageClusterDistance(
          clusters[i],
          clusters[j],
          distanceMatrix
        );
        if (distance < bestDistance) {
          bestI = i;
          bestJ = j;
          bestDistance = distance;
        }
      }
    }

    const clusterA = clusters[bestI];
    const clusterB = clusters[bestJ];
    for (const sampleA of clusterA.members) {
      for (const sampleB of clusterB.members) {
        cophenetic[sampleA][sampleB] = bestDistance;
        cophenetic[sampleB][sampleA] = bestDistance;
      }
    }

    const merged = {
      members: [...clusterA.members, ...clusterB.members],
    };
    clusters = clusters.filter((_, index) => index !== bestI && index !== bestJ);
    clusters.push(merged);
  }

  return cophenetic;
}

function assignSamplesToComponents(h) {
  const sampleCount = h[0]?.length || 0;
  const assignments = [];

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    let bestComponent = 0;
    let bestValue = -Infinity;

    for (let componentIndex = 0; componentIndex < h.length; componentIndex++) {
      const value = h[componentIndex][sampleIndex] || 0;
      if (value > bestValue) {
        bestComponent = componentIndex;
        bestValue = value;
      }
    }

    assignments.push(bestComponent);
  }

  return assignments;
}

function buildConsensusMatrix(assignmentsByRun, sampleCount) {
  const consensus = Array.from({ length: sampleCount }, (_, rowIndex) =>
    Array.from({ length: sampleCount }, (_, columnIndex) =>
      rowIndex === columnIndex ? 1 : 0
    )
  );

  if (assignmentsByRun.length === 0) {
    return consensus;
  }

  for (const assignments of assignmentsByRun) {
    for (let i = 0; i < sampleCount; i++) {
      for (let j = i + 1; j < sampleCount; j++) {
        if (assignments[i] === assignments[j]) {
          consensus[i][j] += 1;
          consensus[j][i] += 1;
        }
      }
    }
  }

  for (let i = 0; i < sampleCount; i++) {
    for (let j = i + 1; j < sampleCount; j++) {
      consensus[i][j] /= assignmentsByRun.length;
      consensus[j][i] = consensus[i][j];
    }
  }

  return consensus;
}

function averageSilhouetteScore(assignments, distanceMatrix) {
  const sampleCount = assignments.length;
  if (sampleCount < 2) {
    return null;
  }

  const scores = assignments.map((cluster, sampleIndex) => {
    const sameCluster = assignments
      .map((candidateCluster, candidateIndex) => ({
        candidateCluster,
        candidateIndex,
      }))
      .filter(
        (candidate) =>
          candidate.candidateCluster === cluster &&
          candidate.candidateIndex !== sampleIndex
      )
      .map((candidate) => distanceMatrix[sampleIndex][candidate.candidateIndex]);
    const otherClusters = [...new Set(assignments)]
      .filter((candidateCluster) => candidateCluster !== cluster)
      .map((candidateCluster) =>
        assignments
          .map((assignedCluster, candidateIndex) => ({
            assignedCluster,
            candidateIndex,
          }))
          .filter((candidate) => candidate.assignedCluster === candidateCluster)
          .map((candidate) => distanceMatrix[sampleIndex][candidate.candidateIndex])
      )
      .filter((distances) => distances.length > 0);

    if (sameCluster.length === 0 || otherClusters.length === 0) {
      return 0;
    }

    const a =
      sameCluster.reduce((total, distance) => total + distance, 0) /
      sameCluster.length;
    const b = Math.min(
      ...otherClusters.map(
        (distances) =>
          distances.reduce((total, distance) => total + distance, 0) /
          distances.length
      )
    );
    const denominator = Math.max(a, b);
    return denominator <= EPSILON ? 0 : (b - a) / denominator;
  });

  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

function normalizeRankSelectionCriterion(criterion) {
  const normalized = String(criterion || "reconstruction_error")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  if (
    [
      "reconstruction",
      "reconstructionerror",
      "reconstruction_error",
      "lowest_reconstruction_error",
      "lowest_reconstruction_error_across_rank_grid",
    ].includes(normalized)
  ) {
    return "reconstruction_error";
  }
  if (["cophenetic", "copheneticcorrelation", "cophenetic_correlation"].includes(normalized)) {
    return "cophenetic";
  }
  if (
    [
      "silhouette",
      "silhouettescore",
      "silhouette_score",
      "average_silhouette",
    ].includes(normalized)
  ) {
    return "silhouette";
  }

  throw new Error(
    `Unsupported rankSelectionCriterion "${criterion}". Use reconstruction_error, cophenetic, or silhouette.`
  );
}

function getRankCriterionValue(run, criterion) {
  if (criterion === "cophenetic") {
    return run.copheneticCorrelation;
  }
  if (criterion === "silhouette") {
    return run.averageSilhouette;
  }
  return run.reconstructionError;
}

function rankCriterionDirection(criterion) {
  return criterion === "reconstruction_error" ? "minimize" : "maximize";
}

function compareRankSelectionRuns(currentBest, candidate, criterion) {
  const direction = rankCriterionDirection(criterion);
  const bestValue = getRankCriterionValue(currentBest, criterion);
  const candidateValue = getRankCriterionValue(candidate, criterion);

  if (!Number.isFinite(candidateValue)) {
    return currentBest;
  }
  if (!Number.isFinite(bestValue)) {
    return candidate;
  }

  if (direction === "minimize") {
    return candidateValue < bestValue ? candidate : currentBest;
  }
  return candidateValue > bestValue ? candidate : currentBest;
}

/**
 * Extracts de novo mutational signatures with non-negative matrix factorization.
 *
 * @function extractSignaturesNMF
 * @memberof signatureExtraction
 * @param {Object<string,Object<string,number>>|number[][]} spectra - Sample spectra object or matrix.
 * @param {Object} [options] - NMF options.
 * @param {number} [options.rank=5] - Number of signatures to extract.
 * @param {number} [options.maxIterations=1000] - Maximum multiplicative-update iterations.
 * @param {number} [options.tolerance=1e-5] - Relative improvement threshold for convergence.
 * @param {number} [options.nRuns=20] - Number of random starts.
 * @param {number} [options.seed=123] - Base seed for random starts.
 * @param {string[]} [options.contexts=null] - Context order to use.
 * @param {string[]} [options.sampleNames=null] - Sample order to use.
 * @param {string} [options.signaturePrefix="NMF"] - Prefix for extracted signature names.
 * @returns {Object} Best-run NMF result with signatures, exposures, reconstruction, and run metrics.
 * @example
 * const nmf = mSigSDK.signatureExtraction.extractSignaturesNMF(groupedSpectra, {
 *   rank: 3,
 *   nRuns: 10,
 *   seed: 123,
 * });
 */
function extractSignaturesNMF(
  spectra,
  {
    rank = 5,
    maxIterations = 1000,
    tolerance = 1e-5,
    nRuns = 20,
    seed = 123,
    contexts = null,
    sampleNames = null,
    signaturePrefix = "NMF",
  } = {}
) {
  const matrixInput = spectraToMatrix(spectra, { contexts, sampleNames });
  const x = matrixInput.matrix;
  const runs = [];

  for (let runIndex = 0; runIndex < nRuns; runIndex++) {
    const run = runNMF(x, {
      rank,
      maxIterations,
      tolerance,
      seed: seed + runIndex,
    });
    runs.push({
      run: runIndex + 1,
      seed: seed + runIndex,
      iterations: run.iterations,
      converged: run.converged,
      reconstructionError: run.reconstructionError,
      averageSampleCosineSimilarity: run.averageSampleCosineSimilarity,
      w: run.w,
      h: run.h,
    });
  }

  const bestRun = runs.reduce((best, run) =>
    run.reconstructionError < best.reconstructionError ? run : best
  );
  return buildNMFResult({
    rank,
    matrixInput,
    bestRun,
    runs,
    signaturePrefix,
  });
}

/**
 * Runs NMF across a rank grid and recommends a rank using the requested criterion.
 *
 * @function selectNMFRank
 * @memberof signatureExtraction
 * @param {Object<string,Object<string,number>>|number[][]} spectra - Sample spectra object or matrix.
 * @param {Object} [options] - Rank selection options.
 * @param {number[]} [options.ranks] - Candidate ranks to evaluate.
 * @param {number} [options.maxIterations=1000] - Maximum iterations per run.
 * @param {number} [options.tolerance=1e-5] - Convergence tolerance.
 * @param {number} [options.nRuns=10] - Random starts per rank.
 * @param {number} [options.seed=123] - Base seed.
 * @param {string} [options.rankSelectionCriterion="reconstruction_error"] - Criterion used to select rank: "reconstruction_error", "cophenetic", or "silhouette".
 * @param {string[]} [options.contexts=null] - Context order to use.
 * @param {string[]} [options.sampleNames=null] - Sample order to use.
 * @returns {Object} Candidate runs, embedded NMF results, and recommended rank.
 */
function selectNMFRank(
  spectra,
  {
    ranks = [2, 3, 4, 5, 6, 7, 8],
    maxIterations = 1000,
    tolerance = 1e-5,
    nRuns = 10,
    seed = 123,
    rankSelectionCriterion = "reconstruction_error",
    contexts = null,
    sampleNames = null,
  } = {}
) {
  const criterion = normalizeRankSelectionCriterion(rankSelectionCriterion);
  const matrixInput = spectraToMatrix(spectra, { contexts, sampleNames });
  const x = matrixInput.matrix;
  const originalCosineDistanceMatrix = sampleCosineDistanceMatrix(x);
  const originalCosineDistances = pairwiseValues(originalCosineDistanceMatrix);
  const runs = ranks.map((rank, index) => {
    const rankRuns = [];

    for (let runIndex = 0; runIndex < nRuns; runIndex++) {
      const runSeed = seed + index * 1000 + runIndex;
      const run = runNMF(x, {
        rank,
        maxIterations,
        tolerance,
        seed: runSeed,
      });
      rankRuns.push({
        run: runIndex + 1,
        seed: runSeed,
        iterations: run.iterations,
        converged: run.converged,
        reconstructionError: run.reconstructionError,
        averageSampleCosineSimilarity: run.averageSampleCosineSimilarity,
        w: run.w,
        h: run.h,
      });
    }

    const bestRun = rankRuns.reduce((best, run) =>
      run.reconstructionError < best.reconstructionError ? run : best
    );
    const assignmentsByRun = rankRuns.map((run) =>
      assignSamplesToComponents(run.h)
    );
    const consensusMatrix = buildConsensusMatrix(
      assignmentsByRun,
      matrixInput.sampleNames.length
    );
    const consensusDistanceMatrix = consensusMatrix.map((row) =>
      row.map((value) => 1 - value)
    );
    const copheneticDistances = pairwiseValues(
      copheneticDistanceMatrix(consensusDistanceMatrix)
    );
    const silhouetteScores = assignmentsByRun.map((assignments) =>
      averageSilhouetteScore(assignments, originalCosineDistanceMatrix)
    );
    const finiteSilhouetteScores = silhouetteScores.filter(Number.isFinite);
    const averageSilhouette =
      finiteSilhouetteScores.length === 0
        ? null
        : finiteSilhouetteScores.reduce((total, value) => total + value, 0) /
          finiteSilhouetteScores.length;
    const result = buildNMFResult({
      rank,
      matrixInput,
      bestRun,
      runs: rankRuns,
    });
    const copheneticCorrelation = pearsonCorrelation(
      copheneticDistances,
      originalCosineDistances
    );

    return {
      rank,
      reconstructionError: result.reconstructionError,
      averageSampleCosineSimilarity: result.averageSampleCosineSimilarity,
      copheneticCorrelation,
      averageSilhouette,
      silhouetteScores,
      consensusMatrix,
      converged: result.converged,
      iterations: result.iterations,
      criterionValue:
        criterion === "cophenetic"
          ? copheneticCorrelation
          : criterion === "silhouette"
            ? averageSilhouette
            : result.reconstructionError,
      result,
    };
  });
  const recommended = runs.reduce((best, run) =>
    compareRankSelectionRuns(best, run, criterion)
  );

  return {
    ranks,
    rankSelectionCriterion: criterion,
    criterionDirection: rankCriterionDirection(criterion),
    criterionUsed: criterion,
    criterionValue: getRankCriterionValue(recommended, criterion),
    recommendedRank: recommended.rank,
    runs,
  };
}

/**
 * Compares extracted signatures to a reference signature catalog by cosine similarity.
 *
 * @function compareExtractedToReference
 * @memberof signatureExtraction
 * @param {Object<string,Object<string,number>>|Object} extractedSignatures - Extracted signature matrix or NMF result.
 * @param {Object<string,Object<string,number>>} referenceSignatures - Reference signature matrix.
 * @param {Object} [options] - Matching options.
 * @param {string[]} [options.contexts=null] - Context order to use.
 * @param {number} [options.topN=5] - Number of matches to retain per extracted signature.
 * @returns {Object[]} Match summaries sorted by similarity for each extracted signature.
 */
function compareExtractedToReference(
  extractedSignatures,
  referenceSignatures,
  { contexts = null, topN = 5 } = {}
) {
  const extracted =
    extractedSignatures?.signatures || normalizeMatrixObject(extractedSignatures);
  const reference = normalizeMatrixObject(referenceSignatures);
  const contextList = contexts || inferContexts({ ...extracted, ...reference });

  return Object.entries(extracted).map(([signatureName, signature]) => {
    const signatureVector = contextList.map(
      (context) => signature[context] || 0
    );
    const matches = Object.entries(reference)
      .map(([referenceName, referenceSignature]) => ({
        referenceName,
        cosineSimilarity: vectorCosine(
          signatureVector,
          contextList.map((context) => referenceSignature[context] || 0)
        ),
      }))
      .sort((a, b) => b.cosineSimilarity - a.cosineSimilarity)
      .slice(0, topN);

    return {
      signatureName,
      matches,
      bestMatch: matches[0] || null,
    };
  });
}

/**
 * Runs NMF extraction in a browser Web Worker when available.
 *
 * @function extractSignaturesNMFInWorker
 * @memberof signatureExtraction
 * @param {Object<string,Object<string,number>>|number[][]} spectra - Sample spectra object or matrix.
 * @param {Object} [options] - Options passed to extractSignaturesNMF.
 * @returns {Promise<Object>} NMF result from the worker or synchronous fallback.
 */
function extractSignaturesNMFInWorker(spectra, options = {}) {
  if (typeof Worker === "undefined" || typeof Blob === "undefined") {
    return Promise.resolve(extractSignaturesNMF(spectra, options));
  }

  const moduleUrl = new URL("./signatureExtraction.js", import.meta.url).href;
  const workerSource = `
    import { extractSignaturesNMF } from ${JSON.stringify(moduleUrl)};

    self.onmessage = function (event) {
      try {
        const { spectra, options } = event.data;
        const result = extractSignaturesNMF(spectra, options);
        self.postMessage({ result });
      } catch (error) {
        self.postMessage({ error: error.message });
      }
    };
  `;
  const workerUrl = URL.createObjectURL(
    new Blob([workerSource], { type: "text/javascript" })
  );
  const worker = new Worker(workerUrl, { type: "module" });

  return new Promise((resolve, reject) => {
    worker.onmessage = (event) => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.result);
      }
    };

    worker.onerror = (error) => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(error);
    };

    worker.postMessage({ spectra, options });
  });
}

export {
  compareExtractedToReference,
  extractSignaturesNMF,
  extractSignaturesNMFInWorker,
  selectNMFRank,
  spectraToMatrix,
};
