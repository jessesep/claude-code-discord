#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

/**
 * Create GitHub Issues from Agent Access Audit
 * 
 * This script creates GitHub issues for the critical problems identified
 * in the AGENT_ACCESS_AUDIT.md report.
 */

import { createMultipleGitHubIssues, type GitHubIssue } from "../util/github-issues.ts";

const issues: GitHubIssue[] = [
  {
    title: "[Critical] Agent sessions not persisted - lost on bot restart",
    body: `## Problem

Agent sessions are stored in-memory only, which means all active sessions are lost when the bot restarts. This includes:
- Session history
- Message counts
- Cost tracking
- Active conversation context

## Current Implementation

\`\`\`typescript
// agent/index.ts:256
let agentSessions: AgentSession[] = [];
let currentUserAgent: Record<string, string> = {};
\`\`\`

The comment even acknowledges this should be persisted!

## Impact

- **Users:** Lose active sessions on every bot restart
- **Data:** Session history, message counts, cost tracking lost
- **Experience:** Frustrating to restart conversations
- **Analytics:** No historical session data for analysis

## Proposed Solution

### Option 1: JSON File Persistence (Simple)
\`\`\`typescript
import { ensureDir } from "https://deno.land/std/fs/mod.ts";

const SESSION_DIR = "./data/agent-sessions";
const SESSION_FILE = \`\${SESSION_DIR}/sessions.json\`;

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
    console.log(\`Loaded \${agentSessions.length} sessions from \${data.savedAt}\`);
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
\`\`\`

### Option 2: SQLite Database (Robust)
Better for production, allows queries and analytics.

## Acceptance Criteria

- [ ] Sessions persist across bot restarts
- [ ] Session history is preserved
- [ ] Users can resume conversations after restart
- [ ] Auto-save mechanism (periodic saves)
- [ ] Graceful handling of corrupted session data
- [ ] Optional: Session cleanup/expiration

## Related Files

- \`agent/index.ts\` (lines 256-257, 496, 1470)
- \`agent/AGENT_ACCESS_AUDIT.md\` (Section 3.2, Issue #1)

## Priority

🔴 **CRITICAL** - This is a major UX issue that affects all users.`,
    labels: ["bug", "critical", "enhancement", "agent", "session-management", "data-loss"]
  },
  {
    title: "[High] No session timeout/cleanup - memory leak risk",
    body: `## Problem

Agent sessions never expire automatically. This means:
- Stale sessions accumulate in memory
- Memory usage grows over time
- No automatic cleanup of inactive sessions
- Users may have "ghost" sessions that are no longer valid

## Current Implementation

\`\`\`typescript
// agent/index.ts
// Sessions are only marked as 'completed' when explicitly ended
// No automatic expiration or cleanup
\`\`\`

## Impact

- **Memory:** Sessions accumulate indefinitely
- **Performance:** Large session arrays slow down lookups
- **User Experience:** Confusion about active vs inactive sessions
- **Resource Usage:** Unbounded memory growth

## Proposed Solution

\`\`\`typescript
function cleanupStaleSessions() {
  const MAX_IDLE_TIME = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();
  
  agentSessions = agentSessions.filter(session => {
    const idleTime = now - session.lastActivity.getTime();
    if (idleTime > MAX_IDLE_TIME && session.status === 'active') {
      session.status = 'completed';
      console.log(\`Auto-expired session \${session.id} (idle for \${Math.round(idleTime / 3600000)}h)\`);
      return false;
    }
    return true;
  });
  
  // Also clean up completed sessions older than 7 days
  agentSessions = agentSessions.filter(session => {
    if (session.status === 'completed') {
      const age = now - session.lastActivity.getTime();
      if (age > 7 * 24 * 60 * 60 * 1000) {
        return false; // Remove old completed sessions
      }
    }
    return true;
  });
}

// Run cleanup every hour
setInterval(cleanupStaleSessions, 60 * 60 * 1000);

// Also run on startup
cleanupStaleSessions();
\`\`\`

## Configuration Options

- **MAX_IDLE_TIME**: Configurable timeout (default: 24 hours)
- **CLEANUP_INTERVAL**: How often to run cleanup (default: 1 hour)
- **RETENTION_PERIOD**: How long to keep completed sessions (default: 7 days)

## Acceptance Criteria

- [ ] Inactive sessions auto-expire after configurable timeout
- [ ] Completed sessions are cleaned up after retention period
- [ ] Cleanup runs periodically (not just on startup)
- [ ] Logging for expired/cleaned sessions
- [ ] Configurable timeouts via environment variables or settings

## Related Files

- \`agent/index.ts\` (session management)
- \`agent/AGENT_ACCESS_AUDIT.md\` (Section 3.2, Issue #2)

## Priority

🟠 **HIGH** - Memory leaks are serious in long-running processes.`,
    labels: ["bug", "high-priority", "enhancement", "agent", "session-management", "memory-leak"]
  },
  {
    title: "[High] No process monitoring for spawned agent processes",
    body: `## Problem

When agents spawn CLI processes (Cursor, Antigravity), there's no tracking or monitoring:
- Can't detect if agent process crashed
- Can't kill stuck processes
- No visibility into what's running
- No health checks for agent processes

## Current Implementation

\`\`\`typescript
// agent/index.ts:539-597 (runAgentTask)
// Processes are spawned but not tracked
const process = cmd.spawn();
// No tracking, no monitoring, no cleanup
\`\`\`

## Impact

- **Reliability:** Stuck processes can't be detected or killed
- **Resource Usage:** Orphaned processes consume resources
- **Debugging:** No visibility into process state
- **User Experience:** Users can't see what's happening

## Proposed Solution

\`\`\`typescript
// Track spawned processes
const activeProcesses = new Map<string, {
  process: Deno.ChildProcess;
  sessionId: string;
  agentId: string;
  startTime: Date;
  workspace?: string;
}>();

function trackProcess(sessionId: string, agentId: string, process: Deno.ChildProcess, workspace?: string) {
  const processInfo = {
    process,
    sessionId,
    agentId,
    startTime: new Date(),
    workspace
  };
  
  activeProcesses.set(sessionId, processInfo);
  
  // Monitor process completion
  process.status.then(status => {
    activeProcesses.delete(sessionId);
    if (!status.success) {
      console.error(\`Agent process failed for session \${sessionId}: \${status.code}\`);
      // Update session status
      const session = agentSessions.find(s => s.id === sessionId);
      if (session) {
        session.status = 'error';
      }
    }
  }).catch(error => {
    console.error(\`Error monitoring process for session \${sessionId}:\`, error);
    activeProcesses.delete(sessionId);
  });
}

// Add kill command
async function killAgentProcess(sessionId: string): Promise<boolean> {
  const processInfo = activeProcesses.get(sessionId);
  if (processInfo) {
    try {
      processInfo.process.kill();
      activeProcesses.delete(sessionId);
      return true;
    } catch (error) {
      console.error(\`Failed to kill process for session \${sessionId}:\`, error);
      return false;
    }
  }
  return false;
}

// Health check function
function getActiveProcesses() {
  return Array.from(activeProcesses.entries()).map(([sessionId, info]) => ({
    sessionId,
    agentId: info.agentId,
    startTime: info.startTime,
    workspace: info.workspace,
    duration: Date.now() - info.startTime.getTime()
  }));
}
\`\`\`

## Additional Features

1. **Process Timeout:** Kill processes that run too long
2. **Resource Limits:** Track CPU/memory usage
3. **Health Endpoint:** Expose process status via Discord command
4. **Auto-cleanup:** Kill processes when session ends

## Acceptance Criteria

- [ ] All spawned processes are tracked
- [ ] Process completion is monitored
- [ ] Stuck processes can be killed
- [ ] Process status is visible via Discord command
- [ ] Processes are cleaned up when sessions end
- [ ] Process timeouts are enforced

## Related Files

- \`agent/index.ts\` (runAgentTask function)
- \`agent/AGENT_ACCESS_AUDIT.md\` (Section 3.2, Issue #3)

## Priority

🟠 **HIGH** - Critical for reliability and debugging.`,
    labels: ["enhancement", "high-priority", "agent", "process-management", "monitoring"]
  },
  {
    title: "[Medium] Limited error recovery for agent operations",
    body: `## Problem

When agent operations fail, there's limited recovery:
- No retry mechanism for transient failures
- No rollback for file operations
- Session state may be inconsistent after errors
- No transaction-like state management

## Current Implementation

\`\`\`typescript
// agent/index.ts
// Errors are caught but not retried
try {
  result = await sendToCursorCLI(...);
} catch (error) {
  // Error is logged and shown to user
  // But no retry, no rollback, no state recovery
  await ctx.editReply({ content: \`Error: \${error}\` });
}
\`\`\`

## Impact

- **Reliability:** Transient failures cause permanent failures
- **Data Integrity:** Partial operations leave inconsistent state
- **User Experience:** Users must manually retry failed operations
- **Trust:** Users lose confidence when operations fail

## Proposed Solution

### 1. Retry Logic with Exponential Backoff

\`\`\`typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors (auth, validation, etc.)
      if (isNonRetryableError(lastError)) {
        throw lastError;
      }
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(\`Retry attempt \${attempt + 1}/\${maxRetries} after \${delay}ms\`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error("Max retries exceeded");
}

function isNonRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('authentication') ||
    message.includes('permission denied') ||
    message.includes('invalid') ||
    message.includes('not found')
  );
}
\`\`\`

### 2. File Operation Rollback (Git-based)

\`\`\`typescript
async function executeWithRollback<T>(
  operation: () => Promise<T>,
  rollback: () => Promise<void>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error("Operation failed, attempting rollback...");
    try {
      await rollback();
    } catch (rollbackError) {
      console.error("Rollback also failed:", rollbackError);
    }
    throw error;
  }
}

// Example: File edit with git rollback
async function editFileWithRollback(filePath: string, newContent: string) {
  const workDir = Deno.cwd();
  
  // Save current state
  const originalContent = await Deno.readTextFile(filePath);
  const gitStatus = await new Deno.Command("git", {
    args: ["status", "--porcelain", filePath],
    cwd: workDir,
    stdout: "piped"
  }).output();
  
  return executeWithRollback(
    async () => {
      await Deno.writeTextFile(filePath, newContent);
      return { success: true };
    },
    async () => {
      // Rollback: restore original content
      await Deno.writeTextFile(filePath, originalContent);
      console.log(\`Rolled back changes to \${filePath}\`);
    }
  );
}
\`\`\`

### 3. State Recovery

\`\`\`typescript
interface OperationState {
  sessionId: string;
  operation: string;
  checkpoint: any;
  timestamp: Date;
}

const operationCheckpoints = new Map<string, OperationState>();

function createCheckpoint(sessionId: string, operation: string, state: any) {
  operationCheckpoints.set(sessionId, {
    sessionId,
    operation,
    checkpoint: state,
    timestamp: new Date()
  });
}

async function recoverFromCheckpoint(sessionId: string) {
  const checkpoint = operationCheckpoints.get(sessionId);
  if (checkpoint) {
    // Restore session state from checkpoint
    // Implementation depends on operation type
    console.log(\`Recovering session \${sessionId} from checkpoint\`);
  }
}
\`\`\`

## Acceptance Criteria

- [ ] Retry logic for transient failures (network, rate limits)
- [ ] Rollback mechanism for file operations
- [ ] State checkpoints for long-running operations
- [ ] Recovery from partial failures
- [ ] Clear error messages with retry suggestions
- [ ] Configurable retry policies

## Related Files

- \`agent/index.ts\` (error handling in chatWithAgent, runAgentTask)
- \`agent/AGENT_ACCESS_AUDIT.md\` (Section 3.2, Issue #4)

## Priority

🟡 **MEDIUM** - Improves reliability but not critical for basic functionality.`,
    labels: ["enhancement", "medium-priority", "agent", "error-handling", "reliability"]
  },
  {
    title: "[Medium] Add audit logging for agent operations",
    body: `## Problem

There's no comprehensive audit logging for agent operations:
- No record of what files were modified
- No tracking of commands executed
- No security event logging
- Difficult to debug issues or investigate problems

## Current Implementation

\`\`\`typescript
// agent/index.ts
// Only console.log statements, no structured logging
console.log(\`[Agent] Processing message...\`);
\`\`\`

## Impact

- **Security:** Can't audit what agents did
- **Debugging:** Hard to trace issues
- **Compliance:** No audit trail
- **Accountability:** Can't see who did what

## Proposed Solution

\`\`\`typescript
interface AuditLogEntry {
  timestamp: Date;
  userId: string;
  channelId: string;
  sessionId: string;
  agentId: string;
  action: 'file_read' | 'file_write' | 'file_delete' | 'command_exec' | 'session_start' | 'session_end';
  details: {
    filePath?: string;
    command?: string;
    result?: 'success' | 'failure';
    error?: string;
    metadata?: Record<string, any>;
  };
}

const auditLog: AuditLogEntry[] = [];

function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>) {
  const fullEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date()
  };
  
  auditLog.push(fullEntry);
  
  // Also write to file
  const logLine = JSON.stringify(fullEntry) + '\n';
  Deno.writeTextFile('./data/audit.log', logLine, { append: true })
    .catch(err => console.error('Failed to write audit log:', err));
  
  // Keep in-memory log limited (last 1000 entries)
  if (auditLog.length > 1000) {
    auditLog.shift();
  }
}

// Usage examples:
logAuditEvent({
  userId: ctx.user.id,
  channelId: ctx.channelId,
  sessionId: session.id,
  agentId: agentName,
  action: 'file_write',
  details: {
    filePath: '/path/to/file.ts',
    result: 'success'
  }
});

logAuditEvent({
  userId: ctx.user.id,
  channelId: ctx.channelId,
  sessionId: session.id,
  agentId: agentName,
  action: 'command_exec',
  details: {
    command: 'npm install',
    result: 'success'
  }
});
\`\`\`

## Features

1. **Structured Logging:** JSON format for easy parsing
2. **File Persistence:** Append to audit.log file
3. **In-Memory Cache:** Fast access to recent entries
4. **Query Interface:** Search/filter audit logs
5. **Privacy:** Option to redact sensitive data

## Acceptance Criteria

- [ ] All agent operations are logged
- [ ] Logs are persisted to file
- [ ] Logs include user, session, and operation details
- [ ] Logs can be queried/searched
- [ ] Sensitive data can be redacted
- [ ] Log rotation/cleanup for old entries

## Related Files

- \`agent/index.ts\` (all agent operations)
- \`agent/AGENT_ACCESS_AUDIT.md\` (Section 6, Security Checklist)

## Priority

🟡 **MEDIUM** - Important for security and debugging, but not blocking.`,
    labels: ["enhancement", "medium-priority", "agent", "logging", "security", "audit"]
  }
];

async function main() {
  console.log("Creating GitHub issues from audit findings...\n");
  
  const result = await createMultipleGitHubIssues(issues);
  
  console.log(`\n✅ Created ${result.success} issues`);
  console.log(`❌ Failed to create ${result.failed} issues\n`);
  
  for (const item of result.results) {
    if (item.success) {
      console.log(`  ✅ Issue #${item.issueNumber}: ${item.issue.title}`);
    } else {
      console.log(`  ❌ Failed: ${item.issue.title}`);
      console.log(`     Error: ${item.error}`);
    }
  }
  
  if (result.failed > 0) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
