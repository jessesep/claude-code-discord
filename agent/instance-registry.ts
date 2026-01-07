/**
 * Agent Instance Registry - Ensures true agent isolation
 * 
 * This module provides a global registry for agent instances with:
 * - Unique instance IDs
 * - Hard channel/category binding (agents can ONLY respond in their bound channel)
 * - Isolated context windows (each instance has its own conversation history)
 * - Lifecycle management (spawn, bind, unbind, destroy)
 * 
 * The Agent ID format: `{agentType}-{channelId}-{timestamp}`
 * Example: `cursor-coder-1458487808132907183-1736300000000`
 */

import { AgentConfig, AgentSession, PREDEFINED_AGENTS } from "./types.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface AgentInstance {
  /** Unique instance ID: {agentType}-{channelId}-{timestamp} */
  id: string;
  
  /** The agent type (key in PREDEFINED_AGENTS) */
  agentType: string;
  
  /** The agent configuration (copied, not referenced) */
  config: AgentConfig;
  
  /** HARD BINDING: This agent can ONLY operate in this channel */
  boundChannelId: string;
  
  /** Optional category binding (all channels in category share this agent) */
  boundCategoryId?: string;
  
  /** The user who spawned this agent */
  ownerId: string;
  
  /** Isolated context window - this agent's conversation history */
  contextWindow: ConversationMessage[];
  
  /** Maximum context messages before truncation */
  maxContextSize: number;
  
  /** Instance lifecycle state */
  state: 'spawning' | 'active' | 'paused' | 'completed' | 'error';
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last activity timestamp */
  lastActivity: Date;
  
  /** Message count for this instance */
  messageCount: number;
  
  /** Estimated token usage */
  tokenUsage: number;
  
  /** Associated session (if any) */
  sessionId?: string;
  
  /** Error message if state is 'error' */
  errorMessage?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokenEstimate?: number;
}

export interface SpawnOptions {
  /** The agent type to spawn (key in PREDEFINED_AGENTS or custom config) */
  agentType: string;
  
  /** Channel ID to bind to (REQUIRED - hard binding) */
  channelId: string;
  
  /** Category ID for category-wide scope (optional) */
  categoryId?: string;
  
  /** User ID who is spawning the agent */
  ownerId: string;
  
  /** Override model (optional) */
  model?: string;
  
  /** Initial system prompt addition (optional) */
  systemPromptAddition?: string;
  
  /** Max context window size (default: 50 messages) */
  maxContextSize?: number;
  
