import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "docs", "MSIGSDK_FEATURE_REFERENCE.md");
const outputPath = path.join(rootDir, "docs", "index.html");
const redirectPath = path.join(rootDir, "docs", "MSIGSDK_FEATURE_REFERENCE.html");

const markdown = readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderInline(value) {
  const codeSpans = [];
  let text = String(value ?? "").replace(/`([^`]+)`/g, (_match, code) => {
    const token = `@@CODE_${codeSpans.length}@@`;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  text = escapeHtml(text).replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, href) =>
      `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`,
  );

  codeSpans.forEach((html, index) => {
    text = text.replaceAll(`@@CODE_${index}@@`, html);
  });

  return text;
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isTableStart(lines, index) {
  return (
    index + 1 < lines.length &&
    lines[index].trim().startsWith("|") &&
    isTableDivider(lines[index + 1])
  );
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(lines, start) {
  const header = splitTableRow(lines[start]);
  const rows = [];
  let index = start + 2;

  while (index < lines.length && lines[index].trim().startsWith("|")) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const headerHtml = header
    .map((cell) => `<th>${renderInline(cell)}</th>`)
    .join("");
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`,
    )
    .join("\n");

  return {
    html: `<div class="table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
    next: index,
  };
}

function renderMarkdown(markdownText) {
  const lines = markdownText.split("\n");
  const html = [];
  const headings = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^```(\w+)?/);
    if (fence) {
      const language = fence[1] || "";
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      html.push(
        `<pre class="code-block"><code${
          language ? ` data-language="${escapeHtml(language)}"` : ""
        }>${escapeHtml(code.join("\n"))}</code></pre>`,
      );
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = renderTable(lines, index);
      html.push(table.html);
      index = table.next;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      headings.push({ level, text, id });
      html.push(
        `<h${level} id="${escapeHtml(id)}">${renderInline(text)}</h${level}>`,
      );
      index += 1;
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*-\s+/, ""));
        index += 1;
      }
      html.push(
        `<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      html.push(
        `<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`,
      );
      continue;
    }

    const paragraph = [trimmed];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,4}\s+/.test(lines[index].trim()) &&
      !/^```/.test(lines[index].trim()) &&
      !isTableStart(lines, index) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return { html: html.join("\n"), headings };
}

