import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const dataDir = path.join(root, "docs", "manuscript", "experiments", "e7_four_tool_comparison", "data");
const subsetSize = Number(process.argv[3] || "30");
if (!Number.isInteger(subsetSize) || subsetSize < 1 || subsetSize > 300) {
  throw new Error(`Subset size must be an integer from 1 through 300; received ${subsetSize}`);
}
const noise = String(process.argv[2] || "0");
const suffix = noise === "0" ? "" : `-noise${noise}`;
const outputSuffix = subsetSize === 30 ? `${suffix}-subset` : `${suffix}-subset${subsetSize}`;
const input = JSON.parse(await readFile(path.join(dataDir, `published-sbs-input${suffix}.json`), "utf8"));
const truth = JSON.parse(await readFile(path.join(dataDir, `published-sbs-truth${suffix}.json`), "utf8"));
const groups = new Map();
for (const sample of input.sampleNames) {
  const group = sample.split("::")[0];
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(sample);
}
const selected = [];
for (const [group, samples] of groups) {
  if (samples.length !== 300) throw new Error(`Expected 300 samples for ${group}, found ${samples.length}`);
  const chosen = Array.from({ length: subsetSize }, (_, index) => samples[Math.floor(index * samples.length / subsetSize)]);
  selected.push(...chosen);
}
if (selected.length !== groups.size * subsetSize) throw new Error(`Unexpected subset size ${selected.length}`);
const subset = {
  ...input,
  source: { ...input.source, subset: { method: "30 evenly spaced sample IDs per cancer type", sourceSamples: input.sampleNames.length, selectedSamples: selected.length, samplesPerCancerType: subsetSize } },
  sampleNames: selected,
  spectra: Object.fromEntries(selected.map((sample) => [sample, input.spectra[sample]])),
};
const subsetTruth = { ...truth, source: subset.source, sampleNames: selected, trueActivities: Object.fromEntries(selected.map((sample) => [sample, truth.trueActivities[sample]])), trueExposures: Object.fromEntries(selected.map((sample) => [sample, truth.trueExposures[sample]])) };
await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, `published-sbs-input${outputSuffix}.json`), JSON.stringify(subset) + "\n");
await writeFile(path.join(dataDir, `published-sbs-truth${outputSuffix}.json`), JSON.stringify(subsetTruth) + "\n");
console.log(JSON.stringify({ status: "completed", noisePercent: Number(noise), groups: [...groups.keys()], sampleCount: selected.length, samplesPerGroup: subsetSize }, null, 2));
