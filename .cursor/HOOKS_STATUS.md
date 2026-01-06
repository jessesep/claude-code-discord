# Claude-Mem Cursor Hooks Status

## ✅ Setup Complete

1. **Worker Service**: Running on port 37777
2. **Hooks Configuration**: `~/.cursor/hooks.json` configured
3. **Adapter Script**: `~/.cursor/hooks/claude-mem-cursor-adapter.js` ready
4. **Database**: Created at `~/.claude-mem/claude-mem.db`

## 🔍 How to Verify Hooks Are Working

### 1. Check if hooks are firing:
- Open Cursor IDE
- Start a new chat or submit a prompt
- Edit a file
- Run a shell command

### 2. Check for captured data:
```bash
# View memory viewer
open http://localhost:37777

# Check logs
tail -f ~/.claude-mem/logs/claude-mem-$(date +%Y-%m-%d).log

# Check observations
curl http://localhost:37777/api/observations?limit=10
```

### 3. Test the adapter manually:
```bash
echo '{"hook_event_name":"beforeSubmitPrompt","conversation_id":"test","cwd":"'$(pwd)'","prompt":"test"}' | \
  node ~/.cursor/hooks/claude-mem-cursor-adapter.js
```

## 📋 Hook Event Mappings

| Cursor Event | Claude-Mem Hook | Purpose |
|-------------|----------------|---------|
| `beforeSubmitPrompt` | `context-hook.js` + `new-hook.js` | Inject context, initialize session |
| `afterFileEdit` | `save-hook.js` | Save file edits as observations |
| `beforeShellExecution` | `save-hook.js` | Log shell commands |
| `beforeMCPExecution` | `save-hook.js` | Track MCP tool usage |
| `stop` | `summary-hook.js` | Generate session summary |

## 🐛 Troubleshooting

If hooks aren't firing:

1. **Verify hooks.json is loaded**:
   - Cursor reads `~/.cursor/hooks.json` on startup
   - Restart Cursor after changes

2. **Check adapter script permissions**:
   ```bash
   chmod +x ~/.cursor/hooks/claude-mem-cursor-adapter.js
   ```

3. **Verify worker is running**:
   ```bash
   curl http://localhost:37777/health
   ```

4. **Check Cursor logs** (if available):
   - Cursor may log hook execution errors

5. **Test adapter manually**:
   - Use the test command above to verify the adapter works

## 📊 Expected Behavior

When hooks are working, you should see:
- New sessions in the memory viewer
- Observations for file edits, commands, and tool usage
- Context being injected into new prompts
- Session summaries when conversations end
