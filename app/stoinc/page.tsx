'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import StatsCard from '@/components/StatsCard';
import AnimatedNumber from '@/components/AnimatedNumber';
import CreditsLeaderboard from '@/components/stoinc/CreditsLeaderboard';
import CreditsDistributionChart from '@/components/stoinc/CreditsDistributionChart';
import StoincCalculator from '@/components/stoinc/StoincCalculator';
import { useNodes } from '@/lib/context/NodesContext';
import { ChartSkeleton, LeaderboardSkeleton } from '@/components/Skeletons';
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
        const enrichedNodes = nodes.map(node => ({
            ...node,
            address: node.address || node.pubkey || node.id || 'Unknown',
            credits: Number(node.credits || 0),
            rx: Number((node as any).packetsReceived || (node as any).rx_packets || 0),
            tx: Number((node as any).packetsSent || (node as any).tx_packets || 0),
        }));

        const totalCredits = enrichedNodes.reduce((sum, n) => sum + n.credits, 0);
        const totalRx = enrichedNodes.reduce((sum, n) => sum + n.rx, 0);
        const totalTx = enrichedNodes.reduce((sum, n) => sum + n.tx, 0);

        const nodesWithCredits = enrichedNodes.filter(n => n.credits > 0);
        const avgCredits = nodesWithCredits.length > 0 ? totalCredits / nodesWithCredits.length : 0;

        return {
            totalCredits,
            totalRx,
            totalTx,
            avgCredits,
            nodesWithCredits: nodesWithCredits.length,
            totalNodes: nodes.length,
            enrichedNodes
        };
    }, [nodes]);

    // Loading skeleton
    if (loading && nodes.length === 0) {
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
                <Header activePage="stoinc" loading={true} onRefresh={() => { }} />

                <main className="flex-1 overflow-y-auto relative">
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
                                        <div className="h-10 w-16 bg-muted/20 rounded-lg border border-white/10" />
                                        <div className="h-10 w-16 bg-muted/20 rounded-lg border border-white/10" />
                                    </div>
                                </div>
                            </div>

                            {/* Top Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                                <StatsCard title="Total Network Credits" value={0} icon={<TrendingUp className="w-4 h-4 text-green-400" />} color="green" loading={true} subValue=" " />
                                <StatsCard title="Total Packets Rx" value={0} icon={<Activity className="w-4 h-4 text-blue-400" />} color="blue" loading={true} subValue=" " />
                                <StatsCard title="Total Packets Tx" value={0} icon={<Activity className="w-4 h-4 text-emerald-400" />} color="emerald" loading={true} subValue=" " />
                                <StatsCard title="Participating pNodes" value={0} icon={<Users className="w-4 h-4 text-purple-400" />} color="purple" loading={true} subValue=" " />
                            </div>

                            {/* Calculator Toggle */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border border-white/10 rounded-xl w-fit">
                                    <Calculator className="w-4 h-4 text-[#F0A741]" />
                                    <span className="text-sm font-semibold text-[#F0A741]">Show STOINC Calculator</span>
                                </div>
                            </div>

                            {/* Charts & Leaderboard */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className="lg:col-span-8 flex flex-col gap-6">
                                    <div className="card p-4 sm:p-6">
                                        <div className="flex items-center gap-2 mb-6">
                                            <BarChart3 className="w-5 h-5 text-[#F0A741]" />
                                            <h2 className="text-lg font-bold text-foreground">Credits Distribution</h2>
                                        </div>
                                        <div className="h-[400px]">
                                            <ChartSkeleton height={400} />
                                        </div>
                                    </div>
                                </div>
                                <div className="lg:col-span-4 flex flex-col gap-6">
                                    <div className="card overflow-hidden">
                                        <div className="p-4 border-b border-white/10 bg-muted/10">
                                            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                                                <Trophy className="w-4 h-4 text-[#F0A741]" />
                                                Credits Leaderboard
                                            </h2>
                                        </div>
                                        <div className="p-4">
                                            <LeaderboardSkeleton rows={5} />
                                        </div>
                                    </div>

                                    {/* Info Card Skeleton */}
                                    <div className="card p-6 bg-gradient-to-br from-[#F0A741]/10 to-transparent border-[#F0A741]/20">
                                        <h3 className="text-sm font-bold flex items-center gap-2 mb-3 text-[#F0A741]">
                                            <Info className="w-4 h-4" />
                                            What is STOINC?
                                        </h3>
                                        <div className="space-y-2">
                                            <div className="h-3 w-full bg-muted/10 rounded" />
                                            <div className="h-3 w-5/6 bg-muted/10 rounded" />
                                            <div className="h-3 w-4/6 bg-muted/10 rounded" />
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

    return (
        <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
            <Header
                activePage="stoinc"
                lastUpdate={lastUpdate}
                loading={loading}
                onRefresh={() => refreshNodes()}
            />

            <main className="flex-1 overflow-y-auto relative">
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

                        {/* Top Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                            <StatsCard
                                title="Total Network Credits"
                                value={stats.totalCredits}
                                icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                                color="green"
                                loading={loading}
                            />
                            <StatsCard
                                title="Total Packets Rx"
                                value={stats.totalRx}
                                icon={<Activity className="w-4 h-4 text-blue-400" />}
                                color="blue"
                                loading={loading}
                            />
                            <StatsCard
                                title="Total Packets Tx"
                                value={stats.totalTx}
                                icon={<Activity className="w-4 h-4 text-emerald-400" />}
                                color="emerald"
                                loading={loading}
                            />
                            <StatsCard
                                title="Participating pNodes"
                                value={stats.nodesWithCredits}
                                icon={<Users className="w-4 h-4 text-purple-400" />}
                                color="purple"
                                loading={loading}
                            />
                        </div>

                        {/* Calculator Toggle */}
                        <div className="mb-6">
                            <button
                                onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
                                className="flex items-center gap-2 px-4 py-2 bg-muted/30 hover:bg-muted/50 border border-white/10 rounded-xl transition-all text-sm font-semibold text-[#F0A741]"
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
                                            <BarChart3 className="w-5 h-5 text-[#F0A741]" />
                                            Credits Distribution
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
                                        What is STOINC?
                                    </h3>
                                    <div className="space-y-3 text-xs text-foreground/70 leading-relaxed">
                                        <p>
                                            <span className="font-bold text-foreground">Storage Income (STOINC)</span> is the core incentive mechanism of the Xandeum network. It rewards pNode operators for providing scalable storage capacity.
                                        </p>
                                        <p>
                                            <span className="font-bold text-foreground">How it works:</span> pNodes earn credits by successfully processing data packets and maintaining high uptime. These credits determine their share of the network's storage fees.
                                        </p>
                                        <p>
                                            This dashboard shows the real-time activity and distribution of these rewards across the global pNode network.
                                        </p>
                                        <p className="pt-2 border-t border-[#F0A741]/10 opacity-60 italic">
                                            *Data reflects raw activity tracked via the pGlobe analytics engine.
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
