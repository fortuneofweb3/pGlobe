'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Manager } from '@/lib/context/NodesContext';
import { PNode } from '@/lib/types/pnode';
import { startProgress } from '@/lib/nprogress';
import {
    ArrowUpDown, ArrowUp, ArrowDown,
    Copy, Check, ExternalLink, ChevronRight, Filter
} from 'lucide-react';
import XandeumIcon from './XandeumIcon';

type SortField = 'credits' | 'nodes' | 'uptime' | 'vestingRewards' | 'storage' | 'daoStake';
type SortDirection = 'asc' | 'desc';

// Format number with K, M abbreviation (2 decimal places)
function formatAbbreviated(value: number): string {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
        return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toLocaleString();
}

// Format storage bytes to B, KB, MB, GB, TB
function formatStorage(bytes: number): string {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = sizes[Math.min(i, sizes.length - 1)];
    const value = bytes / Math.pow(1024, Math.min(i, sizes.length - 1));
    return `${value.toFixed(2)} ${size}`;
}

interface LeaderboardProps {
    managers: Manager[];
    nodes: PNode[];
    copiedWallet: string | null;
    onCopyWallet: (wallet: string) => void;
}

export default function ManagerLeaderboard({ managers, nodes, copiedWallet, onCopyWallet }: LeaderboardProps) {
    const router = useRouter();
    const [sortField, setSortField] = useState<SortField>('credits');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [networkFilter, setNetworkFilter] = useState<'all' | 'mainnet' | 'devnet' | 'both'>('all');
    const [nodeCountFilter, setNodeCountFilter] = useState<'all' | '1-5' | '6-10' | '10+'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active'>('all');

    // Create a map of manager wallet -> total storage from their nodes
    const managerStorageMap = useMemo(() => {
        const map = new Map<string, number>();
        nodes.forEach(node => {
            const wallet = node.managerWallet || node.registrarWallet;
            if (wallet) {
                const current = map.get(wallet) || 0;
                map.set(wallet, current + (node.storageCapacity || node.sc || 0));
            }
        });
        return map;
    }, [nodes]);

    const getManagerStorage = (wallet: string) => managerStorageMap.get(wallet) || 0;

    const truncateWallet = (wallet: string) => `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

    const getNodeCount = (m: Manager) => Math.max(m.registeredNodes, m.purchasedNodes, m.knownNodes.length);

    const getUptime = (m: Manager) => {
        const total = m.knownNodes.length;
        if (total === 0) return 0;
        return Math.round((m.onlineCount / total) * 100);
    };

    const filteredAndSorted = useMemo(() => {
        let result = [...managers];

        // Apply filters
        if (networkFilter !== 'all') {
            result = result.filter(m => m.source === networkFilter);
        }

        if (statusFilter === 'active') {
            result = result.filter(m => m.onlineCount > 0);
        }

        if (nodeCountFilter !== 'all') {
            result = result.filter(m => {
                const count = getNodeCount(m);
                switch (nodeCountFilter) {
                    case '1-5': return count >= 1 && count <= 5;
                    case '6-10': return count >= 6 && count <= 10;
                    case '10+': return count > 10;
                    default: return true;
                }
            });
        }

        // Apply sorting
        result.sort((a, b) => {
            let aVal: number, bVal: number;
            switch (sortField) {
                case 'credits':
                    aVal = a.totalCredits || 0;
                    bVal = b.totalCredits || 0;
                    break;
                case 'nodes':
                    aVal = getNodeCount(a);
                    bVal = getNodeCount(b);
                    break;
                case 'uptime':
                    aVal = getUptime(a);
                    bVal = getUptime(b);
                    break;
                case 'vestingRewards':
                    aVal = a.vestingStake || 0;
                    bVal = b.vestingStake || 0;
                    break;
                case 'daoStake':
                    aVal = a.daoStake || 0;
                    bVal = b.daoStake || 0;
                    break;
                case 'storage':
                    aVal = getManagerStorage(a.wallet);
                    bVal = getManagerStorage(b.wallet);
                    break;
                default:
                    aVal = 0;
                    bVal = 0;
            }
            return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
        });

        return result;
    }, [managers, sortField, sortDirection, networkFilter, nodeCountFilter, statusFilter]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
        return sortDirection === 'desc' ?
            <ArrowDown className="w-3 h-3 text-[#F0A741]" /> :
            <ArrowUp className="w-3 h-3 text-[#F0A741]" />;
    };

    const getRankBadge = (rank: number) => {
        if (rank === 1) return (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-black font-bold text-sm shadow-lg shadow-yellow-500/30">
                🥇
            </div>
        );
        if (rank === 2) return (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 text-black font-bold text-sm shadow-lg shadow-gray-400/30">
                🥈
            </div>
        );
        if (rank === 3) return (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-white font-bold text-sm shadow-lg shadow-amber-600/30">
                🥉
            </div>
        );
        return (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground/60 font-mono text-sm">
                {rank}
            </div>
        );
    };

    // getSourceBadge removed

    const getUptimeColor = (uptime: number) => {
        if (uptime >= 90) return 'text-green-400';
        if (uptime >= 70) return 'text-yellow-400';
        if (uptime >= 50) return 'text-orange-400';
        return 'text-red-400';
    };

    return (
        <div className="space-y-4">
            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-card rounded-lg border border-white/10">
                <div className="flex items-center gap-2 text-foreground/60">
                    <Filter className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Filters:</span>
                </div>

                <select
                    value={networkFilter}
                    onChange={(e) => setNetworkFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-xs bg-muted border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20"
                >
                    <option value="all">All Networks</option>
                    <option value="mainnet">Mainnet Only</option>
                    <option value="devnet">Devnet Only</option>
                    <option value="both">Both Networks</option>
                </select>

                <select
                    value={nodeCountFilter}
                    onChange={(e) => setNodeCountFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-xs bg-muted border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20"
                >
                    <option value="all">Any Node Count</option>
                    <option value="1-5">1-5 Nodes</option>
                    <option value="6-10">6-10 Nodes</option>
                    <option value="10+">10+ Nodes</option>
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-xs bg-muted border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F0A741]/20"
                >
                    <option value="all">All Managers</option>
                    <option value="active">Active Only</option>
                </select>

                <div className="ml-auto text-xs text-foreground/50">
                    {filteredAndSorted.length} managers
                </div>
            </div>

            {/* Leaderboard Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-2 text-xs font-semibold text-foreground/60 uppercase tracking-wider w-16">
                                Rank
                            </th>
                            <th className="text-left py-3 px-2 text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                                Manager
                            </th>
                            <th
                                className="text-right py-3 px-2 text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleSort('credits')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    Credits
                                    <SortIcon field="credits" />
                                </div>
                            </th>
                            <th
                                className="text-right py-3 px-2 text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => handleSort('nodes')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    Nodes
                                    <SortIcon field="nodes" />
                                </div>
                            </th>
                            <th
                                className="text-right py-3 px-2 text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors hidden sm:table-cell"
                                onClick={() => handleSort('uptime')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    Uptime
                                    <SortIcon field="uptime" />
                                </div>
                            </th>
                            <th
                                className="text-right py-3 px-2 text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors hidden md:table-cell"
                                onClick={() => handleSort('vestingRewards')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    Vesting Rewards
                                    <SortIcon field="vestingRewards" />
                                </div>
                            </th>
                            <th
                                className="text-right py-3 px-2 text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors hidden xl:table-cell"
                                onClick={() => handleSort('daoStake')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    DAO Stake
                                    <SortIcon field="daoStake" />
                                </div>
                            </th>
                            <th
                                className="text-right py-3 px-2 text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors hidden lg:table-cell"
                                onClick={() => handleSort('storage')}
                            >
                                <div className="flex items-center justify-end gap-1">
                                    Storage
                                    <SortIcon field="storage" />
                                </div>
                            </th>
                            <th className="w-8"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSorted.map((manager, idx) => {
                            const rank = idx + 1;
                            const uptime = getUptime(manager);
                            const nodeCount = getNodeCount(manager);
                            const vestingRewards = manager.vestingStake || 0;
                            const storage = getManagerStorage(manager.wallet);

                            return (
                                <tr
                                    key={manager.wallet}
                                    className="border-b border-white/10 hover:bg-muted/30 cursor-pointer transition-colors group"
                                    onClick={() => {
                                        startProgress();
                                        router.push(`/managers/${manager.wallet}`);
                                    }}
                                >
                                    <td className="py-3 px-2">
                                        {getRankBadge(rank)}
                                    </td>
                                    <td className="py-3 px-2">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={`https://api.dicebear.com/7.x/identicon/svg?seed=${manager.wallet}&backgroundColor=1a1a2e`}
                                                alt="Avatar"
                                                className="w-8 h-8 rounded-full bg-muted border border-white/10"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm">{truncateWallet(manager.wallet)}</span>
                                                    {manager.onlineCount === 0 && (
                                                        <span className="text-[9px] font-bold px-1 py-0.5 bg-red-500/20 text-red-500 rounded">DEAD</span>
                                                    )}
                                                    {/* Source Badge Removed */}
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onCopyWallet(manager.wallet);
                                                        }}
                                                        className="p-0.5 hover:bg-muted rounded transition-colors"
                                                    >
                                                        {copiedWallet === manager.wallet ? (
                                                            <Check className="w-3 h-3 text-green-400" />
                                                        ) : (
                                                            <Copy className="w-3 h-3 text-foreground/40" />
                                                        )}
                                                    </button>
                                                    <a
                                                        href={`https://solscan.io/account/${manager.wallet}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-0.5 hover:bg-muted rounded transition-colors"
                                                    >
                                                        <ExternalLink className="w-3 h-3 text-foreground/40" />
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <span className="font-bold text-white">
                                            {(manager.totalCredits || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <span className="font-medium">{nodeCount}</span>
                                            <span className="text-foreground/40 text-xs">
                                                ({manager.onlineCount} online)
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 text-right hidden sm:table-cell">
                                        <span className={`font-medium ${getUptimeColor(uptime)}`}>
                                            {uptime}%
                                        </span>
                                    </td>
                                    <td className="py-3 px-2 text-right hidden md:table-cell">
                                        <div className="flex items-center justify-end gap-1.5 font-medium text-[#F0A741]">
                                            <XandeumIcon size={14} />
                                            {formatAbbreviated(vestingRewards)}
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 text-right hidden xl:table-cell">
                                        <div className="flex items-center justify-end gap-1.5 font-medium text-purple-400">
                                            <XandeumIcon size={14} />
                                            {formatAbbreviated(manager.daoStake || 0)}
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 text-right hidden lg:table-cell">
                                        <span className="font-medium text-blue-400">
                                            {formatStorage(storage)}
                                        </span>
                                    </td>
                                    <td className="py-3 px-2">
                                        <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-[#F0A741] transition-colors" />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {filteredAndSorted.length === 0 && (
                <div className="text-center py-12 text-foreground/60">
                    No managers match the current filters
                </div>
            )}
        </div>
    );
}
