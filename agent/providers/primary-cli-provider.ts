/**
 * Primary CLI Provider Adapter
 *
 * Wraps the existing Primary CLI client into the universal provider interface
 */

import {
  AgentProvider,
  ProviderType,
  AgentExecutionOptions,
  UniversalAgentResponse,
  ProviderStatus,
} from '../provider-interface.ts';
import { sendToPrimaryCLI } from '../../provider-clients/cli-client.ts';

export class PrimaryCliProvider implements AgentProvider {
  readonly providerId = 'primary-cli';
  readonly providerName = 'Primary CLI';
  readonly providerType = ProviderType.CLI;
  supportedModels = [
    'sonnet',
    'opus',
    'haiku',
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
  ];

  async listModels(): Promise<string[]> {
    return this.supportedModels;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if claude CLI is installed
      const cmd = new Deno.Command('which', {
        args: ['claude'],
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

    // Extract system prompt and user prompt
    // Assume format: "System: <system>\n\nTask: <user>"
    const parts = prompt.split('\n\nTask: ');
    const systemPrompt = parts[0]?.replace(/^System: /, '') || '';
    const userPrompt = parts[1] || prompt;

    // Call the existing Claude CLI client
    const result = await sendToPrimaryCLI(
      systemPrompt,
      userPrompt,
      controller,
      options.model || 'sonnet',
      options.maxTokens || 8000,
      onChunk
    );

    // Convert to universal format
    return {
      response: result.response,
      duration: result.duration,
      modelUsed: result.modelUsed,
      cost: result.cost,
      metadata: {
        provider: 'primary-cli',
      },
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    const available = await this.isAvailable();
    let version: string | undefined;

    if (available) {
      try {
        const cmd = new Deno.Command('claude', {
          args: ['--version'],
          stdout: 'piped',
          stderr: 'null',
        });
        const output = await cmd.output();
        version = new TextDecoder().decode(output.stdout).trim();
      } catch {
        version = 'unknown';
      }
    }

    return {
      available,
      version,
      lastChecked: new Date(),
      message: available ? 'Primary CLI is ready' : 'Primary CLI not installed or not in PATH',
    };
  }

  async validateOptions(options: AgentExecutionOptions): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Validate model
    if (options.model && !this.supportedModels.includes(options.model)) {
      errors.push(`Unsupported model: ${options.model}. Supported: ${this.supportedModels.join(', ')}`);
    }

    // Primary CLI doesn't support workspace/force/sandbox
    if (options.workspace) {
      errors.push('Primary CLI does not support workspace option');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
