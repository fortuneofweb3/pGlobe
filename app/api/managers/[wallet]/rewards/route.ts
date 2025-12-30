
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/server/mongodb-nodes';
import { Connection, PublicKey } from '@solana/web3.js';

// We'll reuse the logic from enrich-managers but adapted for runtime
// Ideally this would be in a shared lib/server file
async function fetchVestingHistoryFromChain(walletStr: string) {
    const HELIUS_API_KEY = '2aca1e9b-9f51-44a0-938b-89dc6c23e9b4';
    const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const VESTING_PROGRAM = new PublicKey('HBZ5oXbFBFbr8Krt2oMU7ApHFeukdRS8Rye1f3T66vg5');

    const connection = new Connection(RPC_URL, 'confirmed');
    const managerWallet = new PublicKey(walletStr);

    const result = { totalVested: 0, schedule: [] as any[] };
    const grantAccounts = await connection.getProgramAccounts(VESTING_PROGRAM, {
        filters: [{ memcmp: { offset: 8, bytes: managerWallet.toBase58() } }]
    });

    for (const { account } of grantAccounts) {
        const data = account.data;
        const START = 104;
        const STRIDE = 80;

        for (let i = START; i <= data.length - STRIDE; i += STRIDE) {
            const amount = Number(data.readBigUInt64LE(i)) / 1e9;
            if (amount === 0) break;
            const tStart = Number(data.readBigUInt64LE(i + 56));
            const status = (tStart < Date.now() / 1000) ? 'Claimable' : 'Locked';

            result.schedule.push({
                amount,
                unlockDate: new Date(tStart * 1000),
                status,
                isGenesis: tStart === 0
            });
        }
    }
    // Total is calculated from vault balance in the main view, 
    // but here we just want the history.
    return result.schedule;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ wallet: string }> }
) {
    try {
        const { wallet } = await params;

        if (!wallet) {
            return NextResponse.json({ error: 'Manager wallet required' }, { status: 400 });
        }

        // Trigger REAL-TIME fetch
        let history = [];
        try {
            history = await fetchVestingHistoryFromChain(wallet);

            // Background update
            const db = await getDb();
            db.collection('manager_rewards').updateOne(
                { managerWallet: wallet },
                {
                    $set: {
                        managerWallet: wallet,
                        history: history,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
        } catch (e) {
            console.error('Failed real-time rewards fetch:', e);
            const db = await getDb();
            const rewards = await db.collection('manager_rewards').findOne({ managerWallet: wallet });
            history = rewards?.history || [];
        }

        return NextResponse.json({
            managerWallet: wallet,
            history: history
        });
    } catch (error) {
        console.error('Failed to fetch rewards:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
