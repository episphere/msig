import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inputPath = path.join(
  root,
  "docs/manuscript/experiments/hardware_scaling_characterization/data/bootstrap-parallel-hardware-limits.json"
);
const tableDir = path.join(root, "docs/manuscript/tables");
const figureDir = path.join(root, "docs/manuscript/figures");

const data = JSON.parse(await readFile(inputPath, "utf8"));
const summaries = data.summary.scenarioSummaries;
const heap = data.summary.heapSummary;

const rows = [
  makeRow({
    workload: "Single sample bootstrap",
    size: "67 signatures x 96 contexts; 500 iterations",
    serialId: "single_500_serial",
    workerId: "single_500_parallel_4",
    heapId: "single_500_parallel_2",
  }),
  makeRow({
    workload: "120-sample cohort bootstrap",
    size: "67 signatures x 96 contexts; 25 iterations/sample",
    serialId: "cohort_120_iter25_serial",
    workerId: "cohort_120_iter25_parallel_4",
    heapId: "cohort_120_iter25_parallel_4",
  }),
  makeRow({
    workload: "300-sample cohort bootstrap",
    size: "40 signatures x 96 contexts; 10 iterations/sample",
    serialId: null,
    workerId: "cohort_300_iter10_parallel_4",
    heapId: null,
  }),
];

await mkdir(tableDir, { recursive: true });
await mkdir(figureDir, { recursive: true });
await writeFile(
  path.join(tableDir, "tableC_bootstrap_hardware_limits.csv"),
  toCsv(rows),
  "utf8"
);
await writeFile(
  path.join(tableDir, "tableC_bootstrap_hardware_limits.md"),
  toMarkdown(rows),
  "utf8"
);
await writeFile(
  path.join(figureDir, "figureS-bootstrap-hardware-limits.svg"),
  buildSvg(rows),
  "utf8"
);

console.log(
  JSON.stringify(
    {
      tableCsv: "docs/manuscript/tables/tableC_bootstrap_hardware_limits.csv",
      tableMarkdown: "docs/manuscript/tables/tableC_bootstrap_hardware_limits.md",
      figureSvg: "docs/manuscript/figures/figureS-bootstrap-hardware-limits.svg",
      input: path.relative(root, inputPath).replaceAll("\\", "/"),
    },
    null,
    2
  )
);

function makeRow({ workload, size, serialId, workerId, heapId }) {
  const serial = serialId ? summaries[serialId] : null;
  const worker = summaries[workerId];
  const serialMs = serial?.elapsedMs?.median ?? null;
  const workerMs = worker.elapsedMs.median;
  const speedup = serialMs ? serialMs / workerMs : null;
  const lowerBoundMiB = heapId
    ? heap[heapId]?.minimumPassingNodeHeapCapMiB ?? null
    : null;
  return {
    workload,
    size,
    serialMedianSeconds: serialMs === null ? null : serialMs / 1000,
    workerMedianSeconds: workerMs / 1000,
    speedup,
    workerCount: worker.workerCountUsed,
    workerMedianPeakRssMiB: worker.peakRssMiB.median,
    testedNodeHeapLowerBoundMiB: lowerBoundMiB,
    interpretation:
      "Synthetic Node worker-thread stress test; not a universal browser RAM minimum.",
  };
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return Number(value).toFixed(digits);
}

