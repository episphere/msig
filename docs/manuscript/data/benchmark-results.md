# mSigSDK Manuscript Benchmark Results

Generated: 2026-05-14T15:05:50.147Z

| useCase | sequencing | samples | mutationsPerSample | contexts | signatures | operation | iterations | thresholds | ranks | repeats | runtimeMedianMs | runtimeMinMs | runtimeMaxMs | heapDeltaMB | rssDeltaMB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Single-sample WGS review | WGS | 1.00 | 5000.00 | 96.00 | 24.00 | validation_qc |  |  |  | 5.00 | 0.16 | 0.13 | 1.09 | 0.11 | 0.12 |
| Single-sample WGS review | WGS | 1.00 | 5000.00 | 96.00 | 24.00 | nnls_fit |  |  |  | 5.00 | 6.68 | 0.49 | 7.64 | -0.13 | 0.02 |
| Single-sample WGS review | WGS | 1.00 | 5000.00 | 96.00 | 24.00 | reconstruction_metrics |  |  |  | 5.00 | 1.25 | 0.97 | 2.34 | -0.44 | 0.05 |
| Single-sample WGS review | WGS | 1.00 | 5000.00 | 96.00 | 24.00 | threshold_sensitivity |  | 0, 0.01, 0.03, 0.05, 0.1 |  | 5.00 | 3.23 | 3.12 | 6.29 | 0.13 | 0.06 |
| Single-sample WGS review | WGS | 1.00 | 5000.00 | 96.00 | 24.00 | bootstrap_one_sample | 500.00 |  |  | 5.00 | 337.23 | 328.39 | 415.31 | -0.22 | 0.92 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | validation_qc |  |  |  | 5.00 | 1.43 | 1.04 | 1.62 | 1.60 | -0.08 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | nnls_fit |  |  |  | 5.00 | 0.91 | 0.85 | 8.57 | 1.49 | 0.00 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | reconstruction_metrics |  |  |  | 5.00 | 1.21 | 1.16 | 1.54 | 3.61 | 0.00 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | threshold_sensitivity |  | 0, 0.01, 0.03, 0.05, 0.1 |  | 5.00 | 8.56 | 8.47 | 8.84 | 5.00 | 0.07 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | bootstrap_one_sample | 100.00 |  |  | 5.00 | 18.93 | 17.47 | 20.08 | 0.98 | 0.17 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | validation_qc |  |  |  | 5.00 | 1.44 | 1.22 | 1.70 | 2.67 | 0.00 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | nnls_fit |  |  |  | 5.00 | 2.82 | 2.63 | 3.11 | 2.49 | 0.00 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | reconstruction_metrics |  |  |  | 5.00 | 2.46 | 1.92 | 4.18 | 5.94 | 0.26 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | threshold_sensitivity |  | 0, 0.01, 0.03, 0.05, 0.1 |  | 5.00 | 16.48 | 14.99 | 17.46 | 2.91 | 0.09 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | bootstrap_one_sample | 100.00 |  |  | 5.00 | 26.15 | 25.25 | 27.26 | 0.46 | 0.00 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | validation_qc |  |  |  | 5.00 | 4.27 | 3.94 | 5.27 | 7.97 | 0.00 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | nnls_fit |  |  |  | 5.00 | 19.79 | 18.45 | 20.62 | 6.90 | 0.00 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | reconstruction_metrics |  |  |  | 5.00 | 8.06 | 6.48 | 9.76 | 2.13 | 0.00 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | threshold_sensitivity |  | 0, 0.01, 0.03, 0.05, 0.1 |  | 5.00 | 120.10 | 66.47 | 136.59 | 2.33 | 5.79 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | bootstrap_one_sample | 100.00 |  |  | 5.00 | 54.77 | 51.43 | 56.02 | -4.19 | 0.00 |
| Portal-scale cohort review | WGS | 300.00 | 1500.00 | 96.00 | 40.00 | validation_qc |  |  |  | 5.00 | 11.81 | 10.06 | 12.57 | 5.39 | 0.02 |
| Portal-scale cohort review | WGS | 300.00 | 1500.00 | 96.00 | 40.00 | nnls_fit |  |  |  | 5.00 | 232.33 | 223.94 | 256.05 | 3.62 | 0.05 |
| Portal-scale cohort review | WGS | 300.00 | 1500.00 | 96.00 | 40.00 | reconstruction_metrics |  |  |  | 5.00 | 56.53 | 56.34 | 58.03 | 6.03 | 3.32 |
| Portal-scale cohort review | WGS | 300.00 | 1500.00 | 96.00 | 40.00 | threshold_sensitivity |  | 0, 0.01, 0.03, 0.05, 0.1 |  | 5.00 | 561.52 | 542.96 | 578.39 | 16.68 | 12.16 |
| Portal-scale cohort review | WGS | 300.00 | 1500.00 | 96.00 | 40.00 | bootstrap_one_sample | 100.00 |  |  | 5.00 | 128.07 | 126.82 | 134.20 | 2.61 | 0.36 |
| Exploratory discovery cohort | WGS/WES | 30.00 | 1200.00 | 96.00 |  | nmf_rank_selection | 75.00 |  | 2, 3, 4 | 5.00 | 491.17 | 477.41 | 595.09 | -2.84 | 0.84 |
| Exploratory discovery cohort | WGS/WES | 30.00 | 1200.00 | 96.00 |  | nmf_extract_recommended_rank | 75.00 |  | 4 | 5.00 | 173.48 | 169.60 | 178.36 | 4.14 | 0.13 |
| Medium exploratory discovery cohort | WGS | 80.00 | 1500.00 | 96.00 |  | nmf_rank_selection | 75.00 |  | 2, 3, 4 | 5.00 | 2154.64 | 2053.46 | 2174.90 | 5.48 | 1.12 |
| Medium exploratory discovery cohort | WGS | 80.00 | 1500.00 | 96.00 |  | nmf_extract_recommended_rank | 75.00 |  | 4 | 5.00 | 740.83 | 699.24 | 747.64 | 2.53 | 0.00 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | v03_analysis_advisor |  |  |  | 5.00 | 5.26 | 4.27 | 5.84 | 6.68 | 0.00 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | v03_fit_quality_evidence |  |  |  | 5.00 | 11.50 | 10.37 | 15.66 | 8.10 | 0.03 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | v03_restricted_assay_evidence |  |  |  | 5.00 | 1.21 | 1.16 | 4.53 | 2.26 | 0.00 |
| Small panel/WES batch | Panel/WES | 24.00 | 80.00 | 96.00 | 12.00 | v03_panel_workflow |  |  |  | 5.00 | 25.56 | 24.03 | 30.53 | -5.11 | 0.02 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | v03_analysis_advisor |  |  |  | 5.00 | 14.89 | 14.09 | 16.26 | -6.03 | 0.00 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | v03_fit_quality_evidence |  |  |  | 5.00 | 19.73 | 19.19 | 23.43 | -3.19 | 0.21 |
| Rare-cancer cohort | WES/WGS | 40.00 | 300.00 | 96.00 | 18.00 | v03_cohort_fit_pipeline |  |  |  | 5.00 | 53.18 | 48.99 | 57.75 | -0.34 | 0.01 |
| Rare-cancer cohort | WES/WGS | 12.00 | 300.00 | 96.00 | 18.00 | v03_subgroup_discovery | 75.00 |  | 2 | 5.00 | 55.48 | 54.91 | 95.91 | 3.71 | 0.01 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | v03_analysis_advisor |  |  |  | 5.00 | 70.94 | 69.64 | 75.51 | 9.50 | 0.08 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | v03_fit_quality_evidence |  |  |  | 5.00 | 63.10 | 62.08 | 70.43 | 4.39 | 0.01 |
| Medium research cohort | WGS/WES | 120.00 | 1200.00 | 96.00 | 24.00 | v03_cohort_fit_pipeline |  |  |  | 5.00 | 253.23 | 246.98 | 270.76 | 7.17 | 1.14 |

Memory deltas are process-level estimates and should be interpreted as approximate.
