'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PNode } from '@/lib/types/pnode';
import { NetworkConfig } from '@/lib/server/network-config';

interface NodesContextType {
  nodes: PNode[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  selectedNetwork: string;
  setSelectedNetwork: (network: string) => void;
  availableNetworks: NetworkConfig[];
  currentNetwork: NetworkConfig | null;
  refreshNodes: () => Promise<void>;
}

const NodesContext = createContext<NodesContextType | undefined>(undefined);

export function NodesProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<PNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('devnet1');
  const [availableNetworks, setAvailableNetworks] = useState<NetworkConfig[]>([]);
  const [currentNetwork, setCurrentNetwork] = useState<NetworkConfig | null>(null);

  const cacheKey = (network: string) => `nodesCache:${network || 'default'}`;

  const loadCache = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(cacheKey(selectedNetwork));
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (!parsed?.nodes) return null;
      return parsed as {
        nodes: PNode[];
        lastUpdate?: string;
        availableNetworks?: NetworkConfig[];
        currentNetwork?: NetworkConfig | null;
      };
    } catch {
      return null;
    }
  }, [selectedNetwork]);

  const saveCache = useCallback(
    (payload: {
      nodes: PNode[];
      lastUpdate?: Date | null;
      availableNetworks?: NetworkConfig[];
      currentNetwork?: NetworkConfig | null;
    }) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(
          cacheKey(selectedNetwork),
          JSON.stringify({
            nodes: payload.nodes,
            lastUpdate: payload.lastUpdate ? payload.lastUpdate.toISOString() : null,
            availableNetworks: payload.availableNetworks,
            currentNetwork: payload.currentNetwork,
          })
        );
      } catch {
        // ignore cache write errors
      }
    },
    [selectedNetwork]
  );

  const refreshNodes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedNetwork) {
        params.set('network', selectedNetwork);
      }
      // Don't pass refresh=true - just get from MongoDB (fast path)
      const url = `/api/pnodes?${params.toString()}`;

      // Use fetch with timeout to prevent hanging
      let response: Response;
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null; // 5 second timeout
        
        response = await fetch(url, {
          ...(controller ? { signal: controller.signal } : {}),
          cache: 'no-store', // Always get fresh data
        });
        
        if (timeoutId) clearTimeout(timeoutId);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw new Error('Request timeout - data fetch took too long');
        }
        throw err;
      }
      
      const data = await response.json();

      if (data.nodes && Array.isArray(data.nodes)) {
        setNodes(data.nodes);
        setLastUpdate(new Date());
        setError(null);

        // Update network info
        if (data.networks && Array.isArray(data.networks)) {
          setAvailableNetworks(data.networks);
        }
        if (data.currentNetwork) {
          setCurrentNetwork(data.currentNetwork);
          setSelectedNetwork(data.currentNetwork.id);
        }

        // cache successful fetch
        saveCache({
          nodes: data.nodes,
          lastUpdate: new Date(),
          availableNetworks: data.networks,
          currentNetwork: data.currentNetwork,
        });
      } else {
        setError(data.error || 'Failed to fetch nodes');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      
      // Only set error if we don't have cached data
      const cached = loadCache();
      if (!cached?.nodes) {
        setError(errorMsg);
      }

      // fallback to cached data if available
      if (cached?.nodes) {
        setNodes(cached.nodes);
        setLastUpdate(cached.lastUpdate ? new Date(cached.lastUpdate) : null);
        if (cached.availableNetworks) setAvailableNetworks(cached.availableNetworks);
        if (cached.currentNetwork) setCurrentNetwork(cached.currentNetwork);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedNetwork, loadCache, saveCache]);

  // Initial fetch - load from cache instantly, then fetch in background
  useEffect(() => {
    // hydrate from cache first so UI has data immediately (no loading state)
    const cached = loadCache();
    if (cached?.nodes) {
      setNodes(cached.nodes);
      setLastUpdate(cached.lastUpdate ? new Date(cached.lastUpdate) : null);
      if (cached.availableNetworks) setAvailableNetworks(cached.availableNetworks);
      if (cached.currentNetwork) {
        setCurrentNetwork(cached.currentNetwork);
        setSelectedNetwork(cached.currentNetwork.id);
      }
      setLoading(false); // Set loading to false immediately so UI renders
    } else {
      // Only show loading if no cache available
      setLoading(true);
    }
    
    // Fetch fresh data in background (non-blocking)
    refreshNodes();
  }, [refreshNodes, loadCache]);

  // Passive polling: Fetch fresh data from MongoDB every minute (matches background refresh interval)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshNodes();
    }, 60 * 1000); // 1 minute
    return () => clearInterval(interval);
  }, [refreshNodes]);

  // Refresh when network changes
  useEffect(() => {
    if (selectedNetwork) {
      refreshNodes();
    }
  }, [selectedNetwork, refreshNodes]);

  return (
    <NodesContext.Provider
      value={{
        nodes,
        loading,
        error,
        lastUpdate,
        selectedNetwork,
        setSelectedNetwork,
        availableNetworks,
        currentNetwork,
        refreshNodes,
      }}
    >
      {children}
    </NodesContext.Provider>
  );
}

export function useNodes() {
  const context = useContext(NodesContext);
  if (context === undefined) {
    throw new Error('useNodes must be used within a NodesProvider');
  }
  return context;
}

