/**
 * Fully Automated Two-Way Testing
 *
 * Tester Bot -> @mentions one bot -> Agent Responds
 */

import { Client, GatewayIntentBits, TextChannel } from 'npm:discord.js@14';

const TEST_BOT_TOKEN = Deno.env.get('TEST_BOT_TOKEN') || '';
const ONE_BOT_ID = '1457705423137275914'; // Master-Remote#8819
const CHANNEL_ID = '1457712107016552523'; // #main
const TEST_TIMEOUT = 45000; // 45 seconds for agent to respond

interface TestResponse {
  timestamp: Date;
  author: string;
  content: string;
  embedCount: number;
  embedTitles: string[];
}

async function runAutomatedTest() {
  console.log('🤖 Automated Two-Way Bot Test\n');
  console.log('━'.repeat(70));
  console.log('Tester Bot -> @one bot -> Agent Response\n');

  const testBot = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const responses: TestResponse[] = [];
  let testMsgId = '';
  const startTime = Date.now();

  // Listen for all responses
  testBot.on('messageCreate', (msg) => {
    if (msg.channelId !== CHANNEL_ID) return;
    if (msg.id === testMsgId) return; // Skip our own message
    if (!msg.author.bot) return; // Only bot responses

    const response: TestResponse = {
      timestamp: new Date(msg.createdTimestamp),
      author: msg.author.tag,
      content: msg.content,
      embedCount: msg.embeds.length,
      embedTitles: msg.embeds.map(e => e.title || '(no title)'),
    };

    responses.push(response);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[+${elapsed}s] 📨 Response #${responses.length}`);
    console.log(`  From: ${response.author}`);
    if (response.content) {
      console.log(`  Text: ${response.content.substring(0, 80)}${response.content.length > 80 ? '...' : ''}`);
    }
    if (response.embedCount > 0) {
      console.log(`  Embeds: ${response.embedCount}`);
      response.embedTitles.forEach((title, i) => {
        console.log(`    ${i+1}. ${title}`);
      });
    }
  });

  // Connect test bot
  await new Promise<void>((resolve, reject) => {
    testBot.once('ready', () => {
      console.log(`✅ Test bot connected: ${testBot.user?.tag}\n`);
      resolve();
    });
    testBot.login(TEST_BOT_TOKEN).catch(reject);
  });

  try {
    const channel = await testBot.channels.fetch(CHANNEL_ID) as TextChannel;
    console.log(`✅ Channel: #${channel.name}\n`);
    console.log('━'.repeat(70));

    // Test 1: Simple script creation
    console.log('\n📤 TEST 1: Sending mention with simple task...');
    const testPrompt = `<@${ONE_BOT_ID}> create a file called hello.py that prints "Hello from one agent!" and show me the contents`;

    console.log(`   Prompt: ${testPrompt.substring(0, 70)}...`);

    const sentMsg = await channel.send(testPrompt);
    testMsgId = sentMsg.id;

    console.log(`✅ Message sent (ID: ${testMsgId})`);
    console.log(`\n⏳ Waiting ${TEST_TIMEOUT/1000}s for agent responses...\n`);

    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, TEST_TIMEOUT));

    // Summary
    console.log('\n' + '━'.repeat(70));
    console.log('📊 TEST RESULTS\n');

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Duration: ${duration}s`);
    console.log(`Total responses: ${responses.length}\n`);

    if (responses.length === 0) {
      console.log('❌ FAILED: No responses received');
      console.log('\nPossible issues:');
      console.log('  - Bot not monitoring #main channel');
      console.log('  - Message handling not working');
      console.log('  - Provider CLI not authenticated');
      console.log('\nCheck bot logs:');
      console.log('  /tmp/one-agent/-Users-jessesep/tasks/b408e18.output\n');
      Deno.exit(1);
    }

    // Analyze responses
    console.log('✅ SUCCESS: Bot responded!\n');
    console.log('Response breakdown:');

    const agentResponses = responses.filter(r => r.author.includes('Master-Remote'));
    console.log(`  One bot: ${agentResponses.length} message(s)`);
    console.log(`  Other bots: ${responses.length - agentResponses.length} message(s)\n`);

    console.log('Timeline:');
    responses.forEach((r, i) => {
      const elapsed = ((r.timestamp.getTime() - startTime) / 1000).toFixed(1);
      console.log(`  [+${elapsed}s] ${r.author}: ${r.embedCount} embed(s), ${r.content.length} chars`);
    });

    // Verify agent actually executed
    const hasToolOutput = responses.some(r =>
      r.embedTitles.some(t =>
        t.includes('Tool') || t.includes('File') || t.includes('Output')
      )
    );

    console.log('\n' + '━'.repeat(70));
    console.log('Agent Execution Check:');
    console.log(`  Tool usage detected: ${hasToolOutput ? '✅ YES' : '❌ NO'}`);
    console.log(`  Response latency: ${duration}s`);
    console.log(`  Message count: ${responses.length}`);

    if (hasToolOutput && responses.length > 0) {
      console.log('\n🎉 FULL TWO-WAY WORKFLOW VERIFIED!');
      console.log('   Tester -> Mention -> one agent -> Tool Usage -> Responses\n');
    } else {
      console.log('\n⚠️  Partial success: responses received but no tool usage detected\n');
    }

    console.log('━'.repeat(70));

  } finally {
    await testBot.destroy();
    console.log('\n👋 Test bot disconnected\n');
  }
}

if (import.meta.main) {
  const botToken = Deno.env.get('TEST_BOT_TOKEN');
  if (!botToken) {
    console.error('❌ TEST_BOT_TOKEN environment variable not set');
    Deno.exit(1);
  }

  try {
    await runAutomatedTest();
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    Deno.exit(1);
  }
}
