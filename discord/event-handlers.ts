import { 
  CommandInteraction, 
  ButtonInteraction, 
  TextChannel, 
  Collection 
} from "npm:discord.js@14.14.1";
import { getActiveSession, getActiveAgents, PREDEFINED_AGENTS } from "../agent/index.ts";
import { DISCORD_LIMITS, splitText } from "./utils.ts";
import { handlePaginationInteraction } from "./pagination.ts";
import { createInteractionContext } from "./interaction-context.ts";
import type { 
  CommandHandlers, 
  ButtonHandlers, 
  BotConfig, 
  BotDependencies 
} from "./types.ts";

/**
 * Command handler
 */
export async function handleCommand(
  interaction: CommandInteraction,
  handlers: CommandHandlers,
  enableChannelRouting: boolean,
  myChannel: TextChannel | null,
  channelContextManager: any
) {
  const startTime = Date.now();
  console.log(`[InteractionCommand] STARTED: /${interaction.commandName} by ${interaction.user.tag}`);
  
  if (!enableChannelRouting) {
    const allowedCommands = ['restart', 'run', 'run-adv'];
    if (!allowedCommands.includes(interaction.commandName) && (!myChannel || interaction.channelId !== myChannel.id)) {
      return;
    }
  }
  
  let channelContext = undefined;
  if (enableChannelRouting && interaction.channel) {
    channelContext = await channelContextManager.getChannelContext(interaction.channel);
  }

  const ctx = await createInteractionContext(interaction, channelContext);
  const handler = handlers.get(interaction.commandName);
  
  if (!handler) {
    await ctx.reply({ content: `Unknown command: ${interaction.commandName}`, ephemeral: true });
    return;
  }
  
  try {
    await handler.execute(ctx);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[InteractionCommand] FAILED: /${interaction.commandName} after ${duration}ms:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : '';
    
    // Build detailed error embed for better debugging
    const errorEmbed = {
      color: 0xff0000,
      title: `❌ Command Failed: /${interaction.commandName}`,
      fields: [
        { name: 'Error', value: errorMessage.substring(0, 1024), inline: false },
        { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
        { name: 'Duration', value: `${duration}ms`, inline: true },
        { name: 'Channel', value: interaction.channelId || 'Unknown', inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    
    // Add stack trace for debugging (truncated)
    if (errorStack && process.env.NODE_ENV !== 'production') {
      errorEmbed.fields.push({ 
        name: 'Stack (dev only)', 
        value: `\`\`\`\n${errorStack.substring(0, 500)}\n\`\`\``, 
        inline: false 
      });
    }
    
    if (interaction.deferred) {
      await ctx.editReply({ embeds: [errorEmbed] });
    } else {
      await ctx.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

/**
 * Button handler
 */
export async function handleButton(
  interaction: ButtonInteraction,
  handlers: CommandHandlers,
  buttonHandlers: ButtonHandlers,
  enableChannelRouting: boolean,
  myChannel: TextChannel | null,
  channelContextManager: any,
  crashHandler?: any
) {
  if (!enableChannelRouting) {
    const allowedPrefixes = ['run-adv-', 'pagination:', 'repo-create-', 'repo-use-similar-', 'repo-skip-desc-', 'repo-github-', 'repo-visibility-', 'agent_spawn_'];
    const isAllowedInteraction = allowedPrefixes.some(p => interaction.customId.startsWith(p));
    const activeSession = getActiveSession(interaction.user.id, interaction.channelId);
    
    if (!isAllowedInteraction && !activeSession && (!myChannel || interaction.channelId !== myChannel.id)) {
      return;
    }
  }
  
  let channelContext = undefined;
  if (enableChannelRouting && interaction.channel) {
    channelContext = await channelContextManager.getChannelContext(interaction.channel);
  }

  const ctx = await createInteractionContext(interaction, channelContext);
  const buttonId = interaction.customId;
  
  // Handle pagination
  if (buttonId.startsWith('pagination:')) {
    const result = handlePaginationInteraction(buttonId);
    if (result) {
      await ctx.update({
        embeds: [result.embed],
        components: result.components ? [{ type: 'actionRow', components: result.components }] : []
      });
      return;
    }
  }

  // Handle run-adv auto-select button
  if (buttonId.startsWith('run-adv-auto:')) {
    await ctx.deferUpdate();
    const parts = buttonId.split(':');
    const provider = parts[1];
    const role = parts[2];
    const workspacePath = parts.slice(3).join(':');
    
    let selectedModel = 'gemini-3-flash-preview';
    try {
      if (provider === 'ollama') {
        const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
        const ollamaProvider = AgentProviderRegistry.getProvider('ollama');
        if (ollamaProvider) {
          const status = await ollamaProvider.getStatus?.();
          if (status?.available && status.metadata?.models) {
            const models = status.metadata.models as string[];
            const fastModels = models.filter(m => m.includes('1.5b') || m.includes('7b') || m.includes('3b'));
            selectedModel = fastModels[0] || models[0] || 'deepseek-r1:1.5b';
          }
        }
      } else if (provider === 'cursor') {
        selectedModel = 'auto';
      } else if (provider === 'claude-cli') {
        selectedModel = 'claude-sonnet-4';
      } else {
        const { getModelsForAgents } = await import("../util/list-models.ts");
        const { manager, coder, architect } = await getModelsForAgents();
        if (role === 'builder') selectedModel = coder[0]?.name || selectedModel;
        else if (role === 'tester') selectedModel = manager[0]?.name || selectedModel;
        else if (role === 'investigator') selectedModel = architect[0]?.name || selectedModel;
      }
    } catch { /* ignore */ }
    
    const { setAgentSession, ROLE_DEFINITIONS } = await import("../agent/index.ts");
    const { AgentRegistry } = await import("../agent/registry.ts");
    const channelId = ctx.channelId || ctx.channel?.id;
    if (channelId) {
      const session = setAgentSession(ctx.user.id, channelId, 'general-assistant', role, workspacePath);
      const roleDef = ROLE_DEFINITIONS[role];
      // Store customizations in session, not in global PREDEFINED_AGENTS
      const providerToClient: any = { 
        'cursor': 'cursor', 
        'claude-cli': 'claude', 
        'gemini-api': 'antigravity', 
        'antigravity': 'antigravity', 
        'ollama': 'ollama',
        'openai': 'openai',
        'groq': 'groq'
      };
      session.modelOverride = selectedModel;
      // Store client override in session metadata (extend session type if needed)
      (session as any).clientOverride = providerToClient[provider];
      const baseAgent = AgentRegistry.getInstance().getAgent('general-assistant');
      await ctx.editReply({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Agent Session Started (Auto-Selected)',
          description: `**Role:** ${roleDef?.emoji || ''} ${roleDef?.name || role}\n**Model:** ${selectedModel}\n**Provider:** ${provider}\n**Workspace:** \`${workspacePath || 'Default'}\``,
          timestamp: new Date().toISOString()
        }]
      });
    }
    return;
  }

  // Handle repo creation buttons
  if (buttonId.startsWith('repo-create-') || buttonId.startsWith('repo-use-similar-') || 
      buttonId.startsWith('repo-skip-desc-') || buttonId.startsWith('repo-github-') || 
      buttonId.startsWith('repo-visibility-')) {
    await ctx.deferUpdate();
    const { handleRepoCreationButton } = await import("../util/repo-creation-handler.ts");
    const result = await handleRepoCreationButton(buttonId, ctx.user.id, ctx.channelId || '');
    if (result) {
      await ctx.editReply({ embeds: [result.embed], components: result.components || [] });
      if (result.complete) channelContextManager.invalidateCache(ctx.channelId || '');
      return;
    }
  }

  const handler = buttonHandlers.get(buttonId);
  if (handler) {
    try {
      await handler(ctx);
    } catch (error) {
      console.error(`[Button] FAILED: ${buttonId}:`, error);
      if (crashHandler) await crashHandler.reportCrash('main', error, 'button', `ID: ${buttonId}`);
      
      // Provide user feedback on button error
      try {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await ctx.reply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Button Action Failed',
            description: `An error occurred while processing your request.`,
            fields: [
              { name: 'Error', value: errorMessage.substring(0, 500), inline: false },
              { name: 'Button ID', value: buttonId.substring(0, 100), inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true
        });
      } catch (replyError) {
        // Ignore if we can't reply (interaction may have expired)
        console.warn('[Button] Could not send error reply:', replyError);
      }
    }
    return;
  }

  // Handle patterns
  if (buttonId.startsWith('continue:')) {
    const continueHandler = buttonHandlers.get('continue');
    if (continueHandler) await continueHandler(ctx);
    return;
  }

  if (buttonId.startsWith('copy-session:')) {
    const sessionId = buttonId.split(':')[1];
    await ctx.update({
      embeds: [{ color: 0x00ff00, title: '📋 Session ID', description: `\`${sessionId}\``, timestamp: new Date().toISOString() }]
    });
    return;
  }

  if (buttonId.startsWith('expand:')) {
    const expandId = buttonId.substring(7);
    const { expandableContent } = await import("../claude/discord-sender.ts");
    const fullContent = expandableContent.get(expandId);
    
    if (!fullContent) {
      // Content expired or not found
      await ctx.update({
        embeds: [{
          color: 0xffaa00,
          title: '📖 Content Not Available',
          description: 'The full content is no longer available for expansion. It may have expired after a bot restart.',
          timestamp: new Date().toISOString()
        }],
        components: []
      });
      return;
    }
    
    // Account for code block markers when calculating max length
    const codeBlockOverhead = 8; // ```\n\n```
    const maxChunkSize = DISCORD_LIMITS.EMBED_DESCRIPTION - 20 - codeBlockOverhead;
    const chunks = splitText(fullContent, maxChunkSize, true);
    
    await ctx.update({
      embeds: [{ 
        color: 0x0099ff, 
        title: chunks.length > 1 ? `📖 Full Response (1/${chunks.length})` : '📖 Full Response', 
        description: `\`\`\`\n${chunks[0]}\n\`\`\``, 
        timestamp: new Date().toISOString() 
      }],
      components: [{ type: 'actionRow', components: [{ type: 'button', customId: 'collapse-content', label: '🔼 Collapse', style: 'secondary' }] }]
    });
    
    for (let i = 1; i < chunks.length; i++) {
      await ctx.followUp({ 
        embeds: [{ 
          color: 0x0099ff, 
          title: `📖 Full Response (${i + 1}/${chunks.length})`, 
          description: `\`\`\`\n${chunks[i]}\n\`\`\``, 
          timestamp: new Date().toISOString() 
        }] 
      });
    }
    return;
  }

  if (buttonId.startsWith('agent_spawn_approve:') || buttonId.startsWith('agent_spawn_decline:')) {
    const agentHandler = handlers.get('agent');
    if (agentHandler?.handleButton) await agentHandler.handleButton(ctx, buttonId);
    return;
  }
}

/**
 * Select menu handler
 */
export async function handleSelectMenu(
  interaction: any,
  handlers: CommandHandlers,
  enableChannelRouting: boolean,
  myChannel: TextChannel | null,
  channelContextManager: any,
  botConfig: BotConfig,
  botSettings: any
) {
  const { workDir, repoName, branchName, discordToken, applicationId } = botConfig;
  const actualCategoryName = botConfig.categoryName ? `${botConfig.categoryName} (${repoName})` : repoName;

  if (!enableChannelRouting) {
    const allowedPrefixes = ['run-adv-', 'repo-select-load', 'select-agent-model', 'select-ide-sync'];
    const isAllowedInteraction = allowedPrefixes.some(p => interaction.customId.startsWith(p));
    const activeSession = getActiveSession(interaction.user.id, interaction.channelId);
    
    if (!isAllowedInteraction && !activeSession && (!myChannel || interaction.channelId !== myChannel.id)) {
      return;
    }
  }
  
  let channelContext = undefined;
  if (enableChannelRouting && interaction.channel) {
    channelContext = await channelContextManager.getChannelContext(interaction.channel);
  }

  const ctx = await createInteractionContext(interaction, channelContext);
  const customId = interaction.customId;
  const values = interaction.values;
  
  if (customId === 'repo-select-load' && values?.length > 0) {
    await ctx.deferUpdate();
    const { createRepoHandlers } = await import("../repo/index.ts");
    const { WorktreeBotManager } = await import("../git/index.ts");
    const repoHandlers = createRepoHandlers({ workDir, repoName, branchName, actualCategoryName, discordToken, applicationId, botSettings, worktreeBotManager: new WorktreeBotManager() });
    await repoHandlers.handleRepoSelect(ctx, values[0]);
    return;
  }
  
  if (customId === 'select-agent-model' && values?.length > 0) {
    await ctx.deferUpdate();
    const parts = values[0].split(':');
    const type = parts[0];
    const agentName = type === 'webhook' ? `webhook:${parts[2]}` : parts[1];
    const model = type === 'webhook' ? (parts[3] || 'webhook') : parts.slice(2).join(':');

    if (type === 'webhook') {
      const { SettingsPersistence } = await import("../util/settings-persistence.ts");
      const webhook = SettingsPersistence.getInstance().getSettings().webhooks?.find((w: any) => w.id === agentName.replace('webhook:', '') && w.enabled);
      if (webhook) {
        const response = await fetch(`http://localhost:8000/api/webhooks/${webhook.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trigger: 'discord_run_command', userId: ctx.user.id, channelId: ctx.channelId }) });
        const { setAgentSession, PREDEFINED_AGENTS } = await import("../agent/index.ts");
        const actualAgentName = webhook.name.toLowerCase().includes('cursor') ? 'cursor-coder' : 'ag-coder';
        if (ctx.channelId) setAgentSession(ctx.user.id, ctx.channelId, actualAgentName);
        await ctx.editReply({ embeds: [{ color: 0x00ff00, title: '🔗 Webhook Triggered', description: `**${webhook.name}** triggered!\nAgent: **${PREDEFINED_AGENTS[actualAgentName]?.name || actualAgentName}**`, timestamp: true }] });
      }
      return;
    }

    if (type === 'agent') {
      const { AgentRegistry } = await import("../agent/registry.ts");
      const { setAgentSession } = await import("../agent/index.ts");
      const agent = AgentRegistry.getInstance().getAgent(agentName);
      if (agent && ctx.channelId) {
        // Store model override in session, not in global PREDEFINED_AGENTS
        const session = setAgentSession(ctx.user.id, ctx.channelId, agentName);
        session.modelOverride = model;
        await ctx.editReply({ embeds: [{ color: 0x00ff00, title: '🚀 Agent Session Started', description: `**Agent:** ${agent.name}\n**Model:** ${model}`, timestamp: true }] });
      }
      return;
    }
  }

  if (customId === 'run-adv-provider' && values?.length > 0) {
    await ctx.deferUpdate();
    const provider = values[0];
    const { StringSelectMenuBuilder, ActionRowBuilder } = await import("npm:discord.js@14.14.1");
    const { RepoManager } = await import("../repo/index.ts");
    const repos = await RepoManager.getInstance(workDir).scanRepositories(1);
    const currentPath = ctx.channelContext?.projectPath || workDir;
    const options = [{ label: `📍 Current Workspace`, value: currentPath }, ...repos.filter(r => r.path !== currentPath).map(r => ({ label: `📁 ${r.name}`, value: r.path }))].slice(0, 25);
    await ctx.editReply({ embeds: [{ color: 0x5865F2, title: '🚀 Step 2: Select Workspace', description: `Provider: **${provider}**` }], components: [new ActionRowBuilder<any>().addComponents(new StringSelectMenuBuilder().setCustomId(`run-adv-workspace:${provider}`).addOptions(options))] });
    return;
  }

  if (customId.startsWith('run-adv-workspace:') && values?.length > 0) {
    await ctx.deferUpdate();
    const provider = customId.split(':')[1];
    const workspacePath = values[0];
    const { StringSelectMenuBuilder, ActionRowBuilder } = await import("npm:discord.js@14.14.1");
    const roleOptions = [
      { label: '🔨 Builder', value: 'builder' },
      { label: '🧪 Tester', value: 'tester' },
      { label: '🔍 Investigator', value: 'investigator' },
      { label: '🏗️ Architect', value: 'architect' },
      { label: '👁️ Reviewer', value: 'reviewer' }
    ];
    await ctx.editReply({ embeds: [{ color: 0x5865F2, title: '🚀 Step 3: Select Role', description: `Workspace: \`${workspacePath}\`` }], components: [new ActionRowBuilder<any>().addComponents(new StringSelectMenuBuilder().setCustomId(`run-adv-role:${provider}:${workspacePath}`).addOptions(roleOptions))] });
    return;
  }

  if (customId.startsWith('run-adv-role:') && values?.length > 0) {
    await ctx.deferUpdate();
    const [, provider, ...pathParts] = customId.split(':');
    const workspacePath = pathParts.join(':');
    const role = values[0];
    const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder } = await import("npm:discord.js@14.14.1");
    
    // Get models based on selected provider
    let modelOptions: { label: string; value: string }[] = [];
    
    if (provider === 'cursor') {
      const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
      const cursorProvider = AgentProviderRegistry.getProvider('cursor');
      // Correct Cursor model names per CLI docs: cursor-agent --model <model>
      const cursorModels = cursorProvider?.supportedModels || [
        'auto', 'sonnet-4', 'sonnet-4-thinking', 'opus-4', 'gpt-5', 'gpt-4o', 'o1', 'gemini-2.5-pro'
      ];
      modelOptions = cursorModels.map(m => ({ label: m, value: m }));
    } else if (provider === 'claude-cli') {
      modelOptions = [
        { label: 'Claude Sonnet 4', value: 'claude-sonnet-4' },
        { label: 'Claude Opus 4', value: 'claude-opus-4' },
        { label: 'Claude Haiku', value: 'claude-haiku' },
        { label: 'Sonnet (Default)', value: 'sonnet' },
        { label: 'Opus', value: 'opus' },
      ];
    } else if (provider === 'ollama') {
      const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
      const ollamaProvider = AgentProviderRegistry.getProvider('ollama');
      const status = await ollamaProvider?.getStatus?.();
      if (status?.available && status.metadata?.models) {
        const ollamaModels = status.metadata.models as string[];
        modelOptions = ollamaModels.slice(0, 24).map(m => ({ label: m, value: m }));
      } else {
        modelOptions = [
          { label: 'DeepSeek R1 1.5B', value: 'deepseek-r1:1.5b' },
          { label: 'DeepSeek R1 7B', value: 'deepseek-r1:7b' },
          { label: 'Llama 3.2 3B', value: 'llama3.2:3b' },
          { label: 'Qwen 2.5 7B', value: 'qwen2.5:7b' },
        ];
      }
    } else if (provider === 'gemini-api' || provider === 'antigravity') {
      const { listAvailableModels } = await import("../util/list-models.ts");
      const models = await listAvailableModels();
      modelOptions = models.slice(0, 24).map(m => ({ label: m.displayName, value: m.name }));
    } else if (provider === 'openai') {
      const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
      const openaiProvider = AgentProviderRegistry.getProvider('openai');
      const openaiModels = openaiProvider?.supportedModels || [
        'gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini', 'gpt-4-turbo'
      ];
      modelOptions = openaiModels.slice(0, 24).map(m => ({ label: m, value: m }));
    } else if (provider === 'groq') {
      const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
      const groqProvider = AgentProviderRegistry.getProvider('groq');
      const groqModels = groqProvider?.supportedModels || [
        'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'
      ];
      modelOptions = groqModels.slice(0, 24).map(m => ({ label: m, value: m }));
    } else {
      // Fallback to Gemini models
      const { listAvailableModels } = await import("../util/list-models.ts");
      const models = await listAvailableModels();
      modelOptions = models.slice(0, 24).map(m => ({ label: m.displayName, value: m.name }));
    }
    
    // Ensure we have at least one option
    if (modelOptions.length === 0) {
      modelOptions = [{ label: 'Default Model', value: 'auto' }];
    }
    
    await ctx.editReply({
      embeds: [{ color: 0x5865F2, title: '🚀 Step 4: Select Model', description: `Provider: **${provider}**\nRole: **${role}**` }],
      components: [
        new ActionRowBuilder<any>().addComponents(new StringSelectMenuBuilder().setCustomId(`run-adv-model:${provider}:${role}:${workspacePath}`).addOptions(modelOptions)),
        new ActionRowBuilder<any>().addComponents(new ButtonBuilder().setCustomId(`run-adv-auto:${provider}:${role}:${workspacePath}`).setLabel('✨ Auto-Select').setStyle(1))
      ]
    });
    return;
  }

  if (customId.startsWith('run-adv-model:') && values?.length > 0) {
    await ctx.deferUpdate();
    const [, provider, role, ...pathParts] = customId.split(':');
    const workspacePath = pathParts.join(':');
    const model = values[0];
    const { setAgentSession, ROLE_DEFINITIONS } = await import("../agent/index.ts");
    if (ctx.channelId) {
      // Store customizations in session, not in global PREDEFINED_AGENTS
      const session = setAgentSession(ctx.user.id, ctx.channelId, 'general-assistant', role, workspacePath);
      const providerToClient: any = { 
        'cursor': 'cursor', 
        'claude-cli': 'claude', 
        'gemini-api': 'antigravity', 
        'antigravity': 'antigravity', 
        'ollama': 'ollama',
        'openai': 'openai',
        'groq': 'groq'
      };
      session.modelOverride = model;
      (session as any).clientOverride = providerToClient[provider];
      await ctx.editReply({ embeds: [{ color: 0x00ff00, title: '✅ Session Started', description: `**Role:** ${role}\n**Model:** ${model}\n**Provider:** ${provider}\n**Workspace:** \`${workspacePath}\`` }], components: [] });
    }
    return;
  }

  if (customId === 'select-ide-sync' && values?.length > 0) {
    await ctx.deferUpdate();
    const [, ideName, ...pathParts] = values[0].split(':');
    const filePath = pathParts.join(':');
    const command = ideName === 'cursor' ? 'cursor' : ideName === 'zed' ? 'zed' : ideName === 'windsurf' ? 'windsurf' : 'code';
    try {
      await new Deno.Command(command, { args: [filePath] }).spawn();
      await ctx.editReply({ embeds: [{ color: 0x00ff00, title: `✅ Opened in ${ideName}`, description: `File: \`${filePath}\`` }], components: [] });
    } catch (e) {
      await ctx.editReply({ embeds: [{ color: 0xff0000, title: '❌ Failed', description: String(e) }] });
    }
    return;
  }
}
