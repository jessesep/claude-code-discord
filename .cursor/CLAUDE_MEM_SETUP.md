# Claude-Mem Setup Guide

## What is Claude-Mem?

**Claude-Mem** is a Claude Code plugin that provides **long-term memory** across sessions. It:

- ✅ Automatically captures everything Claude does during coding sessions
- ✅ Compresses session data with AI (using Claude's agent-sdk)
- ✅ Injects relevant context back into future sessions
- ✅ Remembers architectural decisions, file changes, and conversation history
- ✅ Prevents re-explaining context every session

## Why Use It?

This Discord bot project has:
- Complex architecture (Manager-Subagent pattern)
- Multiple worktrees and branches
- Security fixes and code reviews
- Agent system with multiple specialized agents

Claude-Mem will remember:
- Why certain architectural decisions were made
- What files were changed and why
- Security fixes that were implemented
- Agent configurations and usage patterns
- Project-specific context and conventions

## Installation

### Step 1: Add Marketplace

**Run this command in Claude Code (not terminal):**

```
/plugin marketplace add thedotmack/claude-mem
```

### Step 2: Install Plugin

**After adding marketplace, install the plugin:**

```
/plugin install claude-mem@thedotmack-claude-mem
```

### Step 3: Verify Installation

```
/plugin
# Navigate to "Installed" tab
# Should see claude-mem listed
```

## Configuration

Claude-Mem works automatically after installation. It will:

1. Start capturing session data
2. Compress and store memories
3. Inject relevant context in future sessions

## Usage

Once installed, Claude-Mem works automatically. No manual commands needed!

It will:
- Remember your project structure
- Recall previous conversations
- Maintain context about code changes
- Remember architectural decisions

## Documentation

- **Official Docs:** https://docs.claude-mem.ai/
- **GitHub:** https://github.com/thedotmack/claude-mem
- **Cursor Integration:** https://docs.claude-mem.ai/cursor

## Benefits for This Project

1. **Architecture Memory:** Remembers Manager-Subagent pattern details
2. **Security Context:** Recalls security fixes and vulnerabilities
3. **Agent Knowledge:** Remembers agent configurations and usage
4. **Worktree Context:** Understands worktree structure and purpose
5. **Code Review History:** Maintains context from code reviews

---

**Note:** This command must be run **inside Claude Code**, not in a terminal. Open Claude Code in Cursor and run the `/plugin` commands there.
