
/**
 * Mock Antigravity CLI
 * 
 * Simulates the behavior of the Antigravity 'agent' command for testing
 * and demonstration purposes when the real CLI is not available or headless.
 */

if (import.meta.main) {
    const args = Deno.args;

    // Parse args roughly
    const streamJson = args.includes("stream-json") || args.includes("--output-format=stream-json");
    const modelIndex = args.indexOf("--model");
    const model = modelIndex !== -1 ? args[modelIndex + 1] : "unknown";

    // prompt is usually the last arg not associated with a flag
    // simple heuristic: last arg
    const prompt = args[args.length - 1];

    // Simulate thinking/processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    if (streamJson) {
        // Simulate streaming events
        const responseText = `[Antigravity Mock] Processed: "${prompt}" using model ${model}.\n\nHere is a simulated response stream.`;
        const chunks = responseText.split(/(?=[ :])/); // Split by words/spaces roughly

        for (const chunk of chunks) {
            console.log(JSON.stringify({
                type: "text",
                content: chunk
            }));
            // varying delay for realism
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
        }
    } else {
        // Plain JSON output
        console.log(JSON.stringify({
            response: `[Antigravity Mock] Processed: "${prompt}" using model ${model}.`,
            duration: 1234,
            modelUsed: model,
            chatId: "mock-session-123"
        }));
    }
}
