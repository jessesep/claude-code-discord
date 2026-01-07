/**
 * one agent discord - E2E Testing Utilities
 * 
 * This module provides the foundation for end-to-end testing of the one agent discord system.
 * It serves as a REFERENCE IMPLEMENTATION for agent spawning patterns.
 * 
 * ## Usage Patterns
 * 
 * ### Basic Test Setup
 * ```typescript
 * const ctx = await createTestContext('e2e-basic');
 * const result = await spawnAgent(ctx, 'cursor-coder', 'Create a hello.txt file');
 * ```
 * 
 * ### Custom Channel
 * ```typescript
 * const ctx = await createTestContext({ channelId: 'custom-id' });
 * ```
 * 
 * ### Agent Spawning (Reference Pattern)
 * ```typescript
 * // For future utilities that need to spawn agents programmatically
 * const prompt = buildAgentPrompt({
 *   agent: 'cursor-coder',
 *   model: 'gemini-3-flash',
 *   task: 'Your task here'
 * });
 * ```
 */

import { Client, GatewayIntentBits, TextChannel, Message, ChannelType } from 'npm:discord.js@14';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Main bot ID that processes agent requests */
export const ONE_BOT_ID = Deno.env.get('ONE_BOT_ID') || '1457705423137275914';

/** Test bot token for sending test commands */
export const TEST_BOT_TOKEN = Deno.env.get('TEST_BOT_TOKEN') || '';

/** Guild ID for testing */
export const TEST_GUILD_ID = Deno.env.get('TEST_GUILD_ID') || '1457712106399862786';

/**
 * Testing channel registry - maps test types to dedicated channels
 * These channels are in the [TESTING] category and should NEVER be production channels
 */
export const TEST_CHANNELS = {
  // Primary testing channels
  'e2e-basic': '1458487808132907183',
  'e2e-multi-file': '1458487810377125918',
  'e2e-error-recovery': '1458487811513520132',
  'e2e-orchestration': '1458487813401083944',
  
  // Aliases for convenience
  'default': '1458487808132907183',
  'basic': '1458487808132907183',
  'multi-file': '1458487810377125918',
  'error': '1458487811513520132',
  'orchestration': '1458487813401083944',
} as const;

export type TestChannelType = keyof typeof TEST_CHANNELS;

// =============================================================================
// AGENT CONFIGURATION (Reference for agent spawning)
// =============================================================================

/**
 * Available agents and their recommended configurations
 * This serves as a REFERENCE for agent spawning in other utilities
 */
export const AGENT_CONFIGS = {
  'cursor-coder': {
    name: 'cursor-coder',
    displayName: 'one coder (autonomous)',
    description: 'Autonomous coding agent with file editing capabilities',
    recommendedModel: 'sonnet-4.5',
    budgetModel: 'gemini-3-flash',
    capabilities: ['file-editing', 'code-generation', 'shell-commands'],
    defaultTimeout: 180000, // 3 minutes
  },
  'cursor-architect': {
    name: 'cursor-architect',
    displayName: 'one architect',
    description: 'System design and architecture planning',
    recommendedModel: 'gemini-2.5-pro',
    budgetModel: 'gemini-3-flash',
    capabilities: ['planning', 'architecture', 'documentation'],
    defaultTimeout: 120000,
  },
  'cursor-tester': {
    name: 'cursor-tester',
    displayName: 'one tester',
    description: 'Test writing and validation',
    recommendedModel: 'gemini-2.0-flash',
    budgetModel: 'gemini-3-flash',
    capabilities: ['testing', 'validation', 'qa'],
    defaultTimeout: 120000,
  },
  'cursor-reviewer': {
    name: 'cursor-reviewer',
    displayName: 'one reviewer',
    description: 'Code review and feedback',
    recommendedModel: 'gemini-2.0-flash',
    budgetModel: 'gemini-3-flash',
    capabilities: ['review', 'feedback', 'best-practices'],
    defaultTimeout: 90000,
  },
} as const;

export type AgentType = keyof typeof AGENT_CONFIGS;

/**
 * Model tiers for cost management
 */
