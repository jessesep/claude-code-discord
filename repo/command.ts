import { SlashCommandBuilder } from "npm:discord.js@14.14.1";

export const repoCommands = [
  new SlashCommandBuilder()
    .setName('repo-sync')
    .setDescription('Scan and sync available repositories')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'Scan Repositories', value: 'scan' },
          { name: 'List Repositories', value: 'list' },
          { name: 'Clear Cache', value: 'clear' }
        )),
  
  new SlashCommandBuilder()
    .setName('repo')
    .setDescription('Load and switch to a repository')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'Load Repository', value: 'load' },
          { name: 'Show Current', value: 'current' },
          { name: 'List Available', value: 'list' }
        ))
    .addStringOption(option =>
      option.setName('repo_name')
        .setDescription('Repository name (for load action)')
        .setRequired(false)),
];

export interface RepoHandlerDeps {
  workDir: string;
  repoName: string;
  branchName: string;
  actualCategoryName: string;
  discordToken: string;
  applicationId: string;
  botSettings: {
    mentionEnabled: boolean;
    mentionUserId: string | null;
  };
  worktreeBotManager: any;
}
