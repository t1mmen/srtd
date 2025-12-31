---
"@t1mmen/srtd": major
---

# srtd 1.0.0 - One Year, 100 Stars, Zero React Dependencies

**Happy New Year!** Today marks exactly 365 days since srtd's first public release on December 30, 2024. What started as a tool to scratch a two-year itch has grown into a production-ready solution for managing database logic in Supabase projects.

## What's New in 1.0.0

### Architecture Overhaul
- **Dropped React/Ink dependencies** - Zero React version conflicts with your projects
- **Service-oriented design** - Cleaner internals with DatabaseService, StateService, FileSystemService, and Orchestrator
- **Non-TTY compatible** - Works seamlessly in CI pipelines and LLM-driven automation

### New Commands & Features
- **`srtd doctor`** - Diagnose setup issues with 10 automated checks
- **`--json` flag** - Machine-readable output for all commands (NDJSON streaming for watch)
- **`@depends-on` comments** - Explicit template dependency ordering with cycle detection
- **`--bundle` flag** - Combine templates into a single migration file
- **Custom migration filenames** - `$timestamp`, `$migrationName`, `$prefix` template variables

### Developer Experience
- **Actionable error hints** - 17 Postgres error codes mapped to plain-English guidance
- **Claude Code integration** - Skills and rules for AI-assisted SQL development
- **Refreshed CLI UI** - Unified display with arrow format, WIP indicators, and relative timestamps
- **Watch mode improvements** - Press `b` to build, historic activity on startup

### Stability & Polish
- Fixed race conditions in signal handlers and auto-save
- Build log and config validation with graceful degradation
- Cross-platform line ending normalization
- 12 Dependabot security vulnerabilities resolved
- 528+ tests, all passing

## The Journey

December 2024: First release with basic watch/build/apply commands
December 2025: Production-grade tool with diagnostics, integrations, and zero external React dependencies

Thank you to everyone who starred, used, and provided feedback. Here's to another year of making database development less painful!

---

*Built by [Timm Stokke](https://timm.stokke.me) with [Claude](https://claude.ai), after two years of being annoyed.*
