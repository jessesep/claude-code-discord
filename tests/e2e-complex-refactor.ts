import { setupTester, waitForResult, isFinalResponse, ONE_BOT_ID } from './e2e-utils.ts';

async function runComplexRefactorTest() {
  console.log('🧪 Starting E2E Complex Refactor Test Suite...');
  
  const ctx = await setupTester();
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name}`);

  const targetFile = "tests/refactor-target.ts";
  const utilFile = "util/e2e-demo-util.ts";
  
  const testPrompt = `<@${ONE_BOT_ID}> using cursor-coder, I want to perform a multi-step refactor:
1. Create a new file "${utilFile}" that exports a function \`logAndReturn<T>(val: T, msg: string): T\` that logs the message and returns the value.
2. Refactor "${targetFile}" to use this new utility function instead of manual console.log calls inside \`calculateSum\`.
3. Ensure "${targetFile}" imports the utility correctly.
Confirm when both files are updated and correct.`;
  
  try {
    console.log(`📤 Sending complex refactor command...`);
    await ctx.channel.send(testPrompt);

    console.log(`⏳ Waiting for agent to complete complex refactor (this may take a while)...`);
    // This is a complex task, give it 5 minutes
    const result = await waitForResult(ctx, 300000, isFinalResponse);

    if (!result.success) {
      throw new Error(result.error || 'Complex refactor test failed or timed out');
    }

    console.log(`✅ Agent finished. Verifying changes...`);
    
    // Check util file
    const utilContent = await Deno.readTextFile(utilFile);
    if (!utilContent.includes("logAndReturn") || !utilContent.includes("export")) {
      throw new Error(`Utility file "${utilFile}" was not created correctly.`);
    }
    console.log(`✅ Verified ${utilFile} creation.`);

    // Check refactor target
    const targetContent = await Deno.readTextFile(targetFile);
    if (!targetContent.includes("logAndReturn") || !targetContent.includes(`import`) || targetContent.includes('console.log("Calculating sum...")')) {
      throw new Error(`Target file "${targetFile}" was not refactored correctly.`);
    }
    console.log(`✅ Verified ${targetFile} refactor.`);
    
    return { success: true, message: 'Complex refactor test passed' };

  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    // Cleanup
    try {
      await Deno.remove(utilFile);
      console.log(`🧹 Cleaned up utility file: ${utilFile}`);
    } catch {}
    // We leave the target file as it was part of the setup, but maybe we should clean it too or revert it
    try {
      await Deno.remove(targetFile);
      console.log(`🧹 Cleaned up target file: ${targetFile}`);
    } catch {}
    
    ctx.tester.destroy();
  }
}

if (import.meta.main) {
  const result = await runComplexRefactorTest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
