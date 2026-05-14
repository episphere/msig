args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 3) {
  stop("Usage: Rscript run-r-nnls.R <spectra_csv> <signatures_csv> <output_csv>")
}

spectra_path <- args[[1]]
signatures_path <- args[[2]]
output_path <- args[[3]]

if (!requireNamespace("nnls", quietly = TRUE)) {
  stop("The nnls R package is required for this numerical concordance check.")
}

spectra <- read.csv(spectra_path, row.names = 1, check.names = FALSE)
signatures <- read.csv(signatures_path, row.names = 1, check.names = FALSE)
common_contexts <- intersect(colnames(spectra), colnames(signatures))
if (length(common_contexts) != 96) {
  stop(paste("Expected 96 shared SBS contexts, found", length(common_contexts)))
}

spectra <- spectra[, common_contexts, drop = FALSE]
signatures <- signatures[, common_contexts, drop = FALSE]
signature_names <- rownames(signatures)
design <- t(as.matrix(signatures))

rows <- lapply(rownames(spectra), function(sample_id) {
  fit <- nnls::nnls(design, as.numeric(spectra[sample_id, ]))
  exposure <- as.numeric(stats::coef(fit))
  names(exposure) <- signature_names
  total <- sum(exposure)
  if (is.finite(total) && total > 0) {
    exposure <- exposure / total
  }
  exposure[exposure < 0.01] <- 0
  total <- sum(exposure)
  if (is.finite(total) && total > 0) {
    exposure <- exposure / total
  }
  c(sample = sample_id, exposure)
})

output <- as.data.frame(do.call(rbind, rows), check.names = FALSE, stringsAsFactors = FALSE)
for (column in signature_names) {
  output[[column]] <- as.numeric(output[[column]])
}

write.csv(output, output_path, row.names = FALSE, quote = TRUE)
