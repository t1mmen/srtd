---
name: srtd-cli
description: This skill should be used when the user mentions "srtd", "sql templates", "migrations-templates", "live reload sql", "supabase functions", when working with files in supabase/migrations-templates/, when .buildlog.json or srtd.config.json is detected, or when writing Postgres functions/views/triggers for Supabase.
---

# SRTD - Iterative SQL Template Development

## Workflow: Always Start Watch First

When working on SQL templates, immediately start watch in background:

```bash
srtd watch --json
```

Use `run_in_background: true`. This gives you a live feedback loop - every file save applies instantly to the local database.

Monitor with `TaskOutput`. Event types:
- `init` → watch started, lists templates found
- `templateChanged` → file saved, processing
- `templateApplied` → success, template is live in database
- `templateError` → failed, check `errorMessage` and `errorHint`
- `error` → system error (database connection, etc.)

## Writing Templates

Templates live in `supabase/migrations-templates/*.sql`. They must be idempotent (safe to run multiple times).

See the SRTD rule (injected when editing templates) for SQL patterns. Key points:
- Functions: `CREATE OR REPLACE` works; use `DROP` only when changing signature
- Policies/Triggers: Must `DROP IF EXISTS` first
- Dependencies: `-- @depends-on: helper.sql` comment at top

## WIP Templates

Use `.wip.sql` suffix for experiments. They apply locally but never build to migrations.

## Alternative: One-off Apply

If watch mode isn't needed (CI/CD, quick test):

```bash
srtd apply          # Apply all templates once
srtd apply --force  # Reapply all, even unchanged
```

## When Done Iterating

Only after templates are working and tested:

```bash
srtd build              # Generate migration files
srtd build --bundle     # All templates → single migration
srtd build --force      # Rebuild all, ignore cache
```

Then commit and create PR. The migration files show real diffs for review.

## Error Recovery

When `templateError` appears in watch output:
1. Read the `errorMessage` and `errorHint`
2. Fix the template file
3. Save - watch automatically re-applies
4. Check for `templateApplied` to confirm fix

## State Files

- `.buildlog.json` - tracks built migrations (commit this)
- `.buildlog.local.json` - tracks local DB state (gitignored)

If state gets confused: `srtd clear --reset` then restart watch.
