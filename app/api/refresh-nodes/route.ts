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
  // For external cron services, use CRON_SECRET env var for security
  // For client-side calls (Vercel Hobby), allow without auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is set, require authentication (for external cron services)
  // If not set, allow client-side calls (for Vercel Hobby plan)
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Refresh] Unauthorized request - missing or invalid CRON_SECRET');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing CRON_SECRET' },
        { status: 401 }
      );
    }
  }

  try {
    console.log('[Refresh] Starting background refresh...');
    console.log('[Refresh] Environment:', {
      vercel: !!process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV,
      hasMongoUri: !!process.env.MONGODB_URI,
      nodeEnv: process.env.NODE_ENV,
    });
    
    // Call the exported refresh function
    await performRefresh();
    
    console.log('[Refresh] ✅ Background refresh completed successfully');
    return NextResponse.json({
      success: true,
      message: 'Background refresh completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Refresh] ❌ Error during background refresh:', error);
    console.error('[Refresh] Error stack:', error?.stack);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Background refresh failed',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

