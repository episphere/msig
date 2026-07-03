# Response to Editor - Revised Working Draft

Author note: this is an author-facing working draft. Completed code, figures, tables, and supplements are written in response-ready prose. Items still not completed are marked as **Author action - outstanding** and should either be completed before submission or retained honestly as limitations.

We thank the editor and all five reviewers for their careful evaluation. We have made substantial revisions, with the largest changes concentrated in three areas on which the reviewers converged: the privacy and data-residency model, reproducibility detail, and the interpretation of runtime benchmarks. In response, we hardened the SDK's supply-chain and data-residency behavior through runtime version pinning, SHA-256 integrity verification of bundled package artifacts, and a new strict-local mode that disables network paths capable of transmitting user-derived data. We also corrected benchmark scoping, regenerated the main figures and retained only nonredundant manuscript tables, narrowed validation claims to the tested setting, and strengthened the JSON report schema and headless Node.js path.

**Author action - outstanding:** Confirm that the data-availability declaration has been completed in the journal submission system. This is the editor's administrative point and cannot be verified from the repository.

## Reviewer 1

### 1. Intended audience and undefined terminology

We agree that the original introduction assumed dual expertise. We have revised the framing to define key terms on first use, including software development kit (SDK), mutational signature exposure, fitting versus de novo extraction, and browser-native/client-side execution.

**Completed in manuscript:** The Introduction and Implementation now define the SDK, exposure fitting, de novo extraction, bootstrap uncertainty, QC, MAF conversion, browser execution, and Node execution at first substantive use.

### 2. Privacy, browser vulnerabilities, and JavaScript supply-chain risks

This comment was well taken. We softened the privacy framing and strengthened the implementation rather than relying on reassurance alone. We completed a full data-residency and endpoint audit; pinned WebR to v0.6.0, Pyodide to v0.27.4, amCharts to 5.3.7, pako to 2.1.0, and PapaParse to 5.5.3; added SHA-256 integrity verification for bundled Pyodide wheels and WebR package artifacts before installation; and added an optional strict-local mode that disables mSigPortal sample-specific fetches, GDC calls, UCSC live MAF-context lookup, cache persistence, and default identifier logging. The strict-local workflow was rerun with network monitoring and produced an empty network log with `networkRequests: 0`.

We now explicitly state the residual trust boundary: CDN-delivered ESM modules are version-pinned but not SRI-verified, because the dynamic import paths used by the SDK do not carry browser SRI metadata. Browser-native execution therefore improves data residency for selected workflows but is not a formal security guarantee against all browser or supply-chain threats.

Completed artifacts include the endpoint/data-residency table, the runtime/integrity manifest, and the strict-local no-egress evidence in the supplement.

### 3. Public API reliance, availability, and data integrity

We added a more balanced description of the public-API design. Bundled runtime/package artifacts are now SHA-256 verified against recorded manifests, so local package substitution or corruption is detected before use. We do not claim equivalent hash verification for arbitrary public API responses. Upstream public APIs can still change, withdraw, or temporarily fail to serve data, and we now identify this as a reproducibility and availability limitation. The mitigations are provenance recording, explicit endpoint documentation, and a strict-local/offline path for workflows that can use local spectra and bundled/offline context data.

**Author action - outstanding:** If the Discussion still says or implies that public API responses themselves are hash-verified, remove that overclaim.

### 4. Runtime discrepancy between the demo and manuscript benchmark

We thank the reviewer for identifying this discrepancy. We found that the original benchmark mixed scopes. The expanded benchmark now labels Figure 4 as **exposure-solve scenarios only** and reports distributions from 20 isolated repeats per browser, with separate cold and warm phases and stage fields for load, network fetch, module import, runtime initialization, pure-JS compute, serialization, and heap where available. These data were generated for Chrome, Edge, and Firefox on the available Windows host.

The reason the benchmark is much faster than the demonstration notebook is that it times the named computational kernels rather than the whole notebook workflow. The notebook's default "fit and review" path includes input validation, cohort setup, full-catalog fitting, QC evidence refresh, threshold review, bootstrap uncertainty across samples, report/provenance assembly, and plotting. The benchmarked 120-sample scenario, by contrast, is the NNLS exposure solve itself after the SDK and inputs are already loaded. We now make this scope distinction explicit instead of asking readers to infer it.

We also corrected the zero-install timing figure to label steps as cumulative from page-load start. The current cold fresh-profile Chrome run is 4.993 s to report-ready, with SDK import resolving at 4.713 s. This differs from the older 1.894 s artifact and should be treated as a real discrepancy rather than silently overwritten.

No separate Figure 5 is needed for the response if we clearly explain this scoping correction. We should not claim that a 120/500-sample end-to-end TCGA notebook benchmark was completed, but we can and should explain why the exposure-solve benchmark is faster than the end-to-end notebook analysis.

