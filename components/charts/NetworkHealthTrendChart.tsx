'use client';

import { useMemo, useEffect, useRef } from 'react';
import { scaleTime, scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { timeFormat } from 'd3-time-format';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { Group } from '@visx/group';
import { Circle } from '@visx/shape';

interface NetworkHealthTrendChartProps {
  historicalData: Array<{
    timestamp: number;
    networkHealthScore?: number;
    networkHealthAvailability?: number;
    networkHealthVersion?: number;
    networkHealthDistribution?: number;
  }>;
  height?: number;
}

const formatDate = (date: Date): string => {
  return timeFormat('%b %d')(date);
};

const formatTime = (date: Date): string => {
  return timeFormat('%H:%M')(date);
};

const formatDateAxis = (date: Date, chartData: Array<{ timestamp: number }>): string => {
  if (chartData.length === 0) return '';
  
  const timeSpan = Math.max(...chartData.map(d => d.timestamp)) - Math.min(...chartData.map(d => d.timestamp));
  const isSameDay = timeSpan < 86400000; // Less than 24 hours
  
  if (isSameDay) {
    return formatTime(date);
  } else {
    return formatDate(date);
  }
};

export default function NetworkHealthTrendChart({ 
  historicalData, 
  height = 300 
}: NetworkHealthTrendChartProps) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<any>();
  const margin = { top: 30, right: 30, left: 60, bottom: 70 };
  const svgRef = useRef<SVGSVGElement>(null);
  const hasAnimatedRef = useRef(false);

  const chartData = useMemo(() => {
    if (historicalData.length === 0) return [];

    return historicalData
      .filter(d => d.networkHealthScore !== undefined && d.networkHealthScore !== null)
      .map(d => ({
        timestamp: d.timestamp,
        overall: d.networkHealthScore || 0,
        availability: d.networkHealthAvailability || 0,
        version: d.networkHealthVersion || 0,
        distribution: d.networkHealthDistribution || 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [historicalData]);

  // Calculate dynamic Y-axis domain for better zoom
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];

    const values = chartData.map(d => d.overall);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // If the range is very small (nearly flat line), zoom in
    if (range < 10) {
      const center = (min + max) / 2;
      const padding = Math.max(5, range * 0.5); // At least 5% padding, or 50% of range
      return [
        Math.max(0, Math.floor(center - padding)),
        Math.min(100, Math.ceil(center + padding))
      ];
    }

    // Otherwise, add 10% padding to top and bottom
    const padding = range * 0.1;
    return [
      Math.max(0, Math.floor(min - padding)),
      Math.min(100, Math.ceil(max + padding))
    ];
  }, [chartData]);

  // Animate paths on mount and when data changes
  useEffect(() => {
    if (!svgRef.current || chartData.length === 0) return;

    // Reset animation flag when data changes
    hasAnimatedRef.current = false;

    let cleanupTimer: NodeJS.Timeout | null = null;

    // Wait for paths to render, then animate
    const timer = setTimeout(() => {
      if (!svgRef.current || hasAnimatedRef.current) return;

      // Find all path elements in the SVG
      const paths = svgRef.current.querySelectorAll('path[stroke]:not([fill])');

      paths.forEach((pathEl: Element) => {
        const svgPath = pathEl as SVGPathElement;
        try {
          const pathLength = svgPath.getTotalLength();
          if (pathLength > 0) {
            // Set initial state
            svgPath.style.strokeDasharray = `${pathLength}`;
            svgPath.style.strokeDashoffset = `${pathLength}`;

            // Trigger animation on next frame
            requestAnimationFrame(() => {
              svgPath.style.transition = 'stroke-dashoffset 1.2s ease-out';
              svgPath.style.strokeDashoffset = '0';
            });
          }
        } catch (e) {
          // getTotalLength might fail on some elements, skip them
        }
      });

      hasAnimatedRef.current = true;

      // Clean up after animation completes
      cleanupTimer = setTimeout(() => {
        paths.forEach((pathEl: Element) => {
          const svgPath = pathEl as SVGPathElement;
          svgPath.style.strokeDasharray = 'none';
          svgPath.style.strokeDashoffset = '0';
          svgPath.style.transition = '';
        });
      }, 1500);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
    };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-foreground/60">
        <p>No historical network health data available</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      <ParentSize>
        {({ width: parentWidth = 800 }) => {
          const width = parentWidth;
          const xMax = width - margin.left - margin.right;
          const yMax = height - margin.top - margin.bottom;

          const xScale = scaleTime<number>({
            range: [0, xMax],
            domain: [
              Math.min(...chartData.map(d => d.timestamp)),
              Math.max(...chartData.map(d => d.timestamp))
            ],
          });

          const yScale = scaleLinear<number>({
            range: [yMax, 0],
            domain: yDomain,
            nice: true,
          });

          const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
            const coords = localPoint(event);
            if (!coords) return;

            const x = coords.x - margin.left;
            
            let closestIndex = 0;
            let minDistance = Infinity;
            chartData.forEach((d, i) => {
              const xPos = xScale(d.timestamp);
              const distance = Math.abs(xPos - x);
              if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
              }
            });
            
            const d = chartData[closestIndex];

            if (d) {
              const xPos = xScale(d.timestamp) + margin.left;
              showTooltip({
                tooltipData: d,
                tooltipLeft: xPos,
                tooltipTop: coords.y,
              });
            }
          };

          return (
            <>
              <svg
                ref={svgRef}
                width={width}
                height={height}
                onMouseMove={handleMouseMove}
                onMouseLeave={hideTooltip}
              >
                <Group transform={`translate(${margin.left},${margin.top})`}>
                  <GridRows
                    scale={yScale}
                    width={xMax}
                    strokeDasharray="3,3"
                    stroke="#333"
                    opacity={0.3}
                  />
                  <GridColumns
                    scale={xScale}
                    height={yMax}
                    strokeDasharray="3,3"
                    stroke="#333"
                    opacity={0.3}
                  />

                  {/* Overall Health Score Line */}
                  <LinePath
                    data={chartData}
                    x={(d) => xScale(d.timestamp)}
                    y={(d) => yScale(d.overall)}
                    stroke="#F0A741"
                    strokeWidth={3}
                    curve={curveMonotoneX}
                  />

                  {tooltipOpen && tooltipData && (
                    <>
                      <line
                        x1={xScale(tooltipData.timestamp)}
                        x2={xScale(tooltipData.timestamp)}
                        y1={0}
                        y2={yMax}
                        stroke="#9CA3AF"
                        strokeWidth={1}
                        strokeDasharray="4,4"
                        opacity={0.5}
                        pointerEvents="none"
                      />
                      <Circle
                        cx={xScale(tooltipData.timestamp)}
                        cy={yScale(tooltipData.overall)}
                        r={5}
                        fill="#F0A741"
                        stroke="#fff"
                        strokeWidth={2}
                        pointerEvents="none"
                      />
                    </>
                  )}

                  <AxisBottom
                    top={yMax}
                    scale={xScale}
                    numTicks={Math.min(6, Math.floor(xMax / 100))}
                    tickFormat={(d) => {
                      const date = d as Date;
                      return formatDateAxis(date, chartData);
                    }}
                    stroke="#6B7280"
                    tickStroke="#6B7280"
                    tickLabelProps={() => ({
                      fill: '#9CA3AF',
                      fontSize: 11,
                      textAnchor: 'middle',
                      angle: 0,
                      dy: 10,
                    })}
                  />
                  <AxisLeft
                    scale={yScale}
                    label="Health Score"
                    labelProps={{
                      fill: '#9CA3AF',
                      fontSize: 11,
                    }}
                    stroke="#6B7280"
                    tickStroke="#6B7280"
                    tickFormat={(d) => `${d}%`}
                    numTicks={5}
                    tickLabelProps={() => ({
                      fill: '#9CA3AF',
                      fontSize: 11,
                      textAnchor: 'end',
                      dx: -5,
                    })}
                  />
                </Group>
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
                    zIndex: 1000,
                  }}
                >
                  <div className="space-y-1">
                    <div className="text-xs text-foreground/60">
                      {timeFormat('%b %d, %H:%M')(new Date(tooltipData.timestamp))}
                    </div>
                    <div className="font-semibold text-foreground">
                      Overall: <span className="text-[#F0A741]">{tooltipData.overall.toFixed(2)}%</span>
                    </div>
                    <div className="text-xs space-y-0.5">
                      <div className="text-[#3F8277]">
                        Availability: {tooltipData.availability.toFixed(2)}%
                      </div>
                      <div className="text-gray-400">
                        Version: {tooltipData.version.toFixed(2)}%
                      </div>
                      <div className="text-[#6366F1]">
                        Distribution: {tooltipData.distribution.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </TooltipWithBounds>
              )}
            </>
          );
        }}
      </ParentSize>
    </div>
  );
}

