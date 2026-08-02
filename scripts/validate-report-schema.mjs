import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAnalysisReport,
  createReproducibilityRecord,
  REPRODUCIBILITY_REQUIREMENTS,
} from "../mSigSDKScripts/reports.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(
  repoRoot,
  "schemas",
  "msig.report.v0.3",
  "report.schema.json"
);
const examplesDir = path.join(repoRoot, "schemas", "msig.report.v0.3", "examples");

function typeOf(value) {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function allowedType(schemaType, value) {
  const types = Array.isArray(schemaType) ? schemaType : [schemaType];
  return types.includes(typeOf(value));
}

function validateSchema(schema, value, pointer = "$") {
  const errors = [];

  if (schema.$ref) {
    const referencedSchema = schema.$ref
      .replace(/^#\//, "")
      .split("/")
      .reduce((current, key) => current?.[key], rootSchema);
    if (!referencedSchema) {
      return [`${pointer} references a missing schema definition.`];
    }
    return validateSchema(referencedSchema, value, pointer);
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${pointer} should equal ${JSON.stringify(schema.const)}.`);
  }

  if (schema.type && !allowedType(schema.type, value)) {
    errors.push(`${pointer} should be ${JSON.stringify(schema.type)}, got ${typeOf(value)}.`);
    return errors;
  }

  if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
    errors.push(`${pointer} should be an ISO 8601 date-time string.`);
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${pointer} should be one of ${schema.enum.join(", ")}.`);
  }

  if (schema.pattern && typeof value === "string" && !new RegExp(schema.pattern).test(value)) {
    errors.push(`${pointer} does not match the required pattern.`);
  }
  if (schema.minLength !== undefined && typeof value === "string" && value.length < schema.minLength) {
    errors.push(`${pointer} should contain at least ${schema.minLength} characters.`);
  }
  if (schema.minItems !== undefined && Array.isArray(value) && value.length < schema.minItems) {
    errors.push(`${pointer} should contain at least ${schema.minItems} items.`);
  }
  if (
    schema.minProperties !== undefined &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length < schema.minProperties
  ) {
    errors.push(`${pointer} should contain at least ${schema.minProperties} properties.`);
  }

  if (schema.required && value && typeof value === "object") {
    for (const key of schema.required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(`${pointer}.${key} is required.`);
      }
    }
  }

  if (schema.properties && value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, childSchema] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(...validateSchema(childSchema, value[key], `${pointer}.${key}`));
      }
    }
  }

  if (schema.items && Array.isArray(value)) {
    value.forEach((item, index) => {
      errors.push(...validateSchema(schema.items, item, `${pointer}[${index}]`));
    });
  }

  for (const keyword of ["anyOf", "oneOf"]) {
    if (schema[keyword]) {
      const matches = schema[keyword].filter(
        (candidate) => validateSchema(candidate, value, pointer).length === 0
      ).length;
      const valid = keyword === "oneOf" ? matches === 1 : matches >= 1;
      if (!valid) {
        errors.push(`${pointer} does not satisfy ${keyword}.`);
      }
    }
  }

  return errors;
}

