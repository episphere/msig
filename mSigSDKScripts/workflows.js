import {
  calculateFitResiduals,
  calculateReconstructionError,
  summarizeMissingContexts,
  summarizeMutationBurden,
} from "./qc.js";
import { createAnalysisReport } from "./reports.js";
import {
  compareExtractedToReference,
  extractSignaturesNMF,
} from "./signatureExtraction.js";
import {
  validateExposureMatrix,
  validateSignatureMatrix,
  validateSpectra,
} from "./validation.js";

const WORKFLOW_RESULT_SCHEMA_VERSION = "msig.workflow.v0.3";

const WORKFLOW_SCOPE_STATEMENTS = {
  signatureFit:
    "High-level known-signature fitting report assembly. The workflow packages validation, QC, residuals, reconstruction metrics, exposures, provenance, and report output; it does not validate biological causality or clinical actionability.",
  nmfExtraction:
    "High-level exploratory NMF extraction report assembly for browser-sized analyses. Extracted signatures and catalog matches require external validation before biological interpretation.",
};

const WORKFLOW_METHOD_BASIS = {
  signatureFit:
    "Known-signature fitting is summarized as an auditable workflow with separate validation, burden, context coverage, reconstruction, residual, exposure, and provenance outputs.",
  nmfExtraction:
    "NMF extraction is stochastic and rank-dependent. The report exposes rank, convergence, reconstruction, and optional reference matching rather than treating extracted profiles as confirmed mutational processes.",
};

const WORKFLOW_LITERATURE_REFERENCES = {
  koh2021: {
    key: "Koh2021",
    doi: "10.1038/s41568-021-00377-7",
    url: "https://doi.org/10.1038/s41568-021-00377-7",
  },
  alexandrov2020: {
    key: "Alexandrov2020",
    doi: "10.1038/s41586-020-1943-3",
    url: "https://doi.org/10.1038/s41586-020-1943-3",
  },
  degasperi2020: {
    key: "Degasperi2020",
    doi: "10.1038/s43018-020-0027-5",
    url: "https://doi.org/10.1038/s43018-020-0027-5",
  },
};

/**
 * Assembles validation, QC, residuals, reconstruction metrics, and a report for fitted signatures.
 *
 * @function createSignatureFitAnalysis
 * @memberof workflows
 * @param {Object} [input] - Workflow inputs.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra matrix.
 * @param {Object<string,Object<string,number>>} input.signatures - Signature matrix.
 * @param {Object<string,Object<string,number>>} input.exposures - Exposure matrix.
 * @param {Object} [input.parameters={}] - Analysis parameters to include in the report.
 * @param {string[]} [input.expectedContexts=null] - Expected mutation contexts.
 * @param {Object} [input.mutationBurdenOptions={}] - Options for summarizeMutationBurden.
 * @param {Object} [input.provenance=null] - Provenance record to include.
 * @param {string} [input.reportFormat="object"] - "object", "json", or "html".
 * @returns {Object} Validation, QC, and report objects.
 */
