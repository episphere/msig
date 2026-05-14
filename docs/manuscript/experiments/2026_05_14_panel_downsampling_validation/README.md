# Panel Downsampling Validation

## Research Question

This experiment tests whether panel/WES evidence tiers produced by `runPanelWorkflow` track WGS-derived exposure truth when PCAWG Lung-AdenoCA spectra are restricted to smaller callable SBS96 context masks.

## Methods

The script loads the cached PCAWG Lung-AdenoCA SBS96 snapshot, fits each WGS spectrum against the nine-signature manuscript catalog, and treats the WGS fitted exposure as the comparison truth. Callable panel masks retain the top 24, 48, or 72 SBS96 contexts ranked by aggregate WGS mutation burden. `createWGStoPanelValidationPairs` generates deterministic matched WGS and panel spectra from those masks, and the retained spectra are scaled to controlled panel burdens of 25, 75, 200, and 1,000 mutations. `runPanelWorkflow` assigns evidence tiers with a minimum assessable burden of 30 mutations, limited review support at exposure >=0.05, and higher review support at exposure >=0.20.

## Key Findings

The validation produces 4,104 sample-signature tier comparisons across 38 spectra, nine signatures, three callable-context masks, and four controlled panel burdens. Overall tier accuracy increased with callable territory: 0.629 for the 24-context mask, 0.741 for the 48-context mask, and 0.846 for the 72-context mask. Mean panel-vs-WGS exposure cosine also increased with callable territory, from 0.813 to 0.899 to 0.959 across the same masks. Summary tables report tier accuracy by WGS exposure level and panel callable burden, with panel-vs-WGS exposure cosine reported alongside each stratum. These strata separate low-exposure negative calls from higher-support positive calls and show where limited callable burden drives `not_assessable` behavior.

## File Inventory

| File | Purpose |
| --- | --- |
| `code/panel-downsampling-validation.mjs` | Reproducible benchmark runner. |
| `data/panel_validation_sample_signature_calls.csv` | Per-sample, per-signature WGS truth, panel exposure, expected tier, observed tier, and match status. |
| `data/panel_validation_pair_summary.csv` | Matched WGS and panel burden summaries by sample and callable mask. |
| `data/panel_validation_tier_accuracy.csv` | Tier accuracy by callable context count, WGS truth exposure bin, and panel burden bin. |
| `data/panel_validation_mask_summary.csv` | Overall tier accuracy and exposure-cosine summary by callable mask size. |
| `data/panel-downsampling-validation-results.json` | Machine-readable run metadata and summary outputs. |
| `tables/table_panel_validation_tier_accuracy.html` | Manuscript-ready HTML table. |
| `figures/figure_panel_validation_tier_accuracy.html` | Offline D3 figure source. |
| `figures/figure_panel_validation_tier_accuracy.svg` | Static vector export. |

## Reproducibility

Run from the repository root:

```bash
npm run validation:panel
```

The experiment uses deterministic PCAWG-derived callable masks and no random seed. It was executed with Node.js against the local mSigSDK source tree on 2026-05-14.
