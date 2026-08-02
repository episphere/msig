# Benchmark Harness Description

Exposure-solve browser benchmarks were run with isolated browser profiles, >=20 repeats per scenario/browser, and separate cold and warm phases.
Recorded stage fields include SDK/module fetch and import, public spectrum/catalog fetch when applicable, native fitting, adapter fitting when applicable, QC evidence, bootstrap, plot rendering, report serialization, end-to-end elapsed time, and observed JavaScript heap.
The component boundary table explicitly labels not-applicable and not-measured stages; unmeasured stages are not represented as zero-time components.
Observed JavaScript heap is sampled at stage boundaries through performance.memory where exposed. It is not an operating-system process peak; Firefox did not expose this metric.

Chrome/Edge/Firefox benchmark status: completed; 600 completed observations and 0 failed observations.
End-to-end notebook benchmark status: not possible on this host with the requested TCGA 120/500-sample public input unavailable.
