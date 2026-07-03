import path from "node:path";
import { readFile } from "node:fs/promises";

import {
  ensureDir,
  relativeArtifact,
  writeCsv,
  writeJson,
} from "./lib/experiment-utils.mjs";
import { QC_DEFAULTS } from "../../mSigSDKScripts/qc.js";
import { ADVISOR_DEFAULTS } from "../../mSigSDKScripts/guidance.js";

const OUTPUT_DIR = path.join("docs", "manuscript", "experiments", "qc_threshold_registry", "data");
const JSON_PATH = path.join(OUTPUT_DIR, "qc-threshold-registry.json");
const CSV_PATH = path.join(OUTPUT_DIR, "qc_threshold_registry.csv");

const sources = {
  QC_DEFAULTS: {
    file: "mSigSDKScripts/qc.js",
    value: QC_DEFAULTS,
  },
  ADVISOR_DEFAULTS: {
    file: "mSigSDKScripts/guidance.js",
    value: ADVISOR_DEFAULTS,
  },
};

const thresholdLike = /threshold|cutoff|iterations|confidence|quantile|pseudocount|maxIterations|convergenceTolerance|yieldEvery|limit|minTotal|maxTotal|rank|nRuns|cosine/i;

await ensureDir(OUTPUT_DIR);

const rows = [];
for (const [rootName, source] of Object.entries(sources)) {
  const sourceText = await readFile(source.file, "utf8");
  const lines = sourceText.split(/\r?\n/);
  const occurrenceCounts = new Map();
  for (const entry of flattenDefaults(source.value, rootName)) {
    const key = entry.field.split(".").at(-1);
    if (!thresholdLike.test(key)) continue;
    const occurrenceKey = `${source.file}:${key}`;
    const occurrenceIndex = occurrenceCounts.get(occurrenceKey) || 0;
    occurrenceCounts.set(occurrenceKey, occurrenceIndex + 1);
    const line = findLine(lines, key, entry.value, occurrenceIndex);
    rows.push({
      field: entry.field,
      default: formatValue(entry.value),
      meaning: meaningFor(entry.field, entry.value),
      default_type: defaultType(entry.field),
      source: `${source.file}:${line || "unknown"}`,
    });
  }
}

await writeJson(JSON_PATH, {
  schemaVersion: "msig.qc_threshold_registry.v1",
  generatedAt: new Date().toISOString(),
  rows,
});
await writeCsv(CSV_PATH, rows);

console.log(`Wrote ${relativeArtifact(JSON_PATH)}`);
console.log(`Wrote ${relativeArtifact(CSV_PATH)}`);

function flattenDefaults(value, prefix) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [{ field: prefix, value }];
  }
  const rows = [];
  for (const [key, child] of Object.entries(value)) {
    const field = `${prefix}.${key}`;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      rows.push(...flattenDefaults(child, field));
    } else {
      rows.push({ field, value: child });
    }
  }
  return rows;
}

function findLine(lines, key, value, occurrenceIndex = 0) {
  const keyPattern = new RegExp(`\\b${escapeRegExp(key)}\\b\\s*:`);
  const formatted = formatValue(value);
  const candidates = lines
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => keyPattern.test(line) && line.trim().startsWith(`${key}:`));
  if (!candidates.length) return null;
  const exactCandidates = candidates.filter(({ line }) => line.includes(formatted.replaceAll('"', "")));
  const preferred = exactCandidates[occurrenceIndex] || candidates[occurrenceIndex] || exactCandidates[0] || candidates[0];
  return preferred.number;
}

function formatValue(value) {
  if (value === Infinity) return "Infinity";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value === null) return "null";
  return typeof value === "string" ? value : String(value);
}

function defaultType(field) {
  if (/publicationRecommended|minIterationsForStableIntervals/i.test(field)) {
    return "publication/review recommendation";
  }
  if (/confidenceLevel|convergenceTolerance|maxIterations|yieldEvery|seed|nRuns|rank/i.test(field)) {
    return "computational setting";
  }
  return "configurable convenience default";
}

function meaningFor(field, value) {
  const name = field.split(".").at(-1);
  if (/lowBurdenThreshold/.test(name)) return "Mutation count below which samples receive a low-burden review cue.";
  if (/moderateBurdenThreshold/.test(name)) return "Mutation count boundary used to separate low/moderate burden review context.";
  if (/weakUnexplainedThreshold/.test(name)) return "Relative unexplained residual fraction that begins residual-structure review.";
  if (/unexplainedThreshold/.test(name)) return "Relative unexplained residual fraction used for catalog-sufficiency review.";
  if (/ResidualStructureCosine|structuredResidualCosine/.test(name)) return "Cosine threshold for matching positive residual structure to a reference signature.";
  if (/exposureThreshold|activeExposureThreshold/.test(name)) return "Relative exposure cutoff used when counting or reporting active fitted signatures.";
  if (/thresholds/.test(name)) return "Exposure-threshold grid used for cutoff-sensitivity review.";
  if (/L1/.test(name)) return "Configured L1 exposure-drift cue for threshold-sensitivity review.";
  if (/Jaccard/.test(name)) return "Configured active-set Jaccard cue for threshold-sensitivity review.";
  if (/ConfidenceWidth/.test(name)) return "Bootstrap confidence-interval width cue for exposure stability review.";
  if (/confidenceLevel/.test(name)) return "Bootstrap interval confidence level.";
  if (/iterations/.test(name)) return "Bootstrap or iterative solver repeat count.";
  if (/cosine/i.test(name)) return "Cosine similarity boundary for signature, residual, or sample ambiguity review.";
  if (/convergenceTolerance/.test(name)) return "Numerical convergence tolerance for iterative fitting.";
  if (/maxIterations/.test(name)) return "Maximum iterations for iterative fitting; null means the solver default is used.";
  if (/quantile/.test(name)) return "Quantile used when threshold mode is quantile-based.";
  if (/pseudocount/.test(name)) return "Small value used to stabilize normalization.";
  if (/limit/.test(name)) return "Maximum number of records selected by the helper.";
  if (/rank/.test(name)) return "NMF rank setting.";
  return `Configurable default for ${field}; current value is ${formatValue(value)}.`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
