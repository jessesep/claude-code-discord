import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { getSessionsForAPI, getSessionDetails } from "../agent/handlers.ts";
import { agentSessions } from "../agent/session-manager.ts";
import { AgentSession } from "../agent/types.ts";

Deno.test("Analytics API - getSessionsForAPI returns correct stats", () => {
  // Clear and populate mock data
  agentSessions.length = 0;
  
  const mockSession: AgentSession = {
    id: "test-session-1",
    agentName: "ag-coder",
    userId: "user-1",
    channelId: "channel-1",
    status: "active",
    startTime: new Date(),
    lastActivity: new Date(),
    messageCount: 5,
    totalCost: 0.05,
    history: []
  };
  
  const mockSession2: AgentSession = {
    id: "test-session-2",
    agentName: "ag-architect",
    userId: "user-2",
    channelId: "channel-1",
    status: "completed",
    startTime: new Date(),
    lastActivity: new Date(),
    messageCount: 10,
    totalCost: 0.15,
    history: []
  };
  
  agentSessions.push(mockSession);
  agentSessions.push(mockSession2);
  
  const result = getSessionsForAPI();
  
  // Verify stats
  assertEquals(result.stats.totalSessions, 2);
  assertEquals(result.stats.activeSessions, 1);
  assertEquals(result.stats.totalCost, 0.20);
  assertEquals(result.stats.totalMessages, 15);
  
  // Verify session list
  assertEquals(result.sessions.length, 2);
  assertEquals(result.sessions[0].id, "test-session-1");
  assertEquals(result.sessions[1].id, "test-session-2");
});

Deno.test("Analytics API - getSessionDetails returns full session with agent", () => {
  agentSessions.length = 0;
  const mockSession: AgentSession = {
    id: "detail-session",
    agentName: "ag-coder",
    userId: "user-1",
    channelId: "channel-1",
    status: "active",
    startTime: new Date(),
    lastActivity: new Date(),
    messageCount: 1,
    totalCost: 0.01,
    history: []
  };
  agentSessions.push(mockSession);
  
  const result = getSessionDetails("detail-session");
  
  assertEquals(result?.id, "detail-session");
  assertEquals(result?.agentName, "ag-coder");
  // Check if agent config is attached
  assertEquals(result?.agent?.name, "one coder");
});

Deno.test("Analytics API - getSessionDetails returns null for unknown session", () => {
  const result = getSessionDetails("non-existent");
  assertEquals(result, null);
});
