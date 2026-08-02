import { EPSILON, frobeniusError, matrixMultiply, randomMatrix, seededRandom } from "../../../mSigSDKScripts/numerics.js";

export function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

export function matrixNorm(matrix) {
  return Math.sqrt(
    matrix.reduce(
      (total, row) => total + row.reduce((rowTotal, value) => rowTotal + value * value, 0),
      0
    )
  );
}

export function relativeFrobeniusError(observed, reconstructed) {
  const denominator = Math.max(matrixNorm(observed), EPSILON);
  return frobeniusError(observed, reconstructed) / denominator;
}

export function matrixFromSpectra(spectra, contexts, sampleNames = Object.keys(spectra)) {
  return contexts.map((context) =>
    sampleNames.map((sampleName) => Number(spectra[sampleName]?.[context]) || 0)
  );
}

export function spectraFromMatrix(matrix, contexts, sampleNames) {
  return Object.fromEntries(
    sampleNames.map((sampleName, sampleIndex) => [
      sampleName,
      Object.fromEntries(
        contexts.map((context, contextIndex) => [
          context,
          Number(matrix[contextIndex]?.[sampleIndex]) || 0,
        ])
      ),
    ])
  );
}

export function signaturesFromMatrix(matrix, contexts, prefix = "NMF") {
  const rank = matrix[0]?.length || 0;
  return Object.fromEntries(
    Array.from({ length: rank }, (_, rankIndex) => [
      `${prefix}${rankIndex + 1}`,
      Object.fromEntries(
        contexts.map((context, contextIndex) => [
          context,
          Number(matrix[contextIndex]?.[rankIndex]) || 0,
        ])
      ),
    ])
  );
}

export function exposuresFromMatrix(matrix, sampleNames, prefix = "NMF") {
  return Object.fromEntries(
    sampleNames.map((sampleName, sampleIndex) => [
      sampleName,
      Object.fromEntries(
        Array.from({ length: matrix.length }, (_, rankIndex) => [
          `${prefix}${rankIndex + 1}`,
          Number(matrix[rankIndex]?.[sampleIndex]) || 0,
        ])
      ),
    ])
  );
}

export function normalizedRandomInitialization(contextCount, sampleCount, rank, seed) {
  const random = seededRandom(seed);
  const w = randomMatrix(contextCount, rank, random);
  const h = randomMatrix(rank, sampleCount, random);

  for (let rankIndex = 0; rankIndex < rank; rankIndex += 1) {
    const columnTotal = w.reduce((total, row) => total + row[rankIndex], 0);
    if (columnTotal <= EPSILON) continue;
    for (let contextIndex = 0; contextIndex < contextCount; contextIndex += 1) {
      w[contextIndex][rankIndex] /= columnTotal;
    }
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      h[rankIndex][sampleIndex] *= columnTotal;
    }
  }

  return { w, h };
}

function permutations(values) {
  if (values.length <= 1) return [values.slice()];
  const output = [];
  values.forEach((value, index) => {
    const rest = values.slice(0, index).concat(values.slice(index + 1));
    permutations(rest).forEach((suffix) => output.push([value, ...suffix]));
  });
  return output;
}

function vectorCosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftNorm * rightNorm);
  return denominator <= EPSILON ? 0 : dot / denominator;
}

export function componentMatch(leftProfiles, rightProfiles) {
  if (leftProfiles.length !== rightProfiles.length) {
    throw new Error("Component matching requires equal-rank profile matrices.");
  }
  const rank = leftProfiles.length;
  const candidates = permutations(Array.from({ length: rank }, (_, index) => index));
  let best = null;

  for (const permutation of candidates) {
    const similarities = leftProfiles.map((profile, index) =>
      vectorCosine(profile, rightProfiles[permutation[index]])
    );
    const total = similarities.reduce((sum, value) => sum + value, 0);
    if (!best || total > best.total) {
      best = { permutation, similarities, total };
    }
  }

  const sorted = [...best.similarities].sort((a, b) => a - b);
  return {
    permutation: best.permutation,
    similarities: best.similarities,
    meanCosine: best.total / rank,
    medianCosine:
      rank % 2 === 1
        ? sorted[Math.floor(rank / 2)]
        : (sorted[rank / 2 - 1] + sorted[rank / 2]) / 2,
    minimumCosine: sorted[0],
  };
}

