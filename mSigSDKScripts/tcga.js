const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

import {
  assertNoUserDataEgress,
  debugLog,
  debugWarn,
  fetchURLAndCache,
  getRuntimeOptions,
} from "./utils.js";

import { convertMatrix, normalizeSequenceContext } from "./mutationalSpectrum.js";
// Browser ESM dynamic imports do not provide a portable SRI hook; the exact
// version is pinned and bundled package artifacts are hash-verified separately.
import * as pako from "https://cdn.jsdelivr.net/npm/pako@2.1.0/+esm";

function parseTsvObjects(text) {
  const lines = String(text || "")
    .replaceAll("\r", "")
    .split("\n")
    .filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return [];
  }

  const header = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(
      header.map((column, index) => [column, values[index] ?? ""])
    );
  });
}

function firstValue(row, candidates, fallback = "") {
  for (const candidate of candidates) {
    if (row[candidate] !== undefined && row[candidate] !== "") {
      return row[candidate];
    }
  }
  return fallback;
}

function daysToYears(value) {
  const days = Number(value);
  return Number.isFinite(days) ? Number((days / 365).toPrecision(3)) : null;
}

function normalizeGdcGenomeBuild(value) {
  const build = String(value || "").trim().toLowerCase();
  if (build.includes("37") || build.includes("hg19") || build.includes("grch37")) {
    return "hg19";
  }
  if (build.includes("38") || build.includes("hg38") || build.includes("grch38")) {
    return "hg38";
  }
  return "";
}

function makeHeaderIndex(header) {
  const index = new Map();
  header.forEach((column, columnIndex) => {
    index.set(String(column || "").trim().toLowerCase(), columnIndex);
  });
  return index;
}

function firstColumnValue(values, headerIndex, candidates, fallback = "") {
  for (const candidate of candidates) {
    const index = headerIndex.get(String(candidate).toLowerCase());
    const value = index === undefined ? undefined : values[index];
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return fallback;
}

function parseGdcMafRows(text, { project, fileId }) {
  const lines = String(text || "")
    .replaceAll("\r", "")
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"));
  if (lines.length < 2) {
    return [];
  }

  const header = lines[0].split("\t");
  const headerIndex = makeHeaderIndex(header);
  const rows = [];

  for (const line of lines.slice(1)) {
    const values = line.split("\t");
    const build = normalizeGdcGenomeBuild(
      firstColumnValue(values, headerIndex, ["NCBI_Build", "Genome_Build"])
    );
    if (!build) {
      continue;
    }

    const chromosome = firstColumnValue(values, headerIndex, ["Chromosome"]);
    const referenceAllele = String(firstColumnValue(values, headerIndex, [
      "Reference_Allele",
    ])).toUpperCase();
    const alternateAllele = String(firstColumnValue(values, headerIndex, [
      "Tumor_Seq_Allele2",
      "Tumor_Seq_Allele1",
      "Allele",
    ])).toUpperCase();
    const position = firstColumnValue(values, headerIndex, [
      "Start_Position",
      "Chromosome_Start",
    ]);
    const variantType = firstColumnValue(values, headerIndex, [
      "Variant_Type",
      "VARIANT_CLASS",
    ]);
    const context = normalizeSequenceContext(
      firstColumnValue(values, headerIndex, [
        "CONTEXT",
        "trinucleotide_context",
        "trinucleotide",
        "sequence_context",
        "context_sequence",
      ])
    );

    const row = {
      project_code: project,
      sample: fileId,
      build,
      chromosome: String(chromosome || "").toLowerCase().replace(/^chr/, ""),
      reference_genome_allele: referenceAllele,
      mutated_to_allele: alternateAllele,
      chromosome_start: position,
      mutation_type: variantType,
      mutation_classification: firstColumnValue(values, headerIndex, [
        "Variant_Classification",
        "One_Consequence",
        "Consequence",
      ]),
    };

    if (context) {
      row.trinucleotide_context = context;
    }

    rows.push(row);
  }

  return rows;
}

async function mapWithConcurrency(items, mapper, concurrency = 4) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(
    Math.max(1, Math.round(Number(concurrency) || 1)),
    items.length
  );

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    })
  );

  return results;
}

