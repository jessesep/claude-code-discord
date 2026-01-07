import { Client, GatewayIntentBits, ChannelType } from "npm:discord.js@14";

const DISCORD_TOKEN = Deno.env.get("DISCORD_TOKEN") || "";
const SERVER_ID = "1457712106399862786";
const CATEGORY_NAME = "claude-code-discord.git";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  
  try {
    const guild = await client.guilds.fetch(SERVER_ID);
    const channels = await guild.channels.fetch();
    
    // Find all categories with the target name
    const duplicateCategories = channels.filter(ch => 
      ch?.type === ChannelType.GuildCategory && 
      ch?.name.includes(CATEGORY_NAME)
    );
    
    console.log(`\n📁 Found ${duplicateCategories.size} categories named "${CATEGORY_NAME}"\n`);
    
    if (duplicateCategories.size <= 1) {
      console.log("✅ No duplicates to clean up");
      await client.destroy();
      Deno.exit(0);
    }
    
    // Sort by creation date (keep the newest)
    const sorted = Array.from(duplicateCategories.values())
      .sort((a, b) => (b?.createdTimestamp || 0) - (a?.createdTimestamp || 0));
    
    const keepCategory = sorted[0];
    const toDelete = sorted.slice(1);
    
    console.log(`✅ Keeping: ${keepCategory?.name} (ID: ${keepCategory?.id})`);
    console.log(`   Created: ${keepCategory?.createdAt}\n`);
    console.log(`🗑️  Deleting ${toDelete.length} duplicate categories:\n`);
    
    for (const category of toDelete) {
      if (!category) continue;
      
      console.log(`  - ${category.name} (ID: ${category.id})`);
      console.log(`    Created: ${category.createdAt}`);
      
      // Delete all channels in this category first
      const categoryChannels = channels.filter(ch => ch?.parentId === category.id);
      for (const [, ch] of categoryChannels) {
        if (ch) {
          console.log(`    Deleting channel: #${ch.name}`);
          await ch.delete();
        }
      }
      
      // Delete the category
      await category.delete();
      console.log(`    ✅ Deleted category\n`);
    }
    
    console.log("✅ Cleanup complete!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  await client.destroy();
  Deno.exit(0);
});

await client.login(DISCORD_TOKEN);
