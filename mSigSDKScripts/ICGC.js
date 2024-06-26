//#region Retrieving SSM Files from ICGC Data Portal and Converting to MAF File
import * as localforage from "https://cdn.jsdelivr.net/npm/localforage/+esm";
import * as pako from "https://cdn.jsdelivr.net/npm/pako/+esm";
import * as Papa from "https://cdn.jsdelivr.net/npm/papaparse/+esm";
import {fetchURLAndCache} from "./utils.js"
import {  
  init_sbs_mutational_spectra,
  convertMatrix,
} from "./mutationalSpectrum.js";

async function getDownloadId(pqlQuery, dataType = "ssm", outputFormat = "TSV") {
  const info = `[{"key":"${dataType}", "value":"${outputFormat}"}]`;
  const url = `https://dcc.icgc.org/api/v1/download/submitPQL?pql=${pqlQuery}&info=${info}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} resulted in status code ${response.status}`);
  }

  const json = await response.json();
  if (!json.downloadId) {
    throw new Error(`GET ${url} did not return a download ID`);
  }
  return await json.downloadId;
}
function findInArr(arr, seg) {
  const matches = []; // initialize array
  let i = 0; // initialize i
  while (i < arr.length - seg.length) {
    const s = arr.slice(i, i + seg.length); // create segment
    if (s.every((d, i) => s[i] == seg[i])) {
      // if matches, push to matches
      matches.push(i);
    }
    i++; // increment i
  }
  return matches;
}

// This function parses the TSV data into rows
// and returns an array of cells

function tsvParseRows(tsvData) {
  // Split the TSV data into rows
  const rows = tsvData.trim().split("\n");

  // Map each row to an array of cells
  const cells = rows.map((row) => row.split("\t"));

  // Return the cells
  return cells;
}

async function retrieveData(download_id, project, dataset, analysis_type) {
  // Create the URL that we will use to fetch the data
  const url = `https://dcc.icgc.org/api/v1/download/${download_id}`;

  console.log(url);
  // Create a cache name that we will use for the data
  const cacheName = "ICGC";

  // Fetch the data, caching the result
  return await fetchURLAndCache(
    cacheName,
    url,
    null,
    project + "_" + dataset + "_" + analysis_type
  )
    // Convert the response to an ArrayBuffer
    .then((response) => response.arrayBuffer())

    // Convert the ArrayBuffer to an array of bytes
    .then((arrayBuffer) => {
      const uArr = new Uint8Array(arrayBuffer);

      // Find the locations of the GZIP headers in the data
      let headerLocs = findInArr(uArr, [31, 139, 8, 0, 0]);

      // Create an array to hold the chunks of the data
      const chunks = [];

      // Loop through the locations of the headers
      for (let i = 0; i < headerLocs.length - 1; i++) {
        // Create a block of data from the header to the next header
        const block = uArr.slice(headerLocs[i], headerLocs[i + 1]);

        // Inflate the block using the pako library
        chunks.push(pako.default.inflate(block));
      }

      // Create a block of data from the last header to the end of the data
      const block = uArr.slice(headerLocs[headerLocs.length - 1], uArr.length);

      // Inflate the block using the pako library
      chunks.push(pako.default.inflate(block));

      // Create a new TextDecoder
      const decoder = new TextDecoder();

      // Decode the chunks into strings
      let decodedChunks = chunks.map((d) => decoder.decode(d));

      // Create an array to hold the parsed chunks
      const parsedChunks = [];

      // Loop through the chunks
      for (let chunk of decodedChunks) {
        // Parse the TSV rows and push them to the parsed chunks array using Papa Parse
        parsedChunks.push(tsvParseRows(chunk));
      }

      // Return the parsed chunks
      return [].concat(...parsedChunks);
    })

    // Return the parsed rows
    .then((data) => {
      return data;
    })

    // Catch any errors and return a rejected promise
    .catch((err) => {
      console.error(err);
      return Promise.reject(err);
    });
}

async function retrieveICGCDatasets(
  projects = ["BRCA-US"],
  datatype = "ssm",
  analysis_type = "WGS",
  output_format = "TSV"
) {
  const supportedFormats = ["TSV", "json"];

  if (!supportedFormats.includes(output_format)) {
    throw new Error(
      `Output format ${output_format} isn't supported. Supported formats: ${supportedFormats}.`
    );
  }
  let files = [];
  for (let project of projects) {
    const pql_query = `select(*),in(donor.projectId,'${project}'),in(donor.availableDataTypes,'${datatype}'),in(donor.analysisTypes,'${analysis_type}')`;
    const download_id = await getDownloadId(pql_query, datatype, output_format);

    files.push(
      await retrieveData(download_id, project, datatype, analysis_type)
    );
  }

  return [].concat(...(await files));
}

// Create a function that will find the positions of a set of values in an array and output the indices of the values within the array that match the values in the set
function findIndicesOfValuesInArray(array, values) {
  let indices = [];
  for (let i = 0; i < array.length; i++) {
    if (values.includes(array[i])) {
      indices.push(i);
    }
  }
  return indices;
}

// Create a function that will take in the nested array and return a nested array with only the columns we want to keep

function returnDesiredColumns(nestedArray, selectColumns) {
  let output = [];
  for (let row of nestedArray.slice(1)) {
    let newRow = [];
    for (let column of selectColumns) {
      newRow.push(row[column]);
    }
    output.push(newRow);
  }
  return output;
}

