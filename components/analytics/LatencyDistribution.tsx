'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo } from 'react';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { Wifi } from 'lucide-react';

interface LatencyDistributionProps {
  nodes: PNode[];
}

const COLORS = ['#3F8277', '#7DD87D', '#F0A741', '#FFA500', '#FF6B6B'];

type TooltipData = {
  range: string;
  count: number;
  percentage: number;
};

export default function LatencyDistribution({ nodes }: LatencyDistributionProps) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<TooltipData>();

  const data = useMemo(() => {
    const nodesWithLatency = nodes.filter(n => 
      n.latency !== undefined && 
      n.latency !== null && 
      n.latency > 0 &&
      n.seenInGossip !== false
    );
    
    if (nodesWithLatency.length === 0) {
      return [];
    }

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
      n.seenInGossip !== false
    );
    if (nodesWithLatency.length === 0) return 0;
    const sum = nodesWithLatency.reduce((acc, n) => acc + (n.latency || 0), 0);
    return Math.round(sum / nodesWithLatency.length);
  }, [nodes]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
        No latency data available
      </div>
    );
  }

  const margin = { top: 20, right: 20, left: 40, bottom: 40 };
  const chartHeight = 250;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          Avg: <span className="text-foreground font-semibold">{avgLatency}ms</span>
        </div>
      </div>
      <div className="mt-3">
        <div style={{ width: '100%', height: chartHeight, position: 'relative' }}>
          <ParentSize>
            {({ width: parentWidth = 800 }) => {
              const width = parentWidth;
              const innerWidth = width - margin.left - margin.right;
              const innerHeight = chartHeight - margin.top - margin.bottom;

              const xScale = scaleBand<string>({
                range: [0, innerWidth],
                domain: data.map(d => d.range),
                padding: 0.2,
              });

              const maxCount = Math.max(...data.map(d => d.count), 1); // Ensure at least 1 for domain
              const yScale = scaleLinear<number>({
                range: [innerHeight, 0],
                domain: [0, maxCount * 1.1 || 10], // Ensure domain is valid
                nice: true,
              });

              return (
                <>
                  <svg width={width} height={chartHeight}>
                    <Group left={margin.left} top={margin.top}>
                      {/* Grid lines for reference */}
                      <GridRows
                        scale={yScale}
                        width={innerWidth}
                        strokeDasharray="2,2"
                        stroke="rgba(156, 163, 175, 0.2)"
                        pointerEvents="none"
                      />
                      {/* Bars */}
                      {data.map((d, index) => {
                        const barWidth = Math.max(xScale.bandwidth(), 1);
                        const barValue = d.count;
                        const barTop = yScale(barValue); // Top of bar (yScale maps value to y-coordinate)
                        const barHeight = Math.max(innerHeight - barTop, 0); // Height from top to bottom
                        const x = xScale(d.range) || 0;
                        const y = barTop; // Y position is the top of the bar

                        return (
                          <Bar
                            key={d.range}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={COLORS[index % COLORS.length]}
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
                    <AxisBottom
                      top={innerHeight + margin.top}
                      left={margin.left}
                      scale={xScale}
                      tickFormat={(d) => d}
                      tickLabelProps={() => ({
                        fill: '#9CA3AF',
                        fontSize: 12,
                        textAnchor: 'middle',
                      })}
                    />
                    <AxisLeft
                      left={margin.left}
                      scale={yScale}
                      tickFormat={(d) => String(d)}
                      tickLabelProps={() => ({
                        fill: '#9CA3AF',
                        fontSize: 12,
                        textAnchor: 'end',
                        dx: -5,
                      })}
                    />
                  </svg>
                  {tooltipOpen && tooltipData && (
                    <TooltipWithBounds
                      top={tooltipTop}
                      left={tooltipLeft}
                      style={{
                        ...defaultStyles,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        pointerEvents: 'none',
                      }}
                    >
                      <div className="text-xs">
                        <div className="font-semibold text-foreground mb-1">{tooltipData.range}</div>
                        <div className="text-foreground/80">
                          {tooltipData.count} nodes ({tooltipData.percentage.toFixed(1)}%)
                        </div>
                      </div>
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
