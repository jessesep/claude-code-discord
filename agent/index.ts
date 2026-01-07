// Agent module entry point
// This file exports core agent functionality, split into specialized modules.

export * from "./types.ts";
export * from "./registry.ts";
export * from "./session-manager.ts";
export * from "./orchestrator.ts";
export * from "./handlers.ts";
export * from "./command.ts";

// Agent Instance Registry - Provides true agent isolation with unique IDs and channel binding
export * from "./instance-registry.ts";

// Note: handleManagerInteraction and parseManagerResponse remain in manager.ts
export { MANAGER_SYSTEM_PROMPT, parseManagerResponse, parseGitHubIssueRequest } from "./manager.ts";
export type { ManagerAction } from "./manager.ts";
