# Cursor Provider - Technical Reference

**Cursor is one of the AI providers available in the one agent ecosystem.**

This document provides technical details for integrating Cursor CLI as a provider. For usage within Discord, see [CURSOR-DISCORD-USAGE.md](./CURSOR-DISCORD-USAGE.md).

---

## Installation

```bash
curl https://cursor.com/install -fsSL | bash
```

---

## Quickest Start: Non-Interactive CLI

```bash
# Basic usage
cursor agent --print --output-format json "analyze the codebase"

# With specific model
cursor agent --print --output-format json --model sonnet-4 "refactor auth module"

# Force auto-approve all operations
cursor agent --print --output-format json --force "fix bugs"

# With specific workspace
cursor agent --print --output-format json --workspace /path/to/project "describe architecture"
```

---

## Node.js Wrapper (Simplest Integration)

```typescript
import { spawn } from "child_process";

async function runCursor(prompt: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn("cursor", [
      "agent",
      "--print",
      "--output-format",
      "json",
      prompt,
    ]);

    let output = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(output));
        } catch {
          resolve(output);
        }
      } else {
        reject(new Error("Cursor failed"));
      }
    });
  });
}

// Usage
const result = await runCursor("list all TypeScript files");
console.log(result);
```

---

## Real-Time Streaming (For Discord)

```typescript
import { spawn } from "child_process";
import { EventEmitter } from "events";

class CursorStream extends EventEmitter {
  spawn(prompt: string) {
    const proc = spawn("cursor", [
      "agent",
      "--print",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      prompt,
    ]);

    let buffer = "";

    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            this.emit("event", event);
          } catch (e) {
            // Invalid JSON line, skip
          }
        }
      }
    });

    proc.on("close", () => this.emit("done"));
    return proc;
  }
}

// Usage
const agent = new CursorStream();
agent.spawn("refactor the module");
agent.on("event", (e) => console.log(e));
agent.on("done", () => console.log("Complete"));
```

---

## Session Management

```bash
# List all conversations
cursor agent ls

# Resume specific chat
cursor agent --resume [chatId]

# Resume most recent
cursor agent resume
```

---

## Key CLI Flags

| Flag | Purpose | Example |
|------|---------|---------|
| `--print` | Non-interactive output | `cursor agent --print "task"` |
| `--output-format` | Output type | `--output-format json\|text\|stream-json` |
| `--stream-partial-output` | Real-time deltas | Use with `stream-json` |
| `--force` | Auto-approve commands | `--force` |
| `--model` | Select model | `--model sonnet-4` |
| `--workspace` | Working directory | `--workspace /path` |
| `--sandbox` | Sandbox mode | `--sandbox enabled\|disabled` |
| `--resume` | Continue chat | `--resume [chatId]` |

---

## Hooks: Real-Time Control

**Configuration**: `~/.cursor/hooks.json`

```json
{
  "beforeShellExecution": [
    {
      "command": "~/.cursor/hooks/security-check.sh"
    }
  ],
  "afterFileEdit": [
    {
      "command": "~/.cursor/hooks/format-code.sh"
    }
  ]
}
```

**Hook Script** (bash example):

```bash
#!/bin/bash

# Read stdin
read -r payload

# Process JSON
command=$(echo "$payload" | jq -r '.command // ""')

# Check for dangerous patterns
if [[ "$command" == *"rm -rf"* ]]; then
  echo '{"continue":false,"permission":"deny","userMessage":"Blocked"}'
  exit 0
fi

# Approve
echo '{"continue":true,"permission":"allow"}'
```

---

## Supported Lifecycle Events (Hooks)

```
beforeShellExecution    - Block/modify shell commands
beforeReadFile          - Control file access
beforeMCPExecution      - Gate MCP tool usage
beforeSubmitPrompt      - Control prompt submission
afterFileEdit           - React to file changes
stop                    - Agent execution completed
```

---

## Cloud API (REST)

```bash
# Launch agent
curl -X POST https://api.cursor.com/v0/agents \
  -H "Authorization: Basic $(echo -n 'apikey:YOUR_API_KEY' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Fix bugs in auth module",
    "repository": {"url": "https://github.com/user/repo"}
  }'

# List agents
curl https://api.cursor.com/v0/agents \
  -H "Authorization: Basic ..."

# Get agent status
curl https://api.cursor.com/v0/agents/{id} \
  -H "Authorization: Basic ..."
```

