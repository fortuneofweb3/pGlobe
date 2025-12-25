'use client';

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { ActivityLog } from '@/lib/server/mongodb-activity';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Zap, CheckCircle2, XCircle, RefreshCw, MapPin, Globe, Filter, ChevronDown } from 'lucide-react';
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
    { value: 'node_online', label: 'Online' },
    { value: 'node_offline', label: 'Offline' },
    { value: 'credits_earned', label: 'Credits' },
    { value: 'packets_earned', label: 'Packets' },
    { value: 'streams_active', label: 'Streams' },
];

const RENDER_API_URL = process.env.NEXT_PUBLIC_RENDER_API_URL || 'https://pglobe.onrender.com';

// Use local server if running on localhost
const getSocketUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://${hostname}:${window.location.port || 3000}`;
        }
    }
    return RENDER_API_URL;
};

export default function ActivityLogList({ pubkey, countryCode, limit = 50 }: ActivityLogListProps) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [typeFilter, setTypeFilter] = useState('');
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);

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
        const socketUrl = getSocketUrl();
        console.log('[ActivityLogs] Connecting to Socket.io at:', socketUrl);

        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
            timeout: 20000,
        });

        socket.on('connect', () => {
            setConnected(true);
        });

        socket.on('connect_error', () => {
            setConnected(false);
        });

        socket.on('disconnect', () => {
            setConnected(false);
        });

        socket.on('activity', (newLog: ActivityLog) => {
            if (pubkey && newLog.pubkey !== pubkey) return;
            if (countryCode && newLog.countryCode !== countryCode) return;
            if (typeFilter && newLog.type !== typeFilter) return;

            setLogs((prev: ActivityLog[]) => {
                if (prev.some((l: ActivityLog) => l._id === newLog._id || (l.timestamp === newLog.timestamp && l.pubkey === newLog.pubkey && l.type === newLog.type))) return prev;
                return [newLog, ...prev].slice(0, limit);
            });
        });

        return () => {
            socket.disconnect();
        };
    }, [pubkey, countryCode, limit, typeFilter]);

    const getIcon = (type: string) => {
        const iconClass = "w-3.5 h-3.5";
        switch (type) {
            case 'new_node': return <CheckCircle2 className={`${iconClass} text-green-400`} />;
            case 'node_online': return <CheckCircle2 className={`${iconClass} text-green-400`} />;
            case 'node_offline': return <XCircle className={`${iconClass} text-red-400`} />;
            case 'streams_active': return <Zap className={`${iconClass} text-cyan-400`} />;
            case 'packets_earned': return <Activity className={`${iconClass} text-emerald-400`} />;
            case 'credits_earned': return <Activity className={`${iconClass} text-[#F0A741]`} />;
            default: return <Activity className={`${iconClass} text-foreground/60`} />;
        }
    };

    const renderIntensityBar = (log: ActivityLog) => {
        if (log.type === 'packets_earned' && log.data?.rxEarned !== undefined) {
            const total = (log.data.rxEarned || 0) + (log.data.txEarned || 0);
            const width = Math.min(100, (total / 5000) * 100);
            return (
                <div className="mt-2 w-full max-w-[200px] h-1 bg-muted/20 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        className="h-full bg-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                    />
                </div>
            );
        }
        if (log.type === 'credits_earned' && log.data?.earned !== undefined) {
            const width = Math.min(100, (log.data.earned / 50) * 100);
            return (
                <div className="mt-2 w-full max-w-[200px] h-1 bg-muted/20 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        className="h-full bg-[#F0A741]/40 shadow-[0_0_8px_rgba(240,167,65,0.3)]"
                    />
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-full flex flex-col gap-4">
            <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[#F0A741]" />
                        Live Activity Feed
                    </h2>
                    <div className="flex items-center gap-2 bg-muted/20 px-2 py-0.5 rounded-full border border-border/40">
                        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse' : 'bg-muted-foreground/30'}`} />
                        <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-tight">{connected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>
                <div className="relative">
                    <button
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 hover:bg-muted/30 border border-border/40 rounded-lg transition-all text-xs font-semibold text-foreground/70 hover:text-foreground"
                    >
                        <Filter className="w-3.5 h-3.5" />
                        <span>{ACTIVITY_TYPES.find(t => t.value === typeFilter)?.label || 'All Activities'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showFilterDropdown && (
                        <div className="absolute top-full mt-2 right-0 z-50 bg-card border border-border/40 rounded-lg shadow-xl min-w-[160px] overflow-hidden">
                            {ACTIVITY_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    onClick={() => {
                                        setTypeFilter(type.value);
                                        setShowFilterDropdown(false);
                                    }}
                                    className={`w-full px-4 py-2 text-left text-xs transition-colors ${typeFilter === type.value
                                        ? 'bg-[#F0A741]/10 text-[#F0A741] font-bold'
                                        : 'hover:bg-muted/20 text-foreground/70 hover:text-foreground'
                                        }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="card p-6 space-y-3 flex-1 relative overflow-hidden flex flex-col">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#F0A741]/[0.02] via-transparent to-transparent pointer-events-none" />

                {loading && logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[450px] gap-4">
                        <RefreshCw className="w-12 h-12 text-foreground/10 animate-spin" />
                        <div className="text-center space-y-1">
                            <p className="text-foreground/40 text-sm font-semibold">Loading Activity</p>
                            <p className="text-foreground/20 text-xs">Fetching network events...</p>
                        </div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[450px] gap-4">
                        <Activity className="w-12 h-12 text-foreground/10" />
                        <div className="text-center space-y-1">
                            <p className="text-foreground/40 text-sm font-semibold">No Activity Yet</p>
                            <p className="text-foreground/20 text-xs">Waiting for network events...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 relative flex-1 overflow-y-auto">
                        <AnimatePresence mode="popLayout">
                            {logs.map((log, index) => (
                                <motion.div
                                    key={log._id || `${log.timestamp}-${log.pubkey}-${log.type}`}
                                    layout
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 35,
                                    }}
                                    className="p-4 bg-muted/5 hover:bg-white/[0.02] border border-border/20 rounded-lg transition-all group/item relative"
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className="mt-1 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80 group-hover/item:border-[#F0A741]/30 transition-all">
                                            {getIcon(log.type)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4 mb-2">
                                                <p className="text-sm text-zinc-200 font-semibold leading-relaxed">
                                                    {log.message}
                                                </p>
                                                <span className="text-[9px] text-zinc-500 whitespace-nowrap font-bold uppercase tracking-wider bg-zinc-900/50 px-2 py-0.5 rounded border border-zinc-800/50">
                                                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-zinc-800/80">
                                                    <Globe className="w-3 h-3 text-zinc-500" />
                                                    <span className="font-mono text-zinc-400 truncate max-w-[180px]">
                                                        {log.pubkey}
                                                    </span>
                                                </div>

                                                {log.location && (
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="w-3 h-3 text-zinc-600" />
                                                        <span className="text-zinc-500 font-semibold">{log.location}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {renderIntensityBar(log)}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <div className="text-[10px] text-foreground/30 text-center flex-shrink-0">
                Real-time network events • Updated via Socket.io
            </div>
        </div>
    );
}
