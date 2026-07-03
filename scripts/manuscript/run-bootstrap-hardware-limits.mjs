import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import {
  bootstrapCohortSignatureFitParallel,
  bootstrapSignatureFit,
  bootstrapSignatureFitParallel,
} from "../../mSigSDKScripts/qc.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const outDir = path.join(
  repoRoot,
  "docs/manuscript/experiments/hardware_scaling_characterization/data"
);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function syntheticInputs({
  contextCount = 96,
  signatureCount = 40,
  sampleCount = 120,
  seed = 20260627,
} = {}) {
  const random = seededRandom(seed);
  const contexts = Array.from({ length: contextCount }, (_, index) => `C${index}`);
  const signatures = {};
  for (let signatureIndex = 0; signatureIndex < signatureCount; signatureIndex++) {
    const weights = contexts.map(() => 0.2 + random());
    const total = weights.reduce((acc, value) => acc + value, 0);
    signatures[`S${signatureIndex + 1}`] = Object.fromEntries(
      contexts.map((context, contextIndex) => [
        context,
        weights[contextIndex] / total,
      ])
    );
  }

  const spectra = {};
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    const activeA = sampleIndex % signatureCount;
    const activeB = (sampleIndex * 7 + 3) % signatureCount;
    const burden = 500 + ((sampleIndex * 37) % 2500);
    const spectrum = {};
    for (const context of contexts) {
      const probability =
        0.7 * signatures[`S${activeA + 1}`][context] +
        0.3 * signatures[`S${activeB + 1}`][context];
      spectrum[context] = Math.max(0, Math.round(probability * burden));
    }
    spectra[`sample_${sampleIndex + 1}`] = spectrum;
  }
  return { contexts, signatures, spectra };
}

function bytesToMiB(bytes) {
  return bytes / 1024 / 1024;
}

function summarize(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { min: null, median: null, mean: null, max: null };
  }
  const median =
    sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return {
    min: sorted[0],
    median,
    mean: sorted.reduce((acc, value) => acc + value, 0) / sorted.length,
    max: sorted[sorted.length - 1],
  };
}

async function measureScenario(scenario) {
  const { contexts, signatures, spectra } = syntheticInputs(scenario);
  const memorySamples = [];
  const sampleMemory = () => {
    const memory = process.memoryUsage();
    memorySamples.push({
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
    });
  };
  sampleMemory();
  const timer = setInterval(sampleMemory, 25);
  const startedAt = performance.now();
  const sampleNames = Object.keys(spectra);
  let result;
  let workerMode;
  let workerCountUsed;
  let bootstrapSamples;
  if (scenario.sampleCount === 1) {
    const singleSampleOptions = {
      contexts,
      iterations: scenario.iterations,
      seed: scenario.seed ?? 20260627,
      parallel: scenario.parallel,
      workerCount: scenario.workerCount,
      minIterationsForParallel: scenario.minIterationsForParallel ?? 1,
    };
    result = scenario.parallel
      ? await bootstrapSignatureFitParallel(
          signatures,
          spectra[sampleNames[0]],
          singleSampleOptions
        )
      : await bootstrapSignatureFit(
          signatures,
          spectra[sampleNames[0]],
          singleSampleOptions
        );
    workerMode = result.parallelization?.mode ?? "serial";
    workerCountUsed = result.parallelization?.workerCount ?? 0;
    bootstrapSamples = 1;
  } else {
    result = await bootstrapCohortSignatureFitParallel(signatures, spectra, {
      contexts,
      iterations: scenario.iterations,
      seed: scenario.seed ?? 20260627,
      parallel: scenario.parallel,
      workerCount: scenario.workerCount,
      minIterationsForParallel: scenario.minIterationsForParallel ?? 1,
    });
    workerMode = result.parallelization.mode;
    workerCountUsed = result.parallelization.workerCount;
    bootstrapSamples = Object.keys(result.results).length;
  }
  const elapsedMs = performance.now() - startedAt;
  clearInterval(timer);
  sampleMemory();

  const peakRssBytes = Math.max(...memorySamples.map((sample) => sample.rssBytes));
  const peakHeapUsedBytes = Math.max(
    ...memorySamples.map((sample) => sample.heapUsedBytes)
  );
  return {
    scenarioId: scenario.id,
    sampleCount: scenario.sampleCount,
    signatureCount: scenario.signatureCount,
    contextCount: scenario.contextCount,
    iterationsPerSample: scenario.iterations,
    totalBootstrapFits: scenario.sampleCount * scenario.iterations,
    parallel: scenario.parallel,
    workerCountRequested: scenario.workerCount,
    workerMode,
    workerCountUsed,
    elapsedMs,
    fitsPerSecond: (scenario.sampleCount * scenario.iterations) / (elapsedMs / 1000),
    peakRssMiB: bytesToMiB(peakRssBytes),
    peakHeapUsedMiB: bytesToMiB(peakHeapUsedBytes),
    bootstrapSamples,
  };
}

