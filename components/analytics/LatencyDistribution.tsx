'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo, useEffect, useRef, useState } from 'react';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { measureNodesLatency, getCachedNodesLatencies } from '@/lib/utils/client-latency';
import AnimatedNumber from '@/components/AnimatedNumber';

interface LatencyDistributionProps {
  nodes: PNode[];
}

const COLORS = ['#3F8277', '#7DD87D', '#F0A741', '#FFA500', '#FF6B6B'];

type TooltipData = {
  range: string;
  count: number;
  percentage: number;
};

const ALL_BUCKETS = ['<50ms', '50-100ms', '100-200ms', '200-500ms', '>500ms'];

export default function LatencyDistribution({ nodes }: LatencyDistributionProps) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<TooltipData>();
  const [nodeLatencies, setNodeLatencies] = useState<Record<string, number | null>>(() => {
    return getCachedNodesLatencies(nodes);
  });

  useEffect(() => {
    let mounted = true;

    const measureLatencies = async () => {
      if (nodes.length === 0) return;

      const cached = getCachedNodesLatencies(nodes);
      if (mounted) {
        setNodeLatencies(cached);
      }

      const uncachedNodes = nodes.filter(node => cached[node.id] === undefined);
      if (uncachedNodes.length === 0) {
        return;
      }

      const deferMeasurement = () => {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          requestIdleCallback(() => {
            if (!mounted) return;
            measureUncachedNodes();
          }, { timeout: 2000 });
        } else {
          setTimeout(() => {
            if (!mounted) return;
            measureUncachedNodes();
          }, 100);
        }
      };

      const measureUncachedNodes = async () => {
        try {
          const newLatencies = await measureNodesLatency(nodes, 10, 2000);
          if (mounted) {
            setNodeLatencies(prev => ({ ...prev, ...newLatencies }));
          }
        } catch (error) {
          console.warn('[LatencyDistribution] Failed to measure node latencies:', error);
        }
      };

      deferMeasurement();
    };

    measureLatencies();

    return () => {
      mounted = false;
    };
  }, [nodes]);

  const data = useMemo(() => {
    const nodesWithLatency = Object.entries(nodeLatencies)
      .filter(([nodeId, latency]) => {
        if (latency === null || latency === undefined) return false;
        const node = nodes.find(n => n.id === nodeId);
        return node && node.seenInGossip !== false;
      })
      .map(([nodeId, latency]) => ({ nodeId, latency: latency! }));

    if (nodesWithLatency.length === 0) {
      return [];
    }

    const buckets: Record<string, number> = {
      '<50ms': 0,
      '50-100ms': 0,
      '100-200ms': 0,
      '200-500ms': 0,
      '>500ms': 0,
    };

    nodesWithLatency.forEach(({ latency }) => {
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
  }, [nodes, nodeLatencies]);

  const avgLatency = useMemo(() => {
    const latencies = Object.values(nodeLatencies)
      .filter((lat): lat is number => lat !== null && lat !== undefined);

    if (latencies.length === 0) return 0;

    return Math.round(latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length);
  }, [nodeLatencies]);

  const hasData = data.length > 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          {hasData ? (
            <>
              Avg: <span className="text-foreground font-semibold">
                <AnimatedNumber value={avgLatency} decimals={0} suffix="ms" />
              </span>
            </>
          ) : (
            <span className="text-foreground/40">Loading latency data...</span>
          )}
        </div>
      </div>
      <div className="flex-1" style={{ width: '100%', minHeight: 180, position: 'relative' }}>
        <ParentSize>
          {({ width: parentWidth = 800, height: parentHeight = 180 }) => (
            <LatencyChart
              width={parentWidth}
              height={Math.max(180, parentHeight)}
              data={data}
              hasData={hasData}
              showTooltip={showTooltip}
              hideTooltip={hideTooltip}
              tooltipOpen={tooltipOpen}
              tooltipData={tooltipData}
              tooltipLeft={tooltipLeft}
              tooltipTop={tooltipTop}
            />
          )}
        </ParentSize>
      </div>
    </div>
  );
}

