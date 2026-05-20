# [mSigSDK: In-Browser Mutational Signature Analysis](https://episphere.github.io/msig/)

## Overview

**mSigSDK** is a JavaScript Software Development Kit (SDK) designed to support portable mutational-signature workflows in browser and local JavaScript environments. It retrieves public resources through APIs from [mSigPortal](https://analysistools.cancer.gov/mutational-signatures/) and performs selected validation, fitting, QC, reporting, and visualization steps on user-supplied spectra in the client runtime.

With **mSigSDK**, researchers can:
- Retrieve public mSigPortal resources and convert them into SDK-ready matrices.
- Import local spectra or MAF-like rows for client-side validation, fitting, QC, and reporting.
- Run burden-aware fitting and exploratory discovery workflows with QC evidence, caveats, and next recommended actions.
- Exchange spectra, signatures, and exposures with SigProfiler-style, COSMIC-style, and MuSiCal-compatible tabular formats.
- Launch optional browser Pyodide and WebR runners for compatible package execution, including matrix-mode SigProfilerAssignment, WebR-backed deconstructSigs and sigminer checks, and MuSiCal-compatible refit review when required package assets are available.
- Prepare matched handoff bundles for SigProfilerAssignment, SigProfilerExtractor, sigProfilerPlotting, deconstructSigs, sigminer, and MuSiCal from the same spectra and signature catalog, plus standalone handoff inputs for SigProfilerMatrixGenerator, SigProfilerSimulator, and SigProfilerClusters.
- Generate portable reports with provenance metadata and JSON Schema validation.

---

## Features

- **Client-Side Computation**: User-supplied spectra can be validated, fitted, assessed, and visualized client-side after import.
- **Modular Design**: Adheres to ECMAScript ES6 standards, enabling easy integration and extension.
- **Visualizations**: Supports mSigPortal-style profile plots, D3 QC/workflow panels, and selected Plotly/AMCharts visualizations with standalone figure captions, context fields, and figure metadata downloads.
- **Research Guidance**: Provides validated burden-aware strategy advice, fit-quality evidence, signature ambiguity checks, and catalog-sufficiency warnings.
- **APIs**: Seamlessly integrates with mSigPortal's REST APIs to fetch mutational signature data and metadata.
- **Data Boundary**: Public reference data are retrieved through APIs; user-supplied spectra can remain local for supported client-side workflows.
- **Interoperability**: Supports SigProfiler-style spectra, COSMIC-style signatures, MuSiCal input/output helpers, and report JSON Schema validation.
- **External Tool Adapters**: Provides optional Pyodide and WebR runners, SigProfilerAssignment and SigProfilerExtractor matrix-mode adapters, handoff adapters for SigProfilerMatrixGenerator, SigProfilerSimulator, SigProfilerClusters, sigProfilerPlotting, deconstructSigs, and sigminer, MuSiCal-compatible refit adapters, and a multi-tool interoperability bundle with explicit runtime provenance.
- **Offline Context Path**: MAF conversion can use row-supplied contexts, caller-supplied lookup tables, or bundled smoke-test lookup assets for hg19, hg38, and T2T-CHM13.

---

## Quick Start

This is all you need to do to run mSigSDK. You don't need to install anything:

1. Navigate to any website that has not blocked module loading (e.g., [https://dceg.cancer.gov/](https://dceg.cancer.gov/)).
2. Use `Fn + F12` to open your browser's developer console.
3. Fetch the SDK by typing the following code into the console:
   ```javascript
   mSigSDK = (await import("https://episphere.github.io/msig/main.js")).mSigSDK
   ```
4. Fetch count-scale example spectra from mSigPortal by typing the following code into the console:
   ```javascript
   data = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData(
     "PCAWG",
     ["SP50611", "SP50406"],
     "WGS",
     "Lung-AdenoCA",
     "SBS",
     96
   )
   ```

---

## Package Usage

mSigSDK is described as a versioned ES module package. Browser projects can import the SDK entry point after installing the package from this repository or from a future npm release:

```javascript
import { mSigSDK } from "msig";

console.log(mSigSDK.version);
```

The published package entry is `main.js`, and the current SDK version is exposed at runtime as:

```javascript
mSigSDK.version
```

## Start Here

New projects should begin with the small stable surface under `mSigSDK.workflows`. These calls keep the first-use path compact while still returning the same validation, QC, warning, recommended-action, and provenance fields used by the full pipelines.

```javascript
const fit = await mSigSDK.workflows.runSingleSampleFit({
  sampleName: "tumor_001",
  spectrum: sampleSpectrum,
  signatures: referenceSignatures,
});

console.log(fit.fitQualityEvidence.samples[0].reportingMode);
console.log(fit.recommendedActions);
```

The primary entry points are:

- `mSigSDK.workflows.analyzeMafFiles(...)` for MAF-to-spectrum conversion with optional fitting.
- `mSigSDK.workflows.runSingleSampleFit(...)` for one sample and one signature catalog.
- `mSigSDK.workflows.runCohortFit(...)` for a spectra matrix and optional metadata.
- `mSigSDK.workflows.runPanelWorkflow(...)` for panel/WES review with opportunity metadata.

Use `mSigSDK.pipelines` for the full computational API and `mSigSDK.workflows.*Lite` for reduced-option convenience wrappers.

---

## Interactive Examples

The canonical interactive recipes now live with the GitHub Pages site: [mSigSDK educational notebooks](https://episphere.github.io/msig/notebooks/viewer.html). These notebooks use public or bundled demonstration inputs, show the JavaScript cells inline, and can be edited and rerun in the browser. They are learning examples for SDK calls, plots, result objects, and export patterns, not a hosted workspace for private user data, regulated data, or large-cohort production analysis. The resource-portability notebook demonstrates how mSigPortal and TCGA/GDC resources become validated SDK matrices, portable TSV files, and provenance-backed analysis objects.

Notebook cards and the runner menu are generated from `notebooks/notebooks.json`. When adding a new `*.onb.html` notebook, run `npm run notebooks:manifest` so it appears automatically on the website and in the runner.

---

## Provenance

```javascript
const resultWithProvenance = mSigSDK.provenance.withProvenance(exposures, {
  analysis: "PCAWG Lung-AdenoCA SBS96 signature fitting",
  parameters: {
    study,
    genomeDataType,
    cancerType,
    mutationType,
    matrixSize,
    signatureSetName,
    exposureThreshold: 0.05,
    exposureType: "relative",
  },
  sourceUrls: [
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum",
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature",
  ],
  notes: "Generated in browser with mSigSDK.",
});

console.log(resultWithProvenance.provenance);
```

The provenance object includes the SDK name, SDK version, import URL, generation timestamp, browser runtime details, analysis parameters, and source URLs. This makes exported results easier to audit, rerun, and cite.

---

## Research-Grade Analysis Helpers

mSigSDK includes pure helper namespaces for validation, QC, de novo signature extraction, interoperability, and analysis reporting. These functions return structured objects first so they can be used in Observable notebooks, browser apps, or downstream scripts.

The focused notebooks in `notebooks/` exercise the current public SDK surface:

- `mSigSDK.validation`: context helpers, matrix normalization, spectra/signature/exposure validation, and MAF-row validation.
- `mSigSDK.qc`: mutation burden, missing-context summaries, NNLS fitting helpers, residuals, reconstruction error, bootstrap uncertainty, and threshold sensitivity.
- `mSigSDK.qcPlots`: mutation-burden, SBS96 profile, reconstruction-error, residual-spectrum, fit-quality evidence dashboard, cohort group-comparison, panel evidence-matrix, bootstrap-interval, bootstrap-summary, and threshold-sensitivity plots.
- `mSigSDK.signatureExtraction`: browser NMF extraction, rank selection by reconstruction error, cophenetic correlation, or silhouette, Web Worker extraction, matrix conversion, and reference matching.
- `mSigSDK.signatureExtractionPlots`: extracted profile, exposure heatmap, and rank-diagnostic plots.
- `mSigSDK.io`: generic TSV export/import plus SigProfiler, COSMIC, and MuSiCal matrix round trips.
- `mSigSDK.runners`: optional Pyodide Web Worker execution for browser-side Python packages and WebR execution for compatible R package builds.
- `mSigSDK.adapters`: SigProfilerAssignment, SigProfilerExtractor, SigProfilerMatrixGenerator, SigProfilerSimulator, SigProfilerClusters, sigProfilerPlotting, deconstructSigs, sigminer, and MuSiCal adapters that prepare canonical files, execute optional runtimes where supported, parse compatible output tables, and return provenance-rich outputs.
- `mSigSDK.reports`, `mSigSDK.provenance`, and `mSigSDK.workflows`: structured reports, reproducibility metadata, MAF-to-spectra conversion, high-level signature-fitting workflows, and browser-sized NMF workflows.
- `mSigSDK.presentation`: reusable browser output helpers for metric cards, tables, notes, expandable object details, and compact rows derived from common SDK result objects.
- `mSigSDK.advisor`: validated burden-aware strategy recommendations, signature ambiguity screening, catalog-sufficiency checks, and fit-quality evidence reports.
- `mSigSDK.quickstart`: compact aliases for the beginner-facing workflow wrappers.
- `mSigSDK.pipelines`: full computational `runSingleSampleFit`, `runCohortFit`, `runDiscoveryWorkflow`, and `runPanelWorkflow` entry points.

### Optional External Tool Adapters

The adapter layer keeps established Python and R/Python ecosystem methods separate from the validated JavaScript core. Browser deployments can use `mSigSDK.runners.pyodide` to run compatible Python packages in a Web Worker, while local or server workflows can reuse the same prepared input files.

For direct Python snippets, use the JavaScript-first runner API:

```javascript
const py = await mSigSDK.runners.pyodide.runPython(
  "import json\ninputs = json.loads(MSIG_INPUT_JSON)\njson.dumps({'n': len(inputs['samples'])})",
  { inputs: { samples: Object.keys(spectra) } }
);

console.log(py.result);
```

```javascript
const prepared = mSigSDK.adapters.sigProfilerAssignment.prepareInput(
  { spectra, signatures },
  { contexts: mSigSDK.validation.getExpectedContexts({ profile: "SBS", matrix: 96 }) }
);

console.log(prepared.files.map((file) => file.path));
```

The same spectra and signature catalog can be bundled for multiple established tools:

```javascript
const bundle = mSigSDK.adapters.createInteroperabilityBundle(
  { spectra, signatures },
  { contexts: mSigSDK.validation.getExpectedContexts({ profile: "SBS", matrix: 96 }) }
);

console.log(Object.keys(bundle.tools));
// sigProfilerAssignment, sigProfilerExtractor, sigProfilerPlotting, deconstructSigs, sigminer, musical
```

SigProfilerAssignment matrix-mode execution is available through the Pyodide runner:

```javascript
const assignment = await mSigSDK.adapters.sigProfilerAssignment.run(
  { spectra, signatures },
  {
    genomeBuild: "GRCh37",
    cosmicVersion: 3.5,
    cpu: 1
  }
);

console.log(assignment.exposures);
console.log(assignment.provenance);
```

SigProfilerExtractor, sigProfilerPlotting, deconstructSigs, and sigminer are supported as handoff adapters. The SDK prepares matrix-mode files and executable Python or R snippets, and it can parse common output tables back into SDK matrices. SigProfilerExtractor can also be launched through Pyodide when the package and dependencies install successfully in the target browser worker.

```javascript
const extractorInput = mSigSDK.adapters.sigProfilerExtractor.prepareInput(
  { spectra },
  { minimumSignatures: 2, maximumSignatures: 6 }
);

const deconstructInput = mSigSDK.adapters.deconstructSigs.prepareInput(
  { spectra, signatures },
  { signatureCutoff: 0.01 }
);

const sigminerInput = mSigSDK.adapters.sigminer.prepareInput(
  { spectra, signatures },
  { method: "QP", mode: "SBS" }
);

const plottingInput = mSigSDK.adapters.sigProfilerPlotting.prepareInput(
  { spectra },
  { matrixType: "SBS", plotType: "96" }
);
```

Variant-level SigProfiler tools are exposed as standalone handoff adapters because they start from VCF/MAF-like files rather than SDK spectra:

```javascript
const matrixGeneratorInput = mSigSDK.adapters.sigProfilerMatrixGenerator.prepareInput(
  { files: [{ path: "sample.vcf", text: vcfText }] },
  { project: "my_project", referenceGenome: "GRCh37" }
);

const simulatorInput = mSigSDK.adapters.sigProfilerSimulator.prepareInput(
  { files: [{ path: "sample.vcf", text: vcfText }] },
  { project: "my_project_simulations", simulations: 100 }
);

const clustersInput = mSigSDK.adapters.sigProfilerClusters.prepareInput(
  { files: [{ path: "sample.vcf", text: vcfText }] },
  { project: "my_project_clusters", genome: "GRCh37" }
);
```

MuSiCal support has two paths. The default path runs a browser-native sparse NNLS comparator on MuSiCal-compatible matrices. Package execution is available with `runtime: "pyodide"` when a Pyodide-compatible MuSiCal wheel or preloaded worker environment is supplied.

```javascript
const sparseRefit = await mSigSDK.adapters.musical.runRefit(
  { spectra, signatures },
  { threshold: 0.001 }
);

const musicalPackageRun = await mSigSDK.adapters.musical.runRefit(
  { spectra, signatures },
  {
    runtime: "pyodide",
    micropipPackages: ["https://example.org/wheels/MuSiCal-1.0.0-py3-none-any.whl"]
  }
);
```

### Workflow Entry Points

```javascript
const result = await mSigSDK.workflows.runSingleSampleFit(
  {
    sampleName: "tumor_001",
    spectrum: sampleSpectrum,
    signatures: referenceSignatures,
  },
  { exposureThreshold: 0.01 }
);

const fullResult = await mSigSDK.pipelines.runSingleSampleFit(
  {
    sampleName: "tumor_001",
    spectrum: sampleSpectrum,
    signatures: referenceSignatures,
  },
  {
    exposureThreshold: 0.01,
    bootstrapIterations: 100,
    thresholds: [0, 0.01, 0.03, 0.05, 0.1],
  }
);

console.log(result.fitQualityEvidence.samples[0].reportingMode);
console.log(result.recommendedActions);
```

Every stable pipeline returns a versioned result object with a shared top-level frame: `schemaVersion`, `workflow`, `workflowRole`, `scopeStatement`, `methodBasis`, `primaryInterpretationFields`, `parameters`, `validation`, `qc`, `fit` or `extraction` or `panel`, `warnings`, `recommendedActions`, `publicationFigures`, and `provenance`. Core pipeline-specific details live in nested objects such as `panel` or `discovery`.

v0.3 expands the cohort and panel paths:

```javascript
const cohort = await mSigSDK.pipelines.runCohortFit(
  {
    spectra: groupedSpectra,
    signatures: referenceSignatures,
    metadata: sampleMetadata,
  },
  {
    groupKey: "diagnosis",
    comparison: { permutationIterations: 1000 },
  }
);

const panel = await mSigSDK.pipelines.runPanelWorkflow(
  {
    spectra: panelSpectra,
    signatures: referenceSignatures,
    callableOpportunities,
  },
  {
    minAssessableMutations: 30,
  }
);
```

The cohort workflow returns sample-level refits, fit-quality evidence, cohort similarity structure, and metadata-stratified exposure comparisons. The panel/WES workflow returns opportunity normalization status, signature-specific restricted-assay evidence, evidence tiers, and an evidence summary.

### QC and Uncertainty

```javascript
const burden = mSigSDK.qc.summarizeMutationBurden(groupedSpectra, {
  lowBurdenThresholdMode: "fixed", // "fixed", "quantile", or "none"
  lowBurdenThreshold: 100,
});
const selectedSamples = mSigSDK.qc.selectSamplesByMutationBurden(burden, {
  minTotalMutations: 1000,
  limit: 8,
});
const missing = mSigSDK.qc.summarizeMissingContexts(groupedSpectra, {
  expectedContexts: mSigSDK.validation.getExpectedContexts({
    profile: "SBS",
    matrix: 96,
  }),
});

const reconstruction = mSigSDK.qc.calculateReconstructionError(
  referenceSignatures,
  groupedSpectra,
  exposures
);

const thresholdSensitivity = await mSigSDK.qc.runThresholdSensitivity(
  referenceSignatures,
  groupedSpectra,
  { thresholds: [0, 0.01, 0.03, 0.05, 0.1] }
);
```

Plot wrappers are available under `mSigSDK.qcPlots`, including D3 mutation burden summaries, reconstruction error, bootstrap confidence intervals, and threshold sensitivity. SBS96 observed-vs-reconstructed residual comparisons reuse the established mSigPortal mutational spectrum renderer. Public plot helpers accept optional `figureContext` or `publication` metadata so exported figures identify the dataset, sample or cohort scope, profile/matrix, signature catalog, and method settings without surrounding notebook text.

### NMF Signature Extraction

```javascript
const nmf = mSigSDK.signatureExtraction.extractSignaturesNMF(groupedSpectra, {
  rank: 5,
  nRuns: 20,
  maxIterations: 1000,
  seed: 123,
});

const rankSelection = mSigSDK.signatureExtraction.selectNMFRank(groupedSpectra, {
  ranks: [2, 3, 4, 5],
  rankSelectionCriterion: "cophenetic", // "reconstruction_error", "cophenetic", or "silhouette"
  nRuns: 10,
  seed: 123,
});

const matches = mSigSDK.signatureExtraction.compareExtractedToReference(
  nmf.signatures,
  referenceSignatures
);
```

For larger cohorts, `mSigSDK.signatureExtraction.extractSignaturesNMFInWorker(...)` runs the NMF extraction in a Web Worker when the browser supports it.

NMF plot helpers are available under `mSigSDK.signatureExtractionPlots`. Extracted SBS96 signature profiles reuse the existing mSigPortal profile visualization, while sample exposure heatmaps and rank-selection diagnostics are rendered with D3.

### Observable Notebook Workflows

The SDK includes focused Observable Kit notebooks for educational browser testing without loading every analysis into one runtime. The hosted notebooks use public or bundled demonstration inputs; production analyses should adapt the SDK calls in a controlled local or institutional environment:

- Hosted notebook gallery: <https://episphere.github.io/msig/notebooks/viewer.html>
- `notebooks/msig-sdk-notebooks.onb.html`: index of focused notebooks.
- `notebooks/msig-sdk-end-to-end-workflow.onb.html`: complete fit-review-export arc.
- `notebooks/msig-sdk-public-cohort-exploration.onb.html`: mSigPortal and TCGA/GDC public dataset discovery.
- `notebooks/msig-sdk-resource-portability.onb.html`: mSigPortal, TCGA/GDC, matrix portability, and provenance.
- `notebooks/msig-sdk-maf-fit-report.onb.html`: raw variant rows to checked SBS96 spectra.
- `notebooks/msig-sdk-qc-walkthrough.onb.html`: known-signature fitting QC and cohort triage.
- `notebooks/msig-sdk-cohort-panel-workflow.onb.html`: cohort metadata, group interpretation, and restricted-assay review.
- `notebooks/msig-sdk-panel-evidence-tiers.onb.html`: panel/WES support tiers and assay-coverage evidence.
- `notebooks/msig-sdk-nmf-extraction.onb.html`: browser-sized NMF extraction and rank diagnostics.
- `notebooks/msig-sdk-uncertainty-thresholds.onb.html`: bootstrap intervals and threshold sensitivity.
- `notebooks/msig-sdk-export-report.onb.html`: report packet builder with provenance and audit checks.
- `notebooks/msig-sdk-multi-engine-comparison.onb.html`: shared-input comparison across supported fitting engines and handoff paths.

The notebooks use `mSigSDK.presentation` rather than notebook-local display code, so the same compact metric cards, tables, notes, and expandable object summaries can be reused in other browser applications:

```javascript
const { mSigSDK } = await import("https://episphere.github.io/msig/main.js");
const rows = mSigSDK.presentation.reconstructionRows(reconstruction);

document.body.append(
  mSigSDK.presentation.table(rows, [
    { key: "sample", label: "Sample" },
    { key: "cosineSimilarity", label: "Cosine similarity" },
    { key: "rmse", label: "RMSE" },
  ])
);
```

### Project and Manuscript Notes

- `docs/MSIGSDK_FEATURE_REFERENCE.html`: rendered source-grounded public API feature reference.
- `docs/MSIGSDK_FEATURE_REFERENCE.md`: Markdown source for the rendered feature reference.
- `docs/project/MEMORY.md`: durable project context, priorities, and development notes.
- `docs/manuscript/manuscript/`: current manuscript drafts.
- `docs/manuscript/google-doc-tables/`: manuscript-ready HTML tables.
- `docs/manuscript/actual-figure-pages/`: reproducible HTML figure pages and screenshots.
- `docs/manuscript/experiments/`: dated reproducibility packages for benchmark and manuscript analyses.
- `examples/maf/`: local example MAF and BED files for import and panel-downsampling workflows.
- `schemas/msig.report.v0.3/report.schema.json`: JSON Schema for `createAnalysisReport` outputs.

### Validation, Interop, and Reports

```javascript
const validation = mSigSDK.validation.validateSpectra(groupedSpectra, {
  expectedContexts: mSigSDK.validation.getExpectedContexts({
    profile: "SBS",
    matrix: 96,
  }),
});

const sigProfilerMatrix = mSigSDK.io.exportSigProfilerMatrix(groupedSpectra);

const report = mSigSDK.reports.createAnalysisReport({
  title: "Signature fitting QC report",
  validation,
  qc: { burden, missing, reconstruction },
  provenance: resultWithProvenance.provenance,
});
```

High-level workflows combine these pieces:

```javascript
const analysis = await mSigSDK.workflows.analyzeSpectraWithSignatures(
  groupedSpectra,
  referenceSignatures,
  {
    exposureThreshold: 0.05,
    mutationBurdenOptions: {
      lowBurdenThresholdMode: "fixed",
      lowBurdenThreshold: 100,
    },
  }
);
```

---

## Development and Contributions

### Source Code
The source code is hosted on GitHub: [mSigSDK Repository](https://github.com/episphere/msig).

### Observable Notebooks
Explore interactive examples: [Observable Notebooks](https://observablehq.com/@aaronge-2020/signatures).

### Contact
**Aaron Ge**  
Division of Cancer Epidemiology and Genetics, National Cancer Institute.  
Email: [age1@som.umaryland.edu](mailto:age1@som.umaryland.edu).

---

## License
This project is open-source and available under the MIT license.
