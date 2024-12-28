# `srtd` - Supabase Repeatable Template Definitions

`srtd` is a CLI tool designed to simplify and supercharge the development workflow for **Postgres functions**, **stored procedures**, **RLS policies**, and other database objects in the **Supabase ecosystem**. It lets you focus on iteration and refinement, with templates that seamlessly integrate into your existing Supabase migration setup.

---

## Why Use `srtd`?

### Simplified Iterative Workflow

Developing Postgres functions, policies, and similar database objects can be cumbersome. Without `srtd`, you might:

1. Copy/paste changes into Supabase's SQL editor.
2. Rerun those changes until you're satisfied.
3. Ship them as timestamped migrations.

With `srtd`, you skip all of that overhead:

- Simply edit your template files locally.
- Changes are automatically applied to your database in real-time (using `watch` mode).
- Iterate and refine directly in your templates.
- Once satisfied, **build the template into a Supabase-compatible migration**.

No more tedious copy/pasting or unnecessary steps. Just focus on writing SQL.

---

### Easier Code Reviews

Postgres functions and similar objects are challenging to review in pull requests. A small change in a 300-line function redefines the **entire** function, making it hard to spot what actually changed. With `srtd`:

- Templates make changes explicit, highlighting **what changed** rather than re-reviewing the entire object.
- Code reviewers can focus on **intent and quality** instead of deciphering diffs.

---

### Drastically Improved Developer Experience

`srtd` is built with developers in mind:

- **Less friction**: Focus on SQL changes, not workflow complexity.
- **No new concepts**: Continue using "just Postgres." Templates don’t interfere with how Supabase migrations work; they simply improve your workflow.
- **Full control**: You define the templates in standard SQL, keeping them idempotent (safe to run repeatedly).

---

### Just Postgres, Better

`srtd` doesn’t replace Supabase migrations. Instead:

- It **produces migrations** from repeatable templates.
- Supabase continues to manage the migrations themselves.

By embracing templates, you gain a single source of truth that is easier to understand than:

- Sifting through existing migrations.
- Querying the database to figure out how a function, policy, or RLS works today.

---

### Best Suited For…

The template system is ideal for **Postgres database objects that need to be fully redefined when changed**, such as:

- **Functions** and **stored procedures**
- **RLS (Row-Level Security) policies**
- **Custom roles or permissions**

It is **NOT well-suited** for:

- Table definitions
- Indexes
- Other objects where incremental changes are more common.

---

## Key Features

- **Iterate Faster**: Automatically apply changes from templates to your database in real-time during development.
- **Git-Friendly**: Track changes at the source (templates) for cleaner history and easier reviews.
- **Safe Redefinitions**: Write repeatable SQL that can run multiple times without unintended side effects.
- **No Migration Overhead**: Focus on your local database first, then ship production migrations only when ready.
- **Supabase Compatibility**: Works alongside Supabase migrations, without interfering.

---

## Installation

```bash
npm install -g srtd
```

Or, add it locally to your project:

```bash
npm install srtd --save-dev
```

---

## Quick Start

1. **Initialize your project**:

   ```bash
   srtd init
   ```

   This sets up the directory structure and configuration.

2. **Create a template**:

   ```bash
   touch supabase/migrations-templates/my_function.sql
   ```

3. **Write repeatable SQL**:

   ```sql
   DROP FUNCTION IF EXISTS my_function();
   CREATE OR REPLACE FUNCTION my_function()
   RETURNS void AS $$
   BEGIN
     -- Function logic
   END;
   $$ LANGUAGE plpgsql;
   ```

4. **Build and apply your templates**:

   ```bash
   srtd build --apply
   ```

5. **Iterate with live reload**:
   ```bash
   srtd watch
   ```

---

## Commands

| Command              | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `srtd init`          | Initialize the project (directory structure, configs) |
| `srtd build`         | Build migrations from templates                       |
| `srtd build --apply` | Build and apply templates directly to the database    |
| `srtd watch`         | Watch templates and apply changes live                |
| `srtd register`      | Register existing functions/templates into the system |
| `srtd status`        | View the status of all templates                      |

---

## Advanced Usage

### Watching Templates

During development, use the watch mode to apply templates live:

```bash
srtd watch
```

When a template file is updated, changes will be applied to the database automatically.

---

### Registering Existing Objects

If you have existing database objects that you'd like to manage with templates:

```bash
srtd register my_function.sql
```

This marks the template as already applied, without running it. Future changes will generate new migrations.

---

### Example Template

```sql
-- Safe and repeatable template
DROP FUNCTION IF EXISTS example_function();
CREATE OR REPLACE FUNCTION example_function()
RETURNS void AS $$
BEGIN
  RAISE NOTICE 'Hello, world!';
END;
$$ LANGUAGE plpgsql;
```

---

## Configuration

The `.srtdrc.json` file is automatically created during `srtd init`. It includes:

```json
{
  "templateDir": "supabase/migrations-templates",
  "migrationDir": "supabase/migrations",
  "pgConnection": "postgresql://postgres:postgres@localhost:5432/postgres",
  "wrapInTransaction": true,
  "wipIndicator": ".wip"
}
```

You can customize these defaults to suit your project needs.

---

## Build Logs

`srtd` maintains two build logs:

1. **Common Log (`.buildlog.json`)**: Tracks the state of all templates.
2. **Local Log (`.localbuildlog.json`)**: Tracks locally applied templates.

Logs ensure consistency between migrations and prevent unnecessary rebuilds.

---

## Best Practices

- Write templates that are **idempotent** (safe to run multiple times).
- Use `.wip.sql` extensions for experimental changes.
- Keep templates small and focused on a single logical unit (e.g., one function per template).
- Only commit templates and generated migrations once they are stable.
- Never edit generated migrations directly—rebuild them via templates.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
