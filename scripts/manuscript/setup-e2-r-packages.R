args <- commandArgs(trailingOnly = TRUE)

arg_value <- function(prefix, fallback = NULL) {
  match <- args[startsWith(args, prefix)]
  if (length(match) == 0) {
    return(fallback)
  }
  sub(prefix, "", match[[1]], fixed = TRUE)
}

repo_root <- normalizePath(getwd(), winslash = "/", mustWork = TRUE)
r_minor <- paste(R.version$major, strsplit(R.version$minor, ".", fixed = TRUE)[[1]][[1]], sep = ".")
default_library <- file.path(repo_root, ".tools", "r-library", paste0("R-", r_minor))
r_library <- arg_value("--library=", Sys.getenv("MSIG_E2_R_LIBS_USER", default_library))

dir.create(r_library, recursive = TRUE, showWarnings = FALSE)
.libPaths(unique(c(normalizePath(r_library, winslash = "/", mustWork = TRUE), .libPaths())))
options(repos = c(CRAN = "https://cloud.r-project.org"))

message("R: ", R.version.string)
message("Library: ", .libPaths()[[1]])

install_missing_cran <- function(packages) {
  missing <- packages[!vapply(packages, requireNamespace, logical(1), quietly = TRUE)]
  if (length(missing) > 0) {
    message("Installing CRAN packages: ", paste(missing, collapse = ", "))
    install.packages(missing, dependencies = NA)
  }
}

install_missing_bioc <- function(packages) {
  missing <- packages[!vapply(packages, requireNamespace, logical(1), quietly = TRUE)]
  if (length(missing) > 0) {
    message("Installing Bioconductor packages: ", paste(missing, collapse = ", "))
    BiocManager::install(missing, ask = FALSE, update = FALSE)
  }
}

install_versioned_cran <- function(package, version) {
  installed <- requireNamespace(package, quietly = TRUE)
  current <- if (installed) as.character(utils::packageVersion(package)) else NA_character_
  if (!installed || !identical(current, version)) {
    message("Installing ", package, " ", version, " from CRAN archive")
    remotes::install_version(
      package,
      version = version,
      repos = "https://cloud.r-project.org",
      dependencies = FALSE,
      upgrade = "never"
    )
  }
}

install_missing_cran(c("remotes", "BiocManager", "nnls", "quadprog", "GenSA"))

install_missing_bioc(c(
  "GenomeInfoDb",
  "GenomicRanges",
  "Biostrings",
  "BSgenome",
  "BSgenome.Hsapiens.UCSC.hg19",
  "Rhtslib",
  "Rsamtools",
  "maftools"
))

install_missing_cran(c(
  "withr",
  "vctrs",
  "utf8",
  "pkgconfig",
  "pillar",
  "magrittr",
  "stringi",
  "tidyselect",
  "tibble",
  "stringr",
  "Rcpp",
  "plyr",
  "S7",
  "isoband",
  "iterators",
  "foreach",
  "digest",
  "RcppArmadillo",
  "zoo",
  "urca",
  "timeDate",
  "lmtest",
  "fracdiff",
  "colorspace",
  "rbibutils",
  "microbenchmark",
  "modelr",
  "ggplot2",
  "forecast",
  "Deriv",
  "cowplot",
  "MatrixModels",
  "SparseM",
  "doBy",
  "numDeriv",
  "RcppEigen",
  "reformulas",
  "nloptr",
  "minqa",
  "Rdpack",
  "lme4",
  "quantreg",
  "pbkrtest",
  "Formula",
  "carData",
  "backports",
  "car",
  "corrplot",
  "dplyr",
  "broom",
  "purrr",
  "tidyr",
  "parallelly",
  "listenv",
  "globals",
  "reshape2",
  "doParallel",
  "gridBase",
  "rngtools",
  "registry",
  "rstatix",
  "polynom",
  "gridExtra",
  "ggsignif",
  "ggsci",
  "ggrepel",
  "future",
  "NMF",
  "ggpubr",
  "furrr"
))

install_versioned_cran("deconstructSigs", "1.8.0")
install_versioned_cran("sigminer", "2.3.1")

required <- c(
  "deconstructSigs",
  "sigminer",
  "nnls",
  "quadprog",
  "GenSA",
  "BSgenome.Hsapiens.UCSC.hg19",
  "maftools"
)
for (package in required) {
  if (!requireNamespace(package, quietly = TRUE)) {
    stop("Required package is still unavailable after install: ", package)
  }
  message(package, " ", as.character(utils::packageVersion(package)))
}

message("E2 R package setup complete.")
