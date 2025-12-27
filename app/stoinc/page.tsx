'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import AnimatedNumber from '@/components/AnimatedNumber';
import CreditsLeaderboard from '@/components/stoinc/CreditsLeaderboard';
import CreditsDistributionChart from '@/components/stoinc/CreditsDistributionChart';
import StoincCalculator from '@/components/stoinc/StoincCalculator';
import { useNodes } from '@/lib/context/NodesContext';
import { ChartSkeleton } from '@/components/Skeletons';
import {
    Coins,
    TrendingUp,
    Trophy,
    Users,
    BarChart3,
    Calculator,
    Sparkles,
    Info,
    Activity,
    Server,
    HardDrive,
    MemoryStick,
    Cpu,
    Award,
    Network,
    FileSpreadsheet,
    FileJson,
    ArrowDown
} from 'lucide-react';

export default function StoincPage() {
    const { nodes, loading, lastUpdate, refreshNodes } = useNodes();
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(true);

    // Derivation Heuristics & Constants
    const NETWORK_TOTAL_FEES = 50000; // Placeholder XAND per epoch
    const PNODE_SHARE = 0.94; // 94% official pNode share

    // Calculate STOINC stats with derived metrics
    const stats = useMemo(() => {
        // Group nodes by wallet/owner
        const nodesByWallet = new Map<string, any[]>();
        nodes.forEach(node => {
            const owner = (node as any).owner || (node as any).managerPDA || node.id;
            if (!nodesByWallet.has(owner)) nodesByWallet.set(owner, []);
            nodesByWallet.get(owner)?.push(node);
        });

        const enrichedNodes: any[] = [];

        nodesByWallet.forEach((walletNodes, owner) => {
            // 1. Calculate base metrics for each node in wallet
            const walletBaseData = walletNodes.map(node => {
                const EXPECTED_CREDITS = 86400;
                const nodeCredits = Number(node.credits || 0);
                let perfScore = nodeCredits > 0 ? Math.min(1.0, nodeCredits / EXPECTED_CREDITS) : (node.status === 'online' ? 0.9 : 0);
                if (perfScore > 0 && perfScore < 0.9 && node.status === 'online') perfScore = 0.9;

                const storageGB = (node.storageCapacity || 0) / (1024 ** 3);
                const stakeValue = Number(node.xandStake || 0);

                // Storage Credits per formula: pNodes * space * perf * stake
                // For a single pNode, this is space * perf * stake
                const storageCredits = 1 * storageGB * perfScore * (stakeValue > 0 ? stakeValue : 1);

                // Individual node boost = NFT * Era
                const nodeMultiplier = (node.nftBoost || 1) * (node.eraBoost || 1);

                return {
                    ...node,
                    perfScore,
                    storageGB,
                    stakeValue,
                    storageCredits,
                    nodeMultiplier
                };
            });

            // 2. Calculate Wallet-level boosted credits per formula 2
            // boostedCredits = Sum(storageCredits) * geometricMean(all node boosts in wallet)
            const walletTotalStorageCredits = walletBaseData.reduce((sum, n) => sum + n.storageCredits, 0);
            const nCount = walletBaseData.length;
            const boostProduct = walletBaseData.reduce((prod, node) => prod * node.nodeMultiplier, 1);
            const walletGeometricMeanBoost = Math.pow(boostProduct, 1 / nCount);

            // 3. Attribute credits back to nodes for display
            walletBaseData.forEach(node => {
                const boostedCreditsNode = node.storageCredits * walletGeometricMeanBoost;
                enrichedNodes.push({
                    ...node,
                    // credits stays as original heartbeat credits
                    derivedPerfScore: node.perfScore,
                    derivedBoostedCredits: boostedCreditsNode,
                    derivedMultiplier: walletGeometricMeanBoost,
                    walletNodeCount: nCount,
                    walletGeometricMeanBoost
                });
            });
        });

        const nodesWithCredits = enrichedNodes.filter(n => n.derivedBoostedCredits > 0);
        const totalBoostedCredits = enrichedNodes.reduce((sum, n) => sum + (n.derivedBoostedCredits || 0), 0);
        const avgCredits = nodesWithCredits.length > 0 ? totalBoostedCredits / nodesWithCredits.length : 0;

        const topNode = [...enrichedNodes].sort((a, b) => (b.derivedBoostedCredits || 0) - (a.derivedBoostedCredits || 0))[0];
        const topCredits = topNode?.derivedBoostedCredits || 0;

        // Calculate credits by country
        const creditsByCountry = new Map<string, { credits: number; nodeCount: number }>();
        for (const node of enrichedNodes) {
            const country = node.locationData?.country || 'Unknown';
            const existing = creditsByCountry.get(country) || { credits: 0, nodeCount: 0 };
            creditsByCountry.set(country, {
                credits: existing.credits + (node.derivedBoostedCredits || 0),
                nodeCount: existing.nodeCount + 1,
            });
        }

        const topCountries = Array.from(creditsByCountry.entries())
            .map(([country, data]) => ({ country, ...data }))
            .sort((a, b) => b.credits - a.credits)
            .slice(0, 10);

        return {
            totalBoostedCredits,
            avgCredits,
            topCredits,
            nodesWithCredits: nodesWithCredits.length,
            totalNodes: nodes.length,
            topCountries,
            enrichedNodes
        };
    }, [nodes]);

    // Loading skeleton
    if (loading && nodes.length === 0) {
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
                <Header activePage="stoinc" loading={true} onRefresh={() => { }} />
                <main className="flex-1 overflow-auto">
                    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-4">
                        {/* Hero */}
                        <div className="card" style={{ borderRadius: '1rem', padding: '1.25rem 1.5rem' }}>
                            <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                                <Coins className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                STOINC Dashboard
                            </h1>
                            <p className="text-foreground/60 text-sm sm:text-base">
                                Storage Income metrics and earnings
                            </p>
                        </div>

                        {/* Stats Skeleton */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {[...Array(4)].map((_, i) => (
                                <StatsCard key={i} title="Loading..." value={0} loading={true} />
                            ))}
                        </div>

                        {/* Charts Skeleton */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="card">
                                <ChartSkeleton height={400} />
                            </div>
                            <div className="card">
                                <ChartSkeleton height={400} />
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
                activePage="stoinc"
                nodeCount={nodes.length}
                lastUpdate={lastUpdate}
                loading={loading}
                onRefresh={() => refreshNodes()}
                showNetworkSelector={false}
            />

            <main className="flex-1 overflow-y-auto relative">
                {/* Coming Soon Overlay */}
                <div className="absolute inset-0 z-[60] flex items-center justify-center backdrop-blur-md bg-black/40">
                    <div className="bg-zinc-900/90 border border-[#F0A741]/20 p-8 sm:p-12 rounded-3xl shadow-2xl flex flex-col items-center gap-6 text-center mx-4">
                        <div className="p-5 rounded-full bg-[#F0A741]/10 border border-[#F0A741]/20 shadow-[0_0_30px_rgba(240,167,65,0.1)]">
                            <Coins className="w-16 h-16 text-[#F0A741] animate-pulse" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl sm:text-5xl font-black bg-gradient-to-r from-white via-white to-zinc-500 bg-clip-text text-transparent tracking-tight">
                                STOINC Dashboard
                            </h1>
                            <p className="text-zinc-400 text-sm sm:text-lg max-w-md mx-auto leading-relaxed">
                                Our refined Storage Income metrics and derived revenue analytics are currently being fine-tuned for accuracy.
                            </p>
                        </div>
                        <div className="flex flex-col items-center gap-4">
                            <span className="px-6 py-2 rounded-full bg-[#F0A741]/10 text-[#F0A741] text-xs sm:text-sm font-black uppercase tracking-[0.2em] border border-[#F0A741]/20">
                                Coming Soon
                            </span>
                        </div>
                    </div>
                </div>

                <div className="w-full px-3 sm:px-6 pt-3 sm:pt-6 pb-6 filter blur-[4px] pointer-events-none select-none opacity-50">
                    <div className="max-w-7xl mx-auto">
                        {/* Hero Section */}
                        <div className="mb-6">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                                <div className="flex-1">
                                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                                        <Coins className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                        STOINC Dashboard
                                    </h1>
                                    <p className="text-foreground/60 text-sm sm:text-base">
                                        Detailed STOINC metrics, derived boosted credits, and revenue share
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="px-3 py-2 text-sm bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg border border-border/60 transition-all duration-200 flex items-center gap-2"
                                        title="Export as CSV"
                                    >
                                        <FileSpreadsheet className="w-4 h-4" />
                                        <span>CSV</span>
                                    </button>
                                    <button
                                        className="px-3 py-2 text-sm bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg border border-border/60 transition-all duration-200 flex items-center gap-2"
                                        title="Export as JSON"
                                    >
                                        <FileJson className="w-4 h-4" />
                                        <span>JSON</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Top Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                            <StatsCard
                                title="Total Boosted Credits"
                                value={stats.totalBoostedCredits}
                                icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                                subValue="+12% from last epoch"
                                color="green"
                                loading={loading}
                            />
                            <StatsCard
                                title="Avg Credits / Node"
                                value={stats.avgCredits}
                                icon={<BarChart3 className="w-4 h-4 text-blue-400" />}
                                color="blue"
                                loading={loading}
                            />
                            <StatsCard
                                title="Participating Nodes"
                                value={stats.nodesWithCredits}
                                icon={<Users className="w-4 h-4 text-purple-400" />}
                                color="green"
                                loading={loading}
                            />
                            <StatsCard
                                title="Top Node Credits"
                                value={stats.topCredits}
                                icon={<Trophy className="w-4 h-4 text-yellow-400" />}
                                color="orange"
                                loading={loading}
                            />
                        </div>

                        {/* Calculator Toggle */}
                        <div className="mb-6">
                            <button
                                onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
                                className="flex items-center gap-2 px-4 py-2 bg-muted/30 hover:bg-muted/50 border border-border/40 rounded-xl transition-all text-sm font-semibold text-[#F0A741]"
                            >
                                <Calculator className="w-4 h-4" />
                                {isCalculatorOpen ? 'Hide' : 'Show'} STOINC Calculator
                            </button>
                        </div>

                        {/* Charts & Interactive Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Distribution & Leaderboard */}
                            <div className="lg:col-span-8 flex flex-col gap-6">
                                {isCalculatorOpen && (
                                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                                        <StoincCalculator />
                                    </div>
                                )}
                                <div className="card p-4 sm:p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-lg font-bold flex items-center gap-2">
                                            <Award className="w-5 h-5 text-[#F0A741]" />
                                            Credits Distribution by Country
                                        </h2>
                                    </div>
                                    <div className="h-[400px]">
                                        <CreditsDistributionChart nodes={stats.enrichedNodes} height={400} />
                                    </div>
                                </div>
                            </div>

                            {/* Leaderboard Sidebar */}
                            <div className="lg:col-span-4 flex flex-col gap-6">
                                <CreditsLeaderboard nodes={stats.enrichedNodes} />

                                {/* Info Card */}
                                <div className="card p-6 bg-gradient-to-br from-[#F0A741]/10 to-transparent border-[#F0A741]/20">
                                    <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-[#F0A741]">
                                        <Info className="w-4 h-4" />
                                        STOINC Methodology
                                    </h3>
                                    <div className="space-y-3 text-xs text-foreground/70 leading-relaxed">
                                        <p>
                                            <span className="font-bold text-foreground">Geometric Mean Boost:</span> Multipliers are averaged across all nodes in a wallet to discourage fragmentation.
                                        </p>
                                        <p>
                                            <span className="font-bold text-foreground">Formula:</span> Storage Credits = Perf Score × GB × Stake.
                                        </p>
                                        <p className="pt-2 border-t border-[#F0A741]/10 opacity-60 italic">
                                            *Data is derived from real-time gossip packets and on-chain credit history.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
