# GitHub Issues to Create

**Generated:** 2026-01-06
**Source:** Comprehensive Parallel Testing Orchestration
**Status:** Ready to create (issues currently disabled on repository)

This document contains formatted GitHub issues for all bugs and enhancements identified during comprehensive testing. Create these issues once GitHub Issues are enabled for the repository.

---

## Issue #1: Message Length Validation Missing

**Title:** [Bug] Message length not validated for Discord 2000 character limit

**Labels:** `bug`, `high-priority`, `cursor-integration`, `message-handling`

**Body:**
```markdown
**Severity:** High
**Category:** Bug, Message Handling
**Source:** Comprehensive Testing (Agent 2, Test 2.4)
**Files:** `agent/index.ts:481-537`

## Description
Discord has a hard 2000 character limit for messages, but the bot doesn't validate or chunk long responses from Claude/Cursor agents. This causes long agent responses to fail silently.

## Steps to Reproduce
1. Start a Cursor agent session: `/agent action:start agent_name:cursor-coder`
2. Request a task that generates a long response (>2000 characters):
   ```
   Create a detailed explanation of how async/await works in JavaScript with multiple examples
   ```
3. Observe that the message fails to send

## Expected Behavior
Long messages should be automatically chunked into multiple messages while:
- Preserving code blocks and markdown formatting
- Finding natural break points (newlines, spaces)
- Adding continuation indicators
- Maintaining readability

## Actual Behavior
- Messages over 2000 characters fail to send
- Error is caught but not handled: `await deps.sendClaudeMessages(claudeMessages).catch(() => {});`
- Users don't receive complete responses
- No indication to user that message was truncated

## Current Code
```typescript
// agent/index.ts:481-537
const claudeMessages = [{
  type: 'text' as const,
  content: currentChunk,  // No length validation!
  timestamp: new Date().toISOString()
}];
await deps.sendClaudeMessages(claudeMessages).catch(() => {});
```

## Impact
- **Users:** Don't receive complete responses from agents
- **Experience:** Poor UX for complex requests
- **Debugging:** Silent failures make issues hard to diagnose
- **Reliability:** Critical functionality fails without warning

## Proposed Solution
Implement intelligent message chunking in `discord/formatting.ts`:

```typescript
export function chunkMessage(content: string, maxLength: number = 2000): string[] {
  if (content.length <= maxLength) return [content];

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find good break point (prefer code block boundaries, then newlines, then spaces)
    let breakPoint = maxLength;

    // Check for code block boundary
    const codeBlockEnd = remaining.lastIndexOf('```', maxLength);
    if (codeBlockEnd > maxLength * 0.7) {
      breakPoint = codeBlockEnd + 3;
    } else {
      const lastNewline = remaining.lastIndexOf('\n', maxLength);
      const lastSpace = remaining.lastIndexOf(' ', maxLength);

      if (lastNewline > maxLength * 0.8) {
        breakPoint = lastNewline;
      } else if (lastSpace > maxLength * 0.8) {
        breakPoint = lastSpace;
      }
    }

    let chunk = remaining.substring(0, breakPoint);
    remaining = remaining.substring(breakPoint).trim();

    if (remaining.length > 0) {
      chunk += '\n...(continued)';
    }

    chunks.push(chunk);
  }

  return chunks;
}
```

Then update `agent/index.ts`:
```typescript
// Chunk the message if needed
const messageChunks = chunkMessage(currentChunk);

