# mSigSDK Revision Report

Generated: 2026-06-28  
Repository commit used for generated artifacts: `10c5ecfd1eb3394bd72c5027d7d6f5f9090a9be9`  
Host: Windows 11 Home 10.0.26200, AMD Ryzen 9 8940HX, 32 logical CPUs, 31.2 GiB RAM  
Node: `v24.13.0`  
Docker Desktop: `4.78.0`; Docker Engine: `29.5.3`

## Checklist

### Part A - Already-Completed Code Verification

| Item | Status | Evidence |
|---|---:|---|
| Runtime pins | DONE | amCharts `5.3.7` in `main.js:7`; Pyodide `v0.27.4` in `main.js:308` and `mSigSDKScripts/runners.js:2`; WebR `v0.6.0` in `main.js:310` and `mSigSDKScripts/runners.js:4`; pako `2.1.0` in `mSigSDKScripts/tcga.js:14`; PapaParse `5.5.3` in `mSigSDKScripts/userData.js:48`. |
| SHA-256 integrity verification | DONE | Pyodide package hash verification in `scripts/verify-bundled-runtime-integrity.mjs:6-27`; WebR package hash verification in `mSigSDKScripts/runners.js:89-125`; manifests in `docs/package-repos/pyodide/manifest.json` and `docs/package-repos/webr/manifest.json`. |
| `strictLocal` controls | DONE | Defaults and cache disable in `mSigSDKScripts/utils.js:27-60`; debug-gated logging in `mSigSDKScripts/utils.js:70-77`; block helper in `mSigSDKScripts/utils.js:83-88`; mSigPortal sample-specific block in `mSigSDKScripts/mSigPortalAPIs.js:178`; GDC blocks in `mSigSDKScripts/tcga.js:204`, `270`, `396`, `489`, `638`; UCSC live context block in `mSigSDKScripts/mutationalSpectrum.js:1239-1263`. |
| Smoke and verification scripts | DONE | Current rerun results: `test:report-schema` passed; `verify:runtime-integrity` verified 11 Pyodide and 8 WebR artifacts; `smoke:strict-local` reported `networkRequests: 0`; `smoke:webr-adapters`, `smoke:adapters`, `smoke:profile-conversions`, and `smoke:tcga-contexts` passed. |

### Part B - Outstanding Code

| Item | Status | Evidence |
|---|---:|---|
| Headless Node.js path | DONE | Example script at `examples/node-headless-fit.mjs:37-167`; README entry at `examples/README.md:9-19`. Current run: `node examples\node-headless-fit.mjs --output examples\node-headless-report.json --bootstrapIterations 5 --nmfSamples 6` wrote a valid report for sample `SP50263`, 67 signatures, 96 contexts, elapsed `82.7219` ms. Validated with `node scripts\validate-report-schema.mjs examples\node-headless-report.json`. Browser-only gaps documented in `examples/README.md:19`. |
| JSON report schema hardening | DONE | Report emits `schemaVersion` and `version` in `mSigSDKScripts/reports.js:40-41` and `128-129`; schema `$id`/`version`/required descriptions in `schemas/msig.report.v0.3/report.schema.json:4-157`; examples in `schemas/msig.report.v0.3/examples/`; compatibility policy in `schemas/msig.report.v0.3/VERSIONING.md:3-20`; validator checks valid and invalid examples in `scripts/validate-report-schema.mjs:15` and `152-166`. |
| Bootstrap parallelization | DONE | Added `bootstrapSignatureFitParallel` and `bootstrapCohortSignatureFitParallel` in `mSigSDKScripts/qc.js`; `runCohortFit` now uses the cohort worker path when `parallelBootstrap` is enabled in `mSigSDKScripts/guidance.js`; public SDK surface exposes both helpers through `main.js`; smoke test `npm.cmd run smoke:parallel-bootstrap` passed. |

### Part C - Experiments and Data Artifacts

