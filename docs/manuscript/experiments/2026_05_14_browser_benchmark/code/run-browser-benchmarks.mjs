#!/usr/bin/env node

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPERIMENT_DIR = resolve(
  fileURLToPath(new URL("..", import.meta.url))
);
const REPO_ROOT = resolve(EXPERIMENT_DIR, "..", "..", "..", "..");
const HARNESS_PATH = join(
  EXPERIMENT_DIR,
  "browser-benchmark-harness.html"
);
const DEFAULT_TIMEOUT_MS = 12 * 60 * 1000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function parseArgs(argv) {
  const options = {
    repeats: 3,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    browsers: ["chrome", "firefox"],
  };

  for (const arg of argv) {
    if (arg.startsWith("--repeats=")) {
      const value = Number(arg.slice("--repeats=".length));
      if (Number.isInteger(value) && value > 0) {
        options.repeats = value;
      }
    } else if (arg.startsWith("--timeout-ms=")) {
      const value = Number(arg.slice("--timeout-ms=".length));
      if (Number.isInteger(value) && value > 0) {
        options.timeoutMs = value;
      }
    } else if (arg.startsWith("--browsers=")) {
      const values = arg
        .slice("--browsers=".length)
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      if (values.length) {
        options.browsers = values;
      }
    }
  }

  return options;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (_error) {
    return false;
  }
}

async function findBrowser(browserName) {
  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.PROGRAMFILES || "";
  const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "";
  const candidates = {
    chrome: [
      join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      "chrome.exe",
    ],
    firefox: [
      join(programFiles, "Mozilla Firefox", "firefox.exe"),
      join(programFilesX86, "Mozilla Firefox", "firefox.exe"),
      join(localAppData, "Mozilla Firefox", "firefox.exe"),
      "firefox.exe",
    ],
  }[browserName] || [];

  for (const candidate of candidates) {
    if (candidate.endsWith(".exe") && candidate.includes(":")) {
      if (await exists(candidate)) {
        return candidate;
      }
    } else {
      return candidate;
    }
  }
  return null;
}

function browserArgs(browserName, url) {
  if (browserName === "chrome") {
    return [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--enable-features=MeasureMemory",
      "--js-flags=--expose-gc",
      url,
    ];
  }
  if (browserName === "firefox") {
    return ["-headless", url];
  }
  return [url];
}

function getVersion(executable) {
  return new Promise((resolveVersion) => {
    if (process.platform === "win32" && /^[A-Za-z]:\\/.test(executable)) {
      const child = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `(Get-Item -LiteralPath ${JSON.stringify(executable)}).VersionInfo.ProductVersion`,
        ],
        {
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.on("close", () => {
        const version = output.trim();
        if (version) {
          resolveVersion(version);
        } else {
          resolveVersion("");
        }
      });
      child.on("error", () => resolveVersion(""));
      return;
    }

    const child = spawn(executable, ["--version"], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("close", () => {
      resolveVersion(output.trim());
    });
    child.on("error", () => resolveVersion(""));
  });
}

function startServer({ onResult }) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "POST" && url.pathname === "/__msig_benchmark_results__") {
        const chunks = [];
        for await (const chunk of request) {
          chunks.push(chunk);
        }
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        onResult(payload);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }

      const requestPath =
        url.pathname === "/"
          ? HARNESS_PATH
          : resolve(REPO_ROOT, `.${decodeURIComponent(url.pathname)}`);
      if (!requestPath.startsWith(REPO_ROOT)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      await stat(requestPath);
      response.writeHead(200, {
        "content-type": MIME_TYPES[extname(requestPath).toLowerCase()] || "application/octet-stream",
      });
      createReadStream(requestPath).pipe(response);
    } catch (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end(String(error?.message || error));
    }
  });

  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