function LatencyChart({
  width,
  height,
  data,
  hasData,
  showTooltip,
  hideTooltip,
  tooltipOpen,
  tooltipData,
  tooltipLeft,
  tooltipTop,
}: {
  width: number;
  height: number;
  data: TooltipData[];
  hasData: boolean;
  showTooltip: (args: { tooltipLeft: number; tooltipTop: number; tooltipData: TooltipData }) => void;
  hideTooltip: () => void;
  tooltipOpen: boolean;
  tooltipData?: TooltipData;
  tooltipLeft?: number;
  tooltipTop?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hasAnimatedRef = useRef(false);

  const isMobile = width < 640;
  const margin = {
    top: 20,
    right: isMobile ? 10 : 20,
    left: isMobile ? 30 : 40,
    bottom: 40
  };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = scaleBand<string>({
    range: [0, innerWidth],
    domain: hasData ? data.map(d => d.range) : ALL_BUCKETS,
    padding: 0.2,
  });

  const maxCount = hasData ? Math.max(...data.map(d => d.count), 1) : 10;
  const yScale = scaleLinear<number>({
    range: [innerHeight, 0],
    domain: [0, maxCount * 1.1 || 10],
    nice: true,
  });

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    hasAnimatedRef.current = false;

    const timer = setTimeout(() => {
      if (!svgRef.current || hasAnimatedRef.current) return;

      const bars = svgRef.current.querySelectorAll('rect[fill]');

      bars.forEach((barEl: Element, index) => {
        const rect = barEl as SVGRectElement;
        const originalHeight = parseFloat(rect.getAttribute('height') || '0');
        const originalY = parseFloat(rect.getAttribute('y') || '0');

        if (originalHeight > 0) {
          rect.setAttribute('height', '0');
          rect.setAttribute('y', String(originalY + originalHeight));
          rect.style.transition = `height 1s ease-out ${index * 0.1}s, y 1s ease-out ${index * 0.1}s`;

          requestAnimationFrame(() => {
            rect.setAttribute('height', String(originalHeight));
            rect.setAttribute('y', String(originalY));
          });
        }
      });

      hasAnimatedRef.current = true;
    }, 50);

    return () => clearTimeout(timer);
  }, [data.length]);

  const displayData = hasData ? data : ALL_BUCKETS.map(range => ({ range, count: 0, percentage: 0 }));

  return (
    <>
      <svg ref={svgRef} width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            strokeDasharray="2,2"
            stroke="rgba(156, 163, 175, 0.2)"
            pointerEvents="none"
          />
          {displayData.map((d, index) => {
            const barWidth = Math.max(xScale.bandwidth(), 1);
            const barValue = d.count;
            const barTop = yScale(barValue);
            const barHeight = Math.max(innerHeight - barTop, 0);
            const x = xScale(d.range) || 0;
            const y = barTop;

            return (
              <Bar
                key={d.range}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={hasData ? COLORS[index % COLORS.length] : 'transparent'}
                rx={4}
                style={{ pointerEvents: hasData ? 'all' : 'none' }}
                opacity={hasData ? 1 : 0}
                onMouseMove={hasData ? (event) => {
                  const coords = localPoint(event);
                  if (coords) {
                    showTooltip({
                      tooltipLeft: coords.x,
                      tooltipTop: coords.y,
                      tooltipData: d as TooltipData,
                    });
                  }
                } : undefined}
                onMouseLeave={hasData ? () => hideTooltip() : undefined}
              />
            );
          })}
        </Group>
        <AxisBottom
          top={margin.top + innerHeight}
          left={margin.left}
          scale={xScale}
          numTicks={ALL_BUCKETS.length}
          tickFormat={(d) => d.replace('ms', '')}
          tickLabelProps={() => ({
            fill: hasData ? '#9CA3AF' : '#6B7280',
            fontSize: 12,
            textAnchor: 'middle',
            opacity: hasData ? 1 : 0.5,
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
            <div className="text-foreground/80">
              {tooltipData.count} nodes ({tooltipData.percentage.toFixed(1)}%)
            </div>
          </div>
        </TooltipWithBounds>
      )}
    </>
  );
}
