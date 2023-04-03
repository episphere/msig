$(document).ready(function () {
  populateAPIDropdown();
});

const nav = document.getElementById("my-nav");
const toggleButton = document.getElementById("toggle-nav");
const container = document.querySelector(".container");

toggleButton.addEventListener("click", () => {
  nav.classList.toggle("show");
  container.classList.toggle("shift");
});


// API Arguments
$("#endpoint-select")
  .change(function () {
    const endpoint = this.value;
    let paramsSection = $("#params-section");
    paramsSection.innerHTML = ""; // clear the previous parameters
    console.log(endpoint);
    switch (endpoint) {
      case "getMutationalSignaturesOptions":
        paramsSection.load("./APIArgumentTemplates/basicTemplateOptions.html");
        break;
      case "getMutationalSignaturesData":
        paramsSection.load("./APIArgumentTemplates/basicTemplateData.html");
        break;
      case "getMutationalSignaturesSummary":
        paramsSection.load("./APIArgumentTemplates/basicTemplateSummary.html");
        break;
    }
  });

// NOT FINISHED
$(function () {
  $("#includedContent").load("b.html");
});

// Handle form submit
$("#api-form-signatures").submit(async function (e) {
  e.preventDefault();

  // mSigSDK = await(await import('./main.js')).mSigSDK

  let endpoint = $("#endpoint-select").val();

  let numberOfResults = $("#number-of-results-input").val();
  let genomeType = $("#genome-type-value-select").val();
  let mutationType = $("#mutation-type-value-select").val();

  if (!endpoint) {
    // Show error message
    alert("No API Selected!");
    return;
  }

  switch (endpoint) {
    case "getMutationalSignaturesOptions":
      let mutationalSignatureOptions = await mSigSDK.mSigPortal.mSigPortalData
        .getMutationalSignaturesOptions(
          genomeType,
          mutationType,
          numberOfResults
        )
        .then((results) => {
          generateTableWithJSON(results);
          addDownloadButton(endpoint, results);
        });

      break;
    case "getMutationalSignaturesData":
      let referenceSignatureType = $(
        "#reference-signatures-value-select"
      ).val();

      let mutationalSignatureData = await mSigSDK.mSigPortal.mSigPortalData
        .getMutationalSignaturesData(
          genomeType,
          referenceSignatureType,
          mutationType,
          numberOfResults
        )
        .then((results) => {
          generateTableWithJSON(results);
          addDownloadButton(endpoint, results);
        });

      break;
    case "getMutationalSignaturesSummary":
      let signatureSetName = $("#signature-set-name-value-select").val();

      let mutationalSignatureSummary = await mSigSDK.mSigPortal.mSigPortalData
        .getMutationalSignaturesSummary(numberOfResults, signatureSetName)
        .then((results) => {
          generateTableWithJSON(results);
          addDownloadButton(endpoint, results);
        });
      break;
  }

  function addDownloadButton(endPoint, downloadData) {
    document
      .getElementById("download-btn")
      .addEventListener("click", function () {
        // Convert the JSON data to a string
        var jsonString = JSON.stringify(downloadData);

        // Create a Blob from the JSON string
        var blob = new Blob([jsonString], { type: "application/json" });

        // Create a URL for the Blob
        var url = URL.createObjectURL(blob);

        // Create a link element and set its href to the URL of the Blob
        var link = document.createElement("a");
        link.href = url;
        link.download = endPoint + "_data.json";

        // Append the link element to the body and click it
        document.body.appendChild(link);
        link.click();

        // Remove the link element
        document.body.removeChild(link);
      });
  }
});

async function generateTableWithJSON(jsonData, endPoint) {
  $("#tableHead").empty();
  var tableHead = document.getElementById("tableHead");

  for (var key in jsonData) {
    let tableHeadRow = tableHead.insertRow();

    for (var column in jsonData[key]) {
      var cell1 = tableHeadRow.insertCell(0);
      cell1.innerHTML = column;
    }
    break;
  }

  $("#tableBody").empty();
  var tableBody = document.getElementById("tableBody");
  for (var key in jsonData) {
    var row = tableBody.insertRow();

    for (var column in jsonData[key]) {
      var cell = row.insertCell(0);
      cell.innerHTML = jsonData[key][column];
    }
  }

  $("#responseTable").tablesorter({ theme: "bootstrap" }).trigger("resetSort");

  console.log("Table sorted");
}

function populateAPIDropdown() {
  APIOptions = [
    "getMutationalSignaturesOptions",
    "getMutationalSignaturesData",
    "getMutationalSignaturesSummary",
  ];
  var select = document.getElementById("endpoint-select");
  for (var i = 0; i < APIOptions.length; i++) {
    var option = document.createElement("option");
    option.value = APIOptions[i];
    option.text = APIOptions[i];
    select.appendChild(option);
  }
}

const TotalAPIOptions = [
  "getMutationalSignaturesOptions",
  "getMutationalSignaturesData",
  "getMutationalSignaturesSummary",
  "getMutationalSpectrumOptions",
  "getMutationalSpectrumData",
  "getMutationalSpectrumSummary",
  "getMutationalSignatureAssociationOptions",
  "getMutationalSignatureAssociationData",
  "getMutationalSignatureActivityOptions",
  "getMutationalSignatureActivityData",
  "getMutationalSignatureLandscapeData",
  "getMutationalSignatureEtiologyOptions",
  "getMutationalSignatureEtiologyData",
];