---

## Environment Variables

```bash
# API key for Cloud API
export CURSOR_API_KEY="your-key-here"

# Cursor agent will set this when running
# Use to detect agent execution in hook scripts
CURSOR_AGENT=1
```

---

## Discord Bot Integration Example

```typescript
// Slash command
app.command({
  name: "cursor",
  description: "Run Cursor AI agent",
  options: [
    {
      name: "task",
      description: "Task description",
      type: "STRING",
      required: true,
    },
  ],
});

async function handleCursor(interaction) {
  const task = interaction.options.getString("task");
  await interaction.deferReply();

  try {
    const result = await runCursor(task);

    await interaction.editReply({
      content: "✓ Cursor completed",
      embeds: [
        {
          description: JSON.stringify(result, null, 2).substring(0, 4000),
          color: 0x00ff00,
        },
      ],
    });
  } catch (error) {
    await interaction.editReply(`❌ Error: ${error.message}`);
  }
}
```

---

## Limitations & Workarounds

| Problem | Solution |
|---------|----------|
| Can't pipe prompt via stdin | Use: `cursor agent "$(cat file)"` |
| No stdin/stdout for prompts | Use hooks system for lifecycle control |
| Requires Cursor installation | Use Cloud API instead (requires API key) |
| Fancy shell prompts break output | Set `CURSOR_AGENT=1` to skip complex themes |
| First invocation is slow | Cache agent or use Cloud API |

---

## Comparison: Non-Interactive vs. Hooks vs. Cloud API

| Aspect | Non-Interactive | Hooks | Cloud API |
|--------|-----------------|-------|-----------|
| Setup Complexity | Simple | Medium | Medium |
| Real-time Updates | ✗ No | ✓ Yes | ~ Polling |
| Requires Installation | ✓ Yes | ✓ Yes | ✗ No |
| Security Control | Limited | ✓ Full | Limited |
| Cost | Free | Free | Requires subscription |
| Best For | Simple tasks | Security gates | Remote agents |

---

## Testing Checklist

- [ ] `cursor agent --version` works
- [ ] `cursor agent --print "hello"` outputs text
- [ ] `cursor agent --print --output-format json "test"` outputs valid JSON
- [ ] Node.js wrapper successfully spawns process
- [ ] Output parsing works correctly
- [ ] Error handling for failed runs
- [ ] Timeout management implemented
- [ ] Discord integration tested

---

## Recommended Reading

