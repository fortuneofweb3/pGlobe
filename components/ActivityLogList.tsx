'use client';

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { ActivityLog } from '@/lib/server/mongodb-activity';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Zap, CheckCircle2, XCircle, RefreshCw, MapPin, PlusCircle, HardDrive, Layers, Filter, Globe, ChevronDown } from 'lucide-react';
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
        switch (type) {
            case 'node_online': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'node_offline': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'credits_earned': return <Zap className="w-4 h-4 text-[#F0A741]" />;
            case 'node_syncing': return <RefreshCw className="w-4 h-4 text-blue-500" />;
            case 'new_node': return <PlusCircle className="w-4 h-4 text-purple-500" />;
            case 'packets_earned': return <HardDrive className="w-4 h-4 text-emerald-500" />;
            case 'streams_active': return <Layers className="w-4 h-4 text-cyan-500" />;
            default: return <Activity className="w-4 h-4 text-foreground/40" />;
        }
    };

    return (
        <div className="w-full space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Activity className="w-4 h-4 text-foreground/40" />
                        {pubkey ? 'Recent Activity' : 'Live Timeline'}
                    </h2>
                    <div className="flex items-center gap-2 bg-muted/20 px-2 py-0.5 rounded-full border border-border/40">
                        <div className={clsx("w-1.5 h-1.5 rounded-full", connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse" : "bg-muted-foreground/30")} />
                        <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-tight">{connected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>

                {showFilters && (
                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                                <Filter className="w-3.5 h-3.5 text-foreground/40" />
                            </div>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="pl-8 pr-9 py-1.5 bg-muted/40 border border-border/40 rounded-lg text-xs font-semibold text-foreground/70 focus:outline-none focus:border-[#F0A741]/50 appearance-none cursor-pointer transition-all hover:bg-muted/60"
                            >
                                {ACTIVITY_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronDown className="w-3.5 h-3.5 text-foreground/30" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="card overflow-hidden min-h-[400px] flex flex-col p-0">
                {loading && logs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4">
                        <RefreshCw className="w-8 h-8 animate-spin text-[#F0A741] opacity-20" />
                        <p className="text-xs font-medium text-foreground/30 animate-pulse">Establishing data streams...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center gap-4">
                        <Activity className="w-12 h-12 text-foreground/10" />
                        <div className="space-y-1">
                            <p className="text-foreground/40 text-sm font-semibold">No Activity Detected</p>
                            <p className="text-foreground/20 text-xs">Waiting for events from the network...</p>
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-border/20 overflow-y-auto max-h-[700px] custom-scrollbar">
                        <AnimatePresence initial={false} mode="popLayout">
                            {logs.map((log) => (
                                <motion.div
                                    key={log._id || `${log.timestamp}-${log.pubkey}-${log.type}`}
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.2 }}
                                    className="p-4 sm:p-5 hover:bg-muted/5 transition-colors group relative"
                                >
                                    <div className="flex items-start gap-4 sm:gap-5">
                                        <div className="mt-1 p-2 rounded-lg bg-muted/20 border border-border/40 group-hover:border-border/60 transition-colors">
                                            {getIcon(log.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4 mb-2">
                                                <p className="text-sm font-semibold text-foreground/90 leading-relaxed">
                                                    {log.message}
                                                </p>
                                                <span className="text-[10px] text-foreground/40 whitespace-nowrap font-medium bg-muted/40 px-2 py-1 rounded border border-border/40">
                                                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                <div className="flex items-center gap-1.5 min-w-0 bg-muted/20 px-2 py-0.5 rounded border border-border/20 hover:border-border/60 transition-colors cursor-pointer" title={log.pubkey}>
                                                    <Globe className="w-3 h-3 text-foreground/30" />
                                                    <span className="text-[10px] font-mono font-medium text-foreground/50">
                                                        {log.pubkey.slice(0, 8)}...{log.pubkey.slice(-4)}
                                                    </span>
                                                </div>

                                                {log.location && (
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="w-3 h-3 text-foreground/20" />
                                                        <span className="text-[10px] text-foreground/40 font-semibold italic">{log.location}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
