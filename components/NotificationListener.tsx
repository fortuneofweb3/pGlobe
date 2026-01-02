'use client';

import { useEffect, useRef } from 'react';
import { useNodes } from '@/lib/context/NodesContext';
import { useWatchlist } from '@/lib/context/WatchlistContext';
import { useNotifications } from '@/lib/context/NotificationContext';
import { PNode } from '@/lib/types/pnode';

export default function NotificationListener() {
    const { nodes } = useNodes();
    const { watchlist } = useWatchlist();
    const { addNotification } = useNotifications();

    // Keep track of previous node statuses to detect changes
    const prevNodesRef = useRef<Record<string, 'online' | 'offline' | 'syncing'>>({});

    useEffect(() => {
        if (nodes.length === 0) return;

        const watchedNodes = nodes.filter(n => watchlist.includes(n.pubkey || n.publicKey || ''));

        watchedNodes.forEach(node => {
            const pubkey = node.pubkey || node.publicKey || '';
            const prevStatus = prevNodesRef.current[pubkey];
            const currentStatus = node.status;

            if (prevStatus && prevStatus !== currentStatus) {
                // Status changed!
                if (currentStatus === 'offline') {
                    addNotification({
                        type: 'error',
                        title: 'Node Offline',
                        message: `Your watched node ${pubkey.slice(0, 8)}... is now offline!`,
                        duration: 10000,
                    });
                } else if (currentStatus === 'online' && (prevStatus === 'offline' || prevStatus === 'syncing')) {
                    addNotification({
                        type: 'success',
                        title: 'Node Online',
                        message: `Node ${pubkey.slice(0, 8)}... is back online.`,
                        duration: 5000,
                    });
                }
            }

            // Update ref
            prevNodesRef.current[pubkey] = currentStatus || 'offline';
        });

        // Also update ref for non-watched nodes so we have the baseline if they are added to watchlist later
        // or just to keep track of everyone. Better to only track watched nodes to save memory.
    }, [nodes, watchlist, addNotification]);

    return null;
}
