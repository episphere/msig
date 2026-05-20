import {
  getExpectedContexts as getRegisteredExpectedContexts,
  getSBS96Contexts as getRegisteredSBS96Contexts,
  listMafConvertibleProfiles as listRegisteredMafConvertibleProfiles,
  listProfileDefinitions as listRegisteredProfileDefinitions,
} from "./profileRegistry.js";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return null;
}

/**
 * Returns the canonical SBS96 trinucleotide context labels.
 *
 * @function getSBS96Contexts
 * @memberof validation
 * @returns {string[]} Ordered SBS96 context labels.
 */
function getSBS96Contexts() {
  return getRegisteredSBS96Contexts();
}

/**
 * Returns the canonical mutation-context order for supported profile matrices.
 *
 * @function getExpectedContexts
 * @memberof validation
 * @param {Object} [options] - Context selection options.
 * @param {string} [options.profile="SBS"] - Mutation profile family.
 * @param {number} [options.matrix=96] - Matrix size.
 * @returns {string[]|null} Ordered context labels, or null for unsupported matrices.
 * @example
 * const contexts = mSigSDK.validation.getExpectedContexts({
 *   profile: "SBS",
 *   matrix: 96,
 * });
 */
function getExpectedContexts({ profile = "SBS", matrix = 96 } = {}) {
  return getRegisteredExpectedContexts({ profile, matrix });
}

/**
 * Lists all registered COSMIC-style profile targets known to the SDK.
 *
 * @function listProfileDefinitions
 * @memberof validation
 * @returns {Object[]} Profile definitions with canonical key, profile family, matrix size, contexts, input requirements, conversion support, and renderer mapping.
 */
function listProfileDefinitions() {
  return listRegisteredProfileDefinitions();
}

/**
 * Lists registered profile targets that can be derived directly from MAF-like rows.
 *
 * @function listMafConvertibleProfiles
 * @memberof validation
 * @returns {Object[]} Registered native MAF-derived targets, including SBS96, SBS1536, DBS78, and ID83.
 */
function listMafConvertibleProfiles() {
  return listRegisteredMafConvertibleProfiles();
}

function flattenRows(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const rows = [];
  for (const item of input) {
    if (Array.isArray(item)) {
      rows.push(...flattenRows(item));
    } else {
      rows.push(item);
    }
  }
  return rows;
}

/**
 * Converts long-form rows into a matrix object keyed by sample or signature.
 *
 * @function rowsToMatrix
 * @memberof validation
 * @param {Object[]} rows - Rows containing row id, mutation context, and value columns.
 * @param {Object} [options] - Column mapping options.
 * @param {string} [options.rowKey="sample"] - Row identifier field.
 * @param {string} [options.contextKey="mutationType"] - Mutation-context field.
 * @param {string} [options.valueKey="mutations"] - Numeric value field.
 * @returns {Object<string,Object<string,number>>} Matrix object.
 */
function rowsToMatrix(
  rows,
  {
    rowKey = "sample",
    contextKey = "mutationType",
    valueKey = "mutations",
  } = {}
) {
  const matrix = {};

  for (const row of flattenRows(rows)) {
    if (!isPlainObject(row)) {
      continue;
    }

    const rowName = row[rowKey];
    const context = row[contextKey];
    const value = toFiniteNumber(row[valueKey]);

    if (rowName === undefined || context === undefined || value === null) {
      continue;
    }

    if (!matrix[rowName]) {
      matrix[rowName] = {};
    }
    matrix[rowName][context] = value;
  }

  return matrix;
}

/**
 * Converts mSigPortal-style spectrum rows into a sample-by-context matrix.
 *
 * @function rowsToSampleSpectra
 * @memberof validation
 * @param {Object[]} rows - Long-form spectrum rows.
 * @param {Object} [options] - Optional field mappings.
 * @param {string} [options.sampleKey="sample"] - Sample identifier field.
 * @param {string} [options.contextKey="mutationType"] - Mutation-context field.
 * @param {string} [options.valueKey="mutations"] - Mutation count field.
 * @returns {Object<string,Object<string,number>>} Sample spectra matrix.
 */
