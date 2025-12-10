'use client';

import { useMemo } from 'react';
import { PNode } from '@/lib/types/pnode';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface CurrentStateMetricsProps {
  nodes: PNode[];
}

export default function CurrentStateMetrics({ nodes }: CurrentStateMetricsProps) {
  // Version comparison (current snapshot)
  const versionMetrics = useMemo(() => {
    const versionGroups = new Map<string, PNode[]>();
    
    nodes.forEach(node => {
      const version = node.version || 'unknown';
      if (!versionGroups.has(version)) {
        versionGroups.set(version, []);
      }
      versionGroups.get(version)!.push(node);
    });

    return Array.from(versionGroups.entries()).map(([version, groupNodes]) => {
      const avgUptime = groupNodes.reduce((sum, n) => sum + (n.uptime || 0), 0) / groupNodes.length / 86400;
      const avgCPU = groupNodes
        .filter(n => n.cpuPercent !== undefined)
        .reduce((sum, n, _, arr) => sum + (n.cpuPercent || 0) / arr.length, 0);
      const avgStorage = groupNodes.reduce((sum, n) => sum + ((n.storageUsagePercent || 0) / groupNodes.length), 0);
      const onlineCount = groupNodes.filter(n => n.status === 'online').length;

      return {
        version,
        count: groupNodes.length,
        avgUptimeDays: avgUptime || 0,
        avgCPU: avgCPU || 0,
        avgStoragePercent: avgStorage || 0,
        onlineRate: (onlineCount / groupNodes.length) * 100,
      };
    }).sort((a, b) => b.count - a.count);
  }, [nodes]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const statuses = {
      online: nodes.filter(n => n.status === 'online').length,
      offline: nodes.filter(n => n.status === 'offline').length,
      syncing: nodes.filter(n => n.status === 'syncing').length,
    };
    return Object.entries(statuses).map(([name, value]) => ({ name, value }));
  }, [nodes]);

  // Country performance (current snapshot)
  const countryMetrics = useMemo(() => {
    const countryGroups = new Map<string, PNode[]>();
    
    nodes.forEach(node => {
      const country = node.locationData?.countryCode || 'unknown';
      if (!countryGroups.has(country)) {
        countryGroups.set(country, []);
      }
      countryGroups.get(country)!.push(node);
    });

    return Array.from(countryGroups.entries())
      .map(([country, groupNodes]) => {
        const onlineCount = groupNodes.filter(n => n.status === 'online').length;
        const avgLatency = groupNodes
          .filter(n => n.latency !== undefined)
          .reduce((sum, n, _, arr) => sum + (n.latency || 0) / arr.length, 0);

        return {
          country,
          count: groupNodes.length,
          onlineRate: (onlineCount / groupNodes.length) * 100,
          avgLatency: avgLatency || 0,
        };
      })
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 countries
  }, [nodes]);

  const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Current snapshot metrics grouped by version
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={versionMetrics}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="version" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="avgUptimeDays" fill="#3b82f6" name="Avg Uptime (days)" />
          <Bar yAxisId="right" dataKey="avgCPU" fill="#10b981" name="Avg CPU %" />
          <Bar yAxisId="right" dataKey="onlineRate" fill="#f59e0b" name="Online Rate %" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

