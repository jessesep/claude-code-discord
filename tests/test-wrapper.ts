
import { sendToAntigravityCLI } from "../claude/antigravity-client.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

/**
 * Test Wrapper Integration
 * 
 * Verifies that the Antigravity client successfully uses the wrapper script.
 */

async function main() {
    console.log("🧪 Testing Antigravity Wrapper Integration...");

    const controller = new AbortController();
    const wrapperPath = "./scripts/antigravity-wrapper.sh";

    try {
        const result = await sendToAntigravityCLI(
            "Test Prompt",
            controller,
            {
                streamJson: true,
                commandPath: wrapperPath
            }
        );

        console.log("Result:", result);

        assert(result.response.includes("[Antigravity Mock]"), "Response should come from mock");
        console.log("✅ Wrapper integration successful");
    } catch (error) {
        console.error("❌ Wrapper test failed:", error);
        Deno.exit(1);
    }
}

if (import.meta.main) {
    main();
}
