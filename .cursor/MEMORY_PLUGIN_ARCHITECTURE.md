# Memory Plugin Architecture

**Date**: January 6, 2026  
**Status**: Design Proposal

---

## 🎯 Vision

Create a **unified memory plugin system** that works across all agent types (Cursor, Antigravity, Claude Code, Discord Bot) with a single source of truth.

---

## 📊 Current State Analysis

### How Claude-Mem Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude-Mem Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │   Cursor     │     │ Claude Code  │     │ Antigravity  │ │
│  │   Hooks      │     │   Hooks      │     │   (None)     │ │
│  └──────┬───────┘     └──────┬───────┘     └──────────────┘ │
│         │                    │                               │
│         ▼                    ▼                               │
│  ┌─────────────────────────────────────┐                    │
│  │        Worker Service (37777)        │                    │
│  │  ┌─────────────────────────────┐    │                    │
│  │  │    Queue (pending_messages) │    │                    │
│  │  └──────────────┬──────────────┘    │                    │
│  │                 ▼                   │                    │
│  │  ┌─────────────────────────────┐    │                    │
│  │  │   Claude SDK (LLM Processing)│   │    ← Analyzes      │
│  │  └──────────────┬──────────────┘    │      events        │
│  │                 ▼                   │                    │
│  │  ┌─────────────────────────────┐    │                    │
│  │  │   SQLite (observations)     │    │    ← Structured    │
│  │  └─────────────────────────────┘    │      memories      │
│  └─────────────────────────────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Insight

Claude-mem observations aren't just stored data - they're **LLM-analyzed summaries** with:
- `type`: decision, bugfix, feature, refactor, discovery, change
- `title`, `subtitle`: Human-readable identifiers
- `narrative`: Story of what happened
- `facts`, `concepts`: Extracted knowledge
- `files_read`, `files_modified`: File context

---

## 🏗️ Plugin Architecture Design

### Option A: HTTP-Based Plugin (Recommended)

Create a lightweight client that communicates with the existing claude-mem worker.

```typescript
// plugins/memory/index.ts
export interface MemoryPlugin {
  // Core
  isAvailable(): Promise<boolean>;
  
  // Session Management
  startSession(config: SessionConfig): Promise<SessionHandle>;
  endSession(handle: SessionHandle): Promise<void>;
  
  // Event Capture (raw events → queued for LLM processing)
  capturePrompt(handle: SessionHandle, prompt: string): Promise<void>;
  captureResponse(handle: SessionHandle, response: string): Promise<void>;
  captureToolUse(handle: SessionHandle, tool: ToolEvent): Promise<void>;
  
  // Context Retrieval
  queryContext(query: string, options?: QueryOptions): Promise<Memory[]>;
  injectContext(prompt: string, options?: InjectOptions): Promise<string>;
}

interface SessionConfig {
  contentSessionId: string;
  project: string;
  agentName?: string;
  workspace?: string;
}

interface SessionHandle {
  sessionDbId: number;
  contentSessionId: string;
  memorySessionId?: string;
}

interface ToolEvent {
  name: string;
  input: Record<string, any>;
  output?: Record<string, any>;
}
```

### Architecture with Plugin

```
┌─────────────────────────────────────────────────────────────┐
│                    Plugin-Based Architecture                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Cursor     │  │ Claude Code  │  │    Antigravity   │   │
│  │   (Hooks)    │  │   (Hooks)    │  │  (Plugin-based)  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                   │              │
│         │                 │    ┌──────────────┴────────┐    │
│         │                 │    │  Memory Plugin Client │    │
│         │                 │    │  (TypeScript/Deno)    │    │
│         │                 │    └──────────────┬────────┘    │
│         │                 │                   │              │
│         ▼                 ▼                   ▼              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │            Worker Service (37777)                       ││
│  │                                                         ││
│  │  POST /api/sessions/init    → Create session            ││
│  │  POST /api/sessions/observations → Queue tool event     ││
│  │  POST /sessions/:id/prompt  → Queue user prompt         ││
│  │  POST /api/search           → Query memories            ││
│  │  GET  /api/context/inject   → Get context string        ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Implementation Files

### File Structure

```
plugins/
└── memory/
    ├── index.ts              # Main exports
    ├── client.ts             # HTTP client for claude-mem API
    ├── types.ts              # TypeScript interfaces
    ├── session.ts            # Session management
    └── README.md             # Plugin documentation
