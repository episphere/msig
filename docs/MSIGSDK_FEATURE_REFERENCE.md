# mSigSDK documentation

## Scope

This document describes the public mSigSDK 0.3.0 browser API exposed by `main.js`. It covers every public namespace, recommended workflows, accepted inputs, configurable parameters, returned outputs, interpretation boundaries, warning semantics, and literature support.

mSigSDK is a browser-native workflow and software-integration SDK for mutational-signature analysis. It does not replace production extraction or assignment engines. Its analytical outputs are research-use review artifacts that are conditional on the supplied spectra, reference catalog, context basis, assay territory, and configured thresholds.

## Public namespaces

The top-level object returned by the SDK contains:

| Namespace | Purpose |
|---|---|
| `name` | SDK name string. |
| `version` | SDK version string. Current code reports `0.3.0`. |
| `quickstart` | Compact aliases for first-use workflow wrappers. The primary documented happy path is `workflows`. |
| `mSigPortal` | Public mSigPortal data access and mSigPortal-style plots. |
| `userData` | Local MAF conversion, WGS-to-panel filtering, and mSigPortal JSON formatting. |
| `tools` | Small generic utilities. |
| `machineLearning` | Regression preprocessing and k-fold regression validation helpers. |
| `signatureFitting` | Known-signature fitting and exposure plotting. |
| `TCGA` | GDC/TCGA retrieval and TCGA MAF conversion helpers. |
| `validation` | Matrix, context, exposure, and MAF validators. |
| `qc` | Mutation burden, context coverage, residuals, reconstruction error, NNLS, threshold sensitivity, and bootstrap uncertainty. |
| `qcPlots` | D3/Plotly renderers for QC and evidence outputs. |
| `signatureExtraction` | Browser-native NMF extraction, rank selection by reconstruction error, cophenetic correlation, or silhouette, reference matching, and worker execution. |
| `signatureExtractionPlots` | D3/Plotly renderers for NMF signatures, exposures, and rank diagnostics. |
| `io` | TSV, SigProfiler-style, COSMIC-style, MuSiCal-compatible, and long-form row import/export helpers. |
| `runners` | Optional browser execution runtimes, including Pyodide for Python packages and WebR for compatible R package builds. |
| `adapters` | External-tool adapters for SigProfilerAssignment, SigProfilerExtractor, SigProfilerMatrixGenerator, SigProfilerSimulator, SigProfilerClusters, sigProfilerPlotting, deconstructSigs, sigminer, and MuSiCal-compatible refit workflows. |
| `reports` | Structured, JSON, and standalone HTML report generation. |
| `advisor` | Validated manuscript advisor functions for analysis strategy, signature ambiguity, catalog sufficiency, and fit-quality evidence. |
| `pipelines` | Higher-level single-sample, cohort, discovery, and panel/WES workflows. |
| `workflows` | High-level report-assembly workflows plus aliases to validated pipeline functions. |
| `provenance` | SDK, runtime, catalog, genome, endpoint, parameter, and source metadata helpers. |
| `presentation` | DOM table, metric, note, details, and row-normalization helpers for notebooks and reports. |

## Beginner entry surface: `workflows`

New users should start with the small stable surface under `mSigSDK.workflows`. These functions accept the few options needed for routine use, fill conservative defaults for validation and QC, and return the same structured result frame used by the full pipeline functions.

| Feature | Primary use | Minimal inputs | Output |
|---|---|---|---|
| `workflows.analyzeMafFiles(mafFiles, signatures = null, options = {})` | Convert MAF-like rows into SBS96 spectra with optional known-signature fitting. | MAF rows or nested row arrays, optional signature catalog, `groupBy`, `genome`, `offline`, `contextLookupTable`, `expectedContexts`, and `reportFormat`. | MAF conversion metadata, spectra, provenance, validation/QC, and optional signature-fit analysis. |
| `workflows.runSingleSampleFit(input, options = {})` | Fit one sample against a supplied signature catalog. | `sampleName`, `spectrum`, `signatures`, optional `expectedContexts`, `exposureThreshold`, `bootstrapIterations`, and low-burden threshold. | Single-sample result with fit, fit-quality evidence, warnings, recommended actions, and report-ready figure descriptors. |
| `workflows.runCohortFit(input, options = {})` | Fit a spectra matrix with optional metadata. | `spectra`, `signatures`, optional `metadata`, `expectedContexts`, `groupKey`, and `comparisonKey`. | Cohort result with sample-level fit outputs, cohort guidance, fit-quality evidence, subgroup review, and QC summaries. |
| `workflows.runPanelWorkflow(input, options = {})` | Review panel/WES spectra with optional callable-opportunity metadata. | `spectra`, `signatures`, optional `callableOpportunities`, `referenceOpportunities`, `genomeBuild`, and evidence thresholds. | Panel result with normalized spectra metadata, evidence tiers, panel limitations, QC, warnings, and recommended actions. |

Namespace boundaries:

- `workflows` is the documented first-use surface and report-oriented workflow namespace.
- `pipelines` exposes full computational controls and structured analysis objects.
- `quickstart` remains available as compact aliases for applications that prefer an explicit beginner namespace.

## Shared data structures

### Spectra

Sample spectra are nested objects keyed by sample and mutation context:

```js
{
  sample_1: { "A[C>A]A": 12, "A[C>A]C": 4 },
  sample_2: { "A[C>A]A": 8, "A[C>A]C": 0 }
}
```

### Signatures

Reference or extracted signatures are nested objects keyed by signature name and mutation context:

```js
{
  SBS1: { "A[C>A]A": 0.001, "A[C>A]C": 0.002 },
  SBS5: { "A[C>A]A": 0.010, "A[C>A]C": 0.006 }
}
```

### Exposures

Fitted or extracted exposures are nested objects keyed by sample and signature:

```js
{
  sample_1: { SBS1: 0.35, SBS5: 0.65 },
  sample_2: { SBS1: 0.00, SBS5: 1.00 }
}
```

### Method-basis fields

Newer QC, advisory, pipeline, and report outputs use `methodBasis` objects. These usually contain a plain-language method description, configurable defaults, references with DOI or URL fields, validation anchors when applicable, and interpretation boundaries. Downstream reports automatically collect citations from nested `methodBasis.references` fields.

### Shared workflow result frame

Stable workflow and pipeline functions return a predictable top-level frame so application code can inspect common fields before entering workflow-specific subtrees:

- `schemaVersion`.
- `workflow`.
- `workflowRole`.
- `scopeStatement`.
- `methodBasis`.
- `primaryInterpretationFields`.
- `parameters`.
- `validation`.
- `qc`.
- `fit`, `extraction`, or `panel` when the workflow performs fitting, discovery, or restricted-assay review.
- `fitQualityEvidence` when known-signature fitting is performed.
- `warnings`.
- `recommendedActions`.
- `publicationFigures`.
- `provenance`.

Workflow-specific details are nested by domain. Panel/WES review uses `panel`. Discovery workflows use `discovery` with `rankSelection`, `extraction`, `comparison`, and `productionHandoffRecommendation`.

### Configurable defaults

The SDK exposes default parameter maps so callers can inspect, copy, and override operating points without modifying source code:

- `mSigSDK.qc.QC_DEFAULTS`: default settings for mutation-burden QC, sample selection, exposure normalization, residual review, NNLS fitting, threshold sensitivity, and bootstrap uncertainty.
- `mSigSDK.advisor.ADVISOR_DEFAULTS`: default settings for analysis strategy advice, ambiguity screening, catalog sufficiency, fit-quality evidence, group comparison, single-sample and cohort pipelines, discovery workflows, panel/WES evidence, and restricted-assay evidence.

Defaults are review settings, not immutable biological rules. Direct QC/advisor functions accept their documented options flatly. Pipeline functions accept both flat options for backward compatibility and nested option groups for subsystem-specific control. Advisory functions used in the manuscript validation set are `recommendAnalysisStrategy`, `computeSignatureAmbiguity`, `detectOutOfReferenceSignal`, and `computeFitQualityEvidence`.

Common nested groups are:

```js
await mSigSDK.pipelines.runSingleSampleFit(input, {
  mutationBurden: { lowBurdenThreshold: 75, moderateBurdenThreshold: 800 },
  fit: { exposureThreshold: 0.02, maxIterations: 5000 },
  residuals: { weakUnexplainedThreshold: 0.05 },
  thresholdSensitivity: { thresholds: [0, 0.01, 0.02, 0.05] },
  bootstrap: { iterations: 1000, seed: 42 },
  ambiguity: { pairReportThreshold: 0.88 },
  catalogCheck: { minBurdenForReliableDetection: 150 }
});
```

The resolved values are reported in `parameters`, `thresholds`, or `methodBasis.configurableDefaults` fields where applicable.

## Warning code taxonomy

### QC warning codes

`mSigSDK.qc.QC_WARNING_CODES` contains:

| Code | Trigger | Resolution |
|---|---|---|
| `CONTEXT_MISMATCH` | A spectrum is missing expected context keys or contains extra context keys. | Regenerate spectra with the expected context basis before fitting. |
| `CONTEXT_FETCH_FAILED` | MAF conversion count checks indicate context lookup or input normalization may be incomplete. | Pin the genome build, inspect failed variants, and rerun conversion or supply precomputed contexts. |
| `EMPTY_SPECTRUM` | A sample has zero observed mutations in the selected context basis. | Exclude from fitting or verify grouping and context generation. |
| `HIGH_RESIDUAL_STRUCTURE` | Residual review finds configured residual structure. | Inspect residual spectra and consider catalog expansion or de novo extraction in an adequately powered cohort. |
| `LOW_BURDEN` | A sample falls below the configured low-burden threshold. | Interpret exposures cautiously and consult strategy, threshold sensitivity, and bootstrap outputs. |
| `LOW_BOOTSTRAP_ITERATIONS` | Bootstrap iterations are below the configured stable-interval threshold. | Increase iterations; use at least 500 for review and 1000 for publication-grade intervals. |
| `THRESHOLD_GRID_TOO_SMALL` | Fewer than three exposure thresholds were supplied to threshold sensitivity. | Use at least three thresholds spanning the intended cutoff range. |
| `THRESHOLD_DEPENDENT_FIT` | Exposure drift or active-set instability crosses configured review settings. | Run bootstrap if needed and report threshold-dependent calls with caveats. |

### Advisory warning codes

`mSigSDK.advisor.WARNING_CODES` contains:

| Code | Meaning |
|---|---|
| `CATALOG_INCOMPLETE_SUSPECTED` | Residual/reconstruction criteria raised a catalog review cue; inspect before assuming the supplied catalog is adequate. |
| `EXTRACTION_NOT_RECOMMENDED` | Configured burden, sample count, or heterogeneity gates do not provide enough review support for de novo extraction. |
| `FIT_UNSTABLE` | Bootstrap or fit-evidence criteria indicate that exposure interpretation needs uncertainty context. |
| `FLAT_SIGNATURE_RISK` | A fitted signature has broad/flat catalog evidence that can increase exchangeability with related signatures. |
| `HETEROGENEOUS_COHORT` | Cohort structure raises a subgroup-review cue before pooled interpretation. |
| `HIGH_RESIDUAL_STRUCTURE` | Residual structure warrants catalog-sufficiency review. |
| `INCOMPLETE_CONTEXTS` | Input spectra are incomplete relative to the expected context basis. |
| `INSUFFICIENT_SIGNAL` | Mutation burden or information content is too low for routine interpretation. |
| `LOW_BURDEN` | Mutation burden is below the configured analysis threshold. |
| `GROUP_IMBALANCE` | Metadata groups are too small for routine group comparison interpretation. |
| `METADATA_MISSING` | Group-comparison metadata are missing or unusable. |
| `PANEL_LIMITED` | Restricted assay information is insufficient for unrestricted interpretation. |
| `PANEL_SIGNATURE_NOT_ASSESSABLE` | A signature/sample combination is not assessable under the supplied panel/WES evidence. |
| `SIGNATURE_AMBIGUITY` | Active fitted signatures met catalog-relative identifiability review criteria, such as similar neighbors, broad/flat profiles, or crowded catalog regions. |
| `THRESHOLD_DEPENDENT` | Fitted interpretation depends on exposure-threshold settings. |

