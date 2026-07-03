# Tech Stack

- Language/runtime: JavaScript ES modules (`"type": "module"`), Node.js scripts, browser-first SDK surface.
- Package manager/lock: npm with `package-lock.json`; no pnpm/yarn/bun lock observed.
- Package entry: `main.js`; package exports only `.` -> `./main.js`.
- Build/bundle: `rollup.config.mjs` inputs `main.js`, outputs `bundle.js`, uses `@rollup/plugin-node-resolve`.
- Main dev deps: `d3`, `documentation`, `playwright-core`, `@rollup/plugin-node-resolve`.
- Runtime deps: `js-yaml`; `build` package is listed but not a primary local build tool.
- Browser visualization: D3 is the preferred SDK-owned plotting layer; legacy/public pages include static HTML/CSS/JS assets under `styles/`, `scripts/`, `docs/`.
- Optional scientific runtimes: browser Pyodide and WebR adapters; package mirrors/artifacts are checked into `docs/package-repos/`.
- External adapters/namespaces: SigProfilerAssignment, MuSiCal, deconstructSigs, sigminer support is concentrated in `mSigSDKScripts/adapters.js`, `mSigSDKScripts/runners.js`, and package-runtime metadata.
- Schema/docs tooling: documentation.js via `scripts/build-docs-api.mjs`; feature reference HTML via `scripts/build-feature-reference-html.mjs`; report schema validation via `scripts/validate-report-schema.mjs`.
- No conventional test framework config observed; validation is mostly Node smoke/verify scripts declared in `package.json`.