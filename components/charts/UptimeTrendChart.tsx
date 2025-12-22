'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { PNode } from '@/lib/types/pnode';
import { scaleTime, scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { AxisBottom, AxisLeft, AxisRight } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { timeFormat } from 'd3-time-format';
import ParentSize from '@visx/responsive/lib/components/ParentSize';

interface UptimeTrendChartProps {
  nodes: PNode[];
  historicalData?: Array<{ timestamp: number; avgUptime: number; onlineCount: number }>;
}

type DataPoint = {
  timestamp: number;
  uptime: number;
  online: number;
};

const formatTime = timeFormat('%b %d, %H:%M');
const formatDate = timeFormat('%b %d');

export default function UptimeTrendChart({ nodes, historicalData }: UptimeTrendChartProps) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<DataPoint>();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Animation refs and state
  const uptimePathGroupRef = useRef<SVGGElement | null>(null);
  const onlinePathGroupRef = useRef<SVGGElement | null>(null);
  const [showCircle, setShowCircle] = useState(false);
  const lastAnimatedKeyRef = useRef<string>('');
  const lastDataKeyRef = useRef<string>('');

  const chartData = useMemo(() => {
    if (historicalData && historicalData.length > 0) {
      return historicalData
        .map((point) => ({
          timestamp: point.timestamp,
          uptime: point.avgUptime || 0, // avgUptime should already be a percentage
          online: point.onlineCount || 0,
        }))
        .filter(point => point.uptime >= 0 && point.uptime <= 100) // Validate data
        .sort((a, b) => a.timestamp - b.timestamp); // Sort by time
    }

    // If no historical data, calculate from current nodes
    if (nodes.length > 0) {
      const nodesWithUptime = nodes.filter(n => n.uptimePercent !== undefined && n.uptimePercent !== null);
      const avgUptime = nodesWithUptime.length > 0
        ? nodesWithUptime.reduce((sum, n) => sum + (n.uptimePercent || 0), 0) / nodesWithUptime.length
        : 0;
      const onlineCount = nodes.filter((n) => n.status === 'online').length;
      
      return [
        {
          timestamp: Date.now(),
          uptime: Math.max(0, Math.min(100, Math.round(avgUptime * 10) / 10)), // Clamp 0-100
          online: onlineCount,
        },
      ];
    }

    return [];
  }, [historicalData, nodes]);

  // Create data key for animation tracking
  const dataKey = useMemo(() => {
    if (chartData.length === 0) return null;
    const first = chartData[0]?.timestamp || 0;
    const last = chartData[chartData.length - 1]?.timestamp || 0;
    return `uptime-${chartData.length}-${first}-${last}`;
  }, [chartData]);

  // Animate when data key changes
  useEffect(() => {
    if (!dataKey) {
      return;
    }

    // If same data key, show immediately
    if (dataKey === lastAnimatedKeyRef.current) {
      setShowCircle(true);
      const uptimeGroup = uptimePathGroupRef.current;
      const onlineGroup = onlinePathGroupRef.current;
      const uptimePath = uptimeGroup?.querySelector('path');
      const onlinePath = onlineGroup?.querySelector('path');

      if (uptimeGroup && uptimePath) {
        uptimeGroup.classList.remove('line-initial-hidden');
        uptimePath.style.strokeDasharray = 'none';
        uptimePath.style.strokeDashoffset = '0';
        uptimePath.style.visibility = 'visible';
        uptimePath.style.willChange = 'auto';
      }

      if (onlineGroup && onlinePath) {
        onlineGroup.classList.remove('line-initial-hidden');
        onlinePath.style.strokeDasharray = 'none';
        onlinePath.style.strokeDashoffset = '0';
        onlinePath.style.visibility = 'visible';
        onlinePath.style.willChange = 'auto';
      }
      return;
    }

    // New data - animate
    lastAnimatedKeyRef.current = dataKey;
    lastDataKeyRef.current = dataKey;
    setShowCircle(false);

    // Use requestAnimationFrame for better performance
    const setupAnimation = () => {
      const uptimeGroup = uptimePathGroupRef.current;
      const onlineGroup = onlinePathGroupRef.current;
      const uptimePath = uptimeGroup?.querySelector('path');
      const onlinePath = onlineGroup?.querySelector('path');

      if ((!uptimeGroup || !uptimePath) && (!onlineGroup || !onlinePath)) {
        // Retry if not ready
        requestAnimationFrame(setupAnimation);
        return;
      }

      // Start animation for available paths
      if (uptimePath && uptimeGroup) {
        startAnimation(uptimeGroup, uptimePath, 'uptime');
      }
      if (onlinePath && onlineGroup) {
        startAnimation(onlineGroup, onlinePath, 'online');
      }
    };

    requestAnimationFrame(setupAnimation);

    function startAnimation(group: SVGGElement, path: SVGPathElement, type: string) {
      // Remove hidden class to show the path
      group.classList.remove('line-initial-hidden');

      // Set initial state for animation
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.visibility = 'visible';
      path.style.willChange = 'stroke-dashoffset';

      // Force reflow to ensure initial state is applied
      path.getBoundingClientRect();

      // Start smooth animation
      path.style.transition = 'stroke-dashoffset 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      path.style.strokeDashoffset = '0';

      // Clean up after animation
      setTimeout(() => {
        if (path) {
          setShowCircle(true);
          path.style.strokeDasharray = 'none';
          path.style.strokeDashoffset = '0';
          path.style.transition = '';
          path.style.willChange = 'auto';
        }
      }, 800);
    }
  }, [dataKey]);

  if (chartData.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-center h-[300px] text-foreground/50">
          <p className="text-sm">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative" style={{ width: '100%', height: 300 }}>
        <ParentSize>
          {({ width: parentWidth = 800 }) => (
            <ChartContent
              width={Math.min(parentWidth - 48, 800)}
              height={300}
              chartData={chartData}
              tooltipData={tooltipData}
              tooltipLeft={tooltipLeft}
              tooltipTop={tooltipTop}
              tooltipOpen={tooltipOpen}
              showTooltip={showTooltip}
              hideTooltip={hideTooltip}
              showCircle={showCircle}
              pathGroupRef={pathGroupRef}
            />
          )}
        </ParentSize>
      </div>
    </div>
  );
}

