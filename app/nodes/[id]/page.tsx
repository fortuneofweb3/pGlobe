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

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-[#F0A741] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-foreground/60 text-sm font-mono tracking-wider">REDIRECTING TO NEW URL...</p>
            </div>
        </div>
    );
}
