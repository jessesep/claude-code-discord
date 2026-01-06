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

import { sanitizeChannelName, DISCORD_LIMITS, splitText } from "./utils.ts";
import { handlePaginationInteraction } from "./pagination.ts";
import type { 
  BotConfig, 
  CommandHandlers, 
  ButtonHandlers,
  MessageContent, 
  InteractionContext,
  BotDependencies
} from "./types.ts";


// ================================
// Helper Functions
// ================================

// deno-lint-ignore no-explicit-any
function convertMessageContent(content: MessageContent): any {
  // deno-lint-ignore no-explicit-any
  const payload: any = {};
  
  if (content.content) payload.content = content.content;
  
  if (content.embeds) {
    payload.embeds = content.embeds.map(e => {
      const embed = new EmbedBuilder();
      if (e.color !== undefined) embed.setColor(e.color);
      if (e.title) embed.setTitle(e.title);
      if (e.description) embed.setDescription(e.description);
      if (e.fields) e.fields.forEach(f => embed.addFields(f));
      if (e.footer) embed.setFooter(e.footer);
      if (e.timestamp) embed.setTimestamp();
      return embed;
    });
  }
  
  if (content.components) {
    // Check if components are already in Discord.js format (ActionRowBuilder instances or toJSON() results)
    // Discord.js ActionRowBuilder instances have a 'toJSON' method
    // Discord.js serialized components have a 'type' property that's a number (1 for ActionRow, 3 for StringSelectMenu)
    const isDiscordJSFormat = content.components.length > 0 && (
      // Check if it's an ActionRowBuilder instance
      (typeof content.components[0] === 'object' && 'toJSON' in content.components[0] && typeof (content.components[0] as any).toJSON === 'function') ||
      // Check if it's a serialized Discord.js component (has numeric type property)
      (typeof content.components[0] === 'object' && 'type' in content.components[0] && typeof (content.components[0] as any).type === 'number')
    );
    
    if (isDiscordJSFormat) {
      // Components are already in Discord.js format
      // Convert ActionRowBuilder instances to serialized format for consistency
      payload.components = content.components.map((comp: any) => {
        // If it's an ActionRowBuilder instance, serialize it
        if (comp && typeof comp === 'object' && 'toJSON' in comp && typeof comp.toJSON === 'function') {
          return comp.toJSON();
        }
        // If it's already serialized (plain object), pass it through
        return comp;
      });
    } else {
      // Convert from MessageContent format (buttons only)
      payload.components = content.components.map(row => {
        const actionRow = new ActionRowBuilder<ButtonBuilder>();
        row.components.forEach(comp => {
          const button = new ButtonBuilder()
            .setCustomId(comp.customId)
            .setLabel(comp.label);
          
          switch (comp.style) {
            case 'primary': button.setStyle(ButtonStyle.Primary); break;
            case 'secondary': button.setStyle(ButtonStyle.Secondary); break;
            case 'success': button.setStyle(ButtonStyle.Success); break;
            case 'danger': button.setStyle(ButtonStyle.Danger); break;
            case 'link': button.setStyle(ButtonStyle.Link); break;
          }
          
          actionRow.addComponents(button);
        });
        return actionRow;
      });
    }
  }
  
  return payload;
}

