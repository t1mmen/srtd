---
name: srtd-dev
description: Expert knowledge for developing the SRTD codebase itself. Use when implementing features, fixing bugs, understanding architecture, or writing tests for SRTD internals. NOT for end users of srtd CLI.
---

# SRTD Development Skill

Expert guidance for working with the SRTD codebase - a CLI tool for live-reloading SQL templates into Supabase local databases.

## Quick Reference

### Key Commands
```bash
npm test                           # Run all tests
npx vitest run -t "pattern"        # Run specific test
npm run typecheck                  # Type check
npm run lint                       # Biome lint + fix
npm start -- watch                 # Run watch command
npm run supabase:start             # Start test database
```

### Key Files by Task

| Task | Primary Files |
|------|---------------|
| Add CLI option | `src/commands/{command}.ts`, `src/cli.ts` |
| Modify template processing | `src/services/Orchestrator.ts` |
| Change state tracking | `src/services/StateService.ts` |
| Fix database issues | `src/services/DatabaseService.ts` |
| Modify migration output | `src/services/MigrationBuilder.ts` |
| Change file watching | `src/services/FileSystemService.ts` |
| Update config | `src/utils/config.ts`, `src/types.ts` |

## Architecture Mental Model

**Unidirectional flow** - data flows one direction through the system:

```
File Change → FileSystemService → Orchestrator → StateService
                                       ↓
                              DatabaseService / MigrationBuilder
                                       ↓
                              StateService (update) → Event Emission
```

### Service Boundaries (Critical)

**FileSystemService** owns:
- Template discovery (glob matching)
- File watching (Chokidar, 100ms debounce)
- File I/O (read, write, rename)
- Hash computation (MD5)

**StateService** owns:
- All state mutations (single source of truth)
- Build log persistence (`.buildlog.json`, `.buildlog.local.json`)
- State machine transitions (UNSEEN → CHANGED → APPLIED/BUILT → SYNCED)
- Hash comparison for change detection

**DatabaseService** owns:
- Connection pooling (pg.Pool, max 10 connections)
- Retry logic (3 attempts, exponential backoff)
- Error categorization (CONNECTION_ERROR, SYNTAX_ERROR, etc.)
- Transaction management (BEGIN/COMMIT/ROLLBACK)
- Advisory locks per template

**MigrationBuilder** owns:
- Timestamp generation (increments from buildLog.lastTimestamp)
- Migration file formatting (banner, footer, transaction wrap)
- Bundle mode (multiple templates → single file)

**Orchestrator** owns:
- Service coordination (does NOT own state)
- Queue management (processQueue, pendingRecheck)
- Event emission (templateChanged, templateApplied, templateError)
- Command execution (apply, build, watch)

### Key Design Decisions

1. **Dual build logs**: `.buildlog.json` (what was built, commit) + `.buildlog.local.json` (what was applied, gitignore)
2. **Hash-based change detection**: `currentHash !== lastAppliedHash && currentHash !== lastBuiltHash`
3. **EventEmitter pattern**: Loose coupling between services
4. **Disposable pattern**: `await using` for automatic cleanup
5. **Queue-based processing**: FIFO with recheck for modified templates

## Debugging Workflows

### Template Not Processing

```typescript
// Check 1: Is template being found?
// FileSystemService.findTemplates() uses glob pattern from config.filter

// Check 2: Is hash comparison returning false?
// StateService.hasTemplateChanged() compares against BOTH build logs

// Check 3: Is it a WIP template?
// isWipTemplate() checks for config.wipIndicator suffix (.wip.sql)

// Debugging: Add to Orchestrator.processTemplate():
console.log({
  path,
  hash: currentHash,
  state: this.stateService.getTemplateStatus(path)
});
```

### Database Connection Errors

```typescript
// DatabaseService categorizes errors via DatabaseErrorType:
// - CONNECTION_ERROR: ECONNREFUSED, ENOTFOUND, ECONNRESET
// - POOL_EXHAUSTED: "pool is exhausted", "too many clients"
// - TIMEOUT_ERROR: ETIMEOUT or timeout in message

// Check pool status:
console.log({
  total: pool.totalCount,
  idle: pool.idleCount,
  waiting: pool.waitingCount
});
```

### State Machine Issues

```typescript
// Valid transitions in StateService:
// UNSEEN → CHANGED
// CHANGED → APPLIED, BUILT, ERROR
// APPLIED → CHANGED, SYNCED
// BUILT → CHANGED, SYNCED
// SYNCED → CHANGED
// ERROR → CHANGED

// Check current state:
const info = stateService.templateStates.get(absolutePath);
console.log({ state: info?.state, lastAppliedHash, lastBuiltHash });
```

