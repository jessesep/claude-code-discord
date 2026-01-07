import { setupTester, waitForResult, isFinalResponse, CLAUDE_BOT_ID } from './e2e-utils.ts';

async function runGitTest() {
  console.log('🧪 Starting E2E Git Operation Test Suite...');
  
  const ctx = await setupTester();
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name}`);

  const branchName = `test-e2e-branch-${Date.now()}`;
  const testPrompt = `<@${CLAUDE_BOT_ID}> using cursor-coder, Please perform the following git operations:
1. Create a new branch named "${branchName}"
2. Switch to this new branch
3. Switch back to the main branch
4. Delete the branch "${branchName}"
Confirm when all steps are completed successfully.`;
  
  try {
    console.log(`📤 Sending command: "${testPrompt}"`);
    await ctx.channel.send(testPrompt);

    console.log(`⏳ Waiting for agent to complete git task...`);
    // Git ops can be slow
    const result = await waitForResult(ctx, 180000, isFinalResponse);

    if (!result.success) {
      throw new Error(result.error || 'Test failed');
    }

    console.log(`✅ Agent finished. Verifying branch "${branchName}" does not exist (with retries)...`);
    
    // Verify branch was deleted with retries (filesystem/git sync can be slow)
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
      throw new Error(`Branch "${branchName}" still exists after multiple checks! Deletion failed.`);
    }
    
    console.log(`✅ Git operation verification passed.`);
    return { success: true, message: 'Git operation test passed' };

  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    ctx.tester.destroy();
  }
}

if (import.meta.main) {
  const result = await runGitTest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