export const MODEL_TIERS = {
  budget: 'gemini-3-flash',
  standard: 'gemini-2.0-flash',
  premium: 'gemini-2.5-pro',
  autonomous: 'sonnet-4.5',
} as const;

// =============================================================================
// TEST CONTEXT
// =============================================================================

export interface TestContext {
  /** Discord client for the test bot */
  tester: Client;
  /** Channel where tests are executed */
  channel: TextChannel;
  /** Test start timestamp */
  startTime: number;
  /** Channel type for logging */
  channelType: string;
}

export interface TestContextOptions {
  /** Specific channel ID to use */
  channelId?: string;
  /** Test channel type from registry */
  channelType?: TestChannelType;
  /** Custom intents (default: Guilds, GuildMessages) */
  intents?: GatewayIntentBits[];
}

/**
 * Create a test context with dynamic channel selection
 * 
 * @param options - Channel type string or options object
 * @returns TestContext ready for testing
 * 
 * @example
 * // Use registered test channel
 * const ctx = await createTestContext('e2e-basic');
 * 
 * @example
 * // Use custom channel ID
 * const ctx = await createTestContext({ channelId: '123456789' });
 */
export async function createTestContext(
  options: TestChannelType | TestContextOptions = 'default'
): Promise<TestContext> {
  if (!TEST_BOT_TOKEN) {
    throw new Error('TEST_BOT_TOKEN environment variable is required');
  }

  // Normalize options
  const opts: TestContextOptions = typeof options === 'string' 
    ? { channelType: options }
    : options;

  // Resolve channel ID
  const channelType = opts.channelType || 'default';
  const channelId = opts.channelId || TEST_CHANNELS[channelType] || TEST_CHANNELS.default;

  const intents = opts.intents || [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ];

  const tester = new Client({ intents });

  return new Promise((resolve, reject) => {
    tester.once('ready', async () => {
      try {
        const channel = await tester.channels.fetch(channelId);
        if (!channel || !(channel instanceof TextChannel)) {
          throw new Error(`Could not find test channel: ${channelId} (type: ${channelType})`);
        }
        
        console.log(`✅ Test context created for #${channel.name} (${channelType})`);
        
        resolve({
          tester,
          channel,
          startTime: Date.now(),
          channelType,
        });
      } catch (err) {
        tester.destroy();
        reject(err);
      }
    });
    
    tester.login(TEST_BOT_TOKEN).catch(reject);
  });
}

/** @deprecated Use createTestContext instead */
export const setupTester = () => createTestContext('default');

// =============================================================================
// AGENT SPAWNING (Reference Pattern)
// =============================================================================

export interface AgentPromptOptions {
  /** Agent type to use */
  agent: AgentType | string;
  /** Task description */
  task: string;
  /** Model to use (optional, defaults to agent's budget model) */
  model?: string;
  /** Use budget tier automatically */
  useBudget?: boolean;
  /** Additional flags or options */
  flags?: string[];
}

/**
 * Build an agent prompt for Discord
 * This is the REFERENCE PATTERN for constructing agent spawn commands
 * 
 * @example
 * const prompt = buildAgentPrompt({
 *   agent: 'cursor-coder',
 *   task: 'Create a hello.txt file',
 *   useBudget: true
 * });
 * // Returns: "<@BOT_ID> using cursor-coder, with model="gemini-3-flash", Create a hello.txt file"
 */
export function buildAgentPrompt(options: AgentPromptOptions): string {
  const { agent, task, model, useBudget = true, flags = [] } = options;
  
  // Get agent config if available
  const agentConfig = AGENT_CONFIGS[agent as AgentType];
  
  // Determine model
  let selectedModel = model;
  if (!selectedModel && agentConfig) {
    selectedModel = useBudget ? agentConfig.budgetModel : agentConfig.recommendedModel;
  }
  if (!selectedModel) {
    selectedModel = MODEL_TIERS.budget;
  }

  // Build prompt parts
  const parts = [`<@${ONE_BOT_ID}> using ${agent}`];
  
  if (selectedModel) {
    parts.push(`with model="${selectedModel}"`);
  }
  
  if (flags.length > 0) {
    parts.push(flags.join(' '));
  }
  
  parts.push(task);
  
  return parts.join(', ');
}

