import assert from "node:assert/strict";

import {
  convertMafToProfileSpectra,
  convertMatrix,
  getMutationalContext,
} from "../mSigSDKScripts/mutationalSpectrum.js";
import { getExpectedContexts } from "../mSigSDKScripts/validation.js";

const contexts = {
  SBS96: getExpectedContexts({ profile: "SBS", matrix: 96 }),
  SBS1536: getExpectedContexts({ profile: "SBS", matrix: 1536 }),
  DBS78: getExpectedContexts({ profile: "DBS", matrix: 78 }),
  ID83: getExpectedContexts({ profile: "ID", matrix: 83 }),
};

assert.equal(contexts.SBS96.length, 96);
assert.equal(contexts.SBS1536.length, 1536);
assert.equal(contexts.DBS78.length, 78);
assert.equal(contexts.ID83.length, 83);

const rows = [
  {
    sample: "sample-a",
    chromosome: "1",
    start_position: "100",
    reference_allele: "C",
    tumor_seq_allele2: "A",
    variant_type: "SNP",
    context: "AACGT",
  },
  {
    sample: "sample-a",
    chromosome: "1",
    start_position: "200",
    reference_allele: "A",
    tumor_seq_allele2: "C",
    variant_type: "SNP",
    context: "CCATG",
  },
  {
    sample: "sample-a",
    chromosome: "1",
    start_position: "300",
    reference_allele: "AC",
    tumor_seq_allele2: "GT",
    variant_type: "DNP",
  },
  {
    sample: "sample-a",
    chromosome: "1",
    start_position: "500",
    reference_allele: "T",
    tumor_seq_allele2: "C",
    variant_type: "SNP",
  },
  {
    sample: "sample-a",
    chromosome: "1",
    start_position: "501",
    reference_allele: "A",
    tumor_seq_allele2: "G",
    variant_type: "SNP",
  },
  {
    sample: "sample-a",
    chromosome: "1",
    start_position: "600",
    reference_allele: "-",
    tumor_seq_allele2: "C",
    variant_type: "INS",
    homopolymer_length: "1",
  },
  {
    sample: "sample-a",
    chromosome: "1",
    start_position: "700",
    reference_allele: "T",
    tumor_seq_allele2: "-",
    variant_type: "DEL",
    homopolymer_length: "2",
  },
];

const conversion = await convertMafToProfileSpectra(rows, {
  profiles: ["SBS96", "SBS1536", "DBS78", "ID83"],
  groupBy: "sample",
  offline: true,
});

assert.equal(conversion.spectraByProfile.SBS96["sample-a"]["A[C>A]G"], 1);
assert.equal(conversion.spectraByProfile.SBS96["sample-a"]["A[T>G]G"], 1);
assert.equal(conversion.spectraByProfile.SBS1536["sample-a"]["AA[C>A]GT"], 1);
assert.equal(conversion.spectraByProfile.SBS1536["sample-a"]["CA[T>G]GG"], 1);
assert.equal(conversion.spectraByProfile.DBS78["sample-a"]["AC>GT"], 1);
assert.equal(conversion.spectraByProfile.DBS78["sample-a"]["TA>CG"], 1);
assert.equal(conversion.spectraByProfile.ID83["sample-a"]["1:Ins:C:0"], 1);
assert.equal(conversion.spectraByProfile.ID83["sample-a"]["1:Del:T:1"], 1);

const lookupBackedSbs1536 = await convertMafToProfileSpectra(
  [
    {
      sample: "lookup-sample",
      chromosome: "1",
      start_position: "900",
      reference_allele: "C",
      tumor_seq_allele2: "A",
      variant_type: "SNP",
      context: "ACG",
    },
  ],
  {
    profiles: ["SBS1536"],
    groupBy: "sample",
    offline: true,
    contextLookupTable: {
      "1:900": "AACGT",
    },
  }
);

assert.equal(
  lookupBackedSbs1536.spectraByProfile.SBS1536["lookup-sample"]["AA[C>A]GT"],
  1
);
assert.equal(
  lookupBackedSbs1536.traceByProfile.SBS1536[0].contextSource,
  "offline reference lookup"
);

const undersizedLookup = await convertMafToProfileSpectra(
  [
    {
      sample: "lookup-sample",
      chromosome: "1",
      start_position: "901",
      reference_allele: "C",
      tumor_seq_allele2: "A",
      variant_type: "SNP",
      context: "ACG",
    },
  ],
  {
    profiles: ["SBS1536"],
    groupBy: "sample",
    offline: true,
    contextLookupTable: {
      "1:901": "ACG",
    },
  }
);

assert.equal(
  undersizedLookup.traceByProfile.SBS1536[0].skippedReason,
  "missing 5-base reference context"
);

const originalFetch = globalThis.fetch;
let fetchedUrl = "";
globalThis.fetch = async (url) => {
  fetchedUrl = String(url);
  return {
    ok: true,
    async json() {
      return { dna: "AACGT" };
    },
  };
};
try {
  assert.equal(
    await getMutationalContext("1", "GRCh38.d1.vd1", 900, {
      contextSize: 5,
    }),
    "AACGT"
  );
  assert.match(fetchedUrl, /genome=hg38/);
  assert.match(fetchedUrl, /start=897;end=902/);
} finally {
  globalThis.fetch = originalFetch;
}

const legacySbs96 = await convertMatrix(rows, "sample", 100, "hg19", false, {
  offline: true,
});

assert.deepEqual(legacySbs96, conversion.spectraByProfile.SBS96);

console.log("Multi-profile MAF conversion smoke test passed.");
