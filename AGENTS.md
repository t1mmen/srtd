## Quick Orientation

**Goal**: Calibrate to current work context. Hold off on deep-dives until objective is clear.
- **Clarify objective** - Ask user multiple-choice questions (3-4 options each, max 3 questions). Reason through with sequential thinking MCP.
  - If you are executing a delegated sub-agent task (the prompt already contains a concrete work order), **do not ask clarifying questions**. Assume sensible defaults, do the work, and report assumptions + results.
- **Skill discipline** - `/skills` (browse) or `$<skill-name>` (invoke) to activate skill awareness before diving in.
- **Git headlines** - Scan before diving:

   ```bash
   git status -sb
   git log --oneline -10
   git diff master...HEAD --stat  # feature branches
   ```

   - **CRITICAL**: On `gitbutler/workspace`? → ONLY use `mcp__gitbutler__gitbutler_update_branches`, NO git writes

- **LLM Chatter** - Scan `.llm/chatter/` for this branch: prior work, blockers, decisions, agents involved. If branch has several commits, delegate via `mcp__codex_subagent__spawn_agent({ prompt: "You are a delegated Codex worker sub-agent.\n- Do NOT ask clarifying questions.\n- If something is unclear, choose sensible defaults and proceed.\n- Report assumptions + results.\n- Do NOT spawn sub-sub-agents.\n\nRole: Preparer\nNotes: Architectural preparation specialist. USE PROACTIVELY after Explore, before Builder. Verifies claims, plans injection points.\n\nRead this agent prompt file first: .claude/agents/preparer.md\n- Follow it as your role instructions.\n\nTask:\n<task description>" })` to deep-dive both git logs and chatter.
- **Activate project** - `mcp__serena__get_current_config()`
- **Project type** - Language/framework/commands (discover as needed)

---


### Commits & Pull Requests
- When committing or creating PRs, invoke `$version-control` for templates and guidance.
- Learn Timm's voice for PR messaging via `$timms-voice`.


## Available MCP Integrations

```json
[
  {
    "mcp": "codex_subagent",
    "description": "Delegate tasks to a Codex CLI subagent via MCP.",
    "invocation": "mcp__codex_subagent__*()",
    "examples": [
      "mcp__codex_subagent__spawn_agent({ prompt: \"You are a delegated Codex worker sub-agent.\\n- Do NOT ask clarifying questions.\\n- If something is unclear, choose sensible defaults and proceed.\\n- Report assumptions + results.\\n- Do NOT spawn sub-sub-agents.\\n\\nTask:\\nRefactor module X, run tests, summarize results.\" })",
      "mcp__codex_subagent__spawn_agent({ prompt: \"You are a delegated Codex worker sub-agent.\\n- Do NOT ask clarifying questions.\\n- If something is unclear, choose sensible defaults and proceed.\\n- Report assumptions + results.\\n- Do NOT spawn sub-sub-agents.\\n\\nRead this agent prompt file first: .claude/agents/builder.md\\n- Follow it as your role instructions.\\n\\nTask:\\nImplement the requested change in src/foo.ts and run targeted tests.\" })"
    ]
  },
  {
    "mcp": "postgres",
    "description": "Provides Postgres database access through MCP.",
    "invocation": "mcp__postgres__*()",
    "examples": []
  },
  {
    "mcp": "sequential-thinking",
    "description": "Provides advanced reasoning workflow support.",
    "invocation": "mcp__sequential-thinking__*()",
    "examples": [
      "mcp__sequential-thinking__sequentialthinking({thought: \"...\", thoughtNumber: 1, totalThoughts: 5, nextThoughtNeeded: true})"
    ]
  },
  {
    "mcp": "serena",
    "description": "Connects to Serena MCP orchestration server.",
    "invocation": "mcp__serena__*()",
    "examples": [
      "mcp__serena__find_symbol({name_path: \"ClassName\", include_body: true})",
      "mcp__serena__find_symbol({name_path: \"ClassName/method_name\", depth: 1})",
      "mcp__serena__find_referencing_symbols({name_path: \"functionName\", relative_path: \"src/module.ts\"})",
      "mcp__serena__get_symbols_overview({relative_path: \"src/module.ts\", depth: 1})",
      "mcp__serena__search_for_pattern({substring_pattern: \"TODO|FIXME\", context_lines_after: 2})",
      "mcp__serena__list_memories()",
      "mcp__serena__read_memory({memory_file_name: \"architecture.md\"})",
      "mcp__serena__write_memory({memory_file_name: \"blockers.md\", content: \"...\"})"
    ]
  }
]
```




