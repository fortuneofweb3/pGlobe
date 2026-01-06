'use client';

import { useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useNodes, Manager } from '@/lib/context/NodesContext';
import { useXandPrice } from '@/lib/hooks/useXandPrice';
import StatsCard from '@/components/StatsCard';
import { StatCardSkeleton, ManagerCardSkeleton } from '@/components/Skeletons';
import { startProgress } from '@/lib/nprogress';
import {
    Users, Search, X, ChevronRight, ExternalLink, Copy, Check,
    Award, ShoppingCart, FileCheck, Server, TrendingUp, Coins, LayoutGrid, List
} from 'lucide-react';
import ManagerLeaderboard from '@/components/ManagerLeaderboard';

// Format number with K, M abbreviation (2 decimal places)
function formatAbbreviated(value: number): string {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
        return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toLocaleString();
}

function ManagerCard({ manager, allNodesCount, onClick, copyWallet, copiedWallet, formatUsd }: {
    manager: Manager,
    allNodesCount: number,
    onClick: () => void,
    copyWallet: (w: string) => void,
    copiedWallet: string | null,
    formatUsd: (val: number) => string
}) {
    const getNodeCount = (m: Manager) => Math.max(m.registeredNodes || 0, m.purchasedNodes || 0, (m.knownNodes?.length || 0));

    const truncateWallet = (wallet: string) => `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

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

    const nodeCount = getNodeCount(manager);
    const fleetPercentage = ((nodeCount / (allNodesCount || 1)) * 100);

    return (
        <div
            className="card p-4 hover:border-[#F0A741]/40 cursor-pointer transition-all duration-300 hover:scale-[1.02] group"
            onClick={onClick}
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                    <img
                        src={`https://api.dicebear.com/7.x/identicon/svg?seed=${manager.wallet}&backgroundColor=1a1a2e`}
                        alt="Avatar"
                        className="w-12 h-12 rounded-full bg-muted border-2 border-[#F0A741]/20"
                    />
                </div>

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
                        >
                            <ExternalLink className="w-3 h-3 text-foreground/40" />
                        </a>
                        {getSourceBadge(manager.source)}
                    </div>
                </div>

                <div className="relative group/chart ml-auto shrink-0">
                    <svg width="48" height="48" viewBox="0 0 36 36" className="transform -rotate-90">
                        <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#333"
                            strokeWidth="3"
                            opacity="0.3"
                        />
                        <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#F0A741"
                            strokeWidth="3"
                            strokeDasharray={`${fleetPercentage}, 100`}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-bold text-foreground">
                            {fleetPercentage.toFixed(0)}%
                        </span>
                    </div>
                </div>
            </div>

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
                        {formatAbbreviated(manager.vestingStake || 0)}
                        <span className="text-xs ml-1 opacity-50 font-normal">XAND</span>
                    </div>
                    <div className="text-[10px] text-[#F0A741]/50 uppercase font-semibold">Vesting Rewards</div>
                </div>
            </div>

            <div className="flex items-center justify-between text-xs text-foreground/50">
                <span>{manager.knownNodes?.length || 0} linked nodes</span>
                <ChevronRight className="w-4 h-4 group-hover:text-[#F0A741] transition-colors" />
            </div>
        </div>
    );
}

