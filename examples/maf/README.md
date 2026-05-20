# Example MAF And Panel Files

These files are retained as local examples for import and conversion workflows. They are small fixtures, not curated analysis datasets.

| File | Purpose |
| --- | --- |
| `example.input.maf` | General MAF import example. |
| `example_patient.rna.somatic.snvs.maf` | Patient-level SNV example. |
| `67RT_T2_vs_67_PBMC.combined.maf` | Paired tumor-normal example. |
| `cancer_genes_tad.bed` | BED-style panel/region example used by downsampling workflows. |
| `illumina_exome_targeted_regions_v1_2_hg38.bed` | Illumina Exome TargetedRegions v1.2 hg38 BED used as the real WES target default. |
| `illumina_trusight_cancer_targeted_regions_v1_0_hg38.bed` | Illumina TruSight Cancer TargetedRegions v1.0 hg38 BED used as the real panel default. |

MAF conversion can use live UCSC context lookup, row-supplied trinucleotide contexts, or caller-supplied offline lookup tables. Production validation datasets and generated outputs live under `docs/manuscript/experiments/`.
