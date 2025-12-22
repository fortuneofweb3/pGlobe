'use client';

import { useMemo, useState, Suspense, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { getFlagForCountry } from '@/lib/utils/country-flags';
import { formatStorageBytes } from '@/lib/utils/storage';
import { formatPacketRate } from '@/lib/utils/packet-rates';
import { calculateNetworkHealth } from '@/lib/utils/network-health';
import { ArrowLeft, MapPin, Server, TrendingUp, Activity, HardDrive, Award, Clock, Zap, ChevronDown, ChevronUp, Search, BarChart3 } from 'lucide-react';
import AnimatedNumber from '@/components/AnimatedNumber';
import PNodeTable from '@/components/PNodeTable';
import { PNode } from '@/lib/types/pnode';
import { TableSkeleton, CardSkeleton, ChartSkeleton } from '@/components/Skeletons';
import ResourceUtilization from '@/components/analytics/ResourceUtilization';
import NetworkHealthTrendChart from '@/components/charts/NetworkHealthTrendChart';
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

function formatUptimeDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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
  yTicks?: number[];
}) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<any>();
  const margin = { top: 30, right: 30, left: 60, bottom: 70 };
  const svgRef = useRef<SVGSVGElement>(null);
  const hasAnimatedRef = useRef(false);
  const previousDataLengthRef = useRef(0);

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
    if (!svgRef.current) return;
    
    // If data is empty, don't animate
    if (chartData.length === 0) {
      hasAnimatedRef.current = false;
      previousDataLengthRef.current = 0;
      return;
    }

    // Reset animation flag when data changes from empty to populated or when data length changes
    const dataLengthChanged = previousDataLengthRef.current !== chartData.length;
    const wasEmpty = previousDataLengthRef.current === 0;
    
    if (wasEmpty || dataLengthChanged) {
      hasAnimatedRef.current = false;
    }
    
    previousDataLengthRef.current = chartData.length;

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

function CountryDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { nodes, loading, error, lastUpdate, refreshNodes } = useNodes();
  
  const countryName = decodeURIComponent(params.country as string);
  const [sortBy, setSortBy] = useState<string>('reputation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [tableExpanded, setTableExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [historicalData, setHistoricalData] = useState<Array<{
    timestamp: number;
    onlineCount: number;
    totalNodes: number;
    totalPacketsReceived: number;
    totalPacketsSent: number;
    totalCredits: number;
    avgCPU?: number;
    avgRAM?: number;
  }>>([]);
  const [timeRange, setTimeRange] = useState<'30m' | '1h' | '24h' | '1w'>('24h');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fetchingHistoryRef = useRef(false);
  const fetchHistoryAbortControllerRef = useRef<AbortController | null>(null);

  // Filter nodes by country
  const countryNodes = useMemo(() => {
    return nodes.filter(node =>
      node.locationData?.country === countryName
    );
  }, [nodes, countryName]);

  // Fetch historical data for all nodes in this country with deduplication
  useEffect(() => {
    const fetchHistoricalData = async () => {
      // Request deduplication - prevent multiple simultaneous fetches
      if (fetchingHistoryRef.current) {
        console.log('[RegionPage] Already fetching history, skipping duplicate request');
        return;
      }

      // Cancel any pending request
      if (fetchHistoryAbortControllerRef.current) {
        fetchHistoryAbortControllerRef.current.abort();
      }

      fetchingHistoryRef.current = true;
      setLoadingHistory(true);

      // Create new abort controller for this request
      const abortController = new AbortController();
      fetchHistoryAbortControllerRef.current = abortController;

      try {
        const endTime = Date.now();
        const startTime = endTime - (7 * 24 * 60 * 60 * 1000); // Always fetch 7 days

        // Get country code if available from first node
        const countryCode = countryNodes[0]?.locationData?.countryCode;

        console.log(`[RegionPage] Fetching aggregated region history for ${countryName}${countryCode ? ` (${countryCode})` : ''}`);

        // Use new region history endpoint that aggregates server-side from snapshots
        const url = `/api/history/region?country=${encodeURIComponent(countryName)}${countryCode ? `&countryCode=${encodeURIComponent(countryCode)}` : ''}&startTime=${startTime}&endTime=${endTime}`;
        console.log('[RegionPage] Calling region history API:', url);
        
        const response = await fetch(url, {
          signal: abortController.signal,
          cache: 'no-store', // Don't cache to ensure fresh data
        });

        console.log('[RegionPage] Region history API response status:', response.status, response.statusText);

        if (response.ok) {
          const result = await response.json();
          console.log('[RegionPage] Region history API response:', {
            success: result.success,
            count: result.count || 0,
            dataLength: result.data?.length || 0,
          });

          if (result.success && Array.isArray(result.data)) {
            console.log(`[RegionPage] ✅ Received ${result.data.length} aggregated data points for ${countryName}`);
            if (result.data.length > 0) {
              const firstPoint = new Date(result.data[0].timestamp);
              const lastPoint = new Date(result.data[result.data.length - 1].timestamp);
              console.log(`[RegionPage] Data range: ${firstPoint.toISOString()} to ${lastPoint.toISOString()}`);
            }
            setHistoricalData(result.data);
          } else {
            console.warn('[RegionPage] Region history API returned invalid format:', result);
            setHistoricalData([]);
          }
        } else {
          const errorText = await response.text().catch(() => 'Failed to read error response');
          console.error('[RegionPage] Region history API failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
          setHistoricalData([]);
        }
      } catch (err: any) {
        // Don't log error if request was aborted (intentional cancellation)
        if (err?.name !== 'AbortError') {
          console.error('[RegionPage] Failed to fetch historical data:', err);
        }
        setHistoricalData([]);
      } finally {
        setLoadingHistory(false);
        fetchingHistoryRef.current = false;
        fetchHistoryAbortControllerRef.current = null;
      }
    };

    // Always fetch history when page loads, even if no nodes yet (show empty charts)
    fetchHistoricalData();

    // Cleanup function - abort pending request on unmount
    return () => {
      if (fetchHistoryAbortControllerRef.current) {
        fetchHistoryAbortControllerRef.current.abort();
      }
      fetchingHistoryRef.current = false;
    };
  }, [countryNodes.length, countryName]);

  // Calculate country stats with stabilized values to prevent flickering
  const stats = useMemo(() => {
    const onlineNodes = countryNodes.filter(n => n.status === 'online').length;
    const offlineNodes = countryNodes.filter(n => n.status === 'offline' || !n.status).length;
    const syncingNodes = countryNodes.filter(n => n.status === 'syncing').length;

    const totalStorage = countryNodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0);
    const usedStorage = countryNodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0);
    const totalRAM = countryNodes.reduce((sum, n) => sum + (n.ramTotal || 0), 0);
    const usedRAM = countryNodes.reduce((sum, n) => sum + (n.ramUsed || 0), 0);

    const nodesWithUptime = countryNodes.filter(n => n.uptime !== undefined && n.uptime > 0);
    const avgUptimeSeconds = nodesWithUptime.length > 0
      ? nodesWithUptime.reduce((sum, n) => sum + (n.uptime || 0), 0) / nodesWithUptime.length
      : 0;

    const nodesWithCPU = countryNodes.filter(n => n.cpuPercent !== undefined);
    const avgCPU = nodesWithCPU.length > 0
      ? nodesWithCPU.reduce((sum, n) => sum + (n.cpuPercent || 0), 0) / nodesWithCPU.length
      : 0;

    const nodesWithRAM = countryNodes.filter(n => n.ramTotal !== undefined);
    const avgRAMUsage = nodesWithRAM.length > 0
      ? nodesWithRAM.reduce((sum, n) => {
          const usage = n.ramTotal && n.ramUsed ? (n.ramUsed / n.ramTotal) * 100 : 0;
          return sum + usage;
        }, 0) / nodesWithRAM.length
      : 0;

    const latencies = countryNodes
      .map(n => n.latency)
      .filter((lat): lat is number => lat !== undefined && lat !== null && lat > 0);
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length)
      : 0;

    const totalPacketsReceived = countryNodes.reduce((sum, n) => sum + (n.packetsReceived || 0), 0);
    const totalPacketsSent = countryNodes.reduce((sum, n) => sum + (n.packetsSent || 0), 0);
    const totalActiveStreams = countryNodes.reduce((sum, n) => sum + (n.activeStreams || 0), 0);

    // Calculate credits with validation - filter out nodes with missing/invalid credit data
    // Only count nodes that have actual credit values to prevent 0s from skewing the total
    const nodesWithCredits = countryNodes.filter(n =>
      n.credits !== undefined && n.credits !== null && n.credits > 0
    );
    const totalCredits = nodesWithCredits.reduce((sum, n) => sum + (n.credits || 0), 0);

    // Calculate average packet rate
    const nodesWithPackets = countryNodes.filter(n =>
      (n.packetsReceived !== undefined && n.packetsReceived > 0) ||
      (n.packetsSent !== undefined && n.packetsSent > 0)
    );
    let avgPacketRate = 0;
    if (nodesWithPackets.length > 0) {
      const totalPackets = nodesWithPackets.reduce((sum, n) => {
        const received = n.packetsReceived || 0;
        const sent = n.packetsSent || 0;
        const uptime = n.uptime || 1; // Avoid division by zero
        return sum + ((received + sent) / uptime);
      }, 0);
      avgPacketRate = totalPackets / nodesWithPackets.length;
    }

    return {
      totalNodes: countryNodes.length,
      onlineNodes,
      offlineNodes,
      syncingNodes,
      totalStorage,
      usedStorage,
      totalRAM,
      usedRAM,
      avgUptimeSeconds,
      avgCPU,
      avgRAMUsage,
      avgLatency,
      totalPacketsReceived,
      totalPacketsSent,
      totalActiveStreams,
      totalCredits,
      nodesReportingCredits: nodesWithCredits.length,
      avgPacketRate,
    };
  }, [countryNodes]);

  // Get country code from first node
  const countryCode = countryNodes[0]?.locationData?.countryCode;

  // Sort and filter nodes
  const filteredAndSortedNodes = useMemo(() => {
    let filtered = [...countryNodes];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((node) =>
        node.id?.toLowerCase().includes(query) ||
        node.publicKey?.toLowerCase().includes(query) ||
        node.pubkey?.toLowerCase().includes(query) ||
        node.address?.toLowerCase().includes(query) ||
        node.location?.toLowerCase().includes(query) ||
        node.locationData?.city?.toLowerCase().includes(query) ||
        node.locationData?.country?.toLowerCase().includes(query) ||
        node.version?.toLowerCase().includes(query)
      );
    }

    // Calculate "completeness score" for sorting
    const getCompletenessScore = (node: PNode): number => {
      let score = 0;
      if (node.cpuPercent !== undefined && node.cpuPercent !== null) score += 2;
      if (node.ramUsed !== undefined && node.ramUsed !== null && node.ramTotal !== undefined && node.ramTotal !== null) score += 2;
      if (node.latency !== undefined && node.latency !== null) score += 2;
      if (node.uptime !== undefined && node.uptime !== null) score += 2;
      if (node.uptimePercent !== undefined && node.uptimePercent !== null) score += 1;
      if (node.packetsReceived !== undefined && node.packetsReceived !== null) score += 1;
      if (node.packetsSent !== undefined && node.packetsSent !== null) score += 1;
      if (node.activeStreams !== undefined && node.activeStreams !== null) score += 1;
      if (node.storageCapacity !== undefined && node.storageCapacity !== null) score += 1;
      if (node.locationData?.city) score += 1;
      if (node.version) score += 1;
      return score;
    };

    filtered.sort((a, b) => {
      const aIsRegistered = a.isRegistered === true || (a.balance !== undefined && a.balance !== null && a.balance > 0);
      const bIsRegistered = b.isRegistered === true || (b.balance !== undefined && b.balance !== null && b.balance > 0);
      
      if (aIsRegistered !== bIsRegistered) {
        return aIsRegistered ? -1 : 1;
      }
      
      if (aIsRegistered && bIsRegistered) {
        const aScore = getCompletenessScore(a);
        const bScore = getCompletenessScore(b);
        
        if (aScore !== bScore) {
          return bScore - aScore;
        }
      }
      
      const aIsOnline = a.seenInGossip !== false && a.status === 'online';
      const bIsOnline = b.seenInGossip !== false && b.status === 'online';
      
      if (aIsOnline !== bIsOnline) {
        return aIsOnline ? -1 : 1;
      }
      
      let aVal: any = a[sortBy as keyof PNode];
      let bVal: any = b[sortBy as keyof PNode];

      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [countryNodes, sortBy, sortOrder, searchQuery]);

  // Show loading skeleton when loading or no data
  const isLoading = loading || (nodes.length === 0 && !error);

  if (isLoading && nodes.length === 0) {
    return (
      <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
        <Header activePage="regions" nodeCount={0} lastUpdate={null} loading={true} onRefresh={() => {}} />
        <main className="flex-1 overflow-hidden">
          <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {/* Back button - show immediately */}
              <Link href="/regions" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-4 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Regions
              </Link>

              {/* Cover image - show immediately with known country info */}
              {(() => {
                const countryNameFromUrl = decodeURIComponent(params.country as string);
                return (
                  <div className="relative h-56 sm:h-72 rounded-2xl overflow-hidden shadow-2xl mb-8 bg-muted/10">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
                    <div className="relative h-full flex flex-col justify-end p-8">
                      <h1 className="text-4xl sm:text-5xl font-bold text-white drop-shadow-lg mb-3">
                        {countryNameFromUrl}
                      </h1>
                      <div className="h-6 w-64 bg-white/10 rounded animate-pulse" />
                    </div>
                  </div>
                );
              })()}

              {/* Stats grid skeleton */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="card-stat">
                    <div className="h-4 w-24 bg-muted/30 rounded animate-pulse mb-3" />
                    <div className="h-8 w-16 bg-muted/40 rounded animate-pulse mb-2" />
                    <div className="h-3 w-20 bg-muted/20 rounded animate-pulse" />
                  </div>
                ))}
              </div>

              {/* Historical Performance skeleton */}
              <div className="mb-4 sm:mb-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-6 w-48 bg-muted/30 rounded animate-pulse" />
                  <div className="h-8 w-64 bg-muted/20 rounded animate-pulse" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="card p-6">
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 w-48 bg-muted/30 rounded" />
                        <div className="h-[250px] bg-muted/20 rounded" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="card p-6">
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 w-48 bg-muted/30 rounded" />
                        <div className="h-[250px] bg-muted/20 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table skeleton */}
              <div className="card p-4 mb-4">
                <div className="h-6 w-32 bg-muted/30 rounded animate-pulse mb-4" />
                <TableSkeleton rows={5} columns={7} />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-foreground">
        <Header activePage="regions" nodeCount={nodes.length} lastUpdate={lastUpdate} loading={loading} onRefresh={refreshNodes} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (countryNodes.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-black text-foreground">
        <Header activePage="regions" nodeCount={nodes.length} lastUpdate={lastUpdate} loading={loading} onRefresh={refreshNodes} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/regions" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Regions
          </Link>
          <div className="card text-center" style={{ padding: '2rem' }}>
            <p className="text-foreground/60">No nodes found for {countryName}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
      <Header activePage="regions" nodeCount={nodes.length} lastUpdate={lastUpdate} loading={loading} onRefresh={refreshNodes} />
      
      <main className="flex-1 overflow-hidden">
        <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Cover Image Section */}
            {countryCode && (() => {
              const flagUrl = `/api/flag-proxy?code=${countryCode.toLowerCase()}`;
              const onlinePercent = stats.totalNodes > 0 ? Math.round((stats.onlineNodes / stats.totalNodes) * 100) : 0;
              return (
                <div className="relative mb-8 animate-fade-in" style={{ animationDelay: '0.05s', opacity: 0, animationFillMode: 'forwards' }}>
                  {/* Back button */}
                  <Link href="/regions" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-all duration-300 hover:translate-x-[-4px] group">
                    <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
                    <span>Back to Regions</span>
                  </Link>

                  <div className="relative rounded-2xl overflow-hidden border border-border/40 shadow-2xl bg-card">
                    {/* Flag background */}
                    <div className="absolute inset-0">
                      <img
                        src={flagUrl}
                        alt={countryName}
                        className="w-full h-full object-cover opacity-10"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Content */}
                    <div className="relative p-6 sm:p-8 lg:p-10">
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
                        <div className="animate-slide-in-left" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
                          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-2">
                            {countryName}
                          </h1>
                          <p className="text-foreground/60 text-sm sm:text-base flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {countryNodes[0]?.locationData?.city ? `${countryNodes[0].locationData.city}, ` : ''}{countryCode}
                          </p>
                        </div>

                        {/* Quick Stats Badges */}
                        <div className="flex flex-wrap gap-3 sm:gap-4 animate-fade-in" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
                          <div className="px-4 py-2 rounded-lg bg-[#3F8277]/20 border border-[#3F8277]/30 backdrop-blur-sm">
                            <div className="text-xs text-foreground/60 uppercase tracking-wide mb-1">Online</div>
                            <div className="text-xl font-bold text-[#3F8277]">
                              <AnimatedNumber value={onlinePercent} suffix="%" />
                            </div>
                          </div>
                          <div className="px-4 py-2 rounded-lg bg-[#F0A741]/20 border border-[#F0A741]/30 backdrop-blur-sm">
                            <div className="text-xs text-foreground/60 uppercase tracking-wide mb-1">Nodes</div>
                            <div className="text-xl font-bold text-[#F0A741]">
                              <AnimatedNumber value={stats.totalNodes} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 animate-slide-in-bottom" style={{ animationDelay: '0.25s', opacity: 0, animationFillMode: 'forwards' }}>
                        <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#3F8277]/50 transition-all duration-300">
                          <div className="flex items-center gap-2 mb-2">
                            <Server className="w-4 h-4 text-[#3F8277]" />
                            <span className="text-xs font-medium text-foreground/60 uppercase">Total</span>
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            <AnimatedNumber value={stats.totalNodes} />
                          </div>
                          <div className="text-xs text-foreground/50 mt-1">
                            {stats.onlineNodes} online
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#F0A741]/50 transition-all duration-300">
                          <div className="flex items-center gap-2 mb-2">
                            <HardDrive className="w-4 h-4 text-[#F0A741]" />
                            <span className="text-xs font-medium text-foreground/60 uppercase">Storage</span>
                          </div>
                          <div className="text-xl font-bold text-foreground">
                            {formatStorageBytes(stats.totalStorage)}
                          </div>
                          {stats.usedStorage > 0 && (
                            <div className="text-xs text-foreground/50 mt-1">
                              {((stats.usedStorage / stats.totalStorage) * 100).toFixed(1)}% used
                            </div>
                          )}
                        </div>

                        <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#9CA3AF]/50 transition-all duration-300">
                          <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-4 h-4 text-[#9CA3AF]" />
                            <span className="text-xs font-medium text-foreground/60 uppercase">CPU</span>
                          </div>
                          <div className="text-xl font-bold text-foreground">
                            {stats.avgCPU > 0 ? (
                              <AnimatedNumber value={stats.avgCPU} decimals={1} suffix="%" />
                            ) : (
                              'N/A'
                            )}
                          </div>
                          <div className="text-xs text-foreground/50 mt-1">Average</div>
                        </div>

                        <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#3F8277]/50 transition-all duration-300">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-[#3F8277]" />
                            <span className="text-xs font-medium text-foreground/60 uppercase">RAM</span>
                          </div>
                          <div className="text-xl font-bold text-foreground">
                            {stats.avgRAMUsage > 0 ? (
                              <AnimatedNumber value={stats.avgRAMUsage} decimals={1} suffix="%" />
                            ) : (
                              'N/A'
                            )}
                          </div>
                          <div className="text-xs text-foreground/50 mt-1">Average</div>
                        </div>

                        {/* Total RAM */}
                        {stats.totalRAM > 0 && (
                          <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#3F8277]/50 transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="w-4 h-4 text-[#3F8277]" />
                              <span className="text-xs font-medium text-foreground/60 uppercase">Total RAM</span>
                            </div>
                            <div className="text-xl font-bold text-foreground">
                              {formatStorageBytes(stats.totalRAM)}
                            </div>
                            {stats.usedRAM > 0 && (
                              <div className="text-xs text-foreground/50 mt-1">
                                {formatStorageBytes(stats.usedRAM)} used
                              </div>
                            )}
                          </div>
                        )}

                        {/* Packets */}
                        {(stats.totalPacketsReceived > 0 || stats.totalPacketsSent > 0) && (
                          <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#F0A741]/50 transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                              <Activity className="w-4 h-4 text-[#F0A741]" />
                              <span className="text-xs font-medium text-foreground/60 uppercase">Packets</span>
                            </div>
                            <div className="text-xl font-bold text-foreground">
                              {formatNumber(stats.totalPacketsReceived + stats.totalPacketsSent)}
                            </div>
                            <div className="text-xs text-foreground/50 mt-1">
                              {formatNumber(stats.totalPacketsReceived)} Rx / {formatNumber(stats.totalPacketsSent)} Tx
                            </div>
                          </div>
                        )}

                        {/* Credits */}
                        {stats.totalCredits > 0 && (
                          <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#F0A741]/50 transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                              <Award className="w-4 h-4 text-[#F0A741]" />
                              <span className="text-xs font-medium text-foreground/60 uppercase">Credits</span>
                            </div>
                            <div className="text-xl font-bold text-foreground">
                              <AnimatedNumber value={stats.totalCredits} />
                            </div>
                            <div className="text-xs text-foreground/50 mt-1">
                              {stats.nodesReportingCredits} nodes
                            </div>
                          </div>
                        )}

                        {/* Average Latency */}
                        {stats.avgLatency > 0 && (
                          <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#9CA3AF]/50 transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-[#9CA3AF]" />
                              <span className="text-xs font-medium text-foreground/60 uppercase">Latency</span>
                            </div>
                            <div className="text-xl font-bold text-foreground">
                              <AnimatedNumber value={stats.avgLatency} />ms
                            </div>
                            <div className="text-xs text-foreground/50 mt-1">Average</div>
                          </div>
                        )}

                        {/* Average Uptime */}
                        {stats.avgUptimeSeconds > 0 && (
                          <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#3F8277]/50 transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-[#3F8277]" />
                              <span className="text-xs font-medium text-foreground/60 uppercase">Uptime</span>
                            </div>
                            <div className="text-xl font-bold text-foreground">
                              {formatUptimeDuration(stats.avgUptimeSeconds)}
                            </div>
                            <div className="text-xs text-foreground/50 mt-1">Average</div>
                          </div>
                        )}

                        {/* Active Streams */}
                        {stats.totalActiveStreams > 0 && (
                          <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#F0A741]/50 transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                              <Activity className="w-4 h-4 text-[#F0A741]" />
                              <span className="text-xs font-medium text-foreground/60 uppercase">Streams</span>
                            </div>
                            <div className="text-xl font-bold text-foreground">
                              <AnimatedNumber value={stats.totalActiveStreams} />
                            </div>
                            <div className="text-xs text-foreground/50 mt-1">Active</div>
                          </div>
                        )}

                        {/* Packet Rate */}
                        {stats.avgPacketRate > 0 && (
                          <div className="p-4 rounded-xl bg-background/40 border border-border/40 backdrop-blur-sm hover:border-[#3F8277]/50 transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-[#3F8277]" />
                              <span className="text-xs font-medium text-foreground/60 uppercase">Packet Rate</span>
                            </div>
                            <div className="text-xl font-bold text-foreground">
                              {formatPacketRate(stats.avgPacketRate)}
                            </div>
                            <div className="text-xs text-foreground/50 mt-1">Average</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Header (fallback if no country code) */}
            {!countryCode && (
              <div className="mb-4 sm:mb-6">
                <Link href="/regions" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-4">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Regions
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  {countryName}
                </h1>
                <p className="text-foreground/60 text-sm sm:text-base">
                  {stats.totalNodes} node{stats.totalNodes !== 1 ? 's' : ''} in this country
                </p>
              </div>
            )}

            {/* Historical Performance Section */}
            <div className="mb-4 sm:mb-6 space-y-4 animate-slide-in-left" style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}>
              {/* Time Range Selector */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#F0A741]" />
                  Analytics
                </h2>
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                  {(['30m', '1h', '24h', '1w'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
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

              {/* Loading State - Show all 4 charts with empty axes */}
              {loadingHistory && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <div className="card">
                      <HistoricalLineChart
                        title="Network Activity (Packet Rate)"
                        data={[]}
                        height={250}
                        yDomain={[0, 100]}
                        strokeColor="#3F8277"
                        yLabel="Packets/s"
                        tooltipFormatter={() => <div />}
                        headerContent={
                          <span className="text-xs text-muted-foreground">
                            Loading data...
                          </span>
                        }
                      />
                    </div>
                    <div className="card">
                      <HistoricalLineChart
                        title="Credits Earned History"
                        data={[]}
                        height={250}
                        yDomain={[-10, 10]}
                        strokeColor="#F0A741"
                        yLabel="Credits"
                        tooltipFormatter={() => <div />}
                        headerContent={
                          <span className="text-xs text-muted-foreground">
                            Loading data...
                          </span>
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="card">
                      <HistoricalLineChart
                        title="Average CPU Usage"
                        data={[]}
                        height={250}
                        yDomain={[0, 100]}
                        strokeColor="#F0A741"
                        yLabel="CPU %"
                        tooltipFormatter={() => <div />}
                        headerContent={
                          <span className="text-xs text-muted-foreground">
                            Loading data...
                          </span>
                        }
                      />
                    </div>
                    <div className="card">
                      <HistoricalLineChart
                        title="Average RAM Usage"
                        data={[]}
                        height={250}
                        yDomain={[0, 100]}
                        strokeColor="#9CA3AF"
                        yLabel="RAM %"
                        tooltipFormatter={() => <div />}
                        headerContent={
                          <span className="text-xs text-muted-foreground">
                            Loading data...
                          </span>
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {/* No Data State */}
              {!loadingHistory && historicalData.length === 0 && (
                <div className="card p-8 text-center">
                  <p className="text-muted-foreground">No historical data available for this region yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">Data will appear as nodes report their metrics over time.</p>
                </div>
              )}

              {/* Charts */}
              {!loadingHistory && historicalData.length > 0 && (() => {
              const now = Date.now();
              const timeRangeMs = {
                '30m': 30 * 60 * 1000,
                '1h': 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '1w': 7 * 24 * 60 * 60 * 1000,
              };
              const cutoffTime = now - timeRangeMs[timeRange];
              const filteredData = historicalData.filter(d => d.timestamp >= cutoffTime);

              // Calculate packet earning rate (packets/s) from historical data
              const sorted = [...filteredData].sort((a, b) => a.timestamp - b.timestamp);
              const FIVE_MINUTES_MS = 5 * 60 * 1000;

              const packetRateData = sorted.map((current, index) => {
                if (index === 0) {
                  // For first point, use current total divided by uptime if available
                  const totalPackets = (current.totalPacketsReceived || 0) + (current.totalPacketsSent || 0);
                  return {
                    timestamp: current.timestamp,
                    value: totalPackets > 0 ? totalPackets / 300 : 0, // Assume 5 min average
                  };
                }

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

                let rate = 0;
                if (previous && previousIndex >= 0) {
                  const timeDiff = (current.timestamp - previous.timestamp) / 1000;
                  if (timeDiff > 0) {
                    const rxDiff = (current.totalPacketsReceived || 0) - (previous.totalPacketsReceived || 0);
                    const txDiff = (current.totalPacketsSent || 0) - (previous.totalPacketsSent || 0);
                    rate = Math.max(0, (rxDiff + txDiff) / timeDiff);
                  }
                }

                return {
                  timestamp: current.timestamp,
                  value: rate,
                };
              });

              console.log('[RegionPage] Packet rate data points:', packetRateData.length, 'Sample:', packetRateData.slice(0, 3));

              // Calculate baseline packet rate for activity health normalization
              const allPacketRates = packetRateData.map(p => p.value).filter(v => v > 0);
              const avgPacketRate = allPacketRates.length > 0 
                ? allPacketRates.reduce((sum, v) => sum + v, 0) / allPacketRates.length 
                : 0;
              const maxPacketRateForHealth = Math.max(avgPacketRate * 2, 100); // Use 2x average as max for normalization

              // Calculate credits earned over time
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

                if (previous && previousIndex >= 0) {
                  const prevCredits = previous.totalCredits || 0;
                  const currCredits = current.totalCredits || 0;
                  creditsEarned = currCredits - prevCredits;
                }

                return {
                  timestamp: current.timestamp,
                  value: creditsEarned,
                  _totalCredits: current.totalCredits,
                };
              });

              // Add current live data point if it's newer than last historical point
              const lastHistoricalTimestamp = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : 0;
              const currentTimestamp = Date.now();
              if (currentTimestamp - lastHistoricalTimestamp > 60000) { // More than 1 minute old
                // Calculate credits earned since last historical point
                const lastHistoricalCredits = sorted.length > 0 ? sorted[sorted.length - 1].totalCredits || 0 : 0;
                const currentTotalCredits = stats.totalCredits;
                const creditsEarnedSinceLast = currentTotalCredits - lastHistoricalCredits;

                console.log('[RegionPage] Adding current credit point:', {
                  lastHistorical: lastHistoricalCredits,
                  current: currentTotalCredits,
                  earned: creditsEarnedSinceLast,
                  timeDiff: (currentTimestamp - lastHistoricalTimestamp) / 1000 / 60 + ' mins'
                });

                creditsData.push({
                  timestamp: currentTimestamp,
                  value: creditsEarnedSinceLast,
                  _totalCredits: currentTotalCredits,
                });
              }

              // Log credit data for debugging large swings
              const largeSwings = creditsData.filter(d => Math.abs(d.value) > 100000);
              if (largeSwings.length > 0) {
                console.log('[RegionPage] Large credit swings detected:', largeSwings.map(d => ({
                  time: new Date(d.timestamp).toLocaleTimeString(),
                  change: d.value,
                  total: d._totalCredits
                })));
              }

              const maxPacketRate = Math.max(...packetRateData.map(d => d.value || 0), 1);
              const minCredits = Math.min(...creditsData.map(d => d.value || 0), 0);
              const maxCredits = Math.max(...creditsData.map(d => d.value || 0), 10);

              // CPU/RAM data
              const cpuData = filteredData
                .filter(d => d.avgCPU && d.avgCPU > 0)
                .map(d => ({
                  timestamp: d.timestamp,
                  value: d.avgCPU || 0,
                }));

              const ramData = filteredData.map(d => {
                const ramUsagePercent = d.avgRAM || 0;
                return {
                  timestamp: d.timestamp,
                  value: ramUsagePercent,
                };
              });

              const maxCPU = Math.max(...cpuData.map(d => d.value), 10);
              const maxRAM = Math.max(...ramData.map(d => d.value), 10);

              // Calculate network health score (composite metric)
              // Use the same formula weights as the standard calculateNetworkHealth function
              // - 40% Availability (online nodes)
              // - 35% Resource/Version Health (CPU/RAM efficiency as proxy for version health)
              // - 25% Activity Health (packet rate normalized to 0-100)
              const healthData = filteredData.map((d, idx) => {
                const onlineRate = d.totalNodes > 0 ? (d.onlineCount / d.totalNodes) * 100 : 0;

                // Resource health (CPU/RAM efficiency) - proxy for version health
                const cpuHealth = d.avgCPU !== undefined ? Math.max(0, 100 - d.avgCPU) : 100;
                const ramHealth = d.avgRAM !== undefined ? Math.max(0, 100 - d.avgRAM) : 100;
                const resourceHealth = (cpuHealth + ramHealth) / 2;

                // Activity health - normalize packet rate (0-100 scale)
                // Higher packet rates indicate more active/healthy network
                const currentPacketRate = packetRateData[idx]?.value || 0;
                const activityHealth = maxPacketRateForHealth > 0 
                  ? Math.min(100, (currentPacketRate / maxPacketRateForHealth) * 100)
                  : onlineRate; // Fallback to availability if no packet data

                // Use standard network health formula weights (aligned with calculateNetworkHealth)
                const healthScore = (
                  onlineRate * 0.40 +           // 40% Availability
                  resourceHealth * 0.35 +       // 35% Resource/Version Health
                  activityHealth * 0.25          // 25% Activity/Distribution
                );

                return {
                  timestamp: d.timestamp,
                  networkHealthScore: Math.min(100, Math.max(0, healthScore)),
                  networkHealthAvailability: onlineRate,
                  networkHealthVersion: resourceHealth, // Resource health as proxy for version health
                  networkHealthDistribution: activityHealth, // Activity health as proxy for distribution
                };
              });

              return (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    {/* Packet Earning Rate Chart */}
                    <div className="card">
                      <HistoricalLineChart
                        title="Network Activity (Packet Rate)"
                        data={packetRateData}
                        height={250}
                        yDomain={[0, maxPacketRate * 1.1]}
                        strokeColor="#3F8277"
                        yLabel="Packets/s"
                        yTickFormatter={(v) => formatNumber(v)}
                        tooltipFormatter={(d) => (
                          <div className="space-y-1">
                            <div className="text-xs text-foreground/60">
                              {timeFormat('%b %d, %H:%M')(new Date(d.timestamp))}
                            </div>
                            <div className="font-semibold text-[#3F8277]">
                              {formatNumber(d.value || 0)} packets/s
                            </div>
                          </div>
                        )}
                        headerContent={
                          <span className="text-xs text-muted-foreground">
                            Total packet rate across all nodes
                          </span>
                        }
                      />
                    </div>

                    {/* Credits Earned Chart */}
                    <div className="card">
                      <HistoricalLineChart
                        title="Credits Earned History"
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
                            <div className="space-y-1">
                              <div className="text-xs text-foreground/60">
                                {timeFormat('%b %d, %H:%M')(new Date(d.timestamp))}
                              </div>
                              <div className={`font-semibold ${isNegative ? 'text-red-400' : isPositive ? 'text-green-400' : 'text-foreground'}`}>
                                {isNegative ? 'Lost: ' : 'Earned: '}
                                {isPositive ? '+' : ''}{value.toFixed(0)} credits
                              </div>
                              {d._totalCredits !== undefined && (
                                <div className="text-xs text-foreground/60">
                                  Total: {d._totalCredits.toLocaleString()}
                                </div>
                              )}
                            </div>
                          );
                        }}
                        headerContent={
                          <span className="text-xs text-muted-foreground">
                            Credits change over 5-min windows
                          </span>
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* CPU Usage Chart */}
                    {cpuData.length > 0 && (
                      <div className="card">
                        <HistoricalLineChart
                          title="Average CPU Usage"
                          data={cpuData}
                          height={250}
                          yDomain={[0, 100]}
                          strokeColor="#F0A741"
                          yLabel="CPU %"
                          yTickFormatter={(v) => `${v.toFixed(0)}%`}
                          tooltipFormatter={(d) => (
                            <div className="space-y-1">
                              <div className="text-xs text-foreground/60">
                                {timeFormat('%b %d, %H:%M')(new Date(d.timestamp))}
                              </div>
                              <div className="font-semibold text-foreground">
                                {d.value.toFixed(1)}% CPU
                              </div>
                            </div>
                          )}
                          headerContent={
                            <span className="text-xs text-muted-foreground">
                              Avg CPU across reporting nodes
                            </span>
                          }
                        />
                      </div>
                    )}

                    {/* RAM Usage Chart */}
                    {ramData.length > 0 && (
                      <div className="card">
                        <HistoricalLineChart
                          title="Average RAM Usage"
                          data={ramData}
                          height={250}
                          yDomain={[0, 100]}
                          strokeColor="#9CA3AF"
                          yLabel="RAM %"
                          yTickFormatter={(v) => `${v.toFixed(0)}%`}
                          tooltipFormatter={(d) => (
                            <div className="space-y-1">
                              <div className="text-xs text-foreground/60">
                                {timeFormat('%b %d, %H:%M')(new Date(d.timestamp))}
                              </div>
                              <div className="font-semibold text-foreground">
                                {d.value.toFixed(1)}% RAM
                              </div>
                            </div>
                          )}
                          headerContent={
                            <span className="text-xs text-muted-foreground">
                              Avg RAM across reporting nodes
                            </span>
                          }
                        />
                      </div>
                    )}

                    {/* Network Health Chart */}
                    {healthData.length > 0 && (
                      <div className="card lg:col-span-2">
                        <NetworkHealthTrendChart historicalData={healthData} height={250} />
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
            </div>

            {/* Nodes Table - Collapsible */}
            <div className="flex flex-col animate-scale-in" style={{ animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}>
              <button
                onClick={() => setTableExpanded(!tableExpanded)}
                className="flex items-center justify-between p-4 card mb-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-[#F0A741]" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Nodes ({filteredAndSortedNodes.length})
                  </h2>
                </div>
                {tableExpanded ? (
                  <ChevronUp className="w-5 h-5 text-foreground/60" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-foreground/60" />
                )}
              </button>

              {tableExpanded && (
                <div className="card overflow-hidden flex flex-col" style={{ padding: 0 }}>
                  {/* Search Bar */}
                  <div className="p-4 border-b border-border/60">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground/40" />
                      <input
                        type="text"
                        placeholder="Search nodes by IP, public key, location, or version..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-card/50 border border-border/60 rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20 focus:border-[#F0A741]/30 transition-all"
                      />
                    </div>
                  </div>
                  {loading ? (
                    <TableSkeleton rows={10} columns={7} />
                  ) : (
                    <PNodeTable 
                      nodes={filteredAndSortedNodes}
                      onNodeClick={(node) => {
                        const nodeId = node.id || node.pubkey || node.publicKey || node.address?.split(':')[0] || '';
                        if (nodeId) {
                          router.push(`/nodes/${encodeURIComponent(nodeId)}`);
                        }
                      }}
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={(field) => {
                        if (sortBy === field) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(field);
                          setSortOrder('desc');
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CountryDetailPage() {
  return (
    <Suspense fallback={null}>
      <CountryDetailContent />
    </Suspense>
  );
}

