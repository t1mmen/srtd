---
name: requesting-code-review
description: "Structured code review workflow for SRTD development. Use after implementing features, fixing bugs, or before merging to main. Ensures production-readiness through systematic review."
---

# Requesting Code Review

**Review early, review often.** Catch issues before they compound across multiple changes.

## When to Request Review

### Mandatory
- After completing a feature or bug fix
- Before merging to main
- After significant refactoring
- When security-sensitive code is modified

### Optional (But Recommended)
- When stuck on a design decision
- After complex debugging sessions
- Before deleting or deprecating code

## How to Request Review

### Step 1: Identify the Change Range

```bash
# Get the commits to review
git log --oneline main..HEAD

# Or specific commit range
BASE_SHA=$(git merge-base main HEAD)
HEAD_SHA=$(git rev-parse HEAD)
```

### Step 2: Dispatch the Code Reviewer

Use the code-reviewer reference to conduct the review:

```
Review the changes from ${BASE_SHA} to ${HEAD_SHA}.

What was implemented: [brief description]
Requirements: [link to issue or spec]

See: .claude/skills/requesting-code-review/code-reviewer.md
```

### Step 3: Address Feedback by Severity

| Severity | Action Required |
|----------|-----------------|
| **Critical** | STOP. Fix immediately before any other work. |
| **Important** | Fix before merging or proceeding to next task. |
| **Minor** | Note for later. Can merge with these outstanding. |

## Responding to Feedback

### When You Agree
Fix the issue, then request re-review of the fix.

### When You Disagree
You may push back IF you have:
1. Technical justification (not just preference)
2. Evidence (code, tests, benchmarks)
3. Clear explanation of trade-offs

Example: "I kept the nested structure because flattening would require N+1 queries. See benchmark in test/perf/nested-vs-flat.ts showing 3x slowdown."

## SRTD-Specific Review Focus

When reviewing SRTD code, pay extra attention to:

### Service Boundaries
- Is state mutation only in StateService?
- Is file I/O only in FileSystemService?
- Is database access only in DatabaseService?

### State Machine Integrity
- Are template states transitioning correctly? (UNSEEN → CHANGED → APPLIED/BUILT → SYNCED)
- Is hash comparison working correctly?

### Build Log Handling
- Are both `.buildlog.json` and `.buildlog.local.json` updated appropriately?
- Is the distinction maintained? (built vs applied)

### Error Handling
- Are database errors properly categorized?
- Is retry logic correct (3 attempts, exponential backoff)?
- Are advisory locks used for concurrent access?

## Anti-Patterns (Red Flags)

- "This change is too simple to review" → Simple changes break production
- "I'll fix that in a follow-up" for Critical/Important issues → Fix now
- Ignoring review feedback without justification → Explain or fix
- Reviewing your own code without fresh eyes → Request external review

## Integration with Development Flow

### After Each Task
Request review before marking task complete.

### Before PR Creation
Run full review to catch issues before they're public.

### After CI Feedback
Re-review if CI reveals issues not caught initially.
