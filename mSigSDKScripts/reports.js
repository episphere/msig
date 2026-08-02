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

const REPORT_SCHEMA_VERSION = "msig.report.v0.3";
const REPORT_VERSION = "0.3.0";
const REPRODUCIBILITY_SCHEMA_VERSION = "msig.reproducibility.v0.1";
const REPRODUCIBILITY_REQUIREMENTS = Object.freeze([
  "sdkArtifact",
  "adapterImplementations",
  "runtimeAndPackageArtifacts",
  "lockfilesOrArtifactHashes",
  "localInputHashes",
  "signatureCatalogPayload",
  "contextOrder",
  "analysisParameters",
  "randomNumberGeneration",
  "reportSchema",
  "executionEnvironment",
  "archivedTestData",
  "rerunScripts",
]);

function hasEvidence(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const GIT_COMMIT_PATTERN = /^[a-f0-9]{7,40}$/i;

function hasSha256(value) {
  if (typeof value === "string") {
    return SHA256_PATTERN.test(value);
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  if (SHA256_PATTERN.test(String(value.sha256 || value.value || ""))) {
    return true;
  }
  if (Array.isArray(value.files)) {
    return value.files.length > 0 && value.files.every((file) => hasSha256(file));
  }
  return false;
}

function hasRecoverableImmutableReference(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.source === "string" &&
      value.source.trim() &&
      (value.immutable === true || value.embedded === true) &&
      (typeof value.archiveUri === "string" || value.embedded === true)
  );
}

function hasNamedHashEntries(value, { requireRecoverable = false } = {}) {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).map(([name, entry]) => ({ name, ...entry }))
      : [];
  return (
    entries.length > 0 &&
    entries.every(
      (entry) =>
        typeof entry === "object" &&
        (Boolean(entry.path || entry.name || entry.uri || entry.reference)) &&
        hasSha256(entry) &&
        (!requireRecoverable || hasRecoverableImmutableReference(entry))
    )
  );
}

function validEvidence(requirement, value) {
  if (!hasEvidence(value)) {
    return false;
  }
  switch (requirement) {
    case "sdkArtifact":
      return Boolean(
        value &&
          typeof value === "object" &&
          GIT_COMMIT_PATTERN.test(String(value.commit || "")) &&
          hasSha256(value.releaseArtifact) &&
          hasRecoverableImmutableReference(value.releaseArtifact)
      );
    case "adapterImplementations":
    case "runtimeAndPackageArtifacts":
    case "lockfilesOrArtifactHashes":
    case "localInputHashes":
    case "archivedTestData":
    case "rerunScripts":
      return hasNamedHashEntries(value, { requireRecoverable: true });
    case "signatureCatalogPayload":
      return Boolean(
        value &&
          typeof value === "object" &&
          hasSha256(value.payloadSha256 || value.payload || value) &&
          hasRecoverableImmutableReference(value) &&
          (value.contextOrderSha256 ? hasSha256(value.contextOrderSha256) : true)
      );
    case "contextOrder":
      return Boolean(
        value &&
          Array.isArray(value.values) &&
          value.values.length > 0 &&
          hasSha256(value.sha256 || value) &&
          hasRecoverableImmutableReference(value)
      );
    case "analysisParameters":
      return Boolean(
        value &&
          typeof value === "object" &&
          ["fitting", "filtering", "bootstrap", "qc"].every(
            (key) => value[key] && typeof value[key] === "object"
          )
      );
    case "randomNumberGeneration":
      return Boolean(
        value &&
          typeof value === "object" &&
          typeof value.algorithm === "string" &&
          value.algorithm.length > 0 &&
          value.seed !== undefined &&
          value.seed !== null
      );
    case "reportSchema":
      return Boolean(
        value &&
          typeof value === "object" &&
          typeof value.schemaVersion === "string" &&
          typeof value.version === "string"
      );
    case "executionEnvironment":
      return Boolean(
        value &&
          typeof value === "object" &&
          Object.keys(value).some((key) => /runtime|browser|node|python|rVersion/i.test(key)) &&
          Object.keys(value).some((key) => /platform|os|operatingSystem/i.test(key))
      );
    default:
      return false;
  }
}

