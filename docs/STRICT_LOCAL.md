# Strict-local no-egress workflow

Use `strictLocal` when sample IDs, MAF rows, spectra, exposures, filenames, or file IDs must not be sent to network services.

```js
import { mSigSDK } from "./main.js";

mSigSDK.runtime.configure({
  strictLocal: true,
  debug: false,
});

const conversion = await mSigSDK.userData.convertMafToProfileSpectra(mafRows, {
  profiles: ["SBS96"],
  groupBy: "sample_id",
  genome: "hg19",
  strictLocal: true,
});

const spectra = conversion.spectraByProfile.SBS96;
const exposures = await mSigSDK.qc.fitSpectraWithNNLS(signatures, spectra, {
  contexts: mSigSDK.validation.getExpectedContexts({ profile: "SBS", matrix: 96 }),
});
const burden = mSigSDK.qc.summarizeMutationBurden(spectra);
const reconstruction = mSigSDK.qc.calculateReconstructionError(
  signatures,
  spectra,
  exposures
);

const report = mSigSDK.reports.createAnalysisReport({
  title: "Strict-local signature report",
  parameters: { strictLocal: true, genome: "hg19" },
  qc: { burden, reconstruction },
  exposures,
});
```

In strict mode, MAF conversion uses row-supplied context fields or bundled/offline context tables. If a coordinate would require the online UCSC sequence API, the SDK throws with instructions to add `trinucleotide_context` / `context_sequence` values or pass `contextLookupTable`.

Do not call TCGA/GDC helpers or mSigPortal sample-specific spectrum fetches in strict mode; those paths are blocked because they put user-supplied gene, project, file, or sample identifiers into requests.