function groupAndSortData(data) {
  // Create an object to hold the grouped data
  const groupedData = {};

  // Loop through the input data and group it by donor ID
  data.forEach((row) => {
    const donorID = row[1];
    const chromosome = row[3];
    const position = row[4];

    // If this donor ID hasn't been seen yet, create an empty array for it
    if (!groupedData[donorID]) {
      groupedData[donorID] = [];
    }

    // Check to see if the array already contains a row with the same chromosome and position as the current row and if not, add it
    if (
      !groupedData[donorID].some(
        (r) => r[3] === chromosome && r[4] === position
      )
    ) {
      groupedData[donorID].push(row);
    }
  });

  // Loop through the grouped data and sort each array by chromosome and position
  Object.values(groupedData).forEach((rows) => {
    rows.sort((a, b) => {
      const chrA = a[1];
      const chrB = b[1];
      const posA = a[2];
      const posB = b[2];

      if (chrA !== chrB) {
        // Sort by chromosome first
        return chrA.localeCompare(chrB);
      } else {
        // If chromosomes are the same, sort by position
        return posA - posB;
      }
    });
  });

  // Return the grouped and sorted data
  return groupedData;
}

function combineKeysAndValues(keys, values) {
  const dictionary = {};
  for (let i = 0; i < keys.length; i++) {
    dictionary[keys[i]] = values[i];
  }
  return dictionary;
}
/**

@function obtainICGCDataMAF
@async
@memberof ICGC
@description A function that retrieves ICGC (International Cancer Genome Consortium) mutation data in MAF (Mutation Annotation Format) format from local cache or external source.
@param {string[]} [projects=["BRCA-US"]] An array of project codes to retrieve data from. Defaults to ["BRCA-US"].
@param {string} [datatype="ssm"] The type of mutation data to retrieve. Defaults to "ssm".
@param {string} [analysis_type="WGS"] The type of analysis to retrieve data from. Defaults to "WGS".
@param {string} [output_format="TSV"] The format of the output file. Defaults to "TSV".
@returns {Promise<Array<Object>>} A promise that resolves to an array of objects containing mutation data.
@throws {Error} If any error occurs during the process of retrieving or caching the data.
*/
const obtainICGCDataMAF = async (
  projects = ["BRCA-US"],
  datatype = "ssm",
  analysis_type = "WGS",
  output_format = "TSV"
) => {
  const cacheName = "ICGC";
  const fileName =
    cacheName +
    "_" +
    projects +
    "_" +
    datatype +
    "_" +
    analysis_type +
    "_" +
    output_format;

  const ICGCDataset = await localforage.default
    .getItem(fileName)
    .then(function (value) {
      return value;
    });

  if (ICGCDataset !== null) {
    console.log("Data found within local forage. Returning data now...");
    return ICGCDataset;
  } else {
    console.log("Data not found within local forage. Procuring data now...");
    const ICGCMAF = retrieveICGCDatasets(
      (projects = projects),
      (datatype = datatype),
      (analysis_type = analysis_type),
      (output_format = output_format)
    ).then((nestedArray) => {
      let selectedColumns = [
        "icgc_mutation_id",
        "project_code",
        "icgc_donor_id",
        "chromosome",
        "chromosome_start",
        "chromosome_end",
        "assembly_version",
        "mutation_type",
        "reference_genome_allele",
        "mutated_to_allele",
      ];

      const indices = findIndicesOfValuesInArray(
        nestedArray[0],
        selectedColumns
      );

      const data = returnDesiredColumns(nestedArray, indices);
      return Object.values(groupAndSortData(data, indices)).map((patients) => {
        return patients.map((mutations) => {
          return combineKeysAndValues(selectedColumns, mutations);
        });
      });
    });

    localforage.default.setItem(fileName, await ICGCMAF);
    return await ICGCMAF;
  }
};

//#endregion

//#region Convert WGS MAF file to Panel MAF file

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
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

  for (var i = 0; i < WGSArray.length - 1; i++) {
    let row = WGSArray[i];

    let filteredRow;
    if (isNumeric(row["chromosome"])) {
      filteredRow = panelArray.filter(
        (panelRow) =>
          parseInt(panelRow["Chromosome"]) === parseInt(row["chromosome"]) &&
          parseInt(panelRow["Start_Position"]) <=
            parseInt(row["chromosome_start"]) &&
          parseInt(panelRow["End_Position"]) >= parseInt(row["chromosome_end"])
      );
    } else {
      filteredRow = panelArray.filter(
        (panelRow) =>
          panelRow["Chromosome"] === row["chromosome"] &&
          parseInt(panelRow["Start_Position"]) <=
            parseInt(row["chromosome_start"]) &&
          parseInt(panelRow["End_Position"]) >= parseInt(row["chromosome_end"])
      );
    }

    if (filteredRow.length > 0) {
      let MAFColumns = [
        "icgc_mutation_id",
        "project_code",
        "icgc_donor_id",
        "chromosome",
        "chromosome_start",
        "chromosome_end",
        "assembly_version",
        "mutation_type",
        "reference_genome_allele",
        "mutated_to_allele",
      ];
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


function convertICGCMutationalSpectraIntoJSON(MAFfiles, mutSpec, dataType ="WGS"){
  
  // check if the length of the mutspec dictionary is the same as the length of the MAFfiles array

  if (MAFfiles.length != Object.keys(mutSpec).length){
    throw new Error("The number of MAF files and the number of mutational spectra do not match");
  }

  // loop through each mutational spectrum in the mutSpec dictionary and create a JSON object for each one

  const mergedPatientJSONs = [];
  
  let i = 0;
  for (let patient in mutSpec){
    const patientJSON = [];

    for (let mutationType in mutSpec[patient]){
      let mutSpecObj = {
        "sample": MAFfiles[i][0]["project_code"],
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
  obtainICGCDataMAF,
  convertMatrix,
  convertWGStoPanel,
  init_sbs_mutational_spectra,
  convertICGCMutationalSpectraIntoJSON,
};
