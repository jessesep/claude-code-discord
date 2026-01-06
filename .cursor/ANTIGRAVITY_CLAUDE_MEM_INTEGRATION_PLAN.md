# Antigravity + Claude-Mem Integration Plan

**Date**: January 6, 2026  
**Status**: Planning Complete  
**Priority**: High

---

## 🎯 Objective

Integrate `claude-mem` persistent memory capabilities directly into the Antigravity (Gemini) agent client, enabling:
1. **Context Injection** - Retrieve relevant memories before sending prompts
2. **Observation Capture** - Save prompt/response pairs and tool usage
3. **Session Tracking** - Maintain session continuity across interactions
4. **Cross-Agent Memory** - Share context between Claude Code, Cursor, and Antigravity agents

---

## 📊 Current State Analysis

### What Claude-Mem Provides (Already Running)
```
✅ Worker service on port 37777
✅ SQLite database at ~/.claude-mem/claude-mem.db
✅ REST API endpoints:
   - GET  /health
   - GET  /api/observations?limit=N
   - GET  /api/sessions?limit=N
   - POST /api/search
   - GET  /api/context/inject
   - POST /api/observations (save)
   - POST /api/sessions (create)
```

### Existing Integration Points
```
✅ util/claude-mem-context.ts - Context query/injection utilities
✅ agent/index.ts - Already calls injectClaudeMemContext() for agents
✅ claude/antigravity-client.ts - Antigravity SDK implementation
```

### Missing Pieces for Antigravity
```
❌ Observation saving after prompts/responses
❌ Session lifecycle management (start/end)
❌ Tool usage tracking (file edits, shell commands)
❌ Session summary generation
❌ Agent-specific tagging for memory filtering
```

---

## 🏗️ Implementation Plan

### Phase 1: Core Memory Service Integration
**Files to Create/Modify**: `util/claude-mem-service.ts`

Create a unified service layer for all claude-mem operations:

```typescript
// util/claude-mem-service.ts
export interface ClaudeMemService {
  // Session Management
  startSession(workspace: string, agentName: string): Promise<string>;
  endSession(sessionId: string, summary?: string): Promise<void>;
  
  // Observations
  saveObservation(data: ObservationData): Promise<void>;
  savePromptResponse(sessionId: string, prompt: string, response: string): Promise<void>;
  saveToolUsage(sessionId: string, tool: string, input: any, output: any): Promise<void>;
  
  // Context
  queryContext(query: string, workspace?: string, agentName?: string): Promise<Memory[]>;
  injectContext(prompt: string, workspace: string, agentName?: string): Promise<string>;
  
  // Health
  isAvailable(): Promise<boolean>;
}
```

#### Tasks:
1. [ ] Create `util/claude-mem-service.ts` with full service implementation
2. [ ] Add TypeScript interfaces for all API payloads
3. [ ] Implement retry logic and graceful fallbacks
4. [ ] Add configurable worker URL via `CLAUDE_MEM_WORKER_URL` env var

---

### Phase 2: Antigravity Client Integration
**Files to Modify**: `claude/antigravity-client.ts`

Enhance the client to capture observations:

```typescript
// Before: Simple prompt → response
const result = await model.generateContent(prompt);

// After: Capture as observation
const result = await model.generateContent(prompt);
await claudeMemService.savePromptResponse(sessionId, prompt, result.response.text());
```

#### Tasks:
1. [ ] Import claude-mem service in `antigravity-client.ts`
2. [ ] Add optional `sessionId` to `AntigravityOptions`
3. [ ] Auto-generate session ID if not provided
4. [ ] Save prompt/response observation after each call
5. [ ] Add `agentName` option for memory tagging

---

### Phase 3: Agent Framework Integration
**Files to Modify**: `agent/index.ts`, `agent/manager.ts`

Integrate session lifecycle into agent operations:

#### Agent Session Enhancement
```typescript
// Start agent session → Also start claude-mem session
export async function startAgentSession(...) {
  const agentSession = await createAgentSession(...);
  const memSessionId = await claudeMemService.startSession(workspace, agentName);
  agentSession.memorySessionId = memSessionId;
  return agentSession;
}

// End agent session → Generate summary
export async function endAgentSession(session: AgentSession) {
  await claudeMemService.endSession(session.memorySessionId, generateSummary(session));
}
```

#### Tasks:
1. [ ] Add `memorySessionId` to `AgentSession` interface
2. [ ] Call `startSession` when agent starts
3. [ ] Call `endSession` when agent stops
4. [ ] Pass session ID through all agent calls
5. [ ] Capture subagent task results as observations

---

### Phase 4: Tool Usage Tracking
**Files to Modify**: Multiple handlers

Track tool usage similar to Cursor hooks:

| Tool Type | Where to Capture | Observation Type |
|-----------|-----------------|------------------|
| File Edits | Shell handler | `file_edit` |
| Shell Commands | Shell handler | `shell_command` |
| Git Operations | Git handler | `git_operation` |
| Subagent Spawn | Manager | `subagent_spawn` |

#### Tasks:
1. [ ] Add hook points in `shell/handler.ts`
2. [ ] Add hook points in `git/handler.ts`
3. [ ] Track subagent spawning in `agent/manager.ts`
4. [ ] Create observation type enum

---

### Phase 5: Provider Interface Update
**Files to Modify**: `agent/providers/antigravity-provider.ts`, `agent/provider-interface.ts`

