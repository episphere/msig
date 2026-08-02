function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  return dotProduct / (magnitudeA * magnitudeB);
}

function linspace(a, b, n) {
  return Array.from({ length: n }, (_, i) => a + (i * (b - a)) / (n - 1));
}

const RUNTIME_OPTIONS_DEFAULTS = Object.freeze({
  strictLocal: false,
  debug: false,
  cacheResponses: true,
});

const runtimeOptions = { ...RUNTIME_OPTIONS_DEFAULTS };

function normalizeRuntimeOptions(options = {}) {
  if (!options || typeof options !== "object") {
    return {};
  }
  const normalized = {};
  if (Object.prototype.hasOwnProperty.call(options, "strictLocal")) {
    normalized.strictLocal = Boolean(options.strictLocal);
  }
  if (Object.prototype.hasOwnProperty.call(options, "debug")) {
    normalized.debug = Boolean(options.debug);
  }
  if (Object.prototype.hasOwnProperty.call(options, "cacheResponses")) {
    normalized.cacheResponses = Boolean(options.cacheResponses);
  }
  if (Object.prototype.hasOwnProperty.call(options, "cache")) {
    normalized.cacheResponses = Boolean(options.cache);
  }
  return normalized;
}

function getRuntimeOptions(overrides = {}) {
  const resolved = {
    ...runtimeOptions,
    ...normalizeRuntimeOptions(overrides),
  };
  if (resolved.strictLocal) {
    resolved.cacheResponses = false;
  }
  return resolved;
}

function configureRuntimeOptions(options = {}) {
  Object.assign(runtimeOptions, normalizeRuntimeOptions(options));
  return getRuntimeOptions();
}

function debugLog(options, ...args) {
  if (getRuntimeOptions(options).debug) {
    console.log(...args);
  }
}

function debugWarn(options, ...args) {
  if (getRuntimeOptions(options).debug) {
    console.warn(...args);
  }
}

function assertNoUserDataEgress(action, options = {}, detail = "") {
  if (!getRuntimeOptions(options).strictLocal) {
    return;
  }
  const suffix = detail ? ` ${detail}` : "";
  throw new Error(
    `strictLocal blocked ${action} because it would transmit user-derived data outside this device.${suffix}`
  );
}

async function sha256Hex(bytes) {
  const arrayBuffer =
    bytes instanceof ArrayBuffer
      ? bytes
      : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", arrayBuffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(Buffer.from(arrayBuffer)).digest("hex");
}

function arrayBufferFromBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function makeNodeResponse(bodyBuffer, { status, statusText, url }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: statusText || "",
    url,
    headers: new Map(),
    async arrayBuffer() {
      return arrayBufferFromBuffer(bodyBuffer);
    },
    async text() {
      return bodyBuffer.toString("utf8");
    },
    async json() {
      return JSON.parse(bodyBuffer.toString("utf8"));
    },
    clone() {
      return makeNodeResponse(Buffer.from(bodyBuffer), { status, statusText, url });
    },
  };
}

function attachParsedPayloadProvenance(parsed, provenance) {
  if (!parsed || (typeof parsed !== "object" && typeof parsed !== "function")) {
    return parsed;
  }

  try {
    Object.defineProperties(parsed, {
      sourceProvenance: {
        configurable: true,
        enumerable: false,
        value: provenance,
      },
      payloadProvenance: {
        configurable: true,
        enumerable: false,
        value: provenance,
      },
    });
  } catch (_error) {
    // Parsed API records may be frozen by user code; response.provenance remains available.
  }

  return parsed;
}

