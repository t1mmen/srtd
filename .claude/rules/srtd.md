---
paths:
  - "supabase/migrations-templates/**/*.sql"
  - "**/migrations-templates/**/*.sql"
---

# SRTD Template Rules

You are editing an SRTD template file. These templates are the source of truth for database objects and build to timestamped migrations.

## Required Pattern

All templates MUST be idempotent. Use these patterns:

**Functions**: `CREATE OR REPLACE FUNCTION name...` (use `DROP FUNCTION IF EXISTS` only when changing signature)
**Views**: `CREATE OR REPLACE VIEW name AS...`
**Policies**: `DROP POLICY IF EXISTS "name" ON table; CREATE POLICY...`
**Triggers**: Drop trigger AND function first, then recreate both

## Template Dependencies

If this template depends on another, add at the top:

```sql
-- @depends-on: other_template.sql
```

## WIP Templates

Files ending in `.wip.sql`:
- Apply locally during `srtd watch`
- Never build to migrations
- Promote when ready: `srtd promote filename.wip.sql`

## Testing Workflow

1. Run `srtd watch` in background (use `run_in_background` or `&`)
2. Edit template, save
3. Check watch output for errors
4. Test in Supabase Studio or psql
5. When ready: `srtd build`

## Common Mistakes

- Missing `IF EXISTS` in DROP statements
- Forgetting SECURITY DEFINER on trigger functions
- Not dropping trigger AND function for trigger changes
- Changing function signature without DROP (params/return type changes fail with `CREATE OR REPLACE`)
