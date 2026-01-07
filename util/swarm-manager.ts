
import { ChannelType, PermissionFlagsBits } from "npm:discord.js@14.14.1";
import { InteractionContext } from "../discord/types.ts";
import { sanitizeChannelName } from "../discord/utils.ts";

export interface SwarmAgentTask {
  name: string;
  task: string;
}

export interface SwarmConfig {
  projectName: string;
  agents: SwarmAgentTask[];
  categoryName?: string;
}

/**
 * Swarm Manager
 * 
 * Handles the dynamic creation of categories and channels for multi-agent swarms.
 */
export class SwarmManager {
  /**
   * Spawns a new swarm by creating a category and channels for each agent.
   */
  static async spawnSwarm(ctx: InteractionContext, config: SwarmConfig): Promise<{ categoryId: string; channels: { name: string; id: string }[] }> {
    const guild = ctx.guild;
    if (!guild) {
      throw new Error("Interaction must be in a guild to spawn a swarm.");
    }

    const repoName = ctx.channelContext?.repoName || "unknown-repo";
    const workDir = ctx.channelContext?.projectPath || Deno.cwd();
    const branchName = ctx.channelContext?.branchName || "main";

    // 1. Create Category
    const categoryName = config.categoryName || `[Swarm] ${config.projectName} (${repoName})`;
    console.log(`[Swarm] Creating category: ${categoryName}`);
    
    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel], // Private by default? No, let's keep it visible for now or follow guild settings
        }
      ]
    });

    const results = {
      categoryId: category.id,
      channels: [] as { name: string; id: string }[]
    };

    // 2. Create Channels and Spawn Agents
    for (const agentTask of config.agents) {
      const channelName = sanitizeChannelName(`${agentTask.name}-${config.projectName}`);
      console.log(`[Swarm] Creating channel: #${channelName}`);
      
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `Agent: ${agentTask.name} | Task: ${agentTask.task} | Repository: ${repoName} | Path: ${workDir} | Branch: ${branchName}`
      });

      results.channels.push({
        name: agentTask.name,
        id: channel.id
      });
      
      // Note: The actual agent spawning will be handled by the caller in agent/index.ts
      // because it needs to set up the agent sessions and call chatWithAgent.
    }

    return results;
  }
}
