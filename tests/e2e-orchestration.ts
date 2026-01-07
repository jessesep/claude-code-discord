/**
 * one agent discord - E2E Orchestration Test
 * 
 * Tests Manager -> Coder delegation and orchestration.
 * Uses the #e2e-orchestration testing channel.
 */

import { 
  createTestContext, 
  cleanupTestContext,
  waitForResult,
  isFinalResponse,
  buildAgentPrompt,
} from './e2e-utils.ts';

async function runOrchestrationTest() {
  console.log('🧪 Starting E2E Orchestration (Manager -> Coder) Test Suite...');
  console.log('   Using dedicated testing channel\n');
  
  const ctx = await createTestContext('e2e-orchestration');
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name} (${ctx.channelType})`);

  const timestamp = Date.now();
  const filename = `orch_test_${timestamp}.txt`;
  const task = `Create a file named "${filename}" containing the word "ORCHESTRATED" and then verify it exists.`;
  
  try {
    // We explicitly mention 'ag-manager' to test delegation
    console.log(`📤 Sending command to Manager...`);
    const prompt = buildAgentPrompt({
      agent: 'ag-manager',
      task: `I have a task for you: ${task}`,
      useBudget: true
    });
    await ctx.channel.send(prompt);

    console.log(`⏳ Waiting for orchestration to complete (this involves delegation)...`);
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
    await cleanupTestContext(ctx);
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
