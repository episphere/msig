
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let tcga = { mutspec: undefined };

import { fetchURLAndCache } from "./utils.js";

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
async function getProjectsByGene(genes) {
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
          var data = await fetchURLAndCache("TCGA", url);
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
 * let tcga = await import('https://raw.githubusercontent.com/YasCoMa/msig/main/mSigSDKScripts/tcga.js')
 * let genes = ['ENSG00000155657']
 * let projects = ['TCGA-LUSC', 'TCGA-OV']
 * var result = await tcga.getTpmCountsByGenesOnProjects(genes, projects)
 */
async function getTpmCountsByGenesOnProjects(genes, projects) {
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
          var data = await fetchURLAndCache("TCGA", "https://api.gdc.cancer.gov/files", {
            method: "POST",
            body: JSON.stringify(query),
            headers: { "Content-Type": "application/json" },
          });
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
            console.log(e);
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
async function getTpmCountsByGenesFromFiles(genes, files) {
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
          var data = await fetchURLAndCache("TCGA", `https://api.gdc.cancer.gov/data/${f}`);
          data = await data.text();
          data = data
            .split("\n")
            .map((e) => {
              return e.split("\t");
            })
            .filter((e) => e.length > 1);
          console.log(f);
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
async function getMafInformationFromProjects(projects) {
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
          var data = await fetchURLAndCache("TCGA", "https://api.gdc.cancer.gov/files", {
            method: "POST",
            body: JSON.stringify(query),
            headers: { "Content-Type": "application/json" },
          });
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
            var files = {};
            files["case_id"] = e[0];
            files["ethnicity"] = e[1];
            files["gender"] = e[2];
            files["race"] = e[3];
            files["year_of_birth"] = Number(e[4]);
            files["age_at_diagnosis"] = Number(
              (Number(e[5]) / 365).toPrecision(2)
            );
            files["classification_of_tumor"] = e[6];
            files["case_submitter_id"] = e[13];
            files["file_id"] = e[14];
            files_.push(files);
            return e[e.length - 1];
          });
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
 *
 * @param {array} res Object containing the list of maf files and samples demographic information
 *
 * @returns {Object} Object containing the list of patient mutation information
 *
 * @example
 * let tcga = await import('https://raw.githubusercontent.com/YasCoMa/msig/main/mSigSDKScripts/tcga.js')
 * let res = { 'TCGA-LUSC': { 'maf_files': ['0b3d2db3-8ae3-4d39-bd9b-9d1e7a133b65', '9fed5902-6e95-4526-a119-ec4eade5576b' ] } }
 * var result = await tcga.getVariantInformationFromMafFiles(res)
 */
async function getVariantInformationFromMafFiles(res) {
  var result = {};
  var projects = Object.keys(res);

  for (var p of projects) {
    result[p] = {};
    result[p]["variant_information"] = [];
    result[p]["mutational_spectra"] = null;

    var files = res[p]["maf_files"];
    var info = [];
    var gr = [];
    var i = 0;
    while (i < files.length) {
      var end = i + 15 <= files.length ? i + 15 : files.length;
      var temp = files.slice(i, end);
      info = info.concat(
        await Promise.all(
          temp.map(async (f) => {
            var url = `https://api.gdc.cancer.gov/data/${f}`;

            try {
              var data = await fetch(url);
              var dat = await data.text();
              if (dat.indexOf("\\x") != -1) {
                dat = await fetch(url);
                var raw = await dat.arrayBuffer();
                data = pako.inflate(raw, { to: "string" });
              }

              data = data
                .split("\n")
                .filter((e) => e.indexOf("#") != 0)
                .map((e) => {
                  return e.split("\t");
                })
                .filter((e) => e.length > 1);

              var patients = [];
              var filter = data.slice(1);
              filter.forEach((e) => {
                var build =
                  e[3].indexOf("37") != -1
                    ? "hg19"
                    : e[3].indexOf("38") != -1
                    ? "hg38"
                    : "";
                if (build != "") {
                  var obj = { project_code: p, file_id: f, build: build };
                  obj["chromosome"] = e[4].toLowerCase().replace("chr", "");
                  obj["reference_genome_allele"] = e[10];
                  obj["mutated_to_allele"] = e[12];
                  obj["chromosome_start"] = e[6];
                  obj["mutation_type"] = e[9];
                  obj["mutation_classification"] = e[8];

                  result[p]["variant_information"].push(obj);
                  patients.push(obj);
                }
              });

              await sleep(300);

              info.push(patients);
              gr.push(i);
              if (files.length == gr.length) {
                result[p]["mutational_spectra"] =
                  await tcga.mutspec.convertMatrix(info, "file_id", 100);
              }
            } catch (e) {
              console.log("error in ", url);
            }

            return url;
          })
        )
      );

      i += 15;
      if (i >= files.length) {
        break;
      }
    }
  }

  return result;
}

/**
 * Load a certain dependency library from link
 *
 *
 * @param {string} url Library URL.
 *
 * @example
 * let tcga = await import('https://raw.githubusercontent.com/YasCoMa/msig/main/mSigSDKScripts/tcga.js')
 * await tcga.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.11/pako.min.js')
 *
 */
async function loadScript(url) {
  console.log(`${url} loaded`);
  async function asyncScript(url) {
    let load = new Promise((resolve, regect) => {
      let s = document.createElement("script");
      s.src = url;
      s.onload = resolve;
      document.head.appendChild(s);
    });
    await load;
  }
  // satisfy dependencies
  await asyncScript(url);
}

if (typeof pako == "undefined") {
  loadScript("https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.11/pako.min.js");
}

if (typeof mutspec == "undefined") {
  var server = "./mutationalSpectrum.js";

  import(server).then((module) => {
    tcga.mutspec = module;
  });
}

export {
  getProjectsByGene,
  getTpmCountsByGenesOnProjects,
  getTpmCountsByGenesFromFiles,
  getMafInformationFromProjects,
  getVariantInformationFromMafFiles,
  loadScript,
};
