
import { chatWithAgent, PREDEFINED_AGENTS } from "../agent/index.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

/**
 * Mock Discord Interaction Test
 * 
 * Verifies the flow: User -> Bot Logic -> Antigravity Agent -> Streaming Response -> Discord Message
 * without needing a real Discord Bot Token.
 */

async function testDiscordFlow() {
    console.log("🧪 Testing Discord Logic Flow with Antigravity...");

    // 1. Mock Discord Context (ctx)
    const mockCtx = {
        user: { id: "user_123" },
        editReply: async (payload: any) => {
            // console.log("   [Mock Discord] Bot changed status/embed:", payload.embeds?.[0]?.title);
        }
    };

    // 2. Mock Dependencies (deps)
    let receivedContent = "";
    const mockDeps = {
        workDir: "/tmp",
        sendClaudeMessages: async (messages: any[]) => {
            const content = messages[0].content;
            receivedContent += content;
            const encoder = new TextEncoder();
            Deno.stdout.write(encoder.encode(`   [Mock Discord] Message Update: "${content.substring(0, 50)}..."\n`));
        },
        sendClaudeFile: async () => { } // Unused for this test
    };

    // 3. Trigger the Chat Function
    // We explicitly select 'ag-coder' to test Antigravity path
    const agentName = "ag-coder";
    const userPrompt = "Write a very short poem about generic types.";

    console.log(`\n📨 User sends: "${userPrompt}" to agent: ${agentName}`);

    // Pass env var manually if needed, or rely on .env loading if done previously.
    // We assume GEMINI_API_KEY is present in env.

    await chatWithAgent(
        mockCtx,
        userPrompt,
        agentName,
        undefined, // contextFiles
        false, // includeSystemInfo
        mockDeps as any
    );

    console.log("\n✅ Interaction Complete.");

    // 4. Assertions
    // Check if we received a response
    if (receivedContent.length > 0) {
        console.log(`\n🎉 Success! Received ${receivedContent.length} chars from agent.`);
        console.log("Response Preview:\n" + receivedContent.substring(0, 100) + "...");
    } else {
        console.error("\n❌ FAILED: No content received from agent.");
        // If failed, likely due to API key missing in Deno env or auth failure (but client throws).
        // If client threw, we might catch it or it crashed.

        // Check environment
        if (!Deno.env.get("GEMINI_API_KEY")) {
            console.error("Reason: GEMINI_API_KEY is missing in environment.");
        }
        Deno.exit(1);
    }
}

if (import.meta.main) {
    testDiscordFlow();
}
