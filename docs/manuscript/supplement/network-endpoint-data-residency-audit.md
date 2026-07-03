# Network Endpoint and Data-Residency Audit

Generated at: 2026-06-28T12:31:51.158Z

| host | used_for | information_sent | user_derived_data | strict_local_mode |
| --- | --- | --- | --- | --- |
| mSigPortal API | Public spectra and signature catalogs | Public cohort/catalog filters or selected sample identifiers | No for public-resource fetches | Sample-specific fetches are disabled |
| GDC API | Public TCGA/GDC helper queries | Public gene, project, file, and query identifiers | Public identifiers only | All GDC calls are disabled |
| UCSC sequence API | Online MAF sequence-context lookup | Genome build and mutation coordinates | Yes, when converting user MAF rows online | Disabled; row-supplied or offline contexts required |
| Runtime/CDN hosts | Pinned JavaScript, Pyodide, and WebR assets | Asset URLs only | No | Avoidable by local hosting where assets are bundled |
| Bundled package repositories | Pyodide wheels and WebR package artifacts | Same-origin local artifact requests when hosted | No | Compatible with local hosting |
