# Issues and Improvements Found

**Date**: 2026-01-06
**Source**: Comprehensive Codebase Analysis
**Analyzer**: Test Orchestrator Agent

This document contains all bugs, improvements, and observations discovered during parallel testing orchestration and codebase analysis.

---

## Critical Issues

### ISSUE-001: Agent sessions not persisted across bot restarts

**Severity**: Medium-High
**Category**: Bug, Data Loss
**Files**: `agent/index.ts:209`

**Description**:
Agent sessions are stored in-memory using plain JavaScript arrays, which means all active sessions are lost when the bot restarts.

**Current Code**:
```typescript
// In-memory storage for agent sessions (in production, would be persisted)
let agentSessions: AgentSession[] = [];
let currentUserAgent: Record<string, string> = {}; // userId -> agentName
```

**Impact**:
- Users lose their active agent sessions when the bot restarts
- Session history, message count, and cost tracking are lost
- No way to recover or review past sessions

**Recommended Solution**:
1. Implement session persistence using JSON file or SQLite database
2. Add session restoration on bot startup
3. Implement periodic cleanup of old/inactive sessions
4. Consider adding session export functionality

**Priority**: Medium

---

### ISSUE-002: Message length not validated for Discord 2000 character limit

**Severity**: High
**Category**: Bug, Message Handling
**Files**: `agent/index.ts:481-537`

**Description**:
Discord has a hard 2000 character limit for messages, but the bot doesn't validate or chunk long responses from Claude/Cursor agents.

**Current Code**:
```typescript
const claudeMessages = [{
  type: 'text' as const,
  content: currentChunk,  // No length validation!
  timestamp: new Date().toISOString()
}];
await deps.sendClaudeMessages(claudeMessages).catch(() => {});
```

**Impact**:
- Long agent responses fail to send silently
- Users don't receive complete responses
- Error handling catches but doesn't retry or chunk

**Recommended Solution**:
```typescript
function chunkMessage(content: string, maxLength: number = 2000): string[] {
  if (content.length <= maxLength) return [content];

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    let chunk: string;

    if (remaining.length <= maxLength) {
      chunk = remaining;
      remaining = '';
    } else {
      // Find good break point (newline, space, code block boundary)
      let breakPoint = maxLength;
      const lastNewline = remaining.lastIndexOf('\n', maxLength);
      const lastSpace = remaining.lastIndexOf(' ', maxLength);

      if (lastNewline > maxLength * 0.8) {
        breakPoint = lastNewline;
      } else if (lastSpace > maxLength * 0.8) {
        breakPoint = lastSpace;
      }

      chunk = remaining.substring(0, breakPoint);
      remaining = remaining.substring(breakPoint).trim();

      if (remaining.length > 0) {
        chunk += '\n...(continued)';
      }
    }

    chunks.push(chunk);
  }

  return chunks;
}
```

**Priority**: High

---

### ISSUE-003: No workspace path validation for Cursor agent

**Severity**: Medium
**Category**: Enhancement, Error Handling
**Files**: `agent/index.ts:461-470`, `claude/cursor-client.ts:61-63`

**Description**:
The Cursor agent configuration allows specifying a workspace path, but there's no validation that the path exists or is accessible before spawning Cursor CLI.

**Current Code**:
```typescript
result = await sendToCursorCLI(
  fullPrompt,
  controller,
  {
    model: agent.model,
    workspace: agent.workspace,  // No validation!
    force: agent.force,
    sandbox: agent.sandbox,
    streamJson: true,
  }
);
```

**Impact**:
- Confusing error messages when workspace is invalid
- Cursor CLI errors are harder to debug
- Poor user experience for invalid configurations

**Recommended Solution**:
Add validation in `cursor-client.ts`:
```typescript
async function validateWorkspace(workspace?: string): Promise<void> {
  if (!workspace) return; // Optional parameter

  try {
    const stat = await Deno.stat(workspace);
    if (!stat.isDirectory) {
      throw new Error(`Workspace path is not a directory: ${workspace}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`Workspace directory not found: ${workspace}`);
    }
    throw error;
  }
}

