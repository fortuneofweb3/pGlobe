/**
 * Historical data endpoint - returns empty for now (MongoDB doesn't store history)
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const summary = searchParams.get('summary') === 'true';
  
  // Historical data is not stored in MongoDB (only static data)
  // Return empty data
  if (summary) {
    return NextResponse.json({
      totalDataPoints: 0,
      dateRange: { start: Date.now(), end: Date.now() },
      avgNodesOverTime: 0,
      avgUptimeOverTime: 0,
    });
  }
  
  return NextResponse.json({
    data: [],
    message: 'Historical data not stored in MongoDB',
  });
}

