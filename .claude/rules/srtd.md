---
paths:
  - "**/supabase/migrations-templates/**/*.sql"
---

# SRTD Template Rules

You are editing an SRTD template file. Load `Skill('srtd-cli')` for full workflow context (watch mode, build commands, event types).

These templates are the source of truth for database objects and build to timestamped migrations.

## Required Pattern

All templates MUST be idempotent. Use these patterns:

**Functions** - `CREATE OR REPLACE` works for body changes:
```sql
CREATE OR REPLACE FUNCTION public.my_func()
RETURNS text AS $$
BEGIN
  RETURN 'result';
END;
$$ LANGUAGE plpgsql;
```

Use `DROP FUNCTION IF EXISTS` only when changing signature (params/return type).

**Views** - always replaceable:
```sql
CREATE OR REPLACE VIEW public.my_view AS
SELECT id, name FROM users WHERE active = true;
```

**Policies** - must drop first:
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ON table_name USING (auth.uid() = user_id);
```

**Triggers** - drop both trigger and function:
```sql
DROP TRIGGER IF EXISTS trigger_name ON table_name;
DROP FUNCTION IF EXISTS trigger_func;
CREATE FUNCTION trigger_func() RETURNS trigger AS $$
BEGIN
  -- logic
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER trigger_name AFTER INSERT ON table_name
  FOR EACH ROW EXECUTE FUNCTION trigger_func();
```

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

## Common Mistakes

- Missing `IF EXISTS` in DROP statements
- Forgetting SECURITY DEFINER on trigger functions
- Not dropping trigger AND function for trigger changes
- Changing function signature without DROP (params/return type changes fail with `CREATE OR REPLACE`)
