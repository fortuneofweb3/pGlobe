/**
 * Get a single node by ID (pubkey) from MongoDB
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
    
    return NextResponse.json({ node });
  } catch (error: any) {
    console.error('[API] Error fetching node:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch node' },
      { status: 500 }
    );
  }
}

