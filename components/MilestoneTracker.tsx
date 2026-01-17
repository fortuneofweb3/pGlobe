'use client';

import { useMemo } from 'react';
import { XANDEUM_ERAS, getEraForItem, MILESTONE_DETAILS, getItemForVersion } from '@/lib/constants/eras';
import { PNode } from '@/lib/types/pnode';
import { Rocket, Target, Award } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

interface MilestoneTrackerProps {
    nodes: PNode[];
    className?: string;
    variant?: 'default' | 'flat';
    style?: React.CSSProperties;
}

export default function MilestoneTracker({ nodes, className = "", variant = 'default', style }: MilestoneTrackerProps) {
    const eraStats = useMemo(() => {
        if (nodes.length === 0) return null;

        // Determine milestone from node versions (most reliable source)
        const itemIndices = nodes.map(n => {
            // First try milestoneItem if it's set and valid
            if (n.milestoneItem && n.milestoneItem > 0) return n.milestoneItem;
            // Fall back to deriving from version
            return getItemForVersion(n.version);
        });

        const currentItem = Math.max(...itemIndices, 0);
        const currentEra = getEraForItem(currentItem);

        // Get milestone details
        const milestoneDetail = MILESTONE_DETAILS[currentItem];

        // Calculate progress within current era
        const min = currentEra.minItem;
        const max = currentEra.maxItem || (currentItem + 5); // Fallback for last era
        const progress = ((currentItem - min) / (max - min)) * 100;

        // Count nodes in current era
        const nodesInCurrentEra = nodes.filter(n => {
            const idx = n.milestoneItem && n.milestoneItem > 0 ? n.milestoneItem : getItemForVersion(n.version);
            return idx >= currentEra.minItem && (currentEra.maxItem === undefined || idx <= currentEra.maxItem);
        }).length;

        return {
            currentItem,
            currentEra,
            milestoneDetail,
            progress: Math.min(100, Math.max(0, progress)),
            nodesInCurrentEra,
            totalNodes: nodes.length
        };
    }, [nodes]);

    if (!eraStats) return null;

    const { currentEra, currentItem, milestoneDetail, progress, nodesInCurrentEra } = eraStats;

    if (variant === 'flat') {
        // Get the latest version by semantic version comparison (same logic as VersionDistribution)
        const versions = nodes
            .map(n => n.version)
            .filter((v): v is string => !!v && v !== 'Unknown' && !v.includes('-trynet'));

        const latestVersion = versions.length > 0
            ? [...new Set(versions)].sort((a, b) => {
                const aBase = a.replace('v', '').split('-')[0];
                const bBase = b.replace('v', '').split('-')[0];
                const aParts = aBase.split('.').map(Number);
                const bParts = bBase.split('.').map(Number);
                for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                    const aVal = aParts[i] || 0;
                    const bVal = bParts[i] || 0;
                    if (aVal !== bVal) return bVal - aVal;
                }
                return 0;
            })[0]
            : nodes[0]?.version || 'Unknown';

        return (
            <div className={`relative p-4 rounded-xl bg-[#050505] border border-[#F0A741]/10 backdrop-blur-md overflow-hidden group hover:bg-[#0a0a0a] hover:border-[#F0A741]/30 transition-all duration-300 ${className}`} style={style}>
                {/* Header */}
                <div className="flex items-center justify-between mb-4 mt-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#F0A741]/10">
                            <Rocket className="w-5 h-5 text-[#F0A741]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">{currentEra.name}</h3>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Innovation Era</p>
                        </div>
                    </div>
                </div>

                {/* Milestone Info */}
                <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground/60">Milestone</span>
                        <div className="flex items-center gap-2">
                            <Target className="w-3.5 h-3.5 text-[#F0A741]" />
                            <span className="text-sm font-bold text-foreground">
                                {milestoneDetail ? milestoneDetail.city : `#${currentItem}`}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground/60">Network Version</span>
                        <span className="text-sm font-mono font-bold text-[#3F8277]">{latestVersion}</span>
                    </div>
                </div>

                {/* Feature badge */}
                {milestoneDetail && (
                    <div className="p-2.5 rounded-lg bg-[#F0A741]/5 border border-[#F0A741]/20">
                        <div className="flex items-start gap-2">
                            <Award className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#F0A741]" />
                            <div>
                                <p className="text-[10px] text-foreground/50 uppercase tracking-wider">Current Feature</p>
                                <p className="text-sm font-medium text-foreground">{milestoneDetail.feature}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`p-4 bg-card/50 border border-[#F0A741]/20 rounded-xl overflow-hidden relative group ${className}`} style={style}>
            {/* Background Glow */}
            <div
                className="absolute -right-4 -top-4 w-24 h-24 blur-[60px] opacity-20 transition-all duration-500 group-hover:opacity-40"
                style={{ backgroundColor: currentEra.color }}
            />

            {/* Era Header */}
            <div className="flex items-center gap-2 mb-4">
                <div
                    className="p-2 rounded-lg bg-background/50 border border-border/50"
                    style={{ color: currentEra.color }}
                >
                    <Rocket className="w-4 h-4" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        {currentEra.name}
                        <InfoTooltip content={currentEra.description} />
                    </h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Innovation Era</p>
                </div>
            </div>

            {/* Current Milestone */}
            {milestoneDetail && (
                <div className="mb-4 p-3 rounded-lg border border-white/10 bg-background/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Milestone</span>
                        </div>
                        <span className="font-bold" style={{ color: currentEra.color }}>{milestoneDetail.city}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 pl-6">{milestoneDetail.feature}</p>
                </div>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Era Progress</span>
                    <span className="font-medium text-foreground">{Math.round(progress)}%</span>
                </div>

                {/* Progress Bar Container */}
                <div className="h-1.5 w-full bg-background/50 rounded-full overflow-hidden border border-white/10">
                    <div
                        className="h-full transition-all duration-1000 ease-out relative"
                        style={{
                            width: `${progress}%`,
                            backgroundColor: currentEra.color,
                            boxShadow: `0 0 10px ${currentEra.color}40`
                        }}
                    >
                        {/* Animated Shine */}
                        <div className="absolute inset-0 w-full h-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Award className="w-3 h-3" />
                        <span>{nodesInCurrentEra} nodes in this era</span>
                    </div>
                    {currentEra.maxItem && (
                        <span className="text-[10px] text-muted-foreground">
                            Next: {MILESTONE_DETAILS[currentEra.maxItem + 1]?.city || `Item ${currentEra.maxItem + 1}`}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
