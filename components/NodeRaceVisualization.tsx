'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, TrendingUp, Pause, Play } from 'lucide-react';

interface NodeMetrics {
    pubkey: string;
    address?: string;
    location?: string;
    status: 'online' | 'offline' | 'syncing';
    activeStreams?: number;
    packetsReceived?: number;
    packetsSent?: number;
    credits?: number;
    baselineCredits?: number;
    baselinePackets?: number;
    lastUpdate: number;
    countryCode?: string;
}

interface RacingNode extends NodeMetrics {
    score: number;
    rank: number;
}

interface ActivityEvent {
    type: string;
    pubkey: string;
    address?: string;
    location?: string;
    data?: {
        credits?: number;
        packets?: number;
        streams?: number;
        total?: number;
        rxEarned?: number;
        txEarned?: number;
        earned?: number;
    };
    countryCode?: string;
}

const RENDER_API_URL = process.env.NEXT_PUBLIC_RENDER_API_URL || 'https://pglobe.onrender.com';
const REALTIME_SERVER_URL = process.env.NEXT_PUBLIC_REALTIME_SERVER_URL || '';
const MAX_NODES_DISPLAYED = 12;
const SCORE_DECAY_MS = 30000;

const getSocketUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://${hostname}:3002`;
        }
    }
    return REALTIME_SERVER_URL || 'https://pglobe-logs.onrender.com' || RENDER_API_URL;
};

// Smooth spring config for 60fps - fluid and natural
const smoothSpring = {
    type: "spring" as const,
    stiffness: 200,
    damping: 25,
    mass: 1,
};

// Smooth bar animation for racing bars
const barSpring = {
    type: "spring" as const,
    stiffness: 120,
    damping: 18,
};

