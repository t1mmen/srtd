# Product Requirements Document: `srtd` 1.0

## 1. Introduction & Vision

`srtd` has proven to be an invaluable tool for improving the developer experience of managing Postgres databases, particularly within the Supabase ecosystem. Its core concepts of SQL templates, live-reloading, and generating clean, reviewable migration files are a significant step forward.

However, the initial implementation, while functional, suffers from architectural challenges that make it difficult to maintain, extend, and reason about. The vision for **`srtd` 1.0 is to create a simpler, more robust, and elegant rewrite** that retains all existing functionality while building on a clean, modular, and highly testable foundation. The 1.0 release will be the definitive, stable version of the tool, addressing both internal code quality and external dependency/distribution issues.

## 2. Core User-Facing Features (Parity)

The 1.0 rewrite must retain all existing functionality. The user experience and command-line interface should remain consistent.

| Feature | Description | Commands |
| :--- | :--- | :--- |
| **Template Watching** | Automatically detect changes to SQL template files and apply them to the local development database. | `watch` |
| **Migration Generation** | Generate standard, timestamped Supabase migration files from changed templates. | `build` |
| **Manual Application** | Manually apply all changed templates to the local database. | `apply` |
| **State Registration** | Mark existing templates as "already built" to prevent generating migrations for pre-existing database objects. | `register` |
| **WIP Promotion** | Promote a "Work in Progress" template (e.g., `.wip.sql`) to a standard, buildable template. | `promote` |
| **Configuration** | Initialize and use a `srtd.config.json` file for project-specific settings. | `init` |
| **State Reset** | Clear all build logs and reset the state of templates. | `clear` |
| **Interactive UI** | An interactive menu to guide users through the available commands when `srtd` is run without arguments. | `srtd` |

## 3. Key Architectural Principles for 1.0

The primary goal of the rewrite is to address the architectural shortcomings of the current implementation. The following principles will guide the development of 1.0.

### 3.1. Decompose the "God Class"

The monolithic `TemplateManager` class will be broken down into smaller, single-responsibility services. This is the most critical change for improving maintainability and testability.

*   **`FileSystemService`**: Responsible for all file system interactions.
    *   Finds templates using glob patterns.
    *   Reads file content and calculates hashes.
    *   Watches for file changes (using `chokidar`).
    *   Emits clear, specific events (e.g., `template:changed`, `template:added`, `template:removed`).
*   **`StateService`**: The single source of truth for the state of all templates.
    *   Manages the in-memory state, loading from and saving to `.buildlog.json` and `.buildlog.local.json`.
    *   Provides methods to query the status of a template (e.g., `getTemplateStatus`).
    *   Provides methods to update the state of a template (e.g., `markAsApplied`, `markAsBuilt`).
    *   Contains all the logic for comparing hashes and determining if a template needs to be applied or built.
*   **`DatabaseService`**: Responsible for all database interactions.
    *   Manages the connection to the Postgres database.
    *   Executes SQL content from a template against the database.
    *   Returns clear success or error results.
*   **`MigrationBuilder`**: Responsible for generating migration files.
    *   Takes a template's content and metadata.
    *   Constructs the final migration file content, including headers, footers, and transaction wrapping.
    *   Writes the migration file to the specified directory.
*   **`Orchestrator`**: The central controller that ties the services together.
    *   Listens for events from the `FileSystemService`.
    *   Uses the `StateService` to determine what actions are needed.
    *   Calls the `DatabaseService` or `MigrationBuilder` to perform those actions.
    *   Updates the `StateService` with the results of the actions.
    *   This replaces the complex, interwoven logic of the current `TemplateManager`.

### 3.2. Unidirectional Data Flow

The new architecture will enforce a clear and predictable data flow, eliminating the complex, multi-directional state updates of the current implementation.

`FileSystem Event -> Orchestrator -> StateService (check) -> Action (DB/Build) -> Orchestrator -> StateService (update)`

### 3.3. Robust and Explicit State Model

We will introduce a more explicit state machine for templates, moving beyond simple hash comparisons. A template's status can be one of:

*   `unseen`: A new file has been detected.
*   `synced`: The template's current hash matches the last applied and built hashes.
*   `changed`: The template's content has changed and needs to be applied and built.
*   `applied`: The template has been applied to the local DB, but not yet built.
*   `built`: The template has been built into a migration file.
*   `error`: The last attempt to apply or build the template resulted in an error.

This will make the application's logic simpler and its state easier to debug.

## 4. Terminal UI (TUI) Framework

The reliance on `Ink`/React is a significant pain point due to distribution challenges and dependency conflicts (especially with React 19). We have two paths forward:

### 4.1. Option A: Replace Ink (Recommended)

We should move away from a React-based TUI framework to eliminate the underlying cause of the distribution problems.

*   **Recommendation**: **`Terminal-Kit`**
    *   **Pros**: A mature, powerful, and event-driven TUI library with no external VDOM dependencies. It provides all the necessary components (menus, progress bars, text styling) and has a lower-level API that gives us more control. It is well-suited for building the kind of interactive, real-time UI that `srtd` needs.
    *   **Cons**: It is not declarative like React, so the UI code will be imperative. This is a trade-off, but one that is worth making for stability and distribution.

*   **Alternative**: **`Blessed`** / **`neo-blessed`**
    *   **Pros**: A popular and feature-rich TUI framework.
    *   **Cons**: Less actively maintained than `Terminal-Kit`.

### 4.2. Option B: Modernize Ink

If we decide that the declarative, component-based model of React is essential, we can stick with `Ink`, but it will require significant effort.

*   **Requirements**:
    1.  Upgrade to React 19.
    2.  Investigate and resolve the dependency conflicts. This may involve:
        *   Forking and patching `Ink` or its dependencies.
        *   Contributing upstream fixes.
        *   Re-implementing incompatible components from scratch.
    3.  This path carries a higher risk and maintenance burden.

## 5. High-Level Implementation Plan

1.  **Phase 1: Core Logic Rewrite**
    *   Implement the new, decomposed services (`FileSystemService`, `StateService`, `DatabaseService`, `MigrationBuilder`).
    *   Write comprehensive unit tests for each service in isolation.
    *   Implement the `Orchestrator` to manage the data flow between the services.
    *   Create a simple, non-interactive CLI wrapper to test the core logic of all commands (`apply`, `build`, etc.).

2.  **Phase 2: TUI Implementation**
    *   Based on the final decision from Section 4, build the new interactive TUI.
    *   If using `Terminal-Kit`, create wrappers and components for the required UI elements (status badges, template lists, changelogs).
    *   Connect the TUI to the `Orchestrator`, using an event-driven approach similar to the current `useTemplateManager` hook.

3.  **Phase 3: Integration and Testing**
    *   Integrate the core logic and the TUI.
    *   Write end-to-end integration tests that simulate user interactions and file system changes.
    *   Perform manual testing to ensure the user experience is on par with or better than the original.
    *   Update documentation.

## 6. Non-Goals for 1.0

*   **No New Features**: The focus of 1.0 is stability, reliability, and maintainability. No new user-facing features will be added.
*   **No Protocol Changes**: The format of `srtd.config.json` and the `.buildlog.json` files will remain the same to ensure backward compatibility for existing users.
