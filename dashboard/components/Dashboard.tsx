import React from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Session, BotSettings, Webhook } from '../types';

interface DashboardProps {
  sessions: Session[];
  logs: string[];
  settings: BotSettings;
  webhooks: Webhook[];
}

const data = [
  { time: '10:00', cost: 0.05 },
  { time: '11:00', cost: 0.12 },
  { time: '12:00', cost: 0.08 },
  { time: '13:00', cost: 0.25 },
  { time: '14:00', cost: 0.15 },
  { time: '15:00', cost: 0.32 },
  { time: '16:00', cost: 0.28 },
];

const Dashboard: React.FC<DashboardProps> = ({ sessions, logs, settings, webhooks }) => {
  const activeSessions = sessions.filter(s => s.status === 'active').length;
  const totalCost = sessions.reduce((acc, s) => acc + s.totalCost, 0).toFixed(3);
  const activeWebhooks = webhooks.filter(w => w.enabled).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Top Level Stats - Integrated Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Agents', value: activeSessions, trend: 'All Systems Nominal', color: 'indigo' },
          { label: 'Cloud Spend', value: `$${totalCost}`, trend: settings.defaultModel?.split('-')[1]?.toUpperCase() || 'N/A', color: 'emerald' },
          { label: 'Webhooks Live', value: `${activeWebhooks}/${webhooks.length}`, trend: 'Connectivity: 100%', color: 'amber' },
          { label: 'Security Level', value: settings.operationMode?.toUpperCase() || 'NORMAL', trend: 'Shields Up', color: 'rose' },
        ].map((stat, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm hover:border-zinc-700 transition-all hover:scale-[1.02]">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-3xl font-bold tracking-tighter">{stat.value}</h3>
              <span className={`text-[10px] font-black text-${stat.color}-500 uppercase tracking-tight`}>{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Section */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold">Network Throughput & Cost</h3>
              <p className="text-xs text-zinc-500">Real-time inference tracking across all sub-agents</p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-zinc-800 rounded-md text-[10px] font-bold text-zinc-400 uppercase">Live Metrics</span>
            </div>
          </div>
          <div className="h-[280px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Area type="monotone" dataKey="cost" stroke="#6366f1" fillOpacity={1} fill="url(#colorCost)" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#09090b' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Global Config & Webhook Quick-View */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
               Global Config Sync
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                <span className="text-xs text-zinc-500">Thinking Mode</span>
                <span className="text-xs font-bold text-indigo-400">{(settings.thinkingMode || 'none').toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                <span className="text-xs text-zinc-500">Default Model</span>
                <span className="text-xs font-bold text-zinc-300">{settings.defaultModel?.split('-')[1] || settings.defaultModel || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-zinc-500">Proxy Status</span>
                <span className={`text-[10px] font-black ${settings.proxyEnabled ? 'text-emerald-500' : 'text-zinc-600'}`}>
                  {settings.proxyEnabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
               Outbound Webhooks
            </h3>
            <div className="space-y-3">
              {webhooks.slice(0, 2).map(wh => (
                <div key={wh.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${wh.enabled ? 'bg-green-500' : 'bg-zinc-700'}`}></div>
                    <span className="text-xs text-zinc-300 group-hover:text-white transition-colors cursor-default">{wh.name}</span>
                  </div>
                  <span className="text-[10px] mono text-zinc-600">{wh.lastPing || 'Offline'}</span>
                </div>
              ))}
              {webhooks.length === 0 && (
                <p className="text-xs text-zinc-500">No webhooks configured</p>
              )}
            </div>
            <button className="w-full mt-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-[10px] font-bold text-zinc-400 uppercase tracking-widest transition-colors">
              Manage Endpoints
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Live Events Feed */}
         <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6">System LogStream</h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3 text-[11px] leading-relaxed border-l-2 border-zinc-800 pl-3 hover:border-indigo-500 transition-colors">
                  <span className="text-zinc-600 shrink-0 mono">{new Date().toLocaleTimeString()}</span>
                  <span className="text-zinc-300 mono break-all">{log}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-xs text-zinc-500">No logs available</p>
              )}
            </div>
         </div>

         {/* Active Task Management */}
         <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-2xl p-8">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              Live Agent Execution
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 text-[10px] font-black rounded uppercase">Process Pool</span>
            </h3>
            {sessions.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">No active sessions</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sessions.map(session => (
                  <div key={session.id} className="group p-5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3">
                       <div className={`w-2 h-2 rounded-full ${session.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center font-black text-indigo-400 text-xl shadow-inner">
                        {session.agentName[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-zinc-100">{session.task || 'Awaiting Instructions'}</h4>
                        <p className="text-[10px] text-zinc-500 mono uppercase">{session.agentName} ID: {session.id.substring(0, 8)}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-zinc-800/50">
                      <div className="flex gap-3">
                        <div className="text-center">
                          <p className="text-[9px] font-bold text-zinc-600 uppercase">Msg</p>
                          <p className="text-xs font-bold">{session.messageCount}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-bold text-zinc-600 uppercase">Cost</p>
                          <p className="text-xs font-bold">${session.totalCost.toFixed(3)}</p>
                        </div>
                      </div>
                      <button className="px-3 py-1.5 bg-zinc-800 hover:bg-indigo-600 rounded-lg text-[10px] font-bold transition-all uppercase">
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
