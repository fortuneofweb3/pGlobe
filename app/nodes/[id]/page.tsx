'use client';

import React, { useMemo, useState, useEffect, Suspense, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PNode } from '@/lib/types/pnode';
import { Copy, Check, RefreshCw, HardDrive, Cpu, MemoryStick, Network, MapPin, Clock, CheckCircle2, XCircle, TrendingUp, Server, ArrowLeft, Activity, Award } from 'lucide-react';
import { ChartSkeleton, MapSkeleton, CardSkeleton } from '@/components/Skeletons';
import { detectDataCenter, getRegionName } from '@/lib/utils/dataCenter';
import { formatBytes, formatStorageBytes } from '@/lib/utils/storage';
import { getFlagForCountry } from '@/lib/utils/country-flags';
import { useNodes } from '@/lib/context/NodesContext';
import BalanceDisplay from '@/components/BalanceDisplay';
import { measureNodeLatency, getCachedLatency } from '@/lib/utils/client-latency';
import { scaleTime, scaleLinear } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { Group } from '@visx/group';
import { Circle } from '@visx/shape';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { curveMonotoneX } from '@visx/curve';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { timeFormat } from 'd3-time-format';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import Header from '@/components/Header';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet components to avoid SSR issues - import from single module
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false, loading: () => <div className="h-full w-full bg-muted/20 rounded-lg animate-pulse" /> }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
);

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

const Tooltip = dynamic(
  () => import('react-leaflet').then((mod) => mod.Tooltip),
  { ssr: false }
);

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
  data: Array<{ timestamp: number; value?: number; label?: string; [key: string]: any }>;
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
  const margin = { top: 30, right: 30, left: 60, bottom: 70 };
  const svgRef = useRef<SVGSVGElement>(null);
  const hasAnimatedRef = useRef(false);

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

  // Animate paths on mount and when data changes
  useEffect(() => {
    if (!svgRef.current || chartData.length === 0) return;

    // Reset animation flag when data changes
    hasAnimatedRef.current = false;

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
              svgPath.style.transition = 'stroke-dashoffset 1.5s ease-out';
              svgPath.style.strokeDashoffset = '0';
            });
          }
        } catch (e) {
          // getTotalLength might fail on some elements, skip them
        }
      });

      hasAnimatedRef.current = true;

      // Clean up after animation
      const cleanupTimer = setTimeout(() => {
        paths.forEach((pathEl: Element) => {
          const svgPath = pathEl as SVGPathElement;
          svgPath.style.strokeDasharray = 'none';
          svgPath.style.strokeDashoffset = '0';
          svgPath.style.transition = '';
        });
      }, 1600);

      return () => clearTimeout(cleanupTimer);
    }, 100);

    return () => clearTimeout(timer);
  }, [chartData, data]);
  
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

                    {multiLine ? (
                      multiLine.map((line) => {
                        const validData = chartData.filter(d => {
                          const val = d[line.key];
                          return val !== undefined && val !== null && !isNaN(val);
                        });
                        return (
                          <LinePath
                            key={line.key}
                            data={validData}
                            x={(d) => xScale(d.timestamp)}
                            y={(d) => yScale(d[line.key] ?? 0)}
                            stroke={line.color}
                            strokeWidth={3}
                            curve={curveMonotoneX}
                          />
                        );
                      })
                    ) : (
                      (() => {
                        const validData = chartData.filter(d => {
                          const val = d.value;
                          return val !== undefined && val !== null && !isNaN(val);
                        });
                        return (
                          <LinePath
                            data={validData}
                            x={(d) => xScale(d.timestamp)}
                            y={(d) => yScale(d.value ?? 0)}
                            stroke={strokeColor}
                            strokeWidth={3}
                            curve={curveMonotoneX}
                          />
                        );
                      })()
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
      </div>
    </div>
  );
}

