fix database connection handling and test reliability

- Increase database connection timeouts for CI environments
- Add better error handling for database connections
- Fix brittle test assertions and add cleanup logic
- Make file watcher tests more resilient in CI
