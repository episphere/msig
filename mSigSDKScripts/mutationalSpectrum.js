import {
  assertNoUserDataEgress,
  fetchURLAndCache,
  getRuntimeOptions,
} from "./utils.js";
import {
  getProfileDefinition,
  listMafConvertibleProfiles,
  normalizeProfileRequest,
} from "./profileRegistry.js";

function get_sbs_trinucleotide_contexts() {
  const nucleotide_bases = ["A", "C", "G", "T"];
  const substitution_types = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];
  let sbs_trinucleotide_contexts = [];

  for (let base_5 of nucleotide_bases) {
    for (let substitution of substitution_types) {
      for (let base_3 of nucleotide_bases) {
        sbs_trinucleotide_contexts.push(`${base_5}[${substitution}]${base_3}`);
      }
    }
  }

  return sbs_trinucleotide_contexts;
}

function standardize_substitution(ref_allele, mut_allele) {
  /*
COSMIC signatures define mutations from a pyrimidine allele (C, T) to any
other base (C>A, C>G, C>T, T>A, T>C, T>G). If a mutation in the MAF file
is defined from a reference purine allele (A, G), then we infer the substituted
base in the complementary sequence, which would be from a pyrimidine
allele due to purines and pyrimidines complementing each other in a
double-stranded DNA.
 :param ref_allele: base in the reference genome.
:param mut_allele: base in the mutated genome
:return: substitution string from pyrimidine to any other base.
*/
  ref_allele = String(ref_allele || "").toUpperCase();
  mut_allele = String(mut_allele || "").toUpperCase();
  if (!/^[ACGT]$/.test(ref_allele) || !/^[ACGT]$/.test(mut_allele)) {
    return `${ref_allele}>${mut_allele}`;
  }

  var complement_seq, purines;
  complement_seq = {
    A: "T",
    C: "G",
    T: "A",
    G: "C",
  };
  purines = ["A", "G"];

  if (purines.some((v) => ref_allele.includes(v))) {
    return `${complement_seq[ref_allele]}>${complement_seq[mut_allele]}`;
  } else {
    return `${ref_allele}>${mut_allele}`;
  }
}

function init_sbs_mutational_spectra(n_records) {
  /*
Initilizes an ordered dictionary with SBS trinucleotide context as keys and
a list of counts, one for each sample.
 :param n_records: number of samples to record in the mutational spectra matrix.
:return: a dictionary of trinucleotide context and a list of counts
initialized to zeros.
*/

  let tri_nuc_context = get_sbs_trinucleotide_contexts();

  let sbs_mutational_spectra = {};

  for (var i = 0; i < tri_nuc_context.length; i++) {
    let context = tri_nuc_context[i];
    sbs_mutational_spectra[context] = 0;
  }

  return sbs_mutational_spectra;
}

function normalizeSequenceContext(value) {
  return normalizeSequenceWindow(value, 3);
}

function normalizeSequenceWindow(value, size = 3) {
  const context = lookupContextValue(value);
  if (context === null || context === undefined) {
    return null;
  }

  const sequence = String(context).trim().toUpperCase();
  if (sequence.length === size && /^[ACGTN]+$/.test(sequence)) {
    return sequence;
  }
  if (sequence.length >= size && /^[ACGTN]+$/.test(sequence)) {
    const center = Math.floor(sequence.length / 2);
    const flank = Math.floor(size / 2);
    const start = Math.max(0, center - flank);
    const window = sequence.slice(start, start + size);
    return window.length === size ? window : null;
  }

  return null;
}

function reverseComplement(sequence) {
  const complementSeq = {
    A: "T",
    C: "G",
    T: "A",
    G: "C",
    N: "N",
  };
  return String(sequence || "")
    .toUpperCase()
    .split("")
    .reverse()
    .map((base) => complementSeq[base] || "N")
    .join("");
}

function standardize_sequence_context(sequenceContext, size = 3) {
  const normalized = normalizeSequenceWindow(sequenceContext, size);
  if (!normalized) {
    return "N".repeat(size);
  }

  const center = normalized[Math.floor(normalized.length / 2)];
  return "AG".includes(center) ? reverseComplement(normalized) : normalized;
}

function standardize_trinucleotide(trinucleotide_ref) {
  // COSMIC signatures define mutations from a pyrimidine allele (C, T) to any
  // other base (C>A, C>G, C>T, T>A, T>C, T>G). If a mutation in the MAF file
  // is defined from a purine allele (A, G), then we infer the trinucleotide
  // context in the complementary sequence, which would be from a pyrimidine
  // allele due to purines and pyrimidines complementing each other in a
  // double-stranded DNA.

  // :param trinucleotide_ref: trinucleotide sequence seen in the reference genome.
  // :return: a pyrimidine-centric trinucleotide sequence.

  return standardize_sequence_context(trinucleotide_ref, 3);
}


const normalizeChromosome = (chromosome) => {
  if (chromosome === null || chromosome === undefined) {
    return null;
  }

  const value = String(chromosome).trim();
  const match = value.match(/^(?:chr)?(\d+|X|Y|M|MT)$/i);
  if (!match) {
    return null;
  }

  const chromosomeName = match[1].toUpperCase();
  if (/^\d+$/.test(chromosomeName)) {
    return String(parseInt(chromosomeName, 10));
  }

  return chromosomeName === "MT" ? "M" : chromosomeName;
};

function normalizeGenomeBuild(genome) {
  const value = String(genome || "hg19").trim().toLowerCase();
  if (["grch37", "hg19"].includes(value) || /(?:grch37|hg19)/.test(value)) {
    return "hg19";
  }
  if (["grch38", "hg38"].includes(value) || /(?:grch38|hg38)/.test(value)) {
    return "hg38";
  }
  if (["t2t", "t2t-chm13", "chm13", "chm13v2.0", "hs1"].includes(value)) {
    return "t2t-chm13";
  }
  return value;
}