export function profileMatrix(nmfResult, contexts) {
  return Object.values(nmfResult.signatures).map((profile) =>
    contexts.map((context) => Number(profile[context]) || 0)
  );
}

export function exposureMatrix(nmfResult, sampleNames) {
  const signatureNames = Object.keys(nmfResult.signatures);
  return signatureNames.map((signature) =>
    sampleNames.map((sampleName) => Number(nmfResult.exposures[sampleName]?.[signature]) || 0)
  );
}

export function reconstructedMatrix(nmfResult, contexts, sampleNames) {
  const profileRows = profileMatrix(nmfResult, contexts);
  const profiles = contexts.map((_, contextIndex) =>
    profileRows.map((profile) => profile[contextIndex])
  );
  const exposures = exposureMatrix(nmfResult, sampleNames);
  return matrixMultiply(profiles, exposures);
}

export function pairwiseProfileStability(results, contexts) {
  const converged = results.filter((result) => result.converged);
  if (converged.length < 2) return null;
  const scores = [];
  for (let leftIndex = 0; leftIndex < converged.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < converged.length; rightIndex += 1) {
      scores.push(
        componentMatch(
          profileMatrix(converged[leftIndex], contexts),
          profileMatrix(converged[rightIndex], contexts)
        ).medianCosine
      );
    }
  }
  return median(scores);
}

export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted.length % 2 === 1
    ? sorted[Math.floor(sorted.length / 2)]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}

export function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length === 0 ? null : finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

export function standardError(values) {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return 0;
  const average = mean(finite);
  const variance = finite.reduce((sum, value) => sum + (value - average) ** 2, 0) / (finite.length - 1);
  return Math.sqrt(variance / finite.length);
}

export function assignSamples(nmfResult, sampleNames) {
  const names = Object.keys(nmfResult.signatures);
  return sampleNames.map((sampleName) => {
    let bestIndex = 0;
    let bestValue = -Infinity;
    names.forEach((signature, index) => {
      const value = Number(nmfResult.exposures[sampleName]?.[signature]) || 0;
      if (value > bestValue) {
        bestIndex = index;
        bestValue = value;
      }
    });
    return bestIndex;
  });
}

export function adjustedRandIndex(left, right) {
  if (left.length !== right.length || left.length === 0) return null;
  const combinations = (count) => (count < 2 ? 0 : (count * (count - 1)) / 2);
  const leftCounts = new Map();
  const rightCounts = new Map();
  const pairCounts = new Map();
  for (let index = 0; index < left.length; index += 1) {
    leftCounts.set(left[index], (leftCounts.get(left[index]) || 0) + 1);
    rightCounts.set(right[index], (rightCounts.get(right[index]) || 0) + 1);
    const key = `${left[index]}|${right[index]}`;
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }
  const sumPairs = [...pairCounts.values()].reduce((sum, count) => sum + combinations(count), 0);
  const leftPairs = [...leftCounts.values()].reduce((sum, count) => sum + combinations(count), 0);
  const rightPairs = [...rightCounts.values()].reduce((sum, count) => sum + combinations(count), 0);
  const totalPairs = combinations(left.length);
  const expected = totalPairs === 0 ? 0 : (leftPairs * rightPairs) / totalPairs;
  const denominator = ((leftPairs + rightPairs) / 2) - expected;
  return denominator <= EPSILON ? 1 : (sumPairs - expected) / denominator;
}

export function pairwiseClusteringStability(results, sampleNames) {
  const converged = results.filter((result) => result.converged);
  if (converged.length < 2) return null;
  const assignments = converged.map((result) => assignSamples(result, sampleNames));
  const scores = [];
  for (let leftIndex = 0; leftIndex < assignments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < assignments.length; rightIndex += 1) {
      scores.push(adjustedRandIndex(assignments[leftIndex], assignments[rightIndex]));
    }
  }
  return mean(scores);
}

export function shuffle(values, seed) {
  const random = seededRandom(seed);
  const output = values.slice();
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

export function foldAssignments(sampleNames, foldCount, seed) {
  const shuffled = shuffle(sampleNames, seed);
  const folds = Array.from({ length: foldCount }, () => []);
  shuffled.forEach((sampleName, index) => folds[index % foldCount].push(sampleName));
  return folds;
}
