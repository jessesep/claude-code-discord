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

import { sanitizeChannelName } from "./utils.ts";
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
  const actualCategoryName = categoryName || repoName;
  
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
  function createInteractionContext(interaction: CommandInteraction | ButtonInteraction): InteractionContext {
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
        await interaction.deferReply();
      },

      async editReply(content: MessageContent): Promise<void> {
        await interaction.editReply(convertMessageContent(content));
      },

      async followUp(content: MessageContent & { ephemeral?: boolean }): Promise<void> {
        const payload = convertMessageContent(content);
        payload.ephemeral = content.ephemeral || false;
        await interaction.followUp(payload);
      },

      async reply(content: MessageContent & { ephemeral?: boolean }): Promise<void> {
        const payload = convertMessageContent(content);
        payload.ephemeral = content.ephemeral || false;
        await interaction.reply(payload);
      },

      async update(content: MessageContent): Promise<void> {
        if ('update' in interaction) {
          await (interaction as ButtonInteraction).update(convertMessageContent(content));
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
  
  // Button handler - completely generic
  async function handleButton(interaction: ButtonInteraction) {
    if (!myChannel || interaction.channelId !== myChannel.id) {
      return;
    }
    
    const ctx = createInteractionContext(interaction);
    
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
    const buttonId = interaction.customId;
    
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
      for (const [handlerName, handler] of handlers.entries()) {
        if (handler.handleButton) {
          try {
            await handler.handleButton(ctx, buttonId);
            return;
          } catch (error) {
            console.error(`Error in ${handlerName} handleButton for expand:`, error);
          }
        }
      }
      
      // If no handler found, show default message
      try {
        await ctx.update({
          embeds: [{
            color: 0xffaa00,
            title: '📖 Content Not Available',
            description: 'The full content is no longer available for expansion.',
            timestamp: new Date().toISOString()
          }],
          components: []
        });
      } catch (error) {
        console.error(`Error handling expand button fallback:`, error);
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
      
      // Send startup message first
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
      
      // Test models on startup (async, don't block startup message)
      try {
        const { testAllModels, formatModelTestResults } = await import("../util/model-tester.ts");
        const ownerId = Deno.env.get("OWNER_ID") || Deno.env.get("DEFAULT_MENTION_USER_ID");
        const isAuthorized = !!ownerId;
        
        console.log('[Startup] Testing all configured models...');
        const testResults = await testAllModels(isAuthorized);
        
        // Send test results to Discord
        const testMessage = formatModelTestResults(testResults);
        await myChannel.send(convertMessageContent({
          embeds: [{
            color: testResults.failedModels.length > 0 ? 0xffaa00 : 0x00ff00,
            title: '🧪 Model Test Results',
            description: testMessage,
            timestamp: new Date().toISOString()
          }]
        })).catch(err => {
          console.error('[Startup] Failed to send model test results:', err);
        });
      } catch (error) {
        console.error('[Startup] Model testing failed:', error);
        await myChannel.send(convertMessageContent({
          embeds: [{
            color: 0xff0000,
            title: '⚠️ Model Test Failed',
            description: `Failed to test models: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date().toISOString()
          }]
        })).catch(() => {});
      }
    } catch (error) {
      console.error('Channel creation/retrieval error:', error);
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