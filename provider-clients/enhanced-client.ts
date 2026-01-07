import { sendToOneAgent } from "./client.ts";
import type { ClaudeMessage } from "./types.ts";
import { DISCORD_LIMITS } from "../discord/utils.ts";

// Enhanced agent client with additional features
export interface EnhancedAgentOptions {
  workDir: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  contextFiles?: string[];
  includeGitContext?: boolean;
  includeSystemInfo?: boolean;
}

export interface InternalAgentSession {
  id: string;
  startTime: Date;
  lastActivity: Date;
  messageCount: number;
  totalCost: number;
  model: string;
  workDir: string;
}

// Session manager for agents
export class InternalAgentSessionManager {
  private sessions = new Map<string, InternalAgentSession>();

  createSession(workDir: string, model?: string): InternalAgentSession {
    const session: InternalAgentSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      totalCost: 0,
      model: model || 'claude-3-5-sonnet-20241022',
      workDir
    };

    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): InternalAgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, cost?: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      session.messageCount++;
      if (cost) {
        session.totalCost += cost;
      }
    }
  }

  getAllSessions(): InternalAgentSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(maxAge: number = 3600000): InternalAgentSession[] { // 1 hour default
    const cutoff = Date.now() - maxAge;
    return Array.from(this.sessions.values()).filter(
      session => session.lastActivity.getTime() > cutoff
    );
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  cleanup(maxAge: number = 24 * 3600000): number { // 24 hours default
    const cutoff = Date.now() - maxAge;
    let deleted = 0;
    
    for (const [id, session] of this.sessions.entries()) {
      if (session.lastActivity.getTime() < cutoff) {
        this.sessions.delete(id);
        deleted++;
      }
    }
    
    return deleted;
  }
}

// Export aliases for backward compatibility
export { AGENT_MODELS as CLAUDE_MODELS, AGENT_TEMPLATES as CLAUDE_TEMPLATES };
export { InternalAgentSessionManager as ClaudeSessionManager };
export { enhancedAgentQuery as enhancedClaudeQuery };
export type { EnhancedAgentOptions as EnhancedClaudeOptions, InternalAgentSession as ClaudeSession };

// Enhanced agent client with additional context
export async function enhancedAgentQuery(
  prompt: string,
  options: EnhancedAgentOptions,
  controller: AbortController,
  sessionId?: string,
  onChunk?: (text: string) => void,
  onStreamJson?: (json: any) => void,
  continueMode?: boolean
) {
  let enhancedPrompt = prompt;

  // Add system context if requested
  if (options.includeSystemInfo) {
    const systemInfo = await getSystemContext(options.workDir);
    enhancedPrompt = `${systemInfo}\n\n${prompt}`;
  }

  // Add Git context if requested
  if (options.includeGitContext) {
    const gitInfo = await getGitContext(options.workDir);
    if (gitInfo) {
      enhancedPrompt = `${gitInfo}\n\n${enhancedPrompt}`;
    }
  }

  // Add context from specific files if provided
  if (options.contextFiles && options.contextFiles.length > 0) {
    const fileContext = await getFileContext(options.contextFiles);
    if (fileContext) {
      enhancedPrompt = `${fileContext}\n\n${enhancedPrompt}`;
    }
  }

  return sendToOneAgent(
    options.workDir,
    enhancedPrompt,
    controller,
    sessionId,
    onChunk,
    onStreamJson,
    continueMode
  );
}

// Get system context for agent
async function getSystemContext(workDir: string): Promise<string> {
  try {
    const [osInfo, nodeInfo, denoInfo] = await Promise.all([
      getOSInfo(),
      getNodeInfo(),
      getDenoInfo()
    ]);

    return `<system-context>
Working Directory: ${workDir}
${osInfo}
${nodeInfo}
${denoInfo}
Current Time: ${new Date().toISOString()}
</system-context>`;
  } catch (error) {
    return `<system-context>
Working Directory: ${workDir}
System Info: Unable to gather (${error instanceof Error ? error.message : 'Unknown error'})
Current Time: ${new Date().toISOString()}
</system-context>`;
  }
}

