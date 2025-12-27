# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: SRTD (Supabase Repeatable Template Definitions)

CLI tool for live-reloading SQL templates into Supabase local databases. Templates are the single source of truth for database objects (functions, views, RLS policies, triggers), enabling sane code reviews and `git blame`. Templates `build` to timestamped migrations for deployment.

**For development work, load the SRTD skill first:**
```
Skill('srtd')
```

## Development Commands

```bash
npm install              # Install dependencies
npm run dev              # Watch mode compilation
npm test                 # Run all tests
npm run test:watch       # Interactive test mode
npm run test:e2e         # End-to-end tests only
npm run typecheck        # Type checking
npm run lint             # Biome check + fix
npm run lint:unsafe      # Biome with unsafe auto-fixes
npm start                # Run CLI directly (tsx src/cli.ts)
npm run start:link       # Build, link globally, run
npm run supabase:start   # Start Supabase container (needed for e2e tests)
npm run supabase:stop    # Stop Supabase
npm run changeset        # Create changeset for versioning
```

### Running a single test

```bash
npx vitest run src/__tests__/path/to/test.test.ts
npx vitest run -t "test name pattern"
```

## Key Paths

- `src/cli.ts` - Commander.js entry point
- `src/services/Orchestrator.ts` - Central coordinator
- `src/services/StateService.ts` - Build log management
- `src/services/DatabaseService.ts` - Connection pooling with retry
- `src/commands/watch.ts` - Most complex command
- `src/utils/config.ts` - Config loading

## State Files

- `.buildlog.json` - Tracks what was BUILT to migrations (commit this)
- `.buildlog.local.json` - Tracks what was APPLIED to local DB (gitignore)

## Tech Stack

- **CLI**: Commander.js, Inquirer, Ora, Chalk
- **DB**: PostgreSQL with `pg` driver
- **File watching**: Chokidar
- **Validation**: Zod 4
- **Testing**: Vitest with v8 coverage
- **Linting**: Biomejs (strict mode)

## Code Style

- Single quotes, trailing commas (ES5), always semicolons
- 2-space indent, 100 char line width
- `noExplicitAny: error` (disabled in test files)

## Validation Before Commit

```bash
npm run typecheck && npm run lint && npm test
```

## Commits & Pull Requests

Follow conventional commit format. Use changesets for versioning:

```bash
npm run changeset  # Create changeset describing changes
```
