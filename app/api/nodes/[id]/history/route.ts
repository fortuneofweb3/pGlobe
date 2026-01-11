/**
 * Get node history by ID - Proxies to Render backend
 */

import { NextResponse } from 'next/server';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
): Promise<NextResponse> {
    if (!RENDER_API_URL) {
        return NextResponse.json(
            { error: 'Render API URL not configured' },
            { status: 500 }
        );
    }

    try {
        const nodeId = params.id;
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || '7d';
        const address = searchParams.get('address');

        if (!nodeId) {
            return NextResponse.json(
                { error: 'Node ID required' },
                { status: 400 }
            );
        }

        console.log(`[VercelProxy] Proxying node history request for ${nodeId} (Address: ${address || 'any'}) to Render...`);

        const queryParams = new URLSearchParams();
        queryParams.set('period', period);
        if (address) queryParams.set('address', address);

        const response = await fetch(`${RENDER_API_URL}/api/nodes/${nodeId}/history?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
            },
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[VercelProxy] ❌ Failed to proxy node history to Render:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch node history' },
            { status: 500 }
        );
    }
}
