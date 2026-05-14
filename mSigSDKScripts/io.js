import {
  getMatrixContexts,
  normalizeMatrixObject,
  rowsToSampleSpectra,
  rowsToSignatureMatrix,
  toFiniteNumber,
} from "./validation.js";

function parseDelimited(text, delimiter = "\t") {
  return String(text)
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(delimiter));
}

function serializeDelimited(rows, delimiter = "\t") {
  return rows.map((row) => row.join(delimiter)).join("\n");
}

function normalizeExposureRecord(record) {
  const total = Object.values(record).reduce(
    (sum, value) => sum + (toFiniteNumber(value) || 0),
    0
  );
  if (total <= 0) {
    return record;
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      (toFiniteNumber(value) || 0) / total,
    ])
  );
}

/**
 * Serializes a row-oriented matrix object as tab-separated text.
 *
 * @function exportMatrixTSV
 * @memberof io
 * @param {Object<string,Object<string,number>>} matrix - Matrix keyed by row name.
 * @param {Object} [options] - Export options.
 * @param {string} [options.rowHeader="id"] - Header label for the row-name column.
 * @param {string[]} [options.columns=null] - Column order to export.
 * @returns {string} Tab-separated matrix text.
 */
function exportMatrixTSV(matrix, { rowHeader = "id", columns = null } = {}) {
  const normalizedMatrix = normalizeMatrixObject(matrix);
  const columnNames = columns || getMatrixContexts(normalizedMatrix);
  const rows = [[rowHeader, ...columnNames]];

  for (const [rowName, values] of Object.entries(normalizedMatrix)) {
    rows.push([
      rowName,
      ...columnNames.map((columnName) => values[columnName] || 0),
    ]);
  }

  return serializeDelimited(rows);
}

/**
 * Parses a tabular matrix into a row-oriented matrix object.
 *
 * @function importMatrixTSV
 * @memberof io
 * @param {string} text - Delimited matrix text.
 * @param {Object} [options] - Import options.
 * @param {number} [options.idColumn=0] - Index of the row-name column.
 * @param {string} [options.delimiter="\t"] - Column delimiter.
 * @returns {Object<string,Object<string,number>>} Parsed matrix.
 */
function importMatrixTSV(text, { idColumn = 0, delimiter = "\t" } = {}) {
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) {
    return {};
  }

  const header = rows[0];
  const valueColumns = header
    .map((name, index) => ({ name, index }))
    .filter((column) => column.index !== idColumn);
  const matrix = {};

  for (const row of rows.slice(1)) {
    const rowName = row[idColumn];
    if (!rowName) {
      continue;
    }

    matrix[rowName] = {};
    for (const column of valueColumns) {
      matrix[rowName][column.name] = toFiniteNumber(row[column.index]) || 0;
    }
  }

  return matrix;
}

/**
 * Converts a sample spectra matrix into long-form rows.
 *
 * @function spectraToRows
 * @memberof io
 * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
 * @returns {Object[]} Rows with sample, mutationType, and mutations fields.
 */
function spectraToRows(spectra) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const rows = [];

  for (const [sample, spectrum] of Object.entries(normalizedSpectra)) {
    for (const [mutationType, mutations] of Object.entries(spectrum)) {
      rows.push({
        sample,
        mutationType,
        mutations,
      });
    }
  }

  return rows;
}

/**
 * Converts a signature matrix into long-form rows.
 *
 * @function signatureMatrixToRows
 * @memberof io
 * @param {Object<string,Object<string,number>>} signatures - Signature matrix.
 * @returns {Object[]} Rows with signatureName, mutationType, and contribution fields.
 */
function signatureMatrixToRows(signatures) {
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const rows = [];

  for (const [signatureName, signature] of Object.entries(normalizedSignatures)) {
    for (const [mutationType, contribution] of Object.entries(signature)) {
      rows.push({
        signatureName,
        mutationType,
        contribution,
      });
    }
  }

  return rows;
}

