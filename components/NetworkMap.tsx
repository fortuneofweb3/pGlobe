'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PNode } from '@/lib/types/pnode';
import dynamic from 'next/dynamic';
import { MapSkeleton } from './Skeletons';

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
);

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

const Tooltip = dynamic(
  () => import('react-leaflet').then((mod) => mod.Tooltip),
  { ssr: false }
);

interface NetworkMapProps {
  nodes: PNode[];
}

const statusColors = {
  online: '#3F8277', // Xandeum green
  syncing: '#F0A741', // Xandeum yellow
  offline: '#ED1C24', // Xandeum red
};

export default function NetworkMap({ nodes }: NetworkMapProps) {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setMapLoaded(true);

    // Load Leaflet CSS
    if (!document.head.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
  }, []);

  // Filter nodes with location data
  const nodesWithLocation = useMemo(() => {
    return nodes.filter((node) => node.locationData && node.locationData.lat && node.locationData.lon);
  }, [nodes]);

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

  // Calculate center point (average of all node locations)
  const center = useMemo((): [number, number] => {
    if (nodesWithLocation.length === 0) return [20, 0]; // Default center

    const avgLat = nodesWithLocation.reduce((sum, node) => sum + (node.locationData?.lat || 0), 0) / nodesWithLocation.length;
    const avgLon = nodesWithLocation.reduce((sum, node) => sum + (node.locationData?.lon || 0), 0) / nodesWithLocation.length;

    return [avgLat, avgLon];
  }, [nodesWithLocation]);

  if (!isClient) {
    return (
      <div>
        <h3 className="text-h3 text-foreground mb-4">Global Node Distribution</h3>
        <MapSkeleton height={400} />
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
          style={{ height: '400px', width: '100%', borderRadius: '0.5rem', overflow: 'hidden' }}
          className="border border-border rounded-xl"
        >
          {isClient && mapLoaded && nodesWithLocation.length > 0 ? (
            <MapContainer
              key={`network-map-${nodesWithLocation.length}`}
              center={center}
              zoom={2}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
              attributionControl={false}
            >
              <TileLayer
                attribution=""
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={20}
              />
              {nodesWithLocation.map((node) => {
                const status = node.status || 'offline';
                const color = statusColors[status] || statusColors.offline;
                const lat = node.locationData?.lat || 0;
                const lon = node.locationData?.lon || 0;

                return (
                  <CircleMarker
                    key={node.id}
                    center={[lat, lon]}
                    radius={10}
                    pathOptions={{
                      fillColor: color,
                      fillOpacity: 0.8,
                      color: '#fff',
                      weight: 2,
                    }}
                    eventHandlers={{
                      click: () => router.push(`/nodes/${node.id}`),
                    }}
                  >
                    <Popup>
                      <div className="text-body">
                        <div className="font-semibold mb-2">Node Details</div>
                        <div className="space-y-1">
                          <div><strong>ID:</strong> {node.id}</div>
                          {node.pubkey && <div><strong>Pubkey:</strong> {node.pubkey.slice(0, 8)}...{node.pubkey.slice(-4)}</div>}
                          <div><strong>Status:</strong> <span className="capitalize">{status}</span></div>
                          {node.version && <div><strong>Version:</strong> {node.version}</div>}
                          {node.locationData?.city && (
                            <div><strong>Location:</strong> {node.locationData.city}, {node.locationData.country}</div>
                          )}
                          {node.uptime && <div><strong>Uptime:</strong> {node.uptime.toFixed(2)}%</div>}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          ) : nodesWithLocation.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="mb-2">No nodes with location data available</p>
                <p className="text-body-small">Geographic data is being loaded...</p>
              </div>
            </div>
          ) : (
            <MapSkeleton height={400} />
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

