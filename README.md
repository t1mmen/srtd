# `srtd` 🪄 Supabase Repeatable Template Definitions

Live-reloading SQL templates for [Supabase](https://supabase.com) projects. DX supercharged! 🚀


`srtd` enhances the [Supabase](https://supabase.com) DX by adding live-reloading SQL templates. The single-source-of-truth template ➡️ migrations system brings sanity to code reviews, and the workflow of iterating on database functions, RLS policies, etc.

Built specifically for projects using the standard [Supabase](https://supabase.com) stack (but probably works alright for other Postgres-based projects, too).

## Why This Exists 🤔

While building [Timely](https://www.timely.com)'s next-generation [Memory Engine](https://www.timely.com/memory-app) on [Supabase](https://supabase.com), we found ourselves facing two major annoyances:

1. Code reviews were painful - function changes showed up as complete rewrites rather than helpful diffs
2. Designing and iterating on database changes locally meant constant friction, like the dance around copy-pasting into SQL console

After over a year of looking-but-not-finding a better way, I paired up with [Claude](https://claude.ai) to eliminate these annoyances. Say hello to `srtd`.

## Key Features ✨

- **Live Reload**: Changes to your SQL templates instantly update your local database
- **Single Source of Truth**: Templates are the source of all (non-mutable) database objects, making changes _and_ code reviews a breeze
- **Just SQL**: Templates build as standard [Supabase](https://supabase.com) migrations when you're ready to deploy
- **Developer Friendly**: Interactive CLI with visual feedback for all operations

## Requirements

- Node.js v20.x or higher
- [Supabase](https://supabase.com) CLI installed and project initialized (with `/supabase` directory)
- Local Postgres instance running (typically via `supabase start`)

## Quick Start 🚀

First, install `srtd` globally or in your project:

```bash
npm install -g @t1mmen/srtd  # Global installation
# or
npm install --save-dev @t1mmen/srtd  # Project installation
# or
npx @t1mmen/srtd  # Run directly
```

Then set up in your [Supabase](https://supabase.com) project:

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
npx @t1mmen/srtd watch  # Changes auto-apply to local database
```

When ready to deploy:

```bash
npx @t1mmen/srtd build  # Creates timestamped migration file
supabase migrate up  # Apply using Supabase CLI
```

## Commands 🎮

Running `srtd` without arguments opens an interactive menu:

```
❯ 🏗️  build - Build Supabase migrations from templates
  ▶️  apply - Apply migration templates directly to database
  ✍️  register - Register templates as already built
  👀  watch - Watch templates for changes, apply directly to database
```

Or use these commands directly:

- 🏗️  `build` - Generate [Supabase](https://supabase.com) migrations from templates
- ▶️  `apply` - Apply templates directly to local database
- ✍️  `register [file.sql]` - Mark templates as already built (interactive UI if no file specified)
- 👀 `watch` - Watch templates and apply changes instantly

## Perfect For 🎯

Ideal for [Supabase](https://supabase.com) database objects that need full redefinition:

✅ Functions and stored procedures:
```sql
CREATE OR REPLACE FUNCTION search_products(query text, category_id uuid DEFAULT NULL)
RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
    SELECT p.* FROM products p
    LEFT JOIN product_categories pc ON pc.product_id = p.id
    WHERE to_tsvector('english',
      p.name || ' ' ||
      p.description || ' ' ||
      p.tags || ' ' ||
      COALESCE((
        SELECT string_agg(c.name, ' ')
        FROM categories c
        WHERE c.id = ANY(p.category_ids)
      ), '')
    ) @@ plainto_tsquery('english', query)
    AND (category_id IS NULL OR pc.category_id = category_id);
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
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
```

**Not recommended for:**

* ❌ Table structures
* ❌ Indexes
* ❌ Data modifications
* ❌ Anything that is not fully re-definable, really.

In these cases, use regular [Supabase](https://supabase.com) migrations.

## The Power of Templates 💪

Here's why templates make your life easier. Consider a PR that adds priority to our notification dispatch function.

With templates, the change is clear and reviewable:

```diff
CREATE OR REPLACE FUNCTION dispatch_notification(
    user_id uuid,
    type text,
    payload jsonb
  ) RETURNS uuid AS $$
  DECLARE
    notification_id uuid;
    user_settings jsonb;
  BEGIN
    -- Get user notification settings
    SELECT settings INTO user_settings
    FROM user_preferences
    WHERE id = user_id;

    -- Create notification record
+   -- Include priority based on notification type
    INSERT INTO notifications (
      id,
      user_id,
      type,
      payload,
+     priority,
      created_at
    ) VALUES (
      gen_random_uuid(),
      dispatch_notification.user_id,
      type,
      payload,
+     COALESCE((SELECT priority FROM notification_types WHERE name = type), 'normal'),
      CURRENT_TIMESTAMP
    )
    RETURNING id INTO notification_id;
```

Without templates, the same change appears as a complete new file in your PR.

## Configuration 📝

During initialization, `srtd` creates a `srtd.config.json`:

```jsonc
{
  "wipIndicator": ".wip", // Prevents generation of templates with this extension
  "migrationPrefix": "srtd", // 20211001000000_srtd-my_function.sql
  "filter": "**/*.sql", // Glob pattern for templates
  "banner": "You very likely **DO NOT** want to manually edit this generated file.",
  "footer": "",
  "wrapInTransaction": true, // BEGIN; ... COMMIT;
  "templateDir": "supabase/migrations-templates",
  "migrationDir": "supabase/migrations",
  "buildLog": "supabase/migrations-templates/.buildlog.json",
  "localBuildLog": "supabase/migrations-templates/.buildlog.local.json",
  "pgConnection": "postgresql://postgres:postgres@localhost:54322/postgres"
}
```

## Other Features 🔧

### Work in Progress Templates

Add `.wip.sql` extension to templates under development to prevent accidental migration generation:

```bash
my_function.wip.sql  # Won't generate migrations during build
```

### Template State Management

`srtd` maintains two logs:

- `.buildlog.json` - Tracks which templates have been built into migrations (commit this)
- `.buildlog.local.json` - Tracks local database state (add to `.gitignore`)

### Register Existing Objects

Import existing database objects into the template system:

```bash
srtd register my_function.sql  # Won't generate new migration until changed
# or
srtd register  # Opens interactive UI for selecting multiple templates
```

## Development 🛠️

This project uses TypeScript and modern Node.js features. To contribute:

1. Set up the development environment:
```bash
git clone https://github.com/stokke/srtd.git
cd srtd
npm install
```

2. Start development:
```bash
npm run dev  # Watches for changes
npm test     # Runs tests
npm start    # Builds, links, and runs CLI
```

3. Other useful commands:
```bash
npm run typecheck       # Type checking
npm run lint           # Lint and fix
npm run test:coverage  # Test coverage
```

## Contributing 🤝

This tool was built to solve specific problems in our [Supabase](https://supabase.com) development workflow. While it's considered feature-complete for our needs, we welcome improvements through pull requests, especially for:

- Bug fixes and reliability improvements
- Documentation improvements and examples
- Test coverage
- Performance optimizations

### Contribution Guidelines

1. Create a [changeset](https://github.com/changesets/changesets) (`npm run changeset`)
2. Ensure tests pass (`npm test`)
3. Follow existing code style
4. Update documentation as needed

Note that new features may or may not be accepted depending on whether they align with the project's focused scope. However, improvements to existing functionality, documentation, and tests are always welcome!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Made with 🪄 by [Timm Stokke](https://timm.stokke.me) & [Claude Sonnet](https://claude.ai)
