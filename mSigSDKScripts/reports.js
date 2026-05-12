function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function summarizeObject(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
    };
  }

  if (typeof value === "object") {
    return {
      type: "object",
      keys: Object.keys(value).length,
    };
  }

  return value;
}

function createAnalysisReport(
  {
    title = "mSigSDK Analysis Report",
    summary = "",
    parameters = {},
    validation = null,
    qc = null,
    signatures = null,
    exposures = null,
    extraction = null,
    provenance = null,
    citations = [],
    notes = [],
  } = {},
  { format = "object" } = {}
) {
  const report = {
    title,
    summary,
    generatedAt: new Date().toISOString(),
    parameters,
    validation,
    qc,
    signatures: summarizeObject(signatures),
    exposures: summarizeObject(exposures),
    extraction,
    provenance,
    citations,
    notes: Array.isArray(notes) ? notes : [notes],
  };

  if (format === "json") {
    return JSON.stringify(report, null, 2);
  }

  if (format === "html") {
    return createAnalysisReportHTML(report);
  }

  return report;
}

function createAnalysisReportHTML(report) {
  const sections = [
    ["Summary", report.summary],
    ["Parameters", report.parameters],
    ["Validation", report.validation],
    ["QC", report.qc],
    ["Signature Extraction", report.extraction],
    ["Provenance", report.provenance],
    ["Citations", report.citations],
    ["Notes", report.notes],
  ];

  const sectionHtml = sections
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([heading, value]) => {
      const body =
        typeof value === "string"
          ? `<p>${escapeHtml(value)}</p>`
          : `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
      return `<section><h2>${escapeHtml(heading)}</h2>${body}</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(report.title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
      h1, h2 { color: #111; }
      section { margin: 24px 0; }
      pre { padding: 12px; overflow: auto; background: #f4f4f4; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(report.title)}</h1>
    <p>Generated at ${escapeHtml(report.generatedAt)}</p>
    ${sectionHtml}
  </body>
</html>`;
}

function downloadAnalysisReport(report, filename = "msig-analysis-report.html") {
  if (typeof document === "undefined" || typeof Blob === "undefined") {
    throw new Error("downloadAnalysisReport requires a browser DOM.");
  }

  const html =
    typeof report === "string" ? report : createAnalysisReportHTML(report);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export {
  createAnalysisReport,
  createAnalysisReportHTML,
  downloadAnalysisReport,
};
