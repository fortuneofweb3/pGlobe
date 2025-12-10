'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { PNode } from '@/lib/types/pnode';

interface NetworkHealthChartProps {
  nodes: PNode[];
}

const COLORS = {
  online: '#3F8277',
  offline: '#ED1C24',
  syncing: '#FFD700',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const total = data.online + data.offline + data.syncing;
    return (
      <div className="bg-black/95 backdrop-blur-md border border-[#FFD700]/30 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-semibold text-foreground mb-2">{data.name}</p>
        <div className="space-y-1">
          <p className="text-xs text-foreground/80">
            <span className="font-mono font-semibold">{data.value}</span> nodes
          </p>
          {total > 0 && (
            <p className="text-xs text-foreground/60">
              {((data.value / total) * 100).toFixed(1)}% of network
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function NetworkHealthChart({ nodes }: NetworkHealthChartProps) {
  const data = useMemo(() => {
    const statusCounts = nodes.reduce(
      (acc, node) => {
        const status = node.status || 'offline';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const total = (statusCounts.online || 0) + (statusCounts.offline || 0) + (statusCounts.syncing || 0);

    return [
      { 
        name: 'Online', 
        value: statusCounts.online || 0, 
        color: COLORS.online,
        online: statusCounts.online || 0,
        offline: statusCounts.offline || 0,
        syncing: statusCounts.syncing || 0,
      },
      { 
        name: 'Syncing', 
        value: statusCounts.syncing || 0, 
        color: COLORS.syncing,
        online: statusCounts.online || 0,
        offline: statusCounts.offline || 0,
        syncing: statusCounts.syncing || 0,
      },
      { 
        name: 'Offline', 
        value: statusCounts.offline || 0, 
        color: COLORS.offline,
        online: statusCounts.online || 0,
        offline: statusCounts.offline || 0,
        syncing: statusCounts.syncing || 0,
      },
    ].filter((item) => item.value > 0);
  }, [nodes]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div>
      {total > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
            <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fill: '#E5E7EB', fontSize: 13, fontWeight: 500 }}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-foreground/50">
          <p className="text-sm">No data available</p>
        </div>
      )}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
        {data.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground/80">{entry.name}: <span className="font-semibold">{entry.value}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
