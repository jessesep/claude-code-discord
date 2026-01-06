// Agent command implementation
import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "npm:discord.js@14.14.1";
import * as path from "https://deno.land/std/path/mod.ts";
import { MANAGER_SYSTEM_PROMPT, parseManagerResponse, parseGitHubIssueRequest, ManagerAction } from "./manager.ts";
import { AgentRegistry } from "./registry.ts";
import { DISCORD_LIMITS, splitText } from "../discord/utils.ts";

// Agent types and interfaces
export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  capabilities: string[];
  riskLevel: 'low' | 'medium' | 'high';
  client?: 'claude' | 'cursor' | 'antigravity'; // Which CLI client to use (default: claude)
  workspace?: string; // For cursor: working directory
  force?: boolean; // For cursor: auto-approve operations
  sandbox?: 'enabled' | 'disabled'; // For cursor: sandbox mode
  isManager?: boolean; // If true, this agent can spawn other agents
}

export interface AgentSession {
  id: string;
  agentName: string;
  userId: string;
  channelId: string;
  startTime: Date;
  messageCount: number;
  totalCost: number;
  lastActivity: Date;

  status: 'active' | 'paused' | 'completed' | 'error';
  history: { role: 'user' | 'model'; content: string }[];
  
  // Cursor session ID for resuming conversations
  cursorSessionId?: string;
}

// Context note for all agents (context is automatically injected, no tool needed)
const CONTEXT_NOTE = `\n\n> **CONTEXT AVAILABLE**: The root \`.agent-context.md\` and relevant compartment context files have been automatically loaded into your prompt. Use this information to understand the project structure and conventions.`;

// Predefined agent configurations
export const PREDEFINED_AGENTS: Record<string, AgentConfig> = {
  'ag-manager': {
    name: 'Gemini Manager',
    description: 'Main orchestrator agent that manages other agents and interacts with the user',
    model: 'gemini-3-flash',
    systemPrompt: MANAGER_SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 10000,
    capabilities: ['orchestration', 'planning', 'subagent-management', 'task-decomposition', 'coordination'],
    riskLevel: 'low',
    client: 'antigravity',
    isManager: true
  },
  'code-reviewer': {
    name: 'Code Reviewer',
    description: 'Specialized in code review and quality analysis',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are an expert code reviewer. Focus on code quality, security, performance, and best practices. Provide detailed feedback with specific suggestions for improvement.' + CONTEXT_NOTE,
    temperature: 0.3,
    maxTokens: 4096,
    capabilities: ['code-review', 'security-analysis', 'performance-optimization'],
    riskLevel: 'low'
  },
  'architect': {
    name: 'Software Architect',
    description: 'Focused on system design and architecture decisions',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a senior software architect. Help design scalable, maintainable systems. Focus on architectural patterns, design principles, and technology choices.' + CONTEXT_NOTE,
    temperature: 0.5,
    maxTokens: 4096,
    capabilities: ['system-design', 'architecture-review', 'technology-selection'],
    riskLevel: 'low'
  },
  'debugger': {
    name: 'Debug Specialist',
    description: 'Expert at finding and fixing bugs',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a debugging expert. Help identify root causes of issues, suggest debugging strategies, and provide step-by-step solutions.' + CONTEXT_NOTE,
    temperature: 0.2,
    maxTokens: 4096,
    capabilities: ['bug-analysis', 'debugging', 'troubleshooting'],
    riskLevel: 'medium'
  },
  'security-expert': {
    name: 'Security Analyst',
    description: 'Specialized in security analysis and vulnerability assessment',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a cybersecurity expert. Focus on identifying security vulnerabilities, suggesting secure coding practices, and analyzing potential threats.' + CONTEXT_NOTE,
    temperature: 0.1,
    maxTokens: 4096,
    capabilities: ['security-analysis', 'vulnerability-assessment', 'threat-modeling'],
    riskLevel: 'medium'
  },
  'performance-optimizer': {
    name: 'Performance Engineer',
    description: 'Expert in performance optimization and profiling',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a performance optimization expert. Help identify bottlenecks, suggest optimizations, and improve system performance.' + CONTEXT_NOTE,
    temperature: 0.3,
    maxTokens: 4096,
    capabilities: ['performance-analysis', 'optimization', 'profiling'],
    riskLevel: 'medium'
  },
  'devops-engineer': {
    name: 'DevOps Engineer',
    description: 'Specialized in deployment, CI/CD, and infrastructure',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a DevOps engineer. Help with deployment strategies, CI/CD pipelines, infrastructure as code, and operational best practices.' + CONTEXT_NOTE,
    temperature: 0.4,
    maxTokens: 4096,
    capabilities: ['deployment', 'ci-cd', 'infrastructure', 'monitoring'],
    riskLevel: 'high'
  },
  'general-assistant': {
    name: 'General Development Assistant',
    description: 'General-purpose development assistant',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a helpful development assistant. Provide clear, accurate, and practical help with programming tasks, answer questions, and offer suggestions.' + CONTEXT_NOTE,
    temperature: 0.7,
    maxTokens: 4096,
    capabilities: ['general-help', 'coding', 'explanation', 'guidance'],
    riskLevel: 'low'
  },

  // Cursor-powered agents (autonomous code editing)
  'cursor-coder': {
    name: 'Cursor Autonomous Coder',
    description: 'Cursor AI agent that can autonomously write and edit code',
    model: 'auto', // Let Cursor pick the best model
    systemPrompt: 'You are an autonomous coding agent powered by Cursor. You can read, write, and modify code files. Be thorough, write clean code, and follow best practices.' + CONTEXT_NOTE,
    temperature: 0.3,
    maxTokens: 8000,
    capabilities: ['file-editing', 'code-generation', 'refactoring', 'autonomous'],
    riskLevel: 'high',
    client: 'cursor',
    force: false, // Require approval for operations
    sandbox: 'enabled'
  },
  'cursor-refactor': {
    name: 'Cursor Refactoring Specialist',
    description: 'Specialized in autonomous code refactoring using Cursor',
    model: 'sonnet-4.5',
    systemPrompt: 'You are a refactoring specialist. Improve code structure, readability, and maintainability while preserving functionality. Always write tests to verify behavior.' + CONTEXT_NOTE,
    temperature: 0.2,
    maxTokens: 8000,
    capabilities: ['refactoring', 'code-improvement', 'file-editing'],
    riskLevel: 'high',
    client: 'cursor',
    force: false,
    sandbox: 'enabled'
  },
  'cursor-debugger': {
    name: 'Cursor Debug Agent',
    description: 'Autonomous debugging agent using Cursor',
    model: 'sonnet-4.5-thinking',
    systemPrompt: 'You are a debugging expert with autonomous code editing capabilities. Investigate issues, add logging, write tests, and fix bugs. Think step-by-step.' + CONTEXT_NOTE,
    temperature: 0.1,
    maxTokens: 8000,
    capabilities: ['debugging', 'testing', 'file-editing', 'autonomous'],
    riskLevel: 'high',
    client: 'cursor',
    force: false,
    sandbox: 'enabled'
  },
  'cursor-fast': {
    name: 'Cursor Fast Agent',
    description: 'Quick code changes with auto-approval (use with caution)',
    model: 'sonnet-4.5',
    systemPrompt: 'You are a fast coding agent. Make quick, targeted changes. Be efficient and accurate.' + CONTEXT_NOTE,
    temperature: 0.3,
    maxTokens: 4096,
    capabilities: ['quick-edits', 'file-editing', 'autonomous'],
    riskLevel: 'high',
    client: 'cursor',
    force: true, // Auto-approve for speed
    sandbox: 'disabled'
  },

  // Antigravity-powered agents (Google Agentic Platform)
  'ag-coder': {
    name: 'Antigravity Coder',
    description: 'Google Antigravity agent for autonomous coding tasks',
    model: 'gemini-3-flash',
    systemPrompt: 'You are an autonomous coding agent powered by Google Antigravity. You can plan, execute, and verify complex coding tasks.' + CONTEXT_NOTE,
    temperature: 0.3,
    maxTokens: 30000,
    capabilities: ['file-editing', 'planning', 'autonomous', 'browser-interaction'],
    riskLevel: 'high',
    client: 'antigravity',
    force: false,
    sandbox: 'enabled'
  },
  'ag-architect': {
    name: 'Antigravity Architect',
    description: 'High-level system design and planning agent',
    model: 'gemini-3-flash',
    systemPrompt: 'You are a software architect agent. Analyze requirements, design systems, and create implementation plans using Antigravity tools.' + CONTEXT_NOTE,
    temperature: 0.4,
    maxTokens: 30000,
    capabilities: ['system-design', 'planning', 'architecture'],
    riskLevel: 'medium',
    client: 'antigravity'
  },
  'ag-coder-gemini': {
    name: 'Gemini Coder',
    description: 'Coding agent with dynamic Gemini model selection',
    model: 'gemini-3-flash', // Can be overridden at runtime
    systemPrompt: 'You are an autonomous coding agent powered by Google Gemini. You can plan, execute, and verify complex coding tasks.' + CONTEXT_NOTE,
    temperature: 0.3,
    maxTokens: 30000,
    capabilities: ['file-editing', 'planning', 'autonomous', 'code-generation'],
    riskLevel: 'high',
    client: 'antigravity',
    force: false,
    sandbox: 'enabled'
  }
};

// Agent command definition
export const agentCommand = new SlashCommandBuilder()
  .setName('agent')
  .setDescription('Interact with specialized AI agents for different development tasks')
  .addStringOption(option =>
    option.setName('action')
      .setDescription('Agent action to perform')
      .setRequired(true)
      .addChoices(
        { name: 'List Agents', value: 'list' },
        { name: 'Select Agent', value: 'select' },
        { name: 'Start Session', value: 'start' },
        { name: 'Chat with Agent', value: 'chat' },
        { name: 'Switch Agent', value: 'switch' },
        { name: 'Agent Status', value: 'status' },
        { name: 'End Session', value: 'end' },
        { name: 'Agent Info', value: 'info' }
      ))
  .addStringOption(option =>
    option.setName('agent_name')
      .setDescription('Name of the agent to interact with')
      .setRequired(false)
      .addChoices(
        ...Object.entries(PREDEFINED_AGENTS).map(([key, agent]) => ({
          name: agent.name,
          value: key
        }))
      ))
  .addStringOption(option =>
    option.setName('message')
      .setDescription('Message to send to the agent')
      .setRequired(false))
  .addStringOption(option =>
    option.setName('context_files')
      .setDescription('Comma-separated list of files to include in context')
      .setRequired(false))
  .addBooleanOption(option =>
    option.setName('include_system_info')
      .setDescription('Include system information in context')
      .setRequired(false));

