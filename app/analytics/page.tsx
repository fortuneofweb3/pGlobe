'use client';

import { useEffect, useState, useMemo } from 'react';
import { PNode } from '@/lib/types/pnode';
import NetworkHealthChart from '@/components/charts/NetworkHealthChart';
import NetworkHealthScoreDetailed from '@/components/NetworkHealthScoreDetailed';
import VersionDistribution from '@/components/VersionDistribution';
import NetworkInsights from '@/components/NetworkInsights';
import NodeRankings from '@/components/NodeRankings';
import LatencyDistribution from '@/components/analytics/LatencyDistribution';
import ResourceUtilization from '@/components/analytics/ResourceUtilization';
import GeographicMetrics from '@/components/analytics/GeographicMetrics';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { formatStorageBytes } from '@/lib/utils/storage';
import { Activity, HardDrive, TrendingUp, Server, BarChart3, Download, FileJson, FileSpreadsheet } from 'lucide-react';

interface HistoricalDataPoint {
  timestamp: number;
  avgUptime: number;
  onlineCount: number;
  totalNodes: number;
}

export default function AnalyticsPage() {
  // Use shared nodes data from context (fetched once, updated passively)
  const { nodes, loading, error, lastUpdate, selectedNetwork, setSelectedNetwork, availableNetworks, currentNetwork, refreshNodes } = useNodes();
  
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [activeTab, setActiveTab] = useState<'insights' | 'events'>('insights');

  // Fetch historical data for charts (only when needed)
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedNetwork) {
          params.set('network', selectedNetwork);
        }
        params.set('history', 'true');
        const response = await fetch(`/api/pnodes?${params.toString()}`);
        const data = await response.json();
        if (data.historicalData) {
          setHistoricalData(data.historicalData);
        }
      } catch (err) {
        console.error('Failed to fetch historical data:', err);
      }
    };
    
    // Fetch historical data on mount and when network changes
    fetchHistoricalData();
  }, [selectedNetwork]);

  // Export functions
  const exportToCSV = () => {
    const headers = ['ID', 'Status', 'Version', 'Address', 'Location', 'Uptime', 'Storage Used', 'CPU %', 'RAM %'];
    const rows = nodes.map(node => [
      node.id || node.pubkey || node.publicKey || '',
      node.status || '',
      node.version || '',
      node.address || '',
      node.locationData?.city && node.locationData?.country 
        ? `${node.locationData.city}, ${node.locationData.country}` 
        : '',
      node.uptime ? Math.floor(node.uptime / 86400) + 'd' : '',
      node.storageUsed ? formatStorageBytes(node.storageUsed) : '',
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
    const totalStorage = nodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0);
    const nodesWithStorage = nodes.filter(n => n.storageUsed && n.storageUsed > 0).length;
    const avgUptime = nodes
      .filter(n => n.uptime && n.uptime > 0)
      .reduce((sum, n) => sum + (n.uptime || 0), 0) / nodes.filter(n => n.uptime && n.uptime > 0).length || 0;

    return {
      totalNodes: nodes.length,
      onlineNodes,
      offlineNodes,
      syncingNodes,
      totalStorage,
      nodesWithStorage,
      avgUptime,
    };
  }, [nodes]);

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

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
          {/* Hero */}
          <div className="bg-card/40 border border-border/60 rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <BarChart3 className="w-4 h-4 text-foreground/40" />
                  Network Analytics
                </div>
                <h1 className="text-xl sm:text-2xl font-bold leading-tight">Health, performance, and capacity at a glance</h1>
                <p className="text-xs sm:text-sm text-foreground/70">
                  Real-time view of pNode availability, storage footprint, and version rollout.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <div className="px-3 sm:px-4 py-2 rounded-xl bg-[#3F8277]/10 border border-[#3F8277]/30 text-xs sm:text-sm font-semibold text-[#3F8277]">
                  {nodes.length} nodes tracked
                </div>
                <div className="px-3 sm:px-4 py-2 rounded-xl bg-muted/30 border border-border text-xs sm:text-sm font-mono text-foreground/80">
                  {lastUpdate ? `Last update ${lastUpdate.toLocaleTimeString()}` : 'Updating...'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportToCSV}
                    disabled={nodes.length === 0}
                    className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg border border-border/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2"
                    title="Export as CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">CSV</span>
                  </button>
                  <button
                    onClick={exportToJSON}
                    disabled={nodes.length === 0}
                    className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg border border-border/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 sm:gap-2"
                    title="Export as JSON"
                  >
                    <FileJson className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">JSON</span>
                  </button>
                </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Total Nodes</span>
                <Server className="w-4 h-4 text-foreground/40" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.totalNodes}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all discovered networks</p>
            </div>

            <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Online</span>
                <Activity className="w-4 h-4 text-foreground/40" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">{stats.onlineNodes}</div>
              <div className="text-xs text-foreground/50 mt-1">
                {stats.totalNodes > 0 ? Math.round((stats.onlineNodes / stats.totalNodes) * 100) : 0}% of network
              </div>
            </div>

            <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Total Storage</span>
                <HardDrive className="w-4 h-4 text-foreground/40" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {stats.totalStorage > 0 ? formatStorageBytes(stats.totalStorage) : 'N/A'}
              </div>
              <div className="text-xs text-foreground/50 mt-1">
                {stats.nodesWithStorage} nodes reporting
              </div>
            </div>

            <div className="bg-card/50 border border-border rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Avg Uptime</span>
                <TrendingUp className="w-4 h-4 text-foreground/40" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {stats.avgUptime > 0 
                  ? `${Math.floor(stats.avgUptime / 86400)}d ${Math.floor((stats.avgUptime % 86400) / 3600)}h`
                  : 'N/A'}
              </div>
              <div className="text-xs text-foreground/50 mt-1">
                {nodes.filter(n => n.uptime && n.uptime > 0).length} nodes reporting
              </div>
            </div>
          </div>

          {/* Main Analytics Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Left Sidebar */}
            <div className="lg:col-span-1 space-y-3 sm:space-y-4">
              <div className="bg-card/50 border border-border rounded-xl p-4">
                <NetworkHealthScoreDetailed nodes={nodes} />
              </div>

              <div className="bg-card/50 border border-border rounded-xl p-4">
                <VersionDistribution nodes={nodes} />
              </div>

              <div className="bg-card/50 border border-border rounded-xl p-4">
                <h3 className="text-xs font-semibold text-foreground/60 mb-3 uppercase tracking-wide">Top Nodes</h3>
                <NodeRankings nodes={nodes} />
              </div>

              <div className="bg-card/50 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setActiveTab('insights')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'insights'
                        ? 'bg-[#F0A741]/20 text-[#F0A741]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Insights
                  </button>
                  <button
                    onClick={() => setActiveTab('events')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'events'
                        ? 'bg-[#F0A741]/20 text-[#F0A741]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Events
                  </button>
                </div>
                {activeTab === 'insights' && <NetworkInsights nodes={nodes} />}
                {activeTab === 'events' && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <p>Event tracking coming soon</p>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-3 sm:space-y-4">
              <div className="bg-card/50 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-foreground/40" />
                  <h2 className="text-base font-semibold text-foreground">Network Health</h2>
                </div>
                <NetworkHealthChart nodes={nodes} />
              </div>

              <div className="bg-card/50 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-foreground/40" />
                  <h2 className="text-base font-semibold text-foreground">Performance Metrics</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <LatencyDistribution nodes={nodes} />
                  <ResourceUtilization nodes={nodes} />
                </div>
              </div>

              <div className="bg-card/50 border border-border rounded-xl p-4">
                <GeographicMetrics nodes={nodes} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

