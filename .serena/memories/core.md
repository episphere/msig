# Core

- Repo: `episphere/msig`; local root `C:\Users\Aaron Ge\Documents\GitHub\msig`.
- Package: `msig` v0.3.0, browser-first ES module SDK for mutational-signature workflows, mSigPortal data access, local spectra/MAF import, fitting, QC, reports, notebook examples, and optional Pyodide/WebR/external-tool adapters.
- Public package entry/export: `main.js` exports `mSigSDK`; package `exports["."]` points to `./main.js`; public browser import target is `https://episphere.github.io/msig/main.js`.
- Native/editable SDK modules live under `mSigSDKScripts/*.js`; `main.js` is the large bundled/browser entry and should be treated carefully.
- Public app/docs surface: `index.html`, `docs/index.html`, `docs/MSIGSDK_FEATURE_REFERENCE.md`, `docs/api-reference.generated.json`, `README.md`.
- Examples and smoke fixtures: `examples/`, especially `examples/browser-console-fit.js`, `examples/node-console-fit.mjs`, `examples/node-headless-fit.mjs`, and `examples/maf/`.
- Report schema: `schemas/msig.report.v0.3/report.schema.json` with examples under `schemas/msig.report.v0.3/examples/`.
- Runtime package mirrors/artifacts: `docs/package-repos/pyodide/`, `docs/package-repos/webr/`, plus package notes under `packages/pyodide/` and `packages/webr/`.
- Notebook surface: `notebooks/*.onb.html`, `notebooks/notebooks.json`, `notebooks/viewer.html`; notebook cards/runner menu are generated from `notebooks/notebooks.json`.
- Manuscript/repro assets live under `docs/manuscript/`; many generated data/figure/table files may be dirty and should not be casually rewritten.
- Existing durable project notes: `docs/project/MEMORY.md`; use it as repo-authored context, but prefer `package.json` for current runnable script names.

Read for details:
- Stack/build/package info: `mem:tech_stack`.
- Commands: `mem:suggested_commands`.
- Local code/style conventions: `mem:conventions`.
- Done checks: `mem:task_completion`.
- Serena/Codex local setup: `mem:environment/serena_setup`.