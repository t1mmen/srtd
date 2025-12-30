# `srtd` — Live-Reloading SQL Templates for Postgres

> Edit `my_function.sql` → save → it's running on your local database. No migration dance, no restart. When you're ready to ship, build to migrations that show real diffs in PRs.

[![NPM Version](https://img.shields.io/npm/v/%40t1mmen%2Fsrtd)](https://www.npmjs.com/package/@t1mmen/srtd)
[![Downloads](https://img.shields.io/npm/dt/%40t1mmen%2Fsrtd)](https://www.npmjs.com/package/@t1mmen/srtd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI/CD](https://github.com/t1mmen/srtd/actions/workflows/ci.yml/badge.svg)](https://github.com/t1mmen/srtd/actions/workflows/ci.yml)

[![demo](./readme-demo.gif)](./readme-demo.gif)


## Why This Exists

Two things drove me crazy while building [Timely](https://www.timely.com)'s [Memory Engine](https://www.timely.com/memory-app) on Supabase:

**1. Iterating on database logic was painfully slow.**
Edit in your IDE → copy to Supabase SQL editor → run → hit an error → fix in IDE → copy again → repeat. Or: create migration → apply → error → create another migration → apply. Either way, more ceremony than actual coding.

**2. Code reviews for database changes were useless.**
Every function change showed up as a complete rewrite in git. Reviewers couldn't see what actually changed. `git blame` was worthless.

After [searching](https://news.ycombinator.com/item?id=37755076) for [two years](https://news.ycombinator.com/item?id=36007640), I built `srtd`.


## How It Works

Your functions, views, RLS policies, and triggers live in **template files**—plain SQL that's the source of truth.

```
supabase/migrations-templates/
├── notify_changes.sql
├── user_policies.sql
└── active_subscriptions.sql
```

**During development:** `srtd watch` monitors your templates. Save a file, it applies to your local database instantly. Like hot reload, but for Postgres.

**When you're ready to ship:** `srtd build` generates timestamped migrations from your templates.

```
Edit template → Instantly applies locally → Build migration → Deploy
```


## Quick Start

```bash
npm install -g @t1mmen/srtd
cd your-supabase-project

# Create a template
mkdir -p supabase/migrations-templates
cat > supabase/migrations-templates/hello.sql << 'EOF'
DROP FUNCTION IF EXISTS hello;
CREATE FUNCTION hello() RETURNS text AS $$
BEGIN RETURN 'Hello from srtd!'; END;
$$ LANGUAGE plpgsql;
EOF

# Start watch mode
srtd watch
```

Edit `hello.sql`, save, and it's live on your local database. No migration file, no restart, no waiting.

When ready to deploy:

```bash
srtd build            # Creates supabase/migrations/20241226_srtd-hello.sql
supabase migration up # Deploy with Supabase CLI
```


## The Diff Problem, Solved

Without templates, changing one line in a function means your PR shows a complete rewrite—the old `DROP` + `CREATE` replaced by a new one. Reviewers have to read the whole thing to spot your change.

With templates, your PR shows what you actually changed:

```diff
  CREATE FUNCTION calculate_total(order_id uuid)
  RETURNS numeric AS $$
  BEGIN
-   RETURN (SELECT SUM(price) FROM order_items WHERE order_id = $1);
+   RETURN (SELECT SUM(price * quantity) FROM order_items WHERE order_id = $1);
  END;
  $$ LANGUAGE plpgsql;
```

`git blame` works. Code reviews are useful. Your database logic is treated like real code.


## Commands

| Command | What it does |
|---------|--------------|
| `srtd` | Interactive menu |
| `srtd watch` | Live reload—applies templates on save |
| `srtd build` | Generate migration files |
| `srtd apply` | Apply all templates once (no watch) |
| `srtd register` | Mark templates as already deployed |
| `srtd promote` | Convert `.wip` template to buildable |
| `srtd clear` | Reset build state |

Options: `build --force` rebuilds all, `build --bundle` combines into single migration.


## What Works as Templates

Templates need to be **idempotent**—safe to run multiple times. This works great for:

| Object | Pattern |
|--------|---------|
| Functions | `DROP FUNCTION IF EXISTS` + `CREATE FUNCTION` |
| Views | `CREATE OR REPLACE VIEW` |
| RLS Policies | `DROP POLICY IF EXISTS` + `CREATE POLICY` |
| Triggers | Drop + recreate trigger and function |
| Roles | `REVOKE ALL` + `GRANT` |
| Enums | `ADD VALUE IF NOT EXISTS` |

**Not for templates:** Table structures, indexes, data modifications—use regular migrations for those.


## WIP Templates

Experimenting? Add `.wip.sql` extension:

```
my_experiment.wip.sql  → Applies locally, never builds to migration
```

When it's ready: `srtd promote my_experiment.wip.sql`


## Template Dependencies

Declare dependencies between templates with `@depends-on` comments:

```sql
-- @depends-on: helper_functions.sql
CREATE FUNCTION complex_calc() ...
```

During `apply` and `build`, templates are sorted so dependencies run first. Circular dependencies are detected and reported. Use `--no-deps` to disable.


## Existing Projects

Already have functions in your database? Create templates for them, then:

```bash
srtd register existing_function.sql another_one.sql
```

This tells srtd "these are already deployed—don't generate migrations until they change."


## Configuration

Defaults work for standard Supabase projects. Optional `srtd.config.json`:

```jsonc
{
  "templateDir": "supabase/migrations-templates",
  "migrationDir": "supabase/migrations",
  "pgConnection": "postgresql://postgres:postgres@localhost:54322/postgres",
  "migrationPrefix": "srtd",
  "migrationFilename": "$timestamp_$prefix$migrationName.sql",
  "wipIndicator": ".wip",
  "wrapInTransaction": true
}
```


## Custom Migration Paths

The `migrationFilename` option lets you match your project's existing migration structure using template variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `$timestamp` | Build timestamp (YYYYMMDDHHmmss) | `20240315143022` |
| `$migrationName` | Template name (without .sql) | `create_users` |
| `$prefix` | Migration prefix with trailing dash | `srtd-` |

### Examples

**Default (Supabase-style):**
```jsonc
{ "migrationFilename": "$timestamp_$prefix$migrationName.sql" }
// → migrations/20240315143022_srtd-create_users.sql
```

**Directory per migration ([Prisma](https://prisma.io)-style):**
```jsonc
{ "migrationFilename": "$timestamp_$migrationName/migration.sql" }
// → migrations/20240315143022_create_users/migration.sql
```

**Folder-based ([Issue #41](https://github.com/t1mmen/srtd/issues/41) request):**
```jsonc
{ "migrationFilename": "$migrationName/migrate.sql", "migrationPrefix": "" }
// → migrations/create_users/migrate.sql
```

**Flyway-style (V prefix):**
```jsonc
{ "migrationFilename": "V$timestamp__$migrationName.sql", "migrationPrefix": "" }
// → migrations/V20240315143022__create_users.sql
```

**Simple timestamp:**
```jsonc
{ "migrationFilename": "$timestamp.sql", "migrationPrefix": "" }
// → migrations/20240315143022.sql
```

Nested directories are created automatically.


## State Tracking

| File | Purpose | Git |
|------|---------|-----|
| `.buildlog.json` | What's been built to migrations | Commit |
| `.buildlog.local.json` | What's applied to your local DB | Gitignore |


## Contributing

Bug fixes, docs, and test coverage welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

For development: [CLAUDE.md](./CLAUDE.md).


## More

- [Blog post](https://timm.stokke.me/blog/srtd-live-reloading-and-sql-templates-for-supabase)
- [MIT License](./LICENSE)

---

Built by [Timm Stokke](https://timm.stokke.me) with [Claude](https://claude.ai), after two years of being annoyed.
