import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "npm:discord.js@14.14.1";
import * as path from "https://deno.land/std/path/mod.ts";
import { AgentConfig, AgentSession, PREDEFINED_AGENTS, ROLE_DEFINITIONS, CONTEXT_NOTE, getAgentStyle } from "./types.ts";
import { MANAGER_SYSTEM_PROMPT, parseManagerResponse, parseGitHubIssueRequest, ManagerAction } from "./manager.ts";
import { AgentRegistry } from "./registry.ts";
import { DISCORD_LIMITS, splitText } from "../discord/utils.ts";
import { convertMessageContent } from "../discord/formatting.ts";
import { SwarmManager } from "../util/swarm-manager.ts";
import { 
  agentSessions, 
  currentUserAgent, 
  getUserChannelKey, 
  getActiveAgents, 
  addActiveAgent, 
  removeActiveAgent, 
  getActiveSession, 
  setAgentSession, 
  clearAgentSessions 
} from "./session-manager.ts";
import { runAgentTask, loadRoleDocument } from "./orchestrator.ts";

export interface AgentHandlerDeps {
  workDir: string;
  crashHandler: any;
  sendAgentMessages: (messages: any[]) => Promise<void>;
  sessionManager: any;
  clientOverride?: 'claude' | 'cursor' | 'antigravity' | 'ollama';
  includeGit?: boolean;
  channelContext?: import("../util/channel-context.ts").ChannelProjectContext;
  targetUserId?: string; // User to mention when done or action needed
  modelOverride?: string;
}

const pendingSwarmTasks = new Map<string, { 
  subAgentName: string, 
  task: string, 
  managerConfig: AgentConfig,
  workDir: string,
  channelId: string
}>();

/**
 * Helper to send agent updates to Discord with optional user mention
 */
async function sendAgentUpdate(
  content: string, 
  deps: AgentHandlerDeps, 
  options: { isFinal?: boolean } = {}
) {
  if (!deps.sendAgentMessages) {
    console.warn(`[AgentUpdate] SKIP: sendAgentMessages not defined`);
    return;
  }

  const agentMessages = [{
    type: 'text' as const,
    content: content,
    timestamp: new Date().toISOString()
  }];

  const actionNeededPatterns = [
    "please confirm", "need your input", "action required", 
    "waiting for response", "provide more details", "should i continue",
    "please provide", "waiting for"
  ];
  const textLower = content.toLowerCase();
  const actionNeeded = actionNeededPatterns.some(p => textLower.includes(p));
  
  if ((actionNeeded || options.isFinal) && deps.targetUserId) {
    const prefix = actionNeeded ? "⚠️ Action needed: " : "";
    (agentMessages[0] as any).content = `<@${deps.targetUserId}> ${prefix}${content}`;
  }

  await deps.sendAgentMessages(agentMessages).catch(err => { 
    console.error(`[AgentUpdate] FAILED to send messages:`, err);
  });
}

/**
 * Build enhanced agent info fields for embeds
 * Includes channel, category, session duration, and context window size
 */
function buildAgentInfoFields(
  ctx: any,
  agent: AgentConfig,
  clientType: string,
  sessionData?: { session: AgentSession } | null,
  options: { showModel?: boolean; modelUsed?: string; agentKey?: string; responseDuration?: number } = {}
): Array<{ name: string; value: string; inline: boolean }> {
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  
  // Row 1: Client, Model, Duration (3 cols)
  fields.push({ name: '🔌 Client', value: clientType.toUpperCase(), inline: true });
  if (options.showModel !== false) {
    fields.push({ name: '🧠 Model', value: options.modelUsed || agent.model, inline: true });
  }
  if (options.responseDuration) {
    const speedLabel = options.responseDuration < 3000 ? '⚡' : options.responseDuration < 10000 ? '🚀' : '⏳';
    fields.push({ name: `${speedLabel} Speed`, value: `${(options.responseDuration / 1000).toFixed(1)}s`, inline: true });
  }
  
  // Row 2: Channel & Category (2 cols)
  const channelName = ctx.channel?.name || 'DM';
  const categoryName = ctx.channel?.parent?.name || 'No Category';
  fields.push({ name: '📍 Channel', value: `#${channelName}`, inline: true });
  fields.push({ name: '📂 Category', value: categoryName, inline: true });
  
  // Row 3: Session info (if available)
  if (sessionData?.session) {
    const session = sessionData.session;
    const startTime = session.startTime instanceof Date ? session.startTime : new Date(session.startTime);
    const durationMs = Date.now() - startTime.getTime();
    const durationStr = formatDuration(durationMs);
    fields.push({ name: '⏱️ Session', value: durationStr, inline: true });
    
    const contextSize = session.history?.length || 0;
    const estimatedTokens = session.history?.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0) || 0;
    fields.push({ name: '💬 Context', value: `${contextSize} msgs (~${estimatedTokens} tokens)`, inline: true });
  }
  
  return fields;
}

/**
 * Get embed color and title for an agent
 */
function getAgentEmbed(agentName: string, agentDisplayName: string, status: 'processing' | 'completed' | 'error') {
  const style = getAgentStyle(agentName);
  
  const statusConfig = {
    processing: { suffix: 'Processing...', color: style.color },
    completed: { suffix: 'Completed', color: 0x00ff00 },
    error: { suffix: 'Error', color: 0xff0000 },
  };
  
  const config = statusConfig[status];
  const statusEmoji = status === 'processing' ? '🔄' : status === 'completed' ? '✅' : '❌';
  
  return {
    color: config.color,
    title: `${style.emoji} ${agentDisplayName} - ${statusEmoji} ${config.suffix}`,
  };
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSecs}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Format agent response for Discord display
 * - Truncates to Discord embed limit
 * - Preserves code blocks
 * - Formats markdown properly
 */
