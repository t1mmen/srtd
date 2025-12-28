# srtd

## 0.5.0

### Minor Changes

- 162ba2e: Add customizable migration filename templates with `migrationFilename` config option

  You can now customize how migration files are named and organized using template variables:

  - `$timestamp` - The migration timestamp (e.g., `20240101123456`)
  - `$migrationName` - The template name (e.g., `create_users`)
  - `$prefix` - The migration prefix with trailing dash (e.g., `srtd-`)

  **Example configurations:**

  ```json
  // Default (current behavior)
  { "migrationFilename": "$timestamp_$prefix$migrationName.sql" }
  // → migrations/20240101123456_srtd-create_users.sql

  // Directory-based organization (Issue #41)
  { "migrationFilename": "$migrationName/migrate.sql" }
  // → migrations/create_users/migrate.sql

  // Timestamp subdirectories
  { "migrationFilename": "$timestamp/$migrationName.sql" }
  // → migrations/20240101123456/create_users.sql
  ```

  This enables projects with existing migration directory structures to use srtd without post-processing scripts.

  Closes #41 - requested by [@vinnymac](https://github.com/vinnymac)

- 28f61fc: Drop React/Ink dependency in favor of Commander.js

  **Why this change:**

  - **Dependency isolation**: srtd previously depended on React and Ink, which caused conflicts when installed in projects using different React versions. The CLI now has zero React dependencies, eliminating version conflicts entirely.

  - **Non-TTY compatibility**: Improved support for running srtd in non-interactive environments (CI pipelines, LLM-driven automation like Claude Code). Commands now provide clear error messages when TTY is required, with flag-based alternatives for scripted usage.

  - **Architectural cleanup**: Internal rewrite from a monolithic design to a service-oriented architecture. This is transparent to users but improves reliability and maintainability.

  **New in this release:**

  - `build --bundle` (`-b`): Bundle all templates into a single migration file. Useful for deploying multiple related changes atomically.

  **No breaking changes**: All commands, flags, and configuration options remain identical. Existing `srtd.config.json` and `.buildlog.json` files work without modification.

### Patch Changes

- e2fd499: fix: resolve MigrationBuilder configuration bug

  Fix MigrationBuilder.fromConfig() passing undefined values that overwrote constructor defaults. This caused migrations to use undefined values instead of the intended defaults when optional config fields were not set.

  - Use conditional spread to only include defined config values
  - Add ResolvedMigrationBuilderConfig type to eliminate non-null assertions

- 229bf6f: chore: fix security vulnerabilities

  - Remove task-master-ai dev dependency (source of 4 vulnerabilities including high-severity CVEs in @anthropic-ai/claude-code and jsondiffpatch)
  - Update transitive dependencies via npm audit fix (fixes jws, @modelcontextprotocol/sdk, body-parser, brace-expansion vulnerabilities)

  Resolves all 12 Dependabot security alerts (9 high, 1 moderate, 2 low → 0 vulnerabilities).

- be7a6e3: fix: correct menu command invocation to not include command name in args

  When using standalone Commander.js commands, the command already knows its name.
  Passing `['node', 'srtd', 'init']` caused "too many arguments" error.
  Fixed to use `['node', 'srtd']` for all menu command invocations.

- e2fd499: fix: declare --non-interactive flag in CLI

  The --non-interactive flag was being checked but never declared in Commander.js, causing it to be silently ignored. Now properly declared as a global option.

  - Add --non-interactive option to main program
  - Fix exit code to preserve command status (was always 0 in non-interactive mode)

- 2c80386: Normalize line endings before hash calculation for cross-platform consistency

  Template hash values are now consistent across Windows (CRLF) and Unix/macOS (LF) environments. This prevents unnecessary migration rebuilds when the same template is processed on different platforms.

  Fix contributed by [@louisandred](https://github.com/louisandred) - see [PR #42](https://github.com/t1mmen/srtd/pull/42).

- 8ecaf8a: fix: validate build log and config files, warn on corruption

  When SRTD loads corrupted or malformed JSON files, it now validates the schema using Zod and displays clear warnings instead of silently discarding state. This addresses the root cause from issue #39 where corrupted build log JSON caused all templates to appear as needing rebuild.

  - Add Zod schema validation for build logs and config
  - Display yellow warnings in watch/apply/build commands
  - Graceful degradation: use defaults when validation fails
  - Unified ValidationWarning interface across codebase
  - Types derived from Zod schemas (single source of truth)

## 0.4.7

### Patch Changes

- b9890b0: fixes compatibility with Node 22

## 0.4.6

### Patch Changes

- 4febf28: Add tests for template registration handling, improve detection of incorrectly located templates
- 9006417: Attempt to identify "root of project", so srtd can be run from subdirectories as well.
- aaa78e7: fix `register` template path resolution

## 0.4.5

### Patch Changes

- 8391b2b: Add command for promoting .wip templates to buildable migration templates

## 0.4.4

### Patch Changes

- b7f723b: Various, minor polish on various UI components
- b7f723b: Only make watch mode enter fullscreen mode (to avoid blocking other commands from printing to terminal)

## 0.4.3

### Patch Changes

- 2af15f4: Fix incorrect import paths
- 1632a20: Add "make sure it renders" tests for all commands, scope naming in other tests a bit better.

## 0.4.2

### Patch Changes

- 8ea6ef7: Scope tests better, maybe improving how brittle they can be
- 688feae: fix: Build paths, db timeout

## 0.4.1

### Patch Changes

- 6a733b7: Add debug component to test db connections/watchers/etc
- 6a733b7: Streamline build & apply, allow build to also apply.

## 0.4.0

### Minor Changes

- e96e857: Allow clearning local, common logs, and resetting of config.
- e96e857: Greatly improve watch mode stability, while reducing and simplifying the implementation. Add tests.
- e96e857: Load templates created while `watch` is already running. Restarting no longer necessary

### Patch Changes

- e96e857: Ensure watcher cleanup on exit
- e96e857: Make CLI "fullscreen"

## 0.3.0

### Minor Changes

- fbe4240: Hopefully fix watch mode performance issues, tweak UI feedback, etc.

  (There does seem to be some timeout/hangup issues for apply/build, but shipping this anyway to fix the breaking bugs)

### Patch Changes

- fbe4240: Fix menu getting disabled when connection was established
- fbe4240: Improve reliability of q for quitting

## 0.2.3

### Patch Changes

- 748a1c8: Add update-notifier to notify users of new available versions
- 748a1c8: Notify in CLI if connection to database cannot be established
- 748a1c8: Support customizing migration filename prefix
- 748a1c8: Support forcibly building templates, irrespective of current build status.
- 748a1c8: Support forcibly applying templates directly to local db, irrespective of apply state

## 0.2.2

### Patch Changes

- 7b47799: Reference the correct scoped package name in README

## 0.2.1

### Patch Changes

- 95ca5af: General chores around publishing

## 0.2.0

### Minor Changes

- 515cfa9: Publish to npm under @t1mmen scope, fix package.json's bin definition

### Patch Changes

- db925ec: Add repomix/llm packaging of codebase for easier Claude project usage

## 0.1.2

### Patch Changes

- cb1578c: Fix release pipeline (hopefully)

## 0.1.1

### Patch Changes

- 589875b: Replace eslint and prettier with biome
- 85fd61c: Initial release
