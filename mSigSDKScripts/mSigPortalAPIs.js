import { fetchURLAndCache } from "./utils.js";

//#region Mutational Signatures

/**

Retrieves the mutational signature options from the specified API endpoint.
@async
@function getMutationalSignaturesOptions
@memberof mSigPortalData
@name getMutationalSignaturesOptions
@param {string} [genomeDataType="WGS"] - The genome data type to use. Defaults to "WGS".
@param {string} [mutationType="SBS"] - The mutation type to use. Defaults to "SBS".
@returns {Promise} A Promise that resolves to the mutational signature options in JSON format.
@example
const mutationalSignatures = await getMutationalSignaturesOptions("WGS", "SBS");
console.log(mutationalSignatures);
*/
export async function getMutationalSignaturesOptions(
  genomeDataType = "WGS",
  mutationType = "SBS"
) {
  const url = `https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature_options?
  source=Reference_signatures&strategy=${genomeDataType}&profile=${mutationType}&offset=0`;
  const cacheName = "getMutationalSignaturesOptions";
  return await (await fetchURLAndCache(cacheName, url)).json();
}


/**
 * @async
 * @function getMutationalSignaturesData
 * @memberof mSigPortalData
 * @param {string} [genomeDataType="WGS"] - The type of genome data to use. Defaults to "WGS".
 * @param {string} [signatureSetName="COSMIC_v3_Signatures_GRCh37_SBS96"] - The name of the signature set to use. Defaults to "COSMIC_v3_Signatures_GRCh37_SBS96".
 * @param {string} [mutationType="SBS"] - The type of mutation to analyze. Defaults to "SBS".
 * @param {number} [matrix=96] - The size of the mutational signature matrix. Defaults to 96.
 * @param {number} [numberofResults=10] - The number of results to retrieve. Defaults to 10.
 * @returns {Promise<Object>} - A Promise that resolves to the unformatted mutational signatures data as JSON.
 * @throws {Error} - If there was an issue fetching the mutational signatures data.
 * @example
 * const mutationalSignatures = await getMutationalSignaturesData("WGS", "COSMIC_v3_Signatures_GRCh37_SBS96", "SBS", 96, 10);
 * console.log(mutationalSignatures);
 * 
  */

export async function getMutationalSignaturesData(
  genomeDataType = "WGS",
  signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96",
  mutationType = "SBS",
  matrix = 96,
  numberofResults = 10
) {
  const url = `https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature?
  source=Reference_signatures&strategy=${genomeDataType}&profile=${mutationType}&matrix=${matrix}&signatureSetName=${signatureSetName}&limit=${numberofResults}&offset=0`;
  const cacheName = "getMutationalSignaturesData";
  const unformattedData = await (await fetchURLAndCache(cacheName, url)).json();
  // const formattedData = extractMutationalSpectra(
  //   unformattedData,
  //   "signatureName"
  // );
  return unformattedData;
}

/**

Returns a summary of mutational signatures based on the provided signature set name and number of results.
@async
@function getMutationalSignaturesSummary
@memberof mSigPortalData
@param {number} [numberofResults=10] - The number of results to retrieve. Defaults to 10 if not provided.
@param {string} [signatureSetName="COSMIC_v3.3_Signatures"] - The name of the signature set to retrieve. Defaults to "COSMIC_v3.3_Signatures" if not provided.
@returns {Promise<Object>} - A Promise that resolves to an object representing the mutational signature summary.
@throws {Error} - Throws an error if there was an issue fetching the mutational signature summary.
@example
const summary = await getMutationalSignaturesSummary(20, "COSMIC_v3.3_Signatures");
console.log(summary);
*/

export async function getMutationalSignaturesSummary(
  numberofResults = 10,
  signatureSetName = "COSMIC_v3.3_Signatures"
) {
  const url = `https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature_summary?signatureSetName=${signatureSetName}&limit=${numberofResults}&offset=0`;
  const cacheName = "getMutationalSignaturesSummary";
  return await (await fetchURLAndCache(cacheName, url)).json();
}
//#endregion

//#region Mutational Spectrum

/**

Retrieves mutational spectrum options from the mutational signatures API.
@async
@function getMutationalSpectrumOptions
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the study to retrieve options for. Defaults to "PCAWG".
@param {string} [genomeDataType="WGS"] - The genome data type to retrieve options for. Defaults to "WGS".
@param {string} [cancerType="Lung-AdenoCA"] - The cancer type to retrieve options for. Defaults to "Lung-AdenoCA".
@param {number} [numberOfResults=10] - The number of results to retrieve. Defaults to 10.
@returns {Promise<Object>} A Promise that resolves to the JSON response from the mutational signatures API.
*/

