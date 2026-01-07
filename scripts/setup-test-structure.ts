import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from "npm:discord.js@14.14.1";

const DISCORD_TOKEN = Deno.env.get("DISCORD_TOKEN");
const GUILD_ID = Deno.env.get("GUILD_ID");

if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error("❌ DISCORD_TOKEN and GUILD_ID environment variables are required.");
  Deno.exit(1);
}

async function setupTestingStructure() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  await client.login(DISCORD_TOKEN);

  const guild = await client.guilds.fetch(GUILD_ID);
  if (!guild) {
    console.error(`❌ Could not find guild with ID: ${GUILD_ID}`);
    Deno.exit(1);
  }

  const CATEGORY_NAME = "[TESTING] one agent Bot";
  const CHANNELS = [
    { name: "e2e-basic", topic: "Basic E2E command tests" },
    { name: "e2e-multi-file", topic: "Tests for multi-file operations" },
    { name: "e2e-error-recovery", topic: "Tests for error recovery and persistence" },
    { name: "e2e-orchestration", topic: "Tests for agent orchestration and swarm" },
  ];

  console.log(`🚀 Setting up testing structure in guild: ${guild.name}`);

  // 1. Check for existing category
  const allChannels = await guild.channels.fetch();
  let category = allChannels.find(
    (c: any) => c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME
  );

  if (!category) {
    console.log(`📂 Creating category: ${CATEGORY_NAME}`);
    category = await guild.channels.create({
      name: CATEGORY_NAME,
      type: ChannelType.GuildCategory,
    });
  } else {
    console.log(`✅ Category already exists: ${CATEGORY_NAME}`);
  }

  // 2. Create channels
  for (const chanConfig of CHANNELS) {
    const existing = allChannels.find(
      (c: any) => c.type === ChannelType.GuildText && c.name === chanConfig.name && c.parentId === category!.id
    );

    if (!existing) {
      console.log(`📝 Creating channel: #${chanConfig.name}`);
      await guild.channels.create({
        name: chanConfig.name,
        type: ChannelType.GuildText,
        parent: category!.id,
        topic: chanConfig.topic,
      });
    } else {
      console.log(`✅ Channel already exists: #${chanConfig.name}`);
    }
  }

  console.log("\n✨ Testing structure setup complete!");
  client.destroy();
}

if (import.meta.main) {
  setupTestingStructure().catch(console.error);
}
