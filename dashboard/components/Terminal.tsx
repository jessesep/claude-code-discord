import React, { useState, useRef, useEffect } from 'react';
import { getLogs } from '../services/api';

interface TerminalProps {
  onCommand: (cmd: string) => void;
}

const Terminal: React.FC<TerminalProps> = ({ onCommand }) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([
    "Antigravity System Shell v1.0.4",
    "Type 'help' for available commands.",
    ""
  ]);
  const [logs, setLogs] = useState<Array<{ timestamp: string; level: string; source: string; message: string }>>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, logs]);

  // Fetch logs periodically
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await getLogs(20);
        setLogs(data.logs);
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const cmd = input.trim().toLowerCase();
    let response = "";

    if (cmd === 'help') {
      response = "Available commands: git status, agent list, sys info, clear, shutdown";
    } else if (cmd === 'clear') {
      setHistory(["Terminal cleared.", ""]);
      setInput('');
      return;
    } else if (cmd === 'sys info') {
      response = "OS: Linux (Deno v1.40.0) | CPU: 8 Cores | RAM: 1.2GB/16GB Used";
    } else {
      response = `Executing command: ${cmd}... done.`;
    }

    setHistory(prev => [...prev, `> ${input}`, response, ""]);
    onCommand(input);
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-black border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/50"></div>
          <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
          <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
          <span className="text-[10px] text-zinc-500 font-bold ml-2 tracking-widest uppercase">System Console</span>
        </div>
        <div className="text-[10px] text-zinc-600 mono">localhost:8000</div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto mono text-sm space-y-1 selection:bg-indigo-500/30">
        {logs.map((log, i) => (
          <div key={i} className="text-zinc-400">
            <span className="text-zinc-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
          </div>
        ))}
        {history.map((line, i) => (
          <div key={`hist-${i}`} className={line.startsWith('>') ? 'text-indigo-400 font-bold' : 'text-zinc-400'}>
            {line}
          </div>
        ))}
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <span className="text-indigo-500 font-bold">~</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-indigo-400 caret-indigo-500"
            autoFocus
            spellCheck={false}
          />
        </form>
        <div ref={bottomRef} />
      </div>

      <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-between">
        <p className="text-[10px] text-zinc-500">Security Gate: <span className="text-emerald-500 font-bold">ACTIVE</span></p>
        <div className="flex gap-4">
           <button className="text-[10px] text-zinc-400 hover:text-white underline uppercase tracking-widest font-bold">Export Logs</button>
           <button className="text-[10px] text-zinc-400 hover:text-white underline uppercase tracking-widest font-bold">Reset Pipe</button>
        </div>
      </div>
    </div>
  );
};

export default Terminal;
