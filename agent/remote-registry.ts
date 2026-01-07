import { RemoteAgentEndpoint } from "./types.ts";
import { SettingsPersistence } from "../util/settings-persistence.ts";

/**
 * Remote Agent Registry
 * 
 * Manages remote agent endpoints stored in unified settings.
 */
export class RemoteAgentRegistry {
  private static instance: RemoteAgentRegistry;
  private persistence: SettingsPersistence;

  private constructor() {
    this.persistence = SettingsPersistence.getInstance();
  }

  static getInstance(): RemoteAgentRegistry {
    if (!RemoteAgentRegistry.instance) {
      RemoteAgentRegistry.instance = new RemoteAgentRegistry();
    }
    return RemoteAgentRegistry.instance;
  }

  /**
   * Get all registered endpoints
   */
  getEndpoints(): RemoteAgentEndpoint[] {
    return this.persistence.getSettings().remoteEndpoints || [];
  }

  /**
   * Register a new remote endpoint
   */
  async register(endpoint: RemoteAgentEndpoint): Promise<void> {
    const settings = this.persistence.getSettings();
    const endpoints = [...(settings.remoteEndpoints || [])];
    
    const index = endpoints.findIndex(e => e.id === endpoint.id);
    if (index >= 0) {
      endpoints[index] = endpoint;
    } else {
      endpoints.push(endpoint);
    }
    
    await this.persistence.save({
      ...settings,
      remoteEndpoints: endpoints
    });
    
    console.log(`[RemoteRegistry] Registered endpoint: ${endpoint.id} (${endpoint.url})`);
  }

  /**
   * Unregister a remote endpoint
   */
  async unregister(id: string): Promise<boolean> {
    const settings = this.persistence.getSettings();
    const endpoints = (settings.remoteEndpoints || []).filter(e => e.id !== id);
    
    if (endpoints.length === (settings.remoteEndpoints || []).length) {
      return false;
    }
    
    await this.persistence.save({
      ...settings,
      remoteEndpoints: endpoints
    });
    
    console.log(`[RemoteRegistry] Unregistered endpoint: ${id}`);
    return true;
  }

  /**
   * Get endpoint by ID
   */
  getEndpoint(id: string): RemoteAgentEndpoint | undefined {
    return this.getEndpoints().find(e => e.id === id);
  }

  /**
   * Find endpoints by capability
   */
  getEndpointsByCapability(capability: string): RemoteAgentEndpoint[] {
    return this.getEndpoints().filter(e => e.capabilities.includes(capability));
  }

  /**
   * Find endpoints by provider
   */
  getEndpointsByProvider(provider: string): RemoteAgentEndpoint[] {
    return this.getEndpoints().filter(e => e.providers.includes(provider));
  }

  /**
   * Update endpoint status
   */
  async updateStatus(id: string, status: RemoteAgentEndpoint['status']): Promise<void> {
    const endpoint = this.getEndpoint(id);
    if (endpoint) {
      endpoint.status = status;
      endpoint.lastHealthCheck = new Date();
      await this.register(endpoint);
    }
  }

  /**
   * Perform health check on a specific endpoint
   */
  async healthCheck(id: string): Promise<boolean> {
    const endpoint = this.getEndpoint(id);
    if (!endpoint) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${endpoint.url}/health`, {
        headers: endpoint.apiKey ? { 'X-API-Key': endpoint.apiKey } : {},
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        endpoint.status = 'online';
        endpoint.providers = data.providers || endpoint.providers;
        endpoint.capabilities = data.capabilities || endpoint.capabilities;
        endpoint.lastHealthCheck = new Date();
        await this.register(endpoint);
        return true;
      }
    } catch (error) {
      console.warn(`[RemoteRegistry] Health check failed for ${id}:`, error);
    }

    endpoint.status = 'offline';
    endpoint.lastHealthCheck = new Date();
    await this.register(endpoint);
    return false;
  }

  /**
   * Perform health check on all endpoints
   */
  async healthCheckAll(): Promise<void> {
    const endpoints = this.getEndpoints();
    await Promise.all(endpoints.map(e => this.healthCheck(e.id)));
  }
}
