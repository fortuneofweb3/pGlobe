/**
 * Get a single node by ID (pubkey) from MongoDB
 */

import { NextResponse } from 'next/server';
import { getNodeByPubkey } from '@/lib/server/mongodb-nodes';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const nodeId = params.id;
    
    if (!nodeId) {
      return NextResponse.json(
        { error: 'Node ID required' },
        { status: 400 }
      );
    }
    
    // Add timeout for MongoDB query
    const nodePromise = getNodeByPubkey(nodeId);
    const timeoutPromise = new Promise<PNode | null>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), 5000)
    );
    
    const node = await Promise.race([nodePromise, timeoutPromise]);
    
    if (!node) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ node });
  } catch (error: any) {
    console.error('[API] Error fetching node:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch node' },
      { status: 500 }
    );
  }
}

