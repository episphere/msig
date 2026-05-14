# mSigSDK: a browser-native JavaScript SDK for mutational-signature quality review and provenance-aware reporting

Aaron Ge1,2*, Tongwu Zhang1, Yasmmin Cortes Martins3, Maria Teresa Landi1, Brian Park1, Kailing Chen1, Jeya Balasubramanian1, Jonas S Almeida1

1 Division of Cancer Epidemiology and Genetics, National Cancer Institute, National Institutes of Health, Maryland, USA
2 University of Maryland School of Medicine, Maryland, USA
3 National Laboratory of Scientific Computing, Petropolis, Brazil
*Correspondence: age1@som.umaryland.edu

---

## Abstract

### Background

Mutational-signature analysis is a multi-step workflow that typically requires moving between several software environments for catalog retrieval, matrix preparation, signature fitting, visualization, quality control, and report assembly. This fragmentation across R, Python, and portal interfaces produces fragile pipelines, undocumented parameter choices, and weak provenance, and it forces analysts working in web notebooks, embedded portals, or teaching applications to either install local toolchains or accept results that cannot be easily shared or reproduced. Existing tools cover extraction, refitting, and public portal access, but none provide a reusable browser-executable layer that connects public data access, local spectra, quality-controlled refitting, uncertainty review, and provenance-aware reporting in a single software development kit.

### Results

We present mSigSDK, a browser-native JavaScript SDK that addresses this integration gap through three contributions. First, a modular browser-native architecture unifies public data access, local spectra import, NNLS refitting, quality control, panel and exome workflows, exploratory NMF, and report generation on shared nested-matrix structures. Second, a structured validation, quality control, and uncertainty layer provides mutation-burden checks, context completeness assessment, residual and reconstruction metrics, threshold-sensitivity sweeps, bootstrap intervals, catalog sufficiency screens, signature ambiguity flags, and rule-based fit-quality reporting modes, each with configurable thresholds and explicit interpretation boundaries. Third, a provenance-aware interoperability layer connects the SDK to established tools and formats, including mSigPortal resources, SigProfiler-style matrices, COSMIC catalogs, optional Pyodide execution for compatible SigProfilerAssignment matrix-mode runs, a MuSiCal-compatible sparse refit comparator, handoff helpers for SigProfilerExtractor and deconstructSigs, and report JSON Schema validation. mSigSDK does not introduce a new attribution algorithm; it combines browser-native NNLS and exploratory NMF with optional Pyodide execution and external-tool handoff/import paths in a review and reporting layer. Supporting validation: against a synthetic benchmark, exposure-vector cosine rose from 0.912 (95% CI, 0.882 to 0.941) at 50 mutations to 0.996 (95% CI, 0.994 to 0.997) at 1,000 mutations; cross-tool concordance on 38 PCAWG Lung-AdenoCA spectra had mean exposure-vector cosine 0.997 versus deconstructSigs, 0.907 versus SigProfilerAssignment, and 0.973 versus MuSiCal SparseNNLS; and a 120-sample cohort refitting workflow ran in a median of 254 ms in Chrome without installation.

### Conclusions

mSigSDK extends the mutational-signature ecosystem by providing a browser-native, provenance-aware review and reporting layer that connects established extraction and refitting tools to interactive, shareable analyses. It is positioned for portal developers, computational analysts producing shareable artifacts, laboratories working with restricted assays, and methods developers seeking a standard review layer around their own algorithms.

---

## Background

### The integration gap in mutational-signature workflows

FAIR principles provide a useful framework for mutational-signature software as well as data. Findability requires stable web entry points and versioned resources; accessibility requires that users can reach tools and outputs without specialized local infrastructure; interoperability requires shared matrix formats, context ordering, and machine-readable reports; and reusability requires provenance, documented parameters, and reproducible examples [4]. mSigSDK implements these principles at the workflow layer. The native JavaScript SDK can be imported from a public URL and run in any modern web browser, allowing users to execute the core review workflows without a package manager, desktop installation, or server-side analysis account. Its matrix validators, SigProfiler-style and COSMIC-style exchange helpers, MuSiCal-compatible tables, JSON Schema report definition, and external-tool handoff adapters keep spectra, signatures, exposures, and reports portable across browser notebooks, static pages, local scripts, and established R/Python pipelines. High-level workflows return parameters, validation results, method basis, warnings, recommended actions, publication-figure descriptors, and provenance so that outputs remain interpretable after they leave the original browser session.

Mutational signatures are widely used to summarize somatic mutational processes across cancer types [2,6,7,8,9,10]. In practice, a typical analysis involves at least five distinct operations: retrieving reference catalogs and public cohort spectra, converting raw variant files into trinucleotide-context matrices, refitting against known signatures, evaluating fit quality, and assembling a reproducible report. Each step has established tools (SigProfilerExtractor [11] and MutationalPatterns [12] for R-based extraction; deconstructSigs [17] and SigProfilerAssignment [18] for refitting; mSigPortal [16] as a public portal), but no single tool unifies these steps in a no-install, browser-executable environment. Analysts who share work through web notebooks or embedded portals must either bundle a local R or Python runtime, accept a patchwork of external scripts, or deliver static results without interactive review capability. A representative workflow that uses SigProfilerExtractor for de novo extraction, a Python script for COSMIC refitting, and a separate notebook for visualization introduces version-mismatch risk, undocumented parameter choices, and loss of provenance at every handoff. For MAF-derived spectra, the context-assignment step depends on a specific genome build and retrieval endpoint that is rarely recorded alongside the exposure estimates.

### Positioning relative to existing tools

mSigSDK has three distinct capability tiers. The native JavaScript tier runs directly in the browser and supports spectra import and export, validation, standard NNLS refitting, reconstruction and residual QC, bootstrap and threshold-sensitivity review, signature ambiguity checks, panel and exome evidence tiers, exploratory NMF, figure generation, structured reports, and provenance capture. The optional Pyodide tier can run compatible Python code in a browser worker; in this manuscript, that tier is used for matrix-mode SigProfilerAssignment, but successful execution depends on Pyodide support, package installation, dependency compatibility, browser memory, and runtime limits. The handoff tier supports tools whose production implementations remain external to the browser, including SigProfilerExtractor, deconstructSigs, and full MuSiCal workflows, by preparing canonical input matrices and scripts, parsing common output tables, and comparing outputs under a shared context order. This positioning makes mSigSDK a browser-native review, QC, interoperability, and reporting layer around established attribution engines rather than a replacement for those engines or a native browser port of every external package.

### Contributions

This manuscript describes mSigSDK v0.3 [16] and makes three contributions:

1. A modular browser-native JavaScript SDK that unifies public signature resource access, local spectra import, NNLS refitting, quality control, panel and exome workflows, exploratory NMF, and report generation on shared nested-matrix data structures.

2. A structured validation, quality-control, and uncertainty layer that exposes mutation-burden QC, context-completeness checks, residual and reconstruction metrics, threshold-sensitivity sweeps, bootstrap intervals, catalog sufficiency screens, signature ambiguity flags, and rule-based fit-quality reporting modes.

