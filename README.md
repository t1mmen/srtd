# `srtd` 🪄 Supabase Repeatable Template Definitions

Live-reloading SQL templates for [Supabase](https://supabase.com) projects. DX supercharged! 🚀

[![npm version](https://badge.fury.io/js/@t1mmen%2Fsrtd.svg)](https://www.npmjs.com/package/@t1mmen/srtd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`srtd` enhances the [Supabase](https://supabase.com) DX by adding live-reloading SQL templates into local db. The single-source-of-truth template ➡️ migrations system brings sanity to code reviews, making `git blame` useful.

Built specifically for projects using the standard [Supabase](https://supabase.com) stack (but probably works alright for other Postgres-based projects, too).

## Why This Exists 🤔

While building [Timely](https://www.timely.com)'s next-generation [Memory Engine](https://www.timely.com/memory-app) on [Supabase](https://supabase.com), we found ourselves facing two major annoyances:

1. Code reviews were painful - function changes showed up as complete rewrites rather than helpful diffs
2. Designing and iterating on database changes locally meant constant friction, like the dance around copy-pasting into SQL console

After over a year of looking-but-not-finding a better way, I paired up with [Claude](https://claude.ai) to eliminate these annoyances. Say hello to `srtd`.

## Key Features ✨

- **Live Reload**: Changes to your SQL templates instantly update your local database
- **Single Source of Truth**: Templates are the source of all (non-mutable) database objects, improving code-review clarity
- **Just SQL**: Templates build as standard [Supabase](https://supabase.com) migrations when you're ready to deploy
- **Developer Friendly**: Interactive CLI with visual feedback for all operations

## Requirements

- Node.js v20.x or higher
- [Supabase](https://supabase.com) CLI installed and project initialized (with `/supabase` directory)
- Local Postgres instance running (typically via `supabase start`)

## Quick Start 🚀

### Installation

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
srtd init
```

### Create Your First Template

Create `supabase/migrations-templates/my_function.sql`:

```sql
CREATE OR REPLACE FUNCTION my_function()
RETURNS void AS $$
BEGIN
  -- Your function logic here
END;
$$ LANGUAGE plpgsql;
```

### Development Workflow

1. Start watch mode:
```bash
srtd watch  # Changes auto-apply to local database
```

2. When ready to deploy:
```bash
srtd build        # Creates timestamped migration file
supabase migration up  # Apply using Supabase CLI
```

## Commands 🎮

### Interactive Mode

Running `srtd` without arguments opens an interactive menu:

```
❯ 🏗️  build - Build Supabase migrations from templates
  ▶️  apply - Apply migration templates directly to database
  ✍️  register - Register templates as already built
  👀  watch - Watch templates for changes, apply directly to database
```

### CLI Mode

- 🏗️  `build [--force]` - Generate migrations from templates
- ▶️  `apply [--force]` - Apply templates directly to local database
- ✍️  `register [file.sql]` - Mark templates as already built
- 👀 `watch` - Watch and auto-apply changes

> [!IMPORTANT]
> `watch` and `apply` commands modify your local database directly and don't clean up after themselves. Use with caution!

## Perfect For 🎯

### Ideal Use Cases

✅ Database functions:
```sql
-- Reusable auth helper
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS uuid AS $$
  SELECT auth.uid()::uuid;
$$ LANGUAGE sql SECURITY DEFINER;

-- Event notifications
CREATE OR REPLACE FUNCTION notify_changes()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'changes',
    json_build_object('table', TG_TABLE_NAME, 'id', NEW.id)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

✅ Row-Level Security (RLS):
```sql
-- Replace/update policies safely
DROP POLICY IF EXISTS "workspace_access" ON resources;
CREATE POLICY "workspace_access" ON resources
  USING (workspace_id IN (
    SELECT id FROM workspaces
    WHERE organization_id = auth.organization_id()
  ));
```

✅ Views for data abstraction:
```sql
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT
  s.*,
  p.name as plan_name,
  p.features
FROM subscriptions s
JOIN plans p ON p.id = s.plan_id
WHERE s.status = 'active'
  AND s.expires_at > CURRENT_TIMESTAMP;
```

✅ Roles and Permissions:
```sql
-- Revoke all first for clean state
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;

-- Grant specific access
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
```

✅ Safe Type Extensions:
```sql
DO $$
BEGIN
  -- Add new enum values idempotently
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('email', 'sms');
  END IF;

  -- Extend existing enum safely
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'push';
END $$;
```

### Not Recommended For

* ❌ Table structures
* ❌ Indexes
* ❌ Data modifications
* ❌ Non-idempotent operations

Use regular [Supabase](https://supabase.com) migrations for these cases.

## The Power of Templates 💪

Templates make code reviews meaningful. Consider this PR adding priority to a notification function:

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

Without templates, this would appear as a complete rewrite in your PR.

## Configuration 📝

`srtd.config.json` created during initialization:

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

### Template State Management

Two state tracking files:
- `.buildlog.json` - Migration build state (commit this)
- `.buildlog.local.json` - Local database state (add to `.gitignore`)

### Register Existing Objects

Import existing database objects:
```bash
# Register specific template
srtd register my_function.sql

# Interactive multi-select UI
srtd register
```

## Development 🛠️

### Local Setup

```bash
# Clone and install
git clone https://github.com/stokke/srtd.git
cd srtd
npm install

# Development
npm run dev    # Watch mode
npm test       # Run tests
npm start      # Build, link, run

# Quality Checks
npm run typecheck        # Type checking
npm run lint            # Lint and fix
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

## License

MIT License - see [LICENSE](LICENSE) file.

---

Made with 🪄 by [Timm Stokke](https://timm.stokke.me) & [Claude Sonnet](https://claude.ai)
