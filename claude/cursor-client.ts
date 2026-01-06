/**
 * Cursor CLI Client
 *
 * Spawns Cursor Agent CLI processes for code editing and analysis tasks.
 * Provides streaming support and proper error handling.
 *
 * Based on research from docs/CURSOR-INTEGRATION.md and docs/CURSOR-QUICK-REFERENCE.md
 */

export interface CursorResponse {
  response: string;
  duration?: number;
  modelUsed?: string;
  chatId?: string; // For session management
}

export interface CursorOptions {
  model?: string; // e.g., "sonnet-4", "gpt-5", "sonnet-4-thinking"
  workspace?: string; // Working directory path
  force?: boolean; // Auto-approve all operations
  sandbox?: "enabled" | "disabled"; // Sandbox mode
  resume?: string; // Chat ID to resume
  streamJson?: boolean; // Use stream-json format for real-time updates
}

/**
 * Send a prompt to Cursor Agent CLI and get streamed response
 *
 * @param prompt - Task description for Cursor
 * @param controller - AbortController for cancellation
 * @param options - Cursor configuration options
 * @param onChunk - Optional callback for streaming chunks
 * @returns CursorResponse with full text and metadata
 */
export async function sendToCursorCLI(
  prompt: string,
  controller: AbortController,
  options: CursorOptions = {},
  onChunk?: (text: string) => void
): Promise<CursorResponse> {
  try {
    // Build Cursor CLI command arguments
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

    // Log the full command for debugging
    console.log("[Cursor CLI] Executing command:", "cursor", args.join(" "));
    console.log("[Cursor CLI] Prompt:", prompt.substring(0, 200) + (prompt.length > 200 ? "..." : ""));

    const cmd = new Deno.Command("cursor", {
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
    console.log("[Cursor CLI] Spawning process...");
    const process = cmd.spawn();

    // Handle stdout streaming
    const stdoutReader = process.stdout.getReader();
    const decoder = new TextDecoder();

    // Read stdout in chunks
    const readStdout = async () => {
      try {
        let buffer = "";
        let chunkCount = 0;

        while (true) {
          const { done, value } = await stdoutReader.read();
          if (done) {
            console.log("[Cursor CLI] stdout stream ended. Total chunks:", chunkCount);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          chunkCount++;
          console.log(`[Cursor CLI] stdout chunk #${chunkCount} (${chunk.length} bytes):`, chunk.substring(0, 500));

          if (options.streamJson) {
            // Handle stream-json format (line-delimited JSON objects)
            buffer += chunk;
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const event = JSON.parse(line);

                  // Extract text from various event types
                  // Cursor uses: "assistant" for streaming text, "result" for final response
                  if (event.type === "text" && event.content) {
                    fullResponse += event.content;
                    if (onChunk) {
                      onChunk(event.content);
                    }
                  } else if (event.type === "assistant" && event.message?.content) {
                    // Handle assistant message events (streaming chunks)
                    for (const part of event.message.content) {
                      if (part.type === "text" && part.text) {
                        // Only add if this is incremental (not the full accumulated message)
                        // The final chunk contains the full message, so skip incremental ones
                        if (!event.message.content[0]?.text?.includes("\n") || event.message.content.length === 1) {
                          // Stream the chunk
                          if (onChunk) {
                            onChunk(part.text);
                          }
                        }
                      }
                    }
                  } else if (event.type === "result" && event.result) {
                    // Final result - this is the complete response
                    fullResponse = event.result;
                    console.log("[Cursor CLI] Got final result:", event.result.substring(0, 200));
                  }

                  // Extract session ID / chat ID if available
                  if (event.session_id) {
                    chatId = event.session_id;
                  }
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
            } else if (event.type === "result" && event.result) {
              fullResponse = event.result;
              console.log("[Cursor CLI] Got final result from buffer:", event.result.substring(0, 200));
            }
            if (event.session_id) {
              chatId = event.session_id;
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
          console.log("Cursor CLI: Process cancelled by abort signal");
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
          console.log("[Cursor CLI] stderr chunk:", chunk);
        }
      } catch (error) {
        // Ignore abort errors on stderr
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Cursor CLI stderr error:", error);
        }
      } finally {
        stderrReader.releaseLock();
      }
    };

    // Wait for both streams and process to complete
    await Promise.all([readStdout(), readStderr()]);

    const status = await process.status;
    const duration = Date.now() - startTime;

    console.log("[Cursor CLI] Process completed. Exit code:", status.code, "Duration:", duration, "ms");
    console.log("[Cursor CLI] Full response length:", fullResponse.length);
    console.log("[Cursor CLI] Full response:", fullResponse.substring(0, 1000) + (fullResponse.length > 1000 ? "..." : ""));
    console.log("[Cursor CLI] Error output:", errorOutput || "(none)");

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

      // Handle ConnectError (HTTP/2 stream cancellation)
      if (errorOutput.includes("ConnectError") || errorOutput.includes("[canceled]") || errorOutput.includes("CANCEL")) {
        const isTimeout = errorOutput.includes("timeout") || duration > 300000; // 5 minutes
        const errorMsg = isTimeout
          ? "Cursor CLI request timed out. The operation took too long and was cancelled. Try breaking your request into smaller tasks."
          : "Cursor CLI connection was cancelled. This may be due to network issues or the request being interrupted. Please try again.";
        
        throw new Error(errorMsg);
      }

      // Other errors
      throw new Error(
        `Cursor CLI exited with code ${status.code}\n` +
          `stderr: ${errorOutput}\n` +
          `stdout: ${fullResponse}`
      );
    }

    // Parse JSON response if not using stream-json
    let finalResponse = fullResponse;
    console.log("[Cursor CLI] Parsing response. streamJson:", options.streamJson);
    
    if (!options.streamJson && fullResponse.trim()) {
      try {
        const parsed = JSON.parse(fullResponse);
        console.log("[Cursor CLI] Parsed JSON keys:", Object.keys(parsed));
        console.log("[Cursor CLI] Parsed JSON:", JSON.stringify(parsed).substring(0, 500));
        // Extract response text from JSON structure
        finalResponse = parsed.response || parsed.text || parsed.result || parsed.output || parsed.message || fullResponse;
        console.log("[Cursor CLI] Extracted finalResponse:", finalResponse?.substring(0, 300));
        if (parsed.chatId) {
          chatId = parsed.chatId;
        }
      } catch (e) {
        // If parsing fails, use raw output
        console.warn("[Cursor CLI] Could not parse JSON response:", e);
        console.log("[Cursor CLI] Using raw output as finalResponse");
      }
    }

    console.log("[Cursor CLI] Final response to return:", (finalResponse || "No response received").substring(0, 300));

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

/**
 * Send a prompt to Cursor CLI with retry logic
 * Falls back to a different model on failure
 */
export async function sendToCursorCLIWithRetry(
  prompt: string,
  controller: AbortController,
  options: CursorOptions = {},
  onChunk?: (text: string) => void
): Promise<CursorResponse> {
  try {
    return await sendToCursorCLI(prompt, controller, options, onChunk);
  } catch (error) {
    // Check for rate limit or model-specific errors
    if (
      error instanceof Error &&
      (error.message.includes("rate limit") ||
        error.message.includes("exit code 1"))
    ) {
      console.log("Cursor error detected, retrying with fallback model...");

      // Retry with fallback model if original was specified
      const fallbackModel = options.model === "sonnet-4-thinking"
        ? "sonnet-4"
        : "sonnet-4";

      return await sendToCursorCLI(
        prompt,
        controller,
        { ...options, model: fallbackModel },
        onChunk
      );
    }

    // Re-throw other errors
    throw error;
  }
}
