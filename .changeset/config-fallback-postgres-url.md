---
"@t1mmen/srtd": patch
---

Honor `POSTGRES_URL` when `srtd.config.json` is not valid JSON. Before, that fallback returned the defaults before reading the variable, so `srtd apply` and `watch` connected to `:54322` instead of the database `POSTGRES_URL` names.
