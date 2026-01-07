/**
 * Groq Provider
 *
 * Ultra-fast inference for open models via Groq's LPU architecture
 * Uses OpenAI-compatible API
 */

import {
  AgentProvider,
  ProviderType,
  AgentExecutionOptions,
  UniversalAgentResponse,
  ProviderStatus,
} from '../provider-interface.ts';

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqChatRequest {
  model: string;
  messages: GroqMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export class GroqProvider implements AgentProvider {
  readonly providerId = 'groq';
  readonly providerName = 'Groq';
  readonly providerType = ProviderType.API;
  supportedModels = [
    'llama-3.3-70b-versatile',
    'llama-3.3-70b-specdec',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-guard-3-8b',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'gemma-7b-it',
  ];

  private baseUrl: string;
  private apiKey: string | undefined;

  constructor() {
    this.baseUrl = Deno.env.get('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1';
    this.apiKey = Deno.env.get('GROQ_API_KEY');
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
        const models = data.data?.map((m: any) => m.id) || [];
        
        if (models.length > 0) {
          this.supportedModels = models;
        }
      }
    } catch (error) {
      console.warn('[Groq] Failed to fetch models:', error);
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
      throw new Error('Groq API key not configured. Set GROQ_API_KEY environment variable.');
    }

    const startTime = Date.now();
    const model = options.model || 'llama-3.3-70b-versatile';

    // Parse system prompt and user message
    let systemPrompt = '';
    let userMessage = prompt;

    if (prompt.includes('\n\nTask: ')) {
      const parts = prompt.split('\n\nTask: ');
      systemPrompt = parts[0]?.replace(/^System: /, '') || '';
      userMessage = parts.slice(1).join('\n\nTask: ');
    }

    // Build messages
    const messages: GroqMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userMessage });

    const requestBody: GroqChatRequest = {
      model,
      messages,
      stream: options.streaming !== false,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 8192,
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
        throw new Error(`Groq API error: ${response.status} - ${error}`);
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
        throw new Error(`Groq API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      fullResponse = result.choices?.[0]?.message?.content || '';
    }

    return {
      response: fullResponse,
      duration: Date.now() - startTime,
      modelUsed: model,
      metadata: {
        provider: 'groq',
        // Groq is known for speed - typically < 500ms for first token
        inferenceEngine: 'LPU',
      },
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    const available = await this.isAvailable();

    if (!available) {
      return {
        available: false,
        lastChecked: new Date(),
        message: 'Groq API key not found. Set GROQ_API_KEY environment variable.',
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
        const data = await response.json();
        const modelCount = data.data?.length || 0;
        return {
          available: true,
          lastChecked: new Date(),
          message: `Groq connected - ${modelCount} models available`,
          metadata: {
            models: data.data?.map((m: any) => m.id) || [],
          },
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
      console.warn(`[Groq] Model "${options.model}" not in known list, but attempting anyway`);
    }

    // Groq has a max context window, validate max_tokens
    if (options.maxTokens && options.maxTokens > 32768) {
      errors.push(`Max tokens ${options.maxTokens} exceeds Groq limit of 32768`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
