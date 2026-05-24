const PYODIDE_RUNNER_SCHEMA_VERSION = "msig.runner.pyodide.v0.3";
const DEFAULT_PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/";
const WEBR_RUNNER_SCHEMA_VERSION = "msig.runner.webr.v0.3";
const DEFAULT_WEBR_MODULE_URL = "https://webr.r-wasm.org/latest/webr.mjs";
const DEFAULT_WEBR_REPOSITORY_URL = "https://repo.r-wasm.org";
const DEFAULT_WEBR_BINARY_R_VERSION = "4.6";

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

function normalizePath(path) {
  return String(path || "").replace(/\\/g, "/");
}

function dirname(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeRepositoryUrls(value) {
  const repositories = normalizeArray(value)
    .map((entry) => trimTrailingSlash(entry))
    .filter(Boolean);
  return repositories.length ? repositories : [DEFAULT_WEBR_REPOSITORY_URL];
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
  for (const packageEntry of packageNames) {
    const packageName =
      typeof packageEntry === "object" && packageEntry !== null
        ? packageEntry.spec || packageEntry.package || packageEntry.url
        : packageEntry;
    const installOptions =
      typeof packageEntry === "object" && packageEntry !== null
        ? packageEntry.options || {}
        : {};
    if (!packageName || installedMicropipPackages.has(packageName)) {
      continue;
    }
    try {
      await micropip.install(packageName, installOptions);
    } catch (error) {
      const message = error?.message || String(error);
      if (/Can't find a pure Python 3 wheel/i.test(message)) {
        throw new Error(
          "Unable to install " + packageName + " in browser Python. Pyodide can only install packages with pure-Python or Pyodide-compatible wheels. " + message.split("\\n")[0]
        );
      }
      throw error;
    }
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

/**
 * Reports whether the current JavaScript runtime can create and communicate
 * with a webR runtime.
 *
 * @function detectWebRRuntime
 * @memberof runners
 * @returns {Object} Runtime availability and missing browser capabilities.
 */
function detectWebRRuntime() {
  const missing = [];
  if (typeof WebAssembly === "undefined") {
    missing.push("WebAssembly");
  }
  if (typeof Worker === "undefined") {
    missing.push("Worker");
  }
  if (typeof fetch === "undefined") {
    missing.push("fetch");
  }
  if (typeof TextEncoder === "undefined") {
    missing.push("TextEncoder");
  }
  if (typeof TextDecoder === "undefined") {
    missing.push("TextDecoder");
  }
  return {
    schemaVersion: WEBR_RUNNER_SCHEMA_VERSION,
    runtime: "webr",
    available: missing.length === 0,
    missing,
    crossOriginIsolated:
      typeof crossOriginIsolated === "boolean" ? crossOriginIsolated : null,
    defaultModuleURL: DEFAULT_WEBR_MODULE_URL,
    defaultRepositoryURL: DEFAULT_WEBR_REPOSITORY_URL,
    defaultBinaryRVersion: DEFAULT_WEBR_BINARY_R_VERSION,
  };
}

function webRPackageIndexUrls({
  repositoryUrl = DEFAULT_WEBR_REPOSITORY_URL,
  binaryRVersion = DEFAULT_WEBR_BINARY_R_VERSION,
  packageIndexUrls = [],
} = {}) {
  return unique([
    ...normalizeArray(packageIndexUrls),
    ...normalizeRepositoryUrls(repositoryUrl).map(
      (base) => `${base}/bin/emscripten/contrib/${binaryRVersion}/PACKAGES`
    ),
  ]);
}

function parsePackageIndex(text, repository) {
  const packages = new Map();
  String(text || "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .forEach((block) => {
      const record = {};
      block.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          record[match[1].trim()] = match[2].trim();
        }
      });
      if (record.Package) {
        packages.set(record.Package, {
          package: record.Package,
          version: record.Version || null,
          repository,
          record,
        });
      }
    });
  return packages;
}

/**
 * Checks package availability in public or caller-supplied webR repositories.
 *
 * @async
 * @function checkWebRPackageAvailability
 * @memberof runners
 * @param {string|string[]} packages - R packages to check.
 * @param {Object} [options] - Repository and package-index options.
 * @returns {Promise<Object>} Package availability by name.
 */
