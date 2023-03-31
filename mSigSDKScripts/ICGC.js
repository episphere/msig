  //#region Retrieving SSM Files from ICGC Data Portal and Converting to MAF File
  import * as localforage from "https://cdn.jsdelivr.net/npm/localforage/+esm";
  import * as pako from "https://cdn.jsdelivr.net/npm/pako/+esm";
  import * as Papa from "https://cdn.jsdelivr.net/npm/papaparse/+esm";

  
  async function getDownloadId(
    pqlQuery,
    dataType = "ssm",
    outputFormat = "TSV"
  ) {
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

    // Create a cache name that we will use for the data
    const cacheName = "ICGC";

    // Fetch the data, caching the result
    return await fetchURLAndCache(
      cacheName,
      url,
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
        const block = uArr.slice(
          headerLocs[headerLocs.length - 1],
          uArr.length
        );

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
      const download_id = await getDownloadId(
        pql_query,
        datatype,
        output_format
      );

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
        return Object.values(groupAndSortData(data, indices)).map(
          (patients) => {
            return patients.map((mutations) => {
              return combineKeysAndValues(selectedColumns, mutations);
            });
          }
        );
      });

      localforage.default.setItem(fileName, await ICGCMAF);
      return await ICGCMAF;
    }
  };

  //#endregion

  //#region Convert MAF to Mutational Spectrum Matrix

  // This function returns a list of all possible single base substitution trinucleotide
  // contexts, which are defined as the 5' base, the base substitution, and the 3' base.
  // For example, the trinucleotide context of the single base substitution C>A at position
  // 100 of the reference genome would be "N[C>A]N", where N is the base at position 99 and
  // position 101 of the reference genome.

  function get_sbs_trinucleotide_contexts() {
    const nucleotide_bases = ["A", "C", "G", "T"];
    const substitution_types = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];
    let sbs_trinucleotide_contexts = [];

    for (let base_5 of nucleotide_bases) {
      for (let substitution of substitution_types) {
        for (let base_3 of nucleotide_bases) {
          sbs_trinucleotide_contexts.push(
            `${base_5}[${substitution}]${base_3}`
          );
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

  async function convertMatrix(data, batch_size = 100) {
    const mutationalSpectra = {};

    for (let patient of data) {
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
      mutationalSpectra[[patient[0]["project_code"]]] = mutationalSpectrum;
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
            parseInt(panelRow["End_Position"]) >=
              parseInt(row["chromosome_end"])
        );
      } else {
        filteredRow = panelArray.filter(
          (panelRow) =>
            panelRow["Chromosome"] === row["chromosome"] &&
            parseInt(panelRow["Start_Position"]) <=
              parseInt(row["chromosome_start"]) &&
            parseInt(panelRow["End_Position"]) >=
              parseInt(row["chromosome_end"])
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
  //#endregion

  export{obtainICGCDataMAF,
    convertMatrix,
    convertWGStoPanel,
    init_sbs_mutational_spectra}