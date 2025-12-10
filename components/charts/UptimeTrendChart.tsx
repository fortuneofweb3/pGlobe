'use client';

import { useMemo } from 'react';
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
}) {
  const margin = { top: 20, right: 80, bottom: 40, left: 60 };
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

  const yScaleUptime = useMemo(
    () =>
      scaleLinear<number>({
        range: [yMax, 0],
        domain: [0, 100],
        nice: true,
      }),
    [yMax]
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
    const index = chartData.findIndex((d) => d.timestamp >= x0.getTime());
    const d = chartData[index] || chartData[chartData.length - 1];

    if (d) {
      showTooltip({
        tooltipData: d,
        tooltipLeft: coords.x,
        tooltipTop: coords.y,
      });
    }
  };

  return (
    <>
      <svg width={width} height={height} onMouseMove={handleMouseMove} onMouseLeave={hideTooltip}>
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

          <LinePath
            data={chartData}
            x={(d) => xScale(d.timestamp)}
            y={(d) => yScaleUptime(d.uptime)}
            stroke="#F0A741"
            strokeWidth={2.5}
            curve={curveMonotoneX}
          />

          <LinePath
            data={chartData}
            x={(d) => xScale(d.timestamp)}
            y={(d) => yScaleOnline(d.online)}
            stroke="#3F8277"
            strokeWidth={2.5}
            curve={curveMonotoneX}
          />

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
              <circle
                cx={xScale(tooltipData.timestamp)}
                cy={yScaleUptime(tooltipData.uptime)}
                r={5}
                fill="#F0A741"
                stroke="#000"
                strokeWidth={2}
              />
              <circle
                cx={xScale(tooltipData.timestamp)}
                cy={yScaleOnline(tooltipData.online)}
                r={5}
                fill="#3F8277"
                stroke="#000"
                strokeWidth={2}
              />
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