export interface AgentHandlerDeps {
  workDir: string;
  crashHandler: any;
  sendClaudeMessages: (messages: any[]) => Promise<void>;
  sessionManager: any;
}

// In-memory storage for agent sessions (in production, would be persisted)
let agentSessions: AgentSession[] = [];
// Support multiple concurrent agents per user/channel
// Key format: `${userId}:${channelId}`, value: array of active agent names
let currentUserAgent: Record<string, string[]> = {}; // userId:channelId -> agentName[]
const pendingSwarmTasks = new Map<string, { subAgentName: string, task: string, managerConfig: AgentConfig }>();

// Helper to get composite key for user+channel
function getUserChannelKey(userId: string, channelId: string): string {
  return `${userId}:${channelId}`;
}

// Helper to get active agents for a user/channel
export function getActiveAgents(userId: string, channelId: string): string[] {
  const key = getUserChannelKey(userId, channelId);
  return currentUserAgent[key] || [];
}

// Helper to add an agent to active list
function addActiveAgent(userId: string, channelId: string, agentName: string): void {
  const key = getUserChannelKey(userId, channelId);
  if (!currentUserAgent[key]) {
    currentUserAgent[key] = [];
  }
  if (!currentUserAgent[key].includes(agentName)) {
    currentUserAgent[key].push(agentName);
  }
}

// Helper to remove an agent from active list
function removeActiveAgent(userId: string, channelId: string, agentName?: string): void {
  const key = getUserChannelKey(userId, channelId);
  if (!currentUserAgent[key]) return;
  
  if (agentName) {
    // Remove specific agent
    currentUserAgent[key] = currentUserAgent[key].filter(a => a !== agentName);
  } else {
    // Remove all agents for this user/channel
    delete currentUserAgent[key];
  }
  
  // Clean up empty arrays
  if (currentUserAgent[key] && currentUserAgent[key].length === 0) {
    delete currentUserAgent[key];
  }
}

export function createAgentHandlers(deps: AgentHandlerDeps) {
  const { workDir, crashHandler, sendClaudeMessages, sessionManager } = deps;

  return {
    async onAgent(
      ctx: any,
      action: string,
      agentName?: string,
      message?: string,
      contextFiles?: string,
      includeSystemInfo?: boolean
    ) {
      try {
        await ctx.deferReply();

        switch (action) {
          case 'list':
            await listAgents(ctx);
            break;

          case 'select':
          case 'start':
            if (!agentName) {
              await ctx.editReply({
                content: 'Agent name is required for starting a session.',
                ephemeral: true
              });
              return;
            }
            await startAgentSession(ctx, agentName);
            break;

          case 'chat':
            if (!message) {
              await ctx.editReply({
                content: 'Message is required for chatting with agent.',
                ephemeral: true
              });
              return;
            }
            await chatWithAgent(ctx, message, agentName, contextFiles, includeSystemInfo, deps);
            break;

          case 'switch':
            if (!agentName) {
              await ctx.editReply({
                content: 'Agent name is required for switching agents.',
                ephemeral: true
              });
              return;
            }
            await switchAgent(ctx, agentName);
            break;

          case 'status':
            await showAgentStatus(ctx);
            break;

          case 'end':
            await endAgentSession(ctx);
            break;

          case 'info':
            if (!agentName) {
              await ctx.editReply({
                content: 'Agent name is required for showing agent info.',
                ephemeral: true
              });
              return;
            }
            await showAgentInfo(ctx, agentName);
            break;

          default:
            await ctx.editReply({
              embeds: [{
                color: 0xff0000,
                title: '❌ Invalid Action',
                description: `Unknown agent action: ${action}`,
                timestamp: new Date().toISOString()
              }]
            });
        }
      } catch (error) {
        await crashHandler.reportCrash('agent', error instanceof Error ? error : new Error(String(error)), 'agent-command');
        throw error;
      }
    },
    async handleButton(ctx: any, customId: string) {
      const userId = ctx.user.id;

      if (customId.startsWith('agent_spawn_approve:')) {
        const subAgentName = customId.split(':')[1];
        const pending = pendingSwarmTasks.get(userId);

        if (!pending || pending.subAgentName !== subAgentName) {
          await ctx.reply({ content: "No pending task found or session expired.", ephemeral: true });
          return;
        }

        pendingSwarmTasks.delete(userId);
        await ctx.update({
          embeds: [{
            color: 0x00ff00,
            title: `✅ Spawn Approved`,
            description: `Starting **${subAgentName}** to work on task...`,
            timestamp: new Date().toISOString()
          }],
          components: []
        });

        let subAgentOutput = "";
        try {
          const progressMsg = await ctx.followUp({
            embeds: [{
              color: 0xffaa00,
              title: `⚙️ Subagent Working: ${subAgentName}`,
              description: "The agent is executing the task autonomously...",
              timestamp: new Date().toISOString()
            }]
          });

          // SECURITY: All Antigravity agents use gcloud OAuth (secure Google login)
          // No need to check owner - authentication is handled by gcloud credentials
          subAgentOutput = await runAgentTask(subAgentName, pending.task, undefined, true);

          const summaryPrompt = `You are the Manager. You spawned '${subAgentName}' to do this task: "${pending.task}".\n\nOutput:\n${subAgentOutput.substring(0, 40000)}\n\nProvide CONCISE summary.`;
          const { sendToAntigravityCLI } = await import("../claude/antigravity-client.ts");
          const summaryResponse = await sendToAntigravityCLI(
            summaryPrompt,
            new AbortController(),
            {
              model: pending.managerConfig.model,
              authorized: true // Always use gcloud OAuth for Antigravity agents
            }
          );
          const summaryText = summaryResponse.response;

          await progressMsg.edit({
            embeds: [{
              color: 0x00ff00,
              title: '✅ Task Completed',
              description: summaryText.substring(0, DISCORD_LIMITS.EMBED_DESCRIPTION),
              timestamp: new Date().toISOString()
            }]
          });
        } catch (err) {
          await ctx.followUp({ content: `❌ Error: ${err}`, ephemeral: true });
        }
      } else if (customId.startsWith('agent_spawn_decline:')) {
        pendingSwarmTasks.delete(userId);
        await ctx.update({
          embeds: [{ color: 0xff0000, title: '❌ Spawn Declined', timestamp: new Date().toISOString() }],
          components: []
        });
      }
    }
  };
}

// Helper functions for agent management
async function listAgents(ctx: any) {
  const agents = AgentRegistry.getInstance().listAgents();
  const agentList = Object.entries(agents).map(([key, agent]) => {
    const riskEmoji = agent.riskLevel === 'high' ? '🔴' : agent.riskLevel === 'medium' ? '🟡' : '🟢';
    return `${riskEmoji} **${agent.name}** (\`${key}\`)\n   ${agent.description}\n   Capabilities: ${agent.capabilities.join(', ')}`;
  }).join('\n\n');

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '🤖 Available AI Agents',
      description: agentList,
      fields: [{
        name: 'Risk Levels',
        value: '🟢 Low Risk • 🟡 Medium Risk • 🔴 High Risk',
        inline: false
      }],
      footer: {
        text: 'Use /agent action:start agent_name:[name] to begin a session'
      },
      timestamp: new Date().toISOString()
    }]
  });
}

async function startAgentSession(ctx: any, agentName: string) {
  const agent = AgentRegistry.getInstance().getAgent(agentName);
  if (!agent) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Agent Not Found',
        description: `No agent found with name: ${agentName}`,
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  const userId = ctx.user.id;

  // Security: RBAC for High-Risk Agents
  const ownerId = Deno.env.get("OWNER_ID") || Deno.env.get("DEFAULT_MENTION_USER_ID");
  if (agent.riskLevel === 'high' && ownerId && userId !== ownerId) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '⛔ Access Denied',
        description: `Agent **${agent.name}** is a high-risk agent and can only be used by the bot owner.`,
        footer: { text: "Security policy: Restricted access enabled" },
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  const channelId = ctx.channelId || ctx.channel?.id;
  console.log(`[startSession] Creating session: userId=${userId}, channelId=${channelId}, agentName=${agentName}`);
  addActiveAgent(userId, channelId, agentName);

  const session: AgentSession = {
    id: generateSessionId(),
    agentName,
    userId,
    channelId,
    startTime: new Date(),
    messageCount: 0,
    totalCost: 0,
    lastActivity: new Date(),
    status: 'active',
    history: []
  };

  agentSessions.push(session);
  console.log(`[startSession] Session created and added. Total sessions: ${agentSessions.length}`);

  const riskColor = agent.riskLevel === 'high' ? 0xff6600 : agent.riskLevel === 'medium' ? 0xffaa00 : 0x00ff00;

  // For manager agent, automatically send a greeting asking what the user wants to do
  if (agent.isManager) {
    await ctx.editReply({
      embeds: [{
        color: riskColor,
        title: '🚀 Helper Agent Ready',
        description: `**${agent.name}** is ready to help!\n\n👋 **Hey! What do you want to do?**\n\nJust type your request in this channel. Include:\n• What you want to accomplish\n• The repository path (if different from current)\n\nI'll analyze your request and launch the right agent to help you.`,
        fields: [
          { name: 'Session ID', value: `\`${session.id.substring(0, 12)}\``, inline: true },
          { name: 'Status', value: '✅ Active - Ready for input', inline: true }
        ],
        footer: { text: 'Tip: Type your request directly in the channel, no slash commands needed!' },
        timestamp: new Date().toISOString()
      }]
    });
  } else {
    await ctx.editReply({
      embeds: [{
        color: riskColor,
        title: '🚀 Agent Session Started',
        fields: [
          { name: 'Agent', value: agent.name, inline: true },
          { name: 'Risk Level', value: agent.riskLevel.toUpperCase(), inline: true },
          { name: 'Session ID', value: `\`${session.id.substring(0, 12)}\``, inline: true },
          { name: 'Description', value: agent.description, inline: false },
          { name: 'Capabilities', value: agent.capabilities.join(', '), inline: false },
          { name: 'Usage', value: 'Just type your message in this channel to continue the conversation', inline: false }
        ],
        timestamp: new Date().toISOString()
      }]
    });
  }
}

/**
 * Run an agent task headlessly (without Discord context)
 * Used by Swarm Orchestrator
 */
