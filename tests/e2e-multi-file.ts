import { setupTester, waitForResult, isFinalResponse, ONE_BOT_ID } from './e2e-utils.ts';

async function runMultiFileTest() {
  console.log('🧪 Starting E2E Multi-File Test Suite (Refactored)...');
  
  const ctx = await setupTester();
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name}`);

  const timestamp = Date.now();
  const file1 = `multi_test_1_${timestamp}.txt`;
  const content1 = "CONTENT ONE";
  const file2 = `multi_test_2_${timestamp}.txt`;
  const content2 = "CONTENT TWO";
  
  const testPrompt = `<@${ONE_BOT_ID}> using cursor-coder, Create two files: "${file1}" with content "${content1}" and "${file2}" with content "${content2}". Then list the files in the current directory.`;
  
  try {
    console.log(`📤 Sending command: "${testPrompt.substring(0, 100)}..."`);
    await ctx.channel.send(testPrompt);

    console.log(`⏳ Waiting for agent to complete multi-file task...`);
    // Give it more time for multi-file
    const result = await waitForResult(ctx, 180000, isFinalResponse);

    if (!result.success) {
      throw new Error(result.error || 'Test failed');
    }

    console.log(`✅ Agent finished. Verifying files...`);
    
    for (const [file, expected] of [[file1, content1], [file2, content2]]) {
      const content = await Deno.readTextFile(file);
      if (content.trim() !== expected) {
        throw new Error(`${file} content mismatch. Got: "${content}", Expected: "${expected}"`);
      }
      console.log(`✅ Verified ${file}`);
    }
    
    return { success: true, message: 'Multi-file creation test passed' };

  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    for (const file of [file1, file2]) {
      try {
        await Deno.remove(file);
        console.log(`🧹 Cleaned up test file: ${file}`);
      } catch {}
    }
    ctx.tester.destroy();
  }
}

if (import.meta.main) {
  const result = await runMultiFileTest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