/**
 * Converts an exposure matrix into long-form rows.
 *
 * @function exposureMatrixToRows
 * @memberof io
 * @param {Object<string,Object<string,number>>} exposures - Sample-by-signature exposure matrix.
 * @returns {Object[]} Rows with sample, signatureName, and exposure fields.
 */
function exposureMatrixToRows(exposures) {
  const normalizedExposures = normalizeMatrixObject(exposures);
  const rows = [];

  for (const [sample, exposureRecord] of Object.entries(normalizedExposures)) {
    for (const [signatureName, exposure] of Object.entries(exposureRecord)) {
      rows.push({
        sample,
        signatureName,
        exposure,
      });
    }
  }

  return rows;
}

/**
 * Converts long-form exposure rows into a sample-by-signature matrix.
 *
 * @function rowsToExposureMatrix
 * @memberof io
 * @param {Object[]} rows - Exposure rows.
 * @param {Object} [options] - Field mapping options.
 * @param {string} [options.sampleKey="sample"] - Sample identifier field.
 * @param {string} [options.signatureKey="signatureName"] - Signature identifier field.
 * @param {string} [options.exposureKey="exposure"] - Exposure value field.
 * @returns {Object<string,Object<string,number>>} Exposure matrix.
 */
function rowsToExposureMatrix(
  rows,
  {
    sampleKey = "sample",
    signatureKey = "signatureName",
    exposureKey = "exposure",
  } = {}
) {
  const exposures = {};

  for (const row of rows) {
    const sample = row[sampleKey];
    const signatureName = row[signatureKey];
    const exposure = toFiniteNumber(row[exposureKey]);

    if (!sample || !signatureName || exposure === null) {
      continue;
    }

    if (!exposures[sample]) {
      exposures[sample] = {};
    }
    exposures[sample][signatureName] = exposure;
  }

  return exposures;
}

/**
 * Exports spectra in SigProfiler-style MutationType-by-sample format.
 *
 * @function exportSigProfilerMatrix
 * @memberof io
 * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
 * @param {Object} [options] - Export options.
 * @param {string[]} [options.contexts=null] - Mutation-context row order.
 * @returns {string} Tab-separated SigProfiler-style matrix.
 * @example
 * const tsv = mSigSDK.io.exportSigProfilerMatrix(groupedSpectra, {
 *   contexts: mSigSDK.validation.getExpectedContexts({ profile: "SBS", matrix: 96 }),
 * });
 */
function exportSigProfilerMatrix(spectra, { contexts = null } = {}) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const contextNames = contexts || getMatrixContexts(normalizedSpectra);
  const sampleNames = Object.keys(normalizedSpectra);
  const rows = [["MutationType", ...sampleNames]];

  for (const context of contextNames) {
    rows.push([
      context,
      ...sampleNames.map((sampleName) => normalizedSpectra[sampleName][context] || 0),
    ]);
  }

  return serializeDelimited(rows);
}

/**
 * Imports a SigProfiler-style MutationType-by-sample matrix.
 *
 * @function importSigProfilerMatrix
 * @memberof io
 * @param {string} text - SigProfiler-style delimited matrix.
 * @param {Object} [options] - Import options.
 * @param {string} [options.delimiter="\t"] - Column delimiter.
 * @returns {Object<string,Object<string,number>>} Sample spectra matrix.
 */
function importSigProfilerMatrix(text, { delimiter = "\t" } = {}) {
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) {
    return {};
  }

  const sampleNames = rows[0].slice(1);
  const spectra = Object.fromEntries(sampleNames.map((sample) => [sample, {}]));

  for (const row of rows.slice(1)) {
    const context = row[0];
    sampleNames.forEach((sampleName, index) => {
      spectra[sampleName][context] = toFiniteNumber(row[index + 1]) || 0;
    });
  }

  return spectra;
}

