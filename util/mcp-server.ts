import { Server } from "npm:@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "npm:@modelcontextprotocol/sdk/types.js";
import { AgentRegistry } from "../agent/registry.ts";
import { runAgentTask, AgentConfig } from "../agent/index.ts";

/**
 * Bot Management MCP Server
 * Exposes tools for spawning and managing subagents.
 */
const server = new Server(
  {
    name: "bot-manager",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const activeBots = new Map<string, { startTime: Date; task: string }>();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "spawn_bot",
        description: "Spawn a new specialized bot for a specific task",
        inputSchema: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "ID of the agent to spawn (e.g., ag-coder)" },
            task: { type: "string", description: "The task description for the bot" },
            config: {
              type: "object",
              description: "Optional override config for the bot",
              properties: {
                model: { type: "string" },
                temperature: { type: "number" },
                systemPrompt: { type: "string" },
              }
            }
          },
          required: ["agentId", "task"]
        }
      },
      {
        name: "list_active_bots",
        description: "List currently running autonomous bot tasks",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "register_custom_agent",
        description: "Register a new agent configuration at runtime",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            config: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                model: { type: "string" },
                systemPrompt: { type: "string" },
                capabilities: { type: "array", items: { type: "string" } },
                riskLevel: { enum: ["low", "medium", "high"] },
                client: { enum: ["claude", "cursor", "antigravity"] }
              },
              required: ["name", "description", "model", "systemPrompt", "capabilities", "riskLevel"]
            }
          },
          required: ["id", "config"]
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "spawn_bot": {
        const { agentId, task, config } = args as any;
        const registry = AgentRegistry.getInstance();
        const baseAgent = registry.getAgent(agentId);

        if (!baseAgent) {
            return {
                content: [{ type: "text", text: `Error: Agent ${agentId} not found.` }],
                isError: true
            };
        }

        // Apply overrides if provided
        const finalConfig: AgentConfig = { ...baseAgent, ...config };
        const botId = `bot-${Date.now()}`;
        
        activeBots.set(botId, { startTime: new Date(), task });

        // Run task headlessly
        // In a real scenario, this might be async/backgrounded with a promise
        const result = await runAgentTask(agentId, task);
        
        activeBots.delete(botId);

        return {
          content: [
            { type: "text", text: `Bot ${botId} (${agentId}) completed task.\n\nResult:\n${result}` }
          ]
        };
      }

      case "list_active_bots": {
        const list = Array.from(activeBots.entries()).map(([id, info]) => ({
          id,
          startTime: info.startTime.toISOString(),
          task: info.task
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }]
        };
      }

      case "register_custom_agent": {
        const { id, config } = args as any;
        AgentRegistry.getInstance().registerAgent(id, config);
        return {
          content: [{ type: "text", text: `Successfully registered custom agent: ${id}` }]
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
});

/**
 * Start the server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bot Manager MCP server running on stdio");
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Server error:", error);
    Deno.exit(1);
  });
}
