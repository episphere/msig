# Manuscript Figure Captions

These captions are generated alongside the manuscript figures. Figure HTML pages intentionally omit visible manuscript titles and subtitles so captions can be placed in the manuscript document.

## Main Figures

**Figure 1. mSigSDK architecture and data-residency boundary.** Optional public-data fetchers may send public sample, gene, project, or file identifiers to mSigPortal/GDC, and the live UCSC MAF-context lookup may send mutation coordinates when explicitly invoked; strictLocal disables those fetches. User spectra, exposures, QC outputs, plots, and JSON reports remain inside the local browser/device boundary unless explicitly exported.

File: `figure1-architecture-data-residency.html`

**Figure 2. Zero-install workflow demonstration.** Automated in-page timing measured cumulative time from page-load start through the mSigSDK ESM import, public PCAWG Lung-AdenoCA SBS96 spectrum and full COSMIC v3 GRCh37 SBS96 catalog retrieval, native JavaScript 'mSigSDK.qc.fitSpectraWithNNLS' fitting, QC evidence generation, HTML report serialization, and local DOM report rendering. The run used Chrome 150.0.7871.187 in a fresh persistent profile with no-store local-server headers and 'cache: no-store' public fetches; no adapter, Pyodide runtime, WebR runtime, or wrapped package was initialized or imported. D3 was loaded as an mSigSDK visualization dependency and was not used as the fitting runtime. Browser launch and URL entry were excluded from the measured interval.

File: `figure2-zero-install-workflow.html`

**Figure 3. Browser-side public cohort capability summary.** Thirty-eight public PCAWG Lung-AdenoCA SBS96 spectra were fetched from mSigPortal, fitted in the browser against the mSigPortal COSMIC v3 GRCh37 SBS96 catalog with 67 signatures, and summarized as manuscript-scale SDK outputs. Panels show cohort-level fitted exposure structure, mutation-burden and fit-quality context, exposure-threshold sensitivity, and exploratory rank-6 non-negative matrix factorization.

File: `figure3-public-cohort-capabilities.html`

**Figure 4. Exposure-solve benchmark scenarios only.** Warm-start elapsed runtime for representative native-JavaScript exposure-solve workflows, shown with individual observations, medians, and IQR/minimum-to-maximum ranges across 20 isolated repeats in Chrome, Edge, and Firefox. The single-sample scenario includes native NNLS, reconstruction QC, and HTML report serialization; it does not render plots. Cohort refitting, 500-iteration bootstrap, and NMF rank-selection/extraction are separate scenarios. Cold-start rows and component fields are retained in the benchmark files; Pyodide/WebR initialization, wrapped-package import, public spectrum/catalog fetch, adapter fitting, and plot rendering were not part of E4 and are labeled not applicable or not measured rather than folded into native-compute timings. The browser exposes only sampled JavaScript heap values, reported as observed peak JS heap; Firefox did not expose this metric.

File: `figure4-runtime-benchmarks.html`

## Figure 3 Detail Figures

The previous full-output Figure 3 page has been split into standalone manuscript-sized detail figures: `figure3a-cohort-exposure-landscape.html`, `figure3b-mutation-burden-qc.html`, `figure3c-threshold-sensitivity.html`, `figure3d-fit-quality-evidence.html`, `figure3e-bootstrap-uncertainty.html`, `figure3f-nmf-discovery.html`.

**Figure 3A. Cohort exposure landscape.** Thirty-eight public SBS96 spectra from the PCAWG Lung-AdenoCA cohort were fetched from mSigPortal and fitted in the browser against the full mSigPortal COSMIC v3 GRCh37 SBS96 catalog (67 signatures). The figure shows the dominant fitted COSMIC signatures across the cohort, with remaining fitted signatures grouped as Other and prevalence annotations indicating how often each signature crossed the reporting threshold.

File: `figure3a-cohort-exposure-landscape.html`

**Figure 3B. Mutation burden QC.** Total SBS mutations are shown for each of the 38 public PCAWG Lung-AdenoCA spectra used in the browser-side refitting workflow, providing the burden context for interpreting fitted exposures, uncertainty, and downstream quality-control flags.

File: `figure3b-mutation-burden-qc.html`

**Figure 3C. Exposure-threshold sensitivity.** The full-COSMIC SBS96 refit is evaluated across reporting cutoffs to show how small-exposure filtering changes active-signature calls while preserving reconstruction quality, summarized by reconstruction cosine across thresholds.

File: `figure3c-threshold-sensitivity.html`

**Figure 3D. Fit-quality evidence.** The dashboard displays the 12 highest-priority samples selected by the SDK's adaptive review policy from the 38-sample public PCAWG Lung-AdenoCA cohort, combining mutation burden, residual structure, bootstrap exposure-interval width, threshold sensitivity, and nearest active-signature similarity into a compact review surface.

File: `figure3d-fit-quality-evidence.html`

**Figure 3E. Bootstrap uncertainty.** For the highest-burden public sample (SP53810), the SDK performed 500 multinomial refits against the full COSMIC SBS96 catalog. The display reports the top 12 of 14 informative fitted signatures with uncertainty intervals and bootstrap draw summaries.

File: `figure3e-bootstrap-uncertainty.html`

**Figure 3F. NMF rank selection and discovery.** Non-negative matrix factorization rank selection used five sample-level folds across candidate ranks 2–8, five restarts per fold, held-out relative Frobenius error, and exact matched-component restart stability. Rank 6 was selected automatically as the smallest eligible rank within one standard error of the minimum held-out error (point-estimate best rank 8); all 6 de novo SBS96 components from the selected rank are displayed.

File: `figure3f-nmf-discovery.html`

## Supplementary Experiment Figures

**Figure E1. Zero-install browser demonstration.** Automated browser instrumentation records the public-data workflow from page load to SDK report readiness, separating measured in-page runtime from human browser-launch and navigation time.

File: `figure-e1-zero-install.html`

**Figure E2. Adapter fidelity against local package execution.** Browser adapter outputs for deconstructSigs, sigminer, SigProfilerAssignment, and MuSiCal are compared with conventional local package execution on the same 38-sample PCAWG Lung-AdenoCA SBS96 cohort and full 67-signature COSMIC catalog.

File: `figure-e2-adapter-fidelity.html`

**Figure E3. Internal numerical solver reference checks.** SDK NNLS and NMF computations are compared with independent SciPy, R nnls, scikit-learn, and independent Python reference implementations using prespecified numerical tolerances.

File: `figure-e3-reference-checks.html`

**Figure E4. Browser runtime benchmarks.** Detailed runtime distributions across locally available desktop browsers for the manuscript benchmark scenarios, including refitting, report generation, bootstrap uncertainty, and NMF workflows.

File: `figure-e4-browser-runtime.html`

**Figure E6. Desktop browser compatibility matrix.** Automated compatibility checks for SDK import, public mSigPortal fetch, single-sample fit/report generation, local rendering, and optional WebR/Pyodide runtime availability across locally available desktop browsers.

File: `figure-e6-compatibility.html`
