import {
  getExpectedContexts,
  getMatrixContexts,
  normalizeMatrixObject,
  toFiniteNumber,
} from "./validation.js";

const EPSILON = 1e-12;

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

function transpose(matrix) {
  return matrix[0].map((_, columnIndex) =>
    matrix.map((row) => row[columnIndex])
  );
}

function matrixMultiply(a, b) {
  const result = Array.from({ length: a.length }, () =>
    Array(b[0].length).fill(0)
  );

  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < b.length; k++) {
      for (let j = 0; j < b[0].length; j++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }

  return result;
}

function randomMatrix(rows, columns, random) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => random() + EPSILON)
  );
}

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

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

function frobeniusError(x, reconstruction) {
  let total = 0;
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < x[i].length; j++) {
      const residual = x[i][j] - reconstruction[i][j];
      total += residual * residual;
    }
  }
  return Math.sqrt(total);
}

function vectorCosine(a, b) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function inferContexts(matrix) {
  const sbs96 = getExpectedContexts({ profile: "SBS", matrix: 96 });
  const contexts = getMatrixContexts(matrix);

  if (
    contexts.length <= sbs96.length &&
    contexts.every((context) => sbs96.includes(context))
  ) {
    return sbs96;
  }

  return contexts;
}

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
    runMetrics: runs.map(
      ({
        run,
        seed: runSeed,
        iterations,
        converged,
        reconstructionError,
        averageSampleCosineSimilarity,
      }) => ({
        run,
        seed: runSeed,
        iterations,
        converged,
        reconstructionError,
        averageSampleCosineSimilarity,
      })
    ),
  };
}

function selectNMFRank(
  spectra,
  {
    ranks = [2, 3, 4, 5, 6, 7, 8],
    maxIterations = 1000,
    tolerance = 1e-5,
    nRuns = 10,
    seed = 123,
    contexts = null,
    sampleNames = null,
  } = {}
) {
  const runs = ranks.map((rank, index) => {
    const result = extractSignaturesNMF(spectra, {
      rank,
      maxIterations,
      tolerance,
      nRuns,
      seed: seed + index * 1000,
      contexts,
      sampleNames,
    });

    return {
      rank,
      reconstructionError: result.reconstructionError,
      averageSampleCosineSimilarity: result.averageSampleCosineSimilarity,
      converged: result.converged,
      iterations: result.iterations,
      result,
    };
  });
  const recommended = runs.reduce((best, run) =>
    run.reconstructionError < best.reconstructionError ? run : best
  );

  return {
    ranks,
    recommendedRank: recommended.rank,
    runs,
  };
}

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
