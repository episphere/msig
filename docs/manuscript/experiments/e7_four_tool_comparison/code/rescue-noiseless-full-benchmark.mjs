import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = process.cwd();
const experimentDir = path.join(root, "docs", "manuscript", "experiments", "e7_four_tool_comparison");
const runner = path.join(root, "docs", "manuscript", "experiments", "e2_adapter_fidelity", "code", "run-adapter-fidelity.mjs");
const input = JSON.parse(await readFile(path.join(experimentDir, "data", "published-sbs-input.json"), "utf8"));
const targetDir = path.join(experimentDir, "published_full_local_py3_v2_noise0");
const rescueDir = path.join(experimentDir, "published_full_local_py3_v2_noise0_rescue60");
const python = path.join(root, ".tmp", "e7-python", "Scripts", "python.exe");
const rLibrary = path.join(root, ".tools", "r-library", "R-4.6");
const tools = ["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"];
const parentIndices = [0, 1, 2, 3, 8];
const partSize = 60;

const tasks = parentIndices.flatMap((parentIndex) => {
  const parentSamples = input.sampleNames.slice(parentIndex * 300, parentIndex * 300 + 300);
  return Array.from({ length: 5 }, (_, partIndex) => ({
    parentIndex,
    partIndex,
    samples: parentSamples.slice(partIndex * partSize, (partIndex + 1) * partSize),
  }));
});

await Promise.all(tasks.map(runPart));

for (const parentIndex of parentIndices) {
  const merged = Object.fromEntries(tools.map((tool) => [tool, {}]));
  for (let partIndex = 0; partIndex < 5; partIndex += 1) {
    const part = JSON.parse(await readFile(exposurePath(parentIndex, partIndex), "utf8"));
    for (const tool of tools) Object.assign(merged[tool], part.tools[tool]);
  }
  const expected = input.sampleNames.slice(parentIndex * 300, parentIndex * 300 + 300);
  if (!tools.every((tool) => Object.keys(merged[tool]).length === expected.length && expected.every((sample) => sample in merged[tool]))) {
    throw new Error(`Rescue merge incomplete for parent chunk ${parentIndex + 1}`);
  }
  const target = path.join(targetDir, "chunks", chunkName(parentIndex), "data", "adapter-exposure-matrices.json");
  await writeJson(target, {
    schemaVersion: "msig.manuscript.e7.rescued-exposure-matrices.v1",
    generatedAt: new Date().toISOString(),
    experimentId: `e7_published_full_local_py3_v2_noise0_${chunkName(parentIndex)}_rescue60`,
    source: "merged from five process-unique 60-sample local-runtime partitions",
    tools: merged,
  });
  console.log(`rescued ${chunkName(parentIndex)} (${expected.length} samples)`);
}

async function runPart(task) {
  const name = `${chunkName(task.parentIndex)}-part-${String(task.partIndex + 1).padStart(2, "0")}`;
  const outputDir = path.join(rescueDir, name);
  const inputPath = path.join(outputDir, "input.json");
  const resultPath = exposurePath(task.parentIndex, task.partIndex);
  if (await valid(resultPath, task.samples)) {
    console.log(`${name} already complete`);
    return;
  }
  await mkdir(outputDir, { recursive: true });
  await writeJson(inputPath, {
    ...input,
    sampleNames: task.samples,
    spectra: Object.fromEntries(task.samples.map((sample) => [sample, input.spectra[sample]])),
  });
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await run(process.execPath, [
        runner,
        "--skip-browser=true",
        `--input-file=${inputPath}`,
        `--output-dir=${outputDir}`,
        `--experiment-id=e7_noiseless_rescue_${name}`,
        `--local-python=${python}`,
        "--local-rscript=Rscript",
        `--r-library=${rLibrary}`,
      ]);
    } catch (error) {
      console.warn(`${name} attempt ${attempt} failed: ${error.message}`);
    }
    if (await valid(resultPath, task.samples)) return;
  }
  throw new Error(`${name} failed to produce complete four-tool exposures`);
}

function exposurePath(parentIndex, partIndex) {
  const name = `${chunkName(parentIndex)}-part-${String(partIndex + 1).padStart(2, "0")}`;
  return path.join(rescueDir, name, "data", "adapter-exposure-matrices.json");
}

function chunkName(index) {
  return `chunk-${String(index + 1).padStart(3, "0")}`;
}

async function valid(file, samples) {
  try {
    const artifact = JSON.parse(await readFile(file, "utf8"));
    return tools.every((tool) => artifact.tools?.[tool] && Object.keys(artifact.tools[tool]).length === samples.length && samples.every((sample) => sample in artifact.tools[tool]));
  } catch {
    return false;
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
      env: { ...process.env, OMP_NUM_THREADS: "1", OPENBLAS_NUM_THREADS: "1", MKL_NUM_THREADS: "1", NUMEXPR_NUM_THREADS: "1" },
    });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`exit code ${code}`)));
  });
}
