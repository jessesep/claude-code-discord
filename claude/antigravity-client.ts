
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.1.3";

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
}

// Environment variable for API Key
const API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");

/**
 * Get Access Token from gcloud CLI
 * Prefers Application Default Credentials (ADC), falls back to user credentials.
 */
async function getGcloudToken(): Promise<string | null> {
  const commands = [
    ["auth", "application-default", "print-access-token"],
    ["auth", "print-access-token"]
  ];

  for (const args of commands) {
    try {
      const cmd = new Deno.Command("gcloud", {
        args,
        stdout: "piped",
        stderr: "null"
      });
      const output = await cmd.output();
      if (output.success) {
        return new TextDecoder().decode(output.stdout).trim();
      }
    } catch {
      // Try next method
    }
  }
  return null;
}

export async function sendToAntigravityCLI(
  prompt: string,
  controller: AbortController,
  options: AntigravityOptions = {},
  onChunk?: (text: string) => void
): Promise<AntigravityResponse> {
  const startTime = Date.now();
  const modelName = options.model || "gemini-2.0-flash-thinking-exp"; // Default to capable model

  // 1. Try API Key Strategy (SDK)
  if (API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
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

      return {
        response: fullText,
        duration: Date.now() - startTime,
        modelUsed: modelName,
        chatId: `genai-key-${Date.now()}`
      };
    } catch (error) {
      handleError(error, controller, startTime, modelName);
    }
  }

  // 2. Try gcloud OAuth Strategy (REST)
  const token = await getGcloudToken();
  if (token) {
    try {
      // Use Generative Language REST API with OAuth
      // Note: model name needs 'models/' prefix for REST usually, SDK handles it.
      // Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
      // Check if model already has prefix
      const safeModel = modelName.startsWith("models/") ? modelName : `models/${modelName}`;

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

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errText}`);
      }

      let fullText = "";

      if (options.streamJson && onChunk) {
        // Parse SSE stream
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          // SSE parsing is complex (data: {...}), simplified here assuming standard Gemini SSE format
          // Usually: 'data: ' + JSON
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const json = JSON.parse(line.substring(6));
                // Extract text from candidates
                const part = json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (part) {
                  fullText += part;
                  onChunk(part);
                }
              } catch (e) {
                // ignore incomplete json
              }
            }
          }
        }
      } else {
        const json = await response.json();
        fullText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }

      return {
        response: fullText,
        duration: Date.now() - startTime,
        modelUsed: modelName,
        chatId: `genai-oauth-${Date.now()}`
      };

    } catch (error) {
      handleError(error, controller, startTime, modelName);
    }
  }

  throw new Error(
    "Authentication failed. Please provide GEMINI_API_KEY environment variable OR install/configure 'gcloud' CLI with 'gcloud auth login'."
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
