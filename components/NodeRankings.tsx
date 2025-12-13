'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo, useState, useEffect } from 'react';
import { formatStorageBytes } from '@/lib/utils/storage';
import { getLatestVersion } from '@/lib/utils/network-health';
import NodeStatusBadge from './NodeStatusBadge';
import { calculatePacketRates, formatPacketRate } from '@/lib/utils/packet-rates';

interface NodeRankingsProps {
  nodes: PNode[];
  onNodeClick?: (node: PNode) => void;
}

type RankingTab = 'uptime' | 'storage' | 'packets';

interface NodeWithPacketRate extends PNode {
  rxRate?: number;
  txRate?: number;
  totalRate?: number;
}

export default function NodeRankings({ nodes, onNodeClick }: NodeRankingsProps) {
  const [activeTab, setActiveTab] = useState<RankingTab>('uptime');
  const [packetRates, setPacketRates] = useState<Map<string, { rxRate: number; txRate: number; totalRate: number }>>(new Map());
  const [loadingRates, setLoadingRates] = useState(false);

  // Fetch historical data for packet rate calculation
  useEffect(() => {
    if (activeTab !== 'packets') return;
    
    const nodesWithPackets = nodes.filter(n => 
      (n.packetsReceived !== undefined && n.packetsReceived > 0) ||
      (n.packetsSent !== undefined && n.packetsSent > 0)
    );
    
    if (nodesWithPackets.length === 0) return;
    
    setLoadingRates(true);
    
    // Fetch historical data for nodes with packet data
    const fetchRates = async () => {
      const ratesMap = new Map<string, { rxRate: number; txRate: number; totalRate: number }>();
      const endTime = Date.now();
      const startTime = endTime - (24 * 60 * 60 * 1000); // Last 24 hours
      
      // Fetch for up to 20 nodes (to avoid too many requests)
      const nodesToFetch = nodesWithPackets.slice(0, 20);
      
      await Promise.all(
        nodesToFetch.map(async (node) => {
          try {
            const pubkey = node.pubkey || node.publicKey || node.id;
            if (!pubkey) return;
            
            const url = `/api/history?nodeId=${encodeURIComponent(pubkey)}&startTime=${startTime}&endTime=${endTime}`;
            const response = await fetch(url);
            
            if (!response.ok) return;
            
            const data = await response.json();
            if (data.data && Array.isArray(data.data) && data.data.length >= 2) {
              const historicalData = data.data.map((snapshot: any) => ({
                timestamp: snapshot.timestamp,
                packetsReceived: snapshot.packetsReceived,
                packetsSent: snapshot.packetsSent,
              }));
              
              const rates = calculatePacketRates(historicalData, 60); // 60 minute window
              if (rates) {
                ratesMap.set(node.id, rates);
              }
            }
          } catch (error) {
            // Silently fail for individual nodes
            console.debug('[NodeRankings] Failed to fetch rates for node:', node.id);
          }
        })
      );
      
      setPacketRates(ratesMap);
      setLoadingRates(false);
    };
    
    fetchRates();
  }, [activeTab, nodes]);

  const rankings = useMemo(() => {
    // Helper function to calculate uptime percentage from seconds
    // Assumes 30 days = 100% uptime
    const calculateUptimePercent = (uptimeSeconds: number | undefined): number | undefined => {
      if (uptimeSeconds === undefined || uptimeSeconds <= 0) return undefined;
      const uptimePercent = Math.min(99.9, (uptimeSeconds / (30 * 24 * 3600)) * 100);
      return uptimePercent;
    };

    // Top 10 nodes by uptime
    // Use uptimePercent if available, otherwise calculate from uptime (seconds)
    const byUptime = [...nodes]
      .map(n => {
        const uptimePercent = n.uptimePercent !== undefined 
          ? n.uptimePercent 
          : calculateUptimePercent(n.uptime);
        return { ...n, calculatedUptimePercent: uptimePercent };
      })
      .filter(n => n.calculatedUptimePercent !== undefined && n.calculatedUptimePercent > 0)
      .sort((a, b) => (b.calculatedUptimePercent || 0) - (a.calculatedUptimePercent || 0))
      .slice(0, 10)
      .map(n => {
        // Remove the temporary calculatedUptimePercent, use it to set uptimePercent if not already set
        const { calculatedUptimePercent, ...rest } = n;
        return {
          ...rest,
          uptimePercent: rest.uptimePercent ?? calculatedUptimePercent,
        };
      });

    // Top 10 nodes by storage used (actual data stored)
    const byStorage = [...nodes]
      .filter(n => n.storageUsed !== undefined && n.storageUsed > 0)
      .sort((a, b) => (b.storageUsed || 0) - (a.storageUsed || 0))
      .slice(0, 10);

    // Top 10 nodes by packet transfer rate
    const byPackets: NodeWithPacketRate[] = [...nodes]
      .map((n): NodeWithPacketRate | null => {
        const rates = packetRates.get(n.id);
        if (rates) {
          return { ...n, rxRate: rates.rxRate, txRate: rates.txRate, totalRate: rates.totalRate };
        }
        // Fallback: estimate rate from cumulative total and uptime if available
        if (n.uptime && n.uptime > 0) {
          const rxRate = (n.packetsReceived || 0) / n.uptime;
          const txRate = (n.packetsSent || 0) / n.uptime;
          const totalRate = rxRate + txRate;
          if (totalRate > 0) {
            return { ...n, rxRate, txRate, totalRate };
          }
        }
        return null;
      })
      .filter((n): n is NodeWithPacketRate => n !== null && (n.totalRate || 0) > 0)
      .sort((a, b) => (b.totalRate || 0) - (a.totalRate || 0))
      .slice(0, 10);

    return { byUptime, byStorage, byPackets };
  }, [nodes, packetRates]);

  const formatIdentifier = (node: PNode) => {
    // Use gossip address as primary identifier
    if (node.address) {
      return node.address;
    }
    // Fallback to pubkey/publicKey if address not available
    const key = node.pubkey || node.publicKey;
    if (key) {
      if (key.length <= 12) return key;
      return `${key.slice(0, 6)}...${key.slice(-4)}`;
    }
    // Final fallback
    if (node.id) return node.id;
    return 'Unknown';
  };

  const currentRankings = activeTab === 'uptime' 
    ? rankings.byUptime 
    : activeTab === 'storage'
    ? rankings.byStorage
    : rankings.byPackets;
  const hasData = currentRankings.length > 0;

  // Get latest version for status badges (excluding trynet versions)
  const latestVersion = useMemo(() => {
    const versions = nodes.map(n => n.version).filter((v): v is string => !!v);
    return getLatestVersion(versions) || versions.sort().reverse()[0];
  }, [nodes]);

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-foreground">Top Performing Nodes</h3>
      
      {/* Tab buttons */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
        <button
          onClick={() => setActiveTab('uptime')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'uptime'
              ? 'bg-[#F0A741]/20 text-[#F0A741]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Top by Uptime
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'storage'
              ? 'bg-[#F0A741]/20 text-[#F0A741]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Top by Storage
        </button>
        <button
          onClick={() => setActiveTab('packets')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'packets'
              ? 'bg-[#F0A741]/20 text-[#F0A741]'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Top by Packets
        </button>
      </div>

      {/* Rankings list - scrollable for top 10 */}
      <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
        {loadingRates && activeTab === 'packets' ? (
          <div className="text-center py-4 text-xs text-muted-foreground">
            <p>Calculating packet rates...</p>
          </div>
        ) : hasData ? (
          currentRankings.map((node, index) => (
            <div
              key={node.id}
              onClick={() => onNodeClick?.(node)}
              className={`flex items-center gap-2 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors ${
                onNodeClick ? 'cursor-pointer' : ''
              }`}
            >
              {/* Rank badge */}
              <span className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded ${
                index === 0 ? 'bg-[#F0A741]/30 text-[#F0A741]' :
                index === 1 ? 'bg-gray-400/30 text-gray-300' :
                index === 2 ? 'bg-amber-700/30 text-amber-500' :
                'bg-muted text-muted-foreground'
              }`}>
                {index + 1}
              </span>
              
              {/* Node info */}
              <div className="flex-1 min-w-0 space-y-1">
                <span className="text-xs font-mono text-foreground/90 truncate block">
                  {formatIdentifier(node)}
                </span>
                {activeTab === 'packets' ? (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {(() => {
                      const nodeWithRate = node as NodeWithPacketRate;
                      if (nodeWithRate.rxRate && nodeWithRate.txRate) {
                        return (
                          <>
                            <span>Rx: {formatPacketRate(nodeWithRate.rxRate)}</span>
                            <span>•</span>
                            <span>Tx: {formatPacketRate(nodeWithRate.txRate)}</span>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <NodeStatusBadge node={node} latestVersion={latestVersion} showLabel={false} />
                )}
              </div>
              
              {/* Value */}
              <span className="text-xs font-semibold text-[#3F8277] whitespace-nowrap">
                {activeTab === 'uptime'
                  ? `${(node.uptimePercent || 0).toFixed(1)}%`
                  : activeTab === 'storage'
                  ? formatStorageBytes(node.storageUsed || 0)
                  : (() => {
                      const nodeWithRate = node as NodeWithPacketRate;
                      return nodeWithRate.totalRate 
                        ? formatPacketRate(nodeWithRate.totalRate)
                        : 'N/A';
                    })()
                }
              </span>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-xs text-muted-foreground">
            <p>No enriched data yet</p>
            <p className="mt-1 text-[10px]">Stats require public pRPC</p>
          </div>
        )}
      </div>
    </div>
  );
}
