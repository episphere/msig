# Cross-Tool Concordance

## Research question

How closely do mSigSDK, an independent R NNLS solver, deconstructSigs, SigProfilerAssignment, and MuSiCal agree when they fit the same PCAWG Lung-AdenoCA SBS96 spectra with the same selected COSMIC SBS96 reference catalog?

## Methods

We used all 38 cached PCAWG Lung-AdenoCA WGS SBS96 spectra from the mSigPortal manuscript snapshot and the same nine selected COSMIC SBS96 signatures used in the manuscript refitting example (SBS1, SBS2, SBS4, SBS5, SBS13, SBS17a, SBS17b, SBS18, SBS40). All tools used the same sample-by-context matrix restricted to the same SBS96 contexts and the same selected reference catalog. Reconstruction metrics used spectra normalized to relative fractions. deconstructSigs used its default count-to-fraction preprocessing without genome-to-exome or exome-to-genome opportunity rescaling. mSigSDK, deconstructSigs, an independent R nonnegative least-squares solver, SigProfilerAssignment v1.1.3, and Park Lab MuSiCal SparseNNLS were run with a 0.01 relative exposure cutoff followed by exposure renormalization where the tool returned continuous exposures. deconstructSigs version 1.8.0 and R nnls version 1.4 were run in R 4.1.1. The cross-tool extension was executed on 2026-05-14.

## Key findings

Across 38 shared spectra, mSigSDK matched the independent R nonnegative least-squares solver to numerical precision (mean exposure-vector cosine 1.000, maximum absolute exposure difference 4.79e-10). Mean exposure-vector cosine versus mSigSDK was 0.997 for deconstructSigs, 0.907 for SigProfilerAssignment, and 0.973 for MuSiCal SparseNNLS. Top fitted signatures matched mSigSDK in 36 of 38 samples for deconstructSigs, 29 of 38 for SigProfilerAssignment, and 37 of 38 for MuSiCal. The two deconstructSigs-discordant samples were both flagged by the SDK ambiguity screen; MuSiCal agreed with mSigSDK for both.

## File inventory

- data/concordance_input_spectra.csv: sample-by-context spectra used by both tools.
- data/concordance_reference_signatures.csv: signature-by-context reference catalog used by both tools.
- data/msigsdk_exposures.csv: mSigSDK fitted exposures.
- data/deconstructsigs_exposures.csv: deconstructSigs fitted exposures.
- data/r_nnls_exposures.csv: independent R nonnegative least-squares fitted exposures.
- data/concordance_sample_level.csv: sample-level agreement metrics.
- data/table5_deconstructsigs_concordance.csv: manuscript summary table.
- data/cross-tool-concordance-results.json: structured cross-tool summary.
- data/cross_tool_concordance_summary.csv: tool-level concordance summary.
- data/cross_tool_concordance_sample_level.csv: sample-level cross-tool agreement metrics.
- data/cross_tool_ambiguity_disagreement.csv: ambiguity-flag and tool-disagreement details.
- data/sigprofilerassignment_exposures.csv: SigProfilerAssignment exposure outputs.
- data/musical_sparse_nnls_exposures.csv: MuSiCal SparseNNLS exposure outputs.
- data/concordance-validation-results.json: structured summary copied into docs/manuscript/data for the manuscript table generator.
- tables/table5_deconstructsigs_concordance.html: standalone HTML table with inline CSS.
- code/concordance-validation.mjs: orchestration and metric script.
- code/run-cross-tool-comparators.py: SigProfilerAssignment and MuSiCal comparator runner.
- code/run-deconstructsigs.R: comparator script.
- code/run-r-nnls.R: independent numerical solver check.
