---
"@t1mmen/srtd": patch
---

Add warning when template directory does not exist. Previously `getConfig` would silently continue if the configured template directory was missing, which could lead to confusing "no templates found" errors later. Now a clear warning is returned in `ConfigResult.warnings` that consumers can display or handle appropriately.
