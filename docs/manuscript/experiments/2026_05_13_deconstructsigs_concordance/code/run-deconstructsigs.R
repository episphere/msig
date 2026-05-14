args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 3) {
  stop("Usage: Rscript run-deconstructsigs.R <spectra_csv> <signatures_csv> <output_csv>")
}

spectra_path <- args[[1]]
signatures_path <- args[[2]]
output_path <- args[[3]]

if (!requireNamespace("deconstructSigs", quietly = TRUE)) {
  stop("The deconstructSigs R package is required for this concordance experiment.")
}

library(deconstructSigs)

spectra <- read.csv(spectra_path, row.names = 1, check.names = FALSE)
signatures <- read.csv(signatures_path, row.names = 1, check.names = FALSE)
common_contexts <- intersect(colnames(spectra), colnames(signatures))
if (length(common_contexts) != 96) {
  stop(paste("Expected 96 shared SBS contexts, found", length(common_contexts)))
}

spectra <- spectra[, common_contexts, drop = FALSE]
signatures <- signatures[, common_contexts, drop = FALSE]
signature_names <- rownames(signatures)

rows <- lapply(rownames(spectra), function(sample_id) {
  fit <- whichSignatures(
    tumor.ref = spectra,
    sample.id = sample_id,
    signatures.ref = signatures,
    signature.cutoff = 0.01,
    contexts.needed = TRUE,
    tri.counts.method = "default"
  )
  weights <- as.numeric(fit$weights)
  names(weights) <- names(fit$weights)
  exposure <- setNames(rep(0, length(signature_names)), signature_names)
  matching <- intersect(names(weights), signature_names)
  exposure[matching] <- weights[matching]
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
