import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAnalysisReport } from "../mSigSDKScripts/reports.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(
  repoRoot,
  "schemas",
  "msig.report.v0.3",
  "report.schema.json"
);

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

  return errors;
}

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
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

const errors = validateSchema(schema, representativeReport);

if (errors.length > 0) {
  throw new Error(`Report schema validation failed:\n${errors.join("\n")}`);
}

console.log(
  `Validated representative createAnalysisReport output against ${path.relative(
    repoRoot,
    schemaPath
  )}.`
);
