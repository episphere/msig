# mSigSDK Observable Kit Notebooks

Focused Observable Kit notebooks for testing mSigSDK workflows without loading every example into one runtime.

## Notebook Index

- `msig-sdk-notebooks.onb.html`: index of focused notebooks.
- `msig-sdk-qc-walkthrough.onb.html`: known-signature fitting QC.
- `msig-sdk-uncertainty-thresholds.onb.html`: bootstrap intervals and threshold sensitivity.
- `msig-sdk-nmf-extraction.onb.html`: browser-sized NMF extraction and rank diagnostics.
- `msig-sdk-export-report.onb.html`: import/export, reports, provenance, and workflow helpers.

## Local Use

Start the local SDK server:

```bash
npm run serve:observable
```

Then open:

```text
http://127.0.0.1:8080/notebooks/msig-sdk-notebooks.onb.html
```

The notebooks import the SDK from the local server at `http://127.0.0.1:8080/main.js`, so moving them into this folder does not require changing their SDK import URLs.

