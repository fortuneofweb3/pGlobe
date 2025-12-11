/**
 * React hook to detect user's geographic region
 * Uses IP-based detection (no browser permission required)
 */

import { useState, useEffect } from 'react';
import { detectUserRegion, getUserLocationFromIP, type UserLocation } from '../utils/user-region';
import { LATENCY_REGIONS, type LatencyRegion } from '../utils/latency-regions';

export function useUserRegion(): {
  userRegion: LatencyRegion;
  userLocation: UserLocation | null;
  loading: boolean;
} {
  const [userRegion, setUserRegion] = useState<LatencyRegion>(LATENCY_REGIONS.find(r => r.id === 'us-east')!);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const detectRegion = async () => {
      try {
        // Use IP-based detection (no browser permission needed)
        const location: UserLocation | null = await getUserLocationFromIP();

        if (!mounted) return;

        setUserLocation(location);
        
        // Detect region from location
        const region = detectUserRegion(location);
        setUserRegion(region);
        
        setLoading(false);
      } catch (error) {
        if (!mounted) return;
        // Default to US East on error
        setUserRegion(LATENCY_REGIONS.find(r => r.id === 'us-east')!);
        setLoading(false);
      }
    };

    detectRegion();

    return () => {
      mounted = false;
    };
  }, []);

  return { userRegion, userLocation, loading };
}