export async function getMutationalSpectrumOptions(
  study = "PCAWG",
  genomeDataType = "WGS",
  cancerType = "Lung-AdenoCA",
  numberOfResults = 10
) {
  const url = `https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum_options?study=${study}&cancer=${cancerType}&strategy=${genomeDataType}&offset=0&limit=${numberOfResults}`;
  const cacheName = "getMutationalSpectrumOptions";
  return await (await fetchURLAndCache(cacheName, url)).json();
}

/**

* Fetches mutational spectrum data from the Cancer Genomics Data Server API and returns it in a formatted way.
* @async
* @function getMutationalSpectrumData
* @memberof mSigPortalData
* @param {string} [study="PCAWG"] - The study identifier.
* @param {string[]|null} [samples=null] - The sample identifier(s) to query data for.
* @param {string} [genomeDataType="WGS"] - The genome data type identifier.
* @param {string} [cancerType="Lung-AdenoCA"] - The cancer type identifier.
* @param {string} [mutationType="SBS"] - The mutation type identifier.
* @param {number} [matrixSize=96] - The size of the mutational spectrum matrix.
* @returns {Promise} - A promise that resolves to the formatted mutational spectrum data.
*/
export async function getMutationalSpectrumData(
  study = "PCAWG",
  samples = null,
  genomeDataType = "WGS",
  cancerType = "Lung-AdenoCA",
  mutationType = "SBS",
  matrixSize = 96
) {
  const cacheName = "getMutationalSpectrumData";

  const promises = [];
  let urls = [];

  if (cancerType == '') {
    let url = `https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum?study=${study}&strategy=${genomeDataType}&profile=${mutationType}&matrix=${matrixSize}&offset=0`;

    let unformattedData = await (await fetchURLAndCache(cacheName, url)).json();

    return unformattedData;
  }

  if (samples === null) {
    let url = `https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum?study=${study}`;

    if (cancerType !== null) {
      url += `&cancer=${cancerType}`;
    }

    if (genomeDataType !== null) {
      url += `&strategy=${genomeDataType}`;
    }

    if (mutationType !== null) {
      url += `&profile=${mutationType}`;
    }

    if (matrixSize !== null) {
      url += `&matrix=${matrixSize}`;
    }

    url += `&offset=0`;

    let unformattedData = await (await fetchURLAndCache(cacheName, url)).json();
    // let formattedData = extractMutationalSpectra(unformattedData, "sample");
    return unformattedData;
  } else {
    samples.forEach((sample) => {
      urls.push(
        `https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum?study=${study}&sample=${sample}&cancer=${cancerType}&strategy=${genomeDataType}&profile=${mutationType}&matrix=${matrixSize}&offset=0`
      );
    });
  }

  urls.forEach((url) => {
    promises.push(fetchURLAndCache(cacheName, url));
  });

  const results = await Promise.all(promises);

  const data = await Promise.all(
    results.map((result) => {
      return result.json();
    })
  );

  return data;
}

/**

Fetches the mutational spectrum summary from the mutational signatures API based on the given parameters.
@async
@function getMutationalSpectrumSummary
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the cancer genome study. Default is "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genomic data used. Default is "WGS".
@param {string} [cancerType="Lung-AdenoCA"] - The type of cancer. Default is "Lung-AdenoCA".
@param {number} [numberOfResults=10] - The number of results to be returned. Default is 10.
@returns {Promise} - A Promise that resolves to a JSON object representing the mutational spectrum summary.
@throws {Error} - If the API request fails.
*/

export async function getMutationalSpectrumSummary(
  study = "PCAWG",
  genomeDataType = "WGS",
  cancerType = "Lung-AdenoCA",
  numberOfResults = 10
) {
  const url = `https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum_summary?study=${study}&cancer=${cancerType}&strategy=${genomeDataType}&limit=${numberOfResults}&offset=0`;
  const cacheName = "getMutationalSpectrumSummary";
  return await (await fetchURLAndCache(cacheName, url)).json();
}

//#endregion

//#region Mutational Signature Association

/**

Fetches the mutational signature association options from the API endpoint
@async
@function getMutationalSignatureAssociationOptions
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the study. Defaults to "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genome data. Defaults to "WGS".
@param {number} [numberOfResults=10] - The number of results to return. Defaults to 10.
@returns {Promise<Array>} - A Promise that resolves to an array of mutational signature association options.
@throws {Error} - If an error occurs during the fetching or caching of the data.
*/

