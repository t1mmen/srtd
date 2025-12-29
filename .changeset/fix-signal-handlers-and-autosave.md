---
"@t1mmen/srtd": patch
---

Fix race conditions in signal handlers and auto-save error handling:

- Remove duplicate SIGINT/SIGTERM handlers from DatabaseService that caused race conditions during shutdown
- Fix silent auto-save failures in StateService that could cause unhandled promise rejections
