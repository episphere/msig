const PYODIDE_RUNNER_SCHEMA_VERSION = "msig.runner.pyodide.v0.3";
const DEFAULT_PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/";

function now() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function normalizeArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function createPyodideWorkerSource() {
  return `
let pyodideReadyPromise = null;
let pyodideInstance = null;
const loadedPyodidePackages = new Set();
const installedMicropipPackages = new Set();

function normalizeArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizePath(path) {
  return String(path || "").replace(/\\\\/g, "/");
}

function dirname(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

function ensureDirectory(path) {
  const directory = dirname(path);
  if (directory && directory !== "/") {
    pyodideInstance.FS.mkdirTree(directory);
  }
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function writeInputFile(file) {
  const path = normalizePath(file.path);
  if (!path || path === "/") {
    throw new Error("Pyodide input files require a concrete virtual filesystem path.");
  }
  ensureDirectory(path);
  if (file.base64 !== undefined) {
    pyodideInstance.FS.writeFile(path, base64ToBytes(file.base64));
    return;
  }
  if (file.bytes instanceof Uint8Array) {
    pyodideInstance.FS.writeFile(path, file.bytes);
    return;
  }
  pyodideInstance.FS.writeFile(path, String(file.text ?? file.content ?? ""));
}

function readOutputFile(path, encoding = "auto") {
  const normalized = normalizePath(path);
  const textLike =
    encoding === "text" ||
    (encoding === "auto" && /\\.(txt|tsv|csv|json|md|html|xml|log|py)$/i.test(normalized));
  if (textLike) {
    return {
      path: normalized,
      encoding: "text",
      text: pyodideInstance.FS.readFile(normalized, { encoding: "utf8" }),
    };
  }
  const bytes = pyodideInstance.FS.readFile(normalized);
  return {
    path: normalized,
    encoding: "base64",
    base64: bytesToBase64(bytes),
  };
}

function listFilesRecursive(root) {
  const normalizedRoot = normalizePath(root || "/");
  const entries = [];
  function visit(path) {
    for (const name of pyodideInstance.FS.readdir(path)) {
      if (name === "." || name === "..") {
        continue;
      }
      const child = path === "/" ? "/" + name : path + "/" + name;
      const stat = pyodideInstance.FS.stat(child);
      if (pyodideInstance.FS.isDir(stat.mode)) {
        visit(child);
      } else {
        entries.push(child);
      }
    }
  }
  const pathInfo = pyodideInstance.FS.analyzePath(normalizedRoot);
  if (pathInfo.exists) {
    visit(normalizedRoot);
  }
  return entries;
}

function convertPyodideResult(value) {
  if (value && typeof value.toJs === "function") {
    try {
      const converted = value.toJs({ dict_converter: Object.fromEntries });
      if (typeof value.destroy === "function") {
        value.destroy();
      }
      return converted;
    } catch (_error) {
      if (typeof value.destroy === "function") {
        value.destroy();
      }
      return String(value);
    }
  }
  return value;
}

async function ensurePyodide(config = {}) {
  if (!pyodideReadyPromise) {
    const indexURL = config.indexURL || "${DEFAULT_PYODIDE_INDEX_URL}";
    const scriptURL = config.scriptURL || new URL("pyodide.js", indexURL).href;
    pyodideReadyPromise = (async () => {
      importScripts(scriptURL);
      pyodideInstance = await loadPyodide({ indexURL });
      return pyodideInstance;
    })();
  }
  return pyodideReadyPromise;
}

async function loadPyodidePackages(packages) {
  for (const packageName of normalizeArray(packages)) {
    if (!packageName || loadedPyodidePackages.has(packageName)) {
      continue;
    }
    await pyodideInstance.loadPackage(packageName);
    loadedPyodidePackages.add(packageName);
  }
}

async function installMicropipPackages(packages) {
  const packageNames = normalizeArray(packages).filter(Boolean);
  if (packageNames.length === 0) {
    return;
  }
  await pyodideInstance.loadPackage("micropip");
  loadedPyodidePackages.add("micropip");
  const micropip = pyodideInstance.pyimport("micropip");
  for (const packageName of packageNames) {
    if (installedMicropipPackages.has(packageName)) {
      continue;
    }
    await micropip.install(packageName);
    installedMicropipPackages.add(packageName);
  }
}

async function runPayload(payload) {
  await ensurePyodide({
    indexURL: payload.pyodideIndexURL,
    scriptURL: payload.pyodideScriptURL,
  });
  await loadPyodidePackages(payload.pyodidePackages);
  await installMicropipPackages(payload.micropipPackages);

  for (const file of normalizeArray(payload.files)) {
    writeInputFile(file);
  }

  if (payload.inputJson !== undefined) {
    pyodideInstance.globals.set("MSIG_INPUT_JSON", JSON.stringify(payload.inputJson));
  }

  for (const [key, value] of Object.entries(payload.globals || {})) {
    pyodideInstance.globals.set(key, value);
  }

  const result = convertPyodideResult(
    await pyodideInstance.runPythonAsync(String(payload.python || "None"))
  );
  let parsedResult = result;
  if (payload.parseJsonResult !== false && typeof result === "string") {
    try {
      parsedResult = JSON.parse(result);
    } catch (_error) {
      parsedResult = result;
    }
  }

  const outputFiles = [];
  for (const filePath of normalizeArray(payload.outputFiles)) {
    outputFiles.push(readOutputFile(filePath, payload.outputEncoding || "auto"));
  }
  for (const directory of normalizeArray(payload.outputDirectories)) {
    for (const filePath of listFilesRecursive(directory)) {
      outputFiles.push(readOutputFile(filePath, payload.outputEncoding || "auto"));
    }
  }

  return {
    result: parsedResult,
    files: outputFiles,
    loadedPyodidePackages: Array.from(loadedPyodidePackages),
    installedMicropipPackages: Array.from(installedMicropipPackages),
  };
}

self.onmessage = async (event) => {
  const { id, payload } = event.data || {};
  try {
    const output = await runPayload(payload || {});
    self.postMessage({ id, ok: true, output });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: {
        name: error?.name || "Error",
        message: error?.message || String(error),
        stack: error?.stack || null,
      },
    });
  }
};
`;
}

