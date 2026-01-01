import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ wallet: string }> }
) {
    try {
        const { wallet } = await params;

        if (!wallet) {
            return NextResponse.json({ error: 'Manager wallet required' }, { status: 400 });
        }

        const { getDb } = await import('@/lib/server/mongodb-nodes');
        const db = await getDb();

        // 1. Fetch from DB FIRST
        console.log(`[RewardsAPI] 📥 Fetching rewards history from DB for ${wallet}...`);
        const rewards = await db.collection('manager_rewards').findOne({ managerWallet: wallet });

        const history = rewards?.history || [];
        const lastUpdated = rewards?.updatedAt || new Date(0);
        const isStale = Date.now() - new Date(lastUpdated).getTime() > 30 * 60 * 1000; // 30 mins

        // 2. Trigger background sync if stale
        if (isStale) {
            setTimeout(async () => {
                try {
                    console.log(`[RewardsAPI] 🔄 Triggering background reward sync for ${wallet}`);
                    const { syncRewardsForManager } = await import('@/lib/server/sync-rewards');
                    await syncRewardsForManager(wallet);
                } catch (e) {
                    console.error('[RewardsAPI] ❌ Background sync failed:', e);
                }
            }, 0);
        }

        return NextResponse.json({
            success: true,
            managerWallet: wallet,
            history: history,
            lastUpdated
        });
    } catch (error) {
        console.error('Failed to fetch rewards:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