## Advisor validation scope

The validated manuscript advisor surface consists of:

- `recommendAnalysisStrategy`.
- `computeSignatureAmbiguity`.
- `computeSignatureIdentifiability` (terminology-forward alias of `computeSignatureAmbiguity`).
- `detectOutOfReferenceSignal`.
- `computeFitQualityEvidence`.

Group-comparison and restricted-assay evidence blocks are returned by the cohort and panel workflows as part of their structured outputs.

## Public data access: `mSigPortal.mSigPortalData`

These functions call the public NCI mSigPortal mutational-signatures API and return JSON responses. They use the SDK fetch/cache utility when browser caches are available.

| Feature | Inputs and parameters | Output | Notes |
|---|---|---|---|
| `getMutationalSignaturesOptions(genomeDataType = "WGS", mutationType = "SBS")` | Sequencing strategy and mutation profile family. | API JSON describing available reference signature options. | Used before selecting a catalog. |
| `getMutationalSignaturesData(genomeDataType = "WGS", signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96", mutationType = "SBS", matrix = 96, numberofResults = 10)` | Strategy, catalog name, mutation type, matrix size, result limit. | Raw reference-signature rows from the API. | Usually converted with `validation.rowsToSignatureMatrix` or `mSigPortalData.extractMutationalSpectra`. |
| `getMutationalSignaturesSummary(numberofResults = 10, signatureSetName = "COSMIC_v3.3_Signatures")` | Result limit and signature set. | Summary JSON for the requested catalog. | Reports catalog-level metadata from the API. |
| `getMutationalSpectrumOptions(study = "PCAWG", genomeDataType = "WGS", cancerType = "Lung-AdenoCA", numberOfResults = 10)` | Study, strategy, cancer type, result limit. | Available spectrum options. | Used to discover public spectra. |
| `getMutationalSpectrumData(study = "PCAWG", samples = null, genomeDataType = "WGS", cancerType = "Lung-AdenoCA", mutationType = "SBS", matrixSize = 96)` | Study, optional sample list, strategy, cancer type, mutation profile, matrix size. | Public mutational spectrum rows. | If `samples` is null, fetches cohort-level rows for the requested filters; otherwise fetches each sample. |
| `getMutationalSpectrumSummary(study = "PCAWG", genomeDataType = "WGS", cancerType = "Lung-AdenoCA", numberOfResults = 10)` | Study, strategy, cancer type, limit. | Spectrum summary JSON. | Cohort-level public data summary. |
| `getMutationalSignatureAssociationOptions(study = "PCAWG", genomeDataType = "WGS", numberOfResults = 10)` | Study, strategy, limit. | Association-option JSON. | Used before association retrieval. |
| `getMutationalSignatureAssociationData(study = "PCAWG", genomeDataType = "WGS", cancerType = "Biliary-AdenoCA", numberOfResults = 10)` | Study, strategy, cancer type, limit. | Association data JSON. | Supplies rows used by association plotting. |
| `getMutationalSignatureActivityOptions(study = "PCAWG", genomeDataType = "WGS", numberOfResults = 10)` | Study, strategy, limit. | Signature-activity option rows. | Used before activity retrieval. |
| `getMutationalSignatureActivityData(study = "PCAWG", genomeDataType = "WGS", signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96", cancerType = "", numberOfResults = 10)` | Study, strategy, signature set, optional cancer type, limit. | Signature activity rows. | Returns fitted public exposure/activity data from the API. |
| `getMutationalSignatureLandscapeData(study = "PCAWG", genomeDataType = "WGS", cancerType = "", signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96", numberOfResults = 10)` | Study, strategy, optional cancer type, signature set, limit. | Landscape-style signature activity rows. | Calls the activity endpoint and returns rows for broad landscape views. |
| `getMutationalSignatureEtiologyOptions(category = "CancerSpecificSignatures_2022", etiology = "", signatureName = "", cancerType = "", numberOfResults = 10)` | Etiology category, etiology label, signature, cancer type, limit. | Etiology option JSON. | Filters are included only when non-empty. |
| `getMutationalSignatureEtiologyData(study = "PCAWG", genomeDataType = "WGS", signatureName = "SBS3", cancerType = "", numberOfResults = 10)` | Study, strategy, signature name, optional cancer type, limit. | Etiology data JSON. | Public annotation data; not a causal assignment from local spectra. |
| `extractMutationalSpectra(data, groupKey)` | API rows or nested rows; grouping key such as `sample` or `signatureName`. | Nested matrix object keyed by the selected group and mutation type. | Converts long-form public rows into the shared SDK matrix structure. |

## Public visualizations: `mSigPortal.mSigPortalPlots`

All mSigPortal plot functions require a browser DOM. Plotly plots include compact PNG, SVG, and JSON controls. Public plot helpers render standalone figure context by default and accept optional `figureContext` or `publication` metadata when the caller needs to specify dataset, sample, profile, matrix, catalog, or method settings that cannot be inferred from the input object.

| Feature | Inputs | What it renders or returns |
|---|---|---|
| `plotProfilerSummary` | Public profiler summary data and a container. | Summary visualization for a public mutational spectrum dataset. |
| `plotPatientMutationalSpectrum` | SBS/DBS/ID-style profile rows or spectra and a container. | Mutational profile bars by context, with support for several context families through the imported profile renderers. |
| `plotForceDirectedTree` | Sample spectra, labels, and `divID`. | AMCharts force-directed tree from hierarchical clustering over cosine-distance spectra; returns formatted cluster hierarchy. |
| `plotCosineSimilarityHeatMap` | Sample spectra, labels, clustering flag, color scale, optional table flag. | Plotly sample-by-sample cosine-similarity heatmap; optionally double-clustered and optionally accompanied by a numeric table. |
| `plotUMAPVisualization` | Sample spectra, dataset label, container, `nComponents = 3`, `minDist = 0.1`, `nNeighbors = 15`. | 2D or 3D UMAP embedding of spectra; returns Plotly trace objects. |
| `plotProjectMutationalBurdenByCancerType` | Public project data and container. | Boxplot-style mutation burden by cancer type. |
| `plotSignatureActivityDataBy` | Signature activity rows, container, grouping key default `"signatureName"`. | Boxplots of log10 exposure grouped by the selected metadata field, including non-zero exposure counts in hover text. |
| `plotSignatureAssociations` | Association rows, container, two signature names. | Association scatter or summary for selected signatures. |
| `plotMSPrevalenceData` | Prevalence rows and container. | Mutational-signature prevalence visualization. |

## Local data conversion: `userData`

| Feature | Inputs and parameters | Output | Method and caveats |
|---|---|---|---|
| `convertMatrix(MAFfiles, groupBy = "project_code", batch_size = 100, genome = "hg19", tcga = false, options = {})` | MAF-like rows or nested row arrays, grouping field, batch size, genome build, TCGA field mapping flag, and context options. `options.offline = true` uses row-supplied contexts, a supplied `contextLookupTable`, or bundled sparse smoke-test lookup assets for hg19, hg38, or T2T-CHM13. | Sample-by-SBS96 spectra. | Live mode retrieves trinucleotide context through the UCSC Genome Browser sequence endpoint. Offline mode requires a matching position-indexed lookup table for production-scale conversion. High-level workflows record genome build, lookup mode, endpoint when used, timestamp, offline-table status, and count-reconciliation checks. |
| `convertWGStoPanel(WgMAFs, panelDf)` | WGS MAF arrays and panel interval table or CSV path. | Downsampled MAF arrays containing mutations inside panel intervals. | Filters by chromosome and genomic start/end inclusion. |
| `createWGStoPanelValidationPairs(wgsSpectra, callableOpportunityMasks, options)` | WGS spectra, callable SBS96 opportunity masks, and optional burden/scaling settings. | Matched WGS and panel spectra pairs with mask and burden metadata. | Designed for controlled panel-tier validation against WGS-derived truth. |
| `plotCosmicSbs96Profile(divID, spectra, options = {})` | One SBS96 record or a sample-keyed spectra object plus optional sample, context order, normalization, highlighted contexts, title, subtitle, and figure-context metadata. | COSMIC-style SBS96 bar profile grouped by base-substitution class, with mutation-count or relative-fraction scaling. | Also exposed under `qcPlots` for report and notebook use. |
| `plotPatientMutationalSpectrumuserData(mutationalSpectra, divID, project, profile, matrix)` | Local mutational spectra and plot settings. | Mutational profile plot for local user spectra. | Browser plotting helper around the profile renderers. |
| `convertMutationalSpectraIntoJSON(MAFfiles, mutSpec, sample_name, dataType = "WGS")` | MAF arrays, spectra object, sample-name field, strategy label. | mSigPortal-style nested JSON rows with `sample`, `strategy`, `profile`, `matrix`, `mutationType`, and `mutations`. | Throws if the MAF array count does not match the number of spectra. |

## TCGA/GDC retrieval: `TCGA`

| Feature | Inputs | Output |
|---|---|---|
| `getProjectsByGene(genes)` | Ensembl gene identifiers. | `{ projects, projects_by_gene }` from GDC top-case count queries. |
| `getTpmCountsByGenesOnProjects(genes, projects)` | Ensembl gene identifiers and TCGA project IDs. | File IDs and file metadata for RNA-seq gene-expression quantification files. |
| `getTpmCountsByGenesFromFiles(genes, files)` | Ensembl gene identifiers and GDC file IDs. | Per-gene FPKM and TPM counts by file. |
| `getMafInformationFromProjects(projects)` | TCGA project IDs. | MAF file IDs and demographic/sample metadata from GDC. |
| `getVariantInformationFromMafFiles(res)` | Output from `getMafInformationFromProjects`. | Variant rows and per-project spectra generated through `convertMatrix`. |
| `convertTCGAProjectIntoJSON(MAFfiles, mutSpec, dataType = "WGS")` | TCGA MAF files and spectra. | mSigPortal-style spectrum JSON rows. |

## Utility and machine-learning helpers

| Namespace | Feature | Inputs | Output |
|---|---|---|---|
| `tools` | `groupBy(array, key)` | Array of objects and a key name. | Object keyed by each observed key value. |
| `machineLearning` | `preprocessData(mutationalData, exposureData, dataSource)` | Mutational rows, exposure rows, and data source. | For `MSIGPORTAL`, returns `{ Xs, Ys }` arrays aligned by sample; `ICGC` currently returns null. |
| `machineLearning` | `kFoldCV(Xs, Ys, k = 10, modelType = "MLR")` | Feature matrix, response matrix, fold count, model type. | `{ model, MSE, averageMSE }`. `MLR` uses multivariate linear regression. `MLP` is referenced in code but depends on an MLP implementation that is not imported in the current module. |

## Validation: `validation`

