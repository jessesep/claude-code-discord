# Quick Setup: Claude-Mem for All Agents

## ✅ What's Already Done

1. ✅ **Claude-mem plugin installed** (user scope)
2. ✅ **Context injection code added** to all agent types
3. ✅ **Utility module created** (`util/claude-mem-context.ts`)

## 🚀 Next Steps (Required)

### 1. Install Bun (if not installed)
```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Install Cursor Hooks
```bash
cd ~/.claude/plugins/cache/thedotmack/claude-mem/9.0.0
bun run cursor:install
```

### 3. Start Worker Service
```bash
bun run worker:start
```

### 4. Restart Cursor IDE
Restart Cursor to activate hooks.

## ✅ Verification

1. **Check worker:** http://localhost:37777
2. **Test Cursor agent:**
   ```
   /agent action:start agent_name:cursor-debugger
   /agent action:chat message:"test"
   ```
3. **Check memory viewer** for captured data

## 📖 Full Guide

See `.cursor/CLAUDE_MEM_MULTI_AGENT_SETUP.md` for complete details.
