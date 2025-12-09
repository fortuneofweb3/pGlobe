'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PNode } from '@/lib/types/pnode';
import StatsCard from '@/components/StatsCard';
import MapLibreGlobe from '@/components/MapLibreGlobe';
import NetworkSelector from '@/components/NetworkSelector';
import Header from '@/components/Header';
import InfoTooltip, { MetricRow } from '@/components/InfoTooltip';
import { enrichNodesWithGeo } from '@/lib/utils/geo';
import { formatStorageBytes } from '@/lib/utils/storage';
import { Activity, Server, HardDrive, TrendingUp, RefreshCw, BarChart3, Network, Award, Clock, Zap, Info } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import { NetworkConfig } from '@/lib/server/network-config';
import { useNodes } from '@/lib/context/NodesContext';

// Helper function to format uptime seconds as human-readable duration
function formatUptimeDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface HistoricalDataPoint {
  timestamp: number;
  avgUptime: number;
  onlineCount: number;
  totalNodes: number;
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Use shared nodes data from context (fetched once, updated passively)
  const { nodes, loading, error, lastUpdate, selectedNetwork, setSelectedNetwork, availableNetworks, currentNetwork, refreshNodes } = useNodes();
  
  const [dataSource, setDataSource] = useState<'prpc' | 'mock' | 'gossip' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [versionFilter, setVersionFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('reputation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [customEndpoint, setCustomEndpoint] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60); // 1 minute (60 seconds)
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [nodesWithGeo, setNodesWithGeo] = useState<PNode[]>([]);
  const [geoEnriching, setGeoEnriching] = useState(false);
  const [globeSearchQuery, setGlobeSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [navigateToNodeId, setNavigateToNodeId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Geo enrichment for map display (runs when nodes update from context)
  useEffect(() => {
    if (nodes.length > 0) {
      // Check if nodes already have geo data
      const hasGeoData = nodes.some(n => n.locationData?.lat !== undefined);
      if (hasGeoData) {
        setNodesWithGeo(nodes);
      } else {
        // Enrich with geo data in background (non-blocking)
        setNodesWithGeo(nodes); // Show immediately
        setGeoEnriching(true);
        enrichNodesWithGeo(nodes)
          .then((enriched) => {
            setNodesWithGeo(enriched);
            setGeoEnriching(false);
          })
          .catch(() => setGeoEnriching(false));
      }
    }
  }, [nodes]);

  // Data is now fetched and updated passively by NodesContext
  // No need for manual fetching or polling here

  // Handle node navigation from query parameter
  useEffect(() => {
    const nodeParam = searchParams.get('node');
    if (nodeParam && nodes.length > 0 && nodesWithGeo.length > 0) {
      // Find the node by pubkey, publicKey, id, or IP address in nodesWithGeo (nodes with location)
      const node = nodesWithGeo.find(n => 
        n.pubkey === nodeParam || 
        n.publicKey === nodeParam || 
        n.id === nodeParam ||
        n.address?.split(':')[0] === nodeParam
      );
      
      if (node) {
        // Use the most reliable identifier (pubkey > publicKey > id)
        const nodeIdentifier = node.pubkey || node.publicKey || node.id;
        
        console.log('[Navigation] Navigating to node:', {
          nodeIdentifier,
          fromParam: nodeParam,
          nodePubkey: node.pubkey,
          nodePublicKey: node.publicKey,
          nodeId: node.id,
          nodeAddress: node.address,
          hasLocation: !!node.locationData
        });
        
        setNavigateToNodeId(nodeIdentifier);
        
        // Remove query parameter from URL immediately (don't wait)
        router.replace('/', { scroll: false });
        
        // Clear the navigation ID after navigation completes (longer delay to ensure navigation happens)
        setTimeout(() => {
          console.log('[Navigation] Clearing navigateToNodeId');
          setNavigateToNodeId(null);
        }, 3000); // 3 seconds to allow navigation to complete
      } else {
        console.log('[Navigation] Node not found for param:', nodeParam, 'in', nodesWithGeo.length, 'nodes with geo');
      }
    }
  }, [searchParams, nodes, nodesWithGeo, router]);

  const filteredAndSortedNodes = useMemo(() => {
    let filtered = [...nodes];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((node) =>
        node.id?.toLowerCase().includes(query) ||
        node.publicKey?.toLowerCase().includes(query) ||
        node.pubkey?.toLowerCase().includes(query) ||
          node.address?.toLowerCase().includes(query) ||
          node.location?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((node) => node.status === statusFilter);
    }

    if (versionFilter !== 'all') {
      filtered = filtered.filter((node) => node.version === versionFilter);
    }

    filtered.sort((a, b) => {
      const aValue = a[sortBy as keyof PNode];
      const bValue = b[sortBy as keyof PNode];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });

    return filtered;
  }, [nodes, searchQuery, statusFilter, versionFilter, sortBy, sortOrder]);

  const stats = useMemo(() => {
    // Always use the full nodes array for stats, not nodesWithGeo
    const totalNodes = nodes.length;
    console.debug('[Overview] Stats calculated:', { totalNodes, nodesLength: nodes.length, nodesWithGeoLength: nodesWithGeo.length });
    const onlineNodes = nodes.filter((n) => n.status === 'online').length;
    
    // Storage metrics
    const usedStorage = nodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0);
    const totalCapacity = nodes.reduce((sum, n) => sum + (n.storageCapacity || n.storageCommitted || 0), 0);
    const nodesWithCapacity = nodes.filter(n => (n.storageCapacity || n.storageCommitted || 0) > 0).length;
    const usagePercents = nodes
      .map(n => {
        const used = n.storageUsed || 0;
        const cap = n.storageCapacity || n.storageCommitted || 0;
        if (cap > 0) return (used / cap) * 100;
        return null;
      })
      .filter((v): v is number => v !== null);
    const avgStorageUsagePercent = usagePercents.length > 0
      ? usagePercents.reduce((sum, v) => sum + v, 0) / usagePercents.length
      : 0;
    const usedVsCapacityPercent = totalCapacity > 0 ? (usedStorage / totalCapacity) * 100 : 0;
    
    // Uptime metrics - uptime is in seconds, calculate average as human-readable duration
    const nodesWithUptime = nodes.filter(n => n.uptime !== undefined && n.uptime > 0);
    const avgUptimeSeconds = nodesWithUptime.length > 0
      ? nodesWithUptime.reduce((sum, n) => sum + (n.uptime || 0), 0) / nodesWithUptime.length
      : 0;
    
    // CPU metrics
    const nodesWithCPU = nodes.filter(n => n.cpuPercent !== undefined);
    const avgCPU = nodesWithCPU.length > 0
      ? nodesWithCPU.reduce((sum, n) => sum + (n.cpuPercent || 0), 0) / nodesWithCPU.length
      : 0;
    
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
    
    // Latency metrics - only include nodes seen in gossip (active nodes)
    const nodesWithLatency = nodes.filter(n => 
      n.latency !== undefined && 
      n.latency !== null && 
      n.seenInGossip !== false // Exclude nodes not seen in gossip (offline)
    );
    const avgLatency = nodesWithLatency.length > 0
      ? nodesWithLatency.reduce((sum, n) => sum + (n.latency || 0), 0) / nodesWithLatency.length
      : 0;
    
    // Network metrics
    const totalPacketsReceived = nodes.reduce((sum, n) => sum + (n.packetsReceived || 0), 0);
    const totalPacketsSent = nodes.reduce((sum, n) => sum + (n.packetsSent || 0), 0);
    const totalActiveStreams = nodes.reduce((sum, n) => sum + (n.activeStreams || 0), 0);
    
    // Credits (from on-chain or heartbeat system)
    const nodesWithCredits = nodes.filter(n => n.credits !== undefined);
    const totalCredits = nodesWithCredits.reduce((sum, n) => sum + (n.credits || 0), 0);
    const avgCredits = nodesWithCredits.length > 0
      ? totalCredits / nodesWithCredits.length
      : 0;

    return {
      totalNodes,
      onlineNodes,
      usedStorage,
      totalCapacity,
      nodesWithCapacity,
      avgStorageUsagePercent,
      usedVsCapacityPercent,
      avgUptime: avgUptimeSeconds, // Now in seconds, format in UI
      avgCPU,
      totalRAM,
      usedRAM,
      avgRAMUsage,
      avgLatency,
      totalPacketsReceived,
      totalPacketsSent,
      totalActiveStreams,
      totalCredits,
      avgCredits,
    };
  }, [nodes]);


  const versions = useMemo(() => {
    const versionSet = new Set<string>();
    nodes.forEach((node) => {
      if (node.version) versionSet.add(node.version);
    });
    return Array.from(versionSet).sort();
  }, [nodes]);

  // Search results for globe search bar
  const globeSearchResults = useMemo(() => {
    if (!globeSearchQuery.trim()) return [];
    
    const query = globeSearchQuery.toLowerCase().trim();
    const results = nodes.filter((node) => {
      const pubkey = (node.pubkey || node.publicKey || '').toLowerCase();
      const address = (node.address || '').toLowerCase();
      const id = (node.id || '').toLowerCase();
      const city = (node.locationData?.city || '').toLowerCase();
      const country = (node.locationData?.country || '').toLowerCase();
      
      return (
        pubkey.includes(query) ||
        address.includes(query) ||
        id.includes(query) ||
        city.includes(query) ||
        country.includes(query)
      );
    });
    
    // Limit to top 10 results
    return results.slice(0, 10);
  }, [nodes, globeSearchQuery]);

  // Handle clicking outside search to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle node selection from search
  const handleNodeSelect = useCallback((node: PNode) => {
    setGlobeSearchQuery('');
    setShowSearchResults(false);
    // Navigate to the node on the globe
    setNavigateToNodeId(node.id);
    // Clear the navigation ID after a short delay to allow re-navigation to same node
    setTimeout(() => setNavigateToNodeId(null), 100);
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col" style={{ backgroundColor: '#000000' }}>
      {/* Header - Fixed at top */}
      <Header
        activePage="overview"
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

      {/* Main Content Area - Header, Sidebars, and Map */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-80 flex-shrink-0 bg-black/90 backdrop-blur-md border-r border-[#FFD700]/20 overflow-y-auto z-40">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xs font-semibold text-foreground/60 mb-4 uppercase tracking-wide">Network Stats</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/70">Total Nodes</span>
                  <span className="text-sm font-semibold text-foreground">{stats.totalNodes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/70 flex items-center gap-1.5">
                    Online
                    <InfoTooltip content="Seen in gossip network within last 5 minutes" />
                  </span>
                  <span className="text-sm font-semibold text-[#00FF88]">{stats.onlineNodes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/70 flex items-center gap-1.5">
                    Syncing
                    <InfoTooltip content="Seen within last hour, still synchronizing with network" />
                  </span>
                  <span className="text-sm font-semibold text-[#FFD700]">
                    {nodes.filter(n => n.status === 'syncing').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/70 flex items-center gap-1.5">
                    Offline
                    <InfoTooltip content="Not seen in gossip network for over an hour" />
                  </span>
                  <span className="text-sm font-semibold text-red-400">
                    {nodes.filter(n => n.status === 'offline').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Performance</h2>
                <InfoTooltip content="Stats from nodes with public pRPC only (~10 of 135 nodes). Most operators keep pRPC private (localhost-only) for security.">
                  <span className="text-xs text-muted-foreground">
                    {nodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent > 0).length}/{nodes.length} reporting
                  </span>
                </InfoTooltip>
              </div>
              <div className="space-y-3">
                <MetricRow
                  label="Avg Uptime"
                  value={stats.avgUptime > 0 ? formatUptimeDuration(stats.avgUptime) : 'N/A'}
                  valueColor="text-[#00FF88]"
                  tooltip="Average time nodes have been running continuously. Calculated from nodes reporting uptime stats."
                />
                <MetricRow
                  label="Avg CPU"
                  value={stats.avgCPU > 0 ? `${stats.avgCPU.toFixed(1)}%` : 'N/A'}
                  tooltip="Average CPU utilization across all nodes with public stats. Shows how much of each node's processor capacity is being used. Lower typically means more headroom."
                />
                <MetricRow
                  label="Avg RAM"
                  value={stats.avgRAMUsage > 0 ? `${stats.avgRAMUsage.toFixed(1)}%` : 'N/A'}
                  tooltip="Average memory (RAM) usage as percentage of total available RAM on each node. Shows how much memory pNode software is consuming."
                />
                <MetricRow
                  label="Avg Latency"
                  value={stats.avgLatency > 0 ? `${stats.avgLatency.toFixed(0)}ms` : 'N/A'}
                  tooltip="Average pRPC response time measured server-side when fetching node stats. Lower is better - indicates faster network communication between nodes."
                />
            </div>
          </div>

            <div className="pt-6 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Storage</h2>
                {stats.usedStorage === 0 && (
                  <InfoTooltip content="Storage data requires nodes with public pRPC. Most nodes keep pRPC private for security.">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3 text-foreground/40" />
                      Limited
                    </span>
                  </InfoTooltip>
                )}
              </div>
              <div className="space-y-3">
                <MetricRow
                  label="Total Used"
                  value={formatStorageBytes(stats.usedStorage)}
                  tooltip="Total data stored across all reporting nodes. This is actual dApp data being served by the pNode network."
                />
                <MetricRow
                  label="Total Capacity"
                  value={formatStorageBytes(stats.totalCapacity)}
                  tooltip="Sum of storage capacity reported by nodes that share it (storage_committed)."
                />
                <MetricRow
                  label="Used vs Capacity"
                  value={stats.totalCapacity > 0 ? `${stats.usedVsCapacityPercent.toFixed(1)}%` : 'N/A'}
                  tooltip="Network-wide utilization: total used divided by total reported capacity."
                />
                <MetricRow
                  label="Avg Node Utilization"
                  value={stats.avgStorageUsagePercent > 0 ? `${stats.avgStorageUsagePercent.toFixed(1)}%` : 'N/A'}
                  tooltip="Average per-node utilization (used ÷ capacity) across nodes that report both metrics."
                />
              </div>
                  </div>

            {/* Network Activity Section */}
            <div className="pt-6 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Network Activity</h2>
                <InfoTooltip content="From nodes with public pRPC only. Most nodes keep pRPC private.">
                  <span className="text-xs text-muted-foreground">
                    {nodes.filter(n => n.packetsReceived !== undefined && n.packetsReceived > 0).length}/{nodes.length}
                  </span>
                </InfoTooltip>
              </div>
              <div className="space-y-3">
                <MetricRow
                  label="Active Streams"
                  value={stats.totalActiveStreams > 0 ? stats.totalActiveStreams.toLocaleString() : 'N/A'}
                  valueColor="text-[#00FF88]"
                  tooltip="Total active network connections across all nodes. Streams are peer-to-peer connections for data transfer."
                />
                <MetricRow
                  label="Packets Received"
                  value={stats.totalPacketsReceived > 0 ? `${stats.totalPacketsReceived.toLocaleString()}/s` : 'N/A'}
                  tooltip="Current network packets received per second across all reporting nodes (rate, not all-time total)."
                />
                <MetricRow
                  label="Packets Sent"
                  value={stats.totalPacketsSent > 0 ? `${stats.totalPacketsSent.toLocaleString()}/s` : 'N/A'}
                  tooltip="Current network packets sent per second across all reporting nodes (rate, not all-time total)."
                />
              </div>
                  </div>
                </div>
        </aside>

        {/* Center - Map */}
        <main className="flex-1 relative overflow-hidden">
          {/* Search Bar - Top of Globe */}
          <div 
            ref={searchContainerRef}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md"
          >
            <SearchBar
              value={globeSearchQuery}
              onChange={(value) => {
                setGlobeSearchQuery(value);
                setShowSearchResults(true);
              }}
              placeholder="Search nodes by pubkey, address, or location..."
              showClearButton={true}
              onClear={() => {
                setShowSearchResults(false);
                searchInputRef.current?.focus();
              }}
              onFocus={() => setShowSearchResults(true)}
              inputRef={searchInputRef}
            >
              {/* Search Results Dropdown */}
              {showSearchResults && globeSearchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 backdrop-blur-md border border-[#FFD700]/20 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
                  {globeSearchResults.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No nodes found
                    </div>
                  ) : (
                    <div className="py-2">
                      {globeSearchResults.map((node) => (
                        <button
                          key={node.id}
                          onClick={() => handleNodeSelect(node)}
                          className="w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors border-b border-border/20 last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-mono text-foreground truncate">
                                {node.pubkey || node.publicKey || node.id}
                              </div>
                              {node.address && (
                                <div className="text-xs text-muted-foreground mt-1 truncate">
                                  {node.address}
                                </div>
                              )}
                              {node.locationData?.city && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {node.locationData.city}
                                  {node.locationData.country && `, ${node.locationData.country}`}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  node.status === 'online'
                                    ? 'bg-green-500/20 text-green-400'
                                    : node.status === 'syncing'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {node.status || 'offline'}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </SearchBar>
          </div>

          <div className="absolute inset-0 w-full h-full">
                      <MapLibreGlobe 
                        nodes={nodesWithGeo.length > 0 ? nodesWithGeo : nodes}
                        navigateToNodeId={navigateToNodeId}
                      />
                      {geoEnriching && (
              <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/90 backdrop-blur-md rounded-2xl px-4 py-2">
                <p className="text-xs text-foreground font-mono">
                          Loading geographic data...
                        </p>
              </div>
                      )}
                    </div>
        </main>

      </div>

      {/* Error Banner - Floating Overlay */}
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/90 backdrop-blur-md rounded-2xl px-4 py-2 pointer-events-auto shadow-lg">
          <p className="text-sm text-red-400 font-mono">{error}</p>
          </div>
        )}
    </div>
  );
}
