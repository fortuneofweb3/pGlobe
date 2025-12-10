'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PNode } from '@/lib/types/pnode';

interface StorageDistributionChartProps {
  nodes: PNode[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-black/95 backdrop-blur-md border border-[#F0A741]/30 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-xs text-foreground/80">
            Total: <span className="font-mono font-semibold text-[#F0A741]">{data.capacity.toFixed(1)} GB</span>
          </p>
          <p className="text-xs text-foreground/80">
            Used: <span className="font-mono font-semibold text-[#FFA500]">{data.used.toFixed(1)} GB</span>
          </p>
          <p className="text-xs text-foreground/80">
            Available: <span className="font-mono font-semibold text-[#3F8277]">{data.available.toFixed(1)} GB</span>
          </p>
          <p className="text-xs text-foreground/60 mt-2 pt-2 border-t border-foreground/10">
            Nodes: <span className="font-semibold">{data.nodes}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const CustomLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="flex items-center justify-center gap-6 mt-4 flex-wrap">
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

  // Truncate long location names
  const truncatedData = data.map(item => ({
    ...item,
    locationShort: item.location.length > 25 
      ? item.location.substring(0, 22) + '...' 
      : item.location,
    locationFull: item.location,
  }));

  return (
    <div className="space-y-4">
      {data.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart 
              data={truncatedData} 
              layout="vertical"
              margin={{ top: 10, right: 30, left: 140, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#9CA3AF" opacity={0.1} horizontal={true} vertical={false} />
              <XAxis 
                type="number"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                stroke="#6B7280"
                opacity={0.6}
                label={{ value: 'Storage (GB)', position: 'insideBottom', offset: -5, fill: '#9CA3AF', fontSize: 12 }}
              />
              <YAxis 
                type="category"
                dataKey="locationShort"
                tick={{ fill: '#E5E7EB', fontSize: 11 }}
                width={130}
                stroke="#6B7280"
                opacity={0.6}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
              <Bar dataKey="used" stackId="a" fill="#FFA500" name="Used" radius={[0, 4, 4, 0]} />
              <Bar dataKey="available" stackId="a" fill="#3F8277" name="Available" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-muted-foreground text-center">
            Showing top {data.length} locations by total storage capacity
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-[350px] text-foreground/50">
          <p className="text-sm">No storage data available</p>
        </div>
      )}
    </div>
  );
}
