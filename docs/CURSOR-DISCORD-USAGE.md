# Cursor Provider - Discord Usage Guide

This guide explains how to use the Cursor provider within **one agent**.

---

## Overview

**one agent** routes requests to different AI providers. The Cursor provider specializes in:

- **Autonomous code editing** — Cursor can read, write, and modify files
- **Refactoring** — Complex code transformations
- **Debugging** — Finding and fixing bugs with file context

### When to Use Cursor

| Task | Use Cursor? | Why |
|------|-------------|-----|
| File editing | ✅ Yes | Cursor can modify files directly |
| Refactoring | ✅ Yes | Specialized in code transformations |
| Debugging | ✅ Yes | Full file system access |
| Code review | ⚠️ Optional | Claude may be better for analysis |
| Architecture advice | ❌ No | Use Claude or Gemini instead |
| Quick Q&A | ❌ No | Use Gemini for speed |

---

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

---

## Using Cursor via Discord

### Method 1: Explicit Provider Mention

Mention "cursor" in your message to route to the Cursor provider:

```
/agent action:chat message:use cursor to refactor the auth module
/agent action:chat message:cursor: fix the memory leak in websocket handler
```

### Method 2: Select a Cursor-Powered Agent

Some agents are pre-configured to use Cursor:

```
/agent action:start agent_name:cursor-coder
/agent action:chat message:Add error handling to the API endpoints
```

### Method 3: Default Configuration

If Cursor is set as your default provider for file-editing tasks in settings, it will be used automatically for code modification requests.

---

## Cursor Agents

**one agent** includes pre-configured Cursor-powered agents:

### `cursor-coder` — Autonomous Coder

- **Purpose**: General-purpose autonomous code editing
- **Model**: sonnet-4
- **Capabilities**: File editing, code generation, refactoring
- **Safety**: Requires approval for operations, sandbox enabled
- **Risk Level**: High

### `cursor-refactor` — Refactoring Specialist

- **Purpose**: Code refactoring and improvement
- **Model**: sonnet-4
- **Capabilities**: Refactoring, code improvement
- **Safety**: Requires approval, sandbox enabled
- **Risk Level**: High

### `cursor-debugger` — Debug Agent

- **Purpose**: Autonomous debugging with code editing
- **Model**: sonnet-4-thinking
- **Capabilities**: Debugging, testing, file editing
- **Safety**: Requires approval, sandbox enabled
- **Risk Level**: High

### `cursor-fast` — Fast Agent ⚠️

- **Purpose**: Quick code changes with auto-approval
- **Model**: sonnet-4
- **Capabilities**: Quick edits
- **Safety**: **AUTO-APPROVES ALL OPERATIONS**
- **Risk Level**: High

⚠️ **Warning**: `cursor-fast` auto-approves all file operations. Only use in development environments or for trivial changes.

---

## How It Works

When you send a request that routes to Cursor:

1. **one agent** receives your Discord message
2. Router determines Cursor is the appropriate provider
3. Bot spawns Cursor CLI process:
   ```bash
   cursor agent --print --output-format stream-json --stream-partial-output \
     --model sonnet-4 --sandbox enabled "<your task>"
   ```
4. Cursor analyzes your codebase and generates a plan
5. Cursor requests approval for file operations (unless `force: true`)
6. Bot streams Cursor's output to Discord in real-time
7. Completion message shows results

### Streaming Updates

Cursor responses are streamed to Discord every ~2 seconds:
- File analysis progress
- Code generation
- Refactoring steps
- Error fixes

---

## Configuration

### Agent Configuration

Each Cursor agent supports these parameters:

```typescript
{
  client: 'cursor',           // Use Cursor provider
  model: 'sonnet-4',          // Cursor model
  workspace: '/path/to/repo', // Working directory
  force: false,               // Auto-approve (true = dangerous!)
  sandbox: 'enabled'          // Sandbox mode
}
```

### Creating Custom Cursor Agents

Add to `agent/types.ts` in `PREDEFINED_AGENTS`:

```typescript
'my-cursor-agent': {
  name: 'My Custom Cursor Agent',
  description: 'Specialized for my workflow',
  model: 'sonnet-4',
  systemPrompt: 'You are a specialist in...',
  temperature: 0.3,
  maxTokens: 8000,
  capabilities: ['file-editing', 'testing'],
  riskLevel: 'high',
  client: 'cursor',
  force: false,
  sandbox: 'enabled'
}
```

---

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

**Note**: Approval prompts currently happen in the CLI. You need access to the bot's terminal to approve operations.

### Risk Levels

| Level | Behavior |
|-------|----------|
| Low | Read-only operations |
| Medium | Limited file modifications |
| High | Full file editing, shell access |

All Cursor agents are marked **High Risk** because they can modify files.

---

## Comparison: Cursor vs Other Providers

| Feature | Cursor | Claude CLI | Ollama | Gemini |
|---------|--------|-----------|--------|--------|
| **File Editing** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Code Execution** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Streaming** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Session Resume** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Speed** | Slower | Fast | Fast | Very Fast |
| **Cost** | Subscription | API | Free | API |
| **Best For** | Coding | Analysis | Privacy | Speed |

---

## Troubleshooting

### Cursor CLI Not Found

```
Error: cursor: command not found
```

**Solution**:
```bash
curl https://cursor.com/install -fsSL | bash
which cursor
cursor agent --version
```

### Authentication Failed

```
Error: Authentication required
```

**Solution**:
```bash
cursor agent --print "test"
# Follow the prompts to sign in
```

### Permission Denied

```
Error: Permission denied: cannot write to file
```

**Solution**:
- Ensure the bot has write permissions in the workspace
- Check that `workspace` parameter points to a valid directory
- Consider using `sandbox: 'enabled'` for safer operations

### Slow Responses

Cursor spawns a new process for each task, which is slower than API-based providers:

| Phase | Typical Time |
|-------|--------------|
| Startup | 1-2 seconds |
| First chunk | 2-5 seconds |
| Complete task | 10-60 seconds |

For faster responses, use Gemini or Ollama for non-file-editing tasks.

---

## Best Practices

### ✅ Do

- Use Cursor for **autonomous code editing**
- Start with `sandbox: 'enabled'` for safety
- Test with simple tasks first
- Review Cursor's changes before committing
- Use other providers for conversation/advice

### ❌ Don't

- Use `cursor-fast` in production environments
- Run Cursor on untrusted codebases without sandbox
- Expect instant responses
- Use Cursor for simple Q&A (use Gemini instead)

---

## Related Documentation

- [CURSOR_GUIDE.md](./CURSOR_GUIDE.md) - Technical CLI reference
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
- [AGENT-ROLE-SYSTEM.md](./AGENT-ROLE-SYSTEM.md) - Role system guide

---

*Last Updated*: January 2026