| Item | Status | Artifact |
|---|---:|---|
| C1 Adapter-fidelity supplement | DONE | `docs/manuscript/experiments/e2_adapter_fidelity/data/adapter-fidelity-results.json`. All four browser/local pairs completed on 2026-06-27. deconstructSigs, sigminer, and SigProfilerAssignment had max abs diff `0`, RMSE `0`, mean/median cosine `1`, min cosine `0.9999999999999998`, top concordance `1`. MuSiCal had mean/median cosine `1`, min cosine `0.9999999999999997`, max abs diff `4.163336342344337e-15`, RMSE `2.5021563225878793e-16`, top concordance `1`. |
| C2 Internal-solver agreement | DONE | `docs/manuscript/experiments/e3_internal_reference_checks/data/reference-check-results.json`. NNLS vs SciPy max abs diff `1.6507328837178648e-9`; NNLS vs R `nnls` max abs diff `1.6511876310687512e-9`; NMF relative reconstruction-error ratio `0.9181517134362648`; NMF matched-component median cosine `0.9671475260412796`; QC max metric delta `7.771561172376096e-16`. |
| C3 Exposure-solve benchmarks | DONE | `docs/manuscript/experiments/e4_browser_runtime_benchmarks/data/browser-runtime-results.json` and `browser_runtime_summary.csv`. 600 completed rows: Chrome, Edge, Firefox; 5 scenarios; cold and warm phases; 20 isolated repeats per browser/scenario/phase. Stage fields include load, network fetch, module import, runtime init, pure-JS compute, serialization, and JS heap where available. |
| C4 End-to-end notebook benchmark | NOT-POSSIBLE | `docs/manuscript/experiments/e5_end_to_end_notebook_benchmark/data/end-to-end-notebook-benchmark-status.json`. The requested TCGA Lung-AdenoCA SBS96 120/500-sample public input was not available from tested API queries or local artifacts, so no Figure 5 data were synthesized. |
| C5 QC threshold registry | PARTIAL | Registry DONE in `docs/manuscript/experiments/qc_threshold_registry/data/qc_threshold_registry.csv` and `.json`, generated by `scripts/manuscript/extract-qc-threshold-registry.mjs:13-59`. Sensitivity analysis was not run; Figure S-QC was not generated. |
| C6 Hardware/scaling characterization | PARTIAL | Exposure-solve characterization remains in `docs/manuscript/experiments/hardware_scaling_characterization/data/hardware-scaling-characterization.json`. New synthetic bootstrap worker stress data are in `docs/manuscript/experiments/hardware_scaling_characterization/data/bootstrap-parallel-hardware-limits.json`, `bootstrap_parallel_hardware_limits.csv`, and `bootstrap_parallel_heap_cap_checks.csv`. This gives tested Node heap-cap lower bounds and worker scaling on the Windows host, but not universal browser/system-RAM minima. |
| C7 Cross-platform runs | NOT-POSSIBLE | `docs/manuscript/experiments/cross_platform_runs/data/cross-platform-availability.json`. No macOS or Linux host was available. |
| C8 Strict-local no-egress evidence | DONE | `docs/manuscript/experiments/strict_local_no_egress/data/strict-local-no-egress.json` and `strict_local_network_log.csv`. Monitored workflow: strictLocal fit + QC + NMF + report + bundled-context MAF conversion. Result: `networkRequests: 0`; log is empty. |

### Parts D-F - Assets, Tables, and Supplement

| Item | Status | Artifact |
|---|---:|---|
| Figures 1-4 | DONE | SVG/PDF/PNG files under `docs/manuscript/figures/`, generated in the original manuscript style by `scripts/manuscript/generate-main-assets.mjs` plus `scripts/manuscript/export-main-figure-assets.mjs`; export manifest: `docs/manuscript/figures/revision-figure-export-manifest.json`. |
| Figure 5 | NOT-POSSIBLE | `docs/manuscript/figures/figure5-end-to-end-notebook-runtime.NOT_GENERATED.md`; no synthetic replacement was created. |
| Figure S-QC | NOT-POSSIBLE | Sensitivity analysis was not run. |
| Table A | DONE | `docs/manuscript/tables/tableA_network_endpoints.csv` and `.md`; consistent with supplement audit. |
| Table 2 | DONE | `docs/manuscript/tables/table2_executable_adapters.csv` and `.md`; includes only executable adapter, version, runtime, and role. Integrity details remain in the supplement. |
| Table B | DONE | `docs/manuscript/tables/tableB_qc_thresholds.csv` and `.md`; concise QC review defaults only. Full source-level registry remains in `docs/manuscript/experiments/qc_threshold_registry/`. |
| Redundant copy-paste experiment tables | REMOVED | Retired `docs/manuscript/google-doc-tables/`; E1/E2/E3/E4/E6 numbers are covered by Figures 2-4 and machine-readable experiment/supplement files. |
| Supplement bundle | DONE | `docs/manuscript/supplement/`, including network audit, runtime/integrity manifest, adapter-fidelity record, strict-local evidence, benchmark files, and harness description. |

## Manuscript-Ready Asset Index

Regenerate all generated assets with:

```powershell
npm.cmd run assets:revision-figures
```

