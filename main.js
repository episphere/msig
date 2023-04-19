import * as UMAP from "https://cdn.jsdelivr.net/npm/umap-js/+esm";
import * as Plotly from "https://cdn.jsdelivr.net/npm/plotly.js-dist/+esm";

import * as am5 from "https://cdn.jsdelivr.net/npm/@amcharts/amcharts5/+esm";
import * as am5hierarchy from "https://cdn.jsdelivr.net/npm/@amcharts/amcharts5/hierarchy/+esm";

import * as am5themes_Animated from "https://cdn.jsdelivr.net/npm/@amcharts/amcharts5@5.3.7/themes/Animated.js/+esm";

import {default as plotMSPrevalence} from "./mSigPortalScripts/client/src/components/controls/plotly/msPrevalence/msPrevalence.js";
import {default as plotSignatureAssociation} from "./mSigPortalScripts/client/src/components/controls/plotly/msAssociation/msAssociation.js";
import { default as plotMutationalProfileSBS96 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/sbs96.js";
import { default as plotMutationalProfileSBS192 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/sbs192.js";
import { default as plotMutationalProfileSBS288 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/sbs288.js";
import { default as plotMutationalProfileSBS384 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/sbs384.js";
import { default as plotMutationalProfileSBS1536 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/sbs1536.js";

import { default as plotMutationalProfileDBS78 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/dbs78.js";
import { default as plotMutationalProfileDBS186 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/dbs186.js";

import { default as plotMutationalProfileID28 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/id28.js";
import { default as plotMutationalProfileID29 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/id29.js";
import { default as plotMutationalProfileID83 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/id83.js";
import { default as plotMutationalProfileID415 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/id415.js";
import { default as plotMutationalProfileRS32 } from "./mSigPortalScripts/client/src/components/controls/plotly/mutationalProfiles/rs32.js";

import { default as plotMutationalProfileSBS96Comparison } from "./mSigPortalScripts/client/src/components/controls/plotly/profileComparison/sbs96.js";
import { default as plotMutationalProfileSBS192Comparison } from "./mSigPortalScripts/client/src/components/controls/plotly/profileComparison/sbs192.js";
import { default as plotMutationalProfileDBS78Comparison } from "./mSigPortalScripts/client/src/components/controls/plotly/profileComparison/dbs78.js";
import { default as plotMutationalProfileID83Comparison } from "./mSigPortalScripts/client/src/components/controls/plotly/profileComparison/id83.js";
import { default as plotMutationalProfileRS32Comparison } from "./mSigPortalScripts/client/src/components/controls/plotly/profileComparison/rs32.js";

import {
  obtainICGCDataMAF,
  convertMatrix,
  convertWGStoPanel,
  init_sbs_mutational_spectra,
} from "./mSigSDKScripts/ICGC.js";
import {
  linspace,
  deepCopy,
  nnls,
  fetchURLAndCache,
  limitDepth,
  formatHierarchicalClustersToAM5Format,
  groupBy,
  createDistanceMatrix,
  hierarchicalClustering,
  doubleClustering,
  cosineSimilarity,
} from "./mSigSDKScripts/utils.js";


import {
  getProjectsByGene, getTpmCountsByGenesOnProjects, getTpmCountsByGenesFromFiles, getMafInformationFromProjects, getVariantInformationFromMafFiles
} from "./mSigSDKScripts/tcga.js";


// import * as mSigPortalPlotting from "./index.js";

const mSigSDK = (function () {
  /**
   * @namespace mSigPortalData
   */

  /**
   * @namespace mSigPortalPlots
   */

  /**
   * @namespace ICGC
   */

  //#region Mutational Signatures

  /**

Retrieves the mutational signature options from the specified API endpoint.
@async
@function
@memberof mSigPortalData
@name getMutationalSignaturesOptions
@param {string} [genomeDataType="WGS"] - The genome data type to use. Defaults to "WGS".
@param {string} [mutationType="SBS"] - The mutation type to use. Defaults to "SBS".
@returns {Promise} A Promise that resolves to the mutational signature options in JSON format.
@example
const mutationalSignatures = await getMutationalSignaturesOptions("WGS", "SBS");
console.log(mutationalSignatures);
*/
  async function getMutationalSignaturesOptions(
    genomeDataType = "WGS",
    mutationType = "SBS"
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/mutational_signature_options?
    source=Reference_signatures&strategy=${genomeDataType}&profile=${mutationType}&offset=0`;
    const cacheName = "getMutationalSignaturesOptions";
    return await (await fetchURLAndCache(cacheName, url)).json();
  }

  /**

Retrieves mutational signatures data from the specified endpoint and returns it as JSON.
@async
@function
@memberof mSigPortalData
@param {string} [genomeDataType="WGS"] - The type of genome data to use. Defaults to "WGS".
@param {string} [signatureSetName="COSMIC_v3_Signatures_GRCh37_SBS96"] - The name of the signature set to use. Defaults to "COSMIC_v3_Signatures_GRCh37_SBS96".
@param {string} [mutationType="SBS"] - The type of mutation to analyze. Defaults to "SBS".
@param {number} [numberofResults=10] - The number of results to retrieve. Defaults to 10.
@returns {Promise<Object>} - A Promise that resolves to the unformatted mutational signatures data as JSON.
*/

  async function getMutationalSignaturesData(
    genomeDataType = "WGS",
    signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96",
    mutationType = "SBS",
    numberofResults = 10
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/mutational_signature?
    source=Reference_signatures&strategy=${genomeDataType}&profile=${mutationType}&matrix=96&signatureSetName=${signatureSetName}&limit=${numberofResults}&offset=0`;
    const cacheName = "getMutationalSignaturesData";
    const unformattedData = await (
      await fetchURLAndCache(cacheName, url)
    ).json();
    const formattedData = extractMutationalSpectra(
      unformattedData,
      "signatureName"
    );
    return unformattedData;
  }

  /**

Returns a summary of mutational signatures based on the provided signature set name and number of results.
@async
@function
@memberof mSigPortalData
@param {number} [numberofResults=10] - The number of results to retrieve. Defaults to 10 if not provided.
@param {string} [signatureSetName="COSMIC_v3.3_Signatures"] - The name of the signature set to retrieve. Defaults to "COSMIC_v3.3_Signatures" if not provided.
@returns {Promise<Object>} - A Promise that resolves to an object representing the mutational signature summary.
@throws {Error} - Throws an error if there was an issue fetching the mutational signature summary.
@example
const summary = await getMutationalSignaturesSummary(20, "COSMIC_v3.3_Signatures");
console.log(summary);
*/

  async function getMutationalSignaturesSummary(
    numberofResults = 10,
    signatureSetName = "COSMIC_v3.3_Signatures"
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/mutational_signature_summary?signatureSetName=${signatureSetName}&limit=${numberofResults}&offset=0`;
    const cacheName = "getMutationalSignaturesSummary";
    return await (await fetchURLAndCache(cacheName, url)).json();
  }
  //#endregion

  //#region Mutational Spectrum

  /**

Retrieves mutational spectrum options from the mutational signatures API.
@async
@memberof mSigPortalData
@function
@param {string} [study="PCAWG"] - The name of the study to retrieve options for. Defaults to "PCAWG".
@param {string} [genomeDataType="WGS"] - The genome data type to retrieve options for. Defaults to "WGS".
@param {string} [cancerType="Lung-AdenoCA"] - The cancer type to retrieve options for. Defaults to "Lung-AdenoCA".
@param {number} [numberOfResults=10] - The number of results to retrieve. Defaults to 10.
@returns {Promise<Object>} A Promise that resolves to the JSON response from the mutational signatures API.
*/

  async function getMutationalSpectrumOptions(
    study = "PCAWG",
    genomeDataType = "WGS",
    cancerType = "Lung-AdenoCA",
    numberOfResults = 10
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/mutational_spectrum_options?study=${study}&cancer=${cancerType}&strategy=${genomeDataType}&offset=0&limit=${numberOfResults}`;
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
  async function getMutationalSpectrumData(
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

    if (cancerType == null) {
      let url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/mutational_spectrum?study=${study}&strategy=${genomeDataType}&profile=${mutationType}&matrix=${matrixSize}&offset=0`;

      let unformattedData = await (
        await fetchURLAndCache(cacheName, url)
      ).json();

      return unformattedData;
    }

    if (samples === null) {
      let url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/mutational_spectrum?study=${study}&cancer=${cancerType}&strategy=${genomeDataType}&profile=${mutationType}&matrix=${matrixSize}&offset=0`;

      let unformattedData = await (
        await fetchURLAndCache(cacheName, url)
      ).json();
      let formattedData = extractMutationalSpectra(unformattedData, "sample");
      return unformattedData;
    } else {
      samples.forEach((sample) => {
        urls.push(
          `https://analysistools-dev.cancer.gov/mutational-signatures/api/mutational_spectrum?study=${study}&sample=${sample}&cancer=${cancerType}&strategy=${genomeDataType}&profile=${mutationType}&matrix=${matrixSize}&offset=0`
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

    let formattedData = extractMutationalSpectra(data.flat(), "sample");

    return data;
  }

  /**

Fetches the mutational spectrum summary from the mutational signatures API based on the given parameters.
@async
@function
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the cancer genome study. Default is "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genomic data used. Default is "WGS".
@param {string} [cancerType="Lung-AdenoCA"] - The type of cancer. Default is "Lung-AdenoCA".
@param {number} [numberOfResults=10] - The number of results to be returned. Default is 10.
@returns {Promise} - A Promise that resolves to a JSON object representing the mutational spectrum summary.
@throws {Error} - If the API request fails.
*/

  async function getMutationalSpectrumSummary(
    study = "PCAWG",
    genomeDataType = "WGS",
    cancerType = "Lung-AdenoCA",
    numberOfResults = 10
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/mutational_spectrum_summary?study=${study}&cancer=${cancerType}&strategy=${genomeDataType}&limit=${numberOfResults}&offset=0`;
    const cacheName = "getMutationalSpectrumSummary";
    return await (await fetchURLAndCache(cacheName, url)).json();
  }

  //#endregion

  //#region Mutational Signature Association

  /**

Fetches the mutational signature association options from the API endpoint
@async
@function
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the study. Defaults to "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genome data. Defaults to "WGS".
@param {number} [numberOfResults=10] - The number of results to return. Defaults to 10.
@returns {Promise<Array>} - A Promise that resolves to an array of mutational signature association options.
@throws {Error} - If an error occurs during the fetching or caching of the data.
*/

  async function getMutationalSignatureAssociationOptions(
    study = "PCAWG",
    genomeDataType = "WGS",
    numberOfResults = 10
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/signature_association_options?study=${study}&strategy=${genomeDataType}&limit=${numberOfResults}&offset=0`;
    const cacheName = "getMutationalSignatureAssociationOptions";
    return await (await fetchURLAndCache(cacheName, url)).json();
  }

  /**

Retrieves mutational signature association data from a specified cancer study using the provided parameters.
@async
@function
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the cancer study. Default is "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genome data used. Default is "WGS".
@param {string} [cancerType="Biliary-AdenoCA"] - The type of cancer. Default is "Biliary-AdenoCA".
@param {number} [numberOfResults=10] - The maximum number of results to return. Default is 10.
@returns {Promise<object>} - A Promise that resolves to the JSON response containing the mutational signature association data.
*/

  async function getMutationalSignatureAssociationData(
    study = "PCAWG",
    genomeDataType = "WGS",
    cancerType = "Biliary-AdenoCA",
    numberOfResults = 10
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/signature_association?study=${study}&strategy=${genomeDataType}&cancer=${cancerType}&limit=${numberOfResults}&offset=0`;
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
  async function getMutationalSignatureActivityOptions(
    study = "PCAWG",
    genomeDataType = "WGS",
    numberOfResults = 10
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/signature_activity_options?study=${study}&strategy=${genomeDataType}&limit=${numberOfResults}&offset=0`;
    const cacheName = "getMutationalSignatureActivityOptions";
    return await (await fetchURLAndCache(cacheName, url)).json();
  }
  /**

Retrieves mutational signature landscape data from the mutational-signatures API.
@async
@function
@memberof mSigPortalData
@param {string} [study="PCAWG"] - The name of the study. Default value is "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genome data. Default value is "WGS".
@param {string} [cancerType=""] - The name of the cancer type. Default value is an empty string.
@param {string} [signatureSetName="COSMIC_v3_Signatures_GRCh37_SBS96"] - The name of the signature set. Default value is "COSMIC_v3_Signatures_GRCh37_SBS96".
@param {number} [numberOfResults=10] - The maximum number of results to be returned. Default value is 10.
@returns {Promise<Object>} - A Promise that resolves to the JSON data of the mutational signature landscape.
*/

  async function getMutationalSignatureActivityData(
    study = "PCAWG",
    genomeDataType = "WGS",
    signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96",
    cancerType = "",
    numberOfResults = 10
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/signature_activity?study=${study}&strategy=${genomeDataType}&signatureSetName=${signatureSetName}&limit=${numberOfResults}&cancer=${cancerType}&offset=0`;
    const cacheName = "getMutationalSignatureActivityData";
    return await (await fetchURLAndCache(cacheName, url)).json();
  }

  /**

Retrieves mutational signature landscape data from an API endpoint.
@async
@function getMutationalSignatureLandscapeData
@param {string} [study="PCAWG"] - The study to retrieve data from.
@param {string} [genomeDataType="WGS"] - The type of genomic data used in the study.
@param {string} [cancerType=""] - The type of cancer to retrieve data for.
@param {string} [signatureSetName="COSMIC_v3_Signatures_GRCh37_SBS96"] - The name of the mutational signature set to retrieve.
@param {number} [numberOfResults=10] - The number of results to retrieve.
@returns {Promise<object>} - A promise that resolves to an object containing the mutational signature landscape data.
*/
  async function getMutationalSignatureLandscapeData(
    study = "PCAWG",
    genomeDataType = "WGS",
    cancerType = "",
    signatureSetName = "COSMIC_v3_Signatures_GRCh37_SBS96",
    numberOfResults = 10
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/signature_activity?study=${study}&strategy=${genomeDataType}&signatureSetName=${signatureSetName}&cancer=${cancerType}&limit=${numberOfResults}&offset=0`;
    const cacheName = "getMutationalSignatureLandscapeData";
    return await (await fetchURLAndCache(cacheName, url)).json();
  }

  //#endregion

  //#region Mutational Signature Etiology

  /**

Retrieves the etiology options for a given mutational signature from the Cancer.gov Mutational Signatures API.
@async
@function
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
  async function getMutationalSignatureEtiologyOptions(
    study = "PCAWG",
    genomeDataType = "WGS",
    signatureName = "SBS3",
    cancerType = "",
    numberOfResults = 10
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/signature_etiology_options?study=${study}&strategy=${genomeDataType}&signatureName=${signatureName}&cancer=${cancerType}&limit=${numberOfResults}&offset=0`;
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
  async function getMutationalSignatureEtiologyData(
    study = "PCAWG",
    genomeDataType = "WGS",
    signatureName = "SBS3",
    cancerType = "",
    numberOfResults = 10
  ) {
    const url = `https://analysistools-dev.cancer.gov/mutational-signatures/api/signature_etiology?study=${study}&strategy=${genomeDataType}&signatureName=${signatureName}&cancer=${cancerType}&limit=${numberOfResults}&offset=0`;
    const cacheName = "getMutationalSignatureEtiologyData";
    return await (await fetchURLAndCache(cacheName, url)).json();
  }

  //#endregion

  //#region Plot the summary of a dataset

  /**

Generates a mutational spectrum summary plot and displays it in a given HTML div element.
@async
@function
@memberof mSigPortalPlots
@param {string} [studyName="PCAWG"] - The name of the cancer genomics study to use. Default is "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genomic data to use. Default is "WGS".
@param {string} [cancerTypeOrGroup="Lung-AdenoCA"] - The cancer type or group to display. Default is "Lung-AdenoCA".
@param {number} [numberOfResults=50] - The maximum number of results to display. Default is 50.
@param {string} [divID="mutationalSpectrumSummary"] - The ID of the HTML div element where the plot will be displayed. Default is "mutationalSpectrumSummary".
@returns {Promise<void>} A Promise that resolves when the plot is displayed or rejects if there is an error.
@throws {Error} If there is an error retrieving or displaying the plot, this function will throw an Error with a message describing the error.
*/

  // This function plots the mutational spectrum summary for the given parameters.
  // Input:
  // - studyName: Name of the study for which the data is to be fetched
  // - genomeDataType: Type of the genome data to be fetched
  // - cancerTypeOrGroup: Cancer type or group for which the data is to be fetched
  // - numberOfResults: Number of results to be fetched
  // Output: A mutational spectrum summary plot of the given parameters
  async function plotProfilerSummary(
    studyName = "PCAWG",
    genomeDataType = "WGS",
    cancerTypeOrGroup = "Lung-AdenoCA",
    numberOfResults = 50,
    divID = "mutationalSpectrumSummary"
  ) {
    try {
      const summary = await getMutationalSpectrumSummary(
        studyName,
        genomeDataType,
        cancerTypeOrGroup,
        numberOfResults
      );
      let data = await getBarPlotData(summary);
      if (data.length == 0) {
        // $(`#${divID}`).html(
        //   `<p style="color:red">Error: no data available for the selected parameters.</p>`
        // );
      } else {
        let layout = {
          title: `${studyName} ${cancerTypeOrGroup} ${genomeDataType} Mutational Spectrum Summary`,
          xaxis: {
            title: "Sample",
          },
          yaxis: {
            title: "Log (Number of Mutations)",
          },
          barmode: "stack",
        };
        Plotly.default.newPlot(divID, data, layout);
      }
    } catch (err) {
      console.error(err);
      $(`#${divID}`).html(`<p>Error: ${err.message}</p>`);
    }
  }

  async function getBarPlotData(summary) {
    let data = [];
    for (let i = 0; i < summary.length; i++) {
      if (
        !data.some(
          (e) => e.name === summary[i]["profile"] + `: ${summary[i]["matrix"]}`
        )
      ) {
        data.push({
          x: [summary[i]["sample"]],
          y: [summary[i]["logTotalMutations"]],
          text: [parseInt(summary[i]["meanTotalMutations"])],
          type: "bar",
          name: summary[i]["profile"] + `: ${summary[i]["matrix"]}`,
          marker: {
            color: summary[i].color,
          },
        });
      } else {
        let existingData = data.find(
          (e) => e.name === summary[i]["profile"] + `: ${summary[i]["matrix"]}`
        );
        existingData.x.push(summary[i]["sample"]);
        existingData.y.push(summary[i]["logTotalMutations"]);
        existingData.text.push(parseInt(summary[i]["meanTotalMutations"]));
      }
    }
    return data;
  }

  // This function plots the mutational spectrum mutational count as boxplots for each cancer type for the given dataset.

  /**

Plots the mutational burden by cancer type for a given project.
@async
@function plotProjectMutationalBurdenByCancerType
@memberof mSigPortalPlots
@param {Object} project - An object containing mutational data for different cancer types.
@param {string} divID - The ID of the div where the plot should be displayed.
@returns {Promise} - A Promise that resolves when the plot is displayed.
@example
// Example usage:
plotProjectMutationalBurdenByCancerType(projectData, "plotDiv");
*/
  async function plotProjectMutationalBurdenByCancerType(project, divID) {
    project = groupBy(project, "cancer");
    Object.keys(project).forEach(function (key, index) {
      project[key] = groupBy(project[key], "sample");
      Object.keys(project[key]).forEach(function (patient, index) {
        project[key][patient] = Object.values(
          extractMutationalSpectra(project[key][patient], "sample")
        )[0];
      });
    });

    // Loop through all the cancertypes in project and create a trace for each cancer type and add it to the data array

    const cancerTypes = Object.keys(project);

    const data = [];

    const boxColor = {};
    const allColors = linspace(0, 360, cancerTypes.length);
    for (var i = 0; i < cancerTypes.length - 1; i++) {
      var result = "hsl(" + allColors[i] + ",50%" + ",50%)";
      boxColor[cancerTypes[i]] = result;
    }

    for (let cancerType of cancerTypes) {
      const cancerTypeData = Object.values(project[cancerType]);

      const trace = {
        // x: Object.keys(project[cancerType]),
        y: Object.values(cancerTypeData).map((e) =>
          Math.log10(Object.values(e).reduce((a, b) => a + b, 0))
        ),
        type: "box",
        name: cancerType,
        marker: {
          color: boxColor[cancerType],
        },
        boxpoints: "Outliers",
      };

      data.push(trace);
    }

    const layout = {
      title: `Mutational Burden by Cancer Type`,
      xaxis: {
        title: "Cancer Type",
        type: "category",
        automargin: true,
      },
      yaxis: {
        title: "Log (Number of Mutations)",
      },
      barmode: "stack",
      height: 600,
    };

    Plotly.default.newPlot(divID, data, layout);
  }

  //#endregion

  //#region Plot a patient's mutational spectra

  // This function plots the mutational spectrum for the given parameters.
  async function plotPatientMutationalSpectrumICGC(
    mutationalSpectra,
    matrixSize = 96,
    divID = "mutationalSpectrumMatrix"
  ) {
    const numberOfPatients = Object.keys(mutationalSpectra).length;
    if (numberOfPatients == 0) {
      $(`#${divID}`).html(
        `<p style="color:red">Error: no data available for the selected parameters.</p>`
      );
    } else if (numberOfPatients > 1) {
      const layout = {
        title: `Mutational Spectra for ${Object.keys(mutationalSpectra).join(
          ", "
        )}`,
        xaxis: { title: "Mutation Type" },
        yaxis: { title: "Count" },
        barmode: "group",
      };

      const traces = Object.keys(mutationalSpectra).map((patient) => ({
        x: Object.keys(mutationalSpectra[patient]),
        y: Object.values(mutationalSpectra[patient]),
        name: `${patient}`,
        type: "bar",
      }));

      Plotly.default.newPlot(divID, traces, layout);
    } else {
      let traces = [];

      const layout = {
        title: `Mutational Spectra for ${Object.keys(mutationalSpectra).join(
          ", "
        )}`,
        xaxis: { title: "Mutation Type" },
        yaxis: { title: "Count" },
        barmode: "group",
      };

      for (let i = 0; i < Object.keys(mutationalSpectra).length; i++) {
        let plotlyData = formatMutationalSpectraData(
          mutationalSpectra[Object.keys(mutationalSpectra)[i]],
          Object.keys(mutationalSpectra)[i]
        );

        traces = traces.concat(plotlyData);
      }

      Plotly.default.newPlot(divID, traces, layout);
    }
  }

  /**

Renders a plot of the mutational spectra for one or more patients in a given div element ID using Plotly.
@async
@function plotPatientMutationalSpectrum
@memberof mSigPortalPlots
@param {Object} mutationalSpectra - An object containing the mutational spectra data for one or more patients.
@param {number} [matrixSize=96] - The size of the plot matrix. Defaults to 96.
@param {string} [divID='mutationalSpectrumMatrix'] - The ID of the div element to render the plot in. Defaults to 'mutationalSpectrumMatrix'.
@returns {Promise<void>} A promise that resolves when the plot has been rendered.
@throws {Error} An error is thrown if no data is available for the selected parameters.
*/

  // This function plots the mutational spectrum for the given parameters.
  async function plotPatientMutationalSpectrum(
    mutationalSpectra,
    divID = "mutationalSpectrumMatrix"
  ) {
    let matrixSize = mutationalSpectra[0].length;
    let mutationType = mutationalSpectra[0][0].profile;
    const numberOfPatients = Object.keys(mutationalSpectra).length;
    console.log(numberOfPatients, mutationType, matrixSize);

    if (numberOfPatients == 0) {
      $(`#${divID}`).html(
        `<p style="color:red">Error: no data available for the selected parameters.</p>`
      );
    } else if (
      numberOfPatients > 2 &&
      matrixSize == 96 &&
      mutationType == "SBS"
    ) {
      mutationalSpectra = extractMutationalSpectra(mutationalSpectra);
      const layout = {
        title: `Mutational Spectra for ${Object.keys(mutationalSpectra).join(
          ", "
        )}`,
        xaxis: { title: "Mutation Type" },
        yaxis: { title: "Count" },
        barmode: "group",
      };

      const traces = Object.keys(mutationalSpectra).map((patient) => ({
        x: Object.keys(mutationalSpectra[patient]),
        y: Object.values(mutationalSpectra[patient]),
        name: `${patient}`,
        type: "bar",
      }));

      Plotly.default.newPlot(divID, traces, layout);
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 96 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS96Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1]
      );
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 96 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS96(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 192 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS192(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 192 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS192Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1]
      );
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 288 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS288(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 384 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS384(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 1536 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS1536(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 78 &&
      mutationType == "DBS"
    ) {
      let traces = plotMutationalProfileDBS78(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 78 &&
      mutationType == "DBS"
    ) {
      let traces = plotMutationalProfileDBS78Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1],
        "pc"
      );
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 186 &&
      mutationType == "DBS"
    ) {
      let traces = plotMutationalProfileDBS186(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 28 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID28(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 29 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID29(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 83 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID83(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 83 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID83Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1],
        "pc"
      );
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 415 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID415(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 32 &&
      mutationType == "RS"
    ) {
      let traces = plotMutationalProfileRS32(mutationalSpectra[0]);
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 32 &&
      mutationType == "RS"
    ) {
      let traces = plotMutationalProfileRS32Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1]
      );
      Plotly.default.newPlot(divID, traces.traces, traces.layout);
      return traces;
    } else {
      let traces = [];

      const layout = {
        title: `Mutational Spectra for ${Object.keys(mutationalSpectra).join(
          ", "
        )}`,
        xaxis: { title: "Mutation Type" },
        yaxis: { title: "Count" },
        barmode: "group",
      };

      for (let i = 0; i < Object.keys(mutationalSpectra).length; i++) {
        let plotlyData = formatMutationalSpectraData(
          mutationalSpectra[Object.keys(mutationalSpectra)[i]],
          Object.keys(mutationalSpectra)[i]
        );

        traces = traces.concat(plotlyData);
      }

      Plotly.default.newPlot(divID, traces, layout);
    }
  }

  // Write a function that plots a list of mutational spectra one on top of the other in a column using Plotly. The input should be the list of mutational spectra.
  // The output should be a plotly plot with the mutational spectra in a column.

  // This converts the mutational spectra data to a format that can be used to create a plotly chart
  // It takes in the mutational spectra data, the matrix size, and the sample
  // It returns the data in a format that can be used to create a plotly chart
  // The data is an array of objects. Each object has a name, x, y, and type property.
  // The name property is the name of the mutation type
  // The x property is an array of the mutation names
  // The y property is an array of the mutation frequencies
  // The type property is the type of substitution that takes place

  function formatMutationalSpectraData(mutationalSpectrum, sample) {
    const matrixSize = Object.keys(mutationalSpectrum).length;
    if (matrixSize === 96) {
      const substitutionTypes = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];

      const data = substitutionTypes.map((substitutionType) => {
        return {
          name: `${substitutionType}  ${sample}`,
          x: [],
          y: [],
          type: "bar",
        };
      });

      substitutionTypes.forEach((substitutionType) => {
        Object.keys(mutationalSpectrum)
          .filter((key) => {
            return key.includes(substitutionType);
          })
          .forEach((key) => {
            data
              .find((e) => e.name === `${substitutionType}  ${sample}`)
              .x.push(key);
            data
              .find((e) => e.name === `${substitutionType}  ${sample}`)
              .y.push(mutationalSpectrum[key]);
          });
      });

      return data;
    } else if (matrixSize === 192) {
      console.error("Not supported yet");
    } else if (matrixSize === 1536) {
      console.error("Not supported yet");
    } else {
      console.error("Invalid Matrix Size");
    }
  }

  //#endregion

  //#region Creates a force directed tree of the patients in the study based on their mutational spectra

  // This function extracts the mutational spectra out of the mSigPortal API call

  function extractMutationalSpectra(data, groupName = "sample") {
    data = data.flat();

    // Group all of the dictionaries in the data array by sample name
    let groupedData = groupBy(data, groupName);

    // Converts the grouped data into mutational spectrum dictionaries that can be used to create a force directed tree.
    Object.keys(groupedData).forEach(function (key) {
      let mutationalSpectrum = init_sbs_mutational_spectra();

      groupedData[key].forEach((mutation) => {
        let mutationType = mutation["mutationType"];
        if (groupName == "sample") {
          mutationalSpectrum[mutationType] = mutation["mutations"];
        } else if (groupName == "signatureName") {
          mutationalSpectrum[mutationType] = mutation["contribution"];
        } else {
          console.error("Invalid group name");
        }
      });

      groupedData[key] = mutationalSpectrum;
    });
    return groupedData;
  }

  /**

This function creates a heatmap using the cosine similarity matrix for the given grouped data.
@async
@function
@memberof mSigPortalPlots
@param {Object} groupedData - An object containing grouped data where each key is a sample name and its value is an object containing sample data.
@param {string} [studyName="PCAWG"] - The name of the study. Default value is "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genomic data used. Default value is "WGS".
@param {string} [cancerType="Lung-AdenoCA"] - The type of cancer. Default value is "Lung-AdenoCA".
@param {string} [divID="cosineSimilarityHeatMap"] - The ID of the div where the heatmap should be displayed. Default value is "cosineSimilarityHeatMap".
@returns {Array<Array<number>>} - The cosine similarity matrix.
*/

  async function plotCosineSimilarityHeatMap(
    groupedData,
    studyName = "PCAWG",
    genomeDataType = "WGS",
    cancerType = "Lung-AdenoCA",
    divID = "cosineSimilarityHeatMap",
    conductDoubleClustering = true,
    colorscale = "RdBu"
  ) {
    groupedData = extractMutationalSpectra(groupedData);
    let distanceMatrix = await createDistanceMatrix(
      Object.values(groupedData).map((data) => Object.values(data)),
      cosineSimilarity,
      true
    );

    let cosSimilarityMatrix = distanceMatrix.map(function (row) {
      return row.map(function (cell) {
        return 1 - cell;
      });
    });
    let reorderedData;
    if (conductDoubleClustering) {
      reorderedData = doubleClustering(
        cosSimilarityMatrix,
        Object.keys(groupedData),
        Object.keys(groupedData)
      );
    } else {
      reorderedData = {
        matrix: cosSimilarityMatrix,
        rowNames: Object.keys(groupedData),
        colNames: Object.keys(groupedData),
      };
    }

    let plotlyData = [
      {
        z: reorderedData.matrix,
        x: reorderedData.rowNames,
        y: reorderedData.colNames,
        type: "heatmap",
        colorscale: colorscale,
      },
    ];

    let layout = {
      title: `${studyName} ${cancerType} ${genomeDataType} Cosine Similarity Heatmap`,
      height: 800,
      xaxis: {
        title: "Sample",
        type: "category",
        nticks: Object.keys(groupedData).length,
      },
      yaxis: {
        title: "Sample",
        type: "category",
        nticks: Object.keys(groupedData).length,
      },
    };
    Plotly.default.newPlot(divID, plotlyData, layout);
    return cosSimilarityMatrix;
  }

/**
 * Plots the cumulative exposure values for each "group" across all the different "sample".
 *
 * @param {string} jsonData - The JSON data structure containing the exposure values for each signatureName and sample.
 * @param {string} divID - The string containing the ID of the div where the plot should be displayed.
 * @param {string} group - The string containing the name of the grouping variable. Default value is "signatureName".

* @returns {void}
 *
 * @example
 * const jsonData = '[{...}, {...}, {...}]';
 * plotSignatureActivityDataBy(divID, jsonData, group = "signatureName");
 */
function plotSignatureActivityDataBy(divID, data, group = "signatureName") {
  // Group the data by the specified group using the groupBy function
  const groupedData = groupBy(data, group);

  // Create an array of box trace objects for each group
  const groupTraces = Object.keys(groupedData).map((groupName) => {
    const exposures = groupedData[groupName].map((d) => Math.log10(d.exposure));
    const samples = groupedData[groupName].map((d) => d.sample);
    const numNonZero = exposures.filter((exposure) => exposure !== -Infinity).length;
    return {
      y: exposures,
      x: new Array(exposures.length).fill(groupName),
      type: 'box',
      name: groupName,
      boxpoints: 'all',
      jitter: 0.3,
      hovertext: samples,
      hovertemplate: `<b>${groupName}</b><br>Log(Exposure): %{y:.2f}<br>` +
        `Fraction of samples with non-zero exposure: ${numNonZero} / ${exposures.length}`,
    };
  });

  // Plot the box traces using Plotly and display the plot in the specified divID
  Plotly.default.newPlot(divID, groupTraces, {
    title: `Cumulative Exposure for ${group}`,
    yaxis: { title: 'Log(Exposure)' },
    xaxis: { title: group},
  });
}

  
  /**

Plots a force directed tree of the patients in the study based on their mutational spectra.
@async
@function plotForceDirectedTree
@memberof mSigPortalPlots
@param {Object} groupedData - An object containing patient data grouped by mutational spectra.
@param {string} [studyName="PCAWG"] - The name of the study. Defaults to "PCAWG".
@param {string} [genomeDataType="WGS"] - The type of genome data. Defaults to "WGS".
@param {string} [cancerType="Lung-AdenoCA"] - The type of cancer. Defaults to "Lung-AdenoCA".
@param {string} [divID="forceDirectedTree"] - The ID of the HTML element where the force directed tree will be displayed. Defaults to "forceDirectedTree".
@param {number} [maxDepth=0] - The maximum depth of the tree. If set to 0, the entire tree will be displayed. Defaults to 0.
@returns {Object} - An object containing the formatted clusters for the force directed tree.
*/

  // This function plots a force directed tree of the patients in the study based on their mutational spectra
  async function plotForceDirectedTree(
    groupedData,
    studyName = "PCAWG",
    genomeDataType = "WGS",
    cancerType = "Lung-AdenoCA",
    divID = "forceDirectedTree",
    maxDepth = 0
  ) {
    groupedData = extractMutationalSpectra(groupedData);
    let distanceMatrix = await createDistanceMatrix(
      Object.values(groupedData).map((data) => Object.values(data)),
      cosineSimilarity,
      true
    );

    let clusters = await hierarchicalClustering(
      distanceMatrix,
      Object.keys(groupedData)
    );

    let formattedClusters = formatHierarchicalClustersToAM5Format(
      clusters,
      studyName,
      genomeDataType,
      cancerType,
      Object.keys(groupedData).length,
      groupedData
    );

    // $(`#${divID}`).css({"width": "100%", "height": "550px", "max-width": "100%"})
    const element = document.getElementById(divID);
    element.style.width = "100%";
    element.style.height = "600px";
    element.style.maxWidth = "100%";

    if (maxDepth != 0) {
      formattedClusters = limitDepth(formattedClusters, maxDepth);
    }

    generateForceDirectedTree(formattedClusters, divID);

    return formattedClusters;
  }

  // Generates an AMCharts force directed tree based on the given data and parameters
  // https://www.amcharts.com/docs/v5/charts/hierarchy/force-directed/

  async function generateForceDirectedTree(data, divID) {
    // Create root element
    // https://www.amcharts.com/docs/v5/getting-started/#Root_element
    var root = am5.Root.new(divID);

    // Set themes
    // https://www.amcharts.com/docs/v5/concepts/themes/
    root.setThemes([am5themes_Animated.default.new(root)]);

    // Create wrapper container
    var container = root.container.children.push(
      am5.Container.new(root, {
        width: am5.percent(100),
        height: am5.percent(100),
        layout: root.verticalLayout,
      })
    );

    // Create series
    // https://www.amcharts.com/docs/v5/charts/hierarchy/#Adding
    var series = container.children.push(
      am5hierarchy.ForceDirected.new(root, {
        singleBranchOnly: false,
        downDepth: 2,
        initialDepth: 0,
        valueField: "totalMutationCount",
        categoryField: "name",
        childDataField: "children",
        minRadius: 20,
        maxRadius: 80,
        centerStrength: 0.5,
      })
    );

    series.nodes.template._settings.tooltipText =
      "Total Mutations: {totalMutationCount}";
    series.adapters.add("fill", function (fill, target) {
      return fill.lighten(target.dataItem.level * 0.25);
    });

    series.data.setAll([data]);
    series.set("selectedDataItem", series.dataItems[0]);

    series.appear(1000, 100);
  }

  //#endregion

  //#region Visualizes a set of mutational spectra using UMAP.

  /**

Plots a UMAP visualization of the input data.
@async
@function
@memberof mSigPortalPlots
@param {object} data - The input data to visualize.
@param {string} [datasetName="PCAWG"] - The name of the dataset being visualized.
@param {string} divID - The ID of the HTML div element to plot the visualization in.
@param {number} [nComponents=3] - The number of dimensions to project the data into.
@param {number} [minDist=0.1] - The minimum distance between points in the UMAP algorithm.
@param {number} [nNeighbors=15] - The number of neighbors to consider in the UMAP algorithm.
@returns {object[]} An array of plot trace objects, containing the x, y, and z coordinates of the plot, as well as any additional plot options.
@see {@link https://plotly.com/python/3d-mesh/} For more information on the alpha-shape algorithm used in 3D plotting.
@see {@link https://plotly.com/python/line-and-scatter/} For more information on scatter plots.
@see {@link https://umap-learn.readthedocs.io/en/latest/} For more information on the UMAP algorithm.
*/
  async function plotUMAPVisualization(
    data,
    datasetName = "PCAWG",
    divID,
    nComponents = 3,
    minDist = 0.1,
    nNeighbors = 15
  ) {
    data = extractMutationalSpectra(data);
    let umap = new UMAP.default.UMAP({
      nComponents: nComponents,
      minDist: minDist,
      nNeighbors: nNeighbors,
    });
    let embeddings = await umap.fit(
      Object.values(data).map((data) => Object.values(data))
    );
    let plotType = nComponents === 3 ? "scatter3d" : "scatter";
    let axisLabels = nComponents === 3 ? ["X", "Y", "Z"] : ["X", "Y"];

    let trace = [
      {
        x: embeddings.map((d) => d[0]),
        y: embeddings.map((d) => d[1]),
        text: Object.keys(data),
        mode: "markers",
        type: plotType,
        marker: { size: 6 },
      },
    ];

    if (nComponents === 3) {
      trace[0].z = embeddings.map((d) => d[2]);

      trace.push({
        alphahull: 7,
        opacity: 0.1,
        type: "mesh3d",
        x: embeddings.map((d) => d[0]),
        y: embeddings.map((d) => d[1]),
        z: embeddings.map((d) => d[2]),
      });
    }

    let layout = {
      title: `${nComponents} Component UMAP Projection of ${datasetName} Dataset`,
      xaxis: { title: axisLabels[0] },
      yaxis: { title: axisLabels[1] },
    };

    if (nComponents === 3) {
      layout.scene = { zaxis: { title: axisLabels[2] } };
    }

    Plotly.default.newPlot(divID, trace, layout);

    return trace;
  }

  //#endregion

  //#region Signature Fitting

  /**

Fits mutational spectra to mutational signatures using non-negative least squares (NNLS) regression.
@async
@function fitMutationalSpectraToSignatures
@param {Object} mutationalSignatures - An object containing mutational signature data with signature names as keys and nested objects containing signature values as values.
@param {Object} mutationalSpectra - An object containing mutational spectra data with sample names as keys and nested objects containing spectra values as values.
@returns {Promise<Object>} - A Promise that resolves to an object with sample names as keys and nested objects containing signature exposure values as values.
*/

  // This function fits the mutational spectra of a set of samples to a set of mutational signatures

  async function fitMutationalSpectraToSignatures(
    mutationalSignatures,
    mutationalSpectra
  ) {
    let signatures = Object.keys(mutationalSignatures);
    let samples = Object.keys(mutationalSpectra);
    let nnlsInputSignatures = Object.values(mutationalSignatures).map(
      (data) => {
        return Object.values(data);
      }
    );
    let nnlsInputMatrix = Object.values(mutationalSpectra).map((data) => {
      return Object.values(data);
    });

    let results = {};

    for (let i = 0; i < samples.length; i++) {
      let nnlsInput = nnlsInputMatrix[i];
      let nnlsOutput = await nnls(nnlsInputSignatures, nnlsInput);
      const exposureValues = nnlsOutput.x;

      for (let j = 0; j < signatures.length; j++) {
        nnlsOutput[signatures[j]] = exposureValues[j];
      }
      delete nnlsOutput["x"];
      results[samples[i]] = nnlsOutput;
    }
    return results;
  }

  /**

Plots mutational signature exposure data as a pie chart.
@async
@function plotPatientMutationalSignaturesExposure
@param {Object} exposureData - An object containing mutational signature exposure data.
@param {string} divID - The ID of the HTML div element in which to display the plot.
@param {string} sample - The name of the sample being plotted.
@returns {Object} - The data used to create the plot.
*/

  // This function plots the exposure of a set of samples to a set of mutational signatures
  async function plotPatientMutationalSignaturesExposure(
    exposureData,
    divID,
    sample
  ) {
    let dataset = deepCopy(exposureData);

    const rnorm = dataset["rnorm"];
    delete dataset["rnorm"];
    const plotType = "pie";
    const plotTitle = `Mutational Signature Exposure for ${sample} (r-norm = ${rnorm})`;

    let data = {
      labels: Object.keys(dataset),
      values: Object.values(dataset),
      name: `${sample} exposure values`,
      textposition: "inside",
      hole: 0.4,
      hoverinfo: "name + value",
      type: plotType,
    };

    let layout = {
      title: plotTitle,
    };

    Plotly.default.newPlot(divID, [data], layout);

    return data;
  }

  /**

Plot the mutational signature exposure data for the given dataset using Plotly heatmap visualization.
@async
@function
@param {Object} exposureData - An object containing mutational signature exposure data for each sample.
@param {string} divID - The ID of the HTML div element where the heatmap plot should be rendered.
@param {boolean} [relative=true] - A boolean indicating whether to normalize the exposure data by total count for each sample.
@param {string} [datasetName="PCAWG"] - A string indicating the name of the dataset being plotted.
@returns {Object} - An object representing the data plotted in the heatmap.
*/
  async function plotDatasetMutationalSignaturesExposure(
    exposureData,
    divID,
    relative = true,
    datasetName = "PCAWG",
    doubleCluster = true,
    colorscale = "Custom"
  ) {
    let dataset = deepCopy(exposureData);
    // Remove the rnorm values from each sample of the exposure data

    for (let sample in dataset) {
      delete dataset[sample]["rnorm"];
    }

    if (relative) {
      for (let sample in dataset) {
        let total = 0;
        for (let signature in dataset[sample]) {
          total += dataset[sample][signature];
        }
        for (let signature in dataset[sample]) {
          dataset[sample][signature] /= total;
        }
      }
    }
    let reorderedData;
    if (doubleCluster) {
      reorderedData = doubleClustering(
        Object.values(dataset).map((data) => Object.values(data)),
        Object.keys(dataset),
        Object.keys(dataset[Object.keys(dataset)[0]])
      );
    } else {
      console.log("data is not ordered");
      reorderedData = {
        matrix: Object.values(dataset).map((data) => Object.values(data)),
        rowNames: Object.keys(dataset),
        colNames: Object.keys(dataset[Object.keys(dataset)[0]]),
      };
    }
    if (colorscale == "custom") {
      colorscale = [
        ["0.0", "rgb(49,54,149)"],
        ["0.025", "rgb(69,117,180)"],
        ["0.05", "rgb(116,173,209)"],
        ["0.075", "rgb(171,217,233)"],
        ["0.1", "rgb(224,243,248)"],
        ["0.125", "rgb(254,224,144)"],
        ["0.15", "rgb(253,174,97)"],
        ["0.175", "rgb(244,109,67)"],
        ["0.2", "rgb(215,48,39)"],
        ["1.0", "rgb(165,0,38)"],
      ];
    }

    let data = {
      z: reorderedData.matrix,
      x: reorderedData.colNames,
      y: reorderedData.rowNames,
      type: "heatmap",
      colorscale: colorscale,
    };

    let layout = {
      title: `Mutational Signature Exposure for ${datasetName} Dataset`,
      xaxis: {
        title: "Samples",
        nticks: Object.keys(dataset[Object.keys(dataset)[0]]).length,
      },
      yaxis: {
        title: "Mutational Signatures",
        nticks: Object.keys(dataset).length,
      },
      height: 800,
    };

    Plotly.default.newPlot(divID, [data], layout);

    return data;
  }

  function plotSignatureAssociations(divID, data, signature1, signature2) {
    let dat = plotSignatureAssociation(data, signature1, signature2);
    Plotly.default.newPlot(divID, dat.traces, dat.layout);

  }
  
  function plotMSPrevalenceData(divID, data) {
    let dat = plotMSPrevalence(data);
    Plotly.default.newPlot(divID, dat.traces, dat.layout);

  }

  //#endregion

  //#region Define the public members of the mSigSDK
  const mSigPortalData = {
    getMutationalSignaturesOptions,
    getMutationalSignaturesData,
    getMutationalSignaturesSummary,
    getMutationalSpectrumOptions,
    getMutationalSpectrumData,
    getMutationalSpectrumSummary,
    getMutationalSignatureAssociationOptions,
    getMutationalSignatureAssociationData,
    getMutationalSignatureActivityOptions,
    getMutationalSignatureActivityData,
    getMutationalSignatureLandscapeData,
    getMutationalSignatureEtiologyOptions,
    getMutationalSignatureEtiologyData,
    extractMutationalSpectra,
  };
  const mSigPortalPlots = {
    plotProfilerSummary,
    plotPatientMutationalSpectrum,
    plotForceDirectedTree,
    plotCosineSimilarityHeatMap,
    plotUMAPVisualization,
    plotProjectMutationalBurdenByCancerType,
    plotSignatureActivityDataBy,
    plotSignatureAssociations,
    plotMSPrevalenceData
  };

  const mSigPortal = {
    mSigPortalData,
    mSigPortalPlots,
  };

  const ICGC = {
    obtainICGCDataMAF,
    convertMatrix,
    convertWGStoPanel,
    plotPatientMutationalSpectrumICGC,
  };

  const tools = {
    groupBy,
  };

  //#endregion

  // Public members
  return {
    mSigPortal,
    ICGC,
    tools,
    fitMutationalSpectraToSignatures,
    plotPatientMutationalSignaturesExposure,
    plotDatasetMutationalSignaturesExposure,
  };
})();

export { mSigSDK };