export async function getMutationalSignatureAssociationOptions(
  study = "PCAWG",
  genomeDataType = "WGS",
  numberOfResults = 10
) {
  const url = `https://analysistools.cancer.gov/mutational-signatures/api/signature_association_options?study=${study}&strategy=${genomeDataType}&limit=${numberOfResults}&offset=0`;
  const cacheName = "getMutationalSignatureAssociationOptions";
  return await (await fetchURLAndCache(cacheName, url)).json();
}

/**

Retrieves mutational signature association data from a specified cancer study using the provided parameters.
@async
@function getMutationalSignatureAssociationData
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the cancer study. Default is "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genome data used. Default is "WGS".
@param {string} [cancerType="Biliary-AdenoCA"] - The type of cancer. Default is "Biliary-AdenoCA".
@param {number} [numberOfResults=10] - The maximum number of results to return. Default is 10.
@returns {Promise<object>} - A Promise that resolves to the JSON response containing the mutational signature association data.
*/

export async function getMutationalSignatureAssociationData(
  study = "PCAWG",
  genomeDataType = "WGS",
  cancerType = "Biliary-AdenoCA",
  numberOfResults = 10
) {
  const url = `https://analysistools.cancer.gov/mutational-signatures/api/signature_association?study=${study}&strategy=${genomeDataType}&cancer=${cancerType}&limit=${numberOfResults}&offset=0`;
  const cacheName = "getMutationalSignatureAssociationData";
  return await (await fetchURLAndCache(cacheName, url)).json();
}

//#endregion

//#region Mutational Signature Activity

/**

Retrieves a list of mutational signature activity options from the mutational signatures API.
@async
@function getMutationalSignatureActivityOptions
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the study to retrieve mutational signature activity options for. Defaults to "PCAWG".
@param {string} [genomeDataType="WGS"] - The genome data type to retrieve mutational signature activity options for. Defaults to "WGS".
@param {number} [numberOfResults=10] - The number of results to retrieve. Defaults to 10.
@returns {Promise<Array>} - A promise that resolves with an array of mutational signature activity options.
*/
export async function getMutationalSignatureActivityOptions(
  study = "PCAWG",
  genomeDataType = "WGS",
  numberOfResults = 10
) {
  const url = `https://analysistools.cancer.gov/mutational-signatures/api/signature_activity_options?study=${study}&strategy=${genomeDataType}&limit=${numberOfResults}&offset=0`;
  const cacheName = "getMutationalSignatureActivityOptions";
  return await (await fetchURLAndCache(cacheName, url)).json();
}
/**

Retrieves mutational signature landscape data from the mutational-signatures API.
@async
@function getMutationalSignatureActivityData
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the study. Default value is "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genome data. Default value is "WGS".
@param {string} [cancerType=""] - The name of the cancer type. Default value is an empty string.
@param {string} [signatureSetName="COSMIC_v3_Signatures_GRCh37_SBS96"] - The name of the signature set. Default value is "COSMIC_v3_Signatures_GRCh37_SBS96".
@param {number} [numberOfResults=10] - The maximum number of results to be returned. Default value is 10.
@returns {Promise<Object>} - A Promise that resolves to the JSON data of the mutational signature landscape.
*/

export async function getMutationalSignatureActivityData(
  study = "PCAWG",
  genomeDataType = "WGS",
  signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96",
  cancerType = "",
  numberOfResults = 10
) {
  let url = "";
  if (cancerType == "") {
    url = `https://analysistools.cancer.gov/mutational-signatures/api/signature_activity?study=${study}&strategy=${genomeDataType}&signatureSetName=${signatureSetName}&limit=${numberOfResults}&offset=0`;
  } else {
    url = `https://analysistools.cancer.gov/mutational-signatures/api/signature_activity?study=${study}&strategy=${genomeDataType}&signatureSetName=${signatureSetName}&limit=${numberOfResults}&cancer=${cancerType}&offset=0`;
  }

  const cacheName = "getMutationalSignatureActivityData";
  return await (await fetchURLAndCache(cacheName, url)).json();
}

