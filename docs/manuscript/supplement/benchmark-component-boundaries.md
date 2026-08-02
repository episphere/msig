# Benchmark component boundaries

The zero-install demonstration (E1/Figure 2) and the browser runtime benchmark (E4/Figure 4) are intentionally different experiments. `Yes` means that the component was timed as its own field; `No` means that it was not run; `N/A` means that the component does not exist in that native-JavaScript path. A blank or zero value is not used to imply that an unmeasured component was instantaneous.

| Component | E1 zero-install Figure 2 | E4 Figure 4 | Interpretation |
| --- | --- | --- | --- |
| SDK/module fetch and import | Yes: `sdkModuleImportMs`; cumulative step and resource timing | Yes for cold phase: module/resource timing; warm phase reuses the loaded module | E4 uses a fresh isolated browser profile for each repeat. |
| Pyodide initialization | N/A: not loaded | N/A: native JavaScript benchmark | No Pyodide runtime was initialized in either artifact. |
| WebR initialization | N/A: not loaded | N/A: native JavaScript benchmark | No WebR runtime was initialized in either artifact. |
| Wrapped-package import | N/A: not performed | N/A: native JavaScript benchmark | deconstructSigs, sigminer, SigProfilerAssignment, and MuSiCal were not called. |
| Public spectrum/catalog fetch | Yes: spectrum, catalog, and parallel critical-path fetch times | No: E4 inputs are synthetic and already in memory | E1 uses `cache: no-store` for both public requests. |
| Native fitting computation | Yes: one full 67-signature COSMIC SBS96 NNLS fit | Yes: single-sample, 120-sample, and 300-by-40 NNLS; bootstrap refit work is in `bootstrapMs` | Timed around the native SDK solver call. |
| Adapter fitting computation | No | N/A | Adapter fidelity is evaluated in E2; E2 is not a timing benchmark. |
| QC evidence generation | Yes: reconstruction QC, separately timed | Yes only for the single-sample scenario, separately timed | Cohort/bootstrap/NMF E4 rows do not generate QC evidence. |
| Bootstrap computation | No | Yes: 500 iterations, separately timed | E4 `bootstrap_500` is a one-sample native-JavaScript workload. |
| Plot rendering | No plotted chart; E1 times local report DOM insertion/render separately | No | E4 does not call a plot renderer. |
| Report serialization | Yes: HTML report serialization, separately timed | Yes only for the single-sample scenario, separately timed | Other E4 scenarios measure result JSON serialization, labeled separately. |
| End-to-end elapsed time | Yes: page-load start to rendered report | Yes: cold and warm scenario elapsed time | Human browser launch and URL entry are excluded. |
| Peak memory | Observed JavaScript heap where exposed | Observed JavaScript heap sampled at stage boundaries where exposed | This is not an operating-system process peak; Firefox did not expose `performance.memory`. |

The raw individual E4 observations are retained in `browser_runtime_results.csv` and `browser-runtime-results.json`; summary files add minima, maxima, IQR, p95, and medians.
