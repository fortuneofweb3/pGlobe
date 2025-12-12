'use client';

import { PNode } from '@/lib/types/pnode';
import { useMemo, useState, useRef, useEffect } from 'react';
import { X, Search, TrendingUp, TrendingDown, Minus, Server, Activity, HardDrive, Cpu, MemoryStick, Wifi, MapPin, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { formatStorageBytes } from '@/lib/utils/storage';
import NodeStatusBadge from '../NodeStatusBadge';

interface NodeComparisonProps {
  nodes: PNode[];
}

type ComparisonNode = {
  node: PNode | null;
  searchQuery: string;
  isOpen: boolean;
};

export default function NodeComparison({ nodes }: NodeComparisonProps) {
  const [comparisonNodes, setComparisonNodes] = useState<ComparisonNode[]>([
    { node: null, searchQuery: '', isOpen: false },
    { node: null, searchQuery: '', isOpen: false },
  ]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Add third slot
  const addThirdSlot = () => {
    if (comparisonNodes.length < 3) {
      setComparisonNodes([...comparisonNodes, { node: null, searchQuery: '', isOpen: false }]);
    }
  };

  // Remove a slot
  const removeSlot = (index: number) => {
    if (comparisonNodes.length > 2) {
      setComparisonNodes(comparisonNodes.filter((_, i) => i !== index));
    }
  };

  // Auto-scroll effect when dropdown opens
  useEffect(() => {
    comparisonNodes.forEach((comparison, index) => {
      if (comparison.isOpen) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const input = inputRefs.current[index];
            const dropdown = dropdownRefs.current[index];
            if (input && dropdown) {
              const inputRect = input.getBoundingClientRect();
              const dropdownRect = dropdown.getBoundingClientRect();
              const viewportHeight = window.innerHeight;
              const scrollPadding = 100;
              
              const dropdownBottom = dropdownRect.bottom;
              const dropdownTop = dropdownRect.top;
              
              const needsScrollDown = dropdownBottom > viewportHeight - scrollPadding;
              const needsScrollUp = dropdownTop < scrollPadding;
              
              if (needsScrollDown) {
                const scrollTarget = window.scrollY + dropdownBottom - viewportHeight + scrollPadding;
                window.scrollTo({
                  top: Math.max(0, scrollTarget),
                  behavior: 'smooth'
                });
              } else if (needsScrollUp) {
                const scrollTarget = window.scrollY + inputRect.top - scrollPadding;
                window.scrollTo({
                  top: Math.max(0, scrollTarget),
                  behavior: 'smooth'
                });
              }
            }
          }, 150);
        });
      }
    });
  }, [comparisonNodes]);

  // Update search query
  const updateSearch = (index: number, query: string) => {
    const updated = [...comparisonNodes];
    updated[index].searchQuery = query;
    updated[index].isOpen = query.length > 0;
    setComparisonNodes(updated);
  };

  // Select a node
  const selectNode = (index: number, node: PNode) => {
    const updated = [...comparisonNodes];
    updated[index].node = node;
    updated[index].searchQuery = '';
    updated[index].isOpen = false;
    setComparisonNodes(updated);
  };

  // Clear a node
  const clearNode = (index: number) => {
    const updated = [...comparisonNodes];
    updated[index].node = null;
    updated[index].searchQuery = '';
    updated[index].isOpen = false;
    setComparisonNodes(updated);
  };

  // Filter nodes for search
  const getFilteredNodes = (query: string, excludeIds: string[]) => {
    if (!query || query.length === 0) return [];
    
    const lowerQuery = query.toLowerCase();
    return nodes
      .filter(node => !excludeIds.includes(node.id))
      .filter(node => {
        const searchableText = [
          node.id,
          node.pubkey,
          node.publicKey,
          node.address,
          node.locationData?.city,
          node.locationData?.country,
          node.version,
        ].filter(Boolean).join(' ').toLowerCase();
        
        return searchableText.includes(lowerQuery);
      })
      .slice(0, 10);
  };

  // Get selected nodes
  const selectedNodes = useMemo(() => {
    return comparisonNodes.map(c => c.node).filter((n): n is PNode => n !== null);
  }, [comparisonNodes]);

  // Get latest version for badges
  const latestVersion = useMemo(() => {
    const versions = nodes.map(n => n.version).filter((v): v is string => !!v);
    return versions.sort().reverse()[0];
  }, [nodes]);

  // Comparison metrics
  const getComparisonValue = (node: PNode, metric: string): number | null => {
    switch (metric) {
      case 'uptime':
        return node.uptimePercent ?? (node.uptime ? Math.min(99.9, (node.uptime / (30 * 24 * 3600)) * 100) : null);
      case 'storage':
        return node.storageUsed ?? null;
      case 'cpu':
        return node.cpuPercent ?? null;
      case 'ram':
        return node.ramUsed && node.ramTotal ? (node.ramUsed / node.ramTotal) * 100 : null;
      case 'latency':
        return node.latency ?? null;
      default:
        return null;
    }
  };

  const getComparisonIcon = (values: (number | null)[]): 'up' | 'down' | 'equal' | null => {
    const validValues = values.filter((v): v is number => v !== null);
    if (validValues.length < 2) return null;
    
    const max = Math.max(...validValues);
    const min = Math.min(...validValues);
    const diff = max - min;
    const threshold = max * 0.05;
    
    if (diff < threshold) return 'equal';
    return values[0] === max ? 'up' : 'down';
  };

  const formatIdentifier = (node: PNode) => {
    if (node.address) return node.address;
    const key = node.pubkey || node.publicKey;
    if (key) {
      if (key.length <= 16) return key;
      return `${key.slice(0, 8)}...${key.slice(-6)}`;
    }
    return node.id.slice(0, 16);
  };

  return (
    <div className="w-full space-y-5">
      {/* Add Node Button */}
      <div className="flex items-center justify-end">
        {comparisonNodes.length < 3 && (
          <button
            onClick={addThirdSlot}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:text-foreground bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-lg transition-all"
          >
            <span>+</span>
            <span>Add Third Node</span>
          </button>
        )}
      </div>

      {/* Node Selectors */}
      <div className={`grid gap-4 ${comparisonNodes.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        {comparisonNodes.map((comparison, index) => (
          <div key={index} className="relative">
            {comparison.node ? (
              /* Selected Node Card */
              <div className="group relative bg-gradient-to-br from-card/80 to-card/40 border-2 border-[#F0A741]/40 rounded-xl p-4 shadow-lg shadow-[#F0A741]/5 hover:shadow-[#F0A741]/10 hover:border-[#F0A741]/60 transition-all duration-200">
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() => clearNode(index)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-foreground hover:bg-red-500/10 rounded-md transition-all"
                    title="Remove node"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="space-y-3 pr-8">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-2 h-2 rounded-full bg-[#F0A741] flex-shrink-0 animate-pulse"></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold text-foreground truncate mb-1.5">
                        {formatIdentifier(comparison.node)}
                      </div>
                      <NodeStatusBadge node={comparison.node} latestVersion={latestVersion} showLabel={true} />
                    </div>
                  </div>
                  
                  {comparison.node.locationData?.city && (
                    <div className="flex items-center gap-1.5 text-xs text-foreground/60">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{comparison.node.locationData.city}, {comparison.node.locationData.country}</span>
                    </div>
                  )}
                  
                  {comparison.node.version && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-foreground/50">Version</span>
                      <span className="font-mono font-medium text-foreground">v{comparison.node.version}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Search Input */
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
                  <input
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    value={comparison.searchQuery}
                    onChange={(e) => updateSearch(index, e.target.value)}
                    onFocus={() => updateSearch(index, comparison.searchQuery)}
                    placeholder={`Search node ${index + 1}...`}
                    className="w-full pl-10 pr-3 py-2.5 bg-muted/20 border border-border/50 rounded-lg text-sm font-medium text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-[#F0A741]/40 focus:border-[#F0A741]/60 transition-all"
                  />
                </div>
                
                {/* Dropdown */}
                {comparison.isOpen && (
                  <div
                    ref={(el) => { dropdownRefs.current[index] = el; }}
                    className="absolute top-full left-0 right-0 mt-2 bg-black/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl max-h-72 overflow-y-auto z-40"
                    style={{
                      animation: 'dropdownFadeIn 0.2s ease-out',
                      transformOrigin: 'top',
                    }}
                  >
                    {getFilteredNodes(comparison.searchQuery, selectedNodes.map(n => n.id)).length === 0 ? (
                      <div className="p-4 text-center">
                        <div className="text-xs font-medium text-foreground/50">No nodes found</div>
                        <div className="text-xs text-foreground/30 mt-1">Try a different search term</div>
                      </div>
                    ) : (
                      <div className="py-1.5">
                        {getFilteredNodes(comparison.searchQuery, selectedNodes.map(n => n.id)).map((node, nodeIndex) => (
                          <button
                            key={node.id}
                            onClick={() => selectNode(index, node)}
                            className="w-full px-4 py-3 text-left hover:bg-[#F0A741]/10 active:bg-[#F0A741]/15 transition-colors border-b border-border/10 last:border-b-0 group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#F0A741]/40 group-hover:bg-[#F0A741] transition-colors flex-shrink-0"></div>
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="font-mono text-sm font-semibold text-foreground truncate">
                                  {formatIdentifier(node)}
                                </div>
                                {node.locationData?.city && (
                                  <div className="flex items-center gap-1.5 text-xs text-foreground/50">
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{node.locationData.city}, {node.locationData.country}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <NodeStatusBadge node={node} latestVersion={latestVersion} showLabel={true} />
                                  {node.version && (
                                    <span className="text-xs text-foreground/40 font-mono">v{node.version}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Remove Slot Button */}
            {comparisonNodes.length > 2 && (
              <button
                onClick={() => removeSlot(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-full flex items-center justify-center text-red-400 hover:text-red-300 transition-all shadow-lg"
                title="Remove slot"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      {selectedNodes.length >= 2 && (
        <div className="bg-card/30 border border-border/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  <th className="px-5 py-3.5 text-left">
                    <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Metric</span>
                  </th>
                  {selectedNodes.map((node) => (
                    <th key={node.id} className="px-5 py-3.5 text-center min-w-[180px]">
                      <div className="font-mono text-xs font-semibold text-foreground/80 truncate">
                        {formatIdentifier(node)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {/* Status */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Activity className="w-4 h-4 text-foreground/50" />
                      <span className="text-sm font-medium text-foreground/80">Status</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => (
                    <td key={node.id} className="px-5 py-3.5 text-center">
                      <NodeStatusBadge node={node} latestVersion={latestVersion} showLabel={true} />
                    </td>
                  ))}
                </tr>

                {/* Version */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Server className="w-4 h-4 text-foreground/50" />
                      <span className="text-sm font-medium text-foreground/80">Version</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => (
                    <td key={node.id} className="px-5 py-3.5 text-center">
                      <span className="text-sm font-mono font-medium text-foreground">
                        {node.version ? `v${node.version}` : <span className="text-foreground/40">N/A</span>}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Uptime */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-foreground/50" />
                      <span className="text-sm font-medium text-foreground/80">Uptime</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => {
                    const uptime = getComparisonValue(node, 'uptime');
                    const values = selectedNodes.map(n => getComparisonValue(n, 'uptime'));
                    const icon = getComparisonIcon(values);
                    return (
                      <td key={node.id} className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {uptime !== null ? (
                            <>
                              <span className="text-sm font-semibold text-foreground">{uptime.toFixed(1)}%</span>
                              {icon === 'up' && <TrendingUp className="w-3.5 h-3.5 text-[#3F8277]" />}
                              {icon === 'down' && <TrendingDown className="w-3.5 h-3.5 text-[#FF6B6B]" />}
                              {icon === 'equal' && <Minus className="w-3.5 h-3.5 text-foreground/30" />}
                            </>
                          ) : (
                            <span className="text-sm text-foreground/40">N/A</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Storage Used */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <HardDrive className="w-4 h-4 text-foreground/50" />
                      <span className="text-sm font-medium text-foreground/80">Storage</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => {
                    const storage = getComparisonValue(node, 'storage');
                    const values = selectedNodes.map(n => getComparisonValue(n, 'storage'));
                    const icon = getComparisonIcon(values);
                    return (
                      <td key={node.id} className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {storage !== null ? (
                            <>
                              <span className="text-sm font-semibold text-foreground">{formatStorageBytes(storage)}</span>
                              {icon === 'up' && <TrendingUp className="w-3.5 h-3.5 text-[#3F8277]" />}
                              {icon === 'down' && <TrendingDown className="w-3.5 h-3.5 text-[#FF6B6B]" />}
                              {icon === 'equal' && <Minus className="w-3.5 h-3.5 text-foreground/30" />}
                            </>
                          ) : (
                            <span className="text-sm text-foreground/40">N/A</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* CPU Usage */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Cpu className="w-4 h-4 text-foreground/50" />
                      <span className="text-sm font-medium text-foreground/80">CPU</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => {
                    const cpu = getComparisonValue(node, 'cpu');
                    const values = selectedNodes.map(n => getComparisonValue(n, 'cpu'));
                    const icon = getComparisonIcon(values);
                    return (
                      <td key={node.id} className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {cpu !== null ? (
                            <>
                              <span className="text-sm font-semibold text-foreground">{cpu.toFixed(1)}%</span>
                              {icon === 'up' && <TrendingDown className="w-3.5 h-3.5 text-[#FF6B6B]" />}
                              {icon === 'down' && <TrendingUp className="w-3.5 h-3.5 text-[#3F8277]" />}
                              {icon === 'equal' && <Minus className="w-3.5 h-3.5 text-foreground/30" />}
                            </>
                          ) : (
                            <span className="text-sm text-foreground/40">N/A</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* RAM Usage */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <MemoryStick className="w-4 h-4 text-foreground/50" />
                      <span className="text-sm font-medium text-foreground/80">RAM</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => {
                    const ram = getComparisonValue(node, 'ram');
                    const values = selectedNodes.map(n => getComparisonValue(n, 'ram'));
                    const icon = getComparisonIcon(values);
                    return (
                      <td key={node.id} className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {ram !== null ? (
                            <>
                              <span className="text-sm font-semibold text-foreground">{ram.toFixed(1)}%</span>
                              {icon === 'up' && <TrendingDown className="w-3.5 h-3.5 text-[#FF6B6B]" />}
                              {icon === 'down' && <TrendingUp className="w-3.5 h-3.5 text-[#3F8277]" />}
                              {icon === 'equal' && <Minus className="w-3.5 h-3.5 text-foreground/30" />}
                            </>
                          ) : (
                            <span className="text-sm text-foreground/40">N/A</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Latency */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Wifi className="w-4 h-4 text-foreground/50" />
                      <span className="text-sm font-medium text-foreground/80">Latency</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => {
                    const latency = getComparisonValue(node, 'latency');
                    const values = selectedNodes.map(n => getComparisonValue(n, 'latency'));
                    const icon = getComparisonIcon(values);
                    return (
                      <td key={node.id} className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {latency !== null ? (
                            <>
                              <span className="text-sm font-semibold text-foreground">{Math.round(latency)}ms</span>
                              {icon === 'up' && <TrendingDown className="w-3.5 h-3.5 text-[#FF6B6B]" />}
                              {icon === 'down' && <TrendingUp className="w-3.5 h-3.5 text-[#3F8277]" />}
                              {icon === 'equal' && <Minus className="w-3.5 h-3.5 text-foreground/30" />}
                            </>
                          ) : (
                            <span className="text-sm text-foreground/40">N/A</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Location */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-foreground/50" />
                      <span className="text-sm font-medium text-foreground/80">Location</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => (
                    <td key={node.id} className="px-5 py-3.5 text-center">
                      <span className="text-sm text-foreground">
                        {node.locationData?.city && node.locationData?.country
                          ? `${node.locationData.city}, ${node.locationData.country}`
                          : <span className="text-foreground/40">N/A</span>}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Registered */}
                <tr className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-foreground/50" />
                      <span className="text-sm font-medium text-foreground/80">Registered</span>
                    </div>
                  </td>
                  {selectedNodes.map((node) => (
                    <td key={node.id} className="px-5 py-3.5 text-center">
                      {node.isRegistered ? (
                        <CheckCircle2 className="w-4 h-4 text-[#3F8277] mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-foreground/30 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedNodes.length < 2 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/30 mb-3">
            <Server className="w-6 h-6 text-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground/60">Select at least 2 nodes to compare</p>
          <p className="text-xs text-foreground/40 mt-1">Use the search boxes above to add nodes</p>
        </div>
      )}
    </div>
  );
}
