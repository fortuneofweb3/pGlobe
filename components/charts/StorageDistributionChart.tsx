'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PNode } from '@/lib/types/pnode';

interface StorageDistributionChartProps {
  nodes: PNode[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/95 backdrop-blur-md border border-[#FFD700]/30 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs text-foreground/80" style={{ color: entry.color }}>
            {entry.name}: <span className="font-mono font-semibold">{entry.value.toFixed(1)} GB</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const CustomLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="flex items-center justify-center gap-6 mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-foreground/80">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function StorageDistributionChart({ nodes }: StorageDistributionChartProps) {
  const data = useMemo(() => {
    // Only process nodes with valid storage data
    const nodesWithStorage = nodes.filter(
      (node) => 
        node.storageCapacity && 
        node.storageCapacity > 0 && 
        node.storageUsed !== undefined && 
        node.storageUsed >= 0
    );

    if (nodesWithStorage.length === 0) {
      return [];
    }

    // Group nodes by location
    const locationMap = new Map<string, { capacity: number; used: number; count: number }>();

    nodesWithStorage.forEach((node) => {
      const location = node.locationData?.city && node.locationData?.country
        ? `${node.locationData.city}, ${node.locationData.country}`
        : node.locationData?.city || node.locationData?.country || node.location || 'Unknown';
      const existing = locationMap.get(location) || { capacity: 0, used: 0, count: 0 };
      
      // Ensure used doesn't exceed capacity (data validation)
      const capacity = node.storageCapacity || 0;
      const used = Math.min(node.storageUsed || 0, capacity); // Cap used at capacity
      
      locationMap.set(location, {
        capacity: existing.capacity + capacity,
        used: existing.used + used,
        count: existing.count + 1,
      });
    });

    return Array.from(locationMap.entries())
      .map(([location, stats]) => {
        const capacityGB = stats.capacity / (1024 * 1024 * 1024);
        const usedGB = stats.used / (1024 * 1024 * 1024);
        const availableGB = Math.max(0, capacityGB - usedGB); // Ensure non-negative
        
        return {
          location,
          capacity: Math.round(capacityGB * 10) / 10, // Round to 1 decimal
          used: Math.round(usedGB * 10) / 10,
          available: Math.round(availableGB * 10) / 10,
          nodes: stats.count,
        };
      })
      .filter(item => item.capacity > 0) // Only show locations with actual capacity
      .sort((a, b) => b.capacity - a.capacity)
      .slice(0, 10); // Top 10 locations
  }, [nodes]);

  return (
    <div>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#FFD700" opacity={0.1} />
            <XAxis
              dataKey="location"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fill: '#ffffff', fontSize: 11 }}
              stroke="#FFD700"
              opacity={0.6}
            />
            <YAxis 
              tick={{ fill: '#ffffff', fontSize: 11 }}
              stroke="#FFD700"
              opacity={0.6}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            <Bar dataKey="capacity" fill="#FFD700" name="Total Capacity (GB)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="used" fill="#FFA500" name="Used (GB)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="available" fill="#3F8277" name="Available (GB)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-foreground/50">
          <p className="text-sm">No storage data available</p>
        </div>
      )}
    </div>
  );
}
