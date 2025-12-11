/**
 * Get balance from MongoDB
 */

import { NextResponse } from 'next/server';
import { getNodeByPubkey } from '@/lib/server/mongodb-nodes';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pubkey = searchParams.get('pubkey');
    
    if (!pubkey) {
      return NextResponse.json(
        { error: 'pubkey parameter required' },
        { status: 400 }
      );
    }
    
    const node = await getNodeByPubkey(pubkey);
    
    if (!node) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }
    
    // Return null if balance is not set (don't default to 0)
    // This prevents overwriting existing balances with 0
    return NextResponse.json({
      balance: node.balance !== undefined && node.balance !== null ? node.balance : null,
      isRegistered: node.isRegistered || false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}

