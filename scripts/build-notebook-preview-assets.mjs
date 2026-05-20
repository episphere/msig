import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDir = join(repoRoot, "images", "notebook-previews");
const width = 960;
const height = 540;

const color = {
  ink: "#10201b",
  softInk: "#43514b",
  surface: "#ffffff",
  paper: "#fbfcf8",
  rule: "#d8e2dc",
  mist: "#edf5f1",
  teal: "#168a8c",
  green: "#2f7d55",
  blue: "#4772b2",
  gold: "#d59b2e",
  rose: "#c86f80",
  purple: "#7657b8",
  orange: "#dc7c3f",
  cyan: "#2e9fb3",
  slate: "#405168",
  red: "#c94d5d",
};

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attr(values = {}) {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}="${esc(value)}"`)
    .join(" ");
}

function tag(name, values = {}, content = "") {
  return `<${name} ${attr(values)}>${content}</${name}>`;
}

function self(name, values = {}) {
  return `<${name} ${attr(values)} />`;
}

function g(content, values = {}) {
  return tag("g", values, Array.isArray(content) ? content.join("") : content);
}

function rect(x, y, w, h, values = {}) {
  return self("rect", { x, y, width: w, height: h, ...values });
}

function circle(cx, cy, r, values = {}) {
  return self("circle", { cx, cy, r, ...values });
}

function ellipse(cx, cy, rx, ry, values = {}) {
  return self("ellipse", { cx, cy, rx, ry, ...values });
}

function line(x1, y1, x2, y2, values = {}) {
  return self("line", { x1, y1, x2, y2, ...values });
}

function path(d, values = {}) {
  return self("path", { d, ...values });
}

function polyline(points, values = {}) {
  return self("polyline", {
    points: points.map(([x, y]) => `${x},${y}`).join(" "),
    ...values,
  });
}

function polygon(points, values = {}) {
  return self("polygon", {
    points: points.map(([x, y]) => `${x},${y}`).join(" "),
    ...values,
  });
}

function card(x, y, w, h, content, values = {}) {
  return g(
    [
      rect(x, y, w, h, {
        rx: values.rx ?? 22,
        fill: values.fill || color.surface,
        stroke: values.stroke || color.rule,
        "stroke-width": values.strokeWidth || 2,
        filter: values.filter,
      }),
      content,
    ],
    values.group || {}
  );
}

function browserShell(x, y, w, h, content, accent = color.teal) {
  return card(
    x,
    y,
    w,
    h,
    [
      rect(x + 22, y + 22, w - 44, 38, { rx: 14, fill: "#edf4ef" }),
      circle(x + 44, y + 41, 6, { fill: color.rose }),
      circle(x + 64, y + 41, 6, { fill: color.gold }),
      circle(x + 84, y + 41, 6, { fill: color.green }),
      rect(x + 118, y + 33, w - 170, 16, { rx: 8, fill: `${accent}22` }),
      content,
    ],
    { fill: color.surface, rx: 24 }
  );
}

function fileSheet(x, y, w, h, accent, values = {}) {
  return [
    rect(x, y, w, h, {
      rx: values.rx || 18,
      fill: values.fill || color.surface,
      stroke: values.stroke || color.rule,
      "stroke-width": 2,
    }),
    path(`M ${x + w - 44} ${y} L ${x + w} ${y + 44} L ${x + w - 44} ${y + 44} Z`, {
      fill: `${accent}33`,
    }),
    rect(x + 24, y + 34, w * 0.46, 12, { rx: 6, fill: accent }),
    rect(x + 24, y + 66, w * 0.66, 9, { rx: 5, fill: "#dce8e1" }),
    rect(x + 24, y + 90, w * 0.52, 9, { rx: 5, fill: "#dce8e1" }),
  ].join("");
}

function folder(x, y, w, h, accent) {
  return [
    path(`M ${x} ${y + 34} Q ${x} ${y + 18} ${x + 18} ${y + 18} H ${x + w * 0.36} L ${x + w * 0.46} ${y} H ${x + w * 0.84} Q ${x + w} ${y} ${x + w} ${y + 18} V ${y + h} Q ${x + w} ${y + h + 18} ${x + w - 18} ${y + h + 18} H ${x + 18} Q ${x} ${y + h + 18} ${x} ${y + h} Z`, {
      fill: `${accent}33`,
      stroke: accent,
      "stroke-width": 2,
    }),
    rect(x + 20, y + 52, w - 40, h - 28, { rx: 18, fill: color.surface, opacity: 0.72 }),
  ].join("");
}

function heatmap(x, y, cols, rows, cell, palette, values = {}) {
  const parts = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const opacity = 0.32 + (((row + 2) * (col + 5)) % 6) * 0.1;
      parts.push(
        rect(x + col * cell, y + row * cell, cell - 4, cell - 4, {
          rx: values.rx || 4,
          fill: palette[(row * 2 + col * 3) % palette.length],
          opacity: opacity.toFixed(2),
        })
      );
    }
  }
  return parts.join("");
}

function bars(x, y, values, w, h, palette, options = {}) {
  const gap = options.gap ?? 8;
  const rx = options.rx ?? 8;
  const bw = (w - gap * (values.length - 1)) / values.length;
  return values
    .map((value, index) => {
      const bh = Math.max(8, h * value);
      return rect(x + index * (bw + gap), y + h - bh, bw, bh, {
        rx,
        fill: palette[index % palette.length],
      });
    })
    .join("");
}

function rows(x, y, values, w, rowH, palette) {
  return values
    .map((value, index) => {
      const yy = y + index * rowH;
      return [
        rect(x, yy, w, 12, { rx: 6, fill: "#e1eae4" }),
        rect(x, yy, w * value, 12, { rx: 6, fill: palette[index % palette.length] }),
      ].join("");
    })
    .join("");
}

function spark(points, stroke, values = {}) {
  return [
    polyline(points, {
      fill: "none",
      stroke,
      "stroke-width": values.width || 6,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
    ...points.map(([cx, cy]) =>
      circle(cx, cy, values.dot || 6, {
        fill: values.fill || color.surface,
        stroke,
        "stroke-width": values.dotStroke || 3,
      })
    ),
  ].join("");
}

function check(cx, cy, r, accent) {
  return [
    circle(cx, cy, r, { fill: "#eef8f1", stroke: accent, "stroke-width": 8 }),
    path(`M ${cx - r * 0.44} ${cy} L ${cx - r * 0.12} ${cy + r * 0.32} L ${cx + r * 0.48} ${cy - r * 0.36}`, {
      fill: "none",
      stroke: accent,
      "stroke-width": 9,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  ].join("");
}

function arrowPath(d, accent, values = {}) {
  return path(d, {
    fill: "none",
    stroke: accent,
    "stroke-width": values.width || 6,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "marker-end": values.marker,
    opacity: values.opacity,
  });
}

function dotPath(points, accent) {
  return points.map(([cx, cy], index) => circle(cx, cy, index % 2 ? 5 : 7, { fill: accent, opacity: index % 2 ? 0.35 : 0.7 })).join("");
}

function database(x, y, w, h, accent) {
  return [
    ellipse(x + w / 2, y + 18, w / 2, 18, { fill: `${accent}44`, stroke: accent, "stroke-width": 2 }),
    rect(x, y + 18, w, h, { fill: `${accent}22`, stroke: accent, "stroke-width": 2 }),
    ellipse(x + w / 2, y + h + 18, w / 2, 18, { fill: color.surface, stroke: accent, "stroke-width": 2 }),
    ellipse(x + w / 2, y + h * 0.48, w / 2, 18, { fill: "none", stroke: accent, "stroke-width": 2, opacity: 0.5 }),
  ].join("");
}

function helix(x, y, h, accentA, accentB) {
  const pointsA = [];
  const pointsB = [];
  for (let i = 0; i <= 10; i += 1) {
    const yy = y + (h / 10) * i;
    const wave = Math.sin(i * 0.8);
    pointsA.push([x + 36 + wave * 28, yy]);
    pointsB.push([x + 36 - wave * 28, yy]);
  }
  const rungs = pointsA
    .map(([x1, y1], index) => line(x1, y1, pointsB[index][0], pointsB[index][1], {
      stroke: index % 2 ? accentA : accentB,
      "stroke-width": 4,
      opacity: 0.55,
    }))
    .join("");
  return [
    spark(pointsA, accentA, { width: 5, dot: 4, dotStroke: 2 }),
    spark(pointsB, accentB, { width: 5, dot: 4, dotStroke: 2 }),
    rungs,
  ].join("");
}

function lens(cx, cy, r, accent) {
  return [
    circle(cx, cy, r, { fill: `${accent}16`, stroke: accent, "stroke-width": 8 }),
    line(cx + r * 0.68, cy + r * 0.68, cx + r * 1.28, cy + r * 1.28, {
      stroke: accent,
      "stroke-width": 10,
      "stroke-linecap": "round",
    }),
  ].join("");
}

function renderShell(asset) {
  const id = asset.file.replace(/[^a-z0-9]+/gi, "-");
  const [bg0, bg1, bg2] = asset.bg;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc">
  <title id="${id}-title">${esc(asset.title)}</title>
  <desc id="${id}-desc">${esc(asset.desc)}</desc>
  <defs>
    <linearGradient id="${id}-bg" x1="${asset.gradient?.[0] || 0}" y1="${asset.gradient?.[1] || 0}" x2="${asset.gradient?.[2] || 1}" y2="${asset.gradient?.[3] || 1}">
      <stop offset="0%" stop-color="${bg0}"/>
      <stop offset="58%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <radialGradient id="${id}-glow" cx="${asset.glow?.[0] || "72%"}" cy="${asset.glow?.[1] || "26%"}" r="${asset.glow?.[2] || "70%"}">
      <stop offset="0%" stop-color="${asset.secondary}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${asset.secondary}" stop-opacity="0"/>
    </radialGradient>
    <filter id="${id}-shadow" x="-18%" y="-18%" width="136%" height="136%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#10201b" flood-opacity="0.12"/>
    </filter>
    <marker id="${id}-arrow" markerWidth="13" markerHeight="13" refX="10" refY="6.5" orient="auto">
      <path d="M 0 0 L 13 6.5 L 0 13 Z" fill="${asset.accent}"/>
    </marker>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#${id}-bg)"/>
  <rect width="${width}" height="${height}" fill="url(#${id}-glow)"/>
  ${asset.backdrop(id)}
  ${asset.body(id)}
</svg>
`;
}