function emitProgress(onProgress, payload) {
  if (typeof onProgress !== "function") {
    return;
  }
  try {
    onProgress(payload);
  } catch (error) {
    console.warn("TCGA progress callback failed.", error);
  }
}

/**
 * Obtain projects by gene
 *
 * @async
 * @function getProjectsByGene
 * @memberof tcga
 *
 * @param {array} genes List with the genes of interest (ensemble id)
 *
 * @returns {Object} Object containing the list of projects in which the genes are over/under expressed and the list of projects organized by genes
 *
 * @example
 * let tcga = await import('https://raw.githubusercontent.com/YasCoMa/msig/main/mSigSDKScripts/tcga.js')
 * let genes = ['ENSG00000155657']
 * var result = await tcga.getProjectsByGene(genes)
 */
async function getProjectsByGene(genes, options = {}) {
  const runtimeOptions = getRuntimeOptions(options);
  assertNoUserDataEgress(
    "GDC gene-to-project query",
    runtimeOptions,
    "Gene IDs are sent in the GDC query string; use local project metadata in strictLocal mode."
  );
  var dat = {};
  var projects = [];

  var i = 0;
  var ide = genes;
  var info = [];
  while (i < ide.length) {
    var end = i + 15 <= ide.length ? i + 15 : ide.length;
    var temp = ide.slice(i, end);
    info = info.concat(
      await Promise.all(
        temp.map(async (g) => {
          var url = `https://api.gdc.cancer.gov/analysis/top_cases_counts_by_genes?gene_ids=${g}`;
          var data = await fetchURLAndCache("TCGA", url, null, null, runtimeOptions);
          data = await data.json();
          var temp = [];
          for (var p of data["aggregations"]["projects"]["buckets"]) {
            if (!temp.includes(p["key"])) {
              temp.push(p["key"]);
            }
            if (!projects.includes(p["key"])) {
              projects.push(p["key"]);
            }
          }
          dat[g] = temp;

          await sleep(300);
          return url;
        })
      )
    );

    i += 15;
    if (i >= ide.length) {
      break;
    }
  }

  var result = { projects: projects, projects_by_gene: dat };
  return result;
}

/**
 * Obtain tpm count of a list of genes in the sample files of the selected projects
 *
 * @async
 * @function getTpmCountsByGenesOnProjects
 * @memberof tcga
 *
 * @param {array} genes List with the genes of interest (ensemble id)
 * @param {array} projects List with the projects of interest
 *
 * @returns {Object} Object containing the list of count file ids and file descriptions organized by projects
 *
 * @example
 * let genes = ['ENSG00000155657']
 * let projects = ['TCGA-LUSC', 'TCGA-OV']
 * var result = await tcga.getTpmCountsByGenesOnProjects(genes, projects)
 */
