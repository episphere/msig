import {
  createInteroperabilityBundle,
  prepareDeconstructSigsInput,
  prepareMuSiCalRefitInput,
  prepareSigProfilerAssignmentInput,
  prepareSigProfilerExtractorInput,
  runSparseNnlsRefit,
} from "../mSigSDKScripts/adapters.js";
import { detectPyodideRuntime } from "../mSigSDKScripts/runners.js";
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

const musicalInput = prepareMuSiCalRefitInput({ spectra, signatures }, { contexts });
if (musicalInput.files.length !== 2 || musicalInput.manifest.signatureCount !== 2) {
  throw new Error("MuSiCal refit input preparation failed.");
}

const extractorInput = prepareSigProfilerExtractorInput({ spectra }, { contexts });
if (extractorInput.files.length !== 1 || extractorInput.manifest.contextCount !== 96) {
  throw new Error("SigProfilerExtractor input preparation failed.");
}

const deconstructInput = prepareDeconstructSigsInput(
  { spectra, signatures },
  { contexts }
);
if (deconstructInput.files.length !== 2 || !deconstructInput.rSnippet.includes("whichSignatures")) {
  throw new Error("deconstructSigs input preparation failed.");
}

const bundle = createInteroperabilityBundle({ spectra, signatures }, { contexts });
if (
  !bundle.tools.sigProfilerAssignment ||
  !bundle.tools.sigProfilerExtractor ||
  !bundle.tools.deconstructSigs ||
  !bundle.tools.musical
) {
  throw new Error("Interoperability bundle preparation failed.");
}

const sparseRefit = await runSparseNnlsRefit(
  { spectra, signatures },
  { contexts, threshold: 0.01 }
);
if (!sparseRefit.exposures?.SampleA || sparseRefit.status !== "completed") {
  throw new Error("Sparse NNLS refit smoke test failed.");
}

const runtime = detectPyodideRuntime();
console.log(
  JSON.stringify(
    {
      status: "ok",
      sigProfilerAssignmentFiles: spaInput.files.length,
      musicalFiles: musicalInput.files.length,
      sigProfilerExtractorFiles: extractorInput.files.length,
      deconstructSigsFiles: deconstructInput.files.length,
      interoperabilityTools: Object.keys(bundle.tools),
      sparseRefitRuntime: sparseRefit.runtime,
      pyodideWorkerAvailable: runtime.available,
      missingPyodideCapabilities: runtime.missing,
    },
    null,
    2
  )
);
