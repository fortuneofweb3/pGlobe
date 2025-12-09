'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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
  
  // Request deduplication - prevent multiple simultaneous requests
  const fetchingRef = useRef(false);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);

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
    // Request deduplication - if already fetching, return the existing promise
    if (fetchingRef.current && fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    fetchingRef.current = true;
    
    const fetchPromise = (async () => {
      try {
        const params = new URLSearchParams();
        if (selectedNetwork) {
          params.set('network', selectedNetwork);
        }
        // Don't pass refresh=true - just get from MongoDB (fast path)
        const url = `/api/pnodes?${params.toString()}`;

        // Use fetch with shorter timeout for faster failure
        let response: Response;
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 3000) : null; // 3 second timeout (faster)
          
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
          // Update UI immediately with new data
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

          // Cache successful fetch (async, don't block)
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

        // Fallback to cached data if available (don't overwrite if we already have nodes)
        if (cached?.nodes && nodes.length === 0) {
          setNodes(cached.nodes);
          setLastUpdate(cached.lastUpdate ? new Date(cached.lastUpdate) : null);
          if (cached.availableNetworks) setAvailableNetworks(cached.availableNetworks);
          if (cached.currentNetwork) setCurrentNetwork(cached.currentNetwork);
        }
      } finally {
        fetchingRef.current = false;
        fetchPromiseRef.current = null;
        setLoading(false);
      }
    })();

    fetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, [selectedNetwork, loadCache, saveCache, nodes.length]);

  // Initial fetch - load from cache instantly, then fetch in background
  useEffect(() => {
    // Hydrate from cache FIRST - show existing data immediately (no loading state)
    const cached = loadCache();
    if (cached?.nodes && cached.nodes.length > 0) {
      // Show cached data immediately - UI updates instantly
      setNodes(cached.nodes);
      setLastUpdate(cached.lastUpdate ? new Date(cached.lastUpdate) : null);
      if (cached.availableNetworks) setAvailableNetworks(cached.availableNetworks);
      if (cached.currentNetwork) {
        setCurrentNetwork(cached.currentNetwork);
        setSelectedNetwork(cached.currentNetwork.id);
      }
      setLoading(false); // Set loading to false immediately so UI renders with cached data
    } else {
      // Only show loading if no cache available
      setLoading(true);
    }
    
    // Fetch fresh data in background (non-blocking) - will update UI when ready
    // Use requestAnimationFrame to ensure UI renders cached data first
    requestAnimationFrame(() => {
      refreshNodes();
    });
    
    // Trigger server-side refresh if it hasn't been refreshed in the last minute
    // This keeps MongoDB updated even without external cron
    const lastRefreshTime = localStorage.getItem('lastServerRefresh');
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    if (!lastRefreshTime || parseInt(lastRefreshTime) < oneMinuteAgo) {
      // Trigger refresh in background (don't wait for response)
      // Use a small delay to not block initial render
      setTimeout(() => {
        fetch('/api/refresh-nodes', { method: 'GET' })
          .then(() => {
            localStorage.setItem('lastServerRefresh', now.toString());
          })
          .catch((err) => {
            // Silently fail - not critical
            console.debug('[NodesContext] Server refresh failed:', err);
          });
      }, 500); // Small delay to let UI render first
    }
  }, [refreshNodes, loadCache]);

  // Passive polling: Fetch fresh data from MongoDB every minute (matches background refresh interval)
  // Only poll if we have nodes (don't poll if initial load failed)
  useEffect(() => {
    if (nodes.length === 0) return; // Don't poll if no nodes loaded
    
    const interval = setInterval(() => {
      // Fetch in background - UI already has data, this just updates it
      refreshNodes();
    }, 60 * 1000); // 1 minute
    return () => clearInterval(interval);
  }, [refreshNodes, nodes.length]);

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

