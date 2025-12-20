'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PNode } from '@/lib/types/pnode';
import dynamic from 'next/dynamic';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// Dynamically import Globe to avoid SSR issues
// react-globe.gl exports a default component
const Globe = dynamic(() => import('react-globe.gl'), { 
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-muted-foreground">Loading globe...</div>
});

interface NetworkGlobeProps {
  nodes: PNode[];
}

const statusColors = {
  online: '#3F8277', // Xandeum green
  syncing: '#F0A741', // Xandeum yellow
  offline: '#ED1C24', // Xandeum red
};

export default function NetworkGlobe({ nodes }: NetworkGlobeProps) {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const globeEl = useRef<any>(null);
  const [cameraDistance, setCameraDistance] = useState(250);
  const [globeRotation, setGlobeRotation] = useState({ lat: 0, lng: 0 });

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Filter nodes with location data
  const nodesWithLocation = useMemo(() => {
    return nodes.filter((node) => node.locationData && node.locationData.lat && node.locationData.lon);
  }, [nodes]);

  // Prepare points data for globe
  const points = useMemo(() => {
    return nodesWithLocation.map((node) => {
      const status = node.status || 'offline';
      const color = statusColors[status] || statusColors.offline;
      
      return {
        lat: node.locationData!.lat,
        lng: node.locationData!.lon,
        size: Math.max(0.3, Math.min(1.5, cameraDistance / 200)), // Size based on zoom
        color: color,
        node: node, // Store full node data for tooltip
      };
    });
  }, [nodesWithLocation, cameraDistance]);

  // Prepare labels data - show cities/countries based on zoom level (Google Earth style)
  const labels = useMemo(() => {
    const labelMap = new Map<string, { lat: number; lng: number; text: string; size: number; type: 'city' | 'country' }>();
    
    // Group nodes by location to avoid duplicate labels
    const locationGroups = new Map<string, PNode[]>();
    nodesWithLocation.forEach((node) => {
      if (!node.locationData) return;
      const { city, country } = node.locationData;
      const key = city ? `${city}, ${country}` : country || 'Unknown';
      if (!locationGroups.has(key)) {
        locationGroups.set(key, []);
      }
      locationGroups.get(key)!.push(node);
    });
    
    locationGroups.forEach((nodes, key) => {
      const node = nodes[0];
      if (!node.locationData) return;
      
      const { city, country, lat, lon } = node.locationData;
      
      // Very zoomed in (< 120): Show all cities with node counts
      if (cameraDistance < 120 && city) {
        const cityKey = `${city}-${country}`;
        if (!labelMap.has(cityKey)) {
          labelMap.set(cityKey, {
            lat: lat,
            lng: lon,
            text: `${city} (${nodes.length})`,
            size: 1.0,
            type: 'city',
          });
        }
      }
      // Moderately zoomed (120-180): Show major cities only
      else if (cameraDistance < 180 && city && nodes.length > 1) {
        const cityKey = `${city}-${country}`;
        if (!labelMap.has(cityKey)) {
          labelMap.set(cityKey, {
            lat: lat,
            lng: lon,
            text: city,
            size: 0.9,
            type: 'city',
          });
        }
      }
      // Zoomed out (180-250): Show countries with node counts
      else if (cameraDistance < 250 && country) {
        const countryKey = country;
        if (!labelMap.has(countryKey)) {
          // Calculate average position for country
          const avgLat = nodes.reduce((sum, n) => sum + (n.locationData?.lat || 0), 0) / nodes.length;
          const avgLon = nodes.reduce((sum, n) => sum + (n.locationData?.lon || 0), 0) / nodes.length;
          labelMap.set(countryKey, {
            lat: avgLat,
            lng: avgLon,
            text: `${country} (${nodes.length})`,
            size: 1.3,
            type: 'country',
          });
        }
      }
      // Very zoomed out (> 250): Show only countries with many nodes
      else if (cameraDistance >= 250 && country && nodes.length >= 3) {
        const countryKey = country;
        if (!labelMap.has(countryKey)) {
          const avgLat = nodes.reduce((sum, n) => sum + (n.locationData?.lat || 0), 0) / nodes.length;
          const avgLon = nodes.reduce((sum, n) => sum + (n.locationData?.lon || 0), 0) / nodes.length;
          labelMap.set(countryKey, {
            lat: avgLat,
            lng: avgLon,
            text: country,
            size: 1.5,
            type: 'country',
          });
        }
      }
    });
    
    return Array.from(labelMap.values());
  }, [nodesWithLocation, cameraDistance]);

  // Calculate region counts
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    nodesWithLocation.forEach((node) => {
      const region = node.locationData?.country || 'Unknown';
      counts[region] = (counts[region] || 0) + 1;
    });
    return counts;
  }, [nodesWithLocation]);

  const topRegions = useMemo(() => {
    return Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [regionCounts]);

  // Handle point click
  const handlePointClick = (point: any) => {
    if (point.node) {
      router.push(`/nodes/${point.node.id}`);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setCameraDistance(prev => Math.max(100, prev - 50));
  };

  const handleZoomOut = () => {
    setCameraDistance(prev => Math.min(400, prev + 50));
  };

  const handleReset = () => {
    setCameraDistance(250);
    setGlobeRotation({ lat: 0, lng: 0 });
    if (globeEl.current) {
      globeEl.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1000);
    }
  };

  if (!isClient) {
    return (
      <div>
        <h3 className="text-h3 text-foreground mb-4">Global Node Distribution</h3>
        <div className="h-[500px] flex items-center justify-center text-muted-foreground">
          Loading globe...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-h3 text-foreground mb-2">Global Node Distribution</h3>
        <div className="flex items-center gap-4 text-body text-muted-foreground">
          <span>{nodesWithLocation.length} nodes mapped</span>
          <span>•</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#3F8277]" />
              <span>Online</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#F0A741]" />
              <span>Syncing</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#ED1C24]" />
              <span>Offline</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          style={{ height: '500px', width: '100%', borderRadius: '0.5rem', overflow: 'hidden', position: 'relative' }}
          className="border border-border rounded-xl bg-background"
        >
          {isClient && nodesWithLocation.length > 0 ? (
            <>
              <Globe
                ref={globeEl}
                // Use a map-style texture - Natural Earth with country borders and labels
                // For a more Google Maps-like appearance, we'll use a topographic/terrain style
                globeImageUrl="https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg"
                // Alternative: Use a labeled map texture
                // globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
                pointsData={points}
                pointColor="color"
                pointRadius="size"
                pointLabel={(point: any) => {
                  const node = point.node;
                  if (!node) return '';
                  
                  const status = node.status || 'offline';
                  const pubkey = node.pubkey || node.publicKey || node.id;
                  const shortPubkey = pubkey.length > 12 
                    ? `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}` 
                    : pubkey;
                  
                  return `
                    <div style="
                      background: rgba(0, 0, 0, 0.9);
                      color: white;
                      padding: 8px 12px;
                      border-radius: 6px;
                      font-size: 12px;
                      font-family: system-ui, -apple-system, sans-serif;
                      border: 1px solid ${statusColors[status as keyof typeof statusColors] || statusColors.offline};
                      max-width: 200px;
                    ">
                      <div style="font-weight: 600; margin-bottom: 4px; font-family: monospace;">
                        ${shortPubkey}
                      </div>
                      ${node.locationData?.city ? `<div style="margin-bottom: 4px;">${node.locationData.city}, ${node.locationData.country}</div>` : ''}
                      <div style="margin-bottom: 4px; text-transform: capitalize;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${statusColors[status as keyof typeof statusColors] || statusColors.offline}; margin-right: 6px;"></span>
                        ${status}
                      </div>
                      ${node.version ? `<div style="color: #888; font-size: 11px;">v${node.version}</div>` : ''}
                      ${node.uptimePercent !== undefined ? `<div style="color: #888; font-size: 11px; margin-top: 4px;">Uptime: ${node.uptimePercent.toFixed(1)}%</div>` : ''}
                    </div>
                  `;
                }}
                labelsData={labels}
                labelText="text"
                labelSize="size"
                labelColor={(d: any) => d.type === 'city' ? '#ffffff' : '#ffff00'}
                labelDotRadius={(d: any) => d.type === 'city' ? 0.3 : 0.5}
                labelResolution={2}
                labelAltitude={0.01}
                labelTypeFace="Arial, sans-serif"
                labelIncludeDot={true}
                labelDotOrientation={() => 'right'}
                labelLabel={(d: any) => d.text}
                onLabelClick={(label: any) => {
                  // Zoom to label location
                  if (globeEl.current && label.lat !== undefined && label.lng !== undefined) {
                    globeEl.current.pointOfView({ lat: label.lat, lng: label.lng, altitude: Math.max(1.5, cameraDistance / 2) }, 1000);
                  }
                }}
                onPointClick={handlePointClick}
                pointResolution={2}
                pointAltitude={0.01}
                pointsMerge={false}
                animateIn={true}
                enablePointerInteraction={true}
                showAtmosphere={false}
                onGlobeReady={() => {
                  if (globeEl.current) {
                    globeEl.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 });
                  }
                }}
                onZoom={(coords: any) => {
                  // onZoom provides GeoCoords object, extract distance/altitude if available
                  if (coords && typeof coords === 'object' && 'altitude' in coords) {
                    setCameraDistance(coords.altitude);
                  } else if (typeof coords === 'number') {
                    setCameraDistance(coords);
                  }
                }}
              />
              
              {/* Zoom Controls */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
                <button
                  onClick={handleZoomIn}
                  className="card-stat hover:bg-muted transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4 text-foreground" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="card-stat hover:bg-muted transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4 text-foreground" />
                </button>
                <button
                  onClick={handleReset}
                  className="card-stat hover:bg-muted transition-colors"
                  title="Reset View"
                >
                  <RotateCcw className="w-4 h-4 text-foreground" />
                </button>
              </div>
              
              {/* Zoom Level Indicator */}
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-card/90 border border-border rounded text-body-small text-muted-foreground">
                {cameraDistance < 150 ? 'City View' : cameraDistance < 200 ? 'Country View' : 'Global View'}
              </div>
            </>
          ) : nodesWithLocation.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="mb-2">No nodes with location data available</p>
                <p className="text-body-small">Geographic data is being loaded...</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Loading globe...
            </div>
          )}
        </div>
      </div>

      {topRegions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-body text-muted-foreground mr-2">Top regions:</span>
          {topRegions.map(([region, count]) => (
            <div
              key={region}
              className="px-3 py-1 bg-muted/50 rounded-full text-body-small text-muted-foreground"
            >
              {region}: <span className="text-foreground font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

