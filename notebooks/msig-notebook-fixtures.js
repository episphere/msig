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
  demoMafRows,
  demoMetadata,
  demoSignatures,
  demoSpectra,
  gdcResourceFallback,
  panelValidationSummary,
  sbs96Contexts,
  sharedCallableOpportunities,
  zeroSbs96,
};
