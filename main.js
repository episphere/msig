import * as UMAP from "https://esm.sh/umap-js@1.3.3";
import * as Plotly from "https://cdn.jsdelivr.net/npm/plotly.js-dist/+esm";

import * as am5 from "https://cdn.jsdelivr.net/npm/@amcharts/amcharts5/+esm";
import * as am5hierarchy from "https://cdn.jsdelivr.net/npm/@amcharts/amcharts5/hierarchy/+esm";

import * as am5themes_Animated from "https://cdn.jsdelivr.net/npm/@amcharts/amcharts5@5.3.7/themes/Animated.js/+esm";

import { default as plotMSPrevalence } from "./mSigPortalScripts/client/src/components/controls/plotly/msPrevalence/msPrevalence.js";
import { default as plotSignatureAssociation } from "./mSigPortalScripts/client/src/components/controls/plotly/msAssociation/msAssociation.js";
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

import { preprocessData, kFoldCV } from "./mSigSDKScripts/machineLearning.js";

import {
  convertMatrix,
  convertWGStoPanel,
  init_sbs_mutational_spectra,
  convertMutationalSpectraIntoJSON,
} from "./mSigSDKScripts/userData.js";
import {
  linspace,
  deepCopy,
  nnls,
  formatHierarchicalClustersToAM5Format,
  groupBy,
  createDistanceMatrix,
  hierarchicalClustering,
  doubleClustering,
  cosineSimilarity,
} from "./mSigSDKScripts/utils.js";

import {
  getProjectsByGene,
  getTpmCountsByGenesOnProjects,
  getTpmCountsByGenesFromFiles,
  getMafInformationFromProjects,
  getVariantInformationFromMafFiles,
  convertTCGAProjectIntoJSON,
} from "./mSigSDKScripts/tcga.js";

// import every single function one by one from the mSigPortalAPIs.js file

import {
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
} from "./mSigSDKScripts/mSigPortalAPIs.js";

// import * as mSigPortalPlotting from "./index.js";