function formatAgentResponse(response: string): string {
  if (!response) return '*No response*';
  
  const MAX_LENGTH = 3800; // Discord embed description limit is 4096, leave room
  
  // Clean up any excessive whitespace
  let formatted = response.replace(/\n{4,}/g, '\n\n\n').trim();
  
  // If response is short, return as-is
  if (formatted.length <= MAX_LENGTH) {
    return formatted;
  }
  
  // Try to truncate at a natural break point
  let truncated = formatted.substring(0, MAX_LENGTH);
  
  // Check if we're in the middle of a code block
  const codeBlockOpens = (truncated.match(/```/g) || []).length;
  if (codeBlockOpens % 2 !== 0) {
    // We're in an unclosed code block, find a good break point
    const lastCodeBlockStart = truncated.lastIndexOf('```');
    if (lastCodeBlockStart > MAX_LENGTH * 0.5) {
      // Truncate before the code block if it's in the second half
      truncated = truncated.substring(0, lastCodeBlockStart).trim();
    } else {
      // Close the code block
      truncated += '\n```';
    }
  }
  
  // Find a good truncation point (end of sentence, paragraph, or line)
  const breakPoints = [
    truncated.lastIndexOf('\n\n'),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('\n'),
  ];
  
  for (const bp of breakPoints) {
    if (bp > MAX_LENGTH * 0.7) {
      truncated = truncated.substring(0, bp + 1);
      break;
    }
  }
  
  return truncated.trim() + '\n\n*...response truncated*';
}

/**
 * Resolves context based on channel and category information
 */
export async function resolveChannelContext(ctx: any, deps?: AgentHandlerDeps) {
  const channelContext = ctx.channelContext || deps?.channelContext;
  const channelName = ctx.channel?.name || '';
  
  const userId = ctx.user?.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  let sessionProjectPath: string | undefined = undefined;
  let sessionRoleId: string | undefined = undefined;
  
  if (userId && channelId) {
    const activeSessionInfo = getActiveSession(userId, channelId);
    if (activeSessionInfo) {
      sessionProjectPath = activeSessionInfo.session.projectPath;
      sessionRoleId = activeSessionInfo.session.roleId;
    }
  }
  
  let workDir = deps?.workDir || Deno.cwd();
  if (sessionProjectPath) {
    workDir = sessionProjectPath;
  } else if (channelContext?.projectPath) {
    workDir = channelContext.projectPath;
  }
  
  let roleId = sessionRoleId;
  if (!roleId) {
    const lowerChannelName = channelName.toLowerCase();
    const roleKeywords: Record<string, string> = {
      'builder': 'builder', 'tester': 'tester', 'investigator': 'investigator',
      'architect': 'architect', 'reviewer': 'reviewer', 'dev': 'builder',
      'debug': 'investigator', 'security': 'investigator', 'qa': 'tester'
    };

    for (const [kw, id] of Object.entries(roleKeywords)) {
      if (lowerChannelName.includes(kw)) {
        roleId = id;
        break;
      }
    }
  }
  
  return { workDir, roleId, channelContext };
}

export function createAgentHandlers(deps: AgentHandlerDeps) {
  const { workDir, crashHandler, sendAgentMessages, sessionManager } = deps;

  return {
    async onAgent(
      ctx: any,
      action: string,
      agentName?: string,
      message?: string,
      contextFiles?: string,
      includeSystemInfo?: boolean,
      model?: string
    ) {
      const startTime = Date.now();
      try {
        await ctx.deferReply();
        const context = await resolveChannelContext(ctx, deps);
        
        const effectiveDeps = { 
          ...deps, 
          workDir: context.workDir,
          channelContext: context.channelContext,
          modelOverride: model,
          sendAgentMessages: ctx.sendAgentMessages || deps.sendAgentMessages
        };

        switch (action) {
          case 'list':
            await listAgents(ctx);
            break;
          case 'select':
          case 'start':
            if (!agentName) {
              await ctx.editReply({ content: 'Agent name is required.', ephemeral: true });
              return;
            }
            await startAgentSession(ctx, agentName, context.roleId, model);
            break;
          case 'chat':
            if (!message) {
              await ctx.editReply({ content: 'Message is required.', ephemeral: true });
              return;
            }
            await chatWithAgent(ctx, message, agentName, contextFiles, includeSystemInfo, {
              ...effectiveDeps,
              clientOverride: ctx.clientOverride
            });
            break;
          case 'switch':
            if (!agentName) {
              await ctx.editReply({ content: 'Agent name is required.', ephemeral: true });
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
              await ctx.editReply({ content: 'Agent name is required.', ephemeral: true });
              return;
            }
            await showAgentInfo(ctx, agentName);
            break;
          case 'sync_models':
            await syncProviderModels(ctx);
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
        console.error(`[AgentHandler] FAILED: action=${action}:`, error);
        await crashHandler.reportCrash('agent', error instanceof Error ? error : new Error(String(error)), 'agent-command');
        throw error;
      }
    },
    async handleButton(ctx: any, customId: string) {
      const userId = ctx.user.id;
      const channelId = ctx.channelId || ctx.channel?.id;
      const key = `${userId}:${channelId}`;

      try {
        if (customId.startsWith('agent_spawn_approve:')) {
          const subAgentName = customId.split(':')[1];
          const pending = pendingSwarmTasks.get(key);

          if (!pending || pending.subAgentName !== subAgentName) {
            await ctx.reply({ content: "No pending task found or session expired. Note: Only the user who triggered the manager can approve.", ephemeral: true });
            return;
          }

          pendingSwarmTasks.delete(key);
          
          // Use update to acknowledge and change the original message
          await ctx.update({
            content: `<@${userId}> ✅ **Spawn Approved**`,
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

            subAgentOutput = await runAgentTask(subAgentName, pending.task, undefined, true, pending.workDir);

            const summaryPrompt = `You are the Manager. You spawned '${subAgentName}' to do this task: "${pending.task}".\n\nOutput:\n${subAgentOutput.substring(0, 40000)}\n\nProvide CONCISE summary.`;
            const { sendToAntigravityCLI } = await import("../provider-clients/antigravity-client.ts");
            const summaryResponse = await sendToAntigravityCLI(
              summaryPrompt,
              new AbortController(),
              {
                model: pending.managerConfig.model,
                authorized: true 
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
            console.error(`[AgentButton] Subagent error:`, err);
            await ctx.followUp({ content: `❌ Error: ${err}`, ephemeral: true });
          }
        } else if (customId.startsWith('agent_spawn_decline:')) {
          pendingSwarmTasks.delete(key);
          await ctx.update({
            content: `<@${userId}> ❌ **Spawn Declined**`,
            embeds: [{ color: 0xff0000, title: '❌ Spawn Declined', timestamp: new Date().toISOString() }],
            components: []
          });
        }
      } catch (error) {
        console.error(`[AgentButton] Interaction error:`, error);
        // Try to report error if interaction is still valid
        try {
          if (!ctx.replied && !ctx.deferred) {
            await ctx.reply({ content: `❌ Interaction error: ${error}`, ephemeral: true });
          } else {
            await ctx.followUp({ content: `❌ Interaction error: ${error}`, ephemeral: true });
          }
        } catch {}
      }
    }
  };
}

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
      footer: { text: 'Use /agent start agent_name:[name] to begin a session' },
      timestamp: new Date().toISOString()
    }]
  });
}

