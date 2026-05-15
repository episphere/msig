# mSigSDK Observable Kit notebooks

Focused Observable Kit notebooks for learning, testing, and adapting mSigSDK workflows without loading every example into one runtime. Start with the end-to-end workflow to understand the complete arc, then move to the notebook whose unique goal matches the next decision. The examples use count-scale SBS96 matrices, cached fallback fixtures, and public-resource loaders so the same notebooks can run on GitHub Pages, a local checkout, or an offline browser session.

The notebooks expose the structured outputs that make an analysis reviewable: input checks, fit-quality evidence, cautions, suggested follow-up, portable table exports, figure descriptions, reports, and run records. New examples should enter through the primary `mSigSDK.workflows` surface before expanding into `mSigSDK.pipelines`, `mSigSDK.quickstart`, or advanced namespace-specific calls.

Each notebook should read as a stepwise researcher workflow. Narrative cells should explain the decision being made, the output that answers it, the common failure mode, and the next step in the analysis. Tables and plots should not appear without interpretation guidance. A new notebook should add a distinct goal; otherwise it should be folded into an existing notebook.

## Notebook index

### Orientation

- `msig-sdk-notebooks.onb.html`: curriculum map and uniqueness contract for the notebook set.
- `msig-sdk-end-to-end-workflow.onb.html`: complete fit-review-export arc for first-time readers.
- `msig-sdk-public-cohort-exploration.onb.html`: public mSigPortal and TCGA/GDC resource discovery, cohort loading, and first-pass public-cohort visualization.

### Input and resource setup

- `msig-sdk-resource-portability.onb.html`: SDK object shape, source metadata, file round trips, and handoff packages.
- `msig-sdk-maf-fit-report.onb.html`: MAF field mapping, grouping, context provenance, count reconciliation, and converted-spectra handoff.

### Core analysis

- `msig-sdk-qc-walkthrough.onb.html`: known-signature QC objects: burden, reconstruction, residuals, warnings, and review steps.
- `msig-sdk-cohort-panel-workflow.onb.html`: cohort metadata, group interpretation, and restricted-assay limits in one applied workflow.
- `msig-sdk-panel-evidence-tiers.onb.html`: standalone panel/WES support tiers and review reasons.
- `msig-sdk-nmf-extraction.onb.html`: discovery extraction, rank diagnostics, learned profiles, sample contributions, and production run files.

### Reliability, reporting, and interoperability

- `msig-sdk-uncertainty-thresholds.onb.html`: bootstrap intervals, cutoff sensitivity, stability decisions, and uncertainty exports.
- `msig-sdk-export-report.onb.html`: import/export checks, required report fields, provenance, run records, and workflow helpers.
- `msig-sdk-multi-engine-comparison.onb.html`: shared-input comparison of mSigSDK, SigProfilerAssignment, deconstructSigs, MuSiCal, and R nnls outputs with disagreement review tables.

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
