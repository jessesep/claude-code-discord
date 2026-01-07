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
    const result = await spawnAgent(
      ctx,
      'cursor-coder',
      `Perform these git operations in order:
1. Create a new branch named "${branchName}"
2. Switch to this new branch
3. Switch back to the main branch
4. Delete the branch "${branchName}"
Confirm when all steps are completed.`,
      { timeout: 180000, useBudget: true }
    );

    if (!result.success) {
      throw new Error(result.error || 'Test failed');
    }

    console.log(`✅ Agent finished in ${result.duration}ms. Verifying branch "${branchName}" does not exist...`);
    
    // Verify branch was deleted with retries
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
    return { success: true, message: 'Git operation test passed', duration: result.duration };

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
