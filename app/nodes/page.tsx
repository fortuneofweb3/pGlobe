'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PNode } from '@/lib/types/pnode';
import PNodeTable from '@/components/PNodeTable';
import Header from '@/components/Header';
import NodeDetailsModal from '@/components/NodeDetailsModal';
import { useNodes } from '@/lib/context/NodesContext';
import { Filter, ChevronDown, RefreshCw } from 'lucide-react';
import SearchBar from '@/components/SearchBar';

function NodesPageContent() {
  const searchParams = useSearchParams();
  // Use shared nodes data from context (fetched once, updated passively)
  const { nodes, loading, error, lastUpdate, selectedNetwork, setSelectedNetwork, availableNetworks, currentNetwork, refreshNodes } = useNodes();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [versionFilter, setVersionFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('reputation');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedNode, setSelectedNode] = useState<PNode | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check for node query parameter and open modal
  useEffect(() => {
    const nodeId = searchParams.get('node');
    if (nodeId && nodes.length > 0) {
      const node = nodes.find(n => n.id === nodeId || n.pubkey === nodeId || n.publicKey === nodeId);
      if (node) {
        setSelectedNode(node);
        setIsModalOpen(true);
        // Clear the query parameter from URL
        window.history.replaceState({}, '', '/nodes');
      }
    }
  }, [searchParams, nodes]);

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
      if (statusFilter === 'offline') {
        // Include offline, syncing, and nodes without status
        filtered = filtered.filter((node) => 
          node.status === 'offline' || 
          node.status === 'syncing' || 
          !node.status
        );
      } else {
        filtered = filtered.filter((node) => node.status === statusFilter);
      }
    }

    if (versionFilter !== 'all') {
      filtered = filtered.filter((node) => node.version === versionFilter);
    }

    filtered.sort((a, b) => {
      // First, sort by online status (seenInGossip) - online nodes first
      const aIsOnline = a.seenInGossip !== false;
      const bIsOnline = b.seenInGossip !== false;
      
      if (aIsOnline !== bIsOnline) {
        // Online nodes (true) come before offline nodes (false)
        return aIsOnline ? -1 : 1;
      }
      
      // If both are same online status, sort by the selected criteria
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
  }, [nodes, searchQuery, statusFilter, versionFilter, sortBy, sortOrder]);

  const versions = useMemo(() => {
    const versionSet = new Set<string>();
    nodes.forEach((node) => {
      if (node.version) versionSet.add(node.version);
    });
    return Array.from(versionSet).sort();
  }, [nodes]);

  // Calculate status counts for filter
  const statusCounts = useMemo(() => {
    return {
      all: nodes.length,
      online: nodes.filter(n => n.status === 'online').length,
      offline: nodes.filter(n => n.status === 'offline' || n.status === 'syncing' || !n.status).length,
    };
  }, [nodes]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'all': return `All (${statusCounts.all})`;
      case 'online': return `Online (${statusCounts.online})`;
      case 'offline': return `Offline (${statusCounts.offline})`;
      default: return 'All';
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
      {/* Header */}
      <Header
        activePage="nodes"
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

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full w-full p-6">
          <div className="h-full flex flex-col">
            {/* Search and Filters Bar */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                {/* Search Bar */}
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                    placeholder="Search by IP, public key, or location..."
                  className="flex-1 min-w-[250px]"
                  />

                {/* Status Filter Dropdown */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="appearance-none pl-4 pr-10 py-2.5 bg-card/50 border border-border/60 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-border transition-all cursor-pointer"
                  >
                    <option value="all">All ({statusCounts.all})</option>
                    <option value="online">Online ({statusCounts.online})</option>
                    <option value="offline">Offline ({statusCounts.offline})</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
                </div>

                {/* Version Filter Dropdown */}
                <div className="relative">
                  <select
                    value={versionFilter}
                    onChange={(e) => setVersionFilter(e.target.value)}
                    className="appearance-none pl-4 pr-10 py-2.5 bg-card/50 border border-border/60 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-border transition-all cursor-pointer"
                  >
                    <option value="all">All Versions</option>
                    {versions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
                </div>

                {/* Sort Dropdown */}
                <div className="relative">
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split('-');
                      setSortBy(field);
                      setSortOrder(order as 'asc' | 'desc');
                    }}
                    className="appearance-none pl-4 pr-10 py-2.5 bg-card/50 border border-border/60 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-border transition-all cursor-pointer"
                  >
                    <option value="reputation-desc">Reputation (High to Low)</option>
                    <option value="reputation-asc">Reputation (Low to High)</option>
                    <option value="uptime-desc">Uptime (High to Low)</option>
                    <option value="uptime-asc">Uptime (Low to High)</option>
                    <option value="storageUsed-desc">Storage (High to Low)</option>
                    <option value="storageUsed-asc">Storage (Low to High)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
                </div>
              </div>
              
              {/* Results count */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="text-foreground font-medium">{filteredAndSortedNodes.length}</span> of <span className="text-foreground font-medium">{nodes.length}</span> nodes
                </div>
                {statusFilter !== 'all' && (
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="text-xs text-foreground/60 hover:text-foreground transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Node Table */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              
              <PNodeTable 
                nodes={filteredAndSortedNodes}
                onNodeClick={(node) => {
                  setSelectedNode(node);
                  setIsModalOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Node Details Modal */}
      <NodeDetailsModal
        node={selectedNode}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedNode(null);
        }}
      />
    </div>
  );
}

export default function NodesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-foreground flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-[#FFD700]" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <NodesPageContent />
    </Suspense>
  );
}
