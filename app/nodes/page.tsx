'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { startProgress } from '@/lib/nprogress';
import { PNode } from '@/lib/types/pnode';
import PNodeTable from '@/components/PNodeTable';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { RefreshCw, Server, TrendingUp, Search, Filter, X, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import { TableSkeleton, CardSkeleton } from '@/components/Skeletons';
import AnimatedNumber from '@/components/AnimatedNumber';
import StatsCard from '@/components/StatsCard';

function NodesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { nodes, loading, error, lastUpdate, refreshNodes } = useNodes();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [versionFilter, setVersionFilter] = useState<string>('all');
  const [joinedFilter, setJoinedFilter] = useState<string>('all');
  const [creditsFilter, setCreditsFilter] = useState<string>('all');
  const [packetsFilter, setPacketsFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;


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
      filtered = filtered.filter((node) => {
        if (statusFilter === 'offline') {
          return node.status === 'offline' || !node.status;
        }
        return node.status === statusFilter;
      });
    }

    if (versionFilter !== 'all') {
      filtered = filtered.filter((node) => node.version === versionFilter);
    }

    if (joinedFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter((node) => {
        if (!node.createdAt) return false;
        const joined = new Date(node.createdAt);
        const diffHours = (now.getTime() - joined.getTime()) / (1000 * 60 * 60);

        if (joinedFilter === '24h') return diffHours <= 24;
        if (joinedFilter === '7d') return diffHours <= 24 * 7;
        if (joinedFilter === '30d') return diffHours <= 24 * 30;
        return true;
      });
    }

    if (creditsFilter !== 'all') {
      if (creditsFilter === 'with') {
        filtered = filtered.filter((node) => node.credits !== undefined && node.credits !== null && node.credits > 0);
      } else if (creditsFilter === 'without') {
        filtered = filtered.filter((node) => node.credits === undefined || node.credits === null || node.credits === 0);
      }
    }

    if (packetsFilter !== 'all') {
      if (packetsFilter === 'with') {
        filtered = filtered.filter((node) =>
          (node.packetsReceived !== undefined && node.packetsReceived !== null && node.packetsReceived > 0) ||
          (node.packetsSent !== undefined && node.packetsSent !== null && node.packetsSent > 0)
        );
      } else if (packetsFilter === 'without') {
        filtered = filtered.filter((node) =>
          (!node.packetsReceived || node.packetsReceived === 0) &&
          (!node.packetsSent || node.packetsSent === 0)
        );
      }
    }

    // Sort by the selected column (overrides all default sorting)
    if (sortBy) {
      filtered.sort((a, b) => {
        let aVal: any = a[sortBy as keyof PNode];
        let bVal: any = b[sortBy as keyof PNode];

        // Handle undefined/null values
        if (aVal === undefined || aVal === null) aVal = sortOrder === 'asc' ? Infinity : -Infinity;
        if (bVal === undefined || bVal === null) bVal = sortOrder === 'asc' ? Infinity : -Infinity;

        // Handle string comparison
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          if (sortOrder === 'asc') {
            return aVal.localeCompare(bVal);
          } else {
            return bVal.localeCompare(aVal);
          }
        }

        // Handle numeric comparison
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      });
    }

    return filtered;
  }, [nodes, searchQuery, statusFilter, versionFilter, joinedFilter, creditsFilter, packetsFilter, sortBy, sortOrder]);

  const versions = useMemo(() => {
    const versionSet = new Set<string>();
    nodes.forEach((node) => {
      if (node.version) versionSet.add(node.version);
    });
    return Array.from(versionSet).sort();
  }, [nodes]);

  const statusCounts = useMemo(() => {
    return {
      all: nodes.length,
      online: nodes.filter(n => n.status === 'online').length,
      syncing: nodes.filter(n => n.status === 'syncing').length,
      offline: nodes.filter(n => n.status === 'offline' || !n.status).length,
    };
  }, [nodes]);

  const creditsCounts = useMemo(() => {
    return {
      all: nodes.length,
      with: nodes.filter(n => n.credits !== undefined && n.credits !== null && n.credits > 0).length,
      without: nodes.filter(n => n.credits === undefined || n.credits === null || n.credits === 0).length,
    };
  }, [nodes]);

  const packetsCounts = useMemo(() => {
    return {
      all: nodes.length,
      with: nodes.filter(n =>
        (n.packetsReceived !== undefined && n.packetsReceived !== null && n.packetsReceived > 0) ||
        (n.packetsSent !== undefined && n.packetsSent !== null && n.packetsSent > 0)
      ).length,
      without: nodes.filter(n =>
        (!n.packetsReceived || n.packetsReceived === 0) &&
        (!n.packetsSent || n.packetsSent === 0)
      ).length,
    };
  }, [nodes]);

  const hasActiveFilters = statusFilter !== 'all' || versionFilter !== 'all' || joinedFilter !== 'all' || creditsFilter !== 'all' || packetsFilter !== 'all' || searchQuery;

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedNodes.length / ITEMS_PER_PAGE);
  const paginatedNodes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedNodes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedNodes, currentPage]);

  // Reset to page 1 when filters/search/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, versionFilter, joinedFilter, creditsFilter, packetsFilter, sortBy, sortOrder]);

  // Show loading skeleton when loading or no data available
  const isLoading = loading || (nodes.length === 0 && !error);

  if (error) {
    return (
      <div className="min-h-screen bg-black text-foreground">
        <Header activePage="nodes" nodeCount={nodes.length} lastUpdate={lastUpdate} loading={loading} onRefresh={refreshNodes} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading skeleton when no data
  if (isLoading && nodes.length === 0) {
    return (
      <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
        <Header activePage="nodes" loading={true} onRefresh={() => { }} />
        <main className="flex-1 overflow-hidden">
          <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto h-full flex flex-col">
              {/* Header */}
              <div className="mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                  <Server className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                  Network Nodes
                </h1>
                <p className="text-foreground/60 text-sm sm:text-base">
                  Complete overview of all nodes in the network
                </p>
              </div>

              {/* Summary Stats - 4 cards */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 sm:mb-6">
                <StatsCard title="Total Nodes" value={0} icon={<Server className="w-4 h-4" />} loading={true} />
                <StatsCard title="Online Nodes" value={0} icon={<TrendingUp className="w-4 h-4" />} loading={true} />
                <StatsCard title="Syncing" value={0} icon={<Activity className="w-4 h-4" />} loading={true} />
                <StatsCard title="Offline Nodes" value={0} icon={<Server className="w-4 h-4" />} loading={true} />
              </div>

              {/* Search and Filters placeholder */}
              <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
                <div className="h-10 bg-muted/30 rounded animate-pulse" />
                <div className="h-10 bg-muted/30 rounded animate-pulse" />
              </div>

              {/* Table Skeleton */}
              <TableSkeleton rows={10} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
      <Header activePage="nodes" nodeCount={nodes.length} lastUpdate={lastUpdate} loading={loading} onRefresh={refreshNodes} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 w-full p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                <Server className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                Network Nodes
              </h1>
              <p className="text-foreground/60 text-sm sm:text-base">
                Complete overview of all nodes in the network
              </p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 sm:mb-6 stagger-children">
              <StatsCard
                title="Total Nodes"
                value={nodes.length}
                icon={<Server className="w-4 h-4" />}
                color="orange"
              />

              <StatsCard
                title="Online Nodes"
                value={statusCounts.online}
                icon={<TrendingUp className="w-4 h-4" />}
                color="green"
              />

              <StatsCard
                title="Syncing"
                value={statusCounts.syncing}
                icon={<Activity className="w-4 h-4" />}
                color="blue"
              />

              <StatsCard
                title="Offline Nodes"
                value={statusCounts.offline}
                icon={<Server className="w-4 h-4" />}
                color="red"
              />
            </div>

            {/* Search and Filters - Compact */}
            <div className="mb-4 sm:mb-6 animate-slide-in-bottom" style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}>
              <div className="flex flex-row gap-2 sm:gap-3 items-center">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by IP, public key, or location..."
                    className="w-full pl-10 pr-4 py-2 bg-card border border-border/60 rounded-lg text-foreground placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20 focus:border-[#F0A741]/60 transition-all text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-foreground/60" />
                    </button>
                  )}
                </div>

                {/* Filters Button */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center justify-center gap-2 rounded-lg transition-all text-sm border whitespace-nowrap h-[42px] ${showFilters || hasActiveFilters
                    ? 'px-3 sm:px-4 bg-[#F0A741]/20 text-[#F0A741] border-[#F0A741]/30'
                    : 'px-3 bg-card text-foreground/60 hover:text-foreground hover:border-[#F0A741]/30 border-border/60'
                    }`}
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline font-medium">Filters</span>
                  {hasActiveFilters && (
                    <span className="px-1.5 py-0.5 bg-[#F0A741] text-black text-xs font-bold rounded">
                      {[statusFilter !== 'all' && 1, versionFilter !== 'all' && 1, joinedFilter !== 'all' && 1, creditsFilter !== 'all' && 1, packetsFilter !== 'all' && 1].filter(Boolean).length}
                    </span>
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setVersionFilter('all');
                      setJoinedFilter('all');
                      setCreditsFilter('all');
                      setPacketsFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-sm text-foreground/60 hover:text-foreground transition-colors px-3 py-2"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Filter Panel */}
              {showFilters && (
                <div className="card-stat mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Status Filter */}
                    <div>
                      <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wide mb-2">
                        Status
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="input w-full text-foreground focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20 focus:border-[#F0A741]/60 transition-all text-sm"
                      >
                        <option value="all">All ({statusCounts.all})</option>
                        <option value="online">Online ({statusCounts.online})</option>
                        <option value="syncing">Syncing ({statusCounts.syncing})</option>
                        <option value="offline">Offline ({statusCounts.offline})</option>
                      </select>
                    </div>

                    {/* Version Filter */}
                    <div>
                      <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wide mb-2">
                        Version
                      </label>
                      <select
                        value={versionFilter}
                        onChange={(e) => setVersionFilter(e.target.value)}
                        className="input w-full text-foreground focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20 focus:border-[#F0A741]/60 transition-all text-sm"
                      >
                        <option value="all">All Versions</option>
                        {versions.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Joined Filter */}
                    <div>
                      <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wide mb-2">
                        Joined
                      </label>
                      <select
                        value={joinedFilter}
                        onChange={(e) => setJoinedFilter(e.target.value)}
                        className="input w-full text-foreground focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20 focus:border-[#F0A741]/60 transition-all text-sm"
                      >
                        <option value="all">All Time</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                      </select>
                    </div>

                    {/* Credits Filter */}
                    <div>
                      <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wide mb-2">
                        Credits
                      </label>
                      <select
                        value={creditsFilter}
                        onChange={(e) => setCreditsFilter(e.target.value)}
                        className="input w-full text-foreground focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20 focus:border-[#F0A741]/60 transition-all text-sm"
                      >
                        <option value="all">All ({creditsCounts.all})</option>
                        <option value="with">With Credits ({creditsCounts.with})</option>
                        <option value="without">No Credits ({creditsCounts.without})</option>
                      </select>
                    </div>

                    {/* Packets Filter */}
                    <div>
                      <label className="block text-xs font-medium text-foreground/60 uppercase tracking-wide mb-2">
                        Packets
                      </label>
                      <select
                        value={packetsFilter}
                        onChange={(e) => setPacketsFilter(e.target.value)}
                        className="input w-full text-foreground focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20 focus:border-[#F0A741]/60 transition-all text-sm"
                      >
                        <option value="all">All ({packetsCounts.all})</option>
                        <option value="with">With Packets ({packetsCounts.with})</option>
                        <option value="without">No Packets ({packetsCounts.without})</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Node Table */}
            <div className="flex flex-col">
              <div className="card overflow-hidden flex flex-col animate-fade-in" style={{ padding: 0, animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
                {error && (
                  <div className="p-4 bg-red-500/10 border-b border-red-500/20">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {isLoading ? (
                  <TableSkeleton rows={10} />
                ) : (
                  <PNodeTable
                    nodes={paginatedNodes}
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

              {/* Pagination Controls */}
              {filteredAndSortedNodes.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <div className="text-sm text-foreground/60">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedNodes.length)} of {filteredAndSortedNodes.length} nodes
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${currentPage === 1
                        ? 'border-border/40 text-foreground/30 cursor-not-allowed'
                        : 'border-border/60 text-foreground/80 hover:border-[#F0A741]/50 hover:text-[#F0A741]'
                        }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {/* Show page numbers with ellipsis for large page counts */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // Always show first, last, current, and adjacent pages
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .reduce((acc: (number | string)[], page, idx, arr) => {
                          if (idx > 0) {
                            const prevPage = arr[idx - 1];
                            if (typeof prevPage === 'number' && page - prevPage > 1) {
                              acc.push('...');
                            }
                          }
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((page, idx) => (
                          typeof page === 'string' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-foreground/40">...</span>
                          ) : (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-all ${currentPage === page
                                ? 'bg-[#F0A741] text-black'
                                : 'text-foreground/60 hover:bg-muted hover:text-foreground'
                                }`}
                            >
                              {page}
                            </button>
                          )
                        ))
                      }
                    </div>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${currentPage === totalPages
                        ? 'border-border/40 text-foreground/30 cursor-not-allowed'
                        : 'border-border/60 text-foreground/80 hover:border-[#F0A741]/50 hover:text-[#F0A741]'
                        }`}
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {filteredAndSortedNodes.length === 0 && !loading && (
                <div className="card text-center" style={{ padding: '2rem' }}>
                  <p className="text-foreground/60">No nodes found</p>
                  {hasActiveFilters && (
                    <button
                      onClick={() => {
                        setStatusFilter('all');
                        setVersionFilter('all');
                        setJoinedFilter('all');
                        setCreditsFilter('all');
                        setPacketsFilter('all');
                        setSearchQuery('');
                      }}
                      className="mt-4 text-sm text-[#F0A741] hover:text-[#F0A741]/80 transition-colors"
                    >
                      Clear filters
                    </button>
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

export default function NodesPage() {
  return (
    <Suspense fallback={null}>
      <NodesPageContent />
    </Suspense>
  );
}
