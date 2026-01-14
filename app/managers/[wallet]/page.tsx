'use client';

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useNodes } from '@/lib/context/NodesContext';
import { useXandPrice } from '@/lib/hooks/useXandPrice';
import { StatCardSkeleton, ChartSkeleton, PNodeTableSkeleton } from '@/components/Skeletons';
import PNodeTable from '@/components/PNodeTable';
import StatsCard from '@/components/StatsCard';
import { mergeDuplicateIPNodes } from '@/lib/utils/merge-duplicate-ips';
import { PNode } from '@/lib/types/pnode';
import { formatStorageBytes } from '@/lib/utils/storage';
import {
    Server, TrendingUp, ArrowLeft, ExternalLink, Copy, Check,
    Award, HardDrive, Users, Zap, Activity, MapPin, Clock, ShieldCheck, ChevronDown, CalendarDays, ShoppingCart
} from 'lucide-react';
import MetricChart from '@/components/charts/MetricChart';
import { formatRelativeTime } from '@/lib/utils/time';

import dynamic from 'next/dynamic';

const ManagerMap = dynamic(() => import('@/components/ManagerMap'), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#0a0a0a] animate-pulse flex items-center justify-center text-white/20">Loading Map...</div>
});

const ActivityLogList = dynamic(() => import('@/components/ActivityLogList'), { ssr: false });


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
    purchasedNodes?: number;
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
    createdAt?: string; // When manager first joined (ISO date string)
}

interface RewardHistoryItem {
    unlockDate: string;
    amount: number;
}

interface ManagerResponse {
    success: boolean;
    manager: ManagerDetails;
    nodes: PNode[];
    rewards?: { history: RewardHistoryItem[] };
    associatedWallets?: string[];
    error?: string;
}

interface HistoryPoint {
    timestamp: number;
    cpuPercent?: number;
    ramPercent?: number;
    packetsReceived?: number;
    packetsSent?: number;
    credits?: number;
    status?: string;
    [key: string]: any;
}

