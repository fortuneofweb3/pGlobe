'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo, useState, useRef, useEffect } from 'react';
import { X, Search, Server, HardDrive, Cpu, MemoryStick, Wifi, MapPin, Clock, CheckCircle2, XCircle, Plus, Globe, Lock, Activity, Award } from 'lucide-react';
import { formatStorageBytes } from '@/lib/utils/storage';
import { getLatestVersion } from '@/lib/utils/network-health';
import NodeStatusBadge from '../NodeStatusBadge';
import AnimatedNumber from '../AnimatedNumber';

interface NodeComparisonProps {
  nodes: PNode[];
}

type ComparisonSlot = {
  node: PNode | null;
  searchQuery: string;
  isOpen: boolean;
};

export default function NodeComparison({ nodes }: NodeComparisonProps) {
  const [slots, setSlots] = useState<ComparisonSlot[]>([
    { node: null, searchQuery: '', isOpen: false },
    { node: null, searchQuery: '', isOpen: false },
  ]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setSlots(prev => prev.map(s => ({ ...s, isOpen: false })));
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const latestVersion = useMemo(() => {
    const versions = nodes.map(n => n.version).filter((v): v is string => !!v);
    return getLatestVersion(versions) || versions.sort().reverse()[0];
  }, [nodes]);

  const selectedNodes = useMemo(() => slots.map(s => s.node).filter((n): n is PNode => n !== null), [slots]);

  const formatId = (node: PNode) => {
    if (node.address) return node.address;
    const key = node.pubkey || node.publicKey;
    if (key) return key.length <= 12 ? key : `${key.slice(0, 6)}...${key.slice(-4)}`;
    const nodeId = node.id || node.pubkey || node.publicKey || 'unknown';
    return nodeId.length <= 12 ? nodeId : `${nodeId.slice(0, 6)}...${nodeId.slice(-4)}`;
  };

  const getFiltered = (query: string, excludeIds: string[]) => {
    const q = query.toLowerCase();
    return nodes
      .filter(n => {
        const nodeId = n.id || n.pubkey || n.publicKey || '';
        return !excludeIds.includes(nodeId);
      })
      .filter(n => {
        if (!query) return true;
        const searchableFields = [
          n.id,
          n.pubkey,
          n.publicKey,
          n.address,
          n.locationData?.city,
          n.locationData?.country,
          n.version
        ].filter(Boolean);
        return searchableFields.join(' ').toLowerCase().includes(q);
      })
      .slice(0, 5);
  };

  const updateSlot = (idx: number, updates: Partial<ComparisonSlot>) => {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const addSlot = () => slots.length < 4 && setSlots([...slots, { node: null, searchQuery: '', isOpen: false }]);
  const removeSlot = (idx: number) => slots.length > 2 && setSlots(slots.filter((_, i) => i !== idx));

  // Metric helpers
  const getValue = (node: PNode, key: string): number | null => {
    switch (key) {
      case 'uptime': return node.uptimePercent ?? (node.uptime ? Math.min(99.9, (node.uptime / (30 * 24 * 3600)) * 100) : null);
      case 'storage': return node.storageCapacity ?? null;
      case 'cpu': return node.cpuPercent ?? null;
      case 'ram': return node.ramUsed && node.ramTotal ? (node.ramUsed / node.ramTotal) * 100 : null;
      case 'latency': return node.latency ?? null;
      case 'credits': return node.credits ?? null;
      default: return null;
    }
  };

  // Get max value for scaling bars
  const getMaxValue = (key: string): number => {
    const vals = selectedNodes.map(n => getValue(n, key)).filter((v): v is number => v !== null);
    if (vals.length === 0) return 100;
    if (['uptime', 'cpu', 'ram'].includes(key)) return 100;
    return Math.max(...vals) * 1.1;
  };

  // Determine best performer for a metric
  const getBest = (key: string, higherBetter: boolean): string | null => {
    if (selectedNodes.length < 2) return null;
    const entries = selectedNodes
      .map(n => ({ 
        id: n.id || n.pubkey || n.publicKey || 'unknown', 
        val: getValue(n, key) 
      }))
      .filter(e => e.val !== null && e.id !== 'unknown');
    if (entries.length < 2) return null;
    const sorted = [...entries].sort((a, b) => higherBetter ? (b.val! - a.val!) : (a.val! - b.val!));
    const best = sorted[0].val!;
    const second = sorted[1].val!;
    if (Math.abs(best - second) / Math.max(best, 1) < 0.05) return null;
    return sorted[0].id;
  };

  const metrics = [
    { key: 'uptime', label: 'Uptime', icon: Clock, unit: '%', higherBetter: true, color: '#3F8277' },
    { key: 'storage', label: 'Storage', icon: HardDrive, format: formatStorageBytes, higherBetter: true, color: '#3B82F6' },
    { key: 'cpu', label: 'CPU', icon: Cpu, unit: '%', higherBetter: false, color: '#F0A741' },
    { key: 'ram', label: 'RAM', icon: MemoryStick, unit: '%', higherBetter: false, color: '#A855F7' },
    { key: 'latency', label: 'Latency', icon: Wifi, unit: 'ms', higherBetter: false, color: '#06B6D4' },
    { key: 'credits', label: 'Credits', icon: Award, higherBetter: true, color: '#EC4899' },
  ];

  return (
    <div ref={containerRef} className="space-y-4" style={{ overflow: 'visible' }}>
      {/* Node Selector */}
      <div className="flex flex-wrap gap-3" style={{ overflow: 'visible' }}>
        {slots.map((slot, idx) => (
          <div key={idx} className="relative flex-1 min-w-[200px] max-w-[280px]" style={{ overflow: 'visible', zIndex: slot.isOpen ? 100 : 'auto' }}>
            {slot.node ? (
              <div className="card p-3 group relative border border-border hover:border-[#3F8277]/30 transition-colors">
                <button
                  onClick={() => updateSlot(idx, { node: null, searchQuery: '' })}
                  className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>

                {slots.length > 2 && (
                  <button
                    onClick={() => removeSlot(idx)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-[#3F8277]/10 border border-[#3F8277]/20 flex items-center justify-center flex-shrink-0">
                    <Server className="w-4 h-4 text-[#3F8277]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-semibold text-foreground truncate">
                      {formatId(slot.node)}
                    </p>
                    <div className="mt-1">
                      <NodeStatusBadge node={slot.node} latestVersion={latestVersion} showLabel={true} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {slot.node.locationData?.city && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{slot.node.locationData.city}, {slot.node.locationData.country}</span>
                    </div>
                  )}
                  {slot.node.version && (
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-mono">v{slot.node.version}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {slot.node.isPublic ? (
                      <>
                        <Globe className="w-3.5 h-3.5 text-[#3F8277] flex-shrink-0" />
                        <span className="text-[#3F8277]">Public</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Private</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative" style={{ zIndex: slot.isOpen ? 100 : 'auto' }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                  <input
                    type="text"
                    value={slot.searchQuery}
                    onChange={(e) => updateSlot(idx, { searchQuery: e.target.value, isOpen: true })}
                    onFocus={() => updateSlot(idx, { isOpen: true })}
                    placeholder={`Node ${idx + 1}...`}
                    className="input pl-12 pr-3 h-11 w-full focus:border-border focus:ring-0 focus:shadow-none"
                    style={{ paddingLeft: '2.75rem' }}
                  />
                </div>

                {slot.isOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-[100] overflow-hidden">
                    <div className="max-h-72 overflow-y-auto">
                      {(() => {
                        const excludedIds = selectedNodes.map(n => n.id || n.pubkey || n.publicKey || '').filter(Boolean);
                        const filtered = getFiltered(slot.searchQuery, excludedIds);
                        return filtered.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            {slot.searchQuery ? 'No nodes found' : 'Start typing...'}
                          </div>
                        ) : (
                          filtered.map((node) => {
                            const nodeKey = node.id || node.pubkey || node.publicKey || `node-${Math.random()}`;
                            return (
                              <button
                                key={nodeKey}
                                onClick={() => updateSlot(idx, { node, searchQuery: '', isOpen: false })}
                                className="w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 border-b border-border/50 last:border-0"
                              >
                                <Server className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-mono text-sm text-foreground truncate">{formatId(node)}</p>
                                  {node.locationData?.city && (
                                    <p className="text-xs text-muted-foreground truncate">{node.locationData.city}, {node.locationData.country}</p>
                                  )}
                                </div>
                                <NodeStatusBadge node={node} latestVersion={latestVersion} showLabel={false} />
                              </button>
                            );
                          })
                        );
                      })()}
                    </div>
                  </div>
                )}

                {slots.length > 2 && (
                  <button
                    onClick={() => removeSlot(idx)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {slots.length < 4 && (
          <button
            onClick={addSlot}
            className="flex-shrink-0 h-11 px-4 border-2 border-dashed border-border rounded-lg flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:border-[#3F8277]/30 hover:bg-[#3F8277]/5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Node</span>
          </button>
        )}
      </div>

      {/* Comparison Table */}
      {selectedNodes.length >= 2 ? (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metric</th>
                  {selectedNodes.map((node) => {
                    const nodeKey = node.id || node.pubkey || node.publicKey || `node-${Math.random()}`;
                    return (
                      <th key={nodeKey} className="text-center p-3 min-w-[140px]">
                        <div className="flex flex-col items-center gap-1">
                          <p className="font-mono text-sm font-semibold text-foreground">{formatId(node)}</p>
                          <NodeStatusBadge node={node} latestVersion={latestVersion} showLabel={false} />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  const max = getMaxValue(metric.key);
                  const bestId = getBest(metric.key, metric.higherBetter);
                  const hasData = selectedNodes.some(n => getValue(n, metric.key) !== null);

                  if (!hasData) return null;

                  return (
                    <tr key={metric.key} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{metric.label}</span>
                        </div>
                      </td>
                      {selectedNodes.map((node) => {
                        const val = getValue(node, metric.key);
                        const nodeId = node.id || node.pubkey || node.publicKey || 'unknown';
                        const nodeKey = node.id || node.pubkey || node.publicKey || `node-${Math.random()}`;
                        const isBest = nodeId === bestId;
                        const barWidth = val !== null ? Math.max((val / max) * 100, 2) : 0;

                        return (
                          <td key={nodeKey} className="p-3 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className={`flex items-center gap-2 ${isBest ? 'text-[#3F8277]' : 'text-foreground'}`}>
                                {val !== null ? (
                                  metric.format ? (
                                    <span className="font-semibold">{metric.format(val)}</span>
                                  ) : (
                                    <span className="font-semibold">
                                      <AnimatedNumber value={val} decimals={metric.unit === '%' ? 1 : 0} />
                                      {metric.unit && <span className="text-muted-foreground ml-1 text-xs">{metric.unit}</span>}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                                {isBest && (
                                  <span className="text-[10px] text-[#3F8277] font-bold bg-[#3F8277]/10 px-1.5 py-0.5 rounded">
                                    BEST
                                  </span>
                                )}
                              </div>
                              {val !== null && (
                                <div className="w-full max-w-[120px] h-2 bg-muted/50 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${barWidth}%`,
                                      backgroundColor: isBest ? '#3F8277' : metric.color,
                                      opacity: isBest ? 1 : 0.7,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Location Row */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Location</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => {
                    const nodeKey = node.id || node.pubkey || node.publicKey || `node-${Math.random()}`;
                    return (
                      <td key={nodeKey} className="p-3 text-center">
                        <span className="text-sm text-foreground">
                          {node.locationData?.city ? `${node.locationData.city}, ${node.locationData.country}` : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* Registration Row */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Registration</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => {
                    const nodeKey = node.id || node.pubkey || node.publicKey || `node-${Math.random()}`;
                    return (
                      <td key={nodeKey} className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {node.isRegistered ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-[#3F8277]" />
                              <span className="text-sm text-[#3F8277] font-medium">Registered</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Not registered</span>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Network Activity Row */}
                {selectedNodes.some(n => n.packetsReceived || n.packetsSent) && (
                  <tr className="hover:bg-muted/10 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Network Activity</span>
                      </div>
                    </td>
                    {selectedNodes.map((node) => {
                      const nodeKey = node.id || node.pubkey || node.publicKey || `node-${Math.random()}`;
                      return (
                        <td key={nodeKey} className="p-3 text-center">
                          <div className="flex flex-col gap-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Rx: </span>
                              <span className="text-foreground font-medium">{node.packetsReceived?.toLocaleString() ?? '—'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tx: </span>
                              <span className="text-foreground font-medium">{node.packetsSent?.toLocaleString() ?? '—'}</span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
            <Server className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">Compare Nodes</p>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            Select at least 2 nodes above to see a side-by-side comparison of their metrics
          </p>
        </div>
      )}
    </div>
  );
}
