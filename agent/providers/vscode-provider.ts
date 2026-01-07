/**
 * VS Code Extension Provider
 *
 * Integrates with VS Code extensions via their CLI interfaces or APIs
 * This is a template - specific implementations will vary by extension
 *
 * Examples:
 * - Continue.dev
 * - GitHub Copilot
 * - Codeium
 * - Tabnine
 */

import {
  AgentProvider,
  ProviderType,
  AgentExecutionOptions,
  UniversalAgentResponse,
  ProviderStatus,
} from '../provider-interface.ts';

export interface VSCodeExtensionConfig {
  /** Extension ID (e.g., "continue.continue") */
  extensionId: string;

  /** Extension display name */
  name: string;

  /** Command to check if installed */
  checkCommand?: string[];

  /** Command template to execute */
  executeCommand: (prompt: string, options: AgentExecutionOptions) => string[];

  /** Supported models */
  supportedModels?: string[];

  /** Parse response from stdout */
  parseResponse?: (stdout: string, stderr: string) => {
    response: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Generic VS Code extension provider
 */
export class VSCodeExtensionProvider implements AgentProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerType = ProviderType.IDE_EXTENSION;
  supportedModels: string[];

  private config: VSCodeExtensionConfig;

  constructor(config: VSCodeExtensionConfig) {
    this.config = config;
    this.providerId = `vscode-${config.extensionId.replace(/\./g, '-')}`;
    this.providerName = `VS Code: ${config.name}`;
    this.supportedModels = config.supportedModels || [];
  }

  async listModels(): Promise<string[]> {
    return this.supportedModels;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.checkCommand) {
      return false;
    }

    try {
      const cmd = new Deno.Command(this.config.checkCommand[0], {
        args: this.config.checkCommand.slice(1),
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
    const startTime = Date.now();

    // Build command
    const cmdArgs = this.config.executeCommand(prompt, options);
    const cmd = new Deno.Command(cmdArgs[0], {
      args: cmdArgs.slice(1),
      stdout: 'piped',
      stderr: 'piped',
      signal: abortSignal,
    });

    let fullResponse = '';
    let errorOutput = '';

    const process = cmd.spawn();

    // Handle stdout
    const stdoutReader = process.stdout.getReader();
    const decoder = new TextDecoder();

    const readStdout = async () => {
      try {
        while (true) {
          const { done, value } = await stdoutReader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;

          if (onChunk) {
            onChunk(chunk);
          }
        }
      } finally {
        stdoutReader.releaseLock();
      }
    };

    // Handle stderr
    const stderrReader = process.stderr.getReader();
    const readStderr = async () => {
      try {
        while (true) {
          const { done, value } = await stderrReader.read();
          if (done) break;

          errorOutput += decoder.decode(value, { stream: true });
        }
      } finally {
        stderrReader.releaseLock();
      }
    };

    await Promise.all([readStdout(), readStderr()]);
    const status = await process.status;

    if (!status.success) {
      throw new Error(`Extension command failed: ${errorOutput || 'Unknown error'}`);
    }

    // Parse response using custom parser if provided
    let response = fullResponse;
    let metadata: Record<string, unknown> = {
      provider: this.providerId,
    };

    if (this.config.parseResponse) {
      const parsed = this.config.parseResponse(fullResponse, errorOutput);
      response = parsed.response;
      metadata = { ...metadata, ...parsed.metadata };
    }

    return {
      response,
      duration: Date.now() - startTime,
      modelUsed: options.model,
      metadata,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    const available = await this.isAvailable();
    return {
      available,
      lastChecked: new Date(),
      message: available
        ? `${this.config.name} is available`
        : `${this.config.name} not found or not configured`,
    };
  }
}

// ============================================================================
// Pre-configured VS Code Extension Providers
// ============================================================================

/**
 * Continue.dev extension provider
 * https://continue.dev/
 */
export function createContinueProvider(): VSCodeExtensionProvider {
  return new VSCodeExtensionProvider({
    extensionId: 'continue.continue',
    name: 'Continue.dev',
    checkCommand: ['which', 'continue'],
    executeCommand: (prompt, options) => [
      'continue',
      'chat',
      '--model',
      options.model || 'claude-sonnet-4',
      '--message',
      prompt,
    ],
    supportedModels: ['claude-sonnet-4', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    parseResponse: (stdout) => {
      // Continue.dev outputs in a specific format
      // This is a placeholder - adjust based on actual output
      return {
        response: stdout.trim(),
        metadata: { extensionId: 'continue.continue' },
      };
    },
  });
}

/**
 * Codeium extension provider
 * https://codeium.com/
 */
export function createCodeiumProvider(): VSCodeExtensionProvider {
  return new VSCodeExtensionProvider({
    extensionId: 'codeium.codeium',
    name: 'Codeium',
    checkCommand: ['which', 'codeium'],
    executeCommand: (prompt, options) => [
      'codeium',
      'chat',
      '--workspace',
      options.workspace || Deno.cwd(),
      '--prompt',
      prompt,
    ],
    supportedModels: ['codeium'],
  });
}

/**
 * Aider AI extension provider
 * https://aider.chat/
 */
export function createAiderProvider(): VSCodeExtensionProvider {
  return new VSCodeExtensionProvider({
    extensionId: 'aider.aider',
    name: 'Aider',
    checkCommand: ['which', 'aider'],
    executeCommand: (prompt, options) => {
      const args = [
        'aider',
        '--yes', // Auto-approve
        '--model',
        options.model || 'claude-sonnet-4',
      ];

      if (options.workspace) {
        args.push('--git-dir', options.workspace);
      }

      args.push('--message', prompt);
      return args;
    },
    supportedModels: [
      'claude-sonnet-4',
      'claude-opus-4',
      'gpt-4',
      'gpt-4-turbo-preview',
      'deepseek-coder',
    ],
  });
}
