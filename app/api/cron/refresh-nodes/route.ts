/**
 * External Cron Job endpoint for background node refresh
 * Runs every minute to keep MongoDB updated with latest gossip data
 * 
 * For Vercel Hobby plan: Use external cron service (cron-job.org, EasyCron, etc.)
 * See CRON_SETUP.md for setup instructions
 * 
 * This endpoint performs the same refresh logic as the background-refresh.ts module
 */

import { NextResponse } from 'next/server';
import { performRefresh } from '@/lib/server/background-refresh';

export async function GET(request: Request) {
  // Verify this is an authorized cron request
  // For external cron services, use CRON_SECRET env var for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is set, require authentication
  // This prevents unauthorized access to the refresh endpoint
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing CRON_SECRET' },
        { status: 401 }
      );
    }
  } else {
    // If no CRON_SECRET is set, log a warning but allow the request
    // This is useful for testing, but should be secured in production
    console.warn('[Cron] WARNING: CRON_SECRET not set - endpoint is publicly accessible');
  }

  try {
    console.log('[Cron] Starting background refresh...');
    
    // Call the exported refresh function
    await performRefresh();
    
    return NextResponse.json({
      success: true,
      message: 'Background refresh completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron] Error during background refresh:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Background refresh failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

