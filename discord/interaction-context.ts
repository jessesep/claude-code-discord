import { CommandInteraction, ButtonInteraction } from "npm:discord.js@14.14.1";
import { convertMessageContent } from "./formatting.ts";
import type { InteractionContext, MessageContent } from "./types.ts";

/**
 * Create interaction context wrapper
 */
export async function createInteractionContext(
  interaction: CommandInteraction | ButtonInteraction | any,
  channelContext?: any
): Promise<InteractionContext> {
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

    async sendAgentMessages(messages: any[]): Promise<void> {
      const content = messages[0]?.content || '';
      if (!content) return;
      
      const { splitText, DISCORD_LIMITS } = await import("./utils.ts");
      const chunks = splitText(content, DISCORD_LIMITS.EMBED_DESCRIPTION, true);
      
      try {
        if ('editReply' in interaction && (interaction.deferred || interaction.replied)) {
          await interaction.editReply(convertMessageContent({
            embeds: [{
              color: 0x0099ff,
              title: chunks.length > 1 ? 'Assistant (1/' + chunks.length + ')' : 'Assistant',
              description: chunks[0],
              timestamp: true
            }]
          }));
          
          for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp(convertMessageContent({
              embeds: [{
                color: 0x0099ff,
                title: `Assistant (${i + 1}/${chunks.length})`,
                description: chunks[i],
                timestamp: true
              }]
            }));
          }
        } else if ('reply' in interaction) {
          await interaction.reply(convertMessageContent({
            embeds: [{
              color: 0x0099ff,
              title: chunks.length > 1 ? 'Assistant (1/' + chunks.length + ')' : 'Assistant',
              description: chunks[0],
              timestamp: true
            }]
          }));
          
          for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp(convertMessageContent({
              embeds: [{
                color: 0x0099ff,
                title: `Assistant (${i + 1}/${chunks.length})`,
                description: chunks[i],
                timestamp: true
              }]
            }));
          }
        } else if (interaction.channel) {
          // Fallback to channel.send if no interaction methods available
          for (const chunk of chunks) {
            await interaction.channel.send(convertMessageContent({
              embeds: [{
                color: 0x0099ff,
                title: 'Assistant',
                description: chunk,
                timestamp: true
              }]
            }));
          }
        }
      } catch (err) {
        console.warn("[InteractionContext] Failed to send messages via interaction, falling back to channel.send:", err);
        if (interaction.channel) {
          for (const chunk of chunks) {
            await interaction.channel.send(convertMessageContent({
              embeds: [{
                color: 0x0099ff,
                title: 'Assistant',
                description: chunk,
                timestamp: true
              }]
            })).catch((e: any) => console.error("[InteractionContext] Final fallback failed:", e));
          }
        }
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
