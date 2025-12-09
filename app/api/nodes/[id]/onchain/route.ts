/**
 * Get node on-chain data from MongoDB
 */

import { NextResponse } from 'next/server';
import { getNodeByPubkey } from '@/lib/server/mongodb-nodes';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;
    const node = await getNodeByPubkey(nodeId);
    
    if (!node) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        pubkey: node.pubkey || node.publicKey,
        balance: node.balance,
        isRegistered: node.isRegistered || false,
        managerPDA: node.managerPDA,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch on-chain data' },
      { status: 500 }
    );
  }
}