async function getTpmCountsByGenesOnProjects(genes, projects, options = {}) {
  const runtimeOptions = getRuntimeOptions(options);
  assertNoUserDataEgress(
    "GDC TPM file query by project",
    runtimeOptions,
    "Project IDs are sent in the POST body; use local GDC metadata in strictLocal mode."
  );
  var result = {};

  var i = 0;
  var ide = projects;
  var info = [];
  while (i < ide.length) {
    var end = i + 15 <= ide.length ? i + 15 : ide.length;
    var temp = ide.slice(i, end);
    info = info.concat(
      await Promise.all(
        temp.map(async (p) => {
          result[p] = {};

          var query = {
            filters: {
              op: "and",
              content: [
                {
                  op: "in",
                  content: {
                    field: "cases.project.project_id",
                    value: [p],
                  },
                },
                {
                  op: "=",
                  content: {
                    field: "data_type",
                    value: "Gene Expression Quantification",
                  },
                },
                {
                  op: "=",
                  content: {
                    field: "experimental_strategy",
                    value: "RNA-Seq",
                  },
                },
              ],
            },
            format: "tsv",
            fields:
              "file_id,file_name,cases.submitter_id,cases.case_id,data_category,data_type,cases.samples.tumor_descriptor,cases.samples.tissue_type,cases.samples.sample_type,cases.samples.submitter_id,cases.samples.sample_id,analysis.workflow_type,cases.project.project_id,cases.samples.portions.analytes.aliquots.submitter_id",
            size: "1000",
          };
          var data = await fetchURLAndCache(
            "TCGA",
            "https://api.gdc.cancer.gov/files",
            {
              method: "POST",
              body: JSON.stringify(query),
              headers: { "Content-Type": "application/json" },
            },
            null,
            runtimeOptions
          );
          data = await data.text();
          var table = data
            .replaceAll("\r", "")
            .split("\n")
            .slice(1)
            .map((e) => {
              return e.split("\t");
            });
          var files_ = [];
          var count_files = table.map((e) => {
            debugLog(runtimeOptions, e);
            var files = {};
            files["workflow_type"] = e[0];
            files["case_id"] = e[1];
            files["sample_id"] = e[4];
            files["sample_type"] = e[5];
            files["cases_sample_submitter_id"] = e[6];
            files["tissue_type"] = e[7];
            files["tumor_descriptor"] = e[8];
            files["cases_submitter_id"] = e[9];
            files["data_category"] = e[10];
            files["data_type"] = e[11];
            files["file_name"] = e[13];
            files["file_id"] = e[14];
            files_.push(files);
            return e[e.length - 1];
          });
          result[p]["count_files"] = count_files;
          result[p]["files_description"] = files_;

          await sleep(300);
          return p;
        })
      )
    );

    i += 15;
    if (i >= ide.length) {
      break;
    }
  }

  return result;
}

/**
 * Obtain tpm count of a list of genes given sample file identifiers
 *
 * @async
 * @function getTpmCountsByGenesFromFiles
 * @memberof tcga
 *
 * @param {array} genes List with the genes of interest (ensemble id)
 * @param {array} files List with the file ids
 *
 * @returns {Object} Object containing the list of count ftpm and fpkm from each file organized by genes
 *
 * @example
 * let tcga = await import('https://raw.githubusercontent.com/YasCoMa/msig/main/mSigSDKScripts/tcga.js')
 * let genes = ['ENSG00000155657']
 * let files = ['9e5f8edc-5074-43b7-a870-594aeb36e2aa', '8d5a94c8-b3d9-4991-8ce9-f7aa9189938c', 'dedf9f52-7ded-4cc5-bba2-da89a48b5176', '3aa53aa2-97cd-43a8-b7b1-09f0bf6381dd']
 * var result = await tcga.getTpmCountsByGenesFromFiles(genes, files)
 */
