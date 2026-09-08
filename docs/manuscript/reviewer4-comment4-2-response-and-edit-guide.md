# Reviewer 4, Comment 4.2: response and manuscript edits

## Proposed response

**Response:** We thank the reviewer for identifying this ambiguity. We have revised the Comparative four-tool benchmark Methods to state the unit of analysis and aggregation for every Figure 4 quantity. Synthetic exposure accuracy and active-call metrics were calculated separately for each spectrum and then summarized by the unweighted arithmetic mean across the 2,700 spectra within each tool and noise level; precision, recall, and F1 were therefore macro-averages and were not calculated from pooled calls. Active-signature Jaccard similarity and L1 disagreement were likewise calculated per spectrum and then averaged. In contrast, each reported exposure Pearson correlation was calculated once after flattening the two complete sample-by-signature exposure matrices and was not an average of per-spectrum correlations. We also state the active-call definitions, zero-denominator conventions, and whether unfiltered or post-cutoff exposure vectors were used.

To show dispersion and heterogeneity without repeating the benchmark, we generated new summaries from the deposited per-spectrum outputs. These provide the sample SD, median, interquartile range, and full range overall, together with results for each of the nine 300-spectrum cancer-type groups. At 10% noise, mean per-spectrum F1 (SD) was 0.556 (0.169) for deconstructSigs, 0.532 (0.147) for sigminer, 0.912 (0.122) for SigProfilerAssignment, and 0.924 (0.124) for MuSiCal. The corresponding ranges of cancer-group mean F1 were 0.477-0.646, 0.364-0.642, 0.774-0.999, and 0.826-0.991, demonstrating heterogeneity that was not apparent from the overall means alone. Across tool pairs, mean per-spectrum active-signature Jaccard similarity at 10% noise ranged from 0.355 to 0.866, with pair-specific SDs of 0.142-0.196. We now report these results in the Results and direct readers to the deposited per-spectrum, dispersion, and per-group CSV files in the Data Availability statement and Figure 4 legend. During this audit we also corrected the 10%-noise flattened raw-exposure Pearson range to 0.967-0.991 so that it matches the full 2,700-spectrum output.

## Exact manuscript changes

The line references below refer to `D:\Downloads\mSigSDK - browser-native computation of mutational signatures.md` as supplied on 8 September 2026. Use the heading and paragraph-opening anchors because line numbers will change after editing.

### 1. Abstract, current line 19

In the sentence beginning `Across 2,700 synthetic spectra`, change:

> mean active-signature F1 ranged from 0.532-0.924 at 10% noise

to:

> mean per-spectrum active-signature F1 ranged from 0.532-0.924 at 10% noise

### 2. Methods > Comparative four-tool benchmark, immediately after the paragraph beginning `Both comparisons used the same conventions` (current line 127)

Insert this paragraph:

> The spectrum was the unit of analysis for cosine similarity, RMSE, MAE, precision, recall, F1, L1 disagreement, active-signature Jaccard similarity, active-signature count, reconstruction cosine, and each signature's across-tool exposure range. Unless otherwise stated, a reported mean is the unweighted arithmetic mean of the values calculated separately for each spectrum within a tool-noise-level or tool-pair comparison; calls were not pooled across spectra before calculating precision, recall, or F1. A true signature was active when its published activity was greater than zero, and a predicted signature was active when its complete-catalog relative exposure was at least 1%. For each spectrum, precision was TP/(TP+FP), recall was TP/(TP+FN), and F1 was 2PR/(P+R); a zero denominator was assigned a value of zero. Jaccard similarity was the intersection divided by the union of the two active-signature sets and was assigned one if both sets were empty. Pairwise exposure Pearson correlation was the exception to the per-spectrum averaging rule: it was calculated once for each tool pair after flattening the two complete sample-by-signature relative-exposure matrices, rather than by averaging per-spectrum correlations. Synthetic exposure accuracy and synthetic pairwise Pearson correlation used unfiltered relative-exposure vectors; active-call metrics used the common 1% cutoff and renormalization. The real-cohort Pearson, L1, and active-call comparisons used the post-cutoff, renormalized relative-exposure vectors. Dispersion is reported as the sample standard deviation and, in the deposited tables, the median, interquartile range, and full range. The synthetic results are also summarized separately for each of the nine cancer-type groups (300 spectra per group).

