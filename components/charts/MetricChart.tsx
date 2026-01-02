'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { scaleTime, scaleLinear } from '@visx/scale';
import { LinePath, Circle } from '@visx/shape';
import { Group } from '@visx/group';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { timeFormat } from 'd3-time-format';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
// HistoricalDataPoint definition
export interface HistoricalDataPoint {
    timestamp: number;
    status?: 'online' | 'offline' | 'syncing';
    cpuPercent?: number;
    ramPercent?: number;
    packetsReceived?: number;
    packetsSent?: number;
    activeStreams?: number;
    uptime?: number;
    uptimePercent?: number;
    credits?: number;
    [key: string]: any;
}

// Helper functions for formatting
const formatNumber = (value: number): string => {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
};

const getMinMax = (data: any[], key: string) => {
    if (!data || data.length === 0) return { min: 0, max: 0 };
    return data.reduce((acc, curr) => ({
        min: Math.min(acc.min, curr[key]),
        max: Math.max(acc.max, curr[key])
    }), { min: Infinity, max: -Infinity });
};

const formatDateAxis = (date: Date, chartData: Array<{ timestamp: number }>): string => {
    if (chartData.length === 0) return '';

    const { min, max } = getMinMax(chartData, 'timestamp');
    const timeSpan = max - min;
    const isShortSpan = timeSpan <= 86400000; // Less than or equal to 24 hours

    if (isShortSpan) {
        return timeFormat('%H:%M')(date);
    } else {
        return timeFormat('%b %d')(date);
    }
};

export interface MetricChartProps {
    title: string;
    data: Array<{ timestamp: number; value?: number; label?: string;[key: string]: any }>;
    height: number;
    yDomain: [number, number];
    strokeColor: string;
    yTickFormatter?: (value: number) => string;
    tooltipFormatter: (d: any) => React.ReactNode;
    headerContent?: React.ReactNode;
    yLabel?: string;
    multiLine?: Array<{ key: string; color: string; label: string }>;
    yTicks?: number[];
    fillArea?: boolean;
    hideHeader?: boolean;
    minimal?: boolean;
}

