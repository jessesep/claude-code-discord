// Dashboard types aligned with bot's UnifiedBotSettings
export type RiskLevel = 'low' | 'medium' | 'high';

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  capabilities: string[];
  riskLevel: RiskLevel;
  client: 'claude' | 'cursor' | 'antigravity';
  isManager?: boolean;
}

export interface Session {
  id: string;
  agentName: string;
  userId: string;
  channelId: string;
  startTime: string;
  messageCount: number;
  totalCost: number;
  lastActivity: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  task?: string;
}

export interface Webhook {
  id: string;
  name: string;
  enabled: boolean;
  secret: string | null;
  actions: string[];
  // For display purposes
  url?: string;
  type?: 'discord' | 'slack' | 'generic';
  events?: string[];
  status?: 'active' | 'inactive';
  lastPing?: string;
}

// Aligned with UnifiedBotSettings from settings/unified-settings.ts
export interface BotSettings {
  // Basic bot settings
  mentionEnabled: boolean;
  mentionUserId: string | null;

  // Claude settings
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultSystemPrompt: string | null;
  autoIncludeSystemInfo: boolean;
  autoIncludeGitContext: boolean;

  // Thinking mode
  thinkingMode: 'none' | 'think' | 'think-hard' | 'ultrathink';

  // Operation mode
  operationMode: 'normal' | 'plan' | 'auto-accept' | 'danger';

  // Output settings
  codeHighlighting: boolean;
  autoPageLongOutput: boolean;
  maxOutputLength: number;
  timestampFormat: 'relative' | 'absolute' | 'both';

  // Session settings
  autoSaveConversations: boolean;
  sessionTimeout: number;
  maxSessionsPerUser: number;

  // System monitoring
  defaultProcessLimit: number;
  defaultLogLines: number;
  showSystemWarnings: boolean;

  // Developer settings
  enableDebugMode: boolean;
  verboseErrorReporting: boolean;
  enablePerformanceMetrics: boolean;

  // Proxy settings
  proxyEnabled: boolean;
  proxyUrl: string | null;
  noProxyDomains: string[];

  // Webhook settings
  webhooks: Webhook[];
  apiKey: string | null;

  // Legacy fields for compatibility (mapped from UnifiedBotSettings)
  temperature?: number; // Alias for defaultTemperature
  maxTokensPerSession?: number; // Alias for defaultMaxTokens
  retryAttempts?: number; // Not in UnifiedBotSettings, but may be used
}

export interface SystemStat {
  cpu: number;
  memory: string;
  uptime: string;
  activeProcesses: number;
}

// Provider configuration types
export type ProviderId = 
  | 'claude-cli' | 'anthropic-api' | 'cursor' | 'gemini-api' 
  | 'antigravity' | 'ollama' | 'openai' | 'groq' 
  | 'together' | 'fireworks' | 'deepseek' | 'aider' | 'openrouter';

export interface ProviderConfig {
  id: ProviderId;
  enabled: boolean;
  apiKey?: string;
  apiKeyEnvVar?: string;
  endpoint?: string;
  defaultModel?: string;
}

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  enabled: boolean;
  available: boolean;
  credentialStatus: string;
  pricing: 'free' | 'paid' | 'freemium' | 'byok';
}
