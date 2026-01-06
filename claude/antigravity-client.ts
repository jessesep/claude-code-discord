/**
 * Antigravity CLI Client
 *
 * Spawns Antigravity Agent CLI processes for code editing and analysis tasks.
 * Provides streaming support and proper error handling.
 */

export interface AntigravityResponse {
  response: string;
  duration?: number;
  modelUsed?: string;
  chatId?: string; // For session management
}

export interface AntigravityOptions {
  model?: string; // e.g., "gemini-2.0-flash-thinking-exp"
  workspace?: string; // Working directory path
  force?: boolean; // Auto-approve all operations
  sandbox?: "enabled" | "disabled"; // Sandbox mode
  resume?: string; // Chat ID to resume
  streamJson?: boolean; // Use stream-json format for real-time updates
}

/**
 * Send a prompt to Antigravity CLI and get streamed response
 *
 * @param prompt - Task description for Antigravity
 * @param controller - AbortController for cancellation
 * @param options - Antigravity configuration options
 * @param onChunk - Optional callback for streaming chunks
 * @returns AntigravityResponse with full text and metadata
 */
export async function sendToAntigravityCLI(
  prompt: string,
  controller: AbortController,
  options: AntigravityOptions = {},
  onChunk?: (text: string) => void
): Promise<AntigravityResponse> {
  try {
    // Build Antigravity CLI command arguments
    // Using 'agy' as the command based on research
    const args: string[] = [
      "agent",
      "--print", // Non-interactive mode
    ];

    // Add output format
    if (options.streamJson) {
      args.push("--output-format", "stream-json");
      args.push("--stream-partial-output");
    } else {
      args.push("--output-format", "json");
    }

    // Add optional flags
    if (options.model) {
      args.push("--model", options.model);
    }

    if (options.workspace) {
      args.push("--workspace", options.workspace);
    }

    if (options.force) {
      args.push("--force");
    }

    if (options.sandbox) {
      args.push("--sandbox", options.sandbox);
    }

    if (options.resume) {
      args.push("--resume", options.resume);
    }

    // Add prompt as last argument
    args.push(prompt);

    // Using 'agy' command
    const cmd = new Deno.Command("agy", {
      args,
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
      signal: controller.signal,
    });

    const startTime = Date.now();
    let fullResponse = "";
    let errorOutput = "";
    let chatId: string | undefined;

    // Spawn the process
    const process = cmd.spawn();

    // Handle stdout streaming
    const stdoutReader = process.stdout.getReader();
    const decoder = new TextDecoder();

    // Read stdout in chunks
    const readStdout = async () => {
      try {
        let buffer = "";

        while (true) {
          const { done, value } = await stdoutReader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          if (options.streamJson) {
            // Handle stream-json format (line-delimited JSON objects)
            buffer += chunk;
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const event = JSON.parse(line);

                  // Extract text from event - adapting to common patterns
                  // Antigravity might use different field names, but assuming similarity to Clause/Cursor
                  if (event.type === "text" && event.content) {
                    fullResponse += event.content;
                    if (onChunk) {
                      onChunk(event.content);
                    }
                  } else if (event.type === "content_block_delta" && event.delta?.text) {
                     // Alternate format support
                     fullResponse += event.delta.text;
                     if (onChunk) {
                       onChunk(event.delta.text);
                     }
                  }

                  // Extract chat ID if available
                  if (event.chatId) {
                    chatId = event.chatId;
                  }
                } catch (e) {
                  // Invalid JSON line, skip
                  console.warn("Invalid JSON in stream:", line);
                }
              }
            }
          } else {
            // Regular JSON or text output
            fullResponse += chunk;

            // Stream chunk to callback
            if (onChunk) {
              onChunk(chunk);
            }
          }
        }

        // Process remaining buffer for stream-json
        if (options.streamJson && buffer.trim()) {
          try {
            const event = JSON.parse(buffer);
            if (event.type === "text" && event.content) {
              fullResponse += event.content;
              if (onChunk) {
                onChunk(event.content);
              }
            }
            if (event.chatId) {
              chatId = event.chatId;
            }
          } catch (e) {
            // Ignore parse errors in final buffer
          }
        }
      } catch (error) {
        // Handle abort/cancellation gracefully
        if (error instanceof Error && error.name === "AbortError") {
          console.log("Antigravity CLI: Process cancelled by abort signal");
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
          console.error("Antigravity CLI stderr error:", error);
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
        modelUsed: options.model,
        chatId,
      };
    }

    // Check exit code
    if (!status.success) {
      // Exit code 143 = SIGTERM (normal cancellation)
      if (status.code === 143) {
        return {
          response: "Request was cancelled",
          duration,
          modelUsed: options.model,
          chatId,
        };
      }

      // Other errors
      throw new Error(
        `Antigravity CLI exited with code ${status.code}\n` +
          `stderr: ${errorOutput}\n` +
          `stdout: ${fullResponse}`
      );
    }

    // Parse JSON response if not using stream-json
    let finalResponse = fullResponse;
    if (!options.streamJson && fullResponse.trim()) {
      try {
        const parsed = JSON.parse(fullResponse);
        // Extract response text from JSON structure
        finalResponse = parsed.response || parsed.text || parsed.content || fullResponse;
        if (parsed.chatId) {
          chatId = parsed.chatId;
        }
      } catch (e) {
        // If parsing fails, use raw output
        console.warn("Could not parse Antigravity JSON response, using raw output");
      }
    }

    return {
      response: finalResponse || "No response received",
      duration,
      modelUsed: options.model,
      chatId,
    };
  } catch (error) {
    // Handle abort errors
    if (
      error instanceof Error &&
      (error.name === "AbortError" || controller.signal.aborted)
    ) {
      return {
        response: "Request was cancelled",
        modelUsed: options.model,
      };
    }

    // Re-throw other errors
    throw error;
  }
}
