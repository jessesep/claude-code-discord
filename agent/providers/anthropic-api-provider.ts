/**
 * Anthropic API Provider
 *
 * Direct integration with Anthropic's Messages API
 * Useful for teams that want to use API keys instead of CLI
 */

import {
  AgentProvider,
  ProviderType,
  AgentExecutionOptions,
  UniversalAgentResponse,
  ProviderStatus,
  ToolCall,
} from '../provider-interface.ts';

export class AnthropicApiProvider implements AgentProvider {
  readonly providerId = 'anthropic-api';
  readonly providerName = 'Anthropic Messages API';
  readonly providerType = ProviderType.API;
  readonly supportedModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
  ];

  private apiKey: string | undefined;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor() {
    this.apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async execute(
    prompt: string,
    options: AgentExecutionOptions,
    onChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<UniversalAgentResponse> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }

    const startTime = Date.now();

    // Parse system prompt and user message
    const parts = prompt.split('\n\nTask: ');
    const systemPrompt = parts[0]?.replace(/^System: /, '') || '';
    const userMessage = parts[1] || prompt;

    // Build request body
    const requestBody = {
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 8000,
      temperature: options.temperature ?? 0.7,
      system: systemPrompt || undefined,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      stream: options.streaming !== false,
    };

    let fullResponse = '';
    let toolCalls: ToolCall[] = [];
    let inputTokens = 0;
    let outputTokens = 0;

    if (options.streaming && onChunk) {
      // Streaming mode
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);

            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const chunk = event.delta.text;
              fullResponse += chunk;
              onChunk(chunk);
            } else if (event.type === 'message_delta' && event.usage) {
              outputTokens = event.usage.output_tokens || 0;
            } else if (event.type === 'message_start' && event.message?.usage) {
              inputTokens = event.message.usage.input_tokens || 0;
            }
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    } else {
      // Non-streaming mode
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ ...requestBody, stream: false }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const result = await response.json();

      // Extract content
      for (const content of result.content || []) {
        if (content.type === 'text') {
          fullResponse += content.text;
        } else if (content.type === 'tool_use') {
          toolCalls.push({
            type: 'tool_use',
            name: content.name,
            input: content.input,
          });
        }
      }

      inputTokens = result.usage?.input_tokens || 0;
      outputTokens = result.usage?.output_tokens || 0;
    }

    // Calculate cost (approximate pricing as of 2024)
    const cost = this.calculateCost(requestBody.model, inputTokens, outputTokens);

    return {
      response: fullResponse,
      duration: Date.now() - startTime,
      modelUsed: requestBody.model,
      cost,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      metadata: {
        provider: 'anthropic-api',
        inputTokens,
        outputTokens,
      },
    };
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Pricing per million tokens (approximate)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
      'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
      'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
      'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },
      'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    };

    const rates = pricing[model] || { input: 3.0, output: 15.0 };
    return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
  }

  async getStatus(): Promise<ProviderStatus> {
    if (!this.apiKey) {
      return {
        available: false,
        lastChecked: new Date(),
        message: 'ANTHROPIC_API_KEY not set',
      };
    }

    // Verify API key by making a minimal request
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      return {
        available: response.ok || response.status === 400, // 400 is ok (just invalid params, but auth works)
        lastChecked: new Date(),
        message: response.ok ? 'API key valid' : `API returned ${response.status}`,
      };
    } catch (error) {
      return {
        available: false,
        lastChecked: new Date(),
        message: `API check failed: ${error}`,
      };
    }
  }

  async validateOptions(options: AgentExecutionOptions): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Validate model
    if (options.model && !this.supportedModels.includes(options.model)) {
      errors.push(`Unsupported model: ${options.model}. Supported: ${this.supportedModels.join(', ')}`);
    }

    // Validate max tokens
    if (options.maxTokens && options.maxTokens > 200000) {
      errors.push('Max tokens cannot exceed 200,000');
    }

    // Validate temperature
    if (options.temperature !== undefined && (options.temperature < 0 || options.temperature > 1)) {
      errors.push('Temperature must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