/**

Retrieves mutational signature landscape data from an API endpoint.
@async
@function getMutationalSignatureLandscapeData
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The study to retrieve data from.
@param {string} [genomeDataType="WGS"] - The type of genomic data used in the study.
@param {string} [cancerType=""] - The type of cancer to retrieve data for.
@param {string} [signatureSetName="COSMIC_v3_Signatures_GRCh37_SBS96"] - The name of the mutational signature set to retrieve.
@param {number} [numberOfResults=10] - The number of results to retrieve.
@returns {Promise<object>} - A promise that resolves to an object containing the mutational signature landscape data.
*/
export async function getMutationalSignatureLandscapeData(
  study = "PCAWG",
  genomeDataType = "WGS",
  cancerType = "",
  signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96",
  numberOfResults = 10
) {
  let url = "";
  if (cancerType == "") {
    url = `https://analysistools.cancer.gov/mutational-signatures/api/signature_activity?study=${study}&strategy=${genomeDataType}&signatureSetName=${signatureSetName}&limit=${numberOfResults}&offset=0`;
  } else {
    url = `https://analysistools.cancer.gov/mutational-signatures/api/signature_activity?study=${study}&strategy=${genomeDataType}&signatureSetName=${signatureSetName}&limit=${numberOfResults}&cancer=${cancerType}&offset=0`;
  }
  const cacheName = "getMutationalSignatureLandscapeData";
  return await (await fetchURLAndCache(cacheName, url)).json();
}

//#endregion

//#region Mutational Signature Etiology

/**

Retrieves the etiology options for a given mutational signature from the Cancer.gov Mutational Signatures API.
@async
@function getMutationalSignatureEtiologyOptions
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the study to retrieve etiology options for. Defaults to "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genome data to retrieve etiology options for. Defaults to "WGS".
@param {string} [signatureName="SBS3"] - The name of the mutational signature to retrieve etiology options for. Defaults to "SBS3".
@param {string} [cancerType=""] - The cancer type to retrieve etiology options for. Defaults to an empty string.
@param {number} [numberOfResults=10] - The maximum number of results to return. Defaults to 10.
@returns {Promise<Object>} A promise that resolves to an object representing the etiology options for the specified mutational signature.
The object will have the following properties:
etiology: An array of strings representing the possible etiologies for the mutational signature.
etiology_display: An array of strings representing the display names for the possible etiologies.
signatureName: The name of the mutational signature.
study: The name of the study.
genome_data_type: The type of genome data.
cancer_type: The cancer type.
*/
export async function getMutationalSignatureEtiologyOptions(
  category = "CancerSpecificSignatures_2022",
  etiology = "",
  signatureName = "",
  cancerType = "",
  numberOfResults = 10
) {
  // Pass the arguments into the url of the api call only if they are not empty strings

  let url =
    "https://analysistools.cancer.gov/mutational-signatures/api/signature_etiology_options?";

  if (category != "") {
    url += `category=${category}&`;
  }
  if (etiology != "") {
    url += `etiology=${etiology}&`;
  }
  if (signatureName != "") {
    url += `signature=${signatureName}&`;
  }
  if (cancerType != "") {
    url += `cancer=${cancerType}&`;
  }
  url += `limit=${numberOfResults}&offset=0`;

  const cacheName = "getMutationalSignatureEtiologyOptions";
  return await (await fetchURLAndCache(cacheName, url)).json();
}

/**

Retrieves mutational signature etiology data from the Cancer Genomics Research Laboratory (CGR) website.
@async
@function getMutationalSignatureEtiologyData
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The study name. Default is "PCAWG".
@param {string} [genomeDataType="WGS"] - The genome data type. Default is "WGS".
@param {string} [signatureName="SBS3"] - The signature name. Default is "SBS3".
@param {string} [cancerType=""] - The cancer type. Default is an empty string.
@param {number} [numberOfResults=10] - The number of results to return. Default is 10.
@returns {Promise} A promise that resolves to the mutational signature etiology data in JSON format.
*/
export async function getMutationalSignatureEtiologyData(
  study = "PCAWG",
  genomeDataType = "WGS",
  signatureName = "SBS3",
  cancerType = "",
  numberOfResults = 10
) {
  let url = "";

  if (cancerType == "") {
    url = `https://analysistools.cancer.gov/mutational-signatures/api/signature_etiology?study=${study}&strategy=${genomeDataType}&signatureName=${signatureName}&limit=${numberOfResults}&offset=0`;
  } else {
    url = `https://analysistools.cancer.gov/mutational-signatures/api/signature_etiology?study=${study}&strategy=${genomeDataType}&signatureName=${signatureName}&cancer=${cancerType}&limit=${numberOfResults}&offset=0`;
  }

  const cacheName = "getMutationalSignatureEtiologyData";
  return await (await fetchURLAndCache(cacheName, url)).json();
}

//#endregion
