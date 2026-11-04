---
'@t1mmen/srtd': patch
---

Honor `POSTGRES_URL`: when set, it overrides `pgConnection` from `srtd.config.json` and the default, as the default's own comment already promised.