const backdrops = {
  orbit: (id, accent, secondary) => [
    ellipse(480, 270, 390, 170, { fill: "none", stroke: `${accent}22`, "stroke-width": 28 }),
    ellipse(480, 270, 310, 112, { fill: "none", stroke: `${secondary}20`, "stroke-width": 18 }),
    circle(126, 102, 118, { fill: `${accent}12` }),
    circle(840, 438, 170, { fill: `${secondary}14` }),
  ].join(""),
  map: (id, accent, secondary) => [
    path("M 0 390 C 150 316 276 448 424 372 C 548 308 698 328 960 228 L 960 540 L 0 540 Z", {
      fill: `${accent}12`,
    }),
    circle(132, 94, 104, { fill: `${secondary}12` }),
    circle(850, 448, 146, { fill: `${accent}12` }),
  ].join(""),
  grid: (id, accent, secondary) => [
    ...Array.from({ length: 9 }, (_, i) => line(80 + i * 98, 58, 80 + i * 98, 482, { stroke: `${accent}13`, "stroke-width": 2 })),
    ...Array.from({ length: 5 }, (_, i) => line(48, 96 + i * 88, 912, 96 + i * 88, { stroke: `${secondary}13`, "stroke-width": 2 })),
    circle(824, 104, 116, { fill: `${secondary}12` }),
  ].join(""),
  paper: (id, accent, secondary) => [
    path("M 42 120 C 210 46 356 74 492 148 C 650 234 738 180 924 108 L 924 0 L 42 0 Z", { fill: `${secondary}10` }),
    path("M 0 426 C 176 362 310 468 492 392 C 674 316 768 370 960 310 L 960 540 L 0 540 Z", { fill: `${accent}12` }),
  ].join(""),
};

