# Manuscript Experiments

This directory contains the replacement E1/E2/E3/E4/E6 experiment suite for the mSigSDK manuscript.

| Folder | Purpose |
| --- | --- |
| `e1_zero_install_demo/` | Fresh-browser zero-install walk-through, timing, screenshots, and public-source provenance. |
| `e2_adapter_fidelity/` | Browser adapter execution compared with conventional local package execution. |
| `e3_internal_reference_checks/` | SDK NNLS, NMF, and QC checks against SciPy, R nnls, scikit-learn, and independent Python metrics. |
| `e4_browser_runtime_benchmarks/` | Fresh browser runtime benchmarks for single-sample, cohort, bootstrap, portal-scale, and NMF workflows. |
| `e6_cross_browser_compatibility/` | Automated desktop Chrome/Edge/Firefox compatibility checks. |

Run from the repository root:

```bash
npm run experiment:all
npm run assets:manuscript
```

All result JSON files share the manuscript experiment schema and are consumed by `scripts/manuscript/generate-assets.mjs`.
