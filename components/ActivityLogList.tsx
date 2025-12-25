'use client';

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { ActivityLog } from '@/lib/server/mongodb-activity';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Zap, CheckCircle2, XCircle, RefreshCw, MapPin, PlusCircle, HardDrive, Layers, Filter } from 'lucide-react';
import { clsx } from 'clsx';

interface ActivityLogListProps {
    pubkey?: string;
    countryCode?: string;
    limit?: number;
    showFilters?: boolean;
}

const ACTIVITY_TYPES = [
    { value: '', label: 'All Activities' },
    { value: 'new_node', label: 'New Nodes' },
    { value: 'node_online', label: 'Nodes Online' },
    { value: 'node_offline', label: 'Nodes Offline' },
    { value: 'credits_earned', label: 'Credits Earned' },
    { value: 'packets_earned', label: 'Packets Earned' },
    { value: 'streams_active', label: 'Stream Changes' },
];

const RENDER_API_URL = process.env.NEXT_PUBLIC_RENDER_API_URL || 'http://localhost:3001';

export default function ActivityLogList({ pubkey, countryCode, limit = 50, showFilters = false }: ActivityLogListProps) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [typeFilter, setTypeFilter] = useState('');

    useEffect(() => {
        // 1. Fetch initial logs
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const query = new URLSearchParams();
                if (pubkey) query.set('pubkey', pubkey);
                if (countryCode) query.set('countryCode', countryCode);
                if (typeFilter) query.set('type', typeFilter);
                query.set('limit', limit.toString());

                const response = await fetch(`/api/activity-logs?${query.toString()}`);
                const data = await response.json();
                if (data.logs) {
                    setLogs(data.logs);
                }
            } catch (error) {
                console.error('Failed to fetch logs:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();

        // 2. Setup Socket.io for real-time updates
        const socket = io(RENDER_API_URL);

        socket.on('connect', () => {
            setConnected(true);
        });

        socket.on('disconnect', () => {
            setConnected(false);
        });

        socket.on('activity', (newLog: ActivityLog) => {
            // Filter logic for real-time events
            if (pubkey && newLog.pubkey !== pubkey) return;
            if (countryCode && newLog.countryCode !== countryCode) return;
            if (typeFilter && newLog.type !== typeFilter) return;

            setLogs((prev) => {
                // Prevent duplicates if re-fetched recently
                if (prev.some(l => l._id === newLog._id)) return prev;
                return [newLog, ...prev].slice(0, limit);
            });
        });

        return () => {
            socket.disconnect();
        };
    }, [pubkey, countryCode, limit, typeFilter]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'node_online': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'node_offline': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'credits_earned': return <Zap className="w-4 h-4 text-yellow-500" />;
            case 'node_syncing': return <RefreshCw className="w-4 h-4 text-blue-500" />;
            case 'new_node': return <PlusCircle className="w-4 h-4 text-purple-500" />;
            case 'packets_earned': return <HardDrive className="w-4 h-4 text-emerald-500" />;
            case 'streams_active': return <Layers className="w-4 h-4 text-cyan-500" />;
            default: return <Activity className="w-4 h-4 text-zinc-400" />;
        }
    };

    return (
        <div className="w-full space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                        {pubkey ? 'Node Activity' : countryCode ? `Activity in ${countryCode}` : 'Live Activity'}
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className={clsx("w-2 h-2 rounded-full", connected ? "bg-green-500 animate-pulse" : "bg-zinc-600")} />
                        <span className="text-[10px] text-zinc-500 uppercase tracking-tight">{connected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>

                {showFilters && (
                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="pl-9 pr-8 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 appearance-none cursor-pointer"
                            >
                                {ACTIVITY_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm min-h-[200px] flex flex-col">
                {loading && logs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-12">
                        <RefreshCw className="w-6 h-6 animate-spin text-zinc-700" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <Activity className="w-8 h-8 text-zinc-800 mb-3" />
                        <p className="text-zinc-500 text-sm">No activity logs found matching your criteria.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800/50">
                        {logs.map((log, idx) => (
                            <div key={log._id || idx} className="p-4 hover:bg-white/[0.02] transition-colors group">
                                <div className="flex items-start gap-4">
                                    <div className="mt-0.5 p-2 rounded-lg bg-zinc-800/50 group-hover:bg-zinc-800 transition-colors">
                                        {getIcon(log.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-4">
                                            <p className="text-sm text-zinc-200 font-medium leading-relaxed">
                                                {log.message}
                                            </p>
                                            <span className="text-[10px] text-zinc-500 whitespace-nowrap font-medium uppercase tracking-tighter">
                                                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1.5">
                                            {!pubkey && (
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className="w-1 h-1 rounded-full bg-zinc-700" />
                                                    <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[140px] hover:text-zinc-400 cursor-default">
                                                        {log.pubkey}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-medium">
                                                <MapPin className="w-3 h-3 text-zinc-600" />
                                                <span className="truncate">{log.location}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ChevronDown(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}
