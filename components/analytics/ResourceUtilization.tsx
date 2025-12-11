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
import { LegendItem, LegendLabel, LegendOrdinal } from '@visx/legend';
import { Cpu, MemoryStick } from 'lucide-react';

interface ResourceUtilizationProps {
  nodes: PNode[];
}

type TooltipData = {
  range: string;
  cpu: number;
  ram: number;
};

const colors = {
  cpu: '#3F8277',
  ram: '#3B82F6',
};

export default function ResourceUtilization({ nodes }: ResourceUtilizationProps) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<TooltipData>();

  const data = useMemo(() => {
    const nodesWithResources = nodes.filter(
      n => (n.cpuPercent !== undefined && n.cpuPercent !== null) ||
           (n.ramUsed !== undefined && n.ramTotal !== undefined && n.ramTotal > 0)
    );

    if (nodesWithResources.length === 0) {
      return [];
    }

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
      if (node.cpuPercent !== undefined && node.cpuPercent !== null) {
        const cpu = node.cpuPercent;
        if (cpu < 25) cpuBuckets['0-25%']++;
        else if (cpu < 50) cpuBuckets['25-50%']++;
        else if (cpu < 75) cpuBuckets['50-75%']++;
        else cpuBuckets['75-100%']++;
      }

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

  const margin = { top: 20, right: 20, left: 40, bottom: 40 };
  const chartHeight = 250;

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

              const maxValue = Math.max(...data.map(d => Math.max(d.cpu, d.ram)), 1); // Ensure at least 1
              const yScale = scaleLinear<number>({
                range: [innerHeight, 0],
                domain: [0, maxValue * 1.1 || 10], // Ensure domain is valid
                nice: true,
              });

              const barWidth = xScale.bandwidth() / 2;

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
                      {data.map((d) => {
                        const x = xScale(d.range) || 0;
                        const cpuValue = d.cpu;
                        const ramValue = d.ram;
                        const cpuBarTop = yScale(cpuValue);
                        const ramBarTop = yScale(ramValue);
                        const cpuBarHeight = Math.max(innerHeight - cpuBarTop, 0);
                        const ramBarHeight = Math.max(innerHeight - ramBarTop, 0);

                        return (
                          <Group key={d.range}>
                            <Bar
                              x={x}
                              y={cpuBarTop}
                              width={Math.max(barWidth, 1)}
                              height={cpuBarHeight}
                              fill={colors.cpu}
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
                            <Bar
                              x={x + barWidth}
                              y={ramBarTop}
                              width={Math.max(barWidth, 1)}
                              height={ramBarHeight}
                              fill={colors.ram}
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
                          </Group>
                        );
                      })}
                    </Group>
                    <AxisBottom
                      top={margin.top + innerHeight}
                      left={margin.left}
                      scale={xScale}
                      numTicks={data.length}
                      tickFormat={(d) => d}
                      tickLabelProps={() => ({
                        fill: '#9CA3AF',
                        fontSize: 12,
                        textAnchor: 'middle',
                      })}
                    />
                    <AxisLeft
                      left={margin.left}
                      top={margin.top}
                      scale={yScale}
                      numTicks={5}
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
                        <div className="text-foreground/80 space-y-1">
                          <div>CPU: {tooltipData.cpu} nodes</div>
                          <div>RAM: {tooltipData.ram} nodes</div>
                        </div>
                      </div>
                    </TooltipWithBounds>
                  )}
                </>
              );
            }}
          </ParentSize>
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.cpu }}></div>
            <span className="text-foreground/80">CPU</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.ram }}></div>
            <span className="text-foreground/80">RAM</span>
          </div>
        </div>
      </div>
    </div>
  );
}
