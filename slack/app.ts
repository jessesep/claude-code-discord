import { App } from "@slack/bolt";

/**
 * Slack App Initialization
 */
export function createSlackApp() {
  const botToken = Deno.env.get("SLACK_BOT_TOKEN");
  const signingSecret = Deno.env.get("SLACK_SIGNING_SECRET");
  const appToken = Deno.env.get("SLACK_APP_TOKEN");

  if (!botToken || !signingSecret || !appToken) {
    console.error("❌ Slack configuration missing. Ensure SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, and SLACK_APP_TOKEN are set.");
    return null;
  }

  const app = new App({
    token: botToken,
    signingSecret: signingSecret,
    socketMode: true,
    appToken: appToken,
  });

  return app;
}
