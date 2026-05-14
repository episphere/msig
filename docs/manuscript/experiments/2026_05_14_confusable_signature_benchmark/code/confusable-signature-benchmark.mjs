#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  bootstrapSignatureFit,
  calculateReconstructionError,
  fitSpectraWithNNLS,
} from "../../../../../mSigSDKScripts/qc.js";
import {
  computeFitQualityEvidence,
  computeSignatureAmbiguity,
} from "../../../../../mSigSDKScripts/guidance.js";
import {
  cosineSimilarity,
  normalizeVector,
  seededRandom,
  sum,
} from "../../../../../mSigSDKScripts/numerics.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const EXPERIMENT_DIR = dirname(dirname(SCRIPT_PATH));
const MANUSCRIPT_DIR = join(EXPERIMENT_DIR, "..", "..");
const SNAPSHOT_PATH = join(
  MANUSCRIPT_DIR,
  "actual-figure-pages",
  "data",
  "pcawg-lung-snapshot.json"
);

const SELECTED_SIGNATURES = ["SBS2", "SBS13", "SBS5", "SBS40", "SBS3"];
const DEFAULT_BURDENS = [50, 100, 250, 500, 1000, 2500];
const DEFAULT_SAMPLES_PER_CELL = 8;
const DEFAULT_BOOTSTRAP_ITERATIONS = 200;
const SEED = 20260514;
const FIT_EXPOSURE_THRESHOLD = 0.01;
const CONFIDENCE_LEVEL = 0.95;

const MIXTURE_FAMILIES = [
  {
    id: "sbs2_sbs13_ratio_sweep",
    label: "SBS2 plus SBS13 ratio sweep",
    mixtures: [
      { label: "sbs2_10_sbs13_90", exposures: { SBS2: 0.1, SBS13: 0.9 } },
      { label: "sbs2_25_sbs13_75", exposures: { SBS2: 0.25, SBS13: 0.75 } },
      { label: "sbs2_50_sbs13_50", exposures: { SBS2: 0.5, SBS13: 0.5 } },
      { label: "sbs2_75_sbs13_25", exposures: { SBS2: 0.75, SBS13: 0.25 } },
      { label: "sbs2_90_sbs13_10", exposures: { SBS2: 0.9, SBS13: 0.1 } },
    ],
  },
  {
    id: "sbs5_sbs40_sbs3_mixture",
    label: "SBS5 plus SBS40 plus SBS3",
    mixtures: [
      { label: "sbs5_40_sbs40_40_sbs3_20", exposures: { SBS5: 0.4, SBS40: 0.4, SBS3: 0.2 } },
      { label: "sbs5_20_sbs40_60_sbs3_20", exposures: { SBS5: 0.2, SBS40: 0.6, SBS3: 0.2 } },
      { label: "sbs5_60_sbs40_20_sbs3_20", exposures: { SBS5: 0.6, SBS40: 0.2, SBS3: 0.2 } },
    ],
  },
];

