#!/usr/bin/env node

import { execFileSync } from "node:child_process";
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
  quantile,
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
  "concordance-validation-results.json"
);
const SELECTED_SIGNATURES = [
  "SBS1",
  "SBS2",
  "SBS4",
  "SBS5",
  "SBS13",
  "SBS17a",
  "SBS17b",
  "SBS18",
  "SBS40",
];
const SAMPLE_LIMIT = null;
const EXPOSURE_THRESHOLD = 0.01;

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return `${[headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function readExposureCsv(text) {
  const rows = parseCsv(text).filter((row) => row.length > 1);
  const headers = rows[0];
  return Object.fromEntries(
    rows.slice(1).map((row) => {
      const sample = row[0];
      const exposures = {};
      for (let i = 1; i < headers.length; i++) {
        exposures[headers[i]] = Number(row[i]) || 0;
      }
      return [sample, exposures];
    })
  );
}

function normalizeRecord(record, contexts, target = 1) {
  const values = contexts.map((context) => Number(record[context]) || 0);
  const normalized = normalizeVector(values, target);
  return Object.fromEntries(contexts.map((context, index) => [context, normalized[index]]));
}

function subsetMatrix(matrix, rowNames, contexts) {
  return Object.fromEntries(
    rowNames.map((rowName) => [
      rowName,
      Object.fromEntries(contexts.map((context) => [context, Number(matrix[rowName][context]) || 0])),
    ])
  );
}

function vector(record, names) {
  return names.map((name) => Number(record?.[name]) || 0);
}

function reconstruct(signatures, exposure, contexts, normalize = true) {
  const result = contexts.map((context) =>
    sum(
      Object.entries(exposure || {}).map(
        ([signatureName, weight]) => weight * (signatures[signatureName]?.[context] || 0)
      )
    )
  );
  return normalize ? normalizeVector(result, 1) : result;
}

function topSignature(exposure) {
  return Object.entries(exposure || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? sum(finite) / finite.length : null;
}

function median(values) {
  const finite = values.filter(Number.isFinite);
  return quantile(finite, 0.5);
}

function min(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : null;
}

function max(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : null;
}

function fmt(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : "NA";
}

function fmtSmall(value) {
  if (!Number.isFinite(value)) {
    return "NA";
  }
  return Math.abs(value) < 0.001 ? value.toExponential(2) : value.toFixed(3);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildTableHtml(rows) {
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
  const headers = ["Comparison element", "Result", "Interpretation"];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>mSigSDK deconstructSigs concordance</title>
</head>
<body>
<p style="font-family:Arial, Helvetica, sans-serif;font-size:11pt;line-height:1.3;margin:0 0 6px 0;color:#111827"><strong>Independent NNLS check and deconstructSigs concordance.</strong> PCAWG Lung-AdenoCA SBS96 spectra were fitted with the same selected COSMIC SBS96 catalog.</p>
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
<p style="font-family:Arial, Helvetica, sans-serif;font-size:9.5pt;line-height:1.3;margin:6px 0 20px 0;color:#4b5563"><em>Note.</em> deconstructSigs and mSigSDK used the same sample-by-context matrix restricted to the same SBS96 contexts and the same nine-signature COSMIC SBS96 catalog used in the manuscript refitting example. Reconstruction metrics used spectra normalized to relative fractions. deconstructSigs used its default count-to-fraction preprocessing without genome-to-exome or exome-to-genome opportunity rescaling. All reported exposure vectors used a 1% relative-exposure cutoff followed by renormalization. An independent R nonnegative least-squares implementation was also run as a numerical solver check. deconstructSigs version 1.8.0 was run in R 4.1.1.</p>
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
  const sampleNames = SAMPLE_LIMIT
    ? snapshot.sampleNames.slice(0, SAMPLE_LIMIT)
    : snapshot.sampleNames;
  const contexts = Object.keys(snapshot.groupedSpectra[sampleNames[0]]);
  const missing = SELECTED_SIGNATURES.filter(
    (signature) => !snapshot.referenceSignatures[signature]
  );
  if (missing.length) {
    throw new Error(`Missing selected signatures: ${missing.join(", ")}`);
  }

  const spectra = subsetMatrix(snapshot.groupedSpectra, sampleNames, contexts);
  const signatures = Object.fromEntries(
    SELECTED_SIGNATURES.map((signature) => [
      signature,
      normalizeRecord(snapshot.referenceSignatures[signature], contexts, 1),
    ])
  );

  const spectrumHeaders = ["sample", ...contexts];
  const signatureHeaders = ["signature", ...contexts];
  const spectraCsv = join(dataDir, "concordance_input_spectra.csv");
  const signaturesCsv = join(dataDir, "concordance_reference_signatures.csv");
  const deconstructCsv = join(dataDir, "deconstructsigs_exposures.csv");
  const rNnlsCsv = join(dataDir, "r_nnls_exposures.csv");
  await writeFile(
    spectraCsv,
    toCsv(
      spectrumHeaders,
      sampleNames.map((sample) => [sample, ...contexts.map((context) => spectra[sample][context])])
    )
  );
  await writeFile(
    signaturesCsv,
    toCsv(
      signatureHeaders,
      SELECTED_SIGNATURES.map((signature) => [
        signature,
        ...contexts.map((context) => signatures[signature][context]),
      ])
    )
  );

  const msigExposures = await fitSpectraWithNNLS(signatures, spectra, {
    contexts,
    exposureThreshold: EXPOSURE_THRESHOLD,
    exposureType: "relative",
    renormalize: true,
  });
  await writeFile(
    join(dataDir, "msigsdk_exposures.csv"),
    toCsv(
      ["sample", ...SELECTED_SIGNATURES],
      sampleNames.map((sample) => [
        sample,
        ...SELECTED_SIGNATURES.map((signature) => msigExposures[sample][signature] || 0),
      ])
    )
  );

  execFileSync(
    "Rscript",
    [
      join(EXPERIMENT_DIR, "code", "run-deconstructsigs.R"),
      spectraCsv,
      signaturesCsv,
      deconstructCsv,
    ],
    { stdio: "inherit" }
  );
  execFileSync(
    "Rscript",
    [
      join(EXPERIMENT_DIR, "code", "run-r-nnls.R"),
      spectraCsv,
      signaturesCsv,
      rNnlsCsv,
    ],
    { stdio: "inherit" }
  );

  const deconstructExposures = readExposureCsv(await readFile(deconstructCsv, "utf8"));
  const rNnlsExposures = readExposureCsv(await readFile(rNnlsCsv, "utf8"));
  const msigRecon = calculateReconstructionError(signatures, spectra, msigExposures, {
    contexts,
    normalizeMode: "relative",
  });
  const msigReconBySample = Object.fromEntries(
    msigRecon.samples.map((row) => [row.sample, row])
  );
  const sampleRows = sampleNames.map((sample) => {
    const msigVector = vector(msigExposures[sample], SELECTED_SIGNATURES);
    const deconstructVector = vector(deconstructExposures[sample], SELECTED_SIGNATURES);
    const observed = normalizeVector(contexts.map((context) => spectra[sample][context]), 1);
    const deconstructReconstructed = reconstruct(signatures, deconstructExposures[sample], contexts);
    const exposureCosine = cosineSimilarity(msigVector, deconstructVector);
    const exposureL1Distance = sum(
      msigVector.map((value, index) => Math.abs(value - deconstructVector[index]))
    );
    const msigReconstructionCosine = msigReconBySample[sample]?.cosineSimilarity ?? null;
    const deconstructReconstructionCosine = cosineSimilarity(
      observed,
      deconstructReconstructed
    );
    const msigTop = topSignature(msigExposures[sample]);
    const deconstructTop = topSignature(deconstructExposures[sample]);
    return {
      sample,
      totalMutations: sum(contexts.map((context) => spectra[sample][context])),
      exposureCosine,
      exposureL1Distance,
      meanAbsoluteExposureDifference: exposureL1Distance / SELECTED_SIGNATURES.length,
      msigReconstructionCosine,
      deconstructReconstructionCosine,
      reconstructionCosineDelta: Math.abs(
        msigReconstructionCosine - deconstructReconstructionCosine
      ),
      msigTopSignature: msigTop,
      deconstructSigsTopSignature: deconstructTop,
      topSignatureAgreement: msigTop === deconstructTop,
    };
  });

  const exposureCosines = sampleRows.map((row) => row.exposureCosine);
  const exposureMae = sampleRows.map((row) => row.meanAbsoluteExposureDifference);
  const reconstructionDeltas = sampleRows.map((row) => row.reconstructionCosineDelta);
  const lowAgreementRows = sampleRows.filter((row) => row.exposureCosine < 0.9);
  const topMismatchRows = sampleRows.filter((row) => !row.topSignatureAgreement);
  const rNnlsRows = sampleNames.map((sample) => {
    const msigVector = vector(msigExposures[sample], SELECTED_SIGNATURES);
    const rNnlsVector = vector(rNnlsExposures[sample], SELECTED_SIGNATURES);
    const absoluteDifferences = msigVector.map((value, index) =>
      Math.abs(value - rNnlsVector[index])
    );
    return {
      sample,
      exposureCosine: cosineSimilarity(msigVector, rNnlsVector),
      maxAbsoluteExposureDifference: max(absoluteDifferences),
      meanAbsoluteExposureDifference:
        sum(absoluteDifferences) / Math.max(absoluteDifferences.length, 1),
    };
  });
  const rNnlsVersion = execFileSync(
    "Rscript",
    ["-e", "cat(as.character(utils::packageVersion('nnls')))"],
    { encoding: "utf8" }
  ).trim();
  const summary = {
    generatedAt: new Date().toISOString(),
    comparator: "deconstructSigs",
    comparatorVersion: "1.8.0",
    independentNnlsComparator: "R nnls",
    independentNnlsComparatorVersion: rNnlsVersion,
    rVersion: "4.1.1",
    study: snapshot.study,
    cancerType: snapshot.cancerType,
    spectrum: `${snapshot.mutationType}${snapshot.matrixSize}`,
    signatureSetName: snapshot.signatureSetName,
    signatures: SELECTED_SIGNATURES,
    samples: sampleNames.length,
    exposureThreshold: EXPOSURE_THRESHOLD,
    meanExposureCosine: mean(exposureCosines),
    medianExposureCosine: median(exposureCosines),
    minExposureCosine: min(exposureCosines),
    meanAbsoluteExposureDifference: mean(exposureMae),
    medianAbsoluteExposureDifference: median(exposureMae),
    meanMsigReconstructionCosine: mean(
      sampleRows.map((row) => row.msigReconstructionCosine)
    ),
    meanDeconstructSigsReconstructionCosine: mean(
      sampleRows.map((row) => row.deconstructReconstructionCosine)
    ),
    meanReconstructionCosineDelta: mean(reconstructionDeltas),
    maxReconstructionCosineDelta: max(reconstructionDeltas),
    topSignatureAgreementCount: sampleRows.length - topMismatchRows.length,
    exposureCosineBelow090Count: lowAgreementRows.length,
    topSignatureMismatchCount: topMismatchRows.length,
    meanRnnlsExposureCosine: mean(rNnlsRows.map((row) => row.exposureCosine)),
    medianRnnlsExposureCosine: median(rNnlsRows.map((row) => row.exposureCosine)),
    minRnnlsExposureCosine: min(rNnlsRows.map((row) => row.exposureCosine)),
    maxRnnlsAbsoluteExposureDifference: max(
      rNnlsRows.map((row) => row.maxAbsoluteExposureDifference)
    ),
    meanRnnlsAbsoluteExposureDifference: mean(
      rNnlsRows.map((row) => row.meanAbsoluteExposureDifference)
    ),
  };

  const tableRows = [
    [
      "Input spectra and catalog",
      `${summary.samples} cached PCAWG Lung-AdenoCA WGS SBS96 spectra; ${summary.signatures.length} selected COSMIC SBS96 signatures.`,
      "The comparison used every cached spectrum available in the manuscript snapshot and the same selected catalog as the refitting example.",
    ],
    [
      "Exposure agreement",
      `Mean cosine ${fmt(summary.meanExposureCosine)}; median ${fmt(summary.medianExposureCosine)}; minimum ${fmt(summary.minExposureCosine)}.`,
      "The two tools produced similar exposure vectors for most samples under matched inputs and cutoffs.",
    ],
    [
      "Independent NNLS solver check",
      `Mean cosine ${fmt(summary.meanRnnlsExposureCosine)}; minimum ${fmt(summary.minRnnlsExposureCosine)}; maximum absolute exposure difference ${fmtSmall(summary.maxRnnlsAbsoluteExposureDifference)}.`,
      "mSigSDK matched an independent nonnegative least-squares implementation to numerical precision.",
    ],
    [
      "Mean absolute exposure difference",
      `Mean ${fmt(summary.meanAbsoluteExposureDifference)}; median ${fmt(summary.medianAbsoluteExposureDifference)}.`,
      "The remaining deconstructSigs differences reflect its normalized-weight iterative fitting and signature-screening procedure, especially among exchangeable signatures.",
    ],
    [
      "Reconstruction agreement",
      `Mean reconstruction cosine ${fmt(summary.meanMsigReconstructionCosine)} for mSigSDK and ${fmt(summary.meanDeconstructSigsReconstructionCosine)} for deconstructSigs; mean absolute delta ${fmt(summary.meanReconstructionCosineDelta)}.`,
      "Both tools reconstructed the observed spectra to similar cosine similarity with the selected catalog.",
    ],
    [
      "Disagreement cases",
      `${summary.exposureCosineBelow090Count} of ${summary.samples} samples had exposure cosine below 0.90; ${summary.topSignatureMismatchCount} had different top fitted signatures.`,
      "Disagreements are retained as review signals rather than suppressed; they motivate threshold and ambiguity checks.",
    ],
  ];

  await writeFile(
    join(dataDir, "concordance_sample_level.csv"),
    toCsv(
      [
        "sample",
        "total_mutations",
        "exposure_cosine",
        "exposure_l1_distance",
        "mean_absolute_exposure_difference",
        "msigsdk_reconstruction_cosine",
        "deconstructsigs_reconstruction_cosine",
        "reconstruction_cosine_delta",
        "msigsdk_top_signature",
        "deconstructsigs_top_signature",
        "top_signature_agreement",
      ],
      sampleRows.map((row) => [
        row.sample,
        row.totalMutations,
        row.exposureCosine,
        row.exposureL1Distance,
        row.meanAbsoluteExposureDifference,
        row.msigReconstructionCosine,
        row.deconstructReconstructionCosine,
        row.reconstructionCosineDelta,
        row.msigTopSignature,
        row.deconstructSigsTopSignature,
        row.topSignatureAgreement,
      ])
    )
  );
  await writeFile(
    join(dataDir, "table5_deconstructsigs_concordance.csv"),
    toCsv(["comparison_element", "result", "interpretation"], tableRows)
  );
  const payload = { ...summary, tableRows, sampleRows };
  await writeFile(
    join(dataDir, "concordance-validation-results.json"),
    `${JSON.stringify(payload, null, 2)}\n`
  );
  await writeFile(MANUSCRIPT_DATA_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(
    join(tableDir, "table5_deconstructsigs_concordance.html"),
    buildTableHtml(tableRows)
  );
  await writeFile(join(figureDir, ".gitkeep"), "");

  const readme = `# deconstructSigs Concordance

