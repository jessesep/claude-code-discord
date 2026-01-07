/// <reference lib="deno.unstable" />

/**
 * OSC Test Client
 * A bidirectional OSC test client for E2E testing of the OSC Bridge.
 * Uses native Deno UDP for sending and receiving OSC messages.
 */

// deno-lint-ignore-file no-explicit-any

import OSCModule from "npm:osc-js";

const OSC = (OSCModule as any).default || OSCModule;

export interface OSCTestMessage {
  address: string;
  args: any[];
  timestamp: number;
}

export interface OSCTestClientConfig {
  sendPort: number;      // Port to send messages TO (bot's listening port)
  receivePort: number;   // Port to receive messages ON (feedback port)
  host: string;          // Target host
  timeout?: number;      // Default timeout for waiting
}

/**
 * OSC Test Client for E2E testing
 * Simulates a TouchOSC control surface for testing the OSC bridge.
 */
export class OSCTestClient {
  private config: OSCTestClientConfig;
  private receivedMessages: OSCTestMessage[] = [];
  private listener: Deno.DatagramConn | null = null;
  private isListening: boolean = false;
  private messageHandlers: Map<string, ((msg: OSCTestMessage) => void)[]> = new Map();

  constructor(config: OSCTestClientConfig) {
    this.config = {
      timeout: 5000,
      ...config
    };
  }

  /**
   * Start listening for feedback messages from the OSC bridge
   */
  async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      this.listener = Deno.listenDatagram({
        port: this.config.receivePort,
        transport: "udp",
        hostname: "0.0.0.0"
      });

      this.isListening = true;
      console.log(`[OSC Test Client] Listening on port ${this.config.receivePort}`);

      // Start receive loop
      this.receiveLoop();
    } catch (error) {
      console.error(`[OSC Test Client] Failed to start listener:`, error);
      throw error;
    }
  }

  /**
   * Receive loop for incoming OSC messages
   */
  private async receiveLoop(): Promise<void> {
    if (!this.listener) return;

    try {
      for await (const [data, _remoteAddr] of this.listener) {
        try {
          const message = new OSC.Message();
          message.unpack(new DataView(data.buffer), 0);

          const testMessage: OSCTestMessage = {
            address: message.address,
            args: message.args || [],
            timestamp: Date.now()
          };

          this.receivedMessages.push(testMessage);
          console.log(`[OSC Test Client] Received: ${testMessage.address}`, testMessage.args);

          // Trigger handlers for this address
          const handlers = this.messageHandlers.get(testMessage.address) || [];
          const wildcardHandlers = this.messageHandlers.get('*') || [];

          [...handlers, ...wildcardHandlers].forEach(h => h(testMessage));
        } catch (err) {
          console.error('[OSC Test Client] Failed to decode packet:', err);
        }
      }
    } catch (error) {
      if (this.isListening) {
        console.error('[OSC Test Client] Receive loop error:', error);
      }
    }
  }

  /**
   * Send an OSC message to the bridge
   */
  async send(address: string, ...args: any[]): Promise<void> {
    if (!this.listener) {
      throw new Error('Client not started. Call startListening() first.');
    }

    try {
      const message = new OSC.Message(address, ...args);
      const binary = message.pack();

      await this.listener.send(binary, {
        transport: "udp",
        port: this.config.sendPort,
        hostname: this.config.host
      });

      console.log(`[OSC Test Client] Sent: ${address}`, args);
    } catch (error) {
      console.error(`[OSC Test Client] Failed to send:`, error);
      throw error;
    }
  }

  /**
   * Register a handler for a specific OSC address
   */
  on(address: string, handler: (msg: OSCTestMessage) => void): void {
    if (!this.messageHandlers.has(address)) {
      this.messageHandlers.set(address, []);
    }
    this.messageHandlers.get(address)!.push(handler);
  }

  /**
   * Wait for a specific OSC message to be received
   */
  async waitForMessage(
    address: string,
    timeout: number = this.config.timeout!
  ): Promise<OSCTestMessage> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for message: ${address}`));
      }, timeout);

      const handler = (msg: OSCTestMessage) => {
        if (msg.address === address) {
          clearTimeout(timeoutId);
          // Remove handler
          const handlers = this.messageHandlers.get(address) || [];
          const idx = handlers.indexOf(handler);
          if (idx > -1) handlers.splice(idx, 1);
          resolve(msg);
        }
      };

      this.on(address, handler);
    });
  }

  /**
   * Wait for any message matching a pattern
   */
  async waitForMessageMatching(
    pattern: RegExp,
    timeout: number = this.config.timeout!
  ): Promise<OSCTestMessage> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for message matching: ${pattern}`));
      }, timeout);

      const handler = (msg: OSCTestMessage) => {
        if (pattern.test(msg.address)) {
          clearTimeout(timeoutId);
          // Remove handler
          const handlers = this.messageHandlers.get('*') || [];
          const idx = handlers.indexOf(handler);
          if (idx > -1) handlers.splice(idx, 1);
          resolve(msg);
        }
      };

      this.on('*', handler);
    });
  }

  /**
   * Get all received messages
   */
  getReceivedMessages(): OSCTestMessage[] {
    return [...this.receivedMessages];
  }

  /**
   * Get messages received since a timestamp
   */
  getMessagesSince(timestamp: number): OSCTestMessage[] {
    return this.receivedMessages.filter(m => m.timestamp >= timestamp);
  }

  /**
   * Clear received messages
   */
  clearMessages(): void {
    this.receivedMessages = [];
  }

  /**
   * Stop the test client
   */
  stop(): void {
    this.isListening = false;
    if (this.listener) {
      this.listener.close();
      this.listener = null;
    }
    console.log('[OSC Test Client] Stopped');
  }
}

/**
 * Test assertions helper
 */
export class OSCTestAssertions {
  constructor(private client: OSCTestClient) {}

  /**
   * Assert that a message was received with specific address
   */
  assertReceived(address: string, message?: string): void {
    const messages = this.client.getReceivedMessages();
    const found = messages.some(m => m.address === address);
    if (!found) {
      throw new Error(message || `Expected to receive message: ${address}`);
    }
  }

  /**
   * Assert that a message was received with specific args
   */
  assertReceivedWithArgs(address: string, expectedArgs: any[], message?: string): void {
    const messages = this.client.getReceivedMessages();
    const found = messages.find(m => 
      m.address === address && 
      JSON.stringify(m.args) === JSON.stringify(expectedArgs)
    );
    if (!found) {
      throw new Error(
        message || `Expected to receive message: ${address} with args: ${JSON.stringify(expectedArgs)}`
      );
    }
  }

  /**
   * Assert no message with address was received
   */
  assertNotReceived(address: string, message?: string): void {
    const messages = this.client.getReceivedMessages();
    const found = messages.some(m => m.address === address);
    if (found) {
      throw new Error(message || `Did not expect to receive message: ${address}`);
    }
  }
}

// Export factory function for easy test setup
export function createTestClient(
  sendPort: number = 9000,
  receivePort: number = 9001,
  host: string = '127.0.0.1'
): OSCTestClient {
  return new OSCTestClient({ sendPort, receivePort, host });
}
