---
"@t1mmen/srtd": minor
---

Drop React/Ink dependency in favor of Commander.js

**Why this change:**

- **Dependency isolation**: srtd previously depended on React and Ink, which caused conflicts when installed in projects using different React versions. The CLI now has zero React dependencies, eliminating version conflicts entirely.

- **Non-TTY compatibility**: Improved support for running srtd in non-interactive environments (CI pipelines, LLM-driven automation like Claude Code). Commands now provide clear error messages when TTY is required, with flag-based alternatives for scripted usage.

- **Architectural cleanup**: Internal rewrite from a monolithic design to a service-oriented architecture. This is transparent to users but improves reliability and maintainability.

**New in this release:**

- `build --bundle` (`-b`): Bundle all templates into a single migration file. Useful for deploying multiple related changes atomically.

**No breaking changes**: All commands, flags, and configuration options remain identical. Existing `srtd.config.json` and `.buildlog.json` files work without modification.
