import { AgentSession, PREDEFINED_AGENTS } from "./types.ts";
import { claudeMemService } from "../util/claude-mem-service.ts";

// In-memory storage for agent sessions
export let agentSessions: AgentSession[] = [];
// Support multiple concurrent agents per user/channel
// Key format: `${userId}:${channelId}`, value: array of active agent names
export let currentUserAgent: Record<string, string[]> = {}; // userId:channelId -> agentName[]

// Helper to get composite key for user+channel
export function getUserChannelKey(userId: string, channelId: string): string {
  return `${userId}:${channelId}`;
}

// Helper to get active agents for a user/channel
export function getActiveAgents(userId: string, channelId: string): string[] {
  const key = getUserChannelKey(userId, channelId);
  return currentUserAgent[key] || [];
}

// Helper to add an agent to active list
export function addActiveAgent(userId: string, channelId: string, agentName: string): void {
  const key = getUserChannelKey(userId, channelId);
  if (!currentUserAgent[key]) {
    currentUserAgent[key] = [];
  }
  if (!currentUserAgent[key].includes(agentName)) {
    currentUserAgent[key].push(agentName);
  }
}

// Helper to remove an agent from active list
export function removeActiveAgent(userId: string, channelId: string, agentName?: string): void {
  const key = getUserChannelKey(userId, channelId);
  if (!currentUserAgent[key]) return;
  
  if (agentName) {
    // Remove specific agent
    currentUserAgent[key] = currentUserAgent[key].filter(a => a !== agentName);
  } else {
    // Remove all agents for this user/channel
    delete currentUserAgent[key];
  }
  
  // Clean up empty arrays
  if (currentUserAgent[key] && currentUserAgent[key].length === 0) {
    delete currentUserAgent[key];
  }
}

/**
 * Gets the active session for a specific user and channel.
 * If multiple exist, returns the first one (or the one matching the current target agent).
 */
export function getActiveSession(userId: string, channelId: string, agentName?: string) {
  const activeAgentNames = getActiveAgents(userId, channelId);
  if (activeAgentNames.length === 0) return null;

  const targetAgent = agentName || activeAgentNames[0];
  const session = agentSessions.find(s => 
    s.userId === userId && 
    s.channelId === channelId && 
    s.agentName === targetAgent &&
    s.status === 'active'
  );

  if (!session) return null;
  return { session, agent: PREDEFINED_AGENTS[targetAgent] };
}

/**
 * Sets the active agent session for a user in a channel.
 */
export function setAgentSession(
  userId: string, 
  channelId: string, 
  agentName: string, 
  roleId?: string, 
  projectPath?: string
): AgentSession {
  // Check if session already exists
  const existingSession = agentSessions.find(s => 
    s.userId === userId && 
    s.channelId === channelId && 
    s.agentName === agentName &&
    s.status === 'active'
  );

  if (existingSession) {
    if (roleId) existingSession.roleId = roleId;
    if (projectPath) existingSession.projectPath = projectPath;
    existingSession.lastActivity = new Date();
    addActiveAgent(userId, channelId, agentName);
    return existingSession;
  }

  // Create new session
  const newSession: AgentSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    agentName,
    userId,
    channelId,
    startTime: new Date(),
    messageCount: 0,
    totalCost: 0,
    lastActivity: new Date(),
    status: 'active',
    history: [],
    roleId,
    projectPath
  };

  agentSessions.push(newSession);
  addActiveAgent(userId, channelId, agentName);

  // Trigger claude-mem session start (async, don't block)
  (async () => {
    try {
      const memSessionId = await claudeMemService.startSession(
        projectPath || Deno.cwd(), 
        agentName,
        { userId, channelId, sessionId: newSession.id }
      );
      newSession.memorySessionId = memSessionId;
    } catch (err) {
      console.warn("Failed to start claude-mem session:", err);
    }
  })();

  return newSession;
}

export function clearAgentSessions(userId: string, channelId: string, agentName?: string) {
  if (agentName) {
    // End specific agent session
    const sessions = agentSessions.filter(s => 
      s.userId === userId && 
      s.channelId === channelId && 
      s.agentName === agentName
    );
    for (const session of sessions) {
      session.status = 'completed';
      if (session.memorySessionId) {
        claudeMemService.endSession(session.memorySessionId);
      }
    }
    removeActiveAgent(userId, channelId, agentName);
  } else {
    // End all sessions for user/channel
    const sessions = agentSessions.filter(s => 
      s.userId === userId && 
      s.channelId === channelId
    );
    for (const session of sessions) {
      session.status = 'completed';
      if (session.memorySessionId) {
        claudeMemService.endSession(session.memorySessionId);
      }
    }
    removeActiveAgent(userId, channelId);
  }
}
