# Table C. Bootstrap Worker Hardware Stress Tests

Synthetic native-JavaScript bootstrap workloads measured under Node.js worker threads on the Windows benchmark host. Heap lower bounds are Node heap-cap checks, not universal browser system-memory requirements.

| Workload | Size | Serial median (s) | 4-worker median (s) | Speedup | Peak RSS, workers (MiB) | Tested Node heap lower bound (MiB) |
| --- | --- | --- | --- | --- | --- | --- |
| Single sample bootstrap | 67 signatures x 96 contexts; 500 iterations | 1.510 | 0.845 | 1.79x | 259 | 128 |
| 120-sample cohort bootstrap | 67 signatures x 96 contexts; 25 iterations/sample | 12.276 | 4.647 | 2.64x | 546 | 256 |
| 300-sample cohort bootstrap | 40 signatures x 96 contexts; 10 iterations/sample |  | 1.990 |  | 453 |  |
