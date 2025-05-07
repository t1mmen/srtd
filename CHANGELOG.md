# srtd

## 0.5.0

### Minor Changes

- c5bba36: ### New `--bundle` option for `build` command

  - Added a new `--bundle` option to the `build` command to produce a single final migration.
  - Updated the `useTemplateProcessor` hook to handle the `--bundle` option.
  - Updated the `TemplateManager` class to support bundling all templates into a single migration file when the `--bundle` option is used.
  - Updated the `README.md` file to document the new `--bundle` option for the `build` command.
  - Added tests to cover the new `--bundle` option.
  - Ensured the bundled file name doesn’t become too long, but still hints at the templates it contains.
  - Ensured the build log correctly references the bundled files for all template records.
  - Ensured the comments in the final migrations have mentions of the original template it came from.

### Patch Changes

- e1fa468: Improve test stability and coverage

  - Created a reusable TestResource class for consistent resource management
  - Provides isolated filesystem and database resources for all tests
  - Added proper cleanup via the disposable pattern with automated resource tracking
  - Implemented resilient assertion patterns to reduce flaky tests
  - Enabled parallelized test execution with increased concurrency
  - Fixed TypeScript errors in tests
  - Added E2E test framework for simple CLI operation validation

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
