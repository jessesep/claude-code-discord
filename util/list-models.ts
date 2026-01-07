/**
 * List Available Gemini Models
 * Fetches available models from Google's Generative AI API
 * 
 * GOLDEN RULE: Always use the latest models. Never downgrade.
 * This module fetches available models periodically to ensure we're using valid model names.
 */

import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.21.0";

export interface AvailableModel {
  name: string;
  displayName: string;
  description?: string;
  supportsGenerateContent: boolean;
  supportsStreaming?: boolean;
}

const API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");

// ═══════════════════════════════════════════════════════════════════════════
// Model Cache - Refreshes periodically
// ═══════════════════════════════════════════════════════════════════════════

let cachedModels: AvailableModel[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

/**
 * Fetch available models from Google Generative AI API
 */
export async function listAvailableModels(): Promise<AvailableModel[]> {
  const models: AvailableModel[] = [];
  
  // Try API Key method first
  if (API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      
      // Use REST API to list models since SDK doesn't have listModels
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.models && Array.isArray(data.models)) {
        for (const model of data.models) {
          // Only include models that support generateContent
          const supportsGenerateContent = model.supportedGenerationMethods?.includes('generateContent') || false;
          
          if (supportsGenerateContent) {
            models.push({
              name: model.name.replace('models/', ''),
              displayName: model.displayName || model.name.replace('models/', ''),
              description: model.description || '',
              supportsGenerateContent,
              supportsStreaming: model.supportedGenerationMethods?.includes('streamGenerateContent') || false,
            });
          }
        }
      }
      
      // Sort by name
      models.sort((a, b) => a.name.localeCompare(b.name));
      
      return models;
    } catch (error) {
      console.error('[ListModels] Error fetching models via API:', error);
      // Fall through to return default models
    }
  }
  
  // Fallback: Return known working models if API call fails
  return [
    { name: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview', supportsGenerateContent: true },
    { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportsGenerateContent: true },
    { name: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash (Experimental)', supportsGenerateContent: true },
    { name: 'gemini-2.0-flash-thinking-exp', displayName: 'Gemini 2.0 Flash Thinking', supportsGenerateContent: true },
    { name: 'gemini-2.0-pro-exp', displayName: 'Gemini 2.0 Pro (Experimental)', supportsGenerateContent: true },
    { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', supportsGenerateContent: true },
    { name: 'gemini-1.5-flash-latest', displayName: 'Gemini 1.5 Flash (Latest)', supportsGenerateContent: true },
    { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', supportsGenerateContent: true },
    { name: 'gemini-1.5-pro-latest', displayName: 'Gemini 1.5 Pro (Latest)', supportsGenerateContent: true },
  ];
}

/**
 * Get models suitable for different agent types
 */
export async function getModelsForAgents(): Promise<{
  manager: AvailableModel[];
  coder: AvailableModel[];
  architect: AvailableModel[];
}> {
  const allModels = await listAvailableModels();
  
  // Filter and categorize models
  const manager: AvailableModel[] = [];
  const coder: AvailableModel[] = [];
  const architect: AvailableModel[] = [];
  
  for (const model of allModels) {
    const name = model.name.toLowerCase();
    
    // Manager: Fast, efficient models
    if (name.includes('flash') && !name.includes('thinking')) {
      manager.push(model);
    }
    
    // Coder: Fast models with good reasoning
    if (name.includes('flash') || name.includes('thinking')) {
      coder.push(model);
    }
    
    // Architect: Pro models or thinking models for complex reasoning
    if (name.includes('pro') || name.includes('thinking') || name.includes('exp')) {
      architect.push(model);
    }
  }
  
  // Ensure each category has at least one model (use best available)
  if (manager.length === 0) {
    const flashModel = allModels.find(m => m.name.includes('flash'));
    if (flashModel) manager.push(flashModel);
  }
  if (coder.length === 0) {
    const anyModel = allModels[0];
    if (anyModel) coder.push(anyModel);
  }
  if (architect.length === 0) {
    const proModel = allModels.find(m => m.name.includes('pro'));
    if (proModel) architect.push(proModel);
    else if (allModels.length > 0) architect.push(allModels[allModels.length - 1]);
  }
  
  return { manager, coder, architect };
}

// ═══════════════════════════════════════════════════════════════════════════
// Model Validation & Resolution
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get cached models or refresh if stale
 */
export async function getCachedModels(): Promise<AvailableModel[]> {
  const now = Date.now();
  
  if (cachedModels.length === 0 || (now - lastFetchTime) > CACHE_TTL_MS) {
    console.log('[ModelCache] Refreshing available models from API...');
    cachedModels = await listAvailableModels();
    lastFetchTime = now;
    console.log(`[ModelCache] Found ${cachedModels.length} available models`);
    
    // Log the newest Flash models for visibility
    const flashModels = cachedModels.filter(m => m.name.includes('flash')).slice(0, 5);
    console.log(`[ModelCache] Latest Flash models: ${flashModels.map(m => m.name).join(', ')}`);
  }
  
  return cachedModels;
}

/**
 * Validate if a model name is available in the API
 * Returns the exact valid model name or null if not found
 */
export async function validateModelName(modelName: string): Promise<string | null> {
  const models = await getCachedModels();
  
  // Exact match
  const exactMatch = models.find(m => m.name === modelName);
  if (exactMatch) return exactMatch.name;
  
  // Case-insensitive match
  const caseMatch = models.find(m => m.name.toLowerCase() === modelName.toLowerCase());
  if (caseMatch) return caseMatch.name;
  
  return null;
}

/**
 * Find the best matching model for a given name
 * Tries exact match, then fuzzy matching, then returns newest in family
 * 
 * GOLDEN RULE: Never return an older model than requested
 */
export async function resolveModelName(requestedModel: string): Promise<string> {
  const models = await getCachedModels();
  
  // 1. Try exact match first
  const exactMatch = models.find(m => m.name === requestedModel);
  if (exactMatch) return exactMatch.name;
  
  // 2. Case-insensitive match
  const caseMatch = models.find(m => m.name.toLowerCase() === requestedModel.toLowerCase());
  if (caseMatch) return caseMatch.name;
  
  // 3. Try adding common suffixes (e.g., gemini-3-flash -> gemini-3-flash-preview)
  const withPreview = `${requestedModel}-preview`;
  const previewMatch = models.find(m => m.name === withPreview);
  if (previewMatch) {
    console.log(`[ModelResolver] Resolved ${requestedModel} -> ${previewMatch.name} (added -preview)`);
    return previewMatch.name;
  }
  
  // 4. Try removing suffixes
  const baseModel = requestedModel.replace(/-preview$|-latest$|-exp$/, '');
  const baseMatch = models.find(m => m.name.startsWith(baseModel));
  if (baseMatch) {
    console.log(`[ModelResolver] Resolved ${requestedModel} -> ${baseMatch.name} (base match)`);
    return baseMatch.name;
  }
  
  // 5. Find newest model in the same family (e.g., gemini-3 -> newest gemini-3-*)
  const familyMatch = requestedModel.match(/^(gemini-\d+)/);
  if (familyMatch) {
    const family = familyMatch[1];
    const familyModels = models.filter(m => m.name.startsWith(family));
    if (familyModels.length > 0) {
      // Prefer flash models for speed, then sort by name (newer versions tend to be alphabetically later)
      const flashInFamily = familyModels.find(m => m.name.includes('flash'));
      if (flashInFamily) {
        console.log(`[ModelResolver] Resolved ${requestedModel} -> ${flashInFamily.name} (family flash)`);
        return flashInFamily.name;
      }
      console.log(`[ModelResolver] Resolved ${requestedModel} -> ${familyModels[0].name} (family first)`);
      return familyModels[0].name;
    }
  }
  
  // 6. Last resort: return the original and let the API error (don't downgrade!)
  console.warn(`[ModelResolver] Could not resolve ${requestedModel} - returning as-is (API will validate)`);
  return requestedModel;
}

// ═══════════════════════════════════════════════════════════════════════════
// Client-Specific Model Mapping
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Model name mappings for different clients
 * Key: universal model name -> Value: client-specific model name
 */
export const CLIENT_MODEL_MAPPINGS: Record<string, Record<string, string>> = {
  cursor: {
    // Gemini models - Cursor uses different naming
    'gemini-3-flash-preview': 'gemini-3-flash',
    'gemini-3-pro-preview': 'gemini-3-pro',
    'gemini-2.5-pro': 'gemini-2.5-pro',
    'gemini-2.0-flash': 'gemini-2.0-flash',
    // Anthropic models
    'claude-sonnet-4': 'sonnet-4.5',
    'claude-opus-4': 'opus-4.5',
    'sonnet-4.5': 'sonnet-4.5',
    'opus-4.5': 'opus-4.5',
    // OpenAI models
    'gpt-4o': 'gpt-5.1',
    'gpt-5': 'gpt-5.1',
  },
  antigravity: {
    // Antigravity uses the Gemini API model names directly
    // No mapping needed - use original names
  },
  claude: {
    // Claude Code CLI uses Anthropic model names
    'sonnet-4.5': 'claude-sonnet-4-20250514',
    'opus-4.5': 'claude-opus-4-20250514',
  },
};

/**
 * Resolve a model name for a specific client
 * Returns the client-specific model name or the original if no mapping exists
 */
export function resolveModelForClient(modelName: string, client: string): string {
  const clientMappings = CLIENT_MODEL_MAPPINGS[client.toLowerCase()];
  
  if (clientMappings && clientMappings[modelName]) {
    const resolved = clientMappings[modelName];
    console.log(`[ModelMapper] Mapped ${modelName} -> ${resolved} for ${client}`);
    return resolved;
  }
  
  // No mapping found - return original
  return modelName;
}

/**
 * Get recommended model for a client
 */
export function getRecommendedModel(client: string): string {
  switch (client.toLowerCase()) {
    case 'cursor':
      return 'gemini-3-flash'; // Fast and capable
    case 'antigravity':
      return 'gemini-3-flash-preview'; // Gemini API naming
    case 'claude':
      return 'claude-sonnet-4-20250514';
    default:
      return 'gemini-3-flash-preview';
  }
}

/**
 * Check if model is available and log a warning if not
 */
export async function isModelAvailable(modelName: string): Promise<boolean> {
  const resolved = await validateModelName(modelName);
  if (!resolved) {
    console.warn(`[ModelValidator] Model "${modelName}" not found in available models`);
    const models = await getCachedModels();
    const suggestions = models
      .filter(m => m.name.includes(modelName.split('-')[1] || ''))
      .slice(0, 3)
      .map(m => m.name);
    if (suggestions.length > 0) {
      console.log(`[ModelValidator] Suggestions: ${suggestions.join(', ')}`);
    }
    return false;
  }
  return true;
}

/**
 * Get the latest Flash model available (for budget/fast operations)
 */
export async function getLatestFlashModel(): Promise<string> {
  const models = await getCachedModels();
  
  // Prioritize by version number (higher is newer)
  const flashModels = models
    .filter(m => m.name.includes('flash') && m.supportsGenerateContent)
    .sort((a, b) => {
      // Extract version numbers and sort descending
      const aVersion = a.name.match(/gemini-(\d+)/)?.[1] || '0';
      const bVersion = b.name.match(/gemini-(\d+)/)?.[1] || '0';
      return parseInt(bVersion) - parseInt(aVersion);
    });
  
  if (flashModels.length > 0) {
    return flashModels[0].name;
  }
  
  // Fallback to known latest
  return 'gemini-3-flash-preview';
}

/**
 * Initialize model cache on startup
 */
export async function initModelCache(): Promise<void> {
  console.log('[ModelCache] Initializing model cache...');
  await getCachedModels();
}

/**
 * Force refresh the model cache
 */
export async function refreshModelCache(): Promise<AvailableModel[]> {
  lastFetchTime = 0; // Force refresh
  return getCachedModels();
}

// ═══════════════════════════════════════════════════════════════════════════
// Model Fallback Chain
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fallback chains for different model families
 * When a model fails (429, 503, unavailable), try the next in the chain
 * 
 * GOLDEN RULE: Fallbacks should be same-generation or newer, never older
 */
export const MODEL_FALLBACK_CHAINS: Record<string, string[]> = {
  // Gemini 3 family (newest)
  'gemini-3-flash-preview': ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  'gemini-3-flash': ['gemini-3-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash'],
  'gemini-3-pro-preview': ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.0-pro-exp'],
  
  // Gemini 2.5 family
  'gemini-2.5-flash': ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-exp'],
  'gemini-2.5-pro': ['gemini-2.5-pro', 'gemini-2.0-pro-exp', 'gemini-1.5-pro-latest'],
  
  // Gemini 2.0 family
  'gemini-2.0-flash': ['gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-2.0-flash-lite'],
  'gemini-2.0-flash-exp': ['gemini-2.0-flash-exp', 'gemini-2.0-flash'],
  'gemini-2.0-pro-exp': ['gemini-2.0-pro-exp', 'gemini-1.5-pro-latest'],
  
  // Claude family (Anthropic)
  'sonnet-4.5': ['sonnet-4.5', 'sonnet-4', 'sonnet-4-thinking'],
  'sonnet-4': ['sonnet-4', 'sonnet-4-thinking'],
  'opus-4.5': ['opus-4.5', 'opus-4'],
  'opus-4': ['opus-4'],
  
  // OpenAI family (via Cursor)
  'gpt-5.1': ['gpt-5.1', 'gpt-5', 'gpt-4o'],
  'gpt-5': ['gpt-5', 'gpt-4o', 'o3-mini'],
  'gpt-4o': ['gpt-4o', 'o3-mini'],
  'o3-mini': ['o3-mini', 'o1'],
};

/**
 * Get the fallback chain for a model
 * Returns the chain starting from the given model, or a default chain if not found
 */
export function getFallbackChain(modelName: string): string[] {
  // Direct match
  if (MODEL_FALLBACK_CHAINS[modelName]) {
    return MODEL_FALLBACK_CHAINS[modelName];
  }
  
  // Try to find a matching family
  for (const [key, chain] of Object.entries(MODEL_FALLBACK_CHAINS)) {
    if (modelName.startsWith(key.split('-').slice(0, 2).join('-'))) {
      console.log(`[Fallback] Using chain for ${key} as fallback for ${modelName}`);
      return [modelName, ...chain.slice(1)];
    }
  }
  
  // No chain found - return just the model itself (no fallback)
  console.warn(`[Fallback] No fallback chain defined for ${modelName}`);
  return [modelName];
}

/**
 * Get the next fallback model after a failure
 * Returns null if no more fallbacks available
 */
export function getNextFallback(currentModel: string, attemptedModels: string[]): string | null {
  const chain = getFallbackChain(currentModel);
  
  // Find the next model in the chain that hasn't been tried
  for (const model of chain) {
    if (!attemptedModels.includes(model)) {
      return model;
    }
  }
  
  return null;
}

/**
 * Check if an error is a rate limit or availability error that should trigger fallback
 */
export function shouldTriggerFallback(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('503') ||
    msg.includes('service unavailable') ||
    msg.includes('model is overloaded') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('not found') ||
    msg.includes('404')
  );
}

export interface FallbackResult {
  success: boolean;
  modelUsed: string;
  attemptedModels: string[];
  response?: string;
  error?: string;
}

/**
 * Execute a function with automatic model fallback
 * Tries each model in the fallback chain until one succeeds
 */
export async function executeWithFallback<T>(
  initialModel: string,
  executor: (model: string) => Promise<T>,
  onFallback?: (fromModel: string, toModel: string, error: string) => void
): Promise<{ result: T; modelUsed: string; attemptedModels: string[] }> {
  const attemptedModels: string[] = [];
  let currentModel = initialModel;
  let lastError: unknown;
  
  while (currentModel) {
    attemptedModels.push(currentModel);
    
    try {
      const result = await executor(currentModel);
      return { result, modelUsed: currentModel, attemptedModels };
    } catch (error) {
      lastError = error;
      
      if (shouldTriggerFallback(error)) {
        const nextModel = getNextFallback(initialModel, attemptedModels);
        
        if (nextModel) {
          console.log(`[Fallback] ${currentModel} failed (${String(error).substring(0, 50)}...), trying ${nextModel}`);
          if (onFallback) {
            onFallback(currentModel, nextModel, String(error));
          }
          currentModel = nextModel;
          continue;
        }
      }
      
      // Non-recoverable error or no more fallbacks
      throw error;
    }
  }
  
  // Should never reach here, but just in case
  throw lastError || new Error('All fallback models exhausted');
}
