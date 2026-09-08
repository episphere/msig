import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const ROOT = process.cwd();
const EXPERIMENT_DIR = path.join(
  ROOT,
  "docs",
  "manuscript",
  "experiments",
  "e7_four_tool_comparison"
);
const DATA_DIR = path.join(EXPERIMENT_DIR, "data");
const RUNNER = path.join(
  ROOT,
  "docs",
  "manuscript",
  "experiments",
  "e2_adapter_fidelity",
  "code",
  "run-adapter-fidelity.mjs"
);
const TOOLS = ["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"];

const args = parseArgs(process.argv.slice(2));
const chunkSize = positiveInteger(args["chunk-size"] || 300, "chunk-size");
const concurrency = positiveInteger(args.concurrency || 3, "concurrency");
const attempts = positiveInteger(args.attempts || 2, "attempts");
const runTag = String(args["run-tag"] || "published_full_local_py3_v2");
const noiseLevels = String(args["noise-levels"] || "0,5,10")
  .split(",")
  .map((value) => Number(value.trim()));
const localPython = path.resolve(
  args["local-python"] || path.join(ROOT, ".tmp", "e7-python", "Scripts", "python.exe")
);
const localRscript = args["local-rscript"] || "Rscript";
const rLibrary = path.resolve(
  args["r-library"] || path.join(ROOT, ".tools", "r-library", "R-4.6")
);

for (const noise of noiseLevels) {
  if (![0, 5, 10].includes(noise)) {
    throw new Error(`Unsupported archived noise level: ${noise}`);
  }
}

for (const noise of noiseLevels) {
  await runNoiseLevel(noise);
}

async function runNoiseLevel(noise) {
  const suffix = noise === 0 ? "" : `-noise${noise}`;
  const inputPath = path.join(DATA_DIR, `published-sbs-input${suffix}.json`);
  const source = JSON.parse(await readFile(inputPath, "utf8"));
  const outputDir = path.join(EXPERIMENT_DIR, `${runTag}_noise${noise}`);
  const chunksDir = path.join(outputDir, "chunks");
  const progressPath = path.join(outputDir, "full-benchmark-progress.json");
  await mkdir(chunksDir, { recursive: true });

  const chunkCount = Math.ceil(source.sampleNames.length / chunkSize);
  await checkpoint(progressPath, {
    status: "running",
    noise,
    sampleCount: source.sampleNames.length,
    chunkSize,
    chunkCount,
  });

  await runPool([...Array(chunkCount).keys()], concurrency, async (index) => {
    const first = index * chunkSize;
    const sampleNames = source.sampleNames.slice(first, first + chunkSize);
    const chunkName = `chunk-${String(index + 1).padStart(3, "0")}`;
    const chunkDir = path.join(chunksDir, chunkName);
    const chunkInputPath = path.join(chunkDir, "input.json");
    const exposurePath = path.join(chunkDir, "data", "adapter-exposure-matrices.json");
    await mkdir(chunkDir, { recursive: true });

    if (await validExposureFile(exposurePath, sampleNames)) {
      console.log(`[noise ${noise}] ${chunkName}/${chunkCount} already complete`);
      return;
    }

    const spectra = Object.fromEntries(sampleNames.map((sample) => [sample, source.spectra[sample]]));
    await writeJson(chunkInputPath, { ...source, sampleNames, spectra });
    await checkpoint(progressPath, {
      status: "running",
      noise,
      sampleCount: source.sampleNames.length,
      chunkSize,
      chunkCount,
      activeChunk: index + 1,
      activeChunkSamples: sampleNames.length,
      concurrency,
    });
    console.log(`[noise ${noise}] running ${chunkName}/${chunkCount} (${sampleNames.length} samples)`);

    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await run(process.execPath, [
          RUNNER,
          "--skip-browser=true",
          `--input-file=${chunkInputPath}`,
          `--output-dir=${chunkDir}`,
          `--experiment-id=e7_${runTag}_noise${noise}_${chunkName}`,
          `--local-python=${localPython}`,
          `--local-rscript=${localRscript}`,
          `--r-library=${rLibrary}`,
        ]);
      } catch (error) {
        lastError = error;
      }
      if (await validExposureFile(exposurePath, sampleNames)) break;
      if (attempt < attempts) console.warn(`[noise ${noise}] retrying ${chunkName} after attempt ${attempt}`);
    }

    if (!(await validExposureFile(exposurePath, sampleNames))) {
      throw new Error(`Chunk did not produce complete four-tool exposures: ${exposurePath}; ${lastError?.message || "unknown runner failure"}`);
    }
  });

  const mergedTools = Object.fromEntries(TOOLS.map((tool) => [tool, {}]));
  for (let index = 0; index < chunkCount; index += 1) {
    const chunkName = `chunk-${String(index + 1).padStart(3, "0")}`;
    const exposurePath = path.join(chunksDir, chunkName, "data", "adapter-exposure-matrices.json");
    const chunk = JSON.parse(await readFile(exposurePath, "utf8"));
    for (const tool of TOOLS) Object.assign(mergedTools[tool], chunk.tools[tool]);
  }

  for (const tool of TOOLS) {
    const names = Object.keys(mergedTools[tool]);
    if (names.length !== source.sampleNames.length || source.sampleNames.some((sample) => !(sample in mergedTools[tool]))) {
      throw new Error(`Merged ${tool} output is incomplete for noise ${noise}: ${names.length}/${source.sampleNames.length}`);
    }
  }

  const mergedPath = path.join(outputDir, "data", "adapter-exposure-matrices.json");
  await writeJson(mergedPath, {
    schemaVersion: "msig.manuscript.e7.full-exposure-matrices.v1",
    generatedAt: new Date().toISOString(),
    experimentId: `e7_${runTag}_noise${noise}`,
    source: "merged resumable local chunks",
    sampleCount: source.sampleNames.length,
    chunkSize,
    chunkCount,
    concurrency,
    tools: mergedTools,
  });
  await checkpoint(progressPath, {
    status: "completed",
    noise,
    sampleCount: source.sampleNames.length,
    chunkSize,
    chunkCount,
    mergedExposurePath: path.relative(ROOT, mergedPath).replaceAll("\\", "/"),
  });
  console.log(`[noise ${noise}] completed ${source.sampleNames.length} samples`);
}

async function validExposureFile(filePath, expectedSamples) {
  try {
    const result = JSON.parse(await readFile(filePath, "utf8"));
    return TOOLS.every((tool) => {
      const exposures = result.tools?.[tool];
      return exposures && Object.keys(exposures).length === expectedSamples.length && expectedSamples.every((sample) => sample in exposures);
    });
  } catch {
    return false;
  }
}

async function checkpoint(filePath, details) {
  await writeJson(filePath, {
    schemaVersion: "msig.manuscript.e7.full-progress.v1",
    updatedAt: new Date().toISOString(),
    ...details,
  });
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function runPool(items, limit, worker) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  });
  const settled = await Promise.allSettled(workers);
  const failures = settled.filter((result) => result.status === "rejected");
  if (failures.length) {
    throw new AggregateError(failures.map((result) => result.reason), `${failures.length} benchmark worker(s) failed`);
  }
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: ROOT,
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        OMP_NUM_THREADS: "1",
        OPENBLAS_NUM_THREADS: "1",
        MKL_NUM_THREADS: "1",
        NUMEXPR_NUM_THREADS: "1",
      },
    });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Command failed with exit code ${code}`)));
  });
}

function parseArgs(values) {
  return Object.fromEntries(values.filter((value) => value.startsWith("--")).map((value) => {
    const [key, ...rest] = value.slice(2).split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }));
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}
