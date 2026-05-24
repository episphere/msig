# WebR Package Repository

This directory contains the browser-loadable WebR CRAN-like binary repository
used by the exact R package adapters.

Required packages for the current manuscript plan:

- `deconstructSigs` `1.8.0`
- `sigminer` `2.3.1`
- local Bioconductor/NMF support packages not available from `repo.r-wasm.org`
- solver dependencies including `nnls`, `quadprog`, and `GenSA`

`manifest.json` records the pinned artifacts and SHA-256 hashes. The repository
indexes are `bin/emscripten/contrib/4.6/PACKAGES`, `PACKAGES.gz`, and
`PACKAGES.rds`. This repository is a small overlay used before
`repo.r-wasm.org`; the complete local WebR cache is intentionally ignored
because it includes package files too large for ordinary GitHub hosting.