1. **First**: [Using Agent in CLI](https://cursor.com/docs/cli/using)
2. **Integration**: [Cursor CLI Overview](https://cursor.com/docs/cli/overview)
3. **Advanced**: [Hooks System](https://cursor.com/docs/agent/hooks)
4. **Enterprise**: [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints)
5. **Examples**: [hamzafer/cursor-hooks](https://github.com/hamzafer/cursor-hooks)

---

## Security Checklist

- [ ] Never log API keys
- [ ] Sanitize Discord user input before passing to Cursor
- [ ] Use `--sandbox enabled` for untrusted prompts
- [ ] Configure `beforeShellExecution` hook to block dangerous commands
- [ ] Use `beforeReadFile` hook to prevent reading sensitive files
- [ ] Store `CURSOR_API_KEY` in environment only
- [ ] Consider rate limiting for Discord integration
- [ ] Monitor file modifications via `afterFileEdit` hook
- [ ] Audit all agent operations via hooks

---

**Last Updated**: January 6, 2026
**Quick Reference Version**: 1.0
# Cursor IDE Programmatic Integration & Process Control

**Research Date**: January 6, 2026
**Cursor Version**: 2.2.27 (CLI: 2026.01.02-80e4d9b)
**Status**: Researched and documented

---

## Executive Summary

Cursor IDE has comprehensive CLI capabilities enabling programmatic spawning and control similar to Claude CLI. The tool supports:

1. **CLI Agent Mode** - Headless execution with stdin/stdout communication
2. **Non-Interactive Output** - JSON and stream formats for machine parsing
3. **Process Hooks** - JSON-based stdin/stdout communication for lifecycle events
4. **Cloud API** - REST endpoints for remote agent management
5. **Session Management** - Resume and conversation history tracking

**Bottom Line**: Cursor can be spawned as a process, controlled via stdin/stdout (for hooks), and integrated into automation pipelines. However, it differs from Claude CLI in that the primary agent communication is not bidirectional stdin/stdout—instead, use the `--print` flag with `--output-format json` for structured output, or use Hooks for lifecycle control.

---

## 1. Cursor CLI Capabilities

### Installation

```bash
curl https://cursor.com/install -fsSL | bash
```

**Available Commands:**
- `cursor` - IDE launcher with file operations
- `cursor agent` - Autonomous AI agent in terminal/headless
- `cursor serve-web` - Web server interface
- `cursor tunnel` - Secure tunnel access

### Version Check

```bash
cursor --version          # IDE version: 2.2.27
cursor agent --version    # Agent CLI version: 2026.01.02-80e4d9b
```

---

## 2. Cursor Agent CLI Interface

### Basic Usage

```bash
# Interactive mode (default)
cursor agent "find and fix bugs in auth module"

# Non-interactive mode (for scripting)
cursor agent --print "analyze code quality" --output-format json

# Resume previous conversation
cursor agent --resume [chatId]
cursor agent resume                    # Most recent
cursor agent ls                        # List all chats
```

### CLI Arguments Reference

**Core Options:**
```
--api-key <key>                    API authentication (or CURSOR_API_KEY env var)
-H, --header <header>              Custom headers (format: 'Name: Value')
--model <model>                    Model selection (gpt-5, sonnet-4, sonnet-4-thinking)
--workspace <path>                 Working directory (default: cwd)
-f, --force                        Force approval of all commands
```

**Output & Processing:**
```
-p, --print                        Print responses (headless, non-interactive)
--output-format <format>           Output format options:
                                   - text (default)
                                   - json (structured, machine-parseable)
                                   - stream-json (streaming JSON objects)
--stream-partial-output            Stream text deltas as they arrive
```

**Execution Control:**
```
-w, --wait                         Wait for files to be closed before returning
--verbose                          Print detailed execution information
--log <level>                      Log level (trace, debug, info, warn, error)
```

**Safety & Sandbox:**
```
--sandbox <mode>                   Explicitly enable/disable sandbox (enabled|disabled)
--approve-mcps                     Auto-approve MCP servers (headless only)
--browser                          Enable browser automation
--disable-extensions               Disable all extensions
--disable-extension <id>           Disable specific extension
```

**Cloud & Modes:**
```
-c, --cloud                        Start in cloud mode (composer picker)
--suppress-popups-on-startup       Disable notification popups
```

---

## 3. Non-Interactive / Headless Mode

### Purpose
Execute tasks autonomously in scripts, CI/CD pipelines, and automated workflows without user interaction.

### Core Flags
```bash
cursor agent \
  --print \
  --output-format json \
  --stream-partial-output \
  --force \
  "your task here"
```

### Output Formats

#### Text Format (Default)
```bash
cursor agent --print --output-format text "list files"
```
Output: Plain text response from the agent

#### JSON Format
```bash
cursor agent --print --output-format json "analyze test coverage"
```
Output: Structured JSON object (easier for parsing in scripts):
```json
{
  "status": "completed",
  "response": "...",
  "files_modified": [...],
  "commands_executed": [...]
}
```

#### Stream JSON Format
```bash
cursor agent --print --output-format stream-json --stream-partial-output "refactor module"
```
Output: JSON objects streamed line-by-line, one per update:
```
{"type":"status","value":"Analyzing"}
{"type":"delta","value":"refactor"}
{"type":"delta","value":"ing"}
{"type":"complete","files":[...]}
```

---

## 4. Bidirectional Communication: Process Hooks

### Overview
Cursor Hooks enable **true bidirectional communication** with spawned processes. Each hook executes as a standalone process that receives JSON on stdin and returns JSON on stdout.

### Lifecycle Events

Supported hook triggers:
```
beforeShellExecution        - Block/modify commands before execution
beforeMCPExecution          - Control MCP tool usage
beforeReadFile              - Gate file access
beforeSubmitPrompt          - Control prompt submission
afterFileEdit               - React to file changes
beforeTabFileRead           - Inline completion file read
afterTabFileEdit            - Inline completion file edit
stop                        - Agent execution completed
```

### Hook Configuration

**File Location** (by priority):
1. `<project>/.cursor/hooks.json` (project-specific)
2. `~/.cursor/hooks.json` (user home)
3. Enterprise MDM distribution

**Structure:**
```json
{
  "beforeShellExecution": [
    {
      "command": "~/.cursor/hooks/block-dangerous-commands.sh"
    }
  ],
  "beforeSubmitPrompt": [
    {
      "command": "~/.cursor/hooks/audit-prompt.sh"
    }
  ],
  "afterFileEdit": [
    {
      "command": "~/.cursor/hooks/run-formatter.sh"
    }
  ]
}
```

### Hook Process Communication

#### Input (stdin) - JSON
The hook receives a JSON object on stdin with the following structure:

**For `beforeShellExecution`:**
```json
{
  "hook_event_name": "beforeShellExecution",
  "conversation_id": "abc123",
  "generation_id": "gen456",
  "command": "npm install express",
  "cwd": "/path/to/project",
  "workspace_roots": ["/path/to/project"]
}
```

**For `beforeReadFile`:**
```json
{
  "hook_event_name": "beforeReadFile",
  "conversation_id": "abc123",
  "generation_id": "gen456",
  "file_path": "/path/to/sensitive/file.key"
}
```

**For `afterFileEdit`:**
```json
{
  "hook_event_name": "afterFileEdit",
  "conversation_id": "abc123",
  "generation_id": "gen456",
  "file_path": "/path/to/edited/file.ts",
  "file_content": "...",
  "diff": "..."
}
```

#### Output (stdout) - JSON
The hook must write JSON to stdout to respond:

```json
{
  "continue": true,
  "permission": "allow",
  "userMessage": "✓ Command approved",
  "agentMessage": "The user approved this command"
}
```

**Response Fields:**
- `continue` (boolean) - Whether to continue execution
- `permission` (string) - "allow" | "deny" | "ask"
- `userMessage` (string) - Message shown to user
- `agentMessage` (string) - Context for the agent

---

## 5. Cloud Agents API (REST)

### Overview
For remote agent management via REST API (not stdin/stdout based).

### Authentication
```bash
Authorization: Basic $(echo -n "apikey:$CURSOR_API_KEY" | base64)
```

### Core Endpoints

```
GET  /v0/agents                   List all agents (pagination: limit, cursor)
GET  /v0/agents/{id}              Get agent status
POST /v0/agents                   Launch new agent
POST /v0/agents/{id}/followup     Add follow-up instructions
POST /v0/agents/{id}/stop         Pause agent execution
DELETE /v0/agents/{id}            Delete agent
GET  /v0/agents/{id}/conversation Get conversation history
GET  /v0/me                       Verify API key
GET  /v0/models                   List available models
GET  /v0/repositories             Access GitHub repos (rate limited)
```

### Launch Agent Example

```bash
curl -X POST https://api.cursor.com/v0/agents \
  -H "Authorization: Basic ..." \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Fix SQL injection vulnerabilities",
    "repository": {
      "url": "https://github.com/user/repo"
    },
    "model": "sonnet-4"
  }'
```

**Response:**
```json
{
  "id": "agent-123",
  "status": "running",
  "created_at": "2026-01-06T10:00:00Z"
}
```

### Limitations
- MCP (Model Context Protocol) not currently supported
- Repository listing has strict rate limits (1/min, 30/hour per user)

---

## 6. Stdin/Stdout Limitations for Agent Prompts

### Key Limitation
Unlike Claude CLI, **Cursor Agent does NOT support reading prompts from stdin piped directly** with `-` flag. The following does NOT work:

```bash
echo "analyze code" | cursor agent -    # ❌ Not supported
cat prompt.txt | cursor agent -         # ❌ Not supported
```

### Workaround
Use command substitution instead:

```bash
cursor agent "$(cat prompt.txt)"         # ✓ Works
cursor agent "$(echo 'analyze code')"    # ✓ Works

# Or via env var
PROMPT=$(cat prompt.txt)
cursor agent "$PROMPT"
```

---

## 7. Recommended Integration Approaches

### Approach 1: Non-Interactive CLI with JSON Output (Simplest)

**Use Case**: One-shot tasks, CI/CD pipelines, Discord bot integration

```typescript
// Spawn Cursor agent and capture output
import { spawn } from "child_process";

function runCursorAgent(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("cursor", [
      "agent",
      "--print",
      "--output-format",
      "json",
      prompt,
    ]);

    let output = "";
    let error = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.stderr.on("data", (data) => {
      error += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          resolve(output); // Fallback to text
        }
      } else {
        reject(new Error(`Cursor failed: ${error}`));
      }
    });
  });
}
```

**Limitations:**
- No bidirectional communication during execution
- Full output only after completion
- Cannot intervene mid-task

**Advantages:**
- Simple to implement
- Easy to parse structured output
- Works in any environment with Cursor installed

---

### Approach 2: Hooks-Based Lifecycle Control (Advanced)

**Use Case**: Real-time monitoring, security gates, command approval workflows

**Setup:**
1. Create hook scripts in `~/.cursor/hooks/`
2. Configure `hooks.json` to point to your scripts
3. Hook scripts receive/send JSON via stdin/stdout
4. Restart Cursor IDE

**Example Hook Script** (`~/.cursor/hooks/security-gate.sh`):

```bash
#!/bin/bash

# Read JSON from stdin
read -r payload
echo "$payload" | jq .

# Extract hook event and data
event=$(echo "$payload" | jq -r '.hook_event_name')
command=$(echo "$payload" | jq -r '.command // empty')

# Security checks
if [[ "$command" == *"rm -rf"* ]] || [[ "$command" == *"sudo"* ]]; then
  # Block dangerous commands
  echo '{
    "continue": false,
    "permission": "deny",
    "userMessage": "🚫 Dangerous command blocked",
    "agentMessage": "Security policy prevents this command"
  }' > /dev/stdout
  exit 0
fi

# Allow safe commands
echo '{
  "continue": true,
  "permission": "allow",
  "userMessage": "✓ Approved",
  "agentMessage": "Command passed security checks"
}' > /dev/stdout
```

**Advantages:**
- Real-time control and monitoring
- Security gates and policy enforcement
- Audit logging of all operations
- Can block operations before execution

**Limitations:**
- Requires Cursor IDE (or agent) to be running
- Hooks execute synchronously (can slow down operations)
- Complex setup and debugging

---

### Approach 3: Cloud Agents API (Enterprise)

**Use Case**: Remote agent orchestration, multi-agent coordination, managed infrastructure

```typescript
interface CloudAgentRequest {
  prompt: string;
  repository: { url: string };
  model: "sonnet-4" | "gpt-5";
  auto_create_pr?: boolean;
  branch_name?: string;
}

async function launchCloudAgent(req: CloudAgentRequest) {
  const response = await fetch("https://api.cursor.com/v0/agents", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `apikey:${process.env.CURSOR_API_KEY}`
      ).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });

  return response.json();
}

// Poll agent status
async function waitForAgent(agentId: string) {
  while (true) {
    const res = await fetch(`https://api.cursor.com/v0/agents/${agentId}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `apikey:${process.env.CURSOR_API_KEY}`
        ).toString("base64")}`,
      },
    });
    const agent = await res.json();

    if (agent.status === "completed" || agent.status === "failed") {
      return agent;
    }

    await new Promise((r) => setTimeout(r, 5000)); // Poll every 5s
  }
}
```

**Advantages:**
- No local Cursor installation required
- Scalable to many agents
- REST API familiar to most developers
- Automatic PR creation

**Limitations:**
- Requires Cursor API key and subscription
- Rate limits on repository operations
- MCP not supported
- Polling-based (no true streaming)

---

### Approach 4: Stream JSON with Real-Time Parsing (Recommended for Discord)

**Use Case**: Live updates to Discord messages, real-time progress indicators

```typescript
import { spawn } from "child_process";
import { EventEmitter } from "events";

class CursorAgent extends EventEmitter {
  spawn(prompt: string) {
    const proc = spawn("cursor", [
      "agent",
      "--print",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      prompt,
    ]);

    let buffer = "";

    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();

      // Process complete JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line

      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            this.emit("update", event);

            // Emit specific events
            if (event.type === "delta") {
              this.emit("text", event.value);
            } else if (event.type === "file_edit") {
              this.emit("file_edited", event);
            } else if (event.type === "command") {
              this.emit("command", event);
            } else if (event.type === "complete") {
              this.emit("done", event);
            }
          } catch (e) {
            console.warn("Failed to parse JSON:", line);
          }
        }
      }
    });

    proc.on("error", (err) => this.emit("error", err));
    proc.on("close", (code) => {
      if (code !== 0) {
        this.emit("error", new Error(`Agent exited with code ${code}`));
      }
    });

    return proc;
  }
}

// Usage
const agent = new CursorAgent();
agent.spawn("refactor auth module");

agent.on("update", (event) => console.log("Update:", event));
agent.on("text", (text) => console.log("Text delta:", text));
agent.on("file_edited", (file) =>
  console.log("File edited:", file.path)
);
agent.on("done", (result) => console.log("Complete:", result));
agent.on("error", (err) => console.error("Error:", err));
```

---

## 8. Integration with one agent

**one agent** routes requests to different providers. When a task requires file editing, it routes to Cursor.

### Scenario: Discord Commands for Cursor

```typescript
// Discord bot slash command
app.command({
  name: "cursor-fix",
  description: "Run Cursor agent to fix a bug",
  options: [
    {
      name: "description",
      description: "Bug description",
      type: "STRING",
      required: true,
    },
    {
      name: "workspace",
      description: "Workspace path",
      type: "STRING",
      required: false,
    },
  ],
});

async function handleCursorFix(interaction) {
  const description = interaction.options.getString("description");
  const workspace = interaction.options.getString("workspace") || process.cwd();

  await interaction.deferReply();

  try {
    // Launch agent
    const proc = spawn("cursor", [
      "agent",
      "--print",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      `Fix bug: ${description}`,
    ]);

    let lastUpdate = Date.now();
    let messageContent = "";
    let updateCount = 0;

    // Stream updates to Discord
    proc.stdout.on("data", async (chunk) => {
      const json = JSON.parse(chunk.toString());

      if (json.type === "delta") {
        messageContent += json.value;
        updateCount++;

        // Update Discord message every 500ms or every 100 deltas
        if (
          Date.now() - lastUpdate > 500 ||
          updateCount >= 100
        ) {
          const preview = messageContent.substring(0, 2000);
          await interaction.editReply(`\`\`\`${preview}\`\`\`...`);
          lastUpdate = Date.now();
          updateCount = 0;
        }
      }
    });

    proc.on("close", async (code) => {
      if (code === 0) {
        await interaction.editReply({
          content: "✓ Cursor agent completed successfully",
          embeds: [
            {
              description: messageContent.substring(0, 4000),
              color: 0x00ff00,
            },
          ],
        });
      } else {
        await interaction.editReply("❌ Cursor agent failed");
      }
    });
  } catch (error) {
    await interaction.editReply(`Error: ${error.message}`);
  }
}
```

---

## 9. Challenges & Limitations

### Challenge 1: No Native Stdin Prompt Input
**Problem**: Cannot pipe prompts directly via stdin
**Solution**: Use command substitution or environment variables

### Challenge 2: Cursor Requires Authentication
**Problem**: `CURSOR_API_KEY` env var may be required for some operations
**Solution**: Set API key in environment or use `--api-key` flag

### Challenge 3: Sandbox & Permission Restrictions
**Problem**: Operations may require user approval or hit sandbox restrictions
**Solution**: Use `--force` flag for non-interactive, or configure `--sandbox disabled`

### Challenge 4: Output Buffering in Stream Mode
**Problem**: JSON streaming may arrive in chunks, requiring line buffering
**Solution**: Implement circular buffer to reconstruct complete JSON objects

### Challenge 5: File Operations in Non-Interactive Mode
**Problem**: Cursor has full write access in `--print` mode (security risk)
**Solution**: Use hooks for approval gates, or run in sandbox mode

### Challenge 6: Slow First Invocation
**Problem**: First `cursor agent` call installs dependencies
**Solution**: Run `cursor agent --version` once on startup to warm up

### Challenge 7: Complex Shell Environments
**Problem**: Fancy prompts (Powerlevel10k) break output parsing
**Solution**: Agent sets `CURSOR_AGENT` env var; hook scripts can detect this

---

## 10. Code Examples & Templates

### Example 1: Simple Non-Interactive Wrapper

```typescript
export async function runCursorAgent(
  prompt: string,
  options?: { force?: boolean; model?: string }
): Promise<string> {
  const { spawn } = await import("child_process");

  return new Promise((resolve, reject) => {
    const args = ["agent", "--print", "--output-format", "json"];

    if (options?.force) args.push("--force");
    if (options?.model) {
      args.push("--model", options.model);
    }

    args.push(prompt);

    const proc = spawn("cursor", args);
    let output = "";
    let error = "";

    proc.stdout.on("data", (data) => {
      output += data;
    });

    proc.stderr.on("data", (data) => {
      error += data;
    });

    proc.on("close", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(output));
        } catch {
          resolve(output);
        }
      } else {
        reject(new Error(`Cursor failed: ${error}`));
      }
    });
  });
}
```

### Example 2: Hook for Command Approval

**File**: `~/.cursor/hooks/approval-gate.sh`

```bash
#!/bin/bash
set -euo pipefail

