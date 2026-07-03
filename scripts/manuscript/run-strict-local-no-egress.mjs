import { spawn } from "node:child_process";
import path from "node:path";

import {
  ensureDir,
  environmentSummary,
  relativeArtifact,
  writeCsv,
  writeJson,
} from "./lib/experiment-utils.mjs";

const OUTPUT_DIR = path.join("docs", "manuscript", "experiments", "strict_local_no_egress", "data");
const JSON_PATH = path.join(OUTPUT_DIR, "strict-local-no-egress.json");
const CSV_PATH = path.join(OUTPUT_DIR, "strict_local_network_log.csv");

await ensureDir(OUTPUT_DIR);
const smoke = await runNode(["scripts/smoke-strict-local.mjs"]);
if (smoke.code !== 0) {
  throw new Error(`strict-local smoke failed:\n${smoke.stderr || smoke.stdout}`);
}
const parsed = JSON.parse(smoke.stdout.slice(smoke.stdout.indexOf("{")));
const result = {
  schemaVersion: "msig.strict_local_no_egress.v1",
  generatedAt: new Date().toISOString(),
  environment: environmentSummary({
    command: "node scripts/smoke-strict-local.mjs",
  }),
  workflow: "strictLocal fit + QC + NMF + report + bundled-context MAF conversion",
  status: parsed.status,
  strictLocal: parsed.strictLocal,
  networkRequests: parsed.networkRequests,
  networkLog: parsed.networkLog,
  blockedPaths: parsed.blockedPaths,
  sourceSmoke: parsed,
};

await writeJson(JSON_PATH, result);
await writeCsv(CSV_PATH, parsed.networkLog || []);
console.log(`Wrote ${relativeArtifact(JSON_PATH)}`);
console.log(`Wrote ${relativeArtifact(CSV_PATH)}`);

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (error) => resolve({ code: -1, stdout, stderr: error.message }));
  });
}
