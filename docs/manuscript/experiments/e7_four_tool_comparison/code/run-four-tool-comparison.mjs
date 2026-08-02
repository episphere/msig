import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAdapterComparisonContract } from "../../../../../mSigSDKScripts/adapters.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const exp = path.join(root, "docs", "manuscript", "experiments", "e7_four_tool_comparison");
const dataDir = path.join(exp, "data");
const figureDir = path.join(exp, "figures");
const inputPath = path.join(root, "docs", "manuscript", "experiments", "e2_adapter_fidelity", "data", "adapter-fidelity-input.json");
const pairPath = path.join(root, "docs", "manuscript", "experiments", "e2_adapter_fidelity", "data", "adapter-fidelity-exposure-pairs.json");

const input = JSON.parse(await readFile(inputPath, "utf8"));
const pairs = JSON.parse(await readFile(pairPath, "utf8")).rows;
const tools = ["deconstructsigs", "sigminer", "sigprofilerassignment", "musical"];
const labels = { deconstructsigs: "deconstructSigs", sigminer: "sigminer", sigprofilerassignment: "SigProfilerAssignment", musical: "MuSiCal" };
const threshold = 0.01;
const signatures = input.signatureNames;
const samples = input.sampleNames;
const nonNegativeFinite = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

function sum(xs) { return xs.reduce((a, b) => a + b, 0); }
function dot(a, b) { return a.reduce((s, x, i) => s + x * b[i], 0); }
function norm(a) { return Math.sqrt(dot(a, a)); }
function cosine(a, b) { const d = norm(a) * norm(b); return d ? dot(a, b) / d : null; }
function mean(xs) { return xs.length ? sum(xs) / xs.length : null; }
function median(xs) { const a = [...xs].sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function pearson(a, b) { const ma = mean(a), mb = mean(b); const xa = a.map(x => x - ma), xb = b.map(x => x - mb); const d = norm(xa) * norm(xb); return d ? dot(xa, xb) / d : null; }
function csvCell(x) { const s = x == null ? "" : typeof x === "object" ? JSON.stringify(x) : String(x); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
async function csv(file, rows) { const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]; await writeFile(file, `${cols.join(",")}\n${rows.map(r => cols.map(c => csvCell(r[c])).join(",")).join("\n")}\n`); }

const raw = Object.fromEntries(tools.map(t => [t, Object.fromEntries(samples.map(s => [s, Object.fromEntries(signatures.map(sig => [sig, 0]))]))]));
for (const row of pairs) raw[row.tool][row.sample][row.signature] = nonNegativeFinite(row.browserExposure);

// Common post-processing: complete catalog, zero tolerance, 1% relative exposure cutoff, renormalization.
const harmonized = Object.fromEntries(tools.map(t => [t, Object.fromEntries(samples.map(s => {
  const v = signatures.map(sig => raw[t][s][sig]);
  const kept = v.map(x => x >= threshold ? x : 0);
  const total = sum(kept);
  return [s, Object.fromEntries(signatures.map((sig, i) => [sig, total ? kept[i] / total : 0]))];
}))]));

const contexts = input.contexts;
const comparisonContract = createAdapterComparisonContract({
  contexts,
  signatureNames: signatures,
  cutoff: threshold,
  randomSeed: 104729,
});
const catalog = signatures.map(sig => { const v = contexts.map(c => Number(input.signatures?.[sig]?.[c]) || 0); const total = sum(v); return total ? v.map(x => x / total) : v; });
const observed = samples.map(s => { const v = contexts.map(c => Number(input.spectra[s]?.[c]) || 0); const total = sum(v); return total ? v.map(x => x / total) : v; });
function reconstruction(t, s) { const x = signatures.map((sig, i) => harmonized[t][s][sig]); const pred = contexts.map((_, j) => sum(catalog.map((col, i) => col[j] * x[i]))); return cosine(observed[samples.indexOf(s)], pred); }
const pairRows = [];
for (let i = 0; i < tools.length; i++) for (let j = i + 1; j < tools.length; j++) {
  const a = tools[i], b = tools[j], av = [], bv = [], sampleL1 = [], sampleMax = [], jaccard = [];
  for (const s of samples) {
    const x = signatures.map(sig => harmonized[a][s][sig]); const y = signatures.map(sig => harmonized[b][s][sig]); av.push(...x); bv.push(...y);
    const diffs = x.map((v, k) => Math.abs(v - y[k])); sampleL1.push(sum(diffs)); sampleMax.push(Math.max(...diffs));
    const ax = new Set(signatures.filter((sig, k) => x[k] > 0)); const bx = new Set(signatures.filter((sig, k) => y[k] > 0)); const union = new Set([...ax, ...bx]);
    jaccard.push(union.size ? [...ax].filter(sig => bx.has(sig)).length / union.size : 1);
  }
  pairRows.push({ toolA: labels[a], toolB: labels[b], pair: `${labels[a]} vs ${labels[b]}`, exposurePearson: pearson(av, bv), meanSampleL1: mean(sampleL1), medianSampleL1: median(sampleL1), maxSampleL1: Math.max(...sampleL1), meanSampleMaxAbs: mean(sampleMax), meanActiveJaccard: mean(jaccard) });
}
const sampleRows = [];
for (const s of samples) for (const t of tools) sampleRows.push({ sample: s, tool: labels[t], activeSignatureCount: signatures.filter(sig => harmonized[t][s][sig] > 0).length, reconstructionCosine: reconstruction(t, s), totalRawFraction: sum(signatures.map(sig => raw[t][s][sig])), threshold: threshold });
const discrepancyRows = [];
for (const sig of signatures) {
  const values = samples.flatMap(s => tools.map(t => harmonized[t][s][sig]));
  discrepancyRows.push({ signature: sig, meanExposure: mean(values), acrossToolRangeMean: mean(samples.map(s => Math.max(...tools.map(t => harmonized[t][s][sig])) - Math.min(...tools.map(t => harmonized[t][s][sig])))), maxAcrossToolRange: Math.max(...samples.map(s => Math.max(...tools.map(t => harmonized[t][s][sig])) - Math.min(...tools.map(t => harmonized[t][s][sig])))) });
}
discrepancyRows.sort((a, b) => b.acrossToolRangeMean - a.acrossToolRangeMean);
const summaryRows = tools.map(t => ({ tool: labels[t], samples: samples.length, catalogSignatures: signatures.length, threshold, meanActiveSignatureCount: mean(samples.map(s => signatures.filter(sig => harmonized[t][s][sig] > 0).length)), medianActiveSignatureCount: median(samples.map(s => signatures.filter(sig => harmonized[t][s][sig] > 0).length)), meanReconstructionCosine: mean(samples.map(s => reconstruction(t, s))), minReconstructionCosine: Math.min(...samples.map(s => reconstruction(t, s))), maxReconstructionCosine: Math.max(...samples.map(s => reconstruction(t, s))) }));

function heatmapSvg() {
  const w = 1200, h = 760, panelW = 560, panelH = 310, margin = 58;
  const esc = s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  function matrix(rows, field, x, y, title, min = 0, max = 1) { const n = tools.length, cell = 70; let out = `<g transform="translate(${x},${y})"><text x="0" y="-22" font-size="18" font-weight="700">${esc(title)}</text>`; for (let i=0;i<n;i++) for (let j=0;j<n;j++) { const r = i===j ? null : rows.find(z => (z.toolA===labels[tools[Math.min(i,j)]] && z.toolB===labels[tools[Math.max(i,j)]]) ); const v = i===j ? 1 : (r?.[field] ?? 0); const t = Math.max(0, Math.min(1, (v-min)/(max-min))); const c = `rgb(${Math.round(245-160*t)},${Math.round(248-110*t)},${Math.round(255-30*t)})`; out += `<rect x="${j*cell}" y="${i*cell}" width="${cell-2}" height="${cell-2}" fill="${c}" stroke="white"/><text x="${j*cell+cell/2}" y="${i*cell+cell/2+5}" text-anchor="middle" font-size="13">${v.toFixed(3)}</text>`; } for(let i=0;i<n;i++){out+=`<text x="${i*cell+cell/2}" y="${n*cell+17}" text-anchor="middle" font-size="12">${esc(labels[tools[i]])}</text><text x="-8" y="${i*cell+cell/2+4}" text-anchor="end" font-size="12">${esc(labels[tools[i]])}</text>`;} return out+`</g>`; }
  const maxDis = Math.max(...pairRows.map(r => r.meanSampleL1)); let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img"><rect width="100%" height="100%" fill="white"/><text x="${w/2}" y="28" text-anchor="middle" font-size="22" font-weight="700">Four-tool comparison after common post-processing</text>`;
  svg += matrix(pairRows, "exposurePearson", 90, 95, "A. Flattened exposure Pearson correlation", -1, 1);
  svg += matrix(pairRows, "meanActiveJaccard", 650, 95, "B. Mean active-signature Jaccard", 0, 1);
  const barX=90, barY=440, barW=1000; svg += `<g transform="translate(${barX},${barY})"><text x="0" y="-22" font-size="18" font-weight="700">C. Mean per-sample L1 disagreement</text>`; pairRows.forEach((r,i)=>{const y=i*38; const width=maxDis?Math.max(2,r.meanSampleL1/maxDis*barW):0; svg+=`<text x="0" y="${y+16}" font-size="12">${esc(r.pair)}</text><rect x="260" y="${y+3}" width="${width}" height="22" fill="#e07a5f"/><text x="${270+width}" y="${y+19}" font-size="12">${r.meanSampleL1.toFixed(4)}</text>`}); svg += `</g><text x="${barX}" y="720" font-size="12">Active signatures: harmonized exposure ≥ ${threshold}; reconstruction uses the normalized 67-column catalog and normalized observed spectra.</text></svg>`; return svg;
}

await mkdir(dataDir, { recursive: true }); await mkdir(figureDir, { recursive: true });
await csv(path.join(dataDir, "pairwise-comparison.csv"), pairRows);
await csv(path.join(dataDir, "sample-tool-metrics.csv"), sampleRows);
await csv(path.join(dataDir, "signature-discrepancy-ranking.csv"), discrepancyRows);
await csv(path.join(dataDir, "tool-summary.csv"), summaryRows);
await writeFile(path.join(dataDir, "four-tool-comparison-results.json"), JSON.stringify({ schemaVersion: "msig.manuscript.experiment.v1", generatedAt: new Date().toISOString(), experimentId: "e7_four_tool_comparison", status: "completed", comparisonContract, inputs: { sourceFidelityInput: path.relative(root, inputPath), sourceExposurePairs: path.relative(root, pairPath), sampleCount: samples.length, contextCount: contexts.length, catalogSignatureCount: signatures.length }, tools: summaryRows, pairwise: pairRows, largestDiscrepancies: discrepancyRows.slice(0, 15) }, null, 2) + "\n");
await writeFile(path.join(figureDir, "figure-e7-four-tool-comparison.svg"), heatmapSvg());
console.log(JSON.stringify({ status: "completed", sampleCount: samples.length, signatureCount: signatures.length, threshold, summaryRows, pairRows, largestDiscrepancies: discrepancyRows.slice(0, 10) }, null, 2));