const mSigSDK = (function () {
  /**
   * @namespace mSigPortalData
   */

  /**
   * @namespace mSigPortalPlots
   */

  /**
   * @namespace machineLearning
   */

  /**
   * @namespace userData
   */

  /**
   * @namespace tcga
   */


  //#region Plot the summary of a dataset

  function plotGraphWithPlotlyAndMakeDataDownloadable(divID, data, layout) {
    // Plot the graph using Plotly
    Plotly.default.newPlot(divID, data, layout);

    // Ensure Font Awesome CSS is included
    const fontAwesomeLink =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css";
    if (!document.querySelector(`link[href="${fontAwesomeLink}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = fontAwesomeLink;
      document.head.appendChild(link);
    }

    // Get the container of the Plotly graph
    const container = document.getElementById(divID);

    // Ensure the container has a relative position
    container.style.position = "relative";

    // Create a download button with only the Font Awesome download icon
    const downloadBtn = document.createElement("div");
    downloadBtn.innerHTML =
      '<button class="btn"><i class="fa fa-download"></i></button>';
    const btn = downloadBtn.firstChild;

    // Position the button at the bottom right corner of the container
    btn.style.position = "absolute";
    btn.style.bottom = "0";
    btn.style.right = "0";

    // Add an event listener to handle the download action
    btn.addEventListener("click", function () {
      const graphData = {
        traces: data,
        layout: layout,
      };
      const blob = new Blob([JSON.stringify(graphData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "graph_data.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    // Append the download button to the container
    container.appendChild(btn);

    // Add the provided CSS
    const css = `
        .btn {
            background-color: DodgerBlue;
            border: none;
            border-radius: 100%;
            color: white;
            padding: 12px 12px;
            cursor: pointer;
            font-size: 20px;
        }

        .btn:hover {
            background-color: RoyalBlue;
        }
    `;

    const style = document.createElement("style");
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  /**

Generates a mutational spectrum summary plot and displays it in a given HTML div element.
@async
@function plotProfilerSummary
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
        plotGraphWithPlotlyAndMakeDataDownloadable(divID, data, layout);
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

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, data, layout);
  }

  //#endregion

  //#region Plot a patient's mutational spectra

  /**
   * Plots the mutational spectrum for the given parameters.
   * @async
   * @function plotPatientMutationalSpectrumuserData
   * @memberof mSigPortalPlots
   * @param {Object} mutationalSpectra - An object containing the mutational spectra data.
   * @param {number} [matrixSize=96] - The size of the matrix to be plotted.
   * @param {string} [divID="mutationalSpectrumMatrix"] - The ID of the div element where the plot will be displayed.
   */
  async function plotPatientMutationalSpectrumuserData(
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

      plotGraphWithPlotlyAndMakeDataDownloadable(divID, traces, layout);
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

      plotGraphWithPlotlyAndMakeDataDownloadable(divID, traces, layout);
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

      plotGraphWithPlotlyAndMakeDataDownloadable(divID, traces, layout);
    } else if (
      numberOfPatients == 2 &&
      matrixSize == 96 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS96Comparison(
        mutationalSpectra[0],
        mutationalSpectra[1]
      );
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 96 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS96(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 192 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS192(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
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
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 288 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS288(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 384 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS384(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 1536 &&
      mutationType == "SBS"
    ) {
      let traces = plotMutationalProfileSBS1536(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 78 &&
      mutationType == "DBS"
    ) {
      let traces = plotMutationalProfileDBS78(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
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
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 186 &&
      mutationType == "DBS"
    ) {
      let traces = plotMutationalProfileDBS186(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 28 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID28(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 29 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID29(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 83 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID83(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
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
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 415 &&
      mutationType == "ID"
    ) {
      let traces = plotMutationalProfileID415(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
      return traces;
    } else if (
      numberOfPatients == 1 &&
      matrixSize == 32 &&
      mutationType == "RS"
    ) {
      let traces = plotMutationalProfileRS32(mutationalSpectra[0]);
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
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
      plotGraphWithPlotlyAndMakeDataDownloadable(
        divID,
        traces.traces,
        traces.layout
      );
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

      plotGraphWithPlotlyAndMakeDataDownloadable(divID, traces, layout);
    }
  }

  /**
   * Converts the mutational spectra data to a format that can be used to create a Plotly chart.
   * @function formatMutationalSpectraData
   * @memberof mSigPortalData
   * @param {Object} mutationalSpectrum - An object containing the mutational spectra data.
   * @param {string} sample - The name of the sample.
   * @returns {Object[]} The data in a format that can be used to create a Plotly chart. The data is an array of objects. Each object has a name, x, y, and type property. The name property is the name of the mutation type. The x property is an array of the mutation names. The y property is an array of the mutation frequencies. The type property is the type of substitution that takes place.
   */

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

  /**
   * Extracts the mutational spectra out of the mSigPortal API call.
   * @function extractMutationalSpectra
   * @memberof mSigPortalData
   * @param {Object[]} data - An array of objects containing the data from the mSigPortal API call.
   * @param {string} [groupName="sample"] - The name of the group to extract the mutational spectra from.
   * @returns {Object} An object containing the mutational spectra data grouped by the specified group name.
   */

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
   * @async
   * @function plotCosineSimilarityHeatMap
   * @description Generates a cosine similarity heatmap based on mutational spectra data.
   * This function processes grouped mutational data to compute cosine similarities,
   * optionally performs double clustering to reorder the data, and then visualizes
   * the similarities using a Plotly heatmap. It also supports displaying a table
   * representation of the cosine similarity matrix alongside the heatmap.
   * @memberof mSigPortalPlots
   * @param {Object} groupedData - The input data object where keys represent sample names
   *   and values are objects representing mutational spectra. The mutational spectra
   *   should be represented as key-value pairs where keys are mutation types and values
   *   are counts or frequencies.
   *   Example:
   *   ```
   *   {
   *     'Sample1': {'C>A': 10, 'C>G': 15, 'C>T': 20, ...},
   *     'Sample2': {'C>A': 5, 'C>G': 8, 'C>T': 12, ...},
   *     ...
   *   }
   *   ```
   *   The range of keys (mutation types) should be consistent across all samples. The values
   *   (counts or frequencies) can be integers or floats, and their range can vary based on the
   *   underlying data, but typically they are non-negative.
   *
   * @param {string} [studyName="PCAWG"] - The name of the study. This is used in the
   *   title of the heatmap. Common values include study identifiers like "PCAWG",
   *   "TCGA", or specific project names. The parameter should be a string and can
   *   technically accept any string value, but it is intended to represent the name
   *   of a study or dataset.
   *
   * @param {string} [genomeDataType="WGS"] - The type of genomic data. This is also
   *   used in the title of the heatmap. Expected values typically include abbreviations
   *   for common genomic data types such as "WGS" (Whole Genome Sequencing), "WES"
   *   (Whole Exome Sequencing), "RNA-Seq", etc. Similar to `studyName`, any string
   *   is technically accepted, but the intended use is to describe the data type.
   *
   * @param {string} [cancerType="Lung-AdenoCA"] - The type of cancer. This is included
   *   in the title of the heatmap. Common values are standard cancer type
   *   abbreviations or names, like "Lung-AdenoCA" (Lung Adenocarcinoma), "BRCA"
   *   (Breast Invasive Carcinoma), etc. Any string value is accepted, but it should
   *   represent a specific cancer type.
   *
   * @param {string} [divID="cosineSimilarityHeatMap"] - The ID of the HTML element where
   *   the heatmap will be rendered. This should be a valid HTML element ID. If an element
   *   with this ID does not exist, one will be created and appended to the document body.
   *   Any string is accepted, but it should correspond to a unique ID in the HTML
   *   document to avoid conflicts.
   *
   * @param {boolean} [conductDoubleClustering=true] - A flag indicating whether to
   *   perform double clustering (hierarchical clustering on both rows and columns)
   *   on the cosine similarity matrix. If `true`, the rows and columns of the heatmap
   *   will be reordered based on the clustering. If `false`, the order of samples in
   *   `groupedData` will be maintained. Boolean values `true` or `false` are expected.
   *
   * @param {string} [colorscale="RdBu"] - The Plotly colorscale to use for the heatmap.
   *   This can be any valid Plotly colorscale name (e.g., "Viridis", "Greys", "YlGnBu",
   *   "RdBu"). Plotly provides a wide range of predefined colorscales. The chosen
   *   colorscale will affect the visual representation of the similarity values. Any
   *   string is accepted but it should correspond to a valid Plotly colorscale for
   *   optimal results.
   *
   * @param {boolean} [showTable=false] - A flag indicating whether to display a table
   *   representation of the cosine similarity matrix alongside the heatmap. If `true`,
   *   a table will be rendered next to the heatmap. If `false`, only the heatmap will
   *   be displayed. Boolean values `true` or `false` are expected.
   *
   * @returns {Promise<number[][]>} A Promise that resolves to the cosine similarity matrix.
   *   The matrix is a two-dimensional array of numbers, where each number represents
   *   the cosine similarity between two samples. The values range from 0 to 1, where 1
   *   indicates perfect similarity and 0 indicates no similarity. The dimensions of
   *   the matrix will be NxN, where N is the number of samples in `groupedData`.
   *
   * @throws Will throw an error if the `cosineSimilarity` function or the
   *   `plotGraphWithPlotlyAndMakeDataDownloadable` function throws an error.
   *
   */

  async function plotCosineSimilarityHeatMap(
    groupedData,
    studyName = "PCAWG",
    genomeDataType = "WGS",
    cancerType = "Lung-AdenoCA",
    divID = "cosineSimilarityHeatMap",
    conductDoubleClustering = true,
    colorscale = "RdBu",
    showTable = false
  ) {
    let container = document.getElementById(divID);
    if (!container) {
      container = document.createElement('div');
      container.id = divID;
      document.body.appendChild(container);
    }

    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = showTable ? 'row' : 'column';
    container.style.gap = '20px';
    container.style.width = '100%';
    container.style.alignItems = 'center'; // Center items vertically

    const heatmapDiv = document.createElement('div');
    heatmapDiv.id = `${divID}-heatmap`;
    heatmapDiv.style.flex = showTable ? '1' : '1';
    container.appendChild(heatmapDiv);

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
      width: showTable ? container.offsetWidth * 0.6 : container.offsetWidth,
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

    plotGraphWithPlotlyAndMakeDataDownloadable(heatmapDiv.id, plotlyData, layout);

    if (showTable) {
      const tableDiv = document.createElement('div');
      tableDiv.id = `${divID}-table`;
      tableDiv.style.flex = '1';
      tableDiv.style.overflowX = 'auto';
      tableDiv.style.display = 'flex';  // Add flex display
      tableDiv.style.alignItems = 'center';  // Center vertically
      tableDiv.style.height = '800px';  // Match heatmap height
      container.appendChild(tableDiv);

      const tableWrapper = document.createElement('div');  // Add wrapper for table
      tableWrapper.style.width = '100%';
      tableDiv.appendChild(tableWrapper);

      const table = document.createElement('table');
      table.style.borderCollapse = 'collapse';
      table.style.width = '100%';
      table.style.fontSize = '12px';

      // Create header row with simple styling
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headerRow.innerHTML = '<th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa;">Sample</th>';
      reorderedData.colNames.forEach(colName => {
        headerRow.innerHTML += `<th style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa;">${colName}</th>`;
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Create table body with simple styling
      const tbody = document.createElement('tbody');
      reorderedData.matrix.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${reorderedData.rowNames[rowIndex]}</td>`;
        row.forEach(value => {
          const formattedValue = value.toFixed(3);
          tr.innerHTML += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formattedValue}</td>`;
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
    }

    return cosSimilarityMatrix;
  }

  /**
   * @memberof mSigPortalPlots
   * @function plotSignatureActivityDataBy
   * @description Generates a box plot of signature activity data, grouped by a specified attribute. The function takes a dataset and groups it by the provided attribute (e.g., "signatureName", "study", "cancerType"). For each group, it creates a box trace where the y-values represent the log10 of the exposure values and the x-values are set to the group name. The box plot displays the distribution of exposure values for each group, with the option to show all individual data points (jittered for better visibility). Hovering over the data points reveals the sample name and the log10 of the exposure value. The plot also indicates the fraction of samples within each group that have non-zero exposure.
   *
   * @param {string} divID - The ID of the div element where the plot will be rendered.
   * @param {Array<object>} data - An array of objects representing the signature activity data. Each object must have at least the following properties:
   *   - `exposure`: A numeric value representing the exposure of a signature. It can be any positive number or zero.
   *   - `sample`: A string representing the sample ID.
   *   - The `data` array must also contain a property matching the name specified by the `group` parameter (e.g., "signatureName", "study", "cancerType").
   * @param {string} [group="signatureName"] - The attribute to group the data by. Possible values are any property name present in the data objects, including, but not limited to:
   *   - `"signatureName"`: Groups the data by signature names.
   *   - `"study"`: Groups the data by study IDs.
   *   - `"cancerType"`: Groups the data by cancer types.
   *   - `"sample"`: Groups the data by sample IDs (Note: this might not result in a meaningful box plot).
   *   - Any other custom property that exists in the data objects.
   *   The default value is `"signatureName"`.
   * @return {void} - This function does not return a value. It directly renders the plot in the specified `divID`.
   */
  function plotSignatureActivityDataBy(divID, data, group = "signatureName") {
    // Group the data by the specified group using the groupBy function
    const groupedData = groupBy(data, group);

    // Create an array of box trace objects for each group
    const groupTraces = Object.keys(groupedData).map((groupName) => {
      const exposures = groupedData[groupName].map((d) =>
        Math.log10(d.exposure)
      );
      const samples = groupedData[groupName].map((d) => d.sample);
      const numNonZero = exposures.filter(
        (exposure) => exposure !== -Infinity
      ).length;
      return {
        y: exposures,
        x: new Array(exposures.length).fill(groupName),
        type: "box",
        name: groupName,
        boxpoints: "all",
        jitter: 0.3,
        hovertext: samples,
        hovertemplate:
          `<b>${groupName}</b><br>Log(Exposure): %{y:.2f}<br>` +
          `Fraction of samples with non-zero exposure: ${numNonZero} / ${exposures.length}`,
      };
    });

    // Plot the box traces using Plotly and display the plot in the specified divID
    plotGraphWithPlotlyAndMakeDataDownloadable(divID, groupTraces, {
      title: `Cumulative Exposure for ${group}`,
      yaxis: { title: "Log(Exposure)" },
      xaxis: { title: group },
    });
  }

  /**
   * @memberof mSigPortalPlots
   * @function plotForceDirectedTree
   * @description This function generates and displays a force-directed tree representing the relationships between patients in a study based on their mutational spectra. It calculates the cosine similarity between the mutational spectra of patients, performs hierarchical clustering based on these similarities, and then visualizes the resulting clusters as a force-directed tree.
   *
   * @param {object} groupedData - An object where keys represent sample IDs and values are objects containing mutational spectra data. The structure of `groupedData` is expected to be:
   *   `{ sampleId1: { mutationType1: count1, mutationType2: count2, ... }, sampleId2: { mutationType1: count3, mutationType2: count4, ... }, ... }`
   *   The inner objects (e.g., `{ mutationType1: count1, ... }`) represent the mutational spectrum for a given sample. `mutationType` keys can be any string representing a type of mutation (e.g., "C>A", "T>G"), and `count` values are non-negative integers representing the number of times that mutation type is observed in the sample.
   * @param {string} [studyName="PCAWG"] - The name of the study. This is used for labeling purposes in the visualization. Common values include, but are not limited to:
   *   - `"PCAWG"`
   *   - `"TCGA"`
   *   - Any other string representing a specific study.
   * @param {string} [genomeDataType="WGS"] - The type of genome data used. This is also used for labeling purposes. Possible values include:
   *   - `"WGS"`: Whole Genome Sequencing
   *   - `"WES"`: Whole Exome Sequencing
   *   - `"RNA-Seq"`: RNA Sequencing
   * @param {string} [cancerType="Lung-AdenoCA"] - The type of cancer being studied. This is used for labeling in the visualization. Examples include:
   *   - `"Lung-AdenoCA"`: Lung Adenocarcinoma
   *   - `"Breast-AdenoCA"`: Breast Adenocarcinoma
   *   - Any valid cancer type identifier.
   * @param {string} [divID="forceDirectedTree"] - The ID of the HTML div element where the force-directed tree will be rendered.
   * @return {object} - Returns the formatted hierarchical clusters used to generate the force-directed tree. The structure of this object is compatible with the AM5 charting library and represents the hierarchical relationships between samples based on their mutational spectra. The format is a nested object where each level represents a node in the tree. Each node can have properties such as `name`, `value`, `children` (an array of child nodes), and potentially others added during formatting.
   */

  // This function plots a force directed tree of the patients in the study based on their mutational spectra
  async function plotForceDirectedTree(
    groupedData,
    studyName = "PCAWG",
    genomeDataType = "WGS",
    cancerType = "Lung-AdenoCA",
    divID = "forceDirectedTree"
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

    generateForceDirectedTree(formattedClusters, divID);

    return formattedClusters;
  }

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
 * @memberof mSigPortalPlots
 * @function plotUMAPVisualization
 * @description Generates a UMAP (Uniform Manifold Approximation and Projection) visualization of mutational spectra data. UMAP is a dimensionality reduction technique used to project high-dimensional data into a lower-dimensional space (typically 2D or 3D) while preserving the global structure of the data. This function takes mutational spectra data, applies UMAP to reduce its dimensionality, and then creates either a 2D or 3D scatter plot to visualize the results. If `nComponents` is set to 3, it additionally generates a mesh3d trace to highlight the density of points in the 3D space.
 *
 * @param {object} data - An object representing the mutational spectra data. The structure of `data` is expected to be:
 *   `{ sampleId1: { mutationType1: count1, mutationType2: count2, ... }, sampleId2: { mutationType1: count3, mutationType2: count4, ... }, ... }`
 *   The outer keys (e.g., `sampleId1`, `sampleId2`) are sample identifiers (strings). The inner objects (e.g., `{ mutationType1: count1, ... }`) represent the mutational spectrum for a given sample. `mutationType` keys can be any string representing a type of mutation (e.g., "C>A", "T>G"), and `count` values are non-negative integers representing the number of times that mutation type is observed in the sample.
 * @param {string} [datasetName="PCAWG"] - The name of the dataset being visualized. This is used as part of the plot title. Examples include:
 *   - `"PCAWG"`
 *   - `"TCGA"`
 *   - Any other string that appropriately identifies the dataset.
 * @param {string} divID - The ID of the HTML div element where the plot will be rendered.
 * @param {number} [nComponents=3] - The number of dimensions to reduce the data to using UMAP. This determines whether a 2D or 3D plot is generated. Possible values are:
 *   - `2`: Generates a 2D scatter plot.
 *   - `3`: Generates a 3D scatter plot with an additional mesh3d trace.
 *   Any other positive integer is technically permissible but may not yield meaningful visualizations.
 * @param {number} [minDist=0.1] - The effective minimum distance between embedded points in the UMAP projection. Smaller values result in a more clustered embedding, while larger values preserve more of the global structure. The valid range is between 0.0 and 1.0.
 * @param {number} [nNeighbors=15] - The number of neighboring points to consider when constructing the UMAP. Larger values capture more global structure in the data, while smaller values preserve more local structure. Values should be positive integers, typically in the range of 2 to 100.
 * @return {object} - Returns the trace object used by Plotly to generate the visualization. This object contains the data points, plot type, marker settings, and, in the case of a 3D plot, the mesh3d settings. The structure depends on the value of `nComponents`.
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

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, trace, layout);

    return trace;
  }

  //#endregion

  //#region Signature Fitting

  /**
   * Fits mutational spectra to known mutational signatures using non-negative least squares (NNLS).
   *
   * This function calculates the exposure of mutational signatures for each sample by fitting
   * the observed mutational spectra to the reference mutational signatures. It then filters out
   * signatures whose contribution is below a fraction of the total exposure, by setting their
   * exposures to zero.
   *
   * You can choose to return exposures as absolute values (raw counts from NNLS) or relative values
   * (sum to 1 for each sample). The filtering threshold is a fraction between 0 and 1.
   *
   * @async
   * @function fitMutationalSpectraToSignatures
   * @memberof machineLearning
   * @param {Object} mutationalSignatures - Reference mutational signatures. Each key is a signature name,
   * and each value is an object of mutation types (e.g., {"C>A": weight, "C>G": weight}).
   * @param {Object} mutationalSpectra - Mutational spectra for each sample. Each key is a sample ID,
   * and each value is an object of mutation types with their counts (e.g., {"C>A": count, "C>G": count}).
   * @param {Object} [options] - Configuration options for filtering and output.
   * @param {number} [options.exposureThreshold=0] - Exclude signatures below this fraction of the total,
   * by setting their exposures to zero. Must be between 0 and 1.
   * @param {("absolute"|"relative")} [options.exposureType="relative"] - Return exposures as absolute or relative.
   * @param {boolean} [options.renormalize=true] - Whether to normalize exposures so that they sum to 1 after filtering.
   * @returns {Object} - An object with sample IDs as keys. Each value is an object of signature exposures.
   *
   * @example
   * // Example usage:
   * // 1. Get mutational signatures (e.g., from the mSigPortal API)
   * const mutationalSignatures = await mSigPortal.mSigPortalData.getMutationalSignaturesData(
   *   "WGS", "COSMIC_v3_Signatures_GRCh37_SBS96", "SBS", 96, 1000
   * );
   *
   * // 2. Extract mutational spectra for each sample
   * const extractedSpectra = await mSigPortal.mSigPortalData.extractMutationalSpectra(
   *   mutationalSignatures, "signatureName"
   * );
   *
   * // 3. Fit spectra to signatures with post-fit filtering
   * const nnlsExposures = await mSigPortal.signatureFitting.fitMutationalSpectraToSignatures(
   *   mutationalSignatures,
   *   extractedSpectra,
   *   {
   *     exposureThreshold: 0.1,
   *     exposureType: "relative",
   *     renormalize: true
   *   }
   * );
   *
   * console.log(nnlsExposures);
   * // {
   * //   Sample1: { SBS1: 0.75, SBS2: 0.25, SBS3: 0 },
   * //   Sample2: { SBS1: 0.9, SBS2: 0.1, SBS3: 0 },
   * //   ...
   * // }
   */
  async function fitMutationalSpectraToSignatures(
    mutationalSignatures,
    mutationalSpectra,
    {
      exposureThreshold = 0,
      exposureType = "relative",
      renormalize = true
    } = {}
  ) {
    // Validate the threshold
    if (exposureThreshold < 0 || exposureThreshold > 1) {
      throw new Error("exposureThreshold must be between 0 and 1.");
    }

    const signatureNames = Object.keys(mutationalSignatures);
    const sampleNames = Object.keys(mutationalSpectra);

    // Convert reference signatures to arrays for NNLS
    const nnlsInputSignatures = Object.values(mutationalSignatures).map(signatureData =>
      Object.values(signatureData)
    );

    // Convert mutational spectra to arrays for NNLS
    const nnlsInputMatrix = Object.values(mutationalSpectra).map(spectrumData =>
      Object.values(spectrumData)
    );

    const results = {};

    for (let i = 0; i < sampleNames.length; i++) {
      const sampleName = sampleNames[i];
      const nnlsInput = nnlsInputMatrix[i];

      // 1. Perform NNLS
      const nnlsOutput = await nnls(nnlsInputSignatures, nnlsInput);
      const exposureValues = nnlsOutput.x;
      delete nnlsOutput.x;

      // 2. Build an object of signature exposures (raw from NNLS)
      let sampleExposures = {};
      for (let j = 0; j < signatureNames.length; j++) {
        sampleExposures[signatureNames[j]] = exposureValues[j];
      }

      // 3. Calculate the total exposure
      const totalExposure = Object.values(sampleExposures).reduce((acc, val) => acc + val, 0);

      // 4. Filter out signatures below the fraction threshold by setting to 0
      if (totalExposure > 0) {
        for (let signature of signatureNames) {
          const fraction = sampleExposures[signature] / totalExposure;
          if (fraction < exposureThreshold) {
            sampleExposures[signature] = 0;
          }
        }
      }

      // 5. If renormalize is true, adjust exposures to sum to 1
      if (renormalize) {
        const filteredTotal = Object.values(sampleExposures).reduce((a, b) => a + b, 0);
        if (filteredTotal > 0) {
          for (let signature of signatureNames) {
            sampleExposures[signature] = sampleExposures[signature] / filteredTotal;
          }
        }
      }

      // 6. If returning relative exposures, ensure they sum to 1
      if (exposureType === "relative" && !renormalize) {
        const filteredTotal = Object.values(sampleExposures).reduce((a, b) => a + b, 0);
        if (filteredTotal > 0) {
          for (let signature of signatureNames) {
            sampleExposures[signature] = sampleExposures[signature] / filteredTotal;
          }
        }
      }

      // 7. Store the final exposures for each sample
      results[sampleName] = sampleExposures;
    }

    return results;
  }


  /**
   * @memberof mSigPortalPlots
   * @function plotPatientMutationalSignaturesExposure
   * @description Generates a pie chart visualizing the exposure of a single sample to a set of mutational signatures. The function takes exposure data, which includes the relative contribution of each signature to the sample's mutational profile, and displays it in a pie chart format.
   *
   * @param {object} exposureData - An object containing the exposure data for a set of samples. The structure of `exposureData` is expected to be:
   *   `{ sampleId1: { signatureName1: exposureValue1, signatureName2: exposureValue2, ... }, sampleId2: { signatureName1: exposureValue3, signatureName2: exposureValue4, ... }, ... }`
   *   The outer keys (e.g., `sampleId1`, `sampleId2`) are sample identifiers (strings). The inner objects (e.g., `{ signatureName1: exposureValue1, ... }`) represent the exposure values for a given sample. `signatureName` keys are strings representing the names of mutational signatures (e.g., "SBS1", "SBS5"), and `exposureValue` are non-negative numbers representing the contribution of that signature to the sample. These values typically sum to 1 for each sample. The `exposureData` object can contain multiple samples, but only the data for the specified `sample` will be used for plotting. `exposureData` must also have a `rnorm` property which is a number.
   * @param {string} divID - The ID of the HTML div element where the pie chart will be rendered.
   * @param {string} sample - The ID of the sample for which to plot the mutational signature exposure. This should be one of the keys in the `exposureData` object (e.g., "sampleId1", "sampleId2").
   * @return {object} - Returns the data object used by Plotly to generate the pie chart. This object contains the labels (signature names), values (exposure values), and other settings for the pie chart. The format is:
   *   `{ labels: [signatureName1, signatureName2, ...], values: [exposureValue1, exposureValue2, ...], name: "sample exposure values", textposition: "inside", hole: 0.4, hoverinfo: "name + value", type: "pie" }`
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

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, [data], layout);

    return data;
  }

  /**
   * @memberof mSigPortalPlots
   * @function plotDatasetMutationalSignaturesExposure
   * @description Generates a heatmap visualizing the exposure of multiple samples to a set of mutational signatures within a dataset. The function provides options for displaying relative or absolute exposure values and for performing double hierarchical clustering to reorder the rows and columns of the heatmap. It also allows customization of the color scale used to represent exposure values.
   *
   * @param {object} exposureData - An object containing the exposure data for a set of samples. The structure of `exposureData` is expected to be:
   *   `{ sampleId1: { signatureName1: exposureValue1, signatureName2: exposureValue2, ..., rnorm: number }, sampleId2: { signatureName1: exposureValue3, signatureName2: exposureValue4, ..., rnorm: number }, ... }`
   *   The outer keys (e.g., `sampleId1`, `sampleId2`) are sample identifiers (strings). The inner objects (e.g., `{ signatureName1: exposureValue1, ... }`) represent the exposure values for a given sample. `signatureName` keys are strings representing the names of mutational signatures (e.g., "SBS1", "SBS5"), and `exposureValue` are non-negative numbers representing the contribution of that signature to the sample. `rnorm` is a number that will be removed from the data before plotting.
   * @param {string} divID - The ID of the HTML div element where the heatmap will be rendered.
   * @param {boolean} [relative=true] - A boolean indicating whether to display relative or absolute exposure values.
   *   - `true`: The exposure values for each sample are normalized to sum to 1, representing the relative contribution of each signature.
   *   - `false`: The raw exposure values are displayed.
   * @param {string} [datasetName="PCAWG"] - The name of the dataset being visualized. This is used as part of the plot title. Examples include:
   *   - `"PCAWG"`
   *   - `"TCGA"`
   *   - Any other string that appropriately identifies the dataset.
   * @param {boolean} [doubleCluster=true] - A boolean indicating whether to perform double hierarchical clustering on the exposure data.
   *   - `true`: The rows and columns of the heatmap are reordered based on the results of double clustering, which groups similar samples and signatures together.
   *   - `false`: The rows and columns are displayed in the order they appear in the input `exposureData`.
   * @param {string | Array} [colorscale="Custom"] - The color scale to use for the heatmap. Possible values are:
   *   - `"Custom"`: A predefined custom color scale designed for visualizing exposure data.
   *   - Any valid Plotly color scale name (e.g., `"Viridis"`, `"Blues"`, `"Hot"`, etc.).
   *   - An array of arrays defining a custom color scale, where each inner array specifies a color stop with a value between 0 and 1 and a corresponding RGB color string (e.g., `[["0.0", "rgb(49,54,149)"], ["1.0", "rgb(165,0,38)"]]`).
   * @return {object} - Returns the data object used by Plotly to generate the heatmap. This object contains the z values (exposure values), x values (signature names), y values (sample names), and other settings for the heatmap, including the color scale. The structure is:
   *   `{ z: [[exposureValue1, exposureValue2, ...], [exposureValue3, exposureValue4, ...], ...], x: [signatureName1, signatureName2, ...], y: [sampleId1, sampleId2, ...], type: "heatmap", colorscale: colorscale }`
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

    plotGraphWithPlotlyAndMakeDataDownloadable(divID, [data], layout);

    return data;
  }

  /**
   * @memberof mSigPortalPlots
   * @function plotSignatureAssociations
   * @description This function generates and plots a scatter plot with marginal histograms, along with statistical analysis, to visualize the association between two mutational signatures. It calculates and displays the linear regression line, Pearson correlation, and Spearman correlation, providing insights into the relationship between the exposures of two signatures in a set of samples.
   *
   * @param {string} divID - The ID of the HTML div element where the plot will be rendered.
   * @param {object} data - An array of objects representing the exposure data for a set of samples. Each object in the array should have the following properties:
   *   - `sample`: A string representing the sample ID.
   *   - `signatureName`: A string representing the name of the mutational signature.
   *   - `exposure`: A numeric value representing the exposure of the signature in the sample.
   * @param {string} signature1 - The name of the first mutational signature. This should match the `signatureName` values in the `data` array. The values can be any valid signature name present in the dataset, for example, "SBS1", "SBS5", "DBS1", "ID4".
   * @param {string} signature2 - The name of the second mutational signature. This should also match the `signatureName` values in the `data` array. Similar to `signature1`, the values can be any signature name present in the dataset and can also be the same as `signature1` to assess the distribution of a single signature.
   * @return {void} - This function does not return a value. It directly renders the plot in the specified `divID`.
   */
  /**
   * @memberof mSigPortalPlots
   * @function MsAssociation
   * @description Calculates the association between two mutational signatures across a set of samples. It computes the linear regression, Pearson correlation, and Spearman correlation between the log-transformed exposures of the two signatures. The results are used to generate a scatter plot with marginal histograms, visualizing the relationship between the signatures.
   *
   * @param {object[]} data - An array of objects representing the exposure data for a set of samples. Each object in the array should have the following properties:
   *   - `sample`: A string representing the sample ID.
   *   - `signatureName`: A string representing the name of the mutational signature.
   *   - `exposure`: A numeric value representing the exposure of the signature in the sample. This value can theoretically range from 0 to infinity, although in practice, values are often normalized.
   * @param {string} signatureName1 - The name of the first mutational signature. This should match the `signatureName` values in the `data` array.
   * @param {string} signatureName2 - The name of the second mutational signature. This should also match the `signatureName` values in the `data` array. It can be the same as `signatureName1`.
   * @param {boolean} [both=false] - A boolean flag indicating whether to filter the data to include only samples where both signatures have non-zero exposure.
   *   - `true`: Only samples with non-zero exposure to both signatures are included in the analysis. If `signatureName1` and `signatureName2` are the same, then no filtering occurs.
   *   - `false`: All samples are included in the analysis, regardless of whether they have non-zero exposure to both signatures.
   * @return {object} - Returns an object containing the traces and layout for a Plotly plot.
   *   - `traces`: An array of trace objects to be used in a Plotly plot. This includes the main scatter plot trace, the linear regression line trace, and two marginal histogram traces.
   *   - `layout`: An object containing the layout configuration for a Plotly plot, including title, axis labels, annotations, and other visual properties.
   */

  function plotSignatureAssociations(divID, data, signature1, signature2) {
    let dat = plotSignatureAssociation(data, signature1, signature2);
    plotGraphWithPlotlyAndMakeDataDownloadable(divID, dat.traces, dat.layout);
  }

  /**
 * @memberof mSigPortalPlots
 * @function plotMSPrevalenceData
 * @description This function is a wrapper around the `plotMSPrevalence` function. It takes the output of `plotMSPrevalence` and uses it to generate a Plotly plot, which is then displayed in a specified div. The plot visualizes the prevalence of mutational signatures.
 *
 * @param {string} divID - The ID of the div element where the plot will be rendered.
 * @param {object} data - An object representing the mutational signature prevalence data. The `data` object is expected to be an array of objects with the following structure:
 *   `[{ signatureName: "SBS1", sample: "sample1", exposure: 10, burden: 5 }, { signatureName: "SBS5", sample: "sample1", exposure: 20, burden: 5 }, ... ]`
 *   Where `signatureName` is the name of a mutational signature (string), `sample` is a sample identifier (string), `exposure` is a non-negative number representing the exposure of that signature in the sample, and `burden` is a numeric value representing the mutational burden for the sample.
 * @return {void} - This function does not return a value. It directly renders the plot in the specified `divID`.
 */
  /**
   * @memberof mSigPortalPlots
   * @function MSPrevalence
   * @description Calculates and visualizes the prevalence of mutational signatures across a set of samples, grouped by cancer type. The function generates two plots: a pie chart showing the overall prevalence of each signature based on total mutations (exposure) and a bar chart displaying the frequency of each signature across samples, considering a minimum exposure threshold.
   *
   * @param {object} data - An object representing the mutational signature prevalence data. The `data` object is expected to be an array of objects with the following structure:
   *   `[{ signatureName: "SBS1", sample: "sample1", exposure: 10, burden: 5 }, { signatureName: "SBS5", sample: "sample1", exposure: 20, burden: 5 }, ... ]`
   *   Where `signatureName` is the name of a mutational signature (string), `sample` is a sample identifier (string), `exposure` is a non-negative number representing the exposure of that signature in the sample (can be 0), and `burden` is a numeric value representing the mutational burden for the sample (must be a number).
   * @param {number|null|undefined} minimum - The minimum exposure value for a signature in a sample to be considered prevalent in that sample. Samples with exposure below this threshold are not counted in the frequency calculation for the bar chart. If `minimum` is `null` or `undefined`, it defaults to 100.
   *   - `null` or `undefined`: Sets the minimum exposure to 100.
   *   - Any positive number: Sets the minimum exposure to that number.
   * @return {{traces: object[], layout: object}} - Returns an object containing the `traces` and `layout` for a Plotly plot.
   *   - `traces`: An array of trace objects. If the maximum frequency of signatures (considering the `minimum` threshold) is less than 1%, the array contains only a single pie chart trace. Otherwise, it contains a pie chart trace followed by multiple bar chart traces (one for each signature).
   *   - `layout`: An object defining the layout of the plot, including title annotations, axis settings, and overall appearance. It includes conditional logic to handle cases where no signature has a frequency greater than 1%.
   */

  function plotMSPrevalenceData(divID, data) {
    let dat = plotMSPrevalence(data);
    plotGraphWithPlotlyAndMakeDataDownloadable(divID, dat.traces, dat.layout);
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
    plotMSPrevalenceData,
  };

  const mSigPortal = {
    mSigPortalData,
    mSigPortalPlots,
  };

  const userData = {
    convertMatrix,
    convertWGStoPanel,
    plotPatientMutationalSpectrumuserData,
    convertMutationalSpectraIntoJSON,
  };

  const TCGA = {
    getProjectsByGene,
    getTpmCountsByGenesOnProjects,
    getTpmCountsByGenesFromFiles,
    getMafInformationFromProjects,
    getVariantInformationFromMafFiles,
    convertTCGAProjectIntoJSON,
  };
  const tools = {
    groupBy,
  };

  const signatureFitting = {
    fitMutationalSpectraToSignatures,
    plotPatientMutationalSignaturesExposure,
    plotDatasetMutationalSignaturesExposure,
  };

  const machineLearning = {
    preprocessData,
    kFoldCV,
  };

  //#endregion

  // Public members
  return {
    mSigPortal,
    userData,
    tools,
    machineLearning,
    signatureFitting,
    TCGA,
  };
})();

export { mSigSDK };
