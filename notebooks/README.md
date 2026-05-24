# mSigSDK Observable Kit notebooks

Focused Observable Kit workflows for trying mSigSDK tasks without loading every example into one runtime. Start with the end-to-end workflow to understand the complete arc, then move to the page whose unique goal matches the next decision. The examples use public or bundled demo inputs. Private datasets, regulated data, and large cohorts belong in a controlled local or institutional environment.

The workflows expose the structured outputs that make an analysis reviewable: input checks, fit-quality evidence, cautions, suggested follow-up, portable table exports, provenance, reports, or run records as appropriate for the workflow's goal. New examples should enter through the primary `mSigSDK.workflows` surface before expanding into `mSigSDK.pipelines`, `mSigSDK.quickstart`, or advanced namespace-specific calls.

Each notebook should read as a stepwise researcher workflow. Narrative cells should explain the decision being made, the output that answers it, the common failure mode, and the next step in the analysis. Tables and plots should not appear without interpretation guidance. A new notebook should add a distinct goal; otherwise it should be folded into an existing notebook.

## Notebook index

### Orientation

- `msig-sdk-notebooks.onb.html`: workflow map and uniqueness contract for the workflow set.
- `msig-sdk-end-to-end-workflow.onb.html`: complete fit-review-export arc.
- `msig-sdk-public-cohort-exploration.onb.html`: mSigPortal and TCGA/GDC public dataset discovery, cohort loading, and first-pass public-cohort visualization.

### Input and resource setup

- `msig-sdk-resource-portability.onb.html`: SDK object shape, source metadata, file round trips, and the four supported executable package adapters.
- `msig-sdk-maf-fit-report.onb.html`: raw variant rows to checked SBS96, SBS1536, DBS78, and ID83 profiles with live SBS reference-context lookup, profile-specific plots, audit checks, and exports.

### Core analysis

- `msig-sdk-qc-walkthrough.onb.html`: known-signature QC objects: burden, reconstruction, residuals, warnings, and review steps.
- `msig-sdk-cohort-panel-workflow.onb.html`: panel/WES assay planning with public cohorts, real BED targets, retained burden, and signature assessability.
- `msig-sdk-panel-evidence-tiers.onb.html`: panel/WES support tiers, assay-coverage visuals, and review reasons.
- `msig-sdk-nmf-extraction.onb.html`: native mSigSDK discovery extraction, rank diagnostics, learned profiles, sample contributions, and review bundle exports.

### Reliability, reporting, and interoperability

- `msig-sdk-uncertainty-thresholds.onb.html`: bootstrap intervals, cutoff sensitivity, stability decisions, and uncertainty exports.
- `msig-sdk-export-report.onb.html`: focused report-packet builder for selected report sections, provenance, audit checks, and reproducibility downloads.
- `msig-sdk-multi-engine-comparison.onb.html`: shared-input disagreement triage for mSigSDK, SigProfilerAssignment, MuSiCal, deconstructSigs, and sigminer outputs.

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

The generated `notebooks.json` manifest feeds both the website card grid and the workflow runner menu. `npm run serve:observable` regenerates the manifest before starting the local server.
