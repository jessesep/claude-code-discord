import { Client, GatewayIntentBits, TextChannel, EmbedBuilder } from "npm:discord.js@14.14.1";

const DISCORD_TOKEN = Deno.env.get("DISCORD_TOKEN");
const CHANNEL_ID = Deno.env.get("TEST_CHANNEL_ID") || Deno.env.get("LOG_CHANNEL_ID");

if (!DISCORD_TOKEN || !CHANNEL_ID) {
  console.error("❌ DISCORD_TOKEN and CHANNEL_ID (or TEST_CHANNEL_ID) environment variables are required.");
  Deno.exit(1);
}

const title = Deno.args[0] || "Notification";
const message = Deno.args[1] || "";
const color = parseInt(Deno.args[2] || "0x00ff00", 16);

async function notify() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  await client.login(DISCORD_TOKEN);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID!);
    if (channel && channel instanceof TextChannel) {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(message)
        .setColor(color)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log(`✅ Notification sent to #${channel.name}`);
    } else {
      console.error(`❌ Could not find text channel with ID: ${CHANNEL_ID}`);
    }
  } catch (err) {
    console.error(`❌ Error sending notification: ${err.message}`);
  } finally {
    client.destroy();
  }
}

if (import.meta.main) {
  notify().catch(console.error);
}
