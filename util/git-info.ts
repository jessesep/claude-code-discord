/**
 * Utility to fetch git repository information
 */

export interface GitInfo {
  branch: string;
  status: string;
  lastCommit?: string;
  isRepo: boolean;
}

/**
 * Get git information for a directory
 */
export async function getGitInfo(workDir: string): Promise<GitInfo> {
  try {
    // Check if it's a git repo
    const checkRepo = new Deno.Command("git", {
      args: ["rev-parse", "--is-inside-work-tree"],
      cwd: workDir,
      stdout: "piped",
      stderr: "piped"
    });
    
    const { success } = await checkRepo.output();
    if (!success) {
      return { branch: '', status: '', isRepo: false };
    }

    // Get branch
    const branchCmd = new Deno.Command("git", {
      args: ["branch", "--show-current"],
      cwd: workDir,
      stdout: "piped"
    });
    const branchOutput = await branchCmd.output();
    const branch = new TextDecoder().decode(branchOutput.stdout).trim();

    // Get status
    const statusCmd = new Deno.Command("git", {
      args: ["status", "--short"],
      cwd: workDir,
      stdout: "piped"
    });
    const statusOutput = await statusCmd.output();
    const status = new TextDecoder().decode(statusOutput.stdout).trim();

    // Get last commit
    const commitCmd = new Deno.Command("git", {
      args: ["log", "-1", "--oneline"],
      cwd: workDir,
      stdout: "piped"
    });
    const commitOutput = await commitCmd.output();
    const lastCommit = new TextDecoder().decode(commitOutput.stdout).trim();

    return {
      branch,
      status: status || 'clean',
      lastCommit,
      isRepo: true
    };
  } catch (error) {
    console.debug(`[GitInfo] Error fetching git info for ${workDir}: ${error}`);
    return { branch: '', status: '', isRepo: false };
  }
}

/**
 * Format git info for system prompt
 */
export function formatGitInfoForPrompt(info: GitInfo): string {
  if (!info.isRepo) return '';
  
  return `\n\n=== GIT REPOSITORY INFO ===\nBranch: ${info.branch}\nStatus: ${info.status === 'clean' ? 'No uncommitted changes' : '\n' + info.status}\nLast Commit: ${info.lastCommit || 'None'}\n=== END GIT REPOSITORY INFO ===\n`;
}
