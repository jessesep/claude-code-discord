/**
 * Provider Registry Bootstrap
 *
 * Registers all available providers on application startup
 */

import { AgentProviderRegistry } from '../provider-interface.ts';

// Import all provider implementations
import { ClaudeCliProvider } from './claude-cli-provider.ts';
import { CursorProvider } from './cursor-provider.ts';
import { AntigravityProvider } from './antigravity-provider.ts';
import { AnthropicApiProvider } from './anthropic-api-provider.ts';
import { OllamaProvider } from './ollama-provider.ts';
import { OpenAIProvider } from './openai-provider.ts';
import { GroqProvider } from './groq-provider.ts';
import {
  createContinueProvider,
  createCodeiumProvider,
  createAiderProvider,
} from './vscode-provider.ts';

/**
 * Initialize all providers
 * Call this once during application startup
 */
export async function initializeProviders(): Promise<void> {
  console.log('[Providers] Initializing agent provider registry...');

  // Core providers
  AgentProviderRegistry.register(new ClaudeCliProvider());
  AgentProviderRegistry.register(new CursorProvider());
  AgentProviderRegistry.register(new AntigravityProvider());
  AgentProviderRegistry.register(new AnthropicApiProvider());
  AgentProviderRegistry.register(new OllamaProvider());
  AgentProviderRegistry.register(new OpenAIProvider());
  AgentProviderRegistry.register(new GroqProvider());

  // VS Code extension providers
  AgentProviderRegistry.register(createContinueProvider());
  AgentProviderRegistry.register(createCodeiumProvider());
  AgentProviderRegistry.register(createAiderProvider());

  // Check availability of all providers
  const providers = AgentProviderRegistry.getAllProviders();
  console.log(`[Providers] Registered ${providers.length} providers`);

  const availableProviders = await AgentProviderRegistry.getAvailableProviders();
  console.log(`[Providers] ${availableProviders.length} providers are available:`);

  for (const provider of availableProviders) {
    const status = await provider.getStatus?.();
    console.log(
      `  ✓ ${provider.providerName} (${provider.providerId})${status?.version ? ` - ${status.version}` : ''}`
    );
  }

  const unavailableProviders = providers.filter(
    p => !availableProviders.includes(p)
  );
  if (unavailableProviders.length > 0) {
    console.log(`[Providers] ${unavailableProviders.length} providers are unavailable:`);
    for (const provider of unavailableProviders) {
      const status = await provider.getStatus?.();
      console.log(`  ✗ ${provider.providerName} - ${status?.message || 'Not available'}`);
    }
  }

  console.log('[Providers] Initialization complete');
}

/**
 * Get provider status report
 */
export async function getProviderStatusReport(): Promise<string> {
  const providers = AgentProviderRegistry.getAllProviders();
  const lines: string[] = [
    '📋 **Agent Provider Status Report**\n',
    `Total Registered: ${providers.length}`,
    '',
  ];

  for (const provider of providers) {
    const status = await provider.getStatus?.();
    const emoji = status?.available ? '✅' : '❌';

    lines.push(`${emoji} **${provider.providerName}** (\`${provider.providerId}\`)`);
    lines.push(`   Type: ${provider.providerType}`);
    lines.push(`   Models: ${provider.supportedModels.slice(0, 3).join(', ')}${provider.supportedModels.length > 3 ? '...' : ''}`);

    if (status) {
      lines.push(`   Status: ${status.message || (status.available ? 'Available' : 'Unavailable')}`);
      if (status.version) {
        lines.push(`   Version: ${status.version}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

// Export all providers for direct use
export {
  ClaudeCliProvider,
  CursorProvider,
  AntigravityProvider,
  AnthropicApiProvider,
  OllamaProvider,
  OpenAIProvider,
  GroqProvider,
  createContinueProvider,
  createCodeiumProvider,
  createAiderProvider,
};
