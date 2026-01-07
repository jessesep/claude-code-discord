import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { WorktreeBotManager } from "./process-manager.ts";

export const gitCommands = [
  new SlashCommandBuilder()
    .setName('git')
    .setDescription('Execute Git command')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Git command to execute')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('worktree')
    .setDescription('Create Git worktree')
    .addStringOption(option =>
      option.setName('branch')
        .setDescription('Branch name')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('ref')
        .setDescription('Reference (default: branch name)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('worktree-list')
    .setDescription('List Git worktrees'),
  
  new SlashCommandBuilder()
    .setName('worktree-remove')
    .setDescription('Remove Git worktree')
    .addStringOption(option =>
      option.setName('branch')
        .setDescription('Branch name of worktree to remove')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('worktree-bots')
    .setDescription('List running worktree bot processes'),

  new SlashCommandBuilder()
    .setName('worktree-kill')
    .setDescription('Kill a specific worktree bot process')
    .addStringOption(option =>
      option.setName('path')
        .setDescription('Full path to worktree directory')
        .setRequired(true)),
];

export const githubCommands = [
  new SlashCommandBuilder()
    .setName('github')
    .setDescription('GitHub repository operations')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'Clone Repository', value: 'clone' },
          { name: 'Change Repository', value: 'repo' },
          { name: 'Create Issue', value: 'issue' },
          { name: 'Workflow Status', value: 'actions' }
        ))
    .addStringOption(option =>
      option.setName('url_or_name')
        .setDescription('Repository URL (for clone) or Name (for repo)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('custom_name')
        .setDescription('Custom directory name for clone')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('issue_title')
        .setDescription('Title for GitHub issue')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('issue_body')
        .setDescription('Body content for GitHub issue')
        .setRequired(false)),
];

export interface GitHandlerDeps {
  workDir: string;
  actualCategoryName: string;
  discordToken: string;
  applicationId: string;
  botSettings: {
    mentionEnabled: boolean;
    mentionUserId: string | null;
  };
  worktreeBotManager: WorktreeBotManager;
}

export function createGitHandlers(deps: GitHandlerDeps) {
  const { workDir, actualCategoryName, discordToken, applicationId, botSettings, worktreeBotManager } = deps;
  
  return {
    // deno-lint-ignore no-explicit-any
    async onGit(_ctx: any, command: string): Promise<string> {
      const { executeGitCommand } = await import("./handler.ts");
      return await executeGitCommand(workDir, `git ${command}`);
    },
    
    // deno-lint-ignore no-explicit-any
    async onWorktree(_ctx: any, branch: string, ref?: string) {
      const { createWorktree } = await import("./handler.ts");
      return await createWorktree(workDir, branch, ref);
    },
    
    // deno-lint-ignore no-explicit-any
    async onWorktreeList(_ctx: any) {
      const { listWorktrees } = await import("./handler.ts");
      return await listWorktrees(workDir);
    },
    
    // deno-lint-ignore no-explicit-any
    async onWorktreeRemove(_ctx: any, branch: string) {
      const { removeWorktree } = await import("./handler.ts");
      return await removeWorktree(workDir, branch);
    },
    
    // deno-lint-ignore no-explicit-any
    async onWorktreeBot(_ctx: any, fullPath: string, branch: string) {
      await worktreeBotManager.spawnWorktreeBot({
        fullPath,
        branch,
        actualCategoryName,
        discordToken,
        applicationId,
        botSettings,
      });
    },

    // deno-lint-ignore no-explicit-any
    onWorktreeBots(_ctx: any) {
      return worktreeBotManager.getStatus();
    },

    // deno-lint-ignore no-explicit-any
    onWorktreeKill(_ctx: any, path: string): { success: boolean; message: string } {
      const success = worktreeBotManager.killWorktreeBot(path);
      return {
        success,
        message: success ? 'Worktree bot killed successfully' : 'Worktree bot not found or failed to kill'
      };
    },

    // Kill all worktree bots (used during shutdown)
    killAllWorktreeBots() {
      worktreeBotManager.killAllWorktreeBots();
    },
    
    async getStatus() {
      const { getGitStatus } = await import("./handler.ts");
      const gitStatusInfo = await getGitStatus(workDir);
      return gitStatusInfo;
    }
  };
}

export function createGitHubHandlers(deps: GitHandlerDeps) {
  const { workDir } = deps;

  return {
    // deno-lint-ignore no-explicit-any
    async onClone(ctx: any, url: string, customName?: string, onProgress?: (percentage: number, stage: string) => void) {
      const { cloneGitHubRepo } = await import("./github.ts");
      // Use parent directory of workDir as base for clones if not specified otherwise
      // This assumes projects are sibling directories
      const baseDir = workDir.split('/').slice(0, -1).join('/');
      return await cloneGitHubRepo(baseDir, url, customName, onProgress);
    },

    // deno-lint-ignore no-explicit-any
    async onCreateIssue(_ctx: any, title: string, body: string) {
      const { createGitHubIssueWithCLI } = await import("../util/github-issues.ts");
      return await createGitHubIssueWithCLI({ title, body });
    },

    // deno-lint-ignore no-explicit-any
    async onGetActions(_ctx: any, limit?: number) {
      const { getGitHubWorkflowRuns } = await import("./github.ts");
      return await getGitHubWorkflowRuns(limit);
    }
  };
}
