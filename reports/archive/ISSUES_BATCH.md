# GitHub Issues Batch

## 1. Fix Cursor Hook Process Spawning

**Priority:** Critical
**Description:** Refactor `~/.cursor/hooks/claude-mem-cursor-adapter.js` to implement a singleton pattern for the worker process using a PID file.
**Acceptance Criteria:**

- Only one worker process runs at a time.
- Use a dedicated health check to verify worker status.

## 2. Implement Dynamic Agent Management via MCP

**Priority:** High
**Description:** Configure the Discord bot to use the newly created `util/mcp-server.ts`.
**Acceptance Criteria:**

- The Manager agent uses `spawn_bot` to delegate tasks.
- `list_active_bots` correctly reports running tasks.

## 3. Comprehensive Security Regression Test

**Priority:** High
**Description:** Create a test suite to verify prompt injection mitigation and token rotation.
**Acceptance Criteria:**

- Test cases for various injection patterns pass.
- Log verify that tokens are cached and rotated after expiry.

## 4. Update Hook Versioning & Monitoring

**Priority:** Medium
**Description:** Add health check endpoints and a heartbeat mechanism for Cursor hooks.
**Acceptance Criteria:**

- Heartbeat detected in logs.
- Health check returns status for all registered hooks.