function lookupContextValue(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    return value.sequence || value.trinucleotide || value.context || value.dna || null;
  }
  return null;
}

function getRowSuppliedContext(row, size = 3) {
  return normalizeSequenceWindow(
    row.trinucleotide_context ||
      row.trinucleotide ||
      row.sequence_context ||
      row.pentanucleotide_context ||
      row.pentanucleotide ||
      row.five_prime_context ||
      row.context_sequence ||
      row.context
    ,
    size
  );
}

function normalizeMafInputRows(data, groupBy) {
  if (!Array.isArray(data)) {
    return [];
  }

  if (data.every(Array.isArray)) {
    return data;
  }

  const normalizedGroupBy = String(groupBy || "project_code").toLowerCase();
  const groups = new Map();

  data
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .forEach((row, index) => {
      const lowerRow = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          String(key).toLowerCase(),
          value,
        ])
      );
      const groupValue =
        lowerRow[normalizedGroupBy] ||
        row[groupBy] ||
        row.project_code ||
        row.sample ||
        row.sample_id ||
        `sample_${index + 1}`;
      const groupKey = String(groupValue);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(row);
    });

  return [...groups.values()];
}

function lookupOfflineContextEntry(table, chromosomeNumber, startPosition) {
  if (!table) {
    return null;
  }

  const chromosome = normalizeChromosome(chromosomeNumber);
  const position = String(startPosition);
  const lookup = table.lookup || table.contexts || table;
  const candidateKeys = [
    `${chromosome}:${position}`,
    `chr${chromosome}:${position}`,
    `${chromosome}_${position}`,
    `chr${chromosome}_${position}`,
  ];

  for (const key of candidateKeys) {
    const value = lookup?.[key];
    const direct = lookupContextValue(value);
    if (direct) {
      return {
        context: direct,
        source:
          value && typeof value === "object" && value.source
            ? String(value.source)
            : "offline reference lookup",
      };
    }
  }

  const chromosomeLookup =
    lookup?.[chromosome] || lookup?.[`chr${chromosome}`] || table.chromosomes?.[chromosome] || table.chromosomes?.[`chr${chromosome}`];
  const value = chromosomeLookup?.[position];
  const context = lookupContextValue(value);
  if (!context) {
    return null;
  }
  return {
    context,
    source:
      value && typeof value === "object" && value.source
        ? String(value.source)
        : "offline reference lookup",
  };
}

function lookupOfflineContext(table, chromosomeNumber, startPosition) {
  return lookupOfflineContextEntry(table, chromosomeNumber, startPosition)?.context || null;
}

async function loadBundledContextLookupTable(genome) {
  const genomeKey = normalizeGenomeBuild(genome);
  const assetUrl = new URL(
    `./assets/context/${genomeKey}.trinucleotide-contexts.json`,
    import.meta.url
  );

  if (assetUrl.protocol === "file:") {
    try {
      const { readFile } = await import("node:fs/promises");
      return JSON.parse(await readFile(assetUrl, "utf8"));
    } catch (_error) {
      // Browser runtimes do not expose node:fs; fall through to fetch.
    }
  }

  if (typeof fetch !== "function") {
    throw new Error(
      "Bundled offline context tables require fetch support. Pass contextLookupTable directly in this runtime."
    );
  }

  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(
      `Offline context table for ${genomeKey} was not found at ${assetUrl.href}.`
    );
  }
  return response.json();
}

const SNV_VARIANT_TYPES = new Set([
  "snp",
  "snv",
  "single base substitution",
  "single_base_substitution",
  "single nucleotide variant",
  "substitution",
]);

const DBS_VARIANT_TYPES = new Set([
  "dnp",
  "dinucleotide",
  "doublet",
  "double base substitution",
  "double_base_substitution",
  "dbs",
]);

const INSERTION_VARIANT_TYPES = new Set(["ins", "insertion"]);
const DELETION_VARIANT_TYPES = new Set(["del", "deletion"]);

function cleanAllele(value) {
  const allele = String(value ?? "").trim().toUpperCase();
  return allele === "-" || allele === "." ? "" : allele;
}