3. Provenance-aware, interoperable workflows and multi-engine integration, including auto-collected method citations, MAF-derived context provenance, optional Pyodide execution for compatible SigProfilerAssignment matrix-mode runs, a browser-native MuSiCal-compatible sparse refit comparator, handoff helpers for SigProfilerExtractor and deconstructSigs, and import/export helpers for mSigPortal resources, SigProfiler-style matrices, COSMIC catalogs, and report JSON Schema validation.

These three contributions organize the Implementation, Results, and Discussion sections. The public import surface is exposed through a single endpoint:

```javascript
import { mSigSDK } from "https://episphere.github.io/msig/main.js";
```

and includes namespaces for data access and interoperability (`mSigPortal`, `TCGA`, `userData`, `io`, `runners`, `adapters`), validation, refitting, QC, and uncertainty (`validation`, `signatureFitting`, `qc`, `signatureExtraction`), and workflows and reporting (`pipelines`, `workflows`, `reports`, `advisor`, `qcPlots`, `presentation`, `provenance`). Advisory functions used in this manuscript (`computeFitQualityEvidence`, `computeSignatureAmbiguity`, `detectOutOfReferenceSignal`, `recommendAnalysisStrategy`) are part of the validated core; remaining advisory and pipeline functions are marked experimental and are reserved for future validation.

---

## Implementation

### Software architecture organized by functional layer

mSigSDK v0.3 is a modular browser-native SDK. Remote endpoints are used only for public resources such as mSigPortal, GDC/TCGA, and optional genome-context lookup through the UCSC Genome Browser sequence API. All validation, refitting, QC, uncertainty review, exploratory NMF, panel evidence, and report generation execute locally in the client runtime on nested matrix objects. Figure 1 illustrates this architecture and the boundary between remote public-resource access and local client-side computation.

The namespace surface is grouped into three functional layers that mirror the three contributions.

The data and interoperability layer (`mSigPortal`, `TCGA`, `userData`, `io`, `runners`, `adapters`) handles public resource discovery and retrieval, TCGA/GDC convenience access, MAF and spectrum import, generic TSV, SigProfiler-style, COSMIC-style, and MuSiCal-compatible matrix exchange, optional Pyodide execution, and handoff adapters for established external tools.

The validation, refitting, QC, and uncertainty layer (`validation`, `signatureFitting`, `qc`, `signatureExtraction`) provides input validation, coordinate-descent NNLS refitting, burden and context checks, residual and reconstruction metrics, threshold-sensitivity sweeps, bootstrap uncertainty, and multiplicative-update NMF with rank-sweep diagnostics.

The workflows and reporting layer (`pipelines`, `workflows`, `reports`, `qcPlots`, `presentation`, `provenance`) composes the lower layers into reusable single-sample, cohort, panel/WES, and exploratory pipelines, attaches versioned provenance, renders plots and HTML tables, and emits standalone reports with auto-collected method citations. The primary happy path is `workflows.analyzeMafFiles`, `workflows.runSingleSampleFit`, `workflows.runCohortFit`, and `workflows.runPanelWorkflow`; advanced options remain available through `pipelines` and lower-level namespaces.

The SDK is an analysis layer that interoperates with public resources, not a portal wrapper. The shared nested-matrix data model is what holds the three layers together: the same in-memory objects flow through retrieval, conversion, validation, fitting, QC, plotting, and reporting without format-specific glue. This unified matrix model also allows the same objects to be passed between R or Python pipelines and the browser-side review layer without ad hoc per-step conversions.

*Figure 1. Browser-native mSigSDK architecture. The data and interoperability layer accesses public resources and imports user spectra, while the validation, refitting, QC, uncertainty, panel-review, and reporting layers operate on local nested-matrix objects in the client runtime. The main interpretation is the separation between optional public-resource access and local analysis: once spectra and catalogs are available, review workflows can run without sending user spectra to a remote analysis service.*

Table 1 maps the principal workflows to their intended use, inputs, and outputs.

**Table 1. mSigSDK workflows.**

| Workflow | Intended use | Input requirements | Primary outputs |
|---|---|---|---|
| Public resource interoperability | Reuse compatible public reference and cohort resources outside a single portal session. | Internet access and supported public resources. | Resource access, spectra, signatures, and plots. |
| Single-sample review | Inspect a precomputed tumor spectrum before biological interpretation or sharing. | One SBS96 spectrum and a compatible reference catalog. | Burden, context coverage, fitted exposures, reconstruction, residuals, uncertainty, and report-ready summaries. |
| Small-cohort review | Compare spectra and fitted exposures across a cohort or metadata-defined groups. | Sample-by-context spectra and optional sample metadata. | Similarity structure, group summaries, exposure comparisons, and cohort-level fit-quality summaries. |
| Panel/WES review | Summarize whether fitted signatures are assessable in restricted genomic territory. | Panel or exome spectra, reference signatures, and optional callable opportunities. | Opportunity-normalized fits, callable-territory evidence, expected fitted signature mutation counts, and review evidence tiers. |
| Teaching and static review pages | Share reproducible examples without requiring each reader to install R or Python packages. | Archived spectra, fixed parameters, and a browser or web notebook. | Interactive plots, structured reports, and copy/paste tables. |
| Exploratory discovery | Screen browser-sized cohorts for possible signatures before handoff to production extraction tools. | Moderate sample-by-context spectra with adequate burden and a prespecified rank range. | NMF profiles, exposure heatmaps, rank diagnostics, and reference matches. |

*Note. The SDK is designed for interactive review, visualization, and lightweight local analysis of precomputed mutational spectra. Workflow-specific scope details are stated in the corresponding subsections below.*

### Shared data structures

Three matrix forms are used across the SDK [16]. Sample spectra are nested objects keyed by sample name and mutation context; reference signatures are nested objects keyed by signature name and context; and exposures are nested objects keyed by sample name and signature name. The SBS96 basis follows the pyrimidine-centered COSMIC convention [6,16].

Most high-level functions return a structured result object that includes `schemaVersion`, `workflow`, `workflowRole`, `scopeStatement`, `methodBasis`, `primaryInterpretationFields`, `parameters`, `validation`, `qc`, `fit` or `extraction` or `panel`, `fitQualityEvidence` where applicable, `warnings`, `recommendedActions`, `publicationFigures`, and `provenance` fields [16].

### Data access and matrix conversion

Public data retrieval is exposed through `mSigPortal.mSigPortalData`, with retrieval helpers for signatures, spectra, activities, associations, etiologies, and landscape outputs [16]. Long-form API rows are converted into nested matrix objects through `extractMutationalSpectra`.

MAF-like local rows are converted to SBS96 matrices with `userData.convertMatrix` after field validation through `validation.validateMafRows`. Context assignment can use sequence retrieval from the UCSC Genome Browser sequence API (`https://api.genome.ucsc.edu/getData/sequence`) for the selected genome build or an offline context lookup table supplied to the conversion workflow. The `analyzeMafFiles` workflow records genome build, context source, lookup mode, API endpoint when used, fetch timestamp, cache status, and count-reconciliation checks in provenance metadata, and emits a `CONTEXT_FETCH_FAILED` warning when the observed SBS96 count does not match the expected convertible SNV count. For strict offline or high-throughput use, analysts can pre-compute SBS96 matrices externally, supply a context lookup table, or import spectra directly through `validation.rowsToSampleSpectra` or the TSV import helpers.

