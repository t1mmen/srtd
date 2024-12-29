# srtd - Supabase Repeatable Template Definitions

`srtd` streamlines development and maintenance of Postgres functions, stored procedures, and RLS policies in [Supabase](https://supabase.com) projects through a template-based workflow.

## Why This Tool Exists

After years in frontend development, returning to SQL with Supabase highlighted two pain points:

1. Code reviews were challenging since function changes appear as complete rewrites rather than diffs
2. Local development required tedious manual steps to test database changes

Finding no simple solution (besides complex DSLs or expensive tools), we built `srtd` to solve these specific problems. While primarily designed to scratch our own itch, it should work with any Postgres setup using SQL files for migrations.

> [!NOTE]
> This is a focused tool that does one thing well - making Postgres development smoother in Supabase. It's not expanding beyond Postgres, but PR's for improvements are welcome!

## Key Benefits

- **Real-time Development**: Changes to templates automatically update your local database
- **Clear Code Reviews**: See actual changes instead of entire function redefinitions
- **Version Control Friendly**: Track meaningful template changes in Git history
- **Supabase Compatible**: Works alongside existing migration workflows

## Installation

```bash
npm install -g srtd  # Global installation
# or
npm install --save-dev srtd  # Project-level installation
```

## Quick Start

1. **Set up your project**:

   ```bash
   srtd init
   ```

2. **Create a template** (e.g., `supabase/migrations-templates/my_function.sql`):

   ```sql
   DROP FUNCTION IF EXISTS my_function();
   CREATE OR REPLACE FUNCTION my_function()
   RETURNS void AS $$
   BEGIN
     -- Your function logic here
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **Start development mode**:

   ```bash
   srtd watch  # Changes auto-apply to local database
   ```

4. **Generate migration when ready**:
   ```bash
   srtd build  # Creates timestamped migration file
   supabase migrate up  # Apply using Supabase CLI
   ```

## Commands

- `srtd init` - Create project structure and config
- `srtd watch` - Auto-apply template changes to local database
- `srtd build` - Generate Supabase migration files
- `srtd apply` - Build and apply templates directly
- `srtd register` - Register existing templates
- `srtd status` - View template status

## Best For

✅ Database objects requiring full redefinition:

- Functions and stored procedures
- RLS (Row-Level Security) policies
- Custom roles and permissions

❌ Not recommended for:

- Table definitions
- Indexes
- Incremental changes

## Configuration

`.srtdrc.json` is created during initialization:

```json
{
  "wipIndicator": ".wip",
  "filter": "**/*.sql",
  "banner": "You very likely **DO NOT** want to manually edit this generated file.",
  "footer": "",
  "wrapInTransaction": true,
  "templateDir": "supabase/migrations-templates",
  "migrationDir": "supabase/migrations",
  "buildLog": "supabase/migrations-templates/.buildlog.json",
  "localBuildLog": "supabase/migrations-templates/.buildlog.local.json",
  "pgConnection": "postgresql://postgres:postgres@localhost:54322/postgres"
}
```

## Advanced Features

### Template Status Tracking

`srtd` maintains two logs:

- `.buildlog.json` - Tracks build status (commit to Git)
- `.buildlog.local.json` - Tracks local changes (gitignored)

### Work in Progress

Add `.wip.sql` extension to templates under development:

```bash
my_function.wip.sql  # Won't generate migrations during build
```

### Register Existing Objects

Import existing database objects into the template system:

```bash
srtd register my_function.sql
```

## Best Practices

1. Write idempotent templates (safe to run multiple times)
2. One logical unit per template
3. Use `.wip.sql` for experimental changes
4. Never edit generated migrations directly
5. Commit templates and migrations together

## License

MIT License - See [LICENSE](LICENSE) for details.
