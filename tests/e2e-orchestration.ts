import { setupTester, waitForResult, isFinalResponse, ONE_BOT_ID } from './e2e-utils.ts';

async function runOrchestrationTest() {
  console.log('🧪 Starting E2E Orchestration (Manager -> Coder) Test Suite...');
  
  const ctx = await setupTester();
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name}`);

  const timestamp = Date.now();
  const filename = `orch_test_${timestamp}.txt`;
  const task = `Create a file named "${filename}" containing the word "ORCHESTRATED" and then verify it exists.`;
  
  // We explicitly mention 'ag-manager' to test delegation
  const testPrompt = `<@${ONE_BOT_ID}> using ag-manager, I have a task for you: ${task}`;
  
  try {
    console.log(`📤 Sending command to Manager: "${testPrompt}"`);
    await ctx.channel.send(testPrompt);

    console.log(`⏳ Waiting for orchestration to complete (this involves delegation)...`);
    // Orchestration takes longer
    const result = await waitForResult(ctx, 240000, isFinalResponse);

    if (!result.success) {
      throw new Error(result.error || 'Orchestration test failed or timed out');
    }

    console.log(`✅ Orchestration finished. Verifying file: ${filename}`);
    
    try {
      const fileContent = await Deno.readTextFile(filename);
      if (!fileContent.includes("ORCHESTRATED")) {
        throw new Error(`File content mismatch. Got: "${fileContent}"`);
      }
      console.log(`✅ File verification passed.`);
    } catch (err) {
      // If file doesn't exist locally, maybe it was created in a different workspace?
      // But for this project it should be local.
      throw new Error(`Could not verify file ${filename}: ${err.message}`);
    }
    
    return { success: true, message: 'Orchestration (Manager -> Coder) test passed' };

  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    try {
      await Deno.remove(filename);
      console.log(`🧹 Cleaned up test file: ${filename}`);
    } catch {}
    ctx.tester.destroy();
  }
}

if (import.meta.main) {
  const result = await runOrchestrationTest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
