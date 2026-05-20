import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(rootDir, "package.json"), "utf8"),
);

const sourceFiles = [
  "main.js",
  "mSigSDKScripts/mSigPortalAPIs.js",
  "mSigSDKScripts/tcga.js",
  "mSigSDKScripts/utils.js",
  "mSigSDKScripts/machineLearning.js",
  "mSigSDKScripts/mutationalSpectrum.js",
  "mSigSDKScripts/userData.js",
  "mSigSDKScripts/validation.js",
  "mSigSDKScripts/qc.js",
  "mSigSDKScripts/signatureExtraction.js",
  "mSigSDKScripts/io.js",
  "mSigSDKScripts/reports.js",
  "mSigSDKScripts/workflows.js",
  "mSigSDKScripts/guidance.js",
  "mSigSDKScripts/presentation.js",
  "mSigSDKScripts/runners.js",
  "mSigSDKScripts/adapters.js",
];

const publicNamespaceSpecs = [
  { name: "mSigPortal", sourceNamespaces: ["mSigPortalData", "mSigPortalPlots"] },
  { name: "userData", sourceNamespaces: ["userData"] },
  { name: "tools", members: ["groupBy"] },
  { name: "machineLearning", members: ["preprocessData", "kFoldCV"] },
  {
    name: "signatureFitting",
    members: [
      "fitMutationalSpectraToSignatures",
      "plotPatientMutationalSignaturesExposure",
      "plotDatasetMutationalSignaturesExposure",
    ],
  },
  { name: "TCGA", sourceNamespaces: ["tcga"] },
  { name: "validation", sourceNamespaces: ["validation"] },
  { name: "qc", sourceNamespaces: ["qc"] },
  { name: "qcPlots", sourceNamespaces: ["qcPlots"] },
  { name: "signatureExtraction", sourceNamespaces: ["signatureExtraction"] },
  { name: "signatureExtractionPlots", sourceNamespaces: ["signatureExtractionPlots"] },
  { name: "io", sourceNamespaces: ["io"] },
  { name: "reports", sourceNamespaces: ["reports"] },
  { name: "advisor", sourceNamespaces: ["advisor"] },
  { name: "pipelines", sourceNamespaces: ["pipelines"] },
  { name: "workflows", sourceNamespaces: ["workflows"] },
  { name: "quickstart", sourceNamespaces: ["quickstart"] },
  { name: "provenance", sourceNamespaces: ["provenance"] },
  { name: "presentation", sourceNamespaces: ["presentation"] },
  { name: "runners", sourceNamespaces: ["runners"] },
  { name: "adapters", sourceNamespaces: ["adapters"] },
];

const stableNamespaces = publicNamespaceSpecs.map((spec) => spec.name);

const namespaceLabels = {
  mSigPortal: "mSigPortal",
  machineLearning: "Machine learning",
  userData: "User data",
  tools: "Utility tools",
  signatureFitting: "Signature fitting",
  TCGA: "TCGA helpers",
  provenance: "Provenance",
  validation: "Validation",
  qc: "QC and uncertainty",
  qcPlots: "QC plots",
  signatureExtraction: "Signature extraction",
  signatureExtractionPlots: "Extraction plots",
  io: "Import and export",
  reports: "Reports",
  workflows: "Workflow wrappers",
  presentation: "Presentation helpers",
  quickstart: "Quickstart wrappers",
  runners: "Browser runtimes",
  adapters: "External adapters",
  advisor: "Decision guidance",
  pipelines: "Pipeline APIs",
};

const namespaceSummaries = {
  mSigPortal: "mSigPortal project, sample, signature, exposure, matrix, and plot helpers.",
  machineLearning: "Preprocessing and cross-validation helpers used by browser workflows.",
  userData: "MAF, panel, and user-supplied spectrum conversion utilities.",
  tools: "Small utility helpers shared by the public SDK.",
  signatureFitting: "Known-signature exposure fitting and exposure plots.",
  TCGA: "TCGA and GDC query helpers for projects, expression, MAF, and variant records.",
  provenance: "Reproducibility metadata for SDK version, source data, genome context, and runtime.",
  validation: "Profile context registries, matrix normalization, input validation, and assertion helpers.",
  qc: "Mutation burden, reconstruction error, bootstrap, threshold, ambiguity, and fit evidence.",
  qcPlots: "Report-ready QC and uncertainty plots.",
  signatureExtraction: "Browser-sized NMF extraction, rank selection, worker execution, and matching.",
  signatureExtractionPlots: "NMF profile, exposure, and rank-selection plots.",
  io: "JSON, CSV, TSV, HTML, report, and archive helpers.",
  reports: "Structured analysis reports, HTML rendering, and schema-ready report rows.",
  workflows: "High-level analysis wrappers for signature fitting and NMF workflows.",
  presentation: "Publication-context summaries and tooltip text for generated figures.",
  quickstart: "Small-option entry points for MAF, cohort, panel, and report workflows.",
  runners: "Optional Pyodide and WebR execution helpers for compatible packages.",
  adapters: "SigProfiler, deconstructSigs, sigminer, MuSiCal, COSMIC, and generic TSV handoffs.",
  advisor: "Decision guidance for reporting mode, warnings, and recommended next actions.",
  pipelines: "Full-control workflow APIs with validation, QC, reporting, and provenance blocks.",
};

function runDocumentation() {
  const executable = path.join(
    rootDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "documentation.cmd" : "documentation",
  );

  return execFileSync(
    executable,
    [
      "build",
      ...sourceFiles,
      "--shallow",
      "--format",
      "json",
      "--sort-order",
      "source",
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 80 * 1024 * 1024,
    },
  );
}