Public API retrieval is remote; once spectra are imported, all downstream review runs locally. User mutation data therefore stay in the client runtime after import unless the user explicitly exports outputs.

### Validation and quality-control layer

Every refitting or extraction workflow begins with structured validation and QC before fitted exposures, uncertainty summaries, or reports are generated.

The `validation` namespace provides SBS96 context helpers, matrix normalization, long-form row conversion, and validators for spectra, signatures, exposures, and MAF rows [16]. `validateSpectra` checks shape, numeric validity, non-negativity, context coverage, empty spectra, and low-burden rows. `validateSignatureMatrix` and `validateExposureMatrix` provide the corresponding checks for catalogs and exposures. `assertValid` converts validator results into explicit gating behavior so pipelines stop on malformed input rather than silently proceeding.

The `qc` namespace adds mutation-burden summaries, missing-context analysis, exposure normalization, residual analysis, reconstruction-error summaries, threshold-sensitivity sweeps, and bootstrap uncertainty. `summarizeMissingContexts` distinguishes structurally missing contexts (a matrix-format problem, surfaced as `CONTEXT_MISMATCH`) from zero-count contexts (expected in low-burden SBS96 spectra). `calculateFitResiduals` and `calculateReconstructionError` evaluate observed-versus-reconstructed spectra using cosine, RMSE, MAE, L1/L2, residual sums, and related measures; high residual structure (relative unexplained fraction at least 0.07 and positive-residual cosine to any reference signature at least 0.85) triggers a `HIGH_RESIDUAL_STRUCTURE` warning with candidate pattern matches for descriptive review [8,15,16].

`runThresholdSensitivity` sweeps exposure thresholds across a configurable grid and summarizes exposure drift, active-signature counts, and reconstruction metrics across thresholds. `bootstrapSignatureFit` performs parametric multinomial resampling of an observed spectrum followed by repeated NNLS refitting to estimate confidence intervals and selection frequencies [5,8,10,16]. Manuscript examples use 200 replicates, 95% intervals, and seed 123.

The default low-burden threshold (50 mutations) is anchored to the SDK's own synthetic validation results (Table 4): at 50 mutations, mean exposure cosine was 0.912 and reconstruction cosine 0.884, improving to 0.952 and 0.930 by 100 mutations. Low-burden single-sample exposures are therefore summarized with bootstrap intervals in the manuscript workflows.

Table 3 lists the operational settings used for validation, refitting, uncertainty review, panel evidence, and exploratory NMF in the manuscript examples.

### Known-signature refitting

Known-signature refitting is provided by `signatureFitting.fitMutationalSpectraToSignatures` and the lower-level helper `qc.fitSpectraWithNNLS`. The model is coordinate-descent non-negative least squares refitting of each sample spectrum against a supplied catalog, followed by configurable thresholding and optional renormalization [1,8,13,14,15]. The NNLS formulation itself is standard. The novel aspects here are browser-native deployment, the structured solver metadata exposed alongside fitted exposures, and integration with the validation, QC, and uncertainty layer.

Convergence is declared when the summed coefficient change falls below 1e-10; the maximum iteration count per spectrum is max(100, 100 x number of reference signatures). Default post-fit behavior removes relative exposures below 0.01 and renormalizes the remainder. With `returnDetails: true`, the helper returns full solver metadata including `solverVariant = "coordinate_descent_nnls"`. The SDK reports signature-ambiguity flags and bootstrap selection frequencies alongside NNLS fits.

Fitted exposures and the spectra used to produce them can be exported to SigProfiler-style and COSMIC-style matrices for handoff to production extraction or assignment pipelines.

### Panel and exome review workflows

Panel/WES review is a distinct, browser-native interpretation surface designed for analysts and laboratories working with restricted assay territory. The workflow makes the operational distinction between "not detected" and "not assessable" explicit at the output level.

Callable-opportunity normalization uses context opportunities supplied with the analysis. For each SBS96 context, `callable_context_opportunity` is the number or fraction of trinucleotide sites callable in the panel, exome, or analysis territory, and `reference_context_opportunity` is the corresponding opportunity in the reference territory used for the input spectra or signatures. When reference opportunities are supplied, the SDK rescales each observed context count by `callable_context_opportunity / reference_context_opportunity` and renormalizes the adjusted spectrum to the observed mutation total. The assay-specific opportunity table itself must be derived from the target intervals, genome build, and callable-region definition outside the browser workflow.

The workflow returns expected fitted signature mutation counts, callable signature mass, signature ambiguity descriptors, fit-quality reporting mode, and a four-level evidence tier per signature: `higher_review_support`, `limited_review_support`, `not_detected_within_review_settings`, and `not_assessable`. A `not_assessable` label indicates insufficient burden or callable territory for a tier call [9,16].

### Exploratory NMF

Exploratory extraction is implemented in `signatureExtraction` [16]. `extractSignaturesNMF` decomposes sample spectra using multiplicative-update NMF minimizing Frobenius reconstruction error and reports reconstruction error, average sample cosine, convergence status, best run, and run-level metrics. Defaults are rank 5, up to 1,000 iterations, tolerance 1e-5, 20 random starts, and seed 123.

`selectNMFRank` evaluates a candidate rank grid (default ranks 2 to 8, 10 starts per rank) and can rank candidate solutions by lowest mean reconstruction error, highest cophenetic correlation from consensus clustering, or highest average silhouette. The selected criterion is recorded in the output so downstream reports can distinguish reconstruction-driven and stability-driven choices. These criteria support browser-sized exploratory screening, while discovery claims should still use production extraction workflows for stability analysis across more random starts and disease-specific validation [11]. `compareExtractedToReference` reports cosine matches between extracted and reference signatures for similarity screening.

`extractSignaturesNMFInWorker` offloads computation to a browser Web Worker when available, with a synchronous fallback.

### Interoperability

The `runners` and `adapters` namespaces separate three modes of interoperability: browser-native comparison, optional Pyodide package execution, and external handoff. `runners.pyodide.runPython(code, { inputs })` executes compatible Python code in a browser Web Worker and maps JSON-like outputs back into JavaScript objects. The SigProfilerAssignment adapter prepares matrix-mode input files from SDK spectra and signatures, can run SigProfilerAssignment v1.1.3 through Pyodide when browser package installation succeeds, collects output files, and parses exposure tables into nested JavaScript matrices. The MuSiCal-compatible refit path provides a browser-native sparse NNLS comparator on the same matrix orientation used by MuSiCal, with full package execution available only when a compatible wheel or preloaded worker environment is supplied. SigProfilerExtractor and deconstructSigs are supported as handoff workflows: the SDK writes canonical matrix files and executable Python or R snippets, then parses common signature and exposure output tables back into SDK matrices.

This design separates attribution engines from the review layer. mSigSDK can run its own standard NNLS and exploratory browser NMF, execute compatible Python packages when Pyodide supports them, or prepare matched handoff bundles for local/server execution while preserving one shared context order and provenance model.

### Experimental modules

Experimental functions are isolated under `mSigSDK.experimental`. The current namespace contains `runSubgroupDiscoveryWorkflow` and `runLocalizedMutagenesisAnalysis`. These functions emit console warnings, return `experimentalStatus` metadata, and include `scopeStatement` fields stating that outputs are descriptive and not validated for manuscript-grade discovery in this paper.

