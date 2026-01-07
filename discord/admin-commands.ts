
import { SlashCommandBuilder, PermissionFlagsBits } from "npm:discord.js@14.14.1";
import { InteractionContext } from "./types.ts";

export async function getAdminCommands() {
    const restartCmd = new SlashCommandBuilder()
        .setName("restart")
        .setDescription("Restart the bot and/or server")
        .addStringOption(option =>
            option.setName("target")
                .setDescription("What to restart")
                .setRequired(true)
                .addChoices(
                    { name: "Bot", value: "bot" },
                    { name: "Full System", value: "all" }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

    return [
        {
            data: restartCmd,
            async execute(ctx: InteractionContext) {
                const target = ctx.getString("target", true);
                const userId = ctx.user.id;

                await ctx.reply({ 
                    content: `🔄 Restarting **${target}**... (Requested by <@${userId}>)`,
                    ephemeral: false 
                });

                console.log(`[Admin] Restart requested for ${target} by ${ctx.user.tag}`);

                // Give Discord a moment to send the reply
                setTimeout(async () => {
                    try {
                        if (target === "bot" || target === "all") {
                            console.log("🚀 Executing restart-bot.sh in background...");
                            
                            // Use a shell to run nohup in the background. 
                            // Explicitly call bash to avoid permission issues.
                            const command = new Deno.Command("bash", {
                                args: ["-c", "nohup bash ./restart-bot.sh > bot_restart.log 2>&1 &"],
                                stdout: "inherit",
                                stderr: "inherit"
                            });
                            
                            command.spawn();
                            
                            console.log("Restart script backgrounded. Bot will exit shortly.");
                            
                            // Exit the bot gracefully to allow the restart script to take over
                            setTimeout(() => {
                                console.log("👋 Shutting down...");
                                Deno.exit(0);
                            }, 1000);
                        }
                    } catch (error) {
                        console.error("Failed to execute restart script:", error);
                    }
                }, 1000);
            }
        }
    ];
}
