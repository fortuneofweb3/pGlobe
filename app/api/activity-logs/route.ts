import { NextResponse } from 'next/server';

const RENDER_API_URL = process.env.RENDER_API_URL || process.env.NEXT_PUBLIC_RENDER_API_URL;
const API_SECRET = process.env.API_SECRET;

export async function GET(request: Request) {
    if (!RENDER_API_URL) {
        return NextResponse.json({ error: 'Render API URL not configured', logs: [] }, { status: 500 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const pubkey = searchParams.get('pubkey');
        const countryCode = searchParams.get('countryCode');
        const type = searchParams.get('type');
        const limit = searchParams.get('limit') || '50';

        const queryParams = new URLSearchParams();
        if (pubkey) queryParams.set('pubkey', pubkey);
        if (countryCode) queryParams.set('countryCode', countryCode);
        if (type) queryParams.set('type', type);
        queryParams.set('limit', limit);

        const url = `${RENDER_API_URL}/api/activity-logs?${queryParams.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(API_SECRET ? { 'Authorization': `Bearer ${API_SECRET}` } : {}),
            },
            next: { revalidate: 0 } // Don't cache activity logs, they change frequently
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message, logs: [] }, { status: 500 });
    }
}
