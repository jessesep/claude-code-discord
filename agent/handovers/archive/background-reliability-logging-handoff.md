# Handoff: Background Reliability & Extensive Logging Overhaul

## Status Summary
The bot is currently **running in the background** (PID 5501). Critical bugs preventing startup and command execution have been resolved. Extensive logging has been added to every major interaction point to make future troubleshooting transparent.

## What Was Attempted & Fixed

1.  **Startup Fixes**: 
    - Resolved a duplicate declaration of `createDiscordBot` in `index.ts`.
    - Fixed "Unknown command /run" by re-mapping handlers for `run`, `kill`, `sync`, and `run-adv` in the main `index.ts` routing table.
2.  **Model Compatibility**: 
    - Updated predefined agents in `agent/index.ts` to use `sonnet-4.5` instead of `claude-sonnet-4`, matching the models actually available in the environment.
3.  **Background Management**:
    - Created `reboot.sh`: A robust script that kills stale processes (including port 8000) and starts the bot in the background using `nohup`.
    - Created `start.sh`: A simple background starter with a "duplicate process" safety check.
4.  **Extensive Logging (The "Truth" System)**:
    - Added `[InteractionCommand]`, `[InteractionButton]`, and `[InteractionSelect]` logs in `discord/bot.ts`.
    - Added `[AgentChat]` tracing in `agent/index.ts` to track provider selection (Claude vs Cursor vs Gemini), streaming progress, and fallback triggers.
    - Every major transition (STARTED -> EXECUTING -> COMPLETED) is now logged with timestamps.

## Current Known State
- **Process**: Running via `deno run --allow-all index.ts`.
- **Logs**: Captured in `bot.log`.
- **Fallbacks**: The system correctly detects Claude CLI quota limits and attempts to fall back to **Cursor Agent** (`cursor agent --model sonnet-4.5`) and then **Antigravity (Gemini)**.

## Key Files & Context
- **`index.ts`**: Main router. Fixed missing handler mappings here.
- **`agent/index.ts`**: Agent logic and fallback system. Added massive logging here.
- **`discord/bot.ts`**: Gateway event handling. Added interaction logging here.
- **`reboot.sh`**: The recommended way to restart the system.

## Instructions for Next Agent
1.  **Monitor the "Truth"**: If the user reports a failure, immediately run `tail -f bot.log`. The new logs will tell you exactly which provider failed and why (e.g., "Cursor CLI exited with code 1").
2.  **Quota Watch**: The primary Claude CLI is frequently out of extra usage. The fallback to Cursor is the primary reliable path right now.
3.  **Model Verification**: If Cursor fails, check if the model name `sonnet-4.5` is still valid for the CLI by checking the error output in `bot.log`.
4.  **Verification Command**: To check if the bot is actually alive and reachable, use `ps aux | grep "deno.*index.ts"`.