// Call before spawning process
await validateWorkspace(options.workspace);
```

**Priority**: Medium

---

### ISSUE-004: Cursor agent workspace not properly configured

**Severity**: Medium
**Category**: Bug, Configuration
**Files**: `agent/index.ts:106-157`

**Description**:
The Cursor agents (cursor-coder, cursor-refactor, cursor-debugger, cursor-fast) have a `workspace` field defined in their interface, but it's not actually set in the agent configurations.

**Current Code**:
```typescript
'cursor-coder': {
  name: 'Cursor Autonomous Coder',
  description: 'Cursor AI agent that can autonomously write and edit code',
  model: 'sonnet-4.5',
  systemPrompt: '...',
  temperature: 0.3,
  maxTokens: 8000,
  capabilities: ['file-editing', 'code-generation', 'refactoring', 'autonomous'],
  riskLevel: 'high',
  client: 'cursor',
  force: false,
  sandbox: 'enabled'
  // workspace: undefined!
}
```

**Impact**:
- Cursor agents may not execute in the correct directory
- File operations might fail or operate in wrong location
- Unclear what directory Cursor uses by default

**Recommended Solution**:
```typescript
'cursor-coder': {
  // ... other fields ...
  client: 'cursor',
  workspace: Deno.cwd(), // Use current working directory
  force: false,
  sandbox: 'enabled'
}
```

Or make workspace a dynamic parameter passed at runtime:
```typescript
result = await sendToCursorCLI(
  fullPrompt,
  controller,
  {
    model: agent.model,
    workspace: agent.workspace || deps?.workDir, // Use bot's workDir as default
    force: agent.force,
    sandbox: agent.sandbox,
    streamJson: true,
  }
);
```

**Priority**: Medium

---

### ISSUE-005: Concurrent requests might conflict with shared resources

**Severity**: Medium
**Category**: Bug, Concurrency
**Files**: `agent/index.ts`, `claude/cursor-client.ts`

**Description**:
Multiple users can send concurrent requests to Cursor agents that might operate on the same files simultaneously, potentially causing conflicts.

**Scenario**:
1. User A starts cursor-coder and asks to create `utils.ts`
2. User B starts cursor-coder and asks to modify `utils.ts`
3. Both Cursor processes operate simultaneously
4. File state becomes inconsistent

**Impact**:
- Race conditions on file writes
- Cursor agents might interfere with each other
- Git conflicts if agents commit changes

**Recommended Solution**:
1. Implement request queuing per file/directory
2. Add file locking mechanism
3. Use separate workspaces per user session
4. Document concurrent usage limitations

**Example**:
```typescript
// Per-workspace locking
const workspaceLocks = new Map<string, Promise<void>>();

async function withWorkspaceLock<T>(
  workspace: string,
  fn: () => Promise<T>
): Promise<T> {
  // Wait for existing lock
  const existingLock = workspaceLocks.get(workspace);
  if (existingLock) {
    await existingLock;
  }

  // Create new lock
  let resolveLock: () => void;
  const newLock = new Promise<void>(resolve => {
    resolveLock = resolve;
  });
  workspaceLocks.set(workspace, newLock);

  try {
    return await fn();
  } finally {
    resolveLock!();
    workspaceLocks.delete(workspace);
  }
}
```

**Priority**: Medium-Low (depends on multi-user usage patterns)

---

### ISSUE-006: Streaming update interval (2s) might miss rapid changes

**Severity**: Low
**Category**: Performance, UX
**Files**: `agent/index.ts:452`

**Description**:
The current implementation sends Discord updates every 2 seconds during streaming, which might miss rapid bursts of output.

**Current Code**:
```typescript
const UPDATE_INTERVAL = 2000; // Update Discord every 2 seconds
```

**Impact**:
- Very fast responses might complete before first update
- Users might not see intermediate progress
- Longer perceived latency

**Recommended Solution**:
1. Reduce interval to 1000ms (1 second) for better responsiveness
2. Add adaptive interval based on response speed
3. Send immediate update on completion
4. Consider debouncing instead of fixed interval

**Example**:
```typescript
// Adaptive interval
const MIN_INTERVAL = 500;
const MAX_INTERVAL = 3000;
let currentInterval = 1000;