### Provenance and report validation

Reports are produced through `reports.createAnalysisReport`, which returns a structured object, JSON, or standalone HTML [16]. Submodules attach `methodBasis` fields that include short method descriptions, defaults, and references, and reports aggregate these into a methods and provenance section automatically. For example, a fitting workflow that uses `bootstrapSignatureFit` contributes `methodBasis` entries for NNLS, the bootstrap procedure, and the threshold settings; the report renders these as a single methods block with inline citations.

The `provenance` namespace attaches versioned provenance to analytical outputs through `createProvenance` and `withProvenance` helpers. For MAF-derived spectra, provenance fields include SDK version, genome build, context source, API endpoint, fetch timestamp, cache status, count-reconciliation result, and the parameters used in the workflow. A typical MAF provenance object therefore lets a downstream reviewer reconstruct exactly which genome build and which UCSC sequence response produced each context assignment.

Interoperability helpers in `io` include TSV import and export, SigProfiler-style matrix exchange (`exportSigProfilerMatrix`, `importSigProfilerMatrix`), COSMIC-style signature exchange (`exportCOSMICSignatureMatrix`, `importCOSMICSignatureMatrix`), and MuSiCal exchange helpers (`exportMuSiCalInput`, `importMuSiCalOutput`), enabling round-trip handoff with established R and Python pipelines without binding analysts to a closed internal format. A JSON Schema for the `createAnalysisReport` output is available in the repository and can be used to validate report objects programmatically.

### Algorithmic defaults used in manuscript workflows

Table 3 lists the settings used in the manuscript workflows and the corresponding output fields reviewed in the examples.

**Table 3. Algorithmic defaults used in manuscript workflows.**

| Component | Operational setting | Output used in review | Scope note |
|---|---|---|---|
| Input spectra | SBS96 sample-by-context matrices with finite numeric values; missing and extra contexts are reported against the expected context list. | Mutation burden, context completeness, empty-spectrum flags, and low-burden flags. | Applies after spectra have been generated or imported. |
| Known-signature refitting | Coordinate-descent NNLS with relative exposures below 0.01 removed and remaining exposures renormalized in manuscript workflows. | Fitted exposures for the supplied reference catalog. | Catalog refit to the supplied signatures. |
| Reconstruction and residuals | Observed and reconstructed spectra compared in relative scale using cosine similarity, cosine distance, RMSE, MAE, L1/L2 error, and maximum residual. | Fit-quality metrics and residual spectra. | Reviewed with burden, uncertainty, and ambiguity fields. |
| Bootstrap uncertainty | Parametric multinomial resampling with 95% intervals in manuscript examples. | Exposure means, medians, confidence intervals, and selection frequencies. | Intervals condition on the observed spectrum, supplied catalog, and fitting settings. |
| Threshold sensitivity | Relative exposure thresholds of 0, 0.01, 0.03, 0.05, and 0.10 in the manuscript examples. | Changes in active signatures, reconstruction cosine, and RMSE across thresholds. | Sensitivity analysis across stated cutoffs. |
| Signature ambiguity | Pairwise cosine at least 0.90 reported; high ambiguity = nearest-neighbor cosine at least 0.95 or entropy at least 0.92; moderate = at least 0.90 or 0.85. | Flags for exchangeable or broad reference signatures. | Highlights closely similar reference signatures. |
| Catalog sufficiency | Possible out-of-catalog signal is flagged at relative unexplained fraction at least 0.07, suspected at least 0.12, reconstruction cosine < 0.90, or structured positive residual cosine at least 0.85. | Residual patterns and recommended catalog review actions. | Supports catalog and disease-context review. |
| Fit-quality review labels | Low burden below 100 mutations and moderate burden below 1,000 by default. Labels summarize burden, reconstruction, residual, bootstrap, threshold, ambiguity, and catalog flags. | Reporting modes and underlying evidence fields. | Aggregates evidence while preserving component metrics. |
| Panel/WES evidence tiers | Min assessable burden 30 mutations; limited-support exposure threshold 0.05; higher-support threshold 0.20. Callable-opportunity maps user supplied. | `higher_review_support`, `limited_review_support`, `not_detected_within_review_settings`, or `not_assessable` per signature. | Not assessable indicates insufficient burden or callable territory for a tier call. |
| Exploratory NMF | Multiplicative-update NMF with fixed ranks or rank sweeps over browser-sized cohorts. Rank selection can use reconstruction error, cophenetic correlation, or average silhouette. | Extracted profiles, exposures, reconstruction metrics, run diagnostics, rank-selection criterion, and reference matches. | Browser-sized profile inspection and handoff support; production extraction remains preferred for discovery claims. |

*Note. Thresholds are configurable; the table lists settings used in the manuscript examples.*

---

## Results

Each Results subsection is tied to one of the three contributions and to a concrete user story.

### Browser-native cohort exploration (Contribution 1)

**User story: a portal developer or computational analyst importing public spectra into a browser-based notebook for cohort exploration.**

PCAWG Lung-AdenoCA SBS96 spectra were retrieved through `mSigPortal` helpers and reviewed in the browser before any refitting (Figure 2). The burden summary, similarity heatmap, similarity tree, and UMAP projection all surface the same low-burden outlier cluster, demonstrating that cohort structure and data quality are made visible as a first-class step rather than as a downstream plotting afterthought. Because the shared matrix format is used throughout the SDK, imported data passes from retrieval into validation, fitting, plotting, and export with no per-step format conversion.

*Figure 2. Browser-based cohort exploration of PCAWG Lung-AdenoCA SBS96 spectra. Mutation burden, SBS96 profile comparison, clustered cosine similarity heatmap, similarity tree, and UMAP projection are produced inline from the same imported matrix. The panels show that cohort-level QC and structure can be inspected before refitting, with the same low-burden outlier subcluster appearing across independent visual summaries.*

### Validation, QC, and uncertainty in practice (Contribution 2)

**User story: an analyst who needs to know which exposure estimates can be trusted before reporting them.**

A controlled synthetic experiment generated 64 SBS96 spectra at each of six mutation-burden levels from 50 to 2,500 mutations (384 spectra total) by drawing multinomially from linear mixtures of six COSMIC reference signatures, then refitting under the SDK's default NNLS settings (Table 4). Mean exposure-vector cosine rose from 0.912 (95% CI, 0.882 to 0.941) at 50 mutations to 0.996 (95% CI, 0.994 to 0.997) at 1,000 mutations, and false-positive inactive-signature calls (above the 5% threshold) fell from 0.165 to 0.027 over the same range. Low-burden spectra therefore carry wider bootstrap intervals and more frequent `LOW_BURDEN` flags, consistent with unconstrained NNLS distributing small positive coefficients across confusable signatures [13,14,15].

In the PCAWG Lung-AdenoCA cohort, the fit-quality reporting modes assigned by the warning-rule engine partition samples by the same burden, reconstruction, residual, and ambiguity signals tracked by the underlying evidence fields. Bootstrap interval widths narrow with burden, and threshold sensitivity remains stable above the 1% relative exposure cutoff (Figure 3).

