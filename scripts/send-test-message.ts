import { Client, GatewayIntentBits } from "npm:discord.js@14";

const DISCORD_TOKEN = Deno.env.get("DISCORD_TOKEN") || "";
const CHANNEL_ID = "1457843581229334621"; // The #main channel from browser URL

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  
  try {
    const channel: any = await client.channels.fetch(CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      await channel.send({
        embeds: [{
          color: 0x00ff00,
          title: "✅ Bot Test",
          description: "claude-code-discord bot is online and can send messages!",
          timestamp: new Date().toISOString(),
        }]
      });
      console.log("✅ Test message sent successfully");
    } else {
      console.error("❌ Channel not found or not text-based");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  await client.destroy();
  Deno.exit(0);
});

await client.login(DISCORD_TOKEN);
