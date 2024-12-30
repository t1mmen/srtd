# srtd 🪄

Live-reloading SQL templates for your Supabase project.

`srtd` makes developing Postgres functions, stored procedures, and RLS policies in Supabase projects a joy by enabling live reloading during development and clean migrations for deployment.

## Why This Exists 🤔

Working with Supabase, we found ourselves facing two challenges:

1. Code reviews were painful - function changes showed up as complete rewrites rather than helpful diffs
2. Testing database changes locally meant constant copy-paste into SQL console

Rather than reaching for complex DSLs or expensive tools, we built something simple that solved our specific problems. While we built it for ourselves, it should work nicely with any Postgres setup using SQL migrations.

## Key Features ✨

- **Live Reload**: Changes to your SQL templates instantly update your local database
- **Clean Migrations**: Generate proper Supabase migrations when you're ready to deploy
- **Developer Friendly**: Interactive CLI with visual feedback for all operations

## Quick Start 🚀

First, install `srtd` globally or in your project:

```bash
npm install -g srtd  # Global installation
# or
npm install --save-dev srtd  # Project installation
```

Then set up in your Supabase project:

```bash
cd your-supabase-project
srtd init
```

Create a template (e.g., `supabase/migrations-templates/my_function.sql`):

```sql
CREATE OR REPLACE FUNCTION my_function()
RETURNS void AS $$
BEGIN
  -- Your function logic here
END;
$$ LANGUAGE plpgsql;
```

Start development mode:

```bash
srtd watch  # Changes auto-apply to local database
```

When ready to deploy:

```bash
srtd build  # Creates timestamped migration file
supabase migrate up  # Apply using Supabase CLI
```

## Commands 🎮

Run `srtd` without arguments for an interactive menu, or use these commands directly:

- 🏗️  `build` - Generate Supabase migrations from templates
- ▶️  `apply` - Apply templates directly to local database
- ✍️  `register [file.sql]` - Mark templates as already built, so only future changes produce migrations
- 👀 `watch` - Watch templates and apply changes instantly

## Perfect For 🎯

Ideal for database objects that need full redefinition:

✅ Functions and stored procedures:
```sql
CREATE OR REPLACE FUNCTION search_products(query text)
RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
    SELECT * FROM products
    WHERE to_tsvector('english', name || ' ' || description)
    @@ plainto_tsquery('english', query);
END;
$$ LANGUAGE plpgsql;
```

✅ Row-Level Security (RLS) policies:
```sql
CREATE POLICY "users can view own data"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);
```

✅ Roles and permissions:
```sql
CREATE ROLE authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
```

Not recommended for:

❌ Table structures (use regular migrations)
❌ Indexes (use regular migrations)
❌ Data modifications (use regular migrations)

## Configuration 📝

During initialization, `srtd` creates a `srtd.config.json`:

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

## Advanced Features 🔧

### Work in Progress Templates

Add `.wip.sql` extension to templates under development to prevent accidental migration generation:

```bash
my_function.wip.sql  # Won't generate migrations during build
```

### Template State Management

`srtd` maintains two logs:

- `.buildlog.json` - Tracks which templates have been built into migrations (commit this)
- `.buildlog.local.json` - Tracks local database state (add to .gitignore)

### Register Existing Objects

Import existing database objects into the template system:

```bash
srtd register my_function.sql  # Won't generate new migration until changed
```

## Development 🛠️

This project is built with TypeScript and uses modern Node.js features. To contribute:

1. Set up the development environment:
```bash
git clone https://github.com/yourusername/srtd.git
cd srtd
npm install
```

2. Run tests:
```bash
npm test
```

3. Build the project:
```bash
npm run build
```

## Project Status 📊

This tool was built to solve specific problems we faced in our Supabase development workflow. While it's considered feature-complete for our needs, we welcome improvements through pull requests, especially for:

- Bug fixes
- Documentation improvements
- Performance optimizations
- Test coverage

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
