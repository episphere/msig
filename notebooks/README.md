# mSigSDK Observable Kit Notebooks

Focused Observable Kit notebooks for testing mSigSDK workflows without loading every example into one runtime. The tutorials use count-scale PCAWG WGS examples selected to show meaningful mutation-burden QC rather than normalized spectra that sum to 1.

The notebooks are intended to expose the same structured objects used by the manuscript: validation results, fit-quality evidence, warnings, recommended actions, portable matrix exports, and report/provenance fields. New user-facing examples should enter through the primary `mSigSDK.workflows` surface before expanding into `mSigSDK.pipelines`, `mSigSDK.quickstart`, or advanced namespace-specific calls.

## Notebook Index

- `msig-sdk-notebooks.onb.html`: index of focused notebooks.
- `msig-sdk-qc-walkthrough.onb.html`: known-signature fitting QC.
- `msig-sdk-maf-fit-report.onb.html`: MAF rows to spectra, fit, QC, plots, and report fields.
- `msig-sdk-public-cohort-exploration.onb.html`: public spectra burden and similarity review before fitting.
- `msig-sdk-resource-portability.onb.html`: mSigPortal, TCGA/GDC, matrix portability, and provenance.
- `msig-sdk-uncertainty-thresholds.onb.html`: bootstrap intervals and threshold sensitivity.
- `msig-sdk-nmf-extraction.onb.html`: browser-sized NMF extraction and rank diagnostics.
- `msig-sdk-panel-evidence-tiers.onb.html`: panel/WES evidence tiers and assessability reasons.
- `msig-sdk-multi-engine-comparison.onb.html`: NNLS, SigProfilerAssignment, and MuSiCal-compatible comparison.
- `msig-sdk-export-report.onb.html`: import/export, reports, provenance, and workflow helpers.
- `msig-sdk-experimental-sandbox.onb.html`: clearly labeled experimental workflow example.

## Local Use

Start the local SDK server:

```bash
npm run serve:observable
```

Then open:

```text
http://127.0.0.1:8080/notebooks/viewer.html
```

The hosted site uses the same runner at:

```text
https://episphere.github.io/msig/notebooks/viewer.html
```

The notebooks import the SDK with `new URL("../main.js", location.href)`, so the same source files run against the hosted GitHub Pages build or a local checkout.

## Adding Notebooks

Add new notebooks as `*.onb.html` files in this folder, then run:

```bash
npm run notebooks:manifest
```

The generated `notebooks.json` manifest feeds both the website card grid and the notebook runner menu. `npm run serve:observable` regenerates the manifest before starting the local server.

