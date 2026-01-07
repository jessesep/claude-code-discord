/**
 * Two-Way Slash Command Testing
 *
 * Uses Discord REST API to trigger slash commands and monitor responses
 */

import { Client, GatewayIntentBits, TextChannel, ChannelType } from 'npm:discord.js@14';
import { REST } from 'npm:@discordjs/rest@2';
import { Routes } from 'npm:discord-api-types@0.37/v10';

const TEST_BOT_TOKEN = Deno.env.get('TEST_BOT_TOKEN') || '';
const CLAUDE_BOT_ID = '1457705423137275914'; // claude-code-discord bot
const CHANNEL_ID = '1457712107016552523'; // #main channel
const GUILD_ID = '1457712106399862786';

interface ResponseMessage {
  timestamp: Date;
  authorName: string;
  content: string;
  embeds: number;
}

async function testSlashCommandWorkflow() {
  console.log('🧪 Testing Slash Command Workflow\n');
  console.log('━'.repeat(70));

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  const responses: ResponseMessage[] = [];
  let startTime: number;

  // Monitor for responses
  client.on('messageCreate', (message) => {
    if (message.channelId !== CHANNEL_ID) return;
    if (message.author.bot && message.author.id === CLAUDE_BOT_ID) {
      const response: ResponseMessage = {
        timestamp: new Date(message.createdTimestamp),
        authorName: message.author.tag,
        content: message.content,
        embeds: message.embeds.length,
      };

      responses.push(response);

      const elapsed = Date.now() - startTime;
      console.log(`\n📨 Response ${responses.length} (${elapsed}ms):`);
      console.log(`   From: ${response.authorName}`);
      console.log(`   Content: ${response.content.substring(0, 80)}${response.content.length > 80 ? '...' : ''}`);
      if (response.embeds > 0) {
        console.log(`   Embeds: ${response.embeds}`);
        message.embeds.forEach((embed, i) => {
          if (embed.title) console.log(`     [${i+1}] ${embed.title}`);
        });
      }
    }
  });

  // Connect monitoring bot
  await new Promise<void>((resolve, reject) => {
    client.once('ready', () => {
      console.log(`✅ Monitor bot connected: ${client.user?.tag}`);
      resolve();
    });
    client.login(TEST_BOT_TOKEN).catch(reject);
  });

  try {
    const channel = await client.channels.fetch(CHANNEL_ID) as TextChannel;
    console.log(`✅ Monitoring channel: #${channel.name}\n`);
    console.log('━'.repeat(70));

    // Get slash commands from claude-code-discord bot
    const rest = new REST({ version: '10' }).setToken(TEST_BOT_TOKEN);

    console.log('\n📋 Fetching available slash commands...');
    const commands: any = await rest.get(
      Routes.applicationGuildCommands(CLAUDE_BOT_ID, GUILD_ID)
    );

    const claudeCommand = commands.find((cmd: any) => cmd.name === 'claude');

    if (!claudeCommand) {
      console.log('❌ /claude command not found');
      console.log('Available commands:', commands.map((c: any) => `/${c.name}`).join(', '));
      return;
    }

    console.log(`✅ Found /claude command (ID: ${claudeCommand.id})`);
    console.log(`   Options: ${claudeCommand.options?.map((o: any) => o.name).join(', ')}\n`);

    // Manual test instructions
    console.log('━'.repeat(70));
    console.log('MANUAL TEST REQUIRED');
    console.log('━'.repeat(70));
    console.log('\nBots cannot programmatically trigger slash commands.');
    console.log('Please perform these steps:\n');
    console.log('1. Open Discord');
    console.log('2. Navigate to: claude-code-discord.git > #main');
    console.log('3. Type: /claude');
    console.log('4. Prompt: create a simple hello.py script and run it');
    console.log('5. Press Enter\n');
    console.log('This monitor will display all bot responses...\n');
    console.log('Monitoring for 120 seconds (press Ctrl+C to stop early)\n');
    console.log('━'.repeat(70));

    startTime = Date.now();

    // Wait and monitor
    await new Promise(resolve => setTimeout(resolve, 120000));

    // Summary
    console.log('\n' + '━'.repeat(70));
    console.log('📊 TEST SUMMARY\n');
    console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`Total responses: ${responses.length}\n`);

    if (responses.length > 0) {
      console.log('✅ Bot is responsive!\n');
      console.log('Response timeline:');
      responses.forEach((r, i) => {
        const elapsed = r.timestamp.getTime() - startTime;
        console.log(`   ${i+1}. [+${elapsed}ms] ${r.embeds} embed(s), ${r.content.length} chars`);
      });
    } else {
      console.log('⚠️  No responses received');
      console.log('   Did you trigger the slash command?');
    }

    console.log('\n' + '━'.repeat(70));

  } finally {
    await client.destroy();
    console.log('\n👋 Monitor disconnected');
  }
}

if (import.meta.main) {
  try {
    await testSlashCommandWorkflow();
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    Deno.exit(1);
  }
}
