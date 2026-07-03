import path from "node:path";
import {
  ensureDir,
  FIGURE_ROOT,
  findAvailableBrowsers,
  launchBrowser,
  MANUSCRIPT_ROOT,
  relativeArtifact,
  tempDir,
  withStaticServer,
  writeJson,
  writeText,
} from "./lib/experiment-utils.mjs";

const FIGURES = [
  {
    id: "figure1",
    title: "Figure 1 - Architecture and data-residency boundary",
    sourceHtml: "figures/figure1-architecture-data-residency.html",
    outputBase: "figure1-architecture-data-residency",
  },
  {
    id: "figure2",
    title: "Figure 2 - Zero-install cumulative timing",
    sourceHtml: "figures/figure2-zero-install-workflow.html",
    outputBase: "figure2-zero-install-cumulative-timing",
  },
  {
    id: "figure3",
    title: "Figure 3 - Public-cohort capability",
    sourceHtml: "figures/figure3-public-cohort-capabilities.html",
    outputBase: "figure3-public-cohort-capability",
  },
  {
    id: "figure4",
    title: "Figure 4 - Exposure-solve benchmarks",
    sourceHtml: "figures/figure4-runtime-benchmarks.html",
    outputBase: "figure4-exposure-solve-benchmarks",
  },
];

await ensureDir(FIGURE_ROOT);
const browsers = await findAvailableBrowsers();
const browser = browsers.find((candidate) => candidate.engine === "chromium");
if (!browser) {
  throw new Error("Exporting manuscript PDFs requires Chrome or Edge.");
}

const exported = [];
await withStaticServer(MANUSCRIPT_ROOT, async ({ baseUrl }) => {
  const context = await launchBrowser(browser, {
    userDataDir: tempDir("main-figure-export"),
    viewport: { width: 1500, height: 1100 },
  });
  try {
    for (const figure of FIGURES) {
      const page = await context.newPage();
      const sourceUrl = `${baseUrl}/${figure.sourceHtml}`;
      await page.goto(sourceUrl, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForSelector("svg", { timeout: 60000 });
      await page.waitForFunction(() => {
        const svg = document.querySelector("svg");
        return svg && svg.querySelectorAll("*").length > 5;
      });

      const svg = await page.$eval("svg", (node) => {
        const clone = node.cloneNode(true);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
        style.textContent = [
          "text{font-family:Arial,sans-serif;letter-spacing:0;}",
          ".tick text{fill:#53616f;font-size:11px;}",
          ".domain,.tick line{stroke:#aab6c2;}",
        ].join("");
        clone.insertBefore(style, clone.firstChild);
        const viewBox = clone.getAttribute("viewBox");
        if (viewBox && (!clone.getAttribute("width") || !clone.getAttribute("height"))) {
          const parts = viewBox.split(/[,\s]+/).map(Number).filter(Number.isFinite);
          if (parts.length === 4) {
            clone.setAttribute("width", String(parts[2]));
            clone.setAttribute("height", String(parts[3]));
          }
        }
        return new XMLSerializer().serializeToString(clone);
      });
      await page.close();

      const { width, height } = svgDimensions(svg);
      const svgPath = path.join(FIGURE_ROOT, `${figure.outputBase}.svg`);
      const htmlPath = path.join(FIGURE_ROOT, `${figure.outputBase}.html`);
      const pngPath = path.join(FIGURE_ROOT, `${figure.outputBase}.png`);
      const pdfPath = path.join(FIGURE_ROOT, `${figure.outputBase}.pdf`);
      await writeText(svgPath, `${svg}\n`);
      if (path.resolve(htmlPath) !== path.resolve(path.join(MANUSCRIPT_ROOT, figure.sourceHtml))) {
        await writeText(htmlPath, standaloneSvgHtml(svg, width, height, figure.title));
      }

      const exportPage = await context.newPage();
      await exportPage.setViewportSize({
        width: Math.ceil(width),
        height: Math.ceil(height),
      });
      await exportPage.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#ffffff;}svg{display:block;width:${width}px;height:${height}px;}</style></head><body>${svg}</body></html>`,
        { waitUntil: "load" }
      );
      await exportPage.screenshot({
        path: pngPath,
        fullPage: true,
        omitBackground: false,
      });
      await exportPage.pdf({
        path: pdfPath,
        printBackground: true,
        width: `${Math.ceil(width)}px`,
        height: `${Math.ceil(height)}px`,
        margin: { top: "0px", right: "0px", bottom: "0px", left: "0px" },
      });
      await exportPage.close();

      exported.push({
        ...figure,
        sourceUrl,
        width,
        height,
        html: relativeArtifact(htmlPath),
        svg: relativeArtifact(svgPath),
        pdf: relativeArtifact(pdfPath),
        png: relativeArtifact(pngPath),
      });
      console.log(`Exported ${figure.id}: ${relativeArtifact(svgPath)}, ${relativeArtifact(pdfPath)}, ${relativeArtifact(pngPath)}`);
    }
  } finally {
    await context.close();
  }
});

const manifestPath = path.join(FIGURE_ROOT, "revision-figure-export-manifest.json");
await writeJson(manifestPath, {
  schemaVersion: "msig.figure_export.v1",
  generatedAt: new Date().toISOString(),
  generator: "scripts/manuscript/export-main-figure-assets.mjs",
  upstreamGenerator: "scripts/manuscript/generate-main-assets.mjs",
  regenerationCommand:
    "node scripts/manuscript/generate-main-assets.mjs && node scripts/manuscript/export-main-figure-assets.mjs",
  browser: {
    id: browser.id,
    label: browser.label,
    engine: browser.engine,
    executablePath: browser.executablePath,
  },
  figures: exported,
});
console.log(`Wrote ${relativeArtifact(manifestPath)}`);

function svgDimensions(svg) {
  const viewBox = String(svg).match(/viewBox="([^"]+)"/i)?.[1];
  if (viewBox) {
    const parts = viewBox.split(/[,\s]+/).map(Number).filter(Number.isFinite);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const width = Number(String(svg).match(/\swidth="([0-9.]+)"/i)?.[1]);
  const height = Number(String(svg).match(/\sheight="([0-9.]+)"/i)?.[1]);
  if (Number.isFinite(width) && Number.isFinite(height)) return { width, height };
  return { width: 1280, height: 760 };
}

function standaloneSvgHtml(svg, width, height, title) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; background: #ffffff; }
      svg { display: block; width: min(100vw, ${width}px); height: auto; }
    </style>
  </head>
  <body>${svg}</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
