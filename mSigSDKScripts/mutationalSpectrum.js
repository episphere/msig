function get_sbs_trinucleotide_contexts() {
  const nucleotide_bases = ["A", "C", "G", "T"];
  const substitution_types = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];
  let sbs_trinucleotide_contexts = [];

  for (let base_5 of nucleotide_bases) {
    for (let substitution of substitution_types) {
      for (let base_3 of nucleotide_bases) {
        sbs_trinucleotide_contexts.push(`${base_5}[${substitution}]${base_3}`);
      }
    }
  }

  return sbs_trinucleotide_contexts;
}

function standardize_substitution(ref_allele, mut_allele) {
  /*
COSMIC signatures define mutations from a pyrimidine allele (C, T) to any
other base (C>A, C>G, C>T, T>A, T>C, T>G). If a mutation in the MAF file
is defined from a reference purine allele (A, G), then we infer the substituted
base in the complementary sequence, which would be from a pyrimidine
allele due to purines and pyrimidines complementing each other in a
double-stranded DNA.
 :param ref_allele: base in the reference genome.
:param mut_allele: base in the mutated genome
:return: substitution string from pyrimidine to any other base.
*/
  var complement_seq, purines;
  complement_seq = {
    A: "T",
    C: "G",
    T: "A",
    G: "C",
  };
  purines = ["A", "G"];

  if (purines.some((v) => ref_allele.includes(v))) {
    return `${complement_seq[ref_allele]}>${complement_seq[mut_allele]}`;
  } else {
    return `${ref_allele}>${mut_allele}`;
  }
}

function init_sbs_mutational_spectra(n_records) {
  /*
Initilizes an ordered dictionary with SBS trinucleotide context as keys and
a list of counts, one for each sample.
 :param n_records: number of samples to record in the mutational spectra matrix.
:return: a dictionary of trinucleotide context and a list of counts
initialized to zeros.
*/

  let tri_nuc_context = get_sbs_trinucleotide_contexts();

  let sbs_mutational_spectra = {};

  for (var i = 0; i < tri_nuc_context.length; i++) {
    let context = tri_nuc_context[i];
    sbs_mutational_spectra[context] = 0;
  }

  return sbs_mutational_spectra;
}

function standardize_trinucleotide(trinucleotide_ref) {
  // COSMIC signatures define mutations from a pyrimidine allele (C, T) to any
  // other base (C>A, C>G, C>T, T>A, T>C, T>G). If a mutation in the MAF file
  // is defined from a purine allele (A, G), then we infer the trinucleotide
  // context in the complementary sequence, which would be from a pyrimidine
  // allele due to purines and pyrimidines complementing each other in a
  // double-stranded DNA.

  // :param trinucleotide_ref: trinucleotide sequence seen in the reference genome.
  // :return: a pyrimidine-centric trinucleotide sequence.

  let complement_seq = {
    A: "T",
    C: "G",
    T: "A",
    G: "C",
  };
  let purines = "AG";
  if (purines.includes(trinucleotide_ref[1])) {
    return `${complement_seq[trinucleotide_ref[2]]}${
      complement_seq[trinucleotide_ref[1]]
    }${complement_seq[trinucleotide_ref[0]]}`;
  } else {
    return trinucleotide_ref;
  }
}

/**

Converts patient mutation data into mutational spectra.
@async
@function convertMatrix
@memberof ICGC
@param {Array} data - The patient mutation data to be converted.
@param {number} [batch_size=100] - The number of mutations to process in each batch.
@returns {Object} - The mutational spectra of each patient in an object.
@throws {Error} - If there is an error in processing the mutation data.
*/

async function convertMatrix(data, group_by="project_code", batch_size = 100) {
  const mutationalSpectra = {};

  for (let patient of data) {
    // Move the initialization of mutationalSpectrum inside the loop
    var mutationalSpectrum = init_sbs_mutational_spectra();
    var promises = [];

    for (let i = 0; i < patient.length; i++) {
      var chromosomeNumber = patient[i]["chromosome"];
      var referenceAllele = patient[i]["reference_genome_allele"];
      var mutatedTo = patient[i]["mutated_to_allele"];
      var position = patient[i]["chromosome_start"];
      var variantType = patient[i]["mutation_type"];

      var promise = getMutationalContext(chromosomeNumber, parseInt(position))
        .then((sequence) => {
          sequence = standardize_trinucleotide(sequence);
          let fivePrime = sequence[0];
          let threePrime = sequence[2];
          let mutationType = String(
            `${fivePrime}[${standardize_substitution(
              referenceAllele,
              mutatedTo
            )}]${threePrime}`
          ).toUpperCase();

          if (
            (variantType == "SNP" ||
              variantType == "single base substitution") &&
            !mutationType.includes("N") &&
            !mutationType.includes("U")
          ) {
            mutationalSpectrum[mutationType] =
              Number(mutationalSpectrum[mutationType]) + Number(1);
          }
        })
        .catch((error) => {
          console.error(error);
        });
      promises.push(promise);

      if (i % batch_size === 0 || i === patient.length - 1) {
        await Promise.all(promises);
        promises = [];
      }
    }
    // Use the patient's project_code as the key in the mutationalSpectra object
    mutationalSpectra[patient[0][group_by]] = mutationalSpectrum;
  }

  return mutationalSpectra;
}

async function getMutationalContext(chromosomeNumber, startPosition) {
  const chrName = String(chromosomeNumber);
  const startByte = startPosition - 2;
  const endByte = startPosition;

  const alternative = await (
    await fetch(
      `https://api.genome.ucsc.edu/getData/sequence?genome=hg19;chrom=chr${chrName};start=${startByte};end=${
        endByte + 1
      }`
    )
  ).json();

  const sequence = alternative.dna;
  return sequence;
}

export {
  get_sbs_trinucleotide_contexts,
  standardize_substitution,
  init_sbs_mutational_spectra,
  standardize_trinucleotide,
  convertMatrix,
  getMutationalContext,
};
