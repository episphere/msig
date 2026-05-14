# mSigSDK Notebook Researcher Utility Audit

Date executed: 2026-05-14  
Scope: all eleven notebooks listed in `notebooks/notebooks.json` and rendered through `notebooks/viewer.html`.

## Executive Summary

The notebook gallery has the right core surface for explaining mSigSDK: public resource access, local matrix validation, known-signature fitting, uncertainty checks, exploratory NMF, panel/WES evidence tiers, interoperability, and report/provenance export. The current set still reads more like a collection of runnable feature examples than a coherent researcher workflow for learning the SDK and adapting it to real projects.

The highest-priority fixes are:

1. Repair the `MAF to report` notebook runtime failure. The notebook passes a flat MAF row array to `workflows.analyzeMafFiles`, while the current conversion path expects nested row arrays and fails with `patient.map is not a function`.
2. Update the notebook index narrative. `msig-sdk-notebooks.onb.html` links only five notebooks and omits `MAF to report`, `Public cohort exploration`, `Panel evidence tiers`, `Multi-engine comparison`, and `Experimental sandbox`.
3. Add a consistent adaptation cell to every applied notebook. Researchers need an explicit "replace this block with your data" pattern showing accepted input shape, required context basis, minimum QC checks, and outputs to save.
4. Reorganize the gallery by workflow stage. A single researcher-facing path should move from orientation to input setup, core fitting, reliability checks, reports, interoperability, and advanced workflows.
5. Surface workflow-level objects more consistently. Several notebooks still emphasize low-level functions or plots without showing `warnings`, `recommendedActions`, `fitQualityEvidence`, `publicationFigures`, provenance, and report fields as first-class scientific evidence.

## Runtime Status

Local runner: `http://127.0.0.1:8091/notebooks/viewer.html`

| Notebook | Runtime status | Priority |
|---|---:|---|
| `msig-sdk-notebooks.onb.html` | Narrative-only notebook loaded | P0 content |
| `msig-sdk-qc-walkthrough.onb.html` | Finished successfully | P1 content |
| `msig-sdk-maf-fit-report.onb.html` | Failed: `patient.map is not a function` | P0 runtime |
| `msig-sdk-public-cohort-exploration.onb.html` | Finished successfully | P1 content |
| `msig-sdk-resource-portability.onb.html` | Finished successfully | P1 content |
| `msig-sdk-uncertainty-thresholds.onb.html` | Finished successfully | P1 content |
| `msig-sdk-nmf-extraction.onb.html` | Finished successfully | P1 content |
| `msig-sdk-panel-evidence-tiers.onb.html` | Finished successfully | P1 content |
| `msig-sdk-multi-engine-comparison.onb.html` | Finished successfully | P1 interoperability |
| `msig-sdk-export-report.onb.html` | Finished successfully | P1 content |
| `msig-sdk-experimental-sandbox.onb.html` | Finished successfully | P2 boundary |

## Site-Wide Improvements

### 1. Organize the gallery by workflow stage

The manifest should carry a `stage` or `workflowGroup` field so the homepage and runner can group notebooks by task. Evidence, limitations, and reproducibility checks should be embedded in the same notebooks researchers use.

Orientation:

- Notebook index
- Public cohort exploration

Input and resource setup:

- Resource portability
- MAF to report

Core analysis:

- Known-signature QC
- Panel evidence tiers
- NMF extraction

Reliability, reporting, and interoperability:

- Uncertainty thresholds
- Export and reports
- Multi-engine comparison

Advanced or experimental:

- Experimental sandbox

### 2. Add a standard adaptation cell

Each applied notebook should include a compact cell named `Adapt this notebook` with:

- input object shape;
- context basis, such as SBS96;
- where to replace public mSigPortal fetches with local spectra or MAF rows;
- minimum validation and burden checks to keep;
- recommended outputs to save as JSON/TSV/HTML;
- privacy boundary between public API retrieval and local browser-side computation.

### 3. Expose structured evidence, not only plots

Each notebook should display the structured fields that support scientific inspection and reuse:

