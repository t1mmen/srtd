# Ink/React Migration Analysis

## Dependencies to Remove
- ink (^5.1.0)
- @inkjs/ui (^2.0.0)
- react (^18.3.0)
- @types/react (^18.3.0)
- ink-testing-library (^4.0.0)

## Files Using Ink/React (30 files)

### Core Components (9 files)
1. src/components/Branding.tsx - Brand display component
2. src/components/ProcessingResults.tsx - Results display for apply/build
3. src/components/Quittable.tsx - Exit handler component
4. src/components/StatBadge.tsx - Status badge display
5. src/components/TimeSince.tsx - Time difference display
6. src/components/customTheme.tsx - Pastel theme configuration
7. src/components/Debug.tsx - Debug information display
8. src/components/ProcessingResults.test.tsx - Tests for ProcessingResults
9. src/components/Quittable.test.tsx - Tests for Quittable

### Command Files (9 files)
1. src/commands/_app.tsx - Main app wrapper
2. src/commands/apply.tsx - Apply command UI
3. src/commands/build.tsx - Build command UI
4. src/commands/clear.tsx - Clear command UI
5. src/commands/index.tsx - Command selector UI
6. src/commands/init.tsx - Init command UI
7. src/commands/promote.tsx - Promote command UI
8. src/commands/register.tsx - Register command UI
9. src/commands/watch.tsx - Watch command UI

### Hooks (5 files)
1. src/hooks/useDatabaseConnection.ts - Database connection hook
2. src/hooks/useFullscreen.ts - Fullscreen mode hook
3. src/hooks/useTemplateManager.ts - Template manager hook
4. src/hooks/useTemplateProcessor.ts - Template processor hook
5. src/hooks/useTemplateState.ts - Template state hook

### Test Files (7 files)
1. src/__tests__/apply.test.tsx
2. src/__tests__/build.test.tsx
3. src/__tests__/clear.test.tsx
4. src/__tests__/init.test.tsx
5. src/__tests__/promote.test.tsx
6. src/__tests__/register.test.tsx
7. src/__tests__/watch.test.tsx

## Migration Strategy

### Phase 1: Setup Terminal-Kit Infrastructure
1. Install terminal-kit package
2. Create abstraction layer for Terminal-Kit
3. Define interface matching current component APIs

### Phase 2: Component Migration
1. Create Terminal-Kit equivalents for each component
2. Maintain same props/interface where possible
3. Convert React hooks to event-driven patterns

### Phase 3: Command Migration
1. Replace React rendering with Terminal-Kit rendering
2. Convert useState to Terminal-Kit state management
3. Update event handlers

### Phase 4: Test Migration
1. Replace ink-testing-library with Terminal-Kit testing utilities
2. Update test assertions for new component structure
3. Ensure test coverage remains high

## Key Challenges
1. React's declarative model vs Terminal-Kit's imperative model
2. Hook-based state management conversion
3. Test infrastructure replacement
4. Maintaining backward compatibility