function ManagerDetailsContent({ params }: { params: { wallet: string } }) {
    const { wallet } = params;
    const { nodes: allNodes, loading: nodesLoading, lastUpdate, refreshNodes, selectedNetwork } = useNodes();

    // State
    const [manager, setManager] = useState<ManagerDetails | null>(null);
    const [nodes, setNodes] = useState<PNode[]>([]);
    const [rewards, setRewards] = useState<{ history: RewardHistoryItem[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'nodes' | 'rewards' | 'activity'>('nodes');
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [sortBy, setSortBy] = useState<string>('credits');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [activeNodeIndex, setActiveNodeIndex] = useState(0);
    const [selectedMetric, setSelectedMetric] = useState<'credits' | 'resources' | 'packets'>('credits');
    const [showMetricDropdown, setShowMetricDropdown] = useState(false);
    const [historyData, setHistoryData] = useState<Record<string, HistoryPoint[]>>({});
    const [historyLoading, setHistoryLoading] = useState(false);
    const isFetchingRef = useRef(false);

    // XAND price from Jupiter
    const { formatUsd } = useXandPrice();

    // Fetch historical data for top nodes
    useEffect(() => {
        const fetchHistory = async () => {
            if (nodes.length === 0) return;

            // Only fetch if we haven't already (or simple cache check)
            if (Object.keys(historyData).length > 0) return;
            if (isFetchingRef.current) return;

            isFetchingRef.current = true;
            setHistoryLoading(true);
            try {
                // Take top 50 active nodes to avoid URL limits and useless data
                const activeNodes = nodes.filter(n => n.status === 'online' || n.status === 'syncing');
                const topNodes = activeNodes.slice(0, 50);

                if (topNodes.length === 0) {
                    setHistoryLoading(false);
                    return;
                }

                const nodeIds = topNodes.map(n => n.id).join(',');
                // 24h history
                const endTime = Date.now();
                const startTime = endTime - (24 * 60 * 60 * 1000);

                const res = await fetch(`/api/history/bulk?nodeIds=${nodeIds}&startTime=${startTime}&endTime=${endTime}`);
                const data = await res.json();

                // Only update if we got valid data back
                if (data.data && Object.keys(data.data).length > 0) {
                    setHistoryData(data.data);
                } else if (data.data && Object.keys(historyData).length === 0) {
                    // Start with empty data only if we have nothing
                    setHistoryData(data.data);
                }
            } catch (err) {
                console.error("Failed to fetch fleet history", err);
            } finally {
                setHistoryLoading(false);
                isFetchingRef.current = false;
            }
        };

        if (nodes.length > 0) {
            fetchHistory();
        }
    }, [nodes]);

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

    const allowedPubkeys = useMemo(() => nodes.map(n => n.pubkey || n.id).filter(Boolean), [nodes]);

    // Immediate hydration from NodesContext
    useEffect(() => {
        if (!allNodes.length) return;

        const filtered = allNodes.filter(n =>
            n.managerWallet === wallet || n.registrarWallet === wallet
        );

        if (filtered.length > 0) {
            const pnodes: PNode[] = filtered.map(n => ({
                ...n,
                id: n.pubkey || n.publicKey || '',
                role: n.managerWallet === wallet ? 'buyer' : 'registrar',
            }));

            // Group duplicate IPs/Pubkeys
            const groupedNodes = mergeDuplicateIPNodes(pnodes);
            setNodes(groupedNodes);

            // Initial stats from context
            const totalCredits = pnodes.reduce((sum, n) => sum + (n.credits || 0), 0);
            const totalCapacity = pnodes.reduce((sum, n) => sum + (n.storageCapacity || 0), 0);
            const totalUsed = pnodes.reduce((sum, n) => sum + (n.storageUsed || 0), 0);
            const onlineCount = pnodes.filter(n => n.status === 'online').length;

            setManager(prev => {
                const daoStake = Math.max(...pnodes.map(n => n.daoStake || n.xandStake || 0), 0);
                const vestingStake = Math.max(...pnodes.map(n => n.vestingStake || 0), 0);

                // Calculate oldest createdAt from all nodes
                const oldestCreatedAt = pnodes.reduce((min: string | undefined, n: any) => {
                    if (!n.createdAt) return min;
                    if (!min) return n.createdAt;
                    return new Date(n.createdAt) < new Date(min) ? n.createdAt : min;
                }, prev?.createdAt || undefined);

                return {
                    wallet,
                    nodeCount: pnodes.length,
                    onlineCount,
                    syncingCount: pnodes.filter(n => n.status === 'syncing').length,
                    offlineCount: pnodes.filter(n => n.status === 'offline' || !n.status).length,
                    totalCredits,
                    totalStorageCapacity: totalCapacity,
                    totalStorageUsed: totalUsed,
                    avgUptime: pnodes.reduce((sum, n) => sum + (n.uptime || 0), 0) / pnodes.length || 0,
                    totalXandStake: daoStake,
                    daoStake: daoStake,
                    vestingStake: vestingStake,
                    createdAt: oldestCreatedAt, // Use the oldest createdAt
                    ...prev
                };
            });
            setLoading(false);
        }
    }, [allNodes, wallet, nodesLoading, selectedNetwork]);

    const fetchManagerDetails = async () => {
        try {
            // Don't set loading to true if we already have some data
            if (nodes.length === 0) setLoading(true);

            const url = new URL(`/api/managers/${wallet}`, window.location.origin);
            if (selectedNetwork && selectedNetwork !== 'all') {
                url.searchParams.set('network', selectedNetwork);
            }

            const res = await fetch(url.toString());
            const data: ManagerResponse = await res.json();

            if (data.success) {
                setManager(data.manager);
                if (data.nodes) {
                    setNodes(mergeDuplicateIPNodes(data.nodes));
                }
                if (data.rewards) {
                    setRewards(data.rewards);
                }
            } else if (nodes.length === 0) {
                setError(data.error || 'Failed to fetch manager details');
            }
        } catch (err) {
            if (nodes.length === 0) setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchManagerDetails();
    }, [wallet, selectedNetwork]);

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

                <main className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 w-full p-3 sm:p-6 overflow-y-auto">
                        <div className="max-w-7xl mx-auto">
                            {/* Back Link */}
                            <Link href="/managers" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-all duration-300 group">
                                <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
                                <span>Back to Managers</span>
                            </Link>

                            {/* Cover Section */}
                            <div className="relative mb-8">
                                <div className="relative rounded-xl overflow-hidden border border-border/40 bg-card">
                                    <div className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-transparent" />
                                    <div className="relative px-6 py-10">
                                        <div className="mb-6">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F0A741]/20 border border-[#F0A741]/30">
                                                    <div className="h-3 w-14 bg-[#F0A741]/30 rounded" />
                                                </span>
                                            </div>
                                            <div className="h-8 w-2/3 bg-muted/20 rounded mb-4" />
                                        </div>
                                        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-white/5">
                                            <div className="h-4 w-32 bg-muted/10 rounded" />
                                            <div className="h-4 w-24 bg-muted/10 rounded" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Row - 4 Columns */}
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <StatsCard title="Online pNodes" value={0} icon={<Activity className="w-4 h-4" />} color="green" loading={true} subValue=" " />
                                <StatsCard title="DAO Stake" value={0} icon={<Award className="w-4 h-4" />} color="orange" loading={true} subValue=" " />
                                <StatsCard title="Vesting Rewards" value={0} icon={<Zap className="w-4 h-4" />} color="blue" loading={true} subValue=" " />
                                <StatsCard title="Total Storage" value={0} icon={<HardDrive className="w-4 h-4" />} color="purple" loading={true} subValue=" " />
                            </div>

                            {/* Analytics Section - Chart & Map */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                                <div className="card">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="h-4 w-32 bg-muted/20 rounded" />
                                        <div className="h-6 w-20 bg-muted/10 rounded" />
                                    </div>
                                    <div className="bg-muted/10 rounded-lg p-3 w-full h-[250px]">
                                        <ChartSkeleton height={220} />
                                    </div>
                                </div>
                                <div className="card h-full relative overflow-hidden p-0 bg-transparent">
                                    <div className="h-full w-full bg-[#0a0a0a] min-h-[300px] flex items-center justify-center">
                                        <div className="h-8 w-8 bg-muted/20 rounded" />
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 sm:gap-2 mb-8 bg-black/40 p-1 rounded-xl border border-white/5 w-fit">
                                <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold bg-[#F0A741]">
                                    <div className="h-3 w-12 bg-black/30 rounded" />
                                </div>
                                <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold">
                                    <div className="h-3 w-12 bg-muted/20 rounded" />
                                </div>
                                <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold">
                                    <div className="h-3 w-8 bg-muted/20 rounded" />
                                </div>
                            </div>

                            {/* Table Skeleton */}
                            <div className="card overflow-hidden" style={{ padding: 0 }}>
                                <PNodeTableSkeleton rows={8} />
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
                <Header activePage="managers" lastUpdate={lastUpdate} loading={nodesLoading} onRefresh={refreshNodes} />
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
            <Header activePage="managers" lastUpdate={lastUpdate} loading={nodesLoading} onRefresh={refreshNodes} />

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 w-full p-3 sm:p-6 overflow-y-auto">
                    <div className="max-w-7xl mx-auto">
                        {/* Back Button */}
                        <Link href="/managers" className="inline-flex items-center gap-2 text-foreground/60 hover:text-foreground mb-6 transition-all duration-300 hover:translate-x-[-4px] group animate-slide-in-bottom">
                            <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
                            <span>Back to Managers</span>
                        </Link>

                        {/* Cover Section */}
                        <div className="relative mb-8 animate-fade-in" style={{ animationDelay: '0.05s', opacity: 0, animationFillMode: 'forwards' }}>
                            <div className="relative rounded-xl overflow-hidden border border-border/40 shadow-2xl bg-card">
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
                                        {manager.createdAt && <div className="flex items-center gap-2 hover:text-foreground transition-colors"><CalendarDays className="w-4 h-4 text-[#F0A741]" /> Joined {formatRelativeTime(new Date(manager.createdAt).getTime())}</div>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Row - 4 Columns */}
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
                            <StatsCard
                                title="Active Nodes / Licenses"
                                value={
                                    <div className="flex items-baseline gap-2">
                                        <span>{(manager.onlineCount || 0) + (manager.syncingCount || 0)}</span>
                                        <span className="text-sm text-foreground/40 font-normal">/</span>
                                        <span>{manager.purchasedNodes || 0}</span>
                                    </div>
                                }
                                subValue={`${uptimePercent}% Availability`}
                                icon={<Activity className="w-4 h-4" />}
                                color="green"
                            />

                            <StatsCard
                                title="DAO Stake"
                                value={<><span>{formatXandValue(manager.daoStake || 0)}</span><span className="text-xs ml-1 opacity-50 font-normal">XAND</span></>}
                                subValue={<><span>{formatUsd(manager.daoStake || 0)}</span> <span className="opacity-60 ml-1">in DAO Governance</span></>}
                                icon={<Award className="w-4 h-4" />}
                                color="orange"
                            />

                            <StatsCard
                                title="Vesting Rewards"
                                value={<><span>{formatXandValue(manager.vestingStake || 0)}</span><span className="text-xs ml-1 opacity-50 font-normal">XAND</span></>}
                                subValue={<><span>{formatUsd(manager.vestingStake || 0)}</span> <span className="opacity-60 ml-1">Cumulative rewards</span></>}
                                icon={<Zap className="w-4 h-4" />}
                                color="blue"
                            />

                            <StatsCard
                                title="Total Storage"
                                value={formatStorageBytes(manager.totalStorageCapacity)}
                                subValue={<><span>{formatStorageBytes(manager.totalStorageUsed)}</span> <span className="opacity-60 ml-1">currently used</span></>}
                                icon={<HardDrive className="w-4 h-4" />}
                                color="purple"
                            />
                        </div>

                        {/* Analytics Section - Chart & Map */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                            {/* Left: Chart */}
                            <div className="card">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-foreground">
                                            {selectedMetric === 'credits' && 'Credits Earning Rate'}
                                            {selectedMetric === 'resources' && 'Resource Utilization'}
                                            {selectedMetric === 'packets' && 'Packet Rate'}
                                        </h3>

                                        <div className="flex items-center gap-2">
                                            {/* Custom Dropdown */}
                                            <div className="relative">
                                                <button
                                                    onClick={() => setShowMetricDropdown(!showMetricDropdown)}
                                                    className="flex items-center gap-2 bg-transparent hover:bg-white/5 rounded-lg px-2 py-1 text-xs font-medium transition-all text-muted-foreground hover:text-foreground"
                                                >
                                                    <span>
                                                        {selectedMetric === 'credits' && 'Credits Rate'}
                                                        {selectedMetric === 'resources' && 'Resources'}
                                                        {selectedMetric === 'packets' && 'Packet Rate'}
                                                    </span>
                                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMetricDropdown ? 'rotate-180' : ''}`} />
                                                </button>

                                                {showMetricDropdown && (
                                                    <div className="absolute top-full right-0 mt-1 w-[140px] bg-[#0a0a0a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col py-1">
                                                        {[
                                                            { id: 'credits', label: 'Credits Rate' },
                                                            { id: 'resources', label: 'Resources' },
                                                            { id: 'packets', label: 'Packet Rate' }
                                                        ].map((opt) => (
                                                            <button
                                                                key={opt.id}
                                                                onClick={() => {
                                                                    setSelectedMetric(opt.id as any);
                                                                    setShowMetricDropdown(false);
                                                                }}
                                                                className={`text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors ${selectedMetric === opt.id ? 'text-[#F0A741] font-bold' : 'text-foreground/70'}`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/10 rounded-lg p-3 w-full h-[250px] relative">
                                        {(() => {
                                            // 1. Loading State
                                            if (historyLoading) {
                                                return (
                                                    <div className="h-full flex items-center justify-center text-foreground/40 animate-pulse gap-2">
                                                        <Activity className="w-5 h-5" />
                                                        <span>Loading fleet data...</span>
                                                    </div>
                                                );
                                            }



                                            // 3. Prepare Aggregated Data for Other Metrics
                                            if (!historyData || Object.keys(historyData).length === 0) {
                                                return (
                                                    <div className="h-full flex items-center justify-center text-foreground/20 italic flex-col gap-3">
                                                        <Activity className="w-8 h-8 opacity-20" />
                                                        <span>No historical data available</span>
                                                    </div>
                                                );
                                            }

                                            // Consolidate all timestamps
                                            const allTimestamps = new Set<number>();
                                            Object.values(historyData).forEach((nodeHistory: HistoryPoint[]) => {
                                                if (Array.isArray(nodeHistory)) {
                                                    nodeHistory.forEach((pt: HistoryPoint) => allTimestamps.add(pt.timestamp));
                                                }
                                            });
                                            const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

                                            if (sortedTimestamps.length === 0) {
                                                return (
                                                    <div className="h-full flex items-center justify-center text-foreground/20 italic flex-col gap-3">
                                                        <Activity className="w-8 h-8 opacity-20" />
                                                        <span>No historical data available</span>
                                                    </div>
                                                );
                                            }

                                            // Aggregate by timestamp
                                            const aggregatedData = sortedTimestamps.map(ts => {
                                                let cpuSum = 0;
                                                let ramSum = 0;
                                                let packetSum = 0;
                                                let creditSum = 0;
                                                let nodeCount = 0;
                                                let onlineNodes = 0;
                                                let cpuCount = 0;
                                                let ramCount = 0;

                                                Object.values(historyData).forEach((nodeHistory: HistoryPoint[]) => {
                                                    if (!Array.isArray(nodeHistory)) return;
                                                    // Find closest point within 5 minutes
                                                    const pt = nodeHistory.find((p: HistoryPoint) => Math.abs(p.timestamp - ts) < 5 * 60 * 1000);
                                                    if (pt) {
                                                        if (pt.cpuPercent !== undefined) { cpuSum += pt.cpuPercent; cpuCount++; }
                                                        if (pt.ramPercent !== undefined) { ramSum += pt.ramPercent; ramCount++; }
                                                        if (pt.packetsReceived !== undefined) packetSum += (pt.packetsReceived + (pt.packetsSent || 0));
                                                        if (pt.credits !== undefined) creditSum += pt.credits;

                                                        if (pt.status === 'online') onlineNodes++;
                                                        nodeCount++;
                                                    }
                                                });

                                                return {
                                                    timestamp: ts,
                                                    cpu: cpuCount > 0 ? cpuSum / cpuCount : 0,
                                                    ram: ramCount > 0 ? ramSum / ramCount : 0,
                                                    packets: packetSum,
                                                    credits: creditSum,
                                                    onlineNodes
                                                };
                                            });

                                            // Downsample if too many points for performance
                                            const finalData = aggregatedData.length > 100
                                                ? aggregatedData.filter((_, i) => i % Math.ceil(aggregatedData.length / 100) === 0)
                                                : aggregatedData;


                                            // 3. Credits Chart (Rate of Change)
                                            if (selectedMetric === 'credits') {
                                                // Calculate delta between points to show "Earnings"
                                                const rateData = finalData.map((d, i) => {
                                                    if (i === 0) return { ...d, value: 0 };
                                                    const prev = finalData[i - 1];
                                                    // Ensure positive delta (resets handle gracefully)
                                                    const delta = d.credits >= prev.credits ? d.credits - prev.credits : 0;
                                                    return { ...d, value: delta };
                                                }).slice(1); // Remove first point which has 0 delta

                                                const maxVal = Math.max(...rateData.map(d => d.value), 0);

                                                if (rateData.length === 0) {
                                                    return (
                                                        <div className="h-full flex items-center justify-center text-foreground/20 italic self-center">
                                                            Insufficient data for rate calculation
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <MetricChart
                                                        title=""
                                                        data={rateData}
                                                        height={250}
                                                        yDomain={[0, maxVal * 1.1]}
                                                        strokeColor="#F0A741"
                                                        yTickFormatter={(val) => formatXandValue(val)}
                                                        minimal={true}
                                                        tooltipFormatter={(d: any) => (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="text-xs text-muted-foreground">{new Date(d.timestamp).toLocaleTimeString()}</div>
                                                                <div className="font-bold text-[#F0A741]">{formatXandValue(d.value)} Credits</div>
                                                                <div className="text-[10px] text-white/50">Earned in interval</div>
                                                            </div>
                                                        )}
                                                        headerContent={
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#F0A741]/10 rounded text-[#F0A741] border border-[#F0A741]/20">
                                                                    <Zap className="w-3 h-3" />
                                                                    Peak: {formatXandValue(maxVal)} / period
                                                                </div>
                                                            </div>
                                                        }
                                                    />
                                                );
                                            }

                                            // 5. Resources Chart
                                            if (selectedMetric === 'resources') {
                                                return (
                                                    <MetricChart
                                                        title=""
                                                        data={finalData}
                                                        height={250}
                                                        yDomain={[0, 100]}
                                                        strokeColor="#F0A741"
                                                        yLabel="Usage (%)"
                                                        minimal={true}
                                                        multiLine={[
                                                            { key: 'cpu', color: '#F0A741', label: 'CPU' },
                                                            { key: 'ram', color: '#3F8277', label: 'RAM' },
                                                        ]}
                                                        tooltipFormatter={(d: any) => (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="text-xs text-muted-foreground">{new Date(d.timestamp).toLocaleString()}</div>
                                                                <div className="flex gap-4">
                                                                    <div className="font-bold text-[#F0A741]">CPU: {d.cpu.toFixed(1)}%</div>
                                                                    <div className="font-bold text-[#3F8277]">RAM: {d.ram.toFixed(1)}%</div>
                                                                </div>
                                                                <div className="text-[10px] text-white/50">Avg Fleet Usage</div>
                                                            </div>
                                                        )}
                                                        headerContent={
                                                            <div className="flex items-center gap-3 text-xs">
                                                                <div className="flex items-center gap-1">
                                                                    <div className="w-2 h-2 rounded-full bg-[#F0A741]" />
                                                                    CPU
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <div className="w-2 h-2 rounded-full bg-[#3F8277]" />
                                                                    RAM
                                                                </div>
                                                            </div>
                                                        }
                                                    />
                                                );
                                            }

                                            // 6. Dead Credits Chart
                                            if (false) {
                                                const maxCredits = Math.max(...finalData.map(d => d.credits));
                                                return (
                                                    <MetricChart
                                                        title=""
                                                        data={finalData.map(d => ({ ...d, value: d.credits }))}
                                                        height={250}
                                                        yDomain={[0, maxCredits * 1.1]}
                                                        strokeColor="#F0A741"
                                                        yTickFormatter={(val) => formatXandValue(val)}
                                                        minimal={true}
                                                        tooltipFormatter={(d: any) => (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="text-xs text-muted-foreground">{new Date(d.timestamp).toLocaleString()}</div>
                                                                <div className="font-bold text-[#F0A741]">{formatXandValue(d.value)} Credits</div>
                                                            </div>
                                                        )}
                                                    />
                                                );
                                            }

                                            // 5. Packet Rate Chart
                                            if (selectedMetric === 'packets') {
                                                const maxPackets = Math.max(...finalData.map(d => d.packets), 0);
                                                return (
                                                    <MetricChart
                                                        title=""
                                                        data={finalData.map(d => ({ ...d, value: d.packets }))}
                                                        height={250}
                                                        yDomain={[0, maxPackets * 1.1]}
                                                        strokeColor="#3F8277"
                                                        yLabel="Packets/s"
                                                        minimal={true}
                                                        tooltipFormatter={(d: any) => (
                                                            <div className="flex flex-col gap-1">
                                                                <div className="text-xs text-muted-foreground">{new Date(d.timestamp).toLocaleString()}</div>
                                                                <div className="font-bold text-[#3F8277]">{formatXandValue(d.value)} pkts/s</div>
                                                                <div className="text-[10px] text-white/50">Total Fleet Traffic</div>
                                                            </div>
                                                        )}
                                                        headerContent={
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#3F8277]/10 rounded text-[#3F8277] border border-[#3F8277]/20">
                                                                    <Activity className="w-3 h-3" />
                                                                    Peak: {formatXandValue(maxPackets)}
                                                                </div>
                                                            </div>
                                                        }
                                                    />
                                                );
                                            }

                                            return null;
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Interactive Map */}
                            <div className="card h-full relative group overflow-hidden p-0 bg-transparent">
                                <div className="h-full w-full bg-[#0a0a0a] absolute inset-0">
                                    <ManagerMap
                                        nodes={nodes}
                                        selectedNode={nodes[activeNodeIndex]}
                                        onNodeSelect={(n: PNode) => {
                                            const idx = nodes.findIndex(node => node.id === n.id);
                                            if (idx !== -1) setActiveNodeIndex(idx);
                                        }}
                                    />
                                </div>

                                {/* Navigation Controls */}
                                <div className="absolute bottom-4 right-4 z-[400] flex gap-2">
                                    <button
                                        onClick={() => nodes.length > 0 && setActiveNodeIndex(prev => (prev - 1 + nodes.length) % nodes.length)}
                                        disabled={nodes.length === 0}
                                        className={`bg-black/80 p-2 rounded-full backdrop-blur border border-white/10 transition-all shadow-xl ${nodes.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F0A741] hover:text-black text-white active:scale-95'}`}
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                    <div className="bg-black/80 backdrop-blur border border-white/10 px-3 flex items-center justify-center min-w-[50px] rounded-full text-[10px] font-mono font-bold">
                                        {nodes.length > 0 ? activeNodeIndex + 1 : 0} / {nodes.length || 0}
                                    </div>
                                    <button
                                        onClick={() => nodes.length > 0 && setActiveNodeIndex(prev => (prev + 1) % nodes.length)}
                                        disabled={nodes.length === 0}
                                        className={`bg-black/80 p-2 rounded-full backdrop-blur border border-white/10 transition-all shadow-xl rotate-180 transform ${nodes.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F0A741] hover:text-black text-white active:scale-95'}`}
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-1 sm:gap-2 mb-8 bg-black/40 backdrop-blur-md p-1 rounded-xl border border-white/5 w-fit max-w-full overflow-x-auto no-scrollbar animate-slide-in-bottom" style={{ animationDelay: '0.15s', opacity: 0, animationFillMode: 'forwards' }}>
                            <button
                                onClick={() => setActiveTab('nodes')}
                                className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 shrink-0 ${activeTab === 'nodes' ? 'bg-[#F0A741] text-black shadow-[0_4px_12px_rgba(240,167,65,0.3)]' : 'text-foreground/50 hover:text-foreground'}`}
                            >
                                <Server className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === 'nodes' ? 'opacity-100' : 'opacity-50'}`} />
                                pNodes ({nodes.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('rewards')}
                                className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 shrink-0 ${activeTab === 'rewards' ? 'bg-[#F0A741] text-black shadow-[0_4px_12px_rgba(240,167,65,0.3)]' : 'text-foreground/50 hover:text-foreground'}`}
                            >
                                <Zap className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === 'rewards' ? 'opacity-100' : 'opacity-50'}`} />
                                <span className="hidden xs:inline">Rewards & Vesting</span>
                                <span className="xs:hidden">Rewards</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('activity')}
                                className={`flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 shrink-0 ${activeTab === 'activity' ? 'bg-[#F0A741] text-black shadow-[0_4px_12px_rgba(240,167,65,0.3)]' : 'text-foreground/50 hover:text-foreground'}`}
                            >
                                <Activity className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === 'activity' ? 'opacity-100' : 'opacity-50'}`} />
                                <span className="hidden xs:inline">Live Feed</span>
                                <span className="xs:hidden">Feed</span>
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-both" style={{ animationDelay: '0.2s' }}>
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
                            ) : activeTab === 'rewards' ? (
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
                                                <div className="flex gap-2 sm:gap-4 shrink-0">
                                                    <div className="bg-black/60 border border-white/5 rounded-xl px-3 sm:px-5 py-2 sm:py-3 flex flex-col items-end shadow-inner">
                                                        <span className="text-[9px] sm:text-[10px] text-foreground/30 font-black uppercase tracking-widest mb-0.5 sm:mb-1">Locked/Vesting</span>
                                                        <div className="flex items-baseline gap-1 sm:gap-2">
                                                            <span className="text-xl sm:text-2xl font-black text-[#F0A741]">{formatXandValue(manager.vestingStake || 0)}</span>
                                                            <span className="text-[9px] sm:text-[10px] text-foreground/40 font-bold">XAND</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead>
                                                        <tr className="bg-black/40 text-foreground/30 uppercase text-[9px] sm:text-[10px] font-black tracking-[0.1em] sm:tracking-[0.2em] border-b border-white/5">
                                                            <th className="px-4 sm:px-8 py-4 sm:py-5">Date & Time</th>
                                                            <th className="px-4 sm:px-8 py-4 sm:py-5">Amount</th>
                                                            <th className="px-4 sm:px-8 py-4 sm:py-5 text-right">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {rewards.history.map((tranche: any, idx: number) => {
                                                            const isUnlocked = new Date(tranche.unlockDate) < new Date();
                                                            const hasProposal = !!tranche.proposalId;
                                                            const proposalUrl = hasProposal ? `https://dao.xandeum.network/dao/XAND/proposal/${tranche.proposalId}` : null;

                                                            return (
                                                                <tr
                                                                    key={idx}
                                                                    onClick={() => proposalUrl && window.open(proposalUrl, '_blank')}
                                                                    className={`transition-all duration-300 group ${hasProposal ? 'cursor-pointer hover:bg-white/[0.05]' : 'hover:bg-white/[0.03]'}`}
                                                                >
                                                                    <td className="px-4 sm:px-8 py-4 sm:py-6">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-foreground font-bold tracking-tight text-sm sm:text-lg flex items-center gap-1.5 sm:gap-2">
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
                                                                                {hasProposal && (
                                                                                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
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
                                                                    <td className="px-4 sm:px-8 py-4 sm:py-6">
                                                                        <div className="flex items-center gap-2.5">
                                                                            <div className={`p-1.5 rounded-md ${isUnlocked ? 'bg-green-500/10' : 'bg-white/5'}`}>
                                                                                <Zap className={`w-3.5 h-3.5 ${isUnlocked ? 'text-green-400' : 'text-foreground/20'}`} />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-base sm:text-xl font-black text-foreground tabular-nums">
                                                                                    {formatXandValue(tranche.amount)}
                                                                                    <span className="text-[10px] ml-1 opacity-50 font-normal">XAND</span>
                                                                                </span>
                                                                                <span className="text-[9px] sm:text-[10px] text-foreground/40 font-bold">{formatUsd(tranche.amount)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 sm:px-8 py-4 sm:py-6 text-right">
                                                                        <div className="inline-flex flex-col items-end gap-2">
                                                                            <span className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-inset ${tranche.status === 'Claimed' ? 'bg-green-500/20 text-green-300 ring-green-500/30' :
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
                            ) : activeTab === 'activity' ? (
                                <div className="h-[600px] overflow-hidden">
                                    <ActivityLogList
                                        allowedPubkeys={allowedPubkeys}
                                        limit={50}
                                        showFilters={true}
                                    />
                                </div>
                            ) : null}
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