## Reviewer 2

### 1. Title and "private computation" framing

We agree that "private computation" can imply a stronger guarantee than the SDK provides by default. The revised work supports a more precise claim: strict-local mode can run selected workflows with verified zero network egress, while the default browser-native mode still may contact documented public endpoints and load pinned third-party web assets.

**Completed in manuscript:** The title was changed to emphasize browser-native client-side computation, and "strict-local" is reserved for the specific no-egress mode.

### 2. Algorithmic details

The implementation supports NNLS exposure fitting, NMF extraction, bootstrap uncertainty, QC evidence, reporting-mode assignment, MAF-to-profile conversion, and report serialization.

**Completed in manuscript:** The Implementation now includes concise descriptions of NNLS exposure fitting, NMF extraction, multinomial bootstrap, QC reporting modes, and MAF-to-profile conversion.

### 3. Reproducibility detail

We added pinned runtime versions, package manifests, integrity verification, schema validation examples, benchmark artifacts, and a supplement bundle. Internal solver checks were rerun: NNLS agreed with SciPy within `1.6507328837178648e-9`, NNLS agreed with R `nnls` within `1.6511876310687512e-9`, NMF had relative reconstruction-error ratio `0.9181517134362648`, matched-component median cosine `0.9671475260412796`, and QC metric delta `7.771561172376096e-16`.

The adapter-fidelity evidence has now been regenerated against the current SDK for all four wrapped tools. The browser-vs-local comparison used 38 PCAWG Lung-AdenoCA SBS96 spectra and the 67-signature COSMIC v3 GRCh37 SBS96 catalog. deconstructSigs and sigminer were compared with local Rscript references; SigProfilerAssignment and MuSiCal were compared with Dockerized Python references. All four passed with mean and median exposure-vector cosine `1` and top-signature concordance `1`; deconstructSigs, sigminer, and SigProfilerAssignment had max absolute difference `0` and RMSE `0`, while MuSiCal differed only at floating-point scale (max absolute difference `4.163336342344337e-15`, RMSE `2.5021563225878793e-16`).

No additional adapter rerun is required for this response unless the manuscript scope changes to new tumor types, profile classes, genome builds, or catalogs.

### Minor 1. Dense abstract Results paragraph

We will shorten the abstract by separating the SDK feature description from validation results and by avoiding dense enumeration.

**Completed in manuscript:** The abstract Results and Conclusions were edited to separate feature description from validation scope and to avoid unsupported claims.

### Minor 2. QC threshold rationale

We extracted the QC threshold registry and retained a concise manuscript table of principal QC review defaults. The table identifies the evidence area, default rule, and interpretation, and the supplement retains the full source-level registry.

We did not add a cohort-specific threshold-sensitivity figure as a validation claim, because the thresholds are deliberately user-configurable review settings rather than proposed universal or calibrated biological cutoffs. A sensitivity sweep on one 38-sample lung-adenocarcinoma cohort could easily overstate generality. The manuscript instead provides the threshold registry, states that defaults are convenience values rather than consensus cut points, and instructs users to tune thresholds to their catalog, cohort, assay, and reporting context.

### Minor 3. Verbose Discussion

We agree and will condense the Discussion to focus on the strongest supported contributions: browser-native execution, data-residency controls, executable adapters where validated, strict-local no-egress evidence, and transparent limitations.

**Completed in manuscript:** The Discussion was condensed around the supported contributions and limitations.

## Reviewer 3

### 1. Single-machine testing and hardware requirements

We expanded the browser benchmark suite on the available Windows host to Chrome, Edge, and Firefox, with 20 repeats per browser/scenario/phase. We also added synthetic bootstrap worker stress tests for the native JavaScript path. These data should be framed as observed performance on the measured host and tested Node heap-cap lower bounds, not as universal browser/system-RAM minimum requirements.

No macOS or Linux host was available in this environment. A cross-platform availability artifact records this limitation rather than synthesizing results. The manuscript should distinguish browser/runtime portability in principle from direct performance measurements, which are scoped to the tested Windows Chrome/Edge/Firefox environment.

**Author action - outstanding:** If cross-platform results are important for the response, they must be run on actual macOS/Linux hosts. Otherwise state the limitation plainly.

### 2. Console-first demo and usability for non-developers

We agree that a developer-console entry point is not appropriate as the primary workflow for non-developers. The completed work now includes a headless Node.js example for scripting/CI users, but it does not replace a GUI or notebook usability pass.

**Author action - outstanding:** Demo-page usability work has not been completed here. Do not claim new copy-paste controls, demo-data buttons, input validators, or redesigned getting-started UI unless those are actually implemented.

