---
"@t1mmen/srtd": patch
---

fix: declare --non-interactive flag in CLI

The --non-interactive flag was being checked but never declared in Commander.js, causing it to be silently ignored. Now properly declared as a global option.

- Add --non-interactive option to main program
- Fix exit code to preserve command status (was always 0 in non-interactive mode)
