# E9: MAF-to-profile conversion validation

This experiment has two complementary parts. The original fixed fixture is an
edge-focused audit of supported and adverse inputs. The supported-coverage
benchmark adds exhaustive SBS96, SBS1536, and DBS78 category tests, an
exhaustive test of the SDK's 83-bin annotated-ID contract, and a 2,493-row
repository MAF comparison with SigProfilerMatrixGenerator 1.3.6.

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
npm.cmd run experiment:e9-supported-coverage
```

The authoritative result is `data/maf-conversion-validation-results.json`; the
valid-event and adverse reconciliation tables are
`data/maf-conversion-valid-event-reconciliation.csv` and
`data/maf-conversion-reconciliation.csv`. Normalized comparator matrices and
logs are retained under `data/comparator-artifacts/`.

The supported-coverage result is
`data/supported-coverage/supported-coverage-validation-results.json`. SBS96 and
SBS1536 are compared over every output category in GRCh37 and GRCh38. The
DBS78 comparison covers all 77 categories accepted from the explicit MAF by
SigProfilerMatrixGenerator; its MAF reader rejected TA>AT in both builds, so
that category is retained as unresolved rather than counted as concordant.
For ID83, reference-classified allele fixtures cover 53 bins in GRCh37 and 55
in GRCh38 without a matrix mismatch. A separate 83-of-83 test covers the SDK's
documented annotated-ID mapping contract; it is not presented as independent
validation of repeat or microhomology inference, which the SDK does not
perform.

In the result JSON, `pass` means exact concordance for the supported valid
cases, complete accounting of adverse rows, and passing reference-context
checks. `adverseExactConcordancePass` is reported separately and can be false
when an independent generator makes a different decision for an adverse case.
