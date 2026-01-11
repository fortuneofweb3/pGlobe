
/**
 * Shared Xandeum API Utilities
 * Centralizes URLs and merging logic for Pod Credits APIs.
 */

export const XANDEUM_API = {
    MAINNET_CREDITS: 'https://podcredits.xandeum.network/api/mainnet-pod-credits',
    DEVNET_CREDITS: 'https://podcredits.xandeum.network/api/pods-credits',
};

export interface PodCredit {
    pod_id: string;
    credits: number;
}

export interface MergedCredits {
    creditsMap: Map<string, number>;
    mainnetPods: Map<string, number>;
    devnetPods: Map<string, number>;
}

/**
 * Fetch credits from both Mainnet and Devnet APIs and merge them.
 * Mainnet credits are prioritized for nodes present in both for the 'creditsMap'.
 */
export async function fetchMergedCredits(timeoutMs: number = 30000): Promise<MergedCredits> {
    const creditsMap = new Map<string, number>();
    const mainnetPods = new Map<string, number>();
    const devnetPods = new Map<string, number>();

    try {
        const [mainnetRes, devnetRes] = await Promise.allSettled([
            fetch(XANDEUM_API.MAINNET_CREDITS, { signal: AbortSignal.timeout(timeoutMs) }),
            fetch(XANDEUM_API.DEVNET_CREDITS, { signal: AbortSignal.timeout(timeoutMs) })
        ]);

        // Process Mainnet (Priority 1)
        if (mainnetRes.status === 'fulfilled' && mainnetRes.value.ok) {
            const data = await mainnetRes.value.json();
            if (data.status === 'success' && data.pods_credits) {
                for (const pod of data.pods_credits) {
                    if (pod.pod_id && typeof pod.credits === 'number') {
                        creditsMap.set(pod.pod_id, pod.credits);
                        mainnetPods.set(pod.pod_id, pod.credits);
                    }
                }
            }
        }

        // Process Devnet (Priority 2 - filling gaps)
        if (devnetRes.status === 'fulfilled' && devnetRes.value.ok) {
            const data = await devnetRes.value.json();
            if (data.status === 'success' && data.pods_credits) {
                for (const pod of data.pods_credits) {
                    if (pod.pod_id && typeof pod.credits === 'number') {
                        devnetPods.set(pod.pod_id, pod.credits);
                        if (!creditsMap.has(pod.pod_id)) {
                            creditsMap.set(pod.pod_id, pod.credits);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('[XandeumAPI] Error fetching merged credits:', err);
    }

    return { creditsMap, mainnetPods, devnetPods };
}
