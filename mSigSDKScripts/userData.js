import * as Papa from "https://cdn.jsdelivr.net/npm/papaparse/+esm";
import {
  init_sbs_mutational_spectra,
  convertMatrix,
} from "./mutationalSpectrum.js";

//#region Convert WGS MAF file to Panel MAF file

// Helper function to extract numeric part of a string
const extractNumber = (str) => parseInt(str.replace(/\D/g, ""), 10);
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

    let filteredRow = panelArray.filter(
      (panelRow) =>
        extractNumber(panelRow["Chromosome"]) === extractNumber(row["chromosome"]) &&
        parseInt(panelRow["Start_Position"], 10) <= parseInt(row["start_position"], 10) &&
        parseInt(panelRow["End_Position"], 10) >= parseInt(row["end_position"], 10)
    );

    if (filteredRow.length > 0) {
      includedRows.push(row);
    }
  }

  return includedRows;
}


// Create a function that reads a csv file and returns a nested array of the data
async function readCSV(csvFile) {
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
  init_sbs_mutational_spectra,
  convertMutationalSpectraIntoJSON,
};