/**
 * Reports whether the current JavaScript runtime can create a Pyodide worker.
 *
 * @function detectPyodideRuntime
 * @memberof runners
 * @returns {Object} Runtime availability and missing browser capabilities.
 */
function detectPyodideRuntime() {
  const missing = [];
  if (typeof Worker === "undefined") {
    missing.push("Worker");
  }
  if (typeof Blob === "undefined") {
    missing.push("Blob");
  }
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    missing.push("URL.createObjectURL");
  }
  return {
    schemaVersion: PYODIDE_RUNNER_SCHEMA_VERSION,
    runtime: "pyodide",
    available: missing.length === 0,
    missing,
    defaultIndexURL: DEFAULT_PYODIDE_INDEX_URL,
  };
}

/**
 * Creates a reusable Pyodide Web Worker runner.
 *
 * @function createPyodideWorkerRunner
 * @memberof runners
 * @param {Object} [options] - Runner options.
 * @param {string} [options.workerUrl=null] - Custom worker script URL.
 * @param {string} [options.pyodideIndexURL] - Pyodide distribution base URL.
 * @param {string} [options.pyodideScriptURL] - Explicit pyodide.js URL.
 * @param {number} [options.timeoutMs=120000] - Per-run timeout in milliseconds.
 * @returns {Object} Runner with run and terminate methods.
 */
