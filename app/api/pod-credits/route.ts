import { NextResponse } from 'next/server';
import { fetchMergedCredits } from '@/lib/server/xandeum-api';

export async function GET() {
  try {
    const { creditsMap, mainnetPods, devnetPods } = await fetchMergedCredits();

    // Convert Map to Record for JSON response
    const creditsRecord: Record<string, number> = {};
    creditsMap.forEach((credits, pod_id) => {
      creditsRecord[pod_id] = credits;
    });

    console.log(`[PodCredits] Merged credits via utility: ${mainnetPods.size} mainnet, ${devnetPods.size} devnet`);

    return NextResponse.json({
      credits: creditsRecord,
      totalPods: creditsMap.size,
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

