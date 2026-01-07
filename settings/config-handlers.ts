/**
 * Config Command Handlers
 * 
 * Handles all /config subcommands for provider management
 */

import { 
  ProviderId, 
  PROVIDER_METADATA, 
  ProviderConfigStore, 
  DEFAULT_PROVIDER_CONFIG,
  checkProviderCredentials,
  getEnabledProviders,
  formatProviderList
} from './provider-config.ts';
import { SettingsPersistence } from '../util/settings-persistence.ts';

// Extend SettingsPersistence to include provider config
function getProviderConfig(): ProviderConfigStore {
  try {
    const settings = SettingsPersistence.getInstance().getSettings();
    return (settings as any).providerConfig || DEFAULT_PROVIDER_CONFIG;
  } catch {
    return DEFAULT_PROVIDER_CONFIG;
  }
}

function saveProviderConfig(config: ProviderConfigStore): void {
  const settings = SettingsPersistence.getInstance().getSettings();
  (settings as any).providerConfig = config;
  SettingsPersistence.getInstance().saveSettings(settings);
}

/**
 * Handle /config providers - List all providers
 */
export async function handleConfigProviders(ctx: any): Promise<void> {
  const config = getProviderConfig();
  const providers = await getEnabledProviders(config);
  
  const enabledProviders = providers.filter(p => p.enabled);
  const disabledProviders = providers.filter(p => !p.enabled);
  
  const fields = [];
  
  if (enabledProviders.length > 0) {
    fields.push({
      name: '✅ Enabled Providers',
      value: enabledProviders.map(p => {
        const statusEmoji = p.available ? '🟢' : '🟡';
        return `${statusEmoji} **${p.name}**\n└ ${p.credentialStatus}`;
      }).join('\n'),
      inline: false
    });
  }
  
  if (disabledProviders.length > 0) {
    fields.push({
      name: '❌ Disabled Providers',
      value: disabledProviders.map(p => `⚫ ${p.name}`).join('\n'),
      inline: false
    });
  }
  
  fields.push({
    name: '🎯 Default Provider',
    value: `\`${config.defaultProvider}\` (${PROVIDER_METADATA[config.defaultProvider].name})`,
    inline: true
  });
  
  await ctx.editReply({
    embeds: [{
      color: 0x5865F2,
      title: '🔌 Provider Configuration',
      description: 'Manage your AI providers with `/config enable`, `/config disable`, or `/config setup`',
      fields,
      footer: { text: 'Use /config setup <provider> for setup instructions' },
      timestamp: new Date().toISOString()
    }]
  });
}

/**
 * Handle /config enable <provider>
 */
