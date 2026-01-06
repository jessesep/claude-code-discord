// API client for dashboard to connect to bot endpoints
import { BotSettings, Agent, Session, Webhook } from '../types';

const API_BASE = '/api';

export async function getSettings(): Promise<BotSettings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.statusText}`);
  return res.json();
}

export async function updateSettings(settings: Partial<BotSettings>): Promise<BotSettings> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error(`Failed to update settings: ${res.statusText}`);
  const data = await res.json();
  return data.settings || data;
}

export async function getAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/agents`);
  if (!res.ok) throw new Error(`Failed to fetch agents: ${res.statusText}`);
  const data = await res.json();
  return data.agents || [];
}

export async function getSessions(): Promise<{ sessions: Session[]; stats: { activeSessions: number; totalCost: number; totalMessages: number } }> {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.statusText}`);
  return res.json();
}

export async function getLogs(limit: number = 50, since?: string): Promise<{ logs: Array<{ timestamp: string; level: string; source: string; message: string }>; hasMore: boolean }> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (since) params.append('since', since);
  const res = await fetch(`${API_BASE}/logs?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch logs: ${res.statusText}`);
  return res.json();
}

export async function getStatus(): Promise<{ status: string; uptime: number }> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.statusText}`);
  return res.json();
}