## Testing Patterns

### Command Tests

```typescript
import { setupCommandTestSpies, createMockUiModule } from '../helpers/testUtils.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();  // Critical: reload modules
  spies = setupCommandTestSpies();
});

afterEach(() => spies.cleanup());

it('handles success', async () => {
  const { buildCommand } = await import('../commands/build.js');
  mockOrchestrator.build.mockResolvedValue({ built: ['file.sql'], errors: [] });

  await buildCommand.parseAsync(['node', 'test']);

  spies.assertNoStderr();  // Catch Commander parse errors
  expect(spies.exitSpy).toHaveBeenCalledWith(0);
});
```

### Service Tests with TestResource

```typescript
import { createTestResource } from '../helpers/index.js';

it('applies template to database', async () => {
  using resources = await createTestResource({ prefix: 'apply' });
  await resources.setup();

  // Create template with unique function name
  const templatePath = await resources.createTemplateWithFunc('test', '_v1');

  // Execute within transaction for isolation
  const result = await resources.withTransaction(async (client) => {
    // ... test logic
    return client.query('SELECT ...');
  });

  // Verify function exists
  expect(await resources.verifyFunctionExists()).toBe(true);
  // Auto-cleanup via Symbol.asyncDispose
});
```

### Mock Patterns

```typescript
// Mock Orchestrator (most common)
vi.mock('../services/Orchestrator.js', () => ({
  Orchestrator: {
    create: vi.fn().mockResolvedValue({
      apply: vi.fn().mockResolvedValue({ applied: [], errors: [], skipped: [] }),
      build: vi.fn().mockResolvedValue({ built: [], errors: [], skipped: [] }),
      watch: vi.fn().mockResolvedValue(undefined),
      [Symbol.asyncDispose]: vi.fn(),
    }),
  },
}));

// Mock config
vi.mock('../utils/config.js', () => ({
  getConfig: vi.fn().mockResolvedValue({
    templateDir: '/tmp/templates',
    migrationDir: '/tmp/migrations',
    // ... other config
  }),
}));
```

## Adding New Features

### New CLI Option

1. Add option to command in `src/commands/{command}.ts`:
```typescript
.option('-x, --example', 'Description')
```

2. Pass to orchestrator method:
```typescript
const result = await orchestrator.apply({ force, example: options.example });
```

3. Handle in orchestrator:
```typescript
async apply(options: ApplyOptions & { example?: boolean }) {
  if (options.example) { /* ... */ }
}
```

4. Add test:
```typescript
it('respects --example flag', async () => {
  await command.parseAsync(['node', 'test', '--example']);
  expect(mockOrchestrator.apply).toHaveBeenCalledWith(
    expect.objectContaining({ example: true })
  );
});
```

### New Service Method

1. Define interface in `src/types.ts`
2. Implement in service class
3. Expose via Orchestrator if needed
4. Add unit test for service
5. Add integration test for full flow

### New Event Type

1. Define event type in Orchestrator:
```typescript
type OrchestratorEvents = {
  newEvent: [payload: NewEventPayload];
  // ... existing events
};
```

2. Emit from appropriate location:
```typescript
this.emit('newEvent', payload);
```

3. Listen in command:
```typescript
orchestrator.on('newEvent', (payload) => {
  // Update UI
});
```

## Error Handling Patterns

### Service Layer
```typescript
// Categorize and wrap errors
try {
  await pool.query(sql);
} catch (error) {
  const dbError = this.categorizeError(error);
  this.emit('sql:error', { error: dbError });
  throw dbError;
}
```

### Command Layer
```typescript
try {
  const result = await orchestrator.apply();
  process.exit(result.errors.length > 0 ? 1 : 0);
} catch (error) {
  console.log(chalk.red(getErrorMessage(error)));
  process.exit(1);
}
```

### Interactive Commands
```typescript
try {
  const answer = await select({ /* ... */ });
} catch (error) {
  if (isPromptExit(error)) {
    process.exit(0);  // Ctrl+C is clean exit
  }
  throw error;
}
```

## Common Pitfalls

1. **Forgetting vi.resetModules()** - Command tests fail silently without it
2. **Not capturing console.error** - Commander writes parse errors to stderr
3. **Direct state mutation** - Always use StateService methods, never modify directly
4. **Missing transaction cleanup** - Use `using` pattern or explicit dispose
5. **Testing with shared state** - Use TestResource for isolation
6. **Forgetting Symbol.asyncDispose** - Orchestrator requires async disposal

## Validation Before Commit

```bash
npm run typecheck && npm run lint && npm test
```

All three must pass. CI runs on Node 20.x and 22.x with PostgreSQL 15.
