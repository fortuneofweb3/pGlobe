'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { useXandPrice } from '@/lib/hooks/useXandPrice';
import { CardSkeleton } from '@/components/Skeletons';
import PNodeTable from '@/components/PNodeTable';
import StatsCard from '@/components/StatsCard';
import { PNode } from '@/lib/types/pnode';
import { getFlagForCountry } from '@/lib/utils/country-flags';
import { formatStorageBytes } from '@/lib/utils/storage';
import {
    Server, TrendingUp, ArrowLeft, ExternalLink, Copy, Check,
    Award, HardDrive, Users, Zap, Activity, MapPin, Clock, ShieldCheck
} from 'lucide-react';

// Format XAND values with M/K notation and 2 decimal places
const formatXandValue = (value: number): string => {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
        return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
};

interface ManagerDetails {
    wallet: string;
    nodeCount: number;
    onlineCount: number;
    syncingCount: number;
    offlineCount: number;
    totalCredits: number;
    totalStorageCapacity: number;
    totalStorageUsed: number;
    avgUptime: number;
    totalXandStake: number; // This will map to DAO stake
    daoStake: number;
    vestingStake: number;
    associatedWallets?: string[];
}

interface ManagerResponse {
    success: boolean;
    manager: ManagerDetails;
    nodes: PNode[];
    rewards?: { history: any[] };
    associatedWallets?: string[];
    error?: string;
}