## Planning Tool Usage

Use the planning tool (`update_plan`) as a continuous TODO list for all non-trivial work.

### Required Behavior

- ✅ If the task is 3+ steps, or has distinct phases, call `update_plan` before doing any work.
- ❌ Never create a single-step plan.
- ✅ Keep steps short (5-7 words) and action-oriented.
- ✅ Maintain exactly one `in_progress` step at all times until the task is done.
- ❌ Never jump `pending` -> `completed`. Set `in_progress` first, then `completed`.
- ✅ After you complete a step, immediately call `update_plan` to mark it `completed` and move `in_progress` forward.
- ✅ If you discover new work or the scope changes, call `update_plan` first (include an `explanation`), then continue.
- ✅ End the task with every step `completed` (or explicitly canceled/deferred, if supported by the harness).

### Canonical Shape

```typescript
update_plan({
  explanation: "Task plan",
  plan: [
    { step: "0: Explore scope", status: "completed" },
    { step: "1: Implement change", status: "in_progress" },
    { step: "2: Verify and summarize", status: "pending" },
  ],
})
```




## Sub-agent delegation

You remain the conductor. Before launching any helper, write down:

- **Goal + why it matters**
- **Inputs** (files, commands, prior findings)
- **Boundaries** (no sub-sub-agents, forbidden areas, time limits)
- **Definition of done** (artifact, tests, or approval needed)

Keep the primary session for planning, verification, and integration; sub-agents only execute scoped work orders.

### Sub-agent Expectations

**Sub-agents are workers, not collaborators.** They receive a task specification and return a result. They do not ask clarifying questions.

When delegating:

1. **Complete the prompt before spawning** - Include all context the sub-agent needs. If you would need to answer follow-up questions, the prompt isn't ready.

2. **Sub-agents investigate, don't ask** - If something is unclear, the sub-agent uses tools (Read, Grep, Glob, Bash) to resolve it. They never respond with "Could you clarify...?"

3. **Boundaries prevent scope creep** - Explicit boundaries ("Do NOT create new files", "Modify ONLY these paths") prevent sub-agents from making unscoped decisions.

4. **Done-when criteria are verifiable** - Tests pass, types compile, file exists - not subjective judgments.

**If a sub-agent returns with questions instead of results:** The delegation prompt was incomplete. Fix the prompt, don't fix the sub-agent.

### Available agents

- `builder` — Implementation specialist. USE PROACTIVELY for 3+ file changes, TDD workflows, complex refactoring. — `.claude/agents/builder.md`
- `janitor` — Code quality enforcer. Use for DRY violations, schema duplication, parameter creep. Loads domain skills for context. — `.claude/agents/janitor.md`
- `pr-writer` — PR creation specialist. Use when creating or updating pull requests. Analyzes full branch, fetches Linear context. — `.claude/agents/pr-writer.md`
- `preparer` — Architectural preparation specialist. USE PROACTIVELY after Explore, before Builder. Verifies claims, plans injection points. — `.claude/agents/preparer.md`
- `prompt-engineer` — Interactive prompt crafting workshop. Use when creating or refining prompts for Claude Code sessions. — `.claude/agents/prompt-engineer.md`
- `reviewer` — Code quality specialist. USE PROACTIVELY after code changes. Validates patterns, checks conventions. — `.claude/agents/reviewer.md`
- `validator` — QA specialist. MUST BE USED before commits and PRs. Runs tests, collects evidence, validates patterns. — `.claude/agents/validator.md`

### Delegation quick reference

### Builder
```typescript
mcp__codex_subagent__spawn_agent({ prompt: "You are a delegated Codex worker sub-agent.\n- Do NOT ask clarifying questions.\n- If something is unclear, choose sensible defaults and proceed.\n- Report assumptions + results.\n- Do NOT spawn sub-sub-agents.\n\nRole: Builder\nNotes: Implementation specialist. USE PROACTIVELY for 3+ file changes, TDD workflows, complex refactoring.\n\nRead this agent prompt file first: .claude/agents/builder.md\n- Follow it as your role instructions.\n\nTask:\nGoal: <what you want done>\n\nWhy: <why it matters>\n\nInputs:\n- <files, commands, prior context>\n\nBoundaries:\n- <paths / scope>\n- <what NOT to change>\n- <time limit (optional)>\n\nDefinition of done:\n- <verifiable outcome>" })
```