async function checkWebRPackageAvailability(packages, options = {}) {
  const requested = normalizeArray(packages).filter(Boolean);
  const result = {
    schemaVersion: WEBR_RUNNER_SCHEMA_VERSION,
    runtime: "webr",
    available: false,
    packages: {},
    missing: [...requested],
    checkedIndexes: [],
    errors: [],
  };

  if (requested.length === 0) {
    result.available = true;
    result.missing = [];
    return result;
  }

  if (typeof fetch === "undefined") {
    result.errors.push("fetch is not available in this runtime.");
    return result;
  }

  const pending = new Set(requested);
  for (const url of webRPackageIndexUrls(options)) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      result.checkedIndexes.push({ url, status: response.status });
      if (!response.ok) {
        continue;
      }
      const index = parsePackageIndex(await response.text(), url);
      for (const packageName of [...pending]) {
        const found = index.get(packageName);
        if (found) {
          result.packages[packageName] = {
            available: true,
            version: found.version,
            repository: found.repository,
          };
          pending.delete(packageName);
        }
      }
      if (pending.size === 0) {
        break;
      }
    } catch (error) {
      result.checkedIndexes.push({ url, status: "error" });
      result.errors.push(error?.message || String(error));
    }
  }

  for (const packageName of requested) {
    if (!result.packages[packageName]) {
      result.packages[packageName] = {
        available: false,
        version: null,
        repository: null,
      };
    }
  }
  result.missing = [...pending];
  result.available = result.missing.length === 0;
  return result;
}

async function ensureWebRDirectory(webR, path) {
  const directory = dirname(path);
  if (!directory || directory === "/") {
    return;
  }
  const parts = directory.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    try {
      await webR.FS.mkdir(current);
    } catch (_error) {
      // mkdir throws when the directory already exists; that is fine here.
    }
  }
}

async function writeWebRInputFile(webR, file) {
  const path = normalizePath(file.path);
  if (!path || path === "/") {
    throw new Error("webR input files require a concrete virtual filesystem path.");
  }
  await ensureWebRDirectory(webR, path);
  let bytes;
  if (file.bytes instanceof Uint8Array) {
    bytes = file.bytes;
  } else if (file.base64 !== undefined && typeof atob === "function") {
    const binary = atob(file.base64);
    bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
  } else {
    bytes = new TextEncoder().encode(String(file.text ?? file.content ?? ""));
  }
  await webR.FS.writeFile(path, bytes);
}

async function readWebROutputFile(webR, path, encoding = "auto") {
  const normalized = normalizePath(path);
  const textLike =
    encoding === "text" ||
    (encoding === "auto" && /\.(txt|tsv|csv|json|md|html|xml|log|r)$/i.test(normalized));
  const bytes = await webR.FS.readFile(normalized);
  if (textLike) {
    return {
      path: normalized,
      encoding: "text",
      text: new TextDecoder().decode(bytes),
    };
  }
  return {
    path: normalized,
    encoding: "bytes",
    bytes,
  };
}

async function listWebRFiles(webR, directory) {
  const normalized = normalizePath(directory || "/");
  try {
    const result = await webR.evalRString(
      `paste(list.files(${JSON.stringify(normalized)}, recursive = TRUE, full.names = TRUE), collapse = "\\n")`
    );
    return String(result || "").split(/\n/).filter(Boolean);
  } catch (_error) {
    return [];
  }
}

