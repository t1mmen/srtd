---
"@t1mmen/srtd": minor
---

Add automatic dependency ordering for SQL templates

Templates are now automatically sorted based on SQL dependencies before apply and build:
- Detects CREATE TABLE/VIEW/FUNCTION/TRIGGER/POLICY declarations
- Parses FROM, JOIN, REFERENCES clauses to find dependencies
- Topologically sorts templates so dependencies run before dependents
- Warns about circular dependencies (but continues execution)

Use `--no-deps` flag to disable if needed:
```bash
srtd apply --no-deps
srtd build --no-deps
```