- `validation`
- `warnings`
- `recommendedActions`
- `fitQualityEvidence`
- `publicationFigures`
- `provenance`
- `report`
- conversion or runtime metadata for MAF, TCGA/GDC, Pyodide, and external-tool adapters

Plots are useful, but researchers need the underlying objects and thresholds that produced them.

### 4. Provide downloadable outputs

Researcher adoption improves if each notebook ends with files that can be saved:

- spectra matrix TSV;
- signature matrix TSV where relevant;
- exposure matrix TSV;
- QC JSON;
- report JSON or HTML;
- provenance JSON;
- external-tool handoff bundle where relevant.

### 5. Add cached fallback data for network-sensitive examples

Several notebooks depend on live mSigPortal, GDC, CDN, or optional Pyodide/package availability. The examples should keep live calls where they matter, but include small cached fixtures so execution does not fail because a public API, CDN, or Python package installation is unavailable.

## Notebook Notes

### Notebook index: `msig-sdk-notebooks.onb.html`

Current value:

- Gives the right beginner-level pattern: import the SDK, load or replace spectra, validate matrices, run an analysis, inspect objects.
- Includes a concise list of what the examples demonstrate.

Fixes:

- Add links for all notebooks in the manifest. The current index omits six runnable notebooks now visible in the runner menu.
- Replace the single "Choose a notebook" list with workflow-stage groups.
- Add a suggested execution order:
  1. Public cohort exploration
  2. Known-signature QC
  3. Uncertainty thresholds
  4. Export and reports
  5. Resource portability or MAF to report
  6. Panel evidence tiers, NMF extraction, or multi-engine comparison as topic-specific extensions
- Add a one-screen "what to inspect before trusting results" section: import path, data provenance, validation result, warning semantics, local computation boundary, report/provenance output, and external-tool handoff.
- Add a one-screen "what to replace for a local project" section: sample spectra, signature catalog, thresholds, metadata, panel opportunity mask, and report parameters.

### Known-signature QC: `msig-sdk-qc-walkthrough.onb.html`

Current value:

- Strongest first tutorial.
- Demonstrates the full public-data path from mSigPortal rows to validated spectra, fitted exposures, burden plots, reconstruction error, residuals, and inspectable objects.
- Uses count-scale spectra and explicitly warns that the burden threshold is example-specific.

Fixes:

- Add a high-level workflow call alongside the low-level sequence, such as `workflows.runSingleSampleFit` or `workflows.runCohortFit`, so users see the recommended entry point and the lower-level pieces it wraps.
- Display `warnings`, `recommendedActions`, `fitQualityEvidence`, and `publicationFigures` if the workflow call returns them.
- Add a literal local spectra template showing the exact object shape researchers should paste or generate.
- Add a final output cell that exports exposures, reconstruction metrics, residual summaries, and provenance.
- Add a short "interpretation boundary" cell: exposure estimates depend on catalog, context basis, burden, threshold, and residual structure.

### MAF to report: `msig-sdk-maf-fit-report.onb.html`

Current value:

- Covers an important user path: local MAF-like rows to spectra, fitting, QC, plots, and report-ready outputs.
- Uses row-supplied trinucleotide contexts so the tutorial can run without live genome sequence requests.

Fixes:

- Repair the runtime failure. The notebook currently calls `mSigSDK.workflows.analyzeMafFiles(mafRows, ...)` with a flat array. The current `convertMatrix` implementation iterates over `data` as nested patient arrays and calls `patient.map(...)`. The immediate notebook fix is to pass `[mafRows]`; the SDK-level fix is to normalize documented flat row input before conversion.
- Show the count reconciliation fields prominently: expected convertible SNVs, observed SBS96 counts, context lookup mode, and whether conversion counts match.
- Display `mafAnalysis.conversionWarnings`, `mafAnalysis.warnings`, and `mafAnalysis.recommendedActions`.
- Add an example using `examples/maf/example.input.maf` or a parsed TSV fixture so users can see how a real file becomes `mafRows`.
- Add a download cell for the report object, spectra matrix, exposure matrix, and provenance.
- Make genome-build and context-source requirements explicit for production use.