function parseArgs(argv) {
  const options = {
    outputDir: EXPERIMENT_DIR,
    burdens: DEFAULT_BURDENS,
    samplesPerCell: DEFAULT_SAMPLES_PER_CELL,
    bootstrapIterations: DEFAULT_BOOTSTRAP_ITERATIONS,
  };

  for (const arg of argv) {
    if (arg === "--quick") {
      options.burdens = [50, 250];
      options.samplesPerCell = 2;
      options.bootstrapIterations = 10;
    } else if (arg.startsWith("--output-dir=")) {
      options.outputDir = resolve(arg.slice("--output-dir=".length));
    } else if (arg.startsWith("--samples-per-cell=")) {
      const value = Number(arg.slice("--samples-per-cell=".length));
      if (Number.isInteger(value) && value > 0) {
        options.samplesPerCell = value;
      }
    } else if (arg.startsWith("--bootstrap-iterations=")) {
      const value = Number(arg.slice("--bootstrap-iterations=".length));
      if (Number.isInteger(value) && value > 0) {
        options.bootstrapIterations = value;
      }
    } else if (arg.startsWith("--burdens=")) {
      const values = arg
        .slice("--burdens=".length)
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
      if (values.length > 0) {
        options.burdens = values;
      }
    }
  }

  return options;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return `${[headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

function normalizeRecord(record, contexts) {
  const values = contexts.map((context) => Number(record[context]) || 0);
  const normalized = normalizeVector(values, 1);
  return Object.fromEntries(
    contexts.map((context, index) => [context, normalized[index]])
  );
}

function completeExposure(exposure) {
  return Object.fromEntries(
    SELECTED_SIGNATURES.map((signatureName) => [
      signatureName,
      Number(exposure[signatureName]) || 0,
    ])
  );
}

function multinomialCounts(total, probabilities, random) {
  const cumulative = [];
  let running = 0;
  for (const probability of probabilities) {
    running += probability;
    cumulative.push(running);
  }

  const counts = Array(probabilities.length).fill(0);
  for (let draw = 0; draw < total; draw++) {
    const value = random();
    const index = cumulative.findIndex((entry) => value <= entry);
    counts[index === -1 ? counts.length - 1 : index] += 1;
  }
  return counts;
}

function createSpectrum({ contexts, signatures, exposure, burden, random }) {
  const probabilities = contexts.map((context) =>
    sum(
      Object.entries(exposure).map(
        ([signatureName, weight]) =>
          weight * (signatures[signatureName]?.[context] || 0)
      )
    )
  );
  const counts = multinomialCounts(
    burden,
    normalizeVector(probabilities, 1),
    random
  );
  return Object.fromEntries(
    contexts.map((context, index) => [context, counts[index]])
  );
}

function exposureVector(exposure) {
  return SELECTED_SIGNATURES.map((signatureName) => exposure[signatureName] || 0);
}

function expectedReportingMode({ burden, activeSignatures, ambiguityBySignature }) {
  if (burden < 100) {
    return "restricted_interpretation";
  }

  const hasConfusableActiveSignature = activeSignatures.some((signatureName) =>
    ["high", "moderate"].includes(
      ambiguityBySignature[signatureName]?.ambiguityClass || "low"
    )
  );

  return hasConfusableActiveSignature
    ? "report_with_caveats"
    : "standard_qc_passed";
}

function summarizeRows(rows, coverageRows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.scenario}|${row.burden}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  return [...groups.entries()].map(([key, groupRows]) => {
    const [scenario, burdenText] = key.split("|");
    const burden = Number(burdenText);
    const groupCoverage = coverageRows.filter(
      (row) => row.scenario === scenario && row.burden === burden
    );
    const covered = groupCoverage.filter((row) => row.covered).length;
    const modeCounts = Object.fromEntries(
      [...new Set(groupRows.map((row) => row.reportingMode))].map((mode) => [
        mode,
        groupRows.filter((row) => row.reportingMode === mode).length,
      ])
    );

    return {
      scenario,
      burden,
      spectra: groupRows.length,
      bootstrapActiveSignatureIntervals: groupCoverage.length,
      empiricalCoverage:
        groupCoverage.length === 0 ? null : covered / groupCoverage.length,
      reportingModeAccuracy:
        groupRows.length === 0
          ? null
          : groupRows.filter((row) => row.reportingModeMatchesExpected).length /
            groupRows.length,
      meanExposureCosine:
        groupRows.reduce((total, row) => total + row.exposureCosine, 0) /
        groupRows.length,
      meanReconstructionCosine:
        groupRows.reduce((total, row) => total + row.reconstructionCosine, 0) /
        groupRows.length,
      modeCounts,
    };
  });
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length === 0
    ? null
    : finite.reduce((total, value) => total + value, 0) / finite.length;
}

function summarizeReportingModes(rows) {
  const modes = ["standard_qc_passed", "report_with_caveats", "restricted_interpretation", "not_assessable"];
  return modes
    .map((reportingMode) => {
      const modeRows = rows.filter((row) => row.reportingMode === reportingMode);
      return {
        reportingMode,
        spectra: modeRows.length,
        meanExposureCosine: mean(modeRows.map((row) => row.exposureCosine)),
        meanReconstructionCosine: mean(
          modeRows.map((row) => row.reconstructionCosine)
        ),
        ambiguityWarningRate:
          modeRows.length === 0
            ? null
            : modeRows.filter((row) => row.signatureAmbiguityWarningRaised)
              .length / modeRows.length,
      };
    })
    .filter((row) => row.spectra > 0);
}

function summarizeCoverageByBurden(coverageRows) {
  const burdens = [...new Set(coverageRows.map((row) => row.burden))].sort(
    (a, b) => a - b
  );
  return burdens.map((burden) => {
    const rows = coverageRows.filter((row) => row.burden === burden);
    const empiricalCoverage =
      rows.length === 0
        ? null
        : rows.filter((row) => row.covered).length / rows.length;
    return {
      burden,
      activeSignatureIntervals: rows.length,
      empiricalCoverage,
      absoluteDeviationFromNominal:
        empiricalCoverage === null
          ? null
          : Math.abs(empiricalCoverage - CONFIDENCE_LEVEL),
      meaningfulDeviationFlag:
        empiricalCoverage === null
          ? false
          : Math.abs(empiricalCoverage - CONFIDENCE_LEVEL) >= 0.1,
    };
  });
}

function summarizeAmbiguityWarning(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.scenario}|${row.mixture}|${row.burden}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  return [...groups.entries()].map(([key, groupRows]) => {
    const [scenario, mixture, burdenText] = key.split("|");
    const burden = Number(burdenText);
    const expected = groupRows.filter((row) => row.signatureAmbiguityExpected);
    return {
      scenario,
      mixture,
      burden,
      spectra: groupRows.length,
      expectedAmbiguityWarningSpectra: expected.length,
      raisedAmbiguityWarningSpectra: groupRows.filter(
        (row) => row.signatureAmbiguityWarningRaised
      ).length,
      sensitivityWhenExpected:
        expected.length === 0
          ? null
          : expected.filter((row) => row.signatureAmbiguityWarningRaised).length /
            expected.length,
    };
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataDir = join(options.outputDir, "data");
  const tableDir = join(options.outputDir, "tables");
  const figureDir = join(options.outputDir, "figures");
  await mkdir(dataDir, { recursive: true });
  await mkdir(tableDir, { recursive: true });
  await mkdir(figureDir, { recursive: true });

  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  const contexts = Object.keys(Object.values(snapshot.referenceSignatures)[0] || {});
  const missing = SELECTED_SIGNATURES.filter(
    (signature) => !snapshot.referenceSignatures?.[signature]
  );
  if (missing.length > 0) {
    throw new Error(`Missing reference signatures in snapshot: ${missing.join(", ")}`);
  }

  const signatures = Object.fromEntries(
    SELECTED_SIGNATURES.map((signatureName) => [
      signatureName,
      normalizeRecord(snapshot.referenceSignatures[signatureName], contexts),
    ])
  );
  const ambiguity = computeSignatureAmbiguity(signatures, { contexts });
  const ambiguityBySignature = Object.fromEntries(
    ambiguity.signatures.map((row) => [row.signatureName, row])
  );
  const random = seededRandom(SEED);
  const spectra = {};
  const truthBySample = {};
  const designRows = [];

  for (const family of MIXTURE_FAMILIES) {
    for (const mixture of family.mixtures) {
      const exposure = completeExposure(mixture.exposures);
      const activeSignatures = Object.entries(exposure)
        .filter(([, value]) => value > 0)
        .map(([signatureName]) => signatureName);

      for (const burden of options.burdens) {
        for (let replicate = 0; replicate < options.samplesPerCell; replicate++) {
          const sample = [
            family.id,
            mixture.label,
            String(burden),
            String(replicate + 1).padStart(3, "0"),
          ].join("__");
          spectra[sample] = createSpectrum({
            contexts,
            signatures,
            exposure,
            burden,
            random,
          });
          truthBySample[sample] = {
            scenario: family.id,
            scenarioLabel: family.label,
            mixture: mixture.label,
            burden,
            replicate: replicate + 1,
            exposure,
            activeSignatures,
            signatureAmbiguityExpected: activeSignatures.some(
              (signatureName) =>
                ambiguityBySignature[signatureName]?.ambiguityClass === "high"
            ),
            expectedReportingMode: expectedReportingMode({
              burden,
              activeSignatures,
              ambiguityBySignature,
            }),
          };
          designRows.push({ sample, ...truthBySample[sample] });
        }
      }
    }
  }

  const fittedExposures = await fitSpectraWithNNLS(signatures, spectra, {
    contexts,
    exposureThreshold: FIT_EXPOSURE_THRESHOLD,
    exposureType: "relative",
    renormalize: true,
  });
  const reconstruction = calculateReconstructionError(
    signatures,
    spectra,
    fittedExposures,
    { contexts, normalizeMode: "relative" }
  );
  const fitQuality = computeFitQualityEvidence(
    {
      signatures,
      spectra,
      exposures: fittedExposures,
      reconstructionError: reconstruction,
      ambiguity,
    },
    { contexts }
  );
  const reconstructionBySample = Object.fromEntries(
    reconstruction.samples.map((row) => [row.sample, row])
  );
  const fitQualityBySample = Object.fromEntries(
    fitQuality.samples.map((row) => [row.sample, row])
  );

  const coverageRows = [];
  for (let rowIndex = 0; rowIndex < designRows.length; rowIndex++) {
    const row = designRows[rowIndex];
    const bootstrap = await bootstrapSignatureFit(signatures, spectra[row.sample], {
      contexts,
      iterations: options.bootstrapIterations,
      confidenceLevel: CONFIDENCE_LEVEL,
      exposureThreshold: FIT_EXPOSURE_THRESHOLD,
      exposureType: "relative",
      renormalize: true,
      seed: SEED + rowIndex * 17,
    });
    const intervalsBySignature = Object.fromEntries(
      bootstrap.signatures.map((entry) => [entry.signatureName, entry])
    );

    for (const signatureName of row.activeSignatures) {
      const interval = intervalsBySignature[signatureName];
      const trueExposure = row.exposure[signatureName] || 0;
      const covered =
        Number.isFinite(interval?.ciLower) &&
        Number.isFinite(interval?.ciUpper) &&
        interval.ciLower <= trueExposure &&
        trueExposure <= interval.ciUpper;
      coverageRows.push({
        sample: row.sample,
        scenario: row.scenario,
        mixture: row.mixture,
        burden: row.burden,
        signatureName,
        trueExposure,
        fittedExposure: fittedExposures[row.sample]?.[signatureName] || 0,
        ciLower: interval?.ciLower ?? null,
        ciUpper: interval?.ciUpper ?? null,
        covered,
        selectionFrequency: interval?.selectionFrequency ?? null,
      });
    }
  }

  const sampleRows = designRows.map((row) => {
    const fitted = completeExposure(fittedExposures[row.sample] || {});
    const fitQualitySample = fitQualityBySample[row.sample];
    const reportingMode = fitQualitySample?.reportingMode || "not_available";
    const reviewFlagCodes = fitQualitySample?.reviewFlagCodes || [];
    return {
      sample: row.sample,
      scenario: row.scenario,
      scenarioLabel: row.scenarioLabel,
      mixture: row.mixture,
      burden: row.burden,
      expectedReportingMode: row.expectedReportingMode,
      reportingMode,
      reportingModeMatchesExpected: reportingMode === row.expectedReportingMode,
      reviewFlagCodes: reviewFlagCodes.join(";"),
      signatureAmbiguityExpected: row.signatureAmbiguityExpected,
      signatureAmbiguityWarningRaised:
        reviewFlagCodes.includes("SIGNATURE_AMBIGUITY"),
      exposureCosine: cosineSimilarity(
        exposureVector(row.exposure),
        exposureVector(fitted)
      ),
      reconstructionCosine:
        reconstructionBySample[row.sample]?.cosineSimilarity ?? null,
      activeSignatures: row.activeSignatures.join(";"),
      trueExposures: JSON.stringify(row.exposure),
      fittedExposures: JSON.stringify(fitted),
    };
  });
  const summaryRows = summarizeRows(sampleRows, coverageRows);
  const reportingModeRows = summarizeReportingModes(sampleRows);
  const coverageByBurdenRows = summarizeCoverageByBurden(coverageRows);
  const ambiguityWarningRows = summarizeAmbiguityWarning(sampleRows);

  await writeFile(
    join(dataDir, "confusable_signature_sample_level.csv"),
    toCsv(
      [
        "sample",
        "scenario",
        "mixture",
        "burden",
        "expected_reporting_mode",
        "reporting_mode",
        "reporting_mode_matches_expected",
        "review_flag_codes",
        "signature_ambiguity_expected",
        "signature_ambiguity_warning_raised",
        "exposure_cosine",
        "reconstruction_cosine",
        "active_signatures",
        "true_exposures_json",
        "fitted_exposures_json",
      ],
      sampleRows.map((row) => [
        row.sample,
        row.scenario,
        row.mixture,
        row.burden,
        row.expectedReportingMode,
        row.reportingMode,
        row.reportingModeMatchesExpected,
        row.reviewFlagCodes,
        row.signatureAmbiguityExpected,
        row.signatureAmbiguityWarningRaised,
        row.exposureCosine,
        row.reconstructionCosine,
        row.activeSignatures,
        row.trueExposures,
        row.fittedExposures,
      ])
    )
  );
  await writeFile(
    join(dataDir, "confusable_signature_bootstrap_coverage.csv"),
    toCsv(
      [
        "sample",
        "scenario",
        "mixture",
        "burden",
        "signature_name",
        "true_exposure",
        "fitted_exposure",
        "ci_lower",
        "ci_upper",
        "covered",
        "selection_frequency",
      ],
      coverageRows.map((row) => [
        row.sample,
        row.scenario,
        row.mixture,
        row.burden,
        row.signatureName,
        row.trueExposure,
        row.fittedExposure,
        row.ciLower,
        row.ciUpper,
        row.covered,
        row.selectionFrequency,
      ])
    )
  );
  await writeFile(
    join(dataDir, "confusable_signature_summary.csv"),
    toCsv(
      [
        "scenario",
        "burden",
        "spectra",
        "bootstrap_active_signature_intervals",
        "empirical_coverage",
        "reporting_mode_accuracy",
        "mean_exposure_cosine",
        "mean_reconstruction_cosine",
        "reporting_mode_counts_json",
      ],
      summaryRows.map((row) => [
        row.scenario,
        row.burden,
        row.spectra,
        row.bootstrapActiveSignatureIntervals,
        row.empiricalCoverage,
        row.reportingModeAccuracy,
        row.meanExposureCosine,
        row.meanReconstructionCosine,
        JSON.stringify(row.modeCounts),
      ])
    )
  );
  await writeFile(
    join(dataDir, "confusable_signature_reporting_modes.csv"),
    toCsv(
      [
        "reporting_mode",
        "spectra",
        "mean_exposure_cosine",
        "mean_reconstruction_cosine",
        "signature_ambiguity_warning_rate",
      ],
      reportingModeRows.map((row) => [
        row.reportingMode,
        row.spectra,
        row.meanExposureCosine,
        row.meanReconstructionCosine,
        row.ambiguityWarningRate,
      ])
    )
  );
  await writeFile(
    join(dataDir, "confusable_signature_bootstrap_coverage_by_burden.csv"),
    toCsv(
      [
        "burden",
        "active_signature_intervals",
        "empirical_coverage",
        "absolute_deviation_from_nominal",
        "meaningful_deviation_flag",
      ],
      coverageByBurdenRows.map((row) => [
        row.burden,
        row.activeSignatureIntervals,
        row.empiricalCoverage,
        row.absoluteDeviationFromNominal,
        row.meaningfulDeviationFlag,
      ])
    )
  );
  await writeFile(
    join(dataDir, "confusable_signature_ambiguity_warning.csv"),
    toCsv(
      [
        "scenario",
        "mixture",
        "burden",
        "spectra",
        "expected_ambiguity_warning_spectra",
        "raised_ambiguity_warning_spectra",
        "sensitivity_when_expected",
      ],
      ambiguityWarningRows.map((row) => [
        row.scenario,
        row.mixture,
        row.burden,
        row.spectra,
        row.expectedAmbiguityWarningSpectra,
        row.raisedAmbiguityWarningSpectra,
        row.sensitivityWhenExpected,
      ])
    )
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    seed: SEED,
    signatureSetName: snapshot.signatureSetName,
    selectedSignatures: SELECTED_SIGNATURES,
    burdens: options.burdens,
    samplesPerCell: options.samplesPerCell,
    bootstrapIterations: options.bootstrapIterations,
    confidenceLevel: CONFIDENCE_LEVEL,
    fitExposureThreshold: FIT_EXPOSURE_THRESHOLD,
    expectedReportingModeRule:
      "Low-burden spectra below 100 mutations are expected to use restricted_interpretation; higher-burden mixtures with active moderate/high ambiguity signatures are expected to use report_with_caveats; otherwise standard_qc_passed.",
    summaryRows,
    reportingModeRows,
    coverageByBurdenRows,
    ambiguityWarningRows,
  };
  await writeFile(
    join(dataDir, "confusable-signature-benchmark-results.json"),
    `${JSON.stringify(payload, null, 2)}\n`
  );
  await writeFile(join(tableDir, ".gitkeep"), "");
  await writeFile(join(figureDir, ".gitkeep"), "");

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
