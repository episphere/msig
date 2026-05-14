#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateReconstructionError,
  fitSpectraWithNNLS,
} from "../../../../../mSigSDKScripts/qc.js";
import {
  cosineSimilarity,
  normalizeVector,
  seededRandom,
  sum,
} from "../../../../../mSigSDKScripts/numerics.js";

const EXPERIMENT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const MANUSCRIPT_DIR = join(EXPERIMENT_DIR, "..", "..");
const SNAPSHOT_PATH = join(
  MANUSCRIPT_DIR,
  "actual-figure-pages",
  "data",
  "pcawg-lung-snapshot.json"
);
const MANUSCRIPT_DATA_PATH = join(
  MANUSCRIPT_DIR,
  "data",
  "synthetic-validation-results.json"
);

const SELECTED_SIGNATURES = ["SBS1", "SBS2", "SBS4", "SBS5", "SBS13", "SBS40"];
const BURDENS = [50, 100, 250, 500, 1000, 2500];
const SAMPLES_PER_BURDEN = 64;
const SEED = 20260513;
const ACTIVE_THRESHOLD = 0.05;
const FIT_EXPOSURE_THRESHOLD = 0.01;

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return `${[headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeRecord(record, contexts) {
  const values = contexts.map((context) => Number(record[context]) || 0);
  const normalized = normalizeVector(values, 1);
  return Object.fromEntries(contexts.map((context, index) => [context, normalized[index]]));
}

function shuffle(values, random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomSparseExposure(signatureNames, random, sampleIndex) {
  const activeCount = 2 + (sampleIndex % 2);
  const active = shuffle(signatureNames, random).slice(0, activeCount);
  const raw = active.map(() => 0.25 + random());
  const weights = normalizeVector(raw, 1);
  const exposure = Object.fromEntries(signatureNames.map((signature) => [signature, 0]));
  for (let i = 0; i < active.length; i++) {
    exposure[active[i]] = weights[i];
  }
  return exposure;
}

function multinomialCounts(total, probabilities, random) {
  const cumulative = [];
  let running = 0;
  for (const probability of probabilities) {
    running += probability;
    cumulative.push(running);
  }

  const counts = Array(probabilities.length).fill(0);
  for (let draw = 0; draw < total; draw++) {
    const value = random();
    const index = cumulative.findIndex((entry) => value <= entry);
    counts[index === -1 ? counts.length - 1 : index] += 1;
  }
  return counts;
}

function createSpectrum({ contexts, signatures, exposure, burden, random }) {
  const probabilities = contexts.map((context) =>
    sum(
      Object.entries(exposure).map(
        ([signatureName, weight]) => weight * (signatures[signatureName][context] || 0)
      )
    )
  );
  const counts = multinomialCounts(burden, normalizeVector(probabilities, 1), random);
  return Object.fromEntries(contexts.map((context, index) => [context, counts[index]]));
}

function vectorFromExposure(exposure, signatureNames) {
  return signatureNames.map((signature) => Number(exposure?.[signature]) || 0);
}

function metricSummary(values, { bounded = true } = {}) {
  const finite = values.filter(Number.isFinite);
  const n = finite.length;
  const mean = n === 0 ? null : sum(finite) / n;
  const sd =
    n <= 1
      ? 0
      : Math.sqrt(
          sum(finite.map((value) => (value - mean) ** 2)) / (n - 1)
        );
  const se = n === 0 ? null : sd / Math.sqrt(n);
  const margin = se === null ? null : 1.96 * se;
  const lower =
    mean === null
      ? null
      : bounded
        ? Math.max(0, mean - margin)
        : mean - margin;
  const upper =
    mean === null
      ? null
      : bounded
        ? Math.min(1, mean + margin)
        : mean + margin;
  return { n, mean, sd, ciLower: lower, ciUpper: upper };
}

function formatMeanCi(summary, digits = 3) {
  if (summary.mean === null) {
    return "NA";
  }
  return `${summary.mean.toFixed(digits)} (${summary.ciLower.toFixed(digits)}-${summary.ciUpper.toFixed(digits)})`;
}

function buildTableHtml(summaryRows) {
  const tableStyle = [
    "border-collapse:collapse",
    "width:100%",
    "font-family:Arial, Helvetica, sans-serif",
    "font-size:10.5pt",
    "line-height:1.25",
    "color:#1f2933",
  ].join(";");
  const thStyle = [
    "border:1px solid #9aa5b1",
    "background:#eef2f7",
    "padding:6px 8px",
    "text-align:left",
    "font-weight:700",
    "vertical-align:top",
  ].join(";");
  const tdStyle = [
    "border:1px solid #c8d1dc",
    "padding:6px 8px",
    "vertical-align:top",
  ].join(";");
  const headers = [
    "Mutations per sample",
    "Samples (n)",
    "Exposure cosine, mean (95% CI)",
    "Exposure MAE, mean (95% CI)",
    "Active-signature recall, mean (95% CI)",
    "Inactive-signature calls, mean (95% CI)",
    "Reconstruction cosine, mean (95% CI)",
  ];
  const rows = summaryRows.map((row) => [
    row.burden,
    row.samples,
    formatMeanCi(row.metrics.exposureCosine),
    formatMeanCi(row.metrics.exposureMae),
    formatMeanCi(row.metrics.activeRecall),
    formatMeanCi(row.metrics.falsePositiveFraction),
    formatMeanCi(row.metrics.reconstructionCosine),
  ]);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Controlled synthetic signature validation</title>
</head>
<body>
<p style="font-family:Arial, Helvetica, sans-serif;font-size:11pt;line-height:1.3;margin:0 0 6px 0;color:#111827"><strong>Controlled synthetic signature validation.</strong> Known COSMIC SBS96 mixtures were generated at fixed mutation burdens and refitted with the SDK workflow.</p>
<table style="${tableStyle}">
<thead><tr>${headers.map((header) => `<th style="${thStyle}">${htmlEscape(header)}</th>`).join("")}</tr></thead>
<tbody>
${rows
  .map(
    (row) =>
      `<tr>${row.map((cell) => `<td style="${tdStyle}">${htmlEscape(cell)}</td>`).join("")}</tr>`
  )
  .join("\n")}
</tbody>
</table>
<p style="font-family:Arial, Helvetica, sans-serif;font-size:9.5pt;line-height:1.3;margin:6px 0 20px 0;color:#4b5563"><em>Note.</em> MAE, mean absolute exposure error. Active-signature recall and inactive-signature calls used a 5% exposure threshold. Confidence intervals are normal-approximation intervals across synthetic samples within each burden.</p>
</body>
</html>
`;
}

