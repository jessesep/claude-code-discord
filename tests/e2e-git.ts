/**
 * one agent discord - E2E Git Operations Test
 * 
 * Tests git branch operations.
 * Uses the #e2e-basic testing channel (git ops are fundamental).
 */

import { 
  createTestContext, 
  spawnAgent,
  cleanupTestContext,
} from './e2e-utils.ts';

async function runGitTest() {
  console.log('🧪 Starting E2E Git Operation Test Suite...');
  console.log('   Using dedicated testing channel\n');
  
  const ctx = await createTestContext('e2e-basic');
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name} (${ctx.channelType})`);

  const branchName = `test-e2e-branch-${Date.now()}`;
  
  try {
    // Step 1: Create and switch to branch, then back to main
    console.log(`📝 Step 1: Creating branch "${branchName}" and testing checkout...`);
    const result1 = await spawnAgent(
      ctx,
      'cursor-coder',
      `Execute these exact git commands in order and tell me the output of each:
1. git checkout -b ${branchName}
2. git branch (to confirm the new branch exists)
3. git checkout main
Report what each command output.`,
      { timeout: 120000, useBudget: true }
    );

    if (!result1.success) {
      throw new Error(`Step 1 failed: ${result1.error}`);
    }

    console.log(`✅ Step 1 complete in ${result1.duration}ms`);
    
    // Small delay to ensure git operations complete
    await new Promise(r => setTimeout(r, 2000));
    
    // Verify branch exists before deletion
    const checkCmd = new Deno.Command("git", {
      args: ["branch", "--list", branchName],
      stdout: "piped",
    });
    const checkOutput = await checkCmd.output();
    const branchList = new TextDecoder().decode(checkOutput.stdout).trim();
    
    if (!branchList.includes(branchName)) {
      throw new Error(`Branch "${branchName}" was not created!`);
    }
    console.log(`✅ Verified branch "${branchName}" exists`);

    // Step 2: Delete the branch (separate prompt for clarity)
    console.log(`📝 Step 2: Deleting branch "${branchName}"...`);
    const result2 = await spawnAgent(
      ctx,
      'cursor-coder',
      `Delete the git branch named "${branchName}" using: git branch -D ${branchName}
Then run: git branch
Report what both commands output to confirm the branch is deleted.`,
      { timeout: 60000, useBudget: true }
    );

    if (!result2.success) {
      throw new Error(`Step 2 failed: ${result2.error}`);
    }

    console.log(`✅ Step 2 complete in ${result2.duration}ms`);
    
    // Wait for git to sync
    await new Promise(r => setTimeout(r, 2000));

    // Verify branch was deleted with retries
    console.log(`🔍 Verifying branch deletion...`);
    let branchExists = true;
    for (let i = 0; i < 5; i++) {
      const cmd = new Deno.Command("git", {
        args: ["branch", "--list", branchName],
        stdout: "piped",
      });
      const output = await cmd.output();
      const branches = new TextDecoder().decode(output.stdout).trim();
      
      if (!branches.includes(branchName)) {
        branchExists = false;
        break;
      }
      
      console.log(`  [${i+1}/5] Branch still exists, waiting 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }

    if (branchExists) {
      throw new Error(`Branch "${branchName}" still exists after multiple checks!`);
    }
    
    console.log(`✅ Git operation verification passed.`);
    const totalDuration = (result1.duration || 0) + (result2.duration || 0);
    return { success: true, message: 'Git operation test passed', duration: totalDuration };

  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    // Cleanup: ensure branch is deleted
    try {
      await new Deno.Command("git", { args: ["branch", "-D", branchName] }).output();
    } catch {}
    await cleanupTestContext(ctx);
  }
}

if (import.meta.main) {
  const result = await runGitTest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  if (result.duration) console.log(`Duration: ${result.duration}ms`);
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
