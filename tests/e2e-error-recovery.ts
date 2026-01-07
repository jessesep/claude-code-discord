import { setupTester, waitForResult, hasError, ONE_BOT_ID } from './e2e-utils.ts';

async function runErrorRecoveryTest() {
  console.log('🧪 Starting E2E Error Recovery Test Suite (Refactored)...');
  
  const ctx = await setupTester();
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name}`);

  try {
    // Step 1: Trigger an error
    const nonExistentFile = `non_existent_${Date.now()}.txt`;
    console.log(`📤 Step 1: Triggering error by reading ${nonExistentFile}...`);
    await ctx.channel.send(`<@${ONE_BOT_ID}> using cursor-coder, Please read the file "${nonExistentFile}".`);

    console.log(`⏳ Waiting for error response...`);
    const errorResult = await waitForResult(ctx, 120000, hasError);

    if (!errorResult.success) {
      throw new Error(`Expected error response but got none: ${errorResult.error}`);
    }
    console.log('✅ Error detected as expected.');

    // Step 2: Recovery
    console.log('📤 Step 2: Sending recovery command...');
    await ctx.channel.send(`<@${ONE_BOT_ID}> using cursor-coder, That's fine. Now please just tell me "I AM ALIVE" so I know you recovered.`);

    console.log(`⏳ Waiting for recovery confirmation...`);
    const recoveryResult = await waitForResult(ctx, 120000, (msgs) => 
      msgs.some(m => m.author.id === ONE_BOT_ID && 
        (m.content?.toUpperCase().includes('ALIVE') || 
         m.content?.toUpperCase().includes('RECOVERED') ||
         m.embeds.some((e: any) => 
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
    ctx.tester.destroy();
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
