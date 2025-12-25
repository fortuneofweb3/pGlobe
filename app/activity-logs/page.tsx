'use client';

import React from 'react';
import Header from '@/components/Header';
import ActivityLogList from '@/components/ActivityLogList';
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

            <main className="flex-1 overflow-y-auto">
                <div className="w-full px-3 sm:px-6 pt-3 sm:pt-6 pb-6">
                    <div className="max-w-7xl mx-auto">
                        {/* Page Header */}
                        <div className="mb-4 sm:mb-6">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                                <div className="flex-1">
                                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
                                        <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-[#F0A741]" />
                                        Live Network Feed
                                    </h1>
                                    <p className="text-foreground/60 text-sm sm:text-base">
                                        Real-time monitoring of network events, status changes, and performance updates
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Activity List */}
                        <ActivityLogList limit={100} showFilters={true} />
                    </div>
                </div>
            </main>
        </div>
    );
}
