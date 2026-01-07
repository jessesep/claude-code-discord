import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { parseAgentMention } from "../discord/mention-parser.ts";
import { resolveAgentAlias, PREDEFINED_AGENTS } from "../agent/types.ts";
import { getFallbackChain, getNextFallback, shouldTriggerFallback } from "../util/list-models.ts";
import { RemoteAgentRegistry } from "../agent/remote-registry.ts";
import { RemoteAgentEndpoint } from "../agent/types.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Mention Parser Tests
// ═══════════════════════════════════════════════════════════════════════════

Deno.test("Mention Parser - resolves aliases correctly", () => {
  const cases = [
    { input: "@coder fix this", expectedId: "ag-coder", expectedMsg: "fix this" },
    { input: "@code refactor", expectedId: "ag-coder", expectedMsg: "refactor" },
    { input: "@builder build feature", expectedId: "cursor-coder", expectedMsg: "build feature" },
    { input: "@architect design", expectedId: "ag-architect", expectedMsg: "design" },
    { input: "@tester run tests", expectedId: "ag-tester", expectedMsg: "run tests" },
    { input: "@ag-manager help", expectedId: "ag-manager", expectedMsg: "help" },
  ];

  for (const { input, expectedId, expectedMsg } of cases) {
    const result = parseAgentMention(input);
    assertEquals(result.agentId, expectedId, `Failed on input: ${input}`);
    assertEquals(result.cleanMessage, expectedMsg, `Failed on input: ${input}`);
  }
});

Deno.test("Mention Parser - handles unknown or invalid mentions", () => {
  const cases = [
    { input: "@unknown-agent task", expectedId: null, expectedMsg: "@unknown-agent task" },
    { input: "no mention here", expectedId: null, expectedMsg: "no mention here" },
    { input: "@coder", expectedId: null, expectedMsg: "@coder" }, // Missing message
    { input: "check this @coder", expectedId: null, expectedMsg: "check this @coder" }, // Not at start
  ];

  for (const { input, expectedId, expectedMsg } of cases) {
    const result = parseAgentMention(input);
    assertEquals(result.agentId, expectedId, `Failed on input: ${input}`);
    assertEquals(result.cleanMessage, expectedMsg, `Failed on input: ${input}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Model Fallback Tests
// ═══════════════════════════════════════════════════════════════════════════

Deno.test("Model Fallback - identifies retryable errors", () => {
  assertEquals(shouldTriggerFallback("Rate limit exceeded"), true);
  assertEquals(shouldTriggerFallback("Quota exceeded"), true);
  assertEquals(shouldTriggerFallback("Error 429"), true);
  assertEquals(shouldTriggerFallback("Error 503"), true);
  assertEquals(shouldTriggerFallback("Service Unavailable"), true);
  assertEquals(shouldTriggerFallback("model not found"), true);
  assertEquals(shouldTriggerFallback("Internal Server Error"), false);
});

Deno.test("Model Fallback - resolves chains correctly", () => {
  const chain = getFallbackChain("gemini-3-flash-preview");
  assertEquals(chain.includes("gemini-3-flash-preview"), true);
  assertEquals(chain.includes("gemini-2.5-flash"), true);
  
  const next = getNextFallback("gemini-3-flash-preview", ["gemini-3-flash-preview"]);
  assertEquals(next, "gemini-2.5-flash");
});

// ═══════════════════════════════════════════════════════════════════════════
// Remote Registry Tests
// ═══════════════════════════════════════════════════════════════════════════

Deno.test("Remote Registry - CRUD operations", async () => {
  const registry = RemoteAgentRegistry.getInstance();
  const testEndpoint: RemoteAgentEndpoint = {
    id: "test-mac",
    name: "Test Mac Mini",
    url: "http://localhost:9999",
    capabilities: ["safari", "macos"],
    providers: ["cursor"],
    status: "unknown",
    lastHealthCheck: new Date()
  };

  // Register
  await registry.register(testEndpoint);
  const found = registry.getEndpoint("test-mac");
  assertEquals(found?.name, "Test Mac Mini");

  // Search by capability
  const byCap = registry.getEndpointsByCapability("safari");
  assertEquals(byCap.length >= 1, true);
  assertEquals(byCap.some(e => e.id === "test-mac"), true);

  // Unregister
  const removed = await registry.unregister("test-mac");
  assertEquals(removed, true);
  assertEquals(registry.getEndpoint("test-mac"), undefined);
});
