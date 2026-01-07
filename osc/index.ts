// deno-lint-ignore-file no-explicit-any
import OSCModule from "npm:osc-js";
import { OSCDiscordChannel } from "./osc-discord-channel.ts";

/**
 * Handle both default export and module export patterns for osc-js
 */
const OSC = (OSCModule as any).default || OSCModule;

/**
 * Configuration for the OSC Manager
 */
export interface OSCConfig {
  port: number;           // Port the bot listens on
  remoteHosts?: string[]; // IPs/Hosts to send feedback to
  remotePort?: number;    // Port the remote devices listen on (default 9001)
}

/**
 * Dependencies for the OSC Manager, matching the One Agent architecture
 */
export interface OSCDependencies {
  gitHandlers?: any;
  primaryHandlers?: any;
  agentHandlers?: any;
  shellHandlers?: any;
  utilsHandlers?: any;
}

/**
 * OSC Message stats for monitoring
 */
export interface OSCStats {
  messagesReceived: number;
  messagesSent: number;
  lastMessageTime: Date | null;
  uptime: number;
  isRunning: boolean;
}

/**
 * OSC Manager Class
 * Acts as a bridge between TouchOSC control surfaces and the One Agent bot system.
 * Uses Deno's native UDP (listenDatagram) for reliable binding.
 */
export class OSCManager {
  private listener: any;
  private port: number;
  private remoteHosts: string[];
  private remotePort: number;
  private deps: OSCDependencies;
  private handlers: Map<string, (message: any) => void> = new Map();
  private wildcardHandlers: ((message: any) => void)[] = [];
  private isRunning: boolean = false;
  private startTime: Date | null = null;
  
  // Stats
  private messagesReceived = 0;
  private messagesSent = 0;
  private lastMessageTime: Date | null = null;
  
  // Discord integration
  private discordChannel: OSCDiscordChannel | null = null;

  constructor(config: OSCConfig, deps: OSCDependencies = {}) {
    this.port = config.port;
    this.remoteHosts = config.remoteHosts || ['127.0.0.1'];
    this.remotePort = config.remotePort || 9001;
    this.deps = deps;
    
    this.setupListeners();
  }

  /**
   * Set Discord channel for logging
   */
  setDiscordChannel(channel: OSCDiscordChannel): void {
    this.discordChannel = channel;
  }

  /**
   * Get current stats
   */
  getStats(): OSCStats {
    return {
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      lastMessageTime: this.lastMessageTime,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      isRunning: this.isRunning
    };
  }

  /**
   * Register internal handlers
   */
  private setupListeners() {
    this.on('*', (message: any) => {
      console.log(`[OSC] Received: ${message.address}`, message.args);
      
      if (message.address.startsWith('/agent/select/')) {
        const agentKey = message.address.split('/').pop();
        this.handleAgentSelect(agentKey);
      }
    });

    this.on('/ping', () => {
      this.sendFeedback('/pong', ['one agent discord is active']);
      this.sendFeedback('/label/console', ['Connection Verified']);
    });

    this.on('/git/status', async (message: any) => {
      if (message.args[0] === 0) return;
      if (this.deps.gitHandlers) {
        try {
          this.sendFeedback('/label/console', ['Fetching Git Status...']);
          const status = await this.deps.gitHandlers.getStatus();
          this.sendFeedback('/label/git_branch', [status.branch]);
          const cleanStatus = status.status.replace(/\n/g, ' ').substring(0, 50);
          this.sendFeedback('/label/console', [`Git: ${cleanStatus}...`]);
        } catch (err) {
          this.sendFeedback('/label/console', [`Git Error: ${(err as Error).message}`]);
        }
      }
    });

    this.on('/github/sync', async (message: any) => {
      if (message.args[0] === 0) return;
      if (this.deps.gitHandlers) {
        try {
          this.sendFeedback('/label/console', ['Syncing: git pull...']);
          await this.deps.gitHandlers.onGit(null, "pull");
          this.sendFeedback('/label/console', ['Syncing: git push...']);
          await this.deps.gitHandlers.onGit(null, "push");
          this.sendFeedback('/label/console', ['GitHub Sync Complete!']);
          const status = await this.deps.gitHandlers.getStatus();
          this.sendFeedback('/label/git_branch', [status.branch]);
        } catch (err) {
          this.sendFeedback('/label/console', [`Sync Failed: ${(err as Error).message}`]);
        }
      }
    });

    this.on('/github/issue/new', async (message: any) => {
      if (message.args[0] === 0) return;
      try {
        const title = (message.args && typeof message.args[1] === 'string') 
          ? message.args[1] 
          : "Bug Report: Mobile Dashboard";
        
        this.sendFeedback('/label/console', [`Creating Issue...`]);
        const cmd = new Deno.Command("gh", {
          args: ["issue", "create", "--title", title, "--body", "Created via one agent discord mobile dashboard."],
          stdout: "piped",
          stderr: "piped"
        });

        const { stdout, code } = await cmd.output();
        const outText = new TextDecoder().decode(stdout).trim();

        if (code === 0) {
          const issueNum = outText.split('/').pop();
          this.sendFeedback('/label/console', [`Issue #${issueNum} Created`]);
        } else {
          this.sendFeedback('/label/console', ['GH CLI Issue Failed']);
        }
      } catch (err) {
        this.sendFeedback('/label/console', [`Error: ${(err as Error).message}`]);
      }
    });
  }

