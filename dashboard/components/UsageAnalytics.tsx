import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend 
} from 'recharts';
import { Session } from '../types';

interface UsageAnalyticsProps {
  sessions: Session[];
}

const UsageAnalytics: React.FC<UsageAnalyticsProps> = ({ sessions }) => {
  // Aggregate cost by agent
  const costByAgentMap = sessions.reduce((acc, session) => {
    const name = session.agentName;
    acc[name] = (acc[name] || 0) + session.totalCost;
    return acc;
  }, {} as Record<string, number>);

  const costByAgentData = Object.entries(costByAgentMap).map(([name, cost]) => ({
    name,
    cost: parseFloat(cost.toFixed(4))
  })).sort((a, b) => b.cost - a.cost);

  // Aggregate message count by agent
  const messagesByAgentMap = sessions.reduce((acc, session) => {
    const name = session.agentName;
    acc[name] = (acc[name] || 0) + session.messageCount;
    return acc;
  }, {} as Record<string, number>);

  const messagesByAgentData = Object.entries(messagesByAgentMap).map(([name, count]) => ({
    name,
    value: count
  })).sort((a, b) => b.value - a.value);

  // Time-based aggregation (last 24 hours if possible, but sessions only has startTime)
  // For now, let's group by day
  const sessionsByDayMap = sessions.reduce((acc, session) => {
    const day = new Date(session.startTime).toLocaleDateString();
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sessionsByDayData = Object.entries(sessionsByDayMap).map(([day, count]) => ({
    day,
    count
  })).sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()).slice(-7);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Total Conversations</p>
          <h3 className="text-3xl font-bold tracking-tighter mt-2">{sessions.length}</h3>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Cumulative Spend</p>
          <h3 className="text-3xl font-bold tracking-tighter mt-2">
            ${sessions.reduce((acc, s) => acc + s.totalCost, 0).toFixed(4)}
          </h3>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Total Messages</p>
          <h3 className="text-3xl font-bold tracking-tighter mt-2">
            {sessions.reduce((acc, s) => acc + s.messageCount, 0)}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cost by Agent */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h3 className="text-lg font-bold mb-6">Investment by Sub-Agent ($)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costByAgentData} layout="vertical">
                <XAxis type="number" stroke="#3f3f46" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#3f3f46" fontSize={10} axisLine={false} tickLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="cost" fill="#6366f1" radius={[0, 4, 4, 0]}>
                  {costByAgentData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Usage Distribution */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h3 className="text-lg font-bold mb-6">Agent Engagement Distribution</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={messagesByAgentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {messagesByAgentData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
        <h3 className="text-lg font-bold mb-6">Daily Operational Velocity</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sessionsByDayData}>
              <XAxis dataKey="day" stroke="#3f3f46" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#3f3f46" fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default UsageAnalytics;
