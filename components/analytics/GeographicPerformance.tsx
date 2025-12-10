'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Globe } from 'lucide-react';

interface GeographicPerformanceProps {
  nodes: PNode[];
}

export default function GeographicPerformance({ nodes }: GeographicPerformanceProps) {
  const data = useMemo(() => {
    const nodesByCountry = new Map<string, { count: number; latencies: number[]; nodes: PNode[] }>();

    nodes.forEach(node => {
      // Skip nodes not seen in gossip (offline)
      if (node.seenInGossip === false) return;
      
      const country = node.locationData?.country || 'Unknown';
      if (!nodesByCountry.has(country)) {
        nodesByCountry.set(country, { count: 0, latencies: [], nodes: [] });
      }
      const entry = nodesByCountry.get(country)!;
      entry.count++;
      entry.nodes.push(node);
      if (node.latency !== undefined && node.latency !== null && node.latency > 0) {
        entry.latencies.push(node.latency);
      }
    });

    return Array.from(nodesByCountry.entries())
      .map(([country, data]) => {
        const avgLatency = data.latencies.length > 0
          ? Math.round(data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length)
          : null;
        return {
          country: country.length > 15 ? country.substring(0, 15) + '...' : country,
          fullCountry: country,
          nodeCount: data.count,
          avgLatency: avgLatency || 0,
          hasLatency: avgLatency !== null,
        };
      })
      .sort((a, b) => b.nodeCount - a.nodeCount)
      .slice(0, 10); // Top 10 countries
  }, [nodes]);

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground">Geographic Performance</h3>
        </div>
        <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
          No geographic data available
        </div>
      </div>
    );
  }

  const getColor = (latency: number, hasLatency: boolean) => {
    if (!hasLatency) return '#6B7280';
    if (latency < 50) return '#3F8277';
    if (latency < 100) return '#7DD87D';
    if (latency < 200) return '#F0A741';
    if (latency < 500) return '#FFA500';
    return '#FF6B6B';
  };

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis dataKey="country" type="category" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={100} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string, props: any) => {
              if (name === 'nodeCount') return [`${value} nodes`, 'Nodes'];
              if (name === 'avgLatency') {
                if (!props.payload.hasLatency) return ['N/A', 'Avg Latency'];
                return [`${value}ms`, 'Avg Latency'];
              }
              return [value, name];
            }}
            labelFormatter={(label) => `Country: ${label}`}
          />
          <Bar dataKey="nodeCount" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.avgLatency, entry.hasLatency)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="text-xs text-muted-foreground">
        Showing top 10 countries by node count. Color indicates average latency (green = fast, red = slow).
      </div>
    </div>
  );
}

