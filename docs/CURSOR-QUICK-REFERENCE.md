# Cursor IDE Integration - Quick Reference

**For detailed information, see: [CURSOR-INTEGRATION.md](./CURSOR-INTEGRATION.md)**

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
