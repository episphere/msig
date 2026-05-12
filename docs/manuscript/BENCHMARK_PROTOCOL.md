# mSigSDK Benchmark Protocol

This protocol is designed to support the manuscript revision with concrete runtime and memory measurements. It separates core local computation from browser rendering so the paper can report both categories honestly.

## Goals

- Quantify local browser-side analysis costs for user-supplied spectra.
- Measure runtime scaling across sample counts.
- Report memory usage transparently.
- Distinguish compute benchmarks from visualization/rendering benchmarks.
- Provide evidence for the statement that NMF is exploratory and moderate-scale in the browser.

## Benchmark Scenarios

Use SBS96-like spectra with 96 mutation contexts.

| Scenario | Sample counts | Signatures | Mutation burden | Notes |
|---|---:|---:|---:|---|
| Small interactive | 10 | 12 | 500/sample | notebook-scale |
| Medium interactive | 100 | 12 | 500/sample | typical exploratory workflow |
| Large interactive | 500 | 12 | 500/sample | stress test for local fitting/QC |
| Upper local test | 1000 | 12 | 500/sample | not recommended for every notebook |

NMF should be benchmarked separately because runtime scales more steeply with rank, iteration count, and repeated starts.

| NMF scenario | Sample counts | Candidate ranks | Runs per rank | Max iterations |
|---|---:|---:|---:|---:|
| NMF small | 10 | 2, 3, 4 | 3 | 100 |
| NMF medium | 100 | 2, 3, 4 | 3 | 100 |

## Measurements

Core compute:

- validation time
- NNLS fitting time
- reconstruction metric time
- threshold sensitivity time across 5 thresholds
- bootstrap time for 100 and 500 iterations on one representative sample
- NMF rank-selection time
- NMF extraction time for selected rank

Rendering:

- mutation burden plot render time
- reconstruction plot render time
- bootstrap plot render time
- threshold sensitivity plot render time
- NMF exposure heatmap render time
- NMF rank diagnostic plot render time

Memory:

- heap used before and after each operation
- RSS before and after each operation in Node benchmarks
- browser heap where available through browser developer tools or `performance.memory`

## Runnable Compute Benchmark

Run the quick smoke test:

```bash
npm run benchmark:manuscript -- --quick
```

Run the full core-compute benchmark:

```bash
npm run benchmark:manuscript -- --output=docs/manuscript/benchmark-results.json --markdown=docs/manuscript/benchmark-results.md
```

For less noisy memory measurements in Node, run directly with exposed garbage collection:

```bash
node --expose-gc scripts/benchmark-manuscript.mjs --output=docs/manuscript/benchmark-results.json --markdown=docs/manuscript/benchmark-results.md
```

## Browser Rendering Benchmark

Rendering should be measured in the Observable Kit notebooks or a browser test page because SVG/DOM cost is browser-specific. For each plot:

1. Warm up the SDK import once.
2. Generate or load the benchmark data.
3. Use `performance.now()` before and after the plotting call.
4. Report the plotted entity count, SVG dimensions, browser name/version, operating system, and hardware.
5. Repeat each measurement at least 5 times and report the median with the range.

Suggested browser table:

| Plot | Samples/signatures | Browser | Median render time ms | Range ms | Notes |
|---|---:|---|---:|---:|---|
| Mutation burden QC | 100 samples | TBD | TBD | TBD | D3 SVG |
| Reconstruction quality | 100 samples | TBD | TBD | TBD | D3 SVG |
| Bootstrap CI | 12 signatures, 500 draws | TBD | TBD | TBD | D3 SVG |
| Threshold sensitivity | 5 thresholds | TBD | TBD | TBD | D3 SVG |
| SBS96 residual spectrum | 1 sample | TBD | TBD | TBD | mSigPortal renderer |
| NMF exposure heatmap | 100 samples x 4 signatures | TBD | TBD | TBD | D3 SVG |

## Manuscript Reporting Template

Report hardware and software:

- CPU:
- RAM:
- Operating system:
- Browser:
- Node version, if Node benchmark is included:
- mSigSDK version or commit:
- Dataset dimensions:
- Number of signatures:
- Mutation burden:
- Bootstrap iterations:
- Threshold grid:
- NMF ranks, runs, and max iterations:

Example manuscript sentence:

> On a [hardware/browser] system, local NNLS fitting of [N] SBS96 spectra against [K] reference signatures required a median of [X] ms, while bootstrap uncertainty with [B] iterations for one sample required [Y] ms. NMF rank selection over ranks [R] with [S] starts and [I] maximum iterations required [Z] ms for [N] samples, supporting its use as an exploratory browser workflow rather than a production-scale extraction pipeline.