function NodeDetailContent() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;
  const { nodes: allNodes, refreshNodes, lastUpdate, loading } = useNodes();
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
  }, []);

  const node = useMemo(() => {
    return allNodes.find(n => n.id === nodeId || n.pubkey === nodeId || n.publicKey === nodeId);
  }, [allNodes, nodeId]);

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

        const endTime = Date.now();
        const startTime = endTime - (7 * 24 * 60 * 60 * 1000);

        const url = `/api/history?nodeId=${encodeURIComponent(pubkey)}&startTime=${startTime}&endTime=${endTime}`;

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
  }, [node?.pubkey || node?.publicKey || node?.id]);

  const nodeStats = useMemo(() => {
    if (!node) return null;

    const networkAvgCpu = allNodes.length > 0
      ? allNodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).reduce((sum, n) => sum + (n.cpuPercent || 0), 0) / allNodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).length
      : 0;

    const ramUtilization = node.ramTotal && node.ramUsed
      ? (node.ramUsed / node.ramTotal) * 100
      : 0;

    return {
      networkAvgCpu,
      ramUtilization,
    };
  }, [node, allNodes]);

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
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">Offline</span>;
  };

  // Show loading skeleton when loading or no data
  const isLoading = loading || (allNodes.length === 0);
  
  if (isLoading && !node && allNodes.length === 0) {
    return (
      <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
        <Header activePage="nodes" nodeCount={0} lastUpdate={null} loading={true} onRefresh={() => {}} />
        <main className="flex-1 overflow-hidden">
          <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {/* Breadcrumb */}
              <div className="mb-4 sm:mb-6 flex items-center gap-2 text-sm text-foreground/60">
                <Link href="/nodes" className="hover:text-foreground transition-colors">Nodes</Link>
                <span>/</span>
                <span className="h-4 w-48 bg-muted/40 rounded animate-pulse inline-block font-mono" />
              </div>

              {/* Header Section */}
              <div className="card mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted/40 text-foreground/60 border border-border/30">
                      <span className="h-3 w-12 bg-muted/40 rounded animate-pulse inline-block" />
                    </span>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                        <span className="h-7 w-64 bg-muted/40 rounded animate-pulse inline-block" />
                      </h1>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-foreground/60">Version</span>
                        <span className="h-4 w-20 bg-muted/40 rounded animate-pulse inline-block" />
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

          {/* 2D Map Section */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-foreground/40" />
                <h2 className="text-base font-semibold text-foreground">Location</h2>
              </div>
              <span className="text-xs text-foreground/60">
                <span className="h-4 w-16 bg-muted/40 rounded animate-pulse inline-block" /> other nodes on map
              </span>
            </div>
            <div className="h-[300px] w-full bg-muted/20 rounded-lg animate-pulse" />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card-stat">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">
                    <span className="h-3 w-16 bg-muted/30 rounded animate-pulse inline-block" />
                  </span>
                </div>
                <div className="h-8 w-24 bg-muted/40 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-4 w-4 bg-muted/30 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="flex justify-between">
                      <div className="h-4 w-24 bg-muted/20 rounded animate-pulse" />
                      <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Historical Data Section */}
          <div className="card mb-6" style={{ padding: '1.5rem' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="h-4 w-48 bg-muted/30 rounded animate-pulse" />
              <div className="h-8 w-32 bg-muted/30 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-4">
                  <div className="h-4 w-32 bg-muted/30 rounded animate-pulse" />
                  <div className="h-[250px] w-full bg-muted/10 rounded-lg animate-pulse" />
                </div>
              ))}
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
        <Header activePage="nodes" nodeCount={allNodes.length} lastUpdate={lastUpdate} loading={loading} onRefresh={handleRefresh} />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
          <div className="text-center space-y-4">
            <p className="text-lg text-foreground/60">Node not found</p>
            <Link href="/nodes" className="inline-flex items-center gap-2 text-[#F0A741] hover:text-[#F0A741]/80 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Nodes
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
        <Header activePage="nodes" nodeCount={allNodes.length} lastUpdate={lastUpdate} loading={loading} onRefresh={handleRefresh} />
        <main className="flex-1 overflow-hidden">
          <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {/* Breadcrumb */}
              <div className="mb-4 sm:mb-6 flex items-center gap-2 text-sm text-foreground/60">
                <Link href="/nodes" className="hover:text-foreground transition-colors">Nodes</Link>
                <span>/</span>
                <span className="h-4 w-48 bg-muted/40 rounded animate-pulse inline-block font-mono" />
              </div>

              {/* Header Section */}
              <div className="card mb-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted/40 text-foreground/60 border border-border/30">
                          <span className="h-3 w-12 bg-muted/40 rounded animate-pulse inline-block" />
                        </span>
                        <div>
                          <h1 className="text-xl sm:text-2xl font-bold font-mono text-foreground">
                            <span className="h-7 w-64 bg-muted/40 rounded animate-pulse inline-block" />
                          </h1>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-foreground/60">Version</span>
                            <span className="h-4 w-20 bg-muted/40 rounded animate-pulse inline-block" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="card-stat">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">
                        <span className="h-3 w-16 bg-muted/30 rounded animate-pulse inline-block" />
                      </span>
                    </div>
                    <div className="h-8 w-24 bg-muted/40 rounded animate-pulse" />
                  </div>
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

  const pubkey = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '';
  const gossipAddress = node.address || '—';

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
      <Header activePage="nodes" nodeCount={allNodes.length} lastUpdate={lastUpdate} loading={loading} onRefresh={handleRefresh} />

      <main className="flex-1 overflow-hidden">
        <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Back to Nodes */}
            <Link href="/nodes" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Nodes
            </Link>

            {/* Page Header */}
            <div className="mb-6">
              {/* Title and Status Row */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    {getStatusBadge(node.status)}
                    {node.version && node.version.includes('-trynet') && (
                      <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium">
                        TRYNET
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <Server className="w-6 h-6 text-[#F0A741]" />
                    <h1 className="text-2xl sm:text-3xl font-bold font-mono text-foreground">
                      {gossipAddress}
                    </h1>
                  </div>

                  {node.version && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-foreground/60">Version</span>
                      <span className="font-semibold text-foreground">{node.version}</span>
                    </div>
                  )}
                </div>

                {/* Quick Stats - Inline */}
                <div className="hidden lg:flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-foreground/60 mb-1">Uptime</div>
                    <div className="text-lg font-bold text-foreground">{formatUptime(node.uptime)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-foreground/60 mb-1">Latency</div>
                    <div className="text-lg font-bold text-foreground">
                      {nodeLatency !== null && nodeLatency !== undefined
                          ? `${nodeLatency.toFixed(0)}ms`
                          : measuringLatency
                          ? <span className="text-sm text-muted-foreground">...</span>
                          : <span className="text-sm text-muted-foreground">N/A</span>
                        }
                    </div>
                  </div>
                  {/* Refresh button */}
                  <button
                    onClick={handleRefresh}
                    disabled={refreshingStats}
                    className="p-2 hover:bg-muted/40 rounded-lg transition-colors disabled:opacity-50 border border-border/60"
                    title="Refresh Stats"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshingStats ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Public Key Row */}
              <div className="flex items-center gap-3 pb-4 border-b border-border/40">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-foreground/60 uppercase tracking-wide mb-1">Public Key</div>
                  <p className="text-sm font-mono text-foreground/80 truncate">{pubkey}</p>
                </div>
                <button
                  onClick={async () => {
                    if (pubkey) {
                      await navigator.clipboard.writeText(pubkey);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="p-2 hover:bg-muted/40 rounded transition-colors border border-border/60 shrink-0"
                  title="Copy Public Key"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-[#3F8277]" />
                  ) : (
                    <Copy className="w-4 h-4 text-foreground/60" />
                  )}
                </button>
              </div>
            </div>

        {/* 2D Map Section */}
        {node.locationData && node.locationData.lat && node.locationData.lon && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-foreground/40" />
                <h2 className="text-base font-semibold text-foreground">Location</h2>
              </div>
              {(() => {
                if (!node.locationData?.lat || !node.locationData?.lon) return null;
                const nodeLat = node.locationData.lat;
                const nodeLon = node.locationData.lon;
                const nearbyCount = allNodes.filter((n) => {
                  if (!n.locationData?.lat || !n.locationData?.lon || n.id === node.id) return false;
                  const latDiff = Math.abs(n.locationData.lat - nodeLat);
                  const lonDiff = Math.abs(n.locationData.lon - nodeLon);
                  const kmLat = latDiff * 111;
                  const kmLon = lonDiff * 111 * Math.cos(nodeLat * Math.PI / 180);
                  const distance = Math.sqrt(kmLat * kmLat + kmLon * kmLon);
                  return distance < 50;
                }).length;
                return nearbyCount > 0 && (
                  <span className="text-xs text-foreground/60">
                    {nearbyCount} nearby node{nearbyCount !== 1 ? 's' : ''}
                  </span>
                );
              })()}
            </div>
            <div className="h-[300px] w-full rounded-lg overflow-hidden border border-border/40 relative">
              <style jsx global>{`
                .leaflet-container .leaflet-control-attribution {
                  display: none !important;
                }
                .leaflet-container a.leaflet-popup-close-button {
                  color: #fff;
                }
                .leaflet-popup-content-wrapper {
                  background: rgb(15, 15, 15);
                  color: #fff;
                  border: 1px solid rgb(40, 40, 40);
                }
                .leaflet-popup-tip {
                  background: rgb(15, 15, 15);
                }
                .leaflet-container {
                  background: #000;
                }
                .custom-pin-icon {
                  background: transparent !important;
                  border: none !important;
                }
              `}</style>
              {isClient && node.locationData?.lat && node.locationData?.lon ? (
                <MapContainer
                  key={`map-${node.id}-${node.locationData.lat}-${node.locationData.lon}`}
                  center={[node.locationData.lat, node.locationData.lon]}
                  zoom={node.locationData.city ? 10 : 5}
                  scrollWheelZoom={true}
                  style={{ height: '100%', width: '100%' }}
                  className="z-0"
                  attributionControl={false}
                >
                  <TileLayer
                    attribution=""
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    subdomains="abcd"
                    maxZoom={20}
                  />
                  {(() => {
                    if (!node.locationData?.lat || !node.locationData?.lon) return null;

                    const nodeLat = node.locationData.lat;
                    const nodeLon = node.locationData.lon;
                    
                    // Find all other nodes with location data
                    const otherNodes = allNodes.filter((n) => {
                      if (!n.locationData?.lat || !n.locationData?.lon) return false;
                      if (n.id === node.id) return false;
                      return true;
                    });
                    
                    const statusColors = {
                      online: '#3F8277',
                      syncing: '#F0A741',
                      offline: '#ED1C24',
                    };
                    
                    // Create custom pin icon for main node using L.divIcon
                    const createPinIcon = (color: string) => {
                      if (typeof window === 'undefined') return undefined;
                      const L = (window as any).L;
                      if (!L) return undefined;

                      return L.divIcon({
                        html: `
                          <div style="position: relative; width: 32px; height: 40px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 24 30" fill="none">
                              <path d="M12 0C7.03 0 3 4.03 3 9c0 5.25 9 21 9 21s9-15.75 9-21c0-4.97-4.03-9-9-9zm0 12.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
                            </svg>
                            <div style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); width: 7px; height: 7px; background: white; border-radius: 50%;"></div>
                          </div>
                        `,
                        className: 'custom-pin-icon',
                        iconSize: [32, 40],
                        iconAnchor: [16, 40],
                        popupAnchor: [0, -40]
                      });
                    };

                    const pinColor = statusColors[node.status || 'offline'] || statusColors.offline;
                    const pinIcon = createPinIcon(pinColor);

                    return (
                      <>
                        {/* Main node marker with pin icon */}
                        {pinIcon ? (
                          <Marker
                            position={[node.locationData.lat, node.locationData.lon]}
                            icon={pinIcon}
                          >
                            <Popup>
                              <div className="text-sm">
                                <div className="font-semibold mb-2 text-[#F0A741]">📍 Current Node</div>
                                <div className="font-semibold mb-2">{node.locationData.city || 'Unknown'}, {node.locationData.country || 'Unknown'}</div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {node.locationData.lat.toFixed(4)}, {node.locationData.lon.toFixed(4)}
                                </div>
                                <div className="mt-2 text-xs">
                                  <strong>Status:</strong> <span className="capitalize">{node.status || 'offline'}</span>
                                </div>
                                {node.address && (
                                  <div className="mt-1 text-xs font-mono">{node.address}</div>
                                )}
                              </div>
                            </Popup>
                          </Marker>
                        ) : (
                          <CircleMarker
                            center={[node.locationData.lat, node.locationData.lon]}
                            radius={12}
                            pathOptions={{
                              fillColor: statusColors[node.status || 'offline'] || statusColors.offline,
                              fillOpacity: 0.8,
                              color: '#fff',
                              weight: 2,
                            }}
                          >
                            <Popup>
                              <div className="text-sm">
                                <div className="font-semibold mb-2 text-[#F0A741]">📍 Current Node</div>
                                <div className="font-semibold mb-2">{node.locationData.city || 'Unknown'}, {node.locationData.country || 'Unknown'}</div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {node.locationData.lat.toFixed(4)}, {node.locationData.lon.toFixed(4)}
                                </div>
                                <div className="mt-2 text-xs">
                                  <strong>Status:</strong> <span className="capitalize">{node.status || 'offline'}</span>
                                </div>
                                {node.address && (
                                  <div className="mt-1 text-xs font-mono">{node.address}</div>
                                )}
                              </div>
                            </Popup>
                          </CircleMarker>
                        )}
                        
                        {/* Other nodes */}
                        {otherNodes.map((nearbyNode) => {
                          const status = nearbyNode.status || 'offline';
                          const color = statusColors[status] || statusColors.offline;
                          
                          if (!nearbyNode.locationData?.lat || !nearbyNode.locationData?.lon) return null;
                          
                          return (
                            <CircleMarker
                              key={nearbyNode.id}
                              center={[nearbyNode.locationData.lat, nearbyNode.locationData.lon]}
                              radius={8}
                              pathOptions={{
                                fillColor: color,
                                fillOpacity: 0.7,
                                color: '#fff',
                                weight: 1.5,
                              }}
                            >
                              <Popup>
                                <div className="text-sm">
                                  <div className="font-semibold mb-2">
                                    {nearbyNode.locationData.city || 'Unknown'}, {nearbyNode.locationData.country || 'Unknown'}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">
                                    {nearbyNode.locationData.lat.toFixed(4)}, {nearbyNode.locationData.lon.toFixed(4)}
                                  </div>
                                  <div className="mt-2 text-xs">
                                    <strong>Status:</strong> <span className="capitalize">{status}</span>
                                  </div>
                                  {nearbyNode.address && (
                                    <div className="mt-1 text-xs font-mono">{nearbyNode.address}</div>
                                  )}
                                  <Link
                                    href={`/nodes/${encodeURIComponent(nearbyNode.id || nearbyNode.pubkey || nearbyNode.address?.split(':')[0] || '')}`}
                                    className="mt-2 inline-block text-xs text-[#F0A741] hover:text-[#F0A741]/80 transition-colors"
                                  >
                                    View Details →
                                  </Link>
                                </div>
                              </Popup>
                            </CircleMarker>
                          );
                        })}
                      </>
                    );
                  })()}
                </MapContainer>
              ) : (
                <MapSkeleton height={300} />
              )}
            </div>
          </div>
        )}

        {/* Performance Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Resource Usage Card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-[#F0A741]" />
              <h3 className="text-sm font-semibold text-foreground">Resource Usage</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-foreground/60" />
                  <span className="text-sm text-foreground/80">CPU</span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {formatValue(node.cpuPercent, (val) => `${val.toFixed(1)}%`)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-foreground/60" />
                  <span className="text-sm text-foreground/80">RAM</span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {formatValue(nodeStats?.ramUtilization, (val) => `${val.toFixed(1)}%`)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-foreground/60" />
                  <span className="text-sm text-foreground/80">Storage</span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {formatValue(node.storageCapacity, formatStorageBytes)}
                </span>
              </div>
            </div>
          </div>

          {/* Network Activity Card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Network className="w-4 h-4 text-[#3F8277]" />
              <h3 className="text-sm font-semibold text-foreground">Network Activity</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <span className="text-sm text-foreground/80">Packets Rx</span>
                <span className="text-lg font-bold font-mono text-foreground">
                  {node.packetsReceived !== undefined && node.packetsReceived !== null
                    ? formatNumber(node.packetsReceived)
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <span className="text-sm text-foreground/80">Packets Tx</span>
                <span className="text-lg font-bold font-mono text-foreground">
                  {node.packetsSent !== undefined && node.packetsSent !== null
                    ? formatNumber(node.packetsSent)
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <span className="text-sm text-foreground/80">Active Streams</span>
                <span className="text-lg font-bold font-mono text-foreground">
                  {node.activeStreams !== undefined ? node.activeStreams : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Status & Credits Card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[#F0A741]" />
              <h3 className="text-sm font-semibold text-foreground">Status & Performance</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-foreground/60" />
                  <span className="text-sm text-foreground/80">Uptime</span>
                </div>
                <span className="text-lg font-bold text-foreground">{formatUptime(node.uptime)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-foreground/60" />
                  <span className="text-sm text-foreground/80">Credits</span>
                </div>
                <span className="text-lg font-bold text-[#F0A741]">
                  {node.credits !== undefined && node.credits !== null
                    ? node.credits.toLocaleString()
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <span className="text-sm text-foreground/80">Registered</span>
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
              {node.storageCapacity ? (
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
                        const storagePercent = storageUsed && node.storageCapacity 
                          ? (storageUsed / node.storageCapacity) * 100 
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
                          const storagePercent = storageUsed && node.storageCapacity 
                            ? (storageUsed / node.storageCapacity) * 100 
                            : 0;
                          return storagePercent > 0 ? (
                            <div className="text-xs font-semibold text-foreground">
                              {storagePercent.toFixed(0)}%
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-foreground">
                              {formatValue(node.storageCapacity, formatStorageBytes)}
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
                      return storageUsed && node.storageCapacity ? (
                        <div className="text-xs text-muted-foreground">
                          {formatValue(storageUsed, formatStorageBytes)} / {formatValue(node.storageCapacity, formatStorageBytes)}
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
                      {formatValue(node.ramUsed, formatBytes)} / {formatValue(node.ramTotal, formatBytes)}
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
              {node.packetsReceived !== undefined && node.packetsReceived !== null && (
                <div className="flex justify-between">
                  <span className="text-foreground/60">Packets Rx (Total)</span>
                  <span className="font-mono text-foreground/80">{node.packetsReceived.toLocaleString()}</span>
                </div>
              )}
              {node.packetsSent !== undefined && node.packetsSent !== null && (
                <div className="flex justify-between">
                  <span className="text-foreground/60">Packets Tx (Total)</span>
                  <span className="font-mono text-foreground/80">{node.packetsSent.toLocaleString()}</span>
                </div>
              )}
              {node.activeStreams !== undefined && (
                <div className="flex justify-between">
                  <span className="text-foreground/60">Active Streams</span>
                  <span className="font-mono text-foreground/80">{node.activeStreams}</span>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="card">
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

          {/* Status */}
          <div className="card">
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
              {node.credits !== undefined && node.credits !== null && (
                <div className="flex justify-between">
                  <span className="text-foreground/60">Credits</span>
                  <span className="text-foreground/80 font-semibold">{node.credits.toLocaleString()}</span>
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


        {/* Historical Data Section */}
        {historicalData.length > 0 && (() => {
          const now = Date.now();
          const timeRangeMs = {
            '30m': 30 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '1w': 7 * 24 * 60 * 60 * 1000,
          };
          const cutoffTime = now - timeRangeMs[timeRange];
          const filteredData = historicalData.filter(d => d.timestamp >= cutoffTime);

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
                      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                        timeRange === range
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
                    title="Node Status"
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
                    }
                  />
                </div>

                {/* CPU & RAM over time */}
                {(filteredData.some(d => d.cpuPercent !== undefined) || filteredData.some(d => d.ramPercent !== undefined)) && (
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
                      }
                    />
                  </div>
                )}

              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Packets over time */}
                {(filteredData.some(d => d.packetsReceived !== undefined) || filteredData.some(d => d.packetsSent !== undefined)) && (() => {
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
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Total packet rate (Rx + Tx) calculated over 5-minute windows</span>
                          </div>
                        }
                      />
                    </div>
                  );
                })()}

                {/* Credits over time */}
                {(filteredData.some(d => d.credits !== undefined) || (node.credits !== undefined && node.credits !== null)) && (() => {
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
                  
                  if (creditsData.length === 0 && node.credits !== undefined && node.credits !== null) {
                    creditsData.push({
                      timestamp: Date.now(),
                      value: node.credits,
                      _credits: node.credits,
                      _previousCredits: undefined,
                      _originalCredits: node.credits,
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
                          const val = v.toFixed(0);
                          return v > 0 ? `+${val}` : val;
                        }}
                        tooltipFormatter={(d) => {
                          const value = d.value || 0;
                          const isPositive = value > 0;
                          const isNegative = value < 0;
                          return (
                            <div className="text-xs">
                              <div className="font-semibold text-foreground mb-1">
                                {new Date(d.timestamp).toLocaleString()}
                              </div>
                              <div className="text-foreground/80 space-y-1">
                                <div className={isNegative ? 'text-red-400' : isPositive ? 'text-green-400' : ''}>
                                  {isNegative ? 'Credits Lost: ' : 'Credits Earned: '}
                                  <span className="font-semibold">
                                    {isPositive ? '+' : ''}{value.toFixed(0)}
                                  </span>
                                </div>
                                {d._credits !== undefined && d._credits !== null && (
                                  <div className="text-foreground/60">Total Credits: {d._credits.toLocaleString()}</div>
                                )}
                                {d._previousCredits !== undefined && d._previousCredits !== null && (
                                  <div className="text-foreground/60 text-[10px]">Previous: {d._previousCredits.toLocaleString()}</div>
                                )}
                              </div>
                            </div>
                          );
                        }}
                        headerContent={
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Credits change (earned/lost) calculated over 5-minute windows</span>
                          </div>
                        }
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}

        {loadingHistory && (
          <div className="card mb-6">
            <div className="space-y-6">
              <div className="space-y-4">
                <HistoricalLineChart
                  title="Node Status"
                  data={[]}
                  height={250}
                  yDomain={[0, 3]}
                  strokeColor="#3F8277"
                  yLabel="Status"
                  tooltipFormatter={() => <div />}
                  headerContent={
                    <span className="text-xs text-muted-foreground">
                      Loading historical data...
                    </span>
                  }
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <HistoricalLineChart
                  title="Resource Utilization"
                  data={[]}
                  height={250}
                  yDomain={[0, 100]}
                  strokeColor="#F0A741"
                  yLabel="%"
                  tooltipFormatter={() => <div />}
                  headerContent={
                    <span className="text-xs text-muted-foreground">
                      Loading historical data...
                    </span>
                  }
                />
                <HistoricalLineChart
                  title="Network Activity"
                  data={[]}
                  height={250}
                  yDomain={[0, 100]}
                  strokeColor="#3F8277"
                  yLabel="Packets/s"
                  tooltipFormatter={() => <div />}
                  headerContent={
                    <span className="text-xs text-muted-foreground">
                      Loading historical data...
                    </span>
                  }
                />
              </div>
            </div>
          </div>
        )}

        {!loadingHistory && historicalData.length === 0 && (
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
          </div>
        </div>
      </main>
    </div>
  );
}

export default function NodeDetailPage() {
  return (
    <Suspense fallback={null}>
      <NodeDetailContent />
    </Suspense>
  );
}