/** @deprecated Use buildAgentPrompt instead */
export function getBudgetPrompt(agent: string, task: string): string {
  return buildAgentPrompt({ agent, task, useBudget: true });
}

/** @deprecated Use MODEL_TIERS.budget instead */
export const BUDGET_MODEL = MODEL_TIERS.budget;

// =============================================================================
// AGENT SPAWNING HELPER
// =============================================================================

export interface SpawnResult {
  success: boolean;
  messages: Message[];
  duration: number;
  error?: string;
}

/**
 * Spawn an agent and wait for completion
 * This is the HIGH-LEVEL API for running agent tasks in tests
 * 
 * @example
 * const result = await spawnAgent(ctx, 'cursor-coder', 'Create hello.txt');
 * if (result.success) {
 *   console.log('Agent completed in', result.duration, 'ms');
 * }
 */
export async function spawnAgent(
  ctx: TestContext,
  agent: AgentType | string,
  task: string,
  options: {
    model?: string;
    timeout?: number;
    useBudget?: boolean;
  } = {}
): Promise<SpawnResult> {
  const startTime = Date.now();
  
  // Get default timeout from agent config
  const agentConfig = AGENT_CONFIGS[agent as AgentType];
  const timeout = options.timeout || agentConfig?.defaultTimeout || 120000;
  
  // Build and send prompt
  const prompt = buildAgentPrompt({
    agent,
    task,
    model: options.model,
    useBudget: options.useBudget ?? true,
  });
  
  console.log(`📤 Spawning ${agent}: "${task.substring(0, 50)}..."`);
  await ctx.channel.send(prompt);
  
  // Wait for result
  const result = await waitForResult(ctx, timeout, isFinalResponse);
  
  return {
    ...result,
    duration: Date.now() - startTime,
  };
}

// =============================================================================
// MESSAGE WAITING & CONDITIONS
// =============================================================================

/**
 * Wait for messages matching a condition
 */
export async function waitForResult(
  ctx: TestContext, 
  timeoutMs: number,
  condition: (messages: Message[]) => boolean
): Promise<{ success: boolean; messages: Message[]; error?: string }> {
  const messagesMap = new Map<string, Message>();
  
  return new Promise((resolve) => {
    const onMessage = (msg: Message) => {
      if (msg.channelId !== ctx.channel.id) return;
      if (msg.author.id === ctx.tester.user?.id) return;
      
      console.log(`📩 Message from ${msg.author.tag}: ${msg.content || '(embed)'}`);
      if (msg.embeds.length > 0) {
        msg.embeds.forEach(e => console.log(`   Embed Title: ${e.title}, Desc: ${e.description?.substring(0, 50)}...`));
      }
      
      messagesMap.set(msg.id, msg);
      const messages = Array.from(messagesMap.values());
      if (condition(messages)) {
        cleanup();
        resolve({ success: true, messages });
      }
    };

    const onUpdate = (_oldMsg: Message, newMsg: Message) => {
      if (newMsg.channelId !== ctx.channel.id) return;
      if (newMsg.author.id === ctx.tester.user?.id) return;
      
      console.log(`🔄 Update from ${newMsg.author.tag}: ${newMsg.content || '(embed)'}`);
      if (newMsg.embeds.length > 0) {
        newMsg.embeds.forEach(e => console.log(`   Embed Title: ${e.title}, Desc: ${e.description?.substring(0, 50)}...`));
      }

      messagesMap.set(newMsg.id, newMsg);
      const messages = Array.from(messagesMap.values());
      if (condition(messages)) {
        cleanup();
        resolve({ success: true, messages });
      }
    };

    const cleanup = () => {
      ctx.tester.off('messageCreate', onMessage);
      ctx.tester.off('messageUpdate', onUpdate);
      clearTimeout(timeout);
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ 
        success: false, 
        messages: Array.from(messagesMap.values()), 
        error: `Timed out after ${timeoutMs/1000}s` 
      });
    }, timeoutMs);

    ctx.tester.on('messageCreate', onMessage);
    ctx.tester.on('messageUpdate', onUpdate);
  });
}