| Asset | Files | Script and input |
|---|---|---|
| Figure 1 - Architecture/data-residency | `docs/manuscript/figures/figure1-architecture-data-residency.svg`, `.pdf`, `.png` | Rendered from `scripts/manuscript/generate-main-assets.mjs:1042` and exported by `scripts/manuscript/export-main-figure-assets.mjs:15`; source HTML: `docs/manuscript/figures/figure1-architecture-data-residency.html`. |
| Figure 2 - Zero-install cumulative timing | `docs/manuscript/figures/figure2-zero-install-cumulative-timing.svg`, `.pdf`, `.png` | Rendered from `scripts/manuscript/generate-main-assets.mjs:1778` and exported by `scripts/manuscript/export-main-figure-assets.mjs:15`; input: `docs/manuscript/experiments/e1_zero_install_demo/data/zero-install-results.json`. |
| Figure 3 - Public-cohort capability | `docs/manuscript/figures/figure3-public-cohort-capability.svg`, `.pdf`, `.png` | Rendered from `scripts/manuscript/generate-main-assets.mjs:2260` and exported by `scripts/manuscript/export-main-figure-assets.mjs:15`; input: `docs/manuscript/experiments/e2_adapter_fidelity/data/adapter-fidelity-input.json`; output data: `docs/manuscript/data/main-figure3-public-cohort.json`. |
| Figure 4 - Exposure-solve scenarios only | `docs/manuscript/figures/figure4-exposure-solve-benchmarks.svg`, `.pdf`, `.png` | Rendered from `scripts/manuscript/generate-main-assets.mjs:2730` and exported by `scripts/manuscript/export-main-figure-assets.mjs:15`; input: `docs/manuscript/experiments/e4_browser_runtime_benchmarks/data/browser-runtime-results.json`. |
| Figure 5 - End-to-end notebook runtime | Not generated | Status: `docs/manuscript/figures/figure5-end-to-end-notebook-runtime.NOT_GENERATED.md`; source unavailable. |
| Figure S - Bootstrap worker hardware stress | `docs/manuscript/figures/figureS-bootstrap-hardware-limits.svg` | `npm.cmd run assets:bootstrap-hardware`; input: `docs/manuscript/experiments/hardware_scaling_characterization/data/bootstrap-parallel-hardware-limits.json`; script: `scripts/manuscript/generate-bootstrap-hardware-assets.mjs`. |
| Table A | `docs/manuscript/tables/tableA_network_endpoints.csv`, `.md` | `scripts/manuscript/generate-revision-assets.mjs:608-609`; row definitions begin at `scripts/manuscript/generate-revision-assets.mjs:730`. |
| Table 2 | `docs/manuscript/tables/table2_executable_adapters.csv`, `.md` | `scripts/manuscript/generate-revision-assets.mjs:606-607`; row definitions begin at `scripts/manuscript/generate-revision-assets.mjs:621`. |
| Table B | `docs/manuscript/tables/tableB_qc_thresholds.csv`, `.md` | Principal subset generated by `scripts/manuscript/generate-revision-assets.mjs:610-611`; row definitions begin at `scripts/manuscript/generate-revision-assets.mjs:655`. Full registry source remains `docs/manuscript/experiments/qc_threshold_registry/data/qc_threshold_registry.csv`. |
| Table C | `docs/manuscript/tables/tableC_bootstrap_hardware_limits.csv`, `.md` | `npm.cmd run assets:bootstrap-hardware`; input: `docs/manuscript/experiments/hardware_scaling_characterization/data/bootstrap-parallel-hardware-limits.json`; script: `scripts/manuscript/generate-bootstrap-hardware-assets.mjs`. |
| Supplement | `docs/manuscript/supplement/supplement-manifest.json` plus files in same directory | `scripts/manuscript/generate-revision-assets.mjs:783-921`. |

## Discrepancies

| Draft/current claim to reconcile | Draft value | Regenerated value or status |
|---|---:|---|
| Zero-install cumulative steps | `1.55 -> 1.87 -> 1.89 s` | Current Chrome fresh-profile run: SDK imported `4.713035 s`; mSigPortal data fetched `4.969470 s`; single-sample fit completed `4.990540 s`; report generated `4.993 s`; total row elapsed `4.993235 s`. See `docs/manuscript/experiments/e1_zero_install_demo/data/zero-install-results.json`. |
| Adapter fidelity for all four tools | all four reconfirmed | Regenerated on 2026-06-27 against the current SDK: deconstructSigs and sigminer via local Rscript comparators; SigProfilerAssignment and MuSiCal via Dockerized Python comparators. All four passed. |
| End-to-end notebook benchmark at 120/500 samples | bootstrap dominates about 95%, zero workers | Not measured. Requested TCGA Lung-AdenoCA SBS96 input was unavailable; no Figure 5 was generated. |
| Hardware minimum/recommended requirements | implied by benchmark suite | New synthetic Node worker stress tests passed with 128 MiB Node heap cap for a single 500-iteration bootstrap and 256 MiB for a 120-sample x 25-iteration cohort bootstrap; measured median peak RSS was 259 MiB for single-sample four-worker bootstrap and 546 MiB for 120-sample four-worker cohort bootstrap. These are tested lower bounds for synthetic Node workloads, not universal browser/system-RAM minima. |
| Headless Node.js support | Node 18+ | Code path is written for Node 18+, but this environment actually ran Node `v24.13.0`. Do not state Node 18 was directly tested here. |

