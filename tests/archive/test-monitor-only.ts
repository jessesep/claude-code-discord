/**
 * Simple Response Monitor (No Intents Required)
 *
 * Monitors the channel for claude-code-discord bot responses
 * User manually triggers /claude command in Discord
 */

import { Client, GatewayIntentBits } from 'npm:discord.js@14';

const TEST_BOT_TOKEN = Deno.env.get('TEST_BOT_TOKEN') || '';
const CLAUDE_BOT_ID = '1457705423137275914';
const CHANNEL_ID = '1457712107016552523';

async function monitorResponses() {
  console.log('🎯 Claude-Code-Discord Response Monitor\n');
  console.log('━'.repeat(70));

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  let responseCount = 0;
  const startTime = Date.now();

  client.on('messageCreate', (message) => {
    if (message.channelId !== CHANNEL_ID) return;
    if (message.author.id !== CLAUDE_BOT_ID) return;

    responseCount++;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n[${elapsed}s] 📨 Response #${responseCount}`);
    console.log(`├─ Author: ${message.author.tag}`);

    if (message.content) {
      const preview = message.content.substring(0, 100);
      console.log(`├─ Content: ${preview}${message.content.length > 100 ? '...' : ''}`);
      console.log(`├─ Length: ${message.content.length} chars`);
    }

    if (message.embeds.length > 0) {
      console.log(`└─ Embeds: ${message.embeds.length}`);
      message.embeds.forEach((embed, i) => {
        if (embed.title) {
          console.log(`   ${i+1}. ${embed.title}`);
        }
        if (embed.description) {
          const desc = embed.description.substring(0, 60);
          console.log(`      ${desc}${embed.description.length > 60 ? '...' : ''}`);
        }
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    client.once('ready', () => {
      console.log(`✅ Monitor connected: ${client.user?.tag}`);
      console.log(`📡 Watching channel: ${CHANNEL_ID}\n`);
      console.log('━'.repeat(70));
      console.log('⚠️  MANUAL ACTION REQUIRED');
      console.log('━'.repeat(70));
      console.log('\n1. Open Discord');
      console.log('2. Go to: claude-code-discord.git > #main');
      console.log('3. Type: /claude');
      console.log('4. Prompt: create hello.py that prints "Hello Claude!"');
      console.log('5. Press Enter\n');
      console.log('Monitoring... (Press Ctrl+C to stop)\n');
      console.log('━'.repeat(70));
      resolve();
    });
    client.login(TEST_BOT_TOKEN).catch(reject);
  });

  // Keep running until interrupted
  await new Promise(() => {});
}

if (import.meta.main) {
  try {
    await monitorResponses();
  } catch (error) {
    console.error('\n❌ Monitor failed:', error);
    Deno.exit(1);
  }
}
