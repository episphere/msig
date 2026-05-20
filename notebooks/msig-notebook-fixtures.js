const BASES = ["A", "C", "G", "T"];
const SUBSTITUTIONS = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];

function sbs96Contexts() {
  return BASES.flatMap((left) =>
    SUBSTITUTIONS.flatMap((substitution) =>
      BASES.map((right) => `${left}[${substitution}]${right}`)
    )
  );
}

function zeroSbs96() {
  return Object.fromEntries(sbs96Contexts().map((context) => [context, 0]));
}

function normalizeRecord(record) {
  const total = Object.values(record).reduce((sum, value) => sum + Number(value || 0), 0);
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, total ? Number(value || 0) / total : 0])
  );
}

function demoSignatures() {
  return {
    SBS_demo_smoking_like: normalizeRecord({
      ...zeroSbs96(),
      "A[C>A]A": 64,
      "A[C>A]C": 22,
      "T[C>A]A": 16,
      "G[C>A]T": 8,
      "T[C>T]T": 4,
    }),
    SBS_demo_clock_like: normalizeRecord({
      ...zeroSbs96(),
      "A[C>T]G": 22,
      "T[C>T]T": 60,
      "G[C>T]A": 24,
      "C[T>C]T": 12,
      "A[C>A]A": 4,
    }),
    SBS_demo_apobec_like: normalizeRecord({
      ...zeroSbs96(),
      "T[C>T]A": 44,
      "T[C>G]A": 34,
      "T[C>T]T": 22,
      "A[C>A]A": 3,
      "G[C>G]G": 3,
    }),
  };
}

function demoSpectra() {
  return {
    local_high_smoking_like: {
      ...zeroSbs96(),
      "A[C>A]A": 420,
      "A[C>A]C": 160,
      "T[C>A]A": 112,
      "G[C>A]T": 48,
      "T[C>T]T": 36,
    },
    local_mixed_clock: {
      ...zeroSbs96(),
      "A[C>A]A": 130,
      "T[C>T]T": 185,
      "G[C>T]A": 82,
      "A[C>T]G": 76,
      "C[T>C]T": 41,
    },
    local_low_burden_review: {
      ...zeroSbs96(),
      "A[C>A]A": 9,
      "T[C>T]A": 5,
      "G[C>G]G": 2,
    },
    local_apobec_pattern: {
      ...zeroSbs96(),
      "T[C>T]A": 165,
      "T[C>G]A": 132,
      "T[C>T]T": 91,
      "A[C>A]A": 20,
    },
  };
}

const demoMetadata = [
  { sample: "local_high_smoking_like", group: "high_burden", assay: "WGS" },
  { sample: "local_mixed_clock", group: "moderate_burden", assay: "WGS" },
  { sample: "local_low_burden_review", group: "low_burden", assay: "panel" },
  { sample: "local_apobec_pattern", group: "moderate_burden", assay: "WES" },
];

const publicSbs96SignatureNames = [
  "SBS1",
  "SBS2",
  "SBS4",
  "SBS5",
  "SBS13",
  "SBS17a",
  "SBS17b",
  "SBS18",
  "SBS40",
];

const defaultPublicSbs96Dataset = {
  study: "TCGA",
  genomeDataType: "WES",
  cancerType: "Lung-AdenoCa",
  mutationType: "SBS",
  matrixSize: 96,
  signatureSetName: "COSMIC_v3_Signatures_GRCh37_SBS96",
  sampleLimit: 8,
};

const alternatePublicSbs96Dataset = {
  study: "PCAWG",
  genomeDataType: "WGS",
  cancerType: "Lung-AdenoCA",
  mutationType: "SBS",
  matrixSize: 96,
  signatureSetName: "COSMIC_v3_Signatures_GRCh37_SBS96",
  sampleLimit: 8,
  sampleNames: [
    "SP53810",
    "SP55142",
    "SP55235",
    "SP54113",
    "SP50611",
    "SP50592",
    "SP50406",
    "SP55004",
  ],
};