# Read stdin
payload=$(cat)

# Extract command
command=$(echo "$payload" | jq -r '.command // ""')

# Log to file
echo "[$(date)] Command: $command" >> ~/.cursor/hook-audit.log

# Dangerous patterns - deny
if echo "$command" | grep -qE '(rm -rf|sudo|chmod|chown|:(){'; then
  echo '{
    "continue": false,
    "permission": "deny",
    "userMessage": "🚫 Dangerous pattern detected",
    "agentMessage": "Command blocked by security policy"
  }'
  exit 0
fi

# Safe patterns - allow
echo '{
  "continue": true,
  "permission": "allow",
  "userMessage": "✓ Command approved",
  "agentMessage": "Command passed safety checks"
}'
```

**Configuration**: `~/.cursor/hooks.json`

```json
{
  "beforeShellExecution": [
    {
      "command": "~/.cursor/hooks/approval-gate.sh"
    }
  ]
}
```

### Example 3: Session Resume Pattern

```typescript
import { execSync } from "child_process";

// Get most recent chat ID
function getLastChatId(): string | null {
  try {
    const output = execSync("cursor agent ls --format json", {
      encoding: "utf-8",
    });
    const chats = JSON.parse(output);
    return chats[0]?.id || null;
  } catch {
    return null;
  }
}