for (const chunk of messageChunks) {
  const claudeMessages = [{
    type: 'text' as const,
    content: chunk,
    timestamp: new Date().toISOString()
  }];

  await deps.sendClaudeMessages(claudeMessages);

  // Small delay between chunks to maintain order
  if (messageChunks.length > 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
```

## Related Test Reports
- `test-reports/agent2-conversation-report.md` (Test 2.4, BUG-001)
- `test-reports/FINAL-TEST-REPORT.md` (BUG-001)
- `test-reports/ISSUES-AND-IMPROVEMENTS.md` (ISSUE-002)
- `test-reports/README-AGENT2.md`

## Acceptance Criteria
- [ ] Messages over 2000 characters are automatically chunked
- [ ] Code blocks are never split mid-block
- [ ] Continuation indicators are added
- [ ] All chunks are delivered to user
- [ ] Error handling improved (no silent failures)
- [ ] Unit tests added for chunking logic
```

---

## Issue #2: Agent Sessions Not Persisted

**Title:** [Bug] Agent sessions lost on bot restart - No persistence

**Labels:** `bug`, `medium-priority`, `cursor-integration`, `data-loss`, `enhancement`

**Body:**
```markdown
**Severity:** Medium-High
**Category:** Bug, Data Loss, State Management
**Source:** Comprehensive Testing (Agent 3, Test 3.8)
**Files:** `agent/index.ts:209`

## Description
Agent sessions are stored in-memory using plain JavaScript arrays, which means all active sessions are lost when the bot restarts. This includes session history, message counts, cost tracking, and active conversation context.

## Steps to Reproduce
1. Start an agent session: `/agent action:start agent_name:cursor-coder`
2. Have a conversation with the agent
3. Check session status: `/agent action:status` (shows active session)
4. Restart the Discord bot
5. Check session status again: `/agent action:status`

## Expected Behavior
- Sessions should persist across bot restarts
- Users can resume their sessions after restart
- Session history and metrics are preserved
- Optional: Old sessions are cleaned up automatically

## Actual Behavior
- All sessions are lost on restart
- Users must start new sessions
- Session history is gone
- No way to recover past sessions

## Current Code
```typescript
// agent/index.ts:209
// In-memory storage for agent sessions (in production, would be persisted)
let agentSessions: AgentSession[] = [];
let currentUserAgent: Record<string, string> = {}; // userId -> agentName
```

The comment even acknowledges this should be persisted! 😄

## Impact
- **Users:** Lose active sessions on every bot restart
- **Data:** Session history, message counts, cost tracking lost
- **Experience:** Frustrating to restart conversations
- **Analytics:** No historical session data for analysis

## Proposed Solution

### Option 1: JSON File Persistence (Simple)
```typescript
import { ensureDir } from "https://deno.land/std/fs/mod.ts";

const SESSION_DIR = "./data/sessions";
const SESSION_FILE = `${SESSION_DIR}/agent-sessions.json`;

async function saveSessions(): Promise<void> {
  await ensureDir(SESSION_DIR);
  const data = {
    sessions: agentSessions,
    currentUserAgent: currentUserAgent,
    savedAt: new Date().toISOString()
  };
  await Deno.writeTextFile(SESSION_FILE, JSON.stringify(data, null, 2));
}

async function loadSessions(): Promise<void> {
  try {
    const data = JSON.parse(await Deno.readTextFile(SESSION_FILE));
    agentSessions = data.sessions || [];
    currentUserAgent = data.currentUserAgent || {};
    console.log(`Loaded ${agentSessions.length} sessions from ${data.savedAt}`);
  } catch (error) {
    console.log("No saved sessions found, starting fresh");
  }
}

// Auto-save on changes
function addAutoSave() {
  setInterval(async () => {
    await saveSessions();
  }, 60000); // Save every minute
}
```

### Option 2: SQLite Database (Robust)
Better for production, allows queries and analytics:

```typescript
import { DB } from "https://deno.land/x/sqlite/mod.ts";

const db = new DB("./data/agent-sessions.db");

db.query(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    last_activity TEXT NOT NULL,
    status TEXT NOT NULL
  )
`);
```

### Cleanup Strategy
```typescript
async function cleanupOldSessions(): Promise<void> {
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  agentSessions = agentSessions.filter(session => {
    const lastActivity = new Date(session.lastActivity).getTime();
    const isOld = lastActivity < sevenDaysAgo;
    const isCompleted = session.status === 'completed';

    return !(isOld && isCompleted);
  });

  await saveSessions();
}
```

## Implementation Steps
1. Choose persistence method (JSON or SQLite)
2. Implement save/load functions
3. Call `loadSessions()` on bot startup
4. Auto-save periodically and on session changes
5. Add cleanup for old sessions (>7 days, completed)
6. Add optional session export command
7. Add unit tests for persistence logic

## Related Test Reports
- `test-reports/agent3-sessions-report.md` (Test 3.8)
- `test-reports/FINAL-TEST-REPORT.md` (BUG-002)
- `test-reports/ISSUES-AND-IMPROVEMENTS.md` (ISSUE-001)
- `test-reports/AGENT3-SESSION-ANALYSIS-SUMMARY.md`

## Acceptance Criteria
- [ ] Sessions persist across bot restarts
- [ ] Old sessions are cleaned up automatically
- [ ] Save/load operations are reliable
- [ ] Performance impact is minimal
- [ ] Session data integrity is maintained
- [ ] Migration path for existing sessions (if any)
- [ ] Documentation updated
```

---

## Issue #3: No Workspace Path Validation for Cursor

**Title:** [Enhancement] Add workspace path validation for Cursor agent

**Labels:** `enhancement`, `medium-priority`, `cursor-integration`, `error-handling`

**Body:**
```markdown
**Severity:** Medium
**Category:** Enhancement, Error Handling, User Experience
**Source:** Code Analysis
**Files:** `agent/index.ts:461-470`, `claude/cursor-client.ts:61-63`

## Description
The Cursor agent configuration allows specifying a workspace path, but there's no validation that the path exists or is accessible before spawning Cursor CLI. This leads to confusing error messages when the workspace is invalid.

## Steps to Reproduce
1. Modify a Cursor agent config to have an invalid workspace:
   ```typescript
   'cursor-coder': {
     // ...
     workspace: '/nonexistent/path/to/project'
   }
   ```
2. Start the agent: `/agent action:start agent_name:cursor-coder`
3. Send a request
4. Observe cryptic Cursor CLI error

## Expected Behavior
- Workspace path is validated when agent starts
- Clear error message if path doesn't exist
- Suggestion to fix the configuration
- No Cursor CLI spawn attempt with invalid path

## Actual Behavior
- No validation before Cursor CLI spawn
- Cursor CLI fails with cryptic error
- Error message is hard to understand
- Wastes time spawning process

## Current Code
```typescript
// agent/index.ts:461-470
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

## Impact
- **Users:** Confusing error messages for misconfiguration
- **Debugging:** Harder to diagnose workspace issues
- **Performance:** Wasted time spawning doomed processes
- **Experience:** Poor UX for configuration errors

## Proposed Solution

### Add validation in `claude/cursor-client.ts`:
```typescript
export interface CursorOptions {
  model?: string;
  workspace?: string;
  force?: boolean;
  sandbox?: "enabled" | "disabled";
  resume?: string;
  streamJson?: boolean;
}

async function validateWorkspace(workspace?: string): Promise<void> {
  if (!workspace) return; // Optional parameter

  try {
    const stat = await Deno.stat(workspace);

    if (!stat.isDirectory) {
      throw new Error(
        `Workspace path exists but is not a directory: ${workspace}`
      );
    }

    // Check if we have read/write permissions
    const testFile = `${workspace}/.cursor-test-${Date.now()}`;
    try {
      await Deno.writeTextFile(testFile, "test");
      await Deno.remove(testFile);
    } catch (error) {
      throw new Error(
        `Workspace directory exists but is not writable: ${workspace}\\n` +
        `Please check permissions.`
      );
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `Workspace directory does not exist: ${workspace}\\n` +
        `Please create the directory or fix the agent configuration.`
      );
    }
    throw error;
  }
}

export async function sendToCursorCLI(
  prompt: string,
  controller: AbortController,
  options: CursorOptions = {},
  onChunk?: (text: string) => void
): Promise<CursorResponse> {
  try {
    // Validate workspace before attempting to spawn Cursor
    await validateWorkspace(options.workspace);

    // ... rest of implementation
  }
}
```

### Update error handling in `agent/index.ts`:
```typescript
try {
  result = await sendToCursorCLI(/* ... */);
} catch (error) {
  const clientType = agent.client || 'claude';

  // Check for workspace validation errors
  if (error instanceof Error && error.message.includes('Workspace')) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '⚠️ Workspace Configuration Error',
        description: error.message,
        fields: [{
          name: 'Current Workspace',
          value: agent.workspace || '(not set)',
          inline: false
        }, {
          name: 'Fix',
          value: 'Update the agent configuration with a valid workspace path',
          inline: false
        }],
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  // ... existing error handling
}
```

## Benefits
- Clear error messages for workspace issues
- Faster failure (no Cursor CLI spawn)
- Better user experience
- Easier debugging
- Prevents unnecessary resource usage

## Related
- `test-reports/ISSUES-AND-IMPROVEMENTS.md` (ISSUE-003)
- `test-reports/agent4-errors-report.md` (Error handling tests)

## Acceptance Criteria
- [ ] Workspace paths are validated before Cursor CLI spawn
- [ ] Clear error messages for missing directories
- [ ] Permission checks for read/write access
- [ ] Error messages include fix suggestions
- [ ] Unit tests for validation logic
- [ ] Documentation updated with workspace requirements
```

---

## Issue #4: Orphaned Sessions on Agent Switch

**Title:** [Bug] Agent switching creates orphaned sessions

**Labels:** `bug`, `medium-priority`, `cursor-integration`, `session-management`

**Body:**
```markdown
**Severity:** Medium
**Category:** Bug, Session Management, Memory Leak
**Source:** Comprehensive Testing (Agent 3, Test 3.3)
**Files:** `agent/index.ts:645-675`

## Description
When switching agents using `/agent action:switch`, the current session is not properly ended or cleaned up. Instead, a new session is implicitly created while the old session remains in the `agentSessions` array with status 'active', creating orphaned sessions.

## Steps to Reproduce
1. Start first agent: `/agent action:start agent_name:cursor-coder`
2. Have a conversation
3. Switch agent: `/agent action:switch agent_name:cursor-refactor`
4. Check the `agentSessions` array (via debugging or logs)
5. Observe: Both sessions exist with status 'active'

## Expected Behavior
When switching agents:
- Previous session should be marked as 'completed' or 'paused'
- Previous session should be properly cleaned up
- Only the new session should be active
- Session count should not grow indefinitely

## Actual Behavior
- Old session remains in array with status 'active'
- New session is created
- Session count grows with each switch
- Memory leak over time with frequent switches

## Current Code
```typescript
// agent/index.ts:645-675
async function switchAgent(ctx: any, agentName: string) {
  const agent = PREDEFINED_AGENTS[agentName];
  if (!agent) {
    // ... error handling
    return;
  }

  const userId = ctx.user.id;
  const previousAgent = currentUserAgent[userId];
  currentUserAgent[userId] = agentName;  // Just updates mapping!

  // Missing: Clean up old session!
  // Missing: Mark old session as completed!

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '🔄 Agent Switched',
      fields: [/* ... */]
    }]
  });
}
```

## Impact
- **Memory:** Orphaned sessions accumulate in memory
- **Performance:** Array grows unbounded with switches
- **Accuracy:** Session count/status commands show wrong data
- **Analytics:** Session metrics are incorrect

## Proposed Solution

```typescript
async function switchAgent(ctx: any, agentName: string) {
  const agent = PREDEFINED_AGENTS[agentName];
  if (!agent) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Agent Not Found',
        description: `No agent found with name: ${agentName}`,
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  const userId = ctx.user.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  const previousAgent = currentUserAgent[userId];

  // NEW: Properly end the previous session
  if (previousAgent) {
    agentSessions.forEach(session => {
      if (session.userId === userId &&
          session.channelId === channelId &&
          session.status === 'active') {
        session.status = 'completed';  // Mark as completed
        session.lastActivity = new Date();
        console.log(`Ended session ${session.id} for agent ${session.agentName}`);
      }
    });
  }

  // Create new session for the new agent
  const newSession: AgentSession = {
    id: generateSessionId(),
    agentName,
    userId,
    channelId,
    startTime: new Date(),
    messageCount: 0,
    totalCost: 0,
    lastActivity: new Date(),
    status: 'active'
  };

  agentSessions.push(newSession);
  currentUserAgent[userId] = agentName;

  console.log(`Switched to ${agentName}, new session: ${newSession.id}`);

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '🔄 Agent Switched',
      fields: [
        { name: 'Previous Agent', value: previousAgent ? PREDEFINED_AGENTS[previousAgent]?.name || 'None' : 'None', inline: true },
        { name: 'New Agent', value: agent.name, inline: true },
        { name: 'New Session ID', value: `\`${newSession.id.substring(0, 12)}\``, inline: true },
        { name: 'Ready', value: 'Use `/agent action:chat` to start chatting', inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}
```

## Additional Improvements

### Add session cleanup function:
```typescript
// Clean up old completed sessions (call periodically)
function cleanupCompletedSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAge;

  const initialCount = agentSessions.length;
  agentSessions = agentSessions.filter(session => {
    if (session.status !== 'completed') return true;
    const lastActivity = new Date(session.lastActivity).getTime();
    return lastActivity > cutoff;
  });

  const removed = initialCount - agentSessions.length;
  if (removed > 0) {
    console.log(`Cleaned up ${removed} old completed sessions`);
  }
}
```

## Testing
Test cases to verify fix:
1. Start agent → switch agent → verify old session is completed
2. Multiple switches → verify only one active session per user
3. Check session count doesn't grow indefinitely
4. Verify `/agent action:status` shows correct active sessions

## Related Test Reports
- `test-reports/agent3-sessions-report.md` (Test 3.3, BUG #1)
- `test-reports/AGENT3-TEST-INDEX.md` (Orphaned Sessions)
- `test-reports/AGENT3-SESSION-ANALYSIS-SUMMARY.md`

## Acceptance Criteria
- [ ] Switching agents properly ends previous session
- [ ] Only one active session per user at a time
- [ ] Session count doesn't grow with switches
- [ ] Status command shows correct session count
- [ ] Session cleanup function added
- [ ] Unit tests added
- [ ] Integration tests pass
```

---

## Issue #5: Concurrent Request Conflicts

**Title:** [Bug] Concurrent requests to same agent may conflict

**Labels:** `bug`, `low-priority`, `cursor-integration`, `concurrency`

**Body:**
```markdown
**Severity:** Medium-Low
**Category:** Bug, Concurrency, Race Condition
**Source:** Comprehensive Testing (Agent 4, Test 4.7)
**Files:** `agent/index.ts:381-578`

## Description
When a user sends multiple rapid requests to the same Cursor agent, there's potential for conflicts because:
1. The Cursor CLI process spawning is async
2. No queueing mechanism exists
3. Multiple processes may operate on the same files

## Steps to Reproduce
1. Start Cursor agent: `/agent action:start agent_name:cursor-coder`
2. Rapidly send 5 requests (as fast as possible):
   ```
   Create file1.txt
   Create file2.txt
   Create file3.txt
   Modify file1.txt
   Modify file2.txt
   ```
3. Observe potential race conditions or conflicts

## Expected Behavior
- Requests are queued and processed sequentially
- Each request completes before next starts
- No file conflicts or corruption
- All requests complete successfully

## Actual Behavior (Potential)
- Multiple Cursor CLI processes may spawn simultaneously
- Race conditions possible on file operations
- Unclear message ordering
- Potential for inconsistent state

Note: This is a theoretical issue based on code analysis. Testing showed it works in practice due to Discord rate limiting, but not guaranteed.

## Current Code
```typescript
// agent/index.ts:381-578 (chatWithAgent function)
// No queueing mechanism - each request spawns immediately
async function chatWithAgent(/* ... */) {
  // ...

  // Creates controller for THIS request
  const controller = new AbortController();

  // Spawns Cursor CLI immediately (no queue)
  if (clientType === 'cursor') {
    result = await sendToCursorCLI(/* ... */);  // Parallel execution possible!
  }

  // ...
}
```

## Impact
- **Reliability:** Potential race conditions (low probability)
- **Data:** Possible file conflicts
- **UX:** Unclear which response matches which request
- **Discord:** Rate limiting may hide the issue

## Proposed Solution

### Option 1: Simple Queue per User/Agent
```typescript
// Add to agent session management
interface AgentSession {
  // ... existing fields
  requestQueue: Promise<any>; // Chain requests
}

async function chatWithAgent(ctx: any, message: string, /* ... */) {
  const userId = ctx.user.id;
  const session = agentSessions.find(
    s => s.userId === userId && s.status === 'active'
  );

  if (!session) {
    // ... handle no session
    return;
  }

  // Queue this request after previous one
  session.requestQueue = session.requestQueue.then(async () => {
    try {
      // Process this request
      await processAgentRequest(ctx, message, /* ... */);
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }).catch(error => {
    console.error('Queue error:', error);
  });

  await session.requestQueue;
}
```

### Option 2: Explicit Queue Class
```typescript
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await task();
      } catch (error) {
        console.error('Queue task error:', error);
      }
    }

    this.processing = false;
  }
}

