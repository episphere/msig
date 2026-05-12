# mSigSDK Project Memory

This file records durable project context for future work on the mSigSDK codebase and manuscript.

## Project Identity

- Repository: `episphere/msig`
- Local path: `/Users/aaronge/Documents/GitHub/msig`
- Main entry point: `main.js`
- Public import target: `https://episphere.github.io/msig/main.js`
- Current positioning: browser-native JavaScript SDK for mutational signature data access, visualization, fitting, QC, uncertainty analysis, reporting, and exploratory extraction.
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
- Browser-side NMF extraction helpers, rank selection, Web Worker support, COSMIC/reference matching, and NMF visualization helpers.
- Import/export helpers for SigProfiler/COSMIC-style matrices.
- Report and provenance helpers.
- High-level workflow helpers for analysis orchestration.

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
- `mSigSDK.reports`
- `mSigSDK.workflows`
- `mSigSDK.provenance`

## Focused Observable Kit Notebooks

- `notebooks/msig-sdk-notebooks.onb.html`: notebook index.
- `notebooks/msig-sdk-qc-walkthrough.onb.html`: known-signature fitting and QC walkthrough.
- `notebooks/msig-sdk-uncertainty-thresholds.onb.html`: bootstrap intervals and threshold sensitivity.
- `notebooks/msig-sdk-nmf-extraction.onb.html`: browser-sized NMF extraction and rank diagnostics.
- `notebooks/msig-sdk-export-report.onb.html`: import/export, reports, provenance, and workflow helpers.

## Manuscript Revision Strategy

- Reframe the paper away from broad "private computation" claims and toward specific SDK capabilities.
- Directly address the previous reviewer critique that mSigSDK was only a visualization wrapper.
- Add an execution-locus table showing which operations are local, which call mSigPortal/TCGA APIs, and what that means for privacy.
- Update Figure 1 as an SDK architecture and privacy-boundary schematic.
- Update Figure 2 as a known-signature fitting QC dashboard.
- Add Figure 3 for browser-side exploratory NMF extraction.
- Add benchmark data for runtime, rendering time, and memory usage.
- Be explicit that browser-side NMF is exploratory and intended for moderate-sized datasets.
- Avoid unsupported "AI benchmarking" claims unless the manuscript includes actual benchmark results.
- Current manuscript revision assets live in `docs/manuscript/REVISION_PACKAGE.md`.
- Current manuscript revision checklist lives in `docs/manuscript/TODO.md`.
- Current benchmark protocol lives in `docs/manuscript/BENCHMARK_PROTOCOL.md`.
- Core compute benchmark harness: `npm run benchmark:manuscript`.
- Main figure drafts live in `docs/manuscript/figures/`.
- Figure generator: `npm run figures:manuscript`.

## Previous Reviewer Concerns To Address

- Broken mSigPortal dependency URL.
- Ambiguous "previous work" citation in the abstract.
- Concern that mSigSDK is only a wrapper around mSigPortal.
- Concern that private computation claims were broader than the implementation.
- Concern that de novo extraction was not feasible in the browser.
- Lack of rare-cancer or low-mutation-count examples.
- Lack of performance benchmarks and memory/rendering measurements.
- Marketing-style FAIR/privacy language without enough implementation detail.

## Suggested Manuscript Evidence

- Architecture diagram with browser privacy boundary.
- Workflow diagram showing mSigPortal/TCGA/public data versus local user data.
- Known-signature fitting QC dashboard.
- Bootstrap exposure uncertainty visualization.
- Threshold sensitivity visualization.
- NMF rank diagnostics and extracted signature profiles.
- Runtime and memory benchmark table.
- Supplementary table of SDK namespaces and functions.
- Observable notebook links as executable examples.

## Development Notes

- Use `rg` and `rg --files` first for local code search.
- Use `apply_patch` for manual file edits.
- Preserve user changes and avoid reverting unrelated work.
- Run `node --check main.js` after editing `main.js`.
- Run `node --check scripts/benchmark-manuscript.mjs` after editing the manuscript benchmark harness.
- Run `node --check scripts/generate-manuscript-figures.mjs` after editing the manuscript figure generator.
- Run `git diff --check` before finalizing docs/code changes.
- Local Observable server command: `npm run serve:observable`.
- Focused notebook index URL when the local server is running: `http://127.0.0.1:8080/notebooks/msig-sdk-notebooks.onb.html`.
