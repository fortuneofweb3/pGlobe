'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
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
  const [podCredits, setPodCredits] = useState<Record<string, number>>({});
  
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
      console.log('[NodesContext] Already fetching, returning existing promise');
      return fetchPromiseRef.current;
    }

    fetchingRef.current = true;
    // DON'T set loading to true during refresh - keep showing existing data
    console.log('[NodesContext] 🔄 Manual refresh triggered - Starting fetch...');
    
    const fetchPromise = (async () => {
      try {
        const params = new URLSearchParams();
        if (selectedNetwork) {
          params.set('network', selectedNetwork);
        }
        // Don't pass refresh=true - just get from MongoDB (fast path)
        const url = `/api/pnodes?${params.toString()}`;
        console.log('[NodesContext] Fetching from:', url);

        // Use fetch with reasonable timeout for API server response
        let response: Response;
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 30000) : null; // 30 second timeout for slower connections
          
          console.log('[NodesContext] Making fetch request...');
          response = await fetch(url, {
            ...(controller ? { signal: controller.signal } : {}),
            cache: 'no-store', // Always get fresh data
          });
          
          if (timeoutId) clearTimeout(timeoutId);
          console.log('[NodesContext] Fetch response status:', response.status);
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            throw new Error('Request timeout - data fetch took too long');
          }
          throw err;
        }
        
        const data = await response.json();
        console.log('[NodesContext] Received data, nodes count:', data.nodes?.length || 0);

        if (data.nodes && Array.isArray(data.nodes)) {
          console.log('[NodesContext] ✅ Setting nodes:', data.nodes.length);
          // Only update if we got valid data (prevents wrong data flash)
          if (data.nodes.length > 0) {
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
          }
        } else {
          const errorMsg = data.error || 'Failed to fetch nodes';
          console.error('[NodesContext] API returned error:', errorMsg);
          // Don't set error on refresh - just log it
          console.warn('[NodesContext] Keeping existing data after error');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'An error occurred';
        console.error('[NodesContext] Fetch error:', errorMsg, err);
        
        // On refresh error, keep existing data and just log the error
        // Don't fallback to cache - we already have current nodes displayed
        console.warn('[NodesContext] Refresh failed, keeping existing nodes:', nodes.length);
      } finally {
        fetchingRef.current = false;
        fetchPromiseRef.current = null;
        // Don't set loading to false here - we never set it to true for refresh
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
    
    // STEP 1: Fetch from MongoDB FIRST (fast, non-blocking)
    // This ensures we show data immediately, even if refresh is slow
    // Defer fetch until after initial render to avoid blocking navigation
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        refreshNodes().catch(() => {
          // Silently fail - cached data is already shown
        });
      }, { timeout: 500 });
    } else {
      setTimeout(() => {
        refreshNodes().catch(() => {
          // Silently fail - cached data is already shown
        });
      }, 50);
    }
    
    // STEP 2: Trigger server-side refresh AFTER fetching MongoDB data
    // This keeps MongoDB updated in the background
    const lastRefreshTime = localStorage.getItem('lastServerRefresh');
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    if (!lastRefreshTime || parseInt(lastRefreshTime) < oneMinuteAgo) {
      // Defer background refresh to avoid blocking navigation
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        requestIdleCallback(() => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          fetch('/api/refresh-nodes', { 
            method: 'GET',
            signal: controller.signal,
          })
            .then(async (res) => {
              clearTimeout(timeoutId);
              const data = await res.json();
              if (res.ok) {
                localStorage.setItem('lastServerRefresh', Date.now().toString());
                refreshNodes();
              }
            })
            .catch(() => {
              clearTimeout(timeoutId);
            });
        }, { timeout: 5000 });
      } else {
        setTimeout(() => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          fetch('/api/refresh-nodes', { 
            method: 'GET',
            signal: controller.signal,
          })
            .then(async (res) => {
              clearTimeout(timeoutId);
              const data = await res.json();
              if (res.ok) {
                localStorage.setItem('lastServerRefresh', Date.now().toString());
                refreshNodes();
              }
            })
            .catch(() => {
              clearTimeout(timeoutId);
            });
        }, 2000);
      }
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

  // Fetch pod credits when nodes are loaded
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const response = await fetch('/api/pod-credits');
        const data = await response.json();
        if (data.credits) {
          console.log('[NodesContext] Fetched pod credits:', Object.keys(data.credits).length, 'pods');
          setPodCredits(data.credits);
        }
      } catch (error) {
        console.error('[NodesContext] Failed to fetch pod credits:', error);
      }
    };
    
    if (nodes.length > 0) {
      fetchCredits();
    }
  }, [nodes.length]);

  // Merge credits into nodes before providing to context
  const nodesWithCredits = useMemo(() => {
    if (Object.keys(podCredits).length === 0) {
      // No credits data yet, return nodes as-is
      return nodes;
    }
    
    return nodes.map(node => {
      // Try multiple ways to match the pod_id
      // The pod_id from API is a Solana public key (base58)
      const pubkey = node.pubkey || node.publicKey || '';
      
      // Direct match
      let credits = podCredits[pubkey];
      
      // If no match, try case-insensitive (though Solana keys are case-sensitive)
      if (!credits && pubkey) {
        const matchingKey = Object.keys(podCredits).find(key => 
          key.toLowerCase() === pubkey.toLowerCase()
        );
        if (matchingKey) {
          credits = podCredits[matchingKey];
        }
      }
      
      // Fallback to existing credits if no match found
      return {
        ...node,
        credits: credits ?? node.credits,
      };
    });
  }, [nodes, podCredits]);

  return (
    <NodesContext.Provider
      value={{
        nodes: nodesWithCredits,
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

