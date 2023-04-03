document
  .getElementById("console-input")
  .addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      let code = event.target.value;
      let consoleOutput = document.getElementById("console-output");
      let plotResults = document.getElementById("plotDemonstration");

      if (code.trim() === "clear()") {
        consoleOutput.innerHTML = "";
        plotResults.innerHTML = "";
        event.target.value = "";
      } else {
        try {
          let result = eval(code);
          consoleOutput.innerHTML += "> " + code + "\n";
          consoleOutput.innerHTML += "< " + result + "\n";
        } catch (error) {
          consoleOutput.innerHTML += "> " + code + "\n";
          consoleOutput.innerHTML += "< Error: " + error.message + "\n";
        }
      }
      event.target.value = "";
    }
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  });

async function evaluateSampleCode() {

    let plotResults = document.getElementById("plotDemonstration");
    if (plotResults.innerHTML != ""){
        return;
    };

    let mSigSDK = await (await import("https://episphere.github.io/msig/bundle.js")).mSigSDK;
    let mutationalSpectrumData = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData(
        "PCAWG",
        ["SP99181", "SP98955"],
        "WGS",
        "Liver-HCC",
        "ID",
        83,
    );
    function addDivToDOM(id) {
        const newDiv = document.createElement('div');
        newDiv.setAttribute('id', id);
        document.querySelector("#plotDemonstration").appendChild(newDiv);
      }
    addDivToDOM("mutationalSpectrumMatrix");
    
    mSigSDK.mSigPortal.mSigPortalPlots.plotPatientMutationalSpectrum(mutationalSpectrumData, "mutationalSpectrumMatrix");
}
function clearVisualization(){
    let plotResults = document.getElementById("plotDemonstration");
    plotResults.innerHTML = "";
}