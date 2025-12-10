/**
 * Public API v1: Documentation
 * GET /api/v1/docs
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.vercel.app';
  
  const docs = {
    version: '1.0.0',
    baseUrl: `${baseUrl}/api/v1`,
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer YOUR_API_KEY',
      queryParam: '?api_key=YOUR_API_KEY',
      note: 'API key can be provided via Authorization header (recommended) or api_key query parameter',
    },
    rateLimits: {
      default: '100 requests per minute',
      headers: {
        'X-RateLimit-Limit': 'Maximum requests allowed',
        'X-RateLimit-Remaining': 'Remaining requests in current window',
        'X-RateLimit-Reset': 'Unix timestamp when rate limit resets',
      },
    },
    endpoints: [
      {
        path: '/nodes',
        method: 'GET',
        description: 'List all nodes with filtering and pagination',
        parameters: {
          status: 'Filter by status: online, offline, syncing',
          version: 'Filter by version',
          country: 'Filter by country code',
          min_uptime: 'Minimum uptime in seconds',
          min_storage: 'Minimum storage capacity in bytes',
          sort_by: 'Sort field (uptime, cpuPercent, storageCapacity, etc.)',
          sort_order: 'Sort order: asc or desc',
          page: 'Page number (default: 1)',
          limit: 'Results per page (default: 100, max: 1000)',
        },
        example: `${baseUrl}/api/v1/nodes?status=online&sort_by=uptime&limit=50`,
      },
      {
        path: '/nodes/:id',
        method: 'GET',
        description: 'Get detailed information about a specific node',
        parameters: {
          id: 'Node pubkey or ID',
        },
        example: `${baseUrl}/api/v1/nodes/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`,
      },
      {
        path: '/network/health',
        method: 'GET',
        description: 'Get network-wide health metrics',
        example: `${baseUrl}/api/v1/network/health`,
      },
      {
        path: '/network/stats',
        method: 'GET',
        description: 'Get aggregated network statistics',
        example: `${baseUrl}/api/v1/network/stats`,
      },
      {
        path: '/analytics/trends',
        method: 'GET',
        description: 'Get trend analytics grouped by version, country, or status',
        parameters: {
          metric: 'Metric to analyze: uptime, storage, latency, cpu',
          group_by: 'Group by: version, country, status',
        },
        example: `${baseUrl}/api/v1/analytics/trends?metric=uptime&group_by=version`,
      },
    ],
    responseFormat: {
      success: true,
      data: {},
      meta: {},
      error: 'Error message (only on failure)',
    },
    errorCodes: {
      401: 'Unauthorized - Invalid or missing API key',
      404: 'Not Found - Resource does not exist',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error',
    },
    gettingStarted: {
      step1: 'Get an API key (contact administrator or use default dev key)',
      step2: `Make a test request: curl -H "Authorization: Bearer YOUR_API_KEY" ${baseUrl}/api/v1/network/health`,
      step3: 'Check rate limit headers in response',
    },
  };

  return NextResponse.json(docs);
}

