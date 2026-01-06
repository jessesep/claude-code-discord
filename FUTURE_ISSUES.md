
# Future Implementation & Testing Issues

The following issues have been identified for future development to enhance the stability, capability, and testability of the Antigravity/Cursor agent system.

## 1. Implement "Mock Mode" for CI/Dev Testing
**Priority**: High
**Description**: Currently, the system requires real `gcloud` authentication or API keys for all Antigravity operations. This makes automated testing (CI) and offline development difficult.
**Task**:
- Modify `antigravity-client.ts` to accept a `mock: true` option.
- When enabled, return simulated streaming responses (as previously implemented but removed).
- Add a `--mock` flag to the Swarm Orchestrator.

## 2. Advanced Swarm: Feedback Loops (Auto-Repair)
**Priority**: Medium
**Description**: The current Swarm (Architect -> Coder) is linear. If the Coder produces buggy code, the process ends.
**Task**:
- Implement a "Reviewer" or "Tester" step in `swarm/orc.ts`.
- If the Reviewer finds issues, feed the output *back* to the Coder with a "Fix this" prompt.
- Allow `max_iterations` to prevent infinite loops.

## 3. Discord Swarm Command
**Priority**: Medium
**Description**: The Swarm Orchestrator is currently CLI-only. Users inside Discord cannot trigger multi-agent workflows.
**Task**:
- Create a new Discord slash command `/swarm prompt:"..."`.
- Map this command to the `runAgentTask` logic.
- Stream the swarm's progress (Plan -> Code -> Result) into a Discord thread or embed.

## 4. Token Caching & Performance
**Priority**: Low (Optimization)
**Description**: `antigravity-client.ts` spawns a `gcloud auth print-access-token` process for *every* request. This adds latency (~500ms-1s).
**Task**:
- Implement simple in-memory caching for the OAuth token.
- Reuse token until it expires (usually 1 hour).
- Only call `gcloud` when token is missing or expired.

## 5. Architectural Decoupling
**Priority**: Low (Refactor)
**Description**: `agent/index.ts` couples core LLM logic with `discord.js` types (`AgentDeps`).
**Task**:
- Extract `CoreAgentService` that knows nothing about Discord.
- Keep `DiscordAgentService` as a wrapper that handles Embeds/Messages.
- This will make the CLI and Swarm implementations much cleaner and lighter.
