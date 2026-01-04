'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { scaleTime, scaleLinear } from '@visx/scale';
import { LinePath, AreaClosed } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { timeFormat } from 'd3-time-format';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import { LinearGradient } from '@visx/gradient';

interface NodeHistoryPoint {
    timestamp: number;
    status: 'online' | 'offline' | 'syncing';
    cpuPercent?: number;
    ramPercent?: number;
    uptimePercent?: number;
}

interface NodeHistoryChartProps {
    history: NodeHistoryPoint[];
    metric: 'cpu' | 'ram' | 'uptime';
    color?: string;
    height?: number;
}

const formatTime = timeFormat('%b %d, %H:%M');
const formatDate = timeFormat('%b %d');

export default function NodeHistoryChart({
    history,
    metric,
    color = '#F0A741',
    height = 200
}: NodeHistoryChartProps) {
    const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<NodeHistoryPoint>();

    const chartData = useMemo(() => {
        return [...history].sort((a, b) => a.timestamp - b.timestamp);
    }, [history]);

    if (chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-foreground/30 border border-border/20 rounded-xl bg-background/20" style={{ height }}>
                <p className="text-xs">No historical data available</p>
            </div>
        );
    }

    return (
        <div className="relative w-full" style={{ height }}>
            <ParentSize>
                {({ width, height: pHeight }) => (
                    <ChartContent
                        width={width}
                        height={pHeight}
                        chartData={chartData}
                        metric={metric}
                        color={color}
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
    );
}

function ChartContent({
    width,
    height,
    chartData,
    metric,
    color,
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
}: {
    width: number;
    height: number;
    chartData: NodeHistoryPoint[];
    metric: 'cpu' | 'ram' | 'uptime';
    color: string;
    tooltipData?: NodeHistoryPoint;
    tooltipLeft?: number;
    tooltipTop?: number;
    tooltipOpen: boolean;
    showTooltip: (args: { tooltipData: NodeHistoryPoint; tooltipLeft: number; tooltipTop: number }) => void;
    hideTooltip: () => void;
}) {
    const isMobile = width < 640;
    const margin = {
        top: 10,
        right: 10,
        left: isMobile ? 30 : 40,
        bottom: isMobile ? 20 : 30
    };
    const xMax = width - margin.left - margin.right;
    const yMax = height - margin.top - margin.bottom;

    const xScale = useMemo(
        () =>
            scaleTime<number>({
                range: [0, xMax],
                domain: [Math.min(...chartData.map((d) => d.timestamp)), Math.max(...chartData.map((d) => d.timestamp))],
            }),
        [chartData, xMax]
    );

    const yScale = useMemo(
        () =>
            scaleLinear<number>({
                range: [yMax, 0],
                domain: [0, 100],
                nice: true,
            }),
        [yMax]
    );

    const getMetricValue = (d: NodeHistoryPoint) => {
        if (metric === 'cpu') return d.cpuPercent ?? 0;
        if (metric === 'ram') return d.ramPercent ?? 0;
        if (metric === 'uptime') return d.uptimePercent ?? 0;
        return 0;
    };

    const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        const coords = localPoint(event);
        if (!coords) return;
        const x = coords.x - margin.left;

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
            showTooltip({
                tooltipData: d,
                tooltipLeft: xScale(d.timestamp) + margin.left,
                tooltipTop: yScale(getMetricValue(d)) + margin.top,
            });
        }
    };

    return (
        <div className="relative">
            <svg width={width} height={height} onMouseMove={handleMouseMove} onMouseLeave={hideTooltip}>
                <LinearGradient id="gradient" from={color} fromOpacity={0.4} to={color} toOpacity={0} />
                <g transform={`translate(${margin.left},${margin.top})`}>
                    <GridRows scale={yScale} width={xMax} stroke="white" strokeOpacity={0.05} />
                    <GridColumns scale={xScale} height={yMax} stroke="white" strokeOpacity={0.05} />

                    <AreaClosed<NodeHistoryPoint>
                        data={chartData}
                        x={(d) => xScale(d.timestamp)}
                        y={(d) => yScale(getMetricValue(d))}
                        yScale={yScale}
                        strokeWidth={2}
                        stroke={color}
                        fill="url(#gradient)"
                        curve={curveMonotoneX}
                    />

                    <AxisBottom
                        top={yMax}
                        scale={xScale}
                        numTicks={width < 400 ? 3 : 6}
                        tickFormat={(d) => {
                            const date = d as Date;
                            const timeSpan = Math.max(...chartData.map(d => d.timestamp)) - Math.min(...chartData.map(d => d.timestamp));
                            return timeSpan > 86400000 ? formatDate(date) : formatTime(date);
                        }}
                        stroke="transparent"
                        tickStroke="rgba(255,255,255,0.2)"
                        tickLabelProps={() => ({
                            fill: 'rgba(255,255,255,0.4)',
                            fontSize: 9,
                            textAnchor: 'middle',
                        })}
                    />

                    <AxisLeft
                        scale={yScale}
                        numTicks={4}
                        stroke="transparent"
                        tickStroke="rgba(255,255,255,0.2)"
                        tickLabelProps={() => ({
                            fill: 'rgba(255,255,255,0.4)',
                            fontSize: 9,
                            textAnchor: 'end',
                            dx: -4,
                            dy: 3,
                        })}
                    />

                    {tooltipOpen && tooltipData && (
                        <g>
                            <line
                                x1={xScale(tooltipData.timestamp)}
                                x2={xScale(tooltipData.timestamp)}
                                y1={0}
                                y2={yMax}
                                stroke={color}
                                strokeWidth={1}
                                strokeDasharray="2,2"
                                opacity={0.5}
                            />
                            <circle
                                cx={xScale(tooltipData.timestamp)}
                                cy={yScale(getMetricValue(tooltipData))}
                                r={4}
                                fill={color}
                                stroke="#000"
                                strokeWidth={2}
                            />
                        </g>
                    )}
                </g>
            </svg>

            {tooltipOpen && tooltipData && (
                <TooltipWithBounds
                    top={tooltipTop}
                    left={tooltipLeft}
                    style={{
                        ...defaultStyles,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        border: `1px solid ${color}`,
                        borderRadius: 'var(--radius)',
                        padding: '6px 10px',
                        color: '#fff',
                        fontSize: '11px',
                        zIndex: 100,
                    }}
                >
                    <div className="font-bold mb-1 opacity-60">
                        {new Date(tooltipData.timestamp).toLocaleString()}
                    </div>
                    <div>
                        <span style={{ color }}>{metric.toUpperCase()}:</span> {getMetricValue(tooltipData).toFixed(1)}%
                    </div>
                    <div className="mt-1">
                        <span className="opacity-60">Status:</span> {tooltipData.status}
                    </div>
                </TooltipWithBounds>
            )}
        </div>
    );
}