*Figure 3. Burden-aware fit-quality review summaries, bootstrap uncertainty, threshold sensitivity, and low-burden stress testing for PCAWG Lung-AdenoCA spectra. The figure links warning-rule outputs to their underlying evidence fields: bootstrap intervals widen at lower burden, active signatures remain more stable above the 1% cutoff, and the low-burden stress test explains why restricted interpretation is assigned before confident exposure reporting.*

**Table 4. Controlled synthetic exposure-recovery validation.**

| Mutations per sample | Samples (n) | Exposure cosine, mean (95% CI) | Exposure MAE, mean (95% CI) | Active-signature recall, mean (95% CI) | Inactive-signature calls, mean (95% CI) | Reconstruction cosine, mean (95% CI) |
|---|---|---|---|---|---|---|
| 50 | 64 | 0.912 (0.882 to 0.941) | 0.065 (0.054 to 0.075) | 0.938 (0.903 to 0.972) | 0.165 (0.120 to 0.211) | 0.884 (0.862 to 0.906) |
| 100 | 64 | 0.952 (0.932 to 0.973) | 0.043 (0.034 to 0.051) | 0.979 (0.959 to 0.999) | 0.129 (0.085 to 0.173) | 0.930 (0.915 to 0.944) |
| 250 | 64 | 0.982 (0.973 to 0.990) | 0.027 (0.021 to 0.032) | 0.995 (0.985 to 1.000) | 0.082 (0.045 to 0.119) | 0.966 (0.959 to 0.973) |
| 500 | 64 | 0.993 (0.990 to 0.996) | 0.016 (0.013 to 0.020) | 1.000 (1.000 to 1.000) | 0.026 (0.006 to 0.046) | 0.982 (0.978 to 0.986) |
| 1,000 | 64 | 0.996 (0.994 to 0.997) | 0.013 (0.011 to 0.016) | 1.000 (1.000 to 1.000) | 0.027 (0.006 to 0.049) | 0.991 (0.988 to 0.993) |
| 2,500 | 64 | 0.998 (0.998 to 0.999) | 0.008 (0.006 to 0.010) | 1.000 (1.000 to 1.000) | 0.017 (0.001 to 0.033) | 0.996 (0.995 to 0.997) |

*Note. Known COSMIC SBS96 mixtures were generated from six reference signatures and refitted under default SDK settings. Active recall and inactive calls used a 5% exposure threshold. Confidence intervals are normal-approximation intervals across synthetic samples within each burden.*

### Confusable-signature stress testing (Contribution 2)

The synthetic validation was extended to mixtures designed to challenge point-estimate interpretation. A 384-spectrum benchmark generated SBS2/SBS13 mixtures at five exposure ratios and SBS5/SBS40/SBS3 mixtures at three exposure ratios, each at 50, 100, 250, 500, 1,000, and 2,500 mutations per spectrum. The SBS5/SBS40/SBS3 setting directly tested broad, flat signatures that the ambiguity screen classifies as high risk. The `SIGNATURE_AMBIGUITY` warning was raised for all 144 expected SBS5/SBS40/SBS3 spectra. The SBS2/SBS13 setting was not classified as high spectral ambiguity by the default cosine/entropy rule; low-burden false-positive ambiguity warnings in this setting disappeared as burden increased.

Reporting modes separated spectra by known-truth recovery. Across the 384 spectra, `standard_qc_passed` had the highest mean exposure cosine (0.999), followed by `report_with_caveats` (0.989) and `restricted_interpretation` (0.947). Empirical bootstrap coverage for active-signature 95% intervals was 0.895 at 50 mutations, 0.882 at 100 mutations, 0.934 at 250 mutations, 0.954 at 500 mutations, 0.941 at 1,000 mutations, and 0.941 at 2,500 mutations. The largest undercoverage occurred at 100 mutations, consistent with the low-burden boundary where sparse multinomial spectra make exposure intervals least stable.

**Table 4b. Reporting-mode operating characteristics and bootstrap coverage in confusable-signature mixtures.**

| Validation target | Level | Spectra or intervals (n) | Exposure cosine or coverage | Interpretation |
|---|---|---|---|---|
| Reporting mode | `standard_qc_passed` | 166 spectra | Mean exposure cosine 0.999 | Highest known-truth exposure recovery. |
| Reporting mode | `report_with_caveats` | 47 spectra | Mean exposure cosine 0.989 | Intermediate recovery with all spectra carrying ambiguity warnings. |
| Reporting mode | `restricted_interpretation` | 171 spectra | Mean exposure cosine 0.947 | Lowest recovery, consistent with low burden or restricted evidence. |
| Bootstrap coverage | 50 mutations | 152 active-signature intervals | 0.895 | Mild undercoverage at very low burden. |
| Bootstrap coverage | 100 mutations | 152 active-signature intervals | 0.882 | Largest deviation from the nominal 0.95 interval. |
| Bootstrap coverage | 250 mutations | 152 active-signature intervals | 0.934 | Near-nominal coverage. |
| Bootstrap coverage | 500 mutations | 152 active-signature intervals | 0.954 | Near-nominal coverage. |
| Bootstrap coverage | 1,000 mutations | 152 active-signature intervals | 0.941 | Near-nominal coverage. |
| Bootstrap coverage | 2,500 mutations | 152 active-signature intervals | 0.941 | Near-nominal coverage. |

*Note. The benchmark used SBS2/SBS13 mixtures and SBS5/SBS40/SBS3 mixtures generated from COSMIC SBS96 signatures. Reporting modes were assigned by `computeFitQualityEvidence`, and coverage was calculated from 200 bootstrap refits per spectrum.*

### Numerical correctness and cross-tool concordance (Contribution 2)

**User story: a methods developer or reviewer who needs to verify that the browser-native solver reproduces standard NNLS behavior.**

Four validation layers were used (Table 5). Against an independent R NNLS solver on the same inputs, mean exposure-vector cosine was 1.000 and the maximum absolute exposure difference was 4.79e-10, confirming that the coordinate-descent implementation reproduces the standard NNLS solution to numerical precision. Against deconstructSigs v1.8.0 [17] on 38 cached PCAWG Lung-AdenoCA spectra with a shared nine-signature COSMIC catalog and matched 1% cutoff, mean exposure-vector cosine between tools was 0.997 (minimum 0.988), 36 of 38 samples shared the top fitted signature, and mean reconstruction cosine was 0.982 for both tools. SigProfilerAssignment v1.1.3 [18], run on the same spectra and custom nine-signature database through the SDK's matrix-mode Pyodide adapter, had mean exposure cosine 0.907 relative to mSigSDK and shared the top fitted signature in 29 of 38 samples. MuSiCal SparseNNLS [14], represented through the SDK's MuSiCal-compatible sparse refit comparator, had mean exposure cosine 0.973 and shared the top fitted signature in 37 of 38 samples.

The two samples with deconstructSigs-vs-mSigSDK top-signature disagreement were SP50317 and SP52284. In SP50317, mSigSDK and MuSiCal selected SBS13, whereas deconstructSigs and SigProfilerAssignment selected SBS40. In SP52284, mSigSDK, SigProfilerAssignment, and MuSiCal selected SBS5, whereas deconstructSigs selected SBS40. Both disagreements involved SBS40 or SBS5, the high-entropy signatures flagged by `computeSignatureAmbiguity`. The ambiguity flag therefore identified the spectra where tool rankings diverged, but it did not predict MuSiCal-vs-NNLS disagreement in these two samples; MuSiCal agreed with mSigSDK in both cases.

