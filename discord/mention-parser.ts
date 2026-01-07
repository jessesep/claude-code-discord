import { resolveAgentAlias } from "../agent/types.ts";

export interface ParsedMention {
  agentId: string | null;
  cleanMessage: string;
}

/**
 * Parses a message for @agent-name mentions.
 * Supports:
 * - @coder fix the bug
 * - @ag-coder fix the bug
 * - @code fix the bug
 */
export function parseAgentMention(message: string): ParsedMention {
  if (!message) return { agentId: null, cleanMessage: "" };

  // Match @agent-name or @alias at start of message
  // Allow hyphens in the name (e.g., ag-coder)
  const mentionMatch = message.match(/^@([\w-]+)\s+(.+)$/s);
  
  if (mentionMatch) {
    const [, agentRef, rest] = mentionMatch;
    const agentId = resolveAgentAlias(agentRef);
    
    if (agentId) {
      console.log(`[MentionParser] Resolved @${agentRef} to agent: ${agentId}`);
      return { agentId, cleanMessage: rest.trim() };
    } else {
      console.warn(`[MentionParser] Could not resolve agent mention: @${agentRef}`);
    }
  }

  return { agentId: null, cleanMessage: message };
}
