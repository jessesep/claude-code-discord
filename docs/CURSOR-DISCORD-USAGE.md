# Cursor Integration - Discord Bot Usage Guide

This guide explains how to use the Cursor-powered agents in the Discord bot.

## Overview

The Discord bot now supports **two AI clients**:
- **Claude CLI** (`claude` command) - Conversational AI, code review, architecture advice
- **Cursor CLI** (`cursor agent`) - Autonomous code editing, refactoring, debugging

## Prerequisites

### Install Cursor CLI

```bash
curl https://cursor.com/install -fsSL | bash
```

Verify installation:
```bash
cursor agent --version
```

### Authenticate Cursor

Cursor requires authentication (subscription or trial):
```bash
cursor agent --print "hello"
```

Follow the authentication prompts if not already signed in.

## Available Cursor Agents

The bot includes 4 Cursor-powered agents:

### 1. `cursor-coder` - Autonomous Coder
**Description:** General-purpose autonomous code editor
**Model:** sonnet-4
**Capabilities:** File editing, code generation, refactoring
**Safety:** Requires approval for operations, sandbox enabled
**Risk Level:** High

**Example Usage:**
```
/agent select cursor-coder
/agent send Add error handling to the API endpoints in server.ts
```

### 2. `cursor-refactor` - Refactoring Specialist
**Description:** Specialized in code refactoring
**Model:** sonnet-4
**Capabilities:** Refactoring, code improvement, file editing
**Safety:** Requires approval, sandbox enabled
**Risk Level:** High

**Example Usage:**
```
/agent select cursor-refactor
/agent send Refactor the authentication module to use dependency injection
```

### 3. `cursor-debugger` - Debug Agent
**Description:** Autonomous debugging with code editing
**Model:** sonnet-4-thinking
**Capabilities:** Debugging, testing, file editing
**Safety:** Requires approval, sandbox enabled
**Risk Level:** High

**Example Usage:**
```
/agent select cursor-debugger
/agent send Fix the memory leak in the WebSocket connection handler
```

### 4. `cursor-fast` - Fast Agent (⚠️ Use with Caution)
**Description:** Quick code changes with auto-approval
**Model:** sonnet-4
**Capabilities:** Quick edits, file editing
**Safety:** **AUTO-APPROVES ALL OPERATIONS**, sandbox disabled
**Risk Level:** High

**Example Usage:**
```
/agent select cursor-fast
/agent send Add a console.log to track user sessions
```

⚠️ **Warning:** `cursor-fast` auto-approves all file operations without confirmation. Only use in development environments or for trivial changes.

## How It Works

### Message Flow

1. User selects Cursor agent via `/agent select cursor-coder`
2. User sends task via `/agent send <task>`
3. Bot spawns Cursor CLI process:
   ```bash
   cursor agent --print --output-format stream-json --stream-partial-output \
     --model sonnet-4 --sandbox enabled "<task>"
   ```
4. Cursor analyzes codebase and generates plan
5. Cursor requests approval for file operations (unless `force: true`)
6. Bot streams Cursor's output to Discord in real-time
7. Completion message shows:
   - Client type (🖱️ Cursor)
   - Model used
   - Duration
   - Chat ID (for session resumption)

### Streaming Updates

Cursor responses are streamed to Discord every 2 seconds, providing real-time feedback on:
- File analysis
- Code generation
- Refactoring steps
- Error fixes
- Test execution

## Configuration

### Agent Configuration Parameters

Each Cursor agent supports these parameters (defined in `agent/index.ts`):

```typescript
{
  client: 'cursor',           // Use Cursor CLI instead of Claude
  model: 'sonnet-4',          // Cursor model (sonnet-4, gpt-5, sonnet-4-thinking)
  workspace: '/path/to/repo', // Working directory (defaults to bot's cwd)
  force: false,               // Auto-approve operations (true = dangerous!)
  sandbox: 'enabled'          // Sandbox mode (enabled|disabled)
}
```

### Creating Custom Cursor Agents

Edit `agent/index.ts` and add to `PREDEFINED_AGENTS`:

```typescript
'my-cursor-agent': {
  name: 'My Custom Cursor Agent',
  description: 'Does something specific',
  model: 'sonnet-4',
  systemPrompt: 'You are a specialist in...',
  temperature: 0.3,
  maxTokens: 8000,
  capabilities: ['file-editing', 'testing'],
  riskLevel: 'high',
  client: 'cursor',        // Use Cursor
  force: false,            // Require approval
  sandbox: 'enabled',      // Enable sandbox
  workspace: '/path/proj'  // Optional: specific workspace
}
```

## Safety Features

### Sandbox Mode

