/**
 * GitHub Issue Creation Utility
 * Provides a simple way to create GitHub issues using gh CLI or GitHub API
 */

export interface GitHubIssue {
  title: string;
  body: string;
  labels?: string[];
}

/**
 * Create a GitHub issue using gh CLI (if available)
 */
export async function createGitHubIssueWithCLI(issue: GitHubIssue): Promise<{ success: boolean; issueNumber?: number; error?: string }> {
  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    // Check if gh CLI is installed
    try {
      await execAsync("gh --version");
    } catch (error) {
      return {
        success: false,
        error: "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
      };
    }

    // Build gh issue create command
    let command = `gh issue create --title "${issue.title.replace(/"/g, '\\"')}"`;
    
    // Add body (use heredoc for multiline)
    const bodyEscaped = issue.body.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    command += ` --body "${bodyEscaped.replace(/"/g, '\\"')}"`;

    // Add labels if provided
    if (issue.labels && issue.labels.length > 0) {
      command += ` --label "${issue.labels.join(',')}"`;
    }

    // Execute command
    const { stdout, stderr } = await execAsync(command, {
      cwd: Deno.cwd(),
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    // Parse issue number from output (gh CLI returns "https://github.com/owner/repo/issues/123")
    const issueMatch = stdout.match(/issues\/(\d+)/);
    const issueNumber = issueMatch ? parseInt(issueMatch[1]) : undefined;

    if (stderr && !issueNumber) {
      return {
        success: false,
        error: stderr
      };
    }

    return {
      success: true,
      issueNumber
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Create multiple GitHub issues
 */
export async function createMultipleGitHubIssues(issues: GitHubIssue[]): Promise<{
  success: number;
  failed: number;
  results: Array<{ issue: GitHubIssue; success: boolean; issueNumber?: number; error?: string }>;
}> {
  const results = [];
  let successCount = 0;
  let failedCount = 0;

  for (const issue of issues) {
    const result = await createGitHubIssueWithCLI(issue);
    results.push({ issue, ...result });
    
    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }

    // Small delay between requests to avoid rate limiting
    if (issues.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return {
    success: successCount,
    failed: failedCount,
    results
  };
}
