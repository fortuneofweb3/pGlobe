'use client';

import { useEffect, useState, useMemo } from 'react';
import { PNode } from '@/lib/types/pnode';
import MapLibreGlobe from '@/components/MapLibreGlobe';
import Header from '@/components/Header';
import { Search, MapPin, Navigation2, Loader2 } from 'lucide-react';
import { enrichNodesWithGeo } from '@/lib/utils/geo';
import { useNodes } from '@/lib/context/NodesContext';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface NodeWithDistance extends Omit<PNode, 'latency'> {
  distanceKm?: number;
  distanceMi?: number;
  latency?: number | null;
}

export default function ScanPage() {
  // Use shared nodes data from context (fetched once, updated passively)
  const { nodes, loading, error, lastUpdate, selectedNetwork, setSelectedNetwork, availableNetworks, currentNetwork, refreshNodes } = useNodes();
  
  const [nodesWithGeo, setNodesWithGeo] = useState<PNode[]>([]);
  const [geoEnriching, setGeoEnriching] = useState(false);
  const [scanIp, setScanIp] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanLocation, setScanLocation] = useState<{ lat: number; lon: number; city?: string; country?: string } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [closestNodes, setClosestNodes] = useState<NodeWithDistance[]>([]);
  const [nodesByLatency, setNodesByLatency] = useState<NodeWithDistance[]>([]);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [testingLatency, setTestingLatency] = useState(false);
  const [rankingTab, setRankingTab] = useState<'distance' | 'latency'>('distance');

  // Geo enrichment for map display (runs when nodes update from context)
  useEffect(() => {
    if (nodes.length > 0) {
      // Check if nodes already have geo data
      const hasGeoData = nodes.some(n => n.locationData?.lat !== undefined);
      if (hasGeoData) {
        setNodesWithGeo(nodes);
      } else {
        // Enrich with geo data in background (non-blocking)
        setNodesWithGeo(nodes); // Show immediately
        setGeoEnriching(true);
        enrichNodesWithGeo(nodes)
          .then((enriched) => {
            setNodesWithGeo(enriched);
            setGeoEnriching(false);
          })
          .catch(() => setGeoEnriching(false));
      }
    }
  }, [nodes]);

  // Get user's IP address
  const getUserIp = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  };

  // Handle scan - optimized for immediate UI feedback
  const handleScan = () => {
    if (!scanIp.trim()) {
      setScanError('Please enter an IP address');
      return;
    }
    // Use setTimeout to ensure UI updates immediately
    setTimeout(() => {
      handleScanWithIp(scanIp.trim());
    }, 0);
  };

  // Auto-detect user's IP - optimized for immediate UI feedback
  const handleAutoDetect = () => {
    setScanError(null);
    setScanning(true);
    
    // Use setTimeout to ensure UI updates immediately
    setTimeout(async () => {
    try {
      const userIp = await getUserIp();
      if (userIp) {
        setScanIp(userIp);
          // Small delay to ensure state update, then scan
          setTimeout(() => {
            handleScanWithIp(userIp);
          }, 10);
      } else {
        setScanError('Failed to detect your IP address');
        setScanning(false);
      }
    } catch (err: any) {
      setScanError(err.message || 'Failed to detect your IP address');
      setScanning(false);
    }
    }, 0);
  };

  // Helper function to scan with a specific IP (used by auto-detect)
  const handleScanWithIp = async (ipToScan: string) => {
    if (!ipToScan.trim()) {
      setScanError('Please enter an IP address');
      setScanning(false);
      return;
    }

    // Update UI state immediately for responsive feel
    setScanning(true);
    setScanError(null);
    setScanLocation(null);
    setClosestNodes([]);
    setNodesByLatency([]);
    setHighlightedNodeIds(new Set());
    
    // Use requestAnimationFrame to ensure UI updates before heavy work
    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
      // Fetch geolocation for the IP using the geo API (with timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      let geoResponse: Response;
      try {
        geoResponse = await fetch(`/api/geo?ip=${encodeURIComponent(ipToScan.trim())}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error('Request timeout - geo service took too long to respond');
        }
        throw new Error(fetchErr.message || 'Failed to connect to geo service');
      }
      
      if (!geoResponse.ok) {
        const errorData = await geoResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to get location for IP (${geoResponse.status})`);
      }

      const geoData = await geoResponse.json();
      if (geoData.error || !geoData.lat || !geoData.lon) {
        throw new Error(geoData.error || 'Invalid location data');
      }

      const location = {
        lat: geoData.lat,
        lon: geoData.lon,
        city: geoData.city,
        country: geoData.country,
      };

      console.debug('[Scan] Scan location:', location);

      setScanLocation(location);

      // Calculate distances to all nodes with location data
      let debugCount = 0;
      const nodesWithDistance: NodeWithDistance[] = nodesWithGeo
        .filter(node => node.locationData?.lat && node.locationData?.lon)
        .map(node => {
          const distanceKm = calculateDistance(
            location.lat,
            location.lon,
            node.locationData!.lat,
            node.locationData!.lon
          );
          
          // Log first few calculations for debugging
          if (debugCount++ < 3) {
            console.debug('[Scan] Distance calculation:', {
              nodeId: node.id?.substring(0, 10),
              scanLocation: `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`,
              nodeLocation: `${node.locationData!.lat.toFixed(4)}, ${node.locationData!.lon.toFixed(4)}`,
              distanceKm: distanceKm.toFixed(2),
            });
          }
          
          return {
            ...node,
            distanceKm,
            distanceMi: distanceKm * 0.621371, // Convert to miles
          };
        })
        .sort((a, b) => (a.distanceKm || Infinity) - (b.distanceKm || Infinity));
      
      console.debug('[Scan] Top 5 closest nodes:', nodesWithDistance.slice(0, 5).map(n => ({
        id: n.id?.substring(0, 10),
        distance: n.distanceKm?.toFixed(2) + 'km',
        location: n.locationData?.city || `${n.locationData?.lat?.toFixed(4)}, ${n.locationData?.lon?.toFixed(4)}`,
      })));

      // Top 20 by distance - show immediately
      const top20ByDistance = nodesWithDistance.slice(0, 20);
      setClosestNodes(top20ByDistance);
      
      // Don't highlight nodes - keep them with normal style
      setHighlightedNodeIds(new Set());
      
      // Scanning is complete - show results immediately
      setScanning(false);
      
      // Test latency in background - don't block UI
      // Try client-side ping first, fall back to server-side if CORS blocks it
      setTestingLatency(true);
      (async () => {
        try {
          // Client-side ping function - measures latency from browser to node directly
          const pingFromClient = async (ip: string, port: string = '6000'): Promise<{ latency: number | null; status: 'online' | 'offline'; method: 'client' | 'server' }> => {
            const url = `http://${ip}:${port}/rpc`;
            const startTime = performance.now();
            
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for client ping
              
              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'get-version',
                  id: 1,
                }),
                signal: controller.signal,
                mode: 'cors', // Try CORS first
                cache: 'no-cache',
              });
              
              clearTimeout(timeoutId);
              const endTime = performance.now();
              const latency = Math.round(endTime - startTime);
              
              if (response.ok) {
                console.debug(`[Scan] Client ping success for ${ip}:`, { latency, method: 'client' });
                return { latency, status: 'online' as const, method: 'client' as const };
              } else {
                // HTTP error - try server-side fallback
                return await pingFromServer(ip, port);
              }
            } catch (err: any) {
              // Check if it's a CORS error (typically happens very quickly)
              const endTime = performance.now();
              const elapsed = endTime - startTime;
              
              // CORS errors typically happen during preflight (< 50ms)
              // Network errors (timeouts, connection refused) take longer
              const isLikelyCORS = elapsed < 50 && (
                err.message?.includes('CORS') ||
                err.message?.includes('cors') ||
                err.message?.includes('network') ||
                err.name === 'TypeError'
              );
              
              if (err.name === 'AbortError') {
                // Timeout - try server-side fallback
                return await pingFromServer(ip, port);
              }
              
              if (isLikelyCORS) {
                // CORS blocked - fall back to server-side ping
                console.debug(`[Scan] CORS blocked for ${ip}, using server-side ping`);
                return await pingFromServer(ip, port);
              }
              
              // Other network error - try server-side as fallback
              console.debug(`[Scan] Client ping failed for ${ip}, trying server-side:`, err.message);
              return await pingFromServer(ip, port);
            }
          };

          // Server-side ping function (fallback when CORS blocks client ping)
          const pingFromServer = async (ip: string, port: string = '6000'): Promise<{ latency: number | null; status: 'online' | 'offline'; method: 'client' | 'server' }> => {
            try {
              const clientStartTime = performance.now(); // Measure round-trip time
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              
              const response = await fetch(`/api/ping?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`, {
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              const clientEndTime = performance.now();
              const clientRoundTrip = Math.round(clientEndTime - clientStartTime);
              
              if (response.ok) {
                const data = await response.json();
                // Server-to-node latency from API + client-to-server latency approximation
                // This is an approximation, but better than nothing
                const serverLatency = data.latency || 0;
                // Approximate client-to-node as: server latency + (client round-trip / 2)
                // This is rough but accounts for network path differences
                const estimatedLatency = serverLatency > 0 
                  ? Math.round(serverLatency + (clientRoundTrip / 2))
                  : null;
                
                console.debug(`[Scan] Server ping result for ${ip}:`, {
                  serverLatency: data.latency,
                  clientRoundTrip,
                  estimatedLatency,
                  method: 'server',
                  note: 'Estimated client-to-node latency (server-to-node + approximation)',
                });
                
                return {
                  latency: data.status === 'online' && estimatedLatency ? estimatedLatency : null,
                  status: data.status === 'online' ? 'online' as const : 'offline' as const,
                  method: 'server' as const,
                };
              } else {
                return { latency: null, status: 'offline' as const, method: 'server' as const };
              }
            } catch (err: any) {
              console.warn(`[Scan] Server ping also failed for ${ip}:`, err);
              return { latency: null, status: 'offline' as const, method: 'server' as const };
            }
          };

          // Use Promise.allSettled with shorter timeout to avoid hanging
          const latencyPromises = top20ByDistance.map(async (node) => {
            if (!node.address) return { ...node, latency: null };
            
            try {
              const ip = node.address.split(':')[0];
              // Use node's rpcPort if available, otherwise try port from address, fallback to 6000
              const port = node.rpcPort?.toString() || node.address.split(':')[1] || '6000';
              
              // Try client-side first, fall back to server-side if CORS blocks it
              const pingResult = await pingFromClient(ip, port);
              
              // Only use latency if node is online
              return {
                ...node,
                latency: pingResult.status === 'online' ? pingResult.latency : null,
              };
            } catch (err: any) {
              console.warn(`[Scan] Failed to ping ${node.address}:`, err);
              return { ...node, latency: null };
            }
          });

          // Wait for all pings (with timeout protection)
          const latencyResults = await Promise.allSettled(latencyPromises);
          const nodesWithLatency: NodeWithDistance[] = latencyResults
            .map((result): NodeWithDistance | null => result.status === 'fulfilled' ? result.value : null)
            .filter((node): node is NodeWithDistance => {
              // Only include nodes with valid latency (online nodes only)
              // Note: Latency is server-to-node, not client-to-node
              return node !== null && node !== undefined && node.latency !== null && node.latency !== undefined;
            });
          
          // Sort by latency (lowest first)
          // Only nodes with valid latency (online) are included
          const sortedByLatency = nodesWithLatency.sort((a, b) => {
            const aLatency = a.latency ?? Infinity;
            const bLatency = b.latency ?? Infinity;
            return aLatency - bLatency;
          });

          setNodesByLatency(sortedByLatency.slice(0, 20));
        } catch (err) {
          console.error('Latency testing error:', err);
          // Show nodes without latency data if testing fails
          setNodesByLatency(top20ByDistance.map(n => ({ ...n, latency: null })));
        } finally {
          setTestingLatency(false);
        }
      })();
    } catch (err: any) {
      setScanError(err.message || 'Failed to scan IP address');
      setScanning(false);
      setTestingLatency(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header 
        showNetworkSelector={false} 
        activePage="scan"
        nodeCount={nodes.length}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={() => refreshNodes()}
        networks={availableNetworks}
        currentNetwork={currentNetwork}
        onNetworkChange={(networkId) => {
          setSelectedNetwork(networkId);
        }}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Scan Controls */}
        <aside className="w-80 flex-shrink-0 bg-black/90 backdrop-blur-md border-r border-[#FFD700]/20 overflow-y-auto z-40">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                <Search className="w-5 h-5 text-foreground/40" />
                Node Scanner
              </h2>
              <p className="text-sm text-muted-foreground">
                Find the closest nodes to any IP address
              </p>
            </div>

            {/* IP Input */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-2">
                  IP Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scanIp}
                    onChange={(e) => setScanIp(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleScan();
                      }
                    }}
                    placeholder="e.g., 8.8.8.8"
                    className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FFD700]/50"
                    disabled={scanning}
                  />
                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="px-4 py-2 bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#FFD700] rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[80px]"
                  >
                    {scanning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Scan
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={handleAutoDetect}
                disabled={scanning}
                className="w-full px-3 py-2 text-sm bg-muted/50 hover:bg-muted/70 text-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Navigation2 className="w-4 h-4" />
                Use My IP Address
              </button>
            </div>

            {/* Error Message */}
            {scanError && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-400">
                {scanError}
              </div>
            )}

            {/* Scan Location Info */}
            {scanLocation && (
              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-foreground/40 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {scanLocation.city || 'Unknown City'}
                      {scanLocation.country && `, ${scanLocation.country}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {scanLocation.lat.toFixed(4)}, {scanLocation.lon.toFixed(4)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results with Toggle */}
            {(closestNodes.length > 0 || nodesByLatency.length > 0) && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Top 20 Nodes
                </h3>
                
                {/* Tab buttons */}
                <div className="flex gap-1 p-1 bg-muted/30 rounded-lg mb-3">
                  <button
                    onClick={() => setRankingTab('distance')}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      rankingTab === 'distance'
                        ? 'bg-[#FFD700]/20 text-[#FFD700]'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    By Distance
                  </button>
                  <button
                    onClick={() => setRankingTab('latency')}
                    disabled={testingLatency || nodesByLatency.length === 0}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      rankingTab === 'latency'
                        ? 'bg-[#FFD700]/20 text-[#FFD700]'
                        : 'text-muted-foreground hover:text-foreground'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Server-to-node latency (not client-to-node)"
                  >
                    By Latency
                    {testingLatency && (
                      <Loader2 className="w-3 h-3 animate-spin inline-block ml-1" />
                    )}
                  </button>
                </div>

                {/* Results list - scrollable for top 20 */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {rankingTab === 'distance' && closestNodes.length > 0 ? (
                    closestNodes.map((node, index) => (
                      <div
                        key={node.id}
                        className="p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          // Could add navigation to node detail here
                        }}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs font-mono text-foreground/90 truncate flex-1">
                            {node.pubkey || node.publicKey || node.id}
                          </span>
                          <span className="text-xs font-semibold text-[#00FF88] whitespace-nowrap ml-2">
                            {node.distanceKm !== undefined
                              ? `${node.distanceKm < 1 
                                  ? `${Math.round(node.distanceKm * 1000)}m`
                                  : `${node.distanceKm.toFixed(1)}km`}`
                              : 'N/A'}
                          </span>
                        </div>
                        {node.locationData?.city && (
                          <div className="text-xs text-muted-foreground">
                            {node.locationData.city}
                            {node.locationData.country && `, ${node.locationData.country}`}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              node.status === 'online'
                                ? 'bg-green-500/20 text-green-400'
                                : node.status === 'syncing'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {node.status || 'offline'}
                          </span>
                          {index < 10 && (
                            <span className="text-xs px-2 py-0.5 rounded bg-[#FFD700]/20 text-[#FFD700]">
                              Top {index + 1}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : rankingTab === 'latency' ? (
                    testingLatency ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                        Testing latency...
                      </div>
                    ) : nodesByLatency.length > 0 ? (
                      nodesByLatency.map((node, index) => (
                        <div
                          key={node.id}
                          className="p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => {
                            // Could add navigation to node detail here
                          }}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <span className="text-xs font-mono text-foreground/90 truncate flex-1">
                              {node.pubkey || node.publicKey || node.id}
                            </span>
                            <span className={`text-xs font-semibold whitespace-nowrap ml-2 ${
                              node.latency === null || node.latency === undefined
                                ? 'text-red-400' 
                                : node.latency < 50 
                                ? 'text-green-400' 
                                : node.latency < 100 
                                ? 'text-yellow-400' 
                                : 'text-orange-400'
                            }`}>
                              {node.latency !== null && node.latency !== undefined ? `${node.latency}ms` : 'N/A'}
                            </span>
                          </div>
                          {node.locationData?.city && (
                            <div className="text-xs text-muted-foreground">
                              {node.locationData.city}
                              {node.locationData.country && `, ${node.locationData.country}`}
                            </div>
                          )}
                          {node.distanceKm !== undefined && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {node.distanceKm < 1 
                                ? `${Math.round(node.distanceKm * 1000)}m away`
                                : `${node.distanceKm.toFixed(1)}km away`}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                node.status === 'online'
                                  ? 'bg-green-500/20 text-green-400'
                                  : node.status === 'syncing'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {node.status || 'offline'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No latency data available yet
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            )}

            {!scanning && !scanLocation && !scanError && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Enter an IP address and click Scan to find the closest nodes
              </div>
            )}
          </div>
        </aside>

        {/* Main Content - Globe */}
        <main className="flex-1 relative overflow-hidden">
          {loading || geoEnriching ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-foreground/40" />
            </div>
          ) : (
            <MapLibreGlobe 
              nodes={nodesWithGeo.length > 0 ? nodesWithGeo : nodes}
              highlightedNodeIds={highlightedNodeIds}
              centerLocation={scanLocation ? { lat: scanLocation.lat, lon: scanLocation.lon } : undefined}
              scanLocation={scanLocation || undefined}
              scanTopNodes={closestNodes.length > 0 ? closestNodes
                .map(n => {
                  // Find the full node data from nodesWithGeo to ensure locationData is present
                  const fullNode = nodesWithGeo.find(node => node.id === n.id);
                  return fullNode || n as PNode;
                })
                .filter((n): n is PNode => {
                  // Only include nodes with valid location data
                  const hasLocation = n !== undefined && n.locationData?.lat !== undefined && n.locationData?.lon !== undefined;
                  if (!hasLocation) {
                    console.warn('[ScanPage] Filtering out node without location:', n?.id);
                  }
                  return hasLocation;
                }) : undefined}
            />
          )}
        </main>
      </div>
    </div>
  );
}

