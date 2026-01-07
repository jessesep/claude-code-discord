import { 
  AgentProvider, 
  ProviderType, 
  UniversalAgentResponse, 
  AgentExecutionOptions,
  ProviderStatus
} from "../provider-interface.ts";
import { RemoteAgentEndpoint } from "../types.ts";

/**
 * Remote Provider Adapter
 * 
 * Routes execution requests to a remote agent endpoint.
 */
export class RemoteProvider implements AgentProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerType = ProviderType.REMOTE;
  readonly supportedModels: string[] = [];

  constructor(private endpoint: RemoteAgentEndpoint) {
    this.providerId = `remote-${endpoint.id}`;
    this.providerName = `Remote: ${endpoint.name}`;
    this.supportedModels = endpoint.providers; // Use providers as models for now
  }

  async isAvailable(): Promise<boolean> {
    return this.endpoint.status === 'online';
  }

  async execute(
    prompt: string,
    options: AgentExecutionOptions,
    onChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<UniversalAgentResponse> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.endpoint.url}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.endpoint.apiKey ? { 'X-API-Key': this.endpoint.apiKey } : {})
        },
        body: JSON.stringify({
          taskId: crypto.randomUUID(),
          prompt,
          agentConfig: {
            model: options.model,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            // ... other config fields
          },
          options: {
            workspace: options.workspace,
            force: options.force,
            sandbox: options.sandbox,
            streaming: !!onChunk
          }
        }),
        signal: abortSignal
      });

      if (!response.ok) {
        throw new Error(`Remote execution failed: ${response.statusText}`);
      }

      if (onChunk && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullOutput = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          // SSE format: data: { "output": "..." }
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.output) {
                  onChunk(data.output);
                  fullOutput += data.output;
                }
                if (data.status === 'completed' || data.status === 'error') {
                   // End of stream logic if needed
                }
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          }
        }

        return {
          response: fullOutput,
          duration: Date.now() - startTime,
          modelUsed: options.model,
          metadata: { endpoint: this.endpoint.id }
        };
      } else {
        const result = await response.json();
        return {
          response: result.output || "",
          duration: Date.now() - startTime,
          modelUsed: options.model,
          metadata: { endpoint: this.endpoint.id }
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      console.error(`[RemoteProvider] Execution error for ${this.endpoint.id}:`, error);
      throw error;
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      available: this.endpoint.status === 'online',
      message: `Remote endpoint at ${this.endpoint.url}`,
      lastChecked: this.endpoint.lastHealthCheck,
      metadata: { 
        id: this.endpoint.id,
        capabilities: this.endpoint.capabilities 
      }
    };
  }
}
