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

export {
  exposureMatrixToRows,
  exportCOSMICSignatureMatrix,
  exportMatrixTSV,
  exportSigProfilerMatrix,
  importCOSMICSignatureMatrix,
  importMatrixTSV,
  importSigProfilerMatrix,
  rowsToExposureMatrix,
  rowsToSampleSpectra,
  rowsToSignatureMatrix,
  signatureMatrixToRows,
  spectraToRows,
};
