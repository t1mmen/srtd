---
"@t1mmen/srtd": patch
---

fix: validate build log and config files, warn on corruption

When SRTD loads corrupted or malformed JSON files, it now validates the schema using Zod and displays clear warnings instead of silently discarding state. This addresses the root cause from issue #39 where corrupted build log JSON caused all templates to appear as needing rebuild.

- Add Zod schema validation for build logs and config
- Display yellow warnings in watch/apply/build commands
- Graceful degradation: use defaults when validation fails
- Unified ValidationWarning interface across codebase
- Types derived from Zod schemas (single source of truth)
- Security: redact database credentials from E2E test error messages
- Improve E2E test reliability with null guards for cleanup race conditions
- Add typed event method tests (once/off) for full coverage
