---
"@t1mmen/srtd": patch
---

fix: consistent color semantics across CLI output

Implements a consistent color scheme across all CLI output:
- GREEN: "just acted on" - success/built templates, their targets, and labels
- DIM/GRAY: "no action taken" - unchanged templates, timestamps, separators
- YELLOW: "needs attention" - WIP templates, pending builds, warnings
- RED: "problem" - errors

Previously, successful operations showed template names in white/normal text
while only the icon was green. Now the entire row (icon, name, target, label)
uses consistent coloring based on the action status.

Changes:
- `src/ui/resultsTable.ts`: Apply `getStatusColor()` consistently in table mode,
  color targets for success/built status, add color to status labels
- `src/commands/watch.ts`: Fix stacked event coloring (changed=dim, applied=green)
- Summary now counts both 'success' and 'built' as successful actions
