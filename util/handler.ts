import type { SettingsResult, PwdResult } from "./types.ts";

export interface UtilsHandlerDeps {
  workDir: string;
  repoName: string;
  branchName: string;
  actualCategoryName: string;
  botSettings: {
    mentionEnabled: boolean;
    mentionUserId: string | null;
  };
  updateBotSettings: (settings: { mentionEnabled: boolean; mentionUserId: string | null }) => void;
}

export function createUtilsHandlers(deps: UtilsHandlerDeps) {
  const { workDir, repoName, branchName, actualCategoryName, botSettings, updateBotSettings } = deps;
  
  return {
    // deno-lint-ignore no-explicit-any
    onSettings(_ctx: any, action: string, value?: string): SettingsResult {
      switch (action) {
        case 'mention-on': {
          if (!value) {
            return {
              success: false,
              message: '❌ Please specify user ID. Example: `/settings mention-on 123456789012345678`'
            };
          }
          
          if (!/^\d{17,19}$/.test(value)) {
            return {
              success: false,
              message: '❌ Invalid user ID. Discord user IDs are 17-19 digit numbers.'
            };
          }
          
          botSettings.mentionEnabled = true;
          botSettings.mentionUserId = value;
          updateBotSettings(botSettings);
          
          return {
            success: true,
            mentionEnabled: true,
            mentionUserId: value
          };
        }
        
        case 'mention-off': {
          botSettings.mentionEnabled = false;
          updateBotSettings(botSettings);
          
          return {
            success: true,
            mentionEnabled: false,
            mentionUserId: botSettings.mentionUserId
          };
        }
        
        case 'show': {
          return {
            success: true,
            mentionEnabled: botSettings.mentionEnabled,
            mentionUserId: botSettings.mentionUserId
          };
        }
        
        default: {
          return {
            success: false,
            message: '❌ Invalid action.'
          };
        }
      }
    },
    
    getPwd(): PwdResult {
      return {
        workDir,
        categoryName: actualCategoryName,
        repoName,
        branchName
      };
    },
    
    // deno-lint-ignore no-explicit-any
    async onAgentsStatus(ctx: any) {
      const userId = ctx.user.id;
      const channelId = ctx.channelId || ctx.channel?.id;
      
      // Dynamically import to avoid circular dependencies
      const agentModule = await import("../agent/index.ts");
      const getActiveAgents = agentModule.getActiveAgents || (() => []);
      const PREDEFINED_AGENTS = agentModule.PREDEFINED_AGENTS || {};
      
      const activeAgents = getActiveAgents(userId, channelId);
      
      if (activeAgents.length === 0) {
        await ctx.reply({
          embeds: [{
            color: 0xffaa00,
            title: '🤖 Active Agents Status',
            description: 'No active agents in this channel.',
            fields: [
              {
                name: '💡 Getting Started',
                value: 'Use `/run` to start a helper agent, or `/agent action:start` to start a specific agent.',
                inline: false
              }
            ],
            timestamp: new Date().toISOString()
          }],
          ephemeral: true
        });
        return;
      }
      
      const agentDetails = activeAgents.map((agentId: string) => {
        const agent = PREDEFINED_AGENTS[agentId];
        if (!agent) return null;
        return {
          name: agent.name,
          id: agentId,
          model: agent.model,
          riskLevel: agent.riskLevel,
          capabilities: agent.capabilities
        };
      }).filter(Boolean);
      
      const fields = agentDetails.map((agent: any) => ({
        name: `🤖 ${agent.name}`,
        value: `**ID:** \`${agent.id}\`\n**Model:** ${agent.model}\n**Risk:** ${agent.riskLevel.toUpperCase()}\n**Capabilities:** ${agent.capabilities.slice(0, 3).join(', ')}${agent.capabilities.length > 3 ? '...' : ''}`,
        inline: true
      }));
      
      await ctx.reply({
        embeds: [{
          color: 0x00ff00,
          title: '🤖 Active Agents Status',
          description: `**${activeAgents.length}** active agent(s) running concurrently in this channel.`,
          fields,
          footer: { text: 'Multiple agents can work simultaneously on different tasks' },
          timestamp: new Date().toISOString()
        }],
        ephemeral: true
      });
    },
    
    // deno-lint-ignore no-explicit-any
    async onCategoryInfo(ctx: any) {
      // Parse category name to extract repo if it's in the format "categoryName (repoName)"
      const categoryMatch = actualCategoryName.match(/^(.+?)\s*\((.+?)\)$/);
      const displayCategory = categoryMatch ? categoryMatch[1] : actualCategoryName;
      const displayRepo = categoryMatch ? categoryMatch[2] : actualCategoryName;
      
      await ctx.reply({
        embeds: [{
          color: 0x0099ff,
          title: '📁 Category Information',
          description: 'Category names now include the repository name for easy identification.',
          fields: [
            {
              name: 'Category Name',
              value: `\`${actualCategoryName}\``,
              inline: true
            },
            {
              name: 'Repository',
              value: `\`${repoName}\``,
              inline: true
            },
            {
              name: 'Branch',
              value: `\`${branchName}\``,
              inline: true
            },
            {
              name: '📝 Format',
              value: categoryMatch 
                ? `\`${displayCategory} (${displayRepo})\`\nThe category name shows both the category and repository.`
                : `\`${actualCategoryName}\`\nCategory name matches repository name.`,
              inline: false
            },
            {
              name: '💡 Benefits',
              value: '• Easy to identify which repository each category belongs to\n• Prevents confusion when managing multiple repos\n• Category names are automatically formatted',
              inline: false
            }
          ],
          timestamp: new Date().toISOString()
        }],
        ephemeral: true
      });
    },
    
    // deno-lint-ignore no-explicit-any
    async onRepoInfo(ctx: any) {
      await ctx.reply({
        embeds: [{
          color: 0x00cc99,
          title: '📂 Repository Information',
          fields: [
            {
              name: 'Repository Name',
              value: `\`${repoName}\``,
              inline: true
            },
            {
              name: 'Branch',
              value: `\`${branchName}\``,
              inline: true
            },
            {
              name: 'Category',
              value: `\`${actualCategoryName}\``,
              inline: true
            },
            {
              name: 'Working Directory',
              value: `\`${workDir}\``,
              inline: false
            },
            {
              name: '📝 Category Format',
              value: `The category name includes the repository: \`${actualCategoryName}\`\nThis makes it easy to see which repo each Discord category belongs to.`,
              inline: false
            }
          ],
          timestamp: new Date().toISOString()
        }],
        ephemeral: true
      });
    }
  };
}