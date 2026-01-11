import { NextResponse } from 'next/server';
import { SimpleCache } from '@/lib/server/cache-utils';
import { aggregateManagers } from '@/lib/server/stats-helpers';

const managerListCache = new SimpleCache<any>(2); // 2 minute cache

export const dynamic = 'force-dynamic';

export interface Manager {
    wallet: string;
    associatedWallets: string[];

    registeredNodes: number;
    purchasedNodes: number;
    totalPurchases?: number;

    knownNodes: {
        pubkey: string;
        status: string;
        version?: string;
        credits?: number;
        location?: string;
        role?: 'buyer' | 'registrar';
        xandStake?: number;
        vestingStake?: number;
        eraLabel?: string;
        eraBoost?: number;
    }[];

    totalCredits: number;
    totalXandStake: number;
    vestingStake: number;
    onlineCount: number;
    source: 'mainnet' | 'devnet' | 'both';
    createdAt?: string; // When manager was first discovered (ISO date string)
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const network = searchParams.get('network') || 'all';
        const cacheKey = `managers_${network}`;

        const cached = managerListCache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        const { managers, stats } = await aggregateManagers(network);

        const response = {
            success: true,
            stats,
            managers,
            timestamp: Date.now(),
            network
        };

        managerListCache.set(cacheKey, response);
        return NextResponse.json(response);

    } catch (error) {
        console.error('[API/managers] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch managers' },
            { status: 500 }
        );
    }
}
