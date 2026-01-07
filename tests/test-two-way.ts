/**
 * Two-Way Testing: Tester Bot <-> claude-code-discord Bot
 *
 * This script:
 * 1. Connects a tester bot to Discord
 * 2. Sends a test message to trigger the claude-code-discord agent
 * 3. Monitors the full agent conversation response
 */

import { Client, GatewayIntentBits, TextChannel } from 'npm:discord.js@14';

const TEST_BOT_TOKEN = Deno.env.get('TEST_BOT_TOKEN') || '';
const CHANNEL_ID = '1457712107016552523'; // #main channel
const TIMEOUT = 30000; // 30 seconds

interface BotMessage {
  timestamp: Date;
  authorId: string;
  authorName: string;
  content: string;
  embeds: number;
}

async function runTwoWayTest() {
  console.log('🧪 Starting Two-Way Bot Test\n');
  console.log('━'.repeat(60));

  const testerBot = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const responses: BotMessage[] = [];
  let testMessageId = '';

  // Set up message listener before connecting
  testerBot.on('messageCreate', (message) => {
    if (message.channelId !== CHANNEL_ID) return;
    if (message.id === testMessageId) return; // Skip our own test message

    const botMsg: BotMessage = {
      timestamp: new Date(message.createdTimestamp),
      authorId: message.author.id,
      authorName: message.author.tag,
      content: message.content,
      embeds: message.embeds.length,
    };

    responses.push(botMsg);

    console.log(`\n📨 Response received:`);
    console.log(`   From: ${botMsg.authorName}`);
    console.log(`   Time: ${botMsg.timestamp.toISOString()}`);
    console.log(`   Content: ${botMsg.content.substring(0, 100)}${botMsg.content.length > 100 ? '...' : ''}`);
    if (botMsg.embeds > 0) {
      console.log(`   Embeds: ${botMsg.embeds}`);
    }
  });

  // Connect tester bot
  await new Promise<void>((resolve, reject) => {
    testerBot.once('ready', () => {
      console.log(`✅ Tester bot connected: ${testerBot.user?.tag}`);
      resolve();
    });
    testerBot.once('error', reject);
    testerBot.login(TEST_BOT_TOKEN).catch(reject);
  });

  try {
    // Get the channel
    const channel = await testerBot.channels.fetch(CHANNEL_ID) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      throw new Error('Channel not found or not text-based');
    }

    console.log(`✅ Found channel: #${channel.name}\n`);
    console.log('━'.repeat(60));

    // Send test message
    const testPrompt = 'Create a simple hello.py script that prints "Hello from one agent!" and test it';
    console.log(`\n📤 Sending test message to claude-code-discord bot:`);
    console.log(`   "${testPrompt}"\n`);

    const sentMessage = await channel.send(testPrompt);
    testMessageId = sentMessage.id;

    console.log('⏳ Waiting for claude-code-discord bot to respond...');
    console.log(`   (Timeout: ${TIMEOUT/1000}s)\n`);

    // Wait for responses
    await new Promise(resolve => setTimeout(resolve, TIMEOUT));

    // Summary
    console.log('\n' + '━'.repeat(60));
    console.log('📊 TEST SUMMARY\n');
    console.log(`Total responses: ${responses.length}`);

    if (responses.length > 0) {
      console.log('\n✅ Two-way communication successful!\n');
      console.log('Response breakdown:');
      const byAuthor = responses.reduce((acc, r) => {
        acc[r.authorName] = (acc[r.authorName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      for (const [author, count] of Object.entries(byAuthor)) {
        console.log(`   ${author}: ${count} message(s)`);
      }
    } else {
      console.log('\n❌ No responses received from claude-code-discord bot');
      console.log('   Possible issues:');
      console.log('   - Bot is not running');
      console.log('   - Bot is not monitoring this channel');
      console.log('   - Bot encountered an error');
    }

    console.log('\n' + '━'.repeat(60));

  } finally {
    await testerBot.destroy();
    console.log('\n👋 Tester bot disconnected');
  }
}

if (import.meta.main) {
  try {
    await runTwoWayTest();
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    Deno.exit(1);
  }
}
