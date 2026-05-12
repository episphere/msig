# mSigSDK Manuscript Revision Package

This file gathers draft manuscript language, figure plans, captions, and tables for the revised software paper. It is intended to be copied into the manuscript source once the editable manuscript file is available.

## Revised Positioning

The revised manuscript should present mSigSDK as a browser-native JavaScript SDK for mutational signature data access, visualization, local fitting, quality control, uncertainty analysis, reporting, and exploratory signature extraction. This is more precise and defensible than describing the package broadly as "private computation of mutation signatures."

Suggested one-sentence positioning:

> mSigSDK is a browser-native JavaScript SDK that integrates public mutational signature resources with local analysis of user-supplied spectra, including signature fitting, quality control, uncertainty analysis, exploratory NMF extraction, reporting, and reproducible Observable workflows.

## Revised Abstract Draft

**Background:** Mutational signature analysis is widely used to interpret the biological processes that shape cancer genomes, but practical workflows often require a mixture of public reference resources, command-line tools, local data transformations, and custom plotting code. Browser-based tools can improve accessibility and reproducibility, but software papers describing these tools must clearly distinguish public data retrieval, local computation, visualization, and privacy boundaries.

**Results:** We present mSigSDK, a browser-native JavaScript software development kit for mutational signature analysis. mSigSDK provides modular ECMAScript interfaces to mSigPortal and TCGA resources while supporting local analysis of user-supplied mutation spectra. The SDK includes helpers for MAF and matrix conversion, non-negative least-squares signature fitting, mutation burden checks, expected-context validation, missing-context summaries, zero-exposure handling, reconstruction metrics, observed-versus-reconstructed residual plots, bootstrap confidence intervals, threshold sensitivity analysis, import/export utilities, provenance metadata, and report generation. For exploratory de novo workflows, mSigSDK also implements browser-side non-negative matrix factorization with rank diagnostics, extracted signature profiles, reference-signature matching, and exposure heatmaps. Domain-standard mutational spectrum plots reuse mSigPortal/COSMIC-style rendering, while SDK-specific QC and uncertainty summaries are implemented as reusable D3 visualizations. Focused Observable notebooks demonstrate known-signature fitting, QC, uncertainty analysis, NMF extraction, and report/export workflows.

**Conclusions:** mSigSDK complements existing mutational signature pipelines by providing an interoperable browser layer for public resource access, local interactive analysis, quality-control visualization, uncertainty assessment, and reproducible reporting. Its browser-side computation is designed for interactive and moderate-sized research workflows; large-scale production extraction remains better suited to dedicated computational pipelines.

## Execution-Locus Table

| Capability | Computed locally in browser? | External API dependency | Privacy implication |
|---|---:|---|---|
| mSigPortal reference signature retrieval | No | mSigPortal | Public reference data only |
| mSigPortal cohort exploration | No/partial | mSigPortal | Public or portal-hosted cohort summaries |
| TCGA/GDC data helpers | No/partial | TCGA/GDC endpoints | Public controlled by upstream source availability |
| User MAF parsing and spectrum conversion | Yes | None | User file can remain local |
| Expected-context validation | Yes | None | Local |
| Mutation burden summaries | Yes | None | Local |
| Missing-context summaries | Yes | None | Local |
| NNLS known-signature fitting | Yes | Optional reference-signature fetch | User spectra can remain local |
| Zero-exposure handling and thresholding | Yes | None | Local |
| Reconstruction cosine similarity and RMSE | Yes | None | Local |
| Observed-vs-reconstructed residual data | Yes | None | Local |
| Mutational spectrum rendering | Yes | Reuses mSigPortal plotting components | Local rendering of supplied data |
| Bootstrap exposure confidence intervals | Yes | None | Local; runtime scales with iterations |
| Threshold sensitivity analysis | Yes | None | Local; runtime scales with threshold grid |
| NMF signature extraction | Yes | None | Local; intended for exploratory moderate-sized datasets |
| NMF rank diagnostics | Yes | None | Local |
| Extracted-signature reference matching | Yes | Optional reference-signature fetch | User-derived signatures can remain local |
| Import/export helpers | Yes | None | Local |
| Provenance and report generation | Yes | None | Local |
| Observable notebooks | Yes | Optional public data/API calls | Reproducible browser workflows |

## Figure 1 Plan

Draft SVG: `docs/manuscript/figures/figure1-architecture.svg`