function rowsToSampleSpectra(rows, options = {}) {
  return rowsToMatrix(rows, {
    rowKey: options.sampleKey || "sample",
    contextKey: options.contextKey || "mutationType",
    valueKey: options.valueKey || "mutations",
  });
}

/**
 * Converts mSigPortal-style signature rows into a signature-by-context matrix.
 *
 * @function rowsToSignatureMatrix
 * @memberof validation
 * @param {Object[]} rows - Long-form signature rows.
 * @param {Object} [options] - Optional field mappings.
 * @param {string} [options.signatureKey="signatureName"] - Signature identifier field.
 * @param {string} [options.contextKey="mutationType"] - Mutation-context field.
 * @param {string} [options.valueKey="contribution"] - Signature contribution field.
 * @returns {Object<string,Object<string,number>>} Signature matrix.
 */
function rowsToSignatureMatrix(rows, options = {}) {
  return rowsToMatrix(rows, {
    rowKey: options.signatureKey || "signatureName",
    contextKey: options.contextKey || "mutationType",
    valueKey: options.valueKey || "contribution",
  });
}

/**
 * Normalizes a nested matrix object to finite numeric values.
 *
 * @function normalizeMatrixObject
 * @memberof validation
 * @param {Object<string,Object<string,*>>} matrix - Matrix keyed by row and context.
 * @param {Object} [options] - Normalization options.
 * @param {string[]} [options.ignoredKeys=["rnorm"]] - Row keys to omit.
 * @returns {Object<string,Object<string,number>>} Numeric matrix with invalid values set to zero.
 */
function normalizeMatrixObject(matrix, { ignoredKeys = ["rnorm"] } = {}) {
  const normalized = {};

  if (!isPlainObject(matrix)) {
    return normalized;
  }

  for (const [rowName, row] of Object.entries(matrix)) {
    if (!isPlainObject(row)) {
      continue;
    }

    normalized[rowName] = {};
    for (const [context, value] of Object.entries(row)) {
      if (ignoredKeys.includes(context)) {
        continue;
      }

      const numericValue = toFiniteNumber(value);
      normalized[rowName][context] = numericValue === null ? 0 : numericValue;
    }
  }

  return normalized;
}

/**
 * Returns all unique context or signature columns seen across matrix objects.
 *
 * @function getMatrixContexts
 * @memberof validation
 * @param {...Object<string,Object<string,number>>} matrices - Matrices to inspect.
 * @returns {string[]} Context or column names in first-seen order.
 */
function getMatrixContexts(...matrices) {
  const contexts = [];
  const seen = new Set();

  for (const matrix of matrices) {
    if (!isPlainObject(matrix)) {
      continue;
    }

    for (const row of Object.values(matrix)) {
      if (!isPlainObject(row)) {
        continue;
      }

      for (const context of Object.keys(row)) {
        if (context === "rnorm" || seen.has(context)) {
          continue;
        }
        seen.add(context);
        contexts.push(context);
      }
    }
  }

  return contexts;
}

function collectMatrixIssues(matrix, matrixName, { allowNegative = false } = {}) {
  const issues = [];

  if (!isPlainObject(matrix)) {
    return [
      {
        level: "error",
        code: "invalid_matrix",
        message: `${matrixName} must be an object keyed by sample or signature name.`,
      },
    ];
  }

  for (const [rowName, row] of Object.entries(matrix)) {
    if (!isPlainObject(row)) {
      issues.push({
        level: "error",
        code: "invalid_row",
        row: rowName,
        message: `${matrixName}.${rowName} must be an object of numeric values.`,
      });
      continue;
    }

    for (const [context, value] of Object.entries(row)) {
      if (context === "rnorm") {
        continue;
      }

      const numericValue = toFiniteNumber(value);
      if (numericValue === null) {
        issues.push({
          level: "error",
          code: "non_numeric_value",
          row: rowName,
          context,
          value,
          message: `${rowName}.${context} is not numeric.`,
        });
      } else if (!allowNegative && numericValue < 0) {
        issues.push({
          level: "error",
          code: "negative_value",
          row: rowName,
          context,
          value: numericValue,
          message: `${rowName}.${context} must be non-negative.`,
        });
      }
    }
  }

  return issues;
}

