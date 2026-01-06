import React from 'react';
import { Agent, Session } from '../types';

interface AgentMonitorProps {
  agents: Agent[];
  sessions: Session[];
}

const AgentMonitor: React.FC<AgentMonitorProps> = ({ agents, sessions }) => {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'low': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Agent Lifecycle</h2>
        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Register New Agent
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <p className="text-zinc-500">No agents found. Loading...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {agents.map(agent => {
            const activeSess = sessions.find(s => s.agentName === agent.id && s.status === 'active');
            
            return (
              <div key={agent.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                <div className="p-6 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-zinc-800 ${activeSess ? 'ring-2 ring-green-500/50' : ''}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6v6l4 2"/></svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{agent.name}</h4>
                        <p className="text-xs text-zinc-500 mono uppercase tracking-wider">{agent.id} • {agent.client}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-0.5 border rounded text-[10px] font-black uppercase ${getRiskColor(agent.riskLevel)}`}>
                      {agent.riskLevel} Risk
                    </div>
                  </div>

                  <p className="text-sm text-zinc-400 mb-6 flex-grow">{agent.description}</p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {agent.capabilities.map((cap, i) => (
                      <span key={i} className="px-2 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded-md text-[10px] text-zinc-300 font-medium">
                        {cap}
                      </span>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-zinc-800 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {activeSess && (
                        <div className="w-7 h-7 rounded-full bg-green-500 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold">
                          ✓
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button className="p-2 text-zinc-500 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                      </button>
                      <button className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition-all">
                        View Logs
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AgentMonitor;