let rootSchema;
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
rootSchema = schema;
const incompleteReproducibility = createReproducibilityRecord({
  evidence: { reportSchema: { schemaVersion: "msig.report.v0.3", version: "0.3.0" } },
});
if (
  incompleteReproducibility.claim !== "portable_schema_validated_analysis_record" ||
  incompleteReproducibility.computationalReproducibility.status !== "not_established" ||
  incompleteReproducibility.computationalReproducibility.missingRequirements.length !==
    REPRODUCIBILITY_REQUIREMENTS.length - 1
) {
  throw new Error("Reproducibility classification did not preserve the missing-artifact boundary.");
}
const placeholderReproducibility = createReproducibilityRecord({
  evidence: Object.fromEntries(
    REPRODUCIBILITY_REQUIREMENTS.map((requirement) => [requirement, { noted: true }])
  ),
});
if (
  placeholderReproducibility.claim !== "portable_schema_validated_analysis_record" ||
  placeholderReproducibility.computationalReproducibility.invalidRequirements.length === 0
) {
  throw new Error("Placeholder reproducibility evidence was incorrectly accepted.");
}
const completeHash = "a".repeat(64);
const completeArtifact = (path) => ({
  path,
  sha256: completeHash,
  source: "schema-validation-fixture",
  archiveUri: `https://archive.example/${encodeURIComponent(path)}`,
  immutable: true,
});
const completePayload = {
  payloadSha256: completeHash,
  source: "schema-validation-fixture",
  archiveUri: "https://archive.example/signature-catalog.json",
  immutable: true,
};
const completeReproducibility = createReproducibilityRecord({
  evidence: {
    sdkArtifact: {
      commit: "0123456789abcdef0123456789abcdef01234567",
      releaseArtifact: completeArtifact("msig-sdk-release.tgz"),
    },
    adapterImplementations: [completeArtifact("mSigSDKScripts/adapters.js")],
    runtimeAndPackageArtifacts: [completeArtifact("runtime-manifest.json")],
    lockfilesOrArtifactHashes: [completeArtifact("package-lock.json")],
    localInputHashes: [completeArtifact("input.json")],
    signatureCatalogPayload: completePayload,
    contextOrder: {
      values: ["A[C>A]A"],
      sha256: completeHash,
      source: "schema-validation-fixture",
      archiveUri: "https://archive.example/context-order.json",
      immutable: true,
    },
    analysisParameters: {
      fitting: { method: "NNLS" },
      filtering: { cutoff: 0.01 },
      bootstrap: { replicates: 0 },
      qc: { thresholds: {} },
    },
    randomNumberGeneration: { algorithm: "MT19937", seed: 17 },
    reportSchema: { schemaVersion: "msig.report.v0.3", version: "0.3.0" },
    executionEnvironment: { runtime: "node v24.13.0", platform: "win32" },
    archivedTestData: [completeArtifact("archived-test-data.zip")],
    rerunScripts: [completeArtifact("scripts/rerun.mjs")],
  },
});
if (
  completeReproducibility.claim !== "computationally_reproducible_analysis_record" ||
  completeReproducibility.computationalReproducibility.missingRequirements.length > 0 ||
  completeReproducibility.computationalReproducibility.invalidRequirements.length > 0
) {
  throw new Error("Complete reproducibility evidence was not accepted.");
}
const representativeReport = createAnalysisReport({
  title: "Representative mSigSDK Report",
  summary: "Representative report object used for schema validation.",
  workflowRole: "schema_validation",
  scopeStatement: "Schema validation fixture.",
  methodBasis: {
    fixture:
      "Representative method metadata with one citation-shaped reference.",
    references: [
      {
        key: "FixtureReference",
        citation: "Representative schema validation reference.",
        url: "https://episphere.github.io/msig/",
      },
    ],
  },
  primaryInterpretationFields: ["validation.valid", "qc.mutationBurden"],
  parameters: {
    genomeBuild: "hg38",
    expectedContexts: 96,
  },
  validation: {
    valid: true,
    warnings: [],
  },
  qc: {
    mutationBurden: {
      sampleCount: 1,
    },
  },
  signatures: {
    SBS1: {
      "A[C>A]A": 0.01,
    },
  },
  exposures: {
    sample_1: {
      SBS1: 1,
    },
  },
  extraction: null,
  provenance: {
    sdkVersion: "0.3.0",
  },
  notes: ["Schema validation fixture."],
});

const forgedComputationalReport = {
  ...representativeReport,
  reproducibility: {
    schemaVersion: "msig.reproducibility.v0.1",
    claim: "computationally_reproducible_analysis_record",
    auditability: { status: "supported" },
    portability: { status: "supported" },
    computationalReproducibility: {
      status: "supported",
      missingRequirements: [],
    },
    requirements: [...REPRODUCIBILITY_REQUIREMENTS],
    evidence: Object.fromEntries(
      REPRODUCIBILITY_REQUIREMENTS.map((requirement) => [requirement, { noted: true }])
    ),
  },
};
if (validateSchema(schema, forgedComputationalReport).length === 0) {
  throw new Error("Schema accepted a computational claim with placeholder evidence.");
}

function validateReport(value, label) {
  const errors = validateSchema(schema, value);
  if (errors.length > 0) {
    throw new Error(`${label} failed schema validation:\n${errors.join("\n")}`);
  }

  if (
    schema.additionalProperties === false &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(schema.properties || {}, key)) {
        errors.push(`${pointer}.${key} is not an allowed property.`);
      }
    }
  }
}

function readReportFile(reportPath) {
  return JSON.parse(fs.readFileSync(reportPath, "utf8"));
}

const requestedFiles = process.argv.slice(2);

if (requestedFiles.length > 0) {
  for (const requestedFile of requestedFiles) {
    const reportPath = path.resolve(process.cwd(), requestedFile);
    validateReport(readReportFile(reportPath), path.relative(repoRoot, reportPath));
    console.log(`Validated ${path.relative(repoRoot, reportPath)} against ${path.relative(repoRoot, schemaPath)}.`);
  }
} else {
  validateReport(representativeReport, "representative createAnalysisReport output");

  const validExamples = [
    "minimal-valid-report.json",
    "full-valid-report.json",
  ];
  for (const filename of validExamples) {
    const reportPath = path.join(examplesDir, filename);
    validateReport(readReportFile(reportPath), path.relative(repoRoot, reportPath));
  }

  const invalidPath = path.join(examplesDir, "invalid-missing-title.json");
  const invalidErrors = validateSchema(schema, readReportFile(invalidPath));
  if (invalidErrors.length === 0) {
    throw new Error(`${path.relative(repoRoot, invalidPath)} unexpectedly passed schema validation.`);
  }
  const missingReproducibilityFixture = readReportFile(
    path.join(examplesDir, "minimal-valid-report.json")
  );
  delete missingReproducibilityFixture.reproducibility;
  const missingReproducibilityErrors = validateSchema(
    schema,
    missingReproducibilityFixture
  );
  if (!missingReproducibilityErrors.includes("$.reproducibility is required.")) {
    throw new Error("A report without the reproducibility boundary unexpectedly passed schema validation.");
  }

  console.log(
    `Validated representative output and ${validExamples.length} valid example reports against ${path.relative(
      repoRoot,
      schemaPath
    )}; confirmed invalid example fails (${invalidErrors[0]}).`
  );
}
