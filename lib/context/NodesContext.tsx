'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { PNode } from '@/lib/types/pnode';
import { NetworkConfig } from '@/lib/server/network-config';

export interface Manager {
  wallet: string;
  registeredNodes: number;
  purchasedNodes: number;
  knownNodes: {
    pubkey: string;
    status: string;
    credits?: number;
    role?: 'buyer' | 'registrar';
    xandStake?: number;
    daoStake?: number;
    vestingStake?: number;
  }[];
  totalCredits: number;
  totalXandStake: number;
  daoStake: number;
  vestingStake: number;
  onlineCount: number;
  source: 'mainnet' | 'devnet' | 'both';
}

interface NodesContextType {
  nodes: PNode[];
  activeNodes: PNode[];
  offlineNodes: PNode[];
  managers: Manager[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  selectedNetwork: string;
  setSelectedNetwork: (network: string) => void;
  availableNetworks: NetworkConfig[];
  currentNetwork: NetworkConfig | null;
  refreshNodes: () => Promise<void>;
  managerCount: number;
  offlineNodeCount: number;
  deadManagerCount: number;
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

      // Validate cache age - invalidate if older than 5 minutes
      if (parsed.lastUpdate) {
        const cacheAge = Date.now() - new Date(parsed.lastUpdate).getTime();
        const maxAge = 5 * 60 * 1000; // 5 minutes
        if (cacheAge > maxAge) {
          localStorage.removeItem(cacheKey(selectedNetwork));
          return null;
        }
      }

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

    // Trigger background refresh on Render to update DB (fire-and-forget)
    const triggerBackgroundRefresh = () => {
      fetch('/api/refresh-nodes', { method: 'GET' })
        .then(res => res.json())
        .catch(() => { });
    };

    triggerBackgroundRefresh();

    const fetchPromise = (async () => {
      try {
        const params = new URLSearchParams();
        if (selectedNetwork) {
          params.set('network', selectedNetwork);
        }
        const url = `/api/pnodes?${params.toString()}`;

        let response: Response;
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timeoutId = controller ? setTimeout(() => controller.abort(), 30000) : null;

          response = await fetch(url, {
            ...(controller ? { signal: controller.signal } : {}),
            cache: 'no-store',
          });

          if (timeoutId) clearTimeout(timeoutId);
        } catch (err) {
          const error = err as Error;
          if (error?.name === 'AbortError') {
            throw new Error('Request timeout - data fetch took too long');
          }
          throw error;
        }

        const data = await response.json();

        if (data.nodes && Array.isArray(data.nodes)) {
          if (data.nodes.length > 0 || nodes.length === 0) {
            setNodes(data.nodes);
            setLastUpdate(new Date());
            setError(null);
            setLoading(false);

            if (data.networks && Array.isArray(data.networks)) {
              setAvailableNetworks(data.networks);
            }
            if (data.currentNetwork) {
              setCurrentNetwork(data.currentNetwork);
              setSelectedNetwork(data.currentNetwork.id);
            }

            saveCache({
              nodes: data.nodes,
              lastUpdate: new Date(),
              availableNetworks: data.networks,
              currentNetwork: data.currentNetwork,
            });
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        setLoading(false);
      } finally {
        fetchingRef.current = false;
        fetchPromiseRef.current = null;
      }
    })();

    fetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, [selectedNetwork, nodes.length, saveCache]);

  const hasInitializedRef = useRef(false);

  // Initial fetch - load from cache instantly, then fetch in background
  // Only run once on mount, not on every page switch
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    if (hasInitializedRef.current) {
      // Already initialized, just load cache if needed
      const cached = loadCache();
      if (cached?.nodes && cached.nodes.length > 0 && nodes.length === 0) {
        setNodes(cached.nodes);
        setLastUpdate(cached.lastUpdate ? new Date(cached.lastUpdate) : null);
        if (cached.availableNetworks) setAvailableNetworks(cached.availableNetworks);
        if (cached.currentNetwork) {
          setCurrentNetwork(cached.currentNetwork);
          setSelectedNetwork(cached.currentNetwork.id);
        }
        setLoading(false);
      }
      return;
    }

    hasInitializedRef.current = true;

    // Hydrate from cache FIRST - show existing data immediately (no loading state)
    const cached = loadCache();
    if (cached?.nodes && cached.nodes.length > 0) {
      setNodes(cached.nodes);
      setLastUpdate(cached.lastUpdate ? new Date(cached.lastUpdate) : null);
      if (cached.availableNetworks) setAvailableNetworks(cached.availableNetworks);
      if (cached.currentNetwork) {
        setCurrentNetwork(cached.currentNetwork);
        setSelectedNetwork(cached.currentNetwork.id);
      }
      setLoading(false);
    } else {
      setLoading(true);
    }

    // STEP 1: ALWAYS fetch fresh data - don't rely on cache alone
    // This ensures we show current data, even if cache exists
    // Defer fetch until after initial render to avoid blocking navigation
    const triggerFetch = () => {
      refreshNodes().catch(err => {
        console.error('[NodesContext] Failed to refresh nodes:', err);
        // If we have cached data, keep showing it, but log that it might be stale
        if (cached?.nodes && cached.nodes.length > 0) {
          console.warn('[NodesContext] Using cached data - may be stale');
        }
      });
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => triggerFetch(), { timeout: 500 });
    } else {
      setTimeout(triggerFetch, 50);
    }

