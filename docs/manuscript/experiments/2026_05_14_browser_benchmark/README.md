# Browser Benchmark Harness

## Research Question

This experiment measures the manuscript Table 6 scenarios in browser runtimes rather than relying only on Node.js process timings.

## Methods

`browser-benchmark-harness.html` is a standalone browser page that imports the local SDK modules, generates deterministic SBS96 benchmark matrices, and measures validation, NNLS fitting, reconstruction metrics, threshold sensitivity, bootstrap fitting, exploratory NMF, and workflow helper scenarios with `performance.now()`. Memory is recorded with `performance.measureUserAgentSpecificMemory()` where available, otherwise `performance.memory.usedJSHeapSize` when exposed by the browser. `code/run-browser-benchmarks.mjs` serves the repository locally, launches the requested browsers in headless mode, and captures posted results.

## Key Findings

The runner writes browser-specific timing and memory rows to CSV, JSON, and a manuscript-ready HTML table. Chrome stable is detected from the local installation. The verified local run used Chrome 148.0.7778.167 with three repeats. Firefox stable is run when a local Firefox executable is available; the current local result records Firefox as unavailable because no `firefox.exe` executable was installed.

## File Inventory

| File | Purpose |
| --- | --- |
| `browser-benchmark-harness.html` | Standalone browser-native benchmark page. |
| `code/run-browser-benchmarks.mjs` | Reproducible local runner for Chrome and Firefox. |
| `data/browser-benchmark-results.json` | Browser run metadata and row-level results. |
| `data/browser_benchmark_results.csv` | Flat Table 6 timing rows by browser. |
| `tables/table_browser_benchmark_results.html` | Manuscript-ready benchmark table. |

## Reproducibility

Run from the repository root:

```bash
npm run benchmark:browser -- --browsers=chrome,firefox --repeats=3
```

Use the same browser list and repeat count when regenerating manuscript Table 6 so browser and manuscript assets stay synchronized.
