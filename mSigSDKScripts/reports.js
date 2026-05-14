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

const FAIR_REFERENCE = {
  key: "Wilkinson2016FAIR",
  citation:
    "Wilkinson MD, Dumontier M, Aalbersberg IJ, et al. The FAIR Guiding Principles for scientific data management and stewardship. Sci Data. 2016.",
  doi: "10.1038/sdata.2016.18",
  url: "https://doi.org/10.1038/sdata.2016.18",
};

function collectReferences(value, seen = new Set()) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const references = [];
  if (Array.isArray(value.references)) {
    for (const reference of value.references) {
      const key = reference?.doi || reference?.url || reference?.key || JSON.stringify(reference);
      if (!seen.has(key)) {
        seen.add(key);
        references.push(reference);
      }
    }
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      references.push(...collectReferences(child, seen));
    }
  }

  return references;
}

/**
 * Builds a structured analysis report from validation, QC, extraction, and provenance objects.
 *
 * @function createAnalysisReport
 * @memberof reports
 * @param {Object} [reportInput] - Report fields.
 * @param {string} [reportInput.title="mSigSDK Analysis Report"] - Report title.
 * @param {string} [reportInput.summary=""] - Short report summary.
 * @param {Object} [reportInput.parameters={}] - Analysis parameters.
 * @param {Object} [reportInput.validation=null] - Validation result object.
 * @param {Object} [reportInput.qc=null] - QC result object.
 * @param {Object} [reportInput.signatures=null] - Signature matrix or summary.
 * @param {Object} [reportInput.exposures=null] - Exposure matrix or summary.
 * @param {Object} [reportInput.extraction=null] - Signature extraction summary.
 * @param {Object} [reportInput.provenance=null] - Provenance record.
 * @param {string[]} [reportInput.citations=[]] - Citations to include.
 * @param {string|string[]} [reportInput.notes=[]] - Free-text report notes.
 * @param {string} [reportInput.workflowRole=null] - Optional workflow role label.
 * @param {string} [reportInput.scopeStatement=null] - Optional interpretation scope statement.
 * @param {Object} [reportInput.methodBasis=null] - Optional method-basis metadata.
 * @param {string[]} [reportInput.primaryInterpretationFields=[]] - Primary fields for downstream interpretation.
 * @param {Object} [options] - Output options.
 * @param {string} [options.format="object"] - "object", "json", or "html".
 * @returns {Object|string} Structured report object, JSON string, or HTML string.
 * @example
 * const report = mSigSDK.reports.createAnalysisReport({
 *   title: "Signature fitting QC report",
 *   validation,
 *   qc,
 *   provenance,
 * });
 */
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
    workflowRole = null,
    scopeStatement = null,
    methodBasis = null,
    primaryInterpretationFields = [],
    reproducibilityStatement = null,
  } = {},
  { format = "object" } = {}
) {
  const collectedCitations = [
    ...citations,
    ...collectReferences({ methodBasis, validation, qc, extraction, provenance }),
    FAIR_REFERENCE,
  ];
  const deduplicatedCitations = collectReferences({ references: collectedCitations });
  const report = {
    schemaVersion: "msig.report.v0.3",
    title,
    summary,
    generatedAt: new Date().toISOString(),
    workflowRole,
    scopeStatement,
    methodBasis,
    primaryInterpretationFields,
    reproducibilityStatement:
      reproducibilityStatement ||
      "This report records SDK version, parameters, method-basis citations, and available provenance fields in support of FAIR-style reuse. Remote catalogs, genome APIs, and user-supplied reference data should be pinned for long-term reproducibility.",
    parameters,
    validation,
    qc,
    signatures: summarizeObject(signatures),
    exposures: summarizeObject(exposures),
    extraction,
    provenance,
    citations: deduplicatedCitations,
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

/**
 * Renders a structured analysis report as standalone HTML.
 *
 * @function createAnalysisReportHTML
 * @memberof reports
 * @param {Object} report - Report object returned by createAnalysisReport.
 * @returns {string} HTML document string.
 */
function createAnalysisReportHTML(report) {
  const sections = [
    ["Summary", report.summary],
    ["Parameters", report.parameters],
    ["Validation", report.validation],
    ["QC", report.qc],
    ["Signature Extraction", report.extraction],
    ["Method Basis", report.methodBasis],
    ["Primary Interpretation Fields", report.primaryInterpretationFields],
    ["Reproducibility", report.reproducibilityStatement],
    ["Provenance", report.provenance],
    ["Citations", report.citations],
    ["Notes", report.notes],
  ];

  const sectionHtml = sections
    .filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        value !== "" &&
        (!Array.isArray(value) || value.length > 0)
    )
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

/**
 * Downloads an analysis report as an HTML file in the browser.
 *
 * @function downloadAnalysisReport
 * @memberof reports
 * @param {Object|string} report - Report object or pre-rendered HTML.
 * @param {string} [filename="msig-analysis-report.html"] - Download filename.
 * @returns {void}
 * @throws {Error} If called outside a browser DOM.
 */
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
