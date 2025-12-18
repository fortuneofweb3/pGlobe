'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PNode } from '@/lib/types/pnode';
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
import { Check, X, ArrowUp, ArrowDown } from 'lucide-react';

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
            className={`absolute left-1/2 transform -translate-x-1/2 ${
              tooltipPosition.placement === 'top' 
                ? 'top-full -mt-1' 
                : 'bottom-full -mb-1'
            }`}
          >
            <div 
              className={`border-4 border-transparent ${
                tooltipPosition.placement === 'top'
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
          // Measure latency for uncached nodes only
          const newLatencies = await measureNodesLatency(nodes, 10, 2000);
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

  // Fetch balances for nodes (only if not already set)
  useEffect(() => {
    const fetchBalances = async () => {
      for (const node of nodes) {
        // Skip if already fetched or currently fetching
        if (balances[node.id] !== undefined || fetchingBalances.has(node.id)) continue;
        // Skip if node already has balance data (don't refetch unnecessarily)
        if (node.balance !== undefined && node.balance !== null) continue;
        // Skip if no pubkey
        if (!node.pubkey && !node.publicKey) continue;

        setFetchingBalances(prev => new Set(prev).add(node.id));
        
        try {
          const balance = await fetchNodeBalance(node);
          // Only update if we got a valid balance (not null)
          // Don't overwrite existing balances with null or 0
          if (balance !== null && balance !== undefined) {
            setBalances(prev => ({
              ...prev,
              [node.id]: balance,
            }));
          }
        } catch (error) {
          // Don't set balance to null on error - preserve existing value
          console.warn(`Failed to fetch balance for node ${node.id}:`, error);
        } finally {
          setFetchingBalances(prev => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
        }
      }
    };

    fetchBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return null;
    if (bytes === 0) return '0.00 GB';
    return formatStorageBytes(bytes);
  };

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
    return `${keyStr.slice(0, 8)}...${keyStr.slice(-8)}`;
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

  // Detect duplicate pubkeys
  const pubkeyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    nodes.forEach((node) => {
      const pubkey = node.pubkey || node.publicKey;
      if (pubkey) {
        counts[pubkey] = (counts[pubkey] || 0) + 1;
      }
    });
    return counts;
  }, [nodes]);

  const isDuplicate = (node: PNode) => {
    const pubkey = node.pubkey || node.publicKey;
    return pubkey ? (pubkeyCounts[pubkey] || 0) > 1 : false;
  };

  // Calculate stats for info banner
  const statsWithData = useMemo(() => {
    const withUptime = nodes.filter(n => n.uptime && n.uptime > 0).length;
    const withStorage = nodes.filter(n => n.storageCapacity && n.storageCapacity > 0).length;
    const withCPU = nodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).length;
    const withLatency = nodes.filter(n => {
      // Check for client-side latency measurement
      return nodeLatencies[n.id] !== null && nodeLatencies[n.id] !== undefined;
    }).length;
    
    return { withUptime, withStorage, withCPU, withLatency, total: nodes.length };
  }, [nodes]);

  return (
    <div className="flex flex-col h-full bg-card/30 border border-border/60 rounded-lg overflow-hidden">
      {/* Info Banner */}
      {statsWithData.total > 0 && (
        <div className="px-3 sm:px-4 py-2 bg-muted/20 border-b border-border/60 text-xs text-muted-foreground flex-shrink-0">
          <span className="font-medium text-foreground/60">Note: </span>
          <span className="hidden sm:inline">Most operators keep pRPC private for security. Stats shown: {statsWithData.withUptime} uptime, {statsWithData.withStorage} storage, {statsWithData.withCPU} CPU, {statsWithData.withLatency} latency (of {statsWithData.total} total nodes)</span>
          <span className="sm:hidden">Limited stats: {statsWithData.withUptime} uptime, {statsWithData.withStorage} storage, {statsWithData.withCPU} CPU, {statsWithData.withLatency} latency</span>
        </div>
      )}
      
      <div className="flex flex-col flex-1 overflow-hidden min-h-0 -mt-px">
        {/* Scrollable Container with Sticky Header */}
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0" style={{ margin: 0, padding: 0, marginTop: '-1px' }}>
          <table className="min-w-full border-collapse m-0 border-spacing-0" style={{ minWidth: '800px', borderCollapse: 'collapse', margin: 0, padding: 0 }}>
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[12%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-muted border-b border-border/60" style={{ margin: 0, padding: 0 }}>
              <tr>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                  Public Key
                </th>
                <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                  Registered
                </th>
                {onSort ? (
                  <>
                    <th 
                      className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
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
                      className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
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
                      className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
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
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Location
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
                      className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
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
                      className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
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
                      className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider cursor-pointer hover:bg-muted/50 transition-colors select-none"
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
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Uptime
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Storage
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-right text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Latency
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      CPU
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-right text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-right text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Credits
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Packets Rx
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Packets Tx
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      Version
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-foreground/50">
                    No pNodes found
                  </td>
                </tr>
              ) : (
                nodes.map((node) => {
                  const duplicate = isDuplicate(node);
                  return (
                    <tr
                      key={node.id}
                      onClick={() => {
                        if (onNodeClick) {
                          onNodeClick(node);
                        } else {
                          router.push(`/nodes/${node.id}`);
                        }
                      }}
                      className={`hover:bg-muted/30 cursor-pointer transition-colors border-b border-border/20 ${
                        duplicate ? 'bg-warning/5 border-l-2 border-warning' : ''
                      }`}
                    >
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        <a
                          href={`/?node=${encodeURIComponent(node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '')}`}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click
                            const nodeIdentifier = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '';
                            router.push(`/?node=${encodeURIComponent(nodeIdentifier)}`);
                          }}
                          className="text-sm font-mono text-primary font-medium hover:underline transition-colors cursor-pointer no-underline"
                        >
                          {formatNodeId(node.id, node.address)}
                        </a>
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-mono text-foreground/70">
                            {formatPublicKey(node.pubkey || node.publicKey) || renderEmptyCell('Public key not available')}
                          </span>
                          {duplicate && (
                            <span 
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-warning/20 text-warning text-[10px] font-bold"
                              title={`Duplicate pubkey detected (appears ${pubkeyCounts[node.pubkey || node.publicKey]} times)`}
                            >
                              !
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-center">
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
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        <span className="text-xs sm:text-sm text-foreground/80">
                          {formatUptime(node.uptime) || renderEmptyCell()}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const capacity = node.storageCapacity;
                          const hasCapacity = capacity !== undefined && capacity !== null;
                          
                          if (hasCapacity) {
                            return (
                              <span className="text-xs sm:text-sm text-foreground/80">
                                {formatBytes(capacity)}
                              </span>
                            );
                          }
                          return renderEmptyCell();
                        })()}
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const ramUsed = node.ramUsed;
                          const ramTotal = node.ramTotal;
                          const hasRAM = ramTotal !== undefined && ramTotal !== null;
                          
                          if (hasRAM) {
                            const used = ramUsed !== undefined && ramUsed !== null ? formatBytes(ramUsed) : '—';
                            const total = formatBytes(ramTotal);
                            return (
                              <span className="text-xs sm:text-sm text-foreground/80">
                                {used} / {total}
                              </span>
                            );
                          }
                          return renderEmptyCell();
                        })()}
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        <span className="text-xs sm:text-sm text-foreground/80">
                          {node.location || renderEmptyCell()}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-right">
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
                          
                          return renderEmptyCell('Node not reachable');
                        })()}
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        <span className="text-xs sm:text-sm text-foreground/80">
                          {node.cpuPercent !== undefined && node.cpuPercent !== null 
                            ? `${node.cpuPercent.toFixed(1)}%`
                            : renderEmptyCell()}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-right">
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
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-right">
                        {node.credits !== undefined && node.credits !== null ? (
                          <span className="text-xs sm:text-sm font-mono text-foreground/80">
                            {node.credits.toLocaleString()}
                          </span>
                        ) : (
                          renderEmptyCell()
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        {node.packetsReceived !== undefined && node.packetsReceived !== null ? (
                          <span className="text-xs sm:text-sm font-mono text-foreground/80">
                            {node.packetsReceived.toLocaleString()}
                          </span>
                        ) : (
                          renderEmptyCell()
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        {node.packetsSent !== undefined && node.packetsSent !== null ? (
                          <span className="text-xs sm:text-sm font-mono text-foreground/80">
                            {node.packetsSent.toLocaleString()}
                          </span>
                        ) : (
                          renderEmptyCell()
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