### Public cohort exploration: `msig-sdk-public-cohort-exploration.onb.html`

Current value:

- Demonstrates a useful pre-fitting step: mutation burden and spectrum-level similarity before exposure interpretation.
- Keeps the notebook short and easy to run.

Fixes:

- Expand the notebook into a stronger cohort-entry tutorial. Researchers need to know how to move from `cohortSpectra` into validation, cohort fitting, export, panel downsampling, or NMF.
- Add a metadata example with a small group label so users can see how cohort-level comparison would be attached.
- Add explicit outlier and low-burden review guidance before fitting.
- Display validation issues and warnings as a table rather than only a four-field validation summary.
- Add a matrix export cell so users can save the public cohort spectra and reuse them in other notebooks.

### Resource portability: `msig-sdk-resource-portability.onb.html`

Current value:

- Best demonstration that mSigSDK is more than a fitting wrapper.
- Shows mSigPortal, TCGA/GDC discovery, SDK matrix conversion, SigProfiler/COSMIC I/O, and provenance.

Fixes:

- Separate public-resource retrieval from local computation more explicitly. Readers should be able to see which calls leave the browser and which steps operate on already imported matrices.
- Add cached fixture fallback for GDC discovery so the notebook still teaches the workflow if GDC is slow or unavailable.
- Clarify that the TCGA section uses already-loaded mSigPortal spectra as a schema demonstration. Add a real minimal TCGA/MAF conversion path or keep the schema demo visually labeled as synthetic.
- Add download links for SigProfiler TSV, COSMIC TSV, long-form rows, and provenance JSON.
- Add a compact "adaptation map" table: mSigPortal row input, local spectra input, TCGA MAF input, and exported matrix output all leading into the same validation/fitting/QC path.

### Uncertainty thresholds: `msig-sdk-uncertainty-thresholds.onb.html`

Current value:

- Directly addresses a common scientific question: whether signature exposures are stable and threshold-dependent.
- Uses a fixed seed and exposes bootstrap and threshold-sensitivity objects before plotting.

Fixes:

- Add publication-grade guidance for iteration counts. The current default is appropriate for teaching, but the notebook should state what to increase for manuscript use.
- Add one intentionally unstable or low-burden contrast sample so users can see how weak evidence appears.
- Surface warning codes such as low bootstrap iterations or thin threshold grids if available from the QC/advisor layer.
- Add a decision table explaining how to report stable, threshold-sensitive, and uncertain signatures.
- Add a download cell for bootstrap intervals, threshold sweep rows, and the analysis parameters used to generate them.

### NMF extraction: `msig-sdk-nmf-extraction.onb.html`

Current value:

- Correctly frames browser NMF as exploratory and includes production handoff to SigProfilerExtractor.
- Demonstrates extraction, reference matching, profile plots, exposure heatmaps, rank diagnostics, and external-tool input preparation.

Fixes:

- Add a stronger front-of-notebook boundary: browser NMF is for teaching and screening, while manuscript-grade discovery needs larger cohorts, more random starts, and production extraction/stability workflows.
- Display warnings when random starts, sample count, or rank grid are deliberately small.
- Add a cached version of the selected spectra so the teaching path is not blocked by live public API calls.
- Expand the production handoff cell to include command snippets, manifest metadata, and which generated files correspond to SigProfilerExtractor matrix-mode inputs.
- Add a short "do not overinterpret closest reference" table explaining that cosine matches are candidate annotations, not process assignments.

### Panel evidence tiers: `msig-sdk-panel-evidence-tiers.onb.html`

Current value:

- Demonstrates a clinically relevant restricted-assay problem: distinguishing `not_assessable` from absence.
- Shows the evidence matrix and per-sample evidence table.

Fixes:

- Use or reference a realistic panel/WES validation fixture rather than only two toy spectra and a three-context signal embedded in SBS96.
- Display `panelResult.warnings`, `panelResult.recommendedActions`, panel limitations, evidence thresholds, callable-opportunity metadata, and assessability reasons near the top.
- Add definitions for each evidence tier so readers can interpret the heatmap without opening nested objects.
- Add a WGS-to-panel downsampling example or link to the panel downsampling validation experiment outputs.
- Add report/export cells for panel evidence calls and callable-territory metadata.

