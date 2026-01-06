/**
 * Cursor CLI Provider Adapter
 *
 * Wraps the Cursor CLI client into the universal provider interface
 */

import {
  AgentProvider,
  ProviderType,
  AgentExecutionOptions,
  UniversalAgentResponse,
  ProviderStatus,
} from '../provider-interface.ts';
import { sendToCursorCLI } from '../../claude/cursor-client.ts';

export class CursorProvider implements AgentProvider {
  readonly providerId = 'cursor';
  readonly providerName = 'Cursor Agent';
  readonly providerType = ProviderType.IDE_EXTENSION;
  readonly supportedModels = [
    'sonnet-4',
    'sonnet-4.5',
    'sonnet-4-thinking',
    'sonnet-4.5-thinking',
    'opus-4',
    'gpt-4',
    'gpt-5',
  ];

  async isAvailable(): Promise<boolean> {
    try {
      // Check if cursor CLI is installed
      const cmd = new Deno.Command('which', {
        args: ['cursor'],
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

    // Build Cursor options
    const cursorOptions = {
      model: options.model,
      workspace: options.workspace,
      force: options.force,
      sandbox: options.sandbox === false ? 'disabled' : 'enabled',
      resume: options.resumeSessionId,
      streamJson: options.streaming !== false, // Default to streaming
    };

    // Call the existing Cursor CLI client
    const result = await sendToCursorCLI(
      prompt,
      controller,
      cursorOptions as any,
      onChunk
    );

    // Convert to universal format
    return {
      response: result.response,
      duration: result.duration,
      modelUsed: result.modelUsed,
      sessionId: result.chatId,
      metadata: {
        provider: 'cursor',
        chatId: result.chatId,
      },
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    const available = await this.isAvailable();
    let version: string | undefined;

    if (available) {
      try {
        const cmd = new Deno.Command('cursor', {
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
      message: available ? 'Cursor CLI is ready' : 'Cursor CLI not installed or not in PATH',
    };
  }

  async validateOptions(options: AgentExecutionOptions): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Validate model
    if (options.model && !this.supportedModels.includes(options.model)) {
      errors.push(`Unsupported model: ${options.model}. Supported: ${this.supportedModels.join(', ')}`);
    }

    // Warn about force mode
    if (options.force) {
      console.warn('[Cursor] Force mode enabled - operations will be auto-approved (HIGH RISK)');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
