# E9: MAF-to-profile conversion validation

This experiment compares the SDK MAF-to-profile conversion with
SigProfilerMatrixGenerator 1.3.6 on a fixed, profile-specific fixture. The
fixture is intentionally sparse and edge-focused; it is a spot-check
validation, not an exhaustive enumeration of every profile bin or MAF
normalization convention.

The fixture covers SBS96, SBS1536, DBS78, and ID83 inputs for GRCh37/hg19 and
GRCh38/hg38. Valid inputs are compared for exact integer matrix concordance.
Malformed and ambiguous rows are run separately and reconciled using stable
event IDs, the SDK's row-level trace, and audit metadata. The comparator is
isolated by case for these rows; a multi-row case is marked as case-level in
the reconciliation CSV rather than pretending that a sample-level matrix
identifies one bin per source row. Comparator errors are retained in the CSV
and result JSON.

The run writes checkpoint state before each build/profile/comparator phase so a
long reference-backed run can be diagnosed. Reference genomes are local
SigProfilerMatrixGenerator assets and are not committed to the repository.

Run with:

```text
npm.cmd run experiment:e9-prepare-references
npm.cmd run experiment:e9-maf-conversion-validation
```

The authoritative result is `data/maf-conversion-validation-results.json`; the
valid-event and adverse reconciliation tables are
`data/maf-conversion-valid-event-reconciliation.csv` and
`data/maf-conversion-reconciliation.csv`. Normalized comparator matrices and
logs are retained under `data/comparator-artifacts/`.

In the result JSON, `pass` means exact concordance for the supported valid
cases, complete accounting of adverse rows, and passing reference-context
checks. `adverseExactConcordancePass` is reported separately and can be false
when an independent generator makes a different decision for an adverse case.