Add memory support to the universal provider interface:

```typescript
// provider-interface.ts
export interface AgentExecutionOptions {
  // ... existing options
  memorySessionId?: string;
  agentName?: string;
  saveObservations?: boolean;
}

// antigravity-provider.ts
async execute(prompt, options) {
  // Inject context first
  const enhancedPrompt = await injectContext(prompt, options);
  
  // Execute
  const result = await sendToAntigravityCLI(enhancedPrompt, ...);
  
  // Save observation
  if (options.saveObservations) {
    await saveObservation(options.memorySessionId, prompt, result);
  }
  
  return result;
}
```

#### Tasks:
1. [ ] Extend `AgentExecutionOptions` interface
2. [ ] Implement context injection in `AntigravityProvider.execute()`
3. [ ] Implement observation saving
4. [ ] Add memory status to `getStatus()`

---

## 📁 Files to Create

| File | Purpose |
|------|---------|
| `util/claude-mem-service.ts` | Unified claude-mem API client |
| `util/claude-mem-types.ts` | TypeScript interfaces for claude-mem |
| `.cursor/test-claude-mem-integration.ts` | Integration tests |

---

## 📁 Files to Modify

| File | Changes |
|------|---------|
| `util/claude-mem-context.ts` | Refactor to use new service |
| `claude/antigravity-client.ts` | Add observation capture |
| `agent/index.ts` | Session lifecycle, observation hooks |
| `agent/manager.ts` | Subagent observation tracking |
| `agent/provider-interface.ts` | Add memory options |
| `agent/providers/antigravity-provider.ts` | Implement memory features |
| `shell/handler.ts` | Shell command observation hooks |
| `git/handler.ts` | Git operation observation hooks |

---

## 🔧 API Endpoints to Use

Based on the worker service (port 37777):

```typescript
// Start Session
POST /api/sessions
Body: { workspace: string, agent: string, metadata?: object }

// Save Observation
POST /api/observations
Body: { 
  session_id: string,
  type: 'prompt' | 'response' | 'tool_use' | 'file_edit' | 'shell',
  content: string,
  metadata?: object
}

// Query Context
POST /api/search
Body: { query: string, limit?: number, workspace?: string, tags?: string[] }

// Get Context for Injection
GET /api/context/inject?projects=PROJECT&limit=5

// End Session
PUT /api/sessions/:id
Body: { status: 'completed', summary?: string }
```

---

## 🧪 Testing Strategy

### Unit Tests
1. [ ] Mock claude-mem API responses
2. [ ] Test graceful fallback when worker unavailable
3. [ ] Test observation formatting
4. [ ] Test session lifecycle

### Integration Tests
1. [ ] Test actual API calls to running worker
2. [ ] Verify observations appear in database
3. [ ] Test context injection from saved memories
4. [ ] Test cross-agent memory sharing

### Manual Tests
```bash
# 1. Start worker (already running)
curl http://localhost:37777/health

# 2. Run Antigravity agent
/agent action:start agent_name:ag-coder

# 3. Send message (should capture observation)
/chat message:"Hello, test memory"

# 4. Verify observation saved
curl 'http://localhost:37777/api/observations?limit=5'

# 5. Open memory viewer
open http://localhost:37777
```

---

## 🚀 Implementation Priority

### MVP (Week 1)
1. Create `util/claude-mem-service.ts`
2. Add context injection to Antigravity provider
3. Add prompt/response observation capture
4. Basic session tracking

### Enhanced (Week 2)
1. Tool usage tracking (shell, git)
2. Subagent observation capture
3. Session summaries

### Advanced (Week 3)
1. Cross-agent context sharing
2. Memory relevance tuning
3. Dashboard enhancements

---

## 🔄 Migration Path

Since `util/claude-mem-context.ts` already exists, we'll:

1. **Keep existing API** - `injectClaudeMemContext()` continues to work
2. **Add new service layer** - Wraps existing + adds observation capture
3. **Gradual adoption** - Enable per-agent via options
4. **No breaking changes** - Memory features are opt-in

---

## 📋 Checklist Summary

### Phase 1: Core Service [ ]
- [ ] Create `util/claude-mem-service.ts`
- [ ] Create `util/claude-mem-types.ts`
- [ ] Implement all API methods
- [ ] Add tests

### Phase 2: Antigravity Client [ ]
- [ ] Import service in `antigravity-client.ts`
- [ ] Add session ID option
- [ ] Capture observations
- [ ] Test with real prompts

### Phase 3: Agent Framework [ ]
- [ ] Update session interface
- [ ] Start memory session with agent
- [ ] End session with summary
- [ ] Pass session through calls

### Phase 4: Tool Tracking [ ]
- [ ] Hook shell handler
- [ ] Hook git handler
- [ ] Track subagent spawns

### Phase 5: Provider Interface [ ]
- [ ] Extend options interface
- [ ] Implement in AntigravityProvider
- [ ] Update other providers (optional)

---

## 🔗 Related Resources

- Existing: `util/claude-mem-context.ts`
- Handoff: `.cursor/CLAUDE_MEM_HOOKS_HANDOFF.md`
- Worker API: `http://localhost:37777`
- Plugin Docs: `https://docs.claude-mem.ai`
- Architecture: `ARCHITECTURE.md`

---

**Ready to Implement**: Start with Phase 1 by creating `util/claude-mem-service.ts`
