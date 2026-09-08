# Manuscript Figure Captions

These captions are generated alongside the manuscript figures. Figure HTML pages intentionally omit visible manuscript titles and subtitles so captions can be placed in the manuscript document.

## Main Figures

**Figure 1. mSigSDK architecture and data-residency boundary.** Complete user spectra and MAF rows are not uploaded to an mSigSDK-operated analysis service. Optional public-data helpers may send public identifiers to mSigPortal/GDC, and live reference-context lookup may send genomic coordinates to UCSC; strict-local mode disables these requests. Fitted exposures, review outputs, plots, and reports remain local unless explicitly exported.

File: `figure1-architecture-data-residency.html`

**Figure 2. Zero-install workflow demonstration.** Automated in-page timing measured cumulative time from page-load start through the mSigSDK ESM import, public PCAWG Lung-AdenoCA SBS96 spectrum and full COSMIC v3 GRCh37 SBS96 catalog retrieval, native JavaScript 'mSigSDK.qc.fitSpectraWithNNLS' fitting, QC evidence generation, HTML report serialization, and local DOM report rendering. The run used Chrome 150.0.7871.187 in a fresh persistent profile with no-store local-server headers and 'cache: no-store' public fetches; no adapter, Pyodide runtime, WebR runtime, or wrapped package was initialized or imported. D3 was loaded as an mSigSDK visualization dependency and was not used as the fitting runtime. Browser launch and URL entry were excluded from the measured interval.

File: `figure2-zero-install-workflow.html`

**Figure 3. Browser-side public cohort capability summary.** Thirty-eight public PCAWG Lung-AdenoCA SBS96 spectra were fetched from mSigPortal, fitted in the browser against the mSigPortal COSMIC v3 GRCh37 SBS96 catalog with 67 signatures, and summarized as manuscript-scale SDK outputs. Panels show (A) mean normalized COSMIC exposure across the cohort for the dominant fitted signatures, with remaining signatures grouped as Other; (B) descriptive reconstruction metrics and mutation-burden distribution; (C) exposure-threshold sensitivity, comparing active-signature counts with reconstruction cosine across cutoffs; and (D) exploratory non-negative matrix factorization rank selection and the six extracted rank-6 SBS96 component profiles. In panel D, ranks 2–8 were evaluated using five sample-level folds and five seeded restarts per rank and fold. Rank selection used mean relative Frobenius reconstruction error on held-out samples, subject to prespecified convergence and restart component-stability requirements. Rank 6 was selected automatically as the smallest eligible rank within one standard error of the minimum held-out error; rank 8 had the lowest point estimate. Panel C measures the numerical contribution of filtered exposures to reconstruction in this cohort; it does not measure their biological importance or validate the complete rule-based reporting system. The selected NMF rank is a cohort-specific exploratory choice rather than an estimate of universal biological dimensionality.

File: `figure3-public-cohort-capabilities.html`

**Figure 5. Browser runtimes for core SDK workflows on Windows and macOS.** Warm-start elapsed times are shown separately for (A) Chrome, Edge, and Firefox on Windows and (B) Chrome, Firefox, and Playwright WebKit on macOS. Bars show browser-specific medians, black whiskers show interquartile ranges, pale vertical lines show minimum-to-maximum ranges, and overlaid points show the individual warm-run observations; both panels use the same logarithmic time scale and workflow order. Windows measurements used 20 warm runs per browser and scenario, whereas macOS measurements used three. The single-sample scenario includes native NNLS, reconstruction evidence, and HTML report serialization; cohort refitting, 500-iteration bootstrap, and NMF rank-selection/extraction are separate scenarios. Inputs were synthetic spectra and catalogs already held in memory. Public-resource retrieval, Pyodide/WebR initialization, wrapped-package import, adapter fitting, and plot rendering were not included. Playwright WebKit provides WebKit-family coverage but is not a test of the shipping Safari browser.

File: `figure5-exposure-solve-benchmarks.html`

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
