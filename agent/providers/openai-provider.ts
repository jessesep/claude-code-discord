/**
 * OpenAI API Provider
 *
 * Direct API access to GPT-4o, o1, o3 models via OpenAI API
 */

import {
  AgentProvider,
  ProviderType,
  AgentExecutionOptions,
  UniversalAgentResponse,
  ProviderStatus,
} from '../provider-interface.ts';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export class OpenAIProvider implements AgentProvider {
  readonly providerId = 'openai';
  readonly providerName = 'OpenAI API';
  readonly providerType = ProviderType.API;
  supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'o1',
    'o1-mini',
    'o1-preview',
    'o3-mini',
    'gpt-3.5-turbo',
  ];

  private baseUrl: string;
  private apiKey: string | undefined;

  constructor() {
    this.baseUrl = Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    this.apiKey = Deno.env.get('OPENAI_API_KEY');
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  async listModels(): Promise<string[]> {
    if (!this.apiKey) return this.supportedModels;

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        const models = data.data
          ?.filter((m: any) => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'))
          ?.map((m: any) => m.id) || [];
        
        if (models.length > 0) {
          this.supportedModels = models;
        }
      }
    } catch (error) {
      console.warn('[OpenAI] Failed to fetch models:', error);
    }

    return this.supportedModels;
  }

  async execute(
    prompt: string,
    options: AgentExecutionOptions,
    onChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<UniversalAgentResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }

    const startTime = Date.now();
    const model = options.model || 'gpt-4o';

    // Parse system prompt and user message
    let systemPrompt = '';
    let userMessage = prompt;

    if (prompt.includes('\n\nTask: ')) {
      const parts = prompt.split('\n\nTask: ');
      systemPrompt = parts[0]?.replace(/^System: /, '') || '';
      userMessage = parts.slice(1).join('\n\nTask: ');
    }

    // Build messages
    const messages: OpenAIMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userMessage });

    const requestBody: OpenAIChatRequest = {
      model,
      messages,
      stream: options.streaming !== false,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    };

    let fullResponse = '';

    if (options.streaming && onChunk) {
      // Streaming mode
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
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
            if (!line.trim() || !line.startsWith('data: ')) continue;
            
            const data = line.substring(6).trim();
            if (data === '[DONE]') continue;

            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                onChunk(content);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      // Non-streaming mode
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...requestBody, stream: false }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      fullResponse = result.choices?.[0]?.message?.content || '';
    }

    return {
      response: fullResponse,
      duration: Date.now() - startTime,
      modelUsed: model,
      metadata: {
        provider: 'openai',
      },
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    const available = await this.isAvailable();

    if (!available) {
      return {
        available: false,
        lastChecked: new Date(),
        message: 'OpenAI API key not found. Set OPENAI_API_KEY environment variable.',
      };
    }

    // Try a simple API call to verify the key works
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return {
          available: true,
          lastChecked: new Date(),
          message: 'OpenAI API connected',
        };
      } else {
        return {
          available: false,
          lastChecked: new Date(),
          message: `API error: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        available: false,
        lastChecked: new Date(),
        message: `Connection failed: ${error}`,
      };
    }
  }

  async validateOptions(options: AgentExecutionOptions): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (options.model && !this.supportedModels.includes(options.model)) {
      // Don't error - OpenAI might have new models
      console.warn(`[OpenAI] Model "${options.model}" not in known list, but attempting anyway`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