export async function handleConfigEnable(ctx: any, providerId: string): Promise<void> {
  const config = getProviderConfig();
  const metadata = PROVIDER_METADATA[providerId as ProviderId];
  
  if (!metadata) {
    await ctx.editReply({ content: `Unknown provider: ${providerId}`, ephemeral: true });
    return;
  }
  
  config.providers[providerId as ProviderId].enabled = true;
  saveProviderConfig(config);
  
  const credCheck = checkProviderCredentials(providerId as ProviderId);
  
  await ctx.editReply({
    embeds: [{
      color: credCheck.valid ? 0x00ff00 : 0xffaa00,
      title: `✅ ${metadata.name} Enabled`,
      description: credCheck.valid 
        ? `Provider is ready to use!`
        : `Provider enabled but needs configuration.`,
      fields: [
        { name: 'Credential Status', value: credCheck.message, inline: false },
        ...(credCheck.valid ? [] : [{ 
          name: '📋 Setup Required', 
          value: `Run \`/config setup ${providerId}\` for instructions`,
          inline: false 
        }])
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

/**
 * Handle /config disable <provider>
 */
export async function handleConfigDisable(ctx: any, providerId: string): Promise<void> {
  const config = getProviderConfig();
  const metadata = PROVIDER_METADATA[providerId as ProviderId];
  
  if (!metadata) {
    await ctx.editReply({ content: `Unknown provider: ${providerId}`, ephemeral: true });
    return;
  }
  
  if (config.defaultProvider === providerId) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Cannot Disable Default Provider',
        description: `**${metadata.name}** is your default provider. Set a different default first with \`/config default\`.`,
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }
  
  config.providers[providerId as ProviderId].enabled = false;
  saveProviderConfig(config);
  
  await ctx.editReply({
    embeds: [{
      color: 0xff6600,
      title: `❌ ${metadata.name} Disabled`,
      description: `Provider will no longer appear in selection menus.`,
      timestamp: new Date().toISOString()
    }]
  });
}

/**
 * Handle /config setup <provider>
 */
export async function handleConfigSetup(ctx: any, providerId: string): Promise<void> {
  const metadata = PROVIDER_METADATA[providerId as ProviderId];
  
  if (!metadata) {
    await ctx.editReply({ content: `Unknown provider: ${providerId}`, ephemeral: true });
    return;
  }
  
  const credCheck = checkProviderCredentials(providerId as ProviderId);
  
  const fields = [
    { name: '🔐 Auth Type', value: metadata.authType, inline: true },
    { name: '💰 Pricing', value: metadata.pricing, inline: true },
    { name: '🌐 Website', value: `[${metadata.website}](${metadata.website})`, inline: false },
    { name: '📋 Setup Instructions', value: '```\n' + metadata.setupInstructions + '\n```', inline: false },
    { name: '🤖 Default Models', value: metadata.defaultModels.slice(0, 5).map(m => `\`${m}\``).join(', '), inline: false },
    { name: '✅ Current Status', value: credCheck.message, inline: false }
  ];
  
  if (metadata.envVarName) {
    fields.splice(2, 0, { name: '🔑 Env Variable', value: `\`${metadata.envVarName}\``, inline: true });
  }
  
  await ctx.editReply({
    embeds: [{
      color: credCheck.valid ? 0x00ff00 : 0x5865F2,
      title: `🔧 Setup: ${metadata.name}`,
      description: metadata.description,
      fields,
      footer: { text: credCheck.valid ? 'Ready to use!' : 'Complete setup and run /config test' },
      timestamp: new Date().toISOString()
    }]
  });
}

/**
 * Handle /config default <provider>
 */
export async function handleConfigDefault(ctx: any, providerId: string): Promise<void> {
  const config = getProviderConfig();
  const metadata = PROVIDER_METADATA[providerId as ProviderId];
  
  if (!metadata) {
    await ctx.editReply({ content: `Unknown provider: ${providerId}`, ephemeral: true });
    return;
  }
  
  // Enable if not already
  if (!config.providers[providerId as ProviderId].enabled) {
    config.providers[providerId as ProviderId].enabled = true;
  }
  
  const credCheck = checkProviderCredentials(providerId as ProviderId);
  
  if (!credCheck.valid) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Cannot Set as Default',
        description: `**${metadata.name}** is not properly configured.`,
        fields: [
          { name: 'Issue', value: credCheck.message, inline: false },
          { name: 'Solution', value: `Run \`/config setup ${providerId}\` for instructions`, inline: false }
        ],
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }
  
  config.defaultProvider = providerId as ProviderId;
  saveProviderConfig(config);
  
  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: '🎯 Default Provider Updated',
      description: `**${metadata.name}** is now your default provider.`,
      fields: [
        { name: 'Default Models', value: metadata.defaultModels.slice(0, 3).map(m => `\`${m}\``).join(', '), inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

/**
 * Handle /config model <role> <model>
 */
export async function handleConfigModel(ctx: any, role: string, model: string): Promise<void> {
  const config = getProviderConfig();
  const validRoles = ['builder', 'tester', 'investigator', 'architect', 'reviewer'];
  
  if (!validRoles.includes(role)) {
    await ctx.editReply({ content: `Invalid role: ${role}`, ephemeral: true });
    return;
  }
  
  (config.defaultModelByRole as any)[role] = model;
  saveProviderConfig(config);
  
  const roleEmojis: Record<string, string> = {
    builder: '🔨',
    tester: '🧪',
    investigator: '🔍',
    architect: '🏗️',
    reviewer: '👁️'
  };
  
  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: `${roleEmojis[role]} Default Model Updated`,
      description: `**${role.charAt(0).toUpperCase() + role.slice(1)}** role will now use \`${model}\` by default.`,
      fields: [
        { 
          name: 'All Role Defaults', 
          value: Object.entries(config.defaultModelByRole)
            .map(([r, m]) => `${roleEmojis[r]} ${r}: \`${m}\``)
            .join('\n'),
          inline: false 
        }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

/**
 * Handle /config endpoint <provider> <url>
 */
export async function handleConfigEndpoint(ctx: any, providerId: string, url: string): Promise<void> {
  const config = getProviderConfig();
  const metadata = PROVIDER_METADATA[providerId as ProviderId];
  
  if (!metadata) {
    await ctx.editReply({ content: `Unknown provider: ${providerId}`, ephemeral: true });
    return;
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: '❌ Invalid URL',
        description: `"${url}" is not a valid URL.`,
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }
  
  config.providers[providerId as ProviderId].endpoint = url;
  saveProviderConfig(config);
  
  await ctx.editReply({
    embeds: [{
      color: 0x00ff00,
      title: `🌐 Endpoint Updated`,
      description: `**${metadata.name}** will now use custom endpoint.`,
      fields: [
        { name: 'New Endpoint', value: `\`${url}\``, inline: false },
        { name: 'Default Endpoint', value: `\`${metadata.defaultEndpoint || 'N/A'}\``, inline: false }
      ],
      timestamp: new Date().toISOString()
    }]
  });
}

/**
 * Handle /config test <provider>
 */
export async function handleConfigTest(ctx: any, providerId: string): Promise<void> {
  const metadata = PROVIDER_METADATA[providerId as ProviderId];
  
  if (!metadata) {
    await ctx.editReply({ content: `Unknown provider: ${providerId}`, ephemeral: true });
    return;
  }
  
  await ctx.editReply({
    embeds: [{
      color: 0xffff00,
      title: `🧪 Testing ${metadata.name}...`,
      description: 'Checking credentials and connectivity...',
      timestamp: new Date().toISOString()
    }]
  });
  
  const credCheck = checkProviderCredentials(providerId as ProviderId);
  
  if (!credCheck.valid) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: `❌ ${metadata.name} Test Failed`,
        description: 'Credentials not found.',
        fields: [
          { name: 'Issue', value: credCheck.message, inline: false },
          { name: 'Solution', value: `Run \`/config setup ${providerId}\``, inline: false }
        ],
        timestamp: new Date().toISOString()
      }]
    });
    return;
  }
  
  // Try to get the provider from registry and test
  try {
    const { AgentProviderRegistry } = await import('../agent/provider-interface.ts');
    const provider = AgentProviderRegistry.getProvider(providerId);
    
    if (provider) {
      const isAvailable = await provider.isAvailable();
      const status = await provider.getStatus?.();
      
      await ctx.editReply({
        embeds: [{
          color: isAvailable ? 0x00ff00 : 0xff0000,
          title: isAvailable ? `✅ ${metadata.name} Test Passed` : `❌ ${metadata.name} Test Failed`,
          description: status?.message || (isAvailable ? 'Provider is working correctly!' : 'Provider is not available.'),
          fields: [
            { name: 'Credentials', value: credCheck.message, inline: false },
            ...(status?.version ? [{ name: 'Version', value: status.version, inline: true }] : []),
            ...(status?.metadata?.models ? [{ name: 'Available Models', value: `${(status.metadata.models as string[]).length} models`, inline: true }] : [])
          ],
          timestamp: new Date().toISOString()
        }]
      });
    } else {
      // Provider not in registry - just check credentials
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: `✅ ${metadata.name} Credentials Valid`,
          description: 'Credentials found. Provider may need to be initialized.',
          fields: [
            { name: 'Status', value: credCheck.message, inline: false }
          ],
          timestamp: new Date().toISOString()
        }]
      });
    }
  } catch (error) {
    await ctx.editReply({
      embeds: [{
        color: 0xff0000,
        title: `❌ ${metadata.name} Test Error`,
        description: String(error),
        timestamp: new Date().toISOString()
      }]
    });
  }
}

