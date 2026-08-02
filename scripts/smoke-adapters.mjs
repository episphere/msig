import {
  checkDeconstructSigsWebRAvailability,
  checkSigminerWebRAvailability,
  createInteroperabilityBundle,
  materializeAdapterComparisonExposure,
  prepareDeconstructSigsInput,
  prepareMuSiCalRefitInput,
  prepareSigminerInput,
  runDeconstructSigsWebR,
  runSigminerWebR,
  parseSigminerOutput,
  prepareSigProfilerAssignmentInput,
  runMuSiCalRefit,
  PACKAGE_RUNTIME_MANIFEST,
  listPackageRuntimes,
} from "../mSigSDKScripts/adapters.js";
import {
  checkWebRPackageAvailability,
  detectPyodideRuntime,
  detectWebRRuntime,
} from "../mSigSDKScripts/runners.js";
import { getExpectedContexts } from "../mSigSDKScripts/validation.js";

const contexts = getExpectedContexts({ profile: "SBS", matrix: 96 });
const spectra = {
  SampleA: Object.fromEntries(contexts.map((context) => [context, 0])),
};
const signatures = {
  SBS1: Object.fromEntries(contexts.map((context, index) => [context, index % 2 === 0 ? 1 : 0])),
  SBS5: Object.fromEntries(contexts.map((context, index) => [context, index % 2 === 1 ? 1 : 0])),
};

spectra.SampleA[contexts[0]] = 12;
spectra.SampleA[contexts[1]] = 8;
spectra.SampleA[contexts[2]] = 4;

const spaInput = prepareSigProfilerAssignmentInput({ spectra, signatures }, { contexts });
if (spaInput.files.length !== 2 || spaInput.manifest.contextCount !== 96) {
  throw new Error("SigProfilerAssignment input preparation failed.");
}
if (
  spaInput.comparisonContract?.output?.canonicalUnits !== "relative_fractions" ||
  spaInput.comparisonContract?.contextOrder?.values?.join("|") !== contexts.join("|") ||
  spaInput.comparisonContract?.reporting?.order !==
    "Convert to complete-catalog relative fractions first; apply the reporting cutoff second; renormalize retained values third."
) {
  throw new Error("Adapter comparison contract did not preserve units, order, and filtering semantics.");
}

const musicalInput = prepareMuSiCalRefitInput({ spectra, signatures }, { contexts });
if (musicalInput.files.length !== 2 || musicalInput.manifest.signatureCount !== 2) {
  throw new Error("MuSiCal refit input preparation failed.");
}

try {
  await runMuSiCalRefit(
    { spectra, signatures },
    { contexts, runtime: "js_sparse_nnls" }
  );
  throw new Error("MuSiCal adapter accepted a JavaScript fallback runtime.");
} catch (error) {
  if (!/Exact MuSiCal adapter execution requires runtime "pyodide"/.test(error.message)) {
    throw error;
  }
}

const omittedOutput = materializeAdapterComparisonExposure(
  { SBS1: 0.25, unassigned: 0.05 },
  ["SBS1", "SBS5"]
);
if (
  omittedOutput.omittedCatalogColumns.join("|") !== "SBS5" ||
  omittedOutput.extraOutputColumns.join("|") !== "unassigned" ||
  omittedOutput.unassignedOutputColumns.join("|") !== "unassigned" ||
  omittedOutput.relativeFractions.length !== 2 ||
  omittedOutput.relativeFractions[1] !== 0
) {
  throw new Error("Adapter comparison output omission and extra-column handling failed.");
}

const deconstructInput = prepareDeconstructSigsInput(
  { spectra, signatures },
  { contexts }
);
if (deconstructInput.files.length !== 2 || !deconstructInput.rSnippet.includes("whichSignatures")) {
  throw new Error("deconstructSigs input preparation failed.");
}

const sigminerInput = prepareSigminerInput(
  { spectra, signatures },
  { contexts, method: "NNLS" }
);
if (
  sigminerInput.files.length !== 2 ||
  !sigminerInput.rSnippet.includes("sigminer::sig_fit") ||
  sigminerInput.manifest.method !== "NNLS"
) {
  throw new Error("sigminer input preparation failed.");
}

const sigminerExposures = parseSigminerOutput("sample\tSBS1\tSBS5\nSampleA\t0.25\t0.75");
if (Math.abs((sigminerExposures.SampleA?.SBS5 || 0) - 0.75) > 1e-12) {
  throw new Error("sigminer output parsing failed.");
}