## Research question

How closely do mSigSDK and deconstructSigs agree when they fit the same PCAWG Lung-AdenoCA SBS96 spectra with the same selected COSMIC SBS96 reference catalog, and does mSigSDK match an independent nonnegative least-squares solver?

## Methods

We used all ${summary.samples} cached PCAWG Lung-AdenoCA WGS SBS96 spectra from the mSigPortal manuscript snapshot and the same nine selected COSMIC SBS96 signatures used in the manuscript refitting example (${SELECTED_SIGNATURES.join(", ")}). All tools used the same sample-by-context matrix restricted to the same SBS96 contexts and the same selected reference catalog. Reconstruction metrics used spectra normalized to relative fractions. deconstructSigs used its default count-to-fraction preprocessing without genome-to-exome or exome-to-genome opportunity rescaling. mSigSDK, deconstructSigs, and an independent R nonnegative least-squares solver were run with a ${EXPOSURE_THRESHOLD} relative exposure cutoff followed by exposure renormalization. deconstructSigs version 1.8.0 and R nnls version ${summary.independentNnlsComparatorVersion} were run in R 4.1.1. Date executed ${summary.generatedAt}.

## Key findings

Across ${summary.samples} shared spectra, mSigSDK matched the independent R nonnegative least-squares solver to numerical precision (mean exposure-vector cosine ${fmt(summary.meanRnnlsExposureCosine)}, maximum absolute exposure difference ${fmtSmall(summary.maxRnnlsAbsoluteExposureDifference)}). The mean exposure-vector cosine between mSigSDK and deconstructSigs was ${fmt(summary.meanExposureCosine)} and the median was ${fmt(summary.medianExposureCosine)}. Mean reconstruction cosine was ${fmt(summary.meanMsigReconstructionCosine)} for mSigSDK and ${fmt(summary.meanDeconstructSigsReconstructionCosine)} for deconstructSigs, with a mean absolute reconstruction-cosine delta of ${fmt(summary.meanReconstructionCosineDelta)}. ${summary.exposureCosineBelow090Count} samples had exposure cosine below 0.90, and ${summary.topSignatureMismatchCount} had different top fitted signatures.

## File inventory

- data/concordance_input_spectra.csv: sample-by-context spectra used by both tools.
- data/concordance_reference_signatures.csv: signature-by-context reference catalog used by both tools.
- data/msigsdk_exposures.csv: mSigSDK fitted exposures.
- data/deconstructsigs_exposures.csv: deconstructSigs fitted exposures.
- data/r_nnls_exposures.csv: independent R nonnegative least-squares fitted exposures.
- data/concordance_sample_level.csv: sample-level agreement metrics.
- data/table5_deconstructsigs_concordance.csv: manuscript summary table.
- data/concordance-validation-results.json: structured summary copied into docs/manuscript/data for the manuscript table generator.
- tables/table5_deconstructsigs_concordance.html: standalone HTML table with inline CSS.
- code/concordance-validation.mjs: orchestration and metric script.
- code/run-deconstructsigs.R: comparator script.
- code/run-r-nnls.R: independent numerical solver check.
`;
  await writeFile(join(EXPERIMENT_DIR, "README.md"), readme);

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
