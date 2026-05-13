# mSigSDK Manuscript Revision TODO

This checklist captures the manuscript revision strategy after adding QC, uncertainty, NMF, reporting, TCGA integration, and focused Observable notebooks.

Status note: items marked complete here have been completed as manuscript-ready draft assets in `docs/manuscript/REVISION_PACKAGE.md` or as benchmark infrastructure in `docs/manuscript/BENCHMARK_PROTOCOL.md` and `scripts/benchmark-manuscript.mjs`. The editable manuscript source still needs to be updated once available.

## Core Reframing

- [x] Reposition the paper from "private computation of mutation signatures" to "browser-native mutational signature data access, visualization, fitting, QC, uncertainty analysis, reporting, and exploratory extraction." Drafted in `docs/manuscript/REVISION_PACKAGE.md`.
- [x] Avoid broad claims such as "at scale" unless backed by benchmark data. Drafted as manuscript guidance.
- [x] Avoid presenting mSigSDK as a novel algorithm paper; frame it as a portable research SDK that combines public resources with local browser-side analysis. Drafted in revised positioning.
- [x] Clearly separate API orchestration, local computation, reused plotting components, and original SDK workflow helpers. Drafted in the execution-locus table.

## Reviewer 1 Response Items

- [x] Replace the unavailable `https://analysistools-dev.cancer.gov/mutational-signatures/` link with the production mSigPortal URL: `https://analysistools.cancer.gov/mutational-signatures/`. Added to revision package and project memory.
- [x] Rewrite the abstract opening so it no longer says "In our previous work..." unless the cited prior work includes the manuscript authors. Draft abstract added.
- [ ] Cite the correct mSigPortal and mSigSDK prior work.
- [x] State that this revision is substantially expanded relative to the previous preprint. Added as revision guidance.
- [x] List the new additions explicitly: QC, uncertainty analysis, threshold sensitivity, NMF, TCGA integration, import/export, reporting, provenance, and Observable notebooks. Added to draft abstract.

## Reviewer 2 Response Items

- [x] Add an execution-locus table showing which capabilities run locally and which depend on mSigPortal or TCGA APIs. Added to `docs/manuscript/REVISION_PACKAGE.md`.
- [x] Explain that mSigSDK uses public APIs for reference/cohort data and local browser computation for user-supplied spectra, fitting, QC, bootstrap, threshold sensitivity, NMF, and reporting. Added to draft abstract, methods, and execution-locus table.
- [x] Discuss browser computation limits honestly, especially for NMF and bootstrap workflows. Added to draft abstract, Figure 3 caption, and Discussion language.
- [ ] Add runtime and memory benchmarks for fitting, plotting, bootstrap, threshold sensitivity, and NMF. Node.js core-compute benchmark results have been generated in `docs/manuscript/benchmark-results.md`; browser rendering and browser heap measurements still need to be collected.
- [ ] Add at least one example or discussion relevant to low-mutation-count and rare-cancer settings. A controlled low-burden stress test has been generated in `docs/manuscript/low-burden-stress-test.json` and `docs/manuscript/tables/tableS3-low-burden-stress-test.md`; a real rare-cancer cohort remains preferred for final submission.
- [x] Avoid unsupported "AI benchmarking" claims unless actual AI/ML benchmark workflows are shown. Added to revision guidance.
- [x] Clarify that reused mSigPortal/COSMIC-style plots are intentional for domain consistency, not a claim of novel visualization algorithms. Added to draft abstract, methods, and Discussion.

## Figure 1 Revision

- [x] Redesign Figure 1 as an architecture and privacy-boundary schematic. Figure plan and caption drafted.
- [x] Include inputs: mSigPortal APIs, TCGA/GDC data, user MAF/spectra, and Observable notebooks. Included in Figure 1 plan.
- [x] Include SDK layers: data access, validation, fitting, QC, visualization, NMF, reporting, and workflows. Included in Figure 1 plan.
- [x] Include outputs: exposure tables, QC plots, signature profiles, reports, exported matrices, and reproducible notebooks. Included in Figure 1 plan.
- [x] Show the privacy boundary: public APIs provide reference/cohort data, while private user spectra remain in the browser. Included in Figure 1 plan and caption.

## Figure 2 Revision

- [x] Redesign Figure 2 as a research-grade known-signature fitting QC dashboard. Figure plan and caption drafted.
- [x] Include mutation burden QC with a user-defined threshold. Included in Figure 2 plan.
- [x] Include missing-context or validation summary. Included in Figure 2 plan.
- [x] Include local NNLS exposure fitting output. Included in Figure 2 plan.
- [x] Include observed-vs-reconstructed SBS96 spectrum using the established mSigPortal/COSMIC-style renderer. Included in Figure 2 plan.
- [x] Include reconstruction quality metrics: cosine similarity and RMSE. Included in Figure 2 plan.
- [x] Include bootstrap exposure uncertainty. Included in Figure 2 plan.
- [x] Include threshold sensitivity analysis. Included in Figure 2 plan.

