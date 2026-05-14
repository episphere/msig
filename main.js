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
  compareSignatureExposures = missingDependency("compareSignatureExposures"),
  computeFitQualityEvidence = missingDependency("computeFitQualityEvidence"),
  computeSignatureAmbiguity = missingDependency("computeSignatureAmbiguity"),
  detectOutOfReferenceSignal = missingDependency("detectOutOfReferenceSignal"),
  recommendAnalysisStrategy = missingDependency("recommendAnalysisStrategy"),
  runCohortFit = missingDependency("runCohortFit"),
  runCohortFitLite = missingDependency("runCohortFitLite"),
  runDiscoveryWorkflow = missingDependency("runDiscoveryWorkflow"),
  runDiscoveryWorkflowLite = missingDependency("runDiscoveryWorkflowLite"),
  runLocalizedMutagenesisAnalysis = missingDependency("runLocalizedMutagenesisAnalysis"),
  runPanelWorkflow = missingDependency("runPanelWorkflow"),
  runPanelWorkflowLite = missingDependency("runPanelWorkflowLite"),
  runSingleSampleFit = missingDependency("runSingleSampleFit"),
  runSingleSampleFitLite = missingDependency("runSingleSampleFitLite"),
  runSubgroupDiscoveryWorkflow = missingDependency("runSubgroupDiscoveryWorkflow"),
  summarizeRestrictedAssayEvidence = missingDependency("summarizeRestrictedAssayEvidence"),
} = guidanceModule;

const {
  bootstrapRows = missingDependency("bootstrapRows"),
  burdenSampleRows = missingDependency("burdenSampleRows"),
  compactSummary = missingDependency("compactSummary"),
  details: presentationDetails = missingDependency("presentation.details"),
  exposureRows = missingDependency("exposureRows"),
  formatCell = missingDependency("formatCell"),
  formatNumber = missingDependency("formatNumber"),
  metrics: presentationMetrics = missingDependency("presentation.metrics"),
  nmfMatchRows = missingDependency("nmfMatchRows"),
  note: presentationNote = missingDependency("presentation.note"),
  reconstructionRows = missingDependency("reconstructionRows"),
  reportFieldRows = missingDependency("reportFieldRows"),
  table: presentationTable = missingDependency("presentation.table"),
  thresholdRows = missingDependency("thresholdRows"),
} = presentationModule;

const {
  DEFAULT_PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.4/full/",
  PYODIDE_RUNNER_SCHEMA_VERSION = "msig.runner.pyodide.v0.3",
  createPyodideWorkerRunner = missingDependency("createPyodideWorkerRunner"),
  createPyodideWorkerSource = missingDependency("createPyodideWorkerSource"),
  detectPyodideRuntime = missingDependency("detectPyodideRuntime"),
  runPython = missingDependency("runPython"),
  runPyodide = missingDependency("runPyodide"),
} = runnersModule;

