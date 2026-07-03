import { getMutationalSpectrumData } from "../mSigSDKScripts/mSigPortalAPIs.js";
import {
  convertMafToProfileSpectra,
  getMutationalContext,
  get_sbs_trinucleotide_contexts,
} from "../mSigSDKScripts/mutationalSpectrum.js";
import {
  calculateReconstructionError,
  fitSpectraWithNNLS,
  summarizeMutationBurden,
} from "../mSigSDKScripts/qc.js";
import { createAnalysisReport } from "../mSigSDKScripts/reports.js";
import { extractSignaturesNMF } from "../mSigSDKScripts/signatureExtraction.js";
import { configureRuntimeOptions } from "../mSigSDKScripts/utils.js";

const originalFetch = globalThis.fetch;
const networkLog = [];

globalThis.fetch = async (resource, init = {}) => {
  const url =
    typeof resource === "string"
      ? resource
      : resource?.url || String(resource);
  networkLog.push({
    method: init?.method || "GET",
    url,
    body:
      init?.body === undefined
        ? null
        : String(init.body).slice(0, 500),
  });
  throw new Error(`Unexpected network request during strict-local smoke: ${url}`);
};

function zeroRecord(contexts) {
  return Object.fromEntries(contexts.map((context) => [context, 0]));
}

async function expectStrictBlock(label, callback) {
  try {
    await callback();
  } catch (error) {
    if (/strictLocal blocked|strictLocal could not resolve/.test(error.message)) {
      return {
        label,
        blocked: true,
        message: error.message,
      };
    }
    throw error;
  }
  throw new Error(`${label} was not blocked in strictLocal mode.`);
}

try {
  configureRuntimeOptions({
    strictLocal: true,
    debug: false,
  });

  const mafRows = [
    {
      project_code: "STRICT_LOCAL_SAMPLE",
      chromosome: "1",
      start_position: 1000000,
      reference_allele: "T",
      tumor_seq_allele2: "C",
      variant_type: "SNP",
      build: "hg19",
    },
  ];

  const conversion = await convertMafToProfileSpectra(mafRows, {
    profiles: ["SBS96"],
    groupBy: "project_code",
    genome: "hg19",
    strictLocal: true,
  });
  const spectra = conversion.spectraByProfile.SBS96;
  const convertedCount = spectra.STRICT_LOCAL_SAMPLE?.["G[T>C]G"] || 0;
  if (convertedCount !== 1) {
    throw new Error(`Strict-local MAF conversion produced ${convertedCount} G[T>C]G counts, expected 1.`);
  }

  const contexts = get_sbs_trinucleotide_contexts();
  const signatures = {
    SBS_LOCAL: zeroRecord(contexts),
    SBS_OTHER: zeroRecord(contexts),
  };
  signatures.SBS_LOCAL["G[T>C]G"] = 1;
  signatures.SBS_OTHER[contexts[0]] = 1;

  const exposures = await fitSpectraWithNNLS(signatures, spectra, {
    contexts,
    exposureType: "relative",
  });
  const burden = summarizeMutationBurden(spectra, {
    lowBurdenThresholdMode: "fixed",
    lowBurdenThreshold: 1,
  });
  const reconstruction = calculateReconstructionError(
    signatures,
    spectra,
    exposures,
    { contexts }
  );
  const nmf = extractSignaturesNMF(spectra, {
    contexts,
    rank: 1,
    nRuns: 1,
    maxIterations: 5,
    seed: 17,
  });
  const reportJson = createAnalysisReport(
    {
      title: "Strict Local Smoke Report",
      summary: "Generated from a strict-local MAF conversion, native fit, QC, and NMF smoke.",
      parameters: { strictLocal: true, genome: "hg19" },
      qc: { burden, reconstruction },
      exposures,
      extraction: nmf,
      notes: ["No network requests were permitted by the test harness."],
    },
    { format: "json" }
  );
  if (!reportJson.includes("Strict Local Smoke Report")) {
    throw new Error("Report serialization did not include the expected title.");
  }

  const blocked = [
    await expectStrictBlock("mSigPortal sample-specific spectrum fetch", () =>
      getMutationalSpectrumData(
        "PCAWG",
        ["USER_SUPPLIED_SAMPLE_ID"],
        "WGS",
        "Lung-AdenoCA",
        "SBS",
        96,
        { strictLocal: true }
      )
    ),
    await expectStrictBlock("UCSC live context lookup", () =>
      getMutationalContext("1", "hg19", 1000001, { strictLocal: true })
    ),
  ];

  if (networkLog.length !== 0) {
    throw new Error(`Strict-local smoke captured ${networkLog.length} network request(s).`);
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        strictLocal: true,
        mafConversionCount: convertedCount,
        exposureSamples: Object.keys(exposures),
        burdenSamples: burden.samples?.length || 0,
        reconstructionSamples: reconstruction.samples?.length || 0,
        nmfRank: nmf.rank,
        reportBytes: reportJson.length,
        blockedPaths: blocked,
        networkRequests: networkLog.length,
        networkLog,
      },
      null,
      2
    )
  );
} finally {
  globalThis.fetch = originalFetch;
}
