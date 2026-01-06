# Claude-Mem Cursor Hooks Verification Report

**Date**: January 6, 2026  
**Status**: ⚠️ **PARTIALLY WORKING** - Sessions and prompts are stored, but observations are not

---

## ✅ What's Working

### 1. Infrastructure
- ✅ **Worker Service**: Running on port 37777 (PID 78582)
- ✅ **Health Check**: `http://localhost:37777/health` returns `{"status":"ok"}`
- ✅ **Database**: Created at `~/.claude-mem/claude-mem.db` (4KB)
- ✅ **Hooks Configuration**: `~/.cursor/hooks.json` properly configured
- ✅ **Adapter Script**: `~/.cursor/hooks/claude-mem-cursor-adapter.js` exists and is executable

### 2. Data Storage (Partial)
- ✅ **Sessions**: 8 SDK sessions stored in database
- ✅ **User Prompts**: 20 user prompts stored in database
- ✅ **Session Initialization**: `new-hook.js` is working (see logs: `INIT_COMPLETE`)

---

## ❌ What's NOT Working

### 1. Observations Not Being Stored
- ❌ **Observations Table**: 0 observations in database
- ❌ **File Edits**: `afterFileEdit` hook may not be firing or not saving data
- ❌ **Shell Commands**: `beforeShellExecution` hook may not be firing or not saving data
- ❌ **MCP Tools**: `beforeMCPExecution` hook may not be firing or not saving data

### 2. Evidence from Logs
- No `PostToolUse` entries in logs
- No `save-hook` activity visible
- Only `INIT_COMPLETE` entries for session initialization

---

## 🔍 Diagnostic Results

### Database Status
```sql
-- Tables exist:
- observations (0 rows)
- user_prompts (20 rows)
- sdk_sessions (8 rows)
- session_summaries
- pending_messages
```

### Hook Configuration
```json
{
  "beforeSubmitPrompt": [{"command": "node /Users/jessesep/.cursor/hooks/claude-mem-cursor-adapter.js"}],
  "afterFileEdit": [{"command": "node /Users/jessesep/.cursor/hooks/claude-mem-cursor-adapter.js"}],
  "beforeShellExecution": [{"command": "node /Users/jessesep/.cursor/hooks/claude-mem-cursor-adapter.js"}],
  "beforeMCPExecution": [{"command": "node /Users/jessesep/.cursor/hooks/claude-mem-cursor-adapter.js"}],
  "stop": [{"command": "node /Users/jessesep/.cursor/hooks/claude-mem-cursor-adapter.js"}]
}
```

### Manual Test Results
```bash
# Test new-hook (session initialization) - ✅ WORKS
echo '{"hook_event_name":"beforeSubmitPrompt",...}' | node adapter.js
# Result: Session created in database

# Test save-hook (observations) - ❌ NO DATA SAVED
echo '{"hook_event_name":"afterFileEdit",...}' | node adapter.js
# Result: No observations created
```

---

## 🐛 Root Cause Analysis

### Likely Issues

1. **Cursor Hooks May Not Be Firing**
   - Cursor may not be invoking `afterFileEdit`, `beforeShellExecution`, or `beforeMCPExecution` hooks
   - These hooks might only fire for Cursor **agents** (not regular Cursor IDE usage)
   - Need to verify if hooks are triggered during actual Cursor agent sessions

2. **Adapter Script Issues**
   - The adapter spawns `save-hook.js` but doesn't wait for completion
   - Errors in `save-hook.js` might be silently ignored
   - The `unref()` calls may cause processes to exit before completing

3. **Session ID Mismatch**
   - The adapter generates session IDs like `cursor-${Date.now()}` for file edits
   - These may not match the actual session IDs from `beforeSubmitPrompt`
   - `save-hook.js` requires a valid `contentSessionId` that exists in the database

---

## 🔧 Recommended Fixes

### Fix 1: Improve Error Handling in Adapter
```javascript
// In runClaudeMemHook function, capture stderr and log errors
hook.stderr.on('data', (data) => {
  console.error(`[claude-mem-adapter] Hook error: ${data}`);
});
```

### Fix 2: Use Consistent Session IDs
```javascript
// Store session_id from beforeSubmitPrompt and reuse it
// Instead of generating new IDs for each event
```

### Fix 3: Verify Hook Execution
- Add logging to adapter script to confirm hooks are being called
- Check Cursor's own logs for hook execution errors
- Test with actual Cursor agent sessions (not just IDE usage)

### Fix 4: Test with Real Cursor Agent
```bash
# Run a Cursor agent and verify hooks fire
cursor agent "edit a file" --print
# Then check if observations are created
```

---

## 📊 Current Data Summary

| Component | Status | Count |
|-----------|--------|-------|
| Worker Service | ✅ Running | Port 37777 |
| Database | ✅ Exists | 4KB |
| SDK Sessions | ✅ Stored | 8 |
| User Prompts | ✅ Stored | 20 |
| Observations | ❌ Empty | 0 |
| File Edits | ❌ Not captured | 0 |
| Shell Commands | ❌ Not captured | 0 |
| MCP Tools | ❌ Not captured | 0 |

---

## ✅ Verification Steps Completed

1. ✅ Verified worker service is running
2. ✅ Verified hooks.json configuration
3. ✅ Verified adapter script exists and is executable
4. ✅ Verified database exists with proper schema
5. ✅ Verified sessions and prompts are being stored
6. ❌ **Observations are NOT being stored**
7. ❌ **Cannot verify if hooks are actually firing from Cursor**

---

## 🎯 Next Steps

1. **Test with Real Cursor Agent Session**
   - Run `cursor agent "make a file edit"` 
   - Monitor logs for hook activity
   - Check if observations are created

2. **Add Debug Logging**
   - Add console.log statements to adapter script
   - Log when each hook event is received
   - Log when save-hook is called

3. **Check Cursor Logs**
   - Look for Cursor's own hook execution logs
   - Verify Cursor is actually calling the hooks

4. **Verify Hook Event Format**
   - Ensure Cursor is sending the expected JSON format
   - Check if event fields match what adapter expects

---

## 📝 Conclusion

**Claude-mem IS partially working with Cursor hooks:**
- ✅ Session initialization works (`beforeSubmitPrompt`)
- ✅ User prompts are being stored
- ❌ Observations are NOT being stored (file edits, shell commands, MCP tools)

**The issue is likely:**
- Cursor hooks for `afterFileEdit`, `beforeShellExecution`, and `beforeMCPExecution` may not be firing
- OR these hooks only fire during Cursor **agent** sessions, not regular IDE usage
- OR there's a session ID mismatch preventing observations from being saved

**Recommendation:** Test with an actual Cursor agent session to verify if hooks fire during agent execution.
