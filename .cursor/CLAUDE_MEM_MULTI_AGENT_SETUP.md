# Claude-Mem Multi-Agent Setup Guide
**Ensuring Memory Works Across All Agent Types**

---

## Overview

This project uses **three types of agents**:
1. **Claude Code agents** - Direct Claude Code sessions
2. **Cursor agents** - Spawned via `cursor agent` CLI (`ag-coder`, `cursor-debugger`, etc.)
3. **Antigravity agents** - Spawned via Gemini API (`ag-architect`, `ag-coder`, etc.)

Claude-mem needs to be configured to work with **all three** agent types.

---

## Current Status

✅ **Claude Code**: Works automatically (plugin installed)  
⚠️ **Cursor Agents**: Needs Cursor hooks installation  
⚠️ **Antigravity Agents**: Needs manual context injection or MCP integration

---

## Step 1: Install Cursor Hooks for Claude-Mem

Claude-mem uses Cursor hooks to capture agent sessions. Install them:

```bash
# Navigate to claude-mem installation
cd ~/.claude/plugins/cache/thedotmack/claude-mem

# Install Cursor hooks
bun run cursor:install

# Verify installation
bun run cursor:status
```

**What this does:**
- Installs hooks in `~/.cursor/hooks.json`
- Captures Cursor agent tool usage, file edits, shell commands
- Automatically logs all Cursor agent activity

---

## Step 2: Configure Workspace Context

Ensure claude-mem knows about your project workspace:

```bash
# Set workspace environment variable (optional, but helpful)
export CLAUDE_MEM_WORKSPACE="/Users/jessesep/repos/claude-code-discord"

# Or add to your shell profile
echo 'export CLAUDE_MEM_WORKSPACE="/Users/jessesep/repos/claude-code-discord"' >> ~/.zshrc
```

---

## Step 3: Start Claude-Mem Worker Service

The worker service processes captured data:

```bash
cd ~/.claude/plugins/cache/thedotmack/claude-mem

# Start worker
bun run worker:start

# Check status
bun run worker:status

# View memory at http://localhost:37777
```

**Auto-start on boot (recommended):**
```bash
# Add to your shell profile or use a process manager
bun run worker:start &
```

---

## Step 4: Verify Cursor Agent Capture

Test that Cursor agents are being captured:

1. **Start a Cursor agent** via Discord:
   ```
   /agent action:start agent_name:cursor-debugger
   /agent action:chat message:"List files in agent directory"
   ```

2. **Check claude-mem capture:**
   - Open http://localhost:37777
   - Look for recent observations
   - Should see tool usage, file reads, etc.

3. **Verify hooks are firing:**
   ```bash
   cd ~/.claude/plugins/cache/thedotmack/claude-mem
   bun run cursor:status
   ```

---

## Step 5: Antigravity Agent Integration

Antigravity agents use the Gemini API directly (not Cursor hooks), so we need a different approach:

### Option A: Manual Context Injection (Current Implementation)

The current code already injects context into Antigravity prompts:

```typescript
// From agent/index.ts
let fullPrompt = `${agent.systemPrompt}\n\nTask: ${message}`;

if (contextFiles) {
  // Loads and injects file contents
}

if (includeSystemInfo) {
  // Adds system context
}
```

**Enhancement:** Add claude-mem context retrieval:

```typescript
// TODO: Add claude-mem context injection
// Query claude-mem for relevant memories
// Inject into Antigravity prompt
```

### Option B: Use Claude-Mem MCP Server (Recommended)

Claude-mem provides MCP tools for memory search:

1. **Add claude-mem MCP server** to your MCP configuration
2. **Use memory search tools** in Antigravity prompts
3. **Inject relevant memories** automatically

**Configuration:**
```json
// .mcp.json or MCP config
{
  "mcpServers": {
    "claude-mem": {
      "command": "node",
      "args": ["~/.claude/plugins/cache/thedotmack/claude-mem/dist/mcp-server.js"]
    }
  }
}
```

### Option C: Shared Context File

Create a shared context file that all agents can read:

```typescript
// agent/context-injector.ts
export async function injectClaudeMemContext(
  workDir: string,
  agentName: string,
  task: string
): Promise<string> {
  // Query claude-mem API (localhost:37777)
  // Return relevant context snippets
  // This gets injected into agent prompts
}
```

---

## Step 6: Update Agent Code to Inject Memory Context

Modify `agent/index.ts` to inject claude-mem context for all agent types:

