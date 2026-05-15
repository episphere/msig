import {
  createInteroperabilityBundle,
  prepareDeconstructSigsInput,
  prepareMuSiCalRefitInput,
  prepareSigminerInput,
  parseSigminerOutput,
  parseSigProfilerMatrixGeneratorOutput,
  prepareSigProfilerClustersInput,
  prepareSigProfilerMatrixGeneratorInput,
  prepareSigProfilerPlottingInput,
  prepareSigProfilerSimulatorInput,
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

const exampleVcf = [
  "##fileformat=VCFv4.2",
  "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO",
  "1\t1000\t.\tC\tA\t.\tPASS\t.",
].join("\n");

const matrixGeneratorInput = prepareSigProfilerMatrixGeneratorInput(
  { files: [{ path: "SampleA.vcf", text: exampleVcf }] },
  { project: "SmokeMatrix", referenceGenome: "GRCh37" }
);
if (
  matrixGeneratorInput.files.length !== 1 ||
  !matrixGeneratorInput.pythonSnippet.includes("SigProfilerMatrixGeneratorFunc")
) {
  throw new Error("SigProfilerMatrixGenerator input preparation failed.");
}

const matrixGeneratorParsed = parseSigProfilerMatrixGeneratorOutput([
  {
    path: "/output/SBS96.all",
    text: spaInput.files[0].text,
  },
]);
if (!matrixGeneratorParsed.matrices["SBS96"]?.SampleA) {
  throw new Error("SigProfilerMatrixGenerator output parsing failed.");
}

const simulatorInput = prepareSigProfilerSimulatorInput(
  { files: [{ path: "SampleA.vcf", text: exampleVcf }] },
  { project: "SmokeSimulator", simulations: 2 }
);
if (
  simulatorInput.files.length !== 1 ||
  !simulatorInput.pythonSnippet.includes("SigProfilerSimulator")
) {
  throw new Error("SigProfilerSimulator input preparation failed.");
}

const clustersInput = prepareSigProfilerClustersInput(
  { files: [{ path: "SampleA.vcf", text: exampleVcf }] },
  { project: "SmokeClusters" }
);
if (
  clustersInput.files.length !== 1 ||
  !clustersInput.pythonSnippet.includes("hp.analysis")
) {
  throw new Error("SigProfilerClusters input preparation failed.");
}

const plottingInput = prepareSigProfilerPlottingInput(
  { spectra },
  { contexts, matrixType: "SBS", plotType: "96" }
);
if (
  plottingInput.files.length !== 1 ||
  !plottingInput.pythonSnippet.includes("plotSBS")
) {
  throw new Error("sigProfilerPlotting input preparation failed.");
}

const bundle = createInteroperabilityBundle({ spectra, signatures }, { contexts });
if (
  !bundle.tools.sigProfilerAssignment ||
  !bundle.tools.sigProfilerExtractor ||
  !bundle.tools.sigProfilerPlotting ||
  !bundle.tools.deconstructSigs ||
  !bundle.tools.sigminer ||
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
      sigminerFiles: sigminerInput.files.length,
      sigProfilerMatrixGeneratorFiles: matrixGeneratorInput.files.length,
      sigProfilerSimulatorFiles: simulatorInput.files.length,
      sigProfilerClustersFiles: clustersInput.files.length,
      sigProfilerPlottingFiles: plottingInput.files.length,
      interoperabilityTools: Object.keys(bundle.tools),
      sparseRefitRuntime: sparseRefit.runtime,
      pyodideWorkerAvailable: runtime.available,
      missingPyodideCapabilities: runtime.missing,
    },
    null,
    2
  )
);
