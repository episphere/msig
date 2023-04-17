mSigSDK = await (await import("./main.js")).mSigSDK;
data = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSignatureActivityData('PCAWG','WGS','COSMIC_v3_Signatures_GRCh37_SBS96','',100000000)
mSigSDK.mSigPortal.mSigPortalPlots.plotSignatureAssociations("associations", data, 'SBS3', 'SBS6')