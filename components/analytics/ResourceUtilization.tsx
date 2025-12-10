'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { Cpu, MemoryStick } from 'lucide-react';

interface ResourceUtilizationProps {
  nodes: PNode[];
}

export default function ResourceUtilization({ nodes }: ResourceUtilizationProps) {
  const data = useMemo(() => {
    const nodesWithResources = nodes.filter(
      n => (n.cpuPercent !== undefined && n.cpuPercent !== null) ||
           (n.ramUsed !== undefined && n.ramTotal !== undefined && n.ramTotal > 0)
    );

    if (nodesWithResources.length === 0) {
      return [];
    }

    // Group into utilization buckets
    const cpuBuckets = {
      '0-25%': 0,
      '25-50%': 0,
      '50-75%': 0,
      '75-100%': 0,
    };

    const ramBuckets = {
      '0-25%': 0,
      '25-50%': 0,
      '50-75%': 0,
      '75-100%': 0,
    };

    nodesWithResources.forEach(node => {
      // CPU
      if (node.cpuPercent !== undefined && node.cpuPercent !== null) {
        const cpu = node.cpuPercent;
        if (cpu < 25) cpuBuckets['0-25%']++;
        else if (cpu < 50) cpuBuckets['25-50%']++;
        else if (cpu < 75) cpuBuckets['50-75%']++;
        else cpuBuckets['75-100%']++;
      }

      // RAM
      if (node.ramUsed !== undefined && node.ramTotal !== undefined && node.ramTotal > 0) {
        const ramPercent = (node.ramUsed / node.ramTotal) * 100;
        if (ramPercent < 25) ramBuckets['0-25%']++;
        else if (ramPercent < 50) ramBuckets['25-50%']++;
        else if (ramPercent < 75) ramBuckets['50-75%']++;
        else ramBuckets['75-100%']++;
      }
    });

    const ranges = ['0-25%', '25-50%', '50-75%', '75-100%'];
    return ranges.map(range => ({
      range,
      cpu: cpuBuckets[range as keyof typeof cpuBuckets],
      ram: ramBuckets[range as keyof typeof ramBuckets],
    }));
  }, [nodes]);

  const avgCPU = useMemo(() => {
    const nodesWithCPU = nodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null);
    if (nodesWithCPU.length === 0) return 0;
    const sum = nodesWithCPU.reduce((acc, n) => acc + (n.cpuPercent || 0), 0);
    return (sum / nodesWithCPU.length).toFixed(1);
  }, [nodes]);

  const avgRAM = useMemo(() => {
    const nodesWithRAM = nodes.filter(n => n.ramUsed !== undefined && n.ramTotal !== undefined && n.ramTotal > 0);
    if (nodesWithRAM.length === 0) return 0;
    const sum = nodesWithRAM.reduce((acc, n) => {
      const percent = n.ramTotal && n.ramUsed ? (n.ramUsed / n.ramTotal) * 100 : 0;
      return acc + percent;
    }, 0);
    return (sum / nodesWithRAM.length).toFixed(1);
  }, [nodes]);

  if (data.length === 0 || data.every(d => d.cpu === 0 && d.ram === 0)) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
        No resource data available
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Cpu className="w-4 h-4" />
            <span>CPU: <span className="text-foreground font-semibold">{avgCPU}%</span></span>
          </div>
          <div className="flex items-center gap-1">
            <MemoryStick className="w-4 h-4" />
            <span>RAM: <span className="text-foreground font-semibold">{avgRAM}%</span></span>
          </div>
        </div>
      </div>
      <div className="mt-3">
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
          />
          <Legend />
          <Bar dataKey="cpu" name="CPU" fill="#00FF88" radius={[4, 4, 0, 0]} />
          <Bar dataKey="ram" name="RAM" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