function createPyodideWorkerRunner({
  workerUrl = null,
  pyodideIndexURL = DEFAULT_PYODIDE_INDEX_URL,
  pyodideScriptURL = null,
  timeoutMs = 120000,
} = {}) {
  const runtime = detectPyodideRuntime();
  if (!runtime.available) {
    throw new Error(
      `Pyodide workers are not available in this runtime. Missing: ${runtime.missing.join(", ")}.`
    );
  }

  const objectUrl = workerUrl
    ? null
    : URL.createObjectURL(
        new Blob([createPyodideWorkerSource()], { type: "application/javascript" })
      );
  const worker = new Worker(workerUrl || objectUrl);
  const pending = new Map();
  let nextId = 1;
  let terminated = false;

  worker.onmessage = (event) => {
    const { id, ok, output, error } = event.data || {};
    const entry = pending.get(id);
    if (!entry) {
      return;
    }
    pending.delete(id);
    clearTimeout(entry.timeoutHandle);
    if (ok) {
      entry.resolve(output);
    } else {
      const runtimeError = new Error(error?.message || "Pyodide worker failed.");
      runtimeError.name = error?.name || "PyodideWorkerError";
      runtimeError.stack = error?.stack || runtimeError.stack;
      entry.reject(runtimeError);
    }
  };

  worker.onerror = (event) => {
    const error = new Error(event.message || "Pyodide worker error.");
    for (const [id, entry] of pending.entries()) {
      clearTimeout(entry.timeoutHandle);
      entry.reject(error);
      pending.delete(id);
    }
  };

  function terminate() {
    terminated = true;
    worker.terminate();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    for (const [id, entry] of pending.entries()) {
      clearTimeout(entry.timeoutHandle);
      entry.reject(new Error("Pyodide worker was terminated before the run completed."));
      pending.delete(id);
    }
  }

  async function run(payload = {}) {
    if (terminated) {
      throw new Error("Cannot run code on a terminated Pyodide worker.");
    }
    const id = nextId++;
    const startedAt = now();
    const effectiveTimeoutMs = payload.timeoutMs || timeoutMs;
    const effectivePayload = {
      ...payload,
      pyodideIndexURL: payload.pyodideIndexURL || pyodideIndexURL,
      pyodideScriptURL: payload.pyodideScriptURL || pyodideScriptURL,
    };

    return await new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        pending.delete(id);
        terminate();
        reject(
          new Error(
            `Pyodide run exceeded ${effectiveTimeoutMs} ms and the worker was terminated.`
          )
        );
      }, effectiveTimeoutMs);
      pending.set(id, {
        resolve: (output) =>
          resolve({
            schemaVersion: PYODIDE_RUNNER_SCHEMA_VERSION,
            runtime: "pyodide",
            elapsedMs: now() - startedAt,
            ...output,
          }),
        reject,
        timeoutHandle,
      });
      worker.postMessage({ id, payload: effectivePayload });
    });
  }

  return {
    schemaVersion: PYODIDE_RUNNER_SCHEMA_VERSION,
    runtime: "pyodide",
    pyodideIndexURL,
    run,
    terminate,
  };
}

/**
 * Runs one Pyodide job in a temporary Web Worker.
 *
 * @async
 * @function runPyodide
 * @memberof runners
 * @param {Object} payload - Python code, packages, files, and output collection options.
 * @param {Object} [options] - Runner construction options.
 * @returns {Promise<Object>} Result, collected files, package metadata, and elapsed time.
 */
async function runPyodide(payload, options = {}) {
  const runner = createPyodideWorkerRunner(options);
  try {
    return await runner.run(payload);
  } finally {
    runner.terminate();
  }
}

/**
 * Runs Python code in Pyodide with a small JavaScript-first API.
 *
 * The optional `inputs` object is serialized to `MSIG_INPUT_JSON` in the Python
 * runtime, and string results are parsed as JSON by default so structured
 * Python outputs are returned as ordinary JavaScript objects.
 *
 * @async
 * @function runPython
 * @memberof runners
 * @param {string} code - Python code to execute.
 * @param {Object} [options] - Python inputs, packages, files, output collection, and runner options.
 * @param {Object} [options.inputs=null] - JSON-serializable input object exposed as `MSIG_INPUT_JSON`.
 * @returns {Promise<Object>} Result, collected files, package metadata, and elapsed time.
 */
async function runPython(
  code,
  {
    inputs = null,
    files = [],
    pyodidePackages = [],
    micropipPackages = [],
    globals = {},
    outputFiles = [],
    outputDirectories = [],
    outputEncoding = "auto",
    parseJsonResult = true,
    timeoutMs,
    pyodideIndexURL,
    pyodideScriptURL,
    workerUrl,
  } = {}
) {
  return await runPyodide(
    {
      python: code,
      inputJson: inputs,
      files,
      pyodidePackages,
      micropipPackages,
      globals,
      outputFiles,
      outputDirectories,
      outputEncoding,
      parseJsonResult,
      timeoutMs,
      pyodideIndexURL,
      pyodideScriptURL,
    },
    {
      timeoutMs,
      pyodideIndexURL,
      pyodideScriptURL,
      workerUrl,
    }
  );
}

export {
  DEFAULT_PYODIDE_INDEX_URL,
  PYODIDE_RUNNER_SCHEMA_VERSION,
  createPyodideWorkerRunner,
  createPyodideWorkerSource,
  detectPyodideRuntime,
  runPython,
  runPyodide,
};
