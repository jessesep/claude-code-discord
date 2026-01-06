import React, { useState } from 'react';

const MemoryExplorer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // TODO: Replace with API call to /api/memories when implemented
  const mockMemories = [
    { id: 1, title: 'Auth Architecture', content: 'Decided to use standard JWT instead of session-cookies for cross-platform bot access.', date: '2026-01-05', type: 'decision' },
    { id: 2, title: 'Bugfix #102', content: 'Resolved race condition in worker-service process spawning using PID file locking.', date: '2026-01-06', type: 'fix' },
    { id: 3, title: 'Feature: Natural Chat', content: 'Implemented getActiveSession hook to route messages without slash commands.', date: '2026-01-04', type: 'feature' },
    { id: 4, title: 'Git Duplication Error', content: 'Found remote URLs were causing category duplication. Added .trim() to fix.', date: '2026-01-06', type: 'discovery' },
  ];

  return (
    <div className="space-y-8 animate-in zoom-in-95 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Memory Browser</h2>
          <p className="text-sm text-zinc-500">Explorer persistent system knowledge from <code>claude-mem</code>.</p>
        </div>
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search decisions, facts, bugs..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-10 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="absolute left-3 top-3 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockMemories.map(mem => (
          <div key={mem.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                mem.type === 'fix' ? 'bg-emerald-500/10 text-emerald-500' :
                mem.type === 'decision' ? 'bg-indigo-500/10 text-indigo-500' :
                'bg-amber-500/10 text-amber-500'
              }`}>
                {mem.type}
              </span>
              <span className="text-[10px] text-zinc-600 font-bold">{mem.date}</span>
            </div>
            <h4 className="font-bold text-zinc-100 mb-2 group-hover:text-indigo-400 transition-colors">{mem.title}</h4>
            <p className="text-sm text-zinc-400 leading-relaxed">{mem.content}</p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-950/50 border border-dashed border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <h5 className="font-semibold text-zinc-300">More Memories Found</h5>
        <p className="text-sm text-zinc-500 mb-6 max-w-xs">Memory explorer API endpoint not yet implemented. See issue #91.</p>
        <button className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition-all">
          Load Deep History
        </button>
      </div>
    </div>
  );
};

export default MemoryExplorer;
