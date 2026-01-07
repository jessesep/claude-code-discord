# Instance Lock Implementation Handoff

## Summary

Added a mechanism to prevent duplicate bot instances from running simultaneously, which was causing duplicate Discord responses and OSC feedback loops.

## Problem

When multiple instances of `index.ts` were running (e.g., from leftover processes or accidental restarts), both instances would:
- Respond to the same Discord messages
- Send duplicate OSC feedback
- Create resource conflicts on ports/sockets

## Solution

### 1. Instance Lock Utility (`util/instance-lock.ts`)

New utility that manages a PID file (`.bot.pid`) to track the running instance:

```typescript
// Check if another instance is running
await isInstanceRunning(): Promise<boolean>

// Acquire lock (returns false if another instance exists)
await acquireInstanceLock(): Promise<boolean>

// Release the lock
await releaseInstanceLock(): Promise<void>

// Force kill existing instance and acquire lock
await forceAcquireLock(): Promise<void>
```

### 2. Main Bot Integration (`index.ts`)

On startup, the bot now:
1. Calls `forceAcquireLock()` to kill any existing instance
2. Registers cleanup handler to release lock on exit

```typescript
if (import.meta.main) {
  // Acquire instance lock to prevent duplicate bot instances
  await forceAcquireLock();
  
  // Register cleanup on exit
  globalThis.addEventListener('unload', () => {
    releaseInstanceLock();
  });
  // ... rest of startup
}
```

### 3. Restart Scripts

Updated `restart-bot.sh` and `reboot.sh`:
- Already had `pkill -f "deno.*index.ts"` to kill existing instances
- Added `--unstable-net` flag for OSC UDP support

## Files Changed

| File | Change |
|------|--------|
| `util/instance-lock.ts` | **NEW** - Instance lock mechanism |
| `index.ts` | Added lock acquisition on startup |
| `restart-bot.sh` | Added `--unstable-net` flag |
| `reboot.sh` | Added `--unstable-net` flag |
| `.gitignore` | Added `.bot.pid` |

## Handler Architecture (No Changes)

The message handlers remain properly isolated:
- `discord/message-handler.ts` → Handles @mentions and active sessions
- `discord/bot.ts` → Handles slash command interactions
- `index.ts` OSC handler → Only responds to `!osc` prefixed messages

## Testing

To verify the fix works:
1. Start the bot normally
2. Try to start another instance - it should kill the first one automatically
3. Check that only one Discord response appears per message

## Related

- OSC Bridge implementation (`osc/index.ts`)
- OSC Discord channels (`osc/osc-discord-channel.ts`)
- Previous handoff: `OSC_HANDOFF.md`
