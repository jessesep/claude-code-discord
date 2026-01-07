import { App } from "@slack/bolt";
import { createSlackContext } from "./context.ts";
import { AgentHandlerDeps } from "../agent/handlers.ts";

/**
 * Register Slack Slash Commands
 */
export function registerSlackCommands(app: App, agentHandlers: any, _deps: AgentHandlerDeps) {
  // /agent command
  app.command("/agent", async ({ command, ack, say, client }) => {
    await ack();

    const text = command.text.trim();
    const parts = text.split(" ");
    const action = parts[0] || "list";
    const args = parts.slice(1);

    const ctx = createSlackContext(client, command, say);

    switch (action) {
      case "list":
        await agentHandlers.onAgent(ctx, "list");
        break;
      case "chat":
        await agentHandlers.onAgent(ctx, "chat", undefined, args.join(" "));
        break;
      case "start":
        await agentHandlers.onAgent(ctx, "start", args[0]);
        break;
      case "status":
        await agentHandlers.onAgent(ctx, "status");
        break;
      case "end":
        await agentHandlers.onAgent(ctx, "end");
        break;
      default:
        await say(`Unknown action: ${action}. Try /agent list, chat, start, status, or end.`);
    }
  });

  // /run command (quick start)
  app.command("/run", async ({ command, ack, say, client }) => {
    await ack();
    const ctx = createSlackContext(client, command, say);
    await agentHandlers.onAgent(ctx, "start", "general-assistant");
  });
}
