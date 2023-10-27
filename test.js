mSigSDK = await (await import("./main.js")).mSigSDK;
projects = ['TCGA-KIRC']
MAFDescriptions = await mSigSDK.TCGA.getMafInformationFromProjects(projects)

MAFFiles = await mSigSDK.TCGA.getVariantInformationFromMafFiles(MAFDescriptions)

WGS_data = await mSigSDK.ICGC.obtainICGCDataMAF(["COAD-US"],"ssm", "WGS", "TSV")


data = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSignatureActivityData('PCAWG','WGS','COSMIC_v3_Signatures_GRCh37_SBS96','',100000000)
mSigSDK.mSigPortal.mSigPortalPlots.plotSignatureAssociations("associations", data, 'SBS3', 'SBS6')



mSigSDK = await (await import("./main.js")).mSigSDK;
// let res = { 'TCGA-LUSC': { 'maf_files': ['9fed5902-6e95-4526-a119-ec4eade5576b'] } }
// var res = await mSigSDK.TCGA.getMafInformationFromProjects(['TCGA-LUSC'])
let res = { 'TCGA-LUSC': { 'maf\_files': ['ddeed873-5f8e-45cf-b89d-d94c44dfcd87'] } }
var result = await mSigSDK.TCGA.getVariantInformationFromMafFiles(res)



mSigSDK = await (await import("./main.js")).mSigSDK;
data = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSignatureActivityData('PCAWG','WGS','COSMIC_v3_Signatures_GRCh37_SBS96','',100000000)
mutSpecData = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData('PCAWG',null, 'WGS','','SBS', 96)
processedData = mSigSDK.machineLearning.preprocessData(mutSpecData, data, "mSigPortal")
results = mSigSDK.machineLearning.kFoldStratifiedCV(processedData.Xs,processedData.Ys)


await fetch("https://api.gdc.cancer.gov/data/0b3d2db3-8ae3-4d39-bd9b-9d1e7a133b65")


// Testing UMAP
mSigSDK = await (await import("./main.js")).mSigSDK;
cancerType = "Lung-AdenoCA"
extractedData = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData(
    "PCAWG",
    null,
    "WGS",
    cancerType,
    "SBS",
    96,
);

embeddings = mSigSDK.mSigPortal.mSigPortalPlots.plotUMAPVisualization(extractedData, "PCAWG", "umapVisualization", 3, 0.1, 15)