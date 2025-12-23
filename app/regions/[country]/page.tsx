'use client';

import { useMemo, useState, Suspense, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { startProgress } from '@/lib/nprogress';
import Link from 'next/link';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { getFlagForCountry } from '@/lib/utils/country-flags';
import { formatStorageBytes } from '@/lib/utils/storage';
import { formatPacketRate } from '@/lib/utils/packet-rates';
import { calculateNetworkHealth } from '@/lib/utils/network-health';
import { ArrowLeft, MapPin, Server, TrendingUp, Activity, HardDrive, Award, Clock, Zap, ChevronDown, ChevronUp, Search, BarChart3, Info } from 'lucide-react';
import AnimatedNumber from '@/components/AnimatedNumber';
import PNodeTable from '@/components/PNodeTable';
import { PNode } from '@/lib/types/pnode';
import { TableSkeleton, CardSkeleton, ChartSkeleton } from '@/components/Skeletons';
import ResourceUtilization from '@/components/analytics/ResourceUtilization';
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
          const length = path.getTotalLength();
          if (length === 0) {
            allPathsReady = false;
          }
        } catch (e) {
          allPathsReady = false;
        }
      });

      if (!allPathsReady) {
        // Retry if paths not ready
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
            const highlightedData = hoveredIndex === null || chartData.length === 0
              ? chartData
              : chartData.slice(0, hoveredIndex + 1);

            const dimmedData = hoveredIndex === null || chartData.length === 0
              ? []
              : chartData.slice(hoveredIndex);

            return (
              <>
                <svg
                  ref={svgRef}
                  width={width}
                  height={height}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
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
                          <LinePath
                                data={validHighlightedData}
                            x={(d) => xScale(d.timestamp)}
                            y={(d) => yScale(d[line.key] ?? 0)}
                            stroke={line.color}
                            strokeWidth={3}
                                strokeOpacity={1}
                            curve={curveMonotoneX}
                          />
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
                          <g ref={pathGroupRef} key={`single-${dataKey || 'loading'}`} className="line-initial-hidden">
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
  
  // Stabilization refs to prevent flickering node counts
  const stableNodeCountRef = useRef<number | null>(null);
  const nodeCountHistoryRef = useRef<number[]>([]);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  // Normalize country name for comparison (case-insensitive, trimmed)
  const normalizedCountryName = useMemo(() => {
    return countryName.trim().toLowerCase();
  }, [countryName]);

  // Filter nodes by country with robust matching
  const countryNodes = useMemo(() => {
    const filtered = nodes.filter(node => {
      const nodeCountry = node.locationData?.country?.trim().toLowerCase();
      
      // Match by country name (case-insensitive)
      return nodeCountry === normalizedCountryName;
    });
    
    // Get country code from first node if available (for fallback matching)
    const countryCode = filtered[0]?.locationData?.countryCode?.trim().toLowerCase();
    
    // If we have a country code, also include nodes that match by country code
    // This helps when country names might vary slightly
    if (countryCode) {
      const additionalNodes = nodes.filter(node => {
        // Skip if already included
        const nodeCountry = node.locationData?.country?.trim().toLowerCase();
        if (nodeCountry === normalizedCountryName) return false;
        
        // Match by country code
        const nodeCountryCode = node.locationData?.countryCode?.trim().toLowerCase();
        return nodeCountryCode === countryCode;
      });
      
      return [...filtered, ...additionalNodes];
    }
    
    return filtered;
  }, [nodes, normalizedCountryName]);

  // Stabilize node count to prevent flickering
  const stabilizedNodeCount = useMemo(() => {
    const currentCount = countryNodes.length;
    const now = Date.now();
    
    // If this is the first time or we're loading, use current count
    if (stableNodeCountRef.current === null || loading) {
      stableNodeCountRef.current = currentCount;
      nodeCountHistoryRef.current = [currentCount];
      lastUpdateTimeRef.current = now;
      return currentCount;
    }
    
    // Track recent counts
    nodeCountHistoryRef.current.push(currentCount);
    // Keep only last 5 counts (to detect patterns)
    if (nodeCountHistoryRef.current.length > 5) {
      nodeCountHistoryRef.current.shift();
    }
    
    // If count hasn't changed, keep using stable count
    if (currentCount === stableNodeCountRef.current) {
      lastUpdateTimeRef.current = now;
      return currentCount;
    }
    
    // If count changed, check if it's a persistent change
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    const recentCounts = nodeCountHistoryRef.current;
    const mostCommonRecentCount = recentCounts.reduce((a, b, _, arr) => 
      arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
    );
    
    // Only update if:
    // 1. The change has persisted for at least 2 seconds, OR
    // 2. The new count appears in majority of recent samples, OR
    // 3. The count increased (nodes were added)
    const changePersisted = timeSinceLastUpdate > 2000;
    const majorityMatch = mostCommonRecentCount === currentCount && 
                          recentCounts.filter(c => c === currentCount).length >= 3;
    const countIncreased = currentCount > stableNodeCountRef.current;
    
    if (changePersisted || majorityMatch || countIncreased) {
      stableNodeCountRef.current = currentCount;
      lastUpdateTimeRef.current = now;
      return currentCount;
    }
    
    // Otherwise, keep previous stable count to prevent flickering
    return stableNodeCountRef.current;
  }, [countryNodes.length, loading]);

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
      totalNodes: stabilizedNodeCount,
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
  }, [countryNodes, stabilizedNodeCount]);

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
            {/* Header Section - Complete Redesign */}
            {countryCode && (() => {
              const flagUrl = `/api/flag-proxy?code=${countryCode.toLowerCase()}`;
              const onlinePercent = stats.totalNodes > 0 ? Math.round((stats.onlineNodes / stats.totalNodes) * 100) : 0;
              const uniqueCities = new Set(countryNodes.map(n => n.locationData?.city).filter(Boolean));
              const locationText = uniqueCities.size > 1
                ? `${uniqueCities.size} cities across ${countryCode}`
                : uniqueCities.size === 1
                  ? `${Array.from(uniqueCities)[0]}, ${countryCode}`
                  : countryCode;
              
              return (
                <div className="mb-8 space-y-6">
                  {/* Back Button */}
                  <Link 
                    href="/regions" 
                    className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors group"
                  >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    <span>Back to Regions</span>
                  </Link>

                  {/* Main Header Card */}
                  <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card shadow-lg">
                    {/* Flag Background - Fully Visible */}
                    <div className="absolute inset-0">
                      <img
                        src={flagUrl}
                        alt={countryName}
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                      />
                      {/* Gradient overlay for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
                    </div>

                    <div className="relative p-4 sm:p-6 lg:p-10">
                      {/* Mobile Layout: Essential Stats */}
                      <div className="sm:hidden space-y-4">
                        {/* Title */}
                        <div>
                          <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight drop-shadow-lg">
                            {countryName}
                          </h1>
                          <div className="flex items-center gap-2 text-foreground/80 drop-shadow">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="text-sm">{locationText}</span>
                          </div>
                        </div>

                        {/* Essential Stats Only - 2 columns */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Online Status */}
                          <div className="bg-[#3F8277]/20 border border-[#3F8277]/40 rounded-lg p-3 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-2 h-2 rounded-full bg-[#3F8277] animate-pulse" />
                              <span className="text-[10px] font-medium text-foreground/90 uppercase tracking-wide">Online</span>
                            </div>
                            <div className="text-xl font-bold text-[#3F8277] mb-0.5">
                              <AnimatedNumber value={onlinePercent} suffix="%" />
                            </div>
                            <div className="text-[10px] text-foreground/70">
                              {stats.onlineNodes} of {stats.totalNodes}
                            </div>
                          </div>

                          {/* Total Nodes */}
                          <div className="bg-[#F0A741]/20 border border-[#F0A741]/40 rounded-lg p-3 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Server className="w-3.5 h-3.5 text-[#F0A741]" />
                              <span className="text-[10px] font-medium text-foreground/90 uppercase tracking-wide">Nodes</span>
                            </div>
                            <div className="text-xl font-bold text-[#F0A741] mb-0.5">
                              <AnimatedNumber value={stats.totalNodes} />
                            </div>
                            <div className="text-[10px] text-foreground/70">
                              {stats.offlineNodes > 0 ? `${stats.offlineNodes} offline` : 'All online'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desktop Layout: Full Stats */}
                      <div className="hidden sm:block">
                        {/* Title Section */}
                        <div className="mb-8">
                          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3 tracking-tight drop-shadow-lg">
                            {countryName}
                          </h1>
                          <div className="flex items-center gap-2 text-foreground/80 drop-shadow">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="text-sm sm:text-base">{locationText}</span>
                          </div>
                        </div>

                        {/* Key Metrics - Primary Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                          {/* Online Status */}
                          <div className="bg-gradient-to-br from-[#3F8277]/20 to-[#3F8277]/10 border border-[#3F8277]/40 rounded-lg p-4 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-[#3F8277] animate-pulse" />
                              <span className="text-xs font-medium text-foreground/90 uppercase tracking-wide">Online</span>
                            </div>
                            <div className="text-2xl sm:text-3xl font-bold text-[#3F8277] mb-1 drop-shadow">
                              <AnimatedNumber value={onlinePercent} suffix="%" />
                            </div>
                            <div className="text-xs text-foreground/70">
                              {stats.onlineNodes} of {stats.totalNodes} nodes
                            </div>
                          </div>

                          {/* Total Nodes */}
                          <div className="bg-gradient-to-br from-[#F0A741]/20 to-[#F0A741]/10 border border-[#F0A741]/40 rounded-lg p-4 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <Server className="w-4 h-4 text-[#F0A741]" />
                              <span className="text-xs font-medium text-foreground/90 uppercase tracking-wide">Nodes</span>
                            </div>
                            <div className="text-2xl sm:text-3xl font-bold text-[#F0A741] mb-1 drop-shadow">
                              <AnimatedNumber value={stats.totalNodes} />
                            </div>
                            <div className="text-xs text-foreground/70">
                              {stats.offlineNodes > 0 && `${stats.offlineNodes} offline`}
                              {stats.offlineNodes === 0 && stats.syncingNodes > 0 && `${stats.syncingNodes} syncing`}
                              {stats.offlineNodes === 0 && stats.syncingNodes === 0 && 'All operational'}
                            </div>
                          </div>

                          {/* Storage */}
                          <div className="bg-background/40 border border-border/50 rounded-lg p-4 backdrop-blur-sm hover:border-[#F0A741]/50 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                              <HardDrive className="w-4 h-4 text-[#F0A741]" />
                              <span className="text-xs font-medium text-foreground/90 uppercase tracking-wide">Storage</span>
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-foreground mb-1 drop-shadow">
                              {formatStorageBytes(stats.totalStorage)}
                            </div>
                            <div className="text-xs text-foreground/70">
                              {stats.usedStorage > 0 && stats.totalStorage > 0
                                ? `${((stats.usedStorage / stats.totalStorage) * 100).toFixed(1)}% used`
                                : 'Available'}
                            </div>
                          </div>

                          {/* Credits */}
                          <div className="bg-background/40 border border-border/50 rounded-lg p-4 backdrop-blur-sm hover:border-[#3F8277]/50 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                              <Award className="w-4 h-4 text-[#3F8277]" />
                              <span className="text-xs font-medium text-foreground/90 uppercase tracking-wide">Credits</span>
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-foreground mb-1 drop-shadow">
                              {stats.totalCredits > 0 ? (
                                <AnimatedNumber value={stats.totalCredits} />
                              ) : (
                                <span className="text-foreground/60">N/A</span>
                              )}
                            </div>
                            <div className="text-xs text-foreground/70">
                              {stats.nodesReportingCredits > 0 
                                ? `${stats.nodesReportingCredits} nodes reporting`
                                : 'No data'}
                            </div>
                          </div>
                        </div>

                        {/* Secondary Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* CPU */}
                          <div className="bg-background/40 border border-border/40 rounded-lg p-3 hover:border-border/60 transition-colors backdrop-blur-sm">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Activity className="w-3.5 h-3.5 text-foreground/70" />
                              <span className="text-[10px] sm:text-xs font-medium text-foreground/80 uppercase">CPU</span>
                            </div>
                            <div className="text-lg sm:text-xl font-semibold text-foreground drop-shadow">
                              {stats.avgCPU > 0 ? (
                                <AnimatedNumber value={stats.avgCPU} decimals={1} suffix="%" />
                              ) : (
                                <span className="text-foreground/60 text-sm">N/A</span>
                              )}
                            </div>
                          </div>

                          {/* RAM */}
                          <div className="bg-background/40 border border-border/40 rounded-lg p-3 hover:border-border/60 transition-colors backdrop-blur-sm">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Zap className="w-3.5 h-3.5 text-foreground/70" />
                              <span className="text-[10px] sm:text-xs font-medium text-foreground/80 uppercase">RAM</span>
                            </div>
                            <div className="text-lg sm:text-xl font-semibold text-foreground drop-shadow">
                              {stats.avgRAMUsage > 0 ? (
                                <AnimatedNumber value={stats.avgRAMUsage} decimals={1} suffix="%" />
                              ) : (
                                <span className="text-foreground/60 text-sm">N/A</span>
                              )}
                            </div>
                          </div>

                          {/* Latency */}
                          <div className="bg-background/40 border border-border/40 rounded-lg p-3 hover:border-border/60 transition-colors backdrop-blur-sm">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Clock className="w-3.5 h-3.5 text-foreground/70" />
                              <span className="text-[10px] sm:text-xs font-medium text-foreground/80 uppercase">Latency</span>
                            </div>
                            <div className="text-lg sm:text-xl font-semibold text-foreground drop-shadow">
                              {stats.avgLatency > 0 ? (
                                <>
                                  <AnimatedNumber value={stats.avgLatency} />
                                  <span className="text-xs text-foreground/70 ml-1">ms</span>
                                </>
                              ) : (
                                <span className="text-foreground/60 text-sm">N/A</span>
                              )}
                            </div>
                          </div>

                          {/* Packet Rate */}
                          <div className="bg-background/40 border border-border/40 rounded-lg p-3 hover:border-border/60 transition-colors backdrop-blur-sm">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <TrendingUp className="w-3.5 h-3.5 text-foreground/70" />
                              <span className="text-[10px] sm:text-xs font-medium text-foreground/80 uppercase">Activity</span>
                            </div>
                            <div className="text-lg sm:text-xl font-semibold text-foreground drop-shadow">
                              {stats.avgPacketRate > 0 ? (
                                <>
                                  <AnimatedNumber value={stats.avgPacketRate} decimals={1} />
                                  <span className="text-xs text-foreground/70 ml-1">p/s</span>
                                </>
                              ) : (
                                <span className="text-foreground/60 text-sm">N/A</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Header (fallback if no country code) */}
            {!countryCode && (
              <div className="mb-8 space-y-6">
                <Link 
                  href="/regions" 
                  className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors group"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  <span>Back to Regions</span>
                </Link>

                <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-card/95 shadow-lg p-6 sm:p-8 lg:p-10">
                  <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3 tracking-tight">
                      {countryName}
                    </h1>
                    <p className="text-foreground/60 text-sm sm:text-base">
                      {stats.totalNodes} node{stats.totalNodes !== 1 ? 's' : ''} in this region
                    </p>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-[#3F8277]/10 to-[#3F8277]/5 border border-[#3F8277]/20 rounded-lg p-4">
                      <div className="text-xs font-medium text-foreground/70 uppercase tracking-wide mb-2">Online</div>
                      <div className="text-2xl sm:text-3xl font-bold text-[#3F8277]">
                        {stats.onlineNodes}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-[#F0A741]/10 to-[#F0A741]/5 border border-[#F0A741]/20 rounded-lg p-4">
                      <div className="text-xs font-medium text-foreground/70 uppercase tracking-wide mb-2">Total Nodes</div>
                      <div className="text-2xl sm:text-3xl font-bold text-[#F0A741]">
                        <AnimatedNumber value={stats.totalNodes} />
                      </div>
                    </div>
                    <div className="bg-background/30 border border-border/30 rounded-lg p-4">
                      <div className="text-xs font-medium text-foreground/60 uppercase tracking-wide mb-2">Storage</div>
                      <div className="text-xl sm:text-2xl font-semibold text-foreground">
                        {formatStorageBytes(stats.totalStorage)}
                      </div>
                    </div>
                    <div className="bg-background/30 border border-border/30 rounded-lg p-4">
                      <div className="text-xs font-medium text-foreground/60 uppercase tracking-wide mb-2">Credits</div>
                      <div className="text-xl sm:text-2xl font-semibold text-foreground">
                        {stats.totalCredits > 0 ? (
                          <AnimatedNumber value={stats.totalCredits} />
                        ) : (
                          <span className="text-foreground/40">N/A</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
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

              {/* Charts - Always show, with empty axes when loading or no data */}
              {(() => {
              // Always show charts, even if no data (they'll show empty axes)
              const now = Date.now();
              const timeRangeMs = {
                '30m': 30 * 60 * 1000,
                '1h': 60 * 60 * 1000,
                '24h': 24 * 60 * 60 * 1000,
                '1w': 7 * 24 * 60 * 60 * 1000,
              };
              const cutoffTime = now - timeRangeMs[timeRange];
              const filteredData = historicalData.length > 0 
                ? historicalData.filter(d => d.timestamp >= cutoffTime)
                : [];

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

              // Only add a current point if the last historical point is old enough (> 5 minutes)
              // This prevents huge spikes from accumulating changes over long periods
              const lastHistoricalTimestamp = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : 0;
              const currentTimestamp = Date.now();
              const currentTotalCredits = stats.totalCredits;
              const timeSinceLastHistorical = currentTimestamp - lastHistoricalTimestamp;
              
              // Only add/update a current point if the gap is reasonable
              // This prevents huge spikes from accumulating changes over long periods
              if (creditsData.length > 0) {
                const lastPoint = creditsData[creditsData.length - 1];
                const lastPointTimestamp = lastPoint.timestamp;
                const timeSinceLastPoint = currentTimestamp - lastPointTimestamp;
                
                // Only add a new point if:
                // 1. It's been at least 5 minutes since the last point (meaningful window)
                // 2. It's been less than 30 minutes since the last point (prevent huge gaps)
                // This ensures we show reasonable 5-minute windows, not accumulated changes over hours
                if (timeSinceLastPoint >= FIVE_MINUTES_MS && timeSinceLastPoint <= 30 * 60 * 1000) {
                  const lastPointTotal = lastPoint._totalCredits ?? (sorted.length > 0 ? sorted[sorted.length - 1].totalCredits || 0 : 0);
                  const creditsEarnedSinceLastPoint = currentTotalCredits - lastPointTotal;

                  console.log('[RegionPage] Adding current credit point:', {
                    lastPointTotal,
                    current: currentTotalCredits,
                    earned: creditsEarnedSinceLastPoint,
                    timeDiff: (timeSinceLastPoint / 1000 / 60).toFixed(1) + ' mins'
                  });

                  creditsData.push({
                    timestamp: currentTimestamp,
                    value: creditsEarnedSinceLastPoint,
                    _totalCredits: currentTotalCredits,
                  });
                } else {
                  // Gap is too short (< 5 min) or too long (> 30 min)
                  // Just update the last point's total for tooltip accuracy
                  // But don't change the value (delta) to avoid spikes
                  lastPoint._totalCredits = currentTotalCredits;
                }
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

              // Network health data - format same as other charts
              // Calculate from backend fields (availability, version, distribution) if networkHealthScore not available
              const healthData = filteredData.map((d: any) => {
                // First, try to use networkHealthScore from backend
                if (d.networkHealthScore !== undefined && d.networkHealthScore !== null && !isNaN(d.networkHealthScore)) {
                  return {
                    timestamp: d.timestamp,
                    value: d.networkHealthScore,
                  };
                }
                
                // Fallback: Calculate from component fields if available
                if (d.networkHealthAvailability !== undefined && d.networkHealthVersion !== undefined && d.networkHealthDistribution !== undefined) {
                  const calculated = Math.round(
                    (d.networkHealthAvailability || 0) * 0.40 +
                    (d.networkHealthVersion || 0) * 0.35 +
                    (d.networkHealthDistribution || 0) * 0.25
                  );
                  return {
                    timestamp: d.timestamp,
                    value: calculated,
                  };
                }
                
                // Last resort: Calculate from basic availability if we have node counts
                if (d.totalNodes > 0 && d.onlineCount !== undefined) {
                  const availability = (d.onlineCount / d.totalNodes) * 100;
                  // Use availability as a simplified health score (better than nothing)
                return {
                  timestamp: d.timestamp,
                    value: Math.round(availability * 0.40), // At least show availability component
                  };
                }
                
                // If we have absolutely nothing, return null (will be filtered out)
                return null;
              }).filter((d): d is { timestamp: number; value: number } => d !== null);
              
              console.log('[RegionPage] Health data processing:', {
                filteredDataLength: filteredData.length,
                healthDataLength: healthData.length,
                sampleRaw: filteredData.slice(0, 3).map((d: any) => ({
                  timestamp: new Date(d.timestamp).toISOString(),
                  hasNetworkHealthScore: 'networkHealthScore' in d,
                  networkHealthScore: d.networkHealthScore,
                  networkHealthAvailability: d.networkHealthAvailability,
                  networkHealthVersion: d.networkHealthVersion,
                  networkHealthDistribution: d.networkHealthDistribution,
                  onlineCount: d.onlineCount,
                  totalNodes: d.totalNodes,
                  allKeys: Object.keys(d),
                })),
                sampleProcessed: healthData.slice(0, 3),
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
                            {packetRateData.length === 0 && loadingHistory ? 'Loading data...' : packetRateData.length > 0 ? 'Total packet rate across all nodes' : 'No data available'}
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
                          const formatted = formatCredits(v);
                          return v > 0 ? `+${formatted}` : formatted;
                        }}
                        tooltipFormatter={(d) => {
                          const value = d.value || 0;
                          const isPositive = value > 0;
                          const isNegative = value < 0;
                          // If this is the most recent point, use current total from stats for accuracy
                          const isMostRecent = creditsData.length > 0 && d.timestamp === creditsData[creditsData.length - 1].timestamp;
                          const displayTotal = isMostRecent ? stats.totalCredits : (d._totalCredits ?? 0);
                          return (
                            <div className="space-y-1">
                              <div className="text-xs text-foreground/60">
                                {timeFormat('%b %d, %H:%M')(new Date(d.timestamp))}
                              </div>
                              <div className={`font-semibold ${isNegative ? 'text-red-400' : isPositive ? 'text-green-400' : 'text-foreground'}`}>
                                {isNegative ? 'Lost: ' : 'Earned: '}
                                {isPositive ? '+' : ''}{formatCredits(value)} credits
                              </div>
                              <div className="text-xs text-foreground/60">
                                Total: {displayTotal.toLocaleString()}
                              </div>
                            </div>
                          );
                        }}
                        headerContent={
                          <div className="flex items-center gap-1.5 group relative">
                            <span className="text-xs text-muted-foreground">
                              Credits change over 5-min windows
                            </span>
                            <div className="relative">
                              <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help transition-colors" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-zinc-900 border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                <p className="text-xs text-foreground/80 leading-relaxed">
                                  Credit changes may fluctuate when nodes go online/offline. Nodes earn credits for responding to heartbeats and lose credits for missing data requests.
                                </p>
                              </div>
                            </div>
                          </div>
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* CPU Usage Chart - Always show, empty axes when no data */}
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
                            {cpuData.length === 0 && loadingHistory ? 'Loading data...' : cpuData.length > 0 ? 'Avg CPU across reporting nodes' : 'No data available'}
                            </span>
                          }
                        />
                      </div>

                    {/* RAM Usage Chart - Always show, empty axes when no data */}
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
                            {ramData.length === 0 && loadingHistory ? 'Loading data...' : ramData.length > 0 ? 'Avg RAM across reporting nodes' : 'No data available'}
                            </span>
                          }
                        />
                      </div>

                    {/* Network Health Chart - Always show, empty axes when no data */}
                      <div className="card lg:col-span-2">
                      <HistoricalLineChart
                        title="Network Health Trend"
                        data={healthData}
                        height={250}
                        yDomain={[0, 100]}
                        strokeColor="#F0A741"
                        yLabel="Health Score"
                        yTickFormatter={(v) => `${v.toFixed(0)}%`}
                        tooltipFormatter={(d) => (
                          <div className="space-y-1">
                            <div className="text-xs text-foreground/60">
                              {timeFormat('%b %d, %H:%M')(new Date(d.timestamp))}
                            </div>
                            <div className="font-semibold text-foreground">
                              {d.value.toFixed(1)}% Health
                            </div>
                      </div>
                    )}
                        headerContent={
                          <span className="text-xs text-muted-foreground">
                            {loadingHistory ? 'Loading data...' : healthData.length > 0 ? 'Overall health score for this region' : 'No data available'}
                          </span>
                        }
                      />
                    </div>
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
                          startProgress();
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

