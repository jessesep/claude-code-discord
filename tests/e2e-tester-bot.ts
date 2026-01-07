/**
 * one agent discord - E2E Tester Bot
 * 
 * Basic end-to-end test that validates core agent functionality.
 * Uses the #e2e-basic testing channel (not the main channel).
 */

import { 
  createTestContext, 
  spawnAgent, 
  cleanupTestContext,
  isFinalResponse,
  waitForResult,
  buildAgentPrompt,
} from './e2e-utils.ts';

async function runE2ETest() {
  console.log('🧪 Starting E2E Tester Bot Suite...');
  console.log('   Using dedicated testing channel (not main)\n');
  
  // Create context for e2e-basic channel
  const ctx = await createTestContext('e2e-basic');
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name} (${ctx.channelType})`);

  // Announce startup to Discord
  await ctx.channel.send({
    embeds: [{
      color: 0x9b59b6,
      title: "🧪 E2E Test Suite Active",
      description: `Testing bot **${ctx.tester.user?.tag}** is now online and initiating scenarios.`,
      fields: [
        { name: "📂 Channel", value: `#${ctx.channel.name}`, inline: true },
        { name: "🏷️ Type", value: ctx.channelType, inline: true },
        { name: "🤖 Mode", value: "Budget (Gemini 3 Flash)", inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  });

  const timestamp = Date.now();
  const filename = `e2e_test_${timestamp}.txt`;
  const expectedContent = "E2E TEST PASSED";
  
  try {
    // Use the new spawnAgent helper
    const result = await spawnAgent(
      ctx,
      'cursor-coder',
      `Create a file named "${filename}" with the text "${expectedContent}" and then show me the contents of that file.`,
      { timeout: 120000, useBudget: true }
    );

    if (!result.success) {
      throw new Error(result.error || 'Test failed');
    }

    console.log(`✅ Agent finished in ${result.duration}ms. Verifying file: ${filename}`);
    
    const fileContent = await Deno.readTextFile(filename);
    if (fileContent.trim() !== expectedContent) {
      throw new Error(`File content mismatch. Got: "${fileContent}", Expected: "${expectedContent}"`);
    }
    
    console.log(`✅ File verification passed.`);
    
    // Report final success to Discord
    await ctx.channel.send({
      embeds: [{
        color: 0x00ff00,
        title: "✨ E2E Test Passed",
        description: "Basic file creation and verification sequence completed successfully.",
        fields: [
          { name: "⏱️ Duration", value: `${result.duration}ms`, inline: true },
          { name: "📁 File", value: filename, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    });

    return { success: true, message: 'Basic file creation test passed', duration: result.duration };

  } catch (err) {
    // Report error to Discord
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
    await cleanupTestContext(ctx);
  }
}

if (import.meta.main) {
  const result = await runE2ETest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  if (result.duration) {
    console.log(`Duration: ${result.duration}ms`);
  }
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