**Table 5. Independent NNLS check and cross-tool concordance on shared PCAWG Lung-AdenoCA spectra.**

| Validation layer | Data and comparator | Main result | Supported conclusion |
|---|---|---|---|
| Numerical NNLS check | Same manuscript refitting inputs; independent R NNLS implementation. | Mean exposure-vector cosine 1.000; maximum absolute exposure difference 4.79e-10. | The SDK solver reproduces the standard NNLS solution to numerical precision. |
| deconstructSigs concordance | 38 PCAWG Lung-AdenoCA WGS SBS96 spectra; nine COSMIC SBS96 signatures; deconstructSigs v1.8.0. | Mean exposure cosine 0.997; median 0.998; minimum 0.988; 36 of 38 samples shared the top signature. | mSigSDK and deconstructSigs produce closely aligned exposures under matched inputs and cutoffs. |
| SigProfilerAssignment concordance | Same spectra and catalog; SigProfilerAssignment v1.1.3 with a custom nine-signature database. | Mean exposure cosine 0.907; median 0.937; minimum 0.556; 29 of 38 samples shared the top signature. | The assignment framework agrees for most spectra, with larger differences under its sparse assignment procedure. |
| MuSiCal SparseNNLS concordance | Same spectra and catalog; MuSiCal SparseNNLS from the Park Lab implementation. | Mean exposure cosine 0.973; median 0.997; minimum 0.855; 37 of 38 samples shared the top signature. | Sparse likelihood-based assignment remains close to mSigSDK for most spectra and provides a direct ambiguity comparator. |
| Reconstruction concordance | Same spectra and catalog. | Mean reconstruction cosine: mSigSDK 0.982, deconstructSigs 0.982, SigProfilerAssignment 0.974, MuSiCal 0.981. | All reconstruction metrics are computed against the same observed spectra and selected catalog. |
| Ambiguity-disagreement profile | Same 38 spectra. | SP50317 split SBS13 versus SBS40; SP52284 split SBS5 versus SBS40. MuSiCal agreed with mSigSDK in both cases. | Ambiguity flags identify cross-tool rank instability, but were not predictive of MuSiCal-vs-NNLS top-signature disagreement in these two samples. |

*Note. All comparators used the same 38-sample SBS96 matrix and the same nine COSMIC SBS96 reference signatures. mSigSDK, deconstructSigs, SigProfilerAssignment, and MuSiCal exposure vectors were thresholded at 1% relative exposure and renormalized before cosine comparison. deconstructSigs used R 4.1.1; SigProfilerAssignment was run with matrices written in canonical SBS96 order; MuSiCal used SparseNNLS from the Park Lab implementation.*

Selected PCAWG Lung-AdenoCA samples were refitted to nine COSMIC SBS96 reference signatures with the same workflow (Figure 4). No sample had structured positive residuals with cosine at least 0.85 to an out-of-catalog reference signature, supporting catalog sufficiency under the selected catalog. All 38 samples achieved reconstruction cosine at least 0.96.

*Figure 4. Local NNLS refitting against nine COSMIC SBS96 reference signatures for 38 PCAWG Lung-AdenoCA spectra. The exposure heatmap, exposure summary for the highest-burden sample, reconstruction-quality summary, and a representative residual spectrum collectively show SBS4 (tobacco) and SBS2/SBS13 (APOBEC) as the dominant fitted signatures and low residual magnitude across the cohort.*

### Restricted-assay interpretation (Contribution 2)

**User story: a laboratory or analyst reviewing panel or exome data who needs to know which fitted signatures are assessable under the assay's callable territory.**

The same review framework was applied to restricted-assay spectra generated from PCAWG Lung-AdenoCA WGS profiles with `createWGStoPanelValidationPairs` (Figure 5). Callable-context masks retained the top 24, 48, or 72 SBS96 contexts by aggregate WGS burden, and each retained spectrum was scaled to 25, 75, 200, or 1,000 panel mutations. The panel workflow returned expected fitted signature mutation counts, callable signature mass, fit-quality reporting mode, and the four-level evidence tier per signature. Overall tier accuracy increased with callable context breadth, from 0.629 for the 24-context mask to 0.741 for the 48-context mask and 0.846 for the 72-context mask; mean panel-vs-WGS exposure cosine increased from 0.813 to 0.899 and 0.959 across the same masks. At 25 panel mutations, the expected `not_assessable` tier was recovered for all exposure strata, separating assay-burden limitations from fitted exposure summaries.

*Figure 5. Cohort and panel workflows. Metadata-stratified exposure comparison for 18 selected PCAWG Lung-AdenoCA samples is paired with a panel evidence matrix generated from PCAWG-derived callable-context downsampling, a fit-quality reporting-mode summary, and a subgroup extraction/refit summary. The panel view shows that exposure estimates and evidence tiers must be interpreted together with callable territory and assessable burden.*

### Browser-sized exploratory extraction (Contribution 1)

**User story: an analyst who wants a rapid local NMF preview of cohort spectra before committing to a production extraction run.**

A browser-sized PCAWG Lung-AdenoCA subset was decomposed by NMF over candidate ranks 2 to 8 (Figure 6). The manuscript example used lowest mean reconstruction error as the rank-selection criterion, and the output records that criterion alongside the selected rank. The SDK also supports cophenetic correlation and average silhouette as alternative rank-selection criteria for browser-sized stability screening. At the selected rank, the extracted profiles matched COSMIC tobacco- and APOBEC-associated reference signatures by cosine. SigProfiler-style matrix export supports downstream production extraction and assignment workflows.

*Figure 6. Exploratory browser-side NMF extraction for a PCAWG Lung-AdenoCA subset. The panels show extracted SBS96 profiles, sample-by-extracted-signature exposures, rank-selection diagnostics over ranks 2 to 8, and top reference-signature cosine matches. The figure is intended as a browser-side preview and handoff aid: extracted profiles can be inspected quickly, but discovery claims require production extraction and stability analysis across more random starts.*

### Interactive performance

Browser and Node.js computation runs with deterministic synthetic SBS96 matrices measured whether the reviewed workflows are compatible with interactive use (Table 6). In Chrome 148, single-sample WGS refitting against 24 signatures ran in a median of 1.2 ms, the 24-sample panel/WES workflow ran in 21.6 ms, a 120-sample cohort workflow ran in 253.7 ms, and a 300-sample, 40-signature portal-scale refit ran in 298.9 ms. NMF rank selection took 576.0 ms on 30 samples and 2.88 s on 80 samples, supporting the use of `extractSignaturesNMFInWorker` for larger exploratory cohorts in production browser deployments. Firefox was requested by the benchmark runner but was not installed in the local execution environment; the harness records this as an unavailable-browser result and remains browser-native for Chrome, Firefox, and Safari execution.

**Table 6. Scenario-calibrated local compute summary.**

