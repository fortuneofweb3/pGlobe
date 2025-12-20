'use client';

import { useEffect, useState, useMemo } from 'react';
import { PNode } from '@/lib/types/pnode';
import dynamic from 'next/dynamic';

const MapLibreGlobe = dynamic(() => import('@/components/MapLibreGlobe'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black">
      <div className="text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#F0A741]" />
        <p className="text-xs text-muted-foreground">Loading map...</p>
      </div>
    </div>
  ),
});
import Header from '@/components/Header';
import { Search, MapPin, Navigation2, Loader2, X } from 'lucide-react';
import { enrichNodesWithGeo } from '@/lib/utils/geo';
import { useNodes } from '@/lib/context/NodesContext';
import NodeDetailsModal from '@/components/NodeDetailsModal';

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
  const [userIp, setUserIp] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanLocation, setScanLocation] = useState<{ lat: number; lon: number; city?: string; country?: string } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [closestNodes, setClosestNodes] = useState<NodeWithDistance[]>([]);
  const [selectedNode, setSelectedNode] = useState<PNode | null>(null);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [navigateToNodeId, setNavigateToNodeId] = useState<string | null>(null);

  // Geo enrichment for map display (runs when nodes update from context)
  // Only enrich if nodes count changes, not on every render
  useEffect(() => {
    if (nodes.length > 0) {
      // Check if nodes already have geo data
      const hasGeoData = nodes.some(n => n.locationData?.lat !== undefined);
      if (hasGeoData) {
        setNodesWithGeo(nodes);
        setGeoEnriching(false);
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
    } else {
      setNodesWithGeo([]);
      setGeoEnriching(false);
    }
  }, [nodes.length]); // Only re-run when nodes count changes, not on every nodes array reference change

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
      handleScanWithIp(scanIp.trim(), scanIp.trim() === userIp);
    }, 0);
  };

  // Auto-detect user's IP - optimized for immediate UI feedback
  const handleAutoDetect = async () => {
    setScanError(null);
    setScanning(true);
    
    // Use setTimeout to ensure UI updates immediately
    setTimeout(async () => {
    try {
      const detectedIp = await getUserIp();
      if (detectedIp) {
        setUserIp(detectedIp);
        setScanIp(detectedIp);
          // Small delay to ensure state update, then scan
          setTimeout(() => {
            handleScanWithIp(detectedIp, true);
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

  // Helper function to scan with a specific IP (used by auto-detect and manual scan)
  const handleScanWithIp = async (ipToScan: string, isUserIp: boolean = false) => {
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


      setScanLocation(location);

      // Calculate distances to ALL nodes - batch calculation for efficiency
      // IMPORTANT: Use nodes directly from context to ensure we have ALL nodes (online, syncing, offline)
      // nodesWithGeo might be incomplete during enrichment, so prefer nodes from context
      const nodesToUse = nodes; // Always use all nodes from context, not just geo-enriched ones
      
      // Batch calculate distances for ALL nodes with location data
      // NO status filtering - includes online, syncing, and offline nodes
      // Only requirement: must have valid lat/lon coordinates
      const nodesWithDistance: NodeWithDistance[] = nodesToUse
        .filter(node => {
          // Only filter by location data - NO status filtering
          // Include all nodes: online, syncing, and offline
          const hasLocation = node.locationData?.lat != null && 
                              node.locationData?.lon != null &&
                              !isNaN(node.locationData.lat) &&
                              !isNaN(node.locationData.lon);
          return hasLocation;
        })
        .map(node => {
          // Calculate distance for each node (batch processing)
          const distanceKm = calculateDistance(
            location.lat,
            location.lon,
            node.locationData!.lat,
            node.locationData!.lon
          );
          
          return {
            ...node,
            distanceKm,
            distanceMi: distanceKm * 0.621371, // Convert to miles
          };
        })
        .sort((a, b) => (a.distanceKm || Infinity) - (b.distanceKm || Infinity));

      // Show top 20 closest nodes (for display and map connections)
      const top20Closest = nodesWithDistance.slice(0, 20);
      setClosestNodes(top20Closest);
      
      // Scanning is complete - show results immediately
      setScanning(false);
    } catch (err: any) {
      setScanError(err.message || 'Failed to scan IP address');
      setScanning(false);
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Show loading skeleton when loading or no data available
  const isLoading = loading || (nodes.length === 0 && !error);

  // If loading and no data, show the loading skeleton
  if (isLoading && nodes.length === 0) {
    return (
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        <Header 
          showNetworkSelector={false} 
          activePage="scan"
          nodeCount={0}
          lastUpdate={null}
          loading={true}
          onRefresh={() => {}}
        />
        
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar - Scan Controls */}
          <aside className="hidden md:block w-80 flex-shrink-0 bg-card border-r border-[#F0A741]/20 overflow-y-auto">
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                    <Search className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/40" />
                    Node Scanner
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Find the closest nodes to any IP address
                </p>
              </div>

              {/* IP Input */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-foreground/70 mb-2">
                    IP Address
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g., 8.8.8.8"
                      className="flex-1 px-3 py-2 text-base bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#F0A741]/50"
                      disabled
                    />
                    <button
                      disabled
                      className="px-3 sm:px-4 py-2 bg-[#F0A741]/20 text-[#F0A741] rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-2 min-w-[70px] sm:min-w-[80px] text-xs sm:text-sm"
                    >
                      <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Scan</span>
                    </button>
                  </div>
                </div>

                <button
                  disabled
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-muted/50 text-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Navigation2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Use My IP Address
                </button>
              </div>

              {/* Placeholder for scan location info */}
              <div className="p-4 bg-muted/30 rounded-lg border border-border animate-pulse">
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-foreground/40 mt-0.5" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-muted/40 rounded mb-2" />
                    <div className="h-3 w-48 bg-muted/30 rounded" />
                  </div>
                </div>
              </div>

              {/* Placeholder for results */}
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3">
                  Closest Nodes
                </h3>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="p-3 bg-muted/30 rounded-lg border border-border animate-pulse"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="h-3 w-32 bg-muted/40 rounded flex-1" />
                        <div className="h-3 w-12 bg-muted/40 rounded ml-2" />
                      </div>
                      <div className="h-3 w-24 bg-muted/30 rounded mb-2" />
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-16 bg-muted/30 rounded" />
                        <div className="h-5 w-12 bg-muted/30 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content - Globe */}
          <main className="flex-1 relative overflow-hidden">
            {/* Mobile Sidebar Toggle Button */}
            <button
              className="md:hidden absolute top-4 left-4 z-50 p-2 bg-black border border-[#F0A741]/20 rounded-lg text-[#F0A741]"
              disabled
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Globe Skeleton */}
            <div className="absolute inset-0 w-full h-full bg-black">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 h-3/4 rounded-full border-2 border-muted/30 animate-pulse">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-muted/40 animate-pulse" style={{ animationDelay: '0s' }} />
                    <div className="w-2 h-2 rounded-full bg-muted/40 animate-pulse absolute" style={{ left: '30%', top: '40%', animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 rounded-full bg-muted/40 animate-pulse absolute" style={{ left: '60%', top: '20%', animationDelay: '0.4s' }} />
                    <div className="w-2 h-2 rounded-full bg-muted/40 animate-pulse absolute" style={{ left: '70%', top: '60%', animationDelay: '0.6s' }} />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header 
        showNetworkSelector={false} 
        activePage="scan"
        nodeCount={nodes.length}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={() => {
          // Only refresh if user explicitly clicks refresh button
          // Don't trigger automatic refreshes on page load
          refreshNodes();
        }}
        networks={availableNetworks}
        currentNetwork={currentNetwork}
        onNetworkChange={(networkId) => {
          setSelectedNetwork(networkId);
        }}
      />
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/80 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar - Scan Controls */}
        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative w-80 flex-shrink-0 bg-card/90 backdrop-blur-md border-r border-[#F0A741]/20 overflow-y-auto z-50 md:z-40 h-full transition-transform duration-300`}>
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/40" />
                  Node Scanner
                </h2>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden p-1 text-foreground/60 hover:text-foreground"
                  aria-label="Close sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Find the closest nodes to any IP address
              </p>
            </div>

            {/* IP Input */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-foreground/70 mb-2">
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
                    className="flex-1 px-3 py-2 text-base bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#F0A741]/50"
                    disabled={scanning}
                  />
                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="px-3 sm:px-4 py-2 bg-[#F0A741]/20 hover:bg-[#F0A741]/30 text-[#F0A741] rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-2 min-w-[70px] sm:min-w-[80px] text-xs sm:text-sm"
                  >
                    {scanning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Scan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={handleAutoDetect}
                disabled={scanning}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-muted/50 hover:bg-muted/70 text-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Navigation2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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

            {/* Results - Closest Nodes */}
            {closestNodes.length > 0 && (
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-foreground mb-3">
                  {scanIp === userIp ? 'Nodes Near Me' : 'Closest Nodes'} ({closestNodes.length})
                </h3>

                {/* Results list - scrollable for top 20 */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {closestNodes.map((node, index) => (
                    <div
                      key={node.id}
                      className="p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        // Navigate globe to this node
                        setNavigateToNodeId(node.id);
                      }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-mono text-foreground/90 truncate flex-1">
                          {node.pubkey || node.publicKey || node.id}
                        </span>
                        <span className="text-xs font-semibold text-[#3F8277] whitespace-nowrap ml-2">
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
                          <span className="text-xs px-2 py-0.5 rounded bg-[#F0A741]/20 text-[#F0A741]">
                            Top {index + 1}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
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
          {/* Mobile Sidebar Toggle Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden absolute top-4 left-4 z-50 p-2 bg-card border border-[#F0A741]/20 rounded-lg text-[#F0A741] hover:bg-[#F0A741]/10 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {geoEnriching ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-foreground/40" />
            </div>
          ) : (
            <MapLibreGlobe 
              nodes={nodesWithGeo.length > 0 ? nodesWithGeo : nodes}
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
                    // Filtering out node without location
                  }
                  return hasLocation;
                }) : undefined}
              autoRotate={false}
              navigateToNodeId={navigateToNodeId}
              onNodeClick={(node) => {
                // Navigate globe to clicked node (prevents redirect to overview)
                setNavigateToNodeId(node.id);
                // Clear navigation after a moment so clicking the same node again works
                setTimeout(() => setNavigateToNodeId(null), 100);
              }}
              onPopupClick={(node) => {
                // Open node details modal when popup is clicked
                setSelectedNode(node);
                setIsNodeModalOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {/* Node Details Modal */}
      <NodeDetailsModal
        node={selectedNode}
        isOpen={isNodeModalOpen}
        onClose={() => {
          setIsNodeModalOpen(false);
          setSelectedNode(null);
        }}
      />
    </div>
  );
}

