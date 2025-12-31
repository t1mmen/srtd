# `srtd` — Live-Reloading, declarative, SQL migration templates for Supabase and Postgres

[![NPM Version](https://img.shields.io/npm/v/%40t1mmen%2Fsrtd)](https://www.npmjs.com/package/@t1mmen/srtd)
[![Downloads](https://img.shields.io/npm/dt/%40t1mmen%2Fsrtd)](https://www.npmjs.com/package/@t1mmen/srtd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI/CD](https://github.com/t1mmen/srtd/actions/workflows/ci.yml/badge.svg)](https://github.com/t1mmen/srtd/actions/workflows/ci.yml)

> **The workflow of Vite or Nodemon—but for SQL**.
> Hot-reload SQL while you iterate. Build as migrations when it's time to ship.



![demo](./assets/demo.gif)

---

### Why srtd exists

Database development usually has a slow, frustrating feedback loop:

- Edit SQL in your IDE
- Copy to SQL editor or create migration
- Run it
  - Hit an error? Fix in IDE, copy again, run again
  - Works? Back to your IDE, until the next change
- Repeat

Code reviews aren't much better. Changing a single line in a function often shows up as a full rewrite in Git, making it hard to see what actually changed.

**srtd exists to fix both problems:**

- **Fast local iteration** with live reload
- **Clean, reviewable diffs** for database logic
- **Real migrations** for production safety

After [searching](https://news.ycombinator.com/item?id=37755076) for [two years](https://news.ycombinator.com/item?id=36007640) while building [Timely](https://www.timely.com)'s [Memory Engine](https://www.timely.com/memory-app) on Supabase, the itch needed to be scratched.

---

### The core idea

srtd intentionally separates **iteration**, **review**, and **execution**.

#### Templates are for humans

- Plain SQL files
- Concise and readable
- The primary thing you review in Git

#### Migrations are for databases

- Generated from templates
- Explicit and deterministic
- Safe to deploy in CI and production

Templates evolve over time. Migrations are the execution record.

---

### The diff problem—solved

Without templates, changing one line in a function means your PR shows a complete rewrite—the old `DROP` + `CREATE` replaced by a new one. Reviewers have to read the whole thing, _and_ manually compare it to the _last_ migration to touch the function to spot changes. Talk about friction!

With srtd, your PR shows what you actually changed;

<table>
<tr>
<td valign="top">

**Without srtd**

```diff
+ DROP FUNCTION IF EXISTS calculate_total;
+ CREATE FUNCTION calculate_total(order_id uuid)
+ RETURNS numeric AS $fn$
+ BEGIN
+   RETURN (SELECT SUM(price * quantity) FROM order_items);
+ END;
+ $fn$ LANGUAGE plpgsql;
```

</td>
<td  valign="top">

**With srtd**

```diff
  CREATE FUNCTION calculate_total(order_id uuid)
  RETURNS numeric AS $fn$
  BEGIN
-   RETURN (SELECT SUM(price) FROM order_items);
+   RETURN (SELECT SUM(price * quantity) FROM order_items);
  END;
  $fn$ LANGUAGE plpgsql;
```

</td>
</tr>
</table>

`git blame` works. Code reviews are useful. Your database logic is treated like real code.


## How To Use It

### Quick start

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

Edit `hello.sql`, save—it's live on your local database. No migration file, no restart, no waiting.

When ready to deploy:

```bash
srtd build            # Creates supabase/migrations/20241226_srtd-hello.sql
supabase migration up # Deploy with Supabase CLI
```

Already have functions deployed? Create templates for them, then register so srtd knows they're not new:

```bash
srtd register existing_function.sql  # Won't rebuild until the template actually changes
```

---

### Development loop (watch mode)

```bash
srtd watch   # Edit template → auto-applied to local DB
```

Hot reload is a **DX feature**. It exists to make iteration smooth and fast.

![Watch mode demo](./assets/watch-demo.gif)

---

### Shipping to production (generate migrations)


```bash
srtd build            # → migrations/20250109123456_srtd-template-name.sql
supabase migration up # Deploy via Supabase CLI
```

Generated migrations fully redefine objects—databases prefer explicit redefinition, humans prefer small diffs. srtd optimizes for both in different layers.

---

### WIP templates

Use `.wip.sql` files for experiments:

```
my_experiment.wip.sql  → Applies locally, never builds to migration
```

- Applied during `watch` and `apply`
- Excluded from `build`
- Safe to experiment without affecting production

When ready: `srtd promote my_experiment.wip.sql`

![WIP workflow demo](./assets/workflow-demo.gif)

---

### Template dependencies

Declare dependencies between templates with `@depends-on` comments:

```sql
-- @depends-on: helper_functions.sql
CREATE FUNCTION complex_calc() ...
```

During `apply` and `build`, templates are sorted so dependencies run first. Circular dependencies are detected and reported. Use `--no-deps` to disable.

---

### What works as templates

Templates need to be **idempotent**—safe to run multiple times. This works great for:

| Object       | Pattern                                       |
| ------------ | --------------------------------------------- |
| Functions    | `DROP FUNCTION IF EXISTS` + `CREATE FUNCTION` |
| Views        | `CREATE OR REPLACE VIEW`                      |
| RLS Policies | `DROP POLICY IF EXISTS` + `CREATE POLICY`     |
| Triggers     | Drop + recreate trigger and function          |
| Roles        | `REVOKE ALL` + `GRANT`                        |
| Enums        | `ADD VALUE IF NOT EXISTS`                     |

**Not for templates:** Table structures, indexes, data modifications—use regular migrations for those.

---

### Commands

```bash
srtd                     # Interactive menu
srtd watch               # Live reload—applies templates on save
srtd build               # Generate migration files
srtd apply               # Apply all templates once (no watch)
srtd register            # Mark templates as already deployed
srtd promote             # Convert .wip template to buildable
srtd clear               # Reset build state
srtd init                # Initialize config file
srtd doctor              # Validate setup and diagnose issues

# Build options
srtd build --force       # Rebuild all templates
srtd build --apply       # Apply immediately after building
srtd build --bundle      # Combine all into single migration
srtd build --no-deps     # Disable dependency ordering

# Apply options
srtd apply --force       # Force apply all templates
srtd apply --no-deps     # Disable dependency ordering

# Clear options
srtd clear --local       # Clear local build log only
srtd clear --shared      # Clear shared build log only
srtd clear --reset       # Reset everything to defaults

# Global options (all commands)
--json                   # Machine-readable output
--non-interactive        # Disable prompts (for scripts)
```

---

### JSON output

All commands support `--json` for machine-readable output (CI/CD, LLM integrations):

```bash
srtd build --json   # Single JSON object with results array and summary
srtd watch --json   # NDJSON stream (one event per line)
```

Output includes `success`, `command`, `timestamp`, and command-specific fields. Errors use a top-level `error` field.

Works great with [Claude Code](https://claude.ai/code) background tasks—pair with the [srtd-cli skill](./.claude/skills/srtd-cli.md) and [srtd rule](./.claude/rules/srtd.md) for SQL template guidance.

---

### Configuration

Defaults work for standard Supabase projects. Optional `srtd.config.json`:

```jsonc
{
  "templateDir": "supabase/migrations-templates",
  "migrationDir": "supabase/migrations",
  "pgConnection": "postgresql://postgres:postgres@localhost:54322/postgres",
  "migrationPrefix": "srtd",
  "migrationFilename": "$timestamp_$prefix$migrationName.sql",
  "wipIndicator": ".wip",
  "wrapInTransaction": true,
  "filter": "**/*.sql",
  "banner": "/* Auto-generated by srtd. Edit the template, not this file. */",
  "footer": ""
}
```

Run `srtd doctor` to validate your configuration and diagnose setup issues.

---

### Custom migration paths

The `migrationFilename` option lets you match your project's existing migration structure:

| Variable         | Description                         | Example          |
| ---------------- | ----------------------------------- | ---------------- |
| `$timestamp`     | Build timestamp (YYYYMMDDHHmmss)    | `20240315143022` |
| `$migrationName` | Template name (without .sql)        | `create_users`   |
| `$prefix`        | Migration prefix with trailing dash | `srtd-`          |

#### Examples

**Default (Supabase-style):**

```jsonc
{ "migrationFilename": "$timestamp_$prefix$migrationName.sql" }
// → migrations/20240315143022_srtd-create_users.sql
```

**Directory per migration (Prisma-style):**

```jsonc
{ "migrationFilename": "$timestamp_$migrationName/migration.sql" }
// → migrations/20240315143022_create_users/migration.sql
```

**Flyway-style (V prefix):**

```jsonc
{
  "migrationFilename": "V$timestamp__$migrationName.sql",
  "migrationPrefix": ""
}
// → migrations/V20240315143022__create_users.sql
```

Nested directories are created automatically.

---

### State tracking

| File                   | Purpose                         | Git       |
| ---------------------- | ------------------------------- | --------- |
| `.buildlog.json`       | What's been built to migrations | Commit    |
| `.buildlog.local.json` | What's applied to your local DB | Gitignore |

---

### FAQ

<details>
<summary><strong>Why do generated migrations redefine entire objects?</strong></summary>

Full redefinitions ensure deterministic, idempotent execution across environments. Templates encode intent; migrations encode execution.
</details>

<details>
<summary><strong>Can I use hot reload in production?</strong></summary>

No. Hot reload is strictly a local development feature. Production deploys always use generated migrations.
</details>

<details>
<summary><strong>Why plain SQL instead of a DSL?</strong></summary>

SQL is already the right language. srtd adds workflow improvements, not syntax.
</details>

<details>
<summary><strong>What does "srtd" stand for?</strong></summary>

Supabase Repeatable Template Definitions—but then general Postgres support happened, and... naming things is hard.
</details>

---

### Contributing

Bug fixes, docs, and test coverage welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

For development: [CLAUDE.md](./CLAUDE.md).

---

### More

- [Blog post](https://timm.stokke.me/blog/srtd-live-reloading-and-sql-templates-for-supabase)
- [MIT License](./LICENSE)

---

Built by [Timm Stokke](https://timm.stokke.me) with [Claude](https://claude.ai), after two years of being annoyed.
