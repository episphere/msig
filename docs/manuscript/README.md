# mSigSDK Manuscript Workspace

This directory contains the current manuscript package, generated assets, and reproducibility material.

## Current Folders

- `manuscript/`: submission drafts.
- `data/`: current benchmark, cross-tool concordance, confusable-signature, panel-validation, and synthetic-validation outputs used by manuscript generators.
- `google-doc-tables/`: standalone HTML tables designed for copy/paste into Word or Google Docs.
- `actual-figure-pages/`: reproducible HTML figure pages, cached public PCAWG/COSMIC data, and PNG screenshots.
- `experiments/`: dated experiment packages with README, data, tables, figures, and code.

## Rebuild commands

From the repository root:

```bash
npm run benchmark:manuscript -- --repeats=5
npm run benchmark:confusable
npm run validation:panel
npm run benchmark:browser -- --browsers=chrome,firefox --repeats=3
npm run concordance:cross-tools
npm run assets:manuscript
```

`npm run benchmark:manuscript -- --repeats=5` writes Node.js runtime outputs to `data/`. The experiment packages regenerate the synthetic stress tests, panel validation, browser benchmarks, and cross-tool concordance source data. Browser benchmarking runs Chrome from the local installation and records Firefox as unavailable when no Firefox executable is installed. `npm run assets:manuscript` regenerates manuscript tables, figure pages, and the synchronized manuscript drafts.
