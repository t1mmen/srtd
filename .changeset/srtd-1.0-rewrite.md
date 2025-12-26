---
"@t1mmen/srtd": major
---

Architecture rewrite: Ink/React → Commander.js

**CLI Framework:**
- Replaced Ink/React with Commander.js + Inquirer + chalk
- All commands maintain same interface and flags

**Service Layer:**
- New Orchestrator coordinates all operations
- StateService: single source of truth for build logs
- DatabaseService: single source of truth for database connections
- FileSystemService: file watching and template discovery

**Watch Mode:**
- Added history display (last 10 events)
- Added `u` key toggle for show/hide history
- Event-driven screen updates (no live timers)
- Fixed race condition with pendingRecheck mechanism

**Code Cleanup:**
- Removed 14 duplicate/orphaned utility files
- Proper resource cleanup with Promise.allSettled
- Per-directory config caching

307 tests passing.
