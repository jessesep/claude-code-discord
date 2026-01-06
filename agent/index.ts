// Agent command implementation
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

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
  commandPath?: string; // Path to custom CLI executable (e.g. wrapper)
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
}

// Predefined agent configurations
export const PREDEFINED_AGENTS: Record<string, AgentConfig> = {
  'code-reviewer': {
    name: 'Code Reviewer',
    description: 'Specialized in code review and quality analysis',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are an expert code reviewer. Focus on code quality, security, performance, and best practices. Provide detailed feedback with specific suggestions for improvement.',
    temperature: 0.3,
    maxTokens: 4096,
    capabilities: ['code-review', 'security-analysis', 'performance-optimization'],
    riskLevel: 'low'
  },
  'architect': {
    name: 'Software Architect',
    description: 'Focused on system design and architecture decisions',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a senior software architect. Help design scalable, maintainable systems. Focus on architectural patterns, design principles, and technology choices.',
    temperature: 0.5,
    maxTokens: 4096,
    capabilities: ['system-design', 'architecture-review', 'technology-selection'],
    riskLevel: 'low'
  },
  'debugger': {
    name: 'Debug Specialist',
    description: 'Expert at finding and fixing bugs',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a debugging expert. Help identify root causes of issues, suggest debugging strategies, and provide step-by-step solutions.',
    temperature: 0.2,
    maxTokens: 4096,
    capabilities: ['bug-analysis', 'debugging', 'troubleshooting'],
    riskLevel: 'medium'
  },
  'security-expert': {
    name: 'Security Analyst',
    description: 'Specialized in security analysis and vulnerability assessment',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a cybersecurity expert. Focus on identifying security vulnerabilities, suggesting secure coding practices, and analyzing potential threats.',
    temperature: 0.1,
    maxTokens: 4096,
    capabilities: ['security-analysis', 'vulnerability-assessment', 'threat-modeling'],
    riskLevel: 'medium'
  },
  'performance-optimizer': {
    name: 'Performance Engineer',
    description: 'Expert in performance optimization and profiling',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a performance optimization expert. Help identify bottlenecks, suggest optimizations, and improve system performance.',
    temperature: 0.3,
    maxTokens: 4096,
    capabilities: ['performance-analysis', 'optimization', 'profiling'],
    riskLevel: 'medium'
  },
  'devops-engineer': {
    name: 'DevOps Engineer',
    description: 'Specialized in deployment, CI/CD, and infrastructure',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a DevOps engineer. Help with deployment strategies, CI/CD pipelines, infrastructure as code, and operational best practices.',
    temperature: 0.4,
    maxTokens: 4096,
    capabilities: ['deployment', 'ci-cd', 'infrastructure', 'monitoring'],
    riskLevel: 'high'
  },
  'general-assistant': {
    name: 'General Development Assistant',
    description: 'General-purpose development assistant',
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a helpful development assistant. Provide clear, accurate, and practical help with programming tasks, answer questions, and offer suggestions.',
    temperature: 0.7,
    maxTokens: 4096,
    capabilities: ['general-help', 'coding', 'explanation', 'guidance'],
    riskLevel: 'low'
  },

  // Cursor-powered agents (autonomous code editing)
  'cursor-coder': {
    name: 'Cursor Autonomous Coder',
    description: 'Cursor AI agent that can autonomously write and edit code',
    model: 'sonnet-4.5',
    systemPrompt: 'You are an autonomous coding agent powered by Cursor. You can read, write, and modify code files. Be thorough, write clean code, and follow best practices.',
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
    systemPrompt: 'You are a refactoring specialist. Improve code structure, readability, and maintainability while preserving functionality. Always write tests to verify behavior.',
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
    systemPrompt: 'You are a debugging expert with autonomous code editing capabilities. Investigate issues, add logging, write tests, and fix bugs. Think step-by-step.',
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
    systemPrompt: 'You are a fast coding agent. Make quick, targeted changes. Be efficient and accurate.',
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
    model: 'gemini-2.0-flash-thinking-exp',
    systemPrompt: 'You are an autonomous coding agent powered by Google Antigravity. You can plan, execute, and verify complex coding tasks.',
    temperature: 0.3,
    maxTokens: 30000,
    capabilities: ['file-editing', 'planning', 'autonomous', 'browser-interaction'],
    riskLevel: 'high',
    client: 'antigravity',
    force: false,
    sandbox: 'enabled',
    commandPath: './scripts/antigravity-wrapper.sh' // Use mock wrapper for demo
  },
  'ag-architect': {
    name: 'Antigravity Architect',
    description: 'High-level system design and planning agent',
    model: 'gemini-1.5-pro',
    systemPrompt: 'You are a software architect agent. Analyze requirements, design systems, and create implementation plans using Antigravity tools.',
    temperature: 0.4,
    maxTokens: 30000,
    capabilities: ['system-design', 'planning', 'architecture'],
    riskLevel: 'medium',
    client: 'antigravity',
    commandPath: './scripts/antigravity-wrapper.sh' // Use mock wrapper for demo
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
let currentUserAgent: Record<string, string> = {}; // userId -> agentName

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
    }
  };
}