### Validator
```typescript
mcp__codex_subagent__spawn_agent({ prompt: "You are a delegated Codex worker sub-agent.\n- Do NOT ask clarifying questions.\n- If something is unclear, choose sensible defaults and proceed.\n- Report assumptions + results.\n- Do NOT spawn sub-sub-agents.\n\nRole: Validator\nNotes: QA specialist. MUST BE USED before commits and PRs. Runs tests, collects evidence, validates patterns.\n\nRead this agent prompt file first: .claude/agents/validator.md\n- Follow it as your role instructions.\n\nTask:\nGoal: <what you want done>\n\nWhy: <why it matters>\n\nInputs:\n- <files, commands, prior context>\n\nBoundaries:\n- Read-only; do not edit files.\n- <paths / scope>\n- <what NOT to change>\n- <time limit (optional)>\n\nDefinition of done:\n- <verifiable outcome>" })
```

### Reviewer
```typescript
mcp__codex_subagent__spawn_agent({ prompt: "You are a delegated Codex worker sub-agent.\n- Do NOT ask clarifying questions.\n- If something is unclear, choose sensible defaults and proceed.\n- Report assumptions + results.\n- Do NOT spawn sub-sub-agents.\n\nRole: Reviewer\nNotes: Code quality specialist. USE PROACTIVELY after code changes. Validates patterns, checks conventions.\n\nRead this agent prompt file first: .claude/agents/reviewer.md\n- Follow it as your role instructions.\n\nTask:\nGoal: <what you want done>\n\nWhy: <why it matters>\n\nInputs:\n- <files, commands, prior context>\n\nBoundaries:\n- Read-only; do not edit files.\n- <paths / scope>\n- <what NOT to change>\n- <time limit (optional)>\n\nDefinition of done:\n- <verifiable outcome>" })
```

### Preparer
```typescript
mcp__codex_subagent__spawn_agent({ prompt: "You are a delegated Codex worker sub-agent.\n- Do NOT ask clarifying questions.\n- If something is unclear, choose sensible defaults and proceed.\n- Report assumptions + results.\n- Do NOT spawn sub-sub-agents.\n\nRole: Preparer\nNotes: Architectural preparation specialist. USE PROACTIVELY after Explore, before Builder. Verifies claims, plans injection points.\n\nRead this agent prompt file first: .claude/agents/preparer.md\n- Follow it as your role instructions.\n\nTask:\nGoal: <what you want done>\n\nWhy: <why it matters>\n\nInputs:\n- <files, commands, prior context>\n\nBoundaries:\n- Read-only; do not edit files.\n- <paths / scope>\n- <what NOT to change>\n- <time limit (optional)>\n\nDefinition of done:\n- <verifiable outcome>" })
```
### Agent Delegation Templates

Templates for delegating work to agents

Read `.codex/references/agents-md/delegation_templates.md` for more information

## Session Handover

**Proactively recognize** handover triggers: context approaching limits (~80%), user mentions "compacting" / "handover" / "memory loss", or complex work that should persist across sessions.

**Action**: Open `/skills` and invoke `handover` (or mention `$handover`) to generate a kickoff prompt (not a report) that enables the next session to resume immediately.


## Code Documentation Standards

**Principle**: Document WHY when code alone can't tell the story.

### Functions

Brief purpose + `@see` for call chain context. No `@param`/`@returns`.

```typescript
/**
 * Syncs shadow templates to project directories.
 * @see {@link updateManifest} - Call after to persist timestamps
 */
export async function syncShadow(projectId: string, force = false): Promise<string[]>

/** Validates shadow integrity before sync */
function validateShadow(path: string): boolean
```

### Types & Schemas

Every property MUST be described:

```typescript
interface ShadowConfig {
  /** UUID from manifest.yml */
  projectId: string;
  /** Skip safety checks - CI only */
  force?: boolean;
}

const ShadowConfigSchema = z.object({
  projectId: z.string().describe('UUID from manifest.yml'),
  force: z.boolean().optional().describe('Skip safety checks - CI only'),
});
```

### Inline Comments

Only when code alone can't convey WHY:

```typescript
// Copier's update() silently skips unchanged files but we need
// full manifest for downstream diffing - fetch separately first
const manifest = await copier.getManifest(templatePath);
await copier.update(shadowPath, templatePath);

// Rate limit: Copier shells out per-file, 50+ files = fork bomb
for (const chunk of chunks(files, 10)) {
  await Promise.all(chunk.map(f => copier.copy(f)));
  await delay(100);
}

// Symlink resolution differs: Node follows, Git doesn't
const resolved = await realpath(shadowPath);
```

Also fine: comments as breathing room in dense code - not everything needs to be "non-obvious" to deserve a line break with context.