```

### Core Client Implementation

```typescript
// plugins/memory/client.ts
export class ClaudeMemClient implements MemoryPlugin {
  private workerUrl: string;
  
  constructor(workerUrl = "http://localhost:37777") {
    this.workerUrl = workerUrl;
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.workerUrl}/health`, {
        signal: AbortSignal.timeout(2000)
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  
  async startSession(config: SessionConfig): Promise<SessionHandle> {
    const res = await fetch(`${this.workerUrl}/api/sessions/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentSessionId: config.contentSessionId,
        project: config.project,
        prompt: `[${config.agentName || 'agent'}] Session started`
      })
    });
    
    if (!res.ok) throw new Error(`Session init failed: ${res.status}`);
    
    const data = await res.json();
    return {
      sessionDbId: data.sessionDbId,
      contentSessionId: config.contentSessionId
    };
  }
  
  async captureToolUse(handle: SessionHandle, tool: ToolEvent): Promise<void> {
    await fetch(`${this.workerUrl}/api/sessions/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentSessionId: handle.contentSessionId,
        tool_name: tool.name,
        tool_input: tool.input,
        tool_response: tool.output || {},
        cwd: process.cwd()
      })
    });
  }
  
  async queryContext(query: string, options?: QueryOptions): Promise<Memory[]> {
    const res = await fetch(`${this.workerUrl}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        limit: options?.limit || 5,
        project: options?.project
      })
    });
    
    if (!res.ok) return [];
    
    const data = await res.json();
    return data.memories || [];
  }
  
  async injectContext(prompt: string, options?: InjectOptions): Promise<string> {
    const memories = await this.queryContext(prompt, options);
    
    if (memories.length === 0) return prompt;
    
    const contextBlock = formatMemories(memories);
    return `${prompt}\n\n${contextBlock}`;
  }
}
```

---

## 🔌 Integration Points

### 1. Antigravity Client Integration

```typescript
// claude/antigravity-client.ts
import { ClaudeMemClient } from "../plugins/memory/client.ts";

const memoryPlugin = new ClaudeMemClient();

export async function sendToAntigravityCLI(
  prompt: string,
  controller: AbortController,
  options: AntigravityOptions = {},
  onChunk?: (text: string) => void
): Promise<AntigravityResponse> {
  
  // Start or get session
  const session = options.memorySession || await memoryPlugin.startSession({
    contentSessionId: `antigravity-${Date.now()}`,
    project: path.basename(options.workspace || process.cwd()),
    agentName: "antigravity"
  });
  
  // Inject context from previous sessions
  const enhancedPrompt = await memoryPlugin.injectContext(prompt, {
    project: session.project,
    limit: 5
  });
  
  // Execute prompt
  const result = await executeGeminiPrompt(enhancedPrompt, ...);
  
  // Capture as observation
  await memoryPlugin.captureToolUse(session, {
    name: "GeminiPrompt",
    input: { prompt },
    output: { response: result.response, model: result.modelUsed }
  });
  
  return result;
}
```

### 2. Agent Framework Integration

```typescript
// agent/index.ts
import { ClaudeMemClient, SessionHandle } from "../plugins/memory/client.ts";

interface AgentSession {
  // ... existing fields
  memoryHandle?: SessionHandle;
}

export async function startAgentSession(
  userId: string,
  agentName: string,
  deps?: AgentHandlerDeps
): Promise<AgentSession> {
  const session = createBaseSession(userId, agentName);
  
  // Initialize memory session
  const memoryClient = new ClaudeMemClient();
  if (await memoryClient.isAvailable()) {
    session.memoryHandle = await memoryClient.startSession({
      contentSessionId: `${agentName}-${session.id}`,
      project: path.basename(deps?.workDir || Deno.cwd()),
      agentName
    });
  }
  
  return session;
}
```

### 3. Discord Bot Integration

```typescript
// discord/commands.ts
// Memory persists across Discord interactions via session IDs
const userMemorySessions = new Map<string, SessionHandle>();

