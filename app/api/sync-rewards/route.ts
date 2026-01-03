import { NextResponse } from 'next/server';
import { syncRewardsForAllManagers } from '@/lib/server/sync-rewards';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        console.log('[SyncRewards] Manually triggered reward sync...');

        // This takes time, so we might want to return early or just wait if it's not too many managers
        // For now, let's wait as it's more direct for the user
        const result = await syncRewardsForAllManagers();

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `Synced rewards for ${result.count} managers`,
                count: result.count
            });
        } else {
            return NextResponse.json({
                success: false,
                error: result.error
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('[SyncRewards] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