/**
 * Exports signatures in COSMIC-style MutationType-by-signature format.
 *
 * @function exportCOSMICSignatureMatrix
 * @memberof io
 * @param {Object<string,Object<string,number>>} signatures - Signature matrix.
 * @param {Object} [options] - Export options.
 * @param {string[]} [options.contexts=null] - Mutation-context row order.
 * @returns {string} Tab-separated COSMIC-style signature matrix.
 */
function exportCOSMICSignatureMatrix(signatures, { contexts = null } = {}) {
  const normalizedSignatures = normalizeMatrixObject(signatures);
  const contextNames = contexts || getMatrixContexts(normalizedSignatures);
  const signatureNames = Object.keys(normalizedSignatures);
  const rows = [["MutationType", ...signatureNames]];

  for (const context of contextNames) {
    rows.push([
      context,
      ...signatureNames.map(
        (signatureName) => normalizedSignatures[signatureName][context] || 0
      ),
    ]);
  }

  return serializeDelimited(rows);
}

/**
 * Imports a COSMIC-style MutationType-by-signature matrix.
 *
 * @function importCOSMICSignatureMatrix
 * @memberof io
 * @param {string} text - COSMIC-style delimited matrix.
 * @param {Object} [options] - Import options.
 * @param {string} [options.delimiter="\t"] - Column delimiter.
 * @returns {Object<string,Object<string,number>>} Signature matrix.
 */
function importCOSMICSignatureMatrix(text, { delimiter = "\t" } = {}) {
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) {
    return {};
  }

  const signatureNames = rows[0].slice(1);
  const signatures = Object.fromEntries(
    signatureNames.map((signatureName) => [signatureName, {}])
  );

  for (const row of rows.slice(1)) {
    const context = row[0];
    signatureNames.forEach((signatureName, index) => {
      signatures[signatureName][context] = toFiniteNumber(row[index + 1]) || 0;
    });
  }

  return signatures;
}

/**
 * Exports spectra and optional signatures in MuSiCal-compatible tabular form.
 *
 * MuSiCal accepts mutation-type rows with sample or signature columns for count
 * matrices and signature catalogs. This helper emits the same orientation used
 * by SigProfiler/COSMIC TSV files, which is the safest interchange format for
 * comparing SDK spectra, fitted exposures, and external MuSiCal results.
 *
 * @function exportMuSiCalInput
 * @memberof io
 * @param {Object} input - Matrices to export.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra matrix.
 * @param {Object<string,Object<string,number>>} [input.signatures=null] - Optional signature matrix.
 * @param {Object} [options] - Export options.
 * @param {string[]} [options.contexts=null] - Mutation-context row order.
 * @param {string} [options.delimiter="\t"] - Column delimiter.
 * @returns {Object} MuSiCal-compatible matrix text and manifest metadata.
 */
function exportMuSiCalInput(
  { spectra, signatures = null },
  { contexts = null, delimiter = "\t" } = {}
) {
  const normalizedSpectra = normalizeMatrixObject(spectra);
  const normalizedSignatures = signatures
    ? normalizeMatrixObject(signatures)
    : null;
  const contextNames =
    contexts ||
    getMatrixContexts({
      ...normalizedSpectra,
      ...(normalizedSignatures || {}),
    });
  const sampleNames = Object.keys(normalizedSpectra);
  const spectraRows = [["MutationType", ...sampleNames]];

  for (const context of contextNames) {
    spectraRows.push([
      context,
      ...sampleNames.map((sampleName) => normalizedSpectra[sampleName][context] || 0),
    ]);
  }

  const result = {
    format: "MuSiCal-compatible MutationType-by-sample TSV",
    spectra: serializeDelimited(spectraRows, delimiter),
    manifest: {
      spectraOrientation: "mutation_type_by_sample",
      signatureOrientation: normalizedSignatures
        ? "mutation_type_by_signature"
        : null,
      sampleCount: sampleNames.length,
      signatureCount: normalizedSignatures
        ? Object.keys(normalizedSignatures).length
        : 0,
      contextCount: contextNames.length,
      delimiter,
    },
  };

  if (normalizedSignatures) {
    const signatureNames = Object.keys(normalizedSignatures);
    const signatureRows = [["MutationType", ...signatureNames]];
    for (const context of contextNames) {
      signatureRows.push([
        context,
        ...signatureNames.map(
          (signatureName) => normalizedSignatures[signatureName][context] || 0
        ),
      ]);
    }
    result.signatures = serializeDelimited(signatureRows, delimiter);
  }

  return result;
}