async function handleChatCommand(interaction: Interaction) {
  const userId = interaction.user.id;
  
  // Get or create memory session for this user
  let memoryHandle = userMemorySessions.get(userId);
  if (!memoryHandle) {
    memoryHandle = await memoryPlugin.startSession({
      contentSessionId: `discord-${userId}`,
      project: "discord-bot",
      agentName: "discord"
    });
    userMemorySessions.set(userId, memoryHandle);
  }
  
  // Query relevant context
  const prompt = interaction.options.getString("message");
  const enhancedPrompt = await memoryPlugin.injectContext(prompt);
  
  // ... process with agent
  
  // Capture response
  await memoryPlugin.captureToolUse(memoryHandle, {
    name: "DiscordChat",
    input: { prompt },
    output: { response }
  });
}
```

---

## 🚀 Implementation Priority

### Phase 1: Core Plugin (Day 1-2)
1. Create `plugins/memory/` directory structure
2. Implement `ClaudeMemClient` with HTTP calls
3. Add TypeScript interfaces
4. Basic tests

### Phase 2: Antigravity Integration (Day 2-3)
1. Integrate into `antigravity-client.ts`
2. Add session management
3. Context injection before prompts
4. Observation capture after responses

### Phase 3: Agent Framework (Day 3-4)
1. Add memory handle to `AgentSession`
2. Session lifecycle management
3. Cross-agent context sharing

### Phase 4: Discord Bot (Day 4-5)
1. User-scoped memory sessions
2. Persistent context across conversations
3. Memory management commands (`/memory recall`, `/memory forget`)

---

## 🔧 Configuration

### Environment Variables

```bash
# Optional - defaults to localhost:37777
CLAUDE_MEM_WORKER_URL=http://localhost:37777

# Optional - default project name
CLAUDE_MEM_DEFAULT_PROJECT=claude-code-discord

# Optional - enable/disable memory features
CLAUDE_MEM_ENABLED=true
```

### Settings Integration

```typescript
// data/settings.json
{
  "memory": {
    "enabled": true,
    "workerUrl": "http://localhost:37777",
    "defaultProject": "claude-code-discord",
    "contextLimit": 5,
    "capturePrompts": true,
    "captureResponses": true,
    "captureToolUse": true
  }
}
```

---

## 🔄 Comparison: Cursor Hooks vs Plugin Approach

| Aspect | Cursor Hooks | Plugin Approach |
|--------|-------------|-----------------|
| Integration | External shell hooks | Direct TypeScript import |
| Latency | Higher (spawn process) | Lower (HTTP call) |
| Error Handling | Loose (fire & forget) | Structured (try/catch) |
| Session Control | Implicit (Cursor manages) | Explicit (we manage) |
| Cross-Agent | Limited (Cursor only) | Full (any agent) |
| Configuration | Static (hooks.json) | Dynamic (runtime) |

---

## 📋 API Reference

### Worker Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Check worker availability |
| `/api/sessions/init` | POST | Create/get session |
| `/api/sessions/observations` | POST | Queue observation |
| `/sessions/:id/init` | POST | Initialize with prompt |
| `/api/search` | POST | Search memories |
| `/api/context/inject` | GET | Get formatted context |
| `/api/observations` | GET | List observations |

### Request/Response Examples

```typescript
// POST /api/sessions/init
Request: {
  contentSessionId: "antigravity-1234",
  project: "my-project",
  prompt: "Starting session"
}
Response: {
  sessionDbId: 5,
  promptNumber: 1,
  skipped: false
}

// POST /api/sessions/observations
Request: {
  contentSessionId: "antigravity-1234",
  tool_name: "GeminiPrompt",
  tool_input: { prompt: "What is 2+2?" },
  tool_response: { response: "4" },
  cwd: "/path/to/project"
}
Response: {
  status: "queued"
}

// POST /api/search
Request: {
  query: "authentication implementation",
  limit: 5,
  project: "my-project"
}
Response: {
  memories: [
    {
      id: 1,
      title: "Added JWT auth",
      narrative: "Implemented JWT-based authentication...",
      type: "feature",
      ...
    }
  ]
}
```

---

## ✅ Next Steps

1. **Create the plugin structure** - `plugins/memory/`
2. **Implement ClaudeMemClient** - HTTP-based client
3. **Add to Antigravity client** - First integration point
4. **Test with live worker** - Verify observations flow

---

**Ready to Implement**: Start with creating `plugins/memory/client.ts`