async function attachPayloadProvenance(
  response,
  { endpointUrl, cacheName, cacheKey, cacheStatus, requestedAt, provenanceLog = null }
) {
  const responseForHash =
    typeof response.clone === "function" ? response.clone() : response;
  let parsedJsonForFallback;
  let hasParsedJsonForFallback = false;
  let payloadBytes;

  if (typeof responseForHash.arrayBuffer === "function") {
    payloadBytes = await responseForHash.arrayBuffer();
  } else if (typeof responseForHash.text === "function") {
    payloadBytes = new TextEncoder().encode(await responseForHash.text());
  } else if (typeof responseForHash.json === "function") {
    parsedJsonForFallback = await responseForHash.json();
    hasParsedJsonForFallback = true;
    payloadBytes = new TextEncoder().encode(JSON.stringify(parsedJsonForFallback));
  } else {
    throw new Error(
      `Cannot compute SHA-256 provenance for ${endpointUrl}; response body is not readable.`
    );
  }

  const payloadSha256 = await sha256Hex(payloadBytes);
  const provenance = {
    endpointUrl,
    retrievedAt: requestedAt,
    cacheName,
    cacheKey,
    cacheStatus,
    httpStatus: response.status,
    responseUrl: response.url || endpointUrl,
    payloadBytes: payloadBytes.byteLength,
    payloadSha256,
    checksum: {
      algorithm: "SHA-256",
      value: payloadSha256,
      scope: "retrieved response payload bytes",
    },
  };

  if (Array.isArray(provenanceLog)) {
    provenanceLog.push(provenance);
  }

  Object.defineProperties(response, {
    provenance: {
      configurable: true,
      enumerable: true,
      value: provenance,
    },
    sourceProvenance: {
      configurable: true,
      enumerable: true,
      value: provenance,
    },
  });

  if (typeof response.json === "function") {
    const parseJson = response.json.bind(response);
    Object.defineProperty(response, "json", {
      configurable: true,
      enumerable: false,
      value: async () =>
        attachParsedPayloadProvenance(
          hasParsedJsonForFallback ? parsedJsonForFallback : await parseJson(),
          provenance
        ),
    });
  }

  return response;
}

// Deep copy an object
function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Solves argmin_x || Ax - b ||_2 for x>=0. A is a matrix, b is a vector.
 * @async
 * @function nnls
 * @memberof machineLearning
 * @param {number[][]} A - The matrix A.
 * @param {number[]} b - The vector b.
 * @param {number} [maxiter=3*A[0].length] - Maximum number of iterations.
 * @returns {Object} An object with two properties: x and rnorm. x is a vector with the same length as b. rnorm is the residual || Ax - b ||^2.
 */
async function nnls(A, b, maxiter = 3 * A[0].length) {
  const transpose = (matrix) =>
    matrix[0].map((_, i) => matrix.map((row) => row[i]));
  A = transpose(A);
  const dot = (a, b) => {
    if (a[0].length === undefined) {
      // Vector-vector multiplication
      return a.map((_, i) => a[i] * b[i]).reduce((sum, x) => sum + x);
    } else {
      // Matrix-vector multiplication
      return a.map((row) => row.reduce((sum, x, i) => sum + x * b[i], 0));
    }
  };
  const matrixMultiply = (A, B) => {
    if (B[0].length === undefined) {
      // Matrix-vector multiplication
      return dot(A, B);
    } else {
      // Matrix-matrix multiplication
      return A.map((row) =>
        B[0].map((_, j) =>
          dot(
            row,
            B.map((col) => col[j])
          )
        )
      );
    }
  };
  const vectorSubtraction = (a, b) => a.map((x, i) => x - b[i]);
  const vectorAddition = (a, b) => a.map((x, i) => x + b[i]);
  const vectorScale = (a, scalar) => a.map((x) => x * scalar);
  const vectorNorm = (a) => Math.sqrt(dot(a, a));

  const At = transpose(A);
  const AtA = matrixMultiply(At, A);
  const Atb = matrixMultiply(At, b);

  let x = Array(A[0].length).fill(0);
  let gradient;
  let rnorm;

  for (let iter = 0; iter < maxiter; iter++) {
    gradient = vectorSubtraction(matrixMultiply(AtA, x), Atb);
    let negativeGradient = gradient.map((x) => -x);

    let alpha = 1;
    let new_x = vectorAddition(x, vectorScale(negativeGradient, alpha));

    while (new_x.some((val) => val < 0)) {
      alpha /= 2;
      new_x = vectorAddition(x, vectorScale(negativeGradient, alpha));
    }

    x = new_x;

    if (vectorNorm(gradient) <= 1e-8) {
      break;
    }
  }

  rnorm = Math.sqrt(
    dot(
      vectorSubtraction(matrixMultiply(A, x), b),
      vectorSubtraction(matrixMultiply(A, x), b)
    )
  );

  return { x, rnorm };
}

