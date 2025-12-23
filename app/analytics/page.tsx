'use client';

import { useEffect, useState, useMemo } from 'react';
import { PNode } from '@/lib/types/pnode';
import NetworkHealthScoreDetailed from '@/components/NetworkHealthScoreDetailed';
import NetworkHealthTrendChart from '@/components/charts/NetworkHealthTrendChart';
import VersionDistribution from '@/components/VersionDistribution';
import NodeRankings from '@/components/NodeRankings';
import LatencyDistribution from '@/components/analytics/LatencyDistribution';
import ResourceUtilization from '@/components/analytics/ResourceUtilization';
import GeographicMetrics from '@/components/analytics/GeographicMetrics';
import NodeComparison from '@/components/analytics/NodeComparison';
import Header from '@/components/Header';
import WorldMapHeatmap from '@/components/WorldMapHeatmap';
import { useNodes } from '@/lib/context/NodesContext';
import { formatStorageBytes } from '@/lib/utils/storage';
import { Activity, HardDrive, TrendingUp, Server, BarChart3, Download, FileJson, FileSpreadsheet, ArrowDown, MemoryStick, Cpu, Award, Network } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startProgress } from '@/lib/nprogress';
import AnimatedNumber from '@/components/AnimatedNumber';

interface HistoricalDataPoint {
  timestamp: number;
  avgUptime: number;
  onlineCount: number;
  totalNodes: number;
  networkHealthScore?: number;
  networkHealthAvailability?: number;
  networkHealthVersion?: number;
  networkHealthDistribution?: number;
}

