import {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  CommandInteraction,
  ButtonInteraction,
  TextChannel,
  EmbedBuilder
} from "npm:discord.js@14.14.1";
import { getActiveSession } from "../agent/index.ts";
import { ChannelContextManager } from "../util/channel-context.ts";

import { sanitizeChannelName, DISCORD_LIMITS, splitText } from "./utils.ts";
import { handlePaginationInteraction } from "./pagination.ts";
import { convertMessageContent } from "./formatting.ts";
import type { 
  BotConfig, 
  CommandHandlers, 
  ButtonHandlers,
  MessageContent, 
  InteractionContext,
  BotDependencies
} from "./types.ts";


// Main Bot Creation Function
// ================================

export async function createDiscordBot(
  config: BotConfig, 
  handlers: CommandHandlers,
  buttonHandlers: ButtonHandlers,
  dependencies: BotDependencies,
  crashHandler?: any
) {
  const { discordToken, applicationId, workDir, repoName, branchName, categoryName } = config;
  // Format: "categoryName (repoName)" if categoryName provided, otherwise just "repoName"
  const actualCategoryName = categoryName ? `${categoryName} (${repoName})` : repoName;
  
  let myChannel: TextChannel | null = null;
  // deno-lint-ignore no-explicit-any no-unused-vars
  let myCategory: any = null;
  
  const botSettings = dependencies.botSettings || {
    mentionEnabled: !!config.defaultMentionUserId,
    mentionUserId: config.defaultMentionUserId || null,
  };

  // Initialize channel context manager for multi-project routing
  const channelContextManager = new ChannelContextManager(workDir);
  const enableChannelRouting = Deno.env.get("ENABLE_CHANNEL_ROUTING") === "true";
  
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
  
  // Use commands from dependencies
  const commands = dependencies.commands;
  
  // Channel management
  // deno-lint-ignore no-explicit-any
  async function ensureChannelExists(guild: any): Promise<TextChannel> {
    const channelName = sanitizeChannelName(branchName);
    
    console.log(`Checking category "${actualCategoryName}"...`);
    
    let category = guild.channels.cache.find(
      // deno-lint-ignore no-explicit-any
      (c: any) => c.type === ChannelType.GuildCategory && c.name === actualCategoryName
    );
    
    if (!category) {
      console.log(`Creating category "${actualCategoryName}"...`);
      try {
        category = await guild.channels.create({
          name: actualCategoryName,
          type: ChannelType.GuildCategory,
        });
        console.log(`Created category "${actualCategoryName}"`);
      } catch (error) {
        console.error(`Category creation error: ${error}`);
        throw new Error(`Cannot create category. Please ensure the bot has "Manage Channels" permission.`);
      }
    }
    
    myCategory = category;
    
    let channel = guild.channels.cache.find(
      // deno-lint-ignore no-explicit-any
      (c: any) => c.type === ChannelType.GuildText && c.name === channelName && c.parentId === category.id
    );
    
    if (!channel) {
      console.log(`Creating channel "${channelName}"...`);
      try {
        channel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: `Repository: ${repoName} | Branch: ${branchName} | Machine: ${Deno.hostname()} | Path: ${workDir}`,
        });
        console.log(`Created channel "${channelName}"`);
      } catch (error) {
        console.error(`Channel creation error: ${error}`);
        throw new Error(`Cannot create channel. Please ensure the bot has "Manage Channels" permission.`);
      }
    }
    
    return channel as TextChannel;
  }
  
  // Create interaction context wrapper
  async function createInteractionContext(interaction: CommandInteraction | ButtonInteraction | any): Promise<InteractionContext> {
    // Get channel context for multi-project routing
    let channelContext = undefined;
    if (enableChannelRouting && interaction.channel) {
      try {
        channelContext = await channelContextManager.getChannelContext(interaction.channel);
        if (channelContext) {
          console.log(`[ChannelContext] Using project: ${channelContext.projectPath} (source: ${channelContext.source})`);
        }
      } catch (error) {
        console.warn(`[ChannelContext] Error getting context: ${error}`);
      }
    }

    return {
      // User information from the interaction
      user: {
        id: interaction.user.id,
        username: interaction.user.username
      },

      // Channel information
      channelId: interaction.channelId,
      channel: interaction.channel,
      guild: interaction.guild,
      channelContext,

      async deferReply(): Promise<void> {
        if ('deferReply' in interaction) {
          await interaction.deferReply();
        }
      },

      async deferUpdate(): Promise<void> {
        if ('deferUpdate' in interaction) {
          await interaction.deferUpdate();
        } else if ('update' in interaction) {
          // Fallback: acknowledge with empty update
          await (interaction as any).update({});
        }
      },

      async editReply(content: MessageContent): Promise<void> {
        if ('editReply' in interaction) {
          await interaction.editReply(convertMessageContent(content));
        }
      },

      async followUp(content: MessageContent & { ephemeral?: boolean }): Promise<void> {
        if ('followUp' in interaction) {
          const payload = convertMessageContent(content);
          payload.ephemeral = content.ephemeral || false;
          await interaction.followUp(payload);
        }
      },

      async reply(content: MessageContent & { ephemeral?: boolean }): Promise<void> {
        if ('reply' in interaction) {
          const payload = convertMessageContent(content);
          payload.ephemeral = content.ephemeral || false;
          await interaction.reply(payload);
        }
      },

      async update(content: MessageContent): Promise<void> {
        if ('update' in interaction) {
          await (interaction as any).update(convertMessageContent(content));
        }
      },

      getString(name: string, required?: boolean): string | null {
        if (interaction.isCommand && interaction.isCommand()) {
          // deno-lint-ignore no-explicit-any
          return (interaction as any).options.getString(name, required ?? false);
        }
        return null;
      },

      getInteger(name: string, required?: boolean): number | null {
        if (interaction.isCommand && interaction.isCommand()) {
          // deno-lint-ignore no-explicit-any
          return (interaction as any).options.getInteger(name, required ?? false);
        }
        return null;
      },

      getBoolean(name: string, required?: boolean): boolean | null {
        if (interaction.isCommand && interaction.isCommand()) {
          // deno-lint-ignore no-explicit-any
          return (interaction as any).options.getBoolean(name, required ?? false);
        }
        return null;
      }
    };
  }
  
  // Command handler - completely generic
  async function handleCommand(interaction: CommandInteraction) {
    const startTime = Date.now();
    console.log(`[InteractionCommand] STARTED: /${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id}) in channel ${interaction.channelId}`);
    
    // Log options for better debugging
    const options = interaction.options.data.map(opt => `${opt.name}: ${opt.value}`).join(', ');
    if (options) console.log(`[InteractionCommand] OPTIONS: ${options}`);
    
    // Channel restriction: if routing is disabled, only respond to own channel
    // Exception: /restart, /run, and /run-adv commands should be allowed from any channel
    if (!enableChannelRouting) {
      const allowedCommands = ['restart', 'run', 'run-adv'];
      if (!allowedCommands.includes(interaction.commandName) && (!myChannel || interaction.channelId !== myChannel.id)) {
        console.log(`[InteractionCommand] IGNORED: Not in bot's channel (${myChannel?.id}) and routing disabled.`);
        return;
      }
    }
    
    const ctx = await createInteractionContext(interaction);
    const handler = handlers.get(interaction.commandName);
    
    if (!handler) {
      console.error(`[InteractionCommand] ERROR: No handler found for /${interaction.commandName}`);
      await ctx.reply({
        content: `Unknown command: ${interaction.commandName}`,
        ephemeral: true
      });
      return;
    }
    
    try {
      console.log(`[InteractionCommand] EXECUTING: /${interaction.commandName}`);
      await handler.execute(ctx);
      console.log(`[InteractionCommand] COMPLETED: /${interaction.commandName} in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error(`[InteractionCommand] FAILED: /${interaction.commandName}:`, error);
      // Try to send error message if possible
      try {
        if (interaction.deferred) {
          await ctx.editReply({
            content: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        } else {
          await ctx.reply({
            content: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ephemeral: true
          });
        }
      } catch (replyError) {
        console.error(`[InteractionCommand] FAILED_TO_REPLY: ${replyError}`);
      }
    }
  }
  
  // Select menu handler
  async function handleSelectMenu(interaction: any) {
    const startTime = Date.now();
    console.log(`[InteractionSelect] STARTED: ID=${interaction.customId} by ${interaction.user.tag} in channel ${interaction.channelId}`);
    console.log(`[InteractionSelect] VALUES: ${JSON.stringify(interaction.values)}`);

    // Channel restriction: if routing is disabled, only respond to own channel
    if (!enableChannelRouting) {
      if (!myChannel || interaction.channelId !== myChannel.id) {
        console.log(`[InteractionSelect] IGNORED: Not in bot's channel and routing disabled.`);
        return;
      }
    }
    
    const ctx = await createInteractionContext(interaction);
    const customId = interaction.customId;
    const values = interaction.values;
    
    // Handle repo selection
    if (customId === 'repo-select-load' && values && values.length > 0) {
      await ctx.deferUpdate();
      try {
        // Create repo handlers on the fly
        const { createRepoHandlers } = await import("../repo/index.ts");
        const { WorktreeBotManager } = await import("../git/index.ts");
        const worktreeBotManager = new WorktreeBotManager();
        
        const repoHandlers = createRepoHandlers({
          workDir,
          repoName,
          branchName,
          actualCategoryName,
          discordToken,
          applicationId,
          botSettings,
          worktreeBotManager
        });
        await repoHandlers.handleRepoSelect(ctx, values[0]);
      } catch (error) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Error Loading Repository',
            description: `Failed to load repository: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date().toISOString()
          }]
        });
      }
      return;
    }
    
    // Handle agent/model selection
    if (customId === 'select-agent-model' && values && values.length > 0) {
      // Defer update immediately to prevent interaction timeout (3 second limit)
      await ctx.deferUpdate();
      
      // Value format: "type:name:model" but name might contain ':' for webhooks
      // So we split by ':' and handle webhooks specially
      const parts = values[0].split(':');
      const type = parts[0];
      
      // For webhooks: format is "webhook:webhook:webhookId:modelType"
      // For agents: format is "agent:agentName:model"
      let agentName: string;
      let model: string;
      
      if (type === 'webhook' && parts[1] === 'webhook') {
        // Webhook format: webhook:webhook:webhookId:modelType
        agentName = `webhook:${parts[2]}`;
        model = parts[3] || 'webhook';
      } else {
        // Regular agent format: agent:agentName:model
        agentName = parts[1];
        model = parts.slice(2).join(':'); // Handle model names with ':'
      }
      
      // Handle webhook selection
      if (type === 'webhook') {
        const webhookId = agentName.replace('webhook:', '');
        
        // Get webhook configuration
        const { SettingsPersistence } = await import("../util/settings-persistence.ts");
        const settings = SettingsPersistence.getInstance().getSettings();
        const webhook = settings.webhooks?.find((w: any) => w.id === webhookId && w.enabled);
        
        if (!webhook) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: '❌ Webhook Not Found',
              description: `Webhook with ID "${webhookId}" not found or disabled.`,
              timestamp: true
            }]
          });
          return;
        }
        
        // Trigger webhook
        const webhookUrl = `http://localhost:8000/api/webhooks/${webhookId}`;
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trigger: 'discord_run_command',
              userId: ctx.user.id,
              channelId: ctx.channelId,
              timestamp: new Date().toISOString()
            })
          });
          
          const result = await response.json();
          
          // Determine agent name based on webhook type
          const webhookName = webhook.name.toLowerCase();
          let actualAgentName = 'ag-coder'; // Default
          
          if (webhookName.includes('cursor')) {
            actualAgentName = 'cursor-coder';
          } else if (webhookName.includes('manager') || webhookName.includes('orchestr')) {
            actualAgentName = 'ag-manager';
          } else if (webhookName.includes('architect')) {
            actualAgentName = 'ag-architect';
          }
          
          // Start agent session
          const { setAgentSession, PREDEFINED_AGENTS } = await import("../agent/index.ts");
          const channelId = ctx.channelId || ctx.channel?.id;
          if (channelId) {
            setAgentSession(ctx.user.id, channelId, actualAgentName);
          }
          
          const agent = PREDEFINED_AGENTS[actualAgentName];
          
          await ctx.editReply({
            embeds: [{
              color: 0x00ff00,
              title: '🔗 Webhook Triggered',
              description: `**${webhook.name}** webhook has been triggered!\n\nAgent session started: **${agent?.name || actualAgentName}**`,
              fields: [
                { name: 'Webhook', value: webhook.name, inline: true },
                { name: 'Agent', value: agent?.name || actualAgentName, inline: true },
                { name: 'Status', value: '✅ Active - Ready for input', inline: true },
                { name: 'Usage', value: 'Just type your message in this channel to continue the conversation', inline: false }
              ],
              timestamp: true
            }]
          });
          
          return;
        } catch (error) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: '❌ Webhook Error',
              description: `Failed to trigger webhook: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: true
            }]
          });
          return;
        }
      }
      
      // Handle regular agent selection
      if (type === 'agent' && agentName && model) {
        // Import AgentRegistry, setAgentSession, and PREDEFINED_AGENTS
        const { AgentRegistry } = await import("../agent/registry.ts");
        const { setAgentSession, PREDEFINED_AGENTS } = await import("../agent/index.ts");
        
        // Temporarily override the agent's model for this session
        const originalAgent = PREDEFINED_AGENTS[agentName];
        if (originalAgent) {
          // Create a modified agent config with the selected model
          const modifiedAgent = { ...originalAgent, model };
          PREDEFINED_AGENTS[agentName] = modifiedAgent;
          // Also update the registry
          AgentRegistry.getInstance().registerAgent(agentName, modifiedAgent);
        }
        
        const agent = AgentRegistry.getInstance().getAgent(agentName);
        
        if (!agent) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: '❌ Agent Not Found',
              description: `No agent found with name: ${agentName}`,
              timestamp: true
            }]
          });
          return;
        }
        
        // Security: RBAC for High-Risk Agents
        const ownerId = Deno.env.get("OWNER_ID") || Deno.env.get("DEFAULT_MENTION_USER_ID");
        const userId = ctx.user.id;
        if (agent.riskLevel === 'high' && ownerId && userId !== ownerId) {
          await ctx.editReply({
            embeds: [{
              color: 0xff0000,
              title: '⛔ Access Denied',
              description: `Agent **${agent.name}** is a high-risk agent and can only be used by the bot owner.`,
              footer: { text: "Security policy: Restricted access enabled" },
              timestamp: true
            }]
          });
          return;
        }
        
        // Create session
        const channelId = ctx.channelId || ctx.channel?.id;
        if (channelId) {
          setAgentSession(userId, channelId, agentName);
        }
        
        // Show success message
        const riskColor = agent.riskLevel === 'high' ? 0xff6600 : agent.riskLevel === 'medium' ? 0xffaa00 : 0x00ff00;
        
        if (agent.isManager) {
          await ctx.editReply({
            embeds: [{
              color: riskColor,
              title: '🚀 Helper Agent Ready',
              description: `**${agent.name}** (${model}) is ready to help!\n\n👋 **Hey! What do you want to do?**\n\nJust type your request in this channel. Include:\n• What you want to accomplish\n• The repository path (if different from current)\n\nI'll analyze your request and launch the right agent to help you.`,
              fields: [
                { name: 'Model', value: model, inline: true },
                { name: 'Status', value: '✅ Active - Ready for input', inline: true }
              ],
              footer: { text: 'Tip: Type your request directly in the channel, no slash commands needed!' },
              timestamp: true
            }]
          });
        } else {
          await ctx.editReply({
            embeds: [{
              color: riskColor,
              title: '🚀 Agent Session Started',
              fields: [
                { name: 'Agent', value: agent.name, inline: true },
                { name: 'Model', value: model, inline: true },
                { name: 'Risk Level', value: agent.riskLevel.toUpperCase(), inline: true },
                { name: 'Description', value: agent.description, inline: false },
                { name: 'Capabilities', value: agent.capabilities.join(', '), inline: false },
                { name: 'Usage', value: 'Just type your message in this channel to continue the conversation', inline: false }
              ],
              timestamp: true
            }]
          });
        }
        
        // Note: Model override persists for the session - no need to restore
        return;
      }
    }
    
    // Handle run-adv provider selection
    if (customId === 'run-adv-provider' && values && values.length > 0) {
      await ctx.deferUpdate();
      const provider = values[0];
      
      // Step 2: Workspace/Repo selection
      const { StringSelectMenuBuilder, ActionRowBuilder } = await import("npm:discord.js@14.14.1");
      const { RepoManager } = await import("../repo/index.ts");
      
      const repoManager = RepoManager.getInstance(workDir);
      let repos = repoManager.getRepositories();
      
      // If no repos scanned yet, do a quick scan
      if (repos.length === 0) {
        repos = await repoManager.scanRepositories(1); // Shallow scan first
      }
      
      // Create options for workspace selection
      const workspaceOptions = [];
      
      // 1. Current workspace (from context or default)
      const currentPath = ctx.channelContext?.projectPath || workDir;
      const currentName = ctx.channelContext?.repoName || repoName || 'Current Workspace';
      
      workspaceOptions.push({
        label: `📍 ${currentName} (Current)`,
        description: currentPath.substring(0, 100),
        value: currentPath
      });
      
      // 2. Add other discovered repositories
      repos.forEach(repo => {
        // Skip current workspace as it's already added
        if (repo.path === currentPath) return;
        
        workspaceOptions.push({
          label: `📁 ${repo.name}`,
          description: repo.path.substring(0, 100),
          value: repo.path
        });
      });
      
      // Limit to 25 options
      const finalOptions = workspaceOptions.slice(0, 25);
      
      const workspaceMenu = new StringSelectMenuBuilder()
        .setCustomId(`run-adv-workspace:${provider}`)
        .setPlaceholder('Select a workspace/repository...')
        .addOptions(finalOptions);
      
      const workspaceRow = new ActionRowBuilder<any>().addComponents(workspaceMenu);
      
      const providerNames: Record<string, string> = {
        'cursor': '💻 Cursor',
        'claude-cli': '🤖 Claude CLI',
        'gemini-api': '🚀 Gemini API',
        'antigravity': '⚡ Antigravity',
        'ollama': '🦙 Ollama'
      };
      
      await ctx.editReply({
        embeds: [{
          color: 0x5865F2,
          title: '🚀 Advanced Agent Runner',
          description: `**Step 2 of 4: Select Workspace**\n\nProvider: **${providerNames[provider] || provider}**\n\nChoose the workspace or repository where the agent should spawn:`,
          fields: [
            { name: 'Current Workspace', value: `\`${currentPath}\``, inline: false },
            { name: 'Discovered', value: `${repos.length} other repositories found`, inline: true }
          ],
          footer: { text: 'Select a workspace to continue' },
          timestamp: true
        }],
        components: [workspaceRow]
      });
      return;
    }

    // Handle run-adv workspace selection
    if (customId.startsWith('run-adv-workspace:') && values && values.length > 0) {
      await ctx.deferUpdate();
      const [, provider] = customId.split(':');
      const workspacePath = values[0];
      
      // Step 3: Role selection (include provider and workspace in customId)
      const { StringSelectMenuBuilder, ActionRowBuilder } = await import("npm:discord.js@14.14.1");
      
      const roleMenu = new StringSelectMenuBuilder()
        .setCustomId(`run-adv-role:${provider}:${workspacePath}`)
        .setPlaceholder('Select a role...')
        .addOptions([
          { label: '🔨 Builder', description: 'Build and create code, implement features', value: 'builder' },
          { label: '🧪 Tester', description: 'Test code, ensure quality, find bugs', value: 'tester' },
          { label: '🔍 Investigator', description: 'Investigate issues, analyze systems', value: 'investigator' },
          { label: '🏗️ Architect', description: 'Design systems, plan architecture', value: 'architect' },
          { label: '👁️ Reviewer', description: 'Review code, provide feedback', value: 'reviewer' }
        ]);
      
      const roleRow = new ActionRowBuilder<any>().addComponents(roleMenu);
      
      const providerNames: Record<string, string> = {
        'cursor': '💻 Cursor',
        'claude-cli': '🤖 Claude CLI',
        'gemini-api': '🚀 Gemini API',
        'antigravity': '⚡ Antigravity',
        'ollama': '🦙 Ollama'
      };
      
      await ctx.editReply({
        embeds: [{
          color: 0x5865F2,
          title: '🚀 Advanced Agent Runner',
          description: `**Step 3 of 4: Select Role**\n\nProvider: **${providerNames[provider] || provider}**\nWorkspace: \`${workspacePath}\`\n\nRoles define your agent's focus and load context from repository documents (e.g., \`.roles/builder.md\`).`,
          fields: [
            { name: '🔨 Builder', value: 'Build and create code, implement features', inline: true },
            { name: '🧪 Tester', value: 'Test code, ensure quality, find bugs', inline: true },
            { name: '🔍 Investigator', value: 'Investigate issues, analyze systems', inline: true },
            { name: '🏗️ Architect', value: 'Design systems, plan architecture', inline: true },
            { name: '👁️ Reviewer', value: 'Review code, provide feedback', inline: true }
          ],
          footer: { text: 'Select a role to continue. Role documents are loaded from .roles/ folder.' },
          timestamp: true
        }],
        components: [roleRow]
      });
      return;
    }
    
    // Handle run-adv role selection
    if (customId.startsWith('run-adv-role:') && values && values.length > 0) {
      await ctx.deferUpdate();
      const parts = customId.split(':');
      const provider = parts[1];
      const workspacePath = parts.slice(2).join(':'); // Robust handling of paths with colons
      const role = values[0];
      
      // Import role definitions
      const { ROLE_DEFINITIONS } = await import("../agent/index.ts");
      const roleDef = ROLE_DEFINITIONS[role];
      
      if (!roleDef) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Invalid Role',
            description: 'The selected role is not valid.',
            timestamp: true
          }],
          components: []
        });
        return;
      }
      
      // Step 4: Go directly to model selection
      const { listAvailableModels } = await import("../util/list-models.ts");
      
      let availableModels: Array<{ name: string; displayName: string }> = [];
      
      // Get models based on provider
      try {
        if (provider === 'gemini-api' || provider === 'antigravity') {
          const allModels = await listAvailableModels();
          availableModels = allModels.map(m => ({ name: m.name, displayName: m.displayName }));
        } else if (provider === 'cursor') {
          // Fetch models from Cursor provider
          const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
          const cursorProvider = AgentProviderRegistry.getProvider('cursor');
          if (cursorProvider) {
            const models = await cursorProvider.listModels();
            availableModels = models.map(name => {
              // Create friendly display names
              let displayName = name;
              if (name === 'auto') {
                displayName = 'Auto (Let Cursor choose)';
              } else if (name === 'sonnet-4.5') {
                displayName = 'Claude Sonnet 4.5';
              } else if (name === 'sonnet-4.5-thinking') {
                displayName = 'Claude Sonnet 4.5 Thinking';
              } else if (name === 'opus-4.5') {
                displayName = 'Claude Opus 4.5';
              } else if (name === 'opus-4.5-thinking') {
                displayName = 'Claude Opus 4.5 Thinking';
              } else if (name === 'opus-4.1') {
                displayName = 'Claude Opus 4.1';
              } else if (name === 'gemini-3-pro') {
                displayName = 'Gemini 3 Pro';
              } else if (name === 'gemini-2.0-flash') {
                displayName = 'Gemini 2.0 Flash';
              } else if (name.startsWith('gpt-5')) {
                displayName = name.toUpperCase().replace(/-/g, ' ');
              } else {
                // Default: capitalize and replace dashes/underscores with spaces
                displayName = name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ');
              }
              return { name, displayName };
            });
          } else {
            // Fallback if Cursor provider is not available
            availableModels = [
              { name: 'auto', displayName: 'Auto (Let Cursor choose)' },
              { name: 'sonnet-4.5', displayName: 'Claude Sonnet 4.5' },
              { name: 'sonnet-4.5-thinking', displayName: 'Claude Sonnet 4.5 Thinking' }
            ];
          }
        } else if (provider === 'claude-cli') {
          availableModels = [
            { name: 'claude-sonnet-4', displayName: 'Claude Sonnet 4' },
            { name: 'claude-opus-4', displayName: 'Claude Opus 4' },
            { name: 'claude-haiku-4', displayName: 'Claude Haiku 4' }
          ];
        } else if (provider === 'ollama') {
          const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
          const ollamaProvider = AgentProviderRegistry.getProvider('ollama');
          if (ollamaProvider) {
            const status = await ollamaProvider.getStatus?.();
            if (status?.available && status.metadata?.models) {
              const models = status.metadata.models as string[];
              availableModels = models.map(name => ({
                name,
                displayName: name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ')
              }));
            }
          }
          if (availableModels.length === 0) {
            availableModels = [
              { name: 'llama3.2', displayName: 'Llama 3.2' },
              { name: 'mistral', displayName: 'Mistral' },
              { name: 'codellama', displayName: 'CodeLlama' }
            ];
          }
        } else {
          const allModels = await listAvailableModels();
          availableModels = allModels.map(m => ({ name: m.name, displayName: m.displayName }));
        }
      } catch {
        availableModels = [
          { name: 'gemini-3-flash', displayName: 'Gemini 3 Flash' },
          { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
          { name: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash (Experimental)' },
          { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
          { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' }
        ];
      }
      
      const { StringSelectMenuBuilder: SMBuilder, ActionRowBuilder: ARBuilder, ButtonBuilder } = await import("npm:discord.js@14.14.1");
      
      const modelOptions = availableModels.slice(0, 24).map(model => ({
        label: model.displayName.substring(0, 100),
        description: model.name,
        value: model.name
      }));
      
      // Update customId to include workspacePath if available
      const modelCustomId = workspacePath 
        ? `run-adv-model:${provider}:${role}:${workspacePath}`
        : `run-adv-model:${provider}:${role}`;
      
      const modelMenu = new SMBuilder()
        .setCustomId(modelCustomId)
        .setPlaceholder('Select a model or use auto-select...')
        .addOptions(modelOptions);
      
      const autoSelectCustomId = workspacePath
        ? `run-adv-auto:${provider}:${role}:${workspacePath}`
        : `run-adv-auto:${provider}:${role}`;
        
      const autoSelectButton = new ButtonBuilder()
        .setCustomId(autoSelectCustomId)
        .setLabel('✨ Auto-Select Best Model')
        .setStyle(1); // Primary style
      
      const modelRow = new ARBuilder<any>().addComponents(modelMenu);
      const buttonRow = new ARBuilder<any>().addComponents(autoSelectButton);
      
      await ctx.editReply({
        embeds: [{
          color: 0x5865F2,
          title: '🚀 Advanced Agent Runner',
          description: `**Step 4 of 4: Select Model**\n\nRole: **${roleDef.emoji} ${roleDef.name}**\nProvider: **${provider}**\nWorkspace: \`${workspacePath || 'Default'}\`\n\nChoose a model or use auto-select:`,
          fields: [
            { name: 'Role Description', value: roleDef.description, inline: false },
            { name: 'Available Models', value: `${availableModels.length} models available`, inline: true },
            { name: 'Auto-Select', value: 'Let the system choose the best model', inline: true }
          ],
          footer: { text: 'Select a model or click auto-select' },
          timestamp: true
        }],
        components: [modelRow, buttonRow]
      });
      return;
    }
    
    // Handle run-adv agent selection (DEPRECATED - skip directly to model)
    // This handler is kept for backwards compatibility but should skip to model selection
    if (customId.startsWith('run-adv-agent:') && values && values.length > 0) {
      await ctx.deferUpdate();
      const parts = customId.split(':');
      const provider = parts[1];
      const role = parts[2];
      // Ignore agentId - not used anymore
      
      // Redirect to model selection (same as role handler)
      const { listAvailableModels } = await import("../util/list-models.ts");
      
      let availableModels: Array<{ name: string; displayName: string }> = [];
      
      // Get models based on provider
      try {
        if (provider === 'gemini-api' || provider === 'antigravity') {
          const allModels = await listAvailableModels();
          availableModels = allModels.map(m => ({ name: m.name, displayName: m.displayName }));
        } else if (provider === 'cursor') {
          // Fetch models from Cursor provider
          const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
          const cursorProvider = AgentProviderRegistry.getProvider('cursor');
          if (cursorProvider) {
            const models = await cursorProvider.listModels();
            availableModels = models.map(name => {
              // Create friendly display names
              let displayName = name;
              if (name === 'auto') {
                displayName = 'Auto (Let Cursor choose)';
              } else if (name === 'sonnet-4.5') {
                displayName = 'Claude Sonnet 4.5';
              } else if (name === 'sonnet-4.5-thinking') {
                displayName = 'Claude Sonnet 4.5 Thinking';
              } else if (name === 'opus-4.5') {
                displayName = 'Claude Opus 4.5';
              } else if (name === 'opus-4.5-thinking') {
                displayName = 'Claude Opus 4.5 Thinking';
              } else if (name === 'opus-4.1') {
                displayName = 'Claude Opus 4.1';
              } else if (name === 'gemini-3-pro') {
                displayName = 'Gemini 3 Pro';
              } else if (name === 'gemini-2.0-flash') {
                displayName = 'Gemini 2.0 Flash';
              } else if (name.startsWith('gpt-5')) {
                displayName = name.toUpperCase().replace(/-/g, ' ');
              } else {
                // Default: capitalize and replace dashes/underscores with spaces
                displayName = name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ');
              }
              return { name, displayName };
            });
          } else {
            // Fallback if Cursor provider is not available
            availableModels = [
              { name: 'auto', displayName: 'Auto (Let Cursor choose)' },
              { name: 'sonnet-4.5', displayName: 'Claude Sonnet 4.5' },
              { name: 'sonnet-4.5-thinking', displayName: 'Claude Sonnet 4.5 Thinking' }
            ];
          }
        } else if (provider === 'claude-cli') {
          // Claude CLI models
          availableModels = [
            { name: 'claude-sonnet-4', displayName: 'Claude Sonnet 4' },
            { name: 'claude-opus-4', displayName: 'Claude Opus 4' },
            { name: 'claude-haiku-4', displayName: 'Claude Haiku 4' }
          ];
        } else if (provider === 'ollama') {
          // Fetch models from Ollama provider
          const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
          const ollamaProvider = AgentProviderRegistry.getProvider('ollama');
          if (ollamaProvider) {
            const status = await ollamaProvider.getStatus?.();
            if (status?.available && status.metadata?.models) {
              const models = status.metadata.models as string[];
              availableModels = models.map(name => ({
                name,
                displayName: name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ')
              }));
            } else {
              // Fallback if Ollama is not available
              availableModels = [
                { name: 'llama3.2', displayName: 'Llama 3.2' },
                { name: 'mistral', displayName: 'Mistral' },
                { name: 'codellama', displayName: 'CodeLlama' }
              ];
            }
          } else {
            availableModels = [
              { name: 'llama3.2', displayName: 'Llama 3.2' },
              { name: 'mistral', displayName: 'Mistral' },
              { name: 'codellama', displayName: 'CodeLlama' }
            ];
          }
        } else {
          const allModels = await listAvailableModels();
          availableModels = allModels.map(m => ({ name: m.name, displayName: m.displayName }));
        }
      } catch {
        // Fallback models
        availableModels = [
          { name: 'gemini-3-flash', displayName: 'Gemini 3 Flash' },
          { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
          { name: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash (Experimental)' },
          { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' }
        ];
      }
      
      const { StringSelectMenuBuilder: SMBuilder, ActionRowBuilder: ARBuilder, ButtonBuilder } = await import("npm:discord.js@14.14.1");
      
      const modelOptions = availableModels.slice(0, 24).map(model => ({
        label: model.displayName.substring(0, 100),
        description: model.name,
        value: model.name
      }));
      
      const modelMenu = new SMBuilder()
        .setCustomId(`run-adv-model:${provider}:${role}`)
        .setPlaceholder('Select a model or use auto-select...')
        .addOptions(modelOptions);
      
      const autoSelectButton = new ButtonBuilder()
        .setCustomId(`run-adv-auto:${provider}:${role}`)
        .setLabel('✨ Auto-Select Best Model')
        .setStyle(1);
      
      const modelRow = new ARBuilder<any>().addComponents(modelMenu);
      const buttonRow = new ARBuilder<any>().addComponents(autoSelectButton);
      
      const { ROLE_DEFINITIONS } = await import("../agent/index.ts");
      const roleDef = ROLE_DEFINITIONS[role];
      
      await ctx.editReply({
        embeds: [{
          color: 0x5865F2,
          title: '🚀 Advanced Agent Runner',
          description: `**Step 3: Select Model**\n\nRole: **${roleDef?.emoji || ''} ${roleDef?.name || role}**\n\nChoose a model or use auto-select:`,
          fields: [
            { name: 'Role Description', value: roleDef?.description || 'Custom role', inline: false },
            { name: 'Available Models', value: `${availableModels.length} models available`, inline: true },
            { name: 'Auto-Select', value: 'Let the system choose the best model', inline: true }
          ],
          footer: { text: 'Select a model or click auto-select' },
          timestamp: true
        }],
        components: [modelRow, buttonRow]
      });
      return;
    }
    
    // Handle run-adv model selection
    if (customId.startsWith('run-adv-model:') && values && values.length > 0) {
      await ctx.deferUpdate();
      const parts = customId.split(':');
      const provider = parts[1];
      const role = parts[2];
      const workspacePath = parts.slice(3).join(':'); // Robust handling of paths with colons
      const model = values[0];
      
      // Start the agent session
      const { setAgentSession, PREDEFINED_AGENTS, ROLE_DEFINITIONS } = await import("../agent/index.ts");
      const userId = ctx.user.id;
      const channelId = ctx.channelId || ctx.channel?.id;
      
      if (!channelId) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Error',
            description: 'Could not determine channel ID.',
            timestamp: true
          }],
          components: []
        });
        return;
      }
      
      // Use general-assistant as base agent
      const agentId = 'general-assistant';
      
      // Set the agent session with provider and workspace override
      setAgentSession(userId, channelId, agentId, role, workspacePath);
      
      // Get the agent and role definition
      const agent = PREDEFINED_AGENTS[agentId];
      const roleDef = ROLE_DEFINITIONS[role];
      
      // Map provider selection to agent client type
      const providerToClient: Record<string, 'claude' | 'cursor' | 'antigravity' | 'ollama'> = {
        'cursor': 'cursor',
        'claude-cli': 'claude',
        'gemini-api': 'antigravity',
        'antigravity': 'antigravity',
        'ollama': 'ollama'
      };
      
      // Override agent config for this session
      if (agent && providerToClient[provider]) {
        agent.client = providerToClient[provider];
        agent.model = model; // Also update the model
        // Inject role into system prompt
        if (roleDef) {
          agent.systemPrompt = `${agent.systemPrompt}\n\n${roleDef.systemPromptAddition}`;
        }
      }
      
      const providerNames: Record<string, string> = {
        'cursor': '💻 Cursor',
        'claude-cli': '🤖 Claude CLI',
        'gemini-api': '🚀 Gemini API',
        'antigravity': '⚡ Antigravity',
        'ollama': '🦙 Ollama'
      };
      
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Agent Session Started',
          description: `**Role:** ${roleDef?.emoji || ''} ${roleDef?.name || role}\n**Provider:** ${providerNames[provider] || provider}\n**Model:** ${model}\n**Workspace:** \`${workspacePath || 'Default'}\`\n\n${roleDef?.description || ''}\n\nYou can now chat with the agent!`,
          fields: [
            { name: 'Role', value: `${roleDef?.emoji || ''} ${roleDef?.name || role}`, inline: true },
            { name: 'Provider', value: providerNames[provider] || provider, inline: true },
            { name: 'Model', value: model, inline: true },
            { name: 'Workspace', value: `\`${workspacePath || 'Default'}\``, inline: false }
          ],
          footer: { text: 'Start chatting to interact with the agent' },
          timestamp: true
        }],
        components: []
      });
      return;
    }
    
    // Handle IDE sync selection
    if (customId === 'select-ide-sync' && values && values.length > 0) {
      await ctx.deferUpdate();
      
      // Value format: "ide:name:filepath"
      const [, ideName, ...pathParts] = values[0].split(':');
      const filePath = pathParts.join(':'); // Rejoin in case path has colons
      
      try {
        // Determine the command based on IDE
        let command: string;
        switch (ideName) {
          case 'cursor':
            command = 'cursor';
            break;
          case 'vs code':
            command = 'code';
            break;
          case 'zed':
            command = 'zed';
            break;
          case 'windsurf':
            command = 'windsurf';
            break;
          default:
            command = 'code'; // Fallback to VS Code
        }
        
        // Open the file in the selected IDE
        const openCmd = new Deno.Command(command, {
          args: [filePath],
          stdout: 'null',
          stderr: 'null',
        });
        
        await openCmd.spawn();
        
        await ctx.editReply({
          embeds: [{
            color: 0x00ff00,
            title: `✅ Opened in ${ideName.charAt(0).toUpperCase() + ideName.slice(1)}`,
            description: `The conversation file has been opened.\n\n**To reference in chat:**\n\`@${filePath.split('/').pop()}\` - include this conversation context`,
            fields: [
              { name: 'File', value: `\`${filePath}\``, inline: false },
              { name: 'Tip', value: 'Use the `@` symbol in your IDE chat to reference this file for context.', inline: false }
            ],
            timestamp: true
          }],
          components: []
        });
        
        return;
      } catch (error) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Failed to Open IDE',
            description: `Error: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: true
          }],
          components: []
        });
        return;
      }
    }
    
    // Default: acknowledge the interaction
    await ctx.update({ content: 'Selection received', components: [] }).catch(() => {});
  }

  // Button handler - completely generic
  async function handleButton(interaction: ButtonInteraction) {
    // Channel restriction: if routing is disabled, only respond to own channel
    if (!enableChannelRouting) {
      if (!myChannel || interaction.channelId !== myChannel.id) {
        return;
      }
    }
    
    const ctx = await createInteractionContext(interaction);
    const buttonId = interaction.customId;
    
    // Handle run-adv auto-select button
    if (buttonId.startsWith('run-adv-auto:')) {
      await ctx.deferUpdate();
      const parts = buttonId.split(':');
      const provider = parts[1];
      const role = parts[2];
      const workspacePath = parts.slice(3).join(':'); // Robust handling of paths with colons
      
      // Auto-select best model based on role
      let selectedModel = 'gemini-3-flash'; // Default
      
      try {
        if (provider === 'ollama') {
          // For Ollama, prefer faster/smaller models for better performance
          const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
          const ollamaProvider = AgentProviderRegistry.getProvider('ollama');
          if (ollamaProvider) {
            const status = await ollamaProvider.getStatus?.();
            if (status?.available && status.metadata?.models) {
              const models = status.metadata.models as string[];
              // Prefer: 1.5B/7B (fast) > 14B (balanced) > others
              const fastModels = models.filter(m => 
                m.includes('1.5b') || m.includes('7b') || m.includes('3b')
              );
              const mediumModels = models.filter(m => 
                m.includes('14b') && !m.includes('32b')
              );
              selectedModel = fastModels[0] || mediumModels[0] || models[0] || 'deepseek-r1:1.5b';
            } else {
              selectedModel = 'deepseek-r1:1.5b'; // Fast fallback
            }
          } else {
            selectedModel = 'deepseek-r1:1.5b'; // Fast fallback
          }
        } else if (provider === 'cursor') {
          selectedModel = 'auto'; // Let Cursor choose
        } else if (provider === 'claude-cli') {
          selectedModel = 'claude-sonnet-4'; // Best Claude model
        } else {
          // For Gemini/Antigravity, use existing logic
          const { getModelsForAgents } = await import("../util/list-models.ts");
          const { manager, coder, architect } = await getModelsForAgents();
          
          // Select best model based on role
          if (role === 'builder') {
            selectedModel = coder.length > 0 ? coder[0].name : manager[0]?.name || selectedModel;
          } else if (role === 'tester') {
            selectedModel = manager.length > 0 ? manager[0].name : selectedModel;
          } else if (role === 'investigator') {
            selectedModel = architect.length > 0 ? architect[0].name : coder[0]?.name || selectedModel;
          }
        }
      } catch {
        // Use default if model fetching fails
        if (provider === 'ollama') {
          selectedModel = 'deepseek-r1:1.5b'; // Fast default
        } else if (provider === 'cursor') {
          selectedModel = 'auto';
        } else if (provider === 'claude-cli') {
          selectedModel = 'claude-sonnet-4';
        }
      }
      
      // Start the agent session
      const { setAgentSession, PREDEFINED_AGENTS, ROLE_DEFINITIONS } = await import("../agent/index.ts");
      const userId = ctx.user.id;
      const channelId = ctx.channelId || ctx.channel?.id;
      
      if (!channelId) {
        await ctx.editReply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Error',
            description: 'Could not determine channel ID.',
            timestamp: true
          }],
          components: []
        });
        return;
      }
      
      // Use general-assistant as base agent
      const agentId = 'general-assistant';
      
      // Set the agent session with provider and workspace override
      setAgentSession(userId, channelId, agentId, role, workspacePath);
      
      // Get the agent and role definition
      const agent = PREDEFINED_AGENTS[agentId];
      const roleDef = ROLE_DEFINITIONS[role];
      
      // Map provider selection to agent client type
      const providerToClient: Record<string, 'claude' | 'cursor' | 'antigravity' | 'ollama'> = {
        'cursor': 'cursor',
        'claude-cli': 'claude',
        'gemini-api': 'antigravity',
        'antigravity': 'antigravity',
        'ollama': 'ollama'
      };
      
      // Override agent config for this session
      if (agent && providerToClient[provider]) {
        agent.client = providerToClient[provider];
        agent.model = selectedModel; // Also update the model
        // Inject role into system prompt
        if (roleDef) {
          agent.systemPrompt = `${agent.systemPrompt}\n\n${roleDef.systemPromptAddition}`;
        }
      }
      
      const providerNames: Record<string, string> = {
        'cursor': '💻 Cursor',
        'claude-cli': '🤖 Claude CLI',
        'gemini-api': '🚀 Gemini API',
        'antigravity': '⚡ Antigravity',
        'ollama': '🦙 Ollama'
      };
      
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Agent Session Started (Auto-Selected)',
          description: `**Role:** ${roleDef?.emoji || ''} ${roleDef?.name || role}\n**Provider:** ${providerNames[provider] || provider}\n**Model:** ${selectedModel} (auto-selected)\n**Workspace:** \`${workspacePath || 'Default'}\`\n\n${roleDef?.description || ''}\n\nYou can now chat with the agent!`,
          fields: [
            { name: 'Role', value: `${roleDef?.emoji || ''} ${roleDef?.name || role}`, inline: true },
            { name: 'Provider', value: providerNames[provider] || provider, inline: true },
            { name: 'Model', value: selectedModel, inline: true },
            { name: 'Workspace', value: `\`${workspacePath || 'Default'}\``, inline: false }
          ],
          footer: { text: 'Start chatting to interact with the agent' },
          timestamp: true
        }],
        components: []
      });
      return;
    }
    
    // Handle pagination buttons first
    if (interaction.customId.startsWith('pagination:')) {
      try {
        const paginationResult = handlePaginationInteraction(interaction.customId);
        if (paginationResult) {
          await ctx.update({
            embeds: [paginationResult.embed],
            components: paginationResult.components ? [{ type: 'actionRow', components: paginationResult.components }] : []
          });
          return;
        }
      } catch (error) {
        console.error('Error handling pagination:', error);
        if (crashHandler) {
          await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'pagination', 'Button interaction');
        }
      }
    }
    
    // Handle repo creation buttons
    if (buttonId.startsWith('repo-create-') || buttonId.startsWith('repo-use-similar-') || 
        buttonId.startsWith('repo-skip-desc-') || buttonId.startsWith('repo-github-') || 
        buttonId.startsWith('repo-visibility-')) {
      try {
        await ctx.deferUpdate();
        const { handleRepoCreationButton } = await import("../util/repo-creation-handler.ts");
        const result = await handleRepoCreationButton(buttonId, ctx.user.id, ctx.channelId || '');
        
        if (result) {
          if (result.complete) {
            // Final step - update and invalidate channel cache
            await ctx.editReply({
              embeds: [result.embed],
              components: result.components || []
            });
            // Invalidate cache so next message will use the new repo
            channelContextManager.invalidateCache(ctx.channelId || '');
          } else {
            // Intermediate step - update with new prompt
            await ctx.editReply({
              embeds: [result.embed],
              components: result.components || []
            });
          }
          return;
        }
      } catch (error) {
        console.error('Error handling repo creation button:', error);
        await ctx.editReply({
          embeds: [{
            color: 0xFF0000,
            title: '❌ Error',
            description: `Failed to process repository creation: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: true
          }]
        });
        return;
      }
    }
    
    const handler = buttonHandlers.get(interaction.customId);
    
    if (handler) {
      try {
        await handler(ctx);
      } catch (error) {
        console.error(`Error handling button ${interaction.customId}:`, error);
        if (crashHandler) {
          await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'button', `ID: ${interaction.customId}`);
        }
        try {
          await ctx.followUp({
            content: `Error handling button: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ephemeral: true
          });
        } catch {
          // Ignore errors when sending error message
        }
      }
      return;
    }
    
    // Handle dynamic button IDs with patterns
    // (buttonId already declared at the start of this function)
    
    // Handle continue with session ID pattern: "continue:sessionId"
    if (buttonId.startsWith('continue:')) {
      const sessionId = buttonId.split(':')[1];
      const continueHandler = buttonHandlers.get('continue');
      if (continueHandler) {
        try {
          await continueHandler(ctx);
        } catch (error) {
          console.error(`Error handling continue button:`, error);
        }
      }
      return;
    }
    
    // Handle copy session ID pattern: "copy-session:sessionId"
    if (buttonId.startsWith('copy-session:')) {
      const sessionId = buttonId.split(':')[1];
      try {
        await ctx.update({
          embeds: [{
            color: 0x00ff00,
            title: '📋 Session ID',
            description: `\`${sessionId}\``,
            fields: [
              { name: 'Usage', value: 'Copy this ID to use with `/claude session_id:...`', inline: false }
            ],
            timestamp: new Date().toISOString()
          }]
        });
      } catch (error) {
        console.error(`Error handling copy-session button:`, error);
      }
      return;
    }
    
    // Handle expand content pattern: "expand:contentId" 
    if (buttonId.startsWith('expand:')) {
      const expandId = buttonId.substring(7);
      
      // Try to find a handler that can process expand buttons
      // Prioritize 'claude' handler as it specifically handles expand buttons
      const claudeHandler = handlers.get('claude');
      if (claudeHandler?.handleButton) {
        try {
          await claudeHandler.handleButton(ctx, buttonId);
          return;
        } catch (error) {
          console.error(`Error in claude handleButton for expand:`, error);
        }
      }
      
      // Try other handlers that might handle expand buttons
      for (const [handlerName, handler] of handlers.entries()) {
        // Skip 'claude' handler as we already tried it
        if (handlerName === 'claude') continue;
        
        if (handler.handleButton) {
          try {
            await handler.handleButton(ctx, buttonId);
            return;
          } catch (error) {
            console.error(`Error in ${handlerName} handleButton for expand:`, error);
          }
        }
      }
      
      // Fallback: Try to get content from expandableContent map
      try {
        const { expandableContent } = await import("../claude/discord-sender.ts");
        const fullContent = expandableContent.get(expandId);
        
        if (fullContent) {
          // Account for code block markers (```\n\n``` = 7 chars)
          const maxLength = DISCORD_LIMITS.EMBED_DESCRIPTION - 20; // Safety margin
          const chunks = splitText(fullContent, maxLength, true);
          
          if (chunks.length === 1) {
            await ctx.update({
              embeds: [{
                color: 0x0099ff,
                title: '📖 Full Response',
                description: `\`\`\`\n${chunks[0]}\n\`\`\``,
                timestamp: new Date().toISOString()
              }],
              components: [{
                type: 'actionRow',
                components: [{
                  type: 'button',
                  customId: 'collapse-content',
                  label: '🔼 Collapse',
                  style: 'secondary'
                }]
              }]
            });
          } else {
            // Content is too large for single embed, show first chunk with pagination info
            await ctx.update({
              embeds: [{
                color: 0x0099ff,
                title: `📖 Full Response (1/${chunks.length})`,
                description: `\`\`\`\n${chunks[0]}\n\`\`\``,
                fields: [
                  { name: 'Note', value: `Content is very large (${fullContent.length} chars). Showing part 1 of ${chunks.length}.`, inline: false }
                ],
                timestamp: new Date().toISOString()
              }],
              components: [{
                type: 'actionRow',
                components: [{
                  type: 'button',
                  customId: 'collapse-content',
                  label: '🔼 Collapse',
                  style: 'secondary'
                }]
              }]
            });
            
            // Send remaining chunks as follow-ups
            for (let i = 1; i < chunks.length; i++) {
              await ctx.followUp({
                embeds: [{
                  color: 0x0099ff,
                  title: `📖 Full Response (${i + 1}/${chunks.length})`,
                  description: `\`\`\`\n${chunks[i]}\n\`\`\``,
                  timestamp: new Date().toISOString()
                }]
              });
            }
          }
        } else {
          await ctx.update({
            embeds: [{
              color: 0xffaa00,
              title: '📖 Content Not Available',
              description: 'The full content is no longer available for expansion.',
              timestamp: new Date().toISOString()
            }],
            components: []
          });
        }
      } catch (error) {
        console.error(`Error handling expand button fallback:`, error);
        await ctx.update({
          embeds: [{
            color: 0xff0000,
            title: '❌ Error',
            description: 'Failed to expand content.',
            timestamp: new Date().toISOString()
          }],
          components: []
        });
      }
      return;
    }
    
    // Handle agent spawn approval buttons: "agent_spawn_approve:agentName" or "agent_spawn_decline:agentName"
    if (buttonId.startsWith('agent_spawn_approve:') || buttonId.startsWith('agent_spawn_decline:')) {
      console.log(`[ButtonHandler] Routing agent button: ${buttonId}`);
      // Try to find the agent command handler
      const agentHandler = handlers.get('agent');
      if (agentHandler?.handleButton) {
        try {
          await agentHandler.handleButton(ctx, buttonId);
          return;
        } catch (error) {
          console.error(`Error in agent handleButton for ${buttonId}:`, error);
          if (crashHandler) {
            await crashHandler.reportCrash('main', error instanceof Error ? error : new Error(String(error)), 'button', `Agent button: ${buttonId}`);
          }
          try {
            await ctx.followUp({
              content: `Error handling agent button: ${error instanceof Error ? error.message : 'Unknown error'}`,
              ephemeral: true
            });
          } catch {
            // Ignore errors when sending error message
          }
        }
      } else {
        console.warn(`[ButtonHandler] Agent command handler not found for button: ${buttonId}`);
      }
      return;
    }
    
    // If no specific handler found, try to delegate to command handlers with handleButton method
    const commandHandler = Array.from(handlers.values()).find(h => h.handleButton);
    if (commandHandler?.handleButton) {
      try {
        await commandHandler.handleButton(ctx, interaction.customId);
      } catch (error) {
        console.error(`Error handling button ${interaction.customId} via command handler:`, error);
        try {
          await ctx.followUp({
            content: `Error handling button: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ephemeral: true
          });
        } catch {
          // Ignore errors when sending error message
        }
      }
    } else {
      console.warn(`No handler found for button: ${interaction.customId}`);
    }
  }
  
  // Command registration moved to ClientReady
  
  // Event handlers
  client.once(Events.ClientReady, async () => {
    console.log(`Bot logged in: ${client.user?.tag}`);
    console.log(`Category: ${actualCategoryName}`);
    console.log(`Branch: ${branchName}`);
    console.log(`Working directory: ${workDir}`);

    
    
    const guilds = client.guilds.cache;
    if (guilds.size === 0) {
      console.error('Error: Bot is not in any servers');
      return;
    }
    
    const guild = guilds.first();
    if (!guild) {
      console.error('Error: Guild not found');
      return;
    }
    
    try {
      myChannel = await ensureChannelExists(guild);
      console.log(`Using channel "${myChannel.name}" (ID: ${myChannel.id})`);

// Register Guild Commands
    const rest = new REST({ version: '10' }).setToken(discordToken);
    const commandsData = commands.map(cmd => cmd.toJSON());

    try {
      console.log('Clearing global commands...');
      await rest.put(Routes.applicationCommands(applicationId), { body: [] });


      
      console.log(`Clearing old guild commands for guild ${guild.id}...`);
      await rest.put(
        Routes.applicationGuildCommands(applicationId, guild.id),
        { body: [] },
      );
      
      console.log(`Registering new slash commands for guild ${guild.id}...`);
      console.log(`Commands to register: ${commandsData.map(c => c.name).join(', ')}`);
      await rest.put(
        Routes.applicationGuildCommands(applicationId, guild.id),
        { body: commandsData },
      );
      console.log(`✅ Successfully registered ${commandsData.length} guild commands`);
    } catch (error) {
      console.error('Failed to register slash commands:', error);
    }
      
      // Send startup message
      await myChannel.send(convertMessageContent({
        embeds: [{
          color: 0x00ff00,
          title: '🚀 Startup Complete',
          description: `Claude Code bot for branch ${branchName} has started`,
          fields: [
            { name: 'Category', value: actualCategoryName, inline: true },
            { name: 'Repository', value: repoName, inline: true },
            { name: 'Branch', value: branchName, inline: true },
            { name: 'Working Directory', value: `\`${workDir}\``, inline: false }
          ],
          timestamp: new Date().toISOString()
        }]
      })).catch(err => {
        console.error('[Startup] Failed to send startup message:', err);
      });
      
      // Model testing disabled for now - can be re-enabled later
      // TODO: Re-enable model testing once stable
    } catch (error) {
      console.error('Channel creation/retrieval error:', error);
      console.error('Full error details:', error instanceof Error ? error.stack : error);
    }
  });
  
  // Handle messages (natural chat with active agents + @mentions)
  client.on(Events.MessageCreate, async (message) => {
    // Ignore own messages
    if (message.author.bot) return;
    
    console.log(`[MessageCreate] RECEIVED: from ${message.author.tag} (${message.author.id}) in channel ${message.channelId}`);
    console.log(`[MessageCreate] CONTENT: "${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}"`);

    // Get channel context for multi-project routing
    let channelContext = undefined;
    if (enableChannelRouting && message.channel) {
      try {
        const contextResult = await channelContextManager.getChannelContext(message.channel);
        console.log(`[MessageCreate] CONTEXT_RESULT: ${JSON.stringify(contextResult)}`);
        
        // Check if category not found and needs user prompt
        if (contextResult && 'needsUserPrompt' in contextResult) {
          // Category not found - check if there's an active creation flow
          const { hasActiveCreation, handleDescriptionMessage, getCreationState } = await import("../util/repo-creation-handler.ts");
          
          if (hasActiveCreation(message.channelId)) {
            // Check if this is a description message (user is in description step)
            const state = getCreationState(message.channelId);
            if (state && state.step === 'description') {
              const descResult = await handleDescriptionMessage(message.channelId, message.content);
              if (descResult) {
                await message.channel.send({
                  embeds: [descResult.embed],
                  components: descResult.components,
                });
                return;
              }
            }
            // If not in description step, ignore the message (wait for button interaction)
            return;
          } else {
            // Start repo creation flow only if this is the first message (not a regular chat)
            // Only show prompt if there's no active session and no mention
            const activeSession = getActiveSession(message.author.id, message.channelId);
            const isMention = message.mentions.has(client.user!.id);
            
            if (!activeSession && !isMention) {
              // Start repo creation flow
              const { startRepoCreationFlow } = await import("../util/repo-creation-handler.ts");
              const { embed, components } = await startRepoCreationFlow(
                contextResult.categoryName,
                message.channelId,
                message.author.id,
                contextResult.similarFolders
              );
              await message.channel.send({
                embeds: [embed],
                components,
              });
              return;
            }
            // If there's an active session or mention, continue with normal flow (will use default workDir)
          }
        } else if (contextResult && 'projectPath' in contextResult) {
          channelContext = contextResult;
          console.log(`[MessageCreate] Channel context: ${channelContext.projectPath} (source: ${channelContext.source})`);
        }
      } catch (error) {
        console.warn(`[MessageCreate] Error getting channel context: ${error}`);
      }
    }
    
    // Channel restriction: if routing is disabled, only respond to own channel
    // If routing is enabled, respond to any channel with valid context (or own channel as fallback)
    if (!enableChannelRouting) {
      if (!myChannel || message.channelId !== myChannel.id) return;
    } else {
      // With routing enabled, allow messages in any channel, but prefer channels with context
      if (!channelContext && (!myChannel || message.channelId !== myChannel.id)) {
        // No context and not our channel - skip (could optionally log)
        return;
      }
    }

    console.log(`[MessageCreate] Received message from ${message.author.username} (${message.author.id}) in channel ${message.channelId}`);
    console.log(`[MessageCreate] Message content: "${message.content}"`);

    // Check for active agent session (natural chat flow)
    const activeSession = getActiveSession(message.author.id, message.channelId);
    const isMention = message.mentions.has(client.user!.id);

    console.log(`[MessageCreate] Active session:`, activeSession ? `${activeSession.agentName}` : 'none');
    console.log(`[MessageCreate] Is mention:`, isMention);

    // Skip if no active session and no @mention
    if (!activeSession && !isMention) {
      console.log(`[MessageCreate] Skipping - no active session and no @mention`);
      return;
    }

    try {
      // Extract prompt (remove the mention)
      const prompt = message.content.replace(/<@!?\d+>/g, '').trim();
      if (!prompt) return;

      const sessionInfo = activeSession ? ` (session: ${activeSession.agentName})` : ' (@mention)';
      console.log(`[MessageHandler] Received message${sessionInfo}: "${prompt.substring(0, 50)}..."`);

      // Find agent command handler
      const agentHandler = handlers.get('agent');
      if (!agentHandler) {
        console.error('[MessageHandler] Agent command handler not found');
        await message.reply({
          embeds: [{
            color: 0xFF0000,
            title: '❌ Error',
            description: 'Agent command not available',
          }]
        });
        return;
      }

      // Determine which agent to use: active session or default
      // Check if user explicitly mentioned a provider in their message
      const { getActiveAgents, PREDEFINED_AGENTS } = await import("../agent/index.ts");
      const activeAgents = getActiveAgents(message.author.id, message.channelId);
      
      let targetAgent = activeSession?.agentName || 'general-assistant';
      
      // Detect provider mentions in message (case-insensitive)
      const messageLower = prompt.toLowerCase();
      const providerMentions: Record<string, { client: 'claude' | 'cursor' | 'antigravity' | 'ollama'; agentNames: string[] }> = {
        'ollama': { client: 'ollama', agentNames: ['general-assistant'] },
        'cursor': { client: 'cursor', agentNames: ['cursor-coder', 'cursor-refactor', 'cursor-debugger', 'cursor-fast'] },
        'claude': { client: 'claude', agentNames: ['general-assistant', 'code-reviewer', 'architect'] },
        'antigravity': { client: 'antigravity', agentNames: ['ag-coder', 'ag-manager', 'ag-architect'] },
        'gemini': { client: 'antigravity', agentNames: ['ag-coder', 'ag-manager', 'ag-architect'] }
      };
      
      // Check if user mentioned a provider
      let detectedClient: 'claude' | 'cursor' | 'antigravity' | 'ollama' | undefined = undefined;
      for (const [provider, config] of Object.entries(providerMentions)) {
        if (messageLower.includes(provider)) {
          detectedClient = config.client;
          // First, try to find an active agent that already has the correct client configured
          const matchingAgent = activeAgents.find(agentName => {
            const agent = PREDEFINED_AGENTS[agentName];
            if (!agent) return false;
            // Check if agent's client matches the requested provider
            return agent.client === config.client;
          });
          
          if (matchingAgent) {
            console.log(`[MessageHandler] User mentioned ${provider}, found matching agent with client=${config.client}: ${matchingAgent}`);
            targetAgent = matchingAgent;
            break;
          }
          
          // If no agent with matching client, try to find by agent name
          const nameMatchingAgent = activeAgents.find(agentName => {
            return config.agentNames.includes(agentName);
          });
          
          if (nameMatchingAgent) {
            console.log(`[MessageHandler] User mentioned ${provider}, using agent: ${nameMatchingAgent}`);
            targetAgent = nameMatchingAgent;
            
            // Note: We don't override the global agent config here anymore
            // Instead we'll handle the client override in the mock interaction/ctx
            // to avoid affecting other users/channels
            if (provider === 'ollama') {
              console.log(`[MessageHandler] Setting client override to ollama for this request`);
            }
            break;
          }
          
          // If still no match and user wants Ollama, use general-assistant if available
          if (provider === 'ollama' && activeAgents.includes('general-assistant')) {
            console.log(`[MessageHandler] User mentioned Ollama, configuring general-assistant with Ollama client`);
            targetAgent = 'general-assistant';
            break;
          }
        }
      }

      // Create mock interaction with proper reply/edit chain
      let replyMessage: any = null;
      let isDeferred = false;

      const mockInteraction: any = {
        user: message.author,
        channel: message.channel,
        guild: message.guild,
        channelId: message.channelId,
        isCommand: () => true,
        options: {
          getString: (name: string, required?: boolean) => {
            if (name === 'action') return 'chat';
            if (name === 'agent_name') return targetAgent;
            if (name === 'message') return prompt;
            return null;
          },
          getBoolean: () => null
        }
      };

      const mockCtx: any = {
        user: message.author,
        channel: message.channel,
        channelId: message.channelId,
        guild: message.guild,
        channelContext, // Include channel context for multi-project routing
        clientOverride: detectedClient,
        deferReply: async (opts?: any) => {
          isDeferred = true;
          replyMessage = await message.reply({
            embeds: [{
              color: 0x5865F2,
              title: '🤖 Processing...',
              description: 'Starting agent conversation...',
              timestamp: new Date().toISOString(),
            }]
          });
        },
        reply: async (opts: any) => {
          if (!replyMessage) {
            replyMessage = await message.reply(opts);
          } else {
            await replyMessage.edit(opts);
          }
        },
        editReply: async (opts: any) => {
          if (replyMessage) {
            await replyMessage.edit(opts);
          } else {
            replyMessage = await message.reply(opts);
          }
        },
        followUp: async (opts: any) => {
          await message.channel.send(opts);
        },
        update: async (opts: any) => {
          if (replyMessage) {
            await replyMessage.edit(opts);
          }
        },
        getString: (name: string, required?: boolean) => mockInteraction.options.getString(name, required),
        getBoolean: (name: string, required?: boolean) => mockInteraction.options.getBoolean(name, required),
        getInteger: () => null
      };

      // Execute agent command with chat action
      console.log('[MessageHandler] Executing agent command...');
      await agentHandler.execute(mockCtx);

    } catch (error) {
      console.error('[MessageHandler] Error:', error);
      await message.reply({
        embeds: [{
          color: 0xFF0000,
          title: '❌ Error',
          description: `Failed to process: ${error}`,
        }]
      }).catch(() => {});
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    console.log(`[InteractionCreate] Received interaction: ${interaction.type}, isCommand: ${interaction.isCommand()}`);
    if (interaction.isCommand()) {
      await handleCommand(interaction as CommandInteraction);
    } else if (interaction.isButton()) {
      await handleButton(interaction as ButtonInteraction);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction as any);
    }
  });
  
  // Login
  await client.login(discordToken);
  
  // Return bot control functions
  return {
    client,
    getChannel() {
      return myChannel;
    },
    updateBotSettings(settings: { mentionEnabled: boolean; mentionUserId: string | null }) {
      botSettings.mentionEnabled = settings.mentionEnabled;
      botSettings.mentionUserId = settings.mentionUserId;
    },
    getBotSettings() {
      return { ...botSettings };
    }
  };
}