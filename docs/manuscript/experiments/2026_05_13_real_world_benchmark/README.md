# Real-World Use-Case Runtime Measurement

## Research Question

Can mSigSDK v0.3 run the local analysis steps needed by mutational-signature researchers at realistic dataset sizes, including single-sample WGS review, small panel/WES batches, rare-cancer cohorts, medium research cohorts, larger portal-style cohort review, and browser-sized exploratory discovery?

## Brief Methods

The benchmark used deterministic synthetic SBS96 spectra with 96 mutation contexts. The spectra are not patient records; they are timing fixtures sized to match common research use cases. The tested scenarios were: single-sample WGS review (1 sample, 5000 mutations, 24 signatures), small panel/WES batch (24 samples, 80 mutations per sample, 12 signatures), rare-cancer cohort (40 samples, 300 mutations per sample, 18 signatures), medium research cohort (120 samples, 1200 mutations per sample, 24 signatures), portal-scale cohort review (300 samples, 1500 mutations per sample, 40 signatures), and exploratory discovery cohorts of 30 and 80 samples. Runtime and memory were measured with `npm run benchmark:manuscript -- --repeats=5` on 2026-05-14 using Node.js v16.16.0 on Windows x64.

## Key Findings

Median Node.js NNLS fitting took 6.7 ms for the single-sample WGS scenario, 0.9 ms for the 24-sample panel/WES batch, 2.8 ms for the rare-cancer cohort, 19.8 ms for the 120-sample medium research cohort, and 232.3 ms for the 300-sample portal-scale cohort. Workflow-level timing remained interactive: the panel/WES evidence workflow took 25.6 ms, the rare-cancer cohort workflow took 53.2 ms, and the 120-sample cohort workflow took 253.2 ms. Repeated analyses were slower but still browser-sized: a 500-iteration bootstrap for one WGS sample took 337.2 ms, and NMF rank selection took 491.2 ms for 30 samples and 2.15 seconds for 80 samples. These results support interactive local use for review, refitting, panel/WES evidence calls, and browser-sized exploratory extraction.

## Data Dictionary

- `Use case`: named realistic use case tested.
- `Sequencing mode`: sequencing context represented by the synthetic fixture.
- `Workflow step`: SDK operation measured.
- `Samples (n)`: number of spectra in the fixture.
- `Mutations/sample (n)`: synthetic mutation burden per sample.
- `Contexts (n)`: mutation contexts, fixed at SBS96.
- `Signatures (n)`: reference signatures used when applicable.
- `Run settings`: thresholds, iterations, or ranks used by the operation.
- `Runtime (ms)`: elapsed wall-clock time in milliseconds.
- `Heap after (MB)`: Node.js process heap after the operation.
- `RSS after (MB)`: Node.js resident set size after the operation.

## File Inventory

- `data/benchmark-results.json`: full structured runtime and memory output.
- `data/benchmark-results.md`: markdown summary produced by the benchmark script.
- `data/table4_compute_benchmarks.csv`: retained CSV export from the Node.js benchmark package.
- `tables/table4_compute_benchmarks.html`: standalone retained HTML table from the Node.js benchmark package.
- `code/benchmark-manuscript.mjs`: reproducible benchmark script used for the run.
- `figures/.gitkeep`: no separate benchmark figure was added; manuscript figures are regenerated from `docs/manuscript/actual-figure-pages/`.

## Reproducibility Notes

Random seeds are fixed inside `benchmark-manuscript.mjs`. Package version is `msig@0.3.0`; the benchmark records Node.js version, platform, architecture, repeat count, and generation timestamp in `data/benchmark-results.json`. The manuscript Table 6 combines these Node.js timings with the browser benchmark package.