## New Figure 3

- [x] Add a figure dedicated to exploratory browser-side NMF extraction. Figure plan and caption drafted.
- [x] Include NMF rank-selection diagnostics. Included in Figure 3 plan.
- [x] Include extracted SBS96 signature profiles using mSigPortal-style rendering. Included in Figure 3 plan.
- [x] Include COSMIC/reference matching by cosine similarity. Included in Figure 3 plan.
- [x] Include NMF exposure heatmap. Included in Figure 3 plan.
- [x] Include a note that browser NMF is intended for exploratory, moderate-sized datasets rather than production-scale extraction. Included in caption and Discussion.

## Methods Updates

- [x] Add SDK architecture and ES module design. Draft Methods text added.
- [x] Add mSigPortal and TCGA API integration. Draft Methods text added.
- [x] Add user data ingestion and MAF/spectrum conversion. Draft Methods text added.
- [x] Add local NNLS signature fitting. Draft Methods text added.
- [x] Add mutation burden and missing-context QC. Draft Methods text added.
- [x] Add reconstruction metrics: cosine similarity, RMSE, and residual spectra. Draft Methods text added.
- [x] Add bootstrap confidence intervals for exposure uncertainty. Draft Methods text added.
- [x] Add threshold sensitivity analysis. Draft Methods text added.
- [x] Add browser-side NMF extraction and rank selection. Draft Methods text added.
- [x] Add import/export, provenance, and report generation. Draft Methods text added.
- [x] Add Observable notebooks as executable examples. Draft Results and Supplementary plan added.

## Results Updates

- [x] Structure Results around workflows rather than feature marketing. Draft Results outline added.
- [x] Section 1: mSigSDK integrates public signature resources with browser-native analysis. Draft Results outline added.
- [x] Section 2: user-supplied spectra can be analyzed locally. Draft Results outline added.
- [x] Section 3: QC and uncertainty make fitting results auditable. Draft Results outline added.
- [x] Section 4: threshold sensitivity exposes unstable signature calls. Draft Results outline added.
- [x] Section 5: NMF enables exploratory de novo extraction in browser-sized datasets. Draft Results outline added.
- [x] Section 6: Observable notebooks provide reproducible interactive workflows. Draft Results outline added.

## Benchmarking

- [x] Benchmark 10, 100, 500, and 1000 samples by 96 SBS contexts. Results generated in `docs/manuscript/benchmark-results.md`.
- [x] Measure NNLS fitting time. Results generated in `docs/manuscript/benchmark-results.md`.
- [x] Measure bootstrap runtime at 100 and 500 iterations. Results generated in `docs/manuscript/benchmark-results.md`.
- [x] Measure threshold sensitivity runtime across 5 to 10 thresholds. Results generated in `docs/manuscript/benchmark-results.md`.
- [x] Measure NMF runtime across small and moderate sample counts. Results generated in `docs/manuscript/benchmark-results.md`.
- [ ] Measure plotting/rendering time.
- [ ] Measure approximate browser memory usage. Protocol added; browser measurements still pending.
- [x] Report hardware, browser, SDK version, and dataset dimensions. Reporting template added to `docs/manuscript/BENCHMARK_PROTOCOL.md`.

## Discussion Updates

- [x] Add a limitations paragraph that acknowledges API dependence for public resources. Draft Discussion language added.
- [x] State that local browser computation is scoped to interactive and moderate-sized workflows. Draft Discussion language added.
- [x] State that large-scale NMF remains better suited to dedicated pipelines. Draft Discussion language added.
- [x] Discuss low mutation burden and threshold-dependent signature calls. Draft Discussion language added.
- [x] Say that exposure thresholds should be user-defined and study-justified. Draft Discussion language added.
- [x] Present mSigSDK as complementary to SigProfiler-style pipelines, not a replacement. Draft Discussion language added.

## Supplementary Materials

- [x] Add a table of SDK namespaces and major functions. Draft Table S1 added to `docs/manuscript/REVISION_PACKAGE.md`.
- [x] Add links to focused Observable notebooks. Supplementary plan added; notebook list also exists in `docs/project/MEMORY.md`.
- [x] Add a report/provenance object example. Draft example added to `docs/manuscript/REVISION_PACKAGE.md`.
- [ ] Add benchmark data and browser/runtime details. Core Node.js compute benchmark data are now generated; browser rendering benchmark details remain pending.
- [x] Add examples showing import/export compatibility with SigProfiler/COSMIC-style matrices. Draft example added to `docs/manuscript/REVISION_PACKAGE.md`.