async function main() {
  const dataDir = join(EXPERIMENT_DIR, "data");
  const tableDir = join(EXPERIMENT_DIR, "tables");
  const figureDir = join(EXPERIMENT_DIR, "figures");
  await mkdir(dataDir, { recursive: true });
  await mkdir(tableDir, { recursive: true });
  await mkdir(figureDir, { recursive: true });

  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  const contexts = snapshot.sampleNames?.length
    ? Object.keys(snapshot.groupedSpectra[snapshot.sampleNames[0]])
    : Object.keys(Object.values(snapshot.referenceSignatures)[0] || {});
  const availableSignatures = Object.keys(snapshot.referenceSignatures || {});
  const missing = SELECTED_SIGNATURES.filter(
    (signature) => !availableSignatures.includes(signature)
  );
  if (missing.length) {
    throw new Error(`Missing reference signatures in snapshot: ${missing.join(", ")}`);
  }

  const signatures = Object.fromEntries(
    SELECTED_SIGNATURES.map((signature) => [
      signature,
      normalizeRecord(snapshot.referenceSignatures[signature], contexts),
    ])
  );
  const random = seededRandom(SEED);
  const spectra = {};
  const trueExposures = {};

  for (const burden of BURDENS) {
    for (let sampleIndex = 0; sampleIndex < SAMPLES_PER_BURDEN; sampleIndex++) {
      const sampleName = `synthetic_${String(burden).padStart(4, "0")}_${String(sampleIndex + 1).padStart(3, "0")}`;
      const exposure = randomSparseExposure(SELECTED_SIGNATURES, random, sampleIndex);
      trueExposures[sampleName] = exposure;
      spectra[sampleName] = createSpectrum({
        contexts,
        signatures,
        exposure,
        burden,
        random,
      });
    }
  }

  const fittedExposures = await fitSpectraWithNNLS(signatures, spectra, {
    contexts,
    exposureThreshold: FIT_EXPOSURE_THRESHOLD,
    exposureType: "relative",
    renormalize: true,
  });
  const reconstruction = calculateReconstructionError(
    signatures,
    spectra,
    fittedExposures,
    { contexts, normalizeMode: "relative" }
  );
  const reconstructionBySample = Object.fromEntries(
    reconstruction.samples.map((sample) => [sample.sample, sample])
  );

  const sampleRows = Object.keys(spectra).map((sampleName) => {
    const burden = Number(sampleName.split("_")[1]);
    const truth = vectorFromExposure(trueExposures[sampleName], SELECTED_SIGNATURES);
    const fitted = vectorFromExposure(fittedExposures[sampleName], SELECTED_SIGNATURES);
    const trueActive = truth
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value >= ACTIVE_THRESHOLD);
    const inactive = truth
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value < ACTIVE_THRESHOLD);
    const recoveredActive = trueActive.filter(
      (entry) => fitted[entry.index] >= ACTIVE_THRESHOLD
    ).length;
    const falsePositive = inactive.filter(
      (entry) => fitted[entry.index] >= ACTIVE_THRESHOLD
    ).length;
    const exposureMae =
      sum(truth.map((value, index) => Math.abs(value - fitted[index]))) /
      SELECTED_SIGNATURES.length;

    return {
      sample: sampleName,
      burden,
      trueActiveCount: trueActive.length,
      exposureCosine: cosineSimilarity(truth, fitted),
      exposureMae,
      activeRecall: trueActive.length === 0 ? 1 : recoveredActive / trueActive.length,
      falsePositiveFraction:
        inactive.length === 0 ? 0 : falsePositive / inactive.length,
      reconstructionCosine:
        reconstructionBySample[sampleName]?.cosineSimilarity ?? null,
    };
  });

  const summaryRows = BURDENS.map((burden) => {
    const rows = sampleRows.filter((row) => row.burden === burden);
    return {
      burden,
      samples: rows.length,
      metrics: {
        exposureCosine: metricSummary(rows.map((row) => row.exposureCosine)),
        exposureMae: metricSummary(rows.map((row) => row.exposureMae), {
          bounded: false,
        }),
        activeRecall: metricSummary(rows.map((row) => row.activeRecall)),
        falsePositiveFraction: metricSummary(
          rows.map((row) => row.falsePositiveFraction)
        ),
        reconstructionCosine: metricSummary(
          rows.map((row) => row.reconstructionCosine)
        ),
      },
    };
  });

  const sampleHeaders = [
    "sample",
    "burden",
    "true_active_count",
    "exposure_cosine",
    "exposure_mae",
    "active_recall",
    "false_positive_fraction",
    "reconstruction_cosine",
  ];
  await writeFile(
    join(dataDir, "synthetic_validation_sample_level.csv"),
    toCsv(
      sampleHeaders,
      sampleRows.map((row) => [
        row.sample,
        row.burden,
        row.trueActiveCount,
        row.exposureCosine,
        row.exposureMae,
        row.activeRecall,
        row.falsePositiveFraction,
        row.reconstructionCosine,
      ])
    )
  );

  const summaryHeaders = [
    "burden",
    "samples",
    "exposure_cosine_mean",
    "exposure_cosine_ci_low",
    "exposure_cosine_ci_high",
    "exposure_mae_mean",
    "exposure_mae_ci_low",
    "exposure_mae_ci_high",
    "active_recall_mean",
    "active_recall_ci_low",
    "active_recall_ci_high",
    "false_positive_fraction_mean",
    "false_positive_fraction_ci_low",
    "false_positive_fraction_ci_high",
    "reconstruction_cosine_mean",
    "reconstruction_cosine_ci_low",
    "reconstruction_cosine_ci_high",
  ];
  await writeFile(
    join(dataDir, "table4_synthetic_signature_validation.csv"),
    toCsv(
      summaryHeaders,
      summaryRows.map((row) => [
        row.burden,
        row.samples,
        row.metrics.exposureCosine.mean,
        row.metrics.exposureCosine.ciLower,
        row.metrics.exposureCosine.ciUpper,
        row.metrics.exposureMae.mean,
        row.metrics.exposureMae.ciLower,
        row.metrics.exposureMae.ciUpper,
        row.metrics.activeRecall.mean,
        row.metrics.activeRecall.ciLower,
        row.metrics.activeRecall.ciUpper,
        row.metrics.falsePositiveFraction.mean,
        row.metrics.falsePositiveFraction.ciLower,
        row.metrics.falsePositiveFraction.ciUpper,
        row.metrics.reconstructionCosine.mean,
        row.metrics.reconstructionCosine.ciLower,
        row.metrics.reconstructionCosine.ciUpper,
      ])
    )
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    seed: SEED,
    signatureSetName: snapshot.signatureSetName,
    signatures: SELECTED_SIGNATURES,
    burdens: BURDENS,
    samplesPerBurden: SAMPLES_PER_BURDEN,
    activeThreshold: ACTIVE_THRESHOLD,
    fitExposureThreshold: FIT_EXPOSURE_THRESHOLD,
    summaryRows,
  };
  await writeFile(
    join(dataDir, "synthetic-validation-results.json"),
    `${JSON.stringify(payload, null, 2)}\n`
  );
  await writeFile(MANUSCRIPT_DATA_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(
    join(tableDir, "table4_synthetic_signature_validation.html"),
    buildTableHtml(summaryRows)
  );
  await writeFile(join(figureDir, ".gitkeep"), "");

  const first = summaryRows[0];
  const last = summaryRows[summaryRows.length - 1];
  const readme = `# Synthetic Signature Validation

## Research question

How accurately does the mSigSDK known-signature refitting workflow recover known COSMIC SBS96 exposure mixtures across realistic mutation burdens?

## Methods

Synthetic SBS96 spectra were generated from six COSMIC SBS96 reference signatures (${SELECTED_SIGNATURES.join(", ")}) loaded from the cached mSigPortal manuscript snapshot. For each mutation burden (${BURDENS.join(", ")}), ${SAMPLES_PER_BURDEN} spectra were generated from seeded sparse mixtures with two or three active signatures, sampled by multinomial draws, and refitted with the SDK's nonnegative least-squares workflow using a ${FIT_EXPOSURE_THRESHOLD} relative exposure threshold and renormalization. Active-signature recall and inactive-signature calls used a ${ACTIVE_THRESHOLD} exposure threshold. The random seed was ${SEED}; date executed ${new Date().toISOString()}.

## Key findings

At ${first.burden} mutations per sample, mean cosine between true and estimated exposures was ${formatMeanCi(first.metrics.exposureCosine)} and mean reconstruction cosine was ${formatMeanCi(first.metrics.reconstructionCosine)}. At ${last.burden} mutations per sample, mean cosine between true and estimated exposures was ${formatMeanCi(last.metrics.exposureCosine)} and mean reconstruction cosine was ${formatMeanCi(last.metrics.reconstructionCosine)}. Active-signature recall increased from ${formatMeanCi(first.metrics.activeRecall)} to ${formatMeanCi(last.metrics.activeRecall)}, while inactive-signature calls decreased from ${formatMeanCi(first.metrics.falsePositiveFraction)} to ${formatMeanCi(last.metrics.falsePositiveFraction)}. These results support use of the SDK for lightweight review of known synthetic mixtures while reinforcing burden-dependent caution.

## File inventory

- data/synthetic_validation_sample_level.csv: per-sample validation metrics.
- data/table4_synthetic_signature_validation.csv: summary statistics used for manuscript Table 4.
- data/synthetic-validation-results.json: structured summary copied into docs/manuscript/data for the manuscript table generator.
- tables/table4_synthetic_signature_validation.html: standalone HTML table with inline CSS.
- code/synthetic-validation.mjs: reproducible analysis script.
`;
  await writeFile(join(EXPERIMENT_DIR, "README.md"), readme);

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
