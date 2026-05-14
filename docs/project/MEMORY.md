# mSigSDK Project Memory

This file records durable project context for future work on the mSigSDK codebase and manuscript.

## Project Identity

- Repository: `episphere/msig`
- Local path: `/Users/aaronge/Documents/GitHub/msig`
- Main entry point: `main.js`
- Public import target: `https://episphere.github.io/msig/main.js`
- Current positioning: browser-native JavaScript SDK for mutational signature data access, local spectra import, primary workflow wrappers, fitting, QC, uncertainty analysis, interoperability, optional external-tool adapters, provenance-aware reporting, panel review, and exploratory extraction.
- Important production mSigPortal URL: `https://analysistools.cancer.gov/mutational-signatures/`
- Old mSigPortal dev URL that should not be used in the manuscript: `https://analysistools-dev.cancer.gov/mutational-signatures/`

## User Priorities

- Visualizations should be scientifically defensible, aesthetically polished, and readable.
- Do not reinvent domain-standard mutational spectrum plots when mSigPortal/COSMIC-style renderers already exist.
- For SDK-owned custom QC plots, prefer D3.js over ad hoc Plotly/Vega-Lite designs.
- Thresholds should be user-configurable and scientifically justified; do not hard-code universal "good/excellent" labels without evidence.
- Notebook text should read like an explanatory scientific narrative, not a loose collection of code snippets.
- Keep Observable examples focused and lightweight rather than one laggy omnibus notebook.

## Current SDK Capabilities

- mSigPortal API integration for public mutational signature resources.
- TCGA/GDC-related helpers.
- User data and MAF/spectrum conversion helpers.
- Local NNLS-based signature fitting.
- Validation helpers for spectra and expected contexts.
- QC helpers for mutation burden, missing contexts, reconstruction error, residuals, zero-exposure handling, bootstrap intervals, and threshold sensitivity.
- D3 QC plots for mutation burden, reconstruction error, bootstrap confidence intervals, and threshold sensitivity.
- Residual and mutational spectrum plots reuse mSigPortal plotting components where possible.
- Browser-side NMF extraction helpers, rank selection by reconstruction error, cophenetic correlation, or silhouette, Web Worker support, COSMIC/reference matching, and NMF visualization helpers.
- Import/export helpers for SigProfiler-style, COSMIC-style, MuSiCal-compatible, and generic TSV matrices.
- Optional Pyodide Web Worker runner plus SigProfilerAssignment, SigProfilerExtractor, deconstructSigs, and MuSiCal-compatible adapters under `mSigSDK.runners` and `mSigSDK.adapters`.
- Offline MAF context lookup support through row-supplied contexts, caller-supplied lookup tables, and bundled sparse smoke-test assets for hg19, hg38, and T2T-CHM13.
- Report and provenance helpers, including JSON Schema validation for `createAnalysisReport`.
- A small primary `mSigSDK.workflows` surface for MAF analysis, single-sample fitting, cohort fitting, and panel/WES review, plus `*Lite` wrappers and compact `mSigSDK.quickstart` aliases for reduced-option entry points.
- High-level workflow helpers for analysis orchestration, with localized-mutagenesis and subgroup-discovery pipelines isolated under `mSigSDK.experimental`.

## Important SDK Namespaces

- `mSigSDK.mSigPortal`
- `mSigSDK.TCGA`
- `mSigSDK.validation`
- `mSigSDK.qc`
- `mSigSDK.qcPlots`
- `mSigSDK.signatureFitting`
- `mSigSDK.signatureExtraction`
- `mSigSDK.signatureExtractionPlots`
- `mSigSDK.io`
- `mSigSDK.runners`
- `mSigSDK.adapters`
- `mSigSDK.reports`
- `mSigSDK.advisor`
- `mSigSDK.quickstart`
- `mSigSDK.pipelines`
- `mSigSDK.workflows`
- `mSigSDK.experimental`
- `mSigSDK.provenance`
- `mSigSDK.presentation`

## Focused Observable Kit Notebooks

- `notebooks/msig-sdk-notebooks.onb.html`: notebook index.
- `notebooks/msig-sdk-qc-walkthrough.onb.html`: known-signature fitting and QC walkthrough.
- `notebooks/msig-sdk-resource-portability.onb.html`: mSigPortal, TCGA/GDC, matrix portability, and provenance.
- `notebooks/msig-sdk-uncertainty-thresholds.onb.html`: bootstrap intervals and threshold sensitivity.
- `notebooks/msig-sdk-nmf-extraction.onb.html`: browser-sized NMF extraction and rank diagnostics.
- `notebooks/msig-sdk-export-report.onb.html`: import/export, reports, provenance, and workflow helpers.

## Manuscript Workspace

- The manuscript frames mSigSDK as a portable browser-native workflow layer that complements established extraction and assignment tools rather than replacing them.
- Validated advisor functions in the manuscript are `computeFitQualityEvidence`, `computeSignatureAmbiguity`, `detectOutOfReferenceSignal`, and `recommendAnalysisStrategy`.
- Experimental advisor and pipeline functions remain available for descriptive review but are not part of the manuscript-validated claim set.
- Current manuscript drafts live in `docs/manuscript/manuscript/`.
- Core compute benchmark harness: `npm run benchmark:manuscript`.
- Browser benchmark harness: `npm run benchmark:browser`.
- Confusable-signature stress test: `npm run benchmark:confusable`.
- Panel downsampling validation: `npm run validation:panel`.
- Current manuscript tables live in `docs/manuscript/google-doc-tables/`.
- Current reproducible figure pages live in `docs/manuscript/actual-figure-pages/`.
- Current dated experiment packages live in `docs/manuscript/experiments/`.
- Manuscript asset generator: `npm run assets:manuscript`.
- Feature reference: `docs/MSIGSDK_FEATURE_REFERENCE.md`.
- Tool interoperability verification: `npm run verify:tool-interoperability -- --timeout-ms=900000 --probe-sigprofilerassignment-run`.

## Manuscript Evidence Covered

- Architecture and browser boundary.
- Public data retrieval, local spectra import, and provenance capture.
- Known-signature fitting QC dashboard.
- Bootstrap exposure uncertainty and threshold sensitivity.
- NMF rank diagnostics and extracted signature profiles.
- Synthetic burden validation and confusable-signature stress testing.
- Cross-tool concordance against deconstructSigs, SigProfilerAssignment, MuSiCal, and independent R NNLS.
- WGS-to-panel downsampling validation.
- Browser and Node.js benchmark table.
- JSON Schema and executable notebook examples.

## Development Notes

- Use `rg` and `rg --files` first for local code search.
- Use `apply_patch` for manual file edits.
- Preserve user changes and avoid reverting unrelated work.
- Run `node --check main.js` after editing `main.js`.
- Run `npm run smoke:adapters` and `npm run verify:tool-interoperability -- --timeout-ms=900000 --probe-sigprofilerassignment-run` after editing `mSigSDKScripts/runners.js`, `mSigSDKScripts/adapters.js`, or external-tool adapter exports.
- Run `node --check scripts/benchmark-manuscript.mjs` after editing the manuscript benchmark harness.
- Run `node --check scripts/generate-manuscript-v03-assets.mjs` after editing the manuscript asset generator.
- Run `git diff --check` before finalizing docs/code changes.
- Local Observable server command: `npm run serve:observable`.
- Focused notebook index URL when the local server is running: `http://127.0.0.1:8080/notebooks/msig-sdk-notebooks.onb.html`.