async function fetchURLAndCache(
  cacheName,
  url,
  header = null,
  ICGC = null,
  options = {}
) {
  const resolvedOptions = getRuntimeOptions(options);
  const isCacheSupported = typeof window !== "undefined" && "caches" in window;
  const matchedURL = ICGC != null ? ICGC : url;
  const fetchOptions = header || undefined;

  async function fetchWithRuntime() {
    if (typeof fetch === "function") {
      return await fetch(url, fetchOptions);
    }

    const parsedUrl = new URL(url);
    const transport =
      parsedUrl.protocol === "http:"
        ? await import("node:http")
        : await import("node:https");

    return await new Promise((resolve, reject) => {
      const request = transport.request(
        parsedUrl,
        {
          method: fetchOptions?.method || "GET",
          headers: fetchOptions?.headers || {},
        },
        (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => {
            resolve(
              makeNodeResponse(Buffer.concat(chunks), {
                status: response.statusCode,
                statusText: response.statusMessage || "",
                url,
              })
            );
          });
        }
      );
      request.on("error", reject);
      if (fetchOptions?.body) {
        request.write(fetchOptions.body);
      }
      request.end();
    });
  }

  async function fetchFromNetwork() {
    let response;
    try {
      response = await fetchWithRuntime();
    } catch (error) {
      const detail = error?.message ? `: ${error.message}` : "";
      throw new Error(`Error fetching data from ${url}${detail}`, { cause: error });
    }

    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : "";
      throw new Error(`Error fetching data from ${url}: HTTP ${response.status}${statusText}`);
    }

    return response;
  }

  if (!isCacheSupported || resolvedOptions.cacheResponses === false) {
    const cacheStatus =
      resolvedOptions.cacheResponses === false ? "disabled" : "unsupported";
    return await attachPayloadProvenance(await fetchFromNetwork(), {
      endpointUrl: url,
      cacheName,
      cacheKey: matchedURL,
      cacheStatus,
      requestedAt: new Date().toISOString(),
      provenanceLog: options.provenanceLog,
    });
  }

  const cache = await caches.open(cacheName);
  const response = await cache.match(matchedURL);
  if (response) {
    return await attachPayloadProvenance(response, {
      endpointUrl: url,
      cacheName,
      cacheKey: matchedURL,
      cacheStatus: "hit",
      requestedAt: new Date().toISOString(),
      provenanceLog: options.provenanceLog,
    });
  }

  const networkResponse = await fetchFromNetwork();
  const responseForCache = networkResponse.clone();
  try {
    await cache.put(matchedURL, responseForCache);
  } catch (error) {
    debugWarn(resolvedOptions, `Unable to cache fetched data from ${url}.`, error);
  }

  return await attachPayloadProvenance(networkResponse, {
    endpointUrl: url,
    cacheName,
    cacheKey: matchedURL,
    cacheStatus: "miss",
    requestedAt: new Date().toISOString(),
    provenanceLog: options.provenanceLog,
  });
}
// Write a function that converts the json data from ./now.json to the format in ./structure.json

function formatHierarchicalClustersToAM5Format(
  firstFileStructure,
  studyName,
  genomeType,
  cancerType,
  studySize,
  originalData
) {
  const result = {
    name: `${studyName} ${cancerType}\n${genomeType} Dataset (n=${studySize})`,
    totalMutationCount: Object.values(originalData)
      .map((array) => {
        return Object.values(array);
      })
      .reduce((a, b) => {
        return a.concat(b);
      }) // flatten array
      .reduce((a, b) => {
        return a + b;
      }),
    children: [],
  };
  function traverse(node, parent) {
    const children = {
      name: 1 - node.distance,
      // value: 1 - node.distance,
      children: [],
      totalMutationCount: 0,
    };
    if (node.left) traverse(node.left, children);
    if (node.right) traverse(node.right, children);
    if (node.name) children.name = node.name;
    // if (node.name) children.value = 1;
    if (node.name) children.mutations = originalData[node.name];
    if (node.name)
      children.totalMutationCount = Object.values(
        originalData[node.name]
      ).reduce((a, b) => a + b, 0);
    if (!node.name)
      children.totalMutationCount = children.children.reduce(
        (a, b) => a + b.totalMutationCount,
        0
      );
    if (!parent) result.children.push(children);
    else parent.children.push(children);
  }
  traverse(firstFileStructure);
  return result;
}