## Reviewer 4

### 1. Privacy/security threat model and endpoint audit

Addressed as described above. We now provide a concise endpoint/data-residency table for the manuscript and a complete supplementary endpoint audit. The audit distinguishes data never transmitted by the SDK, public identifiers transmitted only when public-data fetchers are invoked, and live UCSC context lookup of mutation coordinates, which is disabled in strict-local mode. Identifier logging is now gated by `debug` and cache persistence is disabled under strict-local mode.

### 2. Narrow validation scope

We have taken the narrow-claims path. The completed validation artifacts support SBS96 lung-adenocarcinoma fitting against COSMIC v3/GRCh37 in the tested settings, internal solver agreement, and four-tool adapter-fidelity confirmation for the tested browser/local comparator paths. Other tumor types, sequencing strategies, genome builds, profile types, and clinical/reporting contexts should be described as supported or planned capabilities only where the code supports them, not as independently validated biological use cases.

**Completed in manuscript:** The validation language was narrowed to SBS96 lung-adenocarcinoma fitting against the tested COSMIC catalog, with other profile types and settings described as implemented but not separately validated here.

### 3. Adapter fidelity versus biological validity

We clarified that adapter agreement evaluates executable adapter fidelity: whether the browser/WebR/Pyodide path reproduces the corresponding local tool output under matched inputs and options. It does not independently validate the biological correctness of the underlying methods or signatures.

For the response, cite the existing all-four fidelity figure for the browser-vs-local comparison and cite the regenerated R-backed rerun as added reproducibility evidence. Do not frame this as needing to redo the comparison from scratch.

### 4. Benchmarks, decomposition, and cumulative timing labels

The expanded exposure-solve benchmark is complete for the available Windows browsers: Chrome, Edge, and Firefox; five scenarios; cold and warm phases; 20 isolated repeats per browser/scenario/phase; and stage fields for load, network fetch, module import, runtime initialization, pure-JS compute, serialization, and available JS heap. Figure 4 now presents exposure-solve scenarios only, with medians and IQR rather than bare medians.

Figure 2 now labels zero-install timings as cumulative from page-load start. The current generated value is 4.993 s to report-ready in a cold fresh Chrome profile.

**Author action - outstanding:** The requested end-to-end notebook benchmark was not generated. Do not claim bootstrap accounts for approximately 95% of a measured 120/500-sample notebook path from this run.

### 5. JSON schema language and validation tooling

This item is complete in code/artifacts. The report schema now has an explicit `$id` and `version`; report output includes `schemaVersion` and `version`; examples include minimal and full valid reports plus an intentionally invalid report; the validator checks valid examples and confirms the invalid example fails; and a versioning/compatibility policy file is present.

The manuscript should call this a proposed/versioned report format, not a community standard.

### 6. QC/reporting claims, thresholds, and research-use boundaries

The concise QC threshold table and full registry are complete. We state that the defaults are configurable review defaults, not community consensus thresholds or clinically calibrated cut points.

EHR/clinical-decision language was removed or qualified as outside scope. We do not claim threshold calibration or universal robustness; the stronger and more honest response is that users should prespecify or tune these thresholds for their own cohort/dataset.

### Minor comments

Completed artifact changes include the updated data-residency Figure 1, cumulative zero-install Figure 2, regenerated public-cohort Figure 3, exposure-solve Figure 4, retained concise tables, and the supplement bundle. Remaining minor prose edits include standardized terminology, the shortened abstract, and a sentence distinguishing this version from the prior preprint.

## Reviewer 5

### Major comment: Public versus controlled-access data

The endpoint audit confirms that SDK public-data fetchers use open/derived resources through unauthenticated requests. No code path sets an authentication token or signs in, and sign-in does not expand access in the current version. Controlled-access GDC downloads requiring an `X-Auth-Token` are not used.

**Completed in manuscript, except optional coverage statistics:** The manuscript now clarifies public/derived unauthenticated data access versus controlled-access data. Optional coverage statistics for all available public endpoints were not generated here.

### Major comment: CLI/headless interface and workflow compatibility

The native JavaScript core is now invocable from Node.js through runnable examples. We added a copy-paste browser-console workflow (`examples/browser-console-fit.js`), a compact Node quick-fit workflow (`examples/node-console-fit.mjs`), and a fuller headless report-writing example (`examples/node-headless-fit.mjs`). The Node examples load public spectra/catalogs, fit exposures, run QC and worker-backed bootstrap, and either print a compact JSON summary or write a schema-valid JSON report. They were run successfully in this environment with Node `v24.13.0`.

