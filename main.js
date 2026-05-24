import * as UMAP from "https://esm.sh/umap-js@1.3.3";
import * as Plotly from "https://esm.sh/plotly.js-dist-min@3.5.1";
import * as d3 from "https://esm.sh/d3@7.9.0";

import * as am5 from "https://cdn.jsdelivr.net/npm/@amcharts/amcharts5/+esm";
import * as am5hierarchy from "https://cdn.jsdelivr.net/npm/@amcharts/amcharts5/hierarchy/+esm";

import * as am5themes_Animated from "https://cdn.jsdelivr.net/npm/@amcharts/amcharts5@5.3.7/themes/Animated.js/+esm";

const SDK_FALLBACK_BASE_URL = "https://episphere.github.io/msig/";
const SDK_NAME = "mSigSDK";
const SDK_VERSION = "0.3.0";
const SDK_REPOSITORY_URL = "https://github.com/episphere/msig";
const SDK_IMPORT_URL = import.meta.url;
const SCIENTIFIC_COLORS = {
  blue: "#0072B2",
  sky: "#56B4E9",
  green: "#009E73",
  orange: "#E69F00",
  vermillion: "#D55E00",
  purple: "#CC79A7",
  yellow: "#F0E442",
  gray: "#6B7280",
  lightGray: "#E5E7EB",
  darkGray: "#111827",
};

async function importSdkModule(path) {
  const fallbackUrl = new URL(path, SDK_FALLBACK_BASE_URL).href;
  let relativeUrl;

  try {
    relativeUrl = new URL(path, import.meta.url).href;
  } catch (_error) {
    relativeUrl = null;
  }

  if (relativeUrl) {
    try {
      return await import(relativeUrl);
    } catch (relativeError) {
      if (relativeUrl === fallbackUrl) {
        throw relativeError;
      }
    }
  }

  return await import(fallbackUrl);
}

const sdkModuleSpecs = [
  ["plotMSPrevalence", "mSigPortalScripts/client/src/components/controls/plotly/msPrevalence/msPrevalence.js"],
  ["plotSignatureAssociation", "mSigPortalScripts/client/src/components/controls/plotly/msAssociation/msAssociation.js"],
  ["plotMutationalProfileSBS96", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/sbs96.js"],
  ["plotMutationalProfileSBS192", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/sbs192.js"],
  ["plotMutationalProfileSBS288", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/sbs288.js"],
  ["plotMutationalProfileSBS384", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/sbs384.js"],
  ["plotMutationalProfileSBS1536", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/sbs1536.js"],
  ["plotMutationalProfileDBS78", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/dbs78.js"],
  ["plotMutationalProfileDBS186", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/dbs186.js"],
  ["plotMutationalProfileID28", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/id28.js"],
  ["plotMutationalProfileID29", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/id29.js"],
  ["plotMutationalProfileID83", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/id83.js"],
  ["plotMutationalProfileID415", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/id415.js"],
  ["plotMutationalProfileRS32", "mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/rs32.js"],
  ["plotMutationalProfileSBS96Comparison", "mSigPortalScripts/client/src/components/controls/plotly/profileComparison/sbs96.js"],
  ["plotMutationalProfileSBS192Comparison", "mSigPortalScripts/client/src/components/controls/plotly/profileComparison/sbs192.js"],
  ["plotMutationalProfileDBS78Comparison", "mSigPortalScripts/client/src/components/controls/plotly/profileComparison/dbs78.js"],
  ["plotMutationalProfileID83Comparison", "mSigPortalScripts/client/src/components/controls/plotly/profileComparison/id83.js"],
  ["plotMutationalProfileRS32Comparison", "mSigPortalScripts/client/src/components/controls/plotly/profileComparison/rs32.js"],
  ["machineLearning", "mSigSDKScripts/machineLearning.js"],
  ["userData", "mSigSDKScripts/userData.js"],
  ["utils", "mSigSDKScripts/utils.js"],
  ["tcga", "mSigSDKScripts/tcga.js"],
  ["mSigPortalAPIs", "mSigSDKScripts/mSigPortalAPIs.js"],
  ["validation", "mSigSDKScripts/validation.js"],
  ["qc", "mSigSDKScripts/qc.js"],
  ["signatureExtraction", "mSigSDKScripts/signatureExtraction.js"],
  ["io", "mSigSDKScripts/io.js"],
  ["reports", "mSigSDKScripts/reports.js"],
  ["workflows", "mSigSDKScripts/workflows.js"],
  ["guidance", "mSigSDKScripts/guidance.js"],
  ["presentation", "mSigSDKScripts/presentation.js"],
  ["runners", "mSigSDKScripts/runners.js"],
  ["adapters", "mSigSDKScripts/adapters.js"],
];

const sdkModuleResults = await Promise.allSettled(
  sdkModuleSpecs.map(([, path]) => importSdkModule(path))
);

function getLoadedModule(index) {
  const [name] = sdkModuleSpecs[index];
  const result = sdkModuleResults[index];

  if (result.status === "fulfilled") {
    return result.value;
  }

  console.warn(`mSigSDK could not load ${name}.`, result.reason);
  return {};
}

function missingDependency(name) {
  return function () {
    throw new Error(`mSigSDK could not load ${name}. Try refreshing the page or adding a cache-busting query string to the SDK import URL.`);
  };
}

const plotMSPrevalence = getLoadedModule(0).default || missingDependency("plotMSPrevalence");
const plotSignatureAssociation = getLoadedModule(1).default || missingDependency("plotSignatureAssociation");
const plotMutationalProfileSBS96 = getLoadedModule(2).default || missingDependency("plotMutationalProfileSBS96");
const plotMutationalProfileSBS192 = getLoadedModule(3).default || missingDependency("plotMutationalProfileSBS192");
const plotMutationalProfileSBS288 = getLoadedModule(4).default || missingDependency("plotMutationalProfileSBS288");
const plotMutationalProfileSBS384 = getLoadedModule(5).default || missingDependency("plotMutationalProfileSBS384");
const plotMutationalProfileSBS1536 = getLoadedModule(6).default || missingDependency("plotMutationalProfileSBS1536");
const plotMutationalProfileDBS78 = getLoadedModule(7).default || missingDependency("plotMutationalProfileDBS78");
const plotMutationalProfileDBS186 = getLoadedModule(8).default || missingDependency("plotMutationalProfileDBS186");
const plotMutationalProfileID28 = getLoadedModule(9).default || missingDependency("plotMutationalProfileID28");
const plotMutationalProfileID29 = getLoadedModule(10).default || missingDependency("plotMutationalProfileID29");
const plotMutationalProfileID83 = getLoadedModule(11).default || missingDependency("plotMutationalProfileID83");
const plotMutationalProfileID415 = getLoadedModule(12).default || missingDependency("plotMutationalProfileID415");
const plotMutationalProfileRS32 = getLoadedModule(13).default || missingDependency("plotMutationalProfileRS32");
const plotMutationalProfileSBS96Comparison = getLoadedModule(14).default || missingDependency("plotMutationalProfileSBS96Comparison");
const plotMutationalProfileSBS192Comparison = getLoadedModule(15).default || missingDependency("plotMutationalProfileSBS192Comparison");
const plotMutationalProfileDBS78Comparison = getLoadedModule(16).default || missingDependency("plotMutationalProfileDBS78Comparison");
const plotMutationalProfileID83Comparison = getLoadedModule(17).default || missingDependency("plotMutationalProfileID83Comparison");
const plotMutationalProfileRS32Comparison = getLoadedModule(18).default || missingDependency("plotMutationalProfileRS32Comparison");
const machineLearningModule = getLoadedModule(19);
const userDataModule = getLoadedModule(20);
const utilsModule = getLoadedModule(21);
const tcgaModule = getLoadedModule(22);
const mSigPortalAPIsModule = getLoadedModule(23);
const validationModule = getLoadedModule(24);
const qcModule = getLoadedModule(25);
const signatureExtractionModule = getLoadedModule(26);
const ioModule = getLoadedModule(27);
const reportsModule = getLoadedModule(28);
const workflowsModule = getLoadedModule(29);
const guidanceModule = getLoadedModule(30);
const presentationModule = getLoadedModule(31);
const runnersModule = getLoadedModule(32);
const adaptersModule = getLoadedModule(33);
const preprocessData = machineLearningModule.preprocessData || missingDependency("preprocessData");
const kFoldCV = machineLearningModule.kFoldCV || missingDependency("kFoldCV");

const {
  convertMatrix,
  convertMafToProfileSpectra,
  convertWGStoPanel,
  createWGStoPanelValidationPairs,
  init_sbs_mutational_spectra,
  convertMutationalSpectraIntoJSON,
} = userDataModule;

const {
  linspace,
  deepCopy,
  nnls,
  formatHierarchicalClustersToAM5Format,
  groupBy,
  createDistanceMatrix,
  hierarchicalClustering,
  doubleClustering,
  cosineSimilarity,
} = utilsModule;

const {
  getProjectsByGene,
  getTpmCountsByGenesOnProjects,
  getTpmCountsByGenesFromFiles,
  getMafInformationFromProjects,
  getVariantInformationFromMafFiles,
  convertTCGAProjectIntoJSON,
} = tcgaModule;

// import every single function one by one from the mSigPortalAPIs.js file

const {
  getMutationalSignaturesOptions,
  getMutationalSignaturesData,
  getMutationalSignaturesSummary,
  getMutationalSpectrumOptions,
  getMutationalSpectrumData,
  getMutationalSpectrumSummary,
  getMutationalSignatureAssociationOptions,
  getMutationalSignatureAssociationData,
  getMutationalSignatureActivityOptions,
  getMutationalSignatureActivityData,
  getMutationalSignatureLandscapeData,
  getMutationalSignatureEtiologyOptions,
  getMutationalSignatureEtiologyData,
} = mSigPortalAPIsModule;

const {
  assertValid,
  getExpectedContexts,
  listMafConvertibleProfiles,
  listProfileDefinitions,
  getMatrixContexts,
  getSBS96Contexts,
  normalizeMatrixObject,
  rowsToMatrix,
  rowsToSampleSpectra,
  rowsToSignatureMatrix,
  validateExposureMatrix,
  validateMafRows,
  validateSignatureMatrix,
  validateSpectra,
} = validationModule;

const {
  QC_DEFAULTS = {},
  QC_WARNING_CODES = {},
  bootstrapSignatureFit,
  calculateFitResiduals,
  calculateReconstructionError,
  fitSpectraWithNNLS,
  normalizeExposures,
  runThresholdSensitivity,
  selectSamplesByMutationBurden,
  summarizeMissingContexts,
  summarizeMutationBurden,
} = qcModule;

const {
  compareExtractedToReference,
  extractSignaturesNMF,
  extractSignaturesNMFInWorker,
  selectNMFRank,
  spectraToMatrix,
} = signatureExtractionModule;

const {
  exposureMatrixToRows,
  exportCOSMICSignatureMatrix,
  exportMatrixTSV,
  exportMuSiCalInput,
  exportSigProfilerMatrix,
  importCOSMICSignatureMatrix,
  importMatrixTSV,
  importMuSiCalOutput,
  importSigProfilerMatrix,
  rowsToExposureMatrix,
  signatureMatrixToRows,
  spectraToRows,
} = ioModule;

const {
  createAnalysisReport,
  createAnalysisReportHTML,
  downloadAnalysisReport,
} = reportsModule;

const {
  createNMFAnalysis,
  createSignatureFitAnalysis,
} = workflowsModule;

const {
  ADVISOR_DEFAULTS = {},
  WARNING_CODES = {},
  computeFitQualityEvidence = missingDependency("computeFitQualityEvidence"),
  computeSignatureAmbiguity = missingDependency("computeSignatureAmbiguity"),
  computeSignatureIdentifiability = missingDependency("computeSignatureIdentifiability"),
  detectOutOfReferenceSignal = missingDependency("detectOutOfReferenceSignal"),
  recommendAnalysisStrategy = missingDependency("recommendAnalysisStrategy"),
  runCohortFit = missingDependency("runCohortFit"),
  runCohortFitLite = missingDependency("runCohortFitLite"),
  runDiscoveryWorkflow = missingDependency("runDiscoveryWorkflow"),
  runDiscoveryWorkflowLite = missingDependency("runDiscoveryWorkflowLite"),
  runPanelWorkflow = missingDependency("runPanelWorkflow"),
  runPanelWorkflowLite = missingDependency("runPanelWorkflowLite"),
  runSingleSampleFit = missingDependency("runSingleSampleFit"),
  runSingleSampleFitLite = missingDependency("runSingleSampleFitLite"),
} = guidanceModule;

const {
  bootstrapRows = missingDependency("bootstrapRows"),
  burdenSampleRows = missingDependency("burdenSampleRows"),
  compactSummary = missingDependency("compactSummary"),
  DEFAULT_TOOLTIP_TERMS = {},
  details: presentationDetails = missingDependency("presentation.details"),
  exposureRows = missingDependency("exposureRows"),
  fitQualityEvidenceRows = missingDependency("fitQualityEvidenceRows"),
  fitQualityEvidenceTable = missingDependency("fitQualityEvidenceTable"),
  formatCell = missingDependency("formatCell"),
  formatNumber = missingDependency("formatNumber"),
  metrics: presentationMetrics = missingDependency("presentation.metrics"),
  nmfMatchRows = missingDependency("nmfMatchRows"),
  note: presentationNote = missingDependency("presentation.note"),
  panelEvidenceRows = missingDependency("panelEvidenceRows"),
  panelEvidenceTable = missingDependency("panelEvidenceTable"),
  reconstructionRows = missingDependency("reconstructionRows"),
  reportFieldRows = missingDependency("reportFieldRows"),
  table: presentationTable = missingDependency("presentation.table"),
  thresholdRows = missingDependency("thresholdRows"),
  tooltipTable = missingDependency("presentation.tooltipTable"),
  uncertaintyDecisionRows = missingDependency("uncertaintyDecisionRows"),
} = presentationModule;

const {
  DEFAULT_PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/",
  DEFAULT_WEBR_BINARY_R_VERSION = "4.6",
  DEFAULT_WEBR_MODULE_URL = "https://webr.r-wasm.org/latest/webr.mjs",
  DEFAULT_WEBR_REPOSITORY_URL = "https://repo.r-wasm.org",
  PYODIDE_RUNNER_SCHEMA_VERSION = "msig.runner.pyodide.v0.3",
  WEBR_RUNNER_SCHEMA_VERSION = "msig.runner.webr.v0.3",
  checkWebRPackageAvailability = missingDependency("checkWebRPackageAvailability"),
  createPyodideWorkerRunner = missingDependency("createPyodideWorkerRunner"),
  createPyodideWorkerSource = missingDependency("createPyodideWorkerSource"),
  createWebRRunner = missingDependency("createWebRRunner"),
  detectPyodideRuntime = missingDependency("detectPyodideRuntime"),
  detectWebRRuntime = missingDependency("detectWebRRuntime"),
  runPython = missingDependency("runPython"),
  runPyodide = missingDependency("runPyodide"),
  runWebR = missingDependency("runWebR"),
} = runnersModule;

const {
  ADAPTER_SCHEMA_VERSION = "msig.adapters.v0.3",
  DEFAULT_SPC_PACKAGE = "SigProfilerClusters==1.2.2",
  DEFAULT_SPE_PACKAGE = "SigProfilerExtractor==1.2.6",
  DEFAULT_SPMG_PACKAGE = "SigProfilerMatrixGenerator==1.3.6",
  DEFAULT_SPP_PACKAGE = "sigProfilerPlotting==1.4.3",
  DEFAULT_SPS_PACKAGE = "SigProfilerSimulator==1.2.2",
  DEFAULT_SPA_PACKAGE = "docs/package-repos/pyodide/sigprofilerassignment-1.1.3-py3-none-any.whl",
  DEFAULT_SPA_MICROPIP_PACKAGES = [],
  DEFAULT_MUSICAL_PACKAGE = "docs/package-repos/pyodide/musical-1.0.0-py3-none-any.whl",
  PACKAGE_RUNTIME_MANIFEST = { tools: {} },
  checkDeconstructSigsWebRAvailability = missingDependency("checkDeconstructSigsWebRAvailability"),
  checkSigminerWebRAvailability = missingDependency("checkSigminerWebRAvailability"),
  createInteroperabilityBundle = missingDependency("createInteroperabilityBundle"),
  getPackageRuntime = missingDependency("getPackageRuntime"),
  listPackageRuntimes = missingDependency("listPackageRuntimes"),
  parseExposureTables = missingDependency("parseExposureTables"),
  parseDeconstructSigsOutput = missingDependency("parseDeconstructSigsOutput"),
  parseSigminerOutput = missingDependency("parseSigminerOutput"),
  parseSigProfilerMatrixGeneratorOutput = missingDependency("parseSigProfilerMatrixGeneratorOutput"),
  parseSigProfilerExtractorOutput = missingDependency("parseSigProfilerExtractorOutput"),
  prepareDeconstructSigsInput = missingDependency("prepareDeconstructSigsInput"),
  prepareMuSiCalRefitInput = missingDependency("prepareMuSiCalRefitInput"),
  prepareSigminerInput = missingDependency("prepareSigminerInput"),
  prepareSigProfilerClustersInput = missingDependency("prepareSigProfilerClustersInput"),
  prepareSigProfilerAssignmentInput = missingDependency("prepareSigProfilerAssignmentInput"),
  prepareSigProfilerExtractorInput = missingDependency("prepareSigProfilerExtractorInput"),
  prepareSigProfilerMatrixGeneratorInput = missingDependency("prepareSigProfilerMatrixGeneratorInput"),
  prepareSigProfilerPlottingInput = missingDependency("prepareSigProfilerPlottingInput"),
  prepareSigProfilerSimulatorInput = missingDependency("prepareSigProfilerSimulatorInput"),
  runDeconstructSigsWebR = missingDependency("runDeconstructSigsWebR"),
  runMuSiCalRefit = missingDependency("runMuSiCalRefit"),
  runSigminerWebR = missingDependency("runSigminerWebR"),
  runSigProfilerAssignment = missingDependency("runSigProfilerAssignment"),
  runSigProfilerExtractor = missingDependency("runSigProfilerExtractor"),
} = adaptersModule;

// import * as mSigPortalPlotting from "./index.js";

const mSigSDK = (function () {
  /**
   * @namespace mSigPortalData
   */

  /**
   * @namespace mSigPortalPlots
   */

  /**
   * @namespace machineLearning
   */

  /**
   * @namespace userData
   */

  /**
   * @namespace tcga
   */

  /**
   * @namespace provenance
   */

  /**
   * @namespace validation
   */

  /**
   * @namespace qc
   */

  /**
   * @namespace qcPlots
   */

  /**
   * @namespace signatureExtraction
   */

  /**
   * @namespace signatureExtractionPlots
   */

  /**
   * @namespace plotting
   */

  /**
   * @namespace io
   */

  /**
   * @namespace reports
   */

  /**
   * @namespace workflows
   */

  /**
   * @namespace presentation
   */

  /**
   * @namespace quickstart
   */

  /**
   * @namespace runners
   */

  /**
   * @namespace adapters
   */

  /**
   * @namespace advisor
   */

  /**
   * @namespace pipelines
   */

  //#region Plot the summary of a dataset

  function copyProvenanceValue(value) {
    if (value === undefined) {
      return undefined;
    }

    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (_error) {
        // Fall back to JSON serialization below.
      }
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_error) {
      return String(value);
    }
  }

  function asArray(value) {
    if (value === undefined || value === null) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  const DEFAULT_PLOTTING_OPTIONS = Object.freeze({
    publicationReady: true,
    maxDisplaySignatures: 12,
    otherSignatureLabel: "Other fitted COSMIC SBS",
    otherSignatureDisplayLabel: "Other",
    figure: {
      compact: false,
      includeBadges: true,
      explanatoryCaptions: true,
    },
    palette: {
      ...SCIENTIFIC_COLORS,
      exposureZero: "#F8FAFC",
      exposureLow: "#D9F0F3",
      exposureMid: "#56B4E9",
      exposureHigh: "#0072B2",
      exposureVeryHigh: "#003B5C",
    },
  });
  let activePlottingOptions = copyProvenanceValue(DEFAULT_PLOTTING_OPTIONS);

  function mergePlainObjects(base = {}, override = {}) {
    const output = { ...(base && typeof base === "object" ? base : {}) };
    for (const [key, value] of Object.entries(
      override && typeof override === "object" ? override : {}
    )) {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        output[key] &&
        typeof output[key] === "object" &&
        !Array.isArray(output[key])
      ) {
        output[key] = mergePlainObjects(output[key], value);
      } else if (value !== undefined) {
        output[key] = copyProvenanceValue(value);
      }
    }
    return output;
  }

  function getPlottingDefaults() {
    return copyProvenanceValue(activePlottingOptions);
  }

  function setPlottingDefaults(options = {}) {
    activePlottingOptions = mergePlainObjects(activePlottingOptions, options);
    return getPlottingDefaults();
  }

  function resetPlottingDefaults() {
    activePlottingOptions = copyProvenanceValue(DEFAULT_PLOTTING_OPTIONS);
    return getPlottingDefaults();
  }

  function resolvePlotPublication(publication = null) {
    const supplied =
      publication && typeof publication === "object" && !Array.isArray(publication)
        ? publication
        : {};
    if (publication === false || activePlottingOptions.publicationReady === false) {
      return supplied;
    }
    return mergePlainObjects(activePlottingOptions.figure || {}, supplied);
  }

  function getRuntimeContext() {
    const navigatorInfo =
      typeof navigator === "undefined" ? {} : navigator;

    let timezone = null;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (_error) {
      timezone = null;
    }

    return {
      userAgent: navigatorInfo.userAgent || null,
      language: navigatorInfo.language || null,
      platform: navigatorInfo.platform || null,
      timezone,
    };
  }

  /**
   * Creates a reproducibility record for an analysis result.
   *
   * @function createProvenance
   * @memberof provenance
   * @param {Object} [options] - Provenance fields to include.
   * @param {string} [options.analysis] - Short name for the analysis.
   * @param {Object} [options.parameters] - Parameters used to generate the result.
   * @param {string|string[]} [options.sourceUrls] - Source URLs used by the analysis.
   * @param {Object|Object[]} [options.dataSources] - Optional structured source metadata.
   * @param {string|string[]} [options.notes] - Optional free-text notes.
   * @returns {Object} Versioned SDK, runtime, source, and parameter metadata.
   */
  function createProvenance({
    analysis = null,
    parameters = {},
    sourceUrls = [],
    dataSources = [],
    catalogVersion = null,
    catalogSource = null,
    genomeBuild = null,
    contextSource = null,
    contextApiVersion = null,
    contextLookupMode = null,
    contextFetchTimestamp = null,
    apiEndpointSnapshot = [],
    notes = [],
  } = {}) {
    return {
      analysis,
      generatedAt: new Date().toISOString(),
      sdk: {
        name: SDK_NAME,
        version: SDK_VERSION,
        importUrl: SDK_IMPORT_URL,
        fallbackBaseUrl: SDK_FALLBACK_BASE_URL,
        repository: SDK_REPOSITORY_URL,
      },
      parameters: copyProvenanceValue(parameters) || {},
      catalog: {
        version: catalogVersion,
        source: catalogSource,
      },
      genome: {
        build: genomeBuild,
        contextSource,
        contextApiVersion,
        contextLookupMode,
        contextFetchTimestamp,
      },
      apiEndpointSnapshot: copyProvenanceValue(asArray(apiEndpointSnapshot)),
      sourceUrls: asArray(sourceUrls),
      dataSources: copyProvenanceValue(asArray(dataSources)),
      runtime: getRuntimeContext(),
      notes: asArray(notes),
    };
  }

  function flattenMafRowsForWorkflow(rows) {
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]));
  }

  function normalizeWorkflowMafRow(row) {
    if (!row || typeof row !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [String(key).toLowerCase(), value])
    );
  }

  function countConvertibleSnvRows(mafFiles, { tcga = false } = {}) {
    return flattenMafRowsForWorkflow(mafFiles)
      .map(normalizeWorkflowMafRow)
      .filter((row) => {
        const referenceAllele = String(
          tcga ? row.reference_genome_allele : row.reference_allele
        ).toUpperCase();
        const alternateAllele = String(
          tcga ? row.mutated_to_allele : row.tumor_seq_allele2
        ).toUpperCase();
        const variantType = String(
          tcga ? row.mutation_type : row.variant_type
        ).toLowerCase();
        return (
          (variantType === "snp" ||
            variantType === "single base substitution" ||
            variantType === "single_base_substitution") &&
          /^[ACGT]$/.test(referenceAllele) &&
          /^[ACGT]$/.test(alternateAllele)
        );
      }).length;
  }

  function workflowProfileKey(profileRequest = "SBS96") {
    if (typeof profileRequest === "string") {
      const value = profileRequest.trim().toUpperCase();
      const match = value.match(/^([A-Z-]+)(\d+)$/);
      return match ? `${match[1] === "RNA-SBS" ? "RNA" : match[1]}${match[2]}` : value;
    }
    const profile = String(profileRequest.profile || "SBS").toUpperCase();
    const matrix = profileRequest.matrix || profileRequest.matrixSize || 96;
    return `${profile}${matrix}`;
  }

  function profileOptionsFromKey(profileKey = "SBS96") {
    const match = String(profileKey).toUpperCase().match(/^([A-Z-]+)(\d+)$/);
    return match
      ? { profile: match[1] === "RNA-SBS" ? "RNA" : match[1], matrix: Number(match[2]) }
      : { profile: "SBS", matrix: 96 };
  }

  function matrixContextsMatch(matrix, expectedContexts) {
    if (!expectedContexts?.length) return false;
    const observed = getMatrixContexts(matrix);
    if (observed.length !== expectedContexts.length) return false;
    const expected = new Set(expectedContexts);
    return observed.every((context) => expected.has(context));
  }

  function selectMafProfileForSignatures(profileKeys, signatures) {
    if (!signatures) {
      return profileKeys[0] || "SBS96";
    }
    for (const key of profileKeys) {
      const expected = getExpectedContexts(profileOptionsFromKey(key));
      if (matrixContextsMatch(signatures, expected)) {
        return key;
      }
    }
    return null;
  }

  function sumSpectraCounts(spectra) {
    return Object.values(spectra || {}).reduce(
      (outerTotal, spectrum) =>
        outerTotal +
        Object.values(spectrum || {}).reduce(
          (innerTotal, value) =>
            innerTotal + (Number.isFinite(Number(value)) ? Number(value) : 0),
          0
        ),
      0
    );
  }

  function makeWorkflowWarning(code, message, details = {}) {
    return {
      code,
      level: "warning",
      message,
      resolution:
        code === QC_WARNING_CODES.CONTEXT_FETCH_FAILED
          ? "Verify the genome build, remote context endpoint, and SBS96 count totals; rerun with pinned or cached contexts before fitting."
          : null,
      ...details,
    };
  }

  function buildUCSCContextEndpointSnapshot({ genome, contextApiEndpoint }) {
    return [
      {
        label: "trinucleotide_context_sequence",
        endpoint: contextApiEndpoint,
        queryTemplate:
          `${contextApiEndpoint}?genome=${genome};chrom=chr{chromosome};start={position_minus_2};end={position_plus_1}`,
      },
    ];
  }

  /**
   * Wraps a result with a reproducibility record.
   *
   * @function withProvenance
   * @memberof provenance
   * @param {*} data - Analysis output to preserve.
   * @param {Object} [options] - Options passed to createProvenance.
   * @returns {{data: *, provenance: Object}} Data plus provenance metadata.
   */
  function withProvenance(data, options = {}) {
    return {
      data,
      provenance: createProvenance(options),
    };
  }

  function scientificPlotLayout({
    title,
    height = 520,
    margin = { l: 88, r: 36, t: 72, b: 88 },
    xaxis = {},
    yaxis = {},
    legend = {},
    annotations = [],
    shapes = [],
  } = {}) {
    return {
      title: {
        text: title,
        x: 0.02,
        xanchor: "left",
        font: { size: 18, color: SCIENTIFIC_COLORS.darkGray },
      },
      font: {
        family: "Arial, sans-serif",
        size: 13,
        color: "#1F2937",
      },
      paper_bgcolor: "#FFFFFF",
      plot_bgcolor: "#FFFFFF",
      height,
      margin,
      hovermode: "closest",
      legend: {
        orientation: "h",
        x: 0,
        y: 1.1,
        bgcolor: "rgba(255,255,255,0)",
        ...legend,
      },
      xaxis: {
        showline: true,
        linecolor: "#374151",
        linewidth: 1,
        ticks: "outside",
        tickcolor: "#374151",
        gridcolor: SCIENTIFIC_COLORS.lightGray,
        zerolinecolor: "#9CA3AF",
        automargin: true,
        ...xaxis,
      },
      yaxis: {
        showline: true,
        linecolor: "#374151",
        linewidth: 1,
        ticks: "outside",
        tickcolor: "#374151",
        gridcolor: SCIENTIFIC_COLORS.lightGray,
        zerolinecolor: "#9CA3AF",
        automargin: true,
        ...yaxis,
      },
      annotations,
      shapes,
    };
  }

  function formatPlotNumber(value, digits = 3) {
    if (!Number.isFinite(value)) {
      return value;
    }

    if (Math.abs(value) >= 1000) {
      return value.toLocaleString();
    }

    return Number(value.toFixed(digits));
  }

  function describeRmseForPlot(value) {
    if (!Number.isFinite(value)) {
      return "Not available.";
    }

    return "Lower is better.";
  }

  function uniqueStringsForPlot(values) {
    return [...new Set(values.filter((value) => value !== undefined && value !== null).map(String))];
  }

  function compactPlotLabel(value, maxLength = 24) {
    const text = String(value ?? "");
    if (text.length <= maxLength) {
      return text;
    }
    if (maxLength <= 6) {
      return `${text.slice(0, Math.max(1, maxLength - 3))}...`;
    }
    const available = maxLength - 3;
    const startLength = Math.ceil(available * 0.58);
    const endLength = available - startLength;
    return `${text.slice(0, startLength)}...${text.slice(-endLength)}`;
  }

  function formatRmseAxisTick(value) {
    if (!Number.isFinite(value)) {
      return "";
    }
    if (value === 0) {
      return "0";
    }
    const absolute = Math.abs(value);
    if (absolute < 0.001) {
      return d3.format(".1e")(value);
    }
    if (absolute < 0.01) {
      return d3.format(".3f")(value).replace(/0+$/, "").replace(/\.$/, "");
    }
    return d3.format(".3g")(value);
  }

  function tickCountForWidth(width, targetPixels = 92, minTicks = 2, maxTicks = 6) {
    const count = Math.floor((Number(width) || targetPixels) / targetPixels);
    return Math.max(minTicks, Math.min(maxTicks, count));
  }

  function sampledTickValues(values, maxTicks) {
    const cleanValues = [...new Set(values.filter(Number.isFinite))].sort((a, b) => a - b);
    if (cleanValues.length <= maxTicks) {
      return cleanValues;
    }
    const lastIndex = cleanValues.length - 1;
    const selected = new Set();
    for (let index = 0; index < maxTicks; index += 1) {
      selected.add(cleanValues[Math.round((index / (maxTicks - 1)) * lastIndex)]);
    }
    return [...selected].sort((a, b) => a - b);
  }

  function compactD3AxisText(axisSelection, maxLength = 24) {
    axisSelection.selectAll(".tick text").each(function () {
      const text = d3.select(this);
      const fullLabel = text.text();
      const compactLabel = compactPlotLabel(fullLabel, maxLength);
      text.text(compactLabel);
      if (compactLabel !== fullLabel) {
        text.append("title").text(fullLabel);
      }
    });
    return axisSelection;
  }

  function integerTickValuesForCountAxis(maxValue, targetTicks = 5) {
    const maxCount = Math.max(0, Math.ceil(Number(maxValue) || 0));
    if (maxCount <= 5) {
      return Array.from({ length: maxCount + 1 }, (_, index) => index);
    }
    const ticks = d3
      .ticks(0, maxCount, targetTicks)
      .map((value) => Math.round(value))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const uniqueTicks = [...new Set([0, ...ticks, maxCount])].sort((a, b) => a - b);
    return uniqueTicks.length ? uniqueTicks : [0, maxCount];
  }

  function resolvePlotContainer(target, createIfMissing = true) {
    if (typeof document === "undefined") {
      throw new Error("Plotting requires a browser DOM.");
    }

    if (typeof Element !== "undefined" && target instanceof Element) {
      return { element: target, created: false, providedElement: true };
    }

    const id =
      typeof target === "string" && target.startsWith("#")
        ? target.slice(1)
        : target;

    let element = typeof id === "string" ? document.getElementById(id) : null;
    let created = false;

    if (!element && createIfMissing) {
      element = document.createElement("div");
      if (typeof id === "string" && id.length > 0) {
        element.id = id;
      }
      created = true;
    }

    if (!element) {
      throw new Error(`Could not find a container for ${target}.`);
    }

    return { element, created, providedElement: false };
  }

  function setContainerHTML(target, html) {
    const { element } = resolvePlotContainer(target);
    element.innerHTML = html;
    return element;
  }

  function renderPlotError(target, message) {
    return setContainerHTML(
      target,
      `<p style="color:red">Error: ${message}</p>`
    );
  }

  function renderPlotNotice(target, title, message) {
    return setContainerHTML(
      target,
      `<div style="border:1px solid #d7e3df;border-radius:8px;background:#f8fbfa;color:#334155;padding:18px;line-height:1.5">
        <strong style="display:block;color:#0f172a;margin-bottom:4px">${escapeHTML(title)}</strong>
        <span>${escapeHTML(message)}</span>
      </div>`
    );
  }

  function isFigureContextValue(value) {
    return (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== "" &&
      String(value).trim().toLowerCase() !== "nan"
    );
  }

  function humanizeFigureContextLabel(label) {
    const raw = String(label || "").trim();
    const canonicalLabels = {
      dataSource: "Dataset",
      dataset: "Dataset",
      sampleCount: "Sample Count",
      samplesLoaded: "Sample Count",
      signatureCount: "Signature Count",
      signaturesLoaded: "Signature Count",
      fittingThreshold: "Fitting Threshold",
      exposureThreshold: "Fitting Threshold",
      bootstrapIterations: "Bootstrap Iterations",
      cutoffGrid: "Cutoff Grid",
      signatureCatalog: "Signature Catalog",
    };
    if (canonicalLabels[raw]) return canonicalLabels[raw];
    return raw
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (char) => char.toUpperCase());
  }

  function normalizeFigureContext(context) {
    if (!context) return [];
    const entries = Array.isArray(context)
      ? context
      : Object.entries(context).map(([label, value]) => ({ label, value }));
    return entries
      .map((entry) => {
        if (Array.isArray(entry)) {
          return { label: entry[0], value: entry[1] };
        }
        return entry && typeof entry === "object"
          ? {
              label: entry.label ?? entry.key ?? entry.name,
              value: entry.value,
            }
          : null;
      })
      .filter((entry) => entry && isFigureContextValue(entry.label) && isFigureContextValue(entry.value))
      .map((entry) => ({
        label: humanizeFigureContextLabel(entry.label),
        value: String(entry.value),
      }));
  }

  function mergeFigureContext(...contexts) {
    const seen = new Set();
    const merged = [];
    contexts.flatMap(normalizeFigureContext).forEach((entry) => {
      const key = `${entry.label.toLowerCase()}::${entry.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(entry);
      }
    });
    return merged;
  }

  function contextSentence(context = []) {
    return context.map(({ label, value }) => `${label}: ${value}`).join("; ");
  }

  function defaultFigureCaption({ title, subtitle, context }) {
    return String(subtitle || title || "mSigSDK figure").trim();
  }

  function normalizeFigurePublication({
    title,
    subtitle,
    caption,
    badges = [],
    figureContext = null,
    publication = null,
  } = {}) {
    const publicationObject = resolvePlotPublication(publication);
    const normalizedTitle = String(
      publicationObject.title || title || "mSigSDK figure"
    ).trim();
    const normalizedSubtitle =
      publicationObject.subtitle ?? subtitle ?? "";
    const context = mergeFigureContext(
      publicationObject.context,
      publicationObject.contextFields,
      figureContext,
      publicationObject.includeBadges === false ? [] : badges
    );
    const normalizedCaption = String(
      publicationObject.caption ||
        caption ||
        defaultFigureCaption({
          title: normalizedTitle,
          subtitle: normalizedSubtitle,
          context,
        })
    ).trim();
    return {
      title: normalizedTitle,
      subtitle: String(normalizedSubtitle || ""),
      caption: normalizedCaption,
      context,
      generatedBy: "mSigSDK",
      schemaVersion: "msigsdk.figurePublication.v1",
    };
  }

  function renderFigureFooter(container, publication) {
    if (!container || !publication) return null;
    container.querySelectorAll(":scope > .msig-figure-footer").forEach((node) => node.remove());
    const footer = document.createElement("footer");
    footer.className = "msig-figure-footer";

    const caption = document.createElement("p");
    caption.className = "msig-figure-caption";
    caption.textContent = publication.caption;
    footer.appendChild(caption);

    if (publication.context?.length) {
      const contextList = document.createElement("dl");
      contextList.className = "msig-figure-context-list";
      publication.context.forEach(({ label, value }) => {
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        description.textContent = value;
        contextList.append(term, description);
      });
      footer.appendChild(contextList);
    }

    container.appendChild(footer);
    container.mSigSDKFigure = publication;
    container.dataset.msigFigureContext = "true";
    return footer;
  }

  function figurePublicationPayload(publication, extra = {}) {
    return {
      publication,
      ...extra,
    };
  }

  function wrapPlotlyCaptionText(text, maxLineLength = 116) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxLineLength && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    return lines.map(escapeHTML).join("<br>");
  }

  function plotlyLayoutWithPublication(layout = {}, publication) {
    if (!publication?.caption) return layout;
    const margin = {
      ...(layout.margin || {}),
      b: Math.max(Number(layout.margin?.b) || 0, 118),
    };
    const annotations = [
      ...(Array.isArray(layout.annotations) ? layout.annotations : []),
      {
        text: wrapPlotlyCaptionText(publication.caption),
        xref: "paper",
        yref: "paper",
        x: 0,
        y: -0.2,
        xanchor: "left",
        yanchor: "top",
        showarrow: false,
        align: "left",
        font: { size: 11, color: "#475569" },
      },
    ];
    return {
      ...layout,
      margin,
      annotations,
      meta: {
        ...(layout.meta || {}),
        mSigSDKPublication: publication,
      },
    };
  }

  function addStandaloneJsonDownloadControls(chart, payload, label) {
    if (!chart || chart.querySelector(".msig-d3-downloads")) return;
    const controls = document.createElement("div");
    controls.className = "msig-d3-downloads";
    const labelNode = document.createElement("span");
    labelNode.className = "msig-d3-download-label";
    labelNode.textContent = "Download";
    const jsonButton = document.createElement("button");
    jsonButton.type = "button";
    jsonButton.className = "msig-d3-download-button";
    jsonButton.textContent = "JSON";
    jsonButton.title = "Download this figure metadata as JSON";
    jsonButton.addEventListener("click", () => {
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json;charset=utf-8",
        }),
        `msigsdk-${downloadSafeName(label || "figure")}.json`
      );
    });
    controls.append(labelNode, jsonButton);
    chart.insertBefore(controls, chart.firstChild);
  }

  function plotGraphWithPlotlyAndMakeDataDownloadable(
    divID,
    data,
    layout,
    publication = {}
  ) {
    const { element: container } = resolvePlotContainer(divID);
    const plotly = Plotly.default || Plotly;
    ensureD3PlotStyles();
    const publicationInfo = normalizeFigurePublication({
      title: plotlyFigureTitle(layout),
      subtitle: layout?.meta?.subtitle,
      figureContext: layout?.meta?.figureContext,
      publication: resolvePlotPublication(publication),
    });
    const plotLayout = plotlyLayoutWithPublication(layout, publicationInfo);

    // Plot the graph using Plotly
    plotly.newPlot(container, data, plotLayout, {
      displaylogo: false,
      responsive: true,
      toImageButtonOptions: {
        filename: downloadSafeName(publicationInfo.title, "msigsdk-figure"),
        format: "png",
        scale: 2,
      },
    });

    // Get the container of the Plotly graph
    // Ensure the container has a relative position
    container.style.position = "relative";
    container.classList.add("msig-publication-figure");

    addPlotlyDownloadControls(container, plotly, data, plotLayout, publicationInfo);
    renderFigureFooter(container, publicationInfo);

    return container;
  }

  function ensureD3PlotStyles() {
    if (typeof document === "undefined") {
      return;
    }

    if (document.getElementById("msig-d3-plot-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "msig-d3-plot-styles";
    style.textContent = `
      .msig-d3-plot {
        position: relative;
        max-width: 980px;
        min-width: 0;
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.07);
        padding: 16px 18px 18px;
        color: #111827;
        font-family: Inter, Arial, sans-serif;
      }
      .msig-d3-plot.msig-d3-compact {
        padding: 10px 12px 12px;
        box-shadow: none;
      }
      .msig-d3-plot.msig-d3-compact .msig-d3-header {
        gap: 8px;
        margin-bottom: 10px;
      }
      .msig-d3-plot.msig-d3-compact .msig-d3-title {
        font-size: 16px;
      }
      .msig-d3-plot.msig-d3-compact .msig-d3-subtitle {
        font-size: 11px;
        line-height: 1.32;
      }
      .msig-d3-plot.msig-d3-compact .msig-d3-badge {
        min-width: 64px;
        padding: 5px 7px;
      }
      .msig-d3-plot.msig-d3-compact .msig-d3-badge-label {
        font-size: 9px;
      }
      .msig-d3-plot.msig-d3-compact .msig-d3-badge-value {
        font-size: 12px;
      }
      .msig-publication-figure {
        position: relative;
        box-sizing: border-box;
        font-family: Inter, Arial, sans-serif;
      }
      .msig-d3-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-start;
        gap: 14px;
        margin: 0 0 18px 0;
      }
      .msig-d3-title {
        margin: 0 0 4px 0;
        color: #0f172a;
        font: 750 20px/1.18 Inter, Arial, sans-serif;
        letter-spacing: 0;
      }
      .msig-d3-subtitle {
        max-width: 760px;
        color: #475569;
        font: 400 13px/1.45 Inter, Arial, sans-serif;
      }
      .msig-d3-badges {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        min-width: 0;
      }
      .msig-d3-badge {
        min-width: 82px;
        max-width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        background: #f8fafc;
        padding: 6px 9px;
        box-sizing: border-box;
      }
      .msig-d3-badge-label {
        color: #64748b;
        font: 750 10px/1.1 Inter, Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0;
      }
      .msig-d3-badge-value {
        margin-top: 3px;
        color: #0f172a;
        font: 750 15px/1.2 Inter, Arial, sans-serif;
        overflow-wrap: anywhere;
      }
      .msig-d3-html-legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 16px;
        margin: 2px 0 10px;
        color: #0f172a;
        font: 650 12px/1.25 Inter, Arial, sans-serif;
      }
      .msig-d3-html-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
        white-space: nowrap;
      }
      .msig-d3-html-legend-swatch {
        flex: 0 0 auto;
        display: inline-block;
        box-sizing: border-box;
      }
      .msig-d3-html-legend-swatch.histogram {
        width: 18px;
        height: 9px;
        border-radius: 2px;
        background: rgba(86, 180, 233, 0.32);
      }
      .msig-d3-html-legend-swatch.draws {
        width: 7px;
        height: 7px;
        margin-right: 22px;
        border-radius: 999px;
        background: rgba(86, 180, 233, 0.72);
        box-shadow:
          11px 0 0 rgba(86, 180, 233, 0.48),
          22px 0 0 rgba(86, 180, 233, 0.28);
      }
      .msig-d3-html-legend-swatch.interval {
        width: 30px;
        height: 0;
        border-top: 3px solid #111827;
        border-radius: 999px;
      }
      .msig-d3-html-legend-swatch.median {
        width: 0;
        height: 18px;
        border-left: 3px solid #e69f00;
        border-radius: 999px;
      }
      .msig-d3-html-legend-swatch.mean {
        width: 11px;
        height: 11px;
        border-radius: 999px;
        background: #0072b2;
        border: 2px solid #ffffff;
        box-shadow: 0 0 0 1px rgba(0, 114, 178, 0.28);
      }
      .msig-d3-downloads {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        margin: -6px 0 8px;
      }
      .msig-d3-download-label {
        color: #64748b;
        font: 750 10px/1 Inter, Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0;
      }
      .msig-d3-download-button {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #ffffff;
        color: #0f172a;
        cursor: pointer;
        font: 750 11px/1 Inter, Arial, sans-serif;
        padding: 6px 8px;
      }
      .msig-d3-download-button:hover {
        border-color: #64748b;
        background: #f8fafc;
      }
      .msig-d3-download-button:disabled {
        cursor: wait;
        opacity: 0.62;
      }
      .msig-d3-horizontal-scroll {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        overflow-x: auto;
        overflow-y: hidden;
        padding-bottom: 8px;
        -webkit-overflow-scrolling: touch;
      }
      .msig-d3-horizontal-scroll svg {
        display: block;
        max-width: none;
      }
      .msig-plotly-downloads {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 10;
        margin: 0;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.1);
        padding: 4px;
      }
      .msig-figure-footer {
        margin-top: 12px;
        border-top: 1px solid #e2e8f0;
        padding-top: 10px;
        color: #475569;
        font: 12px/1.45 Inter, Arial, sans-serif;
      }
      .msig-figure-caption {
        margin: 0;
        color: #334155;
      }
      .msig-figure-context-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 14px;
        margin: 8px 0 0;
      }
      .msig-figure-context-list dt,
      .msig-figure-context-list dd {
        margin: 0;
      }
      .msig-figure-context-list dt {
        color: #64748b;
        font-weight: 750;
      }
      .msig-figure-context-list dd {
        color: #0f172a;
      }
      .msig-figure-context-list dd::after {
        content: "";
      }
      .msig-d3-review-guide {
        display: grid;
        grid-template-columns: minmax(210px, 0.9fr) minmax(260px, 1.4fr);
        gap: 10px;
        margin: -4px 0 12px;
        color: #334155;
        font: 12px/1.38 Inter, Arial, sans-serif;
      }
      .msig-d3-review-card {
        min-width: 0;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        background: #f8fafc;
        padding: 9px 10px;
      }
      .msig-d3-review-card-title {
        margin: 0 0 7px;
        color: #0f172a;
        font: 750 11px/1.2 Inter, Arial, sans-serif;
      }
      .msig-d3-review-statuses,
      .msig-d3-review-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .msig-d3-review-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        white-space: nowrap;
      }
      .msig-d3-review-dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.16);
      }
      .msig-d3-review-status strong,
      .msig-d3-review-action strong {
        color: #0f172a;
        font-weight: 750;
      }
      .msig-d3-review-action {
        flex: 1 1 180px;
        min-width: 0;
        color: #475569;
      }
      @media (max-width: 760px) {
        .msig-d3-review-guide {
          grid-template-columns: 1fr;
        }
      }
	      .msig-d3-tooltip {
        pointer-events: none;
        position: fixed;
        z-index: 2147483647;
        box-sizing: border-box;
        width: max-content;
	        max-width: min(460px, calc(100vw - 20px));
        max-height: calc(100vh - 20px);
        max-height: calc(100dvh - 20px);
        overflow-y: auto;
        overscroll-behavior: contain;
        opacity: 0;
        transform: translateY(-6px);
        border: 1px solid rgba(226, 232, 240, 0.98);
        border-radius: 6px;
        background: rgba(15, 23, 42, 0.97);
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.22);
        padding: 9px 11px;
        color: #f8fafc;
        font: 12px/1.38 Inter, Arial, sans-serif;
        overflow-wrap: anywhere;
      }
	      .msig-d3-tooltip div {
	        display: grid;
	        grid-template-columns: minmax(88px, max-content) minmax(160px, 1fr);
        align-items: flex-start;
        gap: 10px;
        white-space: normal;
      }
      .msig-d3-tooltip div + div {
        margin-top: 5px;
        padding-top: 5px;
        border-top: 1px solid rgba(226, 232, 240, 0.12);
      }
      .msig-d3-tooltip span {
        color: #cbd5e1;
      }
	      .msig-d3-tooltip strong {
	        max-width: none;
	        font-weight: 700;
	        overflow-wrap: break-word;
	        text-align: left;
	      }
      .msig-d3-axis path,
      .msig-d3-axis line {
        stroke: #cbd5e1;
      }
      .msig-d3-axis text {
        fill: #475569;
        font: 11px Inter, Arial, sans-serif;
      }
      .msig-d3-axis-title {
        fill: #0f172a;
        font: 750 12px Inter, Arial, sans-serif;
      }
      .msig-d3-caption {
        fill: #64748b;
        font: 11px Inter, Arial, sans-serif;
      }
      .msig-d3-interpretation {
        margin-top: 12px;
        border-top: 1px solid #e2e8f0;
        padding-top: 12px;
        color: #334155;
        font: 13px/1.5 Inter, Arial, sans-serif;
      }
      .msig-d3-interpretation strong {
        color: #0f172a;
        font-weight: 750;
      }
    `;
    document.head.appendChild(style);
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

	  function tooltipRows(rows) {
	    return rows
	      .map(
	        ([label, value]) =>
	          `<div><span>${escapeHTML(compactPlotLabel(label, 22))}</span><strong>${escapeHTML(
	            value ?? "NA"
	          )}</strong></div>`
	      )
	      .join("");
	  }

  function downloadSafeName(value, fallback = "msigsdk-figure") {
    const text = String(value || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return text || fallback;
  }

  function downloadBlob(blob, filename) {
    if (typeof document === "undefined" || typeof URL === "undefined") {
      throw new Error("Figure downloads require a browser DOM.");
    }
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  function plotlyFigureTitle(layout = {}) {
    const safeLayout = layout && typeof layout === "object" ? layout : {};
    const title =
      typeof safeLayout.title === "object" ? safeLayout.title?.text : safeLayout.title;
    return String(title || safeLayout.name || "plotly-figure")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function plotlyFigureSize(container, layout = {}) {
    const safeLayout = layout && typeof layout === "object" ? layout : {};
    const rect = container.getBoundingClientRect();
    return {
      width: Math.max(320, Math.round(Number(safeLayout.width) || rect.width || 980)),
      height: Math.max(260, Math.round(Number(safeLayout.height) || rect.height || 520)),
    };
  }

  function addPlotlyDownloadControls(
    container,
    plotly,
    data,
    layout = {},
    publication = null
  ) {
    if (!container || !plotly || container.querySelector(".msig-plotly-downloads")) {
      return;
    }

    const baseName = `msigsdk-${downloadSafeName(plotlyFigureTitle(layout) || "plotly-figure")}`;
    const controls = document.createElement("div");
    controls.className = "msig-d3-downloads msig-plotly-downloads";

    const labelNode = document.createElement("span");
    labelNode.className = "msig-d3-download-label";
    labelNode.textContent = "Download";

    const withBusyButton = async (button, task) => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "...";
      try {
        await task();
      } finally {
        button.textContent = original;
        button.disabled = false;
      }
    };

    const makeButton = (text, title, onClick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "msig-d3-download-button";
      button.textContent = text;
      button.title = title;
      button.addEventListener("click", () => withBusyButton(button, onClick));
      return button;
    };

    const downloadPlotlyImage = async (format) => {
      const { width, height } = plotlyFigureSize(container, layout);
      const dataUrl = await plotly.toImage(container, {
        format,
        width,
        height,
        scale: format === "png" ? Math.max(1, Math.min(3, window.devicePixelRatio || 2)) : 1,
      });
      const response = await fetch(dataUrl);
      downloadBlob(await response.blob(), `${baseName}.${format}`);
    };

    const pngButton = makeButton("PNG", "Download this figure as PNG", () =>
      downloadPlotlyImage("png")
    );
    const svgButton = makeButton("SVG", "Download this figure as SVG", () =>
      downloadPlotlyImage("svg")
    );
    const jsonButton = makeButton("JSON", "Download this figure data as JSON", async () => {
      downloadBlob(
        new Blob([JSON.stringify({ data, layout, publication }, null, 2)], {
          type: "application/json;charset=utf-8",
        }),
        `${baseName}.json`
      );
    });

    controls.append(labelNode, pngButton, svgButton, jsonButton);
    container.appendChild(controls);
  }

  function svgDownloadMarkup(svgNode, publication = null) {
    const clone = svgNode.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    if (publication) {
      clone.setAttribute("data-msigsdk-publication", JSON.stringify(publication));
    }
    const viewBox = (clone.getAttribute("viewBox") || "")
      .split(/\s+/)
      .map(Number);
    if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
      clone.setAttribute("width", String(viewBox[2]));
      clone.setAttribute("height", String(viewBox[3]));
    }
    const plotStyles = document.getElementById("msig-d3-plot-styles")?.textContent;
    if (plotStyles) {
      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      style.textContent = plotStyles;
      clone.insertBefore(style, clone.firstChild);
    }
    if (publication?.caption || publication?.title) {
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = publication.title || "mSigSDK figure";
      clone.insertBefore(title, clone.firstChild);
      const desc = document.createElementNS("http://www.w3.org/2000/svg", "desc");
      desc.textContent = publication.caption || "";
      clone.insertBefore(desc, title.nextSibling);
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  }

  function svgSizeForDownload(svgNode) {
    const viewBox = (svgNode.getAttribute("viewBox") || "")
      .split(/\s+/)
      .map(Number);
    if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
      return { width: Math.max(1, viewBox[2]), height: Math.max(1, viewBox[3]) };
    }
    const rect = svgNode.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width || 980)),
      height: Math.max(1, Math.round(rect.height || 520)),
    };
  }

  async function svgMarkupToPngBlob(svgText, width, height) {
    const svgBlob = new Blob([svgText], {
      type: "image/svg+xml;charset=utf-8",
    });
    const href = URL.createObjectURL(svgBlob);
    try {
      const image = new Image();
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Could not render SVG for PNG download."));
      });
      image.src = href;
      await loaded;
      const scale = Math.max(1, Math.min(3, window.devicePixelRatio || 2));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.drawImage(image, 0, 0, width, height);
      return await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not create PNG blob."))),
          "image/png"
        );
      });
    } finally {
      URL.revokeObjectURL(href);
    }
  }

  function addFigureDownloadControls(chart, svgNode, label, publication = null) {
    if (!chart || !svgNode || chart.querySelector(".msig-d3-downloads")) {
      return;
    }
    const publicationInfo = publication || chart.__msigFigurePublication || null;
    const baseName = `msigsdk-${downloadSafeName(label || "figure")}`;
    const controls = document.createElement("div");
    controls.className = "msig-d3-downloads";
    const labelNode = document.createElement("span");
    labelNode.className = "msig-d3-download-label";
    labelNode.textContent = "Download";

    const svgButton = document.createElement("button");
    svgButton.type = "button";
    svgButton.className = "msig-d3-download-button";
    svgButton.textContent = "SVG";
    svgButton.title = "Download this figure as SVG";

    const pngButton = document.createElement("button");
    pngButton.type = "button";
    pngButton.className = "msig-d3-download-button";
    pngButton.textContent = "PNG";
    pngButton.title = "Download this figure as PNG";

    const jsonButton = document.createElement("button");
    jsonButton.type = "button";
    jsonButton.className = "msig-d3-download-button";
    jsonButton.textContent = "JSON";
    jsonButton.title = "Download this figure metadata as JSON";

    const withBusyButton = async (button, task) => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = "...";
      try {
        await task();
      } finally {
        button.textContent = original;
        button.disabled = false;
      }
    };

    svgButton.addEventListener("click", () =>
      withBusyButton(svgButton, async () => {
        const svgText = svgDownloadMarkup(svgNode, publicationInfo);
        downloadBlob(
          new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }),
          `${baseName}.svg`
        );
      })
    );
    pngButton.addEventListener("click", () =>
      withBusyButton(pngButton, async () => {
        const svgText = svgDownloadMarkup(svgNode, publicationInfo);
        const { width, height } = svgSizeForDownload(svgNode);
        const pngBlob = await svgMarkupToPngBlob(svgText, width, height);
        downloadBlob(pngBlob, `${baseName}.png`);
      })
    );
    jsonButton.addEventListener("click", () =>
      withBusyButton(jsonButton, async () => {
        downloadBlob(
          new Blob(
            [
              JSON.stringify(
                figurePublicationPayload(publicationInfo, {
                  figureType: "svg",
                  ariaLabel: svgNode.getAttribute("aria-label"),
                  viewBox: svgNode.getAttribute("viewBox"),
                }),
                null,
                2
              ),
            ],
            { type: "application/json;charset=utf-8" }
          ),
          `${baseName}.json`
        );
      })
    );

    controls.append(labelNode, svgButton, pngButton, jsonButton);
    chart.insertBefore(controls, svgNode);
  }

  function createD3PlotFrame(
    target,
    {
      title,
      subtitle,
      badges = [],
      maxWidth = "980px",
      figureContext = null,
      publication = null,
      caption = null,
    } = {}
  ) {
    ensureD3PlotStyles();
    const { element: container } = resolvePlotContainer(target);
    const effectivePublication = resolvePlotPublication(publication);
    container.innerHTML = "";
    container.classList.add("msig-d3-plot");
    container.classList.toggle("msig-d3-compact", Boolean(effectivePublication?.compact));
    container.style.maxWidth = effectivePublication?.maxWidth || maxWidth;
    const publicationInfo = normalizeFigurePublication({
      title,
      subtitle,
      badges,
      figureContext,
      publication: effectivePublication,
      caption,
    });

    const header = document.createElement("div");
    header.className = "msig-d3-header";

    const copy = document.createElement("div");
    copy.style.minWidth = "0";
    if (title) {
      const titleElement = document.createElement("div");
      titleElement.className = "msig-d3-title";
      titleElement.textContent = title;
      copy.appendChild(titleElement);
    }
    if (subtitle) {
      const subtitleElement = document.createElement("div");
      subtitleElement.className = "msig-d3-subtitle";
      subtitleElement.textContent = subtitle;
      copy.appendChild(subtitleElement);
    }
    header.appendChild(copy);

    if (badges.length > 0) {
      const badgeContainer = document.createElement("div");
      badgeContainer.className = "msig-d3-badges";
      badges.forEach(({ label, value }) => {
        const badge = document.createElement("div");
        badge.className = "msig-d3-badge";
        const stringValue = value === undefined || value === null ? "" : String(value);
        const compactValue = compactPlotLabel(stringValue, 28);

        const badgeLabel = document.createElement("div");
        badgeLabel.className = "msig-d3-badge-label";
        badgeLabel.textContent = label;

        const badgeValue = document.createElement("div");
        badgeValue.className = "msig-d3-badge-value";
        badgeValue.textContent = compactValue;
        if (compactValue !== stringValue) {
          badge.title = stringValue;
          badgeValue.title = stringValue;
        }

        badge.append(badgeLabel, badgeValue);
        badgeContainer.appendChild(badge);
      });
      header.appendChild(badgeContainer);
    }

    const chart = document.createElement("div");
    chart.style.width = "100%";
    chart.__msigFigurePublication = publicationInfo;

    const tooltip = document.createElement("div");
    tooltip.className = "msig-d3-tooltip";

    container.append(header, chart, tooltip);
    renderFigureFooter(container, publicationInfo);

    const showTooltip = (event, html) => {
      const margin = 10;
      const offset = 14;
      tooltip.innerHTML = html;
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "hidden";
      tooltip.style.left = "0px";
      tooltip.style.top = "0px";

      const viewportWidth =
        window.innerWidth || document.documentElement?.clientWidth || 1024;
      const viewportHeight =
        window.innerHeight || document.documentElement?.clientHeight || 768;
      tooltip.style.maxHeight = `${Math.max(96, viewportHeight - margin * 2)}px`;
      const tooltipRect = tooltip.getBoundingClientRect();
      let left = event.clientX + offset;
      if (left + tooltipRect.width > viewportWidth - margin) {
        left = event.clientX - tooltipRect.width - offset;
      }
      left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));

      let top = event.clientY + offset;
      if (top + tooltipRect.height > viewportHeight - margin) {
        top = event.clientY - tooltipRect.height - offset;
      }
      top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));

      tooltip.dataset.placement = left < event.clientX ? "left" : "right";
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.visibility = "visible";
    };
    const hideTooltip = () => {
      tooltip.style.opacity = "0";
      tooltip.style.visibility = "hidden";
    };

    return { container, chart, tooltip, showTooltip, hideTooltip, publication: publicationInfo };
  }

  function publicationNumber(publication, key, fallback, { min = 1, max = Infinity } = {}) {
    const value = Number(publication?.[key]);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, value));
  }

  function publicationBool(publication, key, fallback = false) {
    return typeof publication?.[key] === "boolean" ? publication[key] : fallback;
  }

  function appendResponsiveSvg(chart, width, height, label, publication = null) {
    const publicationInfo = publication || chart.__msigFigurePublication || null;
    const svg = d3
      .select(chart)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .style("height", "auto")
      .attr("role", "img")
      .attr("aria-label", label || "mSigSDK plot");
    addFigureDownloadControls(chart, svg.node(), label || "mSigSDK plot", publicationInfo);
    return svg;
  }

	  function styleD3Axis(selection) {
	    selection.classed("msig-d3-axis", true);
    selection.selectAll(".domain").attr("stroke-width", 1);
    selection
      .selectAll(".tick line")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.85);
    selection
      .selectAll(".tick text")
      .attr("paint-order", "stroke")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2.5)
      .attr("stroke-linejoin", "round");
	  }

  /**

Generates a mutational spectrum summary plot and displays it in a given HTML div element.
@async
@function plotProfilerSummary
@memberof mSigPortalPlots
@param {string} [studyName="PCAWG"] - The name of the cancer genomics study to use. Default is "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genomic data to use. Default is "WGS".
@param {string} [cancerTypeOrGroup="Lung-AdenoCA"] - The cancer type or group to display. Default is "Lung-AdenoCA".
@param {number} [numberOfResults=50] - The maximum number of results to display. Default is 50.
@param {string} [divID="mutationalSpectrumSummary"] - The ID of the HTML div element where the plot will be displayed. Default is "mutationalSpectrumSummary".
@returns {Promise<void>} A Promise that resolves when the plot is displayed or rejects if there is an error.
@throws {Error} If there is an error retrieving or displaying the plot, this function will throw an Error with a message describing the error.
*/

  // This function plots the mutational spectrum summary for the given parameters.
  // Input:
  // - studyName: Name of the study for which the data is to be fetched
  // - genomeDataType: Type of the genome data to be fetched
  // - cancerTypeOrGroup: Cancer type or group for which the data is to be fetched
  // - numberOfResults: Number of results to be fetched
  // Output: A mutational spectrum summary plot of the given parameters
  async function plotProfilerSummary(
    studyName = "PCAWG",
    genomeDataType = "WGS",
    cancerTypeOrGroup = "Lung-AdenoCA",
    numberOfResults = 50,
    divID = "mutationalSpectrumSummary",
    options = {}
  ) {
    try {
      const summary = await getMutationalSpectrumSummary(
        studyName,
        genomeDataType,
        cancerTypeOrGroup,
        numberOfResults
      );
      let data = await getBarPlotData(summary);
      if (data.length == 0) {
        return renderPlotError(
          divID,
          "no data available for the selected parameters."
        );
      } else {
        let layout = {
          title: `${studyName} ${cancerTypeOrGroup} ${genomeDataType} Mutational Spectrum Summary`,
          xaxis: {
            title: "Sample",
          },
          yaxis: {
            title: "Log (Number of Mutations)",
          },
          barmode: "stack",
        };
        plotGraphWithPlotlyAndMakeDataDownloadable(divID, data, layout, {
          ...(options.publication || {}),
          context: mergeFigureContext(options.figureContext, {
            dataset: studyName,
            cancerType: cancerTypeOrGroup,
            strategy: genomeDataType,
            samplesShown: summary.length,
            resultLimit: numberOfResults,
          }),
        });
      }
    } catch (err) {
      console.error(err);
      return renderPlotError(divID, err.message);
    }
  }

  async function getBarPlotData(summary) {
    let data = [];
    for (let i = 0; i < summary.length; i++) {
      if (
        !data.some(
          (e) => e.name === summary[i]["profile"] + `: ${summary[i]["matrix"]}`
        )
      ) {
        data.push({
          x: [summary[i]["sample"]],
          y: [summary[i]["logTotalMutations"]],
          text: [parseInt(summary[i]["meanTotalMutations"])],
          type: "bar",
          name: summary[i]["profile"] + `: ${summary[i]["matrix"]}`,
          marker: {
            color: summary[i].color,
          },
        });
      } else {
        let existingData = data.find(
          (e) => e.name === summary[i]["profile"] + `: ${summary[i]["matrix"]}`
        );
        existingData.x.push(summary[i]["sample"]);
        existingData.y.push(summary[i]["logTotalMutations"]);
        existingData.text.push(parseInt(summary[i]["meanTotalMutations"]));
      }
    }
    return data;
  }

  // This function plots the mutational spectrum mutational count as boxplots for each cancer type for the given dataset.

  /**

Plots the mutational burden by cancer type for a given project.
@async
@function plotProjectMutationalBurdenByCancerType
@memberof mSigPortalPlots
@param {Object} project - An object containing mutational data for different cancer types.
@param {string} divID - The ID of the div where the plot should be displayed.
@returns {Promise} - A Promise that resolves when the plot is displayed.
@example
// Example usage:
plotProjectMutationalBurdenByCancerType(projectData, "plotDiv");
*/
  async function plotProjectMutationalBurdenByCancerType(project, divID, options = {}) {
    project = groupBy(project, "cancer");
    Object.keys(project).forEach(function (key, index) {
      project[key] = groupBy(project[key], "sample");
      Object.keys(project[key]).forEach(function (patient, index) {
        project[key][patient] = Object.values(
          extractMutationalSpectra(project[key][patient], "sample")
        )[0];
      });
    });

    // Loop through all the cancertypes in project and create a trace for each cancer type and add it to the data array

    const cancerTypes = Object.keys(project);

    const data = [];

    const boxColor = {};
    const allColors = linspace(0, 360, cancerTypes.length);
    for (var i = 0; i < cancerTypes.length - 1; i++) {
      var result = "hsl(" + allColors[i] + ",50%" + ",50%)";
      boxColor[cancerTypes[i]] = result;
    }

    for (let cancerType of cancerTypes) {
      const cancerTypeData = Object.values(project[cancerType]);

      const trace = {
        // x: Object.keys(project[cancerType]),
        y: Object.values(cancerTypeData).map((e) =>
          Math.log10(Object.values(e).reduce((a, b) => a + b, 0))
        ),
        type: "box",
        name: cancerType,
        marker: {
          color: boxColor[cancerType],
        },
        boxpoints: "Outliers",
      };

      data.push(trace);
    }

    const layout = {
      title: `Mutational Burden by Cancer Type`,
      xaxis: {
        title: "Cancer Type",
        type: "category",
        automargin: true,
      },
      yaxis: {
        title: "Log (Number of Mutations)",
      },
      barmode: "stack",
      height: 600,
    };

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, data, layout, {
      ...(options.publication || {}),
      context: mergeFigureContext(options.figureContext, {
        dataset: options.dataset || options.study || "Public project data",
        cancerTypes: cancerTypes.length,
        plottedMetric: "log10 total mutations",
      }),
    });
  }

  //#endregion

  //#region Plot a patient's mutational spectra

  function profileDisplayNames(mutationalSpectra) {
    return Object.keys(mutationalSpectra || {});
  }

  function normalizeProfileSpectrumCollection(
    spectra,
    fallbackSample = "Spectrum"
  ) {
    if (!spectra || typeof spectra !== "object" || Array.isArray(spectra)) {
      return {};
    }

    const values = Object.values(spectra);
    if (
      values.length > 0 &&
      values.every((value) => Number.isFinite(Number(value)))
    ) {
      return { [fallbackSample]: spectra };
    }

    return Object.fromEntries(
      Object.entries(spectra).filter(
        ([, record]) =>
          record &&
          typeof record === "object" &&
          !Array.isArray(record) &&
          Object.values(record).some((value) => Number.isFinite(Number(value)))
      )
    );
  }

  function inferProfileKeyFromPlotRequest(matrixSize, options = {}) {
    if (options.profileKey) {
      return workflowProfileKey(options.profileKey);
    }
    if (options.profile || options.matrix || options.matrixSize) {
      return workflowProfileKey({
        profile: options.profile || "SBS",
        matrix: options.matrix || options.matrixSize || matrixSize || 96,
      });
    }
    const numericSize = Number(matrixSize);
    if (numericSize === 1536) return "SBS1536";
    if (numericSize === 78) return "DBS78";
    if (numericSize === 83) return "ID83";
    return numericSize === 96 || !Number.isFinite(numericSize)
      ? "SBS96"
      : `SBS${numericSize}`;
  }

  function profilePlotRenderer(profileKeyValue) {
    const key = workflowProfileKey(profileKeyValue);
    if (key === "SBS1536") return plotMutationalProfileSBS1536;
    if (key === "DBS78") return plotMutationalProfileDBS78;
    if (key === "ID83") return plotMutationalProfileID83;
    if (key === "RS32" || key === "SV32") return plotMutationalProfileRS32;
    return null;
  }

  function profileRowsForPlotly(record, contexts, sample, profileKeyValue) {
    const profileOptions = profileOptionsFromKey(profileKeyValue);
    return contexts.map((context) => {
      const mutations = Number(record?.[context] || 0);
      return {
        sample,
        signatureName: sample,
        profile: profileOptions.profile,
        matrix: profileOptions.matrix,
        mutationType: context,
        mutations,
        contribution: mutations,
      };
    });
  }

  function profilePlotScale(profileKeyValue, options = {}) {
    const key = workflowProfileKey(profileKeyValue);
    const requestedScale = String(options.scale || options.plotScale || "").toLowerCase();
    if (requestedScale === "count" || requestedScale === "counts") return "count";
    if (requestedScale === "percent" || requestedScale === "percentage") return "percent";
    return key === "DBS78" || key === "ID83" ? "percent" : "count";
  }

  function scaleProfileRowsForPlot(rows, profileKeyValue, options = {}) {
    const scale = profilePlotScale(profileKeyValue, options);
    const total = rows.reduce((sum, row) => sum + Number(row.mutations || 0), 0);
    if (scale !== "percent" || total <= 0) {
      return {
        rows,
        total,
        scale: "count",
        plottedMetric: "mutation count",
      };
    }

    return {
      rows: rows.map((row) => ({
        ...row,
        mutations: Number(row.mutations || 0) / total,
        contribution: Number(row.contribution || row.mutations || 0) / total,
      })),
      total,
      scale: "percent",
      plottedMetric: "mutation percentage",
    };
  }

  function profilePlotLayoutOverrides(
    profileKeyValue,
    renderedLayout = {},
    options = {},
    metrics = {}
  ) {
    const key = workflowProfileKey(profileKeyValue);
    if (key === "DBS78") {
      const maxMutation = Number(metrics.maxMutation || 0);
      const countScale = metrics.scale !== "percent";
      return {
        ...renderedLayout,
        autosize: false,
        width: Number(options.width) || 1680,
        height: Number(options.height) || 560,
        margin: {
          l: 82,
          r: 28,
          t: 94,
          b: 118,
          ...(renderedLayout.margin || {}),
        },
        bargap: renderedLayout.bargap ?? 0.08,
        xaxis: {
          ...(renderedLayout.xaxis || {}),
          automargin: true,
          tickangle: -90,
          tickfont: {
            ...(renderedLayout.xaxis?.tickfont || {}),
            family: "Arial, sans-serif",
            size: Number(options.tickFontSize) || 10,
          },
        },
        yaxis: {
          ...(renderedLayout.yaxis || {}),
          automargin: true,
          tick0: countScale ? 0 : renderedLayout.yaxis?.tick0,
          dtick:
            countScale && maxMutation <= 5
              ? 1
              : renderedLayout.yaxis?.dtick,
          tickformat: countScale ? ",d" : renderedLayout.yaxis?.tickformat,
          range:
            countScale && maxMutation <= 5
              ? [0, Math.max(1.2, Math.ceil(maxMutation) + 0.2)]
              : renderedLayout.yaxis?.range,
          title: {
            ...(renderedLayout.yaxis?.title || {}),
            standoff: 12,
            font: {
              ...(renderedLayout.yaxis?.title?.font || {}),
              family: "Arial, sans-serif",
              size: 13,
            },
          },
        },
        annotations: (renderedLayout.annotations || []).map((annotation) => ({
          ...annotation,
          text:
            typeof annotation.text === "string"
              ? annotation.text.replace(
                  " Substitutions</b>",
                  " Double Base Substitutions</b>"
                )
              : annotation.text,
          font: {
            ...(annotation.font || {}),
            size: Math.min(Number(annotation.font?.size) || 14, 14),
          },
        })),
      };
    }

    if (key === "ID83") {
      const countScale = metrics.scale !== "percent";
      const maxMutation = Number(metrics.maxMutation || 0);
      return {
        ...renderedLayout,
        autosize: false,
        width: Number(options.width) || 1960,
        height: Number(options.height) || 620,
        margin: {
          l: 90,
          r: 28,
          t: 126,
          b: 156,
          ...(renderedLayout.margin || {}),
        },
        bargap: renderedLayout.bargap ?? 0.08,
        xaxis: {
          ...(renderedLayout.xaxis || {}),
          automargin: true,
          showticklabels: false,
        },
        yaxis: {
          ...(renderedLayout.yaxis || {}),
          automargin: true,
          tick0: countScale ? 0 : renderedLayout.yaxis?.tick0,
          dtick:
            countScale && maxMutation <= 6
              ? 1
              : renderedLayout.yaxis?.dtick,
          tickformat: countScale ? ",d" : ".0%",
          range:
            countScale && maxMutation <= 6
              ? [0, Math.max(1.2, Math.ceil(maxMutation) + 0.2)]
              : renderedLayout.yaxis?.range,
          title: {
            ...(renderedLayout.yaxis?.title || {}),
            standoff: 12,
            font: {
              ...(renderedLayout.yaxis?.title?.font || {}),
              size: 14,
            },
          },
        },
      };
    }

    if (key === "SBS1536") {
      return {
        ...renderedLayout,
        height: Number(options.height) || 620,
        margin: {
          l: 78,
          r: 30,
          t: 88,
          b: 110,
          ...(renderedLayout.margin || {}),
        },
      };
    }

    return renderedLayout;
  }

  /**
   * Renders a COSMIC-style mutational profile using the renderer that matches the selected matrix.
   *
   * @function plotCosmicProfile
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} spectra - One context-keyed spectrum or a sample-keyed spectra object.
   * @param {Object} [options] - Plot options.
   * @param {string} [options.profileKey="SBS96"] - Canonical profile key such as SBS96, SBS1536, DBS78, ID83, or RS32.
   * @param {string} [options.profile] - Profile family when profileKey is not supplied.
   * @param {number} [options.matrix] - Matrix size when profileKey is not supplied.
   * @param {string} [options.sample=null] - Sample or group to render.
   * @param {string[]} [options.contexts=null] - Optional canonical context order.
   * @returns {Object|Element} Render metadata or an error element.
   */
  function plotCosmicProfile(divID, spectra, options = {}) {
    const profileKeyValue = inferProfileKeyFromPlotRequest(
      options.matrixSize || options.matrix,
      options
    );
    if (profileKeyValue === "SBS96") {
      return plotCosmicSbs96Profile(divID, spectra, {
        ...options,
        contexts:
          options.contexts ||
          getExpectedContexts({ profile: "SBS", matrix: 96 }),
      });
    }

    const renderer = profilePlotRenderer(profileKeyValue);
    const contexts =
      options.contexts ||
      getExpectedContexts(profileOptionsFromKey(profileKeyValue)) ||
      [];
    const collection = normalizeProfileSpectrumCollection(
      spectra,
      options.sample || options.sampleName || "Spectrum"
    );
    const sampleNames = Object.keys(collection);

    if (!renderer) {
      return plotGroupedMutationalProfilesWithPlotly(
        divID,
        collection,
        `COSMIC-style ${profileKeyValue} profile`,
        options
      );
    }

    if (!sampleNames.length) {
      return renderPlotError(
        divID,
        `No ${profileKeyValue} spectra available to plot.`
      );
    }

    const selectedSample =
      sampleNames.find(
        (name) => name === options.sample || name === options.sampleName
      ) || sampleNames[0];
    const record = collection[selectedSample] || {};
    const orderedContexts = contexts.length ? contexts : Object.keys(record);
    const rows = profileRowsForPlotly(
      record,
      orderedContexts,
      selectedSample,
      profileKeyValue
    );
    const total = rows.reduce((sum, row) => sum + Number(row.mutations || 0), 0);

    if (!rows.length || total === 0) {
      return renderPlotNotice(
        divID,
        `${profileKeyValue} spectrum is empty`,
        `No counted ${profileKeyValue} bins are available for ${selectedSample}. Review the selected profile requirements and row-level skipped reasons before plotting.`
      );
    }

    const title = options.title || `Converted ${profileKeyValue} spectrum`;
    const scaledPlot = scaleProfileRowsForPlot(rows, profileKeyValue, options);
    const rendered = renderer(scaledPlot.rows, title);
    const adjustedLayout = profilePlotLayoutOverrides(
      profileKeyValue,
      rendered.layout || {},
      options,
      {
        total: scaledPlot.rows.reduce(
          (sum, row) => sum + Number(row.mutations || 0),
          0
        ),
        rawTotal: scaledPlot.total,
        scale: scaledPlot.scale,
        maxMutation: scaledPlot.rows.reduce(
          (max, row) => Math.max(max, Number(row.mutations || 0)),
          0
        ),
      }
    );
    const layout = {
      ...adjustedLayout,
      meta: {
        ...(adjustedLayout.meta || {}),
        subtitle:
          options.subtitle ||
          `COSMIC-style ${profileKeyValue} profile rendered with its profile-specific bin order.`,
        figureContext: mergeFigureContext(options.figureContext, {
          dataset: options.dataset || "Input spectra",
          sample: selectedSample,
          profile: profileOptionsFromKey(profileKeyValue).profile,
          matrix: profileOptionsFromKey(profileKeyValue).matrix,
          contexts: orderedContexts.length,
          plottedMetric: scaledPlot.plottedMetric,
        }),
      },
    };

    plotGraphWithPlotlyAndMakeDataDownloadable(
      divID,
      rendered.traces || [],
      layout,
      options.publication || {}
    );
    return { traces: rendered.traces || [], layout, rows: scaledPlot.rows };
  }

  function plotGroupedMutationalProfilesWithPlotly(
    divID,
    mutationalSpectra,
    titlePrefix = "Mutational profiles",
    options = {}
  ) {
    const profileNames = profileDisplayNames(mutationalSpectra);
    const layout = {
      title: `${titlePrefix} for ${profileNames.join(", ")}`,
      xaxis: { title: "Mutation Type" },
      yaxis: { title: "Count" },
      barmode: "group",
    };

    const traces = profileNames.map((profileName) => ({
      x: Object.keys(mutationalSpectra[profileName] || {}),
      y: Object.values(mutationalSpectra[profileName] || {}),
      name: `${profileName}`,
      type: "bar",
    }));

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, traces, layout, {
      ...(options.publication || {}),
      context: mergeFigureContext(options.figureContext, {
        dataset: options.dataset || "Input spectra",
        profiles: profileNames.length,
        plottedMetric: "mutation count",
      }),
    });
    return { traces, layout };
  }

  function plotCosmicSbs96ProfileSet(
    divID,
    mutationalSpectra,
    {
      title = "COSMIC-style SBS96 profile",
      subtitle =
        "COSMIC-style SBS96 profile. Plotly grouped bars are reserved for three or more profiles.",
      normalize = "auto",
      figureContext = null,
      publication = null,
    } = {}
  ) {
    const collection = normalizeSbs96SpectrumCollection(
      mutationalSpectra,
      "Profile"
    );
    const profileNames = Object.keys(collection);

    if (!profileNames.length) {
      return renderPlotError(
        divID,
        "COSMIC-style profile rendering requires SBS96 context-keyed data."
      );
    }

    const { element: container } = resolvePlotContainer(divID);
    container.innerHTML = "";
    container.style.display = "grid";
    container.style.gap = profileNames.length > 1 ? "28px" : "0";

    const rendered = profileNames.slice(0, 2).map((profileName) => {
      const profileDiv = document.createElement("div");
      profileDiv.style.width = "100%";
      container.appendChild(profileDiv);
      return plotCosmicSbs96Profile(profileDiv, collection, {
        sample: profileName,
        normalize,
        title:
          profileNames.length === 1
            ? title
            : `${title}: ${profileName}`,
        subtitle,
        figureContext,
        publication,
      });
    });

    return rendered.length === 1 ? rendered[0] : rendered;
  }

  function enforceCosmicProfileRule(
    divID,
    mutationalSpectra,
    profileCount,
    {
      matrixSize = null,
      mutationType = null,
      figureContext = null,
      publication = null,
      dataset = null,
    } = {}
  ) {
    if (profileCount >= 3) return null;

    const isSbs96 =
      (Number(matrixSize) === 96 && mutationType === "SBS") ||
      looksLikeSbs96Record(mutationalSpectra) ||
      Object.values(mutationalSpectra || {}).some((record) =>
        looksLikeSbs96Record(record)
      );

    if (isSbs96) {
      return plotCosmicSbs96ProfileSet(divID, mutationalSpectra, {
        figureContext: mergeFigureContext(figureContext, {
          dataset,
          profile: "SBS",
          matrix: matrixSize || 96,
        }),
        publication,
      });
    }

    return renderPlotError(
      divID,
      "One or two mutational signature profiles must use the COSMIC-style SBS96 renderer. Pass three or more profiles to use the grouped Plotly implementation."
    );
  }

  /**
   * Plots the mutational spectrum for the given parameters.
   * @async
   * @function plotPatientMutationalSpectrumuserData
   * @memberof mSigPortalPlots
   * @param {Object} mutationalSpectra - An object containing the mutational spectra data.
   * @param {number} [matrixSize=96] - The size of the matrix to be plotted.
   * @param {string} [divID="mutationalSpectrumMatrix"] - The ID of the div element where the plot will be displayed.
   */
  async function plotPatientMutationalSpectrumuserData(
    mutationalSpectra,
    matrixSize = 96,
    divID = "mutationalSpectrumMatrix",
    options = {}
  ) {
    const requestedProfileKey = inferProfileKeyFromPlotRequest(
      matrixSize,
      options
    );
    if (["SBS1536", "DBS78", "ID83", "RS32", "SV32"].includes(requestedProfileKey)) {
      return plotCosmicProfile(divID, mutationalSpectra, {
        ...options,
        profileKey: requestedProfileKey,
        matrixSize,
      });
    }

    if (!mutationalSpectra || typeof mutationalSpectra !== "object") {
      return renderPlotError(
        divID,
        "no data available for the selected parameters."
      );
    }

    if (looksLikeSbs96Record(mutationalSpectra)) {
      return plotCosmicSbs96ProfileSet(divID, mutationalSpectra, {
        figureContext: mergeFigureContext(options.figureContext, {
          dataset: options.dataset || "User data",
          matrix: `SBS${matrixSize || 96}`,
        }),
        publication: options.publication,
      });
    }

    const numberOfProfiles = Object.keys(mutationalSpectra).length;
    if (numberOfProfiles == 0) {
      return renderPlotError(
        divID,
        "no data available for the selected parameters."
      );
    }

    const ruleResult = enforceCosmicProfileRule(
      divID,
      mutationalSpectra,
      numberOfProfiles,
      {
        matrixSize,
        figureContext: options.figureContext,
        publication: options.publication,
        dataset: options.dataset || "User data",
      }
    );
    if (ruleResult) return ruleResult;

    return plotGroupedMutationalProfilesWithPlotly(
      divID,
      mutationalSpectra,
      "Mutational profiles",
      {
        ...options,
        figureContext: mergeFigureContext(options.figureContext, {
          dataset: options.dataset || "User data",
          matrix: `SBS${matrixSize || "unknown"}`,
        }),
      }
    );
  }

  /**
Renders a plot of mutational profiles in a given div element ID.
@async
@function plotPatientMutationalSpectrum
@memberof mSigPortalPlots
@param {Object} mutationalSpectra - An object containing the mutational spectra data for one or more patients.
@param {number} [matrixSize=96] - The size of the plot matrix. Defaults to 96.
@param {string} [divID='mutationalSpectrumMatrix'] - The ID of the div element to render the plot in. Defaults to 'mutationalSpectrumMatrix'.
@returns {Promise<void>} A promise that resolves when the plot has been rendered.
@throws {Error} An error is thrown if no data is available for the selected parameters.
*/

  // One or two SBS96 profiles always use the COSMIC-style renderer; grouped
  // Plotly bars are reserved for three or more profiles.
  async function plotPatientMutationalSpectrum(
    mutationalSpectra,
    divID = "mutationalSpectrumMatrix",
    options = {}
  ) {
    if (!mutationalSpectra) {
      return renderPlotError(
        divID,
        "no data available for the selected parameters."
      );
    }

    if (!Array.isArray(mutationalSpectra)) {
      if (
        typeof mutationalSpectra === "object" &&
        Object.keys(mutationalSpectra).length > 0
      ) {
        return plotPatientMutationalSpectrumuserData(
          mutationalSpectra,
          undefined,
          divID,
          {
            ...options,
            figureContext: mergeFigureContext(options.figureContext, {
              dataset: options.dataset || "Input spectra",
            }),
          }
        );
      }

      return renderPlotError(
        divID,
        "mutationalSpectra must be a non-empty array or sample-keyed object."
      );
    }

    const numberOfPatients = Object.keys(mutationalSpectra).length;

    if (numberOfPatients == 0) {
      return renderPlotError(
        divID,
        "no data available for the selected parameters."
      );
    }

    if (!Array.isArray(mutationalSpectra[0]) || mutationalSpectra[0].length === 0) {
      return renderPlotError(
        divID,
        "mutationalSpectra must contain at least one non-empty sample array."
      );
    }

    const matrixSize = mutationalSpectra[0].length;
    const mutationType = mutationalSpectra[0][0]?.profile;

    if (!mutationType) {
      return renderPlotError(
        divID,
        "mutationalSpectra records must include a profile value."
      );
    }

    const extractedSpectra = extractMutationalSpectra(mutationalSpectra);
    const ruleResult = enforceCosmicProfileRule(
      divID,
      extractedSpectra,
      numberOfPatients,
      {
        matrixSize,
        mutationType,
        figureContext: options.figureContext,
        publication: options.publication,
        dataset: options.dataset || "mSigPortal spectra",
      }
    );
    if (ruleResult) return ruleResult;

    return plotGroupedMutationalProfilesWithPlotly(
      divID,
      extractedSpectra,
      "Mutational profiles",
      {
        ...options,
        figureContext: mergeFigureContext(options.figureContext, {
          dataset: options.dataset || "mSigPortal spectra",
          profile: mutationType,
          matrix: matrixSize,
        }),
      }
    );
  }

  /**
   * Converts the mutational spectra data to a format that can be used to create a Plotly chart.
   * @function formatMutationalSpectraData
   * @memberof mSigPortalData
   * @param {Object} mutationalSpectrum - An object containing the mutational spectra data.
   * @param {string} sample - The name of the sample.
   * @returns {Object[]} The data in a format that can be used to create a Plotly chart. The data is an array of objects. Each object has a name, x, y, and type property. The name property is the name of the mutation type. The x property is an array of the mutation names. The y property is an array of the mutation frequencies. The type property is the type of substitution that takes place.
   */

  function formatMutationalSpectraData(mutationalSpectrum, sample) {
    const matrixSize = Object.keys(mutationalSpectrum).length;
    if (matrixSize === 96) {
      const substitutionTypes = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];

      const data = substitutionTypes.map((substitutionType) => {
        return {
          name: `${substitutionType}  ${sample}`,
          x: [],
          y: [],
          type: "bar",
        };
      });

      substitutionTypes.forEach((substitutionType) => {
        Object.keys(mutationalSpectrum)
          .filter((key) => {
            return key.includes(substitutionType);
          })
          .forEach((key) => {
            data
              .find((e) => e.name === `${substitutionType}  ${sample}`)
              .x.push(key);
            data
              .find((e) => e.name === `${substitutionType}  ${sample}`)
              .y.push(mutationalSpectrum[key]);
          });
      });

      return data;
    } else if (matrixSize === 192) {
      return [
        {
          name: `${sample}`,
          x: Object.keys(mutationalSpectrum),
          y: Object.values(mutationalSpectrum),
          type: "bar",
        },
      ];
    } else if (matrixSize === 1536) {
      return [
        {
          name: `${sample}`,
          x: Object.keys(mutationalSpectrum),
          y: Object.values(mutationalSpectrum),
          type: "bar",
        },
      ];
    } else {
      return [
        {
          name: `${sample}`,
          x: Object.keys(mutationalSpectrum),
          y: Object.values(mutationalSpectrum),
          type: "bar",
        },
      ];
    }
  }

  //#endregion

  //#region Creates a force directed tree of the patients in the study based on their mutational spectra

  /**
   * Extracts the mutational spectra out of the mSigPortal API call.
   * @function extractMutationalSpectra
   * @memberof mSigPortalData
   * @param {Object[]} data - An array of objects containing the data from the mSigPortal API call.
   * @param {string} [groupName="sample"] - The name of the group to extract the mutational spectra from.
   * @returns {Object} An object containing the mutational spectra data grouped by the specified group name.
   */

  function extractMutationalSpectra(data, groupName = "sample") {
    if (!data) {
      return {};
    }

    if (!Array.isArray(data)) {
      const values = typeof data === "object" ? Object.values(data) : [];
      const groupedApiRows =
        values.length > 0 &&
        values.every(Array.isArray) &&
        values
          .flat()
          .every((row) => row && typeof row === "object" && "mutationType" in row);

      if (!groupedApiRows) {
        return data;
      }

      data = values;
    }

    data = data.flat();

    // Group all of the dictionaries in the data array by sample name
    let groupedData = groupBy(data, groupName);

    // Converts the grouped data into mutational spectrum dictionaries that can be used to create a force directed tree.
    Object.keys(groupedData).forEach(function (key) {
      let mutationalSpectrum = init_sbs_mutational_spectra();

      groupedData[key].forEach((mutation) => {
        let mutationType = mutation["mutationType"];
        if (groupName == "sample") {
          mutationalSpectrum[mutationType] = mutation["mutations"];
        } else if (groupName == "signatureName") {
          mutationalSpectrum[mutationType] = mutation["contribution"];
        } else {
          console.error("Invalid group name");
        }
      });

      groupedData[key] = mutationalSpectrum;
    });
    return groupedData;
  }

  /**
   * @async
   * @function plotCosineSimilarityHeatMap
   * @description Generates a cosine similarity heatmap based on mutational spectra data.
   * This function processes grouped mutational data to compute cosine similarities,
   * optionally performs double clustering to reorder the data, and then visualizes
   * the similarities using a Plotly heatmap. It also supports displaying a table
   * representation of the cosine similarity matrix alongside the heatmap.
   * @memberof mSigPortalPlots
   * @param {Object} groupedData - The input data object where keys represent sample names
   *   and values are objects representing mutational spectra. The mutational spectra
   *   should be represented as key-value pairs where keys are mutation types and values
   *   are counts or frequencies.
   *   Example:
   *   ```
   *   {
   *     'Sample1': {'C>A': 10, 'C>G': 15, 'C>T': 20, ...},
   *     'Sample2': {'C>A': 5, 'C>G': 8, 'C>T': 12, ...},
   *     ...
   *   }
   *   ```
   *   The range of keys (mutation types) should be consistent across all samples. The values
   *   (counts or frequencies) can be integers or floats, and their range can vary based on the
   *   underlying data, but typically they are non-negative.
   *
   * @param {string} [studyName="PCAWG"] - The name of the study. This is used in the
   *   title of the heatmap. Common values include study identifiers like "PCAWG",
   *   "TCGA", or specific project names. The parameter should be a string and can
   *   technically accept any string value, but it is intended to represent the name
   *   of a study or dataset.
   *
   * @param {string} [genomeDataType="WGS"] - The type of genomic data. This is also
   *   used in the title of the heatmap. Expected values typically include abbreviations
   *   for common genomic data types such as "WGS" (Whole Genome Sequencing), "WES"
   *   (Whole Exome Sequencing), "RNA-Seq", etc. Similar to `studyName`, any string
   *   is technically accepted, but the intended use is to describe the data type.
   *
   * @param {string} [cancerType="Lung-AdenoCA"] - The type of cancer. This is included
   *   in the title of the heatmap. Common values are standard cancer type
   *   abbreviations or names, like "Lung-AdenoCA" (Lung Adenocarcinoma), "BRCA"
   *   (Breast Invasive Carcinoma), etc. Any string value is accepted, but it should
   *   represent a specific cancer type.
   *
   * @param {string|HTMLElement} [divID="cosineSimilarityHeatMap"] - The target element or
   *   target element ID where the heatmap will be rendered. If an element with this ID does
   *   not exist, a detached element will be created and returned. Observable notebooks can
   *   render that returned element in the current cell.
   *
   * @param {boolean} [conductDoubleClustering=true] - A flag indicating whether to
   *   perform double clustering (hierarchical clustering on both rows and columns)
   *   on the cosine similarity matrix. If `true`, the rows and columns of the heatmap
   *   will be reordered based on the clustering. If `false`, the order of samples in
   *   `groupedData` will be maintained. Boolean values `true` or `false` are expected.
   *
   * @param {string} [colorscale="RdBu"] - The Plotly colorscale to use for the heatmap.
   *   This can be any valid Plotly colorscale name (e.g., "Viridis", "Greys", "YlGnBu",
   *   "RdBu"). Plotly provides a wide range of predefined colorscales. The chosen
   *   colorscale will affect the visual representation of the similarity values. Any
   *   string is accepted but it should correspond to a valid Plotly colorscale for
   *   optimal results.
   *
   * @param {boolean} [showTable=false] - A flag indicating whether to display a table
   *   representation of the cosine similarity matrix alongside the heatmap. If `true`,
   *   a table will be rendered next to the heatmap. If `false`, only the heatmap will
   *   be displayed. Boolean values `true` or `false` are expected.
   *
   * @returns {Promise<number[][]|HTMLElement>} A Promise that resolves to the cosine
   *   similarity matrix when rendering into an existing ID, or to the rendered element when a
   *   detached/provided element is used. Returned elements expose the matrix on
   *   `element.cosSimilarityMatrix` and `element.value`.
   *
   * @throws Will throw an error if the `cosineSimilarity` function or the
   *   `plotGraphWithPlotlyAndMakeDataDownloadable` function throws an error.
   *
   */

  async function plotCosineSimilarityHeatMap(
    groupedData,
    studyName = "PCAWG",
    genomeDataType = "WGS",
    cancerType = "Lung-AdenoCA",
    divID = "cosineSimilarityHeatMap",
    conductDoubleClustering = true,
    colorscale = "RdBu",
    showTable = false,
    options = {}
  ) {
    const {
      element: container,
      created,
      providedElement,
    } = resolvePlotContainer(divID);

    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = showTable ? 'row' : 'column';
    container.style.gap = '20px';
    container.style.width = '100%';
    container.style.alignItems = 'center'; // Center items vertically

    const heatmapDiv = document.createElement('div');
    heatmapDiv.id = `${container.id || "cosineSimilarityHeatMap"}-heatmap`;
    heatmapDiv.style.flex = showTable ? '1' : '1';
    container.appendChild(heatmapDiv);

    groupedData = extractMutationalSpectra(groupedData);
    let distanceMatrix = await createDistanceMatrix(
      Object.values(groupedData).map((data) => Object.values(data)),
      cosineSimilarity,
      true
    );

    let cosSimilarityMatrix = distanceMatrix.map(function (row) {
      return row.map(function (cell) {
        return 1 - cell;
      });
    });

    let reorderedData;
    if (conductDoubleClustering) {
      reorderedData = doubleClustering(
        cosSimilarityMatrix,
        Object.keys(groupedData),
        Object.keys(groupedData)
      );
    } else {
      reorderedData = {
        matrix: cosSimilarityMatrix,
        rowNames: Object.keys(groupedData),
        colNames: Object.keys(groupedData),
      };
    }

    let plotlyData = [
      {
        z: reorderedData.matrix,
        x: reorderedData.rowNames,
        y: reorderedData.colNames,
        type: "heatmap",
        colorscale: colorscale,
      },
    ];

    const containerWidth = container.offsetWidth || container.clientWidth || 800;
    let layout = {
      title: `${studyName} ${cancerType} ${genomeDataType} Cosine Similarity Heatmap`,
      height: 800,
      width: showTable ? containerWidth * 0.6 : containerWidth,
      xaxis: {
        title: "Sample",
        type: "category",
        nticks: Object.keys(groupedData).length,
      },
      yaxis: {
        title: "Sample",
        type: "category",
        nticks: Object.keys(groupedData).length,
      },
    };

    plotGraphWithPlotlyAndMakeDataDownloadable(heatmapDiv, plotlyData, layout, {
      ...(options.publication || {}),
      context: mergeFigureContext(options.figureContext, {
        dataset: studyName,
        cancerType,
        strategy: genomeDataType,
        samples: Object.keys(groupedData).length,
        metric: "cosine similarity",
        clustering: conductDoubleClustering ? "double hierarchical" : "input order",
      }),
    });

    if (showTable) {
      const tableDiv = document.createElement('div');
      tableDiv.id = `${container.id || "cosineSimilarityHeatMap"}-table`;
      tableDiv.style.flex = '1';
      tableDiv.style.overflowX = 'auto';
      tableDiv.style.display = 'flex';  // Add flex display
      tableDiv.style.alignItems = 'center';  // Center vertically
      tableDiv.style.height = '800px';  // Match heatmap height
      container.appendChild(tableDiv);

      const tableWrapper = document.createElement('div');  // Add wrapper for table
      tableWrapper.style.width = '100%';
      tableDiv.appendChild(tableWrapper);

      const table = document.createElement('table');
      table.style.borderCollapse = 'collapse';
      table.style.width = '100%';
      table.style.fontSize = '12px';

      // Create header row with simple styling
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = '<th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa;">Sample</th>';
      reorderedData.colNames.forEach(colName => {
        headerRow.innerHTML += `<th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa;">${colName}</th>`;
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Create table body with simple styling
      const tbody = document.createElement('tbody');
      reorderedData.matrix.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${reorderedData.rowNames[rowIndex]}</td>`;
        row.forEach(value => {
          const formattedValue = value.toFixed(3);
          tr.innerHTML += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formattedValue}</td>`;
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
    }

    container.cosSimilarityMatrix = cosSimilarityMatrix;
    container.value = cosSimilarityMatrix;

    if (created || providedElement) {
      return container;
    }

    return cosSimilarityMatrix;
  }

  /**
   * @memberof mSigPortalPlots
   * @function plotSignatureActivityDataBy
   * @description Generates a box plot of signature activity data, grouped by a specified attribute. The function takes a dataset and groups it by the provided attribute (e.g., "signatureName", "study", "cancerType"). For each group, it creates a box trace where the y-values represent the log10 of the exposure values and the x-values are set to the group name. The box plot displays the distribution of exposure values for each group, with the option to show all individual data points (jittered for better visibility). Hovering over the data points reveals the sample name and the log10 of the exposure value. The plot also indicates the fraction of samples within each group that have non-zero exposure.
   *
   * @param {string} divID - The ID of the div element where the plot will be rendered.
   * @param {Array<object>} data - An array of objects representing the signature activity data. Each object must have at least the following properties:
   *   - `exposure`: A numeric value representing the exposure of a signature. It can be any positive number or zero.
   *   - `sample`: A string representing the sample ID.
   *   - The `data` array must also contain a property matching the name specified by the `group` parameter (e.g., "signatureName", "study", "cancerType").
   * @param {string} [group="signatureName"] - The attribute to group the data by. Possible values are any property name present in the data objects, including, but not limited to:
   *   - `"signatureName"`: Groups the data by signature names.
   *   - `"study"`: Groups the data by study IDs.
   *   - `"cancerType"`: Groups the data by cancer types.
   *   - `"sample"`: Groups the data by sample IDs (Note: this might not result in a meaningful box plot).
   *   - Any other custom property that exists in the data objects.
   *   The default value is `"signatureName"`.
   * @return {void} - This function does not return a value. It directly renders the plot in the specified `divID`.
   */
  function plotSignatureActivityDataBy(divID, data, group = "signatureName", options = {}) {
    // Group the data by the specified group using the groupBy function
    const groupedData = groupBy(data, group);

    // Create an array of box trace objects for each group
    const groupTraces = Object.keys(groupedData).map((groupName) => {
      const exposures = groupedData[groupName].map((d) =>
        Math.log10(d.exposure)
      );
      const samples = groupedData[groupName].map((d) => d.sample);
      const numNonZero = exposures.filter(
        (exposure) => exposure !== -Infinity
      ).length;
      return {
        y: exposures,
        x: new Array(exposures.length).fill(groupName),
        type: "box",
        name: groupName,
        boxpoints: "all",
        jitter: 0.3,
        hovertext: samples,
        hovertemplate:
          `<b>${groupName}</b><br>Log(Exposure): %{y:.2f}<br>` +
          `Fraction of samples with non-zero exposure: ${numNonZero} / ${exposures.length}`,
      };
    });

    // Plot the box traces using Plotly and display the plot in the specified divID
    plotGraphWithPlotlyAndMakeDataDownloadable(
      divID,
      groupTraces,
      {
        title: `Cumulative Exposure for ${group}`,
        yaxis: { title: "Log(Exposure)" },
        xaxis: { title: group },
      },
      {
        ...(options.publication || {}),
        context: mergeFigureContext(options.figureContext, {
          dataset: options.dataset || "Signature activity rows",
          groupedBy: group,
          samples: new Set((data || []).map((row) => row.sample).filter(Boolean)).size,
          metric: "log10 exposure",
        }),
      }
    );
  }

  /**
   * @memberof mSigPortalPlots
   * @function plotForceDirectedTree
   * @description This function generates and displays a force-directed tree representing the relationships between patients in a study based on their mutational spectra. It calculates the cosine similarity between the mutational spectra of patients, performs hierarchical clustering based on these similarities, and then visualizes the resulting clusters as a force-directed tree.
   *
   * @param {object} groupedData - An object where keys represent sample IDs and values are objects containing mutational spectra data. The structure of `groupedData` is expected to be:
   *   `{ sampleId1: { mutationType1: count1, mutationType2: count2, ... }, sampleId2: { mutationType1: count3, mutationType2: count4, ... }, ... }`
   *   The inner objects (e.g., `{ mutationType1: count1, ... }`) represent the mutational spectrum for a given sample. `mutationType` keys can be any string representing a type of mutation (e.g., "C>A", "T>G"), and `count` values are non-negative integers representing the number of times that mutation type is observed in the sample.
   * @param {string} [studyName="PCAWG"] - The name of the study. This is used for labeling purposes in the visualization. Common values include, but are not limited to:
   *   - `"PCAWG"`
   *   - `"TCGA"`
   *   - Any other string representing a specific study.
   * @param {string} [genomeDataType="WGS"] - The type of genome data used. This is also used for labeling purposes. Possible values include:
   *   - `"WGS"`: Whole Genome Sequencing
   *   - `"WES"`: Whole Exome Sequencing
   *   - `"RNA-Seq"`: RNA Sequencing
   * @param {string} [cancerType="Lung-AdenoCA"] - The type of cancer being studied. This is used for labeling in the visualization. Examples include:
   *   - `"Lung-AdenoCA"`: Lung Adenocarcinoma
   *   - `"Breast-AdenoCA"`: Breast Adenocarcinoma
   *   - Any valid cancer type identifier.
   * @param {string} [divID="forceDirectedTree"] - The ID of the HTML div element where the force-directed tree will be rendered.
   * @return {object} - Returns the formatted hierarchical clusters used to generate the force-directed tree. The structure of this object is compatible with the AM5 charting library and represents the hierarchical relationships between samples based on their mutational spectra. The format is a nested object where each level represents a node in the tree. Each node can have properties such as `name`, `value`, `children` (an array of child nodes), and potentially others added during formatting.
   */

  // This function plots a force directed tree of the patients in the study based on their mutational spectra
  async function plotForceDirectedTree(
    groupedData,
    studyName = "PCAWG",
    genomeDataType = "WGS",
    cancerType = "Lung-AdenoCA",
    divID = "forceDirectedTree",
    options = {}
  ) {
    groupedData = extractMutationalSpectra(groupedData);
    let distanceMatrix = await createDistanceMatrix(
      Object.values(groupedData).map((data) => Object.values(data)),
      cosineSimilarity,
      true
    );

    let clusters = await hierarchicalClustering(
      distanceMatrix,
      Object.keys(groupedData)
    );

    let formattedClusters = formatHierarchicalClustersToAM5Format(
      clusters,
      studyName,
      genomeDataType,
      cancerType,
      Object.keys(groupedData).length,
      groupedData
    );

    const { chart, publication } = createD3PlotFrame(divID, {
      title: "Mutational spectrum similarity tree",
      subtitle:
        "Force-directed hierarchy from pairwise cosine distances between sample spectra.",
      badges: [
        { label: "Dataset", value: studyName },
        { label: "Samples", value: Object.keys(groupedData).length },
        { label: "Metric", value: "cosine distance" },
      ],
      figureContext: mergeFigureContext(options.figureContext, {
        dataset: studyName,
        cancerType,
        strategy: genomeDataType,
        samples: Object.keys(groupedData).length,
      }),
      publication: options.publication,
      maxWidth: "1120px",
    });
    const treeDiv = document.createElement("div");
    treeDiv.id = `${typeof divID === "string" ? divID : "forceDirectedTree"}-chart-${Math.random()
      .toString(36)
      .slice(2)}`;
    treeDiv.style.width = "100%";
    treeDiv.style.height = "600px";
    treeDiv.style.maxWidth = "100%";
    chart.appendChild(treeDiv);
    addStandaloneJsonDownloadControls(
      chart,
      figurePublicationPayload(publication, { data: formattedClusters }),
      publication.title
    );

    generateForceDirectedTree(formattedClusters, treeDiv.id);

    return formattedClusters;
  }

  async function generateForceDirectedTree(data, divID) {
    // Create root element
    // https://www.amcharts.com/docs/v5/getting-started/#Root_element
    var root = am5.Root.new(divID);

    // Set themes
    // https://www.amcharts.com/docs/v5/concepts/themes/
    root.setThemes([am5themes_Animated.default.new(root)]);

    // Create wrapper container
    var container = root.container.children.push(
      am5.Container.new(root, {
        width: am5.percent(100),
        height: am5.percent(100),
        layout: root.verticalLayout,
      })
    );

    // Create series
    // https://www.amcharts.com/docs/v5/charts/hierarchy/#Adding
    var series = container.children.push(
      am5hierarchy.ForceDirected.new(root, {
        singleBranchOnly: false,
        downDepth: 2,
        initialDepth: 2,
        valueField: "totalMutationCount",
        categoryField: "name",
        childDataField: "children",
        minRadius: 20,
        maxRadius: 80,
        centerStrength: 0.5,
      })
    );

    series.nodes.template._settings.tooltipText =
      "Total Mutations: {totalMutationCount}";
    series.adapters.add("fill", function (fill, target) {
      return fill.lighten(target.dataItem.level * 0.25);
    });

    series.data.setAll([data]);
    series.set("selectedDataItem", series.dataItems[0]);

    series.appear(1000, 100);
  }

  //#endregion

  //#region Visualizes a set of mutational spectra using UMAP.


  /**
 * @memberof mSigPortalPlots
 * @function plotUMAPVisualization
 * @description Generates a UMAP (Uniform Manifold Approximation and Projection) visualization of mutational spectra data. UMAP is a dimensionality reduction technique used to project high-dimensional data into a lower-dimensional space (typically 2D or 3D) while preserving the global structure of the data. This function takes mutational spectra data, applies UMAP to reduce its dimensionality, and then creates either a 2D or 3D scatter plot to visualize the results. If `nComponents` is set to 3, it additionally generates a mesh3d trace to highlight the density of points in the 3D space.
 *
 * @param {object} data - An object representing the mutational spectra data. The structure of `data` is expected to be:
 *   `{ sampleId1: { mutationType1: count1, mutationType2: count2, ... }, sampleId2: { mutationType1: count3, mutationType2: count4, ... }, ... }`
 *   The outer keys (e.g., `sampleId1`, `sampleId2`) are sample identifiers (strings). The inner objects (e.g., `{ mutationType1: count1, ... }`) represent the mutational spectrum for a given sample. `mutationType` keys can be any string representing a type of mutation (e.g., "C>A", "T>G"), and `count` values are non-negative integers representing the number of times that mutation type is observed in the sample.
 * @param {string} [datasetName="PCAWG"] - The name of the dataset being visualized. This is used as part of the plot title. Examples include:
 *   - `"PCAWG"`
 *   - `"TCGA"`
 *   - Any other string that appropriately identifies the dataset.
 * @param {string} divID - The ID of the HTML div element where the plot will be rendered.
 * @param {number} [nComponents=3] - The number of dimensions to reduce the data to using UMAP. This determines whether a 2D or 3D plot is generated. Possible values are:
 *   - `2`: Generates a 2D scatter plot.
 *   - `3`: Generates a 3D scatter plot with an additional mesh3d trace.
 *   Any other positive integer is technically permissible but may not yield meaningful visualizations.
 * @param {number} [minDist=0.1] - The effective minimum distance between embedded points in the UMAP projection. Smaller values result in a more clustered embedding, while larger values preserve more of the global structure. The valid range is between 0.0 and 1.0.
 * @param {number} [nNeighbors=15] - The number of neighboring points to consider when constructing the UMAP. Larger values capture more global structure in the data, while smaller values preserve more local structure. Values should be positive integers, typically in the range of 2 to 100.
 * @return {object} - Returns the trace object used by Plotly to generate the visualization. This object contains the data points, plot type, marker settings, and, in the case of a 3D plot, the mesh3d settings. The structure depends on the value of `nComponents`.
 */
  async function plotUMAPVisualization(
    data,
    datasetName = "PCAWG",
    divID,
    nComponents = 3,
    minDist = 0.1,
    nNeighbors = 15,
    options = {}
  ) {
    data = extractMutationalSpectra(data);
    let umap = new UMAP.default.UMAP({
      nComponents: nComponents,
      minDist: minDist,
      nNeighbors: nNeighbors,
    });
    let embeddings = await umap.fit(
      Object.values(data).map((data) => Object.values(data))
    );
    let plotType = nComponents === 3 ? "scatter3d" : "scatter";
    let axisLabels = nComponents === 3 ? ["X", "Y", "Z"] : ["X", "Y"];

    let trace = [
      {
        x: embeddings.map((d) => d[0]),
        y: embeddings.map((d) => d[1]),
        text: Object.keys(data),
        mode: "markers",
        type: plotType,
        marker: { size: 6 },
      },
    ];

    if (nComponents === 3) {
      trace[0].z = embeddings.map((d) => d[2]);

      trace.push({
        alphahull: 7,
        opacity: 0.1,
        type: "mesh3d",
        x: embeddings.map((d) => d[0]),
        y: embeddings.map((d) => d[1]),
        z: embeddings.map((d) => d[2]),
      });
    }

    let layout = {
      title: `${nComponents} Component UMAP Projection of ${datasetName} Dataset`,
      xaxis: { title: axisLabels[0] },
      yaxis: { title: axisLabels[1] },
    };

    if (nComponents === 3) {
      layout.scene = { zaxis: { title: axisLabels[2] } };
    }

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, trace, layout, {
      ...(options.publication || {}),
      context: mergeFigureContext(options.figureContext, {
        dataset: datasetName,
        samples: Object.keys(data).length,
        dimensions: nComponents,
        minDist,
        nNeighbors,
      }),
    });

    return trace;
  }

  //#endregion

  //#region Signature Fitting

  /**
   * Fits mutational spectra to known mutational signatures using non-negative least squares (NNLS).
   *
   * This function calculates the exposure of mutational signatures for each sample by fitting
   * the observed mutational spectra to the reference mutational signatures. It then filters out
   * signatures whose contribution is below a fraction of the total exposure, by setting their
   * exposures to zero.
   *
   * You can choose to return exposures as absolute values (raw counts from NNLS) or relative values
   * (sum to 1 for each sample). The filtering threshold is a fraction between 0 and 1.
   *
   * @async
   * @function fitMutationalSpectraToSignatures
   * @memberof machineLearning
   * @param {Object} mutationalSignatures - Reference mutational signatures. Each key is a signature name,
   * and each value is an object of mutation types (e.g., {"C>A": weight, "C>G": weight}).
   * @param {Object} mutationalSpectra - Mutational spectra for each sample. Each key is a sample ID,
   * and each value is an object of mutation types with their counts (e.g., {"C>A": count, "C>G": count}).
   * @param {Object} [options] - Configuration options for filtering and output.
   * @param {number} [options.exposureThreshold=0] - Exclude signatures below this fraction of the total,
   * by setting their exposures to zero. Must be between 0 and 1.
   * @param {("absolute"|"relative")} [options.exposureType="relative"] - Return exposures as absolute or relative.
   * @param {boolean} [options.renormalize=true] - Whether to normalize exposures so that they sum to 1 after filtering.
   * @returns {Object} - An object with sample IDs as keys. Each value is an object of signature exposures.
   *
   * @example
   * // Example usage:
   * // 1. Get mutational signatures (e.g., from the mSigPortal API)
   * const mutationalSignatures = await mSigPortal.mSigPortalData.getMutationalSignaturesData(
   *   "WGS", "COSMIC_v3_Signatures_GRCh37_SBS96", "SBS", 96, 1000
   * );
   *
   * // 2. Extract mutational spectra for each sample
   * const extractedSpectra = await mSigPortal.mSigPortalData.extractMutationalSpectra(
   *   mutationalSignatures, "signatureName"
   * );
   *
   * // 3. Fit spectra to signatures with post-fit filtering
   * const nnlsExposures = await mSigPortal.signatureFitting.fitMutationalSpectraToSignatures(
   *   mutationalSignatures,
   *   extractedSpectra,
   *   {
   *     exposureThreshold: 0.1,
   *     exposureType: "relative",
   *     renormalize: true
   *   }
   * );
   *
   * console.log(nnlsExposures);
   * // {
   * //   Sample1: { SBS1: 0.75, SBS2: 0.25, SBS3: 0 },
   * //   Sample2: { SBS1: 0.9, SBS2: 0.1, SBS3: 0 },
   * //   ...
   * // }
   */
  async function fitMutationalSpectraToSignatures(
    mutationalSignatures,
    mutationalSpectra,
    {
      exposureThreshold = 0,
      exposureType = "relative",
      renormalize = true
    } = {}
  ) {
    // Validate the threshold
    if (exposureThreshold < 0 || exposureThreshold > 1) {
      throw new Error("exposureThreshold must be between 0 and 1.");
    }

    const signatureNames = Object.keys(mutationalSignatures);
    const sampleNames = Object.keys(mutationalSpectra);

    // Convert reference signatures to arrays for NNLS
    const nnlsInputSignatures = Object.values(mutationalSignatures).map(signatureData =>
      Object.values(signatureData)
    );

    // Convert mutational spectra to arrays for NNLS
    const nnlsInputMatrix = Object.values(mutationalSpectra).map(spectrumData =>
      Object.values(spectrumData)
    );

    const results = {};

    for (let i = 0; i < sampleNames.length; i++) {
      const sampleName = sampleNames[i];
      const nnlsInput = nnlsInputMatrix[i];

      // 1. Perform NNLS
      const nnlsOutput = await nnls(nnlsInputSignatures, nnlsInput);
      const exposureValues = nnlsOutput.x;
      delete nnlsOutput.x;

      // 2. Build an object of signature exposures (raw from NNLS)
      let sampleExposures = {};
      for (let j = 0; j < signatureNames.length; j++) {
        sampleExposures[signatureNames[j]] = exposureValues[j];
      }

      // 3. Calculate the total exposure
      const totalExposure = Object.values(sampleExposures).reduce((acc, val) => acc + val, 0);

      // 4. Filter out signatures below the fraction threshold by setting to 0
      if (totalExposure > 0) {
        for (let signature of signatureNames) {
          const fraction = sampleExposures[signature] / totalExposure;
          if (fraction < exposureThreshold) {
            sampleExposures[signature] = 0;
          }
        }
      }

      // 5. If renormalize is true, adjust exposures to sum to 1
      if (renormalize) {
        const filteredTotal = Object.values(sampleExposures).reduce((a, b) => a + b, 0);
        if (filteredTotal > 0) {
          for (let signature of signatureNames) {
            sampleExposures[signature] = sampleExposures[signature] / filteredTotal;
          }
        }
      }

      // 6. If returning relative exposures, ensure they sum to 1
      if (exposureType === "relative" && !renormalize) {
        const filteredTotal = Object.values(sampleExposures).reduce((a, b) => a + b, 0);
        if (filteredTotal > 0) {
          for (let signature of signatureNames) {
            sampleExposures[signature] = sampleExposures[signature] / filteredTotal;
          }
        }
      }

      // 7. Store the final exposures for each sample
      results[sampleName] = sampleExposures;
    }

    return results;
  }


  /**
   * @memberof mSigPortalPlots
   * @function plotPatientMutationalSignaturesExposure
   * @description Generates a pie chart visualizing the exposure of a single sample to a set of mutational signatures. The function takes exposure data, which includes the relative contribution of each signature to the sample's mutational profile, and displays it in a pie chart format.
   *
   * @param {object} exposureData - An object containing exposure data for either a set of samples or a single sample. The structure of `exposureData` can be:
   *   `{ sampleId1: { signatureName1: exposureValue1, signatureName2: exposureValue2, ... }, sampleId2: { signatureName1: exposureValue3, signatureName2: exposureValue4, ... }, ... }`
   *   or a single sample object:
   *   `{ signatureName1: exposureValue1, signatureName2: exposureValue2, ... }`.
   *   The outer keys (e.g., `sampleId1`, `sampleId2`) are sample identifiers (strings). The inner objects (e.g., `{ signatureName1: exposureValue1, ... }`) represent the exposure values for a given sample. `signatureName` keys are strings representing the names of mutational signatures (e.g., "SBS1", "SBS5"), and `exposureValue` are non-negative numbers representing the contribution of that signature to the sample. These values typically sum to 1 for each sample. The `exposureData` object can contain multiple samples, but only the data for the specified `sample` will be used for plotting. Each sample may also have an optional `rnorm` property which is a number.
   * @param {string} divID - The ID of the HTML div element where the pie chart will be rendered.
   * @param {string} sample - The ID of the sample for which to plot the mutational signature exposure. This should be one of the keys in the `exposureData` object (e.g., "sampleId1", "sampleId2").
   * @return {object} - Returns the data object used by Plotly to generate the pie chart. This object contains the labels (signature names), values (exposure values), and other settings for the pie chart. The format is:
   *   `{ labels: [signatureName1, signatureName2, ...], values: [exposureValue1, exposureValue2, ...], name: "sample exposure values", textposition: "inside", hole: 0.4, hoverinfo: "name + value", type: "pie" }`
   */
  // This function plots the exposure of a set of samples to a set of mutational signatures
  async function plotPatientMutationalSignaturesExposure(
    exposureData,
    divID,
    sample,
    options = {}
  ) {
    if (!exposureData || typeof exposureData !== "object") {
      return renderPlotError(divID, "exposureData must be an object.");
    }

    const dataset = deepCopy(exposureData);
    const isExposureRecord = (value) =>
      value && typeof value === "object" && !Array.isArray(value);

    const normalizeExposureValue = (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === "string" && value.trim() !== "") {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
          return numericValue;
        }
      }

      return null;
    };

    const getSignatureExposures = (value) => {
      if (!isExposureRecord(value)) {
        return null;
      }

      const signatureEntries = Object.entries(value)
        .filter(([signature]) => signature !== "rnorm")
        .map(([signature, exposure]) => [
          signature,
          normalizeExposureValue(exposure),
        ])
        .filter(([, exposure]) => exposure !== null);

      if (signatureEntries.length === 0) {
        return null;
      }

      return Object.fromEntries(signatureEntries);
    };

    const getRnormLabel = (value) => {
      const normalizedRnorm = normalizeExposureValue(value);
      return normalizedRnorm === null ? "not available" : normalizedRnorm;
    };

    const sampleDataFromDataset =
      sample && isExposureRecord(dataset[sample]) ? dataset[sample] : null;
    const sampleDataset = sampleDataFromDataset || dataset;
    const signatureExposures = getSignatureExposures(sampleDataset);

    if (!signatureExposures) {
      return renderPlotError(
        divID,
        sample
          ? `no exposure data available for ${sample}.`
          : "no exposure data available."
      );
    }

    const plotType = "pie";
    const rnormLabel = getRnormLabel(sampleDataset.rnorm);
    const plotTitle = `Mutational Signature Exposure for ${sample} (r-norm = ${rnormLabel})`;

    let data = {
      labels: Object.keys(signatureExposures),
      values: Object.values(signatureExposures),
      name: `${sample} exposure values`,
      textposition: "inside",
      hole: 0.4,
      hoverinfo: "name + value",
      type: plotType,
    };

    let layout = {
      title: plotTitle,
    };

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, [data], layout, {
      ...(options.publication || {}),
      context: mergeFigureContext(options.figureContext, {
        dataset: options.dataset || "Exposure matrix",
        sample: sample || "single sample input",
        signatureCatalog: options.signatureCatalog || options.catalog,
        signatures: Object.keys(signatureExposures).length,
        rnorm: rnormLabel,
      }),
    });

    return data;
  }

  /**
   * @memberof mSigPortalPlots
   * @function plotDatasetMutationalSignaturesExposure
   * @description Generates a heatmap visualizing the exposure of multiple samples to a set of mutational signatures within a dataset. The function provides options for displaying relative or absolute exposure values and for performing double hierarchical clustering to reorder the rows and columns of the heatmap. It also allows customization of the color scale used to represent exposure values.
   *
   * @param {object} exposureData - An object containing the exposure data for a set of samples. The structure of `exposureData` is expected to be:
   *   `{ sampleId1: { signatureName1: exposureValue1, signatureName2: exposureValue2, ..., rnorm: number }, sampleId2: { signatureName1: exposureValue3, signatureName2: exposureValue4, ..., rnorm: number }, ... }`
   *   The outer keys (e.g., `sampleId1`, `sampleId2`) are sample identifiers (strings). The inner objects (e.g., `{ signatureName1: exposureValue1, ... }`) represent the exposure values for a given sample. `signatureName` keys are strings representing the names of mutational signatures (e.g., "SBS1", "SBS5"), and `exposureValue` are non-negative numbers representing the contribution of that signature to the sample. `rnorm` is a number that will be removed from the data before plotting.
   * @param {string} divID - The ID of the HTML div element where the heatmap will be rendered.
   * @param {boolean} [relative=true] - A boolean indicating whether to display relative or absolute exposure values.
   *   - `true`: The exposure values for each sample are normalized to sum to 1, representing the relative contribution of each signature.
   *   - `false`: The raw exposure values are displayed.
   * @param {string} [datasetName="PCAWG"] - The name of the dataset being visualized. This is used as part of the plot title. Examples include:
   *   - `"PCAWG"`
   *   - `"TCGA"`
   *   - Any other string that appropriately identifies the dataset.
   * @param {boolean} [doubleCluster=true] - A boolean indicating whether to perform double hierarchical clustering on the exposure data.
   *   - `true`: The rows and columns of the heatmap are reordered based on the results of double clustering, which groups similar samples and signatures together.
   *   - `false`: The rows and columns are displayed in the order they appear in the input `exposureData`.
   * @param {string | Array} [colorscale="Custom"] - The color scale to use for the heatmap. Possible values are:
   *   - `"Custom"`: A predefined custom color scale designed for visualizing exposure data.
   *   - Any valid Plotly color scale name (e.g., `"Viridis"`, `"Blues"`, `"Hot"`, etc.).
   *   - An array of arrays defining a custom color scale, where each inner array specifies a color stop with a value between 0 and 1 and a corresponding RGB color string (e.g., `[["0.0", "rgb(49,54,149)"], ["1.0", "rgb(165,0,38)"]]`).
   * @return {object} - Returns the data object used by Plotly to generate the heatmap. This object contains the z values (exposure values), x values (signature names), y values (sample names), and other settings for the heatmap, including the color scale. The structure is:
   *   `{ z: [[exposureValue1, exposureValue2, ...], [exposureValue3, exposureValue4, ...], ...], x: [signatureName1, signatureName2, ...], y: [sampleId1, sampleId2, ...], type: "heatmap", colorscale: colorscale }`
   */
  async function plotDatasetMutationalSignaturesExposure(
    exposureData,
    divID,
    relative = true,
    datasetName = "PCAWG",
    doubleCluster = true,
    colorscale = "Custom",
    options = {}
  ) {
    let dataset = deepCopy(exposureData);
    // Remove the rnorm values from each sample of the exposure data

    for (let sample in dataset) {
      delete dataset[sample]["rnorm"];
    }

    if (relative) {
      for (let sample in dataset) {
        let total = 0;
        for (let signature in dataset[sample]) {
          total += dataset[sample][signature];
        }
        for (let signature in dataset[sample]) {
          dataset[sample][signature] /= total;
        }
      }
    }
    let reorderedData;
    if (doubleCluster) {
      reorderedData = doubleClustering(
        Object.values(dataset).map((data) => Object.values(data)),
        Object.keys(dataset),
        Object.keys(dataset[Object.keys(dataset)[0]])
      );
    } else {
      console.log("data is not ordered");
      reorderedData = {
        matrix: Object.values(dataset).map((data) => Object.values(data)),
        rowNames: Object.keys(dataset),
        colNames: Object.keys(dataset[Object.keys(dataset)[0]]),
      };
    }
    if (colorscale == "custom") {
      colorscale = [
        ["0.0", "rgb(49,54,149)"],
        ["0.025", "rgb(69,117,180)"],
        ["0.05", "rgb(116,173,209)"],
        ["0.075", "rgb(171,217,233)"],
        ["0.1", "rgb(224,243,248)"],
        ["0.125", "rgb(254,224,144)"],
        ["0.15", "rgb(253,174,97)"],
        ["0.175", "rgb(244,109,67)"],
        ["0.2", "rgb(215,48,39)"],
        ["1.0", "rgb(165,0,38)"],
      ];
    }

    let data = {
      z: reorderedData.matrix,
      x: reorderedData.colNames,
      y: reorderedData.rowNames,
      type: "heatmap",
      colorscale: colorscale,
    };

    let layout = {
      title: `Mutational Signature Exposure for ${datasetName} Dataset`,
      xaxis: {
        title: "Samples",
        nticks: Object.keys(dataset[Object.keys(dataset)[0]]).length,
      },
      yaxis: {
        title: "Mutational Signatures",
        nticks: Object.keys(dataset).length,
      },
      height: 800,
    };

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, [data], layout, {
      ...(options.publication || {}),
      context: mergeFigureContext(options.figureContext, {
        dataset: datasetName,
        samples: Object.keys(dataset).length,
        signatures: Object.keys(dataset[Object.keys(dataset)[0]] || {}).length,
        scale: relative ? "relative exposure" : "raw exposure",
        clustering: doubleCluster ? "double hierarchical" : "input order",
        signatureCatalog: options.signatureCatalog || options.catalog,
      }),
    });

    return data;
  }

  /**
   * @memberof mSigPortalPlots
   * @function plotSignatureAssociations
   * @description This function generates and plots a scatter plot with marginal histograms, along with statistical analysis, to visualize the association between two mutational signatures. It calculates and displays the linear regression line, Pearson correlation, and Spearman correlation, providing insights into the relationship between the exposures of two signatures in a set of samples.
   *
   * @param {string} divID - The ID of the HTML div element where the plot will be rendered.
   * @param {object} data - An array of objects representing the exposure data for a set of samples. Each object in the array should have the following properties:
   *   - `sample`: A string representing the sample ID.
   *   - `signatureName`: A string representing the name of the mutational signature.
   *   - `exposure`: A numeric value representing the exposure of the signature in the sample.
   * @param {string} signature1 - The name of the first mutational signature. This should match the `signatureName` values in the `data` array. The values can be any valid signature name present in the dataset, for example, "SBS1", "SBS5", "DBS1", "ID4".
   * @param {string} signature2 - The name of the second mutational signature. This should also match the `signatureName` values in the `data` array. Similar to `signature1`, the values can be any signature name present in the dataset and can also be the same as `signature1` to assess the distribution of a single signature.
   * @return {void} - This function does not return a value. It directly renders the plot in the specified `divID`.
   */
  /**
   * @memberof mSigPortalPlots
   * @function MsAssociation
   * @description Calculates the association between two mutational signatures across a set of samples. It computes the linear regression, Pearson correlation, and Spearman correlation between the log-transformed exposures of the two signatures. The results are used to generate a scatter plot with marginal histograms, visualizing the relationship between the signatures.
   *
   * @param {object[]} data - An array of objects representing the exposure data for a set of samples. Each object in the array should have the following properties:
   *   - `sample`: A string representing the sample ID.
   *   - `signatureName`: A string representing the name of the mutational signature.
   *   - `exposure`: A numeric value representing the exposure of the signature in the sample. This value can theoretically range from 0 to infinity, although in practice, values are often normalized.
   * @param {string} signatureName1 - The name of the first mutational signature. This should match the `signatureName` values in the `data` array.
   * @param {string} signatureName2 - The name of the second mutational signature. This should also match the `signatureName` values in the `data` array. It can be the same as `signatureName1`.
   * @param {boolean} [both=false] - A boolean flag indicating whether to filter the data to include only samples where both signatures have non-zero exposure.
   *   - `true`: Only samples with non-zero exposure to both signatures are included in the analysis. If `signatureName1` and `signatureName2` are the same, then no filtering occurs.
   *   - `false`: All samples are included in the analysis, regardless of whether they have non-zero exposure to both signatures.
   * @return {object} - Returns an object containing the traces and layout for a Plotly plot.
   *   - `traces`: An array of trace objects to be used in a Plotly plot. This includes the main scatter plot trace, the linear regression line trace, and two marginal histogram traces.
   *   - `layout`: An object containing the layout configuration for a Plotly plot, including title, axis labels, annotations, and other visual properties.
   */

  function plotSignatureAssociations(divID, data, signature1, signature2, options = {}) {
    let dat = plotSignatureAssociation(data, signature1, signature2);
    plotGraphWithPlotlyAndMakeDataDownloadable(divID, dat.traces, dat.layout, {
      ...(options.publication || {}),
      context: mergeFigureContext(options.figureContext, {
        dataset: options.dataset || "Signature exposure rows",
        signatures: `${signature1} and ${signature2}`,
        samples: new Set((data || []).map((row) => row.sample).filter(Boolean)).size,
        metric: "signature exposure association",
      }),
    });
  }

  /**
 * @memberof mSigPortalPlots
 * @function plotMSPrevalenceData
 * @description This function is a wrapper around the `plotMSPrevalence` function. It takes the output of `plotMSPrevalence` and uses it to generate a Plotly plot, which is then displayed in a specified div. The plot visualizes the prevalence of mutational signatures.
 *
 * @param {string} divID - The ID of the div element where the plot will be rendered.
 * @param {object} data - An object representing the mutational signature prevalence data. The `data` object is expected to be an array of objects with the following structure:
 *   `[{ signatureName: "SBS1", sample: "sample1", exposure: 10, burden: 5 }, { signatureName: "SBS5", sample: "sample1", exposure: 20, burden: 5 }, ... ]`
 *   Where `signatureName` is the name of a mutational signature (string), `sample` is a sample identifier (string), `exposure` is a non-negative number representing the exposure of that signature in the sample, and `burden` is a numeric value representing the mutational burden for the sample.
 * @return {void} - This function does not return a value. It directly renders the plot in the specified `divID`.
 */
  /**
   * @memberof mSigPortalPlots
   * @function MSPrevalence
   * @description Calculates and visualizes the prevalence of mutational signatures across a set of samples, grouped by cancer type. The function generates two plots: a pie chart showing the overall prevalence of each signature based on total mutations (exposure) and a bar chart displaying the frequency of each signature across samples, considering a minimum exposure threshold.
   *
   * @param {object} data - An object representing the mutational signature prevalence data. The `data` object is expected to be an array of objects with the following structure:
   *   `[{ signatureName: "SBS1", sample: "sample1", exposure: 10, burden: 5 }, { signatureName: "SBS5", sample: "sample1", exposure: 20, burden: 5 }, ... ]`
   *   Where `signatureName` is the name of a mutational signature (string), `sample` is a sample identifier (string), `exposure` is a non-negative number representing the exposure of that signature in the sample (can be 0), and `burden` is a numeric value representing the mutational burden for the sample (must be a number).
   * @param {number|null|undefined} minimum - The minimum exposure value for a signature in a sample to be considered prevalent in that sample. Samples with exposure below this threshold are not counted in the frequency calculation for the bar chart. If `minimum` is `null` or `undefined`, it defaults to 100.
   *   - `null` or `undefined`: Sets the minimum exposure to 100.
   *   - Any positive number: Sets the minimum exposure to that number.
   * @return {{traces: object[], layout: object}} - Returns an object containing the `traces` and `layout` for a Plotly plot.
   *   - `traces`: An array of trace objects. If the maximum frequency of signatures (considering the `minimum` threshold) is less than 1%, the array contains only a single pie chart trace. Otherwise, it contains a pie chart trace followed by multiple bar chart traces (one for each signature).
   *   - `layout`: An object defining the layout of the plot, including title annotations, axis settings, and overall appearance. It includes conditional logic to handle cases where no signature has a frequency greater than 1%.
   */

  function plotMSPrevalenceData(divID, data, options = {}) {
    let dat = plotMSPrevalence(data);
    plotGraphWithPlotlyAndMakeDataDownloadable(divID, dat.traces, dat.layout, {
      ...(options.publication || {}),
      context: mergeFigureContext(options.figureContext, {
        dataset: options.dataset || "Signature prevalence rows",
        samples: new Set((data || []).map((row) => row.sample).filter(Boolean)).size,
        signatures: new Set((data || []).map((row) => row.signatureName).filter(Boolean)).size,
        metric: "prevalence by exposure threshold",
      }),
    });
  }

  /**
   * Renders a D3 mutation-burden QC summary for sample spectra.
   *
   * @function plotMutationBurdenSummary
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} burdenSummary - Result from mSigSDK.qc.summarizeMutationBurden.
   * @returns {Object|Element} Render metadata or an error element.
   */
  function plotMutationBurdenSummary(divID, burdenSummary, options = {}) {
    const samples = [...(burdenSummary.samples || [])].sort(
      (a, b) => a.totalMutations - b.totalMutations
    );
    if (samples.length === 0) {
      return renderPlotError(divID, "No mutation burden data available.");
    }

    const threshold = Number(burdenSummary.overall?.lowBurdenThreshold);
    const hasThreshold = Number.isFinite(threshold) && threshold > 0;
    const maxBurden = Math.max(
      ...samples.map((sample) => Number(sample.totalMutations) || 0),
      hasThreshold ? threshold : 0,
      1
    );
    const lowBurdenCount = samples.filter(
      (sample) => sample.flags?.lowBurden
    ).length;
    const emptyCount = samples.filter(
      (sample) => sample.flags?.emptySpectrum
    ).length;
    const publication = resolvePlotPublication(options.publication);
    const burdenLayout = options.layout || publication?.layout || "ranked";

    if (burdenLayout === "histogram") {
      const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
        title: options.title || "Mutation burden QC",
        subtitle:
          options.subtitle ||
          "Distribution of total mutations across the cohort.",
        badges: [
          { label: "Samples", value: String(samples.length) },
          {
            label: "Median",
            value: formatPlotNumber(burdenSummary.overall?.median || d3.median(samples, (sample) => sample.totalMutations), 0),
          },
          { label: "Max", value: formatPlotNumber(maxBurden, 0) },
        ],
        figureContext: mergeFigureContext(options.figureContext, {
          dataset: options.dataset || burdenSummary.dataset || burdenSummary.source,
          samples: samples.length,
          metric: "total mutations",
          lowBurdenThreshold: hasThreshold ? threshold : "off",
        }),
        publication,
        maxWidth: publication?.maxWidth || "760px",
      });
      const width = publicationNumber(publication, "width", 760, { min: 360 });
      const height = publicationNumber(publication, "height", 380, { min: 240 });
      const margin = {
        top: publicationNumber(publication, "marginTop", 36, { min: 16 }),
        right: publicationNumber(publication, "marginRight", 28, { min: 8 }),
        bottom: publicationNumber(publication, "marginBottom", 58, { min: 28 }),
        left: publicationNumber(publication, "marginLeft", 68, { min: 34 }),
      };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;
      const svg = appendResponsiveSvg(chart, width, height, "Mutation burden distribution", publication);
      const values = samples.map((sample) => Number(sample.totalMutations) || 0);
      const x = d3.scaleLinear().domain([0, maxBurden]).nice().range([0, innerWidth]);
      const bins = d3.bin().domain(x.domain()).thresholds(publicationNumber(publication, "bins", 10, { min: 4, max: 24 }))(values);
      const y = d3.scaleLinear().domain([0, d3.max(bins, (bin) => bin.length) || 1]).nice().range([innerHeight, 0]);
      const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
      plot
        .append("g")
        .attr("stroke", SCIENTIFIC_COLORS.lightGray)
        .attr("stroke-opacity", 0.85)
        .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
        .call((axis) => axis.select(".domain").remove());
      plot
        .selectAll("rect.msig-burden-bin")
        .data(bins)
        .join("rect")
        .attr("class", "msig-burden-bin")
        .attr("x", (bin) => x(bin.x0) + 1)
        .attr("y", (bin) => y(bin.length))
        .attr("width", (bin) => Math.max(2, x(bin.x1) - x(bin.x0) - 2))
        .attr("height", (bin) => innerHeight - y(bin.length))
        .attr("rx", 3)
        .attr("fill", SCIENTIFIC_COLORS.blue)
        .attr("opacity", 0.9)
        .on("mousemove", (event, bin) =>
          showTooltip(
            event,
            tooltipRows([
              ["Mutation range", `${d3.format(",.0f")(bin.x0)}-${d3.format(",.0f")(bin.x1)}`],
              ["Samples", bin.length],
            ])
          )
        )
        .on("mouseleave", hideTooltip);
      if (hasThreshold) {
        plot
          .append("line")
          .attr("x1", x(threshold))
          .attr("x2", x(threshold))
          .attr("y1", 0)
          .attr("y2", innerHeight)
          .attr("stroke", SCIENTIFIC_COLORS.vermillion)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5 5");
      }
      plot.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("~s"))).call(styleD3Axis);
      plot.append("g").call(d3.axisLeft(y).ticks(5)).call(styleD3Axis);
      svg.append("text").attr("class", "msig-d3-axis-title").attr("x", margin.left + innerWidth / 2).attr("y", height - 12).attr("text-anchor", "middle").text("Total mutations");
      svg.append("text").attr("class", "msig-d3-axis-title").attr("transform", "rotate(-90)").attr("x", -(margin.top + innerHeight / 2)).attr("y", 16).attr("text-anchor", "middle").text("Samples");
      return { data: samples, threshold, layout: "histogram", bins };
    }

	    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
	      title: "Mutation burden QC",
	      subtitle:
	        "Sample mutation counts with the low-burden review threshold.",
      badges: [
        {
          label: "Threshold",
          value: hasThreshold ? formatPlotNumber(threshold, 1) : "Off",
        },
        { label: "Review cues", value: `${lowBurdenCount}/${samples.length}` },
        { label: "Empty", value: String(emptyCount) },
      ],
      figureContext: mergeFigureContext(options.figureContext, {
        dataset: options.dataset || burdenSummary.dataset || burdenSummary.source,
        samples: samples.length,
        metric: "total mutations",
        lowBurdenThreshold: hasThreshold ? threshold : "off",
      }),
      publication: options.publication,
    });

    const width = publicationNumber(publication, "width", 920, { min: 460 });
    const rowHeight = publicationNumber(publication, "rowHeight", publication?.compact ? 20 : 28, { min: 12, max: 48 });
    const margin = { top: 38, right: 92, bottom: 58, left: 132 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = Math.max(publicationNumber(publication, "minInnerHeight", 240, { min: 120 }), samples.length * rowHeight);
    const height = publicationNumber(publication, "height", innerHeight + margin.top + margin.bottom, { min: 220 });
    const svg = appendResponsiveSvg(
      chart,
      width,
      height,
      "Mutation burden by sample",
      publication
    );
    const plot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    const x = d3
      .scaleLinear()
      .domain([0, maxBurden * 1.1])
      .nice()
      .range([0, innerWidth]);
    const y = d3
      .scaleBand()
      .domain(samples.map((sample) => sample.sample))
      .range([0, innerHeight])
      .padding(0.22);

    plot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(6)
          .tickFormat((value) => d3.format(",")(value))
      )
      .call(styleD3Axis);
	    plot
	      .append("g")
	      .call(d3.axisLeft(y).tickSize(0))
	      .call(styleD3Axis)
      .call((axis) => compactD3AxisText(axis, 24))
	      .select(".domain")
	      .remove();
    plot
      .append("g")
      .attr("stroke", SCIENTIFIC_COLORS.lightGray)
      .attr("stroke-opacity", 0.8)
      .call(d3.axisBottom(x).ticks(6).tickSize(innerHeight).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());

    if (hasThreshold) {
      plot
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", Math.min(x(threshold), innerWidth))
        .attr("height", innerHeight)
        .attr("fill", SCIENTIFIC_COLORS.orange)
        .attr("opacity", 0.07);
      plot
        .append("line")
        .attr("x1", x(threshold))
        .attr("x2", x(threshold))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", SCIENTIFIC_COLORS.vermillion)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5 5");
      plot
        .append("text")
        .attr("x", Math.min(x(threshold) + 8, innerWidth - 120))
        .attr("y", -13)
        .attr("fill", SCIENTIFIC_COLORS.vermillion)
        .attr("font", "700 12px Arial, sans-serif")
        .attr("dominant-baseline", "middle")
        .text(`Threshold: ${formatPlotNumber(threshold, 1)}`);
    }

    const statusColor = (sample) =>
      sample.flags?.emptySpectrum
        ? SCIENTIFIC_COLORS.vermillion
        : sample.flags?.lowBurden
          ? SCIENTIFIC_COLORS.orange
          : SCIENTIFIC_COLORS.blue;
    const statusLabel = (sample) =>
      sample.flags?.emptySpectrum
        ? "empty spectrum"
        : sample.flags?.lowBurden
          ? "below threshold"
          : "passes threshold";

    plot
      .selectAll("rect.msig-burden-bar")
      .data(samples)
      .join("rect")
      .attr("class", "msig-burden-bar")
      .attr("x", 0)
      .attr("y", (sample) => y(sample.sample))
      .attr("width", (sample) => x(sample.totalMutations))
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", statusColor)
      .attr("opacity", 0.88)
      .on("mousemove", (event, sample) =>
        showTooltip(
          event,
          tooltipRows([
            ["Sample", sample.sample],
            ["Total mutations", d3.format(",")(sample.totalMutations)],
            ["Non-zero contexts", sample.nonZeroContexts],
            ["Status", statusLabel(sample)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);

    plot
      .selectAll("text.msig-burden-label")
      .data(samples)
      .join("text")
      .attr("class", "msig-burden-label")
      .attr("x", (sample) => Math.min(x(sample.totalMutations) + 7, innerWidth))
      .attr("y", (sample) => y(sample.sample) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("fill", SCIENTIFIC_COLORS.darkGray)
      .attr("font", "700 11px Arial, sans-serif")
      .text((sample) => d3.format(",")(sample.totalMutations));

    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + innerWidth / 2)
      .attr("y", height - 12)
      .attr("text-anchor", "middle")
      .text("Total mutations");

    return { data: samples, threshold };
  }

  /**
   * Renders reconstruction quality diagnostics for fitted spectra.
   *
   * @async
   * @function plotReconstructionError
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} reconstructionError - Result from mSigSDK.qc.calculateReconstructionError.
   * @param {Object} [options] - Plot options.
   * @param {Object[]} [options.cosineReferenceLines=[]] - Optional cosine reference markers.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotReconstructionError(
    divID,
    reconstructionError,
    { cosineReferenceLines = [], figureContext = null, publication = null, dataset = null } = {}
  ) {
    const samples = [...(reconstructionError.samples || [])].sort(
      (a, b) => a.cosineSimilarity - b.cosineSimilarity
    );
    if (samples.length === 0) {
      return renderPlotError(divID, "No reconstruction error data available.");
    }

    const cosineValues = samples.map((sample) => sample.cosineSimilarity);
    const rmseValues = samples.map((sample) => sample.rmse);
    const minCosine = Math.min(...cosineValues.filter(Number.isFinite), 1);
    const maxRmse = Math.max(...rmseValues.filter(Number.isFinite), 0);
    const cosineRangeStart = Math.max(
      0,
      Math.floor((minCosine - 0.02) * 20) / 20
    );
    const rows = samples.map((sample, index) => ({
      sample: sample.sample,
      order: index + 1,
      cosineSimilarity: sample.cosineSimilarity,
      rmse: sample.rmse,
      cosineGap: 1 - sample.cosineSimilarity,
    }));
    const referenceLines = cosineReferenceLines
      .map((line) => ({
        value: Number(line.value),
        label: line.label || String(line.value),
      }))
      .filter((line) => Number.isFinite(line.value));

		    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
		      title: "Reconstruction quality",
		      subtitle:
		        "Cosine closer to 1 and RMSE closer to 0 indicate a closer reconstruction of the observed sample.",
      badges: [
        {
          label: "Median cosine",
          value: formatPlotNumber(d3.median(cosineValues), 4),
        },
        {
          label: "Max RMSE",
          value: formatPlotNumber(maxRmse, 5),
        },
      ],
      figureContext: mergeFigureContext(figureContext, {
        dataset: dataset || reconstructionError.dataset || reconstructionError.source,
        samples: samples.length,
        metrics: "cosine similarity and RMSE",
      }),
      publication,
    });

	    const width = 1080;
	    const rowHeight = 30;
	    const margin = { top: 28, right: 44, bottom: 72, left: 164 };
	    const gap = 72;
	    const cosineWidth = 520;
	    const rmseWidth = width - margin.left - margin.right - gap - cosineWidth;
    const innerHeight = Math.max(260, samples.length * rowHeight);
    const height = innerHeight + margin.top + margin.bottom;
    const svg = appendResponsiveSvg(
      chart,
      width,
      height,
      "Reconstruction quality by sample"
    );
    const y = d3
      .scaleBand()
      .domain(samples.map((sample) => sample.sample))
      .range([0, innerHeight])
      .padding(0.28);
    const xCosine = d3
      .scaleLinear()
      .domain([cosineRangeStart, 1])
      .range([0, cosineWidth]);
	    const xRmse = d3
	      .scaleLinear()
	      .domain([0, maxRmse === 0 ? 1 : maxRmse * 1.12])
	      .nice()
	      .range([0, rmseWidth]);
    const rmseTickCount = tickCountForWidth(rmseWidth, 110, 2, 3);
    const cosinePlot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    const rmsePlot = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left + cosineWidth + gap},${margin.top})`
      );

    cosinePlot
      .append("g")
      .attr("stroke", SCIENTIFIC_COLORS.lightGray)
      .attr("stroke-opacity", 0.9)
      .call(
        d3
          .axisBottom(xCosine)
          .ticks(5)
          .tickSize(innerHeight)
          .tickFormat("")
      )
      .call((axis) => axis.select(".domain").remove());
	    rmsePlot
	      .append("g")
	      .attr("stroke", SCIENTIFIC_COLORS.lightGray)
	      .attr("stroke-opacity", 0.9)
	      .call(d3.axisBottom(xRmse).ticks(rmseTickCount).tickSize(innerHeight).tickFormat(""))
	      .call((axis) => axis.select(".domain").remove());

    cosinePlot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xCosine).ticks(5).tickFormat(d3.format(".2f")))
      .call(styleD3Axis);
	    rmsePlot
	      .append("g")
	      .attr("transform", `translate(0,${innerHeight})`)
	      .call(d3.axisBottom(xRmse).ticks(rmseTickCount).tickFormat(formatRmseAxisTick))
	      .call(styleD3Axis);
	    cosinePlot
	      .append("g")
	      .call(d3.axisLeft(y).tickSize(0))
	      .call(styleD3Axis)
      .call((axis) => compactD3AxisText(axis, 24))
	      .select(".domain")
	      .remove();

    referenceLines.forEach((line) => {
      cosinePlot
        .append("line")
        .attr("x1", xCosine(line.value))
        .attr("x2", xCosine(line.value))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", SCIENTIFIC_COLORS.gray)
        .attr("stroke-dasharray", "4 4");
      cosinePlot
        .append("text")
        .attr("x", xCosine(line.value) + 5)
        .attr("y", 12)
        .attr("fill", SCIENTIFIC_COLORS.gray)
        .attr("font", "700 11px Arial, sans-serif")
        .text(line.label);
    });

    cosinePlot
      .selectAll("line.msig-cosine-gap")
      .data(rows)
      .join("line")
      .attr("class", "msig-cosine-gap")
      .attr("x1", (row) => xCosine(row.cosineSimilarity))
      .attr("x2", xCosine(1))
      .attr("y1", (row) => y(row.sample) + y.bandwidth() / 2)
      .attr("y2", (row) => y(row.sample) + y.bandwidth() / 2)
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round");
    cosinePlot
      .selectAll("circle.msig-cosine-point")
      .data(rows)
      .join("circle")
      .attr("class", "msig-cosine-point")
      .attr("cx", (row) => xCosine(row.cosineSimilarity))
      .attr("cy", (row) => y(row.sample) + y.bandwidth() / 2)
      .attr("r", 6)
      .attr("fill", SCIENTIFIC_COLORS.blue)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
		          tooltipRows([
		            ["Sample", row.sample],
		            ["Cosine", formatPlotNumber(row.cosineSimilarity, 4)],
		            ["Cosine scale", "Higher is better."],
		            ["1 - cosine", formatPlotNumber(row.cosineGap, 4)],
		            ["RMSE", formatPlotNumber(row.rmse, 5)],
	            ["RMSE scale", describeRmseForPlot(row.rmse)],
	          ])
        )
      )
      .on("mouseleave", hideTooltip);

    rmsePlot
      .selectAll("rect.msig-rmse-bar")
      .data(rows)
      .join("rect")
      .attr("class", "msig-rmse-bar")
      .attr("x", 0)
      .attr("y", (row) => y(row.sample))
      .attr("width", (row) => xRmse(row.rmse))
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", SCIENTIFIC_COLORS.orange)
      .attr("opacity", 0.72)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
		          tooltipRows([
		            ["Sample", row.sample],
		            ["RMSE", formatPlotNumber(row.rmse, 5)],
	            ["RMSE scale", describeRmseForPlot(row.rmse)],
		            ["Cosine", formatPlotNumber(row.cosineSimilarity, 4)],
	            ["Cosine scale", "Higher is better."],
	          ])
        )
      )
      .on("mouseleave", hideTooltip);

    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + cosineWidth / 2)
      .attr("y", margin.top - 8)
      .attr("text-anchor", "middle")
      .text("Cosine similarity");
    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + cosineWidth + gap + rmseWidth / 2)
      .attr("y", margin.top - 8)
      .attr("text-anchor", "middle")
      .text("RMSE");
    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + cosineWidth / 2)
      .attr("y", height - 14)
      .attr("text-anchor", "middle")
      .text("Higher is better");
    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + cosineWidth + gap + rmseWidth / 2)
      .attr("y", height - 14)
      .attr("text-anchor", "middle")
      .text("Lower is better");

    return { data: rows, thresholds: { cosineReferenceLines: referenceLines } };
  }

  /**
   * Renders fit-quality evidence returned by mSigSDK.advisor.computeFitQualityEvidence.
   *
   * @async
   * @function plotFitQualityEvidenceDashboard
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} fitQualityEvidenceResult - Result from mSigSDK.advisor.computeFitQualityEvidence.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotFitQualityEvidenceDashboard(divID, fitQualityEvidenceResult, options = {}) {
    const severityRank = {
      standard_qc_passed: 0,
      report_with_caveats: 1,
      restricted_interpretation: 2,
      not_assessable: 3,
    };
    const reportingModeFor = (sample) =>
      sample.reportingMode ||
      sample.recommendedReportingMode ||
      "not_assessable";
    const reviewFlagCountFor = (sample) =>
      sample.reviewFlagCount ??
      sample.reviewFlagCodes?.length ??
      sample.evidenceFlags?.length ??
      sample.flags?.length ??
      sample.warnings?.length ??
      0;
    let samples = [...(fitQualityEvidenceResult.samples || [])];
    if (samples.length === 0) {
      return renderPlotError(divID, "No fit-quality evidence available.");
    }

	    const components = [
	      { key: "burden", label: "Burden", header: ["Burden", "(mut)"] },
	      { key: "reconstruction", label: "Fit cosine", header: ["Fit", "cosine"] },
	      { key: "residual", label: "Residual", header: ["Residual", "(%)"] },
	      { key: "bootstrap", label: "Bootstrap 95% CI width (%)", header: ["Bootstrap", "95% CI", "width (%)"] },
	      { key: "threshold", label: "Cutoff-sensitivity max cosine drop", header: ["Cutoff", "max cosine", "drop"] },
	      { key: "ambiguity", label: "Nearest active-signature cosine", header: ["Nearest", "signature", "cosine"] },
	    ];
    const classLabel = {
      standard_qc_passed: "No active caveat",
      report_with_caveats: "Report with caveats",
      restricted_interpretation: "Restricted interpretation",
      not_assessable: "Not assessable",
    };
    const classColor = {
      standard_qc_passed: SCIENTIFIC_COLORS.green,
      report_with_caveats: SCIENTIFIC_COLORS.blue,
      restricted_interpretation: SCIENTIFIC_COLORS.orange,
      not_assessable: SCIENTIFIC_COLORS.vermillion,
    };
    const stateColor = {
      concern: SCIENTIFIC_COLORS.vermillion,
      caution: SCIENTIFIC_COLORS.orange,
      observed: SCIENTIFIC_COLORS.blue,
      ok: SCIENTIFIC_COLORS.green,
      missing: "#f1f5f9",
    };
    const stateLabel = {
      concern: "priority check",
      caution: "check",
      observed: "measured",
      ok: "no cue",
      missing: "n/a",
    };
    const statusGuide = [
      {
        label: "priority",
        color: stateColor.concern,
        text: "inspect before reporting",
      },
      {
        label: "check",
        color: stateColor.caution,
        text: "configured cue",
      },
      {
        label: "measured",
        color: stateColor.observed,
        text: "shown for context",
      },
      {
        label: "ok",
        color: stateColor.ok,
        text: "no active cue",
      },
      {
        label: "n/a",
        color: stateColor.missing,
        text: "not available for sample",
      },
    ];
	    const reviewActionGuide = [
	      {
	        label: "Burden",
	        text:
	          "Total mutation count. Low counts make fitted contributions less stable.",
	      },
	      {
	        label: "Fit",
	        text:
	          "Cosine similarity between the observed spectrum and the fitted reconstruction. Range: 0 to 1; higher is better.",
	      },
	      {
	        label: "Residual",
	        text:
	          "Percent of the observed spectrum left after subtracting the reconstruction. Higher means more unexplained signal.",
	      },
	      {
	        label: "Bootstrap",
	        text:
	          "Largest confidence interval among reportable signatures, shown as percent of relative exposure. A conservative summary.",
	      },
		      {
		        label: "Cutoff",
		        text:
		          "Across the tested exposure cutoffs, each reconstruction cosine is compared with the baseline. The cell shows the biggest drop.",
		      },
		      {
		        label: "Nearest signature cosine",
		        text:
		          "Highest cosine similarity between two fitted active signatures. Values near 1 mean harder-to-separate signatures.",
		      },
    ];
    const catalogStatusLabel = {
      catalog_sufficient_for_fit: "ok",
      possible_out_of_reference: "possible",
      suspected_out_of_reference: "priority",
      not_checked: "n/a",
    };
    const identifiabilityTagLabel = {
      catalog_neighbor_confusable: "near-neighbor similarity cue",
      neighbor_crowded_catalog_region: "crowded-catalog-region cue",
      broad_or_flat_signature: "broad/flat-profile cue",
      low_specificity_profile: "low-specificity-profile cue",
      near_review_boundary: "near-review-boundary cue",
      none: "no identifiability cue",
    };
    const componentTooltipLabel = {
      burden: "Mutation burden",
      reconstruction: "Reconstruction fit",
      residual: "Residual and catalog fit",
      bootstrap: "Bootstrap 95% CI width (%)",
      threshold: "Cutoff-sensitivity max cosine drop",
	      ambiguity: "Nearest active-signature cosine",
    };
    const componentMeaning = {
      burden: {
        concern: "Low mutation count",
        ok: "Mutation count above cutoff",
        missing: "No count available",
        default: "Total mutation count",
      },
	      reconstruction: {
	        concern: "Poor reconstruction",
	        caution: "Check reconstruction",
	        observed: "Observed-vs-reconstructed cosine, range 0 to 1",
	        ok: "Observed-vs-reconstructed cosine, range 0 to 1",
	        missing: "No fit score",
	        default: "Observed-vs-reconstructed cosine, range 0 to 1",
	      },
	      residual: {
	        concern: "High unexplained fraction",
	        caution: "Unexplained fraction with low burden",
	        observed: "Unexplained fraction measured, range 0% to 100%",
	        ok: "No residual cue",
	        missing: "No residual result",
	        default: "Unexplained fraction after reconstruction, range 0% to 100%",
	      },
	      bootstrap: {
	        concern: "Reportable signature is inconsistently selected",
	        caution: "Reportable signature selection is variable",
	        observed: "Bootstrap 95% CI width measured as relative-exposure percent",
	        ok: "No bootstrap selection cue",
	        missing: "No bootstrap intervals supplied for this sample",
	        default: "Largest 95% bootstrap exposure confidence-interval width, reported as a relative-exposure percent",
	      },
	      threshold: {
	        concern: "Reconstruction changes across cutoffs",
	        caution: "Small reconstruction change across cutoffs",
	        observed: "Biggest baseline-to-cutoff reconstruction-cosine drop measured, range 0 to 1",
	        ok: "No cutoff-sensitivity cue",
	        missing: "No cutoff-sensitivity results supplied",
	        default: "Biggest reconstruction-cosine decrease after applying the tested exposure cutoffs, range 0 to 1",
	      },
	      ambiguity: {
	        concern: "Very similar active signatures",
	        caution: "Similar active signatures",
	        ok: "No highly similar active pair",
	        missing: "Fewer than two active signatures",
	        default: "Cosine similarity between active signatures, range 0 to 1",
	      },
      catalog: {
        concern: "Catalog fit needs review",
        caution: "Catalog check limited by burden",
        ok: "No strong catalog mismatch",
        missing: "Catalog not checked",
        default: "Residual and reconstruction screen",
      },
    };
    const componentAction = {
      burden: {
        concern: "Report with caution",
        missing: "Check input counts",
        default: "Use as sample-size context",
      },
      reconstruction: {
        concern: "Inspect residual plot",
        caution: "Inspect residual plot",
        missing: "Run reconstruction",
        default: "Compare with residuals",
      },
      residual: {
        concern: "Inspect residual plot",
        caution: "Check burden first",
        missing: "Run residual check",
        default: "Compare observed, reconstructed, and residual spectra",
      },
	      bootstrap: {
	        concern: "Inspect selected signatures",
	        caution: "Check selected signatures",
	        missing: "Select in uncertainty plot",
	        default: "Inspect signature-level intervals",
	      },
	      threshold: {
	        concern: "Inspect cutoff-specific reconstruction",
	        caution: "Compare cutoff-specific reconstruction",
	        missing: "Run cutoff check",
	        default: "Use as sensitivity context",
	      },
      ambiguity: {
        concern: "Report similar signatures together",
        caution: "Inspect both signatures",
        missing: "Check active fit",
        default: "Check active signature pairs",
      },
      catalog: {
        concern: "Inspect residuals",
        caution: "Check burden first",
        missing: "Run catalog check",
        default: "Document catalog",
      },
    };
    const componentLabel = Object.fromEntries(
      components.map(({ key, label }) => [key, label])
    );
    const textForComponentState = (lookup, component, state) =>
      lookup[component]?.[state] ||
      lookup[component]?.default ||
      "Review field";
    const cueMeaningFor = (component, state) =>
      textForComponentState(componentMeaning, component, state);
    const cueActionFor = (component, state) =>
      textForComponentState(componentAction, component, state);
    const reportingModeMeaning = {
      standard_qc_passed: "No active sample caveat",
      report_with_caveats: "Report with caveats",
      restricted_interpretation: "Limit detailed claims",
      not_assessable: "Not enough signal",
    };
    const reportingModeAction = {
      standard_qc_passed: "Use routine reporting with measured diagnostics",
      report_with_caveats: "Carry active caveats",
      restricted_interpretation: "Report high-level pattern",
      not_assessable: "Do not overinterpret",
    };
    const appendReviewGuide = () => {
      const guide = document.createElement("div");
      guide.className = "msig-d3-review-guide";

      const statusCard = document.createElement("div");
      statusCard.className = "msig-d3-review-card";
      const statusTitle = document.createElement("div");
      statusTitle.className = "msig-d3-review-card-title";
      statusTitle.textContent = "Status key";
      const statusList = document.createElement("div");
      statusList.className = "msig-d3-review-statuses";
      statusGuide.forEach((status) => {
        const item = document.createElement("span");
        item.className = "msig-d3-review-status";
        const dot = document.createElement("span");
        dot.className = "msig-d3-review-dot";
        dot.style.background = status.color;
        const label = document.createElement("span");
        label.innerHTML = `<strong>${escapeHTML(status.label)}</strong> ${escapeHTML(status.text)}`;
        item.append(dot, label);
        statusList.appendChild(item);
      });
      statusCard.append(statusTitle, statusList);

      const actionCard = document.createElement("div");
      actionCard.className = "msig-d3-review-card";
      const actionTitle = document.createElement("div");
      actionTitle.className = "msig-d3-review-card-title";
      actionTitle.textContent = "How to read the numbers";
      const actionList = document.createElement("div");
      actionList.className = "msig-d3-review-actions";
      reviewActionGuide.forEach((action) => {
        const item = document.createElement("div");
        item.className = "msig-d3-review-action";
        item.innerHTML = `<strong>${escapeHTML(action.label)}:</strong> ${escapeHTML(action.text)}`;
        actionList.appendChild(item);
      });
      actionCard.append(actionTitle, actionList);

      guide.append(statusCard, actionCard);
      chart.appendChild(guide);
    };
    const evidenceFor = (sample, component) =>
      sample.componentEvidence?.[component] || {};
    const warningCodesFor = (sample) =>
      new Set(
        [
          ...(sample.reviewFlagCodes || []),
          ...(sample.evidenceFlags || []).map((flag) => flag?.code),
          ...(sample.flags || []).map((flag) => flag?.code),
          ...(sample.warnings || []).map((warning) => warning?.code),
        ].filter(Boolean)
      );
    const hasAnyWarning = (sample, codes) => {
      const warningCodes = warningCodesFor(sample);
      return codes.some((code) => warningCodes.has(code));
    };
    const compactText = (value, maxLength = 10) => {
      const text = String(value ?? "NA");
      return text.length > maxLength
        ? `${text.slice(0, Math.max(1, maxLength - 3))}...`
        : text;
    };
		    const formatPercentEvidence = (value, digits = 1) =>
		      Number.isFinite(value) ? d3.format(`.${digits}%`)(value) : "NA";
		    const formatPercentValue = (value, digits = 1) =>
		      Number.isFinite(value) ? formatPlotNumber(value * 100, digits) : "NA";
		    const formatPercentagePointEvidence = (value, digits = 1) =>
		      Number.isFinite(value) ? `${formatPlotNumber(value * 100, digits)}%` : "NA";
		    const formatPercentagePointValue = (value, digits = 1) =>
		      Number.isFinite(value) ? formatPlotNumber(value * 100, digits) : "NA";
	    const formatEvidenceNumber = (value, digits = 3) =>
	      Number.isFinite(value) ? formatPlotNumber(value, digits) : "NA";
		    const displayList = (values, fallback = "none") => {
		      const uniqueValues = uniqueStringsForPlot(values || []);
		      return uniqueValues.length
		        ? compactPlotLabel(uniqueValues.join(", "), 56)
		        : fallback;
		    };
	    const reviewCodeLabels = {
	      BOOTSTRAP_CI_BROAD: "bootstrap CI threshold crossed",
	      BOOTSTRAP_CI_VERY_BROAD: "bootstrap CI priority threshold crossed",
	      BOOTSTRAP_INTERMEDIATE_SELECTION: "bootstrap selection threshold crossed",
	      BOOTSTRAP_SELECTION_LOW: "bootstrap selection priority threshold crossed",
	      LOW_BOOTSTRAP_ITERATIONS: "low iteration count",
	      CUTOFF_RECONSTRUCTION_DROP: "cutoff cosine-drop threshold crossed",
	      CUTOFF_RECONSTRUCTION_DROP_HIGH: "cutoff cosine-drop priority threshold crossed",
	      FIT_UNSTABLE: "bootstrap uncertainty cue",
	      THRESHOLD_DEPENDENT: "cutoff-sensitivity cue",
	      LOW_BURDEN: "low mutation count",
	      INSUFFICIENT_SIGNAL: "insufficient mutation count",
	      THRESHOLD_DEPENDENT_FIT: "cutoff-dependent fit",
	      threshold_grid_too_small: "fewer than three cutoffs",
	    };
	    const displayReviewCodes = (codes, fallback = "none") => {
	      const labels = uniqueStringsForPlot(codes || []).map(
	        (code) => reviewCodeLabels[code] || code
	      );
	      return labels.length ? labels.join(", ") : fallback;
	    };
	    const bootstrapRuleText = (evidence) => {
	      const rules = [];
	      if (Number.isFinite(evidence.reviewSelectionFrequency)) {
	        rules.push(
	          `check if a reportable signature is selected in fewer than ${formatPercentEvidence(
	            evidence.reviewSelectionFrequency,
	            0
	          )} of refits`
	        );
	      }
	      if (Number.isFinite(evidence.strongSelectionFrequency)) {
	        rules.push(
	          `priority below ${formatPercentEvidence(
	            evidence.strongSelectionFrequency,
	            0
	          )} selection`
	        );
	      }
	      if (Number.isFinite(evidence.reviewConfidenceWidth)) {
	        rules.push(
	          `check if the largest 95% CI width is at least ${formatPercentagePointEvidence(
	            evidence.reviewConfidenceWidth,
	            0
	          )}`
	        );
	      }
	      if (Number.isFinite(evidence.strongConfidenceWidth)) {
	        rules.push(
	          `priority if the largest 95% CI width is at least ${formatPercentagePointEvidence(
	            evidence.strongConfidenceWidth,
	            0
	          )}`
	        );
	      }
	      return rules.length ? `${rules.join("; ")}.` : "";
	    };
	    const thresholdRuleText = (evidence) => {
	      const rules = [];
	      if (Number.isFinite(evidence.reviewCosineDrop)) {
	        rules.push(
	          `check if the biggest cutoff cosine drop is at least ${formatEvidenceNumber(
	            evidence.reviewCosineDrop,
	            3
	          )}`
	        );
	      }
	      if (Number.isFinite(evidence.strongCosineDrop)) {
	        rules.push(
	          `priority if the biggest cutoff cosine drop is at least ${formatEvidenceNumber(
	            evidence.strongCosineDrop,
	            3
	          )}`
	        );
	      }
	      return rules.length ? `${rules.join("; ")}.` : "";
	    };
    const identifiabilityRecords = (evidence) =>
      Array.isArray(evidence.activeAmbiguityEvidence)
        ? evidence.activeAmbiguityEvidence
        : [];
    const identifiabilityTags = (evidence) =>
      uniqueStringsForPlot([
        ...(evidence.activeAmbiguityEvidenceTags || []),
        ...identifiabilityRecords(evidence).flatMap((record) => record.evidenceTags || []),
      ]).filter((tag) => tag && tag !== "none");
    const maxIdentifiabilityPercentile = (evidence) => {
      const percentiles = identifiabilityRecords(evidence)
        .map((record) => record.confusabilityPercentile)
        .filter(Number.isFinite);
      return percentiles.length ? Math.max(...percentiles) : null;
    };
    const hasStrongIdentifiabilityEvidence = (evidence) =>
      identifiabilityRecords(evidence).some(
        (record) =>
          record.strongReviewRecommended ||
          (record.confusabilityPercentile ?? 0) >= 0.9
      );
    const strongestIdentifiabilityRecord = (evidence) =>
      [...identifiabilityRecords(evidence)].sort(
        (a, b) => (b.confusabilityScore ?? -Infinity) - (a.confusabilityScore ?? -Infinity)
      )[0] || null;
	    const tooltipDefinition = (token) => DEFAULT_TOOLTIP_TERMS[token] || "";
	    const displayIdentifiabilityTags = (tokens, fallback = "no identifiability cue") => {
	      const labels = uniqueStringsForPlot(tokens || []).map(
	        (token) => identifiabilityTagLabel[token] || token
	      );
	      return labels.length ? compactPlotLabel(labels.join(", "), 58) : fallback;
	    };
    const displayConfusablePairs = (pairs, fallback = "none") => {
      const labels = (pairs || []).map(
        (pair) =>
          `${pair.signatureA}/${pair.signatureB} (${formatEvidenceNumber(
            pair.cosineSimilarity,
            3
          )})`
      );
      return labels.length ? compactPlotLabel(labels.join(", "), 64) : fallback;
    };
		    const bootstrapEvidenceValue = (evidence) => {
		      if (!evidence.measured) {
		        return "n/a";
		      }
		      return Number.isFinite(evidence.maxConfidenceWidth)
		        ? formatPercentagePointValue(evidence.maxConfidenceWidth, 0)
		        : "n/a";
		    };
    const thresholdEvidenceValue = (evidence) => {
      if (!evidence.measured) {
        return "n/a";
	      }
		      if (Number.isFinite(evidence.cosineDrop)) {
		        return formatEvidenceNumber(evidence.cosineDrop, 3);
		      }
      return "n/a";
    };
	    const confusionEvidenceValue = (evidence) => {
	      const activeSignatures = evidence.activeSignatures || [];
	      if (activeSignatures.length < 2) {
	        return "n/a";
	      }
      const pairCount = evidence.activeConfusablePairCount ?? 0;
      const maxPairCosine =
        evidence.maxActivePairCosine ??
	        evidence.activeConfusablePairs?.[0]?.cosineSimilarity ??
	        null;
		      if (Number.isFinite(maxPairCosine)) {
		        return formatEvidenceNumber(maxPairCosine, 3);
		      }
      return pairCount > 0 ? `${pairCount} pairs` : "0 pairs";
    };
    const displayActivePair = (pair, fallback = "none") =>
      pair
        ? `${pair.signatureA}/${pair.signatureB} (${formatEvidenceNumber(
            pair.cosineSimilarity,
            3
          )})`
        : fallback;
    const componentState = (sample, component) => {
      const evidence = evidenceFor(sample, component);
      if (component === "burden") {
        if (
          hasAnyWarning(sample, ["LOW_BURDEN", "INSUFFICIENT_SIGNAL"]) ||
          ["low", "insufficient"].includes(evidence.burdenClass)
        ) {
          return "concern";
        }
        return evidence.burdenClass ? "ok" : "missing";
      }
      if (component === "reconstruction") {
        return Number.isFinite(evidence.cosineSimilarity) ? "observed" : "missing";
      }
      if (component === "residual") {
        const catalogEvidence = evidenceFor(sample, "catalog");
        if (
          hasAnyWarning(sample, ["HIGH_RESIDUAL_STRUCTURE"]) ||
          catalogEvidence.fitReviewStatus === "review"
        ) {
          return "concern";
        }
        if (catalogEvidence.fitReviewStatus === "limited_by_low_burden") {
          return "caution";
        }
        return Number.isFinite(evidence.unexplainedFraction)
          ? "observed"
          : "missing";
      }
	      if (component === "bootstrap") {
	        if (!evidence.measured) {
	          return "missing";
	        }
	        if (evidence.reviewSeverity === "concern") {
	          return "concern";
	        }
	        if (evidence.reviewSeverity === "caution" || evidence.warningCodes?.length) {
	          return "caution";
	        }
	        return Number.isFinite(evidence.maxConfidenceWidth) ? "observed" : "ok";
	      }
	      if (component === "threshold") {
	        if (!evidence.measured) {
	          return "missing";
	        }
	        if (evidence.reviewSeverity === "concern") {
	          return "concern";
	        }
		        if (evidence.reviewSeverity === "caution" || evidence.warningCodes?.length) {
		          return "caution";
		        }
		        return Number.isFinite(evidence.cosineDrop) ? "observed" : "ok";
		      }
      if (component === "ambiguity") {
        const activeSignatures = evidence.activeSignatures || [];
        if (activeSignatures.length < 2) {
          return "missing";
        }
        if (evidence.sampleAmbiguityStatus === "strong_active_confusable_pair") {
          return "concern";
        }
        if (evidence.sampleAmbiguityStatus === "active_confusable_pair") {
          return "caution";
        }
        return "ok";
      }
	      if (component === "catalog") {
	        if (evidence.fitReviewStatus === "review") {
	          return "concern";
        }
        if (evidence.fitReviewStatus === "limited_by_low_burden") {
          return "caution";
        }
        if (evidence.fitReviewStatus === "ok") {
          return "ok";
        }
        return "missing";
	      }
	      return "missing";
	    };
	    const activeCaveatStatesFor = (sample) =>
	      components
	        .map(({ key, label }) => ({
	          key,
	          label,
	          state: componentState(sample, key),
	        }))
	        .filter(({ state }) => state === "caution" || state === "concern");
	    const activeCaveatCountFor = (sample) =>
	      activeCaveatStatesFor(sample).length;
	    const activeCaveatSeverityFor = (sample) => {
	      const states = activeCaveatStatesFor(sample).map(({ state }) => state);
	      if (states.includes("concern")) return "concern";
	      if (states.includes("caution")) return "caution";
	      return "ok";
	    };
	    const displayActiveCaveats = (sample) => {
	      const labels = activeCaveatStatesFor(sample).map(
	        ({ label, state }) => `${label}: ${stateLabel[state] || state}`
	      );
	      return labels.length ? labels.join(", ") : "none";
	    };
	    samples = samples.sort((a, b) => {
	      const caveatSeverityRank = { ok: 0, caution: 1, concern: 2 };
	      const caveatSeverityDelta =
	        (caveatSeverityRank[activeCaveatSeverityFor(b)] ?? 0) -
	        (caveatSeverityRank[activeCaveatSeverityFor(a)] ?? 0);
	      if (caveatSeverityDelta !== 0) {
	        return caveatSeverityDelta;
	      }
	      const caveatCountDelta =
	        activeCaveatCountFor(b) - activeCaveatCountFor(a);
	      if (caveatCountDelta !== 0) {
	        return caveatCountDelta;
	      }
	      const modeDelta =
	        (severityRank[reportingModeFor(b)] ?? 0) -
	        (severityRank[reportingModeFor(a)] ?? 0);
	      if (modeDelta !== 0) {
	        return modeDelta;
	      }
	      return reviewFlagCountFor(b) - reviewFlagCountFor(a);
	    });
	    const componentValue = (sample, component) => {
      const evidence = evidenceFor(sample, component);
      if (component === "burden") {
	        const totalMutations =
	          evidence.totalMutations ?? sample.metrics?.totalMutations ?? null;
		        return Number.isFinite(totalMutations)
		          ? formatPlotNumber(totalMutations, 0)
		          : "NA";
	      }
      if (component === "reconstruction") {
		        return Number.isFinite(evidence.cosineSimilarity)
		          ? formatPlotNumber(evidence.cosineSimilarity, 3)
		          : "NA";
	      }
	      if (component === "residual") {
		        return Number.isFinite(evidence.unexplainedFraction)
		          ? formatPercentValue(evidence.unexplainedFraction, 1)
		          : "NA";
	      }
      if (component === "bootstrap") {
        return bootstrapEvidenceValue(evidence);
      }
      if (component === "threshold") {
        return thresholdEvidenceValue(evidence);
      }
      if (component === "ambiguity") {
        return confusionEvidenceValue(evidence);
      }
      if (component === "catalog") {
        if (evidence.fitReviewStatus === "review") {
          return "review";
        }
        if (evidence.fitReviewStatus === "limited_by_low_burden") {
          return "check";
        }
        if (evidence.fitReviewStatus === "ok") {
          return "ok";
        }
        return "n/a";
      }
      return "NA";
    };
    const componentDetail = (sample, component) => {
      const evidence = evidenceFor(sample, component);
      if (component === "burden") {
        return [
          ["Value", evidence.totalMutations ?? "NA"],
          ["Burden class", evidence.burdenClass || "NA"],
          ["Low-count cutoff", evidence.configuredLowBurdenThreshold ?? "NA"],
          ["Meaning", "Low counts make fitted contributions less stable."],
        ];
      }
	      if (component === "reconstruction") {
	        return [
	          ["Value", formatEvidenceNumber(evidence.cosineSimilarity, 4)],
	          ["Range", "0 to 1; higher is better"],
	          ["RMSE", formatEvidenceNumber(evidence.rmse, 5)],
	          ["Meaning", "Observed-vs-reconstructed shape match."],
	        ];
	      }
      if (component === "residual") {
        const catalogEvidence = evidenceFor(sample, "catalog");
        const catalogStatus = catalogEvidence.status || "not_checked";
        const residualStatus =
          catalogEvidence.fitReviewStatus === "limited_by_low_burden"
            ? "burden-limited"
            : catalogEvidence.fitReviewStatus || "n/a";
        return [
          [
            "Value",
            formatPercentEvidence(evidence.unexplainedFraction, 1),
          ],
          ["Residual status", residualStatus],
          ["Catalog screen", catalogStatusLabel[catalogStatus] || "n/a"],
	          ["Meaning", "Observed spectrum minus fitted reconstruction."],
        ];
      }
      if (component === "bootstrap") {
        return [
		          [
		            "Value",
		            formatPercentagePointEvidence(evidence.maxConfidenceWidth, 1),
		          ],
		          ["Summary", "Widest 95% exposure CI among reportable signatures"],
		          ["Iterations", evidence.iterations ?? "NA"],
		          [
		            "Reportable signatures",
		            String(evidence.reportableSignatureCount ?? 0),
		          ],
		          bootstrapRuleText(evidence) ? ["Rule", bootstrapRuleText(evidence)] : null,
		          ["Sample warning", displayReviewCodes(evidence.warningCodes)],
		          ["Run note", displayReviewCodes(evidence.methodWarningCodes)],
        ].filter(Boolean);
      }
      if (component === "threshold") {
        return [
	          [
	            "Value",
	            formatEvidenceNumber(evidence.cosineDrop, 4),
	          ],
	          ["Summary", "Worst baseline-to-cutoff reconstruction-cosine drop"],
	          [
	            "Cutoffs tested",
	            Array.isArray(evidence.testedThresholds)
	              ? evidence.testedThresholds.map((value) => formatPlotNumber(value, 3)).join(", ")
	              : evidence.thresholdCount ?? "NA",
	          ],
	          ["Baseline cutoff", formatEvidenceNumber(evidence.baselineThreshold, 3)],
	          thresholdRuleText(evidence) ? ["Rule", thresholdRuleText(evidence)] : null,
	          ["Why", "Small contributions are removed; the remaining recipe is renormalized."],
	          [
	            "Exposure redistribution",
	            formatPercentagePointEvidence(evidence.l1Change, 1),
	          ],
	          ["Run note", displayReviewCodes(evidence.methodWarningCodes || evidence.upstreamWarningCodes)],
        ].filter(Boolean);
      }
	      if (component === "ambiguity") {
	        return [
	          [
	            "Value",
	            formatEvidenceNumber(evidence.maxActivePairCosine, 3),
	          ],
	          ["Nearest active pair", displayActivePair(evidence.nearestActivePair)],
	          [
	            "Rule",
	            `Check at ${formatEvidenceNumber(
	              evidence.pairCosineThreshold,
	              3
	            )}; priority at ${formatEvidenceNumber(
	              evidence.strongPairCosineThreshold,
	              3
	            )}.`,
	          ],
	          ["Meaning", "Higher values mean more similar active signatures."],
	        ];
	      }
      if (component === "catalog") {
        const status = evidence.status || "not_checked";
        return [
          ["Status", componentValue(sample, component)],
          ["Catalog screen", catalogStatusLabel[status] || "n/a"],
          ["Cosine", formatEvidenceNumber(evidence.cosineSimilarity, 4)],
          ["Unexplained", formatPercentEvidence(evidence.unexplainedFraction, 1)],
          [
            "Reliable burden",
            evidence.reliableResidualDetection === null
              ? "NA"
              : evidence.reliableResidualDetection
                ? "yes"
                : "no",
          ],
          ["Structured residual", evidence.structuredResidual ? "yes" : "no"],
        ];
      }
      return [];
    };
    const publication = resolvePlotPublication(options.publication);
    const renderPublicationSummary = () => {
      const width = publicationNumber(publication, "width", 560, { min: 460 });
      const height = publicationNumber(publication, "height", 320, { min: 250 });
      const totalSamples = samples.length;
      const caveatSamples = samples.filter((sample) => activeCaveatCountFor(sample) > 0).length;
      const medianFitCosine = d3.median(
        samples
          .map((sample) => evidenceFor(sample, "reconstruction").cosineSimilarity)
          .filter(Number.isFinite)
      );
      const topSamples = [...samples]
        .sort((a, b) => {
          const caveatDelta = activeCaveatCountFor(b) - activeCaveatCountFor(a);
          if (caveatDelta !== 0) return caveatDelta;
          const burdenA = evidenceFor(a, "burden").totalMutations ?? a.metrics?.totalMutations ?? 0;
          const burdenB = evidenceFor(b, "burden").totalMutations ?? b.metrics?.totalMutations ?? 0;
          return burdenB - burdenA;
        })
        .slice(0, 3);
      const shortComponentLabel = {
        burden: "Burden",
        reconstruction: "Fit",
        residual: "Residual",
        bootstrap: "Bootstrap",
        threshold: "Cutoff",
        ambiguity: "Nearest sig.",
      };
      const fieldSummary = components.map(({ key, label }) => {
        const counts = samples.reduce(
          (acc, sample) => {
            const state = componentState(sample, key);
            acc[state] = (acc[state] || 0) + 1;
            return acc;
          },
          { concern: 0, caution: 0, observed: 0, ok: 0, missing: 0 }
        );
        const cueCount = (counts.concern || 0) + (counts.caution || 0);
        const measuredCount = totalSamples - (counts.missing || 0);
        const fieldState = counts.concern
          ? "concern"
          : counts.caution
            ? "caution"
            : measuredCount
              ? "observed"
              : "missing";
        return {
          key,
          label: shortComponentLabel[key] || label,
          cueCount,
          measuredCount,
          state: fieldState,
        };
      });

      const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
        title: "Fit-quality evidence summary",
        subtitle:
          "Manuscript view of the SDK trust/evidence dashboard: sample-level caveats and the fields that triggered them.",
        badges: [
          { label: "Samples", value: String(totalSamples) },
          { label: "With caveats", value: String(caveatSamples) },
        ],
        figureContext: mergeFigureContext(options.figureContext, {
          dataset:
            options.dataset ||
            fitQualityEvidenceResult.dataset ||
            fitQualityEvidenceResult.source,
          samples: totalSamples,
          metrics:
            "summary of burden, reconstruction, residual, bootstrap, cutoff, and ambiguity evidence",
        }),
        publication,
      });
      const svg = appendResponsiveSvg(chart, width, height, "Fit-quality evidence summary", publication);
      const cardY = 18;
      const cardW = (width - 64) / 3;
      const kpis = [
        ["Samples", String(totalSamples), SCIENTIFIC_COLORS.blue],
        ["With caveats", String(caveatSamples), SCIENTIFIC_COLORS.orange],
        [
          "Median fit cosine",
          Number.isFinite(medianFitCosine) ? formatPlotNumber(medianFitCosine, 3) : "NA",
          SCIENTIFIC_COLORS.green,
        ],
      ];
      kpis.forEach(([label, value, color], index) => {
        const x0 = 20 + index * (cardW + 12);
        svg
          .append("rect")
          .attr("x", x0)
          .attr("y", cardY)
          .attr("width", cardW)
          .attr("height", 58)
          .attr("rx", 10)
          .attr("fill", "#ffffff")
          .attr("stroke", SCIENTIFIC_COLORS.lightGray);
        svg
          .append("text")
          .attr("x", x0 + 14)
          .attr("y", cardY + 22)
          .attr("font", "700 11px Arial, sans-serif")
          .attr("fill", SCIENTIFIC_COLORS.darkGray)
          .text(label);
        svg
          .append("text")
          .attr("x", x0 + 14)
          .attr("y", cardY + 48)
          .attr("font", "700 24px Arial, sans-serif")
          .attr("fill", color)
          .text(value);
      });

      svg
        .append("text")
        .attr("x", 20)
        .attr("y", 106)
        .attr("font", "700 13px Arial, sans-serif")
        .attr("fill", SCIENTIFIC_COLORS.darkGray)
        .text("Evidence fields checked");
      const tileW = (width - 56) / 3;
      const tileH = 34;
      fieldSummary.forEach((field, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x0 = 20 + col * (tileW + 8);
        const y0 = 118 + row * (tileH + 9);
        const color = stateColor[field.state] || stateColor.missing;
        svg
          .append("rect")
          .attr("x", x0)
          .attr("y", y0)
          .attr("width", tileW)
          .attr("height", tileH)
          .attr("rx", 8)
          .attr("fill", color)
          .attr("opacity", field.state === "missing" ? 0.85 : 0.9)
          .on("mousemove", (event) =>
            showTooltip(
              event,
              tooltipRows([
                ["Field", field.label],
                ["Samples measured", `${field.measuredCount}/${totalSamples}`],
                ["Samples with action cue", String(field.cueCount)],
              ])
            )
          )
          .on("mouseleave", hideTooltip);
        svg
          .append("text")
          .attr("x", x0 + 12)
          .attr("y", y0 + 21)
          .attr("font", "700 11px Arial, sans-serif")
          .attr("fill", field.state === "missing" ? SCIENTIFIC_COLORS.darkGray : "#ffffff")
          .text(field.label);
        svg
          .append("text")
          .attr("x", x0 + tileW - 12)
          .attr("y", y0 + 21)
          .attr("text-anchor", "end")
          .attr("font", "700 11px Arial, sans-serif")
          .attr("fill", field.state === "missing" ? SCIENTIFIC_COLORS.darkGray : "#ffffff")
          .text(
            field.cueCount
              ? `${field.cueCount} cue${field.cueCount === 1 ? "" : "s"}`
              : field.measuredCount
                ? `${field.measuredCount} checked`
                : "n/a"
          );
      });

      svg
        .append("text")
        .attr("x", 20)
        .attr("y", 222)
        .attr("font", "700 13px Arial, sans-serif")
        .attr("fill", SCIENTIFIC_COLORS.darkGray)
        .text("Representative samples");
      const headerY = 240;
      [
        ["Sample", 30],
        ["Caveats", 184],
        ["Burden", 314],
        ["Fit cosine", 424],
      ].forEach(([label, x0]) => {
        svg
          .append("text")
          .attr("x", x0)
          .attr("y", headerY)
          .attr("font", "700 10px Arial, sans-serif")
          .attr("fill", SCIENTIFIC_COLORS.darkGray)
          .text(label);
      });
      topSamples.forEach((sample, index) => {
        const y0 = 258 + index * 24;
        const caveatCount = activeCaveatCountFor(sample);
        const severity = activeCaveatSeverityFor(sample);
        const burden = evidenceFor(sample, "burden").totalMutations ?? sample.metrics?.totalMutations;
        const cosine = evidenceFor(sample, "reconstruction").cosineSimilarity ?? sample.metrics?.cosineSimilarity;
        svg
          .append("rect")
          .attr("x", 20)
          .attr("y", y0 - 13)
          .attr("width", width - 40)
          .attr("height", 21)
          .attr("rx", 5)
          .attr("fill", index % 2 ? "#ffffff" : "#f8fafc");
        svg
          .append("text")
          .attr("x", 30)
          .attr("y", y0)
          .attr("font", "700 10.5px Arial, sans-serif")
          .attr("fill", SCIENTIFIC_COLORS.darkGray)
          .text(compactPlotLabel(sample.sample, 18));
        svg
          .append("circle")
          .attr("cx", 194)
          .attr("cy", y0 - 4)
          .attr("r", 5)
          .attr("fill", stateColor[severity] || SCIENTIFIC_COLORS.green);
        svg
          .append("text")
          .attr("x", 208)
          .attr("y", y0)
          .attr("font", "700 10.5px Arial, sans-serif")
          .attr("fill", SCIENTIFIC_COLORS.darkGray)
          .text(caveatCount ? `${caveatCount} active` : "none");
        svg
          .append("text")
          .attr("x", 314)
          .attr("y", y0)
          .attr("font", "10.5px Arial, sans-serif")
          .attr("fill", SCIENTIFIC_COLORS.darkGray)
          .text(Number.isFinite(burden) ? formatPlotNumber(burden, 0) : "NA");
        svg
          .append("text")
          .attr("x", 424)
          .attr("y", y0)
          .attr("font", "700 10.5px Arial, sans-serif")
          .attr("fill", SCIENTIFIC_COLORS.green)
          .text(Number.isFinite(cosine) ? formatPlotNumber(cosine, 3) : "NA");
      });

      return {
        data: topSamples,
        components: fieldSummary,
        summary: { totalSamples, caveatSamples, medianFitCosine },
      };
    };
    if (
      publicationBool(publication, "summary", false) ||
      publicationBool(publication, "manuscriptSummary", false)
    ) {
      return renderPublicationSummary();
    }
    const totalSampleCount = samples.length;
    const maxRows = publicationNumber(publication, "maxRows", samples.length, { min: 1, max: samples.length });
    const rowHeight = publicationNumber(publication, "rowHeight", publication?.compact ? 24 : 34, { min: 16, max: 46 });
    const margin = {
      top: publicationNumber(publication, "marginTop", publication?.compact ? 24 : 30, { min: 16 }),
      right: publicationNumber(publication, "marginRight", 32, { min: 12 }),
      bottom: publicationNumber(publication, "marginBottom", 64, { min: 34 }),
      left: publicationNumber(publication, "marginLeft", publication?.compact ? 118 : 150, { min: 80 }),
    };
    const flagWidth = publicationNumber(publication, "flagWidth", publication?.compact ? 190 : 310, { min: 90 });
    const heatGap = publicationNumber(publication, "heatGap", publication?.compact ? 32 : 54, { min: 16 });
    const heatCellWidth = publicationNumber(publication, "heatCellWidth", publication?.compact ? 64 : 88, { min: 44 });
    const heatWidth = components.length * heatCellWidth;
    samples = samples.slice(0, maxRows);
    const displayedSampleCount = samples.length;
    const sampleSubsetText =
      displayedSampleCount < totalSampleCount
        ? `Display shows the ${displayedSampleCount} highest-priority rows from the ${totalSampleCount}-sample cohort.`
        : `Display shows all ${totalSampleCount} samples.`;
    const width = publicationNumber(publication, "width", margin.left + flagWidth + heatGap + heatWidth + margin.right, { min: 520 });
    const innerHeight = Math.max(publicationNumber(publication, "minInnerHeight", publication?.compact ? 160 : 270, { min: 90 }), samples.length * rowHeight);
    const height = innerHeight + margin.top + margin.bottom;
	    const activeCaveatCounts = samples.map((sample) =>
	      activeCaveatCountFor(sample)
	    );
	    const meanFlagCount = activeCaveatCounts.length
	      ? d3.mean(activeCaveatCounts)
	      : fitQualityEvidenceResult.summary?.meanReviewFlagCount;
	    const maxFlagCount = Math.max(
	      1,
	      ...activeCaveatCounts
	    );

		    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
		      title: "Review diagnostics summary",
		      subtitle:
		        `Active caveats are reporting prompts, not failed samples. ${sampleSubsetText} Blue cells are measured diagnostics; yellow and red cells are user-configured action cues.`,
      badges: [
        {
          label: "Samples shown",
          value:
            displayedSampleCount < totalSampleCount
              ? `${displayedSampleCount}/${totalSampleCount}`
              : String(displayedSampleCount),
        },
        {
          label: "Mean active caveats",
          value: Number.isFinite(meanFlagCount)
            ? formatPlotNumber(meanFlagCount, 1)
              : "NA",
          },
        ],
      figureContext: mergeFigureContext(options.figureContext, {
        dataset:
          options.dataset ||
          fitQualityEvidenceResult.dataset ||
          fitQualityEvidenceResult.source,
        samples: totalSampleCount,
        displayedSamples: displayedSampleCount,
        metrics:
          "burden, reconstruction, residual, bootstrap, cutoff, ambiguity, and catalog evidence",
      }),
      publication,
      });
    if (!publicationBool(publication, "hideGuide", false)) {
      appendReviewGuide();
    }
	    const svg = appendResponsiveSvg(chart, width, height, "Review diagnostics summary", publication);
    const y = d3
      .scaleBand()
      .domain(samples.map((sample) => sample.sample))
      .range([0, innerHeight])
      .padding(0.22);
    const x = d3.scaleLinear().domain([0, maxFlagCount]).range([0, flagWidth]);
    const flagPlot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    const heatPlot = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left + flagWidth + heatGap},${margin.top})`
      );

    flagPlot
      .append("g")
      .attr("stroke", SCIENTIFIC_COLORS.lightGray)
      .attr("stroke-opacity", 0.9)
      .call(d3.axisBottom(x).ticks(5).tickSize(innerHeight).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());
	    flagPlot
	      .append("g")
	      .attr("transform", `translate(0,${innerHeight})`)
	      .call(d3.axisBottom(x).ticks(maxFlagCount).tickFormat(d3.format("d")))
	      .call(styleD3Axis);
	    flagPlot
	      .append("text")
	      .attr("x", flagWidth / 2)
	      .attr("y", innerHeight + 42)
	      .attr("text-anchor", "middle")
	      .attr("fill", SCIENTIFIC_COLORS.darkGray)
	      .attr("font", "700 11px Arial, sans-serif")
	      .text("Active caveats");
	    flagPlot
	      .append("g")
	      .call(d3.axisLeft(y).tickSize(0))
	      .call(styleD3Axis)
      .call((axis) => compactD3AxisText(axis, 24))
	      .select(".domain")
	      .remove();

    flagPlot
      .selectAll("rect.msig-fit-quality-flag")
      .data(samples)
      .join("rect")
      .attr("class", "msig-fit-quality-flag")
	      .attr("x", 0)
	      .attr("y", (sample) => y(sample.sample))
	      .attr("width", (sample) => x(activeCaveatCountFor(sample)))
	      .attr("height", y.bandwidth())
	      .attr("rx", 4)
	      .attr(
	        "fill",
	        (sample) =>
	          stateColor[activeCaveatSeverityFor(sample)] ||
	          classColor[reportingModeFor(sample)] ||
	          SCIENTIFIC_COLORS.gray
	      )
      .attr("opacity", 0.88)
      .on("mousemove", (event, sample) =>
        showTooltip(
          event,
		          tooltipRows([
		            ["Sample", sample.sample],
		            ["Active caveats", String(activeCaveatCountFor(sample))],
		            ["Caveats shown", displayActiveCaveats(sample)],
		            ["Mode", classLabel[reportingModeFor(sample)] || reportingModeFor(sample)],
	            [
	              "Meaning",
	              reportingModeMeaning[reportingModeFor(sample)] ||
	                reportingModeFor(sample),
	            ],
	            [
	              "Next",
	              reportingModeAction[reportingModeFor(sample)] ||
	                "Inspect active caveats",
	            ],
			            ["Rule-triggered codes", displayReviewCodes(sample.reviewFlagCodes)],
	            ["Burden class", sample.metrics?.burdenClass || "NA"],
	            ["Cosine", formatPlotNumber(sample.metrics?.cosineSimilarity, 4)],
	            ["Unexplained", d3.format(".1%")(sample.metrics?.unexplainedFraction || 0)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    flagPlot
      .selectAll("text.msig-fit-quality-flag-label")
      .data(samples)
      .join("text")
	      .attr("class", "msig-fit-quality-flag-label")
	      .attr("x", (sample) =>
	        activeCaveatCountFor(sample) >= maxFlagCount * 0.18
	          ? x(activeCaveatCountFor(sample)) - 8
	          : x(activeCaveatCountFor(sample)) + 7
	      )
      .attr("y", (sample) => y(sample.sample) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
	      .attr("text-anchor", (sample) =>
	        activeCaveatCountFor(sample) >= maxFlagCount * 0.18 ? "end" : "start"
	      )
	      .attr("fill", (sample) =>
	        activeCaveatCountFor(sample) >= maxFlagCount * 0.18
	          ? "#ffffff"
	          : SCIENTIFIC_COLORS.darkGray
	      )
	      .attr("font", "700 11px Arial, sans-serif")
	      .text((sample) => activeCaveatCountFor(sample));

    const heatRows = samples.flatMap((sample) =>
      components.map(({ key }) => ({
        sample: sample.sample,
        component: key,
        value: componentValue(sample, key),
        state: componentState(sample, key),
        detailRows: componentDetail(sample, key),
      }))
    );
    const heatTextMaxChars = Math.max(4, Math.floor((heatCellWidth - 12) / 5.4));
    const heatCellX = (row) =>
      components.findIndex(({ key }) => key === row.component) * heatCellWidth;
    const heatClipPrefix = `msig-fit-quality-cell-clip-${Math.random()
      .toString(36)
      .slice(2)}`;

    heatPlot
      .append("defs")
      .selectAll("clipPath.msig-fit-quality-cell-clip")
      .data(heatRows)
      .join("clipPath")
      .attr("class", "msig-fit-quality-cell-clip")
      .attr("id", (_row, index) => `${heatClipPrefix}-${index}`)
      .append("rect")
      .attr("x", (row) => heatCellX(row) + 4)
      .attr("y", (row) => y(row.sample) + 1)
      .attr("width", heatCellWidth - 12)
      .attr("height", Math.max(1, y.bandwidth() - 2));

    heatPlot
      .selectAll("rect.msig-fit-quality-component")
      .data(heatRows)
      .join("rect")
      .attr("class", "msig-fit-quality-component")
      .attr("x", (row) => heatCellX(row))
      .attr("y", (row) => y(row.sample))
      .attr("width", heatCellWidth - 4)
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", (row) => stateColor[row.state] || stateColor.missing)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
          tooltipRows([
            ["Sample", row.sample],
	            [
	              "Field",
	              componentTooltipLabel[row.component] ||
	                componentLabel[row.component] ||
	                row.component,
            ],
            ["Status", stateLabel[row.state] || row.state],
            ["Meaning", cueMeaningFor(row.component, row.state)],
            ["Next", cueActionFor(row.component, row.state)],
            ...row.detailRows,
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    heatPlot
      .selectAll("text.msig-fit-quality-component-label")
      .data(heatRows)
      .join("text")
      .attr("class", "msig-fit-quality-component-label")
      .attr("x", (row) =>
        heatCellX(row) + heatCellWidth / 2 - 2
      )
      .attr("y", (row) => y(row.sample) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("fill", (row) =>
        row.state === "concern" || row.state === "caution" || row.state === "ok"
          ? "#ffffff"
          : SCIENTIFIC_COLORS.darkGray
      )
      .attr("font", "700 9px Arial, sans-serif")
      .attr("clip-path", (_row, index) => `url(#${heatClipPrefix}-${index})`)
      .style("pointer-events", "none")
      .text((row) => compactText(row.value, heatTextMaxChars));
	    const maxHeaderLineCount = Math.max(
	      ...components.map((component) => (component.header || [component.label]).length),
	      1
	    );
	    const headerY = maxHeaderLineCount > 2 ? -38 : -16;
	    const headerDy = maxHeaderLineCount > 2 ? 13 : 11;
	    const headerLabels = heatPlot
	      .selectAll("text.msig-fit-quality-component-header")
	      .data(components)
	      .join("text")
      .attr("class", "msig-fit-quality-component-header")
      .attr("x", (component) =>
        components.findIndex(({ key }) => key === component.key) * heatCellWidth +
        heatCellWidth / 2 -
        2
      )
	      .attr("y", headerY)
	      .attr("text-anchor", "middle")
	      .attr("fill", SCIENTIFIC_COLORS.darkGray)
	      .attr("font", "700 10px Arial, sans-serif");
	    headerLabels
	      .selectAll("tspan")
	      .data((component) => component.header || [component.label])
	      .join("tspan")
	      .attr("x", function () {
	        return this.parentNode.getAttribute("x");
	      })
	      .attr("dy", (_line, index) => (index === 0 ? 0 : headerDy))
	      .text((line) => line);
    headerLabels
      .append("title")
      .text(
        (component) =>
          `${componentTooltipLabel[component.key] || component.label}: ${cueMeaningFor(
            component.key,
            "default"
          )}. ${cueActionFor(component.key, "default")}.`
      );

    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + flagWidth / 2)
      .attr("y", height - 14)
      .attr("text-anchor", "middle")
      .text("Review cue count");
    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + flagWidth + heatGap + heatWidth / 2)
      .attr("y", height - 14)
      .attr("text-anchor", "middle")
      .text("Evidence fields");

    if (publicationBool(publication, "inlineDefinitions", false)) {
      const bootstrapIterations = d3.max(
        samples
          .map((sample) => evidenceFor(sample, "bootstrap").iterations)
          .filter(Number.isFinite)
      );
      const thresholdValues = uniqueStringsForPlot(
        samples.flatMap((sample) => evidenceFor(sample, "threshold").testedThresholds || [])
      )
        .map((value) => Number(value))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      const baselineCutoffs = samples
        .map((sample) => evidenceFor(sample, "threshold").baselineThreshold)
        .filter(Number.isFinite);
      const baselineCutoff = baselineCutoffs.length ? d3.median(baselineCutoffs) : null;
      const thresholdText = thresholdValues.length
        ? thresholdValues.map((value) => formatPlotNumber(value, 3)).join(", ")
        : "configured cutoffs";
      const definitionLines = [
        `Bootstrap: widest 95% exposure CI after ${Number.isFinite(bootstrapIterations) ? formatPlotNumber(bootstrapIterations, 0) : "configured"} refits, shown as % of relative exposure.`,
        `Cutoff max cosine drop: largest decrease from baseline cutoff ${Number.isFinite(baselineCutoff) ? formatPlotNumber(baselineCutoff, 3) : "the baseline"} across tested exposure cutoffs (${thresholdText}).`,
        "Nearest signature cosine: closest pair among active fitted signatures; higher values indicate harder-to-separate signatures.",
      ];
      const definition = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${height - 70})`);
      definition
        .append("line")
        .attr("x1", 0)
        .attr("x2", Math.min(width - margin.left - margin.right, flagWidth + heatGap + heatWidth))
        .attr("y1", -12)
        .attr("y2", -12)
        .attr("stroke", SCIENTIFIC_COLORS.lightGray);
      definitionLines.forEach((line, index) => {
        definition
          .append("text")
          .attr("x", 0)
          .attr("y", index * 16)
          .attr("fill", SCIENTIFIC_COLORS.muted || "#475569")
          .attr("font", "700 10.5px Arial, sans-serif")
          .text(line);
      });
    }

    return { data: samples, components };
  }

  /**
   * Renders metadata-stratified fitted exposure differences.
   *
   * @async
   * @function plotCohortGroupComparison
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} comparisonResult - Group-comparison block returned by a cohort workflow.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotCohortGroupComparison(divID, comparisonResult, options = {}) {
    const rows = [
      ...(comparisonResult.topSignals?.length
        ? comparisonResult.topSignals
        : comparisonResult.comparisons || []),
    ]
      .filter((row) => Number.isFinite(row.meanDifference))
      .slice(0, 18)
      .reverse();

    if (rows.length === 0) {
      return renderPlotError(divID, "No cohort group comparison data available.");
    }

    const maxDifference = Math.max(
      ...rows.map((row) => Math.abs(row.meanDifference)),
      0.01
    );
	    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
	      title: "Group exposure comparison",
	      subtitle:
	        "Exposure differences are comparison group minus reference group.",
      badges: [
        { label: "Group key", value: comparisonResult.groupKey || "group" },
        { label: "Reference", value: comparisonResult.referenceGroup || "NA" },
      ],
      figureContext: mergeFigureContext(options.figureContext, {
        dataset: options.dataset || comparisonResult.dataset || comparisonResult.source,
        groupKey: comparisonResult.groupKey || "group",
        reference: comparisonResult.referenceGroup || "NA",
        metric: "mean exposure difference",
      }),
      publication: options.publication,
    });
    const width = 980;
    const rowHeight = 32;
    const margin = { top: 30, right: 150, bottom: 56, left: 172 };
    const innerHeight = Math.max(280, rows.length * rowHeight);
    const height = innerHeight + margin.top + margin.bottom;
    const svg = appendResponsiveSvg(chart, width, height, "Cohort exposure comparison");
    const x = d3
      .scaleLinear()
      .domain([-maxDifference * 1.15, maxDifference * 1.15])
      .nice()
      .range([0, width - margin.left - margin.right]);
    const y = d3
      .scaleBand()
      .domain(rows.map((row) => `${row.signatureName} ${row.comparisonGroup}`))
      .range([0, innerHeight])
      .padding(0.24);
    const plot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    plot
      .append("g")
      .attr("stroke", SCIENTIFIC_COLORS.lightGray)
      .attr("stroke-opacity", 0.9)
      .call(d3.axisBottom(x).ticks(7).tickSize(innerHeight).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());
    plot
      .append("line")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", SCIENTIFIC_COLORS.darkGray)
      .attr("stroke-width", 1.4);
    plot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format(".2f")))
      .call(styleD3Axis);
	    plot
	      .append("g")
	      .call(d3.axisLeft(y).tickSize(0))
	      .call(styleD3Axis)
      .call((axis) => compactD3AxisText(axis, 30))
	      .select(".domain")
	      .remove();

    plot
      .selectAll("rect.msig-group-diff")
      .data(rows)
      .join("rect")
      .attr("class", "msig-group-diff")
      .attr("x", (row) => Math.min(x(0), x(row.meanDifference)))
      .attr("y", (row) => y(`${row.signatureName} ${row.comparisonGroup}`))
      .attr("width", (row) => Math.abs(x(row.meanDifference) - x(0)))
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", (row) =>
        row.meanDifference >= 0 ? SCIENTIFIC_COLORS.blue : SCIENTIFIC_COLORS.orange
      )
      .attr("opacity", 0.84)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
	          tooltipRows([
	            ["Signature", row.signatureName],
	            ["Reference", row.referenceGroup],
	            ["Comparison", row.comparisonGroup],
	            ["Mean diff", formatPlotNumber(row.meanDifference, 4)],
	            ["Effect size", formatPlotNumber(row.effectSize, 3)],
	            ["p-value", row.pValue === null ? "not evaluated" : formatPlotNumber(row.pValue, 4)],
	            ["q-value", row.qValue === null ? "not evaluated" : formatPlotNumber(row.qValue, 4)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    plot
      .selectAll("text.msig-group-diff-label")
      .data(rows)
      .join("text")
      .attr("class", "msig-group-diff-label")
      .attr("x", (row) =>
        row.meanDifference >= 0
          ? x(row.meanDifference) + 7
          : x(row.meanDifference) - 7
      )
      .attr("y", (row) => y(`${row.signatureName} ${row.comparisonGroup}`) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (row) => (row.meanDifference >= 0 ? "start" : "end"))
      .attr("fill", SCIENTIFIC_COLORS.darkGray)
      .attr("font", "700 10px Arial, sans-serif")
      .text((row) => formatPlotNumber(row.meanDifference, 3));

    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + (width - margin.left - margin.right) / 2)
      .attr("y", height - 14)
      .attr("text-anchor", "middle")
      .text("Mean exposure difference");

    return { data: rows };
  }

  function exposureSignatureNames(exposures, explicitNames = null) {
    if (Array.isArray(explicitNames) && explicitNames.length) {
      return explicitNames.map(String);
    }
    return uniqueStringsForPlot(
      Object.values(exposures || {}).flatMap((row) =>
        Object.keys(row || {}).filter((key) => key !== "rnorm")
      )
    );
  }

  function sampleBurdenFromSpectrum(record) {
    return Object.values(record || {}).reduce((sum, value) => {
      const numeric = Number(value);
      return sum + (Number.isFinite(numeric) ? Math.max(0, numeric) : 0);
    }, 0);
  }

  function fitQualitySampleLookup(fitQuality) {
    const lookup = new Map();
    for (const sample of fitQuality?.samples || []) {
      const name = sample.sample || sample.sampleName;
      if (name) lookup.set(name, sample);
    }
    return lookup;
  }

  function normalizeExposureRowForDisplay(row, signatureNames, { relative = true } = {}) {
    const values = Object.fromEntries(
      signatureNames.map((signature) => [
        signature,
        Math.max(0, Number(row?.[signature]) || 0),
      ])
    );
    if (!relative) return values;
    const total = Object.values(values).reduce((sum, value) => sum + value, 0);
    if (total <= 0) return values;
    return Object.fromEntries(
      signatureNames.map((signature) => [signature, values[signature] / total])
    );
  }

  /**
   * Renders a cohort-level signature-exposure landscape using full-catalog
   * exposures while reducing the display to the top cohort signatures plus
   * an explicit Other remainder.
   *
   * @function plotCohortSignatureSummary
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} cohort - Cohort input with spectra, exposures, fitQuality, and metadata.
   * @param {Object} [options] - Plot options.
   * @returns {Object|Element} Render metadata or an error element.
   */
  function plotCohortSignatureSummary(divID, cohort = {}, options = {}) {
    const publication = resolvePlotPublication(options.publication);
    const exposures = cohort.exposures || cohort.fit?.exposures || {};
    const spectra = cohort.spectra || {};
    const fitQuality = cohort.fitQuality || cohort.fitQualityEvidence || cohort.quality || null;
    const signatureNames = exposureSignatureNames(
      exposures,
      options.signatureNames || cohort.signatureNames
    );
    const sampleNames =
      options.sampleNames ||
      cohort.sampleNames ||
      uniqueStringsForPlot([
        ...Object.keys(exposures || {}),
        ...Object.keys(spectra || {}),
      ]);
    if (!signatureNames.length || !sampleNames.length) {
      return renderPlotError(
        divID,
        "No cohort exposure data available for the signature summary."
      );
    }

    const topN = Math.max(
      1,
      Math.floor(
        Number(options.topN ?? activePlottingOptions.maxDisplaySignatures ?? 12)
      )
    );
    const otherLabel =
      options.otherLabel ||
      activePlottingOptions.otherSignatureLabel ||
      "Other fitted COSMIC SBS";
    const otherDisplayLabel =
      options.otherDisplayLabel ||
      activePlottingOptions.otherSignatureDisplayLabel ||
      "Other";
    const exposureThreshold = Number(options.exposureThreshold ?? 0.01);
    const relative = options.relative !== false;
    const fitLookup = fitQualitySampleLookup(fitQuality);
    const rowsBySample = new Map();
    const signatureTotals = Object.fromEntries(signatureNames.map((name) => [name, 0]));
    const signaturePrevalence = Object.fromEntries(signatureNames.map((name) => [name, 0]));

    for (const sample of sampleNames) {
      const normalized = normalizeExposureRowForDisplay(exposures[sample], signatureNames, {
        relative,
      });
      rowsBySample.set(sample, normalized);
      for (const signature of signatureNames) {
        const value = Number(normalized[signature]) || 0;
        signatureTotals[signature] += value;
        if (value >= exposureThreshold) signaturePrevalence[signature] += 1;
      }
    }

    const orderedSignatures = [...signatureNames].sort(
      (a, b) => signatureTotals[b] - signatureTotals[a] || a.localeCompare(b)
    );
    const shownSignatures = orderedSignatures.slice(0, Math.min(topN, orderedSignatures.length));
    const hiddenSignatures = orderedSignatures.slice(shownSignatures.length);
    const displaySignatures = hiddenSignatures.length
      ? [...shownSignatures, otherLabel]
      : shownSignatures;
    const metadataBySample = new Map(
      (cohort.metadata || []).map((row) => [row.sample || row.sampleName, row])
    );
    const displayRows = sampleNames.map((sample) => {
      const sourceRow = rowsBySample.get(sample) || {};
      const displayValues = Object.fromEntries(
        shownSignatures.map((signature) => [signature, Number(sourceRow[signature]) || 0])
      );
      if (hiddenSignatures.length) {
        displayValues[otherLabel] = hiddenSignatures.reduce(
          (sum, signature) => sum + (Number(sourceRow[signature]) || 0),
          0
        );
      }
      const burden =
        Number(cohort.burdenBySample?.[sample]) ||
        Number(metadataBySample.get(sample)?.totalMutations) ||
        sampleBurdenFromSpectrum(spectra[sample]);
      const fitSample = fitLookup.get(sample) || {};
      const fitCosine =
        Number(fitSample.metrics?.cosineSimilarity) ||
        Number(fitSample.cosineSimilarity) ||
        Number(fitSample.reconstruction?.cosineSimilarity);
      const dominantSignature = displaySignatures.reduce(
        (best, signature) =>
          (Number(displayValues[signature]) || 0) > (Number(displayValues[best]) || 0)
            ? signature
            : best,
        displaySignatures[0]
      );
      return {
        sample,
        values: displayValues,
        burden: Number.isFinite(burden) ? burden : 0,
        fitCosine: Number.isFinite(fitCosine) ? fitCosine : null,
        dominantSignature,
      };
    });

    const signatureSummary = displaySignatures.map((signature) => {
      const hidden = signature === otherLabel;
      const total = hidden
        ? hiddenSignatures.reduce((sum, name) => sum + signatureTotals[name], 0)
        : signatureTotals[signature];
      const prevalence = hidden
        ? displayRows.filter((row) => (Number(row.values[signature]) || 0) >= exposureThreshold).length
        : signaturePrevalence[signature];
      return {
        signature,
        displayLabel: hidden ? otherDisplayLabel : signature,
        hidden,
        total,
        mean: sampleNames.length ? total / sampleNames.length : 0,
        prevalence,
        prevalenceFraction: sampleNames.length ? prevalence / sampleNames.length : 0,
      };
    });

    displayRows.sort((a, b) => {
      const groupCmp =
        displaySignatures.indexOf(a.dominantSignature) -
        displaySignatures.indexOf(b.dominantSignature);
      return groupCmp || b.burden - a.burden || a.sample.localeCompare(b.sample);
    });

    const maxExposure = Math.max(
      0.01,
      ...displayRows.flatMap((row) => displaySignatures.map((signature) => row.values[signature] || 0))
    );
    const maxBurden = Math.max(1, ...displayRows.map((row) => row.burden || 0));
    const minCosine = Math.max(
      0,
      Math.min(
        ...displayRows
          .map((row) => row.fitCosine)
          .filter((value) => Number.isFinite(value)),
        1
      ) - 0.02
    );
    const displayCountText = hiddenSignatures.length
      ? `${shownSignatures.length} + Other`
      : String(shownSignatures.length);
    const catalogName =
      options.signatureCatalog ||
      cohort.signatureCatalog ||
      cohort.catalog ||
      "COSMIC SBS96";
    const dataset =
      options.dataset || cohort.dataset || cohort.source || "Cohort";
    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
      title: options.title || "Cohort signature exposure landscape",
      subtitle:
        options.subtitle ||
        `${sampleNames.length} samples fitted against the full ${catalogName}; display shows top ${shownSignatures.length} cohort signatures${hiddenSignatures.length ? " plus an explicit Other remainder" : ""}.`,
      badges: [
        { label: "Samples", value: String(sampleNames.length) },
        { label: "Catalog signatures", value: String(signatureNames.length) },
        { label: "Displayed", value: displayCountText },
        { label: "Exposure cutoff", value: formatPlotNumber(exposureThreshold, 3) },
      ],
      figureContext: mergeFigureContext(options.figureContext, {
        dataset,
        samples: sampleNames.length,
        signatureCatalog: catalogName,
        signatures: signatureNames.length,
        displayedSignatures: displayCountText,
        exposureThreshold,
      }),
      publication,
      caption:
        options.caption ||
        `${dataset}: full-catalog signature fitting summarized as a cohort exposure landscape. Signatures are ranked by total cohort exposure; lower-ranked signatures are retained in the computation and grouped only for display as ${otherDisplayLabel} (${otherLabel}).`,
      maxWidth: options.maxWidth || "1180px",
    });

    const rowHeight = publicationNumber(publication, "rowHeight", publication?.compact ? 16 : 19, { min: 12, max: 34 });
    const cellWidth = publicationNumber(publication, "cellWidth", publication?.compact ? 54 : 60, { min: 32, max: 82 });
    const sampleLabelWidth = publicationNumber(publication, "sampleLabelWidth", 128, { min: 86, max: 190 });
    const burdenWidth = publicationNumber(publication, "burdenWidth", 88, { min: 60, max: 140 });
    const fitWidth = publicationNumber(publication, "fitWidth", 92, { min: 64, max: 140 });
    const x0 = 34;
    const y0 = 190;
    const heatWidth = displaySignatures.length * cellWidth;
    const heatHeight = Math.max(displayRows.length * rowHeight, 120);
    const width = publicationNumber(
      publication,
      "width",
      x0 + sampleLabelWidth + 10 + burdenWidth + 14 + heatWidth + 16 + fitWidth + 36,
      { min: 720 }
    );
    const height = publicationNumber(publication, "height", y0 + heatHeight + 92, { min: 420 });
    const svg = appendResponsiveSvg(chart, width, height, "Cohort signature exposure landscape", publication);
    const sampleX = x0;
    const burdenX = sampleX + sampleLabelWidth + 10;
    const heatX = burdenX + burdenWidth + 14;
    const fitX = heatX + heatWidth + 16;
    const burdenScale = d3.scaleLinear().domain([0, maxBurden]).range([0, burdenWidth]);
    const cosineScale = d3.scaleLinear().domain([minCosine, 1]).range([0, fitWidth]);
    const color = d3.scaleSequential(d3.interpolateViridis).domain([0, Math.max(maxExposure, 0.2)]);
    const totalScale = d3
      .scaleLinear()
      .domain([0, d3.max(signatureSummary, (row) => row.total) || 1])
      .range([0, 74]);

    svg.append("text").attr("x", sampleX).attr("y", 34).attr("font", "800 14px Arial, sans-serif").attr("fill", SCIENTIFIC_COLORS.darkGray).text("Signature totals across cohort");
    signatureSummary.forEach((summary, index) => {
      const x = heatX + index * cellWidth;
      svg
        .append("rect")
        .attr("x", x + cellWidth * 0.24)
        .attr("y", 116 - totalScale(summary.total))
        .attr("width", cellWidth * 0.52)
        .attr("height", totalScale(summary.total))
        .attr("rx", 4)
        .attr("fill", summary.hidden ? SCIENTIFIC_COLORS.gray : SCIENTIFIC_COLORS.blue)
        .attr("opacity", 0.82)
        .on("mousemove", (event) =>
          showTooltip(
            event,
            tooltipRows([
              ["Signature", summary.signature],
              ["Mean exposure", d3.format(".1%")(summary.mean)],
              ["Total exposure", formatPlotNumber(summary.total, 3)],
              ["Samples >= cutoff", `${summary.prevalence}/${sampleNames.length}`],
              ["Display", summary.hidden ? `${hiddenSignatures.length} lower-ranked signatures` : "Top cohort signature"],
            ])
          )
        )
        .on("mouseleave", hideTooltip);
      svg
        .append("text")
        .attr("class", "msig-cohort-signature-label")
        .attr("x", x + cellWidth / 2)
        .attr("y", 136)
        .attr("text-anchor", "middle")
        .attr("font", "800 11px Arial, sans-serif")
        .attr("fill", SCIENTIFIC_COLORS.darkGray)
        .text(compactPlotLabel(summary.displayLabel, cellWidth < 48 ? 8 : 11))
        .append("title")
        .text(summary.hidden ? `${summary.displayLabel}: ${summary.signature}` : summary.signature);
      svg
        .append("text")
        .attr("class", "msig-cohort-prevalence-label")
        .attr("x", x + cellWidth / 2)
        .attr("y", 152)
        .attr("text-anchor", "middle")
        .attr("font", "700 9.5px Arial, sans-serif")
        .attr("fill", SCIENTIFIC_COLORS.gray)
        .text(d3.format(".0%")(summary.prevalenceFraction));
    });
    if (hiddenSignatures.length) {
      const otherIndex = signatureSummary.findIndex((summary) => summary.hidden);
      const otherBarX = heatX + Math.max(0, otherIndex) * cellWidth;
      const otherNoteWidth = publicationNumber(publication, "otherNoteWidth", 136, {
        min: 110,
        max: 220,
      });
      const otherNoteX = Math.min(
        otherBarX + cellWidth + 8,
        width - 34 - otherNoteWidth
      );
      const otherNoteY = 54;
      const otherNoteHeight = 58;
      svg
        .append("path")
        .attr(
          "d",
          `M${otherNoteX + 4},${otherNoteY + otherNoteHeight / 2} L${otherBarX + cellWidth / 2},${118}`
        )
        .attr("fill", "none")
        .attr("stroke", "#94A3B8")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3 3")
        .attr("opacity", 0.8);
      svg
        .append("rect")
        .attr("class", "msig-cohort-other-note-bg")
        .attr("x", otherNoteX)
        .attr("y", otherNoteY)
        .attr("width", otherNoteWidth)
        .attr("height", otherNoteHeight)
        .attr("rx", 8)
        .attr("fill", "#FFFFFF")
        .attr("stroke", "#CBD5E1");
      const otherLines = [
        otherDisplayLabel,
        `${hiddenSignatures.length} lower-ranked`,
        "COSMIC SBS signatures",
      ];
      otherLines.forEach((line, index) => {
        svg
          .append("text")
          .attr("class", "msig-cohort-other-note")
          .attr("x", otherNoteX + 10)
          .attr("y", otherNoteY + 18 + index * 16)
          .attr("font", index === 0 ? "800 12px Arial, sans-serif" : "700 10.5px Arial, sans-serif")
          .attr("fill", index === 0 ? SCIENTIFIC_COLORS.darkGray : SCIENTIFIC_COLORS.gray)
          .text(line);
      });
    }
    svg.append("text").attr("x", heatX).attr("y", 168).attr("font", "800 13px Arial, sans-serif").attr("fill", SCIENTIFIC_COLORS.darkGray).text("Relative exposure per sample");
    svg.append("text").attr("x", sampleX).attr("y", y0 - 12).attr("font", "800 12px Arial, sans-serif").attr("fill", SCIENTIFIC_COLORS.gray).text("Sample");
    svg.append("text").attr("x", burdenX).attr("y", y0 - 12).attr("font", "800 12px Arial, sans-serif").attr("fill", SCIENTIFIC_COLORS.gray).text("Burden");
    svg.append("text").attr("x", fitX).attr("y", y0 - 12).attr("font", "800 12px Arial, sans-serif").attr("fill", SCIENTIFIC_COLORS.gray).text("Fit cosine");

    const rows = svg
      .append("g")
      .selectAll("g.msig-cohort-summary-row")
      .data(displayRows)
      .join("g")
      .attr("class", "msig-cohort-summary-row")
      .attr("transform", (_row, index) => `translate(0,${y0 + index * rowHeight})`);

    rows
      .append("rect")
      .attr("x", sampleX - 4)
      .attr("y", -1)
      .attr("width", width - sampleX - 26)
      .attr("height", rowHeight)
      .attr("fill", (_row, index) => (index % 2 ? "#ffffff" : "#F8FAFC"));
    rows
      .append("text")
      .attr("x", sampleX)
      .attr("y", rowHeight / 2 + 4)
      .attr("font", "700 10.5px Arial, sans-serif")
      .attr("fill", SCIENTIFIC_COLORS.darkGray)
      .text((row) => compactPlotLabel(row.sample, 18))
      .append("title")
      .text((row) => row.sample);
    rows
      .append("rect")
      .attr("x", burdenX)
      .attr("y", rowHeight / 2 - 5)
      .attr("width", burdenWidth)
      .attr("height", 10)
      .attr("rx", 4)
      .attr("fill", "#E5E7EB");
    rows
      .append("rect")
      .attr("x", burdenX)
      .attr("y", rowHeight / 2 - 5)
      .attr("width", (row) => burdenScale(row.burden))
      .attr("height", 10)
      .attr("rx", 4)
      .attr("fill", SCIENTIFIC_COLORS.sky)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
          tooltipRows([
            ["Sample", row.sample],
            ["Mutation burden", formatPlotNumber(row.burden, 0)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    rows
      .selectAll("rect.msig-cohort-exposure-cell")
      .data((row) =>
        displaySignatures.map((signature) => ({
          sample: row.sample,
          signature,
          exposure: Number(row.values[signature]) || 0,
          dominantSignature: row.dominantSignature,
        }))
      )
      .join("rect")
      .attr("class", "msig-cohort-exposure-cell")
      .attr("x", (cell) => heatX + displaySignatures.indexOf(cell.signature) * cellWidth)
      .attr("y", 1)
      .attr("width", cellWidth - 2)
      .attr("height", rowHeight - 2)
      .attr("rx", 2)
      .attr("fill", (cell) => (cell.exposure > 0 ? color(cell.exposure) : "#F8FAFC"))
      .attr("stroke", (cell) =>
        cell.signature === cell.dominantSignature ? SCIENTIFIC_COLORS.darkGray : "#ffffff"
      )
      .attr("stroke-width", (cell) => (cell.signature === cell.dominantSignature ? 1.3 : 0.7))
      .on("mousemove", (event, cell) =>
        showTooltip(
          event,
          tooltipRows([
            ["Sample", cell.sample],
            ["Signature", cell.signature],
            ["Exposure", d3.format(".2%")(cell.exposure)],
            ["Dominant", cell.signature === cell.dominantSignature ? "yes" : "no"],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    rows
      .append("rect")
      .attr("x", fitX)
      .attr("y", rowHeight / 2 - 5)
      .attr("width", fitWidth)
      .attr("height", 10)
      .attr("rx", 4)
      .attr("fill", "#F0EFE3");
    rows
      .append("circle")
      .attr("cx", (row) =>
        fitX + (Number.isFinite(row.fitCosine) ? cosineScale(row.fitCosine) : 0)
      )
      .attr("cy", rowHeight / 2)
      .attr("r", (row) => (Number.isFinite(row.fitCosine) ? 4.3 : 0))
      .attr("fill", SCIENTIFIC_COLORS.orange)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.2)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
          tooltipRows([
            ["Sample", row.sample],
            ["Fit cosine", Number.isFinite(row.fitCosine) ? formatPlotNumber(row.fitCosine, 4) : "NA"],
          ])
        )
      )
      .on("mouseleave", hideTooltip);

    const legendX = heatX;
    const legendY = height - 38;
    const legendWidth = Math.min(240, heatWidth);
    const gradientId = `msig-cohort-exposure-gradient-${Math.random().toString(36).slice(2)}`;
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient").attr("id", gradientId).attr("x1", "0%").attr("x2", "100%");
    d3.range(0, 1.01, 0.1).forEach((stop) => {
      gradient.append("stop").attr("offset", `${stop * 100}%`).attr("stop-color", color(stop * maxExposure));
    });
    svg
      .append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", 12)
      .attr("rx", 6)
      .attr("fill", `url(#${gradientId})`);
    svg.append("text").attr("x", legendX).attr("y", legendY - 8).attr("font", "700 11px Arial, sans-serif").attr("fill", SCIENTIFIC_COLORS.gray).text("Relative exposure");
    svg.append("text").attr("x", legendX).attr("y", legendY + 30).attr("font", "700 10px Arial, sans-serif").attr("fill", SCIENTIFIC_COLORS.gray).text("0");
    svg.append("text").attr("x", legendX + legendWidth).attr("y", legendY + 30).attr("text-anchor", "end").attr("font", "700 10px Arial, sans-serif").attr("fill", SCIENTIFIC_COLORS.gray).text(d3.format(".0%")(maxExposure));
    svg
      .append("text")
      .attr("x", fitX)
      .attr("y", legendY + 4)
      .attr("font", "700 11px Arial, sans-serif")
      .attr("fill", SCIENTIFIC_COLORS.gray)
      .text(`Fit cosine scale: ${formatPlotNumber(minCosine, 3)} to 1`);

    return {
      samples: displayRows,
      signatures: signatureSummary,
      fullSignatureCount: signatureNames.length,
      displayedSignatures: displaySignatures,
      hiddenSignatures,
      topN,
      otherLabel: hiddenSignatures.length ? otherLabel : null,
      otherDisplayLabel: hiddenSignatures.length ? otherDisplayLabel : null,
    };
  }

  /**
   * Renders panel/WES evidence calls as a sample-by-signature matrix.
   *
   * @async
   * @function plotPanelEvidenceMatrix
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} panelResultOrEvidenceCalls - runPanelWorkflow result or evidenceCalls object.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotPanelEvidenceMatrix(divID, panelResultOrEvidenceCalls, options = {}) {
    const evidenceCalls =
      panelResultOrEvidenceCalls.evidenceCalls || panelResultOrEvidenceCalls;
    const rows = Object.entries(evidenceCalls || {}).flatMap(([sample, calls]) =>
      (calls || []).map((call) => ({ sample, ...call }))
    );

    if (rows.length === 0) {
      return renderPlotError(divID, "No panel evidence calls available.");
    }

    const sampleNames = uniqueStringsForPlot(rows.map((row) => row.sample));
    const signatureNames = uniqueStringsForPlot(rows.map((row) => row.signatureName));
    const tierColor = {
      higher_review_support: SCIENTIFIC_COLORS.green,
      limited_review_support: SCIENTIFIC_COLORS.blue,
      not_detected_within_review_settings: "#f1f5f9",
      strong_evidence: SCIENTIFIC_COLORS.green,
      weak_evidence: SCIENTIFIC_COLORS.blue,
      not_detected: "#f1f5f9",
      not_assessable: SCIENTIFIC_COLORS.orange,
    };
    const tierLabel = {
      higher_review_support: "Higher review",
      limited_review_support: "Limited review",
      not_detected_within_review_settings: "Below threshold",
      strong_evidence: "Higher review",
      weak_evidence: "Limited review",
      not_detected: "Below threshold",
      not_assessable: "Not assessable",
    };
    const width = Math.max(860, 170 + signatureNames.length * 86);
    const rowHeight = 36;
    const margin = { top: 76, right: 34, bottom: 62, left: 150 };
    const innerHeight = Math.max(260, sampleNames.length * rowHeight);
    const height = innerHeight + margin.top + margin.bottom;
    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
	      title: "Panel/WES review evidence matrix",
	      subtitle:
	        "Evidence tiers combine exposure, burden, fit quality, and callable-territory checks.",
      badges: [
        { label: "Samples", value: String(sampleNames.length) },
        { label: "Signatures", value: String(signatureNames.length) },
      ],
      figureContext: mergeFigureContext(options.figureContext, {
        dataset:
          options.dataset ||
          panelResultOrEvidenceCalls.dataset ||
          panelResultOrEvidenceCalls.source,
        assay: options.assay || panelResultOrEvidenceCalls.assay || "panel/WES",
        samples: sampleNames.length,
        signatures: signatureNames.length,
        metric: "restricted-assay evidence tier",
      }),
      publication: options.publication,
    });
    const svg = appendResponsiveSvg(chart, width, height, "Panel evidence matrix");
    const x = d3
      .scaleBand()
      .domain(signatureNames)
      .range([0, width - margin.left - margin.right])
      .padding(0.08);
    const y = d3
      .scaleBand()
      .domain(sampleNames)
      .range([0, innerHeight])
      .padding(0.08);
    const plot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    plot
      .append("g")
      .attr("transform", `translate(0,-8)`)
	      .call(d3.axisTop(x).tickSize(0))
	      .call(styleD3Axis)
      .call((axis) => compactD3AxisText(axis, 16))
	      .selectAll("text")
	      .attr("transform", "rotate(-35)")
      .attr("text-anchor", "start")
      .attr("dx", "0.35em")
      .attr("dy", "-0.2em");
	    plot
	      .append("g")
	      .call(d3.axisLeft(y).tickSize(0))
	      .call(styleD3Axis)
      .call((axis) => compactD3AxisText(axis, 24))
	      .select(".domain")
	      .remove();

    plot
      .selectAll("rect.msig-panel-evidence")
      .data(rows)
      .join("rect")
      .attr("class", "msig-panel-evidence")
      .attr("x", (row) => x(row.signatureName))
      .attr("y", (row) => y(row.sample))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", (row) => tierColor[row.tier] || SCIENTIFIC_COLORS.gray)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.2)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
          tooltipRows([
            ["Sample", row.sample],
	            ["Signature", row.signatureName],
	            ["Tier", tierLabel[row.tier] || row.tier],
	            ["Exposure", d3.format(".1%")(row.exposure || 0)],
	            ["Mutations", row.totalMutations],
            [
	              "Callable mass",
              Number.isFinite(
                row.restrictedAssayEvidence?.callableEvidence
                  ?.signatureMassInCallableContexts
              )
                ? d3.format(".0%")(
                    row.restrictedAssayEvidence.callableEvidence
                      .signatureMassInCallableContexts
                  )
                : "NA",
            ],
            [
	              "Expected muts",
              formatPlotNumber(
                row.restrictedAssayEvidence?.expectedSignatureMutations,
                2
              ),
            ],
            [
	              "Callable muts",
              formatPlotNumber(
                row.restrictedAssayEvidence?.expectedCallableSignatureMutations,
                2
              ),
            ],
	            ["Mode", row.fitQualityReportingMode || row.reportingMode || "NA"],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    plot
      .selectAll("text.msig-panel-evidence-label")
      .data(rows)
      .join("text")
      .attr("class", "msig-panel-evidence-label")
      .attr("x", (row) => x(row.signatureName) + x.bandwidth() / 2)
      .attr("y", (row) => y(row.sample) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("fill", (row) =>
        row.tier === "not_detected" ||
        row.tier === "not_detected_within_review_settings"
          ? SCIENTIFIC_COLORS.gray
          : "#ffffff"
      )
      .attr("font", "700 10px Arial, sans-serif")
      .text((row) =>
        row.tier === "not_detected" ||
        row.tier === "not_detected_within_review_settings"
          ? ""
          : d3.format(".0%")(row.exposure || 0)
      );

    return { data: rows, samples: sampleNames, signatures: signatureNames };
  }

  function spectrumRecordToProfileRows(record, sample, contexts = null) {
    const entries =
      contexts && contexts.length
        ? contexts.map((context) => [context, record?.[context]])
        : Object.entries(record || {});

    return entries.map(([mutationType, value]) => {
      const numericValue = Number(value);
      return {
        sample,
        profile: "SBS",
        mutationType,
        mutations: Number.isFinite(numericValue) ? numericValue : 0,
      };
    });
  }

  const SBS96_BASES = ["A", "C", "G", "T"];
  const SBS96_SUBSTITUTIONS = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];
  const SBS96_COSMIC_COLORS = {
    "C>A": "#4EB3D3",
    "C>G": "#111827",
    "C>T": "#DC2626",
    "T>A": "#B8BDC7",
    "T>C": "#16A34A",
    "T>G": "#E879B9",
  };
  const SBS96_CONTEXT_PATTERN = /^([ACGT])\[([CT]>[ACGT])\]([ACGT])$/;

  function getCosmicSbs96Contexts(contexts = null) {
    const canonicalContexts = SBS96_SUBSTITUTIONS.flatMap((substitution) =>
      SBS96_BASES.flatMap((fivePrime) =>
        SBS96_BASES.map((threePrime) => `${fivePrime}[${substitution}]${threePrime}`)
      )
    );
    if (!contexts || contexts.length === 0) {
      return canonicalContexts;
    }

    const suppliedSet = new Set(contexts);
    const ordered = canonicalContexts.filter((context) => suppliedSet.has(context));
    const extra = contexts.filter((context) => !canonicalContexts.includes(context));
    return [...ordered, ...extra];
  }

  function looksLikeSbs96Record(value) {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).some((key) => SBS96_CONTEXT_PATTERN.test(key))
    );
  }

  function normalizeSbs96SpectrumCollection(spectra, fallbackSample = "Spectrum") {
    if (looksLikeSbs96Record(spectra)) {
      return { [fallbackSample]: spectra };
    }

    return Object.fromEntries(
      Object.entries(spectra || {}).filter(([, value]) => looksLikeSbs96Record(value))
    );
  }

  function sbs96RowsForCosmicPlot(record, contexts, normalize) {
    const total = contexts.reduce((sum, context) => {
      const value = Number(record?.[context]);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const useRelativeScale =
      normalize === true || (normalize === "auto" && total > 0 && total <= 1.000001);

    return contexts.map((context, index) => {
      const match = context.match(SBS96_CONTEXT_PATTERN);
      const countValue = Number(record?.[context]);
      const count = Number.isFinite(countValue) ? countValue : 0;
      const proportion = total > 0 ? count / total : 0;
      const substitution = match?.[2] || "Other";

      return {
        context,
        fivePrime: match?.[1] || "",
        substitution,
        threePrime: match?.[3] || "",
        count,
        proportion,
        value: useRelativeScale ? proportion : count,
        index,
      };
    });
  }

  /**
   * Renders a COSMIC-style SBS96 bar profile grouped by the six base-substitution classes.
   *
   * @function plotCosmicSbs96Profile
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} spectra - Either one SBS96 record or a sample-keyed spectra object.
   * @param {Object} [options] - Plot options.
   * @param {string} [options.sample=null] - Sample or group to render.
   * @param {string[]} [options.contexts=null] - Optional context order.
   * @param {boolean|string} [options.normalize=false] - Use true for relative fractions or "auto" for probability-like input.
   * @param {string} [options.title="COSMIC-style SBS96 profile"] - Figure title.
   * @param {string} [options.subtitle=null] - Figure subtitle.
   * @param {boolean} [options.showContextLabels=false] - Render all trinucleotide context labels on the x-axis.
   * @param {string} [options.contextLabelMode="none"] - Use "compact" for manuscript-scale all-context labels without horizontal scrolling.
   * @param {string|string[]} [options.highlightContexts=[]] - Context labels to outline in the plot.
   * @returns {Object|Element} Render metadata or an error element.
   */
  function plotCosmicSbs96Profile(divID, spectra, options = {}) {
    const {
      sample = null,
      sampleName = null,
      contexts = null,
      normalize = false,
      showContextLabels = false,
      highlightContexts = [],
      title = "COSMIC-style SBS96 profile",
      subtitle =
        "Bars are grouped by the six SBS classes used in COSMIC-style signature plots. Hover over a bar to see the full trinucleotide context.",
      figureContext = null,
      publication = null,
      dataset = null,
      signatureCatalog = null,
    } = options;
    const fallbackSample = sampleName || sample || "Spectrum";
    const collection = normalizeSbs96SpectrumCollection(spectra, fallbackSample);
    const sampleNames = Object.keys(collection);

    if (sampleNames.length === 0) {
      return renderPlotError(divID, "No SBS96 spectra available to plot.");
    }

    const selectedSample =
      sampleNames.find((name) => name === sampleName || name === sample) || sampleNames[0];
    const record = collection[selectedSample];
    const orderedContexts = getCosmicSbs96Contexts(
      contexts && contexts.length ? contexts : Object.keys(record || {})
    );
    const rows = sbs96RowsForCosmicPlot(record, orderedContexts, normalize);
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const useRelativeScale =
      normalize === true || (normalize === "auto" && total > 0 && total <= 1.000001);
    const maxValue = d3.max(rows, (row) => row.value) || 0;
    const highlightedContexts = new Set(
      (Array.isArray(highlightContexts) ? highlightContexts : [highlightContexts])
        .filter(Boolean)
        .map((context) => String(context).toUpperCase())
    );
    const rawContextLabelMode =
      options.contextLabelMode ??
      publication?.contextLabelMode ??
      (showContextLabels ? "full" : "none");
    const contextLabelMode =
      rawContextLabelMode === true
        ? "full"
        : rawContextLabelMode === false || rawContextLabelMode == null
          ? "none"
          : String(rawContextLabelMode).toLowerCase();
    const showAxisContextLabels =
      contextLabelMode !== "none" && contextLabelMode !== "false";
    const compactContextLabels =
      contextLabelMode === "compact" || contextLabelMode === "manuscript";
    const scrollContextLabels = showAxisContextLabels && !compactContextLabels;
    const showAxisTitles = publicationBool(publication, "showAxisTitles", true);
    const showXAxisTitle = publicationBool(publication, "showXAxisTitle", showAxisTitles);
    const showYAxisTitle = publicationBool(publication, "showYAxisTitle", showAxisTitles);
    const showContextCaption = publicationBool(publication, "showContextCaption", true);

    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
      title,
      subtitle,
      maxWidth: scrollContextLabels ? "100%" : "1080px",
      badges: [
        { label: "Sample shown", value: selectedSample },
        {
          label: useRelativeScale ? "Total fraction" : "Total mutations",
          value: useRelativeScale ? d3.format(".2f")(total) : formatPlotNumber(total, 0),
        },
        { label: "Contexts", value: orderedContexts.length },
      ],
      figureContext: mergeFigureContext(figureContext, {
        dataset,
        sample: selectedSample,
        profile: "SBS",
        matrix: orderedContexts.length,
        signatureCatalog,
        scale: useRelativeScale ? "relative fraction" : "mutation count",
      }),
      publication,
    });

    const baseWidth = publicationNumber(publication, "width", 1080, { min: 420 });
    const width = scrollContextLabels
      ? Math.max(baseWidth, 116 + orderedContexts.length * 18)
      : baseWidth;
    const height = publicationNumber(
      publication,
      "height",
      showAxisContextLabels ? (compactContextLabels ? 560 : 660) : 500,
      { min: 260 }
    );
    const margin = {
      top: publicationNumber(publication, "marginTop", 60, { min: 30 }),
      right: publicationNumber(publication, "marginRight", 34, { min: 12 }),
      bottom: publicationNumber(
        publication,
        "marginBottom",
        showAxisContextLabels
          ? compactContextLabels
            ? showContextCaption
              ? 142
              : 118
            : showContextCaption
              ? 220
              : 190
          : showXAxisTitle || showContextCaption
            ? 78
            : 34,
        { min: 44 }
      ),
      left: publicationNumber(publication, "marginLeft", 82, { min: 50 }),
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const svg = appendResponsiveSvg(chart, width, height, "COSMIC-style SBS96 profile", publication);
    if (scrollContextLabels) {
      const scrollFrame = document.createElement("div");
      scrollFrame.className = "msig-d3-horizontal-scroll";
      chart.insertBefore(scrollFrame, svg.node());
      scrollFrame.appendChild(svg.node());
      svg.attr("width", width).style("width", `${width}px`).style("height", "auto");
    }
    const plot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(orderedContexts)
      .range([0, innerWidth])
      .paddingInner(0.14);
    const yDomainMax = useRelativeScale
      ? maxValue > 0
        ? maxValue * 1.15
        : 1
      : maxValue > 0
        ? Math.max(1, maxValue * 1.12)
        : 1;
    const yTickValues = useRelativeScale
      ? null
      : integerTickValuesForCountAxis(maxValue, 5);
    const y = d3
      .scaleLinear()
      .domain([0, yDomainMax])
      .range([innerHeight, 0]);

    plot
      .append("g")
      .selectAll("line")
      .data(useRelativeScale ? y.ticks(5) : yTickValues)
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (tick) => y(tick))
      .attr("y2", (tick) => y(tick))
      .attr("stroke", SCIENTIFIC_COLORS.lightGray)
      .attr("stroke-width", 1);

    const yAxisGenerator = d3
      .axisLeft(y)
      .tickFormat(useRelativeScale ? d3.format(".0%") : d3.format("d"));
    if (useRelativeScale) {
      yAxisGenerator.ticks(5);
    } else {
      yAxisGenerator.tickValues(yTickValues);
    }
    const yAxis = plot.append("g").call(yAxisGenerator);
    styleD3Axis(yAxis);

    const groupedContexts = SBS96_SUBSTITUTIONS.map((substitution) => ({
      substitution,
      contexts: rows.filter((row) => row.substitution === substitution).map((row) => row.context),
    })).filter((group) => group.contexts.length > 0);

    plot
      .selectAll("rect.msigsdk-sbs96-band")
      .data(groupedContexts)
      .join("rect")
      .attr("class", "msigsdk-sbs96-band")
      .attr("x", (group) => x(group.contexts[0]) || 0)
      .attr("y", -38)
      .attr("width", (group) => {
        const first = x(group.contexts[0]) || 0;
        const last = x(group.contexts[group.contexts.length - 1]) || first;
        return last - first + x.bandwidth();
      })
      .attr("height", 24)
      .attr("rx", 2)
      .attr("fill", (group) => SBS96_COSMIC_COLORS[group.substitution] || SCIENTIFIC_COLORS.gray)
      .attr("opacity", 0.96);

    plot
      .selectAll("text.msigsdk-sbs96-band-label")
      .data(groupedContexts)
      .join("text")
      .attr("class", "msigsdk-sbs96-band-label")
      .attr("x", (group) => {
        const first = x(group.contexts[0]) || 0;
        const last = x(group.contexts[group.contexts.length - 1]) || first;
        return (first + last + x.bandwidth()) / 2;
      })
      .attr("y", -22)
      .attr("text-anchor", "middle")
      .attr("fill", (group) =>
        group.substitution === "T>A" ? SCIENTIFIC_COLORS.darkGray : "#ffffff"
      )
      .attr("font", "700 12px Arial, sans-serif")
      .text((group) => group.substitution);

    plot
      .selectAll("line.msigsdk-sbs96-separator")
      .data(groupedContexts.slice(1))
      .join("line")
      .attr("class", "msigsdk-sbs96-separator")
      .attr("x1", (group) => (x(group.contexts[0]) || 0) - 4)
      .attr("x2", (group) => (x(group.contexts[0]) || 0) - 4)
      .attr("y1", -42)
      .attr("y2", innerHeight)
      .attr("stroke", "#9CA3AF")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 4");

    plot
      .selectAll("rect.msigsdk-sbs96-bar")
      .data(rows)
      .join("rect")
      .attr("class", "msigsdk-sbs96-bar")
      .attr("x", (row) => x(row.context) || 0)
      .attr("y", (row) => y(row.value))
      .attr("width", x.bandwidth())
      .attr("height", (row) => innerHeight - y(row.value))
      .attr("fill", (row) => SBS96_COSMIC_COLORS[row.substitution] || SCIENTIFIC_COLORS.gray)
      .attr("stroke", (row) =>
        highlightedContexts.has(row.context.toUpperCase())
          ? SCIENTIFIC_COLORS.darkGray
          : "rgba(255,255,255,0.65)"
      )
      .attr("stroke-width", (row) =>
        highlightedContexts.has(row.context.toUpperCase()) ? 2.4 : 0.4
      )
      .on("mousemove", (event, row) => {
        showTooltip(
          event,
          tooltipRows([
            ["Context", row.context],
            ["SBS class", row.substitution],
            ["Count", formatPlotNumber(row.count, 3)],
            ["Fraction of sample", d3.format(".2%")(row.proportion)],
          ])
        );
      })
      .on("mouseleave", hideTooltip);

    const xAxis = plot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(showAxisContextLabels ? orderedContexts : [])
          .tickSizeOuter(0)
      );
    styleD3Axis(xAxis);
    if (showAxisContextLabels) {
      const contextLabelFontSize = publicationNumber(
        publication,
        "contextLabelFontSize",
        compactContextLabels ? 8.5 : 9,
        { min: 6, max: 12 }
      );
      xAxis
        .selectAll("text")
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "end")
        .attr("dx", "-0.7em")
        .attr("dy", "-0.32em")
        .attr("font-size", contextLabelFontSize)
        .attr("fill", (context) =>
          highlightedContexts.has(String(context).toUpperCase())
            ? SCIENTIFIC_COLORS.darkGray
            : SCIENTIFIC_COLORS.gray
        )
        .attr("font-weight", (context) =>
          highlightedContexts.has(String(context).toUpperCase()) ? 800 : 500
        );
    }

    if (showYAxisTitle) {
      plot
        .append("text")
        .attr("class", "msig-d3-axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -62)
        .attr("text-anchor", "middle")
        .text(useRelativeScale ? "Fraction of SBS mutations" : "Number of SBS mutations");
    }

    if (showXAxisTitle) {
      plot
        .append("text")
        .attr("class", "msig-d3-axis-title")
        .attr("x", scrollContextLabels ? 0 : innerWidth / 2)
        .attr(
          "y",
          innerHeight + (showAxisContextLabels ? (compactContextLabels ? 108 : 178) : 42)
        )
        .attr("text-anchor", scrollContextLabels ? "start" : "middle")
        .text("SBS96 contexts in COSMIC mutation-class order");
    }

    if (showContextCaption) {
      plot
        .append("text")
        .attr("class", "msig-d3-caption")
        .attr("x", scrollContextLabels ? 0 : innerWidth / 2)
        .attr(
          "y",
          innerHeight + (showAxisContextLabels ? (compactContextLabels ? 130 : 202) : 64)
        )
        .attr("text-anchor", scrollContextLabels ? "start" : "middle")
        .text(
          showAxisContextLabels
            ? compactContextLabels
              ? "All 96 trinucleotide labels are shown on the x-axis."
              : "Full trinucleotide labels are shown below each bar; scroll horizontally if the plot is wider than the page."
            : "Full trinucleotide labels are available on hover."
        );
    }

    return {
      sample: selectedSample,
      samples: sampleNames,
      contexts: orderedContexts,
      rows,
      total,
      normalize: useRelativeScale,
    };
  }

  /**
   * Renders observed-versus-reconstructed residual spectra for one fitted sample.
   *
   * @async
   * @function plotFitResiduals
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} residualResult - Result from mSigSDK.qc.calculateFitResiduals.
   * @param {string} [sampleName=null] - Sample to render; defaults to the first sample.
   * @returns {Promise<*>} Plot renderer result or an error element.
   */
  async function plotFitResiduals(divID, residualResult, sampleName = null, options = {}) {
    if (sampleName && typeof sampleName === "object") {
      options = sampleName;
      sampleName = null;
    }
    const samples = residualResult.samples || [];
    const selectedSample =
      samples.find((sample) => sample.sample === sampleName) || samples[0];

    if (!selectedSample) {
      return renderPlotError(divID, "No residual data available.");
    }

    const contexts =
      residualResult.contexts && residualResult.contexts.length > 0
        ? residualResult.contexts
        : Object.keys(selectedSample.observed || {});
    const supportsSbs96 = contexts.every((context) =>
      /^.\[.>.\].$/.test(context)
    );

    if (!supportsSbs96) {
      return renderPlotError(
        divID,
        "Profile comparison residual plots currently support SBS96 contexts."
      );
    }

    const observedRows = spectrumRecordToProfileRows(
      selectedSample.observed,
      selectedSample.sample,
      contexts
    );
    const reconstructedRows = spectrumRecordToProfileRows(
      selectedSample.reconstructed,
      "Reconstructed",
      contexts
    );
    const observedTotal = observedRows.reduce(
      (total, row) => total + row.mutations,
      0
    );
    const reconstructedTotal = reconstructedRows.reduce(
      (total, row) => total + row.mutations,
      0
    );

    if (observedTotal <= 0 || reconstructedTotal <= 0) {
      return renderPlotError(
        divID,
        "Observed and reconstructed spectra both need non-zero totals."
      );
    }

    const comparison = plotMutationalProfileSBS96Comparison(
      observedRows,
      reconstructedRows
    );
    const layout = {
      ...comparison.layout,
      title: `${comparison.layout?.title || ""}<br><sup>${selectedSample.sample}: observed, reconstructed, and residual difference</sup>`,
    };
    plotGraphWithPlotlyAndMakeDataDownloadable(
      divID,
      comparison.traces,
      layout,
      {
        ...(options.publication || {}),
        context: mergeFigureContext(options.figureContext, {
          dataset: options.dataset || residualResult.dataset || residualResult.source,
          sample: selectedSample.sample,
          profile: "SBS",
          matrix: contexts.length,
          metrics: "observed, reconstructed, and residual counts",
        }),
      }
    );
    return {
      sample: selectedSample.sample,
      traces: comparison.traces,
      layout,
    };
  }

  function bootstrapSummaryPlotRows(bootstrapResult, { topN = 8, minMean = 0 } = {}) {
    return [...(bootstrapResult?.signatures || [])]
      .map((row) => ({
        signatureName: row.signatureName || row.signature,
        mean: Number(row.mean),
        lower: Number(row.lower ?? row.ciLower),
        upper: Number(row.upper ?? row.ciUpper),
        selectionFrequency: Number(row.selectionFrequency),
      }))
      .filter((row) =>
        row.signatureName &&
        (
          Number(row.mean || 0) > minMean ||
          Number(row.upper || 0) > minMean ||
          Number(row.selectionFrequency || 0) > 0
        )
      )
      .sort((a, b) => (b.mean || 0) - (a.mean || 0))
      .slice(0, Math.max(1, topN));
  }

  /**
   * Renders a compact bootstrap uncertainty figure for reporting workflows.
   *
   * @async
   * @function plotBootstrapExposureSummary
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} bootstrapResult - Result from mSigSDK.qc.bootstrapSignatureFit.
   * @param {Object} [options] - Rendering options.
   * @param {number} [options.topN=8] - Number of fitted signatures to show.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotBootstrapExposureSummary(
    divID,
    bootstrapResult,
    {
      topN = 8,
      figureContext = null,
      publication = null,
      dataset = null,
      signatureCatalog = null,
    } = {}
  ) {
    const rows = bootstrapSummaryPlotRows(bootstrapResult, { topN });
    if (!rows.length) {
      return renderPlotError(divID, "No nonzero bootstrap exposure estimates were available.");
    }
    const selectedCount = rows.filter((row) => row.selectionFrequency >= 0.5).length;
    const confidenceLabel = formatPlotNumber(
      (bootstrapResult.confidenceLevel || 0.95) * 100,
      1
    );
    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
      title: "Bootstrap exposure uncertainty",
      subtitle: "Mean exposure with confidence intervals and selection frequency for the selected sample.",
      badges: [
        { label: "Bootstrap Iterations", value: String(bootstrapResult.iterations || 0) },
        { label: "Confidence Interval", value: `${confidenceLabel}%` },
        { label: "Shown", value: `${rows.length} signatures` },
        { label: "Selected", value: `${selectedCount}/${rows.length}` },
      ],
      figureContext: mergeFigureContext(figureContext, {
        dataset: dataset || bootstrapResult.dataset || bootstrapResult.source,
        sample: bootstrapResult.sampleName || bootstrapResult.sample || bootstrapResult.inputSummary?.sample,
        signatureCatalog,
        bootstrapIterations: bootstrapResult.iterations || 0,
        metric: "mean exposure, confidence interval, and selection frequency",
      }),
      publication,
      maxWidth: "1120px",
    });
    const width = 1040;
    const rowHeight = 54;
    const margin = { top: 44, right: 154, bottom: 62, left: 150 };
    const exposureWidth = 650;
    const selectionGap = 54;
    const selectionWidth = 116;
    const innerHeight = rows.length * rowHeight;
    const height = margin.top + innerHeight + margin.bottom;
    const svg = appendResponsiveSvg(chart, width, height, "Bootstrap exposure uncertainty");
    const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const selectionPlot = svg
      .append("g")
      .attr("transform", `translate(${margin.left + exposureWidth + selectionGap},${margin.top})`);
    const maxExposure = Math.max(...rows.flatMap((row) => [row.upper, row.mean]).filter(Number.isFinite), 0.01);
    const x = d3.scaleLinear().domain([0, maxExposure * 1.08]).nice().range([0, exposureWidth]);
    const y = d3
      .scaleBand()
      .domain(rows.map((row) => row.signatureName))
      .range([0, innerHeight])
      .padding(0.35);
    const selectionX = d3.scaleLinear().domain([0, 1]).range([0, selectionWidth]);
    const ticks = x.ticks(tickCountForWidth(exposureWidth, 160, 3, 5));

    plot
      .append("g")
      .attr("stroke", SCIENTIFIC_COLORS.lightGray)
      .call(d3.axisBottom(x).tickValues(ticks).tickSize(innerHeight).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());
    plot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickFormat((value) => formatPlotNumber(value, 2)))
      .call(styleD3Axis);
    plot
      .append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(styleD3Axis)
      .call((axis) => compactD3AxisText(axis, 22))
      .call((axis) => axis.select(".domain").remove());

    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + exposureWidth / 2)
      .attr("y", height - 18)
      .attr("text-anchor", "middle")
      .text("Relative exposure");
    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + exposureWidth + selectionGap + selectionWidth / 2)
      .attr("y", margin.top - 16)
      .attr("text-anchor", "middle")
      .text("Selected");

    plot
      .selectAll("line.msig-bootstrap-summary-interval")
      .data(rows)
      .join("line")
      .attr("x1", (row) => x(Number.isFinite(row.lower) ? row.lower : row.mean || 0))
      .attr("x2", (row) => x(Number.isFinite(row.upper) ? row.upper : row.mean || 0))
      .attr("y1", (row) => y(row.signatureName) + y.bandwidth() / 2)
      .attr("y2", (row) => y(row.signatureName) + y.bandwidth() / 2)
      .attr("stroke", "#1D5F82")
      .attr("stroke-width", 4)
      .attr("stroke-linecap", "round");
    plot
      .selectAll("circle.msig-bootstrap-summary-mean")
      .data(rows)
      .join("circle")
      .attr("cx", (row) => x(row.mean || 0))
      .attr("cy", (row) => y(row.signatureName) + y.bandwidth() / 2)
      .attr("r", 6)
      .attr("fill", SCIENTIFIC_COLORS.blue)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
          tooltipRows([
            ["Signature", row.signatureName],
            ["Mean", formatPlotNumber(row.mean, 4)],
            [`${confidenceLabel}% lower`, formatPlotNumber(row.lower, 4)],
            [`${confidenceLabel}% upper`, formatPlotNumber(row.upper, 4)],
            ["Selected", d3.format(".0%")(row.selectionFrequency || 0)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);

    selectionPlot
      .selectAll("rect.msig-bootstrap-summary-bg")
      .data(rows)
      .join("rect")
      .attr("x", 0)
      .attr("y", (row) => y(row.signatureName))
      .attr("width", selectionWidth)
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", "#DCEFF0");
    selectionPlot
      .selectAll("rect.msig-bootstrap-summary-selection")
      .data(rows)
      .join("rect")
      .attr("x", 0)
      .attr("y", (row) => y(row.signatureName))
      .attr("width", (row) => selectionX(Math.max(0, Math.min(1, row.selectionFrequency || 0))))
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", SCIENTIFIC_COLORS.green)
      .attr("opacity", 0.82);
    selectionPlot
      .selectAll("text.msig-bootstrap-summary-selection-label")
      .data(rows)
      .join("text")
      .attr("x", selectionWidth + 10)
      .attr("y", (row) => y(row.signatureName) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("fill", SCIENTIFIC_COLORS.darkGray)
      .attr("font", "700 12px Arial, sans-serif")
      .text((row) => d3.format(".0%")(row.selectionFrequency || 0));

    return { data: rows };
  }

  /**
   * Renders a compact cutoff sensitivity figure.
   *
   * @async
   * @function plotThresholdSensitivitySummary
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} thresholdResult - Result from mSigSDK.qc.runThresholdSensitivity.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotThresholdSensitivitySummary(
    divID,
    thresholdResult,
    {
      figureContext = null,
      publication = null,
      dataset = null,
      sample = null,
      signatureCatalog = null,
    } = {}
  ) {
    const rows = [...(thresholdResult?.runs || [])]
      .map((run) => ({
        threshold: Number(run.threshold),
        activeSignatures: Number(run.averageActiveSignatures),
        cosine: Number(run.averageCosineSimilarity),
        rmse: Number(run.averageRmse),
      }))
      .filter((row) =>
        Number.isFinite(row.threshold) &&
        Number.isFinite(row.activeSignatures) &&
        Number.isFinite(row.cosine)
      )
      .sort((a, b) => a.threshold - b.threshold);
    if (!rows.length) {
      return renderPlotError(divID, "No threshold sensitivity results available.");
    }
    const maxActive = Math.max(...rows.map((row) => row.activeSignatures), 1);
    const minCosine = Math.max(
      0,
      Math.min(...rows.map((row) => row.cosine)) - 0.02
    );
    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
      title: "Cutoff sensitivity",
      subtitle: "Each row is one contribution cutoff, with active-signature count and reconstruction quality on separate scales.",
      badges: [
        { label: "Cutoffs", value: String(rows.length) },
        {
          label: "Max drift",
          value: formatPlotNumber(thresholdResult?.summary?.maxMeanL1ExposureDrift, 3),
        },
      ],
      figureContext: mergeFigureContext(figureContext, {
        dataset: dataset || thresholdResult.dataset || thresholdResult.source,
        sample:
          sample ||
          thresholdResult.sampleName ||
          thresholdResult.sample ||
          thresholdResult.inputSummary?.sample,
        signatureCatalog,
        cutoffGrid: rows.map((row) => formatPlotNumber(row.threshold, 3)).join(", "),
        metrics: "active signatures, reconstruction cosine, and RMSE",
      }),
      publication,
      maxWidth: publication?.maxWidth || "1120px",
    });
    const requestedWidth = publicationNumber(publication, "width", 1160, { min: 520 });
    const rowHeight = publicationNumber(publication, "rowHeight", publication?.compact ? 42 : 54, { min: 30, max: 72 });
    const margin = {
      top: publicationNumber(publication, "marginTop", publication?.compact ? 56 : 72, { min: 36 }),
      right: publicationNumber(publication, "marginRight", 42, { min: 18 }),
      bottom: publicationNumber(publication, "marginBottom", 56, { min: 34 }),
      left: publicationNumber(publication, "marginLeft", 116, { min: 68 }),
    };
    const thresholdX = 28;
    const activeX = publication?.compact ? 190 : 245;
    const activeWidth = publicationNumber(publication, "activeWidth", publication?.compact ? 220 : 330, { min: 120 });
    const activeValueWidth = publicationNumber(publication, "activeValueWidth", publication?.compact ? 68 : 78, { min: 52, max: 120 });
    const cosineGap = publicationNumber(publication, "cosineGap", publication?.compact ? 30 : 46, { min: 18, max: 120 });
    const cosineWidth = publicationNumber(publication, "cosineWidth", publication?.compact ? 230 : 320, { min: 120 });
    const cosineValueWidth = publicationNumber(publication, "cosineValueWidth", 66, { min: 44, max: 120 });
    const minimumCosineX = activeX + activeWidth + activeValueWidth + cosineGap;
    const compactCosineDefault = Math.min(
      requestedWidth - margin.right - cosineWidth - cosineValueWidth,
      500
    );
    const cosineX = publicationNumber(
      publication,
      "cosineX",
      Math.max(publication?.compact ? compactCosineDefault : 730, minimumCosineX),
      { min: minimumCosineX }
    );
    const width = Math.max(
      requestedWidth,
      cosineX + cosineWidth + cosineValueWidth + margin.right
    );
    const innerHeight = rows.length * rowHeight;
    const height = margin.top + innerHeight + margin.bottom;
    const svg = appendResponsiveSvg(chart, width, height, "Cutoff sensitivity summary", publication);
    const activeScale = d3.scaleLinear().domain([0, maxActive]).nice().range([0, activeWidth]);
    const cosineScale = d3.scaleLinear().domain([minCosine, 1]).range([0, cosineWidth]);
    const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    [
      [thresholdX, "Cutoff"],
      [activeX, "Mean active signatures"],
      [cosineX, "Mean reconstruction cosine"],
    ].forEach(([x, label]) => {
      svg
        .append("text")
        .attr("x", x)
        .attr("y", 36)
        .attr("fill", SCIENTIFIC_COLORS.darkGray)
        .attr("font", "800 15px Arial, sans-serif")
        .text(label);
    });

    const rowGroups = plot
      .selectAll("g.msig-threshold-summary-row")
      .data(rows)
      .join("g")
      .attr("class", "msig-threshold-summary-row")
      .attr("transform", (_, index) => `translate(0,${index * rowHeight})`);

    rowGroups
      .append("rect")
      .attr("x", -margin.left + 12)
      .attr("y", 3)
      .attr("width", width - 58)
      .attr("height", rowHeight - 6)
      .attr("rx", 6)
      .attr("fill", (_, index) => (index % 2 === 0 ? "#F8FBFA" : "#FFFFFF"));
    rowGroups
      .append("text")
      .attr("x", thresholdX - margin.left)
      .attr("y", rowHeight / 2 + 5)
      .attr("fill", SCIENTIFIC_COLORS.darkGray)
      .attr("font", "800 14px Arial, sans-serif")
      .text((row) => formatPlotNumber(row.threshold, 3));

    rowGroups
      .append("rect")
      .attr("x", activeX - margin.left)
      .attr("y", rowHeight / 2 - 8)
      .attr("width", activeWidth)
      .attr("height", 16)
      .attr("rx", 4)
      .attr("fill", "#E3F2F0");
    rowGroups
      .append("rect")
      .attr("x", activeX - margin.left)
      .attr("y", rowHeight / 2 - 8)
      .attr("width", (row) => activeScale(row.activeSignatures))
      .attr("height", 16)
      .attr("rx", 4)
      .attr("fill", SCIENTIFIC_COLORS.green)
      .attr("opacity", 0.86)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
          tooltipRows([
            ["Cutoff", formatPlotNumber(row.threshold, 3)],
            ["Active signatures", formatPlotNumber(row.activeSignatures, 2)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    rowGroups
      .append("text")
      .attr("x", activeX - margin.left + activeWidth + activeValueWidth - 8)
      .attr("y", rowHeight / 2 + 5)
      .attr("text-anchor", "end")
      .attr("fill", SCIENTIFIC_COLORS.darkGray)
      .attr("font", "800 13px Arial, sans-serif")
      .text((row) => formatPlotNumber(row.activeSignatures, 1));

    rowGroups
      .append("rect")
      .attr("x", cosineX - margin.left)
      .attr("y", rowHeight / 2 - 8)
      .attr("width", cosineWidth)
      .attr("height", 16)
      .attr("rx", 4)
      .attr("fill", "#F0EFE3");
    rowGroups
      .append("rect")
      .attr("x", cosineX - margin.left)
      .attr("y", rowHeight / 2 - 8)
      .attr("width", (row) => cosineScale(row.cosine))
      .attr("height", 16)
      .attr("rx", 4)
      .attr("fill", "#8A7A24")
      .attr("opacity", 0.88)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
          tooltipRows([
            ["Cutoff", formatPlotNumber(row.threshold, 3)],
            ["Mean cosine", formatPlotNumber(row.cosine, 4)],
            ["Mean RMSE", formatPlotNumber(row.rmse, 5)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    rowGroups
      .append("text")
      .attr("x", cosineX - margin.left + cosineWidth + 12)
      .attr("y", rowHeight / 2 + 5)
      .attr("fill", SCIENTIFIC_COLORS.darkGray)
      .attr("font", "800 13px Arial, sans-serif")
      .text((row) => formatPlotNumber(row.cosine, 3));

    svg
      .append("text")
      .attr("x", activeX)
      .attr("y", height - 18)
      .attr("fill", "#64748B")
      .attr("font", "12px Arial, sans-serif")
      .text(`Active count scale: 0 to ${formatPlotNumber(activeScale.domain()[1], 1)}`);
    svg
      .append("text")
      .attr("x", cosineX)
      .attr("y", height - 18)
      .attr("fill", "#64748B")
      .attr("font", "12px Arial, sans-serif")
      .text(`Cosine scale: ${formatPlotNumber(minCosine, 3)} to 1`);

    return { data: rows };
  }

  /**
   * Renders bootstrap exposure intervals and selection frequencies.
   *
   * @async
   * @function plotBootstrapConfidenceIntervals
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} bootstrapResult - Result from mSigSDK.qc.bootstrapSignatureFit.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotBootstrapConfidenceIntervals(
    divID,
    bootstrapResult,
    {
      figureContext = null,
      publication = null,
      dataset = null,
      signatureCatalog = null,
      topN = activePlottingOptions.maxDisplaySignatures || 12,
      minMean = 0,
    } = {}
  ) {
    const sampleName =
      bootstrapResult.sampleName ||
      bootstrapResult.sample ||
      bootstrapResult.inputSummary?.sample ||
      null;
    const signatures = [...(bootstrapResult.signatures || [])].sort(
      (a, b) => b.mean - a.mean
    );
    if (signatures.length === 0) {
      return renderPlotError(divID, "No bootstrap signature data available.");
    }

    const confidenceLabel = formatPlotNumber(
      (bootstrapResult.confidenceLevel || 0.95) * 100,
      1
    );
    const exposureSamples = bootstrapResult.exposureSamples || [];
    const alpha = 1 - (bootstrapResult.confidenceLevel || 0.95);
    const finiteOr = (value, fallback = 0) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    };
    const allRows = signatures.map((signature) => {
      const values = exposureSamples
        .map((sample) => finiteOr(sample?.[signature.signatureName], 0))
        .filter(Number.isFinite);
      const sortedValues = [...values].sort((a, b) => a - b);
      const fallbackMean = finiteOr(signature.mean, 0);
      const mean = sortedValues.length ? d3.mean(sortedValues) : fallbackMean;
      const median = sortedValues.length
        ? d3.quantileSorted(sortedValues, 0.5)
        : finiteOr(signature.median, fallbackMean);
      const lower = sortedValues.length
        ? d3.quantileSorted(sortedValues, alpha / 2)
        : finiteOr(signature.lower, median);
      const upper = sortedValues.length
        ? d3.quantileSorted(sortedValues, 1 - alpha / 2)
        : finiteOr(signature.upper, median);
      const q1 = sortedValues.length
        ? d3.quantileSorted(sortedValues, 0.25)
        : lower;
      const q3 = sortedValues.length
        ? d3.quantileSorted(sortedValues, 0.75)
        : upper;
      const selectionFrequency = sortedValues.length
        ? sortedValues.filter((value) => value > 0).length / sortedValues.length
        : finiteOr(signature.selectionFrequency, 0);
      return {
        signatureName: signature.signatureName,
        mean,
        median,
        lower,
        upper,
        q1,
        q3,
        intervalWidth: upper - lower,
        selectionFrequency,
        values,
      };
    });
    const informativeRows = allRows
      .filter((row) =>
        row.signatureName &&
        (
          Number(row.mean || 0) > minMean ||
          Number(row.upper || 0) > minMean ||
          Number(row.selectionFrequency || 0) > 0
        )
      )
      .sort((a, b) => (b.mean || 0) - (a.mean || 0));
    const rows = informativeRows.slice(0, Math.max(1, Math.floor(Number(topN) || 12)));
    const hiddenCount = Math.max(0, informativeRows.length - rows.length);
    if (!rows.length) {
      return renderPlotError(divID, "No nonzero bootstrap exposure estimates were available.");
    }
    const maxExposure = Math.max(
      ...rows.flatMap((row) => [row.upper, row.mean, ...row.values]),
      0.01
    );
    const selectedCount = rows.filter(
      (row) => row.selectionFrequency >= 0.5
    ).length;

	    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
      title: "Bootstrap exposure uncertainty",
      subtitle: `Bootstrap was computed across the fitted catalog for ${sampleName || "the selected sample"}. Display shows ${rows.length} of ${informativeRows.length} informative signatures${hiddenCount ? `; ${hiddenCount} lower-ranked informative signatures are hidden for readability.` : "."}`,
      badges: [
        ...(sampleName ? [{ label: "Sample", value: sampleName }] : []),
        { label: "Bootstrap Iterations", value: String(bootstrapResult.iterations || 0) },
        { label: "Confidence Interval", value: `${confidenceLabel}%` },
        { label: "Signatures shown", value: `${rows.length}/${informativeRows.length}` },
        { label: "Selected", value: `${selectedCount}/${rows.length}` },
      ],
      figureContext: mergeFigureContext(figureContext, {
        dataset: dataset || bootstrapResult.dataset || bootstrapResult.source,
        sample: sampleName,
        signatureCatalog,
        bootstrapIterations: bootstrapResult.iterations || 0,
        metric: "bootstrap exposure draws, intervals, medians, means, and selection frequency",
      }),
      publication,
      maxWidth: "1120px",
    });

    const legend = document.createElement("div");
    legend.className = "msig-d3-html-legend";
    [
      ["draws", "bootstrap draws"],
      ["interval", `${confidenceLabel}% interval`],
      ["median", "median"],
      ["mean", "mean"],
    ].forEach(([kind, label]) => {
      const item = document.createElement("span");
      item.className = "msig-d3-html-legend-item";
      const swatch = document.createElement("span");
      swatch.className = `msig-d3-html-legend-swatch ${kind}`;
      const text = document.createElement("span");
      text.textContent = label;
      item.append(swatch, text);
      legend.appendChild(item);
    });
    chart.appendChild(legend);

    const width = 1040;
    const rowHeight = 50;
    const margin = { top: 14, right: 42, bottom: 72, left: 124 };
    const exposureWidth = 660;
    const selectionGap = 58;
    const selectionWidth = 132;
    const innerHeight = Math.max(300, rows.length * rowHeight);
    const height = innerHeight + margin.top + margin.bottom;
    const svg = appendResponsiveSvg(
      chart,
      width,
      height,
      "Bootstrap confidence intervals and exposure distributions",
      publication
    );
    const y = d3
      .scaleBand()
      .domain(rows.map((row) => row.signatureName))
      .range([0, innerHeight])
      .padding(0.28);
    const x = d3
      .scaleLinear()
      .domain([0, maxExposure * 1.08])
      .nice()
      .range([0, exposureWidth]);
    const exposureTicks = x.ticks(tickCountForWidth(exposureWidth, 160, 3, 5));
    const selectionX = d3.scaleLinear().domain([0, 1]).range([0, selectionWidth]);
    const plot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    const selectionPlot = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left + exposureWidth + selectionGap},${margin.top})`
      );

    plot
      .append("g")
      .attr("stroke", SCIENTIFIC_COLORS.lightGray)
      .attr("stroke-opacity", 0.9)
      .call(d3.axisBottom(x).tickValues(exposureTicks).tickSize(innerHeight).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());
	    plot
	      .append("g")
	      .attr("transform", `translate(0,${innerHeight})`)
	      .call(d3.axisBottom(x).tickValues(exposureTicks).tickFormat((value) => formatPlotNumber(value, 2)))
	      .call(styleD3Axis);
	    plot
	      .append("g")
	      .call(d3.axisLeft(y).tickSize(0))
	      .call(styleD3Axis)
      .call((axis) => compactD3AxisText(axis, 22))
	      .select(".domain")
	      .remove();
    selectionPlot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(selectionX).tickValues([0, 0.5, 1]).tickFormat(d3.format(".0%")))
      .call(styleD3Axis);

    const drawPoints = rows.flatMap((row) => {
      const centerY = y(row.signatureName) + y.bandwidth() / 2;
      const step = Math.max(1, Math.ceil(row.values.length / 260));
      return row.values
        .filter((_, index) => index % step === 0)
        .map((value, index) => ({
          signatureName: row.signatureName,
          value,
          centerY,
          jitter: ((((index * 37) % 101) / 100) - 0.5) * y.bandwidth() * 0.62,
          representedDraws: step,
        }));
    });

    plot
      .selectAll("rect.msig-bootstrap-iqr")
      .data(rows)
      .join("rect")
      .attr("class", "msig-bootstrap-iqr")
      .attr("x", (row) => x(row.q1))
      .attr("y", (row) => y(row.signatureName) + y.bandwidth() * 0.32)
      .attr("width", (row) => Math.max(1, x(row.q3) - x(row.q1)))
      .attr("height", y.bandwidth() * 0.36)
      .attr("rx", 3)
      .attr("fill", SCIENTIFIC_COLORS.sky)
      .attr("opacity", 0.18);

    plot
      .selectAll("circle.msig-bootstrap-draw")
      .data(drawPoints)
      .join("circle")
      .attr("class", "msig-bootstrap-draw")
      .attr("cx", (point) => x(point.value))
      .attr("cy", (point) => point.centerY + point.jitter)
      .attr("r", 1.8)
      .attr("fill", SCIENTIFIC_COLORS.sky)
      .attr("opacity", 0.42)
      .on("mousemove", (event, point) => {
        showTooltip(
          event,
	          tooltipRows([
	            ["Signature", point.signatureName],
	            ["Draw", formatPlotNumber(point.value, 4)],
	            ["Shown point", point.representedDraws > 1 ? `1 of ${point.representedDraws}` : "1 draw"],
          ])
        );
      })
      .on("mouseleave", hideTooltip);

    plot
      .selectAll("line.msig-bootstrap-interval")
      .data(rows)
      .join("line")
      .attr("class", "msig-bootstrap-interval")
      .attr("x1", (row) => x(row.lower))
      .attr("x2", (row) => x(row.upper))
      .attr("y1", (row) => y(row.signatureName) + y.bandwidth() / 2)
      .attr("y2", (row) => y(row.signatureName) + y.bandwidth() / 2)
      .attr("stroke", SCIENTIFIC_COLORS.darkGray)
      .attr("stroke-width", 3)
      .attr("stroke-linecap", "round");
    plot
      .selectAll("line.msig-bootstrap-median")
      .data(rows)
      .join("line")
      .attr("class", "msig-bootstrap-median")
      .attr("x1", (row) => x(row.median))
      .attr("x2", (row) => x(row.median))
      .attr("y1", (row) => y(row.signatureName) + y.bandwidth() * 0.16)
      .attr("y2", (row) => y(row.signatureName) + y.bandwidth() * 0.84)
      .attr("stroke", SCIENTIFIC_COLORS.orange)
      .attr("stroke-width", 2.2)
      .attr("stroke-linecap", "round")
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
	          tooltipRows([
	            ["Signature", row.signatureName],
	            ["Median", formatPlotNumber(row.median, 4)],
	            ["Mean", formatPlotNumber(row.mean, 4)],
	            [`${confidenceLabel}% lower`, formatPlotNumber(row.lower, 4)],
	            [`${confidenceLabel}% upper`, formatPlotNumber(row.upper, 4)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    plot
      .selectAll("circle.msig-bootstrap-mean")
      .data(rows)
      .join("circle")
      .attr("class", "msig-bootstrap-mean")
      .attr("cx", (row) => x(row.mean))
      .attr("cy", (row) => y(row.signatureName) + y.bandwidth() / 2)
      .attr("r", 6.5)
      .attr("fill", SCIENTIFIC_COLORS.blue)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
	          tooltipRows([
	            ["Signature", row.signatureName],
	            ["Mean", formatPlotNumber(row.mean, 4)],
	            ["Median", formatPlotNumber(row.median, 4)],
	            [`${confidenceLabel}% lower`, formatPlotNumber(row.lower, 4)],
	            [`${confidenceLabel}% upper`, formatPlotNumber(row.upper, 4)],
	            ["Selected", d3.format(".1%")(row.selectionFrequency)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);

    selectionPlot
      .selectAll("rect.msig-bootstrap-selection")
      .data(rows)
      .join("rect")
      .attr("class", "msig-bootstrap-selection")
      .attr("x", 0)
      .attr("y", (row) => y(row.signatureName))
      .attr("width", (row) => selectionX(row.selectionFrequency))
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", SCIENTIFIC_COLORS.green)
      .attr("opacity", 0.72)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
	          tooltipRows([
	            ["Signature", row.signatureName],
	            ["Selected", d3.format(".1%")(row.selectionFrequency)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    function selectionLabelInside(row) {
      return row.selectionFrequency >= 0.68 || selectionX(row.selectionFrequency) > selectionWidth - 42;
    }
    function selectionLabelX(row) {
      if (selectionLabelInside(row)) {
        return Math.max(32, selectionX(row.selectionFrequency) - 8);
      }
      return Math.min(selectionWidth - 8, selectionX(row.selectionFrequency) + 8);
    }
    selectionPlot
      .selectAll("text.msig-bootstrap-selection-label")
      .data(rows)
      .join("text")
      .attr("class", "msig-bootstrap-selection-label")
      .attr("x", selectionLabelX)
      .attr("y", (row) => y(row.signatureName) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (row) => selectionLabelInside(row) ? "end" : "start")
      .attr("fill", (row) =>
        selectionLabelInside(row) ? "#ffffff" : SCIENTIFIC_COLORS.darkGray
      )
      .attr("font", "700 9px Arial, sans-serif")
      .text((row) => d3.format(".0%")(row.selectionFrequency));

    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + exposureWidth / 2)
      .attr("y", height - 14)
      .attr("text-anchor", "middle")
      .text("Relative exposure");
    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + exposureWidth + selectionGap + selectionWidth / 2)
      .attr("y", height - 14)
      .attr("text-anchor", "middle")
      .text("Selected");

    return { data: rows, fullData: allRows, hiddenCount };
  }

  /**
   * Renders a cutoff sensitivity summary for fitted exposures.
   *
   * @async
   * @function plotThresholdSensitivity
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} thresholdResult - Result from mSigSDK.qc.runThresholdSensitivity.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotThresholdSensitivity(divID, thresholdResult, options = {}) {
    return plotThresholdSensitivitySummary(divID, thresholdResult, options);
  }

  /**
   * Renders extracted NMF signature profiles with the SBS96 profile renderer.
   *
   * @async
   * @function plotNMFSignatureProfiles
   * @memberof signatureExtractionPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} nmfResult - Result from mSigSDK.signatureExtraction.extractSignaturesNMF.
   * @param {Object} [options] - Plot options.
   * @param {number} [options.maxSignatures=Infinity] - Maximum signatures to render.
   * @param {number|null} [options.columns=null] - Optional number of columns for the rendered component profiles.
   * @returns {Promise<Array|Element>} Rendered profile results or an error element.
   */
  async function plotNMFSignatureProfiles(
    divID,
    nmfResult,
    {
      maxSignatures = Infinity,
      columns = null,
      figureContext = null,
      publication = null,
      dataset = null,
      title = null,
      subtitle = null,
    } = {}
  ) {
    const { element: container } = resolvePlotContainer(divID);
    const allSignatures = Object.entries(nmfResult?.signatures || {});
    const signatures = allSignatures.slice(0, maxSignatures);
    const contexts = nmfResult?.contexts || null;
    const totalSignatureCount = allSignatures.length;
    const rank = Number(nmfResult?.rank);

    if (signatures.length === 0) {
      return renderPlotError(divID, "No extracted NMF signatures available.");
    }

    const requestedColumns = Number(
      columns ?? publication?.profileColumns ?? publication?.columns
    );
    const profileColumns =
      Number.isFinite(requestedColumns) && requestedColumns > 1
        ? Math.min(signatures.length, Math.round(requestedColumns))
        : 1;
    container.innerHTML = "";
    container.style.display = "grid";
    container.style.gap = "28px";
    container.style.alignItems = "start";
    container.style.gridTemplateColumns =
      profileColumns > 1
        ? `repeat(${profileColumns}, minmax(0, 1fr))`
        : "1fr";

	    const rendered = [];
	    for (const [componentIndex, [signatureName, signatureRecord]] of signatures.entries()) {
	      const signatureDiv = document.createElement("div");
	      signatureDiv.style.width = "100%";
	      container.appendChild(signatureDiv);
        const rankLabel = Number.isFinite(rank)
          ? `rank-${rank}`
          : `${totalSignatureCount}-component`;
        const profileTitle = title
          ? `${title}: ${signatureName}`
          : `Extracted NMF component: ${signatureName}`;
        const displayScope =
          signatures.length < totalSignatureCount
            ? `This renderer is showing ${signatures.length} of ${totalSignatureCount} extracted components.`
            : `All ${totalSignatureCount} extracted components are shown.`;
        const profileSubtitle =
          subtitle ||
          `${signatureName} is component ${componentIndex + 1} of ${totalSignatureCount} from the ${rankLabel} de novo NMF model. ${displayScope} It is plotted in SBS96 context order and is not a named COSMIC catalog signature.`;
	      rendered.push(
	        plotCosmicSbs96Profile(signatureDiv, signatureRecord, {
	          sample: signatureName,
	          contexts,
          normalize: "auto",
          title: profileTitle,
          subtitle: profileSubtitle,
          figureContext: mergeFigureContext(figureContext, {
            dataset: dataset || nmfResult.dataset || nmfResult.source,
            extractedSignature: signatureName,
            extractedSignatures: totalSignatureCount,
            displayedExtractedSignatures: signatures.length,
            nmfRank: Number.isFinite(rank) ? rank : null,
            profile: "SBS",
            matrix: contexts?.length || Object.keys(signatureRecord || {}).length,
          }),
          publication,
        })
      );
	    }

    return rendered;
  }

  /**
   * Renders a heatmap of sample exposures from an NMF result.
   *
   * @async
   * @function plotNMFExposureHeatmap
   * @memberof signatureExtractionPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} nmfResult - Result from mSigSDK.signatureExtraction.extractSignaturesNMF.
   * @param {Object} [options] - Plot options.
   * @param {boolean} [options.relative=true] - Plot relative exposures per sample.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotNMFExposureHeatmap(
    divID,
    nmfResult,
    {
      relative = true,
      figureContext = null,
      publication = null,
      dataset = null,
    } = {}
  ) {
    if (!nmfResult?.exposures) {
      return renderPlotError(divID, "No NMF exposure matrix available.");
    }

    const sampleNames = Object.keys(nmfResult.exposures);
    const signatureNames = Array.from(
      new Set(
        sampleNames.flatMap((sample) => Object.keys(nmfResult.exposures[sample]))
      )
    ).sort();
    if (sampleNames.length === 0 || signatureNames.length === 0) {
      return renderPlotError(divID, "No NMF exposure matrix available.");
    }

    const rows = sampleNames.flatMap((sample) => {
      const exposures = nmfResult.exposures[sample] || {};
      const total = signatureNames.reduce(
        (sum, signature) => sum + (Number(exposures[signature]) || 0),
        0
      );
      return signatureNames.map((signature) => {
        const rawValue = Number(exposures[signature]) || 0;
        const value = relative && total > 0 ? rawValue / total : rawValue;
        return {
          sample,
          signature,
          value,
          rawValue,
        };
      });
    });
    const maxValue = Math.max(...rows.map((row) => row.value), 1e-12);
	    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
	      title: "NMF sample exposures",
	      subtitle:
	        "Rows are samples, columns are extracted signatures, and color encodes exposure.",
      badges: [
        { label: "Samples", value: String(sampleNames.length) },
        { label: "Signatures", value: String(signatureNames.length) },
        { label: "Scale", value: relative ? "Relative" : "Raw" },
      ],
      figureContext: mergeFigureContext(figureContext, {
        dataset: dataset || nmfResult.dataset || nmfResult.source,
        samples: sampleNames.length,
        extractedSignatures: signatureNames.length,
        scale: relative ? "relative exposure" : "raw exposure",
      }),
      publication,
    });

    const width = 900;
    const margin = { top: 36, right: 28, bottom: 86, left: 132 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = Math.max(260, sampleNames.length * 30);
    const height = innerHeight + margin.top + margin.bottom;
    const svg = appendResponsiveSvg(
      chart,
      width,
      height,
      "NMF exposure heatmap"
    );
    const x = d3
      .scaleBand()
      .domain(signatureNames)
      .range([0, innerWidth])
      .padding(0.06);
    const y = d3
      .scaleBand()
      .domain(sampleNames)
      .range([0, innerHeight])
      .padding(0.08);
    const color = d3.scaleSequential(d3.interpolateViridis).domain([0, maxValue]);
    const plot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    plot
      .selectAll("rect.msig-nmf-exposure")
      .data(rows)
      .join("rect")
      .attr("class", "msig-nmf-exposure")
      .attr("x", (row) => x(row.signature))
      .attr("y", (row) => y(row.sample))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", 3)
      .attr("fill", (row) => color(row.value))
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
	          tooltipRows([
	            ["Sample", row.sample],
	            ["Signature", row.signature],
	            [relative ? "Relative" : "Exposure", formatPlotNumber(row.value, 4)],
	            ["Raw", formatPlotNumber(row.rawValue, 4)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    plot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
	      .call(d3.axisBottom(x).tickSize(0))
	      .call(styleD3Axis)
      .call((axis) => compactD3AxisText(axis, 14))
	      .selectAll("text")
	      .attr("text-anchor", "end")
      .attr("transform", "rotate(-35)")
      .attr("dx", "-0.5em")
      .attr("dy", "0.15em");
	    plot
	      .append("g")
	      .call(d3.axisLeft(y).tickSize(0))
	      .call(styleD3Axis)
      .call((axis) => compactD3AxisText(axis, 24))
	      .select(".domain")
	      .remove();
    plot.selectAll(".domain").remove();

    const legendWidth = 180;
    const legendHeight = 10;
    const legendX = width - margin.right - legendWidth;
    const legendY = 12;
    const gradientId = `msig-nmf-exposure-gradient-${Math.random()
      .toString(36)
      .slice(2)}`;
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("x2", "100%");
    d3.range(0, 1.01, 0.1).forEach((stop) => {
      gradient
        .append("stop")
        .attr("offset", `${stop * 100}%`)
        .attr("stop-color", color(stop * maxValue));
    });
    svg
      .append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("rx", 3)
      .attr("fill", `url(#${gradientId})`);
    svg
      .append("text")
      .attr("class", "msig-d3-caption")
      .attr("x", legendX)
      .attr("y", legendY + 26)
      .text("0");
    svg
      .append("text")
      .attr("class", "msig-d3-caption")
      .attr("x", legendX + legendWidth)
      .attr("y", legendY + 26)
      .attr("text-anchor", "end")
      .text(formatPlotNumber(maxValue, 3));

    return { data: rows };
  }

  /**
   * Renders rank-selection diagnostics from a rank-grid NMF run.
   *
   * @async
   * @function plotNMFRankSelection
   * @memberof signatureExtractionPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} rankSelection - Result from mSigSDK.signatureExtraction.selectNMFRank.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotNMFRankSelection(divID, rankSelection, options = {}) {
    const runs = [...(rankSelection?.runs || [])].sort((a, b) => a.rank - b.rank);
    if (runs.length === 0) {
      return renderPlotError(divID, "No NMF rank-selection results available.");
    }

    const recommendedRank = rankSelection.recommendedRank;
    const metrics = [
      {
        key: "reconstructionError",
        label: "Reconstruction error",
        caption: "lower is better",
        color: SCIENTIFIC_COLORS.orange,
      },
      {
        key: "averageSampleCosineSimilarity",
        label: "Average sample cosine",
        caption: "higher is better",
        color: SCIENTIFIC_COLORS.blue,
      },
    ];
	    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
	      title: "NMF rank diagnostics",
	      subtitle:
	        "Compare reconstruction error with sample-level cosine similarity across tested ranks.",
      badges: [
        { label: "Ranks tested", value: String(runs.length) },
        { label: "Recommended", value: String(recommendedRank) },
      ],
      figureContext: mergeFigureContext(options.figureContext, {
        dataset: options.dataset || rankSelection.dataset || rankSelection.source,
        ranksTested: runs.map((run) => run.rank).join(", "),
        recommendedRank,
        metrics: "reconstruction error and average sample cosine",
      }),
      publication: options.publication,
    });

    const publication = resolvePlotPublication(options.publication);
    const width = publicationNumber(publication, "width", 920, { min: 460 });
    const panelGap = publicationNumber(publication, "panelGap", publication?.compact ? 44 : 72, { min: 18 });
    const margin = {
      top: publicationNumber(publication, "marginTop", 34, { min: 20 }),
      right: publicationNumber(publication, "marginRight", 34, { min: 12 }),
      bottom: publicationNumber(publication, "marginBottom", 62, { min: 34 }),
      left: publicationNumber(publication, "marginLeft", 72, { min: 48 }),
    };
    const panelWidth = publicationNumber(publication, "panelWidth", (width - margin.left - margin.right - panelGap) / 2, { min: 120 });
    const innerHeight = publicationNumber(publication, "innerHeight", publication?.compact ? 190 : 260, { min: 120 });
    const height = publicationNumber(publication, "height", innerHeight + margin.top + margin.bottom, { min: 220 });
    const svg = appendResponsiveSvg(chart, width, height, "NMF rank diagnostics", publication);
    const x = d3
      .scaleLinear()
      .domain(d3.extent(runs, (run) => run.rank))
      .nice()
      .range([0, panelWidth]);

    metrics.forEach((metric, metricIndex) => {
      const panelX = margin.left + metricIndex * (panelWidth + panelGap);
      const values = runs.map((run) => Number(run[metric.key]));
      const domain = d3.extent(values);
      const pad = Math.max((domain[1] - domain[0]) * 0.08, 1e-6);
      const y = d3
        .scaleLinear()
        .domain([domain[0] - pad, domain[1] + pad])
        .nice()
        .range([innerHeight, 0]);
      const panel = svg
        .append("g")
        .attr("transform", `translate(${panelX},${margin.top})`);

      panel
        .append("g")
        .attr("stroke", SCIENTIFIC_COLORS.lightGray)
        .attr("stroke-opacity", 0.9)
        .call(d3.axisLeft(y).ticks(5).tickSize(-panelWidth).tickFormat(""))
        .call((axis) => axis.select(".domain").remove());
	      panel
	        .append("g")
	        .attr("transform", `translate(0,${innerHeight})`)
	        .call(
	          d3
	            .axisBottom(x)
	            .tickValues(
	              sampledTickValues(
	                runs.map((run) => run.rank),
	                tickCountForWidth(panelWidth, 54, 3, 8)
	              )
	            )
	            .tickFormat(d3.format("d"))
	        )
	        .call(styleD3Axis);
      panel
        .append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".3g")))
        .call(styleD3Axis);

      if (Number.isFinite(recommendedRank)) {
        panel
          .append("line")
          .attr("x1", x(recommendedRank))
          .attr("x2", x(recommendedRank))
          .attr("y1", 0)
          .attr("y2", innerHeight)
          .attr("stroke", SCIENTIFIC_COLORS.green)
          .attr("stroke-width", 1.6)
          .attr("stroke-dasharray", "5 5");
      }

      const line = d3
        .line()
        .x((run) => x(run.rank))
        .y((run) => y(run[metric.key]))
        .curve(d3.curveMonotoneX);
      panel
        .append("path")
        .datum(runs)
        .attr("fill", "none")
        .attr("stroke", metric.color)
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("d", line);
      panel
        .selectAll(`circle.msig-nmf-rank-${metric.key}`)
        .data(runs)
        .join("circle")
        .attr("class", `msig-nmf-rank-${metric.key}`)
        .attr("cx", (run) => x(run.rank))
        .attr("cy", (run) => y(run[metric.key]))
        .attr("r", 6)
        .attr("fill", metric.color)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1.4)
        .on("mousemove", (event, run) =>
          showTooltip(
            event,
            tooltipRows([
              ["Rank", run.rank],
              [metric.label, formatPlotNumber(run[metric.key], 5)],
              ["Converged", run.converged ? "yes" : "no"],
              ["Iterations", run.iterations],
            ])
          )
        )
        .on("mouseleave", hideTooltip);

      svg
        .append("text")
        .attr("class", "msig-d3-axis-title")
        .attr("x", panelX + panelWidth / 2)
        .attr("y", margin.top - 12)
        .attr("text-anchor", "middle")
        .text(metric.label);
      svg
        .append("text")
        .attr("class", "msig-d3-caption")
        .attr("x", panelX + panelWidth / 2)
        .attr("y", height - 14)
        .attr("text-anchor", "middle")
        .text(`Rank (${metric.caption})`);
    });

    return { data: runs };
  }

  /**
   * Fits sample spectra to known signatures and returns exposures, QC, provenance, and a report.
   *
   * @async
   * @function analyzeSpectraWithSignatures
   * @memberof workflows
   * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
   * @param {Object<string,Object<string,number>>} signatures - Reference signature matrix.
   * @param {Object} [options] - Workflow options.
   * @param {number} [options.exposureThreshold=0] - Relative exposure cutoff.
   * @param {string} [options.exposureType="relative"] - Exposure scaling mode.
   * @param {boolean} [options.renormalize=true] - Renormalize after thresholding.
   * @param {string[]} [options.expectedContexts=null] - Expected mutation contexts.
   * @param {Object} [options.mutationBurdenOptions={}] - Mutation-burden QC options.
   * @param {Object} [options.parameters={}] - Additional report/provenance parameters.
   * @param {string} [options.reportFormat="object"] - "object", "json", or "html".
   * @returns {Promise<Object>} Exposures, provenance, validation, QC, and report objects.
   */
  async function analyzeSpectraWithSignatures(
    spectra,
    signatures,
    {
      exposureThreshold = 0,
      exposureType = "relative",
      renormalize = true,
      fitOptions = {},
      expectedContexts = null,
      mutationBurdenOptions = {},
      residualOptions = {},
      reconstructionOptions = {},
      parameters = {},
      reportFormat = "object",
      catalogVersion = null,
      catalogSource = null,
      genomeBuild = null,
      apiEndpointSnapshot = [],
    } = {}
  ) {
    const resolvedFitOptions = {
      exposureThreshold,
      exposureType,
      renormalize,
      ...fitOptions,
    };
    const fitParameters = {
      ...resolvedFitOptions,
      residualOptions,
      reconstructionOptions,
      ...parameters,
    };
    const exposures = await fitMutationalSpectraToSignatures(
      signatures,
      spectra,
      {
        ...resolvedFitOptions,
      }
    );
    const provenanceRecord = createProvenance({
      analysis: "signature fitting",
      parameters: fitParameters,
      catalogVersion,
      catalogSource,
      genomeBuild,
      apiEndpointSnapshot,
    });
    const analysis = createSignatureFitAnalysis({
      spectra,
      signatures,
      exposures,
      parameters: fitParameters,
      expectedContexts,
      mutationBurdenOptions,
      residualOptions,
      reconstructionOptions,
      provenance: provenanceRecord,
      reportFormat,
    });

    return {
      exposures,
      provenance: provenanceRecord,
      ...analysis,
    };
  }

  /**
   * Runs de novo NMF extraction and returns extraction, comparison, QC, provenance, and a report.
   *
   * @function extractSignaturesFromSpectra
   * @memberof workflows
   * @param {Object<string,Object<string,number>>} spectra - Sample spectra matrix.
   * @param {Object} [options] - Workflow options.
   * @param {Object<string,Object<string,number>>} [options.referenceSignatures=null] - Optional reference catalog for matching.
   * @param {Object} [options.nmfOptions={}] - Options passed to extractSignaturesNMF.
   * @param {string[]} [options.expectedContexts=null] - Expected mutation contexts.
   * @param {Object} [options.mutationBurdenOptions={}] - Mutation-burden QC options.
   * @param {Object} [options.parameters={}] - Additional report/provenance parameters.
   * @param {string} [options.reportFormat="object"] - "object", "json", or "html".
   * @returns {Object} Provenance, extraction, optional comparison, validation, QC, and report objects.
   */
  function extractSignaturesFromSpectra(
    spectra,
    {
      referenceSignatures = null,
      nmfOptions = {},
      expectedContexts = null,
      mutationBurdenOptions = {},
      parameters = {},
      reportFormat = "object",
    } = {}
  ) {
    const provenanceRecord = createProvenance({
      analysis: "NMF signature extraction",
      parameters: {
        ...parameters,
        nmfOptions,
      },
    });
    const analysis = createNMFAnalysis({
      spectra,
      referenceSignatures,
      nmfOptions,
      parameters,
      expectedContexts,
      mutationBurdenOptions,
      provenance: provenanceRecord,
      reportFormat,
    });

    return {
      provenance: provenanceRecord,
      ...analysis,
    };
  }

  /**
   * Converts MAF rows to spectra, then optionally fits known signatures and assembles QC/report outputs.
   *
   * @async
   * @function analyzeMafFiles
   * @memberof workflows
   * @param {Object[]|Object[][]} mafFiles - MAF rows or nested MAF row arrays.
   * @param {Object<string,Object<string,number>>} [signatures=null] - Optional reference signatures for fitting.
   * @param {Object} [options] - Workflow options.
   * @param {string} [options.groupBy="project_code"] - MAF field used to group spectra.
   * @param {number} [options.batchSize=100] - Conversion batch size.
   * @param {string} [options.genome="hg19"] - Reference genome.
   * @param {boolean} [options.tcga=false] - Whether to apply TCGA-specific conversion behavior.
   * @param {string[]} [options.expectedContexts=null] - Expected mutation contexts.
   * @param {string} [options.reportFormat="object"] - "object", "json", or "html".
   * @param {Object} [options.fitting={}] - Options passed to analyzeSpectraWithSignatures when signatures are supplied.
   * @returns {Promise<Object>} Spectra-only QC/report output or full signature-fitting workflow output.
   */
  async function analyzeMafFiles(
    mafFiles,
    signatures = null,
    {
      groupBy = "project_code",
      batchSize = 100,
      genome = "hg19",
      tcga = false,
      profiles = ["SBS96"],
      expectedContexts = null,
      reportFormat = "object",
      fitting = {},
      mutationBurdenOptions = fitting.mutationBurdenOptions || {},
      offline = false,
      contextLookupTable = null,
      contextSource = offline
        ? "mSigSDK offline trinucleotide context table"
        : "UCSC Genome Browser API",
      contextApiVersion = offline
        ? "static_trinucleotide_context_lookup"
        : "getData/sequence",
      contextApiEndpoint = offline
        ? null
        : "https://api.genome.ucsc.edu/getData/sequence",
      catalogVersion = fitting.catalogVersion || null,
      catalogSource = fitting.catalogSource || null,
    } = {}
  ) {
    const contextFetchTimestamp = new Date().toISOString();
    const contextLookupMode = offline ? "offline_table" : "live_ucsc_api";
    const requestedProfileKeys = (Array.isArray(profiles) ? profiles : [profiles]).map(workflowProfileKey);
    const apiEndpointSnapshot = offline
      ? null
      : buildUCSCContextEndpointSnapshot({
          genome,
          contextApiEndpoint,
        });
    const expectedConvertibleSnvCount = countConvertibleSnvRows(mafFiles, { tcga });
    const profileConversion = await convertMafToProfileSpectra(mafFiles, {
      profiles: requestedProfileKeys,
      groupBy,
      batchSize,
      genome,
      tcga,
      offline,
      contextLookupTable,
    });
    const selectedProfileKey =
      selectMafProfileForSignatures(requestedProfileKeys, signatures) ||
      requestedProfileKeys[0] ||
      "SBS96";
    const selectedProfileOptions = profileOptionsFromKey(selectedProfileKey);
    const selectedExpectedContexts =
      expectedContexts || getExpectedContexts(selectedProfileOptions);
    const spectra = profileConversion.spectraByProfile[selectedProfileKey] || {};
    const observedSbs96Count = sumSpectraCounts(spectra);
    const contextWarnings =
      selectedProfileKey.startsWith("SBS") &&
      expectedConvertibleSnvCount !== observedSbs96Count
        ? [
            makeWorkflowWarning(
              QC_WARNING_CODES.CONTEXT_FETCH_FAILED || "CONTEXT_FETCH_FAILED",
              "MAF conversion produced fewer or more SBS96 counts than convertible SNV rows; context fetching or input normalization may be incomplete.",
              {
                expectedConvertibleSnvCount,
                observedSbs96Count,
                droppedOrUncountedSnvCount:
                  expectedConvertibleSnvCount - observedSbs96Count,
              }
            ),
          ]
        : [];
    const profileWarnings = [
      ...(profileConversion.warnings || []),
      ...(signatures && !selectMafProfileForSignatures(requestedProfileKeys, signatures)
        ? [
            makeWorkflowWarning(
              "SIGNATURE_PROFILE_MISMATCH",
              "The supplied signature catalog does not match any requested MAF-derived profile matrix; fitting was skipped.",
              {
                requestedProfiles: requestedProfileKeys,
                signatureContexts: getMatrixContexts(signatures).length,
              }
            ),
          ]
        : []),
    ];
    const contextMetadata = {
      genomeBuild: genome,
      requestedProfiles: requestedProfileKeys,
      selectedProfile: selectedProfileKey,
      profileConversionRegistry: profileConversion.profileRegistry,
      contextSource,
      contextApiVersion,
      contextApiEndpoint,
      contextLookupMode,
      contextFetchTimestamp,
      contextResultsCached: offline ? false : true,
      offlineContextTableSupplied: Boolean(contextLookupTable),
      cacheBoundary:
        offline
          ? "Offline context lookup uses the supplied or bundled position-indexed trinucleotide table; reproducibility depends on pinning the table build and coordinate convention."
          : "Context sequence requests use the SDK fetchURLAndCache utility; reproducibility still depends on pinning the genome build and endpoint behavior.",
      expectedConvertibleSnvCount,
      observedSbs96Count,
      observedProfileCount: observedSbs96Count,
      sbs96CountMatchesConvertibleSnvCount:
        selectedProfileKey.startsWith("SBS") &&
        expectedConvertibleSnvCount === observedSbs96Count,
      profileCountMatchesConvertibleRows:
        !selectedProfileKey.startsWith("SBS") ||
        expectedConvertibleSnvCount === observedSbs96Count,
      validationRule:
        selectedProfileKey.startsWith("SBS")
          ? "The sum of SBS context counts should equal the number of convertible single-base substitution rows."
          : "The selected non-SBS profile uses profile-specific event classification; inspect profileConversion.audit for row-level count reconciliation.",
    };
    const parameters = {
      groupBy,
      batchSize,
      genome,
      tcga,
      profiles: requestedProfileKeys,
      selectedProfile: selectedProfileKey,
      contextMetadata,
      ...fitting,
    };

    if (signatures && selectMafProfileForSignatures(requestedProfileKeys, signatures)) {
      const fitResult = await analyzeSpectraWithSignatures(spectra, signatures, {
        ...fitting,
        expectedContexts: selectedExpectedContexts,
        parameters,
        reportFormat,
        catalogVersion,
        catalogSource,
        genomeBuild: genome,
        apiEndpointSnapshot,
      });
      const mergedWarnings = [
        ...(fitResult.warnings || fitResult.primaryWarnings || []),
        ...contextWarnings,
        ...profileWarnings,
      ];
      return {
        ...fitResult,
        workflow: "maf_signature_fit",
        workflowRole: "maf_signature_fit_pipeline",
        primaryInterpretationFields:
          fitResult.primaryInterpretationFields || [
            "fit.exposures",
            "qc.mutationBurden",
            "qc.reconstructionError",
            "warnings",
          ],
        parameters,
        fit:
          fitResult.fit || {
            method: "NNLS",
            exposures: fitResult.exposures,
            reconstructionError: fitResult.qc?.reconstructionError,
          },
        spectra,
        spectraByProfile: profileConversion.spectraByProfile,
        traceByProfile: profileConversion.traceByProfile,
        profileConversion,
        mafConversion: contextMetadata,
        contextMetadata,
        conversionWarnings: contextWarnings,
        warnings: mergedWarnings,
        primaryWarnings: mergedWarnings,
        recommendedActions: fitResult.recommendedActions || [
          "Review MAF conversion count reconciliation, mutation burden, reconstruction error, and residuals before interpreting fitted exposures.",
        ],
	        publicationFigures: [
	          {
	            id: `converted_${selectedProfileKey.toLowerCase()}_profile`,
	            title: `Converted COSMIC-style ${selectedProfileKey} profile`,
	            recommendedRenderer: "mSigSDK.qcPlots.plotCosmicProfile",
	            dataFields: ["spectra"],
	          },
	          ...(fitResult.publicationFigures || []),
	        ],
        provenance: {
          ...fitResult.provenance,
          genome: {
            ...(fitResult.provenance?.genome || {}),
            build: genome,
            contextSource,
            contextApiVersion,
            contextLookupMode,
            contextFetchTimestamp,
          },
          catalog: {
            ...(fitResult.provenance?.catalog || {}),
            version: catalogVersion,
            source: catalogSource,
          },
          apiEndpointSnapshot,
          mafConversion: contextMetadata,
        },
      };
    }

    const validation = {
      maf: validateMafRows(mafFiles),
      spectra: validateSpectra(spectra, {
        expectedContexts: selectedExpectedContexts,
        ...(Number.isFinite(mutationBurdenOptions.lowBurdenThreshold)
          ? { minTotalMutations: mutationBurdenOptions.lowBurdenThreshold }
          : {}),
      }),
      mafToSbs96CountCheck: {
        valid: expectedConvertibleSnvCount === observedSbs96Count,
        expectedConvertibleSnvCount,
        observedSbs96Count,
        issues: contextWarnings,
      },
    };
    const qc = {
      mutationBurden: summarizeMutationBurden(spectra, {
        expectedContexts: selectedExpectedContexts,
        ...mutationBurdenOptions,
      }),
      missingContexts: summarizeMissingContexts(spectra, { expectedContexts: selectedExpectedContexts }),
    };
    const provenanceRecord = createProvenance({
      analysis: "MAF to mutational spectra",
      parameters,
      genomeBuild: genome,
      contextSource,
      contextApiVersion,
      contextLookupMode,
      contextFetchTimestamp,
      apiEndpointSnapshot,
    });

    return {
      schemaVersion: "msig.workflow.v0.3",
      workflow: "maf_spectra_qc",
      workflowRole: "maf_spectra_qc_analysis",
      scopeStatement:
        "High-level MAF-to-spectra QC workflow. The output validates conversion and context coverage; it does not perform signature attribution unless reference signatures are supplied.",
      methodBasis: {
        mafConversion:
          "MAF rows are grouped into mutation spectra using the configured genome, grouping field, batch size, and TCGA conversion setting.",
        interpretationBoundary:
          "Spectra-only output supports validation, burden review, and context coverage checks. Signature interpretation requires a separate fitted or extracted model.",
        contextFetching:
          offline
            ? "Trinucleotide context sequence is read from an offline position-indexed lookup table. Genome build, lookup mode, timestamp, and count-matching checks are recorded in provenance."
            : "Trinucleotide context sequence is requested from the configured genome sequence endpoint. Genome build, endpoint, timestamp, and count-matching checks are recorded in provenance.",
        references: [],
      },
      primaryInterpretationFields: [
        "mafConversion.sbs96CountMatchesConvertibleSnvCount",
        "qc.mutationBurden",
        "qc.missingContexts",
        "warnings",
      ],
      parameters,
      spectra,
      spectraByProfile: profileConversion.spectraByProfile,
      traceByProfile: profileConversion.traceByProfile,
      profileConversion,
      mafConversion: contextMetadata,
      contextMetadata,
      validation,
      qc,
      fit: null,
      extraction: null,
      panel: null,
      warnings: [...contextWarnings, ...profileWarnings],
      recommendedActions: contextWarnings.length || profileWarnings.length
        ? [
            "Verify genome build, grouping field, and trinucleotide-context lookup before fitting signatures.",
          ]
        : [
            "Proceed to known-signature fitting or exploratory extraction after reviewing burden and context coverage.",
          ],
	      publicationFigures: [
	        {
	          id: "mutation_burden",
	          title: "Mutation burden summary",
	          recommendedRenderer: "mSigSDK.qcPlots.plotMutationBurdenSummary",
	          dataFields: ["qc.mutationBurden"],
	        },
	        {
	          id: `converted_${selectedProfileKey.toLowerCase()}_profile`,
	          title: `Converted COSMIC-style ${selectedProfileKey} profile`,
	          recommendedRenderer: "mSigSDK.qcPlots.plotCosmicProfile",
	          dataFields: ["spectra"],
	        },
	      ],
      provenance: provenanceRecord,
      report: createAnalysisReport(
        {
          title: "mSigSDK MAF Analysis Report",
          summary:
            "MAF conversion summary with validation, mutation burden, and missing-context checks.",
          parameters,
          validation,
          qc,
          methodBasis: {
            mafConversion:
              offline
                ? `MAF rows are converted to ${selectedProfileKey} spectra after offline profile-context lookup against the configured genome build.`
                : `MAF rows are converted to ${selectedProfileKey} spectra after remote profile-context lookup against the configured genome build.`,
            contextFetching:
              selectedProfileKey.startsWith("SBS")
                ? "The sum of SBS context counts is checked against convertible SNV rows to detect failed or partial context lookup."
                : "Profile-specific counted rows are reconciled in profileConversion.audit.",
          },
          provenance: provenanceRecord,
          notes: contextWarnings.map((warning) => warning.message),
        },
        { format: reportFormat }
      ),
    };
  }

  /**
   * Beginner-facing MAF analysis wrapper with a small option set.
   *
   * @async
   * @function analyzeMafFilesLite
   * @memberof quickstart
   * @param {Object[]|Object[][]} mafFiles - MAF rows or nested MAF row arrays.
   * @param {Object<string,Object<string,number>>} [signatures=null] - Optional reference signatures for fitting.
   * @param {Object} [options] - Minimal options: groupBy, genome, offline, contextLookupTable, expectedContexts, reportFormat.
   * @returns {Promise<Object>} MAF-to-spectra or signature-fitting workflow result.
   */
  async function analyzeMafFilesLite(mafFiles, signatures = null, options = {}) {
    const allowedOptions = [
      "groupBy",
      "genome",
      "profiles",
      "offline",
      "contextLookupTable",
      "expectedContexts",
      "reportFormat",
      "catalogVersion",
      "catalogSource",
    ];
    const liteMafOptions = Object.fromEntries(
      allowedOptions
        .filter((key) => options[key] !== undefined)
        .map((key) => [key, options[key]])
    );
    const fitting = {
      exposureThreshold: options.exposureThreshold ?? 0.01,
      runThresholdSensitivity: true,
      runBootstrap: options.runBootstrap ?? Boolean(signatures),
      bootstrapIterations: options.bootstrapIterations ?? 100,
      reportFormat: options.reportFormat ?? "object",
    };
    return await analyzeMafFiles(mafFiles, signatures, {
      reportFormat: options.reportFormat ?? "object",
      ...liteMafOptions,
      fitting,
    });
  }

  //#endregion

  //#region Define the public members of the mSigSDK
  const mSigPortalData = {
    getMutationalSignaturesOptions,
    getMutationalSignaturesData,
    getMutationalSignaturesSummary,
    getMutationalSpectrumOptions,
    getMutationalSpectrumData,
    getMutationalSpectrumSummary,
    getMutationalSignatureAssociationOptions,
    getMutationalSignatureAssociationData,
    getMutationalSignatureActivityOptions,
    getMutationalSignatureActivityData,
    getMutationalSignatureLandscapeData,
    getMutationalSignatureEtiologyOptions,
    getMutationalSignatureEtiologyData,
    extractMutationalSpectra,
  };
  const mSigPortalPlots = {
    plotProfilerSummary,
    plotPatientMutationalSpectrum,
    plotForceDirectedTree,
    plotCosineSimilarityHeatMap,
    plotUMAPVisualization,
    plotProjectMutationalBurdenByCancerType,
    plotSignatureActivityDataBy,
    plotSignatureAssociations,
    plotMSPrevalenceData,
  };

  const mSigPortal = {
    mSigPortalData,
    mSigPortalPlots,
  };

	  const userData = {
	    convertMatrix,
	    convertMafToProfileSpectra,
	    convertWGStoPanel,
	    createWGStoPanelValidationPairs,
	    plotCosmicProfile,
	    plotCosmicSbs96Profile,
	    plotPatientMutationalSpectrumuserData,
	    convertMutationalSpectraIntoJSON,
	  };

  const TCGA = {
    getProjectsByGene,
    getTpmCountsByGenesOnProjects,
    getTpmCountsByGenesFromFiles,
    getMafInformationFromProjects,
    getVariantInformationFromMafFiles,
    convertTCGAProjectIntoJSON,
  };
  const tools = {
    groupBy,
  };

  const signatureFitting = {
    fitMutationalSpectraToSignatures,
    plotPatientMutationalSignaturesExposure,
    plotDatasetMutationalSignaturesExposure,
  };

  const machineLearning = {
    preprocessData,
    kFoldCV,
  };

  const validation = {
    assertValid,
    getExpectedContexts,
    listMafConvertibleProfiles,
    listProfileDefinitions,
    getMatrixContexts,
    getSBS96Contexts,
    normalizeMatrixObject,
    rowsToMatrix,
    rowsToSampleSpectra,
    rowsToSignatureMatrix,
    validateExposureMatrix,
    validateMafRows,
    validateSignatureMatrix,
    validateSpectra,
  };

  const qc = {
    QC_DEFAULTS,
    QC_WARNING_CODES,
    bootstrapSignatureFit,
    calculateFitResiduals,
    calculateReconstructionError,
    fitSpectraWithNNLS,
    normalizeExposures,
    runThresholdSensitivity,
    selectSamplesByMutationBurden,
    summarizeMissingContexts,
    summarizeMutationBurden,
  };

  const qcPlots = {
    plotBootstrapConfidenceIntervals,
    plotBootstrapExposureSummary,
    plotCohortGroupComparison,
    plotCohortSignatureSummary,
    plotCosmicProfile,
    plotCosmicSbs96Profile,
    plotFitQualityEvidenceDashboard,
	    plotFitResiduals,
	    plotMutationBurdenSummary,
    plotPanelEvidenceMatrix,
    plotReconstructionError,
    plotThresholdSensitivity,
    plotThresholdSensitivitySummary,
  };

  const plotting = {
    getDefaults: getPlottingDefaults,
    setDefaults: setPlottingDefaults,
    resetDefaults: resetPlottingDefaults,
  };

  const signatureExtraction = {
    compareExtractedToReference,
    extractSignaturesNMF,
    extractSignaturesNMFInWorker,
    selectNMFRank,
    spectraToMatrix,
  };

  const signatureExtractionPlots = {
    plotNMFExposureHeatmap,
    plotNMFRankSelection,
    plotNMFSignatureProfiles,
  };

  const io = {
    exposureMatrixToRows,
    exportCOSMICSignatureMatrix,
    exportMatrixTSV,
    exportMuSiCalInput,
    exportSigProfilerMatrix,
    importCOSMICSignatureMatrix,
    importMatrixTSV,
    importMuSiCalOutput,
    importSigProfilerMatrix,
    rowsToExposureMatrix,
    rowsToSampleSpectra,
    rowsToSignatureMatrix,
    signatureMatrixToRows,
    spectraToRows,
  };

  const reports = {
    createAnalysisReport,
    createAnalysisReportHTML,
    downloadAnalysisReport,
  };

  const advisor = {
    ADVISOR_DEFAULTS,
    WARNING_CODES,
    computeFitQualityEvidence,
    computeSignatureAmbiguity,
    computeSignatureIdentifiability,
    detectOutOfReferenceSignal,
    recommendAnalysisStrategy,
  };

  const pipelines = {
    runCohortFit,
    runCohortFitLite,
    runDiscoveryWorkflow,
    runDiscoveryWorkflowLite,
    runPanelWorkflow,
    runPanelWorkflowLite,
    runSingleSampleFit,
    runSingleSampleFitLite,
  };

  const workflows = {
    analyzeMafFiles,
    analyzeMafFilesLite,
    analyzeSpectraWithSignatures,
    createNMFAnalysis,
    createSignatureFitAnalysis,
    extractSignaturesFromSpectra,
    runCohortFit,
    runCohortFitLite,
    runDiscoveryWorkflow,
    runDiscoveryWorkflowLite,
    runPanelWorkflow,
    runPanelWorkflowLite,
    runSingleSampleFit,
    runSingleSampleFitLite,
  };

  const quickstart = {
    analyzeMafFiles: analyzeMafFilesLite,
    runSingleSampleFit: runSingleSampleFitLite,
    runCohortFit: runCohortFitLite,
    runPanelWorkflow: runPanelWorkflowLite,
    runDiscoveryWorkflow: runDiscoveryWorkflowLite,
  };

  const provenance = {
    createProvenance,
    withProvenance,
  };

  const presentation = {
    bootstrapRows,
    burdenSampleRows,
    compactSummary,
    DEFAULT_TOOLTIP_TERMS,
    details: presentationDetails,
    exposureRows,
    fitQualityEvidenceRows,
    fitQualityEvidenceTable,
    formatCell,
    formatNumber,
    metrics: presentationMetrics,
    nmfMatchRows,
    note: presentationNote,
    panelEvidenceRows,
    panelEvidenceTable,
    reconstructionRows,
    reportFieldRows,
    table: presentationTable,
    thresholdRows,
    tooltipTable,
    uncertaintyDecisionRows,
  };

  const runners = {
    pyodide: {
      DEFAULT_PYODIDE_INDEX_URL,
      PYODIDE_RUNNER_SCHEMA_VERSION,
      createRunner: createPyodideWorkerRunner,
      createWorkerSource: createPyodideWorkerSource,
      detect: detectPyodideRuntime,
      run: runPyodide,
      runPython,
    },
    webr: {
      DEFAULT_WEBR_BINARY_R_VERSION,
      DEFAULT_WEBR_MODULE_URL,
      DEFAULT_WEBR_REPOSITORY_URL,
      WEBR_RUNNER_SCHEMA_VERSION,
      checkPackages: checkWebRPackageAvailability,
      createRunner: createWebRRunner,
      detect: detectWebRRuntime,
      run: runWebR,
    },
    checkWebRPackageAvailability,
    createPyodideWorkerRunner,
    createWebRRunner,
    detectPyodideRuntime,
    detectWebRRuntime,
    runPython,
    runPyodide,
    runWebR,
  };

  const adapters = {
    ADAPTER_SCHEMA_VERSION,
    DEFAULT_SPC_PACKAGE,
    DEFAULT_SPE_PACKAGE,
    DEFAULT_SPMG_PACKAGE,
    DEFAULT_SPP_PACKAGE,
    DEFAULT_SPS_PACKAGE,
    DEFAULT_SPA_PACKAGE,
    DEFAULT_SPA_MICROPIP_PACKAGES,
    DEFAULT_MUSICAL_PACKAGE,
    PACKAGE_RUNTIME_MANIFEST,
    checkDeconstructSigsWebRAvailability,
    checkSigminerWebRAvailability,
    createInteroperabilityBundle,
    getPackageRuntime,
    listPackageRuntimes,
    parseExposureTables,
    parseDeconstructSigsOutput,
    parseSigminerOutput,
    parseSigProfilerMatrixGeneratorOutput,
    parseSigProfilerExtractorOutput,
    prepareDeconstructSigsInput,
    prepareMuSiCalRefitInput,
    prepareSigminerInput,
    prepareSigProfilerClustersInput,
    prepareSigProfilerAssignmentInput,
    prepareSigProfilerExtractorInput,
    prepareSigProfilerMatrixGeneratorInput,
    prepareSigProfilerPlottingInput,
    prepareSigProfilerSimulatorInput,
    runDeconstructSigsWebR,
    runMuSiCalRefit,
    runSigminerWebR,
    runSigProfilerAssignment,
    runSigProfilerExtractor,
    sigProfilerAssignment: {
      prepareInput: prepareSigProfilerAssignmentInput,
      run: runSigProfilerAssignment,
      parseOutput: parseExposureTables,
    },
    sigProfilerExtractor: {
      prepareInput: prepareSigProfilerExtractorInput,
      run: runSigProfilerExtractor,
      parseOutput: parseSigProfilerExtractorOutput,
    },
    sigProfilerMatrixGenerator: {
      prepareInput: prepareSigProfilerMatrixGeneratorInput,
      parseOutput: parseSigProfilerMatrixGeneratorOutput,
    },
    sigProfilerSimulator: {
      prepareInput: prepareSigProfilerSimulatorInput,
    },
    sigProfilerClusters: {
      prepareInput: prepareSigProfilerClustersInput,
    },
    sigProfilerPlotting: {
      prepareInput: prepareSigProfilerPlottingInput,
    },
    deconstructSigs: {
      prepareInput: prepareDeconstructSigsInput,
      checkWebRAvailability: checkDeconstructSigsWebRAvailability,
      run: runDeconstructSigsWebR,
      parseOutput: parseDeconstructSigsOutput,
    },
    sigminer: {
      prepareInput: prepareSigminerInput,
      checkWebRAvailability: checkSigminerWebRAvailability,
      run: runSigminerWebR,
      parseOutput: parseSigminerOutput,
    },
    musical: {
      prepareRefitInput: prepareMuSiCalRefitInput,
      runRefit: runMuSiCalRefit,
      packageRuntime: PACKAGE_RUNTIME_MANIFEST.tools?.musical || null,
    },
  };

  //#endregion

  // Public members
  return {
    name: SDK_NAME,
    version: SDK_VERSION,
    mSigPortal,
    userData,
    tools,
    machineLearning,
    signatureFitting,
    TCGA,
    validation,
    qc,
    qcPlots,
    plotting,
    signatureExtraction,
    signatureExtractionPlots,
    io,
    reports,
    advisor,
    pipelines,
    workflows,
    quickstart,
    provenance,
    presentation,
    runners,
    adapters,
  };
})();

export { mSigSDK };
