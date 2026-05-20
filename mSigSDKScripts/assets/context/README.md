# Offline Reference Context Assets

This directory contains bundled JSON assets used by `convertMatrix(..., { offline: true })` and `convertMafToProfileSpectra(..., { offline: true })` when a caller does not pass a custom `contextLookupTable`.

The lookup schema is intentionally sparse: each file carries build metadata, coordinate convention, and verified smoke-test loci. Production-scale offline MAF conversion should pass a project-specific position-indexed lookup table with the same schema or provide row-level sequence context. SBS96 requires a centered trinucleotide context; SBS1536 requires a centered pentanucleotide context. DBS78 and ID83 can be counted directly from suitable MAF event evidence without a sequence lookup when explicit DNP, adjacent SNV, insertion/deletion, repeat, or microhomology annotations are present.

## Bundled Files

- `hg19.trinucleotide-contexts.json`
- `hg38.trinucleotide-contexts.json`
- `t2t-chm13.trinucleotide-contexts.json`

These files verify the offline execution path and genome-build routing. They are not genome-wide context tables. Live SBS conversion retrieves 5-base reference windows from the UCSC Genome Browser sequence API when offline mode is disabled.

## Schema

```json
{
  "schemaVersion": "msig.trinucleotide-context-table.v0.3",
  "genomeBuild": "hg38",
  "coordinateSystem": "1-based",
  "lookup": {
    "1:1000000": {
      "sequence": "GGG",
      "source": "UCSC Genome Browser API"
    }
  }
}
```

Accepted lookup keys are `chromosome:position`, `chrchromosome:position`, `chromosome_position`, or `chrchromosome_position`. Values may be strings or objects with `sequence`, `trinucleotide`, `pentanucleotide`, `context`, or `dna` fields.
