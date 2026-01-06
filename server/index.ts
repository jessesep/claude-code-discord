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

        // Webhook Route
        api.post("/webhooks/:id", async (c) => {
            const id = c.req.param("id");
            const body = await c.req.json().catch(() => ({}));

            const settings = this.settingsPersistence.getSettings();
            const hook = settings.webhooks.find(w => w.id === id);

            if (!hook || !hook.enabled) {
                return c.json({ error: "Webhook not found or disabled" }, 404);
            }

            // TODO: Verify secret if strictly required

            console.log(`[Webhook] Triggered ${hook.name} (${id})`, body);

            // Dispatch action (Mock for now)
            return c.json({ success: true, actions: hook.actions });
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
