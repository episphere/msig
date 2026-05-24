# WebR Package Repository

This directory contains the browser-loadable WebR CRAN-like binary repository
used by the exact R package adapters.

Required packages for the current manuscript plan:

- `deconstructSigs` `1.8.0`
- `sigminer` `2.3.1`
- solver dependencies including `nnls`, `quadprog`, and `GenSA`

`manifest.json` records the pinned artifacts and SHA-256 hashes. The repository
index is `bin/emscripten/contrib/4.6/PACKAGES`.
