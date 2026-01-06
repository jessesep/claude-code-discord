# Agent Compartment Context
> **Scope**: High-level orchestration, session management, and subagent spawning logic.

## 🎯 Mission
To act as the "Brain" and "Kernel" of the system. This compartment manages the lifecycle of agent interactions, maintains session history, and provides the interface for the Manager-Subagent hierarchy.

## 🗺️ Key Filepaths
- `manager.ts`: Definitions for the Manager (`gemini-2.0-flash`) system prompt and response parser.
- `index.ts`: The main entry point for the `/agent` command. Handles `PREDEFINED_AGENTS` and `AgentSession` state.
- `manager-spawn.ts`: (If exists/to be created) Logic for the `spawn_agent` command.

## 🛠️ Key Dependencies
- `npm:discord.js`: UI interaction and Slash command builders.
- `../claude/`: For CLI-based model interaction (Claude/Cursor/Antigravity).
- `../settings/`: For session persistence.

## 📜 Conventions
- **Session State**: Use the `AgentSession` interface. History should be a list of role/content pairs.
- **Agent Definitions**: All agents must be defined in the `PREDEFINED_AGENTS` constant in `index.ts`.
- **Headless Execution**: Use `runAgentTask` for spawned subagents (no Discord context).

## 💡 Code Example: Headless Agent Task
```typescript
export async function runAgentTask(
  agentId: string,
  task: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const agent = PREDEFINED_AGENTS[agentId];
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  // Dispatch to proper client (Antigravity/Cursor/Claude)
}
```

## 🧠 Collective Knowledge
- **Risk Levels**: High-risk agents (e.g., `cursor-fast`) often have `force: true` and should be used with caution.
- **Context Injection**: Use `include_system_info` and `context_files` options in `/agent chat` to provide extra data.
- **Gemini 2.0 Flash**: The default model for the Manager due to its speed and logic prowess.
