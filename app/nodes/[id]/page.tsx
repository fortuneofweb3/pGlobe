'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useNodes } from '@/lib/context/NodesContext';

export default function NodeRedirect() {
    const params = useParams();
    const router = useRouter();
    const nodeId = params.id as string;
    const { nodes } = useNodes();

    useEffect(() => {
        if (!nodes || nodes.length === 0) return;

        // Try to find the node to get its pubkey for a cleaner URL, 
        // but if not found we can still redirect using the ID
        const node = nodes.find(n => n.id === nodeId || n.pubkey === nodeId || n.publicKey === nodeId);
        const targetId = node ? (node.pubkey || node.publicKey || node.id) : nodeId;

        router.replace(`/${encodeURIComponent(targetId)}`);
    }, [nodeId, nodes, router]);

    return null;
}
