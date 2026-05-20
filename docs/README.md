# mSigSDK Documentation

This directory holds project-facing documentation for SDK use, manuscript assets, and reproducible validation work.

## Contents

- `index.html`: rendered public SDK documentation for mSigSDK 0.3.0.
- `MSIGSDK_FEATURE_REFERENCE.md`: Markdown source for the public SDK documentation, including the primary `workflows` path, lite wrappers, optional Pyodide/WebR runners, external-tool adapters, warning semantics, advisor validation scope, and interpretation limits.
- `MSIGSDK_FEATURE_REFERENCE.html`: compatibility redirect to `index.html` for older links.
- `api-reference.generated.json`: generated documentation.js API metadata for function lookup and audits.
- `project/MEMORY.md`: durable project context, design priorities, active SDK capabilities, notebook list, and development notes.
- `manuscript/manuscript/`: current manuscript drafts.
- `manuscript/data/`: current benchmark, concordance, stress-test, and synthetic-validation outputs used by manuscript generators.
- `manuscript/google-doc-tables/`: clean standalone HTML tables for copy/paste into Google Docs or Word.
- `manuscript/actual-figure-pages/`: reproducible HTML figure pages, cached public data, and exported screenshots.
- `manuscript/experiments/`: dated reproducibility packages following the project experiment standard.
- `verification/`: lightweight SDK verification outputs for tool-interoperability checks outside the manuscript experiment folders.
- `templates/`: static template fragments used by documentation and legacy API examples.
- `../schemas/msig.report.v0.3/report.schema.json`: versioned JSON Schema for `createAnalysisReport` objects.

Run `npm run docs` to regenerate the public documentation page and the documentation.js API metadata. Legacy JSDoc output and configuration are no longer part of the repository.
