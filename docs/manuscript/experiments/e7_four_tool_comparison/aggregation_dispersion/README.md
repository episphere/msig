# Figure 4 aggregation and dispersion audit

This audit answers Reviewer 4, Comment 4.2 from the already-completed four-tool benchmark outputs. It does not rerun any fitting package.

## Aggregation definitions

- Synthetic exposure cosine, RMSE, MAE, precision, recall, and F1 are calculated separately for each spectrum. Reported means are unweighted arithmetic means over the 2,700 spectra for a tool and noise level (macro-averages). Active-call contingency counts are not pooled before calculating precision, recall, or F1.
- A published true activity greater than zero defines a true active signature. A predicted signature is active when its complete-catalog relative exposure is at least 0.01 after conversion to relative units. Values below 0.01 are set to zero and retained values are renormalized. Precision or recall with a zero denominator, and F1 with a zero precision-plus-recall denominator, are assigned zero.
- Active-signature Jaccard similarity is calculated separately for each spectrum and tool pair after the 1% cutoff, then averaged without weighting. Jaccard is assigned one if both active sets are empty.
- A reported pairwise exposure Pearson correlation is one correlation of the two complete sample-by-signature matrices after flattening. It is not an average of per-spectrum correlations. The synthetic Pearson correlations use unfiltered relative exposures; the real-cohort correlations use the post-cutoff, renormalized relative exposures used in the real comparison.
- Per-sample L1 disagreement, active-signature count, reconstruction cosine, and each signature's across-tool range are calculated per spectrum and then averaged without weighting when a mean is reported.
- SD is the sample standard deviation (denominator n-1). Q1 and Q3 use linear-interpolated 25th and 75th percentiles. Each synthetic cancer-type group contains 300 spectra, so the overall sample-level mean also equals the unweighted mean of the nine group means.

## Main dispersion results

At 10% noise, the synthetic per-spectrum results were:

| Tool | Raw exposure cosine, mean (SD) | Precision, mean (SD) | Recall, mean (SD) | F1, mean (SD) | Range of the nine group mean F1 values |
| --- | ---: | ---: | ---: | ---: | ---: |
| deconstructSigs | 0.967 (0.061) | 0.440 (0.185) | 0.841 (0.189) | 0.556 (0.169) | 0.477-0.646 |
| sigminer | 0.971 (0.056) | 0.405 (0.159) | 0.872 (0.160) | 0.532 (0.147) | 0.364-0.642 |
| SigProfilerAssignment | 0.991 (0.027) | 0.997 (0.030) | 0.860 (0.181) | 0.912 (0.122) | 0.774-0.999 |
| MuSiCal | 0.996 (0.020) | 0.967 (0.115) | 0.900 (0.147) | 0.924 (0.124) | 0.826-0.991 |

At 10% noise, the six flattened raw-exposure Pearson correlations ranged from 0.967 to 0.991. Mean per-spectrum active-signature Jaccard similarities ranged from 0.355 to 0.866, with pair-specific per-spectrum SDs from 0.142 to 0.196. Across cancer-type groups, the six tool pairs' group-specific flattened Pearson correlations spanned 0.921-0.999 and their group mean Jaccard similarities spanned 0.228-0.990.

In the 38-spectrum PCAWG comparison, pair-specific SDs were 0.150-0.273 for per-spectrum L1 disagreement and 0.075-0.149 for per-spectrum active-signature Jaccard. Tool-specific active-signature-count SDs were 1.40-3.67.

## Deposited files

- `synthetic-tool-overall-dispersion.csv`: per-tool, per-noise means, SDs, medians, quartiles, and ranges. Its `pooled*` columns are an audit-only sensitivity calculation showing what pooling would produce; they are not the manuscript estimands.
- `synthetic-tool-by-cancer-type.csv`: the same synthetic summaries for all nine 300-spectrum cancer-type groups.
- `synthetic-pairwise-overall-dispersion.csv`: flattened raw-exposure Pearson correlations plus distributions of per-spectrum Pearson correlation and active-signature Jaccard.
- `synthetic-pairwise-by-cancer-type.csv`: pairwise results for every cancer-type group and noise level.
- `real-tool-dispersion.csv`: distributions of active-signature counts and reconstruction cosine across 38 PCAWG spectra.
- `real-pairwise-dispersion.csv`: flattened exposure Pearson correlations and per-spectrum Pearson, L1, and Jaccard distributions for PCAWG.
- `aggregation-dispersion-manifest.json`: aggregation definitions, source checksums, row-count checks, and validation against the previously deposited aggregate outputs.

Rebuild these summaries without repeating the benchmark fits:

```bash
node docs/manuscript/experiments/e7_four_tool_comparison/code/summarize-benchmark-aggregation.mjs
```

The audit reproduced the existing rounded aggregate outputs with a maximum absolute difference below 0.0000005. It also identified a stale number in the manuscript: the 10%-noise pairwise raw-exposure correlation range should be 0.967-0.991, not 0.958-0.989.
