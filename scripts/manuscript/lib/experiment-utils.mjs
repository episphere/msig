import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import os from "node:os";

const THIS_FILE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(THIS_FILE), "../../..");
export const MANUSCRIPT_ROOT = path.join(REPO_ROOT, "docs", "manuscript");
export const EXPERIMENT_ROOT = path.join(MANUSCRIPT_ROOT, "experiments");
export const FIGURE_ROOT = path.join(MANUSCRIPT_ROOT, "figures");
export const TABLE_ROOT = path.join(MANUSCRIPT_ROOT, "google-doc-tables");
export const ASSET_ROOT = path.join(MANUSCRIPT_ROOT, "assets");
export const SCHEMA_VERSION = "msig.manuscript.experiment.v1";

export const EXPERIMENTS = Object.freeze({
  e1: {
    id: "e1_zero_install_demo",
    label: "E1 Zero-install demonstration",
    dir: path.join(EXPERIMENT_ROOT, "e1_zero_install_demo"),
  },
  e2: {
    id: "e2_adapter_fidelity",
    label: "E2 Adapter fidelity",
    dir: path.join(EXPERIMENT_ROOT, "e2_adapter_fidelity"),
  },
  e3: {
    id: "e3_internal_reference_checks",
    label: "E3 Internal solver/reference checks",
    dir: path.join(EXPERIMENT_ROOT, "e3_internal_reference_checks"),
  },
  e4: {
    id: "e4_browser_runtime_benchmarks",
    label: "E4 Browser runtime benchmarks",
    dir: path.join(EXPERIMENT_ROOT, "e4_browser_runtime_benchmarks"),
  },
  e6: {
    id: "e6_cross_browser_compatibility",
    label: "E6 Cross-browser/platform compatibility",
    dir: path.join(EXPERIMENT_ROOT, "e6_cross_browser_compatibility"),
  },
});

export function nowIso() {
  return new Date().toISOString();
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (fallback !== null) return fallback;
    throw error;
  }
}

export async function writeText(filePath, text) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, String(text), "utf8");
}

export async function writeCsv(filePath, rows) {
  const arrayRows = Array.isArray(rows) ? rows : [];
  const columns = [
    ...new Set(arrayRows.flatMap((row) => Object.keys(row || {}))),
  ];
  const lines = [
    columns.join(","),
    ...arrayRows.map((row) =>
      columns.map((column) => csvCell(row?.[column])).join(",")
    ),
  ];
  await writeText(filePath, `${lines.join("\n")}\n`);
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function relativeArtifact(filePath) {
  return path.relative(REPO_ROOT, filePath).replaceAll(path.sep, "/");
}

export function createResult({
  experimentId,
  environment,
  inputs,
  rows,
  artifacts = {},
  status = "completed",
  notes = [],
}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: nowIso(),
    experimentId,
    environment,
    inputs,
    rows,
    artifacts,
    status,
    notes,
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const stripped = arg.slice(2);
    const eq = stripped.indexOf("=");
    if (eq >= 0) {
      options[stripped.slice(0, eq)] = stripped.slice(eq + 1);
    } else {
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        options[stripped] = next;
        index += 1;
      } else {
        options[stripped] = true;
      }
    }
  }
  return options;
}

export function numericArg(options, key, fallback) {
  const value = Number(options[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function boolArg(options, key, fallback = false) {
  if (options[key] === undefined) return fallback;
  if (options[key] === true) return true;
  return !["0", "false", "no", "off"].includes(String(options[key]).toLowerCase());
}

export function environmentSummary(extra = {}) {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    cpus: os.cpus()?.length || null,
    memoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    cwd: REPO_ROOT,
    ...extra,
  };
}

export function seededRandom(seed = 123) {
  let state = Math.floor(seed) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export function median(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2
    ? finite[mid]
    : (finite[mid - 1] + finite[mid]) / 2;
}

export function mean(values) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return null;
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

export function vectorCosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = Number(left[index]) || 0;
    const b = Number(right[index]) || 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator === 0 ? 0 : dot / denominator;
}

export function rmse(left, right) {
  const n = Math.max(left.length, right.length);
  if (n === 0) return 0;
  let total = 0;
  for (let index = 0; index < n; index += 1) {
    const delta = (Number(left[index]) || 0) - (Number(right[index]) || 0);
    total += delta * delta;
  }
  return Math.sqrt(total / n);
}

export function mae(left, right) {
  const n = Math.max(left.length, right.length);
  if (n === 0) return 0;
  let total = 0;
  for (let index = 0; index < n; index += 1) {
    total += Math.abs((Number(left[index]) || 0) - (Number(right[index]) || 0));
  }
  return total / n;
}

export function l1(left, right) {
  let total = 0;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    total += Math.abs((Number(left[index]) || 0) - (Number(right[index]) || 0));
  }
  return total;
}

export function l2(left, right) {
  let total = 0;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (Number(left[index]) || 0) - (Number(right[index]) || 0);
    total += delta * delta;
  }
  return Math.sqrt(total);
}

