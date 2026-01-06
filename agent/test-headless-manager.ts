import { PREDEFINED_AGENTS, setAgentSession, handleManagerInteraction } from "./index.ts";

const MOCK_CTX = {
    editReply: async (msg: any) => {
        console.log("\n[Discord Output]:", JSON.stringify(msg, null, 2));
    },
    user: { id: "test-user" },
    channelId: "test-channel"
};

async function testManager() {
    console.log("Starting Manager Test (Memory)...");
    const managerConfig = PREDEFINED_AGENTS['ag-manager'];

    // Initialize Session
    setAgentSession("test-user", "test-channel", "ag-manager");

    // Turn 1: Give Context
    console.log("\n--- Turn 1: My name is John ---");
    await handleManagerInteraction(MOCK_CTX, "Hi, my name is John.", managerConfig, { workDir: Deno.cwd() } as any);

    // Turn 2: Ask for Context
    console.log("\n--- Turn 2: What is my name? ---");
    await handleManagerInteraction(MOCK_CTX, "What is my name?", managerConfig, { workDir: Deno.cwd() } as any);
}

testManager().catch(console.error);
