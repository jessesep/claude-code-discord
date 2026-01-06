# Claude-Mem Cursor Hooks Integration - Handoff Document

**Date**: January 6, 2026  
**Status**: Setup Complete, Awaiting Verification  
**Agent**: Auto → Next Agent

---

## 🎯 Objective

Integrate `claude-mem` plugin with Cursor IDE to enable persistent memory across Cursor agent sessions. The hooks should capture user prompts, file edits, shell commands, and MCP tool usage.

---

## ✅ What Has Been Completed

### 1. Plugin Installation
- ✅ `claude-mem` plugin installed via Claude Code marketplace
- ✅ Location: `~/.claude/plugins/cache/thedotmack/claude-mem/9.0.0`
- ✅ Bun runtime installed: `~/.bun/bin/bun` (v1.3.5)

### 2. Worker Service
- ✅ Worker service running on port 37777
- ✅ Health check: `http://localhost:37777/health` returns `{"status":"ok"}`
- ✅ Process: `bun worker-service.cjs --daemon` (PID varies)
- ✅ Database created: `~/.claude-mem/claude-mem.db`

### 3. Cursor Hooks Configuration
- ✅ Hooks file created: `~/.cursor/hooks.json`
- ✅ Uses Cursor's native hook event names:
  - `beforeSubmitPrompt` - Captures user prompts
  - `afterFileEdit` - Captures file edits
  - `beforeShellExecution` - Captures shell commands
  - `beforeMCPExecution` - Captures MCP tool usage
  - `stop` - Session summary

### 4. Adapter Script
- ✅ Created: `~/.cursor/hooks/claude-mem-cursor-adapter.js`
- ✅ Translates Cursor hook events to claude-mem format
- ✅ Executable permissions set
- ✅ Handles all 5 hook event types

### 5. Monitoring Tools
- ✅ Created monitoring scripts:
  - `.cursor/watch-hooks.sh` - Real-time activity monitor
  - `.cursor/monitor-hooks.sh` - Advanced monitoring
  - `.cursor/monitor-hooks-simple.sh` - Simple polling monitor

---

## 📁 Files Created/Modified

### Configuration Files
```
~/.cursor/hooks.json                                    # Cursor hooks configuration
~/.cursor/hooks/claude-mem-cursor-adapter.js           # Event translation adapter
~/.claude-mem/settings.json                            # Claude-mem settings (auto-created)
~/.claude-mem/claude-mem.db                            # SQLite database (auto-created)
```

### Documentation Files
```
.cursor/CLAUDE_MEM_HOOKS_HANDOFF.md                    # This file
.cursor/HOOKS_STATUS.md                                # Status documentation
.cursor/CLAUDE_MEM_SETUP.md                            # Original setup guide
.cursor/CLAUDE_MEM_MULTI_AGENT_SETUP.md                # Multi-agent setup guide
```

### Monitoring Scripts
```
.cursor/watch-hooks.sh                                  # Real-time monitor
.cursor/monitor-hooks.sh                                # Advanced monitor
.cursor/monitor-hooks-simple.sh                         # Simple monitor
```

---

## 🔍 Current Status

### ✅ Working
- Worker service is running and healthy
- Hooks configuration is in place
- Adapter script is installed and executable
- Database is initialized
- Monitoring tools are ready

