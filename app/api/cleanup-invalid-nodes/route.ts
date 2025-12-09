/**
 * API endpoint to manually trigger cleanup of nodes with invalid pubkeys
 */

import { NextResponse } from 'next/server';
import { cleanupInvalidNodes } from '@/lib/server/mongodb-nodes';

export async function POST(request: Request) {
  try {
    const deletedCount = await cleanupInvalidNodes();
    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} nodes with invalid pubkeys`,
    });
  } catch (error: any) {
    console.error('[API] Error cleaning up invalid nodes:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to cleanup invalid nodes',
      },
      { status: 500 }
    );
  }
}

