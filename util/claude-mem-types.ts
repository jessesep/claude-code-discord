/**
 * Claude-Mem Types
 * 
 * Shared interfaces for the claude-mem service and context utilities.
 */

export interface ClaudeMemMemory {
  id: string;
  summary: string;
  content: string;
  timestamp: string;
  tags?: string[];
  relevance?: number;
  metadata?: Record<string, any>;
}

export interface ClaudeMemSearchResult {
  memories: ClaudeMemMemory[];
  query: string;
  total: number;
}

export interface ClaudeMemSession {
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

export interface ClaudeMemService {
  // Session Management
  startSession(workspace: string, agentName: string, metadata?: Record<string, any>): Promise<string>;
  endSession(sessionId: string, summary?: string): Promise<void>;
  
  // Observations
  saveObservation(data: ObservationData): Promise<void>;
  savePromptResponse(sessionId: string, prompt: string, response: string): Promise<void>;
  saveToolUsage(sessionId: string, tool: string, input: any, output: any): Promise<void>;
  
  // Context
  queryContext(query: string, workspace?: string, agentName?: string, limit?: number): Promise<ClaudeMemMemory[]>;
  injectContext(prompt: string, workspace: string, agentName?: string): Promise<string>;
  
  // Health
  isAvailable(): Promise<boolean>;
}
