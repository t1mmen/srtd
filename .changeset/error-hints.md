---
"@t1mmen/srtd": minor
---

Add actionable hints for Postgres errors

When SQL templates fail, cryptic Postgres error codes now get translated into actionable hints. Instead of just seeing `42P01`, users see: "Table or view does not exist. Ensure the migration that creates it has run first."

- Maps 17 common Postgres error codes (42xxx, 23xxx, 25xxx, 40xxx, 53xxx, 57xxx, 08xxx) to plain-English hints
- Pattern-based fallback for connection/permission/timeout errors
- Hints display in cyan after error messages across all commands