async function startAgentSession(ctx: any, agentName: string, roleId?: string, model?: string) {
  const agent = AgentRegistry.getInstance().getAgent(agentName);
  if (!agent) {
    await ctx.editReply({ content: `Agent ${agentName} not found.` });
    return;
  }

  const userId = ctx.user.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  const projectPath = ctx.channelContext?.projectPath;

  const session = setAgentSession(userId, channelId!, agentName, roleId, projectPath);
  if (model) session.modelOverride = model;

  // Get agent styling
  const style = getAgentStyle(agentName);
  const riskEmoji = agent.riskLevel === 'high' ? '🔴' : agent.riskLevel === 'medium' ? '🟡' : '🟢';
  
  // Build location fields
  const channelName = ctx.channel?.name || 'DM';
  const categoryName = ctx.channel?.parent?.name || 'No Category';
  
  await ctx.editReply({
    embeds: [{
      color: style.color,
      title: `${style.emoji} Agent Session Started`,
      fields: [
        { name: '🤖 Agent', value: agent.name, inline: true },
        { name: `${riskEmoji} Risk Level`, value: agent.riskLevel.toUpperCase(), inline: true },
        { name: '🧠 Model', value: model || agent.model, inline: true },
        { name: '📍 Channel', value: `#${channelName}`, inline: true },
        { name: '📂 Category', value: categoryName, inline: true },
        { name: '🔌 Client', value: (agent.client || 'claude').toUpperCase(), inline: true },
        { name: '📋 Description', value: agent.description, inline: false },
        { name: '🛠️ Capabilities', value: agent.capabilities.join(', '), inline: false }
      ],
      footer: { text: `Session ID: ${session.id}` },
      timestamp: new Date().toISOString()
    }]
  });
}

