/**
 * Public API v1: Get single node by ID/pubkey
 * GET /api/v1/nodes/:id
 * Proxies to backend API server
 */

import { NextResponse } from 'next/server';
import { withAPIAuth } from '@/lib/server/api-auth';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  return withAPIAuth(async (req: Request, { apiKey }) => {
    if (!RENDER_API_URL) {
      return NextResponse.json(
        { success: false, error: 'Backend API URL not configured. Set RENDER_API_URL in .env.local' },
        { status: 500 }
      );
    }

    try {
      const nodeId = id;
      
      console.log(`[VercelProxy] Proxying /api/v1/nodes/${nodeId} request to backend...`);
      
      const response = await fetch(`${RENDER_API_URL}/api/v1/nodes/${nodeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(data, { status: response.status });
      }

      console.log(`[VercelProxy] ✅ Returning node ${nodeId} from backend for /api/v1/nodes/${nodeId}`);
      return NextResponse.json(data);
    } catch (error: any) {
      console.error(`[VercelProxy] ❌ Failed to proxy /api/v1/nodes/${id} to backend:`, error);
      return NextResponse.json(
        { success: false, error: error?.message || 'Failed to fetch node' },
        { status: 500 }
      );
    }
  })(request);
}

