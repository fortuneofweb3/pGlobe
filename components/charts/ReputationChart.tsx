'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PNode } from '@/lib/types/pnode';

interface ReputationChartProps {
  nodes: PNode[];
}

export default function ReputationChart({ nodes }: ReputationChartProps) {
  const data = useMemo(() => {
    // Create reputation buckets
    const buckets = [
      { range: '90-100', min: 90, max: 100, count: 0 },
      { range: '80-89', min: 80, max: 89, count: 0 },
      { range: '70-79', min: 70, max: 79, count: 0 },
      { range: '60-69', min: 60, max: 69, count: 0 },
      { range: '0-59', min: 0, max: 59, count: 0 },
    ];

    nodes.forEach((node) => {
      const reputation = node.reputation || 0;
      const bucket = buckets.find((b) => reputation >= b.min && reputation <= b.max);
      if (bucket) {
        bucket.count++;
      }
    });

    return buckets.filter((b) => b.count > 0);
  }, [nodes]);

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4">Node Reputation Distribution</h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color_38))" />
            <XAxis
              dataKey="range"
              tick={{ fill: 'rgb(var(--color_14))', fontSize: 12 }}
            />
            <YAxis tick={{ fill: 'rgb(var(--color_14))', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgb(var(--color_11))',
                border: '1px solid rgb(var(--color_47))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="count" fill="#5B2A55" name="Number of Nodes" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          No data available
        </div>
      )}
    </div>
  );
}

