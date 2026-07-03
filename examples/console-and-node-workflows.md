# Browser Console And Node Workflows

These examples show the two zero-install scripting paths.

## Browser Console

`browser-console-fit.js` is designed for a browser developer console:

1. Open a modern browser on a page that permits JavaScript module imports.
2. Open developer tools.
3. Paste the contents of `examples/browser-console-fit.js`.

The script imports `https://episphere.github.io/msig/main.js`, fetches public PCAWG Lung-AdenoCA SBS96 spectra and the COSMIC v3 SBS96 catalog, fits one public sample locally in the browser, runs reconstruction QC, runs worker-backed bootstrap uncertainty, and prints a compact exposure table.

This is the easiest way to demonstrate that the SDK can be used from an ordinary JavaScript console.

## Node

`node-console-fit.mjs` is the same idea for local/headless scripting:

```powershell
node examples/node-console-fit.mjs
```

or, for a named public sample:

```powershell
node examples/node-console-fit.mjs SP50263
```

The Node example imports the native computational modules directly rather than importing `main.js`. That distinction is intentional: `main.js` is the browser SDK bundle and imports browser/CDN modules such as plotting libraries by URL, while Node does not natively load `https:` ECMAScript imports and has no browser DOM. The native modules used for matrix conversion, NNLS fitting, QC, worker-backed bootstrap, NMF, and report serialization are ordinary JavaScript modules and run headlessly under Node.

Use `node-headless-fit.mjs` when you want the fuller report-writing example:

```powershell
node examples/node-headless-fit.mjs --output examples/node-headless-report.json
```
