import { App } from "@slack/bolt";
import { createSlackContext } from "./context.ts";
import { parseAgentMention } from "../discord/mention-parser.ts";
import { getActiveSession } from "../agent/session-manager.ts";
import { AgentHandlerDeps } from "../agent/handlers.ts";

/**
 * Register Slack Event Handlers
 */
export function registerSlackEvents(app: App, agentHandlers: any, deps: AgentHandlerDeps) {
  // Handle app mentions
  app.event("app_mention", async ({ event, say, client }) => {
    // Remove bot mention from message
    const botMentionRegex = /<@[A-Z0-9]+>/g;
    const messageText = event.text.replace(botMentionRegex, "").trim();

    // Check for @agent-name pattern
    const { agentId, cleanMessage } = parseAgentMention(messageText);

    // Create context
    const ctx = createSlackContext(client, event, say);

    // Invoke agent
    await agentHandlers.onAgent(
      ctx,
      "chat",
      agentId || undefined,
      cleanMessage
    );
  });

  // Handle messages (for thread replies)
  app.event("message", async ({ event, say, client }) => {
    // deno-lint-ignore no-explicit-any
    const messageEvent = event as any;
    
    // Check if this is a reply in a thread
    if (messageEvent.thread_ts && !messageEvent.bot_id) {
      const userId = messageEvent.user;
      const channelId = messageEvent.channel;
      
      // We check if there's an active session for this user/channel
      // For Slack, we might want to ensure the session is tied to the thread_ts
      // But getActiveSession currently only uses userId and channelId
      const sessionData = getActiveSession(userId, channelId);
      
      if (sessionData) {
        const ctx = createSlackContext(client, messageEvent, say);
        await agentHandlers.onAgent(
          ctx,
          "chat",
          sessionData.session.agentName,
          messageEvent.text
        );
      }
    }
  });
}