  /**
   * Helper to register message handlers
   */
  public on(address: string, handler: (message: any) => void) {
    if (address === '*') {
      this.wildcardHandlers.push(handler);
    } else {
      this.handlers.set(address, handler);
    }
  }

  /**
   * Handle Agent Selection
   */
  private async handleAgentSelect(agentKey: string | undefined) {
    if (!agentKey) return;
    
    const registryMapping: Record<string, string> = {
      'manager': 'ag-manager',
      'coder': 'ag-coder',
      'architect': 'ag-architect',
      'tester': 'ag-tester',
      'security': 'ag-security',
      'reviewer': 'code-reviewer',
      'cursor-coder': 'cursor-coder',
      'assistant': 'general-assistant'
    };
    
    const targetAgentId = registryMapping[agentKey] || agentKey;
    const displayName = agentKey.charAt(0).toUpperCase() + agentKey.slice(1).replace('-', ' ');
    
    if (this.deps.agentHandlers) {
      try {
        const mockCtx = {
          user: { id: "osc-remote", username: "Dashboard" },
          channelId: "osc-control-surface",
          deferReply: async () => {},
          editReply: async (content: any) => {
            if (content.embeds && content.embeds[0]) {
              const feedback = content.embeds[0].title || content.embeds[0].description || "Success";
              this.sendFeedback('/label/console', [feedback.substring(0, 30)]);
            }
          },
          reply: async () => {},
          followUp: async () => {},
          getString: (name: string) => {
            if (name === 'action') return 'select';
            if (name === 'agent_name') return targetAgentId;
            return null;
          },
          getBoolean: () => null,
          getInteger: () => null
        };

        await this.deps.agentHandlers.onAgent(mockCtx, 'select', targetAgentId);
        this.sendFeedback('/label/agent_name', [displayName]);
        this.sendFeedback('/label/console', [`Deployed: ${displayName}`]);
      } catch (err) {
        this.sendFeedback('/label/console', [`Deploy Error: ${(err as Error).message}`]);
      }
    } else {
      this.sendFeedback('/label/agent_name', [displayName]);
      this.sendFeedback('/label/console', [`(Mock) Switched to ${displayName}`]);
    }
  }

  /**
   * Open the native UDP socket and start the receive loop
   */
  public async start() {
    if (this.isRunning) return;
    
    try {
      // Use Deno's native UDP listener
      // Requires --unstable-net flag
      this.listener = (Deno as any).listenDatagram({
        port: this.port,
        transport: "udp",
        hostname: "0.0.0.0"
      });
      
      this.isRunning = true;
      this.startTime = new Date();
      console.log(`[OSC] Native bridge active on port ${this.port}`);
      console.log(`[OSC] Feedback targets: ${this.remoteHosts.join(', ')}:${this.remotePort}`);

      // Start receive loop
      this.receiveLoop();
    } catch (error) {
      console.error('[OSC] Native binding failed. Ensure --unstable-net flag is used:', error);
    }
  }

  /**
   * The infinite receive loop
   */
  private async receiveLoop() {
    for await (const [data, remoteAddr] of this.listener) {
      try {
        const message = new OSC.Message();
        message.unpack(new DataView(data.buffer), 0);
        
        // Update stats
        this.messagesReceived++;
        this.lastMessageTime = new Date();
        
        // Log to Discord if available
        if (this.discordChannel?.ready()) {
          this.discordChannel.logIncoming(
            message.address, 
            message.args || [],
            remoteAddr?.hostname
          );
        }
        
        // Trigger specific handlers
        const handler = this.handlers.get(message.address);
        if (handler) handler(message);
        
        // Trigger wildcard handlers
        for (const wh of this.wildcardHandlers) {
          wh(message);
        }
      } catch (err) {
        console.error('[OSC] Failed to decode packet:', err);
      }
    }
  }

  /**
   * Send Feedback to Remote Control Surfaces using native Deno UDP
   */
  public async sendFeedback(address: string, args: any[] = []) {
    if (!this.isRunning || !this.listener) return;

    try {
      const message = new OSC.Message(address, ...args);
      const binary = message.pack();
      
      // Update stats
      this.messagesSent++;

      // Log to Discord if available
      if (this.discordChannel?.ready()) {
        this.discordChannel.logOutgoing(address, args);
      }

      for (const host of this.remoteHosts) {
        try {
          await this.listener.send(binary, {
            transport: "udp",
            port: this.remotePort,
            hostname: host
          });
        } catch (error) {
          // Host unreachable or other send error
        }
      }
    } catch (err) {
      console.error('[OSC] Failed to pack or send feedback:', err);
    }
  }

  /**
   * Send OSC message from Discord (for testing)
   */
  public async sendFromDiscord(address: string, args: any[] = []): Promise<void> {
    // Simulate receiving this message and process it
    const mockMessage = { address, args };
    
    console.log(`[OSC] Discord command: ${address}`, args);
    
    // Update stats as if received
    this.messagesReceived++;
    this.lastMessageTime = new Date();
    
    // Trigger handlers
    const handler = this.handlers.get(address);
    if (handler) handler(mockMessage);
    
    // Trigger wildcard handlers
    for (const wh of this.wildcardHandlers) {
      wh(mockMessage);
    }
  }

  /**
   * Stop the bridge
   */
  public stop() {
    this.isRunning = false;
    if (this.listener) {
      this.listener.close();
      this.listener = null;
    }
  }
}
