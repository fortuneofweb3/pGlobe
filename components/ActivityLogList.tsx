// 'use client' directive for Next.js
'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import io from 'socket.io-client';
import { ActivityLog } from '@/lib/server/mongodb-activity';
import { formatDistanceToNow } from 'date-fns';
import {
    Activity,
    Zap,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Globe,
    Filter,
    ChevronDown,
    Pause,
    Play,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// -----------------------------------------------------------------------------
// Helper constants & utilities
// -----------------------------------------------------------------------------
const ACTIVITY_TYPES = [
    { value: '', label: 'All Activities' },
    { value: 'new_node', label: 'New Nodes' },
    { value: 'node_online', label: 'Online' },
    { value: 'node_offline', label: 'Offline' },
    { value: 'node_status', label: 'Status Updates' },
    { value: 'credits_earned', label: 'Credits Earned' },
    { value: 'credits_lost', label: 'Credits Lost' },
    { value: 'packets_earned', label: 'Packets' },
    { value: 'streams_active', label: 'Streams' },
];

const RENDER_API_URL = process.env.NEXT_PUBLIC_RENDER_API_URL || 'https://pglobe.onrender.com';
const REALTIME_SERVER_URL = process.env.NEXT_PUBLIC_REALTIME_SERVER_URL || '';

const getSocketUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://${hostname}:3002`;
        }
        if (REALTIME_SERVER_URL) {
            return REALTIME_SERVER_URL.startsWith('http') ? REALTIME_SERVER_URL : `https://${REALTIME_SERVER_URL}`;
        }
    }
    return RENDER_API_URL;
};

// Spring configs for framer‑motion
const smoothSpring = {
    type: 'spring' as const,
    stiffness: 120,
    damping: 20,
    mass: 0.8,
};

const barSpring = {
    type: 'spring' as const,
    stiffness: 150,
    damping: 20,
};

const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return '';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map((c) => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};

