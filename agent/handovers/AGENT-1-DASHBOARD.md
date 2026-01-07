# Agent 1: Web Dashboard Implementation

## Mission
Build a real-time web dashboard for monitoring and controlling agents from the browser.

## Context
- Competitors (Claude Control, Claude Code by Agents) have polished dashboards
- We have a scaffolded `dashboard/` directory with React components
- The backend already exposes agent state through `agent/index.ts` and `agent/session-manager.ts`

## Scope
**IN SCOPE:**
- React dashboard at `dashboard/`
- Real-time agent status display
- Session history viewer
- Provider status/health checks
- Cost tracking display (if data available)

**OUT OF SCOPE:**
- Slack integration (Agent 4)
- New Discord commands (other agents)
- Provider changes (other agents)

## Key Files to Study First
```
dashboard/
├── App.tsx              # Main app shell (study this)
├── components/          # Existing UI components
├── services/api.ts      # API client (study this)
├── types.ts             # Type definitions
└── index.tsx            # Entry point

server/index.ts          # Backend API (extend this)
agent/session-manager.ts # Session state source
agent/types.ts           # AgentSession, AgentConfig types
```

## Implementation Plan

### Phase 1: API Endpoints (server/index.ts)
Add REST endpoints for dashboard data:
```typescript
// GET /api/agents - List all predefined agents
// GET /api/sessions - List active sessions
// GET /api/sessions/:id - Get session details
// GET /api/providers/status - Provider health checks
// GET /api/stats - Aggregate stats (total sessions, costs, etc.)
```

### Phase 2: Real-time Updates
- Use WebSocket or Server-Sent Events for live session updates
- Stream agent output to dashboard in real-time
- Show "typing" indicators when agents are processing

### Phase 3: Dashboard UI Components
Build these views:
1. **Agent Grid** - Cards showing each predefined agent with status
2. **Active Sessions** - Table of running sessions with progress
3. **Session Detail** - Full conversation history, cost breakdown
4. **Provider Health** - Status of each configured provider

### Phase 4: Styling
- Use the existing component patterns in `dashboard/components/`
- Dark theme preferred (matches Discord aesthetic)
- Responsive for mobile (check agent status on phone)

## Technical Constraints
- Deno backend (use `Deno.serve` or existing server setup)
- React 18+ for frontend
- No new major dependencies without justification
- Must work with `deno run --allow-all index.ts`

## Success Criteria
- [ ] Dashboard loads at `http://localhost:3000/dashboard`
- [ ] Shows all predefined agents from `PREDEFINED_AGENTS`
- [ ] Displays active sessions in real-time
- [ ] Updates automatically when sessions start/end
- [ ] Shows provider availability status

## Commands to Run
```bash
# Start the main bot (includes server)
deno run --allow-all index.ts

# Run dashboard dev server (if separate)
cd dashboard && npm run dev
```

## Notes
- Check `dashboard/constants.ts` for existing config
- The `agent/instance-registry.ts` tracks running agent instances
- Session data is in-memory; consider if persistence is needed later