function validateMatrixCoverage(matrix, expectedContexts) {
  const warnings = [];

  if (!Array.isArray(expectedContexts) || expectedContexts.length === 0) {
    return warnings;
  }

  const expected = new Set(expectedContexts);
  for (const [rowName, row] of Object.entries(matrix)) {
    const contexts = Object.keys(row).filter((context) => context !== "rnorm");
    const contextSet = new Set(contexts);
    const missingContexts = expectedContexts.filter(
      (context) => !contextSet.has(context)
    );
    const extraContexts = contexts.filter((context) => !expected.has(context));

    if (missingContexts.length > 0) {
      warnings.push({
        level: "warning",
        code: "missing_contexts",
        row: rowName,
        missingContexts,
        missingCount: missingContexts.length,
        message: `${rowName} is missing ${missingContexts.length} expected mutation contexts.`,
      });
    }

    if (extraContexts.length > 0) {
      warnings.push({
        level: "warning",
        code: "extra_contexts",
        row: rowName,
        extraContexts,
        extraCount: extraContexts.length,
        message: `${rowName} has ${extraContexts.length} contexts outside the expected matrix.`,
      });
    }
  }

  return warnings;
}

/**
 * Validates sample spectra before fitting, QC, or extraction.
 *
 * @function validateSpectra
 * @memberof validation
 * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
 * @param {Object} [options] - Validation options.
 * @param {string[]} [options.expectedContexts=null] - Expected context set and order.
 * @param {number} [options.minTotalMutations=0] - Low-burden warning threshold.
 * @param {boolean} [options.strict=false] - Treat warnings as invalid when true.
 * @returns {Object} Validation result with validity, issues, warnings, sample metrics, and contexts.
 * @example
 * const validation = mSigSDK.validation.validateSpectra(groupedSpectra, {
 *   expectedContexts: mSigSDK.validation.getExpectedContexts({ profile: "SBS", matrix: 96 }),
 *   minTotalMutations: 100,
 * });
 */
function validateSpectra(
  spectra,
  { expectedContexts = null, minTotalMutations = 0, strict = false } = {}
) {
  const matrix = normalizeMatrixObject(spectra);
  const issues = collectMatrixIssues(spectra, "spectra");
  const warnings = validateMatrixCoverage(matrix, expectedContexts);
  const samples = Object.entries(matrix).map(([sample, spectrum]) => {
    const values = Object.values(spectrum);
    const totalMutations = values.reduce((sum, value) => sum + value, 0);
    const nonZeroContexts = values.filter((value) => value > 0).length;
    const rowWarnings = [];

    if (totalMutations === 0) {
      rowWarnings.push("empty_spectrum");
    }

    if (totalMutations > 0 && totalMutations < minTotalMutations) {
      rowWarnings.push("low_mutation_burden");
    }

    return {
      sample,
      totalMutations,
      contexts: values.length,
      nonZeroContexts,
      zeroContexts: values.length - nonZeroContexts,
      warnings: rowWarnings,
    };
  });

  if (samples.length === 0) {
    issues.push({
      level: "error",
      code: "empty_spectra",
      message: "No sample spectra were found.",
    });
  }

  return {
    valid: issues.length === 0 && (!strict || warnings.length === 0),
    issues,
    warnings,
    samples,
    contexts: expectedContexts || getMatrixContexts(matrix),
  };
}

/**
 * Validates a reference or extracted signature matrix.
 *
 * @function validateSignatureMatrix
 * @memberof validation
 * @param {Object<string,Object<string,number>>} signatures - Signature matrix.
 * @param {Object} [options] - Validation options.
 * @param {string[]} [options.expectedContexts=null] - Expected context set and order.
 * @param {boolean} [options.strict=false] - Treat warnings as invalid when true.
 * @returns {Object} Validation result with validity, issues, warnings, signatures, and contexts.
 */
