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
  totalPurchases?: number; // Actual on-chain purchase count (from Mainnet purchase accounts)
}

interface NodesContextType {
  nodes: PNode[];
  activeNodes: PNode[];
  offlineNodes: PNode[];
  managers: Manager[];
  managerGlobalStats: any;
  networkStats: any;
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
  const [managers, setManagers] = useState<Manager[]>([]);
  const [managerGlobalStats, setManagerGlobalStats] = useState<any>(null);
  const [networkStats, setNetworkStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedNetwork, setSelectedNetworkState] = useState<string>('all');
  const [networkHydrated, setNetworkHydrated] = useState(false);

  // Hydrate network selection from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    if (typeof window !== 'undefined' && !networkHydrated) {
      const saved = localStorage.getItem('pglobe:network');
      if (saved && (saved === 'mainnet' || saved === 'devnet')) {
        setSelectedNetworkState(saved);
      }
      setNetworkHydrated(true);
    }
  }, [networkHydrated]);

  // Internal wrapper to persist network selection without reloading (for init/background)
  const setNetworkInternal = useCallback((network: string) => {
    setSelectedNetworkState(network);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pglobe:network', network);
    }
  }, []);

  // Public wrapper - triggers reload (for UI interaction)
  const setSelectedNetwork = useCallback((network: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pglobe:network', network);
      window.location.reload();
    }
  }, []);

  const [availableNetworks, setAvailableNetworks] = useState<NetworkConfig[]>([]);
  const [currentNetwork, setCurrentNetwork] = useState<NetworkConfig | null>(null);
  const [podCredits, setPodCredits] = useState<Record<string, number>>({});

  // Request deduplication - prevent multiple simultaneous requests
  const fetchingRef = useRef(false);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  // Track nodes length separately to avoid stale closure issues
  const nodesLengthRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    nodesLengthRef.current = nodes.length;
  }, [nodes.length]);

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
        managers?: Manager[];
        managerGlobalStats?: any;
        networkStats?: any;
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
      managers?: Manager[];
      managerGlobalStats?: any;
      networkStats?: any;
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
            managers: payload.managers,
            managerGlobalStats: payload.managerGlobalStats,
            networkStats: payload.networkStats,
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
        const networkQuery = params.toString();

        // Optimized: Fetch nodes, managers, and network stats in parallel
        const [nodesRes, managersRes, networkRes] = await Promise.all([
          fetch(`/api/pnodes?${networkQuery}`, { cache: 'no-store' }),
          fetch(`/api/managers?${networkQuery}`, { cache: 'no-store' }),
          fetch(`/api/network-stats?${networkQuery}`, { cache: 'no-store' })
        ]);

        const [nodesData, managersData, networkData] = await Promise.all([
          nodesRes.json(),
          managersRes.json(),
          networkRes.json()
        ]);

        if (nodesData.nodes && Array.isArray(nodesData.nodes)) {
          setNodes(nodesData.nodes);

          if (managersData.success) {
            setManagers(managersData.managers);
            setManagerGlobalStats(managersData.stats);
          }

          if (networkData.success) {
            setNetworkStats(networkData.stats);
          }

          setLastUpdate(new Date());
          setError(null);
          setLoading(false);

          if (nodesData.networks && Array.isArray(nodesData.networks)) {
            setAvailableNetworks(nodesData.networks);
          }
          if (nodesData.currentNetwork) {
            setCurrentNetwork(nodesData.currentNetwork);
            setNetworkInternal(nodesData.currentNetwork.id);
          }

          saveCache({
            nodes: nodesData.nodes,
            managers: managersData.managers,
            managerGlobalStats: managersData.stats,
            networkStats: networkData.stats,
            lastUpdate: new Date(),
            availableNetworks: nodesData.networks,
            currentNetwork: nodesData.currentNetwork,
          });
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
  }, [selectedNetwork, saveCache, setNetworkInternal]);

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
      if (cached?.nodes && cached.nodes.length > 0 && nodesLengthRef.current === 0) {
        setNodes(cached.nodes);
        if (cached.managers) setManagers(cached.managers);
        if (cached.managerGlobalStats) setManagerGlobalStats(cached.managerGlobalStats);
        if (cached.networkStats) setNetworkStats(cached.networkStats);
        setLastUpdate(cached.lastUpdate ? new Date(cached.lastUpdate) : null);
        if (cached.availableNetworks) setAvailableNetworks(cached.availableNetworks);
        if (cached.currentNetwork) {
          setCurrentNetwork(cached.currentNetwork);
          setNetworkInternal(cached.currentNetwork.id);
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
      if (cached.managers) setManagers(cached.managers);
      if (cached.managerGlobalStats) setManagerGlobalStats(cached.managerGlobalStats);
      if (cached.networkStats) setNetworkStats(cached.networkStats);
      setLastUpdate(cached.lastUpdate ? new Date(cached.lastUpdate) : null);
      if (cached.availableNetworks) setAvailableNetworks(cached.availableNetworks);
      if (cached.currentNetwork) {
        setCurrentNetwork(cached.currentNetwork);
        setNetworkInternal(cached.currentNetwork.id);
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
      setTimeout(() => {
        fetch('/api/refresh-nodes', { method: 'GET' })
          .then(res => {
            if (res.ok) {
              localStorage.setItem('lastServerRefresh', Date.now().toString());
              refreshNodes();
            }
          })
          .catch(() => { });
      }, 5000);
    }
  }, [loadCache, refreshNodes, setNetworkInternal]);

  // Passive polling: Fetch fresh data from MongoDB every 2 minutes
  // Reduced frequency to minimize flickering and improve performance
  // Only poll if we have nodes (don't poll if initial load failed)
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;

    // Only start polling if we have nodes
    if (nodesLengthRef.current === 0) return;

    const interval = setInterval(() => {
      refreshNodes();
    }, 120 * 1000); // 2 minutes - reduced from 1 minute to prevent excessive updates
    return () => {
      clearInterval(interval);
    };
  }, [refreshNodes]);

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

  // Fetch manager stats (purchase counts) - Merged into /api/pnodes response

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

  // Filter nodes by selected network
  // 'mainnet' shows nodes where network === 'mainnet' or 'both'
  // 'devnet' shows nodes where network === 'devnet' or 'both'
  // 'all' shows all nodes (for future use)
  const filteredByNetwork = useMemo(() => {
    if (selectedNetwork === 'all') return nodesWithCredits;

    return nodesWithCredits.filter(node => {
      const nodeNetwork = node.network || 'unknown';
      if (selectedNetwork === 'mainnet') {
        return nodeNetwork === 'mainnet' || nodeNetwork === 'both';
      }
      if (selectedNetwork === 'devnet') {
        return nodeNetwork === 'devnet' || nodeNetwork === 'unknown';
      }
      return true;
    });
  }, [nodesWithCredits, selectedNetwork]);

  // Separate active nodes (online + syncing) from offline nodes
  const { activeNodes, offlineNodes } = useMemo(() => {
    const active: PNode[] = [];
    const offline: PNode[] = [];

    filteredByNetwork.forEach(node => {
      if (node.status === 'online' || node.status === 'syncing') {
        active.push(node);
      } else {
        offline.push(node);
      }
    });

    return { activeNodes: active, offlineNodes: offline };
  }, [filteredByNetwork]);

  // Calculate dead managers (managers with only offline nodes)
  const deadManagerCount = useMemo(() => {
    return managers.filter(m => m.onlineCount === 0).length;
  }, [managers]);

  return (
    <NodesContext.Provider
      value={{
        nodes: filteredByNetwork,
        activeNodes,
        offlineNodes,
        managers,
        managerGlobalStats,
        networkStats,
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

