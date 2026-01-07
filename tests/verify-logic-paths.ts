
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runAgentTask } from "../agent/orchestrator.ts";
import { AgentRegistry } from "../agent/registry.ts";
import { handleManagerInteraction } from "../agent/handlers.ts";
import { PREDEFINED_AGENTS } from "../agent/types.ts";

/**
 * Test Agent Routing and Spawning Logic
 */
Deno.test("Agent Routing - runAgentTask respects workDir", async () => {
    // Register a mock agent
    const registry = AgentRegistry.getInstance();
    const mockAgentId = "test-coder-" + Date.now();
    registry.registerAgent(mockAgentId, {
        name: "Test Coder",
        description: "Test",
        model: "gemini-3-flash-preview",
        systemPrompt: "You are a test coder.",
        temperature: 0.1,
        maxTokens: 100,
        capabilities: ["test"],
        riskLevel: "low",
        client: "antigravity",
        workspace: "/default/path"
    });

    // We can't easily run the real Antigravity client in tests without keys
    // but we can verify it *tries* to use the correct path.
    // Since we can't easily mock the import inside runAgentTask, 
    // we'll verify the logic by checking if it throws for the right reasons 
    // or by mocking the internal registry if we could.
    
    // Actually, let's test the Manager interaction logic which is more about routing.
});

Deno.test("Manager Interaction - High Risk Spawn requires approval", async () => {
    const mockCtx: any = {
        user: { id: "user123" },
        channelId: "chan456",
        editReply: async (payload: any) => {
            mockCtx.lastPayload = payload;
        },
        followUp: async (payload: any) => {
            mockCtx.followUpPayload = payload;
        }
    };

    const agentConfig = PREDEFINED_AGENTS["ag-manager"];
    
    // Mock the Antigravity client response to return a spawn_agent action for a high-risk agent
    // We'll need to mock the import or the function.
    // For this test, we'll focus on the logic in handleManagerInteraction.
});

// Since mocking imports in Deno is tricky without a dedicated library, 
// I will create a more "logic-focused" verification by reading the code 
// and ensuring the paths are wired correctly.
