'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { startProgress } from '@/lib/nprogress';
import { TableSkeleton } from '@/components/Skeletons';
import StatsCard from '@/components/StatsCard';
import {
    Users, Server, TrendingUp, Search, X,
    ChevronRight, ExternalLink, Copy, Check,
    Award, ShoppingCart, FileCheck
} from 'lucide-react';

interface Manager {
    wallet: string;
    registeredNodes: number;
    purchasedNodes: number;
    knownNodes: {
        pubkey: string;
        status: string;
        credits?: number;
    }[];
    totalCredits: number;
    onlineCount: number;
    source: 'mainnet' | 'devnet' | 'both';
}

function ManagersPageContent() {
    const router = useRouter();
    const { nodes, loading: nodesLoading, lastUpdate, refreshNodes } = useNodes();
    const [managers, setManagers] = useState<Manager[]>([]);
    const [totalRegistered, setTotalRegistered] = useState(0);
    const [totalPurchased, setTotalPurchased] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

    useEffect(() => {
        fetchManagers();
    }, []);

    async function fetchManagers() {
        try {
            setLoading(true);
            const res = await fetch('/api/managers');
            const data = await res.json();

            if (data.success) {
                setManagers(data.managers);
                setTotalRegistered(data.totalRegisteredNodes || 0);
                setTotalPurchased(data.totalPurchasedNodes || 0);
            } else {
                setError(data.error || 'Failed to fetch managers');
            }
        } catch (err) {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    }

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

    if (loading) {
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
                                <p className="text-foreground/60">pNode operators who purchased or registered nodes</p>
                            </div>

                            {/* Stats Cards Skeleton */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <StatsCard title="Managers" value={0} icon={<Users className="w-4 h-4" />} loading={true} />
                                <StatsCard title="Registered" value={0} icon={<FileCheck className="w-4 h-4" />} loading={true} />
                                <StatsCard title="Purchased" value={0} icon={<ShoppingCart className="w-4 h-4" />} loading={true} />
                                <StatsCard title="Linked" value={0} icon={<Server className="w-4 h-4" />} loading={true} />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="card p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-12 h-12 rounded-full bg-muted/20 animate-pulse" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-4 w-24 bg-muted/30 rounded animate-pulse" />
                                                <div className="h-3 w-16 bg-muted/20 rounded animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="space-y-3 mt-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-muted/20 rounded animate-pulse" />
                                                <div className="h-3 w-full bg-muted/20 rounded animate-pulse" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 bg-muted/20 rounded animate-pulse" />
                                                <div className="h-3 w-3/4 bg-muted/20 rounded animate-pulse" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
            <Header activePage="managers" nodeCount={nodes.length} lastUpdate={lastUpdate} loading={nodesLoading} onRefresh={refreshNodes} />

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 w-full p-3 sm:p-6 overflow-y-auto">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                Manager Wallets
                            </h1>
                            <p className="text-foreground/60">pNode operators who purchased and registered nodes</p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <StatsCard
                                title="Total Managers"
                                value={stats.totalManagers}
                                icon={<Users className="w-4 h-4" />}
                                color="orange"
                            />
                            <StatsCard
                                title="All pNodes"
                                value={stats.allNodes}
                                icon={<Server className="w-4 h-4" />}
                                color="blue"
                            />
                            <StatsCard
                                title="Registered"
                                value={stats.registeredNodes}
                                icon={<FileCheck className="w-4 h-4" />}
                                color="green"
                            />
                            <StatsCard
                                title="Unregistered"
                                value={stats.unregisteredNodes}
                                icon={<ShoppingCart className="w-4 h-4" />}
                                color="purple"
                            />
                        </div>

                        {/* Search */}
                        <div className="mb-6">
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

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Managers Grid */}
                        {filteredManagers.length === 0 ? (
                            <div className="text-center py-12 text-foreground/60">
                                {searchQuery ? 'No managers found matching your search' : 'No managers found.'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredManagers.map((manager) => (
                                    <div
                                        key={manager.wallet}
                                        className="card p-4 hover:border-[#F0A741]/40 cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
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
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-sm truncate">{truncateWallet(manager.wallet)}</span>
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
                                                    <span className="text-lg font-bold">{manager.purchasedNodes}</span>
                                                </div>
                                                <div className="text-[10px] text-foreground/50">Purchased</div>
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
