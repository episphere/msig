#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import * as adapterModule from "../mSigSDKScripts/adapters.js";
import {
  PACKAGE_RUNTIME_MANIFEST,
  listPackageRuntimes,
} from "../mSigSDKScripts/packageRuntimes.js";

const ROOT = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (_error) {
    return false;
  }
}

async function assertTextDoesNotExposeFallbacks(path) {
  const text = await readFile(path, "utf8");
  const banned = [
    "runSparseNnlsRefit",
    "browser_nmf",
    "browser_fallback",
    "sourceArchiveExecution",
  ];
  for (const token of banned) {
    assert(!text.includes(token), `${path} exposes removed fallback token: ${token}`);
  }
}

async function main() {
  const adapterPath = join(ROOT, "mSigSDKScripts", "adapters.js");
  const mainPath = join(ROOT, "main.js");
  await assertTextDoesNotExposeFallbacks(adapterPath);
  await assertTextDoesNotExposeFallbacks(mainPath);

  assert(!("runSparseNnlsRefit" in adapterModule), "runSparseNnlsRefit is still exported");
  assert(typeof adapterModule.runMuSiCalRefit === "function", "runMuSiCalRefit is not exported");
  assert(typeof adapterModule.runDeconstructSigsWebR === "function", "runDeconstructSigsWebR is not exported");
  assert(typeof adapterModule.runSigminerWebR === "function", "runSigminerWebR is not exported");
  assert(typeof adapterModule.runSigProfilerAssignment === "function", "runSigProfilerAssignment is not exported");

  const expectedTools = ["deconstructSigs", "sigminer", "sigProfilerAssignment", "musical"];
  const runtimes = listPackageRuntimes();
  for (const tool of expectedTools) {
    const runtime = PACKAGE_RUNTIME_MANIFEST.tools?.[tool];
    assert(runtime, `Missing package runtime manifest for ${tool}`);
    assert(runtime.exactPackageExecutionRequired === true, `${tool} manifest must require exact package execution`);
    assert(["webr", "pyodide"].includes(runtime.runtime), `${tool} must use WebR or Pyodide`);
    assert(runtimes.some((entry) => PACKAGE_RUNTIME_MANIFEST.tools?.[tool] === entry), `${tool} not returned by listPackageRuntimes()`);
  }

  let musicalRejected = false;
  try {
    await adapterModule.runMuSiCalRefit(
      { spectra: { sample: { A: 1 } }, signatures: { SBS1: { A: 1 } } },
      { contexts: ["A"], runtime: "node" }
    );
  } catch (error) {
    musicalRejected = /Exact MuSiCal adapter execution requires runtime "pyodide"/.test(error.message);
  }
  assert(musicalRejected, "MuSiCal adapter did not reject non-Pyodide runtime with exact-package error");

  const pyodideManifestPath = join(ROOT, "docs", "package-repos", "pyodide", "manifest.json");
  const webRManifestPath = join(ROOT, "docs", "package-repos", "webr", "manifest.json");
  assert(await exists(pyodideManifestPath), "Missing Pyodide package repository manifest");
  assert(await exists(webRManifestPath), "Missing WebR package repository manifest");
  const pyodideManifest = JSON.parse(await readFile(pyodideManifestPath, "utf8"));
  const webRManifest = JSON.parse(await readFile(webRManifestPath, "utf8"));
  assert(pyodideManifest.packages?.some((entry) => entry.package === "musical"), "Pyodide manifest missing MuSiCal");
  assert(
    pyodideManifest.packages?.some((entry) => entry.package === "SigProfilerAssignment"),
    "Pyodide manifest missing SigProfilerAssignment"
  );
  assert(webRManifest.packages?.some((entry) => entry.package === "deconstructSigs"), "WebR manifest missing deconstructSigs");
  assert(webRManifest.packages?.some((entry) => entry.package === "sigminer"), "WebR manifest missing sigminer");

  console.log(JSON.stringify({
    status: "passed",
    exactPackageTools: expectedTools,
    pyodideManifest: pyodideManifestPath,
    webRManifest: webRManifestPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
