import {
  Client,
  GatewayIntentBits,
  Events,
  CommandInteraction,
  ButtonInteraction,
} from "npm:discord.js@14.14.1";

import { ChannelContextManager } from "../util/channel-context.ts";
import { ensureChannelExists } from "./channel-manager.ts";
import { handleStartup } from "./startup.ts";
import { handleMessageCreate } from "./message-handler.ts";
import { 
  handleCommand, 
  handleButton, 
  handleSelectMenu 
} from "./event-handlers.ts";

import type { 
  BotConfig, 
  CommandHandlers, 
  ButtonHandlers,
  BotDependencies
} from "./types.ts";

/**
 * Main Bot Creation Function
 */
export async function createDiscordBot(
  config: BotConfig, 
  handlers: CommandHandlers,
  buttonHandlers: ButtonHandlers,
  dependencies: BotDependencies,
  crashHandler?: any
) {
  const { discordToken, repoName, branchName, categoryName, workDir } = config;
  const actualCategoryName = categoryName ? `${categoryName} (${repoName})` : repoName;
  
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
  
  // Setup Startup Handler
  const startup = await handleStartup(
    client, 
    config, 
    dependencies, 
    actualCategoryName,
    (guild: any) => ensureChannelExists(guild, actualCategoryName, branchName, repoName, workDir)
  );

  // Setup Message Handler
  handleMessageCreate(
    client, 
    handlers, 
    enableChannelRouting, 
    () => startup.getMyChannel(), 
    channelContextManager
  );

  // Interaction Handler
  client.on(Events.InteractionCreate, async (interaction) => {
    const getMyChannel = () => startup.getMyChannel();

    if (interaction.isCommand()) {
      await handleCommand(
        interaction as CommandInteraction, 
        handlers, 
        enableChannelRouting, 
        getMyChannel(), 
        channelContextManager
      );
    } else if (interaction.isButton()) {
      await handleButton(
        interaction as ButtonInteraction, 
        handlers, 
        buttonHandlers, 
        enableChannelRouting, 
        getMyChannel(), 
        channelContextManager, 
        crashHandler
      );
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(
        interaction as any, 
        handlers, 
        enableChannelRouting, 
        getMyChannel(), 
        channelContextManager, 
        config, 
        botSettings
      );
    }
  });
  
  // Login
  await client.login(discordToken);
  
  // Return bot control functions
  return {
    client,
    getChannel() {
      return startup.getMyChannel();
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
