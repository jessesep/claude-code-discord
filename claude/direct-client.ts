import Anthropic from "npm:@anthropic-ai/sdk@^0.32.0";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

// Check if API key is configured
if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "your_api_key_here") {
  console.error("\n❌ ANTHROPIC_API_KEY is not configured!");
  console.error("\nTo set it up:");
  console.error("  1. Edit ~/.zshrc and uncomment line 22");
  console.error("  2. Replace 'your_api_key_here' with your actual API key");
  console.error("  3. Get your API key from: https://console.anthropic.com/settings/keys");
  console.error("  4. Run: source ~/.zshrc");
  console.error("  5. Restart the bot\n");
}

// Direct Anthropic API client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export interface ClaudeResponse {
  response: string;
  cost?: number;
  duration?: number;
  modelUsed?: string;
  stopReason?: string;
}

/**
 * Send a prompt directly to Claude API with streaming support
 */
export async function sendToClaudeAPI(
  systemPrompt: string,
  userPrompt: string,
  controller: AbortController,
  model: string = "claude-sonnet-4-5-20250929",
  maxTokens: number = 8000,
  onChunk?: (text: string) => void
): Promise<ClaudeResponse> {
  const startTime = Date.now();
  let fullResponse = "";

  try {
    const stream = await anthropic.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
        stream: true,
      },
      {
        signal: controller.signal,
      }
    );

    for await (const event of stream) {
      if (controller.signal.aborted) {
        break;
      }

      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          const text = event.delta.text;
          fullResponse += text;

          if (onChunk) {
            onChunk(text);
          }
        }
      }
    }

    const duration = Date.now() - startTime;

    // Estimate cost (approximate based on model pricing)
    const inputTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const outputTokens = Math.ceil(fullResponse.length / 4);

    // Sonnet 4.5 pricing: $3/MTok input, $15/MTok output
    const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

    return {
      response: fullResponse || "No response received",
      cost,
      duration,
      modelUsed: model,
      stopReason: "end_turn",
    };
  } catch (error: any) {
    if (error.name === "AbortError" || controller.signal.aborted) {
      return {
        response: "Request was cancelled",
        duration: Date.now() - startTime,
        modelUsed: model,
        stopReason: "cancelled",
      };
    }

    throw error;
  }
}
