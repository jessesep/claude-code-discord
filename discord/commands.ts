
import { SlashCommandBuilder } from "npm:discord.js@14.14.1";
import { PREDEFINED_AGENTS, AGENT_ALIASES, chatWithAgent, getActiveSession, clearAgentSession, setAgentSession, createAgentHandlers, AgentHandlerDeps } from "../agent/index.ts";
import { InteractionContext } from "./types.ts";
import { splitText, DISCORD_LIMITS } from "./utils.ts";
import { RemoteAgentRegistry } from "../agent/remote-registry.ts";
import { syncRemoteProviders } from "../agent/providers/index.ts";
import { AgentRegistry } from "../agent/registry.ts";

// Store agent handlers (will be initialized by main.ts)
let agentHandlers: ReturnType<typeof createAgentHandlers> | null = null;

export function setAgentHandlers(handlers: ReturnType<typeof createAgentHandlers>) {
    agentHandlers = handlers;
}

/**
 * /agents command for remote agent management
 */
export async function getAgentsCommand() {
    const data = new SlashCommandBuilder()
        .setName("agents")
        .setDescription("Manage AI agents and remote endpoints")
        .addSubcommandGroup(group =>
            group.setName("remote")
                .setDescription("Manage remote agent endpoints")
                .addSubcommand(sub =>
                    sub.setName("add")
                        .setDescription("Add a remote agent endpoint")
                        .addStringOption(opt => opt.setName("name").setDescription("Human name for the remote").setRequired(true))
                        .addStringOption(opt => opt.setName("url").setDescription("URL (e.g. http://192.168.1.50:8081)").setRequired(true))
                        .addStringOption(opt => opt.setName("key").setDescription("API key for authentication").setRequired(false))
                )
                .addSubcommand(sub =>
                    sub.setName("remove")
                        .setDescription("Remove a remote agent endpoint")
                        .addStringOption(opt => opt.setName("id").setDescription("ID of the remote").setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName("list")
                        .setDescription("List all registered remote endpoints")
                )
                .addSubcommand(sub =>
                    sub.setName("health")
                        .setDescription("Check health of all remote endpoints")
                )
        );

    return {
        data,
        async execute(ctx: InteractionContext) {
            const group = ctx.interaction.options.getSubcommandGroup();
            const subcommand = ctx.interaction.options.getSubcommand();
            const registry = RemoteAgentRegistry.getInstance();

            if (group === "remote") {
                if (subcommand === "add") {
                    const name = ctx.getString("name", true);
                    const url = ctx.getString("url", true);
                    const key = ctx.getString("key") || undefined;
                    const id = name.toLowerCase().replace(/\s+/g, '-');

                    await registry.register({
                        id,
                        name,
                        url,
                        apiKey: key,
                        capabilities: [],
                        providers: [],
                        status: 'unknown',
                        lastHealthCheck: new Date()
                    });

                    // Sync providers immediately
                    await syncRemoteProviders();
                    AgentRegistry.getInstance().syncRemoteAgents();
                    
                    await ctx.reply({
                        content: `✅ Registered remote agent endpoint **${name}** (\`${id}\`) at ${url}. Running health check...`,
                        ephemeral: true
                    });

                    // Trigger background health check
                    registry.healthCheck(id).then(online => {
                        console.log(`[RemoteRegistry] Health check for ${id}: ${online ? 'ONLINE' : 'OFFLINE'}`);
                    });
                    return;
                }

                if (subcommand === "remove") {
                    const id = ctx.getString("id", true);
                    const success = await registry.unregister(id);
                    
                    if (success) {
                        AgentRegistry.getInstance().unregisterAgent(`remote-${id}`);
                        await ctx.reply({ content: `✅ Unregistered remote agent endpoint \`${id}\`.`, ephemeral: true });
                    } else {
                        await ctx.reply({ content: `❌ Remote agent endpoint \`${id}\` not found.`, ephemeral: true });
                    }
                    return;
                }

                if (subcommand === "list") {
                    const endpoints = registry.getEndpoints();
                    if (endpoints.length === 0) {
                        await ctx.reply({ content: "No remote agent endpoints registered.", ephemeral: true });
                        return;
                    }

                    const embed = {
                        color: 0x0099ff,
                        title: "🌐 Remote Agent Endpoints",
                        fields: endpoints.map(e => ({
                            name: `${e.status === 'online' ? '🟢' : e.status === 'offline' ? '🔴' : '⚪'} ${e.name} (\`${e.id}\`)`,
                            value: `URL: ${e.url}\nCapabilities: ${e.capabilities.join(', ') || 'None'}\nProviders: ${e.providers.join(', ') || 'None'}\nLast Seen: ${e.lastHealthCheck.toLocaleString()}`,
                            inline: false
                        }))
                    };
                    await ctx.reply({ embeds: [embed], ephemeral: true });
                    return;
                }

                if (subcommand === "health") {
                    await ctx.reply({ content: "⏳ Running health checks on all remote endpoints...", ephemeral: true });
                    await registry.healthCheckAll();
                    await ctx.followUp({ content: "✅ Health checks complete. Use `/agents remote list` to see status.", ephemeral: true });
                    return;
                }
            }
        }
    };
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
                    { name: "List Aliases", value: "aliases" },
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
                        value: `${agent.description}\nID: \`${key}\` | Model: \`${agent.model}\``,
                        inline: false
                    }))
                };
                await ctx.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            if (action === "aliases") {
                const aliasEntries: Record<string, string[]> = {};
                for (const [alias, agentId] of Object.entries(AGENT_ALIASES)) {
                    if (!aliasEntries[agentId]) aliasEntries[agentId] = [];
                    aliasEntries[agentId].push(`@${alias}`);
                }

                const embed = {
                    color: 0x0099ff,
                    title: "🎯 Agent Mentions & Aliases",
                    description: "You can mention agents directly in any message using the `@alias` syntax to bypass the Manager.",
                    fields: Object.entries(aliasEntries).map(([agentId, aliases]) => ({
                        name: PREDEFINED_AGENTS[agentId]?.name || agentId,
                        value: `Aliases: ${aliases.map(a => `\`${a}\``).join(', ')}`,
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