| Feature | Inputs and parameter choices | Output |
|---|---|---|
| `getSBS96Contexts()` | None. | Ordered 96 pyrimidine-centered SBS context labels. |
| `getExpectedContexts({ profile = "SBS", matrix = 96 })` | Supported choice is `profile = "SBS"` and `matrix = 96`; unsupported combinations return null. | Ordered context labels or null. |
| `getMatrixContexts(...matrices)` | One or more nested matrices. | First-seen column/context labels, excluding `rnorm`. |
| `normalizeMatrixObject(matrix, { ignoredKeys = ["rnorm"] })` | Nested matrix and ignored column names. | Numeric nested matrix; non-numeric values become zero. |
| `rowsToMatrix(rows, { rowKey = "sample", contextKey = "mutationType", valueKey = "mutations" })` | Long-form rows and field mapping. | Nested matrix keyed by `rowKey` and `contextKey`. |
| `rowsToSampleSpectra(rows, options)` | Long-form rows; optional `sampleKey`, `contextKey`, `valueKey`. | Sample-by-context spectra. |
| `rowsToSignatureMatrix(rows, options)` | Long-form rows; optional `signatureKey`, `contextKey`, `valueKey`. | Signature-by-context matrix. |
| `validateSpectra(spectra, { expectedContexts = null, minTotalMutations = 0, strict = false })` | Sample spectra and optional context/burden gates. | `{ valid, issues, warnings, samples, contexts }`. Sample metrics include total mutations, non-zero contexts, zero contexts, and warning labels such as `empty_spectrum` and `low_mutation_burden`. |
| `validateSignatureMatrix(signatures, { expectedContexts = null, strict = false })` | Signature matrix and optional context gate. | `{ valid, issues, warnings, signatures, contexts }`. |
| `validateExposureMatrix(exposures, { strict = false })` | Sample-by-signature exposure matrix. | `{ valid, issues, warnings, samples, signatures }`, including `zero_total_exposure` warnings. |
| `validateMafRows(rows, { requiredFields = [...] })` | MAF-like rows and required field names. | `{ valid, issues, rowCount, requiredFields }`. Default required fields are `chromosome`, `start_position`, `reference_allele`, `tumor_seq_allele2`, and `variant_type`. |
| `assertValid(validationResult, label = "Validation")` | Validator output and label. | Returns the input result when valid; throws an error with issue messages when invalid. |

## Known-signature fitting: `signatureFitting`

| Feature | Inputs and parameters | Output | Method and interpretation |
|---|---|---|---|
| `fitMutationalSpectraToSignatures(signatures, spectra, options)` | Reference signatures, sample spectra, and options including `exposureThreshold = 0`, `exposureType = "relative"`, and `renormalize = true`. | Sample-by-signature exposures. | Plain NNLS-based refitting under the supplied catalog. Exposures are numerical fits, not confidence calls. |
| `plotPatientMutationalSignaturesExposure(exposureData, divID, ...)` | Exposure data for one sample and plot settings. | Pie chart of signature exposure for one sample. | Visualization only. |
| `plotDatasetMutationalSignaturesExposure(exposureData, divID, ...)` | Exposure data for a dataset and plot settings. | Dataset-level signature exposure visualization. | Visualization only. |

## QC and uncertainty: `qc`

### `summarizeMutationBurden(spectra, options)`

Inputs:

- `spectra`: sample-by-context matrix.
- `lowBurdenThreshold = 50`.
- `lowBurdenThresholdMode = "fixed"`.
- `thresholdMode`: alias for `lowBurdenThresholdMode`.
- `quantile = 0.25`: used when threshold mode is `quantile`.
- `expectedContexts = null`.
- `moderateBurdenThreshold = 1000`.

Parameter choices:

- Threshold mode `fixed`: use `lowBurdenThreshold`.
- Threshold mode `quantile`: compute the threshold from non-empty sample burdens.
- Threshold mode `none`: disable low-burden flagging.

Outputs:

- `schemaVersion = "msig.qc.v0.3"`.
- `workflowRole = "mutation_burden_qc"`.
- `scopeStatement`: burden review cues are configurable QC prompts, not biological classifications.
- `methodBasis`: threshold basis, threshold rationale, validation anchors, configurable defaults, and references.
- `thresholdRationale`: default 50-mutation review cue anchored to the SDK synthetic validation table, where 50 mutations had mean exposure cosine 0.912 and mean reconstruction cosine 0.884, while 100 mutations improved to 0.952 and 0.930.
- `validationAnchor`: burden 50 and burden 100 synthetic validation rows.
- `contexts`.
- `samples[]`: `sample`, `totalMutations`, `contexts`, `nonZeroContexts`, `zeroContexts`, `maxContext`, `maxContextCount`, `meanContextCount`, `burdenClass`, `burdenInterpretation`, `flags.emptySpectrum`, `flags.lowBurden`, and `recommendedAction`.
- `overall`: sample count, total mutations, low-burden sample count, empty-sample count, threshold, threshold mode, and quantile.
- `warnings`: `EMPTY_SPECTRUM` or `LOW_BURDEN` warning objects when triggered.

### `selectSamplesByMutationBurden(burdenSummary, options)`

Inputs:

- `burdenSummary`: output from `summarizeMutationBurden`.
- `limit = 10`.
- `minTotalMutations = 0`.
- `maxTotalMutations = Infinity`.
- `sampleNames = null`.
- `order = "desc"` or `"asc"`.
- `includeEmpty = false`.

Output:

- Array of selected sample-level burden records, sorted by burden and then sample name.

### `summarizeMissingContexts(spectra, { expectedContexts = null })`

Outputs:

- `schemaVersion`.
- `workflowRole = "context_coverage_qc"`.
- `scopeStatement`: structural context completeness check for matrix compatibility.
- `methodBasis`: expected context basis, zero-count boundary, configurable defaults, and Alexandrov 2020 reference.
- `contexts`.
- `samples[]`: `sample`, `expectedContextCount`, `observedContextCount`, `structurallyMissingContexts`, `structurallyMissingCount`, `unobservedContexts`, `unobservedCount`, `missingContexts`, `missingCount`, `extraContexts`, `extraCount`, and `percentComplete`.
- `complete`: true only when all samples have no structural missing or extra contexts.
- `warnings`: `CONTEXT_MISMATCH` warning objects.

Interpretation boundary:

- Structurally missing contexts are absent keys and indicate matrix-format problems.
- Unobserved contexts are present keys with zero counts and are expected in low-burden SBS96 spectra.

### `normalizeExposures(exposures, options)`

Inputs:

- `zeroPolicy = "keep"`, `"pseudocount"`, or `"drop"`.
- `pseudocount = 1e-6`.
- `relative = true`.
- `dropBelow = 0`.

Output:

- Normalized sample-by-signature exposure matrix.

### `calculateFitResiduals(signatures, spectra, exposures, options)`

Inputs:

- Reference signatures, spectra, and exposures.
- `contexts = null`.
- `normalizeMode = "auto"`, `"relative"`, or `"absolute"`.
- `lowBurdenThreshold = 100`.
- `moderateBurdenThreshold = 1000`.
- `weakUnexplainedThreshold = 0.07`.
- `highResidualStructureCosineThreshold = 0.85`.

Outputs:

- `schemaVersion`.
- `workflowRole = "fit_residual_qc"`.
- `scopeStatement`: residuals are diagnostic differences and do not identify missing or causal signatures by themselves.
- `methodBasis`: reconstruction/residual basis, normalization mode, residual-structure trigger description, configurable defaults, and references.
- `contexts`.
- `samples[]`: observed spectrum, reconstructed spectrum, residual spectrum, `metrics`, `burdenClass`, normalization mode, unexplained fraction fields, and sample warnings.
- `warnings`: sample warnings such as `HIGH_RESIDUAL_STRUCTURE`.

Metric suite:

- Cosine similarity, L1 error, L2 error, RMSE, mean absolute error, residual sum, total observed, total reconstructed, max absolute residual, positive residual fraction, negative residual fraction, and relative unexplained fraction.

Interpretation boundary:

- High unexplained fraction can reflect missing catalog signal, sampling noise, normalization artifacts, or restricted-assay artifacts. The function reports burden class so residuals can be read in context.

### `calculateReconstructionError(signatures, spectra, exposures, options)`

Inputs:

- Signatures, spectra, exposures.
- `contexts = null`.
- `normalizeMode = "auto"`, `"relative"`, or `"absolute"`.

Outputs:

- `schemaVersion`.
- `workflowRole = "reconstruction_error_qc"`.
- `scopeStatement`: high cosine does not guarantee correct exposure attribution.
- `methodBasis`.
- `contexts`.
- `samples[]`: `sample`, `cosineSimilarity`, `cosineDistance`, `rmse`, `meanAbsoluteError`, `l1Error`, `l2Error`, `totalObserved`, `totalReconstructed`, and normalization mode.
- `summary`.

### `fitSpectraWithNNLS(signatures, spectra, options)`

Inputs:

- Signatures and spectra.
- `contexts = null`.
- `exposureThreshold = 0`.
- `exposureType = "relative"` or an absolute scale.
- `renormalize = true`.
- `maxIterations = null`: null uses the adaptive default `max(100, signatureCount * 100)`.
- `convergenceTolerance = 1e-10`.
- `returnDetails = false`.

Outputs:

- Default output: sample-by-signature exposure matrix.
- With `returnDetails = true`: object containing `schemaVersion`, `workflowRole`, `scopeStatement`, `methodBasis`, `solverVariant = "coordinate_descent_nnls"`, solver caveats, contexts, signatures, and exposures.

### `runThresholdSensitivity(signatures, spectra, options)`

Inputs:

- `thresholds = [0, 0.01, 0.03, 0.05, 0.1]`.
- `baselineThreshold = null`; defaults to the first threshold run when null.
- `instabilityL1Threshold = null`.
- `activeSetJaccardThreshold = null`.
- `exposureType = "relative"`.
- `renormalize = true`.
- `contexts = null`.
- `maxIterations = null`: null uses the adaptive NNLS iteration default.
- `convergenceTolerance = 1e-10`.

Outputs:

- `schemaVersion`.
- `workflowRole = "threshold_sensitivity"`.
- `scopeStatement`.
- `methodBasis`: drift metrics, drift units, threshold rationale, instability-threshold rationale, configurable defaults, and references.
- `parameters`.
- `thresholds`.
- `baselineThreshold`.
- `driftUnits`: `relative_exposure_l1_units` or `absolute_exposure_l1_units`.
- `thresholdRationale`.
- `runs[]`: threshold, exposures, reconstruction error, average active signatures, average cosine similarity, average RMSE, and `driftFromBaseline` with mean L1 exposure drift, median L1 exposure drift, and mean active-set Jaccard.
- `summary`: threshold count, max mean L1 drift, min mean active-set Jaccard, active-signature range, and average metric ranges.
- `warnings`: `THRESHOLD_GRID_TOO_SMALL` and/or `THRESHOLD_DEPENDENT_FIT`.
- `recommendedActions`.

Interpretation boundary:

- Threshold sensitivity reports drift across user-specified thresholds. It does not select a universal exposure cutoff.

### `bootstrapSignatureFit(signatures, spectrum, options)`

Inputs:

- Reference signatures and one sample spectrum.
- `iterations = 200`.
- `confidenceLevel = 0.95`.
- `exposureThreshold = 0`.
- `exposureType = "relative"`.
- `renormalize = true`.
- `seed = 123`.
- `contexts = null`.
- `minIterationsForStableIntervals = 500`.
- `publicationRecommendedIterations = 1000`.
- `minMutationsForBootstrapSummary = 50`.
- `maxIterations = null`: null uses the adaptive NNLS iteration default.
- `convergenceTolerance = 1e-10`.

Outputs:

- `schemaVersion`.
- `workflowRole = "bootstrap_exposure_uncertainty"`.
- `scopeStatement`: parametric multinomial bootstrap uncertainty conditional on observed spectrum, catalog, and fitting settings.
- `methodBasis`: `bootstrapMethod = "parametric_multinomial"`, interval definition, uncertainty boundary, selection-frequency definition, method rationale, configurable defaults, and references.
- `bootstrapMethod = "parametric_multinomial"`.
- `parameters`.
- `inputSummary`: total mutations and context count.
- `iterations`, `confidenceLevel`, `seed`, `contexts`.
- `signatures[]`: `signatureName`, mean, median, lower, upper, `ciLower`, `ciUpper`, `ciWidth`, `interval`, `selectionFrequency`, and `selectionFrequencyDefinition`.
- `exposureSamples[]`: bootstrap exposure draws after thresholding and renormalization.
- `reconstructionError[]`: reconstruction metrics for each bootstrap refit.
- `warnings`: `LOW_BOOTSTRAP_ITERATIONS` and/or `LOW_BURDEN`.
- `reportingMode`: `report_with_caveats` when warnings are present, otherwise `standard_qc_passed`.

## QC plots: `qcPlots`

