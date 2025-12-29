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
    Award, HardDrive, Users, Zap, Activity, MapPin, Clock
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
    totalXandStake: number; // Staked in DAO
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
    const router = useRouter();
    const { nodes: allNodes, loading: nodesLoading, lastUpdate, refreshNodes } = useNodes();
    const [manager, setManager] = useState<ManagerDetails | null>(null);
    const [nodes, setNodes] = useState<PNode[]>([]);
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        fetchManagerDetails();
    }, [wallet]);

    async function fetchManagerDetails() {
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
    }

    const copyWallet = () => {
        navigator.clipboard.writeText(wallet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };



    // Calculate derived values (must be before any returns for hooks consistency)
    const uptimePercent = manager?.nodeCount && manager.nodeCount > 0 ? Math.round((manager.onlineCount / manager.nodeCount) * 100) : 0;

    // Calculate top location (most common location among nodes) with country
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
        const flag = top.country ? getFlagForCountry(top.country) : '';
        const locationStr = top.city && top.country
            ? `${top.city}, ${top.country}`
            : (top.city || top.country || sorted[0][0]);
        return { location: locationStr, flag };
    }, [nodes]);

    // Calculate total uptime
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
                            {/* Back Button (Static) */}
                            <Link href="/managers" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-all duration-300 group">
                                <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
                                <span>Back to Managers</span>
                            </Link>

                            <div className="rounded-2xl border border-border/40 bg-card p-6 mb-8 overflow-hidden relative">
                                <div className="flex items-center gap-3 flex-wrap mb-4">
                                    <div className="h-6 w-24 bg-muted/20 rounded-full animate-pulse" />
                                    <div className="h-6 w-16 bg-muted/20 rounded-full animate-pulse" />
                                </div>
                                <div className="h-8 w-full max-w-md bg-muted/20 rounded mb-6 animate-pulse" />
                                <div className="flex gap-2 mb-6">
                                    <div className="h-8 w-16 bg-muted/20 rounded-lg animate-pulse" />
                                    <div className="h-8 w-16 bg-muted/20 rounded-lg animate-pulse" />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-muted/10 rounded-full animate-pulse" />
                                        <div className="h-4 w-48 bg-muted/10 rounded animate-pulse" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-muted/10 rounded-full animate-pulse" />
                                        <div className="h-4 w-36 bg-muted/10 rounded animate-pulse" />
                                    </div>
                                </div>
                            </div>

                            {/* Stats Cards Skeleton */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                                <CardSkeleton />
                                <CardSkeleton />
                                <CardSkeleton />
                                <CardSkeleton />
                            </div>

                            {/* Table Skeleton */}
                            <div className="card p-4">
                                <div className="h-5 w-32 bg-muted/30 rounded mb-4 animate-pulse" />
                                <div className="space-y-3">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="h-12 bg-muted/20 rounded animate-pulse" />
                                    ))}
                                </div>
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
                    <div className="h-full w-full p-3 sm:p-6 overflow-y-auto">
                        <div className="max-w-7xl mx-auto">
                            <Link href="/managers" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-4 transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                Back to Managers
                            </Link>
                            <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                                <p className="text-red-400 text-lg">{error || 'Manager not found'}</p>
                            </div>
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

                        {/* Cover Section with DiceBear Background (like node details map) */}
                        <div className="relative mb-8 animate-fade-in" style={{ animationDelay: '0.05s', opacity: 0, animationFillMode: 'forwards' }}>
                            <div className="relative rounded-2xl overflow-hidden border border-border/40 shadow-2xl bg-card">
                                {/* DiceBear Avatar - tiled/repeated pattern */}
                                <div
                                    className="absolute inset-0 h-full w-full opacity-30"
                                    style={{
                                        backgroundImage: `url(https://api.dicebear.com/7.x/identicon/svg?seed=${wallet}&size=100&backgroundColor=transparent)`,
                                        backgroundRepeat: 'repeat',
                                        backgroundSize: '100px 100px'
                                    }}
                                />
                                {/* Gradient overlay - stronger on left for text readability */}
                                <div className="absolute inset-0 bg-gradient-to-r from-card via-card/60 to-transparent" />

                                {/* Content Overlay - Left Side */}
                                <div className="relative px-5 sm:px-7 lg:px-9 pt-6 pb-4">
                                    {/* Header Row */}
                                    <div className="mb-3">
                                        <div className="animate-slide-in-left" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
                                            {/* Badge */}
                                            <div className="flex items-center gap-3 flex-wrap mb-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F0A741]/20 text-[#F0A741] border border-[#F0A741]/30">
                                                    <Users className="w-3.5 h-3.5" />
                                                    Manager
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                    {manager.nodeCount} pNode{manager.nodeCount !== 1 ? 's' : ''}
                                                </span>
                                            </div>

                                            {/* Title - Wallet Address */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono text-foreground break-all">
                                                    {wallet}
                                                </h1>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2 mb-4">
                                                <button
                                                    onClick={copyWallet}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm border border-white/10"
                                                    title="Copy wallet"
                                                >
                                                    {copied ? (
                                                        <><Check className="w-3.5 h-3.5 text-green-400" /> Copied</>
                                                    ) : (
                                                        <><Copy className="w-3.5 h-3.5 text-foreground/60" /> Copy</>
                                                    )}
                                                </button>
                                                <a
                                                    href={`https://solscan.io/account/${wallet}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm border border-white/10"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5 text-foreground/60" /> Solscan
                                                </a>
                                            </div>

                                            {/* Additional Info - Location & Uptime */}
                                            <div className="space-y-1 text-sm">
                                                {topLocationData && (
                                                    <div className="flex items-center gap-2 text-foreground/60">
                                                        <MapPin className="w-4 h-4" />
                                                        <span>{topLocationData.flag} {topLocationData.location}</span>
                                                    </div>
                                                )}
                                                {totalUptime && (
                                                    <div className="flex items-center gap-2 text-foreground/60">
                                                        <Clock className="w-4 h-4" />
                                                        <span>Total Uptime: {totalUptime}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Row - Outside Header */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                            <div className="card p-4">
                                <div className="flex items-center gap-2 text-foreground/50 text-xs uppercase tracking-wider mb-1">
                                    <Server className="w-3.5 h-3.5" />
                                    pNodes
                                </div>
                                <div className="text-2xl font-bold text-foreground">{manager.nodeCount}</div>
                            </div>
                            <div className="card p-4">
                                <div className="flex items-center gap-2 text-foreground/50 text-xs uppercase tracking-wider mb-1">
                                    <Activity className="w-3.5 h-3.5 text-green-400" />
                                    Online
                                </div>
                                <div className="text-2xl font-bold text-green-400">
                                    {manager.onlineCount}
                                    <span className="text-sm text-foreground/40 ml-1">({uptimePercent}%)</span>
                                </div>
                            </div>
                            <div className="card p-4">
                                <div className="flex items-center gap-2 text-foreground/50 text-xs uppercase tracking-wider mb-1">
                                    <Award className="w-3.5 h-3.5 text-[#F0A741]" />
                                    Credits
                                </div>
                                <div className="text-2xl font-bold text-[#F0A741]">{manager.totalCredits.toLocaleString()}</div>
                            </div>
                            <div className="card p-4 border-[#F0A741]/20 bg-[#F0A741]/5 group hover:bg-[#F0A741]/10 transition-all duration-300">
                                <div className="flex items-center gap-2 text-[#F0A741]/60 text-xs uppercase tracking-wider mb-1 font-semibold">
                                    <TrendingUp className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                                    XAND Stake
                                </div>
                                <div className="text-2xl font-bold text-[#F0A741]">
                                    {manager.totalXandStake?.toLocaleString() || '0'}
                                    <span className="text-xs text-[#F0A741]/50 ml-1 font-normal uppercase">XAND</span>
                                </div>
                            </div>
                            <div className="card p-4 transition-all duration-300 hover:bg-white/5">
                                <div className="flex items-center gap-2 text-foreground/50 text-xs uppercase tracking-wider mb-1">
                                    <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                                    Total Storage
                                </div>
                                <div className="text-2xl font-bold text-purple-400">{formatStorageBytes(manager.totalStorageCapacity)}</div>
                            </div>
                        </div>

                        {/* Nodes Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Server className="w-5 h-5 text-[#F0A741]" />
                                pNodes ({nodes.length})
                            </h2>
                        </div>

                        {/* Node Table */}
                        {nodes.length === 0 ? (
                            <div className="card p-8 text-center text-foreground/60">
                                No nodes found for this manager.
                            </div>
                        ) : (
                            <PNodeTable
                                nodes={sortedNodes}
                                sortBy={sortBy}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                            />
                        )}
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
