import React, { useState } from 'react';
import { BotSettings } from '../types';

interface SettingsManagerProps {
  settings: BotSettings;
  onUpdate: (settings: Partial<BotSettings>) => Promise<void>;
}

const SettingsManager: React.FC<SettingsManagerProps> = ({ settings, onUpdate }) => {
  const handleChange = async (field: keyof BotSettings, value: any) => {
    await onUpdate({ [field]: value });
  };

  // Map temperature field (dashboard uses 'temperature', bot uses 'defaultTemperature')
  const temperature = settings.defaultTemperature ?? settings.temperature ?? 0.7;
  const maxTokens = settings.defaultMaxTokens ?? settings.maxTokensPerSession ?? 4096;

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      <div className="border-b border-zinc-800 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter mb-2 italic uppercase">System Core Configuration</h2>
          <p className="text-zinc-500 text-sm font-medium tracking-wide">Orchestration layer and global environment parameters.</p>
        </div>
        <div className="flex gap-2">
           <button className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all uppercase tracking-widest">
             Export Backup
           </button>
           <button 
             onClick={() => onUpdate(settings)}
             className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/20 transition-all uppercase tracking-widest"
           >
             Save Changes
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          {/* Section: Model Defaults */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-8 shadow-sm">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-6">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86 1.558l-.666.666a2 2 0 01-.776.418l-1.483.296a2 2 0 01-.776-.418l-.666-.666a6 6 0 00-3.86-1.558l-2.387.477a2 2 0 00-1.022.547l-.547 1.022a2 2 0 00.547 2.628l1.455 1.164a2 2 0 001.25.438h6.416a2 2 0 001.25-.438l1.455-1.164a2 2 0 00.547-2.628l-.547-1.022zM12 9V4m0 0L9 7m3-3l3 3" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Intelligence Defaults</h3>
                <p className="text-xs text-zinc-500 font-medium">Affects all inference calls unless overridden by agents.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Temperature</label>
                  <span className="text-xs font-bold mono text-indigo-400">{temperature}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.05" 
                  value={temperature}
                  onChange={(e) => handleChange('defaultTemperature', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-zinc-600 font-black uppercase tracking-tighter">
                  <span>Deterministic</span>
                  <span>Hallucinogenic</span>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Thinking Mode</label>
                <div className="flex flex-wrap gap-2">
                  {['none', 'think', 'think-hard', 'ultrathink'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => handleChange('thinkingMode', mode)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all uppercase tracking-widest ${
                        settings.thinkingMode === mode 
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20' 
                          : 'bg-zinc-950 text-zinc-600 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Primary Model Engine</label>
                <select 
                  value={settings.defaultModel || 'claude-sonnet-4'}
                  onChange={(e) => handleChange('defaultModel', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all appearance-none text-zinc-300"
                >
                  <option value="claude-sonnet-4">Claude 3.5 Sonnet</option>
                  <option value="claude-opus-4">Claude 3 Opus</option>
                  <option value="claude-haiku-4">Claude 3 Haiku</option>
                  <option value="gemini-3-flash">Gemini 3 Flash</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Max Tokens</label>
                <input 
                  type="number"
                  value={maxTokens}
                  onChange={(e) => handleChange('defaultMaxTokens', parseInt(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-indigo-500 font-bold"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-8">
          <div className="bg-indigo-600/5 border border-indigo-500/20 rounded-3xl p-8 space-y-6 shadow-xl shadow-indigo-500/5">
            <h3 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em]">Network & Gateway</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-2xl border border-zinc-800">
                <span className="text-xs font-bold text-zinc-400">Global Proxy</span>
                <button 
                  onClick={() => handleChange('proxyEnabled', !settings.proxyEnabled)}
                  className={`w-11 h-6 rounded-full relative transition-all duration-300 ${settings.proxyEnabled ? 'bg-indigo-600' : 'bg-zinc-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${settings.proxyEnabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              {settings.proxyEnabled && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest pl-1">Endpoint URL</label>
                  <input 
                    type="text" 
                    placeholder="https://proxy.io:8080"
                    value={settings.proxyUrl || ''}
                    onChange={(e) => handleChange('proxyUrl', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs mono text-indigo-400 outline-none focus:border-indigo-500/50"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em]">Usage Quotas</h3>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Max Session Tokens</label>
                <input 
                  type="number"
                  value={maxTokens}
                  onChange={(e) => handleChange('defaultMaxTokens', parseInt(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold mono text-zinc-400 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-rose-500/5 border border-rose-500/10 rounded-3xl p-8 group hover:border-rose-500/30 transition-colors">
            <h3 className="text-lg font-black text-rose-500 mb-2 italic uppercase tracking-tighter">Emergency Protocol</h3>
            <p className="text-xs text-zinc-600 mb-6 font-medium leading-relaxed">
              Disconnects all active agents, clears the prompt cache, and shuts down the Discord gateway immediately.
            </p>
            <button className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10px] font-black tracking-[0.3em] uppercase shadow-lg shadow-rose-500/20 active:scale-95 transition-all">
              Initiate Purge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsManager;