QC plot helpers render a publication footer with the figure caption and context fields. Each helper accepts optional `figureContext` or `publication` metadata; notebook and report integrations should pass the active data source, selected sample or cohort scope, profile/matrix, signature catalog, and method settings.

| Feature | Input | Output semantics |
|---|---|---|
| `plotMutationBurdenSummary(divID, burdenSummary)` | Output from `summarizeMutationBurden`. | Horizontal bar chart of total mutations by sample, low-burden threshold marker, low/empty status colors, and badges for threshold, low-burden review cues, and empty spectra. Returns `{ data, threshold }`. |
| `plotReconstructionError(divID, reconstructionError, { cosineReferenceLines = [] })` | Output from `calculateReconstructionError`. | Paired sample-level view of cosine similarity and RMSE, sorted by cosine. Returns rendered rows and reference-line metadata. |
| `plotFitQualityEvidenceDashboard(divID, fitQualityEvidenceResult)` | Output from `advisor.computeFitQualityEvidence`. | Sample-level dashboard with reporting mode, review-cue count, and evidence components for burden, reconstruction, residual, bootstrap, threshold, ambiguity, and catalog. Returns `{ data, components }`. |
| `plotCohortGroupComparison(divID, comparisonResult)` | `groupComparison` block returned by `runCohortFit`. | Bar chart of comparison-group minus reference-group mean exposure differences for top signals, with effect size, p value, and q value in tooltips. |
| `plotPanelEvidenceMatrix(divID, panelResultOrEvidenceCalls)` | Output from `pipelines.runPanelWorkflow` or an `evidenceCalls` object. | Sample-by-signature matrix colored by panel/WES tier: higher review tier, limited review tier, below review threshold, or not assessable. |
| `plotCosmicSbs96Profile(divID, spectra, options)` | One SBS96 record or sample-keyed spectra object. | COSMIC-style SBS96 profile with substitution-class grouping, optional normalization, highlighted contexts, and standalone figure context. |
| `plotFitResiduals(divID, residualResult, sampleName = null)` | Output from `calculateFitResiduals`. | SBS96 observed-versus-reconstructed profile comparison for a selected sample. |
| `plotBootstrapExposureSummary(divID, bootstrapResult, options)` | Output from `bootstrapSignatureFit`. | Compact reporting view of mean exposure, confidence interval, and selection frequency for the top fitted signatures. |
| `plotBootstrapConfidenceIntervals(divID, bootstrapResult)` | Output from `bootstrapSignatureFit`. | Per-signature bootstrap exposure distributions, confidence intervals, means, and selection frequencies. |
| `plotThresholdSensitivity(divID, thresholdResult)` / `plotThresholdSensitivitySummary(divID, thresholdResult)` | Output from `runThresholdSensitivity`. | Cutoff-sensitivity summary with one row per contribution cutoff, reporting mean active-signature count, reconstruction cosine, RMSE, cutoff grid, and standalone figure context. |

## Advisory and interpretation support: `advisor`

### `recommendAnalysisStrategy(spectra, options)`

Validation status: validated core advisor function for the manuscript.

Inputs:

- Sample spectra.
- `assay = "WGS"` or restricted assay labels such as `"panel"`.
- `expectedContexts = null`.
- `lowBurdenThreshold`: defaults to 100 for WGS-like analyses and 30 for `assay = "panel"`.
- `moderateBurdenThreshold`: defaults to 1000 for WGS-like analyses and 150 for `assay = "panel"`.
- `highBurdenThreshold = 3000`.
- `minSamplesForExtraction = 8`.
- `minSamplesForCohortRecommendation` guards cohort-level advice.
- `minHighInformationFraction = 0.5`.
- `heterogeneityCosineThreshold = 0.85`.
- Options may be supplied flatly or under `analysisStrategy`.

Outputs:

- `schemaVersion`.
- `workflowRole = "analysis_strategy_advisor"`.
- `scopeStatement`: research-use advisory summary, not a clinical classification.
- `methodBasis`: burden, heterogeneity, context completeness, threshold defaults, references, and configurability notes.
- `thresholds`.
- `mutationBurden`: output from `summarizeMutationBurden`.
- `contextCoverage`: output from `summarizeMissingContexts`.
- `cohort`: sample count, median burden, burden class distribution, median pairwise cosine, heterogeneity status, extraction readiness, primary recommendation, and caveats.
- `warnings`.
- `caveats`.
- `recommendedActions`.

Primary recommendations:

- Known-signature refitting is favored for small, low-burden, or insufficiently heterogeneous cohorts.
- De novo extraction is suggested only when sample count, mutation burden, and cohort structure support exploratory extraction.
- Panel and WES settings are treated as restricted review contexts rather than full WGS-equivalent signature decompositions.

### `computeSignatureAmbiguity(signatures, options)` / `computeSignatureIdentifiability(signatures, options)`

Validation status: validated core advisor function for the manuscript.

Inputs:

- Signature matrix.
- `contexts = null`.
- `pairReportThreshold = 0.9`: pairwise cosine threshold for reporting confounding pairs. This is a reporting aid, not the primary class boundary.
- `topNeighborCount = 5`.
- `reviewPercentile = 0.75`.
- `strongReviewPercentile = 0.9`.
- `nearBoundaryWidth = 0.03`.
- Neighbor/flatness evidence settings: `moderateNearestCosine`, `highNearestCosine`, `moderateEntropy`, `highEntropy`, and `flatSignatureWarningEntropy`.
- `catalogVersion` or `signatureSetName` for provenance.
- Options may be supplied flatly or under `ambiguity` or `signatureAmbiguity`.

Outputs:

- `schemaVersion`.
- `workflowRole = "signature_ambiguity"`.
- `scopeStatement`.
- `methodBasis`: selected-catalog identifiability scoring, pairwise cosine reporting, entropy/flatness, confounding-neighbor logic, references, catalog provenance fields where supplied.
- `contexts`.
- `catalogVersion` when supplied.
- `signatures[]`: signature name, nearest neighbor, nearest cosine similarity, top neighbors, flatness score, entropy, continuous `confusabilityScore`, empirical `confusabilityPercentile`, component scores/percentiles, `evidenceTags`, `reviewRecommended`, `strongReviewRecommended`, and neighbors above configured thresholds.
- `pairs[]`: pairwise cosine similarity records.
- `catalogSummary`: signature count, review-recommended count, strong-review count, mean confusability score, and reported pair count.

Interpretation boundary: use `confusabilityScore`, `confusabilityPercentile`, and `evidenceTags`; do not convert small changes around a review percentile into hard biological classes.
- `warnings`: signature ambiguity or flat-signature warnings.
- `recommendedActions`.

Interpretation boundary:

- Pairwise similarity and entropy identify signatures that may be confusable during fitting. They do not prove that any specific fitted exposure is wrong.

### `detectOutOfReferenceSignal(input, options)`

Validation status: validated core advisor function for the manuscript.

Inputs:

- `signatures`, `spectra`, `exposures`.
- Optional precomputed `residuals` and `reconstructionError`.
- `contexts = null`.
- `normalizeMode = "relative"`.
- `weakUnexplainedThreshold = 0.07`.
- `unexplainedThreshold = 0.12`.
- `cosineThreshold = 0.9`.
- `structuredResidualCosineThreshold = 0.85`.
- `minBurdenForReliableDetection = 100`.
- `moderateBurdenThreshold = 1000`.
- `topN = 8` residual contexts.
- Options may be supplied flatly or under `catalogSufficiency` or `catalogCheck`.

Outputs:

- `schemaVersion`.
- `workflowRole = "catalog_sufficiency"`.
- `scopeStatement`: residual matches are candidate patterns and do not identify causal signatures.
- `methodBasis`: unexplained fraction, residual structure definition, burden-conditioned status rules, references, and caveats.
- `contexts`.
- `thresholds`: unexplained, weak unexplained, reconstruction cosine, structured residual cosine, and minimum burden settings.
- `samples[]`: sample name, burden class, unexplained fraction, residual-structure summary, candidate residual matches, status, warnings, caveats, and recommended action.
- `overallStatus`.
- `summary`: sample count, catalog-review-cue count, and possible-cue count.
- `warnings`.
- `recommendedActions`.

Status labels:

- `catalog_sufficient_for_fit`.
- `possible_out_of_reference`.
- `suspected_out_of_reference`.
- Low-burden samples are downgraded because residual structure can be dominated by sampling noise.

Interpretation boundary:

- Residual matching is hypothesis-generating. The recommended action is to inspect residual spectra and consider whether a broader catalog or additional exploratory analysis is warranted in an adequately powered cohort.

### `computeFitQualityEvidence(input, options)`

Validation status: validated core advisor function for the manuscript.

Inputs:

- `signatures`, `spectra`, and `exposures`.
- Optional precomputed `burdenSummary`, `residuals`, `reconstructionError`, `bootstrap`, `thresholdSensitivity`, `ambiguity`, and `catalogCheck`.
- `lowBurdenThreshold = 100`.
- `moderateBurdenThreshold = 1000`.
- `normalizeMode = "relative"` by default for internally computed residuals and reconstruction.
- `bootstrapReviewExposureThreshold = 0.05`: fitted signatures at or above this fraction are summarized as reportable bootstrap entries.
- `bootstrapReviewConfidenceWidthThreshold = null`, `bootstrapStrongConfidenceWidthThreshold = null`, `bootstrapReviewSelectionFrequencyThreshold = null`, and `bootstrapStrongSelectionFrequencyThreshold = null`: bootstrap warning thresholds are disabled by default; finite caller-provided values opt in to bootstrap review cues.
- `thresholdReviewCosineDrop = 0.02` and `thresholdStrongCosineDrop = 0.05`: fit-quality cutoff review cues based on reconstruction cosine loss from the baseline cutoff.
- Interactive notebooks expose the review flag thresholds as run settings so users can choose burden, residual, bootstrap CI, cutoff cosine-drop, and nearest-neighbor cosine criteria for the cohort and analysis question.
- Options may be supplied flatly or under `fitQualityEvidence` or `qcEvidence`.

Outputs:

- `schemaVersion`.
- `workflowRole = "fit_quality_evidence"`.
- `scopeStatement`: rule-based QC evidence for known-signature refitting; no composite fit-quality score is returned.
- `methodBasis`: mutation burden, reconstruction/residual, ambiguity, catalog sufficiency, bootstrap/threshold evidence, explicit reporting-mode rules, references, and note that arbitrary weighted fit-quality scores are not returned.
- `contexts`.
- `primaryInterpretationField = "samples[].reportingMode"`.
- `samples[]`:
  - `sample`.
  - `reportingMode`.
  - `recommendedReportingMode`.
  - `primaryInterpretationField = "reportingMode"`.
  - `reviewFlagCount`.
  - `reviewFlagCodes`.
  - `componentEvidence`: burden, reconstruction, residual, bootstrap, threshold, ambiguity, and catalog evidence. Each component includes `derivedScoreDeprecated = true` where applicable.
  - `metrics`: burden class, total mutations, cosine similarity, RMSE, unexplained fraction, and active signatures.
  - `bootstrap`: summarized bootstrap stability.
  - `thresholdSensitivity`: summarized threshold instability.
  - `catalogStatus`.
  - `flags`, `evidenceFlags`, `warnings`.
  - `caveats`.
  - `recommendedActions`.
- `summary`: sample count, mean active-caveat count, and counts for each reporting mode.
- `warnings`.
- `recommendedActions`.

Bootstrap interpretation:

- `componentEvidence.bootstrap.maxConfidenceWidth` is the largest bootstrap confidence interval among fitted signatures at or above the reportable exposure threshold, displayed as 0 to 100 percentage points.
- Bootstrap uncertainty is reported as measured context by default. Fit-quality review cues for bootstrap uncertainty are emitted only when finite bootstrap warning thresholds are configured and crossed.

Cutoff interpretation:

