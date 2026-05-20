const BASES = ["A", "C", "G", "T"];
const SBS_SUBSTITUTIONS = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];

const DBS78_CONTEXTS = [
  "AC>CA", "AC>CG", "AC>CT", "AC>GA", "AC>GG", "AC>GT", "AC>TA", "AC>TG", "AC>TT",
  "AT>CA", "AT>CC", "AT>CG", "AT>GA", "AT>GC", "AT>TA",
  "CC>AA", "CC>AG", "CC>AT", "CC>GA", "CC>GG", "CC>GT", "CC>TA", "CC>TG", "CC>TT",
  "CG>AT", "CG>GC", "CG>GT", "CG>TA", "CG>TC", "CG>TT",
  "CT>AA", "CT>AC", "CT>AG", "CT>GA", "CT>GC", "CT>GG", "CT>TA", "CT>TC", "CT>TG",
  "GC>AA", "GC>AG", "GC>AT", "GC>CA", "GC>CG", "GC>TA",
  "TA>AT", "TA>CG", "TA>CT", "TA>GC", "TA>GG", "TA>GT",
  "TC>AA", "TC>AG", "TC>AT", "TC>CA", "TC>CG", "TC>CT", "TC>GA", "TC>GG", "TC>GT",
  "TG>AA", "TG>AC", "TG>AT", "TG>CA", "TG>CC", "TG>CT", "TG>GA", "TG>GC", "TG>GT",
  "TT>AA", "TT>AC", "TT>AG", "TT>CA", "TT>CC", "TT>CG", "TT>GA", "TT>GC", "TT>GG",
];

const ID83_CONTEXTS = [
  "1:Del:C:0", "1:Del:C:1", "1:Del:C:2", "1:Del:C:3", "1:Del:C:4", "1:Del:C:5",
  "1:Del:T:0", "1:Del:T:1", "1:Del:T:2", "1:Del:T:3", "1:Del:T:4", "1:Del:T:5",
  "1:Ins:C:0", "1:Ins:C:1", "1:Ins:C:2", "1:Ins:C:3", "1:Ins:C:4", "1:Ins:C:5",
  "1:Ins:T:0", "1:Ins:T:1", "1:Ins:T:2", "1:Ins:T:3", "1:Ins:T:4", "1:Ins:T:5",
  "2:Del:M:1", "2:Del:R:0", "2:Del:R:1", "2:Del:R:2", "2:Del:R:3", "2:Del:R:4", "2:Del:R:5",
  "2:Ins:R:0", "2:Ins:R:1", "2:Ins:R:2", "2:Ins:R:3", "2:Ins:R:4", "2:Ins:R:5",
  "3:Del:M:1", "3:Del:M:2", "3:Del:R:0", "3:Del:R:1", "3:Del:R:2", "3:Del:R:3", "3:Del:R:4", "3:Del:R:5",
  "3:Ins:R:0", "3:Ins:R:1", "3:Ins:R:2", "3:Ins:R:3", "3:Ins:R:4", "3:Ins:R:5",
  "4:Del:M:1", "4:Del:M:2", "4:Del:M:3", "4:Del:R:0", "4:Del:R:1", "4:Del:R:2", "4:Del:R:3", "4:Del:R:4", "4:Del:R:5",
  "4:Ins:R:0", "4:Ins:R:1", "4:Ins:R:2", "4:Ins:R:3", "4:Ins:R:4", "4:Ins:R:5",
  "5:Del:M:1", "5:Del:M:2", "5:Del:M:3", "5:Del:M:4", "5:Del:M:5",
  "5:Del:R:0", "5:Del:R:1", "5:Del:R:2", "5:Del:R:3", "5:Del:R:4", "5:Del:R:5",
  "5:Ins:R:0", "5:Ins:R:1", "5:Ins:R:2", "5:Ins:R:3", "5:Ins:R:4", "5:Ins:R:5",
];

function getSBS96Contexts() {
  return BASES.flatMap((fivePrime) =>
    SBS_SUBSTITUTIONS.flatMap((substitution) =>
      BASES.map((threePrime) => `${fivePrime}[${substitution}]${threePrime}`)
    )
  );
}

function getSBS1536Contexts() {
  return BASES.flatMap((fivePrime2) =>
    BASES.flatMap((fivePrime1) =>
      SBS_SUBSTITUTIONS.flatMap((substitution) =>
        BASES.flatMap((threePrime1) =>
          BASES.map(
            (threePrime2) =>
              `${fivePrime2}${fivePrime1}[${substitution}]${threePrime1}${threePrime2}`
          )
        )
      )
    )
  );
}

function normalizeProfile(profile) {
  return String(profile || "SBS").trim().toUpperCase().replace(/^RNA-SBS$/, "RNA");
}

function normalizeMatrix(matrix) {
  const numeric = Number(matrix);
  return Number.isFinite(numeric) ? numeric : matrix;
}

function profileKey({ profile = "SBS", matrix = 96 } = {}) {
  return `${normalizeProfile(profile)}${normalizeMatrix(matrix)}`;
}

