'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Globe, ChevronDown } from 'lucide-react';
import { formatStorageBytes } from '@/lib/utils/storage';

interface GeographicMetricsProps {
  nodes: PNode[];
}

type MetricType = 'nodeCount' | 'latency' | 'storage' | 'onlineRate' | 'uptime';

export default function GeographicMetrics({ nodes }: GeographicMetricsProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('nodeCount');

  const metricOptions = [
    { value: 'nodeCount' as MetricType, label: 'Node Count' },
    { value: 'latency' as MetricType, label: 'Avg Latency' },
    { value: 'storage' as MetricType, label: 'Total Storage' },
    { value: 'onlineRate' as MetricType, label: 'Online Rate' },
    { value: 'uptime' as MetricType, label: 'Avg Uptime' },
  ];

  const data = useMemo(() => {
    const nodesByCountry = new Map<string, {
      count: number;
      latencies: number[];
      nodes: PNode[];
      totalStorage: number;
      onlineCount: number;
      uptimes: number[];
    }>();

    nodes.forEach(node => {
      // Skip nodes not seen in gossip (offline)
      if (node.seenInGossip === false) return;
      
      const country = node.locationData?.country || 'Unknown';
      if (!nodesByCountry.has(country)) {
        nodesByCountry.set(country, { 
          count: 0, 
          latencies: [], 
          nodes: [],
          totalStorage: 0,
          onlineCount: 0,
          uptimes: [],
        });
      }
      const entry = nodesByCountry.get(country)!;
      entry.count++;
      entry.nodes.push(node);
      
      if (node.latency !== undefined && node.latency !== null && node.latency > 0) {
        entry.latencies.push(node.latency);
      }
      
      if (node.storageCapacity && node.storageCapacity > 0) {
        entry.totalStorage += node.storageCapacity;
      }
      
      if (node.status === 'online') {
        entry.onlineCount++;
      }
      
      if (node.uptime && node.uptime > 0) {
        entry.uptimes.push(node.uptime);
      }
    });

    return Array.from(nodesByCountry.entries())
      .map(([country, data]) => {
        const avgLatency = data.latencies.length > 0
          ? Math.round(data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length)
          : null;
        
        const avgUptimeDays = data.uptimes.length > 0
          ? (data.uptimes.reduce((a, b) => a + b, 0) / data.uptimes.length) / 86400
          : null;

        const onlineRate = data.count > 0 
          ? (data.onlineCount / data.count) * 100 
          : 0;

        const storageGB = data.totalStorage / (1024 * 1024 * 1024);

        // Calculate value based on selected metric
        let value = 0;
        let label = '';
        let unit = '';

        switch (selectedMetric) {
          case 'nodeCount':
            value = data.count;
            label = 'Nodes';
            unit = '';
            break;
          case 'latency':
            value = avgLatency || 0;
            label = 'Latency';
            unit = 'ms';
            break;
          case 'storage':
            value = storageGB;
            label = 'Storage';
            unit = 'GB';
            break;
          case 'onlineRate':
            value = onlineRate;
            label = 'Online Rate';
            unit = '%';
            break;
          case 'uptime':
            value = avgUptimeDays || 0;
            label = 'Uptime';
            unit = ' days';
            break;
        }

        return {
          country: country.length > 20 ? country.substring(0, 17) + '...' : country,
          fullCountry: country,
          value: Math.round(value * 10) / 10, // Round to 1 decimal
          nodeCount: data.count,
          avgLatency: avgLatency || 0,
          hasLatency: avgLatency !== null,
          storageGB: Math.round(storageGB * 10) / 10,
          onlineRate: Math.round(onlineRate),
          avgUptimeDays: avgUptimeDays ? Math.round(avgUptimeDays * 10) / 10 : 0,
          label,
          unit,
        };
      })
      .filter(item => {
        // Filter out countries with no data for selected metric
        switch (selectedMetric) {
          case 'latency':
            return item.hasLatency;
          case 'storage':
            return item.storageGB > 0;
          case 'uptime':
            return item.avgUptimeDays > 0;
          default:
            return item.nodeCount > 0;
        }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 12); // Top 12 countries
  }, [nodes, selectedMetric]);

  const getColor = (entry: any) => {
    switch (selectedMetric) {
      case 'nodeCount':
        // More nodes = brighter green
        const maxCount = Math.max(...data.map(d => d.value));
        const intensity = entry.value / maxCount;
        if (intensity > 0.7) return '#00FF88';
        if (intensity > 0.4) return '#7DD87D';
        return '#3F8277';
      
      case 'latency':
        // Lower latency = better (green), higher = worse (red)
        if (entry.value < 50) return '#00FF88';
        if (entry.value < 100) return '#7DD87D';
        if (entry.value < 200) return '#FFD700';
        if (entry.value < 500) return '#FFA500';
        return '#FF6B6B';
      
      case 'storage':
        // More storage = brighter blue
        const maxStorage = Math.max(...data.map(d => d.value));
        const storageIntensity = entry.value / maxStorage;
        if (storageIntensity > 0.7) return '#3B82F6';
        if (storageIntensity > 0.4) return '#60A5FA';
        return '#93C5FD';
      
      case 'onlineRate':
        // Higher online rate = better (green)
        if (entry.value >= 80) return '#00FF88';
        if (entry.value >= 50) return '#FFD700';
        return '#FF6B6B';
      
      case 'uptime':
        // Higher uptime = better (green)
        if (entry.value >= 30) return '#00FF88';
        if (entry.value >= 7) return '#7DD87D';
        if (entry.value >= 1) return '#FFD700';
        return '#FFA500';
      
      default:
        return '#6B7280';
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        No geographic data available
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-foreground/40" />
          <h2 className="text-base font-semibold text-foreground">Geographic Distribution</h2>
        </div>
        <div className="relative">
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
            className="appearance-none bg-muted/40 border border-border/60 rounded-lg px-4 py-2 pr-8 text-sm text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFD700]/30 focus:border-[#FFD700]/50"
          >
            {metricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>
      
      <div className="mt-3">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart 
            data={data} 
            layout="vertical"
            margin={{ top: 10, right: 30, left: 120, bottom: 20 }}
          >
            <XAxis 
              type="number"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              stroke="#6B7280"
              opacity={0.6}
              label={{ 
                value: `${metricOptions.find(m => m.value === selectedMetric)?.label}${data[0]?.unit || ''}`, 
                position: 'insideBottom', 
                offset: -5, 
                fill: '#9CA3AF', 
                fontSize: 12 
              }}
            />
            <YAxis 
              dataKey="country"
              type="category"
              tick={{ fill: '#E5E7EB', fontSize: 11 }}
              width={115}
              stroke="#6B7280"
              opacity={0.6}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string, props: any) => {
                const entry = props.payload;
                return [
                  `${value.toFixed(1)}${entry.unit}`,
                  metricOptions.find(m => m.value === selectedMetric)?.label || 'Value'
                ];
              }}
              labelFormatter={(label) => `Country: ${label}`}
            />
            <Bar 
              dataKey="value" 
              radius={[0, 4, 4, 0]}
              animationDuration={400}
              animationEasing="ease-in-out"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