### Multi-engine comparison: `msig-sdk-multi-engine-comparison.onb.html`

Current value:

- Addresses the tool-comparison concern that mSigSDK should be understood relative to established engines.
- Separates the built-in JavaScript NNLS path from optional browser-Pyodide execution.

Fixes:

- Make the notebook evidence-based rather than toy-only. Use cached cross-tool concordance outputs or a small real-data fixture derived from the manuscript validation package.
- Rename or frame the notebook as tool interoperability and handoff unless SigProfilerAssignment execution is reliable in the hosted browser.
- Add explicit runtime requirements: Pyodide availability, package installation, memory limits, timeout, and whether a true package run occurred.
- Show tool versions, parameters, exposure cosine, reconstruction cosine, active signature overlap, and disagreement cases.
- Display ambiguity and catalog confusability results alongside tool differences so readers can distinguish numerical disagreement from biologically confusable signatures.
- Include static fallback outputs for SigProfilerAssignment and MuSiCal-compatible comparison when live browser package execution is unavailable.

### Export and reports: `msig-sdk-export-report.onb.html`

Current value:

- Strong fit for the gallery because it teaches what to save after analysis.
- Demonstrates SigProfiler-style round trip, high-level workflow analysis, manual report assembly, and provenance.

Fixes:

- Add download buttons for the SigProfiler TSV, report JSON, provenance JSON, reconstruction table, and exposure table.
- Validate the report against `schemas/msig.report.v0.3/report.schema.json` or show the schema validation path.
- Display `warnings`, `recommendedActions`, and `publicationFigures` from the workflow result.
- Add a minimal report rendering example so users see the difference between the structured object and a shareable artifact.
- Include a concise "minimum reproducibility bundle" table: spectra, signatures, parameters, SDK version, source URLs, validation, QC, report.

### Experimental sandbox: `msig-sdk-experimental-sandbox.onb.html`

Current value:

- Keeps experimental localized mutagenesis output separate from the validated core.
- Shows `scopeStatement`, `experimentalStatus`, analysis eligibility, and recommended actions.

Fixes:

- Keep this notebook visually separate from the main workflow path. It belongs in an experimental appendix, not the core evidence sequence.
- Replace `Validated for manuscript use` with a clearer display label such as `Manuscript-validated claim` and show `No` or `Not validated` instead of a raw boolean.
- Add a compact explanation of inputs, parameters, foci, rainfall/context patterns, and null-model fields.
- Add a small visualization or table of localized foci so the output is interpretable without opening nested JSON.
- Add a validation roadmap cell describing the evidence needed before this workflow can support manuscript claims.

## Missing Notebook Concepts

The current set would become more useful with three additions:

1. End-to-end workflow walkthrough. A single notebook that follows a realistic analysis from browser import through public or local data loading, validation, fitting, QC, warning semantics, uncertainty, report/provenance, and cross-tool interoperability.
2. Bring-your-own spectra tutorial. A notebook that starts from a pasted local SBS96 matrix, never fetches public spectra, and shows validation, fitting, uncertainty, report export, and privacy boundary.
3. Cohort and panel workflow tutorial. A notebook that uses `runCohortFit` and `runPanelWorkflow` together with metadata, assay territory, and evidence-tier output so researchers can adapt the workflow to WES or targeted-panel projects.

## Recommended Implementation Order

1. Fix `msig-sdk-maf-fit-report.onb.html` so every notebook in the manifest runs.
2. Update `msig-sdk-notebooks.onb.html` and the homepage gallery copy so all eleven notebooks are visible and grouped by workflow stage.
3. Add standard adaptation cells and downloadable output cells to the applied notebooks.
4. Upgrade notebooks to display structured evidence objects consistently.
5. Add cached fixtures for GDC, mSigPortal, and external-tool comparison examples.
6. Add the end-to-end workflow walkthrough and bring-your-own spectra tutorial.