export default function AnalyticsPage() {
  // Use shared nodes data from context (fetched once, updated passively)
  const { nodes, loading, error, lastUpdate, selectedNetwork, setSelectedNetwork, availableNetworks, currentNetwork, refreshNodes } = useNodes();
  
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [healthPeriod, setHealthPeriod] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('7d');
  const router = useRouter();

  // Fetch historical data for charts (deferred to avoid blocking initial render)
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        // Use the new public API endpoint for network health history
        const url = `/api/v1/network/health/history?period=${healthPeriod}`;
        console.log('[Analytics] Fetching health history from', url, 'with period:', healthPeriod);
        console.log('[Analytics] Starting fetch request...');
        
        const fetchStartTime = Date.now();
        
        // Add timeout to fetch (45 seconds - matches backend)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.error('[Analytics] ❌ Fetch timeout after 45 seconds');
        }, 45000); // 45 second timeout
        
        let response: Response;
        try {
          response = await fetch(url, {
          cache: 'no-store', // Don't cache to ensure fresh data
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error('Request timeout - API took too long to respond');
          }
          throw fetchError;
        }
        
        const fetchDuration = Date.now() - fetchStartTime;
        console.log(`[Analytics] Fetch completed in ${fetchDuration}ms`);
        console.log('[Analytics] Health history API response status:', response.status, response.statusText);
        console.log('[Analytics] Response headers:', {
          contentType: response.headers.get('content-type'),
          ok: response.ok,
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('[Analytics] Health history API response:', {
            success: result.success,
            hasData: !!result.data,
            hasHealth: !!result.data?.health,
            healthLength: result.data?.health?.length || 0,
            fullResponse: result
          });
          
          // Transform health data to HistoricalDataPoint format
          if (result.success && result.data && Array.isArray(result.data.health)) {
            console.log('[Analytics] Health array length:', result.data.health.length);
            
            if (result.data.health.length === 0) {
              console.warn('[Analytics] ⚠️  Health array is empty - no historical data available');
              console.warn('[Analytics] Response summary:', {
                dataPoints: result.data.dataPoints,
                period: result.data.period,
                summary: result.data.summary,
              });
              setHistoricalData([]);
              return;
            }
            
            // Log sample of raw data before transformation
            console.log('[Analytics] Sample raw health data:', result.data.health.slice(0, 2));
            
            const transformed = result.data.health.map((snapshot: any) => {
              const dataPoint = {
              timestamp: snapshot.timestamp,
              avgUptime: 0, // Not provided by this endpoint
              onlineCount: snapshot.onlineNodes || 0,
              totalNodes: snapshot.totalNodes || 0,
              networkHealthScore: snapshot.overall,
              networkHealthAvailability: snapshot.availability,
              networkHealthVersion: snapshot.versionHealth,
              networkHealthDistribution: snapshot.distribution,
              };
              
              // Validate required fields
              if (snapshot.timestamp === undefined || snapshot.timestamp === null) {
                console.warn('[Analytics] ⚠️  Snapshot missing timestamp:', snapshot);
              }
              if (snapshot.overall === undefined || snapshot.overall === null) {
                console.warn('[Analytics] ⚠️  Snapshot missing overall score:', snapshot);
              }
              
              return dataPoint;
            }).filter((d: any) => {
              // Filter out invalid data points
              const isValid = d.timestamp !== undefined && d.timestamp !== null && d.networkHealthScore !== undefined && d.networkHealthScore !== null;
              if (!isValid) {
                console.warn('[Analytics] ⚠️  Filtered out invalid data point:', d);
              }
              return isValid;
            });
            
            console.log('[Analytics] Transformed health data:', transformed.length, 'valid points (from', result.data.health.length, 'total)');
            if (transformed.length > 0) {
              console.log('[Analytics] Sample transformed data:', transformed.slice(0, 3));
              console.log('[Analytics] Timestamp range:', {
                first: new Date(transformed[0].timestamp).toISOString(),
                last: new Date(transformed[transformed.length - 1].timestamp).toISOString(),
              });
            } else {
              console.error('[Analytics] ❌ All data points were filtered out as invalid!');
            }

            // Add current live health score as the final point to ensure consistency
            if (transformed.length > 0 && nodes.length > 0) {
              try {
                const { calculateNetworkHealth } = await import('@/lib/utils/network-health');
                const currentHealth = calculateNetworkHealth(nodes);
                const now = Date.now();

                // Only add if the last historical point is more than 1 hour old
                const lastHistorical = transformed[transformed.length - 1];
                if (lastHistorical && now - lastHistorical.timestamp > 3600000) { // 1 hour
                  transformed.push({
                    timestamp: now,
                    avgUptime: 0,
                    onlineCount: nodes.filter(n => n.status === 'online').length,
                    totalNodes: nodes.length,
                    networkHealthScore: currentHealth.overall,
                    networkHealthAvailability: currentHealth.availability,
                    networkHealthVersion: currentHealth.versionHealth,
                    networkHealthDistribution: currentHealth.distribution,
                  });
                  console.log('[Analytics] Added current live health score to historical data');
                }
              } catch (error) {
                console.warn('[Analytics] Failed to add current health to historical data:', error);
              }
            }

            setHistoricalData(transformed);
          } else {
            console.error('[Analytics] ❌ Health history API returned invalid format:', {
              success: result.success,
              hasData: !!result.data,
              hasHealth: !!result.data?.health,
              healthIsArray: Array.isArray(result.data?.health),
              dataType: typeof result.data,
              dataKeys: result.data ? Object.keys(result.data) : [],
              fullResult: result
            });
            setHistoricalData([]);
          }
        } else {
          console.error('[Analytics] ❌ Health history API returned non-OK status:', response.status, response.statusText);
          let errorText = '';
          try {
            errorText = await response.text();
            console.error('[Analytics] Error response body:', errorText);
            try {
              const errorJson = JSON.parse(errorText);
              console.error('[Analytics] Parsed error JSON:', errorJson);
            } catch (e) {
              console.error('[Analytics] Error response is not JSON');
            }
          } catch (textError) {
            console.error('[Analytics] Failed to read error response:', textError);
          }
          console.error('[Analytics] Health history API failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          setHistoricalData([]);
        }
      } catch (err: any) {
        console.error('[Analytics] ❌ Exception while fetching historical data:', {
          error: err?.message,
          stack: err?.stack,
          name: err?.name,
          cause: err?.cause,
          toString: err?.toString(),
        });
        // Failed to fetch historical data
        setHistoricalData([]);
      }
    };

    // Defer historical data fetch until after initial render
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        fetchHistoricalData();
      }, { timeout: 2000 });
    } else {
      setTimeout(() => {
        fetchHistoricalData();
      }, 100);
    }
  }, [selectedNetwork, healthPeriod]);

  // Export functions
  const exportToCSV = () => {
    const headers = ['ID', 'Status', 'Version', 'Address', 'Location', 'Uptime', 'Storage', 'CPU %', 'RAM %'];
    const rows = nodes.map(node => [
      node.id || node.pubkey || node.publicKey || '',
      node.status || '',
      node.version || '',
      node.address || '',
      node.locationData?.city && node.locationData?.country 
        ? `${node.locationData.city}, ${node.locationData.country}` 
        : '',
      node.uptime ? Math.floor(node.uptime / 86400) + 'd' : '',
      node.storageCapacity ? formatStorageBytes(node.storageCapacity) : '',
      node.cpuPercent?.toFixed(1) || '',
      node.ramUsed && node.ramTotal ? ((node.ramUsed / node.ramTotal) * 100).toFixed(1) : '',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xandeum-nodes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const json = JSON.stringify(nodes, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xandeum-nodes-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const onlineNodes = nodes.filter(n => n.status === 'online').length;
    const offlineNodes = nodes.filter(n => n.status === 'offline').length;
    const syncingNodes = nodes.filter(n => n.status === 'syncing').length;
    const totalStorageCapacity = nodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0);
    const totalStorageUsed = nodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0);
    const nodesWithStorage = nodes.filter(n => n.storageCapacity && n.storageCapacity > 0).length;
    const nodesWithStorageUsage = nodes.filter(n => n.storageCapacity && n.storageUsed !== undefined && n.storageCapacity > 0);
    const avgStorageUsage = nodesWithStorageUsage.length > 0
      ? nodesWithStorageUsage.reduce((sum, n) => {
          const usage = n.storageCapacity && n.storageUsed ? (n.storageUsed / n.storageCapacity) * 100 : 0;
          return sum + usage;
        }, 0) / nodesWithStorageUsage.length
      : 0;
    const avgUptime = nodes
      .filter(n => n.uptime && n.uptime > 0)
      .reduce((sum, n) => sum + (n.uptime || 0), 0) / nodes.filter(n => n.uptime && n.uptime > 0).length || 0;
    
    // RAM metrics
    const totalRAM = nodes.reduce((sum, n) => sum + (n.ramTotal || 0), 0);
    const usedRAM = nodes.reduce((sum, n) => sum + (n.ramUsed || 0), 0);
    const nodesWithRAM = nodes.filter(n => n.ramTotal !== undefined);
    const avgRAMUsage = nodesWithRAM.length > 0
      ? nodesWithRAM.reduce((sum, n) => {
          const usage = n.ramTotal && n.ramUsed ? (n.ramUsed / n.ramTotal) * 100 : 0;
          return sum + usage;
        }, 0) / nodesWithRAM.length
      : 0;
    
    // CPU metrics
    const nodesWithCPU = nodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null);
    const avgCPU = nodesWithCPU.length > 0
      ? nodesWithCPU.reduce((sum, n) => sum + (n.cpuPercent || 0), 0) / nodesWithCPU.length
      : 0;
    
    // Credits metrics
    const nodesWithCredits = nodes.filter(n => n.credits !== undefined && n.credits !== null);
    const totalCredits = nodesWithCredits.reduce((sum, n) => sum + (n.credits || 0), 0);
    
    // Active Streams
    const totalActiveStreams = nodes.reduce((sum, n) => sum + (n.activeStreams || 0), 0);
    const nodesWithStreams = nodes.filter(n => n.activeStreams !== undefined && n.activeStreams !== null && n.activeStreams > 0).length;

    return {
      totalNodes: nodes.length,
      onlineNodes,
      offlineNodes,
      syncingNodes,
      totalStorageCapacity,
      totalStorageUsed,
      nodesWithStorage,
      avgStorageUsage,
      nodesWithStorageUsage: nodesWithStorageUsage.length,
      avgUptime,
      totalRAM,
      usedRAM,
      avgRAMUsage,
      avgCPU,
      nodesWithCPU: nodesWithCPU.length,
      nodesWithRAM: nodesWithRAM.length,
      totalCredits,
      nodesWithCredits: nodesWithCredits.length,
      totalActiveStreams,
      nodesWithStreams,
    };
  }, [nodes]);

  // Show loading skeleton when loading and no data
  if (loading && nodes.length === 0) {
    return (
      <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
        <Header
          activePage="analytics"
          loading={true}
          onRefresh={() => {}}
          showNetworkSelector={false}
        />

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
            {/* Hero */}
            <div className="card" style={{ borderRadius: '1rem', padding: '1.25rem 1.5rem' }}>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                Network Analytics
              </h1>
              <p className="text-foreground/60 text-sm sm:text-base">
                Comprehensive insights and metrics
              </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Total Nodes', icon: Server },
                { label: 'Online Nodes', icon: TrendingUp },
                { label: 'Total Storage', icon: HardDrive },
                { label: 'Network Health', icon: Activity },
              ].map((stat) => (
                <div key={stat.label} className="card-stat">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">{stat.label}</span>
                    <stat.icon className="w-4 h-4 text-foreground/40" />
                  </div>
                  <div className="h-8 w-20 bg-muted/40 rounded animate-pulse" />
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card">
                  <div className="h-[300px] w-full bg-muted/10 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
      {/* Header */}
      <Header
        activePage="analytics"
        nodeCount={nodes.length}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={() => refreshNodes()}
        networks={availableNetworks}
        currentNetwork={currentNetwork}
        onNetworkChange={(networkId) => {
          setSelectedNetwork(networkId);
        }}
        showNetworkSelector={false}
      />

      <main className="flex-1 overflow-hidden">
        <div className="h-full w-full px-3 sm:px-6 pt-3 sm:pt-6 pb-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto pb-8">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                    <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                    Network Analytics
                  </h1>
                  <p className="text-foreground/60 text-sm sm:text-base">
                    Comprehensive analytics and insights into the network
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportToCSV}
                    disabled={nodes.length === 0}
                    className="px-3 py-2 text-sm bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg border border-border/60 transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    title="Export as CSV"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={exportToJSON}
                    disabled={nodes.length === 0}
                    className="px-3 py-2 text-sm bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg border border-border/60 transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    title="Export as JSON"
                  >
                    <FileJson className="w-4 h-4" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>
            </div>

          {/* Node Comparison Section - Accordion Style */}
          <div className="card overflow-hidden mt-4 sm:mt-6" style={{ padding: 0 }}>
            {/* Header - Clickable */}
            <button
              onClick={() => {
                setIsComparisonOpen(!isComparisonOpen);
              }}
              className="w-full px-4 py-3 text-left hover:bg-muted/10 transition-all duration-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                    isComparisonOpen 
                      ? 'bg-[#F0A741]/20 text-[#F0A741]' 
                      : 'bg-muted/40 text-foreground/60'
                  }`}>
                    <Server className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-sm font-semibold text-foreground">
                        Node Comparison
                      </h2>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#F0A741]/10 text-[#F0A741] border border-[#F0A741]/20">
                        Tool
                      </span>
                    </div>
                    <p className="text-xs text-foreground/60 line-clamp-1">
                      Compare up to 3 nodes side-by-side to analyze performance metrics and make informed decisions.
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ArrowDown className={`w-4 h-4 text-foreground/40 transition-transform duration-300 ${isComparisonOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </button>

            {/* Content - Collapsible */}
            <div 
              className={`transition-all duration-300 ease-in-out ${
                isComparisonOpen ? 'max-h-[6000px] opacity-100' : 'max-h-0 opacity-0'
              }`}
              style={{ overflow: isComparisonOpen ? 'visible' : 'hidden', minHeight: isComparisonOpen ? '420px' : '0' }}
            >
              <div 
                id="node-comparison" 
                className="px-4 pb-4 pt-2"
                style={{ overflow: 'visible', minHeight: '420px' }}
              >
                <NodeComparison nodes={nodes} />
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6 stagger-children">
            <div className="card-stat card-hover group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide transition-colors duration-300 group-hover:text-foreground">Total Nodes</span>
                <Server className="w-4 h-4 text-foreground/40 transition-all duration-300 group-hover:scale-110 group-hover:text-[#F0A741]" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground transition-all duration-300 group-hover:scale-105">
                <AnimatedNumber value={stats.totalNodes} />
              </div>
              <p className="text-xs text-muted-foreground mt-1 transition-colors duration-300 group-hover:text-foreground/70">Across all discovered networks</p>
            </div>

            <div className="card-stat card-hover group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide transition-colors duration-300 group-hover:text-foreground">Online</span>
                <Activity className="w-4 h-4 text-foreground/40 transition-all duration-300 group-hover:scale-110 group-hover:text-[#3F8277]" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground transition-all duration-300 group-hover:scale-105">
                <AnimatedNumber value={stats.onlineNodes} />
              </div>
              <div className="text-xs text-foreground/50 mt-1 transition-colors duration-300 group-hover:text-foreground/70 flex items-baseline">
                {stats.totalNodes > 0 ? (
                  <>
                    <AnimatedNumber value={Math.round((stats.onlineNodes / stats.totalNodes) * 100)} suffix="%" /> <span className="ml-1">of network</span>
                  </>
                ) : (
                  '0% of network'
                )}
              </div>
            </div>

            <div className="card-stat card-hover group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide transition-colors duration-300 group-hover:text-foreground">Storage</span>
                <HardDrive className="w-4 h-4 text-foreground/40 transition-all duration-300 group-hover:scale-110 group-hover:text-[#F0A741]" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground transition-all duration-300 group-hover:scale-105">
                {stats.totalStorageCapacity > 0 ? formatStorageBytes(stats.totalStorageCapacity) : 'N/A'}
              </div>
              <div className="text-xs text-foreground/50 mt-1 transition-colors duration-300 group-hover:text-foreground/70">
                {stats.avgStorageUsage > 0 ? (
                  <>
                    <AnimatedNumber value={stats.avgStorageUsage} decimals={1} suffix="%" className="align-baseline" /> <span className="align-baseline">avg usage</span>
                  </>
                ) : (
                  'N/A'
                )}
              </div>
            </div>

            <div className="card-stat card-hover group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide transition-colors duration-300 group-hover:text-foreground">RAM</span>
                <MemoryStick className="w-4 h-4 text-foreground/40 transition-all duration-300 group-hover:scale-110 group-hover:text-[#F0A741]" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground transition-all duration-300 group-hover:scale-105">
                {stats.totalRAM > 0 ? formatStorageBytes(stats.totalRAM) : 'N/A'}
              </div>
              <div className="text-xs text-foreground/50 mt-1 transition-colors duration-300 group-hover:text-foreground/70">
                {stats.avgRAMUsage > 0 ? (
                  <>
                    <AnimatedNumber value={stats.avgRAMUsage} decimals={1} suffix="%" className="align-baseline" /> <span className="align-baseline">avg usage</span>
                  </>
                ) : (
                  'N/A'
                )}
              </div>
            </div>

            <div className="card-stat card-hover group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide transition-colors duration-300 group-hover:text-foreground">CPU</span>
                <Cpu className="w-4 h-4 text-foreground/40 transition-all duration-300 group-hover:scale-110 group-hover:text-[#F0A741]" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground transition-all duration-300 group-hover:scale-105">
                {stats.avgCPU > 0 ? (
                  <AnimatedNumber value={stats.avgCPU} decimals={1} suffix="%" />
                ) : (
                  'N/A'
                )}
              </div>
              <div className="text-xs text-foreground/50 mt-1 transition-colors duration-300 group-hover:text-foreground/70">
                <AnimatedNumber value={stats.nodesWithCPU} className="align-baseline" /> <span className="align-baseline">nodes reporting</span>
              </div>
            </div>

            <div className="card-stat card-hover group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide transition-colors duration-300 group-hover:text-foreground">Avg Uptime</span>
                <TrendingUp className="w-4 h-4 text-foreground/40 transition-all duration-300 group-hover:scale-110 group-hover:text-[#F0A741]" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground transition-all duration-300 group-hover:scale-105">
                {stats.avgUptime > 0 
                  ? `${Math.floor(stats.avgUptime / 86400)}d ${Math.floor((stats.avgUptime % 86400) / 3600)}h`
                  : 'N/A'}
              </div>
              <div className="text-xs text-foreground/50 mt-1 transition-colors duration-300 group-hover:text-foreground/70">
                <AnimatedNumber value={nodes.filter(n => n.uptime && n.uptime > 0).length} className="align-baseline" /> <span className="align-baseline">nodes reporting</span>
              </div>
            </div>

            <div className="card-stat card-hover group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide transition-colors duration-300 group-hover:text-foreground">Total Credits</span>
                <Award className="w-4 h-4 text-foreground/40 transition-all duration-300 group-hover:scale-110 group-hover:text-[#F0A741]" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground transition-all duration-300 group-hover:scale-105">
                {stats.totalCredits > 0 ? (
                  <AnimatedNumber value={stats.totalCredits} />
                ) : (
                  'N/A'
                )}
              </div>
              <div className="text-xs text-foreground/50 mt-1 transition-colors duration-300 group-hover:text-foreground/70 flex items-baseline">
                <AnimatedNumber value={stats.nodesWithCredits} /> <span className="ml-1">nodes reporting</span>
              </div>
            </div>

            <div className="card-stat card-hover group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide transition-colors duration-300 group-hover:text-foreground">Active Streams</span>
                <Network className="w-4 h-4 text-foreground/40 transition-all duration-300 group-hover:scale-110 group-hover:text-[#3F8277]" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground transition-all duration-300 group-hover:scale-105">
                {stats.totalActiveStreams > 0 ? (
                  <AnimatedNumber value={stats.totalActiveStreams} />
                ) : (
                  'N/A'
                )}
              </div>
              <div className="text-xs text-foreground/50 mt-1 transition-colors duration-300 group-hover:text-foreground/70 flex items-baseline">
                <AnimatedNumber value={stats.nodesWithStreams} /> <span className="ml-1">nodes active</span>
              </div>
            </div>
          </div>

          {/* World Map Heatmap */}
          <div className="mt-4 sm:mt-6">
            <WorldMapHeatmap nodes={nodes} />
          </div>

          {/* Main Analytics Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6 mb-0">
            {/* Row 1: Health Score */}
            <div className="card flex flex-col animate-scale-in" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
              <NetworkHealthScoreDetailed nodes={nodes} />
            </div>
            {/* Row 1: Network Health Trend Chart */}
            <div className="lg:col-span-2 card flex flex-col animate-slide-in-right" style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-foreground/40" />
                <h2 className="text-base font-semibold text-foreground">Network Health Trend</h2>
                </div>
                <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 border border-border/40">
                  {(['1h', '6h', '24h', '7d', '30d'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setHealthPeriod(period)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-200 ${
                        healthPeriod === period
                          ? 'bg-[#F0A741] text-black shadow-sm'
                          : 'text-foreground/60 hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {period.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <NetworkHealthTrendChart 
                  historicalData={historicalData}
                  height={300}
                />
              </div>
            </div>

            {/* Row 2: Version Distribution */}
            <div className="card flex flex-col animate-fade-in" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
              <VersionDistribution nodes={nodes} />
            </div>
            {/* Row 2: Performance Metrics */}
            <div className="lg:col-span-2 card flex flex-col animate-slide-in-bottom" style={{ animationDelay: '0.25s', opacity: 0, animationFillMode: 'forwards' }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-foreground/40" />
                <h2 className="text-base font-semibold text-foreground">Performance Metrics</h2>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <LatencyDistribution nodes={nodes} />
                <ResourceUtilization nodes={nodes} />
              </div>
            </div>

            {/* Row 3: Top Nodes */}
            <div className="card flex flex-col animate-slide-in-left" style={{ animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}>
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-foreground/40" />
                <h2 className="text-base font-semibold text-foreground">Top Nodes</h2>
              </div>
              <div className="flex-1">
                <NodeRankings 
                  nodes={nodes} 
                  onNodeClick={(node) => {
                    const nodeId = node.id || node.pubkey || node.publicKey || node.address?.split(':')[0] || '';
                    if (nodeId) {
                      startProgress();
                      router.push(`/nodes/${encodeURIComponent(nodeId)}`);
                    }
                  }}
                />
              </div>
            </div>
            {/* Row 3: Geographic Metrics */}
            <div className="lg:col-span-2 card flex flex-col animate-scale-in" style={{ animationDelay: '0.35s', opacity: 0, animationFillMode: 'forwards' }}>
              <GeographicMetrics nodes={nodes} />
            </div>
          </div>
          </div>
        </div>
      </main>

    </div>
  );
}

