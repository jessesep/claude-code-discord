
import { createDiscordBot } from "./bot.ts";
import { PREDEFINED_AGENTS } from "../agent/index.ts";
import { Collection } from "npm:discord.js@14.14.1";
import type { CommandHandlers, ButtonHandlers, BotDependencies } from "./types.ts";
import { getAgentCommand } from "./commands.ts";

// Main Execution
if (import.meta.main) {
    // Load Env (Deno.env is already populated by start-bot.sh export, but we can double check)
    const token = Deno.env.get("DISCORD_TOKEN");
    if (!token) {
        console.error("❌ Error: DISCORD_TOKEN is missing.");
        Deno.exit(1);
    }

    const applicationId = Deno.env.get("DISCORD_APPLICATION_ID") || Deno.env.get("APPLICATION_ID") || "";
    const workDir = Deno.cwd();

    const config = {
        discordToken: token,
        applicationId: applicationId, // Optional for bot, needed for slash reg if separate
        workDir: workDir,
        repoName: "claude-code-discord",
        branchName: "main",
        categoryName: "Claude Agents",
        defaultMentionUserId: Deno.env.get("DEFAULT_MENTION_USER_ID")
    };

    // Setup Handlers
    const commandHandlers: CommandHandlers = new Collection();
    const buttonHandlers: ButtonHandlers = new Collection();

    // Register 'agent' command
    const agentCmd = await getAgentCommand();
    commandHandlers.set(agentCmd.data.name, agentCmd);

    // Setup Dependencies
    const dependencies: BotDependencies = {
        commands: [agentCmd.data],
        botSettings: {
            mentionEnabled: true,
            mentionUserId: null
        }
    };

    try {
        console.log("🚀 Initializing Discord Bot...");
        await createDiscordBot(config, commandHandlers, buttonHandlers, dependencies);
        console.log("✅ Bot logic started.");
    } catch (err) {
        console.error("💥 Fatal Error starting bot:", err);
        Deno.exit(1);
    }
}
