'use client';

import { useMemo } from 'react';
import { PNode } from '@/lib/types/pnode';
import { ResponsiveContainer, Tooltip, Legend, ScatterChart, Scatter, XAxis, YAxis, Cell } from 'recharts';

interface GeographicHeatmapProps {
  nodes: PNode[];
}

interface HeatmapPoint {
  lat: number;
  lon: number;
  count: number;
  avgUptime: number;
  avgLatency: number;
  status: string;
}

export default function GeographicHeatmap({ nodes }: GeographicHeatmapProps) {
  const heatmapData = useMemo(() => {
    // Group nodes by location (rounded to reduce precision)
    const locationMap = new Map<string, PNode[]>();

    nodes.forEach(node => {
      if (node.locationData?.lat && node.locationData?.lon) {
        // Round to ~10km precision
        const latRounded = Math.round(node.locationData.lat * 10) / 10;
        const lonRounded = Math.round(node.locationData.lon * 10) / 10;
        const key = `${latRounded},${lonRounded}`;

        if (!locationMap.has(key)) {
          locationMap.set(key, []);
        }
        locationMap.get(key)!.push(node);
      }
    });

    // Convert to heatmap points
    const points: HeatmapPoint[] = [];
    locationMap.forEach((nodeGroup, key) => {
      const [lat, lon] = key.split(',').map(Number);
      const count = nodeGroup.length;
      const avgUptime = nodeGroup.reduce((sum, n) => sum + (n.uptime || 0), 0) / count;
      const avgLatency = nodeGroup
        .filter(n => n.latency !== undefined)
        .reduce((sum, n, _, arr) => sum + (n.latency || 0) / arr.length, 0);
      
      const onlineCount = nodeGroup.filter(n => n.status === 'online').length;
      const status = onlineCount / count > 0.8 ? 'healthy' : onlineCount / count > 0.5 ? 'moderate' : 'poor';

      points.push({
        lat,
        lon,
        count,
        avgUptime,
        avgLatency: avgLatency || 0,
        status,
      });
    });

    return points;
  }, [nodes]);

  const getColor = (status: string, count: number) => {
    if (status === 'healthy') return '#10b981';
    if (status === 'moderate') return '#f59e0b';
    if (status === 'poor') return '#ef4444';
    return '#6b7280';
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <XAxis 
            type="number" 
            dataKey="lon" 
            name="Longitude"
            domain={['auto', 'auto']}
          />
          <YAxis 
            type="number" 
            dataKey="lat" 
            name="Latitude"
            domain={['auto', 'auto']}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload[0]) {
                const data = payload[0].payload as HeatmapPoint;
                return (
                  <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg">
                    <p className="font-semibold">Location: {data.lat.toFixed(2)}, {data.lon.toFixed(2)}</p>
                    <p>Nodes: {data.count}</p>
                    <p>Avg Uptime: {(data.avgUptime / 86400).toFixed(1)} days</p>
                    {data.avgLatency > 0 && <p>Avg Latency: {data.avgLatency.toFixed(0)}ms</p>}
                    <p>Status: {data.status}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend />
          <Scatter 
            name="Node Clusters" 
            data={heatmapData} 
            fill="#8884d8"
          >
            {heatmapData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={getColor(entry.status, entry.count)}
                r={Math.min(entry.count * 3, 30)} // Size based on node count
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span>Healthy (&gt;80% online)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
          <span>Moderate (50-80% online)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span>Poor (&lt;50% online)</span>
        </div>
      </div>
    </div>
  );
}

