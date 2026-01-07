# Deep Research Report: Claude Code Discord Bot

**Date:** 2026-01-07
**Researcher:** AI Assistant
**Scope:** Full codebase audit, architectural review, and feature gap analysis.

## 1. Executive Summary

The Claude Code Discord bot is a powerful, modular system that bridges Discord with various AI agents and CLI tools (Cursor, Claude CLI, Gemini). While the architecture is solid (Manager-Subagent pattern), the codebase has grown rapidly, leading to significant clutter in the root directory, several monolithic files, and some fragile implementations.

## 2. Codebase Cleanups (High Priority)

### 2.1 Root Directory Clutter
The root directory is currently polluted with:
- **Test files:** `agent5-test-*`, `test-*`.
- **Logs:** `bot.log`, `bot_demo.log`, etc.
- **Audit Reports:** `ANTIGRAVITY_AUTH_AUDIT.md`, `AUDIT_SUMMARY.md`, etc.
- **One-off Scripts:** `celebrate-push.ts`, `milestone-patch.ts`, etc.

**Proposed Solution:**
- Move all tests to a `/tests/` or `/scratch/` directory.
- Move all logs to a `/logs/` directory.
- Move all audit reports and summaries to a `/reports/` directory.
- Move all utility scripts to the `/scripts/` directory.

### 2.2 Monolithic Files
- `agent/index.ts` (>2900 lines)
- `discord/bot.ts` (>2100 lines)

**Proposed Solution:**
- **Refactor `agent/index.ts`**: Split into `session-manager.ts`, `agent-registry.ts`, `orchestrator.ts`, and separate command handler files.
- **Refactor `discord/bot.ts`**: Extract interaction handlers (buttons, select menus) and repository creation logic into separate modules in `/discord/handlers/`.

### 2.3 Hardcoded Model & Provider Logic
The logic for mapping providers to models and vice versa is scattered and hardcoded in `discord/bot.ts` and `agent/index.ts`.

**Proposed Solution:**
- Create a unified `ProviderRegistry` and `ModelRegistry` that can be configured via JSON or discovered dynamically.

## 3. Bug Fixes & Improvements (Medium Priority)

### 3.1 Fragile SSE Parsing
In `claude/antigravity-client.ts`, the SSE parsing for Gemini is simplified and might fail on non-standard chunks.

**Proposed Solution:**
- Implement a more robust SSE parser that handles multi-line data and different Gemini API response formats properly.

### 3.2 Missing Log Buffer
`server/index.ts` contains a TODO for a real log buffer. Currently, logs are hardcoded for the dashboard.

**Proposed Solution:**
- Implement a `LogManager` that captures `console.log/error` and stores them in a circular buffer in memory, exposed via the `/api/logs` endpoint.

### 3.3 Error Handling & Type Safety
- Excessive use of `any` across the codebase.
- Many `try...catch` blocks only log to console and don't provide user feedback.

**Proposed Solution:**
- Perform a pass to add proper types to interaction contexts and agent configs.
- Implement a global `ErrorHandler` utility that can report errors back to Discord with appropriate detail levels.

## 4. Feature Wishes (Future Enhancements)

### 4.1 WebSocket Log Streaming
Instead of polling `/api/logs`, the dashboard should use WebSockets to stream logs in real-time.

### 4.2 Dynamic Agent Discovery
Instead of hardcoding agents in `PREDEFINED_AGENTS`, agents should be discoverable from a directory (e.g., `agents/*.agent.json` or `.ts`).

### 4.3 Integrated Health Checks
Add a `/health` command that checks the status of all providers (Ollama, Gemini, Claude CLI, Cursor) and reports which ones are currently functional.

### 4.4 Multi-Project Dashboard
Enhance the dashboard to show status across all active repositories and branches the bot is managing.

## 5. Implementation Roadmap

1.  **Phase 1: Organization** - Clean up root directory and move files to appropriate subfolders.
2.  **Phase 2: Refactoring** - Split monolithic files and improve type safety.
3.  **Phase 3: Robustness** - Fix SSE parsing and implement the Log Manager.
4.  **Phase 4: Features** - Implement WebSocket streaming and dynamic agent discovery.