**Title:** mSigSDK architecture and browser privacy boundary

Panel A: Inputs

- mSigPortal public APIs
- TCGA/GDC resources
- user MAF files
- user-provided spectra or signature matrices
- Observable notebooks and browser applications

Panel B: SDK layers

- data access: `mSigPortal`, `TCGA`
- input handling: `io`, user data conversion
- validation: expected contexts, non-negative counts, matrix coverage
- fitting/QC: NNLS fitting, mutation burden, missing contexts, reconstruction metrics, residuals
- uncertainty: bootstrap confidence intervals, threshold sensitivity
- extraction: NMF, rank selection, reference matching
- visualization: mSigPortal/COSMIC-style spectrum plots plus D3 QC plots
- reporting: reports, provenance, export helpers

Panel C: Workflow outputs

- exposure tables
- residual plots
- QC dashboards
- NMF signatures and exposures
- exportable matrices
- HTML/JSON reports
- notebook examples

Panel D: Privacy boundary

- public APIs provide reference/cohort data
- user data analysis can run inside the browser
- reports and exports are generated locally unless the user chooses to share them

Draft caption:

> **Figure 1. Browser-native architecture of mSigSDK.** Public mSigPortal and TCGA resources can be retrieved through SDK data-access modules, while user-supplied MAF files and mutation spectra can be converted, validated, fitted, quality-controlled, and reported locally in the browser. The SDK separates public API access from local computation and provides reusable modules for known-signature fitting, QC, uncertainty analysis, exploratory NMF extraction, visualization, import/export, and provenance.

## Figure 2 Plan

Draft SVG: `docs/manuscript/figures/figure2-qc-dashboard.svg`

**Title:** Quality-control dashboard for known-signature fitting

Panel A: Mutation burden and missing-context validation

- sample-level burden plot
- user-defined low-burden threshold
- context completeness summary

Panel B: Known-signature fitting

- NNLS exposure summary
- zero-exposure handling and thresholded active signatures

Panel C: Reconstruction quality

- cosine similarity and RMSE
- samples sorted by reconstruction quality

Panel D: Observed vs reconstructed profile

- mSigPortal/COSMIC-style SBS96 comparison
- residual structure visible by mutation class/context

Panel E: Bootstrap exposure uncertainty

- exposure distribution by signature
- confidence interval
- mean exposure
- selection frequency

Panel F: Threshold sensitivity

- average cosine similarity, RMSE, and active signature count across thresholds
- signed drift from baseline
- instability score

Draft caption:

> **Figure 2. Quality-control and uncertainty diagnostics for known-signature fitting.** mSigSDK converts known-signature fitting from a single exposure estimate into an auditable workflow. The SDK reports mutation burden and matrix coverage, local NNLS exposures, reconstruction quality, residual spectrum structure, bootstrap confidence intervals, and threshold sensitivity. These diagnostics help identify low-burden samples, poorly reconstructed spectra, unstable exposure calls, and threshold-dependent interpretations.

## Figure 3 Plan

Draft SVG: `docs/manuscript/figures/figure3-nmf-extraction.svg`

**Title:** Exploratory browser-side NMF extraction

Panel A: NMF workflow

- spectra matrix
- candidate ranks
- repeated NMF runs
- selected rank
- extracted signatures and exposures

Panel B: Rank diagnostics

- reconstruction error versus rank
- average sample cosine similarity versus rank

Panel C: Extracted signature profiles

- SBS96 signature profiles rendered with mSigPortal-style mutational spectrum plotting

Panel D: Reference matching

- extracted signatures compared with COSMIC or mSigPortal reference signatures by cosine similarity

Panel E: Exposure heatmap

- sample-by-signature exposure matrix

Draft caption:

> **Figure 3. Browser-side exploratory signature extraction.** mSigSDK implements non-negative matrix factorization for moderate-sized browser workflows, with repeated runs, rank diagnostics, extracted signature profiles, reference-signature matching, and sample exposure heatmaps. This workflow is intended for interactive exploration and teaching-scale analyses rather than replacement of high-throughput production extraction pipelines.

## Methods Section Draft Outline

### Software architecture

mSigSDK is distributed as a JavaScript ES module with a single public entry point and modular namespaces for data access, validation, fitting, QC, visualization, extraction, reporting, and workflows. This design allows the SDK to be imported into static websites, Observable notebooks, and browser applications without a dedicated backend.

### Public resource integration

