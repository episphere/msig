import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const sourceDir = path.join(root, "docs", "manuscript", "experiments", "e7_four_tool_comparison", "data", "published_source");
const unpacked = path.join(sourceDir, "unzipped", "SBS");
const outputDir = path.join(root, "docs", "manuscript", "experiments", "e7_four_tool_comparison", "data");
const noisePercent = String(process.argv[2] || "0");
if (!["0", "5", "10"].includes(noisePercent)) throw new Error("Noise level must be 0, 5, or 10.");
const samplesFile = noisePercent === "0" ? "Samples.txt" : `Samples_noise${noisePercent}.txt`;
const samplesPath = path.join(unpacked, samplesFile);
const catalogPath = path.join(unpacked, "COSMIC_v3.3_SBS_GRCh37.txt");
const truthPath = path.join(unpacked, "ground.truth.syn.exposures.csv");

const [sampleText, catalogText, truthText] = await Promise.all([
  readFile(samplesPath, "utf8"),
  readFile(catalogPath, "utf8"),
  readFile(truthPath, "utf8"),
]);
const sampleRows = sampleText.trim().split(/\r?\n/).map((line) => line.split("\t"));
const catalogRows = catalogText.trim().split(/\r?\n/).map((line) => line.split("\t"));
const truthRows = truthText.trim().split(/\r?\n/).map((line) => line.split(",").map(unquote));
const sampleNames = sampleRows[0].slice(1);
const contexts = sampleRows.slice(1).map((row) => row[0]);
const signatureNames = catalogRows[0].slice(1);
if (sampleNames.length !== 2700 || contexts.length !== 96 || signatureNames.length !== 78) {
  throw new Error(`Unexpected published SBS shape: samples=${sampleNames.length}, contexts=${contexts.length}, signatures=${signatureNames.length}`);
}

const signatures = Object.fromEntries(signatureNames.map((signature, column) => [signature, Object.fromEntries(catalogRows.slice(1).map((row) => [row[0], Number(row[column + 1])]))]));
const spectra = Object.fromEntries(sampleNames.map((sample, column) => [sample, Object.fromEntries(sampleRows.slice(1).map((row) => [row[0], Number(row[column + 1])]))]));
const truthSampleNames = truthRows[0].slice(1);
if (truthSampleNames.length !== sampleNames.length || truthSampleNames.some((name, index) => name !== sampleNames[index])) throw new Error("Published truth/sample ordering does not match.");
const trueActivities = Object.fromEntries(sampleNames.map((sample) => [sample, {}]));
for (const row of truthRows.slice(1)) {
  const signature = row[0];
  if (!signatureNames.includes(signature)) throw new Error(`Truth contains unknown signature ${signature}`);
  for (let index = 0; index < sampleNames.length; index += 1) trueActivities[sampleNames[index]][signature] = Number(row[index + 1]);
}
const trueExposures = Object.fromEntries(sampleNames.map((sample) => {
  const values = trueActivities[sample];
  const total = Object.values(values).reduce((a, b) => a + b, 0);
  return [sample, Object.fromEntries(signatureNames.map((signature) => [signature, total ? values[signature] / total : 0]))];
}));

const input = { schemaVersion: "msig.manuscript.experiment.v1", publishedSynthetic: true, source: { generatorPaper: "Islam et al. 2022, Cell Genomics, DOI 10.1016/j.xgen.2022.100179", benchmarkPaper: "Díaz-Gay et al. 2023, Bioinformatics, DOI 10.1093/bioinformatics/btad756", archive: "Figshare DOI 10.6084/m9.figshare.24457114.v1", license: "CC BY 4.0", noisePercent: Number(noisePercent), sourceSamplesFile: samplesFile, datasetDescription: "SBS component of the published 2,700-sample benchmark: 300 simulated genomes for each of nine cancer types, generated from 21 COSMIC reference signatures. The archived COSMIC v3.3 GRCh37 matrix contains 78 signature columns; this archived shape is used without adding or imputing columns." }, contexts, sampleNames, signatureNames, spectra, signatures };
const truth = { schemaVersion: "msig.manuscript.experiment.v1", publishedSynthetic: true, source: input.source, sampleNames, signatureNames, trueActivities, trueExposures };
const provenance = { ...input.source, archiveFile: "published_source/Supplementary_data_Diaz-Gay_et_al_2023_Benchmark.zip", archiveSha256: await sha256(path.join(sourceDir, "Supplementary_data_Diaz-Gay_et_al_2023_Benchmark.zip")), sourceFileSha256: { samples: await sha256(samplesPath), catalog: await sha256(catalogPath), truth: await sha256(truthPath) }, shape: { samples: sampleNames.length, contexts: contexts.length, signatures: signatureNames.length }, generatedAt: new Date().toISOString() };
await mkdir(outputDir, { recursive: true });
const suffix = noisePercent === "0" ? "" : `-noise${noisePercent}`;
await writeFile(path.join(outputDir, `published-sbs-input${suffix}.json`), JSON.stringify(input) + "\n");
await writeFile(path.join(outputDir, `published-sbs-truth${suffix}.json`), JSON.stringify(truth) + "\n");
await writeFile(path.join(outputDir, `published-synthetic-provenance${suffix}.json`), JSON.stringify(provenance, null, 2) + "\n");
console.log(JSON.stringify({ status: "completed", noisePercent: Number(noisePercent), samples: sampleNames.length, contexts: contexts.length, signatures: signatureNames.length, archiveSha256: provenance.archiveSha256 }, null, 2));

function unquote(value) { return String(value).replace(/^"|"$/g, ""); }
async function sha256(file) { const hash = createHash("sha256"); hash.update(await readFile(file)); return hash.digest("hex"); }
