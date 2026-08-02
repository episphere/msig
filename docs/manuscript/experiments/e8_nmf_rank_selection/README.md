# E8 NMF rank selection

This experiment selects the NMF rank using held-out sample prediction rather than training reconstruction error alone.

- Input: the 38-sample PCAWG Lung-AdenoCA SBS96 adapter-fidelity input.
- Candidate ranks: 2 through 8.
- Resampling: five deterministic sample-level folds, with five seeded NMF restarts per rank and fold.
- Training: signatures are learned on the training samples; the best converged restart is selected by training Frobenius error.
- Validation: signatures are held fixed and non-negative exposures are refit for held-out samples. The primary metric is relative held-out Frobenius error; held-out sample cosine is reported secondarily.
- Stability: restart profiles are matched by the exact permutation maximizing total component cosine. The median matched cosine is the component-stability summary. Mean pairwise adjusted Rand index of maximum-exposure sample assignments is reported but is not a second selection objective.
- Eligibility: all five folds, convergence rate at least 0.80, and median restart component stability at least 0.90.
- Selection: the smallest eligible rank within one standard error of the minimum mean held-out error; exact ties resolve to the smaller rank.
- Full-cohort refit: 20 restarts at the selected rank, retaining the best converged solution and recording full-cohort stability diagnostics.

Run with:

```text
npm run experiment:e8-nmf-rank-selection
```

The result, rank summary, and fold-level diagnostics are written to `data/`.
