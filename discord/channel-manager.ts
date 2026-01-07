import { ChannelType, TextChannel } from "npm:discord.js@14.14.1";
import { sanitizeChannelName } from "./utils.ts";

/**
 * Channel management
 */
export async function ensureChannelExists(
  guild: any,
  actualCategoryName: string,
  branchName: string,
  repoName: string,
  workDir: string
): Promise<TextChannel> {
  const channelName = sanitizeChannelName(branchName);
  
  console.log(`Checking category "${actualCategoryName}"...`);
  
  let category = guild.channels.cache.find(
    (c: any) => c.type === ChannelType.GuildCategory && c.name === actualCategoryName
  );
  
  if (!category) {
    console.log(`Creating category "${actualCategoryName}"...`);
    try {
      category = await guild.channels.create({
        name: actualCategoryName,
        type: ChannelType.GuildCategory,
      });
      console.log(`Created category "${actualCategoryName}"`);
    } catch (error) {
      console.error(`Category creation error: ${error}`);
      throw new Error(`Cannot create category. Please ensure the bot has "Manage Channels" permission.`);
    }
  }
  
  let channel = guild.channels.cache.find(
    (c: any) => c.type === ChannelType.GuildText && c.name === channelName && c.parentId === category.id
  );
  
  if (!channel) {
    console.log(`Creating channel "${channelName}"...`);
    try {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `Repository: ${repoName} | Branch: ${branchName} | Machine: ${Deno.hostname()} | Path: ${workDir}`,
      });
      console.log(`Created channel "${channelName}"`);
    } catch (error) {
      console.error(`Channel creation error: ${error}`);
      throw new Error(`Cannot create channel. Please ensure the bot has "Manage Channels" permission.`);
    }
  }
  
  return channel as TextChannel;
}
