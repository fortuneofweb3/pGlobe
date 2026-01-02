'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useNodes, Manager } from '@/lib/context/NodesContext';
import { startProgress } from '@/lib/nprogress';
import { TableSkeleton, ManagerCardSkeleton } from '@/components/Skeletons';
import StatsCard from '@/components/StatsCard';
import {
    Users, Server, TrendingUp, Search, X,
    ChevronRight, ExternalLink, Copy, Check,
    Award, ShoppingCart, FileCheck, RefreshCw, UserX
} from 'lucide-react';

function ManagersPageContent() {
    const router = useRouter();
    const { nodes, managers, loading: nodesLoading, lastUpdate, refreshNodes, deadManagerCount } = useNodes();
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

    const filteredManagers = useMemo(() => {
        if (!searchQuery) return managers;
        const query = searchQuery.toLowerCase();
        return managers.filter(m =>
            m.wallet.toLowerCase().includes(query)
        );
    }, [managers, searchQuery]);

    const stats = useMemo(() => {
        const allNodes = nodes.length;
        const registeredNodes = nodes.filter(n => n.isRegistered).length;
        const unregisteredNodes = allNodes - registeredNodes;
        return {
            totalManagers: managers.length,
            activeManagers: managers.filter(m => m.onlineCount > 0).length,
            allNodes,
            registeredNodes,
            unregisteredNodes,
        };
    }, [managers, nodes]);

    const copyWallet = (wallet: string) => {
        navigator.clipboard.writeText(wallet);
        setCopiedWallet(wallet);
        setTimeout(() => setCopiedWallet(null), 2000);
    };

    const truncateWallet = (wallet: string) => {
        return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
    };

    const getNodeCount = (m: Manager) => {
        return Math.max(m.registeredNodes, m.purchasedNodes, m.knownNodes.length);
    };

    const getSourceBadge = (source: string) => {
        switch (source) {
            case 'both':
                return <span className="text-[8px] px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded">BOTH</span>;
            case 'mainnet':
                return <span className="text-[8px] px-1 py-0.5 bg-green-500/20 text-green-400 rounded">MAINNET</span>;
            case 'devnet':
                return <span className="text-[8px] px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded">DEVNET</span>;
            default:
                return null;
        }
    };

    if (nodesLoading && managers.length === 0) {
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
                <Header activePage="managers" loading={true} onRefresh={() => { }} />
                <main className="flex-1 overflow-hidden">
                    <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
                        <div className="max-w-7xl mx-auto">
                            <div className="mb-6">
                                <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                                    <Users className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                    Manager Wallets
                                </h1>
                                <p className="text-foreground/60">pNode operators who run registered nodes</p>
                            </div>

                            {/* Stats Cards Skeleton */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                                <StatsCard title="Managers" value={0} icon={<Users className="w-4 h-4" />} loading={true} />
                                <StatsCard title="Registered" value={0} icon={<FileCheck className="w-4 h-4" />} loading={true} />
                                <StatsCard title="Purchased" value={0} icon={<ShoppingCart className="w-4 h-4" />} loading={true} />
                                <StatsCard title="Linked" value={0} icon={<Server className="w-4 h-4" />} loading={true} />
                                <StatsCard title="Dead" value={0} icon={<UserX className="w-4 h-4" />} loading={true} />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <ManagerCardSkeleton count={8} />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
            <Header activePage="managers" lastUpdate={lastUpdate} loading={nodesLoading} onRefresh={refreshNodes} />

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 w-full p-3 sm:p-6 overflow-y-auto">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-6 animate-slide-in-bottom">
                            <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                Manager Wallets
                            </h1>
                            <p className="text-foreground/60">pNode operators who run registered nodes</p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
                            <StatsCard
                                title="Active Managers"
                                value={stats.activeManagers}
                                subValue={`Out of ${stats.totalManagers} total`}
                                icon={<Users className="w-4 h-4" />}
                                color="orange"
                            />
                            <StatsCard
                                title="Registered"
                                value={stats.registeredNodes}
                                subValue="Nodes with on-chain identity"
                                icon={<FileCheck className="w-4 h-4" />}
                                color="green"
                            />
                            <StatsCard
                                title="Unregistered"
                                value={stats.unregisteredNodes}
                                subValue="Nodes without on-chain identity"
                                icon={<ShoppingCart className="w-4 h-4" />}
                                color="purple"
                            />
                            <StatsCard
                                title="Dead Managers"
                                value={deadManagerCount}
                                subValue="Managers with only offline nodes"
                                icon={<UserX className="w-4 h-4" />}
                                color="red"
                            />
                        </div>

                        {/* Search */}
                        <div className="mb-6 animate-slide-in-bottom" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-foreground/40" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by wallet address..."
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
                        </div>

                        {nodesLoading && (
                            <div className="mb-6 flex items-center gap-2 text-[#F0A741] animate-pulse">
                                <RefreshCw className="w-4 h-4" />
                                <span className="text-xs font-medium uppercase tracking-wider">Refreshing Data...</span>
                            </div>
                        )}

                        {/* Managers Grid */}
                        {filteredManagers.length === 0 ? (
                            <div className="text-center py-12 text-foreground/60">
                                {searchQuery ? 'No managers found matching your search' : 'No managers found.'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
                                {filteredManagers.map((manager, idx) => (
                                    <div
                                        key={manager.wallet}
                                        className="card p-4 hover:border-[#F0A741]/40 cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
                                        style={{ animationDelay: `${0.2 + (idx * 0.05)}s` }}
                                        onClick={() => {
                                            startProgress();
                                            router.push(`/managers/${manager.wallet}`);
                                        }}
                                    >
                                        {/* Header with Avatar */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <img
                                                src={`https://api.dicebear.com/7.x/identicon/svg?seed=${manager.wallet}&backgroundColor=1a1a2e`}
                                                alt="Avatar"
                                                className="w-12 h-12 rounded-full bg-muted border-2 border-[#F0A741]/20"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm truncate">{truncateWallet(manager.wallet)}</span>
                                                    {manager.onlineCount === 0 && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-500/20 text-red-500 rounded border border-red-500/30">DEAD</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyWallet(manager.wallet);
                                                        }}
                                                        className="p-1 hover:bg-muted rounded transition-colors"
                                                        title="Copy wallet"
                                                    >
                                                        {copiedWallet === manager.wallet ? (
                                                            <Check className="w-3 h-3 text-green-400" />
                                                        ) : (
                                                            <Copy className="w-3 h-3 text-foreground/40" />
                                                        )}
                                                    </button>
                                                    <a
                                                        href={`https://solscan.io/account/${manager.wallet}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1 hover:bg-muted rounded transition-colors"
                                                        title="View on Solscan"
                                                    >
                                                        <ExternalLink className="w-3 h-3 text-foreground/40" />
                                                    </a>
                                                    {getSourceBadge(manager.source)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stats Row */}
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-blue-500/10 rounded-lg p-2 text-center">
                                                <div className="flex items-center justify-center gap-1 text-blue-400">
                                                    <FileCheck className="w-3 h-3" />
                                                    <span className="text-lg font-bold">{manager.registeredNodes}</span>
                                                </div>
                                                <div className="text-[10px] text-foreground/50">Registered</div>
                                            </div>
                                            <div className="bg-green-500/10 rounded-lg p-2 text-center">
                                                <div className="flex items-center justify-center gap-1 text-green-400">
                                                    <ShoppingCart className="w-3 h-3" />
                                                    <span className="text-lg font-bold">{manager.totalPurchases || manager.purchasedNodes}</span>
                                                </div>
                                                <div className="text-[10px] text-foreground/50">Purchased</div>
                                            </div>
                                            <div className="col-span-2 bg-[#F0A741]/10 rounded-lg p-2 text-center border border-[#F0A741]/20">
                                                <div className="text-lg font-bold text-[#F0A741]">
                                                    {manager.totalXandStake?.toLocaleString() || '0'}
                                                </div>
                                                <div className="text-[10px] text-[#F0A741]/50 uppercase font-semibold">XAND Stake</div>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between text-xs text-foreground/50">
                                            <span>{manager.knownNodes.length} linked node{manager.knownNodes.length !== 1 ? 's' : ''}</span>
                                            <ChevronRight className="w-4 h-4 group-hover:text-[#F0A741] transition-colors" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {filteredManagers.length > 0 && (
                            <div className="mt-6 text-sm text-foreground/60 text-center">
                                Showing {filteredManagers.length} of {managers.length} managers
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function ManagersPage() {
    return (
        <Suspense fallback={null}>
            <ManagersPageContent />
        </Suspense>
    );
}
