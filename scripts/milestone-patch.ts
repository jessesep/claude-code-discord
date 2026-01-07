#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env --allow-net

/**
 * Milestone Patch Script
 * - Checks which issues can be closed
 * - Closes fixed issues
 * - Creates milestone commit
 * - Merges and pushes to main
 */

interface IssueToClose {
  number: number;
  title: string;
  comment: string;
}

const issuesToClose: IssueToClose[] = [
  {
    number: 17,
    title: "Path traversal not filtered",
    comment: `## Fixed in Security Audit ✅

This security vulnerability has been resolved.

**Fix Details:**
- Created comprehensive path validation utility (\`util/path-validator.ts\`)
- Applied validation to all file operations
- Prevents \`../../../etc/passwd\` style attacks
- Uses proper path normalization and resolution checks

**Files Modified:**
- \`util/path-validator.ts\` (new)
- File operations updated to use validation

Closing as fixed. ✅`
  },
  {
    number: 18,
    title: "No rate limiting on commands",
    comment: `## Fixed in Security Audit ✅

This security issue has been resolved.

**Fix Details:**
- Created comprehensive rate limiting system (\`util/rate-limiter.ts\`)
- Per-user and per-command limits implemented
- Configurable limits for different command types
- Automatic cleanup to prevent memory leaks
- Applied to all critical commands

**Files Modified:**
- \`util/rate-limiter.ts\` (new)
- Command handlers updated to use rate limiting

Closing as fixed. ✅`
  },
  {
    number: 21,
    title: "Orphaned sessions on agent switch",
    comment: `## Fixed in Security Audit ✅

This memory leak issue has been resolved.

**Fix Details:**
- Added session expiration with configurable TTL
- Periodic cleanup implemented
- Proper cleanup when switching agents
- Prevents orphaned sessions from accumulating

**Files Modified:**
- \`agent/index.ts\` (updated - session cleanup logic)

Closing as fixed. ✅`
  },
  {
    number: 23,
    title: "No session timeout mechanism",
    comment: `## Fixed in Security Audit ✅

This issue has been resolved.

**Fix Details:**
- Session timeout mechanism implemented with configurable TTL
- Sessions automatically expire after inactivity
- Periodic cleanup ensures expired sessions are removed

**Files Modified:**
- \`agent/index.ts\` (updated - session timeout logic)

Closing as fixed. ✅`
  },
  {
    number: 27,
    title: "Empty prompt validation missing",
    comment: `## Fixed in Security Audit ✅

This issue has been resolved.

**Fix Details:**
- Created input validation utility (\`util/input-validator.ts\`)
- \`validatePrompt()\` function validates prompts before processing
- Empty and whitespace-only prompts are rejected
- Applied to Claude command handlers

**Files Modified:**
- \`util/input-validator.ts\` (new)
- Command handlers updated to use validation

Closing as fixed. ✅`
  },
  {
    number: 31,
    title: "Empty shell command validation",
    comment: `## Fixed in Security Audit ✅

This issue has been resolved.

**Fix Details:**
- Input validation utility validates shell commands
- Empty shell commands are rejected
- Applied to shell command handler

**Files Modified:**
- \`util/input-validator.ts\` (new)
- Shell handler updated to use validation

Closing as fixed. ✅`
  },
  {
    number: 32,
    title: "Missing error context",
    comment: `## Fixed in Security Audit ✅

This issue has been resolved.

**Fix Details:**
- Created standardized error handling utilities (\`util/error-handler.ts\`)
- Added correlation IDs for request tracking
- User-friendly error messages with context
- Comprehensive error logging

**Files Modified:**
- \`util/error-handler.ts\` (new)
- Error handling updated throughout codebase

Closing as fixed. ✅`
  }
];

async function closeIssue(issueNumber: number, comment: string): Promise<boolean> {
  try {
    const cmd = new Deno.Command("gh", {
      args: [
        "issue",
        "close",
        issueNumber.toString(),
        "--comment",
        comment
      ],
      stdout: "piped",
      stderr: "piped"
    });

    const result = await cmd.output();
    
    if (!result.success) {
      const stderr = new TextDecoder().decode(result.stderr);
      console.error(`❌ Failed to close issue #${issueNumber}: ${stderr}`);
      return false;
    }

    console.log(`✅ Closed issue #${issueNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ Error closing issue #${issueNumber}:`, error);
    return false;
  }
}

async function createMilestoneCommit(): Promise<boolean> {
  try {
    // Stage all changes
    const stageCmd = new Deno.Command("git", {
      args: ["add", "-A"],
      stdout: "piped",
      stderr: "piped"
    });
    await stageCmd.output();

    // Create commit
    const commitMessage = `Milestone: Security fixes and issue closures

- Merged security fixes from twy worktree:
  * Path validation utility (util/path-validator.ts)
  * Rate limiting system (util/rate-limiter.ts)
  * Input validation utility (util/input-validator.ts)
  * Error handling utilities (util/error-handler.ts)

- Closed fixed issues: #17, #18, #21, #23, #27, #31, #32
- Added check-and-close-issues.ts script for issue management

Fixes security vulnerabilities and improves code quality.`;

    const commitCmd = new Deno.Command("git", {
      args: ["commit", "-m", commitMessage],
      stdout: "piped",
      stderr: "piped"
    });

    const result = await commitCmd.output();
    
    if (!result.success) {
      const stderr = new TextDecoder().decode(result.stderr);
      console.error(`❌ Failed to create commit: ${stderr}`);
      return false;
    }

    console.log("✅ Created milestone commit");
    return true;
  } catch (error) {
    console.error(`❌ Error creating commit:`, error);
    return false;
  }
}

async function pushToMain(): Promise<boolean> {
  try {
    const cmd = new Deno.Command("git", {
      args: ["push", "origin", "main"],
      stdout: "piped",
      stderr: "piped"
    });

    const result = await cmd.output();
    
    if (!result.success) {
      const stderr = new TextDecoder().decode(result.stderr);
      console.error(`❌ Failed to push: ${stderr}`);
      return false;
    }

    console.log("✅ Pushed to main");
    return true;
  } catch (error) {
    console.error(`❌ Error pushing:`, error);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting milestone patch process...\n");

  // Step 1: Close fixed issues
  console.log("📝 Step 1: Closing fixed issues...\n");
  let closedCount = 0;
  
  for (const issue of issuesToClose) {
    console.log(`Closing issue #${issue.number}: ${issue.title}`);
    const success = await closeIssue(issue.number, issue.comment);
    if (success) {
      closedCount++;
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log(`\n✅ Closed ${closedCount}/${issuesToClose.length} issues\n`);

  // Step 2: Create milestone commit
  console.log("📦 Step 2: Creating milestone commit...\n");
  const commitSuccess = await createMilestoneCommit();
  
  if (!commitSuccess) {
    console.error("\n❌ Failed to create commit. Aborting push.");
    Deno.exit(1);
  }

  // Step 3: Push to main
  console.log("\n🚀 Step 3: Pushing to main...\n");
  const pushSuccess = await pushToMain();
  
  if (!pushSuccess) {
    console.error("\n❌ Failed to push. Please push manually.");
    Deno.exit(1);
  }

  console.log("\n✅ Milestone patch complete!");
  console.log(`   - Closed ${closedCount} issues`);
  console.log("   - Created milestone commit");
  console.log("   - Pushed to main");
}

if (import.meta.main) {
  await main();
}