- `componentEvidence.threshold.l1Change` is total exposure redistribution from the baseline cutoff, reported on a 0 to 2 relative scale before display as 0 to 200 percentage points.
- Fit-quality review cues for cutoff sensitivity are emitted when reconstruction cosine falls from the baseline cutoff by the configured review or priority threshold. Exposure redistribution alone is reported as context.

Reporting modes:

| Mode | Rule |
|---|---|
| `standard_qc_passed` | No configured fit-quality review cues are active. |
| `report_with_caveats` | Bootstrap warnings, threshold-sensitivity warnings, identifiability review cues, or flat-profile review cues are active. |
| `restricted_interpretation` | Low burden, catalog review cues, or structured-residual review cues are active. |
| `not_assessable` | Insufficient signal or not-assessable panel evidence is active. |

Interpretation boundary:

- The function intentionally avoids a weighted composite score. It reports explicit review cues and a rule-based tier, because burden, reconstruction, residuals, bootstrap behavior, identifiability, and catalog sufficiency are not independent calibrated confidence components.

## High-level pipelines: `pipelines`

The `pipelines` namespace contains stable computational workflows. Each full workflow accepts nested option groups for advanced callers. Matching lite wrappers expose the same workflows with a smaller option set:

| Lite wrapper | Full workflow | Use |
|---|---|---|
| `runSingleSampleFitLite(input, options)` | `runSingleSampleFit(input, options)` | Known-signature fit for one sample with default QC, threshold sensitivity, and bootstrap settings. |
| `runCohortFitLite(input, options)` | `runCohortFit(input, options)` | Cohort refitting with stable cohort-review defaults. |
| `runPanelWorkflowLite(input, options)` | `runPanelWorkflow(input, options)` | Panel/WES evidence review with default tier thresholds and report-ready outputs. |
| `runDiscoveryWorkflowLite(input, options)` | `runDiscoveryWorkflow(input, options)` | Fixed-rank browser NMF screening with production handoff guidance. |

The same lite wrappers are also exposed through `mSigSDK.workflows`. `mSigSDK.quickstart` points to the lite wrappers and adds a compact alias for `analyzeMafFilesLite`.

### `runSingleSampleFit(input, options)`

Inputs:

- `input.spectrum`, `input.spectra`, or a spectrum-like object.
- `input.signatures` or `input.referenceSignatures`.
- `sampleName`.
- `mutationBurden`: burden and threshold-mode options passed to burden QC and advisor logic. Defaults are `lowBurdenThreshold = 100` and `moderateBurdenThreshold = 1000`.
- `fit`: NNLS settings passed to fitting. Defaults are `exposureThreshold = 0`, `exposureType = "relative"`, `renormalize = true`, `maxIterations = null`, and `convergenceTolerance = 1e-10`.
- `residuals`: residual settings such as `weakUnexplainedThreshold` and `highResidualStructureCosineThreshold`.
- `thresholdSensitivity`: threshold-grid and instability-trigger settings. `runThresholdSensitivity = true` by default, with `thresholds = [0, 0.01, 0.03, 0.05, 0.1]`.
- `bootstrap`: bootstrap settings. `runBootstrap = true` by default, with `iterations = 100`, `confidenceLevel = 0.95`, and `seed = 123` in this pipeline wrapper.
- `ambiguity`: signature ambiguity screening settings.
- `catalogCheck`: catalog-sufficiency settings.
- `fitQualityEvidence`: reporting-mode evidence settings.
- Flat aliases such as `lowBurdenThreshold`, `exposureThreshold`, `thresholds`, `bootstrapIterations`, `confidenceLevel`, and `seed` remain supported.
- Report options including `reportFormat = "object"`.

Outputs:

- `schemaVersion`.
- `workflow = "single_sample_fit"`.
- `workflowRole = "single_sample_fit_pipeline"`.
- `scopeStatement`.
- `methodBasis`, including validation anchors for 50 and 100 mutation burdens.
- `primaryInterpretationFields`: fit-quality reporting mode, catalog-check status, bootstrap intervals, and threshold sensitivity summary.
- `parameters`: resolved workflow, fitting, burden, threshold, bootstrap, catalog, and fit-quality settings.
- `validationAnchor`.
- `sample`, `spectrum`, `validation`.
- `qc`: mutation burden, context coverage, reconstruction error, residuals, threshold sensitivity, bootstrap, fit-quality summary, and catalog-check summary.
- `primaryWarnings`: deduplicated warnings across subsystems.
- `warnings`: alias for the primary deduplicated warning list.
- `interpretationSuspended`: true when any fit-quality sample is `not_assessable`.
- `subsystemSummary`: highest-severity scan of advisor, fit quality, ambiguity, catalog check, threshold sensitivity, and bootstrap.
- `advisor`.
- `fit`: method `NNLS`, `solverVariant = "coordinate_descent_nnls"`, solver caveats, exposures, parameters, reconstruction error.
- `fitQualityEvidence`.
- `ambiguity`.
- `residuals`.
- `catalogCheck`.
- `thresholdSensitivity`.
- `bootstrap`.
- `recommendedActions`.
- `publicationFigures`.
- `provenance`.
- `report`.

Interpretation boundary:

- Exposures alone are not primary interpretation fields. The reporting mode, catalog status, bootstrap intervals, and threshold sensitivity define the review layer.

### `runCohortFit(input, options)`

Inputs:

- `input.spectra`.
- `input.signatures` or `input.referenceSignatures`.
- Optional metadata and `groupKey`.
- Fitting options as in `runSingleSampleFit`.
- `runBootstrap = false` by default; when true, `bootstrapSampleLimit = 5`.
- Cohort options: `clusterCosineThreshold = 0.85` and `minSubgroupSamples = 5` for cohort-similarity review.
- Group-comparison options can be supplied under `comparison` or `groupComparison`; key settings are `groupKey`, `referenceGroup`, `minGroupSizeForReliableStats = 5`, `permutationIterations = 0`, `topN = 10`, and `seed = 123`.

Outputs:

- `schemaVersion`.
- `workflow = "cohort_fit"`.
- `workflowRole = "cohort_fit_pipeline"`.
- `scopeStatement`.
- `methodBasis`.
- `primaryInterpretationFields`: fit-quality modes, cohort advisor recommendation, subgroup review summary, group comparison reporting mode.
- `parameters`: resolved group, fitting, burden, threshold, bootstrap, cohort, catalog, comparison, and fit-quality settings.
- `validationAnchor`.
- `validation`.
- `qc`: mutation burden, context coverage, reconstruction error, residuals, threshold sensitivity, bootstrap, fit-quality summary, catalog-check summary, subgroups, subgroup-review summary, and group-comparison summary.
- `primaryWarnings`.
- `warnings`: alias for the primary deduplicated warning list.
- `subsystemSummary`.
- `advisor`.
- `cohort`.
- `subgroupReviewStatus`: `stratification_review` or `single_similarity_group`.
- `bootstrapScope`: `none`, `per_sample`, or `representative_samples`.
- `bootstrapAnalyzedSamples`.
- `cohortSizeCaveat` when sample count is below 20.
- `subgroups`.
- `subgroupReview`.
- `groupComparison`.
- `fit`.
- `fitQualityEvidence`.
- `ambiguity`.
- `residuals`.
- `catalogCheck`.
- `thresholdSensitivity`.
- `bootstrap`.
- `recommendedActions`.
- `publicationFigures`.
- `provenance`.
- `report`.

Interpretation boundary:

- Cohort fitting packages sample-level refits with cohort-level structure. The subgroup review summarizes similarity structure for stratification review.

### `runDiscoveryWorkflow(input, options)`

Inputs:

- `input.spectra`.
- Optional `input.referenceSignatures` or `input.signatures`.
- `forceExtraction = false`.
- Rank options: `rank`, `runRankSelection`, `ranks = [2, 3, 4, 5]`.
- `rankSelectionCriterion = "reconstruction_error"`, with supported values `"reconstruction_error"`, `"cophenetic"`, and `"silhouette"`.
- Rank-selection NMF options: `rankSelectionMaxIterations = 500`, `rankSelectionRuns = 5`, `tolerance = 1e-5`, and `seed = 123`.
- Extraction NMF options: `extractionMaxIterations = 1000`, `extractionRuns = 20`, `tolerance = 1e-5`, `seed = 123`, and `signaturePrefix = "NMF"`.
- `defaultRank = 3` is used when rank selection is disabled and no explicit `rank` is supplied.
- Reference matching `topN = 5`.
- Options may be supplied flatly or under `discovery` or `discoveryOptions`.

Outputs when extraction gates fail:

- `schemaVersion`.
- `workflow = "discovery_workflow"`.
- `workflowRole = "discovery_pipeline"`.
- `scopeStatement`.
- `methodBasis`.
- `primaryInterpretationFields`.
- `parameters`.
- `validation`.
- `qc`.
- `fit = null`.
- `rankSelectionCriterion = "not_run"`.
- `rankSelectionRationale`.
- `productionHandoffRecommendation`.
- `advisor`.
- `extraction = null`.
- `comparison = null`.
- `warnings` containing `EXTRACTION_NOT_RECOMMENDED`.
- `recommendedActions`.
- `publicationFigures`.
- `provenance`.

Outputs when extraction runs:

- `schemaVersion`.
- `workflow = "discovery_workflow"`.
- `workflowRole = "discovery_pipeline"`.
- `scopeStatement`.
- `methodBasis`.
- `parameters`.
- `rankSelectionCriterion`: the criterion requested by the caller.
- `rankSelectionRationale`.
- `productionHandoffRecommendation`.
- `primaryInterpretationFields`.
- `validation`.
- `advisor`.
- `rankSelection`.
- `extraction`.
- `comparison`.
- `qc.mutationBurden`.
- `qc.reconstructionError`.
- `warnings`.
- `recommendedActions`.
- `publicationFigures`.
- `provenance`.

Interpretation boundary:

- Browser NMF rank selection can use lowest reconstruction error, maximum cophenetic correlation from consensus clustering, or maximum average silhouette across repeated decompositions. These are lightweight screening criteria and should not replace production stability frameworks for manuscript-grade discovery.

### `runPanelWorkflow(input, options)`

Inputs:

- Panel or WES spectra.
- Reference signatures.
- Optional `callableOpportunities`.
- Optional `referenceOpportunities`.
- `referenceOpportunitySource`.
- `opportunityEpsilon = 1e-12`.
- `opportunityCoverage`.
- `genomeVersion` or `genomeBuild`.
- `opportunitySource = "user_supplied"`, `"canonical_panel"`, or `"not_supplied"`.
- Restricted-assay grids: `restrictedAssayBurdens`, `restrictedAssayExposureLevels`.
- Panel fitting defaults: `lowBurdenThreshold = 30`, `moderateBurdenThreshold = 150`.
- Tier defaults: `minAssessableMutations = 30`, `higherSupportExposureThreshold = 0.2`, `limitedSupportExposureThreshold = 0.05`.
- Panel settings may be supplied flatly or under `panel` or `panelOptions`.

Outputs:

- Full `runCohortFit` output fields plus panel-specific fields.
- `schemaVersion`.
- `workflow = "panel_workflow"`.
- `workflowRole = "panel_wes_review_pipeline"`.
- `scopeStatement`: not-assessable and below-threshold tiers must not be interpreted as absence of a mutational process.
- `methodBasis`:
  - panel evidence.
  - opportunity normalization description.
  - opportunity-normalization formula.
  - tier assignment.
  - `tierRuleDefinitions`.
  - configurable defaults.
  - references.
- `primaryInterpretationFields`.
- `parameters`: resolved panel, opportunity, evidence-tier, and cohort-fitting settings.
- `qc`: cohort QC plus restricted-assay evidence summary, evidence summary, and panel workflow warnings.
- `panel`: nested panel-specific details containing opportunity normalization, opportunity metadata, evidence calls, evidence summary, tier rules, and limitations.
- `opportunityNormalization`.
- `opportunityMetadata`: genome version, opportunity source, source details, reference source, whether reference opportunities were applied, opportunity coverage, and opportunity coverage definition.
- `restrictedAssayEvidenceSummary`: internal restricted-assay evidence summary.
- `tierRules` and `tierRuleDefinitions`.
- `evidenceCalls`: object keyed by sample, each containing one row per fitted signature.
- `evidenceSummary`.
- `warnings`: deduplicated cohort, panel, and restricted-assay evidence warnings.
- `limitations`.
- `report`.
- `recommendedActions`.
- `publicationFigures`.
- `provenance`.

