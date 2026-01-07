import { claudeMemService } from "./claude-mem-service.ts";
import { ClaudeMemMemory } from "./claude-mem-types.ts";

export { type ClaudeMemMemory };

/**
 * Query claude-mem for relevant memories
 * 
 * @param query - Search query
 * @param workspace - Workspace path (optional)
 * @param agentName - Agent name (optional, for filtering)
 * @param limit - Maximum number of memories to return
 * @returns Array of relevant memories
 */
export async function queryClaudeMemContext(
  query: string,
  workspace?: string,
  agentName?: string,
  limit: number = 5
): Promise<ClaudeMemMemory[]> {
  return await claudeMemService.queryContext(query, workspace, agentName, limit);
}

/**
 * Format memories as context string for injection into prompts
 * 
 * @param memories - Array of memories from claude-mem
 * @returns Formatted context string
 */
export function formatMemoryContext(memories: ClaudeMemMemory[]): string {
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
 * Inject claude-mem context into an agent prompt
 * 
 * @param prompt - Original prompt
 * @param workspace - Workspace path
 * @param agentName - Agent name
 * @param query - Optional search query (defaults to prompt)
 * @returns Enhanced prompt with context
 */
export async function injectClaudeMemContext(
  prompt: string,
  workspace: string,
  agentName?: string,
  query?: string
): Promise<string> {
  const searchQuery = query || prompt;
  return await claudeMemService.injectContext(searchQuery, workspace, agentName);
}

/**
 * Check if claude-mem worker is running
 * 
 * @returns true if worker is available
 */
export async function isClaudeMemAvailable(): Promise<boolean> {
  return await claudeMemService.isAvailable();
}