// Add to session
interface AgentSession {
  // ... existing
  requestQueue: RequestQueue;
}
```

## Testing
1. Send 10 rapid file creation requests
2. Verify all files created (no lost requests)
3. Send conflicting operations (create then modify same file)
4. Verify operations execute in order
5. Verify no corruption or race conditions

## Related
- `test-reports/agent4-errors-report.md` (Test 4.7)
- `test-reports/agent5-integration-report.md` (Concurrent operations)
- `test-reports/ISSUES-AND-IMPROVEMENTS.md`

## Note
This is marked low-priority because:
- Discord rate limiting naturally throttles requests
- No confirmed issues in testing
- Cursor CLI itself may handle concurrency
- Real-world impact is minimal

However, implementing a queue would make the system more robust and predictable.

## Acceptance Criteria
- [ ] Requests are processed sequentially per user
- [ ] No race conditions on file operations
- [ ] All requests complete (no lost messages)
- [ ] Clear request/response pairing
- [ ] Performance impact minimal
- [ ] Tests verify sequential execution
```

---

## Issue #6: No Session Metrics Tracking

**Title:** [Enhancement] Add session metrics and analytics tracking

**Labels:** `enhancement`, `low-priority`, `cursor-integration`, `analytics`

**Body:**
```markdown
**Severity:** Low
**Category:** Enhancement, Analytics, Monitoring
**Source:** Code Analysis
**Files:** `agent/index.ts:209, 347-358`

## Description
The `AgentSession` interface includes fields for metrics (`messageCount`, `totalCost`, `lastActivity`) but these are never actually updated during agent usage. They remain at their initial values.

## Current Implementation
```typescript
export interface AgentSession {
  id: string;
  agentName: string;
  userId: string;
  channelId: string;
  startTime: Date;
  messageCount: number;      // Never incremented!
  totalCost: number;          // Never updated!
  lastActivity: Date;         // Never updated!
  status: 'active' | 'paused' | 'completed' | 'error';
}