function ChartContent({
  width,
  height,
  chartData,
  tooltipData,
  tooltipLeft,
  tooltipTop,
  tooltipOpen,
  showTooltip,
  hideTooltip,
  showCircle,
  pathGroupRef,
}: {
  width: number;
  height: number;
  chartData: DataPoint[];
  tooltipData?: DataPoint;
  tooltipLeft?: number;
  tooltipTop?: number;
  tooltipOpen: boolean;
  showTooltip: (args: any) => void;
  hideTooltip: () => void;
  showCircle: boolean;
  pathGroupRef: React.RefObject<SVGGElement>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Animation refs and state
  const pathGroupRef = useRef<SVGGElement | null>(null);
  const [showCircle, setShowCircle] = useState(false);
  const lastAnimatedKeyRef = useRef<string>('');

  // Create data key for animation tracking
  const dataKey = useMemo(() => {
    if (chartData.length === 0) return null;
    const first = chartData[0]?.timestamp || 0;
    const last = chartData[chartData.length - 1]?.timestamp || 0;
    return `uptime-${chartData.length}-${first}-${last}`;
  }, [chartData]);

  // Animate when data key changes
  useEffect(() => {
    if (!dataKey) {
      return;
    }

    // If same data key, show immediately
    if (dataKey === lastAnimatedKeyRef.current) {
      setShowCircle(true);
      const path = pathGroupRef.current?.querySelector('path');
      if (path) {
        path.style.strokeDasharray = 'none';
        path.style.strokeDashoffset = '0';
        path.style.visibility = 'visible';
        path.style.willChange = 'auto';
      }
      return;
    }

    // New data - animate
    lastAnimatedKeyRef.current = dataKey;
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

  // Responsive margins - smaller on mobile for better chart size
  const isMobile = width < 640;
  const margin = { 
    top: 20, 
    right: isMobile ? 20 : 80, 
    left: isMobile ? 40 : 60, 
    bottom: 40 
  };
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  const xScale = useMemo(
    () =>
      scaleTime<number>({
        range: [0, xMax],
        domain: chartData.length > 0
          ? [Math.min(...chartData.map((d) => d.timestamp)), Math.max(...chartData.map((d) => d.timestamp))]
          : [Date.now() - 3600000, Date.now()],
      }),
    [chartData, xMax]
  );

  // Calculate dynamic Y-axis domain for uptime (better zoom)
  const uptimeDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];

    const values = chartData.map(d => d.uptime);
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

  const yScaleUptime = useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, 0],
        domain: uptimeDomain,
        nice: true,
      }),
    [yMax, uptimeDomain]
  );

  const yScaleOnline = useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, 0],
        domain: chartData.length > 0
          ? [0, Math.max(...chartData.map((d) => d.online)) + 5]
          : [0, 10],
        nice: true,
      }),
    [yMax, chartData]
  );

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const coords = localPoint(event);
    if (!coords) return;

    const x = coords.x - margin.left;
    const x0 = xScale.invert(x);
    const x0Time = x0 instanceof Date ? x0.getTime() : Number(x0);

    // Find closest data point
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
      showTooltip({
        tooltipData: d,
        tooltipLeft: coords.x,
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
      <svg ref={svgRef} width={width} height={height} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <defs>
          {/* Animation styles */}
          <style>{`
            .line-initial-hidden path {
              visibility: hidden;
            }
          `}</style>
        </defs>
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        <g transform={`translate(${margin.left},${margin.top})`}>
          <GridRows
            scale={yScaleUptime}
            width={xMax}
            strokeDasharray="3,3"
            stroke="#F0A741"
            opacity={0.15}
          />
          <GridColumns
            scale={xScale}
            height={yMax}
            strokeDasharray="3,3"
            stroke="#F0A741"
            opacity={0.15}
          />

          {/* Highlighted lines - show if we have data, even if loading new data */}
          {highlightedData.length > 0 && (
            <g ref={pathGroupRef} key={`lines-${dataKey || 'loading'}`} className="line-initial-hidden">
          <LinePath
                data={highlightedData}
            x={(d) => xScale(d.timestamp)}
            y={(d) => yScaleUptime(d.uptime)}
            stroke="#F0A741"
            strokeWidth={2.5}
                strokeOpacity={1}
                curve={curveMonotoneX}
              />
              <LinePath
                data={highlightedData}
                x={(d) => xScale(d.timestamp)}
                y={(d) => yScaleOnline(d.online)}
                stroke="#3F8277"
                strokeWidth={2.5}
                strokeOpacity={1}
            curve={curveMonotoneX}
          />
            </g>
          )}

          {/* Dimmed lines (when hovering) - render AFTER highlighted lines so they appear on top but dimmed */}
          {hoveredIndex !== null && dimmedData.length > 0 && (
            <>
              <LinePath
                data={dimmedData}
                x={(d) => xScale(d.timestamp)}
                y={(d) => yScaleUptime(d.uptime)}
                stroke="#F0A741"
                strokeWidth={2.5}
                strokeOpacity={0.25}
                curve={curveMonotoneX}
              />
          <LinePath
                data={dimmedData}
            x={(d) => xScale(d.timestamp)}
            y={(d) => yScaleOnline(d.online)}
            stroke="#3F8277"
            strokeWidth={2.5}
                strokeOpacity={0.25}
            curve={curveMonotoneX}
          />
            </>
          )}

          <AxisBottom
            top={yMax}
            scale={xScale}
            numTicks={chartData.length > 1 ? Math.min(6, chartData.length) : 1}
            tickFormat={(d) => {
              const date = d as Date;
              // If data spans multiple days, show date; otherwise show time
              const timeSpan = chartData.length > 0 
                ? Math.max(...chartData.map(d => d.timestamp)) - Math.min(...chartData.map(d => d.timestamp))
                : 0;
              return timeSpan > 86400000 ? formatDate(date) : formatTime(date);
            }}
            stroke="#F0A741"
            tickStroke="#F0A741"
            tickLabelProps={() => ({
              fill: '#ffffff',
              fontSize: 11,
              textAnchor: 'middle',
            })}
          />
          <AxisLeft
            scale={yScaleUptime}
            label="Uptime (%)"
            labelProps={{
              fill: '#ffffff',
              fontSize: 11,
            }}
            stroke="#F0A741"
            tickStroke="#F0A741"
            tickLabelProps={() => ({
              fill: '#ffffff',
              fontSize: 11,
              textAnchor: 'end',
              dx: -5,
            })}
          />
          <AxisRight
            left={xMax}
            scale={yScaleOnline}
            label="Online Nodes"
            labelProps={{
              fill: '#ffffff',
              fontSize: 11,
            }}
            stroke="#F0A741"
            tickStroke="#F0A741"
            tickLabelProps={() => ({
              fill: '#ffffff',
              fontSize: 11,
              textAnchor: 'start',
              dx: 5,
            })}
          />

          {tooltipOpen && tooltipData && (
            <g>
              <line
                x1={xScale(tooltipData.timestamp)}
                x2={xScale(tooltipData.timestamp)}
                y1={0}
                y2={yMax}
                stroke="#F0A741"
                strokeWidth={1}
                strokeDasharray="2,2"
                opacity={0.5}
              />
              {showCircle && (
                <>
              <circle
                cx={xScale(tooltipData.timestamp)}
                cy={yScaleUptime(tooltipData.uptime)}
                r={5}
                fill="#F0A741"
                stroke="#000"
                strokeWidth={2}
              />
                cx={xScale(tooltipData.timestamp)}
                cy={yScaleOnline(tooltipData.online)}
                r={5}
                fill="#3F8277"
                stroke="#000"
                strokeWidth={2}
              />
                </>
              )}
            </g>
          )}
        </g>
      </svg>

      <div className="absolute top-2 right-4 flex gap-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-[#F0A741]"></div>
          <span className="text-xs text-foreground/80">Avg Uptime (%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-[#3F8277]"></div>
          <span className="text-xs text-foreground/80">Online Nodes</span>
        </div>
      </div>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            border: '1px solid #F0A741',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#ffffff',
          }}
        >
          <div className="text-xs">
            <div className="font-semibold text-foreground mb-2">
              {new Date(tooltipData.timestamp).toLocaleString()}
            </div>
            <div className="space-y-1">
              <div className="text-foreground/90">
                <span className="text-[#F0A741]">Uptime:</span> <span className="font-mono font-semibold">{tooltipData.uptime.toFixed(1)}%</span>
              </div>
              <div className="text-foreground/90">
                <span className="text-[#3F8277]">Online:</span> <span className="font-mono font-semibold">{tooltipData.online} nodes</span>
              </div>
            </div>
          </div>
        </TooltipWithBounds>
      )}
    </>
  );
}