const PROFILE_REGISTRY = {
  SBS96: {
    key: "SBS96",
    profile: "SBS",
    matrix: 96,
    contexts: getSBS96Contexts(),
    inputKind: "maf_snv",
    conversionSupport: "native_maf",
    requiredFields: ["chromosome", "start_position", "reference_allele", "tumor_seq_allele2"],
    contextRequirement: "Trinucleotide sequence centered on the substituted base.",
    renderer: "mSigSDK.qcPlots.plotCosmicProfile",
  },
  SBS1536: {
    key: "SBS1536",
    profile: "SBS",
    matrix: 1536,
    contexts: getSBS1536Contexts(),
    inputKind: "maf_snv",
    conversionSupport: "native_maf",
    requiredFields: ["chromosome", "start_position", "reference_allele", "tumor_seq_allele2"],
    contextRequirement: "Pentanucleotide sequence centered on the substituted base.",
    renderer: "mSigSDK.qcPlots.plotCosmicProfile",
  },
  DBS78: {
    key: "DBS78",
    profile: "DBS",
    matrix: 78,
    contexts: DBS78_CONTEXTS,
    inputKind: "maf_dinucleotide",
    conversionSupport: "native_maf",
    requiredFields: ["chromosome", "start_position", "reference_allele", "tumor_seq_allele2"],
    contextRequirement: "Explicit DNP rows or adjacent SNV pairs in the same sample.",
    renderer: "mSigSDK.qcPlots.plotCosmicProfile",
  },
  ID83: {
    key: "ID83",
    profile: "ID",
    matrix: 83,
    contexts: ID83_CONTEXTS,
    inputKind: "maf_indel",
    conversionSupport: "native_maf",
    requiredFields: ["chromosome", "start_position", "reference_allele", "tumor_seq_allele2"],
    contextRequirement: "Insertion/deletion alleles with repeat or microhomology annotation when available.",
    renderer: "mSigSDK.qcPlots.plotCosmicProfile",
  },
  CN48: {
    key: "CN48",
    profile: "CN",
    matrix: 48,
    contexts: null,
    inputKind: "copy_number_segments",
    conversionSupport: "requires_annotated_input",
    requiredFields: ["copy_number", "segment_length", "loh_status"],
    contextRequirement: "Copy-number segment tables, not generic MAF rows.",
    renderer: "mSigSDK.userData.plotPatientMutationalSpectrumuserData",
  },
  SV32: {
    key: "SV32",
    profile: "SV",
    matrix: 32,
    contexts: null,
    inputKind: "structural_variant_segments",
    conversionSupport: "requires_annotated_input",
    requiredFields: ["event_type", "cluster_status", "event_size"],
    contextRequirement: "Structural-variant calls with clustering and size annotations.",
    renderer: "mSigSDK.userData.plotPatientMutationalSpectrumuserData",
  },
  RS32: {
    key: "RS32",
    profile: "RS",
    matrix: 32,
    contexts: null,
    inputKind: "rearrangement_segments",
    conversionSupport: "requires_annotated_input",
    requiredFields: ["event_type", "cluster_status", "event_size"],
    contextRequirement: "Rearrangement calls with clustering and size annotations.",
    renderer: "mSigSDK.userData.plotPatientMutationalSpectrumuserData",
  },
  RNA192: {
    key: "RNA192",
    profile: "RNA",
    matrix: 192,
    contexts: null,
    inputKind: "transcribed_sbs",
    conversionSupport: "requires_annotated_input",
    requiredFields: ["chromosome", "start_position", "reference_allele", "tumor_seq_allele2", "transcription_strand"],
    contextRequirement: "SNV context plus transcription-strand annotation.",
    renderer: "mSigSDK.userData.plotPatientMutationalSpectrumuserData",
  },
};

function normalizeProfileRequest(request) {
  if (typeof request === "string") {
    const match = request.trim().toUpperCase().match(/^([A-Z-]+)(\d+)$/);
    return match
      ? { profile: match[1] === "RNA-SBS" ? "RNA" : match[1], matrix: Number(match[2]) }
      : { profile: request, matrix: null };
  }
  return request || {};
}

function getProfileDefinition(request = {}) {
  const normalized = normalizeProfileRequest(request);
  return PROFILE_REGISTRY[profileKey(normalized)] || null;
}

function getExpectedContexts(options = {}) {
  const definition = getProfileDefinition(options);
  return definition?.contexts ? [...definition.contexts] : null;
}

function listProfileDefinitions() {
  return Object.values(PROFILE_REGISTRY).map((definition) => ({
    ...definition,
    contexts: definition.contexts ? [...definition.contexts] : null,
  }));
}

function listMafConvertibleProfiles() {
  return listProfileDefinitions().filter(
    (definition) => definition.conversionSupport === "native_maf"
  );
}

export {
  DBS78_CONTEXTS,
  ID83_CONTEXTS,
  PROFILE_REGISTRY,
  getExpectedContexts,
  getProfileDefinition,
  getSBS96Contexts,
  getSBS1536Contexts,
  listMafConvertibleProfiles,
  listProfileDefinitions,
  normalizeProfile,
  normalizeProfileRequest,
  profileKey,
};
