# GitHub Actions Database Testing with Supabase

## Overview

This project includes comprehensive GitHub Actions workflows for testing SRTD (Supabase Repeatable Template Definitions) against real PostgreSQL databases using Supabase infrastructure. The workflows ensure that all database operations, migrations, and CLI commands work correctly with actual database instances.

## Workflow Files

### 1. `.github/workflows/database-testing.yml`
The main database testing workflow that:
- Tests against multiple PostgreSQL versions (14, 15)
- Runs on different Node.js versions (20.x, 22.x)
- Supports multiple environments (test, staging, production-like)
- Performs end-to-end CLI command testing
- Validates SQL syntax and migrations
- Monitors performance regressions
- Collects comprehensive test artifacts

## Features

### ✅ Real Database Testing
- **PostgreSQL Service Containers**: Each test run gets an isolated PostgreSQL instance
- **Supabase CLI Integration**: Tests run with actual Supabase local development environment
- **Schema Isolation**: Each test creates unique schemas to prevent conflicts
- **Transaction Testing**: Validates transaction handling and rollback mechanisms

### 🔄 Complete CLI Workflow Testing
The workflow tests all SRTD commands:
1. `srtd init` - Project initialization
2. `srtd register` - Template registration  
3. `srtd apply` - Template application to database
4. `srtd build` - Migration generation
5. `srtd watch` - File watching and auto-apply
6. `srtd promote` - Environment promotion
7. `srtd clear` - State cleanup

### 📊 Performance Monitoring
- Connection pooling efficiency tests
- Query execution timing
- Template discovery benchmarks
- Migration generation performance
- Regression detection against baseline metrics

### 🎯 Test Matrix Strategy
```yaml
matrix:
  environment: [test, staging]
  node: [20.x, 22.x]
  postgres: [14, 15]
```

## Setting Up GitHub Secrets

To use these workflows, configure the following secrets in your GitHub repository:

### Required Secrets
```bash
# Supabase Credentials (if using remote Supabase)
SUPABASE_URL                # Your Supabase project URL
SUPABASE_ANON_KEY_TEST      # Anon key for test environment
SUPABASE_SERVICE_ROLE_KEY   # Service role key (optional, for admin operations)

# Notification Webhooks (optional)
SLACK_WEBHOOK_URL           # For failure notifications
CODECOV_TOKEN              # For coverage reporting
NPM_TOKEN                  # For package publishing (if applicable)
```

### Setting Secrets
1. Go to your repository Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with its corresponding value

## Running Tests Locally

### Prerequisites
```bash
# Install Supabase CLI
brew install supabase/tap/supabase  # macOS
# or
npm install -g supabase              # via npm

# Install dependencies
npm ci
npm run build
```

### Local Test Execution
```bash
# Start PostgreSQL (via Docker)
docker run -d \
  --name srtd-test-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=srtd_test \
  -p 54322:5432 \
  postgres:15-alpine

# Set environment variable
export DATABASE_URL="postgresql://postgres:postgres@localhost:54322/srtd_test"

# Run tests
npm test

# Run specific integration tests
npm test -- src/services/__tests__/integration.test.ts

# Stop PostgreSQL
docker stop srtd-test-db
docker rm srtd-test-db
```

## Workflow Triggers

The database testing workflow runs on:

### Automatic Triggers
- **Push to main/develop**: Full test matrix
- **Pull Requests**: Reduced test matrix (faster feedback)
- **Path filters**: Only when relevant files change
  - `src/**` - Source code changes
  - `supabase/**` - Supabase configuration
  - `templates/**` - SQL templates
  - `migrations/**` - Migration files

### Manual Trigger
```bash
# Trigger via GitHub CLI
gh workflow run database-testing.yml \
  -f environment=staging

# Or via GitHub UI
# Actions → Database Testing → Run workflow
```

## Test Artifacts

Each workflow run produces artifacts:

### Available Artifacts
- **Test Reports**: JUnit XML format test results
- **Database Logs**: PostgreSQL and Supabase logs
- **Build Logs**: SRTD build.log and state.json
- **Migrations**: Generated migration files
- **Performance Reports**: Benchmark results

### Downloading Artifacts
```bash
# Using GitHub CLI
gh run download <run-id>

# Or from GitHub UI
# Actions → Select workflow run → Artifacts section
```

## Monitoring Test Results

### GitHub Actions Dashboard
- View real-time test execution
- Monitor matrix job progress
- Check test summaries in PR comments

### Test Summary
Each workflow run generates a summary with:
- Test pass/fail status
- Performance metrics
- Links to detailed logs
- Artifact download links

## Troubleshooting

### Common Issues

#### 1. Database Connection Failures
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Verify connection string
psql $DATABASE_URL -c "SELECT 1"
```

#### 2. Supabase CLI Issues
```bash
# Update Supabase CLI
supabase update

# Check Supabase status
supabase status
```

#### 3. Permission Errors
```bash
# Ensure proper file permissions
chmod +x dist/cli.js

# Check database user permissions
psql $DATABASE_URL -c "\du"
```

### Debug Mode
Enable debug output in workflows:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

## Performance Baselines

Current performance thresholds (adjust as needed):

| Operation | Threshold | Description |
|-----------|-----------|-------------|
| Template Discovery | 100ms | Finding all SQL templates |
| State Queries | 500ms | 100 state lookups |
| Database Queries | 1000ms | 50 parallel queries |
| Migration Generation | 200ms | Generate 10 migrations |

## Best Practices

### 1. Schema Isolation
Always use unique schema names for parallel tests:
```sql
CREATE SCHEMA IF NOT EXISTS test_${GITHUB_RUN_ID}_${MATRIX_INDEX};
```

### 2. Cleanup
Ensure proper cleanup in `always()` blocks:
```yaml
- name: Cleanup
  if: always()
  run: |
    psql $DATABASE_URL -c "DROP SCHEMA IF EXISTS test_schema CASCADE"
    supabase stop --no-backup
```

### 3. Idempotent Tests
Make tests repeatable without side effects:
```sql
CREATE TABLE IF NOT EXISTS ...
DROP TABLE IF EXISTS ... CASCADE
```

### 4. Connection Pooling
Properly manage database connections:
```javascript
const db = new DatabaseService({ 
  max: 10,  // Maximum pool size
  idleTimeoutMillis: 30000
});
// Always cleanup
await db.destroy();
```

## Contributing

When adding new database tests:

1. **Update the workflow**: Add new test steps to `database-testing.yml`
2. **Document changes**: Update this README
3. **Test locally first**: Verify tests work with local PostgreSQL
4. **Check artifacts**: Ensure relevant outputs are collected
5. **Monitor performance**: Add benchmarks for new operations

## Related Documentation

- [Manual Testing Guide](../MANUAL_TESTING_GUIDE.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [PostgreSQL Testing Best Practices](https://www.postgresql.org/docs/current/regress.html)

## Support

For issues with the database testing workflow:
1. Check the troubleshooting section above
2. Review workflow logs in GitHub Actions
3. Open an issue with:
   - Workflow run ID
   - Error messages
   - Steps to reproduce
   - Environment details