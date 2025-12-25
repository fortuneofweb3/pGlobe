'use client';

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { ActivityLog } from '@/lib/server/mongodb-activity';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Zap, CheckCircle2, XCircle, RefreshCw, MapPin, PlusCircle, HardDrive, Layers, Filter, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

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

const RENDER_API_URL = process.env.NEXT_PUBLIC_RENDER_API_URL || 'https://pglobe.onrender.com';

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
        const socket = io(RENDER_API_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            timeout: 10000,
        });

        socket.on('connect', () => {
            setConnected(true);
            console.log('[Socket] Connected successfully');
        });

        socket.on('connect_error', (err: Error) => {
            console.warn('[Socket] Connection error:', err.message);
            setConnected(false);
        });

        socket.on('disconnect', () => {
            setConnected(false);
        });

        socket.on('activity', (newLog: ActivityLog) => {
            // Filter logic for real-time events
            if (pubkey && newLog.pubkey !== pubkey) return;
            if (countryCode && newLog.countryCode !== countryCode) return;
            if (typeFilter && newLog.type !== typeFilter) return;

            setLogs((prev: ActivityLog[]) => {
                // Prevent duplicates if re-fetched recently
                if (prev.some((l: ActivityLog) => l._id === newLog._id || (l.timestamp === newLog.timestamp && l.pubkey === newLog.pubkey && l.type === newLog.type))) return prev;
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
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        {pubkey ? 'Node Activity' : countryCode ? `Activity in ${countryCode}` : 'Live Network Feed'}
                    </h3>
                    <div className="flex items-center gap-2 bg-zinc-900/80 px-2 py-1 rounded-full border border-zinc-800">
                        <div className={clsx("w-1.5 h-1.5 rounded-full", connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" : "bg-zinc-600")} />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">{connected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>

                {showFilters && (
                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="pl-9 pr-8 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 appearance-none cursor-pointer transition-all hover:bg-zinc-800/50"
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

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-md min-h-[300px] flex flex-col shadow-2xl relative">
                {/* Subtle glow effect */}
                <div className="absolute inset-0 bg-blue-500/5 pointer-events-none" />

                {loading && logs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-12">
                        <div className="relative">
                            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 opacity-20" />
                            <RefreshCw className="w-8 h-8 animate-spin text-blue-400 absolute inset-0 blur-sm" />
                        </div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <Activity className="w-12 h-12 text-zinc-800 mb-4 animate-pulse" />
                        <p className="text-zinc-500 text-sm font-medium">No system activity detected.</p>
                        <p className="text-zinc-600 text-xs mt-1">Waiting for incoming events...</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800/30 overflow-y-auto max-h-[600px] scrollbar-hide">
                        <AnimatePresence initial={false} mode="popLayout">
                            {logs.map((log) => (
                                <motion.div
                                    key={log._id || `${log.timestamp}-${log.pubkey}-${log.type}`}
                                    initial={{ opacity: 0, x: -20, height: 0 }}
                                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                                    exit={{ opacity: 0, x: 20, height: 0 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 300,
                                        damping: 30,
                                        opacity: { duration: 0.2 }
                                    }}
                                    className="p-4 hover:bg-white/[0.03] transition-colors group relative overflow-hidden"
                                >
                                    {/* Scanline effect for new items */}
                                    {Date.now() - new Date(log.timestamp).getTime() < 5000 && (
                                        <div className="absolute inset-x-0 top-0 h-[1px] bg-blue-500/50 blur-[1px] animate-[scanline_2s_ease-out_infinite]" />
                                    )}

                                    <div className="flex items-start gap-4">
                                        <div className="mt-0.5 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 group-hover:border-zinc-600 transition-all shadow-inner">
                                            {getIcon(log.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4">
                                                <p className="text-sm text-zinc-100 font-semibold leading-relaxed tracking-tight">
                                                    {log.message}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-zinc-500 whitespace-nowrap font-bold uppercase tracking-widest bg-zinc-800 px-1.5 py-0.5 rounded">
                                                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                                                <div className="flex items-center gap-1.5 min-w-0 bg-black/20 px-2 py-0.5 rounded border border-zinc-800/50">
                                                    <Globe className="w-3 h-3 text-zinc-500" />
                                                    <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[180px] hover:text-blue-400 cursor-pointer transition-colors" title={log.address || log.pubkey}>
                                                        {log.address || log.pubkey}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-wider italic">
                                                    <MapPin className="w-3 h-3 text-zinc-600" />
                                                    <span>{log.location}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <style jsx global>{`
                @keyframes scanline {
                    0% { transform: translateY(0); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(80px); opacity: 0; }
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
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
