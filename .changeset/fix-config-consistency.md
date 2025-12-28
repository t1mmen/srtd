---
"@t1mmen/srtd": patch
---

fix: resolve MigrationBuilder configuration bug

Fix MigrationBuilder.fromConfig() passing undefined values that overwrote constructor defaults. This caused migrations to use undefined values instead of the intended defaults when optional config fields were not set.

- Use conditional spread to only include defined config values
- Add ResolvedMigrationBuilderConfig type to eliminate non-null assertions