function ManagersPageContent() {
    const router = useRouter();
    const { nodes, managers, loading: nodesLoading, lastUpdate, refreshNodes } = useNodes();
    const { formatUsd } = useXandPrice();
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'leaderboard'>('grid');

    const filteredManagers = useMemo(() => {
        let result = managers;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(m =>
                m.wallet.toLowerCase().includes(query)
            );
        }
        // Sort by vesting rewards (highest first) for cards view
        return [...result].sort((a, b) => (b.vestingStake || 0) - (a.vestingStake || 0));
    }, [managers, searchQuery]);

    const stats = useMemo(() => {
        const allNodes = nodes.length;
        const registeredNodes = nodes.filter(n => n.isRegistered).length;
        const unregisteredNodes = allNodes - registeredNodes;

        const totalCredits = managers.reduce((sum, m) => sum + (m.totalCredits || 0), 0);
        const totalXandStake = managers.reduce((sum, m) => sum + (m.totalXandStake || m.daoStake || 0), 0);
        const totalVestedRewards = managers.reduce((sum, m) => sum + (m.vestingStake || 0), 0);

        const getNodeCount = (m: Manager) => Math.max(m.registeredNodes || 0, m.purchasedNodes || 0, (m.knownNodes?.length || 0));
        const totalNodesFromManagers = managers.reduce((sum, m) => sum + getNodeCount(m), 0);

        const avgNodesPerManager = managers.length > 0 ? totalNodesFromManagers / managers.length : 0;
        const avgCreditsPerManager = managers.length > 0 ? totalCredits / managers.length : 0;

        return {
            totalManagers: managers.length,
            activeManagers: managers.filter(m => m.onlineCount > 0).length,
            allNodes,
            registeredNodes,
            unregisteredNodes,
            totalCredits,
            totalXandStake,
            totalVestedRewards,
            avgNodesPerManager,
            avgCreditsPerManager,
        };
    }, [managers, nodes]);


    const copyWallet = (wallet: string) => {
        navigator.clipboard.writeText(wallet);
        setCopiedWallet(wallet);
        setTimeout(() => setCopiedWallet(null), 2000);
    };

    if (nodesLoading && managers.length === 0) {
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
                <Header activePage="managers" loading={true} />

                <main className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 w-full p-3 sm:p-6 overflow-y-auto">
                        <div className="max-w-7xl mx-auto">
                            {/* Page Title Row */}
                            <div className="mb-8">
                                <h1 className="text-2xl sm:text-3xl font-bold mb-1 flex items-center gap-3">
                                    <Users className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                    Manager Wallets
                                </h1>
                                <p className="text-foreground/60 text-sm">pNode operators who run registered nodes</p>
                            </div>

                            {/* Stats Row 1: Counts */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <StatsCard title="Active Managers" value={0} icon={<Users className="w-4 h-4" />} color="orange" loading={true} subValue=" " />
                                <StatsCard title="Registered" value={0} icon={<FileCheck className="w-4 h-4" />} color="green" loading={true} subValue=" " />
                                <StatsCard title="Unregistered" value={0} icon={<ShoppingCart className="w-4 h-4" />} color="purple" loading={true} subValue=" " />
                                <StatsCard title="Total Vested Rewards" value={0} icon={<Award className="w-4 h-4" />} color="red" loading={true} subValue=" " />
                            </div>

                            {/* Stats Row 2: Financials & Averages */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                                <StatsCard title="Total Credits" value={0} icon={<Award className="w-4 h-4" />} color="orange" loading={true} subValue=" " />
                                <StatsCard title="Avg Credits/Manager" value={0} icon={<Coins className="w-4 h-4" />} color="green" loading={true} subValue=" " />
                                <StatsCard title="Total XAND Staked" value={0} icon={<TrendingUp className="w-4 h-4" />} color="purple" loading={true} subValue=" " />
                                <StatsCard title="Avg Nodes/Manager" value={0} icon={<Server className="w-4 h-4" />} loading={true} subValue=" " />
                            </div>

                            {/* Registry Header Section */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#F0A741]/10 rounded-lg">
                                        <List className="w-5 h-5 text-[#F0A741]" />
                                    </div>
                                    <h2 className="text-lg font-bold">Operator Registry</h2>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center bg-card border border-border rounded-xl p-1 h-10">
                                        <div className="px-3 py-1.5 rounded-lg bg-muted/30"><LayoutGrid className="w-4 h-4 text-foreground/30" /></div>
                                        <div className="px-3 py-1.5 rounded-lg text-foreground/30"><List className="w-4 h-4" /></div>
                                    </div>
                                    <div className="relative flex-1 sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/20" />
                                        <div className="w-full h-10 bg-card border border-border rounded-xl" />
                                    </div>
                                </div>
                            </div>

                            {/* Manager Cards Grid */}
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
            <Header
                activePage="managers"
                lastUpdate={lastUpdate}
                loading={nodesLoading}
                onRefresh={refreshNodes}
            />

            <main className="flex-1 overflow-y-auto">
                <div className="w-full p-3 sm:p-6 min-h-full">
                    <div className="max-w-7xl mx-auto">
                        {/* Page Title Row */}
                        <div className="mb-8 animate-slide-in-bottom">
                            <h1 className="text-2xl sm:text-3xl font-bold mb-1 flex items-center gap-3">
                                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                Manager Wallets
                            </h1>
                            <p className="text-foreground/60 text-sm">pNode operators who run registered nodes</p>
                        </div>

                        {/* Stats Row 1: Counts */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 stagger-children">
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
                                title="Total Vested Rewards"
                                value={stats.totalVestedRewards >= 1000000
                                    ? `${(stats.totalVestedRewards / 1000000).toFixed(1)}M`
                                    : stats.totalVestedRewards >= 1000
                                        ? `${(stats.totalVestedRewards / 1000).toFixed(1)}K`
                                        : stats.totalVestedRewards.toLocaleString()}
                                subValue={formatUsd(stats.totalVestedRewards)}
                                icon={<Award className="w-4 h-4" />}
                                color="red"
                            />
                        </div>

                        {/* Stats Row 2: Financials & Averages */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 stagger-children" style={{ animationDelay: '0.1s' }}>
                            <StatsCard
                                title="Total Credits"
                                value={stats.totalCredits.toLocaleString()}
                                subValue="Total manager rewards"
                                icon={<Award className="w-4 h-4" />}
                                color="orange"
                            />
                            <StatsCard
                                title="Avg Credits/Manager"
                                value={Math.round(stats.avgCreditsPerManager).toLocaleString()}
                                subValue="Average earned per manager"
                                icon={<Coins className="w-4 h-4" />}
                                color="green"
                            />
                            <StatsCard
                                title="Total XAND Staked"
                                value={stats.totalXandStake >= 1000000
                                    ? `${(stats.totalXandStake / 1000000).toFixed(1)}M`
                                    : stats.totalXandStake >= 1000
                                        ? `${(stats.totalXandStake / 1000).toFixed(1)}K`
                                        : stats.totalXandStake.toLocaleString()}
                                subValue={formatUsd(stats.totalXandStake)}
                                icon={<TrendingUp className="w-4 h-4" />}
                                color="purple"
                            />
                            <StatsCard
                                title="Avg Nodes/Manager"
                                value={stats.avgNodesPerManager.toFixed(1)}
                                subValue="Average fleet size"
                                icon={<Server className="w-4 h-4" />}
                            />
                        </div>

                        {/* Registry Header Section */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-slide-in-bottom" style={{ animationDelay: '0.15s' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#F0A741]/10 rounded-lg">
                                    <List className="w-5 h-5 text-[#F0A741]" />
                                </div>
                                <h2 className="text-lg font-bold">Operator Registry</h2>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-card border border-border rounded-xl p-1 h-10">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#F0A741] text-black font-bold' : 'text-foreground/40 hover:text-foreground'}`}
                                        title="Grid View"
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('leaderboard')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${viewMode === 'leaderboard' ? 'bg-[#F0A741] text-black font-bold' : 'text-foreground/40 hover:text-foreground'}`}
                                        title="Leaderboard View"
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="relative flex-1 sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                                    <input
                                        type="text"
                                        placeholder="Search by wallet..."
                                        className="w-full pl-9 pr-9 py-2 bg-card border border-border rounded-xl text-sm h-10 focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20 transition-all"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-foreground/80 text-foreground/40"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {filteredManagers.length === 0 ? (
                            <div className="text-center py-12 text-foreground/60 card">
                                {searchQuery ? 'No managers found matching your search' : 'No managers found.'}
                            </div>
                        ) : (
                            <>
                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
                                        {filteredManagers.map((manager) => (
                                            <ManagerCard
                                                key={manager.wallet}
                                                manager={manager}
                                                allNodesCount={stats.allNodes}
                                                copyWallet={copyWallet}
                                                copiedWallet={copiedWallet}
                                                formatUsd={formatUsd}
                                                onClick={() => {
                                                    startProgress();
                                                    router.push(`/managers/${manager.wallet}`);
                                                }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="animate-fade-in" style={{ animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
                                        <ManagerLeaderboard
                                            managers={filteredManagers}
                                            nodes={nodes}
                                            copiedWallet={copiedWallet}
                                            onCopyWallet={copyWallet}
                                        />
                                    </div>
                                )}

                                <div className="mt-6 text-sm text-foreground/60 text-center">
                                    Showing {filteredManagers.length} of {managers.length} managers
                                </div>
                            </>
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
