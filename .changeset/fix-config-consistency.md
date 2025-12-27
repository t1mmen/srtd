---
"@t1mmen/srtd": patch
---

fix: resolve config inconsistencies and improve test reliability

- Fix MigrationBuilder.fromConfig() passing undefined values that overwrote constructor defaults
- Fix isWipTemplate() re-reading config from disk instead of using injected config
- Fix apply command not skipping WIP templates (now consistent with build)
- Convert isWipTemplate to pure function with explicit wipIndicator parameter
- Add Database E2E tests to CI pipeline
- Optimize Supabase config for faster test startup (database only)
