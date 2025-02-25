---
"@t1mmen/srtd": patch
---

Improve test stability with standardized TestResource class

- Created a reusable TestResource class for consistent resource management
- Provides isolated filesystem and database resources for all tests
- Added proper cleanup via the disposable pattern with automated resource tracking
- Implemented resilient assertion patterns to reduce flaky tests 
- Enabled parallelized test execution with increased concurrency
