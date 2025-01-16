---
"@t1mmen/srtd": minor
---

### New `--bundle` option for `build` command

- Added a new `--bundle` option to the `build` command to produce a single final migration.
- Updated the `useTemplateProcessor` hook to handle the `--bundle` option.
- Updated the `TemplateManager` class to support bundling all templates into a single migration file when the `--bundle` option is used.
- Updated the `README.md` file to document the new `--bundle` option for the `build` command.
- Added tests to cover the new `--bundle` option.
- Ensured the bundled file name doesn’t become too long, but still hints at the templates it contains.
- Ensured the build log correctly references the bundled files for all template records.
- Ensured the comments in the final migrations have mentions of the original template it came from.
