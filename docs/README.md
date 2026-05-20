# mSigSDK Documentation

This directory holds project-facing documentation for SDK use, manuscript assets, and reproducible validation work.

## Contents

- `MSIGSDK_FEATURE_REFERENCE.html`: rendered source-grounded public API reference for mSigSDK 0.3.0.
- `MSIGSDK_FEATURE_REFERENCE.md`: Markdown source for the rendered feature reference, including the primary `workflows` happy path, lite wrappers, optional Pyodide/WebR runners, external-tool adapters, warning semantics, advisor validation scope, and interpretation limits.
- `index.html`: generated-documentation landing page that renders the documentation.js API index for browser navigation.
- `api-reference.generated.json`: generated documentation.js API index used by `index.html`.
- `project/MEMORY.md`: durable project context, design priorities, active SDK capabilities, notebook list, and development notes.
- `manuscript/manuscript/`: current manuscript drafts.
- `manuscript/data/`: current benchmark, concordance, stress-test, and synthetic-validation outputs used by manuscript generators.
- `manuscript/google-doc-tables/`: clean standalone HTML tables for copy/paste into Google Docs or Word.
- `manuscript/actual-figure-pages/`: reproducible HTML figure pages, cached public data, and exported screenshots.
- `manuscript/experiments/`: dated reproducibility packages following the project experiment standard.
- `verification/`: lightweight SDK verification outputs for tool-interoperability checks outside the manuscript experiment folders.
- `templates/`: static template fragments used by documentation and legacy API examples.
- `../schemas/msig.report.v0.3/report.schema.json`: versioned JSON Schema for `createAnalysisReport` objects.

Run `npm run docs` to regenerate `api-reference.generated.json` with documentation.js. Legacy JSDoc output and configuration are no longer part of the repository.
