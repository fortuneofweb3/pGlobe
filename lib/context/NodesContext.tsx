'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { PNode } from '@/lib/types/pnode';
import { NetworkConfig } from '@/lib/server/network-config';
import { mergeDuplicateIPNodes } from '@/lib/utils/merge-duplicate-ips';

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
  createdAt?: string; // When manager first joined (ISO date string)
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
  const fetchingRef = useRef<string | boolean>(false);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  // Track nodes length separately to avoid stale closure issues
  const nodesLengthRef = useRef(0);
  const selectedNetworkRef = useRef(selectedNetwork);

  // Update refs when state changes
  useEffect(() => {
    nodesLengthRef.current = nodes.length;
    selectedNetworkRef.current = selectedNetwork;
  }, [nodes, selectedNetwork]);

  const cacheKey = (network: string) => `pglobe:cache:${network}`;

  const loadCache = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(cacheKey(selectedNetwork));
      if (cached) return JSON.parse(cached);
    } catch {
      return null;
    }
    return null;
  }, [selectedNetwork]);

  const saveCache = useCallback(
    (payload: {
      nodes: PNode[];
      managers: Manager[];
      managerGlobalStats: any;
      networkStats: any;
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
    // Request deduplication - if already fetching THIS network, return the existing promise
    if (fetchingRef.current === selectedNetwork && fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }

    fetchingRef.current = selectedNetwork;
    const currentFetchNetwork = selectedNetwork;

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
          // RACE CONDITION CHECK: Only update state if this fetch is still relevant
          if (selectedNetworkRef.current !== currentFetchNetwork) {
            console.log(`[NodesContext] 🛑 Ignoring stale fetch for ${currentFetchNetwork} (current is ${selectedNetworkRef.current})`);
            return;
          }

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
        if (fetchingRef.current === selectedNetwork) {
          fetchingRef.current = false;
        }
        fetchPromiseRef.current = null;
      }
    })();

    fetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, [selectedNetwork, saveCache, setNetworkInternal]);

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    if (!networkHydrated) return;

    if (hasInitializedRef.current) {
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

    const triggerFetch = () => {
      refreshNodes().catch(() => { });
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => triggerFetch(), { timeout: 500 });
    } else {
      setTimeout(triggerFetch, 50);
    }

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
  }, [loadCache, refreshNodes, setNetworkInternal, networkHydrated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (nodesLengthRef.current === 0) return;

    const interval = setInterval(() => {
      refreshNodes();
    }, 120 * 1000);
    return () => clearInterval(interval);
  }, [refreshNodes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedNetwork && networkHydrated) {
      refreshNodes();
    }
  }, [selectedNetwork, refreshNodes, networkHydrated]);

  useEffect(() => {
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
    if (nodes.length > 0) fetchCredits();
  }, [nodes.length]);

  // Merge credits into nodes
  const nodesWithCredits = useMemo(() => {
    if (Object.keys(podCredits).length === 0) return nodes;
    return nodes.map(node => ({
      ...node,
      credits: podCredits[node.pubkey || node.publicKey || ''] ?? node.credits,
    }));
  }, [nodes, podCredits]);

  // Filter nodes by network
  const filteredByNetwork = useMemo(() => {
    if (selectedNetwork === 'all') return nodesWithCredits;
    return nodesWithCredits.filter(node => {
      const nodeNetwork = node.network || 'unknown';
      if (selectedNetwork === 'mainnet') return nodeNetwork === 'mainnet' || nodeNetwork === 'both';
      if (selectedNetwork === 'devnet') return nodeNetwork === 'devnet' || nodeNetwork === 'unknown';
      return true;
    });
  }, [nodesWithCredits, selectedNetwork]);

  // AGGRESSIVE MERGE: group by Pubkey or IP
  const mergedNodes = useMemo(() => {
    return mergeDuplicateIPNodes(filteredByNetwork);
  }, [filteredByNetwork]);

  const activeNodes = useMemo(() => {
    return mergedNodes.filter(n => n.status === 'online' || n.status === 'syncing');
  }, [mergedNodes]);

  const offlineNodes = useMemo(() => {
    return mergedNodes.filter(n => n.status === 'offline' || !n.status);
  }, [mergedNodes]);

  const filteredManagers = useMemo(() => {
    if (selectedNetwork === 'all') return managers;
    return managers.filter(m => {
      if (selectedNetwork === 'mainnet') return m.source === 'mainnet' || m.source === 'both';
      if (selectedNetwork === 'devnet') return m.source === 'devnet' || m.source === 'both' || m.source === 'unknown' as any;
      return true;
    });
  }, [managers, selectedNetwork]);

  return (
    <NodesContext.Provider
      value={{
        nodes: mergedNodes,
        activeNodes,
        offlineNodes,
        managers: filteredManagers,
        managerGlobalStats,
        networkStats,
        loading,
        error,
        lastUpdate,
        selectedNetwork,
        setSelectedNetwork,
        availableNetworks,
        currentNetwork,
        refreshNodes,
        managerCount: filteredManagers.length,
        offlineNodeCount: offlineNodes.length,
        deadManagerCount: filteredManagers.filter(m => m.onlineCount === 0).length,
      }}
    >
      {children}
    </NodesContext.Provider>
  );
}

export function useNodes() {
  const context = useContext(NodesContext);
  if (context === undefined) throw new Error('useNodes must be used within a NodesProvider');
  return context;
}