if (typeof runDeconstructSigsWebR !== "function" || typeof runSigminerWebR !== "function") {
  throw new Error("Exact WebR R-package adapter runs are not exported.");
}

if (typeof runMuSiCalRefit !== "function") {
  throw new Error("Exact MuSiCal Pyodide adapter run is not exported.");
}

if (
  !PACKAGE_RUNTIME_MANIFEST.tools?.musical ||
  listPackageRuntimes().some((runtime) => !runtime.exactPackageExecutionRequired)
) {
  throw new Error("Package runtime manifest did not mark exact package execution requirements.");
}
const supportedRuntimeIds = listPackageRuntimes().map((runtime) => runtime.tool).sort();
const expectedRuntimeIds = [
  "MuSiCal",
  "SigProfilerAssignment",
  "deconstructSigs",
  "sigminer",
].sort();
if (JSON.stringify(supportedRuntimeIds) !== JSON.stringify(expectedRuntimeIds)) {
  throw new Error(
    `Package runtime manifest exposed unexpected adapters: ${supportedRuntimeIds.join(", ")}`
  );
}

const mockedWebRPackageIndex = [
  "Package: sigminer",
  "Version: 2.3.0",
  "",
  "Package: nnls",
  "Version: 1.5",
].join("\n");
const mockedWebRPackages = await checkWebRPackageAvailability(["sigminer", "nnls"], {
  packageIndexUrls: [`data:text/plain,${encodeURIComponent(mockedWebRPackageIndex)}`],
  repositoryUrl: "https://example.invalid/webr",
});
if (typeof fetch === "function" && !mockedWebRPackages.available) {
  throw new Error("Mocked WebR package availability check failed.");
}
if (
  typeof fetch !== "function" &&
  (!mockedWebRPackages.errors?.some((message) => /fetch is not available/.test(message)) ||
    mockedWebRPackages.status === "available")
) {
  throw new Error("Mocked WebR package availability did not report missing fetch support.");
}

const deconstructWebRAvailability = await checkDeconstructSigsWebRAvailability();
const sigminerWebRAvailability = await checkSigminerWebRAvailability({
  method: "NNLS",
});
if (!["available", "missing package", "runtime unavailable"].includes(deconstructWebRAvailability.status)) {
  throw new Error("deconstructSigs WebR availability status was not classified.");
}
if (!["available", "missing package", "runtime unavailable"].includes(sigminerWebRAvailability.status)) {
  throw new Error("sigminer WebR availability status was not classified.");
}

const bundle = createInteroperabilityBundle({ spectra, signatures }, { contexts });
const bundleToolIds = Object.keys(bundle.tools).sort();
const expectedBundleToolIds = [
  "deconstructSigs",
  "musical",
  "sigProfilerAssignment",
  "sigminer",
];
if (JSON.stringify(bundleToolIds) !== JSON.stringify(expectedBundleToolIds)) {
  throw new Error(
    `Interoperability bundle exposed unexpected adapters: ${bundleToolIds.join(", ")}`
  );
}
if (
  bundle.comparisonContract?.schemaVersion !== "msig.adapter-comparison.v0.1" ||
  bundle.comparisonContract?.reporting?.unassigned === undefined ||
  bundle.comparisonContract?.options?.packageSpecificOptionsRetained?.length < 5
) {
  throw new Error("Interoperability bundle did not expose the semantic comparison contract.");
}

const runtime = detectPyodideRuntime();
const webRRuntime = detectWebRRuntime();
console.log(
  JSON.stringify(
    {
      status: "ok",
      sigProfilerAssignmentFiles: spaInput.files.length,
      musicalFiles: musicalInput.files.length,
      deconstructSigsFiles: deconstructInput.files.length,
      sigminerFiles: sigminerInput.files.length,
      interoperabilityTools: Object.keys(bundle.tools),
      packageRuntimeTools: Object.keys(PACKAGE_RUNTIME_MANIFEST.tools),
      pyodideWorkerAvailable: runtime.available,
      missingPyodideCapabilities: runtime.missing,
      webRRuntimeAvailable: webRRuntime.available,
      missingWebRCapabilities: webRRuntime.missing,
      mockedWebRPackagesAvailable: mockedWebRPackages.available,
      deconstructSigsWebRStatus: deconstructWebRAvailability.status,
      sigminerWebRStatus: sigminerWebRAvailability.status,
    },
    null,
    2
  )
);
