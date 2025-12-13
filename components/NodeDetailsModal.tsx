'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PNode } from '@/lib/types/pnode';
import { X, Copy, Check, RefreshCw, HardDrive, Cpu, MemoryStick, Network, MapPin, Clock, CheckCircle2, XCircle, Globe, TrendingUp, Server, Activity } from 'lucide-react';
import { detectDataCenter, getRegionName } from '@/lib/utils/dataCenter';
import { formatBytes, formatStorageBytes } from '@/lib/utils/storage';
import { useNodes } from '@/lib/context/NodesContext';
import BalanceDisplay from './BalanceDisplay';
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

interface NodeDetailsModalProps {
  node: PNode | null;
  isOpen: boolean;
  onClose: () => void;
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
    // Same day - show only time
    return timeFormat('%H:%M')(date);
  } else {
    // Multiple days - show abbreviated date and time
    return timeFormat('%b %d, %H:%M')(date);
  }
};

// Helper component for historical line charts
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
  yTicks?: number[]; // Custom tick values
}) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<any>();
  const margin = { top: 20, right: 20, left: 50, bottom: 60 };

  // Interpolate missing data points to fill gaps smoothly
  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    
    const sorted = data.sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length < 2) return sorted;
    
    const interpolated: typeof data = [];
    const interval = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    for (let i = 0; i < sorted.length; i++) {
      interpolated.push(sorted[i]);
      
      // Check if there's a gap before the next point
      if (i < sorted.length - 1) {
        const current = sorted[i];
        const next = sorted[i + 1];
        const gap = next.timestamp - current.timestamp;
        
        // If gap is more than 1.5x the interval, fill it with interpolated points
        if (gap > interval * 1.5) {
          const numPoints = Math.floor(gap / interval) - 1;
          
          for (let j = 1; j <= numPoints; j++) {
            const interpolatedTimestamp = current.timestamp + (gap * j / (numPoints + 1));
            const ratio = j / (numPoints + 1);
            
            // Interpolate all numeric values
            const interpolatedPoint: typeof data[0] = {
              timestamp: interpolatedTimestamp,
            };
            
            // Interpolate value (for single line) - only if both values exist
            if (current.value !== undefined && current.value !== null && 
                next.value !== undefined && next.value !== null &&
                !isNaN(current.value) && !isNaN(next.value)) {
              interpolatedPoint.value = current.value + (next.value - current.value) * ratio;
            } else if (current.value !== undefined && current.value !== null && !isNaN(current.value)) {
              // If only current has value, carry it forward
              interpolatedPoint.value = current.value;
            } else if (next.value !== undefined && next.value !== null && !isNaN(next.value)) {
              // If only next has value, use it
              interpolatedPoint.value = next.value;
            }
            
            // Interpolate multi-line values
            if (multiLine) {
              multiLine.forEach(line => {
                const currentVal = current[line.key];
                const nextVal = next[line.key];
                
                // Both values exist - interpolate
                if (currentVal !== undefined && currentVal !== null && 
                    nextVal !== undefined && nextVal !== null &&
                    !isNaN(currentVal) && !isNaN(nextVal)) {
                  interpolatedPoint[line.key] = currentVal + (nextVal - currentVal) * ratio;
                } 
                // Only current has value - carry forward
                else if (currentVal !== undefined && currentVal !== null && !isNaN(currentVal)) {
                  interpolatedPoint[line.key] = currentVal;
                }
                // Only next has value - use it
                else if (nextVal !== undefined && nextVal !== null && !isNaN(nextVal)) {
                  interpolatedPoint[line.key] = nextVal;
                }
                // Otherwise leave undefined (won't be drawn)
              });
            }
            
            // Copy label from current point
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
  
  // Smart Y-axis formatter
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

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {headerContent}
      </div>
      <div style={{ width: '100%', height, position: 'relative' }}>
        <ParentSize>
          {({ width: parentWidth = 800 }) => {
            const width = parentWidth;
            const xMax = width - margin.left - margin.right;
            const yMax = height - margin.top - margin.bottom;

            const xScale = scaleTime<number>({
              range: [0, xMax],
              domain: chartData.length > 0
                ? [Math.min(...chartData.map(d => d.timestamp)), Math.max(...chartData.map(d => d.timestamp))]
                : [Date.now() - 3600000, Date.now()],
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
              const x0 = xScale.invert(x);
              
              // Find the closest data point
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
                <svg width={width} height={height} onMouseMove={handleMouseMove} onMouseLeave={hideTooltip}>
                  <rect x={0} y={0} width={width} height={height} fill="transparent" />
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
                        // Filter out points with invalid values for this line
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
                        // Filter out points with invalid values
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

                    {/* Vertical line and dots on hover */}
                    {tooltipOpen && tooltipData && (
                      <>
                        {/* Vertical line */}
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
                        {/* Dots at intersection points */}
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

export default function NodeDetailsModal({ node, isOpen, onClose }: NodeDetailsModalProps) {
  const router = useRouter();
  const { nodes: allNodes, refreshNodes } = useNodes();
  const [copied, setCopied] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // Load cached latency immediately if available
  const [nodeLatency, setNodeLatency] = useState<number | null>(() => {
    if (!node) return null;
    const cached = getCachedLatency(node.id);
    return cached !== undefined ? cached : null;
  });
  const [measuringLatency, setMeasuringLatency] = useState(false);

  // Measure latency for this specific node when modal opens (only if not cached)
  useEffect(() => {
    let mounted = true;
    
    const measureLatency = async () => {
      if (!node) return;
      
      // Check cache first
      const cached = getCachedLatency(node.id);
      if (cached !== undefined) {
        // Already cached, use it
        if (mounted) {
          setNodeLatency(cached);
        }
        return;
      }
      
      // Not cached, measure it
      setMeasuringLatency(true);
      try {
        const latency = await measureNodeLatency(node, 2000);
        if (mounted) {
          setNodeLatency(latency);
        }
      } catch (error) {
        console.warn('[NodeDetailsModal] Failed to measure node latency:', error);
      } finally {
        if (mounted) {
          setMeasuringLatency(false);
        }
      }
    };

    if (isOpen && node) {
      measureLatency();
    } else {
      // Reset when modal closes
      setNodeLatency(null);
    }
    
    return () => {
      mounted = false;
    };
  }, [isOpen, node?.id]);


  const handleRefresh = async () => {
    if (!node) return;
    setRefreshingStats(true);
    try {
      await refreshNodes();
    } catch (e) {
      console.error('Failed to refresh:', e);
    } finally {
      setRefreshingStats(false);
    }
  };

  // Fetch historical data when node changes
  useEffect(() => {
    if (!node || !isOpen) {
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
      }, 30000); // 30 second timeout
      
      try {
        const pubkey = node.pubkey || node.publicKey || node.id || '';
        if (!pubkey) {
          console.warn('[NodeDetailsModal] No pubkey available for node');
          if (isMounted) {
            setHistoricalData([]);
            setLoadingHistory(false);
          }
          return;
        }

        // Get last 7 days of history
        const endTime = Date.now();
        const startTime = endTime - (7 * 24 * 60 * 60 * 1000);

        const url = `/api/history?nodeId=${encodeURIComponent(pubkey)}&startTime=${startTime}&endTime=${endTime}`;
        console.log('[NodeDetailsModal] Fetching history from:', url);

        const response = await fetch(url, {
          signal: abortController.signal,
        });
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (!isMounted) return;
        
        console.log('[NodeDetailsModal] Response received:', response.status, response.ok);
        
        if (!response.ok) {
          let errorData = {};
          try {
            const text = await response.text();
            errorData = text ? JSON.parse(text) : {};
          } catch (e) {
            // Ignore JSON parse errors
          }
          console.error('[NodeDetailsModal] Failed to fetch history:', response.status, errorData);
          if (isMounted) {
            setHistoricalData([]);
            setLoadingHistory(false);
          }
          return;
        }

        const data = await response.json();
        console.log('[NodeDetailsModal] History data received:', { 
          hasData: !!data.data, 
          dataLength: data.data?.length || 0,
          count: data.count,
          error: data.error 
        });
        
        if (!isMounted) return;
        
        if (data.error) {
          console.error('[NodeDetailsModal] History API error:', data.error);
          setHistoricalData([]);
        } else {
          // Add node location to historical data points for region calculations
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
        
        if (error.name === 'AbortError') {
          console.error('[NodeDetailsModal] History fetch timed out or was aborted');
        } else {
          console.error('[NodeDetailsModal] Exception fetching historical data:', error);
        }
        setHistoricalData([]);
      } finally {
        if (isMounted) {
          console.log('[NodeDetailsModal] Clearing loading state');
          setLoadingHistory(false);
        }
      }
    };

    fetchHistory();

    // Cleanup function
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
  }, [node?.pubkey || node?.publicKey || node?.id, isOpen]);

  const nodeStats = useMemo(() => {
    if (!node) return null;

    const networkAvgCpu = allNodes.length > 0
      ? allNodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).reduce((sum, n) => sum + (n.cpuPercent || 0), 0) / allNodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).length
      : 0;

    const storageUtilization = node.storageCapacity
      ? ((node.storageUsed || 0) / node.storageCapacity) * 100
      : 0;

    const ramUtilization = node.ramTotal && node.ramUsed
      ? (node.ramUsed / node.ramTotal) * 100
      : 0;

    return {
      networkAvgCpu,
      storageUtilization,
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

  const formatPublicKey = (key?: string) => {
    if (!key) return '—';
    if (key.length <= 20) return key;
    return `${key.slice(0, 10)}...${key.slice(-10)}`;
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

  if (!isOpen || !node) return null;

  const pubkey = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '';
  const displayPubkey = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '—';
  const gossipAddress = node.address || '—';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          className="bg-black border-0 sm:border border-border rounded-none sm:rounded-2xl shadow-2xl shadow-black/20 w-full h-full sm:w-full sm:max-w-6xl sm:max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Analytics Style */}
          <div className="bg-card/40 border-b border-border/60 px-4 sm:px-5 py-4 sm:py-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Server className="w-4 h-4 text-foreground/40" />
                  Node Details
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(node.status)}
                  <h1 className="text-xl sm:text-2xl font-bold leading-tight font-mono">
                    {gossipAddress}
                  </h1>
                </div>
                {node.version && (
                  <p className="text-xs sm:text-sm text-foreground/70">
                    Version {node.version}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (node) {
                      const nodeId = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '';
                      if (nodeId) {
                        router.push(`/?node=${encodeURIComponent(nodeId)}`);
                        onClose();
                      }
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg border border-border/60 transition-colors text-xs sm:text-sm font-medium"
                  title="View on Globe"
                >
                  <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">View on Globe</span>
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshingStats}
                  className="p-1.5 sm:p-2 hover:bg-muted/40 rounded-lg transition-colors disabled:opacity-50 border border-border/60"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${refreshingStats ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 hover:bg-muted/40 rounded-lg transition-colors border border-border/60"
                  title="Close"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
            
            {/* Pubkey with copy */}
            <div className="mt-3 flex items-center gap-2">
              <p className="text-xs font-mono text-foreground/60 truncate flex-1">{pubkey}</p>
              <button
                onClick={async () => {
                  if (pubkey) {
                    await navigator.clipboard.writeText(pubkey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                className="p-1.5 hover:bg-muted/40 rounded transition-colors flex-shrink-0 border border-border/60"
                title="Copy"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-[#3F8277]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-foreground/60" />
                )}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
              {/* Stats Cards - Analytics Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Uptime</span>
                    <Clock className="w-4 h-4 text-foreground/40" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-foreground">{formatUptime(node.uptime)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Current session</p>
                </div>

                <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Storage</span>
                    <HardDrive className="w-4 h-4 text-foreground/40" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {formatValue(node.storageUsed, formatStorageBytes)}
                  </div>
                  {node.storageCapacity && (
                    <p className="text-xs text-muted-foreground mt-1">
                      of {formatStorageBytes(node.storageCapacity)}
                    </p>
                  )}
                </div>

                <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">CPU</span>
                    <Cpu className="w-4 h-4 text-foreground/40" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {formatValue(node.cpuPercent, (val) => `${val.toFixed(1)}%`)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Current usage</p>
                </div>

                <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Latency</span>
                    <Network className="w-4 h-4 text-foreground/40" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {(() => {
                      // Use per-node latency measurement
                      if (nodeLatency !== null && nodeLatency !== undefined) {
                        return (
                          <div className="flex flex-col">
                            <span className="text-xl sm:text-2xl font-bold text-foreground">
                              {nodeLatency.toFixed(0)}ms
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                              Your latency
                            </span>
                          </div>
                        );
                      }
                      
                      if (measuringLatency) {
                        return (
                          <span className="text-sm text-muted-foreground">
                            Measuring...
                          </span>
                        );
                      }
                      
                      return (
                        <span className="text-sm text-muted-foreground">
                          N/A
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nodeLatency !== null ? 'Your latency to this node' : 'Node not reachable'}
                  </p>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {/* Storage & Memory */}
                <div className="bg-card/50 border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <HardDrive className="w-4 h-4 text-foreground/40" />
                    <h2 className="text-base font-semibold text-foreground">Storage & Memory</h2>
                  </div>
                  <div className="space-y-4">
                    {node.storageCapacity ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">Storage</span>
                          <span className="text-sm font-mono font-semibold text-foreground">
                            {formatValue(nodeStats?.storageUtilization, (val) => `${val.toFixed(1)}%`)}
                          </span>
                        </div>
                        <div className="w-full bg-muted/30 rounded-full h-2">
                          <div
                            className="bg-[#F0A741] h-2 rounded-full transition-all duration-500"
                            style={{ width: `${nodeStats?.storageUtilization || 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                          <span>{formatValue(node.storageUsed, formatStorageBytes)}</span>
                          <span>{formatValue(node.storageCapacity, formatStorageBytes)}</span>
                        </div>
                      </div>
                    ) : null}
                    {node.ramTotal ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">Memory</span>
                          <span className="text-sm font-mono font-semibold text-foreground">
                            {formatValue(nodeStats?.ramUtilization, (val) => `${val.toFixed(1)}%`)}
                          </span>
                        </div>
                        <div className="w-full bg-muted/30 rounded-full h-2">
                          <div
                            className="bg-[#3F8277] h-2 rounded-full transition-all duration-500"
                            style={{ width: `${nodeStats?.ramUtilization || 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                          <span>{formatValue(node.ramUsed, formatBytes)}</span>
                          <span>{formatValue(node.ramTotal, formatBytes)}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Network */}
                <div className="bg-card/50 border border-border rounded-xl p-4">
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
                    {(() => {
                      // Calculate packet rates from historical data
                      if (historicalData.length >= 2) {
                        const sorted = [...historicalData].sort((a, b) => a.timestamp - b.timestamp);
                        const latest = sorted[sorted.length - 1];
                        const previous = sorted[sorted.length - 2];
                        
                        const timeDiff = (latest.timestamp - previous.timestamp) / 1000; // seconds
                        const rxDiff = (latest.packetsReceived || 0) - (previous.packetsReceived || 0);
                        const txDiff = (latest.packetsSent || 0) - (previous.packetsSent || 0);
                        
                        const rxRate = timeDiff > 0 ? rxDiff / timeDiff : 0;
                        const txRate = timeDiff > 0 ? txDiff / timeDiff : 0;
                        
                        if (rxRate > 0 || txRate > 0) {
                          return (
                            <>
                              {rxRate > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-foreground/60">Packets Rx Rate</span>
                                  <span className="font-mono text-foreground/80">{formatNumber(rxRate)}/s</span>
                                </div>
                              )}
                              {txRate > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-foreground/60">Packets Tx Rate</span>
                                  <span className="font-mono text-foreground/80">{formatNumber(txRate)}/s</span>
                                </div>
                              )}
                            </>
                          );
                        }
                      }
                      return null;
                    })()}
                    {node.activeStreams !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-foreground/60">Active Streams</span>
                        <span className="font-mono text-foreground/80">{node.activeStreams}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="bg-card/50 border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-foreground/40" />
                    <h2 className="text-base font-semibold text-foreground">Location</h2>
                  </div>
                  <div className="space-y-2 text-sm">
                    {node.locationData?.country && (
                      <div className="flex justify-between">
                        <span className="text-foreground/60">Country</span>
                        <span className="text-foreground/80">{node.locationData.country}</span>
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
                <div className="bg-card/50 border border-border rounded-xl p-4">
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
                    {node.balance !== undefined && node.balance !== null && (
                      <div className="flex justify-between">
                        <span className="text-foreground/60">Balance</span>
                        <BalanceDisplay 
                          balance={node.balance} 
                          className="text-sm font-mono"
                        />
                      </div>
                    )}
                    {node.lastSeen && (
                      <div className="flex justify-between">
                        <span className="text-foreground/60">Last Seen</span>
                        <span className="text-foreground/80 text-xs">{new Date(node.lastSeen).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Historical Data Section */}
              {historicalData.length > 0 && (
                <div className="bg-card/50 border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-foreground/40" />
                    <h2 className="text-base font-semibold text-foreground">Historical Performance (Last 7 Days)</h2>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Status over time */}
                    <div>
                      <HistoricalLineChart
                        title="Node Status"
                        data={historicalData.map(d => ({
                          timestamp: d.timestamp,
                          value: d.status === 'online' ? 2 : d.status === 'syncing' ? 1 : 0,
                          label: d.status || 'offline',
                        }))}
                        height={200}
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
                    {(historicalData.some(d => d.cpuPercent !== undefined) || historicalData.some(d => d.ramPercent !== undefined)) && (
                      <div>
                        <HistoricalLineChart
                          title="Resource Utilization"
                          data={historicalData.map(d => ({
                            timestamp: d.timestamp,
                            cpu: d.cpuPercent,
                            ram: d.ramPercent,
                          }))}
                          height={200}
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
                                const cpuData = historicalData.filter(d => d.cpuPercent !== undefined && d.cpuPercent !== null && !isNaN(d.cpuPercent));
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
                                const ramData = historicalData.filter(d => d.ramPercent !== undefined && d.ramPercent !== null && !isNaN(d.ramPercent));
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

                    {/* Packets over time */}
                    {(historicalData.some(d => d.packetsReceived !== undefined) || historicalData.some(d => d.packetsSent !== undefined)) && (() => {
                      const packetData = historicalData.map(d => ({
                        timestamp: d.timestamp,
                        received: d.packetsReceived,
                        sent: d.packetsSent,
                      }));
                      const maxPackets = Math.max(
                        ...packetData.map(d => Math.max(d.received || 0, d.sent || 0))
                      );
                      return (
                        <div>
                          <HistoricalLineChart
                            title="Network Activity"
                            data={packetData}
                            height={200}
                            yDomain={[0, maxPackets * 1.1]}
                            strokeColor="#3F8277"
                            yLabel="Packets (cumulative)"
                            yTickFormatter={(v) => formatNumber(v)}
                            multiLine={[
                              { key: 'received', color: '#3F8277', label: 'Received' },
                              { key: 'sent', color: '#F0A741', label: 'Sent' },
                            ]}
                            tooltipFormatter={(d) => (
                              <div className="text-xs">
                                <div className="font-semibold text-foreground mb-1">
                                  {new Date(d.timestamp).toLocaleString()}
                                </div>
                                <div className="text-foreground/80 space-y-1">
                                  {d.received !== undefined && d.received !== null && (
                                    <div>Received (Total): {d.received.toLocaleString()}</div>
                                  )}
                                  {d.sent !== undefined && d.sent !== null && (
                                    <div>Sent (Total): {d.sent.toLocaleString()}</div>
                                  )}
                                </div>
                              </div>
                            )}
                            headerContent={
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {(() => {
                                  // Calculate actual packet rates from historical snapshots
                                  if (historicalData.length >= 2) {
                                    const sorted = [...historicalData].sort((a, b) => a.timestamp - b.timestamp);
                                    const latest = sorted[sorted.length - 1];
                                    const previous = sorted[0];
                                    
                                    const timeDiff = (latest.timestamp - previous.timestamp) / 1000; // seconds
                                    if (timeDiff > 0) {
                                      const rxDiff = (latest.packetsReceived || 0) - (previous.packetsReceived || 0);
                                      const txDiff = (latest.packetsSent || 0) - (previous.packetsSent || 0);
                                      
                                      const rxRate = rxDiff / timeDiff;
                                      const txRate = txDiff / timeDiff;
                                      
                                      return (
                                        <>
                                          {rxRate > 0 && (
                                            <div>
                                              <span>Rx Rate: <span className="text-foreground font-semibold">
                                                {formatNumber(rxRate)}/s
                                              </span></span>
                                            </div>
                                          )}
                                          {txRate > 0 && (
                                            <div>
                                              <span>Tx Rate: <span className="text-foreground font-semibold">
                                                {formatNumber(txRate)}/s
                                              </span></span>
                                            </div>
                                          )}
                                        </>
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                              </div>
                            }
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {loadingHistory && (
                <div className="bg-card/50 border border-border rounded-xl p-4">
                  <p className="text-sm text-foreground/60">Loading historical data...</p>
                </div>
              )}

              {!loadingHistory && historicalData.length === 0 && (
                <div className="bg-card/50 border border-border rounded-xl p-4">
                  <p className="text-sm text-foreground/60">No historical data available for this node</p>
                </div>
              )}

              {/* Stats Unavailable Warning */}
              {node._statsError && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <p className="text-yellow-400 font-medium text-sm mb-1">Stats Unavailable</p>
                  <p className="text-xs text-foreground/60">
                    {node._statsError}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
