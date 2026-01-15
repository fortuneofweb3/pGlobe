'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { startProgress } from '@/lib/nprogress';
import { PNode } from '@/lib/types/pnode';
import { mergeDuplicateIPNodes } from '@/lib/utils/merge-duplicate-ips';
// Latency is server-side but adjusted for user's region
import {
  getLatencyContext,
  getLatencyColor,
  getLatencyTooltip,
} from '@/lib/utils/latency';
import { measureNodesLatency, getCachedNodesLatencies } from '@/lib/utils/client-latency';
import { fetchNodeBalance } from '@/lib/utils/balance';
import BalanceDisplay from './BalanceDisplay';
import { formatBytes, formatStorageBytes } from '@/lib/utils/storage';
import { formatRelativeTime } from '@/lib/utils/time';
import { getFlagForCountry } from '@/lib/utils/country-flags';
import { Check, X, ArrowUp, ArrowDown, Globe, Lock, Star, LayoutGrid, List, Network, Copy } from 'lucide-react';
import InfoTooltip from './InfoTooltip';
import CopyButton from './CopyButton';

import { useWatchlist } from '@/lib/context/WatchlistContext';
import { useNodes } from '@/lib/context/NodesContext';

// ============================================================================
// NodeCard Component
// ============================================================================

interface NodeCardProps {
  node: PNode;
  index: number;
  onNodeClick?: (node: PNode) => void;
  latency: number | null;
  watched: boolean;
  toggleWatchlist: (id: string) => void;
  router: any;
  selectedNetwork: string;
}