### 3. Results > Four-tool comparison on synthetic and real-world spectra, replace the paragraph beginning `On the simulated spectra` (current line 211)

Replace it with:

> On the simulated spectra, where the true exposures are known, we analyzed all 2,700 spectra at each of the 0%, 5%, and 10% archived noise levels with all four tools, run as local installations of the same pinned versions the adapters target (Figure 4A-B). Mean unfiltered exposure cosine similarities for deconstructSigs, sigminer, SigProfilerAssignment, and MuSiCal were 0.9960, 1.0000, 0.9979, and 0.9996 at 0% noise; 0.9841, 0.9925, 0.9949, and 0.9990 at 5%; and 0.9672, 0.9712, 0.9909, and 0.9962 at 10%. At 10% noise, their per-spectrum SDs were 0.0608, 0.0555, 0.0274, and 0.0197, respectively. Which signatures each tool called active separated the tools more sharply than how much exposure it assigned to them. At 10% noise, the flattened raw-exposure Pearson correlations ranged from 0.967 to 0.991, whereas mean per-spectrum active-signature F1 (SD) was 0.556 (0.169), 0.532 (0.147), 0.912 (0.122), and 0.924 (0.124), respectively, and mean per-spectrum pairwise active-signature Jaccard similarity ranged from 0.355 to 0.866 (pair-specific SD, 0.142-0.196; Figure 4B). Across the nine 300-spectrum cancer-type groups, mean F1 at 10% noise ranged from 0.477-0.646 for deconstructSigs, 0.364-0.642 for sigminer, 0.774-0.999 for SigProfilerAssignment, and 0.826-0.991 for MuSiCal. Complete per-spectrum and per-group results are deposited with the benchmark outputs.

### 4. Results > Four-tool comparison on synthetic and real-world spectra, paragraph beginning `We then compared` (current line 213)

After the sentence reporting the four mean active-signature counts, insert:

> Across the 38 spectra, tool-specific active-signature-count SDs ranged from 1.40 to 3.67; pair-specific SDs ranged from 0.150 to 0.273 for per-spectrum L1 disagreement and from 0.075 to 0.149 for per-spectrum active-signature Jaccard similarity.

### 5. Figure 4 legend, replace the legend beginning `Figure 4. Four-tool comparison` (current line 219)

Replace it with:

> **Figure 4.** Four-tool comparison using known-truth synthetic spectra and real PCAWG spectra. (A) Unweighted arithmetic mean of the raw exposure cosine calculated separately for each of 2,700 synthetic spectra at each archived noise level; accuracy was evaluated before post-fit filtering. (B) Unweighted arithmetic mean of the per-spectrum active-signature F1 after a common 1% relative-exposure cutoff. (C) Pearson correlation calculated once per tool pair after flattening each tool's complete 38-sample by 67-signature PCAWG relative-exposure matrix; this is not an average of per-spectrum correlations. (D) Unweighted arithmetic mean of per-spectrum L1 disagreement between complete relative-exposure vectors. (E) Unweighted arithmetic mean of per-spectrum active-signature Jaccard similarity after the common 1% cutoff. (F) Signatures with the largest mean per-spectrum across-tool exposure ranges in the PCAWG cohort. All tools analyzed the same spectra and catalog with harmonized context order, complete-catalog representation, relative units, filtering order, and reconstruction metrics. The synthetic panels evaluate known-truth accuracy; the PCAWG panels evaluate triangulation without biological truth labels. Sample SDs and distributions, together with synthetic cancer-group summaries, are deposited with the per-spectrum benchmark outputs.

### 6. Declarations > Availability of data and materials, append to the first paragraph (current line 291)

Append:

> Per-spectrum benchmark metrics and the derived overall-dispersion and cancer-type-group summaries are deposited at https://github.com/episphere/msig/tree/main/docs/manuscript/experiments/e7_four_tool_comparison; the aggregation definitions, source-file checksums, and reproducible summary script are included with those files.

## Files generated for this comment

The analysis script is `docs/manuscript/experiments/e7_four_tool_comparison/code/summarize-benchmark-aggregation.mjs`. The resulting overall, per-group, and real-cohort dispersion files and a checksummed validation manifest are in `docs/manuscript/experiments/e7_four_tool_comparison/aggregation_dispersion/`.
