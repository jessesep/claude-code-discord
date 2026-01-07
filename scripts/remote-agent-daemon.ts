/**
 * Remote Agent Daemon
 * 
 * Runs on a remote machine to receive and execute agent tasks.
 * Usage: deno run --allow-all scripts/remote-agent-daemon.ts --port 8081 --api-key my-secret-key
 */

import { Hono } from "npm:hono@4.0.0";
import { parse } from "https://deno.land/std@0.200.0/flags/mod.ts";
import { executeAgent, AgentProviderRegistry } from "../agent/provider-interface.ts";
import { initializeProviders } from "../agent/providers/index.ts";
import { PREDEFINED_AGENTS } from "../agent/types.ts";

const args = parse(Deno.args);
const port = args.port || 8081;
const apiKey = args['api-key'] || Deno.env.get("REMOTE_AGENT_API_KEY");

const app = new Hono();

// Initialize local providers
await initializeProviders();

// Auth middleware
app.use("*", async (c, next) => {
  if (apiKey) {
    const requestKey = c.req.header("X-API-Key");
    if (requestKey !== apiKey) {
      console.warn(`[Daemon] Unauthorized access attempt from ${c.req.header("host")}`);
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  await next();
});

// GET /health - Status check
app.get("/health", async (c) => {
  const availableProviders = await AgentProviderRegistry.getAvailableProviders();
  const providerIds = availableProviders.map(p => p.providerId);
  
  // Detect capabilities
  const capabilities = ['remote-execution'];
  if (providerIds.includes('cursor')) capabilities.push('autonomous-coding');
  if (Deno.env.get("DISPLAY") || Deno.build.os === "darwin") capabilities.push('browser-automation');
  
  return c.json({
    status: "ok",
    machine: Deno.hostname(),
    os: Deno.build.os,
    providers: providerIds,
    capabilities
  });
});

// POST /execute - Task execution
app.post("/execute", async (c) => {
  const body = await c.req.json();
  const { taskId, prompt, agentConfig, options } = body;
  
  console.log(`[Daemon] Executing task ${taskId}: ${prompt.substring(0, 50)}...`);

  // Handle streaming response
  if (options.streaming) {
    return new Response(new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          const config = {
            ...(PREDEFINED_AGENTS[agentConfig.model] || PREDEFINED_AGENTS['ag-coder']),
            ...agentConfig,
            id: `remote-${taskId}`
          };

          const result = await executeAgent(
            config,
            prompt,
            options,
            (chunk) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ output: chunk })}\n\n`));
            }
          );
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', result })}\n\n`));
        } catch (error) {
          console.error(`[Daemon] Task ${taskId} failed:`, error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', error: String(error) })}\n\n`));
        } finally {
          controller.close();
        }
      }
    }), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } else {
    // Non-streaming execution
    try {
      const config = {
        ...(PREDEFINED_AGENTS[agentConfig.model] || PREDEFINED_AGENTS['ag-coder']),
        ...agentConfig,
        id: `remote-${taskId}`
      };

      const result = await executeAgent(config, prompt, options);
      return c.json({ status: 'completed', output: result.response, result });
    } catch (error) {
      console.error(`[Daemon] Task ${taskId} failed:`, error);
      return c.json({ status: 'error', error: String(error) }, 500);
    }
  }
});

console.log(`\n🚀 Remote Agent Daemon starting on port ${port}...`);
if (apiKey) console.log(`🔒 API Key authentication enabled`);
console.log(`Available providers: ${AgentProviderRegistry.getAllProviders().map(p => p.providerId).join(', ')}`);

Deno.serve({ port: Number(port) }, app.fetch);