When `sandbox: 'enabled'`:
- Cursor operations are isolated
- File system access is restricted
- Shell commands require approval

### Approval Gates

When `force: false`:
- Cursor prompts for approval before:
  - Creating/modifying files
  - Executing shell commands
  - Reading sensitive files
- User must confirm via Cursor CLI interface

⚠️ **Note:** Currently, approval prompts happen in the CLI, not Discord. You need access to the bot's terminal to approve operations.

### Risk Levels

- **Low:** Read-only operations, safe queries
- **Medium:** Limited file modifications, controlled operations
- **High:** Autonomous code editing, shell access, file creation/deletion

All Cursor agents are marked as **High Risk** because they can modify files.

## Comparison: Claude vs Cursor

| Feature | Claude CLI | Cursor CLI |
|---------|-----------|------------|
| **Best For** | Conversation, advice, review | Autonomous code editing |
| **File Editing** | ❌ Cannot edit files | ✅ Full file editing |
| **Code Execution** | ❌ Cannot run code | ✅ Can execute commands |
| **Streaming** | ✅ Yes | ✅ Yes (stream-json) |
| **Session Resume** | ❌ No | ✅ Yes (via chatId) |
| **Safety** | Low risk | High risk |
| **Speed** | Fast | Slower (spawns processes) |
| **Use Case** | Architecture, review, Q&A | Refactoring, debugging, building |

## Session Management

### Chat ID for Resumption

Cursor returns a `chatId` after each task. This can be used to resume the conversation:

```typescript
// Future feature: Resume Cursor session
/agent resume <chatId>
```

Currently, each task starts a fresh Cursor session.

## Troubleshooting

### Cursor CLI Not Found

**Error:** `cursor: command not found`

**Solution:**
```bash
# Reinstall Cursor CLI
curl https://cursor.com/install -fsSL | bash

# Verify installation
which cursor
cursor agent --version
```

### Authentication Failed

**Error:** `Authentication required`

**Solution:**
```bash
# Authenticate interactively
cursor agent --print "test"

# Follow the prompts to sign in
```

### Permission Denied

**Error:** `Permission denied: cannot write to file`

**Solution:**
- Ensure the bot has write permissions in the workspace
- Check that `workspace` parameter points to a valid directory
- Consider using `sandbox: 'enabled'` for safer operations

### Slow Responses

Cursor spawns a new process for each task, which can be slower than Claude CLI. Typical times:
- **Startup:** 1-2 seconds
- **First chunk:** 2-5 seconds
- **Complete task:** 10-60 seconds (depends on complexity)

For faster responses, use Claude agents instead.

## Testing

### Manual Test

Run the test suite:
```bash
cd /Users/jessesep/repos/claude-code-discord
deno run --allow-run tests/cursor-client-manual-test.ts
```

### Discord Test

1. Select a Cursor agent:
   ```
   /agent select cursor-coder
   ```

2. Send a simple task:
   ```
   /agent send List all TypeScript files in this project
   ```

3. Verify:
   - ✅ Completion message shows "🖱️ Cursor"
   - ✅ Response is streamed in real-time
   - ✅ Chat ID is displayed
   - ✅ Duration is reasonable (<30s for simple tasks)

## Best Practices

### ✅ Do

- Use Cursor for **autonomous code editing** (refactoring, bug fixes)
- Use Claude for **conversation and advice** (architecture, review)
- Start with `sandbox: 'enabled'` for safety
- Test with simple tasks first
- Review Cursor's changes before committing

### ❌ Don't

- Use `cursor-fast` in production environments
- Run Cursor on untrusted codebases without sandbox
- Expect instant responses (Cursor needs time to analyze code)
- Use Cursor for simple Q&A (Claude is faster and cheaper)

## Future Enhancements

Planned improvements:
- [ ] Session resumption via `/agent resume <chatId>`
- [ ] Approval workflow integration with Discord (buttons/modals)
- [ ] Workspace selection via slash command
- [ ] Cursor hooks integration for security gates
- [ ] Real-time approval via Discord reactions
- [ ] Process pooling for faster responses
- [ ] MCP server for persistent storage

## Resources

- [Cursor CLI Documentation](https://cursor.com/docs/cli/overview)
- [Cursor Agent Guide](https://cursor.com/docs/cli/using)
- [Cursor Hooks System](https://cursor.com/docs/agent/hooks)
- [CURSOR-INTEGRATION.md](./CURSOR-INTEGRATION.md) - Detailed technical docs
- [CURSOR-QUICK-REFERENCE.md](./CURSOR-QUICK-REFERENCE.md) - Quick reference guide

---

**Last Updated:** January 6, 2026
**Version:** 1.0
**Status:** ✅ Production Ready
