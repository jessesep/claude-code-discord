#!/usr/bin/env -S deno run --allow-all --allow-run --allow-sys
/**
 * TypeScript-based Bot Restart Script
 * More reliable than shell script, works cross-platform
 */

import { 
  findBotProcesses, 
  findPortProcess, 
  killAllBotProcesses, 
  killProcess,
  waitForTermination 
} from "./util/process-manager.ts";

async function restartBot() {
  console.log("🛑 Stopping bot and server processes...\n");

  // Find all bot processes
  const botProcesses = await findBotProcesses();
  console.log(`Found ${botProcesses.length} bot process(es)`);

  // Find server process (port 8000)
  const serverProcess = await findPortProcess(8000);
  if (serverProcess) {
    console.log(`Found server process on port 8000: PID ${serverProcess.pid}`);
  }

  // Kill all processes gracefully first
  const killed = await killAllBotProcesses(false);
  console.log(`\nAttempted to kill ${killed} process(es) gracefully`);

  // Wait for graceful shutdown
  await waitForTermination(3000);

  // Force kill any remaining processes
  const forceKilled = await killAllBotProcesses(true);
  if (forceKilled > 0) {
    console.log(`Force killed ${forceKilled} remaining process(es)`);
  }

  // Final wait
  await waitForTermination(2000);

  // Verify everything is stopped
  const remaining = await findBotProcesses();
  const remainingServer = await findPortProcess(8000);

  if (remaining.length === 0 && !remainingServer) {
    console.log("✅ All processes stopped successfully\n");
  } else {
    console.log("⚠️  Warning: Some processes may still be running:");
    remaining.forEach(p => console.log(`  - PID ${p.pid}: ${p.command.substring(0, 80)}`));
    if (remainingServer) {
      console.log(`  - Server PID ${remainingServer.pid}`);
    }
  }

  console.log("\n🚀 Starting bot...\n");

  // Check environment variables
  const discordToken = Deno.env.get("DISCORD_TOKEN");
  const applicationId = Deno.env.get("APPLICATION_ID");

  if (!discordToken) {
    console.error("❌ Error: DISCORD_TOKEN is not set");
    console.error("Please set it in .env file or export DISCORD_TOKEN=your_token");
    Deno.exit(1);
  }

  if (!applicationId) {
    console.error("❌ Error: APPLICATION_ID is not set");
    console.error("Please set it in .env file or export APPLICATION_ID=your_app_id");
    Deno.exit(1);
  }

  // Start the bot
  const botCommand = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-all", "index.ts"],
    cwd: Deno.cwd(),
    env: Deno.env.toObject(),
    stdout: "inherit",
    stderr: "inherit",
  });

  const botProcess = botCommand.spawn();
  console.log(`Bot started with PID ${botProcess.pid}`);
  console.log("Press Ctrl+C to stop the bot\n");

  // Wait for the process to complete
  const status = await botProcess.status;
  console.log(`\nBot exited with code ${status.code}`);
  Deno.exit(status.code);
}

// Run if executed directly
if (import.meta.main) {
  restartBot().catch(error => {
    console.error("Failed to restart bot:", error);
    Deno.exit(1);
  });
}
