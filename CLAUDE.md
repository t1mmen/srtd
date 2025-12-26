## Quick Orientation

**Goal**: Calibrate to current work context. Hold off on deep-dives until objective is clear.
- **Clarify objective** - Use AskUserQuestion (3-4 options each, max 3 questions). Reason through with sequential thinking MCP.
  - If you are executing a delegated sub-agent task (the prompt already contains a concrete work order), **do not ask clarifying questions**. Assume sensible defaults, do the work, and report assumptions + results.
- **Skill discipline** - `/skill using-superpowers` to activate skill awareness before diving in.
- **Git headlines** - Scan before diving:

   ```bash
   git status -sb
   git log --oneline -10
   git diff master...HEAD --stat  # feature branches
   ```

   - **CRITICAL**: On `gitbutler/workspace`? → ONLY use `mcp__gitbutler__gitbutler_update_branches`, NO git writes

- **LLM Chatter** - Scan `.llm/chatter/` for this branch: prior work, blockers, decisions, agents involved. If branch has several commits, use `@preparer` to deep-dive both git logs and chatter.
- **Activate project** - `mcp__serena__get_current_config()`
- **Project type** - Language/framework/commands (discover as needed)

---


### Commits & Pull Requests
- When committing or creating PRs, activate the `version-control` skill for templates and guidance.
- Use `/skill timms-voice` to learn Timm's voice for PR messaging.


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





## TodoWrite Usage

### Structure

```typescript
TodoWrite({
  todos: [
    {
      "content": "0: Explore: Investigate scope",
      "status": "completed",
      "activeForm": "Investigate scope...",
      "recommended_agent": "explore"
    },
    {
      "content": "0.1: Clarify scope",
      "status": "completed",
      "activeForm": "Clarify scope..."
    },
    {
      "content": "0.2: Preparer: Verify findings",
      "status": "completed",
      "activeForm": "Verify findings...",
      "recommended_agent": "preparer"
    },
    {
      "content": "1: Builder: Implement feature",
      "status": "in_progress",
      "activeForm": "Implement feature...",
      "recommended_agent": "builder"
    },
    {
      "content": "1.1: TDD red\u2192green",
      "status": "completed",
      "activeForm": "TDD red\u2192green..."
    },
    {
      "content": "1.2: Implement solution",
      "status": "in_progress",
      "activeForm": "Implement solution..."
    },
    {
      "content": "1.3: Validator: Verify",
      "status": "pending",
      "activeForm": "Verify...",
      "recommended_agent": "validator"
    }
  ]
})
```

**Fields**: `content` (imperative), `status` (pending|in_progress|completed), `activeForm` (shown during execution)

**Agent prefixes** (for delegation): `Builder:`, `Janitor:`, `Mysql-Explorer:`, `Pr-Writer:`, `Preparer:`, `Prompt-Engineer:`, `Reviewer:`, `Taskmaster-Executor:`, `Tic-Documentation-Maintainer:`, `Tic-Postgres-Explorer:`, `Tic-Provider-Builder:`, `Tic-Type-Locator:`, `Toolbox-Asset-Creator:`, `Validator:`
### Rules

