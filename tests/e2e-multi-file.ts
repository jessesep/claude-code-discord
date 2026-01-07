/**
 * one agent discord - E2E Multi-File Test
 * 
 * Tests multi-file creation capabilities.
 * Uses the #e2e-multi-file testing channel.
 */

import { 
  createTestContext, 
  spawnAgent, 
  cleanupTestContext,
} from './e2e-utils.ts';

async function runMultiFileTest() {
  console.log('🧪 Starting E2E Multi-File Test Suite...');
  console.log('   Using dedicated testing channel\n');
  
  const ctx = await createTestContext('e2e-multi-file');
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name} (${ctx.channelType})`);

  const timestamp = Date.now();
  const file1 = `multi_test_1_${timestamp}.txt`;
  const content1 = "CONTENT ONE";
  const file2 = `multi_test_2_${timestamp}.txt`;
  const content2 = "CONTENT TWO";
  
  try {
    const result = await spawnAgent(
      ctx,
      'cursor-coder',
      `Create two files: "${file1}" with content "${content1}" and "${file2}" with content "${content2}". Be brief.`,
      { timeout: 180000, useBudget: true }
    );

    if (!result.success) {
      throw new Error(result.error || 'Test failed');
    }

    console.log(`✅ Agent finished in ${result.duration}ms. Verifying files...`);
    
    for (const [file, expected] of [[file1, content1], [file2, content2]]) {
      const content = await Deno.readTextFile(file);
      if (content.trim() !== expected) {
        throw new Error(`${file} content mismatch. Got: "${content}", Expected: "${expected}"`);
      }
      console.log(`✅ Verified ${file}`);
    }
    
    return { success: true, message: 'Multi-file creation test passed', duration: result.duration };

  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    for (const file of [file1, file2]) {
      try {
        await Deno.remove(file);
        console.log(`🧹 Cleaned up test file: ${file}`);
      } catch {}
    }
    await cleanupTestContext(ctx);
  }
}

if (import.meta.main) {
  const result = await runMultiFileTest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  if (result.duration) console.log(`Duration: ${result.duration}ms`);
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