/**
 * Main config command router
 */
export async function handleConfigCommand(ctx: any): Promise<void> {
  await ctx.deferReply();
  
  const subcommand = ctx.options?.getSubcommand?.() || ctx.getString?.('subcommand');
  const provider = ctx.getString?.('provider') || ctx.options?.getString?.('provider');
  const role = ctx.getString?.('role') || ctx.options?.getString?.('role');
  const model = ctx.getString?.('model') || ctx.options?.getString?.('model');
  const url = ctx.getString?.('url') || ctx.options?.getString?.('url');
  
  switch (subcommand) {
    case 'providers':
      await handleConfigProviders(ctx);
      break;
    case 'enable':
      await handleConfigEnable(ctx, provider);
      break;
    case 'disable':
      await handleConfigDisable(ctx, provider);
      break;
    case 'setup':
      await handleConfigSetup(ctx, provider);
      break;
    case 'default':
      await handleConfigDefault(ctx, provider);
      break;
    case 'model':
      await handleConfigModel(ctx, role, model);
      break;
    case 'endpoint':
      await handleConfigEndpoint(ctx, provider, url);
      break;
    case 'test':
      await handleConfigTest(ctx, provider);
      break;
    default:
      // Default to showing providers
      await handleConfigProviders(ctx);
  }
}
