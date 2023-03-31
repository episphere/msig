mSigSDK = await (await import("../main.js")).mSigSDK;
mutationalSpectrumData = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData(
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
    document.body.appendChild(newDiv);
  }
addDivToDOM("mutationalSpectrumMatrix");

mSigSDK.mSigPortal.mSigPortalPlots.plotPatientMutationalSpectrum(mutationalSpectrumData, "mutationalSpectrumMatrix");