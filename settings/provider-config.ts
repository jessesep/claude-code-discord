/**
 * Provider Configuration System
 * 
 * Unified configuration for all AI providers.
 * Manages API keys, endpoints, and provider-specific settings.
 */

import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderId = 
  | 'claude-cli'    // Anthropic Claude via CLI
  | 'anthropic-api' // Anthropic direct API
  | 'cursor'        // Cursor IDE CLI
  | 'gemini-api'    // Google Gemini via API key
  | 'antigravity'   // Google Gemini via gcloud OAuth
  | 'ollama'        // Local Ollama server
  | 'openai'        // OpenAI API
  | 'groq'          // Groq fast inference
  | 'together'      // Together AI
  | 'fireworks'     // Fireworks AI
  | 'deepseek'      // DeepSeek API
  | 'aider'         // Aider CLI
  | 'openrouter';   // OpenRouter (multi-model)

export interface ProviderConfigEntry {
  id: ProviderId;
  enabled: boolean;
  apiKey?: string;        // Stored encrypted or in env
  apiKeyEnvVar?: string;  // Environment variable name for API key
  endpoint?: string;      // Custom endpoint URL
  defaultModel?: string;  // Default model for this provider
  options?: Record<string, unknown>;
}

export interface ProviderMetadata {
  id: ProviderId;
  name: string;
  description: string;
  website: string;
  authType: 'api-key' | 'oauth' | 'cli-auth' | 'none';
  envVarName?: string;    // Standard env var for API key
  defaultEndpoint?: string;
  defaultModels: string[];
  setupInstructions: string;
  pricing: 'free' | 'paid' | 'freemium' | 'byok'; // byok = bring your own key
}

// ============================================================================
// Provider Metadata Registry
// ============================================================================

