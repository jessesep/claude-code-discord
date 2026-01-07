
import { createDiscordBot } from "./bot.ts";
import { PREDEFINED_AGENTS, createAgentHandlers } from "../agent/index.ts";
import { Collection } from "npm:discord.js@14.14.1";
import type { CommandHandlers, ButtonHandlers, BotDependencies } from "./types.ts";
import { getAgentCommand, getAgentsCommand, setAgentHandlers } from "./commands.ts";
import { getAdminCommands } from "./admin-commands.ts";
import { RemoteAgentRegistry } from "../agent/remote-registry.ts";

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
        categoryName: "one agents",
        defaultMentionUserId: Deno.env.get("DEFAULT_MENTION_USER_ID")
    };

    // Setup Handlers
    const commandHandlers: CommandHandlers = new Collection();
    const buttonHandlers: ButtonHandlers = new Collection();

    // Create minimal dependencies for agent handlers
    const agentDeps = {
        workDir: workDir,
        crashHandler: {
            reportCrash: async (module: string, error: Error, context?: string, details?: string) => {
                console.error(`[CrashHandler] ${module}:`, error, context, details);
            }
        },
        sendAgentMessages: async (messages: any[]) => {
            // Will be set up when bot channel is available
            console.log("[Agent] Would send messages:", messages.length);
        },
        sessionManager: null // Will be set up if needed
    };

    // Create agent handlers
    const agentHandlers = createAgentHandlers(agentDeps);

    // Set agent handlers for button handling
    setAgentHandlers(agentHandlers);

    // Register 'agent' command with dependencies
    const agentCmd = await getAgentCommand(agentDeps);
    commandHandlers.set(agentCmd.data.name, agentCmd);

    // Register 'agents' command (plural) for management
    const agentsCmd = await getAgentsCommand();
    commandHandlers.set(agentsCmd.data.name, agentsCmd);

    // Register admin commands
    const adminCmds = await getAdminCommands();
    for (const cmd of adminCmds) {
        commandHandlers.set(cmd.data.name, cmd);
    }

    // Setup Dependencies
    const dependencies: BotDependencies = {
        commands: [agentCmd.data, agentsCmd.data, ...adminCmds.map(c => c.data)],
        botSettings: {
            mentionEnabled: true,
            mentionUserId: null
        }
    };

    try {
        console.log("🚀 Initializing Discord Bot...");
        await createDiscordBot(config, commandHandlers, buttonHandlers, dependencies);
        console.log("✅ Bot logic started.");

        // Initialize remote health checks
        const remoteRegistry = RemoteAgentRegistry.getInstance();
        remoteRegistry.healthCheckAll().then(() => {
            console.log("[RemoteHealth] Initial health checks complete.");
        });
        
        // Setup periodic health checks (every 5 minutes)
        setInterval(async () => {
            console.log("[RemoteHealth] Running periodic health checks...");
            await remoteRegistry.healthCheckAll();
        }, 5 * 60 * 1000);
    } catch (err) {
        console.error("💥 Fatal Error starting bot:", err);
        Deno.exit(1);
    }
}
