import { agentMemService } from "./agent-mem-service.ts";
import { AgentMemMemory } from "./agent-mem-types.ts";

export { type AgentMemMemory };

// Backward-compatible alias (deprecated)
/** @deprecated Use AgentMemMemory instead */
export type { AgentMemMemory as ClaudeMemMemory };

/**
 * Query agent-mem for relevant memories
 * 
 * @param query - Search query
 * @param workspace - Workspace path (optional)
 * @param agentName - Agent name (optional, for filtering)
 * @param limit - Maximum number of memories to return
 * @returns Array of relevant memories
 */
export async function queryAgentMemContext(
  query: string,
  workspace?: string,
  agentName?: string,
  limit: number = 5
): Promise<AgentMemMemory[]> {
  return await agentMemService.queryContext(query, workspace, agentName, limit);
}

/**
 * Format memories as context string for injection into prompts
 * 
 * @param memories - Array of memories from agent-mem
 * @returns Formatted context string
 */
export function formatMemoryContext(memories: AgentMemMemory[]): string {
  if (memories.length === 0) {
    return "";
  }
  
  const contextLines = [
    "\n=== Relevant Context from Previous Sessions ===",
    ...memories.map((mem, idx) => {
      const date = new Date(mem.timestamp).toLocaleDateString();
      return `\n[${idx + 1}] ${mem.summary} (${date})`;
    }),
    "==========================================\n"
  ];
  
  return contextLines.join("\n");
}

/**
 * Inject agent-mem context into an agent prompt
 * 
 * @param prompt - Original prompt
 * @param workspace - Workspace path
 * @param agentName - Agent name
 * @param query - Optional search query (defaults to prompt)
 * @returns Enhanced prompt with context
 */
export async function injectAgentMemContext(
  prompt: string,
  workspace: string,
  agentName?: string,
  query?: string
): Promise<string> {
  const searchQuery = query || prompt;
  return await agentMemService.injectContext(searchQuery, workspace, agentName);
}

/**
 * Check if agent-mem worker is running
 * 
 * @returns true if worker is available
 */
export async function isAgentMemAvailable(): Promise<boolean> {
  return await agentMemService.isAvailable();
}

// Backward-compatible aliases (deprecated)
/** @deprecated Use queryAgentMemContext instead */
export const queryClaudeMemContext = queryAgentMemContext;
/** @deprecated Use injectAgentMemContext instead */
export const injectClaudeMemContext = injectAgentMemContext;
/** @deprecated Use isAgentMemAvailable instead */
export const isClaudeMemAvailable = isAgentMemAvailable;
