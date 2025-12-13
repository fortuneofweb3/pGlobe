import { NextResponse } from 'next/server';

const POD_CREDITS_API = 'https://podcredits.xandeum.network/api/pods-credits';

export async function GET() {
  try {
    const response = await fetch(POD_CREDITS_API, {
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pod credits: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('Pod credits API returned non-success status');
    }

    // Convert array to map for easy lookup by pod_id (pubkey)
    const creditsMap: Record<string, number> = {};
    for (const pod of data.pods_credits) {
      // Store with pod_id as key (case-sensitive match)
      creditsMap[pod.pod_id] = pod.credits;
    }

    console.log('[PodCredits] Fetched credits for', data.pods_credits.length, 'pods');
    console.log('[PodCredits] Sample pod_ids:', data.pods_credits.slice(0, 3).map((p: { pod_id: string; credits: number }) => p.pod_id));

    return NextResponse.json({
      credits: creditsMap,
      totalPods: data.pods_credits.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[PodCredits] Error fetching credits:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch pod credits' },
      { status: 500 }
    );
  }
}

