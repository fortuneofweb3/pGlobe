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

            <main className="flex-1 overflow-y-auto">
                <div className="w-full px-3 sm:px-6 pt-3 sm:pt-6 pb-6">
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

                        {/* Info Banner */}
                        <div className="card bg-gradient-to-r from-[#F0A741]/10 to-transparent border-[#F0A741]/20 mb-6">
                            <div className="flex items-start gap-3">
                                <Info className="w-4 h-4 text-[#F0A741] flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground mb-1">Calculation Methodology</h3>
                                    <p className="text-xs text-foreground/60 leading-relaxed">
                                        STOINC rewards are calculated based on <strong>Storage Credits</strong> (Nodes × Space × Performance × Stake) multiplied by the <strong>Geometric Mean</strong> of your boosts.
                                        Your share is proportional to your <strong>Boosted Credits</strong> relative to the total network weight.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 stagger-children">
                            <StatsCard
                                title="Network Boosted Credits"
                                value={<AnimatedNumber value={stats.totalBoostedCredits} decimals={1} />}
                                icon={<Network className="w-4 h-4" />}
                                color="orange"
                                subValue={<>Total network weight</>}
                            />

                            <StatsCard
                                title="Avg Credits/Node"
                                value={<AnimatedNumber value={stats.avgCredits} decimals={1} />}
                                icon={<TrendingUp className="w-4 h-4" />}
                                subValue="Boosted weight"
                            />

                            <StatsCard
                                title="Top Node Weight"
                                value={<AnimatedNumber value={stats.topCredits} decimals={1} />}
                                icon={<Award className="w-4 h-4" />}
                                color="orange"
                                subValue="Highest individual credit"
                            />

                            <StatsCard
                                title="Nodes Participating"
                                value={stats.nodesWithCredits}
                                icon={<Users className="w-4 h-4" />}
                                color="green"
                                subValue={<><AnimatedNumber value={Math.round((stats.nodesWithCredits / stats.totalNodes) * 100)} suffix="%" /> of total hardware</>}
                            />
                        </div>

                        {/* STOINC Calculator Accordion */}
                        <div className="card overflow-hidden mb-6" style={{ padding: 0 }}>
                            <button
                                onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
                                className="w-full px-4 py-3 text-left hover:bg-muted/10 transition-all duration-300"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg transition-colors ${isCalculatorOpen ? 'bg-[#F0A741]/20 text-[#F0A741]' : 'bg-muted/40 text-foreground/60'}`}>
                                            <Calculator className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h2 className="text-sm font-semibold text-foreground">STOINC Estimator</h2>
                                                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#F0A741]/10 text-[#F0A741] border border-[#F0A741]/20">Tool</span>
                                            </div>
                                            <p className="text-xs text-foreground/60">Estimate potential earnings based on specific pNode configurations and network conditions.</p>
                                        </div>
                                    </div>
                                    <ArrowDown className={`w-4 h-4 text-foreground/40 transition-transform duration-300 ${isCalculatorOpen ? 'rotate-180' : ''}`} />
                                </div>
                            </button>
                            {isCalculatorOpen && (
                                <div className="px-4 pb-4 pt-2 animate-fade-in border-t border-white/5">
                                    <StoincCalculator
                                        networkAvgCreditsPerNode={stats.avgCredits || 100}
                                        nodes={stats.enrichedNodes as any}
                                        totalNetworkBoostedCredits={stats.totalBoostedCredits}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Credits Leaderboard */}
                            <div className="card">
                                <div className="flex items-center gap-2 mb-4">
                                    <Trophy className="w-4 h-4 text-[#F0A741]" />
                                    <h2 className="text-base font-semibold text-foreground">Network Weight Leaderboard</h2>
                                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#F0A741]/10 text-[#F0A741] border border-[#F0A741]/20">
                                        Top 20
                                    </span>
                                </div>
                                <CreditsLeaderboard nodes={stats.enrichedNodes as any} limit={20} />
                            </div>

                            {/* Credits Distribution */}
                            <div className="card">
                                <div className="flex items-center gap-2 mb-4">
                                    <BarChart3 className="w-4 h-4 text-[#F0A741]" />
                                    <h2 className="text-base font-semibold text-foreground">Weight Distribution</h2>
                                </div>
                                <CreditsDistributionChart nodes={stats.enrichedNodes as any} height={350} />
                            </div>
                        </div>

                        {/* Credits by Region */}
                        <div className="card mb-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-4 h-4 text-[#F0A741]" />
                                <h2 className="text-base font-semibold text-foreground">Network Weight by Region</h2>
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#F0A741]/10 text-[#F0A741] border border-[#F0A741]/20">
                                    Top 10
                                </span>
                            </div>

                            {stats.topCountries.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                    {stats.topCountries.map((country, index) => (
                                        <div
                                            key={country.country}
                                            className="bg-white/5 rounded-lg p-3 border border-white/5 hover:border-[#F0A741]/20 transition-all duration-300 hover:shadow-md"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xs font-mono text-foreground/40">#{index + 1}</span>
                                                <span className="text-sm font-medium text-foreground truncate">{country.country}</span>
                                            </div>
                                            <div className="text-lg font-bold font-mono text-[#F0A741]">
                                                <AnimatedNumber value={country.credits} decimals={1} />
                                            </div>
                                            <div className="text-[10px] text-foreground/40">
                                                {country.nodeCount} node{country.nodeCount !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-foreground/40">
                                    <p className="text-sm">No regional data available</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
