# [mSigSDK: In-Browser Mutational Signature Analysis](https://episphere.github.io/msig/)

## Overview

**mSigSDK** is a JavaScript Software Development Kit (SDK) designed to facilitate mutational signature analysis entirely within a web browser. Built to support research workflows involving mutational data, it interacts with APIs from [mSigPortal](https://analysistools.cancer.gov/mutational-signatures/) and adheres to modern web standards, ensuring compatibility, scalability, and privacy.

This SDK allows researchers to analyze patient-specific genomic data without downloading sensitive information, providing a secure and private computational environment. With **mSigSDK**, researchers can:
- Visualize and compare mutational signatures.
- Perform dimensionality reduction, hierarchical clustering, and more.
- Extend functionality to other mutation signature ecosystems such as SIGNAL or COSMIC.

---

## Features

- **In-Browser Computation**: All analyses are performed client-side using the user's computational resources.
- **Modular Design**: Adheres to ECMAScript ES6 standards, enabling easy integration and extension.
- **Visualizations**: Supports multiple interactive visualizations via Plotly and AMCharts.
- **APIs**: Seamlessly integrates with mSigPortal's REST APIs to fetch mutational signature data and metadata.
- **Data Privacy**: No data is sent to external servers; all operations are secure and local.
- **Extensibility**: Designed for interoperability with future APIs and datasets.

---

## Quick Start

This is all you need to do to run mSigSDK. You don't need to install anything:

1. Navigate to any website that has not blocked module loading (e.g., [https://dceg.cancer.gov/](https://dceg.cancer.gov/)).
2. Use `Fn + F12` to open your browser's developer console.
3. Fetch the SDK by typing the following code into the console:
   ```javascript
   mSigSDK = (await import("https://episphere.github.io/msig/main.js")).mSigSDK
   ```
4. Fetch some data from mSigPortal by typing the following code into the console:
   ```javascript
   data = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData()
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

---

## Interactive Examples

The canonical interactive recipes live in the Observable notebook: [mSigSDK / Aaron Ge](https://observablehq.com/@aaronge-2020/signatures). Use that notebook for live workflows, plots, and browser-first examples. The repo README keeps the stable SDK entry points and reproducibility helpers so example code does not drift in two places.

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
- `mSigSDK.qcPlots`: mutation-burden, reconstruction-error, residual-spectrum, bootstrap-interval, and threshold-sensitivity plots.
- `mSigSDK.signatureExtraction`: browser NMF extraction, rank selection, Web Worker extraction, matrix conversion, and reference matching.
- `mSigSDK.signatureExtractionPlots`: extracted profile, exposure heatmap, and rank-diagnostic plots.
- `mSigSDK.io`: generic TSV export/import plus SigProfiler and COSMIC matrix round trips.
- `mSigSDK.reports`, `mSigSDK.provenance`, and `mSigSDK.workflows`: structured reports, reproducibility metadata, and high-level signature-fitting or NMF workflows.

### QC and Uncertainty

```javascript
const burden = mSigSDK.qc.summarizeMutationBurden(groupedSpectra, {
  lowBurdenThresholdMode: "fixed", // "fixed", "quantile", or "none"
  lowBurdenThreshold: 100,
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

Plot wrappers are available under `mSigSDK.qcPlots`, including D3 mutation burden summaries, reconstruction error, bootstrap confidence intervals, and threshold sensitivity. SBS96 observed-vs-reconstructed residual comparisons reuse the established mSigPortal mutational spectrum renderer.

### NMF Signature Extraction

```javascript
const nmf = mSigSDK.signatureExtraction.extractSignaturesNMF(groupedSpectra, {
  rank: 5,
  nRuns: 20,
  maxIterations: 1000,
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

The SDK includes focused Observable Kit notebooks for browser testing without loading every analysis into one runtime:

- `notebooks/msig-sdk-notebooks.onb.html`: index of focused notebooks.
- `notebooks/msig-sdk-qc-walkthrough.onb.html`: known-signature fitting QC.
- `notebooks/msig-sdk-uncertainty-thresholds.onb.html`: bootstrap intervals and threshold sensitivity.
- `notebooks/msig-sdk-nmf-extraction.onb.html`: browser-sized NMF extraction and rank diagnostics.
- `notebooks/msig-sdk-export-report.onb.html`: import/export, reports, provenance, and workflow helpers.

### Project and Manuscript Notes

- `docs/project/MEMORY.md`: durable project context, priorities, and development notes.
- `docs/manuscript/TODO.md`: manuscript revision checklist.
- `docs/manuscript/REVISION_PACKAGE.md`: manuscript-ready abstract, figure plans, tables, and draft section language.
- `docs/manuscript/BENCHMARK_PROTOCOL.md`: benchmark protocol for manuscript runtime and memory reporting.

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
