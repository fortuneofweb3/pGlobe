'use client';

import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { ActivityLog } from '@/lib/server/mongodb-activity';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Zap, CheckCircle2, XCircle, RefreshCw, MapPin, Globe, Filter, ChevronDown, Pause, Play } from 'lucide-react';
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
    { value: 'node_status', label: 'Status Updates' },
    { value: 'credits_earned', label: 'Credits' },
    { value: 'packets_earned', label: 'Packets' },
    { value: 'streams_active', label: 'Streams' },
];

const RENDER_API_URL = process.env.NEXT_PUBLIC_RENDER_API_URL || 'https://pglobe.onrender.com';
const REALTIME_SERVER_URL = process.env.NEXT_PUBLIC_REALTIME_SERVER_URL || '';

// Use realtime server if configured, otherwise fall back to API server
const getSocketUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Check if local realtime server is running on port 3002
            return `http://${hostname}:3002`;
        }
    }
    // Use dedicated realtime server if configured
    return REALTIME_SERVER_URL || RENDER_API_URL;
};

export default function ActivityLogList({ pubkey, countryCode, limit = 50 }: ActivityLogListProps) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [connected, setConnected] = useState(false);
    const [typeFilter, setTypeFilter] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(isPaused);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);

    const fetchLogs = async (skip: number = 0, append: boolean = false) => {
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }

        try {
            const query = new URLSearchParams();
            if (pubkey) query.set('pubkey', pubkey);
            if (countryCode) query.set('countryCode', countryCode);
            if (typeFilter) query.set('type', typeFilter);
            query.set('limit', limit.toString());
            query.set('skip', skip.toString());

            const response = await fetch(`/api/activity-logs?${query.toString()}`);
            const data = await response.json();

            if (data.logs) {
                if (append) {
                    setLogs(prev => [...prev, ...data.logs]);
                } else {
                    setLogs(data.logs);
                }
                setHasMore(data.logs.length === limit);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Buffer for staggered display - makes logs appear gradually instead of all at once
    const bufferRef = React.useRef<ActivityLog[]>([]);
    const processingRef = React.useRef(false);
    const isVisibleRef = React.useRef(true);

    // Handle page visibility changes to prevent lag
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab is hidden - CLEAR EVERYTHING to prevent lag
                isVisibleRef.current = false;
                bufferRef.current = [];
                processingRef.current = false;
                setLogs([]); // Clear all logs
            } else {
                // Tab is visible again
                isVisibleRef.current = true;
                bufferRef.current = [];
                processingRef.current = false;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Keep ref in sync with state
    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);



    const processBuffer = React.useCallback(() => {
        // Don't process if tab is hidden or paused
        if (!isVisibleRef.current || isPausedRef.current) {
            bufferRef.current = []; // Clear accumulated events
            return;
        }
        if (processingRef.current || bufferRef.current.length === 0) return;
        processingRef.current = true;

        const processOne = () => {
            // Stop if tab became hidden or no more items
            if (!isVisibleRef.current || bufferRef.current.length === 0) {
                processingRef.current = false;
                bufferRef.current = []; // Clear any remaining
                return;
            }

            // Dynamic Buffer Logic:
            // Goal: Process ~70% of buffer in 5 seconds to keep up.
            // Formula: TimePerItem = 5000 / (Buffer * 0.7)
            const logToAdd = bufferRef.current.shift()!;

            setLogs((prev: ActivityLog[]) => {
                // Check for duplicates
                const isDuplicate = prev.some((l: ActivityLog) => {
                    const timeDiff = Math.abs(new Date(l.timestamp).getTime() - new Date(logToAdd.timestamp).getTime());
                    return l.pubkey === logToAdd.pubkey && l.type === logToAdd.type && l.message === logToAdd.message && timeDiff < 5000;
                });

                if (isDuplicate) return prev;
                // Hard cap at 20 logs - old ones removed as new come in
                return [logToAdd, ...prev].slice(0, 20);
            });

            // Calculate delay based on buffer size with randomization
            // Base delay = 3500ms total window / (70% of buffer)
            const bufferSize = Math.max(bufferRef.current.length + 1, 1);
            const baseDelay = 3500 / (bufferSize * 0.7);

            // Add randomness (0.6x to 1.4x)
            const jitter = 0.6 + Math.random() * 0.8;
            let delay = baseDelay * jitter;

            // Clamp: Never slower than 1s, never faster than 20ms
            delay = Math.min(1000, Math.max(20, delay));

            setTimeout(processOne, delay);
        };

        processOne();
    }, [limit]);

    useEffect(() => {
        // 1. Fetch initial logs (history)
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
            console.log('[ActivityLogs] Connected - clearing buffer for fresh start');
            setConnected(true);
            // Clear buffer on (re)connect to prevent stale events
            bufferRef.current = [];
            processingRef.current = false;
        });

        socket.on('connect_error', () => {
            setConnected(false);
        });

        socket.on('disconnect', () => {
            console.log('[ActivityLogs] Disconnected - clearing buffer');
            setConnected(false);
            // Clear buffer on disconnect
            bufferRef.current = [];
            processingRef.current = false;
        });

        socket.on('activity', (newLog: ActivityLog) => {
            // Skip streams_active events - they're only for racing visualization
            if (newLog.type === 'streams_active') return;

            // Filter by pubkey/country if specified
            if (pubkey && newLog.pubkey !== pubkey) return;
            if (countryCode && newLog.countryCode !== countryCode) return;
            if (typeFilter && newLog.type !== typeFilter) return;

            // Add unique ID if not present
            const logWithId = {
                ...newLog,
                _id: newLog._id || `${newLog.pubkey}-${newLog.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: newLog.timestamp || new Date().toISOString(),
            };

            // Add to buffer for staggered display
            bufferRef.current.push(logWithId);
            processBuffer();
        });

        return () => {
            socket.disconnect();
            bufferRef.current = []; // Clear buffer on unmount
        };
    }, [pubkey, countryCode, limit, typeFilter, processBuffer]);

    // Clear buffer immediately when pausing
    useEffect(() => {
        if (isPaused) {
            bufferRef.current = [];
            processingRef.current = false;
        }
    }, [isPaused]);

    const getIcon = (type: string) => {
        const iconClass = "w-3.5 h-3.5";
        switch (type) {
            case 'new_node': return <CheckCircle2 className={`${iconClass} text-green-400`} />;
            case 'node_online': return <CheckCircle2 className={`${iconClass} text-green-400`} />;
            case 'node_offline': return <XCircle className={`${iconClass} text-red-400`} />;
            case 'node_status': return <Activity className={`${iconClass} text-blue-400`} />;
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
                        <div className={`w-1.5 h-1.5 rounded-full ${connected && !isPaused ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse' : isPaused ? 'bg-yellow-500' : 'bg-muted-foreground/30'}`} />
                        <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-tight">{isPaused ? 'Paused' : connected ? 'Live' : 'Offline'}</span>
                    </div>
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`p-1.5 rounded-lg border transition-all ${isPaused ? 'bg-[#F0A741]/20 border-[#F0A741]/50 text-[#F0A741]' : 'bg-muted/20 border-border/40 text-foreground/50 hover:text-foreground hover:bg-muted/30'}`}
                        title={isPaused ? 'Resume' : 'Pause'}
                    >
                        {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                    </button>
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

                        {/* Infinite scroll sentinel - only when paused */}
                        {isPaused && hasMore && logs.length > 0 && (
                            <div
                                ref={(el) => {
                                    if (!el) return;
                                    const observer = new IntersectionObserver(
                                        (entries) => {
                                            if (entries[0].isIntersecting && !loadingMore && hasMore && isPaused) {
                                                fetchLogs(logs.length, true);
                                            }
                                        },
                                        { threshold: 0.1 }
                                    );
                                    observer.observe(el);
                                    return () => observer.disconnect();
                                }}
                                className="w-full py-4 flex items-center justify-center"
                            >
                                {loadingMore ? (
                                    <div className="flex items-center gap-2 text-foreground/40 text-xs">
                                        <div className="w-4 h-4 border-2 border-[#F0A741]/30 border-t-[#F0A741] rounded-full animate-spin" />
                                        Loading more...
                                    </div>
                                ) : (
                                    <div className="text-foreground/20 text-xs">Scroll for more</div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
}
