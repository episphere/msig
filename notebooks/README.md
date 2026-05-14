# mSigSDK Observable Kit notebooks

Focused Observable Kit notebooks for learning, testing, and adapting mSigSDK workflows without loading every example into one runtime. The examples use count-scale SBS96 matrices, cached fallback fixtures, and public-resource loaders so the same notebooks can run on GitHub Pages, a local checkout, or an offline browser session.

The notebooks expose the structured objects that make an analysis auditable: validation results, fit-quality evidence, warnings, recommended actions, portable matrix exports, publication figure descriptors, reports, and provenance fields. New examples should enter through the primary `mSigSDK.workflows` surface before expanding into `mSigSDK.pipelines`, `mSigSDK.quickstart`, or advanced namespace-specific calls.

Each notebook should read as a stepwise researcher workflow. Narrative cells should explain the decision being made, the output that answers it, the common failure mode, and the next step in the analysis. Tables and plots should not appear without interpretation guidance.

## Notebook index

### Orientation

- `msig-sdk-notebooks.onb.html`: workflow-stage index.
- `msig-sdk-end-to-end-workflow.onb.html`: local spectra to validation, fitting, uncertainty, interoperability, and report exports.
- `msig-sdk-public-cohort-exploration.onb.html`: public or cached spectra burden, metadata, validation, and similarity review before fitting.

### Input and resource setup

- `msig-sdk-resource-portability.onb.html`: mSigPortal, TCGA/GDC, matrix portability, fallback resources, and provenance exports.
- `msig-sdk-bring-your-own-spectra.onb.html`: local SBS96 spectra, reference signatures, fit-quality evidence, warnings, and downloadable analysis bundle.
- `msig-sdk-maf-fit-report.onb.html`: MAF rows to spectra, count reconciliation, fitting, QC, plots, warnings, and report fields.

### Core analysis

- `msig-sdk-qc-walkthrough.onb.html`: known-signature fitting QC with lower-level calls and high-level workflow packaging.
- `msig-sdk-cohort-panel-workflow.onb.html`: cohort fitting with metadata plus panel/WES callable-territory evidence.
- `msig-sdk-panel-evidence-tiers.onb.html`: panel/WES evidence tiers, assessability reasons, validation summary, and limitations.
- `msig-sdk-nmf-extraction.onb.html`: browser-sized NMF extraction, reference matching, rank diagnostics, and production handoff.

### Reliability, reporting, and interoperability

- `msig-sdk-uncertainty-thresholds.onb.html`: bootstrap intervals, threshold sensitivity, decision table, and uncertainty exports.
- `msig-sdk-export-report.onb.html`: import/export, reports, provenance, schema-style field checks, and workflow helpers.
- `msig-sdk-multi-engine-comparison.onb.html`: shared-input comparison of mSigSDK, SigProfilerAssignment, deconstructSigs, MuSiCal, and R nnls outputs with package handoffs and disagreement review tables.

### Advanced or experimental

- `msig-sdk-experimental-sandbox.onb.html`: experimental localized-mutagenesis workflow with explicit status, warnings, and validation roadmap.

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