export async function chatWithAgent(
  ctx: any,
  message: string,
  agentName?: string,
  contextFiles?: string,
  includeSystemInfo?: boolean,
  deps?: AgentHandlerDeps
) {
  const resolvedContext = await resolveChannelContext(ctx, deps);
  const workDir = resolvedContext.workDir;
  const effectiveDeps = { ...deps, workDir, channelContext: resolvedContext.channelContext } as AgentHandlerDeps;

  const userId = ctx.user.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  const activeAgents = getActiveAgents(userId, channelId!);
  const activeAgentName = agentName || (activeAgents.length > 0 ? activeAgents[0] : 'general-assistant');
  
  const agentRef = AgentRegistry.getInstance().getAgent(activeAgentName || '');
  if (!agentRef) {
    await ctx.editReply({ content: `Agent ${activeAgentName} not found.` });
    return;
  }

  const agent = { ...agentRef };
  const sessionData = getActiveSession(userId, channelId || '');
  if (sessionData?.session.modelOverride) agent.model = sessionData.session.modelOverride;
  if (effectiveDeps?.modelOverride) agent.model = effectiveDeps.modelOverride;

  // Resolve model name to ensure it's valid (e.g., gemini-3-flash -> gemini-3-flash-preview)
  try {
    const { resolveModelName } = await import("../util/list-models.ts");
    const resolvedModel = await resolveModelName(agent.model);
    if (resolvedModel !== agent.model) {
      console.log(`[Agent] Model resolved: ${agent.model} -> ${resolvedModel}`);
      agent.model = resolvedModel;
    }
  } catch (err) {
    console.warn('[Agent] Could not resolve model name:', err);
  }

  // Check for client override from session (set by /run-adv) or deps
  const sessionClientOverride = (sessionData?.session as any)?.clientOverride;
  let clientType = effectiveDeps?.clientOverride || sessionClientOverride || agent.client || 'claude';

  if (clientType === 'antigravity') {
    try {
      const { getBestAvailableModel } = await import("../util/model-tester.ts");
      const fallbackModels = ['gemini-3-flash-preview', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      agent.model = getBestAvailableModel(agent.model, fallbackModels);
    } catch (error) {
      console.warn('[Agent] Could not get tested model, using configured model:', error);
    }
  }

  if (agent.isManager) {
    await handleManagerInteraction(ctx, message, agent, effectiveDeps);
    return;
  }

  // Create a sub-agent deps wrapper that uses followUp instead of editReply for updates
  // to avoid overwriting the parent's message in the same interaction
  const subAgentDeps = {
    ...effectiveDeps,
    sendAgentMessages: async (messages: any[]) => {
      const content = messages[0]?.content || '';
      if (!content) return;
      
      const chunks = splitText(content, DISCORD_LIMITS.EMBED_DESCRIPTION, true);
      for (const chunk of chunks) {
        await ctx.followUp({
          embeds: [{
            color: 0x0099ff,
            title: `🤖 ${agent.name} Update`,
            description: chunk,
            timestamp: new Date().toISOString()
          }]
        });
      }
    }
  };

  // Use the wrapper if this is NOT a top-level interaction (e.g. spawned by manager)
  // We can detect this if deps was already passed in with a sendAgentMessages
  const finalDeps = deps?.sendAgentMessages ? subAgentDeps : effectiveDeps;

  // Casual greeting detection
  const isCasualGreeting = (text: string): boolean => {
    const normalized = text.toLowerCase().trim();
    const cleanText = normalized.replace(/[?!.,;:]/g, '');
    const greetingPatterns = [
      /^(hey|hi|hello|yo|sup|greetings|good\s+(morning|afternoon|evening))\s*$/i,
      /^(what'?s|whats)\s+up\s*$/i, /^(are\s+)?you\s+up\s*$/i, /^how\s+(are\s+you|you\s+doing|it'?s?\s+going|things)\s*$/i,
      /^(hey|hi|hello)\s+(you|there|buddy|friend|mate|dude|pal)\s*$/i, /^(hey|hi|hello)\s+(you\s+)?up\s*$/i,
      /^(hey|hi|hello)\s+you\s+(up|doing|there)\s*$/i,
    ];
    if (greetingPatterns.some(pattern => pattern.test(cleanText))) return true;
    if (normalized.length <= 25) {
      const greetingWords = ['hey', 'hi', 'hello', 'yo', 'sup', 'whats', "what's", 'up', 'how', 'are', 'you', 'doing', 'going', 'things', 'good', 'morning', 'afternoon', 'evening', 'greetings', 'there', 'buddy', 'friend', 'mate', 'dude', 'pal'];
      const words = cleanText.split(/\s+/).filter(w => w.length > 0);
      return words.every(w => greetingWords.includes(w)) && words.length <= 6;
    }
    return false;
  };

  if (isCasualGreeting(message)) {
    if (sessionData?.session) {
      sessionData.session.history.push({ role: 'user', content: message });
      sessionData.session.messageCount++;
      sessionData.session.lastActivity = new Date();
    }
    const responses = [
      `Hey! 👋 I'm ${agent.name}, ready to help with your development tasks. What would you like to work on?`,
      `Hi there! 👋 I'm ${agent.name}. How can I assist you today?`,
      `Hello! 👋 I'm ${agent.name}. What can I help you with?`,
      `Hey! 👋 Ready to help. What do you need?`,
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];
    if (sessionData?.session) sessionData.session.history.push({ role: 'model', content: response });
    await ctx.editReply({
      embeds: [{
        color: 0x00ff00,
        title: `👋 ${agent.name}`,
        description: response,
        fields: [{ name: '💡 Tip', value: 'Just describe what you want to do, and I\'ll help you get it done!', inline: false }],
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }

  if (sessionData?.session) {
    sessionData.session.history.push({ role: 'user', content: message });
    sessionData.session.messageCount++;
    sessionData.session.lastActivity = new Date();
  }

  // Build history string
  let historyPrompt = "";
  if (sessionData?.session && sessionData.session.history.length > 0) {
    historyPrompt = "<conversation_history>\n";
    for (const msg of sessionData.session.history) {
      const role = msg.role === 'user' ? 'user' : 'assistant';
      const safeContent = msg.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      historyPrompt += `  <entry role="${role}">${safeContent}</entry>\n`;
    }
    historyPrompt += "</conversation_history>\n";
  }

  // Git Context
  let gitContext = "";
  try {
    const { getGitInfo, formatGitInfoForPrompt } = await import("../util/git-info.ts");
    const gitInfo = await getGitInfo(workDir);
    gitContext = formatGitInfoForPrompt(gitInfo);
    if (!gitContext) {
      gitContext = `\n\n=== WORKING DIRECTORY ===\nWorking Directory: ${workDir}\nNote: Not a Git repository.\n=== END WORKING DIRECTORY ===\n`;
    }
  } catch {
    gitContext = `\n\n=== WORKING DIRECTORY ===\nWorking Directory: ${workDir}\nNote: Git information could not be retrieved.\n=== END WORKING DIRECTORY ===\n`;
  }

  // Role context
  let roleContext = "";
  if (sessionData?.session.roleId) {
    roleContext = await loadRoleDocument(sessionData.session.roleId, workDir);
  }

  // Enhanced prompt
  const safeSystemPrompt = agent.systemPrompt.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let enhancedPrompt = `${safeSystemPrompt}${roleContext}${gitContext}\n\n${historyPrompt ? `=== CONVERSATION HISTORY ===\n${historyPrompt}=== END HISTORY ===\n\n` : ''}<user_query>${safeMessage}</user_query>`;

  // Context files injection
  let contextContent = "";
  try {
    const rootContextPath = `${workDir}/.agent-context.md`;
    try {
      const rootContext = await Deno.readTextFile(rootContextPath);
      contextContent += `\n\n=== ROOT AGENT CONTEXT ===\n${rootContext}\n=== END ROOT CONTEXT ===\n`;
    } catch {}
    
    const compartmentContextPath = `${workDir}/${activeAgentName.includes('architect') || activeAgentName.includes('coder') ? 'agent' : ''}/.agent-context.md`;
    if (compartmentContextPath !== rootContextPath) {
      try {
        const compartmentContext = await Deno.readTextFile(compartmentContextPath);
        contextContent += `\n\n=== COMPARTMENT CONTEXT ===\n${compartmentContext}\n=== END COMPARTMENT CONTEXT ===\n`;
      } catch {}
    }
  } catch {}
  enhancedPrompt += contextContent;

  // Agent-mem context
  try {
    const { injectAgentMemContext } = await import("../util/agent-mem-context.ts");
    enhancedPrompt = await injectAgentMemContext(enhancedPrompt, workDir, activeAgentName, message);
  } catch {}

  // System info
  if (includeSystemInfo) {
    enhancedPrompt += `\n\nSystem: ${Deno.build.os} ${Deno.build.arch}\nWorking Directory: ${workDir}`;
  }

  // Context files from command
  if (contextFiles) {
    enhancedPrompt += `\n\nRelevant Files: ${contextFiles}`;
  }

  // Build enhanced info fields for processing embed
  const processingFields = buildAgentInfoFields(ctx, agent, clientType, sessionData, { agentKey: activeAgentName });
  processingFields.push({ 
    name: '📝 Task', 
    value: `\`${message.substring(0, 150)}${message.length > 150 ? '...' : ''}\``, 
    inline: false 
  });

  const processingEmbed = getAgentEmbed(activeAgentName, agent.name, 'processing');
  await ctx.editReply({
    embeds: [{
      color: processingEmbed.color,
      title: processingEmbed.title,
      fields: processingFields,
      timestamp: new Date().toISOString()
    }]
  });

  const isRateLimitError = (error: any): boolean => {
    const msg = String(error).toLowerCase();
    return msg.includes('rate limit') || 
           msg.includes('quota') || 
           msg.includes('429') || 
           msg.includes('exit code 1') || 
           msg.includes('exited with code 1') ||
           msg.includes('out of extra usage');
  };

  try {
    const controller = new AbortController();
    let currentChunk = "";
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 2000;
    let result;
    let fallbackUsed = false;
    const requestStartTime = Date.now(); // Track response speed

    // Primary Client Logic
    if (clientType === 'claude') {
      try {
        const { sendToPrimaryCLI } = await import("../provider-clients/cli-client.ts");
        const cliModel = agent.model.includes("sonnet") ? "sonnet" : agent.model.includes("opus") ? "opus" : "sonnet";
        result = await sendToPrimaryCLI(agent.systemPrompt, message, controller, cliModel, 8000, async (chunk) => {
          currentChunk += chunk;
          if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
            lastUpdate = Date.now();
            await sendAgentUpdate(currentChunk, finalDeps);
            currentChunk = "";
          }
        });
      } catch (error) {
        if (isRateLimitError(error)) {
          fallbackUsed = true;
          await ctx.editReply({ embeds: [{ color: 0xffaa00, title: `⚠️ one agent: Provider Limit Reached`, description: 'Switching to fallback agent...', timestamp: new Date().toISOString() }] }).catch(() => {});
          const { sendToCursorCLI } = await import("../provider-clients/cursor-client.ts");
          result = await sendToCursorCLI(`${agent.systemPrompt}\n\nTask: ${message}`, controller, { model: agent.model, workspace: workDir, force: true, streamJson: true }, async (chunk) => {
            currentChunk += chunk;
            if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
              lastUpdate = Date.now();
              await sendAgentUpdate(currentChunk, finalDeps);
              currentChunk = "";
            }
          });
          clientType = 'cursor';
        } else throw error;
      }
    } else if (clientType === 'cursor') {
      const { sendToCursorCLI } = await import("../provider-clients/cursor-client.ts");
      const resumeId = sessionData?.session.cursorSessionId;
      const prompt = resumeId ? message : `${agent.systemPrompt}\n\nTask: ${message}`;
      result = await sendToCursorCLI(prompt, controller, { model: agent.model, workspace: workDir, force: agent.force, sandbox: agent.sandbox, streamJson: true, resume: resumeId }, async (chunk) => {
        currentChunk += chunk;
        if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
          lastUpdate = Date.now();
          await sendAgentUpdate(currentChunk, finalDeps);
          currentChunk = "";
        }
      });
      if (result.chatId && sessionData?.session) sessionData.session.cursorSessionId = result.chatId;
    } else if (clientType === 'antigravity') {
      const { sendToAntigravityCLI } = await import("../provider-clients/antigravity-client.ts");
      result = await sendToAntigravityCLI(enhancedPrompt, controller, { model: agent.model, workspace: workDir, force: agent.force, sandbox: agent.sandbox, streamJson: true, authorized: true }, async (chunk) => {
        currentChunk += chunk;
        if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
          lastUpdate = Date.now();
          await sendAgentUpdate(currentChunk, finalDeps);
          currentChunk = "";
        }
      });
    } else if (clientType === 'ollama' || clientType === 'openai' || clientType === 'groq') {
      // Use universal provider interface for API-based providers
      const { AgentProviderRegistry } = await import("./provider-interface.ts");
      const provider = AgentProviderRegistry.getProvider(clientType);
      if (!provider || !await provider.isAvailable()) throw new Error(`${clientType} unavailable`);
      const fullPrompt = `System: ${safeSystemPrompt}\n\nTask: ${historyPrompt}\n\n<user_query>${safeMessage}</user_query>`;
      const providerResult = await provider.execute(fullPrompt, { model: agent.model, temperature: agent.temperature, maxTokens: agent.maxTokens, streaming: true }, async (chunk) => {
        currentChunk += chunk;
        if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
          lastUpdate = Date.now();
          await sendAgentUpdate(currentChunk, finalDeps);
          currentChunk = "";
        }
      }, controller.signal);
      result = { response: providerResult.response, modelUsed: providerResult.modelUsed };
    }

    if (currentChunk) await sendAgentUpdate(currentChunk, finalDeps);

    const fullResponse = result?.response || '';
    if (sessionData?.session) sessionData.session.history.push({ role: 'model', content: fullResponse });

    // Handle GitHub Issue Request
    const githubIssueRequest = parseGitHubIssueRequest(fullResponse);
    if (githubIssueRequest && githubIssueRequest.action === 'create_github_issue') {
      const { createGitHubIssueWithCLI } = await import("../util/github-issues.ts");
      const issueResult = await createGitHubIssueWithCLI({ title: githubIssueRequest.title!, body: githubIssueRequest.body!, labels: githubIssueRequest.labels });
      if (issueResult.success) {
        await ctx.editReply({ embeds: [{ color: 0x00ff00, title: `✅ Issue Created #${issueResult.issueNumber}`, description: githubIssueRequest.title!, timestamp: new Date().toISOString() }] });
        return;
      }
    }

    const responseDuration = Date.now() - requestStartTime;
    const displayResponse = formatAgentResponse(fullResponse);
    
    // Build enhanced info fields for completion embed with agent styling
    const completedFields = buildAgentInfoFields(ctx, agent, clientType, sessionData, {
      modelUsed: result?.modelUsed || agent.model,
      agentKey: activeAgentName,
      responseDuration
    });
    
    const completedEmbed = getAgentEmbed(activeAgentName, agent.name, 'completed');
    await ctx.editReply({
      embeds: [{
        color: completedEmbed.color,
        title: completedEmbed.title,
        description: displayResponse,
        fields: completedFields,
        footer: { text: `Response time: ${(responseDuration / 1000).toFixed(1)}s` },
        timestamp: new Date().toISOString()
      }]
    });

  } catch (error) {
    console.error(`[Agent] Error:`, error);
    
    // Build error embed with agent styling
    const errorEmbed = getAgentEmbed(activeAgentName, agent.name, 'error');
    const errorFields = buildAgentInfoFields(ctx, agent, clientType, sessionData, { agentKey: activeAgentName });
    
    await ctx.editReply({ 
      embeds: [{ 
        color: errorEmbed.color, 
        title: errorEmbed.title, 
        description: String(error).substring(0, 2000),
        fields: errorFields,
        timestamp: new Date().toISOString() 
      }] 
    });
  }
}