// Adjust based on chunk frequency
if (chunkRate > 10) { // Many chunks per second
  currentInterval = MIN_INTERVAL;
} else if (chunkRate < 1) { // Slow chunks
  currentInterval = MAX_INTERVAL;
}
```

**Priority**: Low

---

## Enhancement Requests

### ENHANCEMENT-001: Add Cursor session resumption support

**Category**: Feature Enhancement
**Files**: `claude/cursor-client.ts`, `agent/index.ts`

**Description**:
Cursor CLI supports session resumption via `--resume [chatId]`, but this feature is not exposed to Discord users.

**Current State**:
- `chatId` is captured in `CursorResponse`
- Agent sessions store session metadata
- No command to resume a previous Cursor chat

**Proposed Feature**:
Add `/agent action:resume chat_id:[id]` command to continue a previous Cursor conversation.

**Benefits**:
- Users can continue long-running coding tasks
- Preserves conversation context
- Reduces repetition of context

**Implementation**:
```typescript
case 'resume':
  if (!chatId) {
    await ctx.editReply({
      content: 'Chat ID is required for resuming a session.',
      ephemeral: true
    });
    return;
  }
  await resumeCursorSession(ctx, chatId, message);
  break;
```

**Priority**: Medium

---

### ENHANCEMENT-002: Add cost tracking for Cursor agents

**Category**: Feature Enhancement, Analytics
**Files**: `agent/index.ts:548-550`

**Description**:
Claude agents track cost, but Cursor agents don't report cost even though they consume API credits.

**Current Code**:
```typescript
// Add cost for Claude (not applicable to Cursor)
if (clientType === 'claude' && result.cost) {
  completionFields.splice(2, 0, { name: 'Cost', value: `$${result.cost.toFixed(4)}`, inline: true });
}
```

**Impact**:
- Users can't track Cursor usage costs
- No budget monitoring for Cursor agents
- Unclear total spending

**Recommended Solution**:
1. Estimate Cursor costs based on model and token usage
2. Add cost field to `CursorResponse`
3. Track cumulative costs in session
4. Add `/agent action:cost` command for cost report

**Priority**: Low-Medium

---

### ENHANCEMENT-003: Add model validation for Cursor agents

**Category**: Enhancement, Error Prevention
**Files**: `agent/index.ts:109-157`

**Description**:
Cursor agents specify models like "sonnet-4.5" and "sonnet-4.5-thinking", but there's no validation that these are actually valid Cursor model names.

**Risk**:
- Invalid model names cause runtime errors
- Users receive confusing error messages
- No autocomplete or suggestions for valid models

**Recommended Solution**:
```typescript
const VALID_CURSOR_MODELS = [
  'sonnet-4.5',
  'sonnet-4',
  'sonnet-4.5-thinking',
  'opus-4',
  'gpt-4',
  'gpt-5'
] as const;

