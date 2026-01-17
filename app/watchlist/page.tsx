'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { startProgress } from '@/lib/nprogress';
import { PNode } from '@/lib/types/pnode';
import PNodeTable from '@/components/PNodeTable';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { useWatchlist } from '@/lib/context/WatchlistContext';
import { Star, Server, Activity, Filter, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { TableSkeleton } from '@/components/Skeletons';
import StatsCard from '@/components/StatsCard';

function WatchlistPageContent() {
    const router = useRouter();
    const { nodes, loading, error, lastUpdate, refreshNodes } = useNodes();
    const { watchlist, clearWatchlist } = useWatchlist();

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    const watchedNodes = useMemo(() => {
        return nodes.filter(node => watchlist.includes(node.pubkey || node.publicKey || node.id));
    }, [nodes, watchlist]);

    const filteredAndSortedNodes = useMemo(() => {
        let filtered = [...watchedNodes];

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

        return filtered;
    }, [watchedNodes, searchQuery]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredAndSortedNodes.length / ITEMS_PER_PAGE);
    const paginatedNodes = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAndSortedNodes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredAndSortedNodes, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const isLoading = loading || (nodes.length === 0 && !error);

    if (error) {
        return (
            <div className="min-h-screen bg-black text-foreground">
                <Header activePage="watchlist" lastUpdate={lastUpdate} loading={loading} onRefresh={refreshNodes} />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                        <p className="text-red-400">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
            <Header activePage="watchlist" lastUpdate={lastUpdate} loading={loading} onRefresh={refreshNodes} />

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 w-full p-3 sm:p-6 overflow-y-auto">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                                    <Star className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 fill-yellow-500" />
                                    Your Watchlist
                                </h1>
                                <p className="text-foreground/60 text-sm sm:text-base">
                                    Tracked pNodes saved to your browser storage
                                </p>
                            </div>
                            {watchlist.length > 0 && (
                                <button
                                    onClick={() => {
                                        if (confirm('Are you sure you want to clear your watchlist?')) {
                                            clearWatchlist();
                                        }
                                    }}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm transition-all"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 sm:mb-6">
                            <StatsCard
                                title="Watched Nodes"
                                value={watchedNodes.length}
                                icon={<Star className="w-4 h-4" />}
                                color="orange"
                            />
                            <StatsCard
                                title="Online"
                                value={watchedNodes.filter(n => n.status === 'online').length}
                                icon={<Activity className="w-4 h-4" />}
                                color="green"
                            />
                            <StatsCard
                                title="Network Total"
                                value={nodes.length}
                                icon={<Server className="w-4 h-4" />}
                                color="blue"
                            />
                        </div>

                        {/* Search */}
                        <div className="mb-4 sm:mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground/40" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Filter your watchlist..."
                                    className="w-full pl-10 pr-4 py-2 bg-card border border-border/60 rounded-lg text-foreground placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/60 transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex flex-col">
                            <div className="card overflow-hidden flex flex-col animate-fade-in" style={{ padding: 0 }}>
                                {isLoading ? (
                                    <TableSkeleton rows={10} />
                                ) : watchedNodes.length === 0 ? (
                                    <div className="py-20 text-center">
                                        <Star className="w-12 h-12 text-foreground/10 mx-auto mb-4" />
                                        <p className="text-foreground/40 text-lg">Your watchlist is empty</p>
                                        <p className="text-foreground/30 text-sm mt-2">Go to the pNodes page and click the star icon to track nodes.</p>
                                        <button
                                            onClick={() => router.push('/nodes')}
                                            className="mt-6 px-6 py-2 bg-[#F0A741] text-black font-bold rounded-lg hover:bg-[#F0A741]/90 transition-all"
                                        >
                                            Browse pNodes
                                        </button>
                                    </div>
                                ) : (
                                    <PNodeTable
                                        nodes={paginatedNodes}
                                        onNodeClick={(node) => {
                                            const nodeId = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '';
                                            if (nodeId) {
                                                startProgress();
                                                router.push(`/${encodeURIComponent(nodeId)}`);
                                            }
                                        }}
                                    />
                                )}
                            </div>

                            {/* Pagination */}
                            {filteredAndSortedNodes.length > ITEMS_PER_PAGE && (
                                <div className="flex items-center justify-between mt-4 px-2">
                                    <div className="text-sm text-foreground/60">
                                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedNodes.length)} of {filteredAndSortedNodes.length} nodes
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${currentPage === 1
                                                ? 'border-white/10 text-foreground/30 cursor-not-allowed'
                                                : 'border-border/60 text-foreground/80 hover:border-yellow-500/50 hover:text-yellow-500'
                                                }`}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${currentPage === totalPages
                                                ? 'border-white/10 text-foreground/30 cursor-not-allowed'
                                                : 'border-border/60 text-foreground/80 hover:border-yellow-500/50 hover:text-yellow-500'
                                                }`}
                                        >
                                            Next
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function WatchlistPage() {
    return (
        <Suspense fallback={null}>
            <WatchlistPageContent />
        </Suspense>
    );
}