export async function runAgentTask(
  agentId: string,
  task: string,
  onChunk?: (text: string) => void,
  isAuthorized: boolean = false
): Promise<string> {
  const agent = AgentRegistry.getInstance().getAgent(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const controller = new AbortController(); // No external control for now in headless
  let resultText = "";

  const clientType = agent.client || 'claude';

  if (clientType === 'cursor') {
    const { sendToCursorCLI } = await import("../claude/cursor-client.ts");
    const safeTask = task.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const prompt = `${agent.systemPrompt}\n\n<task>${safeTask}</task>`;
    const result = await sendToCursorCLI(
      prompt,
      controller,
      {
        workspace: agent.workspace,
        force: agent.force,
        sandbox: agent.sandbox,
        streamJson: true,
      },
      onChunk
    );
    resultText = result.response;
  } else if (clientType === 'antigravity') {
    const { sendToAntigravityCLI } = await import("../claude/antigravity-client.ts");
    const safeSystemPrompt = agent.systemPrompt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeTask = task.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const prompt = `${safeSystemPrompt}\n\n<task>${safeTask}</task>`;
    // SECURITY: Default to authorized=true (gcloud OAuth) for all Antigravity agents
    // This ensures secure authentication via Google login instead of API keys
    const result = await sendToAntigravityCLI(
      prompt,
      controller,
      {
        model: agent.model,
        workspace: agent.workspace,
        streamJson: true,
        force: agent.force,
        sandbox: agent.sandbox,
        authorized: true, // Always use gcloud OAuth for Antigravity agents
      },
      onChunk
    );
    resultText = result.response;
  } else {
    // Default Claude (Mock/Direct implementation needed if no CLI)
    // For now, assuming we don't use basic Claude in swarm or reusing existing logic
    // But existing runClaudeCLI depends on internal state.
    // We'll skip Claude for headless swarm for now or implement direct client.
    throw new Error("Claude client headless not yet supported");
  }

  return resultText;
}

export async function chatWithAgent(
  ctx: any,
  message: string,
  agentName?: string,
  contextFiles?: string,
  includeSystemInfo?: boolean,
  deps?: AgentHandlerDeps
) {
  const userId = ctx.user.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  // If agentName is provided, use it; otherwise get the first active agent for this user/channel
  const activeAgents = getActiveAgents(userId, channelId);
  const activeAgentName = agentName || (activeAgents.length > 0 ? activeAgents[0] : undefined);
  // ...
  const agent = AgentRegistry.getInstance().getAgent(activeAgentName || '');
  if (!agent) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Agent Not Found',
        description: `Agent ${activeAgentName} is not available.`,
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  // Use tested model if available
  if (agent.client === 'antigravity') {
    try {
      const { getBestAvailableModel } = await import("../util/model-tester.ts");
      const fallbackModels = ['gemini-3-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      agent.model = getBestAvailableModel(agent.model, fallbackModels);
    } catch (error) {
      console.warn('[Agent] Could not get tested model, using configured model:', error);
    }
  }

  // --- MANAGER AGENT LOGIC ---
  if (agent.isManager) {
    console.log('[Manager] Handling manager interaction');
    await handleManagerInteraction(ctx, message, agent, deps);
    return;
  }
  // ---------------------------

  // Get active session and add message to history
  const channelId = ctx.channelId || ctx.channel?.id;
  const sessionData = getActiveSession(userId, channelId || '');
  
  if (sessionData && sessionData.session) {
    // Add user message to history
    sessionData.session.history.push({ role: 'user', content: message });
    sessionData.session.messageCount++;
    sessionData.session.lastActivity = new Date();
  }

  // Build conversation history string
  let historyPrompt = "";
  if (sessionData && sessionData.session && sessionData.session.history.length > 0) {
    historyPrompt = "<conversation_history>\n";
    for (const msg of sessionData.session.history) {
      const role = msg.role === 'user' ? 'user' : 'assistant';
      const safeContent = msg.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      historyPrompt += `  <entry role="${role}">${safeContent}</entry>\n`;
    }
    historyPrompt += "</conversation_history>\n";
  }

  // Get git repository information
  let gitContext = "";
  try {
    const workDir = deps?.workDir || Deno.cwd();
    const { getGitInfo, getGitStatus } = await import("../git/handler.ts");
    
    try {
      const gitInfo = await getGitInfo(workDir);
      const gitStatus = await getGitStatus(workDir);
      
      gitContext = `\n\n=== REPOSITORY CONTEXT ===\n`;
      gitContext += `Working Directory: ${workDir}\n`;
      gitContext += `Repository: ${gitInfo.repo}\n`;
      gitContext += `Branch: ${gitInfo.branch}\n`;
      if (gitStatus.remote && gitStatus.remote !== "No remotes configured") {
        gitContext += `Remote: ${gitStatus.remote}\n`;
      }
      gitContext += `\nYou are working in a local Git repository on the user's computer.\n`;
      gitContext += `All file paths should be relative to: ${workDir}\n`;
      gitContext += `=== END REPOSITORY CONTEXT ===\n`;
    } catch (error) {
      // Not a git repo or error getting info
      const workDir = deps?.workDir || Deno.cwd();
      gitContext = `\n\n=== WORKING DIRECTORY ===\n`;
      gitContext += `Working Directory: ${workDir}\n`;
      gitContext += `Note: This directory is not a Git repository.\n`;
      gitContext += `All file paths should be relative to: ${workDir}\n`;
      gitContext += `=== END WORKING DIRECTORY ===\n`;
    }
  } catch (error) {
    console.debug('[Agent] Error getting git context:', error);
  }

  // Build the enhanced prompt with agent's system prompt
  const safeSystemPrompt = agent.systemPrompt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let enhancedPrompt = `${safeSystemPrompt}${gitContext}\n\n${historyPrompt ? `=== CONVERSATION HISTORY ===\n${historyPrompt}=== END HISTORY ===\n\n` : ''}<user_query>${safeMessage}</user_query>`;

  // Inject .agent-context.md files into prompt (since Gemini doesn't have tool access)
  let contextContent = "";
  try {
    const workDir = deps?.workDir || Deno.cwd();
    const rootContextPath = `${workDir}/.agent-context.md`;
    
    // Read root context
    try {
      const rootContext = await Deno.readTextFile(rootContextPath);
      contextContent += `\n\n=== ROOT AGENT CONTEXT ===\n${rootContext}\n=== END ROOT CONTEXT ===\n`;
    } catch (e) {
      console.debug('[Agent] Could not read root .agent-context.md:', e);
    }
    
    // Read compartment-specific context if available
    const compartmentContextPath = `${workDir}/${activeAgentName.includes('architect') ? 'agent' : activeAgentName.includes('coder') ? 'agent' : ''}/.agent-context.md`;
    if (compartmentContextPath !== `${workDir}/.agent-context.md`) {
      try {
        const compartmentContext = await Deno.readTextFile(compartmentContextPath);
        contextContent += `\n\n=== COMPARTMENT CONTEXT ===\n${compartmentContext}\n=== END COMPARTMENT CONTEXT ===\n`;
      } catch (e) {
        // Silently fail - not all compartments have context files
      }
    }
  } catch (error) {
    console.debug('[Agent] Error reading context files:', error);
  }
  
  enhancedPrompt = `${enhancedPrompt}${contextContent}`;

  // Inject claude-mem context (if available)
  try {
    const { injectClaudeMemContext } = await import("../util/claude-mem-context.ts");
    const workDir = deps?.workDir || Deno.cwd();
    enhancedPrompt = await injectClaudeMemContext(
      enhancedPrompt,
      workDir,
      activeAgentName,
      message
    );
  } catch (error) {
    // Silently fail if claude-mem is not available
    console.debug("Claude-mem context injection skipped:", error);
  }

  // Add context if requested
  if (includeSystemInfo) {
    const systemInfo = `System: ${Deno.build.os} ${Deno.build.arch}\nWorking Directory: ${deps?.workDir}`;
    enhancedPrompt += `\n\nSystem Context:\n${systemInfo}`;
  }

  if (contextFiles) {
    enhancedPrompt += `\n\nRelevant Files: ${contextFiles}`;
  }

  await ctx.editReply({
    embeds: [{
      color: 0xffff00,
      title: `🤖 ${agent.name} Processing...`,
      description: 'Agent is analyzing your request...',
      fields: [
        { name: 'Agent', value: agent.name, inline: true },
        { name: 'Model', value: agent.model, inline: true },
        { name: 'Temperature', value: agent.temperature.toString(), inline: true },
        { name: 'Message Preview', value: `\`${message.substring(0, 200)}${message.length > 200 ? '...' : ''}\``, inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });

  // Helper function to detect rate limit/quota errors
  const isRateLimitError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('exit code 1') ||
      msg.includes('exited with code 1') ||
      msg.includes('rate limit') ||
      msg.includes('quota') ||
      msg.includes('usage limit') ||
      msg.includes('out of extra usage') ||
      msg.includes('exceeds') ||
      msg.includes('429')
    );
  };

  // Call actual Claude API with agent configuration
  try {
    // Create controller for this request
    const controller = new AbortController();

    let currentChunk = "";
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 2000; // Update Discord every 2 seconds
    let result;
    let fallbackUsed = false;

    // Determine which client to use based on agent configuration
    const clientType = agent.client || 'claude'; // Default to Claude

    // Try Claude first (if not explicitly set to cursor/antigravity)
    if (clientType === 'claude' || !clientType) {
      try {
        // Import the Claude CLI client (uses Claude subscription, no API key needed!)
        const { sendToClaudeCLI } = await import("../claude/cli-client.ts");

        // Use simple model alias for CLI (sonnet/opus) instead of full model ID
        const cliModel = agent.model.includes("sonnet") ? "sonnet" : agent.model.includes("opus") ? "opus" : "sonnet";
        result = await sendToClaudeCLI(
          agent.systemPrompt,
          message,
          controller,
          cliModel,
          8000,
          async (chunk) => {
            currentChunk += chunk;

            // Send updates to Discord periodically
            const now = Date.now();
            if (now - lastUpdate >= UPDATE_INTERVAL && deps?.sendClaudeMessages) {
              lastUpdate = now;

              // Send the accumulated text as a message
              const claudeMessages = [{
                type: 'text' as const,
                content: currentChunk,
                timestamp: new Date().toISOString()
              }];

              await deps.sendClaudeMessages(claudeMessages).catch(() => { });
              currentChunk = ""; // Reset after sending to avoid duplicates
            }
          }
        );
      } catch (claudeError) {
        // If Claude fails due to rate limit/quota, try fallback providers
        if (isRateLimitError(claudeError)) {
          console.log("⚠️ Claude rate limit/quota exceeded, trying fallback providers...");
          fallbackUsed = true;
          
          // Notify user about fallback
          await ctx.editReply({
            embeds: [{
              color: 0xffaa00,
              title: `⚠️ ${agent.name} - Using Fallback Provider`,
              description: 'Claude API limit reached. Trying alternative providers (Cursor → Antigravity)...',
              timestamp: new Date().toISOString()
            }]
          }).catch(() => {});

          // Try Cursor as first fallback
          try {
            const { sendToCursorCLI } = await import("../claude/cursor-client.ts");
            let fullPrompt = `${agent.systemPrompt}\n\nTask: ${message}`;

            // Inject claude-mem context for Cursor agents
            try {
              const { injectClaudeMemContext } = await import("../util/claude-mem-context.ts");
              const workDir = deps?.workDir || Deno.cwd();
              fullPrompt = await injectClaudeMemContext(
                fullPrompt,
                workDir,
                activeAgentName,
                message
              );
            } catch {
              // Silently fail if claude-mem is not available
            }

            result = await sendToCursorCLI(
              fullPrompt,
              controller,
              {
                model: agent.model,
                workspace: deps?.workDir || Deno.cwd(),
                streamJson: true,
              },
              async (chunk) => {
                currentChunk += chunk;
                const now = Date.now();
                if (now - lastUpdate >= UPDATE_INTERVAL && deps?.sendClaudeMessages) {
                  lastUpdate = now;
                  const claudeMessages = [{
                    type: 'text' as const,
                    content: currentChunk,
                    timestamp: new Date().toISOString()
                  }];
                  await deps.sendClaudeMessages(claudeMessages).catch(() => { });
                  currentChunk = "";
                }
              }
            );
            console.log("✅ Successfully used Cursor as fallback");
          } catch (cursorError) {
            // If Cursor also fails, try Antigravity as final fallback
            if (isRateLimitError(cursorError)) {
              console.log("⚠️ Cursor also hit limits, trying Antigravity (Gemini) as final fallback...");
            }
            
            try {
              const { sendToAntigravityCLI } = await import("../claude/antigravity-client.ts");
              let fullPrompt = `${agent.systemPrompt}\n\nTask: ${message}`;

              // Inject claude-mem context for Antigravity agents
              try {
                const { injectClaudeMemContext } = await import("../util/claude-mem-context.ts");
                const workDir = deps?.workDir || Deno.cwd();
                fullPrompt = await injectClaudeMemContext(
                  fullPrompt,
                  workDir,
                  activeAgentName,
                  message
                );
              } catch {
                // Silently fail if claude-mem is not available
              }

              // SECURITY: Always use gcloud OAuth for Antigravity agents (secure Google login)
              result = await sendToAntigravityCLI(
                fullPrompt,
                controller,
                {
                  model: agent.model,
                  workspace: agent.workspace,
                  force: agent.force,
                  sandbox: agent.sandbox,
                  streamJson: true,
                  authorized: true, // Always use gcloud OAuth for Antigravity agents
                },
                async (chunk) => {
                  currentChunk += chunk;
                  const now = Date.now();
                  if (now - lastUpdate >= UPDATE_INTERVAL && deps?.sendClaudeMessages) {
                    lastUpdate = now;
                    const claudeMessages = [{
                      type: 'text' as const,
                      content: currentChunk,
                      timestamp: new Date().toISOString()
                    }];
                    await deps.sendClaudeMessages(claudeMessages).catch(() => { });
                    currentChunk = "";
                  }
                }
              );
              console.log("✅ Successfully used Antigravity (Gemini) as fallback");
            } catch (antigravityError) {
              // All fallbacks failed
              throw new Error(
                `All providers failed:\n` +
                `- Claude: ${claudeError instanceof Error ? claudeError.message : String(claudeError)}\n` +
                `- Cursor: ${cursorError instanceof Error ? cursorError.message : String(cursorError)}\n` +
                `- Antigravity: ${antigravityError instanceof Error ? antigravityError.message : String(antigravityError)}\n\n` +
                `Please wait a moment and try again, or check your API keys/quotas.`
              );
            }
          }
        } else {
          // Non-rate-limit error, re-throw
          throw claudeError;
        }
      }
    } else if (clientType === 'cursor') {
      // Import Cursor CLI client
      const { sendToCursorCLI } = await import("../claude/cursor-client.ts");

      // Check for existing Cursor session to resume
      const existingSession = agentSessions.find(
        s => s.userId === userId && s.channelId === channelId && s.status === 'active' && s.cursorSessionId
      );
      const resumeSessionId = existingSession?.cursorSessionId;
      
      if (resumeSessionId) {
        console.log(`[Cursor] Resuming session: ${resumeSessionId}`);
      }

      // Build Cursor prompt - if resuming, just send the message; otherwise include system prompt
      let fullPrompt = resumeSessionId 
        ? message  // Just the new message when resuming
        : `${agent.systemPrompt}\n\nTask: ${message}`;

      // Inject claude-mem context for Cursor agents (only on first message)
      if (!resumeSessionId) {
        try {
          const { injectClaudeMemContext } = await import("../util/claude-mem-context.ts");
          const workDir = deps?.workDir || Deno.cwd();
          fullPrompt = await injectClaudeMemContext(
            fullPrompt,
            workDir,
            activeAgentName,
            message
          );
        } catch (error) {
          console.debug("Claude-mem context injection skipped for Cursor:", error);
        }
      }

      // Call Cursor CLI with streaming
      result = await sendToCursorCLI(
        fullPrompt,
        controller,
        {
          model: agent.model,
          workspace: agent.workspace,
          force: agent.force,
          sandbox: agent.sandbox,
          streamJson: true, // Enable streaming for Discord updates
          resume: resumeSessionId, // Resume existing session if available
        },
        async (chunk) => {
          currentChunk += chunk;

          // Send updates to Discord periodically
          const now = Date.now();
          if (now - lastUpdate >= UPDATE_INTERVAL && deps?.sendClaudeMessages) {
            lastUpdate = now;

            // Send the accumulated text as a message
            const claudeMessages = [{
              type: 'text' as const,
              content: currentChunk,
              timestamp: new Date().toISOString()
            }];

            await deps.sendClaudeMessages(claudeMessages).catch(() => { });
            currentChunk = ""; // Reset after sending to avoid duplicates
          }
        }
      );
      
      // Save the Cursor session ID for future resumption
      if (result.chatId) {
        const currentSession = agentSessions.find(
          s => s.userId === userId && s.channelId === channelId && s.status === 'active'
        );
        if (currentSession) {
          currentSession.cursorSessionId = result.chatId;
          console.log(`[Cursor] Saved session ID: ${result.chatId}`);
        }
        
        // Sync to conversation file
        try {
          const { setCursorSessionId, addMessage } = await import("../util/conversation-sync.ts");
          await setCursorSessionId(userId, channelId, activeAgentName, result.chatId);
          // Save user message
          await addMessage(userId, channelId, activeAgentName, 'user', message, 'discord');
          // Save assistant response
          if (result.response) {
            await addMessage(userId, channelId, activeAgentName, 'assistant', result.response, 'cursor');
          }
        } catch (syncError) {
          console.debug("[ConversationSync] Sync failed:", syncError);
        }
      }
    } else if (clientType === 'antigravity') {
      // Import Antigravity CLI client
      const { sendToAntigravityCLI } = await import("../claude/antigravity-client.ts");

      // Build Prompt with history
      let fullPrompt = enhancedPrompt;

      // Inject claude-mem context for Antigravity agents
      try {
        const { injectClaudeMemContext } = await import("../util/claude-mem-context.ts");
        const workDir = deps?.workDir || Deno.cwd();
        fullPrompt = await injectClaudeMemContext(
          fullPrompt,
          workDir,
          activeAgentName,
          message
        );
      } catch (error) {
        console.debug("Claude-mem context injection skipped for Antigravity:", error);
      }

      if (contextFiles) {
        try {
          const files = contextFiles.split(',').map(f => f.trim());
          fullPrompt += `\n\n=== Context Files ===\n`;

          for (const file of files) {
            try {
              const workspaceDir = path.resolve(deps?.workDir || Deno.cwd());
              const targetPath = path.resolve(workspaceDir, file);

              if (!targetPath.startsWith(workspaceDir)) {
                fullPrompt += `\n--- File: ${file} (Access Denied) ---\n`;
                continue;
              }

              const stat = await Deno.stat(targetPath);
              if (stat.isFile) {
                const content = await Deno.readTextFile(targetPath);
                fullPrompt += `\n--- File: ${file} ---\n${content}\n----------------\n`;
              }
            } catch (e) {
              fullPrompt += `\n--- File: ${file} (Error: ${e.message}) ---\n`;
            }
          }
          fullPrompt += `\n=====================\n`;
        } catch (err) {
          console.error("Error loading context files:", err);
        }
      }

      // Git Context Injection
      // We checking deps.includeGit which we passed from commands.ts
      if ((deps as any)?.includeGit) {
        try {
          const workDir = deps?.workDir || Deno.cwd();
          fullPrompt += `\n\n=== Git Context ===\n`;

          // Git Status
          const pStatus = new Deno.Command("git", { args: ["status"], cwd: workDir, stdout: "piped", stderr: "piped" });
          const outStatus = await pStatus.output();
          fullPrompt += `--- git status ---\n${new TextDecoder().decode(outStatus.stdout)}\n`;

          // Git Diff
          const pDiff = new Deno.Command("git", { args: ["diff"], cwd: workDir, stdout: "piped", stderr: "piped" });
          const outDiff = await pDiff.output();
          const diffText = new TextDecoder().decode(outDiff.stdout);
          if (diffText.trim().length > 0) {
            fullPrompt += `--- git diff ---\n${diffText.substring(0, 20000)}\n`; // Limit diff size
          } else {
            fullPrompt += `--- git diff ---\n(No changes)\n`;
          }
          fullPrompt += `===================\n`;

        } catch (e) {
          console.error("Error getting git context:", e);
          fullPrompt += `\n(Error getting git context: ${e.message})\n`;
        }
      }

      // SECURITY: Always use gcloud OAuth for Antigravity agents (secure Google login)
      // Call Antigravity CLI with streaming
      result = await sendToAntigravityCLI(
        fullPrompt,
        controller,
        {
          model: agent.model,
          workspace: agent.workspace,
          force: agent.force,
          sandbox: agent.sandbox,
          streamJson: true,
          authorized: true, // Always use gcloud OAuth for Antigravity agents
        },
        async (chunk) => {
          currentChunk += chunk;

          const now = Date.now();
          if (now - lastUpdate >= UPDATE_INTERVAL && deps?.sendClaudeMessages) {
            lastUpdate = now;

            const claudeMessages = [{
              type: 'text' as const,
              content: currentChunk,
              timestamp: new Date().toISOString()
            }];

            await deps.sendClaudeMessages(claudeMessages).catch(() => { });
            currentChunk = "";
          }
        }
      );
    }

    // Send final chunk if there's any remaining content
    if (currentChunk && deps?.sendClaudeMessages) {
      const claudeMessages = [{
        type: 'text' as const,
        content: currentChunk,
        timestamp: new Date().toISOString()
      }];
      await deps.sendClaudeMessages(claudeMessages).catch(() => { });
    }

    // Notify user if fallback was used (before processing response)
    if (fallbackUsed && result?.response) {
      const providerUsed = result.modelUsed?.includes('Cursor') || result.modelUsed?.includes('cursor') ? 'Cursor' : 
                          result.modelUsed?.includes('Gemini') || result.modelUsed?.includes('gemini') ? 'Antigravity (Gemini)' : 
                          result.modelUsed || 'Fallback Provider';
      console.log(`✅ Successfully completed using ${providerUsed} as fallback provider`);
    }

    // Check for GitHub issue creation request before processing response
    const fullResponse = result.response || '';
    const githubIssueRequest = parseGitHubIssueRequest(fullResponse);
    
    if (githubIssueRequest && githubIssueRequest.action === 'create_github_issue') {
      // Intercept and execute GitHub issue creation
      try {
        const { createGitHubIssueWithCLI } = await import("../util/github-issues.ts");
        const issueResult = await createGitHubIssueWithCLI({
          title: githubIssueRequest.title!,
          body: githubIssueRequest.body!,
          labels: githubIssueRequest.labels,
          assignees: githubIssueRequest.assignees,
          milestone: githubIssueRequest.milestone,
          project: githubIssueRequest.project
        });

        if (issueResult.success) {
          const successMessage = `✅ **GitHub Issue Created Successfully!**\n\n` +
            `**Issue #${issueResult.issueNumber}**: ${githubIssueRequest.title}\n\n` +
            `The issue has been created in the repository.`;
          
          // Save to history
          if (sessionData && sessionData.session) {
            sessionData.session.history.push({ role: 'model', content: successMessage });
          }

          await ctx.editReply({
            embeds: [{
              color: 0x00ff00,
              title: `✅ ${agent.name} - GitHub Issue Created`,
              description: successMessage,
              fields: [
                { name: 'Issue Number', value: `#${issueResult.issueNumber}`, inline: true },
                { name: 'Title', value: githubIssueRequest.title!, inline: false }
              ],
              timestamp: new Date().toISOString()
            }]
          });
          return; // Exit early, don't process the original response
        } else {
          const errorMessage = `❌ **Failed to Create GitHub Issue**\n\n` +
            `Error: ${issueResult.error || 'Unknown error'}\n\n` +
            `Please check that:\n` +
            `- GitHub CLI (gh) is installed and authenticated\n` +
            `- You are in a Git repository\n` +
            `- You have permissions to create issues`;
          
          // Save to history
          if (sessionData && sessionData.session) {
            sessionData.session.history.push({ role: 'model', content: errorMessage });
          }

          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: `❌ ${agent.name} - GitHub Issue Creation Failed`,
              description: errorMessage,
              timestamp: new Date().toISOString()
            }]
          });
          return; // Exit early
        }
      } catch (error) {
        const errorMessage = `❌ **Error Creating GitHub Issue**\n\n${error}`;
        if (sessionData && sessionData.session) {
          sessionData.session.history.push({ role: 'model', content: errorMessage });
        }
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: `❌ ${agent.name} - Error`,
            description: errorMessage,
            timestamp: new Date().toISOString()
          }]
        });
        return;
      }
    }

    // Save response to session history
    if (sessionData && sessionData.session && result.response) {
      sessionData.session.history.push({ role: 'model', content: result.response });
    }
    
    // Sync conversation to file (for all agent types)
    try {
      const { addMessage } = await import("../util/conversation-sync.ts");
      // Save user message (if not already saved by Cursor handler)
      if (clientType !== 'cursor') {
        await addMessage(userId, channelId, activeAgentName, 'user', message, 'discord');
      }
      // Save assistant response (if not already saved by Cursor handler)
      if (result.response && clientType !== 'cursor') {
        const source = clientType === 'antigravity' ? 'antigravity' : 'discord';
        await addMessage(userId, channelId, activeAgentName, 'assistant', result.response, source as any);
      }
      console.log(`[ConversationSync] Synced to data/conversations/`);
    } catch (syncError) {
      console.debug("[ConversationSync] Sync failed:", syncError);
    }

    // Truncate response if too long and add expand button
    // Use embed description limit since we're using embeds
    const MAX_DESCRIPTION_LENGTH = DISCORD_LIMITS.EMBED_DESCRIPTION - 200; // Leave room for other embed fields
    // fullResponse already declared above for GitHub issue check
    let displayResponse = fullResponse;
    let isTruncated = false;
    
    if (fullResponse.length > MAX_DESCRIPTION_LENGTH) {
      displayResponse = fullResponse.substring(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
      isTruncated = true;
    }

    // Send completion message
    const completionFields = [
      { name: 'Client', value: clientType === 'cursor' ? '🖱️ Cursor' : clientType === 'antigravity' ? '🌌 Antigravity' : '🤖 Claude', inline: true },
      { name: 'Model', value: result.modelUsed || agent.model, inline: true },
      { name: 'Duration', value: result.duration ? `${(result.duration / 1000).toFixed(1)}s` : 'N/A', inline: true },
    ];

    // Add cost for Claude (not applicable to Cursor)
    if (clientType === 'claude' && 'cost' in result && typeof result.cost === 'number') {
      completionFields.splice(2, 0, { name: 'Cost', value: `$${result.cost.toFixed(4)}`, inline: true });
    }

    // Add chatId for Cursor/Antigravity (for session resumption)
    if ((clientType === 'cursor' || clientType === 'antigravity') && 'chatId' in result && typeof result.chatId === 'string') {
      completionFields.push({ name: 'Chat ID', value: result.chatId, inline: false });
    }

    // Add truncation info if needed
    if (isTruncated) {
      completionFields.push({ 
        name: 'Note', 
        value: `Response truncated (${fullResponse.length} chars). Click "📖 Show Full Response" to view complete output.`, 
        inline: false 
      });
    }

    const embedData: any = {
      color: 0x00ff00,
      title: `✅ ${agent.name} - Completed`,
      description: displayResponse,
      fields: completionFields,
      timestamp: new Date().toISOString()
    };

    // Add expand button if truncated
    let componentRows: any[] | undefined = undefined;
    if (isTruncated) {
      const expandId = `agent-response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      // Store full content for expansion
      const { expandableContent } = await import("../claude/discord-sender.ts");
      expandableContent.set(expandId, fullResponse);
      
      // Use Discord.js builders for components
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import("npm:discord.js@14.14.1");
      const button = new ButtonBuilder()
        .setCustomId(`expand:${expandId}`)
        .setLabel('📖 Show Full Response')
        .setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(button);
      componentRows = [row];
    }

    await ctx.editReply({
      embeds: [embedData],
      components: componentRows
    });

  } catch (error) {
    const clientType = agent.client || 'claude';
    console.error(`[Agent] Error calling ${clientType}:`, error);
    
    // Provide user-friendly error messages
    let errorMessage = String(error);
    if (errorMessage.includes("ConnectError") || errorMessage.includes("[canceled]")) {
      if (errorMessage.includes("timeout") || errorMessage.includes("too long")) {
        errorMessage = "⏱️ Request timed out. The operation took too long and was cancelled. Try breaking your request into smaller tasks or using a faster model.";
      } else {
        errorMessage = "🔌 Connection cancelled. This may be due to network issues. Please try again in a moment.";
      }
    } else if (errorMessage.includes("exited with code 1")) {
      errorMessage = "❌ Cursor CLI encountered an error. This might be a temporary issue - please try again.";
    }
    
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: `❌ Agent Error (${clientType === 'cursor' ? 'Cursor' : 'Claude'})`,
        description: `Failed to process: ${errorMessage}`,
        timestamp: new Date().toISOString()
      }]
    });
  }
}

async function showAgentStatus(ctx: any) {
  const userId = ctx.user.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  const activeAgents = getActiveAgents(userId, channelId);
  const activeSessions = agentSessions.filter(s => s.status === 'active' && s.userId === userId && s.channelId === channelId);

  const activeAgentNames = activeAgents.length > 0 
    ? activeAgents.map(a => PREDEFINED_AGENTS[a]?.name || a).join(', ')
    : 'None';

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '📊 Agent Status',
      fields: [
        {
          name: 'Active Agents',
          value: activeAgentNames,
          inline: false
        },
        {
          name: 'Active Sessions',
          value: activeSessions.length.toString(),
          inline: true
        },
        {
          name: 'Total Agents',
          value: Object.keys(PREDEFINED_AGENTS).length.toString(),
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

async function showAgentInfo(ctx: any, agentName: string) {
  const agent = PREDEFINED_AGENTS[agentName];
  if (!agent) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Agent Not Found',
        description: `No agent found with name: ${agentName}`,
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  const riskColor = agent.riskLevel === 'high' ? 0xff6600 : agent.riskLevel === 'medium' ? 0xffaa00 : 0x00ff00;

  await ctx.editReply({
    embeds: [{
      color: riskColor,
      title: `🤖 ${agent.name}`,
      description: agent.description,
      fields: [
        { name: 'Model', value: agent.model, inline: true },
        { name: 'Temperature', value: agent.temperature.toString(), inline: true },
        { name: 'Risk Level', value: agent.riskLevel.toUpperCase(), inline: true },
        { name: 'Max Tokens', value: agent.maxTokens.toString(), inline: true },
        { name: 'Capabilities', value: agent.capabilities.join(', '), inline: false },
        { name: 'System Prompt Preview', value: `\`${agent.systemPrompt.substring(0, 200)}...\``, inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

async function switchAgent(ctx: any, agentName: string) {
  const agent = PREDEFINED_AGENTS[agentName];
  if (!agent) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Agent Not Found',
        description: `No agent found with name: ${agentName}`,
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  const userId = ctx.user.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  const previousAgents = getActiveAgents(userId, channelId);
  // For switch, we replace all active agents with the new one
  removeActiveAgent(userId, channelId);
  addActiveAgent(userId, channelId, agentName);

  const previousAgentNames = previousAgents.length > 0 
    ? previousAgents.map(a => PREDEFINED_AGENTS[a]?.name || a).join(', ')
    : 'None';

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '🔄 Agent Switched',
      fields: [
        { name: 'Previous Agent(s)', value: previousAgentNames, inline: true },
        { name: 'New Agent', value: agent.name, inline: true },
        { name: 'Ready', value: 'Use `/agent action:chat` to start chatting', inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

async function endAgentSession(ctx: any) {
  const userId = ctx.user.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  const activeAgents = getActiveAgents(userId, channelId);

  if (activeAgents.length === 0) {
    await ctx.editReply({
      embeds: [{
        color: 0xffaa00,
        title: '⚠️ No Active Session',
        description: 'No active agent session to end.',
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  const agentNames = activeAgents.map(a => PREDEFINED_AGENTS[a]?.name || a).join(', ');
  removeActiveAgent(userId, channelId);

  // Mark sessions as completed
  agentSessions.forEach(session => {
    if (session.userId === userId && session.channelId === channelId && session.status === 'active') {
      session.status = 'completed';
    }
  });

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '🛑 Agent(s) Stopped',
      description: `The **${agentNames}** session(s) have been terminated.\n\nUse \`/run\` to start a new session.`,
      timestamp: new Date().toISOString()
    }]
  });
}

// (Removed duplicate getActiveSession)

export function setAgentSession(userId: string, channelId: string, agentName: string) {
  addActiveAgent(userId, channelId, agentName);
  const session: AgentSession = {
    id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    agentName,
    userId,
    channelId,
    startTime: new Date(),
    messageCount: 0,
    totalCost: 0,
    lastActivity: new Date(),
    status: 'active',
    history: []
  };
  agentSessions.push(session);
}

export function clearAgentSession(userId: string, channelId: string) {
  removeActiveAgent(userId, channelId);
  agentSessions.forEach(session => {
    if (session.userId === userId && session.channelId === channelId && session.status === 'active') {
      session.status = 'completed';
    }
  });
}

// Utility functions
export function generateSessionId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get active agent session for a user/channel (for natural chat flow)
export function getActiveSession(userId: string, channelId: string): { session: AgentSession; agentName: string } | null {
  console.log(`[getActiveSession] Looking for session: userId=${userId}, channelId=${channelId}`);
  console.log(`[getActiveSession] Total sessions:`, agentSessions.length);
  agentSessions.forEach((s, i) => {
    console.log(`[getActiveSession] Session ${i}: userId=${s.userId}, channelId=${s.channelId}, status=${s.status}, agent=${s.agentName}`);
  });

  const activeAgents = getActiveAgents(userId, channelId);
  const session = agentSessions.find(
    s => s.userId === userId && s.channelId === channelId && s.status === 'active'
  );

  if (session && activeAgents.length > 0) {
    // Return the session with the first active agent (or the session's agent if it matches)
    const agentName = activeAgents.includes(session.agentName) ? session.agentName : activeAgents[0];
    console.log(`[getActiveSession] Found session! agentName=${agentName}, activeAgents=${activeAgents.join(', ')}`);
    return { session, agentName };
  }

  console.log(`[getActiveSession] No active session found`);
  return null;
}

// ==========================================
// Manager Agent Implementation
// ==========================================

export async function handleManagerInteraction(
  ctx: any,
  userMessage: string,
  agentConfig: AgentConfig,
  deps?: AgentHandlerDeps
) {
  // Use tested model if available
  if (agentConfig.client === 'antigravity') {
    try {
      const { getBestAvailableModel } = await import("../util/model-tester.ts");
      const fallbackModels = ['gemini-3-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      agentConfig.model = getBestAvailableModel(agentConfig.model, fallbackModels);
    } catch (error) {
      console.warn('[Manager] Could not get tested model, using configured model:', error);
    }
  }

  // 1. Initial acknowledgment (invisible update to change state)
  await ctx.editReply({
    embeds: [{
      color: 0x9900ff, // Purple for Manager
      title: '🧠 Manager Thinking...',
      description: 'Analyzing request...',
      timestamp: new Date().toISOString()
    }]
  });

  try {
    // 2. Call Manager (Gemini Flash)
    // We reuse the Antigravity client directly here
    const { sendToAntigravityCLI } = await import("../claude/antigravity-client.ts");

    // Retrieve Session for History
    const userId = ctx.user.id;
    const channelId = ctx.channelId || ctx.channel?.id;
    const sessionData = getActiveSession(userId, channelId);
    let historyPrompt = "";

    // SECURITY: Always use gcloud OAuth for Antigravity agents (secure Google login)
    // No need to check owner - all Antigravity agents use secure Google authentication

    if (sessionData && sessionData.session) {
      // Append current user message to history
      sessionData.session.history.push({ role: 'user', content: userMessage });

      // Build History String with XML-style tags and escaping to prevent injection
      historyPrompt = "<conversation_history>\n";
      for (const msg of sessionData.session.history) {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        const safeContent = msg.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        historyPrompt += `  <entry role="${role}">${safeContent}</entry>\n`;
      }
      historyPrompt += "</conversation_history>\n";
    } else {
      // Fallback if no session (shouldn't happen if properly started)
      const safeContent = userMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      historyPrompt = `<conversation_history>\n  <entry role="user">${safeContent}</entry>\n</conversation_history>\n`;
    }

    // Inject .agent-context.md files into prompt (since Gemini doesn't have tool access)
    let contextContent = "";
    try {
      const workDir = deps?.workDir || Deno.cwd();
      const rootContextPath = `${workDir}/.agent-context.md`;
      const agentContextPath = `${workDir}/agent/.agent-context.md`;
      
      // Read root context
      try {
        const rootContext = await Deno.readTextFile(rootContextPath);
        contextContent += `\n\n=== ROOT AGENT CONTEXT ===\n${rootContext}\n=== END ROOT CONTEXT ===\n`;
      } catch (e) {
        console.warn('[Manager] Could not read root .agent-context.md:', e);
      }
      
      // Read agent context
      try {
        const agentContext = await Deno.readTextFile(agentContextPath);
        contextContent += `\n\n=== AGENT COMPARTMENT CONTEXT ===\n${agentContext}\n=== END AGENT CONTEXT ===\n`;
      } catch (e) {
        console.warn('[Manager] Could not read agent/.agent-context.md:', e);
      }
    } catch (error) {
      console.warn('[Manager] Error reading context files:', error);
    }
    
    // Get git repository information for manager
    let gitContext = "";
    try {
      const workDir = deps?.workDir || Deno.cwd();
      const { getGitInfo, getGitStatus } = await import("../git/handler.ts");
      
      try {
        const gitInfo = await getGitInfo(workDir);
        const gitStatus = await getGitStatus(workDir);
        
        gitContext = `\n\n=== REPOSITORY CONTEXT ===\n`;
        gitContext += `Working Directory: ${workDir}\n`;
        gitContext += `Repository: ${gitInfo.repo}\n`;
        gitContext += `Branch: ${gitInfo.branch}\n`;
        if (gitStatus.remote && gitStatus.remote !== "No remotes configured") {
          gitContext += `Remote: ${gitStatus.remote}\n`;
        }
        gitContext += `\nYou are working in a local Git repository on the user's computer.\n`;
        gitContext += `All file paths should be relative to: ${workDir}\n`;
        gitContext += `=== END REPOSITORY CONTEXT ===\n`;
      } catch (error) {
        // Not a git repo or error getting info
        gitContext = `\n\n=== WORKING DIRECTORY ===\n`;
        gitContext += `Working Directory: ${workDir}\n`;
        gitContext += `Note: This directory is not a Git repository.\n`;
        gitContext += `All file paths should be relative to: ${workDir}\n`;
        gitContext += `=== END WORKING DIRECTORY ===\n`;
      }
    } catch (error) {
      console.debug('[Manager] Error getting git context:', error);
    }
    
    // Get MCP tools information
    let mcpToolsInfo = "";
    try {
      const { getMCPToolsInfo } = await import("../util/mcp-client.ts");
      mcpToolsInfo = await getMCPToolsInfo();
    } catch (error) {
      console.debug('[Manager] Error getting MCP tools info:', error);
    }
    
    // Construct Prompt
    const managerPrompt = `${agentConfig.systemPrompt}${contextContent}${gitContext}${mcpToolsInfo}\n\n=== CONVERSATION HISTORY ===\n${historyPrompt}\n\n=== END HISTORY ===\n\n(Respond to the last User message)`;
    const controller = new AbortController();

    // SECURITY: Always use gcloud OAuth for Antigravity agents (secure Google login)
    const response = await sendToAntigravityCLI(
      managerPrompt,
      controller,
      {
        model: agentConfig.model,
        streamJson: false, // We need full JSON block, not streaming text for logic
        authorized: true, // Always use gcloud OAuth for Antigravity agents
      }
    );

    const fullResponse = response.response;
    const action = parseManagerResponse(fullResponse);

    if (!action) {
      // Fallback - use embeds to handle long content properly
      const chunks = splitText(fullResponse, DISCORD_LIMITS.EMBED_DESCRIPTION, true);
      if (chunks.length === 1) {
        await ctx.editReply({ 
          embeds: [{
            color: 0x0099ff,
            title: 'Manager Response',
            description: chunks[0],
            timestamp: new Date().toISOString()
          }]
        });
      } else {
        // Send first chunk as edit, rest as follow-ups
        await ctx.editReply({ 
          embeds: [{
            color: 0x0099ff,
            title: `Manager Response (1/${chunks.length})`,
            description: chunks[0],
            timestamp: new Date().toISOString()
          }]
        });
        for (let i = 1; i < chunks.length; i++) {
          await ctx.followUp({
            embeds: [{
              color: 0x0099ff,
              title: `Manager Response (${i + 1}/${chunks.length})`,
              description: chunks[i],
              timestamp: new Date().toISOString()
            }]
          });
        }
      }
      return;
    }

    // 3. Handle Action
    if (action.action === 'create_github_issue' && action.title && action.body) {
      // GitHub Issue Creation
      try {
        const { createGitHubIssueWithCLI } = await import("../util/github-issues.ts");
        const issueResult = await createGitHubIssueWithCLI({
          title: action.title,
          body: action.body,
          labels: action.labels || []
        });

        if (issueResult.success) {
          const successMessage = `✅ **GitHub Issue Created Successfully!**\n\n` +
            `**Issue #${issueResult.issueNumber}**: ${action.title}\n\n` +
            `The issue has been created in the repository.`;
          
          if (sessionData && sessionData.session) {
            sessionData.session.history.push({ role: 'model', content: successMessage });
          }

          await ctx.editReply({
            embeds: [{
              color: 0x00ff00,
              title: '✅ Manager - GitHub Issue Created',
              description: successMessage,
              fields: [
                { name: 'Issue Number', value: `#${issueResult.issueNumber}`, inline: true },
                { name: 'Title', value: action.title, inline: false }
              ],
              timestamp: new Date().toISOString()
            }]
          });
        } else {
          const errorMessage = `❌ **Failed to Create GitHub Issue**\n\n` +
            `Error: ${issueResult.error || 'Unknown error'}\n\n` +
            `Please check that:\n` +
            `- GitHub CLI (gh) is installed and authenticated\n` +
            `- You are in a Git repository\n` +
            `- You have permissions to create issues`;
          
          if (sessionData && sessionData.session) {
            sessionData.session.history.push({ role: 'model', content: errorMessage });
          }

          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: '❌ Manager - GitHub Issue Creation Failed',
              description: errorMessage,
              timestamp: new Date().toISOString()
            }]
          });
        }
      } catch (error) {
        const errorMessage = `❌ **Error Creating GitHub Issue**\n\n${error}`;
        if (sessionData && sessionData.session) {
          sessionData.session.history.push({ role: 'model', content: errorMessage });
        }
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Manager - Error',
            description: errorMessage,
            timestamp: new Date().toISOString()
          }]
        });
      }
    } else if (action.action === 'reply' && action.message) {
      // Direct Reply
      if (sessionData && sessionData.session) {
        sessionData.session.history.push({ role: 'model', content: action.message });
      }

      await ctx.editReply({
        embeds: [{
          color: 0x00cc99, // Teal for direct reply
          title: '💬 Manager',
          description: action.message,
          timestamp: new Date().toISOString()
        }]
      });
    } else if (action.action === 'spawn_agent' && action.agent_name && action.task) {
      // Switch to the new agent and have it take over
      const subAgentName = action.agent_name;
      const subAgentTask = action.task;
      const subAgentConfig = PREDEFINED_AGENTS[subAgentName];

      if (!subAgentConfig) {
        await ctx.editReply({ content: `Manager tried to spawn unknown agent: ${subAgentName}` });
        return;
      }

      // Security: RBAC for High-Risk Agents
      const ownerId = Deno.env.get("OWNER_ID") || Deno.env.get("DEFAULT_MENTION_USER_ID");
      if (subAgentConfig.riskLevel === 'high' && ownerId && userId !== ownerId) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '⛔ Access Denied',
            description: `Agent **${subAgentConfig.name}** is a high-risk agent and can only be used by the bot owner.`,
            footer: { text: "Security policy: Restricted access enabled" },
            timestamp: new Date().toISOString()
          }]
        });
        return;
      }

      // Spawn the new agent (add it to active agents, don't replace)
      const channelId = ctx.channelId || ctx.channel?.id;
      addActiveAgent(userId, channelId, subAgentName);

      // Create a new session for the spawned agent (don't replace existing sessions)
      const newSession: AgentSession = {
        id: generateSessionId(),
        agentName: subAgentName,
        userId,
        channelId: channelId!,
        startTime: new Date(),
        messageCount: 0,
        totalCost: 0,
        lastActivity: new Date(),
        status: 'active',
        history: []
      };

      // Add the original user message and task to history
      if (sessionData && sessionData.session) {
        newSession.history = [...sessionData.session.history];
      }
      newSession.history.push({ role: 'user', content: userMessage });
      agentSessions.push(newSession);

      // Get list of all active agents for this user/channel
      const activeAgents = getActiveAgents(userId, channelId);
      const activeAgentNames = activeAgents.map(a => PREDEFINED_AGENTS[a]?.name || a).join(', ');

      // Notify user that agent is spawning (not switching)
      await ctx.editReply({
        embeds: [{
          color: 0x00cc99,
          title: '🚀 Spawning Agent',
          description: `**${agentConfig.name}** is spawning **${subAgentConfig.name}** to handle this task.\n\n**Task:** ${subAgentTask}\n\n**Active Agents:** ${activeAgentNames}`,
          fields: [
            { name: 'New Agent', value: subAgentConfig.name, inline: true },
            { name: 'Status', value: '🔄 Running concurrently...', inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      });

      // Now have the new agent process the task
      // We'll use the task as the message, but include the original user message for context
      const agentMessage = `${subAgentTask}\n\nOriginal request: ${userMessage}`;
      
      // Call chatWithAgent with the new agent
      await chatWithAgent(ctx, agentMessage, subAgentName, undefined, false, deps);
      return;
    }
  } catch (error) {
    console.error("Manager Error:", error);
    await ctx.editReply({
      content: `Manager crashed: ${error}`
    });
  }
}

// --- Simple Commands Implementation ---
export const runCommand = new SlashCommandBuilder()
  .setName('run')
  .setDescription('Start a helper agent that will guide you through your task');

export const killCommand = new SlashCommandBuilder()
  .setName('kill')
  .setDescription('Stop the current active agent session');

export const syncCommand = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('Open the current conversation in an IDE (Cursor, VS Code, etc.)');

export const runAdvCommand = new SlashCommandBuilder()
  .setName('run-adv')
  .setDescription('Advanced agent runner with provider, role, and model selection');

export const simpleCommands = [runCommand, killCommand, syncCommand, runAdvCommand];

// Role definitions with agents
export interface RoleDefinition {
  name: string;
  description: string;
  agents: Array<{ id: string; name: string; description: string }>;
}

export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  builder: {
    name: 'Builder',
    description: 'Agents specialized in building and creating code',
    agents: [
      { id: 'cursor-coder', name: 'Cursor Coder', description: 'Autonomous code building with Cursor' },
      { id: 'ag-coder', name: 'Antigravity Coder', description: 'Code building with Antigravity/Gemini' }
    ]
  },
  tester: {
    name: 'Tester',
    description: 'Agents specialized in testing and quality assurance',
    agents: [
      { id: 'code-reviewer', name: 'Code Reviewer', description: 'Code review and quality analysis' },
      { id: 'debugger', name: 'Debug Specialist', description: 'Bug finding and fixing' }
    ]
  },
  investigator: {
    name: 'Investigator',
    description: 'Agents specialized in investigation and analysis',
    agents: [
      { id: 'security-expert', name: 'Security Analyst', description: 'Security analysis and vulnerability assessment' },
      { id: 'architect', name: 'Software Architect', description: 'System design and architecture analysis' }
    ]
  }
};

