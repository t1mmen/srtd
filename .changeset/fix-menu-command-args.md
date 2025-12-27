---
"@t1mmen/srtd": patch
---

fix: correct menu command invocation to not include command name in args

When using standalone Commander.js commands, the command already knows its name.
Passing `['node', 'srtd', 'init']` caused "too many arguments" error.
Fixed to use `['node', 'srtd']` for all menu command invocations.
