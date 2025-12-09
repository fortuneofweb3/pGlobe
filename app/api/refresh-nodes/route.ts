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
  // Allow client-side calls from same origin (browser requests)
  // Only require auth for external cron services (they send Authorization header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const referer = request.headers.get('referer');
  const origin = request.headers.get('origin');
  
  // Check if this is a client-side call (from browser) vs external cron service
  const isClientSideCall = !authHeader && (referer || origin);
  
  // If CRON_SECRET is set AND this is NOT a client-side call, require auth
  // This allows:
  // - Client-side calls from browser (no auth needed)
  // - External cron services (must provide CRON_SECRET)
  if (cronSecret && !isClientSideCall) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Refresh] Unauthorized external request - missing or invalid CRON_SECRET');
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
    
    // Return immediately and run refresh in background (non-blocking)
    // This prevents the client from hanging
    performRefresh()
      .then(() => {
        console.log('[Refresh] ✅ Background refresh completed successfully');
      })
      .catch((err) => {
        console.error('[Refresh] ❌ Background refresh failed:', err);
      });
    
    // Return immediately - don't wait for refresh to complete
    return NextResponse.json({
      success: true,
      message: 'Background refresh started',
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

