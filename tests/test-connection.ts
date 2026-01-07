import { Client, GatewayIntentBits } from 'npm:discord.js@14';
const TEST_BOT_TOKEN = Deno.env.get('TEST_BOT_TOKEN') || '';
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});
client.once('ready', () => {
  console.log('✅ Connection successful without MessageContent intent!');
  client.destroy();
  Deno.exit(0);
});
client.login(TEST_BOT_TOKEN).catch(err => {
  console.error('❌ Connection failed:', err.message);
  Deno.exit(1);
});