Browser-only capabilities remain DOM/canvas rendering and the browser WebR/Pyodide runtime paths. The browser-console example imports the public browser SDK entry point; the Node examples import native computational modules directly because Node does not natively load browser/CDN `https:` ECMAScript imports from `main.js`. CWL and a formal CLI wrapper remain future work, but the headless Node path provides the foundation for scripting and CI use.

**Author action - outstanding:** The implementation targets Node 18+, but this environment directly tested Node 24. Do not state Node 18 was directly tested unless it is run under Node 18.

### Major comment: Intended user and delivery mechanism

We clarified the intended audiences: SDK developers and computational users can use the JavaScript/Node interfaces, while non-developer wet-lab users need a graphical or notebook-mediated entry point. The response should acknowledge that the console-first path is not the intended final interface for non-developers.

**Author action - outstanding:** Do not claim a completed GUI redesign unless it is actually implemented.

### Major comment: Data-size limits and bottlenecks

The completed browser benchmarks show exposure-solve performance across representative scenarios on the Windows host. The available evidence supports framing the main cohort-scale constraint as client-side computation, especially bootstrap when enabled, rather than public API latency. Bootstrap is no longer purely serial: the SDK now includes `bootstrapSignatureFitParallel`, `bootstrapCohortSignatureFitParallel`, and a `runCohortFit` `parallelBootstrap` path. Synthetic stress tests show improved worker performance, but end-to-end 120/500-sample notebook timing and a true low-RAM browser-machine stress test were not completed.

**Author action - outstanding:** Phrase hardware and scaling guidance conservatively as measured on the available host. The new heap-cap checks are Node.js synthetic lower-bound checks, not universal browser RAM requirements.

### Major comment: Cross-session persistence

The default non-persistence of user-derived data is deliberate and consistent with the data-residency model. Results can be exported as self-contained JSON/HTML reports. Browser-native persistence options such as IndexedDB or the File System Access API are reasonable future enhancements, but they are not implemented as part of this revision.

### Minor comments

We will correct the prose issue noted by the reviewer, revise the Results into more neutral reporting, keep JSON schema language precise, and state the cross-platform testing limitation plainly.

## Completed Materials To Cite In The Response

- `REVISION_REPORT.md`
- `docs/manuscript/figures/figure1-architecture-data-residency.svg/.pdf/.png`
- `docs/manuscript/figures/figure2-zero-install-cumulative-timing.svg/.pdf/.png`
- `docs/manuscript/figures/figure3-public-cohort-capability.svg/.pdf/.png`
- `docs/manuscript/figures/figure4-exposure-solve-benchmarks.svg/.pdf/.png`
- `docs/manuscript/tables/tableA_network_endpoints.md/.csv`
- `docs/manuscript/tables/table2_executable_adapters.md/.csv`
- `docs/manuscript/tables/tableB_qc_thresholds.md/.csv`
- `docs/manuscript/tables/tableC_bootstrap_hardware_limits.md/.csv`
- `docs/manuscript/figures/figureS-bootstrap-hardware-limits.svg`
- `docs/manuscript/supplement/`
- `examples/browser-console-fit.js`
- `examples/node-console-fit.mjs`
- `examples/console-and-node-workflows.md`
- `examples/node-headless-fit.mjs`
- `schemas/msig.report.v0.3/`
- `scripts/smoke-parallel-bootstrap.mjs`
- `scripts/manuscript/run-bootstrap-hardware-limits.mjs`
- `scripts/manuscript/generate-bootstrap-hardware-assets.mjs`
- `docs/manuscript/experiments/hardware_scaling_characterization/data/bootstrap-parallel-hardware-limits.json`
- `docs/manuscript/experiments/hardware_scaling_characterization/data/bootstrap_parallel_hardware_limits.csv`
- `docs/manuscript/experiments/hardware_scaling_characterization/data/bootstrap_parallel_heap_cap_checks.csv`
- `docs/manuscript/experiments/hardware_scaling_characterization/bootstrap-parallel-hardware-limits-summary.md`

## Do Not Claim Yet

- Do not claim Figure 5/end-to-end notebook benchmark data were generated; explain the benchmark-scope distinction instead.
- Do not claim approximately 95% bootstrap dominance for the requested 120/500-sample notebook path from this run.
- Do not generalize the four-tool adapter-fidelity result beyond the tested 38-sample SBS96 Lung-AdenoCA/COSMIC v3 GRCh37 benchmark.
- Do not claim performance measurements outside the tested Windows Chrome/Edge/Firefox environment.
- Do not claim universal browser/system-RAM minimums from the Node heap-cap stress tests.
- Do not claim Node 18 was directly tested in this environment.
- Do not claim clinical/EHR readiness or calibrated clinical QC thresholds.
- Do not claim public API responses are hash-verified; only bundled runtime/package artifacts are integrity-verified.
