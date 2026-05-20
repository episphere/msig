# mSigSDK Manuscript Workspace

This directory contains the current BMC Bioinformatics software-article draft, generated assets, validation data, and reproducibility material.

## Current Folders

- `manuscript/`: synchronized submission draft generated from `scripts/generate-manuscript-v03-assets.mjs`.
- `data/`: benchmark, cross-tool concordance, confusable-signature, panel-validation, and synthetic-validation outputs used by the manuscript.
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

`npm run assets:manuscript` regenerates the manuscript draft, manuscript tables, figure pages, and workspace READMEs from the synchronized generator.

## BMC Submission Checkpoint

Create a GitHub release or tag for the final manuscript asset snapshot before submission. Use that tag in the manuscript Availability and requirements section. Do not claim a DOI unless a Zenodo or other archival DOI exists.
