# Hardware and Scaling Characterization

Status: partial
For measured exposure-solve scenarios, warm-start time is dominated by local pure-JS compute. The code path records no worker use for bootstrapSignatureFit, and strictLocal no-egress evidence rules out API calls in the local workflow. The requested cohort-scale end-to-end bootstrap dominance was not measured.

Measured host: 32 logical CPUs, 31.2 GiB RAM.
Largest reported JS heap among measured exposure-solve rows: 61,201,318 bytes.

No macOS/Linux host, lower-RAM host, or upper-bound stress test was available in this run.
