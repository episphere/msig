import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { verifyBundledWebRRepository } from "../mSigSDKScripts/runners.js";

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function verifyPyodideManifest() {
  const baseUrl = new URL("../docs/package-repos/pyodide/", import.meta.url);
  const manifestUrl = new URL("manifest.json", baseUrl);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const verified = [];

  for (const entry of manifest.packages || []) {
    if (entry.available === false) {
      continue;
    }
    if (!entry.filename || !entry.sha256) {
      throw new Error(`Pyodide manifest entry for ${entry.package || "unknown"} is missing filename or sha256.`);
    }
    const actual = await sha256(new URL(entry.filename, baseUrl));
    const expected = String(entry.sha256).toLowerCase();
    if (actual !== expected) {
      throw new Error(
        `Pyodide SHA-256 mismatch for ${entry.filename}: expected ${expected}, got ${actual}.`
      );
    }
    verified.push(entry.filename);
  }

  return verified;
}

const pyodideArtifacts = await verifyPyodideManifest();
const webRResult = await verifyBundledWebRRepository(
  new URL("../docs/package-repos/webr/", import.meta.url).href
);

console.log(
  JSON.stringify(
    {
      status: "ok",
      pyodideArtifactsVerified: pyodideArtifacts.length,
      webRRepositoryVerified: webRResult.verified,
      webRArtifactsVerified: webRResult.packages?.length || 0,
    },
    null,
    2
  )
);