// ================================
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
  function createInteractionContext(interaction: CommandInteraction | ButtonInteraction | any): InteractionContext {
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
    if (!myChannel || interaction.channelId !== myChannel.id) {
      return;
    }
    
    const ctx = createInteractionContext(interaction);
    const handler = handlers.get(interaction.commandName);
    
    if (!handler) {
      await ctx.reply({
        content: `Unknown command: ${interaction.commandName}`,
        ephemeral: true
      });
      return;
    }
    
    try {
      await handler.execute(ctx);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
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
      } catch {
        // Ignore errors when sending error message
      }
    }
  }
  
  // Select menu handler
  async function handleSelectMenu(interaction: any) {
    if (!myChannel || interaction.channelId !== myChannel.id) {
      return;
    }
    
    const ctx = createInteractionContext(interaction);
    const customId = interaction.customId;
    const values = interaction.values;
    
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
      
      // Step 2: Role selection (include provider in customId)
      const { StringSelectMenuBuilder, ActionRowBuilder } = await import("npm:discord.js@14.14.1");
      
      const roleMenu = new StringSelectMenuBuilder()
        .setCustomId(`run-adv-role:${provider}`)
        .setPlaceholder('Select a role...')
        .addOptions([
          { label: '🔨 Builder', description: 'Build and create code', value: 'builder' },
          { label: '🧪 Tester', description: 'Test and ensure quality', value: 'tester' },
          { label: '🔍 Investigator', description: 'Investigate and analyze', value: 'investigator' }
        ]);
      
      const roleRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleMenu);
      
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
          description: `**Step 2 of 3: Select Role**\n\nProvider: **${providerNames[provider] || provider}**`,
          fields: [
            { name: '🔨 Builder', value: 'Agents specialized in building and creating code', inline: true },
            { name: '🧪 Tester', value: 'Agents specialized in testing and quality assurance', inline: true },
            { name: '🔍 Investigator', value: 'Agents specialized in investigation and analysis', inline: true }
          ],
          footer: { text: 'Select a role to continue' },
          timestamp: true
        }],
        components: [roleRow]
      });
      return;
    }
    
    // Handle run-adv role selection
    if (customId.startsWith('run-adv-role:') && values && values.length > 0) {
      await ctx.deferUpdate();
      const [, provider] = customId.split(':');
      const role = values[0];
      
      // Import role definitions
      const { ROLE_DEFINITIONS, PREDEFINED_AGENTS } = await import("../agent/index.ts");
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
      
      // Step 3a: If builder role, show agent selection (2 agents)
      if (role === 'builder' && roleDef.agents.length > 0) {
        const { StringSelectMenuBuilder, ActionRowBuilder } = await import("npm:discord.js@14.14.1");
        
        const agentMenu = new StringSelectMenuBuilder()
          .setCustomId(`run-adv-agent:${provider}:${role}`)
          .setPlaceholder('Select an agent (2 available)...')
          .addOptions(
            roleDef.agents.slice(0, 2).map(agent => ({
              label: agent.name,
              description: agent.description,
              value: agent.id
            }))
          );
        
        const agentRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(agentMenu);
        
        await ctx.editReply({
          embeds: [{
            color: 0x5865F2,
            title: '🚀 Advanced Agent Runner',
            description: `**Step 3a: Select Agent**\n\nRole: **${roleDef.name}**\n\nChoose one of the available agents:`,
            fields: roleDef.agents.slice(0, 2).map(agent => ({
              name: agent.name,
              value: agent.description,
              inline: false
            })),
            footer: { text: 'Select an agent to continue' },
            timestamp: true
          }],
          components: [agentRow]
        });
        return;
      }
      
      // Step 3b: For tester/investigator, go directly to model selection
      // (They have predefined agents, we'll use the first one)
      const selectedAgent = roleDef.agents[0]?.id || 'code-reviewer';
      
      // Proceed to model selection
      const { getModelsForAgents, listAvailableModels } = await import("../util/list-models.ts");
      
      let availableModels: Array<{ name: string; displayName: string }> = [];
      
      // Get models based on provider
      try {
        if (provider === 'gemini-api' || provider === 'antigravity') {
          const allModels = await listAvailableModels();
          availableModels = allModels.map(m => ({ name: m.name, displayName: m.displayName }));
        } else if (provider === 'cursor') {
          // Cursor uses its own models - show common ones
          availableModels = [
            { name: 'auto', displayName: 'Auto (Let Cursor choose)' },
            { name: 'sonnet-4.5', displayName: 'Claude Sonnet 4.5' },
            { name: 'sonnet-4.5-thinking', displayName: 'Claude Sonnet 4.5 Thinking' }
          ];
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
          { name: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash (Experimental)' },
          { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
          { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' }
        ];
      }
      
      const { StringSelectMenuBuilder: SMBuilder, ActionRowBuilder: ARBuilder, ButtonBuilder } = await import("npm:discord.js@14.14.1");
      
      // Limit to 25 options (Discord limit)
      const modelOptions = availableModels.slice(0, 24).map(model => ({
        label: model.displayName.substring(0, 100),
        description: model.name,
        value: model.name
      }));
      
      const modelMenu = new SMBuilder()
        .setCustomId(`run-adv-model:${provider}:${role}:${selectedAgent}`)
        .setPlaceholder('Select a model or use auto-select...')
        .addOptions(modelOptions);
      
      const autoSelectButton = new ButtonBuilder()
        .setCustomId(`run-adv-auto:${provider}:${role}:${selectedAgent}`)
        .setLabel('✨ Auto-Select Best Model')
        .setStyle(1); // Primary style
      
      const modelRow = new ARBuilder<SMBuilder>().addComponents(modelMenu);
      const buttonRow = new ARBuilder<ButtonBuilder>().addComponents(autoSelectButton);
      
      await ctx.editReply({
        embeds: [{
          color: 0x5865F2,
          title: '🚀 Advanced Agent Runner',
          description: `**Step 3: Select Model**\n\nRole: **${roleDef.name}**\nAgent: **${roleDef.agents[0]?.name || 'Default'}**\n\nChoose a model or use auto-select:`,
          fields: [
            { name: 'Available Models', value: `${availableModels.length} models available`, inline: false },
            { name: 'Auto-Select', value: 'Let the system choose the best model for this task', inline: false }
          ],
          footer: { text: 'Select a model or click auto-select' },
          timestamp: true
        }],
        components: [modelRow, buttonRow]
      });
      return;
    }
    
    // Handle run-adv agent selection (for builder role)
    if (customId.startsWith('run-adv-agent:') && values && values.length > 0) {
      await ctx.deferUpdate();
      const parts = customId.split(':');
      const provider = parts[1];
      const role = parts[2];
      const agentId = values[0];
      
      // Proceed to model selection
      const { listAvailableModels } = await import("../util/list-models.ts");
      
      let availableModels: Array<{ name: string; displayName: string }> = [];
      
      // Get models based on provider
      try {
        if (provider === 'gemini-api' || provider === 'antigravity') {
          const allModels = await listAvailableModels();
          availableModels = allModels.map(m => ({ name: m.name, displayName: m.displayName }));
        } else if (provider === 'cursor') {
          // Cursor uses its own models
          availableModels = [
            { name: 'auto', displayName: 'Auto (Let Cursor choose)' },
            { name: 'sonnet-4.5', displayName: 'Claude Sonnet 4.5' },
            { name: 'sonnet-4.5-thinking', displayName: 'Claude Sonnet 4.5 Thinking' }
          ];
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
        .setCustomId(`run-adv-model:${provider}:${role}:${agentId}`)
        .setPlaceholder('Select a model or use auto-select...')
        .addOptions(modelOptions);
      
      const autoSelectButton = new ButtonBuilder()
        .setCustomId(`run-adv-auto:${provider}:${role}:${agentId}`)
        .setLabel('✨ Auto-Select Best Model')
        .setStyle(1);
      
      const modelRow = new ARBuilder<SMBuilder>().addComponents(modelMenu);
      const buttonRow = new ARBuilder<ButtonBuilder>().addComponents(autoSelectButton);
      
      const { ROLE_DEFINITIONS } = await import("../agent/index.ts");
      const roleDef = ROLE_DEFINITIONS[role];
      const agent = roleDef?.agents.find(a => a.id === agentId);
      
      await ctx.editReply({
        embeds: [{
          color: 0x5865F2,
          title: '🚀 Advanced Agent Runner',
          description: `**Step 3: Select Model**\n\nRole: **${roleDef?.name || role}**\nAgent: **${agent?.name || agentId}**\n\nChoose a model or use auto-select:`,
          fields: [
            { name: 'Available Models', value: `${availableModels.length} models available`, inline: false },
            { name: 'Auto-Select', value: 'Let the system choose the best model for this task', inline: false }
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
      const agentId = parts[3];
      const model = values[0];
      
      // Start the agent session
      const { setAgentSession, PREDEFINED_AGENTS } = await import("../agent/index.ts");
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
      
      // Set the agent session
      setAgentSession(userId, channelId, agentId);
      
      const agent = PREDEFINED_AGENTS[agentId];
      
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
          description: `**Agent:** ${agent?.name || agentId}\n**Provider:** ${providerNames[provider] || provider}\n**Role:** ${role}\n**Model:** ${model}\n\nYou can now chat with the agent!`,
          fields: [
            { name: 'Agent', value: agent?.name || agentId, inline: true },
            { name: 'Provider', value: providerNames[provider] || provider, inline: true },
            { name: 'Model', value: model, inline: true },
            { name: 'Role', value: role, inline: true }
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
    if (!myChannel || interaction.channelId !== myChannel.id) {
      return;
    }
    
    const ctx = createInteractionContext(interaction);
    const buttonId = interaction.customId;
    
    // Handle run-adv auto-select button
    if (buttonId.startsWith('run-adv-auto:')) {
      await ctx.deferUpdate();
      const parts = buttonId.split(':');
      const provider = parts[1];
      const role = parts[2];
      const agentId = parts[3];
      
      // Auto-select best model based on role and agent
      let selectedModel = 'gemini-3-flash'; // Default
      
      try {
        if (provider === 'ollama') {
          // For Ollama, get the first available model
          const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
          const ollamaProvider = AgentProviderRegistry.getProvider('ollama');
          if (ollamaProvider) {
            const status = await ollamaProvider.getStatus?.();
            if (status?.available && status.metadata?.models) {
              const models = status.metadata.models as string[];
              selectedModel = models[0] || 'llama3.2';
            } else {
              selectedModel = 'llama3.2'; // Fallback
            }
          } else {
            selectedModel = 'llama3.2'; // Fallback
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
          selectedModel = 'llama3.2';
        } else if (provider === 'cursor') {
          selectedModel = 'auto';
        } else if (provider === 'claude-cli') {
          selectedModel = 'claude-sonnet-4';
        }
      }
      
      // Start the agent session
      const { setAgentSession, PREDEFINED_AGENTS } = await import("../agent/index.ts");
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
      
      // Set the agent session
      setAgentSession(userId, channelId, agentId);
      
      const agent = PREDEFINED_AGENTS[agentId];
      const { ROLE_DEFINITIONS } = await import("../agent/index.ts");
      const roleDef = ROLE_DEFINITIONS[role];
      
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
          description: `**Agent:** ${agent?.name || agentId}\n**Provider:** ${providerNames[provider] || provider}\n**Role:** ${roleDef?.name || role}\n**Model:** ${selectedModel} (auto-selected)\n\nYou can now chat with the agent!`,
          fields: [
            { name: 'Agent', value: agent?.name || agentId, inline: true },
            { name: 'Provider', value: providerNames[provider] || provider, inline: true },
            { name: 'Model', value: selectedModel, inline: true },
            { name: 'Role', value: roleDef?.name || role, inline: true }
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
    if (!myChannel || message.channelId !== myChannel.id) return;

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
      const targetAgent = activeSession?.agentName || 'general-assistant';

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

      const mockCtx = {
        user: message.author,
        channel: message.channel,
        channelId: message.channelId,
        guild: message.guild,
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