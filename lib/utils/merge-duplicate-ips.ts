/**
 * Utility to merge pNodes that share either the same pubkey OR the same IP address.
 * Nodes that are linked through either identifier are clustered and merged.
 */

import { PNode, MergedIPEntry } from '@/lib/types/pnode';

/**
 * Creates a MergedIPEntry from a PNode for tracking individual stats
 */
function createMergedEntry(node: PNode): MergedIPEntry {
    return {
        address: node.address,
        pubkey: node.pubkey || node.publicKey,
        status: node.status,
        storageCapacity: node.storageCapacity,
        credits: node.credits,
        packetsReceived: node.packetsReceived,
        packetsSent: node.packetsSent,
        uptime: node.uptime,
        lastSeen: node.lastSeen,
        dataOperationsHandled: node.dataOperationsHandled,
        locationData: node.locationData,
    };
}

/**
 * Merge nodes that are logically the same (share Pubkey or IP)
 * 
 * @param nodes - Array of PNodes
 * @returns Array of merged PNodes
 */
export function mergeDuplicateIPNodes(nodes: PNode[]): PNode[] {
    if (!nodes || nodes.length === 0) return [];

    const clusters: PNode[][] = [];
    const visited = new Set<PNode>();

    // Unified identifier extraction
    const getIdentifiers = (node: PNode) => {
        const pk = node.pubkey || node.publicKey;
        const ip = node.address?.split(':')[0];
        return { pk, ip };
    };

    // Simple grouping by pubkey ONLY
    const pubkeyGroups = new Map<string, PNode[]>();

    for (const node of nodes) {
        const pk = node.pubkey || node.publicKey || '';
        if (!pk) {
            // Nodes without pubkey stay as individual entries
            clusters.push([node]);
            continue;
        }
        if (!pubkeyGroups.has(pk)) {
            pubkeyGroups.set(pk, []);
        }
        pubkeyGroups.get(pk)!.push(node);
    }

    // Convert groups to clusters
    for (const group of pubkeyGroups.values()) {
        clusters.push(group);
    }

    const mergedNodes: PNode[] = [];

    for (const cluster of clusters) {
        if (cluster.length === 1 && !cluster[0].isMerged) {
            mergedNodes.push(cluster[0]);
            continue;
        }

        // Sort by uptime descending to pick the primary node info (status, version etc)
        const sorted = [...cluster].sort((a, b) => (b.uptime || 0) - (a.uptime || 0));
        const primaryNode = sorted[0];

        // Unique IPs for display
        // Unique IPs for display - ensure we only have one entry per unique IP (no port)
        const uniqueEntries: MergedIPEntry[] = [];
        const seenIps = new Set<string>();

        // Sort cluster so we pick the best entry for each IP (online first, then lastSeen)
        const clusterSorted = [...cluster].sort((a, b) => {
            if (a.status === 'online' && b.status !== 'online') return -1;
            if (b.status === 'online' && a.status !== 'online') return 1;
            return (b.lastSeen || 0) - (a.lastSeen || 0);
        });

        for (const node of clusterSorted) {
            const address = node.address || '';
            const ip = address.split(':')[0];
            if (ip && !seenIps.has(ip)) {
                seenIps.add(ip);
                uniqueEntries.push(createMergedEntry(node));
            }
        }

        // Sum stats
        let totalStorage = 0;
        let totalCredits = 0;
        let totalPacketsRecv = 0;
        let totalPacketsSent = 0;
        let totalDataOps = 0;

        let hasStorage = false;
        let hasCredits = false;
        let hasPackets = false;
        let hasDataOps = false;

        for (const node of cluster) {
            if (node.storageCapacity != null) { totalStorage += node.storageCapacity; hasStorage = true; }
            if (node.credits != null) { totalCredits += node.credits; hasCredits = true; }
            if (node.packetsReceived != null) { totalPacketsRecv += node.packetsReceived; hasPackets = true; }
            if (node.packetsSent != null) { totalPacketsSent += node.packetsSent; hasPackets = true; }
            if (node.dataOperationsHandled != null) { totalDataOps += node.dataOperationsHandled; hasDataOps = true; }
        }

        const mergedNode: PNode = {
            ...primaryNode,
            storageCapacity: hasStorage ? totalStorage : primaryNode.storageCapacity,
            credits: hasCredits ? totalCredits : primaryNode.credits,
            packetsReceived: hasPackets ? totalPacketsRecv : primaryNode.packetsReceived,
            packetsSent: hasPackets ? totalPacketsSent : (primaryNode.packetsSent || 0),
            dataOperationsHandled: hasDataOps ? totalDataOps : primaryNode.dataOperationsHandled,
            mergedIPs: uniqueEntries,
            isMerged: true,
            // Consolidate unique full addresses for HISTORY tracking, but prioritize online ones
            previousAddresses: Array.from(new Set(
                clusterSorted.map(n => n.address).filter(Boolean) as string[]
            ))
        };

        mergedNodes.push(mergedNode);
    }

    return mergedNodes;
}
