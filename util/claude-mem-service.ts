import { 
  ClaudeMemMemory, 
  ClaudeMemSearchResult, 
  ClaudeMemSession, 
  ObservationData,
  ClaudeMemService
} from "./claude-mem-types.ts";

/**
 * Implementation of the ClaudeMemService
 */
export class ClaudeMemServiceImpl implements ClaudeMemService {
  private workerUrl: string;

  constructor() {
    this.workerUrl = Deno.env.get("CLAUDE_MEM_WORKER_URL") || "http://localhost:37777";
  }

  /**
   * Start a new session in claude-mem
   */
  async startSession(workspace: string, agentName: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const response = await fetch(`${this.workerUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, agent: agentName, metadata }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`);
      }

      const session: ClaudeMemSession = await response.json();
      return session.id;
    } catch (error) {
      console.warn("Claude-mem: Failed to start session:", error instanceof Error ? error.message : String(error));
      return `local-${Date.now()}`; // Fallback local ID
    }
  }

  /**
   * End a session in claude-mem
   */
  async endSession(sessionId: string, summary?: string): Promise<void> {
    if (sessionId.startsWith('local-')) return;

    try {
      const response = await fetch(`${this.workerUrl}/api/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: 'completed', summary }),
      });

      if (!response.ok) {
        console.warn(`Claude-mem: Failed to end session ${sessionId}: ${response.statusText}`);
      }
    } catch (error) {
      console.warn(`Claude-mem: Error ending session ${sessionId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Save a generic observation
   */
  async saveObservation(data: ObservationData): Promise<void> {
    if (data.session_id.startsWith('local-')) return;

    try {
      const response = await fetch(`${this.workerUrl}/api/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.warn(`Claude-mem: Failed to save observation: ${response.statusText}`);
      }
    } catch (error) {
      console.warn("Claude-mem: Error saving observation:", error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Save a prompt/response pair as an observation
   */
  async savePromptResponse(sessionId: string, prompt: string, response: string): Promise<void> {
    await this.saveObservation({
      session_id: sessionId,
      type: 'prompt',
      content: prompt,
      metadata: { role: 'user' }
    });

    await this.saveObservation({
      session_id: sessionId,
      type: 'response',
      content: response,
      metadata: { role: 'model' }
    });
  }

  /**
   * Save tool usage as an observation
   */
  async saveToolUsage(sessionId: string, tool: string, input: any, output: any): Promise<void> {
    await this.saveObservation({
      session_id: sessionId,
      type: 'tool_use',
      content: `Tool: ${tool}\nInput: ${JSON.stringify(input, null, 2)}\nOutput: ${typeof output === 'string' ? output : JSON.stringify(output, null, 2)}`,
      metadata: { tool, input: JSON.stringify(input) }
    });
  }

  /**
   * Query context from previous sessions
   */
  async queryContext(query: string, workspace?: string, agentName?: string, limit: number = 5): Promise<ClaudeMemMemory[]> {
    try {
      const searchPayload: any = { query, limit };
      if (workspace) searchPayload.workspace = workspace;
      if (agentName) searchPayload.tags = [`agent:${agentName}`];

      const response = await fetch(`${this.workerUrl}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchPayload),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return [];

      const result: ClaudeMemSearchResult = await response.json();
      return result.memories || [];
    } catch {
      return [];
    }
  }

  /**
   * Inject context into a prompt
   */
  async injectContext(prompt: string, workspace: string, agentName?: string): Promise<string> {
    const memories = await this.queryContext(prompt, workspace, agentName);
    if (memories.length === 0) return prompt;

    const contextLines = [
      "\n=== Relevant Context from Previous Sessions ===",
      ...memories.map((mem, idx) => {
        const date = new Date(mem.timestamp).toLocaleDateString();
        return `\n[${idx + 1}] ${mem.summary} (${date})`;
      }),
      "==========================================\n"
    ];

    return `${prompt}\n${contextLines.join("\n")}`;
  }

  /**
   * Check if the worker is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.workerUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const claudeMemService = new ClaudeMemServiceImpl();