function validateCursorModel(model: string): void {
  if (!VALID_CURSOR_MODELS.includes(model as any)) {
    console.warn(`Potentially invalid Cursor model: ${model}`);
    console.warn(`Valid models: ${VALID_CURSOR_MODELS.join(', ')}`);
  }
}
```

**Priority**: Low

---

### ENHANCEMENT-004: Add file operation logging for debugging

**Category**: Enhancement, Debugging
**Files**: `claude/cursor-client.ts`

**Description**:
When Cursor agents create, modify, or delete files, there's no logging of what file operations were performed.

**Benefits**:
- Easier debugging of file-related issues
- Audit trail of agent actions
- Better error diagnosis

**Proposed Solution**:
```typescript
// In cursor-client.ts
export interface CursorResponse {
  response: string;
  duration?: number;
  modelUsed?: string;
  chatId?: string;
  filesModified?: string[]; // NEW: List of files touched
  operationsPerformed?: {
    type: 'create' | 'modify' | 'delete' | 'read';
    path: string;
    timestamp: string;
  }[]; // NEW: Detailed operation log
}
```

**Priority**: Low

---

### ENHANCEMENT-005: Add agent capability checking before execution

**Category**: Enhancement, User Experience
**Files**: `agent/index.ts`

**Description**:
Agents have a `capabilities` array defined, but these capabilities are never validated against the requested task.

**Example**:
User asks the `code-reviewer` agent to write code, but it's designed for review only.

**Proposed Feature**:
Add capability matching/warning:
```typescript
function checkAgentCapability(agent: AgentConfig, requestType: string): boolean {
  const requestCapabilities = detectRequestType(message);

  if (!agent.capabilities.some(cap => requestCapabilities.includes(cap))) {
    // Warn user that agent might not be suited for this task
    return false;
  }

  return true;
}
```

**Priority**: Low

---

## Observations and Recommendations

### OBS-001: Natural chat flow activation logic

**Category**: Observation
**Files**: `discord/bot.ts:469-488`

**Current Behavior**:
```typescript
const activeSession = getActiveSession(message.author.id, message.channelId);
const isMention = message.mentions.has(client.user!.id);

if (!activeSession && !isMention) {
  return; // Skip message
}
```

**Observation**:
The bot responds to messages if:
- There's an active agent session, OR
- The bot is @mentioned

This is good UX, but might cause unexpected activations if users @mention the bot while testing.

**Recommendation**:
- Document this behavior clearly
- Consider adding a setting to require @mention even with active session
- Add confirmation when starting sessions: "All messages will now be sent to [Agent]"

---

### OBS-002: Error handling consistency

**Category**: Code Quality
**Files**: Multiple

**Observation**:
Error handling is inconsistent:
- Some functions use try/catch with reporting
- Some functions silently catch: `.catch(() => {})`
- Some functions throw errors up the stack

**Recommendation**:
Standardize error handling:
1. Always log errors for debugging
2. Return user-friendly error messages
3. Don't silently suppress errors unless intentional
4. Use structured error types

---

### OBS-003: Testing coverage

**Category**: Testing
**Files**: `/tests/*`

**Current State**:
- Manual test files exist (`test-slash-interaction.ts`, `test-two-way.ts`)
- No automated test suite
- No CI/CD testing

**Recommendation**:
1. Add automated integration tests
2. Set up GitHub Actions for CI
3. Add unit tests for critical functions
4. Add end-to-end tests for common workflows

---

### OBS-004: Documentation gaps

**Category**: Documentation
**Files**: `/docs/*`

**Current State**:
- Good integration documentation (CURSOR-INTEGRATION.md)
- Missing: API documentation, troubleshooting guide
- No user guide for Discord commands

**Recommendation**:
1. Add user-facing documentation for Discord commands
2. Create troubleshooting guide with common errors
3. Add examples for each agent type
4. Document best practices for concurrent usage

---

## Priority Summary

**High Priority** (fix soon):
- ISSUE-002: Message length validation

**Medium Priority** (fix next sprint):
- ISSUE-001: Session persistence
- ISSUE-003: Workspace validation
- ISSUE-004: Workspace configuration
- ENHANCEMENT-001: Session resumption

**Low Priority** (backlog):
- ISSUE-005: Concurrent request handling
- ISSUE-006: Streaming interval
- ENHANCEMENT-002: Cost tracking
- ENHANCEMENT-003: Model validation
- ENHANCEMENT-004: File operation logging
- ENHANCEMENT-005: Capability checking

---

## Testing Recommendations

Based on this analysis, the following test scenarios should be prioritized:

1. **Long message handling**: Test responses >2000 chars
2. **Session persistence**: Test bot restart scenarios
3. **Concurrent requests**: Test multiple users simultaneously
4. **Error scenarios**: Test invalid inputs, timeouts, failures
5. **File operations**: Test create, modify, delete operations
6. **Natural chat flow**: Test message handling with/without @mention
7. **Agent switching**: Test switching between different agents
8. **Cursor models**: Test different model configurations

---

**End of Issues and Improvements Report**
