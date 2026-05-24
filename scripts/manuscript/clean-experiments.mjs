import path from "node:path";
import {
  ensureDir,
  EXPERIMENTS,
  FIGURE_ROOT,
  MANUSCRIPT_ROOT,
  removeSafe,
  TABLE_ROOT,
  writeText,
} from "./lib/experiment-utils.mjs";

const oldTargets = [
  "docs/manuscript/experiments/2026_05_13_deconstructsigs_concordance",
  "docs/manuscript/experiments/2026_05_13_real_world_benchmark",
  "docs/manuscript/experiments/2026_05_13_synthetic_signature_validation",
  "docs/manuscript/experiments/2026_05_14_browser_benchmark",
  "docs/manuscript/experiments/2026_05_14_confusable_signature_benchmark",
  "docs/manuscript/experiments/2026_05_14_panel_downsampling_validation",
  "docs/manuscript/experiments/2026_05_21_adapter_fidelity_validation",
  "docs/manuscript/experiments/2026_05_21_browser_ensemble_assignment",
  "docs/manuscript/experiments/2026_05_21_restricted_assay_case_study",
  "docs/manuscript/experiments/2026_05_21_trust_score_calibration",
  "docs/manuscript/actual-figure-pages",
  "docs/manuscript/data",
  "docs/verification",
  "scripts/verify-tool-interoperability.mjs",
  "scripts/benchmark-manuscript.mjs",
  "scripts/generate-manuscript-v03-assets.mjs",
];

const generatedTargets = [
  "docs/manuscript/google-doc-tables",
  "docs/manuscript/figures/figure-e1-zero-install.html",
  "docs/manuscript/figures/figure-e2-adapter-fidelity.html",
  "docs/manuscript/figures/figure-e3-reference-checks.html",
  "docs/manuscript/figures/figure-e4-browser-runtime.html",
  "docs/manuscript/figures/figure-e6-compatibility.html",
  ...Object.values(EXPERIMENTS).flatMap((experiment) => [
    path.relative(process.cwd(), path.join(experiment.dir, "data")).replaceAll(path.sep, "/"),
    path.relative(process.cwd(), path.join(experiment.dir, "screenshots")).replaceAll(path.sep, "/"),
  ]),
];

await removeSafe([...oldTargets, ...generatedTargets]);

for (const experiment of Object.values(EXPERIMENTS)) {
  await ensureDir(path.join(experiment.dir, "code"));
  await ensureDir(path.join(experiment.dir, "data"));
}
await ensureDir(path.join(EXPERIMENTS.e1.dir, "screenshots"));
await ensureDir(path.join(EXPERIMENTS.e6.dir, "data", "manual"));
await ensureDir(TABLE_ROOT);
await ensureDir(FIGURE_ROOT);

await writeText(
  path.join(MANUSCRIPT_ROOT, "experiments", "README.md"),
  `# Manuscript Experiments\n\nThis directory contains the replacement E1/E2/E3/E4/E6 experiment suite for the mSigSDK manuscript. Run \`npm run experiment:all\` to generate result JSON files, then \`npm run assets:manuscript\` to build D3 figures and copy/paste HTML tables.\n`
);

console.log("Cleaned manuscript experiment outputs and old generated artifacts.");