function matrixRecordTotal(record = {}) {
  return Object.values(record || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function burdenGroup(total) {
  if (total >= 5000) return "high_burden";
  if (total >= 500) return "moderate_burden";
  return "low_burden";
}

function loadDemoSbs96Dataset(options = {}) {
  const allSpectra = demoSpectra();
  const allSignatures = demoSignatures();
  const sampleLimit = Math.max(
    1,
    Math.round(Number(options.sampleLimit || Object.keys(allSpectra).length))
  );
  const sampleNames = (Array.isArray(options.sampleNames) ? options.sampleNames : Object.keys(allSpectra))
    .filter((sample) => allSpectra[sample])
    .slice(0, sampleLimit);
  const signatureCandidates = Array.isArray(options.signatureNames)
    ? options.signatureNames
    : Object.keys(allSignatures);
  const selectedSignatureNames = signatureCandidates.filter((signature) => allSignatures[signature]);
  const signatureNames = selectedSignatureNames.length
    ? selectedSignatureNames
    : Object.keys(allSignatures);
  const spectra = Object.fromEntries(sampleNames.map((sample) => [sample, allSpectra[sample]]));
  const signatures = Object.fromEntries(
    signatureNames.map((signature) => [signature, allSignatures[signature]])
  );
  const metadataBySample = new Map(demoMetadata.map((row) => [row.sample, row]));
  const metadata = sampleNames.map((sample) => {
    const totalMutations = matrixRecordTotal(allSpectra[sample]);
    return {
      sample,
      study: "Embedded demo",
      cancer: "mixed",
      strategy: metadataBySample.get(sample)?.assay || "SBS96",
      profile: "SBS",
      matrix: 96,
      source: "embedded demo",
      totalMutations,
      burdenGroup: burdenGroup(totalMutations),
      ...(metadataBySample.get(sample) || {}),
    };
  });
  const reason = options.reason ? `; ${String(options.reason).slice(0, 180)}` : "";

  return {
    contexts: sbs96Contexts(),
    spectra,
    signatures,
    allSignatures,
    metadata,
    sampleNames,
    signatureNames,
    selection: {
      study: "Embedded demo",
      genomeDataType: "SBS96",
      cancerType: "mixed",
      mutationType: "SBS",
      matrixSize: 96,
      signatureSetName: "Embedded demo signatures",
      sampleLimit,
      sampleNames,
      signatureNames,
    },
    source: "Embedded SBS96 QC demo dataset",
    status: `embedded demo${reason}`,
    spectrumRows: [],
    signatureRows: [],
    optionRows: [],
  };
}

async function loadPublicSbs96Dataset(mSigSDK, options = {}) {
  const requestedSelection = {
    ...defaultPublicSbs96Dataset,
    ...options,
  };
  const allowAlternate = options.allowAlternate !== false;
  const allowDemoFallback = options.allowDemoFallback === true;

  async function loadSelection(selection, alternateReason = "") {
    const sampleLimit = Math.max(1, Math.round(Number(selection.sampleLimit || 8)));
    let sampleNames = Array.isArray(selection.sampleNames)
      ? selection.sampleNames.slice(0, sampleLimit)
      : [];
    let optionRows = [];

    if (!sampleNames.length) {
      optionRows = await mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumOptions(
        selection.study,
        selection.genomeDataType,
        selection.cancerType,
        Math.max(sampleLimit * 20, 500)
      );
      sampleNames = [
        ...new Set(
          (Array.isArray(optionRows) ? optionRows : [])
            .filter((row) =>
              row.study === selection.study &&
              row.strategy === selection.genomeDataType &&
              row.profile === selection.mutationType &&
              Number(row.matrix) === Number(selection.matrixSize) &&
              row.cancer === selection.cancerType
            )
            .map((row) => row.sample)
            .filter(Boolean)
        ),
      ].slice(0, sampleLimit);
    }

    if (!sampleNames.length) {
      throw new Error(
        `No public ${selection.study} ${selection.cancerType} ${selection.genomeDataType} ${selection.mutationType}${selection.matrixSize} samples were available.`
      );
    }

    const [rawSpectrumRows, rawSignatureRows] = await Promise.all([
      mSigSDK.mSigPortal.mSigPortalData.getMutationalSpectrumData(
        selection.study,
        sampleNames,
        selection.genomeDataType,
        selection.cancerType,
        selection.mutationType,
        selection.matrixSize
      ),
      mSigSDK.mSigPortal.mSigPortalData.getMutationalSignaturesData(
        selection.genomeDataType,
        selection.signatureSetName,
        selection.mutationType,
        selection.matrixSize,
        10000
      ),
    ]);

    const spectrumRows = (Array.isArray(rawSpectrumRows) ? rawSpectrumRows : []).flat();
    const signatureRows = (Array.isArray(rawSignatureRows) ? rawSignatureRows : []).flat();
    const allSpectra = mSigSDK.mSigPortal.mSigPortalData.extractMutationalSpectra(spectrumRows);
    const allSignatures = mSigSDK.mSigPortal.mSigPortalData.extractMutationalSpectra(
      signatureRows,
      "signatureName"
    );
    const availableSamples = sampleNames.filter((sample) => allSpectra[sample]);
    const signatureCandidates = selection.signatureNames || publicSbs96SignatureNames;
    const availableSignatures = signatureCandidates.filter((signature) => allSignatures[signature]);
    const selectedSignatureNames = availableSignatures.length
      ? availableSignatures
      : Object.keys(allSignatures).slice(0, 9);

    if (availableSamples.length < Math.min(2, sampleLimit) || selectedSignatureNames.length < 3) {
      throw new Error(
        `Public APIs returned too few matrices for ${selection.study} ${selection.cancerType}.`
      );
    }

    const spectra = Object.fromEntries(
      availableSamples.map((sample) => [sample, allSpectra[sample]])
    );
    const signatures = Object.fromEntries(
      selectedSignatureNames.map((signature) => [signature, allSignatures[signature]])
    );
    const metadata = availableSamples.map((sample) => {
      const totalMutations = matrixRecordTotal(allSpectra[sample]);
      return {
        sample,
        study: selection.study,
        cancer: selection.cancerType,
        strategy: selection.genomeDataType,
        profile: selection.mutationType,
        matrix: selection.matrixSize,
        source: "mSigPortal API",
        totalMutations,
        burdenGroup: burdenGroup(totalMutations),
      };
    });

    return {
      contexts: sbs96Contexts(),
      spectra,
      signatures,
      allSignatures,
      metadata,
      sampleNames: availableSamples,
      signatureNames: selectedSignatureNames,
      selection: {
        ...selection,
        sampleNames: availableSamples,
        signatureNames: selectedSignatureNames,
      },
      source: `mSigPortal public API: ${selection.study} ${selection.cancerType} ${selection.genomeDataType} ${selection.mutationType}${selection.matrixSize}`,
      status: alternateReason ? `live mSigPortal (${alternateReason})` : "live mSigPortal",
      spectrumRows,
      signatureRows,
      optionRows,
    };
  }

  try {
    return await loadSelection(requestedSelection);
  } catch (error) {
    if (allowAlternate) {
      try {
        return await loadSelection(
          {
            ...alternatePublicSbs96Dataset,
            signatureNames: requestedSelection.signatureNames,
          },
          `used PCAWG alternate after ${error.message}`
        );
      } catch (alternateError) {
        if (allowDemoFallback) {
          return loadDemoSbs96Dataset({
            ...options,
            reason: alternateError.message,
          });
        }
        throw alternateError;
      }
    }
    if (allowDemoFallback) {
      return loadDemoSbs96Dataset({
        ...options,
        reason: error.message,
      });
    }
    throw error;
  }
}

function standardizeTcgaVariantRows(rows = [], maxVariants = 120) {
  return rows
    .filter((row) => row?.chromosome && row?.chromosome_start)
    .slice(0, maxVariants)
    .map((row, index) => ({
      id:
        row.id ||
        `${row.sample || "tcga"}:${row.chromosome}:${row.chromosome_start}:${row.reference_genome_allele || ""}>${row.mutated_to_allele || ""}`,
      sample: row.sample || row.file_id || "tcga_sample",
      project_code: row.project_code || "TCGA-LUAD",
      chromosome: row.chromosome,
      start_position: row.chromosome_start,
      reference_allele: row.reference_genome_allele,
      tumor_seq_allele2: row.mutated_to_allele,
      variant_type: row.mutation_type || "SNP",
      mutation_classification: row.mutation_classification || "",
      build: row.build || "hg19",
      position: Number(row.chromosome_start) || index + 1,
      source: "TCGA/GDC MAF",
    }));
}

async function loadPublicMafRows(mSigSDK, options = {}) {
  const projects = options.projects || ["TCGA-LUAD"];
  const maxFiles = Math.max(1, Math.round(Number(options.maxFiles || 1)));
  const maxVariants = Math.max(1, Math.round(Number(options.maxVariants || 120)));
  const mafIndex = await mSigSDK.TCGA.getMafInformationFromProjects(projects);
  const subset = {};
  const selectedFiles = [];

  for (const project of projects) {
    const mafFiles = (mafIndex?.[project]?.maf_files || []).slice(0, maxFiles - selectedFiles.length);
    if (mafFiles.length) {
      subset[project] = { maf_files: mafFiles };
      selectedFiles.push(...mafFiles.map((fileId) => ({ project, fileId })));
    }
    if (selectedFiles.length >= maxFiles) break;
  }

  if (!selectedFiles.length) {
    throw new Error(`No public GDC MAF files were found for ${projects.join(", ")}.`);
  }

  const variantResult = await mSigSDK.TCGA.getVariantInformationFromMafFiles(subset);
  const variantRows = Object.values(variantResult || {}).flatMap(
    (projectResult) => projectResult?.variant_information || []
  );
  const rows = standardizeTcgaVariantRows(variantRows, maxVariants);
  if (!rows.length) {
    throw new Error(`No SNV rows were loaded from ${projects.join(", ")}.`);
  }
  return {
    rows,
    mafIndex,
    selectedFiles,
    projects,
    source: `TCGA/GDC MAF: ${projects.join(", ")}`,
  };
}

const demoMafRows = [
  ...Array.from({ length: 72 }, (_, index) => ({
    chromosome: "1",
    start_position: 100000 + index,
    reference_allele: "C",
    tumor_seq_allele2: "A",
    variant_type: "SNP",
    project_code: "demo_tumor",
    context: "ACA",
  })),
  ...Array.from({ length: 48 }, (_, index) => ({
    chromosome: "1",
    start_position: 200000 + index,
    reference_allele: "C",
    tumor_seq_allele2: "T",
    variant_type: "SNP",
    project_code: "demo_tumor",
    context: "TCT",
  })),
  ...Array.from({ length: 30 }, (_, index) => ({
    chromosome: "2",
    start_position: 300000 + index,
    reference_allele: "C",
    tumor_seq_allele2: "G",
    variant_type: "SNP",
    project_code: "demo_tumor",
    context: "GCG",
  })),
];

const gdcResourceFallback = {
  spectrumOptions: [
    { study: "PCAWG", cancer: "Lung-AdenoCA", sample: "SP50611", profile: "SBS", matrix: 96 },
    { study: "PCAWG", cancer: "Lung-AdenoCA", sample: "SP50406", profile: "SBS", matrix: 96 },
    { study: "PCAWG", cancer: "Lung-AdenoCA", sample: "SP55004", profile: "SBS", matrix: 96 },
  ],
  signatureSummary: [
    { signatureSetName: "COSMIC_v3_Signatures_GRCh37_SBS96", species: "Human", profile: "SBS", matrix: 96, count: 78 },
  ],
  tcgaGeneProjects: { projects: ["TCGA-LUAD", "TCGA-LUSC", "TCGA-BRCA"] },
  tcgaMafIndex: {
    "TCGA-LUAD": {
      maf_files: ["gdc-demo-maf-1", "gdc-demo-maf-2"],
      samples_description: [
        { case_submitter_id: "TCGA-LUAD-DEMO-01", gender: "female", race: "white", age_at_diagnosis: 64 },
        { case_submitter_id: "TCGA-LUAD-DEMO-02", gender: "male", race: "not reported", age_at_diagnosis: 71 },
      ],
    },
  },
};

const crossToolSummary = [
  {
    tool: "deconstructSigs",
    samples: 38,
    meanExposureCosineVsMsigSDK: 0.9969815327193795,
    medianExposureCosineVsMsigSDK: 0.9978707554838591,
    minExposureCosineVsMsigSDK: 0.9877900239711915,
    topSignatureAgreementCount: 36,
    topSignatureMismatchCount: 2,
    meanReconstructionCosine: 0.9819048644159422,
  },
  {
    tool: "SigProfilerAssignment",
    samples: 38,
    meanExposureCosineVsMsigSDK: 0.9072736196080771,
    medianExposureCosineVsMsigSDK: 0.9372931330851056,
    minExposureCosineVsMsigSDK: 0.556166283382794,
    topSignatureAgreementCount: 29,
    topSignatureMismatchCount: 9,
    meanReconstructionCosine: 0.973804970592075,
  },
  {
    tool: "MuSiCal",
    samples: 38,
    meanExposureCosineVsMsigSDK: 0.9734572743946809,
    medianExposureCosineVsMsigSDK: 0.9967539108495763,
    minExposureCosineVsMsigSDK: 0.8551095464301346,
    topSignatureAgreementCount: 37,
    topSignatureMismatchCount: 1,
    meanReconstructionCosine: 0.9814736558815317,
  },
];

const panelValidationSummary = [
  {
    callableContextCount: 48,
    truthExposureBin: "0.05-<0.20",
    panelBurdenBin: ">=150",
    calls: 180,
    tierAccuracy: 0.8388888888888889,
    meanPanelVsWgsExposureCosine: 0.9101091713968453,
    medianPanelTotal: 600,
  },
  {
    callableContextCount: 72,
    truthExposureBin: "0.05-<0.20",
    panelBurdenBin: "30-<150",
    calls: 90,
    tierAccuracy: 0.8666666666666667,
    meanPanelVsWgsExposureCosine: 0.894,
    medianPanelTotal: 75,
  },
  {
    callableContextCount: 24,
    truthExposureBin: "<0.05",
    panelBurdenBin: "<30",
    calls: 184,
    tierAccuracy: 1,
    meanPanelVsWgsExposureCosine: 0.8215039209355651,
    medianPanelTotal: 25,
  },
];

function sharedCallableOpportunities() {
  const opportunities = Object.fromEntries(sbs96Contexts().map((context) => [context, 1]));
  opportunities["G[C>G]G"] = 0;
  opportunities["T[C>G]A"] = 0.35;
  opportunities["T[C>T]A"] = 0.5;
  return opportunities;
}

export {
  crossToolSummary,
  defaultPublicSbs96Dataset,
  demoMafRows,
  demoMetadata,
  demoSignatures,
  demoSpectra,
  gdcResourceFallback,
  loadPublicMafRows,
  loadPublicSbs96Dataset,
  loadDemoSbs96Dataset,
  panelValidationSummary,
  publicSbs96SignatureNames,
  sbs96Contexts,
  sharedCallableOpportunities,
  zeroSbs96,
};
