'use client';

import { useState, useMemo } from 'react';
import { Calculator, Coins, HardDrive, Gauge, Sparkles, Crown, Search, Network, Users } from 'lucide-react';
import AnimatedNumber from '@/components/AnimatedNumber';
import { PNode } from '@/lib/types/pnode';

interface StoincCalculatorProps {
    networkAvgCreditsPerNode?: number;
    nodes?: PNode[];
    totalNetworkBoostedCredits?: number;
}

// Official NFT Multipliers from Xandeum STOINC Documentation
const NFT_MULTIPLIERS = [
    { name: 'None', multiplier: 1, icon: null },
    { name: 'Cricket', multiplier: 1.1, icon: '🦗' },
    { name: 'XENO', multiplier: 1.1, icon: '👽' },
    { name: 'Rabbit', multiplier: 1.5, icon: '🐰' },
    { name: 'Coyote', multiplier: 2.5, icon: '🐺' },
    { name: 'Dragon', multiplier: 4, icon: '🐉' },
    { name: 'Titan', multiplier: 11, icon: '⚡' },
];

// Official Era Multipliers from Xandeum STOINC Documentation
const ERA_MULTIPLIERS = [
    { name: 'Standard', multiplier: 1 },
    { name: 'North Era', multiplier: 1.25 },
    { name: 'Central Era', multiplier: 2 },
    { name: 'Coal Era', multiplier: 3.5 },
    { name: 'Main Era', multiplier: 7 },
    { name: 'South Era', multiplier: 10 },
    { name: 'DeepSouth Era', multiplier: 16 },
];

// Official pNode share from STOINC distribution (94% to pNode operators)
const PNODE_SHARE = 0.94;

