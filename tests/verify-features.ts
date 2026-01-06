
import { chatWithAgent, PREDEFINED_AGENTS, getActiveSession } from "../agent/index.ts";

function loadEnv() {
    try {
        const text = Deno.readTextFileSync(".env");
        for (const line of text.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const [key, ...valueParts] = trimmed.split("=");
            const value = valueParts.join("=");
            const cleanValue = value.replace(/^["']|["']$/g, '');
            Deno.env.set(key.trim(), cleanValue);
        }
    } catch (e) { }
}

loadEnv();

async function verifyFeatures() {
    console.log("🚀 Verifying Features (Clean Version)...\n");

    const userId = "tester_123";
    const channelId = "channel_123";

    const createCtx = () => ({
        user: { id: userId },
        channelId: channelId,
        editReply: async (payload: any) => {
            // console.log("   [Mock] Status:", payload.content || "Embed sent");
        }
    });

    const deps: any = {
        workDir: Deno.cwd(),
        sendClaudeMessages: async () => { }
    };

    // 1. Test Memory
    console.log("🧠 Testing Memory...");
    await chatWithAgent(createCtx(), "My favorite fruit is MANGO. Remember it.", "ag-coder", undefined, false, deps);

    // Create new context for second call
    const results: string[] = [];
    const ctx2 = createCtx();
    (ctx2 as any).editReply = async (p: any) => {
        if (p.embeds) results.push(p.embeds[0].description);
        else if (p.content) results.push(p.content);
    };

    await chatWithAgent(ctx2, "What is my favorite fruit?", "ag-coder", undefined, false, deps);

    const response = results.join(" ");
    if (response.toUpperCase().includes("MANGO")) {
        console.log("   ✅ SUCCESS: Memory working.");
    } else {
        console.log("   ❌ FAILURE: Memory failed.");
        console.log("   Response:", response);
    }

    // 2. Test Git
    console.log("\n🐙 Testing Git...");
    results.length = 0;
    const ctx3 = createCtx();
    (ctx3 as any).includeGit = true;
    (ctx3 as any).editReply = async (p: any) => {
        if (p.embeds) results.push(p.embeds[0].description);
    };

    await chatWithAgent(ctx3, "Tell me if my git status is mentioned in the context I sent you.", "ag-coder", undefined, false, deps);

    const gitResponse = results.join(" ");
    if (gitResponse.toLowerCase().includes("git") || gitResponse.toLowerCase().includes("status")) {
        console.log("   ✅ SUCCESS: Git context seen.");
    } else {
        console.log("   ❌ FAILURE: Git context missing.");
    }

    console.log("\n✨ Done.");
}

verifyFeatures();
