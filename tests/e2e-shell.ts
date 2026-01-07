import { setupTester, waitForResult, isFinalResponse, ONE_BOT_ID } from './e2e-utils.ts';

async function runShellTest() {
  console.log('🧪 Starting E2E Shell Command Test Suite...');
  
  const ctx = await setupTester();
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name}`);

  const testString = `hello_shell_${Date.now()}`;
  const testPrompt = `<@${ONE_BOT_ID}> using cursor-coder, Run a shell command to echo "${testString}" and tell me what the output was.`;
  
  try {
    console.log(`📤 Sending command: "${testPrompt}"`);
    await ctx.channel.send(testPrompt);

    console.log(`⏳ Waiting for agent to complete shell task...`);
    const result = await waitForResult(ctx, 120000, (msgs) => 
      isFinalResponse(msgs) || msgs.some(m => m.content.includes(testString) || m.embeds.some((e: any) => e.description?.includes(testString)))
    );

    if (!result.success) {
      throw new Error(result.error || 'Test failed');
    }

    console.log(`✅ Agent finished. Verifying output includes: ${testString}`);
    
    const outputFound = result.messages.some(m => 
      m.content.includes(testString) || 
      m.embeds.some((e: any) => e.description?.includes(testString) || e.fields?.some((f: any) => f.value.includes(testString)))
    );

    if (!outputFound) {
      throw new Error(`Test string "${testString}" not found in agent responses.`);
    }
    
    console.log(`✅ Shell output verification passed.`);
    return { success: true, message: 'Shell command execution test passed' };

  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    ctx.tester.destroy();
  }
}

if (import.meta.main) {
  const result = await runShellTest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
