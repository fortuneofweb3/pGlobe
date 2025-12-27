'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PNode } from '@/lib/types/pnode';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { startProgress } from '@/lib/nprogress';
import AnimatedNumber from '@/components/AnimatedNumber';

interface CreditsLeaderboardProps {
    nodes: PNode[];
    limit?: number;
}

export default function CreditsLeaderboard({ nodes, limit = 20 }: CreditsLeaderboardProps) {
    const router = useRouter();

    const rankedNodes = useMemo(() => {
        return nodes
            .filter(n => n.credits !== undefined && n.credits > 0)
            .sort((a, b) => (b.credits || 0) - (a.credits || 0))
            .slice(0, limit);
    }, [nodes, limit]);

    const handleNodeClick = (node: PNode) => {
        const nodeId = node.id || node.pubkey || node.publicKey || '';
        if (nodeId) {
            startProgress();
            router.push(`/nodes/${encodeURIComponent(nodeId)}`);
        }
    };

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-400" />;
        if (rank === 2) return <Medal className="w-4 h-4 text-gray-300" />;
        if (rank === 3) return <Award className="w-4 h-4 text-amber-600" />;
        return <span className="w-4 text-center text-foreground/40 text-xs font-mono">{rank}</span>;
    };

    const formatAddress = (node: PNode) => {
        const addr = node.address || node.pubkey || node.publicKey || '';
        if (addr.length > 20) {
            return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
        }
        return addr;
    };

    if (rankedNodes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-foreground/40">
                <TrendingUp className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No credits data available</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-foreground/40 font-bold border-b border-white/5">
                <div className="col-span-1">#</div>
                <div className="col-span-7">Node</div>
                <div className="col-span-4 text-right">Credits</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
                {rankedNodes.map((node, index) => {
                    const rank = index + 1;

                    return (
                        <button
                            key={node.id || node.pubkey || index}
                            onClick={() => handleNodeClick(node)}
                            className="grid grid-cols-12 gap-2 px-3 py-2.5 w-full text-left hover:bg-white/5 transition-colors group"
                        >
                            <div className="col-span-1 flex items-center">
                                {getRankIcon(rank)}
                            </div>
                            <div className="col-span-7 flex items-center gap-2">
                                <span className="text-sm font-mono text-foreground/80 group-hover:text-[#F0A741] transition-colors truncate">
                                    {formatAddress(node)}
                                </span>
                            </div>
                            <div className="col-span-4 flex items-center justify-end">
                                <span className="text-sm font-bold font-mono text-[#F0A741]">
                                    <AnimatedNumber value={node.credits || 0} decimals={0} />
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
