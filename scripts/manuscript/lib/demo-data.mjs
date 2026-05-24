import { getExpectedContexts } from "../../../mSigSDKScripts/validation.js";
import { seededRandom } from "./experiment-utils.mjs";

export const SELECTED_SIGNATURES = Object.freeze([
  "SBS1",
  "SBS2",
  "SBS4",
  "SBS5",
  "SBS13",
  "SBS17a",
  "SBS17b",
  "SBS18",
  "SBS40",
]);

export const PORTAL_URLS = Object.freeze({
  spectra:
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_spectrum?study=PCAWG&cancer=Lung-AdenoCA&strategy=WGS&profile=SBS&matrix=96&offset=0",
  signatures:
    "https://analysistools.cancer.gov/mutational-signatures/api/mutational_signature?source=Reference_signatures&strategy=WGS&profile=SBS&matrix=96&signatureSetName=COSMIC_v3_Signatures_GRCh37_SBS96&limit=10000&offset=0",
});

export function sbs96Contexts() {
  return getExpectedContexts({ profile: "SBS", matrix: 96 });
}

export async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }
  return await response.json();
}

export async function fetchPortalInputs({
  sampleLimit = 38,
  selectedSignatures = null,
} = {}) {
  const [spectrumRows, signatureRows] = await Promise.all([
    fetchJson(PORTAL_URLS.spectra),
    fetchJson(PORTAL_URLS.signatures),
  ]);
  const contexts = sbs96Contexts();
  const spectra = rowsToSpectra(spectrumRows, {
    contexts,
    sampleLimit,
  });
  const signatures = rowsToSignatures(signatureRows, {
    contexts,
    selectedSignatures,
  });
  return {
    urls: PORTAL_URLS,
    contexts,
    spectra,
    signatures,
    sampleNames: Object.keys(spectra),
    signatureNames: Object.keys(signatures),
    rawRowCounts: {
      spectra: spectrumRows.length,
      signatures: signatureRows.length,
    },
  };
}

export function rowsToSpectra(rows, { contexts = sbs96Contexts(), sampleLimit = 38 } = {}) {
  const sampleOrder = [];
  const spectra = {};
  for (const row of rows || []) {
    const sample = String(row.sample || "").trim();
    const context = String(row.mutationType || "").trim();
    if (!sample || !context) continue;
    if (!spectra[sample]) {
      if (sampleOrder.length >= sampleLimit) continue;
      sampleOrder.push(sample);
      spectra[sample] = Object.fromEntries(contexts.map((key) => [key, 0]));
    }
    if (!spectra[sample]) continue;
    spectra[sample][context] = Number(row.mutations) || 0;
  }
  return Object.fromEntries(sampleOrder.map((sample) => [sample, spectra[sample]]));
}

export function rowsToSignatures(
  rows,
  { contexts = sbs96Contexts(), selectedSignatures = null } = {}
) {
  const selectedNames = selectedSignatures
    ? selectedSignatures.map(String)
    : [
        ...new Set(
          (rows || [])
            .map((row) => String(row.signatureName || "").trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const selected = new Set(selectedNames);
  const signatures = Object.fromEntries(
    selectedNames.map((signature) => [
      signature,
      Object.fromEntries(contexts.map((key) => [key, 0])),
    ])
  );
  for (const row of rows || []) {
    const signature = String(row.signatureName || "").trim();
    const context = String(row.mutationType || "").trim();
    if (!selected.has(signature) || !context) continue;
    signatures[signature][context] = Number(row.contribution) || 0;
  }
  return signatures;
}

export function generateSyntheticSignatures({
  signatureCount = 40,
  contextCount = 96,
  seed = 9001,
  prefix = "SBS",
} = {}) {
  const contexts = sbs96Contexts().slice(0, contextCount);
  const random = seededRandom(seed);
  const signatures = {};
  for (let signatureIndex = 0; signatureIndex < signatureCount; signatureIndex += 1) {
    const signatureName = `${prefix}${signatureIndex + 1}`;
    const center = Math.floor(random() * contexts.length);
    const values = contexts.map((_, contextIndex) => {
      const distance = Math.min(
        Math.abs(contextIndex - center),
        contexts.length - Math.abs(contextIndex - center)
      );
      const peak = Math.exp(-(distance * distance) / (2 * (4 + (signatureIndex % 6)) ** 2));
      const shoulder = 0.2 * Math.exp(-(((contextIndex % 16) - (signatureIndex % 16)) ** 2) / 40);
      return 0.001 + peak + shoulder + random() * 0.03;
    });
    const total = values.reduce((sum, value) => sum + value, 0);
    signatures[signatureName] = Object.fromEntries(
      contexts.map((context, index) => [context, values[index] / total])
    );
  }
  return { signatures, contexts };
}

export function generateSyntheticSpectra({
  sampleCount = 120,
  signatures,
  contexts = sbs96Contexts(),
  activePerSample = 4,
  burden = 2500,
  seed = 1234,
  samplePrefix = "Sample",
} = {}) {
  const random = seededRandom(seed);
  const signatureNames = Object.keys(signatures);
  const spectra = {};
  const trueExposures = {};
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const sampleName = `${samplePrefix}${String(sampleIndex + 1).padStart(3, "0")}`;
    const chosen = [];
    while (chosen.length < Math.min(activePerSample, signatureNames.length)) {
      const candidate = signatureNames[Math.floor(random() * signatureNames.length)];
      if (!chosen.includes(candidate)) chosen.push(candidate);
    }
    const weights = chosen.map(() => 0.05 + random());
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const exposures = Object.fromEntries(signatureNames.map((name) => [name, 0]));
    chosen.forEach((signature, index) => {
      exposures[signature] = weights[index] / weightTotal;
    });
    trueExposures[sampleName] = exposures;
    const probabilities = contexts.map((context) =>
      signatureNames.reduce(
        (sum, signature) => sum + exposures[signature] * (signatures[signature]?.[context] || 0),
        0
      )
    );
    const counts = multinomialCounts(probabilities, burden + Math.floor(random() * burden * 0.25), random);
    spectra[sampleName] = Object.fromEntries(
      contexts.map((context, index) => [context, counts[index]])
    );
  }
  return { spectra, trueExposures };
}

function multinomialCounts(probabilities, total, random) {
  const normalizedTotal = probabilities.reduce((sum, value) => sum + value, 0);
  const cumulative = [];
  let running = 0;
  for (const probability of probabilities) {
    running += normalizedTotal > 0 ? probability / normalizedTotal : 0;
    cumulative.push(running);
  }
  const counts = Array(probabilities.length).fill(0);
  for (let draw = 0; draw < total; draw += 1) {
    const value = random();
    const index = cumulative.findIndex((cutoff) => value <= cutoff);
    counts[index < 0 ? counts.length - 1 : index] += 1;
  }
  return counts;
}

export function matrixFromSignatures(signatures, contexts = sbs96Contexts()) {
  const signatureNames = Object.keys(signatures);
  return contexts.map((context) =>
    signatureNames.map((signature) => signatures[signature]?.[context] || 0)
  );
}

export function matrixFromSpectra(spectra, contexts = sbs96Contexts()) {
  const sampleNames = Object.keys(spectra);
  return contexts.map((context) =>
    sampleNames.map((sample) => spectra[sample]?.[context] || 0)
  );
}