    // STEP 2: Trigger server-side refresh AFTER fetching MongoDB data
    // This keeps MongoDB updated in the background
    const lastRefreshTime = localStorage.getItem('lastServerRefresh');
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    if (!lastRefreshTime || parseInt(lastRefreshTime) < oneMinuteAgo) {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          fetch('/api/refresh-nodes', {
            method: 'GET',
            signal: controller.signal,
          })
            .then(async (res) => {
              clearTimeout(timeoutId);
              if (res.ok) {
                localStorage.setItem('lastServerRefresh', Date.now().toString());
                refreshNodes();
              }
            })
            .catch((err) => {
              clearTimeout(timeoutId);
              // Only log if it's not a connection error (expected when backend isn't running)
              if (err?.name !== 'AbortError' && err?.message !== 'fetch failed') {
                console.warn('[NodesContext] ⚠️  Background refresh trigger failed:', {
                  success: false,
                  error: err?.message || 'fetch failed',
                  timestamp: new Date().toISOString(),
                });
              }
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
              if (res.ok) {
                localStorage.setItem('lastServerRefresh', Date.now().toString());
                refreshNodes();
              }
            })
            .catch((err) => {
              clearTimeout(timeoutId);
              console.error('[NodesContext] ❌ Background refresh error:', err);
            });
        }, 2000);
      }
    }
  }, [loadCache, nodes.length, refreshNodes]);

  // Passive polling: Fetch fresh data from MongoDB every 2 minutes
  // Reduced frequency to minimize flickering and improve performance
  // Only poll if we have nodes (don't poll if initial load failed)
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // Only start polling if we have nodes
    if (nodes.length === 0) return;

    const interval = setInterval(() => {
      refreshNodes();
    }, 120 * 1000); // 2 minutes - reduced from 1 minute to prevent excessive updates
    return () => {
      clearInterval(interval);
    };
  }, [nodes.length, refreshNodes]);

  // Refresh when network changes
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    if (selectedNetwork) {
      refreshNodes();
    }
  }, [selectedNetwork, refreshNodes]);

  // Fetch pod credits when nodes are loaded
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    const fetchCredits = async () => {
      try {
        const response = await fetch('/api/pod-credits');
        const data = await response.json();
        if (data.credits) {
          setPodCredits(data.credits);
        }
      } catch { }
    };

    if (nodes.length > 0) {
      fetchCredits();
    }
  }, [nodes.length]);

  // Merge credits into nodes before providing to context
  const nodesWithCredits = useMemo(() => {
    if (Object.keys(podCredits).length === 0) return nodes;
    return nodes.map(node => {
      const pubkey = node.pubkey || node.publicKey || '';
      const credits = podCredits[pubkey];
      return {
        ...node,
        credits: credits ?? node.credits,
      };
    });
  }, [nodes, podCredits]);

  // Separate active nodes (online + syncing) from offline nodes
  const { activeNodes, offlineNodes } = useMemo(() => {
    const active: PNode[] = [];
    const offline: PNode[] = [];

    nodesWithCredits.forEach(node => {
      if (node.status === 'online' || node.status === 'syncing') {
        active.push(node);
      } else {
        offline.push(node);
      }
    });

    return { activeNodes: active, offlineNodes: offline };
  }, [nodesWithCredits]);

  // Derive managers from active nodes only (exclude offline nodes)
  const managers = useMemo(() => {
    const managerMap = new Map<string, Manager>();

    const getOrCreateManager = (wallet: string): Manager => {
      if (!managerMap.has(wallet)) {
        managerMap.set(wallet, {
          wallet,
          registeredNodes: 0,
          purchasedNodes: 0,
          knownNodes: [],
          totalCredits: 0,
          totalXandStake: 0,
          daoStake: 0,
          vestingStake: 0,
          onlineCount: 0,
          source: 'devnet'
        });
      }
      return managerMap.get(wallet)!;
    };

    nodesWithCredits.forEach(node => {
      let primaryWallet: string | undefined;
      let role: 'buyer' | 'registrar' = 'registrar';

      if (node.managerWallet) {
        primaryWallet = node.managerWallet;
        role = 'buyer';
      } else if (node.registrarWallet) {
        primaryWallet = node.registrarWallet;
        role = 'registrar';
      }

      if (!primaryWallet) return;

      const manager = getOrCreateManager(primaryWallet);

      // Update Source
      if (role === 'buyer') {
        if (manager.source === 'devnet') manager.source = 'both';
        else if (manager.source !== 'both') manager.source = 'mainnet';
      } else {
        if (manager.source === 'mainnet') manager.source = 'both';
      }

      // Add Node Info
      const nodePubkey = node.pubkey || node.publicKey || '';
      if (!manager.knownNodes.some(kn => kn.pubkey === nodePubkey)) {
        manager.knownNodes.push({
          pubkey: nodePubkey,
          status: node.status || 'offline',
          credits: node.credits,
          role,
          xandStake: node.xandStake,
          daoStake: node.daoStake,
          vestingStake: node.vestingStake
        });

        manager.registeredNodes++;
        if (role === 'buyer') {
          manager.purchasedNodes++;
        }

        manager.totalCredits += node.credits || 0;
        if (node.xandStake && node.xandStake > manager.totalXandStake) {
          manager.totalXandStake = node.xandStake;
        }
        if (node.daoStake && node.daoStake > manager.daoStake) {
          manager.daoStake = node.daoStake;
        }
        if (node.vestingStake && node.vestingStake > manager.vestingStake) {
          manager.vestingStake = node.vestingStake;
        }
        if (node.status === 'online' || node.status === 'syncing') manager.onlineCount++;
      }
    });

    return Array.from(managerMap.values())
      .sort((a, b) => b.totalXandStake - a.totalXandStake || b.registeredNodes - a.registeredNodes);
  }, [nodesWithCredits]);

  // Calculate dead managers (managers with only offline nodes)
  const deadManagerCount = useMemo(() => {
    return managers.filter(m => m.onlineCount === 0).length;
  }, [managers]);

  return (
    <NodesContext.Provider
      value={{
        nodes: nodesWithCredits,
        activeNodes,
        offlineNodes,
        managers,
        managerCount: managers.length,
        offlineNodeCount: offlineNodes.length,
        deadManagerCount,
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

