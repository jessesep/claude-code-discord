import { Events } from "npm:discord.js@14.14.1";
import { getActiveSession } from "../agent/index.ts";
import { createInteractionContext } from "./interaction-context.ts";

/**
 * Handle incoming messages
 */
export function handleMessageCreate(
  client: any,
  handlers: any,
  enableChannelRouting: boolean,
  getMyChannel: () => any,
  channelContextManager: any
) {
  client.on(Events.MessageCreate, async (message: any) => {
    console.log(`[MessageHandler] Received message from ${message.author.tag} (${message.author.id}): ${message.content.substring(0, 50)}`);
    // Ignore other bots unless it's our whitelisted tester bot
    const TESTER_BOT_ID = Deno.env.get("TESTER_BOT_ID") || "1458440747295576206";
    if (message.author.bot && message.author.id !== TESTER_BOT_ID) return;
    
    const myChannel = getMyChannel();
    
    // Get channel context for multi-project routing
    let channelContext = undefined;
    if (enableChannelRouting && message.channel) {
      try {
        const contextResult = await channelContextManager.getChannelContext(message.channel);
        
        // Check if category not found and needs user prompt
        if (contextResult && 'needsUserPrompt' in contextResult) {
          const { hasActiveCreation, handleDescriptionMessage, getCreationState } = await import("../util/repo-creation-handler.ts");
          
          if (hasActiveCreation(message.channelId)) {
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
            return;
          } else {
            const activeSession = getActiveSession(message.author.id, message.channelId);
            const isMention = message.mentions.has(client.user!.id);
            
            if (!activeSession && !isMention) {
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
          }
        } else if (contextResult && 'projectPath' in contextResult) {
          channelContext = contextResult;
        }
      } catch (error) {
        console.warn(`[MessageCreate] Error getting channel context: ${error}`);
      }
    }
    
    // Check for active agent session
    const activeSession = getActiveSession(message.author.id, message.channelId);
    const isMention = message.mentions.has(client.user!.id);

    // Check for testing mode bypass
    const { shouldBypassChannelRestrictions, testingLog } = await import("../util/testing-mode.ts");
    const bypassRestrictions = shouldBypassChannelRestrictions();

    // Channel restriction (bypassed in testing mode)
    if (!bypassRestrictions) {
      if (!enableChannelRouting) {
        // Allow if it's the bot's channel OR there's an active session OR it's a mention
        if (!activeSession && !isMention && (!myChannel || message.channelId !== myChannel.id)) return;
      } else {
        // If routing enabled, allow if we have channel context OR it's the bot's channel OR active session/mention
        if (!channelContext && !activeSession && !isMention && (!myChannel || message.channelId !== myChannel.id)) {
          return;
        }
      }

      if (!activeSession && !isMention) return;
    } else {
      // Testing mode: only require mention (bypass all other restrictions)
      if (!isMention) return;
      testingLog(`Channel restrictions bypassed for message in #${message.channel?.name}`);
    }

    try {
      // Extract prompt (remove the mention)
      const contentWithoutMentions = message.content.replace(/<@!?\d+>/g, '').trim();
      if (!contentWithoutMentions) return;

      // Check for model override in prompt: model="xxx"
      let prompt = contentWithoutMentions;
      let modelOverride: string | null = null;
      const modelMatch = contentWithoutMentions.match(/model=["']([^"']+)["']/i);
      if (modelMatch) {
        modelOverride = modelMatch[1];
        // Remove the model override from the prompt to avoid confusing the agent
        prompt = contentWithoutMentions.replace(/model=["']([^"']+)["']/i, '').trim();
        console.log(`[MessageHandler] Detected model override in prompt: ${modelOverride}`);
      }

      console.log(`[MessageHandler] Processing prompt: "${prompt.substring(0, 50)}..."`);

      const agentHandler = handlers.get('agent');
      if (!agentHandler) {
        await message.reply({
          embeds: [{
            color: 0xFF0000,
            title: '❌ Error',
            description: 'Agent command not available',
          }]
        });
        return;
      }

      const { getActiveAgents, PREDEFINED_AGENTS } = await import("../agent/index.ts");
      const activeAgents = getActiveAgents(message.author.id, message.channelId);
      
      let targetAgent = activeSession?.session.agentName || 'general-assistant';
      let agentExplicitlyNamed = false;
      
      const messageLower = contentWithoutMentions.toLowerCase();

      // NEW: Check for exact agent name mentions first
      for (const agentName of Object.keys(PREDEFINED_AGENTS)) {
        if (messageLower.includes(agentName.toLowerCase())) {
          targetAgent = agentName;
          agentExplicitlyNamed = true;
          console.log(`[MessageHandler] Detected agent mention: ${agentName}`);
          break;
        }
      }
      
      const providerMentions: Record<string, { client: 'claude' | 'cursor' | 'antigravity' | 'ollama'; agentNames: string[] }> = {
        'ollama': { client: 'ollama', agentNames: ['general-assistant'] },
        'cursor': { client: 'cursor', agentNames: ['cursor-coder', 'cursor-refactor', 'cursor-debugger', 'cursor-fast'] },
        'claude': { client: 'claude', agentNames: ['general-assistant', 'code-reviewer', 'architect'] },
        'antigravity': { client: 'antigravity', agentNames: ['ag-coder', 'ag-manager', 'ag-architect'] },
        'gemini': { client: 'antigravity', agentNames: ['ag-coder', 'ag-manager', 'ag-architect'] }
      };
      
      let detectedClient: 'claude' | 'cursor' | 'antigravity' | 'ollama' | undefined = undefined;
      for (const [provider, config] of Object.entries(providerMentions)) {
        if (messageLower.includes(provider)) {
          detectedClient = config.client;
          console.log(`[MessageHandler] Detected provider mention: ${provider} (client: ${detectedClient})`);
          
          // Only change the target agent if it wasn't explicitly named
          if (!agentExplicitlyNamed) {
            const matchingAgent = activeAgents.find(agentName => {
              const agent = PREDEFINED_AGENTS[agentName];
              return agent && agent.client === config.client;
            });
            
            if (matchingAgent) {
              targetAgent = matchingAgent;
              console.log(`[MessageHandler] Using matching active agent for provider: ${targetAgent}`);
            } else {
              // Try to find a matching agent in predefined agents if none active
              const nameMatchingAgent = config.agentNames.find(name => PREDEFINED_AGENTS[name]);
              if (nameMatchingAgent) {
                targetAgent = nameMatchingAgent;
                console.log(`[MessageHandler] Using default agent for provider: ${targetAgent}`);
              }
            }
          }
          break;
        }
      }

      console.log(`[MessageHandler] Final target agent: ${targetAgent}`);

      // Create mock interaction
      let replyMessage: any = null;
      const mockCtx = await createInteractionContext({
        user: message.author,
        channel: message.channel,
        guild: message.guild,
        channelId: message.channelId,
        isCommand: () => true,
        options: {
          getString: (name: string) => {
            if (name === 'action') return 'chat';
            if (name === 'agent_name') return targetAgent;
            if (name === 'message') return prompt;
            if (name === 'model') return modelOverride;
            return null;
          },
          getBoolean: () => null
        },
        reply: async (opts: any) => {
          replyMessage = await message.reply(opts);
        },
        deferReply: async () => {
          console.log(`[MessageHandler] Deferring reply...`);
          replyMessage = await message.reply({
            embeds: [{
              color: 0x5865F2,
              title: '🤖 Processing...',
              description: 'Starting agent conversation...',
              timestamp: new Date().toISOString(),
            }]
          });
        },
        editReply: async (opts: any) => {
          if (replyMessage) await replyMessage.edit(opts);
          else replyMessage = await message.reply(opts);
        },
        followUp: async (opts: any) => {
          await message.channel.send(opts);
        },
        update: async (opts: any) => {
          if (replyMessage) await replyMessage.edit(opts);
        }
      }, channelContext);

      // Add client override to context
      (mockCtx as any).clientOverride = detectedClient;

      await agentHandler.execute(mockCtx);

    } catch (error) {
      console.error('[MessageHandler] Error processing message:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await message.reply({
        embeds: [{
          color: 0xFF0000,
          title: '❌ Error Processing Message',
          description: errorMessage.substring(0, 500),
          fields: [
            { name: 'Message Preview', value: `\`${message.content.substring(0, 100)}...\``, inline: false },
            { name: 'Channel', value: message.channel?.toString() || 'Unknown', inline: true },
          ],
          footer: { text: 'Check logs for more details' },
          timestamp: new Date().toISOString(),
        }]
      }).catch(() => {});
    }
  });
}
