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
import { Wifi } from 'lucide-react';
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

export default function LatencyDistribution({ nodes }: LatencyDistributionProps) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<TooltipData>();
  // Load cached latencies immediately (synchronous)
  const [nodeLatencies, setNodeLatencies] = useState<Record<string, number | null>>(() => {
    return getCachedNodesLatencies(nodes);
  });

  // Measure latency for uncached nodes after initial render (deferred for better UX)
  useEffect(() => {
    let mounted = true;
    
    const measureLatencies = async () => {
      if (nodes.length === 0) return;
      
      // Load cached values first (already done in useState initializer)
      const cached = getCachedNodesLatencies(nodes);
      if (mounted) {
        setNodeLatencies(cached);
      }
      
      // Check if we need to measure any nodes
      const uncachedNodes = nodes.filter(node => cached[node.id] === undefined);
      if (uncachedNodes.length === 0) {
        // All nodes are cached, no need to measure
        return;
      }
      
      // Defer measurement until after initial render to avoid blocking UI
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
          // Measure latency for uncached nodes only
          const newLatencies = await measureNodesLatency(nodes, 10, 2000);
          if (mounted) {
            // Merge new measurements with cached values
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
  }, [nodes.length]); // Re-measure when nodes change

  const data = useMemo(() => {
    // Get all nodes with valid latency measurements
    const nodesWithLatency = Object.entries(nodeLatencies)
      .filter(([nodeId, latency]) => {
        // Check if latency is valid
        if (latency === null || latency === undefined) return false;
        // Check if node exists and is not offline
        const node = nodes.find(n => n.id === nodeId);
        return node && node.seenInGossip !== false;
      })
      .map(([nodeId, latency]) => ({ nodeId, latency: latency! }));
    
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

    // Categorize each node by its latency
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
    // Calculate average from per-node latencies
    const latencies = Object.values(nodeLatencies)
      .filter((lat): lat is number => lat !== null && lat !== undefined);
    
    if (latencies.length === 0) return 0;
    
    return Math.round(latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length);
  }, [nodeLatencies]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
        No latency data available
      </div>
    );
  }

  const margin = { top: 20, right: 20, left: 40, bottom: 40 };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          Avg: <span className="text-foreground font-semibold">
            <AnimatedNumber value={avgLatency} decimals={0} suffix="ms" />
          </span>
        </div>
      </div>
      <div className="flex-1" style={{ width: '100%', minHeight: 180, position: 'relative' }}>
        <ParentSize>
          {({ width: parentWidth = 800, height: parentHeight = 180 }) => {
            const width = parentWidth;
            const chartHeight = Math.max(180, parentHeight);
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = chartHeight - margin.top - margin.bottom;
            const svgRef = useRef<SVGSVGElement>(null);
            const hasAnimatedRef = useRef(false);

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

            // Animate bars on mount and when data changes
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
                    // Start from bottom (full height, at bottom)
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

            return (
              <>
              <svg ref={svgRef} width={width} height={chartHeight}>
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
                      top={margin.top + innerHeight}
                    left={margin.left}
                    scale={xScale}
                      numTicks={data.length}
                      tickFormat={(d) => d.replace('ms', '')}
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
  );
}