// Get Git repository context
async function getGitContext(workDir: string): Promise<string | null> {
  try {
    const { executeGitCommand } = await import("../git/handler.ts");
    
    const [status, branch, remotes, recentCommits] = await Promise.all([
      executeGitCommand(workDir, "git status --porcelain"),
      executeGitCommand(workDir, "git branch --show-current"),
      executeGitCommand(workDir, "git remote -v"),
      executeGitCommand(workDir, "git log --oneline -5")
    ]);

    return `<git-context>
Current Branch: ${branch.trim()}
Status: ${status || 'Clean working directory'}
Remotes: ${remotes || 'No remotes'}
Recent Commits:
${recentCommits || 'No commits'}
</git-context>`;
  } catch (error) {
    return null;
  }
}

// Get file context
async function getFileContext(filePaths: string[]): Promise<string | null> {
  try {
    const fileContents: string[] = [];

    for (const filePath of filePaths) {
      try {
        const content = await Deno.readTextFile(filePath);
        const truncatedContent = content.length > DISCORD_LIMITS.CONTENT 
          ? content.substring(0, DISCORD_LIMITS.CONTENT - 20) + '\n... (truncated)'
          : content;
        
        fileContents.push(`<file path="${filePath}">
${truncatedContent}
</file>`);
      } catch (error) {
        fileContents.push(`<file path="${filePath}">
Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}
</file>`);
      }
    }

    return `<file-context>
${fileContents.join('\n')}
</file-context>`;
  } catch (error) {
    return null;
  }
}

// System information helpers
async function getOSInfo(): Promise<string> {
  try {
    const os = Deno.build.os;
    const arch = Deno.build.arch;
    return `OS: ${os} (${arch})`;
  } catch {
    return 'OS: Unknown';
  }
}

async function getNodeInfo(): Promise<string> {
  try {
    const process = new Deno.Command("node", {
      args: ["--version"],
      stdout: "piped",
      stderr: "piped"
    });
    
    const { stdout } = await process.output();
    const version = new TextDecoder().decode(stdout).trim();
    return `Node.js: ${version}`;
  } catch {
    return 'Node.js: Not available';
  }
}

async function getDenoInfo(): Promise<string> {
  try {
    return `Deno: ${Deno.version.deno}`;
  } catch {
    return 'Deno: Unknown version';
  }
}

// Agent model options - Updated with latest models
export const AGENT_MODELS = {
  'claude-sonnet-4': {
    name: 'Sonnet 4 (Latest)',
    description: 'Most advanced model with superior reasoning',
    contextWindow: 200000,
    recommended: true,
    supportsThinking: true
  },
  'claude-sonnet-4-20250514?thinking_mode=true': {
    name: 'Sonnet 4 (Thinking Mode)',
    description: 'Sonnet 4 with visible reasoning process',
    contextWindow: 200000,
    recommended: true,
    supportsThinking: true,
    thinkingMode: true
  },
  'claude-3-5-sonnet-20241022': {
    name: '3.5 Sonnet',
    description: 'Previous generation high-performance model',
    contextWindow: 200000,
    recommended: false,
    supportsThinking: false
  },
  'claude-3-5-haiku-20241022': {
    name: '3.5 Haiku',
    description: 'Fast model for quick tasks and simple queries',
    contextWindow: 200000,
    recommended: false,
    supportsThinking: false
  },
  'claude-3-opus-20240229': {
    name: '3 Opus',
    description: 'Legacy model for complex reasoning (deprecated)',
    contextWindow: 200000,
    recommended: false,
    supportsThinking: false
  }
};

// Quick prompt templates for common tasks
export const AGENT_TEMPLATES = {
  debug: "Please help me debug this issue. Analyze the error and provide a solution:",
  explain: "Please explain this code in detail, including what it does and how it works:",
  optimize: "Please review this code and suggest optimizations for performance and readability:",
  test: "Please write comprehensive tests for this code, including edge cases:",
  refactor: "Please refactor this code to improve maintainability and follow best practices:",
  document: "Please add comprehensive documentation to this code including JSDoc comments:",
  security: "Please review this code for security vulnerabilities and suggest fixes:",
  convert: "Please convert this code to TypeScript with proper types and interfaces:"
};