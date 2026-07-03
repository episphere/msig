# mSigSDK Manuscript Workspace

This directory now contains the replacement reviewer-oriented experiment suite for the software manuscript.

## Current Folders

- `manuscript/`: submission draft text.
- `experiments/`: E1/E2/E3/E4/E6 experiment runners, result JSON, CSV summaries, screenshots, and compatibility harnesses.
- `figures/`: D3-backed HTML figure pages generated from the new result JSON files.
- `tables/`: compact manuscript tables that are not redundant with the figures.
- `assets/`: local vendored assets used by generated figure pages, including `d3.min.js`.

## Rebuild Commands

From the repository root:

```bash
npm run manuscript:clean-experiments
npm run experiment:e1-zero-install
npm run experiment:e2-adapter-fidelity
npm run experiment:e3-reference-checks
npm run experiment:e4-browser-benchmarks
npm run experiment:e6-compatibility
npm run assets:manuscript
```

`npm run experiment:all` runs the five experiment commands in sequence. `npm run assets:manuscript` reads the E1/E2/E3/E4/E6 result JSON files and regenerates the D3 figure pages. The old per-experiment copy/paste tables were retired because they duplicate the manuscript figures and supplement result files.

## Submission Checkpoint

Create a GitHub release or tag for the final manuscript asset snapshot before submission. Use that tag in the manuscript Availability and requirements section. Do not claim a DOI unless a Zenodo or other archival DOI exists.
