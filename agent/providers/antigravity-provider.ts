/**
 * Antigravity (Gemini) Provider Adapter
 *
 * Wraps the Antigravity/Gemini client into the universal provider interface
 */

import {
  AgentProvider,
  ProviderType,
  AgentExecutionOptions,
  UniversalAgentResponse,
  ProviderStatus,
} from '../provider-interface.ts';
import { sendToAntigravityCLI } from '../../claude/antigravity-client.ts';

export class AntigravityProvider implements AgentProvider {
  readonly providerId = 'antigravity';
  readonly providerName = 'Google Antigravity (Gemini)';
  readonly providerType = ProviderType.API;
  readonly supportedModels = [
    'gemini-3-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-thinking-exp',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-exp-1206',
  ];

  async isAvailable(): Promise<boolean> {
    // Check for API key or gcloud credentials
    const hasApiKey = !!(Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY'));

    if (hasApiKey) {
      return true;
    }

    // Check for gcloud CLI
    try {
      const cmd = new Deno.Command('which', {
        args: ['gcloud'],
        stdout: 'null',
        stderr: 'null',
      });
      const { success } = await cmd.output();
      return success;
    } catch {
      return false;
    }
  }

  async execute(
    prompt: string,
    options: AgentExecutionOptions,
    onChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<UniversalAgentResponse> {
    // Create abort controller from signal
    const controller = new AbortController();
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
    }

    // Build Antigravity options
    const antigravityOptions = {
      model: options.model || 'gemini-3-flash',
      workspace: options.workspace,
      streamJson: options.streaming !== false,
      force: options.force,
      sandbox: options.sandbox === false ? 'disabled' : 'enabled',
      authorized: options.providerOptions?.authorized as boolean,
    };

    // Call the existing Antigravity client
    const result = await sendToAntigravityCLI(
      prompt,
      controller,
      antigravityOptions as any,
      onChunk
    );

    // Convert to universal format
    return {
      response: result.response,
      duration: result.duration,
      modelUsed: result.modelUsed,
      sessionId: result.chatId,
      metadata: {
        provider: 'antigravity',
        chatId: result.chatId,
      },
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    const hasApiKey = !!(Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_API_KEY'));

    if (hasApiKey) {
      return {
        available: true,
        lastChecked: new Date(),
        message: 'Using Gemini API key',
        metadata: { authMethod: 'api_key' },
      };
    }

    // Check gcloud
    try {
      const cmd = new Deno.Command('gcloud', {
        args: ['auth', 'list', '--format=json'],
        stdout: 'piped',
        stderr: 'null',
      });
      const output = await cmd.output();
      if (output.success) {
        const accounts = JSON.parse(new TextDecoder().decode(output.stdout));
        const activeAccount = accounts.find((a: any) => a.status === 'ACTIVE');
        return {
          available: !!activeAccount,
          lastChecked: new Date(),
          message: activeAccount
            ? `Using gcloud account: ${activeAccount.account}`
            : 'No active gcloud account',
          metadata: { authMethod: 'gcloud', account: activeAccount?.account },
        };
      }
    } catch {
      // Fall through
    }

    return {
      available: false,
      lastChecked: new Date(),
      message: 'No Gemini API key or gcloud credentials found',
    };
  }

  async validateOptions(options: AgentExecutionOptions): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Validate model
    if (options.model && !this.supportedModels.includes(options.model)) {
      errors.push(`Unsupported model: ${options.model}. Supported: ${this.supportedModels.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
