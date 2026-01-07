# Parallel Agent Work Assignments

## Overview
Four independent work streams to improve one-agent-discord based on competitive research.

## Agents

| Agent | Focus | File | Key Deliverable |
|-------|-------|------|-----------------|
| **Agent 1** | Web Dashboard | `AGENT-1-DASHBOARD.md` | React dashboard at `/dashboard` |
| **Agent 2** | Direct Mentions | `AGENT-2-DIRECT-MENTIONS.md` | `@agent-name` syntax parsing |
| **Agent 3** | Remote Agents | `AGENT-3-REMOTE-AGENTS.md` | Remote agent protocol + daemon |
| **Agent 4** | Slack Integration | `AGENT-4-SLACK-INTEGRATION.md` | Slack Bolt app alongside Discord |

## Dependency Graph
```
                    ┌─────────────────┐
                    │   Agent 1       │
                    │   Dashboard     │
                    └────────┬────────┘
                             │ (can display remote status later)
                             ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Agent 2       │    │   Agent 3       │    │   Agent 4       │
│ Direct Mentions │    │ Remote Agents   │    │ Slack           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                             │
         └──────────── (Agent 4 can reuse ────────────┘
                        mention parsing)
```

## Parallel Execution Rules

1. **No shared file edits** - Each agent owns specific directories
2. **Core files read-only** - `agent/index.ts`, `agent/types.ts` can be read but not modified simultaneously
3. **Additive changes** - Add new files rather than modifying existing where possible
4. **Interface contracts** - If adding exports, document them for other agents

## File Ownership

| Directory/File | Owner | Others |
|----------------|-------|--------|
| `dashboard/` | Agent 1 | — |
| `discord/mention-parser.ts` | Agent 2 | Agent 4 can import |
| `agent/remote-*.ts` | Agent 3 | — |
| `scripts/remote-agent-daemon.ts` | Agent 3 | — |
| `slack/` | Agent 4 | — |
| `discord/message-handler.ts` | Agent 2 | Agent 4 reference only |
| `server/index.ts` | Agent 1 | Agent 3 can add routes |

## How to Start Each Agent

### Agent 1 (Dashboard)
```bash
cd /Users/jessesep/repos/claude-code-discord
# Read the handover
cat agent/handovers/AGENT-1-DASHBOARD.md

# Start working
# Focus: dashboard/, server/index.ts
```

### Agent 2 (Direct Mentions)
```bash
cd /Users/jessesep/repos/claude-code-discord
cat agent/handovers/AGENT-2-DIRECT-MENTIONS.md

# Focus: discord/mention-parser.ts (new), discord/message-handler.ts
```

### Agent 3 (Remote Agents)
```bash
cd /Users/jessesep/repos/claude-code-discord
cat agent/handovers/AGENT-3-REMOTE-AGENTS.md

# Focus: agent/remote-*.ts (new), scripts/remote-agent-daemon.ts (new)
```

### Agent 4 (Slack)
```bash
cd /Users/jessesep/repos/claude-code-discord
cat agent/handovers/AGENT-4-SLACK-INTEGRATION.md

# Focus: slack/ (new directory)
```

## Sync Points

After each agent completes Phase 1:
- Agent 1: API endpoints working → Agent 3 can add remote endpoints
- Agent 2: Mention parser done → Agent 4 imports for Slack mentions
- Agent 3: Remote registry done → Agent 1 can add dashboard UI
- Agent 4: Bolt app running → All agents unified under same core

## Success Metrics

All agents complete when:
- [ ] Dashboard shows agent grid and active sessions
- [ ] `@coder fix bug` works in Discord
- [ ] Remote daemon accepts tasks from orchestrator
- [ ] `/agent chat` works in Slack

## Notes

- Each handover has full context; agents don't need to read others
- If blocked on a shared file, create a new file and integrate later
- Communicate interface changes via code comments or handover updates
