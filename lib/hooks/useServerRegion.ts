/**
 * React hook to get server's geographic region
 * Fetches server location from API
 */

import { useState, useEffect } from 'react';
import { LATENCY_REGIONS, type LatencyRegion } from '../utils/latency-regions';
import { type UserLocation } from '../utils/user-region';

export function useServerRegion(): {
  serverRegion: LatencyRegion | null;
  serverLocation: UserLocation | null;
  loading: boolean;
} {
  const [serverRegion, setServerRegion] = useState<LatencyRegion | null>(null);
  const [serverLocation, setServerLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchServerLocation = async () => {
      try {
        const response = await fetch('/api/server-location', {
          signal: AbortSignal.timeout(15000),
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch server location');
        }
        
        const data = await response.json();
        
        if (!mounted) return;
        
        setServerLocation(data.location);
        
        // Find region by ID
        const region = LATENCY_REGIONS.find(r => r.id === data.region.id);
        if (region) {
          setServerRegion(region);
        }
        
        setLoading(false);
      } catch (error) {
        if (!mounted) return;
        setLoading(false);
      }
    };

    fetchServerLocation();

    return () => {
      mounted = false;
    };
  }, []);

  return { serverRegion, serverLocation, loading };
}

