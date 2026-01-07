/**
 * Primary CLI Client
 *
 * Spawns Primary CLI processes instead of using an API directly.
 * Provides streaming support and proper error handling.
 */

export interface PrimaryCLIResponse {
  response: string;
  cost?: number;
  duration?: number;
  modelUsed?: string;
}

// Alias for backward compatibility
export { sendToPrimaryCLI as sendToClaudeCLI };

/**
 * Send a prompt to Primary CLI and get streamed response
 *
 * @param systemPrompt - System instructions
 * @param userPrompt - User message/query
 * @param controller - AbortController for cancellation
 * @param model - Model identifier (default: claude-sonnet-4-5-20250929)
 * @param maxTokens - Maximum tokens to generate (default: 8000)
 * @param onChunk - Optional callback for streaming chunks
 * @returns PrimaryCLIResponse with full text and metadata
 */
export async function sendToPrimaryCLI(
  systemPrompt: string,
  userPrompt: string,
  controller: AbortController,
  model: string = "claude-sonnet-4-5-20250929",
  maxTokens: number = 8000,
  onChunk?: (text: string) => void
): Promise<PrimaryCLIResponse> {
  try {
    // Build Primary CLI command with correct options
    const cmd = new Deno.Command("claude", {
      args: [
        "--print",  // Non-interactive mode
        "--model", model,
        "--system-prompt", systemPrompt,  // System instructions
        "--dangerously-skip-permissions",
        userPrompt  // User prompt directly
      ],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
      signal: controller.signal
    });

    const startTime = Date.now();
    let fullResponse = "";
    let errorOutput = "";

    // Spawn the process
    const process = cmd.spawn();

    // Handle stdout streaming
    const stdoutReader = process.stdout.getReader();
    const decoder = new TextDecoder();

    // Read stdout in chunks
    const readStdout = async () => {
      try {
        while (true) {
          const { done, value } = await stdoutReader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;

          // Stream chunk to callback
          if (onChunk) {
            onChunk(chunk);
          }
        }
      } catch (error) {
        // Handle abort/cancellation gracefully
        if (error instanceof Error && error.name === "AbortError") {
          console.log("Primary CLI: Process cancelled by abort signal");
        } else {
          throw error;
        }
      } finally {
        stdoutReader.releaseLock();
      }
    };

    // Handle stderr
    const stderrReader = process.stderr.getReader();
    const readStderr = async () => {
      try {
        while (true) {
          const { done, value } = await stderrReader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          errorOutput += chunk;
        }
      } catch (error) {
        // Ignore abort errors on stderr
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Primary CLI stderr error:", error);
        }
      } finally {
        stderrReader.releaseLock();
      }
    };

    // Wait for both streams and process to complete
    await Promise.all([readStdout(), readStderr()]);

    const status = await process.status;
    const duration = Date.now() - startTime;

    // Check for cancellation
    if (controller.signal.aborted) {
      return {
        response: "Request was cancelled",
        duration,
        modelUsed: model
      };
    }

    // Check exit code
    if (!status.success) {
      // Exit code 143 = SIGTERM (normal cancellation)
      if (status.code === 143) {
        return {
          response: "Request was cancelled",
          duration,
          modelUsed: model
        };
      }

      // Other errors
      throw new Error(
        `Primary CLI exited with code ${status.code}\n` +
        `stderr: ${errorOutput}\n` +
        `stdout: ${fullResponse}`
      );
    }

    return {
      response: fullResponse || "No response received",
      duration,
      modelUsed: model
    };

  } catch (error) {
    // Handle abort errors
    if (error instanceof Error &&
        (error.name === "AbortError" || controller.signal.aborted)) {
      return {
        response: "Request was cancelled",
        modelUsed: model
      };
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Send a prompt to Primary CLI with retry logic
 */
export async function sendToPrimaryCLIWithRetry(
  systemPrompt: string,
  userPrompt: string,
  controller: AbortController,
  model: string = "claude-sonnet-4-5-20250929",
  maxTokens: number = 8000,
  onChunk?: (text: string) => void
): Promise<PrimaryCLIResponse> {
  try {
    return await sendToPrimaryCLI(
      systemPrompt,
      userPrompt,
      controller,
      model,
      maxTokens,
      onChunk
    );
  } catch (error) {
    // Check for rate limit (exit code 1)
    if (error instanceof Error &&
        (error.message.includes("exit code 1") ||
         error.message.includes("exited with code 1"))) {

      console.log("Rate limit detected, retrying with fallback model...");

      // Retry with fallback
      return await sendToPrimaryCLI(
        systemPrompt,
        userPrompt,
        controller,
        "claude-sonnet-4-20250514", // Fallback model
        maxTokens,
        onChunk
      );
    }

    // Re-throw other errors
    throw error;
  }
}
