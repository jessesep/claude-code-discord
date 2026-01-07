
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createInteractionContext } from "../discord/interaction-context.ts";

Deno.test("InteractionContext - sendClaudeMessages handles chunks and follow-ups", async () => {
    let editReplyCalled = 0;
    let followUpCalled = 0;
    const receivedEmbeds: any[] = [];

    const mockInteraction: any = {
        user: { id: "user1", username: "tester" },
        channelId: "chan1",
        deferred: true,
        replied: false,
        editReply: async (payload: any) => {
            editReplyCalled++;
            receivedEmbeds.push(...payload.embeds);
        },
        followUp: async (payload: any) => {
            followUpCalled++;
            receivedEmbeds.push(...payload.embeds);
        }
    };

    const ctx: any = await createInteractionContext(mockInteraction);
    
    // Create a long message that will be split (limit is 4096)
    const longMessage = "a".repeat(5000); 
    
    await ctx.sendClaudeMessages([{ type: "text", content: longMessage }]);

    // Should have called editReply once for the first chunk and followUp once for the second
    assertEquals(editReplyCalled, 1, "editReply should be called once");
    assertEquals(followUpCalled, 1, "followUp should be called once");
    assertEquals(receivedEmbeds.length, 2, "Should have 2 embeds total");
    
    // Convert EmbedBuilder to JSON to check properties
    const embed1 = receivedEmbeds[0].data || receivedEmbeds[0];
    const embed2 = receivedEmbeds[1].data || receivedEmbeds[1];

    assert(embed1.description.length <= 4096);
    assert(embed2.description.length > 0);
});

Deno.test("InteractionContext - fallback to channel.send if interaction not capable", async () => {
    let channelSendCalled = 0;
    const mockInteraction: any = {
        user: { id: "user1", username: "tester" },
        channelId: "chan1",
        channel: {
            send: async (payload: any) => {
                channelSendCalled++;
            }
        }
    };

    const ctx: any = await createInteractionContext(mockInteraction);
    await ctx.sendClaudeMessages([{ type: "text", content: "hello" }]);

    assertEquals(channelSendCalled, 1, "Should fall back to channel.send");
});

function assert(condition: boolean, msg?: string) {
    if (!condition) throw new Error(msg || "Assertion failed");
}