// Session created with defaults
const session: AgentSession = {
  id: generateSessionId(),
  agentName,
  userId,
  channelId,
  startTime: new Date(),
  messageCount: 0,           // Stays at 0
  totalCost: 0,              // Stays at 0
  lastActivity: new Date(),  // Never updates
  status: 'active'
};
```

## Impact
- **Analytics:** No data on session usage
- **Monitoring:** Can't track agent performance
- **Billing:** Can't track costs per session
- **UX:** Can't show users their session stats

## Proposed Solution

### Update metrics in chatWithAgent:
```typescript
async function chatWithAgent(/* ... */) {
  // ... existing code

  // Find the user's active session
  const userId = ctx.user.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  const session = agentSessions.find(
    s => s.userId === userId && s.channelId === channelId && s.status === 'active'
  );

  if (!session) {
    // ... handle no session
    return;
  }

  try {
    // ... process request and get result

    // UPDATE METRICS
    session.messageCount++;
    session.lastActivity = new Date();

    if (result.cost) {
      session.totalCost += result.cost;
    }

    console.log(`Session ${session.id}: ${session.messageCount} messages, $${session.totalCost.toFixed(4)}`);

  } catch (error) {
    // ... error handling
  }
}
```

### Add session stats command:
```typescript
async function showSessionStats(ctx: any) {
  const userId = ctx.user.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  const session = agentSessions.find(
    s => s.userId === userId && s.channelId === channelId && s.status === 'active'
  );

  if (!session) {
    await ctx.editReply({
      embeds: [{
        color: 0xffaa00,
        title: '⚠️ No Active Session',
        description: 'No active session to show stats for.',
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  const agent = PREDEFINED_AGENTS[session.agentName];
  const duration = Date.now() - new Date(session.startTime).getTime();
  const durationMins = Math.floor(duration / 60000);
  const durationSecs = Math.floor((duration % 60000) / 1000);

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '📊 Session Statistics',
      fields: [
        { name: 'Agent', value: agent?.name || session.agentName, inline: true },
        { name: 'Session ID', value: `\`${session.id.substring(0, 12)}\``, inline: true },
        { name: 'Status', value: session.status, inline: true },
        { name: 'Messages Sent', value: session.messageCount.toString(), inline: true },
        { name: 'Total Cost', value: `$${session.totalCost.toFixed(4)}`, inline: true },
        { name: 'Duration', value: `${durationMins}m ${durationSecs}s`, inline: true },
        { name: 'Started', value: new Date(session.startTime).toLocaleString(), inline: true },
        { name: 'Last Activity', value: new Date(session.lastActivity).toLocaleString(), inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}
```

### Add to agent command:
```typescript
export const agentCommand = new SlashCommandBuilder()
  .setName('agent')
  .setDescription('Interact with specialized AI agents')
  .addStringOption(option =>
    option.setName('action')
      .setDescription('Agent action to perform')
      .setRequired(true)
      .addChoices(
        // ... existing choices
        { name: 'Session Stats', value: 'stats' },  // NEW
      ))
  // ... rest of command
```

## Additional Features

### Session History Export:
```typescript
async function exportSessionHistory(ctx: any) {
  const userId = ctx.user.id;
  const userSessions = agentSessions.filter(s => s.userId === userId);

  const history = userSessions.map(s => ({
    agent: s.agentName,
    started: s.startTime,
    ended: s.lastActivity,
    messages: s.messageCount,
    cost: s.totalCost,
    status: s.status
  }));

  const json = JSON.stringify(history, null, 2);

  // Send as file attachment
  await ctx.channel.send({
    content: 'Your session history:',
    files: [{
      attachment: Buffer.from(json),
      name: `session-history-${userId}.json`
    }]
  });
}
```

### Analytics Dashboard:
```typescript
async function showGlobalStats(ctx: any) {
  // Only for admins
  const totalSessions = agentSessions.length;
  const activeSessions = agentSessions.filter(s => s.status === 'active').length;
  const totalMessages = agentSessions.reduce((sum, s) => sum + s.messageCount, 0);
  const totalCost = agentSessions.reduce((sum, s) => sum + s.totalCost, 0);

  // Most popular agent
  const agentCounts: Record<string, number> = {};
  agentSessions.forEach(s => {
    agentCounts[s.agentName] = (agentCounts[s.agentName] || 0) + 1;
  });
  const mostPopular = Object.entries(agentCounts).sort((a, b) => b[1] - a[1])[0];

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '📈 Bot Analytics',
      fields: [
        { name: 'Total Sessions', value: totalSessions.toString(), inline: true },
        { name: 'Active Sessions', value: activeSessions.toString(), inline: true },
        { name: 'Total Messages', value: totalMessages.toString(), inline: true },
        { name: 'Total Cost', value: `$${totalCost.toFixed(2)}`, inline: true },
        { name: 'Most Popular Agent', value: mostPopular ? `${mostPopular[0]} (${mostPopular[1]} sessions)` : 'N/A', inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}
```

## Benefits
- Track session usage and costs
- Monitor agent performance
- Show users their session statistics
- Analytics for optimization
- Better user engagement
- Billing/cost tracking

## Related
- `test-reports/AGENT3-TEST-INDEX.md` (Session metrics)
- `test-reports/agent3-sessions-report.md`

## Acceptance Criteria
- [ ] Message count incremented on each message
- [ ] Total cost tracked and updated
- [ ] Last activity timestamp updated
- [ ] `/agent action:stats` shows session statistics
- [ ] Session history export function
- [ ] Global analytics command (admin only)
- [ ] Metrics persisted with sessions
```

---

## Summary

**Total Issues:** 6

### By Severity:
- **High:** 1 (Message length validation)
- **Medium-High:** 1 (Session persistence)
- **Medium:** 2 (Workspace validation, orphaned sessions)
- **Medium-Low:** 1 (Concurrent requests)
- **Low:** 1 (Session metrics)

### By Category:
- **Bugs:** 4
- **Enhancements:** 2

### Next Steps:
1. Enable GitHub Issues on the repository
2. Create these 6 issues
3. Prioritize and assign for implementation
4. Reference test reports in each issue
5. Link issues to pull requests when fixing

### Related Test Reports:
All issues are documented in detail in:
- `test-reports/FINAL-TEST-REPORT.md`
- `test-reports/ISSUES-AND-IMPROVEMENTS.md`
- `test-reports/agent[1-5]-*-report.md`
- `test-reports/AGENT[1-5]-*.md`

---

**End of GitHub Issues Document**
