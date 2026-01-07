# Agent 3: Remote Agent Support

## Mission
Enable agents to run on remote machines (Mac Mini, cloud VMs, other developer machines) and be controlled via Discord.

## Context
- Currently all agents run locally on the bot's host machine
- Competitor (Claude Code by Agents) supports local + remote agent endpoints
- Use cases: GPU-heavy tasks on cloud, browser automation on Mac Mini, distributed workloads
- Remote agents connect via HTTP API and receive tasks from the orchestrator

## Scope
**IN SCOPE:**
- Remote agent protocol/API specification
- Remote agent registration and discovery
- Task dispatch to remote agents
- Output streaming from remote agents
- Health monitoring for remote endpoints

**OUT OF SCOPE:**
- Dashboard UI for remotes (Agent 1 can add later)
- Discord command changes (minimal, just `/agents remote add`)
- New providers (existing providers on remote machines)

## Key Files to Study First
```
agent/provider-interface.ts   # AgentProvider interface (STUDY)
agent/providers/index.ts      # Provider registry
agent/instance-registry.ts    # Running agent instances
agent/orchestrator.ts         # Task execution (runAgentTask)
server/index.ts               # HTTP server (EXTEND)
```

## Architecture Design

### Remote Agent Protocol
```
┌─────────────────┐         ┌─────────────────┐
│   Discord Bot   │         │  Remote Agent   │
│   (Orchestrator)│         │  (Mac Mini/VM)  │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ POST /agent/register      │
         │◄──────────────────────────│
         │                           │
         │ POST /agent/execute       │
         │──────────────────────────►│
         │                           │
         │ SSE: streaming output     │
         │◄──────────────────────────│
         │                           │
         │ GET /agent/health         │
         │──────────────────────────►│
```

### Implementation Plan

### Phase 1: Remote Agent Types
Add to `agent/types.ts`:
```typescript
export interface RemoteAgentEndpoint {
  id: string;
  name: string;
  url: string;           // e.g., "http://mac-mini.local:8081"
  capabilities: string[];
  providers: string[];   // Which providers available on this machine
  status: 'online' | 'offline' | 'unknown';
  lastHealthCheck: Date;
  apiKey?: string;       // Optional auth
}

export interface RemoteExecutionRequest {
  taskId: string;
  prompt: string;
  agentConfig: AgentConfig;
  options: AgentExecutionOptions;
}

export interface RemoteExecutionResponse {
  taskId: string;
  status: 'running' | 'completed' | 'error';
  output?: string;
  error?: string;
}
```

### Phase 2: Remote Agent Registry
Create `agent/remote-registry.ts`:
```typescript
export class RemoteAgentRegistry {
  private endpoints: Map<string, RemoteAgentEndpoint> = new Map();
  
  async register(endpoint: RemoteAgentEndpoint): Promise<void>;
  async unregister(id: string): Promise<void>;
  async healthCheck(id: string): Promise<boolean>;
  async healthCheckAll(): Promise<void>;
  
  getEndpoint(id: string): RemoteAgentEndpoint | undefined;
  getEndpointsByCapability(cap: string): RemoteAgentEndpoint[];
  getEndpointsByProvider(provider: string): RemoteAgentEndpoint[];
}
```

### Phase 3: Remote Provider Adapter
Create `agent/providers/remote-provider.ts`:
```typescript
export class RemoteProvider implements AgentProvider {
  readonly providerId = 'remote';
  readonly providerName = 'Remote Agent';
  readonly providerType = ProviderType.REMOTE;
  
  constructor(private endpoint: RemoteAgentEndpoint) {}
  
  async execute(
    prompt: string,
    options: AgentExecutionOptions,
    onChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<UniversalAgentResponse> {
    // POST to endpoint.url/execute
    // Stream SSE response back
    // Handle errors and timeouts
  }
  
  async isAvailable(): Promise<boolean> {
    // GET endpoint.url/health
  }
}
```

### Phase 4: Remote Agent Daemon Script
Create `scripts/remote-agent-daemon.ts`:
```typescript
// Runs on remote machine, receives and executes tasks
// Usage: deno run --allow-all scripts/remote-agent-daemon.ts --port 8081

Deno.serve({ port }, async (req) => {
  if (req.method === 'POST' && url.pathname === '/execute') {
    const task = await req.json();
    // Execute using local providers (cursor, claude, ollama)
    // Stream output back via SSE
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    return Response.json({ status: 'ok', providers: [...] });
  }
});
```

### Phase 5: Discord Commands
Add to `discord/commands.ts`:
```typescript
// /agents remote add <name> <url>
// /agents remote remove <name>
// /agents remote list
// /agents remote health
```

### Phase 6: Smart Routing
Update orchestrator to prefer remote agents for:
- High-compute tasks (if remote has GPU)
- Specific capabilities (browser automation on Mac)
- Load balancing across available endpoints

## Technical Constraints
- HTTPS recommended for production (self-signed OK for local network)
- API key auth for remote endpoints
- Timeout handling (remote might be slow or unreachable)
- Graceful degradation (fall back to local if remote unavailable)

## Success Criteria
- [ ] Remote daemon starts: `deno run scripts/remote-agent-daemon.ts --port 8081`
- [ ] Bot can register remote: `/agents remote add mac-mini http://192.168.1.50:8081`
- [ ] Tasks execute on remote and stream back to Discord
- [ ] Health checks run periodically
- [ ] Fallback to local if remote is offline
- [ ] `/agents remote list` shows all registered endpoints with status

## Security Considerations
- API keys stored in `data/settings.json` (not committed)
- Optional: IP allowlist for remote connections
- Optional: mTLS for production deployments
- Rate limiting on remote daemon

## Example Workflow
```bash
# On Mac Mini (remote machine)
cd ~/repos/claude-code-discord
deno run --allow-all scripts/remote-agent-daemon.ts \
  --port 8081 \
  --api-key "secret-key-123" \
  --providers cursor,ollama

# On Discord (main bot)
/agents remote add name:mac-mini url:http://mac-mini.local:8081 key:secret-key-123

# User request (routed to remote)
@coder run browser tests on Mac
# Bot routes to mac-mini endpoint (has browser capability)
```
