/**
 * Agent-Mem Types
 * 
 * Shared interfaces for the agent-mem service and context utilities.
 * Provider-agnostic memory architecture for any AI agent.
 */

export interface AgentMemMemory {
  id: string;
  summary: string;
  content: string;
  timestamp: string;
  tags?: string[];
  relevance?: number;
  metadata?: Record<string, any>;
}

export interface AgentMemSearchResult {
  memories: AgentMemMemory[];
  query: string;
  total: number;
}

export interface AgentMemSession {
  id: string;
  workspace: string;
  agent: string;
  status: 'active' | 'completed' | 'error';
  startTime: string;
  endTime?: string;
  summary?: string;
  metadata?: Record<string, any>;
}

export interface ObservationData {
  session_id: string;
  type: 'prompt' | 'response' | 'tool_use' | 'file_edit' | 'shell' | 'git' | 'subagent_spawn';
  content: string;
  metadata?: Record<string, any>;
}

export interface AgentMemService {
  // Session Management
  startSession(workspace: string, agentName: string, metadata?: Record<string, any>): Promise<string>;
  endSession(sessionId: string, summary?: string): Promise<void>;
  
  // Observations
  saveObservation(data: ObservationData): Promise<void>;
  savePromptResponse(sessionId: string, prompt: string, response: string): Promise<void>;
  saveToolUsage(sessionId: string, tool: string, input: any, output: any): Promise<void>;
  
  // Context
  queryContext(query: string, workspace?: string, agentName?: string, limit?: number): Promise<AgentMemMemory[]>;
  injectContext(prompt: string, workspace: string, agentName?: string): Promise<string>;
  
  // Health
  isAvailable(): Promise<boolean>;
}

// Backward-compatible aliases (deprecated)
/** @deprecated Use AgentMemMemory instead */
export type ClaudeMemMemory = AgentMemMemory;
/** @deprecated Use AgentMemSearchResult instead */
export type ClaudeMemSearchResult = AgentMemSearchResult;
/** @deprecated Use AgentMemSession instead */
export type ClaudeMemSession = AgentMemSession;
/** @deprecated Use AgentMemService instead */
export type ClaudeMemService = AgentMemService;
