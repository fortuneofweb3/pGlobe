'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
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
        // Local dev escape hatch
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://${hostname}:3002`;
        }

        // Production logic
        if (REALTIME_SERVER_URL) {
            // Ensure protocol
            return REALTIME_SERVER_URL.startsWith('http') ? REALTIME_SERVER_URL : `https://${REALTIME_SERVER_URL}`;
        }
    }
    return RENDER_API_URL;
};

// Smooth spring config for 60fps - fluid and natural
const smoothSpring = {
    type: "spring" as const,
    stiffness: 120,
    damping: 20,
    mass: 0.8,
};

// Lighter spring for intensity bars
const barSpring = {
    type: "spring" as const,
    stiffness: 150,
    damping: 20,
};

const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return '';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
};

// Log item component with optimized framer-motion
function LogItem({ log }: { log: ActivityLog }) {
    const getIcon = (type: string) => {
        const iconClass = "w-3 h-3 sm:w-3.5 sm:h-3.5";
        switch (type) {
            case 'new_node': return <CheckCircle2 className={`${iconClass} text-green-400`} />;
            case 'node_online': return <CheckCircle2 className={`${iconClass} text-green-400`} />;
            case 'node_offline': return <XCircle className={`${iconClass} text-red-400`} />;
            case 'node_status': return <Activity className={`${iconClass} text-blue-400`} />;
            case 'streams_active': return <Zap className={`${iconClass} text-cyan-400`} />;
            case 'packets_earned': return <Activity className={`${iconClass} text-emerald-400`} />;
            case 'credits_earned': return <Activity className={`${iconClass} text-[#F0A741]`} />;
            case 'credits_lost': return <XCircle className={`${iconClass} text-red-400`} />;
            default: return <Activity className={`${iconClass} text-foreground/60`} />;
        }
    };

    const renderIntensityBar = () => {
        const data = log.data as any;
        let width = 0;
        let colorClass = '';

        if (log.type === 'packets_earned' && data?.rxEarned !== undefined) {
            const total = (data.rxEarned || 0) + (data.txEarned || 0);
            width = Math.min(100, (total / 5000) * 100);
            colorClass = 'bg-emerald-500/40';
        } else if (log.type === 'credits_earned' && data?.earned !== undefined) {
            width = Math.min(100, (data.earned / 50) * 100);
            colorClass = 'bg-[#F0A741]/40';
        } else if (log.type === 'credits_lost' && data?.lost !== undefined) {
            width = Math.min(100, (data.lost / 50) * 100);
            colorClass = 'bg-red-500/40';
        }

        if (width === 0) return null;

        return (
            <div className="mt-1.5 sm:mt-2 w-full max-w-[150px] sm:max-w-[200px] h-1 bg-muted/20 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={barSpring}
                    className={`h-full ${colorClass}`}
                    style={{ willChange: 'width' }}
                />
            </div>
        );
    };

    // Truncate pubkey in the middle: abcd...wxyz
    const formatPubkey = (key?: string) => {
        if (!key) return 'Node';
        if (key.length <= 12) return key;
        return `${key.slice(0, 6)}...${key.slice(-4)}`;
    };

    // Format message - for packets_earned, use data to show received/sent format
    const getFormattedMessage = () => {
        const data = log.data as any;
        const nodeIdentifier = log.address || formatPubkey(log.pubkey);

        // For packet events, format from data to show received/sent
        if (log.type === 'packets_earned' && data) {
            const rxEarned = data.rxEarned || 0;
            const txEarned = data.txEarned || 0;

            const parts: string[] = [];
            if (rxEarned > 0) parts.push(`received ${rxEarned.toLocaleString()}`);
            if (txEarned > 0) parts.push(`sent ${txEarned.toLocaleString()}`);

            if (parts.length > 0) {
                return `${nodeIdentifier} ${parts.join(' / ')} packets`;
            }
        }

        // For credits_lost, format properly
        if (log.type === 'credits_lost' && data?.lost) {
            return `${nodeIdentifier} lost ${data.lost.toFixed(2)} credits`;
        }

        // For credits_earned, format properly
        if (log.type === 'credits_earned' && data?.earned) {
            return `${nodeIdentifier} earned ${data.earned.toFixed(2)} credits`;
        }

        // Default: use the stored message but truncate the pubkey or swap with address if it's there
        if (log.message && log.pubkey && log.message.includes(log.pubkey)) {
            return log.message.replace(log.pubkey, nodeIdentifier);
        }

        return log.message;
    };

    const truncatedPubkey = useMemo(() => {
        if (!log.pubkey) return '';
        return formatPubkey(log.pubkey);
    }, [log.pubkey]);

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

                    <div className="flex-1 min-w-0">
                        {/* Message and timestamp */}
                        <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
                            <p className="text-xs sm:text-sm text-zinc-200 font-semibold leading-relaxed line-clamp-2">
                                {getFormattedMessage()}
                            </p>
                            <span className="text-[8px] sm:text-[9px] text-zinc-500 whitespace-nowrap font-bold uppercase tracking-wider bg-zinc-900/50 px-1.5 sm:px-2 py-0.5 rounded border border-zinc-800/50 flex-shrink-0">
                                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </span>
                        </div>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs">
                            <div className="flex items-center gap-1 bg-black/40 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border border-zinc-800/80" title={log.pubkey}>
                                <Globe className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-zinc-500" />
                                <span className="font-mono text-zinc-400 truncate">
                                    {truncatedPubkey}
                                </span>
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

export default function ActivityLogList({ pubkey, countryCode, limit = 25 }: ActivityLogListProps) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [connected, setConnected] = useState(false);
    const [typeFilter, setTypeFilter] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(isPaused);
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
                    // Initial load: 0% immediate, all to buffer for orchestrated drip
                    initialBatchSizeRef.current = data.logs.length;
                    logsProcessedRef.current = 0;
                    setLogs([]); // Start empty

                    // Push all results into the buffer
                    data.logs.forEach((log: ActivityLog) => {
                        const logWithId = {
                            ...log,
                            _id: log._id || `${log.pubkey}-${log.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                            timestamp: log.timestamp || new Date().toISOString(),
                        };
                        bufferRef.current.push(logWithId);
                    });

                    if (data.logs.length > 0) {
                        processBuffer();
                    }
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

    const bufferRef = useRef<ActivityLog[]>([]);
    const processingRef = useRef(false);
    const isVisibleRef = useRef(true);
    const cycleRef = useRef(0);
    const initialBatchSizeRef = useRef(0);
    const logsProcessedRef = useRef(0);
    const isSprintModeRef = useRef(false);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                isVisibleRef.current = false;
                bufferRef.current = [];
                processingRef.current = false;
            } else {
                isVisibleRef.current = true;
                bufferRef.current = [];
                processingRef.current = false;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    const processBuffer = React.useCallback(() => {
        if (!isVisibleRef.current || isPausedRef.current) {
            bufferRef.current = [];
            return;
        }
        if (processingRef.current || bufferRef.current.length === 0) return;
        processingRef.current = true;

        const processOne = () => {
            if (!isVisibleRef.current || bufferRef.current.length === 0) {
                processingRef.current = false;
                isSprintModeRef.current = false;
                return;
            }

            // Relaxed trimming for performance safety
            if (bufferRef.current.length > 1000) {
                bufferRef.current = bufferRef.current.slice(-500);
            }

            const logToAdd = bufferRef.current.shift()!;
            logsProcessedRef.current += 1;

            setLogs((prev: ActivityLog[]) => {
                const isDuplicate = prev.some((l: ActivityLog) => {
                    const timeDiff = Math.abs(new Date(l.timestamp).getTime() - new Date(logToAdd.timestamp).getTime());
                    return l.pubkey === logToAdd.pubkey && l.type === logToAdd.type && l.message === logToAdd.message && timeDiff < 5000;
                });

                if (isDuplicate) return prev;
                return [logToAdd, ...prev].slice(0, 200);
            });

            // Calculate Delay
            let delay = 300;
            const bufferSize = bufferRef.current.length;
            const initial70Percent = Math.floor(initialBatchSizeRef.current * 0.7);

            // 1. Startup Drip Phase (First 70% over ~6 seconds)
            // WE PROTECT THIS PHASE - it cannot be overridden by Sprint Mode
            if (logsProcessedRef.current <= initial70Percent && initialBatchSizeRef.current > 0) {
                // If we have ~17 logs (70% of 25), average delay is ~350ms to hit ~6s
                // Vary between 200ms and 500ms
                delay = 200 + (Math.random() * 300);
            }
            // 2. Sprint Mode (High speed flush for catch-up)
            // Only kicks in AFTER the startup phase
            else if (isSprintModeRef.current && bufferSize > 0) {
                delay = 50 + Math.random() * 50;
            }
            // 3. Rhythmic Normal Phase
            else {
                cycleRef.current = (cycleRef.current + 1) % 10;

                // Orchestrate a "Pattern": Fast, Fast, Medium, Fast, Slow
                const pattern = [150, 180, 400, 150, 1200, 150, 200, 500, 150, 1500];
                const baseDelay = pattern[cycleRef.current];

                // Adjust based on buffer size (if we are lagging but not sprinting)
                let multiplier = 1;
                if (bufferSize > 25) multiplier = 0.5;
                else if (bufferSize > 10) multiplier = 0.8;

                const jitter = 0.9 + Math.random() * 0.2;
                delay = baseDelay * multiplier * jitter;
            }

            // Clamp delay for sanity
            delay = Math.min(1500, Math.max(30, delay));

            setTimeout(processOne, delay);
        };

        processOne();
    }, []);

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
            //        console.log('[ActivityLogs] Connected');
            setConnected(true);
            bufferRef.current = [];
            processingRef.current = false;
        });

        socket.on('connect_error', (error: any) => {
            console.error('[ActivityLogs] ❌ Connection error:', error.message);
            setConnected(false);
        });
        socket.on('disconnect', () => {
            /*
                        console.log('[ActivityLogs] Disconnected');
            */
            setConnected(false);
            bufferRef.current = [];
            processingRef.current = false;
        });

        socket.on('activity', (newLog: ActivityLog) => {
            if (newLog.type === 'streams_active') return;
            if (pubkey && newLog.pubkey !== pubkey) return;
            if (countryCode && newLog.countryCode !== countryCode) return;

            // Live event arrived: if we have a backlog of historical logs, trigger Sprint Mode
            if (bufferRef.current.length > 5) {
                isSprintModeRef.current = true;
            }

            const logWithId = {
                ...newLog,
                _id: newLog._id || `${newLog.pubkey}-${newLog.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: newLog.timestamp || new Date().toISOString(),
            };

            bufferRef.current.push(logWithId);
            processBuffer();
        });

        return () => {
            socket.disconnect();
            bufferRef.current = [];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pubkey, countryCode, limit, typeFilter, processBuffer]);

    useEffect(() => {
        if (isPaused) {
            bufferRef.current = [];
            processingRef.current = false;
        }
    }, [isPaused]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => !typeFilter || log.type === typeFilter).slice(0, 50);
    }, [logs, typeFilter]);

    return (
        <div className="w-full h-full flex flex-col gap-2 sm:gap-4">
            {/* Header - Matches NodeRace style/height */}
            <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                    <h2 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5 sm:gap-2">
                        <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F0A741]" />
                        <span className="hidden xs:inline">Live Activity Feed</span>
                        <span className="xs:hidden">Feed</span>
                    </h2>
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-muted/20 px-1.5 sm:px-2 py-0.5 rounded-full border border-border/40">
                        <div className={`w-1.5 h-1.5 rounded-full ${connected && !isPaused ? 'bg-green-500 animate-pulse' : isPaused ? 'bg-yellow-500' : 'bg-muted-foreground/30'}`} />
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
                        <span className="hidden sm:inline">{ACTIVITY_TYPES.find(t => t.value === typeFilter)?.label || 'All'}</span>
                        <span className="sm:hidden">{typeFilter ? ACTIVITY_TYPES.find(t => t.value === typeFilter)?.label?.slice(0, 6) || 'All' : 'All'}</span>
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
                                    className={`w-full px-3 py-1.5 text-left text-[10px] sm:text-xs transition-colors ${typeFilter === type.value
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
                                <LogItem
                                    key={log._id || `${log.timestamp}-${log.pubkey}-${log.type}`}
                                    log={log}
                                />
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
                                        { threshold: 0.1 }
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
