import { createSlackApp } from "./app.ts";
import { registerSlackEvents } from "./events.ts";
import { registerSlackCommands } from "./commands.ts";
import { createAgentHandlers, AgentHandlerDeps } from "../agent/handlers.ts";

export * from "./app.ts";
export * from "./events.ts";
export * from "./commands.ts";
export * from "./blocks.ts";
export * from "./context.ts";

/**
 * Starts the Slack Bot
 */
export async function startSlackBot(deps: AgentHandlerDeps) {
  const app = createSlackApp();
  if (!app) return null;

  const agentHandlers = createAgentHandlers(deps);

  registerSlackEvents(app, agentHandlers, deps);
  registerSlackCommands(app, agentHandlers, deps);

  await app.start();
  console.log("⚡️ Slack bot is running in Socket Mode!");

  return app;
}