## Claims Not Supported by This Run

- Adapter-fidelity agreement is supported for the tested 38-sample SBS96 Lung-AdenoCA/COSMIC v3 GRCh37 benchmark only; do not generalize it to other profile classes, catalogs, tumor types, or genome builds without additional reruns.
- End-to-end notebook runtime at 120 and 500 TCGA Lung-AdenoCA samples, bootstrap `~95%` dominance, and zero-worker confirmation for that notebook path are not supported by measurements from this host.
- Cross-platform browser benchmark claims for macOS or Linux are not supported.
- Any claim that Figure 5/end-to-end notebook bootstrap dominance was measured should still be removed or softened.
- Any precise browser/system-RAM minimum should be softened; the new lower-bound checks are Node heap-cap checks on synthetic workloads, not direct low-RAM browser-machine tests.

## Verification Log

- `npm.cmd run test:report-schema`: passed; representative output and 2 valid examples validated; invalid example failed as expected.
- `npm.cmd run verify:runtime-integrity`: passed; 11 Pyodide artifacts and 8 WebR artifacts verified.
- `npm.cmd run smoke:strict-local`: passed; `networkRequests: 0`.
- `npm.cmd run smoke:webr-adapters`: passed in Chrome; WebR `v0.6.0`; deconstructSigs `1.8.0`; sigminer `2.3.1`.
- `npm.cmd run smoke:adapters`: passed; Node worker capabilities unavailable as expected outside the browser.
- `npm.cmd run smoke:profile-conversions`: passed.
- `npm.cmd run smoke:tcga-contexts`: passed.
- `node examples\node-headless-fit.mjs --output examples\node-headless-report.json --bootstrapIterations 5 --nmfSamples 6`: passed.
- `node scripts\validate-report-schema.mjs examples\node-headless-report.json`: passed.
- `npm.cmd run smoke:parallel-bootstrap`: passed; single-sample, cohort, and `runCohortFit` worker bootstrap paths all used Node worker threads in this environment.
- `npm.cmd run experiment:bootstrap-hardware`: passed; generated synthetic bootstrap worker stress JSON/CSV artifacts under `docs/manuscript/experiments/hardware_scaling_characterization/data/`.
- `npm.cmd run experiment:e2-adapter-fidelity -- --local-rscript Rscript`: passed; regenerated all four browser/local adapter-fidelity pairs. R comparators used local Rscript and `.tools/r-library/R-4.6`; Python comparators used Docker `python:3.11-slim`.
- `npm.cmd run assets:revision-figures`: passed on 2026-06-28; regenerated Figures 1-4 as HTML/SVG/PDF/PNG and wrote `docs/manuscript/figures/revision-figure-export-manifest.json`.
- `node scripts\manuscript\generate-assets.mjs`: passed on 2026-06-28; regenerated supplementary experiment figure HTML, including `figure-e2-adapter-fidelity.html` from the all-four-tool adapter-fidelity result.
- `npm.cmd run assets:bootstrap-hardware`: passed on 2026-06-28; regenerated `figureS-bootstrap-hardware-limits.svg` and Table C.
- `node scripts\manuscript\generate-revision-assets.mjs`: passed on 2026-06-28; regenerated tables and supplement records from current data.

## Environment Record

| Run family | Environment |
|---|---|
| Asset generation, schema, strict-local, internal references, Node headless | Windows 11 Home 10.0.26200; AMD Ryzen 9 8940HX; 32 logical CPUs; 31.2 GiB RAM; Node `v24.13.0`; commit `10c5ecfd1eb3394bd72c5027d7d6f5f9090a9be9`. |
| Browser benchmarks | Same Windows host; Chrome `149.0.7827.158`; Edge `149.0.4022.80`; Firefox `150.0.2`; 20 repeats per scenario/browser/phase. |
| Internal Python reference | `D:\Programs\Miniconda3\python.exe`; Python `3.13.5`; NumPy `2.4.3`; SciPy `1.16.1`; scikit-learn `1.7.1`. |
| Internal R reference | `Rscript`; R `4.6.0`; local library `.tools/r-library/R-4.6`; `nnls` package. |
| Adapter fidelity local references | R references completed for deconstructSigs and sigminer using local Rscript and `.tools/r-library/R-4.6`; Python references completed for SigProfilerAssignment and MuSiCal using Docker Desktop `4.78.0`, Docker Engine `29.5.3`, and `python:3.11-slim`. |
