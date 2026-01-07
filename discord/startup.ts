import { 
  Events, 
  REST, 
  Routes, 
  TextChannel 
} from "npm:discord.js@14.14.1";
import { convertMessageContent } from "./formatting.ts";
import type { CommandHandlers, BotConfig, BotDependencies } from "./types.ts";

/**
 * Handle bot startup
 */
export async function handleStartup(
  client: any,
  config: BotConfig,
  dependencies: BotDependencies,
  actualCategoryName: string,
  ensureChannelExists: any
) {
  const { discordToken, applicationId, workDir, repoName, branchName } = config;
  const commands = dependencies.commands;
  let myChannel: TextChannel | null = null;

  client.once(Events.ClientReady, async () => {
    const startupStart = Date.now();
    console.log(`Bot logged in: ${client.user?.tag}`);
    console.log(`Category: ${actualCategoryName}`);
    console.log(`Branch: ${branchName}`);
    console.log(`Working directory: ${workDir}`);

    const guilds = client.guilds.cache;
    if (guilds.size === 0) {
      console.error('Error: Bot is not in any servers');
      return;
    }
    
    const guild = guilds.first();
    if (!guild) {
      console.error('Error: Guild not found');
      return;
    }
    
    try {
      myChannel = await ensureChannelExists(guild);
      console.log(`Using channel "${myChannel!.name}" (ID: ${myChannel!.id})`);

      // Status message that will be updated throughout startup
      let statusMessage: any = null;
      const statusSteps: { step: string; status: '⏳' | '✅' | '❌' | '⚠️'; detail?: string }[] = [
        { step: 'Discord Connection', status: '✅' },
        { step: 'Channel Setup', status: '✅' },
        { step: 'Providers', status: '⏳' },
        { step: 'Slash Commands', status: '⏳' },
        { step: 'Ready', status: '⏳' }
      ];

      // Helper to build status embed
      const buildStatusEmbed = (title: string, color: number) => ({
        color,
        title,
        description: `**${repoName}** on branch \`${branchName}\``,
        fields: [
          ...statusSteps.map(s => ({
            name: `${s.status} ${s.step}`,
            value: s.detail || (s.status === '⏳' ? 'Pending...' : s.status === '✅' ? 'Complete' : 'Failed'),
            inline: true
          })),
          { name: '\u200B', value: '\u200B', inline: true }, // Spacer for alignment
          { name: '📁 Working Directory', value: `\`${workDir}\``, inline: false }
        ],
        footer: { text: `Startup time: ${((Date.now() - startupStart) / 1000).toFixed(1)}s` },
        timestamp: new Date().toISOString()
      });

      // Send initial status message
      console.log('[Startup] Sending initial status message...');
      try {
        statusMessage = await myChannel!.send(convertMessageContent({
          embeds: [buildStatusEmbed('⏳ Starting Up...', 0xffaa00)]
        }));
      } catch (err) {
        console.error('[Startup] Failed to send status message:', err);
      }

      // Helper to update status
      const updateStatus = async (stepIndex: number, status: '✅' | '❌' | '⚠️', detail?: string) => {
        statusSteps[stepIndex].status = status;
        if (detail) statusSteps[stepIndex].detail = detail;
        
        if (statusMessage) {
          const allDone = statusSteps.every(s => s.status !== '⏳');
          const hasError = statusSteps.some(s => s.status === '❌');
          const hasWarning = statusSteps.some(s => s.status === '⚠️');
          
          let title = '⏳ Starting Up...';
          let color = 0xffaa00; // Yellow
          
          if (allDone) {
            if (hasError) {
              title = '❌ Startup Failed';
              color = 0xff0000; // Red
            } else if (hasWarning) {
              title = '⚠️ Started with Warnings';
              color = 0xffaa00; // Orange
            } else {
              title = '🚀 Startup Complete';
              color = 0x00ff00; // Green
            }
          }
          
          try {
            await statusMessage.edit(convertMessageContent({
              embeds: [buildStatusEmbed(title, color)]
            }));
          } catch (err) {
            console.warn('[Startup] Could not update status message:', err);
          }
        }
      };

      // Check providers status
      const { AgentProviderRegistry } = await import("../agent/provider-interface.ts");
      const providers = AgentProviderRegistry.getAllProviders();
      const availableProviders = await AgentProviderRegistry.getAvailableProviders();
      const providerDetail = `${availableProviders.length}/${providers.length} available`;
      await updateStatus(2, availableProviders.length > 0 ? '✅' : '⚠️', providerDetail);
      
      // Initialize model cache (fetches available models from API)
      try {
        const { initModelCache, getLatestFlashModel } = await import("../util/list-models.ts");
        await initModelCache();
        const latestFlash = await getLatestFlashModel();
        console.log(`[Startup] Latest Flash model: ${latestFlash}`);
      } catch (err) {
        console.warn('[Startup] Could not initialize model cache:', err);
      }

      // Register Guild Commands
      const skipRegistration = Deno.env.get("SKIP_COMMAND_REGISTRATION") === "true";
      const forceRegistration = Deno.env.get("FORCE_COMMAND_REGISTRATION") === "true";
      
      if (skipRegistration) {
        console.log('[Commands] Skipping command registration (SKIP_COMMAND_REGISTRATION=true)');
        await updateStatus(3, '✅', 'Skipped (cached)');
      } else {
        const rest = new REST({ version: '10' }).setToken(discordToken);
        const commandsData = commands.map(cmd => cmd.toJSON());
        
        // Generate hash of commands to detect changes
        const commandsHash = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(JSON.stringify(commandsData))
        ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
        
        const hashFile = './data/commands-hash.txt';
        let previousHash = '';
        try {
          previousHash = await Deno.readTextFile(hashFile);
        } catch {
          // File doesn't exist
        }
        
        const commandsChanged = previousHash !== commandsHash;
        
        if (!commandsChanged && !forceRegistration) {
          console.log('[Commands] ✅ Commands unchanged since last registration, skipping (saves rate limit)');
          await updateStatus(3, '✅', 'Cached (no changes)');
        } else {
          let animationRunning = false;
          let animationInterval: any = null;
          try {
            console.log(`Registering slash commands for guild ${guild.id}...`);
            
            // ASCII progress bar logic...
            let animationProgress = 0;
            animationRunning = true;
            animationInterval = setInterval(async () => {
              if (!animationRunning) return;
              if (animationProgress < 85) {
                animationProgress += Math.random() * 12 + 5;
                animationProgress = Math.min(animationProgress, 85);
              }
              statusSteps[3].detail = `\`[PROGRESS] ${Math.floor(animationProgress)}%\``;
              if (statusMessage) {
                try {
                  await statusMessage.edit(convertMessageContent({
                    embeds: [buildStatusEmbed('Starting Up...', 0x5865F2)]
                  }));
                } catch { /* ignore */ }
              }
            }, 1000);

            const registerPromise = rest.put(
              Routes.applicationGuildCommands(applicationId, guild.id),
              { body: commandsData },
            );
            
            await registerPromise;
            
            animationRunning = false;
            clearInterval(animationInterval);
            
            console.log(`Successfully registered ${commandsData.length} guild commands`);
            await updateStatus(3, '✅', `${commandsData.length} commands`);
            
            try {
              await Deno.writeTextFile(hashFile, commandsHash);
            } catch (e) {
              console.warn('[Commands] Could not save hash:', e);
            }
          } catch (error) {
            animationRunning = false;
            clearInterval(animationInterval);
            console.error('[Commands] Unexpected error during command registration:', error);
            await updateStatus(3, '❌', 'Registration Failed');
          }
        }
      }
      
      // Final ready status
      const startupTime = ((Date.now() - startupStart) / 1000).toFixed(1);
      await updateStatus(4, '✅', `${startupTime}s`);
      console.log(`[Startup] ✅ Startup complete in ${startupTime}s`);
      
    } catch (error) {
      console.error('Startup error:', error);
    }
  });

  return {
    getMyChannel: () => myChannel
  };
}
