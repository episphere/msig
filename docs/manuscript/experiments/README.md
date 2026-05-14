# Manuscript Experiments

Each folder is a dated, self-contained reproducibility package with code, source data, generated tables, and figure assets.

## Current Packages

| Folder | Purpose |
| --- | --- |
| `2026_05_13_synthetic_signature_validation/` | Synthetic burden validation for Table 4 and bootstrap uncertainty checks. |
| `2026_05_13_deconstructsigs_concordance/` | Independent NNLS, deconstructSigs, SigProfilerAssignment, and MuSiCal concordance analyses for Table 5. |
| `2026_05_13_real_world_benchmark/` | Node.js benchmark runs retained for side-by-side comparison with browser timings. |
| `2026_05_14_confusable_signature_benchmark/` | SBS2/SBS13 and SBS5/SBS40/SBS3 stress tests with reporting-mode and coverage summaries. |
| `2026_05_14_panel_downsampling_validation/` | PCAWG Lung-AdenoCA WGS-to-panel downsampling validation for panel evidence tiers. |
| `2026_05_14_browser_benchmark/` | Browser-native benchmark harness, Chrome result capture, and unavailable-browser reporting when Firefox is not installed. |

## Regeneration

Run the scripts from the repository root:

```bash
npm run benchmark:confusable
npm run validation:panel
npm run benchmark:browser -- --browsers=chrome,firefox --repeats=3
npm run concordance:cross-tools
```

Each package README lists its direct command, outputs, and interpretation boundary.
