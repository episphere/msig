# Task Completion

- Always inspect `git status --short` before finalizing; this repo often has many unrelated user/generated changes.
- For edits to `main.js`: run `node --check main.js`.
- For edits to native SDK modules under `mSigSDKScripts/*.js`: run `node --check` on touched files; also run focused smoke/verify scripts matching the touched area.
- For report/schema work: run `npm run test:report-schema`.
- For plot/publication-context changes: run `npm run test:plot-context`.
- For adapter/runtime changes in `mSigSDKScripts/adapters.js`, `mSigSDKScripts/runners.js`, package runtime metadata, or external-tool exports: run `npm run smoke:adapters`, `npm run test:exact-adapters`, and `npm run verify:runtime-integrity`; add `npm run smoke:webr-adapters` when browser WebR behavior is affected.
- For profile/MAF conversion changes: run `npm run smoke:profile-conversions`; add `npm run smoke:strict-local` when offline/no-egress behavior is touched.
- For guidance/advisor changes: run `npm run smoke:guidance`.
- For TCGA/context lookup changes: run `npm run smoke:tcga-contexts`.
- For notebook additions/removals: run `npm run notebooks:manifest`; preview with `npm run serve:observable` when UI behavior matters.
- For docs/API metadata changes: run `npm run docs` unless only prose unaffected by generated docs changed.
- Before finalizing any code/docs edit: run `git diff --check`.
- Avoid broad manuscript asset regeneration unless requested; asset commands can rewrite many generated files.