The SDK provides wrappers for mSigPortal and TCGA/GDC-related resources. These modules retrieve public reference signatures, cohort summaries, and compatible data structures. API-dependent operations are explicitly separated from local operations so that user-supplied spectra can be analyzed without uploading private mutation data to an external analysis service.

### User data ingestion and validation

User-supplied mutation data can be converted into context-by-sample matrices. Validation helpers check matrix shape, numeric values, non-negativity, expected mutation contexts, missing contexts, and low mutation burden. Mutation burden thresholds can be fixed, disabled, or assigned from a quantile of the analyzed sample set.

### Known-signature fitting

Known-signature exposures are estimated locally using non-negative least squares. The fitting workflow supports absolute or relative exposures, post-fit thresholding, zero-exposure handling, and optional renormalization. These options make the thresholding assumptions explicit and reproducible.

### Reconstruction and residual diagnostics

For fitted spectra, mSigSDK reconstructs each sample from the selected signatures and computes cosine similarity, cosine distance, RMSE, mean absolute error, L1/L2 error, and maximum absolute residual. Observed-versus-reconstructed spectra can be rendered using the established mSigPortal mutational spectrum comparison components.

### Bootstrap uncertainty

Bootstrap intervals are computed by multinomial resampling of an observed spectrum followed by repeated local refitting. For each signature, mSigSDK reports mean exposure, median exposure, confidence interval bounds, and selection frequency after exposure thresholding.

### Threshold sensitivity

Threshold sensitivity analysis repeats local fitting across a user-defined grid of exposure thresholds. The SDK summarizes changes in average reconstruction quality, RMSE, active signature count, and per-threshold instability relative to a baseline threshold.

### Exploratory NMF extraction

mSigSDK implements multiplicative-update non-negative matrix factorization for browser-side exploratory extraction. Candidate ranks can be evaluated by reconstruction error and average sample cosine similarity. Repeated runs are supported through deterministic seeds, and extracted signatures can be compared with reference signatures by cosine similarity. For larger interactive runs, a Web Worker path is available when supported by the browser.

### Visualization and reporting

Domain-standard mutational spectrum and comparison plots reuse existing mSigPortal/COSMIC-style rendering. SDK-specific QC, uncertainty, threshold, and NMF summary plots are implemented with D3. Analysis reports include validation summaries, QC outputs, fitting results, provenance metadata, and exportable data structures.

## Results Section Draft Outline

1. **mSigSDK integrates public resources with browser-native workflows.** Introduce mSigPortal and TCGA integration, SDK namespaces, and the privacy boundary shown in Figure 1.
2. **User-supplied spectra can be validated and fitted locally.** Demonstrate MAF/spectrum conversion, expected-context checks, mutation burden QC, and NNLS fitting.
3. **QC diagnostics make known-signature fitting auditable.** Present reconstruction metrics, residual spectra, and low-burden flags using Figure 2.
4. **Bootstrap and threshold sensitivity quantify uncertainty and robustness.** Show how confidence intervals and threshold grids expose unstable interpretations.
5. **NMF supports exploratory de novo extraction in browser-sized datasets.** Present Figure 3 and describe intended dataset scale.
6. **Focused notebooks provide executable examples.** Link the QC, uncertainty/threshold, NMF, and export/report notebooks as reproducible workflow demonstrations.

## Discussion Additions

Draft limitations paragraph:

> mSigSDK is intended to complement rather than replace established command-line and server-side mutational signature pipelines. The SDK uses public APIs for reference and cohort resources, and it reuses established mSigPortal plotting components for domain-standard mutational spectrum displays. Local browser computation is suitable for interactive analyses, QC, teaching examples, report generation, and moderate-sized exploratory workflows. Computationally intensive procedures, particularly large-scale NMF extraction, large bootstrap analyses, and production-scale cohort processing, remain better suited to dedicated computational environments. In addition, low mutation burden, incomplete context coverage, and threshold-dependent exposure calls can produce unstable interpretations; mSigSDK exposes these issues through QC and sensitivity analyses but does not remove the need for study-specific biological judgment.

## Supplementary Materials Plan

- Table S1: SDK namespaces, major functions, local/API execution status, and manuscript section.
- Table S2: benchmark hardware, browser, dataset dimensions, runtime, and memory usage.
- Figure S1: focused Observable notebook index.
- Figure S2: example report/provenance object.
- Supplementary example: SigProfiler/COSMIC-style matrix import/export round trip.