function ManagerDetailsContent({ params }: { params: { wallet: string } }) {
    const { wallet } = params;
    const { nodes: allNodes, loading: nodesLoading, lastUpdate, refreshNodes } = useNodes();

    // State
    const [manager, setManager] = useState<ManagerDetails | null>(null);
    const [nodes, setNodes] = useState<PNode[]>([]);
    const [rewards, setRewards] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'nodes' | 'rewards'>('nodes');
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [sortBy, setSortBy] = useState<string>('credits');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // XAND price from Jupiter
    const { formatUsd } = useXandPrice();

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const sortedNodes = useMemo(() => {
        if (!sortBy) return nodes;
        return [...nodes].sort((a, b) => {
            let aVal: any = a[sortBy as keyof PNode];
            let bVal: any = b[sortBy as keyof PNode];
            if (aVal === undefined || aVal === null) aVal = sortOrder === 'asc' ? Infinity : -Infinity;
            if (bVal === undefined || bVal === null) bVal = sortOrder === 'asc' ? Infinity : -Infinity;
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [nodes, sortBy, sortOrder]);

    const fetchManagerDetails = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/managers/${wallet}`);
            const data: ManagerResponse = await res.json();

            if (data.success) {
                setManager(data.manager);
                const pnodes: PNode[] = data.nodes.map((n: any) => ({
                    id: n.pubkey || n.id,
                    address: n.address || '',
                    publicKey: n.pubkey || n.publicKey || '',
                    pubkey: n.pubkey,
                    version: n.version,
                    status: n.status,
                    uptime: n.uptime,
                    credits: n.credits,
                    storageCapacity: n.storageCapacity,
                    storageUsed: n.storageUsed,
                    locationData: n.locationData,
                    location: n.location,
                    balance: n.balance,
                    isPublic: n.isPublic,
                    cpuPercent: n.cpuPercent,
                    ramUsed: n.ramUsed,
                    ramTotal: n.ramTotal,
                    packetsReceived: n.packetsReceived,
                    packetsSent: n.packetsSent,
                    xandStake: n.xandStake,
                    createdAt: n.createdAt,
                    daoStake: n.daoStake,
                    vestingStake: n.vestingStake,
                }));
                setNodes(pnodes);
                // Set rewards from the same API response
                if (data.rewards) {
                    setRewards(data.rewards);
                }
            } else {
                setError(data.error || 'Failed to fetch manager details');
            }
        } catch (err) {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchManagerDetails();
    }, [wallet]);

    const copyWallet = () => {
        navigator.clipboard.writeText(wallet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Derived values
    const uptimePercent = manager?.nodeCount && manager.nodeCount > 0 ? Math.round((manager.onlineCount / manager.nodeCount) * 100) : 0;

    const topLocationData = useMemo(() => {
        if (nodes.length === 0) return null;
        const locationCounts: Record<string, { city?: string; country?: string; count: number }> = {};
        nodes.forEach(n => {
            const city = n.locationData?.city;
            const country = n.locationData?.country;
            const key = city || country || n.location || 'Unknown';
            if (!locationCounts[key]) {
                locationCounts[key] = { city, country, count: 0 };
            }
            locationCounts[key].count++;
        });
        const sorted = Object.entries(locationCounts).sort((a, b) => b[1].count - a[1].count);
        if (sorted.length === 0) return null;
        const top = sorted[0][1];
        const locationStr = top.city && top.country
            ? `${top.city}, ${top.country}`
            : (top.city || top.country || sorted[0][0]);
        return { location: locationStr };
    }, [nodes]);

    const totalUptime = useMemo(() => {
        const totalSeconds = nodes.reduce((sum, n) => sum + (n.uptime || 0), 0);
        if (totalSeconds === 0) return null;
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        if (days > 0) return `${days}d ${hours}h`;
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }, [nodes]);

    if (loading) {
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
                <Header activePage="managers" loading={true} onRefresh={() => { }} />
                <main className="flex-1 overflow-hidden">
                    <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
                        <div className="max-w-7xl mx-auto">
                            <Link href="/managers" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-all duration-300 group">
                                <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
                                <span>Back to Managers</span>
                            </Link>
                            <div className="rounded-2xl border border-border/40 bg-card p-6 mb-8 overflow-hidden relative">
                                <div className="h-8 w-1/2 bg-muted/20 animate-pulse rounded mb-4" />
                                <div className="h-4 w-1/3 bg-muted/10 animate-pulse rounded" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                                <CardSkeleton />
                                <CardSkeleton />
                                <CardSkeleton />
                                <CardSkeleton />
                                <CardSkeleton />
                            </div>
                            <div className="card p-4">
                                <div className="h-32 bg-muted/10 animate-pulse rounded" />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (error || !manager) {
        const isTemporaryError = error?.includes('temporarily') || error?.includes('Database') || error?.includes('connect');
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
                <Header activePage="managers" nodeCount={allNodes.length} lastUpdate={lastUpdate} loading={nodesLoading} onRefresh={refreshNodes} />
                <main className="flex-1 overflow-hidden">
                    <div className="h-full w-full p-3 sm:p-6 overflow-y-auto text-center">
                        <div className="max-w-7xl mx-auto py-12">
                            <p className={`text-lg mb-4 ${isTemporaryError ? 'text-yellow-400' : 'text-red-400'}`}>
                                {error || 'Manager not found'}
                            </p>
                            {isTemporaryError ? (
                                <button
                                    onClick={() => {
                                        setError(null);
                                        setLoading(true);
                                        fetchManagerDetails();
                                    }}
                                    className="px-4 py-2 bg-[#F0A741] text-black font-bold rounded-lg hover:bg-[#F0A741]/80 transition-colors mr-4"
                                >
                                    Retry
                                </button>
                            ) : null}
                            <Link href="/managers" className="text-blue-400 hover:underline">Return to Managers</Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
            <Header activePage="managers" nodeCount={allNodes.length} lastUpdate={lastUpdate} loading={nodesLoading} onRefresh={refreshNodes} />

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 w-full p-3 sm:p-6 overflow-y-auto">
                    <div className="max-w-7xl mx-auto">
                        {/* Back Button */}
                        <Link href="/managers" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-all duration-300 hover:translate-x-[-4px] group">
                            <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
                            <span>Back to Managers</span>
                        </Link>

                        {/* Cover Section */}
                        <div className="relative mb-8 animate-fade-in" style={{ animationDelay: '0.05s', opacity: 0, animationFillMode: 'forwards' }}>
                            <div className="relative rounded-2xl overflow-hidden border border-border/40 shadow-2xl bg-card">
                                <div
                                    className="absolute inset-0 h-full w-full opacity-20 hover:opacity-30 transition-opacity duration-700"
                                    style={{
                                        backgroundImage: `url(https://api.dicebear.com/7.x/identicon/svg?seed=${wallet}&size=100&backgroundColor=transparent)`,
                                        backgroundRepeat: 'repeat',
                                        backgroundSize: '100px 100px'
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-transparent" />
                                <div className="relative px-6 py-10">
                                    <div className="mb-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F0A741]/20 text-[#F0A741] border border-[#F0A741]/30">
                                                <Users className="w-3.5 h-3.5" />
                                                Manager
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-mono text-foreground break-all tracking-tight leading-none">{wallet}</h1>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={copyWallet}
                                                    className="p-2 hover:bg-white/5 rounded-full transition-all active:scale-90 group/copy"
                                                    title="Copy Address"
                                                >
                                                    {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-foreground/30 group-hover/copy:text-foreground transition-colors" />}
                                                </button>
                                                <a
                                                    href={`https://solscan.io/account/${wallet}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 hover:bg-white/5 rounded-full transition-all group/solscan"
                                                    title="View on Solscan"
                                                >
                                                    <ExternalLink className="w-5 h-5 text-foreground/30 group-hover/solscan:text-foreground transition-colors" />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-foreground/60 border-t border-white/5 pt-4">
                                        {topLocationData && <div className="flex items-center gap-2 hover:text-foreground transition-colors"><MapPin className="w-4 h-4 text-[#F0A741]" /> {topLocationData.location}</div>}
                                        {totalUptime && <div className="flex items-center gap-2 hover:text-foreground transition-colors"><Clock className="w-4 h-4 text-[#F0A741]" /> Total Uptime: {totalUptime}</div>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Row - 5 Columns */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                            <StatsCard
                                title="pNodes"
                                value={manager.nodeCount}
                                subValue={`${manager.offlineCount} offline`}
                                icon={<Server className="w-4 h-4" />}
                            />

                            <StatsCard
                                title="Online"
                                value={manager.onlineCount}
                                subValue={`${uptimePercent}% uptime`}
                                icon={<Activity className="w-4 h-4" />}
                                color="green"
                            />

                            <StatsCard
                                title="DAO Stake"
                                value={<><span>{formatXandValue(manager.daoStake || 0)}</span><span className="text-xs ml-1 opacity-50 font-normal">XAND</span></>}
                                subValue={formatUsd(manager.daoStake || 0)}
                                icon={<Award className="w-4 h-4" />}
                                color="orange"
                            />

                            <StatsCard
                                title="Vesting Rewards"
                                value={<><span>{formatXandValue(manager.vestingStake || 0)}</span><span className="text-xs ml-1 opacity-50 font-normal">XAND</span></>}
                                subValue={formatUsd(manager.vestingStake || 0)}
                                icon={<Zap className="w-4 h-4" />}
                                color="blue"
                            />

                            <StatsCard
                                title="Storage"
                                value={formatStorageBytes(manager.totalStorageCapacity)}
                                subValue={`${formatStorageBytes(manager.totalStorageUsed)} used`}
                                icon={<HardDrive className="w-4 h-4" />}
                                color="purple"
                            />
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex gap-2 mb-8 bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/5 w-fit">
                            <button
                                onClick={() => setActiveTab('nodes')}
                                className={`flex items-center gap-2.5 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === 'nodes' ? 'bg-[#F0A741] text-black shadow-[0_4px_12px_rgba(240,167,65,0.3)]' : 'text-foreground/50 hover:text-foreground'}`}
                            >
                                <Server className={`w-4 h-4 ${activeTab === 'nodes' ? 'opacity-100' : 'opacity-50'}`} />
                                pNodes ({nodes.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('rewards')}
                                className={`flex items-center gap-2.5 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === 'rewards' ? 'bg-[#F0A741] text-black shadow-[0_4px_12px_rgba(240,167,65,0.3)]' : 'text-foreground/50 hover:text-foreground'}`}
                            >
                                <Zap className={`w-4 h-4 ${activeTab === 'rewards' ? 'opacity-100' : 'opacity-50'}`} />
                                Rewards & Vesting
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-both">
                            {activeTab === 'nodes' ? (
                                nodes.length === 0 ? (
                                    <div className="card p-20 text-center border-dashed border-white/10">
                                        <Server className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                        <p className="text-foreground/40 text-lg">No nodes associated with this manager.</p>
                                    </div>
                                ) : (
                                    <PNodeTable
                                        nodes={sortedNodes}
                                        sortBy={sortBy}
                                        sortOrder={sortOrder}
                                        onSort={handleSort}
                                    />
                                )
                            ) : (
                                <div className="space-y-6">
                                    {!rewards || !rewards.history || rewards.history.length === 0 ? (
                                        <div className="card p-20 text-center border-dashed border-white/10 bg-white/[0.01]">
                                            <Award className="w-16 h-16 mx-auto mb-6 text-[#F0A741] opacity-20" />
                                            <h3 className="text-xl font-bold mb-2">No Vesting Data</h3>
                                            <p className="text-foreground/40 max-w-sm mx-auto">This manager does not have any active XAND vesting rewards at this time.</p>
                                        </div>
                                    ) : (
                                        <div className="glass-card overflow-hidden border-[#F0A741]/10 bg-gradient-to-br from-card to-black">
                                            <div className="p-6 border-b border-white/5 bg-white/[0.02] flex flex-wrap items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 rounded-lg bg-[#F0A741]/10 border border-[#F0A741]/20">
                                                        <TrendingUp className="w-5 h-5 text-[#F0A741]" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-lg tracking-tight uppercase">Vesting Schedule</h3>
                                                        <p className="text-xs text-foreground/40 font-mono">{rewards.history.length} Tranches Identified</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="bg-black/60 border border-white/5 rounded-2xl px-5 py-3 flex flex-col items-end shadow-inner">
                                                        <span className="text-[10px] text-foreground/30 font-black uppercase tracking-widest mb-1">Locked/Vesting</span>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-2xl font-black text-[#F0A741]">{formatXandValue(manager.vestingStake || 0)}</span>
                                                            <span className="text-[10px] text-foreground/40 font-bold">XAND</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead>
                                                        <tr className="bg-black/40 text-foreground/30 uppercase text-[10px] font-black tracking-[0.2em] border-b border-white/5">
                                                            <th className="px-8 py-5">Unlock Date & Time</th>
                                                            <th className="px-8 py-5">Amount</th>
                                                            <th className="px-8 py-5 text-right">Progress Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {rewards.history.map((tranche: any, idx: number) => {
                                                            const isUnlocked = new Date(tranche.unlockDate) < new Date();
                                                            return (
                                                                <tr key={idx} className="hover:bg-white/[0.03] transition-all duration-300 group">
                                                                    <td className="px-8 py-6">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-foreground font-bold tracking-tight text-lg">
                                                                                {tranche.isGenesis ? (
                                                                                    <span className="flex items-center gap-2 text-[#F0A741]">
                                                                                        <ShieldCheck className="w-4 h-4" />
                                                                                        Genesis Reward
                                                                                    </span>
                                                                                ) : (
                                                                                    new Date(tranche.unlockDate).toLocaleDateString('en-US', {
                                                                                        month: 'long',
                                                                                        day: 'numeric',
                                                                                        year: 'numeric'
                                                                                    })
                                                                                )}
                                                                            </span>
                                                                            {!tranche.isGenesis && (
                                                                                <span className="text-xs text-foreground/30 font-mono mt-1">
                                                                                    {new Date(tranche.unlockDate).toLocaleTimeString('en-US', {
                                                                                        hour: '2-digit',
                                                                                        minute: '2-digit'
                                                                                    })}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-8 py-6">
                                                                        <div className="flex items-center gap-2.5">
                                                                            <div className={`p-1.5 rounded-md ${isUnlocked ? 'bg-green-500/10' : 'bg-white/5'}`}>
                                                                                <Zap className={`w-3.5 h-3.5 ${isUnlocked ? 'text-green-400' : 'text-foreground/20'}`} />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-xl font-black text-foreground tabular-nums">
                                                                                    {formatXandValue(tranche.amount)}
                                                                                    <span className="text-xs ml-1 opacity-50 font-normal">XAND</span>
                                                                                </span>
                                                                                <span className="text-[10px] text-foreground/40 font-bold">{formatUsd(tranche.amount)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-8 py-6 text-right">
                                                                        <div className="inline-flex flex-col items-end gap-2">
                                                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-inset ${tranche.status === 'Claimed' ? 'bg-green-500/20 text-green-300 ring-green-500/30' :
                                                                                tranche.status === 'Partially Claimed' ? 'bg-blue-500/20 text-blue-300 ring-blue-500/30' :
                                                                                    isUnlocked ? 'bg-[#F0A741]/20 text-[#F0A741] ring-[#F0A741]/40' :
                                                                                        'bg-white/5 text-foreground/20 ring-white/10'
                                                                                }`}>
                                                                                {tranche.status}
                                                                            </span>
                                                                            {tranche.status === 'Locked' && (
                                                                                <span className="text-[10px] text-foreground/30 italic">Unlocks in {Math.ceil((new Date(tranche.unlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function ManagerDetailsPage({ params }: { params: { wallet: string } }) {
    return (
        <Suspense fallback={null}>
            <ManagerDetailsContent params={params} />
        </Suspense>
    );
}
