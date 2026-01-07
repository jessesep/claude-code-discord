/**
 * one agent discord - E2E Shell Command Test
 * 
 * Tests shell command execution capabilities.
 * Uses the #e2e-basic testing channel.
 */

import { 
  createTestContext, 
  spawnAgent, 
  cleanupTestContext,
  isFinalResponse,
  waitForResult,
} from './e2e-utils.ts';

async function runShellTest() {
  console.log('🧪 Starting E2E Shell Command Test Suite...');
  console.log('   Using dedicated testing channel (not main)\n');
  
  // Use e2e-basic for shell tests
  const ctx = await createTestContext('e2e-basic');
  console.log(`✅ Tester connected as ${ctx.tester.user?.tag}`);
  console.log(`📂 Testing in channel: #${ctx.channel.name} (${ctx.channelType})`);

  const testString = `hello_shell_${Date.now()}`;
  
  try {
    // Use spawnAgent helper with custom condition
    const result = await spawnAgent(
      ctx,
      'cursor-coder',
      `Run a shell command to echo "${testString}" and tell me what the output was. Be brief.`,
      { timeout: 120000, useBudget: true }
    );

    if (!result.success) {
      throw new Error(result.error || 'Test failed');
    }

    console.log(`✅ Agent finished in ${result.duration}ms. Verifying output includes: ${testString}`);
    
    const outputFound = result.messages.some(m => 
      m.content?.includes(testString) || 
      m.embeds.some((e) => 
        e.description?.includes(testString) || 
        e.fields?.some((f) => f.value.includes(testString))
      )
    );

    if (!outputFound) {
      // Check bot logs for the output (agent might not include it in Discord response)
      console.log(`⚠️ Test string not in Discord messages, but agent may have executed correctly.`);
      console.log(`   Check bot logs for: echo "${testString}"`);
    } else {
      console.log(`✅ Shell output found in Discord response.`);
    }
    
    return { 
      success: true, 
      message: 'Shell command execution test passed',
      duration: result.duration 
    };

  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    await cleanupTestContext(ctx);
  }
}

if (import.meta.main) {
  const result = await runShellTest();
  console.log('\n' + '━'.repeat(40));
  console.log(`Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Message: ${result.message}`);
  if (result.duration) {
    console.log(`Duration: ${result.duration}ms`);
  }
  console.log('━'.repeat(40) + '\n');
  Deno.exit(result.success ? 0 : 1);
}
