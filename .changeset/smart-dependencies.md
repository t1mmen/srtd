---
"@t1mmen/srtd": minor
---

Add dependency ordering for SQL templates via @depends-on comments

Templates can now declare dependencies on other templates using comments:

```sql
-- @depends-on: users_table.sql, roles.sql
CREATE VIEW active_users AS ...
```

Features:
- Templates sorted so dependencies apply/build first
- Circular dependencies detected and reported
- Case-insensitive filename matching
- Multiple @depends-on comments supported

Use `--no-deps` flag to disable if needed:
```bash
srtd apply --no-deps
srtd build --no-deps
```
