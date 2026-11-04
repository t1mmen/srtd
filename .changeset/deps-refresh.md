---
'@t1mmen/srtd': patch
---

Update dependencies. `zod` 4.6 and `glob` 14 (with `minimatch` 11) clear every advisory `npm audit` reported against srtd's runtime dependencies (GHSA-mrhx-c7xc-m3w5, GHSA-3g3m-2fjr-6pw4, and the `minimatch` ReDoS advisories). Installing srtd on Linux x64 no longer pulls in an unused Rollup binary. `engines` now says Node `>=20.19.0`, the minimum `chokidar` 5 already required.
