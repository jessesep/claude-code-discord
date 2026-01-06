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
    this.osc.on('/git/status', async (message: any) => {
      // Buttons send 1 on press, 0 on release. We only care about 1.
      if (message.args[0] === 0) return;

      if (this.deps.gitHandlers) {
        try {
          console.log('[OSC] Fetching git status...');
          this.send('/label/console', ['Fetching Git Status...']);
          const status = await this.deps.gitHandlers.getStatus();
          
          // Send just the value to the labeled value labels
          this.send('/label/git_branch', [status.branch]);
          
          const cleanStatus = status.status.replace(/\n/g, ' ').substring(0, 50);
          this.send('/label/console', [\`Git: \${cleanStatus}...\`]);
        } catch (err) {
          console.error('[OSC] Git status error:', err);
          this.send('/label/console', [\`Git Error: \${err.message}\`]);
        }
      }
    });

    // GitHub Sync
    this.osc.on('/github/sync', async (message: any) => {
      if (message.args[0] === 0) return;

      if (this.deps.gitHandlers) {
        try {
          console.log('[OSC] GitHub Sync initiated');
          this.send('/label/console', ['Syncing: git pull...']);
          await this.deps.gitHandlers.onGit(null, "pull");
          
          this.send('/label/console', ['Syncing: git push...']);
          await this.deps.gitHandlers.onGit(null, "push");
          
          this.send('/label/console', ['Sync Complete!']);
          
          // Refresh branch label after sync
          const status = await this.deps.gitHandlers.getStatus();
          this.send('/label/git_branch', [status.branch]);
        } catch (err) {
          console.error('[OSC] Sync error:', err);
          this.send('/label/console', [\`Sync Failed: \${err.message}\`]);
        }
      }
    });

    // GitHub Issue Creation
    this.osc.on('/github/issue/new', async (message: any) => {
      if (message.args[0] === 0) return;

      try {
        // Use provided argument as title, or default to a quick bug report
        const title = (message.args && typeof message.args[1] === 'string') 
          ? message.args[1] 
          : "Bug Report: Detected via Mobile Dashboard";
        
        console.log(\`[OSC] Creating GitHub issue: \${title}\`);
        this.send('/label/console', [\`Creating Issue...\`]);

        const cmd = new Deno.Command("gh", {
          args: ["issue", "create", "--title", title, "--body", "This issue was created via the ClaudeOps TouchOSC Mobile Dashboard."],
          stdout: "piped",
          stderr: "piped"
        });

        const { stdout, code } = await cmd.output();
        const outText = new TextDecoder().decode(stdout).trim();

        if (code === 0) {
          const issueNum = outText.split('/').pop();
          this.send('/label/console', [\`Issue #\${issueNum} Created Successfully\`]);
        } else {
          this.send('/label/console', ['Failed to create issue via gh CLI']);
        }
      } catch (err) {
        console.error('[OSC] Issue creation error:', err);
        this.send('/label/console', [\`Error: \${err.message}\`]);
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
    const displayName = agentKey.charAt(0).toUpperCase() + agentKey.slice(1);
    
    console.log(\`[OSC] Selecting agent: \${actualKey}\`);
    this.send('/label/agent_name', [displayName]);
    this.send('/label/console', [\`Switched Agent to: \${displayName}\`]);
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
