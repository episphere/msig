# Conventions

- Preserve browser-first SDK behavior: user-supplied/private data should remain local for supported client-side workflows; public mSigPortal/TCGA resources may be fetched through APIs.
- Prefer editing native modules under `mSigSDKScripts/`; update `main.js` only when the intended public bundle/export surface requires it and verify syntax afterwards.
- Public API is namespace-oriented under `mSigSDK`: `mSigPortal`, `TCGA`, `validation`, `qc`, `qcPlots`, `signatureFitting`, `signatureExtraction`, `io`, `runners`, `adapters`, `reports`, `advisor`, `quickstart`, `pipelines`, `workflows`, `provenance`, `presentation`.
- Keep JSDoc-style `@function`, `@memberof`, `@param`, `@returns`, and examples for public functions; docs generation depends on source metadata.
- Code style in native modules: ES imports/exports, two-space indentation in most source files, semicolons, object-parameter options with defaults, explicit null/empty handling.
- Keep scientific interpretation boundaries explicit: distinguish fitting/QC/exploratory extraction from biological causality or clinical actionability.
- Thresholds and QC labels should be configurable and evidence-backed; avoid hard-coded universal "good/excellent" interpretations.
- For SDK-owned custom QC/figure components prefer D3; do not reinvent mSigPortal/COSMIC-style mutational spectrum plots when existing renderers already fit.
- Notebook text should be explanatory scientific narrative, not just code snippets; keep examples focused/lightweight.
- When adding `notebooks/*.onb.html`, update generated notebook listing with `npm run notebooks:manifest`.
- Report objects should preserve provenance/method-basis/scope metadata and validate against `schemas/msig.report.v0.3/report.schema.json`.
- External-tool adapters should clearly preserve exact runtime requirements and avoid silent JS fallback when exact Pyodide/WebR/package execution is required.
- Many manuscript/data/figure/table outputs are generated; check whether a task is source-code, docs, or generated-artifact work before touching them.