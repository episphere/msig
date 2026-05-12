# Manuscript Figure Drafts

Generated SVG drafts for the revised mSigSDK software paper.

## Files

- `figure1-architecture.svg`: SDK architecture, workflow layers, and browser privacy boundary.
- `figure2-qc-dashboard.svg`: known-signature fitting QC and uncertainty dashboard.
- `figure3-nmf-extraction.svg`: exploratory browser-side NMF workflow, rank diagnostics, extracted profiles, matching, and exposures.

## Regenerate

```bash
npm run figures:manuscript
```

The generator is `scripts/generate-manuscript-figures.mjs`.

## Notes For Manuscript Use

- These are editable vector drafts intended for figure planning and manuscript revision.
- Figure 1 is conceptual and can likely be used directly after visual polish and journal sizing.
- Figures 2 and 3 use representative values to show the proposed visual structure. Before final submission, replace those values with the final example analysis, benchmark, or notebook-derived data that the manuscript reports.
- The mutational spectrum panels intentionally mimic the familiar SBS96/COSMIC color grammar rather than inventing a new profile display.
- Keep the figure captions synchronized with `docs/manuscript/REVISION_PACKAGE.md`.

