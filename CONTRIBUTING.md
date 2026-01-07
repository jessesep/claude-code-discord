# Contributing to one agent discord

We welcome contributions! This guide specifically covers how to add **new agents** to the system.

## Adding a New Subagent

To add a new specialized agent (e.g., specific for database work or testing), follow these steps:

### 1. Define the Agent Config

In `agent/index.ts`, add your agent to `PREDEFINED_AGENTS`:

```typescript
export const PREDEFINED_AGENTS: Record<string, AgentConfig> = {
  // ... existing agents
  "ag-tester": {
    name: "Antigravity Tester",
    description: "Runs and writes tests",
    model: "gemini-3-flash-preview", // or another supported model
    systemPrompt: `You are a testing expert...`,
  },
};
```

### 2. Update the Manager's Awareness

The Manager needs to know this agent exists to spawn it.
Update `MANAGER_SYSTEM_PROMPT` in `agent/manager.ts`:

```typescript
// in MANAGER_SYSTEM_PROMPT
You have access to the following subagents:
- ag-coder: ...
- ag-architect: ...
- ag-tester: Specialized in writing and running unit/integration tests.
```

### 3. Verify

Run the headless test (or create a new one) to ensure the Manager can select your new agent when prompted (e.g., "Please run tests for this file").

## Code Style

- Use **TypeScript**.
- Please run `deno fmt` before committing.
- Ensure all new features are documented in `ARCHITECTURE.md`.