function toCsv(rows) {
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

function toMarkdown(rows) {
  const headers = [
    "Workload",
    "Size",
    "Serial median (s)",
    "4-worker median (s)",
    "Speedup",
    "Peak RSS, workers (MiB)",
    "Tested Node heap lower bound (MiB)",
  ];
  const body = rows.map((row) => [
    row.workload,
    row.size,
    formatNumber(row.serialMedianSeconds),
    formatNumber(row.workerMedianSeconds),
    row.speedup ? `${formatNumber(row.speedup, 2)}x` : "",
    formatNumber(row.workerMedianPeakRssMiB, 0),
    row.testedNodeHeapLowerBoundMiB ?? "",
  ]);
  return [
    "# Table C. Bootstrap Worker Hardware Stress Tests",
    "",
    "Synthetic native-JavaScript bootstrap workloads measured under Node.js worker threads on the Windows benchmark host. Heap lower bounds are Node heap-cap checks, not universal browser system-memory requirements.",
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
    "",
  ].join("\n");
}

function buildSvg(rows) {
  const width = 980;
  const height = 430;
  const margin = { top: 76, right: 60, bottom: 78, left: 260 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxSeconds = Math.max(
    ...rows.flatMap((row) => [
      row.serialMedianSeconds || 0,
      row.workerMedianSeconds || 0,
    ])
  );
  const scale = plotWidth / (maxSeconds * 1.15);
  const rowGap = plotHeight / rows.length;
  const barHeight = 18;
  const serialColor = "#9CA3AF";
  const workerColor = "#0072B2";
  const textColor = "#172026";
  const muted = "#53616f";
  const grid = "#d8dee6";

  const xTicks = [0, 3, 6, 9, 12, 15].filter((tick) => tick <= maxSeconds * 1.15);
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`);
  parts.push(`<title id="title">Bootstrap worker hardware stress tests</title>`);
  parts.push(`<desc id="desc">Median runtime and peak memory for synthetic bootstrap workloads measured under Node worker threads.</desc>`);
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
  parts.push(`<text x="28" y="34" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${textColor}">Bootstrap worker stress tests</text>`);
  parts.push(`<text x="28" y="58" font-family="Arial, sans-serif" font-size="13" fill="${muted}">Synthetic Node.js native-core workloads; bars show median runtime, labels show worker peak RSS.</text>`);

  for (const tick of xTicks) {
    const x = margin.left + tick * scale;
    parts.push(`<line x1="${x}" y1="${margin.top - 8}" x2="${x}" y2="${height - margin.bottom + 8}" stroke="${grid}" stroke-width="1"/>`);
    parts.push(`<text x="${x}" y="${height - margin.bottom + 30}" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="${muted}">${tick}</text>`);
  }
  parts.push(`<text x="${margin.left + plotWidth / 2}" y="${height - 24}" font-family="Arial, sans-serif" font-size="13" text-anchor="middle" fill="${muted}">Median runtime (seconds, lower is faster)</text>`);

  rows.forEach((row, index) => {
    const y = margin.top + index * rowGap + 22;
    const labelY = y + barHeight;
    parts.push(`<text x="${margin.left - 14}" y="${labelY - 2}" font-family="Arial, sans-serif" font-size="13" font-weight="700" text-anchor="end" fill="${textColor}">${escapeXml(row.workload)}</text>`);
    parts.push(`<text x="${margin.left - 14}" y="${labelY + 16}" font-family="Arial, sans-serif" font-size="11" text-anchor="end" fill="${muted}">${escapeXml(row.size)}</text>`);

    if (row.serialMedianSeconds !== null) {
      parts.push(`<rect x="${margin.left}" y="${y}" width="${row.serialMedianSeconds * scale}" height="${barHeight}" fill="${serialColor}"/>`);
      parts.push(`<text x="${margin.left + row.serialMedianSeconds * scale + 8}" y="${y + 14}" font-family="Arial, sans-serif" font-size="12" fill="${muted}">${formatNumber(row.serialMedianSeconds)}s serial</text>`);
    }
    const workerY = y + barHeight + 8;
    parts.push(`<rect x="${margin.left}" y="${workerY}" width="${row.workerMedianSeconds * scale}" height="${barHeight}" fill="${workerColor}"/>`);
    parts.push(`<text x="${margin.left + row.workerMedianSeconds * scale + 8}" y="${workerY + 14}" font-family="Arial, sans-serif" font-size="12" fill="${textColor}">${formatNumber(row.workerMedianSeconds)}s, ${formatNumber(row.workerMedianPeakRssMiB, 0)} MiB RSS</text>`);
  });

  parts.push(`<rect x="28" y="${height - 62}" width="12" height="12" fill="${serialColor}"/>`);
  parts.push(`<text x="46" y="${height - 52}" font-family="Arial, sans-serif" font-size="12" fill="${muted}">Serial</text>`);
  parts.push(`<rect x="112" y="${height - 62}" width="12" height="12" fill="${workerColor}"/>`);
  parts.push(`<text x="130" y="${height - 52}" font-family="Arial, sans-serif" font-size="12" fill="${muted}">4 workers</text>`);
  parts.push(`</svg>`);
  return parts.join("\n");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