// Takes in an array of objects and a key and returns an object that groups the objects by the key

function groupBy(array, key) {
  return array.reduce((result, currentValue) => {
    (result[currentValue[key]] = result[currentValue[key]] || []).push(
      currentValue
    );
    return result;
  }, {});
}

// This function creates a distance matrix based on 1 - the cosine similarity of a list of mutational spectra vectors
// The input is a list of mutational spectra vectors (each vector is a list of mutation frequencies)
// The output is a distance matrix (a list of lists of distances)
function createDistanceMatrix(matrix, metric, similarity) {
  let distanceMatrix = [];
  for (let i = 0; i < matrix.length; i++) {
    let row = [];
    for (let j = 0; j < matrix.length; j++) {
      let distance;
      if (similarity) {
        distance = 1 - metric(matrix[i], matrix[j]);
      } else {
        distance = metric(matrix[i], matrix[j]);
      }

      row.push(distance);
    }
    distanceMatrix.push(row);
  }
  return distanceMatrix;
}

/**
 * Performs hierarchical clustering on a distance matrix.
 * @function hierarchicalClustering
 * @memberof machineLearning
 * @param {number[][]} distanceMatrix - The distance matrix to be clustered.
 * @param {string[]} sampleNames - The names of the samples in the distance matrix.
 * @returns {Object} The final clustering result as a tree.
 */

function hierarchicalClustering(distanceMatrix, sampleNames) {
  let order = flatten(upgma(distanceMatrix).slice(-1)).slice(
    0,
    upgma(distanceMatrix).length + 1
  );

  // Return the final clustering result as a tree
  return buildTree(order, distanceMatrix, sampleNames);
}

// This function calculates the average distance between two clusters. It takes in two clusters and a distance matrix as its parameters. The clusters are arrays of indices of the samples in the distance matrix. It finds the average distance between the two clusters and returns the average distance.

function calculateDistance(cluster1, cluster2, distanceMatrix) {
  // Calculate the average distance between samples in the two clusters
  let distanceSum = 0;
  let numPairs = 0;

  for (let i = 0; i < cluster1.length; i++) {
    for (let j = 0; j < cluster2.length; j++) {
      distanceSum += distanceMatrix[cluster1[i]][cluster2[j]];
      numPairs++;
    }
  }

  return distanceSum / numPairs;
}

function buildTree(cluster, distanceMatrix, sampleNames) {
  // Recursively build the tree using nested objects
  if (cluster.length == 1) {
    // If the cluster contains only one sample, return it as a leaf node
    return { name: sampleNames[cluster[0]] };
  } else {
    // Otherwise, recursively build the tree for each sub-cluster
    let leftCluster = cluster.slice(0, Math.floor(cluster.length / 2));
    let rightCluster = cluster.slice(Math.floor(cluster.length / 2));

    return {
      left: buildTree(leftCluster, distanceMatrix, sampleNames),
      right: buildTree(rightCluster, distanceMatrix, sampleNames),
      distance: calculateDistance(leftCluster, rightCluster, distanceMatrix),
    };
  }
}

function flatten(array) {
  return array.reduce(function (memo, el) {
    var items = Array.isArray(el) ? flatten(el) : [el];
    return memo.concat(items);
  }, []);
}

function copyNestedArray(arr) {
  let copy = arr.slice();
  for (let i = 0; i < copy.length; i++) {
    if (Array.isArray(copy[i])) {
      copy[i] = copyNestedArray(copy[i]);
    }
  }
  return copy;
}

/**
 * Performs UPGMA clustering on a distance matrix.
 * @function upgma
 * @memberof machineLearning
 * @param {number[][]} distanceMatrix - The distance matrix to be clustered.
 * @returns {Array} An array of arrays representing the clustering result. Each inner array contains three elements: two clusters being merged and their average distance.
 */