export default function StoincCalculator({
    networkAvgCreditsPerNode = 100,
    nodes = [],
    totalNetworkBoostedCredits = 100000
}: StoincCalculatorProps) {
    const [pNodeCount, setPNodeCount] = useState(1);
    const [storageGB, setStorageGB] = useState(100);
    const [performanceScore, setPerformanceScore] = useState(0.9);
    const [nftIndex, setNftIndex] = useState(0);
    const [eraIndex, setEraIndex] = useState(0);
    const [xandStake, setXandStake] = useState(0);
    const [selectedNodeId, setSelectedNodeId] = useState<string>('');
    const [totalNetworkFees, setTotalNetworkFees] = useState(50000);
    const [networkBoostedCredits, setNetworkBoostedCredits] = useState(totalNetworkBoostedCredits);

    // Handle node selection
    const handleNodeChange = (nodeId: string) => {
        setSelectedNodeId(nodeId);
        if (!nodeId) return;

        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            setPNodeCount(1);
            setStorageGB(Math.round((node.storageCapacity || (1024 ** 3 * 100)) / (1024 ** 3)));

            // Performance score - use credits/86400 formula if credits available
            const EXPECTED_CREDITS = 86400;
            const nodeCredits = Number(node.credits || 0);
            let perf = nodeCredits > 0 ? Math.min(1.0, nodeCredits / EXPECTED_CREDITS) : ((node as any).derivedPerfScore ?? 0.9);

            // Apply a slight boost for high-performing nodes to stay consistent with expectations
            if (perf > 0 && perf < 0.9 && node.status === 'online') {
                perf = 0.9;
            }

            setPerformanceScore(perf);
            setXandStake(node.xandStake || 0);

            // Era Boost detection (Official Eras: North, Central, Coal, Main, South, DeepSouth)
            const eraLabel = (node.eraLabel || '').toLowerCase();
            if (eraLabel.includes('deepsouth') || eraLabel.includes('deep south')) setEraIndex(6);
            else if (eraLabel.includes('south')) setEraIndex(5);
            else if (eraLabel.includes('main')) setEraIndex(4);
            else if (eraLabel.includes('coal')) setEraIndex(3);
            else if (eraLabel.includes('central')) setEraIndex(2);
            else if (eraLabel.includes('north')) setEraIndex(1);
            else setEraIndex(0);

            // NFT Boost detection (Official values: Cricket=1.1, XENO=1.1, Rabbit=1.5, Coyote=2.5, Dragon=4, Titan=11)
            const nftBoost = node.nftBoost || 1;
            if (nftBoost >= 11) setNftIndex(6); // Titan
            else if (nftBoost >= 4) setNftIndex(5); // Dragon
            else if (nftBoost >= 2.5) setNftIndex(4); // Coyote
            else if (nftBoost >= 1.5) setNftIndex(3); // Rabbit
            else if (nftBoost >= 1.1) setNftIndex(2); // XENO/Cricket
            else setNftIndex(0);
        }
    };

    const calculation = useMemo(() => {
        const nftMultiplier = NFT_MULTIPLIERS[nftIndex].multiplier;
        const eraMultiplier = ERA_MULTIPLIERS[eraIndex].multiplier;

        // 1. Multiplier (individual node boost)
        const nodeMultiplier = nftMultiplier * eraMultiplier;

        // 2. Storage Credits: pNodes × storageSpace × performanceScore × stake
        const storageCreditsPerNode = storageGB * performanceScore * (xandStake > 0 ? xandStake : 1);
        const totalStorageCredits = pNodeCount * storageCreditsPerNode;

        // 3. Wallet Boost (Geometric Mean)
        // Since we assume identical config for all nodes in the calculator:
        // geometricMean = nthRoot(Product(nodeMultiplier)) = nodeMultiplier
        const walletGeometricMeanBoost = nodeMultiplier;

        // 4. Boosted Credits = totalStorageCredits × walletGeometricMeanBoost
        const boostedCredits = totalStorageCredits * walletGeometricMeanBoost;

        // 5. STOINC Reward Share
        const estimatedStoinc = (totalNetworkFees * PNODE_SHARE * boostedCredits) / (networkBoostedCredits || 1);

        // 5. Monthly XAND (Foundation + Yield)
        const STAKE_YIELD_MONTHLY = 0.05;
        const foundationReward = pNodeCount * 10000;
        const stakeYieldReward = xandStake * STAKE_YIELD_MONTHLY;
        const totalXandReward = foundationReward + stakeYieldReward;

        return {
            storageCredits: totalStorageCredits,
            boostedCredits,
            totalMultiplier: walletGeometricMeanBoost,
            estimatedStoinc,
            foundationReward,
            stakeYieldReward,
            totalXandReward,
            nftName: NFT_MULTIPLIERS[nftIndex].name,
            eraName: ERA_MULTIPLIERS[eraIndex].name,
        };
    }, [pNodeCount, storageGB, performanceScore, nftIndex, eraIndex, xandStake, totalNetworkFees, networkBoostedCredits]);

    return (
        <div className="space-y-6">
            {/* Node Selector */}
            <div className="flex flex-col sm:flex-row items-end gap-4 pb-4 border-b border-white/5">
                <div className="flex-1 w-full space-y-2">
                    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/40 font-bold">
                        <Search className="w-3.5 h-3.5" />
                        Quick Fill from Existing Node
                    </label>
                    <select
                        value={selectedNodeId}
                        onChange={(e) => handleNodeChange(e.target.value)}
                        className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-foreground focus:border-[#F0A741]/40 focus:outline-none focus:ring-1 focus:ring-[#F0A741]/20 transition-colors"
                    >
                        <option value="">-- Select a Node to Pre-fill --</option>
                        {nodes.map(node => (
                            <option key={node.id} value={node.id}>
                                {node.locationData?.city || 'pNode'} ({node.id.slice(0, 8)}...)
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* pNode Count */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/40 font-bold">
                        <Coins className="w-3.5 h-3.5" />
                        pNodes
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={100}
                        value={pNodeCount}
                        onChange={(e) => setPNodeCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-foreground font-mono focus:border-[#F0A741]/40 focus:outline-none focus:ring-1 focus:ring-[#F0A741]/20 transition-colors"
                    />
                </div>

                {/* Storage GB */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/40 font-bold">
                        <HardDrive className="w-3.5 h-3.5" />
                        Storage (GB)
                    </label>
                    <input
                        type="number"
                        min={10}
                        max={10000}
                        step={10}
                        value={storageGB}
                        onChange={(e) => setStorageGB(Math.max(10, parseInt(e.target.value) || 100))}
                        className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-foreground font-mono focus:border-[#F0A741]/40 focus:outline-none focus:ring-1 focus:ring-[#F0A741]/20 transition-colors"
                    />
                </div>

                {/* Performance Score */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/40 font-bold">
                        <Gauge className="w-3.5 h-3.5" />
                        Performance (0-1)
                    </label>
                    <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={performanceScore}
                        onChange={(e) => setPerformanceScore(Math.min(1, Math.max(0, parseFloat(e.target.value) || 0.9)))}
                        className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-foreground font-mono focus:border-[#F0A741]/40 focus:outline-none focus:ring-1 focus:ring-[#F0A741]/20 transition-colors"
                    />
                </div>

                {/* XAND Stake */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#F0A741] font-bold">
                        <Coins className="w-3.5 h-3.5" />
                        XAND Staked
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={xandStake}
                        onChange={(e) => setXandStake(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-4 py-2.5 bg-black/50 border border-[#F0A741]/20 rounded-lg text-foreground font-mono focus:border-[#F0A741]/40 focus:outline-none focus:ring-1 focus:ring-[#F0A741]/20 transition-colors"
                    />
                </div>

                {/* Multipliers row */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/40 font-bold">
                        <Sparkles className="w-3.5 h-3.5" />
                        NFT Boost
                    </label>
                    <select
                        value={nftIndex}
                        onChange={(e) => setNftIndex(parseInt(e.target.value))}
                        className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-foreground focus:border-[#F0A741]/40 focus:outline-none focus:ring-1 focus:ring-[#F0A741]/20 transition-colors"
                    >
                        {NFT_MULTIPLIERS.map((nft, index) => (
                            <option key={nft.name} value={index}>
                                {nft.icon ? `${nft.icon} ` : ''}{nft.name} ({nft.multiplier}x)
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/40 font-bold">
                        <Crown className="w-3.5 h-3.5" />
                        Era Boost
                    </label>
                    <select
                        value={eraIndex}
                        onChange={(e) => setEraIndex(parseInt(e.target.value))}
                        className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-foreground focus:border-[#F0A741]/40 focus:outline-none focus:ring-1 focus:ring-[#F0A741]/20 transition-colors"
                    >
                        {ERA_MULTIPLIERS.map((era, index) => (
                            <option key={era.name} value={index}>
                                {era.name} ({era.multiplier}x)
                            </option>
                        ))}
                    </select>
                </div>

                {/* Network Stats row */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/40 font-bold">
                        <Network className="w-3.5 h-3.5" />
                        Total Network Fees
                    </label>
                    <input
                        type="number"
                        value={totalNetworkFees}
                        onChange={(e) => setTotalNetworkFees(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-foreground font-mono focus:border-[#F0A741]/40 focus:outline-none focus:ring-1 focus:ring-[#F0A741]/20 transition-colors"
                    />
                </div>

                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/40 font-bold">
                        <Users className="w-3.5 h-3.5" />
                        Network Credits
                    </label>
                    <input
                        type="number"
                        value={networkBoostedCredits}
                        onChange={(e) => setNetworkBoostedCredits(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-foreground font-mono focus:border-[#F0A741]/40 focus:outline-none focus:ring-1 focus:ring-[#F0A741]/20 transition-colors"
                    />
                </div>
            </div>

            {/* Results */}
            <div className="bg-gradient-to-br from-[#F0A741]/10 to-transparent border border-[#F0A741]/20 rounded-xl p-5 shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Calculator className="w-32 h-32 text-[#F0A741]" />
                </div>

                <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="w-4 h-4 text-[#F0A741]" />
                    <h3 className="text-sm font-bold text-foreground">STOINC Projection</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                    {/* Storage Credits */}
                    <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                        <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Storage Credits</div>
                        <div className="text-xl font-bold font-mono text-foreground/80">
                            <AnimatedNumber value={calculation.storageCredits} decimals={1} />
                        </div>
                    </div>

                    {/* Multiplier */}
                    <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                        <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Total GeoBoost</div>
                        <div className="text-xl font-bold font-mono text-[#F0A741]">
                            {calculation.totalMultiplier.toFixed(2)}x
                        </div>
                    </div>

                    {/* Boosted Credits */}
                    <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                        <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Boosted Weight</div>
                        <div className="text-xl font-bold font-mono text-[#F0A741]">
                            <AnimatedNumber value={calculation.boostedCredits} decimals={1} />
                        </div>
                    </div>

                    {/* STOINC Reward */}
                    <div className="bg-[#F0A741]/20 p-4 rounded-lg border border-[#F0A741]/30">
                        <div className="text-[10px] uppercase tracking-wider text-[#F0A741] mb-1">EST. STOINC (XAND/Epoch)</div>
                        <div className="text-2xl font-black font-mono text-[#F0A741]">
                            <AnimatedNumber value={calculation.estimatedStoinc} decimals={1} />
                        </div>
                    </div>
                </div>

                {/* XAND Rewards Note */}
                <div className="mt-4 pt-4 border-t border-[#F0A741]/20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="text-center sm:text-left">
                            <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Monthly Foundation Reward</div>
                            <div className="text-sm font-bold text-foreground">
                                <AnimatedNumber value={calculation.foundationReward} /> XAND
                            </div>
                        </div>
                        <div className="text-center sm:text-left">
                            <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Monthly Stake Yield (Est)</div>
                            <div className="text-sm font-bold text-foreground">
                                <AnimatedNumber value={calculation.stakeYieldReward} /> XAND
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 text-center">
                        <div className="text-xs text-foreground/60">
                            Total Est. Monthly XAND: <span className="text-[#F0A741] font-bold"><AnimatedNumber value={calculation.totalXandReward} /> XAND</span>
                        </div>
                    </div>
                </div>

                {/* Disclaimer */}
                <div className="mt-3 text-[10px] text-foreground/30 text-center">
                    * Estimates based on network averages. Actual earnings depend on network conditions and sedApp usage.
                </div>
            </div>
        </div>
    );
}
