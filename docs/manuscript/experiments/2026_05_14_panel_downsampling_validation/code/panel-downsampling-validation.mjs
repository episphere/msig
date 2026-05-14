#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fitSpectraWithNNLS } from "../../../../../mSigSDKScripts/qc.js";
import { runPanelWorkflow } from "../../../../../mSigSDKScripts/guidance.js";
import { createWGStoPanelValidationPairs } from "../../../../../mSigSDKScripts/userData.js";
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
const CALLABLE_MASK_SIZES = [24, 48, 72];
const PANEL_BURDEN_LEVELS = [25, 75, 200, 1000];
const FIT_EXPOSURE_THRESHOLD = 0.01;
const LIMITED_SUPPORT_EXPOSURE = 0.05;
const HIGHER_SUPPORT_EXPOSURE = 0.2;
const MIN_ASSESSABLE_MUTATIONS = 30;

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

function subsetMatrix(matrix, rowNames, contexts) {
  return Object.fromEntries(
    rowNames.map((rowName) => [
      rowName,
      Object.fromEntries(
        contexts.map((context) => [context, Number(matrix[rowName]?.[context]) || 0])
      ),
    ])
  );
}

function vector(record, names) {
  return names.map((name) => Number(record?.[name]) || 0);
}

function exposureBin(value) {
  if (value >= HIGHER_SUPPORT_EXPOSURE) {
    return ">=0.20";
  }
  if (value >= LIMITED_SUPPORT_EXPOSURE) {
    return "0.05-<0.20";
  }
  return "<0.05";
}

function burdenBin(value) {
  if (value < MIN_ASSESSABLE_MUTATIONS) {
    return "<30";
  }
  if (value < 150) {
    return "30-<150";
  }
  return ">=150";
}

function expectedTier({ truthExposure, panelTotal, callableSignatureMass }) {
  if (panelTotal < MIN_ASSESSABLE_MUTATIONS || callableSignatureMass === 0) {
    return "not_assessable";
  }
  if (truthExposure >= HIGHER_SUPPORT_EXPOSURE) {
    return "higher_review_support";
  }
  if (truthExposure >= LIMITED_SUPPORT_EXPOSURE) {
    return "limited_review_support";
  }
  return "not_detected_within_review_settings";
}

function aggregateContextCounts(spectra, contexts) {
  const totals = Object.fromEntries(contexts.map((context) => [context, 0]));
  for (const spectrum of Object.values(spectra)) {
    for (const context of contexts) {
      totals[context] += Number(spectrum[context]) || 0;
    }
  }
  return totals;
}

function createRankedMask(contexts, aggregateCounts, size) {
  const selected = new Set(
    [...contexts]
      .sort((a, b) => (aggregateCounts[b] || 0) - (aggregateCounts[a] || 0))
      .slice(0, size)
  );
  return Object.fromEntries(contexts.map((context) => [context, selected.has(context) ? 1 : 0]));
}

function scaleSpectrumToBurden(spectrum, contexts, targetBurden) {
  const values = contexts.map((context) => Number(spectrum[context]) || 0);
  const total = sum(values);
  if (total <= 0 || targetBurden <= 0) {
    return Object.fromEntries(contexts.map((context) => [context, 0]));
  }
  const expected = normalizeVector(values, targetBurden);
  const floors = expected.map(Math.floor);
  let remainder = targetBurden - sum(floors);
  const order = expected
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i++) {
    floors[order[i % order.length].index] += 1;
  }
  return Object.fromEntries(contexts.map((context, index) => [context, floors[index]]));
}