function validateSignatureMatrix(
  signatures,
  { expectedContexts = null, strict = false } = {}
) {
  const matrix = normalizeMatrixObject(signatures);
  const issues = collectMatrixIssues(signatures, "signatures");
  const warnings = validateMatrixCoverage(matrix, expectedContexts);

  if (Object.keys(matrix).length === 0) {
    issues.push({
      level: "error",
      code: "empty_signatures",
      message: "No reference signatures were found.",
    });
  }

  return {
    valid: issues.length === 0 && (!strict || warnings.length === 0),
    issues,
    warnings,
    signatures: Object.keys(matrix),
    contexts: expectedContexts || getMatrixContexts(matrix),
  };
}

/**
 * Validates a sample-by-signature exposure matrix.
 *
 * @function validateExposureMatrix
 * @memberof validation
 * @param {Object<string,Object<string,number>>} exposures - Exposure matrix.
 * @param {Object} [options] - Validation options.
 * @param {boolean} [options.strict=false] - Treat warnings as invalid when true.
 * @returns {Object} Validation result with validity, issues, warnings, samples, and signatures.
 */
function validateExposureMatrix(exposures, { strict = false } = {}) {
  const matrix = normalizeMatrixObject(exposures);
  const issues = collectMatrixIssues(exposures, "exposures");
  const warnings = [];

  for (const [sample, row] of Object.entries(matrix)) {
    const totalExposure = Object.values(row).reduce(
      (sum, value) => sum + value,
      0
    );

    if (totalExposure === 0) {
      warnings.push({
        level: "warning",
        code: "zero_total_exposure",
        sample,
        message: `${sample} has zero total exposure.`,
      });
    }
  }

  return {
    valid: issues.length === 0 && (!strict || warnings.length === 0),
    issues,
    warnings,
    samples: Object.keys(matrix),
    signatures: getMatrixContexts(matrix),
  };
}

/**
 * Validates MAF-like rows before converting them into mutational spectra.
 *
 * @function validateMafRows
 * @memberof validation
 * @param {Object[]|Object[][]} rows - MAF rows or nested MAF row arrays.
 * @param {Object} [options] - Validation options.
 * @param {string[]} [options.requiredFields] - Required MAF fields, compared case-insensitively.
 * @returns {Object} Validation result with row count, required fields, and issues.
 */
function validateMafRows(
  rows,
  {
    requiredFields = [
      "chromosome",
      "start_position",
      "reference_allele",
      "tumor_seq_allele2",
      "variant_type",
    ],
  } = {}
) {
  const flattenedRows = flattenRows(rows);
  const issues = [];

  flattenedRows.forEach((row, index) => {
    if (!isPlainObject(row)) {
      issues.push({
        level: "error",
        code: "invalid_maf_row",
        index,
        message: `MAF row ${index} is not an object.`,
      });
      return;
    }

    const lowerCaseRow = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
    );

    for (const field of requiredFields) {
      if (
        lowerCaseRow[field] === undefined ||
        lowerCaseRow[field] === null ||
        lowerCaseRow[field] === ""
      ) {
        issues.push({
          level: "error",
          code: "missing_maf_field",
          index,
          field,
          message: `MAF row ${index} is missing ${field}.`,
        });
      }
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    rowCount: flattenedRows.length,
    requiredFields,
  };
}

/**
 * Throws when a validation result is invalid.
 *
 * @function assertValid
 * @memberof validation
 * @param {Object} validationResult - Result from a validation helper.
 * @param {string} [label="Validation"] - Label used in the thrown error.
 * @returns {Object} The original validation result when valid.
 * @throws {Error} If validationResult.valid is false.
 */
function assertValid(validationResult, label = "Validation") {
  if (!validationResult.valid) {
    const messages = validationResult.issues
      .map((issue) => issue.message)
      .join("; ");
    throw new Error(`${label} failed: ${messages}`);
  }

  return validationResult;
}

export {
  assertValid,
  flattenRows,
  getExpectedContexts,
  getMatrixContexts,
  getSBS96Contexts,
  listMafConvertibleProfiles,
  listProfileDefinitions,
  isPlainObject,
  normalizeMatrixObject,
  rowsToMatrix,
  rowsToSampleSpectra,
  rowsToSignatureMatrix,
  toFiniteNumber,
  validateExposureMatrix,
  validateMafRows,
  validateSignatureMatrix,
  validateSpectra,
};
