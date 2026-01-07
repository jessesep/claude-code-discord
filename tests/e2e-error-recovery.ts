/**
 * one agent discord - E2E Error Recovery Test
 * 
 * Tests error handling and recovery capabilities.
 * Uses the #e2e-error-recovery testing channel.
 */

import { 
  createTestContext, 
  cleanupTestContext,
  waitForResult,
  hasError,
  buildAgentPrompt,
  ONE_BOT_ID,
} from './e2e-utils.ts';

async function runErrorRecoveryTest() {
  console.log('🧪 Starting E2E Error Recovery Test Suite...');
  console.log('   Using dedicated testing channel\n');
  
  const ctx = await createTestContext('e2e-error-recovery');
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name} (${ctx.channelType})`);

  try {
    // Step 1: Trigger an error
    const nonExistentFile = `non_existent_${Date.now()}.txt`;
    console.log(`📤 Step 1: Triggering error by reading ${nonExistentFile}...`);
    
    const errorPrompt = buildAgentPrompt({
      agent: 'cursor-coder',
      task: `Read the file "${nonExistentFile}" and show me its contents.`,
      useBudget: true
    });
    await ctx.channel.send(errorPrompt);

    console.log(`⏳ Waiting for error response...`);
    const errorResult = await waitForResult(ctx, 120000, hasError);

    if (!errorResult.success) {
      throw new Error(`Expected error response but got none: ${errorResult.error}`);
    }
    console.log('✅ Error detected as expected.');

    // Step 2: Recovery
    console.log('📤 Step 2: Sending recovery command...');
    const recoveryPrompt = buildAgentPrompt({
      agent: 'cursor-coder',
      task: `That's fine. Now please just tell me "I AM ALIVE" so I know you recovered.`,
      useBudget: true
    });
    await ctx.channel.send(recoveryPrompt);

    console.log(`⏳ Waiting for recovery confirmation...`);
    const recoveryResult = await waitForResult(ctx, 120000, (msgs) => 
      msgs.some(m => m.author.id === ONE_BOT_ID && 
        (m.content?.toUpperCase().includes('ALIVE') || 
         m.content?.toUpperCase().includes('RECOVERED') ||
         m.embeds.some((e) => 
           e.description?.toUpperCase().includes('ALIVE') || 
           e.description?.toUpperCase().includes('RECOVERED')
         ))
      )
    );

    if (!recoveryResult.success) {
      throw new Error(`Recovery confirmation not received: ${recoveryResult.error}`);
    }

    console.log('✅ Recovery confirmed!');
    return { success: true, message: 'Error recovery test passed' };

  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    await cleanupTestContext(ctx);
  }
}

if (import.meta.main) {
  const result = await runErrorRecoveryTest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
