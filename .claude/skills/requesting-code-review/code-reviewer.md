# Code Reviewer Template

You are reviewing code changes for production readiness in the SRTD codebase.

## Review Context

**What was implemented:** {DESCRIPTION}
**Requirements/Plan:** {PLAN_OR_ISSUE_REFERENCE}
**Git range:** `git diff {BASE_SHA}..{HEAD_SHA}`

## Review Checklist

### Code Quality
- [ ] Clean separation of concerns (services have clear boundaries)
- [ ] Proper error handling with meaningful messages
- [ ] Type safety (no `any` types in production code)
- [ ] DRY principle followed (no duplicated logic)
- [ ] Edge cases handled (empty arrays, null values, missing files)

### SRTD Architecture
- [ ] State mutations only in StateService
- [ ] File I/O only in FileSystemService
- [ ] Database access only in DatabaseService
- [ ] Orchestrator coordinates but doesn't own state
- [ ] EventEmitter pattern used for loose coupling

### Testing
- [ ] Tests exist for new functionality
- [ ] Tests actually test logic (not just mocking everything)
- [ ] Edge cases covered (error paths, boundary conditions)
- [ ] All tests passing (`npm test`)

### Requirements
- [ ] All requirements from issue/spec met
- [ ] Implementation matches expected behavior
- [ ] No scope creep (extra features not requested)
- [ ] Breaking changes documented (if any)

### Production Readiness
- [ ] No console.log statements left behind
- [ ] Error messages don't expose sensitive info
- [ ] Performance considered (no N+1 queries, no blocking operations)
- [ ] Backward compatible (or migration path documented)

## Output Format

### Strengths
[What's well done? Be specific with file:line references.]

### Issues

#### Critical (Must Fix Before Merge)
Security vulnerabilities, data loss risks, broken functionality, crashes.

#### Important (Should Fix Before Merge)
Architecture problems, missing error handling, test gaps, incomplete features.

#### Minor (Nice to Have)
Code style, optimization opportunities, documentation improvements.

**For each issue include:**
- **File:line** reference
- **What's wrong** (specific description)
- **Why it matters** (impact)
- **How to fix** (if not obvious)

### Recommendations
[Improvements for code quality, architecture, or maintainability]

### Verdict

**Ready to merge?** [Yes / No / Yes with minor fixes]

**Reasoning:** [1-2 sentence technical assessment]

## Severity Guidelines

| Severity | Examples | Action |
|----------|----------|--------|
| Critical | SQL injection, unhandled promise rejection crashes, data corruption | Block merge |
| Important | Missing validation, no error handling, untested code paths | Fix first |
| Minor | Variable naming, missing JSDoc, could be more efficient | Can merge |

## SRTD-Specific Patterns to Verify

### State Machine
```
UNSEEN → CHANGED → APPLIED (local) or BUILT (migration) → SYNCED
```
- State transitions should be explicit and logged
- Hash comparison must check BOTH build logs

### Dual Build Log Pattern
- `.buildlog.json` = what was BUILT to migrations (commit this)
- `.buildlog.local.json` = what was APPLIED to local DB (gitignore)

### Database Operations
- Advisory locks for concurrent template access
- Retry logic: 3 attempts, exponential backoff
- Connection pooling: max 10 connections
- Error categorization: CONNECTION_ERROR, SYNTAX_ERROR, etc.

### File Watching
- Chokidar with 100ms debounce
- Queue-based processing (FIFO with recheck)

## Example Review Output

```markdown
### Strengths
- Clean implementation of template validation (src/services/Orchestrator.ts:145-167)
- Comprehensive test coverage for edge cases (src/services/__tests__/StateService.test.ts)
- Good use of TypeScript discriminated unions for error types

### Issues

#### Critical
None found.

#### Important
1. **Missing error handling for database timeout**
   - File: src/services/DatabaseService.ts:89
   - Issue: Connection timeout throws unhandled exception
   - Impact: Watch mode crashes on slow connections
   - Fix: Wrap in try/catch, emit 'templateError' event

2. **State not updated after failed apply**
   - File: src/services/StateService.ts:156
   - Issue: Template marked as APPLIED even when database rejects
   - Impact: Template won't retry on next change
   - Fix: Only update state after successful apply

#### Minor
1. **Inconsistent error message format**
   - File: src/commands/watch.ts:45
   - Issue: Some errors include stack trace, others don't
   - Fix: Use consistent formatError() helper

### Recommendations
- Consider adding metrics/telemetry for apply failures
- The retry logic could be extracted to a shared utility

### Verdict

**Ready to merge: No**

**Reasoning:** The state update issue (Important #2) could cause templates to be silently skipped. This must be fixed before merge to prevent data inconsistency.
```