// Resume conversation
async function resumeLastSession(followUp: string) {
  const chatId = getLastChatId();
  if (!chatId) {
    throw new Error("No previous chat found");
  }

  return runCursorAgent("", {
    resume: chatId,
    followUp,
  });
}
```

---

## 11. Comparison: Cursor vs. Claude CLI

| Feature | Cursor Agent | Claude CLI |
|---------|--------------|-----------|
| **CLI Available** | ✓ Yes (2.0+) | ✓ Yes |
| **Interactive Mode** | ✓ Yes | ✓ Yes |
| **Non-Interactive Mode** | ✓ `--print` | ✓ Yes (default) |
| **Stdin Prompts** | ✗ No direct stdin | ✓ Yes, `-` flag |
| **JSON Output** | ✓ Yes | ✓ Yes |
| **Stream JSON** | ✓ Yes | ✓ Yes (via API) |
| **Bidirectional Stdin/Stdout** | ✓ Hooks system | Limited |
| **File Operations** | ✓ Yes | ✓ Yes |
| **Shell Commands** | ✓ Yes | ✓ Yes |
| **MCP Support** | ✓ Yes (in IDE) | ✓ Yes |
| **REST API** | ✓ Cloud Agents | Limited |
| **Session Resume** | ✓ Yes | ✗ No |
| **Sandbox Mode** | ✓ Yes | ✗ No |
| **Hooks/Lifecycle** | ✓ Yes (JSON) | ✗ No |

---

## 12. Security Considerations

### Key Points for Discord Bot Integration

1. **Full Write Access in `--print` Mode**
   - Cursor has unrestricted file write in non-interactive mode
   - Consider using sandbox or hook-based approval gates
   - Never expose untrusted user input directly to Cursor prompts

2. **API Key Security**
   - Store `CURSOR_API_KEY` in environment only
   - Never log or expose keys
   - Rotate keys regularly if exposed

3. **Command Injection**
   - Sanitize user input before passing to Cursor
   - Use hooks to prevent execution of dangerous commands
   - Consider allowlisting safe commands

4. **File Access Control**
   - Use `beforeReadFile` hook to prevent reading sensitive files
   - Restrict workspace to specific directories
   - Monitor file access via `afterFileEdit` hook

5. **Sandbox Restrictions**
   - Use `--sandbox enabled` for untrusted prompts
   - Configure allowlists for safe directories
   - Monitor attempts to escape sandbox

---

## 13. Recommended Path Forward

### For Discord Bot Integration:

**Phase 1: Simple CLI Wrapper** (Implement First)
- Use `cursor agent --print --output-format json`
- One-shot task execution
- Easy error handling
- Works offline with local Cursor installation

**Phase 2: Streaming Updates** (Future Enhancement)
- Use `--output-format stream-json` for real-time Discord updates
- Implement line-buffered JSON parser
- Update Discord messages progressively

**Phase 3: Hooks-Based Approval** (Enterprise Feature)
- Configure `~/.cursor/hooks.json` for security gates
- Add approval workflow for risky operations
- Integrate with existing audit logging

**Phase 4: Cloud API Integration** (Optional)
- Use REST API for remote agent orchestration
- Manage API key securely
- Implement polling for completion

---

## 14. Resources & References

### Official Documentation
- [Cursor CLI Documentation](https://cursor.com/docs/cli/overview)
- [Using Agent in CLI](https://cursor.com/docs/cli/using)
- [Cursor Hooks System](https://cursor.com/docs/agent/hooks)
- [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints)
- [Agent Terminal Integration](https://cursor.com/docs/agent/terminal)

### Community & Examples
- [cursor-hooks Examples (hamzafer)](https://github.com/hamzafer/cursor-hooks)
- [cursor-hooks TypeScript Library (johnlindquist)](https://github.com/johnlindquist/cursor-hooks)
- [Cursor Hooks Deep Dive (GitButler Blog)](https://blog.gitbutler.com/cursor-hooks-deep-dive)
- [InfoQ: Cursor 1.7 Hooks](https://www.infoq.com/news/2025/10/cursor-hooks/)

### Blog Posts & Guides
- [Cursor Agent CLI Announcement](https://cursor.com/blog/cli)
- [How to Use Cursor 1.7 Hooks Guide (Skywork.ai)](https://skywork.ai/blog/how-to-cursor-1-7-hooks-guide/)
- [Cursor AI Review 2025 (Skywork.ai)](https://skywork.ai/blog/cursor-ai-review-2025-agent-refactors-privacy/)
- [Cursor Hooks Deep Dive (Luca Becker Blog)](https://luca-becker.me/blog/cursor-sandboxing-leaks-secrets/)

---

## 15. Implementation Checklist

- [ ] Install Cursor agent CLI: `curl https://cursor.com/install -fsSL | bash`
- [ ] Verify installation: `cursor agent --version`
- [ ] Test basic invocation: `cursor agent --print "list directory"`
- [ ] Set API key (if needed): `export CURSOR_API_KEY=...`
- [ ] Create wrapper function for non-interactive mode
- [ ] Implement stream JSON parser for real-time updates
- [ ] Design hook system for security gates (future)
- [ ] Set up error handling and timeout management
- [ ] Test with Discord bot integration
- [ ] Document security policies for Cursor operations
- [ ] Plan rate limiting strategy
- [ ] Set up audit logging

---

**Document Status**: Complete
**Last Updated**: January 6, 2026
**Next Review**: Q2 2026
