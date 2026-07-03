import {
  bootstrapCohortSignatureFitParallel,
  bootstrapSignatureFit,
  bootstrapSignatureFitParallel,
} from "../mSigSDKScripts/qc.js";
import { runCohortFit } from "../mSigSDKScripts/guidance.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function syntheticInputs({ contextCount = 24, signatureCount = 6, sampleCount = 8 } = {}) {
  const contexts = Array.from({ length: contextCount }, (_, index) => `C${index}`);
  const signatures = Object.fromEntries(
    Array.from({ length: signatureCount }, (_, signatureIndex) => [
      `S${signatureIndex + 1}`,
      Object.fromEntries(
        contexts.map((context, contextIndex) => [
          context,
          ((signatureIndex + 3) * (contextIndex + 5)) % 19 + 1,
        ])
      ),
    ])
  );
  const spectra = Object.fromEntries(
    Array.from({ length: sampleCount }, (_, sampleIndex) => [
      `sample_${sampleIndex + 1}`,
      Object.fromEntries(
        contexts.map((context, contextIndex) => [
          context,
          (sampleIndex + 1) * (((contextIndex * 7) % 17) + 2),
        ])
      ),
    ])
  );
  return { contexts, signatures, spectra };
}

const { contexts, signatures, spectra } = syntheticInputs();
const sampleSpectrum = spectra.sample_1;
const bootstrapOptions = {
  contexts,
  iterations: 40,
  seed: 20260627,
  workerCount: 2,
  minIterationsForParallel: 10,
};

const serial = await bootstrapSignatureFit(
  signatures,
  sampleSpectrum,
  bootstrapOptions
);
const parallel = await bootstrapSignatureFitParallel(
  signatures,
  sampleSpectrum,
  bootstrapOptions
);

assert(serial.exposureSamples.length === 40, "serial bootstrap iteration count mismatch");
assert(parallel.exposureSamples.length === 40, "parallel bootstrap iteration count mismatch");
assert(parallel.parallelization?.workerCount === 2, "parallel bootstrap did not use requested workers");
assert(parallel.signatures.length === serial.signatures.length, "signature summary count mismatch");

const cohort = await bootstrapCohortSignatureFitParallel(signatures, spectra, {
  contexts,
  iterations: 30,
  seed: 20260627,
  workerCount: 3,
  minIterationsForParallel: 10,
});

assert(Object.keys(cohort.results).length === 8, "cohort bootstrap sample count mismatch");
assert(cohort.parallelization.workerCount === 3, "cohort bootstrap did not use requested workers");
assert(cohort.results.sample_1.exposureSamples.length === 30, "cohort bootstrap iteration count mismatch");

const workflow = await runCohortFit(
  { signatures, spectra },
  {
    contexts,
    runBootstrap: true,
    bootstrapSampleLimit: 8,
    bootstrapIterations: 20,
    parallelBootstrap: true,
    bootstrapWorkerCount: 3,
    minIterationsForParallel: 10,
    runThresholdSensitivity: false,
  }
);

assert(Object.keys(workflow.bootstrap).length === 8, "workflow bootstrap sample count mismatch");
assert(workflow.bootstrapParallelization?.workerCount === 3, "workflow did not record worker bootstrap");

console.log(
  JSON.stringify(
    {
      ok: true,
      singleSampleMode: parallel.parallelization.mode,
      cohortMode: cohort.parallelization.mode,
      workflowMode: workflow.bootstrapParallelization.mode,
      workflowBootstrapSamples: Object.keys(workflow.bootstrap).length,
    },
    null,
    2
  )
);