**Do**:
- ✅ Mark complete immediately upon finishing (don't batch)
- ✅ Use `in_progress` before `completed` for multi-step work
- ✅ Create TodoWrite for 3+ steps
- ✅ Use numbered sub-items for task breakdown: `1: Feature` → `1.1: Investigate` → `1.2: TDD` → `1.3: Validate`
- ✅ When uncertain, start with "0: Explore: Investigate scope" via `@preparer`

**Don't**:
- ❌ Create todos for trivial single-step work
- ❌ Compress multiple checklist items into one todo
- ❌ Skip `in_progress` state




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

- `builder`
- `janitor`
- `pr-writer`
- `preparer`
- `prompt-engineer`
- `reviewer`
- `validator`

### Delegation quick reference

### Builder
```typescript
Task({
  "subagent_type": "builder",
  "prompt": "Goal: <what you want done>\n\nWhy: <why it matters>\n\nInputs:\n- <files, commands, prior context>\n\nBoundaries:\n- <paths / scope>\n- <what NOT to change>\n- <time limit (optional)>\n\nDefinition of done:\n- <verifiable outcome>"
})
```

### Validator
```typescript
Task({
  "subagent_type": "validator",
  "prompt": "Goal: <what you want done>\n\nWhy: <why it matters>\n\nInputs:\n- <files, commands, prior context>\n\nBoundaries:\n- Read-only; do not edit files.\n- <paths / scope>\n- <what NOT to change>\n- <time limit (optional)>\n\nDefinition of done:\n- <verifiable outcome>"
})
```

### Reviewer
```typescript
Task({
  "subagent_type": "reviewer",
  "prompt": "Goal: <what you want done>\n\nWhy: <why it matters>\n\nInputs:\n- <files, commands, prior context>\n\nBoundaries:\n- Read-only; do not edit files.\n- <paths / scope>\n- <what NOT to change>\n- <time limit (optional)>\n\nDefinition of done:\n- <verifiable outcome>"
})
```

### Preparer
```typescript
Task({
  "subagent_type": "preparer",
  "prompt": "Goal: <what you want done>\n\nWhy: <why it matters>\n\nInputs:\n- <files, commands, prior context>\n\nBoundaries:\n- Read-only; do not edit files.\n- <paths / scope>\n- <what NOT to change>\n- <time limit (optional)>\n\nDefinition of done:\n- <verifiable outcome>"
})
```
### Agent Delegation Templates

Templates for delegating work to agents

Read `.claude/references/CLAUDE.MD/delegation_templates.md` for more information

## Session Handover

**Proactively recognize** handover triggers: context approaching limits (~80%), user mentions "compacting" / "handover" / "memory loss", or complex work that should persist across sessions.

**Action**: Run `/handover` or `/skill handover` to generate a kickoff prompt (not a report) that enables the next session to resume at full autonomy immediately.


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
Load via `/skill <name>`.

```json
[
  {
    "skill": "autonomous-cadence",
    "description": "Sustained autonomous work via externalized state. Use for multi-task sessions needing backlog management, evidence trails, and context resilience.",
    "invocation": "Skill('autonomous-cadence')"
  },
  {
    "skill": "claude-code-expert",
    "description": "Expert knowledge of Claude Code features and architecture",
    "invocation": "Skill('claude-code-expert')"
  },
  {
    "skill": "code-bloodhound",
    "description": "Code tracing and mass refactoring expert. Traces call chains, import graphs, and usages. Executes safe mass renames with playgrounds, dry runs, and word-boundary protection.",
    "invocation": "Skill('code-bloodhound')"
  },
  {
    "skill": "codex",
    "description": "Working with Codex subagents",
    "invocation": "Skill('codex')"
  },
  {
    "skill": "debug-root-cause-tracing",
    "description": "Systematic bug tracing through call stacks with instrumentation. Use when errors occur deep in execution or stack traces show long chains.",
    "invocation": "Skill('debug-root-cause-tracing')"
  },
  {
    "skill": "handover",
    "description": "Session handover protocol for context transfer when approaching limits. Generates restoration documentation that enables the next session to resume at full cadence. Triggered by: context limits, memory loss, compaction, session ending.",
    "invocation": "Skill('handover')"
  },
  {
    "skill": "meta-skill-craftsman",
    "description": "DEPRECATED - Use writing-skills instead. Skill creation, auditing, and maintenance.",
    "invocation": "Skill('meta-skill-craftsman')"
  },
  {
    "skill": "skill-harvester",
    "description": "Mines conversations for reusable patterns and automatically creates skills from development insights",
    "invocation": "Skill('skill-harvester')"
  },
  {
    "skill": "test-driven-development",
    "description": "TDD practices and patterns",
    "invocation": "Skill('test-driven-development')"
  },
  {
    "skill": "timms-voice",
    "description": "Personal voice and communication style for writing as Timm Stokke",
    "invocation": "Skill('timms-voice')"
  },
  {
    "skill": "using-superpowers",
    "description": "Leveraging advanced Claude Code features",
    "invocation": "Skill('using-superpowers')"
  },
  {
    "skill": "verification-before-completion",
    "description": "Ensuring quality before marking tasks complete",
    "invocation": "Skill('verification-before-completion')"
  },
  {
    "skill": "version-control",
    "description": "Proactive guidance for high-quality commits and PRs. Activates when committing or creating PRs.",
    "invocation": "Skill('version-control')"
  },
  {
    "skill": "workflow-brainstorm",
    "description": "Turn ideas into fully formed designs through collaborative dialogue. Use before any creative work - features, components, functionality changes.",
    "invocation": "Skill('workflow-brainstorm')"
  },
  {
    "skill": "workflow-write-plan",
    "description": "Use when you have a spec or requirements for a multi-step task, before touching code. Creates comprehensive implementation plans with bite-sized tasks.",
    "invocation": "Skill('workflow-write-plan')"
  },
  {
    "skill": "writing-skills",
    "description": "Use when creating new skills, editing existing skills, or verifying skills work before deployment. TDD applied to process documentation.",
    "invocation": "Skill('writing-skills')"
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