async function runChild(args) {
  const scenario = {
    id: args.id || "child",
    sampleCount: Number(args.samples || 1),
    signatureCount: Number(args.signatures || 40),
    contextCount: Number(args.contexts || 96),
    iterations: Number(args.iterations || 100),
    workerCount: Number(args.workers || 2),
    parallel: args.parallel !== "false",
    minIterationsForParallel: Number(args.minIterationsForParallel || 1),
  };
  const record = await measureScenario(scenario);
  console.log(JSON.stringify(record));
}

function runHeapCapCheck(check) {
  const output = [];
  for (const capMiB of check.heapCapsMiB) {
    const child = spawnSync(
      process.execPath,
      [
        `--max-old-space-size=${capMiB}`,
        __filename,
        "--child",
        "--id",
        check.id,
        "--samples",
        String(check.sampleCount),
        "--signatures",
        String(check.signatureCount),
        "--contexts",
        String(check.contextCount),
        "--iterations",
        String(check.iterations),
        "--workers",
        String(check.workerCount),
        "--parallel",
        String(check.parallel),
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        timeout: check.timeoutMs ?? 120000,
      }
    );
    let parsed = null;
    if (child.status === 0 && child.stdout.trim()) {
      try {
        parsed = JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1));
      } catch (_error) {
        parsed = null;
      }
    }
    output.push({
      checkId: check.id,
      heapCapMiB: capMiB,
      passed: child.status === 0,
      status: child.status,
      signal: child.signal,
      elapsedMs: parsed?.elapsedMs ?? null,
      peakRssMiB: parsed?.peakRssMiB ?? null,
      peakHeapUsedMiB: parsed?.peakHeapUsedMiB ?? null,
      stderr: child.status === 0 ? "" : child.stderr.slice(0, 1000),
    });
  }
  return output;
}

function toCsv(rows) {
  if (rows.length === 0) {
    return "";
  }
  const columns = Object.keys(rows[0]);
  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(",")),
  ].join("\n");
}

function groupBy(rows, keyFn) {
  return rows.reduce((groups, row) => {
    const key = keyFn(row);
    groups[key] = groups[key] || [];
    groups[key].push(row);
    return groups;
  }, {});
}

