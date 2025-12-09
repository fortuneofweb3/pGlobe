/**
 * Background refresh endpoint for node data
 * 
 * This is a regular API endpoint (NOT a cron job) that can be called:
 * 1. By client-side code when users visit (automatic)
 * 2. By external cron services if desired (optional)
 * 3. Manually via browser/curl
 * 
 * For Vercel Hobby plan: Client-side triggers work automatically.
 * For guaranteed updates: Use external cron service (see CRON_SETUP.md)
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

