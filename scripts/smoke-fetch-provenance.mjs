import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { fetchURLAndCache } from "../mSigSDKScripts/utils.js";

const endpointUrl = "https://example.test/msig-source.json";
const payload = JSON.stringify({
  source: "fixture",
  values: [1, 2, 3],
});
const expectedSha256 = createHash("sha256").update(payload).digest("hex");
const provenanceLog = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url) => {
  assert.equal(url, endpointUrl);
  return new Response(payload, {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
};

try {
  const response = await fetchURLAndCache(
    "smokeFetchProvenance",
    endpointUrl,
    { cache: "no-store" },
    null,
    { cacheResponses: false, provenanceLog }
  );
  const parsed = await response.json();

  assert.deepEqual(parsed, {
    source: "fixture",
    values: [1, 2, 3],
  });
  assert.equal(response.provenance.endpointUrl, endpointUrl);
  assert.equal(response.provenance.cacheStatus, "disabled");
  assert.equal(response.provenance.payloadSha256, expectedSha256);
  assert.equal(response.provenance.checksum.algorithm, "SHA-256");
  assert.equal(response.provenance.checksum.value, expectedSha256);
  assert.equal(response.provenance.payloadBytes, Buffer.byteLength(payload));
  assert.match(response.provenance.retrievedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(parsed.sourceProvenance.payloadSha256, expectedSha256);
  assert.equal(parsed.payloadProvenance.payloadSha256, expectedSha256);
  assert.equal(provenanceLog.length, 1);
  assert.equal(provenanceLog[0].payloadSha256, expectedSha256);

  console.log(
    JSON.stringify(
      {
        status: "ok",
        endpointUrl,
        cacheStatus: response.provenance.cacheStatus,
        payloadSha256: response.provenance.payloadSha256,
        parsedObjectHasSourceProvenance: Boolean(parsed.sourceProvenance),
        provenanceLogEntries: provenanceLog.length,
      },
      null,
      2
    )
  );
} finally {
  globalThis.fetch = originalFetch;
}
