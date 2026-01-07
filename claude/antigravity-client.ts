import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.21.0";

/**
 * Antigravity Client (Real Implementation)
 * 
 * Uses Google's Generative AI SDK (Gemini) to power the "Antigravity" agent.
 * This replaces the CLI-based approach which was limited to GUI interactions.
 */

export interface AntigravityResponse {
  response: string;
  duration?: number;
  modelUsed?: string;
  chatId?: string;
}

export interface AntigravityOptions {
  model?: string;
  workspace?: string;
  streamJson?: boolean;
  force?: boolean;
  sandbox?: "enabled" | "disabled";
  authorized?: boolean;
  memorySessionId?: string;
}

// Environment variable for API Key
function getApiKey(): string | undefined {
  return Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
}

/**
 * Gcloud Token Manager
 * Handles caching and validation of OAuth tokens from gcloud CLI.
 * 
 * SECURITY NOTES:
 * - Tokens are cached in memory only (never persisted to disk)
 * - Tokens are validated before use
 * - Token expiry is checked with 5-minute buffer
 * - Tokens are cleared from memory after use when possible
 */
class GcloudTokenManager {
  private static instance: GcloudTokenManager;
  private token: string | null = null;
  private expiry: number = 0;
  private lastValidation: number = 0;

  private constructor() {}

  static getInstance(): GcloudTokenManager {
    if (!GcloudTokenManager.instance) {
      GcloudTokenManager.instance = new GcloudTokenManager();
    }
    return GcloudTokenManager.instance;
  }

  /**
   * Validate token format and basic structure
   */
  private isValidTokenFormat(token: string): boolean {
    // Google OAuth tokens are typically base64-encoded JWT-like strings
    // Basic validation: non-empty, reasonable length, no whitespace
    return token.length > 20 && token.length < 5000 && !/\s/.test(token);
  }

  /**
   * Get a fresh token from gcloud CLI
   */
  private async fetchNewToken(): Promise<string | null> {
    // Prefer Application Default Credentials (ADC) for better security
    const commands = [
      ["auth", "application-default", "print-access-token"],
      ["auth", "print-access-token"]
    ];

    for (const args of commands) {
      try {
        const cmd = new Deno.Command("gcloud", {
          args,
          stdout: "piped",
          stderr: "piped" // Capture stderr for better error handling
        });
        const output = await cmd.output();
        if (output.success) {
          const token = new TextDecoder().decode(output.stdout).trim();
          if (this.isValidTokenFormat(token)) {
            // Assume 1 hour expiry for gcloud tokens (standard OAuth token lifetime)
            // We'll refresh before expiry with 5-minute buffer
            this.token = token;
            this.expiry = Date.now() + 3600000; // 1 hour
            this.lastValidation = Date.now();
            return token;
          } else {
            console.warn("[GcloudTokenManager] Invalid token format received");
          }
        } else {
          const error = new TextDecoder().decode(output.stderr);
          if (!error.includes("not found") && !error.includes("not installed")) {
            console.warn(`[GcloudTokenManager] gcloud command failed: ${error}`);
          }
        }
      } catch (error) {
        // Command not found or other system error - try next method
        if (error instanceof Error && !error.message.includes("not found")) {
          console.warn(`[GcloudTokenManager] Error executing gcloud: ${error.message}`);
        }
      }
    }
    return null;
  }

  /**
   * Get a valid OAuth token, using cache if available and valid
   */
  async getToken(): Promise<string | null> {
    // Check if cached token is still valid (with 5 min buffer for safety)
    const now = Date.now();
    if (this.token && now < this.expiry - 300000) {
      // Re-validate token every 10 minutes to catch revocation
      if (now - this.lastValidation > 600000) {
        // Token might still be valid, but refresh to be safe
        const freshToken = await this.fetchNewToken();
        if (freshToken) return freshToken;
        // If refresh fails but we have a cached token, use it (will fail at API if invalid)
      }
      return this.token;
    }

    // Token expired or missing - fetch new one
    return await this.fetchNewToken();
  }

  /**
   * Clear cached token (for security/logout scenarios)
   */
  clearToken(): void {
    this.token = null;
    this.expiry = 0;
    this.lastValidation = 0;
  }

  /**
   * Check if gcloud CLI is available and authenticated
   */
  async isAvailable(): Promise<boolean> {
    try {
      const cmd = new Deno.Command("gcloud", {
        args: ["auth", "list", "--format=json"],
        stdout: "piped",
        stderr: "null"
      });
      const output = await cmd.output();
      if (output.success) {
        const accounts = JSON.parse(new TextDecoder().decode(output.stdout));
        return Array.isArray(accounts) && accounts.some((a: any) => a.status === "ACTIVE");
      }
    } catch {
      // gcloud not installed or not in PATH
    }
    return false;
  }
}

async function getGcloudToken(): Promise<string | null> {
  return await GcloudTokenManager.getInstance().getToken();
}