function buildSummary(records, heapCapChecks) {
  const byScenario = groupBy(records, (record) => record.scenarioId);
  const scenarioSummaries = Object.fromEntries(
    Object.entries(byScenario).map(([scenarioId, rows]) => [
      scenarioId,
      {
        repeats: rows.length,
        elapsedMs: summarize(rows.map((row) => row.elapsedMs)),
        fitsPerSecond: summarize(rows.map((row) => row.fitsPerSecond)),
        peakRssMiB: summarize(rows.map((row) => row.peakRssMiB)),
        peakHeapUsedMiB: summarize(rows.map((row) => row.peakHeapUsedMiB)),
        workerMode: rows[0]?.workerMode ?? null,
        workerCountUsed: rows[0]?.workerCountUsed ?? null,
      },
    ])
  );
  const heapByCheck = groupBy(heapCapChecks, (row) => row.checkId);
  const heapSummary = Object.fromEntries(
    Object.entries(heapByCheck).map(([checkId, rows]) => {
      const passedCaps = rows
        .filter((row) => row.passed)
        .map((row) => row.heapCapMiB)
        .sort((a, b) => a - b);
      return [
        checkId,
        {
          minimumPassingNodeHeapCapMiB: passedCaps[0] ?? null,
          checkedCapsMiB: rows.map((row) => row.heapCapMiB),
          passedCapsMiB: passedCaps,
        },
      ];
    })
  );
  return {
    scenarioSummaries,
    heapSummary,
    interpretation: [
      "These are synthetic Node.js worker-thread stress tests on one Windows host; they measure the native JavaScript bootstrap path, not browser UI rendering.",
      "The smallest passing Node heap cap is a tested lower bound for this synthetic workload, not a universal system-RAM requirement.",
      "Browser users should treat CPU core count as the dominant scaling factor for all-sample bootstrap; public APIs are not involved in this strict local computation.",
    ],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.child) {
    await runChild(args);
    return;
  }

  const repeats = Number(args.repeats || 2);
  const scenarios = [
    {
      id: "single_500_serial",
      sampleCount: 1,
      signatureCount: 67,
      contextCount: 96,
      iterations: 500,
      parallel: false,
      workerCount: 1,
    },
    {
      id: "single_500_parallel_4",
      sampleCount: 1,
      signatureCount: 67,
      contextCount: 96,
      iterations: 500,
      parallel: true,
      workerCount: 4,
    },
    {
      id: "cohort_120_iter25_serial",
      sampleCount: 120,
      signatureCount: 67,
      contextCount: 96,
      iterations: 25,
      parallel: false,
      workerCount: 1,
    },
    {
      id: "cohort_120_iter25_parallel_4",
      sampleCount: 120,
      signatureCount: 67,
      contextCount: 96,
      iterations: 25,
      parallel: true,
      workerCount: 4,
    },
    {
      id: "cohort_300_iter10_parallel_4",
      sampleCount: 300,
      signatureCount: 40,
      contextCount: 96,
      iterations: 10,
      parallel: true,
      workerCount: 4,
    },
  ];

  const records = [];
  for (const scenario of scenarios) {
    for (let repeat = 1; repeat <= repeats; repeat++) {
      const record = await measureScenario(scenario);
      records.push({ ...record, repeat });
      console.log(
        `${scenario.id} repeat ${repeat}/${repeats}: ${record.elapsedMs.toFixed(1)} ms, peak RSS ${record.peakRssMiB.toFixed(1)} MiB`
      );
    }
  }

  const heapCapChecks =
    args.skipHeapCaps
      ? []
      : [
          {
            id: "single_500_parallel_2",
            sampleCount: 1,
            signatureCount: 67,
            contextCount: 96,
            iterations: 500,
            parallel: true,
            workerCount: 2,
            heapCapsMiB: [128, 256, 512],
          },
          {
            id: "cohort_120_iter25_parallel_4",
            sampleCount: 120,
            signatureCount: 67,
            contextCount: 96,
            iterations: 25,
            parallel: true,
            workerCount: 4,
            heapCapsMiB: [256, 512, 1024],
          },
        ].flatMap(runHeapCapCheck);

  const payload = {
    generatedAt: new Date().toISOString(),
    environment: {
      os: `${os.type()} ${os.release()} ${os.arch()}`,
      platform: os.platform(),
      cpuModel: os.cpus()[0]?.model ?? null,
      logicalCpuCount: os.cpus().length,
      totalMemoryMiB: bytesToMiB(os.totalmem()),
      freeMemoryMiBAtEnd: bytesToMiB(os.freemem()),
      node: process.version,
      argv: process.argv,
    },
    scenarios,
    records,
    heapCapChecks,
    summary: buildSummary(records, heapCapChecks),
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "bootstrap-parallel-hardware-limits.json"),
    JSON.stringify(payload, null, 2)
  );
  await writeFile(
    path.join(outDir, "bootstrap_parallel_hardware_limits.csv"),
    toCsv(records)
  );
  await writeFile(
    path.join(outDir, "bootstrap_parallel_heap_cap_checks.csv"),
    toCsv(heapCapChecks)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