function launchBrowser({ browserName, executable, url, timeoutMs, onLog }) {
  const child = spawn(executable, browserArgs(browserName, url), {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let settled = false;
  const failurePromise = new Promise((resolveResult) => {
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      resolveResult({
        browser: browserName,
        status: "timeout",
        error: `Timed out after ${timeoutMs} ms`,
        rows: [],
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => onLog?.(browserName, chunk.toString()));
    child.stderr.on("data", (chunk) => onLog?.(browserName, chunk.toString()));
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolveResult({
        browser: browserName,
        status: "launch_failed",
        error: String(error?.message || error),
        rows: [],
      });
    });
    child.on("close", (code) => {
      if (!settled && code !== 0) {
        settled = true;
        clearTimeout(timer);
        resolveResult({
          browser: browserName,
          status: "closed_before_result",
          exitCode: code,
          rows: [],
        });
      }
    });
    child.on("exit", () => {
      clearTimeout(timer);
    });
  });

  return {
    child,
    failurePromise,
    close() {
      settled = true;
      child.kill();
    },
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return `${[headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

function flattenRows(results) {
  return results.flatMap((result) =>
    (result.rows || []).map((row) => ({
      browser: result.browser,
      browserVersion: result.browserVersion || "",
      userAgent: result.userAgent || "",
      status: result.status,
      ...row,
    }))
  );
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildHtmlTable(rows) {
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
    "Browser",
    "Use case",
    "Operation",
    "Samples (n)",
    "Signatures (n)",
    "Median runtime (ms)",
    "Runtime range (ms)",
    "Heap delta (MB)",
    "Memory method",
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>mSigSDK browser benchmark results</title>
</head>
<body>
<p style="font-family:Arial, Helvetica, sans-serif;font-size:11pt;line-height:1.3;margin:0 0 6px 0;color:#111827"><strong>Browser-native benchmark results.</strong> Table 6 scenarios were run with the standalone browser harness using the Web Performance API.</p>
<table style="${tableStyle}">
<thead><tr>${headers.map((header) => `<th style="${thStyle}">${htmlEscape(header)}</th>`).join("")}</tr></thead>
<tbody>
${rows
  .map((row) => {
    const cells = [
      `${row.browser} ${row.browserVersion}`.trim(),
      row.useCase,
      row.operation,
      row.samples,
      row.signatures,
      Number.isFinite(row.runtimeMedianMs) ? row.runtimeMedianMs.toFixed(2) : "NA",
      Number.isFinite(row.runtimeMinMs) && Number.isFinite(row.runtimeMaxMs)
        ? `${row.runtimeMinMs.toFixed(2)}-${row.runtimeMaxMs.toFixed(2)}`
        : "NA",
      Number.isFinite(row.heapDeltaMB) ? row.heapDeltaMB.toFixed(2) : "NA",
      row.memoryMethod,
    ];
    return `<tr>${cells.map((cell) => `<td style="${tdStyle}">${htmlEscape(cell)}</td>`).join("")}</tr>`;
  })
  .join("\n")}
</tbody>
</table>
<p style="font-family:Arial, Helvetica, sans-serif;font-size:9.5pt;line-height:1.3;margin:6px 0 20px 0;color:#4b5563"><em>Note.</em> Runtime was measured with performance.now(). Memory used performance.measureUserAgentSpecificMemory() where available, otherwise performance.memory.usedJSHeapSize where exposed by the browser, and is reported as approximate.</p>
</body>
</html>
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataDir = join(EXPERIMENT_DIR, "data");
  const tableDir = join(EXPERIMENT_DIR, "tables");
  await mkdir(dataDir, { recursive: true });
  await mkdir(tableDir, { recursive: true });
  await readFile(HARNESS_PATH, "utf8");

  const pendingResults = new Map();
  const server = await startServer({
    onResult(payload) {
      const browser = payload.browser || "unknown";
      const resolver = pendingResults.get(browser);
      if (resolver) {
        resolver(payload);
      }
    },
  });
  const port = server.address().port;
  const results = [];

  try {
    for (const browserName of options.browsers) {
      const executable = await findBrowser(browserName);
      if (!executable) {
        results.push({
          browser: browserName,
          status: "unavailable",
          error: `${browserName} executable not found`,
          rows: [],
        });
        continue;
      }
      const version = await getVersion(executable);
      const url =
        `http://127.0.0.1:${port}/docs/manuscript/experiments/2026_05_14_browser_benchmark/browser-benchmark-harness.html` +
        `?autorun=1&postResults=1&browser=${encodeURIComponent(browserName)}&repeats=${options.repeats}`;
      const resultPromise = new Promise((resolveResult) => {
        pendingResults.set(browserName, (payload) => {
          resolveResult({
            ...payload,
            status: payload.error ? "failed" : "completed",
            browser: browserName,
            browserVersion: version,
            executable,
          });
        });
      });
      const launched = launchBrowser({
        browserName,
        executable,
        url,
        timeoutMs: options.timeoutMs,
        onLog: () => {},
      });
      const result = await Promise.race([resultPromise, launched.failurePromise]);
      launched.close();
      pendingResults.delete(browserName);
      results.push({
        browserVersion: version,
        executable,
        ...result,
      });
    }
  } finally {
    server.close();
  }

  const rows = flattenRows(results);
  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    repeats: options.repeats,
    harness: HARNESS_PATH,
    results,
    rows,
  };
  const headers = [
    "browser",
    "browserVersion",
    "status",
    "useCase",
    "sequencing",
    "samples",
    "mutationsPerSample",
    "contexts",
    "signatures",
    "operation",
    "iterations",
    "thresholds",
    "ranks",
    "repeats",
    "runtimeMedianMs",
    "runtimeMinMs",
    "runtimeMaxMs",
    "heapDeltaMB",
    "heapAfterMB",
    "memoryMethod",
  ];
  await writeFile(
    join(dataDir, "browser-benchmark-results.json"),
    `${JSON.stringify(payload, null, 2)}\n`
  );
  await writeFile(
    join(dataDir, "browser_benchmark_results.csv"),
    toCsv(
      headers,
      rows.map((row) => headers.map((header) => row[header]))
    )
  );
  await writeFile(
    join(tableDir, "table_browser_benchmark_results.html"),
    buildHtmlTable(rows)
  );

  console.log(
    JSON.stringify(
      {
        generatedAt,
        repeats: options.repeats,
        resultStatuses: results.map((result) => ({
          browser: result.browser,
          browserVersion: result.browserVersion,
          status: result.status,
          rows: result.rows?.length || 0,
          error: result.error || null,
        })),
        outputs: {
          json: join(dataDir, "browser-benchmark-results.json"),
          csv: join(dataDir, "browser_benchmark_results.csv"),
          html: join(tableDir, "table_browser_benchmark_results.html"),
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
