# Supplementary Table E. Reconciliation of rows excluded from the example-MAF SBS matrices

| Converter decision | Reason | Rows | Reconciliation |
|---|---|---:|---|
| Counted | Valid single-nucleotide variant with reference-matched context | 2,262 | Included in both SBS96 and SBS1536 matrices |
| Rejected | Not a single-nucleotide variant | 230 | 102 deletions + 97 insertions + 31 other multi-base variants |
| Rejected | Reference allele does not match context center | 1 | Single SNP excluded from both SBS matrices |
| **Total** |  | **2,493** | **2,262 counted + 231 rejected** |

Counts are generated from the SBS1536 converter trace in `example-maf-validation-results.json`; SBS96 uses the same accepted source rows.