| Scenario | Workflow step | Samples and settings | Chrome median (range) | Node.js median (range) |
|---|---|---|---|---|
| Single-sample WGS review | Known-signature refitting | 1 sample; 5,000 mutations/sample; 24 signatures | 1.2 ms (1.1 to 5.5) | 6.7 ms (0.5 to 7.6) |
| Single-sample WGS review | Bootstrap uncertainty | 1 sample; 500 iterations; 24 signatures | 391.8 ms (373.5 to 470.0) | 337.2 ms (328.4 to 415.3) |
| Small panel/WES batch | Full panel/WES review workflow | 24 samples; 80 mutations/sample; 12 signatures | 21.6 ms (21.4 to 22.2) | 25.6 ms (24.0 to 30.5) |
| Medium research cohort | Cohort fit workflow | 120 samples; 1,200 mutations/sample; 24 signatures | 253.7 ms (252.0 to 279.2) | 253.2 ms (247.0 to 270.8) |
| Portal-scale cohort review | Known-signature refitting | 300 samples; 1,500 mutations/sample; 40 signatures | 298.9 ms (294.2 to 358.1) | 232.3 ms (223.9 to 256.1) |
| Exploratory discovery cohort | NMF rank selection | 30 samples; ranks 2, 3, and 4; 75 iterations | 576.0 ms (556.7 to 611.0) | 491.2 ms (477.4 to 595.1) |
| Medium exploratory discovery cohort | NMF rank selection | 80 samples; ranks 2, 3, and 4; 75 iterations | 2.88 s (2.52 to 2.90) | 2.15 s (2.05 to 2.17) |

*Note. Deterministic synthetic SBS96 matrices were run with the standalone browser benchmark harness in Chrome 148.0.7778.167 using `performance.now()` with three repeats, and with Node.js v16.16.0 using five repeats on Windows x64, Intel Core i7-11700K, 16 GB RAM. Browser memory used `performance.memory.usedJSHeapSize`; `performance.measureUserAgentSpecificMemory()` was not exposed in this Chrome run. Firefox was requested by the runner but no Firefox executable was available in the local environment.*

---

## Discussion

### Three contributions in light of the results

mSigSDK is presented as a workflow-integration layer for browser-native mutational-signature review and reporting, not as a new attribution algorithm. The results support each of the three contributions stated in the Background.

1. The modular browser-native architecture (Contribution 1) was illustrated by an end-to-end cohort exploration of PCAWG Lung-AdenoCA spectra (Figure 2), browser-local refitting against COSMIC catalogs (Figure 4), interactive single-step latency below 355 ms even for 300-sample portal-scale refits (Table 6), and exploratory NMF screening with direct handoff to SigProfiler-style matrices (Figure 6). The same nested-matrix objects flowed through every layer without per-step format conversion.

2. The structured validation, QC, and uncertainty layer (Contribution 2) was anchored to a controlled synthetic benchmark in which exposure-vector cosine rose from 0.912 at 50 mutations to 0.996 at 1,000 mutations and false-positive inactive-signature calls fell from 0.165 to 0.027 (Table 4). Confusable-signature stress testing showed the expected ordering of reporting modes on known truth, with `standard_qc_passed` outperforming `report_with_caveats`, which outperformed `restricted_interpretation` (Table 4b). The same layer flagged the two discordant samples in the cross-tool concordance test as high-ambiguity, demonstrating that the QC layer adds interpretive value on top of established refitting tools while preserving the underlying evidence fields.

3. The provenance-aware reporting and interoperability layer (Contribution 3) connects the SDK to mSigPortal resources, SigProfiler-style matrices, COSMIC catalogs, SigProfilerAssignment through Pyodide, MuSiCal-compatible refit review, SigProfilerExtractor and deconstructSigs handoffs, and JSON Schema validation. For MAF-derived spectra, provenance records the genome build, context lookup mode, UCSC sequence endpoint when used, fetch timestamp, cache status, and count-reconciliation result. Reports aggregate `methodBasis` entries from the active subsystems into a single methods and provenance block with inline citations.

Although mSigSDK interoperates with mSigPortal for public resources, its primary contribution is the browser-native analysis layer; validation, refitting, QC, uncertainty review, panel workflows, and reporting operate independently of any particular portal instance.

The same browser-native design supports embedded notebooks and teaching contexts. The repository includes runnable notebook pages for QC review, uncertainty thresholds, NMF extraction, report export, and resource portability, allowing readers to inspect the same structured outputs used in the manuscript without installing a local R or Python stack. These notebooks also provide a practical template for portal developers who need reproducible review panels around precomputed spectra.

Table 7 positions mSigSDK relative to related mutational-signature tools and platforms.

**Table 7. Functional positioning relative to related mutational-signature software.**

| Tool or platform | Primary role | Browser execution | Interoperability with mSigSDK | QC/reporting layer |
|---|---|---|---|---|
| mSigSDK | Browser-native review SDK for spectra import, validation, NNLS refitting, QC, panel review, exploratory NMF, interoperability, and reporting. | Yes, JavaScript core; optional Pyodide for compatible Python packages. | Native nested matrices plus SigProfiler, COSMIC, MuSiCal-compatible, and report JSON Schema formats. | Structured warnings, fit-quality evidence, recommended actions, figures, and provenance. |
| mSigPortal | Public mutational-signature portal and API. | Portal hosted. | mSigSDK retrieves public mSigPortal spectra and signatures and reuses selected plotting conventions. | Portal-specific. |
| SigProfilerExtractor | Production de novo extraction and stability analysis. | Not browser-native by default. | mSigSDK prepares SigProfiler-compatible matrix input and Python handoff snippets and parses common output tables. | Extraction stability diagnostics in the external tool; mSigSDK supplies downstream review/reporting. |
| deconstructSigs | R-based known-signature decomposition for individual tumors. | Not browser-native. | mSigSDK exports compatible spectra/signature TSVs and parses sample-by-signature exposure tables. | Limited in the external package; mSigSDK adds QC, uncertainty, and report fields. |
| SigProfilerAssignment | Known-signature assignment to samples and mutations. | Optional browser execution through Pyodide matrix-mode runs when package installation and dependencies succeed; local Python remains the production path. | mSigSDK prepares matrix-mode input, can run compatible Pyodide sessions, and parses exposure outputs. | Assignment diagnostics from the package plus mSigSDK fit-quality review. |
| MuSiCal | Sparse likelihood-based mutational-signature refitting and discovery. | Package execution depends on Pyodide-compatible wheels; mSigSDK includes a browser-native MuSiCal-compatible sparse NNLS comparator. | mSigSDK exports/imports MuSiCal-style matrices and compares sparse refits on the same spectra/catalog. | MuSiCal metrics from the external tool or comparator plus mSigSDK ambiguity and reporting fields. |

*Note. The comparison is functional and does not claim tool superiority.*

### Intended use and users

mSigSDK is positioned for four user groups. Portal and web-application developers can embed the SDK into web notebooks, dashboards, or teaching pages without requiring an R or Python environment on the reader's machine. Computational analysts can produce shareable, interactive review artifacts that travel with their parameters, citations, and provenance. Laboratories working with panel or exome assays can communicate exposure results with explicit "not detected" versus "not assessable" semantics. Methods developers can attach their own algorithms to a standard browser-native review surface that already handles validation, QC, uncertainty, and reporting.

### Limitations

