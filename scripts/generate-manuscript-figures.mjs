#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FIGURE_DIR = "docs/manuscript/figures";

const COLORS = {
  ink: "#182033",
  muted: "#667085",
  faint: "#EEF2F6",
  line: "#D6DEE8",
  blue: "#2F80ED",
  teal: "#008C95",
  green: "#27AE60",
  orange: "#F2994A",
  red: "#D95F02",
  purple: "#7B61FF",
  yellow: "#F2C94C",
  white: "#FFFFFF",
};

const SBS_COLORS = ["#1f77b4", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2"];

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function attrs(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => ` ${key}="${esc(value)}"`)
    .join("");
}

function svg(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#182033" flood-opacity="0.10"/>
    </filter>
    <marker id="arrowBlue" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="${COLORS.blue}"/>
    </marker>
    <marker id="arrowTeal" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="${COLORS.teal}"/>
    </marker>
    <linearGradient id="browserFill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#F6FAFF"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  ${body}
</svg>
`;
}

function rect(x, y, width, height, options = {}) {
  return `<rect${attrs({
    x,
    y,
    width,
    height,
    rx: options.rx ?? 14,
    fill: options.fill ?? COLORS.white,
    stroke: options.stroke ?? COLORS.line,
    "stroke-width": options.strokeWidth ?? 2,
    filter: options.shadow ? "url(#softShadow)" : undefined,
    opacity: options.opacity,
  })}/>`;
}

function line(x1, y1, x2, y2, options = {}) {
  return `<line${attrs({
    x1,
    y1,
    x2,
    y2,
    stroke: options.stroke ?? COLORS.line,
    "stroke-width": options.strokeWidth ?? 2,
    "stroke-dasharray": options.dash,
    "marker-end": options.arrow,
    opacity: options.opacity,
  })}/>`;
}

function path(d, options = {}) {
  return `<path${attrs({
    d,
    fill: options.fill ?? "none",
    stroke: options.stroke,
    "stroke-width": options.strokeWidth,
    "stroke-linecap": options.linecap ?? "round",
    "stroke-linejoin": options.linejoin ?? "round",
    "stroke-dasharray": options.dash,
    "marker-end": options.arrow,
    opacity: options.opacity,
  })}/>`;
}

function circle(cx, cy, r, options = {}) {
  return `<circle${attrs({
    cx,
    cy,
    r,
    fill: options.fill ?? COLORS.white,
    stroke: options.stroke,
    "stroke-width": options.strokeWidth,
    opacity: options.opacity,
  })}/>`;
}

function text(content, x, y, options = {}) {
  return `<text${attrs({
    x,
    y,
    fill: options.fill ?? COLORS.ink,
    "font-family": "Inter, Helvetica, Arial, sans-serif",
    "font-size": options.size ?? 24,
    "font-weight": options.weight ?? 400,
    "text-anchor": options.anchor,
    "dominant-baseline": options.baseline,
    "letter-spacing": options.letterSpacing,
  })}>${esc(content)}</text>`;
}

function wrapText(content, x, y, maxChars, options = {}) {
  const words = String(content).split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  const lineHeight = options.lineHeight ?? (options.size ?? 22) * 1.25;
  return lines
    .map((lineText, index) =>
      text(lineText, x, y + index * lineHeight, {
        ...options,
        size: options.size ?? 22,
      })
    )
    .join("\n");
}

function panelLabel(label, x, y) {
  return `${circle(x, y, 22, { fill: COLORS.ink })}${text(label, x, y + 1, {
    fill: COLORS.white,
    size: 22,
    weight: 700,
    anchor: "middle",
    baseline: "middle",
  })}`;
}

function pill(label, x, y, color, width = 210) {
  return `${rect(x, y, width, 42, {
    rx: 21,
    fill: `${color}18`,
    stroke: color,
    strokeWidth: 1.5,
  })}${text(label, x + width / 2, y + 27, {
    fill: color,
    size: 18,
    weight: 700,
    anchor: "middle",
  })}`;
}

function card(x, y, width, height, title, body, options = {}) {
  return `${rect(x, y, width, height, {
    rx: 16,
    fill: options.fill ?? COLORS.white,
    stroke: options.stroke ?? COLORS.line,
    shadow: options.shadow,
  })}
  ${text(title, x + 24, y + 36, { size: 24, weight: 800, fill: options.titleColor ?? COLORS.ink })}
  ${body}`;
}

function arrow(x1, y1, x2, y2, color = COLORS.blue) {
  return line(x1, y1, x2, y2, {
    stroke: color,
    strokeWidth: 4,
    arrow: color === COLORS.teal ? "url(#arrowTeal)" : "url(#arrowBlue)",
  });
}

function smallBarChart(x, y, values, { width, height, color, threshold = null }) {
  const max = Math.max(...values, threshold ?? 0);
  const barGap = 4;
  const barWidth = (width - barGap * (values.length - 1)) / values.length;
  const bars = values
    .map((value, index) => {
      const h = (value / max) * height;
      return rect(x + index * (barWidth + barGap), y + height - h, barWidth, h, {
        rx: 3,
        fill: value < (threshold ?? -1) ? COLORS.orange : color,
        stroke: "none",
      });
    })
    .join("\n");
  const thresholdLine =
    threshold === null
      ? ""
      : line(x, y + height - (threshold / max) * height, x + width, y + height - (threshold / max) * height, {
          stroke: COLORS.red,
          strokeWidth: 3,
          dash: "7 6",
        });
  return `${bars}${thresholdLine}`;
}

function axis(x, y, width, height) {
  return `${line(x, y + height, x + width, y + height, { stroke: COLORS.ink, strokeWidth: 2 })}
  ${line(x, y, x, y + height, { stroke: COLORS.ink, strokeWidth: 2 })}`;
}

function polyline(points, options = {}) {
  return `<polyline${attrs({
    points: points.map(([x, y]) => `${x},${y}`).join(" "),
    fill: "none",
    stroke: options.stroke ?? COLORS.blue,
    "stroke-width": options.strokeWidth ?? 4,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  })}/>`;
}

function heatmap(x, y, rows, columns, values, options = {}) {
  const cellWidth = options.cellWidth ?? 42;
  const cellHeight = options.cellHeight ?? 34;
  const palette = options.palette ?? [COLORS.faint, "#B7DDE5", COLORS.teal];
  const max = Math.max(...values.flat(), 1e-9);
  const cells = values
    .map((row, rowIndex) =>
      row
        .map((value, columnIndex) => {
          const t = value / max;
          const fill = t > 0.66 ? palette[2] : t > 0.33 ? palette[1] : palette[0];
          return rect(
            x + columnIndex * cellWidth,
            y + rowIndex * cellHeight,
            cellWidth - 2,
            cellHeight - 2,
            { rx: 4, fill, stroke: "none" }
          );
        })
        .join("\n")
    )
    .join("\n");
  const rowLabels = rows
    .map((row, index) =>
      text(row, x - 10, y + index * cellHeight + cellHeight / 2 + 6, {
        size: 15,
        fill: COLORS.muted,
        anchor: "end",
      })
    )
    .join("\n");
  const columnLabels = columns
    .map((column, index) =>
      text(column, x + index * cellWidth + cellWidth / 2, y - 10, {
        size: 15,
        fill: COLORS.muted,
        anchor: "middle",
      })
    )
    .join("\n");
  return `${cells}${rowLabels}${columnLabels}`;
}

function sbsBars(x, y, width, height, seed = 1) {
  const randomValues = Array.from({ length: 96 }, (_, index) => {
    const phase = (index + 1) * (seed + 2);
    return 0.08 + Math.abs(Math.sin(phase * 0.27)) * 0.82;
  });
  const gap = 1.4;
  const barWidth = (width - gap * 95) / 96;
  return randomValues
    .map((value, index) => {
      const h = value * height;
      const color = SBS_COLORS[Math.floor(index / 16)];
      return rect(x + index * (barWidth + gap), y + height - h, barWidth, h, {
        rx: 0,
        fill: color,
        stroke: "none",
        opacity: 0.9,
      });
    })
    .join("\n");
}

function figure1() {
  const width = 1800;
  const height = 1120;
  const body = `
  ${text("mSigSDK architecture and browser privacy boundary", 90, 80, { size: 42, weight: 850 })}
  ${wrapText("Public resources can be queried through APIs, while private user spectra can be transformed, fitted, quality-controlled, and reported locally in the browser.", 90, 122, 118, { size: 22, fill: COLORS.muted })}

  ${panelLabel("A", 90, 205)}
  ${text("Inputs", 128, 213, { size: 28, weight: 850 })}
  ${card(90, 245, 375, 570, "Public resources", `
    ${pill("mSigPortal APIs", 125, 305, COLORS.blue, 260)}
    ${pill("TCGA / GDC", 125, 365, COLORS.teal, 260)}
    ${wrapText("Reference signatures, public cohort summaries, and portal-compatible data structures.", 125, 450, 29, { size: 19, fill: COLORS.muted })}
    ${line(125, 545, 420, 545, { stroke: COLORS.line })}
    ${text("User supplied", 125, 600, { size: 22, weight: 800 })}
    ${pill("MAF files", 125, 630, COLORS.orange, 180)}
    ${pill("Spectra matrices", 125, 690, COLORS.purple, 230)}
    ${wrapText("These inputs can remain local during analysis.", 125, 765, 28, { size: 18, fill: COLORS.muted })}
  `, { shadow: true })}

  ${panelLabel("B", 562, 205)}
  ${text("Browser execution boundary", 600, 213, { size: 28, weight: 850 })}
  ${rect(540, 245, 720, 705, { rx: 26, fill: "url(#browserFill)", stroke: COLORS.blue, strokeWidth: 4, shadow: true })}
  ${text("Local mSigSDK modules", 590, 303, { size: 30, weight: 850 })}
  ${wrapText("Composable ES modules for analysis, visualization, and reporting.", 590, 338, 54, { size: 20, fill: COLORS.muted })}
  ${[
    ["Data access", "mSigPortal, TCGA", COLORS.blue],
    ["Input handling", "io, MAF conversion", COLORS.orange],
    ["Validation", "contexts, coverage", COLORS.teal],
    ["Fitting and QC", "NNLS, burden, residuals", COLORS.green],
    ["Uncertainty", "bootstrap, thresholds", COLORS.purple],
    ["Extraction", "NMF, rank, matching", COLORS.red],
    ["Reporting", "provenance, exports", COLORS.ink],
  ]
    .map(([title, subtitle, color], index) => {
      const x = 590 + (index % 2) * 315;
      const y = 405 + Math.floor(index / 2) * 112;
      return `${rect(x, y, 275, 82, { rx: 12, fill: COLORS.white, stroke: `${color}55` })}
        ${circle(x + 28, y + 39, 12, { fill: color })}
        ${text(title, x + 52, y + 34, { size: 20, weight: 800 })}
        ${text(subtitle, x + 52, y + 59, { size: 16, fill: COLORS.muted })}`;
    })
    .join("\n")}
  ${line(900, 790, 900, 890, { stroke: COLORS.blue, strokeWidth: 4, dash: "9 8" })}
  ${text("Private spectra need not leave the browser", 900, 925, { size: 24, weight: 850, fill: COLORS.blue, anchor: "middle" })}

  ${panelLabel("C", 1350, 205)}
  ${text("Research outputs", 1388, 213, { size: 28, weight: 850 })}
  ${card(1330, 245, 380, 570, "Analysis products", `
    ${[
      ["Exposure tables", COLORS.green],
      ["QC dashboards", COLORS.blue],
      ["Residual spectra", COLORS.orange],
      ["Bootstrap intervals", COLORS.purple],
      ["NMF signatures", COLORS.red],
      ["HTML / JSON reports", COLORS.teal],
      ["Notebook examples", COLORS.ink],
    ]
      .map(([label, color], index) => {
        const y = 308 + index * 63;
        return `${circle(1370, y - 6, 8, { fill: color })}
          ${text(label, 1390, y, { size: 22, weight: 700 })}`;
      })
      .join("\n")}
  `, { shadow: true })}

  ${panelLabel("D", 90, 915)}
  ${text("What crosses the boundary?", 128, 923, { size: 28, weight: 850 })}
  ${card(90, 955, 770, 105, "Public API calls", `
    ${wrapText("Reference signatures and public cohort summaries flow into the browser.", 125, 1018, 62, { size: 21, fill: COLORS.muted })}
  `)}
  ${card(935, 955, 775, 105, "Local analysis", `
    ${wrapText("User spectra, fitted exposures, QC, and reports can remain local.", 970, 1018, 62, { size: 21, fill: COLORS.muted })}
  `)}

  ${arrow(465, 430, 540, 430, COLORS.blue)}
  ${arrow(465, 695, 540, 695, COLORS.teal)}
  ${arrow(1260, 600, 1330, 600, COLORS.blue)}
  ${path("M 465 985 C 615 905, 720 870, 900 890", { stroke: COLORS.blue, strokeWidth: 4, arrow: "url(#arrowBlue)" })}
  ${path("M 1255 890 C 1370 885, 1450 915, 1540 955", { stroke: COLORS.teal, strokeWidth: 4, arrow: "url(#arrowTeal)" })}
  `;
  return svg(width, height, body);
}

function figure2() {
  const width = 1800;
  const height = 1360;
  const burden = [42, 58, 75, 91, 118, 143, 180, 224, 285, 330, 410, 520];
  const exposures = [
    [0.38, 0.28, 0.19, 0.15],
    [0.17, 0.43, 0.23, 0.17],
    [0.08, 0.32, 0.47, 0.13],
    [0.21, 0.19, 0.18, 0.42],
  ];
  const body = `
  ${text("Quality-control and uncertainty diagnostics for known-signature fitting", 90, 78, { size: 39, weight: 850 })}
  ${wrapText("A defensible exposure call should be supported by adequate mutation burden, complete context coverage, good reconstruction, residual review, and robustness to bootstrap and threshold choices.", 90, 120, 124, { size: 21, fill: COLORS.muted })}

  ${panelLabel("A", 90, 210)}
  ${card(90, 240, 510, 300, "Mutation burden and context coverage", `
    ${smallBarChart(130, 310, burden, { width: 410, height: 145, color: COLORS.blue, threshold: 100 })}
    ${text("User threshold", 410, 305, { size: 16, fill: COLORS.red, weight: 700 })}
    ${text("below threshold", 130, 500, { size: 18, fill: COLORS.orange, weight: 700 })}
    ${text("passes threshold", 305, 500, { size: 18, fill: COLORS.blue, weight: 700 })}
    ${rect(130, 515, 120, 9, { rx: 4, fill: COLORS.orange, stroke: "none" })}
    ${rect(305, 515, 120, 9, { rx: 4, fill: COLORS.blue, stroke: "none" })}
    ${text("SBS96 contexts complete: 96 / 96", 130, 475, { size: 19, fill: COLORS.muted })}
  `, { shadow: true })}

  ${panelLabel("B", 700, 210)}
  ${card(700, 240, 475, 300, "Local NNLS exposure fitting", `
    ${exposures
      .map((row, rowIndex) => {
        let x = 745;
        const y = 310 + rowIndex * 40;
        return `${text(`SP${rowIndex + 1}`, 745, y + 18, { size: 17, fill: COLORS.muted })}
          ${row
            .map((value, index) => {
              const w = value * 310;
              const out = rect(x + 55, y, w, 28, {
                rx: 4,
                fill: [COLORS.blue, COLORS.green, COLORS.orange, COLORS.purple][index],
                stroke: "none",
                opacity: 0.9,
              });
              x += w;
              return out;
            })
            .join("")}`;
      })
      .join("\n")}
    ${text("Thresholded active signatures are explicit.", 745, 485, { size: 17, fill: COLORS.muted })}
    ${["SBS1", "SBS4", "SBS5", "SBS40"]
      .map((label, index) => `${circle(760 + index * 88, 515, 7, { fill: [COLORS.blue, COLORS.green, COLORS.orange, COLORS.purple][index] })}${text(label, 773 + index * 88, 521, { size: 15, fill: COLORS.muted })}`)
      .join("\n")}
  `, { shadow: true })}

  ${panelLabel("C", 1260, 210)}
  ${card(1260, 240, 450, 300, "Reconstruction quality", `
    ${axis(1315, 315, 310, 150)}
    ${polyline([[1315, 438], [1375, 416], [1435, 390], [1495, 370], [1555, 340], [1625, 318]], { stroke: COLORS.blue })}
    ${[0, 1, 2, 3, 4, 5].map((index) => circle(1315 + index * 62, [438, 416, 390, 370, 340, 318][index], 8, { fill: COLORS.blue, stroke: COLORS.white, strokeWidth: 3 })).join("\n")}
    ${text("Cosine similarity", 1315, 300, { size: 18, weight: 800 })}
    ${text("higher is better", 1480, 300, { size: 16, fill: COLORS.muted })}
    ${smallBarChart(1320, 490, [0.008, 0.006, 0.005, 0.004, 0.003], { width: 285, height: 28, color: COLORS.orange })}
    ${text("RMSE decreases with better fit", 1315, 540, { size: 18, fill: COLORS.muted })}
  `, { shadow: true })}

  ${panelLabel("D", 90, 625)}
  ${card(90, 655, 760, 330, "Observed vs reconstructed SBS96 profile", `
    ${sbsBars(130, 735, 650, 95, 2)}
    ${sbsBars(130, 858, 650, 75, 7)}
    ${line(130, 830, 780, 830, { stroke: COLORS.line })}
    ${line(130, 935, 780, 935, { stroke: COLORS.line })}
    ${text("Observed", 130, 715, { size: 19, weight: 800 })}
    ${text("Reconstructed", 130, 852, { size: 19, weight: 800 })}
    ${text("C>A", 145, 960, { size: 14, fill: COLORS.muted })}
    ${text("C>G", 250, 960, { size: 14, fill: COLORS.muted })}
    ${text("C>T", 355, 960, { size: 14, fill: COLORS.muted })}
    ${text("T>A", 460, 960, { size: 14, fill: COLORS.muted })}
    ${text("T>C", 565, 960, { size: 14, fill: COLORS.muted })}
    ${text("T>G", 670, 960, { size: 14, fill: COLORS.muted })}
  `, { shadow: true })}

  ${panelLabel("E", 930, 625)}
  ${card(930, 655, 360, 330, "Bootstrap exposure intervals", `
    ${[["SBS4", 0.16, 0.28, 0.38, COLORS.green], ["SBS5", 0.05, 0.16, 0.27, COLORS.orange], ["SBS40", 0.09, 0.18, 0.31, COLORS.purple], ["SBS1", 0.02, 0.08, 0.15, COLORS.blue]]
      .map(([label, lo, mid, hi, color], index) => {
        const y = 735 + index * 55;
        const scale = (value) => 1000 + value * 720;
        return `${text(label, 970, y + 7, { size: 16, fill: COLORS.muted })}
          ${line(scale(lo), y, scale(hi), y, { stroke: color, strokeWidth: 8, opacity: 0.38 })}
          ${circle(scale(mid), y, 10, { fill: color, stroke: COLORS.white, strokeWidth: 3 })}
          ${path(`M ${scale(lo)} ${y - 18} C ${scale(mid) - 18} ${y - 34}, ${scale(mid) + 18} ${y - 34}, ${scale(hi)} ${y - 18}`, { stroke: color, strokeWidth: 2, opacity: 0.7 })}`;
      })
      .join("\n")}
    ${text("95% CI and mean from resampled spectra", 970, 945, { size: 17, fill: COLORS.muted })}
  `, { shadow: true })}

  ${panelLabel("F", 1365, 625)}
  ${card(1365, 655, 345, 330, "Threshold sensitivity", `
    ${axis(1415, 735, 220, 110)}
    ${polyline([[1415, 762], [1465, 766], [1515, 775], [1565, 805], [1635, 832]], { stroke: COLORS.blue })}
    ${polyline([[1415, 832], [1465, 815], [1515, 795], [1565, 775], [1635, 762]], { stroke: COLORS.orange })}
    ${text("cosine", 1450, 720, { size: 15, fill: COLORS.blue, weight: 800 })}
    ${text("active signatures", 1530, 720, { size: 15, fill: COLORS.orange, weight: 800 })}
    ${heatmap(1430, 885, ["cos", "rmse", "active"], ["0", ".01", ".03", ".05", ".10"], [[0.1, 0.1, 0.2, 0.45, 0.7], [0.05, 0.12, 0.25, 0.5, 0.8], [0.1, 0.15, 0.4, 0.62, 0.9]], { cellWidth: 40, cellHeight: 26, palette: ["#F8FAFC", "#FBD9AA", COLORS.red] })}
  `, { shadow: true })}

  ${rect(90, 1055, 1620, 170, { rx: 18, fill: "#F8FBFF", stroke: COLORS.line })}
  ${text("Interpretation", 125, 1105, { size: 26, weight: 850 })}
  ${wrapText("The figure emphasizes that exposure estimates are not interpreted alone. Samples below mutation burden thresholds, incomplete context matrices, weak reconstruction, structured residuals, wide bootstrap intervals, or strong threshold dependence should be reviewed before biological conclusions are made.", 125, 1140, 108, { size: 22, fill: COLORS.muted })}
  `;
  return svg(width, height, body);
}

function figure3() {
  const width = 1800;
  const height = 1240;
  const body = `
  ${text("Exploratory browser-side NMF signature extraction", 90, 78, { size: 42, weight: 850 })}
  ${wrapText("NMF in mSigSDK is positioned as an interactive extraction and teaching workflow for moderate-sized matrices, with explicit rank diagnostics and reference matching.", 90, 120, 118, { size: 22, fill: COLORS.muted })}

  ${panelLabel("A", 90, 215)}
  ${text("NMF workflow", 130, 223, { size: 28, weight: 850 })}
  ${card(90, 255, 1620, 205, "From spectra to extracted signatures", `
    ${[
      ["Input spectra", "SBS96 contexts x samples", COLORS.blue],
      ["Candidate ranks", "k = 2, 3, 4, ...", COLORS.orange],
      ["Repeated NMF", "multiple seeds per rank", COLORS.purple],
      ["Rank review", "error + cosine", COLORS.teal],
      ["Outputs", "signatures, exposures, matches", COLORS.green],
    ]
      .map(([title, subtitle, color], index) => {
        const x = 135 + index * 305;
        return `${rect(x, 330, 230, 82, { rx: 14, fill: `${color}12`, stroke: `${color}80` })}
          ${circle(x + 28, 369, 13, { fill: color })}
          ${text(title, x + 52, 360, { size: 20, weight: 850 })}
          ${text(subtitle, x + 52, 389, { size: 16, fill: COLORS.muted })}
          ${index < 4 ? arrow(x + 235, 371, x + 285, 371, COLORS.blue) : ""}`;
      })
      .join("\n")}
  `, { shadow: true })}

  ${panelLabel("B", 90, 535)}
  ${card(90, 565, 520, 345, "Rank diagnostics", `
    ${axis(145, 645, 380, 180)}
    ${polyline([[145, 805], [220, 742], [295, 700], [370, 681], [445, 671], [525, 666]], { stroke: COLORS.blue })}
    ${polyline([[145, 785], [220, 728], [295, 690], [370, 668], [445, 662], [525, 660]], { stroke: COLORS.teal })}
    ${[2, 3, 4, 5, 6, 7].map((rank, index) => text(String(rank), 145 + index * 76, 852, { size: 16, fill: COLORS.muted, anchor: "middle" })).join("\n")}
    ${text("rank k", 335, 882, { size: 17, fill: COLORS.muted, anchor: "middle" })}
    ${text("Reconstruction error", 155, 625, { size: 16, fill: COLORS.blue, weight: 800 })}
    ${text("Average sample cosine", 370, 625, { size: 16, fill: COLORS.teal, weight: 800 })}
    ${circle(370, 681, 12, { fill: COLORS.orange, stroke: COLORS.white, strokeWidth: 4 })}
    ${text("candidate elbow", 390, 687, { size: 16, fill: COLORS.orange, weight: 800 })}
  `, { shadow: true })}

  ${panelLabel("C", 685, 535)}
  ${card(685, 565, 455, 345, "Extracted SBS96 profiles", `
    ${text("NMF1", 725, 635, { size: 18, weight: 800 })}
    ${sbsBars(725, 650, 350, 70, 4)}
    ${text("NMF2", 725, 755, { size: 18, weight: 800 })}
    ${sbsBars(725, 770, 350, 70, 8)}
    ${text("NMF3", 725, 862, { size: 18, weight: 800 })}
    ${sbsBars(805, 850, 270, 55, 11)}
  `, { shadow: true })}

  ${panelLabel("D", 1215, 535)}
  ${card(1215, 565, 495, 345, "Reference matching", `
    ${heatmap(1350, 650, ["NMF1", "NMF2", "NMF3", "NMF4"], ["SBS1", "SBS4", "SBS5", "SBS40"], [[0.9, 0.2, 0.3, 0.1], [0.1, 0.82, 0.25, 0.2], [0.2, 0.18, 0.75, 0.46], [0.1, 0.23, 0.31, 0.86]], { cellWidth: 72, cellHeight: 42, palette: ["#F8FAFC", "#BFE3DD", COLORS.teal] })}
    ${text("Cosine similarity to reference signatures", 1280, 870, { size: 17, fill: COLORS.muted })}
  `, { shadow: true })}

  ${panelLabel("E", 90, 990)}
  ${card(90, 1020, 770, 170, "Exposure heatmap", `
    ${heatmap(260, 1098, ["SP1", "SP2", "SP3"], ["NMF1", "NMF2", "NMF3", "NMF4", "NMF5", "NMF6", "NMF7", "NMF8"], [[0.8, 0.3, 0.1, 0.5, 0.2, 0.1, 0.45, 0.35], [0.2, 0.7, 0.5, 0.15, 0.32, 0.58, 0.22, 0.12], [0.1, 0.2, 0.85, 0.34, 0.67, 0.22, 0.18, 0.48]], { cellWidth: 52, cellHeight: 24, palette: ["#F8FAFC", "#D7C7FF", COLORS.purple] })}
  `)}
  ${card(935, 1020, 775, 170, "Scope", `
    ${wrapText("Browser-side NMF is useful for interactive exploration, report prototypes, and education; production-scale cohort extraction should still be benchmarked and may require dedicated compute.", 970, 1090, 72, { size: 21, fill: COLORS.muted })}
  `)}
  `;
  return svg(width, height, body);
}

const figures = [
  ["figure1-architecture.svg", figure1()],
  ["figure2-qc-dashboard.svg", figure2()],
  ["figure3-nmf-extraction.svg", figure3()],
];

await mkdir(FIGURE_DIR, { recursive: true });

for (const [filename, content] of figures) {
  await writeFile(join(FIGURE_DIR, filename), content);
  console.log(`Wrote ${join(FIGURE_DIR, filename)}`);
}