Evidence-call fields:

- `signatureName`.
- `exposure`.
- `tier`.
- `tierLabel`.
- `totalMutations`.
- `fitQualityReportingMode`.
- `reportingMode`.
- `restrictedAssayEvidence`.
- `assessabilityClass`.
- `assessabilityReasons`.
- `assessable`.
- `warnings`.

Tier rules:

| Tier | Rule |
|---|---|
| `not_assessable` | Total mutations are below `minAssessableMutations`, upstream fit quality is not assessable, or supplied callable opportunities contain no positive-opportunity contexts for the signature. |
| `higher_review_support` | Exposure is at least `higherSupportExposureThreshold`, the call is assessable, and fit reporting mode is `standard_qc_passed` or `report_with_caveats`. |
| `limited_review_support` | Call is assessable and exposure is at least `limitedSupportExposureThreshold`, but higher-review criteria are not met. |
| `not_detected_within_review_settings` | Call is assessable and exposure is below `limitedSupportExposureThreshold`. |

Opportunity-normalization formula:

```text
normalized_context_count =
  observed_context_count / max(callable_context_opportunity / reference_context_opportunity, epsilon)
```

When reference opportunities are not supplied, the denominator is `max(callable_context_opportunity, epsilon)`. The normalized vector is rescaled to the observed mutation total.

Interpretation boundary:

- Panel/WES outputs are transparent review evidence, not calibrated detection probabilities or full WGS-equivalent decompositions.

## Report-assembly workflows: `workflows`

The `workflows` namespace includes report-assembly wrappers and aliases to the validated pipeline functions.

| Feature | Inputs and parameters | Output |
|---|---|---|
| `createSignatureFitAnalysis({ spectra, signatures, exposures, parameters = {}, expectedContexts = null, mutationBurdenOptions = {}, residualOptions = {}, reconstructionOptions = {}, validationOptions = {}, provenance = null, reportFormat = "object" })` | Precomputed spectra, signatures, exposures, and subsystem options. | Validation, QC burden/context/reconstruction/residual outputs, method basis, output descriptions, and report. |
| `createNMFAnalysis({ spectra, referenceSignatures = null, nmfOptions = {}, parameters = {}, expectedContexts = null, mutationBurdenOptions = {}, reconstructionOptions = {}, validationOptions = {}, provenance = null, reportFormat = "object" })` | Spectra, optional reference signatures, NMF options, QC options, provenance, and report format. | Validation, extraction, optional reference comparison, QC, method basis, output descriptions, and report. |
| `analyzeSpectraWithSignatures(spectra, signatures, options)` | Spectra, signatures, flat fitting options or `fitOptions`, expected contexts, mutation burden options, residual options, reconstruction options, report format, catalog version/source, genome build, endpoint snapshot. | Exposures, provenance, validation, QC, and report generated through `createSignatureFitAnalysis`. |
| `extractSignaturesFromSpectra(spectra, options)` | Spectra, optional reference signatures, NMF options, expected contexts, mutation burden options, parameters, report format. | Provenance plus `createNMFAnalysis` output. |
| `analyzeMafFiles(mafFiles, signatures = null, options)` | MAF rows, optional signatures, `groupBy = "project_code"`, `batchSize = 100`, `genome = "hg19"`, `tcga = false`, `offline = false`, optional `contextLookupTable`, expected contexts, report format, `mutationBurdenOptions`, fitting options, context source/API metadata, catalog version/source. | If signatures are supplied, returns MAF conversion metadata plus `analyzeSpectraWithSignatures` output. If signatures are absent, returns spectra, context metadata, validation, QC, warnings, provenance, and report. |
| `analyzeMafFilesLite(mafFiles, signatures = null, options)` | MAF rows, optional signatures, and the minimal MAF options exposed through `workflows` and `quickstart`. | Same workflow family as `analyzeMafFiles`, with fitting defaults supplied for first-use analysis. |
| `runSingleSampleFit` | Alias to `pipelines.runSingleSampleFit`. | Same output as pipeline function. |
| `runSingleSampleFitLite` | Alias to `pipelines.runSingleSampleFitLite`. | Same output frame as the full pipeline with reduced option surface. |
| `runCohortFit` | Alias to `pipelines.runCohortFit`. | Same output as pipeline function. |
| `runCohortFitLite` | Alias to `pipelines.runCohortFitLite`. | Same output frame as the full pipeline with stable cohort-review defaults. |
| `runDiscoveryWorkflow` | Alias to `pipelines.runDiscoveryWorkflow`. | Same output as pipeline function. |
| `runDiscoveryWorkflowLite` | Alias to `pipelines.runDiscoveryWorkflowLite`. | Same output frame as the full pipeline with fixed-rank NMF screening defaults. |
| `runPanelWorkflow` | Alias to `pipelines.runPanelWorkflow`. | Same output as pipeline function. |
| `runPanelWorkflowLite` | Alias to `pipelines.runPanelWorkflowLite`. | Same output frame as the full pipeline with panel/WES review defaults. |

### `analyzeMafFiles` context metadata

The MAF workflow records:

- `genomeBuild`.
- `contextSource`.
- `contextLookupMode`: `live_ucsc_api` or `offline_table`.
- `contextApiVersion`.
- `contextApiEndpoint`.
- `contextFetchTimestamp`.
- `contextResultsCached`.
- `offlineContextTableSupplied`.
- `cacheBoundary`.
- `expectedConvertibleSnvCount`.
- `observedSbs96Count`.
- `sbs96CountMatchesConvertibleSnvCount`.
- `validationRule`.

The spectra-only result includes `CONTEXT_FETCH_FAILED` warnings when the SBS96 total does not match the count of convertible single-base substitution rows.

The spectra-only `validation` object contains `maf`, `spectra`, and `mafToSbs96CountCheck`. `mafToSbs96CountCheck` reports `valid`, `expectedConvertibleSnvCount`, `observedSbs96Count`, and any count-mismatch warning objects.

## Signature extraction: `signatureExtraction`

| Feature | Inputs and parameters | Output | Method and interpretation |
|---|---|---|---|
| `spectraToMatrix(spectra, { contexts = null, sampleNames = null })` | Spectra object or numeric matrix. | `{ matrix, contexts, sampleNames }`, with contexts as rows and samples as columns. | Shared conversion helper for NMF. |
| `extractSignaturesNMF(spectra, options)` | `rank = 5`, `maxIterations = 1000`, `tolerance = 1e-5`, `nRuns = 20`, `seed = 123`, `contexts = null`, `sampleNames = null`, `signaturePrefix = "NMF"`. | Best-run NMF output with extracted signatures, exposures, reconstruction, reconstruction error, average sample cosine similarity, sample cosine similarities, rank, contexts, sample names, convergence, best run, and run metrics. | Multiplicative-update NMF with multiple random starts. Browser-native and exploratory. |
| `selectNMFRank(spectra, options)` | `ranks = [2, 3, 4, 5]`, `rankSelectionCriterion = "reconstruction_error"`, NMF run options, contexts, sample names. Supported criteria are `"reconstruction_error"`, `"cophenetic"`, and `"silhouette"`. | Rank-grid runs, `recommendedRank`, `rankSelectionCriterion`, `criterionUsed`, `criterionValue`, and per-rank reconstruction error, average sample cosine, cophenetic correlation, average silhouette, consensus matrix, and run metrics where available. | Lightweight screening criteria, not a full production stability framework. |
| `compareExtractedToReference(extraction, referenceSignatures, { contexts = null, topN = 5 })` | NMF extraction result and reference signatures. | Per-extracted-signature cosine matches, best match, and top matches. | Similarity screening only; not etiology assignment. |
| `extractSignaturesNMFInWorker(spectra, options = {})` | Spectra and NMF options. | Promise resolving to worker-computed NMF output when browser Worker is available. | Runs extraction off the UI thread where supported. |

## Signature extraction plots: `signatureExtractionPlots`

Signature-extraction plot helpers use the same standalone figure context contract as `qcPlots`. Pass `figureContext` or `publication` to identify the dataset, extracted-rank settings, and whether exposures are relative or raw.

| Feature | Input | Output semantics |
|---|---|---|
| `plotNMFSignatureProfiles(divID, nmfResult, { maxSignatures = Infinity })` | NMF output. | Renders each extracted signature profile using the SBS profile renderer. Returns rendered profile results. |
| `plotNMFExposureHeatmap(divID, nmfResult, { relative = true })` | NMF output. | Sample-by-extracted-signature exposure heatmap using a viridis scale; returns plotted rows. |
| `plotNMFRankSelection(divID, rankSelection)` | Rank-selection output. | Rank diagnostics for reconstruction error, average sample cosine similarity, cophenetic correlation, and silhouette where available, with recommended-rank marker; returns rank-run rows. |

## Interoperability: `io`

| Feature | Inputs and parameters | Output |
|---|---|---|
| `exportMatrixTSV(matrix, { rowHeader = "id", columns = null })` | Nested matrix and optional column order. | Delimited text with row names in the first column. |
| `importMatrixTSV(text, { idColumn = 0, delimiter = "\t" })` | Delimited matrix text. | Nested row-oriented matrix. |
| `spectraToRows(spectra)` | Sample spectra. | Long-form rows with `sample`, `mutationType`, and `mutations`. |
| `signatureMatrixToRows(signatures)` | Signature matrix. | Long-form rows with `signatureName`, `mutationType`, and `contribution`. |
| `exposureMatrixToRows(exposures)` | Exposure matrix. | Long-form rows with `sample`, `signatureName`, and `exposure`. |
| `rowsToExposureMatrix(rows, { sampleKey = "sample", signatureKey = "signatureName", exposureKey = "exposure" })` | Long-form exposure rows and field mapping. | Sample-by-signature exposure matrix. |
| `exportSigProfilerMatrix(spectra, { contexts = null })` | Sample spectra. | SigProfiler-style `MutationType`-by-sample TSV text. |
| `importSigProfilerMatrix(text, { delimiter = "\t" })` | SigProfiler-style text. | Sample-by-context spectra. |
| `exportCOSMICSignatureMatrix(signatures, { contexts = null })` | Signature matrix. | COSMIC-style `MutationType`-by-signature TSV text. |
| `importCOSMICSignatureMatrix(text, { delimiter = "\t" })` | COSMIC-style text. | Signature-by-context matrix. |
| `exportMuSiCalInput({ spectra, signatures = null }, { contexts = null, delimiter = "\t" })` | Sample spectra and optional signature matrix. | MuSiCal-compatible mutation-type-by-sample spectra text, optional mutation-type-by-signature catalog text, and manifest metadata. |
| `importMuSiCalOutput(text, { delimiter = "\t", orientation = "auto", normalize = false })` | MuSiCal exposure output in sample-by-signature or signature-by-sample orientation. | Sample-by-signature exposure matrix, optionally normalized within each sample. |
| `rowsToSampleSpectra` | Re-export from validation. | Sample spectra matrix. |
| `rowsToSignatureMatrix` | Re-export from validation. | Signature matrix. |

## Optional external runtimes: `runners`

The `runners` namespace contains optional execution helpers for browser deployments that need to run compatible Python or R packages without a backend server. These helpers are not required for the validated JavaScript QC, fitting, reporting, or visualization workflows.

