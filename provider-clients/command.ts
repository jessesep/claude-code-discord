import type { AgentResponse as OneAgentResponse, AgentMessage as OneAgentMessage } from "./types.ts";
import { sendToOneAgent } from "./client.ts";
import { convertToAgentMessages } from "./message-converter.ts";
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

// Discord command definitions
export const oneAgentCommands = [
  new SlashCommandBuilder()
    .setName('one-agent')
    .setDescription('Send message to One Agent')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for One Agent')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('session_id')
        .setDescription('Session ID to continue (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('one-agent-continue')
    .setDescription('Continue the previous One Agent session')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('Prompt for One Agent (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('one-agent-cancel')
    .setDescription('Cancel currently running One Agent command'),
];

export interface OneAgentHandlerDeps {
  workDir: string;
  agentController: AbortController | null;
  setAgentController: (controller: AbortController | null) => void;
  setAgentSessionId: (sessionId: string | undefined) => void;
  sendAgentMessages: (messages: OneAgentMessage[]) => Promise<void>;
}

export function createOneAgentHandlers(deps: OneAgentHandlerDeps) {
  const { workDir, sendAgentMessages } = deps;
  
  return {
    // deno-lint-ignore no-explicit-any
    async onOneAgent(ctx: any, prompt: string, sessionId?: string): Promise<OneAgentResponse> {
      // Cancel any existing session
      if (deps.agentController) {
        deps.agentController.abort();
      }

      const controller = new AbortController();
      deps.setAgentController(controller);

      try {
        const result = await sendToOneAgent(
          workDir,
          prompt,
          controller,
          sessionId,
          async (chunk) => {
            await sendAgentMessages([{
              type: 'text',
              content: chunk
            }]);
          }
        );

        if (result.sessionId) {
          deps.setAgentSessionId(result.sessionId);
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
    async onOneAgentContinue(ctx: any, prompt?: string): Promise<OneAgentResponse> {
      // Cancel any existing session
      if (deps.agentController) {
        deps.agentController.abort();
      }

      const controller = new AbortController();
      deps.setAgentController(controller);

      try {
        const result = await sendToOneAgent(
          workDir,
          prompt || "Continue",
          controller,
          undefined, // Resume previous session
          async (chunk) => {
            await sendAgentMessages([{
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
    onOneAgentCancel(ctx: any): boolean {
      if (deps.agentController) {
        deps.agentController.abort();
        deps.setAgentController(null);
        return true;
      }
      return false;
    }
  };
}
