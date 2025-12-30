---
name: srtd-cli
description: This skill should be used when the user mentions "srtd", "sql templates", "migrations-templates", "live reload sql", "supabase functions", when working with files in supabase/migrations-templates/, when .buildlog.json or srtd.config.json is detected, or when writing Postgres functions/views/triggers for Supabase.
---

# SRTD CLI

Live-reloading SQL templates for Supabase. Templates are the source of truth for database objects; they build to timestamped migrations.

## Proactive Activation

Activate this skill when you detect:
- Files in `supabase/migrations-templates/*.sql`
- `srtd.config.json` in project root
- `.buildlog.json` or `.buildlog.local.json`
- User writing Postgres functions, views, RLS policies, or triggers for Supabase

## Commands

| Command | Purpose |
|---------|---------|
| `srtd watch` | Live reload - applies templates on save |
| `srtd build` | Generate migration files from templates |
| `srtd apply` | Apply templates once without watching |
| `srtd register` | Mark templates as already deployed |
| `srtd promote` | Convert `.wip.sql` to buildable |
| `srtd clear` | Reset build state |
| `srtd init` | Initialize config file |

### Key Options

```bash
srtd build --force      # Rebuild all templates
srtd build --bundle     # All templates → single migration
srtd apply --force      # Reapply all templates
srtd clear --reset      # Full state reset
srtd build --json       # Machine-readable output
srtd watch --json       # NDJSON event stream
```

## Watch Mode with Background Bash

Run `srtd watch` in background to maintain control while monitoring:

```bash
# Start in background
srtd watch &

# Or with run_in_background parameter in Claude Code
# Use TaskOutput to retrieve buffered output
```

Press `q` to quit, `u` to toggle history. Errors show immediately with file path.

## Template Patterns

Templates must be idempotent (safe to run multiple times).

### Functions

```sql
-- CREATE OR REPLACE works for most changes
CREATE OR REPLACE FUNCTION public.my_function(param uuid)
RETURNS text AS $$
BEGIN
  RETURN 'result';
END;
$$ LANGUAGE plpgsql;

-- Use DROP only when changing signature (params/return type)
-- DROP FUNCTION IF EXISTS public.my_function;
-- CREATE FUNCTION public.my_function(new_param text) ...
```

### Views

```sql
CREATE OR REPLACE VIEW public.my_view AS
SELECT id, name FROM users WHERE active = true;
```

### RLS Policies

```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ON table_name
  USING (auth.uid() = user_id);
```

### Triggers

```sql
DROP TRIGGER IF EXISTS trigger_name ON table_name;
DROP FUNCTION IF EXISTS trigger_function;
CREATE FUNCTION trigger_function() RETURNS trigger AS $$
BEGIN
  -- logic
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER trigger_name
  AFTER INSERT ON table_name
  FOR EACH ROW EXECUTE FUNCTION trigger_function();
```

## Dependencies

Declare with `@depends-on` comment:

```sql
-- @depends-on: helper.sql
CREATE FUNCTION uses_helper() ...
```

Templates sort automatically. Circular dependencies detected.

## WIP Templates

Use `.wip.sql` suffix for work-in-progress:
- Applies locally during watch
- Never builds to migration
- Promote when ready: `srtd promote file.wip.sql`

## JSON Output

All commands support `--json` for CI/CD and LLM integrations:

```bash
srtd build --json   # Single JSON object
srtd watch --json   # NDJSON stream (one event per line)
```

Output structure:
```json
{"success": true, "command": "build", "results": [...], "summary": {...}}
```

Errors use `{"success": false, "error": {...}}` format.

## Configuration

`srtd.config.json` (optional):

```json
{
  "templateDir": "supabase/migrations-templates",
  "migrationDir": "supabase/migrations",
  "pgConnection": "postgresql://postgres:postgres@localhost:54322/postgres"
}
```

## State Files

| File | Purpose | Git |
|------|---------|-----|
| `.buildlog.json` | Tracks built migrations | Commit |
| `.buildlog.local.json` | Tracks local DB state | Gitignore |

## What SRTD Is For

**Use SRTD for** (idempotent):
- Functions, Views, RLS policies, Triggers, Roles, Enum extensions

**Use regular migrations for** (stateful):
- Table structures, Indexes, Data modifications, Column alterations

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Could not find project root" | Run from directory with `supabase/` folder |
| Database connection failed | Check config, run `supabase start` |
| Template not applying | Check SQL syntax, use `DROP IF EXISTS`, try `--force` |
| State out of sync | `srtd clear --reset` then `srtd watch` |
| "Interactive mode requires TTY" | Use flags: `srtd clear --local` not `srtd clear` |
