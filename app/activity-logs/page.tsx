'use client';

import React from 'react';
import Header from '@/components/Header';
import ActivityLogList from '@/components/ActivityLogList';
import { useNodes } from '@/lib/context/NodesContext';

export default function ActivityLogsPage() {
    const { nodes, lastUpdate, loading, refreshNodes } = useNodes();

    return (
        <main className="min-h-screen bg-black flex flex-col">
            <Header
                activePage="activity"
                nodeCount={nodes.length}
                lastUpdate={lastUpdate}
                loading={loading}
                onRefresh={refreshNodes}
            />

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-zinc-100" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                            Network Activity Logs
                        </h1>
                        <p className="text-zinc-500 mt-2">
                            Real-time feed of node status changes and credit earnings across the Xandeum network.
                        </p>
                    </div>

                    <ActivityLogList limit={100} showFilters={true} />
                </div>
            </div>
        </main>
    );
}
