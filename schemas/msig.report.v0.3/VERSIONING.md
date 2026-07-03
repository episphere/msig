# mSigSDK Report Schema Versioning

The report schema uses two explicit version fields:

- `$id` identifies the canonical schema document URL.
- `schemaVersion` identifies the machine-readable contract (`msig.report.v0.3`).
- `version` records the semantic report format version (`0.3.0`).

Patch releases may add optional fields, descriptions, or validation examples without changing `schemaVersion`. Minor releases may add required fields or alter field semantics and must publish a new schema directory and `$id`. Readers should reject reports with an unknown `schemaVersion` unless they explicitly implement a migration path.

The validation command is:

```sh
npm run test:report-schema
```

To validate one report file directly:

```sh
node scripts/validate-report-schema.mjs path/to/report.json
```
