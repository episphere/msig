# Example MAF And Panel Files

These files are retained as local examples for import and conversion workflows. They are small fixtures, not curated analysis datasets.

| File | Purpose |
| --- | --- |
| `example.input.maf` | General MAF import example. |
| `example_patient.rna.somatic.snvs.maf` | Patient-level SNV example. |
| `67RT_T2_vs_67_PBMC.combined.maf` | Paired tumor-normal example. |
| `cancer_genes_tad.bed` | BED-style panel/region example used by downsampling workflows. |

MAF conversion can use live UCSC context lookup, row-supplied trinucleotide contexts, or caller-supplied offline lookup tables. Production validation datasets and generated outputs live under `docs/manuscript/experiments/`.
