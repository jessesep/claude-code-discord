import React, { useState } from 'react';
import { Webhook } from '../types';
import { updateSettings, getSettings } from '../services/api';

interface WebhookManagerProps {
  webhooks: Webhook[];
  onUpdate: () => void;
}

const WebhookManager: React.FC<WebhookManagerProps> = ({ webhooks, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState('');

  const toggleStatus = async (id: string) => {
    try {
      const settings = await getSettings();
      const updatedWebhooks = settings.webhooks.map(wh => 
        wh.id === id ? { ...wh, enabled: !wh.enabled } : wh
      );
      await updateSettings({ webhooks: updatedWebhooks });
      onUpdate();
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
      alert('Failed to update webhook');
    }
  };

  const createWebhook = async () => {
    if (!newWebhookName.trim()) return;
    try {
      const settings = await getSettings();
      const id = newWebhookName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const newWebhook: Webhook = {
        id,
        name: newWebhookName,
        enabled: true,
        secret: null,
        actions: []
      };
      await updateSettings({ webhooks: [...settings.webhooks, newWebhook] });
      setNewWebhookName('');
      setIsAdding(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to create webhook:', error);
      alert('Failed to create webhook');
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      const settings = await getSettings();
      await updateSettings({ webhooks: settings.webhooks.filter(wh => wh.id !== id) });
      onUpdate();
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      alert('Failed to delete webhook');
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'discord': return 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12';
      case 'slack': return 'M8 14H5a2 2 0 1 0 2 2V8H5a2 2 0 1 0-2 2h3';
      default: return 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 pb-20">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tighter italic uppercase">Event Integration Gateway</h2>
          <p className="text-sm text-zinc-500 font-medium">Broadcast system triggers to 3rd party listeners.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-3 uppercase tracking-widest"
        >
          {isAdding ? 'Cancel' : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              New Endpoint
            </>
          )}
        </button>
      </div>

      {isAdding && (
        <div className="bg-zinc-900 border-2 border-indigo-500/30 rounded-3xl p-8 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Target Name</label>
              <input 
                type="text" 
                placeholder="e.g. Monitoring Hub" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-500"
                value={newWebhookName}
                onChange={(e) => setNewWebhookName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
               <button 
                 onClick={createWebhook}
                 className="w-full py-3 bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-colors"
               >
                 Create Pipeline
               </button>
            </div>
          </div>
        </div>
      )}

      {webhooks.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <p className="text-zinc-500">No webhooks configured. Click "New Endpoint" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {webhooks.map(wh => (
            <div key={wh.id} className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 hover:border-zinc-600 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 flex gap-2">
                 <button 
                   onClick={() => deleteWebhook(wh.id)}
                   className="p-2 text-zinc-700 hover:text-rose-500 transition-colors bg-zinc-950 rounded-lg border border-zinc-800"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 </button>
              </div>
              
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-6 mb-8">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${wh.enabled ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={getIcon(wh.type)} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-xl text-zinc-100 uppercase tracking-tighter italic">{wh.name}</h3>
                      <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${wh.enabled ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-600'}`}>
                        {wh.enabled ? 'active' : 'inactive'}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 mono mt-1">/api/webhooks/{wh.id}</p>
                  </div>
                </div>

                <div className="space-y-6 flex-grow">
                  <div>
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-3 block">Actions</label>
                    <div className="flex flex-wrap gap-2">
                      {wh.actions.length > 0 ? (
                        wh.actions.map((action, i) => (
                          <span key={i} className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[9px] font-bold text-zinc-400 uppercase tracking-wider group-hover:border-zinc-700 transition-colors">
                            {action}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-500">No actions configured</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-8 mt-4 border-t border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <button 
                      onClick={() => toggleStatus(wh.id)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${wh.enabled ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}
                    >
                      {wh.enabled ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                  <button className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-[10px] font-black text-zinc-300 flex items-center gap-2 uppercase tracking-widest transition-all">
                    Test Connectivity
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebhookManager;
