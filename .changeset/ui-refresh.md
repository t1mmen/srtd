---
"@t1mmen/srtd": minor
---

Complete CLI UI refresh with unified data model and improved developer experience:

**Unified Type System**
- New `TemplateResult` type unifies build, apply, and watch displays
- Distinct statuses: `success`, `built`, `unchanged`, `skipped`, `error`, `changed`
- `RenderContext` provides command-aware rendering

**Visual Improvements**
- Arrow format display: `template.sql → migration.sql` 
- WIP templates show "(wip)" indicator and are properly skipped in build
- Log-style ordering: oldest at top, newest at bottom (chronological)
- Color-coded status: green (success/built), yellow (skipped), red (error), dim (unchanged)

**Watch Mode Enhancements**
- Press `b` to trigger build without leaving watch mode
- "Pending build" section shows templates needing build with reasons
- Historic activity loaded from build log on startup
- Stacked events collapse consecutive changes (e.g., "changed, applied")
- buildOutdated annotation when changes invalidate previous builds

**Error Display**
- SQL context with line numbers around error location
- Caret positioning for precise error indication
- Inline error context in watch mode activity log

**New Utilities**
- `formatPath`: Smart path truncation (`…/parent/file.sql`), filename extraction
- `formatTime`: Relative time ("5m ago") and timestamp formatting
- `errorContext`: Shared gutter-style error rendering

**Dead Code Cleanup**
- Removed legacy `badge.ts` (stat badges)
- Removed legacy `results.ts` (old rendering)
- Replaced with unified `resultsTable.ts`

**Testing**
- Added `StateService.getRecentActivity` tests
- 13+ new UI component test files
- Expanded command integration tests
