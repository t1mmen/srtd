---
"@t1mmen/srtd": minor
---

Add template dependency ordering via @depends-on comments

Templates can declare dependencies on other templates:

```sql
-- @depends-on: users.sql, roles.sql
CREATE VIEW active_users AS ...
```

During `apply` and `build`, templates are topologically sorted so dependencies run first. Circular dependencies are detected and warned about.

Features:
- Explicit dependency declaration via comments
- Topological sorting with cycle detection
- Case-insensitive filename matching
- `--no-deps` flag to disable ordering

Does not apply to `watch` command (file-at-a-time execution).
