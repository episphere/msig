mSigSDK = await (await import("./main.js")).mSigSDK;
data = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSignatureActivityData('PCAWG','WGS','COSMIC_v3_Signatures_GRCh37_SBS96','',100000000)
mSigSDK.mSigPortal.mSigPortalPlots.plotSignatureAssociations("associations", data, 'SBS3', 'SBS6')


let res = { 'TCGA-LUSC': { 'maf_files': ['0b3d2db3-8ae3-4d39-bd9b-9d1e7a133b65', '9fed5902-6e95-4526-a119-ec4eade5576b' ] } }
var result = await mSigSDK.TCGA.getVariantInformationFromMafFiles(res)


mSigSDK = await (await import("./main.js")).mSigSDK;
data = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSignatureActivityData('PCAWG','WGS','COSMIC_v3_Signatures_GRCh37_SBS96','',100000000)
mutSpecData = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData('PCAWG',null, 'WGS','','SBS', 96)
processedData = mSigSDK.machineLearning.preprocessData(mutSpecData, data, "mSigPortal")
results = mSigSDK.machineLearning.kFoldStratifiedCV(processedData.Xs,processedData.Ys)