| Feature | Inputs and parameters | Output | Runtime boundary |
|---|---|---|---|
| `runners.pyodide.detect()` / `detectPyodideRuntime()` | No arguments. | Availability object with missing browser capabilities and the default Pyodide index URL. | Reports whether `Worker`, `Blob`, and `URL.createObjectURL` are available. |
| `runners.pyodide.createRunner({ workerUrl = null, pyodideIndexURL, pyodideScriptURL, timeoutMs = 120000 })` / `createPyodideWorkerRunner(...)` | Optional worker and Pyodide URLs. | Reusable runner with `run(payload)` and `terminate()` methods. | Runs Python in a Web Worker so long jobs do not block the UI thread. |
| `runners.pyodide.runPython(code, { inputs, ...options })` / `runPython(code, options)` | Python code, optional JSON-serializable `inputs`, packages, virtual input files, and output collection settings. | One-shot run result with parsed Python return value, collected files, loaded package names, installed package names, and elapsed time. | Small browser-notebook API; `inputs` is exposed as `MSIG_INPUT_JSON` in Python. |
| `runners.pyodide.run(payload, options)` / `runPyodide(...)` | Python code, Pyodide packages, micropip packages, virtual input files, JSON input, and output collection settings. | One-shot run result with parsed Python return value, collected files, loaded package names, installed package names, and elapsed time. | Requires browser worker support. Node smoke tests verify preparation paths but do not execute Pyodide. |
| `runners.webr.detect()` / `detectWebRRuntime()` | No arguments. | Availability object with missing browser capabilities, default WebR module URL, default package repository, and default R binary repository version. | Reports whether WebAssembly, workers, fetch, and text encoders are available. |
| `runners.webr.checkPackages(packages, options)` / `checkWebRPackageAvailability(...)` | R package names plus optional `repositoryUrl`, `binaryRVersion`, and `packageIndexUrls`. | Package availability object with found versions, missing packages, checked repository indexes, and fetch errors. | Checks repository indexes before exact WebR package execution. Package availability is runtime- and repository-dependent. |
| `runners.webr.createRunner({ webRModuleURL, repositoryUrl, timeoutMs = 120000, webROptions })` / `createWebRRunner(...)` | Optional WebR module URL, package repository, timeout, and WebR constructor options. | Reusable runner with `run(payload)` and `terminate()` methods. | Runs R through WebR. Uses PostMessage mode when cross-origin isolation is not available and the loaded WebR module supports it. |
| `runners.webr.run(payload, options)` / `runWebR(...)` | R code, R packages, virtual input files, optional JSON input, and output collection settings. | One-shot run result with parsed return value, collected files, installed R package names, WebR version metadata, and elapsed time. | Requires WebR-compatible package builds. Exact R-package adapters fail with `WEBR_RUNTIME_UNAVAILABLE` or `WEBR_PACKAGE_UNAVAILABLE` instead of silently using JavaScript fallbacks. |

Pyodide payloads accept `pyodidePackages`, `micropipPackages`, `files`, `inputJson`, `globals`, `outputFiles`, and `outputDirectories`. The runner sets `MSIG_INPUT_JSON` inside Python when `inputJson` or `runPython(..., { inputs })` is supplied.

WebR payloads accept `rPackages`, `files`, `inputJson`, `outputFiles`, and `outputDirectories`. R packages must be precompiled for WebAssembly in the active WebR package repository or supplied through a compatible configured repository/library image.

## External tool adapters: `adapters`

Adapters prepare stable file formats for established tools and return provenance-rich results. They separate package execution from the validated JavaScript core so browser apps can choose between pure SDK review, Pyodide/WebR execution, or local/server execution.

The namespace also exposes `ADAPTER_SCHEMA_VERSION` and default package spec constants for SigProfilerAssignment (`DEFAULT_SPA_PACKAGE`), SigProfilerExtractor (`DEFAULT_SPE_PACKAGE`), SigProfilerMatrixGenerator (`DEFAULT_SPMG_PACKAGE`), SigProfilerSimulator (`DEFAULT_SPS_PACKAGE`), SigProfilerClusters (`DEFAULT_SPC_PACKAGE`), and sigProfilerPlotting (`DEFAULT_SPP_PACKAGE`) so callers can record the intended adapter version and package targets in provenance.

| Feature | Inputs and parameters | Output | Method and interpretation |
|---|---|---|---|
| `adapters.parseExposureTables(files, options)` / `parseExposureTables(...)` | Collected text files, optional delimiter, and `normalize = true`. | Best candidate sample-by-signature exposure matrix plus scored candidate-table metadata. | Shared parser used by assignment/extraction adapters to reimport compatible exposure tables without assuming a single external filename. |
| `adapters.createInteroperabilityBundle({ spectra, signatures }, options)` / `createInteroperabilityBundle(...)` | Sample spectra, optional signature catalog, context order, and included tool names. | Matched handoff bundles for SigProfilerAssignment, SigProfilerExtractor, sigProfilerPlotting, deconstructSigs, sigminer, and MuSiCal when inputs are available. | Uses the same context order across tools so outputs can be compared after external execution. Variant-level SigProfiler tools are exposed as standalone adapters because they start from VCF/MAF-like files. |
| `adapters.sigProfilerAssignment.prepareInput({ spectra, signatures }, { contexts = null })` / `prepareSigProfilerAssignmentInput(...)` | Sample spectra and optional custom signature catalog. | Virtual TSV files and manifest metadata in SigProfiler matrix orientation. | Produces `MutationType`-by-sample spectra and optional `MutationType`-by-signature catalog files. |
| `adapters.sigProfilerAssignment.run({ spectra, signatures }, options)` / `runSigProfilerAssignment(...)` | Spectra, optional signatures, context order, Pyodide packages, `SigProfilerAssignment` package spec, genome build, COSMIC version, and runtime options. | Pyodide run result, collected output files, parsed exposure matrix when an exposure table is detected, candidate table list, and provenance. | Runs SigProfilerAssignment in matrix mode with plotting disabled, mutation-level probability export disabled, and `cpu = 1` by default for browser compatibility. |
| `adapters.sigProfilerExtractor.prepareInput({ spectra }, options)` / `prepareSigProfilerExtractorInput(...)` | Sample spectra, context order, reference genome, rank range, NMF replicates, and CPU count. | Matrix-mode input file, manifest metadata, and Python snippet for `SigProfilerExtractor.sigpro.sigProfilerExtractor`. | Handoff adapter for production de novo extraction. Browser execution is not the default path. |
| `adapters.sigProfilerExtractor.run({ spectra }, options)` / `runSigProfilerExtractor(...)` | Sample spectra, context order, runtime, output directory, reference genome, signature-rank range, NMF replicates, and CPU count. | Browser NMF signatures and exposures by default, plus the prepared SigProfilerExtractor handoff manifest. With `runtime: "pyodide"`, returns collected package files and parsed signatures/exposures when a compatible environment is provided. | Default browser path avoids installing SigProfilerExtractor in Pyodide because the current package depends on `torch`. Use `prepareInput(...)` or the export bundle for local/server package execution. |
| `adapters.sigProfilerExtractor.parseOutput(files, options)` / `parseSigProfilerExtractorOutput(...)` | Collected output files from SigProfilerExtractor. | Parsed signature matrix, exposure matrix when detected, and candidate table metadata. | Reimports common signature and activity tables into SDK matrix objects. |
| `adapters.sigProfilerMatrixGenerator.prepareInput({ files }, options)` / `prepareSigProfilerMatrixGeneratorInput(...)` | VCF/MAF/CNV/SV-like virtual files, project name, reference genome, input directory, and MatrixGenerator options. | Virtual files, manifest metadata, and Python snippet using `SigProfilerMatrixGeneratorFunc`. | Standalone variant-to-matrix handoff adapter. Reference-genome installation remains an external package/runtime concern. |
| `adapters.sigProfilerMatrixGenerator.parseOutput(files, options)` / `parseSigProfilerMatrixGeneratorOutput(...)` | Collected MatrixGenerator text files. | Candidate SigProfiler matrices imported into sample-by-context SDK matrix objects. | Scans text outputs whose first column looks like mutation context/channel labels. |
| `adapters.sigProfilerSimulator.prepareInput({ files }, options)` / `prepareSigProfilerSimulatorInput(...)` | VCF-like virtual files, project path, genome, contexts, number of simulations, and simulator options. | Virtual files under the expected project input directory, manifest metadata, and Python snippet using `SigProfilerSimulator`. | Standalone simulation handoff adapter for benchmark/null-model generation. |
| `adapters.sigProfilerClusters.prepareInput({ files }, options)` / `prepareSigProfilerClustersInput(...)` | VCF-like virtual files, project, genome, contexts, simulation context, input path, and cluster-analysis options. | Virtual files, manifest metadata, and Python snippet using `SigProfilerClusters.analysis`. | Standalone regional mutation-clustering handoff adapter. |
| `adapters.sigProfilerPlotting.prepareInput({ spectra, matrixText, files }, options)` / `prepareSigProfilerPlottingInput(...)` | SDK spectra or a pre-rendered SigProfiler matrix, project, output directory, matrix type, plot type, and plotting options. | Matrix input file, manifest metadata, and Python snippet calling the matching `sigProfilerPlotting` plot function. | Handoff adapter for exact SigProfiler-style plot generation when the Python plotting package is available. |
| `adapters.deconstructSigs.prepareInput({ spectra, signatures }, options)` / `prepareDeconstructSigsInput(...)` | Sample spectra, signature catalog, context order, output path, and signature cutoff. | Spectra TSV, signature TSV, manifest metadata, and R snippet using `deconstructSigs::whichSignatures`. | Handoff adapter for R execution with a shared context basis. |
| `adapters.deconstructSigs.checkWebRAvailability(options)` / `checkDeconstructSigsWebRAvailability(...)` | Optional WebR package repository settings and package list. | Availability object with `available`, `status`, runtime status, package availability, and missing package names. | Reports `available`, `missing package`, or `runtime unavailable` before exact WebR execution. |
| `adapters.deconstructSigs.run({ spectra, signatures }, options)` / `runDeconstructSigsWebR(...)` | Sample spectra, signature catalog, context order, signature cutoff, WebR module URL, WebR repository settings, timeout, and optional package-check override. | Exact WebR package result with parsed exposure matrix, prepared input manifest, collected files, package availability, raw run metadata, and provenance. | Executes the deconstructSigs R package through WebR only when compatible package builds are available. It does not fall back to the SDK NNLS comparator under the same label. |
| `adapters.deconstructSigs.parseOutput(text, options)` / `parseDeconstructSigsOutput(...)` | Sample-by-signature deconstructSigs exposure table. | Sample-by-signature exposure matrix, optionally normalized. | Uses the same exposure parser semantics as other sample-by-signature outputs. |
| `adapters.sigminer.prepareInput({ spectra, signatures }, options)` / `prepareSigminerInput(...)` | Sample spectra, signature catalog, context order, output path, sigminer method, exposure type, relative threshold, and mutation mode. | Spectra TSV, signature TSV, manifest metadata, and R snippet using `sigminer::sig_fit`. | Handoff adapter for supervised sigminer fitting. Solver packages such as `quadprog`, `nnls`, or `GenSA` are checked by the generated R snippet according to the selected method. |
| `adapters.sigminer.checkWebRAvailability(options)` / `checkSigminerWebRAvailability(...)` | Optional WebR package repository settings, package list, and sigminer method. | Availability object with `available`, `status`, runtime status, package availability, and missing package names. | Checks `sigminer` plus the solver package required by the selected method (`quadprog`, `nnls`, or `GenSA`). |
| `adapters.sigminer.run({ spectra, signatures }, options)` / `runSigminerWebR(...)` | Sample spectra, signature catalog, context order, sigminer method, exposure type, thresholds, WebR module URL, WebR repository settings, timeout, and optional package-check override. | Exact WebR package result with parsed exposure matrix, prepared input manifest, collected files, package availability, raw run metadata, and provenance. | Executes the sigminer R package through WebR only when compatible package builds are available. The run default is `method = "NNLS"` because current public WebR repositories commonly provide `sigminer` with `nnls`; callers can choose `QP` or `SA` when the corresponding solver package is available. |
| `adapters.sigminer.parseOutput(text, options)` / `parseSigminerOutput(...)` | Sample-by-signature sigminer exposure table. | Sample-by-signature exposure matrix, optionally normalized. | Reuses the common SDK exposure-table parser so results can be compared with JavaScript, Python, and other R adapters. |
| `adapters.musical.prepareRefitInput({ spectra, signatures }, { contexts = null })` / `prepareMuSiCalRefitInput(...)` | Sample spectra and signature catalog. | MuSiCal-compatible spectra and signature TSV files plus manifest metadata. | Uses mutation-type rows with sample or signature columns. |
| `adapters.musical.runSparseNnlsRefit({ spectra, signatures }, options)` / `runSparseNnlsRefit(...)` | Spectra, signatures, context order, sparsity threshold, and NNLS controls. | Browser-native sparse NNLS comparator with exposures, active sets, reconstruction metrics, and provenance. | Uses MuSiCal-compatible matrices but does not execute the MuSiCal Python package. |
| `adapters.musical.runRefit({ spectra, signatures }, options)` / `runMuSiCalRefit(...)` | `runtime = "js_sparse_nnls"` by default, or `runtime = "pyodide"` with supplied Pyodide-compatible MuSiCal package assets. | Sparse comparator result or Pyodide MuSiCal refit result. | True MuSiCal package execution requires a compatible wheel or preloaded worker environment; the default path is explicitly labeled `js_sparse_nnls`. |

