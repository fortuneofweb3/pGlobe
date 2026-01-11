'use client';

import React, { useMemo, useState, useEffect, Suspense, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PNode, MergedIPEntry } from '@/lib/types/pnode';
import { Copy, Check, RefreshCw, HardDrive, Cpu, MemoryStick, Network, MapPin, Clock, CheckCircle2, XCircle, TrendingUp, Server, ArrowLeft, Activity, Award, Globe, Lock, ExternalLink, Rocket, ChevronDown, ChevronUp } from 'lucide-react';
import { ChartSkeleton, MapSkeleton, CardSkeleton, TableSkeleton } from '@/components/Skeletons';
import { detectDataCenter, getRegionName } from '@/lib/utils/dataCenter';
import { formatBytes, formatStorageBytes } from '@/lib/utils/storage';
import { getFlagForCountry } from '@/lib/utils/country-flags';
import { useNodes } from '@/lib/context/NodesContext';
import BalanceDisplay from '@/components/BalanceDisplay';
import { measureNodeLatency, getCachedLatency } from '@/lib/utils/client-latency';
import { mergeDuplicateIPNodes } from '@/lib/utils/merge-duplicate-ips';
import { scaleTime, scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { Group } from '@visx/group';
import { Circle } from '@visx/shape';
import InfoTooltip from '@/components/InfoTooltip';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { timeFormat } from 'd3-time-format';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import dynamic from 'next/dynamic';
import { MapContainer, TileLayer, Marker, Tooltip, CircleMarker } from 'react-leaflet';
import { useWatchlist } from '@/lib/context/WatchlistContext';
import { Star } from 'lucide-react';

// Dynamically import Leaflet components to avoid SSR issues - import from single module
const NodeMap = dynamic(
    () => import('@/components/NodeMap'),
    { ssr: false, loading: () => <div className="h-full w-full bg-muted/20 rounded-lg" /> }
);
import ActivityLogList from '@/components/ActivityLogList';

// Helper function to calculate center offset to position node on right side (desktop) or center (mobile)
function calculateOffsetCenter(nodeLat: number, nodeLon: number, zoom: number): [number, number] {
    // On mobile, center the point
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
        return [nodeLat, nodeLon];
    }

    // On desktop, offset to position node on right side
    // At zoom level, approximate degrees per pixel
    // For zoom 10: ~0.00137 degrees per pixel at equator
    // For zoom 5: ~0.0439 degrees per pixel at equator
    const baseDegreesPerPixel = zoom === 10 ? 0.00137 : 0.0439;
    const degreesPerPixel = baseDegreesPerPixel / Math.cos(nodeLat * Math.PI / 180);

    // For a typical container width of ~1200px, we want node at ~62% = 744px from left
    // This means we need to shift center ~18% to the left = -210px offset
    const offsetPixels = -210; // Negative to shift left
    const lonOffset = offsetPixels * degreesPerPixel;

    return [nodeLat, nodeLon + lonOffset];
}



interface HistoricalDataPoint {
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

const formatCredits = (value: number): string => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return `${value < 0 ? '-' : ''}${Math.round(absValue / 1000000)}M`;
    }
    if (absValue >= 1000) {
        return `${value < 0 ? '-' : ''}${Math.round(absValue / 1000)}k`;
    }
    return value.toFixed(0);
};

const formatDateAxis = (date: Date, chartData: Array<{ timestamp: number }>): string => {
    if (chartData.length === 0) return '';

    const timeSpan = Math.max(...chartData.map(d => d.timestamp)) - Math.min(...chartData.map(d => d.timestamp));
    const isSameDay = timeSpan < 86400000; // Less than 24 hours

    if (isSameDay) {
        return timeFormat('%H:%M')(date);
    } else {
        return timeFormat('%b %d, %H:%M')(date);
    }
};

/**
 * Abbreviates version string to show only the prefix before timestamp
 */
function abbreviateVersion(version: string): string {
    if (!version) return version;
    const match = version.match(/^([^-]+-)/);
    if (match) {
        return match[1];
    }
    return version;
}

// Helper component for historical line charts (same as modal)
function HistoricalLineChart({
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
}: {
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
}) {
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
        const interval = 10 * 60 * 1000;

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
        }

        // For non-percentage charts, use the original domain
        return yDomain;
    }, [yDomain, chartData, multiLine, yTicks]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">{title}</h3>
                <div className="flex items-center gap-3">
                    {headerContent}
                </div>
            </div>
            <div style={{ width: '100%', height, position: 'relative' }} className="bg-muted/10 rounded-lg p-3">
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

                        const initialXDomain = chartData.length > 0
                            ? [Math.min(...chartData.map(d => d.timestamp)), Math.max(...chartData.map(d => d.timestamp))]
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
                                            borderRadius: 'var(--radius)',
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
            </div>
        </div>
    );
}

// Cache for pin icons to avoid recreation
const pinIconCache = new Map<string, any>();