function createSignatureFitAnalysis({
  spectra,
  signatures,
  exposures,
  parameters = {},
  expectedContexts = null,
  mutationBurdenOptions = {},
  residualOptions = {},
  reconstructionOptions = {},
  validationOptions: callerValidationOptions = {},
  provenance = null,
  reportFormat = "object",
} = {}) {
  const validationOptions = {
    expectedContexts,
    ...(Number.isFinite(mutationBurdenOptions.lowBurdenThreshold)
        ? { minTotalMutations: mutationBurdenOptions.lowBurdenThreshold }
        : {}),
    ...callerValidationOptions,
  };
  const validation = {
    spectra: validateSpectra(spectra, validationOptions),
    signatures: validateSignatureMatrix(signatures, { expectedContexts }),
    exposures: validateExposureMatrix(exposures),
  };
  const qc = {
    mutationBurden: summarizeMutationBurden(spectra, {
      expectedContexts,
      ...mutationBurdenOptions,
    }),
    missingContexts: summarizeMissingContexts(spectra, { expectedContexts }),
    reconstructionError: calculateReconstructionError(
      signatures,
      spectra,
      exposures,
      {
        contexts: expectedContexts,
        ...reconstructionOptions,
      }
    ),
    residuals: calculateFitResiduals(signatures, spectra, exposures, {
      contexts: expectedContexts,
      ...residualOptions,
    }),
  };
  const methodBasis = {
    signatureFit: WORKFLOW_METHOD_BASIS.signatureFit,
    interpretationBoundary:
      "Exposures are fitted contributions under the supplied catalog and settings. They should be interpreted with the attached QC, uncertainty, catalog, and assay limitations.",
    references: [
      WORKFLOW_LITERATURE_REFERENCES.koh2021,
      WORKFLOW_LITERATURE_REFERENCES.alexandrov2020,
    ],
  };
  const primaryInterpretationFields = [
    "qc.mutationBurden",
    "qc.reconstructionError",
    "qc.residuals",
    "fit.exposures",
  ];
  const recommendedActions = [
    "Review mutation burden, reconstruction error, and residual structure before interpreting fitted exposures.",
  ];
  const publicationFigures = [
    {
      id: "mutation_burden",
      title: "Mutation burden summary",
      recommendedRenderer: "mSigSDK.qcPlots.plotMutationBurdenSummary",
      dataFields: ["qc.mutationBurden"],
    },
    {
      id: "fit_residuals",
      title: "Observed-versus-reconstructed residuals",
      recommendedRenderer: "mSigSDK.qcPlots.plotFitResiduals",
      dataFields: ["qc.residuals"],
    },
  ];

  return {
    schemaVersion: WORKFLOW_RESULT_SCHEMA_VERSION,
    workflow: "signature_fit_analysis",
    workflowRole: "signature_fit_analysis",
    scopeStatement: WORKFLOW_SCOPE_STATEMENTS.signatureFit,
    methodBasis,
    primaryInterpretationFields,
    parameters,
    validation,
    qc,
    fit: {
      method: "NNLS",
      exposures,
      reconstructionError: qc.reconstructionError,
      residuals: qc.residuals,
    },
    warnings: [],
    recommendedActions,
    publicationFigures,
    provenance,
    outputs: {
      validation: "Input spectra, signature matrix, and exposure matrix checks.",
      qc:
        "Mutation burden, context coverage, reconstruction error, and residual diagnostics.",
      report:
        "Structured report object or rendered output in the requested format.",
    },
    report: createAnalysisReport(
      {
        title: "mSigSDK Signature Fitting Report",
        summary:
          "Signature fitting QC summary with validation, mutation burden, residuals, and reconstruction error.",
        workflowRole: "signature_fit_analysis",
        scopeStatement: WORKFLOW_SCOPE_STATEMENTS.signatureFit,
        methodBasis,
        primaryInterpretationFields,
        parameters,
        validation,
        qc,
        exposures,
        provenance,
        citations: methodBasis.references,
        notes: [
          "Known-signature fitting results are conditional on the supplied catalog, context basis, exposure threshold, and assay territory.",
        ],
      },
      { format: reportFormat }
    ),
  };
}

/**
 * Runs NMF extraction and assembles validation, QC, optional reference comparison, and a report.
 *
 * @function createNMFAnalysis
 * @memberof workflows
 * @param {Object} [input] - Workflow inputs.
 * @param {Object<string,Object<string,number>>} input.spectra - Sample spectra matrix.
 * @param {Object<string,Object<string,number>>} [input.referenceSignatures=null] - Optional reference signatures for post hoc matching.
 * @param {Object} [input.nmfOptions={}] - Options for extractSignaturesNMF.
 * @param {Object} [input.parameters={}] - Analysis parameters to include in the report.
 * @param {string[]} [input.expectedContexts=null] - Expected mutation contexts.
 * @param {Object} [input.mutationBurdenOptions={}] - Options for summarizeMutationBurden.
 * @param {Object} [input.provenance=null] - Provenance record to include.
 * @param {string} [input.reportFormat="object"] - "object", "json", or "html".
 * @returns {Object} Validation, extraction, comparison, QC, and report objects.
 */
