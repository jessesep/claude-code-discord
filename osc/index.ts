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
      
      // Handle wildcard agent selection
      if (message.address.startsWith('/agent/select/')) {
        const agentKey = message.address.split('/').pop();
        this.handleAgentSelect(agentKey);
      }
    });

    this.osc.on('/ping', () => {
      this.send('/pong', ['Bot is alive!']);
    });

    // Git Status
    this.osc.on('/git/status', async () => {
      if (this.deps.gitHandlers) {
        try {
          console.log('[OSC] Fetching git status...');
          this.send('/label/console', ['Fetching Git Status...']);
          const status = await this.deps.gitHandlers.getGitStatus(Deno.cwd());
          this.send('/label/git_branch', [\`Branch: \${status.branch}\`]);
          this.send('/label/console', [\`Git: \${status.status.replace(/\\n/g, ' ')}\`]);
        } catch (err) {
          console.error('[OSC] Git status error:', err);
          this.send('/label/console', [\`Git Error: \${err.message}\`]);
        }
      }
    });

    // GitHub Sync
    this.osc.on('/github/sync', async () => {
      if (this.deps.gitHandlers) {
        try {
          console.log('[OSC] GitHub Sync initiated');
          this.send('/label/console', ['Syncing: git pull...']);
          await this.deps.gitHandlers.executeGitCommand(Deno.cwd(), "git pull");
          
          this.send('/label/console', ['Syncing: git push...']);
          await this.deps.gitHandlers.executeGitCommand(Deno.cwd(), "git push");
          
          this.send('/label/console', ['Sync Complete!']);
        } catch (err) {
          console.error('[OSC] Sync error:', err);
          this.send('/label/console', [\`Sync Failed: \${err.message}\`]);
        }
      }
    });
  }

  private handleAgentSelect(agentKey: string | undefined) {
    if (!agentKey) return;
    
    // Convert short keys to full keys if needed
    const fullKeys: Record<string, string> = {
      'manager': 'ag-manager',
      'coder': 'ag-coder',
      'architect': 'architect',
      'reviewer': 'code-reviewer'
    };
    
    const actualKey = fullKeys[agentKey] || agentKey;
    
    console.log(\`[OSC] Selecting agent: \${actualKey}\`);
    this.send('/label/agent_name', [\`Agent: \${actualKey}\`]);
    this.send('/label/console', [\`Switched to \${actualKey}\`]);
  }

  public async start() {
    try {
      await this.osc.open();
      console.log(\`[OSC] Server listening on port \${this.port}\`);
      console.log(\`[OSC] Feedback target: \${this.remoteHost}:\${this.remotePort}\`);
    } catch (error) {
      console.error('[OSC] Failed to start server:', error);
    }
  }

  public send(address: string, args: any[] = []) {
    try {
      const message = new OSC.Message(address, ...args);
      this.osc.send(message, { host: this.remoteHost, port: this.remotePort });
    } catch (error) {
      // Phone might be offline
    }
  }
}
