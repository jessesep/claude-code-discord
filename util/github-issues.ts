/**
 * GitHub Issue Creation Utility
 * Provides a simple way to create GitHub issues using gh CLI or GitHub API
 */

export interface GitHubIssue {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
  milestone?: string;
  project?: string;
  projectColumn?: string;
}

/**
 * Create a GitHub issue using gh CLI (if available)
 */
export async function createGitHubIssueWithCLI(issue: GitHubIssue): Promise<{ success: boolean; issueNumber?: number; error?: string }> {
  try {
    // Check if gh CLI is installed
    try {
      const checkCmd = new Deno.Command("gh", {
        args: ["--version"],
        stdout: "piped",
        stderr: "piped"
      });
      const checkResult = await checkCmd.output();
      if (!checkResult.success) {
        return {
          success: false,
          error: "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
        };
      }
    } catch (error) {
      return {
        success: false,
        error: "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
      };
    }

    // Build gh issue create command arguments
    const args = ["issue", "create", "--title", issue.title];
    
    // Add body
    args.push("--body", issue.body);

    // Add labels if provided
    if (issue.labels && issue.labels.length > 0) {
      args.push("--label", issue.labels.join(','));
    }

    // Add assignees if provided
    if (issue.assignees && issue.assignees.length > 0) {
      args.push("--assignee", issue.assignees.join(','));
    }

    // Add milestone if provided
    if (issue.milestone) {
      args.push("--milestone", issue.milestone);
    }

    // Add project if provided (requires project number or name)
    if (issue.project) {
      args.push("--project", issue.project);
    }

    // Execute command
    const cmd = new Deno.Command("gh", {
      args,
      cwd: Deno.cwd(),
      stdout: "piped",
      stderr: "piped"
    });

    const result = await cmd.output();
    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);

    if (!result.success) {
      return {
        success: false,
        error: stderr || "Failed to create GitHub issue"
      };
    }

    // Parse issue number from output (gh CLI returns "https://github.com/owner/repo/issues/123")
    const issueMatch = stdout.match(/issues\/(\d+)/);
    const issueNumber = issueMatch ? parseInt(issueMatch[1]) : undefined;

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
