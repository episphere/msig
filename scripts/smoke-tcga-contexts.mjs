import assert from "node:assert/strict";

globalThis.window = globalThis.window || {};

const {
  convertMatrix,
  getMutationalContext,
  standardize_substitution,
  standardize_trinucleotide,
} = await import("../mSigSDKScripts/mutationalSpectrum.js");

const contextRows = [
  {
    project_code: "TCGA-FAST",
    sample: "gdc-maf-a",
    build: "hg19",
    chromosome: "1",
    chromosome_start: "100",
    reference_genome_allele: "C",
    mutated_to_allele: "A",
    mutation_type: "SNP",
    trinucleotide_context: "AGGGTCGTGAG",
  },
  {
    project_code: "TCGA-FAST",
    sample: "gdc-maf-a",
    build: "hg19",
    chromosome: "1",
    chromosome_start: "101",
    reference_genome_allele: "G",
    mutated_to_allele: "T",
    mutation_type: "SNP",
    trinucleotide_context: "ACAGAGT",
  },
];

const contextSpectra = await convertMatrix(
  [contextRows],
  "sample",
  100,
  "hg19",
  true
);

assert.equal(contextSpectra["gdc-maf-a"]["T[C>A]G"], 1);
assert.equal(contextSpectra["gdc-maf-a"]["T[C>A]T"], 1);

const liveSequence = await getMutationalContext("1", "hg19", 1000000);
const liveReferenceAllele = liveSequence[1].toUpperCase();
const liveAlternateAllele = liveReferenceAllele === "A" ? "C" : "A";
const liveExpectedContext = standardize_trinucleotide(liveSequence);
const liveExpectedMutationType = `${liveExpectedContext[0]}[${standardize_substitution(
  liveReferenceAllele,
  liveAlternateAllele
)}]${liveExpectedContext[2]}`.toUpperCase();

const fallbackSpectra = await convertMatrix(
  [
    [
      {
        project_code: "TCGA-FAST",
        sample: "gdc-maf-live-fallback",
        build: "hg19",
        chromosome: "1",
        chromosome_start: "1000000",
        reference_genome_allele: liveReferenceAllele,
        mutated_to_allele: liveAlternateAllele,
        mutation_type: "SNP",
      },
    ],
  ],
  "sample",
  100,
  "hg19",
  true
);

assert.equal(
  fallbackSpectra["gdc-maf-live-fallback"][liveExpectedMutationType],
  1
);

console.log("TCGA/GDC context fast-path smoke test passed.");