async function getTpmCountsByGenesFromFiles(genes, files, options = {}) {
  const runtimeOptions = getRuntimeOptions(options);
  assertNoUserDataEgress(
    "GDC TPM data fetch by file ID",
    runtimeOptions,
    "File IDs are sent in the GDC data URL; use local expression files in strictLocal mode."
  );
  var result = {};
  for (var g of genes) {
    result[g] = { name: "", type: "", counts_fpkm: {}, counts_tpm: {} };
  }

  var info = [];
  var i = 0;
  while (i < files.length) {
    var end = i + 15 <= files.length ? i + 15 : files.length;
    var temp = files.slice(i, end);
    info = info.concat(
      await Promise.all(
        temp.map(async (f) => {
          var data = await fetchURLAndCache(
            "TCGA",
            `https://api.gdc.cancer.gov/data/${f}`,
            null,
            null,
            runtimeOptions
          );
          data = await data.text();
          data = data
            .split("\n")
            .map((e) => {
              return e.split("\t");
            })
            .filter((e) => e.length > 1);
          debugLog(runtimeOptions, f);
          var col_tpm = -1;
          var col_fpkm = -1;
          var i = 0;
          for (var c of data[0]) {
            if (c.toLowerCase().indexOf("tpm") != -1) {
              col_tpm = i;
            }
            if (c.toLowerCase().indexOf("fpkm") != -1) {
              col_fpkm = i;
            }
            i += 1;
          }

          var gr = [];
          var filter = data.filter((e) => genes.includes(e[0].split(".")[0]));
          filter.forEach((e) => {
            if (col_tpm != -1 && col_fpkm != -1) {
              var gene = e[0].split(".")[0];
              result[gene]["name"] = e[1];
              result[gene]["type"] = e[2];
              result[gene]["counts_fpkm"][f] = e[col_fpkm];
              result[gene]["counts_tpm"][f] = e[col_tpm];
              gr.push([e[2], e[1], Number(e[col_fpkm]), Number(e[col_tpm])]);
            }
          });

          await sleep(300);

          return gr;
        })
      )
    );

    i += 15;
    if (i >= files.length) {
      break;
    }
  }

  return result;
}

/**
 * Obtain MAF file ids and demograpic info of a list of projects
 *
 * @async
 * @function getMafInformationFromProjects
 * @memberof tcga
 *
 * @param {array} projects List with the projects of interest
 *
 * @returns {Object} Object containing the list of maf files and samples demographic information
 *
 * @example
 * let tcga = await import('https://raw.githubusercontent.com/YasCoMa/msig/main/mSigSDKScripts/tcga.js')
 * let projects = ['TCGA-LUSC', 'TCGA-OV']
 * var result = await tcga.getMafInformationFromProjects(projects)
 */
async function getMafInformationFromProjects(projects, options = {}) {
  const runtimeOptions = getRuntimeOptions(options);
  assertNoUserDataEgress(
    "GDC MAF file query by project",
    runtimeOptions,
    "Project IDs are sent in the POST body; use local MAF metadata in strictLocal mode."
  );
  var result = {};

  var i = 0;
  var ide = projects;
  var info = [];
  while (i < ide.length) {
    var end = i + 15 <= ide.length ? i + 15 : ide.length;
    var temp = ide.slice(i, end);
    info = info.concat(
      await Promise.all(
        temp.map(async (p) => {
          result[p] = {};

          var query = {
            filters: {
              op: "and",
              content: [
                {
                  op: "in",
                  content: {
                    field: "cases.project.project_id",
                    value: [p],
                  },
                },
                {
                  op: "=",
                  content: {
                    field: "data_category",
                    value: "Simple Nucleotide Variation",
                  },
                },
                {
                  op: "=",
                  content: {
                    field: "data_type",
                    value: "Masked Somatic Mutation",
                  },
                },
                {
                  op: "=",
                  content: {
                    field: "experimental_strategy",
                    value: "WXS",
                  },
                },
              ],
            },
            format: "tsv",
            fields:
              "file_id,cases.project.project_id,cases.submitter_id,cases.case_id,cases.samples.tumor_descriptor,cases.samples.tissue_type,cases.demographic.ethnicity,cases.demographic.gender,cases.demographic.race,cases.demographic.year_of_birth,cases.diagnoses.age_at_diagnosis,cases.diagnoses.classification_of_tumor,cases.diagnoses.days_to_recurrence,cases.diagnoses.tumor_stage",
            size: "1000",
          };
          var data = await fetchURLAndCache(
            "TCGA",
            "https://api.gdc.cancer.gov/files",
            {
              method: "POST",
              body: JSON.stringify(query),
              headers: { "Content-Type": "application/json" },
            },
            null,
            runtimeOptions
          );
          data = await data.text();
          var rows = parseTsvObjects(data);
          var files_ = [];
          var count_files = rows.map((row) => {
            var fileId = firstValue(row, ["file_id", "id"]);
            var files = {};
            files["case_id"] = firstValue(row, ["cases.0.case_id"]);
            files["project_id"] = firstValue(row, [
              "cases.0.project.project_id",
            ]);
            files["case_submitter_id"] = firstValue(row, [
              "cases.0.submitter_id",
            ]);
            files["ethnicity"] = firstValue(row, [
              "cases.0.demographic.ethnicity",
            ]);
            files["gender"] = firstValue(row, ["cases.0.demographic.gender"]);
            files["race"] = firstValue(row, ["cases.0.demographic.race"]);
            files["year_of_birth"] =
              Number(firstValue(row, ["cases.0.demographic.year_of_birth"])) ||
              null;
            files["age_at_diagnosis"] = daysToYears(
              firstValue(row, [
                "cases.0.diagnoses.0.age_at_diagnosis",
                "cases.0.diagnoses.1.age_at_diagnosis",
              ])
            );
            files["classification_of_tumor"] = firstValue(row, [
              "cases.0.diagnoses.0.classification_of_tumor",
              "cases.0.diagnoses.1.classification_of_tumor",
            ]);
            files["tissue_type"] = firstValue(row, [
              "cases.0.samples.0.tissue_type",
              "cases.0.samples.1.tissue_type",
            ]);
            files["tumor_descriptor"] = firstValue(row, [
              "cases.0.samples.0.tumor_descriptor",
              "cases.0.samples.1.tumor_descriptor",
            ]);
            files["file_id"] = fileId;
            files_.push(files);
            return fileId;
          }).filter((fileId) => fileId);
          result[p]["maf_files"] = count_files;
          result[p]["samples_description"] = files_;

          await sleep(300);
          return p;
        })
      )
    );

    i += 15;
    if (i >= ide.length) {
      break;
    }
  }

  return result;
}