function convertWebRResult(value) {
  if (value && typeof value.toJs === "function") {
    try {
      const converted = value.toJs();
      if (typeof value.destroy === "function") {
        value.destroy();
      }
      if (converted instanceof Map) {
        return Object.fromEntries(converted);
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

/**
 * Creates a reusable webR runner.
 *
 * @function createWebRRunner
 * @memberof runners
 * @param {Object} [options] - Runner options.
 * @returns {Object} Runner with run and terminate methods.
 */
function createWebRRunner({
  webRModuleURL = DEFAULT_WEBR_MODULE_URL,
  repositoryUrl = DEFAULT_WEBR_REPOSITORY_URL,
  timeoutMs = 120000,
  webROptions = {},
} = {}) {
  const runtime = detectWebRRuntime();
  if (!runtime.available) {
    throw new Error(
      `webR is not available in this runtime. Missing: ${runtime.missing.join(", ")}.`
    );
  }

  let webR = null;
  let webRModule = null;
  let terminated = false;
  const installedPackages = new Set();

  async function ensureWebR() {
    if (terminated) {
      throw new Error("Cannot run code on a terminated webR runner.");
    }
    if (webR) {
      return webR;
    }
    webRModule = await import(webRModuleURL);
    const options = { ...webROptions };
    if (
      options.channelType === undefined &&
      typeof crossOriginIsolated === "boolean" &&
      !crossOriginIsolated &&
      webRModule.ChannelType?.PostMessage !== undefined
    ) {
      options.channelType = webRModule.ChannelType.PostMessage;
    }
    webR = new webRModule.WebR(options);
    await webR.init();
    return webR;
  }

  async function installPackages(packages, options = {}) {
    const packageNames = normalizeArray(packages).filter(Boolean);
    const missing = packageNames.filter((packageName) => !installedPackages.has(packageName));
    if (missing.length === 0) {
      return;
    }
    const instance = await ensureWebR();
    await instance.installPackages(missing, {
      repos: options.repositoryUrl || repositoryUrl,
      quiet: options.quiet !== false,
      mount: options.mount !== false,
    });
    missing.forEach((packageName) => installedPackages.add(packageName));
  }

  async function runPayload(payload = {}) {
    const instance = await ensureWebR();
    await installPackages(payload.rPackages, payload);

    for (const file of normalizeArray(payload.files)) {
      await writeWebRInputFile(instance, file);
    }

    if (payload.inputJson !== undefined) {
      await instance.evalRVoid(
        `MSIG_INPUT_JSON <- ${JSON.stringify(JSON.stringify(payload.inputJson))}`
      );
    }

    let result = null;
    if (payload.r) {
      result = convertWebRResult(await instance.evalR(String(payload.r)));
    }
    if (payload.resultR) {
      result = await instance.evalRString(String(payload.resultR));
    }
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
      outputFiles.push(await readWebROutputFile(instance, filePath, payload.outputEncoding || "auto"));
    }
    for (const directory of normalizeArray(payload.outputDirectories)) {
      for (const filePath of await listWebRFiles(instance, directory)) {
        outputFiles.push(await readWebROutputFile(instance, filePath, payload.outputEncoding || "auto"));
      }
    }

    return {
      result: parsedResult,
      files: outputFiles,
      installedWebRPackages: Array.from(installedPackages),
      webRVersion: instance.version || null,
      webRVersionR: instance.versionR || null,
    };
  }

  async function run(payload = {}) {
    const startedAt = now();
    const effectiveTimeoutMs = payload.timeoutMs || timeoutMs;
    let timeoutHandle = null;
    return await Promise.race([
      runPayload(payload).then((output) => ({
        schemaVersion: WEBR_RUNNER_SCHEMA_VERSION,
        runtime: "webr",
        elapsedMs: now() - startedAt,
        ...output,
      })),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(async () => {
          try {
            await terminate();
          } catch (_error) {
            // Best effort cleanup.
          }
          reject(new Error(`webR run exceeded ${effectiveTimeoutMs} ms and the runtime was closed.`));
        }, effectiveTimeoutMs);
      }),
    ]).finally(() => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    });
  }

  async function terminate() {
    terminated = true;
    if (webR) {
      if (typeof webR.close === "function") {
        await webR.close();
      } else if (typeof webR.destroy === "function") {
        await webR.destroy();
      }
    }
    webR = null;
  }

  return {
    schemaVersion: WEBR_RUNNER_SCHEMA_VERSION,
    runtime: "webr",
    webRModuleURL,
    repositoryUrl,
    run,
    terminate,
  };
}

/**
 * Runs one webR job in a temporary runtime.
 *
 * @async
 * @function runWebR
 * @memberof runners
 * @param {Object} payload - R code, packages, files, and output collection options.
 * @param {Object} [options] - Runner construction options.
 * @returns {Promise<Object>} Result, collected files, package metadata, and elapsed time.
 */
async function runWebR(payload, options = {}) {
  const runner = createWebRRunner(options);
  try {
    return await runner.run(payload);
  } finally {
    await runner.terminate();
  }
}

export {
  DEFAULT_PYODIDE_INDEX_URL,
  DEFAULT_WEBR_BINARY_R_VERSION,
  DEFAULT_WEBR_MODULE_URL,
  DEFAULT_WEBR_REPOSITORY_URL,
  PYODIDE_RUNNER_SCHEMA_VERSION,
  WEBR_RUNNER_SCHEMA_VERSION,
  checkWebRPackageAvailability,
  createPyodideWorkerRunner,
  createPyodideWorkerSource,
  createWebRRunner,
  detectPyodideRuntime,
  detectWebRRuntime,
  runPython,
  runPyodide,
  runWebR,
};
