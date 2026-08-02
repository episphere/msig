# mSigSDK Report Schema Versioning

The report schema uses two explicit version fields:

- `$id` identifies the canonical schema document URL.
- `schemaVersion` identifies the machine-readable contract (`msig.report.v0.3`).
- `version` records the semantic report format version (`0.3.0`).

Patch releases may add optional fields, descriptions, or validation examples without changing `schemaVersion`. Minor releases may add required fields or alter field semantics and must publish a new schema directory and `$id`. Readers should reject reports with an unknown `schemaVersion` unless they explicitly implement a migration path.

Every schema-valid report must include `reproducibility`. The default report builder emits
`claim: portable_schema_validated_analysis_record` with separate auditability,
portability, and computational-reproducibility statuses. The stronger
`computationally_reproducible_analysis_record` claim is reserved for records whose
evidence contains the required immutable artifact hashes/references, exact inputs and
context order, parameters and RNG details, environment, archived test data, and rerun
scripts. Artifact references must identify an immutable archive or embedded artifact;
a checksum alone is not an archive. A non-empty evidence object is not sufficient; the
JSON Schema and SDK report builder validate the claim/evidence relationship, required
artifact-reference shapes, hash/commit fields, and explicit parameter/environment groups.

The validation command is:

```sh
npm run test:report-schema
```

To validate one report file directly:

```sh
node scripts/validate-report-schema.mjs path/to/report.json
```