## Available Skills

Skills provide specialized knowledge and workflows.
Open `/skills` to browse, or mention a skill with `$<name>`.

```json
[
  {
    "skill": "autonomous-cadence",
    "description": "Sustained autonomous work via externalized state. Use for multi-task sessions needing backlog management, evidence trails, and context resilience.",
    "invocation": "$autonomous-cadence"
  },
  {
    "skill": "claude-code-expert",
    "description": "Expert knowledge of Claude Code features and architecture",
    "invocation": "$claude-code-expert"
  },
  {
    "skill": "code-bloodhound",
    "description": "Code tracing and mass refactoring expert. Traces call chains, import graphs, and usages. Executes safe mass renames with playgrounds, dry runs, and word-boundary protection.",
    "invocation": "$code-bloodhound"
  },
  {
    "skill": "codex",
    "description": "Working with Codex subagents",
    "invocation": "$codex"
  },
  {
    "skill": "debug-root-cause-tracing",
    "description": "Systematic bug tracing through call stacks with instrumentation. Use when errors occur deep in execution or stack traces show long chains.",
    "invocation": "$debug-root-cause-tracing"
  },
  {
    "skill": "handover",
    "description": "Session handover protocol for context transfer when approaching limits. Generates restoration documentation that enables the next session to resume at full cadence. Triggered by: context limits, memory loss, compaction, session ending.",
    "invocation": "$handover"
  },
  {
    "skill": "meta-skill-craftsman",
    "description": "DEPRECATED - Use writing-skills instead. Skill creation, auditing, and maintenance.",
    "invocation": "$meta-skill-craftsman"
  },
  {
    "skill": "skill-harvester",
    "description": "Mines conversations for reusable patterns and automatically creates skills from development insights",
    "invocation": "$skill-harvester"
  },
  {
    "skill": "test-driven-development",
    "description": "TDD practices and patterns",
    "invocation": "$test-driven-development"
  },
  {
    "skill": "timms-voice",
    "description": "Personal voice and communication style for writing as Timm Stokke",
    "invocation": "$timms-voice"
  },
  {
    "skill": "using-superpowers",
    "description": "Leveraging advanced Claude Code features",
    "invocation": "$using-superpowers"
  },
  {
    "skill": "verification-before-completion",
    "description": "Ensuring quality before marking tasks complete",
    "invocation": "$verification-before-completion"
  },
  {
    "skill": "version-control",
    "description": "Proactive guidance for high-quality commits and PRs. Activates when committing or creating PRs.",
    "invocation": "$version-control"
  },
  {
    "skill": "workflow-brainstorm",
    "description": "Turn ideas into fully formed designs through collaborative dialogue. Use before any creative work - features, components, functionality changes.",
    "invocation": "$workflow-brainstorm"
  },
  {
    "skill": "workflow-write-plan",
    "description": "Use when you have a spec or requirements for a multi-step task, before touching code. Creates comprehensive implementation plans with bite-sized tasks.",
    "invocation": "$workflow-write-plan"
  },
  {
    "skill": "writing-skills",
    "description": "Use when creating new skills, editing existing skills, or verifying skills work before deployment. TDD applied to process documentation.",
    "invocation": "$writing-skills"
  }
]
```

## Architectural Grounding

Before making any change or generating code, ensure you have a complete and accurate understanding of the existing architecture, data model, and naming conventions.

Do not introduce new abstractions, parameters, or concepts unless they are directly derived from and justified by the existing design. Maintain full continuity between all related identifiers (e.g. between runners, providers, and operation IDs).

Your goal is to behave as if you are the original architect of the system: you understand not only what the code does, but why it was designed that way.

"Better" means cleaner, more elegant, more correct — not larger, more complex, or more clever.

Strive for work that feels natively authored within the system: coherent, aligned, and indistinguishable in style from the existing codebase. Efficiency and clarity are welcome; inconsistency is not.

Study the existing conventions first. Only proceed when you truly understand them.

## Multi-LLM Workspace Safety

**This is a multi-agent workspace. Critical rules:**

- **Never delete unfamiliar files** - If unsure about a file's ownership, ask the user first
- **Stash, don't delete** - Use `git stash` if intervention is necessary
- **Coordinate changes** - When modifying shared resources (like prompts.yaml), ensure changes are additive and scoped

**Your files**:
- Anything you create in response to user requests
- Files explicitly assigned to you by the user
- Changes to composition system when requested

**Off-limits without explicit permission**:
- Other agents' temporary directories
- Git history manipulation (rebase, force-push)

