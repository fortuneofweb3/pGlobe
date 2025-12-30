'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { CardSkeleton } from '@/components/Skeletons';
import PNodeTable from '@/components/PNodeTable';
import { PNode } from '@/lib/types/pnode';
import { getFlagForCountry } from '@/lib/utils/country-flags';
import { formatStorageBytes } from '@/lib/utils/storage';
import {
    Server, TrendingUp, ArrowLeft, ExternalLink, Copy, Check,
    Award, HardDrive, Users, Zap, Activity, MapPin, Clock, ShieldCheck
} from 'lucide-react';

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
    const [rewardsLoading, setRewardsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'nodes' | 'rewards'>('nodes');
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [sortBy, setSortBy] = useState<string>('credits');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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

    const fetchRewards = async () => {
        try {
            setRewardsLoading(true);
            const res = await fetch(`/api/managers/${wallet}/rewards`);
            if (res.ok) {
                const data = await res.json();
                setRewards(data);
            }
        } catch (err) {
            console.error('Failed to fetch rewards:', err);
        } finally {
            setRewardsLoading(false);
        }
    };

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
        fetchRewards();
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
        return (
            <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
                <Header activePage="managers" nodeCount={allNodes.length} lastUpdate={lastUpdate} loading={nodesLoading} onRefresh={refreshNodes} />
                <main className="flex-1 overflow-hidden">
                    <div className="h-full w-full p-3 sm:p-6 overflow-y-auto text-center">
                        <div className="max-w-7xl mx-auto py-12">
                            <p className="text-red-400 text-lg mb-4">{error || 'Manager not found'}</p>
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
                                    <div className="flex items-center gap-3 flex-wrap mb-4">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F0A741]/20 text-[#F0A741] border border-[#F0A741]/30">
                                            <Users className="w-3.5 h-3.5" />
                                            Manager
                                        </span>
                                        <h1 className="text-xl sm:text-2xl font-bold font-mono text-foreground break-all tracking-tight leading-none">{wallet}</h1>
                                    </div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <button onClick={copyWallet} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-sm transition-all active:scale-95">
                                            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-foreground/60" />}
                                            {copied ? 'Copied' : 'Copy Address'}
                                        </button>
                                        <a href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-sm transition-all hover:border-[#F0A741]/20">
                                            <ExternalLink className="w-3.5 h-3.5 text-foreground/60" /> Solscan
                                        </a>
                                    </div>
                                    <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-foreground/60 border-t border-white/5 pt-4">
                                        {topLocationData && <div className="flex items-center gap-2 hover:text-foreground transition-colors"><MapPin className="w-4 h-4 text-[#F0A741]" /> {topLocationData.location}</div>}
                                        {totalUptime && <div className="flex items-center gap-2 hover:text-foreground transition-colors"><Clock className="w-4 h-4 text-[#F0A741]" /> Total Uptime: {totalUptime}</div>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Row - 6 Columns */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                            <div className="card p-5 group hover:border-white/20 transition-all">
                                <div className="text-[10px] uppercase text-foreground/40 font-bold tracking-widest mb-2 flex items-center gap-1.5">
                                    <Server className="w-3 h-3" />
                                    pNodes
                                </div>
                                <div className="text-3xl font-bold font-mono">{manager.nodeCount}</div>
                            </div>

                            <div className="card p-5 group hover:border-green-500/20 transition-all">
                                <div className="text-[10px] uppercase text-foreground/40 font-bold tracking-widest mb-2 flex items-center gap-1.5">
                                    <Activity className="w-3 h-3 text-green-400" />
                                    Online
                                </div>
                                <div className="text-3xl font-bold text-green-400 font-mono">{manager.onlineCount} <span className="text-xs font-normal text-foreground/30 ml-1">({uptimePercent}%)</span></div>
                            </div>

                            {/* DAO Stake Card */}
                            <div className="card p-5 border-[#F0A741]/20 bg-[#F0A741]/5 hover:border-[#F0A741]/40 transition-all relative overflow-hidden group">
                                <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                                    <Users className="w-24 h-24 text-[#F0A741]" />
                                </div>
                                <div className="text-[10px] uppercase text-[#F0A741]/70 font-black tracking-widest mb-2 flex items-center gap-1.5">
                                    <Award className="w-3 h-3" />
                                    DAO Stake
                                </div>
                                <div className="text-3xl font-bold text-[#F0A741] font-mono">
                                    {(manager.daoStake || 0).toLocaleString()}
                                    <span className="text-xs ml-1 opacity-50 font-normal">XAND</span>
                                </div>
                            </div>

                            {/* Vesting Rewards Card (Locked/Claimable) */}
                            <div className="card p-5 border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40 transition-all relative overflow-hidden group">
                                <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                                    <TrendingUp className="w-24 h-24 text-blue-400" />
                                </div>
                                <div className="text-[10px] uppercase text-blue-400/70 font-black tracking-widest mb-2 flex items-center gap-1.5">
                                    <Zap className="w-3 h-3" />
                                    Vesting Rewards
                                </div>
                                <div className="text-3xl font-bold text-blue-400 font-mono">
                                    {(manager.vestingStake || 0).toLocaleString()}
                                    <span className="text-xs ml-1 opacity-50 font-normal">XAND</span>
                                </div>
                            </div>


                            <div className="card p-5 group hover:border-purple-500/20 transition-all">
                                <div className="text-[10px] uppercase text-foreground/40 font-bold tracking-widest mb-2 flex items-center gap-1.5">
                                    <HardDrive className="w-3 h-3 text-purple-400" />
                                    Storage
                                </div>
                                <div className="text-3xl font-bold text-purple-400 font-mono">{formatStorageBytes(manager.totalStorageCapacity)}</div>
                            </div>
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
                                    {rewardsLoading ? (
                                        <div className="card p-20 text-center animate-pulse border-white/5 bg-white/[0.02]">
                                            <div className="loading-spinner mb-4" />
                                            <p className="text-foreground/60">Fetching latest reward schedules...</p>
                                        </div>
                                    ) : !rewards || !rewards.history || rewards.history.length === 0 ? (
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
                                                            <span className="text-2xl font-black text-[#F0A741]">{(manager.vestingStake || 0).toLocaleString()}</span>
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
                                                                                    {tranche.amount.toLocaleString()}
                                                                                </span>
                                                                                <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-tighter">XAND Reward</span>
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