/**
 * Obtain mutations and variant information given MAF file identifiers
 *
 * @async
 * @function getVariantInformationFromMafFiles
 * @memberof tcga
 * @param {Object} res Object containing the list of maf files and samples demographic information.
 * @param {Object} [options={}] Conversion options.
 * @param {number} [options.fileConcurrency=4] Maximum GDC MAF files to download and parse at once.
 * @param {boolean} [options.includeVariantInformation=true] Whether to include flat variant rows in the result.
 * @param {Function} [options.onProgress=null] Optional callback receiving progress events.
 * @returns {Object} Object containing the list of patient mutation information
 * @example
 * let tcga = await import('https://raw.githubusercontent.com/YasCoMa/msig/main/mSigSDKScripts/tcga.js')
 * let res = { 'TCGA-LUSC': { 'maf_files': ['0b3d2db3-8ae3-4d39-bd9b-9d1e7a133b65', '9fed5902-6e95-4526-a119-ec4eade5576b' ] } }
 * var result = await tcga.getVariantInformationFromMafFiles(res)
 */
async function getVariantInformationFromMafFiles(res, options = {}) {
  const settings = options && typeof options === "object" ? options : {};
  const runtimeOptions = getRuntimeOptions(settings);
  assertNoUserDataEgress(
    "GDC MAF data fetch by file ID",
    runtimeOptions,
    "MAF file IDs are sent in the GDC data URL; pass local MAF rows to convertMatrix/convertMafToProfileSpectra in strictLocal mode."
  );
  const {
    fileConcurrency = 4,
    includeVariantInformation = true,
    onProgress = null,
    batchSize = 100,
    genome = "hg19",
    contextOptions = {},
  } = settings;
  var result = {};
  var projects = Object.keys(res || {});
  const totalFiles = projects.reduce(
    (sum, project) => sum + (res?.[project]?.maf_files || []).length,
    0
  );
  let completedFiles = 0;

  emitProgress(onProgress, {
    stage: "start",
    projects: projects.length,
    completed: completedFiles,
    total: totalFiles,
  });

  for (var p of projects) {
    result[p] = {};
    result[p]["variant_information"] = [];
    result[p]["mutational_spectra"] = null;

    var files = Array.isArray(res[p]?.maf_files) ? res[p]["maf_files"] : [];
    emitProgress(onProgress, {
      stage: "project-start",
      project: p,
      files: files.length,
      completed: completedFiles,
      total: totalFiles,
    });

    const parsedFiles = await mapWithConcurrency(
      files,
      async (f, index) => {
        var url = `https://api.gdc.cancer.gov/data/${f}`;
        emitProgress(onProgress, {
          stage: "download",
          project: p,
          fileId: f,
          fileIndex: index + 1,
          files: files.length,
          completed: completedFiles,
          total: totalFiles,
        });

        try {
          var dat = await fetchURLAndCache("TCGA", url, null, null, runtimeOptions);
          var raw = await dat.arrayBuffer();
          emitProgress(onProgress, {
            stage: "parse",
            project: p,
            fileId: f,
            fileIndex: index + 1,
            files: files.length,
            completed: completedFiles,
            total: totalFiles,
          });
          var data = await pako.default.inflate(raw, { to: "string" });
          var rows = parseGdcMafRows(data, { project: p, fileId: f });
          completedFiles += 1;

          emitProgress(onProgress, {
            stage: "file-complete",
            project: p,
            fileId: f,
            fileIndex: index + 1,
            files: files.length,
            variants: rows.length,
            completed: completedFiles,
            total: totalFiles,
          });

          return rows;
        } catch (error) {
          completedFiles += 1;
          emitProgress(onProgress, {
            stage: "file-error",
            project: p,
            fileId: f,
            fileIndex: index + 1,
            files: files.length,
            error: error.message,
            completed: completedFiles,
            total: totalFiles,
          });
          debugWarn(runtimeOptions, `Could not load GDC MAF file ${f}.`, error);
          return [];
        }
      },
      fileConcurrency
    );

    const info = parsedFiles.filter((rows) => rows.length);
    const variantInformation = includeVariantInformation ? info.flat() : [];
    if (includeVariantInformation) {
      result[p]["variant_information"] = variantInformation;
    }

    emitProgress(onProgress, {
      stage: "convert",
      project: p,
      files: files.length,
      variants: info.reduce((sum, rows) => sum + rows.length, 0),
      completed: completedFiles,
      total: totalFiles,
    });
    result[p]["mutational_spectra"] = await convertMatrix(
      info,
      "sample",
      batchSize,
      genome,
      true,
      contextOptions
    );

    emitProgress(onProgress, {
      stage: "project-complete",
      project: p,
      files: files.length,
      samples: Object.keys(result[p]["mutational_spectra"] || {}).length,
      completed: completedFiles,
      total: totalFiles,
    });
  }

  emitProgress(onProgress, {
    stage: "complete",
    projects: projects.length,
    completed: completedFiles,
    total: totalFiles,
  });

  return result;
}

function convertTCGAProjectIntoJSON(MAFfiles, mutSpec, dataType = "WGS") {
  // loop through each mutational spectrum in the mutSpec dictionary and create a JSON object for each one

  const mergedPatientJSONs = [];

  let i = 0;
  for (let patient in mutSpec) {
    const patientJSON = [];

    for (let mutationType in mutSpec[patient]) {
      let mutSpecObj = {
        sample: patient,
        strategy: dataType,
        profile: "SBS",
        matrix: 96,
        mutationType: mutationType,
        mutations: mutSpec[patient][mutationType],
      };
      patientJSON.push(mutSpecObj);
    }
    mergedPatientJSONs.push(patientJSON);
    i++;
  }
  return mergedPatientJSONs;
}

export {
  getProjectsByGene,
  getTpmCountsByGenesOnProjects,
  getTpmCountsByGenesFromFiles,
  getMafInformationFromProjects,
  getVariantInformationFromMafFiles,
  convertTCGAProjectIntoJSON,
};