```typescript
// Add to chatWithAgent function
async function injectMemoryContext(
  workDir: string,
  agentName: string,
  message: string
): Promise<string> {
  try {
    // Query claude-mem for relevant memories
    const response = await fetch('http://localhost:37777/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: message,
        agent: agentName,
        workspace: workDir
      })
    });
    
    const memories = await response.json();
    
    if (memories.length > 0) {
      return `\n\n=== Relevant Context from Previous Sessions ===\n${
        memories.map(m => m.summary).join('\n')
      }\n==========================================\n`;
    }
  } catch (error) {
    console.warn('Failed to load claude-mem context:', error);
  }
  
  return '';
}

// Use in chatWithAgent:
const memoryContext = await injectMemoryContext(
  deps?.workDir || Deno.cwd(),
  activeAgentName,
  message
);
enhancedPrompt += memoryContext;
```

---

## Step 7: Verify Multi-Agent Memory

Test that all agent types are capturing/using memory:

### Test 1: Claude Code Agent
```bash
# In Claude Code
/claude prompt:"What security fixes did we implement?"
# Should recall from previous sessions
```

### Test 2: Cursor Agent
```bash
# Via Discord
/agent action:start agent_name:cursor-debugger
/agent action:chat message:"What files did we modify in the security audit?"
# Check http://localhost:37777 for captured data
```

### Test 3: Antigravity Agent
```bash
# Via Discord
/agent action:start agent_name:ag-architect
/agent action:chat message:"What is the Manager-Subagent pattern we use?"
# Should inject relevant context if configured
```

---

## Configuration Files

### Cursor Hooks Configuration
**Location:** `~/.cursor/hooks.json`

After running `bun run cursor:install`, you should see:
```json
{
  "beforeShellExecution": [...],
  "afterFileEdit": [...],
  "stop": [...]
}
```

### Claude-Mem Configuration
**Location:** `~/.claude/plugins/cache/thedotmack/claude-mem/.claude-mem/config.json`

Key settings:
```json
{
  "workspace": "/Users/jessesep/repos/claude-code-discord",
  "provider": "claude-sdk", // or "gemini" or "openrouter"
  "autoInject": true,
  "captureCursorAgents": true
}
```

---

## Troubleshooting

### Cursor Agents Not Capturing

1. **Check hooks are installed:**
   ```bash
   bun run cursor:status
   ```

2. **Verify hooks.json exists:**
   ```bash
   cat ~/.cursor/hooks.json
   ```

3. **Restart Cursor IDE** after hook installation

4. **Check worker is running:**
   ```bash
   bun run worker:status
   ```

### Antigravity Agents Not Getting Context

1. **Verify worker is running:**
   ```bash
   bun run worker:status
   ```

2. **Check memory viewer:**
   - Open http://localhost:37777
   - Verify memories exist

3. **Test memory API:**
   ```bash
   curl http://localhost:37777/api/search -d '{"query":"security fixes"}'
   ```

4. **Check context injection code** in `agent/index.ts`

### Memory Not Appearing

1. **Check worker logs:**
   ```bash
   bun run worker:logs
   ```

2. **Verify API keys:**
   - Claude SDK (if using Claude provider)
   - Gemini API key (if using Gemini provider)

3. **Check workspace path** matches actual project location

---

## Recommended Setup Script

Create a setup script to automate this:

```bash
#!/bin/bash
# setup-claude-mem-agents.sh

CLAUDE_MEM_DIR="$HOME/.claude/plugins/cache/thedotmack/claude-mem"
PROJECT_DIR="/Users/jessesep/repos/claude-code-discord"

echo "🔧 Setting up Claude-Mem for multi-agent support..."

# 1. Install Cursor hooks
cd "$CLAUDE_MEM_DIR"
echo "📌 Installing Cursor hooks..."
bun run cursor:install

# 2. Start worker
echo "🚀 Starting worker service..."
bun run worker:start &

# 3. Verify
echo "✅ Verifying installation..."
bun run cursor:status
bun run worker:status

echo ""
echo "✅ Setup complete!"
echo "📊 View memories at: http://localhost:37777"
echo ""
echo "Next steps:"
echo "1. Restart Cursor IDE"
echo "2. Test with: /agent action:start agent_name:cursor-debugger"
echo "3. Check memory viewer for captured data"
```

---

## Summary

**For Cursor Agents:**
- ✅ Install Cursor hooks: `bun run cursor:install`
- ✅ Start worker service: `bun run worker:start`
- ✅ Hooks automatically capture agent activity

**For Antigravity Agents:**
- ⚠️ Manual context injection needed (or MCP integration)
- ⚠️ Query claude-mem API for relevant memories
- ⚠️ Inject into Antigravity prompts

**For Claude Code Agents:**
- ✅ Works automatically (plugin handles it)

---

**Next Steps:**
1. Run the setup script above
2. Restart Cursor IDE
3. Test with each agent type
4. Verify memory capture at http://localhost:37777
