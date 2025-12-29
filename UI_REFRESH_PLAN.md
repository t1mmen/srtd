# UI Refresh Plan - Holistic DRY Approach

## Core Insight

All views (build, apply, watch) display the same data shape differently. Current implementation has per-view rendering logic. Refactor to single unified renderer with context options.

**Key principle:** This refactor REPLACES existing interfaces, not adds alongside them. Remove old types.

---

## 1. Unified Data Model

```typescript
// src/ui/types.ts - REPLACES existing ResultRow, UnchangedRow, etc.
interface TemplateResult {
  template: string;
  status: 'success' | 'unchanged' | 'error' | 'needs-build';
  target?: string;         // migration file OR "local db"
  timestamp?: Date;        // when action occurred
  errorMessage?: string;   // error details if status === 'error'
}

interface RenderContext {
  command: 'build' | 'apply' | 'watch';
  forced?: boolean;        // for "(forced)" in header
}
```

**Note:** `needs-build` status for watch mode to indicate templates requiring build action.

---

## 2. Single Results Renderer

**File:** `src/ui/resultsTable.ts` (refactor existing)

```typescript
function renderResults(results: TemplateResult[], context: RenderContext): void
```

**Rendering rules:**
| Status | Icon | Template | Arrow | Target | Time |
|--------|------|----------|-------|--------|------|
| success | ✔ (green) | normal | → | shown | - |
| unchanged | ● (dim) | dim | → (dim) | dim | relative |
| error | ✘ (red) | normal | - | - | - |

**Target logic:**
- `build`: Show migration filename
- `apply`: Show "local db"
- `watch`: Show based on last action type

**Time format:**
- Use relative time everywhere: "2 days ago", "5 min ago", "just now"
- Only show on unchanged rows (success rows are "now")

---

## 3. Time Formatting Utility

**File:** `src/utils/formatTime.ts` (extend existing)

Three display modes:

```typescript
type TimeFormat = 'time' | 'relative' | 'full';

function formatTimestamp(date: Date, format: TimeFormat): string
```