export function maxAbsDiff(left, right) {
  let max = 0;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    max = Math.max(
      max,
      Math.abs((Number(left[index]) || 0) - (Number(right[index]) || 0))
    );
  }
  return max;
}

export function normalizeExposureRows(exposures) {
  const normalized = {};
  for (const [sample, row] of Object.entries(exposures || {})) {
    const total = Object.values(row || {}).reduce(
      (sum, value) => sum + Math.max(0, Number(value) || 0),
      0
    );
    normalized[sample] = {};
    for (const [signature, value] of Object.entries(row || {})) {
      normalized[sample][signature] =
        total > 0 ? Math.max(0, Number(value) || 0) / total : 0;
    }
  }
  return normalized;
}

export function compareExposureMatrices(browserExposures, localExposures) {
  const browser = normalizeExposureRows(browserExposures);
  const local = normalizeExposureRows(localExposures);
  const samples = Object.keys(browser).filter((sample) => local[sample]);
  const signatures = [
    ...new Set(
      samples.flatMap((sample) => [
        ...Object.keys(browser[sample] || {}),
        ...Object.keys(local[sample] || {}),
      ])
    ),
  ].sort();
  const cosines = [];
  const rmses = [];
  const absDiffs = [];
  let topMatches = 0;
  for (const sample of samples) {
    const browserVector = signatures.map((signature) => browser[sample]?.[signature] || 0);
    const localVector = signatures.map((signature) => local[sample]?.[signature] || 0);
    cosines.push(vectorCosine(browserVector, localVector));
    rmses.push(rmse(browserVector, localVector));
    absDiffs.push(maxAbsDiff(browserVector, localVector));
    const browserTop = signatures.reduce(
      (best, signature) =>
        (browser[sample]?.[signature] || 0) > (browser[sample]?.[best] || 0)
          ? signature
          : best,
      signatures[0]
    );
    const localTop = signatures.reduce(
      (best, signature) =>
        (local[sample]?.[signature] || 0) > (local[sample]?.[best] || 0)
          ? signature
          : best,
      signatures[0]
    );
    if (browserTop === localTop) topMatches += 1;
  }
  return {
    sampleCount: samples.length,
    signatureCount: signatures.length,
    meanExposureCosine: mean(cosines),
    medianExposureCosine: median(cosines),
    minExposureCosine: cosines.length ? Math.min(...cosines) : null,
    maxAbsoluteExposureDifference: absDiffs.length ? Math.max(...absDiffs) : null,
    rmse: mean(rmses),
    topSignatureConcordance: samples.length ? topMatches / samples.length : null,
  };
}

export async function removeSafe(targets) {
  const root = path.resolve(REPO_ROOT);
  for (const target of targets) {
    const absolute = path.resolve(REPO_ROOT, target);
    if (!absolute.toLowerCase().startsWith(root.toLowerCase())) {
      throw new Error(`Refusing to remove path outside repository: ${absolute}`);
    }
    if (existsSync(absolute)) {
      await rm(absolute, { recursive: true, force: true });
    }
  }
}

export function runCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: options.cwd || REPO_ROOT,
      shell: false,
      env: { ...process.env, ...(options.env || {}) },
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      if (options.stream) process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
      if (options.stream) process.stderr.write(chunk);
    });
    child.on("error", (error) => {
      resolve({
        status: "error",
        code: null,
        error: error.message,
        stdout,
        stderr,
        elapsedMs: Date.now() - startedAt,
      });
    });
    child.on("close", (code) => {
      resolve({
        status: code === 0 ? "completed" : "failed",
        code,
        stdout,
        stderr,
        elapsedMs: Date.now() - startedAt,
      });
    });
  });
}

