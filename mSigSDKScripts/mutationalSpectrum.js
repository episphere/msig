import { fetchURLAndCache } from "./utils.js";

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
    return `${complement_seq[trinucleotide_ref[2]]}${complement_seq[trinucleotide_ref[1]]
      }${complement_seq[trinucleotide_ref[0]]}`;
  } else {
    return trinucleotide_ref;
  }
}


const extractFirstNumber = (str) => {
  // Match the first occurrence of one or more digits
  const match = str.match(/\d+/);
  // Convert the match to an integer and return, or return null if no match
  return match ? parseInt(match[0], 10) : null;
};

/**
 * Converts input mutational data into a mutational spectrum matrix grouped by a specified field.
 *
 * This function processes raw mutational data, extracts trinucleotide contexts, and aggregates 
 * mutational spectra for each group. It supports TCGA and non-TCGA formats, allowing batch processing 
 * for large datasets. The resulting mutational spectrum matrix is formatted for downstream visualization 
 * and analysis.
 *
 * @async
 * @function convertMatrix
 * @memberof userData
 * @param {Array<Array<Object>>} data - Array of patient-level mutational data. Each patient's data is represented 
 * as an array of objects, where each object contains mutational details (e.g., chromosome, position, mutation type).
 * @param {string} [group_by="Center"] - Field to group data by (e.g., "Center" or "sample_id"). This field should exist in the input data.
 * @param {number} [batch_size=100] - Number of mutations to process in parallel batches. Adjust this for memory management.
 * @param {string} [genome="hg19"] - Reference genome build. Defaults to "hg19" unless specified in the data.
 * @param {boolean} [tcga=false] - Flag indicating whether the input data is in TCGA format. If true, expects TCGA-specific fields.
 * @returns {Promise<Object>} - A promise resolving to an object where each key is a group (e.g., "CNIC"),
 * and each value is a mutational spectrum object. The mutational spectrum object contains trinucleotide contexts as keys (e.g., "A[C>A]A") and counts as values.
 *
 * @example
 * // Example input data
 * const data = [
 *   [
 *     { chromosome: "1", start_position: "12345", reference_allele: "C", tumor_seq_allele2: "T", variant_type: "SNP", build: "hg19", Center: "CNIC" },
 *     { chromosome: "2", start_position: "67890", reference_allele: "G", tumor_seq_allele2: "A", variant_type: "SNP", build: "hg19", Center: "CNIC" }
 *   ],
 *   [
 *     { chromosome: "3", start_position: "101112", reference_allele: "T", tumor_seq_allele2: "C", variant_type: "SNP", build: "hg19", Center: "OtherCenter" }
 *   ]
 * ];
 *
 * // Convert data to mutational spectra grouped by Center
 * const mutationalSpectra = await convertMatrix(data, "Center", 50, "hg19", false);
 * console.log(mutationalSpectra);
 * // Output:
 * // {
 * //   "CNIC": {
 * //     "A[C>A]A": 9,
 * //     "A[C>A]C": 7,
 * //     "A[C>A]G": 6,
 * //     ...
 * //   },
 * //   "OtherCenter": {
 * //     "T[T>C]A": 15,
 * //     "T[T>C]T": 8,
 * //     ...
 * //   }
 * // }
 */

async function convertMatrix(
  data,
  group_by = "project_code",
  batch_size = 100,
  genome = "hg19",
  tcga = false
) {
  const mutationalSpectra = {};
  group_by = group_by.toLowerCase();

  for (let patient of data) {
    // Convert all keys to lowercase for consistency
    patient = patient.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
      )
    );

    // Initialize a mutational spectrum for each 'patient' group
    let mutationalSpectrum = init_sbs_mutational_spectra();
    let promises = [];

    for (let i = 0; i < patient.length; i++) {
      // If patient[i]['build'] exists, use it to determine the genome
      // Otherwise, use the 'genome' argument or default to "hg19"
      if (patient[i]["build"]) {
        genome = patient[i]["build"];
      } else if (!genome) {
        genome = "hg19";
      }

      let chromosomeNumber;
      let referenceAllele;
      let mutatedTo;
      let position;
      let variantType;

      // Use a proper comparison or a simple "if (!tcga)" check
      if (!tcga) {
        chromosomeNumber = patient[i]["chromosome"];
        chromosomeNumber = extractFirstNumber(chromosomeNumber);
        referenceAllele = patient[i]["reference_allele"];
        mutatedTo = patient[i]["tumor_seq_allele2"];
        position = patient[i]["start_position"];
        variantType = patient[i]["variant_type"];
      } else {
        chromosomeNumber = patient[i]["chromosome"];
        referenceAllele = patient[i]["reference_genome_allele"];
        mutatedTo = patient[i]["mutated_to_allele"];
        position = patient[i]["chromosome_start"];
        variantType = patient[i]["mutation_type"];
      }

      // Get the trinucleotide context for this mutation
      let promise = getMutationalContext(chromosomeNumber, genome, parseInt(position))
        .then((sequence) => {
          sequence = standardize_trinucleotide(sequence);

          const fivePrime = sequence[0];
          const threePrime = sequence[2];
          const standardizedSubstitution = standardize_substitution(referenceAllele, mutatedTo);
          const mutationType = `${fivePrime}[${standardizedSubstitution}]${threePrime}`.toUpperCase();

          // Only count valid single base substitutions
          if (
            (variantType === "SNP" || variantType === "single base substitution") &&
            !mutationType.includes("N") &&
            !mutationType.includes("U")
          ) {
            mutationalSpectrum[mutationType] = Number(mutationalSpectrum[mutationType]) + 1;
          }
        })
        .catch((error) => {
          console.error(error);
        });

      promises.push(promise);

      // Batch processing to avoid too many parallel requests
      if (i % batch_size === 0 || i === patient.length - 1) {
        await Promise.all(promises);
        promises = [];
      }
    }

    // Use the patient's group_by field (e.g., project_code) as the key
    mutationalSpectra[patient[0][group_by]] = mutationalSpectrum;
  }

  return mutationalSpectra;
}


async function getMutationalContext(chromosomeNumber, genome, startPosition) {
  const chrName = String(chromosomeNumber);
  const startByte = startPosition - 2;
  const endByte = startPosition;

  const alternative = await (
    await fetchURLAndCache("HG19",
      `https://api.genome.ucsc.edu/getData/sequence?genome=${genome};chrom=chr${chrName};start=${startByte};end=${endByte + 1
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