// Helper functions for agent management
async function listAgents(ctx: any) {
  const agentList = Object.entries(PREDEFINED_AGENTS).map(([key, agent]) => {
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
  console.log(`[startSession] Creating session: userId=${userId}, channelId=${channelId}, agentName=${agentName}`);
  currentUserAgent[userId] = agentName;

  const session: AgentSession = {
    id: generateSessionId(),
    agentName,
    userId,
    channelId,
    startTime: new Date(),
    messageCount: 0,
    totalCost: 0,
    lastActivity: new Date(),
    status: 'active'
  };

  agentSessions.push(session);
  console.log(`[startSession] Session created and added. Total sessions: ${agentSessions.length}`);

  const riskColor = agent.riskLevel === 'high' ? 0xff6600 : agent.riskLevel === 'medium' ? 0xffaa00 : 0x00ff00;

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
        { name: 'Usage', value: 'Use `/agent action:chat message:[your message]` to chat with this agent', inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

async function chatWithAgent(
  ctx: any,
  message: string,
  agentName?: string,
  contextFiles?: string,
  includeSystemInfo?: boolean,
  deps?: AgentHandlerDeps
) {
  const userId = ctx.user.id;
  const activeAgentName = agentName || currentUserAgent[userId];

  if (!activeAgentName) {
    await ctx.editReply({
      embeds: [{
        color: 0xff6600,
        title: '⚠️ No Active Agent',
        description: 'No agent session active. Use `/agent action:start agent_name:[name]` to start one.',
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  const agent = PREDEFINED_AGENTS[activeAgentName];
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

  // Build the enhanced prompt with agent's system prompt
  let enhancedPrompt = `${agent.systemPrompt}\n\nUser Query: ${message}`;

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

  // Call actual Claude API with agent configuration
  try {
    // Create controller for this request
    const controller = new AbortController();

    let currentChunk = "";
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 2000; // Update Discord every 2 seconds
    let result;

    // Determine which client to use based on agent configuration
    const clientType = agent.client || 'claude'; // Default to Claude

    if (clientType === 'cursor') {
      // Import Cursor CLI client
      const { sendToCursorCLI } = await import("../claude/cursor-client.ts");

      // Build Cursor prompt combining system and user message
      const fullPrompt = `${agent.systemPrompt}\n\nTask: ${message}`;

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
    } else if (clientType === 'antigravity') {
      // Import Antigravity CLI client
      const { sendToAntigravityCLI } = await import("../claude/antigravity-client.ts");

      // Build Prompt
      const fullPrompt = `${agent.systemPrompt}\n\nTask: ${message}`;

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
          commandPath: agent.commandPath,
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
    } else {
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

    await ctx.editReply({
      embeds: [{
        color: 0x00ff00,
        title: `✅ ${agent.name} - Completed`,
        fields: completionFields,
        timestamp: new Date().toISOString()
      }]
    });

  } catch (error) {
    const clientType = agent.client || 'claude';
    console.error(`[Agent] Error calling ${clientType}:`, error);
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: `❌ Agent Error (${clientType === 'cursor' ? 'Cursor' : 'Claude'})`,
        description: `Failed to process: ${error}`,
        timestamp: new Date().toISOString()
      }]
    });
  }
}

async function showAgentStatus(ctx: any) {
  const userId = ctx.user.id;
  const activeAgent = currentUserAgent[userId];
  const activeSessions = agentSessions.filter(s => s.status === 'active');

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '📊 Agent Status',
      fields: [
        {
          name: 'Current Agent',
          value: activeAgent ? PREDEFINED_AGENTS[activeAgent]?.name || 'Unknown' : 'None',
          inline: true
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
  const previousAgent = currentUserAgent[userId];
  currentUserAgent[userId] = agentName;

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '🔄 Agent Switched',
      fields: [
        { name: 'Previous Agent', value: previousAgent ? PREDEFINED_AGENTS[previousAgent]?.name || 'None' : 'None', inline: true },
        { name: 'New Agent', value: agent.name, inline: true },
        { name: 'Ready', value: 'Use `/agent action:chat` to start chatting', inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

async function endAgentSession(ctx: any) {
  const userId = ctx.user.id;
  const activeAgent = currentUserAgent[userId];

  if (!activeAgent) {
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

  delete currentUserAgent[userId];

  // Mark sessions as completed
  agentSessions.forEach(session => {
    if (session.agentName === activeAgent && session.status === 'active') {
      session.status = 'completed';
    }
  });

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '✅ Session Ended',
      description: `Agent session with ${PREDEFINED_AGENTS[activeAgent]?.name || activeAgent} has been ended.`,
      timestamp: new Date().toISOString()
    }]
  });
}

// Utility functions
function generateSessionId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get active agent session for a user/channel (for natural chat flow)
export function getActiveSession(userId: string, channelId: string): { session: AgentSession; agentName: string } | null {
  console.log(`[getActiveSession] Looking for session: userId=${userId}, channelId=${channelId}`);
  console.log(`[getActiveSession] Total sessions:`, agentSessions.length);
  agentSessions.forEach((s, i) => {
    console.log(`[getActiveSession] Session ${i}: userId=${s.userId}, channelId=${s.channelId}, status=${s.status}, agent=${s.agentName}`);
  });

  const session = agentSessions.find(
    s => s.userId === userId && s.channelId === channelId && s.status === 'active'
  );

  if (session) {
    const agentName = currentUserAgent[userId];
    console.log(`[getActiveSession] Found session! agentName=${agentName}`);
    if (agentName) {
      return { session, agentName };
    }
  }

  console.log(`[getActiveSession] No active session found`);
  return null;
}
