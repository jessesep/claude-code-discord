import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "npm:discord.js@14.14.1";
import * as path from "https://deno.land/std/path/mod.ts";
import { AgentConfig, AgentSession, PREDEFINED_AGENTS, ROLE_DEFINITIONS, CONTEXT_NOTE } from "./types.ts";
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
  sendClaudeMessages: (messages: any[]) => Promise<void>;
  sessionManager: any;
  clientOverride?: 'claude' | 'cursor' | 'antigravity' | 'ollama';
  includeGit?: boolean;
  channelContext?: import("../util/channel-context.ts").ChannelProjectContext;
  targetUserId?: string; // User to mention when done or action needed
  modelOverride?: string;
}

const pendingSwarmTasks = new Map<string, { subAgentName: string, task: string, managerConfig: AgentConfig }>();

/**
 * Helper to send agent updates to Discord with optional user mention
 */
async function sendAgentUpdate(
  content: string, 
  deps: AgentHandlerDeps, 
  options: { isFinal?: boolean } = {}
) {
  if (!deps.sendClaudeMessages) {
    console.warn(`[AgentUpdate] SKIP: sendClaudeMessages not defined`);
    return;
  }

  const claudeMessages = [{
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
    (claudeMessages[0] as any).content = `<@${deps.targetUserId}> ${prefix}${content}`;
  }

  await deps.sendClaudeMessages(claudeMessages).catch(err => { 
    console.error(`[AgentUpdate] FAILED to send messages:`, err);
  });
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
  const { workDir, crashHandler, sendClaudeMessages, sessionManager } = deps;

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
          modelOverride: model
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

          subAgentOutput = await runAgentTask(subAgentName, pending.task, undefined, true);

          const summaryPrompt = `You are the Manager. You spawned '${subAgentName}' to do this task: "${pending.task}".\n\nOutput:\n${subAgentOutput.substring(0, 40000)}\n\nProvide CONCISE summary.`;
          const { sendToAntigravityCLI } = await import("../claude/antigravity-client.ts");
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

  const riskColor = agent.riskLevel === 'high' ? 0xff6600 : agent.riskLevel === 'medium' ? 0xffaa00 : 0x00ff00;
  
  await ctx.editReply({
    embeds: [{
      color: riskColor,
      title: '🚀 Agent Session Started',
      fields: [
        { name: 'Agent', value: agent.name, inline: true },
        { name: 'Risk Level', value: agent.riskLevel.toUpperCase(), inline: true },
        { name: 'Model', value: model || agent.model, inline: true },
        { name: 'Description', value: agent.description, inline: false },
        { name: 'Capabilities', value: agent.capabilities.join(', '), inline: false }
      ],
      footer: { text: 'You can now chat with this agent in this channel.' },
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

  // Claude-mem context
  try {
    const { injectClaudeMemContext } = await import("../util/claude-mem-context.ts");
    enhancedPrompt = await injectClaudeMemContext(enhancedPrompt, workDir, activeAgentName, message);
  } catch {}

  // System info
  if (includeSystemInfo) {
    enhancedPrompt += `\n\nSystem: ${Deno.build.os} ${Deno.build.arch}\nWorking Directory: ${workDir}`;
  }

  // Context files from command
  if (contextFiles) {
    enhancedPrompt += `\n\nRelevant Files: ${contextFiles}`;
  }

  await ctx.editReply({
    embeds: [{
      color: 0xffff00,
      title: `🤖 ${agent.name} Processing...`,
      fields: [
        { name: 'Agent', value: agent.name, inline: true },
        { name: 'Model', value: agent.model, inline: true },
        { name: 'Message Preview', value: `\`${message.substring(0, 200)}...\``, inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });

  const isRateLimitError = (error: any): boolean => {
    const msg = String(error).toLowerCase();
    return msg.includes('rate limit') || msg.includes('quota') || msg.includes('429') || msg.includes('exit code 1');
  };

  try {
    const controller = new AbortController();
    let currentChunk = "";
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 2000;
    let result;
    let fallbackUsed = false;

    // Primary Client Logic
    if (clientType === 'claude') {
      try {
        const { sendToClaudeCLI } = await import("../claude/cli-client.ts");
        const cliModel = agent.model.includes("sonnet") ? "sonnet" : agent.model.includes("opus") ? "opus" : "sonnet";
        result = await sendToClaudeCLI(agent.systemPrompt, message, controller, cliModel, 8000, async (chunk) => {
          currentChunk += chunk;
          if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
            lastUpdate = Date.now();
            await sendAgentUpdate(currentChunk, effectiveDeps);
            currentChunk = "";
          }
        });
      } catch (claudeError) {
        if (isRateLimitError(claudeError)) {
          fallbackUsed = true;
          await ctx.editReply({ embeds: [{ color: 0xffaa00, title: `⚠️ Claude Limit Reached`, description: 'Switching to **Cursor Agent** fallback...', timestamp: new Date().toISOString() }] }).catch(() => {});
          const { sendToCursorCLI } = await import("../claude/cursor-client.ts");
          result = await sendToCursorCLI(`${agent.systemPrompt}\n\nTask: ${message}`, controller, { model: agent.model, workspace: workDir, force: true, streamJson: true }, async (chunk) => {
            currentChunk += chunk;
            if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
              lastUpdate = Date.now();
              await sendAgentUpdate(currentChunk, effectiveDeps);
              currentChunk = "";
            }
          });
          clientType = 'cursor';
        } else throw claudeError;
      }
    } else if (clientType === 'cursor') {
      const { sendToCursorCLI } = await import("../claude/cursor-client.ts");
      const resumeId = sessionData?.session.cursorSessionId;
      const prompt = resumeId ? message : `${agent.systemPrompt}\n\nTask: ${message}`;
      result = await sendToCursorCLI(prompt, controller, { model: agent.model, workspace: workDir, force: agent.force, sandbox: agent.sandbox, streamJson: true, resume: resumeId }, async (chunk) => {
        currentChunk += chunk;
        if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
          lastUpdate = Date.now();
          await sendAgentUpdate(currentChunk, effectiveDeps);
          currentChunk = "";
        }
      });
      if (result.chatId && sessionData?.session) sessionData.session.cursorSessionId = result.chatId;
    } else if (clientType === 'antigravity') {
      const { sendToAntigravityCLI } = await import("../claude/antigravity-client.ts");
      result = await sendToAntigravityCLI(enhancedPrompt, controller, { model: agent.model, workspace: workDir, force: agent.force, sandbox: agent.sandbox, streamJson: true, authorized: true }, async (chunk) => {
        currentChunk += chunk;
        if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
          lastUpdate = Date.now();
          await sendAgentUpdate(currentChunk, effectiveDeps);
          currentChunk = "";
        }
      });
    } else if (clientType === 'ollama') {
      const { AgentProviderRegistry } = await import("./provider-interface.ts");
      const provider = AgentProviderRegistry.getProvider('ollama');
      if (!provider || !await provider.isAvailable()) throw new Error("Ollama unavailable");
      const fullPrompt = `System: ${safeSystemPrompt}\n\nTask: ${historyPrompt}\n\n<user_query>${safeMessage}</user_query>`;
      const ollamaResult = await provider.execute(fullPrompt, { model: agent.model, temperature: agent.temperature, maxTokens: agent.maxTokens }, async (chunk) => {
        currentChunk += chunk;
        if (Date.now() - lastUpdate >= UPDATE_INTERVAL) {
          lastUpdate = Date.now();
          await sendAgentUpdate(currentChunk, effectiveDeps);
          currentChunk = "";
        }
      }, controller.signal);
      result = { response: ollamaResult.response, modelUsed: ollamaResult.modelUsed };
    }

    if (currentChunk) await sendAgentUpdate(currentChunk, effectiveDeps);

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

    const displayResponse = fullResponse.length > 3800 ? fullResponse.substring(0, 3800) + '...' : fullResponse;
    await ctx.editReply({
      embeds: [{
        color: 0x00ff00,
        title: `✅ ${agent.name} - Completed`,
        description: displayResponse,
        fields: [
          { name: 'Client', value: clientType, inline: true },
          { name: 'Model', value: result?.modelUsed || agent.model, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    });

  } catch (error) {
    console.error(`[Agent] Error:`, error);
    await ctx.editReply({ embeds: [{ color: 0xff0000, title: `❌ Agent Error`, description: String(error), timestamp: new Date().toISOString() }] });
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
  const { sendToAntigravityCLI } = await import("../claude/antigravity-client.ts");
  const sessionData = getActiveSession(ctx.user.id, ctx.channelId!);
  if (sessionData?.session) sessionData.session.history.push({ role: 'user', content: userMessage });

  const response = await sendToAntigravityCLI(`${agentConfig.systemPrompt}\n\nTask: ${userMessage}`, new AbortController(), { model: agentConfig.model, authorized: true });
  const action = parseManagerResponse(response.response);

  if (action?.action === 'reply') {
    await ctx.editReply({ embeds: [{ color: 0x00cc99, title: '💬 Manager', description: action.message, timestamp: new Date().toISOString() }] });
  } else if (action?.action === 'spawn_agent') {
    await ctx.editReply({ content: `Spawning ${action.agent_name}...` });
    await chatWithAgent(ctx, action.task!, action.agent_name, undefined, false, deps);
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
