---
"@t1mmen/srtd": minor
---

Add `--json` flag to all commands for machine-readable output

- **Batch commands** (`build`, `apply`, `register`, `promote`, `clear`, `init`): Output single JSON object with command-specific structure
- **Streaming commands** (`watch`): Output NDJSON (newline-delimited JSON) with events for template changes, applies, and errors
- All commands share base envelope: `{ success, command, timestamp }` with command-specific fields
- Useful for CI/CD pipelines, LLM integrations, and programmatic consumption