export default function MetricChart({
    title,
    data,
    height,
    yDomain,
    strokeColor,
    yTickFormatter,
    tooltipFormatter,
    headerContent,
    yLabel,
    multiLine,
    yTicks,
    hideHeader,
    minimal,
}: MetricChartProps) {
    const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<any>();
    const svgRef = useRef<SVGSVGElement>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Animation refs and state
    const pathGroupRef = useRef<SVGGElement | null>(null);
    const [showCircle, setShowCircle] = useState(false);
    const lastAnimatedKeyRef = useRef<string>('');
    const lastDataKeyRef = useRef<string>('');

    const chartData = useMemo(() => {
        if (data.length === 0) return [];

        const sorted = data.sort((a, b) => a.timestamp - b.timestamp);
        if (sorted.length < 2) return sorted;

        const interpolated: typeof data = [];
        const interval = 10 * 60 * 1000; // 10 minutes interpolation logic captured from original

        for (let i = 0; i < sorted.length; i++) {
            interpolated.push(sorted[i]);

            if (i < sorted.length - 1) {
                const current = sorted[i];
                const next = sorted[i + 1];
                const gap = next.timestamp - current.timestamp;

                if (gap > interval * 1.5) {
                    const numPoints = Math.floor(gap / interval) - 1;

                    for (let j = 1; j <= numPoints; j++) {
                        const interpolatedTimestamp = current.timestamp + (gap * j / (numPoints + 1));
                        const ratio = j / (numPoints + 1);

                        const interpolatedPoint: typeof data[0] = {
                            timestamp: interpolatedTimestamp,
                        };

                        if (current.value !== undefined && current.value !== null &&
                            next.value !== undefined && next.value !== null &&
                            !isNaN(current.value) && !isNaN(next.value)) {
                            interpolatedPoint.value = current.value + (next.value - current.value) * ratio;
                        } else if (current.value !== undefined && current.value !== null && !isNaN(current.value)) {
                            interpolatedPoint.value = current.value;
                        } else if (next.value !== undefined && next.value !== null && !isNaN(next.value)) {
                            interpolatedPoint.value = next.value;
                        }

                        if (multiLine) {
                            multiLine.forEach(line => {
                                const currentVal = current[line.key];
                                const nextVal = next[line.key];

                                if (currentVal !== undefined && currentVal !== null &&
                                    nextVal !== undefined && nextVal !== null &&
                                    !isNaN(currentVal) && !isNaN(nextVal)) {
                                    interpolatedPoint[line.key] = currentVal + (nextVal - currentVal) * ratio;
                                }
                                else if (currentVal !== undefined && currentVal !== null && !isNaN(currentVal)) {
                                    interpolatedPoint[line.key] = currentVal;
                                }
                                else if (nextVal !== undefined && nextVal !== null && !isNaN(nextVal)) {
                                    interpolatedPoint[line.key] = nextVal;
                                }
                            });
                        }

                        if (current.label) {
                            interpolatedPoint.label = current.label;
                        }

                        interpolated.push(interpolatedPoint);
                    }
                }
            }
        }

        return interpolated.sort((a, b) => a.timestamp - b.timestamp);
    }, [data, multiLine]);

    // Create data key for animation tracking
    const dataKey = useMemo(() => {
        if (chartData.length === 0) return null;
        const first = chartData[0]?.timestamp || 0;
        const last = chartData[chartData.length - 1]?.timestamp || 0;
        const strokeKey = multiLine ? multiLine.map(l => l.key).join('-') : 'single';
        return `${title}-${strokeKey}-${chartData.length}-${first}-${last}`;
    }, [chartData, title, multiLine]);

    // Animate when data key changes
    useEffect(() => {
        if (!dataKey) {
            return;
        }

        // If same data key, show immediately
        if (dataKey === lastAnimatedKeyRef.current) {
            setShowCircle(true);
            const group = pathGroupRef.current;
            const paths = group?.querySelectorAll('path');
            if (group && paths) {
                group.classList.remove('line-initial-hidden');
                paths.forEach(path => {
                    path.style.strokeDasharray = 'none';
                    path.style.strokeDashoffset = '0';
                    path.style.visibility = 'visible';
                    path.style.willChange = 'auto';
                });
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
            const paths = group?.querySelectorAll('path');
            if (!group || !paths || paths.length === 0) {
                // Retry if not ready
                requestAnimationFrame(setupAnimation);
                return;
            }

            let allPathsReady = true;
            paths.forEach(path => {
                try {
                    path.getTotalLength();
                } catch (e) {
                    allPathsReady = false;
                }
            });

            if (!allPathsReady) {
                requestAnimationFrame(() => {
                    const retryPaths = pathGroupRef.current?.querySelectorAll('path');
                    if (retryPaths) {
                        let retryReady = true;
                        retryPaths.forEach(path => {
                            try {
                                const length = path.getTotalLength();
                                if (length === 0) retryReady = false;
                            } catch (e) {
                                retryReady = false;
                            }
                        });
                        if (retryReady) {
                            // Start animation for each path individually
                            retryPaths.forEach(path => {
                                const svgPath = path as SVGPathElement;
                                const length = svgPath.getTotalLength();
                                if (length > 0 && pathGroupRef.current) {
                                    startAnimation(pathGroupRef.current, svgPath, length);
                                }
                            });
                        } else {
                            // Still not ready, show without animation
                            setShowCircle(true);
                            retryPaths.forEach(path => {
                                path.style.visibility = 'visible';
                            });
                        }
                    }
                });
                return;
            }

            // Start animation for each path individually
            paths.forEach(path => {
                const svgPath = path as SVGPathElement;
                const length = svgPath.getTotalLength();
                if (length > 0 && pathGroupRef.current) {
                    startAnimation(pathGroupRef.current, svgPath, length);
                }
            });
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

    const smartYFormatter = useMemo(() => {
        if (yTickFormatter) {
            return (d: any) => yTickFormatter(typeof d === 'number' ? d : d.valueOf());
        }

        const maxValue = Math.max(...yDomain);
        if (maxValue >= 1000) {
            return (d: any) => formatNumber(typeof d === 'number' ? d : d.valueOf());
        }
        return (d: any) => {
            const val = typeof d === 'number' ? d : d.valueOf();
            return val.toFixed(0);
        };
    }, [yDomain, yTickFormatter]);

    // Calculate dynamic Y-axis domain with smart zoom for nearly flat lines
    const dynamicYDomain = useMemo(() => {
        // Skip dynamic zoom for status charts (discrete values) and if custom ticks are provided
        if (yTicks) return yDomain;

        const [minDomain, maxDomain] = yDomain;

        // Only apply dynamic zoom for percentage-based charts (0-100)
        if (minDomain === 0 && maxDomain === 100) {
            const values: number[] = [];

            if (multiLine) {
                // Collect all values from all lines
                multiLine.forEach(line => {
                    chartData.forEach(d => {
                        const val = d[line.key];
                        if (val !== undefined && val !== null && !isNaN(val)) {
                            values.push(val);
                        }
                    });
                });
            } else {
                // Collect values from single line
                chartData.forEach(d => {
                    if (d.value !== undefined && d.value !== null && !isNaN(d.value)) {
                        values.push(d.value);
                    }
                });
            }

            if (values.length === 0) return yDomain;

            const min = Math.min(...values); // values is likely small enough, but for safety in future could use reduce if needed. This specific one is fine as it comes from yDomain zoom logic which is usually not huge, but wait - values comes from chartData loop.
            // Actually 'values' could be large if chartData is large. Safer to fix this too.
            const minVal = values.reduce((m, v) => Math.min(m, v), Infinity);
            const maxVal = values.reduce((m, v) => Math.max(m, v), -Infinity);
            const range = maxVal - minVal;

            // If the range is very small (nearly flat line), zoom in
            if (range < 10) {
                const center = (minVal + maxVal) / 2;
                const padding = Math.max(5, range * 0.5); // At least 5% padding, or 50% of range
                return [
                    Math.max(0, Math.floor(center - padding)),
                    Math.min(100, Math.ceil(center + padding))
                ];
            }

            // Otherwise, add 10% padding to top and bottom
            const padding = range * 0.1;
            return [
                Math.max(0, Math.floor(minVal - padding)),
                Math.min(100, Math.ceil(maxVal + padding))
            ];
        }

        // For non-percentage charts, use the original domain
        return yDomain;
    }, [yDomain, chartData, multiLine, yTicks]);

    const content = (
        <ParentSize>
            {({ width: parentWidth = 800 }) => {
                const width = parentWidth;
                // Responsive margins - smaller on mobile for better chart size
                const isMobile = width < 640;
                const margin = {
                    top: minimal ? 10 : 30,
                    right: isMobile ? 10 : 30,
                    left: isMobile ? 50 : 70,
                    bottom: isMobile ? 50 : 70
                };
                const xMax = width - margin.left - margin.right;
                const yMax = height - margin.top - margin.bottom;

                const domainStats = getMinMax(chartData, 'timestamp');
                const initialXDomain = chartData.length > 0
                    ? [domainStats.min, domainStats.max]
                    : [Date.now() - 3600000, Date.now()];

                const xScale = scaleTime<number>({
                    range: [0, xMax],
                    domain: initialXDomain,
                });

                const yScale = scaleLinear<number>({
                    range: [yMax, 0],
                    domain: dynamicYDomain,
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
                        <svg
                            ref={svgRef}
                            width={width}
                            height={height}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                        >
                            <defs>
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

                                {multiLine ? (
                                    <g ref={pathGroupRef} key={`multi-${dataKey || 'loading'}`} className="line-initial-hidden">
                                        {multiLine.map((line) => {
                                            const validHighlightedData = highlightedData.filter(d => {
                                                const val = d[line.key];
                                                return val !== undefined && val !== null && !isNaN(val);
                                            });
                                            const validDimmedData = dimmedData.filter(d => {
                                                const val = d[line.key];
                                                return val !== undefined && val !== null && !isNaN(val);
                                            });
                                            return (
                                                <g key={line.key}>
                                                    {/* Highlighted line */}
                                                    {validHighlightedData.length > 0 && (
                                                        <LinePath
                                                            data={validHighlightedData}
                                                            x={(d) => xScale(d.timestamp)}
                                                            y={(d) => yScale(d[line.key] ?? 0)}
                                                            stroke={line.color}
                                                            strokeWidth={3}
                                                            strokeOpacity={1}
                                                            curve={curveMonotoneX}
                                                        />
                                                    )}
                                                    {/* Dimmed line (when hovering) */}
                                                    {hoveredIndex !== null && validDimmedData.length > 0 && (
                                                        <LinePath
                                                            data={validDimmedData}
                                                            x={(d) => xScale(d.timestamp)}
                                                            y={(d) => yScale(d[line.key] ?? 0)}
                                                            stroke={line.color}
                                                            strokeWidth={3}
                                                            strokeOpacity={0.25}
                                                            curve={curveMonotoneX}
                                                        />
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </g>
                                ) : (
                                    (() => {
                                        const validHighlightedData = highlightedData.filter(d => {
                                            const val = d.value;
                                            return val !== undefined && val !== null && !isNaN(val);
                                        });
                                        const validDimmedData = dimmedData.filter(d => {
                                            const val = d.value;
                                            return val !== undefined && val !== null && !isNaN(val);
                                        });
                                        return (
                                            <g ref={pathGroupRef} key={`line-${dataKey || 'loading'}`} className="line-initial-hidden">
                                                {/* Highlighted line */}
                                                {validHighlightedData.length > 0 && (
                                                    <LinePath
                                                        data={validHighlightedData}
                                                        x={(d) => xScale(d.timestamp)}
                                                        y={(d) => yScale(d.value ?? 0)}
                                                        stroke={strokeColor}
                                                        strokeWidth={3}
                                                        strokeOpacity={1}
                                                        curve={curveMonotoneX}
                                                    />
                                                )}
                                                {/* Dimmed line (when hovering) */}
                                                {hoveredIndex !== null && validDimmedData.length > 0 && (
                                                    <LinePath
                                                        data={validDimmedData}
                                                        x={(d) => xScale(d.timestamp)}
                                                        y={(d) => yScale(d.value ?? 0)}
                                                        stroke={strokeColor}
                                                        strokeWidth={3}
                                                        strokeOpacity={0.25}
                                                        curve={curveMonotoneX}
                                                    />
                                                )}
                                            </g>
                                        );
                                    })()
                                )}

                                {tooltipOpen && tooltipData && showCircle && (
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
                                        {multiLine ? (
                                            multiLine.map((line) => {
                                                const value = tooltipData[line.key];
                                                if (value === undefined || value === null || isNaN(value)) return null;
                                                return (
                                                    <Circle
                                                        key={line.key}
                                                        cx={xScale(tooltipData.timestamp)}
                                                        cy={yScale(value)}
                                                        r={5}
                                                        fill={line.color}
                                                        stroke="#fff"
                                                        strokeWidth={2}
                                                        pointerEvents="none"
                                                    />
                                                );
                                            })
                                        ) : (
                                            <Circle
                                                cx={xScale(tooltipData.timestamp)}
                                                cy={yScale(tooltipData.value ?? 0)}
                                                r={5}
                                                fill={strokeColor}
                                                stroke="#fff"
                                                strokeWidth={2}
                                                pointerEvents="none"
                                            />
                                        )}
                                    </>
                                )}
                                {/* Show circle at end of line when not hovering and animation is complete */}
                                {!tooltipOpen && showCircle && chartData.length > 0 && (
                                    <>
                                        {multiLine ? (
                                            multiLine.map((line) => {
                                                const lastPoint = chartData[chartData.length - 1];
                                                const value = lastPoint[line.key];
                                                if (value === undefined || value === null || isNaN(value)) return null;
                                                return (
                                                    <Circle
                                                        key={line.key}
                                                        cx={xScale(lastPoint.timestamp)}
                                                        cy={yScale(value)}
                                                        r={4}
                                                        fill={line.color}
                                                        stroke="#fff"
                                                        strokeWidth={2}
                                                        pointerEvents="none"
                                                    />
                                                );
                                            })
                                        ) : (
                                            (() => {
                                                const lastPoint = chartData[chartData.length - 1];
                                                if (lastPoint.value === undefined || lastPoint.value === null || isNaN(lastPoint.value)) return null;
                                                return (
                                                    <Circle
                                                        cx={xScale(lastPoint.timestamp)}
                                                        cy={yScale(lastPoint.value)}
                                                        r={4}
                                                        fill={strokeColor}
                                                        stroke="#fff"
                                                        strokeWidth={2}
                                                        pointerEvents="none"
                                                    />
                                                );
                                            })()
                                        )}
                                    </>
                                )}

                                <AxisBottom
                                    top={yMax}
                                    scale={xScale}
                                    numTicks={Math.min(5, Math.floor(xMax / 120))}
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
                                    label={yLabel}
                                    labelProps={{
                                        fill: '#9CA3AF',
                                        fontSize: 11,
                                    }}
                                    stroke="#6B7280"
                                    tickStroke="#6B7280"
                                    tickFormat={smartYFormatter}
                                    numTicks={yTicks ? yTicks.length : 5}
                                    tickValues={yTicks}
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
                                {tooltipFormatter(tooltipData)}
                            </TooltipWithBounds>
                        )}
                    </>
                );
            }}
        </ParentSize>
    );

    if (minimal) {
        return (
            <div style={{ width: '100%', height, position: 'relative' }}>
                {content}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {!hideHeader && (
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">{title}</h3>
                    <div className="flex items-center gap-3">
                        {headerContent}
                    </div>
                </div>
            )}
            <div style={{ width: '100%', height, position: 'relative' }} className="bg-muted/10 rounded-lg p-3">
                {content}
            </div>
        </div>
    );
}
