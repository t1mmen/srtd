---
paths:
  - "**/supabase/migrations-templates/**/*.sql"
---

# SRTD Template

Load `Skill('srtd-cli')` for full context.

**Idempotency rules:**
- Functions/Views: `CREATE OR REPLACE` (use `DROP` only when changing signature)
- Policies: `DROP IF EXISTS` then `CREATE`
- Triggers: Drop both trigger AND function first

**Quick reference:**
- Dependencies: `-- @depends-on: other.sql` at top
- WIP files: `.wip.sql` suffix (local only, won't build)
- Watch mode: `srtd watch --json` in background
