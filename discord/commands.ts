
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { PREDEFINED_AGENTS, chatWithAgent, getActiveSession, clearAgentSession, setAgentSession, createAgentHandlers, AgentHandlerDeps } from "../agent/index.ts";
import { InteractionContext } from "./types.ts";
import { splitText, DISCORD_LIMITS } from "./utils.ts";

// Store agent handlers (will be initialized by main.ts)
let agentHandlers: ReturnType<typeof createAgentHandlers> | null = null;

export function setAgentHandlers(handlers: ReturnType<typeof createAgentHandlers>) {
    agentHandlers = handlers;
}

export async function getAgentCommand(deps?: AgentHandlerDeps) {
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
        )
        .addBooleanOption(option =>
            option.setName("include_git_context")
                .setDescription("Include git status and diff in the context")
                .setRequired(false)
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
                setAgentSession(userId, channelId, agentName);
                await ctx.reply({ content: `✅ Started session with **${PREDEFINED_AGENTS[agentName].name}**. You can now chat normally!`, ephemeral: false });
                return;
            }

            if (action === "end") {
                clearAgentSession(userId, channelId);
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

                // Use channel context workDir if available, otherwise fall back to current directory
                const effectiveWorkDir = ctx.channelContext?.projectPath || Deno.cwd();
                
                const deps: any = {
                    workDir: effectiveWorkDir,
                    targetUserId: ctx.user.id,
                    sendAgentMessages: ctx.sendAgentMessages
                };

                const includeGit = ctx.getBoolean("include_git_context") || false;
                // Note: chatWithAgent signature needs update to accept includeGit
                // Passing as last arg or part of options if we refactor, but for now append to arg list
                // chatWithAgent(ctx, message, agentName, contextFiles, includeSystemInfo, deps, includeGit)
                // But chatWithAgent def in agent/index.ts is: (ctx, message, agentName, contextFiles, includeSystemInfo, deps)
                // We need to update agent/index.ts first or safely pass it.
                // Let's pass it as a property of deps for now if strictness allows in 'any' cast, OR update signature.
                // Updating signature is cleaner. 
                await chatWithAgent(ctx, message, agentName || undefined, undefined, false, { 
                    ...deps, 
                    includeGit,
                    clientOverride: ctx.clientOverride 
                });
                return;
            }
        },
        handleButton: async (ctx: InteractionContext, customId: string) => {
            // Delegate to agent handlers if available
            if (agentHandlers) {
                await agentHandlers.handleButton(ctx, customId);
            } else if (deps) {
                // Create handlers on the fly if deps provided
                const handlers = createAgentHandlers(deps);
                await handlers.handleButton(ctx, customId);
            } else {
                console.warn(`[AgentCommand] No agent handlers available for button: ${customId}`);
                await ctx.followUp({
                    content: "Agent handlers not initialized. Please restart the bot.",
                    ephemeral: true
                });
            }
        }
    };
}