function createNMFAnalysis({
  spectra,
  referenceSignatures = null,
  nmfOptions = {},
  parameters = {},
  expectedContexts = null,
  mutationBurdenOptions = {},
  reconstructionOptions = {},
  validationOptions: callerValidationOptions = {},
  provenance = null,
  reportFormat = "object",
} = {}) {
  const validationOptions = {
    expectedContexts,
    ...(Number.isFinite(mutationBurdenOptions.lowBurdenThreshold)
        ? { minTotalMutations: mutationBurdenOptions.lowBurdenThreshold }
        : {}),
    ...callerValidationOptions,
  };
  const validation = {
    spectra: validateSpectra(spectra, validationOptions),
  };
  const extraction = extractSignaturesNMF(spectra, {
    contexts: expectedContexts,
    ...nmfOptions,
  });
  const comparison = referenceSignatures
    ? compareExtractedToReference(extraction, referenceSignatures, {
        contexts: expectedContexts || extraction.contexts,
      })
    : null;
  const qc = {
    mutationBurden: summarizeMutationBurden(spectra, {
      expectedContexts,
      ...mutationBurdenOptions,
    }),
    missingContexts: summarizeMissingContexts(spectra, { expectedContexts }),
    reconstructionError: calculateReconstructionError(
      extraction.signatures,
      spectra,
      extraction.exposures,
      {
        contexts: expectedContexts || extraction.contexts,
        ...reconstructionOptions,
      }
    ),
  };
  const methodBasis = {
    nmfExtraction: WORKFLOW_METHOD_BASIS.nmfExtraction,
    interpretationBoundary:
      "NMF profiles are extracted patterns from the supplied cohort. Reference matches are similarity summaries and do not establish etiology.",
    references: [
      WORKFLOW_LITERATURE_REFERENCES.alexandrov2020,
      WORKFLOW_LITERATURE_REFERENCES.degasperi2020,
      WORKFLOW_LITERATURE_REFERENCES.koh2021,
    ],
  };
  const primaryInterpretationFields = [
    "extraction.rank",
    "extraction.reconstructionError",
    "extraction.averageSampleCosineSimilarity",
    "comparison",
  ];
  const productionHandoffRecommendation =
    "Use SigProfilerExtractor or an equivalent production extraction workflow for manuscript-grade discovery, larger cohorts, or stability analysis across more random starts.";
  const recommendedActions = [
    "Review rank, reconstruction error, convergence, and reference matches before interpreting extracted profiles.",
    productionHandoffRecommendation,
  ];
  const publicationFigures = [
    {
      id: "nmf_profiles",
      title: "Extracted NMF signature profiles",
      recommendedRenderer: "mSigSDK.signatureExtractionPlots.plotNMFSignatureProfiles",
      dataFields: ["extraction.signatures"],
    },
    {
      id: "nmf_exposure_heatmap",
      title: "NMF exposure heatmap",
      recommendedRenderer: "mSigSDK.signatureExtractionPlots.plotNMFExposureHeatmap",
      dataFields: ["extraction.exposures"],
    },
  ];

  return {
    schemaVersion: WORKFLOW_RESULT_SCHEMA_VERSION,
    workflow: "nmf_extraction_analysis",
    workflowRole: "nmf_extraction_analysis",
    scopeStatement: WORKFLOW_SCOPE_STATEMENTS.nmfExtraction,
    methodBasis,
    primaryInterpretationFields,
    parameters: {
      ...parameters,
      nmfOptions,
    },
    validation,
    extraction,
    comparison,
    discovery: {
      rankSelection: null,
      extraction,
      comparison,
      productionHandoffRecommendation,
    },
    rankSelectionCriterion: nmfOptions.rankSelectionCriterion || "fixed_rank",
    rankSelectionRationale:
      "createNMFAnalysis runs extraction for the supplied rank settings; use selectNMFRank or pipelines.runDiscoveryWorkflow when rank-grid selection is required.",
    productionHandoffRecommendation,
    qc,
    warnings: [],
    recommendedActions,
    publicationFigures,
    provenance,
    outputs: {
      validation: "Input spectra checks for the requested context basis.",
      extraction:
        "Extracted signatures, exposures, reconstruction metrics, rank, convergence, and run metadata.",
      comparison:
        "Optional cosine-similarity matches between extracted and reference signatures.",
      qc: "Mutation burden, context coverage, and reconstruction diagnostics.",
      report:
        "Structured report object or rendered output in the requested format.",
    },
    report: createAnalysisReport(
      {
        title: "mSigSDK NMF Signature Extraction Report",
        summary:
          "NMF signature extraction summary with validation, mutation burden, reconstruction error, and optional reference comparison.",
        workflowRole: "nmf_extraction_analysis",
        scopeStatement: WORKFLOW_SCOPE_STATEMENTS.nmfExtraction,
        methodBasis,
        primaryInterpretationFields,
        parameters: {
          ...parameters,
          nmfOptions,
        },
        validation,
        qc,
        extraction: {
          rank: extraction.rank,
          reconstructionError: extraction.reconstructionError,
          averageSampleCosineSimilarity:
            extraction.averageSampleCosineSimilarity,
          iterations: extraction.iterations,
          converged: extraction.converged,
          bestRun: extraction.bestRun,
          comparison,
        },
        signatures: extraction.signatures,
        exposures: extraction.exposures,
        provenance,
        citations: methodBasis.references,
        notes: [
          "Extracted signatures are exploratory profiles and should be reviewed with rank stability, reference matching, and cohort composition before biological interpretation.",
        ],
      },
      { format: reportFormat }
    ),
  };
}

export {
  WORKFLOW_RESULT_SCHEMA_VERSION,
  createNMFAnalysis,
  createSignatureFitAnalysis,
};