const commonBg = ["#fbfcf8", "#f5f8f4", "#eef8f6"];

const assets = [
  {
    file: "sdk-hero-overview.svg",
    title: "One-command mSigSDK import",
    desc: "Hosted SDK module connected to analysis tools",
    accent: color.teal,
    secondary: color.gold,
    bg: ["#fbfcf8", "#f3faf7", "#fff3d5"],
    backdrop: (id) => backdrops.orbit(id, color.teal, color.gold),
    body: (id) => [
      ellipse(480, 270, 242, 82, { fill: `${color.teal}10`, stroke: `${color.teal}22`, "stroke-width": 4 }),
      card(392, 186, 176, 168, [
        rect(426, 224, 108, 20, { rx: 10, fill: `${color.teal}28` }),
        rect(426, 262, 78, 14, { rx: 7, fill: color.teal }),
        rect(426, 292, 108, 12, { rx: 6, fill: "#dfeae4" }),
      ], { filter: `url(#${id}-shadow)`, rx: 28 }),
      ...[
        [192, 160, color.blue, bars(154, 152, [0.36, 0.62, 0.44, 0.78], 78, 62, [color.blue, color.gold])],
        [754, 144, color.green, heatmap(706, 110, 5, 4, 24, [color.teal, color.green, color.gold])],
        [788, 384, color.rose, fileSheet(736, 314, 104, 122, color.rose)],
        [202, 392, color.purple, lens(202, 368, 32, color.purple)],
      ].map(([cx, cy, accent, content]) => [
        line(480, 270, cx, cy, { stroke: `${accent}66`, "stroke-width": 5, "stroke-linecap": "round" }),
        card(cx - 72, cy - 72, 144, 144, content, { rx: 30, fill: color.surface, filter: `url(#${id}-shadow)` }),
      ].join("")),
      circle(480, 270, 16, { fill: color.teal }),
      circle(480, 270, 76, { fill: "none", stroke: `${color.teal}33`, "stroke-width": 12 }),
    ].join(""),
  },
  {
    file: "sdk-workflow-guide.svg",
    title: "Workflow guide",
    desc: "Roadmap through input, fit, review, and report decisions",
    accent: color.green,
    secondary: color.teal,
    bg: ["#fbfcf8", "#f3faf5", "#e8f5ef"],
    backdrop: (id) => backdrops.map(id, color.green, color.teal),
    body: (id) => [
      path("M 118 350 C 180 174 318 178 386 278 S 594 384 698 214 C 754 124 838 142 872 214", {
        fill: "none",
        stroke: `${color.green}44`,
        "stroke-width": 22,
        "stroke-linecap": "round",
      }),
      dotPath([[150, 310], [205, 230], [296, 210], [386, 278], [488, 338], [600, 328], [698, 214], [790, 172], [860, 214]], color.green),
      card(104, 280, 120, 118, [
        circle(164, 338, 40, { fill: `${color.teal}18`, stroke: color.teal, "stroke-width": 4 }),
        path("M 164 306 L 136 338 H 152 V 370 H 176 V 338 H 192 Z", { fill: color.teal }),
      ], { filter: `url(#${id}-shadow)`, rx: 26 }),
      card(330, 210, 126, 120, bars(370, 258, [0.34, 0.7, 0.5, 0.82], 54, 52, [color.green, color.gold]), { filter: `url(#${id}-shadow)`, rx: 26 }),
      card(562, 270, 128, 122, heatmap(594, 302, 4, 3, 18, [color.teal, color.blue, color.green]), { filter: `url(#${id}-shadow)`, rx: 26 }),
      card(778, 144, 126, 122, check(841, 205, 38, color.green), { filter: `url(#${id}-shadow)`, rx: 26 }),
      polygon([[104, 128], [134, 82], [164, 128], [134, 174]], { fill: `${color.green}20`, stroke: color.green, "stroke-width": 4 }),
      circle(134, 128, 12, { fill: color.green }),
    ].join(""),
  },
  {
    file: "sdk-end-to-end-workflow.svg",
    title: "End-to-end workflow",
    desc: "Diagonal pipeline from spectra input to reviewed report output",
    accent: color.blue,
    secondary: color.teal,
    bg: ["#fafdff", "#f1f7fb", "#ecf8f4"],
    backdrop: (id) => backdrops.grid(id, color.blue, color.teal),
    body: (id) => [
      path("M 96 386 L 834 150", { stroke: `${color.blue}35`, "stroke-width": 58, "stroke-linecap": "round" }),
      path("M 112 384 L 818 158", { stroke: color.blue, "stroke-width": 8, "stroke-linecap": "round", "stroke-dasharray": "1 24" }),
      card(88, 300, 158, 132, bars(126, 344, [0.34, 0.62, 0.44, 0.78, 0.52], 82, 54, [color.blue, color.gold]), { filter: `url(#${id}-shadow)`, rx: 26 }),
      card(292, 232, 164, 142, heatmap(330, 270, 5, 4, 20, [color.blue, color.teal, color.purple, color.gold]), { filter: `url(#${id}-shadow)`, rx: 26 }),
      card(502, 172, 164, 142, [
        lens(556, 232, 28, color.teal),
        rect(588, 264, 42, 14, { rx: 7, fill: color.gold }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 26 }),
      card(706, 104, 164, 142, [
        fileSheet(738, 130, 72, 88, color.green),
        check(826, 178, 28, color.green),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 26 }),
      circle(240, 340, 10, { fill: color.blue }),
      circle(456, 272, 10, { fill: color.blue }),
      circle(666, 210, 10, { fill: color.blue }),
    ].join(""),
  },
  {
    file: "sdk-public-cohort-explorer.svg",
    title: "Public cohort explorer",
    desc: "Public data sources connected to cohort matrix and trend review",
    accent: color.cyan,
    secondary: color.blue,
    bg: ["#f9fcfb", "#eef9f9", "#eef3ff"],
    backdrop: (id) => [
      ...backdrops.map(id, color.cyan, color.blue),
      path("M 222 132 C 300 88 370 130 420 176 C 350 190 306 228 268 286 C 224 236 190 188 222 132 Z", {
        fill: `${color.blue}12`,
        stroke: `${color.blue}22`,
      }),
      path("M 632 152 C 704 96 802 122 828 204 C 782 250 716 244 672 290 C 620 248 594 198 632 152 Z", {
        fill: `${color.cyan}12`,
        stroke: `${color.cyan}22`,
      }),
    ].join(""),
    body: (id) => [
      database(96, 182, 118, 172, color.blue),
      database(232, 150, 118, 204, color.cyan),
      ...[[420, 170], [486, 220], [440, 304], [538, 326], [594, 248]].map(([cx, cy], index) =>
        circle(cx, cy, index === 0 ? 18 : 13, { fill: [color.gold, color.teal, color.blue, color.green, color.rose][index] })
      ),
      line(420, 170, 486, 220, { stroke: color.slate, "stroke-width": 4, opacity: 0.55 }),
      line(486, 220, 594, 248, { stroke: color.slate, "stroke-width": 4, opacity: 0.55 }),
      line(440, 304, 538, 326, { stroke: color.slate, "stroke-width": 4, opacity: 0.55 }),
      line(486, 220, 440, 304, { stroke: color.slate, "stroke-width": 4, opacity: 0.55 }),
      card(660, 136, 210, 236, [
        heatmap(694, 178, 6, 5, 25, [color.cyan, color.blue, color.green, color.gold]),
        spark([[704, 330], [738, 306], [774, 320], [812, 284], [846, 294]], color.cyan, { width: 5 }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 28 }),
    ].join(""),
  },
  {
    file: "sdk-resource-portability.svg",
    title: "Resource portability",
    desc: "Multiple file formats converted into reusable analysis resources",
    accent: color.gold,
    secondary: color.teal,
    bg: ["#fffdf7", "#f8f5ec", "#ecf8f4"],
    backdrop: (id) => backdrops.paper(id, color.gold, color.teal),
    body: (id) => [
      g([
        fileSheet(92, 104, 126, 142, color.gold),
        fileSheet(126, 210, 126, 142, color.teal),
        fileSheet(78, 300, 126, 142, color.blue),
      ], { opacity: 0.98 }),
      path("M 286 272 C 358 214 410 214 470 270", { stroke: color.gold, "stroke-width": 7, fill: "none", "stroke-linecap": "round", "marker-end": `url(#${id}-arrow)` }),
      card(430, 176, 192, 190, [
        polygon([[476, 226], [536, 196], [596, 226], [596, 294], [536, 328], [476, 294]], {
          fill: `${color.teal}22`,
          stroke: color.teal,
          "stroke-width": 5,
        }),
        path("M 536 196 V 328 M 476 226 L 596 294 M 596 226 L 476 294", {
          stroke: `${color.teal}66`,
          "stroke-width": 4,
          fill: "none",
        }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 30 }),
      path("M 634 270 C 706 214 760 214 826 264", { stroke: color.teal, "stroke-width": 7, fill: "none", "stroke-linecap": "round", "marker-end": `url(#${id}-arrow)` }),
      folder(742, 242, 152, 120, color.green),
      circle(840, 216, 38, { fill: `${color.green}18`, stroke: color.green, "stroke-width": 5 }),
      check(840, 216, 24, color.green),
    ].join(""),
  },
  {
    file: "sdk-maf-fit-report.svg",
    title: "MAF to SBS96 explainer",
    desc: "Variant rows mapped through DNA context into SBS96 spectrum channels",
    accent: color.orange,
    secondary: color.purple,
    bg: ["#fffaf7", "#f9f2fb", "#edf8f6"],
    backdrop: (id) => backdrops.grid(id, color.orange, color.purple),
    body: (id) => [
      card(82, 116, 190, 300, [
        helix(132, 156, 220, color.orange, color.purple),
        circle(180, 210, 13, { fill: color.red }),
        circle(124, 290, 11, { fill: color.gold }),
        circle(188, 340, 12, { fill: color.teal }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 32 }),
      path("M 314 170 L 474 270 L 314 370 Z", { fill: `${color.orange}28`, stroke: color.orange, "stroke-width": 5 }),
      ...[188, 228, 268, 308, 348].map((y, index) =>
        line(324, y, 438, 270, { stroke: [color.orange, color.purple, color.teal, color.gold, color.rose][index], "stroke-width": 4, opacity: 0.55 })
      ),
      card(532, 120, 328, 296, [
        heatmap(574, 168, 8, 6, 28, [color.orange, color.purple, color.teal, color.gold, color.blue], { rx: 5 }),
        bars(592, 354, [0.36, 0.72, 0.42, 0.58, 0.86, 0.51, 0.66, 0.32], 218, 46, [color.orange, color.purple, color.teal, color.gold], { gap: 7 }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 30 }),
    ].join(""),
  },
  {
    file: "sdk-qc-triage.svg",
    title: "Cohort QC triage",
    desc: "Concern queue, gauge, and action states for quality review",
    accent: color.rose,
    secondary: color.gold,
    bg: ["#fffafb", "#fbf3ee", "#f4faf5"],
    backdrop: (id) => backdrops.paper(id, color.rose, color.gold),
    body: (id) => [
      g([0, 1, 2].map((index) =>
        card(96 + index * 18, 142 + index * 46, 230, 106, [
          rect(132 + index * 18, 174 + index * 46, 120, 13, { rx: 7, fill: index === 2 ? color.rose : "#dfeae4" }),
          rect(132 + index * 18, 204 + index * 46, 160, 10, { rx: 5, fill: "#dfeae4" }),
          circle(286 + index * 18, 194 + index * 46, 20, { fill: [color.green, color.gold, color.rose][index] }),
        ].join(""), { rx: 22, fill: color.surface, filter: index === 2 ? `url(#${id}-shadow)` : undefined })
      )),
      card(418, 126, 224, 250, [
        path("M 464 292 A 72 72 0 1 1 596 292", {
          fill: "none",
          stroke: "#e2ece5",
          "stroke-width": 28,
          "stroke-linecap": "round",
        }),
        path("M 464 292 A 72 72 0 0 1 584 206", {
          fill: "none",
          stroke: color.rose,
          "stroke-width": 28,
          "stroke-linecap": "round",
        }),
        line(530, 292, 584, 232, { stroke: color.ink, "stroke-width": 8, "stroke-linecap": "round" }),
        circle(530, 292, 13, { fill: color.ink }),
        bars(478, 322, [0.24, 0.7, 0.42, 0.58], 102, 34, [color.green, color.gold, color.rose]),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 30 }),
      card(700, 150, 150, 236, [
        circle(775, 206, 28, { fill: color.green }),
        circle(775, 270, 28, { fill: color.gold }),
        circle(775, 334, 28, { fill: color.rose }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 72 }),
    ].join(""),
  },
  {
    file: "sdk-cohort-panel-workflow.svg",
    title: "Cohort and panel workflow",
    desc: "Cohort groups mapped through restricted panel coverage and support",
    accent: color.green,
    secondary: color.blue,
    bg: ["#fbfcf8", "#f0f8f1", "#eef3ff"],
    backdrop: (id) => backdrops.orbit(id, color.green, color.blue),
    body: (id) => [
      ...Array.from({ length: 18 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 18;
        const radius = index % 3 === 0 ? 72 : 52;
        return circle(186 + Math.cos(angle) * radius, 268 + Math.sin(angle) * radius, index % 4 === 0 ? 12 : 9, {
          fill: [color.green, color.blue, color.gold, color.teal][index % 4],
          opacity: 0.9,
        });
      }),
      circle(186, 268, 112, { fill: "none", stroke: `${color.green}33`, "stroke-width": 12 }),
      path("M 316 270 C 392 208 440 208 508 270", { fill: "none", stroke: color.green, "stroke-width": 7, "stroke-linecap": "round", "marker-end": `url(#${id}-arrow)` }),
      card(504, 126, 224, 288, [
        rect(552, 170, 128, 198, { rx: 22, fill: `${color.blue}16`, stroke: color.blue, "stroke-width": 4 }),
        heatmap(570, 194, 4, 6, 25, [color.green, color.blue, color.gold, color.teal]),
        path("M 542 246 H 690 M 542 294 H 690", { stroke: color.ink, "stroke-width": 5, opacity: 0.28 }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 34 }),
      card(768, 182, 118, 176, [
        circle(827, 270, 48, { fill: `${color.green}18`, stroke: color.green, "stroke-width": 8 }),
        path("M 827 222 A 48 48 0 0 1 873 285", { fill: "none", stroke: color.gold, "stroke-width": 10, "stroke-linecap": "round" }),
        check(827, 270, 26, color.green),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 30 }),
    ].join(""),
  },
  {
    file: "sdk-panel-evidence.svg",
    title: "Panel/WES evidence review",
    desc: "Assay coverage, support tiers, and evidence trajectory",
    accent: color.cyan,
    secondary: color.gold,
    bg: ["#f9fcfb", "#edf8f6", "#fff7df"],
    backdrop: (id) => backdrops.map(id, color.cyan, color.gold),
    body: (id) => [
      card(78, 112, 314, 304, [
        circle(235, 264, 106, { fill: `${color.cyan}10`, stroke: `${color.cyan}28`, "stroke-width": 18 }),
        circle(235, 264, 68, { fill: "none", stroke: `${color.gold}35`, "stroke-width": 14 }),
        circle(235, 264, 30, { fill: color.cyan }),
        line(235, 158, 235, 370, { stroke: color.cyan, "stroke-width": 4, opacity: 0.5 }),
        line(129, 264, 341, 264, { stroke: color.cyan, "stroke-width": 4, opacity: 0.5 }),
        spark([[154, 314], [190, 260], [234, 282], [276, 212], [320, 244]], color.gold, { width: 5 }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 34 }),
      card(448, 154, 158, 230, [
        circle(512, 212, 18, { fill: color.green }),
        circle(512, 270, 18, { fill: color.gold }),
        circle(512, 328, 18, { fill: color.rose }),
        rect(548, 203, 34, 18, { rx: 9, fill: "#dfeae4" }),
        rect(548, 261, 48, 18, { rx: 9, fill: "#dfeae4" }),
        rect(548, 319, 28, 18, { rx: 9, fill: "#dfeae4" }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 30 }),
      card(660, 166, 218, 206, [
        heatmap(704, 206, 5, 4, 26, [color.cyan, color.blue, color.green, color.gold]),
        path("M 704 334 C 742 294 784 350 826 306", { fill: "none", stroke: color.cyan, "stroke-width": 7, "stroke-linecap": "round" }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 32 }),
    ].join(""),
  },
  {
    file: "sdk-nmf-extraction.svg",
    title: "Discovery extraction (NMF)",
    desc: "Spectrum matrix separated into signature and exposure factors",
    accent: color.purple,
    secondary: color.teal,
    bg: ["#fbfaff", "#f2f0fb", "#edf8f6"],
    backdrop: (id) => backdrops.grid(id, color.purple, color.teal),
    body: (id) => [
      card(76, 146, 236, 248, heatmap(120, 196, 6, 6, 25, [color.purple, color.teal, color.blue, color.gold]), { filter: `url(#${id}-shadow)`, rx: 32 }),
      polygon([[374, 160], [478, 270], [374, 380], [328, 270]], {
        fill: `${color.purple}24`,
        stroke: color.purple,
        "stroke-width": 5,
      }),
      polygon([[478, 270], [580, 168], [626, 270], [580, 372]], {
        fill: `${color.teal}22`,
        stroke: color.teal,
        "stroke-width": 5,
      }),
      path("M 312 270 H 374 M 626 270 H 682", { stroke: color.slate, "stroke-width": 6, "stroke-linecap": "round" }),
      card(682, 126, 104, 288, bars(716, 180, [0.28, 0.62, 0.46, 0.78], 38, 180, [color.purple, color.gold], { gap: 10 }), { filter: `url(#${id}-shadow)`, rx: 28 }),
      card(808, 172, 94, 196, heatmap(836, 214, 3, 4, 20, [color.teal, color.purple, color.gold]), { filter: `url(#${id}-shadow)`, rx: 28 }),
      spark([[354, 416], [400, 388], [450, 398], [502, 352], [556, 368], [610, 324]], color.purple, { width: 5, dot: 5 }),
    ].join(""),
  },
  {
    file: "sdk-uncertainty-cutoffs.svg",
    title: "Uncertainty and cutoffs",
    desc: "Confidence bands and reporting thresholds around signature calls",
    accent: color.blue,
    secondary: color.rose,
    bg: ["#fafdff", "#eef4fb", "#fff0f3"],
    backdrop: (id) => backdrops.paper(id, color.blue, color.rose),
    body: (id) => [
      card(88, 130, 520, 280, [
        path("M 130 318 C 190 246 252 260 312 306 S 436 352 564 226", {
          fill: "none",
          stroke: `${color.blue}22`,
          "stroke-width": 44,
          "stroke-linecap": "round",
        }),
        path("M 130 318 C 190 246 252 260 312 306 S 436 352 564 226", {
          fill: "none",
          stroke: color.blue,
          "stroke-width": 7,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        }),
        line(398, 172, 398, 364, { stroke: color.rose, "stroke-width": 6, "stroke-linecap": "round", "stroke-dasharray": "10 12" }),
        ...[170, 242, 314, 470, 544].map((cx, index) =>
          ellipse(cx, 292 - index * 13, 22, 58 - index * 4, {
            fill: `${[color.blue, color.teal, color.gold, color.rose, color.purple][index]}35`,
            stroke: [color.blue, color.teal, color.gold, color.rose, color.purple][index],
            "stroke-width": 3,
          })
        ),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 34 }),
      card(670, 166, 202, 212, [
        ...[0, 1, 2, 3].map((index) => {
          const y = 212 + index * 42;
          const x = 728 + index * 24;
          return [
            line(710, y, 832, y, { stroke: "#dfeae4", "stroke-width": 8, "stroke-linecap": "round" }),
            line(x - 34, y, x + 34, y, { stroke: color.rose, "stroke-width": 8, "stroke-linecap": "round" }),
            circle(x, y, 10, { fill: color.surface, stroke: color.rose, "stroke-width": 4 }),
          ].join("");
        }).join(""),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 30 }),
    ].join(""),
  },
  {
    file: "sdk-report-packet.svg",
    title: "Report packet builder",
    desc: "Reviewable report archive, manifest, and audit checks",
    accent: color.gold,
    secondary: color.green,
    bg: ["#fffdf7", "#fbf5e8", "#edf8f0"],
    backdrop: (id) => backdrops.map(id, color.gold, color.green),
    body: (id) => [
      g([0, 1, 2].map((index) =>
        fileSheet(112 + index * 26, 122 + index * 28, 150, 176, [color.teal, color.blue, color.gold][index], {
          fill: color.surface,
        })
      )),
      path("M 340 272 C 416 216 484 218 536 274", { stroke: color.gold, "stroke-width": 7, fill: "none", "stroke-linecap": "round", "marker-end": `url(#${id}-arrow)` }),
      card(514, 172, 194, 188, [
        folder(556, 216, 110, 86, color.gold),
        rect(592, 306, 52, 16, { rx: 8, fill: color.gold }),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 32 }),
      card(748, 144, 126, 244, [
        check(811, 204, 24, color.green),
        check(811, 270, 24, color.green),
        check(811, 336, 24, color.green),
      ].join(""), { filter: `url(#${id}-shadow)`, rx: 30 }),
      circle(676, 170, 34, { fill: `${color.green}18`, stroke: color.green, "stroke-width": 5 }),
      path("M 664 170 L 674 182 L 694 154", {
        fill: "none",
        stroke: color.green,
        "stroke-width": 7,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }),
    ].join(""),
  },
  {
    file: "sdk-multi-tool-comparison.svg",
    title: "Multi-tool comparison",
    desc: "Multiple fitting engines reconciled through concordance and disagreement review",
    accent: color.slate,
    secondary: color.teal,
    bg: ["#fbfcf8", "#eef4f3", "#f4f2fb"],
    backdrop: (id) => backdrops.orbit(id, color.slate, color.teal),
    body: (id) => [
      ...[
        [104, 164, color.teal],
        [104, 254, color.blue],
        [104, 344, color.gold],
      ].map(([x, y, accent]) => card(x, y, 122, 70, [
        circle(x + 34, y + 35, 18, { fill: accent }),
        rect(x + 66, y + 25, 36, 10, { rx: 5, fill: "#dfeae4" }),
        rect(x + 66, y + 43, 28, 8, { rx: 4, fill: "#dfeae4" }),
      ].join(""), { rx: 24, filter: `url(#${id}-shadow)` })),
      path("M 248 198 C 338 198 356 270 436 270", { stroke: color.teal, "stroke-width": 8, fill: "none", "stroke-linecap": "round" }),
      path("M 248 288 C 338 288 356 270 436 270", { stroke: color.blue, "stroke-width": 8, fill: "none", "stroke-linecap": "round" }),
      path("M 248 378 C 338 378 356 270 436 270", { stroke: color.gold, "stroke-width": 8, fill: "none", "stroke-linecap": "round" }),
      card(438, 138, 244, 264, heatmap(486, 192, 5, 5, 30, [color.teal, color.blue, color.gold, color.rose, color.purple]), {
        rx: 34,
        filter: `url(#${id}-shadow)`,
      }),
      path("M 690 270 C 746 224 798 226 844 270", { stroke: color.slate, "stroke-width": 7, fill: "none", "stroke-linecap": "round", "marker-end": `url(#${id}-arrow)` }),
      card(760, 310, 120, 86, [
        circle(804, 352, 12, { fill: color.rose }),
        circle(842, 360, 10, { fill: color.gold }),
        circle(828, 332, 8, { fill: color.teal }),
      ].join(""), { rx: 26 }),
      lens(800, 216, 50, color.slate),
    ].join(""),
  },
];

async function buildNotebookPreviewAssets() {
  await mkdir(outputDir, { recursive: true });
  for (const entry of await readdir(outputDir, { withFileTypes: true })) {
    if (entry.isFile() && /\.(?:jpe?g|png|webp|gif)$/i.test(entry.name)) {
      await unlink(join(outputDir, entry.name));
    }
  }
  for (const asset of assets) {
    await writeFile(join(outputDir, asset.file), renderShell(asset), "utf8");
  }
  return assets.map(({ file }) => file);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = await buildNotebookPreviewAssets();
  console.log(`Wrote ${files.length} notebook preview SVGs.`);
}

export { buildNotebookPreviewAssets };
