const EPSILON = 1e-12;

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function dot(a, b) {
  return a.reduce((total, value, index) => total + value * b[index], 0);
}

function cosineSimilarity(a, b) {
  const magnitudeA = Math.sqrt(dot(a, a));
  const magnitudeB = Math.sqrt(dot(b, b));

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dot(a, b) / (magnitudeA * magnitudeB);
}

function normalizeVector(values, targetTotal = 1) {
  const total = sum(values);
  if (total === 0) {
    return values.map(() => 0);
  }

  return values.map((value) => (value / total) * targetTotal);
}

function quantile(values, q) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;

  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }

  return sorted[base];
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

function randomMatrix(rows, columns, random, offset = EPSILON) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => random() + offset)
  );
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

export {
  EPSILON,
  cosineSimilarity,
  dot,
  frobeniusError,
  matrixMultiply,
  normalizeVector,
  quantile,
  randomMatrix,
  seededRandom,
  sum,
  transpose,
};