function createReproducibilityRecord({
  evidence = {},
  notes = [],
} = {}) {
  const normalizedEvidence = Object.fromEntries(
    REPRODUCIBILITY_REQUIREMENTS.map((requirement) => [
      requirement,
      evidence[requirement] ?? null,
    ])
  );
  const missingRequirements = REPRODUCIBILITY_REQUIREMENTS.filter(
    (requirement) => !hasEvidence(normalizedEvidence[requirement])
  );
  const invalidRequirements = REPRODUCIBILITY_REQUIREMENTS.filter(
    (requirement) =>
      hasEvidence(normalizedEvidence[requirement]) &&
      !validEvidence(requirement, normalizedEvidence[requirement])
  );
  const computationallyReproducible =
    missingRequirements.length === 0 && invalidRequirements.length === 0;

  return {
    schemaVersion: REPRODUCIBILITY_SCHEMA_VERSION,
    claim: computationallyReproducible
      ? "computationally_reproducible_analysis_record"
      : "portable_schema_validated_analysis_record",
    auditability: {
      status: "supported",
      basis: "The record preserves the reported method, parameters, provenance, warnings, and evidence fields.",
    },
    portability: {
      status: "supported",
      basis: "The record is represented by the versioned mSigSDK report schema and can be consumed without the originating UI.",
    },
    computationalReproducibility: {
      status: computationallyReproducible ? "supported" : "not_established",
      basis: computationallyReproducible
        ? "All required immutable execution artifacts and rerun references are present in the record."
        : "A checksum can detect a changed or unavailable resource but cannot recover it; rerun claims require every listed immutable artifact reference.",
      missingRequirements,
      invalidRequirements,
    },
    requirements: [...REPRODUCIBILITY_REQUIREMENTS],
    evidence: normalizedEvidence,
    notes: Array.isArray(notes) ? notes : [notes],
  };
}

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
 * @param {Object} [reportInput.reproducibility=null] - Immutable artifact evidence used to classify rerun support.
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
    reproducibility = null,
  } = {},
  { format = "object" } = {}
) {
  const collectedCitations = [
    ...citations,
    ...collectReferences({ methodBasis, validation, qc, extraction, provenance }),
    FAIR_REFERENCE,
  ];
  const deduplicatedCitations = collectReferences({ references: collectedCitations });
  const reproducibilityRecord = createReproducibilityRecord({
    ...(reproducibility || {}),
    evidence: {
      ...(reproducibility?.evidence || {}),
      analysisParameters:
        reproducibility?.evidence?.analysisParameters ?? parameters,
      reportSchema: reproducibility?.evidence?.reportSchema ?? {
        schemaVersion: REPORT_SCHEMA_VERSION,
        version: REPORT_VERSION,
      },
    },
  });
  const report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    version: REPORT_VERSION,
    title,
    summary,
    generatedAt: new Date().toISOString(),
    workflowRole,
    scopeStatement,
    methodBasis,
    primaryInterpretationFields,
    reproducibilityStatement:
      reproducibilityStatement ||
      `This is a ${reproducibilityRecord.claim.replaceAll("_", " ")}. Auditability and portability are supported; computational reproducibility is ${reproducibilityRecord.computationalReproducibility.status === "supported" ? "supported by the recorded immutable artifacts" : "not established unless all listed immutable execution artifacts and rerun references are supplied"}.`,
    reproducibility: reproducibilityRecord,
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
    ["Reproducibility", report.reproducibility],
    ["Reproducibility statement", report.reproducibilityStatement],
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
  createReproducibilityRecord,
  REPRODUCIBILITY_REQUIREMENTS,
  downloadAnalysisReport,
};
