# Offline Trinucleotide Context Assets

This directory contains bundled JSON assets used by `convertMatrix(..., { offline: true })` when a caller does not pass a custom `contextLookupTable`.

The lookup schema is intentionally sparse: each file carries build metadata, coordinate convention, and verified smoke-test loci. Production-scale offline MAF conversion should pass a project-specific position-indexed lookup table with the same schema or provide a trinucleotide context column in the input rows.

## Bundled Files

- `hg19.trinucleotide-contexts.json`
- `hg38.trinucleotide-contexts.json`
- `t2t-chm13.trinucleotide-contexts.json`

These files verify the offline execution path and genome-build routing. They are not genome-wide context tables.

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

Accepted lookup keys are `chromosome:position`, `chrchromosome:position`, `chromosome_position`, or `chrchromosome_position`. Values may be strings or objects with `sequence`, `trinucleotide`, `context`, or `dna` fields.