export async function handleSimpleCommand(ctx: any, commandName: string, deps: AgentHandlerDeps) {
  // Map simple commands to agent actions
  const handlers = createAgentHandlers(deps);
  
  if (commandName === 'run') {
    // Show provider/model selection menu
    await ctx.deferReply({ ephemeral: false });
    
    // Get available models dynamically from API
    const { getModelsForAgents } = await import("../util/list-models.ts");
    const { manager: managerModels, coder: coderModels, architect: architectModels } = await getModelsForAgents();
    
    // Get webhook configurations
    const { SettingsPersistence } = await import("../util/settings-persistence.ts");
    const settings = SettingsPersistence.getInstance().getSettings();
    const enabledWebhooks = (settings.webhooks || []).filter((w: any) => w.enabled);
    
    // Build available agents list from API results
    const availableAgents: Array<{ name: string; label: string; description: string; model: string; type: 'agent' | 'webhook' }> = [];
    
    // Track added model+agent combos to prevent duplicates
    const addedOptions = new Set<string>();
    
    // === DIRECT AGENT OPTIONS (Cursor & Antigravity) ===
    // These are always available, regardless of webhooks
    
    // Cursor Coder Agent (direct)
    availableAgents.push({
      name: 'cursor-coder',
      label: '💻 Cursor Coder Agent',
      description: 'Direct Cursor agent for coding tasks',
      model: 'auto', // Use 'auto' to let Cursor pick the best model
      type: 'agent'
    });
    addedOptions.add('agent:cursor-coder:auto');
    
    // Antigravity Coder Agent (direct)
    availableAgents.push({
      name: 'ag-coder',
      label: '🚀 Antigravity Coder Agent',
      description: 'Direct Antigravity agent for coding',
      model: 'gemini-3-flash', // Use Gemini model for Antigravity
      type: 'agent'
    });
    addedOptions.add('agent:ag-coder:gemini-3-flash');
    
    // === GEMINI MODEL OPTIONS ===
    // Manager agent - pick ONE best model to avoid duplicates
    if (managerModels.length > 0) {
      const model = managerModels[0]; // Best manager model
      const key = `agent:ag-manager:${model.name}`;
      if (!addedOptions.has(key)) {
        availableAgents.push({
          name: 'ag-manager',
          label: `🤖 Manager Agent (${model.displayName})`,
          description: 'Orchestrates tasks - Fast and efficient',
          model: model.name,
          type: 'agent'
        });
        addedOptions.add(key);
      }
    }
    
    // Coder agent with Gemini - pick best model that's different
    const coderGeminiModel = coderModels.find(m => !addedOptions.has(`agent:ag-coder-gemini:${m.name}`));
    if (coderGeminiModel) {
      const key = `agent:ag-coder-gemini:${coderGeminiModel.name}`;
      availableAgents.push({
        name: 'ag-coder-gemini',
        label: `💻 Gemini Coder (${coderGeminiModel.displayName})`,
        description: 'Gemini-powered coding agent',
        model: coderGeminiModel.name,
        type: 'agent'
      });
      addedOptions.add(key);
    }
    
    // Architect agent - pick best model
    if (architectModels.length > 0) {
      const model = architectModels[0];
      const key = `agent:ag-architect:${model.name}`;
      if (!addedOptions.has(key)) {
        availableAgents.push({
          name: 'ag-architect',
          label: `🏗️ Architect Agent (${model.displayName})`,
          description: 'System design and planning',
          model: model.name,
          type: 'agent'
        });
        addedOptions.add(key);
      }
    }
    
    // === WEBHOOK OPTIONS ===
    // Add ALL enabled webhooks with appropriate icons
    for (const webhook of enabledWebhooks) {
      const webhookName = webhook.name.toLowerCase();
      let icon = '🔗';
      let modelType = 'webhook';
      
      if (webhookName.includes('cursor')) {
        icon = '💻';
        modelType = 'cursor';
      } else if (webhookName.includes('antigravity') || webhookName.includes('gemini') || webhookName.includes('ag')) {
        icon = '🚀';
        modelType = 'antigravity';
      }
      
      const key = `webhook:webhook:${webhook.id}:${webhook.id}`;
      if (!addedOptions.has(key)) {
        availableAgents.push({
          name: `webhook:${webhook.id}`,
          label: `${icon} Webhook: ${webhook.name}`,
          description: `Start agent via ${webhook.name} webhook`,
          model: modelType,
          type: 'webhook'
        });
        addedOptions.add(key);
      }
    }
    
    // Fallback if no agents available
    if (availableAgents.length === 0) {
      availableAgents.push(
        { name: 'cursor-coder', label: '💻 Cursor Coder Agent', description: 'Direct Cursor agent', model: 'auto', type: 'agent' },
        { name: 'ag-coder', label: '🚀 Antigravity Coder Agent', description: 'Direct Antigravity agent', model: 'gemini-3-flash', type: 'agent' },
        { name: 'ag-manager', label: '🤖 Manager Agent (Default)', description: 'Helper agent', model: 'gemini-3-flash', type: 'agent' }
      );
    }
    
    // Create select menu for provider/model selection using Discord.js components
    const { StringSelectMenuBuilder, ActionRowBuilder } = await import("npm:discord.js@14.14.1");
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select-agent-model')
      .setPlaceholder('Choose an agent and model...')
      .addOptions(
        availableAgents.map(agent => ({
          label: String(agent.label).substring(0, 100), // Discord limit - ensure string
          description: String(agent.description).substring(0, 100), // Discord limit - ensure string
          value: String(`${agent.type}:${agent.name}:${agent.model}`) // Include type: agent or webhook
        }))
      );
    
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    
    await ctx.editReply({
      embeds: [{
        color: 0x5865F2,
        title: '🚀 Start Helper Agent',
        description: 'Choose which agent and model you want to use:',
        fields: [
          { name: '💻 Cursor / Antigravity', value: 'Direct integration with Cursor IDE or Antigravity agents', inline: false },
          { name: '🤖 Gemini Agents', value: 'Manager, Coder, and Architect agents powered by Gemini', inline: false },
          { name: '🔗 Webhooks', value: enabledWebhooks.length > 0 ? `${enabledWebhooks.length} webhook(s) configured` : 'No webhooks configured', inline: false }
        ],
        footer: { text: 'Select an option below to start' },
        timestamp: true
      }],
      components: [row]
    });
    
    return;
  } else if (commandName === 'kill') {
    return await handlers.onAgent(ctx, 'end');
  } else if (commandName === 'sync') {
    // Open conversation in IDE
    await ctx.deferReply({ ephemeral: true });
    
    const userId = ctx.user.id;
    const channelId = ctx.channelId || ctx.channel?.id;
    
    // Check for active session
    const sessionData = getActiveSession(userId, channelId);
    
    // Load conversation file
    const { loadConversation, exportToMarkdown } = await import("../util/conversation-sync.ts");
    const conversation = await loadConversation(userId, channelId, sessionData?.agentName || 'unknown');
    
    if (conversation.messages.length === 0) {
      await ctx.editReply({
        embeds: [{
          color: 0xffaa00,
          title: '⚠️ No Conversation Found',
          description: 'Start a conversation with `/run` first, then use `/sync` to open it in your IDE.',
          timestamp: new Date().toISOString()
        }]
      });
      return;
    }
    
    // Export to markdown and get path
    const mdPath = await exportToMarkdown(conversation);
    const absolutePath = `${Deno.cwd()}/${mdPath}`;
    
    // Detect available IDEs
    const ideOptions: Array<{ name: string; command: string; available: boolean }> = [];
    
    // Check for Cursor
    try {
      const cursorCheck = new Deno.Command("which", { args: ["cursor"], stdout: "null", stderr: "null" });
      const cursorResult = await cursorCheck.output();
      ideOptions.push({ name: "Cursor", command: `cursor "${absolutePath}"`, available: cursorResult.success });
    } catch { ideOptions.push({ name: "Cursor", command: "", available: false }); }
    
    // Check for VS Code
    try {
      const codeCheck = new Deno.Command("which", { args: ["code"], stdout: "null", stderr: "null" });
      const codeResult = await codeCheck.output();
      ideOptions.push({ name: "VS Code", command: `code "${absolutePath}"`, available: codeResult.success });
    } catch { ideOptions.push({ name: "VS Code", command: "", available: false }); }
    
    // Check for Zed
    try {
      const zedCheck = new Deno.Command("which", { args: ["zed"], stdout: "null", stderr: "null" });
      const zedResult = await zedCheck.output();
      ideOptions.push({ name: "Zed", command: `zed "${absolutePath}"`, available: zedResult.success });
    } catch { ideOptions.push({ name: "Zed", command: "", available: false }); }
    
    // Check for Windsurf
    try {
      const windsurfCheck = new Deno.Command("which", { args: ["windsurf"], stdout: "null", stderr: "null" });
      const windsurfResult = await windsurfCheck.output();
      ideOptions.push({ name: "Windsurf", command: `windsurf "${absolutePath}"`, available: windsurfResult.success });
    } catch { ideOptions.push({ name: "Windsurf", command: "", available: false }); }
    
    const availableIDEs = ideOptions.filter(ide => ide.available);
    
    if (availableIDEs.length === 0) {
      await ctx.editReply({
        embeds: [{
          color: 0xff0000,
          title: '❌ No Compatible IDEs Found',
          description: 'No compatible IDEs detected. Install Cursor, VS Code, Zed, or Windsurf.',
          fields: [
            { name: 'Conversation File', value: `\`${mdPath}\``, inline: false }
          ],
          timestamp: new Date().toISOString()
        }]
      });
      return;
    }
    
    // Build select menu for IDE selection
    const { StringSelectMenuBuilder, ActionRowBuilder } = await import("npm:discord.js@14.14.1");
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select-ide-sync')
      .setPlaceholder('Choose an IDE to open the conversation...')
      .addOptions(
        availableIDEs.map(ide => ({
          label: `📝 Open in ${ide.name}`,
          description: `Open conversation file in ${ide.name}`,
          value: `ide:${ide.name.toLowerCase()}:${absolutePath}`
        }))
      );
    
    const row = new ActionRowBuilder<typeof StringSelectMenuBuilder>().addComponents(selectMenu);
    
    // Include resume command if Cursor session exists
    const resumeInfo = conversation.cursorSessionId 
      ? `\n\n**Resume in CLI:**\n\`\`\`bash\ncursor agent --resume ${conversation.cursorSessionId} "continue"\n\`\`\``
      : '';
    
    await ctx.editReply({
      embeds: [{
        color: 0x5865F2,
        title: '🔄 Sync Conversation to IDE',
        description: `**${conversation.messages.length} messages** in this conversation.\n\nSelect an IDE below to open the conversation file.${resumeInfo}`,
        fields: [
          { name: 'Agent', value: conversation.agentName, inline: true },
          { name: 'File', value: `\`${mdPath}\``, inline: true },
          { name: 'Available IDEs', value: availableIDEs.map(i => i.name).join(', '), inline: false }
        ],
        timestamp: new Date().toISOString()
      }],
      components: [row]
    });
    
    return;
  } else if (commandName === 'run-adv') {
    // Advanced run command with multi-step selection
    await ctx.deferReply({ ephemeral: false });
    
    // Step 1: Provider selection
    const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder } = await import("npm:discord.js@14.14.1");
    
    const providerMenu = new StringSelectMenuBuilder()
      .setCustomId('run-adv-provider')
      .setPlaceholder('Select a provider...')
      .addOptions([
        { label: '💻 Cursor', description: 'Cursor IDE integration', value: 'cursor' },
        { label: '🤖 Claude CLI', description: 'Anthropic Claude CLI', value: 'claude-cli' },
        { label: '🚀 Gemini API', description: 'Google Gemini API', value: 'gemini-api' },
        { label: '⚡ Antigravity', description: 'Google Antigravity platform', value: 'antigravity' },
        { label: '🦙 Ollama', description: 'Local Ollama LLM server', value: 'ollama' }
      ]);
    
    const providerRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(providerMenu);
    
    await ctx.editReply({
      embeds: [{
        color: 0x5865F2,
        title: '🚀 Advanced Agent Runner',
        description: '**Step 1 of 3: Select Provider**\n\nChoose which provider you want to use:',
        fields: [
          { name: '💻 Cursor', value: 'Direct integration with Cursor IDE', inline: true },
          { name: '🤖 Claude CLI', value: 'Anthropic Claude via CLI', inline: true },
          { name: '🚀 Gemini API', value: 'Google Gemini API', inline: true },
          { name: '⚡ Antigravity', value: 'Google Antigravity platform', inline: true },
          { name: '🦙 Ollama', value: 'Local Ollama LLM server', inline: true }
        ],
        footer: { text: 'Select a provider to continue' },
        timestamp: true
      }],
      components: [providerRow]
    });
    
    return;
  }
}

// API Export Functions - Expose agent data for dashboard
export function getAgentsForAPI() {
  return Object.entries(PREDEFINED_AGENTS).map(([id, agent]) => ({
    id,
    name: agent.name,
    description: agent.description,
    model: agent.model,
    capabilities: agent.capabilities,
    riskLevel: agent.riskLevel,
    client: agent.client || 'claude',
    isManager: agent.isManager || false
  }));
}

export function getSessionsForAPI() {
  const activeSessions = agentSessions.filter(s => s.status === 'active');
  const totalCost = agentSessions.reduce((acc, s) => acc + s.totalCost, 0);
  const totalMessages = agentSessions.reduce((acc, s) => acc + s.messageCount, 0);

  return {
    sessions: activeSessions.map(s => ({
      id: s.id,
      agentName: s.agentName,
      userId: s.userId,
      channelId: s.channelId,
      startTime: s.startTime.toISOString(),
      messageCount: s.messageCount,
      totalCost: s.totalCost,
      lastActivity: s.lastActivity.toISOString(),
      status: s.status,
      task: (s as any).task || undefined
    })),
    stats: {
      activeSessions: activeSessions.length,
      totalCost: parseFloat(totalCost.toFixed(6)),
      totalMessages
    }
  };
}
