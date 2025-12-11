'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUserRegion } from '@/lib/hooks/useUserRegion';
import { LATENCY_REGIONS, type LatencyRegion } from '@/lib/utils/latency-regions';

interface UserRegionContextType {
  selectedRegion: LatencyRegion;
  detectedRegion: LatencyRegion;
  setSelectedRegion: (regionId: string) => void;
  loading: boolean;
}

const UserRegionContext = createContext<UserRegionContextType | undefined>(undefined);

export function UserRegionProvider({ children }: { children: ReactNode }) {
  const { userRegion, loading } = useUserRegion();
  
  // Initialize from localStorage or use detected region
  const [selectedRegionId, setSelectedRegionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('manualRegionSelection');
      if (stored && LATENCY_REGIONS.some(r => r.id === stored)) {
        return stored;
      }
    }
    return userRegion.id;
  });

  // Update selected region when detected region changes (but only if user hasn't manually changed it)
  useEffect(() => {
    if (!loading && userRegion.id) {
      const storedManualSelection = localStorage.getItem('manualRegionSelection');
      if (!storedManualSelection) {
        setSelectedRegionId(userRegion.id);
      }
    }
  }, [userRegion.id, loading]);

  const selectedRegion = LATENCY_REGIONS.find(r => r.id === selectedRegionId) || userRegion;

  const handleSetSelectedRegion = (regionId: string) => {
    setSelectedRegionId(regionId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('manualRegionSelection', regionId);
    }
  };

  return (
    <UserRegionContext.Provider
      value={{
        selectedRegion,
        detectedRegion: userRegion,
        setSelectedRegion: handleSetSelectedRegion,
        loading,
      }}
    >
      {children}
    </UserRegionContext.Provider>
  );
}

export function useSelectedRegion() {
  const context = useContext(UserRegionContext);
  if (context === undefined) {
    throw new Error('useSelectedRegion must be used within a UserRegionProvider');
  }
  return context;
}

