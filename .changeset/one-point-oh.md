---
"@t1mmen/srtd": major
---

# srtd 1.0.0 - One Year, 100 Stars

**Happy New Year!** 365 days since srtd's first public release. What started as a tool to scratch a two-year itch is now solid enough for day-to-day use.

## What's New

### Architecture
- **Dropped React/Ink** - Zero React version conflicts
- **Non-TTY compatible** - Works in CI and with LLM automation

### Features
- **`srtd doctor`** - Diagnose setup issues
- **`--json` flag** - Machine-readable output (NDJSON for watch)
- **`@depends-on`** - Template dependency ordering
- **`--bundle`** - Combine templates into single migration
- **Custom filenames** - `$timestamp`, `$migrationName`, `$prefix` variables

### DX
- Actionable Postgres error hints
- Claude Code integration
- Refreshed CLI with better formatting
- Watch mode: press `b` to build

### Stability
- Race condition fixes
- Build log validation
- Cross-platform line endings
- Security fixes
- 528+ tests passing

Thanks to everyone who starred and provided feedback!
