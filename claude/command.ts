import type { ClaudeResponse, ClaudeMessage } from "./types.ts";
import { sendToOneAgent } from "./client.ts";
import { convertToClaudeMessages } from "./message-converter.ts";
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

// Discord command definitions
export const claudeCommands = [
  new SlashCommandBuilder()
    .setName('claude')
    .setDescription('Send message to Claude Code')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for Claude Code')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('session_id')
        .setDescription('Session ID to continue (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('continue')
    .setDescription('Continue the previous Claude Code session')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for Claude Code (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('claude-cancel')
    .setDescription('Cancel currently running Claude Code command'),
];

export interface ClaudeHandlerDeps {
  workDir: string;
  claudeController: AbortController | null;
  setClaudeController: (controller: AbortController | null) => void;
  setClaudeSessionId: (sessionId: string | undefined) => void;
  sendClaudeMessages: (messages: ClaudeMessage[]) => Promise<void>;
}

export function createClaudeHandlers(deps: ClaudeHandlerDeps) {
  const { workDir, sendClaudeMessages } = deps;
  
  return {
    // deno-lint-ignore no-explicit-any
    async onClaude(ctx: any, prompt: string, sessionId?: string): Promise<ClaudeResponse> {
      // Cancel any existing session
      if (deps.claudeController) {
        deps.claudeController.abort();
      }

      const controller = new AbortController();
      deps.setClaudeController(controller);

      try {
        const result = await sendToOneAgent(
          workDir,
          prompt,
          controller,
          sessionId,
          async (chunk) => {
            await sendClaudeMessages([{
              type: 'text',
              content: chunk
            }]);
          }
        );

        if (result.sessionId) {
          deps.setClaudeSessionId(result.sessionId);
        }

        return {
          response: result.response,
          sessionId: result.sessionId,
          cost: result.cost,
          duration: result.duration
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return { response: 'Session cancelled.' };
        }
        throw error;
      }
    },

    // deno-lint-ignore no-explicit-any
    async onContinue(ctx: any, prompt?: string): Promise<ClaudeResponse> {
      // Cancel any existing session
      if (deps.claudeController) {
        deps.claudeController.abort();
      }

      const controller = new AbortController();
      deps.setClaudeController(controller);

      try {
        const result = await sendToOneAgent(
          workDir,
          prompt || "Continue",
          controller,
          undefined, // Resume previous session
          async (chunk) => {
            await sendClaudeMessages([{
              type: 'text',
              content: chunk,
              timestamp: new Date().toISOString()
            }]);
          },
          undefined,
          true // continueMode
        );

        return {
          response: result.response,
          sessionId: result.sessionId,
          cost: result.cost,
          duration: result.duration
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return { response: 'Session cancelled.' };
        }
        throw error;
      }
    },

    // deno-lint-ignore no-explicit-any
    onClaudeCancel(ctx: any): boolean {
      if (deps.claudeController) {
        deps.claudeController.abort();
        deps.setClaudeController(null);
        return true;
      }
      return false;
    }
  };
}
