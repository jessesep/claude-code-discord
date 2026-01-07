import { WebClient } from "@slack/web-api";
import { InteractionContext, MessageContent } from "../discord/types.ts";
import { convertToSlackBlocks } from "./blocks.ts";

/**
 * Creates an InteractionContext for Slack
 */
export function createSlackContext(
  client: WebClient,
  eventOrCommand: any,
  say: (message: any) => Promise<any>
): InteractionContext {
  const isCommand = !!eventOrCommand.command;
  const userId = eventOrCommand.user_id || eventOrCommand.user;
  const channelId = eventOrCommand.channel_id || eventOrCommand.channel;
  const threadTs = eventOrCommand.thread_ts || (eventOrCommand.event && eventOrCommand.event.thread_ts) || eventOrCommand.ts;

  let lastMessageTs: string | undefined = undefined;

  return {
    user: {
      id: userId,
      username: eventOrCommand.user_name || userId,
    },
    channelId: channelId,
    // We can store thread_ts in the context to ensure replies go to the right thread
    // deno-lint-ignore no-explicit-any
    channel: { id: channelId, thread_ts: threadTs } as any,

    async deferReply(): Promise<void> {
      // Slack handles "deferral" via the ack() function which should be called before this
      // But we can send a "thinking..." message if needed
    },

    async deferUpdate(): Promise<void> {
      // Similar to deferReply
    },

    async editReply(content: MessageContent): Promise<void> {
      // In Slack, we'd need the TS of the message we want to edit.
      // If we don't have it, we might just send a new message or update the last one.
      // This is often used for streaming or updating status.
      const ts = eventOrCommand.ts || lastMessageTs;
      if (ts) {
        await client.chat.update({
          channel: channelId,
          ts: ts,
          blocks: convertToSlackBlocks(content),
          text: content.content || "Updating message...",
        });
      } else {
        const result = await say({
          blocks: convertToSlackBlocks(content),
          text: content.content || "Updating message...",
          thread_ts: threadTs,
        });
        if (result && result.ts) {
          lastMessageTs = result.ts;
        }
      }
    },

    async followUp(content: MessageContent & { ephemeral?: boolean }): Promise<void> {
      if (content.ephemeral) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          blocks: convertToSlackBlocks(content),
          text: content.content || "Ephemeral message",
          thread_ts: threadTs,
        });
      } else {
        const result = await say({
          blocks: convertToSlackBlocks(content),
          text: content.content || "Follow-up message",
          thread_ts: threadTs,
        });
        if (result && result.ts) {
          lastMessageTs = result.ts;
        }
      }
    },

    async reply(content: MessageContent & { ephemeral?: boolean }): Promise<void> {
      if (content.ephemeral) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          blocks: convertToSlackBlocks(content),
          text: content.content || "Ephemeral reply",
          thread_ts: threadTs,
        });
      } else {
        const result = await say({
          blocks: convertToSlackBlocks(content),
          text: content.content || "Reply message",
          thread_ts: threadTs,
        });
        if (result && result.ts) {
          lastMessageTs = result.ts;
        }
      }
    },

    async update(content: MessageContent): Promise<void> {
      await this.editReply(content);
    },

    async sendAgentMessages(messages: any[]): Promise<void> {
      const content = messages[0]?.content || "";
      if (!content) return;

      // For Slack, we'll try to update the last message if it's the same agent update
      // this provides a "streaming" feel.
      try {
        if (lastMessageTs) {
          const result = await client.chat.update({
            channel: channelId,
            ts: lastMessageTs,
            text: content,
            blocks: convertToSlackBlocks({ content }),
          });
          if (result.ok) {
            return;
          }
          lastMessageTs = undefined;
        }
      } catch (err) {
        console.warn("[SlackContext] Failed to update message, sending new one:", err);
        lastMessageTs = undefined;
      }

      const result = await say({
        text: content,
        blocks: convertToSlackBlocks({ content }),
        thread_ts: threadTs,
      });
      if (result && result.ts) {
        lastMessageTs = result.ts;
      }
    },

    getString(name: string, _required?: boolean): string | null {
      if (isCommand && eventOrCommand.text) {
        // Simple parsing of slash command text: /command <action> <args>
        // This is a bit naive but works for the suggested /agent list, chat, etc.
        const parts = eventOrCommand.text.split(" ");
        if (name === "action") return parts[0] || null;
        if (name === "message") return parts.slice(1).join(" ") || null;
      }
      return null;
    },

    getInteger(_name: string, _required?: boolean): number | null {
      return null;
    },

    getBoolean(_name: string, _required?: boolean): boolean | null {
      return null;
    },
  };
}
