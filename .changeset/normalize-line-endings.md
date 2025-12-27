---
"@t1mmen/srtd": patch
---

Normalize line endings before hash calculation for cross-platform consistency

Template hash values are now consistent across Windows (CRLF) and Unix/macOS (LF) environments. This prevents unnecessary migration rebuilds when the same template is processed on different platforms.

Fix contributed by [@louisandred](https://github.com/louisandred) - see [PR #42](https://github.com/t1mmen/srtd/pull/42).
