# Examples

This directory contains small local files for SDK smoke tests, import examples, and documentation workflows. Large benchmark outputs and manuscript data live under `docs/manuscript/experiments/`.

## Folders

- `maf/`: example MAF and BED files for local conversion, offline-context smoke tests, and panel-downsampling examples.

## Browser Console And Node Quick Fit

- `browser-console-fit.js`: copy-paste browser-console workflow. It imports the public SDK module, fetches public PCAWG Lung-AdenoCA SBS96 spectra and COSMIC v3 signatures, fits one sample locally, runs QC, and runs worker-backed bootstrap.
- `node-console-fit.mjs`: compact Node.js version of the same public-data fit using native SDK modules.
- `console-and-node-workflows.md`: short usage note explaining why the browser console imports `main.js` while Node imports the native computational modules directly.

Run the Node quick fit:

```sh
node examples/node-console-fit.mjs
```

## Headless Node.js

- `node-headless-fit.mjs`: runs the native JavaScript path under Node.js 18+ without a browser DOM. It fetches public PCAWG Lung-AdenoCA SBS96 spectra and the COSMIC v3 GRCh37 SBS96 catalog by default, converts rows into matrices, fits one sample with NNLS, runs QC/bootstrap, runs a small NMF extraction, and writes a JSON report.

Run:

```sh
node examples/node-headless-fit.mjs --output examples/node-headless-report.json
```

The headless path covers native matrix conversion, NNLS, NMF, QC, bootstrap, and report serialization. Browser-only capabilities remain DOM plotting, `downloadAnalysisReport`, WebR/Pyodide Web Worker adapters, and worker-offloaded NMF.
