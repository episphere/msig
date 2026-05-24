# WebR Package Builds

This folder contains metadata for R packages that mSigSDK executes through
WebR. External-tool adapters must use WebR package artifacts, or caller-supplied
equivalent repositories, rather than JavaScript substitutes or browser-native
stand-ins.

## Pinned Packages

| Tool | Package | Version | Runtime artifact |
| --- | --- | --- | --- |
| deconstructSigs | `deconstructSigs` | `1.8.0` | WebR binary package repository |
| sigminer | `sigminer` | `2.3.1` | WebR binary package repository |
| sigminer solver | `nnls` | repository-pinned | WebR binary package repository |
| sigminer solver | `quadprog` | repository-pinned | WebR binary package repository |
| sigminer solver | `GenSA` | repository-pinned | WebR binary package repository |

## Build Outline

1. Use `rwasm` or the WebR package build Docker image to build the pinned R
   packages and dependencies.
2. Publish the resulting CRAN-like repository under `docs/package-repos/webr/`.
3. Confirm that `bin/emscripten/contrib/4.6/PACKAGES` lists the pinned package
   versions.
4. Run `npm run test:exact-adapters` and the adapter-fidelity experiment.
