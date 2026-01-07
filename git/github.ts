/**
 * GitHub Operations Handler
 */

export interface GitHubCloneResult {
  success: boolean;
  repoName: string;
  fullPath: string;
  output: string;
  error?: string;
}

export type ProgressCallback = (percentage: number, stage: string) => void;

/**
 * Clone a GitHub repository with progress reporting
 */
export async function cloneGitHubRepo(
  baseDir: string,
  repoUrl: string,
  customName?: string,
  onProgress?: ProgressCallback
): Promise<GitHubCloneResult> {
  try {
    // Extract repo name from URL if custom name not provided
    let repoName = customName;
    if (!repoName) {
      const parts = repoUrl.split('/');
      repoName = parts[parts.length - 1].replace(/\.git$/, '');
    }

    const fullPath = `${baseDir}/${repoName}`;

    // Execute git clone with --progress to ensure we get updates even if not a TTY
    const cmd = new Deno.Command("git", {
      args: ["clone", "--progress", repoUrl, fullPath],
      stdout: "piped",
      stderr: "piped",
    });

    const process = cmd.spawn();
    
    // Read stderr for progress information
    const reader = process.stderr.getReader();
    const decoder = new TextDecoder();
    let accumulatedStderr = "";
    let lastPercentage = -1;

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          accumulatedStderr += chunk;
          
          // Parse progress from git output
          // Format is usually: "Receiving objects:  11% (123/1118)"
          // or "Resolving deltas:  50% (500/1000)"
          const lines = chunk.split(/[\r\n]/);
          for (const line of lines) {
            const match = line.match(/([\w\s]+):\s+(\d+)%/);
            if (match && onProgress) {
              const stage = match[1].trim();
              const percentage = parseInt(match[2]);
              
              // Only report if percentage changed to avoid spamming
              if (percentage !== lastPercentage) {
                onProgress(percentage, stage);
                lastPercentage = percentage;
              }
            }
          }
        }
      } catch (err) {
        console.error("[GitHub Clone] Error reading progress:", err);
      }
    })();

    const status = await process.status;
    const stdout = await process.output();
    const finalOutput = decoder.decode(stdout.stdout);

    if (!status.success) {
      return {
        success: false,
        repoName,
        fullPath,
        output: finalOutput || accumulatedStderr,
        error: accumulatedStderr || "Failed to clone repository"
      };
    }

    return {
      success: true,
      repoName,
      fullPath,
      output: finalOutput || `Successfully cloned ${repoUrl} to ${fullPath}`
    };
  } catch (error) {
    return {
      success: false,
      repoName: customName || "unknown",
      fullPath: "unknown",
      output: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Creates a visual progress bar string
 */
export function createProgressBar(percentage: number, size = 15): string {
  const completed = Math.floor(percentage / (100 / size));
  const remaining = Math.max(0, size - completed);
  const bar = "█".repeat(completed) + "░".repeat(remaining);
  return `\`${bar}\` ${percentage}%`;
}

export interface GitHubWorkflowRun {
  workflowName: string;
  status: string;
  conclusion: string;
  url: string;
  createdAt: string;
  headBranch: string;
}

/**
 * Get recent GitHub workflow runs
 */
export async function getGitHubWorkflowRuns(limit = 5): Promise<{ success: boolean; runs: GitHubWorkflowRun[]; error?: string }> {
  try {
    const cmd = new Deno.Command("gh", {
      args: ["run", "list", "--limit", limit.toString(), "--json", "workflowName,status,conclusion,url,createdAt,headBranch"],
      stdout: "piped",
      stderr: "piped"
    });

    const { success, stdout, stderr } = await cmd.output();
    const output = new TextDecoder().decode(stdout);
    const errorOutput = new TextDecoder().decode(stderr);

    if (!success) {
      return {
        success: false,
        runs: [],
        error: errorOutput || "Failed to fetch workflow runs"
      };
    }

    const runs = JSON.parse(output) as GitHubWorkflowRun[];
    return {
      success: true,
      runs
    };
  } catch (error) {
    return {
      success: false,
      runs: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