async function showAgentStatus(ctx: any) {
  const userId = ctx.user.id;
  const channelId = ctx.channelId || ctx.channel?.id;
  const activeAgents = getActiveAgents(userId, channelId!);
  const activeSessions = agentSessions.filter(s => s.status === 'active' && s.userId === userId && s.channelId === channelId);

  await ctx.editReply({
    embeds: [{
      color: 0x0099ff,
      title: '📊 Agent Status',
      fields: [
        { name: 'Active Agents', value: activeAgents.join(', ') || 'None', inline: false },
        { name: 'Active Sessions', value: activeSessions.length.toString(), inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

async function showAgentInfo(ctx: any, agentName: string) {
  const agent = PREDEFINED_AGENTS[agentName];
  if (!agent) {
    await ctx.editReply({ content: `Agent ${agentName} not found.` });
    return;
  }

  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: `🤖 ${agent.name}`,
      description: agent.description,
      fields: [
        { name: 'Model', value: agent.model, inline: true },
        { name: 'Capabilities', value: agent.capabilities.join(', '), inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

async function syncProviderModels(ctx: any) {
  const { AgentProviderRegistry } = await import('./provider-interface.ts');
  const providers = AgentProviderRegistry.getAllProviders();
  const results = [];
  for (const provider of providers) {
    if (await provider.isAvailable()) results.push(`${provider.providerName}: ✅`);
    else results.push(`${provider.providerName}: ❌`);
  }
  await ctx.editReply({ embeds: [{ title: '🔄 Provider Status', description: results.join('\n'), timestamp: new Date().toISOString() }] });
}

async function switchAgent(ctx: any, agentName: string) {
  const agent = PREDEFINED_AGENTS[agentName];
  if (!agent) {
    await ctx.editReply({ content: `Agent ${agentName} not found.` });
    return;
  }
  removeActiveAgent(ctx.user.id, ctx.channelId!);
  addActiveAgent(ctx.user.id, ctx.channelId!, agentName);
  await ctx.editReply({ embeds: [{ color: 0x00ff00, title: '🔄 Agent Switched', description: `Now using **${agent.name}**`, timestamp: new Date().toISOString() }] });
}

async function endAgentSession(ctx: any) {
  const activeAgents = getActiveAgents(ctx.user.id, ctx.channelId!);
  if (activeAgents.length === 0) {
    await ctx.editReply({ content: 'No active session to end.' });
    return;
  }
  clearAgentSessions(ctx.user.id, ctx.channelId!);
  await ctx.editReply({ embeds: [{ color: 0x00ff00, title: '🛑 Agent Stopped', timestamp: new Date().toISOString() }] });
}

export async function handleManagerInteraction(
  ctx: any,
  userMessage: string,
  agentConfig: AgentConfig,
  deps?: AgentHandlerDeps
) {
  const { sendToAntigravityCLI } = await import("../provider-clients/antigravity-client.ts");
  const sessionData = getActiveSession(ctx.user.id, ctx.channelId!);
  if (sessionData?.session) sessionData.session.history.push({ role: 'user', content: userMessage });

  const response = await sendToAntigravityCLI(`${agentConfig.systemPrompt}\n\nTask: ${userMessage}`, new AbortController(), { model: agentConfig.model, authorized: true });
  const action = parseManagerResponse(response.response);

  if (action?.action === 'reply') {
    await ctx.editReply({ embeds: [{ color: 0x00cc99, title: '💬 Manager', description: action.message, timestamp: new Date().toISOString() }] });
  } else if (action?.action === 'spawn_agent') {
    const subAgent = AgentRegistry.getInstance().getAgent(action.agent_name!);
    
    // Check if testing mode should auto-approve
    const { shouldAutoApprove, testingLog } = await import("../util/testing-mode.ts");
    const autoApprove = shouldAutoApprove(subAgent?.riskLevel);
    
    if (subAgent && subAgent.riskLevel === 'high' && !autoApprove) {
      // Store in pending tasks for approval
      const userId = ctx.user.id;
      const channelId = ctx.channelId || ctx.channel?.id;
      const key = `${userId}:${channelId}`;
      const workDir = deps?.workDir || Deno.cwd();
      
      pendingSwarmTasks.set(key, { 
        subAgentName: action.agent_name!, 
        task: action.task!, 
        managerConfig: agentConfig,
        workDir,
        channelId: channelId!
      });

      const row = new ActionRowBuilder<any>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`agent_spawn_approve:${action.agent_name}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`agent_spawn_decline:${action.agent_name}`)
            .setLabel('Decline')
            .setStyle(ButtonStyle.Danger)
        );

      await ctx.editReply({
        content: `<@${userId}> ⚠️ **Approval Required**`,
        embeds: [{
          color: 0xffaa00,
          title: '⚠️ Approval Required',
          description: `The manager wants to spawn **${subAgent.name}** for a high-risk task.\n\n**Task:** ${action.task}`,
          timestamp: new Date().toISOString()
        }],
        components: [row]
      });
    } else if (autoApprove && subAgent?.riskLevel === 'high') {
      // Testing mode: auto-approve high-risk agents
      testingLog(`Auto-spawning high-risk agent: ${action.agent_name}`);
      await ctx.editReply({ 
        embeds: [{
          color: 0x00ff00,
          title: '🧪 Auto-Approved (Testing Mode)',
          description: `Spawning **${action.agent_name}**...`,
          timestamp: new Date().toISOString()
        }]
      });
      await chatWithAgent(ctx, action.task!, action.agent_name, undefined, false, deps);
    } else {
      await ctx.editReply({ content: `Spawning ${action.agent_name}...` });
      await chatWithAgent(ctx, action.task!, action.agent_name, undefined, false, deps);
    }
  } else if (action?.action === 'spawn_swarm') {
    await ctx.editReply({ content: `🚀 Initializing Swarm: **${action.projectName}**...` });
    
    try {
      const { SwarmManager } = await import("../util/swarm-manager.ts");
      const swarmResult = await SwarmManager.spawnSwarm(ctx, {
        projectName: action.projectName!,
        agents: action.agents!
      });

      const channelList = swarmResult.channels.map(c => `<#${c.id}>`).join(', ');
      await ctx.followUp({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Swarm Spawned',
          description: `Created category and channels for **${action.projectName}**.\n\n**Channels:** ${channelList}`,
          timestamp: new Date().toISOString()
        }]
      });

      // Optionally start agents in their respective channels
      for (const channelInfo of swarmResult.channels) {
        const agentTask = action.agents?.find(a => a.name === channelInfo.name);
        if (agentTask) {
          // 1. Create a mock context for the new channel
          const { createInteractionContext } = await import("../discord/interaction-context.ts");
          const guild = ctx.guild;
          const channel = await guild.channels.fetch(channelInfo.id);
          
          if (!channel) continue;

          const swarmCtx = await createInteractionContext({
            user: ctx.user,
            channel: channel,
            guild: guild,
            channelId: channel.id,
          }, { 
            projectPath: deps?.workDir || Deno.cwd(),
            repoName: ctx.channelContext?.repoName || "swarm-project",
            branchName: ctx.channelContext?.branchName || "main"
          });

          // 2. Set the active agent for THIS channel specifically
          // This ensures that messages in this channel are routed to this agent
          addActiveAgent(ctx.user.id, channel.id, agentTask.name);

          // 3. Start agent session in the new channel
          await startAgentSession(swarmCtx, agentTask.name);

          // 4. Send "Context Window" initialization message
          await channel.send({
            embeds: [{
              color: 0x5865F2,
              title: `🪟 Context Window: ${agentTask.name}`,
              description: `This channel is dedicated to a specific agent task within the **${action.projectName}** swarm.`,
              fields: [
                { name: '🤖 Agent', value: agentTask.name, inline: true },
                { name: '📁 Project', value: action.projectName, inline: true },
                { name: '📋 Task', value: agentTask.task, inline: false },
                { name: '💻 Workspace', value: `\`${deps?.workDir || Deno.cwd()}\``, inline: false }
              ],
              timestamp: new Date().toISOString()
            }]
          });

          // Send initial task to the agent in the new channel
          await chatWithAgent(swarmCtx, agentTask.task, agentTask.name, undefined, false, deps);
        }
      }
    } catch (error) {
      console.error("[Swarm] Failed to spawn swarm:", error);
      await ctx.followUp({ content: `❌ Failed to spawn swarm: ${error}`, ephemeral: true });
    }
  }
}

export async function handleSimpleCommand(ctx: any, commandName: string, deps: AgentHandlerDeps) {
  const handlers = createAgentHandlers(deps);
  if (commandName === 'kill') return await handlers.onAgent(ctx, 'end');
  if (commandName === 'run') {
    await ctx.deferReply();
    // Simplified run - just start general-assistant with gemini-3-flash-preview
    await startAgentSession(ctx, 'general-assistant');
  }
  if (commandName === 'run-adv') {
    await ctx.deferReply();
    // Show provider selection menu
    const { StringSelectMenuBuilder, ActionRowBuilder } = await import("npm:discord.js@14.14.1");
    const providerOptions = [
      { label: '🌐 Gemini API', value: 'gemini-api', description: 'Google Gemini models via API key' },
      { label: '🚀 Antigravity', value: 'antigravity', description: 'Google Gemini via gcloud OAuth' },
      { label: '🖥️ Cursor', value: 'cursor', description: 'Cursor AI agent' },
      { label: '🦙 Ollama', value: 'ollama', description: 'Local Ollama models' },
      { label: '💻 Claude CLI', value: 'claude-cli', description: 'Anthropic Claude via CLI' },
      { label: '⚡ OpenAI', value: 'openai', description: 'GPT-4o, o1, o3 models' },
      { label: '🔥 Groq', value: 'groq', description: 'Ultra-fast inference' },
    ];
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('run-adv-provider')
      .setPlaceholder('Select a provider...')
      .addOptions(providerOptions);
    const row = new ActionRowBuilder<any>().addComponents(selectMenu);
    await ctx.editReply({
      embeds: [{
        color: 0x5865F2,
        title: '🚀 Step 1: Select Provider',
        description: 'Choose an AI provider for your agent session',
      }],
      components: [row]
    });
  }
  if (commandName === 'sync') {
    await ctx.deferReply();
    const userId = ctx.user.id;
    const channelId = ctx.channelId;
    
    try {
      const { loadConversation, exportToMarkdown } = await import("../util/conversation-sync.ts");
      const conversation = await loadConversation(userId, channelId, 'general-assistant');
      
      if (conversation.messages.length === 0) {
        await ctx.editReply({
          embeds: [{
            color: 0xffaa00,
            title: '🔄 No Conversation',
            description: 'No conversation history found in this channel. Start chatting first!',
          }]
        });
        return;
      }
      
      const mdPath = await exportToMarkdown(conversation);
      
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '🔄 Conversation Synced',
          description: `Exported ${conversation.messages.length} messages`,
          fields: [
            { name: '📁 Markdown File', value: `\`${mdPath}\``, inline: false },
            { name: '🆔 Conversation ID', value: conversation.id, inline: true },
            { name: '🤖 Agent', value: conversation.agentName, inline: true },
            conversation.cursorSessionId 
              ? { name: '🖥️ Cursor Session', value: `\`${conversation.cursorSessionId}\``, inline: false }
              : { name: '💡 Tip', value: 'Reference the markdown file in Cursor to continue', inline: false }
          ],
        }]
      });
    } catch (error) {
      await ctx.editReply({
        embeds: [{
          color: 0xff0000,
          title: '❌ Sync Error',
          description: String(error),
        }]
      });
    }
  }
}

export function getAgentsForAPI() {
  return Object.entries(PREDEFINED_AGENTS).map(([id, agent]) => ({ id, name: agent.name }));
}

export function getSessionsForAPI() {
  return { sessions: agentSessions.map(s => ({ id: s.id, agent: s.agentName })), stats: { activeSessions: agentSessions.length } };
}