function summarize(rows, keys) {
  const groups = new Map();
  for (const row of rows) {
    const key = keys.map((field) => row[field]).join("|");
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  return [...groups.entries()].map(([, groupRows]) => {
    const base = Object.fromEntries(keys.map((field) => [field, groupRows[0][field]]));
    const accuracies = groupRows.map((row) => row.tierMatchesTruth ? 1 : 0);
    const cosines = groupRows
      .map((row) => row.panelVsWgsExposureCosine)
      .filter(Number.isFinite);
    return {
      ...base,
      calls: groupRows.length,
      tierAccuracy: sum(accuracies) / groupRows.length,
      meanPanelVsWgsExposureCosine:
        cosines.length === 0 ? null : sum(cosines) / cosines.length,
      medianPanelTotal: quantile(
        groupRows.map((row) => row.panelTotal).filter(Number.isFinite),
        0.5
      ),
    };
  });
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
    "Callable mask",
    "WGS truth exposure",
    "Panel burden",
    "Calls (n)",
    "Tier accuracy",
    "Mean exposure cosine",
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Panel downsampling validation</title>
</head>
<body>
<p style="font-family:Arial, Helvetica, sans-serif;font-size:11pt;line-height:1.3;margin:0 0 6px 0;color:#111827"><strong>Panel downsampling validation.</strong> PCAWG Lung-AdenoCA WGS spectra were restricted to PCAWG-derived callable-context masks and reviewed with the panel workflow.</p>
<table style="${tableStyle}">
<thead><tr>${headers.map((header) => `<th style="${thStyle}">${htmlEscape(header)}</th>`).join("")}</tr></thead>
<tbody>
${summaryRows
  .map((row) => {
    const cells = [
      `${row.callableContextCount} contexts`,
      row.truthExposureBin,
      row.panelBurdenBin,
      row.calls,
      row.tierAccuracy.toFixed(3),
      Number.isFinite(row.meanPanelVsWgsExposureCosine)
        ? row.meanPanelVsWgsExposureCosine.toFixed(3)
        : "NA",
    ];
    return `<tr>${cells.map((cell) => `<td style="${tdStyle}">${htmlEscape(cell)}</td>`).join("")}</tr>`;
  })
  .join("\n")}
</tbody>
</table>
<p style="font-family:Arial, Helvetica, sans-serif;font-size:9.5pt;line-height:1.3;margin:6px 0 20px 0;color:#4b5563"><em>Note.</em> WGS truth was defined by mSigSDK NNLS refitting of the original PCAWG Lung-AdenoCA SBS96 spectra against the nine-signature catalog. Panel spectra were deterministic downsampled spectra generated by createWGStoPanelValidationPairs using the top 24, 48, or 72 SBS96 contexts by aggregate WGS burden as callable masks. Tier accuracy compares panel workflow tiers with WGS exposure thresholds of 0.20 for higher review support and 0.05 for limited review support.</p>
</body>
</html>
`;
}

function buildFigureSvg(summaryRows) {
  const width = 900;
  const height = 520;
  const margin = { top: 50, right: 30, bottom: 70, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const orderedRows = [...summaryRows].sort((a, b) =>
    a.callableContextCount - b.callableContextCount ||
    a.truthExposureBin.localeCompare(b.truthExposureBin) ||
    a.panelBurdenBin.localeCompare(b.panelBurdenBin)
  );
  const xLabels = [...new Set(orderedRows.map((row) => `${row.callableContextCount} ctx`))];
  const color = {
    "<0.05": "#0072B2",
    "0.05-<0.20": "#E69F00",
    ">=0.20": "#009E73",
  };
  const x = (label) =>
    margin.left +
    (xLabels.indexOf(label) + 0.5) * (innerWidth / Math.max(xLabels.length, 1));
  const y = (value) => margin.top + innerHeight - value * innerHeight;
  const points = orderedRows.map((row) => ({
    ...row,
    x: x(`${row.callableContextCount} ctx`),
    y: y(row.tierAccuracy),
  }));
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Panel validation tier accuracy by callable context mask and WGS exposure level">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="${margin.left}" y="28" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#111827">Panel validation with PCAWG-derived callable-context masks</text>
  <text x="${margin.left}" y="48" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#4b5563">Evidence-tier accuracy versus WGS-derived exposure truth</text>
  ${yTicks
    .map(
      (tick) => `<g>
    <line x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" stroke="#e5e7eb"/>
    <text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#4b5563">${tick.toFixed(2)}</text>
  </g>`
    )
    .join("\n")}
  <line x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}" stroke="#111827"/>
  <line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${height - margin.bottom}" stroke="#111827"/>
  ${xLabels
    .map(
      (label) => `<text x="${x(label)}" y="${height - margin.bottom + 24}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#111827">${label}</text>`
    )
    .join("\n")}
  <text x="${margin.left + innerWidth / 2}" y="${height - 20}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#111827">Callable SBS96 contexts retained</text>
  <text transform="translate(20 ${margin.top + innerHeight / 2}) rotate(-90)" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#111827">Evidence-tier accuracy</text>
  ${points
    .map((point, index) => {
      const jitter = point.panelBurdenBin === "<30" ? -12 : point.panelBurdenBin === "30-<150" ? 0 : 12;
      return `<circle cx="${point.x + jitter}" cy="${point.y}" r="${Math.max(4, Math.min(12, Math.sqrt(point.calls)))}" fill="${color[point.truthExposureBin]}" fill-opacity="0.78" stroke="#111827" stroke-width="0.7">
    <title>${point.callableContextCount} contexts, exposure ${point.truthExposureBin}, burden ${point.panelBurdenBin}: accuracy ${point.tierAccuracy.toFixed(3)}, n=${point.calls}</title>
  </circle>`;
    })
    .join("\n")}
  ${Object.entries(color)
    .map(
      ([label, fill], index) => `<g transform="translate(${width - 260} ${80 + index * 24})">
    <circle cx="0" cy="0" r="6" fill="${fill}" fill-opacity="0.78" stroke="#111827" stroke-width="0.7"/>
    <text x="14" y="4" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#111827">WGS exposure ${label}</text>
  </g>`
    )
    .join("\n")}
</svg>
`;
}

function buildFigureHtml(dataRows) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Panel validation figure</title>
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #ffffff; }
    #figure { width: 920px; margin: 24px auto; }
  </style>
</head>
<body>
  <div id="figure"></div>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script>
const rows = ${JSON.stringify(dataRows, null, 2)};
const width = 900;
const height = 520;
const margin = { top: 50, right: 30, bottom: 70, left: 70 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;
const color = new Map([["<0.05", "#0072B2"], ["0.05-<0.20", "#E69F00"], [">=0.20", "#009E73"]]);
const xLabels = Array.from(new Set(rows.map((row) => row.callableContextCount + " ctx")));
const x = d3.scalePoint().domain(xLabels).range([margin.left + innerWidth / (xLabels.length * 2), width - margin.right - innerWidth / (xLabels.length * 2)]);
const y = d3.scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);
const svg = d3.select("#figure").append("svg").attr("width", width).attr("height", height).attr("viewBox", [0, 0, width, height]);
svg.append("rect").attr("width", width).attr("height", height).attr("fill", "#fff");
svg.append("text").attr("x", margin.left).attr("y", 28).attr("font-size", 20).attr("font-weight", 700).text("Panel validation with PCAWG-derived callable-context masks");
svg.append("text").attr("x", margin.left).attr("y", 48).attr("font-size", 12).attr("fill", "#4b5563").text("Evidence-tier accuracy versus WGS-derived exposure truth");
svg.append("g").attr("transform", "translate(" + margin.left + ",0)").call(d3.axisLeft(y).ticks(4));
svg.append("g").attr("transform", "translate(0," + (height - margin.bottom) + ")").call(d3.axisBottom(x));
svg.selectAll(".grid").data(y.ticks(4)).join("line").attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", d => y(d)).attr("y2", d => y(d)).attr("stroke", "#e5e7eb").lower();
svg.selectAll("circle.point").data(rows).join("circle")
  .attr("class", "point")
  .attr("cx", d => x(d.callableContextCount + " ctx") + (d.panelBurdenBin === "<30" ? -12 : d.panelBurdenBin === "30-<150" ? 0 : 12))
  .attr("cy", d => y(d.tierAccuracy))
  .attr("r", d => Math.max(4, Math.min(12, Math.sqrt(d.calls))))
  .attr("fill", d => color.get(d.truthExposureBin))
  .attr("fill-opacity", 0.78)
  .attr("stroke", "#111827")
  .append("title")
  .text(d => d.callableContextCount + " contexts, exposure " + d.truthExposureBin + ", burden " + d.panelBurdenBin + ": accuracy " + d.tierAccuracy.toFixed(3) + ", n=" + d.calls);
svg.append("text").attr("x", margin.left + innerWidth / 2).attr("y", height - 20).attr("text-anchor", "middle").attr("font-size", 13).text("Callable SBS96 contexts retained");
svg.append("text").attr("transform", "translate(20 " + (margin.top + innerHeight / 2) + ") rotate(-90)").attr("text-anchor", "middle").attr("font-size", 13).text("Evidence-tier accuracy");
Array.from(color.entries()).forEach(([label, fill], index) => {
  const g = svg.append("g").attr("transform", "translate(" + (width - 260) + " " + (80 + index * 24) + ")");
  g.append("circle").attr("r", 6).attr("fill", fill).attr("fill-opacity", 0.78).attr("stroke", "#111827");
  g.append("text").attr("x", 14).attr("y", 4).attr("font-size", 12).text("WGS exposure " + label);
});
  </script>
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
  const contexts = Object.keys(snapshot.groupedSpectra[snapshot.sampleNames[0]]);
  const sampleNames = snapshot.sampleNames;
  const spectra = subsetMatrix(snapshot.groupedSpectra, sampleNames, contexts);
  const signatures = subsetMatrix(snapshot.referenceSignatures, SELECTED_SIGNATURES, contexts);
  const aggregateCounts = aggregateContextCounts(spectra, contexts);
  const referenceOpportunities = Object.fromEntries(contexts.map((context) => [context, 1]));
  const wgsExposures = await fitSpectraWithNNLS(signatures, spectra, {
    contexts,
    exposureThreshold: FIT_EXPOSURE_THRESHOLD,
    renormalize: true,
  });
  const rows = [];
  const pairSummaries = [];

  for (const maskSize of CALLABLE_MASK_SIZES) {
    const callableMask = createRankedMask(contexts, aggregateCounts, maskSize);
    const pairs = createWGStoPanelValidationPairs(spectra, callableMask, {
      contexts,
      referenceOpportunities,
      binaryMask: true,
      roundCounts: true,
    });
    for (const targetPanelBurden of PANEL_BURDEN_LEVELS) {
      const panelSpectra = Object.fromEntries(
        pairs.pairs.map((pair) => [
          pair.sample,
          scaleSpectrumToBurden(pair.panelSpectrum, contexts, targetPanelBurden),
        ])
      );
      const panelResult = await runPanelWorkflow(
        {
          spectra: panelSpectra,
          signatures,
          callableOpportunities: callableMask,
          referenceOpportunities,
          genomeVersion: "GRCh37/hg19",
          opportunitySource: "pcawg_lung_adeno_context_ranked_mask",
          referenceOpportunitySource: "uniform_sbs96_context_reference",
        },
        {
          contexts,
          exposureThreshold: FIT_EXPOSURE_THRESHOLD,
          minAssessableMutations: MIN_ASSESSABLE_MUTATIONS,
          higherSupportExposureThreshold: HIGHER_SUPPORT_EXPOSURE,
          limitedSupportExposureThreshold: LIMITED_SUPPORT_EXPOSURE,
          lowBurdenThreshold: 100,
          moderateBurdenThreshold: 1000,
          bootstrapIterations: 0,
        }
      );

      for (const pair of pairs.pairs) {
        const scaledPanelSpectrum = panelSpectra[pair.sample];
        const scaledPanelTotal = sum(vector(scaledPanelSpectrum, contexts));
        const panelExposure = panelResult.fit.exposures[pair.sample] || {};
        const wgsExposure = wgsExposures[pair.sample] || {};
        const panelVsWgsExposureCosine = cosineSimilarity(
          vector(panelExposure, SELECTED_SIGNATURES),
          vector(wgsExposure, SELECTED_SIGNATURES)
        );
        pairSummaries.push({
          sample: pair.sample,
          callableContextCount: maskSize,
          targetPanelBurden,
          wgsTotal: pair.wgsTotal,
          panelTotal: scaledPanelTotal,
          basePanelTotal: pair.panelTotal,
          retainedMutationFraction:
            pair.wgsTotal === 0 ? null : scaledPanelTotal / pair.wgsTotal,
          panelVsWgsExposureCosine,
        });

        const sampleEvidence = panelResult.evidenceCalls[pair.sample] || [];
        const evidenceBySignature = Object.fromEntries(
          sampleEvidence.map((call) => [call.signatureName, call])
        );

        for (const signatureName of SELECTED_SIGNATURES) {
          const truthExposure = Number(wgsExposure[signatureName]) || 0;
          const evidence = evidenceBySignature[signatureName] || {};
          const callableSignatureMass =
            evidence.restrictedAssayEvidence?.callableEvidence
              ?.signatureMassInCallableContexts ?? null;
          const expected = expectedTier({
            truthExposure,
            panelTotal: scaledPanelTotal,
            callableSignatureMass,
          });
          const actual = evidence.tier || "not_detected_within_review_settings";
          rows.push({
            sample: pair.sample,
            callableContextCount: maskSize,
            targetPanelBurden,
            signatureName,
            wgsExposure: truthExposure,
            panelExposure: Number(panelExposure[signatureName]) || 0,
            wgsTotal: pair.wgsTotal,
            panelTotal: scaledPanelTotal,
            basePanelTotal: pair.panelTotal,
            retainedMutationFraction:
              pair.wgsTotal === 0 ? null : scaledPanelTotal / pair.wgsTotal,
            callableSignatureMass,
            truthExposureBin: exposureBin(truthExposure),
            panelBurdenBin: burdenBin(scaledPanelTotal),
            expectedTier: expected,
            observedTier: actual,
            tierMatchesTruth: actual === expected,
            panelVsWgsExposureCosine,
            fitQualityReportingMode: evidence.fitQualityReportingMode || null,
          });
        }
      }
    }
  }

  const byExposureAndBurden = summarize(rows, [
    "callableContextCount",
    "truthExposureBin",
    "panelBurdenBin",
  ]).sort((a, b) =>
    a.callableContextCount - b.callableContextCount ||
    a.truthExposureBin.localeCompare(b.truthExposureBin) ||
    a.panelBurdenBin.localeCompare(b.panelBurdenBin)
  );
  const byMask = summarize(rows, ["callableContextCount"]).sort(
    (a, b) => a.callableContextCount - b.callableContextCount
  );

  await writeFile(
    join(dataDir, "panel_validation_sample_signature_calls.csv"),
    toCsv(
      [
        "sample",
        "callableContextCount",
        "targetPanelBurden",
        "signatureName",
        "wgsExposure",
        "panelExposure",
        "wgsTotal",
        "panelTotal",
        "basePanelTotal",
        "retainedMutationFraction",
        "callableSignatureMass",
        "truthExposureBin",
        "panelBurdenBin",
        "expectedTier",
        "observedTier",
        "tierMatchesTruth",
        "panelVsWgsExposureCosine",
        "fitQualityReportingMode",
      ],
      rows.map((row) => [
        row.sample,
        row.callableContextCount,
        row.targetPanelBurden,
        row.signatureName,
        row.wgsExposure,
        row.panelExposure,
        row.wgsTotal,
        row.panelTotal,
        row.basePanelTotal,
        row.retainedMutationFraction,
        row.callableSignatureMass,
        row.truthExposureBin,
        row.panelBurdenBin,
        row.expectedTier,
        row.observedTier,
        row.tierMatchesTruth,
        row.panelVsWgsExposureCosine,
        row.fitQualityReportingMode,
      ])
    )
  );
  await writeFile(
    join(dataDir, "panel_validation_pair_summary.csv"),
    toCsv(
      [
        "sample",
        "callableContextCount",
        "targetPanelBurden",
        "wgsTotal",
        "panelTotal",
        "basePanelTotal",
        "retainedMutationFraction",
        "panelVsWgsExposureCosine",
      ],
      pairSummaries.map((row) => [
        row.sample,
        row.callableContextCount,
        row.targetPanelBurden,
        row.wgsTotal,
        row.panelTotal,
        row.basePanelTotal,
        row.retainedMutationFraction,
        row.panelVsWgsExposureCosine,
      ])
    )
  );
  await writeFile(
    join(dataDir, "panel_validation_tier_accuracy.csv"),
    toCsv(
      [
        "callableContextCount",
        "truthExposureBin",
        "panelBurdenBin",
        "calls",
        "tierAccuracy",
        "meanPanelVsWgsExposureCosine",
        "medianPanelTotal",
      ],
      byExposureAndBurden.map((row) => [
        row.callableContextCount,
        row.truthExposureBin,
        row.panelBurdenBin,
        row.calls,
        row.tierAccuracy,
        row.meanPanelVsWgsExposureCosine,
        row.medianPanelTotal,
      ])
    )
  );
  await writeFile(
    join(dataDir, "panel_validation_mask_summary.csv"),
    toCsv(
      [
        "callableContextCount",
        "calls",
        "tierAccuracy",
        "meanPanelVsWgsExposureCosine",
        "medianPanelTotal",
      ],
      byMask.map((row) => [
        row.callableContextCount,
        row.calls,
        row.tierAccuracy,
        row.meanPanelVsWgsExposureCosine,
        row.medianPanelTotal,
      ])
    )
  );
  await writeFile(
    join(dataDir, "panel-downsampling-validation-results.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: {
          snapshot: SNAPSHOT_PATH,
          study: snapshot.study,
          cancerType: snapshot.cancerType,
          sampleCount: sampleNames.length,
        },
        selectedSignatures: SELECTED_SIGNATURES,
        callableMaskSizes: CALLABLE_MASK_SIZES,
        panelBurdenLevels: PANEL_BURDEN_LEVELS,
        thresholds: {
          fitExposureThreshold: FIT_EXPOSURE_THRESHOLD,
          limitedSupportExposure: LIMITED_SUPPORT_EXPOSURE,
          higherSupportExposure: HIGHER_SUPPORT_EXPOSURE,
          minAssessableMutations: MIN_ASSESSABLE_MUTATIONS,
        },
        summaryByMask: byMask,
        summaryByExposureAndBurden: byExposureAndBurden,
      },
      null,
      2
    )
  );

  const tableHtml = buildTableHtml(byExposureAndBurden);
  const figureSvg = buildFigureSvg(byExposureAndBurden);
  const figureHtml = buildFigureHtml(byExposureAndBurden);
  await writeFile(join(tableDir, "table_panel_validation_tier_accuracy.html"), tableHtml);
  await writeFile(join(figureDir, "figure_panel_validation_tier_accuracy.svg"), figureSvg);
  await writeFile(join(figureDir, "figure_panel_validation_tier_accuracy.html"), figureHtml);

  console.log(
    JSON.stringify(
      {
        sampleCount: sampleNames.length,
        calls: rows.length,
        summaryByMask: byMask,
        outputs: {
          sampleSignatureCalls: join(dataDir, "panel_validation_sample_signature_calls.csv"),
          tierAccuracy: join(dataDir, "panel_validation_tier_accuracy.csv"),
          results: join(dataDir, "panel-downsampling-validation-results.json"),
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
