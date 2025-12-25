'use client';

import React, { useEffect, useState, useMemo } from 'react';
import io from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, TrendingUp } from 'lucide-react';

interface NodeMetrics {
    pubkey: string;
    address?: string;
    location?: string;
    status: 'online' | 'offline' | 'syncing';
    activeStreams?: number;
    packetsReceived?: number;
    packetsSent?: number;
    credits?: number;
    lastUpdate: number;
}

interface RacingNode extends NodeMetrics {
    score: number;
    rank: number;
}

const RENDER_API_URL = process.env.NEXT_PUBLIC_RENDER_API_URL || 'https://pglobe.onrender.com';
const MAX_NODES_DISPLAYED = 12;
const SCORE_DECAY_MS = 30000; // 30 seconds
const STORAGE_KEY = 'xandeum_node_race_metrics';

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

export default function NodeRaceVisualization() {
    const [nodeMetrics, setNodeMetrics] = useState<Record<string, NodeMetrics>>(() => {
        // Load from localStorage on mount
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch (e) {
                console.warn('Failed to load racing metrics from localStorage:', e);
            }
        }
        return {};
    });
    const [connected, setConnected] = useState(false);

    // Calculate activity score for each node
    const calculateScore = (node: NodeMetrics): number => {
        if (node.status === 'offline') return 0;

        const streams = node.activeStreams || 0;
        const packets = (node.packetsReceived || 0) + (node.packetsSent || 0);

        // Decay score based on time since last update
        const timeSinceUpdate = Date.now() - node.lastUpdate;
        const decayFactor = Math.max(0, 1 - (timeSinceUpdate / SCORE_DECAY_MS));

        // Weight: streams are more important than packets
        const rawScore = (streams * 100) + (packets * 0.01);
        return rawScore * decayFactor;
    };

    // Sort and rank nodes
    const rankedNodes: RacingNode[] = useMemo(() => {
        const nodesArray = Object.values(nodeMetrics);

        return nodesArray
            .map((node) => ({
                ...node,
                score: calculateScore(node),
            }))
            .filter(node => node.score > 0) // Only show active nodes
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_NODES_DISPLAYED)
            .map((node, index) => ({
                ...node,
                rank: index + 1,
            }));
    }, [nodeMetrics]);

    const maxScore = rankedNodes[0]?.score || 1;

    useEffect(() => {
        const socketUrl = getSocketUrl();
        console.log('[Racing] Connecting to Socket.io at:', socketUrl);

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

        // Listen for activity events and update metrics
        socket.on('activity', (log: any) => {
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
                    lastUpdate: Date.now(),
                };

                let updated = {
                    ...existing,
                    lastUpdate: Date.now(),
                    address: log.address || existing.address,
                    location: log.location || existing.location,
                };

                // Update based on activity type
                if (log.type === 'new_node' || log.type === 'node_online') {
                    updated.status = 'online';
                } else if (log.type === 'node_offline') {
                    updated.status = 'offline';
                } else if (log.type === 'node_syncing') {
                    updated.status = 'syncing';
                } else if (log.type === 'streams_active' && log.data?.total !== undefined) {
                    updated.activeStreams = log.data.total;
                } else if (log.type === 'packets_earned') {
                    updated.packetsReceived = (updated.packetsReceived || 0) + (log.data?.rxEarned || 0);
                    updated.packetsSent = (updated.packetsSent || 0) + (log.data?.txEarned || 0);
                } else if (log.type === 'credits_earned' && log.data?.earned !== undefined) {
                    updated.credits = (updated.credits || 0) + log.data.earned;
                }

                return { ...prev, [log.pubkey]: updated };
            });
        });

        // Periodic cleanup of stale nodes
        const cleanupInterval = setInterval(() => {
            const now = Date.now();
            setNodeMetrics((prev) => {
                const cleaned: Record<string, NodeMetrics> = {};
                Object.entries(prev).forEach(([key, node]) => {
                    // Keep if updated in last 60 seconds
                    if (now - node.lastUpdate < 60000) {
                        cleaned[key] = node;
                    }
                });
                return cleaned;
            });
        }, 10000);

        return () => {
            socket.disconnect();
            clearInterval(cleanupInterval);
        };
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online': return 'bg-green-500/60';
            case 'syncing': return 'bg-orange-500/60';
            case 'offline': return 'bg-red-500/30';
            default: return 'bg-gray-500/40';
        }
    };

    const getNodeLabel = (node: RacingNode) => {
        if (node.address) {
            const ip = node.address.split(':')[0];
            return node.location ? `${ip} (${node.location})` : ip;
        }
        return `${node.pubkey.slice(0, 8)}...`;
    };

    return (
        <div className="w-full h-full flex flex-col gap-4">
            <div className="flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#F0A741]" />
                        Live Node Activity Race
                    </h2>
                    <div className="flex items-center gap-2 bg-muted/20 px-2 py-0.5 rounded-full border border-border/40">
                        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse' : 'bg-muted-foreground/30'}`} />
                        <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-tight">{connected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>
                <div className="text-xs text-foreground/40">
                    Top {rankedNodes.length} nodes
                </div>
            </div>

            <div className="card p-6 space-y-3 flex-1 relative overflow-hidden flex flex-col">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#F0A741]/[0.02] via-transparent to-transparent pointer-events-none" />

                {rankedNodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[450px] gap-4">
                        <Activity className="w-12 h-12 text-foreground/10 animate-pulse" />
                        <div className="text-center space-y-1">
                            <p className="text-foreground/40 text-sm font-semibold">Waiting for Active Nodes</p>
                            <p className="text-foreground/20 text-xs">Real-time activity will appear here...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 relative flex-1 overflow-y-auto">
                        <AnimatePresence mode="popLayout">
                            {rankedNodes.map((node, index) => {
                                const barWidth = (node.score / maxScore) * 100;
                                const isPodium = index < 3;

                                return (
                                    <motion.div
                                        key={node.pubkey}
                                        layout
                                        initial={{ opacity: 0, x: -50 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 50, scale: 0.8 }}
                                        transition={{
                                            layout: { type: 'spring', stiffness: 350, damping: 30 },
                                            opacity: { duration: 0.3 },
                                            x: { duration: 0.3 },
                                        }}
                                        className="relative"
                                    >
                                        <div className="flex items-center gap-3 group">
                                            {/* Rank Badge */}
                                            <motion.div
                                                layout
                                                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border ${isPodium
                                                    ? 'bg-[#F0A741]/20 border-[#F0A741]/40 text-[#F0A741]'
                                                    : 'bg-muted/40 border-border/40 text-foreground/60'
                                                    }`}
                                            >
                                                #{node.rank}
                                            </motion.div>

                                            {/* Racing Bar */}
                                            <div className="flex-1 relative h-12 rounded-lg overflow-hidden bg-muted/20 border border-border/30">
                                                {/* Animated bar */}
                                                <motion.div
                                                    className={`absolute inset-y-0 left-0 ${getStatusColor(node.status)} ${isPodium ? 'shadow-[0_0_20px_rgba(240,167,65,0.2)]' : ''
                                                        }`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${barWidth}%` }}
                                                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                                />

                                                {/* Top glow for leader */}
                                                {index === 0 && (
                                                    <motion.div
                                                        className="absolute inset-0 bg-gradient-to-r from-[#F0A741]/10 to-transparent"
                                                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                                                        transition={{ duration: 2, repeat: Infinity }}
                                                    />
                                                )}

                                                {/* Node info overlay */}
                                                <div className="relative z-10 h-full flex items-center justify-between px-4 group/bar">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-mono font-bold text-foreground/90 drop-shadow-md">
                                                            {getNodeLabel(node)}
                                                        </span>
                                                        <div className="flex items-center gap-2 text-xs">
                                                            {node.activeStreams !== undefined && node.activeStreams > 0 && (
                                                                <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-white/10">
                                                                    <Activity className="w-3 h-3 text-cyan-400" />
                                                                    <span className="text-cyan-400 font-semibold">{node.activeStreams}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-xs font-bold text-foreground/70 drop-shadow-md">
                                                        {node.score.toFixed(0)} pts
                                                    </div>

                                                    {/* Hover Tooltip */}
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-50">
                                                        <div className="bg-black/95 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 shadow-xl min-w-[200px]">
                                                            <div className="text-[10px] space-y-1">
                                                                <div className="flex justify-between gap-4 text-cyan-400">
                                                                    <span>Active Streams:</span>
                                                                    <span className="font-bold">{node.activeStreams || 0}</span>
                                                                </div>
                                                                <div className="flex justify-between gap-4 text-emerald-400">
                                                                    <span>Packets:</span>
                                                                    <span className="font-bold">{((node.packetsReceived || 0) + (node.packetsSent || 0)).toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex justify-between gap-4 text-[#F0A741]">
                                                                    <span>Credits:</span>
                                                                    <span className="font-bold">{(node.credits || 0).toFixed(2)}</span>
                                                                </div>
                                                                <div className="border-t border-white/10 mt-1 pt-1 flex justify-between gap-4 text-white/70">
                                                                    <span>Total Score:</span>
                                                                    <span className="font-bold">{node.score.toFixed(0)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <div className="text-[10px] text-foreground/30 text-center flex-shrink-0">
                Score = (Streams × 100) + (Credits × 10) + (Packets × 0.01) • Updates in real-time
            </div>
        </div>
    );
}