function finiteInteger(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function rowValue(row, names) {
  for (const name of names) {
    const value = row?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function normalizeProfileRows(data, groupBy = "project_code", tcga = false) {
  const normalizedGroupBy = String(groupBy || "project_code").toLowerCase();
  const grouped = normalizeMafInputRows(data, normalizedGroupBy);
  const rows = [];

  grouped.forEach((patient, patientIndex) => {
    patient.forEach((rawRow, rowIndex) => {
      const nestedRawRow =
        rawRow?.raw && typeof rawRow.raw === "object" && !Array.isArray(rawRow.raw)
          ? Object.fromEntries(
              Object.entries(rawRow.raw).map(([key, value]) => [
                String(key).toLowerCase(),
                value,
              ])
            )
          : {};
      const lowerRow = {
        ...nestedRawRow,
        ...Object.fromEntries(
          Object.entries(rawRow || {}).map(([key, value]) => [
            String(key).toLowerCase(),
            value,
          ])
        ),
      };
      const sample =
        lowerRow[normalizedGroupBy] ||
        lowerRow.sample ||
        lowerRow.sample_id ||
        lowerRow.tumor_sample_barcode ||
        lowerRow.case_submitter_id ||
        `sample_${patientIndex + 1}`;
      const chromosome = normalizeChromosome(lowerRow.chromosome || lowerRow.chrom || lowerRow.chr);
      const startPosition = tcga
        ? lowerRow.chromosome_start
        : lowerRow.start_position || lowerRow.position || lowerRow.pos || lowerRow.start;
      const endPosition = tcga
        ? lowerRow.chromosome_end
        : lowerRow.end_position || lowerRow.end;
      const referenceAllele = tcga
        ? lowerRow.reference_genome_allele
        : lowerRow.reference_allele || lowerRow.ref;
      const alternateAllele = tcga
        ? lowerRow.mutated_to_allele
        : lowerRow.tumor_seq_allele2 || lowerRow.alternate_allele || lowerRow.alt;
      const variantType = tcga
        ? lowerRow.mutation_type
        : lowerRow.variant_type || lowerRow.variant_class || lowerRow.type;

      rows.push({
        raw: lowerRow,
        originalRow: rawRow,
        index: rows.length,
        rowIndex,
        sample: String(sample),
        chromosome,
        startPosition: finiteInteger(startPosition),
        endPosition: finiteInteger(endPosition),
        referenceAllele: cleanAllele(referenceAllele),
        alternateAllele: cleanAllele(alternateAllele),
        variantType: String(variantType || "").trim(),
        genome: lowerRow.build || lowerRow.ncbi_build || lowerRow.genome_build || null,
      });
    });
  });

  return rows;
}

function zeroSpectrum(contexts) {
  return Object.fromEntries((contexts || []).map((context) => [context, 0]));
}

function ensureSampleSpectrum(spectra, sample, contexts) {
  if (!spectra[sample]) {
    spectra[sample] = zeroSpectrum(contexts);
  }
  return spectra[sample];
}

function variantTypeIsSnv(value) {
  return SNV_VARIANT_TYPES.has(String(value || "").toLowerCase());
}

function variantTypeIsDbs(value) {
  return DBS_VARIANT_TYPES.has(String(value || "").toLowerCase());
}

function variantTypeIsInsertion(value) {
  return INSERTION_VARIANT_TYPES.has(String(value || "").toLowerCase());
}

function variantTypeIsDeletion(value) {
  return DELETION_VARIANT_TYPES.has(String(value || "").toLowerCase());
}

async function resolveReferenceContext(row, size, options) {
  const runtimeOptions = getRuntimeOptions(options);
  const localOnly = Boolean(options.offline || runtimeOptions.strictLocal);
  const lookupEntry = lookupOfflineContextEntry(
    options.contextLookupTable,
    row.chromosome,
    row.startPosition
  );
  const lookupSupplied = normalizeSequenceWindow(lookupEntry?.context, size);
  if (lookupSupplied) {
    return {
      context: lookupSupplied,
      source: lookupEntry.source || "offline reference lookup",
    };
  }

  const rowSupplied =
    getRowSuppliedContext(row.raw, size) ||
    getRowSuppliedContext(row.originalRow, size);
  if (rowSupplied) {
    return {
      context: rowSupplied,
      source: "row-supplied context",
    };
  }

  if (!row.chromosome || !row.startPosition) {
    return {
      context: null,
      source: "missing",
    };
  }

  try {
    const sequence = await getMutationalContext(
      row.chromosome,
      row.genome || options.genome || "hg19",
      row.startPosition,
      {
        offline: localOnly,
        strictLocal: runtimeOptions.strictLocal,
        contextLookupTable: options.contextLookupTable,
        contextSize: size,
      }
    );
    return {
      context: normalizeSequenceWindow(sequence, size),
      source: localOnly ? "offline reference lookup" : "live reference lookup",
    };
  } catch (error) {
    if (runtimeOptions.strictLocal) {
      throw error;
    }
    return {
      context: null,
      source: "missing",
    };
  }
}

function sbsContextLabel(standardizedContext, standardizedSubstitution) {
  if (!standardizedContext || !standardizedSubstitution) {
    return null;
  }
  if (standardizedContext.length === 3) {
    return `${standardizedContext[0]}[${standardizedSubstitution}]${standardizedContext[2]}`.toUpperCase();
  }
  if (standardizedContext.length === 5) {
    return `${standardizedContext[0]}${standardizedContext[1]}[${standardizedSubstitution}]${standardizedContext[3]}${standardizedContext[4]}`.toUpperCase();
  }
  return null;
}

async function buildSbsTraceRow(row, profileDefinition, options) {
  const size = Number(profileDefinition.matrix) === 1536 ? 5 : 3;
  const contexts = profileDefinition.contexts || [];
  const ref = row.referenceAllele;
  const alt = row.alternateAllele;
  const alleleOk = /^[ACGT]$/.test(ref) && /^[ACGT]$/.test(alt);
  const variantTypeOk = variantTypeIsSnv(row.variantType);
  const contextResult = await resolveReferenceContext(row, size, options);
  const referenceContext = contextResult.context;
  const centerBase = referenceContext?.[Math.floor(referenceContext.length / 2)];
  const referenceMatchesContext = Boolean(referenceContext && centerBase === ref);
  const normalizedContext = referenceContext
    ? standardize_sequence_context(referenceContext, size)
    : null;
  const normalizedSubstitution = alleleOk ? standardize_substitution(ref, alt) : null;
  const finalBin = sbsContextLabel(normalizedContext, normalizedSubstitution);
  let skippedReason = "";

  if (!row.chromosome || !row.startPosition) {
    skippedReason = "missing coordinate";
  } else if (!variantTypeOk) {
    skippedReason = "not a single-nucleotide variant";
  } else if (!alleleOk) {
    skippedReason = "ref/alt are not single A/C/G/T bases";
  } else if (!referenceContext) {
    skippedReason = `missing ${size}-base reference context`;
  } else if (!referenceMatchesContext) {
    skippedReason = "reference allele does not match context center";
  } else if (!finalBin || !contexts.includes(finalBin) || finalBin.includes("N")) {
    skippedReason = `final ${profileDefinition.key} bin is not valid`;
  }

  return {
    profileKey: profileDefinition.key,
    index: row.index,
    rowIndices: [row.index],
    sample: row.sample,
    chromosome: row.chromosome,
    start_position: row.startPosition,
    ref,
    alt,
    variantType: row.variantType,
    originalChange: alleleOk ? `${ref}>${alt}` : `${ref || "?"}>${alt || "?"}`,
    originalSubstitution: alleleOk ? `${ref}>${alt}` : `${ref || "?"}>${alt || "?"}`,
    lookupKey: `${row.chromosome || "?"}:${row.startPosition || "?"}`,
    referenceContext,
    contextSource: contextResult.source,
    referenceMatchesContext,
    purineReference: /^[AG]$/.test(ref),
    reverseComplementContext: referenceContext ? reverseComplement(referenceContext) : null,
    normalizedContext,
    normalizedSubstitution,
    finalBin,
    counted: !skippedReason,
    skippedReason,
    row: row.originalRow || row.raw,
  };
}

function standardizeDbsContext(referenceAlleles, alternateAlleles, contexts) {
  const ref = cleanAllele(referenceAlleles);
  const alt = cleanAllele(alternateAlleles);
  if (!/^[ACGT]{2}$/.test(ref) || !/^[ACGT]{2}$/.test(alt) || ref === alt) {
    return null;
  }
  const direct = `${ref}>${alt}`;
  if (contexts.includes(direct)) {
    return direct;
  }
  const complemented = `${reverseComplement(ref)}>${reverseComplement(alt)}`;
  return contexts.includes(complemented) ? complemented : null;
}

function buildDbsTraceRow(rows, profileDefinition) {
  const [firstRow, secondRow = null] = rows;
  const contexts = profileDefinition.contexts || [];
  const ref = secondRow
    ? `${firstRow.referenceAllele}${secondRow.referenceAllele}`
    : firstRow.referenceAllele;
  const alt = secondRow
    ? `${firstRow.alternateAllele}${secondRow.alternateAllele}`
    : firstRow.alternateAllele;
  const finalBin = standardizeDbsContext(ref, alt, contexts);
  let skippedReason = "";

  if (!finalBin) {
    skippedReason = secondRow
      ? "adjacent SNV pair is not a valid DBS78 substitution"
      : "not a valid dinucleotide substitution";
  }

  return {
    profileKey: profileDefinition.key,
    index: firstRow.index,
    rowIndices: rows.map((row) => row.index),
    sample: firstRow.sample,
    chromosome: firstRow.chromosome,
    start_position: firstRow.startPosition,
    ref,
    alt,
    variantType: secondRow ? "paired adjacent SNVs" : firstRow.variantType,
    originalChange: `${ref || "?"}>${alt || "?"}`,
    originalSubstitution: `${ref || "?"}>${alt || "?"}`,
    lookupKey: secondRow
      ? `${firstRow.chromosome || "?"}:${firstRow.startPosition || "?"}-${secondRow.startPosition || "?"}`
      : `${firstRow.chromosome || "?"}:${firstRow.startPosition || "?"}`,
    referenceContext: ref,
    contextSource: secondRow ? "adjacent SNV pair" : "DNP row",
    finalBin,
    counted: !skippedReason,
    skippedReason,
    row: secondRow ? rows.map((row) => row.originalRow || row.raw) : firstRow.originalRow || firstRow.raw,
  };
}

function buildSkippedProfileTraceRow(row, profileDefinition, skippedReason) {
  return {
    profileKey: profileDefinition.key,
    index: row.index,
    rowIndices: [row.index],
    sample: row.sample,
    chromosome: row.chromosome,
    start_position: row.startPosition,
    ref: row.referenceAllele,
    alt: row.alternateAllele,
    variantType: row.variantType,
    originalChange: `${row.referenceAllele || "-"}>${row.alternateAllele || "-"}`,
    originalSubstitution: `${row.referenceAllele || "-"}>${row.alternateAllele || "-"}`,
    lookupKey: `${row.chromosome || "?"}:${row.startPosition || "?"}`,
    referenceContext: null,
    contextSource: "not used by selected profile",
    finalBin: null,
    counted: false,
    skippedReason,
    row: row.originalRow || row.raw,
  };
}

function buildDbsTrace(rows, profileDefinition) {
  const traces = [];
  const representedRows = new Set();
  const pairedRows = new Set();
  const usedSnvRows = new Set();
  const directRows = rows.filter(
    (row) =>
      variantTypeIsDbs(row.variantType) ||
      (/^[ACGT]{2}$/.test(row.referenceAllele) && /^[ACGT]{2}$/.test(row.alternateAllele))
  );

  directRows.forEach((row) => {
    traces.push(buildDbsTraceRow([row], profileDefinition));
    representedRows.add(row.index);
  });

  const snvRows = rows
    .filter(
      (row) =>
        variantTypeIsSnv(row.variantType) &&
        /^[ACGT]$/.test(row.referenceAllele) &&
        /^[ACGT]$/.test(row.alternateAllele) &&
        row.chromosome &&
        Number.isFinite(row.startPosition)
    )
    .sort((a, b) =>
      a.sample.localeCompare(b.sample) ||
      String(a.chromosome).localeCompare(String(b.chromosome)) ||
      a.startPosition - b.startPosition
    );

  for (let index = 0; index < snvRows.length - 1; index += 1) {
    const current = snvRows[index];
    const next = snvRows[index + 1];
    if (
      usedSnvRows.has(current.index) ||
      usedSnvRows.has(next.index) ||
      current.sample !== next.sample ||
      current.chromosome !== next.chromosome ||
      next.startPosition !== current.startPosition + 1
    ) {
      continue;
    }
    const trace = buildDbsTraceRow([current, next], profileDefinition);
    pairedRows.add(current.index);
    pairedRows.add(next.index);
    if (trace.counted) {
      usedSnvRows.add(current.index);
      usedSnvRows.add(next.index);
    }
    traces.push(trace);
  }

  rows.forEach((row) => {
    if (representedRows.has(row.index) || pairedRows.has(row.index)) {
      return;
    }
    const isSingleSnv =
      variantTypeIsSnv(row.variantType) &&
      /^[ACGT]$/.test(row.referenceAllele) &&
      /^[ACGT]$/.test(row.alternateAllele);
    const skippedReason = isSingleSnv
      ? "single SNV is not paired with an adjacent SNV"
      : "not an explicit DNP or adjacent SNV pair";
    traces.push(buildSkippedProfileTraceRow(row, profileDefinition, skippedReason));
  });

  return traces.sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
}

function firstFiniteField(row, fields, { subtractOne = false } = {}) {
  for (const field of fields) {
    const value = finiteInteger(row.raw?.[field] ?? row.originalRow?.[field]);
    if (value !== null) {
      return Math.max(0, Math.min(5, subtractOne ? value - 1 : value));
    }
  }
  return null;
}

function normalizeIndelBase(sequence) {
  const base = cleanAllele(sequence)[0];
  if (base === "C" || base === "T") {
    return base;
  }
  if (base === "A" || base === "G") {
    return reverseComplement(base);
  }
  return null;
}

function getDirectId83Context(row, contexts) {
  const value = rowValue(row.raw, [
    "id83_context",
    "id83_bin",
    "cosmic_indel_context",
    "indel_context",
  ]);
  const context = value ? String(value).trim() : "";
  return contexts.includes(context) ? context : null;
}

function inferIndelEvent(row) {
  const ref = row.referenceAllele;
  const alt = row.alternateAllele;
  const type = String(row.variantType || "").toLowerCase();

  if (variantTypeIsInsertion(type) || (!ref && alt) || (alt.length > ref.length && alt.startsWith(ref))) {
    return {
      kind: "Ins",
      sequence: alt.startsWith(ref) ? alt.slice(ref.length) : alt,
    };
  }
  if (variantTypeIsDeletion(type) || (ref && !alt) || (ref.length > alt.length && ref.startsWith(alt))) {
    return {
      kind: "Del",
      sequence: ref.startsWith(alt) ? ref.slice(alt.length) : ref,
    };
  }
  return null;
}

function buildId83TraceRow(row, profileDefinition) {
  const contexts = profileDefinition.contexts || [];
  const directContext = getDirectId83Context(row, contexts);
  const event = inferIndelEvent(row);
  let finalBin = directContext;
  let skippedReason = "";

  if (!finalBin && event) {
    const length = Math.max(1, Math.min(5, cleanAllele(event.sequence).length));
    if (length === 1) {
      const base = normalizeIndelBase(event.sequence);
      const repeatIndex =
        firstFiniteField(row, ["repeat_index", "homopolymer_index", "id_repeat_index"]) ??
        firstFiniteField(row, ["repeat_count", "repeat_length", "homopolymer_length", "repeat_units"], { subtractOne: true }) ??
        0;
      finalBin = base ? `1:${event.kind}:${base}:${repeatIndex}` : null;
    } else {
      const microhomology =
        event.kind === "Del"
          ? firstFiniteField(row, ["microhomology", "microhomology_length", "mh_length"])
          : null;
      const repeatIndex =
        firstFiniteField(row, ["repeat_index", "repeat_units", "repeat_count"]) ?? 0;
      if (microhomology && event.kind === "Del") {
        finalBin = `${length}:Del:M:${Math.max(1, Math.min(5, microhomology))}`;
      } else {
        finalBin = `${length}:${event.kind}:R:${repeatIndex}`;
      }
    }
  }

  if (!event && !directContext) {
    skippedReason = "not an insertion or deletion";
  } else if (!finalBin || !contexts.includes(finalBin)) {
    skippedReason = "insertion/deletion annotation is not a valid ID83 bin";
  }

  return {
    profileKey: profileDefinition.key,
    index: row.index,
    rowIndices: [row.index],
    sample: row.sample,
    chromosome: row.chromosome,
    start_position: row.startPosition,
    ref: row.referenceAllele,
    alt: row.alternateAllele,
    variantType: row.variantType,
    originalChange: `${row.referenceAllele || "-"}>${row.alternateAllele || "-"}`,
    originalSubstitution: `${row.referenceAllele || "-"}>${row.alternateAllele || "-"}`,
    referenceContext: event?.sequence || directContext || null,
    contextSource: directContext ? "row-supplied ID83 bin" : "MAF indel alleles",
    finalBin,
    counted: !skippedReason,
    skippedReason,
    row: row.originalRow || row.raw,
  };
}

function buildProfileAudit(profileKeyValue, traces, spectra, sourceRows = null) {
  const countedEvents = traces.filter((row) => row.counted).length;
  const countedSourceRowIndices = new Set(
    traces
      .filter((row) => row.counted)
      .flatMap((row) => row.rowIndices || [row.index])
  );
  const inputRows = Array.isArray(sourceRows) ? sourceRows.length : traces.length;
  const skippedRows = Math.max(0, inputRows - countedSourceRowIndices.size);
  const samples = Object.keys(spectra || {});
  return {
    profileKey: profileKeyValue,
    inputRows,
    countedRows: countedSourceRowIndices.size,
    countedEvents,
    skippedRows,
    samples: samples.map((sample) => {
      const total = Object.values(spectra[sample] || {}).reduce(
        (sum, value) => sum + Number(value || 0),
        0
      );
      const sourceRowsForSample = Array.isArray(sourceRows)
        ? sourceRows.filter((row) => row.sample === sample)
        : traces.filter((row) => row.sample === sample);
      const countedRowsForSample = new Set(
        traces
          .filter((row) => row.sample === sample && row.counted)
          .flatMap((row) => row.rowIndices || [row.index])
      );
      return {
        sample,
        inputRows: sourceRowsForSample.length,
        countedRows: countedRowsForSample.size,
        countedEvents: traces.filter((row) => row.sample === sample && row.counted).length,
        spectrumTotal: total,
        nonZeroContexts: Object.values(spectra[sample] || {}).filter((value) => Number(value) > 0).length,
        countCheck: total === traces.filter((row) => row.sample === sample && row.counted).length ? "pass" : "review",
      };
    }),
  };
}

async function convertProfileRows(rows, profileDefinition, options) {
  const spectra = {};
  const contexts = profileDefinition.contexts || [];
  let trace = [];

  if (profileDefinition.key.startsWith("SBS")) {
    for (const row of rows) {
      trace.push(await buildSbsTraceRow(row, profileDefinition, options));
    }
  } else if (profileDefinition.key === "DBS78") {
    trace = buildDbsTrace(rows, profileDefinition);
  } else if (profileDefinition.key === "ID83") {
    trace = rows.map((row) => buildId83TraceRow(row, profileDefinition));
  }

  for (const traceRow of trace) {
    const sampleSpectrum = ensureSampleSpectrum(spectra, traceRow.sample, contexts);
    if (traceRow.counted && traceRow.finalBin) {
      sampleSpectrum[traceRow.finalBin] = Number(sampleSpectrum[traceRow.finalBin] || 0) + 1;
    }
  }

  return {
    spectra,
    trace,
    audit: buildProfileAudit(profileDefinition.key, trace, spectra, rows),
  };
}

/**
 * Converts MAF-like rows into one or more COSMIC-style profile matrices.
 *
 * @async
 * @function convertMafToProfileSpectra
 * @memberof userData
 * @param {Array<Object>|Array<Array<Object>>} data - Flat or nested MAF-like rows.
 * @param {Object} [options] - Conversion options.
 * @param {Array<string|Object>} [options.profiles=["SBS96"]] - Profile keys or profile/matrix objects.
 * @param {string} [options.groupBy="project_code"] - Field used to group spectra.
 * @param {string} [options.genome="hg19"] - Reference genome build for context lookup.
 * @param {boolean} [options.tcga=false] - Whether to read TCGA-specific MAF fields.
 * @param {boolean} [options.offline=false] - Use row-supplied or lookup-table context.
 * @param {boolean} [options.strictLocal=false] - Block live reference lookups and use only row/bundled/offline context.
 * @param {Object} [options.contextLookupTable=null] - Position-indexed context lookup table.
 * @returns {Promise<Object>} Profile-keyed spectra, trace, audit, warnings, and registry metadata.
 */
async function convertMafToProfileSpectra(data, options = {}) {
  const runtimeOptions = getRuntimeOptions(options);
  const {
    profiles = ["SBS96"],
    groupBy = "project_code",
    genome = "hg19",
    tcga = false,
    offline = false,
    contextLookupTable = null,
  } = options;
  const requestedProfiles = (Array.isArray(profiles) ? profiles : [profiles])
    .map(normalizeProfileRequest)
    .map((profile) => getProfileDefinition(profile))
    .filter(Boolean);
  const profileDefinitions = requestedProfiles.length
    ? requestedProfiles
    : [getProfileDefinition({ profile: "SBS", matrix: 96 })];
  const rows = normalizeProfileRows(data, groupBy, tcga);
  const spectraByProfile = {};
  const traceByProfile = {};
  const profileAudits = {};
  const warnings = [];
  let offlineContextLookupTable = contextLookupTable;
  const localOnly = Boolean(offline || runtimeOptions.strictLocal);

  if (localOnly && !offlineContextLookupTable) {
    offlineContextLookupTable = await loadBundledContextLookupTable(genome);
  }

  for (const definition of profileDefinitions) {
    if (definition.conversionSupport !== "native_maf") {
      warnings.push({
        level: "warning",
        code: "profile_requires_annotated_input",
        profileKey: definition.key,
        message: `${definition.key} requires ${definition.inputKind} input and is not derived from generic MAF rows.`,
      });
      continue;
    }

    const result = await convertProfileRows(rows, definition, {
      ...options,
      genome,
      offline: localOnly,
      strictLocal: runtimeOptions.strictLocal,
      contextLookupTable: offlineContextLookupTable,
    });
    spectraByProfile[definition.key] = result.spectra;
    traceByProfile[definition.key] = result.trace;
    profileAudits[definition.key] = result.audit;

    if (result.audit.countedRows === 0 && rows.length > 0) {
      warnings.push({
        level: "warning",
        code: "profile_no_counted_rows",
        profileKey: definition.key,
        message: `${definition.key} conversion did not count any rows; review input requirements and skipped-row reasons.`,
      });
    }
  }

  return {
    schemaVersion: "msig.maf_profile_conversion.v0.1",
    profiles: profileDefinitions.map((definition) => definition.key),
    supportedMafProfiles: listMafConvertibleProfiles().map((definition) => definition.key),
    spectraByProfile,
    traceByProfile,
    audit: {
      inputRows: rows.length,
      profiles: profileAudits,
    },
    warnings,
    profileRegistry: profileDefinitions.map((definition) => ({
      key: definition.key,
      profile: definition.profile,
      matrix: definition.matrix,
      conversionSupport: definition.conversionSupport,
      inputKind: definition.inputKind,
      requiredFields: definition.requiredFields,
      contextRequirement: definition.contextRequirement,
      contextCount: definition.contexts?.length ?? null,
      renderer: definition.renderer,
    })),
  };
}

/**
 * Converts MAF-like input into a backward-compatible SBS96 mutational spectrum.
 *
 * This wrapper delegates to convertMafToProfileSpectra with the SBS96 target and
 * returns the legacy sample-by-context matrix shape. Use convertMafToProfileSpectra
 * for SBS1536, DBS78, ID83, trace, audit, and multi-profile conversion output.
 *
 * @async
 * @function convertMatrix
 * @memberof userData
 * @param {Array<Object>|Array<Array<Object>>} data - Flat MAF-like rows or nested patient-level mutational data.
 * Each row contains mutational details (e.g., chromosome, position, mutation type).
 * @param {string} [group_by="Center"] - Field to group data by (e.g., "Center" or "sample_id"). This field should exist in the input data.
 * @param {number} [batch_size=100] - Number of mutations to process in parallel batches. Adjust this for memory management.
 * @param {string} [genome="hg19"] - Reference genome build. Defaults to "hg19" unless specified in the data.
 * @param {boolean} [tcga=false] - Flag indicating whether the input data is in TCGA format. If true, expects TCGA-specific fields.
 * @param {Object} [options={}] - Context lookup options.
 * @param {boolean} [options.offline=false] - Use row-supplied or lookup-table contexts instead of the UCSC sequence API.
 * @param {boolean} [options.strictLocal=false] - Block live UCSC context lookups.
 * @param {Object} [options.contextLookupTable=null] - Position-indexed trinucleotide lookup table.
 * @returns {Promise<Object>} - A promise resolving to a sample-keyed SBS96 matrix.
 *
 * @example
 * // Example input data
 * const data = [
 *   [
 *     { chromosome: "1", start_position: "12345", reference_allele: "C", tumor_seq_allele2: "T", variant_type: "SNP", build: "hg19", Center: "CNIC" },
 *     { chromosome: "2", start_position: "67890", reference_allele: "G", tumor_seq_allele2: "A", variant_type: "SNP", build: "hg19", Center: "CNIC" }
 *   ],
 *   [
 *     { chromosome: "3", start_position: "101112", reference_allele: "T", tumor_seq_allele2: "C", variant_type: "SNP", build: "hg19", Center: "OtherCenter" }
 *   ]
 * ];
 *
 * // Convert data to mutational spectra grouped by Center
 * const mutationalSpectra = await convertMatrix(data, "Center", 50, "hg19", false);
 * console.log(mutationalSpectra);
 * // Output:
 * // {
 * //   "CNIC": {
 * //     "A[C>A]A": 9,
 * //     "A[C>A]C": 7,
 * //     "A[C>A]G": 6,
 * //     ...
 * //   },
 * //   "OtherCenter": {
 * //     "T[T>C]A": 15,
 * //     "T[T>C]T": 8,
 * //     ...
 * //   }
 * // }
 */

async function convertMatrix(
  data,
  group_by = "project_code",
  batch_size = 100,
  genome = "hg19",
  tcga = false,
  options = {}
) {
  const profileConversion = await convertMafToProfileSpectra(data, {
    profiles: ["SBS96"],
    groupBy: group_by,
    batchSize: batch_size,
    genome,
    tcga,
    ...(typeof options === "boolean" ? { offline: options } : options || {}),
  });
  return profileConversion.spectraByProfile.SBS96 || {};

  const mutationalSpectra = {};
  group_by = group_by.toLowerCase();
  const contextOptions =
    typeof options === "boolean" ? { offline: options } : options || {};
  let offlineContextLookupTable = contextOptions.contextLookupTable || null;

  if (contextOptions.offline && !offlineContextLookupTable) {
    offlineContextLookupTable = await loadBundledContextLookupTable(genome);
  }

  for (let patient of normalizeMafInputRows(data, group_by)) {
    // Convert all keys to lowercase for consistency
    patient = patient.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
      )
    );

    // Initialize a mutational spectrum for each 'patient' group
    let mutationalSpectrum = init_sbs_mutational_spectra();
    let promises = [];

    for (let i = 0; i < patient.length; i++) {
      // If patient[i]['build'] exists, use it to determine the genome
      // Otherwise, use the 'genome' argument or default to "hg19"
      if (patient[i]["build"]) {
        genome = patient[i]["build"];
      } else if (!genome) {
        genome = "hg19";
      }

      let chromosomeNumber;
      let referenceAllele;
      let mutatedTo;
      let position;
      let variantType;

      // Use a proper comparison or a simple "if (!tcga)" check
      if (!tcga) {
        chromosomeNumber = patient[i]["chromosome"];
        chromosomeNumber = normalizeChromosome(chromosomeNumber);
        referenceAllele = patient[i]["reference_allele"];
        mutatedTo = patient[i]["tumor_seq_allele2"];
        position = patient[i]["start_position"];
        variantType = patient[i]["variant_type"];
      } else {
        chromosomeNumber = normalizeChromosome(patient[i]["chromosome"]);
        referenceAllele = patient[i]["reference_genome_allele"];
        mutatedTo = patient[i]["mutated_to_allele"];
        position = patient[i]["chromosome_start"];
        variantType = patient[i]["mutation_type"];
      }

      // Check if chromosomeNumber, genome, and position are defined
      if (chromosomeNumber === null ||chromosomeNumber === undefined || genome === undefined || position === undefined) {
        console.log(patient[i]["chromosome"]);
        console.log(`Missing values at index ${i}:`, {
          chromosomeNumber,
          genome,
          position
        });
        continue; // Skip this iteration if any value is missing. This is usually due to the chromosomeNumber being a sex chromosome
      }

      const rowSuppliedContext = getRowSuppliedContext(patient[i]);

      // Get the trinucleotide context for this mutation
      let promise = Promise.resolve(
        rowSuppliedContext ||
          getMutationalContext(chromosomeNumber, genome, parseInt(position), {
            offline: Boolean(contextOptions.offline),
            contextLookupTable: offlineContextLookupTable,
          })
      )
        .then((sequence) => {
          if (sequence === undefined) {
            console.log(`Undefined sequence for chromosome ${chromosomeNumber}, genome ${genome}, position ${position}`);
          }
          sequence = standardize_trinucleotide(sequence);

          const fivePrime = sequence[0];
          const threePrime = sequence[2];
          referenceAllele = String(referenceAllele || "").toUpperCase();
          mutatedTo = String(mutatedTo || "").toUpperCase();
          const standardizedSubstitution = standardize_substitution(referenceAllele, mutatedTo);
          const mutationType = `${fivePrime}[${standardizedSubstitution}]${threePrime}`.toUpperCase();
          const normalizedVariantType = String(variantType || "").toLowerCase();

          // Only count valid single base substitutions
          if (
            (normalizedVariantType === "snp" ||
              normalizedVariantType === "single base substitution" ||
              normalizedVariantType === "single_base_substitution") &&
            /^[ACGT]$/.test(referenceAllele) &&
            /^[ACGT]$/.test(mutatedTo) &&
            !mutationType.includes("N") &&
            !mutationType.includes("U")
          ) {
            mutationalSpectrum[mutationType] = Number(mutationalSpectrum[mutationType]) + 1;
          }
        })
        .catch((error) => {
          console.error(`Error fetching sequence for chromosome ${chromosomeNumber}, genome ${genome}, position ${position}:`, error);
        });

      promises.push(promise);

      // Batch processing to avoid too many parallel requests
      if (promises.length >= batch_size || i === patient.length - 1) {
        await Promise.all(promises);
        promises = [];
      }
    }

    // Use the patient's group_by field (e.g., project_code) as the key
    mutationalSpectra[patient[0][group_by]] = mutationalSpectrum;
  }

  return mutationalSpectra;
}

async function getMutationalContext(
  chromosomeNumber,
  genome,
  startPosition,
  options = {}
) {
  const runtimeOptions = getRuntimeOptions(options);
  const {
    offline = false,
    contextLookupTable = null,
    contextSize = 3,
  } = options || {};
  const requestedContextSize = Number(contextSize) || 3;
  if (offline) {
    const sequence = lookupOfflineContext(
      contextLookupTable,
      chromosomeNumber,
      startPosition
    );
    if (!sequence) {
      if (runtimeOptions.strictLocal) {
        throw new Error(
          `strictLocal could not resolve a bundled/offline ${requestedContextSize}-base context for ${normalizeGenomeBuild(genome)} chromosome ${chromosomeNumber} position ${startPosition}. Add a row-supplied trinucleotide_context/context_sequence value or pass a contextLookupTable that contains this coordinate.`
        );
      }
      throw new Error(
        `No offline ${requestedContextSize}-base context for ${normalizeGenomeBuild(genome)} chromosome ${chromosomeNumber} position ${startPosition}.`
      );
    }
    const normalized = normalizeSequenceWindow(sequence, requestedContextSize);
    if (!normalized) {
      if (runtimeOptions.strictLocal) {
        throw new Error(
          `strictLocal could not normalize the bundled/offline ${requestedContextSize}-base context for ${normalizeGenomeBuild(genome)} chromosome ${chromosomeNumber} position ${startPosition}. Add a row-supplied trinucleotide_context/context_sequence value or pass a valid contextLookupTable entry.`
        );
      }
      throw new Error(
        `No offline ${requestedContextSize}-base context for ${normalizeGenomeBuild(genome)} chromosome ${chromosomeNumber} position ${startPosition}.`
      );
    }
    return normalized;
  }

  assertNoUserDataEgress(
    "UCSC reference context lookup",
    runtimeOptions,
    "Chromosome and coordinate values would be sent in the URL; supply row contexts or a bundled/offline contextLookupTable."
  );

  const chrName = String(chromosomeNumber);
  const genomeKey = normalizeGenomeBuild(genome);
  const flank = Math.floor(requestedContextSize / 2) || 1;
  const startByte = startPosition - flank - 1;
  const endByteExclusive = startPosition + flank;

  const alternative = await (
    await fetchURLAndCache("HG19",
      `https://api.genome.ucsc.edu/getData/sequence?genome=${genomeKey};chrom=chr${chrName};start=${startByte};end=${endByteExclusive
      }`,
      null,
      null,
      runtimeOptions
    )
  ).json();

  const sequence = alternative.dna;
  const normalized = normalizeSequenceWindow(sequence, requestedContextSize);
  if (!normalized) {
    throw new Error(
      `No live ${requestedContextSize}-base context for ${genomeKey} chromosome ${chromosomeNumber} position ${startPosition}.`
    );
  }
  return normalized;
}


export {
  get_sbs_trinucleotide_contexts,
  standardize_substitution,
  init_sbs_mutational_spectra,
  standardize_trinucleotide,
  standardize_sequence_context,
  normalizeSequenceWindow,
  normalizeSequenceContext,
  normalizeChromosome,
  convertMatrix,
  convertMafToProfileSpectra,
  getMutationalContext,
};