function NodeCard({ node, index, onNodeClick, latency, watched, toggleWatchlist, router, selectedNetwork }: NodeCardProps) {
  const [ipsExpanded, setIpsExpanded] = useState(false);

  // Extract unique IPs and Locations (moved from table loop)
  const { uniqueIps, uniqueLocations, displayNetwork, isRegistered, nodeId } = useMemo(() => {
    const uniqueIps: string[] = [];
    const uniqueLocations: { text: string; flag: string }[] = [];
    const seenIpSet = new Set<string>();
    const seenLocSet = new Set<string>();
    const nodeId = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '';

    if (node.isMerged && node.mergedIPs && node.mergedIPs.length > 0) {
      for (const entry of node.mergedIPs) {
        // IP Extraction
        const entryIp = entry.address?.split(':')[0];
        if (entryIp && !seenIpSet.has(entryIp)) {
          seenIpSet.add(entryIp);
          uniqueIps.push(entryIp);
        }

        // Location Extraction
        const city = entry.locationData?.city;
        const country = entry.locationData?.country;
        const locText = city
          ? `${city}${country ? `, ${country}` : ''}`
          : country || '';

        const locKey = locText.toLowerCase().trim();
        if (locText && !seenLocSet.has(locKey)) {
          seenLocSet.add(locKey);
          uniqueLocations.push({
            text: locText,
            flag: entry.locationData?.countryCode ? getFlagForCountry(entry.locationData.countryCode) : ''
          });
        }
      }
    } else {
      // Single node fallback
      const ip = node.address?.split(':')[0] || '—';
      uniqueIps.push(ip);
      const city = node.locationData?.city;
      const country = node.locationData?.country;
      const locText = city
        ? `${city}${country ? `, ${country}` : ''}`
        : country || node.location || '';
      uniqueLocations.push({
        text: locText,
        flag: node.locationData?.countryCode ? getFlagForCountry(node.locationData.countryCode) : ''
      });
    }

    const displayNetwork = selectedNetwork !== 'all'
      ? selectedNetwork
      : (node.network === 'both' ? 'mainnet' : (node.network || node.status === 'online' ? 'mainnet' : 'devnet')); // Fallback logic

    const isRegistered = node.isRegistered || (node.balance !== undefined && node.balance > 0);

    return { uniqueIps, uniqueLocations, displayNetwork, isRegistered, nodeId };
  }, [node, selectedNetwork]);

  const displayLocations = uniqueLocations.slice(0, 2); // Show max 2 locations summary

  // Format Public Key
  const formatPublicKey = (key: string | undefined) => {
    if (!key) return '';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  const status = node.status || 'offline';

  return (
    <div
      onClick={() => {
        if (onNodeClick) {
          onNodeClick(node);
        } else {
          if (nodeId) {
            startProgress();
            router.push(`/${encodeURIComponent(nodeId)}`);
          }
        }
      }}
      className="bg-gradient-to-br from-muted/80 to-muted/40 border border-border rounded-xl p-4 cursor-pointer hover:border-[#F0A741]/50 hover:shadow-lg hover:shadow-[#F0A741]/5 transition-all duration-200 group flex flex-col h-full"
      style={{ animationDelay: `${Math.min(index * 0.05, 1)}s` }} // Staggered animation handled by parent usually but inline here works if parent doesn't override
    >
      {/* Header: Watchlist, Pubkey, Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleWatchlist(nodeId);
            }}
            className={`p-1.5 rounded-lg transition-all ${watched ? 'bg-yellow-500/20' : 'text-foreground/30 hover:text-foreground/50 hover:bg-muted'}`}
            title={watched ? 'Remove from Watchlist' : 'Add to Watchlist'}
          >
            <Star className={`w-4 h-4 ${watched ? 'fill-[#FFD700] text-[#FFD700]' : ''}`} />
          </button>
          <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
            <span className="text-base font-mono font-bold text-[#F0A741] truncate" title={node.pubkey || node.publicKey}>
              {formatPublicKey(node.pubkey || node.publicKey) || '—'}
            </span>
            {(node.pubkey || node.publicKey) && (
              <CopyButton value={node.pubkey || node.publicKey || ''} className="scale-75 origin-left shrink-0" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {latency !== null && latency !== undefined && (
            <span
              className={`text-xs font-mono font-medium ${getLatencyColor(latency)}`}
              title={getLatencyTooltip(latency, null, null, null)}
            >
              {latency}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${status === 'online' ? 'bg-green-500/20 text-green-400' :
            status === 'syncing' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
            }`}>
            {status}
          </span>
        </div>
      </div>

      {/* Location - Single display with indicator */}
      <div className="mb-3 min-h-[24px]">
        {uniqueLocations.length > 0 ? (
          <div className="text-sm text-foreground/60 truncate flex items-center gap-1.5">
            {uniqueLocations[0].flag && <span className="text-base shrink-0">{uniqueLocations[0].flag}</span>}
            <span className="truncate">{uniqueLocations[0].text}</span>
            {uniqueLocations.length > 1 && (
              <span className="text-xs text-foreground/40">+ {uniqueLocations.length - 1} more</span>
            )}
          </div>
        ) : (
          <div className="text-sm text-foreground/30">Unknown location</div>
        )}
      </div>

      {/* IP Addresses - Simple display with indicator */}
      <div className="space-y-1.5 mb-4 flex-1">
        {/* Primary IP */}
        <div className="text-sm font-mono text-foreground/70 truncate bg-black/20 rounded px-2.5 py-1.5 flex items-center gap-2 border border-white/5">
          <Network className="w-3.5 h-3.5 shrink-0 text-foreground/40" />
          <span className="select-text cursor-text flex-1">{uniqueIps[0]}</span>
          {uniqueIps.length > 1 && (
            <span className="text-xs text-foreground/40">+ {uniqueIps.length - 1} more</span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 bg-black/30 rounded-lg p-3 mb-3">
        <div className="text-center">
          <div className="text-sm font-bold text-foreground whitespace-nowrap">
            {(() => {
              if (!node.uptime || node.uptime === 0) return '—';
              const days = Math.floor(node.uptime / 86400);
              const hours = Math.floor((node.uptime % 86400) / 3600);
              if (days > 0) return `${days}d`;
              if (hours > 0) return `${hours}h`;
              return `${Math.floor((node.uptime % 3600) / 60)}m`;
            })()}
          </div>
          <div className="text-[10px] text-foreground/50 uppercase tracking-wide">Uptime</div>
        </div>
        <div className="text-center border-x border-border/30">
          <div className="text-sm font-bold text-foreground whitespace-nowrap">
            {(() => {
              if (!node.storageCapacity) return '—';
              const gb = node.storageCapacity / (1024 * 1024 * 1024);
              if (gb >= 1000) return `${Math.round(gb / 1000)}TB`;
              if (gb >= 1) return `${Math.round(gb)}GB`;
              return `${Math.round(node.storageCapacity / (1024 * 1024))}MB`;
            })()}
          </div>
          <div className="text-[10px] text-foreground/50 uppercase tracking-wide">Storage</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-[#F0A741] whitespace-nowrap">
            {(() => {
              if (node.credits === undefined || node.credits === null) return '—';
              if (node.credits >= 1000000) return `${(node.credits / 1000000).toFixed(1)}M`;
              if (node.credits >= 1000) return `${(node.credits / 1000).toFixed(0)}K`;
              return node.credits.toString();
            })()}
          </div>
          <div className="text-[10px] text-foreground/50 uppercase tracking-wide">Credits</div>
        </div>
      </div>

      {/* Footer: Network + Registered */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30 mt-auto">
        <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${displayNetwork === 'mainnet' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
          'bg-purple-500/20 text-purple-400 border border-purple-500/30'
          }`}>
          {displayNetwork === 'mainnet' ? 'Mainnet' : 'Devnet'}
        </span>
        {isRegistered ? (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Check className="w-3.5 h-3.5" /> Registered
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-foreground/40">
            <X className="w-3.5 h-3.5" /> Unregistered
          </span>
        )}
      </div>
    </div>
  );
}

interface PNodeTableProps {
  nodes: PNode[];
  onNodeClick?: (node: PNode) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

/**
 * Abbreviates version string to show only the prefix before timestamp
 * Example: "0.7.3-trynet.20251210055354.57fd475" -> "0.7.3-"
 */
function abbreviateVersion(version: string): string {
  if (!version) return version;

  // Find the first dash followed by a dot (timestamp pattern)
  // Keep everything up to and including the dash
  const match = version.match(/^([^-]+-)/);
  if (match) {
    return match[1];
  }

  // If no pattern match, return as is
  return version;
}

/**
 * Version tooltip component with proper positioning and z-index
 */
function VersionTooltip({ version, abbreviated }: { version: string; abbreviated: string }) {
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const padding = 8;

    // Calculate center position
    let left = triggerRect.left + (triggerRect.width / 2);
    let top = triggerRect.top;
    let placement: 'top' | 'bottom' = 'top';

    // Estimate tooltip size (will be measured after render)
    const estimatedWidth = version.length * 7 + 16; // Rough estimate
    const estimatedHeight = 28;

    // Adjust horizontal position to prevent overflow
    if (left - estimatedWidth / 2 < padding) {
      left = estimatedWidth / 2 + padding;
    } else if (left + estimatedWidth / 2 > window.innerWidth - padding) {
      left = window.innerWidth - estimatedWidth / 2 - padding;
    }

    // Check if tooltip would go above viewport
    if (top - estimatedHeight - padding < 0) {
      // Show below instead
      top = triggerRect.bottom + padding;
      placement = 'bottom';
    } else {
      top = top - estimatedHeight - padding;
    }

    setTooltipPosition({ top, left, placement });

    // After tooltip renders, adjust position based on actual size
    setTimeout(() => {
      if (!tooltipRef.current || !triggerRef.current) return;

      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const newTriggerRect = triggerRef.current.getBoundingClientRect();

      let adjustedLeft = newTriggerRect.left + (newTriggerRect.width / 2);
      let adjustedTop = tooltipPosition?.top || top;
      let adjustedPlacement = placement;

      // Recalculate with actual tooltip size
      if (adjustedLeft - tooltipRect.width / 2 < padding) {
        adjustedLeft = tooltipRect.width / 2 + padding;
      } else if (adjustedLeft + tooltipRect.width / 2 > window.innerWidth - padding) {
        adjustedLeft = window.innerWidth - tooltipRect.width / 2 - padding;
      }

      if (adjustedPlacement === 'top' && adjustedTop - tooltipRect.height < 0) {
        adjustedTop = newTriggerRect.bottom + padding;
        adjustedPlacement = 'bottom';
      } else if (adjustedPlacement === 'top') {
        adjustedTop = newTriggerRect.top - tooltipRect.height - padding;
      }

      if (adjustedLeft !== left || adjustedTop !== top || adjustedPlacement !== placement) {
        setTooltipPosition({ top: adjustedTop, left: adjustedLeft, placement: adjustedPlacement });
      }
    }, 0);
  };

  const handleMouseLeave = () => {
    setTooltipPosition(null);
  };

  return (
    <span
      ref={triggerRef}
      className="text-xs text-foreground/70 cursor-help group relative inline-block"
      title={version}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {abbreviated}
      {tooltipPosition && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-xl pointer-events-none border border-gray-700 whitespace-nowrap"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {version}
          <div
            className={`absolute left-1/2 transform -translate-x-1/2 ${tooltipPosition.placement === 'top'
              ? 'top-full -mt-1'
              : 'bottom-full -mb-1'
              }`}
          >
            <div
              className={`border-4 border-transparent ${tooltipPosition.placement === 'top'
                ? 'border-t-gray-900'
                : 'border-b-gray-900'
                }`}
            />
          </div>
        </div>
      )}
    </span>
  );
}

export default function PNodeTable({ nodes, onNodeClick, sortBy, sortOrder, onSort }: PNodeTableProps) {
  const router = useRouter();
  const { isWatched, toggleWatchlist } = useWatchlist();
  const { selectedNetwork } = useNodes();



  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [balances, setBalances] = useState<Record<string, number | null>>({});
  const [fetchingBalances, setFetchingBalances] = useState<Set<string>>(new Set());
  // Load cached latencies immediately (synchronous)
  const [nodeLatencies, setNodeLatencies] = useState<Record<string, number | null>>(() => {
    return getCachedNodesLatencies(nodes);
  });
  const [measuringLatency, setMeasuringLatency] = useState(false);

  // Measure latency for uncached nodes after initial render (deferred for better UX)
  useEffect(() => {
    let mounted = true;

    const measureLatencies = async () => {
      // Load cached values first (already done in useState initializer)
      const cached = getCachedNodesLatencies(nodes);
      if (mounted) {
        setNodeLatencies(cached);
      }

      // Check if we need to measure any nodes
      const uncachedNodes = nodes.filter(node => cached[node.id] === undefined);
      if (uncachedNodes.length === 0) {
        // All nodes are cached, no need to measure
        return;
      }

      // Defer measurement until after initial render to avoid blocking UI
      const deferMeasurement = () => {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          requestIdleCallback(() => {
            if (!mounted) return;
            measureUncachedNodes();
          }, { timeout: 2000 });
        } else {
          setTimeout(() => {
            if (!mounted) return;
            measureUncachedNodes();
          }, 100);
        }
      };

      const measureUncachedNodes = async () => {
        setMeasuringLatency(true);
        try {
          // Measure latency for uncached nodes only - LOW CONCURRENCY to prevent memory spikes
          const newLatencies = await measureNodesLatency(nodes, 3, 3000);
          if (mounted) {
            // Merge new measurements with cached values
            setNodeLatencies(prev => ({ ...prev, ...newLatencies }));
          }
        } catch (error) {
          console.warn('[PNodeTable] Failed to measure node latencies:', error);
        } finally {
          if (mounted) {
            setMeasuringLatency(false);
          }
        }
      };

      if (nodes.length > 0) {
        deferMeasurement();
      }
    };

    measureLatencies();

    return () => {
      mounted = false;
    };
  }, [nodes.length]); // Re-measure when nodes change

  // Fetch balances for nodes with batching to reduce re-renders
  useEffect(() => {
    let mounted = true;
    const BATCH_SIZE = 50; // Update state after this many nodes
    const CONCURRENCY = 5; // Parallel requests

    const fetchBalances = async () => {
      // Filter out nodes that need fetching
      const nodesToFetch = nodes.filter(node =>
        balances[node.id] === undefined &&
        !fetchingBalances.has(node.id) &&
        (node.balance === undefined || node.balance === null) &&
        (node.pubkey || node.publicKey)
      );

      if (nodesToFetch.length === 0) return;

      // Mark as fetching
      setFetchingBalances(prev => {
        const next = new Set(prev);
        nodesToFetch.forEach(n => next.add(n.id));
        return next;
      });

      // Process in chunks to limit concurrency
      const chunks = [];
      const CONCURRENCY = 3; // Reduced concurrency to lower CPU pressure
      const BATCH_SIZE = 100; // Larger batch size to reduce re-renders

      for (let i = 0; i < nodesToFetch.length; i += CONCURRENCY) {
        chunks.push(nodesToFetch.slice(i, i + CONCURRENCY));
      }

      let newBalancesBuffer: Record<string, number | null> = {};
      let processedCount = 0;

      for (const chunk of chunks) {
        if (!mounted) break;

        const promises = chunk.map(async (node) => {
          try {
            const balance = await fetchNodeBalance(node);
            return { id: node.id, balance };
          } catch (error) {
            return { id: node.id, balance: null };
          }
        });

        const results = await Promise.all(promises);

        results.forEach(res => {
          if (res.balance !== null && res.balance !== undefined) {
            newBalancesBuffer[res.id] = res.balance;
          }
        });

        processedCount += chunk.length;

        // Update state periodically or at end
        if (Object.keys(newBalancesBuffer).length >= BATCH_SIZE || processedCount >= nodesToFetch.length) {
          if (mounted && Object.keys(newBalancesBuffer).length > 0) {
            const bufferToFlush = { ...newBalancesBuffer };
            newBalancesBuffer = {}; // Clear immediately

            setBalances(prev => ({
              ...prev,
              ...bufferToFlush
            }));
          }
        }

        // Minor delay between chunks to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (mounted) {
        setFetchingBalances(prev => {
          const next = new Set(prev);
          nodesToFetch.forEach(n => next.delete(n.id));
          return next;
        });
      }
    };

    fetchBalances();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]); // Only trigger when node count changes, internal logic handles already-fetched check


  const formatUptime = (uptime?: number) => {
    if (!uptime || uptime === 0) return null;
    // uptime is in SECONDS, format as duration
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${minutes}m`;
  };

  // Removed formatLastSeen - no longer displaying last seen column
  const _unusedFormatLastSeen = (lastSeen?: number) => {
    if (!lastSeen) return null;

    // lastSeen is in milliseconds
    const now = Date.now();
    const diff = now - lastSeen;

    // Convert to seconds, minutes, hours, days
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else if (seconds > 0) {
      return `${seconds}s ago`;
    } else {
      return 'Just now';
    }
  };

  // Helper to render empty state with tooltip
  const renderEmptyCell = (tooltip?: string) => {
    return (
      <span className="text-muted-foreground/30" title={tooltip}>
        —
      </span>
    );
  };

  const formatPublicKey = (key: string) => {
    if (!key) return null;
    const keyStr = typeof key === 'string' ? key : JSON.stringify(key);
    if (keyStr.length <= 16) return keyStr;
    return `${keyStr.slice(0, 6)}...${keyStr.slice(-6)}`;
  };

  const formatNodeId = (id: any, address?: string) => {
    if (address) {
      return address.split(':')[0];
    }
    if (id && typeof id === 'string') {
      const ipMatch = id.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch) {
        return ipMatch[1];
      }
      if (id.includes(':') && /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(id)) {
        return id.split(':')[0];
      }
    }
    if (typeof id === 'object') {
      return id.address?.split(':')[0] || id.ipAddress || '—';
    }
    return '—';
  };

  // Sorting Logic (Applied to nodes prop)
  const sortedNodes = useMemo(() => {
    if (!sortBy) return nodes;

    return [...nodes].sort((a, b) => {
      let aVal: any = a[sortBy as keyof PNode];
      let bVal: any = b[sortBy as keyof PNode];

      // Special handling for latency (from state)
      if (sortBy === 'latency') {
        aVal = nodeLatencies[a.id] || 999999;
        bVal = nodeLatencies[b.id] || 999999;
      }

      // Handle undefined/nulls
      if (aVal === undefined || aVal === null) aVal = (sortOrder === 'asc' ? 999999999 : -1);
      if (bVal === undefined || bVal === null) bVal = (sortOrder === 'asc' ? 999999999 : -1);

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [nodes, sortBy, sortOrder, nodeLatencies]);

  // Calculate stats for info banner
  const statsWithData = useMemo(() => {
    const withUptime = nodes.filter(n => n.uptime && n.uptime > 0).length;
    const withStorage = nodes.filter(n => (n.storageCapacity || 0) > 0).length;
    const withCPU = nodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).length;
    const withLatency = nodes.filter(n => nodeLatencies[n.id] !== null && nodeLatencies[n.id] !== undefined).length;

    // Approximate unique operators by looking at pubkey
    const pubkeys = new Set(nodes.map(n => n.pubkey || n.publicKey).filter(Boolean));

    return { withUptime, withStorage, withCPU, withLatency, total: nodes.length, uniqueOperators: pubkeys.size };
  }, [nodes, nodeLatencies]);

  return (
    <div className="card flex flex-col h-full overflow-hidden" style={{ padding: 0 }}>
      {/* Info Banner */}
      {statsWithData.total > 0 && (
        <div className="px-3 sm:px-4 py-2 bg-muted border-b border-border/60 text-xs text-muted-foreground flex-shrink-0 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground/60">Note: </span>
            <span className="hidden sm:inline">
              Running {statsWithData.total} nodes across {statsWithData.uniqueOperators} unique operators.
              Stats: {statsWithData.withUptime} uptime, {statsWithData.withStorage} storage
            </span>
            <span className="sm:hidden">{statsWithData.uniqueOperators} operators / {statsWithData.total} IPs</span>
          </div>
          <div className="flex items-center bg-card border border-border rounded-lg p-0.5 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-all ${viewMode === 'grid' ? 'bg-[#F0A741] text-black' : 'text-foreground/40 hover:text-foreground'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-all ${viewMode === 'table' ? 'bg-[#F0A741] text-black' : 'text-foreground/40 hover:text-foreground'}`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden min-h-0 -mt-px bg-card">
        {viewMode === 'grid' ? (
          /* Grid View */
          <div className="overflow-y-auto flex-1 min-h-0 p-3 sm:p-4">
            {sortedNodes.length === 0 ? (
              <div className="text-center py-12 text-foreground/50">No pNodes found</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedNodes.map((node, index) => {
                  const nodeId = node.pubkey || node.publicKey || node.id || '';
                  const latency = nodeLatencies[nodeId] || null;
                  const watched = isWatched(nodeId);

                  return (
                    <NodeCard
                      key={node.id || `node-${index}`}
                      node={node}
                      index={index}
                      onNodeClick={onNodeClick}
                      latency={latency}
                      watched={watched}
                      toggleWatchlist={toggleWatchlist}
                      router={router}
                      selectedNetwork={selectedNetwork}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 bg-card" style={{ margin: 0, padding: 0, marginTop: '-1px' }}>
            <table className="min-w-full border-collapse m-0 border-spacing-0" style={{ minWidth: '800px', borderCollapse: 'collapse', margin: 0, padding: 0 }}>
              <thead className="sticky top-0 z-10 bg-muted border-b border-border/60" style={{ margin: 0, padding: 0 }}>
                <tr>
                  <th className="px-2 py-4"></th>
                  <th className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                    Public Key
                  </th>
                  <th className="px-2 sm:px-3 py-4 text-center text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 sm:px-5 py-4 text-center text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                    Registered
                  </th>
                  {selectedNetwork === 'all' && (
                    <th className="px-3 sm:px-5 py-4 text-center text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Network
                    </th>
                  )}
                  {onSort ? (
                    <th
                      className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none group"
                      onClick={() => onSort('createdAt')}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1">
                          Joined
                        </span>
                        {sortBy === 'createdAt' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground" /> : <ArrowDown className="w-3 h-3 text-foreground" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </th>
                  ) : (
                    <th
                      className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider"
                    >
                      <span className="flex items-center gap-1 w-fit">
                        Joined
                      </span>
                    </th>
                  )}
                  <th className="px-3 sm:px-5 py-4 text-center text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                    Access
                  </th>
                  {onSort ? (
                    <>
                      <th
                        className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
                        onClick={() => onSort('uptime')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Uptime</span>
                          {sortBy === 'uptime' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground" /> : <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-foreground/30" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
                        onClick={() => onSort('storageCapacity')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Storage</span>
                          {sortBy === 'storageCapacity' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground" /> : <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-foreground/30" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
                        onClick={() => onSort?.('ramTotal')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>RAM</span>
                          {sortBy === 'ramTotal' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground" /> : <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-foreground/30" />
                          )}
                        </div>
                      </th>

                      <th
                        className="px-2 sm:px-4 py-3 text-right text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
                        onClick={() => onSort('latency')}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Latency</span>
                          {sortBy === 'latency' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground" /> : <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-foreground/30" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
                        onClick={() => onSort('cpuPercent')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>CPU</span>
                          {sortBy === 'cpuPercent' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground" /> : <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-foreground/30" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-2 sm:px-4 py-3 text-right text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
                        onClick={() => onSort('balance')}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Balance</span>
                          {sortBy === 'balance' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground" /> : <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-foreground/30" />
                          )}
                        </div>
                      </th>
                      {/* XAND Stake column hidden */}
                      {/* Boost column hidden */}
                      <th
                        className="px-2 sm:px-4 py-3 text-right text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
                        onClick={() => onSort('credits')}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Credits</span>
                          {sortBy === 'credits' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground" /> : <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-foreground/30" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
                        onClick={() => onSort('packetsReceived')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Packets Rx</span>
                          {sortBy === 'packetsReceived' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground" /> : <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-foreground/30" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
                        onClick={() => onSort('packetsSent')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Packets Tx</span>
                          {sortBy === 'packetsSent' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-foreground" /> : <ArrowDown className="w-3 h-3 text-foreground" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-foreground/30" />
                          )}
                        </div>
                      </th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        Version
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        Uptime
                      </th>
                      <th className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        Storage
                      </th>
                      <th className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        RAM
                      </th>

                      <th className="px-3 sm:px-5 py-4 text-right text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        Latency
                      </th>
                      <th className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        CPU
                      </th>
                      <th className="px-3 sm:px-5 py-4 text-right text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="px-3 sm:px-5 py-4 text-right text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        Packets Rx
                      </th>
                      <th className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        Packets Tx
                      </th>
                      <th className="px-3 sm:px-5 py-4 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                        Version
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sortedNodes.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="px-4 py-12 text-center text-foreground/50">
                      No pNodes found
                    </td>
                  </tr>
                ) : (
                  sortedNodes.map((node, index) => {
                    const isTrynet = node.version?.includes('-trynet') || false;
                    return (
                      <tr
                        key={node.id || `node-${index}`}
                        onClick={() => {
                          if (onNodeClick) {
                            onNodeClick(node);
                          } else {
                            const nodeId = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '';
                            if (nodeId) {
                              startProgress();
                              router.push(`/${encodeURIComponent(nodeId)}`);
                            }
                          }
                        }}
                        className={`
                        cursor-pointer border-b border-white/[0.03]
                        bg-white/[0.01] hover:bg-white/[0.04] 
                        transition-colors duration-200
                        ${node.isMerged ? 'bg-purple-500/[0.03]' : ''} 
                        ${isTrynet ? 'bg-orange-500/[0.02]' : ''}
                      `}
                      >
                        <td className="px-2 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleWatchlist(node.pubkey || node.publicKey || node.id)}
                            className={`p-1 rounded-full transition-all duration-200 ${isWatched(node.pubkey || node.publicKey || node.id)
                              ? 'bg-yellow-500/10'
                              : 'text-foreground/20 hover:text-foreground/40 hover:bg-muted'
                              }`}
                            title={isWatched(node.pubkey || node.publicKey || node.id) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                          >
                            <Star className={`w-4 h-4 ${isWatched(node.pubkey || node.publicKey || node.id) ? 'fill-[#FFD700] text-[#FFD700]' : ''}`} />
                          </button>
                        </td>
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap relative">


                          <div className="flex items-center gap-1.5 flex-nowrap">
                            <span
                              className="text-sm font-mono text-[#F0A741] font-bold"
                              title={node.pubkey || node.publicKey}
                            >
                              {formatPublicKey(node.pubkey || node.publicKey) || '—'}
                            </span>
                            {(node.pubkey || node.publicKey) && (
                              <CopyButton value={node.pubkey || node.publicKey || ''} className="shrink-0" />
                            )}
                            {node.isMerged && node.mergedIPs && node.mergedIPs.length > 1 && (
                              <span className="shrink-0 text-[10px] px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30 font-semibold">
                                {node.mergedIPs.length} IPs
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 py-5 whitespace-nowrap text-center">
                          {(() => {
                            const status = node.status;
                            if (status === 'online') {
                              return (
                                <span
                                  className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                                  title="Online"
                                />
                              );
                            } else if (status === 'syncing') {
                              return (
                                <span
                                  className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-orange-500 animate-pulse shadow-[0_0_6px_rgba(249,115,22,0.5)]"
                                  title="Syncing"
                                />
                              );
                            } else {
                              return (
                                <span
                                  className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-red-500/70"
                                  title="Offline"
                                />
                              );
                            }
                          })()}
                        </td>
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap text-center">
                          {(() => {
                            const balance = balances[node.id] !== undefined ? balances[node.id] : node.balance;
                            const isRegistered = balance !== undefined && balance !== null && balance > 0;
                            return (
                              <span className="inline-flex items-center justify-center">
                                {isRegistered ? (
                                  <Check className="w-4 h-4 text-foreground/60" strokeWidth={3} />
                                ) : (
                                  <X className="w-4 h-4 text-foreground/40" strokeWidth={3} />
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        {selectedNetwork === 'all' && (
                          <td className="px-2 sm:px-3 py-5 whitespace-nowrap text-center">
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-1 rounded text-[11px] font-semibold tracking-tight ${node.network === 'mainnet' || node.network === 'both'
                                ? 'bg-[#F0A741]/20 text-[#F0A741] border border-[#F0A741]/30'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}
                              title={node.network === 'mainnet' || node.network === 'both'
                                ? "Xandeum Mainnet"
                                : "Xandeum Devnet"
                              }
                            >
                              {node.network === 'mainnet' || node.network === 'both' ? 'Mainnet' : 'Devnet'}
                            </span>
                          </td>
                        )}
                        <td className="px-3 sm:px-5 py-4 whitespace-nowrap bg-card/20">
                          {node.createdAt ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-xs sm:text-sm text-foreground/80 border-b border-dotted border-foreground/30 cursor-help"
                                title={`First detected: ${new Date(node.createdAt).toLocaleString()}\nFirst detected by database. Actual network join time may vary.`}
                              >
                                {formatRelativeTime(node.createdAt)}
                              </span>
                            </div>
                          ) : (
                            renderEmptyCell()
                          )}
                        </td>
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap text-center">
                          {(() => {
                            const isPublic = node.isPublic === true;
                            const isPrivate = node.isPublic === false;

                            if (isPublic) {
                              return (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30"
                                  title="Public node - pRPC is publicly accessible"
                                >
                                  <Globe className="w-3 h-3" />
                                  <span className="hidden sm:inline">Public</span>
                                </span>
                              );
                            } else if (isPrivate) {
                              return (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                  title="Private node - pRPC is not publicly accessible"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span className="hidden sm:inline">Private</span>
                                </span>
                              );
                            }
                            return <span className="text-xs text-foreground/40">—</span>;
                          })()}
                        </td>
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap">
                          <span className="text-xs sm:text-sm text-foreground/80">
                            {formatUptime(node.uptime) || renderEmptyCell()}
                          </span>
                        </td>
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap">
                          {(() => {
                            const capacity = node.storageCapacity;
                            const hasCapacity = capacity !== undefined && capacity !== null;

                            if (hasCapacity) {
                              return (
                                <span className="text-xs sm:text-sm text-foreground/80">
                                  {formatStorageBytes(capacity)}
                                </span>
                              );
                            }
                            return renderEmptyCell();
                          })()}
                        </td>
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap">
                          {(() => {
                            const ramUsed = node.ramUsed;
                            const ramTotal = node.ramTotal;
                            const hasRAM = ramTotal !== undefined && ramTotal !== null;

                            if (hasRAM) {
                              const used = ramUsed !== undefined && ramUsed !== null ? formatStorageBytes(ramUsed) : '—';
                              const total = formatStorageBytes(ramTotal);
                              return (
                                <span className="text-xs sm:text-sm text-foreground/80">
                                  {used} / {total}
                                </span>
                              );
                            }
                            return renderEmptyCell();
                          })()}
                        </td>

                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap text-right">
                          {(() => {
                            // Don't show latency for nodes not seen in gossip (offline)
                            if (node.seenInGossip === false) {
                              return renderEmptyCell();
                            }

                            // Use per-node latency measurement
                            const nodeLatency = nodeLatencies[node.id];

                            if (nodeLatency !== null && nodeLatency !== undefined) {
                              const color = getLatencyColor(nodeLatency, null);
                              return (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span
                                    className={`text-xs sm:text-sm font-mono font-medium ${color}`}
                                    title={`Measured from your browser: ${nodeLatency.toFixed(0)}ms`}
                                  >
                                    {nodeLatency.toFixed(0)}ms
                                  </span>
                                </div>
                              );
                            }

                            if (measuringLatency) {
                              return <span className="text-muted-foreground/50 text-xs">Measuring...</span>;
                            }

                            return renderEmptyCell('pNode not reachable');
                          })()}
                        </td>
                        <td className="px-3 sm:px-5 py-4 whitespace-nowrap bg-card/20">
                          <span className="text-xs sm:text-sm text-foreground/80">
                            {node.cpuPercent !== undefined && node.cpuPercent !== null
                              ? `${node.cpuPercent.toFixed(1)}%`
                              : renderEmptyCell()}
                          </span>
                        </td>
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap text-right">
                          {(() => {
                            const balance = balances[node.id] !== undefined ? balances[node.id] : node.balance;
                            const isFetching = fetchingBalances.has(node.id);

                            if (isFetching) {
                              return (
                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="inline-block w-2.5 h-2.5 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
                                </span>
                              );
                            }

                            if (balance !== null && balance !== undefined) {
                              return (
                                <BalanceDisplay
                                  balance={balance}
                                  className="text-xs sm:text-sm font-mono text-foreground/80"
                                />
                              );
                            }

                            return renderEmptyCell();
                          })()}
                        </td>
                        {/* XAND Stake and Boost columns hidden - no placeholders needed */}
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap text-right">
                          {node.credits !== undefined && node.credits !== null ? (
                            <span className="text-xs sm:text-sm font-mono text-foreground/80">
                              {node.credits.toLocaleString()}
                            </span>
                          ) : (
                            renderEmptyCell()
                          )}
                        </td>
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap">
                          {node.packetsReceived !== undefined && node.packetsReceived !== null ? (
                            <span className="text-xs sm:text-sm font-mono text-foreground/80">
                              {node.packetsReceived.toLocaleString()}
                            </span>
                          ) : (
                            renderEmptyCell()
                          )}
                        </td>
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap">
                          {node.packetsSent !== undefined && node.packetsSent !== null ? (
                            <span className="text-xs sm:text-sm font-mono text-foreground/80">
                              {node.packetsSent.toLocaleString()}
                            </span>
                          ) : (
                            renderEmptyCell()
                          )}
                        </td>
                        <td className="px-3 sm:px-5 py-5 whitespace-nowrap">
                          {node.version ? (
                            <VersionTooltip version={node.version} abbreviated={abbreviateVersion(node.version)} />
                          ) : (
                            renderEmptyCell()
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody >
            </table >
          </div >
        )}
      </div >
    </div >
  );
}