// =============================================================================
// RESPONSE CONDITIONS
// =============================================================================

/**
 * Check if any message indicates task completion
 */
export const isFinalResponse = (messages: Message[]): boolean => {
  return messages.some(r => 
    r.author.id === ONE_BOT_ID && 
    (r.content?.toLowerCase().includes('task completed') || 
     r.content?.toLowerCase().includes('done.') ||
     r.embeds?.some((e) => 
      e.title?.toLowerCase().includes('result') || 
      e.title?.toLowerCase().includes('completed') ||
      e.title?.toLowerCase().includes('summary') ||
      e.title?.includes('✅') ||
      e.title?.includes('🏁') ||
      e.description?.toLowerCase().includes('successfully') ||
      e.description?.toLowerCase().includes('created') ||
      e.description?.toLowerCase().includes('finished') ||
      e.description?.toLowerCase().includes('done') ||
      e.fields?.some((f) => 
        (f.name.toLowerCase().includes('status') && f.value.toLowerCase().includes('complete')) ||
        (f.name.toLowerCase().includes('result') && f.value.length > 0)
      )
    ))
  );
};

/**
 * Check if any message indicates an error
 */
export const hasError = (messages: Message[]): boolean => {
  return messages.some(r => 
    r.author.id === ONE_BOT_ID && 
    (r.content?.toLowerCase().includes('error') || 
     r.content?.toLowerCase().includes('not found') ||
     r.content?.toLowerCase().includes('does not exist') ||
     r.embeds?.some((e) => 
       e.title?.toLowerCase().includes('error') || 
       e.title?.includes('❌') ||
       e.description?.toLowerCase().includes('error') ||
       e.description?.toLowerCase().includes('failed') ||
       e.description?.toLowerCase().includes('not found') ||
       e.description?.toLowerCase().includes('does not exist')
     ))
  );
};

/**
 * Check if agent is still processing
 */
export const isProcessing = (messages: Message[]): boolean => {
  return messages.some(r => 
    r.author.id === ONE_BOT_ID && 
    r.embeds?.some((e) => 
      e.title?.toLowerCase().includes('processing') ||
      e.title?.includes('🤖') ||
      e.description?.toLowerCase().includes('working') ||
      e.description?.toLowerCase().includes('analyzing')
    )
  );
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get channel ID for a test type, with dynamic discovery fallback
 */
export async function getTestChannelId(
  client: Client,
  testType: TestChannelType
): Promise<string> {
  // First try the registry
  if (TEST_CHANNELS[testType]) {
    return TEST_CHANNELS[testType];
  }
  
  // Fallback: try to discover channel by name
  const guild = await client.guilds.fetch(TEST_GUILD_ID);
  const channels = await guild.channels.fetch();
  
  const testChannel = channels.find(c => 
    c?.type === ChannelType.GuildText && 
    c.name.includes(testType) &&
    (c.parent?.name.toLowerCase().includes('test') || c.name.includes('e2e'))
  );
  
  if (testChannel) {
    console.log(`📍 Discovered test channel: #${testChannel.name} (${testChannel.id})`);
    return testChannel.id;
  }
  
  throw new Error(`Could not find test channel for type: ${testType}`);
}

/**
 * Clean up test context
 */
export async function cleanupTestContext(ctx: TestContext): Promise<void> {
  const duration = Date.now() - ctx.startTime;
  console.log(`🧹 Cleaning up test context (ran for ${duration}ms)`);
  ctx.tester.destroy();
}

/**
 * Run a test with automatic cleanup
 */
export async function withTestContext<T>(
  channelType: TestChannelType,
  fn: (ctx: TestContext) => Promise<T>
): Promise<T> {
  const ctx = await createTestContext(channelType);
  try {
    return await fn(ctx);
  } finally {
    await cleanupTestContext(ctx);
  }
}

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility)
// =============================================================================

/** @deprecated Use TEST_CHANNELS.default */
export const CHANNEL_ID = TEST_CHANNELS.default;