export async function sendToAntigravityCLI(
  prompt: string,
  controller: AbortController,
  options: AntigravityOptions = {},
  onChunk?: (text: string) => void
): Promise<AntigravityResponse> {
  const startTime = Date.now();
  const modelName = options.model || "gemini-3-flash-preview"; // Default to latest and fastest model

  // SECURITY: Prefer gcloud OAuth over API keys for better security and auditability
  // 1. Try gcloud OAuth Strategy (REST) - PREFERRED METHOD
  // Default to authorized=true for Antigravity agents (can be overridden)
  const useOAuth = options.authorized !== false; // Default to true unless explicitly disabled
  
  if (useOAuth) {
    const token = await getGcloudToken();
    if (token) {
      try {
        // Use Generative Language REST API with OAuth
        // Normalize model name for REST API
        const safeModel = modelName.includes("/") ? modelName : `models/${modelName}`;

        // Streaming endpoint: streamGenerateContent
        const method = options.streamJson ? "streamGenerateContent" : "generateContent";
        const url = `https://generativelanguage.googleapis.com/v1beta/${safeModel}:${method}?alt=sse`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-goog-user-project": Deno.env.get("GOOGLE_CLOUD_PROJECT") || "" // Optional but helpful
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          }),
          signal: controller.signal
        });

        if (response.ok) {
          let fullText = "";

          if (options.streamJson && onChunk) {
            // Robust SSE parsing
            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (controller.signal.aborted) {
                reader.releaseLock();
                break;
              }
              
              // Append new chunk to buffer
              buffer += decoder.decode(value, { stream: true });

              // SSE messages are separated by double newlines
              const messages = buffer.split("\n\n");
              // Keep the last partial message in the buffer
              buffer = messages.pop() || "";

              for (const message of messages) {
                // A message can have multiple lines (data:, event:, id:, etc.)
                const lines = message.split("\n");
                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    const data = line.substring(6).trim();
                    if (data === "[DONE]") continue;
                    
                    try {
                      const json = JSON.parse(data);
                      // Extract text from candidates (Gemini format)
                      const part = json.candidates?.[0]?.content?.parts?.[0]?.text;
                      if (part) {
                        fullText += part;
                        onChunk(part);
                      }
                    } catch (e) {
                      // Silently ignore invalid JSON within a data field
                      // or handle multi-line data if necessary
                    }
                  }
                }
              }
            }
            
            // Handle any remaining data in buffer
            if (buffer.startsWith("data: ")) {
              try {
                const data = buffer.substring(6).trim();
                const json = JSON.parse(data);
                const part = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (part) {
                  fullText += part;
                  onChunk(part);
                }
              } catch {}
            }
          } else {
            const json = await response.json();
            fullText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }

          // Save observation if memory session is active
          if (options.memorySessionId) {
            try {
              const { claudeMemService } = await import("../util/claude-mem-service.ts");
              await claudeMemService.savePromptResponse(options.memorySessionId, prompt, fullText);
            } catch (err) {
              console.warn("[Antigravity] Failed to save memory observation:", err);
            }
          }

          return {
            response: fullText,
            duration: Date.now() - startTime,
            modelUsed: modelName,
            chatId: `genai-oauth-${Date.now()}`
          };
        } else {
          // If response not OK, read error text
          const errText = await response.text();
          // Log but don't throw yet if we have an API key fallback
          const apiKey = getApiKey();
          if (apiKey) {
            console.warn(`[Antigravity] OAuth API error (${response.status}), trying API key fallback: ${errText}`);
          } else {
            throw new Error(`Gemini API Error (${response.status}): ${errText}`);
          }
        }
      } catch (error) {
        // If OAuth fails, log but don't throw yet if we have an API key fallback
        const apiKey = getApiKey();
        if (apiKey) {
          console.warn("[Antigravity] OAuth authentication failed, trying API key fallback:", error);
        } else {
          throw error;
        }
      }
    }
  }

  // 2. Fallback to API Key Strategy (SDK) - only if OAuth unavailable or failed
  // SECURITY NOTE: API keys are less secure than OAuth but provided as fallback
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      let fullText = "";

      if (options.streamJson && onChunk) {
        const result = await model.generateContentStream(prompt);
        for await (const chunk of result.stream) {
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          const chunkText = chunk.text();
          fullText += chunkText;
          onChunk(chunkText);
        }
      } else {
        const result = await model.generateContent(prompt);
        fullText = result.response.text();
      }

      console.warn("[Antigravity] Using API key fallback (OAuth preferred for security)");
      
      // Save observation if memory session is active
      if (options.memorySessionId) {
        try {
          const { claudeMemService } = await import("../util/claude-mem-service.ts");
          await claudeMemService.savePromptResponse(options.memorySessionId, prompt, fullText);
        } catch (err) {
          console.warn("[Antigravity] Failed to save memory observation:", err);
        }
      }

      return {
        response: fullText,
        duration: Date.now() - startTime,
        modelUsed: modelName,
        chatId: `genai-key-${Date.now()}`
      };
    } catch (error) {
      return handleError(error, controller, startTime, modelName);
    }
  }

  // No authentication method available
  if (!apiKey) {
    const gcloudManager = GcloudTokenManager.getInstance();
    const hasGcloud = await gcloudManager.isAvailable();
    
    if (!hasGcloud) {
      throw new Error(
        "Authentication failed. Please install and configure 'gcloud' CLI:\n" +
        "  1. Install: https://cloud.google.com/sdk/docs/install\n" +
        "  2. Run: gcloud auth login\n" +
        "  3. Run: gcloud auth application-default login\n\n" +
        "Alternatively, set GEMINI_API_KEY environment variable (less secure)."
      );
    } else {
      throw new Error(
        "gcloud is installed but not authenticated. Please run:\n" +
        "  gcloud auth login\n" +
        "  gcloud auth application-default login"
      );
    }
  }

  throw new Error(
    "Authentication failed. Both gcloud OAuth and API key methods failed. " +
    "Please check your API key or gcloud credentials."
  );
}

function handleError(error: unknown, controller: AbortController, startTime: number, modelName: string): never | AntigravityResponse {
  if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
    return {
      response: "Request was cancelled",
      duration: Date.now() - startTime,
      modelUsed: modelName
    };
  }
  throw error;
}
