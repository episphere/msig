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

The separate DBS78 class benchmark tests all 78 recognized double-base
substitution types at 100 distinct loci in each genome build. Every test position is checked
against the installed reference genome before conversion, and each two-base
event spans both genomic positions in the MAF input. This prevents an invalid
coordinate range from being mistaken for an unsupported substitution type.

The separate ID83 class benchmark tests all 83 indel classes at 100 distinct loci in each
genome build. SigProfilerMatrixGenerator determines each class from the alleles
and reference genome. The corresponding repeat or microhomology value is then
provided to mSigSDK, which requires that information in the input rather than
deriving it from the reference sequence.

The separate SBS benchmark tests every SBS1536 context at 100 distinct,
reference-verified chromosome 1 loci in each genome build and compares both
the SBS1536 matrices and the SBS96 matrices derived from the same events.

The example-MAF comparison uses `examples/maf/example.input.maf`: 2,493 GRCh37
rows from 19 samples, comprising 2,263 SNPs, 102 deletions, 97 insertions, and
31 other multi-base variants at 2,166 chromosome-position pairs. The file was
derived from `ding-lab/MuSiC2`'s `example/smg/example.input.maf`, added there in
November 2018 as an example for the significantly mutated gene workflow. The
mSig copy omits six upstream records and changes one NBPF1 coordinate. MuSiC2
does not identify the underlying tumor type, study, accession, or patient
provenance, so this file must not be described as a curated or representative
cohort.

Of the 2,493 rows, the SBS converter counted 2,262 and rejected 231: 230 because
they were not single-nucleotide variants and one because the reference allele
did not match the center base of the reference-derived context. The generated
reason counts are stored in `data/example-maf-validation-results.json` and
reported in Supplementary Table E.

The run writes checkpoint state before each build/profile/comparator phase so a
long reference-backed run can be diagnosed. Reference genomes are local
SigProfilerMatrixGenerator assets and are not committed to the repository.

Run with:

```text
npm.cmd run experiment:e9-prepare-references
npm.cmd run experiment:e9-maf-conversion-validation
npm.cmd run experiment:e9-supported-coverage
npm.cmd run experiment:e9-sbs-class-validation
npm.cmd run experiment:e9-dbs78-class-validation
npm.cmd run experiment:e9-id83-class-validation
npm.cmd run experiment:e9-example-maf-validation
```

The authoritative result is `data/maf-conversion-validation-results.json`; the
valid-event and adverse reconciliation tables are
`data/maf-conversion-valid-event-reconciliation.csv` and
`data/maf-conversion-reconciliation.csv`. Normalized comparator matrices and
logs are retained under `data/comparator-artifacts/`.
The complete DBS78 class result is
`data/dbs78-class-validation-results.json`.
The complete ID83 class result is
`data/id83-class-validation-results.json`.
The complete SBS class result is `data/sbs-class-validation-results.json`.
The example-MAF result is `data/example-maf-validation-results.json`.

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
