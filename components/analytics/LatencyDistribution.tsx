'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { Wifi } from 'lucide-react';

interface LatencyDistributionProps {
  nodes: PNode[];
}

export default function LatencyDistribution({ nodes }: LatencyDistributionProps) {
  const data = useMemo(() => {
    const nodesWithLatency = nodes.filter(n => 
      n.latency !== undefined && 
      n.latency !== null && 
      n.latency > 0 &&
      n.seenInGossip !== false // Exclude nodes not seen in gossip (offline)
    );
    
    if (nodesWithLatency.length === 0) {
      return [];
    }

    // Group latency into buckets: <50ms, 50-100ms, 100-200ms, 200-500ms, >500ms
    const buckets = {
      '<50ms': 0,
      '50-100ms': 0,
      '100-200ms': 0,
      '200-500ms': 0,
      '>500ms': 0,
    };

    nodesWithLatency.forEach(node => {
      const latency = node.latency || 0;
      if (latency < 50) buckets['<50ms']++;
      else if (latency < 100) buckets['50-100ms']++;
      else if (latency < 200) buckets['100-200ms']++;
      else if (latency < 500) buckets['200-500ms']++;
      else buckets['>500ms']++;
    });

    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
      percentage: (count / nodesWithLatency.length) * 100,
    }));
  }, [nodes]);

  const avgLatency = useMemo(() => {
    const nodesWithLatency = nodes.filter(n => 
      n.latency !== undefined && 
      n.latency !== null && 
      n.latency > 0 &&
      n.seenInGossip !== false // Exclude nodes not seen in gossip (offline)
    );
    if (nodesWithLatency.length === 0) return 0;
    const sum = nodesWithLatency.reduce((acc, n) => acc + (n.latency || 0), 0);
    return Math.round(sum / nodesWithLatency.length);
  }, [nodes]);

  const COLORS = ['#00FF88', '#7DD87D', '#FFD700', '#FFA500', '#FF6B6B'];

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Wifi className="w-5 h-5 text-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground">Latency Distribution</h3>
        </div>
        <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
          No latency data available
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="w-5 h-5 text-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground">Latency Distribution</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          Avg: <span className="text-foreground font-semibold">{avgLatency}ms</span>
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
              if (name === 'percentage') return [`${value.toFixed(1)}%`, 'Percentage'];
              return [value, name];
            }}
          />
          <Bar dataKey="count" fill="#00FF88" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="text-xs text-muted-foreground">
        {nodes.filter(n => 
          n.latency !== undefined && 
          n.latency !== null && 
          n.latency > 0 &&
          n.seenInGossip !== false // Exclude nodes not seen in gossip (offline)
        ).length} nodes reporting latency
      </div>
    </div>
  );
}

