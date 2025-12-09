'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PNode } from '@/lib/types/pnode';
import { X, Copy, Check, RefreshCw, HardDrive, Cpu, MemoryStick, Network, MapPin, Clock, CheckCircle2, XCircle, Globe } from 'lucide-react';
import { detectDataCenter, getRegionName } from '@/lib/utils/dataCenter';
import { formatBytes, formatStorageBytes } from '@/lib/utils/storage';
import { useNodes } from '@/lib/context/NodesContext';
import BalanceDisplay from './BalanceDisplay';

interface NodeDetailsModalProps {
  node: PNode | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function NodeDetailsModal({ node, isOpen, onClose }: NodeDetailsModalProps) {
  const router = useRouter();
  const { nodes: allNodes, refreshNodes } = useNodes();
  const [copied, setCopied] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);

  const handleRefresh = async () => {
    if (!node) return;
    setRefreshingStats(true);
    try {
      await refreshNodes();
    } catch (e) {
      console.error('Failed to refresh:', e);
    } finally {
      setRefreshingStats(false);
    }
  };

  const nodeStats = useMemo(() => {
    if (!node) return null;

    const networkAvgCpu = allNodes.length > 0
      ? allNodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).reduce((sum, n) => sum + (n.cpuPercent || 0), 0) / allNodes.filter(n => n.cpuPercent !== undefined && n.cpuPercent !== null).length
      : 0;

    const storageUtilization = node.storageCapacity
      ? ((node.storageUsed || 0) / node.storageCapacity) * 100
      : 0;

    const ramUtilization = node.ramTotal && node.ramUsed
      ? (node.ramUsed / node.ramTotal) * 100
      : 0;

    return {
      networkAvgCpu,
      storageUtilization,
      ramUtilization,
    };
  }, [node, allNodes]);

  const formatUptime = (uptime?: number) => {
    if (uptime === undefined || uptime === null) return '—';
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatPublicKey = (key?: string) => {
    if (!key) return '—';
    if (key.length <= 20) return key;
    return `${key.slice(0, 10)}...${key.slice(-10)}`;
  };

  const formatValue = (value: any, formatter?: (val: any) => string): string => {
    if (value === undefined || value === null) return '—';
    return formatter ? formatter(value) : String(value);
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'online') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">Online</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">Offline</span>;
  };

  if (!isOpen || !node) return null;

  const pubkey = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '';
  const displayPubkey = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '—';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          className="bg-black border-0 sm:border border-[#FFD700]/20 rounded-none sm:rounded-xl shadow-2xl w-full h-full sm:w-full sm:max-w-4xl sm:max-h-[85vh] overflow-hidden flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Compact Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#FFD700]/20">
            <div className="flex items-center gap-3">
              {getStatusBadge(node.status)}
              <div>
                <h2 className="text-base font-bold">Node Details</h2>
                {node.version && (
                  <p className="text-xs text-foreground/50">v{node.version}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (node) {
                    const nodeId = node.pubkey || node.publicKey || node.id || node.address?.split(':')[0] || '';
                    if (nodeId) {
                      router.push(`/?node=${encodeURIComponent(nodeId)}`);
                      onClose();
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors text-xs font-medium"
                title="View on Globe"
              >
                <Globe className="w-3.5 h-3.5" />
                View on Globe
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshingStats}
                className="p-1.5 hover:bg-foreground/10 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${refreshingStats ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-foreground/10 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
            {/* Node Identifier - Compact */}
            <div className="bg-card/30 border border-border/40 rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <p className="text-xs font-mono text-foreground truncate">{displayPubkey}</p>
              <button
                onClick={async () => {
                      if (pubkey) {
                    await navigator.clipboard.writeText(pubkey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                    className="p-1 hover:bg-foreground/10 rounded transition-colors flex-shrink-0"
                    title="Copy"
              >
                {copied ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                      <Copy className="w-3.5 h-3.5 text-foreground/60" />
                )}
              </button>
                </div>
                {node.lastSeen && (
                  <p className="text-xs text-foreground/50 whitespace-nowrap">
                    {new Date(node.lastSeen).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Main Stats - Compact Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-card/40 border border-border/60 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#FFD700]" />
                  <p className="text-xs text-foreground/60">Uptime</p>
                </div>
                <p className="text-lg font-bold">{formatUptime(node.uptime)}</p>
              </div>

              <div className="bg-card/40 border border-border/60 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[#FFD700]" />
                  <p className="text-xs text-foreground/60">Storage</p>
                </div>
                <p className="text-lg font-bold">{formatValue(node.storageUsed, formatStorageBytes)}</p>
                {node.storageCapacity && (
                  <p className="text-xs text-foreground/50">/ {formatStorageBytes(node.storageCapacity)}</p>
                )}
              </div>

              <div className="bg-card/40 border border-border/60 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#FFD700]" />
                  <p className="text-xs text-foreground/60">CPU</p>
                </div>
                <p className="text-lg font-bold">{formatValue(node.cpuPercent, (val) => `${val.toFixed(1)}%`)}</p>
              </div>

              <div className="bg-card/40 border border-border/60 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Network className="w-3.5 h-3.5 text-[#FFD700]" />
                  <p className="text-xs text-foreground/60">Latency</p>
                </div>
                <p className="text-lg font-bold">{formatValue(node.latency, (val) => `${val.toFixed(0)}ms`)}</p>
              </div>
            </div>

            {/* Detailed Info - Two Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Storage & Memory */}
              <div className="bg-card/40 border border-border/60 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <HardDrive className="w-4 h-4 text-[#FFD700]" />
                  <h3 className="text-sm font-semibold">Storage & Memory</h3>
                  </div>
                <div className="space-y-3">
                  {node.storageCapacity ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-foreground/60">Storage</p>
                        <p className="text-xs font-mono font-semibold">
                          {formatValue(nodeStats?.storageUtilization, (val) => `${val.toFixed(1)}%`)}
                        </p>
                      </div>
                      <div className="w-full bg-foreground/10 rounded-full h-1.5">
                        <div
                          className="bg-[#FFD700] h-1.5 rounded-full transition-all"
                          style={{ width: `${nodeStats?.storageUtilization || 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-xs">
                        <span className="text-foreground/70">{formatValue(node.storageUsed, formatStorageBytes)}</span>
                        <span className="text-foreground/50">{formatValue(node.storageCapacity, formatStorageBytes)}</span>
                      </div>
                    </div>
                  ) : null}
                  {node.ramTotal ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-foreground/60">Memory</p>
                        <p className="text-xs font-mono font-semibold">
                          {formatValue(nodeStats?.ramUtilization, (val) => `${val.toFixed(1)}%`)}
                        </p>
                      </div>
                      <div className="w-full bg-foreground/10 rounded-full h-1.5">
                        <div
                          className="bg-[#FFD700] h-1.5 rounded-full transition-all"
                          style={{ width: `${nodeStats?.ramUtilization || 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-xs">
                        <span className="text-foreground/70">{formatValue(node.ramUsed, formatBytes)}</span>
                        <span className="text-foreground/50">{formatValue(node.ramTotal, formatBytes)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
            </div>

              {/* Network */}
              <div className="bg-card/40 border border-border/60 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Network className="w-4 h-4 text-[#FFD700]" />
                  <h3 className="text-sm font-semibold">Network</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-foreground/60">Address</span>
                    <span className="font-mono text-foreground/80">{formatValue(node.address, (addr) => addr.replace(':6000', ':9001'))}</span>
                  </div>
                  {node.rpcPort && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">RPC Port</span>
                      <span className="font-mono text-foreground/80">{node.rpcPort}</span>
                    </div>
                  )}
                  {node.packetsReceived !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Packets Rx</span>
                      <span className="font-mono text-foreground/80">{node.packetsReceived.toLocaleString()}/s</span>
                    </div>
                  )}
                  {node.packetsSent !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Packets Tx</span>
                      <span className="font-mono text-foreground/80">{node.packetsSent.toLocaleString()}/s</span>
                    </div>
                  )}
                  {node.activeStreams !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Active Streams</span>
                      <span className="font-mono text-foreground/80">{node.activeStreams}</span>
                    </div>
                  )}
                </div>
                </div>
              </div>

              {/* Location & Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-card/40 border border-border/60 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-[#FFD700]" />
                  <h3 className="text-sm font-semibold">Location</h3>
                </div>
                <div className="space-y-2 text-xs">
                  {node.locationData?.country && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Country</span>
                      <span className="text-foreground/80">{node.locationData.country}</span>
                    </div>
                  )}
                  {node.locationData?.city && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">City</span>
                      <span className="text-foreground/80">{node.locationData.city}</span>
                    </div>
                  )}
                  {getRegionName(node.locationData) && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Region</span>
                      <span className="text-foreground/80">{getRegionName(node.locationData)}</span>
                    </div>
                  )}
                  {node.address && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Data Center</span>
                      <span className="text-foreground/80">{detectDataCenter(node.address.split(':')[0]) || '—'}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-card/40 border border-border/60 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-[#FFD700]" />
                  <h3 className="text-sm font-semibold">Status</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-foreground/60">Registered</span>
                    <div className="flex items-center gap-1.5">
                      {node.isRegistered || (node.balance && node.balance > 0) ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-green-400">Yes</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-400">No</span>
                        </>
                      )}
                    </div>
                  </div>
                  {node.balance !== undefined && node.balance !== null && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Balance</span>
                      <BalanceDisplay 
                        balance={node.balance} 
                        className="text-xs font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Unavailable Warning */}
            {node._statsError && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-400 font-medium text-xs mb-1">Stats Unavailable</p>
                <p className="text-xs text-foreground/60">
                  {node._statsError}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