function NodeDetailContent() {
    const params = useParams();
    const router = useRouter();
    const nodeId = params.id as string;
    const { nodes: allNodes, refreshNodes, lastUpdate, loading } = useNodes();
    const { isWatched, toggleWatchlist } = useWatchlist();
    const [copied, setCopied] = useState(false);
    const [refreshingStats, setRefreshingStats] = useState(false);
    const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [timeRange, setTimeRange] = useState<'30m' | '1h' | '24h' | '1w'>('24h');
    const [nodeLatency, setNodeLatency] = useState<number | null>(() => {
        const node = allNodes.find(n => n.id === nodeId || n.pubkey === nodeId || n.publicKey === nodeId);
        if (!node) return null;
        const cached = getCachedLatency(node.id);
        return cached !== undefined ? cached : null;
    });
    const [measuringLatency, setMeasuringLatency] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [pinIconsReady, setPinIconsReady] = useState(false);
    const [activeIPIndex, setActiveIPIndex] = useState(-1);
    const [ipDropdownOpen, setIpDropdownOpen] = useState(false);
    const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0 });
    const dropdownTriggerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsClient(true);
        // Load Leaflet CSS
        if (typeof window !== 'undefined' && !document.head.querySelector('link[href*="leaflet"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            link.crossOrigin = '';
            document.head.appendChild(link);
        }

        // Pre-create pin icons when Leaflet is available
        if (typeof window !== 'undefined') {
            const checkLeaflet = () => {
                const L = (window as any).L;
                if (L && !pinIconsReady) {
                    // Pre-create pin icons for all status colors
                    const statusColors = {
                        online: '#3F8277',
                        syncing: '#F0A741',
                        offline: '#ED1C24',
                    };

                    Object.values(statusColors).forEach((color) => {
                        if (!pinIconCache.has(color)) {
                            const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 24 30" fill="none"><path d="M12 0C7.03 0 3 4.03 3 9c0 5.25 9 21 9 21s9-15.75 9-21c0-4.97-4.03-9-9-9zm0 12.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
                            const icon = L.divIcon({
                                html: `
                  <div style="position: relative; width: 32px; height: 40px;">
                    ${svgString}
                    <div style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 7px; height: 7px; background: white; border-radius: 50%;"></div>
                  </div>
                `,
                                className: 'custom-pin-icon',
                                iconSize: [32, 40],
                                iconAnchor: [16, 40],
                                popupAnchor: [0, -40]
                            });
                            pinIconCache.set(color, icon);
                        }
                    });
                    setPinIconsReady(true);
                }
            };

            // Check immediately
            checkLeaflet();

            // Also check after a short delay in case Leaflet loads asynchronously
            const timeout = setTimeout(checkLeaflet, 100);
            return () => clearTimeout(timeout);
        }
    }, [pinIconsReady]);

    const node = useMemo(() => {
        if (!nodeId || !allNodes.length) return undefined;

        // Find the starting point node
        const seedNode = allNodes.find(n =>
            n.id === nodeId || n.pubkey === nodeId || n.publicKey === nodeId || (n.address && n.address.split(':')[0] === nodeId)
        );

        if (!seedNode) return undefined;


        // The nodes from useNodes() are ALREADY merged by NodesContext.
        // We should not merge them again, as that strips the granular 'mergedIPs' data.
        const allMerged = allNodes;

        // Find which merged group our seed node belongs to
        // We check if the merged node's pubkey or IP matches, 
        // or if one of its individual entries matches.
        const seedPK = seedNode.pubkey || seedNode.publicKey;
        const seedIP = seedNode.address?.split(':')[0];

        return allMerged.find(m => {
            if (m.pubkey === seedPK || m.publicKey === seedPK) return true;
            if (m.address?.split(':')[0] === seedIP) return true;

            // Check merged entries
            return m.mergedIPs?.some(entry => {
                const entryIP = entry.address?.split(':')[0];
                const entryPK = entry.address; // In our latest merge logic, we store pubkey in 'address' for merged entries? No, check merge-duplicate-ips.ts
                // Actually, let's just check against the cluster members if possible.
                // But better: since we used mergeDuplicateIPNodes, we can just check 
                // the identifiers.
                return (entryIP && entryIP === seedIP) || (entry.address === seedPK);
            });
        });
    }, [allNodes, nodeId]);

    // Current view node: either the primary node (for common info) or the specific IP entry (for stats)
    const viewNode = useMemo(() => {
        if (!node) return undefined;

        // Aggregated view: use base node but ensure createdAt is the oldest among all IPs
        if (activeIPIndex === -1) {
            if (node.isMerged && node.mergedIPs && node.mergedIPs.length > 0) {
                const initialCreatedAt = typeof node.createdAt === 'string' ? node.createdAt :
                    (node.createdAt instanceof Date ? node.createdAt.toISOString() : undefined);

                const oldestCreatedAt = node.mergedIPs.reduce<string | undefined>((min, n) => {
                    const nCreatedAt = typeof n.createdAt === 'string' ? n.createdAt :
                        (n.createdAt instanceof Date ? n.createdAt.toISOString() : undefined);
                    if (!nCreatedAt) return min;
                    if (!min) return nCreatedAt;
                    return new Date(nCreatedAt) < new Date(min) ? nCreatedAt : min;
                }, initialCreatedAt);
                return { ...node, createdAt: oldestCreatedAt };
            }
            return node;
        }

        // Specific IP view: merge base with specific IP data
        return node.isMerged && node.mergedIPs && node.mergedIPs[activeIPIndex]
            ? { ...node, ...node.mergedIPs[activeIPIndex] }
            : node;
    }, [node, activeIPIndex]);

    // Pre-create pin icons immediately when Leaflet is available
    const [pinIcons, setPinIcons] = useState<Record<string, any>>({});

    useEffect(() => {
        if (typeof window === 'undefined' || !isClient) return;

        const createIcons = () => {
            const L = (window as any).L;
            if (!L) {
                // Retry after a short delay if Leaflet isn't loaded yet
                setTimeout(createIcons, 50);
                return;
            }

            const statusColors = {
                online: '#3F8277',
                syncing: '#F0A741',
                offline: '#ED1C24',
            };

            const icons: Record<string, any> = {};
            Object.entries(statusColors).forEach(([status, color]) => {
                if (!pinIconCache.has(color)) {
                    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 24 30" fill="none"><path d="M12 0C7.03 0 3 4.03 3 9c0 5.25 9 21 9 21s9-15.75 9-21c0-4.97-4.03-9-9-9zm0 12.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
                    const icon = L.divIcon({
                        html: `
              <div style="position: relative; width: 32px; height: 40px; overflow: visible;">
                ${svgString}
                <div style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 7px; height: 7px; background: white; border-radius: 50%;"></div>
              </div>
            `,
                        className: 'custom-pin-icon',
                        iconSize: [32, 40],
                        iconAnchor: [16, 40],
                        popupAnchor: [0, -40]
                    });
                    pinIconCache.set(color, icon);
                    icons[status] = icon;
                } else {
                    icons[status] = pinIconCache.get(color);
                }
            });
            setPinIcons(icons);
        };

        createIcons();
    }, [isClient]);

    useEffect(() => {
        let mounted = true;

        const measureLatency = async () => {
            if (!node) return;

            const cached = getCachedLatency(node.id);
            if (cached !== undefined) {
                if (mounted) {
                    setNodeLatency(cached);
                }
                return;
            }

            setMeasuringLatency(true);
            try {
                const latency = await measureNodeLatency(node, 2000);
                if (mounted) {
                    setNodeLatency(latency);
                }
            } catch (error) {
                console.warn('[NodeDetailPage] Failed to measure node latency:', error);
            } finally {
                if (mounted) {
                    setMeasuringLatency(false);
                }
            }
        };

        if (node) {
            measureLatency();
        }

        return () => {
            mounted = false;
        };
    }, [node?.id]);

    const handleRefresh = async () => {
        setRefreshingStats(true);
        try {
            await refreshNodes();
        } catch (e) {
            console.error('Failed to refresh:', e);
        } finally {
            setRefreshingStats(false);
        }
    };

    useEffect(() => {
        if (!node) {
            setHistoricalData([]);
            setLoadingHistory(false);
            return;
        }

        let abortController: AbortController | null = null;
        let timeoutId: NodeJS.Timeout | null = null;
        let isMounted = true;

        const fetchHistory = async () => {
            if (!isMounted) return;

            setLoadingHistory(true);
            abortController = new AbortController();
            timeoutId = setTimeout(() => {
                if (abortController) {
                    abortController.abort();
                }
            }, 30000);

            try {
                const pubkey = node.pubkey || node.publicKey || node.id || '';
                if (!pubkey) {
                    if (isMounted) {
                        setHistoricalData([]);
                        setLoadingHistory(false);
                    }
                    return;
                }

                const address = activeIPIndex === -1
                    ? undefined
                    : (node.isMerged && node.mergedIPs && node.mergedIPs[activeIPIndex])
                        ? node.mergedIPs[activeIPIndex].address
                        : node.address;

                const endTime = Date.now();
                const startTime = endTime - (7 * 24 * 60 * 60 * 1000);

                const url = `/api/history?nodeId=${encodeURIComponent(pubkey)}&startTime=${startTime}&endTime=${endTime}${address ? `&address=${encodeURIComponent(address)}` : ''}`;

                const response = await fetch(url, {
                    signal: abortController.signal,
                });

                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                if (!isMounted) return;

                if (!response.ok) {
                    if (isMounted) {
                        setHistoricalData([]);
                        setLoadingHistory(false);
                    }
                    return;
                }

                const data = await response.json();

                if (!isMounted) return;

                if (data.error) {
                    setHistoricalData([]);
                } else {
                    const enrichedData = (data.data || []).map((point: any) => ({
                        ...point,
                        nodeLocation: node?.locationData ? {
                            lat: node.locationData.lat,
                            lon: node.locationData.lon,
                            country: node.locationData.country,
                        } : undefined,
                    }));
                    setHistoricalData(enrichedData);
                }
            } catch (error: any) {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                if (!isMounted) return;

                setHistoricalData([]);
            } finally {
                if (isMounted) {
                    setLoadingHistory(false);
                }
            }
        };

        fetchHistory();

        return () => {
            isMounted = false;
            if (abortController) {
                abortController.abort();
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            setLoadingHistory(false);
        };
    }, [node?.pubkey || node?.publicKey || node?.id, activeIPIndex]);

    const nodeStats = useMemo(() => {
        if (!viewNode) return null;

        const networkAvgCpu = allNodes.length > 0
            ? allNodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).reduce((sum, n) => sum + (n.cpuPercent || 0), 0) / allNodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).length
            : 0;

        const ramUtilization = viewNode.ramTotal && viewNode.ramUsed
            ? (viewNode.ramUsed / viewNode.ramTotal) * 100
            : 0;

        return {
            networkAvgCpu,
            ramUtilization,
        };
    }, [viewNode, allNodes]);

    const formatUptime = (uptime?: number) => {
        if (uptime === undefined || uptime === null) return '—';
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const formatValue = (value: any, formatter?: (val: any) => string): string => {
        if (value === undefined || value === null) return '—';
        return formatter ? formatter(value) : String(value);
    };

    const getStatusBadge = (status?: string) => {
        if (status === 'online') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#3F8277]/20 text-[#3F8277] border border-[#3F8277]/30">Online</span>;
        }
        if (status === 'syncing') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#F0A741]/20 text-[#F0A741] border border-[#F0A741]/30">Syncing</span>;
        }
    };

    // Helper to render the IP Switcher Dropdown
    // Helper to render the IP Switcher Dropdown
    const renderIPSwitcher = () => {
        if (!node) return null;
        // Only show if there are merged IPs (more than 1 IP or just merged structure)
        // If it's a single IP node without merged structure, we don't need a switcher
        if (!node.isMerged || !node.mergedIPs || node.mergedIPs.length === 0) return null;

        const currentSelection = activeIPIndex === -1
            ? { label: 'All IPs (Aggregated)', status: null }
            : {
                label: node.mergedIPs[activeIPIndex].address || 'Unknown IP',
                status: node.mergedIPs[activeIPIndex].status
            };

        return (
            <div className="relative mb-6 w-fit">
                <div
                    ref={dropdownTriggerRef}
                    className="flex items-center justify-between w-auto min-w-[260px] px-3 py-2 bg-background/60 border border-border/40 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors backdrop-blur-sm group"
                    onClick={(e) => {
                        e.stopPropagation();
                        // Calculate position on open
                        if (!ipDropdownOpen && dropdownTriggerRef.current) {
                            const rect = dropdownTriggerRef.current.getBoundingClientRect();
                            // Position below the trigger, aligning left
                            setDropdownCoords({
                                top: rect.bottom + 6,
                                left: rect.left,
                                width: rect.width
                            });
                        }
                        setIpDropdownOpen(!ipDropdownOpen);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${activeIPIndex === -1 ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]' :
                            currentSelection.status === 'online' ? 'bg-green-500' :
                                currentSelection.status === 'syncing' ? 'bg-orange-500' : 'bg-red-500'
                            }`} />
                        <span className="text-sm font-mono text-foreground font-medium truncate max-w-[180px]">
                            {currentSelection.label}
                        </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-foreground/50 transition-transform duration-300 ${ipDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {/* Dropdown Menu Portal */}
                {ipDropdownOpen && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'none' }}>
                        {/* Overlay to close */}
                        <div
                            className="absolute inset-0 bg-transparent"
                            style={{ pointerEvents: 'auto' }}
                            onClick={() => setIpDropdownOpen(false)}
                        />

                        {/* Dropdown Content */}
                        <div
                            className="absolute bg-black/95 border border-border/40 rounded-lg shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                            style={{
                                top: dropdownCoords.top,
                                left: dropdownCoords.left,
                                width: dropdownCoords.width,
                                zIndex: 10000,
                                pointerEvents: 'auto'
                            }}
                        >
                            <div className="max-h-64 overflow-y-auto py-1">
                                {/* All IPs Option */}
                                <div
                                    className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer transition-colors ${activeIPIndex === -1 ? 'bg-cyan-500/10 text-cyan-400' : 'hover:bg-muted/30 text-foreground/70 hover:text-foreground'
                                        }`}
                                    onClick={() => {
                                        setActiveIPIndex(-1);
                                        setIpDropdownOpen(false);
                                    }}
                                >
                                    <Server className="w-4 h-4 shrink-0" />
                                    <span className="text-sm font-mono flex-1">All IPs (Aggregated)</span>
                                    {activeIPIndex === -1 && <Check className="w-3.5 h-3.5" />}
                                </div>

                                <div className="h-px bg-border/20 my-1 mx-2" />

                                {/* Individual IPs */}
                                {node.mergedIPs.map((ip, idx) => (
                                    <div
                                        key={idx}
                                        className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer transition-colors ${activeIPIndex === idx ? 'bg-cyan-500/10 text-cyan-400' : 'hover:bg-muted/30 text-foreground/70 hover:text-foreground'
                                            }`}
                                        onClick={() => {
                                            setActiveIPIndex(idx);
                                            setIpDropdownOpen(false);
                                        }}
                                    >
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${ip.status === 'online' ? 'bg-green-500' :
                                            ip.status === 'syncing' ? 'bg-orange-500' : 'bg-red-500'
                                            }`} />
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-sm font-mono truncate">{ip.address}</span>
                                            {ip.locationData?.city && (
                                                <span className="text-[10px] text-muted-foreground truncate">
                                                    {ip.locationData.city}, {ip.locationData.country}
                                                </span>
                                            )}
                                        </div>
                                        {activeIPIndex === idx && <Check className="w-3.5 h-3.5" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        );
    };
    // Show loading skeleton when loading or no data
    const isLoading = loading || (allNodes.length === 0);

    if (isLoading && !node && allNodes.length === 0) {
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
                <Header activePage="nodes" nodeCount={0} lastUpdate={null} loading={true} onRefresh={() => { }} />

                <main className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 w-full p-3 sm:p-6 overflow-y-auto">
                        <div className="max-w-7xl mx-auto">
                            {/* Back Link */}
                            <Link href="/nodes" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-all duration-300 group">
                                <ArrowLeft className="w-4 h-4" />
                                <div className="h-3 w-24 bg-muted/20 rounded" />
                            </Link>

                            {/* Cover Section with Map Background */}
                            <div className="relative rounded-xl overflow-hidden border border-border/40 bg-card mb-8" style={{ minHeight: '234px', maxHeight: '260px' }}>
                                {/* Map Background Placeholder */}
                                <div className="absolute inset-0 h-full w-full bg-muted/10" />

                                {/* Content Overlay */}
                                <div className="relative px-5 sm:px-7 lg:px-9 pt-8 pb-8">
                                    <div className="mb-8">
                                        {/* Badges */}
                                        <div className="flex items-center gap-3 flex-wrap mb-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted/20 border border-border/30">
                                                <div className="h-3 w-12 bg-muted/30 rounded" />
                                            </span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 border border-green-500/30">
                                                <div className="h-3 w-10 bg-green-400/30 rounded" />
                                            </span>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-background/50 border border-border/30">
                                                <div className="h-3 w-32 bg-muted/20 rounded" />
                                            </span>
                                        </div>

                                        {/* Title with Server Icon */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <Server className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                            <div className="h-8 w-56 sm:w-72 bg-muted/30 rounded" />
                                        </div>

                                        {/* Location & Version */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-foreground/40" />
                                                <div className="h-4 w-36 bg-muted/20 rounded" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-12 bg-muted/10 rounded" />
                                                <div className="h-4 w-16 bg-muted/20 rounded" />
                                            </div>
                                        </div>

                                        {/* Public Key Box */}
                                        <div className="mt-4 inline-flex items-center gap-2 p-2 bg-background/40 border border-border/40 rounded-lg">
                                            <div className="h-4 w-40 sm:w-56 bg-muted/30 rounded" />
                                            <div className="p-1.5 border border-border/60 rounded">
                                                <Copy className="w-3.5 h-3.5 text-foreground/40" />
                                            </div>
                                            <div className="p-1.5 border border-border/60 rounded">
                                                <div className="w-3.5 h-3.5 bg-muted/20 rounded" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Performance Metrics Grid - 3 columns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                {/* Resource Usage Card */}
                                <div className="card">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Activity className="w-4 h-4 text-[#F0A741]" />
                                        <div className="h-4 w-28 bg-muted/20 rounded" />
                                    </div>
                                    <div className="space-y-3">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col gap-1">
                                                    <div className="h-3 w-16 bg-muted/20 rounded" />
                                                    <div className="h-2 w-24 bg-muted/10 rounded" />
                                                </div>
                                                <div className="h-5 w-12 bg-muted/30 rounded" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Status & Performance Card */}
                                <div className="card">
                                    <div className="flex items-center gap-2 mb-4">
                                        <TrendingUp className="w-4 h-4 text-[#3F8277]" />
                                        <div className="h-4 w-36 bg-muted/20 rounded" />
                                    </div>
                                    <div className="space-y-3">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col gap-1">
                                                    <div className="h-3 w-16 bg-muted/20 rounded" />
                                                    <div className="h-2 w-20 bg-muted/10 rounded" />
                                                </div>
                                                <div className="h-5 w-14 bg-muted/30 rounded" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Network & Storage Card */}
                                <div className="card">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Network className="w-4 h-4 text-blue-400" />
                                        <div className="h-4 w-32 bg-muted/20 rounded" />
                                    </div>
                                    <div className="space-y-3">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col gap-1">
                                                    <div className="h-3 w-20 bg-muted/20 rounded" />
                                                    <div className="h-2 w-24 bg-muted/10 rounded" />
                                                </div>
                                                <div className="h-5 w-16 bg-muted/30 rounded" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Historical Performance Section */}
                            <div className="card mb-6" style={{ padding: '1.5rem' }}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-[#F0A741]" />
                                        <h2 className="text-lg font-bold text-foreground">Historical Performance</h2>
                                    </div>
                                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                                        {['30m', '1h', '24h', '1w'].map((range, i) => (
                                            <div key={range} className={`px-3 py-1 text-xs rounded ${i === 2 ? 'bg-[#F0A741]' : 'bg-transparent'}`}>
                                                <div className={`h-3 w-6 ${i === 2 ? 'bg-black/30' : 'bg-muted/30'} rounded`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="h-4 w-24 bg-muted/20 rounded" />
                                            <div className="h-4 w-16 bg-muted/10 rounded" />
                                        </div>
                                        <ChartSkeleton height={250} />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="h-4 w-28 bg-muted/20 rounded" />
                                            <div className="h-4 w-16 bg-muted/10 rounded" />
                                        </div>
                                        <ChartSkeleton height={250} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (!node && !loading) {
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
                <Header activePage="nodes" lastUpdate={lastUpdate} loading={loading} onRefresh={handleRefresh} />
                <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
                    <div className="text-center space-y-4">
                        <p className="text-lg text-foreground/60">pNode not found</p>
                        <Link href="/nodes" className="inline-flex items-center gap-2 text-[#F0A741] hover:text-[#F0A741]/80 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                            Back to pNodes
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // If we don't have a node yet but are loading, show skeleton
    if (!node && loading) {
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
                <Header activePage="nodes" lastUpdate={lastUpdate} loading={loading} onRefresh={handleRefresh} />
                <main className="flex-1 overflow-hidden">
                    <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
                        <div className="max-w-7xl mx-auto">
                            {/* Breadcrumb (Static structure) */}
                            <div className="mb-4 sm:mb-6 flex items-center gap-2 text-sm text-foreground/60">
                                <Link href="/nodes" className="hover:text-foreground transition-colors">pNodes</Link>
                                <span>/</span>
                                <span className="h-4 w-48 bg-muted/20 rounded animate-pulse inline-block font-mono" />
                            </div>

                            {/* Header Section */}
                            <div className="card mb-6">
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted/20 text-foreground/40 border border-border/30 animate-pulse">
                                                    Status
                                                </span>
                                                <div>
                                                    <h1 className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                                                        <span className="h-7 w-64 bg-muted/20 rounded animate-pulse inline-block" />
                                                    </h1>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-foreground/60">Version</span>
                                                        <span className="h-4 w-20 bg-muted/20 rounded animate-pulse inline-block" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-2 pt-2 border-t border-border/40">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-foreground/60 uppercase tracking-wide mb-1.5">Public Key</div>
                                                    <p className="h-4 w-full bg-muted/30 rounded animate-pulse" />
                                                </div>
                                                <button className="p-2 hover:bg-muted/40 rounded transition-colors border border-border/60 mt-5" disabled>
                                                    <Copy className="w-4 h-4 text-foreground/60" />
                                                </button>
                                            </div>
                                        </div>

                                        <button className="p-2 hover:bg-muted/40 rounded-lg transition-colors border border-border/60" disabled>
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 stagger-children">
                                {[1, 2, 3, 4].map((i) => (
                                    <StatsCard
                                        key={i}
                                        title="Loading"
                                        value={0}
                                        loading={true}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Ensure node exists before rendering
    if (!node) {
        return null;
    }

    if (!viewNode) return null;

    const pubkey = viewNode.pubkey || viewNode.publicKey || viewNode.id || (viewNode.address ? viewNode.address.split(':')[0] : '') || '';
    const truncatedPubkey = pubkey.length > 16 ? `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}` : pubkey;
    const gossipAddress = viewNode.address || '—';



    return (
        <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
            <Header activePage="nodes" lastUpdate={lastUpdate} loading={loading} onRefresh={handleRefresh} />

            <main className="flex-1 overflow-hidden">
                <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
                    <div className="max-w-7xl mx-auto">
                        {/* Cover Section with Map Background */}
                        {node.locationData && node.locationData.lat && node.locationData.lon ? (
                            <div className="relative mb-8 animate-fade-in" style={{ animationDelay: '0.05s', opacity: 0, animationFillMode: 'forwards' }}>
                                {/* Back button */}
                                <Link href="/nodes" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-all duration-300 hover:translate-x-[-4px] group">
                                    <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
                                    <span>Back to pNodes</span>
                                </Link>

                                <div className="relative rounded-xl overflow-hidden border border-border/40 shadow-2xl bg-card" style={{ minHeight: '234px', maxHeight: '260px' }}>
                                    {/* Map Background */}
                                    <div className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
                                        <style jsx global>{`
                      .node-details-map-container .leaflet-container .leaflet-control-attribution {
                        display: none !important;
                      }
                      .node-details-map-container .leaflet-container {
                        background: #000 !important;
                        overflow: visible !important;
                      }
                      .node-details-map-container .leaflet-container .leaflet-tile-pane {
                        background: #000 !important;
                      }
                      .node-details-map-container .leaflet-container .leaflet-map-pane {
                        background: #000 !important;
                        overflow: visible !important;
                      }
                      .node-details-map-container .leaflet-container .leaflet-marker-pane {
                        overflow: visible !important;
                        z-index: 600 !important;
                      }
                      .node-details-map-container .leaflet-container img.leaflet-tile {
                        opacity: 0.8;
                      }
                      .node-details-map-container .leaflet-tile-container img {
                        opacity: 0.8;
                      }
                      .node-details-map-container .leaflet-container .leaflet-tile-pane img {
                        opacity: 0.8;
                      }
                      .custom-pin-icon {
                        overflow: visible !important;
                      }
                    `}</style>

                                        {isClient && node.locationData?.lat && node.locationData?.lon ? (
                                            <NodeMap
                                                node={node}
                                                allNodes={allNodes}
                                                center={calculateOffsetCenter(
                                                    node.locationData.lat,
                                                    node.locationData.lon,
                                                    node.locationData.city ? 10 : 5
                                                )}
                                                zoom={node.locationData.city ? 10 : 5}
                                            />
                                        ) : (
                                            <div className="h-full w-full bg-muted/20 animate-pulse" />
                                        )}
                                    </div>

                                    {/* Content Overlay - Left Side */}
                                    <div className="relative px-5 sm:px-7 lg:px-9 pt-8 pb-8">
                                        {/* Header Row */}
                                        <div className="mb-8">
                                            <div className="animate-slide-in-left" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
                                                {/* Badges */}
                                                <div className="flex items-center gap-3 flex-wrap mb-4">
                                                    {getStatusBadge(viewNode.status)}
                                                    {node.isPublic === true && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30" title="Public pNode - pRPC is publicly accessible">
                                                            <Globe className="w-3 h-3" />
                                                            Public
                                                        </span>
                                                    )}
                                                    {node.isPublic === false && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30" title="Private pNode - pRPC is not publicly accessible">
                                                            <Lock className="w-3 h-3" />
                                                            Private
                                                        </span>
                                                    )}
                                                    {node.version && node.version.includes('-trynet') && (
                                                        <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium">
                                                            TRYNET
                                                        </span>
                                                    )}
                                                    {node.createdAt && (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-background/50 text-foreground/70 border border-border/30 backdrop-blur-sm" title="First detected by database. Actual network join time may vary.">
                                                            Joined {new Date(node.createdAt).toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Title - Use Pubkey as identifier */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <Server className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                                    <div>
                                                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-mono text-foreground break-all" title={pubkey}>
                                                            {truncatedPubkey || gossipAddress}
                                                        </h1>

                                                    </div>
                                                </div>

                                                {/* Location & Version */}
                                                <div className="space-y-2">
                                                    <p className="text-foreground/60 text-sm sm:text-base flex items-center gap-2">
                                                        <MapPin className="w-4 h-4" />
                                                        {activeIPIndex === -1 && node.isMerged && node.mergedIPs && node.mergedIPs.length > 1
                                                            ? 'Multiple locations'
                                                            : viewNode?.locationData?.city
                                                                ? `${viewNode.locationData.city}${viewNode.locationData.country ? `, ${viewNode.locationData.country}` : ''}`
                                                                : 'Unknown location'
                                                        }
                                                    </p>
                                                    {node.version && (
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className="text-foreground/60">Version</span>
                                                            <span className="font-semibold text-foreground">{node.version}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-4">
                                                    {renderIPSwitcher()}
                                                </div>




                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Fallback Header (no location) */}
                                < Link href="/nodes" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-all duration-300 hover:translate-x-[-4px] group">
                                    <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
                                    <span>Back to pNodes</span>
                                </Link>

                                <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.05s', opacity: 0, animationFillMode: 'forwards' }}>
                                    <div className="flex items-center gap-3 flex-wrap mb-3">
                                        {getStatusBadge(viewNode.status)}
                                        {node.isPublic === true && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                                <Globe className="w-3 h-3" />
                                                Public
                                            </span>
                                        )}
                                        {node.createdAt && (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-muted/20 text-foreground/60 border border-border/30" title="First detected by database. Actual network join time may vary.">
                                                <Clock className="w-3 h-3 text-[#F0A741]" />
                                                Joined {new Date(node.createdAt).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <Server className="w-6 h-6 text-[#F0A741]" />
                                        <h1 className="text-2xl sm:text-3xl font-bold font-mono text-foreground break-all">
                                            {gossipAddress}
                                        </h1>
                                    </div>
                                    {node.version && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-foreground/60">Version</span>
                                            <span className="font-semibold text-foreground">{node.version}</span>
                                        </div>
                                    )}
                                    <div className="mt-4">
                                        {renderIPSwitcher()}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Private Node View */}
                        {node.isPublic === false ? (
                            <>
                                {/* Private Node Notice + Ownership Grid */}
                                <div className={`grid grid-cols-1 ${node.isRegistered ? 'md:grid-cols-2' : ''} gap-4 mb-6`}>
                                    {/* Private Node Notice */}
                                    <div className="card bg-orange-500/10 border-orange-500/30 animate-fade-in h-full" style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}>
                                        <div className="flex items-start gap-3">
                                            <Lock className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                                <h3 className="text-xl font-bold text-foreground">Private pNode</h3>
                                                <p className="text-muted-foreground mt-2">
                                                    This pNode is configured as private. Historical data and detailed performance metrics are only visible to the node owner or authorized operators.
                                                </p>
                                                <p className="text-xs text-foreground/70 leading-relaxed mt-2">
                                                    Only basic information from network gossip is shown.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ownership Card - Only show for registered nodes */}
                                    {node.isRegistered && (
                                        <div className="card bg-orange-500/10 border-orange-500/30 animate-fade-in h-full" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
                                            <div className="flex items-start gap-3">
                                                <Award className="w-5 h-5 text-[#F0A741] mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <h3 className="text-xl font-bold text-foreground">Ownership</h3>
                                                    <div className="mt-3 space-y-3">
                                                        {/* Manager (Buyer) */}
                                                        <div>
                                                            <div className="text-xs text-foreground/60 mb-1">Manager (Mainnet Buyer)</div>
                                                            <div className="flex items-center gap-2">
                                                                {node.managerWallet ? (
                                                                    <>
                                                                        <Link href={`/managers/${node.managerWallet}`} className="font-mono text-sm text-[#F0A741] hover:underline underline-offset-4 decoration-[#F0A741]/40">
                                                                            {node.managerWallet.slice(0, 6)}...{node.managerWallet.slice(-4)}
                                                                        </Link>
                                                                        <a href={`https://solscan.io/account/${node.managerWallet}`} target="_blank" rel="noopener noreferrer" className="text-foreground/20 hover:text-foreground/60 transition-colors">
                                                                            <ExternalLink className="w-3 h-3" />
                                                                        </a>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-sm text-foreground/40 italic">Unknown</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Registrar (Devnet) */}
                                                        {node.registrarWallet && (
                                                            <div>
                                                                <div className="text-xs text-foreground/60 mb-1">Registrar (Devnet)</div>
                                                                <div className="flex items-center gap-2">
                                                                    <a href={`https://explorer.xandeum.com/address/${node.registrarWallet}`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-blue-400 hover:underline underline-offset-4 decoration-blue-400/40">
                                                                        {node.registrarWallet.slice(0, 6)}...{node.registrarWallet.slice(-4)}
                                                                    </a>
                                                                    <a href={`https://explorer.xandeum.com/address/${node.registrarWallet}`} target="_blank" rel="noopener noreferrer" className="text-foreground/20 hover:text-foreground/60 transition-colors">
                                                                        <ExternalLink className="w-3 h-3" />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Performance Metrics Grid - 2 columns for Private Node */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    {/* Basic Info Card */}
                                    <div className="card animate-slide-in-left" style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Server className="w-4 h-4 text-[#F0A741]" />
                                            <h3 className="text-sm font-semibold text-foreground">Basic Info</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Activity className="w-4 h-4 text-foreground/60" />
                                                        <span className="text-sm text-foreground/80">Status</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Current state</span>
                                                </div>
                                                {getStatusBadge(viewNode.status)}
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Rocket className="w-4 h-4 text-foreground/60" />
                                                        <span className="text-sm text-foreground/80">Version</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Software release</span>
                                                </div>
                                                <span className="text-sm font-mono font-semibold text-foreground max-w-[120px] truncate" title={node.version}>
                                                    {node.version ? abbreviateVersion(node.version) : '—'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <HardDrive className="w-4 h-4 text-foreground/60" />
                                                        <span className="text-sm text-foreground/80">Storage</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Allocated capacity</span>
                                                </div>
                                                <span className="text-lg font-bold text-foreground">
                                                    {viewNode.storageCapacity ? formatStorageBytes(viewNode.storageCapacity) : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status & Performance Card */}
                                    <div className="card animate-slide-in-right" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <TrendingUp className="w-4 h-4 text-[#F0A741]" />
                                            <h3 className="text-sm font-semibold text-foreground">Status & Performance</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-foreground/60" />
                                                        <span className="text-sm text-foreground/80">Uptime</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Network availability</span>
                                                </div>
                                                <span className="text-lg font-bold text-foreground">{formatUptime(viewNode.uptime)}</span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Award className="w-4 h-4 text-foreground/60" />
                                                        <span className="text-sm text-foreground/80">Credits</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Lifetime earnings</span>
                                                </div>
                                                <span className="text-lg font-bold text-[#F0A741]">
                                                    {viewNode.credits !== undefined && viewNode.credits !== null
                                                        ? viewNode.credits.toLocaleString()
                                                        : '—'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-foreground/80">Registered</span>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Identity on-chain</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {node.isRegistered || (node.balance && node.balance > 0) ? (
                                                        <>
                                                            <CheckCircle2 className="w-4 h-4 text-[#3F8277]" />
                                                            <span className="text-sm text-[#3F8277] font-semibold">Yes</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-4 h-4 text-gray-400" />
                                                            <span className="text-sm text-gray-400">No</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Public Node View - Full Details */
                            <>

                                {/* Performance Metrics Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                    {/* Resource Usage Card */}
                                    <div className="card animate-slide-in-left" style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Activity className="w-4 h-4 text-[#F0A741]" />
                                            <h3 className="text-sm font-semibold text-foreground">Resource Usage</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Cpu className="w-4 h-4 text-foreground/60" />
                                                        <span className="text-sm text-foreground/80">CPU</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Process utilization</span>
                                                </div>
                                                <span className="text-lg font-bold text-foreground">
                                                    {formatValue(viewNode.cpuPercent, (val) => `${val.toFixed(1)}%`)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <MemoryStick className="w-4 h-4 text-foreground/60" />
                                                        <span className="text-sm text-foreground/80">RAM</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Memory usage</span>
                                                </div>
                                                <span className="text-lg font-bold text-foreground">
                                                    {formatValue(nodeStats?.ramUtilization, (val) => `${val.toFixed(1)}%`)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <HardDrive className="w-4 h-4 text-foreground/60" />
                                                        <span className="text-sm text-foreground/80">Storage</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Allocated capacity</span>
                                                </div>
                                                <span className="text-lg font-bold text-foreground">
                                                    {formatValue(viewNode.storageCapacity, formatStorageBytes)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Network Activity Card */}
                                    <div className="card animate-scale-in" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Network className="w-4 h-4 text-[#3F8277]" />
                                            <h3 className="text-sm font-semibold text-foreground">Network Activity</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-foreground/80">Packets Rx</span>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Total received</span>
                                                </div>
                                                <span className="text-lg font-bold font-mono text-foreground">
                                                    {viewNode.packetsReceived !== undefined && viewNode.packetsReceived !== null
                                                        ? formatNumber(viewNode.packetsReceived)
                                                        : '—'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-foreground/80">Packets Tx</span>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Total transmitted</span>
                                                </div>
                                                <span className="text-lg font-bold font-mono text-foreground">
                                                    {viewNode.packetsSent !== undefined && viewNode.packetsSent !== null
                                                        ? formatNumber(viewNode.packetsSent)
                                                        : '—'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-foreground/80">Active Streams</span>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Current connections</span>
                                                </div>
                                                <span className="text-lg font-bold font-mono text-foreground">
                                                    {viewNode.activeStreams !== undefined ? viewNode.activeStreams : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>



                                    {/* Status & Credits Card */}
                                    <div className="card animate-slide-in-right" style={{ animationDelay: '0.25s', opacity: 0, animationFillMode: 'forwards' }}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <TrendingUp className="w-4 h-4 text-[#F0A741]" />
                                            <h3 className="text-sm font-semibold text-foreground">Status & Performance</h3>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-foreground/60" />
                                                        <span className="text-sm text-foreground/80">Uptime</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Network availability</span>
                                                </div>
                                                <span className="text-lg font-bold text-foreground">{formatUptime(viewNode.uptime)}</span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Award className="w-4 h-4 text-foreground/60" />
                                                        <span className="text-sm text-foreground/80">Credits</span>
                                                    </div>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Lifetime earnings</span>
                                                </div>
                                                <span className="text-lg font-bold text-[#F0A741]">
                                                    {viewNode.credits !== undefined && viewNode.credits !== null
                                                        ? viewNode.credits.toLocaleString()
                                                        : '—'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-foreground/80">Registered</span>
                                                    <span className="text-[10px] text-foreground/40 mt-1 font-semibold uppercase tracking-wider">Identity on-chain</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {node.isRegistered || (node.balance && node.balance > 0) ? (
                                                        <>
                                                            <CheckCircle2 className="w-4 h-4 text-[#3F8277]" />
                                                            <span className="text-sm text-[#3F8277] font-semibold">Yes</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-4 h-4 text-gray-400" />
                                                            <span className="text-sm text-gray-400">No</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Content Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-6">
                                    {/* Storage & Memory */}
                                    <div className="card">
                                        <div className="flex items-center gap-2 mb-4">
                                            <HardDrive className="w-4 h-4 text-foreground/40" />
                                            <h2 className="text-base font-semibold text-foreground">Storage & Memory</h2>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* Storage Circular Chart */}
                                            {viewNode.storageCapacity ? (
                                                <div className="flex flex-col items-center">
                                                    <div className="relative w-32 h-32 mb-3">
                                                        <svg className="transform -rotate-90 w-32 h-32">
                                                            <circle
                                                                cx="64"
                                                                cy="64"
                                                                r="54"
                                                                stroke="rgb(var(--muted))"
                                                                strokeWidth="8"
                                                                fill="none"
                                                            />
                                                            {(() => {
                                                                const storageUsed = node.storageUsed;
                                                                const storagePercent = storageUsed && viewNode.storageCapacity
                                                                    ? (storageUsed / viewNode.storageCapacity) * 100
                                                                    : 0;
                                                                const circumference = 2 * Math.PI * 54;
                                                                return (
                                                                    <circle
                                                                        cx="64"
                                                                        cy="64"
                                                                        r="54"
                                                                        stroke={storagePercent > 80 ? '#ED1C24' : storagePercent > 60 ? '#F0A741' : '#3F8277'}
                                                                        strokeWidth="8"
                                                                        fill="none"
                                                                        strokeDasharray={`${circumference}`}
                                                                        strokeDashoffset={circumference}
                                                                        strokeLinecap="round"
                                                                        style={{
                                                                            '--circumference': `${circumference}`,
                                                                            '--target-offset': `${circumference - (storagePercent / 100) * circumference}`,
                                                                            animation: storagePercent > 0 ? 'fillCircle 1s ease-out forwards' : 'none',
                                                                        } as React.CSSProperties & { '--circumference': string; '--target-offset': string }}
                                                                    />
                                                                );
                                                            })()}
                                                        </svg>
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="text-center">
                                                                <HardDrive className="w-6 h-6 text-foreground/40 mx-auto mb-1" />
                                                                {(() => {
                                                                    const storageUsed = node.storageUsed;
                                                                    const storagePercent = storageUsed && viewNode.storageCapacity
                                                                        ? (storageUsed / viewNode.storageCapacity) * 100
                                                                        : 0;
                                                                    return storagePercent > 0 ? (
                                                                        <div className="text-xs font-semibold text-foreground">
                                                                            {storagePercent.toFixed(0)}%
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-xs font-semibold text-foreground">
                                                                            {formatValue(viewNode.storageCapacity, formatStorageBytes)}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-xs font-medium text-foreground/60 uppercase tracking-wide mb-1">Storage</div>
                                                        {(() => {
                                                            const storageUsed = node.storageUsed;
                                                            return storageUsed && viewNode.storageCapacity ? (
                                                                <div className="text-xs text-muted-foreground">
                                                                    {formatValue(storageUsed, formatStorageBytes)} / {formatValue(viewNode.storageCapacity, formatStorageBytes)}
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-muted-foreground">Total Capacity</div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            ) : null}

                                            {/* Memory Circular Chart */}
                                            {node.ramTotal ? (
                                                <div className="flex flex-col items-center">
                                                    <div className="relative w-32 h-32 mb-3">
                                                        <svg className="transform -rotate-90 w-32 h-32">
                                                            <circle
                                                                cx="64"
                                                                cy="64"
                                                                r="54"
                                                                stroke="rgb(var(--muted))"
                                                                strokeWidth="8"
                                                                fill="none"
                                                            />
                                                            <circle
                                                                cx="64"
                                                                cy="64"
                                                                r="54"
                                                                stroke={nodeStats?.ramUtilization && nodeStats.ramUtilization > 80 ? '#ED1C24' : nodeStats?.ramUtilization && nodeStats.ramUtilization > 60 ? '#F0A741' : '#3F8277'}
                                                                strokeWidth="8"
                                                                fill="none"
                                                                strokeDasharray={`${2 * Math.PI * 54}`}
                                                                strokeDashoffset={2 * Math.PI * 54}
                                                                strokeLinecap="round"
                                                                style={{
                                                                    '--circumference': `${2 * Math.PI * 54}`,
                                                                    '--target-offset': `${nodeStats?.ramUtilization ? 2 * Math.PI * 54 - ((nodeStats.ramUtilization / 100) * 2 * Math.PI * 54) : 2 * Math.PI * 54}`,
                                                                    animation: nodeStats?.ramUtilization ? 'fillCircle 1s ease-out forwards' : 'none',
                                                                } as React.CSSProperties & { '--circumference': string; '--target-offset': string }}
                                                            />
                                                        </svg>
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="text-center">
                                                                <MemoryStick className="w-6 h-6 text-foreground/40 mx-auto mb-1" />
                                                                <div className="text-xs font-semibold text-foreground">
                                                                    {formatValue(nodeStats?.ramUtilization, (val) => `${val.toFixed(0)}%`)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-xs font-medium text-foreground/60 uppercase tracking-wide mb-1">Memory</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {formatValue(node.ramUsed, formatStorageBytes)} / {formatValue(node.ramTotal, formatStorageBytes)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Network */}
                                    <div className="card">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Network className="w-4 h-4 text-foreground/40" />
                                            <h2 className="text-base font-semibold text-foreground">Network</h2>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-foreground/60">Address</span>
                                                <span className="font-mono text-foreground/80">{formatValue(node.address, (addr) => addr.replace(':6000', ':9001'))}</span>
                                            </div>
                                            {node.rpcPort && (
                                                <div className="flex justify-between">
                                                    <span className="text-foreground/60">RPC Port</span>
                                                    <span className="font-mono text-foreground/80">{node.rpcPort}</span>
                                                </div>
                                            )}
                                            {viewNode.packetsReceived !== undefined && viewNode.packetsReceived !== null && (
                                                <div className="flex justify-between">
                                                    <span className="text-foreground/60">Packets Rx (Total)</span>
                                                    <span className="font-mono text-foreground/80">{viewNode.packetsReceived.toLocaleString()}</span>
                                                </div>
                                            )}
                                            {viewNode.packetsSent !== undefined && viewNode.packetsSent !== null && (
                                                <div className="flex justify-between">
                                                    <span className="text-foreground/60">Packets Tx (Total)</span>
                                                    <span className="font-mono text-foreground/80">{viewNode.packetsSent.toLocaleString()}</span>
                                                </div>
                                            )}
                                            {viewNode.activeStreams !== undefined && (
                                                <div className="flex justify-between">
                                                    <span className="text-foreground/60">Active Streams</span>
                                                    <span className="font-mono text-foreground/80">{viewNode.activeStreams}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Location / Ownership / Status Grid */}
                                <div className={`grid grid-cols-1 ${node.isRegistered ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3 sm:gap-4 mb-12`}>
                                    {/* Location */}
                                    <div className="card h-full">
                                        <div className="flex items-center gap-2 mb-3">
                                            <MapPin className="w-4 h-4 text-foreground/40" />
                                            <h2 className="text-base font-semibold text-foreground">Location Details</h2>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            {node.locationData?.country && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-foreground/60">Country</span>
                                                    <span className="text-foreground/80 flex items-center gap-2">
                                                        {node.locationData.countryCode && (
                                                            <span className="text-base">{getFlagForCountry(node.locationData.country, node.locationData.countryCode)}</span>
                                                        )}
                                                        {node.locationData.country}
                                                    </span>
                                                </div>
                                            )}
                                            {node.locationData?.city && (
                                                <div className="flex justify-between">
                                                    <span className="text-foreground/60">City</span>
                                                    <span className="text-foreground/80">{node.locationData.city}</span>
                                                </div>
                                            )}
                                            {getRegionName(node.locationData) && (
                                                <div className="flex justify-between">
                                                    <span className="text-foreground/60">Region</span>
                                                    <span className="text-foreground/80">{getRegionName(node.locationData)}</span>
                                                </div>
                                            )}
                                            {node.address && (
                                                <div className="flex justify-between">
                                                    <span className="text-foreground/60">Data Center</span>
                                                    <span className="text-foreground/80">{detectDataCenter(node.address.split(':')[0]) || '—'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ownership - Only show for registered nodes */}
                                    {node.isRegistered && (
                                        <div className="card h-full">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Server className="w-4 h-4 text-foreground/40" />
                                                <h2 className="text-base font-semibold text-foreground">Ownership</h2>
                                            </div>
                                            <div className="space-y-3 text-sm">
                                                {/* Manager (Buyer) */}
                                                <div>
                                                    <div className="text-foreground/40 text-xs uppercase font-semibold tracking-wider mb-1">Manager (Mainnet Buyer)</div>
                                                    <div className="flex items-center gap-2">
                                                        {node.managerWallet ? (
                                                            <>
                                                                <Link href={`/managers/${node.managerWallet}`} className="font-mono text-sm text-[#F0A741] hover:underline underline-offset-4 decoration-[#F0A741]/40">
                                                                    {node.managerWallet.slice(0, 6)}...{node.managerWallet.slice(-4)}
                                                                </Link>
                                                                <a href={`https://solscan.io/account/${node.managerWallet}`} target="_blank" rel="noopener noreferrer" className="text-foreground/20 hover:text-foreground/60 transition-colors">
                                                                    <ExternalLink className="w-3 h-3" />
                                                                </a>
                                                            </>
                                                        ) : (
                                                            <span className="text-foreground/40 italic">Unknown</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Registrar (Devnet) */}
                                                {node.registrarWallet && (
                                                    <div>
                                                        <div className="text-foreground/40 text-xs uppercase font-semibold tracking-wider mb-1">Registrar (Devnet)</div>
                                                        <div className="flex items-center gap-2">
                                                            <a href={`https://explorer.xandeum.com/address/${node.registrarWallet}`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-blue-400 hover:underline underline-offset-4 decoration-blue-400/40">
                                                                {node.registrarWallet.slice(0, 6)}...{node.registrarWallet.slice(-4)}
                                                            </a>
                                                            <a href={`https://explorer.xandeum.com/address/${node.registrarWallet}`} target="_blank" rel="noopener noreferrer" className="text-foreground/20 hover:text-foreground/60 transition-colors">
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                            <div className="text-xs bg-muted/40 px-1.5 py-0.5 rounded text-foreground/50">
                                                                {node.managerWallet === node.registrarWallet ? 'SAME AS BUYER' : 'REGISTRAR'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Status */}
                                    <div className="card h-full">
                                        <div className="flex items-center gap-2 mb-3">
                                            <CheckCircle2 className="w-4 h-4 text-foreground/40" />
                                            <h2 className="text-base font-semibold text-foreground">Status</h2>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-foreground/60">Registered</span>
                                                <div className="flex items-center gap-1.5">
                                                    {node.isRegistered || (node.balance && node.balance > 0) ? (
                                                        <>
                                                            <CheckCircle2 className="w-4 h-4 text-[#3F8277]" />
                                                            <span className="text-[#3F8277] font-medium">Yes</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-4 h-4 text-gray-400" />
                                                            <span className="text-gray-400">No</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {node.eraLabel && (
                                                <div className="flex justify-between">
                                                    <span className="text-foreground/60">Era</span>
                                                    <span className="text-[#F0A741] font-semibold">{node.eraLabel}</span>
                                                </div>
                                            )}
                                            {viewNode.credits !== undefined && viewNode.credits !== null && (
                                                <div className="flex justify-between">
                                                    <span className="text-foreground/60">Credits</span>
                                                    <span className="text-foreground/80 font-semibold">{viewNode.credits.toLocaleString()}</span>
                                                </div>
                                            )}
                                            {node.balance !== undefined && node.balance !== null && (
                                                <div className="flex justify-between">
                                                    <span className="text-foreground/60">Balance</span>
                                                    <BalanceDisplay
                                                        balance={node.balance}
                                                        className="text-sm font-mono"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Historical Data Section - Only for public nodes - Always show UI even when loading */}
                        {node.isPublic !== false && (() => {
                            const now = Date.now();
                            const timeRangeMs = {
                                '30m': 30 * 60 * 1000,
                                '1h': 60 * 60 * 1000,
                                '24h': 24 * 60 * 60 * 1000,
                                '1w': 7 * 24 * 60 * 60 * 1000,
                            };
                            const cutoffTime = now - timeRangeMs[timeRange];

                            // Client-side aggregation for "All IPs" view (activeIPIndex === -1)
                            let processedData = historicalData;
                            if (activeIPIndex === -1 && historicalData.length > 0) {
                                // Group by timestamp (bucket to nearest minute to align slightly offset snapshots)
                                const buckets: Record<number, any[]> = {};
                                historicalData.forEach(d => {
                                    // Round to nearest minute to catch snapshots that are slightly off
                                    const key = Math.floor(d.timestamp / 60000) * 60000;
                                    if (!buckets[key]) buckets[key] = [];
                                    buckets[key].push(d);
                                });

                                processedData = Object.keys(buckets).map(key => {
                                    const ts = parseInt(key);
                                    const points = buckets[ts];

                                    // Helpers
                                    const sum = (metric: string) => points.reduce((acc, p) => acc + (p[metric] || 0), 0);
                                    const avg = (metric: string) => {
                                        const validPoints = points.filter(p => p[metric] !== undefined && p[metric] !== null);
                                        if (validPoints.length === 0) return 0;
                                        return validPoints.reduce((acc, p) => acc + (p[metric] || 0), 0) / validPoints.length;
                                    };

                                    // Pick status from the first point, or 'online' if any are online
                                    const isAnyOnline = points.some(p => p.status === 'online');
                                    const isAnySyncing = points.some(p => p.status === 'syncing');
                                    const status = isAnyOnline ? 'online' : isAnySyncing ? 'syncing' : points[0].status;

                                    return {
                                        ...points[0], // Keep basic props from first point
                                        timestamp: ts,
                                        credits: sum('credits'),
                                        packetsReceived: sum('packetsReceived'),
                                        packetsSent: sum('packetsSent'),
                                        storageTotal: sum('storageTotal'),
                                        cpuPercent: avg('cpuPercent'),
                                        ramPercent: avg('ramPercent'),
                                        status: status
                                    };
                                });
                            }

                            const filteredData = processedData.length > 0
                                ? processedData.filter(d => d.timestamp >= cutoffTime)
                                : [];

                            return (
                                <div className="mb-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-[#F0A741]" />
                                            <h2 className="text-lg font-semibold text-foreground">Historical Performance</h2>
                                        </div>
                                        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                                            {(['30m', '1h', '24h', '1w'] as const).map((range) => (
                                                <button
                                                    key={range}
                                                    onClick={() => setTimeRange(range)}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${timeRange === range
                                                        ? 'bg-[#F0A741] text-black'
                                                        : 'text-foreground/60 hover:text-foreground'
                                                        }`}
                                                >
                                                    {range === '30m' ? '30m' : range === '1h' ? '1h' : range === '24h' ? '24h' : '1w'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Status over time */}
                                        <div className="card">
                                            <HistoricalLineChart
                                                title="pNode Status"
                                                data={filteredData.map(d => ({
                                                    timestamp: d.timestamp,
                                                    value: d.status === 'online' ? 2 : d.status === 'syncing' ? 1 : 0,
                                                    label: d.status || 'offline',
                                                }))}
                                                height={250}
                                                yDomain={[0, 2]}
                                                strokeColor="#F0A741"
                                                yTicks={[0, 1, 2]}
                                                yTickFormatter={(v) => {
                                                    if (v === 2) return 'Online';
                                                    if (v === 1) return 'Syncing';
                                                    return 'Offline';
                                                }}
                                                tooltipFormatter={(d) => {
                                                    const statusColors: Record<string, string> = {
                                                        'online': '#3F8277',
                                                        'syncing': '#F0A741',
                                                        'offline': '#6B7280',
                                                    };
                                                    return (
                                                        <div className="text-xs">
                                                            <div className="font-semibold text-foreground mb-1">
                                                                {new Date(d.timestamp).toLocaleString()}
                                                            </div>
                                                            <div style={{ color: statusColors[d.label] || '#9CA3AF', textTransform: 'capitalize' }}>
                                                                {d.label}
                                                            </div>
                                                        </div>
                                                    );
                                                }}
                                                headerContent={
                                                    loadingHistory ? (
                                                        <span className="text-xs text-muted-foreground">Loading historical data...</span>
                                                    ) : filteredData.length > 0 ? (
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                            <div className="flex items-center gap-1">
                                                                <div className="w-2 h-2 rounded-full bg-[#3F8277]"></div>
                                                                <span>Online</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <div className="w-2 h-2 rounded-full bg-[#F0A741]"></div>
                                                                <span>Syncing</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                                                                <span>Offline</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">No data available</span>
                                                    )
                                                }
                                            />
                                        </div>

                                        {/* CPU & RAM over time - Always show, empty axes when no data */}
                                        <div className="card">
                                            <HistoricalLineChart
                                                title="Resource Utilization"
                                                data={filteredData.map(d => ({
                                                    timestamp: d.timestamp,
                                                    cpu: d.cpuPercent,
                                                    ram: d.ramPercent,
                                                }))}
                                                height={250}
                                                yDomain={[0, 100]}
                                                strokeColor="#F0A741"
                                                yLabel="Usage (%)"
                                                multiLine={[
                                                    { key: 'cpu', color: '#F0A741', label: 'CPU' },
                                                    { key: 'ram', color: '#3F8277', label: 'RAM' },
                                                ]}
                                                tooltipFormatter={(d) => (
                                                    <div className="text-xs">
                                                        <div className="font-semibold text-foreground mb-1">
                                                            {new Date(d.timestamp).toLocaleString()}
                                                        </div>
                                                        <div className="text-foreground/80 space-y-1">
                                                            {d.cpu !== undefined && d.cpu !== null && (
                                                                <div>CPU: {d.cpu.toFixed(1)}%</div>
                                                            )}
                                                            {d.ram !== undefined && d.ram !== null && (
                                                                <div>RAM: {d.ram.toFixed(1)}%</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                headerContent={
                                                    loadingHistory ? (
                                                        <span className="text-xs text-muted-foreground">Loading historical data...</span>
                                                    ) : filteredData.length > 0 ? (
                                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                            {(() => {
                                                                const cpuData = filteredData.filter(d => d.cpuPercent !== undefined && d.cpuPercent !== null && !isNaN(d.cpuPercent));
                                                                if (cpuData.length === 0) return null;
                                                                const cpuAvg = cpuData.reduce((sum, d) => sum + (d.cpuPercent || 0), 0) / cpuData.length;
                                                                if (isNaN(cpuAvg)) return null;
                                                                return (
                                                                    <div className="flex items-center gap-1">
                                                                        <Cpu className="w-3.5 h-3.5" />
                                                                        <span>CPU: <span className="text-foreground font-semibold">{cpuAvg.toFixed(1)}%</span></span>
                                                                    </div>
                                                                );
                                                            })()}
                                                            {(() => {
                                                                const ramData = filteredData.filter(d => d.ramPercent !== undefined && d.ramPercent !== null && !isNaN(d.ramPercent));
                                                                if (ramData.length === 0) return null;
                                                                const ramAvg = ramData.reduce((sum, d) => sum + (d.ramPercent || 0), 0) / ramData.length;
                                                                if (isNaN(ramAvg)) return null;
                                                                return (
                                                                    <div className="flex items-center gap-1">
                                                                        <MemoryStick className="w-3.5 h-3.5" />
                                                                        <span>RAM: <span className="text-foreground font-semibold">{ramAvg.toFixed(1)}%</span></span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">No data available</span>
                                                    )
                                                }
                                            />
                                        </div>

                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Packets over time - Always show, empty axes when no data */}
                                        {(() => {
                                            const sorted = [...filteredData].sort((a, b) => a.timestamp - b.timestamp);
                                            const FIVE_MINUTES_MS = 5 * 60 * 1000;

                                            const packetRateData = sorted.map((current, index) => {
                                                let previousIndex = index - 1;
                                                let previous = sorted[previousIndex];

                                                const targetTime = current.timestamp - FIVE_MINUTES_MS;
                                                for (let i = index - 1; i >= 0; i--) {
                                                    if (sorted[i].timestamp <= targetTime) {
                                                        previous = sorted[i];
                                                        previousIndex = i;
                                                        break;
                                                    }
                                                }

                                                let rxRate = 0;
                                                let txRate = 0;

                                                if (previous && previousIndex >= 0) {
                                                    const timeDiff = (current.timestamp - previous.timestamp) / 1000;
                                                    if (timeDiff > 0) {
                                                        const rxDiff = (current.packetsReceived || 0) - (previous.packetsReceived || 0);
                                                        const txDiff = (current.packetsSent || 0) - (previous.packetsSent || 0);

                                                        rxRate = Math.max(0, rxDiff / timeDiff);
                                                        txRate = Math.max(0, txDiff / timeDiff);
                                                    }
                                                }

                                                const totalRate = rxRate + txRate;

                                                return {
                                                    timestamp: current.timestamp,
                                                    value: totalRate,
                                                    _rxRate: rxRate,
                                                    _txRate: txRate,
                                                    _originalReceived: current.packetsReceived,
                                                    _originalSent: current.packetsSent,
                                                };
                                            });

                                            if (packetRateData.length > 0 && packetRateData[0].value === 0) {
                                                const firstNonZero = packetRateData.find(d => d.value > 0);
                                                if (firstNonZero) {
                                                    packetRateData[0].value = firstNonZero.value;
                                                    packetRateData[0]._rxRate = firstNonZero._rxRate;
                                                    packetRateData[0]._txRate = firstNonZero._txRate;
                                                }
                                            }

                                            const maxRate = Math.max(
                                                ...packetRateData.map(d => d.value || 0)
                                            );

                                            return (
                                                <div className="card">
                                                    <HistoricalLineChart
                                                        title="Network Activity"
                                                        data={packetRateData}
                                                        height={250}
                                                        yDomain={[0, maxRate * 1.1 || 1]}
                                                        strokeColor="#3F8277"
                                                        yLabel="Packets/s"
                                                        yTickFormatter={(v) => formatNumber(v)}
                                                        tooltipFormatter={(d) => (
                                                            <div className="text-xs">
                                                                <div className="font-semibold text-foreground mb-1">
                                                                    {new Date(d.timestamp).toLocaleString()}
                                                                </div>
                                                                <div className="text-foreground/80 space-y-1">
                                                                    <div>Total Rate: <span className="font-semibold">{formatNumber(d.value || 0)}/s</span></div>
                                                                    {d._rxRate !== undefined && d._rxRate !== null && (
                                                                        <div className="text-foreground/60">Rx: {formatNumber(d._rxRate)}/s</div>
                                                                    )}
                                                                    {d._txRate !== undefined && d._txRate !== null && (
                                                                        <div className="text-foreground/60">Tx: {formatNumber(d._txRate)}/s</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        headerContent={
                                                            loadingHistory ? (
                                                                <span className="text-xs text-muted-foreground">Loading historical data...</span>
                                                            ) : packetRateData.length > 0 ? (
                                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                                    <span>Total packet rate (Rx + Tx) calculated over 5-minute windows</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">No data available</span>
                                                            )
                                                        }
                                                    />
                                                </div>
                                            );
                                        })()}

                                        {/* Credits over time - Always show, empty axes when no data */}
                                        {(() => {
                                            const sorted = [...filteredData].sort((a, b) => a.timestamp - b.timestamp);
                                            const FIVE_MINUTES_MS = 5 * 60 * 1000;

                                            const creditsData = sorted.map((current, index) => {
                                                let previousIndex = index - 1;
                                                let previous = sorted[previousIndex];

                                                const targetTime = current.timestamp - FIVE_MINUTES_MS;
                                                for (let i = index - 1; i >= 0; i--) {
                                                    if (sorted[i].timestamp <= targetTime) {
                                                        previous = sorted[i];
                                                        previousIndex = i;
                                                        break;
                                                    }
                                                }

                                                let creditsEarned = 0;
                                                let previousCredits = undefined;
                                                let shouldFilter = false;

                                                if (previous && previousIndex >= 0) {
                                                    const prevCredits = previous.credits;
                                                    const currCredits = current.credits;

                                                    if (prevCredits !== undefined && prevCredits !== null &&
                                                        currCredits !== undefined && currCredits !== null) {
                                                        const creditsDiff = currCredits - prevCredits;
                                                        creditsEarned = creditsDiff;
                                                        previousCredits = prevCredits;

                                                        // Filter out anomalous drops (likely missing data)
                                                        // If credits dropped by more than 90%, it's likely missing data - filter out this point
                                                        if (prevCredits > 0 && currCredits >= 0) {
                                                            const dropPercentage = ((prevCredits - currCredits) / prevCredits) * 100;
                                                            if (dropPercentage > 90) {
                                                                shouldFilter = true;
                                                            }
                                                        }
                                                    }
                                                }

                                                return {
                                                    timestamp: current.timestamp,
                                                    value: creditsEarned,
                                                    _credits: current.credits,
                                                    _previousCredits: previousCredits,
                                                    _originalCredits: current.credits,
                                                    _shouldFilter: shouldFilter,
                                                };
                                            }).filter(d => !d._shouldFilter);

                                            // Only add a current point if the gap is reasonable (5-30 minutes)
                                            // This prevents huge spikes from accumulating changes over long periods
                                            if (creditsData.length > 0) {
                                                const lastPoint = creditsData[creditsData.length - 1];
                                                const lastPointTimestamp = lastPoint.timestamp;
                                                const currentTimestamp = Date.now();
                                                const timeSinceLastPoint = currentTimestamp - lastPointTimestamp;
                                                const currentTotalCredits = viewNode.credits ?? 0;

                                                // Only add a new point if it's been between 5 minutes and 30 minutes since the last point
                                                // This ensures we show reasonable 5-minute windows, not accumulated changes over hours
                                                if (timeSinceLastPoint >= FIVE_MINUTES_MS && timeSinceLastPoint <= 30 * 60 * 1000) {
                                                    const lastPointTotal = lastPoint._credits ?? 0;
                                                    const creditsEarnedSinceLastPoint = currentTotalCredits - lastPointTotal;

                                                    creditsData.push({
                                                        timestamp: currentTimestamp,
                                                        value: creditsEarnedSinceLastPoint,
                                                        _credits: currentTotalCredits,
                                                        _previousCredits: lastPointTotal,
                                                        _originalCredits: currentTotalCredits,
                                                        _shouldFilter: false,
                                                    });
                                                } else if (timeSinceLastPoint < 60000) {
                                                    // Gap is too short (< 1 minute), update the last point's total and RELATIVE delta for accuracy
                                                    lastPoint._credits = currentTotalCredits;
                                                    if (lastPoint._previousCredits !== undefined && lastPoint._previousCredits !== null) {
                                                        lastPoint.value = currentTotalCredits - lastPoint._previousCredits;
                                                    }
                                                }
                                            } else if (viewNode.credits !== undefined && viewNode.credits !== null) {
                                                // No data points yet, add initial point
                                                creditsData.push({
                                                    timestamp: Date.now(),
                                                    value: 0, // No delta for initial point
                                                    _credits: viewNode.credits,
                                                    _previousCredits: undefined,
                                                    _originalCredits: viewNode.credits,
                                                    _shouldFilter: false,
                                                });
                                            }

                                            const minCredits = Math.min(
                                                ...creditsData.map(d => d.value || 0),
                                                0
                                            );
                                            const maxCredits = Math.max(
                                                ...creditsData.map(d => d.value || 0),
                                                10
                                            );

                                            return (
                                                <div className="card">
                                                    <HistoricalLineChart
                                                        title="Credits Earned / Lost"
                                                        data={creditsData}
                                                        height={250}
                                                        yDomain={[minCredits * 1.1 || -10, maxCredits * 1.1 || 10]}
                                                        strokeColor="#F0A741"
                                                        yLabel="Credits"
                                                        yTickFormatter={(v) => {
                                                            const formatted = formatCredits(v);
                                                            return v > 0 ? `+${formatted}` : formatted;
                                                        }}
                                                        tooltipFormatter={(d) => {
                                                            const value = d.value || 0;
                                                            const isPositive = value > 0;
                                                            const isNegative = value < 0;
                                                            // If this is the most recent point, use current total from node for accuracy
                                                            const isMostRecent = creditsData.length > 0 && d.timestamp === creditsData[creditsData.length - 1].timestamp;
                                                            const displayTotal = isMostRecent ? (viewNode.credits ?? 0) : (d._credits ?? 0);
                                                            return (
                                                                <div className="text-xs">
                                                                    <div className="font-semibold text-foreground mb-1">
                                                                        {new Date(d.timestamp).toLocaleString()}
                                                                    </div>
                                                                    <div className="text-foreground/80 space-y-1">
                                                                        <div className={isNegative ? 'text-red-400' : isPositive ? 'text-green-400' : ''}>
                                                                            {isNegative ? 'Credits Lost: ' : 'Credits Earned: '}
                                                                            <span className="font-semibold">
                                                                                {isPositive ? '+' : ''}{formatCredits(value)}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-foreground/60">Total Credits: {displayTotal.toLocaleString()}</div>
                                                                        {d._previousCredits !== undefined && d._previousCredits !== null && (
                                                                            <div className="text-foreground/60 text-[10px]">Previous: {d._previousCredits.toLocaleString()}</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }}
                                                        headerContent={
                                                            loadingHistory ? (
                                                                <span className="text-xs text-muted-foreground">Loading historical data...</span>
                                                            ) : creditsData.length > 0 ? (
                                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                                    <span>Credits change (earned/lost) calculated over 5-minute windows</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">No data available</span>
                                                            )
                                                        }
                                                    />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })()}

                        {!loadingHistory && historicalData.length === 0 && node.isPublic !== false && (
                            <div className="card mb-6">
                                <p className="text-sm text-foreground/60">No historical data available for this node</p>
                            </div>
                        )}

                        {node._statsError && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                                <p className="text-yellow-400 font-medium text-sm mb-1">Stats Unavailable</p>
                                <p className="text-xs text-foreground/60">
                                    {node._statsError}
                                </p>
                            </div>
                        )}

                        <div className="mt-8 h-[500px] overflow-hidden">
                            <ActivityLogList
                                pubkey={viewNode.pubkey || viewNode.publicKey}
                                address={activeIPIndex !== -1 ? viewNode.address : undefined}
                                limit={20}
                            />
                        </div>
                    </div>
                </div >
            </main >
        </div >
    );
}

export default function NodeDetailPage() {
    return (
        <Suspense fallback={null}>
            <NodeDetailContent />
        </Suspense>
    );
}