/**
 * Imports MuSiCal exposure output into a sample-by-signature matrix.
 *
 * The parser accepts both common orientations: sample rows with signature
 * columns, or signature rows with sample columns. Auto-detection is based on the
 * leading header and first-column labels, with an explicit orientation override
 * available for scripted workflows.
 *
 * @function importMuSiCalOutput
 * @memberof io
 * @param {string} text - Delimited MuSiCal exposure table.
 * @param {Object} [options] - Import options.
 * @param {string} [options.delimiter="\t"] - Column delimiter.
 * @param {"auto"|"sample_by_signature"|"signature_by_sample"} [options.orientation="auto"] - Exposure table orientation.
 * @param {boolean} [options.normalize=false] - Normalize exposures within each sample.
 * @returns {Object<string,Object<string,number>>} Sample-by-signature exposure matrix.
 */
function importMuSiCalOutput(
  text,
  { delimiter = "\t", orientation = "auto", normalize = false } = {}
) {
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) {
    return {};
  }

  const header = rows[0].map((value) => String(value || "").trim());
  const firstHeader = header[0].toLowerCase();
  const firstColumnValues = rows
    .slice(1)
    .map((row) => String(row[0] || "").trim())
    .filter(Boolean);
  const firstColumnLooksLikeSignatures =
    firstColumnValues.length > 0 &&
    firstColumnValues.every((value) => /^(SBS|DBS|ID|CN|SV|RS)\w*/i.test(value));
  const resolvedOrientation =
    orientation !== "auto"
      ? orientation
      : /^sample|sample_id|samples$/.test(firstHeader)
        ? "sample_by_signature"
        : /^signature|signature_name|signatures$/.test(firstHeader) ||
            firstColumnLooksLikeSignatures
          ? "signature_by_sample"
          : "sample_by_signature";

  const exposures = {};

  if (resolvedOrientation === "signature_by_sample") {
    const sampleNames = header.slice(1);
    for (const sampleName of sampleNames) {
      exposures[sampleName] = {};
    }
    for (const row of rows.slice(1)) {
      const signatureName = row[0];
      if (!signatureName) {
        continue;
      }
      sampleNames.forEach((sampleName, index) => {
        exposures[sampleName][signatureName] =
          toFiniteNumber(row[index + 1]) || 0;
      });
    }
  } else {
    const signatureNames = header.slice(1);
    for (const row of rows.slice(1)) {
      const sampleName = row[0];
      if (!sampleName) {
        continue;
      }
      exposures[sampleName] = {};
      signatureNames.forEach((signatureName, index) => {
        exposures[sampleName][signatureName] =
          toFiniteNumber(row[index + 1]) || 0;
      });
    }
  }

  if (!normalize) {
    return exposures;
  }

  return Object.fromEntries(
    Object.entries(exposures).map(([sample, exposureRecord]) => [
      sample,
      normalizeExposureRecord(exposureRecord),
    ])
  );
}

export {
  exposureMatrixToRows,
  exportCOSMICSignatureMatrix,
  exportMatrixTSV,
  exportMuSiCalInput,
  exportSigProfilerMatrix,
  importCOSMICSignatureMatrix,
  importMatrixTSV,
  importMuSiCalOutput,
  importSigProfilerMatrix,
  rowsToExposureMatrix,
  rowsToSampleSpectra,
  rowsToSignatureMatrix,
  signatureMatrixToRows,
  spectraToRows,
};