Adapter provenance records the tool name, runtime, package metadata when available, parameters, notes, and generation timestamp. SigProfilerAssignment, MuSiCal, deconstructSigs, and sigminer package execution should be validated in the target browser before being used in a production browser application because package dependencies, wheel/package availability, and browser memory limits are runtime-specific.

## Reports: `reports`

### `createAnalysisReport(reportInput, { format = "object" })`

Inputs:

- `title = "mSigSDK Analysis Report"`.
- `summary = ""`.
- `parameters = {}`.
- `validation = null`.
- `qc = null`.
- `signatures = null`.
- `exposures = null`.
- `extraction = null`.
- `provenance = null`.
- `citations = []`.
- `notes = []`.
- `workflowRole = null`.
- `scopeStatement = null`.
- `methodBasis = null`.
- `primaryInterpretationFields = []`.
- `reproducibilityStatement = null`.
- `format = "object"`, `"json"`, or `"html"`.

Outputs:

- Object, JSON string, or standalone HTML string.
- Structured object fields: `schemaVersion = "msig.report.v0.3"`, title, summary, generated timestamp, workflow role, scope statement, method basis, primary interpretation fields, reproducibility statement, parameters, validation, QC, summarized signatures, summarized exposures, extraction, provenance, citations, and notes.

Citation behavior:

- Citations are deduplicated from explicitly supplied `citations`, nested `methodBasis.references`, validation/QC/extraction/provenance objects, and the built-in Wilkinson 2016 FAIR reference.

Schema support:

- The versioned JSON Schema for report objects is committed at `schemas/msig.report.v0.3/report.schema.json`.
- `npm run test:report-schema` validates a representative report object against the schema.

### Other report functions

| Feature | Input | Output |
|---|---|---|
| `createAnalysisReportHTML(report)` | Report object. | Standalone HTML document string with sections for summary, parameters, validation, QC, extraction, method basis, primary fields, reproducibility, provenance, citations, and notes. |
| `downloadAnalysisReport(report, filename = "msig-analysis-report.html")` | Report object or pre-rendered HTML string. | Browser download side effect. Throws outside a browser DOM. |

## Provenance: `provenance`

| Feature | Inputs | Output |
|---|---|---|
| `createProvenance(options)` | `analysis`, `parameters`, `sourceUrls`, `dataSources`, `catalogVersion`, `catalogSource`, `genomeBuild`, `contextSource`, `contextApiVersion`, `contextLookupMode`, `contextFetchTimestamp`, `apiEndpointSnapshot`, and `notes`. | Metadata object with `analysis`, `generatedAt`, SDK name/version/import URL/fallback/repository, parameters, catalog, genome/context metadata, API endpoint snapshot, source URLs, data sources, runtime context, and notes. |
| `withProvenance(data, options = {})` | Any output and provenance options. | `{ data, provenance }`. |

## Presentation helpers: `presentation`

These helpers are intended for browser notebooks, reports, and teaching pages. DOM-rendering helpers throw outside a browser DOM.

| Feature | Inputs | Output |
|---|---|---|
| `DEFAULT_TOOLTIP_TERMS` | No inputs. | Frozen glossary map for reporting modes, review flags, identifiability evidence, catalog statuses, and panel evidence tiers. |
| `formatNumber(value, digits = 3)` | Numeric value and significant-digit setting. | Human-readable number or `n/a`. |
| `formatCell(value)` | Primitive, array, or object. | Compact display string. |
| `compactSummary(value)` | Object or array. | Short text summary. |
| `metrics(items)` | Items with `label`, `value`, and optional `note`. | DOM metric-card grid. |
| `table(rows, columns = null, options = {})` | Row objects, optional column descriptors, `maxRows`; optionally `tooltipTerms`. | DOM table wrapper. |
| `tooltipTable(rows, columns = null, options = {})` | Row objects, optional column descriptors, `maxRows`, and optional custom `tooltipTerms`. | DOM table wrapper with hover/focus definitions for SDK reporting modes, warning/review cues, panel tiers, and catalog statuses. |
| `fitQualityEvidenceRows(fitQualityEvidence)` | Output from `advisor.computeFitQualityEvidence`. | Compact reporting rows with reporting mode, review cues, burden, reconstruction cosine, active identifiability evidence tags, max active confusability score, and catalog status. |
| `fitQualityEvidenceTable(fitQualityEvidence, options = {})` | Output from `advisor.computeFitQualityEvidence`; optional `maxRows`, `includeActiveSignatures`, `columns`, and `tooltipTerms`. | Reproducible tooltip reporting table for fit-quality evidence. |
| `panelEvidenceRows(panelWorkflowResultOrCalls)` | Output from `pipelines.runPanelWorkflow` or an `evidenceCalls` object. | Compact panel/WES evidence-call rows. |
| `panelEvidenceTable(panelWorkflowResultOrCalls, options = {})` | Output from `pipelines.runPanelWorkflow` or an `evidenceCalls` object; optional `maxRows`, `columns`, and `tooltipTerms`. | Reproducible tooltip reporting table for panel/WES evidence tiers. |
| `note(text, tone = "info")` | Text and tone. | DOM note paragraph. |
| `details(label, value, { open = false } = {})` | Label, value, and open flag. | DOM details/summary inspector. |
| `burdenSampleRows(burden, sampleNames = null)` | Burden summary and optional sample allow-list. | Rows with sample, mutations, non-zero contexts, and low-burden review-cue display value. |
| `reconstructionRows(reconstruction)` | Reconstruction-error output. | Rows with sample, normalization mode, cosine similarity, RMSE, and total observed. |
| `exposureRows(exposures, { minExposure = 0, topN = 10 })` | Exposure matrix. | Top exposure rows sorted descending. |
| `bootstrapRows(bootstrap, { topN = 8 })` | Bootstrap output. | Rows with signature, mean, lower/upper interval bounds, and selection frequency. |
| `thresholdRows(thresholdSensitivity)` | Threshold-sensitivity output. | Rows with threshold, average cosine, average RMSE, and average active signatures. |
| `uncertaintyDecisionRows(bootstrap, thresholdSensitivity, options = {})` | Bootstrap output, threshold-sensitivity output, selected sample name, selection-frequency cutoff, maximum interval width, and row limit. | Per-signature rows with mean exposure, CI width, selection frequency, cutoff range, and reportability decision text for uncertainty notebooks and report packets. |
| `nmfMatchRows(matches, { maxRows = 12 })` | Reference match output. | Rows with extracted signature, reference signature, and cosine similarity. |
| `reportFieldRows(report)` | Report object. | Rows summarizing top-level report fields. |

## References

| Topic | Reference |
|---|---|
| Classical NNLS | Lawson CL, Hanson RJ. Solving least squares problems. Philadelphia: SIAM; 1995. Classics in Applied Mathematics; vol. 15. doi:10.1137/1.9781611971217. |
| Original NMF extraction framing | Alexandrov LB et al. Signatures of mutational processes in human cancer. Nature. 2013;500:415-421. doi:10.1038/nature12477. |
| COSMIC signature context and catalog interpretation | Alexandrov LB et al. The repertoire of mutational signatures in human cancer. Nature. 2020;578:94-101. doi:10.1038/s41586-020-1943-3. |
| Practical signature analysis caveats | Koh G et al. Mutational signatures: emerging concepts, caveats and clinical applications. Nat Rev Cancer. 2021;21(10):619-637. doi:10.1038/s41568-021-00377-7. |
| Cohort heterogeneity and practical framework | Degasperi A et al. A practical framework and online tool for mutational signature analyses show intertissue variation and driver dependencies. Nat Cancer. 2020;1:249-263. doi:10.1038/s43018-020-0027-5. |
| Burden-dependent fitting behavior and tool comparison | Medo M et al. A comprehensive comparison of tools for fitting mutational signatures. Nat Commun. 2024;15:9467. doi:10.1038/s41467-024-53711-6. |
| Likelihood-based sparse assignment and confusability | Jin H et al. Accurate and sensitive mutational signature analysis with MuSiCal. Nat Genet. 2024;56:541-552. doi:10.1038/s41588-024-01659-0. |
| Known-signature assignment comparator | Diaz-Gay M et al. Assigning mutational signatures to individual samples and individual somatic mutations with SigProfilerAssignment. Bioinformatics. 2023;39(12):btad756. doi:10.1093/bioinformatics/btad756. |
| R-based mutational-pattern workflow | Manders F et al. MutationalPatterns: the one stop shop for the analysis of mutational processes. BMC Genomics. 2022;23:134. doi:10.1186/s12864-022-08357-3. |
| Assignment heterogeneity | Wu AJ et al. Mutational signature assignment heterogeneity is widespread and can be addressed by ensemble approaches. Brief Bioinform. 2023;24(6):bbad331. doi:10.1093/bib/bbad331. |
| Statistical confidence in signature detection | Huang X et al. Detecting presence of mutational signatures in cancer with confidence. Bioinformatics. 2018;34(2):330-337. doi:10.1093/bioinformatics/btx604. |
| Panel sequencing considerations | Lawrence L et al. Performance characteristics of mutational signature analysis in targeted panel sequencing. Arch Pathol Lab Med. 2021;145(11):1424-1431. doi:10.5858/arpa.2020-0536-OA. |
| Parametric bootstrap attribution uncertainty | Senkin S. MSA: reproducible mutational signature attribution with confidence based on simulations. BMC Bioinformatics. 2021;22:540. doi:10.1186/s12859-021-04450-8. |
| SigProfilerExtractor and production extraction | Islam SMA et al. Uncovering novel mutational signatures by de novo extraction with SigProfilerExtractor. Cell Genomics. 2022;2(11):100179. doi:10.1016/j.xgen.2022.100179. |
| Reproducibility and provenance | Wilkinson MD et al. The FAIR Guiding Principles for scientific data management and stewardship. Sci Data. 2016;3:160018. doi:10.1038/sdata.2016.18. |

## Interpretation boundaries

- mSigSDK outputs are research-use analytical summaries, not clinical decision rules.
- NNLS and NMF outputs are conditional on the supplied catalog, spectra, context basis, thresholds, and assay territory.
- Residual matches are candidate signals for review and do not identify causal mutational processes.
- Fit-quality evidence uses rule-based reporting modes and explicit review cues; no calibrated composite confidence score is returned.
- Restricted-assay outputs expose burden, fitted exposure, callable territory, and ambiguity descriptors; they do not estimate calibrated panel/WES detection probability.
- Regional mutation-clustering support is limited to external-tool handoff files through the SigProfilerClusters adapter.
- Browser-native NMF extraction and rank selection are exploratory and should be validated with production extraction workflows for manuscript-grade discovery.
