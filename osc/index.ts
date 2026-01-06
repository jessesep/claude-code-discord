import OSC from "npm:osc-js";

export interface OSCConfig {
  port: number;
  remoteHost?: string;
  remotePort?: number;
}

export interface OSCDependencies {
  gitHandlers?: any;
  claudeHandlers?: any;
  agentHandlers?: any;
  shellHandlers?: any;
  utilsHandlers?: any;
}

export class OSCManager {
  private osc: any;
  private port: number;
  private remoteHost: string;
  private remotePort: number;
  private deps: OSCDependencies;

  constructor(config: OSCConfig, deps: OSCDependencies = {}) {
    this.port = config.port;
    this.remoteHost = config.remoteHost || '127.0.0.1';
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

  private setupListeners() {
    this.osc.on('*', (message: any) => {
      console.log(`[OSC] Received: ${message.address}`, message.args);
    });

    this.osc.on('/ping', () => {
      this.send('/pong', ['Bot is alive!']);
    });

    // Git Status
    this.osc.on('/git/status', async () => {
      if (this.deps.gitHandlers) {
        try {
          const status = await this.deps.gitHandlers.getStatus();
          this.send('/label/git_branch', [status.branch]);
          this.send('/label/git_status', [status.status.substring(0, 100)]);
        } catch (err) {
          console.error('[OSC] Git status error:', err);
        }
      }
    });

    // GitHub Sync (Pull & Push)
    this.osc.on('/github/sync', async () => {
      if (this.deps.gitHandlers) {
        try {
          console.log('[OSC] Triggering GitHub Sync...');
          this.send('/label/console', ['Syncing to GitHub...']);
          
          const pullResult = await this.deps.gitHandlers.onGit(null, "pull");
          console.log('[OSC] Pull Result:', pullResult);
          
          const pushResult = await this.deps.gitHandlers.onGit(null, "push");
          console.log('[OSC] Push Result:', pushResult);
          
          this.send('/label/console', ['Sync Complete']);
          this.send('/git/sync/done', [1.0]);
        } catch (err) {
          console.error('[OSC] Sync error:', err);
          this.send('/label/console', [`Sync failed: ${err.message}`]);
        }
      }
    });

    // GitHub New Issue
    this.osc.on('/github/issue/new', async (message: any) => {
      const title = message.args[0];
      const body = message.args[1] || "Created via TouchOSC";
      
      if (title) {
        try {
          console.log(`[OSC] Creating GitHub Issue: ${title}`);
          this.send('/label/console', [`Creating Issue: ${title}...`]);
          
          const cmd = new Deno.Command("gh", {
            args: ["issue", "create", "--title", title, "--body", body],
            stdout: "piped",
            stderr: "piped"
          });
          
          const { stdout, stderr, code } = await cmd.output();
          const outText = new TextDecoder().decode(stdout).trim();
          const errText = new TextDecoder().decode(stderr).trim();
          
          if (code === 0) {
            console.log(`[OSC] Issue Created: ${outText}`);
            this.send('/label/console', [`Issue #${outText.split('/').pop()} Created`]);
          } else {
            console.error(`[OSC] Issue creation failed: ${errText}`);
            this.send('/label/console', [`Issue creation failed: ${errText.substring(0, 50)}`]);
          }
        } catch (err) {
          console.error('[OSC] Issue error:', err);
          this.send('/label/console', [`Error: ${err.message}`]);
        }
      }
    });

    // Agent Selection
    this.osc.on('/agent/select', async (message: any) => {
      const agentKey = message.args[0];
      if (this.deps.agentHandlers && agentKey) {
        console.log(`[OSC] Selecting agent: ${agentKey}`);
        this.send('/label/agent_name', [agentKey]);
      }
    });
  }

  public async start() {
    try {
      await this.osc.open();
      console.log(`[OSC] Server listening on port ${this.port}`);
    } catch (error) {
      console.error('[OSC] Failed to start server:', error);
    }
  }

  public send(address: string, args: any[] = []) {
    try {
      const message = new OSC.Message(address, ...args);
      this.osc.send(message, { host: this.remoteHost, port: this.remotePort });
    } catch (error) {
      console.error(`[OSC] Failed to send message to ${address}:`, error);
    }
  }
}
