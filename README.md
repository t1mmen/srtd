# `srtd` 🪄 Supabase Repeatable Template Definitions



> Live-reloading SQL templates for [Supabase](https://supabase.com) projects. DX supercharged! 🚀

[![NPM Version](https://img.shields.io/npm/v/%40t1mmen%2Fsrtd)](https://www.npmjs.com/package/@t1mmen/srtd)
[![Downloads](https://img.shields.io/npm/dt/%40t1mmen%2Fsrtd)](https://www.npmjs.com/package/@t1mmen/srtd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI/CD](https://github.com/t1mmen/srtd/actions/workflows/ci.yml/badge.svg)](https://github.com/t1mmen/srtd/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/t1mmen/srtd/graph/badge.svg?token=CIMAZ55KCJ)](https://codecov.io/gh/t1mmen/srtd)


[![video demo](./readme-demo.gif)](./readme-demo.gif)


`srtd` enhances the [Supabase](https://supabase.com) DX by adding **live-reloading SQL** from templates into local db.

**Templates act as single-source-of-truth of your database objects**, that `build` to regular SQL migrations; This makes for sane code reviews and functional change history, (e.g `git blame` works as expected).


📖 Blog: [Introducing `srtd`: Live-Reloading SQL Templates for Supabase](https://timm.stokke.me/blog/srtd-live-reloading-and-sql-templates-for-supabase)

### Why This Exists 🤔

While building [Timely](https://www.timely.com)'s next-generation [Memory Engine](https://www.timely.com/memory-app) on [Supabase](https://supabase.com), we found ourselves facing two major annoyances:

1. Code reviews were painful - function changes showed up as complete rewrites, `git blame` was useless
2. Designing and iterating on database changes locally was full of friction, no matter which workflow we tried

I spent [nearly two](https://news.ycombinator.com/item?id=37755076) [years looking](https://news.ycombinator.com/item?id=36007640) for something pre-existing, to no avail. Sufficiently fed up, I paired with [Claude](https://claude.ai) to eliminate these annoyances.

Say hello to `srtd`.

[![screenshot of srtd](./readme-screenshot.png)](./readme-screenshot.png)

## Key Features ✨

- **Live Reload**: Changes to your SQL templates instantly update your local database
- **Templates as source of truth**: Templates are the source of (non-mutable) database objects
- **Just SQL**: Templates as just SQL, and `build` to standard [Supabase](https://supabase.com) migrations when you're ready to ship
- **Sane code reviews**: Templates evolve like regular code, with diffs in PR's working `git blame`.
- **Developer Friendly**: Interactive CLI with visual feedback for all operations.

Built specifically for projects using the standard [Supabase](https://supabase.com) stack (but probably works alright for other Postgres-based projects, too).

## Quick Start 🚀

### Requirements

- Node.js v20.18.1 or higher
- [Supabase](https://supabase.com) project initialized (in `/supabase`).

### Installation


> [!WARNING]
> Projects using React 19 may not work with per-project installation of `srtd` (ref [Ink CLI issue](https://github.com/vadimdemedes/ink/issues/688)). Until resolved, **global installation is recommended.**



```bash
# Global installation
npm install -g @t1mmen/srtd

# Project installation
npm install --save-dev @t1mmen/srtd

# Or run directly
npx @t1mmen/srtd
```

### Setup

```bash
cd your-supabase-project
npx @t1mmen/srtd init # Creates srtd.config.json, not required
```

### Create Your First Template

Create `supabase/migrations-templates/my_function.sql`:

```sql
DROP FUNCTION IF EXISTS public.my_function; -- Makes it easier to change args later
CREATE FUNCTION my_function()
RETURNS void AS $$
BEGIN
  -- Your function logic here
END;
$$ LANGUAGE plpgsql;
```

### Development Workflow

1. Start watch mode:
```bash
npx @t1mmen/srtd watch  # Changes auto-apply to local database
```

2. When ready to deploy:
```bash
npx @t1mmen/srtd build     # Creates timestamped migration file
supabase migration up      # Apply using Supabase CLI
```

> [!TIP]
> To reduce noise in PR's, consider adding `supabase/migrations/*srtd*.sql linguist-generated=true` to your [`.gitattributes` file.](https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github) (unless you manually edit the generated files)


## The Power of Templates 💪

Without templates, the smallest change to a function would show up as a complete rewrite in your version control system. With templates, the diff is clear and concise.


### Perfect For 🎯

✅ Database functions:
```diff
  -- Event notifications
  DROP FUNCTION IF EXISTS notify_changes;
  CREATE FUNCTION notify_changes()
  RETURNS trigger AS $$
  BEGIN
    PERFORM pg_notify(
      'changes',
      json_build_object('table', TG_TABLE_NAME, 'id', NEW.id)::text
    );
+   RAISE NOTICE 'Notified changes for %', TG_TABLE_NAME; -- Debug logging
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
```

✅ Row-Level Security (RLS):
```diff
  -- Replace/update policies safely
  DROP POLICY IF EXISTS "workspace_access" ON resources;
  CREATE POLICY "workspace_access" ON resources
    USING (workspace_id IN (
      SELECT id FROM workspaces
      WHERE organization_id = auth.organization_id()
+       AND auth.user_role() NOT IN ('pending')
    ));
```

✅ Views for data abstraction:
```diff
  CREATE OR REPLACE VIEW active_subscriptions AS
  SELECT
    s.*,
    p.name as plan_name,
    p.features
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
-  WHERE s.status = 'active';
+  WHERE s.status = 'active'
+    AND s.expires_at > CURRENT_TIMESTAMP;
```

✅ Roles and Permissions:
```diff
  -- Revoke all first for clean state
  REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;

  -- Grant specific access
  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
+ GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO admin;
```

✅ Safe Type Extensions:
```diff
 DO $$
 BEGIN
   -- Add new enum values idempotently
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
     CREATE TYPE notification_type AS ENUM ('email', 'sms');
   END IF;

   -- Extend existing enum safely
   ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'push';
   ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'pusher';
   ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'webhook';
+  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'whatsapp';
 END $$;
```

✅ Triggers
```diff
 DROP TRIGGER IF EXISTS on_new_user ON auth.users;
 DROP FUNCTION IF EXISTS public.setup_new_user;

 CREATE FUNCTION public.setup_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
 SET search_path = public AS $$
 BEGIN
   -- Existing logic for new users

+  -- Your new changes go here..
 END;
 $$;

 CREATE TRIGGER on_new_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.setup_new_user ();
```

> [!TIP]
> You don't need to specifying parameters in drop functions. E.g `DROP FUNCTION IF EXISTS public.my_function;`. This ensures you don't end up with multiple functions with the same name, but different parameters.

### Not Recommended For:
* ❌ Table structures
* ❌ Indexes
* ❌ Data modifications
* ❌ Non-idempotent operations

Use regular [Supabase](https://supabase.com) migrations for these cases.


## Commands 🎮

### Interactive Mode

Running `npx @t1mmen/srtd` without arguments opens an interactive menu. All commands can also be run directly:

- 👀 `srtd watch` - Watch and auto-apply changes
- 🏗️  `srtd build [--force] [--bundle]` - Generate migrations from templates
- ▶️  `srtd apply [--force]` - Apply templates directly to local database
- ✍️  `srtd register [file.sql...]` - Mark templates as already built
- 🚀  `srtd promote - [file.sql ...]` - Promote WIP template to buildable templates
- 🧹 `srtd clean` - Remove all logs and reset config

> [!IMPORTANT]
> `watch` and `apply` commands modify your local database directly and don't clean up after themselves. Use with caution!

## Configuration 📝

`srtd.config.json` can be created with `init` command. It is not necessary, if the defaults suit your needs.

```jsonc
{
  // Prevents building templates with this extension
  "wipIndicator": ".wip",

  // Migration file naming: 20211001000000_srtd-my_function.sql
  "migrationPrefix": "srtd",

  // Template discovery
  "filter": "**/*.sql",

  // Migration file comments
  "banner": "You very likely **DO NOT** want to manually edit this generated file.",
  "footer": "",

  // Wrap migrations in transaction
  "wrapInTransaction": true,

  // File paths
  "templateDir": "supabase/migrations-templates",
  "migrationDir": "supabase/migrations",
  "buildLog": "supabase/migrations-templates/.buildlog.json",
  "localBuildLog": "supabase/migrations-templates/.buildlog.local.json",

  // Database connection
  "pgConnection": "postgresql://postgres:postgres@localhost:54322/postgres"
}
```

## Other Features 🔧

### Work in Progress Templates

Add `.wip.sql` extension to prevent migration generation:
```bash
my_function.wip.sql  # Only applied locally, never built
```

Make a WIP template buildable as migration by renaming it, or using the `promote` command:
```bash
npx @t1mmen/srtd promote my_function.wip.sql
```

### Register Existing Objects

Registering a template is useful when you're creating templates for what is already in your database. This avoids generating migrations on `build` (until they're changed)

```bash
# Register specific template
npx @t1mmen/srtd register my_function.sql another_fn.sql

# Interactive multi-select UI
npx @t1mmen/srtd register
```

This can be useful when setting up `srtd` for an existing project, where you may have hundreds of existing functions, views, etc that you want as templates, but don't want to generate migrations until changed later.

### Template State Management

The state of templates are stored to..

- [`.buildlog.json`](https://github.com/t1mmen/srtd/blob/main/supabase/migrations-templates/.srtd.buildlog.json) - Migration build state (commit this)
- `.buildlog.local.json` - Local database state (add to `.gitignore`)

This helps `srtd` identify when templates are changed, to only `build` (as migrations) or `apply`  the necessary changes (directly to local db).

## Development 🛠️

### Local Setup

```bash
# Clone and install
git clone https://github.com/stokke/srtd.git
cd srtd
npm install

# Development
npm run dev     # Watch mode
npm test        # Run tests
npm start       # Run CLI
npm start:link  # Build, npm link, and run CLI

# Quality Checks
npm run typecheck       # Type checking
npm run lint            # Lint and fix
npm run format          # Format code
npm run test:coverage   # Test coverage
```

## Contributing 🤝

While feature-complete for our needs, we welcome:

- 🐛 Bug fixes and reliability improvements
- 📚 Documentation improvements
- ✅ Test coverage enhancements
- ⚡️ Performance optimizations

### Contribution Process

1. Create a [changeset](https://github.com/changesets/changesets) (`npm run changeset`)
2. Ensure tests pass (`npm test`)
3. Follow existing code style
4. Update documentation

Note: New features are evaluated based on alignment with project scope.

## Built With 🛠️

### Terminal UI
- [Ink](https://github.com/vadimdemedes/ink) - React for CLI interfaces
- [Pastel](https://github.com/vadimdemedes/pastel) - Next-like framework for Ink
- [Figures](https://github.com/sindresorhus/figures) - Unicode symbols
- [Chokidar](https://github.com/paulmillr/chokidar) - File watcher
- [update-notifier](https://github.com/sindresorhus/update-notifier) - Version checks
- [Zod](https://zod.dev/) - Schema validation
- [Conf](https://github.com/sindresorhus/conf) - Config management
- [vhs](https://github.com/charmbracelet/vhs) - Video recording


## License

MIT License - see [LICENSE](LICENSE) file.

---

Made with 🪄 by [Timm Stokke](https://timm.stokke.me) & [Claude Sonnet](https://claude.ai)

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/t1mmen)
