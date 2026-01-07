/// <reference lib="deno.unstable" />

/**
 * OSC Bridge E2E Tests
 * 
 * Tests the OSC bridge functionality end-to-end by:
 * 1. Starting a mock OSC server (simulating the bot's OSCManager)
 * 2. Using the test client to send OSC messages
 * 3. Verifying correct dispatch and feedback
 * 
 * Run with: deno test --allow-net --unstable-net tests/osc/osc-e2e.test.ts
 */

// deno-lint-ignore-file no-explicit-any

import { 
  assertEquals, 
  assertExists,
  assertStringIncludes 
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { delay } from "https://deno.land/std@0.208.0/async/delay.ts";
import { OSCTestClient, createTestClient, OSCTestMessage } from "./osc-test-client.ts";

// Test ports (different from production to avoid conflicts)
const TEST_BOT_PORT = 9100;     // Mock bot listens here
const TEST_CLIENT_PORT = 9101;  // Test client receives here

/**
 * Mock OSC Server that simulates the bot's OSCManager
 * Simplified for testing - echoes messages and sends feedback
 */
class MockOSCServer {
  private listener: Deno.DatagramConn | null = null;
  private isRunning = false;
  private receivedMessages: OSCTestMessage[] = [];
  private clientPort: number;
  private clientHost: string;

  constructor(
    private port: number,
    clientPort: number = 9101,
    clientHost: string = '127.0.0.1'
  ) {
    this.clientPort = clientPort;
    this.clientHost = clientHost;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    // Dynamic import for OSC
    const OSCModule = await import("npm:osc-js");
    const OSC = (OSCModule as any).default || OSCModule;

    this.listener = Deno.listenDatagram({
      port: this.port,
      transport: "udp",
      hostname: "0.0.0.0"
    });

    this.isRunning = true;
    console.log(`[Mock OSC Server] Started on port ${this.port}`);

    // Handle incoming messages
    (async () => {
      if (!this.listener) return;
      
      for await (const [data, _remoteAddr] of this.listener) {
        if (!this.isRunning) break;
        
        try {
          const message = new OSC.Message();
          message.unpack(new DataView(data.buffer), 0);

          const testMessage: OSCTestMessage = {
            address: message.address,
            args: message.args || [],
            timestamp: Date.now()
          };

          this.receivedMessages.push(testMessage);
          console.log(`[Mock OSC Server] Received: ${testMessage.address}`, testMessage.args);

          // Simulate bot responses based on address
          await this.handleMessage(testMessage, OSC);
        } catch (err) {
          console.error('[Mock OSC Server] Decode error:', err);
        }
      }
    })();
  }

  private async handleMessage(msg: OSCTestMessage, OSC: any): Promise<void> {
    // Simulate bot behavior - send feedback based on received message
    switch (msg.address) {
      case '/ping':
        await this.sendFeedback('/pong', ['one agent discord is active'], OSC);
        await this.sendFeedback('/label/console', ['Connection Verified'], OSC);
        break;

      case '/git/status':
        if (msg.args[0] !== 0) {
          await this.sendFeedback('/label/console', ['Fetching Git Status...'], OSC);
          await this.sendFeedback('/label/git_branch', ['main'], OSC);
          await this.sendFeedback('/label/console', ['Git: Clean working tree...'], OSC);
        }
        break;

      case '/github/sync':
        if (msg.args[0] !== 0) {
          await this.sendFeedback('/label/console', ['Syncing: git pull...'], OSC);
          await delay(50);
          await this.sendFeedback('/label/console', ['Syncing: git push...'], OSC);
          await delay(50);
          await this.sendFeedback('/label/console', ['GitHub Sync Complete!'], OSC);
          await this.sendFeedback('/label/git_branch', ['main'], OSC);
        }
        break;

      case '/github/issue/new':
        if (msg.args[0] !== 0) {
          await this.sendFeedback('/label/console', ['Creating Issue...'], OSC);
          await delay(50);
          await this.sendFeedback('/label/console', ['Issue #123 Created'], OSC);
        }
        break;

      default:
        // Handle agent select pattern
        if (msg.address.startsWith('/agent/select/')) {
          const agentKey = msg.address.split('/').pop();
          const displayName = agentKey ? agentKey.charAt(0).toUpperCase() + agentKey.slice(1) : 'Unknown';
          await this.sendFeedback('/label/agent_name', [displayName], OSC);
          await this.sendFeedback('/label/console', [`Deployed: ${displayName}`], OSC);
        }
        break;
    }
  }

  private async sendFeedback(address: string, args: any[], OSC: any): Promise<void> {
    if (!this.listener) return;

    try {
      const message = new OSC.Message(address, ...args);
      const binary = message.pack();

      await this.listener.send(binary, {
        transport: "udp",
        port: this.clientPort,
        hostname: this.clientHost
      });

      console.log(`[Mock OSC Server] Sent feedback: ${address}`, args);
    } catch (error) {
      console.error('[Mock OSC Server] Failed to send feedback:', error);
    }
  }

  getReceivedMessages(): OSCTestMessage[] {
    return [...this.receivedMessages];
  }

  clearMessages(): void {
    this.receivedMessages = [];
  }

  stop(): void {
    this.isRunning = false;
    if (this.listener) {
      this.listener.close();
      this.listener = null;
    }
    console.log('[Mock OSC Server] Stopped');
  }
}

// ============================================================================
// E2E TEST SUITE
// ============================================================================

Deno.test({
  name: "OSC E2E: Ping/Pong connectivity test",
  async fn() {
    const server = new MockOSCServer(TEST_BOT_PORT, TEST_CLIENT_PORT);
    const client = createTestClient(TEST_BOT_PORT, TEST_CLIENT_PORT);

    try {
      // Start both
      await server.start();
      await client.startListening();
      await delay(100); // Let them settle

      // Send ping
      await client.send('/ping');

      // Wait for pong response
      const pong = await client.waitForMessage('/pong', 2000);
      assertExists(pong);
      assertEquals(pong.address, '/pong');
      assertStringIncludes(pong.args[0], 'one agent discord');

      // Should also receive console label
      const consoleMsg = await client.waitForMessage('/label/console', 2000);
      assertExists(consoleMsg);
      assertStringIncludes(consoleMsg.args[0], 'Connection Verified');

    } finally {
      client.stop();
      server.stop();
      await delay(100); // Cleanup time
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "OSC E2E: Git status request",
  async fn() {
    const server = new MockOSCServer(TEST_BOT_PORT + 1, TEST_CLIENT_PORT + 1);
    const client = createTestClient(TEST_BOT_PORT + 1, TEST_CLIENT_PORT + 1);

    try {
      await server.start();
      await client.startListening();
      await delay(100);

      // Send git status (with value 1 to trigger action)
      await client.send('/git/status', 1);

      // Wait for git branch feedback
      const branchMsg = await client.waitForMessage('/label/git_branch', 2000);
      assertExists(branchMsg);
      assertEquals(branchMsg.args[0], 'main');

      // Should receive console messages
      const messages = client.getReceivedMessages();
      const consoleMsgs = messages.filter(m => m.address === '/label/console');
      assertEquals(consoleMsgs.length >= 1, true);

    } finally {
      client.stop();
      server.stop();
      await delay(100);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "OSC E2E: Git status with value 0 should not trigger",
  async fn() {
    const server = new MockOSCServer(TEST_BOT_PORT + 2, TEST_CLIENT_PORT + 2);
    const client = createTestClient(TEST_BOT_PORT + 2, TEST_CLIENT_PORT + 2);

    try {
      await server.start();
      await client.startListening();
      await delay(100);

      // Send git status with 0 (button release, should be ignored)
      await client.send('/git/status', 0);

      // Wait a bit - should NOT receive any feedback
      await delay(500);

      const messages = client.getReceivedMessages();
      assertEquals(messages.length, 0, "Should not receive feedback for value 0");

    } finally {
      client.stop();
      server.stop();
      await delay(100);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "OSC E2E: GitHub sync workflow",
  async fn() {
    const server = new MockOSCServer(TEST_BOT_PORT + 3, TEST_CLIENT_PORT + 3);
    const client = createTestClient(TEST_BOT_PORT + 3, TEST_CLIENT_PORT + 3);

    try {
      await server.start();
      await client.startListening();
      await delay(100);

      // Send github sync
      await client.send('/github/sync', 1);

      // Wait for completion message
      const syncComplete = await client.waitForMessageMatching(/\/label\/console/, 3000);
      assertExists(syncComplete);

      // Wait for all messages
      await delay(200);

      const messages = client.getReceivedMessages();
      const consoleMessages = messages
        .filter(m => m.address === '/label/console')
        .map(m => m.args[0]);

      // Should have pull, push, and complete messages
      assertEquals(consoleMessages.some(m => m.includes('pull')), true);
      assertEquals(consoleMessages.some(m => m.includes('push')), true);
      assertEquals(consoleMessages.some(m => m.includes('Complete')), true);

    } finally {
      client.stop();
      server.stop();
      await delay(100);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "OSC E2E: Agent selection",
  async fn() {
    const server = new MockOSCServer(TEST_BOT_PORT + 4, TEST_CLIENT_PORT + 4);
    const client = createTestClient(TEST_BOT_PORT + 4, TEST_CLIENT_PORT + 4);

    try {
      await server.start();
      await client.startListening();
      await delay(100);

      // Select an agent
      await client.send('/agent/select/architect', 1);

      // Wait for agent name feedback
      const agentMsg = await client.waitForMessage('/label/agent_name', 2000);
      assertExists(agentMsg);
      assertEquals(agentMsg.args[0], 'Architect');

      // Check console message
      const consoleMsg = await client.waitForMessage('/label/console', 2000);
      assertExists(consoleMsg);
      assertStringIncludes(consoleMsg.args[0], 'Deployed');
      assertStringIncludes(consoleMsg.args[0], 'Architect');

    } finally {
      client.stop();
      server.stop();
      await delay(100);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "OSC E2E: Multiple rapid messages",
  async fn() {
    const server = new MockOSCServer(TEST_BOT_PORT + 5, TEST_CLIENT_PORT + 5);
    const client = createTestClient(TEST_BOT_PORT + 5, TEST_CLIENT_PORT + 5);

    try {
      await server.start();
      await client.startListening();
      await delay(100);

      // Send multiple messages rapidly
      await Promise.all([
        client.send('/ping'),
        client.send('/git/status', 1),
        client.send('/agent/select/coder', 1),
      ]);

      // Wait for responses
      await delay(500);

      const messages = client.getReceivedMessages();

      // Should have received responses for all
      const hasPong = messages.some(m => m.address === '/pong');
      const hasBranch = messages.some(m => m.address === '/label/git_branch');
      const hasAgent = messages.some(m => m.address === '/label/agent_name');

      assertEquals(hasPong, true, "Should receive /pong");
      assertEquals(hasBranch, true, "Should receive /label/git_branch");
      assertEquals(hasAgent, true, "Should receive /label/agent_name");

    } finally {
      client.stop();
      server.stop();
      await delay(100);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "OSC E2E: GitHub issue creation",
  async fn() {
    const server = new MockOSCServer(TEST_BOT_PORT + 6, TEST_CLIENT_PORT + 6);
    const client = createTestClient(TEST_BOT_PORT + 6, TEST_CLIENT_PORT + 6);

    try {
      await server.start();
      await client.startListening();
      await delay(100);

      // Send issue creation request
      await client.send('/github/issue/new', 1, 'Test Issue Title');

      // Wait for feedback
      await delay(300);

      const messages = client.getReceivedMessages();
      const consoleMessages = messages
        .filter(m => m.address === '/label/console')
        .map(m => m.args[0]);

      // Should have creating and created messages
      assertEquals(consoleMessages.some(m => m.includes('Creating')), true);
      assertEquals(consoleMessages.some(m => m.includes('Created')), true);

    } finally {
      client.stop();
      server.stop();
      await delay(100);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================================================
// STRESS TESTS
// ============================================================================

Deno.test({
  name: "OSC E2E: Stress test - 50 messages",
  async fn() {
    const server = new MockOSCServer(TEST_BOT_PORT + 7, TEST_CLIENT_PORT + 7);
    const client = createTestClient(TEST_BOT_PORT + 7, TEST_CLIENT_PORT + 7);

    try {
      await server.start();
      await client.startListening();
      await delay(100);

      // Send 50 ping messages
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(client.send('/ping'));
      }
      await Promise.all(promises);

      // Wait for responses
      await delay(1000);

      // Should have received 50 pong messages
      const pongs = client.getReceivedMessages().filter(m => m.address === '/pong');
      console.log(`[Stress Test] Received ${pongs.length} pongs`);
      
      // Allow some tolerance for UDP packet loss
      assertEquals(pongs.length >= 45, true, `Expected at least 45 pongs, got ${pongs.length}`);

    } finally {
      client.stop();
      server.stop();
      await delay(100);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

console.log(`
╔══════════════════════════════════════════════════════════════╗
║              OSC Bridge E2E Test Suite                       ║
║                                                              ║
║  Tests verify:                                               ║
║  • Ping/Pong connectivity                                    ║
║  • Git status requests                                       ║
║  • GitHub sync workflow                                      ║
║  • Agent selection                                           ║
║  • Issue creation                                            ║
║  • Multiple rapid messages                                   ║
║  • Stress test (50 messages)                                 ║
║                                                              ║
║  Run: deno test --allow-net --unstable-net tests/osc/        ║
╚══════════════════════════════════════════════════════════════╝
`);
