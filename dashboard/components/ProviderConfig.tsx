import React, { useState, useEffect } from 'react';
import { ProviderStatus, ProviderId } from '../types';

interface ProviderConfigProps {
  onRefresh?: () => void;
}

// Provider metadata for display
const PROVIDER_INFO: Record<ProviderId, {
  name: string;
  description: string;
  icon: string;
  color: string;
  pricing: 'free' | 'paid' | 'freemium' | 'byok';
  envVar?: string;
}> = {
  'claude-cli': {
    name: 'Claude CLI',
    description: 'Anthropic Claude via CLI',
    icon: '🤖',
    color: 'violet',
    pricing: 'paid'
  },
  'anthropic-api': {
    name: 'Anthropic API',
    description: 'Direct API access to Claude',
    icon: '🔑',
    color: 'violet',
    pricing: 'paid',
    envVar: 'ANTHROPIC_API_KEY'
  },
  'cursor': {
    name: 'Cursor Agent',
    description: 'Cursor IDE CLI agent',
    icon: '🖥️',
    color: 'blue',
    pricing: 'paid'
  },
  'gemini-api': {
    name: 'Gemini API',
    description: 'Google Gemini via API key',
    icon: '🌐',
    color: 'emerald',
    pricing: 'freemium',
    envVar: 'GEMINI_API_KEY'
  },
  'antigravity': {
    name: 'Antigravity',
    description: 'Gemini via gcloud OAuth',
    icon: '🚀',
    color: 'cyan',
    pricing: 'paid'
  },
  'ollama': {
    name: 'Ollama',
    description: 'Local LLM server',
    icon: '🦙',
    color: 'orange',
    pricing: 'free'
  },
  'openai': {
    name: 'OpenAI',
    description: 'GPT-4o, o1, Codex',
    icon: '⚡',
    color: 'green',
    pricing: 'paid',
    envVar: 'OPENAI_API_KEY'
  },
  'groq': {
    name: 'Groq',
    description: 'Ultra-fast inference',
    icon: '🔥',
    color: 'red',
    pricing: 'freemium',
    envVar: 'GROQ_API_KEY'
  },
  'together': {
    name: 'Together AI',
    description: 'Open model hosting',
    icon: '🤝',
    color: 'purple',
    pricing: 'paid',
    envVar: 'TOGETHER_API_KEY'
  },
  'fireworks': {
    name: 'Fireworks AI',
    description: 'Fast inference API',
    icon: '🎆',
    color: 'pink',
    pricing: 'paid',
    envVar: 'FIREWORKS_API_KEY'
  },
  'deepseek': {
    name: 'DeepSeek',
    description: 'Reasoning models',
    icon: '🔍',
    color: 'indigo',
    pricing: 'paid',
    envVar: 'DEEPSEEK_API_KEY'
  },
  'aider': {
    name: 'Aider',
    description: 'AI pair programming',
    icon: '👥',
    color: 'yellow',
    pricing: 'byok'
  },
  'openrouter': {
    name: 'OpenRouter',
    description: 'Unified API for 100+ models',
    icon: '🌍',
    color: 'teal',
    pricing: 'paid',
    envVar: 'OPENROUTER_API_KEY'
  }
};

const ProviderConfig: React.FC<ProviderConfigProps> = ({ onRefresh }) => {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      // Use mock data if API not available
      setProviders(Object.keys(PROVIDER_INFO).map(id => ({
        id: id as ProviderId,
        name: PROVIDER_INFO[id as ProviderId].name,
        enabled: ['gemini-api', 'cursor', 'ollama'].includes(id),
        available: ['gemini-api', 'ollama'].includes(id),
        credentialStatus: 'Unknown',
        pricing: PROVIDER_INFO[id as ProviderId].pricing
      })));
    }
    setLoading(false);
  };

  const toggleProvider = async (id: ProviderId) => {
    try {
      const provider = providers.find(p => p.id === id);
      const action = provider?.enabled ? 'disable' : 'enable';
      await fetch(`/api/providers/${id}/${action}`, { method: 'POST' });
      fetchProviders();
    } catch (error) {
      console.error('Failed to toggle provider:', error);
    }
  };

  const getPricingBadge = (pricing: string) => {
    const styles: Record<string, string> = {
      'free': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      'freemium': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'paid': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'byok': 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    const labels: Record<string, string> = {
      'free': 'FREE',
      'freemium': 'FREEMIUM',
      'paid': 'PAID',
      'byok': 'BYOK'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest border ${styles[pricing]}`}>
        {labels[pricing]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="border-b border-zinc-800 pb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black tracking-tighter italic uppercase">AI Providers</h2>
          <p className="text-zinc-500 text-sm">Configure API keys and enable/disable providers</p>
        </div>
        <button
          onClick={fetchProviders}
          className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all uppercase tracking-widest"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {providers.map(provider => {
          const info = PROVIDER_INFO[provider.id];
          if (!info) return null;
          
          return (
            <div
              key={provider.id}
              className={`relative bg-zinc-900 border rounded-2xl p-5 transition-all cursor-pointer hover:border-zinc-700 ${
                provider.enabled 
                  ? (provider.available ? 'border-emerald-500/30' : 'border-amber-500/30')
                  : 'border-zinc-800 opacity-60'
              }`}
              onClick={() => setSelectedProvider(provider.id)}
            >
              {/* Status indicator */}
              <div className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full ${
                provider.enabled 
                  ? (provider.available ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')
                  : 'bg-zinc-700'
              }`} />

              <div className="flex items-start gap-4">
                <div className="text-3xl">{info.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-white truncate">{info.name}</h3>
                    {getPricingBadge(info.pricing)}
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">{info.description}</p>
                  
                  {provider.enabled && (
                    <div className="text-[10px] text-zinc-600 font-medium">
                      {provider.available ? '✓ Ready' : '⚠ Needs configuration'}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProvider(provider.id);
                }}
                className={`mt-4 w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  provider.enabled
                    ? 'bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400'
                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                }`}
              >
                {provider.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Provider detail modal */}
      {selectedProvider && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedProvider(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">{PROVIDER_INFO[selectedProvider].icon}</span>
              <div>
                <h3 className="text-xl font-bold">{PROVIDER_INFO[selectedProvider].name}</h3>
                <p className="text-zinc-500 text-sm">{PROVIDER_INFO[selectedProvider].description}</p>
              </div>
            </div>

            <div className="space-y-4">
              {PROVIDER_INFO[selectedProvider].envVar && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">
                    API Key Environment Variable
                  </label>
                  <code className="text-indigo-400 text-sm font-mono">
                    {PROVIDER_INFO[selectedProvider].envVar}
                  </code>
                </div>
              )}

              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">
                  Status
                </label>
                <p className="text-sm text-zinc-300">
                  {providers.find(p => p.id === selectedProvider)?.credentialStatus || 'Unknown'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedProvider(null)}
              className="mt-6 w-full py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderConfig;
