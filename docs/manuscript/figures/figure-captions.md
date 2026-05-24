# Manuscript Figure Captions

These captions are generated alongside the manuscript figures. Figure HTML pages intentionally omit visible manuscript titles and subtitles so captions can be placed in the manuscript document.

## Main Figures

**Figure 1. mSigSDK client-side mutational-signature review architecture.** mSigSDK uses selected public resources and reusable JavaScript modules to support spectra import, validation, known-signature refitting, quality-control review, uncertainty estimation, panel/WES evidence review, plotting, reporting, and external-tool handoff in the client runtime.

File: `figure1-architecture-data-residency.html`

**Figure 2. Zero-install workflow demonstration.** Automated in-page timing measured the browser-side workflow after the demo page began loading: SDK import, public PCAWG Lung-AdenoCA SBS96 spectrum retrieval, full COSMIC v3 SBS96 catalog retrieval, single-sample refitting, and local report rendering. Browser launch, URL entry, and other human setup time are excluded from the measured interval.

File: `figure2-zero-install-workflow.html`

**Figure 3. Browser-side public cohort capability summary.** Thirty-eight public PCAWG Lung-AdenoCA SBS96 spectra were fetched from mSigPortal, fitted in the browser against the mSigPortal COSMIC v3 GRCh37 SBS96 catalog with 67 signatures, and summarized as manuscript-scale SDK outputs. Panels show cohort-level fitted exposure structure, mutation-burden and fit-quality context, exposure-threshold sensitivity, and exploratory rank-6 non-negative matrix factorization.

File: `figure3-public-cohort-capabilities.html`

**Figure 4. Browser runtime benchmarks.** Median elapsed runtime across isolated desktop-browser repeats for representative SDK workflows, including single-sample fitting/report generation, cohort-scale refitting, bootstrap uncertainty, and NMF rank selection/extraction. Times are shown on a log-scaled axis so fast single-sample operations and slower cohort workflows remain visible in one figure.

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

**Figure 3F. Exploratory NMF discovery.** The browser-side exploratory non-negative matrix factorization rank sweep selected rank 6 for the public PCAWG Lung-AdenoCA SBS96 cohort. All 6 extracted de novo SBS96 components from that rank are displayed for manuscript review and handoff.

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