mSigSDK does not introduce a new attribution algorithm; it relies on standard NNLS and multiplicative-update NMF. Plain NNLS may over-assign confusable signatures relative to sparse likelihood-based methods such as MuSiCal [13,14,15]; the SDK flags high-ambiguity signature pairs and surfaces discordant bootstrap selection frequencies, but does not apply a sparse prior. Rank selection in `selectNMFRank` now supports reconstruction error, cophenetic correlation, and average silhouette, but browser-sized rank selection should remain a screening result rather than a definitive discovery claim. MAF-to-context conversion can use row-supplied contexts, a caller-supplied offline lookup table, or bundled sparse lookup assets for hg19, hg38, and T2T-CHM13 smoke testing; full genome-wide offline tables remain better supplied as project-specific assets because of size and coordinate-convention requirements. Browser memory and runtime constraints limit cohort size for fully synchronous workflows, motivating the optional Web Worker mode. Panel and exome opportunity tables must be derived externally from the assay target intervals, genome build, and callable-region definition. Localized mutagenesis and subgroup-discovery pipelines are available under `mSigSDK.experimental`; they are not validated in this manuscript.

### Future work

Planned extensions include broader end-to-end support for additional context families (DBS, ID), empirical calibration of panel evidence-tier boundaries against assay-level performance data, production-scale packaged genome-context lookup assets, and benchmark capture on additional installed browser engines.

---

## Methods

### Software availability

mSigSDK is available at `https://episphere.github.io/msig/main.js` under an open license. The manuscript analysis workspace, cached data, and benchmark scripts are archived in the associated repository [16].

### Data

PCAWG Lung-AdenoCA SBS96 spectra were retrieved from mSigPortal via `mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData`. COSMIC SBS96 reference signatures were retrieved via `getMutationalSignaturesData`. A snapshot of 38 spectra used for cross-tool concordance testing is archived in the manuscript workspace.

### Synthetic validation

Synthetic SBS96 spectra were generated as multinomial draws from linear mixtures of COSMIC reference signatures selected to span diverse trinucleotide profiles. The primary burden benchmark generated two- or three-signature mixtures with randomly sampled exposure vectors; 64 spectra were generated per mutation-burden level with a fixed seed. A separate confusable-signature benchmark generated SBS2/SBS13 mixtures and SBS5/SBS40/SBS3 mixtures at fixed exposure ratios, six burden levels, and eight replicate spectra per ratio-burden cell. Refitting used the SDK's coordinate-descent NNLS solver with a 1% threshold and renormalization. Bootstrap coverage used 200 bootstrap refits per spectrum in the confusable-signature benchmark.

### Cross-tool concordance

deconstructSigs v1.8.0 was run in R 4.1.1 on the same 38 cached PCAWG Lung-AdenoCA SBS96 spectra and the same nine-signature COSMIC SBS96 catalog used in the manuscript refitting example. SigProfilerAssignment v1.1.3 was run with a custom nine-signature database written in canonical SBS96 order to match the package's input reindexing behavior. MuSiCal SparseNNLS was run from the Park Lab MuSiCal implementation. All comparator exposure vectors used a 1% relative-exposure cutoff followed by renormalization before cosine comparison.

### Performance benchmarks

Timings used deterministic synthetic SBS96 matrices sized to each scenario, excluding plot rendering. Node.js timings used five repeats on Windows x64 with Node.js v16.16.0, Intel Core i7-11700K, and 16 GB RAM. Browser timings used the standalone harness in Chrome 148.0.7778.167 with three repeats and `performance.now()`. Browser memory was recorded with `performance.measureUserAgentSpecificMemory()` where available or `performance.memory.usedJSHeapSize` where exposed; Firefox execution was requested but no local Firefox executable was available in the verification environment.

---

## References

1. Lawson CL, Hanson RJ. Solving Least Squares Problems. SIAM; 1995. doi:10.1137/1.9781611971217
2. Alexandrov LB, et al. Signatures of mutational processes in human cancer. Nature. 2013;500:415 to 421. doi:10.1038/nature12477
3. Roberts SA, et al. An APOBEC cytidine deaminase mutagenesis pattern is widespread in human cancers. Nat Genet. 2013;45:970 to 976. doi:10.1038/ng.2702
4. Wilkinson MD, et al. The FAIR Guiding Principles for scientific data management and stewardship. Sci Data. 2016;3:160018. doi:10.1038/sdata.2016.18
5. Huang X, Wojtowicz D, Przytycka TM. Detecting presence of mutational signatures in cancer with confidence. Bioinformatics. 2018;34:330 to 337. doi:10.1093/bioinformatics/btx604
6. Alexandrov LB, et al. The repertoire of mutational signatures in human cancer. Nature. 2020;578:94 to 101. doi:10.1038/s41586-020-1943-3
7. Degasperi A, et al. Substitution mutational signatures in whole-genome sequenced cancers in the UK population. Nat Cancer. 2020;1:1191 to 1203. doi:10.1038/s43018-020-0027-5
8. Koh G, Degasperi A, Zou X, Momen S, Nik-Zainal S. Mutational signatures: emerging concepts, caveats and clinical applications. Nat Rev Cancer. 2021;21:619 to 637. doi:10.1038/s41568-021-00377-7
9. Lawrence EM, et al. Mutational signatures in clinical practice: challenges and opportunities. Arch Pathol Lab Med. 2021;145:1455 to 1467. doi:10.5858/arpa.2020-0536-OA
10. Senkin S, et al. MSA: reproducing mutational signature assignment in cancer genomes. BMC Bioinformatics. 2021;22:626. doi:10.1186/s12859-021-04450-8
11. Islam SMA, et al. Uncovering novel mutational signatures by de novo extraction with SigProfilerExtractor. Cell Genomics. 2022;2:100179. doi:10.1016/j.xgen.2022.100179
12. Manders F, Brandsma AM, de Kanter J, et al. MutationalPatterns: the one stop shop for the analysis of mutational processes. BMC Genomics. 2022;23:134. doi:10.1186/s12864-022-08357-3
13. Wu YC, et al. Quantifying mutational heterogeneity across cancer types and its relationship with clinical outcomes. Brief Bioinform. 2023;24:bbad331. doi:10.1093/bib/bbad331
14. Jin H, Gulhan DC, Geiger B, et al. Accurate and sensitive mutational signature analysis with MuSiCal. Nat Genet. 2024;56:541 to 552. doi:10.1038/s41588-024-01659-0
15. Medo M, Ng CKY, Medova M. A comprehensive comparison of tools for fitting mutational signatures. Nat Commun. 2024;15:9467. doi:10.1038/s41467-024-53711-6
16. mSigSDK source repository and documentation. https://episphere.github.io/msig/
17. Rosenthal R, McGranahan N, Herrero J, Taylor BS, Swanton C. DeconstructSigs: delineating mutational processes in single tumors distinguishes DNA repair deficiencies and patterns of carcinogen exposure with clinical implications. Genome Biol. 2016;17:31. doi:10.1186/s13059-016-0893-4
18. Diaz-Gay M, Vangara R, Barnes M, et al. Assigning mutational signatures to individual samples and individual somatic mutations with SigProfilerAssignment. Bioinformatics. 2023;39:btad756. doi:10.1093/bioinformatics/btad756
