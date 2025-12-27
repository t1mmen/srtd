---
name: srtd-cli
description: Guide users through SRTD CLI for live-reloading SQL templates into Supabase. Use when users ask about srtd commands, template writing, migrations, watch mode, or Supabase database object management.
---

# SRTD CLI Usage Guide

SRTD makes database objects (functions, views, RLS policies, triggers) reviewable like regular code. Templates are the source of truth; they build to timestamped migrations.

## Quick Start

```bash
# Install
npm install -g @t1mmen/srtd   # or: npx @t1mmen/srtd

# Initialize in Supabase project
npx @t1mmen/srtd init

# Create first template
cat > supabase/migrations-templates/hello.sql << 'EOF'
DROP FUNCTION IF EXISTS public.hello;
CREATE FUNCTION public.hello() RETURNS text AS $$
BEGIN
  RETURN 'Hello from SRTD!';
END;
$$ LANGUAGE plpgsql;
EOF

# Start live reload
npx @t1mmen/srtd watch
```

## Commands

| Command | Purpose |
|---------|---------|
| `srtd` | Interactive menu |
| `srtd watch` | Live reload - edits apply instantly to local DB |
| `srtd build` | Generate migration files from templates |
| `srtd apply` | Apply templates to DB without generating migrations |
| `srtd register` | Mark existing templates as already deployed |
| `srtd promote` | Convert `.wip` template to buildable |
| `srtd clear` | Reset build logs |

### Command Options

```bash
srtd build --force          # Rebuild all templates
srtd build --bundle         # All templates → single migration
srtd apply --force          # Reapply all templates
srtd clear --local          # Clear local state only
srtd clear --shared         # Clear shared state only
srtd clear --reset          # Full reset
```

## Core Workflow

```
1. CREATE template     → supabase/migrations-templates/my_func.sql
2. WATCH mode         → srtd watch (auto-applies on save)
3. TEST locally       → Query your function in Supabase Studio
4. BUILD migration    → srtd build
5. DEPLOY            → supabase migration up
```

## Template Patterns

### Functions (Most Common)

```sql
-- Always DROP first to allow parameter changes
DROP FUNCTION IF EXISTS public.calculate_total;
CREATE FUNCTION public.calculate_total(order_id uuid)
RETURNS numeric AS $$
BEGIN
  RETURN (SELECT SUM(price * quantity) FROM order_items WHERE order_id = $1);
END;
$$ LANGUAGE plpgsql;
```

### RLS Policies

```sql
DROP POLICY IF EXISTS "users_own_data" ON profiles;
CREATE POLICY "users_own_data" ON profiles
  USING (auth.uid() = user_id);
```

### Views

```sql
CREATE OR REPLACE VIEW active_users AS
SELECT id, email, last_seen
FROM users
WHERE last_seen > NOW() - INTERVAL '30 days';
```

### Triggers

```sql
DROP TRIGGER IF EXISTS on_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user;

CREATE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Enum Extensions

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status') THEN
    CREATE TYPE status AS ENUM ('pending', 'active');
  END IF;
  ALTER TYPE status ADD VALUE IF NOT EXISTS 'archived';
END $$;
```

## WIP Templates

Use `.wip.sql` suffix for work-in-progress:

```bash
# Create WIP template (applies locally, never builds to migration)
touch supabase/migrations-templates/experimental.wip.sql

# When ready to deploy
srtd promote experimental.wip.sql
# Renames to experimental.sql, next build creates migration
```

## Registering Existing Objects

When adopting SRTD on existing project:

```bash
# Create templates for existing functions
# Then register them (prevents immediate migration generation)
srtd register my_existing_function.sql another_function.sql

# Or interactively select which to register
srtd register
```

## Configuration

`srtd.config.json` (optional - sensible defaults):

```jsonc
{
  "templateDir": "supabase/migrations-templates",
  "migrationDir": "supabase/migrations",
  "pgConnection": "postgresql://postgres:postgres@localhost:54322/postgres",
  "wipIndicator": ".wip",
  "migrationPrefix": "srtd",
  "wrapInTransaction": true
}
```

## State Files

| File | Purpose | Git |
|------|---------|-----|
| `.buildlog.json` | Tracks built migrations | Commit |
| `.buildlog.local.json` | Tracks local DB state | Gitignore |

## What SRTD Is For

**Use SRTD for** (idempotent, replaceable):
- Functions
- Views
- RLS policies
- Triggers
- Roles/permissions
- Enum extensions

**Use regular migrations for** (stateful):
- Table structures
- Indexes
- Data modifications
- Column alterations

## Troubleshooting

### "Could not find project root"
Run from directory containing `supabase/` folder.

### Database connection failed
Check `pgConnection` in config. Default Supabase local:
```
postgresql://postgres:postgres@localhost:54322/postgres
```
Ensure Supabase is running: `supabase start`

### Template not applying
1. Check for SQL syntax errors (shown in watch output)
2. Ensure template uses idempotent pattern (DROP IF EXISTS)
3. Try `srtd apply --force`

### Build logs out of sync
```bash
srtd clear --reset   # Full reset
srtd watch           # Reapply all templates
```

### "Interactive mode requires TTY"
Use flags instead: `srtd clear --local` not `srtd clear`

## Watch Mode Tips

- Press `u` to toggle history display
- Press `q` to quit
- Errors show immediately with file path and message
- Multiple terminals: one for watch, one for testing
