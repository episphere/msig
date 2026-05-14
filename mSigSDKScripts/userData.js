import {
  init_sbs_mutational_spectra,
  convertMatrix,
  normalizeChromosome,
} from "./mutationalSpectrum.js";

//#region Convert WGS MAF file to Panel MAF file

function downsampleWGSArray(WGSArray, panelArray) {
  const includedRows = [];

  // Convert all keys in WGSArray to lowercase
  const WGSArrayLower = WGSArray.map(row =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
    )
  );

  for (let i = 0; i < WGSArrayLower.length - 1; i++) {
    const row = WGSArrayLower[i];
    const rowChromosome = normalizeChromosome(row["chromosome"]);

    let filteredRow = panelArray.filter((panelRow) => {
      const panelChromosome = normalizeChromosome(panelRow["Chromosome"]);
      return (
        rowChromosome !== null &&
        panelChromosome === rowChromosome &&
        parseInt(panelRow["Start_Position"], 10) <=
          parseInt(row["start_position"], 10) &&
        parseInt(panelRow["End_Position"], 10) >= parseInt(row["end_position"], 10)
      );
    });

    if (filteredRow.length > 0) {
      includedRows.push(row);
    }
  }

  return includedRows;
}


// Create a function that reads a csv file and returns a nested array of the data
async function readCSV(csvFile) {
  const Papa = await import("https://cdn.jsdelivr.net/npm/papaparse/+esm");
  return new Promise((resolve, reject) => {
    Papa.default.parse(csvFile, {
      download: true,
      header: true,
      complete: function (results) {
        resolve(results.data);
      },
    });
  });
}

/**
 * Converts Whole Genome Sequencing (WGS) mutation data into panel data by downsampling based on a BED file.
 *
 * This function takes WGS mutation annotation files (MAFs) and a BED file defining panel regions, then filters
 * the WGS data to include only mutations within the specified panel regions.
 *
 * @async
 * @function convertWGStoPanel
 * @memberof userData
 * @param {Array} WgMAFs - An array of WGS mutation data, where each element is an array representing mutations for a single sample.
 * Each mutation record should be an object with fields such as `chromosome`, `start_position`, etc.
 * @param {string|Array} panelDf - A BED file defining the regions of the panel or an array of arrays representing the panel regions.
 * If a string is provided, it is treated as a file path to a BED file and read into memory.
 * @returns {Array} - An array of downsampled MAFs, where each element corresponds to a sample from the input WGS data,
 * filtered to include only mutations within the panel regions.
 *
 * @example
 * // Example input:
 * const WgMAFs = [
 *   [
 *     { chromosome: "1", start_position: 12345, Hugo_Symbol: "TP53", ... },
 *     { chromosome: "2", start_position: 67890, Hugo_Symbol: "BRCA1", ... },
 *     ...
 *   ],
 *   [
 *     { chromosome: "1", start_position: 54321, Hugo_Symbol: "KRAS", ... },
 *     { chromosome: "2", start_position: 98765, Hugo_Symbol: "EGFR", ... },
 *     ...
 *   ],
 * ];
 * const panelDf = "panel_regions.bed"; // Path to a BED file.
 *
 * // Convert WGS data to panel data
 * const panelMAFs = await convertWGStoPanel(WgMAFs, panelDf);
 *
 * // Example output:
 * // panelMAFs = [
 * //   [
 * //     { chromosome: "1", start_position: 12345, Hugo_Symbol: "TP53", ... },
 * //     ...
 * //   ],
 * //   [
 * //     { chromosome: "2", start_position: 98765, Hugo_Symbol: "EGFR", ... },
 * //     ...
 * //   ]
 * // ];
 */


