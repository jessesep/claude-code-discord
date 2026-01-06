import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AgentMonitor from './components/AgentMonitor';
import WebhookManager from './components/WebhookManager';
import Terminal from './components/Terminal';
import MemoryExplorer from './components/MemoryExplorer';
import SettingsManager from './components/SettingsManager';
import { Agent, Session, BotSettings, Webhook } from './types';
import { getAgents, getSessions, getSettings, updateSettings, getLogs } from './services/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dash' | 'agents' | 'webhooks' | 'term' | 'mem' | 'settings'>('dash');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<BotSettings>({} as BotSettings);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [agentsData, sessionsData, settingsData] = await Promise.all([
          getAgents(),
          getSessions(),
          getSettings()
        ]);
        
        setAgents(agentsData);
        setSessions(sessionsData.sessions);
        setSettings(settingsData as BotSettings);
        setWebhooks(settingsData.webhooks || []);
        
        // Load logs
        const logsData = await getLogs(20);
        setLogs(logsData.logs.map(log => log.message));
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    // Refresh data periodically
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Refresh logs more frequently
  useEffect(() => {
    const refreshLogs = async () => {
      try {
        const logsData = await getLogs(20);
        setLogs(logsData.logs.map(log => log.message));
      } catch (error) {
        console.error('Failed to refresh logs:', error);
      }
    };
    
    const interval = setInterval(refreshLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSettingsUpdate = async (newSettings: Partial<BotSettings>) => {
    try {
      const updated = await updateSettings(newSettings);
      setSettings(updated);
      if (updated.webhooks) {
        setWebhooks(updated.webhooks);
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      alert('Failed to save settings');
    }
  };

  const handleWebhookUpdate = async () => {
    try {
      const settingsData = await getSettings();
      setWebhooks(settingsData.webhooks || []);
    } catch (error) {
      console.error('Failed to refresh webhooks:', error);
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-zinc-500">Loading dashboard...</div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dash': 
        return <Dashboard sessions={sessions} logs={logs} settings={settings} webhooks={webhooks} />;
      case 'agents': 
        return <AgentMonitor agents={agents} sessions={sessions} />;
      case 'webhooks': 
        return <WebhookManager webhooks={webhooks} onUpdate={handleWebhookUpdate} />;
      case 'term': 
        return <Terminal onCommand={(cmd) => addLog(`Shell Execute: ${cmd}`)} />;
      case 'mem': 
        return <MemoryExplorer />;
      case 'settings': 
        return <SettingsManager settings={settings} onUpdate={handleSettingsUpdate} />;
      default: 
        return <Dashboard sessions={sessions} logs={logs} settings={settings} webhooks={webhooks} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#09090b] overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
            <h1 className="text-sm font-semibold tracking-wider text-zinc-400 uppercase">
              {activeTab === 'dash' ? 'Overview' : activeTab.toUpperCase()}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-400 mono">
              Port: 8000
            </div>
            <button className="p-2 text-zinc-400 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </button>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-8">
          {renderContent()}
        </section>
      </main>
    </div>
  );
};

export default App;