const rendered = renderMarkdown(markdown);
const toc = rendered.headings
  .filter((heading) => heading.level === 2 || heading.level === 3)
  .map(
    (heading) =>
      `<a class="toc-level-${heading.level}" href="#${escapeHtml(heading.id)}">${renderInline(
        heading.text,
      )}</a>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="mSigSDK documentation for browser-native mutational signature workflows, inputs, outputs, warnings, defaults, reports, adapters, and interpretation boundaries."
    />
    <title>mSigSDK documentation</title>
    <style>
      :root {
        --bg: #f7f8f4;
        --surface: #ffffff;
        --ink: #16211d;
        --muted: #61706a;
        --rule: #d9e2dc;
        --teal: #168a8c;
        --green: #2f7d55;
        --code-bg: #111915;
        --code-ink: #ecf5ef;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
        line-height: 1.55;
      }

      a {
        color: var(--teal);
        font-weight: 700;
        text-decoration: none;
      }

      code,
      pre {
        font-family:
          "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      }

      .site-header {
        position: sticky;
        top: 0;
        z-index: 20;
        border-bottom: 1px solid var(--rule);
        background: rgba(247, 248, 244, 0.94);
        backdrop-filter: blur(14px);
      }

      .nav,
      .page {
        width: min(1180px, calc(100% - 36px));
        margin: 0 auto;
      }

      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 14px 0;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        color: var(--ink);
        font-weight: 760;
      }

      .brand-mark {
        display: grid;
        width: 36px;
        height: 36px;
        place-items: center;
        border-radius: 8px;
        background: var(--ink);
        color: #fff;
        font-size: 14px;
        font-weight: 800;
      }

      .nav-links {
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
        justify-content: flex-end;
        font-size: 14px;
      }

      .page {
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr);
        gap: 34px;
        padding: 42px 0 64px;
      }

      .toc {
        position: sticky;
        top: 82px;
        max-height: calc(100vh - 110px);
        overflow: auto;
        align-self: start;
        border: 1px solid var(--rule);
        border-radius: 8px;
        background: var(--surface);
        padding: 16px;
      }

      .toc strong {
        display: block;
        margin-bottom: 10px;
        font-size: 13px;
        text-transform: uppercase;
      }

      .toc a {
        display: block;
        padding: 5px 0;
        color: var(--muted);
        font-size: 13px;
        font-weight: 650;
      }

      .toc .toc-level-3 {
        padding-left: 12px;
        font-size: 12px;
      }

      .content {
        min-width: 0;
        overflow-x: hidden;
        border: 1px solid var(--rule);
        border-radius: 8px;
        background: var(--surface);
        padding: 34px;
      }

      h1,
      h2,
      h3,
      h4 {
        margin: 0;
        line-height: 1.15;
        letter-spacing: 0;
      }

      h1 {
        font-size: 46px;
      }

      h2 {
        margin-top: 42px;
        border-top: 1px solid var(--rule);
        padding-top: 28px;
        font-size: 30px;
      }

      h3 {
        margin-top: 28px;
        font-size: 22px;
      }

      h4 {
        margin-top: 22px;
        font-size: 18px;
      }

      h1 + h2,
      h2:first-child {
        margin-top: 0;
        border-top: 0;
        padding-top: 0;
      }

      p,
      ul,
      ol {
        color: var(--muted);
      }

      p {
        margin: 12px 0;
      }

      ul,
      ol {
        padding-left: 24px;
      }

      li {
        margin: 6px 0;
      }

      code {
        border-radius: 5px;
        background: #edf4ef;
        color: var(--green);
        padding: 1px 4px;
        font-size: 0.92em;
      }

      .code-block {
        overflow-x: auto;
        border-radius: 8px;
        background: var(--code-bg);
        color: var(--code-ink);
        padding: 16px;
      }

      .code-block code {
        background: transparent;
        color: inherit;
        padding: 0;
      }

      .table-wrap {
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        margin: 18px 0 26px;
        border: 1px solid var(--rule);
        border-radius: 8px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 720px;
      }

      th,
      td {
        border-bottom: 1px solid var(--rule);
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
      }

      th {
        background: #eef5f1;
        color: var(--ink);
        font-size: 13px;
      }

      td {
        color: var(--muted);
        font-size: 13px;
      }

      tr:last-child td {
        border-bottom: 0;
      }

      @media (max-width: 900px) {
        .page {
          grid-template-columns: 1fr;
        }

        .toc {
          position: static;
          max-height: none;
        }
      }

      @media (max-width: 640px) {
        .nav {
          align-items: flex-start;
          flex-direction: column;
        }

        .content {
          padding: 22px;
        }

        h1 {
          font-size: 36px;
        }
      }
    </style>
  </head>
  <body>
    <header class="site-header">
      <nav class="nav" aria-label="Documentation navigation">
        <a class="brand" href="../">
          <span class="brand-mark">mS</span>
          <span>mSigSDK</span>
        </a>
        <div class="nav-links">
          <a href="./">Docs</a>
          <a href="../notebooks/viewer.html">Notebooks</a>
          <a href="./api-reference.generated.json">API metadata</a>
          <a href="https://github.com/episphere/msig">GitHub</a>
        </div>
      </nav>
    </header>
    <main class="page">
      <aside class="toc" aria-label="Documentation table of contents">
        <strong>Contents</strong>
        ${toc}
      </aside>
      <article class="content">
        ${rendered.html}
      </article>
    </main>
  </body>
</html>
`;

writeFileSync(outputPath, html, "utf8");
writeFileSync(
  redirectPath,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=./" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="./" />
    <title>mSigSDK documentation</title>
    <script>
      window.location.replace("./");
    </script>
  </head>
  <body>
    <p><a href="./">Open mSigSDK documentation</a></p>
  </body>
</html>
`,
  "utf8",
);
console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
console.log(`Wrote ${path.relative(rootDir, redirectPath)}`);