| Format | Example | Use case |
|--------|---------|----------|
| `time` | `10:23:45` | Watch activity log (today's events) |
| `relative` | `2 min ago`, `3 days ago` | Results table unchanged rows |
| `full` | `Dec 28 10:23` | Older items needing full context |

**Relative thresholds:**
- < 1 min: "just now"
- < 60 min: "X min ago"
- < 24 hours: "X hours ago"
- < 7 days: "X days ago"
- >= 7 days: Falls back to `full` format

---

## 4. Summary Line Rethink

Current: `Built: 1  Unchanged: 2  Errors: 1`

Problem: "Unchanged: 1" feels odd when nothing happened.

**Proposal:** Only show what happened this run:
- If changes: `Built: 2` or `Applied: 3`
- If errors: `Errors: 1` (red)
- If nothing: `No changes`
- Unchanged count unnecessary - the dim rows ARE the unchanged ones

---

## 5. Header Simplification

Current:
```
 srtd  Build v0.4.7

- Building templates...
```

After:
```
 srtd  Build v0.4.7
```

Remove spinner message - header already says what we're doing.

---

## 6. Watch Mode Enhancements

### 6a. Historic Activity on Startup

Load last N activities from buildlog on watch start:
```typescript
// src/services/StateService.ts
function getRecentActivity(limit: number): TemplateResult[]
```

Show immediately so watch never feels "empty".

### 6b. Footer Layout

Show only destination in footer (muted), keyboard hints including build action:
```
dest: .../migrations
q quit  b build  u hide history
```

No line separator - just whitespace + muted text provides visual distinction.

### 6c. Activity Log

Same `TemplateResult` data, rendered as timestamped log:
```
10:23:45  ✔ auth.sql → local db
10:23:44  ● auth.sql changed
```

---

## 7. File Changes Summary

| File | Change |
|------|--------|
| `src/ui/types.ts` | NEW - shared interfaces (REPLACES old types in other files) |
| `src/ui/resultsTable.ts` | Refactor to unified renderer, remove old interfaces |
| `src/ui/watchLog.ts` | Use TemplateResult, reuse unified renderer logic |
| `src/ui/branding.ts` | Keep as-is (header only) |
| `src/ui/errorDisplay.ts` | Simplify - just format error messages |
| `src/utils/formatTime.ts` | Add `formatTimestamp(date, format)` with 3 modes |
| `src/commands/build.ts` | Use unified renderer, remove spinner message |
| `src/commands/apply.ts` | Use unified renderer, remove spinner message |
| `src/commands/watch.ts` | Use unified renderer, show history, add `b` build action |
| `src/services/StateService.ts` | Add `getRecentActivity(limit)` |

---

## 8. Implementation Order

### Phase 1: Foundation
1. **Add `formatTimestamp()`** - standalone utility with 3 modes, easy to test
2. **Create `src/ui/types.ts`** - shared interfaces (TemplateResult, RenderContext)

### Phase 2: Core Refactor
3. **Refactor `resultsTable.ts`** - unified renderer, remove old interfaces
4. **Update `build.ts`** - use unified renderer, remove spinner
5. **Update `apply.ts`** - use unified renderer, remove spinner

### Phase 3: Watch Enhancements
6. **Add `getRecentActivity()`** - StateService method using buildlog
7. **Update `watch.ts`** - use unified renderer, show history, fix footer
8. **Add watch build action** - `b` key handler, pending build tracking

### Phase 4: Verification & Cleanup (CRITICAL)

**9a. Run KNIP** - Find unused exports, dead code, orphaned files
```bash
npx knip
```
Address all findings before proceeding.

**9b. Code Bloodhound** - Trace old interface usage, verify complete replacement
```
Skill('code-bloodhound')
```
- Trace all usages of removed interfaces (ResultRow, UnchangedRow, etc.)
- Verify no orphaned imports or stale references
- Confirm unified types are used everywhere

**9c. Explore Agent** - Codebase-wide consistency check
```
Task(subagent_type='Explore')
```
- Search for any remaining old patterns
- Verify DRY - no duplicated rendering logic
- Check for inconsistent time formatting

**9d. Janitor Agent** - Code quality audit
```
Task(subagent_type='janitor')
```
- DRY violations
- Parameter creep
- Schema duplication
- Unnecessary complexity

**9e. Validator Agent** - Final verification
```
Task(subagent_type='validator')
```
- Run full test suite
- Verify all commands work correctly
- Check UI output matches expected format
- Collect evidence of completion

**9f. Manual CLI verification**
- Run each command, capture output
- Compare against ASCII_SCREENSHOTS.md expectations
- Update screenshots if needed

---

## 9. Before/After Comparison (Expected Output)

### Build (unchanged)
```
BEFORE:                              AFTER:
 srtd  Build v0.4.7                   srtd  Build v0.4.7

- Building templates...              ● test.sql → 202512..._test.sql  2 days ago
● test.sql → 20251225... 12/25 14:47
                                     No changes
Unchanged: 1
```

### Build (with changes)
```
BEFORE:                              AFTER:
 srtd  Build (forced) v0.4.7          srtd  Build (forced) v0.4.7

- Building templates...              ✔ test.sql → 20251228..._test.sql
✔ test.sql → 20251228...
                                     Built: 1
Built: 1
```

### Watch (startup with history)
```
BEFORE:                              AFTER:
 srtd  Watch v0.4.7                   srtd  Watch v0.4.7

1 templates                          Recent activity:
src: ...templates → dest: ...        10:15:32  ✔ auth.sql → local db        2 hours ago
                                     10:14:58  ✔ policies.sql → local db    2 hours ago
─────────────────────                09:30:00  ✔ views.sql → local db       3 hours ago
q quit  u hide history
                                     dest: .../migrations
                                     q quit  b build  u hide history
```

### Watch (with needs-build indicator)
```
 srtd  Watch v0.4.7

Recent activity:
10:45:12  ● auth.sql changed                        just now

Pending build:
  ⚡ auth.sql

dest: .../migrations
q quit  b build  u hide history
```

Press `b` to build without leaving watch mode.

---

## 10. Decisions (Resolved)

1. **History limit**: 10 items
2. **History persistence**: Use buildlog only - no separate file, single source of truth
3. **Time display**: Relative per-row, no grouping headers

---

## 11. Watch Build Action (New Feature)

New feature: Press `b` in watch mode to trigger build without exiting.

**Flow:**
1. User modifies template → watch detects change → applies to local db
2. Template now shows in "Pending build" section with ⚡ icon
3. User presses `b` → build runs → migration created
4. Activity log shows build result, pending section clears

**Implementation:**
- Track which templates have been applied but not built (compare buildlog timestamps)
- Add `b` key handler in watch mode
- Reuse existing build logic, just call it from watch context
