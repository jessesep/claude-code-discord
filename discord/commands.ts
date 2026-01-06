
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { PREDEFINED_AGENTS, chatWithAgent, getActiveSession, endAgentSession, startAgentSession } from "../agent/index.ts";
import { InteractionContext } from "./types.ts";

export async function getAgentCommand() {
    const agentNames = Object.keys(PREDEFINED_AGENTS).map(key => ({ name: PREDEFINED_AGENTS[key].name, value: key }));

    const data = new SlashCommandBuilder()
        .setName("agent")
        .setDescription("Interact with AI agents")
        .addStringOption(option =>
            option.setName("action")
                .setDescription("Action to perform")
                .setRequired(true)
                .addChoices(
                    { name: "Chat", value: "chat" },
                    { name: "Start Session", value: "start" },
                    { name: "End Session", value: "end" },
                    { name: "List Agents", value: "list" },
                    { name: "Status", value: "status" }
                )
        )
        .addStringOption(option =>
            option.setName("message")
                .setDescription("Message to send to the agent (required for chat)")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("agent_name")
                .setDescription("Specific agent to target")
                .setRequired(false)
                .addChoices(...agentNames)
        );

    return {
        data,
        async execute(ctx: InteractionContext) {
            const action = ctx.getString("action", true);
            const message = ctx.getString("message");
            let agentName = ctx.getString("agent_name");
            const userId = ctx.user.id;
            const channelId = ctx.channelId;

            if (!channelId) return;

            // Handle Actions
            if (action === "list") {
                const embed = {
                    color: 0x0099ff,
                    title: "🤖 Available Agents",
                    fields: Object.entries(PREDEFINED_AGENTS).map(([key, agent]) => ({
                        name: agent.name,
                        value: `${agent.description}\nModel: \`${agent.model}\``,
                        inline: false
                    }))
                };
                await ctx.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            if (action === "status") {
                const session = getActiveSession(userId, channelId);
                if (session) {
                    await ctx.reply({
                        content: `Define active session: **${PREDEFINED_AGENTS[session.agentName].name}**`,
                        ephemeral: true
                    });
                } else {
                    await ctx.reply({ content: "No active agent session.", ephemeral: true });
                }
                return;
            }

            if (action === "start") {
                if (!agentName) {
                    await ctx.reply({ content: "Please specify an `agent_name` to start.", ephemeral: true });
                    return;
                }
                startAgentSession(userId, channelId, agentName);
                await ctx.reply({ content: `✅ Started session with **${PREDEFINED_AGENTS[agentName].name}**. You can now chat normally!`, ephemeral: false });
                return;
            }

            if (action === "end") {
                endAgentSession(userId, channelId);
                await ctx.reply({ content: "🛑 Session ended.", ephemeral: false });
                return;
            }

            if (action === "chat") {
                if (!message) {
                    await ctx.reply({ content: "Please provide a `message`.", ephemeral: true });
                    return;
                }

                // Defer because LLM is slow
                await ctx.deferReply();

                // Dependencies wrapper for streaming (mocked for now in this simple implementation or passed if complex)
                // Ideally main.ts passes real deps, but here we can just pass a simple callback adapter if needed
                // But chatWithAgent expects 'deps' as last arg.
                // We'll trust chatWithAgent to handle it or we pass a minimal one.

                // Construct deps for real Discord messaging
                // In real main.ts we didn't pass deps to commands? main.ts has dependencies object.
                // We need to access it. But typically commands rely on closure or argument.
                // For now, we'll implement a basic callback here.

                const deps: any = {
                    workDir: Deno.cwd(),
                    sendClaudeMessages: async (msgs: any[]) => {
                        const content = msgs[0].content;
                        // Send to context - handle chunking if needed
                        await ctx.editReply({ content: content });
                    }
                };

                await chatWithAgent(ctx, message, agentName || undefined, undefined, false, deps);
                return;
            }
        }
    };
}
