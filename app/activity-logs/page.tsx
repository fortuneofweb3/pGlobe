'use client';

import React from 'react';
import Header from '@/components/Header';
import ActivityLogList from '@/components/ActivityLogList';
import NodeRaceVisualization from '@/components/NodeRaceVisualization';
import { useNodes } from '@/lib/context/NodesContext';
import { Activity } from 'lucide-react';

export default function ActivityLogsPage() {
    const { nodes, lastUpdate, loading, refreshNodes, availableNetworks, currentNetwork, setSelectedNetwork } = useNodes();

    const [activeTab, setActiveTab] = React.useState<'racing' | 'feed'>('feed');

    if (loading && nodes.length === 0) {
        return (
            <div className="h-[100dvh] w-full fixed inset-0 flex flex-col bg-black text-foreground overflow-hidden">
                <Header activePage="activity" loading={true} onRefresh={() => { }} />
                <main className="flex-1 flex flex-col overflow-hidden">
                    <div className="w-full px-3 sm:px-6 pt-4 sm:pt-6 flex-shrink-0">
                        <div className="max-w-7xl mx-auto">
                            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                                        <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                        <span>Live Network Feed</span>
                                    </h1>
                                    <p className="text-foreground/60 text-sm sm:text-base">
                                        Real-time monitoring of network events, status changes, and performance updates
                                    </p>
                                </div>
                                <div className="h-9 w-40 bg-muted/20 border border-border/40 rounded-xl animate-pulse xl:hidden" />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 px-3 sm:px-6 pb-6 sm:pb-8 overflow-hidden">
                        <div className="max-w-7xl mx-auto h-full flex flex-col overflow-hidden">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 h-full overflow-hidden">
                                <div className="card h-full bg-muted/5 animate-pulse flex items-center justify-center">
                                    <div className="text-foreground/20 italic">Initializing Racing Visualization...</div>
                                </div>
                                <div className="card h-full bg-muted/5 animate-pulse flex flex-col p-4">
                                    <div className="h-6 w-32 bg-muted/20 rounded mb-4" />
                                    <div className="space-y-3">
                                        {[...Array(10)].map((_, i) => (
                                            <div key={i} className="h-12 w-full bg-muted/10 rounded" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] w-full fixed inset-0 flex flex-col bg-black text-foreground overflow-hidden">
            <Header
                activePage="activity"
                nodeCount={nodes.length}
                lastUpdate={lastUpdate}
                loading={loading}
                onRefresh={() => refreshNodes()}
                networks={availableNetworks}
                currentNetwork={currentNetwork}
                onNetworkChange={(networkId) => {
                    setSelectedNetwork(networkId);
                }}
                showNetworkSelector={false}
            />

            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Page Header - responsive */}
                <div className="w-full px-3 sm:px-6 pt-4 sm:pt-6 flex-shrink-0">
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                                    <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                    <span className="hidden sm:inline">Live Network Feed</span>
                                    <span className="sm:hidden">Live Feed</span>
                                </h1>
                                <p className="text-foreground/60 text-sm sm:text-base">
                                    <span className="hidden sm:inline">Real-time monitoring of network events, status changes, and performance updates</span>
                                    <span className="sm:hidden">Real-time network monitoring</span>
                                </p>
                            </div>

                            {/* Mobile Tab Switcher */}
                            <div className="xl:hidden flex p-1 bg-muted/20 border border-border/40 rounded-xl max-w-fit self-center sm:self-auto">
                                <button
                                    onClick={() => setActiveTab('feed')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === 'feed'
                                        ? 'bg-[#F0A741] text-black shadow-lg'
                                        : 'text-foreground/60 hover:text-foreground'
                                        }`}
                                >
                                    Live Feed
                                </button>
                                <button
                                    onClick={() => setActiveTab('racing')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === 'racing'
                                        ? 'bg-[#F0A741] text-black shadow-lg'
                                        : 'text-foreground/60 hover:text-foreground'
                                        }`}
                                >
                                    Racing
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main content - stacked tabs on mobile, side by side on xl */}
                <div className="flex-1 px-3 sm:px-6 pb-6 sm:pb-8 overflow-hidden">
                    <div className="max-w-7xl mx-auto h-full flex flex-col overflow-hidden">
                        {/* Desktop View: Side by Side */}
                        <div className="hidden xl:grid grid-cols-2 gap-4 sm:gap-6 h-full overflow-hidden">
                            <div className="h-full overflow-hidden">
                                <NodeRaceVisualization />
                            </div>
                            <div className="h-full overflow-hidden">
                                <ActivityLogList limit={50} showFilters={true} />
                            </div>
                        </div>

                        {/* Mobile View: Tabbed Viewport - Keep both mounted for background connectivity */}
                        <div className="xl:hidden flex-1 relative overflow-hidden">
                            <div className={`h-full absolute inset-0 transition-opacity duration-300 ${activeTab === 'feed' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <ActivityLogList limit={50} showFilters={true} />
                            </div>
                            <div className={`h-full absolute inset-0 transition-opacity duration-300 ${activeTab === 'racing' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                <NodeRaceVisualization />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
