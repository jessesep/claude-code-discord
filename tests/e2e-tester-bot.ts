import { setupTester, waitForResult, isFinalResponse, ONE_BOT_ID, getBudgetPrompt } from './e2e-utils.ts';

async function runE2ETest() {
  console.log('🧪 Starting E2E Tester Bot Suite (Refactored)...');
  
  const ctx = await setupTester();
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name}`);

  // NEW: Announce startup to Discord
  await ctx.channel.send({
    embeds: [{
      color: 0x9b59b6,
      title: "🧪 E2E Test Suite Active",
      description: `Testing bot **${ctx.tester.user?.tag}** is now online and initiating scenarios.`,
      fields: [
        { name: "📂 Channel", value: `#${ctx.channel.name}`, inline: true },
        { name: "🤖 Mode", value: "Budget (Gemini 3 Flash)", inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  });

  const timestamp = Date.now();
  const filename = `e2e_test_${timestamp}.txt`;
  const expectedContent = "E2E TEST PASSED";
  
  // Use budget-friendly prompt helper
  const testPrompt = getBudgetPrompt(
    "cursor-coder", 
    `Create a file named "${filename}" with the text "${expectedContent}" and then show me the contents of that file.`
  );
  
  try {
    console.log(`📤 Sending command: "${testPrompt.substring(0, 50)}..."`);
    await ctx.channel.send(testPrompt);

    console.log(`⏳ Waiting for agent to complete task...`);
    const result = await waitForResult(ctx, 120000, isFinalResponse);

    if (!result.success) {
      throw new Error(result.error || 'Test failed');
    }

    console.log(`✅ Agent finished. Verifying file: ${filename}`);
    
    const fileContent = await Deno.readTextFile(filename);
    if (fileContent.trim() !== expectedContent) {
      throw new Error(`File content mismatch. Got: "${fileContent}", Expected: "${expectedContent}"`);
    }
    
    console.log(`✅ File verification passed.`);
    
    // NEW: Report final success to Discord
    await ctx.channel.send({
      embeds: [{
        color: 0x00ff00,
        title: "✨ E2E Test Passed",
        description: "Basic file creation and verification sequence completed successfully.",
        timestamp: new Date().toISOString()
      }]
    });

    return { success: true, message: 'Basic file creation test passed' };

  } catch (err) {
    // NEW: Report error to Discord
    try {
      await ctx.channel.send({
        embeds: [{
          color: 0xff0000,
          title: "❌ E2E Test Failed",
          description: `Error: ${err.message}`,
          timestamp: new Date().toISOString()
        }]
      });
    } catch {}

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
  const result = await runE2ETest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
