# ASCII Screenshots - SRTD UI

Captured: 2025-12-28

---

## 1. Help

```
Usage: srtd [options] [command]

Supabase Repeatable Template Definitions - Live-reloading SQL templates

Options:
  -V, --version            output the version number
  --non-interactive        Disable interactive prompts and menus
  -h, --help               display help for command

Commands:
  init                     Initialize srtd in the current project
  apply [options]          Apply built migrations to the database
  build [options]          Build migrations from templates
  clear [options]          Clear build logs or reset configuration
  promote [template]       Promote a WIP template by removing the WIP indicator
                           from its filename
  register [templates...]  Register templates to track them in the build log
  watch                    Watch templates for changes and auto-apply
  help [command]           display help for command
```

---

## 2. Build (unchanged)

```
 srtd  Build v0.4.7

- Building templates...
● test.sql               → 20251225224707_srtd-test.sql     12/25 14:47

Unchanged: 1
```

---

## 3. Build (forced)

```
 srtd  Build (forced) v0.4.7

- Building templates...
✔ test.sql               → 20251228174055_srtd-test.sql

Built: 1
```

---

## 4. Apply (unchanged)

```
 srtd  Apply v0.4.7

- Applying templates...
● test.sql               → local db                         12/28 09:40

Unchanged: 1
```

---

## 5. Apply (with errors)

```
 srtd  Apply v0.4.7

- Applying templates...
✘ broken.sql
● test.sql               → local db                         12/28 09:40

Unchanged: 1  Errors: 1

ERRORS
───────────────────────────────────────────────────
✘ broken.sql
  │ SQL syntax error

───────────────────────────────────────────────────
```

---

## 6. Watch (startup)

```
 srtd  Watch v0.4.7

1 templates
src: supabase/migrations-templates  →  dest: supabase/migrations

───────────────────────────────────────────────────
q quit  u hide history
```

---

## 7. Watch (with activity - changed)

```
 srtd  Watch v0.4.7

1 templates
src: supabase/migrations-templates  →  dest: supabase/migrations

Recent activity:
17:53:59  ● …/migrations-templates/test.sql changed

───────────────────────────────────────────────────
q quit  u hide history
```

---

## 8. Watch (with error)

```
 srtd  Watch v0.4.7

1 templates  •  1 errors
src: supabase/migrations-templates  →  dest: supabase/migrations

Recent activity:
17:54:01  ✘ …/migrations-templates/test.sql error
          │ Database connection failed after 3 attempts: Database connection failed
17:53:59  ● …/migrations-templates/test.sql changed

Errors:
  …/migrations-templates/test.sql: Database connection failed after 3 attempts: Database connection failed

───────────────────────────────────────────────────
q quit  u hide history
```

---

## Legend

| Icon | Meaning |
|------|---------|
| ✔ | Success (built/applied) |
| ● | Unchanged (dimmed) |
| ✘ | Error |

## Format

- **Results**: `template.sql → target`
  - Build target: migration filename
  - Apply target: `local db`
  - Error: no arrow (nothing created)
- **Unchanged rows**: dimmed with last action date
- **Watch events**: comma-separated states (e.g., `changed, applied`)