  /** Custom agent config (overrides agentType lookup) */
  customConfig?: Partial<AgentConfig>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Global Registry
// ═══════════════════════════════════════════════════════════════════════════

/** Global registry of all active agent instances, keyed by instance ID */
const instanceRegistry: Map<string, AgentInstance> = new Map();

/** Index: channelId -> instanceIds (for quick lookup) */
const channelIndex: Map<string, Set<string>> = new Map();

/** Index: categoryId -> instanceIds (for category-wide agents) */
const categoryIndex: Map<string, Set<string>> = new Map();

/** Index: ownerId -> instanceIds (for user's agents) */
const ownerIndex: Map<string, Set<string>> = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique agent instance ID
 */
export function generateInstanceId(agentType: string, channelId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `${agentType}-${channelId.substring(0, 8)}-${timestamp}-${random}`;
}

/**
 * Spawn a new agent instance with hard channel binding
 * 
 * @returns The spawned AgentInstance
 * @throws Error if agentType not found or channel already has conflicting agent
 */
export function spawnAgentInstance(options: SpawnOptions): AgentInstance {
  const {
    agentType,
    channelId,
    categoryId,
    ownerId,
    model,
    systemPromptAddition,
    maxContextSize = 50,
    customConfig
  } = options;

  // Get base config from predefined agents or use custom
  let baseConfig = PREDEFINED_AGENTS[agentType];
  if (!baseConfig && !customConfig) {
    throw new Error(`Unknown agent type: ${agentType}. Use a predefined agent or provide customConfig.`);
  }

  // Build final config (copy to avoid mutations)
  const config: AgentConfig = {
    ...(baseConfig || {
      name: agentType,
      description: 'Custom agent',
      model: 'gemini-3-flash-preview',
      systemPrompt: '',
      temperature: 0.5,
      maxTokens: 4096,
      capabilities: [],
      riskLevel: 'medium' as const
    }),
    ...customConfig,
  };

  // Apply model override
  if (model) {
    config.model = model;
  }

  // Apply system prompt addition
  if (systemPromptAddition) {
    config.systemPrompt = `${config.systemPrompt}\n\n${systemPromptAddition}`;
  }

  // Generate instance ID
  const instanceId = generateInstanceId(agentType, channelId);

  // Create instance
  const instance: AgentInstance = {
    id: instanceId,
    agentType,
    config,
    boundChannelId: channelId,
    boundCategoryId: categoryId,
    ownerId,
    contextWindow: [],
    maxContextSize,
    state: 'active',
    createdAt: new Date(),
    lastActivity: new Date(),
    messageCount: 0,
    tokenUsage: 0,
  };

  // Register in all indexes
  instanceRegistry.set(instanceId, instance);

  // Channel index
  if (!channelIndex.has(channelId)) {
    channelIndex.set(channelId, new Set());
  }
  channelIndex.get(channelId)!.add(instanceId);

  // Category index (if applicable)
  if (categoryId) {
    if (!categoryIndex.has(categoryId)) {
      categoryIndex.set(categoryId, new Set());
    }
    categoryIndex.get(categoryId)!.add(instanceId);
  }

  // Owner index
  if (!ownerIndex.has(ownerId)) {
    ownerIndex.set(ownerId, new Set());
  }
  ownerIndex.get(ownerId)!.add(instanceId);

  console.log(`[InstanceRegistry] Spawned agent: ${instanceId} bound to channel ${channelId}`);
  return instance;
}

/**
 * Get an agent instance by ID
 */
export function getInstance(instanceId: string): AgentInstance | undefined {
  return instanceRegistry.get(instanceId);
}

/**
 * Get all agent instances bound to a specific channel
 * 
 * This is the PRIMARY lookup for message routing - ensures agents
 * can ONLY receive messages from their bound channel.
 */
export function getInstancesForChannel(channelId: string): AgentInstance[] {
  const instanceIds = channelIndex.get(channelId);
  if (!instanceIds) return [];
  
  return Array.from(instanceIds)
    .map(id => instanceRegistry.get(id))
    .filter((inst): inst is AgentInstance => inst !== undefined && inst.state === 'active');
}

/**
 * Get all agent instances for a category (category-wide agents)
 */
export function getInstancesForCategory(categoryId: string): AgentInstance[] {
  const instanceIds = categoryIndex.get(categoryId);
  if (!instanceIds) return [];
  
  return Array.from(instanceIds)
    .map(id => instanceRegistry.get(id))
    .filter((inst): inst is AgentInstance => inst !== undefined && inst.state === 'active');
}

/**
 * Get all agent instances owned by a user
 */
export function getInstancesForOwner(ownerId: string): AgentInstance[] {
  const instanceIds = ownerIndex.get(ownerId);
  if (!instanceIds) return [];
  
  return Array.from(instanceIds)
    .map(id => instanceRegistry.get(id))
    .filter((inst): inst is AgentInstance => inst !== undefined);
}

/**
 * Check if a message from a channel should be routed to an agent
 * Returns the matching agent instance or undefined if no match
 */
export function getRoutableInstance(
  channelId: string,
  ownerId?: string,
  agentType?: string
): AgentInstance | undefined {
  const channelInstances = getInstancesForChannel(channelId);
  
  if (channelInstances.length === 0) {
    return undefined;
  }

  // Filter by owner if specified
  let candidates = ownerId 
    ? channelInstances.filter(inst => inst.ownerId === ownerId)
    : channelInstances;

  // Filter by agent type if specified
  if (agentType) {
    candidates = candidates.filter(inst => inst.agentType === agentType);
  }

  // Return most recently active
  if (candidates.length > 0) {
    return candidates.sort((a, b) => 
      b.lastActivity.getTime() - a.lastActivity.getTime()
    )[0];
  }

  return undefined;
}

/**
 * Add a message to an agent's context window
 */
export function addToContext(
  instanceId: string,
  message: Omit<ConversationMessage, 'timestamp'>
): void {
  const instance = instanceRegistry.get(instanceId);
  if (!instance) {
    console.warn(`[InstanceRegistry] Cannot add to context: instance ${instanceId} not found`);
    return;
  }

  const fullMessage: ConversationMessage = {
    ...message,
    timestamp: new Date(),
    tokenEstimate: Math.ceil(message.content.length / 4), // Rough estimate
  };

  instance.contextWindow.push(fullMessage);
  instance.lastActivity = new Date();
  instance.messageCount++;
  instance.tokenUsage += fullMessage.tokenEstimate || 0;

  // Truncate if over limit (keep system messages)
  while (instance.contextWindow.length > instance.maxContextSize) {
    const oldest = instance.contextWindow.find(m => m.role !== 'system');
    if (oldest) {
      const idx = instance.contextWindow.indexOf(oldest);
      instance.contextWindow.splice(idx, 1);
    } else {
      break;
    }
  }
}

/**
 * Get the full context window for an agent instance
 */
export function getContext(instanceId: string): ConversationMessage[] {
  const instance = instanceRegistry.get(instanceId);
  if (!instance) return [];
  return [...instance.contextWindow];
}

/**
 * Update agent instance state
 */
export function updateInstanceState(
  instanceId: string,
  state: AgentInstance['state'],
  errorMessage?: string
): void {
  const instance = instanceRegistry.get(instanceId);
  if (!instance) return;

  instance.state = state;
  instance.lastActivity = new Date();
  if (errorMessage) {
    instance.errorMessage = errorMessage;
  }
}

/**
 * Destroy an agent instance (full cleanup)
 */
export function destroyInstance(instanceId: string): boolean {
  const instance = instanceRegistry.get(instanceId);
  if (!instance) return false;

  // Remove from all indexes
  instanceRegistry.delete(instanceId);

  const channelSet = channelIndex.get(instance.boundChannelId);
  if (channelSet) {
    channelSet.delete(instanceId);
    if (channelSet.size === 0) {
      channelIndex.delete(instance.boundChannelId);
    }
  }

  if (instance.boundCategoryId) {
    const categorySet = categoryIndex.get(instance.boundCategoryId);
    if (categorySet) {
      categorySet.delete(instanceId);
      if (categorySet.size === 0) {
        categoryIndex.delete(instance.boundCategoryId);
      }
    }
  }

  const ownerSet = ownerIndex.get(instance.ownerId);
  if (ownerSet) {
    ownerSet.delete(instanceId);
    if (ownerSet.size === 0) {
      ownerIndex.delete(instance.ownerId);
    }
  }

  console.log(`[InstanceRegistry] Destroyed agent: ${instanceId}`);
  return true;
}

/**
 * Destroy all instances for a channel (cleanup)
 */
export function destroyChannelInstances(channelId: string): number {
  const instanceIds = channelIndex.get(channelId);
  if (!instanceIds) return 0;

  let count = 0;
  for (const id of Array.from(instanceIds)) {
    if (destroyInstance(id)) count++;
  }
  return count;
}

/**
 * Destroy all instances for an owner (cleanup)
 */
export function destroyOwnerInstances(ownerId: string): number {
  const instanceIds = ownerIndex.get(ownerId);
  if (!instanceIds) return 0;

  let count = 0;
  for (const id of Array.from(instanceIds)) {
    if (destroyInstance(id)) count++;
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a summary of all active instances (for debugging/status)
 */
export function getRegistrySummary(): {
  totalInstances: number;
  activeInstances: number;
  byChannel: Record<string, number>;
  byOwner: Record<string, number>;
  byAgentType: Record<string, number>;
} {
  const instances = Array.from(instanceRegistry.values());
  const active = instances.filter(i => i.state === 'active');

  const byChannel: Record<string, number> = {};
  const byOwner: Record<string, number> = {};
  const byAgentType: Record<string, number> = {};

  for (const inst of instances) {
    byChannel[inst.boundChannelId] = (byChannel[inst.boundChannelId] || 0) + 1;
    byOwner[inst.ownerId] = (byOwner[inst.ownerId] || 0) + 1;
    byAgentType[inst.agentType] = (byAgentType[inst.agentType] || 0) + 1;
  }

  return {
    totalInstances: instances.length,
    activeInstances: active.length,
    byChannel,
    byOwner,
    byAgentType,
  };
}

/**
 * Validate that a message can be routed to an agent
 * Returns { valid: true, instance } or { valid: false, reason }
 */
export function validateMessageRouting(
  channelId: string,
  ownerId?: string
): { valid: true; instance: AgentInstance } | { valid: false; reason: string } {
  const instance = getRoutableInstance(channelId, ownerId);
  
  if (!instance) {
    return {
      valid: false,
      reason: `No active agent instance bound to channel ${channelId}`
    };
  }

  if (instance.state !== 'active') {
    return {
      valid: false,
      reason: `Agent ${instance.id} is in state '${instance.state}', not accepting messages`
    };
  }

  return { valid: true, instance };
}

/**
 * Clear all instances (for testing)
 */
export function clearAllInstances(): void {
  instanceRegistry.clear();
  channelIndex.clear();
  categoryIndex.clear();
  ownerIndex.clear();
  console.log('[InstanceRegistry] Cleared all instances');
}
