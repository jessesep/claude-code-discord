/**
 * Claude-Mem Context Injection Utility
 * 
 * Provides functions to query and inject claude-mem context into agent prompts.
 * Works with all agent types: Claude Code, Cursor, and Antigravity.
 */

export interface ClaudeMemMemory {
  id: string;
  summary: string;
  content: string;
  timestamp: string;
  tags?: string[];
  relevance?: number;
}

export interface ClaudeMemSearchResult {
  memories: ClaudeMemMemory[];
  query: string;
  total: number;
}

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
  try {
    const workerUrl = Deno.env.get("CLAUDE_MEM_WORKER_URL") || "http://localhost:37777";
    
    const searchPayload: any = {
      query,
      limit,
    };
    
    if (workspace) {
      searchPayload.workspace = workspace;
    }
    
    if (agentName) {
      searchPayload.tags = [`agent:${agentName}`];
    }
    
    const response = await fetch(`${workerUrl}/api/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchPayload),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!response.ok) {
      console.warn(`Claude-mem API returned ${response.status}: ${response.statusText}`);
      return [];
    }
    
    const result: ClaudeMemSearchResult = await response.json();
    return result.memories || [];
  } catch (error) {
    // Silently fail if claude-mem is not available
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("Claude-mem query timed out");
    } else {
      console.warn("Failed to query claude-mem context:", error instanceof Error ? error.message : String(error));
    }
    return [];
  }
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
  // Check if worker is available
  const workerUrl = Deno.env.get("CLAUDE_MEM_WORKER_URL") || "http://localhost:37777";
  
  try {
    // Quick health check
    const healthCheck = await fetch(`${workerUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    
    if (!healthCheck.ok) {
      // Worker not available, return original prompt
      return prompt;
    }
  } catch {
    // Worker not available, return original prompt
    return prompt;
  }
  
  // Query for relevant memories
  const searchQuery = query || prompt;
  const memories = await queryClaudeMemContext(searchQuery, workspace, agentName);
  
  if (memories.length === 0) {
    return prompt;
  }
  
  // Format and inject context
  const context = formatMemoryContext(memories);
  return `${prompt}\n${context}`;
}

/**
 * Check if claude-mem worker is running
 * 
 * @returns true if worker is available
 */
export async function isClaudeMemAvailable(): Promise<boolean> {
  try {
    const workerUrl = Deno.env.get("CLAUDE_MEM_WORKER_URL") || "http://localhost:37777";
    const response = await fetch(`${workerUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
