# Agent Compartment Context

> **Scope**: High-level orchestration, session management, and subagent spawning logic.

## 🎯 Mission

To act as the "Brain" and "Kernel" of the system. This compartment manages the lifecycle of agent interactions, maintains session history, and provides the interface for the Manager-Subagent hierarchy.

## 🗺️ Key Filepaths

- `manager.ts`: Definitions for the Manager (`gemini-3-flash-preview`) system prompt and response parser.
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
- **Gemini 3 Flash**: The default model for the Manager due to its speed and logic prowess.

## 🔌 Provider System

### Available Providers
Each provider has its own supported models list. **Always respect provider context when displaying models:**

| Provider | Provider ID | Supported Models Source |
|----------|-------------|-------------------------|
| Gemini API | `gemini-api` | `listAvailableModels()` in `util/list-models.ts` |
| Antigravity | `antigravity` | Same as Gemini API (gcloud OAuth auth) |
| Cursor | `cursor` | `CursorProvider.supportedModels` |
| Claude CLI | `claude-cli` | `ClaudeCliProvider.supportedModels` |
| Ollama | `ollama` | Dynamic from `OllamaProvider.getStatus()` |

### ⚠️ Critical: Provider-Specific Model Selection
When implementing multi-step flows like `/run-adv`:
1. **Store provider context** through the entire flow
2. **Fetch models from the correct provider** - not a hardcoded source
3. **Use `AgentProviderRegistry.getProvider()`** to access provider-specific data
4. **Test each provider path** after making changes

### Provider vs Client Mapping
```typescript
const providerToClient = {
  'cursor': 'cursor',
  'claude-cli': 'claude',
  'gemini-api': 'antigravity',
  'antigravity': 'antigravity',
  'ollama': 'ollama'
};
```

## 🐛 Historical Bugs (Don't Repeat)

### Bug #109: Wrong models shown for Cursor
**Cause**: Model selection used `listAvailableModels()` for ALL providers instead of checking which provider was selected.
**Lesson**: Always check provider context before fetching/displaying provider-specific data.

### Bug #110: Antigravity missing from provider list
**Cause**: Provider options list in `agent/handlers.ts` didn't include Antigravity.
**Lesson**: When adding new providers, update ALL places that enumerate providers:
- `agent/handlers.ts` - providerOptions for /run-adv
- `discord/event-handlers.ts` - model selection logic
- `agent/providers/index.ts` - provider registration