export async function copyD3Asset() {
  const source = path.join(REPO_ROOT, "node_modules", "d3", "dist", "d3.min.js");
  const target = path.join(ASSET_ROOT, "d3.min.js");
  await ensureDir(ASSET_ROOT);
  if (existsSync(source)) {
    await writeFile(target, await readFile(source));
    return target;
  }
  const response = await fetch("https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js");
  if (!response.ok) {
    throw new Error(`Unable to download d3.min.js: ${response.status}`);
  }
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return target;
}

export async function withStaticServer(rootDir, callback) {
  const root = path.resolve(rootDir);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      let requestedPath = decodeURIComponent(url.pathname);
      if (requestedPath === "/") requestedPath = "/index.html";
      const absolute = path.resolve(root, requestedPath.slice(1));
      if (!absolute.toLowerCase().startsWith(root.toLowerCase())) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const fileStat = await stat(absolute);
      const filePath = fileStat.isDirectory()
        ? path.join(absolute, "index.html")
        : absolute;
      response.writeHead(200, {
        "Content-Type": mimeType(filePath),
        "Cache-Control": "no-store",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "credentialless",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(await readFile(filePath));
    } catch (_error) {
      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await callback({ baseUrl, server });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".wasm": "application/wasm",
      ".whl": "application/octet-stream",
      ".tgz": "application/gzip",
    }[ext] || "application/octet-stream"
  );
}

export function tempDir(prefix) {
  return path.join(REPO_ROOT, ".tmp", `${prefix}-${Date.now()}`);
}

export function pathToLocalUrl(filePath) {
  return pathToFileURL(path.resolve(filePath)).href;
}

export function browserCandidates() {
  const candidates = [];
  const programFiles = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.LOCALAPPDATA,
  ].filter(Boolean);
  const add = (id, label, engine, relativePaths) => {
    for (const base of programFiles) {
      for (const relativePath of relativePaths) {
        candidates.push({
          id,
          label,
          engine,
          executablePath: path.join(base, relativePath),
        });
      }
    }
  };
  add("chrome", "Chrome", "chromium", [
    path.join("Google", "Chrome", "Application", "chrome.exe"),
  ]);
  add("edge", "Edge", "chromium", [
    path.join("Microsoft", "Edge", "Application", "msedge.exe"),
  ]);
  add("firefox", "Firefox", "firefox", [
    path.join("Mozilla Firefox", "firefox.exe"),
  ]);
  return candidates;
}

export async function findAvailableBrowsers() {
  const seen = new Set();
  const browsers = [];
  for (const candidate of browserCandidates()) {
    const key = `${candidate.id}:${candidate.executablePath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (existsSync(candidate.executablePath)) {
      browsers.push(candidate);
      if (["chrome", "edge", "firefox"].filter((id) => browsers.some((b) => b.id === id)).length === 3) {
        break;
      }
    }
  }
  return browsers;
}

export function unavailableBrowserRows(availableBrowsers, scenarios, extra = {}) {
  const available = new Set(availableBrowsers.map((browser) => browser.id));
  return ["chrome", "edge", "firefox"]
    .filter((id) => !available.has(id))
    .flatMap((id) =>
      scenarios.map((scenario) => ({
        browser: id,
        scenario,
        status: "not available",
        ...extra,
      }))
    );
}

export async function loadPlaywright() {
  try {
    return await import("playwright-core");
  } catch (error) {
    throw new Error(
      `playwright-core is required for browser experiments. Run npm install first. ${error.message}`
    );
  }
}

export async function launchBrowser(browser, options = {}) {
  const playwright = await loadPlaywright();
  const type = browser.engine === "firefox" ? playwright.firefox : playwright.chromium;
  const userDataDir = options.userDataDir || tempDir(`${browser.id}-profile`);
  await ensureDir(userDataDir);
  let executablePath = browser.executablePath;
  if (browser.engine === "firefox") {
    const managedFirefox = type.executablePath?.();
    if (managedFirefox && existsSync(managedFirefox)) {
      executablePath = managedFirefox;
    }
  }
  const launchOptions = {
    executablePath,
    headless: options.headless !== false,
    viewport: options.viewport || { width: 1440, height: 1000 },
    ignoreHTTPSErrors: true,
  };
  if (browser.engine === "chromium") {
    launchOptions.args = [
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate",
    ];
  }
  const context = await type.launchPersistentContext(userDataDir, launchOptions);
  await context.route("**/*", (route) => route.continue());
  return context;
}
