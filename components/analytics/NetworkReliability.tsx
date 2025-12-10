'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Shield } from 'lucide-react';

interface NetworkReliabilityProps {
  nodes: PNode[];
}

export default function NetworkReliability({ nodes }: NetworkReliabilityProps) {
  const data = useMemo(() => {
    const nodesWithUptime = nodes.filter(n => n.uptime !== undefined && n.uptime !== null && n.uptime > 0);
    
    if (nodesWithUptime.length === 0) {
      return [];
    }

    // Group nodes by uptime ranges (in days)
    const ranges = [
      { label: '<1d', min: 0, max: 86400 },
      { label: '1-7d', min: 86400, max: 604800 },
      { label: '7-30d', min: 604800, max: 2592000 },
      { label: '30-90d', min: 2592000, max: 7776000 },
      { label: '>90d', min: 7776000, max: Infinity },
    ];

    return ranges.map(range => {
      const count = nodesWithUptime.filter(n => {
        const uptime = n.uptime || 0;
        return uptime >= range.min && uptime < range.max;
      }).length;
      const percentage = (count / nodesWithUptime.length) * 100;
      return {
        range: range.label,
        count,
        percentage: Math.round(percentage),
      };
    });
  }, [nodes]);

  const avgUptimeDays = useMemo(() => {
    const nodesWithUptime = nodes.filter(n => n.uptime !== undefined && n.uptime !== null && n.uptime > 0);
    if (nodesWithUptime.length === 0) return 0;
    const sum = nodesWithUptime.reduce((acc, n) => acc + (n.uptime || 0), 0);
    return Math.round((sum / nodesWithUptime.length) / 86400);
  }, [nodes]);

  const onlineRate = useMemo(() => {
    const online = nodes.filter(n => n.status === 'online').length;
    return nodes.length > 0 ? Math.round((online / nodes.length) * 100) : 0;
  }, [nodes]);

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground">Network Reliability</h3>
        </div>
        <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
          No reliability data available
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground">Network Reliability</h3>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div>
            Avg Uptime: <span className="text-foreground font-semibold">{avgUptimeDays}d</span>
          </div>
          <div>
            Online Rate: <span className="text-foreground font-semibold">{onlineRate}%</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <XAxis dataKey="range" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'count') return [`${value} nodes`, 'Count'];
              if (name === 'percentage') return [`${value}%`, 'Percentage'];
              return [value, name];
            }}
          />
          <Bar dataKey="count" fill="#3F8277" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="text-xs text-muted-foreground">
        {nodes.filter(n => n.uptime !== undefined && n.uptime !== null && n.uptime > 0).length} nodes reporting uptime
      </div>
    </div>
  );
}

