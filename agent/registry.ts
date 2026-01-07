import { AgentConfig, PREDEFINED_AGENTS } from './types.ts';
import { RemoteAgentRegistry } from './remote-registry.ts';

/**
 * Agent Registry
 * Manages specialized AI agents and their configurations.
 * Allows for dynamic registration of new agents at runtime.
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, AgentConfig>;

  private constructor() {
    this.agents = new Map(Object.entries(PREDEFINED_AGENTS));
    this.syncRemoteAgents();
  }

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Register a new agent
   */
  registerAgent(id: string, config: AgentConfig): void {
    if (this.agents.has(id)) {
      // Don't log if it's the same URL for remote agents
      const existing = this.agents.get(id);
      if (existing?.client === 'remote' && existing.remoteEndpointId === config.remoteEndpointId) {
        this.agents.set(id, config);
        return;
      }
      console.warn(`[Registry] Overwriting existing agent: ${id}`);
    }
    this.agents.set(id, config);
    console.log(`[Registry] Registered agent: ${id} (${config.name})`);
  }

  /**
   * Sync remote agents from RemoteAgentRegistry
   */
  syncRemoteAgents(): void {
    try {
      const remoteRegistry = RemoteAgentRegistry.getInstance();
      const endpoints = remoteRegistry.getEndpoints();
      
      for (const endpoint of endpoints) {
        // We register even if offline, but show status in description
        const agentId = `remote-${endpoint.id}`;
        this.registerAgent(agentId, {
          name: `${endpoint.name} (Remote)`,
          description: `Remote agent at ${endpoint.url}. Status: ${endpoint.status}`,
          model: endpoint.providers[0] || 'claude-sonnet-4',
          systemPrompt: "You are a remote agent. Execute tasks on the remote machine.",
          temperature: 0.7,
          maxTokens: 4096,
          capabilities: [...endpoint.capabilities, 'remote'],
          riskLevel: 'high',
          client: 'remote',
          remoteEndpointId: endpoint.id
        });
      }
    } catch (error) {
      console.error("[Registry] Failed to sync remote agents:", error);
    }
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(id: string): boolean {
    if (id.startsWith('ag-manager')) {
      throw new Error("Cannot unregister the manager agent");
    }
    return this.agents.delete(id);
  }

  /**
   * Get an agent by ID
   */
  getAgent(id: string): AgentConfig | undefined {
    return this.agents.get(id);
  }

  /**
   * List all registered agents
   */
  listAgents(): Record<string, AgentConfig> {
    const result: Record<string, AgentConfig> = {};
    for (const [id, config] of this.agents.entries()) {
      result[id] = config;
    }
    return result;
  }

  /**
   * Search agents by capability
   */
  getAgentsByCapability(capability: string): string[] {
    const matching: string[] = [];
    for (const [id, config] of this.agents.entries()) {
      if (config.capabilities.includes(capability)) {
        matching.push(id);
      }
    }
    return matching;
  }
}
