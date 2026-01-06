import { Hono } from "npm:hono@4.0.0";
import { serveStatic } from "npm:hono@4.0.0/deno";
import { SettingsPersistence } from "../util/settings-persistence.ts";
import { UnifiedBotSettings, WebhookConfig } from "../settings/unified-settings.ts";

export class WebServer {
    private app: Hono;
    private settingsPersistence: SettingsPersistence;
    private port: number;

    constructor(port: number = 8000) {
        this.app = new Hono();
        this.port = port;
        this.settingsPersistence = SettingsPersistence.getInstance();

        this.setupRoutes();
    }

    private setupRoutes() {
        // API Routes
        const api = new Hono();

        // GET /api/status - Health check
        api.get("/status", (c) => {
            return c.json({ status: "ok", uptime: performance.now() / 1000 });
        });

        // GET /api/settings - Read settings
        api.get("/settings", (c) => {
            const settings = this.settingsPersistence.getSettings();
            // Don't leak sensitive data like complete API keys if we don't want to
            return c.json(settings);
        });

        // POST /api/settings - Update settings
        api.post("/settings", async (c) => {
            try {
                const body = await c.req.json();
                // Validate and merge settings
                const currentSettings = this.settingsPersistence.getSettings();
                const newSettings = { ...currentSettings, ...body };

                await this.settingsPersistence.save(newSettings);
                return c.json({ success: true, settings: newSettings });
            } catch (error) {
                return c.json({ success: false, error: String(error) }, 400);
            }
        });

        // MCP Routes
        api.get("/mcp", (c) => {
            // In a real implementation this would fetch from the active MCP manager
            return c.json({ servers: [] });
        });

        // GET /api/agents - List all predefined agents
        api.get("/agents", async (c) => {
            try {
                const { getAgentsForAPI } = await import("../agent/index.ts");
                const agents = getAgentsForAPI();
                return c.json({ agents });
            } catch (error) {
                return c.json({ error: String(error) }, 500);
            }
        });

        // GET /api/sessions - Get active agent sessions with stats
        api.get("/sessions", async (c) => {
            try {
                const { getSessionsForAPI } = await import("../agent/index.ts");
                const data = getSessionsForAPI();
                return c.json(data);
            } catch (error) {
                return c.json({ error: String(error) }, 500);
            }
        });

        // GET /api/logs - Get system logs (simple polling endpoint)
        api.get("/logs", (c) => {
            const limit = parseInt(c.req.query("limit") || "50");
            const since = c.req.query("since");
            
            // For now, return a simple response
            // TODO: Implement actual log buffer from console/file
            const logs = [
                {
                    timestamp: new Date().toISOString(),
                    level: "info",
                    source: "System",
                    message: "[System] Bot initialized on branch main"
                },
                {
                    timestamp: new Date().toISOString(),
                    level: "info",
                    source: "Auth",
                    message: "[Auth] Cursor CLI verified"
                },
                {
                    timestamp: new Date().toISOString(),
                    level: "info",
                    source: "Webhook",
                    message: "[Webhook] Discord Main: OK"
                }
            ];

            return c.json({
                logs: logs.slice(0, limit),
                hasMore: false
            });
        });

        // Webhook Route
        api.post("/webhooks/:id", async (c) => {
            const id = c.req.param("id");
            const body = await c.req.json().catch(() => ({}));

            const settings = this.settingsPersistence.getSettings();
            const hook = settings.webhooks.find((w: any) => w.id === id);

            if (!hook || !hook.enabled) {
                return c.json({ error: "Webhook not found or disabled" }, 404);
            }

            // TODO: Verify secret if strictly required

            console.log(`[Webhook] Triggered ${hook.name} (${id})`, body);

            // Determine agent based on webhook name/type
            const webhookName = hook.name.toLowerCase();
            let agentName = 'ag-coder'; // Default
            
            if (webhookName.includes('cursor')) {
                agentName = 'cursor-coder';
            } else if (webhookName.includes('manager') || webhookName.includes('orchestr')) {
                agentName = 'ag-manager';
            } else if (webhookName.includes('architect')) {
                agentName = 'ag-architect';
            } else if (webhookName.includes('antigravity') || webhookName.includes('gemini')) {
                agentName = 'ag-coder'; // Antigravity coder by default
            }

            // If webhook has userId and channelId, start agent session
            if (body.userId && body.channelId) {
                try {
                    const { setAgentSession } = await import("../agent/index.ts");
                    setAgentSession(body.userId, body.channelId, agentName);
                    console.log(`[Webhook] Started agent session: ${agentName} for user ${body.userId}`);
                } catch (error) {
                    console.error(`[Webhook] Failed to start agent session:`, error);
                }
            }

            // Dispatch action
            return c.json({ 
                success: true, 
                actions: hook.actions,
                agentStarted: agentName,
                message: `Webhook triggered and agent session started: ${agentName}`
            });
        });

        this.app.route("/api", api);

        // Serve Frontend (Dashboard)
        // We will serve a simple HTML file for now
        this.app.get("/*", serveStatic({ root: "./dashboard" }));
    }

    start() {
        console.log(`Starting Web Server on port ${this.port}...`);
        Deno.serve({ port: this.port }, this.app.fetch);
    }
}
