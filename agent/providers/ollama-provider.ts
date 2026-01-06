/**
 * Ollama Provider
 *
 * Integration with Ollama local LLM server
 * Supports local and remote Ollama instances
 */

import {
  AgentProvider,
  ProviderType,
  AgentExecutionOptions,
  UniversalAgentResponse,
  ProviderStatus,
} from '../provider-interface.ts';

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number; // max tokens
    top_p?: number;
    top_k?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaProvider implements AgentProvider {
  readonly providerId = 'ollama';
  readonly providerName = 'Ollama';
  readonly providerType = ProviderType.API;

  get supportedModels(): string[] {
    // Return cached models if available, otherwise empty array
    return this.cachedModels.length > 0 ? this.cachedModels : [];
  }

  private baseUrl: string;
  private cachedModels: string[] = [];
  private lastModelCheck: Date | null = null;
  private readonly modelCacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Allow custom Ollama URL via environment variable
    this.baseUrl = Deno.env.get('OLLAMA_BASE_URL') || 'http://localhost:11434';
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if Ollama server is reachable
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });

      if (response.ok) {
        // Cache available models
        const data = await response.json();
        this.cachedModels = (data.models || []).map((m: OllamaModel) => m.name);
        this.lastModelCheck = new Date();
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private async getAvailableModels(): Promise<string[]> {
    // Return cached models if still valid
    if (
      this.cachedModels.length > 0 &&
      this.lastModelCheck &&
      Date.now() - this.lastModelCheck.getTime() < this.modelCacheTTL
    ) {
      return this.cachedModels;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        this.cachedModels = (data.models || []).map((m: OllamaModel) => m.name);
        this.lastModelCheck = new Date();
        return this.cachedModels;
      }
    } catch (error) {
      console.error('[Ollama] Failed to fetch models:', error);
    }

    return this.cachedModels;
  }

  async execute(
    prompt: string,
    options: AgentExecutionOptions,
    onChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<UniversalAgentResponse> {
    const startTime = Date.now();

    // Get available models
    const availableModels = await this.getAvailableModels();
    if (availableModels.length === 0) {
      throw new Error('No Ollama models available. Please pull a model first (e.g., `ollama pull llama3.2`)');
    }

    // Determine model to use
    // Prefer smaller/faster models for better performance on Mac
    // Priority: 1.5B/7B models > 14B models > larger models
    let model = options.model;
    if (!model) {
      // Find the fastest/smallest model available
      const fastModels = availableModels.filter(m => 
        m.includes('1.5b') || m.includes('7b') || m.includes('3b')
      );
      const mediumModels = availableModels.filter(m => 
        m.includes('14b') && !m.includes('32b')
      );
      
      // Prefer fast models, then medium, then any available
      model = fastModels[0] || mediumModels[0] || availableModels[0];
    }

    // Parse system prompt and user message
    const parts = prompt.split('\n\nTask: ');
    const systemPrompt = parts[0]?.replace(/^System: /, '') || '';
    const userMessage = parts[1] || prompt;

    // Build messages array
    const messages: OllamaChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userMessage });

    // Build request body
    const requestBody: OllamaChatRequest = {
      model,
      messages,
      stream: options.streaming !== false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens,
      },
    };

    let fullResponse = '';
    let totalDuration = 0;
    let promptEvalCount = 0;
    let evalCount = 0;

    if (options.streaming && onChunk) {
      // Streaming mode
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const event: OllamaChatResponse = JSON.parse(line);

              if (event.message?.content) {
                const chunk = event.message.content;
                fullResponse += chunk;
                onChunk(chunk);
              }

              if (event.done) {
                totalDuration = event.total_duration || 0;
                promptEvalCount = event.prompt_eval_count || 0;
                evalCount = event.eval_count || 0;
              }
            } catch (e) {
              // Skip invalid JSON lines
              console.warn('[Ollama] Failed to parse response line:', line);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      // Non-streaming mode
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...requestBody, stream: false }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const result: OllamaChatResponse = await response.json();
      fullResponse = result.message?.content || '';
      totalDuration = result.total_duration || 0;
      promptEvalCount = result.prompt_eval_count || 0;
      evalCount = result.eval_count || 0;
    }

    return {
      response: fullResponse,
      duration: Date.now() - startTime,
      modelUsed: model,
      metadata: {
        provider: 'ollama',
        baseUrl: this.baseUrl,
        promptTokens: promptEvalCount,
        completionTokens: evalCount,
        totalDuration,
      },
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    const available = await this.isAvailable();

    if (!available) {
      return {
        available: false,
        lastChecked: new Date(),
        message: `Ollama server not reachable at ${this.baseUrl}. Make sure Ollama is running.`,
      };
    }

    const models = await this.getAvailableModels();

    return {
      available: true,
      lastChecked: new Date(),
      message: models.length > 0
        ? `${models.length} model(s) available`
        : 'No models available. Pull a model with: ollama pull <model>',
      metadata: {
        baseUrl: this.baseUrl,
        models: models,
        modelCount: models.length,
      },
    };
  }

  async validateOptions(options: AgentExecutionOptions): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Validate model if specified
    if (options.model) {
      const availableModels = await this.getAvailableModels();
      if (availableModels.length > 0 && !availableModels.includes(options.model)) {
        errors.push(
          `Model "${options.model}" not found. Available models: ${availableModels.join(', ')}`
        );
      }
    }

    // Validate temperature
    if (options.temperature !== undefined && (options.temperature < 0 || options.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    // Validate max tokens
    if (options.maxTokens && options.maxTokens < 1) {
      errors.push('Max tokens must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
