'use client';

import { useMemo, useEffect, useRef } from 'react';
import { PNode } from '@/lib/types/pnode';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import ParentSize from '@visx/responsive/lib/components/ParentSize';

interface NetworkHealthChartProps {
  nodes: PNode[];
}

const COLORS = {
  online: '#3F8277',
  offline: '#ED1C24',
  syncing: '#F0A741',
};

type TooltipData = {
  name: string;
  value: number;
  online: number;
  offline: number;
  syncing: number;
};

const CustomTooltip = ({ tooltipData }: { tooltipData?: TooltipData }) => {
  if (!tooltipData) return null;
  const total = tooltipData.online + tooltipData.offline + tooltipData.syncing;
  return (
    <div className="bg-black/95 backdrop-blur-md border border-[#F0A741]/30 rounded-lg p-3 shadow-xl">
      <p className="text-sm font-semibold text-foreground mb-2">{tooltipData.name}</p>
      <div className="space-y-1">
        <p className="text-xs text-foreground/80">
          <span className="font-mono font-semibold">{tooltipData.value}</span> nodes
        </p>
        {total > 0 && (
          <p className="text-xs text-foreground/60">
            {((tooltipData.value / total) * 100).toFixed(1)}% of network
          </p>
        )}
      </div>
    </div>
  );
};

export default function NetworkHealthChart({ nodes }: NetworkHealthChartProps) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<TooltipData>();

  const data = useMemo(() => {
    const statusCounts = nodes.reduce(
      (acc, node) => {
        const status = node.status || 'offline';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const total = (statusCounts.online || 0) + (statusCounts.offline || 0) + (statusCounts.syncing || 0);

    return [
      { 
        name: 'Online', 
        value: statusCounts.online || 0, 
        color: COLORS.online,
        online: statusCounts.online || 0,
        offline: statusCounts.offline || 0,
        syncing: statusCounts.syncing || 0,
      },
      { 
        name: 'Syncing', 
        value: statusCounts.syncing || 0, 
        color: COLORS.syncing,
        online: statusCounts.online || 0,
        offline: statusCounts.offline || 0,
        syncing: statusCounts.syncing || 0,
      },
      { 
        name: 'Offline', 
        value: statusCounts.offline || 0, 
        color: COLORS.offline,
        online: statusCounts.online || 0,
        offline: statusCounts.offline || 0,
        syncing: statusCounts.syncing || 0,
      },
    ].filter((item) => item.value > 0);
  }, [nodes]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-foreground/50">
        <p className="text-sm">No data available</p>
      </div>
    );
  }

  const svgRef = useRef<SVGSVGElement>(null);
  const hasAnimatedRef = useRef(false);

  // Animate bars on mount and when data changes
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;
    
    hasAnimatedRef.current = false;
    
    const timer = setTimeout(() => {
      if (!svgRef.current || hasAnimatedRef.current) return;
      
      const bars = svgRef.current.querySelectorAll('rect[fill]');
      
      bars.forEach((barEl: Element, index) => {
        const rect = barEl as SVGRectElement;
        const originalWidth = parseFloat(rect.getAttribute('width') || '0');
        
        if (originalWidth > 0) {
          // Start from 0 width
          rect.setAttribute('width', '0');
          rect.style.transition = `width 1s ease-out ${index * 0.1}s`;
          
          requestAnimationFrame(() => {
            rect.setAttribute('width', String(originalWidth));
          });
        }
      });
      
      hasAnimatedRef.current = true;
    }, 50);

    return () => clearTimeout(timer);
  }, [data.length]);
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1" style={{ width: '100%', minHeight: 150, position: 'relative' }}>
        <ParentSize>
          {({ width: parentWidth = 800, height: parentHeight = 150 }) => {
            const width = parentWidth;
            const chartHeight = Math.max(150, parentHeight);
            // Responsive margins - smaller on mobile for better chart size
            const isMobile = width < 640;
            const margin = { 
              top: 5, 
              right: isMobile ? 10 : 30, 
              left: isMobile ? 50 : 80, 
              bottom: 5 
            };
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = chartHeight - margin.top - margin.bottom;

            const yScale = scaleBand<string>({
              range: [innerHeight, 0],
              domain: data.map(d => d.name),
              padding: 0.2,
            });

            const xScale = scaleLinear<number>({
              range: [0, innerWidth],
              domain: [0, Math.max(...data.map(d => d.value)) * 1.1],
              nice: true,
            });

            return (
              <>
              <svg ref={svgRef} width={width} height={chartHeight}>
                <Group left={margin.left} top={margin.top}>
                  {data.map((d) => {
                    const barHeight = yScale.bandwidth();
                    const barWidth = xScale(d.value);
                    const y = yScale(d.name) || 0;

                    return (
                      <Bar
                        key={d.name}
                        x={0}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill={d.color}
                        rx={4}
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
                  scale={yScale}
                  tickFormat={(d) => d}
                  tickLabelProps={() => ({
                    fill: '#E5E7EB',
                    fontSize: 13,
                    fontWeight: 500,
                    textAnchor: 'end',
                    dy: '0.33em',
                    dx: -10,
                  })}
                />
                <AxisBottom
                  top={innerHeight + margin.top}
                  left={margin.left}
                  scale={xScale}
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
      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
        {data.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground/80">{entry.name}: <span className="font-semibold">{entry.value}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