const {
  ADAPTER_SCHEMA_VERSION = "msig.adapters.v0.3",
  DEFAULT_SPA_PACKAGE = "SigProfilerAssignment==1.1.3",
  createInteroperabilityBundle = missingDependency("createInteroperabilityBundle"),
  parseExposureTables = missingDependency("parseExposureTables"),
  parseDeconstructSigsOutput = missingDependency("parseDeconstructSigsOutput"),
  parseSigProfilerExtractorOutput = missingDependency("parseSigProfilerExtractorOutput"),
  prepareDeconstructSigsInput = missingDependency("prepareDeconstructSigsInput"),
  prepareMuSiCalRefitInput = missingDependency("prepareMuSiCalRefitInput"),
  prepareSigProfilerAssignmentInput = missingDependency("prepareSigProfilerAssignmentInput"),
  prepareSigProfilerExtractorInput = missingDependency("prepareSigProfilerExtractorInput"),
  runMuSiCalRefit = missingDependency("runMuSiCalRefit"),
  runSigProfilerAssignment = missingDependency("runSigProfilerAssignment"),
  runSparseNnlsRefit = missingDependency("runSparseNnlsRefit"),
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

  /**
   * @namespace experimental
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

  function uniqueStringsForPlot(values) {
    return [...new Set(values.filter((value) => value !== undefined && value !== null).map(String))];
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

  function plotGraphWithPlotlyAndMakeDataDownloadable(divID, data, layout) {
    const { element: container } = resolvePlotContainer(divID);
    const plotly = Plotly.default || Plotly;

    // Plot the graph using Plotly
    plotly.newPlot(container, data, layout);

    // Ensure Font Awesome CSS is included
    const fontAwesomeLink =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css";
    if (!document.querySelector(`link[href="${fontAwesomeLink}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = fontAwesomeLink;
      document.head.appendChild(link);
    }

    // Get the container of the Plotly graph
    // Ensure the container has a relative position
    container.style.position = "relative";

    // Create a compact download button for the plotted data.
    const downloadBtn = document.createElement("div");
    downloadBtn.innerHTML =
      '<button class="msig-download-btn" title="Download plot data"><i class="fa fa-download"></i></button>';
    const btn = downloadBtn.firstChild;

    // Position the button at the top right corner of the container.
    btn.style.position = "absolute";
    btn.style.top = "8px";
    btn.style.right = "8px";
    btn.style.zIndex = "5";

    // Add an event listener to handle the download action
    btn.addEventListener("click", function () {
      const graphData = {
        traces: data,
        layout: layout,
      };
      const blob = new Blob([JSON.stringify(graphData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "graph_data.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    // Append the download button to the container
    container.appendChild(btn);

    // Add the provided CSS
    const css = `
        .msig-download-btn {
            background-color: rgba(255, 255, 255, 0.92);
            border: 1px solid #d1d5db;
            border-radius: 6px;
            color: #374151;
            padding: 6px 8px;
            cursor: pointer;
            font-size: 13px;
            line-height: 1;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        }

        .msig-download-btn:hover {
            background-color: #f9fafb;
            color: #111827;
        }
    `;

    const style = document.createElement("style");
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

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
        width: 100%;
        background: #ffffff;
        color: #111827;
        font-family: Arial, sans-serif;
      }
      .msig-d3-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-end;
        gap: 18px;
        margin: 0 0 14px 0;
      }
      .msig-d3-title {
        margin: 0 0 4px 0;
        font: 700 22px/1.15 Arial, sans-serif;
        letter-spacing: 0;
      }
      .msig-d3-subtitle {
        max-width: 700px;
        color: #6b7280;
        font: 400 13px/1.45 Arial, sans-serif;
      }
      .msig-d3-badges {
        display: grid;
        grid-auto-flow: column;
        gap: 8px;
      }
      .msig-d3-badge {
        min-width: 88px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: #f8fafc;
        padding: 7px 10px;
      }
      .msig-d3-badge-label {
        color: #6b7280;
        font: 700 10px/1.1 Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0;
      }
      .msig-d3-badge-value {
        margin-top: 3px;
        color: #111827;
        font: 700 16px/1.2 Arial, sans-serif;
      }
      .msig-d3-tooltip {
        pointer-events: none;
        position: absolute;
        z-index: 20;
        max-width: 260px;
        opacity: 0;
        transform: translateY(-6px);
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 10px 24px rgba(17, 24, 39, 0.14);
        padding: 9px 10px;
        color: #111827;
        font: 12px/1.35 Arial, sans-serif;
      }
      .msig-d3-tooltip div {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        white-space: nowrap;
      }
      .msig-d3-tooltip span {
        color: #6b7280;
      }
      .msig-d3-tooltip strong {
        font-weight: 700;
      }
      .msig-d3-axis path,
      .msig-d3-axis line {
        stroke: #cbd5e1;
      }
      .msig-d3-axis text {
        fill: #374151;
        font: 12px Arial, sans-serif;
      }
      .msig-d3-axis-title {
        fill: #111827;
        font: 700 12px Arial, sans-serif;
      }
      .msig-d3-caption {
        fill: #6b7280;
        font: 12px Arial, sans-serif;
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
          `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(
            value
          )}</strong></div>`
      )
      .join("");
  }

  function createD3PlotFrame(
    target,
    { title, subtitle, badges = [], maxWidth = "980px" } = {}
  ) {
    ensureD3PlotStyles();
    const { element: container } = resolvePlotContainer(target);
    container.innerHTML = "";
    container.classList.add("msig-d3-plot");
    container.style.maxWidth = maxWidth;

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

        const badgeLabel = document.createElement("div");
        badgeLabel.className = "msig-d3-badge-label";
        badgeLabel.textContent = label;

        const badgeValue = document.createElement("div");
        badgeValue.className = "msig-d3-badge-value";
        badgeValue.textContent = value;

        badge.append(badgeLabel, badgeValue);
        badgeContainer.appendChild(badge);
      });
      header.appendChild(badgeContainer);
    }

    const chart = document.createElement("div");
    chart.style.width = "100%";

    const tooltip = document.createElement("div");
    tooltip.className = "msig-d3-tooltip";

    container.append(header, chart, tooltip);

    const showTooltip = (event, html) => {
      const bounds = container.getBoundingClientRect();
      tooltip.innerHTML = html;
      tooltip.style.opacity = "1";
      tooltip.style.left = `${event.clientX - bounds.left + 14}px`;
      tooltip.style.top = `${event.clientY - bounds.top + 14}px`;
    };
    const hideTooltip = () => {
      tooltip.style.opacity = "0";
    };

    return { container, chart, tooltip, showTooltip, hideTooltip };
  }

  function appendResponsiveSvg(chart, width, height, label) {
    return d3
      .select(chart)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "auto")
      .attr("role", "img")
      .attr("aria-label", label || "mSigSDK plot");
  }

  function styleD3Axis(selection) {
    selection.classed("msig-d3-axis", true);
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
    divID = "mutationalSpectrumSummary"
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
        plotGraphWithPlotlyAndMakeDataDownloadable(divID, data, layout);
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
  async function plotProjectMutationalBurdenByCancerType(project, divID) {
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

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, data, layout);
  }

  //#endregion

  //#region Plot a patient's mutational spectra

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
    divID = "mutationalSpectrumMatrix"
  ) {
    if (!mutationalSpectra || typeof mutationalSpectra !== "object") {
      return renderPlotError(
        divID,
        "no data available for the selected parameters."
      );
    }

    const numberOfPatients = Object.keys(mutationalSpectra).length;
    if (numberOfPatients == 0) {
      return renderPlotError(
        divID,
        "no data available for the selected parameters."
      );
    } else if (numberOfPatients > 1) {
      const layout = {
        title: `Mutational Spectra for ${Object.keys(mutationalSpectra).join(
          ", "
        )}`,
        xaxis: { title: "Mutation Type" },
        yaxis: { title: "Count" },
        barmode: "group",
      };

      const traces = Object.keys(mutationalSpectra).map((patient) => ({
        x: Object.keys(mutationalSpectra[patient]),
        y: Object.values(mutationalSpectra[patient]),
        name: `${patient}`,
        type: "bar",
      }));

      plotGraphWithPlotlyAndMakeDataDownloadable(divID, traces, layout);
    } else {
      let traces = [];

      const layout = {
        title: `Mutational Spectra for ${Object.keys(mutationalSpectra).join(
          ", "
        )}`,
        xaxis: { title: "Mutation Type" },
        yaxis: { title: "Count" },
        barmode: "group",
      };

      for (let i = 0; i < Object.keys(mutationalSpectra).length; i++) {
        let plotlyData = formatMutationalSpectraData(
          mutationalSpectra[Object.keys(mutationalSpectra)[i]],
          Object.keys(mutationalSpectra)[i]
        );

        traces = traces.concat(plotlyData);
      }

      plotGraphWithPlotlyAndMakeDataDownloadable(divID, traces, layout);
    }
  }

  /**
Renders a plot of the mutational spectra for one or more patients in a given div element ID using Plotly.
@async
@function plotPatientMutationalSpectrum
@memberof mSigPortalPlots
@param {Object} mutationalSpectra - An object containing the mutational spectra data for one or more patients.
@param {number} [matrixSize=96] - The size of the plot matrix. Defaults to 96.
@param {string} [divID='mutationalSpectrumMatrix'] - The ID of the div element to render the plot in. Defaults to 'mutationalSpectrumMatrix'.
@returns {Promise<void>} A promise that resolves when the plot has been rendered.
@throws {Error} An error is thrown if no data is available for the selected parameters.
*/

  // This function plots the mutational spectrum for the given parameters.
  async function plotPatientMutationalSpectrum(
    mutationalSpectra,
    divID = "mutationalSpectrumMatrix"
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
          divID
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
    } else if (
      numberOfPatients > 2 &&
      matrixSize == 96 &&
      mutationType == "SBS"
    ) {
      mutationalSpectra = extractMutationalSpectra(mutationalSpectra);
      const layout = {
        title: `Mutational Spectra for ${Object.keys(mutationalSpectra).join(
          ", "
        )}`,
        xaxis: { title: "Mutation Type" },
        yaxis: { title: "Count" },
        barmode: "group",
      };

      const traces = Object.keys(mutationalSpectra).map((patient) => ({
        x: Object.keys(mutationalSpectra[patient]),
        y: Object.values(mutationalSpectra[patient]),
        name: `${patient}`,
        type: "bar",
      }));

      plotGraphWithPlotlyAndMakeDataDownloadable(divID, traces, layout);
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 96 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS96Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1]
      );
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 96 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS96(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 192 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS192(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 192 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS192Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1]
      );
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 288 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS288(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 384 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS384(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 1536 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS1536(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 78 &&
      mutationType == "DBS"
    ) {
      let traces = plotMutationalProfileDBS78(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 78 &&
      mutationType == "DBS"
    ) {
      let traces = plotMutationalProfileDBS78Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1],
        "pc"
      );
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 186 &&
      mutationType == "DBS"
    ) {
      let traces = plotMutationalProfileDBS186(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 28 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID28(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 29 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID29(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 83 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID83(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 83 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID83Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1],
        "pc"
      );
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 415 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID415(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 32 &&
      mutationType == "RS"
    ) {
      let traces = plotMutationalProfileRS32(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 32 &&
      mutationType == "RS"
    ) {
      let traces = plotMutationalProfileRS32Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1]
      );
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else {
      let traces = [];

      const layout = {
        title: `Mutational Spectra for ${Object.keys(mutationalSpectra).join(
          ", "
        )}`,
        xaxis: { title: "Mutation Type" },
        yaxis: { title: "Count" },
        barmode: "group",
      };

      for (let i = 0; i < Object.keys(mutationalSpectra).length; i++) {
        let plotlyData = formatMutationalSpectraData(
          mutationalSpectra[Object.keys(mutationalSpectra)[i]],
          Object.keys(mutationalSpectra)[i]
        );

        traces = traces.concat(plotlyData);
      }

      plotGraphWithPlotlyAndMakeDataDownloadable(divID, traces, layout);
    }
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
    showTable = false
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

    plotGraphWithPlotlyAndMakeDataDownloadable(heatmapDiv, plotlyData, layout);

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
  function plotSignatureActivityDataBy(divID, data, group = "signatureName") {
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
    plotGraphWithPlotlyAndMakeDataDownloadable(divID, groupTraces, {
      title: `Cumulative Exposure for ${group}`,
      yaxis: { title: "Log(Exposure)" },
      xaxis: { title: group },
    });
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
    divID = "forceDirectedTree"
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

    const element = document.getElementById(divID);
    element.style.width = "100%";
    element.style.height = "600px";
    element.style.maxWidth = "100%";

    generateForceDirectedTree(formattedClusters, divID);

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
    nNeighbors = 15
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

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, trace, layout);

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
    sample
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

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, [data], layout);

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
    colorscale = "Custom"
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

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, [data], layout);

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

  function plotSignatureAssociations(divID, data, signature1, signature2) {
    let dat = plotSignatureAssociation(data, signature1, signature2);
    plotGraphWithPlotlyAndMakeDataDownloadable(divID, dat.traces, dat.layout);
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

  function plotMSPrevalenceData(divID, data) {
    let dat = plotMSPrevalence(data);
    plotGraphWithPlotlyAndMakeDataDownloadable(divID, dat.traces, dat.layout);
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
  function plotMutationBurdenSummary(divID, burdenSummary) {
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

    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
      title: "Mutation burden QC",
      subtitle:
        "Each bar is a sample-level mutation count across the selected contexts. The vertical marker is the low-burden threshold used to flag spectra before fitting.",
      badges: [
        {
          label: "Threshold",
          value: hasThreshold ? formatPlotNumber(threshold, 1) : "Off",
        },
        { label: "Flagged", value: `${lowBurdenCount}/${samples.length}` },
        { label: "Empty", value: String(emptyCount) },
      ],
    });

    const width = 920;
    const rowHeight = 28;
    const margin = { top: 38, right: 92, bottom: 58, left: 132 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = Math.max(240, samples.length * rowHeight);
    const height = innerHeight + margin.top + margin.bottom;
    const svg = appendResponsiveSvg(
      chart,
      width,
      height,
      "Mutation burden by sample"
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
    { cosineReferenceLines = [] } = {}
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
        "Known-signature fitting is evaluated with paired diagnostics: cosine similarity should approach 1, while RMSE should approach 0.",
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
    });

    const width = 940;
    const rowHeight = 28;
    const margin = { top: 24, right: 28, bottom: 64, left: 132 };
    const gap = 54;
    const cosineWidth = 510;
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
      .call(d3.axisBottom(xRmse).ticks(4).tickSize(innerHeight).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());

    cosinePlot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xCosine).ticks(5).tickFormat(d3.format(".2f")))
      .call(styleD3Axis);
    rmsePlot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xRmse).ticks(4).tickFormat(d3.format(".3g")))
      .call(styleD3Axis);
    cosinePlot
      .append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(styleD3Axis)
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
            ["Cosine similarity", formatPlotNumber(row.cosineSimilarity, 4)],
            ["1 - cosine", formatPlotNumber(row.cosineGap, 4)],
            ["RMSE", formatPlotNumber(row.rmse, 5)],
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
            ["Cosine similarity", formatPlotNumber(row.cosineSimilarity, 4)],
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
  async function plotFitQualityEvidenceDashboard(divID, fitQualityEvidenceResult) {
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
    const samples = [...(fitQualityEvidenceResult.samples || [])].sort((a, b) => {
      const modeDelta =
        (severityRank[reportingModeFor(b)] ?? 0) -
        (severityRank[reportingModeFor(a)] ?? 0);
      if (modeDelta !== 0) {
        return modeDelta;
      }
      return reviewFlagCountFor(b) - reviewFlagCountFor(a);
    });
    if (samples.length === 0) {
      return renderPlotError(divID, "No fit-quality evidence available.");
    }

    const components = [
      { key: "burden", label: "Burden" },
      { key: "reconstruction", label: "Recon." },
      { key: "residual", label: "Residual" },
      { key: "bootstrap", label: "Bootstrap" },
      { key: "threshold", label: "Threshold" },
      { key: "ambiguity", label: "Ambiguity" },
      { key: "catalog", label: "Catalog" },
    ];
    const classLabel = {
      standard_qc_passed: "QC passed",
      report_with_caveats: "Flagged",
      restricted_interpretation: "Restricted",
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
      concern: "warning",
      caution: "caution",
      observed: "reported",
      ok: "ok",
      missing: "not measured",
    };
    const componentLabel = Object.fromEntries(
      components.map(({ key, label }) => [key, label])
    );
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
    const compactText = (value, maxLength = 14) => {
      const text = String(value ?? "NA");
      return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
    };
    const formatPercentEvidence = (value, digits = 1) =>
      Number.isFinite(value) ? d3.format(`.${digits}%`)(value) : "NA";
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
        return hasAnyWarning(sample, ["HIGH_RESIDUAL_STRUCTURE"])
          ? "concern"
          : Number.isFinite(evidence.unexplainedFraction)
            ? "observed"
            : "missing";
      }
      if (component === "bootstrap") {
        if (!evidence.measured) {
          return "missing";
        }
        return evidence.reviewFlag || evidence.warningCodes?.length
          ? "concern"
          : "ok";
      }
      if (component === "threshold") {
        if (!evidence.measured) {
          return "missing";
        }
        return evidence.reviewFlag || evidence.warningCodes?.length
          ? "concern"
          : "ok";
      }
      if (component === "ambiguity") {
        const classes = evidence.activeAmbiguityClasses || [];
        if (classes.includes("high")) {
          return "concern";
        }
        if (classes.includes("moderate")) {
          return "caution";
        }
        return classes.length ? "ok" : "missing";
      }
      if (component === "catalog") {
        if (evidence.status === "suspected_out_of_reference") {
          return "concern";
        }
        if (evidence.status && evidence.status !== "not_checked") {
          return "ok";
        }
        return "missing";
      }
      return "missing";
    };
    const componentValue = (sample, component) => {
      const evidence = evidenceFor(sample, component);
      if (component === "burden") {
        return evidence.totalMutations ?? sample.metrics?.totalMutations ?? "NA";
      }
      if (component === "reconstruction") {
        return Number.isFinite(evidence.cosineSimilarity)
          ? formatPlotNumber(evidence.cosineSimilarity, 3)
          : "NA";
      }
      if (component === "residual") {
        return formatPercentEvidence(evidence.unexplainedFraction, 1);
      }
      if (component === "bootstrap") {
        if (!evidence.measured) {
          return "not run";
        }
        return evidence.warningCodes?.length ? "warn" : "ok";
      }
      if (component === "threshold") {
        if (!evidence.measured) {
          return "not run";
        }
        return evidence.warningCodes?.length ? "warn" : "ok";
      }
      if (component === "ambiguity") {
        const classes = evidence.activeAmbiguityClasses || [];
        return compactText(
          classes.length ? uniqueStringsForPlot(classes).join("/") : "NA"
        );
      }
      if (component === "catalog") {
        return compactText(evidence.status || "not checked");
      }
      return "NA";
    };
    const componentDetail = (sample, component) => {
      const evidence = evidenceFor(sample, component);
      if (component === "burden") {
        return [
          ["Burden class", evidence.burdenClass || "NA"],
          ["Total mutations", evidence.totalMutations ?? "NA"],
        ];
      }
      if (component === "reconstruction") {
        return [
          ["Cosine", formatPlotNumber(evidence.cosineSimilarity, 4)],
          ["RMSE", formatPlotNumber(evidence.rmse, 5)],
        ];
      }
      if (component === "residual") {
        return [
          ["Unexplained", formatPercentEvidence(evidence.unexplainedFraction, 1)],
          ["Normalization", evidence.normalizationMode || "NA"],
        ];
      }
      if (component === "bootstrap") {
        return [
          ["Measured", evidence.measured ? "yes" : "no"],
          ["Warnings", evidence.warningCodes?.join(", ") || "none"],
          ["Max interval width", formatPlotNumber(evidence.maxConfidenceWidth, 4)],
        ];
      }
      if (component === "threshold") {
        return [
          ["Measured", evidence.measured ? "yes" : "no"],
          ["Warnings", evidence.warningCodes?.join(", ") || "none"],
          ["L1 change", formatPlotNumber(evidence.l1Change, 4)],
        ];
      }
      if (component === "ambiguity") {
        return [
          ["Active signatures", evidence.activeSignatures?.join(", ") || "none"],
          ["Classes", evidence.activeAmbiguityClasses?.join(", ") || "none"],
        ];
      }
      if (component === "catalog") {
        return [["Status", evidence.status || "not checked"]];
      }
      return [];
    };
    const rowHeight = 34;
    const margin = { top: 30, right: 32, bottom: 64, left: 150 };
    const flagWidth = 310;
    const heatGap = 54;
    const heatCellWidth = 88;
    const heatWidth = components.length * heatCellWidth;
    const width = margin.left + flagWidth + heatGap + heatWidth + margin.right;
    const innerHeight = Math.max(270, samples.length * rowHeight);
    const height = innerHeight + margin.top + margin.bottom;
    const meanFlagCount = fitQualityEvidenceResult.summary?.meanReviewFlagCount;
    const maxFlagCount = Math.max(
      1,
      ...samples.map((sample) => reviewFlagCountFor(sample))
    );

    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
      title: "Fit-quality evidence summary",
      subtitle:
        "QC evidence summarizes burden, reconstruction, residuals, bootstrap stability, threshold sensitivity, signature ambiguity, and catalog sufficiency.",
      badges: [
        {
          label: "Samples",
          value: String(samples.length),
        },
        {
          label: "Mean flags",
          value: Number.isFinite(meanFlagCount)
            ? formatPlotNumber(meanFlagCount, 1)
            : "NA",
        },
      ],
    });
    const svg = appendResponsiveSvg(chart, width, height, "Fit-quality evidence summary");
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
      .append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(styleD3Axis)
      .select(".domain")
      .remove();

    flagPlot
      .selectAll("rect.msig-fit-quality-flag")
      .data(samples)
      .join("rect")
      .attr("class", "msig-fit-quality-flag")
      .attr("x", 0)
      .attr("y", (sample) => y(sample.sample))
      .attr("width", (sample) => x(reviewFlagCountFor(sample)))
      .attr("height", y.bandwidth())
      .attr("rx", 4)
      .attr("fill", (sample) => classColor[reportingModeFor(sample)] || SCIENTIFIC_COLORS.gray)
      .attr("opacity", 0.88)
      .on("mousemove", (event, sample) =>
        showTooltip(
          event,
          tooltipRows([
            ["Sample", sample.sample],
            ["Review flags", String(reviewFlagCountFor(sample))],
            ["Reporting mode", classLabel[reportingModeFor(sample)] || reportingModeFor(sample)],
            ["Flag codes", sample.reviewFlagCodes?.join(", ") || "none"],
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
        reviewFlagCountFor(sample) >= maxFlagCount * 0.18
          ? x(reviewFlagCountFor(sample)) - 8
          : x(reviewFlagCountFor(sample)) + 7
      )
      .attr("y", (sample) => y(sample.sample) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (sample) =>
        reviewFlagCountFor(sample) >= maxFlagCount * 0.18 ? "end" : "start"
      )
      .attr("fill", (sample) =>
        reviewFlagCountFor(sample) >= maxFlagCount * 0.18
          ? "#ffffff"
          : SCIENTIFIC_COLORS.darkGray
      )
      .attr("font", "700 11px Arial, sans-serif")
      .text((sample) => reviewFlagCountFor(sample));

    const heatRows = samples.flatMap((sample) =>
      components.map(({ key }) => ({
        sample: sample.sample,
        component: key,
        value: componentValue(sample, key),
        state: componentState(sample, key),
        detailRows: componentDetail(sample, key),
      }))
    );
    heatPlot
      .selectAll("rect.msig-fit-quality-component")
      .data(heatRows)
      .join("rect")
      .attr("class", "msig-fit-quality-component")
      .attr("x", (row) => components.findIndex(({ key }) => key === row.component) * heatCellWidth)
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
            ["Evidence field", componentLabel[row.component] || row.component],
            ["Status", stateLabel[row.state] || row.state],
            ["Value", row.value],
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
        components.findIndex(({ key }) => key === row.component) * heatCellWidth +
        heatCellWidth / 2 -
        2
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
      .text((row) => compactText(row.value, 12));
    heatPlot
      .selectAll("text.msig-fit-quality-component-header")
      .data(components)
      .join("text")
      .attr("class", "msig-fit-quality-component-header")
      .attr("x", (component) =>
        components.findIndex(({ key }) => key === component.key) * heatCellWidth +
        heatCellWidth / 2 -
        2
      )
      .attr("y", -8)
      .attr("text-anchor", "middle")
      .attr("fill", SCIENTIFIC_COLORS.darkGray)
      .attr("font", "700 10px Arial, sans-serif")
      .text((component) => component.label);

    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + flagWidth / 2)
      .attr("y", height - 14)
      .attr("text-anchor", "middle")
      .text("Review flag count");
    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + flagWidth + heatGap + heatWidth / 2)
      .attr("y", height - 14)
      .attr("text-anchor", "middle")
      .text("Evidence fields");

    return { data: samples, components };
  }

  /**
   * Renders metadata-stratified fitted exposure differences.
   *
   * @async
   * @function plotCohortGroupComparison
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} comparisonResult - Result from mSigSDK.advisor.compareSignatureExposures.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotCohortGroupComparison(divID, comparisonResult) {
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
        "Fitted exposure differences are shown as comparison group minus reference group, with burden and fit-quality diagnostics available alongside the comparison.",
      badges: [
        { label: "Group key", value: comparisonResult.groupKey || "group" },
        { label: "Reference", value: comparisonResult.referenceGroup || "NA" },
      ],
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
            ["Reference group", row.referenceGroup],
            ["Comparison group", row.comparisonGroup],
            ["Mean difference", formatPlotNumber(row.meanDifference, 4)],
            ["Effect size", formatPlotNumber(row.effectSize, 3)],
            ["p-value", row.pValue === null ? "not run" : formatPlotNumber(row.pValue, 4)],
            ["q-value", row.qValue === null ? "not run" : formatPlotNumber(row.qValue, 4)],
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
  async function plotPanelEvidenceMatrix(divID, panelResultOrEvidenceCalls) {
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
      higher_review_support: "Higher support",
      limited_review_support: "Limited support",
      not_detected_within_review_settings: "Not detected",
      strong_evidence: "Higher support",
      weak_evidence: "Limited support",
      not_detected: "Not detected",
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
        "Evidence tiers summarize fitted exposure, sample burden, fit-quality evidence, and callable-territory evidence.",
      badges: [
        { label: "Samples", value: String(sampleNames.length) },
        { label: "Signatures", value: String(signatureNames.length) },
      ],
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
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .attr("text-anchor", "start")
      .attr("dx", "0.35em")
      .attr("dy", "-0.2em");
    plot
      .append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(styleD3Axis)
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
              "Callable signature mass",
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
              "Expected signature muts",
              formatPlotNumber(
                row.restrictedAssayEvidence?.expectedSignatureMutations,
                2
              ),
            ],
            [
              "Expected callable muts",
              formatPlotNumber(
                row.restrictedAssayEvidence?.expectedCallableSignatureMutations,
                2
              ),
            ],
            ["Reporting mode", row.fitQualityReportingMode || row.reportingMode || "NA"],
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
  async function plotFitResiduals(divID, residualResult, sampleName = null) {
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
      `${selectedSample.sample}; reconstructed`,
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

    return plotPatientMutationalSpectrum(
      [observedRows, reconstructedRows],
      divID
    );
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
  async function plotBootstrapConfidenceIntervals(divID, bootstrapResult) {
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
    const rows = signatures.map((signature) => ({
      signatureName: signature.signatureName,
      mean: signature.mean,
      median: signature.median,
      lower: signature.lower,
      upper: signature.upper,
      intervalWidth: signature.upper - signature.lower,
      selectionFrequency: signature.selectionFrequency,
      values: exposureSamples.map((sample) => sample[signature.signatureName] || 0),
    }));
    const maxExposure = Math.max(
      ...rows.flatMap((row) => [row.upper, row.mean, ...row.values]),
      0.01
    );
    const selectedCount = rows.filter(
      (row) => row.selectionFrequency >= 0.5
    ).length;

    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
      title: "Bootstrap exposure uncertainty",
      subtitle:
        "Each row shows the bootstrap exposure distribution for one signature, with the confidence interval, mean exposure, and threshold-selection frequency.",
      badges: [
        { label: "Iterations", value: String(bootstrapResult.iterations || 0) },
        { label: "Interval", value: `${confidenceLabel}%` },
        { label: "Selected", value: `${selectedCount}/${rows.length}` },
      ],
    });

    const width = 960;
    const rowHeight = 48;
    const margin = { top: 28, right: 26, bottom: 62, left: 132 };
    const exposureWidth = 640;
    const selectionGap = 48;
    const selectionWidth = 110;
    const innerHeight = Math.max(300, rows.length * rowHeight);
    const height = innerHeight + margin.top + margin.bottom;
    const svg = appendResponsiveSvg(
      chart,
      width,
      height,
      "Bootstrap confidence intervals and exposure distributions"
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
      .call(d3.axisBottom(x).ticks(6).tickSize(innerHeight).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());
    plot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(".2f")))
      .call(styleD3Axis);
    plot
      .append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(styleD3Axis)
      .select(".domain")
      .remove();
    selectionPlot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(selectionX).ticks(3).tickFormat(d3.format(".0%")))
      .call(styleD3Axis);

    const ridgeArea = d3
      .area()
      .curve(d3.curveBasis)
      .x((bin) => x((bin.x0 + bin.x1) / 2))
      .y0((bin) => bin.centerY)
      .y1((bin) => bin.centerY - bin.height);

    rows.forEach((row) => {
      const centerY = y(row.signatureName) + y.bandwidth() / 2;
      const bins = d3
        .bin()
        .domain(x.domain())
        .thresholds(26)(row.values);
      const maxBin = Math.max(...bins.map((bin) => bin.length), 1);
      const ridge = bins.map((bin) => ({
        ...bin,
        centerY,
        height: (bin.length / maxBin) * y.bandwidth() * 0.48,
      }));

      plot
        .append("path")
        .datum(ridge)
        .attr("d", ridgeArea)
        .attr("fill", SCIENTIFIC_COLORS.sky)
        .attr("opacity", 0.22);
    });

    const draws = rows.flatMap((row) =>
      row.values.map((value, index) => ({
        signatureName: row.signatureName,
        value,
        index,
      }))
    );
    plot
      .selectAll("circle.msig-bootstrap-draw")
      .data(draws)
      .join("circle")
      .attr("class", "msig-bootstrap-draw")
      .attr("cx", (draw) => x(draw.value))
      .attr("cy", (draw) => {
        const bandY = y(draw.signatureName) + y.bandwidth() / 2;
        const jitter = (((draw.index * 37) % 100) / 100 - 0.5) * y.bandwidth();
        return bandY + jitter * 0.7 + y.bandwidth() * 0.16;
      })
      .attr("r", 2.4)
      .attr("fill", "#475569")
      .attr("opacity", 0.22);

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
            ["Mean exposure", formatPlotNumber(row.mean, 4)],
            ["Median exposure", formatPlotNumber(row.median, 4)],
            [`${confidenceLabel}% lower`, formatPlotNumber(row.lower, 4)],
            [`${confidenceLabel}% upper`, formatPlotNumber(row.upper, 4)],
            ["Selection frequency", d3.format(".1%")(row.selectionFrequency)],
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
            ["Selection frequency", d3.format(".1%")(row.selectionFrequency)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    selectionPlot
      .selectAll("text.msig-bootstrap-selection-label")
      .data(rows)
      .join("text")
      .attr("class", "msig-bootstrap-selection-label")
      .attr("x", (row) =>
        row.selectionFrequency >= 0.75
          ? selectionX(row.selectionFrequency) - 8
          : selectionX(row.selectionFrequency) + 5
      )
      .attr("y", (row) => y(row.signatureName) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (row) =>
        row.selectionFrequency >= 0.75 ? "end" : "start"
      )
      .attr("fill", (row) =>
        row.selectionFrequency >= 0.75 ? "#ffffff" : SCIENTIFIC_COLORS.darkGray
      )
      .attr("font", "700 10px Arial, sans-serif")
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

    return { data: rows };
  }

  /**
   * Renders a threshold-sensitivity atlas for fitted exposures.
   *
   * @async
   * @function plotThresholdSensitivity
   * @memberof qcPlots
   * @param {string|Element} divID - Container element or element id.
   * @param {Object} thresholdResult - Result from mSigSDK.qc.runThresholdSensitivity.
   * @returns {Promise<Object|Element>} Render metadata or an error element.
   */
  async function plotThresholdSensitivity(divID, thresholdResult) {
    const runs = [...(thresholdResult.runs || [])]
      .filter((run) => Number.isFinite(run.threshold))
      .sort((a, b) => a.threshold - b.threshold);

    if (runs.length === 0) {
      return renderPlotError(divID, "No threshold sensitivity results available.");
    }

    const baselineRun = runs[0];
    const metricDefinitions = [
      {
        key: "averageCosineSimilarity",
        metric: "Cosine",
        valueFormat: 4,
        color: SCIENTIFIC_COLORS.blue,
      },
      {
        key: "averageRmse",
        metric: "RMSE",
        valueFormat: 5,
        color: SCIENTIFIC_COLORS.orange,
      },
      {
        key: "averageActiveSignatures",
        metric: "Active signatures",
        valueFormat: 2,
        color: SCIENTIFIC_COLORS.green,
      },
    ];
    const metricOrder = metricDefinitions.map(({ metric }) => metric);
    const metricColorRange = metricDefinitions.map(({ color }) => color);
    const thresholdLabels = runs.map((run) =>
      String(formatPlotNumber(run.threshold, 3))
    );
    const thresholdMin = runs[0].threshold;
    const thresholdMax = runs[runs.length - 1].threshold;
    const thresholdSpan = Math.max(thresholdMax - thresholdMin, 1e-6);
    const xDomain = [thresholdMin, thresholdMax + thresholdSpan * 0.28];
    const formatSignedPercent = (value) =>
      `${value > 0 ? "+" : ""}${formatPlotNumber(value, 1)}%`;
    const rows = runs.flatMap((run) =>
      metricDefinitions.map(({ key, metric, valueFormat }) => {
        const value = Number(run[key]);
        const baseline = Number(baselineRun[key]);
        const delta = value - baseline;
        const percentChange =
          Number.isFinite(baseline) && Math.abs(baseline) > 1e-12
            ? (delta / Math.abs(baseline)) * 100
            : 0;

        return {
          threshold: run.threshold,
          thresholdLabel: String(formatPlotNumber(run.threshold, 3)),
          metric,
          value,
          valueLabel: formatPlotNumber(value, valueFormat),
          baseline,
          baselineLabel: formatPlotNumber(baseline, valueFormat),
          delta,
          deltaLabel: formatPlotNumber(delta, valueFormat),
          percentChange,
          percentChangeLabel: formatSignedPercent(percentChange),
          absPercentChange: Math.abs(percentChange),
        };
      })
    );
    const stabilityRows = runs.map((run) => {
      const thresholdLabel = String(formatPlotNumber(run.threshold, 3));
      const rowsForThreshold = rows.filter(
        (row) => row.threshold === run.threshold
      );
      const meanAbsoluteDrift =
        rowsForThreshold.reduce(
          (total, row) => total + row.absPercentChange,
          0
        ) / rowsForThreshold.length;
      const largestDriver = rowsForThreshold.reduce((largest, row) =>
        row.absPercentChange > largest.absPercentChange ? row : largest
      );

      return {
        threshold: run.threshold,
        thresholdLabel,
        meanAbsoluteDrift,
        meanAbsoluteDriftLabel: `${formatPlotNumber(meanAbsoluteDrift, 1)}%`,
        largestDriver: largestDriver.metric,
        largestDriverChange: largestDriver.percentChange,
        largestDriverChangeLabel: formatSignedPercent(
          largestDriver.percentChange
        ),
      };
    });
    const maxAbsPercentChange = Math.max(
      ...rows.map((row) => row.absPercentChange),
      1
    );
    const maxMeanAbsoluteDrift = Math.max(
      ...stabilityRows.map((row) => row.meanAbsoluteDrift),
      1
    );
    const yDomainMax = maxAbsPercentChange * 1.14;
    const colorDomain = [-maxAbsPercentChange, 0, maxAbsPercentChange];
    const endpointRows = metricDefinitions
      .map(({ metric, color }, index) => {
        const endpoint = [...rows]
          .reverse()
          .find((row) => row.metric === metric);

        return endpoint
          ? {
              ...endpoint,
              label: `${metric}: ${endpoint.percentChangeLabel}`,
              labelColor: color,
              labelOffset: (index - 1) * 16,
            }
          : null;
      })
      .filter(Boolean);

    const { chart, showTooltip, hideTooltip } = createD3PlotFrame(divID, {
      title: "Threshold sensitivity summary",
      subtitle:
        "Threshold sweeps show changes in reconstruction quality and active signature counts across configured exposure cutoffs.",
      badges: [
        { label: "Baseline", value: formatPlotNumber(baselineRun.threshold, 3) },
        { label: "Max drift", value: `${formatPlotNumber(maxAbsPercentChange, 1)}%` },
      ],
    });

    const width = 1120;
    const margin = { top: 28, right: 245, bottom: 52, left: 126 };
    const topHeight = 285;
    const heatTop = topHeight + 76;
    const heatHeight = 128;
    const heatWidth = 560;
    const impactGap = 64;
    const instabilityWidth = 220;
    const height = heatTop + heatHeight + margin.bottom;
    const svg = appendResponsiveSvg(
      chart,
      width,
      height,
      "Threshold sensitivity of signature fitting"
    );
    const x = d3.scaleLinear().domain(xDomain).range([0, width - margin.left - margin.right]);
    const y = d3
      .scaleLinear()
      .domain([-yDomainMax, yDomainMax])
      .nice()
      .range([topHeight, 0]);
    const metricColor = d3.scaleOrdinal(metricOrder, metricColorRange);
    const signedColor = d3
      .scaleLinear()
      .domain(colorDomain)
      .range([SCIENTIFIC_COLORS.blue, "#f8fafc", SCIENTIFIC_COLORS.orange]);
    const topPlot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    topPlot
      .append("g")
      .attr("stroke", SCIENTIFIC_COLORS.lightGray)
      .attr("stroke-opacity", 0.9)
      .call(d3.axisLeft(y).ticks(6).tickSize(-x.range()[1]).tickFormat(""))
      .call((axis) => axis.select(".domain").remove());
    topPlot
      .append("g")
      .attr("transform", `translate(0,${topHeight})`)
      .call(d3.axisBottom(x).ticks(runs.length).tickFormat(d3.format(".2f")))
      .call(styleD3Axis);
    topPlot
      .append("g")
      .call(
        d3
          .axisLeft(y)
          .ticks(6)
          .tickFormat((value) => `${value > 0 ? "+" : ""}${formatPlotNumber(value, 1)}%`)
      )
      .call(styleD3Axis);
    topPlot
      .append("line")
      .attr("x1", 0)
      .attr("x2", x.range()[1])
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "#64748b")
      .attr("stroke-width", 1.4);

    const line = d3
      .line()
      .curve(d3.curveMonotoneX)
      .x((row) => x(row.threshold))
      .y((row) => y(row.percentChange));
    const rowsByMetric = d3.group(rows, (row) => row.metric);
    for (const [metric, metricRows] of rowsByMetric) {
      topPlot
        .append("path")
        .datum(metricRows)
        .attr("fill", "none")
        .attr("stroke", metricColor(metric))
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("d", line);
    }
    topPlot
      .selectAll("circle.msig-threshold-point")
      .data(rows)
      .join("circle")
      .attr("class", "msig-threshold-point")
      .attr("cx", (row) => x(row.threshold))
      .attr("cy", (row) => y(row.percentChange))
      .attr("r", 5.5)
      .attr("fill", (row) => metricColor(row.metric))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.3)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
          tooltipRows([
            ["Metric", row.metric],
            ["Threshold", formatPlotNumber(row.threshold, 3)],
            ["Value", row.valueLabel],
            ["Baseline", row.baselineLabel],
            ["Change", row.percentChangeLabel],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    topPlot
      .selectAll("text.msig-threshold-end-label")
      .data(endpointRows)
      .join("text")
      .attr("class", "msig-threshold-end-label")
      .attr("x", (row) => x(row.threshold) + 10)
      .attr("y", (row) => y(row.percentChange) + row.labelOffset)
      .attr("fill", (row) => row.labelColor)
      .attr("font", "700 12px Arial, sans-serif")
      .attr("dominant-baseline", "middle")
      .text((row) => row.label);

    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + x.range()[1] / 2)
      .attr("y", margin.top + topHeight + 42)
      .attr("text-anchor", "middle")
      .text("Exposure threshold");
    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + topHeight / 2))
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .text("% change from baseline");

    const heatX = d3
      .scaleBand()
      .domain(thresholdLabels)
      .range([0, heatWidth])
      .padding(0.08);
    const heatY = d3
      .scaleBand()
      .domain(metricOrder)
      .range([0, heatHeight])
      .padding(0.12);
    const heatPlot = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top + heatTop})`);
    heatPlot
      .selectAll("rect.msig-threshold-heat")
      .data(rows)
      .join("rect")
      .attr("class", "msig-threshold-heat")
      .attr("x", (row) => heatX(row.thresholdLabel))
      .attr("y", (row) => heatY(row.metric))
      .attr("width", heatX.bandwidth())
      .attr("height", heatY.bandwidth())
      .attr("rx", 4)
      .attr("fill", (row) => signedColor(row.percentChange))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
          tooltipRows([
            ["Metric", row.metric],
            ["Threshold", row.thresholdLabel],
            ["Value", row.valueLabel],
            ["Baseline", row.baselineLabel],
            ["Change", row.percentChangeLabel],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    heatPlot
      .selectAll("text.msig-threshold-heat-label")
      .data(rows)
      .join("text")
      .attr("class", "msig-threshold-heat-label")
      .attr("x", (row) => heatX(row.thresholdLabel) + heatX.bandwidth() / 2)
      .attr("y", (row) => heatY(row.metric) + heatY.bandwidth() / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", (row) =>
        row.absPercentChange > maxAbsPercentChange * 0.55 ? "#ffffff" : "#111827"
      )
      .attr("font", "700 11px Arial, sans-serif")
      .text((row) => row.percentChangeLabel);
    heatPlot
      .append("g")
      .attr("transform", `translate(0,${heatHeight})`)
      .call(d3.axisBottom(heatX).tickSize(0))
      .call(styleD3Axis)
      .select(".domain")
      .remove();
    heatPlot
      .append("g")
      .call(d3.axisLeft(heatY).tickSize(0))
      .call(styleD3Axis)
      .select(".domain")
      .remove();

    const instabilityPlot = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left + heatWidth + impactGap},${margin.top + heatTop})`
      );
    const instabilityX = d3
      .scaleLinear()
      .domain([0, maxMeanAbsoluteDrift * 1.32])
      .range([0, instabilityWidth]);
    const instabilityY = d3
      .scaleBand()
      .domain(thresholdLabels)
      .range([0, heatHeight])
      .padding(0.22);
    instabilityPlot
      .append("g")
      .attr("transform", `translate(0,${heatHeight})`)
      .call(d3.axisBottom(instabilityX).ticks(4).tickFormat((value) => `${formatPlotNumber(value, 1)}%`))
      .call(styleD3Axis);
    instabilityPlot
      .append("g")
      .call(d3.axisLeft(instabilityY).tickSize(0))
      .call(styleD3Axis)
      .select(".domain")
      .remove();
    instabilityPlot
      .selectAll("rect.msig-threshold-instability")
      .data(stabilityRows)
      .join("rect")
      .attr("class", "msig-threshold-instability")
      .attr("x", 0)
      .attr("y", (row) => instabilityY(row.thresholdLabel))
      .attr("width", (row) => instabilityX(row.meanAbsoluteDrift))
      .attr("height", instabilityY.bandwidth())
      .attr("rx", 4)
      .attr("fill", (row) => metricColor(row.largestDriver))
      .attr("opacity", 0.76)
      .on("mousemove", (event, row) =>
        showTooltip(
          event,
          tooltipRows([
            ["Threshold", row.thresholdLabel],
            ["Mean absolute drift", row.meanAbsoluteDriftLabel],
            ["Largest driver", row.largestDriver],
            ["Driver change", row.largestDriverChangeLabel],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    instabilityPlot
      .selectAll("text.msig-threshold-instability-label")
      .data(stabilityRows)
      .join("text")
      .attr("class", "msig-threshold-instability-label")
      .attr("x", (row) => instabilityX(row.meanAbsoluteDrift) + 5)
      .attr("y", (row) => instabilityY(row.thresholdLabel) + instabilityY.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .attr("fill", SCIENTIFIC_COLORS.darkGray)
      .attr("font", "700 10px Arial, sans-serif")
      .text((row) => row.meanAbsoluteDriftLabel);

    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + heatWidth / 2)
      .attr("y", margin.top + heatTop - 14)
      .attr("text-anchor", "middle")
      .text("Signed metric change");
    svg
      .append("text")
      .attr("class", "msig-d3-axis-title")
      .attr("x", margin.left + heatWidth + impactGap + instabilityWidth / 2)
      .attr("y", margin.top + heatTop - 14)
      .attr("text-anchor", "middle")
      .text("Mean absolute drift");

    return {
      data: rows,
      stability: stabilityRows,
      baselineThreshold: baselineRun.threshold,
      maxAbsolutePercentChange: maxAbsPercentChange,
    };
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
   * @returns {Promise<Array|Element>} Rendered profile results or an error element.
   */
  async function plotNMFSignatureProfiles(
    divID,
    nmfResult,
    { maxSignatures = Infinity } = {}
  ) {
    const { element: container } = resolvePlotContainer(divID);
    const signatures = Object.entries(nmfResult?.signatures || {}).slice(
      0,
      maxSignatures
    );
    const contexts = nmfResult?.contexts || null;

    if (signatures.length === 0) {
      return renderPlotError(divID, "No extracted NMF signatures available.");
    }

    container.innerHTML = "";
    container.style.display = "grid";
    container.style.gap = "28px";

    const rendered = [];
    for (const [signatureName, signatureRecord] of signatures) {
      const signatureDiv = document.createElement("div");
      signatureDiv.style.width = "100%";
      container.appendChild(signatureDiv);
      rendered.push(
        await plotPatientMutationalSpectrum(
          [spectrumRecordToProfileRows(signatureRecord, signatureName, contexts)],
          signatureDiv
        )
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
    { relative = true } = {}
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
        "Heatmaps are the standard first-pass view for signature activities: rows are samples, columns are extracted signatures, and color encodes exposure.",
      badges: [
        { label: "Samples", value: String(sampleNames.length) },
        { label: "Signatures", value: String(signatureNames.length) },
        { label: "Scale", value: relative ? "Relative" : "Raw" },
      ],
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
            [relative ? "Relative exposure" : "Exposure", formatPlotNumber(row.value, 4)],
            ["Raw exposure", formatPlotNumber(row.rawValue, 4)],
          ])
        )
      )
      .on("mouseleave", hideTooltip);
    plot
      .append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call(styleD3Axis)
      .selectAll("text")
      .attr("text-anchor", "end")
      .attr("transform", "rotate(-35)")
      .attr("dx", "-0.5em")
      .attr("dy", "0.15em");
    plot
      .append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(styleD3Axis)
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
  async function plotNMFRankSelection(divID, rankSelection) {
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
        "Rank selection is a model-selection problem. Compare reconstruction error with sample-level cosine similarity, then inspect whether the extracted signatures remain interpretable.",
      badges: [
        { label: "Ranks tested", value: String(runs.length) },
        { label: "Recommended", value: String(recommendedRank) },
      ],
    });

    const width = 920;
    const panelWidth = 365;
    const panelGap = 72;
    const margin = { top: 34, right: 34, bottom: 62, left: 72 };
    const innerHeight = 260;
    const height = innerHeight + margin.top + margin.bottom;
    const svg = appendResponsiveSvg(chart, width, height, "NMF rank diagnostics");
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
        .call(d3.axisBottom(x).ticks(runs.length).tickFormat(d3.format("d")))
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
    const apiEndpointSnapshot = offline
      ? null
      : buildUCSCContextEndpointSnapshot({
          genome,
          contextApiEndpoint,
        });
    const expectedConvertibleSnvCount = countConvertibleSnvRows(mafFiles, { tcga });
    const spectra = await convertMatrix(
      mafFiles,
      groupBy,
      batchSize,
      genome,
      tcga,
      {
        offline,
        contextLookupTable,
      }
    );
    const observedSbs96Count = sumSpectraCounts(spectra);
    const contextWarnings =
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
    const contextMetadata = {
      genomeBuild: genome,
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
      sbs96CountMatchesConvertibleSnvCount:
        expectedConvertibleSnvCount === observedSbs96Count,
      validationRule:
        "The sum of SBS96 context counts should equal the number of convertible single-base substitution rows.",
    };
    const parameters = {
      groupBy,
      batchSize,
      genome,
      tcga,
      contextMetadata,
      ...fitting,
    };

    if (signatures) {
      const fitResult = await analyzeSpectraWithSignatures(spectra, signatures, {
        ...fitting,
        expectedContexts,
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
        mafConversion: contextMetadata,
        contextMetadata,
        conversionWarnings: contextWarnings,
        warnings: mergedWarnings,
        primaryWarnings: mergedWarnings,
        recommendedActions: fitResult.recommendedActions || [
          "Review MAF conversion count reconciliation, mutation burden, reconstruction error, and residuals before interpreting fitted exposures.",
        ],
        publicationFigures: fitResult.publicationFigures || [],
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
        expectedContexts,
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
        expectedContexts,
        ...mutationBurdenOptions,
      }),
      missingContexts: summarizeMissingContexts(spectra, { expectedContexts }),
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
      mafConversion: contextMetadata,
      contextMetadata,
      validation,
      qc,
      fit: null,
      extraction: null,
      panel: null,
      warnings: contextWarnings,
      recommendedActions: contextWarnings.length
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
                ? "MAF rows are converted to SBS96 spectra after offline trinucleotide-context lookup against the configured genome build."
                : "MAF rows are converted to SBS96 spectra after remote trinucleotide-context lookup against the configured genome build.",
            contextFetching:
              "The sum of SBS96 context counts is checked against convertible SNV rows to detect failed or partial context lookup.",
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
    convertWGStoPanel,
    createWGStoPanelValidationPairs,
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
    plotCohortGroupComparison,
    plotFitQualityEvidenceDashboard,
    plotFitResiduals,
    plotMutationBurdenSummary,
    plotPanelEvidenceMatrix,
    plotReconstructionError,
    plotThresholdSensitivity,
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
    compareSignatureExposures,
    computeFitQualityEvidence,
    computeSignatureAmbiguity,
    detectOutOfReferenceSignal,
    recommendAnalysisStrategy,
    summarizeRestrictedAssayEvidence,
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

  const experimental = {
    runLocalizedMutagenesisAnalysis,
    runSubgroupDiscoveryWorkflow,
  };

  const provenance = {
    createProvenance,
    withProvenance,
  };

  const presentation = {
    bootstrapRows,
    burdenSampleRows,
    compactSummary,
    details: presentationDetails,
    exposureRows,
    formatCell,
    formatNumber,
    metrics: presentationMetrics,
    nmfMatchRows,
    note: presentationNote,
    reconstructionRows,
    reportFieldRows,
    table: presentationTable,
    thresholdRows,
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
    createPyodideWorkerRunner,
    detectPyodideRuntime,
    runPython,
    runPyodide,
  };

  const adapters = {
    ADAPTER_SCHEMA_VERSION,
    DEFAULT_SPA_PACKAGE,
    createInteroperabilityBundle,
    parseExposureTables,
    parseDeconstructSigsOutput,
    parseSigProfilerExtractorOutput,
    prepareDeconstructSigsInput,
    prepareMuSiCalRefitInput,
    prepareSigProfilerAssignmentInput,
    prepareSigProfilerExtractorInput,
    runMuSiCalRefit,
    runSigProfilerAssignment,
    runSparseNnlsRefit,
    sigProfilerAssignment: {
      prepareInput: prepareSigProfilerAssignmentInput,
      run: runSigProfilerAssignment,
      parseOutput: parseExposureTables,
    },
    sigProfilerExtractor: {
      prepareInput: prepareSigProfilerExtractorInput,
      parseOutput: parseSigProfilerExtractorOutput,
    },
    deconstructSigs: {
      prepareInput: prepareDeconstructSigsInput,
      parseOutput: parseDeconstructSigsOutput,
    },
    musical: {
      prepareRefitInput: prepareMuSiCalRefitInput,
      runRefit: runMuSiCalRefit,
      runSparseNnlsRefit,
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
    signatureExtraction,
    signatureExtractionPlots,
    io,
    reports,
    advisor,
    pipelines,
    workflows,
    quickstart,
    experimental,
    provenance,
    presentation,
    runners,
    adapters,
  };
})();

export { mSigSDK };