function upgma(distanceMatrix) {
  distanceMatrix = copyNestedArray(distanceMatrix);

  const clusters = distanceMatrix.map((_, index) => [index]);
  const result = [];

  while (clusters.length > 1) {
    const [minI, minJ] = findMinIndices(distanceMatrix);
    const minDist = distanceMatrix[minI][minJ];

    result.push([clusters[minI], clusters[minJ], minDist / 2]);

    const newCluster = clusters[minI].concat(clusters[minJ]);
    clusters[minI] = newCluster;
    clusters.splice(minJ, 1);

    updateDistanceMatrix(distanceMatrix, minI, minJ);
  }

  return result;
}

function findMinIndices(matrix) {
  let minI = 0;
  let minJ = 1;
  let minDist = matrix[minI][minJ];

  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix[i].length; j++) {
      if (matrix[i][j] < minDist) {
        minDist = matrix[i][j];
        minI = i;
        minJ = j;
      }
    }
  }
  return [minI, minJ];
}

function updateDistanceMatrix(matrix, minI, minJ) {
  for (let k = 0; k < matrix.length; k++) {
    if (k === minI || k === minJ) continue;
    const newDist =
      (matrix[minI][k] * matrix[minI].length +
        matrix[minJ][k] * matrix[minJ].length) /
      (matrix[minI].length + matrix[minJ].length);
    matrix[minI][k] = newDist;
    matrix[k][minI] = newDist;
  }

  matrix.splice(minJ, 1);
  matrix.forEach((row) => row.splice(minJ, 1));
}

function euclideanDistance(pointA, pointB) {
  var sum = 0;
  for (var i = 0; i < pointA.length; i++) {
    var difference = pointA[i] - pointB[i];
    sum += difference * difference;
  }
  return Math.sqrt(sum);
}

/**
 * Performs double clustering on a matrix.
 * @function doubleClustering
 * @memberof machineLearning
 * @param {number[][]} matrix - The matrix to be clustered.
 * @param {string[]} rowNames - The names of the rows in the matrix.
 * @param {string[]} colNames - The names of the columns in the matrix.
 * @param {function} [metric=euclideanDistance] - The distance metric to use for clustering.
 * @returns {Object} An object with three properties: matrix, rowNames, and colNames. matrix is the clustered matrix. rowNames and colNames are the names of the rows and columns in the clustered matrix, respectively.
 */

function doubleClustering(
  matrix,
  rowNames,
  colNames,
  metric = euclideanDistance
) {
  const distanceMatrix = createDistanceMatrix(matrix, metric, false);
  let rowOrder = flatten(upgma(distanceMatrix).slice(-1)).slice(
    0,
    upgma(distanceMatrix).length + 1
  );

  const transposedMatrix = matrix[0].map((_, i) => matrix.map((row) => row[i]));
  const distanceMatrixTransposed = createDistanceMatrix(
    transposedMatrix,
    metric,
    false
  );
  let colOrder = flatten(upgma(distanceMatrixTransposed).slice(-1)).slice(
    0,
    upgma(distanceMatrixTransposed).length + 1
  );

  const sortedMatrix = rowOrder.map((i) => colOrder.map((j) => matrix[i][j]));
  const sortedRowNames = rowOrder.map((i) => rowNames[i]);
  const sortedColNames = colOrder.map((i) => colNames[i]);

  return {
    matrix: sortedMatrix,
    rowNames: sortedRowNames,
    colNames: sortedColNames,
  };
}

// export all the functions defined in this file

export {
  cosineSimilarity,
  linspace,
  deepCopy,
  nnls,
  RUNTIME_OPTIONS_DEFAULTS,
  assertNoUserDataEgress,
  configureRuntimeOptions,
  debugLog,
  debugWarn,
  fetchURLAndCache,
  getRuntimeOptions,
  sha256Hex,
  formatHierarchicalClustersToAM5Format,
  groupBy,
  createDistanceMatrix,
  calculateDistance,
  hierarchicalClustering,
  buildTree,
  isNumeric,
  doubleClustering,
};
