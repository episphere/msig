# Synthetic Signature Validation

## Research question

How accurately does the mSigSDK known-signature refitting workflow recover known COSMIC SBS96 exposure mixtures across realistic mutation burdens?

## Methods

Synthetic SBS96 spectra were generated from six COSMIC SBS96 reference signatures (SBS1, SBS2, SBS4, SBS5, SBS13, SBS40) loaded from the cached mSigPortal manuscript snapshot. For each mutation burden (50, 100, 250, 500, 1000, 2500), 64 spectra were generated from seeded sparse mixtures with two or three active signatures, sampled by multinomial draws, and refitted with the SDK's nonnegative least-squares workflow using a 0.01 relative exposure threshold and renormalization. Active-signature recall and inactive-signature calls used a 0.05 exposure threshold. The random seed was 20260513; date executed 2026-05-13T14:51:26.584Z.

## Key findings

At 50 mutations per sample, mean cosine between true and estimated exposures was 0.912 (0.882-0.941) and mean reconstruction cosine was 0.884 (0.862-0.906). At 2500 mutations per sample, mean cosine between true and estimated exposures was 0.998 (0.998-0.999) and mean reconstruction cosine was 0.996 (0.995-0.997). Active-signature recall increased from 0.938 (0.903-0.972) to 1.000 (1.000-1.000), while inactive-signature calls decreased from 0.165 (0.120-0.211) to 0.017 (0.001-0.033). These results support use of the SDK for lightweight review of known synthetic mixtures while reinforcing burden-dependent caution.

## File inventory

- data/synthetic_validation_sample_level.csv: per-sample validation metrics.
- data/table4_synthetic_signature_validation.csv: summary statistics used for manuscript Table 4.
- data/synthetic-validation-results.json: structured summary copied into docs/manuscript/data for the manuscript table generator.
- tables/table4_synthetic_signature_validation.html: standalone HTML table with inline CSS.
- code/synthetic-validation.mjs: reproducible analysis script.
