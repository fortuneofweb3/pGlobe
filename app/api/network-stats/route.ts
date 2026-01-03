import { NextResponse } from 'next/server';
import { aggregateNetworkStats } from '@/lib/server/stats-helpers';
import { SimpleCache } from '@/lib/server/cache-utils';

const networkStatsCache = new SimpleCache<any>(1); // 1 minute cache

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const network = searchParams.get('network') || 'all';
        const cacheKey = `network_stats_${network}`;

        const cached = networkStatsCache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        const stats = await aggregateNetworkStats(network);

        const response = {
            success: true,
            stats,
        };

        networkStatsCache.set(cacheKey, response);
        return NextResponse.json(response);

    } catch (error) {
        console.error('[API/network-stats] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch network stats' },
            { status: 500 }
        );
    }
}
