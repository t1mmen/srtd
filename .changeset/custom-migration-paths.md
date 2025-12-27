---
"@t1mmen/srtd": minor
---

Add customizable migration filename templates with `migrationFilename` config option

You can now customize how migration files are named and organized using template variables:
- `$timestamp` - The migration timestamp (e.g., `20240101123456`)
- `$migrationName` - The template name (e.g., `create_users`)
- `$prefix` - The migration prefix with trailing dash (e.g., `srtd-`)

**Example configurations:**

```json
// Default (current behavior)
{ "migrationFilename": "$timestamp_$prefix$migrationName.sql" }
// → migrations/20240101123456_srtd-create_users.sql

// Directory-based organization (Issue #41)
{ "migrationFilename": "$migrationName/migrate.sql" }
// → migrations/create_users/migrate.sql

// Timestamp subdirectories
{ "migrationFilename": "$timestamp/$migrationName.sql" }
// → migrations/20240101123456/create_users.sql
```

This enables projects with existing migration directory structures to use srtd without post-processing scripts.

Closes #41 - requested by [@vinnymac](https://github.com/vinnymac)
