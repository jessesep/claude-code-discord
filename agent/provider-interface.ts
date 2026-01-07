/**
 * Universal Agent Provider Interface
 *
 * This interface abstracts all agent execution backends (CLI tools, APIs, VS Code extensions, etc.)
 * into a common contract. This enables the Discord bot to work with any agent type seamlessly.
 */

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Universal response format for all agent providers
 */
export interface UniversalAgentResponse {
  /** The main response content */
  response: string;

  /** Execution duration in milliseconds */
  duration?: number;

  /** Model identifier used for this response */
  modelUsed?: string;

  /** Session/Chat ID for resumable conversations */
  sessionId?: string;

  /** Cost information (if applicable) */
  cost?: number;

  /** Execution timing details */
  timing?: { duration: number };

  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;

  /** Files modified during execution (for code agents) */
  filesModified?: string[];

  /** Tool calls made during execution */
  toolCalls?: ToolCall[];
}

/**
 * Tool call information
 */
export interface ToolCall {
  type: string;
  name: string;
  input?: unknown;
  output?: unknown;
}

/**
 * Universal options for agent execution
 */
export interface AgentExecutionOptions {
  /** Model/Agent identifier */
  model?: string;

  /** Working directory / workspace */
  workspace?: string;

  /** Auto-approve operations (dangerous) */
  force?: boolean;

  /** Enable sandbox mode */
  sandbox?: boolean;

  /** Resume from previous session */
  resumeSessionId?: string;

  /** Enable streaming output */
  streaming?: boolean;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Temperature for generation */
  temperature?: number;

  /** Provider-specific options */
  providerOptions?: Record<string, unknown>;
}

/**
 * Agent Provider Interface
 *
 * All agent backends must implement this interface
 */
export interface AgentProvider {
  /** Unique identifier for this provider */
  readonly providerId: string;

  /** Human-readable name */
  readonly providerName: string;

  /** Provider type classification */
  readonly providerType: ProviderType;

  /** List of supported models/agents (can be updated dynamically) */
  supportedModels: string[];

  /** Optional: Dynamically refresh/list available models from the provider */
  listModels?(): Promise<string[]>;

  /** Check if provider is available (installed, configured, etc.) */
  isAvailable(): Promise<boolean>;

  /** Execute a prompt with this provider */
  execute(
    prompt: string,
    options: AgentExecutionOptions,
    onChunk?: (chunk: string) => void,
    abortSignal?: AbortSignal
  ): Promise<UniversalAgentResponse>;

  /** Validate provider-specific options */
  validateOptions?(options: AgentExecutionOptions): Promise<{ valid: boolean; errors?: string[] }>;

  /** Get provider health/status */
  getStatus?(): Promise<ProviderStatus>;
}

/**
 * Provider classification
 */
export enum ProviderType {
  /** Claude CLI and similar command-line tools */
  CLI = 'cli',

  /** Direct API clients (Anthropic, OpenAI, etc.) */
  API = 'api',

  /** VS Code extensions and IDE integrations */
  IDE_EXTENSION = 'ide_extension',

  /** Custom local agents */
  CUSTOM = 'custom',

  /** Remote/hosted agents */
  REMOTE = 'remote',
}

/**
 * Provider health status
 */
export interface ProviderStatus {
  available: boolean;
  message?: string;
  version?: string;
  lastChecked: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Provider Registry
// ============================================================================

/**
 * Global registry for all agent providers
 */
export class AgentProviderRegistry {
  private static providers = new Map<string, AgentProvider>();

  /**
   * Register a new agent provider
   */
  static register(provider: AgentProvider): void {
    if (this.providers.has(provider.providerId)) {
      console.warn(`[Registry] Overwriting existing provider: ${provider.providerId}`);
    }
    this.providers.set(provider.providerId, provider);
    console.log(`[Registry] Registered provider: ${provider.providerId} (${provider.providerName})`);
  }

  /**
   * Get a provider by ID
   */
  static getProvider(providerId: string): AgentProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all registered providers
   */
  static getAllProviders(): AgentProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers by type
   */
  static getProvidersByType(type: ProviderType): AgentProvider[] {
    return Array.from(this.providers.values()).filter(p => p.providerType === type);
  }

  /**
   * Get all available providers (actually installed/configured)
   */
  static async getAvailableProviders(): Promise<AgentProvider[]> {
    const providers = Array.from(this.providers.values());
    const availabilityChecks = await Promise.all(
      providers.map(async p => ({ provider: p, available: await p.isAvailable() }))
    );
    return availabilityChecks.filter(c => c.available).map(c => c.provider);
  }

  /**
   * Unregister a provider
   */
  static unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  /**
   * Clear all providers (useful for testing)
   */
  static clear(): void {
    this.providers.clear();
  }
}

// ============================================================================
// Enhanced Agent Configuration
// ============================================================================

/**
 * Enhanced agent configuration using provider system
 */
export interface EnhancedAgentConfig {
  /** Unique agent identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of agent capabilities */
  description: string;

  /** Provider ID to use */
  providerId: string;

  /** Model identifier within that provider */
  model: string;

  /** System prompt */
  systemPrompt: string;

  /** Default execution options */
  defaultOptions: AgentExecutionOptions;

  /** Agent capabilities */
  capabilities: string[];

  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high';

  /** Is this a manager agent? */
  isManager?: boolean;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a unified agent executor that works with any provider
 */
export async function executeAgent(
  config: EnhancedAgentConfig,
  userPrompt: string,
  options: Partial<AgentExecutionOptions> = {},
  onChunk?: (chunk: string) => void,
  abortSignal?: AbortSignal
): Promise<UniversalAgentResponse> {
  // Get the provider
  const provider = AgentProviderRegistry.getProvider(config.providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${config.providerId}`);
  }

  // Check availability
  const isAvailable = await provider.isAvailable();
  if (!isAvailable) {
    throw new Error(`Provider ${config.providerId} is not available`);
  }

  // Merge options
  const executionOptions: AgentExecutionOptions = {
    ...config.defaultOptions,
    ...options,
    model: options.model || config.model,
  };

  // Validate options if provider supports it
  if (provider.validateOptions) {
    const validation = await provider.validateOptions(executionOptions);
    if (!validation.valid) {
      throw new Error(`Invalid options: ${validation.errors?.join(', ')}`);
    }
  }

  // Build full prompt
  const fullPrompt = `${config.systemPrompt}\n\nTask: ${userPrompt}`;

  // Execute
  return await provider.execute(fullPrompt, executionOptions, onChunk, abortSignal);
}
