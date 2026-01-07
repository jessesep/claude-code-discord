// deno-lint-ignore-file no-explicit-any
import OSCModule from "npm:osc-js";

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
  primaryHandlers?: any; // Formerly claudeHandlers
  agentHandlers?: any;
  shellHandlers?: any;
  utilsHandlers?: any;
}

/**
 * OSC Manager Class
 * Acts as a bridge between TouchOSC control surfaces and the One Agent bot system.
 */
export class OSCManager {
  private osc: any;
  private port: number;
  private remoteHosts: string[];
  private remotePort: number;
  private deps: OSCDependencies;

  constructor(config: OSCConfig, deps: OSCDependencies = {}) {
    this.port = config.port;
    this.remoteHosts = config.remoteHosts || ['127.0.0.1'];
    this.remotePort = config.remotePort || 9001;
    this.deps = deps;
    
    this.osc = new OSC({
      plugin: new OSC.DatagramPlugin({
        port: this.port,
        host: '0.0.0.0'
      })
    });

    this.setupListeners();
  }

  /**
   * Initialize OSC message listeners
   */
  private setupListeners() {
    this.osc.on('*', (message: any) => {
      console.log(`[OSC] Received: ${message.address}`, message.args);
      
      // Handle wildcard agent selection: /agent/select/<key>
      if (message.address.startsWith('/agent/select/')) {
        const agentKey = message.address.split('/').pop();
        this.handleAgentSelect(agentKey);
      }
    });

    /**
     * Heartbeat / Connection Test
     */
    this.osc.on('/ping', () => {
      this.sendFeedback('/pong', ['One Agent is Active']);
      this.sendFeedback('/label/console', ['Connection Verified']);
    });

    /**
     * Git Status Command
     */
    this.osc.on('/git/status', async (message: any) => {
      // Debounce: Buttons send 1 on press, 0 on release. We only care about 1.
      if (message.args[0] === 0) return;

      if (this.deps.gitHandlers) {
        try {
          console.log('[OSC] Requesting Git Status...');
          this.sendFeedback('/label/console', ['Fetching Git Status...']);
          const status = await this.deps.gitHandlers.getStatus();
          
          this.sendFeedback('/label/git_branch', [status.branch]);
          const cleanStatus = status.status.replace(/\n/g, ' ').substring(0, 50);
          this.sendFeedback('/label/console', [`Git: ${cleanStatus}...`]);
        } catch (err) {
          console.error('[OSC] Git status error:', err);
          this.sendFeedback('/label/console', [`Git Error: ${(err as Error).message}`]);
        }
      }
    });

    /**
     * GitHub Sync Command (Pull -> Push)
     */
    this.osc.on('/github/sync', async (message: any) => {
      if (message.args[0] === 0) return;

      if (this.deps.gitHandlers) {
        try {
          console.log('[OSC] GitHub Sync sequence initiated');
          this.sendFeedback('/label/console', ['Syncing: git pull...']);
          await this.deps.gitHandlers.onGit(null, "pull");
          
          this.sendFeedback('/label/console', ['Syncing: git push...']);
          await this.deps.gitHandlers.onGit(null, "push");
          
          this.sendFeedback('/label/console', ['GitHub Sync Complete!']);
          
          // Refresh metadata
          const status = await this.deps.gitHandlers.getStatus();
          this.sendFeedback('/label/git_branch', [status.branch]);
        } catch (err) {
          console.error('[OSC] Sync error:', err);
          this.sendFeedback('/label/console', [`Sync Failed: ${(err as Error).message}`]);
        }
      }
    });

    /**
     * GitHub Issue Creation
     */
    this.osc.on('/github/issue/new', async (message: any) => {
      if (message.args[0] === 0) return;

      try {
        const title = (message.args && typeof message.args[1] === 'string') 
          ? message.args[1] 
          : "Bug Report: Mobile Dashboard";
        
        console.log(`[OSC] Creating GitHub issue: ${title}`);
        this.sendFeedback('/label/console', [`Creating Issue...`]);

        const cmd = new Deno.Command("gh", {
          args: ["issue", "create", "--title", title, "--body", "Created via One Agent Mobile Dashboard."],
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
        console.error('[OSC] Issue creation error:', err);
        this.sendFeedback('/label/console', [`Error: ${(err as Error).message}`]);
      }
    });
  }

  /**
   * Handle Agent Selection
   * Maps UI keys to the new One Agent Registry keys.
   */
  private async handleAgentSelect(agentKey: string | undefined) {
    if (!agentKey) return;
    
    // Mapping table for TouchOSC keys to Registry IDs
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
    
    console.log(`[OSC] Deploying Agent: ${targetAgentId}`);
    
    if (this.deps.agentHandlers) {
      try {
        // Create a compliant InteractionContext for the agent handler
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
        console.error('[OSC] Deployment error:', err);
        this.sendFeedback('/label/console', [`Deploy Error: ${(err as Error).message}`]);
      }
    } else {
      this.sendFeedback('/label/agent_name', [displayName]);
      this.sendFeedback('/label/console', [`(Mock) Switched to ${displayName}`]);
    }
  }

  /**
   * Open the OSC Server
   */
  public async start() {
    try {
      await this.osc.open();
      console.log(`[OSC] Mobile Bridge started on port ${this.port}`);
      console.log(`[OSC] Feedback Targets: ${this.remoteHosts.join(', ')}:${this.remotePort}`);
    } catch (error) {
      console.error('[OSC] Startup Error:', error);
    }
  }

  /**
   * Send Feedback to Remote Control Surfaces
   */
  public sendFeedback(address: string, args: any[] = []) {
    for (const host of this.remoteHosts) {
      try {
        const message = new OSC.Message(address, ...args);
        this.osc.send(message, { host, port: this.remotePort });
      } catch (error) {
        // Host unreachable
      }
    }
  }
}