export const PROVIDER_METADATA: Record<ProviderId, ProviderMetadata> = {
  'claude-cli': {
    id: 'claude-cli',
    name: 'Claude CLI',
    description: 'Anthropic Claude via official CLI tool',
    website: 'https://docs.anthropic.com/en/docs/claude-cli',
    authType: 'cli-auth',
    defaultModels: ['sonnet', 'opus', 'haiku', 'claude-sonnet-4-5-20250929'],
    setupInstructions: 'Install: `npm install -g @anthropic-ai/claude-code`\nAuth: `claude login`',
    pricing: 'paid'
  },
  'anthropic-api': {
    id: 'anthropic-api',
    name: 'Anthropic API',
    description: 'Direct API access to Claude models',
    website: 'https://console.anthropic.com/',
    authType: 'api-key',
    envVarName: 'ANTHROPIC_API_KEY',
    defaultEndpoint: 'https://api.anthropic.com',
    defaultModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-20250514', 'claude-3-5-haiku-latest'],
    setupInstructions: 'Get API key from https://console.anthropic.com/\nSet: `export ANTHROPIC_API_KEY=sk-ant-...`',
    pricing: 'paid'
  },
  'cursor': {
    id: 'cursor',
    name: 'Cursor Agent',
    description: 'Cursor IDE agent via CLI',
    website: 'https://cursor.com/cli',
    authType: 'cli-auth',
    defaultModels: ['auto', 'sonnet-4', 'sonnet-4-thinking', 'opus-4', 'gpt-5', 'gpt-4o', 'o1'],
    setupInstructions: 'Install: `curl https://cursor.com/install -fsS | bash`\nAuth: `cursor-agent login`',
    pricing: 'paid'
  },
  'gemini-api': {
    id: 'gemini-api',
    name: 'Google Gemini API',
    description: 'Google Gemini models via API key',
    website: 'https://aistudio.google.com/apikey',
    authType: 'api-key',
    envVarName: 'GEMINI_API_KEY',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModels: ['gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    setupInstructions: 'Get API key from https://aistudio.google.com/apikey\nSet: `export GEMINI_API_KEY=...`',
    pricing: 'freemium'
  },
  'antigravity': {
    id: 'antigravity',
    name: 'Antigravity (gcloud)',
    description: 'Google Gemini via gcloud OAuth - more secure',
    website: 'https://cloud.google.com/sdk',
    authType: 'oauth',
    defaultModels: ['gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    setupInstructions: 'Install gcloud: https://cloud.google.com/sdk/docs/install\nAuth: `gcloud auth application-default login`',
    pricing: 'paid'
  },
  'ollama': {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local LLM server - private & free',
    website: 'https://ollama.ai',
    authType: 'none',
    envVarName: 'OLLAMA_BASE_URL',
    defaultEndpoint: 'http://localhost:11434',
    defaultModels: ['deepseek-r1:1.5b', 'llama3.2:3b', 'qwen2.5:7b', 'codellama:7b'],
    setupInstructions: 'Install: https://ollama.ai/download\nPull model: `ollama pull deepseek-r1:1.5b`',
    pricing: 'free'
  },
  'openai': {
    id: 'openai',
    name: 'OpenAI API',
    description: 'GPT-4o, o1, o3, and Codex models',
    website: 'https://platform.openai.com/',
    authType: 'api-key',
    envVarName: 'OPENAI_API_KEY',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini'],
    setupInstructions: 'Get API key from https://platform.openai.com/api-keys\nSet: `export OPENAI_API_KEY=sk-...`',
    pricing: 'paid'
  },
  'groq': {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast inference for open models',
    website: 'https://console.groq.com/',
    authType: 'api-key',
    envVarName: 'GROQ_API_KEY',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    setupInstructions: 'Get API key from https://console.groq.com/keys\nSet: `export GROQ_API_KEY=gsk_...`',
    pricing: 'freemium'
  },
  'together': {
    id: 'together',
    name: 'Together AI',
    description: 'Host and run open-source models',
    website: 'https://together.ai/',
    authType: 'api-key',
    envVarName: 'TOGETHER_API_KEY',
    defaultEndpoint: 'https://api.together.xyz/v1',
    defaultModels: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
    setupInstructions: 'Get API key from https://api.together.xyz/settings/api-keys\nSet: `export TOGETHER_API_KEY=...`',
    pricing: 'paid'
  },
  'fireworks': {
    id: 'fireworks',
    name: 'Fireworks AI',
    description: 'Fast inference with competitive pricing',
    website: 'https://fireworks.ai/',
    authType: 'api-key',
    envVarName: 'FIREWORKS_API_KEY',
    defaultEndpoint: 'https://api.fireworks.ai/inference/v1',
    defaultModels: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/qwen2p5-72b-instruct'],
    setupInstructions: 'Get API key from https://fireworks.ai/api-keys\nSet: `export FIREWORKS_API_KEY=...`',
    pricing: 'paid'
  },
  'deepseek': {
    id: 'deepseek',
    name: 'DeepSeek API',
    description: 'DeepSeek reasoning and code models',
    website: 'https://platform.deepseek.com/',
    authType: 'api-key',
    envVarName: 'DEEPSEEK_API_KEY',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    setupInstructions: 'Get API key from https://platform.deepseek.com/api_keys\nSet: `export DEEPSEEK_API_KEY=...`',
    pricing: 'paid'
  },
  'aider': {
    id: 'aider',
    name: 'Aider',
    description: 'AI pair programming in your terminal',
    website: 'https://aider.chat/',
    authType: 'api-key',
    envVarName: 'OPENAI_API_KEY', // Aider uses OpenAI by default
    defaultModels: ['gpt-4o', 'claude-3-5-sonnet', 'deepseek-chat'],
    setupInstructions: 'Install: `pip install aider-chat`\nSet API key for your preferred provider',
    pricing: 'byok'
  },
  'openrouter': {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified API for 100+ models',
    website: 'https://openrouter.ai/',
    authType: 'api-key',
    envVarName: 'OPENROUTER_API_KEY',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    defaultModels: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro-1.5'],
    setupInstructions: 'Get API key from https://openrouter.ai/keys\nSet: `export OPENROUTER_API_KEY=...`',
    pricing: 'paid'
  }
};

// ============================================================================
// Provider Configuration Storage
// ============================================================================

export interface ProviderConfigStore {
  providers: Record<ProviderId, ProviderConfigEntry>;
  defaultProvider: ProviderId;
  defaultModelByRole: {
    builder: string;
    tester: string;
    investigator: string;
    architect: string;
    reviewer: string;
  };
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfigStore = {
  providers: {
    'claude-cli': { id: 'claude-cli', enabled: true },
    'anthropic-api': { id: 'anthropic-api', enabled: false, apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
    'cursor': { id: 'cursor', enabled: true },
    'gemini-api': { id: 'gemini-api', enabled: true, apiKeyEnvVar: 'GEMINI_API_KEY' },
    'antigravity': { id: 'antigravity', enabled: true },
    'ollama': { id: 'ollama', enabled: true, endpoint: 'http://localhost:11434' },
    'openai': { id: 'openai', enabled: false, apiKeyEnvVar: 'OPENAI_API_KEY' },
    'groq': { id: 'groq', enabled: false, apiKeyEnvVar: 'GROQ_API_KEY' },
    'together': { id: 'together', enabled: false, apiKeyEnvVar: 'TOGETHER_API_KEY' },
    'fireworks': { id: 'fireworks', enabled: false, apiKeyEnvVar: 'FIREWORKS_API_KEY' },
    'deepseek': { id: 'deepseek', enabled: false, apiKeyEnvVar: 'DEEPSEEK_API_KEY' },
    'aider': { id: 'aider', enabled: false },
    'openrouter': { id: 'openrouter', enabled: false, apiKeyEnvVar: 'OPENROUTER_API_KEY' },
  },
  defaultProvider: 'gemini-api',
  defaultModelByRole: {
    builder: 'gemini-3-flash-preview',
    tester: 'gemini-2.0-flash',
    investigator: 'gemini-2.5-pro',
    architect: 'gemini-2.5-pro',
    reviewer: 'gemini-2.0-flash',
  }
};

// ============================================================================
// Config Slash Command
// ============================================================================

export const configCommand = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configure AI providers, API keys, and bot settings')
  .addSubcommand(sub =>
    sub.setName('providers')
      .setDescription('List all available AI providers and their status'))
  .addSubcommand(sub =>
    sub.setName('enable')
      .setDescription('Enable a provider')
      .addStringOption(opt =>
        opt.setName('provider')
          .setDescription('Provider to enable')
          .setRequired(true)
          .addChoices(
            ...Object.values(PROVIDER_METADATA).map(p => ({ name: p.name, value: p.id }))
          )))
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Disable a provider')
      .addStringOption(opt =>
        opt.setName('provider')
          .setDescription('Provider to disable')
          .setRequired(true)
          .addChoices(
            ...Object.values(PROVIDER_METADATA).map(p => ({ name: p.name, value: p.id }))
          )))
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Get setup instructions for a provider')
      .addStringOption(opt =>
        opt.setName('provider')
          .setDescription('Provider to get setup info for')
          .setRequired(true)
          .addChoices(
            ...Object.values(PROVIDER_METADATA).map(p => ({ name: p.name, value: p.id }))
          )))
  .addSubcommand(sub =>
    sub.setName('default')
      .setDescription('Set the default provider')
      .addStringOption(opt =>
        opt.setName('provider')
          .setDescription('Provider to set as default')
          .setRequired(true)
          .addChoices(
            ...Object.values(PROVIDER_METADATA).map(p => ({ name: p.name, value: p.id }))
          )))
  .addSubcommand(sub =>
    sub.setName('model')
      .setDescription('Set default model for a role')
      .addStringOption(opt =>
        opt.setName('role')
          .setDescription('Role to configure')
          .setRequired(true)
          .addChoices(
            { name: 'Builder', value: 'builder' },
            { name: 'Tester', value: 'tester' },
            { name: 'Investigator', value: 'investigator' },
            { name: 'Architect', value: 'architect' },
            { name: 'Reviewer', value: 'reviewer' }
          ))
      .addStringOption(opt =>
        opt.setName('model')
          .setDescription('Model name to use')
          .setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('endpoint')
      .setDescription('Set custom endpoint for a provider')
      .addStringOption(opt =>
        opt.setName('provider')
          .setDescription('Provider to configure')
          .setRequired(true)
          .addChoices(
            ...Object.values(PROVIDER_METADATA).map(p => ({ name: p.name, value: p.id }))
          ))
      .addStringOption(opt =>
        opt.setName('url')
          .setDescription('Custom endpoint URL')
          .setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('test')
      .setDescription('Test a provider connection')
      .addStringOption(opt =>
        opt.setName('provider')
          .setDescription('Provider to test')
          .setRequired(true)
          .addChoices(
            ...Object.values(PROVIDER_METADATA).map(p => ({ name: p.name, value: p.id }))
          )));

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a provider has valid credentials
 */
export function checkProviderCredentials(providerId: ProviderId): { valid: boolean; message: string } {
  const metadata = PROVIDER_METADATA[providerId];
  
  if (metadata.authType === 'none') {
    return { valid: true, message: 'No authentication required' };
  }
  
  if (metadata.authType === 'api-key' && metadata.envVarName) {
    const key = Deno.env.get(metadata.envVarName);
    if (key && key.length > 0) {
      // Mask the key for display
      const masked = key.substring(0, 8) + '...' + key.substring(key.length - 4);
      return { valid: true, message: `API key found: ${masked}` };
    }
    return { valid: false, message: `Missing env var: ${metadata.envVarName}` };
  }
  
  if (metadata.authType === 'cli-auth') {
    return { valid: true, message: 'Requires CLI authentication' };
  }
  
  if (metadata.authType === 'oauth') {
    return { valid: true, message: 'Requires OAuth authentication' };
  }
  
  return { valid: false, message: 'Unknown auth type' };
}

/**
 * Get all enabled providers with their status
 */
export async function getEnabledProviders(config: ProviderConfigStore): Promise<Array<{
  id: ProviderId;
  name: string;
  enabled: boolean;
  available: boolean;
  credentialStatus: string;
}>> {
  const results = [];
  
  for (const [id, entry] of Object.entries(config.providers)) {
    const metadata = PROVIDER_METADATA[id as ProviderId];
    const credCheck = checkProviderCredentials(id as ProviderId);
    
    results.push({
      id: id as ProviderId,
      name: metadata.name,
      enabled: entry.enabled,
      available: credCheck.valid,
      credentialStatus: credCheck.message
    });
  }
  
  return results;
}

/**
 * Format provider list for Discord embed
 */
export function formatProviderList(providers: Array<{
  id: ProviderId;
  name: string;
  enabled: boolean;
  available: boolean;
  credentialStatus: string;
}>): string {
  return providers.map(p => {
    const statusEmoji = p.enabled ? (p.available ? '✅' : '⚠️') : '❌';
    const statusText = p.enabled ? (p.available ? 'Ready' : 'Missing credentials') : 'Disabled';
    return `${statusEmoji} **${p.name}** (\`${p.id}\`)\n   ${statusText}`;
  }).join('\n\n');
}