function textFromMarkdown(node) {
  if (!node) return "";
  if (typeof node === "string") return node.trim();
  if (node.value) return String(node.value);
  if (Array.isArray(node.children)) {
    return node.children
      .map(textFromMarkdown)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function typeToString(type) {
  if (!type) return "";
  switch (type.type) {
    case "NameExpression":
      return type.name || "";
    case "OptionalType":
      return `${typeToString(type.expression)}=`;
    case "NullableType":
      return `?${typeToString(type.expression)}`;
    case "NonNullableType":
      return `!${typeToString(type.expression)}`;
    case "RestType":
      return `...${typeToString(type.expression)}`;
    case "TypeApplication":
      return `${typeToString(type.expression)}<${(type.applications || [])
        .map(typeToString)
        .filter(Boolean)
        .join(", ")}>`;
    case "UnionType":
      return (type.elements || []).map(typeToString).filter(Boolean).join(" | ");
    case "RecordType":
      return "Object";
    case "FunctionType":
      return "Function";
    case "AllLiteral":
      return "*";
    case "NullLiteral":
      return "null";
    case "UndefinedLiteral":
      return "undefined";
    case "VoidLiteral":
      return "void";
    default:
      return type.name || type.type || "";
  }
}

function normalizeParam(param) {
  return {
    name: param.name || "",
    type: typeToString(param.type),
    default: param.default ?? null,
    description: textFromMarkdown(param.description),
    properties: (param.properties || []).map(normalizeParam),
  };
}

function normalizeFunction(doc) {
  return {
    name: doc.name,
    kind: doc.kind || "function",
    async: Boolean(doc.async),
    sourceNamespace: doc.memberof || doc.path?.[0]?.name || null,
    description: textFromMarkdown(doc.description),
    params: (doc.params || []).map(normalizeParam),
    returns: (doc.returns || []).map((entry) => ({
      type: typeToString(entry.type),
      description: textFromMarkdown(entry.description),
    })),
    examples: (doc.examples || []).map((entry) => entry.description).filter(Boolean),
    source: {
      file: doc.context?.file
        ? path.relative(rootDir, doc.context.file).replaceAll("\\", "/")
        : null,
      line: doc.context?.loc?.start?.line || null,
    },
  };
}

function fallbackFunction(name) {
  return {
    name,
    kind: "function",
    async: false,
    description: fallbackMemberDescriptions[name] || "",
    params: [],
    returns: [],
    examples: [],
    source: {
      file: null,
      line: null,
    },
  };
}

const fallbackMemberDescriptions = {
  groupBy: "Groups array records by a selected key.",
};

function collectNamespaces(rawDocs) {
  const functionDocsByName = new Map();
  const functionsBySourceNamespace = new Map();

  function rememberSourceFunction(namespaceName, doc) {
    if (!namespaceName || !doc?.name) return;
    if (!functionsBySourceNamespace.has(namespaceName)) {
      functionsBySourceNamespace.set(namespaceName, []);
    }
    functionsBySourceNamespace.get(namespaceName).push(doc);
    if (!functionDocsByName.has(doc.name)) {
      functionDocsByName.set(doc.name, doc);
    }
  }

  for (const doc of rawDocs) {
    if (doc.kind === "namespace") {
      for (const member of doc.members?.static || []) {
        rememberSourceFunction(doc.name, member);
      }
    }

    if (doc.memberof) {
      rememberSourceFunction(doc.memberof, doc);
    } else if (doc.kind === "function" && doc.name && !functionDocsByName.has(doc.name)) {
      functionDocsByName.set(doc.name, doc);
    }
  }

  return publicNamespaceSpecs.map((spec) => {
    const seen = new Set();
    const functions = [];

    function addDoc(docOrName) {
      const doc =
        typeof docOrName === "string"
          ? functionDocsByName.get(docOrName) || fallbackFunction(docOrName)
          : docOrName;
      if (!doc?.name || seen.has(doc.name)) return;
      seen.add(doc.name);
      functions.push(normalizeFunction(doc));
    }

    for (const sourceNamespace of spec.sourceNamespaces || []) {
      for (const doc of functionsBySourceNamespace.get(sourceNamespace) || []) {
        addDoc(doc);
      }
    }

    for (const member of spec.members || []) {
      addDoc(member);
    }

    functions.sort((a, b) => a.name.localeCompare(b.name));

    return {
      name: spec.name,
      label: namespaceLabels[spec.name] || spec.name,
      summary: namespaceSummaries[spec.name] || "",
      functions,
    };
  });
}

const rawDocs = JSON.parse(runDocumentation());
const namespaces = collectNamespaces(rawDocs);
const functions = namespaces.flatMap((namespace) =>
  namespace.functions.map((fn) => ({ ...fn, namespace: namespace.name })),
);

const apiReference = {
  generatedAt: new Date().toISOString(),
  generator: {
    name: "documentation.js",
    version: packageJson.devDependencies?.documentation || "14.0.3",
  },
  package: {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    homepage: packageJson.homepage,
  },
  importSnippet: `const { mSigSDK } = await import(
  "https://episphere.github.io/msig/main.js"
);`,
  sourceFiles,
  stats: {
    namespaces: namespaces.length,
    functions: functions.length,
    asyncFunctions: functions.filter((fn) => fn.async).length,
    functionsWithExamples: functions.filter((fn) => fn.examples.length > 0).length,
  },
  namespaces,
};

writeFileSync(
  path.join(rootDir, "docs", "api-reference.generated.json"),
  `${JSON.stringify(apiReference, null, 2)}\n`,
);

console.log(
  `Generated docs/api-reference.generated.json with ${apiReference.stats.namespaces} namespaces and ${apiReference.stats.functions} functions.`,
);
