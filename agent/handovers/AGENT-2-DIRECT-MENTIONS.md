# Agent 2: Direct Agent Mentions (@agent-name)

## Mission
Implement `@agent-name` syntax to bypass Manager routing and directly invoke specific agents.

## Context
- Current flow: User → Manager Agent → (decides) → Spawns Subagent
- Desired flow: User types `@coder fix the bug` → Directly invokes Coder agent
- Competitor (Claude Code by Agents) has this as a killer feature
- Reduces latency and gives users control over agent selection

## Scope
**IN SCOPE:**
- Parse `@agent-name` mentions in Discord messages
- Route directly to named agent, bypassing Manager
- Support aliases (e.g., `@coder`, `@builder`, `@test`)
- Update help text and command documentation

**OUT OF SCOPE:**
- Dashboard changes (Agent 1)
- Remote agents (Agent 3)
- New providers (other work)

## Key Files to Study First
```
discord/message-handler.ts  # Main message processing (MODIFY)
discord/commands.ts         # Slash command definitions
agent/index.ts              # chatWithAgent function
agent/types.ts              # PREDEFINED_AGENTS definitions
agent/registry.ts           # AgentRegistry class
```

## Implementation Plan

### Phase 1: Define Agent Aliases
Create a mapping in `agent/types.ts`:
```typescript
export const AGENT_ALIASES: Record<string, string> = {
  // Short names → agent IDs
  'coder': 'ag-coder',
  'code': 'ag-coder',
  'builder': 'cursor-coder',
  'build': 'cursor-coder',
  'architect': 'ag-architect',
  'arch': 'ag-architect',
  'test': 'ag-tester',
  'tester': 'ag-tester',
  'security': 'ag-security',
  'sec': 'ag-security',
  'review': 'code-reviewer',
  'reviewer': 'code-reviewer',
  'manager': 'ag-manager',
  'fast': 'cursor-fast',
  'refactor': 'cursor-refactor',
};
```

### Phase 2: Message Parser
Create `discord/mention-parser.ts`:
```typescript
interface ParsedMention {
  agentId: string | null;
  cleanMessage: string;
}

export function parseAgentMention(message: string): ParsedMention {
  // Match @agent-name or @alias at start of message
  const mentionMatch = message.match(/^@(\w+[-\w]*)\s+(.+)$/s);
  if (mentionMatch) {
    const [, agentRef, rest] = mentionMatch;
    const agentId = resolveAgentAlias(agentRef);
    if (agentId) {
      return { agentId, cleanMessage: rest.trim() };
    }
  }
  return { agentId: null, cleanMessage: message };
}
```

### Phase 3: Update Message Handler
Modify `discord/message-handler.ts`:
```typescript
// In handleMessage function:
const { agentId, cleanMessage } = parseAgentMention(message.content);

if (agentId) {
  // Direct invocation - bypass manager
  await chatWithAgent(ctx, cleanMessage, agentId, ...);
} else {
  // Normal flow - let manager decide
  await chatWithAgent(ctx, message.content, 'ag-manager', ...);
}
```

### Phase 4: Visual Feedback
When using direct mention:
- Show different embed color (agent's color from `AGENT_STYLES`)
- Add indicator: "🎯 Direct: @coder" in response header
- Skip "Manager is thinking..." message

### Phase 5: Help & Documentation
- Add `/agents aliases` command to list all shortcuts
- Update `docs/DISCORD_COMMANDS.md`
- Add inline help: "@coder, @architect, @tester, etc."

## Technical Constraints
- Must not break existing Manager workflow
- Messages without @ prefix still go to Manager
- Agent must exist in registry (error gracefully if not)
- Preserve session continuity (same user+channel = same session)

## Success Criteria
- [ ] `@coder fix the linting errors` invokes ag-coder directly
- [ ] `@architect design a new auth system` invokes ag-architect
- [ ] Aliases work: `@code`, `@build`, `@test`, etc.
- [ ] Non-mentioned messages still go through Manager
- [ ] Clear visual distinction for direct vs. managed invocations
- [ ] Help command shows available agents and aliases

## Example Interactions
```
User: @coder add error handling to utils/api.ts
Bot: 🎯 Direct → one coder
     [Agent output streams directly]

User: @test run the authentication tests
Bot: 🎯 Direct → one tester
     [Test results stream]

User: fix the bug in auth (no @mention)
Bot: 🎯 Manager analyzing request...
     [Manager decides to spawn ag-coder]
```

## Edge Cases to Handle
- `@unknown-agent message` → Error: "Unknown agent. Try: @coder, @architect..."
- `@coder` (no message) → Error: "Please provide a task after the agent name"
- `@@coder message` → Treat as normal message (double @)
- `@Coder` → Case-insensitive matching
