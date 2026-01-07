// Claude Code integration exports
export { claudeCommands, createClaudeHandlers } from "./command.ts";
export { cleanSessionId, sendToOneAgent } from "./client.ts";
export { createClaudeSender, expandableContent } from "./discord-sender.ts";
export { convertToClaudeMessages } from "./message-converter.ts";
export { 
  enhancedAgentCommands, 
  enhancedAgentCommands as enhancedClaudeCommands,
  createEnhancedAgentHandlers,
  createEnhancedAgentHandlers as createEnhancedClaudeHandlers
} from "./enhanced-commands.ts";
export {
  enhancedAgentQuery,
  InternalAgentSessionManager as ClaudeSessionManager,
  AGENT_MODELS as CLAUDE_MODELS,
  AGENT_TEMPLATES as CLAUDE_TEMPLATES
} from "./enhanced-client.ts";
export type { DiscordSender } from "./discord-sender.ts";
export type { ClaudeMessage } from "./types.ts";
export type { 
  EnhancedAgentOptions as EnhancedClaudeOptions,
  InternalAgentSession as ClaudeSession
} from "./enhanced-client.ts";
export type { EnhancedAgentHandlerDeps as EnhancedClaudeHandlerDeps } from "./enhanced-commands.ts";
