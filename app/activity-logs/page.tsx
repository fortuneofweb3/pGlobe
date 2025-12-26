'use client';

import React from 'react';
import Header from '@/components/Header';
import ActivityLogList from '@/components/ActivityLogList';
import NodeRaceVisualization from '@/components/NodeRaceVisualization';
import { useNodes } from '@/lib/context/NodesContext';
import { Activity } from 'lucide-react';

export default function ActivityLogsPage() {
    const { nodes, lastUpdate, loading, refreshNodes, availableNetworks, currentNetwork, setSelectedNetwork } = useNodes();

    return (
        <div className="fixed inset-0 w-full h-full flex flex-col bg-black text-foreground">
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

            <main className="flex-1 overflow-hidden flex flex-col">
                {/* Page Header - responsive */}
                <div className="w-full px-3 sm:px-6 pt-2 sm:pt-4 flex-shrink-0">
                    <div className="max-w-7xl mx-auto">
                        <div className="mb-2 sm:mb-4">
                            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-0.5 sm:mb-1 flex items-center gap-2 sm:gap-3">
                                <Activity className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-[#F0A741]" />
                                <span className="hidden sm:inline">Live Network Feed</span>
                                <span className="sm:hidden">Live Feed</span>
                            </h1>
                            <p className="text-foreground/60 text-[10px] sm:text-xs lg:text-sm line-clamp-1 sm:line-clamp-none">
                                <span className="hidden sm:inline">Real-time monitoring of network events, status changes, and performance updates</span>
                                <span className="sm:hidden">Real-time network monitoring</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main content - stacked on mobile, side by side on xl */}
                <div className="flex-1 px-3 sm:px-6 pb-4 sm:pb-6 overflow-hidden">
                    <div className="max-w-7xl mx-auto h-full">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-6 h-full">
                            {/* Racing Visualization - hidden on mobile by default, or shown first */}
                            <div className="hidden xl:block h-full overflow-hidden">
                                <NodeRaceVisualization />
                            </div>

                            {/* Activity List - Full Height, scrollable */}
                            <div className="h-full overflow-hidden min-h-[400px] xl:min-h-0">
                                <ActivityLogList limit={50} showFilters={true} />
                            </div>

                            {/* Racing Visualization - shown at bottom on mobile */}
                            <div className="xl:hidden h-[350px] overflow-hidden">
                                <NodeRaceVisualization />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
