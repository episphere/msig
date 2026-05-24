# Pyodide Package Builds

This folder contains build metadata for Python packages that mSigSDK executes
through Pyodide. External-tool adapters must use these package artifacts, or a
caller-supplied equivalent artifact, rather than JavaScript substitutes.

## Pinned Packages

| Tool | Package | Version | Runtime artifact |
| --- | --- | --- | --- |
| SigProfilerAssignment | `SigProfilerAssignment` | `1.1.3` | Pyodide-compatible wheel |
| MuSiCal | `musical` from `parklab/MuSiCal` | `v1.0.0` | Pyodide-compatible wheel |

## Build Outline

1. Build or fetch a Pyodide-compatible wheel for each package and dependency.
2. Copy wheels into `docs/package-repos/pyodide/`.
3. Update `docs/package-repos/pyodide/manifest.json` with filenames, versions,
   SHA256 hashes, and build date.
4. Run `npm run test:exact-adapters` and the adapter-fidelity experiment.

Pure Python wheels can be used directly by Pyodide. Packages with compiled
extensions must be built with `pyodide build` against the target Pyodide
version.
