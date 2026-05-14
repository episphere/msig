# Confusable Signature Benchmark

## Research Question

How do mSigSDK known-signature refitting, fit-quality reporting modes, and bootstrap exposure intervals behave for synthetic mixtures designed around confusable COSMIC SBS96 signatures?

## Methods

The benchmark runner generates seeded synthetic SBS96 spectra from cached COSMIC reference signatures in the manuscript snapshot. Two mixture families are evaluated: SBS2 plus SBS13 across five exposure ratios, and SBS5 plus SBS40 plus SBS3 across three exposure patterns. Each synthetic spectrum is sampled by multinomial draws at configured mutation burdens, refit with `fitSpectraWithNNLS`, assigned a reporting mode with `computeFitQualityEvidence`, and bootstrapped with `bootstrapSignatureFit`. Bootstrap coverage is calculated by checking whether the true active-signature exposure lies inside the 95% empirical interval.

## Key Numerical Findings

The full run generated 384 synthetic spectra. Reporting modes ordered the known-truth recovery as expected: mean exposure cosine was 0.999 for `standard_qc_passed`, 0.989 for `report_with_caveats`, and 0.947 for `restricted_interpretation`. Active-signature bootstrap coverage for nominal 95% intervals was 0.895 at 50 mutations, 0.882 at 100 mutations, 0.934 at 250 mutations, 0.954 at 500 mutations, 0.941 at 1,000 mutations, and 0.941 at 2,500 mutations. The SBS5/SBS40/SBS3 mixtures raised `SIGNATURE_AMBIGUITY` in all spectra where that high-confusability pattern was expected.

Run the benchmark to regenerate the `data/` outputs:

```powershell
npm run benchmark:confusable
```

Use a short smoke run while developing:

```powershell
npm run benchmark:confusable -- --quick
```

## File Inventory

- `code/confusable-signature-benchmark.mjs`: standalone benchmark runner.
- `data/confusable_signature_sample_level.csv`: one row per synthetic spectrum with truth, fitted exposures, reconstruction cosine, expected reporting mode, and assigned reporting mode.
- `data/confusable_signature_bootstrap_coverage.csv`: one row per active signature per spectrum with true exposure, fitted exposure, 95% interval, coverage status, and selection frequency.
- `data/confusable_signature_summary.csv`: empirical bootstrap coverage and reporting-mode accuracy by scenario and burden.
- `data/confusable_signature_reporting_modes.csv`: reporting-mode operating characteristics.
- `data/confusable_signature_bootstrap_coverage_by_burden.csv`: empirical bootstrap coverage by mutation burden.
- `data/confusable_signature_ambiguity_warning.csv`: ambiguity-warning behavior by scenario, mixture, and burden.
- `data/confusable-signature-benchmark-results.json`: structured summary for manuscript or downstream validation.

## Reproducibility

Default settings use seed `20260514`, burdens `50, 100, 250, 500, 1000, 2500`, eight spectra per scenario-burden-mixture cell, 200 bootstrap iterations, 95% intervals, and a 0.01 relative exposure threshold. The full design contains 384 synthetic spectra across eight mixture definitions and six burden levels. The script records the execution timestamp, signature set, selected signatures, burdens, samples per cell, bootstrap iterations, confidence level, and reporting-mode truth rule in the JSON output.
