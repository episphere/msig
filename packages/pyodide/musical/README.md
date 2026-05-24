# MuSiCal Pyodide Artifact

Target: Park Lab MuSiCal `v1.0.0`.

Expected output:

```text
docs/package-repos/pyodide/musical-1.0.0-py3-none-any.whl
```

Build notes:

- Upstream source: `https://github.com/parklab/MuSiCal`, tag `v1.0.0`.
- MuSiCal depends on the Pyodide scientific stack used by the adapter:
  `numpy`, `scipy`, `pandas`, and `scikit-learn`.
- The wheel must import as `musical` and expose the refit API used by
  `mSigSDKScripts/adapters.js`.

The adapter does not fall back to JavaScript sparse NNLS if this wheel is
missing.