### ⚠️ Needs Verification
- **Hooks are not yet confirmed to be firing**
- No observations captured yet (expected if Cursor hasn't been used)
- Need to verify Cursor recognizes and executes the hooks

---

## 🧪 How to Verify Hooks Are Working

### Method 1: Use Cursor and Check Observations
```bash
# 1. Use Cursor IDE:
#    - Submit a prompt in a chat
#    - Edit a file
#    - Run a shell command via agent

# 2. Check for captured data:
curl 'http://localhost:37777/api/observations?limit=10'

# 3. View memory dashboard:
open http://localhost:37777
```

### Method 2: Monitor Logs in Real-Time
```bash
# Watch for hook activity
tail -f ~/.claude-mem/logs/claude-mem-$(date +%Y-%m-%d).log | grep -E 'HOOK|session|observation'
```

### Method 3: Use Monitoring Script
```bash
# Run the real-time monitor
.cursor/watch-hooks.sh
```

### Method 4: Test Adapter Manually
```bash
# Test the adapter script directly
echo '{"hook_event_name":"beforeSubmitPrompt","conversation_id":"test-123","cwd":"'$(pwd)'","prompt":"test"}' | \
  node ~/.cursor/hooks/claude-mem-cursor-adapter.js
```

---

## 🔧 Troubleshooting

### If Hooks Aren't Firing

1. **Verify hooks.json is loaded by Cursor**
   - Cursor reads `~/.cursor/hooks.json` on startup
   - **Action**: Restart Cursor IDE completely
   - **Check**: Verify file exists and is valid JSON

2. **Check adapter script permissions**
   ```bash
   ls -la ~/.cursor/hooks/claude-mem-cursor-adapter.js
   chmod +x ~/.cursor/hooks/claude-mem-cursor-adapter.js
   ```

3. **Verify worker is running**
   ```bash
   curl http://localhost:37777/health
   ps aux | grep worker-service
   ```

4. **Check for errors in logs**
   ```bash
   tail -50 ~/.claude-mem/logs/claude-mem-$(date +%Y-%m-%d).log
   ```

5. **Test adapter script manually**
   ```bash
   # Should output: {"continue":true,"permission":"allow"}
   echo '{"hook_event_name":"beforeSubmitPrompt","conversation_id":"test","cwd":"'$(pwd)'","prompt":"test"}' | \
     node ~/.cursor/hooks/claude-mem-cursor-adapter.js
   ```

6. **Check Cursor hook format**
   - Cursor may require different hook format
   - Current format uses: `{"command": "node ~/.cursor/hooks/claude-mem-cursor-adapter.js"}`
   - May need absolute paths instead of `~`

### If Worker Isn't Running

```bash
# Start worker manually
cd ~/.claude/plugins/cache/thedotmack/claude-mem/9.0.0
export PATH="$HOME/.bun/bin:$PATH"
bun run scripts/worker-service.cjs start
```

### If Adapter Script Fails

```bash
# Check Node.js is available
which node
node --version

# Test adapter with verbose output
echo '{"hook_event_name":"beforeSubmitPrompt","conversation_id":"test","cwd":"'$(pwd)'","prompt":"test"}' | \
  node ~/.cursor/hooks/claude-mem-cursor-adapter.js 2>&1
```

---

## 📋 Hook Event Mappings

| Cursor Event | Adapter Action | Claude-Mem Hook | Purpose |
|-------------|---------------|-----------------|---------|
| `beforeSubmitPrompt` | Translates to claude-mem format | `context-hook.js` + `new-hook.js` | Inject context, initialize session |
| `afterFileEdit` | Maps file edit data | `save-hook.js` | Save file edits as observations |
| `beforeShellExecution` | Maps command data | `save-hook.js` | Log shell commands |
| `beforeMCPExecution` | Maps MCP tool data | `save-hook.js` | Track MCP tool usage |
| `stop` | Maps session end | `summary-hook.js` | Generate session summary |

---

## 🔄 Next Steps

### Immediate Actions
1. **Verify hooks are firing**
   - Use Cursor IDE normally
   - Check for observations in API
   - Monitor logs for hook activity

2. **If hooks aren't firing:**
   - Check if Cursor recognizes the hooks.json format
   - Verify absolute paths in hooks.json (may need to replace `~` with `$HOME`)
   - Check Cursor's own logs for hook execution errors
   - Test adapter script manually to ensure it works

3. **If hooks are firing but no data:**
   - Check worker service logs for errors
   - Verify database is writable
   - Check claude-mem settings for API keys (if using Gemini/OpenRouter)

### Future Enhancements
- Add context injection to Cursor agent prompts (similar to Antigravity integration)
- Configure provider settings (Gemini/OpenRouter) if needed
- Set up auto-start for worker service
- Add error notifications for hook failures

---

## 📚 Key Resources

### Documentation
- Claude-mem docs: https://docs.claude-mem.ai/cursor
- Cursor hooks: See `docs/CURSOR-INTEGRATION.md` in this repo
- Setup guides: `.cursor/CLAUDE_MEM_*.md` files

### Important Paths
```
Plugin Root:    ~/.claude/plugins/cache/thedotmack/claude-mem/9.0.0
Hooks Config:   ~/.cursor/hooks.json
Adapter Script: ~/.cursor/hooks/claude-mem-cursor-adapter.js
Worker Port:    37777
Database:       ~/.claude-mem/claude-mem.db
Logs:           ~/.claude-mem/logs/claude-mem-YYYY-MM-DD.log
```

### API Endpoints
```
Health:         http://localhost:37777/health
Observations:   http://localhost:37777/api/observations?limit=10
Sessions:       http://localhost:37777/api/sessions?limit=10
Context:        http://localhost:37777/api/context/inject?projects=PROJECT_NAME
Memory Viewer:  http://localhost:37777
```

---

## 🐛 Known Issues

1. **Hooks not yet verified to fire**
   - Status: Setup complete, awaiting first use
   - Action: Need to test with actual Cursor usage

2. **Path resolution in hooks.json**
   - Current: Uses `~` which may not resolve in Cursor's context
   - Potential fix: Use `$HOME` or absolute paths

3. **Environment variables**
   - `CLAUDE_PLUGIN_ROOT` may not be set by Cursor
   - Adapter script has fallback to default path

---

## 💡 Tips for Next Agent

1. **Start by verifying hooks fire**
   - Use the monitoring scripts
   - Check logs immediately after using Cursor

2. **If hooks don't fire:**
   - Cursor may require different hook format
   - Check Cursor's documentation for hook examples
   - May need to use absolute paths instead of `~`

3. **Test incrementally**
   - Test adapter script manually first
   - Then test with Cursor
   - Check each hook event type separately

4. **Use the memory viewer**
   - Open http://localhost:37777
   - Visual confirmation of captured data

---

## 📞 Quick Reference Commands

```bash
# Check worker status
curl http://localhost:37777/health

# Check observations
curl 'http://localhost:37777/api/observations?limit=10'

# Monitor logs
tail -f ~/.claude-mem/logs/claude-mem-$(date +%Y-%m-%d).log

# Test adapter
echo '{"hook_event_name":"beforeSubmitPrompt","conversation_id":"test","cwd":"'$(pwd)'","prompt":"test"}' | \
  node ~/.cursor/hooks/claude-mem-cursor-adapter.js

# Start monitoring
.cursor/watch-hooks.sh

# View memory dashboard
open http://localhost:37777
```

---

## ✅ Handoff Checklist

- [x] Plugin installed
- [x] Worker service running
- [x] Hooks configuration created
- [x] Adapter script created
- [x] Monitoring tools ready
- [ ] Hooks verified to fire
- [ ] Observations confirmed captured
- [ ] Context injection working
- [ ] Documentation complete

---

**Last Updated**: January 6, 2026, 2:40 PM  
**Next Action**: Verify hooks are firing by using Cursor and checking for observations
