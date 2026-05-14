# mSigSDK Manuscript Benchmark Results

Generated: 2026-05-13T11:36:18.754Z

| useCase | sequencing | samples | mutationsPerSample | contexts | signatures | operation | iterations | thresholds | ranks | runtimeMs | heapDeltaMB | rssDeltaMB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Single-sample WGS review | WGS | 1.00 | 5000.00 | 96.00 | 24.00 | validation_qc |  |  |  | 0.92 | 0.11 | 0.07 |
| Single-sample WGS review | WGS | 1.00 | 5000.00 | 96.00 | 24.00 | nnls_fit |  |  |  | 12.78 | 1.24 | 2.37 |
| Single-sample WGS review | WGS | 1.00 | 5000.00 | 96.00 | 24.00 | reconstruction_metrics |  |  |  | 1.13 | -1.01 | 0.01 |
| Single-sample WGS review | WGS | 1.00 | 5000.00 | 96.00 | 24.00 | threshold_sensitivity |  | 0, 0.01, 0.03, 0.05, 0.1 |  | 12.63 | 0.45 | 0.29 |
| Single-sample WGS review | WGS | 1.00 | 5000.00 | 96.00 | 24.00 | bootstrap_one_sample | 500.00 |  |  | 446.37 | 1.85 | 4.87 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | validation_qc |  |  |  | 1.92 | -2.22 | 0.13 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | nnls_fit |  |  |  | 15.37 | 0.66 | 0.16 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | reconstruction_metrics |  |  |  | 2.22 | 0.30 | 0.00 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | threshold_sensitivity |  | 0, 0.01, 0.03, 0.05, 0.1 |  | 13.10 | 6.44 | 7.92 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | bootstrap_one_sample | 100.00 |  |  | 32.71 | -2.57 | 0.56 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | validation_qc |  |  |  | 2.22 | 2.54 | 0.00 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | nnls_fit |  |  |  | 7.77 | -5.03 | 0.06 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | reconstruction_metrics |  |  |  | 2.35 | -0.70 | 0.09 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | threshold_sensitivity |  | 0, 0.01, 0.03, 0.05, 0.1 |  | 22.39 | 7.34 | 0.36 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | bootstrap_one_sample | 100.00 |  |  | 41.97 | -4.75 | 0.37 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | validation_qc |  |  |  | 3.86 | 0.49 | 0.30 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | nnls_fit |  |  |  | 35.05 | 0.03 | 0.12 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | reconstruction_metrics |  |  |  | 9.75 | 5.06 | 2.41 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | threshold_sensitivity |  | 0, 0.01, 0.03, 0.05, 0.1 |  | 76.17 | 9.60 | 15.99 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | bootstrap_one_sample | 100.00 |  |  | 65.83 | -13.18 | 0.30 |
| Portal-scale cohort review | WGS | 300.00 | 1500.00 | 96.00 | 40.00 | validation_qc |  |  |  | 10.03 | -9.75 | 0.92 |
| Portal-scale cohort review | WGS | 300.00 | 1500.00 | 96.00 | 40.00 | nnls_fit |  |  |  | 181.32 | 4.16 | 0.00 |
| Portal-scale cohort review | WGS | 300.00 | 1500.00 | 96.00 | 40.00 | reconstruction_metrics |  |  |  | 25.44 | -1.90 | 3.09 |
| Portal-scale cohort review | WGS | 300.00 | 1500.00 | 96.00 | 40.00 | threshold_sensitivity |  | 0, 0.01, 0.03, 0.05, 0.1 |  | 287.18 | 18.32 | 12.30 |
| Portal-scale cohort review | WGS | 300.00 | 1500.00 | 96.00 | 40.00 | bootstrap_one_sample | 100.00 |  |  | 121.59 | -0.77 | 2.09 |
| Exploratory discovery cohort | WGS/WES | 30.00 | 1200.00 | 96.00 |  | nmf_rank_selection | 75.00 |  | 2, 3, 4 | 583.75 | -5.05 | 0.67 |
| Exploratory discovery cohort | WGS/WES | 30.00 | 1200.00 | 96.00 |  | nmf_extract_recommended_rank | 75.00 |  | 4 | 177.42 | 4.23 | 0.10 |
| Medium exploratory discovery cohort | WGS | 80.00 | 1500.00 | 96.00 |  | nmf_rank_selection | 75.00 |  | 2, 3, 4 | 2228.92 | -8.83 | 1.12 |
| Medium exploratory discovery cohort | WGS | 80.00 | 1500.00 | 96.00 |  | nmf_extract_recommended_rank | 75.00 |  | 4 | 782.75 | 2.14 | 0.39 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | v03_analysis_advisor |  |  |  | 5.52 | 6.77 | 0.07 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | v03_fit_quality_evidence |  |  |  | 11.14 | 1.84 | 0.22 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | v03_restricted_assay_evidence |  |  |  | 2.89 | -13.06 | 0.29 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | v03_panel_workflow |  |  |  | 30.92 | 7.41 | 0.64 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | v03_analysis_advisor |  |  |  | 10.15 | -0.31 | 0.20 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | v03_fit_quality_evidence |  |  |  | 16.28 | 0.36 | 0.75 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | v03_cohort_fit_pipeline |  |  |  | 53.60 | -9.93 | 2.69 |
| Rare-cancer cohort | WES/WGS | 12.00 | 300.00 | 96.00 | 18.00 | v03_subgroup_discovery | 75.00 |  | 2 | 55.12 | 3.35 | -1.28 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | v03_analysis_advisor |  |  |  | 64.48 | -4.36 | 1.19 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | v03_fit_quality_evidence |  |  |  | 50.95 | 3.49 | 2.02 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | v03_cohort_fit_pipeline |  |  |  | 209.60 | 2.21 | 3.45 |

Memory deltas are process-level estimates and should be interpreted as approximate.
