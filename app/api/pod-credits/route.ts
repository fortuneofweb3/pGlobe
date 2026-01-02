import { NextResponse } from 'next/server';

/**
 * Pod Credits API Route
 * 
 * Fetches reputation credits from the Xandeum pod credits API.
 * 
 * Credit Calculation Rules:
 * - +1 credit per heartbeat request responded to (~30 second intervals)
 * - -100 credits for failing to respond to a data request
 * - Credits reset monthly (tracked via creditsResetMonth field in database)
 */
const MAINNET_CREDITS_API = 'https://podcredits.xandeum.network/api/mainnet-pod-credits';
const DEVNET_CREDITS_API = 'https://podcredits.xandeum.network/api/pods-credits';

export async function GET() {
  try {
    const [mainnetRes, devnetRes] = await Promise.all([
      fetch(MAINNET_CREDITS_API, { next: { revalidate: 60 } }),
      fetch(DEVNET_CREDITS_API, { next: { revalidate: 60 } })
    ]);

    const [mainnetData, devnetData] = await Promise.all([
      mainnetRes.ok ? mainnetRes.json() : null,
      devnetRes.ok ? devnetRes.json() : null
    ]);

    // Convert arrays to map for easy lookup by pod_id (pubkey)
    const creditsMap: Record<string, number> = {};
    let totalMainnet = 0;
    let totalDevnet = 0;

    if (mainnetData?.status === 'success') {
      for (const pod of mainnetData.pods_credits) {
        creditsMap[pod.pod_id] = pod.credits;
      }
      totalMainnet = mainnetData.pods_credits.length;
    }

    if (devnetData?.status === 'success') {
      for (const pod of devnetData.pods_credits) {
        // If pod exists in both, mainnet credits are usually updated more frequently or prioritized
        // but for a simple proxy, we can just let devnet fill in the gaps or overwrite if appropriate.
        // Given our prioritization logic, if it's in mainnet, it's mainnet.
        if (!creditsMap[pod.pod_id]) {
          creditsMap[pod.pod_id] = pod.credits;
        }
      }
      totalDevnet = devnetData.pods_credits.length;
    }

    console.log(`[PodCredits] Merged credits: ${totalMainnet} mainnet, ${totalDevnet} devnet`);

    return NextResponse.json({
      credits: creditsMap,
      totalPods: Object.keys(creditsMap).length,
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

