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

function getSBS96Contexts() {
  const bases = ["A", "C", "G", "T"];
  const substitutions = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];
  const contexts = [];

  for (const fivePrime of bases) {
    for (const substitution of substitutions) {
      for (const threePrime of bases) {
        contexts.push(`${fivePrime}[${substitution}]${threePrime}`);
      }
    }
  }

  return contexts;
}

function getExpectedContexts({ profile = "SBS", matrix = 96 } = {}) {
  if (String(profile).toUpperCase() === "SBS" && Number(matrix) === 96) {
    return getSBS96Contexts();
  }

  return null;
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

function rowsToSampleSpectra(rows, options = {}) {
  return rowsToMatrix(rows, {
    rowKey: options.sampleKey || "sample",
    contextKey: options.contextKey || "mutationType",
    valueKey: options.valueKey || "mutations",
  });
}

function rowsToSignatureMatrix(rows, options = {}) {
  return rowsToMatrix(rows, {
    rowKey: options.signatureKey || "signatureName",
    contextKey: options.contextKey || "mutationType",
    valueKey: options.valueKey || "contribution",
  });
}

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
