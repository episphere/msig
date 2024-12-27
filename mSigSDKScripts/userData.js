import * as Papa from "https://cdn.jsdelivr.net/npm/papaparse/+esm";
import {
  init_sbs_mutational_spectra,
  convertMatrix,
} from "./mutationalSpectrum.js";

//#region Convert WGS MAF file to Panel MAF file

// Helper function to extract numeric part of a string
const extractNumber = (str) => parseInt(str.replace(/\D/g, ""), 10);
/**

Converts whole-genome variant frequencies (WgMAFs) to panel variant frequencies.
@async
@function convertWGStoPanel
@memberof ICGC
@param {Array<Array<number>>} WgMAFs - An array of arrays containing WgMAFs.
@param {Array<Array<number>>|string} panelDf - An array of arrays or a string representing the file path of the panel variant frequencies.
@returns {Promise<Array<Array<number>>>} An array of arrays containing panel variant frequencies.
  */
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
