import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../../..");
const python = process.env.MSIG_E9_PYTHON || path.join(ROOT, ".tools/e2-python/Scripts/python.exe");
const script = path.join(HERE, "prepare_sigprofiler_references.py");
const volume = process.env.MSIG_E9_SPM_VOLUME || path.join(ROOT, ".tools/spm-references");
const progress = path.join(ROOT, "docs/manuscript/experiments/e9_maf_conversion_validation/data/maf-conversion-reference-progress.json");

const child = spawn(python, [script, "--volume", volume, "--progress", progress], {
  cwd: ROOT,
  windowsHide: true,
  env: { ...process.env, SIGPROFILERMATRIXGENERATOR_VOLUME: volume },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("close", (code) => {
  process.exitCode = code ?? 1;
});
