import { AgentConfig, PREDEFINED_AGENTS } from './types.ts';

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
      console.warn(`[Registry] Overwriting existing agent: ${id}`);
    }
    this.agents.set(id, config);
    console.log(`[Registry] Registered agent: ${id} (${config.name})`);
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