// -----------------------------------------------------------------------------
// LogItem – individual activity entry
// -----------------------------------------------------------------------------
function LogItem({ log }: { log: ActivityLog }) {
    const getIcon = (type: string) => {
        const base = 'w-3 h-3 sm:w-3.5 sm:h-3.5';
        switch (type) {
            case 'new_node':
            case 'node_online':
                return <CheckCircle2 className={`${base} text-green-400`} />;
            case 'node_offline':
                return <XCircle className={`${base} text-red-400`} />;
            case 'node_status':
                return <Activity className={`${base} text-blue-400`} />;
            case 'streams_active':
                return <Zap className={`${base} text-cyan-400`} />;
            case 'packets_earned':
                return <Activity className={`${base} text-emerald-400`} />;
            case 'credits_earned':
                return <Activity className={`${base} text-[#F0A741]`} />;
            case 'credits_lost':
                return <XCircle className={`${base} text-red-400`} />;
            default:
                return <Activity className={`${base} text-foreground/60`} />;
        }
    };

    const renderIntensityBar = () => {
        const data = log.data as any;
        let width = 0;
        let color = '';
        if (log.type === 'packets_earned' && data?.rxEarned !== undefined) {
            const total = (data.rxEarned || 0) + (data.txEarned || 0);
            width = Math.min(100, (total / 5000) * 100);
            color = 'bg-emerald-500/40';
        } else if (log.type === 'credits_earned' && data?.earned !== undefined) {
            width = Math.min(100, (data.earned / 50) * 100);
            color = 'bg-[#F0A741]/40';
        } else if (log.type === 'credits_lost' && data?.lost !== undefined) {
            width = Math.min(100, (data.lost / 50) * 100);
            color = 'bg-red-500/40';
        }
        if (!width) return null;
        return (
            <div className="mt-1.5 sm:mt-2 w-full max-w-[150px] sm:max-w-[200px] h-1 bg-muted/20 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={barSpring}
                    className={`h-full ${color}`}
                    style={{ willChange: 'width' }}
                />
            </div>
        );
    };

    const formatPubkey = (key?: string) => {
        if (!key) return 'Node';
        if (key.length <= 12) return key;
        return `${key.slice(0, 6)}...${key.slice(-4)}`;
    };

    const getFormattedMessage = () => {
        const data = log.data as any;
        const nodeId = log.address || formatPubkey(log.pubkey);
        if (log.type === 'packets_earned' && data) {
            const parts = [] as string[];
            if (data.rxEarned) parts.push(`received ${data.rxEarned.toLocaleString()}`);
            if (data.txEarned) parts.push(`sent ${data.txEarned.toLocaleString()}`);
            if (parts.length) return `${nodeId} ${parts.join(' / ')} packets`;
        }
        if (log.type === 'credits_lost' && data?.lost) {
            return `${nodeId} lost ${data.lost.toFixed(2)} credits`;
        }
        if (log.type === 'credits_earned' && data?.earned) {
            return `${nodeId} earned ${data.earned.toFixed(2)} credits`;
        }
        if (log.message && log.pubkey && log.message.includes(log.pubkey)) {
            return log.message.replace(log.pubkey, nodeId);
        }
        return log.message;
    };

    const truncatedPubkey = useMemo(() => formatPubkey(log.pubkey), [log.pubkey]);

    return (
        <Link href={`/nodes/${log.pubkey}`} className="block group">
            <motion.div
                layout="position"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                transition={smoothSpring}
                style={{ willChange: 'transform, opacity' }}
                className="p-2.5 sm:p-4 bg-muted/5 hover:bg-white/[0.04] border border-border/20 hover:border-[#F0A741]/30 rounded-lg transition-colors duration-150"
            >
                <div className="flex items-start gap-2 sm:gap-4">
                    {/* Icon */}
                    <div className="mt-0.5 p-1.5 sm:p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80 flex-shrink-0">
                        {getIcon(log.type)}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
                            <p className="text-xs sm:text-sm text-zinc-200 font-semibold leading-relaxed line-clamp-2">
                                {getFormattedMessage()}
                            </p>
                            <span className="text-[8px] sm:text-[9px] text-zinc-500 whitespace-nowrap font-bold uppercase tracking-wider bg-zinc-900/50 px-1.5 sm:px-2 py-0.5 rounded border border-zinc-800/50 flex-shrink-0">
                                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </span>
                        </div>
                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs">
                            <div className="flex items-center gap-1 bg-black/40 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-zinc-800/80" title={log.pubkey}>
                                <Globe className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-zinc-500" />
                                <span className="font-mono text-zinc-400 truncate">{truncatedPubkey}</span>
                            </div>
                            {(log.location || log.countryCode) && (
                                <div className="flex items-center gap-1 bg-black/40 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-zinc-800/80">
                                    <span className="text-sm sm:text-base leading-none">
                                        {log.countryCode ? getFlagEmoji(log.countryCode) : '📍'}
                                    </span>
                                    <span className="text-zinc-400 font-semibold truncate max-w-[120px] sm:max-w-none">
                                        {log.location || log.countryCode}
                                    </span>
                                </div>
                            )}
                        </div>
                        {renderIntensityBar()}
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}

// -----------------------------------------------------------------------------
// Main ActivityLogList component
// -----------------------------------------------------------------------------
interface ActivityLogListProps {
    pubkey?: string;
    countryCode?: string;
    limit?: number;
    showFilters?: boolean;
}

export default function ActivityLogList({ pubkey, countryCode, limit = 25 }: ActivityLogListProps) {
    // State
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [connected, setConnected] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);

    // Refs for internal buffers & control
    const bufferRef = useRef<ActivityLog[]>([]);
    const processingRef = useRef<boolean>(false);
    const isVisibleRef = useRef<boolean>(true);
    const isPausedRef = useRef<boolean>(false);
    const batchBoundariesRef = useRef<
        { remaining: number; total: number; type: 'startup-6s' | 'leftover-3s' | 'rhythmic' }[]
    >([]);
    const sprintModeRef = useRef<boolean>(false);
    const cycleRef = useRef<number>(0);

    // ---------------------------------------------------------------------------
    // Helper: fetch logs (initial load & pagination)
    // ---------------------------------------------------------------------------
    const fetchLogs = async (skip = 0, append = false) => {
        try {
            const url = `${RENDER_API_URL}/api/activity?limit=${limit}&skip=${skip}`;
            if (pubkey) url.concat(`&pubkey=${pubkey}`);
            if (countryCode) url.concat(`&countryCode=${countryCode}`);
            const res = await fetch(url);
            const data = await res.json();
            if (Array.isArray(data.logs)) {
                // Prepare buffer for orchestrated startup drip
                if (skip === 0) {
                    setLogs([]);
                    const count = data.logs.length;
                    const phase1 = Math.floor(count * 0.7);
                    const phase2 = count - phase1;
                    batchBoundariesRef.current = [
                        { remaining: phase1, total: phase1, type: 'startup-6s' },
                        { remaining: phase2, total: phase2, type: 'rhythmic' },
                    ];
                    data.logs.forEach((log: ActivityLog) => {
                        const enriched = {
                            ...log,
                            _id:
                                log._id ||
                                `${log.pubkey}-${log.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            timestamp: log.timestamp || new Date().toISOString(),
                        };
                        bufferRef.current.push(enriched);
                    });
                    if (data.logs.length) processBuffer();
                } else {
                    // Append mode – just push to buffer
                    data.logs.forEach((log: ActivityLog) => {
                        const enriched = {
                            ...log,
                            _id:
                                log._id ||
                                `${log.pubkey}-${log.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            timestamp: log.timestamp || new Date().toISOString(),
                        };
                        bufferRef.current.push(enriched);
                    });
                    if (data.logs.length) processBuffer();
                }
                setHasMore(data.logs.length === limit);
            }
        } catch (e) {
            console.error('Failed to fetch logs', e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // ---------------------------------------------------------------------------
    // Buffer processing – orchestrated animation
    // ---------------------------------------------------------------------------
    const processBuffer = React.useCallback(() => {
        if (!isVisibleRef.current || isPausedRef.current) {
            bufferRef.current = [];
            return;
        }
        if (processingRef.current || bufferRef.current.length === 0) return;
        processingRef.current = true;

        const processOne = () => {
            if (!isVisibleRef.current || bufferRef.current.length === 0 || isPausedRef.current) {
                processingRef.current = false;
                batchBoundariesRef.current = [];
                return;
            }

            // Safety trim for huge buffers
            if (bufferRef.current.length > 1000) {
                bufferRef.current = bufferRef.current.slice(-500);
                batchBoundariesRef.current = [];
            }

            const logToAdd = bufferRef.current.shift()!;

            // Add to displayed logs (max 200 entries)
            setLogs((prev) => {
                const isDup = prev.some(
                    (l) =>
                        l.pubkey === logToAdd.pubkey &&
                        l.type === logToAdd.type &&
                        l.message === logToAdd.message &&
                        Math.abs(new Date(l.timestamp).getTime() - new Date(logToAdd.timestamp).getTime()) < 5000,
                );
                if (isDup) return prev;
                return [logToAdd, ...prev].slice(0, 200);
            });

            // ------------------- Delay calculation -------------------
            let delay = 300; // fallback
            const bufferSize = bufferRef.current.length;

            if (batchBoundariesRef.current.length > 0) {
                const boundary = batchBoundariesRef.current[0];
                if (boundary.type === 'startup-6s') {
                    const avg = boundary.total > 0 ? 6000 / boundary.total : 400;
                    delay = avg * (0.8 + Math.random() * 0.4);
                } else if (boundary.type === 'leftover-3s') {
                    const totalLeft = batchBoundariesRef.current
                        .filter((b) => b.type === 'leftover-3s')
                        .reduce((a, b) => a + b.remaining, 0);
                    const avg = totalLeft > 0 ? 3000 / totalLeft : 100;
                    delay = avg * (0.7 + Math.random() * 0.6);
                } else {
                    // rhythmic batch
                    cycleRef.current = (cycleRef.current + 1) % 10;
                    const pattern = [150, 180, 400, 150, 1200, 150, 200, 500, 150, 1500];
                    delay = pattern[cycleRef.current] * (0.9 + Math.random() * 0.2);
                }
                // Decrement remaining count and shift if done
                boundary.remaining -= 1;
                if (boundary.remaining <= 0) batchBoundariesRef.current.shift();
            } else if (sprintModeRef.current && bufferSize > 0) {
                // Sprint mode – fast catch‑up
                delay = 40 + Math.random() * 40;
            } else {
                // Default rhythmic live feed
                cycleRef.current = (cycleRef.current + 1) % 10;
                const pattern = [150, 180, 400, 150, 1200, 150, 200, 500, 150, 1500];
                const base = pattern[cycleRef.current];
                let multiplier = 1;
                if (bufferSize > 25) multiplier = 0.5;
                else if (bufferSize > 10) multiplier = 0.8;
                delay = base * multiplier * (0.9 + Math.random() * 0.2);
            }

            // Clamp delay for sanity
            delay = Math.min(1500, Math.max(30, delay));

            setTimeout(processOne, delay);
        };

        processOne();
    }, []);

    // ---------------------------------------------------------------------------
    // Effect: initial fetch & socket connection
    // ---------------------------------------------------------------------------
    useEffect(() => {
        fetchLogs();
        const socketUrl = getSocketUrl();
        console.log('[ActivityLogs] 🔌 Connecting to Socket.io:', socketUrl);
        const socket = io(socketUrl, {
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            timeout: 20000,
        });

        socket.on('connect', () => {
            setConnected(true);
            bufferRef.current = [];
            processingRef.current = false;
        });
        socket.on('connect_error', (err: any) => {
            console.error('[ActivityLogs] ❌ Connection error:', err.message);
            setConnected(false);
        });
        socket.on('disconnect', () => {
            setConnected(false);
            bufferRef.current = [];
            processingRef.current = false;
        });

        socket.on('activity', (newLog: ActivityLog) => {
            if (newLog.type === 'streams_active') return;
            if (pubkey && newLog.pubkey !== pubkey) return;
            if (countryCode && newLog.countryCode !== countryCode) return;

            // Convert any existing boundaries to a 3‑second leftover flush
            batchBoundariesRef.current = batchBoundariesRef.current.map((b) => ({ ...b, type: 'leftover-3s' }));

            // Push a fresh 70%‑over‑6s boundary for this incoming log (or batch)
            batchBoundariesRef.current.push({ remaining: 1, total: 1, type: 'startup-6s' });

            // Enable sprint mode if buffer grows large
            if (bufferRef.current.length > 50) sprintModeRef.current = true;

            const enriched = {
                ...newLog,
                _id:
                    newLog._id ||
                    `${newLog.pubkey}-${newLog.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: newLog.timestamp || new Date().toISOString(),
            };
            bufferRef.current.push(enriched);
            processBuffer();
        });

        return () => {
            socket.disconnect();
            bufferRef.current = [];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pubkey, countryCode, limit, typeFilter, processBuffer]);

    // Pause handling effect
    useEffect(() => {
        if (isPaused) {
            bufferRef.current = [];
            processingRef.current = false;
        }
        isPausedRef.current = isPaused;
    }, [isPaused]);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    const filteredLogs = useMemo(() => logs.filter((l) => !typeFilter || l.type === typeFilter).slice(0, 50), [logs, typeFilter]);

    return (
        <div className="w-full h-full flex flex-col gap-2 sm:gap-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                    <h2 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5 sm:gap-2">
                        <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F0A741]" />
                        <span className="hidden xs:inline">Live Activity Feed</span>
                        <span className="xs:hidden">Feed</span>
                    </h2>
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-muted/20 px-1.5 sm:px-2 py-0.5 rounded-full border border-border/40">
                        <div
                            className={`w-1.5 h-1.5 rounded-full ${connected && !isPaused ? 'bg-green-500 animate-pulse' : isPaused ? 'bg-yellow-500' : 'bg-muted-foreground/30'}`}
                        />
                        <span className="text-[9px] sm:text-[10px] font-bold text-foreground/40 uppercase tracking-tight">
                            {isPaused ? 'Paused' : connected ? 'Live' : 'Offline'}
                        </span>
                    </div>
                    <button
                        onClick={() => setIsPaused(!isPaused)}
                        className={`p-1 sm:p-1.5 rounded-lg border transition-colors ${isPaused ? 'bg-[#F0A741]/20 border-[#F0A741]/50 text-[#F0A741]' : 'bg-muted/20 border-border/40 text-foreground/50 hover:text-foreground hover:bg-muted/30'}`}
                        title={isPaused ? 'Resume' : 'Pause'}
                    >
                        {isPaused ? <Play className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <Pause className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                    </button>
                </div>
                {/* Filter dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 bg-muted/20 hover:bg-muted/30 border border-border/40 rounded-lg transition-colors text-[10px] sm:text-xs font-semibold text-foreground/70 hover:text-foreground"
                    >
                        <Filter className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span className="hidden sm:inline">
                            {ACTIVITY_TYPES.find((t) => t.value === typeFilter)?.label || 'All'}
                        </span>
                        <span className="sm:hidden">
                            {typeFilter ? ACTIVITY_TYPES.find((t) => t.value === typeFilter)?.label?.slice(0, 6) || 'All' : 'All'}
                        </span>
                        <ChevronDown className={`w-2.5 h-2.5 sm:w-3 sm:h-3 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showFilterDropdown && (
                        <div className="absolute top-full mt-1 right-0 z-50 bg-card border border-border/40 rounded-lg shadow-xl min-w-[140px] overflow-hidden">
                            {ACTIVITY_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    onClick={() => {
                                        setTypeFilter(type.value);
                                        setShowFilterDropdown(false);
                                    }}
                                    className={`w-full px-3 py-1.5 text-left text-[10px] sm:text-xs transition-colors ${typeFilter === type.value ? 'bg-[#F0A741]/10 text-[#F0A741] font-bold' : 'hover:bg-muted/20 text-foreground/70 hover:text-foreground'}`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Log list */}
            <div className="card p-2 sm:p-4 flex-1 relative overflow-hidden flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-br from-[#F0A741]/[0.02] via-transparent to-transparent pointer-events-none" />
                {loading && logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                        <RefreshCw className="w-8 h-8 text-foreground/10 animate-spin" />
                        <div className="text-center space-y-1">
                            <p className="text-foreground/40 text-xs font-semibold">Loading Activity</p>
                        </div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] gap-4">
                        <Activity className="w-8 h-8 text-foreground/10" />
                        <div className="text-center space-y-1">
                            <p className="text-foreground/40 text-xs font-semibold">No Activity Yet</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1 relative flex-1 overflow-y-auto">
                        <AnimatePresence mode="popLayout">
                            {filteredLogs.map((log) => (
                                <LogItem key={log._id || `${log.timestamp}-${log.pubkey}-${log.type}`} log={log} />
                            ))}
                        </AnimatePresence>
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
                                        { threshold: 0.1 },
                                    );
                                    observer.observe(el);
                                    return () => observer.disconnect();
                                }}
                                className="w-full py-2 flex items-center justify-center"
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
