import { RepoManager } from "./manager.ts";
import { StringSelectMenuBuilder, ActionRowBuilder } from "npm:discord.js@14.14.1";

export function createRepoHandlers(deps: RepoHandlerDeps) {
  const { workDir, repoName, branchName, actualCategoryName, discordToken, applicationId, botSettings, worktreeBotManager } = deps;
  const repoManager = RepoManager.getInstance(workDir);

  return {
    // deno-lint-ignore no-explicit-any
    async onRepoSync(ctx: any, action: string) {
      await ctx.deferReply();

      switch (action) {
        case 'scan': {
          await ctx.editReply({
            embeds: [{
              color: 0x5865F2,
              title: '🔍 Scanning Repositories...',
              description: 'Scanning for Git repositories in the base directory and subdirectories...',
              timestamp: new Date().toISOString()
            }]
          });

          try {
            const repos = await repoManager.scanRepositories(2); // Scan up to 2 levels deep
            
            await ctx.editReply({
              embeds: [{
                color: 0x00ff00,
                title: '✅ Repository Scan Complete',
                description: `Found **${repos.length}** repository/repositories.`,
                fields: repos.length > 0 ? [
                  {
                    name: '📁 Repositories',
                    value: repos.map(r => `\`${r.name}\` - ${r.branch} branch`).join('\n') || 'None',
                    inline: false
                  }
                ] : [],
                footer: { text: 'Use /repo action:load to switch to a repository' },
                timestamp: new Date().toISOString()
              }]
            });
          } catch (error) {
            await ctx.editReply({
              embeds: [{
                color: 0xff0000,
                title: '❌ Scan Failed',
                description: `Error scanning repositories: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: new Date().toISOString()
              }]
            });
          }
          break;
        }

        case 'list': {
          const repos = repoManager.getRepositories();
          
          if (repos.length === 0) {
            await ctx.reply({
              embeds: [{
                color: 0xffaa00,
                title: '📋 No Repositories Found',
                description: 'No repositories have been scanned yet. Use `/repo-sync action:scan` to scan for repositories.',
                timestamp: new Date().toISOString()
              }],
              ephemeral: true
            });
            return;
          }

          await ctx.reply({
            embeds: [{
              color: 0x0099ff,
              title: '📋 Available Repositories',
              description: `**${repos.length}** repository/repositories available:`,
              fields: [
                {
                  name: 'Repositories',
                  value: repos.map(r => {
                    const current = repoManager.getCurrentRepo();
                    const marker = current && current.name === r.name ? '📍 ' : '  ';
                    return `${marker}\`${r.name}\` - \`${r.branch}\` branch\n   Path: \`${r.path}\``;
                  }).join('\n\n'),
                  inline: false
                }
              ],
              footer: { text: 'Use /repo action:load to switch to a repository' },
              timestamp: new Date().toISOString()
            }],
            ephemeral: true
          });
          break;
        }

        case 'clear': {
          repoManager.clear();
          await ctx.reply({
            embeds: [{
              color: 0x00ff00,
              title: '🗑️ Cache Cleared',
              description: 'Repository cache has been cleared. Use `/repo-sync action:scan` to scan again.',
              timestamp: new Date().toISOString()
            }],
            ephemeral: true
          });
          break;
        }
      }
    },

    // deno-lint-ignore no-explicit-any
    async onRepo(ctx: any, action: string, repoName?: string) {
      await ctx.deferReply();

      switch (action) {
        case 'load': {
          const repos = repoManager.getRepositories();
          
          if (repos.length === 0) {
            await ctx.editReply({
              embeds: [{
                color: 0xffaa00,
                title: '⚠️ No Repositories Available',
                description: 'No repositories have been scanned yet. Use `/repo-sync action:scan` to scan for repositories first.',
                timestamp: new Date().toISOString()
              }]
            });
            return;
          }

          // If repo_name is provided, load it directly
          if (repoName) {
            const repo = repoManager.getRepository(repoName);
            if (!repo) {
              await ctx.editReply({
                embeds: [{
                  color: 0xff0000,
                  title: '❌ Repository Not Found',
                  description: `Repository \`${repoName}\` not found. Use \`/repo-sync action:list\` to see available repositories.`,
                  timestamp: new Date().toISOString()
                }]
              });
              return;
            }

            // Set as current repo
            repoManager.setCurrentRepo(repoName);
            
            await ctx.editReply({
              embeds: [{
                color: 0x00ff00,
                title: '✅ Repository Loaded',
                description: `Switched to repository: **${repo.name}**`,
                fields: [
                  { name: 'Path', value: `\`${repo.path}\``, inline: true },
                  { name: 'Branch', value: `\`${repo.branch}\``, inline: true },
                  { name: 'Status', value: 'Active', inline: true }
                ],
                footer: { text: 'Note: This changes the base folder for new bot instances' },
                timestamp: new Date().toISOString()
              }]
            });
            return;
          }

          // Show dropdown menu for repo selection
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('repo-select-load')
            .setPlaceholder('Choose a repository to load...')
            .addOptions(
              repos.map(repo => ({
                label: repo.name.length > 100 ? repo.name.substring(0, 97) + '...' : repo.name,
                description: `${repo.branch} branch - ${repo.path}`,
                value: repo.name
              }))
            );

          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

          await ctx.editReply({
            embeds: [{
              color: 0x5865F2,
              title: '📂 Load Repository',
              description: 'Select a repository from the dropdown to load:',
              fields: [
                {
                  name: 'Available Repositories',
                  value: repos.map(r => `\`${r.name}\` - ${r.branch} branch`).join('\n') || 'None',
                  inline: false
                }
              ],
              footer: { text: 'This will change the base folder for new bot instances' },
              timestamp: new Date().toISOString()
            }],
            components: [row]
          });
          break;
        }

        case 'current': {
          const current = repoManager.getCurrentRepo();
          
          if (!current) {
            await ctx.editReply({
              embeds: [{
                color: 0xffaa00,
                title: '📍 No Repository Loaded',
                description: 'No repository is currently loaded. Use `/repo action:load` to load a repository.',
                fields: [
                  {
                    name: 'Current Working Directory',
                    value: `\`${workDir}\``,
                    inline: false
                  }
                ],
                timestamp: new Date().toISOString()
              }]
            });
            return;
          }

          await ctx.editReply({
            embeds: [{
              color: 0x00ff00,
              title: '📍 Current Repository',
              fields: [
                { name: 'Repository', value: `\`${current.name}\``, inline: true },
                { name: 'Branch', value: `\`${current.branch}\``, inline: true },
                { name: 'Path', value: `\`${current.path}\``, inline: false },
                { name: 'Status', value: '✅ Active', inline: true }
              ],
              timestamp: new Date().toISOString()
            }]
          });
          break;
        }

        case 'list': {
          const repos = repoManager.getRepositories();
          const current = repoManager.getCurrentRepo();
          
          if (repos.length === 0) {
            await ctx.editReply({
              embeds: [{
                color: 0xffaa00,
                title: '📋 No Repositories',
                description: 'No repositories available. Use `/repo-sync action:scan` to scan for repositories.',
                timestamp: new Date().toISOString()
              }]
            });
            return;
          }

          await ctx.editReply({
            embeds: [{
              color: 0x0099ff,
              title: '📋 Available Repositories',
              description: `**${repos.length}** repository/repositories:`,
              fields: [
                {
                  name: 'Repositories',
                  value: repos.map(r => {
                    const marker = current && current.name === r.name ? '📍 ' : '  ';
                    return `${marker}\`${r.name}\` - \`${r.branch}\` branch`;
                  }).join('\n'),
                  inline: false
                }
              ],
              footer: { text: 'Use /repo action:load to switch repositories' },
              timestamp: new Date().toISOString()
            }]
          });
          break;
        }
      }
    },

    // Handle select menu interaction for repo loading
    // deno-lint-ignore no-explicit-any
    async handleRepoSelect(ctx: any, repoName: string) {
      const repo = repoManager.getRepository(repoName);
      
      if (!repo) {
        await ctx.reply({
          embeds: [{
            color: 0xff0000,
            title: '❌ Repository Not Found',
            description: `Repository \`${repoName}\` not found.`,
            timestamp: new Date().toISOString()
          }],
          ephemeral: true
        });
        return;
      }

      // Set as current repo
      repoManager.setCurrentRepo(repoName);
      
      // Update base path for future scans
      repoManager.setBasePath(repo.path);

      await ctx.update({
        embeds: [{
          color: 0x00ff00,
          title: '✅ Repository Loaded',
          description: `Switched to repository: **${repo.name}**`,
          fields: [
            { name: 'Path', value: `\`${repo.path}\``, inline: true },
            { name: 'Branch', value: `\`${repo.branch}\``, inline: true },
            { name: 'Status', value: 'Active', inline: true }
          ],
          footer: { text: 'New worktree bots will be spawned from this repository path' },
          timestamp: new Date().toISOString()
        }],
        components: []
      });
    },

    // Get current repo manager instance
    getRepoManager(): RepoManager {
      return repoManager;
    }
  };
}
