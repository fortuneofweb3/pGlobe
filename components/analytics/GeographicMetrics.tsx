'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridColumns } from '@visx/grid';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { Globe, ChevronDown } from 'lucide-react';
import { formatStorageBytes } from '@/lib/utils/storage';

type MetricType = 'nodeCount' | 'latency' | 'storage' | 'onlineRate' | 'uptime';

interface GeographicMetricsProps {
  nodes: PNode[];
}

type TooltipData = {
  country: string;
  fullCountry: string;
  value: number;
  unit: string;
  label: string;
  nodeCount: number;
  avgLatency: number;
  storageGB: number;
  onlineRate: number;
  avgUptimeDays: number;
};

const CustomTooltip = ({ tooltipData }: { tooltipData?: TooltipData }) => {
  if (!tooltipData) return null;
  return (
    <div className="bg-black/95 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-xl">
      <p className="text-sm font-semibold text-[#E5E7EB] mb-2">{`Country: ${tooltipData.fullCountry}`}</p>
      <div className="space-y-1">
        <p className="text-xs text-[#E5E7EB]">
          <span className="font-mono font-semibold">{tooltipData.value.toFixed(1)}{tooltipData.unit}</span>
        </p>
        <p className="text-xs text-[#9CA3AF]">
          {tooltipData.label}
        </p>
      </div>
    </div>
  );
};

export default function GeographicMetrics({ nodes }: GeographicMetricsProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('nodeCount');
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<TooltipData>();

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
      
      // Note: GeographicMetrics latency uses server latency for comparison
      // This is acceptable since it's showing geographic distribution patterns
      // Individual node displays use client-side latency
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
          value: Math.round(value * 10) / 10,
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
      .slice(0, 12);
  }, [nodes, selectedMetric]);

  const getColor = (entry: TooltipData) => {
    switch (selectedMetric) {
      case 'nodeCount':
        const maxCount = Math.max(...data.map(d => d.value));
        const intensity = entry.value / maxCount;
        if (intensity > 0.7) return '#3F8277';
        if (intensity > 0.4) return '#7DD87D';
        return '#3F8277';
      
      case 'latency':
        if (entry.value < 50) return '#3F8277';
        if (entry.value < 100) return '#7DD87D';
        if (entry.value < 200) return '#F0A741';
        if (entry.value < 500) return '#FFA500';
        return '#FF6B6B';
      
      case 'storage':
        const maxStorage = Math.max(...data.map(d => d.value));
        const storageIntensity = entry.value / maxStorage;
        if (storageIntensity > 0.7) return '#3B82F6';
        if (storageIntensity > 0.4) return '#60A5FA';
        return '#93C5FD';
      
      case 'onlineRate':
        if (entry.value >= 80) return '#3F8277';
        if (entry.value >= 50) return '#F0A741';
        return '#FF6B6B';
      
      case 'uptime':
        if (entry.value >= 30) return '#3F8277';
        if (entry.value >= 7) return '#7DD87D';
        if (entry.value >= 1) return '#F0A741';
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

  const margin = { top: 10, right: 30, left: 120, bottom: 40 };
  const chartHeight = 300;

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
            className="appearance-none bg-muted/40 border border-border/60 rounded-lg px-4 py-2 pr-8 text-sm text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F0A741]/30 focus:border-[#F0A741]/50"
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
        <div style={{ width: '100%', height: chartHeight, position: 'relative' }}>
          <ParentSize>
            {({ width: parentWidth = 800 }) => {
              const width = parentWidth;
              const innerWidth = width - margin.left - margin.right;
              const innerHeight = chartHeight - margin.top - margin.bottom;

              const yScale = scaleBand<string>({
                range: [innerHeight, 0],
                domain: data.map(d => d.country),
                padding: 0.2,
              });

              const maxValue = Math.max(...data.map(d => d.value), 1); // Ensure at least 1
              const xScale = scaleLinear<number>({
                range: [0, innerWidth],
                domain: [0, maxValue * 1.1 || 10], // Ensure domain is valid
                nice: true,
              });

              return (
                <>
                  <svg width={width} height={chartHeight}>
                    <Group left={margin.left} top={margin.top}>
                      {/* Grid lines for reference */}
                      <GridColumns
                        scale={xScale}
                        height={innerHeight}
                        strokeDasharray="2,2"
                        stroke="rgba(156, 163, 175, 0.2)"
                        pointerEvents="none"
                      />
                      {/* Bars */}
                      {data.map((d) => {
                        const barHeight = Math.max(yScale.bandwidth(), 1);
                        const barWidth = Math.max(xScale(d.value), 0);
                        const y = yScale(d.country) || 0;

                        return (
                          <Bar
                            key={d.country}
                            x={0}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={getColor(d)}
                            rx={4}
                            style={{ pointerEvents: 'all' }}
                            onMouseMove={(event) => {
                              const coords = localPoint(event);
                              if (coords) {
                                showTooltip({
                                  tooltipLeft: coords.x,
                                  tooltipTop: coords.y,
                                  tooltipData: d,
                                });
                              }
                            }}
                            onMouseLeave={() => hideTooltip()}
                          />
                        );
                      })}
                    </Group>
                    <AxisLeft
                      left={margin.left}
                      top={margin.top}
                      scale={yScale}
                      numTicks={Math.min(data.length, 12)}
                      tickFormat={(d) => d}
                      tickLabelProps={() => ({
                        fill: '#E5E7EB',
                        fontSize: 11,
                        textAnchor: 'end',
                        dy: '0.33em',
                        dx: -10,
                      })}
                    />
                    <AxisBottom
                      top={margin.top + innerHeight}
                      left={margin.left}
                      scale={xScale}
                      numTicks={5}
                      tickFormat={(d) => String(d)}
                      tickLabelProps={() => ({
                        fill: '#9CA3AF',
                        fontSize: 12,
                        textAnchor: 'middle',
                      })}
                    />
                  </svg>
                  {tooltipOpen && tooltipData && (
                    <TooltipWithBounds
                      top={tooltipTop}
                      left={tooltipLeft}
                      style={{
                        ...defaultStyles,
                        backgroundColor: 'transparent',
                        border: 'none',
                        padding: 0,
                        pointerEvents: 'none',
                      }}
                    >
                      <CustomTooltip tooltipData={tooltipData} />
                    </TooltipWithBounds>
                  )}
                </>
              );
            }}
          </ParentSize>
        </div>
      </div>
    </div>
  );
}
