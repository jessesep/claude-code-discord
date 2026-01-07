#!/usr/bin/env -S deno run --allow-net --unstable-net

/// <reference lib="deno.unstable" />

// deno-lint-ignore-file no-explicit-any

/**
 * OSC Live Test Tool
 * 
 * Interactive tool for testing the LIVE OSC bridge while the bot is running.
 * This connects to the actual bot (port 9000) and receives feedback on port 9001.
 * 
 * Usage:
 *   deno run --allow-net --unstable-net tests/osc/osc-live-test.ts [command]
 * 
 * Commands:
 *   ping          - Send /ping and wait for /pong
 *   git-status    - Request git status
 *   github-sync   - Trigger git pull/push
 *   agent <name>  - Select an agent (manager, coder, architect, etc.)
 *   issue <title> - Create a GitHub issue
 *   monitor       - Listen for all incoming OSC messages (press Ctrl+C to stop)
 *   stress <n>    - Send n ping messages and measure response
 */

import { createTestClient, OSCTestClient } from "./osc-test-client.ts";
import { delay } from "https://deno.land/std@0.208.0/async/delay.ts";

const BOT_PORT = 9000;
const FEEDBACK_PORT = 9001;

async function runPing(client: OSCTestClient): Promise<void> {
  console.log("\n🏓 Sending /ping...");
  await client.send('/ping');

  try {
    const pong = await client.waitForMessage('/pong', 3000);
    console.log("✅ Received /pong:", pong.args);

    const consoleMsg = await client.waitForMessage('/label/console', 1000).catch(() => null);
    if (consoleMsg) {
      console.log("📋 Console:", consoleMsg.args[0]);
    }
  } catch {
    console.log("❌ No response received (timeout)");
  }
}

async function runGitStatus(client: OSCTestClient): Promise<void> {
  console.log("\n📊 Requesting git status...");
  await client.send('/git/status', 1);

  await delay(500);
  const messages = client.getReceivedMessages();

  for (const msg of messages) {
    if (msg.address === '/label/git_branch') {
      console.log("🌿 Branch:", msg.args[0]);
    } else if (msg.address === '/label/console') {
      console.log("📋 Console:", msg.args[0]);
    }
  }

  if (messages.length === 0) {
    console.log("❌ No response received");
  }
}

async function runGitHubSync(client: OSCTestClient): Promise<void> {
  console.log("\n🔄 Triggering GitHub sync...");
  await client.send('/github/sync', 1);

  // Wait for sync to complete
  await delay(2000);
  const messages = client.getReceivedMessages();

  for (const msg of messages) {
    if (msg.address === '/label/console') {
      const icon = msg.args[0].includes('Complete') ? '✅' : '📋';
      console.log(`${icon} ${msg.args[0]}`);
    } else if (msg.address === '/label/git_branch') {
      console.log("🌿 Branch:", msg.args[0]);
    }
  }

  if (messages.length === 0) {
    console.log("❌ No response received");
  }
}

async function runAgentSelect(client: OSCTestClient, agentName: string): Promise<void> {
  console.log(`\n🤖 Selecting agent: ${agentName}...`);
  await client.send(`/agent/select/${agentName}`, 1);

  await delay(500);
  const messages = client.getReceivedMessages();

  for (const msg of messages) {
    if (msg.address === '/label/agent_name') {
      console.log("🤖 Agent:", msg.args[0]);
    } else if (msg.address === '/label/console') {
      console.log("📋 Console:", msg.args[0]);
    }
  }

  if (messages.length === 0) {
    console.log("❌ No response received");
  }
}

async function runCreateIssue(client: OSCTestClient, title: string): Promise<void> {
  console.log(`\n📝 Creating issue: "${title}"...`);
  await client.send('/github/issue/new', 1, title);

  await delay(2000);
  const messages = client.getReceivedMessages();

  for (const msg of messages) {
    if (msg.address === '/label/console') {
      const icon = msg.args[0].includes('Created') ? '✅' : '📋';
      console.log(`${icon} ${msg.args[0]}`);
    }
  }

  if (messages.length === 0) {
    console.log("❌ No response received");
  }
}

async function runMonitor(client: OSCTestClient): Promise<void> {
  console.log("\n👁️ Monitoring OSC messages (Ctrl+C to stop)...");
  console.log("─".repeat(60));

  client.on('*', (msg) => {
    const time = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${time}] ${msg.address}`, msg.args);
  });

  // Keep running until interrupted
  await new Promise(() => {});
}

async function runStressTest(client: OSCTestClient, count: number): Promise<void> {
  console.log(`\n⚡ Stress test: sending ${count} pings...`);

  const startTime = Date.now();

  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(client.send('/ping'));
  }
  await Promise.all(promises);

  const sendTime = Date.now() - startTime;
  console.log(`📤 Sent ${count} messages in ${sendTime}ms`);

  // Wait for responses
  await delay(2000);

  const pongs = client.getReceivedMessages().filter(m => m.address === '/pong');
  const responseTime = Date.now() - startTime;

  console.log(`📥 Received ${pongs.length}/${count} pongs in ${responseTime}ms`);
  console.log(`📊 Response rate: ${((pongs.length / count) * 100).toFixed(1)}%`);
  console.log(`⏱️ Avg latency: ${(responseTime / pongs.length).toFixed(1)}ms per message`);
}

function printUsage(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              OSC Live Test Tool                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Usage:                                                      ║
║    deno run --allow-net --unstable-net \\                     ║
║      tests/osc/osc-live-test.ts [command]                    ║
║                                                              ║
║  Commands:                                                   ║
║    ping              - Test connectivity with /ping          ║
║    git-status        - Request git status                    ║
║    github-sync       - Trigger git pull/push                 ║
║    agent <name>      - Select agent (coder, architect, etc.) ║
║    issue <title>     - Create GitHub issue                   ║
║    monitor           - Monitor all OSC traffic               ║
║    stress <n>        - Stress test with n messages           ║
║                                                              ║
║  Ports:                                                      ║
║    Bot listening:    ${BOT_PORT}                                     ║
║    Feedback port:    ${FEEDBACK_PORT}                                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
}

// Main execution
if (import.meta.main) {
  const args = Deno.args;

  if (args.length === 0) {
    printUsage();
    Deno.exit(0);
  }

  const command = args[0];
  const client = createTestClient(BOT_PORT, FEEDBACK_PORT);

  try {
    await client.startListening();
    await delay(100);

    switch (command) {
      case 'ping':
        await runPing(client);
        break;

      case 'git-status':
        await runGitStatus(client);
        break;

      case 'github-sync':
        await runGitHubSync(client);
        break;

      case 'agent':
        if (!args[1]) {
          console.log("❌ Please provide an agent name (e.g., coder, architect, manager)");
          Deno.exit(1);
        }
        await runAgentSelect(client, args[1]);
        break;

      case 'issue':
        const title = args.slice(1).join(' ') || 'Test Issue from OSC';
        await runCreateIssue(client, title);
        break;

      case 'monitor':
        await runMonitor(client);
        break;

      case 'stress':
        const count = parseInt(args[1]) || 50;
        await runStressTest(client, count);
        break;

      default:
        console.log(`❌ Unknown command: ${command}`);
        printUsage();
        Deno.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    if (command !== 'monitor') {
      client.stop();
    }
  }
}
