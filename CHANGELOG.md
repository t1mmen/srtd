# srtd

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