## Supplementary Table S1 Draft

| Namespace | Representative functions | Primary role | Execution locus |
|---|---|---|---|
| `mSigSDK.mSigPortal.mSigPortalData` | reference/cohort retrieval helpers | mSigPortal data access | API retrieval |
| `mSigSDK.mSigPortal.mSigPortalPlots` | profile plots, comparison plots, prevalence plots | domain-standard visualization | local rendering, often API-shaped data |
| `mSigSDK.TCGA` | TCGA/GDC conversion and access helpers | public cancer genomics integration | API retrieval and local conversion |
| `mSigSDK.validation` | `validateSpectra`, `getExpectedContexts`, matrix normalization helpers | matrix validation and context checks | local |
| `mSigSDK.qc` | `summarizeMutationBurden`, `summarizeMissingContexts`, `fitSpectraWithNNLS`, `calculateReconstructionError`, `calculateFitResiduals`, `bootstrapSignatureFit`, `runThresholdSensitivity` | known-signature fitting, QC, uncertainty, and sensitivity | local |
| `mSigSDK.qcPlots` | `plotMutationBurdenSummary`, `plotReconstructionError`, `plotFitResiduals`, `plotBootstrapConfidenceIntervals`, `plotThresholdSensitivity` | QC visualization | local rendering |
| `mSigSDK.signatureFitting` | `fitMutationalSpectraToSignatures` | NNLS exposure fitting from known signatures | local |
| `mSigSDK.signatureExtraction` | `extractSignaturesNMF`, `extractSignaturesNMFInWorker`, `selectNMFRank`, `compareExtractedToReference` | exploratory NMF extraction and reference matching | local, optional Web Worker |
| `mSigSDK.signatureExtractionPlots` | `plotNMFSignatureProfiles`, `plotNMFExposureHeatmap`, `plotNMFRankSelection` | NMF visualization | local rendering |
| `mSigSDK.io` | SigProfiler/COSMIC-style matrix import/export helpers | interoperability | local |
| `mSigSDK.reports` | `createAnalysisReport` and report serializers | structured analysis reports | local |
| `mSigSDK.workflows` | `analyzeSpectraWithSignatures`, `createNMFAnalysis`, MAF analysis helpers | high-level reproducible workflows | local plus optional API-supplied references |
| `mSigSDK.provenance` | provenance wrapper helpers | metadata, reproducibility, audit trail | local |

## Supplementary Report/Provenance Example Draft

```js
const validation = mSigSDK.validation.validateSpectra(groupedSpectra, {
  expectedContexts: mSigSDK.validation.getExpectedContexts({
    profile: "SBS",
    matrix: 96,
  }),
});

const burden = mSigSDK.qc.summarizeMutationBurden(groupedSpectra, {
  lowBurdenThreshold: userSelectedMutationBurdenThreshold,
});

const exposures = await mSigSDK.qc.fitSpectraWithNNLS(
  referenceSignatures,
  groupedSpectra,
  {
    exposureThreshold: 0.01,
    exposureType: "relative",
    renormalize: true,
  }
);

const reconstruction = mSigSDK.qc.calculateReconstructionError(
  referenceSignatures,
  groupedSpectra,
  exposures
);

const report = mSigSDK.reports.createAnalysisReport({
  title: "Known-signature fitting QC report",
  validation,
  burden,
  exposures,
  reconstruction,
  metadata: {
    sdk: "mSigSDK",
    analysis: "local known-signature fitting",
    mutationBurdenThreshold: userSelectedMutationBurdenThreshold,
    exposureThreshold: 0.01,
  },
});
```

This example should be shown as an audit trail rather than a user-interface feature. The point is that the SDK can return structured results suitable for downstream notebooks, reports, or supplemental files.

## Supplementary Import/Export Example Draft

```js
const spectra = mSigSDK.io.importSigProfilerMatrix(sigProfilerText);
const validation = mSigSDK.validation.validateSpectra(spectra, {
  expectedContexts: mSigSDK.validation.getExpectedContexts({
    profile: "SBS",
    matrix: 96,
  }),
});

const exported = mSigSDK.io.exportSigProfilerMatrix(spectra);
```

Suggested manuscript language:

> mSigSDK import/export helpers allow browser workflows to interoperate with matrix formats used by established mutational signature tools. This makes the SDK a lightweight analysis and reporting layer rather than a closed data format.
