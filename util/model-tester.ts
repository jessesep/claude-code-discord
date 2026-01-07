/**
 * Model Tester - Tests all configured models on startup
 * Ensures we only use models that actually work, preventing runtime errors
 */

import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.21.0";
import { sendToAntigravityCLI } from "../claude/antigravity-client.ts";

export interface ModelTestResult {
  model: string;
  client: 'antigravity' | 'cursor' | 'claude';
  status: 'working' | 'failed' | 'unknown';
  error?: string;
  testDuration?: number;
}

export interface ModelTestResults {
  results: ModelTestResult[];
  testedAt: Date;
  workingModels: string[];
  failedModels: string[];
}

// Cache of test results
let modelTestCache: ModelTestResults | null = null;

/**
 * Test a single Gemini model
 */
async function testGeminiModel(modelName: string, authorized: boolean = false): Promise<ModelTestResult> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const testPrompt = "Say 'OK' if you can read this.";
    
    const result = await sendToAntigravityCLI(
      testPrompt,
      controller,
      {
        model: modelName,
        authorized,
        streamJson: false
      }
    );
    
    if (result && result.response) {
      return {
        model: modelName,
        client: 'antigravity',
        status: 'working',
        testDuration: Date.now() - startTime
      };
    } else {
      return {
        model: modelName,
        client: 'antigravity',
        status: 'failed',
        error: 'No response received',
        testDuration: Date.now() - startTime
      };
    }
  } catch (error) {
    return {
      model: modelName,
      client: 'antigravity',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      testDuration: Date.now() - startTime
    };
  }
}

/**
 * Test all models configured in the system
 */
export async function testAllModels(authorized: boolean = false): Promise<ModelTestResults> {
  console.log('[ModelTester] Starting model tests...');
  
  // Get all models from agent configurations
  const modelsToTest = new Set<string>();
  
  // Add models from PREDEFINED_AGENTS
  try {
    const { PREDEFINED_AGENTS } = await import("../agent/index.ts");
    for (const agent of Object.values(PREDEFINED_AGENTS)) {
      if (agent.client === 'antigravity' && agent.model) {
        modelsToTest.add(agent.model);
      }
    }
  } catch (error) {
    console.warn('[ModelTester] Could not load PREDEFINED_AGENTS:', error);
  }
  
  // Add common Gemini models to test
  const commonModels = [
    'gemini-3-flash-preview',
    'gemini-2.0-flash',
    'gemini-2.0-flash-thinking-exp',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash-latest', 
  ];
  
  for (const model of commonModels) {
    modelsToTest.add(model);
  }
  
  console.log(`[ModelTester] Testing ${modelsToTest.size} models...`);
  
  const results: ModelTestResult[] = [];
  const testPromises: Promise<ModelTestResult>[] = [];
  
  // Test all models (with some concurrency limit)
  for (const model of modelsToTest) {
    testPromises.push(testGeminiModel(model, authorized));
  }
  
  // Wait for all tests with timeout
  const testResults = await Promise.allSettled(testPromises);
  
  for (let i = 0; i < testResults.length; i++) {
    const result = testResults[i];
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      const modelName = Array.from(modelsToTest)[i];
      results.push({
        model: modelName,
        client: 'antigravity',
        status: 'failed',
        error: result.reason?.message || 'Test promise rejected'
      });
    }
  }
  
  const workingModels = results.filter(r => r.status === 'working').map(r => r.model);
  const failedModels = results.filter(r => r.status === 'failed').map(r => r.model);
  
  const finalResults: ModelTestResults = {
    results,
    testedAt: new Date(),
    workingModels,
    failedModels
  };
  
  modelTestCache = finalResults;
  
  console.log(`[ModelTester] Tests complete: ${workingModels.length} working, ${failedModels.length} failed`);
  if (failedModels.length > 0) {
    console.log(`[ModelTester] Failed models: ${failedModels.join(', ')}`);
  }
  
  return finalResults;
}

/**
 * Get the best available model for a given preference
 * Falls back to working alternatives if preferred model fails
 */
export function getBestAvailableModel(
  preferredModel: string,
  fallbackModels: string[] = []
): string {
  if (!modelTestCache) {
    console.warn('[ModelTester] No test results available, using preferred model');
    return preferredModel;
  }
  
  // Check if preferred model works
  if (modelTestCache.workingModels.includes(preferredModel)) {
    return preferredModel;
  }
  
  // Try fallbacks
  for (const fallback of fallbackModels) {
    if (modelTestCache.workingModels.includes(fallback)) {
      console.warn(`[ModelTester] Preferred model ${preferredModel} failed, using ${fallback}`);
      return fallback;
    }
  }
  
  // Use first working model as last resort
  if (modelTestCache.workingModels.length > 0) {
    const firstWorking = modelTestCache.workingModels[0];
    console.warn(`[ModelTester] Using fallback model: ${firstWorking}`);
    return firstWorking;
  }
  
  // No working models found - return preferred anyway (will fail at runtime)
  console.error(`[ModelTester] No working models found! Using ${preferredModel} (will likely fail)`);
  return preferredModel;
}

/**
 * Get cached test results
 */
export function getModelTestResults(): ModelTestResults | null {
  return modelTestCache;
}

/**
 * Format test results for Discord message
 */
export function formatModelTestResults(results: ModelTestResults): string {
  const working = results.workingModels.length;
  const failed = results.failedModels.length;
  const total = results.results.length;
  
  let message = `**Model Test Results** (${results.testedAt.toISOString()})\n\n`;
  message += `✅ **Working:** ${working}/${total}\n`;
  message += `❌ **Failed:** ${failed}/${total}\n\n`;
  
  if (results.workingModels.length > 0) {
    message += `**✅ Working Models:**\n`;
    for (const model of results.workingModels) {
      const result = results.results.find(r => r.model === model);
      const duration = result?.testDuration ? ` (${result.testDuration}ms)` : '';
      message += `• \`${model}\`${duration}\n`;
    }
    message += `\n`;
  }
  
  if (results.failedModels.length > 0) {
    message += `**❌ Failed Models:**\n`;
    for (const model of results.failedModels) {
      const result = results.results.find(r => r.model === model);
      const error = result?.error ? ` - ${result.error.substring(0, 100)}` : '';
      message += `• \`${model}\`${error}\n`;
    }
  }
  
  return message;
}