async function convertWGStoPanel(WgMAFs, panelDf) {
  // Check if the panel file is an array of arrays or a file path. If it is a file path, read the file and convert it to an array of arrays
  let bed_file;
  if (typeof panelDf === "string") {
    bed_file = await readCSV(panelDf);
  } else {
    bed_file = panelDf;
  }

  const panelMAFs = [];
  for (let WgMAF of WgMAFs) {
    const downsampledWGSMAF = downsampleWGSArray(WgMAF, bed_file);
    panelMAFs.push(downsampledWGSMAF);
  }
  return panelMAFs;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferSpectrumContexts(spectra, opportunities) {
  const contexts = new Set();

  for (const spectrum of Object.values(spectra || {})) {
    if (isPlainObject(spectrum)) {
      Object.keys(spectrum).forEach((context) => contexts.add(context));
    }
  }

  const opportunityValues = Object.values(opportunities || {});
  const sampleSpecific = opportunityValues.some(isPlainObject);
  if (sampleSpecific) {
    for (const opportunityRecord of opportunityValues) {
      if (isPlainObject(opportunityRecord)) {
        Object.keys(opportunityRecord).forEach((context) => contexts.add(context));
      }
    }
  } else if (isPlainObject(opportunities)) {
    Object.keys(opportunities).forEach((context) => contexts.add(context));
  }

  return [...contexts];
}

function getOpportunityRecord(opportunities, sampleName) {
  if (!isPlainObject(opportunities)) {
    return {};
  }

  const sampleSpecific = Object.values(opportunities).some(isPlainObject);
  return sampleSpecific ? opportunities[sampleName] || {} : opportunities;
}

function opportunityScale({
  callableOpportunity,
  referenceOpportunity,
  binaryMask,
}) {
  const callable = finiteNumber(callableOpportunity, 0);
  const reference = finiteNumber(referenceOpportunity, 0);

  if (binaryMask) {
    return callable > 0 ? 1 : 0;
  }
  if (reference > 0) {
    return Math.max(0, Math.min(1, callable / reference));
  }
  if (callable >= 0 && callable <= 1) {
    return callable;
  }
  return callable > 0 ? 1 : 0;
}

/**
 * Creates matched WGS and panel spectra pairs from a WGS spectra matrix and callable-opportunity mask.
 *
 * @function createWGStoPanelValidationPairs
 * @memberof userData
 * @param {Object<string,Object<string,number>>} wgsSpectra - Sample-by-context WGS spectra.
 * @param {Object<string,number>|Object<string,Object<string,number>>} panelCallableOpportunityMask - Shared or sample-specific callable opportunities by context.
 * @param {Object} [options] - Downsampling options.
 * @param {string[]} [options.contexts=null] - Context order to use.
 * @param {Object<string,number>} [options.referenceOpportunities=null] - Optional WGS/reference opportunities by context.
 * @param {boolean} [options.binaryMask=false] - Treat positive callable opportunity as fully included.
 * @param {boolean} [options.roundCounts=false] - Round expected panel counts to integers.
 * @returns {Object} Matched WGS and panel spectra pairs for controlled validation.
 */
function createWGStoPanelValidationPairs(
  wgsSpectra,
  panelCallableOpportunityMask,
  {
    contexts = null,
    referenceOpportunities = null,
    binaryMask = false,
    roundCounts = false,
  } = {}
) {
  const contextList =
    contexts ||
    inferSpectrumContexts(wgsSpectra, panelCallableOpportunityMask);
  const panelSpectra = {};
  const pairs = [];

  for (const [sampleName, spectrum] of Object.entries(wgsSpectra || {})) {
    const opportunities = getOpportunityRecord(
      panelCallableOpportunityMask,
      sampleName
    );
    const panelSpectrum = {};
    const opportunityRows = contextList.map((context) => {
      const scale = opportunityScale({
        callableOpportunity: opportunities[context],
        referenceOpportunity: referenceOpportunities?.[context],
        binaryMask,
      });
      const wgsCount = finiteNumber(spectrum?.[context], 0);
      const expectedPanelCount = wgsCount * scale;
      const panelCount = roundCounts
        ? Math.round(expectedPanelCount)
        : expectedPanelCount;
      panelSpectrum[context] = panelCount;
      return {
        context,
        wgsCount,
        callableOpportunity: opportunities[context] ?? null,
        referenceOpportunity: referenceOpportunities?.[context] ?? null,
        opportunityScale: scale,
        panelCount,
      };
    });
    const wgsTotal = contextList.reduce(
      (total, context) => total + finiteNumber(spectrum?.[context], 0),
      0
    );
    const panelTotal = contextList.reduce(
      (total, context) => total + finiteNumber(panelSpectrum[context], 0),
      0
    );

    panelSpectra[sampleName] = panelSpectrum;
    pairs.push({
      sample: sampleName,
      wgsSpectrum: Object.fromEntries(
        contextList.map((context) => [
          context,
          finiteNumber(spectrum?.[context], 0),
        ])
      ),
      panelSpectrum,
      wgsTotal,
      panelTotal,
      retainedMutationFraction: wgsTotal === 0 ? null : panelTotal / wgsTotal,
      opportunityRows,
    });
  }

  return {
    schemaVersion: "msig.panelValidation.v0.3",
    workflowRole: "wgs_to_panel_validation_pairs",
    method:
      "Panel spectra are deterministic expected spectra derived from WGS context counts and supplied callable-opportunity scales.",
    interpretationBoundary:
      "This helper works from spectra and opportunity masks. Locus-level stochastic downsampling requires raw variants plus panel intervals.",
    parameters: {
      binaryMask,
      roundCounts,
      referenceOpportunitiesSupplied: isPlainObject(referenceOpportunities),
      sampleSpecificOpportunities: Object.values(
        panelCallableOpportunityMask || {}
      ).some(isPlainObject),
    },
    contexts: contextList,
    wgsSpectra,
    panelSpectra,
    pairs,
  };
}

/**
 * Converts mutational spectra into JSON objects for downstream processing or storage.
 * 
 * This function takes mutation annotation format (MAF) files, mutational spectra data, 
 * and sample names, and outputs JSON objects representing the spectra in a structured format.
 * 
 * @function convertMutationalSpectraIntoJSON
 * @memberof userData
 * @param {Array} MAFfiles - An array of arrays containing mutation annotation data for each sample. 
 * Each inner array represents a sample's mutation data, where each entry is an object with key-value pairs.
 * @param {Object} mutSpec - An object representing the mutational spectra. 
 * Keys are patient identifiers, and values are objects with mutation types as keys and counts as values.
 * @param {string} sample_name - The key in MAFfiles to be used as the sample identifier.
 * @param {string} [dataType="WGS"] - The sequencing strategy, e.g., "WGS" (Whole Genome Sequencing) or "WES" (Whole Exome Sequencing).
 * @returns {Array} - An array of arrays, where each inner array represents the JSON objects for a patient's mutational spectra.
 * @throws {Error} - If the number of MAF files and the number of mutational spectra do not match.
 * 
 * @example
 * // Example input:
 * const MAFfiles = [
 *   [{ sample_id: "Sample1", ch   mosome: "1", start_position: "12345", ... }],
 *   [{ sample_id: "Sample2", ch   mosome: "2", start_position: "67890", ... }]
 * ];
 * const mutSpec = {
 *   Patient1: { "A[C>A]A": 10,    [C>A]C": 5, "A[C>A]G": 8, ... },
 *   Patient2: { "A[C>A]A": 7, "   C>A]C": 4, "A[C>A]G": 6, ... }
 * };
 * const sample_name = "sample_id";
 * const result = convertMutationalSpectraIntoJSON(MAFfiles, mutSpec, sample_name, "WES");
 * console.log(result);
 * 
 * @example
 * // Example output:
 * [
 *   [
 *     { sample: "Sample1", strategy: "WES", profile: "SBS", matrix: 96, mutationType: "C>A", mutations: 10 },
 *     { sample: "Sample1", strategy: "WES", profile: "SBS", matrix: 96, mutationType: "C>G", mutations: 5 },
 *     ...
 *   ],
 *   [
 *     { sample: "Sample2", strategy: "WES", profile: "SBS", matrix: 96, mutationType: "C>A", mutations: 7 },
 *     { sample: "Sample2", strategy: "WES", profile: "SBS", matrix: 96, mutationType: "C>G", mutations: 4 },
 *     ...
 *   ]
 * ];
 */

function convertMutationalSpectraIntoJSON(MAFfiles, mutSpec, sample_name, dataType = "WGS") {

  // check if the length of the mutspec dictionary is the same as the length of the MAFfiles array

  if (MAFfiles.length != Object.keys(mutSpec).length) {
    throw new Error("The number of MAF files and the number of mutational spectra do not match");
  }
  // Convert all keys in MAFfiles to lowercase
  MAFfiles = MAFfiles.map(file => {
    return file.map(entry => {
      const lowerCasedEntry = {};
      for (const key in entry) {
        lowerCasedEntry[key.toLowerCase()] = entry[key];
      }
      return lowerCasedEntry;
    });
  });
  sample_name = sample_name.toLowerCase();

  // loop through each mutational spectrum in the mutSpec dictionary and create a JSON object for each one

  const mergedPatientJSONs = [];

  let i = 0;
  for (let patient in mutSpec) {
    const patientJSON = [];

    for (let mutationType in mutSpec[patient]) {
      let mutSpecObj = {
        "sample": MAFfiles[i][0][sample_name],
        "strategy": dataType,
        "profile": "SBS",
        "matrix": 96,
        "mutationType": mutationType,
        "mutations": mutSpec[patient][mutationType],
      };
      patientJSON.push(mutSpecObj);
    }
    mergedPatientJSONs.push(patientJSON);
    i++;
  }
  return mergedPatientJSONs;

}

//#endregion

export {
  convertMatrix,
  convertWGStoPanel,
  createWGStoPanelValidationPairs,
  init_sbs_mutational_spectra,
  convertMutationalSpectraIntoJSON,
};
