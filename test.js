mSigSDK = await (await import("./main.js")).mSigSDK;
data = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSignatureActivityData('PCAWG','WGS','COSMIC_v3_Signatures_GRCh37_SBS96','',100000000)
mSigSDK.mSigPortal.mSigPortalPlots.plotSignatureAssociations("associations", data, 'SBS3', 'SBS6')


let tcga = await import('./mSigSDKScripts/tcga.js')
let res = { 'TCGA-LUSC': { 'maf_files': ['0b3d2db3-8ae3-4d39-bd9b-9d1e7a133b65', '9fed5902-6e95-4526-a119-ec4eade5576b' ] } }
var result = await tcga.getVariantInformationFromMafFiles(res)