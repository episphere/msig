import { createAdapterComparisonContract } from "../mSigSDKScripts/adapters.js";
import { normalizeExposureRows } from "./manuscript/lib/experiment-utils.mjs";

const contract = createAdapterComparisonContract({
  contexts: ["A[C>A]A", "A[C>G]A"],
  signatureNames: ["SBS1", "SBS5"],
  cutoff: 0.01,
  randomSeed: 104729,
});
if (
  contract.output.canonicalUnits !== "relative_fractions" ||
  contract.reporting.cutoff.value !== 0.01 ||
  !contract.reporting.order.includes("renormalize retained values") ||
  !contract.reporting.unassigned.includes("not renamed")
) {
  throw new Error("Comparison contract does not state the canonical units and operation order.");
}

const normalized = normalizeExposureRows({
  sample: { SBS1: 2, SBS5: -1, omitted: Number.NaN, infinite: Number.POSITIVE_INFINITY },
});
if (
  Math.abs(normalized.sample.SBS1 - 1) > 1e-12 ||
  normalized.sample.SBS5 !== 0 ||
  normalized.sample.omitted !== 0 ||
  normalized.sample.infinite !== 0
) {
  throw new Error("Non-finite or negative exposure values were not zeroed before normalization.");
}

console.log(JSON.stringify({
  status: "ok",
  contractSchemaVersion: contract.schemaVersion,
  canonicalUnits: contract.output.canonicalUnits,
  cutoffOrder: contract.reporting.order,
  sanitizedExposure: normalized.sample,
}));