// Racing bar component with optimized framer-motion
function RacingBar({ node, index, maxScore }: { node: RacingNode; index: number; maxScore: number }) {
    const barWidth = (node.score / maxScore) * 100;
    const isPodium = index < 3;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online': return 'bg-green-500/60';
            case 'syncing': return 'bg-orange-500/60';
            case 'offline': return 'bg-red-500/30';
            default: return 'bg-gray-500/40';
        }
    };

    const getFlagEmoji = (countryCode: string) => {
        if (!countryCode) return '';
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    };

    const getNodeLabel = () => {
        const flag = node.countryCode ? getFlagEmoji(node.countryCode) : '';
        const locationStr = node.location ? ` ${node.location}` : '';

        if (node.address) {
            const ip = node.address.split(':')[0];
            return (
                <span className="flex items-center gap-1.5">
                    {flag && <span className="text-sm sm:text-base leading-none">{flag}</span>}
                    <span className="truncate">{ip}{locationStr && ` (${locationStr})`}</span>
                </span>
            );
        }

        return (
            <span className="flex items-center gap-1.5">
                {flag && <span className="text-sm sm:text-base leading-none">{flag}</span>}
                <span className="truncate">{node.pubkey.slice(0, 8)}...</span>
            </span>
        );
    };

    return (
        <motion.div
            layout="position"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4, transition: { duration: 0.15 } }}
            transition={smoothSpring}
            style={{ willChange: 'transform, opacity' }}
        >
            <div className="flex items-center gap-2 sm:gap-3 group">
                {/* Rank Badge */}
                <div
                    className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-[10px] sm:text-xs border transition-colors duration-200 ${isPodium
                        ? 'bg-[#F0A741]/20 border-[#F0A741]/40 text-[#F0A741]'
                        : 'bg-muted/40 border-border/40 text-foreground/60'
                        }`}
                >
                    #{node.rank}
                </div>

                {/* Racing Bar */}
                <div className="flex-1 relative h-8 sm:h-12 rounded-lg bg-muted/20 border border-border/30 overflow-hidden">
                    {/* Animated bar width - GPU accelerated */}
                    <motion.div
                        className={`absolute inset-y-0 left-0 rounded-l-lg ${getStatusColor(node.status)} ${isPodium ? 'shadow-[0_0_20px_rgba(240,167,65,0.2)]' : ''}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={barSpring}
                        style={{ willChange: 'width' }}
                    />

                    {/* Node info overlay */}
                    <div className="relative z-10 h-full flex items-center justify-between px-2 sm:px-4">
                        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
                            <div className="text-[10px] sm:text-sm font-mono font-bold text-foreground/90 drop-shadow-md truncate max-w-[120px] sm:max-w-[280px]">
                                {getNodeLabel()}
                            </div>
                            {node.credits !== undefined && node.credits > 0 && (
                                <span className="hidden sm:flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-white/10 text-xs">
                                    <Zap className="w-3 h-3 text-[#F0A741]" />
                                    <span className="text-[#F0A741] font-semibold">{node.credits.toFixed(1)}</span>
                                </span>
                            )}
                        </div>

                        <div className="text-[10px] sm:text-xs font-bold text-foreground/70 drop-shadow-md whitespace-nowrap">
                            {node.score.toFixed(0)} pts
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default function NodeRaceVisualization() {
    const [nodeMetrics, setNodeMetrics] = useState<Record<string, NodeMetrics>>({});
    const [connected, setConnected] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(isPaused);

    const calculateScore = (node: NodeMetrics): number => {
        if (node.status === 'offline') return 0;
        const earnedCredits = node.credits || 0;
        const earnedPackets = (node.packetsReceived || 0) + (node.packetsSent || 0);
        const timeSinceUpdate = Date.now() - node.lastUpdate;
        const decayFactor = Math.max(0, 1 - (timeSinceUpdate / SCORE_DECAY_MS));
        const rawScore = (earnedCredits * 10) + (earnedPackets * 0.01);
        return rawScore * decayFactor;
    };

    const rankedNodes: RacingNode[] = useMemo(() => {
        const nodesArray = Object.values(nodeMetrics);
        return nodesArray
            .map((node) => ({
                ...node,
                score: calculateScore(node),
            }))
            .filter(node => node.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_NODES_DISPLAYED)
            .map((node, index) => ({
                ...node,
                rank: index + 1,
            }));
    }, [nodeMetrics]);

    const maxScore = rankedNodes[0]?.score || 1;

    const bufferRef = useRef<ActivityEvent[]>([]);
    const processingRef = useRef(false);
    const isVisibleRef = useRef(true);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                isVisibleRef.current = false;
                bufferRef.current = [];
                processingRef.current = false;
                setNodeMetrics({});
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
                bufferRef.current = [];
                return;
            }

            if (bufferRef.current.length > 60) {
                bufferRef.current = bufferRef.current.slice(-30);
            }

            const log = bufferRef.current.shift()!;

            setNodeMetrics((prev) => {
                const existing = prev[log.pubkey] || {
                    pubkey: log.pubkey,
                    address: log.address,
                    location: log.location,
                    status: 'online',
                    activeStreams: 0,
                    packetsReceived: 0,
                    packetsSent: 0,
                    credits: 0,
                    baselineCredits: (log.type === 'node_online' || log.type === 'node_status' || log.type === 'new_node') ? (log.data?.credits || 0) : 0,
                    baselinePackets: (log.type === 'node_online' || log.type === 'node_status' || log.type === 'new_node') ? (log.data?.packets || 0) : 0,
                    lastUpdate: Date.now(),
                    countryCode: log.countryCode,
                };

                const updated = {
                    ...existing,
                    lastUpdate: Date.now(),
                    address: log.address || (existing.address as string),
                    location: log.location || (existing.location as string),
                    countryCode: log.countryCode || existing.countryCode,
                };

                if (log.type === 'new_node' || log.type === 'node_online') {
                    updated.status = 'online';
                    if (log.data?.streams !== undefined) updated.activeStreams = log.data.streams;
                    if (log.data?.credits !== undefined) {
                        if (existing.baselineCredits === 0) updated.baselineCredits = log.data.credits;
                        updated.credits = Math.max(0, log.data.credits - (updated.baselineCredits || 0));
                    }
                    if (log.data?.packets !== undefined) {
                        if (existing.baselinePackets === 0) updated.baselinePackets = log.data.packets;
                        updated.packetsReceived = Math.max(0, log.data.packets - (updated.baselinePackets || 0));
                        updated.packetsSent = 0;
                    }
                } else if (log.type === 'node_offline') {
                    updated.status = 'offline';
                } else if (log.type === 'node_syncing') {
                    updated.status = 'syncing';
                } else if (log.type === 'node_status') {
                    updated.status = 'online';
                    if (log.data?.streams !== undefined) updated.activeStreams = log.data.streams;
                    if (log.data?.credits !== undefined) {
                        if (existing.baselineCredits === 0 && log.data.credits > 0) updated.baselineCredits = log.data.credits;
                        updated.credits = Math.max(0, log.data.credits - (updated.baselineCredits || 0));
                    }
                    if (log.data?.packets !== undefined) {
                        if (existing.baselinePackets === 0 && log.data.packets > 0) updated.baselinePackets = log.data.packets;
                        updated.packetsReceived = Math.max(0, log.data.packets - (updated.baselinePackets || 0));
                        updated.packetsSent = 0;
                    }
                } else if (log.type === 'streams_active') {
                    if (log.data?.streams !== undefined) updated.activeStreams = log.data.streams;
                    else if (log.data?.total !== undefined) updated.activeStreams = log.data.total;
                } else if (log.type === 'packets_earned') {
                    if (log.data?.packets !== undefined) {
                        if (updated.baselinePackets === 0 && log.data.packets > 0) updated.baselinePackets = log.data.packets;
                        updated.packetsReceived = Math.max(0, log.data.packets - (updated.baselinePackets || 0));
                        updated.packetsSent = 0;
                    } else {
                        updated.packetsReceived = (updated.packetsReceived || 0) + (log.data?.rxEarned || 0);
                        updated.packetsSent = (updated.packetsSent || 0) + (log.data?.txEarned || 0);
                    }
                } else if (log.type === 'credits_earned') {
                    if (log.data?.credits !== undefined) {
                        if (updated.baselineCredits === 0 && log.data.credits > 0) updated.baselineCredits = log.data.credits;
                        updated.credits = Math.max(0, log.data.credits - (updated.baselineCredits || 0));
                    } else if (log.data?.earned !== undefined) {
                        updated.credits = (updated.credits || 0) + log.data.earned;
                    }
                }

                return { ...prev, [log.pubkey]: updated };
            });

            const bufferSize = Math.max(bufferRef.current.length + 1, 1);
            const baseDelay = 5000 / (bufferSize * 0.9);
            const jitter = 0.5 + Math.random();
            let delay = baseDelay * jitter;
            delay = Math.min(600, Math.max(30, delay));

            setTimeout(processOne, delay);
        };

        processOne();
    }, []);

    useEffect(() => {
        const socketUrl = getSocketUrl();
        //        console.log('[Racing] Connecting to Socket.io at:', socketUrl);

        const socket = io(socketUrl, {
            transports: ['polling', 'websocket'],
            reconnectionAttempts: 10,
            timeout: 20000,
        });

        socket.on('connect', () => {
            //            console.log('[Racing] Connected');
            setConnected(true);
            bufferRef.current = [];
            processingRef.current = false;
            setNodeMetrics({});
        });

        socket.on('connect_error', (error: any) => {
            setConnected(false);
        });
        socket.on('disconnect', () => {
            /*
                        console.log('[Racing] Disconnected');
            */
            setConnected(false);
            bufferRef.current = [];
            processingRef.current = false;
        });

        socket.on('activity', (log: unknown) => {
            bufferRef.current.push(log as ActivityEvent);
            processBuffer();
        });

        const cleanupInterval = setInterval(() => {
            setNodeMetrics((prev) => {
                const now = Date.now();
                const entries = Object.entries(prev);
                const scored = entries
                    .filter(([, node]) => now - node.lastUpdate < 60000)
                    .map(([key, node]) => ({
                        key,
                        node,
                        score: ((node.credits || 0) * 10) + ((node.packetsReceived || 0) + (node.packetsSent || 0)) * 0.01
                    }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 20);

                const cleaned: Record<string, NodeMetrics> = {};
                scored.forEach(({ key, node }) => {
                    cleaned[key] = node;
                });
                return cleaned;
            });
        }, 5000);

        return () => {
            socket.disconnect();
            clearInterval(cleanupInterval);
            bufferRef.current = [];
        };
    }, [processBuffer]);

    useEffect(() => {
        if (isPaused) {
            bufferRef.current = [];
            processingRef.current = false;
        }
    }, [isPaused]);

    return (
        <div className="w-full h-full flex flex-col gap-2 sm:gap-4">
            {/* Header - responsive */}
            <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                    <h2 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5 sm:gap-2">
                        <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F0A741]" />
                        <span className="hidden xs:inline">Live Node Activity Race</span>
                        <span className="xs:hidden">Node Race</span>
                        <div className="group relative ml-1 cursor-help hidden sm:block">
                            <div className="w-3.5 h-3.5 rounded-full border border-zinc-500 text-zinc-500 flex items-center justify-center text-[9px] font-bold">?</div>
                            <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-48 bg-black/95 text-white text-[10px] p-2 rounded border border-white/20 z-[100] shadow-xl pointer-events-none">
                                Score = (Session Credits × 10) + (Session Packets × 0.01)
                            </div>
                        </div>
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
                <div className="text-[10px] sm:text-xs text-foreground/40">
                    Top {rankedNodes.length}
                </div>
            </div>

            {/* Racing bars */}
            <div className="card p-3 sm:p-6 flex-1 relative overflow-hidden flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-br from-[#F0A741]/[0.02] via-transparent to-transparent pointer-events-none" />

                {rankedNodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[250px] sm:h-[350px] gap-4">
                        <Activity className="w-8 h-8 sm:w-12 sm:h-12 text-foreground/10 animate-pulse" />
                        <div className="text-center space-y-1">
                            <p className="text-foreground/40 text-xs sm:text-sm font-semibold">Waiting for Active Nodes</p>
                            <p className="text-foreground/20 text-[10px] sm:text-xs">Real-time activity will appear here...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5 sm:space-y-2 relative flex-1 overflow-y-auto">
                        <AnimatePresence mode="popLayout">
                            {rankedNodes.map((node, index) => (
                                <RacingBar
                                    key={node.pubkey}
                                    node={node}
                                    index={index}
                                    maxScore={maxScore}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
