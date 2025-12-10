'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PNode } from '@/lib/types/pnode';
import { pingNode, getLatencyColor, formatLatency, PingResult } from '@/lib/utils/ping';
import { fetchNodeBalance } from '@/lib/utils/balance';
import BalanceDisplay from './BalanceDisplay';
import { formatBytes, formatStorageBytes } from '@/lib/utils/storage';
import { Check, X } from 'lucide-react';

interface PNodeTableProps {
  nodes: PNode[];
  onNodeClick?: (node: PNode) => void;
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

export default function PNodeTable({ nodes, onNodeClick }: PNodeTableProps) {
  const router = useRouter();
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({});
  const [pingingNodes, setPingingNodes] = useState<Set<string>>(new Set());
  const [balances, setBalances] = useState<Record<string, number | null>>({});
  const [fetchingBalances, setFetchingBalances] = useState<Set<string>>(new Set());

  // Ping nodes when they're loaded (only once per node)
  useEffect(() => {
    const pingNodes = async () => {
      for (const node of nodes) {
        // Skip if node is not seen in gossip (offline)
        if (node.seenInGossip === false) {
          continue;
        }
        
        // Skip if we already have a result or are currently pinging
        if (pingResults[node.id] || pingingNodes.has(node.id)) continue;
        
        // Skip if node already has latency data
        if (node.latency !== undefined) {
          setPingResults(prev => ({
            ...prev,
            [node.id]: {
              latency: node.latency ?? null,
              status: node.status === 'online' ? 'online' : 'offline',
            },
          }));
          continue;
        }

        setPingingNodes(prev => new Set(prev).add(node.id));
        
        try {
          const result = await pingNode(node);
          setPingResults(prev => ({
            ...prev,
            [node.id]: result,
          }));
        } catch (error) {
          setPingResults(prev => ({
            ...prev,
            [node.id]: {
              latency: null,
              status: 'offline',
            },
          }));
        } finally {
          setPingingNodes(prev => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
        }
      }
    };

    pingNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  // Fetch balances for nodes
  useEffect(() => {
    const fetchBalances = async () => {
      for (const node of nodes) {
        if (balances[node.id] !== undefined || fetchingBalances.has(node.id)) continue;
        if (!node.pubkey && !node.publicKey) continue;

        setFetchingBalances(prev => new Set(prev).add(node.id));
        
        try {
          const balance = await fetchNodeBalance(node);
          setBalances(prev => ({
            ...prev,
            [node.id]: balance,
          }));
        } catch (error) {
          setBalances(prev => ({
            ...prev,
            [node.id]: null,
          }));
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

  const formatLastSeen = (lastSeen?: number) => {
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
    const withStorage = nodes.filter(n => n.storageUsed && n.storageUsed > 0).length;
    const withCPU = nodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).length;
    const withLatency = nodes.filter(n => {
      const pingResult = pingResults[n.id];
      return pingResult?.latency !== null && pingResult?.latency !== undefined || n.latency !== undefined;
    }).length;
    
    return { withUptime, withStorage, withCPU, withLatency, total: nodes.length };
  }, [nodes, pingResults]);

  return (
    <div className="flex flex-col h-full bg-card/30 border border-border/60 rounded-lg overflow-visible">
      {/* Info Banner */}
      {statsWithData.total > 0 && (
        <div className="px-3 sm:px-4 py-2 bg-muted/20 border-b border-border/60 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/60">Note: </span>
          <span className="hidden sm:inline">Most operators keep pRPC private for security. Stats shown: {statsWithData.withUptime} uptime, {statsWithData.withStorage} storage, {statsWithData.withCPU} CPU, {statsWithData.withLatency} latency (of {statsWithData.total} total nodes)</span>
          <span className="sm:hidden">Limited stats: {statsWithData.withUptime} uptime, {statsWithData.withStorage} storage, {statsWithData.withCPU} CPU, {statsWithData.withLatency} latency</span>
        </div>
      )}
      
      <div className="flex flex-col flex-1 overflow-visible">
        {/* Fixed Header */}
        <div className="overflow-x-auto border-b border-border/60 flex-shrink-0 bg-muted/40">
          <table className="min-w-full" style={{ minWidth: '800px' }}>
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead>
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
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                  Uptime
                </th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                  Storage
                </th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                  Last Seen
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
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                  Version
                </th>
              </tr>
            </thead>
          </table>
        </div>
        
        {/* Scrollable Body */}
        {/* Allow tooltips to overflow; rely on page scroll instead of inner scroll */}
        <div className="overflow-x-auto overflow-y-visible flex-1">
          <table className="min-w-full" style={{ minWidth: '800px' }}>
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[14%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[9%]" />
              <col className="w-[5%]" />
            </colgroup>
            <tbody className="divide-y divide-border/40">
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-foreground/50">
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
                          const capacity = node.storageCapacity || node.storageCommitted;
                          const used = node.storageUsed;
                          const hasUsed = used !== undefined && used !== null;
                          const hasCapacity = capacity !== undefined && capacity !== null;
                          
                          if (hasUsed || hasCapacity) {
                            return (
                              <span className="text-xs sm:text-sm text-foreground/80">
                                {hasUsed ? formatBytes(used) : '—'} / {hasCapacity ? formatBytes(capacity) : '—'}
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
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        <span className="text-xs sm:text-sm text-foreground/80">
                          {formatLastSeen(node.lastSeen) || renderEmptyCell('Last seen time not available')}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-right">
                        {(() => {
                          // Don't show latency for nodes not seen in gossip (offline)
                          if (node.seenInGossip === false) {
                            return renderEmptyCell();
                          }
                          
                          const pingResult = pingResults[node.id];
                          const isPinging = pingingNodes.has(node.id);
                          
                          if (isPinging) {
                            return (
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="inline-block w-2.5 h-2.5 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
                              </span>
                            );
                          }
                          
                          if (pingResult) {
                            const latency = pingResult.latency;
                            const color = getLatencyColor(latency);
                            return (
                              <span className={`text-xs sm:text-sm font-mono font-medium ${color}`}>
                                {formatLatency(latency)}
                              </span>
                            );
                          }
                          
                          if (node.latency !== undefined) {
                            const color = getLatencyColor(node.latency);
                            return (
                              <span className={`text-xs sm:text-sm font-mono font-medium ${color}`}>
                                {formatLatency(node.latency)}
                              </span>
                            );
                          }
                          
                          return renderEmptyCell();
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
                      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                        {node.version ? (
                          <span 
                            className="text-xs text-foreground/70 cursor-help group relative"
                            title={node.version}
                          >
                            {abbreviateVersion(node.version)}
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none border border-gray-700 whitespace-nowrap">
                              {node.version}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                <div className="border-4 border-transparent border-t-gray-900"></div>
                              </div>
                            </div>
                          </span>
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
