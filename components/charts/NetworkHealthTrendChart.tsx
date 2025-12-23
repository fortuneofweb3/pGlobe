'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
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
  headerContent?: React.ReactNode;
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
  height = 300,
  headerContent
}: NetworkHealthTrendChartProps) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<any>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Animation refs and state
  const pathGroupRef = useRef<SVGGElement | null>(null);
  const [showCircle, setShowCircle] = useState(false);
  const lastAnimatedKeyRef = useRef<string>('');
  const lastDataKeyRef = useRef<string>('');

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

  // Create data key for animation tracking
  const dataKey = useMemo(() => {
    if (chartData.length === 0) return null;
    const first = chartData[0]?.timestamp || 0;
    const last = chartData[chartData.length - 1]?.timestamp || 0;
    return `health-${chartData.length}-${first}-${last}`;
  }, [chartData]);

  // Animate when data key changes
  useEffect(() => {
    if (!dataKey) {
      return;
    }

    // If same data key, show immediately
    if (dataKey === lastAnimatedKeyRef.current) {
      setShowCircle(true);
      const group = pathGroupRef.current;
      const path = group?.querySelector('path');
      if (group && path) {
        group.classList.remove('line-initial-hidden');
        path.style.strokeDasharray = 'none';
        path.style.strokeDashoffset = '0';
        path.style.visibility = 'visible';
        path.style.willChange = 'auto';
      }
      return;
    }

    // New data - animate
    lastAnimatedKeyRef.current = dataKey;
    lastDataKeyRef.current = dataKey;
    setShowCircle(false);

    // Use requestAnimationFrame for better performance
    const setupAnimation = () => {
      const group = pathGroupRef.current;
      const path = group?.querySelector('path');
      if (!group || !path) {
        // Retry once if not ready
        requestAnimationFrame(setupAnimation);
        return;
      }

      const length = path.getTotalLength();
      if (length === 0) {
        // Path not ready, retry once more
            requestAnimationFrame(() => {
          const retryPath = pathGroupRef.current?.querySelector('path');
          if (retryPath) {
            const retryLength = retryPath.getTotalLength();
            if (retryLength > 0) {
              startAnimation(group, retryPath, retryLength);
            } else {
              // Still not ready, show without animation
              setShowCircle(true);
              retryPath.style.strokeDasharray = 'none';
              retryPath.style.strokeDashoffset = '0';
              retryPath.style.visibility = 'visible';
            }
          }
        });
        return;
      }

      startAnimation(group, path, length);
    };

    requestAnimationFrame(setupAnimation);

    function startAnimation(group: SVGGElement, path: SVGPathElement, length: number) {
      group.classList.remove('line-initial-hidden');

      // Set initial state
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.visibility = 'visible';
      path.style.willChange = 'stroke-dashoffset';
      path.style.transition = 'none';

      // Start animation with optimized timing (0.6s for snappier feel)
      const animationDuration = 600; // 0.6 seconds

      // Use requestAnimationFrame to ensure initial state is painted before animation
      requestAnimationFrame(() => {
        path.style.transition = `stroke-dashoffset ${animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        path.style.strokeDashoffset = '0';

        // Show circle exactly when animation completes
        setTimeout(() => {
          setShowCircle(true);
          path.style.strokeDasharray = 'none';
          path.style.strokeDashoffset = '0';
          path.style.transition = '';
          path.style.willChange = 'auto';
        }, animationDuration);
      });
    }
  }, [dataKey]);

  // Default time domain (last 7 days) when no data
  const defaultTimeDomain = useMemo(() => {
    const now = Date.now();
    return [now - (7 * 24 * 60 * 60 * 1000), now];
  }, []);

  return (
    <div className="space-y-3">
      {headerContent && (
        <div className="flex items-center justify-end">
          {headerContent}
        </div>
      )}
    <div style={{ width: '100%', height, position: 'relative' }}>
      <ParentSize>
        {({ width: parentWidth = 800 }) => {
          const width = parentWidth;
          // Responsive margins - smaller on mobile for better chart size
          const isMobile = width < 640;
          const margin = { 
            top: 30, 
            right: isMobile ? 10 : 30, 
            left: isMobile ? 40 : 60, 
            bottom: isMobile ? 50 : 70 
          };
          const xMax = width - margin.left - margin.right;
          const yMax = height - margin.top - margin.bottom;

          const xScale = scaleTime<number>({
            range: [0, xMax],
            domain: chartData.length > 0
              ? [
              Math.min(...chartData.map(d => d.timestamp)),
              Math.max(...chartData.map(d => d.timestamp))
                ]
              : defaultTimeDomain,
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
              setHoveredIndex(closestIndex);
              const xPos = xScale(d.timestamp) + margin.left;
              showTooltip({
                tooltipData: d,
                tooltipLeft: xPos,
                tooltipTop: coords.y,
              });
            }
          };

          const handleMouseLeave = () => {
            setHoveredIndex(null);
            hideTooltip();
          };

          // Split data for hover effect
          const highlightedData = useMemo(() => {
            if (hoveredIndex === null || chartData.length === 0) {
              return chartData;
            }
            return chartData.slice(0, hoveredIndex + 1);
          }, [chartData, hoveredIndex]);

          const dimmedData = useMemo(() => {
            if (hoveredIndex === null || chartData.length === 0) {
              return [];
            }
            return chartData.slice(hoveredIndex);
          }, [chartData, hoveredIndex]);

          return (
            <>
              <svg
                ref={svgRef}
                width={width}
                height={height}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>
                  {/* Animation styles */}
                  <style>{`
                    .line-initial-hidden path {
                      visibility: hidden;
                    }
                  `}</style>
                </defs>
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

                  {/* Highlighted line - show if we have data, even if loading new data */}
                  {highlightedData.length > 0 && (
                    <g ref={pathGroupRef} key={`line-${dataKey || 'loading'}`} className="line-initial-hidden">
                      <LinePath
                        data={highlightedData}
                        x={(d) => xScale(d.timestamp)}
                        y={(d) => yScale(d.overall)}
                        stroke="#F0A741"
                        strokeWidth={3}
                        strokeOpacity={1}
                        curve={curveMonotoneX}
                      />
                    </g>
                  )}

                  {/* Dimmed line (when hovering) - render AFTER highlighted line so it appears on top but dimmed */}
                  {hoveredIndex !== null && dimmedData.length > 0 && (
                  <LinePath
                      data={dimmedData}
                    x={(d) => xScale(d.timestamp)}
                    y={(d) => yScale(d.overall)}
                    stroke="#F0A741"
                    strokeWidth={3}
                      strokeOpacity={0.25}
                    curve={curveMonotoneX}
                  />
                  )}

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
                      {showCircle && (
                      <Circle
                        cx={xScale(tooltipData.timestamp)}
                        cy={yScale(tooltipData.overall)}
                        r={5}
                        fill="#F0A741"
                        stroke="#fff"
                        strokeWidth={2}
                        pointerEvents="none"
                      />
                      )}
                    </>
                  )}

                  <AxisBottom
                    top={yMax}
                    scale={xScale}
                    numTicks={Math.min(6, Math.floor(xMax / 100))}
                    tickFormat={(d) => {
                      const date = d as Date;
                      if (chartData.length === 0) {
                        // Default formatting when no data
                        const timeSpan = defaultTimeDomain[1] - defaultTimeDomain[0];
                        const isSameDay = timeSpan < 86400000;
                        return isSameDay ? formatTime(date) : formatDate(date);
                      }
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
    </div>
  );
}

