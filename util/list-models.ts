/**
 * List Available Gemini Models
 * Fetches available models from Google's Generative AI API
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
    { name: 'gemini-3-flash', displayName: 'Gemini 3 Flash', supportsGenerateContent: true },
    { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportsGenerateContent: true },
    { name: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash (Experimental)', supportsGenerateContent: true },
    { name: 'gemini-2.0-flash-thinking-exp', displayName: 'Gemini 2.0 Flash Thinking', supportsGenerateContent: true },
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
