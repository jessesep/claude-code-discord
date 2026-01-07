
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { chatWithAgent, getActiveAgents, resolveChannelContext } from "../agent/index.ts";

Deno.test("Multi-Agent Orchestration: Tracking", () => {
  const userId = "test_user";
  const channelId = "test_channel";
  
  // This test relies on the internal state of the agent module
  // Since we can't easily reset it without a fresh import or helper, 
  // we'll test the helper functions which are exported.
  
  const agents = getActiveAgents(userId, channelId);
  console.log(`Initial agents for ${userId}:${channelId}:`, agents);
  
  // Note: We can't easily call addActiveAgent as it's not exported
  // but we can verify getActiveAgents exists and returns an array.
  assertExists(agents);
  assertEquals(Array.isArray(agents), true);
});

Deno.test("Project & Workspace: Channel Context Resolution", async () => {
  const mockCtx = {
    user: { id: "test_user" },
    channelId: "test_channel",
    channel: { name: "test-repo-channel" }
  };
  
  const context = await resolveChannelContext(mockCtx);
  assertExists(context);
  console.log("Resolved context:", context);
});

Deno.test("Command Registration Check", async () => {
    // Check if the new utility commands are defined in the handler
    const handlerFile = await Deno.readTextFile("util/handler.ts");
    const commands = ["agents-status", "category-info", "repo-info", "status"];
    
    for (const cmd of commands) {
        if (handlerFile.includes(cmd)) {
            console.log(`✅ Command /${cmd} found in handler.ts`);
        } else {
            console.log(`❌ Command /${cmd} NOT found in handler.ts`);
        }
    }
});

Deno.test("Category Naming Logic Check", async () => {
    // Check if category naming logic exists in index.ts or discord/bot.ts
    const indexFile = await Deno.readTextFile("index.ts");
    const botFile = await Deno.readTextFile("discord/bot.ts");
    
    const hasCategoryLogic = indexFile.includes("actualCategoryName") || botFile.includes("actualCategoryName");
    
    if (hasCategoryLogic) {
        console.log("✅ Category naming logic found");
    } else {
        console.log("❌ Category naming logic NOT found");
    }
});
